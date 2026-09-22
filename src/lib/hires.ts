import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export const MIN_TOPUP_RUPEES = 49;

function nextUtcMidnight(baseDate: Date) {
  const next = new Date(baseDate);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

export function getDailyHireCap(plan: "free" | "pro" | "coach") {
  // Pro is a subscription tier (e.g. $3/month) intended to be effectively unlimited.
  // Keep it as a very large daily cap to avoid edge cases and keep counters numeric.
  if (plan === "pro") return Number(process.env.QUOTA_PRO_DAILY || 1000000);
  if (plan === "coach") return Number(process.env.QUOTA_COACH_DAILY || 200);
  return Number(process.env.QUOTA_FREE_DAILY || 3);
}

export function getDailyFreeHires(plan: "free" | "pro" | "coach") {
  if (plan !== "free") return 0;
  return Number(process.env.FREE_HIRES_DAILY || 3);
}

export function hiresFromRupees(rupees: number) {
  return Math.floor(rupees);
}

export async function ensureHireWindow(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const now = new Date();
  const targetCap = getDailyHireCap(user.plan);
  const shouldReset = now >= user.dailyHireResetTime;
  const clampedUsed = Math.max(0, Math.min(targetCap, user.dailyHireUsed));
  if (shouldReset || user.dailyHireCap !== targetCap) {
    return prisma.user.update({
      where: { id: user.id },
      data: {
        // Clamp in case older versions over-incremented dailyHireUsed beyond the cap.
        dailyHireUsed: shouldReset ? 0 : clampedUsed,
        dailyHireCap: targetCap,
        dailyHireResetTime: shouldReset ? nextUtcMidnight(now) : user.dailyHireResetTime,
      },
    });
  }

  // If cap is unchanged but used drifted above cap due to older bugs, clamp it.
  if (user.dailyHireUsed !== clampedUsed) {
    return prisma.user.update({
      where: { id: user.id },
      data: { dailyHireUsed: clampedUsed },
    });
  }

  return user;
}

function getRemainingDailyCap(user: {
  dailyHireUsed: number;
  dailyHireCap: number;
}) {
  return Math.max(0, user.dailyHireCap - user.dailyHireUsed);
}

function getFreeRemaining(user: {
  plan: "free" | "pro" | "coach";
  dailyHireUsed: number;
}) {
  const free = getDailyFreeHires(user.plan);
  return Math.max(0, free - user.dailyHireUsed);
}

export async function getWalletSummary(userId: string) {
  const user = await ensureHireWindow(userId);
  const freeRemaining = getFreeRemaining(user);
  // Daily cap applies only to free credits; paid Hires can be used beyond the free daily cap.
  const dailyRemaining = getRemainingDailyCap(user);
  const spendable =
    user.plan === "pro"
      ? 1000000
      : Math.max(0, user.hireBalance + freeRemaining);
  return {
    user,
    freeRemaining,
    dailyRemaining,
    spendable,
  };
}

async function createTxnInTx(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    type: "credit_purchase" | "credit_bonus" | "debit_apply" | "refund_apply" | "admin_adjustment";
    amount: number;
    balanceAfter: number;
    referenceType?: string;
    referenceId?: string;
    metadataJson?: Prisma.InputJsonValue;
    idempotencyKey?: string;
  },
) {
  return tx.hireTransaction.create({
    data: {
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      balanceAfter: input.balanceAfter,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      metadataJson: input.metadataJson,
      idempotencyKey: input.idempotencyKey,
    },
  });
}

export async function creditHires(input: {
  userId: string;
  hires: number;
  referenceType: string;
  referenceId: string;
  idempotencyKey?: string;
  metadataJson?: Prisma.InputJsonValue;
}) {
  if (input.hires <= 0) throw new Error("Hires must be positive");
  const user = await ensureHireWindow(input.userId);
  return prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx.hireTransaction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
    }

    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        hireBalance: { increment: input.hires },
        hirePurchased: { increment: input.hires },
      },
    });

    return createTxnInTx(tx, {
      userId: updated.id,
      type: "credit_purchase",
      amount: input.hires,
      balanceAfter: updated.hireBalance,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      metadataJson: input.metadataJson,
      idempotencyKey: input.idempotencyKey,
    });
  });
}

