import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "src/lib/guards";
import { ok, fail, handleApiError } from "src/lib/api";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";
import { userRolePhrases } from "src/lib/hr-contacts";
import { SkipKeywordsError, suggestSkipKeywords } from "src/lib/skip-keywords";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  tool: z.enum(["wa", "email", "comment", "all"]),
  // what is already in the box, so the AI does not repeat it
  existing: z.array(z.string().trim().max(120)).max(100).optional().default([]),
});

/**
 * POST /api/user/outreach-messages/suggest-skip  { tool: "wa" | "email" | "comment" | "all", existing? }
 * AI-suggested "Skip posts that mention" words for the Messages page, tailored to the user's saved roles.
 * Nothing is saved here: the page adds them to the box and the user reviews and saves.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    const limited = await enforceRateLimit({ key: rateLimitKey(req, "outreach.skip_suggest", userId), limit: 8, windowMs: 60_000 });
    if (limited) return limited;

    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const roles = await userRolePhrases(userId);
    const keywords = await suggestSkipKeywords({
      apiKey: process.env.GROQ_API_KEY || "",
      tool: body.tool,
      roles,
      existing: body.existing,
    });
    return ok("Suggestions ready", { keywords });
  } catch (error) {
    if (error instanceof SkipKeywordsError) return fail(error.message, error.status, "AI_UNAVAILABLE");
    return handleApiError(error, "Failed to generate suggestions");
  }
}
