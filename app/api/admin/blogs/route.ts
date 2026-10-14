import { z } from "zod";
import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { fail, handleApiError, ok, parsePagination } from "src/lib/api";
import { writeAuditLog } from "src/lib/audit";
import { normalizeBlogKeywords, slugifyBlogTitle, stripHtmlToText, blogSeoData, blogSeoFieldsSchema, resolvePublishedAt } from "src/lib/blog";
import { syncFacebookPublishState } from "src/lib/facebook";

const createBlogSchema = z.object({
  title: z.string().trim().min(3).max(180),
  slug: z.string().trim().max(180).optional().default(""),
  excerpt: z.string().trim().max(400).optional().default(""),
  coverImage: z.string().trim().url().max(500).optional().or(z.literal("")).default(""),
  contentHtml: z.string().min(1),
  keywords: z.array(z.string().trim().max(80)).optional().default([]),
  status: z.enum(["draft", "published"]).default("draft"),
  socialAutoPostEnabled: z.boolean().optional().default(false),
}).merge(blogSeoFieldsSchema);

async function resolveUniqueSlug(baseSlug: string, excludeId = "") {
  const base = slugifyBlogTitle(baseSlug);
  let slug = base;
  let index = 2;
  while (index < 200) {
    const existing = await prisma.blogPost.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing || (excludeId && existing.id === excludeId)) return slug;
    const suffix = `-${index}`;
    slug = `${base.slice(0, Math.max(1, 160 - suffix.length))}${suffix}`;
    index += 1;
  }
  return `${base}-${Date.now().toString().slice(-6)}`;
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 25, maxLimit: 200 });

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        orderBy: [{ updatedAt: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          status: true,
          socialAutoPostEnabled: true,
          facebookPostId: true,
          facebookPostedAt: true,
          facebookPostError: true,
          publishedAt: true,
          noindex: true,
          category: true,
          createdAt: true,
          updatedAt: true,
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.blogPost.count(),
    ]);

    return ok("Blog posts fetched", {
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch blog posts");
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;

    const payload = createBlogSchema.parse(await req.json());
    const normalizedTitle = payload.title.trim();
    const normalizedContent = String(payload.contentHtml || "").trim();
    if (!normalizedContent) {
      return fail("Blog content is required", 400, "VALIDATION_ERROR");
    }

    const slugBase = payload.slug.trim() || normalizedTitle;
    const slug = await resolveUniqueSlug(slugBase);
    const excerpt =
      payload.excerpt.trim() || stripHtmlToText(normalizedContent).slice(0, 220);
    const keywords = normalizeBlogKeywords(payload.keywords);
    const status = payload.status;
    const socialAutoPostEnabled = payload.socialAutoPostEnabled;
    const publishedAt = resolvePublishedAt(status, payload.publishAt, null);

    let post = await prisma.blogPost.create({
      data: {
        title: normalizedTitle,
        slug,
        excerpt: excerpt || null,
        coverImage: payload.coverImage.trim() || null,
        contentHtml: normalizedContent,
        keywordsJson: keywords,
        status,
        socialAutoPostEnabled,
        publishedAt,
        ...blogSeoData(payload),
        authorId: authResult.auth.user.id,
      },
    });

    const facebookSync = await syncFacebookPublishState(req, post);
    post = facebookSync.post;

    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: "admin.blog_create",
      targetType: "blog_post",
      targetId: post.id,
      metadataJson: {
        slug: post.slug,
        status: post.status,
        socialAutoPostEnabled: post.socialAutoPostEnabled,
        facebookPostId: post.facebookPostId,
        facebookPostedAt: post.facebookPostedAt,
        facebookPostError: post.facebookPostError,
      },
    });

    const message =
      facebookSync.result.attempted && facebookSync.result.ok
        ? "Blog post created and posted to Facebook"
        : facebookSync.result.attempted && !facebookSync.result.ok
        ? `Blog post created, but Facebook auto-post failed: ${facebookSync.result.error}`
        : "Blog post created";

    return ok(message, { post, facebook: facebookSync.result }, 201);
  } catch (error) {
    return handleApiError(error, "Failed to create blog post");
  }
}
