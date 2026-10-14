import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { ok, handleApiError, parsePagination } from "src/lib/api";

const PLAN_PRICE_MONTHLY: Record<"free" | "pro" | "coach" | "connect", number> = {
  free: 0,
  connect: 500,
  pro: 999,
  coach: 2999,
};

export async function GET(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });

    const [subsByStatus, usersByPlan, activeSubs, activeSubsTotal, hiresPurchased] = await Promise.all([
      prisma.subscription.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.user.groupBy({
        by: ["plan"],
        _count: { _all: true },
      }),
      prisma.subscription.findMany({
        where: { status: "active" },
        select: {
          id: true,
          plan: true,
          userId: true,
          currentPeriodEnd: true,
          updatedAt: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.subscription.count({ where: { status: "active" } }),
      prisma.hireTransaction.aggregate({
        where: { type: "credit_purchase", status: "posted" },
        _sum: { amount: true },
      }),
    ]);

    const statusCounts = {
      trialing: 0,
      active: 0,
      past_due: 0,
      cancelled: 0,
      expired: 0,
    };
    for (const row of subsByStatus) {
      statusCounts[row.status] = row._count._all;
    }

    const planCounts = {
      free: 0,
      pro: 0,
      coach: 0,
    };
    for (const row of usersByPlan) {
      planCounts[row.plan] = row._count._all;
    }

    const mrr = activeSubs.reduce((sum, sub) => sum + PLAN_PRICE_MONTHLY[sub.plan], 0);
    const arr = mrr * 12;
    const hireRevenue = Math.max(0, hiresPurchased._sum.amount || 0);
    const totalUsers = Object.values(planCounts).reduce((sum, value) => sum + Number(value || 0), 0);
    const paidUsers = Math.max(0, Number(planCounts.pro || 0) + Number(planCounts.coach || 0));
    const paidConversionPct = totalUsers > 0 ? Math.round((paidUsers / totalUsers) * 10000) / 100 : 0;
    const activePlanCounts = {
      free: 0,
      pro: 0,
      coach: 0,
    };
    for (const sub of activeSubs) {
      activePlanCounts[sub.plan] = Number(activePlanCounts[sub.plan] || 0) + 1;
    }
    const planRevenueMonthly = {
      free: activePlanCounts.free * PLAN_PRICE_MONTHLY.free,
      pro: activePlanCounts.pro * PLAN_PRICE_MONTHLY.pro,
      coach: activePlanCounts.coach * PLAN_PRICE_MONTHLY.coach,
    };

    return ok("Revenue data fetched", {
      statusCounts,
      planCounts,
      activePlanCounts,
      planRevenueMonthly,
      mrr,
      arr,
      totalUsers,
      paidUsers,
      paidConversionPct,
      currency: "INR",
      hiresRevenueInr: hireRevenue,
      activeSubscriptions: activeSubs,
      pagination: {
        page,
        limit,
        total: activeSubsTotal,
        totalPages: Math.ceil(activeSubsTotal / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch revenue data");
  }
}
