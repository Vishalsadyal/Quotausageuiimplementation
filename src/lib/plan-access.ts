import type { Prisma, User, UserPlan } from "@prisma/client";
import { prisma } from "src/lib/prisma";
import { getPlanQuota } from "src/lib/quota";

/**
 * Timed plans. One-time purchases (from Oct 2026) and referral rewards last PLAN_PERIOD_DAYS.
 * planExpiresAt = null means the plan does not expire (users who paid before expiry existed keep
 * their plan). planAfterExpiry is where a timed plan falls back to: e.g. a permanent Pro user who
 * buys 30 days of Pro Connect returns to Pro, not Free.
 *
 *   expirePlanIfDue          lazily ends a timed plan (and applies a waiting referral reward)
 *   activatePurchasedPlan    after a verified payment
 *   grantRewardPlan          referral reward (applied now, or when a higher plan ends)
 */

export const PLAN_PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Higher number = more features. A reward never replaces a higher active plan. */
const PLAN_RANK: Record<UserPlan, number> = { free: 0, pro: 1, connect: 2, coach: 3 };

type Db = Prisma.TransactionClient | typeof prisma;

function planData(plan: UserPlan) {
  return { plan, quotaTotal: getPlanQuota(plan) };
}

/**
 * Ends the user's timed plan if its time is up: switches to a waiting referral reward, else back to
 * planAfterExpiry (or free). Returns the current user row. Cheap when nothing is due.
 */
export async function expirePlanIfDue<T extends Pick<User, "id" | "plan" | "planExpiresAt" | "planAfterExpiry">>(
  user: T,
  now = new Date()
): Promise<T> {
  if (!user.planExpiresAt || user.planExpiresAt > now) return user;

  const waiting = await prisma.referralReward.findFirst({
    where: { userId: user.id, status: "pending" },
    orderBy: { createdAt: "asc" },
  });
  const fallback: UserPlan = user.planAfterExpiry || "free";

  if (waiting && PLAN_RANK[waiting.plan] > PLAN_RANK[fallback]) {
    const expiresAt = new Date(now.getTime() + waiting.days * DAY_MS);
    await prisma.$transaction([
      prisma.referralReward.update({ where: { id: waiting.id }, data: { status: "applied", appliedAt: now, expiresAt } }),
      prisma.user.update({
        where: { id: user.id },
        data: { ...planData(waiting.plan), planExpiresAt: expiresAt, planAfterExpiry: fallback === "free" ? null : fallback },
      }),
    ]);
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { ...planData(fallback), planExpiresAt: null, planAfterExpiry: null } });
    await prisma.subscription.updateMany({ where: { userId: user.id, status: "active", providerPlanId: { startsWith: "one_time_" } }, data: { status: "expired" } });
  }
  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  return (fresh as unknown as T) || user;
}

/** New timed period for `plan`: extends the current one when it is the same plan, else starts now. */
function nextPeriod(
  current: Pick<User, "plan" | "planExpiresAt" | "planAfterExpiry">,
  plan: UserPlan,
  days: number,
  now: Date
) {
  const sameTimedPlan = current.plan === plan && current.planExpiresAt && current.planExpiresAt > now;
  const start = sameTimedPlan ? current.planExpiresAt!.getTime() : now.getTime();
  // Coming from a permanent paid plan: return to it afterwards.
  const keepAfter =
    current.plan !== plan && current.plan !== "free" && !current.planExpiresAt ? current.plan : current.planAfterExpiry;
  return { planExpiresAt: new Date(start + days * DAY_MS), planAfterExpiry: keepAfter && keepAfter !== plan ? keepAfter : null };
}

/** After a verified payment: the plan for PLAN_PERIOD_DAYS (extends an active period of the same plan). */
export async function activatePurchasedPlan(db: Db, userId: string, plan: UserPlan, now = new Date()) {
  const current = await db.user.findUnique({ where: { id: userId }, select: { plan: true, planExpiresAt: true, planAfterExpiry: true } });
  if (!current) throw new Error("User not found");
  if (current.plan === plan && !current.planExpiresAt) {
    // Already has this plan permanently (bought before expiry existed): nothing to time-limit.
    return { plan, planExpiresAt: null as Date | null };
  }
  const period = nextPeriod(current, plan, PLAN_PERIOD_DAYS, now);
  await db.user.update({ where: { id: userId }, data: { ...planData(plan), ...period } });
  return { plan, planExpiresAt: period.planExpiresAt };
}

/** Days a subscriber keeps the plan after the paid period ends, so a slightly late renewal never cuts them off. */
export const SUBSCRIPTION_GRACE_DAYS = 3;

/** After a successful subscription charge: the plan until the end of the paid period plus a short grace. */
export async function activateSubscriptionPlan(db: Db, userId: string, plan: UserPlan, paidUntil: Date, now = new Date()) {
  const current = await db.user.findUnique({ where: { id: userId }, select: { plan: true, planExpiresAt: true, planAfterExpiry: true } });
  if (!current) throw new Error("User not found");
  if (current.plan === plan && !current.planExpiresAt) return { plan, planExpiresAt: null as Date | null };
  const period = nextPeriod(current, plan, 0, now);
  const planExpiresAt = new Date(Math.max(paidUntil.getTime(), now.getTime()) + SUBSCRIPTION_GRACE_DAYS * DAY_MS);
  await db.user.update({ where: { id: userId }, data: { ...planData(plan), planAfterExpiry: period.planAfterExpiry, planExpiresAt } });
  return { plan, planExpiresAt };
}

/**
 * Referral reward: `plan` for `days`. Applied now if it is an upgrade or extends the same timed
 * plan; kept "pending" while the user has a higher timed plan (applied when that ends); marked
 * "not_needed" when they already have this plan or better permanently.
 */
export async function grantRewardPlan(rewardId: string, now = new Date()) {
  const reward = await prisma.referralReward.findUnique({ where: { id: rewardId } });
  if (!reward || reward.status !== "pending") return reward;
  const user = await prisma.user.findUnique({ where: { id: reward.userId }, select: { plan: true, planExpiresAt: true, planAfterExpiry: true } });
  if (!user) return reward;

  const currentRank = PLAN_RANK[user.plan];
  const rewardRank = PLAN_RANK[reward.plan];
  if (currentRank >= rewardRank && !user.planExpiresAt) {
    return prisma.referralReward.update({ where: { id: reward.id }, data: { status: "not_needed", note: `already on ${user.plan}` } });
  }
  if (currentRank > rewardRank) return reward; // higher timed plan: applied by expirePlanIfDue later

  const period = nextPeriod(user, reward.plan, reward.days, now);
  const [, applied] = await prisma.$transaction([
    prisma.user.update({ where: { id: reward.userId }, data: { ...planData(reward.plan), ...period } }),
    prisma.referralReward.update({ where: { id: reward.id }, data: { status: "applied", appliedAt: now, expiresAt: period.planExpiresAt } }),
  ]);
  return applied;
}

/** Daily sweep so plans end even for users who don't open the app. */
export async function expireDuePlans(now = new Date()) {
  const due = await prisma.user.findMany({
    where: { planExpiresAt: { lte: now } },
    select: { id: true, plan: true, planExpiresAt: true, planAfterExpiry: true },
    take: 500,
  });
  for (const user of due) await expirePlanIfDue(user, now);
  return due.length;
}
