import { NextRequest } from "next/server";
import { prisma } from "src/lib/prisma";
import { qualifyReferral } from "src/lib/referrals";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { onboardingSchema } from "src/lib/schemas";
import { toClientUser } from "src/lib/auth";
import { writeAuditLog } from "src/lib/audit";
import { hasCompletedRequiredOnboarding } from "src/lib/onboarding";
import { z } from "zod";

const onboardingDraftSchema = z.object({
  name: z.string().trim().min(0).max(80).optional(),
  phone: z.string().trim().min(0).max(30).optional(),
  currentCity: z.string().trim().min(0).max(120).optional(),
  addressLine: z.string().trim().min(0).max(300).optional(),
  linkedinUrl: z.string().trim().min(0).max(300).optional(),
  portfolioUrl: z.string().trim().min(0).max(300).optional(),
  currentStep: z.number().int().min(0).max(5).optional(),
  profileQuestionIndex: z.number().int().min(0).max(20).optional(),
  preferences: z
    .object({
      searchTerms: z.string().max(2000).optional(),
      searchLocation: z.string().max(300).optional(),
      yearsOfExperienceAnswer: z.string().max(50).optional(),
      requireVisa: z.string().max(100).optional(),
      usCitizenship: z.string().max(100).optional(),
      desiredSalary: z.string().max(100).optional(),
      noticePeriodDays: z.string().max(100).optional(),
      recentEmployer: z.string().max(300).optional(),
      confidenceLevel: z.string().max(10).optional(),
      coverLetter: z.string().max(4000).optional(),
      searchLocations: z.string().max(1200).optional(),
      workMode: z.string().max(80).optional(),
      jobTypes: z.string().max(800).optional(),
      salaryMin: z.string().max(80).optional(),
      salaryMax: z.string().max(80).optional(),
      preferredCountries: z.string().max(800).optional(),
      excludedCompanies: z.string().max(1600).optional(),
      excludedKeywords: z.string().max(1600).optional(),
    })
    .partial()
    .optional(),
  screeningRows: z
    .array(
      z.object({
        questionKey: z.string().max(160),
        questionLabel: z.string().max(500),
        answer: z.string().max(1000),
      }),
    )
    .max(300)
    .optional(),
});

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function GET() {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const [user, latestDraftLog] = await Promise.all([
    prisma.user.findUnique({ where: { id: authResult.auth.user.id } }),
    prisma.auditLog.findFirst({
      where: {
        actorUserId: authResult.auth.user.id,
        action: "user.onboarding_progress_saved",
      },
      orderBy: { createdAt: "desc" },
      select: { metadataJson: true, createdAt: true },
    }),
  ]);
  if (!user) return fail("User not found", 404, "USER_NOT_FOUND");

  const draftMeta = asObject(latestDraftLog?.metadataJson);
  const progress = draftMeta
    ? {
        currentStep:
          typeof draftMeta.currentStep === "number" && Number.isFinite(draftMeta.currentStep)
            ? Math.max(0, Math.min(5, Math.floor(draftMeta.currentStep)))
            : 0,
        profileQuestionIndex:
          typeof draftMeta.profileQuestionIndex === "number" &&
          Number.isFinite(draftMeta.profileQuestionIndex)
            ? Math.max(0, Math.min(20, Math.floor(draftMeta.profileQuestionIndex)))
            : 0,
        preferences: asObject(draftMeta.preferences) || undefined,
        screeningRows: Array.isArray(draftMeta.screeningRows) ? draftMeta.screeningRows : undefined,
        savedAt: latestDraftLog?.createdAt.toISOString(),
      }
    : null;

  return ok("Onboarding profile fetched", { user: toClientUser(user), progress });
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const payload = onboardingDraftSchema.parse(await req.json());
    const userId = authResult.auth.user.id;
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) return fail("User not found", 404, "USER_NOT_FOUND");

    const updateData: Record<string, string> = {};
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.phone !== undefined) updateData.phone = payload.phone;
    if (payload.currentCity !== undefined) updateData.currentCity = payload.currentCity;
    if (payload.addressLine !== undefined) updateData.addressLine = payload.addressLine;
    if (payload.linkedinUrl !== undefined) updateData.linkedinUrl = payload.linkedinUrl;
    if (payload.portfolioUrl !== undefined) updateData.portfolioUrl = payload.portfolioUrl;

    const updatedUser =
      Object.keys(updateData).length > 0
        ? await prisma.user.update({
            where: { id: userId },
            data: updateData,
          })
        : existing;

    await writeAuditLog({
      actorUserId: userId,
      action: "user.onboarding_progress_saved",
      targetType: "user",
      targetId: userId,
      metadataJson: {
        currentStep: payload.currentStep ?? 0,
        profileQuestionIndex: payload.profileQuestionIndex ?? 0,
        preferences: payload.preferences || {},
        screeningRows: payload.screeningRows || [],
      },
    });

    return ok("Onboarding draft saved", { user: toClientUser(updatedUser) });
  } catch (error) {
    return handleApiError(error, "Failed to save onboarding draft");
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const payload = onboardingSchema.parse(await req.json());
    const userId = authResult.auth.user.id;
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) return fail("User not found", 404, "USER_NOT_FOUND");

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: payload.name,
        phone: payload.phone,
        currentCity: payload.currentCity,
        addressLine: payload.addressLine,
        linkedinUrl: payload.linkedinUrl,
        portfolioUrl: payload.portfolioUrl,
      },
    });
    const completed = hasCompletedRequiredOnboarding(user);
    const finalizedUser = completed
      ? await prisma.user.update({
          where: { id: user.id },
          data: { onboardingCompleted: true },
        })
      : user;
    // A referred friend who finishes onboarding counts toward their referrer's reward.
    if (completed) await qualifyReferral(user.id);

    await writeAuditLog({
      actorUserId: userId,
      action: "user.onboarding_completed",
      targetType: "user",
      targetId: userId,
    });

    return ok("Onboarding completed", { user: toClientUser(finalizedUser) });
  } catch (error) {
    return handleApiError(error, "Failed to save onboarding details");
  }
}
