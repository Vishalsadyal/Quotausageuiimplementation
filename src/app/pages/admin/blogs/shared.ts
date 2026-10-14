export type BlogStatus = "draft" | "published";
export type BlogFilter = "all" | BlogStatus;

export type BlogSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImage?: string | null;
  status: BlogStatus;
  socialAutoPostEnabled: boolean;
  facebookPostId?: string | null;
  facebookPostedAt?: string | null;
  facebookPostError?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  author?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

export type BlogDetail = BlogSummary & {
  contentHtml: string;
  keywordsJson?: unknown;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  category?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  noindex?: boolean;
};

export type BlogForm = {
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  contentHtml: string;
  keywords: string;
  status: BlogStatus;
  socialAutoPostEnabled: boolean;
  // SEO, call to action, scheduling
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  category: string;
  ctaLabel: string;
  ctaHref: string;
  noindex: boolean;
  /** datetime-local value; empty = publish now */
  publishAt: string;
};

export const EMPTY_FORM: BlogForm = {
  title: "",
  slug: "",
  excerpt: "",
  coverImage: "",
  contentHtml: "<p></p>",
  keywords: "",
  status: "draft",
  socialAutoPostEnabled: false,
  metaTitle: "",
  metaDescription: "",
  canonicalUrl: "",
  category: "",
  ctaLabel: "",
  ctaHref: "",
  noindex: false,
  publishAt: "",
};

export function keywordsFromJson(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(", ");
}

export function parseKeywordsInput(value: string) {
  return String(value || "")
    .split(/[,\n]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function formatBlogDate(value?: string | null) {
  if (!value) return "Not published";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
