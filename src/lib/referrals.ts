import crypto from "crypto";
import { z } from "zod";
import { prisma } from "src/lib/prisma";
import { writeAuditLog } from "src/lib/audit";
import { grantRewardPlan } from "src/lib/plan-access";

/**
 * Refer friends, earn Pro. Every user gets a code; /?ref=CODE stores it in the cp_ref cookie
 * (middleware), signup attaches the new account to the referrer, and the friend "qualifies" when
 * they finish onboarding. Every `threshold` qualified friends earn one reward (ReferralReward,
 * unique per user + batch, so duplicate events can never pay twice).
 */

export const REFERRAL_COOKIE = "cp_ref";
export const REFERRAL_CONFIG_ACTION = "referral.config_updated";

export const referralConfigSchema = z.object({
  enabled: z.boolean(),
  threshold: z.number().int().min(1).max(50),
  rewardPlan: z.enum(["pro", "connect"]),
  rewardDays: z.number().int().min(1).max(365),
  /** Most rewards one user can ever earn (abuse cap). */
  maxRewardsPerUser: z.number().int().min(1).max(100),
});
export type ReferralConfig = z.infer<typeof referralConfigSchema>;

export const DEFAULT_REFERRAL_CONFIG: ReferralConfig = {
  enabled: true,
  threshold: 3,
  rewardPlan: "pro",
  rewardDays: 30,
  maxRewardsPerUser: 12,
};

export async function getReferralConfig(): Promise<ReferralConfig> {
  const latest = await prisma.auditLog.findFirst({
    where: { action: REFERRAL_CONFIG_ACTION },
    orderBy: { createdAt: "desc" },
    select: { metadataJson: true },
  });
  const parsed = referralConfigSchema.safeParse(latest?.metadataJson);
  return parsed.success ? parsed.data : DEFAULT_REFERRAL_CONFIG;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const CODE_RE = /^[A-Z2-9]{6,12}$/;

export function normalizeReferralCode(input: unknown) {
  const code = String(input || "").trim().toUpperCase();
  return CODE_RE.test(code) ? code : "";
}

function randomCode(length = 8) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** The user's referral code, created on first use. */
export async function ensureReferralCode(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (user?.referralCode) return user.referralCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const res = await prisma.user.updateMany({ where: { id: userId, referralCode: null }, data: { referralCode: code } }).catch(() => null);
    if (res?.count) return code;
    const again = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
    if (again?.referralCode) return again.referralCode;
  }
  throw new Error("Could not create a referral code");
}

/**
 * Links a brand-new account to whoever referred it. Ignored for unknown codes, admins, self
 * referrals and accounts that already have a referrer. Never throws: signup must not fail on it.
 */
export async function attributeReferral(newUserId: string, rawCode: string | undefined | null) {
  try {
    const code = normalizeReferralCode(rawCode);
    if (!code) return false;
    const config = await getReferralConfig();
    if (!config.enabled) return false;
    const referrer = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true, role: true } });
    if (!referrer || referrer.id === newUserId || referrer.role !== "user") return false;
    const res = await prisma.user.updateMany({
      where: { id: newUserId, referredById: null },
      data: { referredById: referrer.id, referredAt: new Date() },
    });
    if (res.count) {
      await writeAuditLog({ actorUserId: newUserId, action: "referral.signup", targetType: "user", targetId: referrer.id, metadataJson: { code } }).catch(() => null);
    }
    return res.count > 0;
  } catch (error) {
    console.error("[referrals] attribution failed:", error);
    return false;
  }
}

/**
 * Call when a user finishes onboarding: marks them as a qualified referral (once) and grants the
 * referrer any rewards now due. Safe to call repeatedly. Never throws.
 */
export async function qualifyReferral(userId: string) {
  try {
    const now = new Date();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredById: true, referralQualifiedAt: true, onboardingCompleted: true },
    });
    if (!user?.referredById || user.referralQualifiedAt || !user.onboardingCompleted) return false;
    if (await sharesIpWithReferrer(userId, user.referredById)) {
      // Same network as the referrer: likely their own second account. Held for admin review.
      await writeAuditLog({ actorUserId: userId, action: "referral.held", targetType: "user", targetId: user.referredById, metadataJson: { reason: "same_ip" } }).catch(() => null);
      return false;
    }
    return markQualified(userId, user.referredById, now);
  } catch (error) {
    console.error("[referrals] qualification failed:", error);
    return false;
  }
}

async function markQualified(userId: string, referrerId: string, now = new Date(), approvedBy?: string) {
  const res = await prisma.user.updateMany({ where: { id: userId, referralQualifiedAt: null }, data: { referralQualifiedAt: now } });
  if (!res.count) return false;
  await writeAuditLog({
    actorUserId: approvedBy || userId,
    action: approvedBy ? "referral.approved" : "referral.qualified",
    targetType: "user",
    targetId: approvedBy ? userId : referrerId,
  }).catch(() => null);
  await grantDueRewards(referrerId);
  return true;
}

