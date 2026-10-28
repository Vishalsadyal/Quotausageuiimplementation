import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Copy, Loader2, MessageCircle, RefreshCw, RotateCcw } from "lucide-react";

// Admin > Follow-ups: today's WhatsApp messages, grouped by reason (src/lib/follow-ups.ts).
// "Send on WhatsApp" opens wa.me with the message filled in and marks it sent, so the person
// leaves the list and isn't messaged again for the same reason.

type Reason = "plan_ending" | "plan_expired" | "never_applied" | "onboarding_stuck" | "upgrade";
type ReasonTab = { id: Reason; title: string; hint: string; pending: number; sent: number };
type Item = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  plan: "free" | "pro" | "coach" | "connect";
  reason: Reason;
  key: string;
  detail: string;
  message: string;
  whatsappUrl: string | null;
  sent: { id: string; at: string } | null;
};
type Pagination = { page: number; limit: number; total: number; totalPages: number };
type Status = "pending" | "sent";

const PAGE_SIZE = 25;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) throw new Error(body?.message || "Request failed");
  return body.data as T;
}

// Same as phoneDigits in src/lib/agency.ts: a 10-digit Indian number gets the 91 country code.
function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}?text=${encodeURIComponent(text)}`;
}

const planBadge: Record<Item["plan"], string> = {
  free: "bg-gray-100 text-gray-700 border-gray-200",
  pro: "bg-violet-100 text-violet-800 border-violet-200",
  coach: "bg-amber-100 text-amber-800 border-amber-200",
  connect: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
};

export default function FollowUps() {
  const [reason, setReason] = useState<Reason>("plan_ending");
  const [status, setStatus] = useState<Status>("pending");
  const [page, setPage] = useState(1);
  const [tabs, setTabs] = useState<ReasonTab[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const openedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ reason, status, page: String(page), limit: String(PAGE_SIZE) });
      const data = await api<{ reasons: ReasonTab[]; items: Item[]; pagination: Pagination }>(`/api/admin/follow-ups?${params}`);
      // On first open, jump to the card with the most people to message instead of an empty one.
      if (!openedRef.current) {
        openedRef.current = true;
        const busiest = [...data.reasons].sort((a, b) => b.pending - a.pending)[0];
        if (busiest && busiest.pending > 0 && busiest.id !== reason && status === "pending") {
          setReason(busiest.id);
          return;
        }
      }
      setTabs(data.reasons);
      setItems(data.items);
      setPagination(data.pagination);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load follow-ups");
    } finally {
      setLoading(false);
    }
  }, [reason, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const itemId = (item: Item) => `${item.userId}|${item.key}`;
  const textOf = (item: Item) => drafts[itemId(item)] ?? item.message;

  const markSent = async (item: Item) => {
    setBusy(itemId(item));
    try {
      await api("/api/admin/follow-ups", {
        method: "POST",
        body: JSON.stringify({ userId: item.userId, reason: item.reason, key: item.key, message: textOf(item) }),
      });
      toast.success(`Marked ${item.name || item.email} as messaged`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark as sent");
    } finally {
      setBusy(null);
    }
  };

  const sendOnWhatsApp = (item: Item) => {
    if (!item.phone) return;
    // Open first (still inside the click, so the browser allows the new tab), then record it.
    window.open(waLink(item.phone, textOf(item)), "_blank", "noopener,noreferrer");
    void markSent(item);
  };

  const undo = async (item: Item) => {
    if (!item.sent) return;
    setBusy(itemId(item));
    try {
      await api(`/api/admin/follow-ups?id=${encodeURIComponent(item.sent.id)}`, { method: "DELETE" });
      toast.success("Moved back to pending");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to undo");
    } finally {
      setBusy(null);
    }
  };

  const copy = async (item: Item) => {
    try {
      await navigator.clipboard.writeText(textOf(item));
      toast.success("Message copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const active = tabs.find((t) => t.id === reason);
  const totalPending = tabs.reduce((n, t) => n + t.pending, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">WhatsApp Follow-ups</h1>
            <p className="text-sm text-gray-500">
              {totalPending} people to message today. Click "Send on WhatsApp", press send in WhatsApp, done.
            </p>
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

      {/* Reasons */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setReason(tab.id);
              setPage(1);
            }}
            className={`rounded-2xl border p-4 text-left transition ${
              reason === tab.id ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100" : "border-gray-200 bg-white hover:border-emerald-200"
            }`}
          >
            <div className="text-sm font-semibold text-gray-900">{tab.title}</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">{tab.pending}</div>
            <div className="text-xs text-gray-500">
              to message · {tab.sent} done
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">{active?.hint}</p>
        <div className="flex rounded-xl border border-gray-200 bg-white p-1">
          {(["pending", "sent"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${status === s ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              {s === "pending" ? "To message" : "Already messaged"}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">
            {status === "pending"
              ? totalPending > 0
                ? `Nobody here today. ${totalPending} people are waiting on the other cards above.`
                : "Nobody to message today 🎉"
              : "No messages sent for this reason yet."}
          </div>
        ) : (
          <ul className={`divide-y divide-gray-100 ${loading ? "opacity-60" : ""}`}>
            {items.map((item) => {
              const id = itemId(item);
              return (
                <li key={id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900">{item.name || "Unnamed"}</span>
                        <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold uppercase ${planBadge[item.plan]}`}>{item.plan}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.email}
                        {item.phone ? ` · ${item.phone}` : ""}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-amber-700">{item.detail}</div>
                    </div>
                    {item.sent ? (
                      <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <Check className="w-3.5 h-3.5" />
                        Messaged {new Date(item.sent.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    ) : null}
                  </div>

                  <textarea
                    value={textOf(item)}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [id]: e.target.value }))}
                    rows={3}
                    disabled={Boolean(item.sent)}
                    className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2 text-sm outline-none focus:bg-white focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 disabled:text-gray-500"
                  />

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {item.sent ? (
                      <button
                        type="button"
                        disabled={busy === id}
                        onClick={() => void undo(item)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Undo
                      </button>
                    ) : (
                      <>
                        {item.phone ? (
                          <button
                            type="button"
                            disabled={busy === id}
                            onClick={() => sendOnWhatsApp(item)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {busy === id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                            Send on WhatsApp
                          </button>
                        ) : (
                          <span className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200">No phone number</span>
                        )}
                        <button
                          type="button"
                          onClick={() => void copy(item)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </button>
                        <button
                          type="button"
                          disabled={busy === id}
                          onClick={() => void markSent(item)}
                          title="Already contacted another way"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" /> Mark done
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 text-sm">
          <span className="text-gray-500">
            {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.total, pagination.page * pagination.limit)} of {pagination.total}
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
