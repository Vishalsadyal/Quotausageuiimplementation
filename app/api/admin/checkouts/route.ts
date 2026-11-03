import type { Prisma } from "@prisma/client";
import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { handleApiError, ok, parsePagination } from "src/lib/api";
import { CHECKOUT_PRODUCTS, CHECKOUT_SOURCE_LABELS, CHECKOUT_SOURCES } from "src/lib/checkout-tracking";
import { ONBOARDING_STEP_LABELS } from "src/lib/onboarding";

// Admin > Checkouts: who clicked Pay, where, for which plan, and how it ended (src/lib/checkout-tracking.ts),
// plus where new users stop in onboarding.
// GET ?days=7&source=&status=&unpaid=1&page=

export const dynamic = "force-dynamic";

const STATUSES = ["started", "opened", "paid", "dismissed", "failed"] as const;
const DAY_OPTIONS = [1, 7, 30, 90];

type Counts = { clicks: number; opened: number; paid: number; dismissed: number; failed: number };
const emptyCounts = (): Counts => ({ clicks: 0, opened: 0, paid: 0, dismissed: 0, failed: 0 });

// Every attempt is a click; "opened" counts what reached Razorpay (still open, paid or closed).
function add(counts: Counts, status: string, n: number) {
  counts.clicks += n;
  if (status === "opened" || status === "paid" || status === "dismissed") counts.opened += n;
  if (status === "paid") counts.paid += n;
  if (status === "dismissed") counts.dismissed += n;
  if (status === "failed") counts.failed += n;
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const url = new URL(req.url);
    const daysParam = Number(url.searchParams.get("days"));
    const days = DAY_OPTIONS.includes(daysParam) ? daysParam : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const source = CHECKOUT_SOURCES.find((s) => s === url.searchParams.get("source"));
    const status = STATUSES.find((s) => s === url.searchParams.get("status"));
    const unpaidOnly = url.searchParams.get("unpaid") === "1";
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 25, maxLimit: 100 });

    const inRange: Prisma.CheckoutAttemptWhereInput = { createdAt: { gte: since } };

    const [grouped, paidRows, revenue, signups, completed, stepGroups] = await Promise.all([
      prisma.checkoutAttempt.groupBy({ by: ["source", "product", "status"], where: inRange, _count: { _all: true } }),
      prisma.checkoutAttempt.findMany({ where: { ...inRange, status: "paid" }, select: { userId: true }, distinct: ["userId"] }),
      prisma.checkoutAttempt.aggregate({ where: { ...inRange, status: "paid" }, _sum: { amountPaise: true } }),
      prisma.user.count({ where: { role: "user", createdAt: { gte: since } } }),
      prisma.user.count({ where: { role: "user", createdAt: { gte: since }, onboardingCompleted: true } }),
      prisma.user.groupBy({
        by: ["onboardingStep"],
        where: { role: "user", createdAt: { gte: since }, onboardingCompleted: false },
        _count: { _all: true },
      }),
    ]);

    const total = emptyCounts();
    const bySource = new Map<string, Counts>(CHECKOUT_SOURCES.map((s) => [s, emptyCounts()]));
    const byProduct = new Map<string, Counts>(CHECKOUT_PRODUCTS.map((p) => [p, emptyCounts()]));
    for (const g of grouped) {
      const n = g._count._all;
      add(total, g.status, n);
      if (bySource.has(g.source)) add(bySource.get(g.source)!, g.status, n);
      if (byProduct.has(g.product)) add(byProduct.get(g.product)!, g.status, n);
    }

    const paidUserIds = paidRows.map((r) => r.userId);
    const clickedUsers = await prisma.checkoutAttempt.findMany({ where: inRange, select: { userId: true }, distinct: ["userId"] });

    const listWhere: Prisma.CheckoutAttemptWhereInput = {
      ...inRange,
      ...(source ? { source } : {}),
      ...(status ? { status } : {}),
      ...(unpaidOnly ? { userId: { notIn: paidUserIds }, user: { plan: "free" } } : {}),
    };
    const [items, listTotal] = await Promise.all([
      prisma.checkoutAttempt.findMany({
        where: listWhere,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true, phone: true, plan: true, createdAt: true } } },
      }),
      prisma.checkoutAttempt.count({ where: listWhere }),
    ]);
    const paidSet = new Set(paidUserIds);

    // Where new users who haven't finished onboarding stopped (step 0 = never opened it).
    const dropoff = stepGroups
      .map((g) => ({
        step: g.onboardingStep ?? 0,
        label: g.onboardingStep ? ONBOARDING_STEP_LABELS[g.onboardingStep - 1] || `Step ${g.onboardingStep}` : "Never opened onboarding",
        users: g._count._all,
      }))
      .sort((a, b) => a.step - b.step);

    return ok("Checkouts fetched", {
      days,
      summary: {
        ...total,
        users: clickedUsers.length,
        paidUsers: paidUserIds.length,
        revenueRupees: Math.round((revenue._sum.amountPaise || 0) / 100),
      },
      bySource: [...bySource].map(([id, c]) => ({ id, label: CHECKOUT_SOURCE_LABELS[id as keyof typeof CHECKOUT_SOURCE_LABELS] || id, ...c })),
      byProduct: [...byProduct].map(([id, c]) => ({ id, ...c })),
      onboarding: { signups, completed, dropoff },
      items: items.map((a) => ({
        id: a.id,
        source: a.source,
        product: a.product,
        mode: a.mode,
        status: a.status,
        amountRupees: a.amountPaise != null ? Math.round(a.amountPaise / 100) : null,
        stage: a.stage,
        error: a.error,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        user: { ...a.user, createdAt: a.user.createdAt.toISOString(), paidInRange: paidSet.has(a.userId) },
      })),
      pagination: { page, limit, total: listTotal, totalPages: Math.max(1, Math.ceil(listTotal / limit)) },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch checkouts");
  }
}
