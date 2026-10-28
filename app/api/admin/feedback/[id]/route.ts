import { z } from "zod";
import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";

type RouteParams = {
  params: Promise<{ id: string }>;
};

// Admin > Ratings: open / close a ticket. Replies go through ./messages (src/lib/tickets.ts).
const updateSchema = z.object({ ticketStatus: z.enum(["open", "closed"]) });

export async function PATCH(req: Request, context: RouteParams) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { id } = await context.params;
    const { ticketStatus } = updateSchema.parse(await req.json());

    const existing = await prisma.feedback.findFirst({ where: { id, ticketStatus: { not: null } }, select: { id: true } });
    if (!existing) return fail("Ticket not found", 404, "NOT_FOUND");

    const feedback = await prisma.feedback.update({
      where: { id },
      data: { ticketStatus, closedAt: ticketStatus === "closed" ? new Date() : null },
      select: { id: true, ticketStatus: true, closedAt: true },
    });
    return ok("Ticket updated", { feedback });
  } catch (error) {
    return handleApiError(error, "Failed to update ticket");
  }
}
