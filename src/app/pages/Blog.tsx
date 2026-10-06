import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, BookOpen, CalendarDays, Loader2, Search, Target } from "lucide-react";
import { STATIC_BLOG_POSTS } from "src/content/blogPosts";

type PublicBlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImage?: string | null;
  keywordsJson?: unknown;
  publishedAt?: string | null;
  createdAt: string;
};

type BlogCard = {
  title: string;
  description: string;
  slug: string;
  keyword: string;
  coverImage?: string | null;
  publishedAt?: string | null;
};

function firstKeyword(value: unknown) {
  if (!Array.isArray(value)) return "";
  const first = value.find((item) => String(item || "").trim());
  return String(first || "").trim();
}

export default function Blog() {
  const navigate = useNavigate();
  // Seed from bundled posts so the list and its links are in the server-rendered HTML.
  const [posts, setPosts] = useState<PublicBlogPost[]>(STATIC_BLOG_POSTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const res = await fetch("/api/public/blogs?limit=50");
        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.message || "Failed to load blog posts");
        }
        const nextPosts = Array.isArray(data?.data?.posts) ? (data.data.posts as PublicBlogPost[]) : [];
        setPosts(nextPosts);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load blog posts");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const cards = useMemo<BlogCard[]>(() => {
    return posts.map((post) => ({
      title: post.title,
      description: post.excerpt || "Read this guide on job search automation and interview outcomes.",
      slug: post.slug,
      keyword: firstKeyword(post.keywordsJson) || "job search automation",
      coverImage: post.coverImage || null,
      publishedAt: post.publishedAt || post.createdAt,
    }));
  }, [posts]);

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((card) => {
      return (
        card.title.toLowerCase().includes(q) ||
        card.description.toLowerCase().includes(q) ||
        card.slug.toLowerCase().includes(q) ||
        card.keyword.toLowerCase().includes(q)
      );
    });
  }, [cards, searchQuery]);

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full text-purple-700 text-sm font-semibold mb-6">
            <BookOpen className="w-4 h-4" />
            SEO Guides
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Job Search Automation{' '}
            <span className="bg-[#6047f5] bg-clip-text text-transparent">
              Blog
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Learn how to use LinkedIn auto apply workflows, AI resume builder tactics, and job application tracking to get more interviews.
          </p>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Latest Guides</h2>
              <p className="text-gray-600 mt-1">Actionable content for faster interview callbacks.</p>
            </div>
            <div className="relative w-full md:w-[360px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search blogs..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 outline-none"
              />
            </div>
          </div>

          {loading ? (
            <div className="mb-8 text-sm text-gray-500 inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading latest blog posts...
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
              {error}
            </div>
          ) : null}

          {filteredCards.length === 0 && !loading && !error ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-10 text-center text-gray-600">
              {searchQuery ? `No blog posts found for "${searchQuery}".` : "No published blog posts yet."}
            </div>
          ) : null}

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-7">
            {filteredCards.map((post) => (
              <article
                key={`${post.slug}-${post.title}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white hover:border-purple-300 hover:shadow-xl transition-all duration-200"
              >
                {post.coverImage ? (
                  <div className="h-44 overflow-hidden bg-gray-100">
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : null}
                {!post.coverImage ? (
                  <div className="h-44 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-b border-gray-100 flex items-center justify-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                      <BookOpen className="w-3 h-3" />
                      {post.keyword}
                    </div>
                  </div>
                ) : null}

                <div className="flex-1 flex flex-col p-6">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                      <Search className="w-3 h-3" />
                      {post.keyword}
                    </div>
                    {post.publishedAt ? (
                      <div className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {new Date(post.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}
                      </div>
                    ) : null}
                  </div>

                  <h2 className="text-xl font-bold text-gray-900 leading-snug mb-3">{post.title}</h2>
                  <p className="text-gray-600 leading-relaxed flex-1">{post.description}</p>

                  <Link
                    to={`/blog/${post.slug}`}
                    className="mt-5 inline-flex items-center gap-2 text-purple-700 font-semibold hover:text-purple-800"
                  >
                    Read guide
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-gray-50 to-purple-50">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full text-purple-700 text-sm font-semibold mb-6">
            <Target className="w-4 h-4" />
            Next Step
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-5">Put these tactics into action</h2>
          <p className="text-xl text-gray-600 mb-10">
            Use AutoApply CV to apply to LinkedIn jobs automatically, optimize your resume for ATS, and track outcomes in one dashboard.
          </p>
          <button
            onClick={() => navigate('/pricing')}
            className="px-10 py-4 bg-[#6047f5] text-white rounded-xl font-bold text-lg hover:shadow-xl"
          >
            Start Free
          </button>
        </div>
      </section>
    </div>
  );
}
