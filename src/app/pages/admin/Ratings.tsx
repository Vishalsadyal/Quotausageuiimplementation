import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, ChevronRight, CircleDot, Globe, Loader2, RefreshCw, Search, Star } from "lucide-react";

// Admin > Ratings: feedback from the dashboard "Rate us" popup (components/FeedbackPrompt.tsx).
// Bad ratings and bug reports are tickets: reply and close them here; the user sees both in Settings > My Tickets.

type FeedbackItem = {
  id: string;
  rating: number;
  tags: string[];
  comment: string;
  allowPublic: boolean;
  page: string;
  trigger: "manual" | "auto";
  ticketStatus: "open" | "closed" | null;
  adminReply: string;
  repliedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; plan: string };
};
type Summary = {
  total: number;
  average: number;
  distribution: Array<{ rating: number; count: number }>;
  topTags: Array<{ tag: string; count: number }>;
  openTickets: number;
};
type Pagination = { page: number; limit: number; total: number; totalPages: number };

const PAGE_SIZE = 20;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) throw new Error(body?.message || "Request failed");
  return body.data as T;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Stars({ value, size = "w-4 h-4" }: { value: number; size?: string }) {
  return (
    <div className="flex gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
      ))}
    </div>
  );
}

export default function Ratings() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState<number | null>(null);
  const [publicOnly, setPublicOnly] = useState(false);
  const [ticket, setTicket] = useState<"" | "open" | "closed">("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (rating) params.set("rating", String(rating));
      if (publicOnly) params.set("public", "1");
      if (ticket) params.set("ticket", ticket);
      if (query) params.set("q", query);
      const data = await api<{ items: FeedbackItem[]; summary: Summary; pagination: Pagination }>(`/api/admin/feedback?${params}`);
      setItems(data.items);
      setSummary(data.summary);
      setPagination(data.pagination);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load ratings");
    } finally {
      setLoading(false);
    }
  }, [page, rating, publicOnly, ticket, query]);

  const updateTicket = async (item: FeedbackItem, change: { ticketStatus?: "open" | "closed"; adminReply?: string }) => {
    setBusyId(item.id);
    try {
      const data = await api<{ feedback: Pick<FeedbackItem, "id" | "ticketStatus" | "adminReply" | "repliedAt" | "closedAt"> }>(
        `/api/admin/feedback/${item.id}`,
        { method: "PATCH", body: JSON.stringify(change) },
      );
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...data.feedback } : i)));
      setReplyDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      if (change.ticketStatus) {
        setSummary((prev) => (prev ? { ...prev, openTickets: prev.openTickets + (change.ticketStatus === "open" ? 1 : -1) } : prev));
      }
      toast.success(change.ticketStatus === "closed" ? "Ticket closed" : change.ticketStatus === "open" ? "Ticket reopened" : "Reply saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update ticket");
    } finally {
      setBusyId(null);
    }
  };

  const ticketFilters: Array<{ value: "" | "open" | "closed"; label: string }> = [
    { value: "", label: "All" },
    { value: "open", label: summary ? `Open tickets (${summary.openTickets})` : "Open tickets" },
    { value: "closed", label: "Closed tickets" },
  ];

  useEffect(() => {
    void load();
  }, [load]);

  // Any filter change starts again from page 1.
  const applyFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const maxCount = Math.max(1, ...(summary?.distribution.map((d) => d.count) ?? [1]));
  const from = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.total, pagination.page * pagination.limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ratings &amp; Reviews</h1>
            <p className="text-sm text-gray-500">What users said in the dashboard "Rate us" popup.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Average rating</div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-4xl font-bold text-gray-900">{summary ? summary.average.toFixed(1) : "–"}</span>
            <span className="pb-1 text-sm text-gray-500">/ 5</span>
          </div>
          <div className="mt-2">
            <Stars value={summary?.average ?? 0} size="w-5 h-5" />
          </div>
          <div className="mt-2 text-sm text-gray-500">{summary?.total ?? 0} ratings in total</div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Breakdown</div>
          <div className="mt-3 space-y-1.5">
            {(summary?.distribution ?? [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: 0 }))).map((d) => (
              <button
                key={d.rating}
                type="button"
                onClick={() => applyFilter(() => setRating(rating === d.rating ? null : d.rating))}
                className={`w-full flex items-center gap-2 rounded-lg px-1.5 py-0.5 text-sm hover:bg-gray-50 ${rating === d.rating ? "bg-amber-50" : ""}`}
              >
                <span className="w-8 text-left font-medium text-gray-700">{d.rating}★</span>
                <span className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <span
                    className={`block h-full rounded-full ${d.rating >= 4 ? "bg-emerald-500" : d.rating === 3 ? "bg-amber-400" : "bg-rose-500"}`}
                    style={{ width: `${(d.count / maxCount) * 100}%` }}
                  />
                </span>
                <span className="w-10 text-right text-gray-500">{d.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Most picked options</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary?.topTags.length ? (
              summary.topTags.map((t) => (
                <span key={t.tag} className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                  {t.tag} · {t.count}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-400">No options picked yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative flex-1 min-w-[220px] max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            applyFilter(() => setQuery(queryInput.trim()));
          }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Search name, email or review… (Enter)"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 bg-white outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
          />
        </form>
        <div className="flex gap-1">
          {[null, 5, 4, 3, 2, 1].map((r) => (
            <button
              key={r ?? "all"}
              type="button"
              onClick={() => applyFilter(() => setRating(r))}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                rating === r ? "bg-purple-600 border-purple-600 text-white" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {r ? `${r}★` : "All"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {ticketFilters.map((f) => (
            <button
              key={f.value || "any"}
              type="button"
              onClick={() => applyFilter(() => setTicket(f.value))}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                ticket === f.value ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 cursor-pointer">
          <input type="checkbox" checked={publicOnly} onChange={(e) => applyFilter(() => setPublicOnly(e.target.checked))} className="accent-purple-600" />
          OK to show on website
        </label>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">No ratings match these filters.</div>
        ) : (
          <ul className={`divide-y divide-gray-100 ${loading ? "opacity-60" : ""}`}>
            {items.map((item) => (
              <li key={item.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars value={item.rating} />
                      <span className="font-semibold text-gray-900">{item.user.name || "Unnamed"}</span>
                      <span className="text-sm text-gray-500 truncate">{item.user.email}</span>
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-gray-100 text-gray-600">{item.user.plan}</span>
                      {item.ticketStatus === "open" && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                          <CircleDot className="w-3 h-3" /> Open ticket
                        </span>
                      )}
                      {item.ticketStatus === "closed" && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Closed
                        </span>
                      )}
                      {item.allowPublic && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Globe className="w-3 h-3" /> Public OK
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 text-right">
                    <div>{formatDate(item.createdAt)}</div>
                    <div>
                      {item.trigger === "auto" ? "Auto popup" : "Rate us button"}
                      {item.page ? ` · ${item.page}` : ""}
                    </div>
                  </div>
                </div>
                {item.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                          item.rating >= 4 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {item.comment ? (
                  <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">{item.comment}</p>
                ) : (
                  <p className="mt-2 text-sm italic text-gray-400">No written review</p>
                )}
                {item.ticketStatus && (
                  <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                    <div className="text-xs font-semibold text-gray-600">
                      Reply to the user (shown in their Settings &gt; My Tickets)
                      {item.repliedAt ? <span className="font-normal text-gray-400"> · last saved {formatDate(item.repliedAt)}</span> : null}
                    </div>
                    <textarea
                      value={replyDrafts[item.id] ?? item.adminReply}
                      onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      rows={2}
                      maxLength={4000}
                      placeholder="e.g. Thanks! We fixed the salary field, please try again."
                      className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === item.id || (replyDrafts[item.id] ?? item.adminReply) === item.adminReply}
                        onClick={() => void updateTicket(item, { adminReply: replyDrafts[item.id] ?? item.adminReply })}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-40"
                      >
                        Save reply
                      </button>
                      {item.ticketStatus === "open" ? (
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => {
                            // Closing also saves a reply typed but not saved yet.
                            const draft = replyDrafts[item.id];
                            void updateTicket(item, {
                              ticketStatus: "closed",
                              ...(draft !== undefined && draft !== item.adminReply ? { adminReply: draft } : {}),
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40"
                        >
                          Close ticket
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void updateTicket(item, { ticketStatus: "open" })}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 disabled:opacity-40"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 text-sm">
          <span className="text-gray-500">
            {from}–{to} of {pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-gray-600">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
