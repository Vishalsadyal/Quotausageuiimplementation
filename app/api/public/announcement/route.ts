import { ok, handleApiError } from "src/lib/api";
import { activeAnnouncement, getAnnouncementConfig } from "src/lib/site-announcement";

export const dynamic = "force-dynamic";

/** GET /api/public/announcement: the site promo bar to show now, or null. */
export async function GET() {
  try {
    const current = activeAnnouncement(await getAnnouncementConfig());
    const res = ok("Announcement", {
      announcement: current
        ? { text: current.text, code: current.code, ctaLabel: current.ctaLabel, ctaHref: current.ctaHref, endsAt: current.endsAt }
        : null,
    });
    res.headers.set("cache-control", "public, max-age=60, s-maxage=60");
    return res;
  } catch (error) {
    return handleApiError(error, "Failed to load announcement");
  }
}
