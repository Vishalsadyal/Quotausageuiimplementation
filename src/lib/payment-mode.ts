import { prisma } from "./prisma";

// Live/Test Razorpay mode. The admin picks the mode on /admin/payments; it is stored as an audit-log
// config entry (like the referral rules). The keys themselves only ever live in environment variables.
export type PaymentMode = "live" | "test";
export const PAYMENT_MODE_ACTION = "config.payment_mode";

const CACHE_MS = 5000;
let cached: { mode: PaymentMode; at: number } | null = null;

/** Mode used when the admin has never chosen one: real money in production, test everywhere else. */
export function defaultPaymentMode(): PaymentMode {
  return process.env.NODE_ENV === "production" ? "live" : "test";
}

export async function getPaymentMode(): Promise<PaymentMode> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.mode;
  let mode = defaultPaymentMode();
  try {
    const latest = await prisma.auditLog.findFirst({
      where: { action: PAYMENT_MODE_ACTION },
      orderBy: { createdAt: "desc" },
      select: { metadataJson: true },
    });
    const value = (latest?.metadataJson as { mode?: unknown } | null)?.mode;
    if (value === "live" || value === "test") mode = value;
  } catch {
    // database hiccup: keep the default rather than failing the payment
  }
  cached = { mode, at: Date.now() };
  return mode;
}

export function clearPaymentModeCache() {
  cached = null;
}

/** RZP_KEY_ID_LIVE / RZP_KEY_ID_TEST, falling back to the old un-suffixed name. */
export function rzpEnv(name: string, mode: PaymentMode) {
  return process.env[`${name}_${mode.toUpperCase()}`] || process.env[name] || "";
}

export async function getRazorpayCredentials() {
  const mode = await getPaymentMode();
  return { mode, keyId: rzpEnv("RZP_KEY_ID", mode), keySecret: rzpEnv("RZP_KEY_SECRET", mode) };
}

export async function getRazorpayKeyId() {
  return (await getRazorpayCredentials()).keyId;
}

/** Razorpay plan id for the current mode (test and live plans are different objects). */
export async function getConfiguredPlanId(envBase: string) {
  return rzpEnv(envBase, await getPaymentMode());
}

/** Which keys are filled in, for the admin page. Never returns the values. */
export function paymentModeStatus(mode: PaymentMode) {
  const has = (name: string) => Boolean(rzpEnv(name, mode));
  return {
    keyId: has("RZP_KEY_ID"),
    keySecret: has("RZP_KEY_SECRET"),
    webhookSecret: has("RZP_WEBHOOK_SECRET"),
    planPro: has("RZP_PLAN_PRO"),
    planConnect: has("RZP_PLAN_CONNECT"),
    planCoach: has("RZP_PLAN_COACH"),
    keyPrefixOk: rzpEnv("RZP_KEY_ID", mode).startsWith(mode === "live" ? "rzp_live_" : "rzp_test_"),
  };
}
