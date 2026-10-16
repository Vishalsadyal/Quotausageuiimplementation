import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, MessageCircle, Mail, MessageSquareText, RefreshCw, Sparkles } from "lucide-react";

// Auto Apply > Messages: the text the extension's WhatsApp, Email and LinkedIn comment tools send,
// and how each tool runs. Saved on the account and handed to the extension.

type WhatsappSettings = {
  messageTemplate: string;
  targetKeywords: string[];
  ignoreKeywords: string[];
  autoSendWhatsApp: boolean;
  autoCloseTab: boolean;
  autoLikePosts: boolean;
  filterJobSeekers: boolean;
  matchAllHiringPosts: boolean;
  removeSentPostFromFeed: boolean;
  autoScroll: boolean;
  delayBetweenMessages: number;
};

type EmailSettings = {
  subjectTemplate: string;
  messageTemplate: string;
  targetKeywords: string[];
  ignoreKeywords: string[];
  emailClient: "gmail_web" | "mailto";
  autoCloseTab: boolean;
  autoLikePosts: boolean;
  filterJobSeekers: boolean;
  matchAllHiringPosts: boolean;
  removeSentPostFromFeed: boolean;
  autoScroll: boolean;
  delayBetweenEmails: number;
};

type CommentSettings = {
  commentText: string;
  delaySec: number;
  maxComments: number;
  autoLike: boolean;
  autoScroll: boolean;
  skipJobSeekers: boolean;
  skipAlreadyLiked: boolean;
  filterKeywords: string;
  ignoreKeywords: string[];
};

type Messages = { wa: WhatsappSettings; email: EmailSettings; comment: CommentSettings };
type ToolId = "wa" | "email" | "comment";

/**
 * "Skip posts that mention" starts with these. Clear job-seeker signals only: phrases recruiters also use
 * ("I am looking for a developer", "actively hiring") are left out so a default never blocks a real hiring post.
 * The extension has the same list as its own default (CareerPilotLinkedInExtension: outreach_ui.js, background.js).
 */
const DEFAULT_SKIP_KEYWORDS = ["open to work", "#opentowork", "looking for a job", "looking for a new job", "looking for new opportunities", "seeking new opportunities", "job seeker", "#jobseeker", "#fresherjobseeker"];

const COMMENT_LIMIT = 1250; // LinkedIn's own comment length limit

const TOOLS: Array<{ id: ToolId; label: string; icon: typeof MessageCircle; blurb: string }> = [
  { id: "wa", label: "WhatsApp", icon: MessageCircle, blurb: "Sent from WhatsApp Web to recruiters who post a phone number." },
  { id: "email", label: "Email", icon: Mail, blurb: "Sent to recruiters who post an email address." },
  { id: "comment", label: "LinkedIn comment", icon: MessageSquareText, blurb: "Posted as a comment on hiring posts." },
];

const TOKENS: Record<ToolId, Array<{ token: string; sample: string }>> = {
  wa: [
    { token: "{name}", sample: "Priya" },
    { token: "{job_title}", sample: "Full Stack Developer" },
    { token: "{company}", sample: "Acme Corp" },
    { token: "{phone}", sample: "919876543210" },
  ],
  email: [
    { token: "{name}", sample: "Priya" },
    { token: "{job_title}", sample: "Full Stack Developer" },
    { token: "{company}", sample: "Acme Corp" },
    { token: "{email}", sample: "priya@acme.com" },
  ],
  comment: [],
};

function fillSample(text: string, tool: ToolId) {
  let out = text;
  for (const { token, sample } of TOKENS[tool]) out = out.split(token).join(sample);
  return out;
}

// The extension's own starter keyword list is one person's niche; it is not the user's choice.
function isBuiltInKeywordList(list: string[]) {
  const joined = list.join(" ").toLowerCase();
  return joined.includes("wordpress") && joined.includes("electrical") && joined.includes("field engineer");
}

