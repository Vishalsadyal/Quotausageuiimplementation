import { NextRequest } from "next/server";
import { requireAdmin } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { parseResumeFile } from "src/lib/resume-parser";
import { parseResumeWithAi } from "src/lib/resume-ai-parser";
import { mergeResumeFields } from "src/lib/resume-store";

export const dynamic = "force-dynamic";

const MAX_MB = 5;

/**
 * POST /api/admin/agency/parse-resume (multipart: resume)
 * Reads a candidate's resume to pre-fill the Add candidate form. Nothing is saved: the form sends the
 * same file again when the candidate is added.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;

    const file = (await req.formData()).get("resume");
    if (!(file instanceof File)) return fail("Resume file is required", 400, "FILE_REQUIRED");
    if (file.size > MAX_MB * 1024 * 1024) return fail(`Resume must be ${MAX_MB} MB or smaller`, 400, "FILE_TOO_LARGE");

    let parsed;
    try {
      parsed = await parseResumeFile(file.name, Buffer.from(await file.arrayBuffer()));
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Could not read this file", 400, "UNREADABLE_FILE");
    }
    if (parsed.text.trim().length < 50) return fail("This file has no readable text. Upload a text-based PDF or DOCX.", 400, "EMPTY_RESUME");

    // AI extraction is optional; the regex fields still work without it.
    const ai = await parseResumeWithAi(parsed.text).catch(() => null);
    const merged = mergeResumeFields(parsed, ai);
    const years = Number(String(ai?.yearsOfExperience ?? "").replace(/[^\d.]/g, ""));

    return ok("Resume read", {
      profile: {
        name: String(merged.name || "").trim(),
        email: String(merged.email || "").trim().toLowerCase(),
        phone: String(merged.phone || "").trim(),
        currentCity: String(ai?.city || parsed.extracted.currentCity || "").trim(),
        roles: (Array.isArray(ai?.jobTitles) ? ai.jobTitles.filter(Boolean).slice(0, 3) : []).join(", "),
        experienceYears: Number.isFinite(years) && String(ai?.yearsOfExperience ?? "").trim() ? String(Math.round(years)) : "",
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to read resume");
  }
}
