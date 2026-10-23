import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, CreditCard, FileUp, Handshake, KeyRound, Loader2, MessageCircle, RefreshCw, Search, Trash2, UserPlus, X } from "lucide-react";

// Admin > Agency: add a candidate, send them a Razorpay payment link on WhatsApp, and send their login
// details. Paying the link switches the plan on automatically (Razorpay webhook payment_link.paid).

type Plan = "pro" | "coach" | "connect";
type Client = {
  id: string;
  createdAccount: boolean;
  note: string;
  linkUrl: string | null;
  linkPlan: Plan | "free" | null;
  linkAmountPaise: number | null;
  linkStatus: "none" | "created" | "paid" | "expired" | "cancelled";
  linkCreatedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  paymentWhatsappUrl: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    currentCity: string | null;
    plan: "free" | Plan;
    planExpiresAt: string | null;
    onboardingCompleted: boolean;
  };
};
// A WhatsApp message ready to send, shown in a panel so it can also be copied.
type Outbox = { title: string; message: string; whatsappUrl: string; password?: string | null };

const PLAN_OPTIONS: Array<{ value: Plan; label: string; rupees: number }> = [
  { value: "connect", label: "Pro Connect", rupees: 500 },
  { value: "pro", label: "Pro", rupees: 99 },
  { value: "coach", label: "Coach", rupees: 1849 },
];
const planLabel = (plan: string) => PLAN_OPTIONS.find((p) => p.value === plan)?.label || "Free";

