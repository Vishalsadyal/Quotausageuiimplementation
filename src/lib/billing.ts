import crypto from "crypto";
import Razorpay from "razorpay";
import { PLAN_RAZORPAY_ENV, PLAN_RAZORPAY_NAME, planAmountPaise, type PaidPlan } from "./plans";

export function getRazorpayClient() {
  const keyId = process.env.RZP_KEY_ID;
  const keySecret = process.env.RZP_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay is not configured");
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

export function getPlanRazorpayId(plan: PaidPlan) {
  const planId = process.env[PLAN_RAZORPAY_ENV[plan]];
  if (!planId) throw new Error(`Razorpay plan id missing for ${plan}`);
  return planId;
}

// Uses the configured plan id, else finds (or creates) the Razorpay plan by name.
export async function getOrCreatePlanRazorpayId(plan: PaidPlan) {
  const configured = process.env[PLAN_RAZORPAY_ENV[plan]];
  if (configured) return configured;

  const razorpay = getRazorpayClient();
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
  const secret = process.env.RZP_WEBHOOK_SECRET || process.env.RZP_KEY_SECRET;
  if (!secret) throw new Error("Razorpay webhook secret is not configured");
  const expected = crypto.createHmac("sha256", secret).update(bodyRaw).digest("hex");
  return expected === signature;
}

export function verifyRazorpaySubscriptionPaymentSignature(input: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
}) {
  const secret = process.env.RZP_KEY_SECRET;
  if (!secret) throw new Error("Razorpay key secret is not configured");
  const payload = `${input.paymentId}|${input.subscriptionId}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return expected === input.signature;
}

export function verifyRazorpayOrderPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const secret = process.env.RZP_KEY_SECRET;
  if (!secret) throw new Error("Razorpay key secret is not configured");
  const payload = `${input.orderId}|${input.paymentId}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return expected === input.signature;
}
