import { ok, handleApiError, parsePagination } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { prisma } from "src/lib/prisma";
import { toPlanPurchases } from "src/lib/purchases-map";

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });

    const [transactions, total, purchaseRows] = await Promise.all([
      prisma.hireTransaction.findMany({
        where: { userId: authResult.auth.user.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.hireTransaction.count({
        where: { userId: authResult.auth.user.id },
      }),
      // Plan purchases (one-time checkout and subscription payments) are not Hires movements, so they live in
      // the audit log; they are listed here so the Transaction History shows them too.
      prisma.auditLog.findMany({
        where: { actorUserId: authResult.auth.user.id, action: "billing.plan_purchased" },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, targetId: true, createdAt: true, metadataJson: true },
      }),
    ]);

    return ok("Wallet transactions fetched", {
      transactions,
      purchases: toPlanPurchases(purchaseRows),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch wallet transactions");
  }
}
