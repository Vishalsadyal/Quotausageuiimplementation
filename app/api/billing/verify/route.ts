import { NextRequest } from "next/server";
import { z } from "zod";
import { PAID_PLANS } from "src/lib/plans";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { verifyRazorpaySubscriptionPaymentSignature } from "src/lib/billing";
import { getPlanQuota } from "src/lib/quota";
import { writeAuditLog } from "src/lib/audit";

const verifySchema = z.object({
  plan: z.enum(PAID_PLANS),
  razorpay_payment_id: z.string().min(1),
  razorpay_subscription_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    if (authResult.auth.user.role === "admin") {
      return fail("Admins cannot purchase plans", 400, "INVALID_ACTOR");
    }

    const body = verifySchema.parse(await req.json());
    const valid = verifyRazorpaySubscriptionPaymentSignature({
      paymentId: body.razorpay_payment_id,
      subscriptionId: body.razorpay_subscription_id,
      signature: body.razorpay_signature,
    });
    if (!valid) return fail("Invalid Razorpay signature", 401, "INVALID_SIGNATURE");

    await prisma.subscription.upsert({
      where: { userId: authResult.auth.user.id },
      create: {
        userId: authResult.auth.user.id,
        provider: "razorpay",
        providerSubscriptionId: body.razorpay_subscription_id,
        status: "active",
        plan: body.plan,
      },
      update: {
        providerSubscriptionId: body.razorpay_subscription_id,
        status: "active",
        plan: body.plan,
      },
    });

    await prisma.user.update({
      where: { id: authResult.auth.user.id },
      data: {
        plan: body.plan,
        quotaTotal: getPlanQuota(body.plan),
      },
    });

    // Shown in Billing > Transaction History. Amount unknown here; the renewal webhook records it with the amount.
    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: "billing.plan_purchased",
      targetType: "payment",
      targetId: body.razorpay_payment_id,
      metadataJson: { plan: body.plan, finalRupees: null, discountCode: null, expiresAt: null, source: "subscription" },
    }).catch(() => null);

    return ok("Payment verified and plan activated", {
      plan: body.plan,
      subscriptionId: body.razorpay_subscription_id,
      paymentId: body.razorpay_payment_id,
    });
  } catch (error) {
    return handleApiError(error, "Failed to verify payment");
  }
}

