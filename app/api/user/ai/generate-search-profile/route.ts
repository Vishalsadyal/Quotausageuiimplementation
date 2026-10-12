import { requireAuth } from "src/lib/guards";
import { ok, fail, handleApiError } from "src/lib/api";
import { generateSearchProfileForUser, SearchProfileError } from "src/lib/search-profile";

export async function POST() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const data = await generateSearchProfileForUser(authResult.auth.user.id);
    return ok("Generated and saved strict 100 keywords and description with Groq AI", data);
  } catch (error) {
    if (error instanceof SearchProfileError) return fail(error.message, error.status);
    return handleApiError(error, "Failed to generate search terms and description");
  }
}
