import { prisma } from "src/lib/prisma";

// Tickets are bad ratings and bug reports (Feedback with a ticketStatus). Users follow them in
// Settings > My Tickets and the team answers in Admin > Ratings; both sides add TicketMessages.

export const TICKET_MESSAGE_MAX = 4000;

export const ticketMessageSelect = { id: true, author: true, body: true, createdAt: true } as const;

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
