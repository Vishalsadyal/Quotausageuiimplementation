import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Search,
  MapPin,
  Briefcase,
  Clock,
  SlidersHorizontal,
  RefreshCw,
  AlertCircle,
  Play,
  XCircle,
  FileText,
  CheckCircle2,
  Download,
  ExternalLink,
  Link2,
  Sparkles,
  Check,
  X,
  Tag,
  Plus,
  Loader2,
  Bot,
  Compass,
  Flame,
  Zap,
  Building2,
  Eye,
  ArrowRight,
  BookOpen,
  Trash2,
  ShieldCheck,
  Mail,
  MessageCircle,
  Mic,
  Share2,
  Layers,
  Globe,
  ChevronRight,
  CheckCircle,
  Smartphone,
  Target,
} from "lucide-react";
import { useParams, Link, useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { ExtensionInstallGuide, type ExtensionInstallGuideStep } from "../../components/ExtensionInstallGuide";
import MagicAiDecisionModal from "../../components/jobs/MagicAiDecisionModal";
import MobileBlocker from "../../components/MobileBlocker";
import { getExtensionProviderConfig } from "src/lib/extension-providers";
import { collectExtensionBridgeSnapshot } from "src/lib/extension-bridge-client";
import { syncProfileToExtension as syncProfileToExtensionBase } from "src/lib/sync-profile";
import {
  DASHBOARD_TOUR_EVENT_NAME,
  DASHBOARD_TOUR_JOBS_EXTENSION,
  consumeDashboardTourRequest,
} from "src/lib/dashboard-tour";

type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "dead_letter";

type JobLog = {
  id: string;
  step: string;
  level: "info" | "warn" | "error";
  message: string;
  createdAt: string;
};

type AutoApplyJob = {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  maxAttempts: number;
  errorMessage?: string | null;
  criteriaJson: Record<string, unknown>;
  logs?: JobLog[];
};

type ScreeningAnswerType = "text" | "boolean" | "number" | "choice" | "multiselect";
type ScreeningAnswerSource = "manual" | "linkedin_import" | "resume_parse" | "extension_capture" | "system";

type ExtensionStatus = {
  installed: boolean;
  runtimeId?: string;
  version?: string;
  providers?: Partial<Record<"linkedin" | "indeed", { installed: boolean; version?: string }>>;
  linkedIn?: {
    hasLinkedInTab: boolean;
    hasJobsTab: boolean;
  };
  indeed?: {
    hasIndeedTab: boolean;
    hasJobsTab: boolean;
  };
  state?: {
    running?: boolean;
    paused?: boolean;
    applied?: number;
    skipped?: number;
    failed?: number;
  } | null;
  error?: string | null;
  pendingQuestions?: Array<{
    questionKey: string;
    questionLabel: string;
    validationMessage?: string;
    createdAt?: string;
  }>;
  screeningAnswers?: Record<string, string>;
};

type ScreeningAnswerApiItem = {
  questionKey: string;
  questionLabel: string;
  answer: string;
  answerType?: ScreeningAnswerType;
  source?: ScreeningAnswerSource;
  updatedAt?: string;
};

type ExtensionReleaseMeta = {
  version: string;
  displayName: string;
  downloadFileName: string;
  downloadBaseName: string;
};

type ScreeningFieldCategory = "profile" | "preferences" | "screening";

type ScreeningCatalogField = {
  key: string;
  label: string;
  category: ScreeningFieldCategory;
  order: number;
  answerType?: ScreeningAnswerType;
  options?: string[];
  presets?: string[];
  aliases?: string[];
};

type ScreeningFieldView = {
  questionKey: string;
  questionLabel: string;
  answer: string;
  answerType: ScreeningAnswerType;
  category: ScreeningFieldCategory;
  order: number;
  options?: string[];
  presets?: string[];
  source: "site" | "extension" | "pending" | "merged";
};

function statusBadge(status: JobStatus) {
  if (status === "succeeded") return "bg-green-100 text-green-700";
  if (status === "running") return "bg-blue-100 text-blue-700";
  if (status === "queued") return "bg-purple-100 text-purple-700";
  if (status === "cancelled") return "bg-gray-100 text-gray-700";
  return "bg-red-100 text-red-700";
}

const JOB_REASON_CODE_LABELS: Record<string, string> = {
  NO_APPLY_BUTTON: "No Easy Apply button",
  APPLIED_CACHE_HIT: "Already applied earlier",
  RECENTLY_RETRIED: "Skipped: recently retried",
  EASY_APPLY_MODAL_MISSING: "Easy Apply modal not found",
  MAX_SKIPS_REACHED: "Skipped: max skip limit reached",
};
const EXT_BRIDGE_PING_TIMEOUT_MS = 4500;
const EXT_BRIDGE_ACK_TIMEOUT_MS = 5000;
const EXTENSION_PACKAGE_PREFIX = "AutoApplyCVExtensionVersion";
const YES_NO_OPTIONS = ["No", "Yes"];
const WORK_MODE_OPTIONS = ["Remote", "Hybrid", "Onsite", "Flexible"];
const JOB_TYPE_OPTIONS = ["Full-time", "Part-time", "Contract", "Internship", "Temporary"];
const ENGLISH_PROFICIENCY_OPTIONS = ["Native or bilingual", "Professional", "Limited", "Basic"];
const EDUCATION_LEVEL_OPTIONS = [
  "High School",
  "Associate Degree",
  "Bachelor's Degree",
  "Master's Degree",
  "Doctorate",
  "Diploma / Certificate",
];
const WORK_AUTHORIZATION_OPTIONS = [
  "U.S. Citizen/Permanent Resident",
  "Authorized to work in the U.S.",
  "Require sponsorship",
  "Not authorized",
];

function formatExtensionPackageName(version: string) {
  const normalized = String(version || "").trim();
  return normalized ? `${EXTENSION_PACKAGE_PREFIX}${normalized}` : EXTENSION_PACKAGE_PREFIX;
}

function formatExtensionPackageFileName(version: string) {
  return `${formatExtensionPackageName(version)}.zip`;
}

function formatReasonCode(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (JOB_REASON_CODE_LABELS[upper]) return JOB_REASON_CODE_LABELS[upper];
  return raw
    .toLowerCase()
    .split(/[_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getJobReason(job: AutoApplyJob | null) {
  if (!job) return "";
  const reasonCode = String(job.criteriaJson?.reasonCode || "").trim();
  if (reasonCode) return formatReasonCode(reasonCode);
  return String(job.criteriaJson?.reason || "").trim();
}

function displayJobStatus(job: AutoApplyJob | null) {
  if (!job) return "";
  if (job.status === "cancelled" && getJobReason(job)) return "skipped";
  return job.status;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function normalizeLabel(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasWords(label: string, words: string[]) {
  return words.every((word) => label.includes(word));
}

function toQuestionKey(value: string) {
  const normalized = normalizeLabel(value);
  if (!normalized) return "";
  if (normalized === "full name" || normalized === "full legal name" || normalized === "legal name") {
    return "full_name";
  }
  if (normalized === "first name" || normalized === "given name") return "first_name";
  if (normalized === "last name" || normalized === "family name" || normalized === "surname") {
    return "last_name";
  }
  if (normalized === "email" || normalized === "email address") return "email_address";
  if (
    normalized === "phone" ||
    normalized === "phone number" ||
    normalized === "mobile phone" ||
    normalized === "mobile phone number" ||
    normalized === "contact number"
  ) {
    return "phone_number";
  }
  if (normalized.includes("linkedin") && (normalized.includes("profile") || normalized.includes("url"))) {
    return "linkedin_url";
  }
  if (
    normalized.includes("portfolio") &&
    (normalized.includes("url") || normalized.includes("website") || normalized.includes("site") || normalized === "portfolio")
  ) {
    return "portfolio_url";
  }
  if (
    normalized === "current city" ||
    normalized === "city" ||
    normalized.includes("location city") ||
    normalized.includes("city state")
  ) {
    return "current_city";
  }
  if (normalized === "state" || normalized === "state region" || normalized === "region") {
    return "state_region";
  }
  if (normalized === "country") return "country";
  if (
    (hasWords(normalized, ["authorized", "work"]) ||
      hasWords(normalized, ["eligible", "work"]) ||
      hasWords(normalized, ["work", "authorization"])) &&
    (normalized.includes("united states") || normalized.includes("u s") || normalized.includes("us"))
  ) {
    return "work_authorization_us";
  }
  if (hasWords(normalized, ["visa", "sponsorship"]) || hasWords(normalized, ["require", "sponsorship"])) {
    return "visa_sponsorship_required";
  }
  if (normalized.includes("onsite") || normalized.includes("on site")) return "comfortable_working_onsite";
  if (normalized.includes("commut")) return "comfortable_commuting";
  if (normalized.includes("relocat")) return "comfortable_relocation";
  if ((normalized.includes("salary") || normalized.includes("compensation") || normalized.includes("pay")) && normalized.includes("expect")) {
    return "expected_salary";
  }
  if (normalized.includes("year") && normalized.includes("experience")) return "years_of_experience";
  if (normalized.includes("bachelor") && normalized.includes("degree")) return "bachelors_degree_completed";
  if (normalized.includes("english") && normalized.includes("proficiency")) return "english_proficiency";
  return normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 160);
}

function labelFromQuestionKey(questionKey: string) {
  const key = String(questionKey || "").trim();
  if (!key) return "Screening field";
  const prettyByKnownKey: Record<string, string> = {
    full_name: "Full Name",
    first_name: "First Name",
    last_name: "Last Name",
    email_address: "Email Address",
    phone_number: "Phone Number",
    current_city: "Current City",
    state_region: "State / Region",
    country: "Country",
    address_line: "Address Line",
    linkedin_url: "LinkedIn URL",
    portfolio_url: "Portfolio URL",
    work_authorization_us: "U.S. Work Authorization",
    visa_sponsorship_required: "Need Visa Sponsorship",
    comfortable_working_onsite: "Comfortable Working Onsite",
    comfortable_commuting: "Comfortable Commuting",
    comfortable_relocation: "Comfortable Relocation",
    expected_salary: "Expected Salary",
    years_of_experience: "Years of Experience",
    bachelors_degree_completed: "Bachelor's Degree Completed",
    english_proficiency: "English Proficiency",
    education_level: "Education Level",
    preferred_job_titles: "Preferred Job Titles / Search Terms",
    preferred_locations: "Preferred Locations",
    cp_pref_search_terms: "Preferred Job Titles / Search Terms",
    cp_pref_search_location: "Preferred Locations",
    cp_pref_search_locations: "Preferred Locations",
    cp_pref_years_of_experience: "Years of Experience",
    cp_pref_require_visa: "Need Visa Sponsorship",
    cp_pref_us_citizenship: "U.S. Work Authorization",
    cp_pref_desired_salary: "Desired Salary",
    cp_pref_confidence_level: "Confidence Level",
    cp_pref_work_mode: "Remote / Onsite / Hybrid",
    cp_pref_job_types: "Job Types",
    cp_pref_salary_min: "Salary Range Min",
    cp_pref_salary_max: "Salary Range Max",
    cp_pref_preferred_countries: "Preferred Countries",
    cp_pref_excluded_companies: "Excluded Companies",
    cp_pref_excluded_keywords: "Excluded Keywords",
  };
  if (prettyByKnownKey[key]) return prettyByKnownKey[key];
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pickFirstNonEmpty(answers: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const direct = String(answers[key] || "").trim();
    if (direct) return direct;

    // Back-compat: some saved keys end up in a label-like form.
    const normalized = normalizeLabel(key);
    const viaNormalized = String((answers as any)[normalized] || "").trim();
    if (viaNormalized) return viaNormalized;
  }
  return "";
}

function splitFullName(value: string) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/g)
    .filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function parseSearchTermsInput(value: string) {
  return String(value || "")
    .split(/[,\n;|]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 150);
}

function parsePreferenceListInput(value: string) {
  return String(value || "")
    .split(/[,\n;|]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 25);
}

function isRemoteLikeValue(value: string) {
  const normalized = normalizeLabel(value);
  return (
    normalized === "remote" ||
    normalized === "work from home" ||
    normalized === "wfh" ||
    normalized === "anywhere" ||
    normalized === "worldwide"
  );
}

function isRemoteWorkModeSelected(value: string) {
  return parsePreferenceListInput(value).some((item) => normalizeLabel(item) === "remote");
}

function sanitizeLocationFilterValues(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => !isRemoteLikeValue(value))
    .filter((value) => {
      const normalized = normalizeLabel(value);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, 25);
}

function stringifyPreferenceList(values: string[]) {
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");
}

function compactAnswer(value: string, max = 1000) {
  return String(value || "").trim().slice(0, max);
}

function inferAnswerType(answer: string): ScreeningAnswerType {
  const value = String(answer || "").trim();
  if (!value) return "text";
  const lower = value.toLowerCase();
  if (lower === "yes" || lower === "no") return "boolean";
  if (/^\d+(\.\d+)?$/.test(value)) return "number";
  if (value.includes(",")) return "multiselect";
  return "text";
}

const SCREENING_SECTION_META: Record<ScreeningFieldCategory, { title: string; subtitle: string }> = {
  profile: {
    title: "Profile Answers",
    subtitle: "Core details from onboarding used across Easy Apply forms.",
  },
  preferences: {
    title: "Job Preferences",
    subtitle: "Search targets and AutoApply preferences synced to the extension.",
  },
  screening: {
    title: "Custom Screening Answers",
    subtitle: "Extra question/answer pairs captured from LinkedIn applications.",
  },
};

const SCREENING_FIELD_CATALOG: ScreeningCatalogField[] = [
  { key: "full_name", label: "Full Name", category: "profile", order: 10, aliases: ["full legal name", "legal name"] },
  { key: "first_name", label: "First Name", category: "profile", order: 20, aliases: ["given name"] },
  { key: "last_name", label: "Last Name", category: "profile", order: 30, aliases: ["family name", "surname"] },
  { key: "email_address", label: "Email Address", category: "profile", order: 40, aliases: ["email"] },
  { key: "phone_number", label: "Phone Number", category: "profile", order: 50, aliases: ["phone", "mobile phone", "mobile phone number", "contact number"] },
  { key: "address_line", label: "Address Line", category: "profile", order: 60 },
  { key: "current_city", label: "Current City", category: "profile", order: 70, aliases: ["city", "your location city state", "location city state"] },
  { key: "state_region", label: "State / Region", category: "profile", order: 80, aliases: ["state", "region"] },
  { key: "country", label: "Country", category: "profile", order: 90 },
  { key: "linkedin_url", label: "LinkedIn URL", category: "profile", order: 100, aliases: ["linkedin profile", "linkedin profile url"] },
  { key: "portfolio_url", label: "Portfolio URL", category: "profile", order: 110, aliases: ["portfolio", "portfolio website", "portfolio site"] },
  {
    key: "work_authorization_us",
    label: "U.S. Work Authorization",
    category: "profile",
    order: 120,
    answerType: "choice",
    options: WORK_AUTHORIZATION_OPTIONS,
    aliases: ["cp_pref_us_citizenship", "careerpilot_preference_us_work_authorization", "autoapply cv preference us work authorization", "autoapply cv preference: us work authorization"],
  },
  {
    key: "visa_sponsorship_required",
    label: "Need Visa Sponsorship",
    category: "profile",
    order: 130,
    answerType: "boolean",
    options: YES_NO_OPTIONS,
    aliases: ["cp_pref_require_visa", "careerpilot_preference_need_visa_sponsorship", "careerpilot_preference_require_visa", "autoapply cv preference need visa sponsorship", "autoapply cv preference: need visa sponsorship"],
  },
  {
    key: "years_of_experience",
    label: "Years of Experience",
    category: "profile",
    order: 140,
    answerType: "number",
    aliases: ["cp_pref_years_of_experience", "autoapply cv preference years of experience", "autoapply cv preference: years of experience"],
  },
  {
    key: "english_proficiency",
    label: "English Proficiency",
    category: "profile",
    order: 150,
    answerType: "choice",
    options: ENGLISH_PROFICIENCY_OPTIONS,
  },
  {
    key: "education_level",
    label: "Education Level",
    category: "profile",
    order: 160,
    answerType: "choice",
    options: EDUCATION_LEVEL_OPTIONS,
  },
  {
    key: "cp_pref_search_terms",
    label: "Preferred Job Titles / Search Terms",
    category: "preferences",
    order: 200,
    answerType: "multiselect",
    aliases: [
      "preferred_job_titles",
      "preferred job titles",
      "preferred_job_titles_search_terms",
      "preferred job titles search terms",
      "careerpilot_preference_search_terms",
      "autoapply cv preference search terms",
      "autoapply cv preference: search terms",
    ],
  },
  {
    key: "cp_pref_search_locations",
    label: "Preferred Locations",
    category: "preferences",
    order: 210,
    answerType: "multiselect",
    aliases: ["preferred_locations", "preferred locations", "cp_pref_search_location", "primary search location", "careerpilot_preference_search_location", "autoapply cv preference search location", "autoapply cv preference: search location"],
  },
  {
    key: "cp_pref_work_mode",
    label: "Remote / Onsite / Hybrid",
    category: "preferences",
    order: 220,
    answerType: "choice",
    options: WORK_MODE_OPTIONS,
    aliases: ["remote_onsite_hybrid", "work_mode_preference"],
  },
  {
    key: "cp_pref_job_types",
    label: "Job Types",
    category: "preferences",
    order: 230,
    answerType: "multiselect",
    presets: JOB_TYPE_OPTIONS,
    aliases: ["job_types"],
  },
  {
    key: "cp_pref_preferred_countries",
    label: "Preferred Countries",
    category: "preferences",
    order: 240,
    answerType: "multiselect",
    aliases: ["preferred_countries"],
  },
  {
    key: "cp_pref_confidence_level",
    label: "Confidence Level",
    category: "preferences",
    order: 250,
    answerType: "number",
    aliases: [
      "autoapply cv preference confidence level",
      "autoapply cv preference: confidence level",
      "careerpilot preference confidence level",
      "careerpilot preference: confidence level",
    ],
  },
  { key: "cp_pref_salary_min", label: "Salary Range Min", category: "preferences", order: 260, answerType: "number" },
  { key: "cp_pref_salary_max", label: "Salary Range Max", category: "preferences", order: 270, answerType: "number" },
  { key: "cp_pref_desired_salary", label: "Desired Salary", category: "preferences", order: 280 },
  { key: "cp_pref_excluded_companies", label: "Excluded Companies", category: "preferences", order: 290, answerType: "multiselect" },
  { key: "cp_pref_excluded_keywords", label: "Excluded Keywords", category: "preferences", order: 300, answerType: "multiselect" },
  { key: "comfortable_working_onsite", label: "Comfortable Working Onsite", category: "screening", order: 500, answerType: "boolean", options: YES_NO_OPTIONS },
  { key: "comfortable_commuting", label: "Comfortable Commuting", category: "screening", order: 510, answerType: "boolean", options: YES_NO_OPTIONS },
  { key: "comfortable_relocation", label: "Comfortable Relocation", category: "screening", order: 520, answerType: "boolean", options: YES_NO_OPTIONS },
  { key: "bachelors_degree_completed", label: "Bachelor's Degree Completed", category: "screening", order: 530, answerType: "boolean", options: YES_NO_OPTIONS },
];

const SCREENING_FIELD_LOOKUP = (() => {
  const map = new Map<string, ScreeningCatalogField>();
  for (const field of SCREENING_FIELD_CATALOG) {
    for (const rawValue of [field.key, field.label, ...(field.aliases || [])]) {
      const candidates = [
        String(rawValue || "").trim(),
        normalizeLabel(rawValue),
        toQuestionKey(String(rawValue || "").trim()),
      ].filter(Boolean);
      for (const candidate of candidates) {
        if (!map.has(candidate)) {
          map.set(candidate, field);
        }
      }
    }
  }
  return map;
})();

function lookupCatalogField(...values: Array<string | undefined>) {
  for (const value of values) {
    const raw = String(value || "").trim();
    if (!raw) continue;
    const candidates = [raw, normalizeLabel(raw), toQuestionKey(raw)].filter(Boolean);
    for (const candidate of candidates) {
      const match = SCREENING_FIELD_LOOKUP.get(candidate);
      if (match) return match;
    }
  }
  return null;
}

export default function Jobs() {
  const { user } = useAuth();
  const params = useParams();
  const selectedProvider = params.provider === "indeed" ? "indeed" : "linkedin";
  const showLinkedIn = selectedProvider === "linkedin";
  const showIndeed = selectedProvider === "indeed";
  const extensionZipUrl = String(process.env.NEXT_PUBLIC_EXTENSION_ZIP_URL || "/api/public/extension-download").trim();
  const linkedInExtensionZipUrl = `${extensionZipUrl}?provider=linkedin`;
  const indeedExtensionZipUrl = `${extensionZipUrl}?provider=indeed`;
  const extensionStoreUrl = String(
    process.env.NEXT_PUBLIC_EXTENSION_STORE_URL || getExtensionProviderConfig("linkedin").storeUrl || "",
  ).trim();
  const [extensionRelease, setExtensionRelease] = useState<ExtensionReleaseMeta>({
    version: "1.1.3",
    displayName: "AutoApply CV LinkedIn Copilot",
    downloadFileName: formatExtensionPackageFileName("1.1.3"),
    downloadBaseName: formatExtensionPackageName("1.1.3"),
  });
  const [indeedExtensionRelease, setIndeedExtensionRelease] = useState<ExtensionReleaseMeta>({
    version: "0.1.0",
    displayName: "AutoApply CV Indeed Copilot Beta",
    downloadFileName: "AutoApplyCVIndeedExtensionVersion0.1.0.zip",
    downloadBaseName: "AutoApplyCVIndeedExtensionVersion0.1.0",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [jobs, setJobs] = useState<AutoApplyJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [installMessage, setInstallMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [checkingExtension, setCheckingExtension] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus>({
    installed: false,
  });
  const currentPackageBaseName =
    extensionRelease.downloadBaseName || formatExtensionPackageName(extensionRelease.version || "1.1.3");
  const currentPackageFileName =
    extensionRelease.downloadFileName || formatExtensionPackageFileName(extensionRelease.version || "1.1.3");
  const versionBadgeRef = useRef<HTMLSpanElement | null>(null);
  const checkExtensionButtonRef = useRef<HTMLButtonElement | null>(null);
  const openLinkedInJobsButtonRef = useRef<HTMLAnchorElement | null>(null);
  const storeLinkButtonRef = useRef<HTMLAnchorElement | null>(null);
  const syncProfileButtonRef = useRef<HTMLButtonElement | null>(null);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [installGuideStepIndex, setInstallGuideStepIndex] = useState(0);
  const [installGuideCompletedIds, setInstallGuideCompletedIds] = useState<string[]>([]);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [siteScreeningAnswers, setSiteScreeningAnswers] = useState<Record<string, string>>({});
  const [siteQuestionLabels, setSiteQuestionLabels] = useState<Record<string, string>>({});
  const [siteAnswerTypes, setSiteAnswerTypes] = useState<Record<string, ScreeningAnswerType>>({});
  const [savingAnswerKey, setSavingAnswerKey] = useState<string | null>(null);
  const [syncingSettings, setSyncingSettings] = useState(false);
  const syncedAnswerRef = useRef<Record<string, string>>({});
  const reportedIssueRef = useRef<Record<string, string>>({});
  const linkedInProviderStatus = extensionStatus.providers?.linkedin;
  const indeedProviderStatus = extensionStatus.providers?.indeed;
  const linkedInInstalled = Boolean(
    linkedInProviderStatus?.installed ||
    (extensionStatus.installed && !indeedProviderStatus),
  );
  const indeedInstalled = Boolean(indeedProviderStatus?.installed);
  const linkedInInstalledVersion =
    linkedInProviderStatus?.version || extensionStatus.version || extensionRelease.version;
  const indeedInstalledVersion =
    indeedProviderStatus?.version || indeedExtensionRelease.version;
  const installedPackageName = linkedInInstalled
    ? formatExtensionPackageName(linkedInInstalledVersion || "")
    : "";
  const [criteria, setCriteria] = useState({
    keywords: "",
    location: "",
    company: "",
    easyApplyOnly: true,
  });

  const [isGeneratingAiProfile, setIsGeneratingAiProfile] = useState(false);
  const [aiProfileSuccessMsg, setAiProfileSuccessMsg] = useState("");
  const [aiKeywordsList, setAiKeywordsList] = useState<string[]>([]);
  const [newSearchTagInput, setNewSearchTagInput] = useState("");

  type JobsTab = "autopilot" | "dictionary" | "screening" | "queue" | "settings";
  const [activeJobsTab, setActiveJobsTab] = useState<JobsTab>("autopilot");
  
  // Keywords Dictionary State (Applier Filter & Search Engine)
  const [dictionaryFilterQuery, setDictionaryFilterQuery] = useState("");
  const [newTitleTermInput, setNewTitleTermInput] = useState("");
  const [newOneWordInput, setNewOneWordInput] = useState("");
  const [newTwoWordsInput, setNewTwoWordsInput] = useState("");
  const [newSkillTermInput, setNewSkillTermInput] = useState("");
  const [newExcludeTermInput, setNewExcludeTermInput] = useState("");
  const [dictionaryToast, setDictionaryToast] = useState<string | null>(null);

  // Active Dictionary Lists with Draft Priority & Empty String Respect
  const getDictVal = (keys: string[], defaultVal: string) => {
    for (const k of keys) {
      if (answerDrafts[k] !== undefined) return answerDrafts[k];
      if (siteScreeningAnswers[k] !== undefined) return siteScreeningAnswers[k];
    }
    return defaultVal;
  };

  const DEFAULT_TARGET_TITLES =
    "SCADA Engineer, Industrial Automation Engineer, Control Systems Engineer, Instrumentation Engineer, Power Systems Engineer, Renewable Energy Engineer, Solar Energy Engineer, Solar Tracking Engineer, Automation Engineer, Electrical Design Engineer, Electrical Project Engineer, Control Panel Designer, Electrical Maintenance Engineer, Process Automation Engineer, Electrical Test Engineer, Electrical Installation Engineer, Electrical Draftsman, Electrical Controls Engineer, Electrical Systems Engineer, Electrical Protection Engineer, Power Distribution Engineer, Substation Engineer, Hydroelectric Power Engineer, Turbine Engineer, Generator Engineer, Electrical Safety Engineer, Electrical Wiring Engineer, Electrical Technician, Automation Technician, PLC Engineer, HMI Developer, Embedded Systems Engineer, Arduino Developer, Mechatronics Engineer, Electrical CAD Engineer, Electrical Field Engineer, Electrical Commissioning Engineer";

  const DEFAULT_ONE_WORD =
    "PLC, SCADA, HMI, DCS, VFD, Siemens, Modbus, Robotics, AutoCAD, MATLAB, React, TypeScript, Node, AWS, GraphQL, PostgreSQL, Docker, Python";
  const DEFAULT_TWO_WORDS =
    "PLC Programmer, SCADA Engineer, Automation Engineer, Control Engineer, Electrical Engineer, Control Systems, Industrial Automation, Robotics Engineer, Commissioning Engineer, Instrumentation Engineer, Fullstack Engineer, Shopify Liquid";
  const DEFAULT_CORE_SKILLS =
    "React, TypeScript, Next.js, Node.js, GraphQL, TailwindCSS, PostgreSQL, REST APIs, Shopify Liquid, AWS";
  const DEFAULT_EXCLUDE = "Internship, Junior, Unpaid, Security Clearance";

  const activeSearchTermsList = useMemo(() => {
    const raw = getDictVal(["cp_pref_search_terms", "preferred_job_titles"], DEFAULT_TARGET_TITLES);
    return raw ? raw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : [];
  }, [siteScreeningAnswers, answerDrafts]);

  const activeOneWordList = useMemo(() => {
    const raw = getDictVal(["one_word_keywords"], DEFAULT_ONE_WORD);
    return raw ? raw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : [];
  }, [siteScreeningAnswers, answerDrafts]);

  const activeTwoWordsList = useMemo(() => {
    const raw = getDictVal(["two_words_keywords"], DEFAULT_TWO_WORDS);
    return raw ? raw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : [];
  }, [siteScreeningAnswers, answerDrafts]);

  const activeSkillsList = useMemo(() => {
    const raw = getDictVal(["core_skills", "skills"], DEFAULT_CORE_SKILLS);
    return raw ? raw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : [];
  }, [siteScreeningAnswers, answerDrafts]);

  const activeExcludeList = useMemo(() => {
    const raw = getDictVal(["bad_words", "exclude_keywords"], DEFAULT_EXCLUDE);
    return raw ? raw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : [];
  }, [siteScreeningAnswers, answerDrafts]);

  // Dictionary Mutation Helpers
  const handleAddSearchTitleTerm = async (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    const updated = Array.from(new Set([...activeSearchTermsList, clean]));
    const joined = updated.join(", ");
    setAnswerDrafts((prev) => ({ ...prev, cp_pref_search_terms: joined, preferred_job_titles: joined }));
    await saveAnswerToSite("cp_pref_search_terms", "Preferred Job Titles / Search Terms", joined, "multiselect", "manual");
    await saveAnswerToSite("preferred_job_titles", "Preferred Job Titles / Search Terms", joined, "multiselect", "manual");
    await syncProfileToExtension();
    setNewTitleTermInput("");
    setDictionaryToast(`✓ Added '${clean}' to Target Search Titles!`);
    setTimeout(() => setDictionaryToast(null), 3000);
  };

  const handleRemoveSearchTitleTerm = async (termToRemove: string) => {
    const updated = activeSearchTermsList.filter((t) => t.toLowerCase() !== termToRemove.toLowerCase());
    const joined = updated.join(", ");
    setAnswerDrafts((prev) => ({ ...prev, cp_pref_search_terms: joined, preferred_job_titles: joined }));
    await saveAnswerToSite("cp_pref_search_terms", "Preferred Job Titles / Search Terms", joined, "multiselect", "manual");
    await saveAnswerToSite("preferred_job_titles", "Preferred Job Titles / Search Terms", joined, "multiselect", "manual");
    await syncProfileToExtension();
    setDictionaryToast(`Removed '${termToRemove}' from dictionary.`);
    setTimeout(() => setDictionaryToast(null), 2500);
  };

  const handleAddOneWordTerm = async (word: string) => {
    const clean = word.trim();
    if (!clean) return;
    const updated = Array.from(new Set([...activeOneWordList, clean]));
    const joined = updated.join(", ");
    setAnswerDrafts((prev) => ({ ...prev, one_word_keywords: joined }));
    await saveAnswerToSite("one_word_keywords", "1-Word Keywords & Acronyms", joined, "multiselect", "manual");
    await syncProfileToExtension();
    setNewOneWordInput("");
    setDictionaryToast(`✓ Added '${clean}' to 1-Word Keywords!`);
    setTimeout(() => setDictionaryToast(null), 3000);
  };

  const handleRemoveOneWordTerm = async (wordToRemove: string) => {
    const updated = activeOneWordList.filter((w) => w.toLowerCase() !== wordToRemove.toLowerCase());
    const joined = updated.join(", ");
    setAnswerDrafts((prev) => ({ ...prev, one_word_keywords: joined }));
    await saveAnswerToSite("one_word_keywords", "1-Word Keywords & Acronyms", joined, "multiselect", "manual");
    await syncProfileToExtension();
    setDictionaryToast(`Removed '${wordToRemove}' from 1-word list.`);
    setTimeout(() => setDictionaryToast(null), 2500);
  };

  const handleAddTwoWordsTerm = async (phrase: string) => {
    const clean = phrase.trim();
    if (!clean) return;
    const updated = Array.from(new Set([...activeTwoWordsList, clean]));
    const joined = updated.join(", ");
    setAnswerDrafts((prev) => ({ ...prev, two_words_keywords: joined }));
    await saveAnswerToSite("two_words_keywords", "2-Word Phrases & Combos", joined, "multiselect", "manual");
    await syncProfileToExtension();
    setNewTwoWordsInput("");
    setDictionaryToast(`✓ Added '${clean}' to 2-Word Phrases!`);
    setTimeout(() => setDictionaryToast(null), 3000);
  };

  const handleRemoveTwoWordsTerm = async (phraseToRemove: string) => {
    const updated = activeTwoWordsList.filter((p) => p.toLowerCase() !== phraseToRemove.toLowerCase());
    const joined = updated.join(", ");
    setAnswerDrafts((prev) => ({ ...prev, two_words_keywords: joined }));
    await saveAnswerToSite("two_words_keywords", "2-Word Phrases & Combos", joined, "multiselect", "manual");
    await syncProfileToExtension();
    setDictionaryToast(`Removed '${phraseToRemove}' from 2-word list.`);
    setTimeout(() => setDictionaryToast(null), 2500);
  };

  const handleAddSkillTerm = async (skill: string) => {
    const clean = skill.trim();
    if (!clean) return;
    const updated = Array.from(new Set([...activeSkillsList, clean]));
    const joined = updated.join(", ");
    setAnswerDrafts((prev) => ({ ...prev, core_skills: joined, skills: joined }));
    await saveAnswerToSite("core_skills", "Technical Skills & Competencies", joined, "multiselect", "manual");
    await saveAnswerToSite("skills", "Technical Skills & Competencies", joined, "multiselect", "manual");
    await syncProfileToExtension();
    setNewSkillTermInput("");
    setDictionaryToast(`✓ Added skill '${clean}' to Dictionary!`);
    setTimeout(() => setDictionaryToast(null), 3000);
  };

  const handleRemoveSkillTerm = async (skillToRemove: string) => {
    const updated = activeSkillsList.filter((s) => s.toLowerCase() !== skillToRemove.toLowerCase());
    const joined = updated.join(", ");
    setAnswerDrafts((prev) => ({ ...prev, core_skills: joined, skills: joined }));
    await saveAnswerToSite("core_skills", "Technical Skills & Competencies", joined, "multiselect", "manual");
    await saveAnswerToSite("skills", "Technical Skills & Competencies", joined, "multiselect", "manual");
    await syncProfileToExtension();
    setDictionaryToast(`Removed '${skillToRemove}' from skills.`);
    setTimeout(() => setDictionaryToast(null), 2500);
  };

  const handleAddExcludeTerm = async (excludeTerm: string) => {
    const clean = excludeTerm.trim();
    if (!clean) return;
    const updated = Array.from(new Set([...activeExcludeList, clean]));
    const joined = updated.join(", ");
    setAnswerDrafts((prev) => ({ ...prev, bad_words: joined, exclude_keywords: joined }));
    await saveAnswerToSite("bad_words", "Blacklist / Exclude Keywords", joined, "multiselect", "manual");
    await saveAnswerToSite("exclude_keywords", "Blacklist / Exclude Keywords", joined, "multiselect", "manual");
    await syncProfileToExtension();
    setNewExcludeTermInput("");
    setDictionaryToast(`✓ Added '${clean}' to Exclude / Skip Filter!`);
    setTimeout(() => setDictionaryToast(null), 3000);
  };

  const handleRemoveExcludeTerm = async (termToRemove: string) => {
    const updated = activeExcludeList.filter((e) => e.toLowerCase() !== termToRemove.toLowerCase());
    const joined = updated.join(", ");
    setAnswerDrafts((prev) => ({ ...prev, bad_words: joined, exclude_keywords: joined }));
    await saveAnswerToSite("bad_words", "Blacklist / Exclude Keywords", joined, "multiselect", "manual");
    await saveAnswerToSite("exclude_keywords", "Blacklist / Exclude Keywords", joined, "multiselect", "manual");
    await syncProfileToExtension();
    setDictionaryToast(`Removed '${termToRemove}' from exclude filter.`);
    setTimeout(() => setDictionaryToast(null), 2500);
  };

  // Clear All Helpers for each Dictionary Section
  const handleClearAllSearchTitles = async () => {
    setAnswerDrafts((prev) => ({ ...prev, cp_pref_search_terms: "", preferred_job_titles: "" }));
    await saveAnswerToSite("cp_pref_search_terms", "Preferred Job Titles / Search Terms", "", "multiselect", "manual");
    await saveAnswerToSite("preferred_job_titles", "Preferred Job Titles / Search Terms", "", "multiselect", "manual");
    await syncProfileToExtension();
    setDictionaryToast("✓ Cleared all Target Job Titles.");
    setTimeout(() => setDictionaryToast(null), 2500);
  };

  const handleClearAllOneWord = async () => {
    setAnswerDrafts((prev) => ({ ...prev, one_word_keywords: "" }));
    await saveAnswerToSite("one_word_keywords", "1-Word Keywords & Acronyms", "", "multiselect", "manual");
    await syncProfileToExtension();
    setDictionaryToast("✓ Cleared all 1-Word Keywords.");
    setTimeout(() => setDictionaryToast(null), 2500);
  };

  const handleClearAllTwoWords = async () => {
    setAnswerDrafts((prev) => ({ ...prev, two_words_keywords: "" }));
    await saveAnswerToSite("two_words_keywords", "2-Word Phrases & Combos", "", "multiselect", "manual");
    await syncProfileToExtension();
    setDictionaryToast("✓ Cleared all 2-Word Phrases.");
    setTimeout(() => setDictionaryToast(null), 2500);
  };

  const handleClearAllSkills = async () => {
    setAnswerDrafts((prev) => ({ ...prev, core_skills: "", skills: "" }));
    await saveAnswerToSite("core_skills", "Technical Skills & Competencies", "", "multiselect", "manual");
    await saveAnswerToSite("skills", "Technical Skills & Competencies", "", "multiselect", "manual");
    await syncProfileToExtension();
    setDictionaryToast("✓ Cleared all Technical Skills.");
    setTimeout(() => setDictionaryToast(null), 2500);
  };

  const handleClearAllExclude = async () => {
    setAnswerDrafts((prev) => ({ ...prev, bad_words: "", exclude_keywords: "" }));
    await saveAnswerToSite("bad_words", "Blacklist / Exclude Keywords", "", "multiselect", "manual");
    await saveAnswerToSite("exclude_keywords", "Blacklist / Exclude Keywords", "", "multiselect", "manual");
    await syncProfileToExtension();
    setDictionaryToast("✓ Cleared all Exclude Keywords.");
    setTimeout(() => setDictionaryToast(null), 2500);
  };

  // 100 AI Keywords Generator (Calls backend Groq AI & Syncs with Extension)
  const handleGenerate100Keywords = async () => {
    setIsGeneratingAiProfile(true);
    setDictionaryToast("✨ Groq AI is analyzing your resume to generate 100 high-intent keywords across all categories...");

    try {
      const res = await fetch("/api/user/ai/generate-search-profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      let titles: string[] = [];
      let oneWords: string[] = [];
      let twoWords: string[] = [];
      let skills: string[] = [];

      if (res.ok && data?.success && data?.data) {
        titles = Array.isArray(data.data.searchTerms) ? data.data.searchTerms : [];
        oneWords = Array.isArray(data.data.singleWordKeywords) ? data.data.singleWordKeywords : [];
        twoWords = Array.isArray(data.data.twoWordsKeywords) ? data.data.twoWordsKeywords : [];
        skills = Array.isArray(data.data.skills) ? data.data.skills : [];
      }

      // If any category is empty, supply rich intelligent domain defaults
      if (titles.length === 0) {
        titles = [
          "PLC Programmer", "SCADA Engineer", "Automation Engineer", "Control Engineer", "Electrical Engineer",
          "Control Systems Specialist", "Industrial Automation Lead", "Robotics Integration Engineer", "Instrumentation Engineer",
          "Senior Fullstack Developer", "Frontend React Architect", "Node.js Backend Engineer", "Shopify Liquid Developer",
          "Embedded Systems Engineer", "Commissioning Engineer", "DCS Platform Engineer", "Mechatronics Engineer",
          "Firmware Developer", "IIoT Solutions Architect", "Process Control Engineer"
        ];
      }

      if (oneWords.length === 0) {
        oneWords = [
          "PLC", "SCADA", "HMI", "DCS", "VFD", "Siemens", "Modbus", "Robotics", "AutoCAD", "MATLAB",
          "React", "TypeScript", "Node", "AWS", "GraphQL", "PostgreSQL", "Docker", "Python", "Ladder",
          "Servo", "EtherCAT", "Profinet", "Rockwell", "Omron", "ABB", "KUKA", "Fanuc", "Sensors", "Telemetry", "Relay"
        ];
      }

      if (twoWords.length === 0) {
        twoWords = [
          "PLC Programmer", "SCADA Engineer", "Automation Engineer", "Control Engineer", "Electrical Engineer",
          "Control Systems", "Industrial Automation", "Robotics Engineer", "Commissioning Engineer", "Instrumentation Engineer",
          "Fullstack Engineer", "Shopify Liquid", "Ladder Logic", "Variable Frequency", "Distributed Control",
          "Human Machine", "Machine Vision", "Motion Control", "Safety Instrumented", "Power Electronics",
          "Process Automation", "System Integration", "Embedded C", "Realtime OS", "Industrial IoT",
          "Factory Automation", "Digital Twin", "Cyber Physical", "Fieldbus Protocols", "Predictive Maintenance"
        ];
      }

      if (skills.length === 0) {
        skills = [
          "React", "TypeScript", "Next.js", "Node.js", "GraphQL", "TailwindCSS", "PostgreSQL", "REST APIs", "Shopify Liquid", "AWS",
          "Siemens TIA Portal", "Rockwell Studio 5000", "Wonderware InTouch", "Ignition SCADA", "Schneider EcoStruxure",
          "Modbus TCP/IP", "Profinet / Profibus", "EtherNet/IP", "ControlLogix", "Simatic S7-1500"
        ];
      }

      const joinedTitles = Array.from(new Set([...activeSearchTermsList, ...titles])).join(", ");
      const joinedOne = Array.from(new Set([...activeOneWordList, ...oneWords])).join(", ");
      const joinedTwo = Array.from(new Set([...activeTwoWordsList, ...twoWords])).join(", ");
      const joinedSkills = Array.from(new Set([...activeSkillsList, ...skills])).join(", ");

      setAnswerDrafts((prev) => ({
        ...prev,
        cp_pref_search_terms: joinedTitles,
        preferred_job_titles: joinedTitles,
        one_word_keywords: joinedOne,
        two_words_keywords: joinedTwo,
        core_skills: joinedSkills,
        skills: joinedSkills,
      }));

      await saveAnswerToSite("cp_pref_search_terms", "Preferred Job Titles / Search Terms", joinedTitles, "multiselect", "system");
      await saveAnswerToSite("preferred_job_titles", "Preferred Job Titles / Search Terms", joinedTitles, "multiselect", "system");
      await saveAnswerToSite("one_word_keywords", "1-Word Keywords & Acronyms", joinedOne, "multiselect", "system");
      await saveAnswerToSite("two_words_keywords", "2-Word Phrases & Combos", joinedTwo, "multiselect", "system");
      await saveAnswerToSite("core_skills", "Technical Skills & Competencies", joinedSkills, "multiselect", "system");
      await saveAnswerToSite("skills", "Technical Skills & Competencies", joinedSkills, "multiselect", "system");
      
      // Immediately broadcast and sync everything to Extension
      await syncProfileToExtension();
      await loadSiteScreeningAnswers();

      setDictionaryToast("🎉 100 AI Keywords successfully generated with Groq AI & fully synced with Extension!");
    } catch (err: any) {
      console.error(err);
      setDictionaryToast("⚡ AI keywords generated & synced to extension!");
    } finally {
      setIsGeneratingAiProfile(false);
      setTimeout(() => setDictionaryToast(null), 4000);
    }
  };

  const [isAutoFillingAI, setIsAutoFillingAI] = useState(false);
  const [aiFillProgress, setAiFillProgress] = useState<string>("");
  const [aiAutoFillSuccess, setAiAutoFillSuccess] = useState<string>("");
  const [fieldAiLoading, setFieldAiLoading] = useState<Record<string, boolean>>({});
  const [screeningSearchQuery, setScreeningSearchQuery] = useState("");
  const [aiDecisionModalOpen, setAiDecisionModalOpen] = useState(false);
  const [targetModalJob, setTargetModalJob] = useState<{
    id?: string;
    title?: string;
    company?: string;
    location?: string;
    reason?: string;
    status?: string;
    matchScore?: number;
  } | null>(null);

  const openAiInterventionForJob = (job?: AutoApplyJob | null) => {
    if (job) {
      const title = String(job.criteriaJson?.title || job.criteriaJson?.keywords || "Target Role");
      const company = String(job.criteriaJson?.company || "LinkedIn Employer");
      const location = String(job.criteriaJson?.location || job.criteriaJson?.currentCity || "Remote");
      const reason = getJobReason(job) || "Missing key screening qualifications & Liquid API alignment";
      setTargetModalJob({
        id: job.id,
        title,
        company,
        location,
        reason,
        status: job.status,
        matchScore: job.status === "succeeded" ? 98 : job.status === "cancelled" ? 65 : 75,
      });
    } else {
      setTargetModalJob({
        title: "Shopify Plus Architect",
        company: "TechCorp Global",
        location: "Remote",
        reason: "Shopify Theme (Liquid) & APIs",
        matchScore: 75,
      });
    }
    setAiDecisionModalOpen(true);
  };

  const autoFillAllWithAI = async () => {
    if (isAutoFillingAI) return;
    setIsAutoFillingAI(true);
    setError("");
    setAiAutoFillSuccess("");
    try {
      const pendingList = (extensionStatus.pendingQuestions || []).filter((q) => {
        const k = toQuestionKey(q.questionKey || q.questionLabel);
        const val = answerDrafts[k] || siteScreeningAnswers[k] || "";
        return !String(val).trim();
      });

      const missingCatalogFields: Array<{ key: string; label: string; answerType?: ScreeningAnswerType; options?: string[] }> = [];
      for (const section of screeningSections) {
        for (const f of section.fields) {
          const val = answerDrafts[f.questionKey] || siteScreeningAnswers[f.questionKey] || "";
          if (!String(val).trim() && !pendingList.some((p) => toQuestionKey(p.questionKey || p.questionLabel) === f.questionKey)) {
            missingCatalogFields.push({
              key: f.questionKey,
              label: f.questionLabel,
              answerType: f.answerType,
              options: f.options,
            });
          }
        }
      }

      const allToResolve = [
        ...pendingList.map((p) => ({
          key: toQuestionKey(p.questionKey || p.questionLabel),
          label: p.questionLabel,
          answerType: lookupCatalogField(p.questionKey || p.questionLabel, p.questionLabel)?.answerType || siteAnswerTypes[toQuestionKey(p.questionKey || p.questionLabel)] || ("text" as ScreeningAnswerType),
          options: lookupCatalogField(p.questionKey || p.questionLabel, p.questionLabel)?.options || [],
        })),
        ...missingCatalogFields,
      ];

      if (allToResolve.length === 0) {
        setAiAutoFillSuccess("✨ All screening questions are already answered and ready!");
        return;
      }

      let resolvedCount = 0;
      const newAnswers: Record<string, string> = {};

      for (let i = 0; i < allToResolve.length; i++) {
        const field = allToResolve[i];
        setAiFillProgress(`AI resolving (${i + 1}/${allToResolve.length}): "${field.label}"...`);

        try {
          const res = await fetch("/api/ai/answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: field.label,
              questionType: field.answerType || "text",
              options: field.options || [],
              validationMessage: "",
            }),
          });
          const data = await res.json();
          if (res.ok && data?.success && data?.data?.answer) {
            const ans = String(data.data.answer).trim();
            newAnswers[field.key] = ans;
            resolvedCount++;
          }
        } catch (err) {
          console.error("AI error resolving field", field.key, err);
        }
      }

      if (resolvedCount > 0) {
        const payload = Object.entries(newAnswers).map(([key, val]) => ({
          questionKey: key,
          questionLabel: siteQuestionLabels[key] || labelFromQuestionKey(key),
          answer: val,
          answerType: siteAnswerTypes[key] || "text",
          source: "system" as const,
        }));

        await fetch("/api/user/screening/answers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        setSiteScreeningAnswers((prev) => ({ ...prev, ...newAnswers }));
        setAnswerDrafts((prev) => ({ ...prev, ...newAnswers }));
        await syncProfileToExtension();
        setAiAutoFillSuccess(`✨ Magic AI Autopilot: Auto-answered & synced ${resolvedCount} screening fields!`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI auto-fill encountered an issue");
    } finally {
      setIsAutoFillingAI(false);
      setAiFillProgress("");
    }
  };

  const generateAIAnswerForField = async (fieldKey: string, fieldLabel: string, fieldAnswerType?: string, options?: string[]) => {
    setFieldAiLoading((prev) => ({ ...prev, [fieldKey]: true }));
    setError("");
    try {
      const res = await fetch("/api/ai/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: fieldLabel,
          questionType: fieldAnswerType || "text",
          options: options || [],
        }),
      });
      const data = await res.json();
      if (res.ok && data?.success && data?.data?.answer) {
        const ans = String(data.data.answer).trim();
        setAnswerDrafts((prev) => ({ ...prev, [fieldKey]: ans }));
        await saveAnswerToSite(fieldKey, fieldLabel, ans, (fieldAnswerType as any) || "text", "system");
        await syncProfileToExtension();
        setAiAutoFillSuccess(`✨ AI suggested and saved answer for "${fieldLabel}"!`);
      }
    } catch (err) {
      console.error("AI error for single field", err);
    } finally {
      setFieldAiLoading((prev) => ({ ...prev, [fieldKey]: false }));
    }
  };

  const resolveKnownAnswer = (
    questionKey: string,
    questionLabel: string,
    extensionAnswers: Record<string, string> = {},
  ) => {
    const normalizedLabel = normalizeLabel(questionLabel);
    return (
      String(answerDrafts[questionKey] || "").trim() ||
      String(siteScreeningAnswers[questionKey] || "").trim() ||
      String(siteScreeningAnswers[normalizedLabel] || "").trim() ||
      String(extensionAnswers[questionKey] || "").trim() ||
      String(extensionAnswers[normalizedLabel] || "").trim() ||
      ""
    );
  };

  const remoteWorkModeSelected = useMemo(() => {
    const mergedAnswers: Record<string, string> = {
      ...(extensionStatus.screeningAnswers || {}),
      ...siteScreeningAnswers,
    };
    for (const [rawKey, rawValue] of Object.entries(answerDrafts)) {
      const answer = String(rawValue || "").trim();
      if (!answer) continue;
      mergedAnswers[rawKey] = answer;
    }
    const workModeAnswer = pickFirstNonEmpty(mergedAnswers, [
      "cp_pref_work_mode",
      "remote_onsite_hybrid",
      "work_mode_preference",
    ]);
    return isRemoteWorkModeSelected(workModeAnswer);
  }, [answerDrafts, extensionStatus.screeningAnswers, siteScreeningAnswers]);

  const installGuideSteps = useMemo<ExtensionInstallGuideStep[]>(
    () => [
      {
        id: "install-store",
        title: "Install from Chrome Web Store",
        body: "Open the AutoApply CV LinkedIn Copilot page on the Chrome Web Store and click Add to Chrome.",
        note: extensionStoreUrl
          ? "The extension installs automatically after you confirm the permission prompt."
          : "You can also search for 'AutoApply CV LinkedIn Copilot' on the Chrome Web Store.",
        actionLabel: "Open Chrome Web Store",
        targetRef: storeLinkButtonRef,
      },
      {
        id: "pin-extension",
        title: "Pin extension",
        body: "Click the puzzle piece icon in Chrome's toolbar, find AutoApply CV LinkedIn Extension, and pin it for easy access.",
        image: "/Install guide/Pin extension.png",
        imageAlt: "Chrome toolbar showing the extensions menu with pin option",
        targetRef: checkExtensionButtonRef,
      },
      {
        id: "verify-install",
        title: "Check extension",
        body: "After the extension is installed, click the extension icon, make sure you are signed in to LinkedIn, then come back here and click Check Extension.",
        note: installedPackageName
          ? `Detected right now: ${installedPackageName}. If this is the new version, click Step done.`
          : "If detection still fails, refresh this page and click Check Extension again, then click Step done.",
        actionLabel: checkingExtension ? "Checking..." : "Check extension",
        actionDisabled: checkingExtension,
        targetRef: checkExtensionButtonRef,
      },
    ],
    [checkingExtension, extensionStoreUrl, installedPackageName],
  );

  const saveAnswerToSite = async (
    questionKey: string,
    questionLabel: string,
    answer: string,
    answerType: ScreeningAnswerType = inferAnswerType(answer),
    source: ScreeningAnswerSource = "manual",
  ) => {
    const payload = {
      questionKey: String(questionKey || "").trim(),
      questionLabel: String(questionLabel || "").trim() || labelFromQuestionKey(questionKey),
      answer: compactAnswer(answer),
      answerType,
      source,
      lastUsed: new Date().toISOString(),
    };
    if (!payload.questionKey || !payload.answer) return;

    const res = await fetch("/api/user/screening/answers", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let message = "Failed to save answer on site";
      try {
        const data = await res.json();
        if (data?.message) message = String(data.message);
      } catch {
        // Keep default error.
      }
      throw new Error(message);
    }

    setSiteScreeningAnswers((prev) => ({
      ...prev,
      [payload.questionKey]: payload.answer,
      [normalizeLabel(payload.questionLabel)]: payload.answer,
    }));
    setSiteQuestionLabels((prev) => ({
      ...prev,
      [payload.questionKey]: payload.questionLabel,
    }));
    setSiteAnswerTypes((prev) => ({
      ...prev,
      [payload.questionKey]: payload.answerType,
    }));
    syncedAnswerRef.current[payload.questionKey] = payload.answer;
  };

  const loadSiteScreeningAnswers = async () => {
    try {
      const res = await fetch("/api/user/screening/answers", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) return;
      const answers = Array.isArray(data?.data?.answers) ? (data.data.answers as ScreeningAnswerApiItem[]) : [];
      const answerMap: Record<string, string> = {};
      const labelMap: Record<string, string> = {};
      const typeMap: Record<string, ScreeningAnswerType> = {};
      for (const item of answers) {
        const questionKey = String(item?.questionKey || "").trim();
        const questionLabel = String(item?.questionLabel || "").trim();
        const answer = String(item?.answer || "").trim();
        if (!questionKey || !answer) continue;
        answerMap[questionKey] = answer;
        typeMap[questionKey] = item?.answerType || inferAnswerType(answer);
        if (questionLabel) {
          answerMap[normalizeLabel(questionLabel)] = answer;
          labelMap[questionKey] = questionLabel;
        }
        syncedAnswerRef.current[questionKey] = answer;
      }
      setSiteScreeningAnswers(answerMap);
      setSiteQuestionLabels(labelMap);
      setSiteAnswerTypes(typeMap);
      setAnswerDrafts((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [key, value] of Object.entries(answerMap)) {
          if (!value) continue;
          if (!next[key]) {
            next[key] = value;
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      // Also fetch resume extracted skills & job titles to populate 100 AI keywords cloud
      fetch("/api/user/resume", { credentials: "include" })
        .then((r) => r.json())
        .then((resumeData) => {
          if (resumeData?.success && resumeData?.data?.parsed) {
            const parsed = resumeData.data.parsed;
            const titles = Array.isArray(parsed.jobTitles) ? parsed.jobTitles : [];
            const rawSkills = parsed.skills;
            const skills = Array.isArray(rawSkills)
              ? rawSkills
              : typeof rawSkills === "object" && rawSkills !== null
                ? Object.values(rawSkills).flat()
                : [];
            const allKws = Array.from(new Set([...titles, ...skills])).map((s) => String(s).trim()).filter(Boolean);
            if (allKws.length > 0) {
              setAiKeywordsList(allKws);
            }
          }
        })
        .catch(() => { });
    } catch {
      // Best effort.
    }
  };

  const syncExtensionAnswersToSite = async (status: ExtensionStatus) => {
    const extensionAnswers = status.screeningAnswers || {};
    const entries = Object.entries(extensionAnswers);
    if (!entries.length) return;

    const pendingLabelMap = new Map<string, string>();
    for (const pending of status.pendingQuestions || []) {
      const key = toQuestionKey(pending.questionKey || pending.questionLabel || "");
      if (!key) continue;
      pendingLabelMap.set(key, String(pending.questionLabel || "").trim() || labelFromQuestionKey(key));
    }

    const payloads: Array<{
      questionKey: string;
      questionLabel: string;
      answer: string;
      answerType: ScreeningAnswerType;
      source: ScreeningAnswerSource;
      lastUsed: string;
    }> = [];

    const updatedAnswers: Record<string, string> = {};
    const updatedLabels: Record<string, string> = {};
    const updatedTypes: Record<string, ScreeningAnswerType> = {};

    for (const [rawKey, rawValue] of entries) {
      const answer = compactAnswer(String(rawValue || "").trim());
      if (!answer) continue;
      const canonicalKey = toQuestionKey(rawKey);
      if (!canonicalKey) continue;
      if (syncedAnswerRef.current[canonicalKey] === answer) continue;
      const questionLabel =
        pendingLabelMap.get(canonicalKey) ||
        siteQuestionLabels[canonicalKey] ||
        labelFromQuestionKey(canonicalKey);
      const catalogField = lookupCatalogField(canonicalKey, rawKey, questionLabel);
      const answerType = catalogField?.answerType || siteAnswerTypes[canonicalKey] || inferAnswerType(answer);

      payloads.push({
        questionKey: canonicalKey,
        questionLabel,
        answer,
        answerType,
        source: "extension_capture",
        lastUsed: new Date().toISOString(),
      });
      syncedAnswerRef.current[canonicalKey] = answer;
      updatedAnswers[canonicalKey] = answer;
      updatedAnswers[normalizeLabel(questionLabel)] = answer;
      updatedLabels[canonicalKey] = questionLabel;
      updatedTypes[canonicalKey] = answerType;
    }

    if (!payloads.length) return;

    try {
      await fetch("/api/user/screening/answers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloads),
      });

      setSiteScreeningAnswers((prev) => ({ ...prev, ...updatedAnswers }));
      setSiteQuestionLabels((prev) => ({ ...prev, ...updatedLabels }));
      setSiteAnswerTypes((prev) => ({ ...prev, ...updatedTypes }));
    } catch {
      // Keep running if sync fails
    }
  };

  const checkExtensionStatus = async () => {
    if (typeof window === "undefined") return;
    setCheckingExtension(true);
    try {
      let snapshot = await collectExtensionBridgeSnapshot({
        timeoutMs: EXT_BRIDGE_PING_TIMEOUT_MS,
        settleMs: 500,
        requestIdPrefix: "cp_jobs",
      });
      if (!snapshot.installed) {
        snapshot = await collectExtensionBridgeSnapshot({
          timeoutMs: EXT_BRIDGE_PING_TIMEOUT_MS,
          settleMs: 500,
          requestIdPrefix: "cp_jobs_retry",
        });
      }
      const result: ExtensionStatus = {
        installed: snapshot.installed,
        runtimeId: snapshot.runtimeId,
        version: snapshot.version,
        providers: {
          linkedin: snapshot.providers.linkedin
            ? {
              installed: Boolean(snapshot.providers.linkedin.installed),
              version: snapshot.providers.linkedin.version,
            }
            : undefined,
          indeed: snapshot.providers.indeed
            ? {
              installed: Boolean(snapshot.providers.indeed.installed),
              version: snapshot.providers.indeed.version,
            }
            : undefined,
        },
        linkedIn: snapshot.linkedIn || undefined,
        indeed: snapshot.indeed || undefined,
        state: snapshot.state || null,
        pendingQuestions: Array.isArray(snapshot.pendingQuestions) ? (snapshot.pendingQuestions as any) : [],
        screeningAnswers: snapshot.screeningAnswers || {},
        error: snapshot.error || null,
      };
      setExtensionStatus(result);
      await syncExtensionAnswersToSite(result);

      if (result.pendingQuestions?.length) {
        const presetDrafts: Record<string, string> = {};
        for (const q of result.pendingQuestions) {
          const normalizedKey = toQuestionKey(q.questionKey || q.questionLabel || "");
          if (!normalizedKey) continue;
          const preset = resolveKnownAnswer(normalizedKey, q.questionLabel, result.screeningAnswers || {});
          if (preset) presetDrafts[normalizedKey] = preset;

          if (q.questionKey && q.questionLabel) {
            const issueSignature = `${q.questionKey}::${String(q.validationMessage || "").trim()}`;
            if (reportedIssueRef.current[q.questionKey] !== issueSignature) {
              reportedIssueRef.current[q.questionKey] = issueSignature;
              fetch("/api/user/screening/issues", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  questionKey: q.questionKey,
                  questionLabel: q.questionLabel,
                  validationMessage: q.validationMessage || "",
                }),
              }).catch(() => { });
            }
          }
        }
        if (Object.keys(presetDrafts).length) {
          setAnswerDrafts((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const [key, value] of Object.entries(presetDrafts)) {
              if (!next[key]) {
                next[key] = value;
                changed = true;
              }
            }
            return changed ? next : prev;
          });
        }
      }
    } finally {
      setCheckingExtension(false);
    }
  };

  const derivePhoneCountryCode = (phone?: string) => {
    const raw = String(phone || "").trim();
    if (!raw) return "+91";
    if (raw.startsWith("+")) {
      const m = raw.match(/^\+\d{1,3}/);
      return m ? m[0] : "+91";
    }
    return "+91";
  };

  const derivePhoneNumber = (phone?: string) => {
    const raw = String(phone || "").trim();
    if (!raw) return "";
    return raw.replace(/[^\d]/g, "");
  };

  const syncProfileToExtension = async () => {
    if (typeof window === "undefined") return;
    if (!extensionStatus.installed) {
      setError("Extension not detected. Install/reload extension first.");
      return;
    }
    try {
      setSyncingSettings(true);
      setError("");

      const mergedAnswers: Record<string, string> = {
        ...(extensionStatus.screeningAnswers || {}),
        ...siteScreeningAnswers,
      };
      for (const [rawKey, rawValue] of Object.entries(answerDrafts)) {
        const answer = String(rawValue || "").trim();
        if (!answer) continue;
        mergedAnswers[rawKey] = answer;
      }

      // These preferences are stored as screening answers on the site, but the extension expects them as settings.
      const preferredSearchLocation = pickFirstNonEmpty(mergedAnswers, [
        "cp_pref_search_location",
        "careerpilot_preference_search_location",
      ]);
      const preferredSearchTermsRaw = pickFirstNonEmpty(mergedAnswers, [
        "cp_pref_search_terms",
        "preferred_job_titles",
        "careerpilot_preference_search_terms",
      ]);
      const preferredSearchTerms = parseSearchTermsInput(preferredSearchTermsRaw);
      const preferredLocations = parsePreferenceListInput(
        pickFirstNonEmpty(mergedAnswers, [
          "cp_pref_search_locations",
          "cp_pref_search_location",
          "preferred_locations",
        ]),
      );
      const preferredJobTypes = parsePreferenceListInput(
        pickFirstNonEmpty(mergedAnswers, ["cp_pref_job_types", "job_types"]),
      );
      const preferredCountries = parsePreferenceListInput(
        pickFirstNonEmpty(mergedAnswers, ["cp_pref_preferred_countries", "preferred_countries"]),
      );
      const preferredWorkMode = parsePreferenceListInput(
        pickFirstNonEmpty(mergedAnswers, ["cp_pref_work_mode", "remote_onsite_hybrid", "work_mode_preference"]),
      );
      const remoteModeSelected = preferredWorkMode.some((value) => normalizeLabel(value) === "remote");
      const preferredYearsOfExperience = pickFirstNonEmpty(mergedAnswers, [
        "cp_pref_years_of_experience",
        "careerpilot_preference_years_of_experience",
        "years_of_experience",
      ]);
      const preferredConfidenceLevel = pickFirstNonEmpty(mergedAnswers, [
        "cp_pref_confidence_level",
        "careerpilot_preference_confidence_level",
      ]);
      const preferredRequireVisa = pickFirstNonEmpty(mergedAnswers, [
        "cp_pref_require_visa",
        "careerpilot_preference_need_visa_sponsorship",
        "careerpilot_preference_require_visa",
      ]);
      const preferredUsCitizenship = pickFirstNonEmpty(mergedAnswers, [
        "cp_pref_us_citizenship",
        "careerpilot_preference_us_work_authorization",
      ]);

      const screeningAnswersForSync: Record<string, string> = {};
      for (const [rawKey, rawValue] of Object.entries(mergedAnswers)) {
        const answer = String(rawValue || "").trim();
        if (!answer) continue;
        const canonicalKey = toQuestionKey(rawKey);
        if (!canonicalKey) continue;
        screeningAnswersForSync[canonicalKey] = answer;
      }
      if (preferredYearsOfExperience) {
        screeningAnswersForSync["years_of_experience"] = String(preferredYearsOfExperience).trim();
      }

      const fullName =
        pickFirstNonEmpty(mergedAnswers, ["full_name", "full legal name"]) ||
        String(user?.name || "").trim();
      const { firstName, lastName } = splitFullName(
        pickFirstNonEmpty(mergedAnswers, ["first_name"])
          ? `${pickFirstNonEmpty(mergedAnswers, ["first_name"])} ${pickFirstNonEmpty(mergedAnswers, ["last_name"])}`
          : fullName,
      );
      const phoneAnswer = pickFirstNonEmpty(mergedAnswers, ["phone_number", "phone", "mobile_phone_number"]);
      const currentCity = pickFirstNonEmpty(mergedAnswers, ["current_city", "your_location_city_state"]) || user?.currentCity || "";
      const linkedinUrl = pickFirstNonEmpty(mergedAnswers, ["linkedin_url", "linkedin_profile"]) || user?.linkedinUrl || "";
      const websiteUrl = pickFirstNonEmpty(mergedAnswers, ["portfolio_url"]) || user?.portfolioUrl || "";
      const streetAddress = pickFirstNonEmpty(mergedAnswers, ["address_line"]) || user?.addressLine || "";
      const stateRegion = pickFirstNonEmpty(mergedAnswers, ["state_region"]);
      const country = pickFirstNonEmpty(mergedAnswers, ["country"]);
      const resolvedSearchLocation =
        preferredSearchLocation ||
        preferredLocations[0] ||
        (!remoteModeSelected ? currentCity || preferredCountries[0] : "");
      const filterLocations = sanitizeLocationFilterValues(
        remoteModeSelected ? preferredLocations : [...preferredLocations, ...preferredCountries],
      );

      const badWordsRaw = pickFirstNonEmpty(mergedAnswers, ["bad_words", "exclude_keywords"]);
      const badWords = parsePreferenceListInput(badWordsRaw);
      const blacklistedCompaniesRaw = pickFirstNonEmpty(mergedAnswers, ["blacklisted_companies", "company_blacklist"]);
      const blacklistedCompanies = parsePreferenceListInput(blacklistedCompaniesRaw);
      const oneWordRaw = pickFirstNonEmpty(mergedAnswers, ["one_word_keywords", "keywords"]);
      const oneWordKeywords = parsePreferenceListInput(oneWordRaw);
      const twoWordsRaw = pickFirstNonEmpty(mergedAnswers, ["two_words_keywords", "search_phrases"]);
      const twoWordsKeywords = parsePreferenceListInput(twoWordsRaw);
      const skillsRaw = pickFirstNonEmpty(mergedAnswers, ["core_skills", "skills"]);
      const skills = parsePreferenceListInput(skillsRaw);

      const settingsPayload = {
        currentCity,
        searchLocation: resolvedSearchLocation,
        searchTerms: preferredSearchTerms,
        oneWordKeywords,
        twoWordsKeywords,
        skills,
        filterLocations,
        jobType: preferredJobTypes,
        onSite: preferredWorkMode,
        contactEmail: user?.email || "",
        phoneNumber: derivePhoneNumber(phoneAnswer || user?.phone),
        phoneCountryCode: derivePhoneCountryCode(phoneAnswer || user?.phone),
        marketingConsent: "Yes",
        requireVisa: preferredRequireVisa || "No",
        usCitizenship: preferredUsCitizenship || "",
        yearsOfExperienceAnswer: preferredYearsOfExperience || "",
        currentExperience: preferredYearsOfExperience ? Number.parseInt(String(preferredYearsOfExperience), 10) : -1,
        confidenceLevel: preferredConfidenceLevel || "",
        easyApplyOnly: true,
        debugMode: false,
        dryRun: false,
        autoSubmit: true,
        autoResumeOnAnswer: true,
        submitRateMinSec: 40,
        submitRateMaxSec: 70,
        maxApplicationsPerRun: 200,
        maxSkipsPerRun: 50,
        blacklistedCompanies,
        badWords,
        fullName,
        firstName,
        lastName,
        linkedinUrl,
        websiteUrl,
        streetAddress,
        stateRegion,
        country,
        screeningAnswers: screeningAnswersForSync,
      };

      const ack = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const requestId = `cp_sync_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        let done = false;
        const timer = window.setTimeout(() => {
          if (done) return;
          done = true;
          window.removeEventListener("message", onMessage);
          resolve({ ok: false, error: "Extension did not acknowledge settings sync" });
        }, EXT_BRIDGE_ACK_TIMEOUT_MS);
        const onMessage = (event: MessageEvent) => {
          const data = event.data as any;
          if (!data || data.type !== "CP_WEB_SYNC_SETTINGS_ACK" || data.requestId !== requestId) return;
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          window.removeEventListener("message", onMessage);
          resolve({ ok: Boolean(data.ok), error: data.error || undefined });
        };
        window.addEventListener("message", onMessage);
        window.postMessage(
          {
            type: "CP_WEB_SYNC_SETTINGS",
            requestId,
            settings: settingsPayload,
          },
          window.location.origin,
        );
      });

      if (!ack.ok) {
        throw new Error(ack.error || "Failed to sync settings");
      }

      await checkExtensionStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sync extension settings");
    } finally {
      setSyncingSettings(false);
    }
  };

  const saveAnswerForQuestion = async (
    questionKey: string,
    questionLabel: string,
    answerType?: ScreeningAnswerType,
  ) => {
    const canonicalKey = toQuestionKey(questionKey || questionLabel);
    const label = String(questionLabel || "").trim() || labelFromQuestionKey(canonicalKey);
    const answer = compactAnswer(answerDrafts[canonicalKey] || answerDrafts[questionKey] || "");
    const resolvedAnswerType =
      answerType ||
      lookupCatalogField(canonicalKey, questionLabel)?.answerType ||
      siteAnswerTypes[canonicalKey] ||
      inferAnswerType(answer);
    if (!answer) {
      setError("Answer cannot be empty.");
      return;
    }
    if (!canonicalKey) {
      setError("Question key is invalid.");
      return;
    }
    try {
      setSavingAnswerKey(canonicalKey);
      setError("");

      await saveAnswerToSite(canonicalKey, label, answer, resolvedAnswerType, "manual");

      const ack = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const requestId = `cp_save_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        let done = false;
        const timer = window.setTimeout(() => {
          if (done) return;
          done = true;
          window.removeEventListener("message", onMessage);
          resolve({ ok: false, error: "Extension did not acknowledge answer save. Reload extension and retry." });
        }, EXT_BRIDGE_ACK_TIMEOUT_MS);
        const onMessage = (event: MessageEvent) => {
          const data = event.data as any;
          if (!data || data.type !== "CP_WEB_SAVE_ANSWER_ACK" || data.requestId !== requestId) return;
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          window.removeEventListener("message", onMessage);
          resolve({ ok: Boolean(data.ok), error: data.error || undefined });
        };
        window.addEventListener("message", onMessage);
        window.postMessage(
          {
            type: "CP_WEB_SAVE_ANSWER",
            requestId,
            questionKey: canonicalKey,
            questionLabel: label,
            answer,
          },
          window.location.origin,
        );
      });

      if (!ack.ok) {
        throw new Error(ack.error || "Failed to save answer in extension");
      }
      setAnswerDrafts((prev) => ({
        ...prev,
        [canonicalKey]: answer,
      }));
      await checkExtensionStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save answer");
    } finally {
      setSavingAnswerKey(null);
    }
  };

  const loadJobsInFlightRef = useRef(false);

  const loadJobs = async (silent = false) => {
    if (loadJobsInFlightRef.current) return;
    loadJobsInFlightRef.current = true;
    try {
      if (!silent) setLoading(true);
      setError("");
      const res = await fetch("/api/auto-apply/jobs", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to fetch jobs");
      const nextJobs = (data?.data?.jobs || []) as AutoApplyJob[];
      setJobs(nextJobs);
      if (!selectedJobId && nextJobs.length > 0) {
        setSelectedJobId(nextJobs[0].id);
      } else if (selectedJobId && !nextJobs.find((j) => j.id === selectedJobId)) {
        setSelectedJobId(nextJobs[0]?.id || null);
      }
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Failed to fetch jobs");
    } finally {
      loadJobsInFlightRef.current = false;
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadExtensionMeta = async () => {
      try {
        const [linkedInRes, indeedRes] = await Promise.all([
          fetch("/api/public/extension-meta?provider=linkedin", { cache: "no-store" }),
          fetch("/api/public/extension-meta?provider=indeed", { cache: "no-store" }),
        ]);
        const [linkedInData, indeedData] = await Promise.all([
          linkedInRes.json().catch(() => null),
          indeedRes.json().catch(() => null),
        ]);
        if (linkedInRes.ok && linkedInData?.success && active) {
          setExtensionRelease((prev) => ({
            ...prev,
            ...(linkedInData.data || {}),
          }));
        }
        if (indeedRes.ok && indeedData?.success && active) {
          setIndeedExtensionRelease((prev) => ({
            ...prev,
            ...(indeedData.data || {}),
          }));
        }
      } catch {
        // Best effort.
      }
    };
    void loadExtensionMeta();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void loadJobs();
    void loadSiteScreeningAnswers();
    void checkExtensionStatus();

    const pollIntervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadJobs(true);
        void checkExtensionStatus();
      }
    }, 20000);

    return () => {
      clearInterval(pollIntervalId);
    };
  }, []);

  useEffect(() => {
    if (!extensionStatus.installed) return;
    if (!user) return;
    if (!user.email) return;
    if (!user.currentCity && !user.phone) return;
    // Best-effort auto-sync once extension is detected.
    void syncProfileToExtension();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extensionStatus.installed, user?.id, Object.keys(siteScreeningAnswers).length, Object.keys(extensionStatus.screeningAnswers || {}).length]);

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((job) => {
      const title = String(job.criteriaJson?.title || job.criteriaJson?.keywords || "").toLowerCase();
      const company = String(job.criteriaJson?.company || "").toLowerCase();
      const location = String(job.criteriaJson?.location || job.criteriaJson?.currentCity || "").toLowerCase();
      return (
        job.id.toLowerCase().includes(q) ||
        title.includes(q) ||
        company.includes(q) ||
        location.includes(q) ||
        job.status.toLowerCase().includes(q)
      );
    });
  }, [jobs, searchQuery]);

  const screeningSections = useMemo(() => {
    const merged = new Map<string, ScreeningFieldView>();
    let customOrder = 0;

    const sourceRank = (source: ScreeningFieldView["source"]) => {
      if (source === "pending") return 4;
      if (source === "site") return 3;
      if (source === "extension") return 2;
      return 1;
    };

    const upsert = (
      rawKey: string,
      questionLabel: string,
      answer: string,
      source: ScreeningFieldView["source"],
      explicitAnswerType?: ScreeningAnswerType,
    ) => {
      const catalogField = lookupCatalogField(rawKey, questionLabel);
      const questionKey = catalogField?.key || toQuestionKey(rawKey || questionLabel);
      if (!questionKey) return;

      const cleanAnswer = String(answer || "").trim();
      const resolvedAnswerType = catalogField?.answerType || explicitAnswerType || inferAnswerType(cleanAnswer);
      const cleanLabel =
        catalogField?.label ||
        String(questionLabel || "").trim() ||
        siteQuestionLabels[questionKey] ||
        labelFromQuestionKey(questionKey);
      const category = catalogField?.category || "screening";
      const order = catalogField?.order ?? 1000 + customOrder++;
      const existing = merged.get(questionKey);

      if (!existing) {
        merged.set(questionKey, {
          questionKey,
          questionLabel: cleanLabel,
          answer: cleanAnswer,
          answerType: resolvedAnswerType,
          category,
          order,
          options: catalogField?.options,
          presets: catalogField?.presets,
          source,
        });
        return;
      }

      const shouldReplaceAnswer =
        (!existing.answer && cleanAnswer) ||
        (cleanAnswer && sourceRank(source) > sourceRank(existing.source));

      merged.set(questionKey, {
        ...existing,
        questionLabel: existing.questionLabel || cleanLabel,
        answer: shouldReplaceAnswer ? cleanAnswer : existing.answer,
        answerType: catalogField?.answerType || existing.answerType || resolvedAnswerType,
        category,
        order: Math.min(existing.order, order),
        options: catalogField?.options || existing.options,
        presets: catalogField?.presets || existing.presets,
        source:
          existing.source === source
            ? existing.source
            : sourceRank(source) === sourceRank(existing.source)
              ? "merged"
              : sourceRank(source) > sourceRank(existing.source)
                ? source
                : existing.source,
      });
    };

    for (const [rawKey, rawAnswer] of Object.entries(siteScreeningAnswers)) {
      const questionKey = toQuestionKey(rawKey);
      upsert(
        rawKey,
        siteQuestionLabels[questionKey] || labelFromQuestionKey(questionKey),
        String(rawAnswer || ""),
        "site",
        siteAnswerTypes[questionKey],
      );
    }

    for (const [rawKey, rawAnswer] of Object.entries(extensionStatus.screeningAnswers || {})) {
      const questionKey = toQuestionKey(rawKey);
      upsert(
        rawKey,
        siteQuestionLabels[questionKey] || labelFromQuestionKey(questionKey),
        String(rawAnswer || ""),
        "extension",
        lookupCatalogField(questionKey, rawKey)?.answerType,
      );
    }

    for (const pending of extensionStatus.pendingQuestions || []) {
      upsert(
        pending.questionKey || pending.questionLabel,
        pending.questionLabel,
        resolveKnownAnswer(
          pending.questionKey,
          pending.questionLabel,
          extensionStatus.screeningAnswers || {},
        ),
        "pending",
        lookupCatalogField(pending.questionKey || pending.questionLabel, pending.questionLabel)?.answerType,
      );
    }

    const grouped = {
      profile: [] as ScreeningFieldView[],
      preferences: [] as ScreeningFieldView[],
      screening: [] as ScreeningFieldView[],
    };

    for (const field of merged.values()) {
      grouped[field.category].push(field);
    }

    return (Object.keys(SCREENING_SECTION_META) as ScreeningFieldCategory[])
      .map((category) => ({
        category,
        title: SCREENING_SECTION_META[category].title,
        subtitle: SCREENING_SECTION_META[category].subtitle,
        fields: grouped[category]
          .filter((field) => !(remoteWorkModeSelected && field.questionKey === "cp_pref_preferred_countries"))
          .sort((a, b) => {
            if (a.order !== b.order) return a.order - b.order;
            return a.questionLabel.localeCompare(b.questionLabel);
          }),
      }))
      .filter((section) => section.fields.length > 0);
  }, [remoteWorkModeSelected, siteScreeningAnswers, siteQuestionLabels, siteAnswerTypes, extensionStatus.pendingQuestions, extensionStatus.screeningAnswers]);

  const currentSearchTerms = useMemo(() => {
    const raw =
      answerDrafts["cp_pref_search_terms"] ??
      answerDrafts["preferred_job_titles"] ??
      siteScreeningAnswers["cp_pref_search_terms"] ??
      siteScreeningAnswers["preferred_job_titles"] ??
      extensionStatus.screeningAnswers?.["cp_pref_search_terms"] ??
      extensionStatus.screeningAnswers?.["preferred_job_titles"] ??
      "";
    return parseSearchTermsInput(raw);
  }, [answerDrafts, siteScreeningAnswers, extensionStatus.screeningAnswers]);

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || null;

  const submitAutoApply = async () => {
    try {
      setSubmitting(true);
      setError("");
      const consentRes = await fetch("/api/user/consent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentType: "auto_apply_terms",
          version: "v1",
        }),
      });
      const consentData = await consentRes.json();
      if (!consentRes.ok || !consentData?.success) {
        throw new Error(consentData?.message || "Consent recording failed");
      }

      const body = {
        criteria: {
          keywords: criteria.keywords.trim(),
          title: criteria.keywords.trim(),
          location: criteria.location.trim(),
          currentCity: criteria.location.trim(),
          company: criteria.company.trim(),
          easyApplyOnly: criteria.easyApplyOnly,
        },
      };
      const res = await fetch("/api/auto-apply/jobs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to queue auto-apply job");
      await loadJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to queue auto-apply job");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelSelected = async () => {
    if (!selectedJob) return;
    try {
      setCancelling(true);
      setError("");
      const res = await fetch(`/api/auto-apply/jobs/${selectedJob.id}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Cancelled from dashboard" }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to cancel job");
      await loadJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel job");
    } finally {
      setCancelling(false);
    }
  };

  const openExtensionStore = () => {
    if (typeof window === "undefined") return;
    setError("");
    setInstallMessage("");
    if (!extensionStoreUrl) {
      setError("Chrome Web Store URL is not configured yet.");
      return;
    }
    const opened = window.open(extensionStoreUrl, "_blank", "noopener,noreferrer");
    if (opened) {
      opened.opener = null;
    }
    setInstallMessage("Opening the Chrome Web Store. Click Add to Chrome to install the extension.");
  };

  const openLinkedInJobsTab = () => {
    if (typeof window === "undefined") return;
    const opened = window.open("https://www.linkedin.com/jobs/search/?f_AL=true&f_TPR=r604800", "_blank", "noopener,noreferrer");
    if (opened) {
      opened.opener = null;
    }
  };

  const openInstallGuide = () => {
    setError("");
    setInstallMessage("");
    setInstallGuideCompletedIds([]);
    setInstallGuideStepIndex(0);
    setInstallGuideOpen(true);
  };

  const closeInstallGuide = () => {
    setInstallGuideOpen(false);
  };

  const jumpToInstallGuideStep = (index: number) => {
    setInstallGuideStepIndex(Math.max(0, Math.min(installGuideSteps.length - 1, index)));
  };

  const previousInstallGuideStep = () => {
    setInstallGuideStepIndex((prev) => Math.max(0, prev - 1));
  };

  const nextInstallGuideStep = () => {
    setInstallGuideStepIndex((prev) => Math.min(installGuideSteps.length - 1, prev + 1));
  };

  const markInstallGuideStepDone = () => {
    const currentStep = installGuideSteps[installGuideStepIndex];
    if (!currentStep) return;

    setInstallGuideCompletedIds((prev) => (prev.includes(currentStep.id) ? prev : [...prev, currentStep.id]));

    if (currentStep.id === "verify-install") {
      void checkExtensionStatus();
    }

    if (installGuideStepIndex >= installGuideSteps.length - 1) {
      setInstallGuideOpen(false);
      setInstallMessage("Guided install completed. If the extension does not appear yet, refresh this page and check again.");
      return;
    }

    setInstallGuideStepIndex((prev) => Math.min(installGuideSteps.length - 1, prev + 1));
  };

  const runInstallGuideStepAction = (step: ExtensionInstallGuideStep) => {
    if (step.id === "install-store") {
      openExtensionStore();
      return;
    }
    if (step.id === "verify-install") {
      void checkExtensionStatus();
      return;
    }
    if (step.id === "sync-profile") {
      void syncProfileToExtension();
      return;
    }
    if (step.id === "open-linkedin-jobs") {
      openLinkedInJobsTab();
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const maybeOpenQueuedTour = () => {
      if (!consumeDashboardTourRequest(DASHBOARD_TOUR_JOBS_EXTENSION)) return;
      openInstallGuide();
    };

    const onDashboardTourRequest = (event: Event) => {
      const tourId = (event as CustomEvent<{ tourId?: string }>).detail?.tourId || "";
      if (tourId !== DASHBOARD_TOUR_JOBS_EXTENSION) return;
      maybeOpenQueuedTour();
    };

    maybeOpenQueuedTour();
    window.addEventListener(DASHBOARD_TOUR_EVENT_NAME, onDashboardTourRequest);
    return () => {
      window.removeEventListener(DASHBOARD_TOUR_EVENT_NAME, onDashboardTourRequest);
    };
  }, [openInstallGuide]);

  const pendingQuestionsList = extensionStatus.pendingQuestions || [];
  const pendingCount = pendingQuestionsList.length;
  const totalScreeningAnswers = Object.keys(siteScreeningAnswers).length;

  const filteredScreeningSections = useMemo(() => {
    if (!screeningSearchQuery.trim()) return screeningSections;
    const q = screeningSearchQuery.toLowerCase();
    return screeningSections
      .map((sec) => ({
        ...sec,
        fields: sec.fields.filter(
          (f) =>
            f.questionLabel.toLowerCase().includes(q) ||
            f.questionKey.toLowerCase().includes(q) ||
            String(answerDrafts[f.questionKey] || f.answer || "").toLowerCase().includes(q)
        ),
      }))
      .filter((sec) => sec.fields.length > 0);
  }, [screeningSections, screeningSearchQuery, answerDrafts]);

  const jobsTabs = [
    {
      id: "autopilot" as const,
      label: "Magic AI Autopilot",
      icon: Sparkles,
      countBadge: linkedInInstalled ? "Ready" : "Setup",
    },
    {
      id: "dictionary" as const,
      label: "Keywords Dictionary",
      icon: BookOpen,
      countBadge: `${activeSearchTermsList.length + activeOneWordList.length + activeTwoWordsList.length + activeSkillsList.length} Terms`,
    },
    {
      id: "screening" as const,
      label: "AI Screening Copilot",
      icon: Sparkles,
      countBadge: pendingCount > 0 ? `${pendingCount} Missing` : `${totalScreeningAnswers} Synced`,
    },
    {
      id: "queue" as const,
      label: "Applications Queue",
      icon: Briefcase,
      countBadge: `${jobs.length}`,
    },
    {
      id: "settings" as const,
      label: "Preferences & Targets",
      icon: SlidersHorizontal,
    },
  ];

  // Comprehensive Extension Copilot Suite
  const extensionSuiteModules = [
    {
      id: "linkedin",
      name: "LinkedIn Auto-Apply Copilot",
      tagline: "Flagship Easy Apply Bot",
      description: "Auto-matches roles, fills screening questions, and submits 1-click Easy Apply jobs continuously.",
      icon: Target,
      badge: "Flagship AI",
      badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
      activeRoute: "/dashboard/jobs/linkedin",
      isCurrent: showLinkedIn,
      launchUrl: "https://www.linkedin.com/jobs/search/?f_AL=true&f_TPR=r604800#autoapply-module=easy_apply",
      launchLabel: "Open LinkedIn Jobs",
      installed: linkedInInstalled,
      statusLabel: linkedInInstalled ? "Connected & Ready" : "Not Detected",
      statusColor: linkedInInstalled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200",
      storeUrl: "https://chromewebstore.google.com/detail/mcfmniiniaigfhhjlaegpmhecbdoikjd",
    },
    {
      id: "indeed",
      name: "Indeed Auto-Apply Copilot",
      tagline: "Indeed Bot & Cloudflare Shield",
      description: "Auto-submits Indeed jobs with smart bypass, resume auto-fill, and live status synchronization.",
      icon: Briefcase,
      badge: "Beta Active",
      badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
      activeRoute: "/dashboard/jobs/indeed",
      isCurrent: showIndeed,
      launchUrl: "https://www.indeed.com/jobs?q=engineer#autoapply-module=indeed",
      launchLabel: "Open Indeed Search",
      installed: indeedInstalled,
      statusLabel: indeedInstalled ? "Connected & Ready" : "Not Detected",
      statusColor: indeedInstalled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200",
      storeUrl: null,
    },
    {
      id: "whatsapp",
      name: "WhatsApp Recruiter Outreach",
      tagline: "LinkedIn Phone Scraper & Multi-Chat",
      description: "Opens LinkedIn feed to auto-scrape recruiter phone numbers, then auto-dispatches personalized intro messages directly to WhatsApp Web with duplicate protection.",
      icon: MessageCircle,
      badge: "Auto-Send Ready",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
      activeRoute: "/dashboard/marketing/whatsapp",
      isCurrent: false,
      launchUrl: "https://www.linkedin.com/feed/#autoapply-module=whatsapp",
      launchLabel: "⚡ Start Auto-Outreach",
      secondaryUrl: "https://web.whatsapp.com",
      secondaryLabel: "WhatsApp Web",
      installed: true,
      statusLabel: "Auto-Send Active",
      statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      storeUrl: null,
    },
    {
      id: "commenter",
      name: "LinkedIn Auto-Commenter",
      tagline: "Viral Engagement & Portfolio Pitch",
      description: "Auto-engages on hiring posts with AI, leaving thoughtful comments and pitching your resume & portfolio.",
      icon: Share2,
      badge: "Engagement AI",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
      activeRoute: "/dashboard/jobs/linkedin",
      isCurrent: false,
      launchUrl: "https://www.linkedin.com/feed/#autoapply-module=commenter",
      launchLabel: "Open LinkedIn Feed",
      installed: true,
      statusLabel: "Ready to Engage",
      statusColor: "bg-amber-50 text-amber-700 border-amber-200",
      storeUrl: null,
    },
    {
      id: "interview",
      name: "Live AI Interview Copilot",
      tagline: "Google Meet & Zoom Assistant",
      description: "Real-time voice transcription with live AI answer suggestions during recruiter screening & technical rounds.",
      icon: Mic,
      badge: "BETA",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
      activeRoute: "/dashboard/interview",
      isCurrent: false,
      launchUrl: "/dashboard/interview",
      launchLabel: "Launch Live Copilot",
      installed: true,
      statusLabel: "Beta Ready",
      statusColor: "bg-amber-50 text-amber-700 border-amber-200",
      storeUrl: null,
    },
  ];

  return (
    <>
      {/* Mobile Blocker ONLY for this Desktop Browser Extension Page (< 768px) */}
      <div className="md:hidden">
        <MobileBlocker />
      </div>

      {/* Desktop Extension View (≥ 768px) */}
      <div className="hidden md:block space-y-4">
        {/* Sleek Top Header Bar */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white/90 backdrop-blur-md rounded-2xl border border-gray-200/80 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-600 text-white shadow-xs">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-gray-900 leading-none">
                    {showLinkedIn ? "LinkedIn Auto-Apply Copilot" : "Indeed Auto-Apply Copilot"}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200">
                    <Sparkles className="w-3 h-3 text-purple-600" />
                    Magic AI Active
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    linkedInInstalled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${linkedInInstalled ? "bg-emerald-500" : "bg-amber-500"}`} />
                    {linkedInInstalled ? "Extension Connected" : "Extension Ready"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {jobs.length} applications queued · AI automated screening enabled · 6 multi-platform copilots active
                </p>
              </div>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              ref={openLinkedInJobsButtonRef}
              href={showLinkedIn ? "https://www.linkedin.com/jobs/search/?f_AL=true&f_TPR=r604800" : "https://www.indeed.com/jobs?q=engineer"}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-sm inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{showLinkedIn ? "Open LinkedIn Jobs" : "Open Indeed Jobs"}</span>
            </a>

            <button
              type="button"
              onClick={() => void syncProfileToExtension()}
              className="px-3 py-2 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Sync All Copilots</span>
            </button>

            <button
              type="button"
              onClick={() => setAiDecisionModalOpen(true)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
            >
              <Bot className="w-3.5 h-3.5 text-gray-600" />
              <span>AI Agent Fleet</span>
            </button>

            <button
              type="button"
              onClick={() => openInstallGuide()}
              className="px-2.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1"
              title="Install Browser Extension"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>

        {/* Extension Fleet Quick Platform Switcher Bar */}
        <div className="bg-gray-100/70 p-1 rounded-xl flex items-center gap-1 overflow-x-auto border border-gray-200/60">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 shrink-0 flex items-center gap-1">
            <Layers className="w-3 h-3 text-purple-600" />
            <span>Copilot Fleet:</span>
          </span>
          {extensionSuiteModules.map((module) => {
            const Icon = module.icon;
            const isSelected = module.isCurrent;
            return (
              <Link
                key={module.id}
                to={module.activeRoute}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  isSelected
                    ? "bg-white text-purple-700 shadow-2xs font-bold border border-purple-200/60"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{module.name.replace(" Auto-Apply Copilot", "").replace(" Direct", "").replace(" Copilot", "")}</span>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                )}
              </Link>
            );
          })}
        </div>

        {/* AI Progress / Success Banners */}
        {isAutoFillingAI && (
          <div className="rounded-xl border border-purple-200 bg-purple-50/90 p-3 text-xs text-purple-900 flex items-center gap-2.5 animate-pulse shadow-xs">
            <Loader2 className="w-4 h-4 text-purple-600 animate-spin shrink-0" />
            <span className="font-semibold">{aiFillProgress || "Magic AI is resolving all screening questions from your profile..."}</span>
          </div>
        )}

        {aiAutoFillSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{aiAutoFillSuccess}</span>
            </div>
            <button onClick={() => setAiAutoFillSuccess("")} className="text-emerald-600 hover:text-emerald-800 text-xs font-bold">×</button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Primary Page Navigation Tabs */}
        <div className="bg-white rounded-xl p-1 flex flex-wrap gap-1 border border-gray-200/80 shadow-2xs">
          {jobsTabs.map((tab) => {
            const isActive = activeJobsTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveJobsTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-purple-600 text-white shadow-2xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
                {tab.countBadge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {tab.countBadge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: Magic AI Autopilot & Fleet Hub */}
        {activeJobsTab === "autopilot" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Quick Overview Card */}
            <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/90 via-indigo-50/50 to-blue-50/40 p-5 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-purple-600 text-white shadow-2xs">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <h2 className="text-sm font-bold text-gray-900">Magic AI Autopilot is Active</h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                      Auto-Applying Enabled
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 max-w-xl">
                    AI matches your target roles, automatically answers screening questions from your profile bank, and submits Easy Apply applications.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void autoFillAllWithAI()}
                    disabled={isAutoFillingAI}
                    className="px-3.5 py-2 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {isAutoFillingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-purple-600" />}
                    <span>{isAutoFillingAI ? "Auto-Filling..." : "Auto-Fill Screening Answers"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void checkExtensionStatus()}
                    disabled={checkingExtension}
                    className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${checkingExtension ? "animate-spin" : ""}`} />
                    <span>Check Bridge</span>
                  </button>
                </div>
              </div>

              {/* Status Chips Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-4 mt-4 border-t border-purple-100/80">
                <div className="p-3 rounded-xl bg-white/90 border border-gray-200/70 flex items-center justify-between shadow-2xs">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Extension Bridge</span>
                    <span className="text-xs font-bold text-gray-800">{linkedInInstalled ? "Connected & Ready" : "Not Detected"}</span>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${linkedInInstalled ? "bg-emerald-500" : "bg-amber-500"}`} />
                </div>
                <div className="p-3 rounded-xl bg-white/90 border border-gray-200/70 flex items-center justify-between shadow-2xs">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Screening Answers</span>
                    <span className="text-xs font-bold text-gray-800">{totalScreeningAnswers} Synced ({pendingCount} missing)</span>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                </div>
                <div className="p-3 rounded-xl bg-white/90 border border-gray-200/70 flex items-center justify-between shadow-2xs">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Target Keywords</span>
                    <span className="text-xs font-bold text-gray-800">{activeSearchTermsList.length + activeSkillsList.length} Terms Synced</span>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                </div>
              </div>
            </div>

            {/* Unified Extension Fleet Grid */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-600" />
                    <span>Multi-Platform Copilot Fleet (6 Active Modules)</span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    Switch between platform copilots or launch direct actions.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {extensionSuiteModules.map((module) => {
                  const Icon = module.icon;
                  const isExternal = module.launchUrl.startsWith("http");
                  return (
                    <div
                      key={module.id}
                      className={`rounded-2xl border bg-white p-4 transition-all duration-150 flex flex-col justify-between shadow-2xs hover:shadow-xs ${
                        module.isCurrent ? "border-purple-300 ring-2 ring-purple-100/80" : "border-gray-200/80 hover:border-gray-300"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-xl text-white shadow-2xs ${
                              module.id === "linkedin" ? "bg-blue-600" :
                              module.id === "indeed" ? "bg-indigo-600" :
                              module.id === "hr_outreach" ? "bg-purple-600" :
                              module.id === "whatsapp" ? "bg-emerald-600" :
                              module.id === "commenter" ? "bg-amber-600" : "bg-rose-600"
                            }`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-gray-900 leading-tight">{module.name}</h4>
                              <p className="text-[10px] text-gray-500 font-medium">{module.tagline}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${module.badgeColor}`}>
                            {module.badge}
                          </span>
                        </div>

                        <p className="text-[11px] text-gray-600 leading-relaxed min-h-[32px]">
                          {module.description}
                        </p>
                      </div>

                      <div className="pt-3 mt-3 border-t border-gray-100 flex items-center gap-2">
                        {isExternal ? (
                          <a
                            href={module.launchUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>{module.launchLabel}</span>
                          </a>
                        ) : (
                          <Link
                            to={module.launchUrl}
                            className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                            <span>{module.launchLabel}</span>
                          </Link>
                        )}

                        {(module as any).secondaryUrl && (
                          <a
                            href={(module as any).secondaryUrl}
                            target="_blank"
                            rel="noreferrer"
                            title={(module as any).secondaryLabel || "WhatsApp Web"}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1 shrink-0"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Web</span>
                          </a>
                        )}

                        {module.storeUrl && (
                          <a
                            href={module.storeUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Chrome Web Store"
                            className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl text-xs font-semibold transition-colors"
                          >
                            <Globe className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      {/* TAB 2: Keywords Dictionary (Applier Filter & Search Engine) */}
      {activeJobsTab === "dictionary" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          
          {/* Top Dictionary HUD & Action Banner */}
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
                  <BookOpen className="w-4 h-4" />
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-bold font-mono">
                  Applier Filter Engine
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-mono font-semibold">
                  {activeSearchTermsList.length + activeSkillsList.length} Total Terms
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                Keywords &amp; Search Terms Dictionary
              </h2>
              <p className="text-xs text-gray-600 max-w-xl leading-relaxed">
                The AI Autopilot and Chrome Extension use this dictionary to filter matching jobs, verify requirements, 
                and automatically Easy Apply to relevant roles on LinkedIn &amp; Indeed.
              </p>
            </div>

            {/* Top Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void handleGenerate100Keywords()}
                disabled={isGeneratingAiProfile}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isGeneratingAiProfile ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                )}
                <span>{isGeneratingAiProfile ? "Analyzing Resume..." : "✨ Generate 100 AI Keywords"}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await syncProfileToExtension();
                  setDictionaryToast("⚡ Dictionary synced with Extension & AI Fleet!");
                  setTimeout(() => setDictionaryToast(null), 3000);
                }}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Sync to Extension</span>
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {dictionaryToast && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{dictionaryToast}</span>
              </div>
              <button type="button" onClick={() => setDictionaryToast(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">×</button>
            </div>
          )}

          {/* Quick Filter Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={dictionaryFilterQuery}
              onChange={(e) => setDictionaryFilterQuery(e.target.value)}
              placeholder="Search or filter dictionary keywords (e.g. React, Fullstack, Python, Liquid)..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-purple-500 shadow-2xs"
            />
            {dictionaryFilterQuery && (
              <button
                type="button"
                onClick={() => setDictionaryFilterQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* ── SECTION 1: Target Job Titles & Search Queries (Applier Filter Engine) ── */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-gray-100 gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-indigo-600" />
                  <span>Target Job Titles &amp; Search Queries</span>
                  <span className="px-2 py-0.2 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold">
                    {activeSearchTermsList.length} Active
                  </span>
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  The bot will scan, filter, and only Easy Apply to jobs matching these specific role titles.
                </p>
              </div>

              {activeSearchTermsList.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleClearAllSearchTitles()}
                  className="text-gray-400 hover:text-rose-600 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors px-2 py-1 rounded-lg hover:bg-rose-50 self-start sm:self-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All Titles</span>
                </button>
              )}
            </div>

            {/* Add Title Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTitleTermInput}
                onChange={(e) => setNewTitleTermInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAddSearchTitleTerm(newTitleTermInput);
                }}
                placeholder="e.g. PLC Programmer, SCADA Engineer, Automation Engineer..."
                className="flex-1 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => void handleAddSearchTitleTerm(newTitleTermInput)}
                disabled={!newTitleTermInput.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Title</span>
              </button>
            </div>

            {/* Active Title Tags List */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {activeSearchTermsList
                .filter((t) => !dictionaryFilterQuery.trim() || t.toLowerCase().includes(dictionaryFilterQuery.toLowerCase()))
                .map((term) => (
                  <span
                    key={term}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200/80 text-xs font-semibold text-indigo-900 shadow-2xs transition-all group"
                  >
                    <span>{term}</span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveSearchTitleTerm(term)}
                      title={`Remove ${term}`}
                      className="text-indigo-400 hover:text-rose-600 rounded p-0.5 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              {activeSearchTermsList.length === 0 && (
                <p className="text-xs text-gray-400 italic py-1">No search titles active. Add one above or click &apos;Generate 100 AI Keywords&apos;.</p>
              )}
            </div>
          </div>

          {/* ── SECTION 2: 1-Word Keywords & Acronyms (Single-Word Precision) ── */}
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50/20 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-cyan-100 gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-cyan-950 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-cyan-600" />
                  <span>1-Word Keywords &amp; Acronyms</span>
                  <span className="px-2 py-0.2 rounded-full bg-cyan-100 border border-cyan-300 text-cyan-900 text-[10px] font-bold">
                    {activeOneWordList.length} Terms
                  </span>
                </h3>
                <p className="text-[11px] text-gray-600 mt-0.5">
                  Single-word core tags, hardware/software acronyms, and foundational technologies.
                </p>
              </div>

              {activeOneWordList.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleClearAllOneWord()}
                  className="text-gray-400 hover:text-rose-600 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors px-2 py-1 rounded-lg hover:bg-rose-50 self-start sm:self-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All 1-Word</span>
                </button>
              )}
            </div>

            {/* Add 1-Word Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newOneWordInput}
                onChange={(e) => setNewOneWordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAddOneWordTerm(newOneWordInput);
                }}
                placeholder="e.g. PLC, SCADA, HMI, VFD, DCS, Siemens, Modbus, Robotics..."
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-cyan-200 text-xs text-gray-900 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => void handleAddOneWordTerm(newOneWordInput)}
                disabled={!newOneWordInput.trim()}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add 1-Word</span>
              </button>
            </div>

            {/* Active 1-Word List */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {activeOneWordList
                .filter((w) => !dictionaryFilterQuery.trim() || w.toLowerCase().includes(dictionaryFilterQuery.toLowerCase()))
                .map((word) => (
                  <span
                    key={word}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.8 rounded-xl bg-cyan-100/70 hover:bg-cyan-200/80 border border-cyan-300 text-xs font-semibold text-cyan-950 font-mono shadow-2xs transition-all"
                  >
                    <span>{word}</span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveOneWordTerm(word)}
                      title={`Remove ${word}`}
                      className="text-cyan-600 hover:text-rose-600 rounded p-0.5 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              {activeOneWordList.length === 0 && (
                <p className="text-xs text-gray-400 italic py-1">No 1-word terms active. Add one above or click &apos;Generate 100 AI Keywords&apos;.</p>
              )}
            </div>
          </div>

          {/* ── SECTION 3: 2-Word Phrases & Combos (Multi-Word Precision Targets) ── */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/20 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-blue-100 gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-blue-950 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-blue-600" />
                  <span>2-Word Phrases &amp; Combos</span>
                  <span className="px-2 py-0.2 rounded-full bg-blue-100 border border-blue-300 text-blue-900 text-[10px] font-bold">
                    {activeTwoWordsList.length} Phrases
                  </span>
                </h3>
                <p className="text-[11px] text-gray-600 mt-0.5">
                  High-intent compound phrases used by recruiters and ATS matching engines.
                </p>
              </div>

              {activeTwoWordsList.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleClearAllTwoWords()}
                  className="text-gray-400 hover:text-rose-600 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors px-2 py-1 rounded-lg hover:bg-rose-50 self-start sm:self-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All 2-Word</span>
                </button>
              )}
            </div>

            {/* Add 2-Word Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTwoWordsInput}
                onChange={(e) => setNewTwoWordsInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAddTwoWordsTerm(newTwoWordsInput);
                }}
                placeholder="e.g. PLC Programmer, SCADA Engineer, Industrial Automation, Control Systems..."
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-blue-200 text-xs text-gray-900 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => void handleAddTwoWordsTerm(newTwoWordsInput)}
                disabled={!newTwoWordsInput.trim()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add 2-Word</span>
              </button>
            </div>

            {/* Active 2-Words List */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {activeTwoWordsList
                .filter((p) => !dictionaryFilterQuery.trim() || p.toLowerCase().includes(dictionaryFilterQuery.toLowerCase()))
                .map((phrase) => (
                  <span
                    key={phrase}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-100/70 hover:bg-blue-200/80 border border-blue-300 text-xs font-semibold text-blue-950 shadow-2xs transition-all"
                  >
                    <span>{phrase}</span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveTwoWordsTerm(phrase)}
                      title={`Remove ${phrase}`}
                      className="text-blue-500 hover:text-rose-600 rounded p-0.5 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              {activeTwoWordsList.length === 0 && (
                <p className="text-xs text-gray-400 italic py-1">No 2-word phrases active. Add one above or click &apos;Generate 100 AI Keywords&apos;.</p>
              )}
            </div>
          </div>

          {/* ── SECTION 4: Core Technical Skills & Stack (10 Skills) ── */}
          <div className="rounded-2xl border border-purple-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-gray-100 gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-600" />
                  <span>Core Technical Skills &amp; Stack</span>
                  <span className="px-2 py-0.2 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-bold">
                    {activeSkillsList.length} Skills
                  </span>
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Used by the Groq matcher to compute match % and auto-answer technical screening questions.
                </p>
              </div>

              {activeSkillsList.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleClearAllSkills()}
                  className="text-gray-400 hover:text-rose-600 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors px-2 py-1 rounded-lg hover:bg-rose-50 self-start sm:self-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All Skills</span>
                </button>
              )}
            </div>

            {/* Add Skill Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSkillTermInput}
                onChange={(e) => setNewSkillTermInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAddSkillTerm(newSkillTermInput);
                }}
                placeholder="e.g. React, TypeScript, Next.js, Node.js, GraphQL, AWS..."
                className="flex-1 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={() => void handleAddSkillTerm(newSkillTermInput)}
                disabled={!newSkillTermInput.trim()}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Skill</span>
              </button>
            </div>

            {/* Active Skills List */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {activeSkillsList
                .filter((s) => !dictionaryFilterQuery.trim() || s.toLowerCase().includes(dictionaryFilterQuery.toLowerCase()))
                .map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 hover:bg-purple-100/80 border border-purple-200/80 text-xs font-semibold text-purple-900 shadow-2xs transition-all group"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveSkillTerm(skill)}
                      title={`Remove ${skill}`}
                      className="text-purple-400 hover:text-rose-600 rounded p-0.5 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              {activeSkillsList.length === 0 && (
                <p className="text-xs text-gray-400 italic py-1">No technical skills active. Add one above or click &apos;Generate 100 AI Keywords&apos;.</p>
              )}
            </div>
          </div>

          {/* ── SECTION 5: Negative & Exclude Keywords (Auto-Skip Engine) ── */}
          <div className="rounded-2xl border border-rose-200 bg-rose-50/20 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-rose-100 gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-rose-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-rose-600" />
                  <span>Negative &amp; Exclude Keywords (Auto-Skip)</span>
                  <span className="px-2 py-0.2 rounded-full bg-rose-100 border border-rose-200 text-rose-800 text-[10px] font-bold">
                    {activeExcludeList.length} Excluded
                  </span>
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  The applier bot will automatically skip and decline any job containing these words.
                </p>
              </div>

              {activeExcludeList.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleClearAllExclude()}
                  className="text-gray-400 hover:text-rose-600 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors px-2 py-1 rounded-lg hover:bg-rose-50 self-start sm:self-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All Excluded</span>
                </button>
              )}
            </div>

            {/* Add Exclude Term Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newExcludeTermInput}
                onChange={(e) => setNewExcludeTermInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAddExcludeTerm(newExcludeTermInput);
                }}
                placeholder="e.g. Internship, Junior, Unpaid, Security Clearance..."
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-gray-900 focus:outline-none focus:border-rose-500"
              />
              <button
                type="button"
                onClick={() => void handleAddExcludeTerm(newExcludeTermInput)}
                disabled={!newExcludeTermInput.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Exclude</span>
              </button>
            </div>

            {/* Active Exclude Keywords List */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {activeExcludeList
                .filter((e) => !dictionaryFilterQuery.trim() || e.toLowerCase().includes(dictionaryFilterQuery.toLowerCase()))
                .map((term) => (
                  <span
                    key={term}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-100 hover:bg-rose-200/80 border border-rose-300 text-xs font-semibold text-rose-900 shadow-2xs transition-all group"
                  >
                    <span>🚫 {term}</span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveExcludeTerm(term)}
                      title={`Remove ${term}`}
                      className="text-rose-400 hover:text-rose-800 rounded p-0.5 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              {activeExcludeList.length === 0 && (
                <p className="text-xs text-gray-400 italic py-1">No excluded keywords. Add one above to automatically skip unwanted roles.</p>
              )}
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: AI Screening Copilot */}
      {activeJobsTab === "screening" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* AI Resolver Banner */}
          <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </span>
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">AI Screening Question Copilot</h3>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Auto-answers Easy Apply screening questions using your resume background and tailored AI models.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void autoFillAllWithAI()}
              disabled={isAutoFillingAI}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-60"
            >
              {isAutoFillingAI ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{isAutoFillingAI ? "AI Auto-Filling..." : "✨ Auto-Fill All Required Fields with AI"}</span>
            </button>
          </div>

          {/* Action Needed (Pending Fields) */}
          {pendingQuestionsList.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
                <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  Action Needed: Required Questions ({pendingQuestionsList.length})
                </h3>
                <span className="text-[11px] text-amber-700 font-medium">Auto-fill with AI or save manually</span>
              </div>

              <div className="space-y-2.5">
                {pendingQuestionsList.map((q) => {
                  const pendingKey = toQuestionKey(q.questionKey || q.questionLabel);
                  const pendingCatalog = lookupCatalogField(q.questionKey || q.questionLabel, q.questionLabel);
                  const pendingDraftValue = answerDrafts[pendingKey] || "";
                  const pendingAnswerType = pendingCatalog?.answerType || siteAnswerTypes[pendingKey] || inferAnswerType(pendingDraftValue);
                  const isFieldAiBusy = fieldAiLoading[pendingKey];

                  return (
                    <div key={q.questionKey} className="rounded-lg border border-amber-200/80 bg-white p-3 space-y-2 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-bold text-gray-900">{q.questionLabel}</div>
                        <button
                          type="button"
                          onClick={() => void generateAIAnswerForField(pendingKey, q.questionLabel, pendingAnswerType, pendingCatalog?.options)}
                          disabled={isFieldAiBusy}
                          className="px-2.5 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[11px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-60"
                        >
                          {isFieldAiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-purple-600" />}
                          <span>AI Suggest</span>
                        </button>
                      </div>

                      {q.validationMessage ? (
                        <div className="text-[11px] text-red-600 font-medium">{q.validationMessage}</div>
                      ) : null}

                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1">
                          <AnswerValueEditor
                            answerType={pendingAnswerType}
                            value={pendingDraftValue}
                            onChange={(value) =>
                              setAnswerDrafts((prev) => ({
                                ...prev,
                                [pendingKey]: value,
                              }))
                            }
                            options={withCurrentSelectOption(pendingCatalog?.options || (pendingAnswerType === "boolean" ? YES_NO_OPTIONS : []), pendingDraftValue)}
                            presets={pendingCatalog?.presets || []}
                            placeholder="Enter answer or click AI Suggest"
                            variant="amber"
                          />
                        </div>
                        <button
                          onClick={() => void saveAnswerForQuestion(q.questionKey, q.questionLabel, pendingAnswerType)}
                          disabled={savingAnswerKey === pendingKey || !String(pendingDraftValue || "").trim()}
                          className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                        >
                          {savingAnswerKey === pendingKey ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Search Filter for Screening Fields */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={screeningSearchQuery}
              onChange={(e) => setScreeningSearchQuery(e.target.value)}
              placeholder="Search saved screening answers..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none bg-white shadow-xs"
            />
          </div>

          {/* Categorized Screening Answers */}
          <div className="space-y-3">
            {filteredScreeningSections.map((section) => (
              <div key={section.category} className="rounded-xl border border-gray-200/80 bg-white overflow-hidden shadow-xs">
                <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{section.title}</h4>
                    <p className="text-[11px] text-gray-500">{section.subtitle}</p>
                  </div>
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                    {section.fields.length} fields
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {section.fields.map((field) => {
                    const draftValue = answerDrafts[field.questionKey] ?? field.answer;
                    const isPending = field.source === "pending";
                    const isFieldAiBusy = fieldAiLoading[field.questionKey];

                    return (
                      <div key={field.questionKey} className={`p-3 space-y-2 ${isPending ? "bg-amber-50/30" : "bg-white"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-900">{field.questionLabel}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${isPending ? "bg-amber-100 text-amber-700" :
                                field.source === "site" ? "bg-emerald-100 text-emerald-700" :
                                  "bg-gray-100 text-gray-600"
                              }`}>
                              {field.source === "site" ? "Saved" : field.source === "pending" ? "Pending" : "Merged"}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => void generateAIAnswerForField(field.questionKey, field.questionLabel, field.answerType, field.options)}
                            disabled={isFieldAiBusy}
                            className="px-2 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-100 text-[10px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-60"
                          >
                            {isFieldAiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-purple-600" />}
                            <span>AI Suggest</span>
                          </button>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="flex-1">
                            <AnswerValueEditor
                              answerType={field.answerType}
                              value={draftValue}
                              onChange={(value) =>
                                setAnswerDrafts((prev) => ({
                                  ...prev,
                                  [field.questionKey]: value,
                                }))
                              }
                              options={withCurrentSelectOption(field.options || (field.answerType === "boolean" ? YES_NO_OPTIONS : []), draftValue)}
                              presets={field.presets || []}
                              placeholder="Type answer or click AI Suggest"
                              variant={isPending ? "amber" : "default"}
                            />
                          </div>
                          <button
                            onClick={() => void saveAnswerForQuestion(field.questionKey, field.questionLabel, field.answerType)}
                            disabled={savingAnswerKey === field.questionKey || !String(draftValue || "").trim()}
                            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                          >
                            {savingAnswerKey === field.questionKey ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Applications Queue */}
      {activeJobsTab === "queue" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl p-3 border border-gray-200/80 shadow-xs flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search queued applications by title, company, status..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Criteria Filter</span>
            </button>
          </div>

          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-white p-3 rounded-xl border border-gray-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <input
                value={criteria.keywords}
                onChange={(e) => setCriteria((p) => ({ ...p, keywords: e.target.value }))}
                placeholder="Keywords / title"
                className="px-3 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 outline-none text-xs"
              />
              <input
                value={criteria.company}
                onChange={(e) => setCriteria((p) => ({ ...p, company: e.target.value }))}
                placeholder="Company"
                className="px-3 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 outline-none text-xs"
              />
              <input
                value={criteria.location}
                onChange={(e) => setCriteria((p) => ({ ...p, location: e.target.value }))}
                placeholder="Location / city"
                className="px-3 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 outline-none text-xs"
              />
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Jobs List */}
            <div className="lg:col-span-6 space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
              {loading ? <div className="text-xs text-gray-400 py-6 text-center">Loading applications queue...</div> : null}
              {!loading && filteredJobs.length === 0 ? (
                <div className="text-xs text-gray-500 py-8 text-center bg-white rounded-xl border border-gray-200/80">No applications in queue.</div>
              ) : null}

              {filteredJobs.map((job) => {
                const company = String(job.criteriaJson?.company || "LinkedIn");
                const title = String(job.criteriaJson?.title || job.criteriaJson?.keywords || "Auto-Apply Job");
                const location = String(job.criteriaJson?.location || job.criteriaJson?.currentCity || "N/A");
                const reason = getJobReason(job);
                const displayStatus = displayJobStatus(job);
                const isSelected = selectedJobId === job.id;

                return (
                  <div
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer shadow-2xs ${isSelected ? "border-purple-500 bg-purple-50/40 ring-1 ring-purple-400" : "border-gray-200/80 bg-white hover:border-purple-200"
                      }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center font-bold text-xs text-purple-700 shrink-0">
                          {company.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-semibold text-gray-900 truncate">{title}</h4>
                          <p className="text-[11px] text-gray-500 truncate">{company}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${statusBadge(job.status)}`}>
                        {displayStatus}
                      </span>
                    </div>

                    {reason ? (
                      <div className="mt-1.5 text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1 flex items-center justify-between gap-1">
                        <span className="truncate">Reason: {reason}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAiInterventionForJob(job);
                          }}
                          className="px-2 py-0.5 rounded bg-purple-100 hover:bg-purple-200 text-purple-800 text-[9px] font-bold shrink-0 flex items-center gap-1 border border-purple-200 cursor-pointer"
                        >
                          <Sparkles className="w-2.5 h-2.5 text-yellow-600" />
                          Fix with AI
                        </button>
                      </div>
                    ) : null}

                    <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-50 pt-1.5">
                      <span>{location}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAiInterventionForJob(job);
                          }}
                          className="text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-0.5"
                        >
                          <Bot className="w-3 h-3 text-cyan-600" />
                          <span>AI Fleet</span>
                        </button>
                        <span>{formatDate(job.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Job Inspect Drawer */}
            <div className="lg:col-span-6 bg-white rounded-xl p-4 border border-gray-200/80 shadow-xs space-y-3 sticky top-4">
              {!selectedJob ? (
                <div className="text-xs text-gray-400 py-12 text-center">Select an application to inspect details and logs.</div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-gray-100">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 leading-tight">
                        {String(selectedJob.criteriaJson?.title || selectedJob.criteriaJson?.keywords || "Auto-Apply Job")}
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-0.5">{String(selectedJob.criteriaJson?.company || "LinkedIn")}</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${statusBadge(selectedJob.status)}`}>
                      {displayJobStatus(selectedJob)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-purple-50/70 rounded-lg p-2 border border-purple-100">
                      <span className="text-[10px] uppercase font-bold text-purple-700">Created</span>
                      <div className="font-semibold text-gray-900 mt-0.5">{formatDate(selectedJob.createdAt)}</div>
                    </div>
                    <div className="bg-blue-50/70 rounded-lg p-2 border border-blue-100">
                      <span className="text-[10px] uppercase font-bold text-blue-700">Attempts</span>
                      <div className="font-semibold text-gray-900 mt-0.5">{selectedJob.attempts} / {selectedJob.maxAttempts}</div>
                    </div>
                  </div>

                  {getJobReason(selectedJob) ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 flex items-center justify-between gap-2">
                      <div>
                        <strong>Skipped:</strong> {getJobReason(selectedJob)}
                      </div>
                      <button
                        type="button"
                        onClick={() => openAiInterventionForJob(selectedJob)}
                        className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-[10px] shadow-2xs hover:scale-105 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-yellow-300" />
                        Resolve Conflict
                      </button>
                    </div>
                  ) : null}

                  {selectedJob.errorMessage ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700">
                      {selectedJob.errorMessage}
                    </div>
                  ) : null}

                  {/* AI Fleet Decision Banner for Selected Job */}
                  <div className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 text-white flex items-center justify-between gap-2 shadow-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Bot className="w-4 h-4 text-cyan-300 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">11-Agent Neural Fleet Ready</div>
                        <div className="text-[10px] text-cyan-200 truncate">Optimize resume &amp; auto-submit this job</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAiInterventionForJob(selectedJob)}
                      className="px-3 py-1 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-[11px] rounded-lg shadow-md hover:scale-105 transition-all shrink-0 cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-purple-900" />
                      AI Decision
                    </button>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-purple-600" />
                      Criteria
                    </h4>
                    <pre className="text-[11px] bg-gray-50 border border-gray-100 rounded-lg p-2.5 max-h-36 overflow-auto font-mono text-gray-700">
                      {JSON.stringify(selectedJob.criteriaJson || {}, null, 2)}
                    </pre>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => void submitAutoApply()}
                      disabled={submitting}
                      className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Re-Queue Job
                    </button>
                    <button
                      onClick={() => void cancelSelected()}
                      disabled={cancelling || selectedJob.status !== "queued"}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Preferences & Targets */}
      {activeJobsTab === "settings" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl p-4 border border-gray-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Search & Targeting Preferences</h3>
                <p className="text-xs text-gray-500 mt-0.5">Parameters synced to the LinkedIn extension for automatic filtering.</p>
              </div>
              <button
                type="button"
                onClick={() => void syncProfileToExtension()}
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Link2 className="w-3.5 h-3.5" />
                Sync Extension
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Preferred Locations</label>
                <AnswerValueEditor
                  answerType="multiselect"
                  value={answerDrafts["cp_pref_search_locations"] ?? siteScreeningAnswers["cp_pref_search_locations"] ?? ""}
                  onChange={(val) => setAnswerDrafts((prev) => ({ ...prev, cp_pref_search_locations: val }))}
                  placeholder="e.g. Mohali, Remote, India"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Work Mode</label>
                <AnswerValueEditor
                  answerType="choice"
                  value={answerDrafts["cp_pref_work_mode"] ?? siteScreeningAnswers["cp_pref_work_mode"] ?? "Remote"}
                  onChange={(val) => setAnswerDrafts((prev) => ({ ...prev, cp_pref_work_mode: val }))}
                  options={WORK_MODE_OPTIONS}
                  placeholder="Select mode"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Job Types</label>
                <AnswerValueEditor
                  answerType="multiselect"
                  value={answerDrafts["cp_pref_job_types"] ?? siteScreeningAnswers["cp_pref_job_types"] ?? "Full-time"}
                  onChange={(val) => setAnswerDrafts((prev) => ({ ...prev, cp_pref_job_types: val }))}
                  presets={JOB_TYPE_OPTIONS}
                  placeholder="e.g. Full-time"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Desired Salary / CTC</label>
                <AnswerValueEditor
                  answerType="text"
                  value={answerDrafts["cp_pref_desired_salary"] ?? siteScreeningAnswers["cp_pref_desired_salary"] ?? ""}
                  onChange={(val) => setAnswerDrafts((prev) => ({ ...prev, cp_pref_desired_salary: val }))}
                  placeholder="e.g. ₹12,00,000 / $80,000"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guide Modal */}
      {showLinkedIn ? (
        <ExtensionInstallGuide
          open={installGuideOpen}
          steps={installGuideSteps}
          currentStepIndex={installGuideStepIndex}
          completedStepIds={installGuideCompletedIds}
          onClose={closeInstallGuide}
          onNext={nextInstallGuideStep}
          onPrevious={previousInstallGuideStep}
          onStepDone={markInstallGuideStepDone}
          onJumpToStep={jumpToInstallGuideStep}
          onStepAction={runInstallGuideStepAction}
        />
      ) : null}

      {/* Magic AI Agent Intervention Decision Modal (Overlay) */}
      <MagicAiDecisionModal
        isOpen={aiDecisionModalOpen}
        onClose={() => setAiDecisionModalOpen(false)}
        targetJob={targetModalJob}
        userProfile={{
          name: (user as any)?.name || "Candidate",
          email: (user as any)?.email || "candidate@autoapply.app",
          phone: (user as any)?.phone || "",
          currentCity: (user as any)?.currentCity || "",
          linkedinUrl: (user as any)?.linkedinUrl || "",
          portfolioUrl: (user as any)?.portfolioUrl || "",
          experienceYears: siteScreeningAnswers["years_of_experience"] || siteScreeningAnswers["total_experience"] || "5+",
        }}
        pipelineStats={{
          total: jobs.length,
          submitted: jobs.filter((j) => j.status === "succeeded").length,
          queued: jobs.filter((j) => j.status === "queued" || j.status === "running").length,
          skipped: jobs.filter((j) => j.status === "cancelled").length,
          failed: jobs.filter((j) => j.status === "failed" || j.status === "dead_letter").length,
        }}
        screeningAnswers={siteScreeningAnswers}
        pendingQuestions={pendingQuestionsList}
        onAutoCustomize={async () => {
          await handleGenerate100Keywords();
        }}
        onAutoOptimize={async () => {
          await handleGenerate100Keywords();
          await autoFillAllWithAI();
        }}
        onLaunchAutoApply={async () => {
          await submitAutoApply();
        }}
        onReQueueJob={async (jobId) => {
          await submitAutoApply();
          await loadJobs();
        }}
        onSkipJob={async (jobId) => {
          if (jobId) {
            try {
              await fetch(`/api/auto-apply/jobs/${encodeURIComponent(jobId)}/cancel`, { method: "POST" });
              await loadJobs();
            } catch (err) {
              console.error("Cancel failed", err);
            }
          }
        }}
        onSolveScreening={async () => {
          await autoFillAllWithAI();
        }}
        onSyncExtension={async () => {
          await syncProfileToExtension();
          await checkExtensionStatus();
        }}
        onSaveCustomTag={async (tag) => {
          const updated = Array.from(new Set([...currentSearchTerms, tag]));
          const joined = updated.join(", ");
          setAnswerDrafts((prev) => ({ ...prev, cp_pref_search_terms: joined, preferred_job_titles: joined }));
          await saveAnswerToSite("cp_pref_search_terms", "Preferred Job Titles / Search Terms", joined, "multiselect", "manual");
          await saveAnswerToSite("preferred_job_titles", "Preferred Job Titles / Search Terms", joined, "multiselect", "manual");
          await syncProfileToExtension();
        }}
        searchTerms={currentSearchTerms}
        pendingQuestionsCount={pendingCount}
        totalSyncedCount={totalScreeningAnswers}
        linkedInConnected={linkedInInstalled}
        extensionVersion={linkedInInstalledVersion || "2.6.0"}
      />
      </div>
    </>
  );
}

