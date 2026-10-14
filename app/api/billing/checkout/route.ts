import { NextRequest } from "next/server";
import { checkoutSchema } from "src/lib/schemas";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { getOrCreatePlanRazorpayId, getRazorpayClient } from "src/lib/billing";
import { prisma } from "src/lib/prisma";
import { PLAN_RAZORPAY_ENV } from "src/lib/plans";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    if (authResult.auth.user.role === "admin") {
      return fail("Admins cannot purchase plans", 400, "INVALID_ACTOR");
    }

    const body = checkoutSchema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { id: authResult.auth.user.id } });
    if (!user) return fail("User not found", 404, "USER_NOT_FOUND");
    const devMockEnabled =
      process.env.NODE_ENV !== "production" &&
      (process.env.BILLING_DEV_MOCK_CHECKOUT || "false").toLowerCase() === "true";

    let planId: string;
    if (devMockEnabled) {
      const configured = process.env[PLAN_RAZORPAY_ENV[body.plan]];
      if (!configured) {
        const now = Date.now();
        const mockSubscriptionId = `mock_sub_${now}`;
        await prisma.subscription.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            provider: "razorpay",
            providerSubscriptionId: mockSubscriptionId,
            providerPlanId: `mock_plan_${body.plan}`,
            status: "trialing",
            plan: body.plan,
          },
          update: {
            providerSubscriptionId: mockSubscriptionId,
            providerPlanId: `mock_plan_${body.plan}`,
            status: "trialing",
            plan: body.plan,
          },
        });
        return ok("Checkout created (mock)", {
          provider: "razorpay",
          subscriptionId: mockSubscriptionId,
          plan: body.plan,
          keyId: process.env.RZP_KEY_ID || "",
          mock: true,
        });
      }
    }

    planId = await getOrCreatePlanRazorpayId(body.plan);

    const razorpay = getRazorpayClient();

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: 120,
      customer_notify: 1,
      notes: {
        userId: user.id,
        plan: body.plan,
      },
    });

    await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        provider: "razorpay",
        providerSubscriptionId: subscription.id,
        providerPlanId: planId,
        status: "trialing",
        plan: body.plan,
      },
      update: {
        providerSubscriptionId: subscription.id,
        providerPlanId: planId,
        status: "trialing",
        plan: body.plan,
      },
    });

    return ok("Checkout created", {
      provider: "razorpay",
      subscriptionId: subscription.id,
      plan: body.plan,
      keyId: process.env.RZP_KEY_ID || "",
    });
  } catch (error) {
    return handleApiError(error, "Failed to create checkout");
  }
}
