import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "src/lib/prisma";
import { handleApiError, ok } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { ONBOARDING_TOTAL_STEPS } from "src/lib/onboarding";

// The onboarding screen the user is on (OnboardingFlow.tsx), shown in Admin > Users.
const stepSchema = z.object({ step: z.number().int().min(1).max(ONBOARDING_TOTAL_STEPS) });

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const { step } = stepSchema.parse(await req.json());

    // An admin clicking through with "view as user" shouldn't move the user's progress.
    const session = await prisma.session.findUnique({
      where: { id: authResult.auth.sessionId },
      select: { impersonatorId: true },
    });
    if (session?.impersonatorId) return ok("Step not saved while viewing as user");

    await prisma.user.update({
      where: { id: authResult.auth.user.id },
      data: { onboardingStep: step, onboardingStepAt: new Date() },
    });
    return ok("Onboarding step saved");
  } catch (error) {
    return handleApiError(error, "Failed to save onboarding step");
  }
}
