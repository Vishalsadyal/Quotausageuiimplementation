import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Captions,
  Check,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Handshake,
  Keyboard,
  KeyRound,
  ListChecks,
  MessageCircleQuestion,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { collectExtensionBridgeSnapshot } from "src/lib/extension-bridge-client";
import { getExtensionStoreUrl } from "src/lib/extension-providers";

// The Meet copilot shipped in extension v3.2.0.
const MIN_COPILOT_VERSION = "3.2.0";
const MEET_URL = "https://meet.google.com/";

type ExtensionCheck =
  | { status: "checking" }
  | { status: "missing" }
  | { status: "outdated"; version: string }
  | { status: "ready"; version: string };

type CallTemplate = {
  id: string;
  label: string;
  goal: string;
};

const CALL_TEMPLATES: CallTemplate[] = [
  {
    id: "discovery",
    label: "Discovery call",
    goal: "Understand their problem, success criteria, budget and timeline; show I'm the right fit; agree on a clear next step (proposal or Upwork offer).",
  },
  {
    id: "pricing",
    label: "Pricing / negotiation",
    goal: "Hold my rate by anchoring on outcomes; offer scope tiers or milestones instead of discounting; agree on a price and payment structure on Upwork.",
  },
  {
    id: "closing",
    label: "Closing call",
    goal: "Confirm scope, first milestone and start date; handle final concerns; get them to send the Upwork contract today.",
  },
  {
    id: "upsell",
    label: "Follow-up / upsell",
    goal: "Review results so far, uncover the next problem worth solving, and propose a follow-on milestone or ongoing retainer on Upwork.",
  },
];

const COPILOT_MODES = [
  {
    icon: Sparkles,
    title: "Auto reply",
    body: "When the lead stops talking, the panel shows what to say next, key points and a question to ask.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Answer this",
    body: "A direct, convincing answer to their latest question, using only the facts you gave it.",
  },
  {
    icon: ShieldCheck,
    title: "Handle objection",
    body: "Acknowledge, reframe and address concerns like \"too expensive\" or \"we need it faster\".",
  },
  {
    icon: CircleDollarSign,
    title: "Talk price",
    body: "Anchor on value, state your price confidently and offer options instead of discounts.",
  },
  {
    icon: Handshake,
    title: "Close the deal",
    body: "Sum up the fit, propose the first milestone and start date, and ask for the contract.",
  },
  {
    icon: ListChecks,
    title: "Recap & next steps",
    body: "What was agreed, what's still open, and who does what by when.",
  },
];

const SETUP_STEPS = [
  { icon: KeyRound, text: "Stay signed in to AutoApply CV in this browser — the copilot uses your account, no API key needed." },
  { icon: Video, text: "Join your Google Meet call and open Call Copilot in the bottom-right corner." },
  { icon: ListChecks, text: "Paste your role, their role, the goal and your facts from the prep sheet on this page." },
  { icon: Captions, text: "Turn on Meet captions (press C). Suggestions appear as soon as the lead finishes speaking." },
];

const CLOSING_TIPS = [
  "Ask what success looks like for them before you pitch anything.",
  "Repeat their problem back in their words — it builds trust fast.",
  "Offer 2–3 scope options instead of lowering your rate.",
  "Propose a small first milestone to make saying yes easy.",
  "Keep contracts and payments on Upwork — off-platform payment can get your account suspended.",
  "Send the proposal or offer right after the call while it's fresh.",
];

