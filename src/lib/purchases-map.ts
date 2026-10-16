// Plan purchases for the Billing > Transaction History list. Each purchase leaves a "billing.plan_purchased"
// audit record (one-time checkout, subscription verify, subscription renewal webhook); this turns those records
// into one clean entry per payment. Kept free of database imports so it can be tested on its own.

export type PlanPurchase = {
  id: string;
  paymentId: string;
  createdAt: string;
  plan: string;
  amountRupees: number | null; // null when the payment amount was not known when the record was written
  discountCode: string | null;
  expiresAt: string | null;
  source: "one_time" | "subscription";
};

export type PurchaseAuditRow = {
  id: string;
  targetId: string | null;
  createdAt: Date;
  metadataJson: unknown;
};

export function toPlanPurchases(rows: PurchaseAuditRow[], limit = 50): PlanPurchase[] {
  const byPayment = new Map<string, PlanPurchase>();
  for (const row of rows) {
    const meta = (row.metadataJson && typeof row.metadataJson === "object" ? row.metadataJson : {}) as Record<string, unknown>;
    const plan = typeof meta.plan === "string" ? meta.plan : "";
    if (!plan) continue;
    const purchase: PlanPurchase = {
      id: row.id,
      paymentId: row.targetId || row.id,
      createdAt: row.createdAt.toISOString(),
      plan,
      amountRupees: typeof meta.finalRupees === "number" && Number.isFinite(meta.finalRupees) ? meta.finalRupees : null,
      discountCode: typeof meta.discountCode === "string" && meta.discountCode ? meta.discountCode : null,
      expiresAt: typeof meta.expiresAt === "string" && meta.expiresAt ? meta.expiresAt : null,
      source: meta.source === "subscription" ? "subscription" : "one_time",
    };
    // The same payment can be recorded twice (checkout verify and the webhook): keep the entry that knows the amount.
    const previous = byPayment.get(purchase.paymentId);
    if (!previous || (previous.amountRupees === null && purchase.amountRupees !== null)) byPayment.set(purchase.paymentId, purchase);
  }
  return [...byPayment.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
