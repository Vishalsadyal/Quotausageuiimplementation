import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "src/lib/guards";
import { ok, fail, handleApiError } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { enforceRateLimit } from "src/lib/rate-limit";
import { isPaidUser, SUPPORT_WHATSAPP_NUMBER } from "src/lib/assistant-context";

const requestSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  answer: z.string().max(4000).optional().default(""),
  page: z.string().max(200).optional().default(""),
});

// Paid users: log an issue/feedback to the admin Support inbox and return a prefilled WhatsApp link.
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    const limited = await enforceRateLimit({ key: `assistant-report:${userId}`, limit: 10, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const payload = requestSchema.parse(await req.json().catch(() => ({})));

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true, plan: true, hirePurchased: true },
    });
    if (!user) return fail("User not found", 404);
    if (!isPaidUser(user)) return fail("WhatsApp support is available on paid plans.", 403, "PAID_ONLY");

    const supportText = [
      "[Dashboard assistant report]",
      `Page: ${payload.page || "-"}`,
      `Question: ${payload.question}`,
      payload.answer ? `Assistant answer: ${payload.answer.slice(0, 1500)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const visitorId = `user:${userId}`;
    const conversation =
      (await prisma.supportConversation.findFirst({
        where: { visitorId, status: "open" },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      })) ||
      (await prisma.supportConversation.create({
        data: { visitorId, userId, status: "open" },
        select: { id: true },
      }));

    await prisma.$transaction([
      prisma.supportMessage.create({
        data: { conversationId: conversation.id, sender: "visitor", content: supportText },
      }),
      prisma.supportConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    const waText = [
      `Hi AutoApply CV team, I need help (ref ${conversation.id.slice(-6)}).`,
      `Name: ${user.name}`,
      `Email: ${user.email}`,
      `Plan: ${user.plan}`,
      `Page: ${payload.page || "-"}`,
      "",
      `Issue: ${payload.question.slice(0, 1200)}`,
    ].join("\n");

    return ok("Report saved", {
      conversationId: conversation.id,
      whatsappUrl: `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(waText)}`,
    });
  } catch (error) {
    return handleApiError(error, "Failed to send report");
  }
}
