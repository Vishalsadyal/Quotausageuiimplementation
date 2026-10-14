// Plans in one place. "connect" (Pro Connect, ₹500/month) is Pro plus HR Contacts: 20 matched
// recruiter contacts a day, emailed daily, with free outreach to them.
export type UserPlanName = "free" | "pro" | "coach" | "connect";
export type PaidPlan = Exclude<UserPlanName, "free">;

export const PAID_PLANS = ["pro", "coach", "connect"] as const;

export const PLAN_LABEL: Record<UserPlanName, string> = {
  free: "Free",
  pro: "Pro",
  coach: "Coach",
  connect: "Pro Connect",
};

/** Monthly price in paise. Overridable per env so prices can change without a deploy. */
export function planAmountPaise(plan: PaidPlan) {
  if (plan === "pro") return Number(process.env.PLAN_PRO_PAISE || 9900);
  if (plan === "coach") return Number(process.env.PLAN_COACH_PAISE || 184900);
  return Number(process.env.PLAN_CONNECT_PAISE || 50000);
}

/** Env var holding the Razorpay subscription plan id. */
export const PLAN_RAZORPAY_ENV: Record<PaidPlan, string> = {
  pro: "RZP_PLAN_PRO",
  coach: "RZP_PLAN_COACH",
  connect: "RZP_PLAN_CONNECT",
};

export const PLAN_RAZORPAY_NAME: Record<PaidPlan, string> = {
  pro: "AutoApply CV Pro Monthly",
  coach: "AutoApply CV Coach Monthly",
  connect: "AutoApply CV Pro Connect Monthly",
};

/** Unlimited applies and outreach (no Hires spent). */
export function isUnlimitedPlan(plan: string | null | undefined) {
  return plan === "pro" || plan === "connect";
}

/** Access to HR Contacts. */
export function hasHrContacts(plan: string | null | undefined) {
  return plan === "connect";
}

export function isPaidPlan(plan: string | null | undefined): plan is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(String(plan));
}