function compareVersions(a: string, b: string) {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function buildOfferText(facts: {
  services: string;
  rate: string;
  proof: string;
  availability: string;
  jobPost: string;
}) {
  return [
    facts.services && `Services: ${facts.services}`,
    facts.rate && `Rate / pricing: ${facts.rate}`,
    facts.proof && `Relevant work & results: ${facts.proof}`,
    facts.availability && `Availability & timeline: ${facts.availability}`,
    facts.jobPost && `What their job post asks for: ${facts.jobPost}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const disabled = !value.trim();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — nothing else to do
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      disabled={disabled}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

const inputClass =
  "w-full px-3 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 placeholder:text-gray-400";

function Field({
  label,
  copyValue,
  children,
}: {
  label: string;
  copyValue?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-gray-600">{label}</span>
        {copyValue !== undefined ? <CopyButton value={copyValue} /> : null}
      </span>
      {children}
    </label>
  );
}

export default function Interview() {
  const [extension, setExtension] = useState<ExtensionCheck>({ status: "checking" });

  // Call prep lives in component state only — nothing is saved or sent anywhere.
  const [templateId, setTemplateId] = useState(CALL_TEMPLATES[0].id);
  const [myRole, setMyRole] = useState("");
  const [theirRole, setTheirRole] = useState("");
  const [goal, setGoal] = useState(CALL_TEMPLATES[0].goal);
  const [facts, setFacts] = useState({ services: "", rate: "", proof: "", availability: "", jobPost: "" });

  const offerText = useMemo(() => buildOfferText(facts), [facts]);
  const storeUrl = getExtensionStoreUrl("linkedin");

  const checkExtension = useCallback(async () => {
    setExtension({ status: "checking" });
    const snapshot = await collectExtensionBridgeSnapshot({ timeoutMs: 3000, requestIdPrefix: "cp_call_copilot" });
    const provider = snapshot.providers?.linkedin;
    const installed = Boolean(provider?.installed || snapshot.installed);
    const version = String(provider?.version || snapshot.version || "");
    if (!installed) {
      setExtension({ status: "missing" });
    } else if (version && compareVersions(version, MIN_COPILOT_VERSION) < 0) {
      setExtension({ status: "outdated", version });
    } else {
      setExtension({ status: "ready", version });
    }
  }, []);

  useEffect(() => {
    void checkExtension();
  }, [checkExtension]);

  const applyTemplate = (template: CallTemplate) => {
    setTemplateId(template.id);
    setGoal(template.goal);
  };

  const updateFact = (key: keyof typeof facts) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFacts((prev) => ({ ...prev, [key]: e.target.value }));

  const clearPrep = () => {
    setMyRole("");
    setTheirRole("");
    setGoal(CALL_TEMPLATES.find((t) => t.id === templateId)?.goal || "");
    setFacts({ services: "", rate: "", proof: "", availability: "", jobPost: "" });
  };

  const allSetupText = [
    myRole && `My role: ${myRole}`,
    theirRole && `Their role: ${theirRole}`,
    goal && `Goal of this call: ${goal}`,
    offerText && `My offer & facts:\n${offerText}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight flex items-center gap-2">
            <span>Client Call Copilot</span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 tracking-wider">
              LIVE
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5 max-w-xl">
            Real-time talking points on Google Meet calls with Upwork leads — know what to say, handle objections, and close the deal.
          </p>
        </div>
        <button
          onClick={() => void checkExtension()}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${extension.status === "checking" ? "animate-spin" : ""}`} />
          Check extension
        </button>
      </div>

      {/* Extension status */}
      <ExtensionBanner extension={extension} storeUrl={storeUrl} />

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Call prep */}
        <div className="lg:col-span-2 bg-white border border-gray-200/80 shadow-xs rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <ListChecks className="w-4 h-4 text-purple-600" />
              Prep your next call
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearPrep}
                className="text-[11px] font-semibold text-gray-500 hover:text-gray-800"
              >
                Clear
              </button>
              <CopyButton value={allSetupText} label="Copy all" />
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mb-3">
            Fill this in before the call, then copy each field into the Call Copilot panel on Meet. Nothing here is saved — it's gone when you leave this page.
          </p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {CALL_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                  templateId === t.id
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Field label="My role" copyValue={myRole}>
              <input
                className={inputClass}
                value={myRole}
                onChange={(e) => setMyRole(e.target.value)}
                placeholder="e.g. Freelance full-stack developer (React / Node)"
              />
            </Field>
            <Field label="Their role" copyValue={theirRole}>
              <input
                className={inputClass}
                value={theirRole}
                onChange={(e) => setTheirRole(e.target.value)}
                placeholder="e.g. SaaS founder hiring for an MVP"
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Goal of this call" copyValue={goal}>
                <textarea className={`${inputClass} resize-y`} rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="mt-4 border-t border-gray-100 pt-3">
            <div className="text-[11px] font-bold text-gray-900 uppercase tracking-wider mb-2">My offer & facts</div>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Services">
                <input className={inputClass} value={facts.services} onChange={updateFact("services")} placeholder="e.g. MVP builds, dashboards, API integrations" />
              </Field>
              <Field label="Rate / pricing">
                <input className={inputClass} value={facts.rate} onChange={updateFact("rate")} placeholder="e.g. $40/h, or $2,500 fixed for phase 1" />
              </Field>
              <Field label="Relevant work & results">
                <textarea className={`${inputClass} resize-y`} rows={2} value={facts.proof} onChange={updateFact("proof")} placeholder="e.g. Built 3 analytics dashboards; cut load time 60% for a fintech client" />
              </Field>
              <Field label="Availability & timeline">
                <textarea className={`${inputClass} resize-y`} rows={2} value={facts.availability} onChange={updateFact("availability")} placeholder="e.g. Can start Monday, 30 h/week, MVP in 4 weeks" />
              </Field>
              <div className="md:col-span-2">
                <Field label="What their job post asks for">
                  <textarea className={`${inputClass} resize-y`} rows={2} value={facts.jobPost} onChange={updateFact("jobPost")} placeholder="Paste the key requirements from the Upwork job post" />
                </Field>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-purple-100 bg-purple-50/40 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-purple-900">Paste into "My offer & facts"</span>
                <CopyButton value={offerText} />
              </div>
              <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-gray-700 font-sans min-h-[2.5rem]">
                {offerText || "Your facts will appear here as you type. The copilot only uses these — it won't invent experience, clients or prices."}
              </pre>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200/80 shadow-xs rounded-xl p-4">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Video className="w-4 h-4 text-purple-600" />
              How to use it
            </h2>
            <ol className="space-y-2.5">
              {SETUP_STEPS.map((step, i) => (
                <li key={step.text} className="flex gap-2.5">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-[11px] text-gray-600 leading-relaxed">{step.text}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-white border border-gray-200/80 shadow-xs rounded-xl p-4">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Keyboard className="w-4 h-4 text-purple-600" />
              Shortcuts on Meet
            </h2>
            <div className="space-y-1.5 text-[11px] text-gray-600">
              <div className="flex justify-between"><span>Show / hide panel</span><kbd className="px-1.5 rounded bg-gray-100 border border-gray-200 font-mono">Alt+Shift+M</kbd></div>
              <div className="flex justify-between"><span>Suggest now</span><kbd className="px-1.5 rounded bg-gray-100 border border-gray-200 font-mono">Alt+Shift+S</kbd></div>
              <div className="flex justify-between"><span>Meet captions</span><kbd className="px-1.5 rounded bg-gray-100 border border-gray-200 font-mono">C</kbd></div>
            </div>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4">
            <h2 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Private by design
            </h2>
            <ul className="space-y-1.5 text-[11px] text-emerald-900/80 leading-relaxed list-disc pl-4">
              <li>Transcript and setup stay in the Meet tab's memory and vanish when you leave the call.</li>
              <li>Each suggestion request is processed and discarded — calls are never saved to your account.</li>
              <li>Only the recent transcript and your prep notes are sent, and only while the copilot is running.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* What it helps with */}
      <div className="bg-white border border-gray-200/80 shadow-xs rounded-xl p-4">
        <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-purple-600" />
          What the copilot does during the call
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {COPILOT_MODES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="border border-gray-100 rounded-lg p-3 bg-gray-50/40">
              <div className="flex items-center gap-2 font-semibold text-xs text-gray-900">
                <Icon className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                {title}
              </div>
              <div className="text-[11px] text-gray-500 mt-1 leading-relaxed">{body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Closing tips */}
      <div className="bg-white border border-gray-200/80 shadow-xs rounded-xl p-4">
        <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Handshake className="w-4 h-4 text-purple-600" />
          Closing tips for Upwork calls
        </h2>
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-2">
          {CLOSING_TIPS.map((tip) => (
            <div key={tip} className="flex gap-2 text-[11px] text-gray-600 leading-relaxed">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExtensionBanner({ extension, storeUrl }: { extension: ExtensionCheck; storeUrl: string | null }) {
  if (extension.status === "checking") {
    return (
      <div className="bg-white border border-gray-200/80 rounded-xl px-4 py-3 text-xs text-gray-500">
        Checking for the AutoApply CV extension…
      </div>
    );
  }

  if (extension.status === "ready") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50/60 border border-emerald-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-emerald-900">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-semibold">Extension connected{extension.version ? ` (v${extension.version})` : ""}.</span>
          <span className="text-emerald-800/80">Call Copilot is ready on Google Meet.</span>
        </div>
        <a
          href={MEET_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
        >
          <Video className="w-3.5 h-3.5" />
          Open Google Meet
        </a>
      </div>
    );
  }

  const outdated = extension.status === "outdated";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50/60 border border-amber-200 rounded-xl px-4 py-3">
      <div className="text-xs text-amber-900">
        <span className="font-semibold">
          {outdated ? `Extension v${extension.version} is installed — Call Copilot needs v${MIN_COPILOT_VERSION}+.` : "AutoApply CV extension not detected."}
        </span>{" "}
        <span className="text-amber-800/80">
          {outdated ? "Update it from the Chrome Web Store, then refresh this page." : "Install it to get Call Copilot on Google Meet."}
        </span>
      </div>
      {storeUrl ? (
        <a
          href={storeUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {outdated ? "Update extension" : "Get the extension"}
        </a>
      ) : null}
    </div>
  );
}
