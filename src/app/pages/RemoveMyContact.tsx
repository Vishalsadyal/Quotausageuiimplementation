import { useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

// Public opt-out for recruiters: removes their phone / email from HR Contacts and blocks it from
// being added again. No account needed (removal only ever takes data away).
export default function RemoveMyContact() {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!phone.trim() && !email.trim()) {
      setError("Enter your phone number or email.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/public/hr-contacts/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() || undefined, email: email.trim() || undefined }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) throw new Error(body?.message || "Something went wrong, please try again.");
      setDone(body.message || "Removed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong, please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20 pb-16">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 relative">
          <div className="inline-flex items-center rounded-full bg-purple-100 px-4 py-2 text-sm font-semibold text-purple-700">
            For recruiters
          </div>
          <h1 className="mt-6 text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">Remove my contact details</h1>
          <p className="mt-6 text-lg text-gray-600 leading-relaxed">
            AutoApply CV users can share recruiter contact details that were published in public LinkedIn hiring posts.
            If you don't want job seekers to receive your phone number or email through AutoApply CV, enter it below. We
            delete it and stop it from being added again.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-xl mx-auto px-6">
          {done ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-800">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-5 h-5" /> {done}
              </div>
              <p className="mt-2 text-sm">You can remove another number or email any time from this page.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4 rounded-2xl border border-gray-200 p-6 shadow-sm">
              <label className="block">
                <span className="text-sm font-medium text-gray-800">Phone number (with country code)</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base"
                  autoComplete="tel"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-800">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base"
                  autoComplete="email"
                />
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Remove my details
              </button>
              <p className="text-xs text-gray-500">
                We keep only a one-way hash of what you remove, so it can't be added back. Questions? Contact us at the
                email on our Contact page.
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