const linkBadge: Record<Client["linkStatus"], { label: string; className: string }> = {
  none: { label: "No link", className: "bg-gray-100 text-gray-600 border-gray-200" },
  created: { label: "Link sent", className: "bg-amber-100 text-amber-800 border-amber-200" },
  paid: { label: "Paid", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  expired: { label: "Link expired", className: "bg-rose-100 text-rose-700 border-rose-200" },
  cancelled: { label: "Link cancelled", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

const EMPTY_FORM = { name: "", email: "", phone: "", currentCity: "", roles: "", experienceYears: "", note: "" };
type FormKey = keyof typeof EMPTY_FORM;
const FIELD_LABEL: Record<FormKey, string> = {
  name: "Full name",
  email: "Email (their login)",
  phone: "WhatsApp number",
  roles: "Target roles",
  experienceYears: "Years of experience",
  currentCity: "City",
  note: "Note (only you see this)",
};
const FORM_FIELDS: Array<{ key: FormKey; required?: boolean; placeholder?: string }> = [
  { key: "name", required: true },
  { key: "email", required: true },
  { key: "phone", required: true, placeholder: "98765 43210" },
  { key: "roles", placeholder: "Full Stack Developer, React Developer" },
  { key: "experienceYears" },
  { key: "currentCity" },
  { key: "note", placeholder: "Referred by…, notice period…" },
];
// Fields the resume is expected to give; any left empty after reading it are flagged for the admin.
const RESUME_FIELDS: FormKey[] = ["name", "email", "phone", "roles", "experienceYears", "currentCity"];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const res = await fetch(url, { credentials: "include", ...(isForm ? {} : { headers: { "Content-Type": "application/json" } }), ...init });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) throw new Error(body?.message || "Request failed");
  return body.data as T;
}

export default function Agency() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [resume, setResume] = useState<File | null>(null);
  const [stage, setStage] = useState<"upload" | "details">("upload");
  const [parsing, setParsing] = useState(false);
  const [notFound, setNotFound] = useState<FormKey[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // `${clientId}:${action}`
  const [linkPlan, setLinkPlan] = useState<Record<string, Plan>>({});
  const [linkAmount, setLinkAmount] = useState<Record<string, string>>({});
  const [outbox, setOutbox] = useState<Outbox | null>(null);

  const load = useCallback(async (q = "") => {
    try {
      const data = await api<{ clients: Client[] }>(`/api/admin/agency${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      setClients(data.clients);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load candidates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Flagged until the admin types a value.
  const missing = notFound.filter((k) => !form[k].trim());

  const resetAdd = () => {
    setForm(EMPTY_FORM);
    setResume(null);
    setNotFound([]);
    setStage("upload");
  };

  const readResume = async (file: File) => {
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("resume", file);
      const data = await api<{ profile: Omit<typeof EMPTY_FORM, "note"> }>("/api/admin/agency/parse-resume", { method: "POST", body: fd });
      const next = { ...EMPTY_FORM, ...data.profile };
      setForm(next);
      setResume(file);
      setNotFound(RESUME_FIELDS.filter((k) => !next[k].trim()));
      setStage("details");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read the resume");
    } finally {
      setParsing(false);
    }
  };

  const addCandidate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error("Name, email and WhatsApp number are required");
      return;
    }
    setAdding(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (resume) fd.append("resume", resume);
      const data = await api<{ client: Client; tempPassword: string | null }>("/api/admin/agency", { method: "POST", body: fd });
      toast.success(data.tempPassword ? "Account created. Now create the payment link." : "Existing account added to Agency");
      resetAdd();
      await load(query);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add candidate");
    } finally {
      setAdding(false);
    }
  };

  const act = async <T,>(client: Client, action: string, body: Record<string, unknown>) => {
    setBusy(`${client.id}:${action}`);
    try {
      return await api<T>(`/api/admin/agency/${client.id}`, { method: "POST", body: JSON.stringify({ action, ...body }) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const createLink = async (client: Client) => {
    const plan = linkPlan[client.id] || "connect";
    // Left unchanged, the server uses the plan's configured price.
    const amountRupees = linkAmount[client.id] ? Math.round(Number(linkAmount[client.id])) : undefined;
    if (client.linkStatus === "created" && !window.confirm("This cancels the link already sent and creates a new one. Continue?")) return;
    const data = await act<{ linkUrl: string; message: string; whatsappUrl: string }>(client, "payment_link", { plan, amountRupees });
    if (!data) return;
    setOutbox({ title: `Payment link for ${client.user.name}`, message: data.message, whatsappUrl: data.whatsappUrl });
    await load(query);
  };

  const checkPayment = async (client: Client) => {
    const data = await act<{ status: string; activated: boolean }>(client, "check_payment", {});
    if (!data) return;
    if (data.activated) toast.success(`${client.user.name} paid: plan activated`);
    else toast.message(data.status === "paid" ? "Already paid and active" : `Link status: ${data.status}`);
    await load(query);
  };

  const markPaid = async (client: Client) => {
    const plan = linkPlan[client.id] || (client.linkPlan as Plan) || "connect";
    const entered = window.prompt(`Amount received for ${planLabel(plan)} (₹). This activates the plan for 30 days.`, String(PLAN_OPTIONS.find((p) => p.value === plan)?.rupees || 500));
    if (entered === null) return;
    const amountRupees = Math.round(Number(entered));
    if (!Number.isFinite(amountRupees) || amountRupees < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const reference = window.prompt("Payment reference (UPI ref, optional)") || "";
    const data = await act<{ planExpiresAt: string | null }>(client, "mark_paid", { plan, amountRupees, reference });
    if (!data) return;
    toast.success(`Plan activated${data.planExpiresAt ? ` until ${formatDate(data.planExpiresAt)}` : ""}`);
    await load(query);
  };

  const loginDetails = async (client: Client) => {
    if (client.createdAccount && !window.confirm(`This sets a new temporary password for ${client.user.email}. Any password they set before stops working. Continue?`)) return;
    const data = await act<{ message: string; whatsappUrl: string; password: string | null }>(client, "login_details", {});
    if (!data) return;
    setOutbox({ title: `Login details for ${client.user.name}`, message: data.message, whatsappUrl: data.whatsappUrl, password: data.password });
  };

  const remove = async (client: Client) => {
    if (!window.confirm(`Remove ${client.user.name} from the Agency list? Their account and plan stay as they are.`)) return;
    try {
      await api(`/api/admin/agency/${client.id}`, { method: "DELETE" });
      await load(query);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const field = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
  const label = "mb-1 block text-xs font-semibold text-gray-600";
  const btn = "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-60";
  const isBusy = (client: Client, action: string) => busy === `${client.id}:${action}`;

  const stats = [
    ["Candidates", clients.length],
    ["Link sent", clients.filter((c) => c.linkStatus === "created").length],
    ["Paid", clients.filter((c) => c.paidAt).length],
    ["Active plan", clients.filter((c) => c.user.plan !== "free").length],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Handshake className="h-6 w-6 text-indigo-600" /> Agency
          </h1>
          <p className="text-sm text-gray-500">Add candidates, send payment links and login details on WhatsApp.</p>
        </div>
        <button type="button" onClick={() => void load(query)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={String(k)} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">{k}</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{v}</div>
          </div>
        ))}
      </div>

      {/* Add candidate: resume first, then whatever the resume did not have */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <UserPlus className="h-5 w-5 text-indigo-600" /> Add candidate
          </h2>
          {stage === "details" && (
            <button type="button" onClick={resetAdd} className="text-xs font-semibold text-gray-500 hover:text-gray-800">
              Start over
            </button>
          )}
        </div>
        <p className="mb-4 text-xs text-gray-500">
          Creates their account (or adds an existing one with the same email). These details pre-fill their onboarding.
        </p>

        {stage === "upload" ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 p-6 text-center">
            <FileUp className="mx-auto h-8 w-8 text-indigo-500" />
            <p className="mt-2 text-sm font-semibold text-gray-800">Step 1: Upload the candidate's resume</p>
            <p className="text-xs text-gray-500">PDF or DOCX, up to 5 MB. We read their name, email, phone, city, roles and experience.</p>
            <label className={`mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 ${parsing ? "pointer-events-none opacity-60" : ""}`}>
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              {parsing ? "Reading resume…" : "Choose resume"}
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                className="sr-only"
                disabled={parsing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void readResume(file);
                }}
              />
            </label>
            <div className="mt-3">
              <button type="button" onClick={() => setStage("details")} className="text-xs font-semibold text-gray-500 underline hover:text-gray-800">
                No resume? Enter details manually
              </button>
            </div>
          </div>
        ) : (
          <>
            {resume && (
              <p className="mb-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                Read from <span className="font-semibold">{resume.name}</span>. Check the details
                {missing.length ? <>, and fill in what was not found: <span className="font-semibold">{missing.map((k) => FIELD_LABEL[k]).join(", ")}</span>.</> : "."}
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FORM_FIELDS.map((f) => {
                const isMissing = missing.includes(f.key);
                return (
                  <div key={f.key} className={f.key === "note" ? "sm:col-span-2" : ""}>
                    <label className={label} htmlFor={`ag-${f.key}`}>
                      {FIELD_LABEL[f.key]}
                      {f.required ? " *" : ""}
                      {isMissing && <span className="ml-1 font-normal text-amber-600">(not in resume)</span>}
                    </label>
                    <input
                      id={`ag-${f.key}`}
                      type={f.key === "email" ? "email" : "text"}
                      placeholder={f.placeholder}
                      className={`${field} ${isMissing ? "border-amber-400 bg-amber-50" : ""}`}
                      value={form[f.key]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={() => void addCandidate()} disabled={adding} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add candidate
            </button>
          </>
        )}
      </section>

      {/* Candidates */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900">Candidates</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load(query);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, email or phone" className="rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm" />
            </div>
          </form>
        </div>

        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        ) : clients.length === 0 ? (
          <p className="text-sm text-gray-500">No candidates yet. Add one above.</p>
        ) : (
          <div className="space-y-3">
            {clients.map((c) => {
              const plan = linkPlan[c.id] || "connect";
              const badge = linkBadge[c.linkStatus];
              return (
                <div key={c.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900">{c.user.name}</div>
                      <div className="text-xs text-gray-500">
                        {c.user.email} · {c.user.phone || "no phone"}
                        {c.user.currentCity ? ` · ${c.user.currentCity}` : ""}
                      </div>
                      {c.note && <div className="mt-1 text-xs text-gray-500">Note: {c.note}</div>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`rounded-full border px-2.5 py-1 font-semibold ${badge.className}`}>
                        {badge.label}
                        {c.linkStatus !== "none" && c.linkAmountPaise ? ` · ₹${Math.round(c.linkAmountPaise / 100)}` : ""}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 font-semibold ${c.user.plan === "free" ? "border-gray-200 bg-gray-100 text-gray-600" : "border-violet-200 bg-violet-100 text-violet-800"}`}>
                        {planLabel(c.user.plan)}
                        {c.user.plan !== "free" && c.user.planExpiresAt ? ` until ${formatDate(c.user.planExpiresAt)}` : ""}
                      </span>
                      {!c.user.onboardingCompleted && <span className="rounded-full border border-gray-200 px-2.5 py-1 text-gray-500">Onboarding pending</span>}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Plan"
                      value={plan}
                      onChange={(e) => setLinkPlan({ ...linkPlan, [c.id]: e.target.value as Plan })}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                    >
                      {PLAN_OPTIONS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    <input
                      aria-label="Amount in rupees"
                      type="number"
                      min={1}
                      value={linkAmount[c.id] ?? String(PLAN_OPTIONS.find((p) => p.value === plan)?.rupees)}
                      onChange={(e) => setLinkAmount({ ...linkAmount, [c.id]: e.target.value })}
                      className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                    />
                    <button type="button" onClick={() => void createLink(c)} disabled={isBusy(c, "payment_link")} className={`${btn} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`}>
                      {isBusy(c, "payment_link") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                      {c.linkStatus === "none" ? "Create payment link" : "New payment link"}
                    </button>
                    {c.paymentWhatsappUrl && (
                      <a href={c.paymentWhatsappUrl} target="_blank" rel="noreferrer" className={`${btn} border-emerald-600 text-emerald-700 hover:bg-emerald-50`}>
                        <MessageCircle className="h-3.5 w-3.5" /> Resend link on WhatsApp
                      </a>
                    )}
                    {c.linkUrl && c.linkStatus === "created" && (
                      <button type="button" onClick={() => void checkPayment(c)} disabled={isBusy(c, "check_payment")} className={`${btn} border-gray-300 text-gray-700 hover:bg-gray-50`}>
                        {isBusy(c, "check_payment") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Check payment
                      </button>
                    )}
                    <button type="button" onClick={() => void markPaid(c)} disabled={isBusy(c, "mark_paid")} className={`${btn} border-gray-300 text-gray-700 hover:bg-gray-50`}>
                      Mark paid (UPI/cash)
                    </button>
                    <button type="button" onClick={() => void loginDetails(c)} disabled={isBusy(c, "login_details")} className={`${btn} border-emerald-600 text-emerald-700 hover:bg-emerald-50`}>
                      {isBusy(c, "login_details") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />} Send login details
                    </button>
                    <button type="button" onClick={() => void remove(c)} className={`${btn} ml-auto border-transparent text-gray-400 hover:text-rose-600`} aria-label="Remove from Agency list">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Message ready to send */}
      {outbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{outbox.title}</h3>
              <button type="button" onClick={() => setOutbox(null)} aria-label="Close" className="text-gray-400 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            {outbox.password && (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Temporary password: <span className="font-mono font-bold">{outbox.password}</span>. It is shown only now; send it before closing.
              </p>
            )}
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-800">{outbox.message}</pre>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={outbox.whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                <MessageCircle className="h-4 w-4" /> Send on WhatsApp
              </a>
              <button type="button" onClick={() => void copy(outbox.message)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                <Copy className="h-4 w-4" /> Copy message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
