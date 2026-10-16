import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { CheckCircle2, Gift, Loader2, Megaphone, RefreshCw, Search, Tag, TrendingUp } from "lucide-react";

// Admin > Growth: the site promo bar, referral rules and review, and coupon / purchase results.
// Coupons themselves are created in Admin > Settings > Discount codes.

type Announcement = {
  enabled: boolean;
  text: string;
  code: string;
  ctaLabel: string;
  ctaHref: string;
  startsAt: string | null;
  endsAt: string | null;
};
type ReferralConfig = { enabled: boolean; threshold: number; rewardPlan: "pro" | "connect"; rewardDays: number; maxRewardsPerUser: number };
type Referrer = {
  id: string;
  name: string;
  email: string;
  code: string | null;
  plan: string;
  planExpiresAt: string | null;
  signedUp: number;
  counted: number;
  held: number;
  rewards: number;
  rewardsPending: number;
};
type Held = { id: string; name: string; email: string; referredAt: string | null; referredBy: { name: string; email: string } | null };
type Summary = {
  days: number;
  coupons: Array<{
    id: string;
    code: string;
    target: string;
    type: string;
    active: boolean;
    usedCount: number;
    usageLimitTotal: number | null;
    endsAt: string | null;
    redemptions: number;
    revenueRupees: number;
    discountGivenRupees: number;
    redemptionsInPeriod: number;
    revenueInPeriodRupees: number;
  }>;
  couponChecks: number;
  purchases: { total: number; byPlan: Record<string, { count: number; revenue: number; withCoupon: number }> };
  referrals: { signups: number; qualified: number; rewards: Record<string, number> };
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
// <input type="datetime-local"> works in local time; the API stores ISO.
const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) throw new Error(body?.message || "Request failed");
  return body.data as T;
}

