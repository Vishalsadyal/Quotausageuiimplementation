import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  CheckCircle2,
  Contact,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { Switch } from "../../components/ui/switch";
import { useAuth } from "../../context/AuthContext";

// HR Contacts: recruiters other AutoApply CV users messaged from public LinkedIn hiring posts.
// Pro Connect gets 20 new contacts a day matched to their roles; everyone else sees a locked
// preview. The sharing switch is for every user (it controls whether THEIR sends add contacts).

type HrContactRow = {
  id: string;
  kind: "phone" | "email";
  value: string;
  recruiterName: string;
  company: string;
  jobTitle: string;
  location: string;
  postUrl: string;
  postSnippet: string;
  waStatus: string;
  emailStatus: string;
  lastSeenAt: string;
  contributorCount: number;
};
type Delivery = { id: string; day: string; sentAt: string | null; contact: HrContactRow };
type Settings = { shareOutreachContacts: boolean; dailyEmail: boolean };
type HrContactsData =
  | {
      unlocked: false;
      dailyLimit: number;
      settings: Settings;
      preview: { freshThisWeek: number; matchingYourRoles: number; samples: Array<{ jobTitle: string; company: string }> };
    }
  | {
      unlocked: true;
      day: string;
      dailyLimit: number;
      settings: Settings;
      roles: string[];
      today: Delivery[];
      history: Delivery[];
    };

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

function introMessage(c: HrContactRow, myName: string) {
  const greeting = c.recruiterName && c.recruiterName !== "Recruiter" ? `Hi ${c.recruiterName.split(" ")[0]},` : "Hi,";
  const role = c.jobTitle ? `the ${c.jobTitle} role` : "your opening";
  const at = c.company ? ` at ${c.company}` : "";
  return `${greeting}\n\nI saw your post about ${role}${at} and I'd love to be considered. I think my experience is a strong fit, and I can share my resume right away.\n\nThanks,\n${myName}`;
}

