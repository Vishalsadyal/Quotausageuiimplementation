import type { UserPlan } from "@prisma/client";
import { prisma } from "src/lib/prisma";
import { siteUrl, whatsAppUrl } from "src/lib/agency";
import { ONBOARDING_TOTAL_STEPS, onboardingStepLabel } from "src/lib/onboarding";

// Admin > Follow-ups: who to message on WhatsApp today, and why. The admin sends each message by
// hand (wa.me link) and it is recorded in WhatsAppFollowUp, so nobody gets the same message twice.
// Each person's key says what the message is about; a new plan end date is a new key, so renewal
// reminders come back every cycle while the others are sent once.

export const FOLLOW_UP_REASONS = ["plan_ending", "plan_expired", "never_applied", "onboarding_stuck", "upgrade"] as const;
export type FollowUpReason = (typeof FOLLOW_UP_REASONS)[number];

export const FOLLOW_UP_LABELS: Record<FollowUpReason, { title: string; hint: string }> = {
  plan_ending: { title: "Plan ending", hint: "Paid plan ends in the next 3 days" },
  plan_expired: { title: "Plan expired", hint: "Plan ended in the last 7 days, back on free" },
  never_applied: { title: "Never applied", hint: "Finished onboarding 1-30 days ago, no applications yet" },
  onboarding_stuck: { title: "Onboarding left", hint: "Signed up or stopped in onboarding 2 h - 14 days ago" },
  upgrade: { title: "Ready to upgrade", hint: "Free users with 3+ applications" },
};

export type FollowUpItem = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  plan: UserPlan;
  reason: FollowUpReason;
  key: string;
  detail: string;
  message: string;
  whatsappUrl: string | null;
  sent: { id: string; at: string } | null;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const PLAN_NAME: Record<UserPlan, string> = { free: "Free", pro: "Pro", connect: "Pro Connect", coach: "Career Coach" };

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";
const istDate = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
const istKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD

const userSelect = { id: true, name: true, email: true, phone: true, plan: true } as const;
type BaseUser = { id: string; name: string; email: string; phone: string | null; plan: UserPlan };
type Candidate = { user: BaseUser; key: string; detail: string; message: string };

