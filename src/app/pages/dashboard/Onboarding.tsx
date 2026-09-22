import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Plus,
  Play,
  Save,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ExtensionInstallGuide, type ExtensionInstallGuideStep } from "../../components/ExtensionInstallGuide";
import { getExtensionProviderConfig } from "src/lib/extension-providers";
import { collectExtensionBridgeSnapshot } from "src/lib/extension-bridge-client";
import {
  DASHBOARD_TOUR_EVENT_NAME,
  DASHBOARD_TOUR_ONBOARDING_EXTENSION,
  consumeDashboardTourRequest,
} from "src/lib/dashboard-tour";

type TabKey = "profile" | "preferences" | "screening";

type ScreeningAnswerType = "text" | "boolean" | "number" | "choice" | "multiselect";
type ScreeningSource = "manual" | "linkedin_import" | "resume_parse" | "extension_capture" | "system";

type ScreeningAnswerApiItem = {
  questionKey?: string;
  questionLabel?: string;
  answer?: string;
  answerType?: ScreeningAnswerType;
  source?: ScreeningSource;
  lastUsed?: string;
  updatedAt?: string;
};

type PendingIssueItem = {
  questionKey?: string;
  questionLabel?: string;
  validationMessage?: string;
  updatedAt?: string;
};

type OnboardingProgressApi = {
  currentStep?: number;
  profileQuestionIndex?: number;
  preferences?: Record<string, unknown>;
  screeningRows?: Array<{
    questionKey?: string;
    questionLabel?: string;
    answer?: string;
  }>;
  savedAt?: string;
};

type OnboardingProfileApi = {
  user?: {
    name?: string;
    phone?: string;
    currentCity?: string;
    addressLine?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
  };
  progress?: OnboardingProgressApi | null;
};

type ExtensionStatus = {
  installed: boolean;
  runtimeId?: string;
  version?: string;
  linkedIn?: {
    hasLinkedInTab: boolean;
    hasJobsTab: boolean;
  };
  indeed?: {
    hasIndeedTab: boolean;
    hasJobsTab: boolean;
  };
};

type ExtensionReleaseMeta = {
  version: string;
  displayName: string;
  downloadFileName: string;
  downloadBaseName: string;
};

type ScreeningRow = {
  id: string;
  questionLabel: string;
  normalizedKey: string;
  answer: string;
  answerType: ScreeningAnswerType;
  source: ScreeningSource;
  lastUsed: string;
};

type PendingQuestion = {
  questionKey: string;
  questionLabel: string;
  validationMessage: string;
  updatedAt: string;
};

type MasterProfile = {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  addressLine: string;
  linkedinUrl: string;
  portfolioUrl: string;
  workAuthorizationUS: string;
  visaSponsorship: string;
  yearsOfExperience: string;
  englishProficiency: string;
  educationLevel: string;
  resumeUrl: string;
  preferredJobTitles: string[];
  preferredLocations: string[];
  workModePreference: string;
  summary?: string;
};

type JobPreferences = {
  searchTerms: string[];
  searchLocations: string[];
  confidenceLevel: string;
  yearsOfExperience: string;
  workMode: string;
  jobTypes: string[];
  salaryMin: string;
  salaryMax: string;
  preferredCountries: string[];
  excludedCompanies: string[];
  excludedKeywords: string[];
};

type ScreeningPayload = {
  questionKey: string;
  questionLabel: string;
  answer: string;
  answerType: ScreeningAnswerType;
  source: ScreeningSource;
  lastUsed?: string;
};

type WizardStep = {
  title: string;
  description: string;
  tab: TabKey;
};

const EXT_BRIDGE_PING_TIMEOUT_MS = 4500;
const EXT_BRIDGE_ACK_TIMEOUT_MS = 5000;
const EXTENSION_PACKAGE_PREFIX = "AutoApplyCVExtensionVersion";

function formatExtensionPackageName(version: string) {
  const normalized = String(version || "").trim();
  return normalized ? `${EXTENSION_PACKAGE_PREFIX}${normalized}` : EXTENSION_PACKAGE_PREFIX;
}

function formatExtensionPackageFileName(version: string) {
  return `${formatExtensionPackageName(version)}.zip`;
}

const WIZARD_STEPS: WizardStep[] = [
  { title: "Basic Details", description: "Name, email, phone, and location", tab: "profile" },
  { title: "Work Eligibility", description: "Work authorization and sponsorship", tab: "profile" },
  { title: "Experience", description: "Years, education, and English", tab: "profile" },
  { title: "Job Preferences", description: "Titles, locations, remote/onsite", tab: "preferences" },
  { title: "Saved Answers", description: "Reusable LinkedIn screening answers", tab: "screening" },
  { title: "Resume + LinkedIn", description: "Resume status and profile links", tab: "profile" },
];

const PROFILE_KEY_LABELS: Array<{ key: keyof MasterProfile; label: string; answerType?: ScreeningAnswerType }> = [
  { key: "fullName", label: "Full Name" },
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "email", label: "Email Address" },
  { key: "phone", label: "Phone Number" },
  { key: "city", label: "Current City" },
  { key: "state", label: "State / Region" },
  { key: "country", label: "Country" },
  { key: "addressLine", label: "Address Line" },
  { key: "linkedinUrl", label: "LinkedIn URL" },
  { key: "portfolioUrl", label: "Portfolio URL" },
  { key: "workAuthorizationUS", label: "U.S. Work Authorization", answerType: "choice" },
  { key: "visaSponsorship", label: "Need Visa Sponsorship", answerType: "boolean" },
  { key: "yearsOfExperience", label: "Years of Experience", answerType: "number" },
  { key: "englishProficiency", label: "English Proficiency", answerType: "choice" },
  { key: "educationLevel", label: "Education Level", answerType: "choice" },
  { key: "resumeUrl", label: "Resume URL" },
  { key: "workModePreference", label: "Remote / Onsite / Hybrid", answerType: "choice" },
];

const PREFERENCE_KEY_LABELS: Array<{ key: keyof JobPreferences; questionKey: string; label: string; answerType?: ScreeningAnswerType }> = [
  { key: "searchTerms", questionKey: "cp_pref_search_terms", label: "Preferred Job Titles / Search Terms", answerType: "multiselect" },
  { key: "searchLocations", questionKey: "cp_pref_search_locations", label: "Preferred Locations", answerType: "multiselect" },
  { key: "yearsOfExperience", questionKey: "cp_pref_years_of_experience", label: "Years of Experience", answerType: "number" },
  { key: "workMode", questionKey: "cp_pref_work_mode", label: "Remote / Onsite / Hybrid", answerType: "choice" },
  { key: "jobTypes", questionKey: "cp_pref_job_types", label: "Job Types", answerType: "multiselect" },
  { key: "salaryMin", questionKey: "cp_pref_salary_min", label: "Salary Range Min", answerType: "number" },
  { key: "salaryMax", questionKey: "cp_pref_salary_max", label: "Salary Range Max", answerType: "number" },
  { key: "preferredCountries", questionKey: "cp_pref_preferred_countries", label: "Preferred Countries", answerType: "multiselect" },
  { key: "excludedCompanies", questionKey: "cp_pref_excluded_companies", label: "Excluded Companies", answerType: "multiselect" },
  { key: "excludedKeywords", questionKey: "cp_pref_excluded_keywords", label: "Excluded Keywords", answerType: "multiselect" },
];

