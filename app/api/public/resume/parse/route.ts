import { NextRequest } from "next/server";
import { fail, handleApiError, ok } from "src/lib/api";
import { parseResumeFile } from "src/lib/resume-parser";
import { parseResumeWithAi } from "src/lib/resume-ai-parser";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";

// Anonymous resume read for the home-page agent. Nothing is stored here: the
// visitor's browser keeps the file and uploads it to their account after signup
// (POST /api/user/resume/upload), which is where the resume is saved.
const MAX_MB = 5;

export async function POST(req: NextRequest) {
  try {
    const rl = await enforceRateLimit({
      key: rateLimitKey(req, "public.resume.parse"),
      limit: 5,
      windowMs: 600_000,
    });
    if (rl) return rl;

    const formData = await req.formData();
    const file = formData.get("resume");
    if (!(file instanceof File)) return fail("Resume file is required", 400, "FILE_REQUIRED");
    if (file.size > MAX_MB * 1024 * 1024) return fail(`Resume must be ${MAX_MB} MB or smaller`, 400, "FILE_TOO_LARGE");

    let parsed;
    try {
      parsed = await parseResumeFile(file.name, Buffer.from(await file.arrayBuffer()));
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Could not read this file", 400, "UNREADABLE_FILE");
    }
    if (parsed.text.trim().length < 50) {
      return fail("This file has no readable text. Upload a text-based PDF or DOCX.", 400, "EMPTY_RESUME");
    }

    let ai: Awaited<ReturnType<typeof parseResumeWithAi>> | null = null;
    try {
      ai = await parseResumeWithAi(parsed.text);
    } catch {
      // AI extraction is optional; the regex fields below still pre-fill signup.
    }

    const jobTitles = Array.isArray(ai?.jobTitles) ? ai.jobTitles.filter(Boolean).slice(0, 3) : [];
    const years = Number(String(ai?.yearsOfExperience ?? "").replace(/[^\d.]/g, ""));

    return ok("Resume read", {
      profile: {
        name: ai?.name || parsed.extracted.name || "",
        email: ai?.email || parsed.extracted.email || "",
        phone: ai?.phone || parsed.extracted.phone || "",
        city: ai?.city || parsed.extracted.currentCity || "",
        linkedinUrl: ai?.linkedinUrl || parsed.extracted.linkedinUrl || "",
        jobTitles,
        yearsOfExperience: Number.isFinite(years) && String(ai?.yearsOfExperience ?? "").trim() ? String(Math.round(years)) : "",
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to read resume");
  }
}
