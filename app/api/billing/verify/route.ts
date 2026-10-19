import { NextRequest } from "next/server";
import { z } from "zod";
import { isPaidPlan } from "src/lib/plans";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { getRazorpayClient, verifyRazorpaySubscriptionPaymentSignature } from "src/lib/billing";
import { recordSubscriptionCharge } from "src/lib/subscriptions";

/**
 * POST /api/billing/verify
 * Confirms the first payment of a monthly subscription. Which plan, whose subscription and how much were
 * paid are read from Razorpay, never from the request body (the plan sent by the browser is ignored).
 */
const verifySchema = z.object({
  plan: z.string().optional(), // ignored: the plan comes from the subscription
  razorpay_payment_id: z.string().min(1),
  razorpay_subscription_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    if (authResult.auth.user.role === "admin") {
      return fail("Admins cannot purchase plans", 400, "INVALID_ACTOR");
    }
    const userId = authResult.auth.user.id;

    const body = verifySchema.parse(await req.json());
    const valid = await verifyRazorpaySubscriptionPaymentSignature({
      paymentId: body.razorpay_payment_id,
      subscriptionId: body.razorpay_subscription_id,
      signature: body.razorpay_signature,
    });
    if (!valid) return fail("Invalid Razorpay signature", 401, "INVALID_SIGNATURE");

    const razorpay = await getRazorpayClient();
    const [subscription, payment] = await Promise.all([
      razorpay.subscriptions.fetch(body.razorpay_subscription_id),
      razorpay.payments.fetch(body.razorpay_payment_id),
    ]);
    const notes = (subscription.notes || {}) as Record<string, string>;
    if (notes.userId !== userId) return fail("Subscription does not belong to current user", 403, "FORBIDDEN");
    const plan = notes.plan;
    if (!isPaidPlan(plan)) return fail("Subscription has no valid plan", 400, "INVALID_PLAN");
    if (!["captured", "authorized"].includes(String(payment.status))) {
      return fail("Payment was not successful", 402, "PAYMENT_NOT_CAPTURED");
    }

    const result = await recordSubscriptionCharge({
      userId,
      plan,
      subscriptionId: body.razorpay_subscription_id,
      providerPlanId: subscription.plan_id,
      paymentId: body.razorpay_payment_id,
      amountPaise: Number(payment.amount) || 0,
      periodStart: subscription.current_start ? new Date(Number(subscription.current_start) * 1000) : null,
      periodEnd: subscription.current_end ? new Date(Number(subscription.current_end) * 1000) : null,
    });

    return ok(result.alreadyDone ? "Payment already processed" : "Payment verified and plan activated", {
      plan,
      subscriptionId: body.razorpay_subscription_id,
      paymentId: body.razorpay_payment_id,
    });
  } catch (error) {
    return handleApiError(error, "Failed to verify payment");
  }
}
