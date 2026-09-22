import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { checkoutSchema } from "src/lib/schemas";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { getRazorpayClient } from "src/lib/billing";
import { prisma } from "src/lib/prisma";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";

const PLAN_AMOUNT_PAISE: Record<"pro" | "coach", number> = {
  pro: Number(process.env.PLAN_PRO_PAISE || 4900),
  coach: Number(process.env.PLAN_COACH_PAISE || 184900),
};

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

    const amount = PLAN_AMOUNT_PAISE[body.plan];
    const razorpay = getRazorpayClient();

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `cp_${body.plan}_${Date.now()}`,
      notes: {
        userId: authResult.auth.user.id,
        userEmail: authResult.auth.user.email,
        plan: body.plan,
        mode: "one_time",
      },
    });

    const orderData = {
      provider: "razorpay",
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      plan: body.plan,
      keyId: process.env.RZP_KEY_ID || "",
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
    return handleApiError(error, "Failed to create order");
  }
}
