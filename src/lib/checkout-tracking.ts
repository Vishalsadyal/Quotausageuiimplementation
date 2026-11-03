// Records every Pay click and how it ended, for Admin > Checkouts:
// started (clicked Pay) -> opened (Razorpay shown) -> paid | dismissed (closed it) | failed.
// Browser calls never throw and never hold up the payment.

export const CHECKOUT_SOURCES = ["onboarding", "billing", "promo_banner"] as const;
export const CHECKOUT_PRODUCTS = ["pro", "connect", "coach", "hires"] as const;
export const CHECKOUT_MODES = ["one_time", "subscription", "topup"] as const;

export type CheckoutSource = (typeof CHECKOUT_SOURCES)[number];
export type CheckoutProduct = (typeof CHECKOUT_PRODUCTS)[number];
export type CheckoutMode = (typeof CHECKOUT_MODES)[number];

export const CHECKOUT_SOURCE_LABELS: Record<CheckoutSource, string> = {
  onboarding: "Onboarding (last step)",
  billing: "Billing page",
  promo_banner: "Dashboard ₹99 banner",
};

export type CheckoutTracker = {
  opened: (amountPaise?: number) => void;
  paid: () => void;
  dismissed: () => void;
  failed: (stage: string, err: unknown) => void;
};

async function send(url: string, method: "POST" | "PATCH", body: unknown) {
  try {
    const res = await fetch(url, {
      method,
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return data?.data ?? null;
  } catch {
    return null;
  }
}

export function trackCheckout(source: CheckoutSource, product: CheckoutProduct, mode: CheckoutMode): CheckoutTracker {
  const idPromise: Promise<string | null> = send("/api/user/checkout-attempts", "POST", { source, product, mode }).then(
    (data) => (data && typeof data.id === "string" ? data.id : null),
  );
  const update = (body: Record<string, unknown>) => {
    void idPromise.then((id) => (id ? send(`/api/user/checkout-attempts/${id}`, "PATCH", body) : null));
  };
  return {
    opened: (amountPaise) => update({ status: "opened", ...(Number.isFinite(amountPaise) ? { amountPaise: Math.round(Number(amountPaise)) } : {}) }),
    paid: () => update({ status: "paid" }),
    dismissed: () => update({ status: "dismissed" }),
    failed: (stage, err) =>
      update({ status: "failed", stage: stage.slice(0, 60), error: (err instanceof Error ? err.message : String(err || "")).slice(0, 500) }),
  };
}
