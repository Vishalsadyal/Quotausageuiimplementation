import { requireAuth } from "src/lib/guards";
import { ok, handleApiError } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { getWalletSummary } from "src/lib/hires";
import { OUTREACH_ACTIONS, type OutreachChannel } from "src/lib/outreach";

/**
 * GET /api/user/outreach
 *
 * Outreach counters for the dashboard cards: messages sent per channel (total and today) and the
 * Hires left to send more (1 Hire per message). spendable = free daily Hires + paid balance
 * (very large for Pro).
 */
export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const channels = Object.keys(OUTREACH_ACTIONS) as OutreachChannel[];
    const counts = await Promise.all(
      channels.map(async (channel) => {
        const action = OUTREACH_ACTIONS[channel];
        const [total, today] = await Promise.all([
          prisma.auditLog.count({ where: { actorUserId: userId, action } }),
          prisma.auditLog.count({ where: { actorUserId: userId, action, createdAt: { gte: startOfDay } } }),
        ]);
        return [channel, { total, today }] as const;
      }),
    );

    const wallet = await getWalletSummary(userId);
    return ok("Outreach stats", {
      sent: Object.fromEntries(counts) as Record<OutreachChannel, { total: number; today: number }>,
      costPerMessage: 1,
      plan: wallet.user.plan,
      unlimited: wallet.user.plan === "pro",
      spendable: wallet.spendable,
      freeRemaining: wallet.freeRemaining,
      hireBalance: wallet.user.hireBalance,
    });
  } catch (error) {
    return handleApiError(error, "Failed to load outreach stats");
  }
}
