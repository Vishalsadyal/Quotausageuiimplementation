import { z } from "zod";

export function slugifyBlogTitle(input: string) {
  const base = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 160);
  return base || "post";
}

export function normalizeBlogKeywords(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const clean = String(item || "").trim().slice(0, 80);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out.slice(0, 20);
}

export function stripHtmlToText(html: string) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── SEO, call to action and scheduling (admin editor) ──────────────────────

const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalLink = z
  .string()
  .trim()
  .max(500)
  .refine((v) => !v || v.startsWith("/") || /^https:\/\//.test(v), "Links must start with / or https://")
  .optional();

/** Optional per-post SEO fields. Empty strings clear a field (fall back to title / excerpt). */
export const blogSeoFieldsSchema = z.object({
  metaTitle: optionalText(70),
  metaDescription: optionalText(170),
  canonicalUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https:\/\//.test(v), "Canonical URL must start with https://")
    .optional(),
  category: optionalText(60),
  ctaLabel: optionalText(40),
  ctaHref: optionalLink,
  noindex: z.boolean().optional(),
  /** ISO date-time. In the future = scheduled; omitted = now (on first publish). */
  publishAt: z.string().datetime().nullable().optional(),
});
export type BlogSeoFields = z.infer<typeof blogSeoFieldsSchema>;

/** Prisma data for the SEO fields that were sent (undefined = leave unchanged). */
export function blogSeoData(input: BlogSeoFields) {
  const text = (v: string | undefined) => (v === undefined ? undefined : v.trim() || null);
  return {
    metaTitle: text(input.metaTitle),
    metaDescription: text(input.metaDescription),
    canonicalUrl: text(input.canonicalUrl),
    category: text(input.category),
    ctaLabel: text(input.ctaLabel),
    ctaHref: text(input.ctaHref),
    noindex: input.noindex,
  };
}

/** When a post goes live: the scheduled time if given, else keep the existing date, else now. */
export function resolvePublishedAt(status: string, publishAt: string | null | undefined, existing: Date | null) {
  if (status !== "published") return null;
  if (publishAt) return new Date(publishAt);
  return existing || new Date();
}
