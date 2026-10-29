import { prisma } from "src/lib/prisma";

// Tickets are bad ratings and bug reports (Feedback with a ticketStatus). Users follow them in
// Settings > My Tickets and the team answers in Admin > Ratings; both sides add TicketMessages.

export const TICKET_MESSAGE_MAX = 4000;

export const ticketMessageSelect = { id: true, author: true, body: true, createdAt: true } as const;

type SeenFields = { lastMessageBy: string | null; lastMessageAt: Date | null; userSeenAt: Date | null };

/** A team reply the user hasn't seen yet (they haven't opened My Tickets since). */
export function hasNewTeamReply(t: SeenFields) {
  return t.lastMessageBy === "admin" && Boolean(t.lastMessageAt) && (!t.userSeenAt || t.lastMessageAt! > t.userSeenAt);
}

/**
 * Shown on the dashboard bell: an open ticket stays there until the user replies (seeing it isn't
 * enough); a closed one needs no answer, so it goes once they've seen the team's last reply.
 */
export function needsUserAttention(t: SeenFields & { ticketStatus: string | null }) {
  if (t.lastMessageBy !== "admin") return false;
  return t.ticketStatus === "open" || hasNewTeamReply(t);
}

/**
 * Adds a message to a ticket and records who wrote last. A user's reply reopens a closed ticket, so
 * the team sees it again.
 */
export async function addTicketMessage(input: { feedbackId: string; author: "user" | "admin"; authorId: string; body: string }) {
  const now = new Date();
  const [message, feedback] = await prisma.$transaction([
    prisma.ticketMessage.create({
      data: { feedbackId: input.feedbackId, author: input.author, authorId: input.authorId, body: input.body, createdAt: now },
      select: ticketMessageSelect,
    }),
    prisma.feedback.update({
      where: { id: input.feedbackId },
      data: {
        lastMessageBy: input.author,
        lastMessageAt: now,
        ...(input.author === "user" ? { ticketStatus: "open", closedAt: null } : {}),
      },
      select: { id: true, ticketStatus: true, closedAt: true, lastMessageBy: true, lastMessageAt: true },
    }),
  ]);
  return { message, feedback };
}