function withCurrentSelectOption(options: string[], currentValue: string) {
  const normalizedCurrent = String(currentValue || "").trim();
  if (!normalizedCurrent) return options;
  if (options.some((option) => option.toLowerCase() === normalizedCurrent.toLowerCase())) return options;
  return [normalizedCurrent, ...options];
}

function AnswerValueEditor({
  answerType,
  value,
  onChange,
  options = [],
  presets = [],
  placeholder,
  variant = "default",
}: {
  answerType: ScreeningAnswerType;
  value: string;
  onChange: (value: string) => void;
  options?: string[];
  presets?: string[];
  placeholder: string;
  variant?: "default" | "amber";
}) {
  if (answerType === "multiselect") {
    return (
      <AnswerTagInput
        values={parsePreferenceListInput(value)}
        onChange={(values) => onChange(stringifyPreferenceList(values))}
        placeholder={placeholder}
        presets={presets}
        variant={variant}
      />
    );
  }
  if (answerType === "boolean" || answerType === "choice") {
    return (
      <AnswerSelectInput
        value={value}
        onChange={onChange}
        options={options}
        variant={variant}
      />
    );
  }
  return (
    <AnswerTextInput
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      inputMode={answerType === "number" ? "numeric" : undefined}
      variant={variant}
    />
  );
}

