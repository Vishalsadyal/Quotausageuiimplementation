import { Prisma } from "@prisma/client";
import { fail, handleApiError, ok } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { STATIC_BLOG_POSTS_BY_SLUG } from "src/content/blogPosts";

type RouteParams = {
  params: Promise<{ slug: string }>;
};

export async function GET(_req: Request, { params }: RouteParams) {
  let cleanSlug = "";
  try {
    const { slug } = await params;
    cleanSlug = String(slug || "").trim().toLowerCase();
    if (!cleanSlug) return fail("Blog slug is required", 400, "VALIDATION_ERROR");

    const now = new Date();
    const post = await prisma.blogPost.findUnique({
      where: { slug: cleanSlug },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        contentHtml: true,
        keywordsJson: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        category: true,
        ctaLabel: true,
        ctaHref: true,
        metaTitle: true,
        metaDescription: true,
        canonicalUrl: true,
        noindex: true,
        author: {
          select: {
            name: true,
          },
        },
        status: true,
      },
    });

    if (!post) {
      const fallback = STATIC_BLOG_POSTS_BY_SLUG[cleanSlug];
      if (fallback) {
        return ok("Public blog post fetched", {
          post: {
            id: fallback.id,
            title: fallback.title,
            slug: fallback.slug,
            excerpt: fallback.excerpt,
            coverImage: fallback.coverImage,
            contentHtml: fallback.contentHtml,
            keywordsJson: fallback.keywordsJson,
            publishedAt: fallback.publishedAt,
            createdAt: fallback.createdAt,
            author: fallback.author,
            status: "published",
          },
        });
      }
      return fail("Blog post not found", 404, "NOT_FOUND");
    }
    if (post.status !== "published") return fail("Blog post not found", 404, "NOT_FOUND");
    // Scheduled posts stay hidden until their publish time.
    if (post.publishedAt && post.publishedAt > now) return fail("Blog post not found", 404, "NOT_FOUND");
    if (post.publishedAt && post.publishedAt > now) return fail("Blog post not found", 404, "NOT_FOUND");

    return ok("Public blog post fetched", { post });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      return fail("Blog post not found", 404, "NOT_FOUND");
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      // Fallback to bundled static posts when DB isn't reachable.
      const fallback = STATIC_BLOG_POSTS_BY_SLUG[cleanSlug];
      if (fallback) {
        return ok("Public blog post fetched", {
          post: {
            id: fallback.id,
            title: fallback.title,
            slug: fallback.slug,
            excerpt: fallback.excerpt,
            coverImage: fallback.coverImage,
            contentHtml: fallback.contentHtml,
            keywordsJson: fallback.keywordsJson,
            publishedAt: fallback.publishedAt,
            createdAt: fallback.createdAt,
            author: fallback.author,
            status: "published",
          },
        });
      }
      return fail("Blog post not found", 404, "NOT_FOUND");
    }

    return handleApiError(error, "Failed to fetch public blog post");
  }
}