/** Any IP address used by both accounts (from their sign-in sessions). */
async function sharesIpWithReferrer(userId: string, referrerId: string) {
  const mine = await prisma.session.findMany({ where: { userId, ipAddress: { not: null } }, select: { ipAddress: true }, take: 50 });
  const ips = Array.from(new Set(mine.map((s) => s.ipAddress!).filter((ip) => ip && ip !== "unknown")));
  if (!ips.length) return false;
  const overlap = await prisma.session.count({ where: { userId: referrerId, ipAddress: { in: ips } } });
  return overlap > 0;
}

/** Admin: count a held referral anyway (e.g. family on the same Wi-Fi). */
export async function approveHeldReferral(userId: string, adminId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { referredById: true, referralQualifiedAt: true, onboardingCompleted: true } });
  if (!user?.referredById || user.referralQualifiedAt || !user.onboardingCompleted) return false;
  return markQualified(userId, user.referredById, new Date(), adminId);
}

/** At signup: attach the new account to the referrer in the cp_ref cookie, if any. */
export async function attributeReferralFromCookie(newUserId: string) {
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const code = store.get(REFERRAL_COOKIE)?.value;
    if (!code) return false;
    const attributed = await attributeReferral(newUserId, code);
    store.delete(REFERRAL_COOKIE); // one signup per link visit
    return attributed;
  } catch {
    return false;
  }
}

/** Creates the rewards a referrer has earned so far (idempotent per batch) and applies them. */
export async function grantDueRewards(referrerId: string) {
  const config = await getReferralConfig();
  if (!config.enabled) return 0;
  const qualified = await prisma.user.count({ where: { referredById: referrerId, referralQualifiedAt: { not: null } } });
  const earned = Math.min(Math.floor(qualified / config.threshold), config.maxRewardsPerUser);
  if (earned <= 0) return 0;

  const existing = await prisma.referralReward.findMany({ where: { userId: referrerId }, select: { batch: true } });
  const have = new Set(existing.map((r) => r.batch));
  let created = 0;
  for (let batch = 1; batch <= earned; batch++) {
    if (have.has(batch)) continue;
    const reward = await prisma.referralReward
      .create({ data: { userId: referrerId, batch, plan: config.rewardPlan, days: config.rewardDays } })
      .catch(() => null); // unique (userId, batch): another request created it
    if (!reward) continue;
    created++;
    await writeAuditLog({
      actorUserId: referrerId,
      action: "referral.reward_earned",
      targetType: "referral_reward",
      targetId: reward.id,
      metadataJson: { batch, plan: reward.plan, days: reward.days },
    }).catch(() => null);
    await grantRewardPlan(reward.id);
  }
  return created;
}

const maskName = (name: string) => {
  const first = (name || "Friend").trim().split(/\s+/)[0] || "Friend";
  return first.length <= 2 ? first : `${first.slice(0, 1).toUpperCase()}${first.slice(1, 12)}`;
};

/** Everything the "Refer & Earn" page shows. Friends appear by first name only. */
export async function referralSummary(userId: string, siteUrl: string) {
  const [code, config] = await Promise.all([ensureReferralCode(userId), getReferralConfig()]);
  const [friends, rewards] = await Promise.all([
    prisma.user.findMany({
      where: { referredById: userId },
      orderBy: { referredAt: "desc" },
      take: 100,
      select: { name: true, referredAt: true, referralQualifiedAt: true },
    }),
    prisma.referralReward.findMany({
      where: { userId },
      orderBy: { batch: "asc" },
      select: { batch: true, plan: true, days: true, status: true, appliedAt: true, expiresAt: true, createdAt: true },
    }),
  ]);
  const qualified = friends.filter((f) => f.referralQualifiedAt).length;
  const rewardsEarned = rewards.length;
  const capped = rewardsEarned >= config.maxRewardsPerUser;
  return {
    enabled: config.enabled,
    code,
    link: `${siteUrl.replace(/\/$/, "")}/?ref=${code}`,
    rule: { threshold: config.threshold, rewardPlan: config.rewardPlan, rewardDays: config.rewardDays, maxRewardsPerUser: config.maxRewardsPerUser },
    counts: { signedUp: friends.length, qualified, pending: friends.length - qualified },
    progress: capped ? config.threshold : qualified % config.threshold,
    capped,
    friends: friends.map((f) => ({ name: maskName(f.name), joinedAt: f.referredAt, qualified: Boolean(f.referralQualifiedAt) })),
    rewards,
  };
}
