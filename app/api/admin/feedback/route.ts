import { Prisma } from "@prisma/client";
import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { ok, handleApiError, parsePagination } from "src/lib/api";
import { ticketMessageSelect } from "src/lib/tickets";

// Admin > Ratings: feedback from the dashboard "Rate us" popup, newest first, with a summary.
// Filters: ?rating=1..5, ?public=1 (ok to show on the website), ?ticket=open|closed|waiting, ?q= (name, email or review text).
// "waiting": open tickets where the user wrote last (or nobody has answered yet).
const WAITING_FOR_REPLY: Prisma.FeedbackWhereInput = {
  ticketStatus: "open",
  OR: [{ lastMessageBy: "user" }, { lastMessageBy: null }],
};

export async function GET(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
    const url = new URL(req.url);

    const rating = Number(url.searchParams.get("rating") || "");
    const q = (url.searchParams.get("q") || "").trim();
    const where: Prisma.FeedbackWhereInput = {};
    if (Number.isInteger(rating) && rating >= 1 && rating <= 5) where.rating = rating;
    if (url.searchParams.get("public") === "1") where.allowPublic = true;
    const ticket = url.searchParams.get("ticket");
    if (ticket === "open" || ticket === "closed") where.ticketStatus = ticket;
    if (ticket === "waiting") Object.assign(where, WAITING_FOR_REPLY);
    if (q) {
      where.OR = [
        { comment: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [items, total, summary, byRating, tagRows, openTickets, waitingTickets] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, plan: true } },
          messages: { orderBy: { createdAt: "asc" }, select: ticketMessageSelect },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.feedback.count({ where }),
      prisma.feedback.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
      prisma.feedback.groupBy({ by: ["rating"], _count: { _all: true } }),
      prisma.$queryRaw<Array<{ tag: string; count: bigint }>>`
        SELECT tag, COUNT(*) AS count FROM "Feedback", unnest("tags") AS tag
        GROUP BY tag ORDER BY count DESC LIMIT 8`,
      prisma.feedback.count({ where: { ticketStatus: "open" } }),
      prisma.feedback.count({ where: WAITING_FOR_REPLY }),
    ]);

    const distribution = [5, 4, 3, 2, 1].map((stars) => ({
      rating: stars,
      count: byRating.find((row) => row.rating === stars)?._count._all ?? 0,
    }));

    return ok("Feedback fetched", {
      items,
      summary: {
        total: summary._count._all,
        average: summary._avg.rating ? Math.round(summary._avg.rating * 10) / 10 : 0,
        distribution,
        topTags: tagRows.map((row) => ({ tag: row.tag, count: Number(row.count) })),
        openTickets,
        waitingTickets,
      },
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch feedback");
  }
}
