import { z } from "zod";
import { prisma } from "src/lib/prisma";
import { fail, handleApiError, ok } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { addTicketMessage, TICKET_MESSAGE_MAX } from "src/lib/tickets";

type RouteParams = {
  params: Promise<{ id: string }>;
};

// Settings > My Tickets: the user replies to the team. Replying to a closed ticket opens it again.
const messageSchema = z.object({ body: z.string().trim().min(1).max(TICKET_MESSAGE_MAX) });

export async function POST(req: Request, context: RouteParams) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const { id } = await context.params;
    const { body } = messageSchema.parse(await req.json());

    const ticket = await prisma.feedback.findFirst({
      where: { id, userId: authResult.auth.user.id, ticketStatus: { not: null } },
      select: { id: true },
    });
    if (!ticket) return fail("Ticket not found", 404, "NOT_FOUND");

    const result = await addTicketMessage({ feedbackId: ticket.id, author: "user", authorId: authResult.auth.user.id, body });
    return ok("Reply sent", result);
  } catch (error) {
    return handleApiError(error, "Failed to send reply");
  }
}
