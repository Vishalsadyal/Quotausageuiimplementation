import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { getRazorpayClient } from "src/lib/billing";
import { writeAuditLog } from "src/lib/audit";

/** GET /api/billing/cancel: the user's monthly subscription, if any (for the Billing page). */
export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const sub = await prisma.subscription.findUnique({ where: { userId: authResult.auth.user.id } });
    const live = Boolean(sub?.providerSubscriptionId && !sub.providerSubscriptionId.startsWith("mock_") && sub.status === "active");
    return ok("Subscription", {
      active: live,
      plan: live ? sub!.plan : null,
      cancelAtPeriodEnd: live ? sub!.cancelAtPeriodEnd : false,
      accessUntil: live ? sub!.currentPeriodEnd?.toISOString() || null : null,
    });
  } catch (error) {
    return handleApiError(error, "Failed to load subscription");
  }
}

/**
 * POST /api/billing/cancel
 * Stops a monthly subscription from renewing. The user keeps the plan until the period they already paid for ends.
 */
export async function POST() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub?.providerSubscriptionId || sub.providerSubscriptionId.startsWith("mock_") || sub.status !== "active") {
      return fail("No active monthly subscription to cancel", 404, "NO_SUBSCRIPTION");
    }
    if (sub.cancelAtPeriodEnd) {
      return ok("Already cancelled", { cancelAtPeriodEnd: true, accessUntil: sub.currentPeriodEnd?.toISOString() || null });
    }

    const razorpay = await getRazorpayClient();
    await razorpay.subscriptions.cancel(sub.providerSubscriptionId, true); // true = at the end of the current cycle
    await prisma.subscription.update({ where: { userId }, data: { cancelAtPeriodEnd: true } });
    await writeAuditLog({
      actorUserId: userId,
      action: "billing.subscription_cancelled",
      targetType: "subscription",
      targetId: sub.providerSubscriptionId,
      metadataJson: { plan: sub.plan },
    }).catch(() => null);

    return ok("Subscription cancelled. Your plan stays active until the end of the period you paid for.", {
      cancelAtPeriodEnd: true,
      accessUntil: sub.currentPeriodEnd?.toISOString() || null,
    });
  } catch (error) {
    return handleApiError(error, "Failed to cancel subscription");
  }
}
