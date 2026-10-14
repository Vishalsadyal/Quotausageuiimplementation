import { z } from "zod";
import { prisma } from "src/lib/prisma";

/**
 * The promo bar at the top of the public site, edited in Admin > Promotions. Saved as an audit-log
 * entry (latest wins), like the extension settings, so every change is also an audit record.
 */
export const ANNOUNCEMENT_ACTION = "site.announcement_updated";

export const announcementSchema = z.object({
  enabled: z.boolean(),
  text: z.string().trim().min(3).max(160),
  code: z.string().trim().max(32).default(""),
  ctaLabel: z.string().trim().max(40).default(""),
  ctaHref: z
    .string()
    .trim()
    .max(300)
    .refine((v) => !v || v.startsWith("/") || /^https:\/\//.test(v), "Link must start with / or https://")
    .default(""),
  startsAt: z.string().datetime().nullable().default(null),
  endsAt: z.string().datetime().nullable().default(null),
});

export type SiteAnnouncement = z.infer<typeof announcementSchema>;

export const DEFAULT_ANNOUNCEMENT: SiteAnnouncement = {
  enabled: true,
  text: "Special Offer: Get Pro Connect for ₹99 with code GOINDIA.",
  code: "GOINDIA",
  ctaLabel: "Claim offer",
  ctaHref: "/dashboard/billing?coupon=GOINDIA",
  startsAt: null,
  endsAt: null,
};

export async function getAnnouncementConfig(): Promise<SiteAnnouncement> {
  const latest = await prisma.auditLog.findFirst({
    where: { action: ANNOUNCEMENT_ACTION },
    orderBy: { createdAt: "desc" },
    select: { metadataJson: true },
  });
  const parsed = announcementSchema.safeParse(latest?.metadataJson);
  return parsed.success ? parsed.data : DEFAULT_ANNOUNCEMENT;
}

/** The announcement to show right now, or null when it is off or outside its dates. */
export function activeAnnouncement(config: SiteAnnouncement, now = new Date()) {
  if (!config.enabled) return null;
  if (config.startsAt && new Date(config.startsAt) > now) return null;
  if (config.endsAt && new Date(config.endsAt) <= now) return null;
  return config;
}
