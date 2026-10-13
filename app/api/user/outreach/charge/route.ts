import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "src/lib/guards";
import { ok, fail, handleApiError } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { writeAuditLog } from "src/lib/audit";
import { consumeHiresForApplies, getWalletSummary } from "src/lib/hires";
import { enforceRateLimit } from "src/lib/rate-limit";
import { OUTREACH_ACTIONS } from "src/lib/outreach";

/**
 * POST /api/user/outreach/charge
 *
 * Called by the extension right BEFORE it sends one outreach message, so nothing is sent unless it
 * was paid for. 1 Hire per message (free daily Hires first, then the paid balance; Pro is
 * unlimited). The same recipient / post is charged once: a retry of a send that already went
 * through (or failed after charging) costs nothing.
 *
 * Body: { channel: "whatsapp" | "email" | "comment", targetId: phone / email / post URN }
 * 200 { charged: 0 | 1, alreadyCharged, spendable } | 402 INSUFFICIENT_HIRES
 */
const schema = z.object({
  channel: z.enum(["whatsapp", "email", "comment"]),
  targetId: z.string().trim().min(3).max(300),
});

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    const limited = await enforceRateLimit({ key: `outreach-charge:${userId}`, limit: 300, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail("Invalid JSON payload", 400);
    }
    const { channel, targetId } = schema.parse(body);
    const target = targetId.toLowerCase();
    const action = OUTREACH_ACTIONS[channel];

    const already = await prisma.auditLog.findFirst({
      where: { actorUserId: userId, action, targetId: target },
      select: { id: true },
    });
    if (already) {
      const wallet = await getWalletSummary(userId);
      return ok("Already charged for this recipient", { charged: 0, alreadyCharged: true, spendable: wallet.spendable });
    }

    const charge = await consumeHiresForApplies({
      userId,
      count: 1,
      referenceType: `outreach_${channel}`,
      referenceId: target,
      idempotencyPrefix: `outreach:${channel}:${userId}:${target}`,
      metadataJson: { channel },
    });
    if (!charge.ok) {
      return fail("You are out of Hires. Top up to keep sending outreach messages.", 402, "INSUFFICIENT_HIRES");
    }

    await writeAuditLog({
      actorUserId: userId,
      action,
      targetType: "outreach",
      targetId: target,
      metadataJson: { channel, free: charge.sourceBreakdown.free, paid: charge.sourceBreakdown.paid },
    });

    const wallet = await getWalletSummary(userId);
    return ok("Charged 1 Hire", { charged: 1, alreadyCharged: false, spendable: wallet.spendable });
  } catch (error) {
    return handleApiError(error, "Failed to charge outreach message");
  }
}