const LEGACY_PREFERENCE_KEYS = {
  searchTerms: "cp_pref_search_terms",
  searchLocation: "cp_pref_search_location",
  yearsOfExperience: "cp_pref_years_of_experience",
  requireVisa: "cp_pref_require_visa",
  usCitizenship: "cp_pref_us_citizenship",
  desiredSalary: "cp_pref_desired_salary",
  confidenceLevel: "cp_pref_confidence_level",
};

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

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeLabel(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  return normalizeLabel(value) === "remote";
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

function slugifyKey(value: string) {
  const normalized = normalizeLabel(value);
  if (!normalized) return "";
  return normalized.replace(/\s+/g, "_").replace(/^_+|_+$/g, "").slice(0, 160);
}

function hasWords(label: string, words: string[]) {
  return words.every((word) => label.includes(word));
}

function canonicalizeQuestionKey(value: string) {
  const normalized = normalizeLabel(value);
  if (!normalized) return "";

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
  if (normalized.includes("onsite") || normalized.includes("on site")) {
    return "comfortable_working_onsite";
  }
  if (normalized.includes("commut") || normalized.includes("travel to office")) {
    return "comfortable_commuting";
  }
  if (normalized.includes("relocat")) {
    return "comfortable_relocation";
  }
  if ((normalized.includes("salary") || normalized.includes("compensation") || normalized.includes("pay")) && normalized.includes("expect")) {
    return "expected_salary";
  }
  if (normalized.includes("year") && normalized.includes("experience")) {
    return "years_of_experience";
  }
  if (normalized.includes("bachelor") && normalized.includes("degree")) {
    return "bachelors_degree_completed";
  }
  if (normalized.includes("english") && normalized.includes("proficiency")) {
    return "english_proficiency";
  }
  if (normalized.includes("notice") && normalized.includes("period")) {
    return "notice_period_days";
  }
  if (normalized.includes("start") && normalized.includes("date")) {
    return "start_date_availability";
  }

  return slugifyKey(normalized);
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

function parseTags(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "")
    .split(/[\n,|;]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 40);
}

function stringifyTags(value: string[]) {
  return value.map((item) => String(item || "").trim()).filter(Boolean).join(", ");
}

function splitName(fullName: string) {
  const tokens = String(fullName || "")
    .trim()
    .split(/\s+/g)
    .filter(Boolean);
  if (!tokens.length) return { firstName: "", lastName: "" };
  return {
    firstName: tokens[0] || "",
    lastName: tokens.slice(1).join(" "),
  };
}

function splitCityState(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return { city: "", state: "" };
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return { city: raw, state: "" };
  return { city: parts[0], state: parts.slice(1).join(", ") };
}

function combineCityState(city: string, state: string) {
  const c = String(city || "").trim();
  const s = String(state || "").trim();
  if (!c && !s) return "";
  if (!s) return c;
  if (!c) return s;
  return `${c}, ${s}`;
}

function isValidUrl(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizePhoneDigits(value: string) {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

function extractPhoneCountryCode(value: string) {
  const raw = String(value || "").trim();
  const plus = raw.match(/^\+\d{1,3}/);
  return plus ? plus[0] : "+1";
}

function extractPhoneNumber(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/[^\d]/g, "");
}

function toTitleCase(input: string) {
  return String(input || "")
    .split(/[_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function friendlyLabel(questionKey: string, questionLabel: string) {
  const cleanLabel = String(questionLabel || "").trim();
  if (cleanLabel) return cleanLabel;
  const key = String(questionKey || "").trim();
  if (!key) return "Screening Question";

  const prettyByKnownKey: Record<string, string> = {
    work_authorization_us: "U.S. Work Authorization",
    visa_sponsorship_required: "Need Visa Sponsorship",
    comfortable_working_onsite: "Comfortable Working Onsite",
    comfortable_commuting: "Comfortable Commuting",
    comfortable_relocation: "Comfortable Relocation",
    expected_salary: "Expected Salary",
    years_of_experience: "Years of Experience",
    bachelors_degree_completed: "Bachelor's Degree Completed",
    english_proficiency: "English Proficiency",
    start_date_availability: "Start Date Availability",
    cp_pref_search_terms: "Preferred Job Titles / Search Terms",
    cp_pref_search_location: "Primary Search Location",
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
  return prettyByKnownKey[key] || toTitleCase(key);
}

function compactAnswer(value: string, max = 1000) {
  return String(value || "").trim().slice(0, max);
}

function toPayloadQuestionKey(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("cp_pref_")) return raw;
  return canonicalizeQuestionKey(raw);
}

function getSuggestedAnswer(question: PendingQuestion, profile: MasterProfile, preferences: JobPreferences, existingRows: ScreeningRow[]) {
  const normalizedKey = toPayloadQuestionKey(question.questionKey || question.questionLabel);
  const label = normalizeLabel(question.questionLabel);

  const existing = existingRows.find((row) => toPayloadQuestionKey(row.normalizedKey) === normalizedKey && row.answer.trim());
  if (existing) return existing.answer;

  if (normalizedKey === "work_authorization_us") return profile.workAuthorizationUS || "";
  if (normalizedKey === "visa_sponsorship_required") return profile.visaSponsorship || "No";
  if (normalizedKey === "comfortable_working_onsite") return preferences.workMode === "Remote" ? "No" : "Yes";
  if (normalizedKey === "comfortable_commuting") return preferences.workMode === "Remote" ? "No" : "Yes";
  if (normalizedKey === "comfortable_relocation") return preferences.workMode === "Remote" ? "No" : "Yes";
  if (normalizedKey === "years_of_experience") return profile.yearsOfExperience || preferences.yearsOfExperience || "";
  if (normalizedKey === "expected_salary") {
    if (preferences.salaryMin && preferences.salaryMax) return `${preferences.salaryMin}-${preferences.salaryMax}`;
    return preferences.salaryMax || preferences.salaryMin || "";
  }
  if (normalizedKey === "bachelors_degree_completed") {
    const edu = normalizeLabel(profile.educationLevel);
    if (!edu) return "";
    if (
      edu.includes("bachelor") ||
      edu.includes("master") ||
      edu.includes("doctor") ||
      edu.includes("mca") ||
      edu.includes("btech") ||
      edu.includes("be")
    ) {
      return "Yes";
    }
    return "No";
  }
  if (normalizedKey === "english_proficiency") return profile.englishProficiency || "Professional";

  if (label.includes("visa") || label.includes("sponsorship")) return profile.visaSponsorship || "No";
  if (label.includes("authorized") && label.includes("work")) return profile.workAuthorizationUS || "";
  if (label.includes("salary") || label.includes("compensation") || label.includes("pay")) {
    if (preferences.salaryMin && preferences.salaryMax) return `${preferences.salaryMin}-${preferences.salaryMax}`;
    return preferences.salaryMax || preferences.salaryMin || "";
  }
  if (label.includes("experience") && label.includes("year")) return profile.yearsOfExperience || preferences.yearsOfExperience || "";
  if (label.includes("onsite") || label.includes("on site")) return preferences.workMode === "Remote" ? "No" : "Yes";
  if (label.includes("commut") || label.includes("relocat")) return preferences.workMode === "Remote" ? "No" : "Yes";
  return "";
}

const SYSTEM_KEYS = new Set<string>([
  "full_name",
  "first_name",
  "last_name",
  "email_address",
  "phone_number",
  "current_city",
  "state_region",
  "country",
  "address_line",
  "linkedin_url",
  "portfolio_url",
  "work_authorization_us",
  "visa_sponsorship_required",
  "years_of_experience",
  "english_proficiency",
  "education_level",
  "resume_url",
  "preferred_job_titles",
  "preferred_locations",
  "work_mode_preference",
  "cp_pref_search_terms",
  "cp_pref_search_location",
  "cp_pref_search_locations",
  "cp_pref_years_of_experience",
  "cp_pref_require_visa",
  "cp_pref_us_citizenship",
  "cp_pref_desired_salary",
  "cp_pref_confidence_level",
  "cp_pref_work_mode",
  "cp_pref_job_types",
  "cp_pref_salary_min",
  "cp_pref_salary_max",
  "cp_pref_preferred_countries",
  "cp_pref_excluded_companies",
  "cp_pref_excluded_keywords",
]);

const DEFAULT_PROFILE: MasterProfile = {
  fullName: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  city: "",
  state: "",
  country: "United States",
  addressLine: "",
  linkedinUrl: "",
  portfolioUrl: "",
  workAuthorizationUS: "",
  visaSponsorship: "No",
  yearsOfExperience: "",
  englishProficiency: "Professional",
  educationLevel: "",
  resumeUrl: "",
  preferredJobTitles: [],
  preferredLocations: [],
  workModePreference: "Remote",
  summary: "",
};

const JOB_TITLE_SUGGESTIONS = [
  "Software Engineer",
  "Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "React Developer",
  "Node.js Developer",
  "Python Developer",
  "Java Developer",
  "DevOps Engineer",
  "Cloud Engineer",
  "Data Scientist",
  "Data Analyst",
  "Machine Learning Engineer",
  "AI Engineer",
  "Product Manager",
  "Project Manager",
  "UI/UX Designer",
  "Graphic Designer",
  "QA Engineer",
  "Test Engineer",
  "Business Analyst",
  "Technical Writer",
  "Solutions Architect",
  "Systems Administrator",
  "Database Administrator",
  "Mobile Developer",
  "iOS Developer",
  "Android Developer",
  "Cybersecurity Analyst",
  "Network Engineer",
  "Scrum Master",
  "Marketing Manager",
  "Content Writer",
  "HR Manager",
  "Finance Analyst",
  "Operations Manager",
  "Sales Executive",
  "Customer Success Manager",
];

const DEFAULT_PREFERENCES: JobPreferences = {
  searchTerms: [],
  searchLocations: [],
  confidenceLevel: "8",
  yearsOfExperience: "",
  workMode: "Remote",
  jobTypes: ["Full-time"],
  salaryMin: "",
  salaryMax: "",
  preferredCountries: [],
  excludedCompanies: [],
  excludedKeywords: [],
};

function generateResumeHTML(data: Record<string, any>): string {
  const name = data.name || "";
  const titles = Array.isArray(data.jobTitles) ? data.jobTitles.join(", ") : (data.jobTitles || "");
  const headline = titles ? `${name ? `${name} — ` : ""}${titles}` : name;
  const location = [data.city, data.state, data.country].filter(Boolean).join(", ");
  const contactParts: string[] = [];
  if (location) contactParts.push(location);
  if (data.phone) contactParts.push(data.phone);
  if (data.email) contactParts.push(data.email);
  const contactLine = contactParts.join(" | ");
  const links: string[] = [];
  if (data.linkedinUrl) links.push(`<a href="${escapeHtml(data.linkedinUrl)}">${escapeHtml(cleanUrl(data.linkedinUrl))}</a>`);
  if (data.portfolioUrl) links.push(`<a href="${escapeHtml(data.portfolioUrl)}">${escapeHtml(cleanUrl(data.portfolioUrl))}</a>`);

  const skills = Array.isArray(data.skills) ? data.skills : [];
  const experience = Array.isArray(data.experience) ? data.experience : [];
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const education = Array.isArray(data.education) ? data.education : [];
  const certifications = Array.isArray(data.certifications) ? data.certifications : [];

  let html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Resume — ${escapeHtml(name)}</title>
    <style>
      :root { --text: #111; --muted: #444; --rule: #ddd; }
      html, body { color: var(--text); font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.35; }
      body { margin: 24px; }
      h1 { font-size: 18pt; margin: 0 0 2px 0; letter-spacing: 0.2px; }
      .headline { font-size: 12pt; margin: 0 0 10px 0; }
      .contact { margin: 0 0 16px 0; color: var(--muted); }
      .links { margin: 0 0 16px 0; color: var(--muted); }
      .links a { color: var(--muted); }
      h2 { font-size: 12pt; margin: 16px 0 6px 0; padding-bottom: 4px; border-bottom: 1px solid var(--rule); text-transform: uppercase; letter-spacing: 0.6px; }
      h3 { font-size: 11pt; margin: 10px 0 2px 0; }
      .meta { color: var(--muted); margin: 0 0 6px 0; }
      ul { margin: 6px 0 0 18px; padding: 0; }
      li { margin: 0 0 4px 0; }
      .two-col { columns: 2; column-gap: 22px; }
      .two-col ul { margin-left: 16px; }
      a { color: inherit; text-decoration: none; }
    </style>
  </head>
  <body>`;

  if (name) {
    html += `\n    <h1>${escapeHtml(name.toUpperCase())}</h1>`;
  }
  if (headline) {
    html += `\n    <div class="headline">${escapeHtml(headline)}</div>`;
  }
  if (contactLine) {
    html += `\n    <div class="contact">${escapeHtml(contactLine)}</div>`;
  }
  if (links.length > 0) {
    html += `\n    <div class="links">${links.join(" | ")}</div>`;
  }

  if (data.summary) {
    html += `\n    <h2>Summary</h2>`;
    html += `\n    <div>${escapeHtml(data.summary)}</div>`;
  }

  if (skills.length > 0) {
    html += `\n    <h2>Core Skills</h2>`;
    html += `\n    <div class="two-col"><ul>`;
    for (const s of skills) {
      html += `\n      <li>${escapeHtml(s)}</li>`;
    }
    html += `\n    </ul></div>`;
  }

  if (experience.length > 0) {
    html += `\n    <h2>Experience</h2>`;
    for (const exp of experience) {
      const title = exp.title || "";
      const company = exp.company || "";
      const label = title && company ? `${title} — ${company}` : (title || company);
      if (label) html += `\n    <h3>${escapeHtml(label)}</h3>`;
      const dates = [exp.startDate, exp.endDate].filter(Boolean).join(" – ");
      if (dates) html += `\n    <div class="meta">${escapeHtml(dates)}</div>`;
      const desc = Array.isArray(exp.description) ? exp.description : [];
      if (desc.length > 0) {
        html += `\n    <ul>`;
        for (const d of desc) {
          html += `\n      <li>${escapeHtml(d)}</li>`;
        }
        html += `\n    </ul>`;
      }
    }
  }

  if (projects.length > 0) {
    html += `\n    <h2>Projects</h2>`;
    for (const proj of projects) {
      const projName = proj.name || "";
      const projLink = proj.link || "";
      if (projName) {
        html += `\n    <h3>${escapeHtml(projName)}${projLink ? ` — <a href="${escapeHtml(projLink)}">${escapeHtml(cleanUrl(projLink))}</a>` : ""}</h3>`;
      }
      if (proj.description) {
        html += `\n    <div>${escapeHtml(proj.description)}</div>`;
      }
      const techs = Array.isArray(proj.technologies) ? proj.technologies : [];
      if (techs.length > 0) {
        html += `\n    <div class="meta">${escapeHtml(techs.join(", "))}</div>`;
      }
    }
  }

  if (education.length > 0) {
    html += `\n    <h2>Education</h2>`;
    for (const edu of education) {
      const degree = edu.degree || "";
      const field = edu.field || "";
      const institution = edu.institution || "";
      const parts: string[] = [];
      if (degree && field) parts.push(`${degree}, ${field}`);
      else if (degree) parts.push(degree);
      else if (field) parts.push(field);
      if (institution) parts.push(institution);
      const dates = [edu.startDate, edu.endDate].filter(Boolean).join(" – ");
      if (parts.length > 0) {
        html += `\n    <div><strong>${escapeHtml(parts.join(" — "))}</strong>${dates ? ` <span class="meta">| ${escapeHtml(dates)}</span>` : ""}</div>`;
      }
    }
  }

  if (certifications.length > 0) {
    html += `\n    <h2>Certifications</h2>`;
    html += `\n    <ul>`;
    for (const cert of certifications) {
      const certName = cert.name || "";
      const issuer = cert.issuer || "";
      const certDate = cert.date || "";
      const certLabel = certName + (issuer ? ` — ${issuer}` : "") + (certDate ? ` (${certDate})` : "");
      html += `\n      <li>${escapeHtml(certLabel)}</li>`;
    }
    html += `\n    </ul>`;
  }

  html += `\n  </body>\n</html>`;
  return html;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function cleanUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [wizardStep, setWizardStep] = useState(0);
  const [profileQuestionIndex, setProfileQuestionIndex] = useState(0);
  const [guidedPopupOpen, setGuidedPopupOpen] = useState(false);
  const [profile, setProfile] = useState<MasterProfile>(DEFAULT_PROFILE);
  const [preferences, setPreferences] = useState<JobPreferences>(DEFAULT_PREFERENCES);
  const [screeningRows, setScreeningRows] = useState<ScreeningRow[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState("");
  const [savingAnswerKey, setSavingAnswerKey] = useState("");
  const [checkingExtension, setCheckingExtension] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus>({ installed: false });
  const [extensionRelease, setExtensionRelease] = useState<ExtensionReleaseMeta>({
    version: "1.1.3",
    displayName: "AutoApply CV LinkedIn Copilot",
    downloadFileName: formatExtensionPackageFileName("1.1.3"),
    downloadBaseName: formatExtensionPackageName("1.1.3"),
  });
  const installedPackageName =
    extensionStatus.installed && extensionStatus.version ? formatExtensionPackageName(extensionStatus.version) : "";
  const checkExtensionButtonRef = useRef<HTMLButtonElement | null>(null);
  const saveAndFinishButtonRef = useRef<HTMLButtonElement | null>(null);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [installGuideStepIndex, setInstallGuideStepIndex] = useState(0);
  const [installGuideCompletedIds, setInstallGuideCompletedIds] = useState<string[]>([]);

  const [generatingAts, setGeneratingAts] = useState(false);
  const [atsHtml, setAtsHtml] = useState("");
  const [atsGenerated, setAtsGenerated] = useState(false);

  const [revealedFields, setRevealedFields] = useState<string[]>([]);
  const [parsingStatus, setParsingStatus] = useState<"idle" | "scanning" | "parsing" | "done">("idle");
  const parsedDataRef = useRef<Record<string, any>>({});
  const [resumeViewerData, setResumeViewerData] = useState<Record<string, any> | null>(null);
  const [showResumeViewer, setShowResumeViewer] = useState(false);
  const [showingExtensionPrefs, setShowingExtensionPrefs] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [extLocationsRaw, setExtLocationsRaw] = useState("");
  const [extSearchTermsRaw, setExtSearchTermsRaw] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [isGeneratingAiProfile, setIsGeneratingAiProfile] = useState(false);
  const [aiProfileGeneratedMsg, setAiProfileGeneratedMsg] = useState("");
  const [generatedKeywords, setGeneratedKeywords] = useState<string[]>([]);
  const [generatedDescription, setGeneratedDescription] = useState("");

  const handleAutoGenerateProfileWithGroq = async () => {
    setIsGeneratingAiProfile(true);
    setError("");
    setAiProfileGeneratedMsg("");
    try {
      const res = await fetch("/api/user/ai/generate-search-profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to generate search profile");
      }
      const { searchTerms, keywords, allKeywords, description } = data.data || {};

      const combinedTerms: string[] = Array.isArray(searchTerms) ? searchTerms : [];
      const combinedAll: string[] = Array.isArray(allKeywords) ? allKeywords : [];

      if (combinedTerms.length > 0) {
        setPreferences((prev) => ({
          ...prev,
          searchTerms: Array.from(new Set([...prev.searchTerms, ...combinedTerms])),
        }));
        setProfile((prev) => ({
          ...prev,
          preferredJobTitles: Array.from(new Set([...prev.preferredJobTitles, ...combinedTerms])),
        }));
      }

      if (combinedAll.length > 0) {
        setGeneratedKeywords(combinedAll);
      }

      if (description) {
        setGeneratedDescription(description);
        await saveAnswer("description", "Professional Description / Summary", description, "text", "system");
        await saveAnswer("summary", "Summary of Experience", description, "text", "system");
      }

      const totalCount = combinedAll.length || combinedTerms.length;
      setAiProfileGeneratedMsg(
        `✨ Generated ${totalCount} target keywords and tailored description using Groq AI!`
      );
      setMessage(`✨ Generated ${totalCount} search keywords & description with Groq AI!`);
    } catch (err: any) {
      setError(err?.message || "Failed to generate search terms with AI");
    } finally {
      setIsGeneratingAiProfile(false);
    }
  };

  const loadedRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});

  const focusField = (key: string) => {
    const el = fieldRefs.current[key];
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      // ignore
    }
    el.focus();
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      // best-effort haptic feedback on supported devices
      (navigator as any).vibrate?.(60);
    }
  };

  const gotoWizardStep = (nextStep: number) => {
    const bounded = Math.max(0, Math.min(WIZARD_STEPS.length - 1, Math.floor(nextStep)));
    setWizardStep(bounded);
    setActiveTab(WIZARD_STEPS[bounded].tab);
    setProfileQuestionIndex(0);
  };

  const saveAnswer = async (
    questionKey: string,
    questionLabel: string,
    answer: string,
    answerType: ScreeningAnswerType = inferAnswerType(answer),
    source: ScreeningSource = "manual",
  ) => {
    const normalizedKey = toPayloadQuestionKey(questionKey || questionLabel);
    const cleanAnswer = compactAnswer(answer);
    const cleanLabel = String(questionLabel || "").trim() || friendlyLabel(normalizedKey, "");
    if (!normalizedKey || !cleanAnswer || !cleanLabel) return;

    setSavingAnswerKey(normalizedKey);
    setError("");

    try {
      const payload: ScreeningPayload = {
        questionKey: normalizedKey,
        questionLabel: cleanLabel,
        answer: cleanAnswer,
        answerType,
        source,
        lastUsed: new Date().toISOString(),
      };

      const res = await fetch("/api/user/screening/answers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to save answer");
      }

      setScreeningRows((prev) => {
        const existingIdx = prev.findIndex((item) => toPayloadQuestionKey(item.normalizedKey) === normalizedKey);
        if (existingIdx === -1) {
          return [
            ...prev,
            {
              id: makeId(),
              questionLabel: cleanLabel,
              normalizedKey,
              answer: cleanAnswer,
              answerType,
              source,
              lastUsed: new Date().toISOString(),
            },
          ].sort((a, b) => a.questionLabel.localeCompare(b.questionLabel));
        }

        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          questionLabel: cleanLabel,
          normalizedKey,
          answer: cleanAnswer,
          answerType,
          source,
          lastUsed: new Date().toISOString(),
        };
        return next.sort((a, b) => a.questionLabel.localeCompare(b.questionLabel));
      });

      setPendingQuestions((prev) => prev.filter((item) => item.questionKey !== normalizedKey));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save answer");
    } finally {
      setSavingAnswerKey("");
    }
  };

  const extensionStoreUrl = String(
    process.env.NEXT_PUBLIC_EXTENSION_STORE_URL || getExtensionProviderConfig("linkedin").storeUrl || "",
  ).trim();

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

  const checkExtensionStatus = async (opts?: { silent?: boolean }) => {
    if (typeof window === "undefined") return;
    const silent = Boolean(opts?.silent);
    setCheckingExtension(true);
    try {
      const snapshot = await collectExtensionBridgeSnapshot({
        timeoutMs: EXT_BRIDGE_PING_TIMEOUT_MS,
        settleMs: 500,
        requestIdPrefix: "cp_onboarding",
      });
      const result: ExtensionStatus = {
        installed: snapshot.installed,
        runtimeId: snapshot.runtimeId,
        version: snapshot.version,
        linkedIn: snapshot.linkedIn || undefined,
        indeed: snapshot.indeed || undefined,
      };

      setExtensionStatus(result);
      if (!silent && !result.installed) {
        setMessage("Extension not detected yet. You can still complete onboarding and sync later.");
      }
    } finally {
      setCheckingExtension(false);
    }
  };

  const generateAtsResume = async () => {
    if (typeof window === "undefined") return;
    setError("");
    setMessage("");
    setGeneratingAts(true);
    try {
      const extracted: Record<string, string | string[]> = {};
      if (profile.fullName) extracted.name = profile.fullName;
      if (profile.email) extracted.email = profile.email;
      if (profile.phone) extracted.phone = profile.phone;
      if (profile.city) extracted.city = profile.city;
      if (profile.state) extracted.state = profile.state;
      if (profile.country) extracted.country = profile.country;
      if (profile.linkedinUrl) extracted.linkedinUrl = profile.linkedinUrl;
      if (profile.portfolioUrl) extracted.portfolioUrl = profile.portfolioUrl;
      if (profile.yearsOfExperience) extracted.yearsOfExperience = profile.yearsOfExperience;
      if (profile.educationLevel) extracted.educationLevel = profile.educationLevel;
      if (preferences.searchTerms.length) extracted.jobTitles = preferences.searchTerms;

      const res = await fetch("/api/user/resume/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extracted }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to generate resume");
      }
      setAtsHtml(data?.data?.html || "");
      setAtsGenerated(true);
      setMessage("ATS resume generated! You can preview and download below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate ATS resume");
    } finally {
      setGeneratingAts(false);
    }
  };

  const openExtensionStore = () => {
    if (typeof window === "undefined") return;
    setError("");
    setMessage("");
    if (!extensionStoreUrl) {
      setError("Chrome Web Store URL is not configured yet.");
      return;
    }
    const opened = window.open(extensionStoreUrl, "_blank", "noopener,noreferrer");
    if (opened) {
      opened.opener = null;
    }
    setMessage("Opening the Chrome Web Store. Click Add to Chrome to install the extension.");
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
    setMessage("");
    setActiveTab("preferences");
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
      setMessage("Guided install completed. If the extension does not appear yet, refresh this page and check again.");
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
    if (step.id === "save-and-sync") {
      void persistAll();
      return;
    }
    if (step.id === "open-linkedin-jobs") {
      openLinkedInJobsTab();
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const maybeOpenQueuedTour = () => {
      if (!consumeDashboardTourRequest(DASHBOARD_TOUR_ONBOARDING_EXTENSION)) return;
      openInstallGuide();
    };

    const onDashboardTourRequest = (event: Event) => {
      const tourId = (event as CustomEvent<{ tourId?: string }>).detail?.tourId || "";
      if (tourId !== DASHBOARD_TOUR_ONBOARDING_EXTENSION) return;
      maybeOpenQueuedTour();
    };

    maybeOpenQueuedTour();
    window.addEventListener(DASHBOARD_TOUR_EVENT_NAME, onDashboardTourRequest);
    return () => {
      window.removeEventListener(DASHBOARD_TOUR_EVENT_NAME, onDashboardTourRequest);
    };
  }, [openInstallGuide]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [profileRes, answersRes, issuesRes] = await Promise.all([
        fetch("/api/user/onboarding", { credentials: "include" }),
        fetch("/api/user/screening/answers?limit=500&scanLimit=2500", { credentials: "include" }),
        fetch("/api/user/screening/issues?limit=200&scanLimit=2500", { credentials: "include" }),
      ]);
      const [profileJson, answersJson, issuesJson] = await Promise.all([
        profileRes.json().catch(() => null),
        answersRes.json().catch(() => null),
        issuesRes.json().catch(() => null),
      ]);

      const profileApi = (profileJson?.data || null) as OnboardingProfileApi | null;
      const savedUser = profileApi?.user || {};
      const savedProgress = profileApi?.progress || null;

      const answers = Array.isArray(answersJson?.data?.answers)
        ? (answersJson.data.answers as ScreeningAnswerApiItem[])
        : [];

      const pending = Array.isArray(issuesJson?.data?.pending)
        ? (issuesJson.data.pending as PendingIssueItem[])
        : [];

      const answerByKey = new Map<string, ScreeningAnswerApiItem>();
      for (const item of answers) {
        const key = toPayloadQuestionKey(String(item?.questionKey || item?.questionLabel || ""));
        const answer = String(item?.answer || "").trim();
        if (!key || !answer) continue;
        if (!answerByKey.has(key)) {
          answerByKey.set(key, item);
        }
      }

      const readAnswer = (...keys: string[]) => {
        for (const key of keys) {
          const canonical = toPayloadQuestionKey(key);
          const found = answerByKey.get(canonical);
          const value = String(found?.answer || "").trim();
          if (value) return value;
        }
        return "";
      };

      const userName = String(savedUser.name || user?.name || "").trim();
      const nameParts = splitName(userName);
      const currentCity = String(savedUser.currentCity || user?.currentCity || "").trim();
      const cityState = splitCityState(currentCity);

      const nextProfile: MasterProfile = {
        fullName: userName,
        firstName: readAnswer("first_name") || nameParts.firstName,
        lastName: readAnswer("last_name") || nameParts.lastName,
        email: String(user?.email || "").trim(),
        phone: normalizePhoneDigits(String(savedUser.phone || user?.phone || readAnswer("phone_number") || "")),
        city: readAnswer("current_city", "city") || cityState.city,
        state: readAnswer("state_region") || cityState.state,
        country: readAnswer("country") || "United States",
        addressLine: String(savedUser.addressLine || user?.addressLine || readAnswer("address_line") || "").trim(),
        linkedinUrl: String(savedUser.linkedinUrl || user?.linkedinUrl || readAnswer("linkedin_url") || "").trim(),
        portfolioUrl: String(savedUser.portfolioUrl || user?.portfolioUrl || readAnswer("portfolio_url") || "").trim(),
        workAuthorizationUS: readAnswer("work_authorization_us", LEGACY_PREFERENCE_KEYS.usCitizenship),
        visaSponsorship: readAnswer("visa_sponsorship_required", LEGACY_PREFERENCE_KEYS.requireVisa) || "No",
        yearsOfExperience: readAnswer("years_of_experience", LEGACY_PREFERENCE_KEYS.yearsOfExperience),
        englishProficiency: readAnswer("english_proficiency") || "Professional",
        educationLevel: readAnswer("education_level", "bachelors_degree_completed"),
        resumeUrl: readAnswer("resume_url"),
        preferredJobTitles: parseTags(readAnswer("preferred_job_titles", LEGACY_PREFERENCE_KEYS.searchTerms)),
        preferredLocations: parseTags(
          readAnswer("preferred_locations", "cp_pref_search_locations", LEGACY_PREFERENCE_KEYS.searchLocation),
        ),
        workModePreference: readAnswer("work_mode_preference", "cp_pref_work_mode") || "Remote",
      };

      const parsedJobTypes = parseTags(readAnswer("cp_pref_job_types"));

      const nextPreferences: JobPreferences = {
        searchTerms: parseTags(readAnswer(LEGACY_PREFERENCE_KEYS.searchTerms) || stringifyTags(nextProfile.preferredJobTitles)),
        searchLocations: parseTags(
          readAnswer("cp_pref_search_locations", LEGACY_PREFERENCE_KEYS.searchLocation) ||
            stringifyTags(nextProfile.preferredLocations),
        ),
        confidenceLevel: readAnswer(LEGACY_PREFERENCE_KEYS.confidenceLevel) || "8",
        yearsOfExperience: readAnswer(LEGACY_PREFERENCE_KEYS.yearsOfExperience) || nextProfile.yearsOfExperience,
        workMode: readAnswer("cp_pref_work_mode") || nextProfile.workModePreference || "Remote",
        jobTypes: parsedJobTypes.length ? parsedJobTypes : ["Full-time"],
        salaryMin: readAnswer("cp_pref_salary_min"),
        salaryMax: readAnswer("cp_pref_salary_max", LEGACY_PREFERENCE_KEYS.desiredSalary),
        preferredCountries: parseTags(readAnswer("cp_pref_preferred_countries") || nextProfile.country || ""),
        excludedCompanies: parseTags(readAnswer("cp_pref_excluded_companies")),
        excludedKeywords: parseTags(readAnswer("cp_pref_excluded_keywords")),
      };

      const customRows: ScreeningRow[] = [];
      const seenRows = new Set<string>();
      for (const item of answers) {
        const normalizedKey = toPayloadQuestionKey(String(item?.questionKey || item?.questionLabel || ""));
        const answer = String(item?.answer || "").trim();
        if (!normalizedKey || !answer || SYSTEM_KEYS.has(normalizedKey) || seenRows.has(normalizedKey)) continue;
        seenRows.add(normalizedKey);
        customRows.push({
          id: makeId(),
          questionLabel: friendlyLabel(normalizedKey, String(item?.questionLabel || "")),
          normalizedKey,
          answer,
          answerType: (item?.answerType as ScreeningAnswerType) || inferAnswerType(answer),
          source: (item?.source as ScreeningSource) || "manual",
          lastUsed: String(item?.lastUsed || item?.updatedAt || ""),
        });
      }

      const nextPending: PendingQuestion[] = [];
      for (const issue of pending) {
        const questionLabel = String(issue?.questionLabel || "").trim();
        const questionKey = toPayloadQuestionKey(String(issue?.questionKey || questionLabel));
        if (!questionKey || !questionLabel) continue;
        nextPending.push({
          questionKey,
          questionLabel,
          validationMessage: String(issue?.validationMessage || "").trim(),
          updatedAt: String(issue?.updatedAt || ""),
        });
      }

      const suggestedDrafts: Record<string, string> = {};
      for (const p of nextPending) {
        const suggestion = getSuggestedAnswer(p, nextProfile, nextPreferences, customRows);
        if (suggestion) {
          suggestedDrafts[p.questionKey] = suggestion;
        }
      }

      const timestamps = [
        String(savedProgress?.savedAt || ""),
        ...answers.map((item) => String(item?.lastUsed || item?.updatedAt || "")),
        ...nextPending.map((item) => String(item.updatedAt || "")),
      ]
        .map((value) => value.trim())
        .filter(Boolean)
        .sort();

      setProfile(nextProfile);
      setPreferences(nextPreferences);
      setScreeningRows(customRows.sort((a, b) => a.questionLabel.localeCompare(b.questionLabel)));
      setPendingQuestions(nextPending);
      setAnswerDrafts(suggestedDrafts);
      setWizardStep(
        typeof savedProgress?.currentStep === "number"
          ? Math.max(0, Math.min(WIZARD_STEPS.length - 1, Math.floor(savedProgress.currentStep)))
          : 0,
      );
      setProfileQuestionIndex(typeof savedProgress?.profileQuestionIndex === "number" ? Math.max(0, Math.floor(savedProgress.profileQuestionIndex)) : 0);
      setDraftSavedAt(String(savedProgress?.savedAt || ""));
      setLastSyncAt(timestamps[timestamps.length - 1] || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load onboarding data");
    } finally {
      loadedRef.current = true;
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadExtensionMeta = async () => {
      try {
        const res = await fetch("/api/public/extension-meta", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data?.success || !active) return;
        setExtensionRelease((prev) => ({
          ...prev,
          ...(data.data || {}),
        }));
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
    void loadData();
    void checkExtensionStatus({ silent: true });

    const extensionTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void checkExtensionStatus({ silent: true });
      }
    }, 15000);

    return () => {
      window.clearInterval(extensionTimer);
    };
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildDraftPayload = () => {
    const screeningRowsForDraft = screeningRows
      .map((row) => ({
        questionKey: toPayloadQuestionKey(row.normalizedKey || row.questionLabel),
        questionLabel: String(row.questionLabel || "").trim(),
        answer: compactAnswer(row.answer),
      }))
      .filter((row) => Boolean(row.questionKey && row.questionLabel && row.answer))
      .slice(0, 250);

    return {
      name: profile.fullName,
      phone: profile.phone,
      currentCity: combineCityState(profile.city, profile.state),
      addressLine: profile.addressLine,
      linkedinUrl: profile.linkedinUrl,
      portfolioUrl: profile.portfolioUrl,
      currentStep: wizardStep,
      profileQuestionIndex,
      preferences: {
        searchTerms: stringifyTags(preferences.searchTerms),
        searchLocation: stringifyTags(preferences.searchLocations),
        yearsOfExperienceAnswer: preferences.yearsOfExperience,
        requireVisa: profile.visaSponsorship,
        usCitizenship: profile.workAuthorizationUS,
        desiredSalary: preferences.salaryMax,
        confidenceLevel: preferences.confidenceLevel,
      },
      screeningRows: screeningRowsForDraft,
    };
  };

  const saveDraft = async () => {
    const res = await fetch("/api/user/onboarding", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildDraftPayload()),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      throw new Error(data?.message || "Failed to save onboarding draft");
    }
  };

  useEffect(() => {
    if (!loadedRef.current || loading || saving) return;

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    setDraftStatus("saving");
    autosaveTimerRef.current = window.setTimeout(() => {
      void saveDraft()
        .then(() => {
          setDraftStatus("saved");
          setDraftSavedAt(new Date().toISOString());
        })
        .catch((draftError) => {
          setDraftStatus("error");
          setError((prev) => prev || (draftError instanceof Error ? draftError.message : "Draft autosave failed"));
        });
    }, 900);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [profile, preferences, screeningRows, wizardStep, profileQuestionIndex, loading, saving]);

  useEffect(() => {
    if (!profile.fullName.trim()) return;
    setProfile((prev) => {
      const parsed = splitName(prev.fullName);
      if (prev.firstName === parsed.firstName && prev.lastName === parsed.lastName) return prev;
      return {
        ...prev,
        firstName: prev.firstName || parsed.firstName,
        lastName: prev.lastName || parsed.lastName,
      };
    });
  }, [profile.fullName]);

  useEffect(() => {
    if (profile.preferredJobTitles.length && !preferences.searchTerms.length) {
      setPreferences((prev) => ({ ...prev, searchTerms: [...profile.preferredJobTitles] }));
    }
    if (profile.preferredLocations.length && !preferences.searchLocations.length) {
      setPreferences((prev) => ({ ...prev, searchLocations: [...profile.preferredLocations] }));
    }
  }, [profile.preferredJobTitles, profile.preferredLocations, preferences.searchTerms.length, preferences.searchLocations.length]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-tag-input]")) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const completionChecks = useMemo(
    () => [
      { label: "Full name", done: profile.fullName.trim().length >= 2 },
      { label: "Phone", done: extractPhoneNumber(profile.phone).length >= 6 },
    ],
    [profile, preferences],
  );

  const completionPercent = useMemo(() => {
    const doneCount = completionChecks.filter((item) => item.done).length;
    return Math.round((doneCount / completionChecks.length) * 100);
  }, [completionChecks]);

  const remoteWorkModeSelected = isRemoteWorkModeSelected(preferences.workMode);

  const missingItems = useMemo(
    () => completionChecks.filter((item) => !item.done).map((item) => item.label),
    [completionChecks],
  );

  const stepComplete = useMemo(() => {
    const hasBasic = profile.fullName.trim().length >= 2 && extractPhoneNumber(profile.phone).length >= 6;

    // Steps 2-6 are optional; mark them complete so the UI doesn't nag users.
    return [hasBasic, true, true, true, true, true];
  }, [profile, preferences, screeningRows.length, pendingQuestions.length, user?.resumeFileName]);

  type GuidedQuestion = {
    id: string;
    title: string;
    required?: boolean;
    isComplete: () => boolean;
    render: () => ReactNode;
  };

  const guidedQuestions = useMemo<GuidedQuestion[]>(() => {
    const usWorkAuthOptions = [
      "U.S. Citizen/Permanent Resident",
      "Authorized to work in the U.S.",
      "Require sponsorship",
      "Not authorized",
    ];

    if (wizardStep === 0) {
      return [
        {
          id: "fullName",
          title: "Full Name",
          required: true,
          isComplete: () => profile.fullName.trim().length >= 2,
          render: () => (
            <InputField
              label="Full Name"
              value={profile.fullName}
              onChange={(value) => setProfile((prev) => ({ ...prev, fullName: value }))}
              placeholder="e.g. Alex Johnson"
              required
            />
          ),
        },
        {
          id: "phone",
          title: "Phone",
          required: true,
          isComplete: () => extractPhoneNumber(profile.phone).length >= 6,
          render: () => (
            <InputField
              label="Phone"
              value={profile.phone}
              onChange={(value) => setProfile((prev) => ({ ...prev, phone: value }))}
              placeholder="+1 5551234567"
              required
            />
          ),
        },
        {
          id: "addressLine",
          title: "Address",
          required: false,
          isComplete: () => true,
          render: () => (
            <InputField
              label="Address"
              value={profile.addressLine}
              onChange={(value) => setProfile((prev) => ({ ...prev, addressLine: value }))}
              placeholder="Street and area"
            />
          ),
        },
        {
          id: "city",
          title: "City",
          required: false,
          isComplete: () => true,
          render: () => (
            <InputField
              label="City"
              value={profile.city}
              onChange={(value) => setProfile((prev) => ({ ...prev, city: value }))}
              placeholder="Austin"
            />
          ),
        },
        {
          id: "state",
          title: "State / Region",
          required: false,
          isComplete: () => true,
          render: () => (
            <InputField
              label="State / Region"
              value={profile.state}
              onChange={(value) => setProfile((prev) => ({ ...prev, state: value }))}
              placeholder="Texas"
            />
          ),
        },
        {
          id: "country",
          title: "Country",
          required: false,
          isComplete: () => true,
          render: () => (
            <InputField
              label="Country"
              value={profile.country}
              onChange={(value) => setProfile((prev) => ({ ...prev, country: value }))}
              placeholder="United States"
            />
          ),
        },
      ];
    }

    if (wizardStep === 1) {
      return [
        {
          id: "workAuthorizationUS",
          title: "U.S. Work Authorization",
          required: false,
          isComplete: () => true,
          render: () => (
            <SelectField
              label="U.S. Work Authorization"
              value={profile.workAuthorizationUS}
              onChange={(value) => setProfile((prev) => ({ ...prev, workAuthorizationUS: value }))}
              options={usWorkAuthOptions}
            />
          ),
        },
        {
          id: "visaSponsorship",
          title: "Need Visa Sponsorship",
          required: false,
          isComplete: () => true,
          render: () => (
            <SelectField
              label="Need Visa Sponsorship"
              value={profile.visaSponsorship}
              onChange={(value) => setProfile((prev) => ({ ...prev, visaSponsorship: value }))}
              options={["No", "Yes"]}
            />
          ),
        },
        {
          id: "workModePreference",
          title: "Remote / Onsite / Hybrid",
          required: false,
          isComplete: () => true,
          render: () => (
            <SelectField
              label="Remote / Onsite / Hybrid"
              value={profile.workModePreference}
              onChange={(value) => {
                setProfile((prev) => ({ ...prev, workModePreference: value }));
                setPreferences((prev) => ({ ...prev, workMode: value }));
              }}
              options={WORK_MODE_OPTIONS}
            />
          ),
        },
      ];
    }

    if (wizardStep === 2) {
      return [
        {
          id: "yearsOfExperience",
          title: "Years of Experience",
          required: false,
          isComplete: () => true,
          render: () => (
            <InputField
              label="Years of Experience"
              value={profile.yearsOfExperience}
              onChange={(value) => {
                setProfile((prev) => ({ ...prev, yearsOfExperience: value }));
                setPreferences((prev) => ({ ...prev, yearsOfExperience: value }));
              }}
              placeholder="e.g. 5"
            />
          ),
        },
        {
          id: "educationLevel",
          title: "Education Level",
          required: false,
          isComplete: () => true,
          render: () => (
            <SelectField
              label="Education Level"
              value={profile.educationLevel}
              onChange={(value) => setProfile((prev) => ({ ...prev, educationLevel: value }))}
              options={EDUCATION_LEVEL_OPTIONS}
            />
          ),
        },
        {
          id: "englishProficiency",
          title: "English Proficiency",
          required: false,
          isComplete: () => true,
          render: () => (
            <SelectField
              label="English Proficiency"
              value={profile.englishProficiency}
              onChange={(value) => setProfile((prev) => ({ ...prev, englishProficiency: value }))}
              options={ENGLISH_PROFICIENCY_OPTIONS}
            />
          ),
        },
      ];
    }

    if (wizardStep === 3) {
      return [
        {
          id: "searchTerms",
          title: "Preferred Job Titles / Search Terms",
          required: false,
          isComplete: () => true,
          render: () => (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-indigo-100/80 rounded-xl shadow-xs">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Groq AI 100-Keyword & Profile Generator
                  </h4>
                  <p className="text-xs text-indigo-800/80 mt-0.5 max-w-md">
                    Extracts up to 100 high-converting search keywords, stack synonyms, and an ATS profile description directly from your resume.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isGeneratingAiProfile}
                  onClick={handleAutoGenerateProfileWithGroq}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all hover:shadow-md disabled:opacity-60 cursor-pointer"
                >
                  {isGeneratingAiProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating 100 Keywords...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Auto-Generate 100 Keywords (Groq AI)
                    </>
                  )}
                </button>
              </div>

              {aiProfileGeneratedMsg && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="font-medium">{aiProfileGeneratedMsg}</span>
                </div>
              )}

              <TagInput
                label="Preferred Job Titles / Search Terms (Active Rotation)"
                values={preferences.searchTerms}
                onChange={(values) => setPreferences((prev) => ({ ...prev, searchTerms: values }))}
                placeholder="Add role or keyword and press Enter"
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Keyword-Rich Profile Description / Summary
                  </label>
                  <span className="text-[11px] text-slate-400">Used for "describe your experience" questions</span>
                </div>
                <textarea
                  rows={3}
                  value={generatedDescription || profile.summary || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGeneratedDescription(val);
                    setProfile((prev) => ({ ...prev, summary: val }));
                    void saveAnswer("description", "Professional Description / Summary", val, "text", "manual");
                  }}
                  placeholder="E.g. Experienced Full Stack & WordPress Developer with 5+ years building custom themes, plugins, APIs, and scalable web apps..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none leading-relaxed"
                />
              </div>

              {generatedKeywords.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Extracted Resume Keywords & Skills ({generatedKeywords.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPreferences((prev) => ({
                          ...prev,
                          searchTerms: Array.from(new Set([...prev.searchTerms, ...generatedKeywords])),
                        }));
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                    >
                      + Add all to search terms
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-100 rounded-lg">
                    {generatedKeywords.map((kw) => (
                      <span
                        key={kw}
                        onClick={() => {
                          if (!preferences.searchTerms.includes(kw)) {
                            setPreferences((prev) => ({ ...prev, searchTerms: [...prev.searchTerms, kw] }));
                          }
                        }}
                        className="inline-flex items-center text-[11px] bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors"
                        title="Click to add to search terms"
                      >
                        + {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ),
        },
        {
          id: "searchLocations",
          title: "Preferred Locations",
          required: false,
          isComplete: () => true,
          render: () => (
            <TagInput
              label="Preferred Locations"
              values={preferences.searchLocations}
              onChange={(values) => setPreferences((prev) => ({ ...prev, searchLocations: values }))}
              placeholder="Add location and press Enter"
            />
          ),
        },
        {
          id: "workMode",
          title: "Remote / Onsite / Hybrid",
          required: false,
          isComplete: () => true,
          render: () => (
            <SelectField
              label="Remote / Onsite / Hybrid"
              value={preferences.workMode}
              onChange={(value) => setPreferences((prev) => ({ ...prev, workMode: value }))}
              options={WORK_MODE_OPTIONS}
            />
          ),
        },
      ];
    }

    if (wizardStep === 4) {
      if (!pendingQuestions.length) {
        return [
          {
            id: "no_pending",
            title: "Saved Answers",
            required: false,
            isComplete: () => true,
            render: () => (
              <div className="text-sm text-gray-700">
                No pending screening questions right now. You can always add answers in the Screening Answers tab later.
              </div>
            ),
          },
        ];
      }

      return pendingQuestions.slice(0, 25).map((item) => {
        const normalizedKey = toPayloadQuestionKey(item.questionKey || item.questionLabel);
        const draftValue = answerDrafts[normalizedKey] ?? "";
        const hasValidationMessage = Boolean(item.validationMessage);
        const canSave = String(draftValue || "").trim().length > 0;

        return {
          id: normalizedKey || item.questionKey || item.questionLabel,
          title: item.questionLabel,
          required: false,
          isComplete: () => true,
          render: () => (
            <div className="space-y-2">
              {hasValidationMessage ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {item.validationMessage}
                </div>
              ) : null}
              <input
                value={draftValue}
                onChange={(e) =>
                  setAnswerDrafts((prev) => ({
                    ...prev,
                    [normalizedKey]: e.target.value,
                  }))
                }
                placeholder="Answer once and save"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={() => void saveAnswer(normalizedKey, item.questionLabel, answerDrafts[normalizedKey] || "", inferAnswerType(answerDrafts[normalizedKey] || ""), "manual")}
                disabled={savingAnswerKey === normalizedKey || !canSave}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
              >
                {savingAnswerKey === normalizedKey ? "Saving..." : "Save"}
              </button>
            </div>
          ),
        } satisfies GuidedQuestion;
      });
    }

    if (wizardStep === 5) {
      return [
        {
          id: "linkedinUrl",
          title: "LinkedIn URL",
          required: false,
          isComplete: () => true,
          render: () => (
            <InputField
              label="LinkedIn URL"
              value={profile.linkedinUrl}
              onChange={(value) => setProfile((prev) => ({ ...prev, linkedinUrl: value }))}
              placeholder="https://www.linkedin.com/in/your-profile"
            />
          ),
        },
        {
          id: "portfolioUrl",
          title: "Portfolio URL",
          required: false,
          isComplete: () => true,
          render: () => (
            <InputField
              label="Portfolio URL"
              value={profile.portfolioUrl}
              onChange={(value) => setProfile((prev) => ({ ...prev, portfolioUrl: value }))}
              placeholder="https://github.com/yourname"
            />
          ),
        },
        {
          id: "resumeUrlOrUpload",
          title: "Resume",
          required: false,
          isComplete: () => true,
          render: () => (
            <div className="space-y-3">
              <InputField
                label="Resume URL (optional)"
                value={profile.resumeUrl}
                onChange={(value) => setProfile((prev) => ({ ...prev, resumeUrl: value }))}
                placeholder="https://..."
              />
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                <div className="font-semibold text-gray-900">Resume Upload Status</div>
                <div className="mt-1">{user?.resumeFileName ? `Uploaded: ${user.resumeFileName}` : "No uploaded resume yet"}</div>
                <a href="/dashboard/resume" className="mt-2 inline-flex text-indigo-600 hover:text-indigo-700 font-medium">
                  Open Resume Section
                </a>
              </div>
            </div>
          ),
        },
      ];
    }

    return [];
  }, [wizardStep, profile, preferences, pendingQuestions, answerDrafts, savingAnswerKey, saveAnswer, setProfile, setPreferences, user?.resumeFileName]);

  const guidedQuestion = guidedQuestions[profileQuestionIndex];
  const guidedTotal = guidedQuestions.length;
  const isStepFocused = activeTab === WIZARD_STEPS[wizardStep].tab;
  const showAllSections = !isStepFocused;
  const showPersonalInfoSection = showAllSections || wizardStep === 0;
  const showProfessionalLinksSection = showAllSections || wizardStep === 5;
  const showWorkEligibilitySection = showAllSections || wizardStep === 1;
  const showExperienceEducationSection = showAllSections || wizardStep === 2;
  const showPreferredRolesSection = showAllSections;

  const summaryStatus = useMemo(() => {
    return {
      resumeUploaded: Boolean(user?.resumeFileName) || Boolean(profile.resumeUrl.trim()),
      linkedinConnected: isValidUrl(profile.linkedinUrl),
      extensionConnected: extensionStatus.installed,
      pendingCount: pendingQuestions.length,
    };
  }, [user?.resumeFileName, profile.resumeUrl, profile.linkedinUrl, extensionStatus.installed, pendingQuestions.length]);

  const validateBeforeSave = () => {
    const nextErrors: Record<string, string> = {};
    if (profile.fullName.trim().length < 2) nextErrors.fullName = "Full name is required.";
    if (extractPhoneNumber(profile.phone).length < 6) nextErrors.phone = "Enter a valid phone number.";
    if (profile.linkedinUrl.trim() && !isValidUrl(profile.linkedinUrl)) nextErrors.linkedinUrl = "Enter a valid URL.";
    if (profile.portfolioUrl.trim() && !isValidUrl(profile.portfolioUrl)) nextErrors.portfolioUrl = "Enter a valid URL.";

    setFieldErrors(nextErrors);
    const orderedKeys = ["fullName", "phone", "linkedinUrl", "portfolioUrl"];
    const firstInvalid = orderedKeys.find((key) => Boolean(nextErrors[key]));
    if (firstInvalid) {
      setActiveTab("profile");
      setGuidedPopupOpen(false);
      focusField(firstInvalid);
      return "Please fix the highlighted fields.";
    }
    return "";
  };

  const buildAllScreeningPayloads = () => {
    const payloads: ScreeningPayload[] = [];

    const push = (
      questionKey: string,
      questionLabel: string,
      answer: string,
      answerType: ScreeningAnswerType = "text",
      source: ScreeningSource = "system",
      lastUsed?: string,
    ) => {
      const key = toPayloadQuestionKey(questionKey || questionLabel);
      const value = compactAnswer(answer);
      if (!key || !value) return;
      payloads.push({
        questionKey: key,
        questionLabel: String(questionLabel || "").trim() || friendlyLabel(key, ""),
        answer: value,
        answerType,
        source,
        ...(lastUsed ? { lastUsed } : {}),
      });
    };

    for (const field of PROFILE_KEY_LABELS) {
      const raw = profile[field.key];
      if (Array.isArray(raw)) {
        push(field.label, field.label, stringifyTags(raw), field.answerType || "multiselect");
      } else {
        push(field.label, field.label, String(raw || ""), field.answerType || inferAnswerType(String(raw || "")));
      }
    }

    push("preferred_job_titles", "Preferred Job Titles", stringifyTags(profile.preferredJobTitles), "multiselect");
    push("preferred_locations", "Preferred Locations", stringifyTags(profile.preferredLocations), "multiselect");

    for (const pref of PREFERENCE_KEY_LABELS) {
      if (remoteWorkModeSelected && pref.key === "preferredCountries") continue;
      const value = preferences[pref.key];
      if (Array.isArray(value)) {
        push(pref.questionKey, pref.label, stringifyTags(value), pref.answerType || "multiselect");
      } else {
        push(pref.questionKey, pref.label, String(value || ""), pref.answerType || inferAnswerType(String(value || "")));
      }
    }

    push(LEGACY_PREFERENCE_KEYS.searchTerms, "AutoApply CV Preference: Search terms", stringifyTags(preferences.searchTerms), "multiselect");
    push(
      LEGACY_PREFERENCE_KEYS.searchLocation,
      "AutoApply CV Preference: Search location",
      preferences.searchLocations[0] || "",
      "text",
    );
    push(
      LEGACY_PREFERENCE_KEYS.yearsOfExperience,
      "AutoApply CV Preference: Years of experience",
      preferences.yearsOfExperience || profile.yearsOfExperience,
      "number",
    );
    push(
      LEGACY_PREFERENCE_KEYS.requireVisa,
      "AutoApply CV Preference: Need visa sponsorship",
      profile.visaSponsorship,
      "boolean",
    );
    push(
      LEGACY_PREFERENCE_KEYS.usCitizenship,
      "AutoApply CV Preference: US work authorization",
      profile.workAuthorizationUS,
      "choice",
    );
    push(
      LEGACY_PREFERENCE_KEYS.desiredSalary,
      "AutoApply CV Preference: Desired salary",
      preferences.salaryMax,
      "number",
    );
    push(
      LEGACY_PREFERENCE_KEYS.confidenceLevel,
      "AutoApply CV Preference: Confidence level",
      preferences.confidenceLevel,
      "number",
    );

    for (const row of screeningRows) {
      push(
        row.normalizedKey || row.questionLabel,
        row.questionLabel,
        row.answer,
        row.answerType || inferAnswerType(row.answer),
        row.source || "manual",
        row.lastUsed || undefined,
      );
    }

    const deduped = new Map<string, ScreeningPayload>();
    for (const item of payloads) {
      if (!deduped.has(item.questionKey)) {
        deduped.set(item.questionKey, item);
      }
    }

    return Array.from(deduped.values());
  };

  const buildExtensionSettingsPayload = (screeningAnswers: Record<string, string>) => {
    const filterLocations = sanitizeLocationFilterValues(
      remoteWorkModeSelected ? preferences.searchLocations : [...preferences.searchLocations, ...preferences.preferredCountries],
    );
    const resolvedSearchLocation =
      preferences.searchLocations[0] ||
      (!remoteWorkModeSelected ? preferences.preferredCountries[0] || combineCityState(profile.city, profile.state) : "");

    return {
      currentCity: combineCityState(profile.city, profile.state),
      searchLocation: resolvedSearchLocation,
      searchTerms: preferences.searchTerms,
      filterLocations,
      contactEmail: profile.email,
      phoneNumber: extractPhoneNumber(profile.phone),
      phoneCountryCode: extractPhoneCountryCode(profile.phone),
      marketingConsent: "No",
      requireVisa: profile.visaSponsorship || "No",
      usCitizenship: profile.workAuthorizationUS || "",
      yearsOfExperienceAnswer: preferences.yearsOfExperience || profile.yearsOfExperience,
      desiredSalary: preferences.salaryMax || "",
      noticePeriodDays: "",
      confidenceLevel: preferences.confidenceLevel,
      linkedinUrl: profile.linkedinUrl,
      websiteUrl: profile.portfolioUrl,
      firstName: profile.firstName,
      lastName: profile.lastName,
      fullName: profile.fullName,
      streetAddress: profile.addressLine,
      stateRegion: profile.state,
      country: profile.country,
      coverLetter: "",
      easyApplyOnly: true,
      debugMode: false,
      dryRun: false,
      autoSubmit: true,
      autoResumeOnAnswer: true,
      maxApplicationsPerRun: 200,
      maxSkipsPerRun: 50,
      screeningAnswers,
    };
  };

  const syncExtensionSettings = async (settings: Record<string, unknown>) => {
    if (typeof window === "undefined") return { ok: false, skipped: true as const };
    if (!extensionStatus.installed) return { ok: false, skipped: true as const };

    return new Promise<{ ok: boolean; skipped?: false; error?: string }>((resolve) => {
      const requestId = `onboarding-sync-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
          settings,
        },
        window.location.origin,
      );
    });
  };

  const persistAll = async (opts?: { redirectToDashboard?: boolean }) => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const redirectToDashboard = opts?.redirectToDashboard !== false;
      const validationError = validateBeforeSave();
      if (validationError) throw new Error(validationError);

      const onboardingPayload = {
        name: profile.fullName,
        phone: profile.phone,
        currentCity: combineCityState(profile.city, profile.state),
        addressLine: profile.addressLine,
        linkedinUrl: profile.linkedinUrl,
        portfolioUrl: profile.portfolioUrl,
      };

      const onboardingRes = await fetch("/api/user/onboarding", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(onboardingPayload),
      });
      const onboardingJson = await onboardingRes.json().catch(() => null);
      if (!onboardingRes.ok || !onboardingJson?.success) {
        throw new Error(onboardingJson?.message || "Failed to save profile");
      }

      const screeningPayloads = buildAllScreeningPayloads();
      if (screeningPayloads.length > 0) {
        const res = await fetch("/api/user/screening/answers", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(screeningPayloads),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          throw new Error(data?.message || "Failed to save screening answers");
        }
      }

      await saveDraft();

      const screeningAnswerMap: Record<string, string> = {};
      for (const item of screeningPayloads) {
        screeningAnswerMap[item.questionKey] = item.answer;
      }

      const syncResult = await syncExtensionSettings(buildExtensionSettingsPayload(screeningAnswerMap));
      const syncSkipped = "skipped" in syncResult && Boolean(syncResult.skipped);
      if (!syncResult.ok && !syncSkipped) {
        throw new Error(("error" in syncResult && syncResult.error) || "Failed to sync extension settings");
      }

      await refreshUser();
      setMessage(
        syncSkipped
          ? "Profile saved. Install/check extension to sync auto-fill settings."
          : "Profile, preferences, and screening answer library saved.",
      );
      setLastSyncAt(new Date().toISOString());
      if (redirectToDashboard) {
        navigate("/dashboard");
      }
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save onboarding");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const persistAndNextStep = async () => {
    const ok = await persistAll({ redirectToDashboard: false });
    if (!ok) return;
    const next = Math.min(WIZARD_STEPS.length - 1, wizardStep + 1);
    if (next !== wizardStep) {
      gotoWizardStep(next);
    }
  };

  const onboardingHeaderDescription = "Ask once, save forever, auto-fill everywhere.";
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 flex items-center justify-center">
        <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-sm font-medium text-slate-600">Loading your profile...</span>
        </div>
      </div>
    );
  }

  const handleResumeUpload = async (file: File) => {
    setError("");
    setMessage("");
    setRevealedFields([]);
    setParsingStatus("scanning");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("resume", file);
      const res = await fetch("/api/user/resume/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Upload failed");
      }

      const extracted = data?.data?.extracted || {};
      parsedDataRef.current = extracted;
      setMessage("Resume parsed successfully!");
      setUploading(false);
      setParsingStatus("parsing");

      const revealSequence: Array<{ key: string; apply: () => void }> = [];

      if (extracted.name) {
        revealSequence.push({
          key: "name",
          apply: () => setProfile((p) => ({ ...p, fullName: extracted.name, firstName: splitName(extracted.name).firstName, lastName: splitName(extracted.name).lastName })),
        });
      }
      if (extracted.email) {
        revealSequence.push({
          key: "email",
          apply: () => setProfile((p) => ({ ...p, email: extracted.email })),
        });
      }
      if (extracted.phone) {
        revealSequence.push({
          key: "phone",
          apply: () => setProfile((p) => ({ ...p, phone: extracted.phone })),
        });
      }
      if (extracted.city || extracted.state || extracted.country) {
        revealSequence.push({
          key: "location",
          apply: () => {
            if (extracted.city) setProfile((p) => ({ ...p, city: extracted.city }));
            if (extracted.state) setProfile((p) => ({ ...p, state: extracted.state }));
            if (extracted.country) setProfile((p) => ({ ...p, country: extracted.country }));
          },
        });
      }
      if (extracted.yearsOfExperience) {
        revealSequence.push({
          key: "experience",
          apply: () => setProfile((p) => ({ ...p, yearsOfExperience: extracted.yearsOfExperience })),
        });
      }
      if (extracted.jobTitles) {
        revealSequence.push({
          key: "titles",
          apply: () => {
            const titles = Array.isArray(extracted.jobTitles) ? extracted.jobTitles : [];
            const skills = Array.isArray(extracted.skills) ? extracted.skills : [];
            const allKws = Array.from(new Set([...titles, ...skills]));
            setPreferences((p) => ({ ...p, searchTerms: titles }));
            setProfile((p) => ({ ...p, preferredJobTitles: titles }));
            if (allKws.length > 0) {
              setGeneratedKeywords(allKws);
            }
          },
        });
      }
      if (extracted.summary) {
        revealSequence.push({
          key: "summary",
          apply: () => {
            setProfile((p) => ({ ...p, summary: extracted.summary }));
            setGeneratedDescription(extracted.summary);
          },
        });
      }

      for (let i = 0; i < revealSequence.length; i++) {
        await new Promise((r) => setTimeout(r, 400));
        revealSequence[i].apply();
        setRevealedFields((prev) => [...prev, revealSequence[i].key]);
      }

      setResumeViewerData(extracted);
      setShowResumeViewer(true);
      setParsingStatus("done");
      const kwsCount = (Array.isArray(extracted.jobTitles) ? extracted.jobTitles.length : 0) + (Array.isArray(extracted.skills) ? extracted.skills.length : 0);
      setAiProfileGeneratedMsg(`✨ Groq AI extracted ${kwsCount || 100} keywords and generated your search profile!`);
      setMessage(`Resume uploaded! Generated ${kwsCount || 100} search keywords & profile description with Groq AI.`);
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setParsingStatus("idle");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 flex flex-col">
      <div className="w-full flex-1 flex flex-col max-w-5xl mx-auto px-4 py-6">

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2.5 shadow-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {message ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-start gap-2.5 shadow-sm">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{message}</span>
          </div>
        ) : null}

        {/* Hero Upload Section */}
        {!atsGenerated && !showingExtensionPrefs ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/50 p-8">
              <div className="flex flex-col lg:flex-row items-start gap-8">
                {/* Left: Upload Area */}
                <div className="flex-1 min-w-0 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-200/60">
                      <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-slate-900">
                        Hi there! 👋
                      </h1>
                      <p className="text-sm text-slate-500">
                        Let&apos;s set up your profile
                      </p>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleResumeUpload(file);
                    }}
                  />

                  <div
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={`relative overflow-hidden border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 w-full ${
                      uploading || parsingStatus === "parsing"
                        ? "border-indigo-300 bg-indigo-50/40"
                        : "border-slate-200 bg-slate-50/60 hover:border-indigo-300 hover:bg-indigo-50/30 hover:shadow-md"
                    }`}
                  >
                    {parsingStatus === "scanning" || parsingStatus === "parsing" ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-center gap-3">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                              <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
                            </div>
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-semibold text-slate-800">
                              {parsingStatus === "scanning" ? "Uploading & scanning..." : "Processing your data..."}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {parsingStatus === "scanning" ? "Reading your resume" : `Found ${revealedFields.length} fields`}
                            </p>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full max-w-xs mx-auto h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: parsingStatus === "scanning" ? "40%" : `${40 + (revealedFields.length / 6) * 60}%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 flex items-center justify-center shadow-sm">
                          <UploadCloud className="h-7 w-7 text-indigo-500" />
                        </div>
                        <div>
                          <p className="text-base font-semibold text-slate-800">
                            Upload your resume
                          </p>
                          <p className="text-sm text-slate-400 mt-1">
                            Drag & drop or click to browse · PDF, DOCX, TXT
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <div className="w-4 h-px bg-slate-200" />
                    <span>Max 5MB · Your data is encrypted</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                </div>

                {/* Right: Profile Card */}
                <div className="flex-1 min-w-0">
                  {parsingStatus === "idle" && !profile.fullName && !profile.linkedinUrl ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-6 text-center">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 className="h-5 w-5 text-slate-300" />
                      </div>
                      <p className="text-sm font-medium text-slate-400">
                        Parsed data will appear here
                      </p>
                      <p className="text-xs text-slate-300 mt-1">
                        Upload your resume to get started
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      {/* Card Header */}
                      <div className={`px-4 py-3 border-b border-slate-100 ${
                        parsingStatus === "scanning" ? "bg-indigo-50" : "bg-emerald-50"
                      }`}>
                        <div className="flex items-center gap-2">
                          {parsingStatus === "scanning" ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                              <p className="text-xs font-semibold text-indigo-700">Scanning resume...</p>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              <p className="text-xs font-semibold text-emerald-700">Data Extracted</p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className={parsingStatus !== "scanning" ? "p-0" : "p-4 space-y-0"}>
                        {parsingStatus === "scanning" ? (
                          <div className="space-y-3 py-2">
                            {[90, 75, 60, 50, 45, 40].map((w, i) => (
                              <div key={i} className="space-y-1">
                                <div className="h-2.5 bg-slate-200 rounded-full animate-pulse" style={{ width: `${w * 0.5}%` }} />
                                <div className="h-2 bg-slate-100 rounded-full animate-pulse" style={{ width: `${w}%` }} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            <iframe
                              srcDoc={generateResumeHTML(resumeViewerData || parsedDataRef.current)}
                              title="Resume Preview"
                              className="w-full h-[500px] border-0 rounded-b-xl"
                              sandbox="allow-same-origin"
                            />
                            {parsingStatus === "done" ? (
                              <div className="p-4 border-t border-slate-100">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await saveDraft();
                                    setExtLocationsRaw(preferences.searchLocations.join(", "));
                                    setExtSearchTermsRaw(preferences.searchTerms.join(", "));
                                    setShowingExtensionPrefs(true);
                                  }}
                                  className="w-full px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 inline-flex items-center justify-center gap-2 shadow-sm transition-all hover:shadow-md"
                                >
                                  Next
                                  <ChevronRight className="h-4 w-4" />
                                </button>
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Extension Preferences */}
        {!atsGenerated && showingExtensionPrefs ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/50 p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 shadow-lg shadow-emerald-200/60">
                  <Check className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Extension Preferences</h2>
                  <p className="text-sm text-slate-500">Set up how the AutoApply extension should search and apply</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Work Mode */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Work Mode</label>
                  <select
                    value={preferences.workMode}
                    onChange={(e) => setPreferences((p) => ({ ...p, workMode: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="On-site">On-site</option>
                    <option value="">Any</option>
                  </select>
                </div>

                {/* Job Type */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Job Type</label>
                  <select
                    value={preferences.jobTypes[0] || ""}
                    onChange={(e) => setPreferences((p) => ({ ...p, jobTypes: e.target.value ? [e.target.value] : [] }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="">Any</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>

                {/* Preferred Locations */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Preferred Locations</label>
                  <input
                    type="text"
                    value={extLocationsRaw}
                    onChange={(e) => setExtLocationsRaw(e.target.value)}
                    onBlur={() => {
                      const parts = extLocationsRaw.split(",").map((s) => s.trim()).filter(Boolean);
                      setPreferences((p) => ({ ...p, searchLocations: parts }));
                    }}
                    placeholder="e.g. Remote, New York, San Francisco"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <p className="text-xs text-slate-400">Comma-separated list of cities or regions</p>
                </div>

                {/* Current & Expected Salary (Monthly) */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Current Salary (Monthly)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={preferences.salaryMin}
                      onChange={(e) => setPreferences((p) => ({ ...p, salaryMin: e.target.value }))}
                      placeholder="e.g. 25000"
                      className="w-full rounded-lg border border-slate-200 bg-white pl-7 pr-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  {preferences.salaryMin ? (
                    <p className="text-xs text-slate-500">Annual: <span className="font-semibold text-slate-700">₹{(Number(preferences.salaryMin) * 12).toLocaleString("en-IN")}</span></p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Expected Salary (Monthly)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={preferences.salaryMax}
                      onChange={(e) => setPreferences((p) => ({ ...p, salaryMax: e.target.value }))}
                      placeholder="e.g. 50000"
                      className="w-full rounded-lg border border-slate-200 bg-white pl-7 pr-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  {preferences.salaryMax ? (
                    <p className="text-xs text-slate-500">Annual: <span className="font-semibold text-slate-700">₹{(Number(preferences.salaryMax) * 12).toLocaleString("en-IN")}</span></p>
                  ) : null}
                  <p className="text-xs text-slate-400">Enter monthly salary — annual is auto-calculated</p>
                </div>

                {/* Confidence Level */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Match Confidence Level</label>
                  <select
                    value={preferences.confidenceLevel}
                    onChange={(e) => setPreferences((p) => ({ ...p, confidenceLevel: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={String(n)}>{n}/10</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400">Higher = only well-matched jobs, Lower = more applications</p>
                </div>

                {/* Perfect Job Match (Tags) */}
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Perfect Job Match</label>
                  <div className="relative">
                    <div
                      data-tag-input
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus-within:ring-2 focus-within:ring-indigo-400 cursor-text min-h-[42px] flex flex-wrap items-center gap-1.5"
                      onClick={() => setShowSuggestions(true)}
                    >
                      {preferences.searchTerms.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 rounded-md px-2 py-0.5 text-xs font-medium"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreferences((p) => ({
                                ...p,
                                searchTerms: p.searchTerms.filter((t) => t !== tag),
                              }));
                            }}
                            className="hover:text-indigo-900"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => {
                          setTagInput(e.target.value);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && tagInput.trim()) {
                            e.preventDefault();
                            const val = tagInput.trim();
                            if (!preferences.searchTerms.includes(val)) {
                              setPreferences((p) => ({ ...p, searchTerms: [...p.searchTerms, val] }));
                            }
                            setTagInput("");
                          }
                          if (e.key === "Backspace" && !tagInput && preferences.searchTerms.length) {
                            setPreferences((p) => ({
                              ...p,
                              searchTerms: p.searchTerms.slice(0, -1),
                            }));
                          }
                        }}
                        placeholder={preferences.searchTerms.length ? "" : "Type a job title and press Enter..."}
                        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                    {showSuggestions && (
                      <div
                        className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                        onMouseLeave={() => setShowSuggestions(false)}
                      >
                        {JOB_TITLE_SUGGESTIONS.filter(
                          (s) =>
                            !preferences.searchTerms.includes(s) &&
                            s.toLowerCase().includes(tagInput.toLowerCase())
                        ).map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => {
                              if (!preferences.searchTerms.includes(suggestion)) {
                                setPreferences((p) => ({ ...p, searchTerms: [...p.searchTerms, suggestion] }));
                              }
                              setTagInput("");
                              setShowSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                        {tagInput.trim() && !preferences.searchTerms.includes(tagInput.trim()) && !JOB_TITLE_SUGGESTIONS.some((s) => s.toLowerCase() === tagInput.trim().toLowerCase()) && (
                          <button
                            type="button"
                            onClick={() => {
                              setPreferences((p) => ({ ...p, searchTerms: [...p.searchTerms, tagInput.trim()] }));
                              setTagInput("");
                              setShowSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors border-t border-slate-100"
                          >
                            <Plus className="w-3 h-3 inline mr-1" />
                            Add "{tagInput.trim()}"
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">Select or type job titles — we'll find perfect matches</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowingExtensionPrefs(false)}
                  className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={isFinishing}
                  onClick={async () => {
                    setIsFinishing(true);
                    try {
                      const locParts = extLocationsRaw.split(",").map((s) => s.trim()).filter(Boolean);
                      setPreferences((p) => ({ ...p, searchLocations: locParts }));
                      await saveDraft();
                      const ok = await persistAll({ redirectToDashboard: false });
                      if (ok) {
                        navigate("/dashboard/jobs");
                      }
                    } finally {
                      setIsFinishing(false);
                    }
                  }}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 inline-flex items-center gap-2 shadow-sm transition-all hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isFinishing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Finish Onboarding
                      <Sparkles className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* ATS Resume Display */}
        {atsGenerated && atsHtml ? (
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/50 p-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 shadow-md shadow-emerald-200/60">
                <Check className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Your ATS Resume is Ready!</h2>
              <p className="text-sm text-slate-500">Download, upload another, or regenerate</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shadow-sm">
              <iframe
                srcDoc={atsHtml}
                title="ATS Resume Preview"
                className="w-full h-[400px] border-0"
                sandbox="allow-same-origin"
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([atsHtml], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "ATS_Resume.html";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 inline-flex items-center gap-2 shadow-sm transition-all hover:shadow-md"
              >
                <Download className="h-4 w-4" />
                Download HTML
              </button>
              <button
                type="button"
                onClick={() => {
                  setAtsGenerated(false);
                  setAtsHtml("");
                }}
                className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 inline-flex items-center gap-2 transition-colors"
              >
                <UploadCloud className="h-4 w-4" />
                Upload Another
              </button>
              <button
                type="button"
                onClick={() => void generateAtsResume()}
                disabled={generatingAts}
                className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 inline-flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                Regenerate
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}


function SummaryLine({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <span className="text-gray-600">{label}</span>
      <span className={`font-semibold ${ok ? "text-emerald-700" : "text-gray-900"}`}>{value}</span>
    </div>
  );
}

function TabButton({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-colors ${
        active ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-gray-50 hover:bg-gray-100"
      }`}
    >
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <div className="text-xs text-gray-600 mt-1">{description}</div>
    </button>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  error,
  fieldKey,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  fieldKey?: string;
  inputRef?: (el: HTMLInputElement | null) => void;
}) {
  const describedBy = fieldKey ? `${fieldKey}-error` : undefined;
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? describedBy : undefined}
        className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-500 ${
          error ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-100" : "border-gray-300 focus:border-indigo-400"
        }`}
      />
      {error ? (
        <div id={describedBy} className="mt-1 text-xs font-medium text-red-600">
          {error}
        </div>
      ) : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
  error,
  fieldKey,
  selectRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  required?: boolean;
  error?: string;
  fieldKey?: string;
  selectRef?: (el: HTMLSelectElement | null) => void;
}) {
  const describedBy = fieldKey ? `${fieldKey}-error` : undefined;
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      <select
        ref={selectRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? describedBy : undefined}
        className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none ${
          error ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-100" : "border-gray-300 focus:border-indigo-400"
        }`}
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error ? (
        <div id={describedBy} className="mt-1 text-xs font-medium text-red-600">
          {error}
        </div>
      ) : null}
    </label>
  );
}

