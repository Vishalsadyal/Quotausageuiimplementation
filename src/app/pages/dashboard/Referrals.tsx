import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Copy, Gift, Loader2, MessageCircle, Share2, Users } from "lucide-react";

// Refer & Earn: share your link; every N friends who sign up through it and finish onboarding
// earn you a free plan period (rules set in Admin > Growth).

type Summary = {
  enabled: boolean;
  code: string;
  link: string;
  rule: { threshold: number; rewardPlan: "pro" | "connect"; rewardDays: number; maxRewardsPerUser: number };
  counts: { signedUp: number; qualified: number; pending: number };
  progress: number;
  capped: boolean;
  friends: Array<{ name: string; joinedAt: string | null; qualified: boolean }>;
  rewards: Array<{ batch: number; plan: string; days: number; status: string; appliedAt: string | null; expiresAt: string | null }>;
};

const PLAN_NAME: Record<string, string> = { pro: "Pro", connect: "Pro Connect" };
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

export default function Referrals() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/user/referrals", { credentials: "include" })
      .then((res) => res.json().then((body) => ({ res, body })))
      .then(({ res, body }) => {
        if (!res.ok || !body?.success) throw new Error(body?.message || "Could not load referrals");
        setData(body.data as Summary);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load referrals"));
  }, []);

  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!data)
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );

  const reward = `${data.rule.rewardDays} days of ${PLAN_NAME[data.rule.rewardPlan] || data.rule.rewardPlan}`;
  const shareText = `I'm using AutoApply CV to auto-apply to jobs and reach recruiters. Sign up with my link: ${data.link}`;
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };
  const nativeShare = async () => {
    try {
      await navigator.share({ title: "AutoApply CV", text: shareText, url: data.link });
    } catch {
      // cancelled
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold leading-tight text-gray-900">
          <Gift className="h-5 w-5 text-fuchsia-600" /> Refer &amp; Earn
        </h1>
        <p className="mt-0.5 text-xs text-gray-500">
          Invite {data.rule.threshold} friends, get {reward}. A friend counts once they sign up with your link and finish
          onboarding.
        </p>
      </div>

      {!data.enabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Referral rewards are paused right now. Friends who join still count when they come back.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-fuchsia-200 bg-gradient-to-b from-fuchsia-50/70 to-white p-4 lg:col-span-2">
          <div className="text-xs font-semibold text-gray-700">Your referral link</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900">{data.link}</code>
            <button
              type="button"
              onClick={() => void copy(data.link, "Link")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-fuchsia-600 px-3 py-2 text-sm font-bold text-white hover:bg-fuchsia-700"
            >
              <Copy className="h-4 w-4" /> Copy
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Share on WhatsApp
            </a>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                type="button"
                onClick={() => void nativeShare()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Share2 className="h-3.5 w-3.5" /> Share…
              </button>
            )}
            <button
              type="button"
              onClick={() => void copy(data.code, "Code")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Code: <span className="font-mono">{data.code}</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold text-gray-700">Progress to your next reward</div>
          <div className="mt-2 text-3xl font-black text-gray-900">
            {data.progress}/{data.rule.threshold}
          </div>
          <div className="mt-2 flex gap-1.5" aria-hidden="true">
            {Array.from({ length: data.rule.threshold }, (_, i) => (
              <div key={i} className={`h-2 flex-1 rounded-full ${i < data.progress ? "bg-fuchsia-600" : "bg-gray-200"}`} />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            {data.capped
              ? "You've earned the maximum number of referral rewards. Thank you!"
              : `${data.rule.threshold - data.progress} more to unlock ${reward}.`}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["Joined", data.counts.signedUp],
              ["Counted", data.counts.qualified],
              ["Pending", data.counts.pending],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-gray-50 py-1.5">
                <div className="text-sm font-bold text-gray-900">{value}</div>
                <div className="text-[10px] text-gray-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
            <Users className="h-4 w-4 text-gray-500" /> Friends
          </h2>
          {data.friends.length ? (
            <ul className="mt-2 divide-y divide-gray-100">
              {data.friends.map((f, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-gray-900">
                    {f.name}
                    <span className="ml-2 text-[11px] text-gray-400">{fmtDate(f.joinedAt)}</span>
                  </span>
                  {f.qualified ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Counted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3.5 w-3.5" /> Finishing onboarding
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-gray-500">No one has joined with your link yet. Share it in a WhatsApp group to start.</p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
            <Gift className="h-4 w-4 text-gray-500" /> Rewards
          </h2>
          {data.rewards.length ? (
            <ul className="mt-2 divide-y divide-gray-100">
              {data.rewards.map((r) => (
                <li key={r.batch} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-gray-900">
                    {r.days} days of {PLAN_NAME[r.plan] || r.plan}
                  </span>
                  <span className="text-xs text-gray-500">
                    {r.status === "applied"
                      ? `Active until ${fmtDate(r.expiresAt)}`
                      : r.status === "pending"
                        ? "Starts when your current plan ends"
                        : r.status === "not_needed"
                          ? "You already have this plan"
                          : r.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-gray-500">Your rewards will show here.</p>
          )}
        </div>
      </div>
    </div>
  );
}
