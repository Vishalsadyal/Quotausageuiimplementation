import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { ok, parsePagination } from "src/lib/api";

type RegisterMethod = "google" | "email" | "resume_upload" | "unknown";

// How each account was created, read from the signup audit entries (no schema field stores it).
// Accounts with no signup entry (created before audit logging, or by an admin) are "unknown".
async function registerMethods(userIds: string[]): Promise<Map<string, RegisterMethod>> {
  const methods = new Map<string, RegisterMethod>();
  if (!userIds.length) return methods;
  const entries = await prisma.auditLog.findMany({
    where: { actorUserId: { in: userIds }, action: { in: ["auth.signup", "auth.google_signup"] } },
    orderBy: { createdAt: "asc" },
    select: { actorUserId: true, action: true, metadataJson: true },
  });
  for (const entry of entries) {
    if (!entry.actorUserId || methods.has(entry.actorUserId)) continue; // earliest entry wins
    const source = (entry.metadataJson as { source?: unknown } | null)?.source;
    methods.set(
      entry.actorUserId,
      entry.action === "auth.google_signup" ? "google" : source === "resume_quick_start" ? "resume_upload" : "email",
    );
  }
  return methods;
}

export async function GET(req: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
  const url = new URL(req.url);
  const search = (url.searchParams.get("search") || "").trim();

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        plan: true,
        quotaUsed: true,
        quotaTotal: true,
        quotaResetTime: true,
        hireBalance: true,
        hireSpent: true,
        hirePurchased: true,
        dailyHireUsed: true,
        dailyHireCap: true,
        dailyHireResetTime: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  const methods = await registerMethods(users.map((u) => u.id));

  return ok("Users fetched", {
    users: users.map((u) => ({ ...u, registerMethod: methods.get(u.id) ?? "unknown" })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
