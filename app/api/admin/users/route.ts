import { Prisma } from "@prisma/client";
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

// "Online" = an active session used in the last 20 minutes. Sessions renew their 15-minute access
// token on use (src/lib/auth.ts rotateRefreshToken), which is when lastUsedAt moves, so this is
// accurate to about 15 minutes and costs no extra writes. "View as user" sessions are left out.
const ONLINE_WINDOW_MS = 20 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type Activity = "online" | "today" | "week" | "inactive";
type Onboarding = "done" | "in_progress" | "not_started";

function activityWhere(activity: Activity | null, now: number): Prisma.UserWhereInput | null {
  const own = { impersonatorId: null };
  if (activity === "online") {
    return { sessions: { some: { ...own, status: "active", lastUsedAt: { gte: new Date(now - ONLINE_WINDOW_MS) } } } };
  }
  if (activity === "today") return { sessions: { some: { ...own, lastUsedAt: { gte: new Date(now - DAY_MS) } } } };
  if (activity === "week") return { sessions: { some: { ...own, lastUsedAt: { gte: new Date(now - 7 * DAY_MS) } } } };
  if (activity === "inactive") return { sessions: { none: { ...own, lastUsedAt: { gte: new Date(now - 7 * DAY_MS) } } } };
  return null;
}

function onboardingWhere(onboarding: Onboarding | null): Prisma.UserWhereInput | null {
  if (onboarding === "done") return { onboardingCompleted: true };
  if (onboarding === "in_progress") return { onboardingCompleted: false, onboardingStep: { not: null } };
  if (onboarding === "not_started") return { onboardingCompleted: false, onboardingStep: null };
  return null;
}

// Last activity and device per user, from their latest session of their own.
async function lastSessions(userIds: string[], now: number) {
  const result = new Map<string, { lastSeenAt: string; online: boolean; userAgent: string | null; activeSessions: number }>();
  if (!userIds.length) return result;
  const [latest, active] = await Promise.all([
    prisma.session.findMany({
      where: { userId: { in: userIds }, impersonatorId: null },
      orderBy: { lastUsedAt: "desc" },
      distinct: ["userId"],
      select: { userId: true, lastUsedAt: true, status: true, userAgent: true },
    }),
    prisma.session.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, impersonatorId: null, status: "active", expiresAt: { gt: new Date(now) } },
      _count: { _all: true },
    }),
  ]);
  for (const s of latest) {
    result.set(s.userId, {
      lastSeenAt: s.lastUsedAt.toISOString(),
      online: s.status === "active" && now - s.lastUsedAt.getTime() <= ONLINE_WINDOW_MS,
      userAgent: s.userAgent,
      activeSessions: active.find((a) => a.userId === s.userId)?._count._all ?? 0,
    });
  }
  return result;
}

export async function GET(req: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
  const url = new URL(req.url);
  const search = (url.searchParams.get("search") || "").trim();
  const activityParam = url.searchParams.get("activity");
  const onboardingParam = url.searchParams.get("onboarding");
  const activity = (["online", "today", "week", "inactive"] as const).find((a) => a === activityParam) ?? null;
  const onboarding = (["done", "in_progress", "not_started"] as const).find((o) => o === onboardingParam) ?? null;
  const now = Date.now();

  const filters: Prisma.UserWhereInput[] = [];
  if (search) {
    filters.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ],
    });
  }
  const byActivity = activityWhere(activity, now);
  if (byActivity) filters.push(byActivity);
  const byOnboarding = onboardingWhere(onboarding);
  if (byOnboarding) filters.push(byOnboarding);
  const where: Prisma.UserWhereInput = filters.length ? { AND: filters } : {};

  const [users, total, allUsers, onlineNow, activeToday, onboardingDone, onboardingInProgress] = await Promise.all([
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
        onboardingCompleted: true,
        onboardingStep: true,
        onboardingStepAt: true,
        resumeFileName: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
    prisma.user.count(),
    prisma.user.count({ where: activityWhere("online", now)! }),
    prisma.user.count({ where: activityWhere("today", now)! }),
    prisma.user.count({ where: onboardingWhere("done")! }),
    prisma.user.count({ where: onboardingWhere("in_progress")! }),
  ]);

  const ids = users.map((u) => u.id);
  const [methods, sessions] = await Promise.all([registerMethods(ids), lastSessions(ids, now)]);

  return ok("Users fetched", {
    users: users.map((u) => {
      const session = sessions.get(u.id);
      return {
        ...u,
        resumeFileName: undefined,
        hasResume: Boolean(u.resumeFileName),
        registerMethod: methods.get(u.id) ?? "unknown",
        lastSeenAt: session?.lastSeenAt ?? null,
        online: session?.online ?? false,
        lastDevice: session?.userAgent ?? null,
        activeSessions: session?.activeSessions ?? 0,
      };
    }),
    summary: { total: allUsers, onlineNow, activeToday, onboardingDone, onboardingInProgress },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
