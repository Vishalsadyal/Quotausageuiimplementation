import { prisma } from "src/lib/prisma";
import { handleApiError, ok } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { ticketMessageSelect } from "src/lib/tickets";

// Settings > My Tickets: the user's bad ratings and bug reports, with the conversation and open/closed status.
export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const tickets = await prisma.feedback.findMany({
      where: { userId: authResult.auth.user.id, ticketStatus: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        rating: true,
        tags: true,
        comment: true,
        ticketStatus: true,
        closedAt: true,
        lastMessageBy: true,
        createdAt: true,
        messages: { orderBy: { createdAt: "asc" }, select: ticketMessageSelect },
      },
    });
    return ok("Tickets fetched", { tickets });
  } catch (error) {
    return handleApiError(error, "Failed to fetch tickets");
  }
}
