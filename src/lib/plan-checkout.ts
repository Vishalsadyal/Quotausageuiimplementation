// Browser-only: starts the monthly Razorpay subscription for a paid plan right where the user is
// (used by the end of onboarding). Same server calls as the Billing page: /api/billing/checkout
// creates the subscription, /api/billing/verify activates the plan after payment.
import { trackActionFailed, trackCheckoutAbandoned } from "./posthog-client";

export type PaidPlanId = "pro" | "connect" | "coach";
export type CheckoutResult = { status: "paid" } | { status: "dismissed" } | { status: "failed"; message: string };

const PLAN_TITLE: Record<PaidPlanId, string> = { pro: "Pro Plan", connect: "Pro Connect", coach: "Coach Plan" };

type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void };

async function loadRazorpay(): Promise<RazorpayCtor | null> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return w.Razorpay;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-rzp="1"]');
    const script = existing || document.createElement("script");
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load Razorpay checkout")), { once: true });
    if (!existing) {
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.dataset.rzp = "1";
      document.body.appendChild(script);
    }
    // An already-loaded tag fires no event; Razorpay is then defined.
    if (existing && w.Razorpay) resolve();
  });
  return w.Razorpay || null;
}

export async function startPlanSubscription(
  plan: PaidPlanId,
  prefill: { name?: string; email?: string; phone?: string },
): Promise<CheckoutResult> {
  let stage = "script_load";
  try {
    const Razorpay = await loadRazorpay();
    if (!Razorpay) throw new Error("Unable to load Razorpay payment gateway");

    stage = "subscription_create";
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to start subscription");
    const checkout = data.data;
    if (checkout?.mock) throw new Error("Subscriptions are not configured on this server");

    stage = "checkout_open";
    return await new Promise<CheckoutResult>((resolve) => {
      let paymentSubmitted = false;
      const rzp = new Razorpay({
        key: checkout.keyId,
        subscription_id: checkout.subscriptionId,
        name: "AutoApply CV",
        description: `${PLAN_TITLE[plan]} - monthly, cancel anytime`,
        prefill: { name: prefill.name || "", email: prefill.email || "", contact: prefill.phone || "" },
        theme: { color: "#7C3AED" },
        handler: async (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
          paymentSubmitted = true;
          try {
            const verifyRes = await fetch("/api/billing/verify", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                plan,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json().catch(() => null);
            if (!verifyRes.ok || !verifyData?.success) throw new Error(verifyData?.message || "Payment verification failed");
            resolve({ status: "paid" });
          } catch (err) {
            trackActionFailed("plan_subscription", "payment_verification", err, { plan, source: "onboarding" });
            resolve({ status: "failed", message: err instanceof Error ? err.message : "Payment verification failed" });
          }
        },
        modal: {
          ondismiss: () => {
            if (paymentSubmitted) return;
            trackCheckoutAbandoned("plan_subscription", { plan, source: "onboarding" });
            resolve({ status: "dismissed" });
          },
        },
      });
      rzp.open();
    });
  } catch (err) {
    trackActionFailed("plan_subscription", stage, err, { plan, source: "onboarding" });
    return { status: "failed", message: err instanceof Error ? err.message : "Failed to start subscription" };
  }
}

/**
 * One-time payment for 30 days of a plan (no auto-renewal), so Razorpay shows a plain "Pay ₹99"
 * screen with no autopay mandate terms. Same server calls as the Billing page's one-time purchase:
 * /api/billing/order creates the order, /api/billing/order/verify activates the plan for 30 days.
 */
export async function startPlanPurchase(
  plan: PaidPlanId,
  prefill: { name?: string; email?: string; phone?: string; userId?: string },
): Promise<CheckoutResult> {
  let stage = "script_load";
  try {
    const Razorpay = await loadRazorpay();
    if (!Razorpay) throw new Error("Unable to load Razorpay payment gateway");

    stage = "order_create";
    const res = await fetch("/api/billing/order", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "x-idempotency-key": `onboarding_plan_${plan}_${prefill.userId || "u"}_${Date.now()}` },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to start checkout");
    const order = data.data;

    stage = "checkout_open";
    return await new Promise<CheckoutResult>((resolve) => {
      let paymentSubmitted = false;
      const rzp = new Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "AutoApply CV",
        description: `${PLAN_TITLE[plan]} - 30 days`,
        prefill: { name: prefill.name || "", email: prefill.email || "", contact: prefill.phone || "" },
        theme: { color: "#7C3AED" },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          paymentSubmitted = true;
          try {
            const verifyRes = await fetch("/api/billing/order/verify", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                plan,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json().catch(() => null);
            if (!verifyRes.ok || !verifyData?.success) throw new Error(verifyData?.message || "Payment verification failed");
            resolve({ status: "paid" });
          } catch (err) {
            trackActionFailed("plan_purchase", "payment_verification", err, { plan, source: "onboarding" });
            resolve({ status: "failed", message: err instanceof Error ? err.message : "Payment verification failed" });
          }
        },
        modal: {
          ondismiss: () => {
            if (paymentSubmitted) return;
            trackCheckoutAbandoned("plan_purchase", { plan, source: "onboarding" });
            resolve({ status: "dismissed" });
          },
        },
      });
      rzp.open();
    });
  } catch (err) {
    trackActionFailed("plan_purchase", stage, err, { plan, source: "onboarding" });
    return { status: "failed", message: err instanceof Error ? err.message : "Failed to start checkout" };
  }
}