function personalDefaults(name: string, link: string, keywords: string[]): Messages {
  const who = name.trim() || "";
  const portfolio = link.trim();
  const sign = who ? `Best regards,\n${who}` : "Best regards";
  const portfolioLine = portfolio ? `\n\nHere is my work, if useful:\n${portfolio}` : "";
  return {
    wa: {
      messageTemplate: `Hi {name}!\n\nI saw your hiring post on LinkedIn about the {job_title} role.\n\nI am actively looking for new opportunities.${portfolioLine}\n\nI would love to connect and share more details.\n\n${sign}`,
      targetKeywords: keywords,
      ignoreKeywords: [...DEFAULT_SKIP_KEYWORDS],
      autoSendWhatsApp: true,
      autoCloseTab: true,
      autoLikePosts: true,
      filterJobSeekers: true,
      matchAllHiringPosts: true,
      removeSentPostFromFeed: false,
      autoScroll: true,
      delayBetweenMessages: 4,
    },
    email: {
      subjectTemplate: who ? `Application for {job_title} - ${who}` : "Application for {job_title}",
      messageTemplate: `Hi {name},\n\nI saw your hiring post on LinkedIn about the {job_title} role at {company}.\n\nI am actively looking for new opportunities and would be glad to share my profile.${portfolioLine}\n\nThank you for your time.\n\n${sign}`,
      targetKeywords: keywords,
      ignoreKeywords: [...DEFAULT_SKIP_KEYWORDS],
      emailClient: "gmail_web",
      autoCloseTab: false,
      autoLikePosts: false,
      filterJobSeekers: true,
      matchAllHiringPosts: true,
      removeSentPostFromFeed: false,
      autoScroll: true,
      delayBetweenEmails: 5,
    },
    comment: {
      commentText: `Hi! I am actively looking for new opportunities.${portfolio ? ` Here is my work: ${portfolio}` : ""}`,
      delaySec: 4,
      maxComments: 25,
      autoLike: true,
      autoScroll: true,
      skipJobSeekers: true,
      skipAlreadyLiked: true,
      filterKeywords: "",
      ignoreKeywords: [...DEFAULT_SKIP_KEYWORDS],
    },
  };
}

function mergeGroup<T extends object>(base: T, incoming: unknown): T {
  if (!incoming || typeof incoming !== "object") return base;
  const out = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(base)) {
    const value = (incoming as Record<string, unknown>)[key];
    if (value === undefined || value === null) continue;
    if (typeof (base as Record<string, unknown>)[key] === typeof value || Array.isArray(value)) out[key] = value;
  }
  return out as T;
}

/** Every tool shares one "skip posts that mention" list; older saves may differ per tool, so keep every word, once. */
function mergeSkipLists(...lists: Array<string[] | undefined>) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list || []) {
      const word = String(raw || "").trim();
      const key = word.toLowerCase();
      if (!word || seen.has(key)) continue;
      seen.add(key);
      out.push(word);
    }
  }
  return out;
}

function mergeMessages(base: Messages, incoming: Partial<Record<ToolId, unknown>> | null | undefined): Messages {
  if (!incoming) return base;
  return {
    wa: mergeGroup(base.wa, incoming.wa),
    email: mergeGroup(base.email, incoming.email),
    comment: mergeGroup(base.comment, incoming.comment),
  };
}

