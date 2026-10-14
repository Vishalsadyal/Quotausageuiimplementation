import crypto from "crypto";
import { NextRequest } from "next/server";
import { fail, handleApiError, ok } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { verifyRazorpayWebhook } from "src/lib/billing";
import { getPlanQuota } from "src/lib/quota";
import { isPaidPlan } from "src/lib/plans";

function toPlan(value: string | undefined) {
  return isPaidPlan(value) ? value : "free";
}

export async function POST(req: NextRequest) {
  try {
    const bodyRaw = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    if (!verifyRazorpayWebhook(bodyRaw, signature)) {
      return fail("Invalid webhook signature", 401, "INVALID_SIGNATURE");
    }

    const payload = JSON.parse(bodyRaw) as Record<string, any>;
    const eventType = String(payload.event || "unknown");
    const eventIdHeader = req.headers.get("x-razorpay-event-id");
    const eventId = eventIdHeader || crypto.createHash("sha256").update(bodyRaw).digest("hex");

    const existing = await prisma.paymentEvent.findUnique({ where: { eventId } });
    if (existing) return ok("Event already processed", { eventId });

    await prisma.paymentEvent.create({
      data: {
        provider: "razorpay",
        eventId,
        eventType,
        payload,
      },
    });

    const subscriptionEntity = payload.payload?.subscription?.entity;
    const providerSubscriptionId = subscriptionEntity?.id as string | undefined;
    const userId = subscriptionEntity?.notes?.userId as string | undefined;
    const plan = toPlan(subscriptionEntity?.notes?.plan as string | undefined);

    if (providerSubscriptionId && userId) {
      const statusMap: Record<string, "trialing" | "active" | "past_due" | "cancelled" | "expired"> = {
        "subscription.authenticated": "active",
        "subscription.activated": "active",
        "subscription.charged": "active",
        "subscription.cancelled": "cancelled",
        "subscription.halted": "past_due",
        "subscription.completed": "expired",
      };
      const mappedStatus = statusMap[eventType] || "active";

      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          provider: "razorpay",
          providerSubscriptionId,
          providerPlanId: subscriptionEntity?.plan_id,
          status: mappedStatus,
          plan,
          currentPeriodStart: subscriptionEntity?.current_start
            ? new Date(subscriptionEntity.current_start * 1000)
            : null,
          currentPeriodEnd: subscriptionEntity?.current_end
            ? new Date(subscriptionEntity.current_end * 1000)
            : null,
          cancelAtPeriodEnd: Boolean(subscriptionEntity?.remaining_count === 0),
        },
        update: {
          providerSubscriptionId,
          providerPlanId: subscriptionEntity?.plan_id,
          status: mappedStatus,
          plan,
          currentPeriodStart: subscriptionEntity?.current_start
            ? new Date(subscriptionEntity.current_start * 1000)
            : null,
          currentPeriodEnd: subscriptionEntity?.current_end
            ? new Date(subscriptionEntity.current_end * 1000)
            : null,
          cancelAtPeriodEnd: Boolean(subscriptionEntity?.remaining_count === 0),
        },
      });

      const userPlan = mappedStatus === "active" || mappedStatus === "trialing" ? plan : "free";
      await prisma.user.update({
        where: { id: userId },
        data: {
          plan: userPlan,
          quotaTotal: getPlanQuota(userPlan),
        },
      });
    }

    await prisma.paymentEvent.update({
      where: { eventId },
      data: { processedAt: new Date() },
    });

    return ok("Webhook processed", { eventId, eventType });
  } catch (error) {
    return handleApiError(error, "Webhook processing failed");
  }
}
