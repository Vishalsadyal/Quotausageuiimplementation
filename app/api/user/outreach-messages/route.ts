import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "src/lib/guards";
import { ok, handleApiError } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { writeAuditLog } from "src/lib/audit";

// The messages the extension's WhatsApp, Email and LinkedIn comment tools send, plus how each tool runs.
// Field names match the extension's own settings so the dashboard can hand them over unchanged.
const ACTION = "user.outreach_messages_saved";

const keywords = z.array(z.string().trim().max(120)).max(100);
const seconds = z.number().min(0).max(300);

const whatsappSchema = z
  .object({
    messageTemplate: z.string().max(5000),
    targetKeywords: keywords,
    ignoreKeywords: keywords, // posts that mention any of these are skipped
    autoSendWhatsApp: z.boolean(),
    autoCloseTab: z.boolean(),
    autoLikePosts: z.boolean(),
    showAlreadyContacted: z.boolean(),
    filterJobSeekers: z.boolean(),
    matchAllHiringPosts: z.boolean(),
    removeSentPostFromFeed: z.boolean(),
    hideNonWhatsAppPosts: z.boolean(),
    autoScroll: z.boolean(),
    delayBetweenMessages: seconds,
  })
  .partial();

const emailSchema = z
  .object({
    subjectTemplate: z.string().max(300),
    messageTemplate: z.string().max(5000),
    targetKeywords: keywords,
    ignoreKeywords: keywords, // posts that mention any of these are skipped
    emailClient: z.enum(["gmail_web", "mailto"]),
    autoCloseTab: z.boolean(),
    autoLikePosts: z.boolean(),
    showAlreadyContacted: z.boolean(),
    filterJobSeekers: z.boolean(),
    matchAllHiringPosts: z.boolean(),
    removeSentPostFromFeed: z.boolean(),
    hideNonEmailPosts: z.boolean(),
    autoScroll: z.boolean(),
    delayBetweenEmails: seconds,
  })
  .partial();

const commentSchema = z
  .object({
    commentText: z.string().max(1250), // LinkedIn's own comment limit
    delaySec: seconds,
    maxComments: z.number().min(1).max(200),
    autoLike: z.boolean(),
    autoScroll: z.boolean(),
    skipJobSeekers: z.boolean(),
    skipAlreadyLiked: z.boolean(),
    filterKeywords: z.string().max(500),
    ignoreKeywords: keywords, // posts that mention any of these are skipped
  })
  .partial();

const bodySchema = z.object({
  wa: whatsappSchema.optional(),
  email: emailSchema.optional(),
  comment: commentSchema.optional(),
});

type Stored = z.infer<typeof bodySchema>;

async function loadLatest(userId: string): Promise<{ messages: Stored | null; updatedAt: string | null }> {
  const log = await prisma.auditLog.findFirst({
    where: { actorUserId: userId, action: ACTION },
    orderBy: { createdAt: "desc" },
    select: { metadataJson: true, createdAt: true },
  });
  const parsed = bodySchema.safeParse(log?.metadataJson);
  return { messages: parsed.success ? parsed.data : null, updatedAt: log ? log.createdAt.toISOString() : null };
}

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const { messages, updatedAt } = await loadLatest(authResult.auth.user.id);
    return ok("Outreach messages fetched", { messages, updatedAt });
  } catch (error) {
    return handleApiError(error, "Failed to fetch outreach messages");
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;
    const incoming = bodySchema.parse(await req.json());

    // A save of one tool must not wipe the others: merge into what is already stored.
    const { messages: current } = await loadLatest(userId);
    const merged: Stored = {
      wa: { ...(current?.wa || {}), ...(incoming.wa || {}) },
      email: { ...(current?.email || {}), ...(incoming.email || {}) },
      comment: { ...(current?.comment || {}), ...(incoming.comment || {}) },
    };

    await writeAuditLog({
      actorUserId: userId,
      action: ACTION,
      targetType: "outreach_messages",
      targetId: userId,
      metadataJson: merged,
    });
    return ok("Outreach messages saved", { messages: merged });
  } catch (error) {
    return handleApiError(error, "Failed to save outreach messages");
  }
}
