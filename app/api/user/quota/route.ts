import { fail, handleApiError, ok } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { getWalletSummary } from "src/lib/hires";
import { cacheGetOrSet } from "src/lib/cache";
import { clearAuthCookies } from "src/lib/auth";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;
    const summary = await cacheGetOrSet(`user:quota:${userId}`, 30, () => getWalletSummary(userId));
    const quotaTotal = Math.max(1, Number(summary.user.dailyHireCap || 3));
    const quotaUsedRaw = Math.max(0, Number(summary.user.dailyHireUsed || 0));
    const quotaUsed = Math.min(quotaTotal, quotaUsedRaw);
    return ok("Hires wallet fetched", {
      quotaUsed,
      quotaUsedRaw,
      quotaTotal,
      quotaResetTime: summary.user.dailyHireResetTime.toISOString(),
      plan: summary.user.plan,
      hireBalance: summary.user.hireBalance,
      freeRemaining: summary.freeRemaining,
      dailyRemaining: summary.dailyRemaining,
      spendable: summary.spendable,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      await clearAuthCookies().catch(() => null);
      return fail("User not found", 401, "USER_NOT_FOUND");
    }
    return handleApiError(error, "Failed to fetch user quota");
  }
}
