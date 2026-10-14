import { z } from "zod";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { DiscountValidationError, evaluateDiscountForOrder, planDiscountContext } from "src/lib/discounts";
import { PAID_PLANS, planAmountPaise } from "src/lib/plans";
import { PLAN_PERIOD_DAYS } from "src/lib/plan-access";
import { writeAuditLog } from "src/lib/audit";

// Coupon attempts feed the growth funnel (Admin > Growth). Best effort.
function logCheck(userId: string, plan: string, code: string, result: string) {
  return writeAuditLog({ actorUserId: userId, action: "billing.coupon_checked", targetType: "discount_code", targetId: code.toUpperCase().slice(0, 32), metadataJson: { plan, result } }).catch(() => null);
}

/**
 * POST /api/billing/discount/preview  { plan, discountCode }
 * Checks a coupon for a plan purchase and returns the regular and final price. The order route
 * checks it again; this is only for showing the price before paying.
 */
const previewSchema = z.object({
  plan: z.enum(PAID_PLANS),
  discountCode: z.string().trim().min(3).max(32),
});

export async function POST(req: Request) {
  let checked: { userId: string; plan: string; code: string } | null = null;
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    if (authResult.auth.user.role === "admin") return fail("Admins cannot purchase plans", 400, "INVALID_ACTOR");

    const body = previewSchema.parse(await req.json());
    checked = { userId: authResult.auth.user.id, plan: body.plan, code: body.discountCode };
    const applied = await evaluateDiscountForOrder({
      codeInput: body.discountCode,
      userId: authResult.auth.user.id,
      context: planDiscountContext(body.plan),
      baseRupees: Math.round(planAmountPaise(body.plan) / 100),
    });
    if (!applied) return fail("Enter a coupon code", 400, "DISCOUNT_REQUIRED");
    await logCheck(checked.userId, checked.plan, checked.code, "ok");

    return ok("Coupon applied", {
      plan: body.plan,
      code: applied.code,
      description: applied.description,
      baseRupees: applied.baseRupees,
      discountRupees: applied.discountRupees,
      finalRupees: applied.finalRupees,
      periodDays: PLAN_PERIOD_DAYS,
    });
  } catch (error) {
    if (error instanceof DiscountValidationError) {
      if (checked) await logCheck(checked.userId, checked.plan, checked.code, error.errorCode);
      return fail(error.message, error.status, error.errorCode);
    }
    return handleApiError(error, "Failed to check coupon");
  }
}
