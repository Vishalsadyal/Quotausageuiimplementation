import { NextRequest, after } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { emailSchema } from "src/lib/schemas";
import { createUserAccount } from "src/lib/account";
import { writeAuditLog } from "src/lib/audit";
import { parseResumeFile } from "src/lib/resume-parser";
import { parseResumeWithAi } from "src/lib/resume-ai-parser";
import { mergeResumeFields, saveResumeForUser } from "src/lib/resume-store";
import { generateSearchProfileForUser } from "src/lib/search-profile";
import { invalidateUserAnswersCache } from "src/lib/screening-cache";
import { paymentLinkMessage, setTemporaryPassword, whatsAppUrl } from "src/lib/agency";
import type { PaidPlan } from "src/lib/plans";

export const dynamic = "force-dynamic";

const MAX_MB = 5;

const CLIENT_INCLUDE = {
  user: { select: { id: true, name: true, email: true, phone: true, currentCity: true, plan: true, planExpiresAt: true, onboardingCompleted: true } },
} as const;

/** GET /api/admin/agency?q= : candidates added in Admin > Agency, newest first. */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const q = (req.nextUrl.searchParams.get("q") || "").trim();

    const clients = await prisma.agencyClient.findMany({
      where: q
        ? {
            user: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
              ],
            },
          }
        : {},
      include: CLIENT_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return ok("Agency clients", {
      clients: clients.map((c) => ({
        ...c,
        // Resend the open link without creating a new one.
        paymentWhatsappUrl:
          c.linkUrl && c.linkStatus === "created" && c.linkPlan && c.linkPlan !== "free"
            ? whatsAppUrl(c.user.phone, paymentLinkMessage(c.user.name, c.linkPlan as PaidPlan, c.linkAmountPaise || 0, c.linkUrl))
            : null,
      })),
    });
  } catch (error) {
    return handleApiError(error, "Failed to load agency clients");
  }
}

const addSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: emailSchema,
  phone: z.string().trim().min(10).max(20),
  currentCity: z.string().trim().max(120).optional().default(""),
  roles: z.string().trim().max(500).optional().default(""),
  experienceYears: z.string().trim().max(20).optional().default(""),
  note: z.string().trim().max(1000).optional().default(""),
});

async function saveAnswer(userId: string, questionKey: string, questionLabel: string, answer: string, answerType: string) {
  await writeAuditLog({
    actorUserId: userId,
    action: "user.screening_answer_saved",
    targetType: "screening_answer",
    targetId: questionKey,
    metadataJson: { questionKey, questionLabel, answer, answerType, source: "manual", lastUsed: new Date().toISOString() },
  }).catch(() => null);
}

/**
 * POST /api/admin/agency (multipart: name, email, phone, currentCity, roles, experienceYears, note, resume?)
 * Creates the candidate's account with a temporary password, or adds an existing account to the list.
 * The temporary password is in the response only.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const adminId = authResult.auth.user.id;

    const form = await req.formData();
    const input = addSchema.parse(Object.fromEntries(["name", "email", "phone", "currentCity", "roles", "experienceYears", "note"].map((k) => [k, String(form.get(k) ?? "")])));
    const file = form.get("resume");
    const resume = file instanceof File && file.size > 0 ? file : null;
    if (resume && resume.size > MAX_MB * 1024 * 1024) return fail(`Resume must be ${MAX_MB} MB or smaller`, 400, "FILE_TOO_LARGE");

    let parsed: Awaited<ReturnType<typeof parseResumeFile>> | null = null;
    if (resume) {
      try {
        parsed = await parseResumeFile(resume.name, Buffer.from(await resume.arrayBuffer()));
      } catch (error) {
        return fail(error instanceof Error ? error.message : "Could not read the resume", 400, "UNREADABLE_FILE");
      }
      if (parsed.text.trim().length < 50) return fail("The resume has no readable text. Upload a text-based PDF or DOCX.", 400, "EMPTY_RESUME");
    }

    const existing = await prisma.user.findUnique({ where: { email: input.email }, include: { agencyClient: true } });
    if (existing?.agencyClient) return fail("This candidate is already in the Agency list", 409, "ALREADY_ADDED");
    if (existing?.role === "admin") return fail("This email belongs to an admin account", 400, "ADMIN_ACCOUNT");

    let userId: string;
    let tempPassword: string | null = null;
    if (existing) {
      // Existing account: keep its password and details, only fill the phone if it has none.
      userId = existing.id;
      if (!existing.phone) await prisma.user.update({ where: { id: userId }, data: { phone: input.phone } });
    } else {
      const user = await createUserAccount({
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
        currentCity: input.currentCity || null,
        // The candidate still goes through onboarding (consents, preferences); these details pre-fill it.
        onboardingCompleted: false,
      });
      userId = user.id;
      tempPassword = await setTemporaryPassword(userId);
      await writeAuditLog({
        actorUserId: userId,
        action: "auth.signup",
        targetType: "user",
        targetId: userId,
        metadataJson: { source: "admin_agency", addedBy: adminId },
      });
    }

    const client = await prisma.agencyClient.create({
      data: { userId, addedById: adminId, createdAccount: !existing, note: input.note },
      include: CLIENT_INCLUDE,
    });

    // Roles typed by the admin win over the ones read from the resume.
    if (input.roles) {
      await saveAnswer(userId, "preferred_job_titles", "Preferred Job Titles / Search Terms", input.roles, "multiselect");
      await saveAnswer(userId, "cp_pref_search_terms", "Preferred Job Titles / Search Terms", input.roles, "multiselect");
    }
    if (input.experienceYears) await saveAnswer(userId, "years_of_experience", "Years of Experience", input.experienceYears, "number");
    invalidateUserAnswersCache(userId);

    if (resume && parsed) {
      const fileInfo = { name: resume.name, size: resume.size };
      const resumeText = parsed;
      after(async () => {
        try {
          const ai = await parseResumeWithAi(resumeText.text).catch(() => null);
          await saveResumeForUser(userId, fileInfo, resumeText, mergeResumeFields(resumeText, ai));
          if (input.roles) {
            // Re-save the admin's roles: the resume read above replaces the search terms.
            await saveAnswer(userId, "cp_pref_search_terms", "Preferred Job Titles / Search Terms", input.roles, "multiselect");
            await saveAnswer(userId, "preferred_job_titles", "Preferred Job Titles / Search Terms", input.roles, "multiselect");
          }
          await generateSearchProfileForUser(userId, input.roles ? { saveOnly: ["one_word_keywords", "two_words_keywords", "core_skills", "skills", "bad_words", "exclude_keywords"] } : undefined);
        } catch (error) {
          console.error("agency resume processing failed:", error);
        }
      });
    }

    await writeAuditLog({
      actorUserId: adminId,
      action: "admin.agency_client_added",
      targetType: "user",
      targetId: userId,
      metadataJson: { email: input.email, createdAccount: !existing, withResume: Boolean(resume) },
    }).catch(() => null);

    return ok(existing ? "Existing account added to Agency" : "Candidate account created", { client, tempPassword }, 201);
  } catch (error) {
    return handleApiError(error, "Failed to add candidate");
  }
}
