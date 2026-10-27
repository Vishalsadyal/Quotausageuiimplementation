import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useAuth } from "../../context/AuthContext";
import { AlertCircle, ArrowLeftRight, Building2, Check, ChevronLeft, Chrome, ExternalLink, FileText, Home, Lightbulb, Loader2, Lock, MapPin, Plus, Sparkles, UploadCloud, X, type LucideIcon } from "lucide-react";
import { InsightPanel, MapPanel, ProfileCard, useOnboardingInsights } from "./OnboardingPanels";
import { captureEvent } from "src/lib/posthog-client";
import type { JobPreferences, MasterProfile, PendingQuestion, ScreeningAnswerType, ScreeningSource } from "./Onboarding";

// One question per screen onboarding (25 screens in 8 sections). It edits the same profile / preferences
// state as the classic form (Onboarding.tsx keeps loading, autosave and the final save) and writes the
// extra lists (skills, skip keywords, search filters, messages) to the same keys the Jobs page uses.

type SaveAnswer = (
  questionKey: string,
  questionLabel: string,
  answer: string,
  answerType?: ScreeningAnswerType,
  source?: ScreeningSource,
) => Promise<void>;

type Props = {
  resumeFileName: string;
  profile: MasterProfile;
  setProfile: Dispatch<SetStateAction<MasterProfile>>;
  preferences: JobPreferences;
  setPreferences: Dispatch<SetStateAction<JobPreferences>>;
  pendingQuestions: PendingQuestion[];
  answerDrafts: Record<string, string>;
  setAnswerDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  saveAnswer: SaveAnswer;
  onResumeUpload: (file: File) => Promise<void>;
  uploading: boolean;
  parsingStatus: "idle" | "scanning" | "parsing" | "done";
  generatedKeywords: string[];
  generatingAi: boolean;
  onGenerateAi: () => Promise<void>;
  error: string;
  setError: (value: string) => void;
  /** Whether the Chrome extension answers on this page, and a way to check again. */
  extensionInstalled: boolean;
  onCheckExtension: () => Promise<void>;
  /** Saves everything; a paid plan then opens its checkout, otherwise the user goes to Jobs. */
  onFinish: (plan?: PaidPlanChoice) => Promise<boolean>;
};

type PaidPlanChoice = "pro" | "connect" | "coach";

// Same plans and prices as the Billing page.
const PLAN_CARDS: Array<{ id: PaidPlanChoice; name: string; price: string; tagline: string; badge?: string }> = [
  { id: "pro", name: "Pro", price: "₹99", tagline: "Unlimited auto-apply + recruiter outreach", badge: "Best value" },
  { id: "connect", name: "Pro Connect", price: "₹500", tagline: "Pro + 20 fresh recruiter contacts every day" },
  { id: "coach", name: "Career Coach", price: "₹1,849", tagline: "1-on-1 human guidance + automation" },
];

const TOTAL_STEPS = 25;
// Stable names for analytics (PostHog funnels): index = step number - 1. Keep in sync with the screens.
const STEP_NAMES = [
  "resume_upload", "resume_summary", "name", "phone", "location", "links", "us_work_authorization", "visa_sponsorship",
  "experience", "education", "english", "job_titles", "job_types", "work_mode", "cities", "countries", "salary",
  "skills", "skip_keywords", "excluded_companies", "screening_answers", "search_filters", "messages", "extension", "plan",
];
const EXTENSION_STORE_URL = "https://chromewebstore.google.com/search/AutoApply%20Cv";
const SECTIONS: Array<{ name: string; from: number; to: number }> = [
  { name: "Resume", from: 1, to: 2 },
  { name: "About you", from: 3, to: 6 },
  { name: "Eligibility & experience", from: 7, to: 11 },
  { name: "Job preferences", from: 12, to: 17 },
  { name: "Keywords", from: 18, to: 20 },
  { name: "Screening & filters", from: 21, to: 22 },
  { name: "Messages", from: 23, to: 23 },
  { name: "Extension & plan", from: 24, to: 25 },
];

const US_WORK_AUTH_OPTIONS = ["U.S. Citizen/Permanent Resident", "Authorized to work in the U.S.", "Require sponsorship", "Not authorized"];
const EXPERIENCE_OPTIONS = ["0", "1", "2", "3", "4", "5", "6", "8", "10", "15"];
const EDUCATION_OPTIONS = ["High School", "Diploma / Certificate", "Associate Degree", "Bachelor's Degree", "Master's Degree", "Doctorate"];
const ENGLISH_OPTIONS = ["Native or bilingual", "Professional", "Limited", "Basic"];
const JOB_TYPE_OPTIONS = ["Full-time", "Part-time", "Contract", "Internship", "Temporary"];
const WORK_MODE_CARDS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: "Remote", label: "Fully remote", icon: Home },
  { value: "Hybrid", label: "Hybrid", icon: ArrowLeftRight },
  { value: "Onsite", label: "In-office", icon: Building2 },
  { value: "Flexible", label: "Open to all", icon: Sparkles },
];
const COUNTRY_SUGGESTIONS = ["India", "United States", "United Kingdom", "Canada", "Germany", "United Arab Emirates", "Singapore", "Australia", "Netherlands", "Ireland"];
const DEFAULT_EXCLUDE = ["Internship", "Junior", "Unpaid", "Security Clearance"];
const DATE_POSTED_OPTIONS = ["Past 24 hours", "Past week", "Past month", "Any time"];
const EXPERIENCE_LEVEL_OPTIONS = ["Internship", "Entry level", "Associate", "Mid-Senior level", "Director", "Executive"];
const CONFIDENCE_CARDS = [
  { value: "5", label: "Wide net", hint: "Apply to most related jobs" },
  { value: "7", label: "Balanced", hint: "Good match on title and skills" },
  { value: "8", label: "Focused", hint: "Strong match only · recommended" },
  { value: "9", label: "Strict", hint: "Near-perfect matches only" },
];

function digits(value: string) {
  return String(value || "").replace(/[^\d]/g, "");
}

function isValidUrl(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return true;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return Boolean(url.hostname.includes("."));
  } catch {
    return false;
  }
}

// Remote / work from home is a work mode, not a place (same rule as the classic form).
function isRemoteLike(value: string) {
  const n = String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  return (
    /^(fully |100 |completely )?remote( work| only| job| jobs)?$/.test(n) ||
    /^work(ing)? (from|at) (home|anywhere)$/.test(n) ||
    ["wfh", "home office", "anywhere", "worldwide"].includes(n)
  );
}

function splitList(raw: string) {
  return String(raw || "").split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
}