export default function Growth() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [config, setConfig] = useState<ReferralConfig | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [held, setHeld] = useState<Held[]>([]);
  const [query, setQuery] = useState("");
  const [days, setDays] = useState(30);
  const [saving, setSaving] = useState<"banner" | "rules" | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  const loadReferrals = useCallback(async (q = "") => {
    const data = await api<{ referrers: Referrer[]; held: Held[] }>(`/api/admin/referrals${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setReferrers(data.referrers);
    setHeld(data.held);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [a, c, s] = await Promise.all([
        api<{ announcement: Announcement }>("/api/admin/settings/announcement"),
        api<{ config: ReferralConfig }>("/api/admin/settings/referrals"),
        api<Summary>(`/api/admin/growth/summary?days=${days}`),
      ]);
      setAnnouncement(a.announcement);
      setConfig(c.config);
      setSummary(s);
      await loadReferrals();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load growth data");
    }
  }, [days, loadReferrals]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const saveBanner = async () => {
    if (!announcement) return;
    setSaving("banner");
    try {
      await api("/api/admin/settings/announcement", { method: "PUT", body: JSON.stringify(announcement) });
      toast.success("Promo bar saved. It updates on the site within a minute.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(null);
    }
  };

  const saveRules = async () => {
    if (!config) return;
    setSaving("rules");
    try {
      await api("/api/admin/settings/referrals", { method: "PUT", body: JSON.stringify(config) });
      toast.success("Referral rules saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(null);
    }
  };

  const approve = async (userId: string) => {
    setApproving(userId);
    try {
      await api("/api/admin/referrals", { method: "POST", body: JSON.stringify({ userId }) });
      toast.success("Referral counted");
      await loadReferrals(query);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve");
    } finally {
      setApproving(null);
    }
  };

  const field = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
  const label = "mb-1 block text-xs font-semibold text-gray-600";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Growth</h1>
          <p className="text-sm text-gray-500">Promo bar, coupons, referrals and purchases.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" aria-label="Period">
            {[7, 30, 90, 365].map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void loadAll()} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Funnel numbers */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            ["Coupon checks", summary.couponChecks],
            ["Plan purchases", summary.purchases.total],
            ["Revenue", inr(Object.values(summary.purchases.byPlan).reduce((n, p) => n + p.revenue, 0))],
            ["Referral signups", summary.referrals.signups],
            ["Referrals counted", summary.referrals.qualified],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">{k}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Promo bar */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
            <Megaphone className="h-5 w-5 text-indigo-600" /> Site promo bar
          </h2>
          {!announcement ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          ) : (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                <input type="checkbox" checked={announcement.enabled} onChange={(e) => setAnnouncement({ ...announcement, enabled: e.target.checked })} />
                Show on the public site
              </label>
              <div>
                <label className={label} htmlFor="ann-text">Message</label>
                <input id="ann-text" className={field} value={announcement.text} maxLength={160} onChange={(e) => setAnnouncement({ ...announcement, text: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className={label} htmlFor="ann-code">Coupon code shown</label>
                  <input id="ann-code" className={field} value={announcement.code} onChange={(e) => setAnnouncement({ ...announcement, code: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <label className={label} htmlFor="ann-cta">Button label</label>
                  <input id="ann-cta" className={field} value={announcement.ctaLabel} onChange={(e) => setAnnouncement({ ...announcement, ctaLabel: e.target.value })} />
                </div>
                <div>
                  <label className={label} htmlFor="ann-href">Button link</label>
                  <input id="ann-href" className={field} value={announcement.ctaHref} placeholder="/dashboard/billing?coupon=GOINDIA" onChange={(e) => setAnnouncement({ ...announcement, ctaHref: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={label} htmlFor="ann-start">Starts (optional)</label>
                  <input id="ann-start" type="datetime-local" className={field} value={toLocalInput(announcement.startsAt)} onChange={(e) => setAnnouncement({ ...announcement, startsAt: fromLocalInput(e.target.value) })} />
                </div>
                <div>
                  <label className={label} htmlFor="ann-end">Ends (optional)</label>
                  <input id="ann-end" type="datetime-local" className={field} value={toLocalInput(announcement.endsAt)} onChange={(e) => setAnnouncement({ ...announcement, endsAt: fromLocalInput(e.target.value) })} />
                </div>
              </div>
              <div className="rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 px-3 py-2 text-center text-sm text-white" aria-label="Preview">
                {announcement.text} {announcement.code && !announcement.text.toLowerCase().includes(announcement.code.toLowerCase()) && <span className="ml-1 rounded border border-white/40 bg-white/15 px-1.5 font-mono text-xs">{announcement.code}</span>}
                {announcement.ctaLabel && <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-indigo-700">{announcement.ctaLabel}</span>}
              </div>
              <button type="button" onClick={() => void saveBanner()} disabled={saving === "banner"} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {saving === "banner" ? "Saving…" : "Save promo bar"}
              </button>
            </div>
          )}
        </section>

        {/* Referral rules */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
            <Gift className="h-5 w-5 text-fuchsia-600" /> Referral rules
          </h2>
          {!config ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          ) : (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                <input type="checkbox" checked={config.enabled} onChange={(e) => setConfig({ ...config, enabled: e.target.checked })} />
                Referral rewards on
              </label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className={label} htmlFor="ref-threshold">Friends needed</label>
                  <input id="ref-threshold" type="number" min={1} max={50} className={field} value={config.threshold} onChange={(e) => setConfig({ ...config, threshold: Number(e.target.value) || 1 })} />
                </div>
                <div>
                  <label className={label} htmlFor="ref-plan">Reward plan</label>
                  <select id="ref-plan" className={field} value={config.rewardPlan} onChange={(e) => setConfig({ ...config, rewardPlan: e.target.value as ReferralConfig["rewardPlan"] })}>
                    <option value="pro">Pro</option>
                    <option value="connect">Pro Connect</option>
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="ref-days">Reward days</label>
                  <input id="ref-days" type="number" min={1} max={365} className={field} value={config.rewardDays} onChange={(e) => setConfig({ ...config, rewardDays: Number(e.target.value) || 1 })} />
                </div>
                <div>
                  <label className={label} htmlFor="ref-max">Max rewards / user</label>
                  <input id="ref-max" type="number" min={1} max={100} className={field} value={config.maxRewardsPerUser} onChange={(e) => setConfig({ ...config, maxRewardsPerUser: Number(e.target.value) || 1 })} />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                A friend counts when they sign up through the link and finish onboarding. Friends on the same network (IP) as the referrer are held for review below.
              </p>
              <button type="button" onClick={() => void saveRules()} disabled={saving === "rules"} className="rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-700 disabled:opacity-60">
                {saving === "rules" ? "Saving…" : "Save rules"}
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Coupons */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Tag className="h-5 w-5 text-amber-600" /> Coupons
          </h2>
          <Link to="/admin/settings" className="text-sm font-semibold text-indigo-600 hover:underline">
            Create or edit coupons in Settings →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">For</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Used</th>
                <th className="px-3 py-2 text-right">Revenue</th>
                <th className="px-3 py-2 text-right">Discount given</th>
                <th className="px-3 py-2 text-right">Last {summary?.days ?? days} days</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.coupons || []).map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono font-semibold">{c.code}</td>
                  <td className="px-3 py-2 text-gray-600">{c.target.replace("plan_", "").replace("_", " ")}</td>
                  <td className="px-3 py-2">
                    {c.active && (!c.endsAt || new Date(c.endsAt) > new Date()) ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Active</span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{c.active ? "Expired" : "Off"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {c.usedCount}
                    {c.usageLimitTotal ? ` / ${c.usageLimitTotal}` : ""}
                  </td>
                  <td className="px-3 py-2 text-right">{inr(c.revenueRupees)}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{inr(c.discountGivenRupees)}</td>
                  <td className="px-3 py-2 text-right">
                    {c.redemptionsInPeriod} · {inr(c.revenueInPeriodRupees)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {summary && Object.keys(summary.purchases.byPlan).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <TrendingUp className="h-4 w-4 text-gray-400" />
            {Object.entries(summary.purchases.byPlan).map(([plan, p]) => (
              <span key={plan} className="rounded-lg bg-gray-50 px-3 py-1">
                <b>{plan === "connect" ? "Pro Connect" : plan}</b>: {p.count} sold ({p.withCoupon} with coupon) · {inr(p.revenue)}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Held referrals */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-lg font-bold text-gray-900">Held for review ({held.length})</h2>
        <p className="mb-3 text-xs text-gray-500">These friends finished onboarding but used the same network as their referrer. Approve only if they look like a real, different person.</p>
        {held.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Friend</th>
                  <th className="px-3 py-2">Referred by</th>
                  <th className="px-3 py-2">Joined</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {held.map((h) => (
                  <tr key={h.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      {h.name}
                      <div className="text-xs text-gray-500">{h.email}</div>
                    </td>
                    <td className="px-3 py-2">
                      {h.referredBy?.name}
                      <div className="text-xs text-gray-500">{h.referredBy?.email}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{h.referredAt ? new Date(h.referredAt).toLocaleDateString() : ""}</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => void approve(h.id)} disabled={approving === h.id} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Count it
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Nothing to review.</p>
        )}
      </section>

      {/* Referrers */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900">Referrers</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void loadReferrals(query);
            }}
            className="flex items-center gap-2"
          >
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, email or code" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" aria-label="Search referrers" />
            <button type="submit" className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50" aria-label="Search">
              <Search className="h-4 w-4" />
            </button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2 text-right">Joined</th>
                <th className="px-3 py-2 text-right">Counted</th>
                <th className="px-3 py-2 text-right">Held</th>
                <th className="px-3 py-2 text-right">Rewards</th>
                <th className="px-3 py-2">Plan</th>
              </tr>
            </thead>
            <tbody>
              {referrers.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    {r.name}
                    <div className="text-xs text-gray-500">{r.email}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-3 py-2 text-right">{r.signedUp}</td>
                  <td className="px-3 py-2 text-right font-semibold">{r.counted}</td>
                  <td className="px-3 py-2 text-right">{r.held || ""}</td>
                  <td className="px-3 py-2 text-right">
                    {r.rewards}
                    {r.rewardsPending ? <span className="text-xs text-gray-500"> ({r.rewardsPending} waiting)</span> : null}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {r.plan}
                    {r.planExpiresAt && <div className="text-xs text-gray-500">until {new Date(r.planExpiresAt).toLocaleDateString()}</div>}
                  </td>
                </tr>
              ))}
              {!referrers.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                    No referrals yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
