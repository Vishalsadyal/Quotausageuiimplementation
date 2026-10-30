import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, ArrowRight, CalendarDays, Folder, User } from "lucide-react";
import { STATIC_BLOG_POSTS, STATIC_BLOG_POSTS_BY_SLUG } from "src/content/blogPosts";
import { applyPageSeo } from "../components/SeoManager";
import { canonicalForPath } from "../seo/seoConfig";

// Shown under every article unless the post sets its own call to action in the admin editor.
const DEFAULT_CTA = { label: "Explore Pro Connect", href: "/pricing" };

type PublicBlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImage?: string | null;
  contentHtml: string;
  keywordsJson?: unknown;
  publishedAt?: string | null;
  createdAt: string;
  author?: {
    name?: string | null;
  } | null;
  // Admin CMS posts only
  category?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  noindex?: boolean;
};

function toKeywordList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 12);
}

// Words shared between slugs/keywords decide which posts are related; filler words don't count.
const STOP_WORDS = new Set(["auto", "apply", "the", "and", "for", "to", "a", "of", "vs", "how", "what", "best", "2026"]);

function topicWords(post: { slug: string; keywordsJson?: unknown }) {
  const words = [post.slug, ...toKeywordList(post.keywordsJson)].join(" ").toLowerCase().split(/[^a-z0-9]+/);
  return new Set(words.filter((word) => word.length > 1 && !STOP_WORDS.has(word)));
}

// How many bundled posts use each topic word: rare words say more about a post than common ones.
const WORD_POST_COUNT = new Map<string, number>();
for (const item of STATIC_BLOG_POSTS) {
  for (const word of topicWords(item)) WORD_POST_COUNT.set(word, (WORD_POST_COUNT.get(word) || 0) + 1);
}

// Up to 4 bundled posts: the 3 closest topics plus the next post in the list, so every article
// links to others (and is linked from at least one) in the server HTML.
function relatedPosts(post: { slug: string; keywordsJson?: unknown }) {
  const words = topicWords(post);
  const position = STATIC_BLOG_POSTS.findIndex((item) => item.slug === post.slug);
  const next = STATIC_BLOG_POSTS[(position + 1) % STATIC_BLOG_POSTS.length];
  const closest = STATIC_BLOG_POSTS.filter((other) => other.slug !== post.slug && other.slug !== next.slug)
    .map((other, index) => {
      let score = 0;
      for (const word of topicWords(other)) if (words.has(word)) score += 1 / (WORD_POST_COUNT.get(word) || 1);
      return { other, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .map(({ other }) => other);
  return next.slug === post.slug ? closest : [...closest, next];
}

export default function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  // Seed from bundled posts so the article is in the server-rendered HTML.
  const staticPost = STATIC_BLOG_POSTS_BY_SLUG[String(slug || "").trim().toLowerCase()] as PublicBlogPost | undefined;
  const [post, setPost] = useState<PublicBlogPost | null>(staticPost || null);
  const [loading, setLoading] = useState(!staticPost);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const cleanSlug = String(slug || "").trim();
      if (!cleanSlug) {
        setError("Blog post not found.");
        setLoading(false);
        return;
      }
      try {
        if (!STATIC_BLOG_POSTS_BY_SLUG[cleanSlug.toLowerCase()]) setLoading(true);
        setError("");
        const res = await fetch(`/api/public/blogs/${encodeURIComponent(cleanSlug)}`);
        const data = await res.json();
        if (!res.ok || !data?.success) throw new Error(data?.message || "Blog post not found");
        const payload = data?.data?.post as PublicBlogPost;
        setPost(payload || null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Blog post not found");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [slug]);

  const keywords = useMemo(() => toKeywordList(post?.keywordsJson), [post?.keywordsJson]);
  const related = useMemo(() => (post ? relatedPosts(post) : []), [post]);

  // Admin-written posts set their own SEO tags (bundled posts are handled by SeoManager).
  useEffect(() => {
    if (!post || staticPost) return;
    applyPageSeo({
      title: `${(post.metaTitle || post.title).trim()} | AutoApply CV`,
      description: (post.metaDescription || post.excerpt || post.title).trim().slice(0, 170),
      canonical: post.canonicalUrl || canonicalForPath(`/blog/${post.slug}`),
      index: !post.noindex,
      image: post.coverImage ? new URL(post.coverImage, window.location.origin).toString() : null,
    });
  }, [post, staticPost]);

  const cta = post?.ctaLabel && post?.ctaHref ? { label: post.ctaLabel, href: post.ctaHref } : DEFAULT_CTA;
  const publishedLabel = post?.publishedAt || post?.createdAt
    ? new Date(String(post?.publishedAt || post?.createdAt)).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
    : "";

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-gray-600">Loading blog post...</div>;
  }

  if (error || !post) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="max-w-lg w-full rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Blog Post Not Found</h1>
          <p className="text-gray-600 mb-6">{error || "The requested blog post is not available."}</p>
          <button
            onClick={() => navigate("/blog")}
            className="px-5 py-3 rounded-xl bg-[#6047f5] text-white font-semibold"
          >
            Back to Blog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <section className="bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-16 pb-10">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <button
            onClick={() => navigate("/blog")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-800 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </button>

          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">{post.title}</h1>

          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" />
              {publishedLabel}
            </span>
            {post.category ? (
              <span className="inline-flex items-center gap-1.5">
                <Folder className="w-4 h-4" />
                {post.category}
              </span>
            ) : null}
            {post.author?.name ? (
              <span className="inline-flex items-center gap-1.5">
                <User className="w-4 h-4" />
                {post.author.name}
              </span>
            ) : null}
          </div>

          {keywords.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700"
                >
                  {keyword}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="py-10">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          {post.coverImage ? (
            <div className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
              <img src={post.coverImage} alt={post.title} className="w-full h-auto object-cover" />
            </div>
          ) : null}
          <article
            className="blog-rich-content text-gray-800"
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />

          <aside className="mt-12 flex flex-col items-start gap-4 rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-bold text-gray-900">Apply smarter, not harder</p>
              <p className="mt-1 text-sm text-gray-600">AutoApply CV fills applications for you and helps you reach recruiters directly.</p>
            </div>
            {cta.href.startsWith("https://") ? (
              <a href={cta.href} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#6047f5] px-5 py-3 font-semibold text-white hover:bg-[#4f38e0]">
                {cta.label} <ArrowRight className="h-4 w-4" />
              </a>
            ) : (
              <Link to={cta.href} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#6047f5] px-5 py-3 font-semibold text-white hover:bg-[#4f38e0]">
                {cta.label} <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </aside>

          {related.length ? (
            <nav aria-label="Related articles" className="mt-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Related articles</h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {related.map((item) => (
                  <li key={item.slug}>
                    <Link
                      to={`/blog/${item.slug}`}
                      className="block h-full rounded-2xl border border-gray-200 p-5 hover:border-purple-300 hover:bg-purple-50/40"
                    >
                      <span className="block font-semibold text-gray-900">{item.title}</span>
                      {item.excerpt ? <span className="mt-2 block text-sm text-gray-600 line-clamp-2">{item.excerpt}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </section>
    </div>
  );
}
