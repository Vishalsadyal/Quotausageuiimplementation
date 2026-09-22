import crypto from "crypto";
import Razorpay from "razorpay";

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

export function getPlanRazorpayId(plan: "pro" | "coach") {
  const map: Record<"pro" | "coach", string | undefined> = {
    pro: process.env.RZP_PLAN_PRO,
    coach: process.env.RZP_PLAN_COACH,
  };
  const planId = map[plan];
  if (!planId) throw new Error(`Razorpay plan id missing for ${plan}`);
  return planId;
}

const PLAN_CONFIG: Record<"pro" | "coach", { amountPaise: number; name: string }> = {
  pro: { amountPaise: Number(process.env.PLAN_PRO_PAISE || 4900), name: "AutoApply CV Pro Monthly" },
  coach: { amountPaise: Number(process.env.PLAN_COACH_PAISE || 184900), name: "AutoApply CV Coach Monthly" },
};

export async function getOrCreatePlanRazorpayId(plan: "pro" | "coach") {
  const configured = process.env[plan === "pro" ? "RZP_PLAN_PRO" : "RZP_PLAN_COACH"];
  if (configured) return configured;

  const razorpay = getRazorpayClient();
  const desired = PLAN_CONFIG[plan];

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
