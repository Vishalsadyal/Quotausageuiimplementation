import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { approveHeldReferral } from "src/lib/referrals";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/referrals?q=
 * Top referrers (signups, counted, held, rewards) and referrals held for review: the friend
 * finished onboarding but shares an IP with the referrer, so it was not counted automatically.
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const q = (req.nextUrl.searchParams.get("q") || "").trim();

    const referrers = await prisma.user.findMany({
      where: {
        referrals: { some: {} },
        ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { referralCode: q.toUpperCase() }] } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        referralCode: true,
        plan: true,
        planExpiresAt: true,
        referrals: { select: { referralQualifiedAt: true, onboardingCompleted: true } },
        referralRewards: { select: { status: true } },
      },
      take: 200,
    });
    const rows = referrers
      .map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        code: r.referralCode,
        plan: r.plan,
        planExpiresAt: r.planExpiresAt,
        signedUp: r.referrals.length,
        counted: r.referrals.filter((f) => f.referralQualifiedAt).length,
        held: r.referrals.filter((f) => !f.referralQualifiedAt && f.onboardingCompleted).length,
        rewards: r.referralRewards.length,
        rewardsPending: r.referralRewards.filter((w) => w.status === "pending").length,
      }))
      .sort((a, b) => b.counted - a.counted || b.signedUp - a.signedUp);

    const held = await prisma.user.findMany({
      where: { referredById: { not: null }, referralQualifiedAt: null, onboardingCompleted: true },
      orderBy: { referredAt: "desc" },
      take: 100,
      select: { id: true, name: true, email: true, referredAt: true, referredBy: { select: { name: true, email: true } } },
    });

    return ok("Referrals", { referrers: rows, held });
  } catch (error) {
    return handleApiError(error, "Failed to load referrals");
  }
}

const approveSchema = z.object({ userId: z.string().min(5).max(60) });

/** POST /api/admin/referrals  { userId }: count a held referral (logged with the admin's id). */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { userId } = approveSchema.parse(await req.json().catch(() => ({})));
    const approved = await approveHeldReferral(userId, authResult.auth.user.id);
    if (!approved) return fail("This referral can't be approved (not held, or already counted)", 400, "NOT_HELD");
    return ok("Referral approved", { userId });
  } catch (error) {
    return handleApiError(error, "Failed to approve referral");
  }
}
