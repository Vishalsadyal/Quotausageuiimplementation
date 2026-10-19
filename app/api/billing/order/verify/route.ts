import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { isPaidPlan } from "src/lib/plans";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { verifyRazorpayOrderPaymentSignature, getRazorpayClient } from "src/lib/billing";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";
import { planDiscountContext, registerDiscountRedemption } from "src/lib/discounts";
import { activatePurchasedPlan } from "src/lib/plan-access";
import { writeAuditLog } from "src/lib/audit";

/**
 * POST /api/billing/order/verify
 * Activates a plan after a one-time Razorpay payment. Everything that matters (which plan, whose
 * order, how much, which coupon) is read from the Razorpay order, never from the request body,
 * and the payment must have succeeded. Each payment activates once (PaymentEvent.eventId).
 */
const verifyOrderSchema = z.object({
  plan: z.string().optional(), // ignored: the plan comes from the order
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

const PAID_STATUSES = new Set(["captured", "authorized"]);

export async function POST(req: NextRequest) {
  try {
    const rl = await enforceRateLimit({
      key: rateLimitKey(req, "billing.order_verify"),
      limit: 15,
      windowMs: 60_000,
    });
    if (rl) return rl;

    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    if (authResult.auth.user.role === "admin") {
      return fail("Admins cannot purchase plans", 400, "INVALID_ACTOR");
    }
    const userId = authResult.auth.user.id;

    const body = verifyOrderSchema.parse(await req.json());
    const valid = await verifyRazorpayOrderPaymentSignature({
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    });
    if (!valid) return fail("Invalid Razorpay signature", 401, "INVALID_SIGNATURE");

    const existing = await prisma.paymentEvent.findUnique({ where: { eventId: body.razorpay_payment_id } });
    if (existing) {
      return ok("Payment already processed", { paymentId: body.razorpay_payment_id });
    }

    const razorpay = await getRazorpayClient();
    const [order, payment] = await Promise.all([
      razorpay.orders.fetch(body.razorpay_order_id),
      razorpay.payments.fetch(body.razorpay_payment_id),
    ]);
    const notes = (order.notes || {}) as Record<string, string>;
    const plan = notes.plan;

    if (notes.userId !== userId) return fail("This order belongs to another account", 403, "ORDER_USER_MISMATCH");
    if (notes.mode !== "one_time" || !isPaidPlan(plan)) return fail("This order is not a plan purchase", 400, "INVALID_ORDER");
    if (payment.order_id !== order.id) return fail("Payment does not match the order", 400, "PAYMENT_ORDER_MISMATCH");
    if (!PAID_STATUSES.has(String(payment.status))) {
      return fail("Payment was not completed. Your plan was not changed.", 402, "PAYMENT_NOT_CAPTURED");
    }
    if (Number(payment.amount) !== Number(order.amount)) return fail("Payment amount does not match the order", 400, "AMOUNT_MISMATCH");

    const finalRupees = Math.round(Number(order.amount) / 100);
    const discountRupees = Math.max(0, Math.floor(Number(notes.discountRupees || 0)));
    const baseRupees = Math.max(finalRupees, Math.floor(Number(notes.baseRupees || 0)) || finalRupees + discountRupees);
    const serializablePayment = JSON.parse(JSON.stringify(payment)) as Prisma.InputJsonValue;
    const now = new Date();

    const activation = await prisma.$transaction(async (tx) => {
      // Unique eventId: a duplicate verify call fails here instead of activating twice.
      await tx.paymentEvent.create({
        data: {
          provider: "razorpay",
          eventId: body.razorpay_payment_id,
          eventType: "order.paid",
          payload: {
            orderId: body.razorpay_order_id,
            paymentId: body.razorpay_payment_id,
            plan,
            baseRupees,
            discountRupees,
            finalRupees,
            discountCode: notes.discountCode || null,
            payment: serializablePayment,
          } as Prisma.InputJsonValue,
          processedAt: now,
        },
      });
      const activated = await activatePurchasedPlan(tx, userId, plan, now);
      const periodEnd = activated.planExpiresAt || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await tx.subscription.upsert({
        where: { userId },
        create: {
          userId,
          provider: "razorpay",
          providerPlanId: `one_time_${plan}`,
          status: "active",
          plan,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: true,
        },
        update: {
          providerPlanId: `one_time_${plan}`,
          status: "active",
          plan,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: true,
        },
      });
      return activated;
    });

    if (notes.discountCodeId && discountRupees > 0) {
      try {
        await registerDiscountRedemption({
          discountCodeId: notes.discountCodeId,
          userId,
          context: planDiscountContext(plan),
          orderId: body.razorpay_order_id,
          paymentId: body.razorpay_payment_id,
          baseRupees,
          discountRupees,
          finalRupees,
        });
      } catch (redemptionError) {
        console.error("[billing.order.verify] failed to register discount redemption", redemptionError);
      }
    }

    await writeAuditLog({
      actorUserId: userId,
      action: "billing.plan_purchased",
      targetType: "payment",
      targetId: body.razorpay_payment_id,
      metadataJson: { plan, finalRupees, discountCode: notes.discountCode || null, expiresAt: activation.planExpiresAt?.toISOString() || null },
    }).catch(() => null);

    return ok("Payment verified and plan activated", {
      paymentId: body.razorpay_payment_id,
      orderId: body.razorpay_order_id,
      plan,
      planExpiresAt: activation.planExpiresAt?.toISOString() || null,
      currentPeriodEnd: activation.planExpiresAt?.toISOString() || null,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return ok("Payment already processed", {});
    }
    return handleApiError(error, "Failed to verify order payment");
  }
}
