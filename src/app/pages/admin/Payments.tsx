import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, RefreshCw, XCircle } from "lucide-react";

type Mode = "live" | "test";
type Status = {
  keyId: boolean;
  keySecret: boolean;
  webhookSecret: boolean;
  planPro: boolean;
  planConnect: boolean;
  planCoach: boolean;
  keyPrefixOk: boolean;
};
type Data = { mode: Mode; live: Status; test: Status };

const CHECKS: Array<[keyof Status, string]> = [
  ["keyId", "Key ID"],
  ["keySecret", "Key secret"],
  ["webhookSecret", "Webhook secret"],
  ["planPro", "Pro plan ID"],
  ["planConnect", "Connect plan ID"],
  ["planCoach", "Coach plan ID"],
];

export default function Payments() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Mode | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/settings/payments", { credentials: "include" });
      const body = await res.json();
      if (!res.ok || !body?.success) throw new Error(body?.message || "Failed to load payment settings");
      setData(body.data as Data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payment settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const switchTo = async (mode: Mode) => {
    if (!data || data.mode === mode || saving) return;
    if (mode === "live" && !window.confirm("Switch to LIVE? Customers will be charged real money.")) return;
    if (mode === "test" && !window.confirm("Switch to TEST? Customers on the site will see a test checkout and nothing real is charged.")) return;
    try {
      setSaving(mode);
      setError("");
      setNotice("");
      const res = await fetch("/api/admin/settings/payments", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) throw new Error(body?.message || "Could not switch mode");
      setData(body.data as Data);
      setNotice(body.message || "Saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch mode");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <CreditCard className="h-4 w-4 text-indigo-500" />
            Payments
          </h1>
          <p className="text-sm text-gray-600">Choose whether Razorpay charges real money (Live) or runs test payments (Test).</p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div> : null}

      {data ? (
        <>
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              data.mode === "live" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {data.mode === "live" ? (
              <>
                Mode is <b>LIVE</b>: real customers pay real money.
              </>
            ) : (
              <>
                <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                Mode is <b>TEST</b>: no real money moves. Payments made now still show on the Revenue page, so switch back to Live before real customers pay.
              </>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {(["test", "live"] as const).map((mode) => {
              const status = data[mode];
              const ready = status.keyId && status.keySecret && status.keyPrefixOk;
              const active = data.mode === mode;
              return (
                <div key={mode} className={`rounded-2xl border bg-white p-5 shadow-sm ${active ? "border-indigo-400 ring-2 ring-indigo-100" : "border-gray-200"}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-bold capitalize text-gray-900">{mode} mode</h2>
                    {active ? <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">ACTIVE</span> : null}
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {CHECKS.map(([key, label]) => (
                      <li key={key} className="flex items-center justify-between">
                        <span className="text-gray-700">{label}</span>
                        {status[key] ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> set
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-600">
                            <XCircle className="h-3.5 w-3.5" /> missing
                          </span>
                        )}
                      </li>
                    ))}
                    {status.keyId && !status.keyPrefixOk ? (
                      <li className="text-rose-600">Key ID does not start with rzp_{mode}_ — wrong key in the {mode.toUpperCase()} variable.</li>
                    ) : null}
                  </ul>
                  <button
                    onClick={() => void switchTo(mode)}
                    disabled={active || !ready || saving !== null}
                    className={`mt-4 w-full rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      mode === "live" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-amber-500 text-white hover:bg-amber-600"
                    }`}
                  >
                    {active ? "Currently active" : saving === mode ? "Switching..." : ready ? `Switch to ${mode}` : "Keys incomplete on server"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
            The keys are read from the server environment (<code>RZP_KEY_ID_TEST</code>, <code>RZP_KEY_ID_LIVE</code>, and so on) and are never shown here or stored in the database. Only the choice Live or Test is saved. The change takes effect within a few seconds. Webhooks are accepted from both modes, so a Razorpay event is never lost when you switch.
          </div>
        </>
      ) : loading ? (
        <div className="text-sm text-gray-500">Loading...</div>
      ) : null}
    </div>
  );
}
