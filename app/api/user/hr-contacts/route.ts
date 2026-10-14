import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "src/lib/guards";
import { ok, fail, handleApiError } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { hasHrContacts } from "src/lib/plans";
import {
  DAILY_LIMIT,
  DELIVERY_SELECT,
  assignDailyContacts,
  istDay,
  userRoleKeywords,
} from "src/lib/hr-contacts";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/hr-contacts?history=1
 *
 * Pro Connect: today's contacts (assigned on first open of the day if the daily job has not run
 * yet) plus, with history=1, earlier days. Other plans: a locked preview with counts only (no
 * phone numbers or emails), to show what upgrading unlocks.
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, shareOutreachContacts: true, hrContactsDailyEmail: true },
    });
    if (!user) return fail("User not found", 404, "USER_NOT_FOUND");
    const settings = { shareOutreachContacts: user.shareOutreachContacts, dailyEmail: user.hrContactsDailyEmail };

    if (!hasHrContacts(user.plan)) {
      // Locked: how many fresh contacts match this user's roles, plus a few role/company teasers.
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recent = await prisma.hrContact.findMany({
        where: { lastSeenAt: { gte: since } },
        orderBy: { lastSeenAt: "desc" },
        take: 300,
        select: { jobTitle: true, company: true, keywords: true },
      });
      const wanted = await userRoleKeywords(userId);
      const matching = recent.filter((c) => !wanted.size || c.keywords.split(" ").some((w) => wanted.has(w)));
      return ok("HR Contacts locked", {
        unlocked: false,
        dailyLimit: DAILY_LIMIT,
        settings,
        preview: {
          freshThisWeek: recent.length,
          matchingYourRoles: matching.length,
          samples: matching.slice(0, 6).map((c) => ({ jobTitle: c.jobTitle, company: c.company })),
        },
      });
    }

    const day = istDay();
    await assignDailyContacts(userId, day);
    const today = await prisma.hrContactDelivery.findMany({
      where: { userId, day },
      orderBy: { createdAt: "asc" },
      select: DELIVERY_SELECT,
    });
    const history = req.nextUrl.searchParams.get("history")
      ? await prisma.hrContactDelivery.findMany({
          where: { userId, day: { not: day } },
          orderBy: [{ day: "desc" }, { createdAt: "asc" }],
          take: 300,
          select: DELIVERY_SELECT,
        })
      : [];

    return ok("HR Contacts", {
      unlocked: true,
      day,
      dailyLimit: DAILY_LIMIT,
      settings,
      roles: Array.from(await userRoleKeywords(userId)).slice(0, 12),
      today,
      history,
    });
  } catch (error) {
    return handleApiError(error, "Failed to load HR contacts");
  }
}

const settingsSchema = z.object({
  shareOutreachContacts: z.boolean().optional(),
  dailyEmail: z.boolean().optional(),
});

/** PATCH /api/user/hr-contacts  { shareOutreachContacts?, dailyEmail? } */
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const body = settingsSchema.parse(await req.json().catch(() => ({})));
    const user = await prisma.user.update({
      where: { id: authResult.auth.user.id },
      data: {
        ...(body.shareOutreachContacts === undefined ? {} : { shareOutreachContacts: body.shareOutreachContacts }),
        ...(body.dailyEmail === undefined ? {} : { hrContactsDailyEmail: body.dailyEmail }),
      },
      select: { shareOutreachContacts: true, hrContactsDailyEmail: true },
    });
    return ok("Settings saved", { settings: { shareOutreachContacts: user.shareOutreachContacts, dailyEmail: user.hrContactsDailyEmail } });
  } catch (error) {
    return handleApiError(error, "Failed to save HR contacts settings");
  }
}
