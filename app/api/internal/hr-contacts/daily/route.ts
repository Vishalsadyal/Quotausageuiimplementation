import { NextRequest } from "next/server";
import { prisma } from "src/lib/prisma";
import { fail, handleApiError, ok } from "src/lib/api";
import { logError, logInfo } from "src/lib/log";
import { assignDailyContacts, istDay, sendDailyContactsEmail } from "src/lib/hr-contacts";
import { expireDuePlans } from "src/lib/plan-access";

/**
 * POST /api/internal/hr-contacts/daily   (header x-worker-secret: WORKER_SECRET)
 *
 * Run once every morning (e.g. 03:30 UTC = 9 AM IST): ends timed plans that ran out, then gives every Pro Connect user today's 20
 * contacts and emails them the list. Safe to re-run: assignment tops up to 20 and each contact is
 * emailed once. Users who open the page before the job runs get their contacts assigned there.
 */
function isAuthorized(req: NextRequest) {
  const secret = process.env.WORKER_SECRET;
  return Boolean(secret) && req.headers.get("x-worker-secret") === secret;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) return fail("Unauthorized worker call", 401, "UNAUTHORIZED");

    // End timed plans that ran out (also done lazily when a user is active), then deliver contacts.
    const plansExpired = await expireDuePlans();
    const day = istDay();
    const users = await prisma.user.findMany({ where: { plan: "connect" }, select: { id: true } });
    let assigned = 0;
    let emailed = 0;
    let failed = 0;
    for (const user of users) {
      try {
        assigned += await assignDailyContacts(user.id, day);
        emailed += await sendDailyContactsEmail(user.id, day);
      } catch (error) {
        failed++;
        logError(`HR contacts daily run failed for user ${user.id}`, "hr-contacts-daily", error);
      }
    }
    logInfo(`HR contacts ${day}: users=${users.length} assigned=${assigned} emailed=${emailed} failed=${failed}`, "hr-contacts-daily");
    return ok("HR contacts daily run complete", { day, plansExpired, users: users.length, assigned, emailed, failed });
  } catch (error) {
    return handleApiError(error, "HR contacts daily run failed");
  }
}
