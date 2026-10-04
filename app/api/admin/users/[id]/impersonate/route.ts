import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { writeAuditLog } from "src/lib/audit";
import {
  createSessionAndTokens,
  readImpersonatorCookie,
  revokeSessionById,
  setAuthCookies,
  setImpersonatorCookie,
  toClientUser,
} from "src/lib/auth";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: Request, context: RouteParams) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const admin = authResult.auth.user;

    const { id } = await context.params;
    if (!id) return fail("User id is required", 400, "VALIDATION_ERROR");
    if (id === admin.id) return fail("You cannot impersonate yourself", 400, "SELF_IMPERSONATE_FORBIDDEN");
    if (await readImpersonatorCookie()) {
      return fail("Already impersonating a user. Return to admin first.", 409, "ALREADY_IMPERSONATING");
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return fail("User not found", 404, "USER_NOT_FOUND");
    if (target.role !== "user") return fail("Admin accounts cannot be impersonated", 403, "IMPERSONATE_ADMIN_FORBIDDEN");

    // Park a fresh admin session for the way back, and retire the current one
    // (its refresh token may already have been rotated during this request).
    const adminReturn = await createSessionAndTokens(admin);
    await revokeSessionById(authResult.auth.sessionId);
    await setImpersonatorCookie(adminReturn.refreshToken);

    const { accessToken, refreshToken } = await createSessionAndTokens({
      id: target.id,
      email: target.email,
      role: target.role,
    });
    await setAuthCookies(accessToken, refreshToken);

    await writeAuditLog({
      actorUserId: admin.id,
      action: "admin.impersonate_start",
      targetType: "user",
      targetId: target.id,
      metadataJson: { adminEmail: admin.email, targetEmail: target.email },
    });

    return ok("Impersonation started", {
      user: { ...toClientUser(target), impersonatedBy: { id: admin.id, email: admin.email } },
    });
  } catch (error) {
    console.error("impersonate error:", error);
    return handleApiError(error, "Failed to impersonate user");
  }
}