// Talks to the extension through the page bridge (src/dashboard/dashboard-bridge.js in the extension).
function callExtension(type: "CP_WEB_GET_OUTREACH" | "CP_WEB_SYNC_OUTREACH", settings?: Partial<Messages>) {
  return new Promise<{ ok: boolean; settings: Partial<Messages> | null; error?: string }>((resolve) => {
    const requestId = `cp_msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const ackType = `${type}_ACK`;
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve({ ok: false, settings: null, error: "The extension did not answer." });
    }, 4000);
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; requestId?: string; ok?: boolean; settings?: Partial<Messages> | null; error?: string };
      if (!data || data.type !== ackType || data.requestId !== requestId) return;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve({ ok: Boolean(data.ok), settings: data.settings || null, error: data.error || undefined });
    };
    window.addEventListener("message", onMessage);
    window.postMessage({ type, requestId, settings }, window.location.origin);
  });
}

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 border-b border-gray-100 py-2.5 text-left last:border-b-0">
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-gray-900">{label}</span>
        {hint ? <span className="block text-xs text-gray-500">{hint}</span> : null}
      </span>
      <span className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${checked ? "bg-[#01754f]" : "bg-gray-300"}`}>
        <span className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[19px]" : "translate-x-[3px]"}`} />
      </span>
    </button>
  );
}

function NumberField({ label, value, onChange, min = 0, max = 300, suffix }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; suffix?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || 0)))}
          className="w-24 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
        />
        {suffix ? <span className="text-xs text-gray-500">{suffix}</span> : null}
      </div>
    </label>
  );
}

