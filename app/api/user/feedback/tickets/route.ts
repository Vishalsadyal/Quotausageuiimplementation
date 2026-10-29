import { prisma } from "src/lib/prisma";
import { handleApiError, ok } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { hasNewTeamReply, ticketMessageSelect } from "src/lib/tickets";

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
        lastMessageAt: true,
        userSeenAt: true,
        createdAt: true,
        messages: { orderBy: { createdAt: "asc" }, select: ticketMessageSelect },
      },
    });
    // Opening My Tickets is seeing every reply; "isNew" marks the ones that were new on this visit.
    const userId = authResult.auth.user.id;
    if (tickets.some(hasNewTeamReply)) {
      await prisma.feedback.updateMany({ where: { userId, ticketStatus: { not: null } }, data: { userSeenAt: new Date() } });
    }
    return ok("Tickets fetched", {
      tickets: tickets.map(({ userSeenAt, ...t }) => ({ ...t, isNew: hasNewTeamReply({ ...t, userSeenAt }) })),
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch tickets");
  }
}