async function candidates(reason: FollowUpReason, now: number): Promise<Candidate[]> {
  const site = siteUrl();
  const notAdmin = { role: "user" as const };

  if (reason === "plan_ending") {
    const users = await prisma.user.findMany({
      where: { ...notAdmin, plan: { not: "free" }, planExpiresAt: { gt: new Date(now), lte: new Date(now + 3 * DAY_MS) } },
      select: { ...userSelect, planExpiresAt: true },
      orderBy: { planExpiresAt: "asc" },
    });
    return users.map((u) => {
      const ends = istDate(u.planExpiresAt!);
      return {
        user: u,
        key: `plan_ending:${istKey(u.planExpiresAt!)}`,
        detail: `${PLAN_NAME[u.plan]} ends ${ends}`,
        message: `Hi ${firstName(u.name)}, your AutoApply CV ${PLAN_NAME[u.plan]} plan ends on ${ends}. Renew now to keep auto-applying to jobs without a break: ${site}/dashboard/billing`,
      };
    });
  }

  if (reason === "plan_expired") {
    // Timed plans end in src/lib/plan-access.ts, which marks the one-time subscription expired.
    const subs = await prisma.subscription.findMany({
      where: {
        status: "expired",
        providerPlanId: { startsWith: "one_time_" },
        updatedAt: { gte: new Date(now - 7 * DAY_MS) },
        user: { ...notAdmin, plan: "free" },
      },
      select: { plan: true, updatedAt: true, user: { select: userSelect } },
      orderBy: { updatedAt: "desc" },
    });
    return subs.map((s) => {
      const ended = istDate(s.updatedAt);
      return {
        user: s.user,
        key: `plan_expired:${istKey(s.updatedAt)}`,
        detail: `${PLAN_NAME[s.plan]} ended ${ended}`,
        message: `Hi ${firstName(s.user.name)}, your AutoApply CV ${PLAN_NAME[s.plan]} plan ended on ${ended}, so you're back to 3 free applications a day. Renew for ₹99 and keep applying to unlimited jobs: ${site}/dashboard/billing`,
      };
    });
  }

  if (reason === "never_applied") {
    const users = await prisma.user.findMany({
      where: {
        ...notAdmin,
        onboardingCompleted: true,
        createdAt: { gte: new Date(now - 30 * DAY_MS), lte: new Date(now - DAY_MS) },
        applications: { none: {} },
      },
      select: { ...userSelect, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return users.map((u) => ({
      user: u,
      key: "never_applied",
      detail: `Joined ${istDate(u.createdAt)}, 0 applications`,
      message: `Hi ${firstName(u.name)}, your AutoApply CV profile is ready, but no jobs have been applied yet. Install our Chrome extension and start your first auto-apply, your first 3 applications are free: ${site}/dashboard/jobs/linkedin\n\nStuck anywhere? Just reply here and we'll help.`,
    }));
  }

  if (reason === "onboarding_stuck") {
    const users = await prisma.user.findMany({
      where: {
        ...notAdmin,
        onboardingCompleted: false,
        OR: [
          { onboardingStep: { not: null }, onboardingStepAt: { gte: new Date(now - 14 * DAY_MS), lte: new Date(now - 2 * HOUR_MS) } },
          { onboardingStep: null, createdAt: { gte: new Date(now - 14 * DAY_MS), lte: new Date(now - 2 * HOUR_MS) } },
        ],
      },
      select: { ...userSelect, onboardingStep: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return users.map((u) => {
      const step = u.onboardingStep;
      return {
        user: u,
        key: "onboarding_stuck",
        detail: step ? `Left at step ${step}/${ONBOARDING_TOTAL_STEPS}: ${onboardingStepLabel(step)}` : `Signed up ${istDate(u.createdAt)}, not started`,
        message: step
          ? `Hi ${firstName(u.name)}, you're on step ${step} of ${ONBOARDING_TOTAL_STEPS} of your AutoApply CV setup, only a couple of minutes left. Finish it and we'll start applying to jobs for you: ${site}/dashboard/onboarding`
          : `Hi ${firstName(u.name)}, thanks for signing up to AutoApply CV! Set up your profile in about 5 minutes and we'll start applying to jobs for you: ${site}/dashboard/onboarding`,
      };
    });
  }

  // upgrade: free users who are already using auto-apply, most applications first.
  const counts = await prisma.application.groupBy({
    by: ["userId"],
    where: { status: "submitted", user: { ...notAdmin, plan: "free" } },
    _count: { _all: true },
    having: { userId: { _count: { gte: 3 } } },
    orderBy: { _count: { userId: "desc" } },
    take: 300,
  });
  const users = await prisma.user.findMany({ where: { id: { in: counts.map((c) => c.userId) } }, select: userSelect });
  const byId = new Map(users.map((u) => [u.id, u]));
  return counts.flatMap((c) => {
    const u = byId.get(c.userId);
    if (!u) return [];
    const n = c._count._all;
    return [
      {
        user: u,
        key: "upgrade",
        detail: `${n} applications on Free`,
        message: `Hi ${firstName(u.name)}, you've already applied to ${n} jobs with AutoApply CV 🎉 Go unlimited: use code GOINDIA to get Pro Connect (unlimited auto-apply + 20 HR contacts every day) for just ₹99 for 30 days: ${site}/dashboard/billing`,
      },
    ];
  });
}

/** Today's follow-ups for one reason, with whether each was already sent; plus pending counts for every reason. */
export async function listFollowUps(reason: FollowUpReason, now = Date.now()) {
  const all = await Promise.all(FOLLOW_UP_REASONS.map((r) => candidates(r, now)));
  const userIds = Array.from(new Set(all.flat().map((c) => c.user.id)));
  const sentRows = userIds.length
    ? await prisma.whatsAppFollowUp.findMany({ where: { userId: { in: userIds } }, select: { id: true, userId: true, key: true, createdAt: true } })
    : [];
  const sentByKey = new Map(sentRows.map((s) => [`${s.userId}|${s.key}`, s]));

  const counts = {} as Record<FollowUpReason, { pending: number; sent: number }>;
  FOLLOW_UP_REASONS.forEach((r, i) => {
    const sent = all[i].filter((c) => sentByKey.has(`${c.user.id}|${c.key}`)).length;
    counts[r] = { pending: all[i].length - sent, sent };
  });

  const items: FollowUpItem[] = all[FOLLOW_UP_REASONS.indexOf(reason)].map((c) => {
    const sent = sentByKey.get(`${c.user.id}|${c.key}`);
    return {
      userId: c.user.id,
      name: c.user.name,
      email: c.user.email,
      phone: c.user.phone,
      plan: c.user.plan,
      reason,
      key: c.key,
      detail: c.detail,
      message: c.message,
      whatsappUrl: c.user.phone ? whatsAppUrl(c.user.phone, c.message) : null,
      sent: sent ? { id: sent.id, at: sent.createdAt.toISOString() } : null,
    };
  });

  return { items, counts };
}