export default function HrContacts() {
  const { user } = useAuth();
  const [data, setData] = useState<HrContactsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"today" | "history">("today");
  const [savingSetting, setSavingSetting] = useState<keyof Settings | null>(null);
  const [composeFor, setComposeFor] = useState<Delivery | null>(null);

  const load = useCallback(async (withHistory = false) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/user/hr-contacts${withHistory ? "?history=1" : ""}`, { credentials: "include" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) throw new Error(body?.message || "Could not load HR contacts");
      setData(body.data as HrContactsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load HR contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab === "history");
  }, [load, tab]);

  const saveSetting = async (key: keyof Settings, value: boolean) => {
    if (!data) return;
    setSavingSetting(key);
    const previous = data.settings;
    setData({ ...data, settings: { ...previous, [key]: value } } as HrContactsData);
    try {
      const res = await fetch("/api/user/hr-contacts", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error();
      toast.success("Saved");
    } catch {
      setData({ ...data, settings: previous } as HrContactsData);
      toast.error("Could not save, try again");
    } finally {
      setSavingSetting(null);
    }
  };

  const markSent = async (delivery: Delivery) => {
    setData((d) =>
      d && d.unlocked
        ? {
            ...d,
            today: d.today.map((x) => (x.id === delivery.id ? { ...x, sentAt: new Date().toISOString() } : x)),
            history: d.history.map((x) => (x.id === delivery.id ? { ...x, sentAt: new Date().toISOString() } : x)),
          }
        : d
    );
    await fetch("/api/user/hr-contacts/sent", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryId: delivery.id }),
    }).catch(() => null);
  };

  const openWhatsApp = (delivery: Delivery) => {
    const text = encodeURIComponent(introMessage(delivery.contact, user?.name || ""));
    window.open(`https://wa.me/${delivery.contact.value}?text=${text}`, "_blank", "noopener");
    void markSent(delivery);
  };

  const copyValue = async (c: HrContactRow) => {
    try {
      await navigator.clipboard.writeText(c.kind === "phone" ? `+${c.value}` : c.value);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const historyByDay = useMemo(() => {
    if (!data?.unlocked) return [];
    const groups = new Map<string, Delivery[]>();
    for (const d of data.history) groups.set(d.day, [...(groups.get(d.day) || []), d]);
    return Array.from(groups.entries());
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight flex items-center gap-2">
            <Contact className="w-5 h-5 text-emerald-600" />
            HR Contacts
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Recruiters who recently shared their WhatsApp or email in LinkedIn hiring posts, matched to the roles you want.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(tab === "history")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!data && loading && (
        <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white py-16 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading contacts…
        </div>
      )}

      {data && data.unlocked === false && <LockedView data={data} />}

      {data?.unlocked && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 text-xs font-semibold">
              {(["today", "history"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-3 py-1.5 ${tab === t ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                >
                  {t === "today" ? `Today (${data.today.length}/${data.dailyLimit})` : "Earlier"}
                </button>
              ))}
            </div>
            {data.roles.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-gray-500">
                Matched to:
                {data.roles.slice(0, 8).map((r) => (
                  <span key={r} className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>

          {tab === "today" &&
            (data.today.length ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {data.today.map((d) => (
                  <ContactCard key={d.id} delivery={d} onWhatsApp={openWhatsApp} onEmail={setComposeFor} onCopy={copyValue} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
                No new contacts right now. New recruiters are added all day, check back later.
              </div>
            ))}

          {tab === "history" &&
            (historyByDay.length ? (
              historyByDay.map(([day, items]) => (
                <div key={day} className="space-y-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">{day}</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {items.map((d) => (
                      <ContactCard key={d.id} delivery={d} onWhatsApp={openWhatsApp} onEmail={setComposeFor} onCopy={copyValue} />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
                {loading ? "Loading…" : "Contacts from earlier days will show here."}
              </div>
            ))}
        </>
      )}

      {data && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-900">Settings</h2>
          <SettingRow
            title="Share recruiters I message"
            description="When you send a WhatsApp or email from the extension, the recruiter's name, contact and role are added to the shared HR Contacts list. Turning this off stops your future sends from being added."
            checked={data.settings.shareOutreachContacts}
            busy={savingSetting === "shareOutreachContacts"}
            onChange={(v) => void saveSetting("shareOutreachContacts", v)}
          />
          {data.unlocked && (
            <SettingRow
              title="Email me my contacts every morning"
              description={`Your ${data.dailyLimit} contacts for the day, sent to ${user?.email || "your email"} at about 9 AM IST.`}
              checked={data.settings.dailyEmail}
              busy={savingSetting === "dailyEmail"}
              onChange={(v) => void saveSetting("dailyEmail", v)}
            />
          )}
        </div>
      )}

      {composeFor && (
        <EmailComposer
          delivery={composeFor}
          myName={user?.name || ""}
          onClose={() => setComposeFor(null)}
          onSent={() => {
            void markSent(composeFor);
            setComposeFor(null);
          }}
        />
      )}
    </div>
  );
}

function LockedView({ data }: { data: Extract<HrContactsData, { unlocked: false }> }) {
  const { preview } = data;
  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
            <Lock className="w-3 h-3" /> Pro Connect
          </div>
          <h2 className="mt-2 text-base font-bold text-gray-900">
            {preview.matchingYourRoles > 0
              ? `${preview.matchingYourRoles} recruiters hiring for your roles this week`
              : `${preview.freshThisWeek} recruiters shared their contact this week`}
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            Get {data.dailyLimit} new HR contacts every day, WhatsApp-checked numbers and recruiter emails from real hiring
            posts, plus an email with the list every morning. Includes everything in Pro.
          </p>
        </div>
        <Link
          to="/dashboard/billing"
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
        >
          Upgrade to Pro Connect · ₹500/month
        </Link>
      </div>

      {preview.samples.length > 0 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
          {preview.samples.map((s, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
              <div className="text-xs font-semibold text-gray-900">{s.jobTitle || "Hiring"}</div>
              <div className="text-[11px] text-gray-500">{s.company || "Company"}</div>
              <div className="mt-1 select-none text-xs text-gray-400 blur-[3px]" aria-hidden="true">
                +91 98•••• ••••• · recruiter@••••.com
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactCard({
  delivery,
  onWhatsApp,
  onEmail,
  onCopy,
}: {
  delivery: Delivery;
  onWhatsApp: (d: Delivery) => void;
  onEmail: (d: Delivery) => void;
  onCopy: (c: HrContactRow) => void;
}) {
  const c = delivery.contact;
  const isPhone = c.kind === "phone";
  const verified = isPhone ? c.waStatus === "valid" : c.emailStatus === "valid";
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-900 truncate">{c.jobTitle || "Hiring"}</div>
          <div className="text-xs text-gray-500 truncate">
            {[c.company, c.recruiterName, c.location].filter(Boolean).join(" · ") || "Recruiter"}
          </div>
        </div>
        {delivery.sentAt ? (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
            <CheckCircle2 className="w-3 h-3" /> Sent
          </span>
        ) : (
          <span className="shrink-0 text-[10px] text-gray-400">posted {timeAgo(c.lastSeenAt)}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {isPhone ? <MessageCircle className="w-4 h-4 text-emerald-600" /> : <Mail className="w-4 h-4 text-sky-600" />}
        <span className="font-medium text-gray-900 break-all">{isPhone ? `+${c.value}` : c.value}</span>
        {verified && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            {isPhone ? "On WhatsApp" : "Email OK"}
          </span>
        )}
        {c.contributorCount > 1 && <span className="text-[10px] text-gray-400">found by {c.contributorCount} users</span>}
      </div>

      {c.postSnippet && <p className="text-[11px] leading-relaxed text-gray-500 line-clamp-2">{c.postSnippet}</p>}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {isPhone ? (
          <button
            type="button"
            onClick={() => onWhatsApp(delivery)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onEmail(delivery)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700"
          >
            <Send className="w-3.5 h-3.5" /> Email
          </button>
        )}
        <button
          type="button"
          onClick={() => onCopy(c)}
          className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <Copy className="w-3.5 h-3.5" /> Copy
        </button>
        {c.postUrl && (
          <a
            href={c.postUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Post
          </a>
        )}
      </div>
    </div>
  );
}

function SettingRow({
  title,
  description,
  checked,
  busy,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  busy: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-xs font-semibold text-gray-900">{title}</div>
        <p className="text-[11px] text-gray-500 mt-0.5 max-w-2xl">{description}</p>
      </div>
      <Switch checked={checked} disabled={busy} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}

// Sends through the existing HR outreach mailer: from AutoApply CV, replies go to the user.
function EmailComposer({
  delivery,
  myName,
  onClose,
  onSent,
}: {
  delivery: Delivery;
  myName: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const c = delivery.contact;
  const [subject, setSubject] = useState(`Application: ${c.jobTitle || "your opening"}${c.company ? ` at ${c.company}` : ""}`);
  const [body, setBody] = useState(introMessage(c, myName));
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/user/hr-outreach/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: c.value, toName: c.recruiterName, subject, body, company: c.company }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) throw new Error(result?.error || "Email not sent");
      toast.success(`Email sent to ${c.value}`);
      onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Email not sent");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="Email recruiter">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-gray-900">Email {c.recruiterName || "recruiter"}</div>
            <div className="text-[11px] text-gray-500 truncate">To {c.value} · replies come to your email</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2 p-4">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            aria-label="Subject"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={9}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            aria-label="Message"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !subject.trim() || !body.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send email
          </button>
        </div>
      </div>
    </div>
  );
}
