import { z } from "zod";
import { prisma } from "src/lib/prisma";
import { requireAuth } from "src/lib/guards";
import { handleApiError, ok } from "src/lib/api";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  status: z.enum(["opened", "paid", "dismissed", "failed"]),
  amountPaise: z.number().int().min(0).max(100_000_000).optional(),
  stage: z.string().trim().max(60).optional(),
  error: z.string().trim().max(500).optional(),
});

// What happened after the click. A finished attempt (paid/dismissed/failed) is never moved back.
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const { id } = await params;
    const payload = updateSchema.parse(await req.json());
    const updatable = payload.status === "opened" ? ["started"] : ["started", "opened"];
    await prisma.checkoutAttempt.updateMany({
      where: { id, userId: authResult.auth.user.id, status: { in: updatable } },
      data: payload,
    });
    return ok("Checkout updated");
  } catch (error) {
    return handleApiError(error, "Failed to update checkout");
  }
}
