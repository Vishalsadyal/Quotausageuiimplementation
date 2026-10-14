import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Loader2,
  Save,
  Share2,
  Trash2,
} from "lucide-react";
import ReactQuill from "react-quill-new";
import { slugifyBlogTitle, stripHtmlToText } from "src/lib/blog";
import {
  BlogDetail,
  BlogForm,
  EMPTY_FORM,
  formatBlogDate,
  keywordsFromJson,
  parseKeywordsInput,
} from "./blogs/shared";

// ISO -> value for <input type="datetime-local"> (local time).
function toLocalDateTime(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

type FlashState = {
  message?: string;
} | null;

export default function AdminBlogEditor() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState<BlogForm>(EMPTY_FORM);
  const [slugDirty, setSlugDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [postMeta, setPostMeta] = useState<
    Pick<
      BlogDetail,
      "createdAt" | "updatedAt" | "publishedAt" | "facebookPostId" | "facebookPostedAt" | "facebookPostError"
    > | null
  >(null);

  const applyDetailToForm = (post: BlogDetail) => {
    setForm({
      title: post.title || "",
      slug: post.slug || "",
      excerpt: post.excerpt || "",
      coverImage: post.coverImage || "",
      contentHtml: post.contentHtml || "<p></p>",
      keywords: keywordsFromJson(post.keywordsJson),
      status: post.status || "draft",
      socialAutoPostEnabled: Boolean(post.socialAutoPostEnabled),
      metaTitle: post.metaTitle || "",
      metaDescription: post.metaDescription || "",
      canonicalUrl: post.canonicalUrl || "",
      category: post.category || "",
      ctaLabel: post.ctaLabel || "",
      ctaHref: post.ctaHref || "",
      noindex: Boolean(post.noindex),
      // Show a future publish date so it can be changed; past dates are just "published".
      publishAt: post.publishedAt && new Date(post.publishedAt) > new Date() ? toLocalDateTime(post.publishedAt) : "",
    });
    setPostMeta({
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      publishedAt: post.publishedAt,
      facebookPostId: post.facebookPostId,
      facebookPostedAt: post.facebookPostedAt,
      facebookPostError: post.facebookPostError,
    });
    setSlugDirty(true);
  };

  const loadPost = async (postId: string) => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/admin/blogs/${postId}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to load blog post");
      const post = data?.data?.post as BlogDetail;
      if (!post) throw new Error("Blog post not found");
      applyDetailToForm(post);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load blog post");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const flash = (location.state as FlashState)?.message;
    if (!flash) return;
    setMessage(flash);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    setError("");
    if (!(location.state as FlashState)?.message) {
      setMessage("");
    }
    if (!id) {
      setForm(EMPTY_FORM);
      setPostMeta(null);
      setSlugDirty(false);
      return;
    }
    void loadPost(id);
  }, [id, location.state]);

  const onTitleChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      title: value,
      slug: slugDirty ? prev.slug : slugifyBlogTitle(value),
    }));
  };

  const onSave = async () => {
    const plainText = stripHtmlToText(form.contentHtml);
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!plainText) {
      setError("Content is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        excerpt: form.excerpt.trim(),
        coverImage: form.coverImage.trim(),
        contentHtml: form.contentHtml,
        keywords: parseKeywordsInput(form.keywords),
        status: form.status,
        socialAutoPostEnabled: form.socialAutoPostEnabled,
        metaTitle: form.metaTitle.trim(),
        metaDescription: form.metaDescription.trim(),
        canonicalUrl: form.canonicalUrl.trim(),
        category: form.category.trim(),
        ctaLabel: form.ctaLabel.trim(),
        ctaHref: form.ctaHref.trim(),
        noindex: form.noindex,
        // Only sent when scheduling; otherwise the server keeps the original publish date.
        ...(form.status === "published" && form.publishAt ? { publishAt: new Date(form.publishAt).toISOString() } : {}),
      };

      const endpoint = isEdit ? `/api/admin/blogs/${id}` : "/api/admin/blogs";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to save blog post");

      const savedPostId = data?.data?.post?.id as string | undefined;
      if (!isEdit && savedPostId) {
        navigate(`/admin/blogs/${savedPostId}/edit`, {
          replace: true,
          state: { message: data?.message || "Blog post created." },
        });
        return;
      }

      if (savedPostId) {
        await loadPost(savedPostId);
      }
      setMessage(data?.message || "Blog post updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save blog post");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!id) return;
    if (!window.confirm("Delete this blog post? This cannot be undone.")) return;

    try {
      setDeleting(true);
      setError("");
      setMessage("");
      const res = await fetch(`/api/admin/blogs/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to delete blog post");
      navigate("/admin/blogs", {
        replace: true,
        state: { message: "Blog post deleted." },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete blog post");
    } finally {
      setDeleting(false);
    }
  };

  const previewUrl = form.slug.trim() ? `/blog/${form.slug.trim()}` : "";
  const plainContentLength = stripHtmlToText(form.contentHtml).length;
  const keywordCount = parseKeywordsInput(form.keywords).length;
  const publishLabel = form.status === "published" ? "Publishing live" : "Saved as draft";

  const stats = useMemo(
    () => [
      { label: "Slug", value: form.slug || "your-post-slug" },
      { label: "Content", value: `${plainContentLength} chars` },
      { label: "Keywords", value: `${keywordCount} tags` },
    ],
    [form.slug, keywordCount, plainContentLength],
  );

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl"
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link
              to="/admin/blogs"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-indigo-100 transition hover:bg-white/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              BACK TO LIST
            </Link>
            <h1 className="mt-3 text-3xl font-bold">{isEdit ? "Edit Blog Post" : "Create Blog Post"}</h1>
            <p className="mt-1 max-w-2xl text-sm text-indigo-100">
              {isEdit
                ? "Update content, SEO fields, and publishing controls from this dedicated editor."
                : "Create a new post in a focused editor without leaving the main listing page."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {previewUrl ? (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/20"
              >
                <ExternalLink className="h-4 w-4" />
                Preview
              </a>
            ) : null}
            {isEdit ? (
              <button
                onClick={() => void onDelete()}
                disabled={deleting || saving}
                className="inline-flex items-center gap-2 rounded-xl border border-red-300/40 bg-red-500/10 px-4 py-2 font-semibold text-red-100 transition hover:bg-red-500/20 disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            ) : null}
            <button
              onClick={() => void onSave()}
              disabled={saving || deleting || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 font-semibold text-slate-900 transition hover:bg-indigo-50 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEdit ? "Save Changes" : "Create Post"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {stats.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <div className="text-xs uppercase tracking-wide text-indigo-100">{item.label}</div>
              <div className="mt-1 text-sm font-semibold text-white">{item.value}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            {loading ? <div className="text-sm text-slate-500">Loading post details...</div> : null}

            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <BookOpen className="h-4 w-4" />
              Content Setup
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="Blog title"
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Slug</label>
                <input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugDirty(true);
                    setForm((prev) => ({ ...prev, slug: slugifyBlogTitle(e.target.value) }));
                  }}
                  placeholder="blog-post-slug"
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Excerpt</label>
              <textarea
                value={form.excerpt}
                onChange={(e) => setForm((prev) => ({ ...prev, excerpt: e.target.value.slice(0, 400) }))}
                placeholder="Short description for cards, SEO snippets, and previews."
                rows={3}
                className="w-full resize-y rounded-2xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Keywords</label>
              <input
                value={form.keywords}
                onChange={(e) => setForm((prev) => ({ ...prev, keywords: e.target.value }))}
                placeholder="keyword one, keyword two, keyword three"
                className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div className="mt-4 admin-blog-editor">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Content</label>
              <ReactQuill
                theme="snow"
                value={form.contentHtml}
                onChange={(value) => setForm((prev) => ({ ...prev, contentHtml: value }))}
                modules={{
                  toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ["bold", "italic", "underline", "strike"],
                    [{ list: "ordered" }, { list: "bullet" }],
                    ["blockquote", "code-block", "link", "image"],
                    [{ align: [] }],
                    ["clean"],
                  ],
                }}
                placeholder="Write your blog content..."
              />
            </div>
          </div>
        </div>

        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-800">Publishing</div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as BlogForm["status"] }))}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>

              {form.status === "published" ? (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="blog-publish-at">Publish at (optional)</label>
                  <input
                    id="blog-publish-at"
                    type="datetime-local"
                    value={form.publishAt}
                    onChange={(e) => setForm((prev) => ({ ...prev, publishAt: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                  <p className="mt-1 text-xs text-slate-500">Pick a future time to schedule. Hidden from the blog and Google until then.</p>
                </div>
              ) : null}

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {form.status === "published" && form.publishAt && new Date(form.publishAt) > new Date()
                  ? `Scheduled for ${new Date(form.publishAt).toLocaleString()}`
                  : publishLabel}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Cover Image URL</label>
                <input
                  value={form.coverImage}
                  onChange={(e) => setForm((prev) => ({ ...prev, coverImage: e.target.value }))}
                  placeholder="https://..."
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="blog-category">Category</label>
                <input
                  id="blog-category"
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value.slice(0, 60) }))}
                  placeholder="e.g. Data Engineering"
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                />
              </div>

              {postMeta ? (
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <div>Created: {formatBlogDate(postMeta.createdAt)}</div>
                  <div>Updated: {formatBlogDate(postMeta.updatedAt)}</div>
                  <div>{postMeta.publishedAt ? `Published: ${formatBlogDate(postMeta.publishedAt)}` : "Not published yet"}</div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-800">Search engines (SEO)</div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 flex justify-between text-sm font-semibold text-slate-700" htmlFor="blog-meta-title">
                  Meta title <span className="font-normal text-slate-400">{form.metaTitle.length}/60</span>
                </label>
                <input
                  id="blog-meta-title"
                  value={form.metaTitle}
                  onChange={(e) => setForm((prev) => ({ ...prev, metaTitle: e.target.value.slice(0, 70) }))}
                  placeholder={form.title || "Defaults to the post title"}
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="mb-1.5 flex justify-between text-sm font-semibold text-slate-700" htmlFor="blog-meta-desc">
                  Meta description <span className="font-normal text-slate-400">{form.metaDescription.length}/160</span>
                </label>
                <textarea
                  id="blog-meta-desc"
                  value={form.metaDescription}
                  onChange={(e) => setForm((prev) => ({ ...prev, metaDescription: e.target.value.slice(0, 170) }))}
                  rows={3}
                  placeholder={form.excerpt || "Defaults to the excerpt"}
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="blog-canonical">Canonical URL (optional)</label>
                <input
                  id="blog-canonical"
                  value={form.canonicalUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, canonicalUrl: e.target.value }))}
                  placeholder="Only if this article first appeared elsewhere"
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.noindex} onChange={(e) => setForm((prev) => ({ ...prev, noindex: e.target.checked }))} />
                Hide from Google (noindex, leave out of the sitemap)
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-800">Call to action</div>
            <p className="mt-1 text-xs text-slate-500">Button under the article. Empty = "Explore Pro Connect".</p>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <input
                value={form.ctaLabel}
                onChange={(e) => setForm((prev) => ({ ...prev, ctaLabel: e.target.value.slice(0, 40) }))}
                placeholder="Button text, e.g. See Data Engineer jobs"
                aria-label="Call to action text"
                className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
              <input
                value={form.ctaHref}
                onChange={(e) => setForm((prev) => ({ ...prev, ctaHref: e.target.value }))}
                placeholder="/pricing or https://..."
                aria-label="Call to action link"
                className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-2 text-sky-600 shadow-sm">
                <Share2 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">Facebook Page Auto Post</div>
                <p className="mt-1 text-sm text-slate-600">
                  When this post is published, the server can publish it once to your configured Facebook Page.
                </p>
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-sky-200 bg-white px-4 py-3">
              <input
                type="checkbox"
                checked={form.socialAutoPostEnabled}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    socialAutoPostEnabled: e.target.checked,
                  }))
                }
                className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <div className="text-sm font-semibold text-slate-800">Post to Facebook when this blog is published</div>
                <div className="text-sm text-slate-600">
                  The post will be retried on the next save only if Facebook has not accepted it yet.
                </div>
              </div>
            </label>

            {postMeta?.facebookPostId ? (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm text-blue-800">
                Posted to Facebook on {formatBlogDate(postMeta.facebookPostedAt || null)}.
              </div>
            ) : null}

            {postMeta?.facebookPostError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
                Facebook auto-post error: {postMeta.facebookPostError}
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-800">Facebook Setup</div>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
              <li>Create a Meta app and generate a Page access token with page posting permissions.</li>
              <li>Save the Page ID and Page access token in `Admin Settings &gt; Social Integrations`.</li>
              <li>Publish from a public domain, not `localhost`, so Facebook can fetch the blog URL.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