export async function creditBonusHires(input: {
  userId: string;
  hires: number;
  referenceType: string;
  referenceId: string;
  idempotencyKey?: string;
  metadataJson?: Prisma.InputJsonValue;
}) {
  if (input.hires <= 0) throw new Error("Hires must be positive");
  const user = await ensureHireWindow(input.userId);
  return prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx.hireTransaction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
    }

    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        hireBalance: { increment: input.hires },
      },
    });

    return createTxnInTx(tx, {
      userId: updated.id,
      type: "credit_bonus",
      amount: input.hires,
      balanceAfter: updated.hireBalance,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      metadataJson: input.metadataJson,
      idempotencyKey: input.idempotencyKey,
    });
  });
}

export async function adjustHiresByAdmin(input: {
  userId: string;
  delta: number;
  referenceId: string;
  metadataJson?: Prisma.InputJsonValue;
}) {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new Error("Adjustment delta must be non-zero integer");
  }
  const user = await ensureHireWindow(input.userId);
  return prisma.$transaction(async (tx) => {
    const nextBalance = user.hireBalance + input.delta;
    if (nextBalance < 0) throw new Error("Insufficient Hires for this adjustment");

    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        hireBalance: nextBalance,
        hirePurchased: input.delta > 0 ? { increment: input.delta } : undefined,
      },
    });

    return createTxnInTx(tx, {
      userId: updated.id,
      type: "admin_adjustment",
      amount: input.delta,
      balanceAfter: updated.hireBalance,
      referenceType: "admin",
      referenceId: input.referenceId,
      metadataJson: input.metadataJson,
    });
  });
}

export async function consumeHiresForApplies(input: {
  userId: string;
  count: number;
  referenceType: string;
  referenceId: string;
  idempotencyPrefix: string;
  metadataJson?: Prisma.InputJsonValue;
}) {
  if (input.count <= 0) return { ok: true as const, consumed: 0, sourceBreakdown: { free: 0, paid: 0 } };

  const user = await ensureHireWindow(input.userId);
  if (user.plan === "pro") {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        hireSpent: { increment: input.count },
        dailyHireUsed: { increment: input.count },
      },
    });
    return { ok: true as const, consumed: input.count, sourceBreakdown: { free: input.count, paid: 0 } };
  }

  const freeRemaining = getFreeRemaining(user);
  const paidNeeded = Math.max(0, input.count - freeRemaining);
  if (user.hireBalance < paidNeeded) {
    return { ok: false as const, reason: "INSUFFICIENT_HIRES" as const };
  }

  return prisma.$transaction(async (tx) => {
    const refreshed = await tx.user.findUnique({ where: { id: user.id } });
    if (!refreshed) throw new Error("User not found");

    const freeNow = Math.max(0, getDailyFreeHires(refreshed.plan) - refreshed.dailyHireUsed);
    const paidNow = Math.max(0, input.count - freeNow);
    if (refreshed.hireBalance < paidNow) {
      return { ok: false as const, reason: "INSUFFICIENT_HIRES" as const };
    }

    const freeConsumed = Math.min(freeNow, input.count);
    const nextBalance = refreshed.hireBalance - paidNow;

    const updated = await tx.user.updateMany({
      where: {
        id: refreshed.id,
        hireBalance: { gte: paidNow },
      },
      data: {
        hireBalance: nextBalance,
        hireSpent: { increment: input.count },
        dailyHireUsed: { increment: freeConsumed },
      },
    });

    if (updated.count === 0) {
      return { ok: false as const, reason: "INSUFFICIENT_HIRES" as const };
    }

    if (paidNow > 0) {
      await createTxnInTx(tx, {
        userId: refreshed.id,
        type: "debit_apply",
        amount: -paidNow,
        balanceAfter: nextBalance,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        metadataJson: {
          ...(typeof input.metadataJson === "object" && input.metadataJson ? (input.metadataJson as object) : {}),
          freeConsumed,
          paidConsumed: paidNow,
        } as Prisma.InputJsonValue,
        idempotencyKey: `${input.idempotencyPrefix}:debit:${paidNow}`,
      });
    }

    return {
      ok: true as const,
      consumed: input.count,
      sourceBreakdown: {
        free: freeConsumed,
        paid: paidNow,
      },
    };
  });
}

export async function refundHires(input: {
  userId: string;
  count: number;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  metadataJson?: Prisma.InputJsonValue;
}) {
  if (input.count <= 0) return null;
  const user = await ensureHireWindow(input.userId);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.hireTransaction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;

    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        hireBalance: { increment: input.count },
        hireSpent: { decrement: input.count },
      },
    });

    return createTxnInTx(tx, {
      userId: updated.id,
      type: "refund_apply",
      amount: input.count,
      balanceAfter: updated.hireBalance,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      metadataJson: input.metadataJson,
      idempotencyKey: input.idempotencyKey,
    });
  });
}
