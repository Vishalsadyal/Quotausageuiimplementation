import { NextRequest } from "next/server";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { parseResumeFile } from "src/lib/resume-parser";
import { parseResumeWithAi } from "src/lib/resume-ai-parser";
import { mergeResumeFields, saveResumeForUser } from "src/lib/resume-store";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";
import { generateSearchProfileForUser } from "src/lib/search-profile";

export async function POST(req: NextRequest) {
  try {
    const rl = await enforceRateLimit({
      key: rateLimitKey(req, "resume.upload"),
      limit: 3,
      windowMs: 300_000,
    });
    if (rl) return rl;

    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const formData = await req.formData();
    const file = formData.get("resume");
    if (!(file instanceof File)) {
      return fail("Resume file is required", 400, "FILE_REQUIRED");
    }

    const maxMb = Number(process.env.MAX_RESUME_FILE_MB || 5);
    if (file.size > maxMb * 1024 * 1024) {
      return fail(`Resume must be <= ${maxMb}MB`, 400, "FILE_TOO_LARGE");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    // An unreadable or unsupported file is the user's problem, not a server error (same as the public resume routes).
    let parsed;
    try {
      parsed = await parseResumeFile(file.name, bytes);
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Could not read this file", 400, "UNREADABLE_FILE");
    }

    let aiParsed = null;
    try {
      aiParsed = await parseResumeWithAi(parsed.text);
    } catch {
      // AI parsing is non-critical; fall back to regex extraction
    }

    const mergedExtracted = mergeResumeFields(parsed, aiParsed);
    await saveResumeForUser(authResult.auth.user.id, file, parsed, mergedExtracted);

    // Auto-generate full 5-tier keyword profile (titles, 1-word, 2-word, core skills, danger/exclude keywords)
    try {
      const searchProfile = await generateSearchProfileForUser(authResult.auth.user.id);
      if (searchProfile.searchTerms?.length) {
        mergedExtracted.jobTitles = searchProfile.searchTerms;
      }
      if (searchProfile.description) {
        mergedExtracted.summary = searchProfile.description;
      }
      if (searchProfile.allKeywords?.length) {
        mergedExtracted.skills = searchProfile.allKeywords;
      }
    } catch {
      // Non-critical; fallback to basic extracted fields
    }

    return ok("Resume parsed and full keyword profile generated with Groq AI", {
      fileName: file.name,
      extracted: mergedExtracted,
    });
  } catch (error) {
    return handleApiError(error, "Failed to upload resume");
  }
}
