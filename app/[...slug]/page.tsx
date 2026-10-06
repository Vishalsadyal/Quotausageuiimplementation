import type { Metadata } from "next";
import { notFound } from "next/navigation";
import App from "../../src/app/App";
import { OG_IMAGE, canonicalForPath, resolveSeo } from "../../src/app/seo/seoConfig";
import { blogSlugFromPath, isKnownAppPath, prerenderedAppPaths } from "../../src/app/seo/routes";
import { STATIC_BLOG_POSTS, STATIC_BLOG_POSTS_BY_SLUG } from "../../src/content/blogPosts";
import { prisma } from "../../src/lib/prisma";

// Build every public page and bundled blog post ahead of time so they are
// served from cache. Other paths (database posts, dashboard) render on demand.
export function generateStaticParams() {
  const pages = prerenderedAppPaths().map((path) => ({ slug: path.slice(1).split("/") }));
  const posts = STATIC_BLOG_POSTS.map((post) => ({ slug: ["blog", post.slug] }));
  return [...pages, ...posts];
}

// Re-render cached pages at most hourly, e.g. after a database post changes.
export const revalidate = 3600;

async function isPublishedBlogSlug(slug: string): Promise<boolean> {
  if (STATIC_BLOG_POSTS_BY_SLUG[slug]) return true;
  try {
    const post = await prisma.blogPost.findUnique({
      where: { slug },
      select: { status: true, publishedAt: true },
    });
    return Boolean(post && post.status === "published" && (!post.publishedAt || post.publishedAt <= new Date()));
  } catch {
    // If the database is unreachable, keep serving the page rather than
    // dropping a real post from the index.
    return true;
  }
}

async function routeExists(pathname: string): Promise<boolean> {
  if (isKnownAppPath(pathname)) return true;
  const slug = blogSlugFromPath(pathname);
  return slug ? isPublishedBlogSlug(slug) : false;
}

function breadcrumbsFor(pathname: string, pageTitle: string) {
  const crumbs = [{ name: "Home", url: canonicalForPath("/") }];
  if (pathname.startsWith("/blog/")) crumbs.push({ name: "Blog", url: canonicalForPath("/blog") });
  // Page titles read "Name | AutoApply CV"; the part before the separator is the crumb label.
  crumbs.push({ name: pageTitle.split(" | ")[0].trim(), url: canonicalForPath(pathname) });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

async function pathnameFromParams(params?: Promise<{ slug?: string[] }>) {
  const resolvedParams = params ? await params : {};
  return `/${(resolvedParams.slug || []).join("/")}`;
}

export async function generateMetadata({ params }: { params?: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const pathname = await pathnameFromParams(params);
  if (!(await routeExists(pathname))) notFound();
  const seo = resolveSeo(pathname === "/" ? "/" : pathname);
  const canonical = canonicalForPath(pathname);

  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical },
    robots: seo.index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: canonical,
      type: "website",
      siteName: "AutoApply CV",
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [OG_IMAGE.url],
    },
  };
}

export default async function CatchAllPage({ params }: { params?: Promise<{ slug?: string[] }> }) {
  const pathname = await pathnameFromParams(params);
  if (!(await routeExists(pathname))) notFound();
  const seo = resolveSeo(pathname === "/" ? "/" : pathname);
  const pageData = seo.structuredData ? (Array.isArray(seo.structuredData) ? seo.structuredData : [seo.structuredData]) : [];
  const structuredData = seo.index ? [...pageData, breadcrumbsFor(pathname, seo.title)] : pageData;

  return (
    <>
      {structuredData.length ? (
        <script
          id="careerpilot-structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      ) : null}
      <App initialPathname={pathname === "/" ? "/" : pathname} />
    </>
  );
}
