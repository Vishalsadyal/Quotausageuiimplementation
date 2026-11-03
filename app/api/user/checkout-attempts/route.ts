import { z } from "zod";
import { prisma } from "src/lib/prisma";
import { requireAuth } from "src/lib/guards";
import { handleApiError, ok } from "src/lib/api";
import { CHECKOUT_MODES, CHECKOUT_PRODUCTS, CHECKOUT_SOURCES } from "src/lib/checkout-tracking";

// A Pay button was clicked (src/lib/checkout-tracking.ts). Shown in Admin > Checkouts.

const startSchema = z.object({
  source: z.enum(CHECKOUT_SOURCES),
  product: z.enum(CHECKOUT_PRODUCTS),
  mode: z.enum(CHECKOUT_MODES),
});

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const payload = startSchema.parse(await req.json());
    const row = await prisma.checkoutAttempt.create({
      data: { ...payload, userId: authResult.auth.user.id },
      select: { id: true },
    });
    return ok("Checkout recorded", { id: row.id });
  } catch (error) {
    return handleApiError(error, "Failed to record checkout");
  }
}
