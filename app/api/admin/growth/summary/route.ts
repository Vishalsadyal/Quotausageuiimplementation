import { NextRequest } from "next/server";
import { requireAdmin } from "src/lib/guards";
import { handleApiError, ok } from "src/lib/api";
import { prisma } from "src/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/growth/summary?days=30
 * Coupon redemptions and revenue per code, plan purchases, referral funnel and rewards, for the
 * last `days` days (all-time totals for coupons too). Aggregates only, no personal data.
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [codes, redemptionsAll, redemptionsRecent, purchases, referred, qualified, rewards, codeLookups] = await Promise.all([
      prisma.discountCode.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, code: true, target: true, type: true, active: true, usedCount: true, usageLimitTotal: true, endsAt: true },
      }),
      prisma.discountRedemption.groupBy({ by: ["discountCodeId"], _count: { _all: true }, _sum: { finalRupees: true, discountRupees: true } }),
      prisma.discountRedemption.groupBy({
        by: ["discountCodeId"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { finalRupees: true },
      }),
      prisma.auditLog.findMany({
        where: { action: "billing.plan_purchased", createdAt: { gte: since } },
        select: { metadataJson: true },
        take: 5000,
      }),
      prisma.user.count({ where: { referredAt: { gte: since } } }),
      prisma.user.count({ where: { referralQualifiedAt: { gte: since } } }),
      prisma.referralReward.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      prisma.auditLog.count({ where: { action: "billing.coupon_checked", createdAt: { gte: since } } }),
    ]);

    const all = new Map(redemptionsAll.map((r) => [r.discountCodeId, r]));
    const recent = new Map(redemptionsRecent.map((r) => [r.discountCodeId, r]));
    const purchaseRows = purchases.map((p) => (p.metadataJson || {}) as { plan?: string; finalRupees?: number; discountCode?: string | null });
    const byPlan: Record<string, { count: number; revenue: number; withCoupon: number }> = {};
    for (const p of purchaseRows) {
      const key = p.plan || "unknown";
      byPlan[key] ||= { count: 0, revenue: 0, withCoupon: 0 };
      byPlan[key].count++;
      byPlan[key].revenue += Number(p.finalRupees || 0);
      if (p.discountCode) byPlan[key].withCoupon++;
    }

    return ok("Growth summary", {
      days,
      coupons: codes.map((c) => ({
        ...c,
        redemptions: all.get(c.id)?._count._all || 0,
        revenueRupees: all.get(c.id)?._sum.finalRupees || 0,
        discountGivenRupees: all.get(c.id)?._sum.discountRupees || 0,
        redemptionsInPeriod: recent.get(c.id)?._count._all || 0,
        revenueInPeriodRupees: recent.get(c.id)?._sum.finalRupees || 0,
      })),
      couponChecks: codeLookups,
      purchases: { total: purchaseRows.length, byPlan },
      referrals: {
        signups: referred,
        qualified,
        rewards: Object.fromEntries(rewards.map((r) => [r.status, r._count._all])),
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to load growth summary");
  }
}
