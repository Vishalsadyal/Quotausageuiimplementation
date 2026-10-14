import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "src/lib/guards";
import { ok, fail, handleApiError } from "src/lib/api";
import { prisma } from "src/lib/prisma";

/**
 * POST /api/user/hr-contacts/sent  { deliveryId }
 * Marks one of the user's HR contacts as messaged, so the page shows "Sent".
 */
const schema = z.object({ deliveryId: z.string().min(5).max(60) });

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const { deliveryId } = schema.parse(await req.json().catch(() => ({})));
    const res = await prisma.hrContactDelivery.updateMany({
      where: { id: deliveryId, userId: authResult.auth.user.id, sentAt: null },
      data: { sentAt: new Date() },
    });
    if (!res.count) {
      const exists = await prisma.hrContactDelivery.count({ where: { id: deliveryId, userId: authResult.auth.user.id } });
      if (!exists) return fail("Contact not found", 404, "NOT_FOUND");
    }
    return ok("Marked as sent", { sentAt: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error, "Failed to mark contact as sent");
  }
}
