import { NextRequest } from "next/server";
import { requireAuth } from "src/lib/guards";
import { handleApiError, ok } from "src/lib/api";
import { referralSummary } from "src/lib/referrals";

export const dynamic = "force-dynamic";

/** GET /api/user/referrals: the user's referral link, progress, friends (first names) and rewards. */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim() || req.nextUrl.origin;
    return ok("Referrals", await referralSummary(authResult.auth.user.id, siteUrl));
  } catch (error) {
    return handleApiError(error, "Failed to load referrals");
  }
}