export default function OutreachMessages({
  extensionInstalled,
  checkingExtension,
  onCheckExtension,
  userName,
  userLink,
  suggestedKeywords,
}: {
  extensionInstalled: boolean;
  checkingExtension: boolean;
  onCheckExtension: () => void;
  userName: string;
  userLink: string;
  suggestedKeywords: string[];
}) {
  const defaults = useMemo(
    () => personalDefaults(userName, userLink, suggestedKeywords),
    // Re-derive only when the identity changes; edits live in `messages`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userName, userLink, suggestedKeywords.join("|")],
  );
  const [messages, setMessages] = useState<Messages>(defaults);
  const [tool, setTool] = useState<ToolId>("wa");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [sentToExtension, setSentToExtension] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [titlesAutoFilled, setTitlesAutoFilled] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState<{ ok: boolean; text: string } | null>(null);
  const loadedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Load: the account copy wins; else what the extension already has (minus its built-in starter text); else personal defaults.
  useEffect(() => {
    if (loadedRef.current) return;
    let active = true;
    (async () => {
      let account: Partial<Messages> | null = null;
      try {
        const res = await fetch("/api/user/outreach-messages", { credentials: "include" });
        const body = await res.json();
        if (res.ok && body?.success) account = body.data?.messages || null;
      } catch {
        // fall through to the extension / defaults
      }

      let next = defaults;
      if (account) {
        next = mergeMessages(defaults, account);
      } else if (extensionInstalled) {
        const fromExtension = await callExtension("CP_WEB_GET_OUTREACH");
        if (fromExtension.ok && fromExtension.settings) {
          const ext = fromExtension.settings as Partial<Messages>;
          // Keep the extension's text only when it is not empty; keep its toggles either way.
          const cleaned = {
            wa: { ...(ext.wa || {}), ...(ext.wa?.messageTemplate ? {} : { messageTemplate: undefined }), ...(isBuiltInKeywordList(ext.wa?.targetKeywords || []) ? { targetKeywords: undefined } : {}) },
            email: { ...(ext.email || {}), ...(ext.email?.messageTemplate ? {} : { messageTemplate: undefined, subjectTemplate: undefined }), ...(isBuiltInKeywordList(ext.email?.targetKeywords || []) ? { targetKeywords: undefined } : {}) },
            comment: { ...(ext.comment || {}), ...(ext.comment?.commentText ? {} : { commentText: undefined }) },
          };
          next = mergeMessages(defaults, cleaned);
        }
      }
      if (!active) return;
      const sharedSkip = mergeSkipLists(next.wa.ignoreKeywords, next.email.ignoreKeywords, next.comment.ignoreKeywords);
      next = {
        wa: { ...next.wa, ignoreKeywords: sharedSkip },
        email: { ...next.email, ignoreKeywords: sharedSkip },
        comment: { ...next.comment, ignoreKeywords: sharedSkip },
      };
      // Titles to look for follow the user's target roles: when none are saved, start from those roles.
      let filledFromRoles = false;
      if (suggestedKeywords.length) {
        if (!next.wa.targetKeywords.length) { next = { ...next, wa: { ...next.wa, targetKeywords: suggestedKeywords } }; filledFromRoles = true; }
        if (!next.email.targetKeywords.length) { next = { ...next, email: { ...next.email, targetKeywords: suggestedKeywords } }; filledFromRoles = true; }
      }
      // also true when the titles are simply the user's roles (a new user starts that way)
      setTitlesAutoFilled(filledFromRoles || (suggestedKeywords.length > 0 && next.wa.targetKeywords.join("|") === suggestedKeywords.join("|")));
      loadedRef.current = true;
      setMessages(next);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [defaults, extensionInstalled]);

  // Everything saved on the account reaches the extension as soon as it is detected.
  const pushedRef = useRef(false);
  useEffect(() => {
    if (!extensionInstalled || loading || pushedRef.current) return;
    pushedRef.current = true;
    void callExtension("CP_WEB_SYNC_OUTREACH", messages).then((res) => setSentToExtension(res.ok));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extensionInstalled, loading]);

  const update = <K extends ToolId>(group: K, patch: Partial<Messages[K]>) =>
    setMessages((prev) => ({ ...prev, [group]: { ...prev[group], ...patch } }));

  // One skip list for all three tools: the page keeps it identical in each tool's settings, so the extension needs no change.
  const skipKeywords = messages.wa.ignoreKeywords;
  const setSkipKeywords = (list: string[]) =>
    setMessages((prev) => ({
      wa: { ...prev.wa, ignoreKeywords: list },
      email: { ...prev.email, ignoreKeywords: list },
      comment: { ...prev.comment, ignoreKeywords: list },
    }));

  // AI suggestions for "Skip posts that mention": added to the box (never replacing what is there); the user reviews and saves.
  const generateSkipKeywords = async () => {
    const current = skipKeywords.map((word) => word.trim()).filter(Boolean);
    setSuggesting(true);
    setSuggestNote(null);
    try {
      const res = await fetch("/api/user/outreach-messages/suggest-skip", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "all", existing: current }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) throw new Error(body?.message || "Could not generate suggestions.");
      const known = new Set(current.map((word) => word.toLowerCase()));
      const added = ((body.data?.keywords || []) as string[]).filter((word) => !known.has(word.toLowerCase()));
      setSkipKeywords([...current, ...added]);
      setSuggestNote({
        ok: true,
        text: added.length ? `Added ${added.length} suggestions. Review them, then press Save messages.` : "No new suggestions this time.",
      });
    } catch (e) {
      setSuggestNote({ ok: false, text: e instanceof Error ? e.message : "Could not generate suggestions." });
    } finally {
      setSuggesting(false);
    }
  };

  const insertToken = (token: string, field: "messageTemplate" | "subjectTemplate" | "commentText") => {
    const el = textareaRef.current;
    const group = messages[tool] as unknown as Record<string, string>;
    const current = String(group[field] || "");
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    update(tool, { [field]: next } as Partial<Messages[ToolId]>);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/user/outreach-messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) throw new Error(body?.message || "Could not save your messages.");
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      if (extensionInstalled) {
        const sent = await callExtension("CP_WEB_SYNC_OUTREACH", messages);
        setSentToExtension(sent.ok);
      } else {
        setSentToExtension(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your messages.");
    } finally {
      setSaving(false);
    }
  };

  const textOf = (id: ToolId) => (id === "wa" ? messages.wa.messageTemplate : id === "email" ? messages.email.messageTemplate : messages.comment.commentText);
  const active = TOOLS.find((item) => item.id === tool) ?? TOOLS[0];

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {!extensionInstalled ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="text-xs text-amber-900">
            <div className="font-bold">The extension is not detected</div>
            <div className="mt-0.5">You can still write and save your messages. They reach the extension once it is connected: turn it on and refresh this page.</div>
          </div>
          <button type="button" onClick={onCheckExtension} disabled={checkingExtension} className="inline-flex items-center gap-1.5 rounded-full border border-amber-400 bg-white px-3.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60">
            <RefreshCw className={`h-3.5 w-3.5 ${checkingExtension ? "animate-spin" : ""}`} />
            Check again
          </button>
        </div>
      ) : null}

      <div className="space-y-4 rounded-xl border border-gray-200/80 bg-white p-4 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Messages</h3>
          <p className="mt-0.5 text-xs text-gray-500">What the WhatsApp, Email and LinkedIn comment tools send for you. Write each once here and the extension uses it.</p>
        </div>

        {/* Tool switch, styled like the filter pills on Preferences */}
        <div className="flex flex-wrap items-center gap-2.5">
          {TOOLS.map((item) => {
            const selected = item.id === tool;
            const empty = !textOf(item.id).trim();
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTool(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  selected ? "border-[#01754f] bg-[#01754f] text-white" : "border-gray-400 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
                {empty ? <span title="Not written yet" className={`h-2 w-2 rounded-full ${selected ? "bg-amber-300" : "bg-amber-500"}`} /> : null}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-xs text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your messages...
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-xs text-gray-500">{active.blurb}</p>

            {tool === "email" ? (
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-gray-700">Subject</span>
                <input
                  value={messages.email.subjectTemplate}
                  onChange={(event) => update("email", { subjectTemplate: event.target.value })}
                  maxLength={300}
                  placeholder="Application for {job_title}"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                />
              </label>
            ) : null}

            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-gray-700">{tool === "comment" ? "Comment" : "Message"}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {TOKENS[tool].map(({ token }) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => insertToken(token, tool === "comment" ? "commentText" : "messageTemplate")}
                      className="rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      + {token}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                ref={textareaRef}
                value={textOf(tool)}
                maxLength={tool === "comment" ? COMMENT_LIMIT : 5000}
                rows={tool === "comment" ? 5 : 9}
                onChange={(event) => {
                  const value = event.target.value;
                  if (tool === "wa") update("wa", { messageTemplate: value });
                  else if (tool === "email") update("email", { messageTemplate: value });
                  else update("comment", { commentText: value });
                }}
                placeholder={tool === "comment" ? "Write the comment to post on hiring posts" : "Write the message to send"}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                <span>
                  {TOKENS[tool].length
                    ? "Words in curly brackets are filled in for each recruiter."
                    : "Posted exactly as written. LinkedIn allows up to 1,250 characters."}
                </span>
                {tool === "comment" ? <span className={textOf(tool).length > COMMENT_LIMIT - 50 ? "font-semibold text-amber-600" : ""}>{textOf(tool).length}/{COMMENT_LIMIT}</span> : null}
              </div>
              {!textOf(tool).trim() ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5" /> Nothing is sent until you write this.
                </p>
              ) : null}
            </div>

            {/* Preview */}
            {textOf(tool).trim() ? (
              <div>
                <div className="mb-1 text-xs font-bold text-gray-700">Preview</div>
                <div className={`max-w-xl whitespace-pre-wrap rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[13px] leading-relaxed text-gray-900 ${tool === "wa" ? "bg-[#d9fdd3]" : "bg-gray-100"}`}>
                  {tool === "email" ? <div className="mb-1.5 border-b border-gray-300/60 pb-1.5 text-xs font-semibold">{fillSample(messages.email.subjectTemplate, "email") || "(no subject)"}</div> : null}
                  {fillSample(textOf(tool), tool)}
                </div>
              </div>
            ) : null}

            {/* How the tool runs */}
            <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">How it runs</div>
                {tool === "wa" ? (
                  <>
                    <Switch checked={messages.wa.autoSendWhatsApp} onChange={(v) => update("wa", { autoSendWhatsApp: v })} label="Press Send for me" hint="Off opens the chat with the message ready for you." />
                    <Switch checked={messages.wa.autoCloseTab} onChange={(v) => update("wa", { autoCloseTab: v })} label="Close the WhatsApp tab after sending" />
                    <Switch checked={messages.wa.autoLikePosts} onChange={(v) => update("wa", { autoLikePosts: v })} label="Like the recruiter's post" />
                    <Switch checked={messages.wa.filterJobSeekers} onChange={(v) => update("wa", { filterJobSeekers: v })} label="Skip job seekers (#OpenToWork)" />
                    <Switch checked={messages.wa.matchAllHiringPosts} onChange={(v) => update("wa", { matchAllHiringPosts: v })} label="Message every hiring post with a number" hint="Off only uses the keywords below." />
                    <Switch checked={messages.wa.removeSentPostFromFeed} onChange={(v) => update("wa", { removeSentPostFromFeed: v })} label="Remove the post from my feed after sending" />
                    <Switch checked={messages.wa.autoScroll} onChange={(v) => update("wa", { autoScroll: v })} label="Scroll the feed while scanning" />
                  </>
                ) : null}
                {tool === "email" ? (
                  <>
                    <Switch checked={messages.email.autoCloseTab} onChange={(v) => update("email", { autoCloseTab: v })} label="Close the mail tab after sending" />
                    <Switch checked={messages.email.autoLikePosts} onChange={(v) => update("email", { autoLikePosts: v })} label="Like the recruiter's post" />
                    <Switch checked={messages.email.filterJobSeekers} onChange={(v) => update("email", { filterJobSeekers: v })} label="Skip job seekers (#OpenToWork)" />
                    <Switch checked={messages.email.matchAllHiringPosts} onChange={(v) => update("email", { matchAllHiringPosts: v })} label="Email every hiring post with an address" hint="Off only uses the keywords below." />
                    <Switch checked={messages.email.removeSentPostFromFeed} onChange={(v) => update("email", { removeSentPostFromFeed: v })} label="Remove the post from my feed after sending" />
                    <Switch checked={messages.email.autoScroll} onChange={(v) => update("email", { autoScroll: v })} label="Scroll the feed while scanning" />
                  </>
                ) : null}
                {tool === "comment" ? (
                  <>
                    <Switch checked={messages.comment.autoLike} onChange={(v) => update("comment", { autoLike: v })} label="Like the post too" />
                    <Switch checked={messages.comment.skipJobSeekers} onChange={(v) => update("comment", { skipJobSeekers: v })} label="Skip job seekers (#OpenToWork)" />
                    <Switch checked={messages.comment.skipAlreadyLiked} onChange={(v) => update("comment", { skipAlreadyLiked: v })} label="Skip posts I already liked" />
                    <Switch checked={messages.comment.autoScroll} onChange={(v) => update("comment", { autoScroll: v })} label="Scroll the feed while commenting" />
                  </>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-5">
                  {tool === "wa" ? <NumberField label="Wait between messages" value={messages.wa.delayBetweenMessages} onChange={(v) => update("wa", { delayBetweenMessages: v })} suffix="seconds" /> : null}
                  {tool === "email" ? <NumberField label="Wait between emails" value={messages.email.delayBetweenEmails} onChange={(v) => update("email", { delayBetweenEmails: v })} suffix="seconds" /> : null}
                  {tool === "comment" ? (
                    <>
                      <NumberField label="Wait between comments" value={messages.comment.delaySec} onChange={(v) => update("comment", { delaySec: v })} suffix="seconds" />
                      <NumberField label="Comments per run" value={messages.comment.maxComments} onChange={(v) => update("comment", { maxComments: v })} min={1} max={200} />
                    </>
                  ) : null}
                </div>

                {tool === "email" ? (
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-gray-700">Send with</span>
                    <select
                      value={messages.email.emailClient}
                      onChange={(event) => update("email", { emailClient: event.target.value === "mailto" ? "mailto" : "gmail_web" })}
                      className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    >
                      <option value="gmail_web">Gmail on the web</option>
                      <option value="mailto">My computer's default mail app</option>
                    </select>
                  </label>
                ) : null}

                {tool === "comment" ? (
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-gray-700">Only comment on posts that mention</span>
                    <input
                      value={messages.comment.filterKeywords}
                      onChange={(event) => update("comment", { filterKeywords: event.target.value })}
                      placeholder="react, node, full stack (empty means every hiring post)"
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    />
                  </label>
                ) : (
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-gray-700">Look for posts that mention</span>
                    <textarea
                      value={(tool === "wa" ? messages.wa.targetKeywords : messages.email.targetKeywords).join(", ")}
                      onChange={(event) => {
                        const list = event.target.value.split(",").map((item) => item.trim());
                        if (tool === "wa") update("wa", { targetKeywords: list });
                        else update("email", { targetKeywords: list });
                      }}
                      onBlur={(event) => {
                        const list = event.target.value.split(",").map((item) => item.trim()).filter(Boolean);
                        if (tool === "wa") update("wa", { targetKeywords: list });
                        else update("email", { targetKeywords: list });
                      }}
                      rows={3}
                      placeholder="react, node, full stack developer"
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    />
                    <span className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                      <span>{titlesAutoFilled ? "Set from your target roles. Edit as you like. Separate with commas." : "Separate with commas."}</span>
                      {suggestedKeywords.length ? (
                        <button
                          type="button"
                          className="font-semibold text-purple-600 hover:text-purple-700"
                          onClick={() => (tool === "wa" ? update("wa", { targetKeywords: suggestedKeywords }) : update("email", { targetKeywords: suggestedKeywords }))}
                        >
                          Use my job titles
                        </button>
                      ) : null}
                    </span>
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        {!loading ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <label htmlFor="skip-keywords" className="block text-xs font-bold text-gray-800">
                  Skip posts that mention
                </label>
                <p className="mt-0.5 text-[11px] text-gray-500">One list for WhatsApp, Email and LinkedIn comment.</p>
              </div>
              <button
                type="button"
                onClick={() => void generateSkipKeywords()}
                disabled={suggesting}
                className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700 transition-colors hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {suggesting ? "Generating..." : "Generate with AI"}
              </button>
            </div>
            <textarea
              id="skip-keywords"
              value={skipKeywords.join(", ")}
              onChange={(event) => setSkipKeywords(event.target.value.split(",").map((item) => item.trim()))}
              onBlur={(event) => setSkipKeywords(event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
              rows={2}
              placeholder="open to work, looking for a job, internship"
              className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
            />
            <span className="mt-1 block text-[11px] text-gray-500">
              Separate with commas. A post with any of these words is skipped, and it is marked in red on LinkedIn with the reason.
            </span>
            {suggestNote ? (
              <span className={`mt-1 block text-[11px] font-medium ${suggestNote.ok ? "text-emerald-700" : "text-rose-600"}`} role="status">
                {suggestNote.text}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
          <button type="button" onClick={() => void save()} disabled={saving || loading} className="rounded-full bg-purple-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-60">
            {saving ? "Saving..." : "Save messages"}
          </button>
          {savedAt && sentToExtension ? (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
              <Check className="h-3.5 w-3.5" /> Saved at {savedAt} and sent to the extension
            </span>
          ) : null}
          {savedAt && sentToExtension === false ? (
            <span className="text-xs font-medium text-amber-700">
              Saved on your account at {savedAt}. {extensionInstalled ? "The extension did not confirm it received them. Try Save again." : "The extension will receive them once it is connected."}
            </span>
          ) : null}
          {error ? <span className="text-xs font-medium text-red-600">{error}</span> : null}
        </div>
      </div>
    </div>
  );
}
