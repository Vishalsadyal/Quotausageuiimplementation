import { z } from "zod";
import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";

type RouteParams = {
  params: Promise<{ id: string }>;
};

// Admin > Ratings: reply to a ticket and open / close it. The user sees both in Settings > My Tickets.
const updateSchema = z
  .object({
    ticketStatus: z.enum(["open", "closed"]).optional(),
    adminReply: z.string().trim().max(4000).optional(),
  })
  .refine((v) => v.ticketStatus !== undefined || v.adminReply !== undefined, { message: "Nothing to update" });

export async function PATCH(req: Request, context: RouteParams) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { id } = await context.params;
    const payload = updateSchema.parse(await req.json());

    const existing = await prisma.feedback.findUnique({ where: { id }, select: { id: true, adminReply: true } });
    if (!existing) return fail("Rating not found", 404, "NOT_FOUND");

    const now = new Date();
    const feedback = await prisma.feedback.update({
      where: { id },
      data: {
        ...(payload.ticketStatus ? { ticketStatus: payload.ticketStatus, closedAt: payload.ticketStatus === "closed" ? now : null } : {}),
        ...(payload.adminReply !== undefined && payload.adminReply !== existing.adminReply
          ? { adminReply: payload.adminReply, repliedAt: payload.adminReply ? now : null }
          : {}),
      },
      select: { id: true, ticketStatus: true, adminReply: true, repliedAt: true, closedAt: true },
    });
    return ok("Ticket updated", { feedback });
  } catch (error) {
    return handleApiError(error, "Failed to update ticket");
  }
}
