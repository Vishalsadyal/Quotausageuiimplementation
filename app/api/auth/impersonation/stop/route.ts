import { fail, handleApiError, ok } from "src/lib/api";
import { writeAuditLog } from "src/lib/audit";
import {
  clearImpersonatorCookie,
  readImpersonatorCookie,
  revokeByRefreshToken,
  revokeSessionById,
  rotateRefreshToken,
  setAuthCookies,
  toClientUser,
  getAuthUserFromRequest,
} from "src/lib/auth";

export async function POST() {
  try {
    const impersonatorToken = await readImpersonatorCookie();
    if (!impersonatorToken) return fail("Not impersonating", 400, "NOT_IMPERSONATING");

    const current = await getAuthUserFromRequest();

    let restored;
    try {
      restored = await rotateRefreshToken(impersonatorToken);
    } catch {
      await clearImpersonatorCookie();
      return fail("Admin session expired. Please log in again.", 401, "IMPERSONATOR_SESSION_EXPIRED");
    }
    if (restored.user.role !== "admin") {
      await revokeByRefreshToken(restored.refreshToken);
      await clearImpersonatorCookie();
      return fail("Forbidden", 403, "FORBIDDEN");
    }

    // End the impersonated user's session, then switch cookies back to the admin.
    if (current && current.user.role === "user") await revokeSessionById(current.sessionId);
    await setAuthCookies(restored.accessToken, restored.refreshToken);
    await clearImpersonatorCookie();

    await writeAuditLog({
      actorUserId: restored.user.id,
      action: "admin.impersonate_stop",
      targetType: "user",
      targetId: current?.user.id,
      metadataJson: { adminEmail: restored.user.email, targetEmail: current?.user.email ?? null },
    });

    return ok("Impersonation ended", { user: toClientUser(restored.user) });
  } catch (error) {
    console.error("stop impersonation error:", error);
    return handleApiError(error, "Failed to end impersonation");
  }
}
