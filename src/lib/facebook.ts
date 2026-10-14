import { prisma } from "./prisma";
import { getFacebookPublishIntegration } from "./social-integrations";

type FacebookPublishCandidate = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  status: "draft" | "published";
  socialAutoPostEnabled: boolean;
  facebookPostId?: string | null;
  facebookPostedAt?: Date | null;
  facebookPostError?: string | null;
  publishedAt?: Date | null;
};

export type FacebookPublishResult = {
  attempted: boolean;
  ok: boolean;
  skippedReason?: string;
  error?: string;
  facebookPostId?: string;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isLocalHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.endsWith(".local");
}

export function resolvePublicBlogUrl(req: Request, slug: string) {
  const configuredBase =
    String(process.env.APP_SITE_URL || "").trim() ||
    String(process.env.NEXT_PUBLIC_SITE_URL || "").trim() ||
    String(process.env.VITE_SITE_URL || "").trim();
  const origin = configuredBase || new URL(req.url).origin;
  const url = new URL(`/blog/${slug}`, trimTrailingSlash(origin));

  if (isLocalHost(url.hostname)) {
    throw new Error("Facebook auto-post requires a public APP_SITE_URL; localhost URLs cannot be shared");
  }

  return url.toString();
}

function buildFacebookMessage(post: FacebookPublishCandidate, absoluteUrl: string) {
  const parts = [post.title.trim(), String(post.excerpt || "").trim(), absoluteUrl].filter(Boolean);
  return parts.join("\n\n").slice(0, 1800);
}

export async function publishBlogToFacebookPage(req: Request, post: FacebookPublishCandidate): Promise<FacebookPublishResult> {
  if (post.status !== "published") {
    return { attempted: false, ok: false, skippedReason: "post_not_published" };
  }
  if (post.publishedAt && post.publishedAt > new Date()) {
    // Scheduled for later: the link would 404 until then.
    return { attempted: false, ok: false, skippedReason: "scheduled" };
  }
  if (!post.socialAutoPostEnabled) {
    return { attempted: false, ok: false, skippedReason: "autopost_disabled" };
  }
  if (post.facebookPostId) {
    return { attempted: false, ok: false, skippedReason: "already_posted" };
  }

  try {
    const integration = await getFacebookPublishIntegration();
    if (integration.source === "admin" && !integration.enabled) {
      return { attempted: true, ok: false, error: "Facebook integration is disabled in Admin Settings" };
    }
    if (!integration.configured || !integration.pageId || !integration.pageAccessToken) {
      return {
        attempted: true,
        ok: false,
        error: "Facebook Page credentials are not configured. Save them in Admin Settings > Social Integrations",
      };
    }

    const pageId = integration.pageId;
    const accessToken = integration.pageAccessToken;
    const apiVersion = String(process.env.FACEBOOK_GRAPH_API_VERSION || "").trim() || "v23.0";
    const link = resolvePublicBlogUrl(req, post.slug);

    const body = new URLSearchParams();
    body.set("message", buildFacebookMessage(post, link));
    body.set("link", link);
    body.set("access_token", accessToken);

    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${pageId}/feed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });

    const data = (await response.json().catch(() => null)) as
      | { id?: string; error?: { message?: string }; message?: string }
      | null;

    if (!response.ok || !data?.id) {
      return {
        attempted: true,
        ok: false,
        error:
          String(data?.error?.message || data?.message || "").trim() ||
          `Facebook publish failed with status ${response.status}`,
      };
    }

    return {
      attempted: true,
      ok: true,
      facebookPostId: String(data.id),
    };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      error: error instanceof Error ? error.message : "Facebook publish failed",
    };
  }
}

export async function syncFacebookPublishState<T extends FacebookPublishCandidate>(
  req: Request,
  post: T,
) {
  const result = await publishBlogToFacebookPage(req, post);
  if (!result.attempted) return { post, result };

  if (!result.ok) {
    const nextPost = await prisma.blogPost.update({
      where: { id: post.id },
      data: {
        facebookPostError: String(result.error || "Facebook publish failed").slice(0, 1000),
      },
    });
    return { post: nextPost as unknown as T, result };
  }

  const nextPost = await prisma.blogPost.update({
    where: { id: post.id },
    data: {
      facebookPostId: result.facebookPostId || null,
      facebookPostedAt: new Date(),
      facebookPostError: null,
    },
  });
  return { post: nextPost as unknown as T, result };
}
