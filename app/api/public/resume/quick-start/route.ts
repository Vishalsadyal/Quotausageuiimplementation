import { NextRequest, after } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "src/lib/prisma";
import { attributeReferralFromCookie, qualifyReferral } from "src/lib/referrals";
import { fail, handleApiError, ok } from "src/lib/api";
import { emailSchema } from "src/lib/schemas";
import { parseResumeFile } from "src/lib/resume-parser";
import { parseResumeWithAi } from "src/lib/resume-ai-parser";
import { mergeResumeFields, saveResumeForUser } from "src/lib/resume-store";
import { createUserAccount } from "src/lib/account";
import { createSessionAndTokens, setAuthCookies, toClientUser } from "src/lib/auth";
import { generateSearchProfileForUser } from "src/lib/search-profile";
import { sendMail } from "src/lib/mail";
import { writeAuditLog } from "src/lib/audit";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";

// Home-page agent: read the uploaded resume and, when it has an email that has no
// account yet, create the account, log the visitor in and fill their profile.
//   next: "dashboard" -> account created and logged in
//   next: "login"     -> that email already has an account; send them to log in
//   next: "signup"    -> no email in the resume; fall back to the signup form
const MAX_MB = 5;

function siteUrl() {
  return String(process.env.APP_SITE_URL || "https://www.autoapplycv.in").replace(/\/+$/, "");
}

async function sendWelcomeEmail(to: string, name: string) {
  const loginUrl = `${siteUrl()}/login`;
  const firstName = name.split(/\s+/)[0] || "there";
  const text = [
    `Hi ${firstName},`,
    "",
    "Your AutoApply CV account is ready. We set it up from the resume you uploaded, and your profile and job keywords are filled in.",
    "",
    `To log in again, open ${loginUrl} and choose the "OTP Code" tab. We'll email you a code, so you don't need a password.`,
    `Want a password? Use "Forgot password" on the same page to set one.`,
    "",
    "Didn't upload a resume to AutoApply CV? Reply to this email and we'll delete this account.",
    "",
    "AutoApply CV",
  ].join("\n");
  const safeFirstName = firstName.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const html = `
    <p>Hi ${safeFirstName},</p>
    <p>Your AutoApply CV account is ready. We set it up from the resume you uploaded, and your profile and job keywords are filled in.</p>
    <p>To log in again, open <a href="${loginUrl}">${loginUrl}</a> and choose the <b>OTP Code</b> tab. We'll email you a code, so you don't need a password.</p>
    <p>Want a password? Use <b>Forgot password</b> on the same page to set one.</p>
    <p style="color:#6b7280">Didn't upload a resume to AutoApply CV? Reply to this email and we'll delete this account.</p>
    <p>AutoApply CV</p>`;
  await sendMail({ to, subject: "Your AutoApply CV account is ready", text, html, template: "resume_quick_start_welcome" });
}

export async function POST(req: NextRequest) {
  try {
    const rl = await enforceRateLimit({
      key: rateLimitKey(req, "public.resume.quick_start"),
      limit: 15,
      windowMs: 600_000,
    });
    if (rl) return rl;

    const formData = await req.formData();
    const file = formData.get("resume");
    if (!(file instanceof File)) return fail("Resume file is required", 400, "FILE_REQUIRED");
    if (file.size > MAX_MB * 1024 * 1024) return fail(`Resume must be ${MAX_MB} MB or smaller`, 400, "FILE_TOO_LARGE");

    let parsed;
    try {
      parsed = await parseResumeFile(file.name, Buffer.from(await file.arrayBuffer()));
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Could not read this file", 400, "UNREADABLE_FILE");
    }
    if (parsed.text.trim().length < 50) {
      return fail("This file has no readable text. Upload a text-based PDF or DOCX.", 400, "EMPTY_RESUME");
    }

    let ai: Awaited<ReturnType<typeof parseResumeWithAi>> | null = null;
    try {
      ai = await parseResumeWithAi(parsed.text);
    } catch {
      // AI extraction is optional; the regex fields still work.
    }

    const merged = mergeResumeFields(parsed, ai);
    const jobTitles = Array.isArray(ai?.jobTitles) ? ai.jobTitles.filter(Boolean).slice(0, 3) : [];
    const years = Number(String(ai?.yearsOfExperience ?? "").replace(/[^\d.]/g, ""));
    const profile = {
      name: String(merged.name || "").trim(),
      email: String(merged.email || "").trim(),
      phone: String(merged.phone || "").trim(),
      city: String(ai?.city || parsed.extracted.currentCity || "").trim(),
      linkedinUrl: String(merged.linkedinUrl || "").trim(),
      jobTitles,
      yearsOfExperience: Number.isFinite(years) && String(ai?.yearsOfExperience ?? "").trim() ? String(Math.round(years)) : "",
    };

    const emailResult = emailSchema.safeParse(profile.email);
    if (!emailResult.success) {
      return ok("Resume read", { next: "signup", profile });
    }
    const email = emailResult.data;

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return ok("Account exists", { next: "login", email, profile });
    }

    // Creating accounts is limited separately from reading resumes.
    const createRl = await enforceRateLimit({
      key: rateLimitKey(req, "public.resume.quick_start.create"),
      limit: 3,
      windowMs: 3_600_000,
    });
    if (createRl) return ok("Resume read", { next: "signup", profile });

    const name = profile.name || email.split("@")[0];
    // No password yet: the user logs in with an email OTP or sets one via "Forgot password".
    const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);

    let user;
    try {
      user = await createUserAccount({
        name,
        email,
        phone: profile.phone || null,
        passwordHash,
        currentCity: profile.city || null,
        linkedinUrl: profile.linkedinUrl || null,
        // Skip onboarding only when the resume gave every detail job search needs;
        // otherwise the visitor answers the missing ones there.
        onboardingCompleted: Boolean(
          profile.name && profile.phone && profile.city && profile.yearsOfExperience && profile.jobTitles.length,
        ),
      });
    } catch (error) {
      // Another request created this email a moment ago.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return ok("Account exists", { next: "login", email, profile });
      }
      throw error;
    }

    await saveResumeForUser(user.id, file, parsed, merged);
    if (await attributeReferralFromCookie(user.id)) await qualifyReferral(user.id);

    const { accessToken, refreshToken } = await createSessionAndTokens({ id: user.id, email: user.email, role: user.role });
    await setAuthCookies(accessToken, refreshToken);

    await writeAuditLog({
      actorUserId: user.id,
      action: "auth.signup",
      targetType: "user",
      targetId: user.id,
      metadataJson: { source: "resume_quick_start" },
    });

    // Keyword generation and the welcome email take a few seconds; finish them after responding.
    after(async () => {
      await generateSearchProfileForUser(user.id).catch((error) => console.error("quick-start keywords failed:", error));
      await sendWelcomeEmail(email, name).catch((error) => console.error("quick-start welcome email failed:", error));
    });

    const refreshedUser = await prisma.user.findUnique({ where: { id: user.id } });
    return ok("Account created", { next: "dashboard", user: toClientUser(refreshedUser || user), profile });
  } catch (error) {
    return handleApiError(error, "Failed to read resume");
  }
}
