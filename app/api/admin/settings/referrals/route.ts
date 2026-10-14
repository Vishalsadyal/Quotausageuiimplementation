import { requireAdmin } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { writeAuditLog } from "src/lib/audit";
import { REFERRAL_CONFIG_ACTION, getReferralConfig, referralConfigSchema } from "src/lib/referrals";

/** GET /api/admin/settings/referrals: current referral reward rules. */
export async function GET() {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    return ok("Referral settings", { config: await getReferralConfig() });
  } catch (error) {
    return handleApiError(error, "Failed to load referral settings");
  }
}

/** PUT /api/admin/settings/referrals: save the rules (logged as an audit entry). */
export async function PUT(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const parsed = referralConfigSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid settings", 400, "VALIDATION_ERROR");
    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: REFERRAL_CONFIG_ACTION,
      targetType: "site_config",
      targetId: "referrals",
      metadataJson: parsed.data,
    });
    return ok("Referral settings saved", { config: parsed.data });
  } catch (error) {
    return handleApiError(error, "Failed to save referral settings");
  }
}
