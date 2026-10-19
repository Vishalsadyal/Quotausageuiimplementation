import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CreditCard, RefreshCw, TrendingUp, Users, Wallet } from "lucide-react";

type Bucket = { count: number; rupees: number };
type RevenueData = {
  currency: string;
  testMode: boolean;
  totals: { all: Bucket; month: Bucket; prevMonth: Bucket; today: Bucket };
  bySource: { plans: Bucket; hires: Bucket };
  byPlan: Record<string, Bucket>;
  discountRupees: number;
  totalUsers: number;
  paidUsersEver: number;
  activePaidUsers: number;
  payments: Array<{
    paymentId: string;
    kind: "plan" | "hires";
    plan: string | null;
    hires: number | null;
    rupees: number;
    baseRupees: number;
    discountRupees: number;
    discountCode: string | null;
    createdAt: string;
    user: { id: string; name?: string | null; email?: string | null } | null;
  }>;
  activeUsers: Array<{ id: string; name?: string | null; email?: string | null; plan: string; planExpiresAt: string | null }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

const PAGE_LIMIT = 20;

function formatCurrency(value: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Math.max(0, Number(value || 0)));
  } catch {
    return `${Math.max(0, Number(value || 0)).toLocaleString()} ${currency}`;
  }
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
      <div className="text-xs uppercase tracking-wide text-cyan-100">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {sub ? <div className="text-xs text-cyan-100">{sub}</div> : null}
    </div>
  );
}

export default function Revenue() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (nextPage = page) => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(nextPage), limit: String(PAGE_LIMIT) });
      const res = await fetch(`/api/admin/revenue?${params.toString()}`, { credentials: "include" });
      const body = await res.json();
      if (!res.ok || !body?.success) throw new Error(body?.message || "Failed to fetch revenue");
      setData(body.data as RevenueData);
      setPage(Number(body?.data?.pagination?.page || nextPage));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch revenue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cur = data?.currency || "INR";
  const totalPages = Math.max(1, Number(data?.pagination?.totalPages || 1));
  const canPrev = page > 1 && !loading;
  const canNext = page < totalPages && !loading;
  const payments = data?.payments || [];
  const planRows = Object.entries(data?.byPlan || {}).sort((a, b) => b[1].rupees - a[1].rupees);
  const maxPlan = Math.max(1, ...planRows.map(([, b]) => b.rupees));
  const month = data?.totals.month.rupees || 0;
  const prev = data?.totals.prevMonth.rupees || 0;
  const delta = prev > 0 ? Math.round(((month - prev) / prev) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-900 via-cyan-900 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide">
              <TrendingUp className="h-3.5 w-3.5" />
              REVENUE
            </div>
            <h1 className="mt-3 text-3xl font-bold">Revenue Dashboard</h1>
            <p className="mt-1 text-cyan-100">Money actually collected, counted from verified Razorpay payments.</p>
          </div>
          <button
            onClick={() => void load(page)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total collected" value={formatCurrency(data?.totals.all.rupees || 0, cur)} sub={`${data?.totals.all.count || 0} payments`} />
          <StatCard
            label="This month"
            value={formatCurrency(month, cur)}
            sub={delta === null ? `${data?.totals.month.count || 0} payments` : `${delta >= 0 ? "+" : ""}${delta}% vs last month`}
          />
          <StatCard label="Today" value={formatCurrency(data?.totals.today.rupees || 0, cur)} sub={`${data?.totals.today.count || 0} payments`} />
          <StatCard label="Paid users now" value={String(data?.activePaidUsers || 0)} sub={`${data?.paidUsersEver || 0} ever paid`} />
          <StatCard label="Discounts given" value={formatCurrency(data?.discountRupees || 0, cur)} sub={`${data?.totalUsers || 0} total users`} />
        </div>
      </div>

      {data?.testMode ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Razorpay is on <b>test keys</b> in this environment. Payments here are not real money.
        </div>
      ) : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="text-sm text-gray-500">Loading revenue...</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
            <CreditCard className="h-5 w-5 text-indigo-500" />
            Revenue by plan
          </h2>
          <div className="space-y-4">
            {planRows.map(([plan, b]) => (
              <div key={plan}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-semibold capitalize text-gray-900">{plan}</span>
                  <span className="text-gray-600">
                    {b.count} sold | {formatCurrency(b.rupees, cur)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(4, Math.round((b.rupees / maxPlan) * 100))}%` }} />
                </div>
              </div>
            ))}
            {planRows.length === 0 ? <div className="text-sm text-gray-500">No plan purchases yet.</div> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
            <Wallet className="h-5 w-5 text-emerald-500" />
            Plans vs Hires top-ups
          </h2>
          <div className="space-y-3">
            {(
              [
                ["Plan purchases", data?.bySource.plans],
                ["Hires top-ups", data?.bySource.hires],
              ] as const
            ).map(([label, b]) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 text-sm">
                <span className="font-medium text-gray-800">{label}</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(b?.rupees || 0, cur)} <span className="font-normal text-gray-500">({b?.count || 0})</span>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-gray-500">Amounts are what the customer paid, after any coupon.</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-gray-50 to-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Payments</h2>
            <p className="text-sm text-gray-600">Every verified payment, newest first</p>
          </div>
          <div className="text-sm text-gray-600">{data?.pagination.total || 0} total</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-white">
              <tr className="text-xs uppercase tracking-wide text-gray-600">
                <th className="px-4 py-3 text-left font-semibold">When</th>
                <th className="px-4 py-3 text-left font-semibold">User</th>
                <th className="px-4 py-3 text-left font-semibold">For</th>
                <th className="px-4 py-3 text-left font-semibold">Coupon</th>
                <th className="px-4 py-3 text-right font-semibold">Paid</th>
                <th className="px-4 py-3 text-left font-semibold">Payment ID</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.paymentId} className="border-t border-gray-100 hover:bg-cyan-50/30">
                  <td className="px-4 py-3">{new Date(p.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{p.user?.name || "-"}</div>
                    <div className="text-xs text-gray-500">{p.user?.email || ""}</div>
                  </td>
                  <td className="px-4 py-3">{p.kind === "plan" ? <span className="capitalize">{p.plan} plan</span> : `${p.hires || 0} Hires`}</td>
                  <td className="px-4 py-3 text-xs">{p.discountCode ? `${p.discountCode} (-${formatCurrency(p.discountRupees, cur)})` : "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(p.rupees, cur)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.paymentId}</td>
                </tr>
              ))}
              {!loading && payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    No payments yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
          <div className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => canPrev && void load(page - 1)}
              disabled={!canPrev}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <button
              onClick={() => canNext && void load(page + 1)}
              disabled={!canNext}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Users className="h-4 w-4 text-indigo-500" />
          Paid plans running now ({data?.activePaidUsers || 0})
        </div>
        <div className="divide-y divide-gray-100 text-sm">
          {(data?.activeUsers || []).map((u) => (
            <div key={u.id} className="flex items-center justify-between py-2">
              <span>
                <span className="font-semibold text-gray-900">{u.name || u.email || u.id}</span> <span className="text-xs text-gray-500">{u.email}</span>
              </span>
              <span className="text-gray-600">
                <span className="capitalize">{u.plan}</span> until {u.planExpiresAt ? new Date(u.planExpiresAt).toLocaleDateString() : "-"}
              </span>
            </div>
          ))}
          {(data?.activeUsers || []).length === 0 ? <div className="py-2 text-gray-500">No paid plans running.</div> : null}
        </div>
      </div>
    </div>
  );
}
