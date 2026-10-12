import { prisma } from "src/lib/prisma";
import { getPlanQuota } from "src/lib/quota";
import { creditBonusHires, getDailyHireCap } from "src/lib/hires";

type NewAccount = {
  name: string;
  email: string;
  phone?: string | null;
  passwordHash: string;
  currentCity?: string | null;
  linkedinUrl?: string | null;
  onboardingCompleted?: boolean;
};

// Creates a free-plan user and credits the signup bonus.
export async function createUserAccount(input: NewAccount) {
  const now = new Date();
  const nextReset = new Date(now);
  nextReset.setUTCDate(nextReset.getUTCDate() + 1);
  nextReset.setUTCHours(0, 0, 0, 0);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      passwordHash: input.passwordHash,
      currentCity: input.currentCity || null,
      linkedinUrl: input.linkedinUrl || null,
      role: "user",
      plan: "free",
      onboardingCompleted: Boolean(input.onboardingCompleted),
      quotaUsed: 0,
      quotaTotal: getPlanQuota("free"),
      quotaResetTime: nextReset,
      dailyHireUsed: 0,
      dailyHireCap: getDailyHireCap("free"),
      dailyHireResetTime: nextReset,
    },
  });

  const signupBonus = Math.max(0, Math.floor(Number(process.env.SIGNUP_BONUS_HIRES || 30)));
  if (signupBonus > 0) {
    await creditBonusHires({
      userId: user.id,
      hires: signupBonus,
      referenceType: "signup",
      referenceId: user.id,
      idempotencyKey: `signup_bonus:${user.id}`,
      metadataJson: { email: input.email },
    });
  }

  return user;
}
