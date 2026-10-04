import { prisma } from "src/lib/prisma";
import { fail, ok } from "src/lib/api";
import { getAuthUserFromRequest, getImpersonator, toClientUser } from "src/lib/auth";
import { ensureHireWindow } from "src/lib/hires";

export async function GET() {
  const auth = await getAuthUserFromRequest();
  if (!auth) return fail("Unauthorized", 401, "UNAUTHORIZED");

  const user = await prisma.user.findUnique({ where: { id: auth.user.id } });
  if (!user) return fail("User not found", 404, "USER_NOT_FOUND");
  const hireAwareUser = await ensureHireWindow(user.id);
  const impersonatedBy = user.role === "user" ? await getImpersonator() : null;
  return ok("Current user", { user: { ...toClientUser(hireAwareUser), impersonatedBy: impersonatedBy ?? undefined } });
}
