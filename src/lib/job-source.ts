import {
  normalizeExtensionProvider,
  type ExtensionProvider,
} from "src/lib/extension-providers";

export function cleanJobText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function asJobRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseLinkedInJobId(value: unknown) {
  const raw = cleanJobText(value);
  if (!raw) return "";
  const directMatch = raw.match(/\/jobs\/view\/(\d+)/i);
  if (directMatch?.[1]) return String(directMatch[1]);
  const currentJobId = raw.match(/[?&]currentJobId=(\d+)/i);
  if (currentJobId?.[1]) return String(currentJobId[1]);
  const queryJobId = raw.match(/[?&]jobId=(\d+)/i);
  if (queryJobId?.[1]) return String(queryJobId[1]);
  return /^\d+$/.test(raw) ? raw : "";
}

export function parseIndeedJobId(value: unknown) {
  const raw = cleanJobText(value);
  if (!raw) return "";
  const jk = raw.match(/[?&](?:jk|vjk)=([a-z0-9_-]+)/i);
  if (jk?.[1]) return String(jk[1]);
  const path = raw.match(/\/viewjob\/?[^?]*[?&](?:jk|vjk)=([a-z0-9_-]+)/i);
  if (path?.[1]) return String(path[1]);
  if (/^[a-z0-9_-]{8,}$/i.test(raw)) return raw;
  return "";
}

/** Naukri job id: the trailing digits of /job-listings-<slug>-<id>, or a bare 9-15 digit id. */
export function parseNaukriJobId(value: unknown) {
  const raw = cleanJobText(value);
  if (!raw) return "";
  const listing = raw.match(/\/job-listings-[^?#]*?-(\d{9,15})(?:[/?#]|$)/i);
  if (listing?.[1]) return String(listing[1]);
  return /^\d{9,15}$/.test(raw) ? raw : "";
}

export function inferJobProvider(
  value: Record<string, unknown> | unknown,
  fallback: ExtensionProvider = "linkedin",
): ExtensionProvider {
  const record = asJobRecord(value);
  const explicit = String(record.provider || record.source || "").trim().toLowerCase();
  if (explicit.includes("indeed")) return "indeed";
  if (explicit.includes("naukri")) return "naukri";
  if (explicit.includes("linkedin")) return "linkedin";

  const urls = [
    cleanJobText(record.jobUrl),
    cleanJobText(record.pageUrl),
    cleanJobText(record.jobId),
    cleanJobText(record.externalJobId),
  ].filter(Boolean);

  if (urls.some((item) => item.includes("indeed."))) return "indeed";
  if (urls.some((item) => item.includes("naukri.com"))) return "naukri";
  if (urls.some((item) => item.includes("linkedin.com"))) return "linkedin";
  if (urls.some((item) => Boolean(parseIndeedJobId(item)))) return "indeed";
  if (urls.some((item) => Boolean(parseLinkedInJobId(item)))) return "linkedin";

  return normalizeExtensionProvider(explicit, fallback);
}

export function parseExternalJobId(value: unknown, provider?: unknown) {
  const normalizedProvider = provider ? normalizeExtensionProvider(provider) : null;
  if (normalizedProvider === "indeed") return parseIndeedJobId(value);
  if (normalizedProvider === "naukri") return parseNaukriJobId(value);
  if (normalizedProvider === "linkedin") return parseLinkedInJobId(value);
  return parseLinkedInJobId(value) || parseIndeedJobId(value);
}

export function buildJobSourceUrl(
  criteriaLike: Record<string, unknown> | undefined,
  fallbackProvider?: unknown,
) {
  const criteria = asJobRecord(criteriaLike);
  const direct = cleanJobText(criteria.jobUrl || criteria.pageUrl);
  const provider = inferJobProvider(criteria, normalizeExtensionProvider(fallbackProvider));
  const externalJobId =
    parseExternalJobId(criteria.jobId, provider) ||
    parseExternalJobId(criteria.externalJobId, provider) ||
    parseExternalJobId(direct, provider);

  if (provider === "indeed") {
    if (direct && direct.includes("indeed.")) return direct;
    if (externalJobId) return `https://www.indeed.com/viewjob?jk=${externalJobId}`;
    return "";
  }

  if (provider === "naukri") {
    if (direct && direct.includes("naukri.com/")) return direct;
    if (externalJobId) return `https://www.naukri.com/job-listings-${externalJobId}`;
    return "";
  }

  if (direct && direct.includes("linkedin.com/jobs/")) return direct;
  if (externalJobId) return `https://www.linkedin.com/jobs/view/${externalJobId}/`;
  return "";
}

export function jobProviderLabel(provider: unknown) {
  const normalized = normalizeExtensionProvider(provider);
  return normalized === "indeed" ? "Indeed" : normalized === "naukri" ? "Naukri" : "LinkedIn";
}
