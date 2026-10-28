import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "src/lib/prisma";
import { handleApiError, ok } from "src/lib/api";
import { requireAuth } from "src/lib/guards";

// "Rate us" popup in the dashboard (components/FeedbackPrompt.tsx).

// A bad rating, or "Bugs / errors" picked, opens a ticket the user follows in Settings > My Tickets.
function isTicket(rating: number, tags: string[]) {
  return rating <= 3 || tags.includes("Bugs / errors");
}

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
  comment: z.string().trim().max(2000).default(""),
  allowPublic: z.boolean().default(false),
  page: z.string().trim().max(200).default(""),
  trigger: z.enum(["manual", "auto"]).default("manual"),
});

// Whether the user has rated us, and how many jobs we applied to for them (the popup opens by
// itself once, after the 10th application).
export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    const [last, applications, tickets, openTickets] = await Promise.all([
      prisma.feedback.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { rating: true, createdAt: true },
      }),
      prisma.application.count({ where: { userId, status: "submitted" } }),
      prisma.feedback.count({ where: { userId, ticketStatus: { not: null } } }),
      prisma.feedback.count({ where: { userId, ticketStatus: "open" } }),
    ]);

    return ok("Feedback status fetched", { last, applications, tickets, openTickets });
  } catch (error) {
    return handleApiError(error, "Failed to fetch feedback status");
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const payload = feedbackSchema.parse(await req.json());

    const feedback = await prisma.feedback.create({
      data: {
        userId: authResult.auth.user.id,
        ...payload,
        // Only good reviews can be shown on the website.
        allowPublic: payload.allowPublic && payload.rating >= 4,
        ticketStatus: isTicket(payload.rating, payload.tags) ? "open" : null,
      },
      select: { id: true, rating: true, ticketStatus: true },
    });

    return ok("Thanks for your feedback", { feedback });
  } catch (error) {
    return handleApiError(error, "Failed to save feedback");
  }
}
