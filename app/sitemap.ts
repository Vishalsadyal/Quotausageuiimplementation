import type { MetadataRoute } from "next";
import { STATIC_BLOG_POSTS } from "../src/content/blogPosts";
import { prisma } from "../src/lib/prisma";

const BASE_URL = "https://www.autoapplycv.in";

// Bump this when the marketing pages' content changes, so Google sees a real
// last-modified date instead of a timestamp that changes on every request.
const PAGES_UPDATED_AT = new Date("2026-10-06T00:00:00Z");

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

const PAGES: Array<[path: string, changeFrequency: ChangeFrequency, priority: number]> = [
  ["/", "daily", 1.0],
  ["/recruitment-agency", "daily", 0.95],
  ["/auto-apply-linkedin", "daily", 0.9],
  ["/auto-apply-jobs", "daily", 0.9],
  ["/auto-apply-chrome-extension", "daily", 0.9],
  ["/auto-apply", "weekly", 0.9],
  ["/pricing", "weekly", 0.9],
  ["/blog", "daily", 0.85],
  ["/features", "weekly", 0.8],
  ["/product", "weekly", 0.8],
  ["/how-it-works", "weekly", 0.8],
  ["/roadmap", "weekly", 0.7],
  ["/about", "monthly", 0.7],
  ["/contact", "monthly", 0.7],
  ["/faq", "monthly", 0.7],
  ["/help-center", "monthly", 0.7],
  ["/community", "weekly", 0.6],
  ["/careers", "monthly", 0.6],
  ["/press-kit", "monthly", 0.5],
  ["/privacy-policy", "yearly", 0.4],
  ["/terms-of-service", "yearly", 0.4],
  ["/cookie-policy", "yearly", 0.4],
];

// Re-generate hourly so newly published database posts are picked up.
export const revalidate = 3600;

async function publishedDatabasePosts(): Promise<Array<{ slug: string; updatedAt: Date }>> {
  try {
    return await prisma.blogPost.findMany({
      where: { status: "published", OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] },
      select: { slug: true, updatedAt: true },
    });
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = PAGES.map(([path, changeFrequency, priority]) => ({
    url: `${BASE_URL}${path}`,
    lastModified: PAGES_UPDATED_AT,
    changeFrequency,
    priority,
  }));

  const blogBySlug = new Map<string, Date>();
  for (const post of STATIC_BLOG_POSTS) blogBySlug.set(post.slug, new Date(post.publishedAt));
  for (const post of await publishedDatabasePosts()) blogBySlug.set(post.slug.toLowerCase(), post.updatedAt);

  const posts: MetadataRoute.Sitemap = [...blogBySlug.entries()].map(([slug, lastModified]) => ({
    url: `${BASE_URL}/blog/${slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...pages, ...posts];
}
