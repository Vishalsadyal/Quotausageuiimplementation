import { requireAuth } from "src/lib/guards";
import { ok, fail, handleApiError } from "src/lib/api";
import { generateSearchProfileForUser, SearchProfileError } from "src/lib/search-profile";

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    // { only: "skills" } (onboarding's "Suggest skills"): save just the skills, keep the user's titles and skip words.
    const body = (await req.json().catch(() => null)) as { only?: string } | null;
    const saveOnly = body?.only === "skills" ? ["core_skills", "skills"] : undefined;
    const data = await generateSearchProfileForUser(authResult.auth.user.id, { saveOnly });
    return ok("Generated and saved strict 100 keywords and description with Groq AI", data);
  } catch (error) {
    if (error instanceof SearchProfileError) return fail(error.message, error.status);
    return handleApiError(error, "Failed to generate search terms and description");
  }
}