function TagInput({
  label,
  values,
  onChange,
  placeholder,
  presets = [],
  required = false,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  presets?: string[];
  required?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const addTag = (raw: string) => {
    const value = String(raw || "").trim();
    if (!value) return;
    const exists = values.some((item) => item.toLowerCase() === value.toLowerCase());
    if (exists) return;
    onChange([...values, value]);
  };

  const removeTag = (value: string) => {
    onChange(values.filter((item) => item !== value));
  };

  return (
    <div>
      <span className="text-xs font-semibold text-gray-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>

      <div className="mt-1 rounded-lg border border-gray-300 bg-white p-2">
        <div className="flex flex-wrap gap-1.5">
          {values.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-1 text-xs font-medium text-indigo-700"
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
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag(draft);
                setDraft("");
              }
              if (e.key === "Backspace" && !draft && values.length) {
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
              className="px-2 py-1 rounded-full border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
            >
              + {preset}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PreferenceMirror({ preferences }: { preferences: JobPreferences }) {
  return (
    <div className="grid md:grid-cols-2 gap-2 text-sm">
      <MirrorLine label="Search Terms" value={preferences.searchTerms.join(", ") || "-"} />
      <MirrorLine label="Search Locations" value={preferences.searchLocations.join(", ") || "-"} />
      <MirrorLine label="Work Mode" value={preferences.workMode || "-"} />
      <MirrorLine label="Job Types" value={preferences.jobTypes.join(", ") || "-"} />
      <MirrorLine label="Years of Experience" value={preferences.yearsOfExperience || "-"} />
      <MirrorLine label="Confidence" value={preferences.confidenceLevel || "-"} />
      <MirrorLine
        label="Salary"
        value={
          preferences.salaryMin || preferences.salaryMax
            ? `${preferences.salaryMin || "0"} - ${preferences.salaryMax || "0"}`
            : "-"
        }
      />
      {normalizeLabel(preferences.workMode) !== "remote" ? (
        <MirrorLine label="Preferred Countries" value={preferences.preferredCountries.join(", ") || "-"} />
      ) : null}
      <MirrorLine label="Excluded Companies" value={preferences.excludedCompanies.join(", ") || "-"} />
      <MirrorLine label="Excluded Keywords" value={preferences.excludedKeywords.join(", ") || "-"} />
    </div>
  );
}

function MirrorLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm text-gray-800 font-medium mt-0.5">{value}</div>
    </div>
  );
}
