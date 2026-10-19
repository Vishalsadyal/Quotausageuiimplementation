import crypto from "crypto";
import { NextRequest } from "next/server";
import { fail, handleApiError, ok } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { verifyRazorpayWebhook } from "src/lib/billing";
import { recordSubscriptionCharge } from "src/lib/subscriptions";
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

    const paymentEntity = payload.payload?.payment?.entity;
    if (providerSubscriptionId && userId) {
      const periodStart = subscriptionEntity?.current_start ? new Date(subscriptionEntity.current_start * 1000) : null;
      const periodEnd = subscriptionEntity?.current_end ? new Date(subscriptionEntity.current_end * 1000) : null;

      if (eventType === "subscription.charged" && paymentEntity?.id && plan !== "free") {
        // A successful charge (first payment or renewal): the only event that grants or extends access.
        await recordSubscriptionCharge({
          userId,
          plan,
          subscriptionId: providerSubscriptionId,
          providerPlanId: subscriptionEntity?.plan_id,
          paymentId: String(paymentEntity.id),
          amountPaise: Number(paymentEntity.amount) || 0,
          periodStart,
          periodEnd,
        });
      } else {
        // Everything else only keeps the status in step. The user's plan is never changed here: a cancelled
        // or failed subscription simply stops renewing, and the plan ends when the paid period does.
        const statusMap: Record<string, "active" | "past_due" | "cancelled" | "expired"> = {
          "subscription.activated": "active",
          "subscription.cancelled": "cancelled",
          "subscription.halted": "past_due",
          "subscription.completed": "expired",
        };
        const mappedStatus = statusMap[eventType];
        const existingSub = await prisma.subscription.findUnique({ where: { userId } });
        if (mappedStatus && existingSub?.providerSubscriptionId === providerSubscriptionId) {
          await prisma.subscription.update({
            where: { userId },
            data: { status: mappedStatus, cancelAtPeriodEnd: mappedStatus === "cancelled" ? true : existingSub.cancelAtPeriodEnd },
          });
        }
      }
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
