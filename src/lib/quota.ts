import { prisma } from "./prisma";
import { isUnlimitedPlan, type UserPlanName } from "./plans";

export function getPlanQuota(plan: UserPlanName) {
  if (isUnlimitedPlan(plan)) return Number(process.env.QUOTA_PRO_DAILY || 50);
  if (plan === "coach") return Number(process.env.QUOTA_COACH_DAILY || 200);
  return Number(process.env.QUOTA_FREE_DAILY || 3);
}

function nextUtcMidnight(baseDate: Date) {
  const next = new Date(baseDate);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

export async function ensureQuotaWindow(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const now = new Date();
  const targetTotal = getPlanQuota(user.plan);
  if (now >= user.quotaResetTime || user.quotaTotal !== targetTotal) {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        quotaUsed: now >= user.quotaResetTime ? 0 : user.quotaUsed,
        quotaTotal: targetTotal,
        quotaResetTime: now >= user.quotaResetTime ? nextUtcMidnight(now) : user.quotaResetTime,
      },
    });
    return updated;
  }
  return user;
}

export async function consumeQuota(userId: string, amount = 1) {
  const user = await ensureQuotaWindow(userId);
  if (user.quotaUsed + amount > user.quotaTotal) {
    return { ok: false, user };
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { quotaUsed: { increment: amount } },
  });
  return { ok: true, user: updated };
}
