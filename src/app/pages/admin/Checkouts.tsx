import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, MessageCircle, RefreshCw, ShoppingCart } from "lucide-react";

// Admin > Checkouts: every Pay click (onboarding, Billing page, dashboard banner), what happened next,
// and where new users stop in onboarding. Data: /api/admin/checkouts (src/lib/checkout-tracking.ts).

type Counts = { clicks: number; opened: number; paid: number; dismissed: number; failed: number };
type Row = Counts & { id: string; label?: string };
type Status = "started" | "opened" | "paid" | "dismissed" | "failed";
type Item = {
  id: string;
  source: string;
  product: string;
  mode: string;
  status: Status;
  amountRupees: number | null;
  stage: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string; phone: string | null; plan: string; createdAt: string; paidInRange: boolean };
};
type Data = {
  days: number;
  summary: Counts & { users: number; paidUsers: number; revenueRupees: number };
  bySource: Row[];
  byProduct: Row[];
  onboarding: { signups: number; completed: number; dropoff: Array<{ step: number; label: string; users: number }> };
  items: Item[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

const DAYS = [
  { value: 1, label: "Today" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];
const SOURCE_LABEL: Record<string, string> = { onboarding: "Onboarding", billing: "Billing page", promo_banner: "₹99 banner" };
const PRODUCT_LABEL: Record<string, string> = { pro: "Pro", connect: "Pro Connect", coach: "Career Coach", hires: "Hires top-up" };
const MODE_LABEL: Record<string, string> = { one_time: "30 days", subscription: "Monthly", topup: "Wallet" };
// A click with no result after this long means the tab was closed or the browser never reported back.
const STALE_MS = 30 * 60 * 1000;

function statusChip(item: Item) {
  const stale = Date.now() - new Date(item.updatedAt).getTime() > STALE_MS;
  switch (item.status) {
    case "paid":
      return { text: "Paid", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "dismissed":
      return { text: "Closed Razorpay", cls: "bg-amber-50 text-amber-800 border-amber-200" };
    case "failed":
      return { text: "Error", cls: "bg-rose-50 text-rose-700 border-rose-200" };
    case "opened":
      return stale ? { text: "Left on Razorpay", cls: "bg-amber-50 text-amber-800 border-amber-200" } : { text: "On Razorpay now", cls: "bg-sky-50 text-sky-700 border-sky-200" };
    default:
      return stale ? { text: "Never reached Razorpay", cls: "bg-rose-50 text-rose-700 border-rose-200" } : { text: "Loading checkout", cls: "bg-sky-50 text-sky-700 border-sky-200" };
  }
}

function pct(part: number, whole: number) {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–";
}

// Same as phoneDigits in src/lib/agency.ts: a 10-digit Indian number gets the 91 country code.
function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}?text=${encodeURIComponent(text)}`;
}

function nudgeMessage(item: Item) {
  const first = (item.user.name || "").split(" ")[0] || "there";
  const plan = PRODUCT_LABEL[item.product] || item.product;
  return `Hi ${first}, this is the AutoApplyCV team. We saw you tried to get ${plan} but the payment didn't go through. Can we help? Reply here and we'll sort it out.`;
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function FunnelTable({ title, rows, labelFor }: { title: string; rows: Row[]; labelFor: (r: Row) => string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Where</th>
              <th className="px-3 py-2 text-right font-medium">Clicked Pay</th>
              <th className="px-3 py-2 text-right font-medium">Saw Razorpay</th>
              <th className="px-3 py-2 text-right font-medium">Paid</th>
              <th className="px-3 py-2 text-right font-medium">Closed</th>
              <th className="px-3 py-2 text-right font-medium">Errors</th>
              <th className="px-4 py-2 text-right font-medium">Paid / clicks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 tabular-nums">
            {rows.map((r) => (
              <tr key={r.id} className={r.clicks === 0 ? "text-gray-400" : "text-gray-800"}>
                <td className="px-4 py-2 font-medium">{labelFor(r)}</td>
                <td className="px-3 py-2 text-right">{r.clicks}</td>
                <td className="px-3 py-2 text-right">{r.opened}</td>
                <td className="px-3 py-2 text-right font-semibold text-emerald-700">{r.paid}</td>
                <td className="px-3 py-2 text-right text-amber-700">{r.dismissed}</td>
                <td className="px-3 py-2 text-right text-rose-700">{r.failed}</td>
                <td className="px-4 py-2 text-right font-semibold">{pct(r.paid, r.clicks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Checkouts() {
  const [days, setDays] = useState(7);
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [unpaid, setUnpaid] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const qs = new URLSearchParams({ days: String(days), page: String(page) });
      if (source) qs.set("source", source);
      if (status) qs.set("status", status);
      if (unpaid) qs.set("unpaid", "1");
      const res = await fetch(`/api/admin/checkouts?${qs}`, { credentials: "include" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) throw new Error(body?.message || "Failed to load checkouts");
      setData(body.data as Data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load checkouts");
    } finally {
      setLoading(false);
    }
  }, [days, source, status, unpaid, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const s = data?.summary;
  const maxDrop = Math.max(1, ...(data?.onboarding.dropoff.map((d) => d.users) || [1]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Checkouts</h1>
            <p className="text-sm text-gray-500">Who clicked Pay, where, for which plan, and what happened next.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-gray-200 bg-white p-1">
            {DAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => { setDays(d.value); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${days === d.value ? "bg-violet-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {s ? (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Clicked Pay", value: s.clicks, hint: `${s.users} users` },
            { label: "Saw Razorpay", value: s.opened, hint: `${pct(s.opened, s.clicks)} of clicks` },
            { label: "Paid", value: s.paid, hint: `${s.paidUsers} users · ₹${s.revenueRupees.toLocaleString("en-IN")}`, tone: "text-emerald-700" },
            { label: "Closed without paying", value: s.dismissed, hint: `${pct(s.dismissed, s.opened)} of Razorpay views`, tone: "text-amber-700" },
            { label: "Errors", value: s.failed, hint: "Order, script or verification failed", tone: "text-rose-700" },
            { label: "Conversion", value: pct(s.paid, s.clicks), hint: "Paid ÷ clicked Pay", tone: "text-violet-700" },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-xs font-medium text-gray-500">{c.label}</div>
              <div className={`mt-1 text-2xl font-bold tabular-nums ${c.tone || "text-gray-900"}`}>{c.value}</div>
              <div className="text-xs text-gray-500">{c.hint}</div>
            </div>
          ))}
        </div>
      ) : null}

      {data ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <FunnelTable title="By place" rows={data.bySource} labelFor={(r) => r.label || SOURCE_LABEL[r.id] || r.id} />
          <FunnelTable title="By plan" rows={data.byProduct} labelFor={(r) => PRODUCT_LABEL[r.id] || r.id} />
        </div>
      ) : null}

      {data ? (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Onboarding: where new users stop</span>
            <span className="text-xs text-gray-500 tabular-nums">
              {data.onboarding.signups} signed up · {data.onboarding.completed} finished ({pct(data.onboarding.completed, data.onboarding.signups)}) ·{" "}
              {data.onboarding.signups - data.onboarding.completed} stuck
            </span>
          </div>
          {data.onboarding.dropoff.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500">Nobody is stuck in onboarding for this period.</div>
          ) : (
            <ul className="px-4 py-3 space-y-1.5">
              {data.onboarding.dropoff.map((d) => (
                <li key={d.step} className="grid grid-cols-[minmax(0,11rem)_1fr_3rem] items-center gap-3 text-sm">
                  <span className="truncate text-gray-700">{d.step ? `${d.step}. ${d.label}` : d.label}</span>
                  <span className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <span className={`block h-full rounded-full ${d.step === 25 ? "bg-amber-500" : "bg-violet-500"}`} style={{ width: `${(d.users / maxDrop) * 100}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular-nums text-gray-900">{d.users}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="px-4 pb-3 text-xs text-gray-500">Step 25 (amber) is the plan screen: users who reached payment but didn't finish.</p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900 mr-auto">Every Pay click</span>
          <select
            id="checkout-source"
            value={source}
            onChange={(e) => { setSource(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
          >
            <option value="">All places</option>
            <option value="onboarding">Onboarding</option>
            <option value="billing">Billing page</option>
            <option value="promo_banner">₹99 banner</option>
          </select>
          <select
            id="checkout-status"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
          >
            <option value="">All results</option>
            <option value="paid">Paid</option>
            <option value="dismissed">Closed Razorpay</option>
            <option value="opened">Left on Razorpay</option>
            <option value="started">Never reached Razorpay</option>
            <option value="failed">Error</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input id="checkout-unpaid" type="checkbox" checked={unpaid} onChange={(e) => { setUnpaid(e.target.checked); setPage(1); }} className="accent-violet-600" />
            Only users who never paid
          </label>
        </div>

        {loading && !data ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">No Pay clicks for these filters yet. New clicks show up here as they happen.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">When</th>
                  <th className="px-3 py-2 text-left font-medium">User</th>
                  <th className="px-3 py-2 text-left font-medium">Where</th>
                  <th className="px-3 py-2 text-left font-medium">Plan</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 text-left font-medium">Result</th>
                  <th className="px-4 py-2 text-left font-medium">Follow up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item) => {
                  const chip = statusChip(item);
                  const canNudge = item.status !== "paid" && !item.user.paidInRange && item.user.plan === "free" && item.user.phone;
                  return (
                    <tr key={item.id} className="align-top">
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{timeAgo(item.createdAt)}</td>
                      <td className="px-3 py-2.5 min-w-[12rem]">
                        <div className="font-semibold text-gray-900">{item.user.name || "Unnamed"}</div>
                        <div className="text-xs text-gray-500 break-all">{item.user.email}</div>
                        <div className="text-xs text-gray-500">
                          {item.user.phone || "No phone"} · now {item.user.plan}
                          {item.user.paidInRange && item.status !== "paid" ? <span className="ml-1 font-semibold text-emerald-700">· paid later</span> : null}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{SOURCE_LABEL[item.source] || item.source}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                        {PRODUCT_LABEL[item.product] || item.product}
                        <div className="text-xs text-gray-500">{MODE_LABEL[item.mode] || item.mode}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{item.amountRupees != null ? `₹${item.amountRupees.toLocaleString("en-IN")}` : "–"}</td>
                      <td className="px-3 py-2.5 min-w-[10rem]">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${chip.cls}`}>{chip.text}</span>
                        {item.error ? (
                          <div className="mt-1 text-xs text-rose-700 break-words" title={item.error}>
                            {item.stage ? `${item.stage}: ` : ""}
                            {item.error}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {canNudge ? (
                          <a
                            href={waLink(item.user.phone!, nudgeMessage(item))}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">–</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.pagination.totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 text-sm">
            <span className="text-gray-500">{data.pagination.total} clicks</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="text-gray-600">
                {page} / {data.pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
