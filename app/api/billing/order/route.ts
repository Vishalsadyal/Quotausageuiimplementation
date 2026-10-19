import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { checkoutSchema } from "src/lib/schemas";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { getRazorpayClient } from "src/lib/billing";
import { prisma } from "src/lib/prisma";
import { getRazorpayKeyId } from "src/lib/payment-mode";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";
import { planAmountPaise } from "src/lib/plans";
import { DiscountValidationError, evaluateDiscountForOrder, planDiscountContext } from "src/lib/discounts";

/**
 * POST /api/billing/order  { plan, discountCode? }  (header x-idempotency-key)
 * Creates a one-time Razorpay order for a plan. A coupon is validated here, on the server, and the
 * plan, buyer and discount are written into the order's notes: /verify trusts only those.
 */
export async function POST(req: NextRequest) {
  try {
    const rl = await enforceRateLimit({
      key: rateLimitKey(req, "billing.order"),
      limit: 8,
      windowMs: 60_000,
    });
    if (rl) return rl;

    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    if (authResult.auth.user.role === "admin") {
      return fail("Admins cannot purchase plans", 400, "INVALID_ACTOR");
    }

    const body = checkoutSchema.parse(await req.json());
    const idempotencyKey = (req.headers.get("x-idempotency-key") || "").trim();
    if (idempotencyKey) {
      const eventId = `order_intent:${authResult.auth.user.id}:${idempotencyKey}`;
      const existing = await prisma.paymentEvent.findUnique({ where: { eventId } });
      if (existing) {
        const payload = existing.payload as Prisma.JsonObject | null;
        const data = payload?.orderData as Prisma.JsonObject | undefined;
        if (data) {
          return ok("Order already created", data as unknown as Record<string, unknown>);
        }
      }
    }

    const baseRupees = Math.round(planAmountPaise(body.plan) / 100);
    const applied = body.discountCode
      ? await evaluateDiscountForOrder({
          codeInput: body.discountCode,
          userId: authResult.auth.user.id,
          context: planDiscountContext(body.plan),
          baseRupees,
        })
      : null;
    const amount = applied ? applied.finalRupees * 100 : planAmountPaise(body.plan);
    const razorpay = await getRazorpayClient();

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `cp_${body.plan}_${Date.now()}`,
      notes: {
        userId: authResult.auth.user.id,
        userEmail: authResult.auth.user.email,
        plan: body.plan,
        mode: "one_time",
        baseRupees: String(baseRupees),
        ...(applied
          ? {
              discountCode: applied.code,
              discountCodeId: applied.discountCodeId,
              discountRupees: String(applied.discountRupees),
            }
          : {}),
      },
    });

    const orderData = {
      provider: "razorpay",
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      plan: body.plan,
      baseRupees,
      finalRupees: Math.round(Number(order.amount) / 100),
      discountCode: applied?.code || null,
      keyId: await getRazorpayKeyId(),
    };

    if (idempotencyKey) {
      const eventId = `order_intent:${authResult.auth.user.id}:${idempotencyKey}`;
      await prisma.paymentEvent.upsert({
        where: { eventId },
        create: {
          provider: "razorpay",
          eventId,
          eventType: "order.created",
          payload: { orderData } as Prisma.InputJsonValue,
          processedAt: new Date(),
        },
        update: {
          payload: { orderData } as Prisma.InputJsonValue,
          processedAt: new Date(),
        },
      });
    }

    return ok("Order created", orderData);
  } catch (error) {
    if (error instanceof DiscountValidationError) return fail(error.message, error.status, error.errorCode);
    return handleApiError(error, "Failed to create order");
  }
}