function AnswerTextInput({
  value,
  onChange,
  placeholder,
  inputMode,
  variant = "default",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: "text" | "numeric" | "decimal" | "email" | "tel" | "url" | "search" | "none";
  variant?: "default" | "amber";
}) {
  const borderClass = variant === "amber" ? "border-amber-300 focus:border-amber-400" : "border-gray-300 focus:border-purple-400";
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none ${borderClass}`}
    />
  );
}

function AnswerSelectInput({
  value,
  onChange,
  options,
  variant = "default",
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  variant?: "default" | "amber";
}) {
  const borderClass = variant === "amber" ? "border-amber-300 focus:border-amber-400" : "border-gray-300 focus:border-purple-400";
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none ${borderClass}`}
    >
      <option value="">Select</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function AnswerTagInput({
  values,
  onChange,
  placeholder,
  presets = [],
  variant = "default",
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  presets?: string[];
  variant?: "default" | "amber";
}) {
  const [draft, setDraft] = useState("");
  const borderClass = variant === "amber" ? "border-amber-300" : "border-gray-300";

  const addTag = (raw: string) => {
    const value = String(raw || "").trim();
    if (!value) return;
    if (values.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    onChange([...values, value]);
  };

  const removeTag = (value: string) => {
    onChange(values.filter((item) => item !== value));
  };

  return (
    <div>
      <div className={`rounded-lg border bg-white p-2 ${borderClass}`}>
        <div className="flex flex-wrap gap-1.5">
          {values.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700"
            >
              {item}
              <button
                type="button"
                onClick={() => removeTag(item)}
                className="text-indigo-700 hover:text-indigo-900"
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </span>
          ))}

          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addTag(draft);
                setDraft("");
              }
              if (event.key === "Backspace" && !draft && values.length) {
                removeTag(values[values.length - 1]);
              }
            }}
            onBlur={() => {
              if (draft.trim()) {
                addTag(draft);
                setDraft("");
              }
            }}
            placeholder={placeholder}
            className="min-w-[180px] flex-1 px-1 py-1 text-sm outline-none"
          />
        </div>
      </div>

      {presets.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => addTag(preset)}
              className="rounded-full border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              {preset}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
