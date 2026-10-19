import type { Prisma, UserPlan } from "@prisma/client";
import { prisma } from "./prisma";
import { writeAuditLog } from "./audit";
import { activateSubscriptionPlan, PLAN_PERIOD_DAYS } from "./plan-access";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * One successful subscription charge (the first payment or a renewal). Safe to call twice for the same
 * payment (the checkout verify and the webhook both do): the payment id is recorded once.
 * Access runs to the end of the paid period plus a short grace; cancelling therefore never cuts it short.
 */
export async function recordSubscriptionCharge(input: {
  userId: string;
  plan: Exclude<UserPlan, "free">;
  subscriptionId: string;
  providerPlanId?: string | null;
  paymentId: string;
  amountPaise: number;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}) {
  const now = new Date();
  const finalRupees = Math.max(0, Math.round(input.amountPaise / 100));
  const paidUntil = input.periodEnd && input.periodEnd > now ? input.periodEnd : new Date(now.getTime() + PLAN_PERIOD_DAYS * DAY_MS);

  const alreadyDone = await prisma.$transaction(async (tx) => {
    const seen = await tx.paymentEvent.findUnique({ where: { eventId: `subpay:${input.paymentId}` } });
    if (seen) return true;
    await tx.paymentEvent.create({
      data: {
        provider: "razorpay",
        eventId: `subpay:${input.paymentId}`,
        eventType: "subscription.paid",
        payload: {
          paymentId: input.paymentId,
          subscriptionId: input.subscriptionId,
          plan: input.plan,
          baseRupees: finalRupees,
          discountRupees: 0,
          finalRupees,
        } as Prisma.InputJsonValue,
        processedAt: now,
      },
    });
    await activateSubscriptionPlan(tx, input.userId, input.plan, paidUntil, now);
    await tx.subscription.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        provider: "razorpay",
        providerSubscriptionId: input.subscriptionId,
        providerPlanId: input.providerPlanId || null,
        status: "active",
        plan: input.plan,
        currentPeriodStart: input.periodStart || now,
        currentPeriodEnd: paidUntil,
      },
      update: {
        providerSubscriptionId: input.subscriptionId,
        providerPlanId: input.providerPlanId || undefined,
        status: "active",
        plan: input.plan,
        currentPeriodStart: input.periodStart || now,
        currentPeriodEnd: paidUntil,
      },
    });
    return false;
  });

  if (!alreadyDone) {
    await writeAuditLog({
      actorUserId: input.userId,
      action: "billing.plan_purchased",
      targetType: "payment",
      targetId: input.paymentId,
      metadataJson: { plan: input.plan, finalRupees, discountCode: null, expiresAt: paidUntil.toISOString(), source: "subscription" },
    }).catch(() => null);
  }
  return { alreadyDone };
}
