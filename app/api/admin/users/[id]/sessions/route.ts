import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { fail, ok } from "src/lib/api";

type RouteParams = {
  params: Promise<{ id: string }>;
};

// Admin > Users > sessions: the user's logins, newest activity first.
export async function GET(_req: Request, context: RouteParams) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await context.params;
  if (!id) return fail("User id is required", 400, "VALIDATION_ERROR");

  const sessions = await prisma.session.findMany({
    where: { userId: id },
    orderBy: { lastUsedAt: "desc" },
    take: 30,
    select: {
      id: true,
      status: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      impersonatorId: true,
    },
  });

  const now = Date.now();
  return ok("Sessions fetched", {
    sessions: sessions.map((s) => ({
      ...s,
      // An "active" session past its expiry is only expired lazily on its next use.
      status: s.status === "active" && s.expiresAt.getTime() <= now ? "expired" : s.status,
      viewedByAdmin: Boolean(s.impersonatorId),
      impersonatorId: undefined,
    })),
  });
}
