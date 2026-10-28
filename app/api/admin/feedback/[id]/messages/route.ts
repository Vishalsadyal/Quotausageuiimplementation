import { z } from "zod";
import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { addTicketMessage, TICKET_MESSAGE_MAX } from "src/lib/tickets";

type RouteParams = {
  params: Promise<{ id: string }>;
};

// Admin > Ratings: the team replies on a ticket; the user sees it in Settings > My Tickets.
const messageSchema = z.object({ body: z.string().trim().min(1).max(TICKET_MESSAGE_MAX) });

export async function POST(req: Request, context: RouteParams) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { id } = await context.params;
    const { body } = messageSchema.parse(await req.json());

    const ticket = await prisma.feedback.findFirst({ where: { id, ticketStatus: { not: null } }, select: { id: true } });
    if (!ticket) return fail("Ticket not found", 404, "NOT_FOUND");

    const result = await addTicketMessage({ feedbackId: ticket.id, author: "admin", authorId: authResult.auth.user.id, body });
    return ok("Reply sent", result);
  } catch (error) {
    return handleApiError(error, "Failed to send reply");
  }
}
