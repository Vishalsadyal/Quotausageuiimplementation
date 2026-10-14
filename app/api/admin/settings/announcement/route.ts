import { requireAdmin } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { writeAuditLog } from "src/lib/audit";
import { ANNOUNCEMENT_ACTION, announcementSchema, getAnnouncementConfig } from "src/lib/site-announcement";

/** GET /api/admin/settings/announcement: current promo bar settings. */
export async function GET() {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    return ok("Announcement settings", { announcement: await getAnnouncementConfig() });
  } catch (error) {
    return handleApiError(error, "Failed to load announcement settings");
  }
}

/** PUT /api/admin/settings/announcement: save promo bar settings (logged as an audit entry). */
export async function PUT(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const parsed = announcementSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid settings", 400, "VALIDATION_ERROR");
    const value = parsed.data;
    if (value.startsAt && value.endsAt && new Date(value.endsAt) <= new Date(value.startsAt)) {
      return fail("End date must be after start date", 400, "VALIDATION_ERROR");
    }
    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: ANNOUNCEMENT_ACTION,
      targetType: "site_config",
      targetId: "announcement",
      metadataJson: value,
    });
    return ok("Announcement saved", { announcement: value });
  } catch (error) {
    return handleApiError(error, "Failed to save announcement settings");
  }
}