function uniq(values: string[]) {
  const seen = new Set<string>();
  return values.filter((v) => {
    const k = v.toLowerCase();
    if (!v || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function defaultMessages(name: string, portfolio: string) {
  const sign = name.trim() ? `Best regards,\n${name.trim()}` : "Best regards";
  const portfolioLine = portfolio.trim() ? `\n\nHere is my work, if useful:\n${portfolio.trim()}` : "";
  return {
    wa: `Hi {name}!\n\nI saw your hiring post on LinkedIn about the {job_title} role.\n\nI am actively looking for new opportunities.${portfolioLine}\n\nI would love to connect and share more details.\n\n${sign}`,
    emailSubject: name.trim() ? `Application for {job_title} - ${name.trim()}` : "Application for {job_title}",
    emailBody: `Hi {name},\n\nI saw your hiring post on LinkedIn about the {job_title} role at {company}.\n\nI am actively looking for new opportunities and would be glad to share my profile.${portfolioLine}\n\nThank you for your time.\n\n${sign}`,
  };
}

// ───────────────────────────── building blocks ─────────────────────────────

function ChoiceCards({ options, value = "", values, onPick, columns = 1, compact = false }: { options: Array<{ value: string; label: string; hint?: string; icon?: LucideIcon }>; value?: string; values?: string[]; onPick: (value: string) => void; columns?: 1 | 2; compact?: boolean }) {
  return (
    <div className={`mx-auto grid w-full max-w-xl gap-2.5 ${columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {options.map((opt) => {
        const active = values ? values.includes(opt.value) : value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPick(opt.value)}
            className={`w-full rounded-2xl border-2 px-3 text-center font-semibold shadow-sm transition-all ${compact ? "py-2 text-sm" : "py-3 text-[15px] sm:text-base"} ${
              active ? "border-violet-500 bg-violet-50 text-violet-900" : "border-transparent bg-white text-slate-900 hover:border-violet-200 hover:shadow-md"
            }`}
          >
            <span className="inline-flex items-center gap-2.5">
              {opt.icon ? (
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${active ? "bg-violet-600 text-white shadow-md" : "bg-violet-50 text-violet-600"}`}>
                  <opt.icon className="h-4 w-4" />
                </span>
              ) : active ? (
                <Check className="h-4 w-4 text-violet-600" />
              ) : null}
              {opt.label}
              {opt.icon && active ? <Check className="h-4 w-4 text-violet-600" /> : null}
            </span>
            {opt.hint ? <span className={`mt-0.5 block font-medium text-slate-500 ${compact ? "text-[11px] leading-tight" : "text-xs"}`}>{opt.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function MultiChips({ options, values, onToggle }: { options: string[]; values: string[]; onToggle: (value: string) => void }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-wrap justify-center gap-2">
      {options.map((opt) => {
        const active = values.some((v) => v.toLowerCase() === opt.toLowerCase());
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`rounded-full border-2 px-3.5 py-2 text-sm font-semibold transition-all ${
              active ? "border-violet-500 bg-violet-600 text-white shadow-md" : "border-slate-200 bg-white text-slate-800 hover:border-violet-300"
            }`}
          >
            <span className="inline-flex items-center gap-1">
              {active ? <Check className="h-3.5 w-3.5" /> : null}
              {opt}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ChipInput({
  values,
  onChange,
  placeholder,
  suggestions = [],
  reject,
  chipTone = "violet",
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  suggestions?: string[];
  reject?: (value: string) => string | null;
  chipTone?: "violet" | "rose";
}) {
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");

  const add = (raw: string) => {
    const parts = splitList(raw);
    if (!parts.length) return;
    const accepted: string[] = [];
    for (const part of parts) {
      const message = reject?.(part) ?? null;
      if (message) {
        setNotice(message);
        continue;
      }
      accepted.push(part);
    }
    if (accepted.length) {
      onChange(uniq([...values, ...accepted]));
      setNotice("");
    }
    setDraft("");
  };

  const remaining = suggestions.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 8);
  const chipClass =
    chipTone === "rose" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-violet-200 bg-violet-50 text-violet-800";

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white py-1.5 pl-5 pr-1.5 shadow-sm focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (notice) setNotice("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={placeholder}
          className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-base text-slate-900 shadow-none outline-none ring-0 placeholder:text-slate-400 focus:border-0 focus:outline-none focus:ring-0"
        />
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={!draft.trim()}
          className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition disabled:bg-slate-200 disabled:text-slate-400"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
      {notice ? (
        <p className="mt-2 flex items-start justify-center gap-1.5 text-center text-xs font-medium text-red-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {notice}
        </p>
      ) : null}
      {values.length ? (
        <div className="mt-3 flex max-h-32 flex-wrap justify-center gap-1.5 overflow-y-auto">
          {values.map((value) => (
            <span key={value} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${chipClass}`}>
              {value}
              <button type="button" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((v) => v !== value))} className="opacity-70 hover:opacity-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {remaining.length ? (
        <div className="mt-3">
          <p className="mb-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">Suggestions</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {remaining.map((s) => (
              <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-dashed border-slate-300 bg-white/70 px-3 py-1 text-sm text-slate-700 hover:border-violet-400 hover:text-violet-700">
                + {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, type = "text", error }: { label?: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; error?: string }) {
  return (
    <label className="mx-auto block w-full max-w-xl">
      {label ? <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span> : null}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-2xl border bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:ring-2 ${
          error ? "border-red-400 focus:ring-red-100" : "border-slate-300 focus:border-violet-400 focus:ring-violet-100"
        }`}
      />
      {error ? <span className="mt-1.5 block text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto mt-4 flex w-full max-w-xl items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <span>{children}</span>
    </div>
  );
}

type Place = { city: string; state: string; country: string; label: string };

const COUNTRY_OPTIONS = [
  "India", "United States", "United Kingdom", "Canada", "Australia", "Germany", "United Arab Emirates", "Singapore",
  "Netherlands", "Ireland", "France", "Saudi Arabia", "Qatar", "New Zealand", "Japan", "Malaysia", "Philippines",
  "Pakistan", "Bangladesh", "Sri Lanka", "Nepal", "South Africa", "Nigeria", "Kenya", "Brazil", "Mexico", "Spain",
  "Italy", "Sweden", "Switzerland", "Poland", "Portugal",
];

// City field with place suggestions (OpenStreetMap via our server). Picking one fills state and country too.
function CityAutocomplete({ value, onChange, onPick }: { value: string; onChange: (value: string) => void; onPick: (place: Place) => void }) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typedRef = useRef(false);

  useEffect(() => {
    const q = value.trim();
    if (!typedRef.current || q.length < 2) {
      setPlaces([]);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      fetch(`/api/user/onboarding/geocode?mode=suggest&q=${encodeURIComponent(q)}`, { credentials: "include" })
        .then((res) => res.json())
        .then((json) => {
          if (!alive) return;
          setPlaces(Array.isArray(json?.data) ? (json.data as Place[]) : []);
          setActive(-1);
        })
        .catch(() => {});
    }, 350);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [value]);

  const pick = (place: Place) => {
    typedRef.current = false;
    onPick(place);
    setPlaces([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <label className="mx-auto block w-full max-w-xl">
        <span className="mb-1 block text-sm font-semibold text-slate-700">City</span>
        <input
          value={value}
          onChange={(e) => {
            typedRef.current = true;
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!places.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(places.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter" && active >= 0) {
              e.preventDefault();
              pick(places[active]);
            }
          }}
          placeholder="Start typing your city…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && places.length > 0}
          aria-autocomplete="list"
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        />
      </label>
      {open && places.length ? (
        <ul role="listbox" className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-xl">
          {places.map((place, i) => (
            <li key={place.label} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(place)}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm ${i === active ? "bg-violet-50" : "hover:bg-slate-50"}`}
              >
                <MapPin className="h-4 w-4 shrink-0 text-violet-600" />
                <span className="min-w-0 truncate">
                  <span className="font-semibold text-slate-900">{place.city}</span>
                  <span className="text-slate-500">{[place.state, place.country].filter(Boolean).length ? `, ${[place.state, place.country].filter(Boolean).join(", ")}` : ""}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ───────────────────────────── the flow ─────────────────────────────

export default function OnboardingFlow(props: Props) {
  const {
    resumeFileName,
    profile,
    setProfile,
    preferences,
    setPreferences,
    pendingQuestions,
    answerDrafts,
    setAnswerDrafts,
    saveAnswer,
    onResumeUpload,
    uploading,
    parsingStatus,
    generatedKeywords,
    generatingAi,
    onGenerateAi,
    error,
    setError,
    extensionInstalled,
    onCheckExtension,
    onFinish,
  } = props;

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const urlStep = Number(searchParams.get("step"));
  // Coming from the home-page upload, the resume is already on file: open on what we read from it.
  const [step, setStepState] = useState(() => (urlStep >= 1 && urlStep <= TOTAL_STEPS ? Math.floor(urlStep) : resumeFileName ? 2 : 1));
  const [screeningIndex, setScreeningIndex] = useState(0);
  // 1 = moving forward, -1 = going back: the next screen slides in from that side.
  const [direction, setDirection] = useState<1 | -1>(1);
  const reduceMotion = useReducedMotion();
  // Snapshot: saving an answer removes it from the live pending list, which would shift the index.
  const [screeningQueue] = useState(() => pendingQuestions);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Lists that live only in saved answers (read by the Jobs page and the extension).
  const [skills, setSkills] = useState<string[]>([]);
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>([]);
  const [datePosted, setDatePosted] = useState("Past week");
  const [experienceLevels, setExperienceLevels] = useState<string[]>([]);
  const [messages, setMessages] = useState({ wa: "", emailSubject: "", emailBody: "" });
  const [extrasLoaded, setExtrasLoaded] = useState(false);
  const [messageTab, setMessageTab] = useState<"wa" | "email">("wa");
  const [chosenPlan, setChosenPlan] = useState<PaidPlanChoice>("pro");
  const insights = useOnboardingInsights();

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [answersRes, messagesRes] = await Promise.all([
          fetch("/api/user/screening/answers?limit=500&scanLimit=2500", { credentials: "include" }),
          fetch("/api/user/outreach-messages", { credentials: "include" }),
        ]);
        const answersJson = await answersRes.json().catch(() => null);
        const messagesJson = await messagesRes.json().catch(() => null);
        if (!alive) return;
        const byKey = new Map<string, string>();
        for (const item of (answersJson?.data?.answers || []) as Array<{ questionKey?: string; answer?: string }>) {
          const key = String(item?.questionKey || "").trim().toLowerCase();
          const answer = String(item?.answer || "").trim();
          if (key && answer && !byKey.has(key)) byKey.set(key, answer);
        }
        const read = (...keys: string[]) => keys.map((k) => byKey.get(k) || "").find(Boolean) || "";
        const savedSkills = splitList(read("core_skills", "skills"));
        setSkills(savedSkills);
        const savedExclude = splitList(read("bad_words", "exclude_keywords"));
        setExcludeKeywords(savedExclude.length ? savedExclude : DEFAULT_EXCLUDE);
        setDatePosted(read("cp_pref_date_posted") || "Past week");
        setExperienceLevels(splitList(read("cp_pref_experience_levels")).filter((v) => v !== "Any"));
        const saved = messagesJson?.data?.messages || {};
        const fallback = defaultMessages(profile.fullName, profile.portfolioUrl);
        setMessages({
          wa: String(saved?.wa?.messageTemplate || "") || fallback.wa,
          emailSubject: String(saved?.email?.subjectTemplate || "") || fallback.emailSubject,
          emailBody: String(saved?.email?.messageTemplate || "") || fallback.emailBody,
        });
      } catch {
        // Defaults stay; the screens still work.
      } finally {
        if (alive) setExtrasLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
    // Load once; later name changes don't overwrite what the user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skills from the resume parse, when none are saved yet (titles are left out).
  const suggestedSkills = useMemo(() => {
    const titles = new Set(preferences.searchTerms.map((t) => t.toLowerCase()));
    return uniq(generatedKeywords.filter((k) => !titles.has(k.toLowerCase())));
  }, [generatedKeywords, preferences.searchTerms]);

  useEffect(() => {
    if (extrasLoaded && !skills.length && suggestedSkills.length) setSkills(suggestedSkills.slice(0, 10));
  }, [extrasLoaded, suggestedSkills, skills.length]);

  // Skills from the AI (resume-based). Saved by the server under core_skills only, so the user's
  // titles and skip words are left alone.
  const [aiSkills, setAiSkills] = useState<string[]>([]);
  const [suggestingSkills, setSuggestingSkills] = useState(false);
  const [skillsNote, setSkillsNote] = useState("");
  const skillsAutoRef = useRef(false);

  const suggestSkills = async () => {
    setSuggestingSkills(true);
    setSkillsNote("");
    try {
      const res = await fetch("/api/user/ai/generate-search-profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ only: "skills" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.message || "Could not suggest skills");
      const found = uniq((Array.isArray(json.data?.skills) ? json.data.skills : []).map((v: unknown) => String(v).trim()).filter(Boolean));
      setAiSkills(found);
      // Fill the list when it's empty; otherwise offer the new ones as suggestions to tap.
      setSkills((current) => (current.length ? current : found.slice(0, 15)));
      setSkillsNote(found.length ? `Found ${found.length} skills in your resume. Tap any suggestion to add it.` : "No skills found. Add them below.");
    } catch (err) {
      setSkillsNote(err instanceof Error ? err.message : "Could not suggest skills");
    } finally {
      setSuggestingSkills(false);
    }
  };

  // Arriving on the skills screen with none: re-read saved answers first (the resume's skills are
  // saved in the background right after a home-page upload), then ask the AI if there are still none.
  useEffect(() => {
    if (step !== 18 || skillsAutoRef.current || skills.length) return;
    skillsAutoRef.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/user/screening/answers?limit=500&scanLimit=2500", { credentials: "include" });
        const json = await res.json().catch(() => null);
        const items = (json?.data?.answers || []) as Array<{ questionKey?: string; answer?: string }>;
        const saved = items.find((a) => ["core_skills", "skills"].includes(String(a?.questionKey || "").toLowerCase()) && String(a?.answer || "").trim());
        if (saved) {
          setSkills(splitList(String(saved.answer)).slice(0, 15));
          return;
        }
      } catch {
        // fall through to the AI suggestion
      }
      await suggestSkills();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Saved as a comma-separated list ("Remote, Hybrid"); the server and extension read it as a list.
  const workModes = splitList(preferences.workMode);
  const isRemote = workModes.length === 1 && workModes[0] === "Remote";
  const hasResume = Boolean(resumeFileName) || parsingStatus === "done";

  const goTo = (target: number) => {
    let next = Math.max(1, Math.min(TOTAL_STEPS, target));
    // Countries only matter when the user works on site somewhere.
    if (next === 16 && isRemote) next = target > step ? 17 : 15;
    setDirection(next >= step ? 1 : -1);
    setStepState(next);
    setLocalError("");
    setError("");
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("step", String(next));
      return p;
    }, { replace: true });
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    if (step === 1 && (uploading || parsingStatus === "scanning" || parsingStatus === "parsing")) goTo(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, uploading, parsingStatus]);

  // On the install screen, check every few seconds so it turns green as soon as Chrome adds it.
  useEffect(() => {
    if (step !== 24 || extensionInstalled) return;
    let running = false;
    const check = () => {
      if (running) return;
      running = true;
      void onCheckExtension().finally(() => {
        running = false;
      });
    };
    check();
    const timer = window.setInterval(check, 5000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, extensionInstalled]);

  // One onboarding_step_viewed per screen shown (the ref stops React's dev double-run and re-renders
  // from sending it twice). No answers are sent, only where the user is in the flow.
  const lastTrackedStepRef = useRef(0);
  useEffect(() => {
    if (lastTrackedStepRef.current === step) return;
    lastTrackedStepRef.current = step;
    captureEvent("onboarding_step_viewed", {
      step,
      step_name: STEP_NAMES[step - 1] || `step_${step}`,
      section: SECTIONS.find((s) => step >= s.from && step <= s.to)?.name || "",
      total_steps: TOTAL_STEPS,
      direction: direction === 1 ? "forward" : "back",
    });
    // Also saved on the account, so Admin > Users shows the step a user stopped at.
    void fetch("/api/user/onboarding/step", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── per-screen validity ──
  const yearsValue = String(profile.yearsOfExperience || preferences.yearsOfExperience || "").trim();
  const stepIssue = (s: number): string => {
    switch (s) {
      case 1:
        return hasResume ? "" : "Upload your resume to continue.";
      case 3:
        return profile.fullName.trim().length >= 2 ? "" : "Enter your full name.";
      case 4:
        return digits(profile.phone).length >= 6 ? "" : "Enter a valid phone number.";
      case 5:
        return profile.city.trim() ? "" : "Enter your city.";
      case 6:
        return isValidUrl(profile.linkedinUrl) && isValidUrl(profile.portfolioUrl) ? "" : "Check the links: they don't look like valid URLs.";
      case 8:
        return profile.visaSponsorship ? "" : "Choose Yes or No.";
      case 9:
        return yearsValue && !Number.isNaN(Number(yearsValue)) && Number(yearsValue) >= 0 ? "" : "Choose your years of experience.";
      case 12:
        return preferences.searchTerms.length ? "" : "Add at least one job title.";
      case 14:
        return workModes.length ? "" : "Pick at least one option.";
      default:
        return "";
    }
  };
  const issue = stepIssue(step);

  // ── saving the screens that write their own answers ──
  const saveList = async (keys: Array<[string, string]>, values: string[]) => {
    const joined = values.join(", ");
    for (const [key, label] of keys) await saveAnswer(key, label, joined, "multiselect", "manual");
  };

  const persistStep = async (s: number) => {
    if (s === 18 && skills.length) {
      await saveList([["core_skills", "Technical Skills & Competencies"], ["skills", "Technical Skills & Competencies"]], skills);
    }
    if (s === 19 && excludeKeywords.length) {
      await saveList([["bad_words", "Blacklist / Exclude Keywords"], ["exclude_keywords", "Blacklist / Exclude Keywords"]], excludeKeywords);
      setPreferences((p) => ({ ...p, excludedKeywords: excludeKeywords }));
    }
    if (s === 22) {
      await saveAnswer("cp_pref_date_posted", "Date Posted", datePosted, "choice", "manual");
      await saveAnswer("cp_pref_experience_levels", "Experience Level", experienceLevels.length ? experienceLevels.join(", ") : "Any", "multiselect", "manual");
      await saveAnswer("cp_pref_easy_apply_only", "Easy Apply Only", "Yes", "choice", "manual");
    }
    if (s === 23) {
      const res = await fetch("/api/user/outreach-messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wa: { messageTemplate: messages.wa },
          email: { subjectTemplate: messages.emailSubject, messageTemplate: messages.emailBody },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Could not save your messages");
    }
  };

  const next = async () => {
    if (issue) {
      setLocalError(issue);
      return;
    }
    // Screening questions page through one at a time inside screen 21.
    if (step === 21 && screeningQueue.length) {
      const q = screeningQueue[screeningIndex];
      const draft = String(answerDrafts[q.questionKey] || "").trim();
      if (draft) {
        setBusy(true);
        try {
          await saveAnswer(q.questionKey, q.questionLabel, draft, undefined, "manual");
        } finally {
          setBusy(false);
        }
      }
      if (screeningIndex < screeningQueue.length - 1) {
        setDirection(1);
        setScreeningIndex((i) => i + 1);
        return;
      }
    }
    setBusy(true);
    try {
      await persistStep(step);
      goTo(step + 1);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not save this step");
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    if (step === 21 && screeningIndex > 0) {
      setDirection(-1);
      setScreeningIndex((i) => i - 1);
      return;
    }
    goTo(step - 1);
  };

  // Single-choice screens move on by themselves, like the reference design.
  const pickAndAdvance = (apply: () => void) => {
    apply();
    setLocalError("");
    window.setTimeout(() => goTo(step + 1), 220);
  };

  const finish = async (plan?: PaidPlanChoice) => {
    const firstMissing = [1, 3, 4, 5, 6, 8, 9, 12].find((s) => stepIssue(s));
    if (firstMissing) {
      goTo(firstMissing);
      setLocalError(stepIssue(firstMissing));
      return;
    }
    setBusy(true);
    try {
      const ok = await onFinish(plan);
      // Sent only when the save (and, for a paid plan, the payment) went through.
      if (ok) captureEvent("onboarding_completed", { plan: plan || "free", paid: Boolean(plan), extension_installed: extensionInstalled });
    } finally {
      setBusy(false);
    }
  };

  const toggle = (list: string[], value: string) =>
    list.some((v) => v.toLowerCase() === value.toLowerCase()) ? list.filter((v) => v.toLowerCase() !== value.toLowerCase()) : [...list, value];

  // ── screens ──
  let title: ReactNode = "";
  let hint: ReactNode = "";
  let body: ReactNode = null;
  let autoAdvance = false; // single choice: no Continue button
  let optional = false;
  let continueLabel = "Continue";

  switch (step) {
    case 1:
      title = "Got your resume handy?";
      hint = "We read it to fill in most of this for you. PDF, DOCX or TXT, up to 5 MB.";
      body = (
        <div className="mx-auto w-full max-w-xl space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              void onResumeUpload(file);
              goTo(2);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-violet-300 bg-white px-5 py-7 text-lg font-semibold text-slate-900 shadow-sm transition hover:border-violet-500 hover:bg-violet-50"
          >
            <UploadCloud className="h-6 w-6 text-violet-600" />
            {hasResume ? "Upload a different resume" : "Upload my resume"}
          </button>
          {resumeFileName ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-emerald-700 shadow-sm">
              <FileText className="h-4 w-4" /> {resumeFileName} is on file
            </div>
          ) : null}
        </div>
      );
      break;
    case 2: {
      const reading = uploading || parsingStatus === "scanning" || parsingStatus === "parsing";
      title = reading ? "Reading your resume…" : hasResume ? "We've read your resume" : "No resume yet";
      hint = reading ? "Our AI is pulling out your details, skills and job titles." : "Check the next screens: we filled in what we found.";
      body = (
        <div className="mx-auto w-full max-w-xl rounded-3xl bg-white p-5 shadow-sm">
          {reading ? (
            <div className="flex flex-col items-center gap-3 py-6 text-slate-600">
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
              <span className="text-sm font-medium">This takes a few seconds</span>
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              {[
                ["Name", profile.fullName],
                ["Phone", profile.phone],
                ["City", [profile.city, profile.state].filter(Boolean).join(", ")],
                ["Experience", yearsValue ? `${yearsValue} years` : ""],
                ["Job titles", preferences.searchTerms.slice(0, 3).join(", ")],
                ["Skills found", suggestedSkills.length ? `${suggestedSkills.length} keywords` : ""],
              ].map(([label, value]) => (
                <li key={label} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 last:border-0">
                  <span className="text-slate-500">{label}</span>
                  <span className={`text-right font-semibold ${value ? "text-slate-900" : "text-amber-600"}`}>{value || "We'll ask you"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
      if (reading) continueLabel = "Please wait…";
      break;
    }
    case 3:
      title = "What's your full name?";
      hint = "As it should appear on your applications.";
      body = <TextField value={profile.fullName} onChange={(v) => setProfile((p) => ({ ...p, fullName: v }))} placeholder="e.g. Priya Sharma" />;
      break;
    case 4:
      title = "What's your phone number?";
      hint = "Recruiters use it to reach you. Include your country code.";
      body = <TextField type="tel" value={profile.phone} onChange={(v) => setProfile((p) => ({ ...p, phone: v }))} placeholder="+91 98765 43210" />;
      break;
    case 5:
      title = "Where do you live?";
      hint = "Start typing and pick your city: state and country fill in for you.";
      body = (
        <div className="mx-auto grid w-full max-w-xl gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <CityAutocomplete
              value={profile.city}
              onChange={(v) => setProfile((p) => ({ ...p, city: v }))}
              onPick={(place) => setProfile((p) => ({ ...p, city: place.city, state: place.state || p.state, country: place.country || p.country }))}
            />
          </div>
          <TextField label="State / region" value={profile.state} onChange={(v) => setProfile((p) => ({ ...p, state: v }))} placeholder="e.g. Karnataka" />
          <label className="mx-auto block w-full max-w-xl">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Country</span>
            <input
              list="onboarding-countries"
              value={profile.country}
              onChange={(e) => setProfile((p) => ({ ...p, country: e.target.value }))}
              placeholder="e.g. India"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
            <datalist id="onboarding-countries">
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
        </div>
      );
      break;
    case 6:
      title = "Your LinkedIn and portfolio";
      hint = "Optional, but they make your applications stronger.";
      optional = true;
      body = (
        <div className="space-y-3">
          <TextField label="LinkedIn URL" value={profile.linkedinUrl} onChange={(v) => setProfile((p) => ({ ...p, linkedinUrl: v }))} placeholder="linkedin.com/in/your-name" error={isValidUrl(profile.linkedinUrl) ? "" : "Not a valid link"} />
          <TextField label="Portfolio / website" value={profile.portfolioUrl} onChange={(v) => setProfile((p) => ({ ...p, portfolioUrl: v }))} placeholder="yourportfolio.com" error={isValidUrl(profile.portfolioUrl) ? "" : "Not a valid link"} />
        </div>
      );
      break;
    case 7:
      title = "Are you authorized to work in the U.S.?";
      hint = "Only used when you apply to U.S. jobs.";
      optional = true;
      autoAdvance = true;
      body = (
        <ChoiceCards
          options={US_WORK_AUTH_OPTIONS.map((o) => ({ value: o, label: o }))}
          value={profile.workAuthorizationUS}
          onPick={(v) => pickAndAdvance(() => setProfile((p) => ({ ...p, workAuthorizationUS: v })))}
        />
      );
      break;
    case 8:
      title = "Will you need visa sponsorship?";
      hint = "Employers ask this on almost every application.";
      autoAdvance = true;
      body = (
        <ChoiceCards
          options={[{ value: "No", label: "No, I don't need sponsorship" }, { value: "Yes", label: "Yes, I'll need sponsorship" }]}
          value={profile.visaSponsorship}
          onPick={(v) => pickAndAdvance(() => setProfile((p) => ({ ...p, visaSponsorship: v })))}
        />
      );
      break;
    case 9:
      title = "How many years of experience do you have?";
      hint = "Total professional experience.";
      body = (
        <div className="mx-auto w-full max-w-xl">
          <div className="grid grid-cols-5 gap-2.5">
            {EXPERIENCE_OPTIONS.map((o) => {
              const active = yearsValue === o;
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    setProfile((p) => ({ ...p, yearsOfExperience: o }));
                    setPreferences((p) => ({ ...p, yearsOfExperience: o }));
                  }}
                  className={`rounded-2xl border-2 py-3 text-lg font-bold transition ${active ? "border-violet-500 bg-violet-600 text-white" : "border-transparent bg-white text-slate-900 shadow-sm hover:border-violet-200"}`}
                >
                  {o === "15" ? "15+" : o}
                </button>
              );
            })}
          </div>
          <div className="mx-auto mt-3 max-w-[14rem]">
            <TextField
              type="number"
              value={yearsValue}
              onChange={(v) => {
                setProfile((p) => ({ ...p, yearsOfExperience: v }));
                setPreferences((p) => ({ ...p, yearsOfExperience: v }));
              }}
              placeholder="Other: type a number"
            />
          </div>
        </div>
      );
      break;
    case 10:
      title = "What's your highest education?";
      autoAdvance = true;
      optional = true;
      body = (
        <ChoiceCards
          columns={2}
          options={EDUCATION_OPTIONS.map((o) => ({ value: o, label: o }))}
          value={profile.educationLevel}
          onPick={(v) => pickAndAdvance(() => setProfile((p) => ({ ...p, educationLevel: v })))}
        />
      );
      break;
    case 11:
      title = "How well do you speak English?";
      autoAdvance = true;
      optional = true;
      body = (
        <ChoiceCards
          options={ENGLISH_OPTIONS.map((o) => ({ value: o, label: o }))}
          value={profile.englishProficiency}
          onPick={(v) => pickAndAdvance(() => setProfile((p) => ({ ...p, englishProficiency: v })))}
        />
      );
      break;
    case 12:
      title = "What job titles are you looking for?";
      hint = "These keywords decide which jobs match your role. You can change them anytime.";
      body = (
        <div>
          <ChipInput
            values={preferences.searchTerms}
            onChange={(values) => {
              setPreferences((p) => ({ ...p, searchTerms: values }));
              setProfile((p) => ({ ...p, preferredJobTitles: values }));
            }}
            placeholder="Type a job title…"
          />
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => void onGenerateAi()}
              disabled={generatingAi}
              className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 shadow-sm hover:bg-violet-50 disabled:opacity-60"
            >
              {generatingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generatingAi ? "Finding titles from your resume…" : "Suggest titles from my resume"}
            </button>
          </div>
        </div>
      );
      break;
    case 13:
      title = "What type of work are you open to?";
      hint = "Pick all that apply.";
      optional = true;
      body = (
        <MultiChips options={JOB_TYPE_OPTIONS} values={preferences.jobTypes} onToggle={(v) => setPreferences((p) => ({ ...p, jobTypes: toggle(p.jobTypes, v) }))} />
      );
      break;
    case 14:
      title = "What type of jobs do you prefer?";
      hint = "Pick all that apply.";
      body = (
        <ChoiceCards
          options={WORK_MODE_CARDS}
          values={workModes}
          onPick={(v) => {
            // "Open to all" stands alone; picking a specific mode replaces it.
            const nextModes =
              v === "Flexible"
                ? workModes.includes("Flexible") ? [] : ["Flexible"]
                : toggle(workModes.filter((m) => m !== "Flexible"), v);
            const joined = nextModes.join(", ");
            setPreferences((p) => ({ ...p, workMode: joined }));
            setProfile((p) => ({ ...p, workModePreference: joined }));
            setLocalError("");
          }}
        />
      );
      break;
    case 15:
      title = isRemote ? "Any cities you'd also work in?" : "Which cities do you want to work in?";
      hint = "Cities or regions only. Remote is a work mode, chosen on the previous screen.";
      optional = true;
      body = (
        <ChipInput
          values={preferences.searchLocations}
          onChange={(values) => setPreferences((p) => ({ ...p, searchLocations: values }))}
          placeholder="Type a city…"
          suggestions={profile.city ? [profile.city] : []}
          reject={(v) => (isRemoteLike(v) ? "Remote / work from home is not a location. Pick Remote on the previous screen." : null)}
        />
      );
      break;
    case 16:
      title = "Which countries should we search?";
      optional = true;
      body = (
        <ChipInput
          values={preferences.preferredCountries}
          onChange={(values) => setPreferences((p) => ({ ...p, preferredCountries: values }))}
          placeholder="Type a country…"
          suggestions={uniq([profile.country, ...COUNTRY_SUGGESTIONS].filter(Boolean))}
          reject={(v) => (isRemoteLike(v) ? "That's a work mode, not a country." : null)}
        />
      );
      break;
    case 17: {
      title = "What's your desired minimum annual salary?";
      hint = "In your local currency. We use it to answer salary questions.";
      optional = true;
      const value = Number(preferences.salaryMin || 0);
      body = (
        <div className="mx-auto w-full max-w-xl rounded-3xl bg-white p-5 shadow-sm">
          <div className="text-center text-3xl font-bold text-slate-900">{value ? value.toLocaleString() : "Not set"}</div>
          <div className="mt-1 text-center text-sm font-medium text-slate-500">
            {value ? (
              <>
                per year · <span className="font-semibold text-violet-700">{Math.round(value / 12).toLocaleString()} per month</span>
              </>
            ) : (
              "Drag the slider or type an amount"
            )}
          </div>
          <input
            type="range"
            min={0}
            max={10000000}
            step={50000}
            value={Math.min(value, 10000000)}
            onChange={(e) => setPreferences((p) => ({ ...p, salaryMin: e.target.value === "0" ? "" : e.target.value }))}
            className="mt-4 w-full accent-violet-600"
          />
          <div className="mt-3">
            <TextField type="number" label="Or type an exact amount" value={preferences.salaryMin} onChange={(v) => setPreferences((p) => ({ ...p, salaryMin: v }))} placeholder="e.g. 1200000" />
          </div>
        </div>
      );
      break;
    }
    case 18:
      title = "Your core technical skills & stack";
      hint = "Used to score each job match and answer technical screening questions. Keep the top 10–15.";
      optional = true;
      body = (
        <div>
          <ChipInput values={skills} onChange={setSkills} placeholder="Add a skill, e.g. React…" suggestions={uniq([...aiSkills, ...suggestedSkills])} />
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => void suggestSkills()}
              disabled={suggestingSkills}
              className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 shadow-sm hover:bg-violet-50 disabled:opacity-60"
            >
              {suggestingSkills ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {suggestingSkills ? "Reading your resume for skills…" : "Suggest skills with AI"}
            </button>
            {skillsNote ? <p className="mt-2 text-xs font-medium text-slate-500">{skillsNote}</p> : null}
          </div>
        </div>
      );
      break;
    case 19:
      title = "Jobs mentioning these will be skipped";
      hint = "Negative & exclude keywords (auto-skip). Add anything you never want to apply to.";
      optional = true;
      body = <ChipInput values={excludeKeywords} onChange={setExcludeKeywords} placeholder="e.g. Unpaid, Night shift…" chipTone="rose" suggestions={["Unpaid", "Commission only", "Night shift", "Internship", "Junior", "Security Clearance", "Sales"]} />;
      break;
    case 20:
      title = "Any companies you never want to apply to?";
      hint = "Your current employer, for example.";
      optional = true;
      body = (
        <ChipInput values={preferences.excludedCompanies} onChange={(values) => setPreferences((p) => ({ ...p, excludedCompanies: values }))} placeholder="Type a company name…" chipTone="rose" />
      );
      break;
    case 21: {
      optional = true;
      if (!screeningQueue.length) {
        title = "Screening answers";
        hint = "No questions are waiting right now. When a job asks something new, the extension saves it and you answer it once.";
        body = (
          <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-2 rounded-3xl bg-white p-6 text-center shadow-sm">
            <Check className="h-8 w-8 text-emerald-500" />
            <span className="text-sm font-medium text-slate-600">You're all caught up.</span>
          </div>
        );
      } else {
        const q = screeningQueue[Math.min(screeningIndex, screeningQueue.length - 1)];
        title = q.questionLabel;
        hint = `Screening question ${screeningIndex + 1} of ${screeningQueue.length}. Answered once, reused on every application.`;
        body = (
          <div>
            <TextField
              value={answerDrafts[q.questionKey] || ""}
              onChange={(v) => setAnswerDrafts((d) => ({ ...d, [q.questionKey]: v }))}
              placeholder="Your answer"
            />
            {q.validationMessage ? <Tip>{q.validationMessage}</Tip> : null}
          </div>
        );
        continueLabel = screeningIndex < screeningQueue.length - 1 ? "Save & next question" : "Save & continue";
      }
      break;
    }
    case 22:
      title = "How picky should we be?";
      hint = "";
      optional = true;
      body = (
        <div className="space-y-3">
          <ChoiceCards columns={2} compact options={CONFIDENCE_CARDS} value={preferences.confidenceLevel} onPick={(v) => setPreferences((p) => ({ ...p, confidenceLevel: v }))} />
          <div>
            <p className="mb-1.5 text-center text-sm font-semibold text-slate-700">Date posted</p>
            <MultiChips options={DATE_POSTED_OPTIONS} values={[datePosted]} onToggle={setDatePosted} />
          </div>
          <div>
            <p className="mb-1.5 text-center text-sm font-semibold text-slate-700">Experience level (none = any)</p>
            <MultiChips options={EXPERIENCE_LEVEL_OPTIONS} values={experienceLevels} onToggle={(v) => setExperienceLevels((l) => toggle(l, v))} />
          </div>
          {/* Always on: the extension only applies through LinkedIn Easy Apply. */}
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-700">
            <span>Easy Apply jobs only</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-white" title="Always on">
              <Lock className="h-3.5 w-3.5" /> Yes
            </span>
          </div>
        </div>
      );
      break;
    case 23:
      title = "Your message to recruiters";
      hint = "Sent from the WhatsApp and Email tools. {name}, {job_title} and {company} are filled in for each post.";
      optional = true;
      body = (
        <div className="mx-auto w-full max-w-xl space-y-3">
          <div className="mx-auto flex w-fit rounded-full bg-white p-1 shadow-sm">
            {(["wa", "email"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMessageTab(tab)}
                className={`rounded-full px-5 py-1.5 text-sm font-semibold transition ${messageTab === tab ? "bg-violet-600 text-white" : "text-slate-600 hover:text-slate-900"}`}
              >
                {tab === "wa" ? "WhatsApp" : "Email"}
              </button>
            ))}
          </div>
          {messageTab === "wa" ? (
            <textarea aria-label="WhatsApp message" value={messages.wa} onChange={(e) => setMessages((m) => ({ ...m, wa: e.target.value }))} rows={9} className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
          ) : (
            <>
              <TextField value={messages.emailSubject} onChange={(v) => setMessages((m) => ({ ...m, emailSubject: v }))} placeholder="Email subject" />
              <textarea aria-label="Email message" value={messages.emailBody} onChange={(e) => setMessages((m) => ({ ...m, emailBody: e.target.value }))} rows={7} className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
            </>
          )}
        </div>
      );
      break;
    case 24:
      title = extensionInstalled ? "Extension installed" : "Install the AutoApply CV extension";
      hint = extensionInstalled
        ? "You're connected. The extension applies to jobs for you inside LinkedIn."
        : "It applies to jobs for you inside LinkedIn. Free, takes 10 seconds.";
      optional = true;
      continueLabel = extensionInstalled ? "Continue" : "I've installed it";
      body = (
        <div className="mx-auto w-full max-w-xl rounded-3xl bg-white p-6 text-center shadow-sm">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl shadow-md ${extensionInstalled ? "bg-emerald-500" : "bg-gradient-to-br from-violet-600 to-indigo-600"}`}>
            {extensionInstalled ? <Check className="h-8 w-8 text-white" /> : <Chrome className="h-8 w-8 text-white" />}
          </div>
          {extensionInstalled ? (
            <p className="mt-4 text-sm font-semibold text-emerald-700">Detected and ready.</p>
          ) : (
            <>
              <a
                href={EXTENSION_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-violet-700"
              >
                <Chrome className="h-5 w-5" /> Add to Chrome, it's free <ExternalLink className="h-4 w-4 opacity-80" />
              </a>
              <ol className="mx-auto mt-5 max-w-sm space-y-1.5 text-left text-sm text-slate-600">
                <li><span className="font-semibold text-slate-900">1.</span> Open the Chrome Web Store (new tab)</li>
                <li><span className="font-semibold text-slate-900">2.</span> Click "Add to Chrome", then "Add extension"</li>
                <li><span className="font-semibold text-slate-900">3.</span> Come back here: we detect it automatically</li>
              </ol>
              <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for the extension…
              </p>
            </>
          )}
        </div>
      );
      break;
    case 25: {
      title = "You're all set! Pick your plan";
      hint = `${preferences.searchTerms.length} job titles · ${skills.length} skills · ${excludeKeywords.length} skip keywords are ready.`;
      const plan = PLAN_CARDS.find((p) => p.id === chosenPlan) || PLAN_CARDS[0];
      continueLabel = `Pay ${plan.price} · ${plan.name} for 30 days`;
      body = (
        <div className="mx-auto grid w-full max-w-xl gap-2.5" role="radiogroup" aria-label="Plan">
          <p className="-mt-2 text-center text-xs font-medium text-slate-500">One-time payment · no auto-renewal</p>
          {PLAN_CARDS.map((p) => {
            const active = p.id === chosenPlan;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setChosenPlan(p.id)}
                className={`relative flex w-full items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left shadow-sm transition ${
                  active ? "border-violet-500 ring-4 ring-violet-500/10" : "border-transparent hover:border-violet-200"
                }`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-violet-600 bg-violet-600" : "border-slate-300"}`}>
                  {active ? <Check className="h-3 w-3 text-white" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-base font-bold text-slate-900">
                    {p.name}
                    {p.badge ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">{p.badge}</span> : null}
                  </span>
                  <span className="block text-xs text-slate-500">{p.tagline}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-lg font-black text-violet-700">{p.price}</span>
                  <span className="block text-[11px] text-slate-500">30 days</span>
                </span>
              </button>
            );
          })}
        </div>
      );
      break;
    }
  }

  const sectionIndex = SECTIONS.findIndex((s) => step >= s.from && step <= s.to);
  const section = SECTIONS[sectionIndex];
  const shownError = localError || error;
  const reading = step === 2 && (uploading || parsingStatus === "scanning" || parsingStatus === "parsing");

  return (
    <div className="relative h-[100dvh] w-full overflow-clip bg-[#f4f4f7]">
      <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-violet-300/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-emerald-200/40 blur-3xl" />

      <div className="relative mx-auto flex h-full w-full max-w-6xl flex-col px-4 pt-3 sm:px-6 sm:pt-4">
        {/* header */}
        <div className="relative flex items-center justify-center">
          {step > 1 ? (
            <button type="button" onClick={back} className="absolute left-0 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
          ) : null}
          <div className="flex items-center gap-2">
            <img src="/logos/android-chrome-192x192.png" alt="" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold text-violet-700">AutoApply CV</span>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="absolute right-0 text-sm font-semibold text-slate-500 hover:text-slate-900"
          >
            Log out
          </button>
        </div>

        {/* progress: one segment per section */}
        <div className="mx-auto mt-3 flex w-full max-w-3xl items-center gap-1.5" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
          {SECTIONS.map((s, i) => {
            const done = i < sectionIndex;
            const current = i === sectionIndex;
            const fill = done ? 100 : current ? Math.round(((step - s.from + 1) / (s.to - s.from + 1)) * 100) : 0;
            return (
              <div key={s.name} className="flex flex-1 items-center gap-1.5">
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${done ? "text-violet-600" : current ? "bg-violet-600" : "bg-violet-200/70"}`}>
                  {done ? <Check className="h-4 w-4" /> : null}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-violet-200/60">
                  <div className="h-full rounded-full bg-violet-600 transition-all duration-500" style={{ width: `${fill}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 text-center text-xs font-semibold text-slate-600">
          {section?.name} · {step}/{TOTAL_STEPS}
        </div>

        {/* question in the middle; on large screens a live profile card (or map) left and real stats right */}
        <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)_16rem] xl:grid-cols-[17rem_minmax(0,1fr)_17rem]">
          <aside className="hidden min-h-0 flex-col justify-center py-4 lg:flex">
            {step === 5 ? (
              <MapPanel query={[profile.city, profile.state, profile.country].filter(Boolean).join(", ")} />
            ) : (
              <ProfileCard
                step={step}
                total={TOTAL_STEPS}
                data={{
                  name: profile.fullName,
                  phone: profile.phone,
                  city: [profile.city, profile.state].filter(Boolean).join(", "),
                  titles: preferences.searchTerms,
                  years: yearsValue,
                  education: profile.educationLevel,
                  workModes: workModes.map((m) => WORK_MODE_CARDS.find((c) => c.value === m)?.label || m),
                  skills,
                  hasResume,
                  hasLinkedin: Boolean(profile.linkedinUrl.trim()),
                }}
              />
            )}
          </aside>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden py-4">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={`${step}-${screeningIndex}`}
            custom={direction}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * -48 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="my-auto"
          >
            <h1 className="mx-auto max-w-2xl text-center text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
            {hint ? <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500">{hint}</p> : null}
            <div className="mt-5">{body}</div>
            {shownError ? (
              <p className="mx-auto mt-3 flex max-w-xl items-center justify-center gap-1.5 text-center text-sm font-medium text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" /> {shownError}
              </p>
            ) : null}
          </motion.div>
          </AnimatePresence>
        </div>
          <aside className="hidden min-h-0 flex-col justify-center py-4 lg:flex">
            <InsightPanel
              step={step}
              insights={insights}
              city={profile.city}
              years={yearsValue}
              search={{
                titles: preferences.searchTerms,
                jobTypes: preferences.jobTypes,
                modes: workModes.map((m) => WORK_MODE_CARDS.find((c) => c.value === m)?.label || m),
                cities: preferences.searchLocations,
                countries: isRemote ? [] : preferences.preferredCountries,
                salary: Number(preferences.salaryMin || 0),
              }}
              messagePreview={messages.wa
                .replace(/\{name\}/g, "Ananya")
                .replace(/\{job_title\}/g, preferences.searchTerms[0] || "Frontend Developer")
                .replace(/\{company\}/g, "a company")}
            />
          </aside>
        </div>

        {/* bottom actions */}
        <div className="shrink-0 pb-4 pt-1">
          <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-1.5">
            {!autoAdvance ? (
              <button
                type="button"
                onClick={() => void (step === TOTAL_STEPS ? finish(chosenPlan) : next())}
                disabled={busy || reading}
                className={`w-full rounded-full py-3.5 text-base font-semibold shadow-md transition ${
                  issue || busy || reading ? "bg-slate-300 text-slate-500" : "bg-violet-600 text-white hover:bg-violet-700"
                }`}
              >
                {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : continueLabel}
              </button>
            ) : null}
            {step === TOTAL_STEPS ? (
              <button type="button" onClick={() => void finish()} disabled={busy} className="text-sm font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline">
                Continue with Free (3 applies a day)
              </button>
            ) : null}
            {optional && step !== TOTAL_STEPS ? (
              <button type="button" onClick={() => goTo(step + 1)} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
                Skip for now
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
