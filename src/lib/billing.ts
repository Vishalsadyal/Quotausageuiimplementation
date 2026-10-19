import crypto from "crypto";
import Razorpay from "razorpay";
import { getPaymentMode, getRazorpayCredentials, rzpEnv } from "./payment-mode";
import { PLAN_RAZORPAY_ENV, PLAN_RAZORPAY_NAME, planAmountPaise, type PaidPlan } from "./plans";

export async function getRazorpayClient() {
  const { keyId, keySecret } = await getRazorpayCredentials();
  if (!keyId || !keySecret) {
    throw new Error("Razorpay is not configured");
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

export async function getPlanRazorpayId(plan: PaidPlan) {
  const planId = rzpEnv(PLAN_RAZORPAY_ENV[plan], await getPaymentMode());
  if (!planId) throw new Error(`Razorpay plan id missing for ${plan}`);
  return planId;
}

// Uses the configured plan id, else finds (or creates) the Razorpay plan by name.
export async function getOrCreatePlanRazorpayId(plan: PaidPlan) {
  const configured = rzpEnv(PLAN_RAZORPAY_ENV[plan], await getPaymentMode());
  if (configured) return configured;

  const razorpay = await getRazorpayClient();
  const desired = { amountPaise: planAmountPaise(plan), name: PLAN_RAZORPAY_NAME[plan] };

  const existing = await razorpay.plans.all({ count: 100 });
  const found = (existing.items || []).find((p: any) => p?.item?.name === desired.name);
  if (found?.id) return found.id as string;

  const created = await razorpay.plans.create({
    period: "monthly",
    interval: 1,
    item: {
      name: desired.name,
      amount: desired.amountPaise,
      currency: "INR",
      description: `${plan.toUpperCase()} monthly subscription`,
    },
    notes: {
      source: "careerpilot_auto_plan",
      plan,
    },
  });

  return created.id;
}

export function verifyRazorpayWebhook(bodyRaw: string, signature: string) {
  // Razorpay signs with the webhook secret of the dashboard (test or live) that sent the event, so both are accepted.
  const secrets = (["live", "test"] as const).map((m) => rzpEnv("RZP_WEBHOOK_SECRET", m)).filter(Boolean);
  if (secrets.length === 0) throw new Error("Razorpay webhook secret is not configured");
  return secrets.some((secret) => {
    const expected = crypto.createHmac("sha256", secret).update(bodyRaw).digest("hex");
    return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  });
}

export async function verifyRazorpaySubscriptionPaymentSignature(input: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
}) {
  const { keySecret: secret } = await getRazorpayCredentials();
  if (!secret) throw new Error("Razorpay key secret is not configured");
  const payload = `${input.paymentId}|${input.subscriptionId}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return expected === input.signature;
}

export async function verifyRazorpayOrderPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const { keySecret: secret } = await getRazorpayCredentials();
  if (!secret) throw new Error("Razorpay key secret is not configured");
  const payload = `${input.orderId}|${input.paymentId}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return expected === input.signature;
}
