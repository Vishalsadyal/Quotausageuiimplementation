import { z } from "zod";
import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { fail, handleApiError, ok, parsePagination } from "src/lib/api";
import { FOLLOW_UP_LABELS, FOLLOW_UP_REASONS, listFollowUps, type FollowUpReason } from "src/lib/follow-ups";

// Admin > Follow-ups (src/lib/follow-ups.ts).
// GET ?reason=plan_ending&status=pending|sent|all&page=   who to message today
// POST { userId, reason, key, message }                   record a message as sent
// DELETE ?id=                                             undo "sent"

export async function GET(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const url = new URL(req.url);
    const reasonParam = url.searchParams.get("reason");
    const reason: FollowUpReason = FOLLOW_UP_REASONS.find((r) => r === reasonParam) ?? "plan_ending";
    const status = url.searchParams.get("status") || "pending";
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 25, maxLimit: 100 });

    const { items, counts } = await listFollowUps(reason);
    const shown = items.filter((i) => (status === "sent" ? i.sent : status === "all" ? true : !i.sent));

    return ok("Follow-ups fetched", {
      reason,
      reasons: FOLLOW_UP_REASONS.map((r) => ({ id: r, ...FOLLOW_UP_LABELS[r], ...counts[r] })),
      items: shown.slice(skip, skip + limit),
      pagination: { page, limit, total: shown.length, totalPages: Math.max(1, Math.ceil(shown.length / limit)) },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch follow-ups");
  }
}

const sentSchema = z.object({
  userId: z.string().min(1).max(64),
  reason: z.enum(FOLLOW_UP_REASONS),
  key: z.string().min(1).max(120),
  message: z.string().max(4000).default(""),
});

export async function POST(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const payload = sentSchema.parse(await req.json());

    const row = await prisma.whatsAppFollowUp.upsert({
      where: { userId_key: { userId: payload.userId, key: payload.key } },
      create: { ...payload, sentById: authResult.auth.user.id },
      update: {},
      select: { id: true, createdAt: true },
    });
    return ok("Marked as sent", { sent: { id: row.id, at: row.createdAt.toISOString() } });
  } catch (error) {
    return handleApiError(error, "Failed to mark follow-up as sent");
  }
}

export async function DELETE(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id is required", 400, "VALIDATION_ERROR");
    await prisma.whatsAppFollowUp.deleteMany({ where: { id } });
    return ok("Follow-up moved back to pending");
  } catch (error) {
    return handleApiError(error, "Failed to undo follow-up");
  }
}
