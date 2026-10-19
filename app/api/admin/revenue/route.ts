import type { Prisma } from "@prisma/client";
import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { getPaymentMode } from "src/lib/payment-mode";
import { ok, handleApiError, parsePagination } from "src/lib/api";

/**
 * GET /api/admin/revenue
 * Real money collected, read from verified Razorpay payments (PaymentEvent rows written by the verify
 * routes). One row per payment id, so a payment is never counted twice.
 */
type Payload = {
  plan?: string;
  finalRupees?: number;
  baseRupees?: number;
  discountRupees?: number;
  discountCode?: string | null;
  hires?: number;
};

const PAID_PLANS = ["pro", "connect", "coach"] as const;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);

export async function GET(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const activeWhere: Prisma.UserWhereInput = { plan: { in: [...PAID_PLANS] }, planExpiresAt: { gt: now } };

    const [events, totalUsers, activeTotal, activeUsers] = await Promise.all([
      prisma.paymentEvent.findMany({
        where: { eventType: { in: ["order.paid", "subscription.paid", "wallet.topup.paid"] } },
        select: { eventId: true, eventType: true, payload: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10000,
      }),
      prisma.user.count(),
      prisma.user.count({ where: activeWhere }),
      prisma.user.findMany({
        where: activeWhere,
        select: { id: true, name: true, email: true, plan: true, planExpiresAt: true },
        orderBy: { planExpiresAt: "asc" },
        take: 10,
      }),
    ]);

    const empty = () => ({ count: 0, rupees: 0 });
    const totals = { all: empty(), month: empty(), prevMonth: empty(), today: empty() };
    const bySource = { plans: empty(), hires: empty() };
    const byPlan: Record<string, { count: number; rupees: number }> = {};
    let discountRupees = 0;
    let paidUsersEver = 0;

    const rows = events.map((e) => {
      const p = (e.payload || {}) as Payload;
      const isPlan = e.eventType !== "wallet.topup.paid";
      const rupees = num(p.finalRupees);
      const t = e.createdAt.getTime();
      const add = (b: { count: number; rupees: number }) => {
        b.count += 1;
        b.rupees += rupees;
      };
      add(totals.all);
      if (t >= monthStart.getTime()) add(totals.month);
      else if (t >= prevMonthStart.getTime()) add(totals.prevMonth);
      if (t >= dayStart.getTime()) add(totals.today);
      add(isPlan ? bySource.plans : bySource.hires);
      if (isPlan) {
        const key = String(p.plan || "unknown");
        byPlan[key] = byPlan[key] || empty();
        add(byPlan[key]);
      }
      discountRupees += num(p.discountRupees);
      return { paymentId: e.eventId, kind: isPlan ? "plan" : "hires", plan: isPlan ? String(p.plan || "") : null, hires: isPlan ? null : num(p.hires), rupees, baseRupees: num(p.baseRupees), discountRupees: num(p.discountRupees), discountCode: p.discountCode || null, createdAt: e.createdAt.toISOString() };
    });

    // who paid: plan purchases are in the audit log, wallet top-ups in the hires ledger
    const pageRows = rows.slice(skip, skip + limit);
    const ids = pageRows.map((r) => r.paymentId);
    const [audits, txns] = ids.length
      ? await Promise.all([
          prisma.auditLog.findMany({ where: { action: "billing.plan_purchased", targetId: { in: ids } }, select: { targetId: true, actorUserId: true } }),
          prisma.hireTransaction.findMany({ where: { referenceId: { in: ids } }, select: { referenceId: true, userId: true } }),
        ])
      : [[], []];
    const payerOf = new Map<string, string>();
    for (const a of audits) if (a.targetId && a.actorUserId) payerOf.set(a.targetId, a.actorUserId);
    for (const t of txns) if (t.referenceId) payerOf.set(t.referenceId, t.userId);
    const payerIds = Array.from(new Set(payerOf.values()));
    const payers = payerIds.length ? await prisma.user.findMany({ where: { id: { in: payerIds } }, select: { id: true, name: true, email: true } }) : [];
    const payerById = new Map(payers.map((u) => [u.id, u]));

    const payerSet = new Set<string>();
    for (const a of await prisma.auditLog.findMany({ where: { action: "billing.plan_purchased" }, select: { actorUserId: true } })) if (a.actorUserId) payerSet.add(a.actorUserId);
    paidUsersEver = payerSet.size;


    return ok("Revenue fetched", {
      currency: "INR",
      testMode: (await getPaymentMode()) === "test",
      totals,
      bySource,
      byPlan,
      discountRupees,
      totalUsers,
      paidUsersEver,
      activePaidUsers: activeTotal,
      payments: pageRows.map((r) => ({ ...r, user: payerById.get(payerOf.get(r.paymentId) || "") || null })),
      activeUsers: activeUsers.map((u) => ({ ...u, planExpiresAt: u.planExpiresAt?.toISOString() || null })),
      pagination: { page, limit, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / limit)), activeTotal },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch revenue");
  }
}
