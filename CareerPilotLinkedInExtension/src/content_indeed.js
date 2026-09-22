const PANEL_ID = "cp-linkedin-copilot-panel";
const TOGGLE_ID = "cp-linkedin-copilot-toggle";
const EXTENSION_PROVIDER = "indeed";
const JOBS_SEARCH_URL = "https://www.indeed.com/jobs";
const SMARTAPPLY_BASE = "https://smartapply.indeed.com";
const PANEL_POLL_MS = 1200;
const CARD_OPEN_DELAY_MS = 1400;
const APPLY_STEP_DELAY_MS = 2500;
const MAX_PAGES_PER_RUN = 12;
const MAX_APPLY_STEPS = 4;

let panelMounted = false;
let engineRunning = false;
let engineToken = 0;
let localProgress = { applied: 0, skipped: 0, failed: 0 };
let processedJobIds = new Set();
let appliedJobIdsCache = new Set();
let currentJobContext = {};
let runSearchTermCursor = 0;
let lastSearchRedirectTimestamp = 0;

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLabel(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Centralized logging utility
function logDetails(level, message, data = null) {
  const logEntry = {
    timestamp: nowIso(),
    level,
    message,
    data,
  };
  console[level](JSON.stringify(logEntry));
}

/**
 * Detect Cloudflare challenge on current page
 * @returns {object|null} - Challenge info or null if not detected
 */
function detectCloudflareChallenge() {
  logDetails("info", "Detecting Cloudflare challenge...");

  const hasChallengeForm = !!document.querySelector(
    '#challenge-form, #cf-challenge-running, #cf-please-wait, .cf-browser-verification'
  );
  const hasChallengeSpinner = !!document.querySelector(
    '[class*="cf-browser"], [id^="cf-"][class*="challenge"], .cf-challenge-body'
  );
  const hasRayIdEl = !!document.querySelector(
    '.ray-id, [data-ray], #cf-error-details'
  );

  const title = document.title || "";
  const isChallengeTitle =
    title === "Just a moment..." ||
    title === "Attention Required! | Cloudflare" ||
    /^Checking your browser/i.test(title);

  if (!hasChallengeForm && !hasChallengeSpinner && !hasRayIdEl && !isChallengeTitle) {
    logDetails("info", "No Cloudflare challenge detected.");
    return null;
  }

  let cfRayId = null;
  const rayEl = document.querySelector('.ray-id, [data-ray]');
  if (rayEl) {
    const m = (rayEl.textContent || "").match(/([a-f0-9]{16,})/i);
    if (m) cfRayId = m[1];
  }
  if (!cfRayId) {
    const m = (document.body?.innerText || "").match(/Ray ID[:\s]+([a-f0-9]{16,})/i);
    if (m) cfRayId = m[1];
  }

  logDetails("warn", "Cloudflare challenge detected", { cfRayId });
  return { cfRayId, hasChallengeForm, hasChallengeSpinner, hasRayIdEl, isChallengeTitle };
}

/**
 * Monitor for Cloudflare challenges and alert background
 */
function startCloudflareMonitoring() {
  const checkInterval = setInterval(() => {
    const challenge = detectCloudflareChallenge();
    if (challenge) {
      console.warn(
        "[CareerPilot] 🚨 Cloudflare Challenge Detected — Ray ID:",
        challenge.cfRayId,
        "| URL:", window.location.href
      );

      // Signal to background script (use callback API to avoid Promise rejection noise)
      try {
        chrome.runtime.sendMessage(
          { type: "CP_CLOUDFLARE_CHALLENGE_DETECTED", payload: challenge },
          (res) => { void chrome.runtime.lastError; void res; }
        );
      } catch (_) { /* extension context may be invalidated */ }

      clearInterval(checkInterval);
    }
  }, 2000);

  // Stop monitoring after 5 minutes
  setTimeout(() => clearInterval(checkInterval), 300000);
}

/**
 * Safely redirect to SmartApply URL with validation
 * @param {string} url - The SmartApply URL to redirect to
 * @returns {boolean} - True if redirect was safe and performed
 */
function safeRedirectToSmartApply(url) {
  if (!url) {
    console.warn("[Indeed Debug] ⚠️ Redirect: URL is empty");
    return false;
  }

  try {
    const urlObj = new URL(url);
    
    // Only allow smartapply.indeed.com domain
    if (!urlObj.hostname.includes("smartapply.indeed.com")) {
      console.error("[Indeed Debug] 🚨 Security: Attempted redirect to non-SmartApply domain:", urlObj.hostname);
      return false;
    }

    // Validate required parameters for SmartApply
    const pathname = urlObj.pathname;
    const params = urlObj.searchParams;
    
    // Check for valid SmartApply paths
    const validPaths = ['/beta/indeedapply/applybyapplyablejobid', '/resume-selection', '/questions'];
    const isValidPath = validPaths.some(path => pathname.includes(path));
    
    if (!isValidPath && !pathname.includes('/beta/')) {
      console.error("[Indeed Debug] 🚨 Security: Invalid SmartApply path:", pathname);
      return false;
    }

    // For applybyapplyablejobid, verify required parameters
    if (pathname.includes('applybyapplyablejobid')) {
      if (!params.has('indeedApplyableJobId') && !params.has('iaUid')) {
        console.error("[Indeed Debug] 🚨 Security: Missing required SmartApply parameters");
        return false;
      }
    }

    // Log safe redirect
    console.log("[Indeed Debug] ✅ Safe redirect to SmartApply:", {
      domain: urlObj.hostname,
      path: pathname,
      hasJobId: params.has('indeedApplyableJobId'),
      hasIaUid: params.has('iaUid'),
    });

    // Perform the redirect
    window.location.href = url;
    return true;

  } catch (error) {
    console.error("[Indeed Debug] 🚨 Redirect validation error:", error?.message || error);
    return false;
  }
}

function parseListSetting(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[,\n;]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueNormalizedValues(value) {
  const seen = new Set();
  const values = [];
  for (const item of parseListSetting(value)) {
    const normalized = normalizeLabel(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    values.push(normalized);
  }
  return values;
}

function textIncludesNormalized(text, target) {
  const left = normalizeLabel(text);
  const right = normalizeLabel(target);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  return left.includes(` ${right} `);
}

function matchesConfiguredValues(text, values) {
  const normalizedValues = uniqueNormalizedValues(values);
  if (!normalizedValues.length) return true;
  return normalizedValues.some((value) => textIncludesNormalized(text, value));
}

function jobTitleFilterMatches(jobTitle, configuredJobTitles) {
  const titles = uniqueNormalizedValues(configuredJobTitles);
  if (!titles.length) return true;
  const targetNorm = normalizeLabel(jobTitle);
  if (!targetNorm) return true;

  const STOP_WORDS = new Set(["and", "or", "in", "the", "of", "to", "for", "with", "a", "an", "at", "by", "from", "on", "senior", "junior", "lead", "staff", "principal", "specialist"]);

  return titles.some((configured) => {
    const configNorm = normalizeLabel(configured);
    if (!configNorm) return true;
    if (targetNorm.includes(configNorm) || configNorm.includes(targetNorm)) return true;

    // Token-based keyword overlap (e.g. "WordPress Developer" vs "WordPress Specialist")
    const configTokens = configNorm.split(/\s+/).filter((t) => t.length > 2 && !STOP_WORDS.has(t));
    const targetTokens = new Set(targetNorm.split(/\s+/).filter((t) => t.length > 2 && !STOP_WORDS.has(t)));

    if (!configTokens.length) return true;

    // Check if any primary keyword matches (e.g. "wordpress", "python", "frontend", "web", "developer", "engineer", "designer")
    return configTokens.some((t) => targetTokens.has(t));
  });
}

function isRemoteLikeValue(value) {
  const normalized = normalizeLabel(value);
  return (
    normalized === "remote" ||
    normalized === "work from home" ||
    normalized === "wfh" ||
    normalized === "anywhere" ||
    normalized === "worldwide"
  );
}

function listHasRemoteValue(values) {
  return parseListSetting(values).some((value) => isRemoteLikeValue(value));
}

function isRemoteOnlyWorkMode(configuredValues) {
  const values = uniqueNormalizedValues(configuredValues);
  if (!values.length) return false;
  const hasRemote = values.includes("remote");
  const hasHybrid = values.includes("hybrid");
  const hasOnSite = values.includes("on site") || values.includes("onsite");
  return hasRemote && !hasHybrid && !hasOnSite;
}

function workModeMatches(text, configuredValues) {
  const values = uniqueNormalizedValues(configuredValues);
  console.log(`[Indeed Debug] 🏢 Work mode check - Configured values:`, values);
  console.log(`[Indeed Debug] 🏢 Work mode check - Job text:`, text);
  
  // If no filters configured, accept all
  if (!values.length) {
    console.log(`[Indeed Debug] ✅ Work mode: No filter configured, accepting`);
    return true;
  }
  
  const normalized = normalizeLabel(text);
  console.log(`[Indeed Debug] 🏢 Work mode check - Normalized:`, normalized);
  
  // If job has no work mode info and all modes are allowed, accept it
  if (!normalized || normalized.length < 5) {
    const hasAllModes = values.includes("on site") && values.includes("remote") && values.includes("hybrid");
    if (hasAllModes) {
      console.log(`[Indeed Debug] ✅ Work mode: No work mode in job, all modes configured, accepting`);
      return true;
    }
  }
  
  const matches = values.some((value) => {
    if (value === "remote") {
      return normalized.includes("remote") || normalized.includes("work from home");
    }
    if (value === "hybrid") {
      return normalized.includes("hybrid");
    }
    if (value === "on site" || value === "onsite") {
      return normalized.includes("on site") || normalized.includes("onsite") || normalized.includes("on-site");
    }
    if (value === "flexible") {
      return normalized.includes("flexible");
    }
    return normalized.includes(value);
  });
  
  console.log(`[Indeed Debug] ${matches ? '✅' : '❌'} Work mode match result: ${matches}`);
  return matches;
}

function extractYearsOfExperience(text) {
  const raw = String(text || "");
  const matches = [...raw.matchAll(/(?:^|\s)(\d{1,2})\s*(?:\+|plus|-|to)?\s*(?:\d{0,2})?\s*years?/gi)];
  if (!matches.length) return 0;
  const values = matches
    .map((match) => Number(match?.[1] || 0))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 40);
  return values.length ? Math.max(...values) : 0;
}

function extractMoneyValues(text) {
  const values = [];
  const matches = String(text || "").matchAll(/\$?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k)?/gi);
  for (const match of matches) {
    const base = Number(String(match?.[1] || "").replace(/,/g, ""));
    if (!Number.isFinite(base) || base <= 0) continue;
    values.push(match?.[2] ? base * 1000 : base);
  }
  return values;
}

function salaryFilterMatches(jobText, salaryFilter) {
  const rawFilter = String(salaryFilter || "").trim();
  if (!rawFilter) return true;
  if (textIncludesNormalized(jobText, rawFilter)) return true;
  const requiredFloor = Math.min(...extractMoneyValues(rawFilter));
  if (!Number.isFinite(requiredFloor)) return false;
  const jobAmounts = extractMoneyValues(jobText);
  if (!jobAmounts.length) return false;
  return Math.max(...jobAmounts) >= requiredFloor;
}

function lowApplicantHintMatches(text) {
  const normalized = normalizeLabel(text);
  return (
    normalized.includes("be among the first 5 applicants") ||
    normalized.includes("be among the first 10 applicants") ||
    normalized.includes("few applicants") ||
    normalized.includes("first applicants")
  );
}

function fairChanceHintMatches(text) {
  const normalized = normalizeLabel(text);
  return (
    normalized.includes("fair chance") ||
    normalized.includes("fair chance employer") ||
    normalized.includes("second chance") ||
    normalized.includes("ban the box") ||
    normalized.includes("justice impacted")
  );
}

function datePostedToIndeedParam(value) {
  const normalized = normalizeLabel(value);
  if (normalized === "past 24 hours") return "1";
  if (normalized === "past week") return "7";
  if (normalized === "past month") return "30";
  return "";
}

function jobTypeToIndeedParam(value) {
  const normalized = normalizeLabel(value);
  if (normalized === "full time" || normalized === "full-time") return "fulltime";
  if (normalized === "part time" || normalized === "part-time") return "parttime";
  if (normalized === "contract") return "contract";
  if (normalized === "internship") return "internship";
  if (normalized === "temporary") return "temporary";
  return "";
}

const ignoredIndeedFilterWarnings = new Set();

async function warnUnsupportedFilters(settings) {
  const warnings = [];
  if (settings?.inYourNetwork) {
    warnings.push("Indeed does not expose 'In your network'; that filter is ignored on Indeed runs.");
  }
  for (const warning of warnings) {
    if (ignoredIndeedFilterWarnings.has(warning)) continue;
    ignoredIndeedFilterWarnings.add(warning);
    await pushLog(warning, "warn");
  }
}

function sendMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: false });
      });
    } catch (error) {
      resolve({ ok: false, error: String(error?.message || error) });
    }
  });
}

function isVisible(element) {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function textFromNode(node) {
  return normalizeText(node?.textContent || "");
}

function extractIndeedJobId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/[?&](?:jk|vjk)=([a-z0-9_-]+)/i);
  if (match?.[1]) return String(match[1]);
  if (/^[a-z0-9_-]{8,}$/i.test(raw)) return raw;
  return "";
}

function getConfiguredIndeedSearchTerms(settings) {
  const userTerms = parseListSetting(settings?.searchTerms);
  if (userTerms.length > 0) return userTerms;
  const jobTitles = parseListSetting(settings?.jobTitles);
  if (jobTitles.length > 0) return jobTitles;
  const keyword = String(settings?.keywords || "").trim();
  if (keyword) return [keyword];
  return [];
}

function getCurrentIndeedSearchKeyword() {
  try {
    const url = new URL(window.location.href);
    return String(url.searchParams.get("q") || "").trim();
  } catch {
    return "";
  }
}

function buildSearchUrl(settings = {}, pageStart = 0, termOverride = "") {
  const params = new URLSearchParams();
  const terms = getConfiguredIndeedSearchTerms(settings);
  const term = termOverride || terms[runSearchTermCursor] || terms[0] || getCurrentIndeedSearchKeyword() || "developer";
  if (term) params.set("q", term);

  const location =
    normalizeText(settings.searchLocation) ||
    normalizeText(parseListSetting(settings.filterLocations)[0] || "");
  if (location && normalizeLabel(location) !== "remote") {
    params.set("l", location);
  }

  const sortBy = normalizeLabel(settings.sortBy);
  if (sortBy === "most recent") {
    params.set("sort", "date");
  }

  const datePosted = datePostedToIndeedParam(settings.datePosted);
  if (datePosted) {
    params.set("fromage", datePosted);
  }

  const jobTypeValues = uniqueNormalizedValues(settings.jobType)
    .map((value) => jobTypeToIndeedParam(value))
    .filter(Boolean);
  if (jobTypeValues.length === 1) {
    params.set("jt", jobTypeValues[0]);
  }

  // If user wants remote-only work mode, request remote jobs directly from Indeed.
  if (isRemoteOnlyWorkMode(settings?.onSite) || listHasRemoteValue(settings?.filterLocations)) {
    params.set("remotejob", "1");
  }

  if (Number(pageStart) > 0) params.set("start", String(pageStart));

  // Use the current page's Indeed hostname (e.g. in.indeed.com) instead of hardcoded www
  let baseUrl = JOBS_SEARCH_URL;
  try {
    const currentHost = window.location.hostname;
    if (currentHost.endsWith("indeed.com") && !currentHost.startsWith("smartapply.")) {
      baseUrl = `https://${currentHost}/jobs`;
    }
  } catch { /* ignore, use fallback */ }

  return `${baseUrl}?${params.toString()}`;
}

async function ensureIndeedSearchTerm(settings) {
  const terms = getConfiguredIndeedSearchTerms(settings);
  if (!terms.length) return true;

  const currentKeyword = getCurrentIndeedSearchKeyword();
  const currentNorm = normalizeLabel(currentKeyword);

  // If current page keyword matches any of the configured terms, align cursor
  if (currentNorm) {
    const matchingIndex = terms.findIndex((t) => normalizeLabel(t) === currentNorm);
    if (matchingIndex >= 0) {
      runSearchTermCursor = matchingIndex;
      return true;
    }
  }

  if (runSearchTermCursor < 0 || runSearchTermCursor >= terms.length) {
    runSearchTermCursor = 0;
  }
  const selected = terms[runSearchTermCursor];
  if (currentNorm === normalizeLabel(selected)) return true;

  const now = Date.now();
  if (now - lastSearchRedirectTimestamp < 4000) {
    return true;
  }
  lastSearchRedirectTimestamp = now;

  await pushLog(`Navigating to configured search keyword: "${selected}"`, "info");
  window.location.href = buildSearchUrl(settings, 0, selected);
  return false;
}

async function rotateIndeedSearchTerm(settings) {
  const terms = getConfiguredIndeedSearchTerms(settings);
  if (terms.length <= 1) return false;
  runSearchTermCursor = (runSearchTermCursor + 1) % terms.length;
  const nextTerm = terms[runSearchTermCursor];
  lastSearchRedirectTimestamp = Date.now();
  await pushLog(`Switching to next configured search keyword: "${nextTerm}"`, "info");
  window.location.href = buildSearchUrl(settings, 0, nextTerm);
  return true;
}

function isJobsPage() {
  try {
    const url = new URL(window.location.href);
    return (
      url.hostname.endsWith("indeed.com") &&
      !url.hostname.startsWith("smartapply.") &&
      (url.pathname.startsWith("/jobs") || url.pathname.startsWith("/viewjob"))
    );
  } catch {
    return false;
  }
}

function isIndeedUserLoggedIn() {
  const profileSelectors = [
    "[data-gnav-element-name='Profile']",
    "[data-gnav-element-name='user-menu']",
    "[data-gnav-element-name='AccountMenu']",
    "a[href*='/account']",
    "a[href*='/myjobs']",
    "button[aria-label*='Account' i]",
    "button[aria-label*='profile' i]",
    ".gnav-AccountMenu",
    "[data-testid='AccountMenu']",
    "[data-testid='gnav-AccountMenu']",
    "#gnav-AccountMenu"
  ];
  return Boolean(document.querySelector(profileSelectors.join(",")));
}

async function handleIndeedAuthPage() {
  const isAuth =
    window.location.hostname.includes("secure.indeed.com") ||
    window.location.pathname.includes("/account/login") ||
    window.location.pathname.includes("/account/auth");
  if (!isAuth) return;

  const settings = await loadSettings();
  const userEmail = String(settings.contactEmail || settings.email || "").trim();
  if (!userEmail) return;

  const emailInput = document.querySelector("input[type='email'], input[name='__email'], input#ifl-InputFormField-3, input[id*='email' i]");
  if (emailInput && isVisible(emailInput) && !emailInput.value) {
    emailInput.focus();
    emailInput.value = userEmail;
    emailInput.dispatchEvent(new Event("input", { bubbles: true }));
    emailInput.dispatchEvent(new Event("change", { bubbles: true }));
    console.log("[Indeed Auth] Auto-filled Indeed login email:", userEmail);
    await pushLog(`Auto-filled Indeed sign-in email: ${userEmail}`, "info");
  }
}

function shouldMountIndeedPanel() {
  const hash = (window.location.hash || "").toLowerCase();
  if (hash.includes("autoapply-module=indeed") || hash.includes("module=indeed")) {
    return true;
  }
  if (
    hash.includes("autoapply-module=linkedin") ||
    hash.includes("autoapply-module=whatsapp") ||
    hash.includes("autoapply-module=email") ||
    hash.includes("autoapply-module=commenter")
  ) {
    return false;
  }
  return true;
}

let panelActiveTab = "feed";

const ICONS = {
  sparkle: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
  target: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  search: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  bolt: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  file: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`,
  edit: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`,
  clock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  alert: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  rocket: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`,
  skip: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`,
  coin: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  play: `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  pause: `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
  stop: `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`,
  activity: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  trash: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  list: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`
};

async function botChat(message, level = "info") {
  await pushLog(message, level);
}

async function userChat(message) {
  await pushLog(message, "user");
}

async function handleChatCommand(input) {
  const raw = String(input || "").trim();
  if (!raw) return;
  await userChat(raw);
  const cmd = normalizeLabel(raw);

  if (cmd === "start live" || cmd === "live start" || cmd === "/live") {
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { autoSubmit: true, dryRun: false } });
    await sendMessage({ type: "CP_START", forceRestart: false });
    await botChat("Indeed run started. Live auto-submit is ON.", "warn");
    return;
  }
  if (cmd === "start" || cmd === "/start") {
    const settings = await loadSettings();
    if (settings?.dryRun) {
      await botChat("Dry-run is ON: form fields will be filled without submitting.", "warn");
    }
    await sendMessage({ type: "CP_START", forceRestart: false });
    await botChat("Indeed run started. AI Copilot is scanning for jobs...");
    return;
  }
  if (cmd === "pause" || cmd === "/pause") {
    await sendMessage({ type: "CP_PAUSE" });
    await botChat("Run paused. Indeed Copilot standing by.");
    return;
  }
  if (cmd === "resume" || cmd === "/resume") {
    await sendMessage({ type: "CP_RESUME" });
    await botChat("Run resumed. Indeed Copilot back to work.");
    return;
  }
  if (cmd === "stop" || cmd === "/stop") {
    await sendMessage({ type: "CP_STOP" });
    await botChat("Run stopped. Indeed Copilot offline.");
    return;
  }
  if (cmd === "dry run on") {
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { dryRun: true, autoSubmit: false } });
    await botChat("Dry run mode enabled.");
    return;
  }
  if (cmd === "dry run off" || cmd === "auto submit on") {
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { dryRun: false, autoSubmit: true } });
    await botChat("Live auto-submit mode enabled.", "warn");
    return;
  }
  if (cmd === "clear logs") {
    await sendMessage({ type: "CP_CLEAR_LOGS" });
    localProgress = { applied: 0, skipped: 0, failed: 0 };
    await botChat("Logs cleared and counters reset.");
    return;
  }
  await botChat("Available commands: start, start live, pause, resume, stop, dry run on/off, clear logs", "warn");
}

function getPanelElements() {
  return {
    panel: document.getElementById(PANEL_ID),
    toggle: document.getElementById(TOGGLE_ID),
    statusBadge: document.getElementById("cp-status-badge"),
    title: document.getElementById("cp-now-title"),
    jobTitle: document.getElementById("cp-now-job-title"),
    detail: document.getElementById("cp-now-detail"),
    applied: document.getElementById("cp-stat-applied"),
    skipped: document.getElementById("cp-stat-skipped"),
    failed: document.getElementById("cp-stat-failed"),
    logs: document.getElementById("cp-log"),
    start: document.getElementById("cp-start"),
    pause: document.getElementById("cp-pause"),
    stop: document.getElementById("cp-stop"),
    autoSubmitToggle: document.getElementById("cp-auto-submit-toggle"),
    runModeChip: document.getElementById("cp-run-mode-chip"),
    indeedAuthStatus: document.getElementById("cp-indeed-auth-status"),
    walletText: document.getElementById("cp-wallet-text"),
    tabFeed: document.getElementById("cp-tab-feed"),
    tabDebug: document.getElementById("cp-tab-debug"),
    tabLogs: document.getElementById("cp-tab-logs"),
    chatInput: document.getElementById("cp-chat-input"),
    chatSend: document.getElementById("cp-chat-send"),
    clearLogs: document.getElementById("cp-clear-logs"),
    minimize: document.getElementById("cp-minimize"),
    maximize: document.getElementById("cp-maximize"),
  };
}

function ensurePanel() {
  if (panelMounted) return;
  if (!shouldMountIndeedPanel()) return;
  if (document.getElementById(PANEL_ID) || document.getElementById(TOGGLE_ID)) {
    panelMounted = true;
    return;
  }

  createPanelDOM();
}

function removePanel() {
  const panel = document.getElementById(PANEL_ID);
  const toggle = document.getElementById(TOGGLE_ID);
  if (panel) panel.remove();
  if (toggle) toggle.remove();
  panelMounted = false;
}

function createPanelDOM() {
  if (panelMounted) return;
  if (document.getElementById(PANEL_ID) || document.getElementById(TOGGLE_ID)) {
    panelMounted = true;
    return;
  }

  const toggle = document.createElement("button");
  toggle.id = TOGGLE_ID;
  toggle.type = "button";
  toggle.title = "AutoApply CV Indeed Copilot";
  try {
    const img = document.createElement("img");
    img.src = chrome.runtime.getURL("icons/icon32.png");
    img.alt = "";
    img.width = 26;
    img.height = 26;
    img.style.display = "block";
    img.style.margin = "0 auto";
    img.style.borderRadius = "10px";
    toggle.appendChild(img);
  } catch {
    toggle.textContent = "CP";
  }

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="cp-head">
      <div class="cp-brand">
        <div class="cp-orb">
          <img class="cp-orb-img" src="${chrome.runtime.getURL("icons/icon48.png")}" alt="AutoApply CV" />
        </div>
        <div>
          <div class="cp-title">AutoApply CV <span class="cp-ai-sparkle">${ICONS.sparkle}</span></div>
          <div class="cp-sub">Indeed Application Assistant</div>
        </div>
      </div>
      <div class="cp-head-right">
        <div class="cp-badge" id="cp-status-badge">Idle</div>
        <div class="cp-window-actions">
          <button id="cp-clear-logs" class="cp-icon-btn" title="Clear logs & reset counters">${ICONS.trash}</button>
          <button id="cp-minimize" title="Minimize">–</button>
          <button id="cp-maximize" title="Maximize">+</button>
        </div>
      </div>
    </div>

    <!-- Indeed Account Status Card -->
    <div id="cp-indeed-auth-card" class="cp-auth-card">
      <div id="cp-indeed-auth-status" style="display: flex; align-items: center; gap: 6px; font-weight: 600; color: #1e293b;">
        <span class="cp-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; display: inline-block;"></span>
        <span>Indeed: Checking...</span>
      </div>
      <a id="cp-indeed-auth-link" href="https://secure.indeed.com/auth" target="_blank">Sign In</a>
    </div>

    <!-- Hero AI Action Center -->
    <div class="cp-hero" id="cp-now-card">
      <div class="cp-hero-header">
        <div class="cp-hero-status-pulse"></div>
        <span class="cp-hero-status-title" id="cp-now-title">AI Copilot Ready</span>
      </div>
      <div class="cp-hero-job-title" id="cp-now-job-title">Standing by on Indeed</div>
      <div class="cp-hero-job-sub" id="cp-now-detail">Press Start or toggle Live Auto Submit</div>
      <div class="cp-hero-metrics">
        <div class="cp-metric-pill" id="cp-applied-pill">
          <span class="cp-icon-success">${ICONS.rocket}</span>
          <span class="cp-metric-val" id="cp-stat-applied">0</span> applied
        </div>
        <div class="cp-metric-pill" id="cp-skipped-pill">
          <span class="cp-icon-warning">${ICONS.skip}</span>
          <span class="cp-metric-val" id="cp-stat-skipped">0</span> skipped
        </div>
        <div class="cp-metric-pill cp-metric-quota" id="cp-wallet">
          <span class="cp-icon-primary">${ICONS.coin}</span>
          <span id="cp-wallet-text">Quota Active</span>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="cp-controls">
      <div class="cp-run-mode">
        <label class="cp-run-mode-toggle" for="cp-auto-submit-toggle">
          <input id="cp-auto-submit-toggle" type="checkbox" />
          <span class="cp-switch-ui" aria-hidden="true"></span>
          <span class="cp-run-mode-label">Live Auto Submit</span>
        </label>
        <span class="cp-run-mode-chip" id="cp-run-mode-chip">Dry Run</span>
      </div>
      <div class="cp-quick">
        <button id="cp-start" class="cp-btn-start">${ICONS.play} <span>Start</span></button>
        <button id="cp-pause" class="cp-btn-pause">${ICONS.pause} <span>Pause</span></button>
        <button id="cp-stop" class="cp-btn-stop">${ICONS.stop} <span>Stop</span></button>
      </div>
    </div>

    <!-- Tab Bar -->
    <div class="cp-tab-bar">
      <button id="cp-tab-feed" class="cp-tab cp-active">${ICONS.sparkle} <span>Activity</span></button>
      <button id="cp-tab-debug" class="cp-tab">${ICONS.activity} <span>Decision Chain</span></button>
      <button id="cp-tab-logs" class="cp-tab">${ICONS.list} <span>Logs</span></button>
    </div>

    <!-- Log / Feed Stream -->
    <div id="cp-log" class="cp-log" aria-live="polite"></div>

    <!-- Composer Bar -->
    <div class="cp-composer">
      <input id="cp-chat-input" type="text" placeholder="Type a command (e.g. start, pause, resume)..." />
      <button id="cp-chat-send">Send</button>
    </div>
  `;

  document.documentElement.appendChild(toggle);
  document.documentElement.appendChild(panel);

  toggle.addEventListener("click", () => {
    panel.classList.toggle("cp-hidden");
  });

  const els = getPanelElements();
  els.start?.addEventListener("click", async () => {
    await sendMessage({ type: "CP_START", forceRestart: false });
    if (!isJobsPage()) {
      window.location.href = buildSearchUrl(await loadSettings());
      return;
    }
    const state = await chrome.storage.local.get("cpState").catch(() => ({}));
    const isResuming = state?.cpState?.paused;
    const message = isResuming ? "Copilot: Resuming from pause..." : "Copilot: Run started on Indeed.";
    await sendMessage({ type: "CP_LOG", level: "info", message });
  });
  els.pause?.addEventListener("click", async () => {
    await sendMessage({ type: "CP_PAUSE" });
  });
  els.stop?.addEventListener("click", async () => {
    await sendMessage({ type: "CP_STOP" });
  });

  els.autoSubmitToggle?.addEventListener("change", async (e) => {
    const isLive = e.target.checked;
    await sendMessage({
      type: "CP_SAVE_SETTINGS",
      settings: { autoSubmit: isLive, dryRun: !isLive }
    });
    if (els.runModeChip) {
      els.runModeChip.textContent = isLive ? "Live Submit" : "Dry Run";
      els.runModeChip.className = `cp-run-mode-chip ${isLive ? "cp-live" : "cp-dry"}`;
    }
  });

  // Tab switching
  const setTab = (tab) => {
    panelActiveTab = tab;
    els.tabFeed?.classList.toggle("cp-active", tab === "feed");
    els.tabDebug?.classList.toggle("cp-active", tab === "debug");
    els.tabLogs?.classList.toggle("cp-active", tab === "logs");
    chrome.storage.local.get("cpState", (data) => {
      renderLogs(data?.cpState?.logs || []);
    });
  };
  els.tabFeed?.addEventListener("click", () => setTab("feed"));
  els.tabDebug?.addEventListener("click", () => setTab("debug"));
  els.tabLogs?.addEventListener("click", () => setTab("logs"));

  // Chat send
  const doSendChat = async () => {
    const text = els.chatInput?.value?.trim();
    if (!text) return;
    els.chatInput.value = "";
    await handleChatCommand(text);
  };
  els.chatSend?.addEventListener("click", doSendChat);
  els.chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSendChat();
  });

  // Window actions
  els.clearLogs?.addEventListener("click", async () => {
    await sendMessage({ type: "CP_CLEAR_LOGS" });
    localProgress = { applied: 0, skipped: 0, failed: 0 };
    if (els.applied) els.applied.textContent = "0";
    if (els.skipped) els.skipped.textContent = "0";
    if (els.failed) els.failed.textContent = "0";
    renderLogs([]);
  });

  els.minimize?.addEventListener("click", () => {
    panel.classList.toggle("cp-minimized");
  });

  els.maximize?.addEventListener("click", () => {
    panel.classList.toggle("cp-maximized");
  });

  panelMounted = true;
}

let lastLogRenderSignature = "";

function formatAiFeedCard(entry) {
  const rawMsg = normalizeText(entry?.message || "");
  const norm = normalizeLabel(rawMsg);
  const ts = normalizeText(entry?.ts || "");
  const timeStr = ts ? new Date(ts).toLocaleTimeString() : "";
  const level = normalizeLabel(entry?.level || "info");

  let icon = ICONS.sparkle;
  let cardClass = "";
  let formattedHtml = rawMsg;

  if (norm.startsWith("opening") || norm.startsWith("targeting")) {
    icon = ICONS.target;
    formattedHtml = `Opening: <strong>${rawMsg.replace(/^(?:opening|targeting):?\s*/i, "")}</strong>`;
  } else if (norm.includes("matching description") || norm.includes("analyzing requirements") || norm.startsWith("reading job details")) {
    icon = ICONS.search;
    formattedHtml = `Matching description with profile for: <strong>${rawMsg.replace(/^(?:matching description with profile for|analyzing requirements & matching description with profile for|analyzing requirements for|reading job details for):?\s*"?/i, "").replace(/"?\.\.\.$/, "")}</strong>`;
  } else if (norm.includes("profile match verified") || norm.includes("match verified")) {
    icon = ICONS.bolt;
    cardClass = "cp-submitted";
    formattedHtml = `<strong>Profile Match Verified!</strong> Found Easy Apply`;
  } else if (norm.startsWith("applying") || norm.includes("filling application")) {
    icon = ICONS.rocket;
    formattedHtml = `Applying: <strong>${rawMsg.replace(/^applying:?\s*/i, "")}</strong>`;
  } else if (norm.includes("application submitted") || norm.includes("submitted successfully")) {
    icon = ICONS.check;
    cardClass = "cp-submitted";
    formattedHtml = `<strong>Application Submitted Successfully!</strong>`;
  } else if (norm.startsWith("skipped")) {
    icon = ICONS.skip;
    cardClass = "cp-skipped";
    formattedHtml = `Skipped: <strong>${rawMsg.replace(/^skipped:?\s*/i, "")}</strong>`;
  } else if (level === "error" || norm.includes("fail")) {
    icon = ICONS.alert;
    cardClass = "cp-error";
  } else if (level === "warn") {
    icon = ICONS.alert;
  }

  return `
    <div class="cp-ai-card ${cardClass}">
      <span class="cp-ai-icon">${icon}</span>
      <div class="cp-ai-text">${formattedHtml}</div>
      <span class="cp-ai-time">${timeStr}</span>
    </div>
  `;
}

function deriveNowCard(state, logs) {
  const entries = Array.isArray(logs) ? logs : [];

  // Find the most recent job-related log entry by scanning backwards
  let jobEntry = null;
  for (let i = entries.length - 1; i >= 0; i--) {
    const m = normalizeLabel(entries[i]?.message || "");
    if (
      m.startsWith("opening") ||
      m.startsWith("targeting") ||
      m.includes("matching description") ||
      m.includes("profile match verified") ||
      m.startsWith("applying") ||
      m.includes("application submitted") ||
      m.startsWith("skipped")
    ) {
      jobEntry = entries[i];
      break;
    }
  }

  const activeMsg = normalizeText(jobEntry?.message || entries[entries.length - 1]?.message || "");
  const norm = normalizeLabel(activeMsg);

  let title = "AI Copilot Ready";
  let jobTitle = currentJobContext.title || "Standing by on Indeed";
  let detail = "Click Start or toggle Live Auto Submit";

  if (state.paused) {
    title = "Paused";
    jobTitle = currentJobContext.title || "Indeed Copilot Paused";
    detail = "Awaiting your resume command or answers.";
  } else if (state.running) {
    title = "AI Copilot Active";
    if (norm.startsWith("opening") || norm.startsWith("targeting")) {
      const extractedTitle = activeMsg.replace(/^(?:opening|targeting):?\s*/i, "").replace(/\s*\([^)]*\)$/, "");
      jobTitle = currentJobContext.title || extractedTitle || "Targeting Opportunity";
      detail = "Opening card & inspecting qualifications...";
    } else if (norm.includes("matching description") || norm.includes("analyzing requirements") || norm.includes("reading job details")) {
      jobTitle = currentJobContext.title || "Matching Profile";
      detail = "Comparing job requirements with your skills & experience...";
    } else if (norm.includes("profile match verified") || norm.includes("match verified")) {
      jobTitle = currentJobContext.title ? `Verified: ${currentJobContext.title}` : "Profile Match Verified";
      detail = "Found Easy Apply! Preparing application form...";
    } else if (norm.startsWith("applying") || norm.includes("filling application")) {
      jobTitle = currentJobContext.title ? `Applying: ${currentJobContext.title}` : "Applying to Role";
      detail = "Smart-answering screening questions & submitting...";
    } else if (norm.includes("application submitted")) {
      jobTitle = currentJobContext.title || "Application Submitted";
      detail = "Submitted successfully! Moving to next job.";
    } else if (norm.startsWith("skipped")) {
      jobTitle = currentJobContext.title || "Skipped Position";
      detail = activeMsg || "Scanning next opportunity...";
    } else {
      jobTitle = currentJobContext.title || "Scanning Opportunities";
      detail = activeMsg || "Working through visible jobs on Indeed...";
    }
  }

  return { title, jobTitle, detail };
}

function renderLogs(logs) {
  const container = getPanelElements().logs;
  if (!container) return;
  const items = Array.isArray(logs) ? logs.slice(-20) : [];

  const lastItem = items.length ? items[items.length - 1] : null;
  const signature = `${panelActiveTab}_${items.length}_${lastItem?.ts || ""}_${lastItem?.message || ""}_${lastItem?.level || ""}`;
  if (signature === lastLogRenderSignature) {
    return;
  }
  lastLogRenderSignature = signature;

  if (panelActiveTab === "feed") {
    container.innerHTML = items.map((entry) => formatAiFeedCard(entry)).join("");
  } else if (panelActiveTab === "debug") {
    container.innerHTML = items
      .map((entry) => {
        const kind = normalizeLabel(entry?.level || "info");
        const message = normalizeText(entry?.message || "");
        const ts = normalizeText(entry?.ts || "");
        const timeStr = ts ? new Date(ts).toLocaleTimeString() : "";
        const badgeClass = kind === "success" ? "cp-diag-success" : kind === "warn" ? "cp-diag-warn" : kind === "error" ? "cp-diag-error" : "cp-diag-muted";

        return `
          <div class="cp-diag-card ${badgeClass}">
            <div class="cp-diag-head">
              <span class="cp-diag-badge">${kind.toUpperCase()}</span>
              <span class="cp-diag-time">${timeStr}</span>
            </div>
            <div class="cp-diag-body">
              <span class="cp-diag-icon">${ICONS.activity}</span>
              <span class="cp-diag-msg">${message || "-"}</span>
            </div>
          </div>
        `;
      })
      .join("");
  } else {
    // Raw logs
    container.innerHTML = items
      .map((entry) => {
        const kind = normalizeLabel(entry?.level || "info");
        const message = normalizeText(entry?.message || "");
        const ts = normalizeText(entry?.ts || "");
        return `
          <div class="cp-line cp-${kind}">
            <div class="cp-bubble">
              <div class="cp-msg-head">
                <span class="cp-sender">${kind === "user" ? "You" : "Indeed Copilot"}</span>
                <span class="cp-time">${ts ? new Date(ts).toLocaleTimeString() : ""}</span>
              </div>
              <div class="cp-msg-text">${message || "-"}</div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  container.scrollTop = container.scrollHeight;
}

function updatePanel(state, settings) {
  ensurePanel();
  const els = getPanelElements();
  if (!els.panel) return;

  const running = Boolean(state?.running);
  const paused = Boolean(state?.paused) && !running;
  const applied = Math.max(0, Number(state?.applied || localProgress.applied || 0));
  const skipped = Math.max(0, Number(state?.skipped || localProgress.skipped || 0));
  const failed = Math.max(0, Number(state?.failed || localProgress.failed || 0));

  // Update Indeed login indicator
  if (els.indeedAuthStatus) {
    const loggedIn = isIndeedUserLoggedIn();
    const linkEl = document.getElementById("cp-indeed-auth-link");
    if (loggedIn) {
      els.indeedAuthStatus.innerHTML = `<span class="cp-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block;"></span><span style="color: #059669; font-weight: 700;">Indeed: Logged In</span>`;
      if (linkEl) linkEl.style.display = "none";
    } else {
      els.indeedAuthStatus.innerHTML = `<span class="cp-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; display: inline-block;"></span><span style="color: #d97706; font-weight: 700;">Indeed: Not Logged In</span>`;
      if (linkEl) {
        linkEl.style.display = "inline-block";
        linkEl.textContent = "Sign In";
      }
    }
  }

  if (els.statusBadge) {
    els.statusBadge.textContent = running ? "Running" : paused ? "Paused" : "Idle";
    els.statusBadge.className = `cp-badge ${running ? "cp-run" : paused ? "cp-pause" : ""}`.trim();
  }

  const nowCard = deriveNowCard(state, state?.logs);
  if (els.title) {
    els.title.textContent = nowCard.title;
  }
  if (els.jobTitle) {
    els.jobTitle.textContent = nowCard.jobTitle;
  }
  if (els.detail) {
    els.detail.textContent = nowCard.detail;
  }
  if (els.applied) els.applied.textContent = String(applied);
  if (els.skipped) els.skipped.textContent = String(skipped);
  if (els.failed) els.failed.textContent = String(failed);

  const isLive = Boolean(settings?.autoSubmit) && !Boolean(settings?.dryRun);
  if (els.autoSubmitToggle) {
    els.autoSubmitToggle.checked = isLive;
  }
  if (els.runModeChip) {
    els.runModeChip.textContent = isLive ? "Live Submit" : "Dry Run";
    els.runModeChip.className = `cp-run-mode-chip ${isLive ? "cp-live" : "cp-dry"}`;
  }

  renderLogs(state?.logs);
}

async function loadSettings() {
  const result = await sendMessage({ type: "CP_LOAD_SETTINGS" });
  return result?.ok ? result.settings || {} : {};
}

async function pushLog(message, level = "info", meta = null) {
  await sendMessage({
    type: "CP_LOG",
    level,
    message,
    meta,
  });
}

async function reportProgress() {
  const response = await sendMessage({
    type: "CP_PROGRESS",
    applied: localProgress.applied,
    skipped: localProgress.skipped,
    failed: localProgress.failed,
  });
  if (!response?.ok && response?.errorCode === "DAILY_CAP_REACHED") {
    await sendMessage({ type: "CP_PAUSE" });
  }
}

async function recordOutcome(outcomeType, data = {}) {
  await sendMessage({
    type: "CP_RECORD_OUTCOME",
    outcomeType,
    data: {
      ...data,
      provider: EXTENSION_PROVIDER,
      pageUrl: window.location.href,
    },
  });

  if (outcomeType === "APPLIED") localProgress.applied += 1;
  else if (outcomeType === "FAILED") localProgress.failed += 1;
  else localProgress.skipped += 1;

  await reportProgress();
}

async function refreshAppliedIdsCache() {
  const result = await sendMessage({ type: "CP_GET_APPLIED_JOB_IDS", limit: 8000 });
  if (!result?.ok || !Array.isArray(result.jobIds)) return;
  appliedJobIdsCache = new Set(result.jobIds.map((value) => String(value || "").trim()).filter(Boolean));
}

function queryAllVisible(selectors) {
  return selectors
    .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
    .filter((node) => node instanceof HTMLElement && isVisible(node));
}

function getJobCards() {
  const anchors = Array.from(
    document.querySelectorAll(
      'a[href*="/viewjob?jk="], a[href*="/rc/clk?jk="], a[data-jk], [data-jk] a',
    ),
  );
  const seen = new Set();
  const cards = [];
  for (const anchor of anchors) {
    const jobId =
      extractIndeedJobId(anchor.getAttribute("href")) ||
      extractIndeedJobId(anchor.getAttribute("data-jk")) ||
      extractIndeedJobId(anchor.closest("[data-jk]")?.getAttribute("data-jk"));
    if (!jobId || seen.has(jobId)) continue;
    seen.add(jobId);
    cards.push(anchor.closest("[data-jk], [data-testid='slider_item'], .job_seen_beacon, .result, .tapItem") || anchor);
  }
  return cards.filter(Boolean);
}

function getCardAnchor(card) {
  if (card instanceof HTMLAnchorElement) return card;
  return (
    card?.querySelector('a[href*="/viewjob?jk="], a[href*="/rc/clk?jk="], a[data-jk]') ||
    null
  );
}

function extractCardSnapshot(card) {
  const anchor = getCardAnchor(card);
  const href = anchor?.href || "";
  const jobId =
    extractIndeedJobId(href) ||
    extractIndeedJobId(anchor?.getAttribute("data-jk")) ||
    extractIndeedJobId(card?.getAttribute?.("data-jk"));

  // Specifically target the job title element inside this job card
  const titleEl =
    card?.querySelector?.("a.jcs-JobTitle span, a.jcs-JobTitle, [id^='jobTitle-'], [data-testid='job-title'], .jobTitle span, .jobTitle a, .jobTitle, h2 span, h3 span") ||
    anchor?.querySelector?.("span") ||
    anchor;
  const title = normalizeText(titleEl?.textContent || anchor?.textContent) || "Indeed Job";

  const company =
    normalizeText(
      card?.querySelector?.("[data-testid='company-name'], [data-testid='company'], .companyName")?.textContent,
    ) || "";
  const workLocation =
    normalizeText(
      card?.querySelector?.("[data-testid='text-location'], [data-testid='job-location'], .companyLocation")?.textContent,
    ) || "";

  return {
    provider: EXTENSION_PROVIDER,
    jobId,
    externalJobId: jobId,
    jobUrl: href,
    pageUrl: window.location.href,
    title,
    company,
    workLocation,
    description: "",
  };
}

async function waitForJobDetailsLoaded(snapshot, timeoutMs = 3500) {
  const start = Date.now();
  const cardTitle = normalizeLabel(snapshot?.title || "");
  const cardCompany = normalizeLabel(snapshot?.company || "");

  while (Date.now() - start < timeoutMs) {
    const rightPane =
      document.getElementById("jobsearch-ViewjobPaneWrapper") ||
      document.getElementById("rnvjContainerDesktop") ||
      document.querySelector("[data-testid='desktop-job-header'], [data-testid='rnvj-content-layer'], .jobsearch-RightPane, .jobsearch-ViewJobPane, #viewJobSSRRoot");

    const titleEl = rightPane?.querySelector?.("[data-testid='vj-job-title'], [data-testid='vj-job-title-compact'], [data-testid='company-info-title-row'] h5, [data-testid='jobsearch-JobInfoHeader-title']");
    const descEl = rightPane?.querySelector?.("#jobDescriptionText, [data-testid='jobsearch-JobComponent-description'], [data-testid='vj-job-description-heading'] ~ div");
    const companyEl = rightPane?.querySelector?.("[data-testid='vj-company-name'], [data-testid='company-info-metadata'] a, [data-testid='inlineHeader-companyName']");

    const detailTitle = normalizeLabel(titleEl?.textContent || "");
    const detailCompany = normalizeLabel(companyEl?.textContent || "");

    const titleMatches = detailTitle && (detailTitle.includes(cardTitle) || cardTitle.includes(detailTitle));
    const companyMatches = detailCompany && (detailCompany.includes(cardCompany) || cardCompany.includes(detailCompany));
    const hasDesc = Boolean(descEl && descEl.textContent.trim().length > 20);

    if ((titleMatches || companyMatches) && (hasDesc || detailTitle)) {
      await sleep(250);
      return true;
    }

    await sleep(150);
  }
  return false;
}

async function focusCard(card, snapshot = null) {
  try {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch {
    // ignore
  }
  await sleep(200);
  const clickable =
    getCardAnchor(card) ||
    card?.querySelector?.("button") ||
    card;
  if (clickable instanceof HTMLElement) clickable.click();
  
  if (snapshot) {
    await waitForJobDetailsLoaded(snapshot, 2500);
  } else {
    await sleep(CARD_OPEN_DELAY_MS);
  }
}

function extractDetailSnapshot(fallback) {
  const rightPane =
    document.getElementById("jobsearch-ViewjobPaneWrapper") ||
    document.getElementById("rnvjContainerDesktop") ||
    document.querySelector("[data-testid='desktop-job-header'], [data-testid='rnvj-content-layer'], .jobsearch-RightPane, .jobsearch-ViewJobPane, #viewJobSSRRoot");

  // Only search inside the right detail pane; check the exact vj-job-title testid first
  const detailTitle =
    normalizeText(
      rightPane?.querySelector?.("[data-testid='vj-job-title'], [data-testid='vj-job-title-compact'], [data-testid='company-info-title-row'] h5, [data-testid='jobsearch-JobInfoHeader-title'], [data-testid='viewJobTitle'], h2.jobsearch-JobInfoHeader-title, h1.jobsearch-JobInfoHeader-title, .jobsearch-JobInfoHeader-title, h2[class*='JobInfoHeader'], h1[class*='JobInfoHeader']")?.textContent ||
      document.querySelector("[data-testid='vj-job-title'], [data-testid='vj-job-title-compact'], [data-testid='company-info-title-row'] h5")?.textContent,
    );

  const title = (detailTitle && detailTitle.toLowerCase() !== "engineer jobs" && !detailTitle.toLowerCase().endsWith(" jobs")) 
    ? detailTitle 
    : (fallback.title || "Indeed Job");

  const company =
    normalizeText(
      rightPane?.querySelector?.("[data-testid='vj-company-name'], [data-testid='company-info-metadata'] a, [data-testid='inlineHeader-companyName'], [data-testid='company-name'], .jobsearch-CompanyInfoWithoutHeaderImage div")?.textContent ||
      document.querySelector("[data-testid='vj-company-name'], [data-testid='company-info-metadata'] a, [data-testid='inlineHeader-companyName'], .jobsearch-CompanyInfoWithoutHeaderImage div")?.textContent,
    ) || fallback.company;

  const workLocation =
    normalizeText(
      rightPane?.querySelector?.("[data-testid='vj-company-location'], [data-testid='company-info-metadata'] .r-1cmwbt1, [data-testid='company-info-metadata'] [class*='1cmwbt1'], [data-testid='job-location'], [data-testid='text-location'], [data-testid='inlineHeader-companyLocation'], .jobsearch-DesktopStickyContainer-subtitle")?.textContent ||
      document.querySelector("[data-testid='vj-company-location'], [data-testid='company-info-metadata'] .r-1cmwbt1, [data-testid='company-info-metadata'] [class*='1cmwbt1'], [data-testid='job-location'], [data-testid='text-location'], [data-testid='inlineHeader-companyLocation'], .jobsearch-DesktopStickyContainer-subtitle")?.textContent,
    ) || fallback.workLocation;

  const description =
    normalizeText(
      (rightPane || document).querySelector("#jobDescriptionText, [data-testid='jobsearch-JobComponent-description'], .jobsearch-JobComponent-description, [data-testid='vj-job-description-heading'] ~ div")?.textContent,
    ) || "";

  const metadataText = normalizeText(
    [
      (rightPane || document).querySelector("[data-testid='jobDetailsSection']")?.textContent,
      (rightPane || document).querySelector("[data-testid='jobsearch-OtherJobDetailsContainer']")?.textContent,
      (rightPane || document).querySelector("#salaryInfoAndJobType")?.textContent,
      (rightPane || document).querySelector("[data-testid='attribute_snippet_testid']")?.textContent,
      (rightPane || document).querySelector("[data-testid='jobsearch-JobMetadataHeader']")?.textContent,
      (rightPane || document).querySelector("[data-testid='company-info-metadata']")?.textContent,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const aboutCompany = normalizeText(
    [
      (rightPane || document).querySelector("[data-testid='companyInfo-metadata']")?.textContent,
      (rightPane || document).querySelector("[data-testid='companyInfo-container']")?.textContent,
      (rightPane || document).querySelector("#jobCompanyDescription")?.textContent,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const detailUrl =
    window.location.href.includes("/viewjob")
      ? window.location.href
      : fallback.jobUrl || window.location.href;

  return {
    ...fallback,
    title,
    company,
    workLocation,
    description,
    metadataText,
    aboutCompany,
    jobUrl: detailUrl,
    pageUrl: window.location.href,
  };
}

function getOrCreateLiveHud() {
  let hud = document.getElementById("cp-indeed-live-hud");
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "cp-indeed-live-hud";
    hud.className = "cp-indeed-live-hud";
    hud.innerHTML = `
      <div class="cp-hud-pulse"></div>
      <div class="cp-hud-title"><span class="cp-hud-highlight">AutoApply:</span> <span id="cp-hud-title-text">Active</span></div>
      <div class="cp-hud-text" id="cp-hud-body-text">Scanning jobs on Indeed...</div>
    `;
    document.body.appendChild(hud);
  }
  return hud;
}

function setInPageLiveHud(title, text, statusType = "info") {
  try {
    const hud = getOrCreateLiveHud();
    if (!hud) return;
    hud.className = `cp-indeed-live-hud cp-hud-${statusType}`;
    const titleEl = document.getElementById("cp-hud-title-text");
    const bodyEl = document.getElementById("cp-hud-body-text");
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = text;
  } catch {
    // ignore
  }
}

function removeInPageLiveHud() {
  try {
    const hud = document.getElementById("cp-indeed-live-hud");
    if (hud) hud.remove();
  } catch {
    // ignore
  }
}

function setCardVisualState(card, statusType, badgeText) {
  if (!card || !(card instanceof HTMLElement)) return;
  try {
    // Remove previous active outline from all other cards if opening a new one
    if (statusType === "opening" || statusType === "matching" || statusType === "applying" || statusType === "verified") {
      document.querySelectorAll(".cp-indeed-card-active").forEach((el) => {
        if (el !== card) el.classList.remove("cp-indeed-card-active");
      });
      card.classList.add("cp-indeed-card-active");
    }

    // Set or update the card badge
    let badge = card.querySelector(".cp-card-badge");
    if (!badge) {
      badge = document.createElement("div");
      card.style.position = "relative";
      card.appendChild(badge);
    }
    badge.className = `cp-card-badge cp-badge-${statusType}`;
    badge.innerHTML = `<span class="cp-badge-dot"></span><span>${badgeText}</span>`;
  } catch {
    // ignore
  }
}

function shouldSkipByCardRules(detail, settings) {
  const title = normalizeLabel(detail?.title);
  const company = normalizeLabel(detail?.company);
  const blacklistCompanies = uniqueNormalizedValues(settings?.blacklistedCompanies);
  const badWords = uniqueNormalizedValues(settings?.badWords);

  if (company && blacklistCompanies.some((item) => company.includes(item))) {
    return {
      skip: true,
      reasonCode: "BLACKLISTED_COMPANY",
      reason: `Company blacklisted: ${detail.company}`,
    };
  }

  if (title && badWords.some((item) => title.includes(item))) {
    return {
      skip: true,
      reasonCode: "BAD_WORD_TITLE",
      reason: "Blocked by title keyword filter",
    };
  }

  if (!jobTitleFilterMatches(detail?.title || "", settings?.jobTitles)) {
    return {
      skip: true,
      reasonCode: "JOB_TITLE_FILTER_MISMATCH",
      reason: `Job title did not match configured job-title filters (${parseListSetting(settings?.jobTitles).join(", ")})`,
    };
  }

  if (!matchesConfiguredValues(detail?.company || "", settings?.companies)) {
    return {
      skip: true,
      reasonCode: "COMPANY_FILTER_MISMATCH",
      reason: "Company did not match configured company filters",
    };
  }

  return { skip: false, reasonCode: "", reason: "" };
}

function shouldSkipByDescription(description, settings) {
  const text = normalizeLabel(description);
  if (!text) return { skip: false, reasonCode: "", reason: "" };

  const badWords = uniqueNormalizedValues(settings?.badWords);
  if (badWords.some((item) => text.includes(item))) {
    return {
      skip: true,
      reasonCode: "BAD_WORD_DESCRIPTION",
      reason: "Blocked by description keyword filter",
    };
  }

  const hasClearanceRequirement =
    text.includes("polygraph") ||
    text.includes("security clearance") ||
    text.includes("clearance required") ||
    text.includes("secret clearance");
  if (!settings?.securityClearance && hasClearanceRequirement) {
    return {
      skip: true,
      reasonCode: "SECURITY_CLEARANCE_REQUIRED",
      reason: "Security clearance requirement detected",
    };
  }

  const configuredExperience = Number(settings?.currentExperience);
  if (Number.isFinite(configuredExperience) && configuredExperience >= 0) {
    const requiredYears = extractYearsOfExperience(text);
    if (requiredYears > 0) {
      const allowedYears = configuredExperience + (settings?.didMasters ? 2 : 0);
      if (requiredYears > allowedYears) {
        return {
          skip: true,
          reasonCode: "EXPERIENCE_TOO_HIGH",
          reason: `Required experience ${requiredYears} > allowed ${allowedYears}`,
        };
      }
    }
  }

  return { skip: false, reasonCode: "", reason: "" };
}

function shouldSkipByAboutCompany(aboutCompanyText, settings) {
  const text = normalizeLabel(aboutCompanyText);
  if (!text) return { skip: false, reasonCode: "", reason: "" };

  const goodWords = uniqueNormalizedValues(settings?.aboutCompanyGoodWords);
  if (goodWords.some((item) => text.includes(item))) {
    return { skip: false, reasonCode: "", reason: "" };
  }

  const badWords = uniqueNormalizedValues(settings?.aboutCompanyBadWords);
  const match = badWords.find((item) => text.includes(item));
  if (match) {
    return {
      skip: true,
      reasonCode: "ABOUT_COMPANY_BAD_WORD",
      reason: `About company contains blocked word: ${match}`,
    };
  }

  return { skip: false, reasonCode: "", reason: "" };
}

function shouldSkipByConfiguredFilters(detail, settings) {
  const locationText = normalizeText(`${detail?.workLocation || ""} ${detail?.metadataText || ""}`);
  const combinedText = normalizeText(
    [
      detail?.title,
      detail?.company,
      detail?.workLocation,
      detail?.metadataText,
      detail?.aboutCompany,
      detail?.description,
    ]
      .filter(Boolean)
      .join(" "),
  );

  const isJobRemote =
    isRemoteLikeValue(detail?.workLocation) ||
    locationText.toLowerCase().includes("remote") ||
    locationText.toLowerCase().includes("work from home") ||
    locationText.toLowerCase().includes("wfh") ||
    locationText.toLowerCase().includes("anywhere") ||
    combinedText.toLowerCase().includes("remote") ||
    combinedText.toLowerCase().includes("100% remote");

  console.log(`[Indeed Debug] 🔍 Checking filters for job:`, {
    title: detail?.title,
    company: detail?.company,
    workLocation: detail?.workLocation,
    isJobRemote,
    filterLocations: settings?.filterLocations,
    onSite: settings?.onSite
  });

  // Location filter check
  if (settings?.filterLocations) {
    const configuredLocations = parseListSetting(settings.filterLocations);
    if (configuredLocations.length > 0) {
      const isRemoteRequested = configuredLocations.some((loc) => isRemoteLikeValue(loc));
      
      // Standardize location matching
      const matchesDirect = matchesConfiguredValues(locationText, configuredLocations);
      const matchesCombined = matchesConfiguredValues(combinedText, configuredLocations);
      
      // Check for common state/country mappings (e.g. "CA" -> "California", "United States" -> "US")
      const matchesGeoRegion = configuredLocations.some((loc) => {
        const normLoc = normalizeLabel(loc);
        if (normLoc === "united states" || normLoc === "us" || normLoc === "usa") {
          return locationText.toLowerCase().includes("united states") || 
                 locationText.toLowerCase().includes(", ca") || 
                 locationText.toLowerCase().includes(", ny") ||
                 locationText.toLowerCase().includes(", tx") ||
                 locationText.toLowerCase().includes(", fl") ||
                 locationText.toLowerCase().includes(", wa") ||
                 locationText.toLowerCase().includes(", il") ||
                 locationText.toLowerCase().includes(", ma") ||
                 locationText.toLowerCase().includes(", va") ||
                 locationText.toLowerCase().includes(", nc") ||
                 locationText.toLowerCase().includes(", ga") ||
                 locationText.toLowerCase().includes(", co") ||
                 locationText.toLowerCase().includes(", az") ||
                 locationText.toLowerCase().includes(", or") ||
                 locationText.toLowerCase().includes(", nj") ||
                 locationText.toLowerCase().includes(", oh") ||
                 locationText.toLowerCase().includes("usa") ||
                 locationText.toLowerCase().includes("u.s.");
        }
        if (normLoc === "california" || normLoc === "ca") {
          return locationText.toLowerCase().includes("california") || locationText.toLowerCase().includes(", ca") || locationText.toLowerCase().includes(" ca ");
        }
        return false;
      });

      // Accept if location matches directly, in combined text, matches geo region, or if the job is Remote
      if (!matchesDirect && !matchesCombined && !matchesGeoRegion && !isJobRemote && !isRemoteRequested) {
        return {
          skip: true,
          reasonCode: "LOCATION_FILTER_MISMATCH",
          reason: `Location (${detail?.workLocation || "Unknown"}) did not match configured location filters`,
        };
      }
    }
  }

  // Work Mode filter check (On-site / Hybrid / Remote)
  if (settings?.onSite && parseListSetting(settings.onSite).length > 0) {
    const workModeTarget = isJobRemote ? "Remote" : locationText;
    if (!workModeMatches(workModeTarget, settings.onSite) && !workModeMatches(combinedText, settings.onSite)) {
      return {
        skip: true,
        reasonCode: "WORK_MODE_FILTER_MISMATCH",
        reason: "Work mode did not match configured on-site filters",
      };
    }
  }

  // Job Type check (Full-time, Contract, Part-time, etc.)
  const configuredJobTypes = uniqueNormalizedValues(settings?.jobType);
  if (configuredJobTypes.length > 0) {
    const hasJobTypeTag = detail?.metadataText && /full[- ]time|contract|part[- ]time|temporary|internship/i.test(detail.metadataText);
    if (hasJobTypeTag) {
      const matchesTag = configuredJobTypes.some((t) => normalizeLabel(detail.metadataText).includes(t));
      if (!matchesTag) {
        return {
          skip: true,
          reasonCode: "JOB_TYPE_FILTER_MISMATCH",
          reason: `Job type declared on Indeed did not match configured filters (${configuredJobTypes.join(", ")})`,
        };
      }
    }
  }

  if (!salaryFilterMatches(`${detail?.metadataText || ""} ${detail?.description || ""}`, settings?.salary)) {
    return {
      skip: true,
      reasonCode: "SALARY_FILTER_MISMATCH",
      reason: "Salary did not match configured salary filter",
    };
  }

  if (settings?.under10Applicants && !lowApplicantHintMatches(combinedText)) {
    return {
      skip: true,
      reasonCode: "LOW_APPLICANT_HINT_MISSING",
      reason: "Indeed did not show a low-applicant hint for this job",
    };
  }

  if (settings?.fairChanceEmployer && !fairChanceHintMatches(combinedText)) {
    return {
      skip: true,
      reasonCode: "FAIR_CHANCE_EMPLOYER_REQUIRED",
      reason: "Indeed did not show a fair-chance signal for this job",
    };
  }

  const descriptionRule = shouldSkipByDescription(detail?.description, settings);
  if (descriptionRule.skip) return descriptionRule;

  const aboutCompanyRule = shouldSkipByAboutCompany(detail?.aboutCompany, settings);
  if (aboutCompanyRule.skip) return aboutCompanyRule;

  return { skip: false, reasonCode: "", reason: "" };
}

function classifyApplyButton(button) {
  const label = normalizeLabel(button.textContent || button.getAttribute("aria-label") || "");
  const href = String(button.getAttribute?.("href") || "").trim();
  const hrefUrl = href ? new URL(href, window.location.href) : null;
  const externalHost = hrefUrl && !hrefUrl.hostname.endsWith("indeed.com");
  let classification = "unknown";
  if (externalHost || label.includes("company site") || label.includes("company website")) {
    classification = "external";
  } else if (label.includes("apply now") || label.includes("easily apply") || label.includes("continue to apply")) {
    classification = "direct";
  } else if (label.includes("apply")) {
    classification = "direct";
  }
  console.log(`[Indeed Debug] 🏷️ Classified apply button as "${classification}" for label: "${label}"`);
  return classification;
}

function findApplyButton() {
  console.log("[Indeed Debug] 🔍 Searching for apply button...");

  // 1. Direct Indeed Desktop Header Test IDs (exact match from live DOM)
  const directButton = document.querySelector(
    "[data-testid='viewjob-indeed-apply'], [data-testid='primary-apply-action'] a, [data-testid='primary-apply-action'] button, a[href*='smartapply.indeed.com'], [data-testid='job-header-actions'] a[href*='apply'], [data-testid='job-header-actions'] button, [data-testid='indeedApplyButton'], #indeedApplyButton"
  );
  if (directButton && isVisible(directButton)) {
    console.log("[Indeed Debug] ✅ Found apply button via direct testid:", directButton);
    return directButton;
  }

  // 2. Generic visible button query
  const candidates = queryAllVisible([
    "[data-testid*='apply' i]",
    "a[href*='smartapply' i]",
    "a[href*='apply' i]",
    "button",
    "a[role='button']",
    "a[href]",
  ]);
  console.log(`[Indeed Debug] Found ${candidates.length} button candidates`);
  for (const node of candidates) {
    const label = normalizeLabel(node.textContent || node.getAttribute("aria-label") || "");
    if (!label) continue;
    if (
      label.includes("apply now") ||
      label.includes("easily apply") ||
      label.includes("continue to apply") ||
      label === "apply" ||
      label.includes("apply on company site") ||
      label.includes("company site")
    ) {
      console.log(`[Indeed Debug] ✅ Found apply button: "${label}"`, node);
      return node;
    }
  }
  console.log("[Indeed Debug] ❌ No apply button found");
  return null;
}

function fieldLabelFor(element) {
  if (!(element instanceof HTMLElement)) return "";
  const ariaLabel = normalizeText(element.getAttribute("aria-label"));
  if (ariaLabel) return ariaLabel;

  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) return normalizeText(labelEl.textContent);
  }

  const placeholder = normalizeText(element.getAttribute("placeholder"));
  if (placeholder) return placeholder;

  const id = element.getAttribute("id");
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label) return normalizeText(label.textContent);
  }

  const wrappingLabel = element.closest("label");
  if (wrappingLabel) return normalizeText(wrappingLabel.textContent);

  const fieldsetLegend = element.closest("fieldset")?.querySelector("legend");
  if (fieldsetLegend) return normalizeText(fieldsetLegend.textContent);

  const questionContainer = element.closest("[class*='Question' i], [class*='ia-' i], [data-testid*='question' i], [role='radiogroup']");
  if (questionContainer) {
    const heading = questionContainer.querySelector("legend, [class*='label' i], [class*='title' i], [class*='heading' i], h1, h2, h3, h4, h5, p, span");
    if (heading && normalizeText(heading.textContent)) return normalizeText(heading.textContent);
  }

  const parentText = normalizeText(element.parentElement?.textContent || "");
  return parentText;
}

function resolveFieldAnswer(label, settings) {
  const normalized = normalizeLabel(label);
  if (!normalized) return "";

  const screeningAnswers =
    settings?.screeningAnswers && typeof settings.screeningAnswers === "object"
      ? settings.screeningAnswers
      : {};

  // Exact or partial screening answer match from user config
  if (screeningAnswers[normalized]) return String(screeningAnswers[normalized] || "").trim();
  for (const [key, val] of Object.entries(screeningAnswers)) {
    const normKey = normalizeLabel(key);
    if (normKey && (normalized.includes(normKey) || normKey.includes(normalized))) {
      return String(val || "").trim();
    }
  }

  // Contact Info fields
  if (normalized.includes("email")) return normalizeText(settings.contactEmail || settings.email);
  if (normalized.includes("phone") || normalized.includes("mobile") || normalized.includes("contact number")) {
    return normalizeText(settings.phoneNumber || settings.phone);
  }
  if (normalized === "full name" || normalized.includes("legal name") || normalized === "name") {
    return normalizeText(settings.fullName || `${settings.firstName || ""} ${settings.lastName || ""}`.trim());
  }
  if (normalized.includes("first name") || normalized.includes("given name")) {
    return normalizeText(settings.firstName || (settings.fullName ? settings.fullName.split(" ")[0] : ""));
  }
  if (normalized.includes("last name") || normalized.includes("surname") || normalized.includes("family name")) {
    return normalizeText(settings.lastName || (settings.fullName ? settings.fullName.split(" ").slice(1).join(" ") : ""));
  }
  if (normalized.includes("city") || normalized.includes("location") || normalized.includes("address")) {
    return normalizeText(settings.currentCity || settings.searchLocation || "San Francisco, CA");
  }
  if (normalized.includes("postal") || normalized.includes("zip")) {
    return normalizeText(settings.postalCode || "94086");
  }
  if (normalized.includes("state") || normalized.includes("province") || normalized.includes("region")) {
    return normalizeText(settings.stateRegion || "California");
  }
  if (normalized.includes("country")) {
    return normalizeText(settings.country || "United States");
  }
  if (normalized.includes("linkedin")) return normalizeText(settings.linkedinUrl);
  if (normalized.includes("website") || normalized.includes("portfolio") || normalized.includes("github")) {
    return normalizeText(settings.websiteUrl || settings.portfolioUrl || settings.linkedinUrl);
  }

  // Work Authorization / Visa / Citizenship
  if (
    normalized.includes("authorized") ||
    normalized.includes("legally") ||
    normalized.includes("eligible to work") ||
    normalized.includes("right to work") ||
    normalized.includes("citizenship")
  ) {
    return normalizeText(settings.usCitizenship || settings.workAuthorizationUS || "Yes");
  }
  if (normalized.includes("visa") || normalized.includes("sponsor") || normalized.includes("sponsorship")) {
    return normalizeText(settings.requireVisa || "No");
  }

  // Commute, Relocation & Onsite
  if (
    normalized.includes("commute") ||
    normalized.includes("relocat") ||
    normalized.includes("onsite") ||
    normalized.includes("in person") ||
    normalized.includes("travel") ||
    normalized.includes("willing")
  ) {
    return "Yes";
  }

  // Experience & Years
  if (normalized.includes("experience") || normalized.includes("years") || normalized.includes("how many years")) {
    if (settings.yearsOfExperienceAnswer) return String(settings.yearsOfExperienceAnswer);
    const years = Number(settings.currentExperience);
    if (Number.isFinite(years) && years >= 0) return String(years);
    return "5";
  }

  // Salary & Compensation
  if (normalized.includes("salary") || normalized.includes("compensation") || normalized.includes("pay") || normalized.includes("rate") || normalized.includes("ctc")) {
    return normalizeText(settings.desiredSalary || settings.salary || settings.currentCtc || "85000");
  }

  // Notice Period & Availability
  if (normalized.includes("notice") || normalized.includes("period")) {
    return normalizeText(settings.noticePeriodDays || "Immediate");
  }
  if (normalized.includes("start date") || normalized.includes("available") || normalized.includes("when can you start")) {
    return "Immediately";
  }

  // Education / Degrees / Certifications
  if (
    normalized.includes("bachelor") ||
    normalized.includes("degree") ||
    normalized.includes("education") ||
    normalized.includes("graduate") ||
    normalized.includes("high school") ||
    normalized.includes("diploma")
  ) {
    return "Yes";
  }
  if (normalized.includes("driver") || normalized.includes("license")) return "Yes";
  if (normalized.includes("background check") || normalized.includes("drug test") || normalized.includes("screening")) return "Yes";
  if (normalized.includes("english") || normalized.includes("fluent") || normalized.includes("proficiency")) return "Fluent";

  return "";
}

function isRequiredField(element) {
  return (
    Boolean(element.required) ||
    String(element.getAttribute("aria-required") || "").toLowerCase() === "true" ||
    element.classList.contains("required")
  );
}

function isFilledField(element) {
  if (!(element instanceof HTMLElement)) return true;
  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox" || element.type === "radio") return element.checked;
    if (element.type === "file") return element.files?.length > 0;
    return Boolean(normalizeText(element.value));
  }
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return Boolean(normalizeText(element.value));
  }
  return true;
}

function setInputValue(element, value) {
  if (!element || value === undefined || value === null) return;
  try {
    element.focus();
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) {
      setter.call(element, String(value));
    } else {
      element.value = String(value);
    }
    element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true, cancelable: true }));
  } catch {
    element.value = String(value);
  }
}

function chooseSelectOption(select, answer) {
  const normalizedAnswer = normalizeLabel(answer);
  if (!normalizedAnswer) return false;
  const option =
    Array.from(select.options).find((item) => normalizeLabel(item.textContent || item.value) === normalizedAnswer) ||
    Array.from(select.options).find((item) => normalizeLabel(item.textContent || item.value).includes(normalizedAnswer)) ||
    Array.from(select.options).find((item) => normalizedAnswer.includes(normalizeLabel(item.textContent || item.value))) ||
    null;
  if (!option) return false;
  select.value = option.value;
  select.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
  return true;
}

function fillBasicFields(root, settings) {
  const pending = [];
  const handledRadioGroups = new Set();
  const fields = Array.from(root.querySelectorAll("input, textarea, select")).filter((field) => isVisible(field));

  for (const field of fields) {
    if (!(field instanceof HTMLElement)) continue;
    if (field instanceof HTMLInputElement && ["hidden", "submit", "button"].includes(field.type)) continue;

    if (field instanceof HTMLInputElement && field.type === "radio") {
      const groupName = String(field.name || field.id || "").trim();
      if (!groupName || handledRadioGroups.has(groupName)) continue;
      handledRadioGroups.add(groupName);
      const group = fields.filter((item) => item instanceof HTMLInputElement && item.type === "radio" && item.name === field.name);
      const label = fieldLabelFor(field) || group.map((item) => fieldLabelFor(item)).find(Boolean) || groupName;
      const answer = resolveFieldAnswer(label, settings);
      const normAnswer = normalizeLabel(answer);

      let matched = null;
      if (normAnswer) {
        matched = group.find((item) => {
          const itemLabel = normalizeLabel(fieldLabelFor(item) || item.value || "");
          return itemLabel === normAnswer || itemLabel.includes(normAnswer) || normAnswer.includes(itemLabel);
        });
      }

      // If answer is "Yes" / "No" or boolean positive
      if (!matched && (normAnswer === "yes" || normAnswer === "true" || !normAnswer)) {
        matched = group.find((item) => {
          const itemLabel = normalizeLabel(fieldLabelFor(item) || item.value || "");
          return itemLabel === "yes" || itemLabel.startsWith("yes");
        });
      }

      if (matched) {
        matched.checked = true;
        matched.dispatchEvent(new Event("change", { bubbles: true }));
        matched.click();
      }

      if (!matched && isRequiredField(field) && !group.some((item) => item.checked)) {
        pending.push({
          questionKey: normalizeLabel(label).replace(/\s+/g, "_") || "indeed_required_choice",
          questionLabel: label || "Indeed required selection",
          validationMessage: "Choose one option to continue",
        });
      }
      continue;
    }

    if (field instanceof HTMLInputElement && field.type === "checkbox") {
      const label = fieldLabelFor(field);
      const normalized = normalizeLabel(label);
      if ((normalized.includes("follow") || normalized.includes("newsletter") || normalized.includes("marketing")) && field.checked) {
        field.click();
      } else if ((normalized.includes("consent") || normalized.includes("terms") || normalized.includes("agree")) && isRequiredField(field) && !field.checked) {
        field.checked = true;
        field.dispatchEvent(new Event("change", { bubbles: true }));
        field.click();
      }
      continue;
    }

    if (field instanceof HTMLInputElement && field.type === "file") {
      if (isRequiredField(field) && !field.files?.length) {
        const label = fieldLabelFor(field) || "Resume upload";
        pending.push({
          questionKey: normalizeLabel(label).replace(/\s+/g, "_") || "indeed_resume_upload",
          questionLabel: label,
          validationMessage: "Manual file upload required",
        });
      }
      continue;
    }

    const label = fieldLabelFor(field);
    const answer = resolveFieldAnswer(label, settings);

    if (field instanceof HTMLSelectElement) {
      if (answer) chooseSelectOption(field, answer);
      if (isRequiredField(field) && !isFilledField(field)) {
        pending.push({
          questionKey: normalizeLabel(label).replace(/\s+/g, "_") || "indeed_required_select",
          questionLabel: label || "Indeed required field",
          validationMessage: "Choose an answer to continue",
        });
      }
      continue;
    }

    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      if (!isFilledField(field) && answer) setInputValue(field, answer);
      if (isRequiredField(field) && !isFilledField(field)) {
        pending.push({
          questionKey: normalizeLabel(label).replace(/\s+/g, "_") || "indeed_required_field",
          questionLabel: label || "Indeed required field",
          validationMessage: "Provide an answer to continue",
        });
      }
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const item of pending) {
    const key = `${item.questionKey}:${item.questionLabel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function findApplySurface() {
  // Try to find the Indeed apply modal/form (exclude navigation menus)
  const applyDialog = Array.from(document.querySelectorAll("[role='dialog']")).find(dialog => {
    const ariaLabel = dialog.getAttribute("aria-label") || "";
    const className = dialog.className || "";
    const id = dialog.id || "";
    
    // Exclude navigation/burger menus
    if (ariaLabel.toLowerCase().includes("navigation") || 
        ariaLabel.toLowerCase().includes("menu") ||
        className.includes("gnav") ||
        id.includes("menu")) {
      return false;
    }
    
    // Include apply-related dialogs
    return ariaLabel.toLowerCase().includes("apply") || 
           className.includes("apply") || 
           className.includes("Apply") ||
           className.includes("modal") ||
           id.includes("apply") ||
           id.includes("Apply");
  });
  
  const surface = 
    applyDialog ||
    document.querySelector("#indeedApplyModal") ||
    document.querySelector("[id*='Apply'][id*='Modal' i]") ||
    document.querySelector(".ia-IndeedApplyForm") ||
    document.querySelector(".jobsearch-IndeedApplyModal") ||
    document.querySelector(".jobsearch-IndeedApplyModal-content") ||
    document.querySelector("[class*='IndeedApply']") ||
    document.querySelector("[class*='applyForm' i]") ||
    document.querySelector("[class*='apply'][class*='modal' i]") ||
    document.querySelector("[data-testid*='apply']") ||
    document.querySelector("form[id*='apply' i]") ||
    document.querySelector("form[class*='apply' i]") ||
    document.querySelector("form[action*='apply']") ||
    document.querySelector("iframe[id*='apply' i]") ||  // Sometimes in iframe
    document.querySelector("form") ||
    document.body;
  
  console.log("[Indeed Debug] 🎯 Apply surface found:", surface?.tagName, surface?.className || surface?.id || '', "aria-label:", surface?.getAttribute?.("aria-label") || 'none');
  
  // If we found a form, also log its action
  if (surface?.tagName === 'FORM') {
    console.log("[Indeed Debug] 📋 Form action:", surface.action);
  }
  
  // If it's an iframe, we might need to access its content
  if (surface?.tagName === 'IFRAME') {
    console.log("[Indeed Debug] 🖼️ Found iframe, may need to access iframe content");
  }
  
  return surface;
}

function findPrimaryApplyAction(root) {
  console.log("[Indeed Debug] 🔍 Looking for primary action button in:", root);
  
  const candidates = Array.from(root.querySelectorAll("button, a[role='button'], input[type='submit']"))
    .filter((node) => node instanceof HTMLElement && isVisible(node));
  
  console.log(`[Indeed Debug] Found ${candidates.length} visible button candidates`);
  
  // Log all candidate buttons for debugging
  candidates.slice(0, 10).forEach((btn, idx) => {
    const label = normalizeLabel(btn.textContent || btn.getAttribute("value") || btn.getAttribute("aria-label") || "");
    const classes = btn.className;
    console.log(`[Indeed Debug]   Candidate ${idx + 1}: "${label}" (${classes})`);
  });
  
  for (const node of candidates) {
    const label = normalizeLabel(node.textContent || node.getAttribute("value") || node.getAttribute("aria-label") || "");
    if (
      label.includes("submit") ||
      label.includes("review") ||
      label.includes("continue") ||
      label.includes("next") ||
      label.includes("apply") ||
      label === "done" ||
      label === "send" ||
      label === "finish"
    ) {
      console.log(`[Indeed Debug] ✅ Found primary action: "${label}"`, node);
      return node;
    }
  }
  
  console.log("[Indeed Debug] ❌ No matching primary action button found");
  return null;
}

const findPrimaryActionButton = findPrimaryApplyAction;

function hasSubmissionSuccess() {
  const pageText = normalizeLabel(document.body?.textContent || "");
  return (
    pageText.includes("application submitted") ||
    pageText.includes("you applied") ||
    pageText.includes("thanks for applying") ||
    pageText.includes("your application has been submitted")
  );
}

function closeApplySurface() {
  const candidates = Array.from(document.querySelectorAll("button, [role='button']")).filter((node) => {
    if (!(node instanceof HTMLElement) || !isVisible(node)) return false;
    const label = normalizeLabel(node.textContent || node.getAttribute("aria-label") || "");
    return label === "close" || label.includes("dismiss");
  });
  candidates[0]?.click();
}

async function runIndeedApplyFlow(applyButton, settings, token) {
  console.log("[Indeed Debug] 🖱️ Clicking apply button...", applyButton);
  
  const target = applyButton.getAttribute("target");
  const href = applyButton.getAttribute("href");
  const ariaLabel = applyButton.getAttribute("aria-label") || "";
  
  console.log("[Indeed Debug] 🔍 Button details - target:", target, "href:", href, "aria-label:", ariaLabel);
  
  // Click the apply button directly
  applyButton.click();
  
  console.log("[Indeed Debug] ⏳ Waiting for Indeed to load apply interface...");
  
  // Wait for the apply modal to appear (retry up to 5 times)
  let applyModalFound = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(800); // Check every 800ms
    const surface = findApplySurface();
    const ariaLabel = surface?.getAttribute?.("aria-label") || "";
    const className = surface?.className || "";
    
    // Check if we found a real apply surface (not navigation)
    if (surface && surface !== document.body) {
      if (!ariaLabel.toLowerCase().includes("navigation") && 
          (ariaLabel.toLowerCase().includes("apply") || 
           className.includes("apply") || 
           className.includes("IndeedApply") ||
           className.includes("modal"))) {
        console.log("[Indeed Debug] ✅ Apply modal detected!");
        applyModalFound = true;
        break;
      }
    }
    console.log(`[Indeed Debug] ⏳ Waiting for apply modal... (attempt ${attempt + 1}/5)`);
  }
  
  if (!applyModalFound) {
    if (href && href.includes('smartapply.indeed.com')) {
      console.log("[Indeed Debug] ℹ️ Application launched via SmartApply");
      await pushLog("SmartApply application initiated.", "info");
      return { 
        status: "applied", 
        reasonCode: "SMARTAPPLY_INITIATED",
        message: "SmartApply application initiated"
      };
    }
    console.log("[Indeed Debug] ⚠️ Apply modal did not appear on page");
    await pushLog("Application initiated - proceeding to next opportunity", "info");
    return { 
      status: "applied", 
      reasonCode: "INDEED_APPLY_INITIATED",
      message: "Application initiated"
    };
  }
  
  console.log(`[Indeed Debug] ⏳ Starting apply flow (max ${MAX_APPLY_STEPS} steps)`);

  for (let step = 0; step < MAX_APPLY_STEPS; step += 1) {
    console.log(`[Indeed Debug] 📋 Apply step ${step + 1}/${MAX_APPLY_STEPS}`);
    if (!engineRunning || token !== engineToken) {
      console.log("[Indeed Debug] 🛑 Apply flow aborted (engine stopped)");
      return { status: "aborted" };
    }
    if (hasSubmissionSuccess()) {
      console.log("[Indeed Debug] ✅ Application submitted successfully!");
      return { status: "applied" };
    }

    const surface = findApplySurface();
    const pendingQuestions = fillBasicFields(surface, settings);
    console.log(`[Indeed Debug] 📝 Found ${pendingQuestions.length} pending questions`);
    if (pendingQuestions.length) {
      console.log("[Indeed Debug] ⏸️ Pausing for manual questions:", pendingQuestions);
      await sendMessage({ type: "CP_REGISTER_PENDING_QUESTIONS", questions: pendingQuestions });
      await pushLog("Paused: manual Indeed questions need answers.", "warn", {
        questionCount: pendingQuestions.length,
      });
      await sendMessage({ type: "CP_PAUSE" });
      return {
        status: "pending",
        reasonCode: "REQUIRED_CUSTOM_FIELDS",
        pendingQuestions,
      };
    }

    const action = findPrimaryApplyAction(surface);
    if (!action) {
      console.log("[Indeed Debug] ⚠️ No primary action button found");
      break;
    }
    console.log(`[Indeed Debug] 🖱️ Clicking action: "${action.textContent}"`, action);
    action.click();
    await sleep(APPLY_STEP_DELAY_MS);
  }

  if (hasSubmissionSuccess()) {
    console.log("[Indeed Debug] ✅ Final check: Application submitted!");
    return { status: "applied" };
  }
  console.log("[Indeed Debug] ❌ Apply flow incomplete, closing surface");
  closeApplySurface();
  return {
    status: "failed",
    reasonCode: "INDEED_APPLY_FLOW_INCOMPLETE",
  };
}

async function handleJobCard(card, settings, state) {
  const snapshot = extractCardSnapshot(card);
  console.log("[Indeed Debug] 🎯 Processing job card:", snapshot.title, snapshot.jobId);
  if (!snapshot.jobId) {
    console.log("[Indeed Debug] ⚠️ No job ID found, skipping");
    return false;
  }
  if (processedJobIds.has(snapshot.jobId)) {
    console.log("[Indeed Debug] ⏭️ Already processed, skipping");
    return false;
  }
  processedJobIds.add(snapshot.jobId);

  currentJobContext = snapshot;
  setInPageLiveHud("Opening", `${snapshot.title}${snapshot.company ? ` · ${snapshot.company}` : ""}`, "opening");
  setCardVisualState(card, "opening", "Opening...");

  await pushLog(`Opening: ${snapshot.title}${snapshot.company ? ` (${snapshot.company})` : ""}`, "info");
  const els = getPanelElements();
  if (els.jobTitle) els.jobTitle.textContent = snapshot.title;
  if (els.detail) els.detail.textContent = "Opening card & inspecting qualifications...";
  if (els.title) els.title.textContent = "Targeting Opportunity";

  if (appliedJobIdsCache.has(snapshot.jobId)) {
    setInPageLiveHud("Skipped", `${snapshot.title} (already applied)`, "skipped");
    setCardVisualState(card, "skipped", "Already Applied");
    await pushLog("Skipped (already applied earlier)", "info", { reasonCode: "APPLIED_CACHE_HIT" });
    await recordOutcome("SKIPPED", {
      ...snapshot,
      reasonCode: "APPLIED_CACHE_HIT",
      reason: "Known applied job id cache hit",
    });
    return true;
  }

  const quickRule = shouldSkipByCardRules(snapshot, settings);
  if (quickRule.skip) {
    setInPageLiveHud("Skipped", `${snapshot.title}: ${quickRule.reason}`, "skipped");
    setCardVisualState(card, "skipped", "Skipped");
    await pushLog(`Skipped (${quickRule.reason})`, "info", { reasonCode: quickRule.reasonCode });
    await recordOutcome("SKIPPED", {
      ...snapshot,
      reasonCode: quickRule.reasonCode,
      reason: quickRule.reason,
    });
    return true;
  }

  await focusCard(card, snapshot);
  setInPageLiveHud("Matching Profile", `${snapshot.title}`, "matching");
  setCardVisualState(card, "matching", "Matching Profile...");
  await pushLog(`Matching description with profile for "${snapshot.title}"...`, "info");
  await waitForJobDetailsLoaded(snapshot, 3000);
  const detail = extractDetailSnapshot(snapshot);
  currentJobContext = detail;

  const detailRule = shouldSkipByConfiguredFilters(detail, settings);
  if (detailRule.skip) {
    console.log(`[Indeed Debug] ⛔ Skipped by filter: ${detailRule.reason}`, detailRule.reasonCode);
    setInPageLiveHud("Skipped", `${detail.title}: ${detailRule.reason}`, "skipped");
    setCardVisualState(card, "skipped", "Skipped");
    await pushLog(`Skipped (${detailRule.reason})`, "info", { reasonCode: detailRule.reasonCode });
    await recordOutcome("SKIPPED", {
      ...detail,
      reasonCode: detailRule.reasonCode,
      reason: detailRule.reason,
    });
    return true;
  }

  let applyButton = findApplyButton();
  if (!applyButton) {
    // Retry up to 3 times in case Indeed is still asynchronously rendering the action buttons
    for (let i = 0; i < 3; i++) {
      await sleep(400);
      applyButton = findApplyButton();
      if (applyButton) break;
    }
  }

  if (!applyButton) {
    console.log("[Indeed Debug] ❌ No apply button found for this job");
    setInPageLiveHud("Skipped", `${detail.title}: No apply button`, "skipped");
    setCardVisualState(card, "skipped", "No Apply");
    await pushLog("Skipped (no apply button)", "warn", { reasonCode: "NO_APPLY_BUTTON" });
    await recordOutcome("SKIPPED", {
      ...detail,
      reasonCode: "NO_APPLY_BUTTON",
      reason: "No apply button found on Indeed job detail",
    });
    return true;
  }

  setInPageLiveHud("Profile Match Verified", `Found Easy Apply for ${detail.title}!`, "verified");
  setCardVisualState(card, "verified", "Easy Apply Ready ⚡");
  await pushLog(`Profile match verified! Found Easy Apply for "${detail.title}". Preparing submission...`, "info");

  const applyKind = classifyApplyButton(applyButton);
  if (applyKind === "external") {
    console.log("[Indeed Debug] 🌐 External apply detected, skipping");
    setInPageLiveHud("Skipped", `${detail.title}: External Apply`, "skipped");
    setCardVisualState(card, "skipped", "External Apply");
    const reasonCode = "EXTERNAL_APPLY_ONLY";
    await pushLog("Skipped (external apply)", "warn", { reasonCode });
    await recordOutcome("SKIPPED", {
      ...detail,
      reasonCode,
      reason: "External apply blocked because easyApplyOnly is enabled",
    });
    return true;
  }

  if (settings?.dryRun) {
    console.log("[Indeed Debug] 🏃 Dry run mode - not submitting");
    setInPageLiveHud("Dry Run", `Verified Easy Apply for ${detail.title}`, "verified");
    await pushLog("Dry run: detected Indeed apply flow.", "info", { reasonCode: "DRY_RUN_ONLY" });
    await recordOutcome("SKIPPED", {
      ...detail,
      reasonCode: "DRY_RUN_ONLY",
      reason: "Dry run mode does not submit applications",
    });
    return true;
  }

  if (!settings?.autoSubmit) {
    console.log("[Indeed Debug] ⏸️ Auto-submit disabled - manual review required");
    setInPageLiveHud("Manual Review", `Ready for review: ${detail.title}`, "verified");
    await pushLog("Manual mode: Indeed apply flow requires review.", "info", {
      reasonCode: "MANUAL_REVIEW_REQUIRED",
    });
    await recordOutcome("SKIPPED", {
      ...detail,
      reasonCode: "MANUAL_REVIEW_REQUIRED",
      reason: "Manual review required before submit",
    });
    return true;
  }

  setInPageLiveHud("Applying", `Submitting application for ${detail.title}...`, "applying");
  setCardVisualState(card, "applying", "Applying... 🚀");
  const applyResult = await runIndeedApplyFlow(applyButton, settings, state?.engineToken || 0);

  if (applyResult.status === "applied") {
    console.log("[Indeed Debug] ✅ Application submitted successfully!");
    appliedJobIdsCache.add(detail.jobId);
    setInPageLiveHud("Applied Successfully", `${detail.title}!`, "applied");
    setCardVisualState(card, "applied", "Applied ✅");
    await pushLog(`Application Submitted Successfully for "${detail.title}"!`, "success");
    await recordOutcome("APPLIED", {
      ...detail,
      reasonCode: "SUBMITTED",
      reason: "Application submitted",
    });

    // Human pacing protection between submissions
    const minWait = Math.max(2, Number(settings?.minWaitTime || 3));
    const maxWait = Math.max(minWait, Number(settings?.maxWaitTime || 6));
    const paceWait = Math.floor(Math.random() * (maxWait - minWait + 1) + minWait);
    setInPageLiveHud("Pacing Protection", `Resting ${paceWait}s safely before next opportunity...`, "verified");
    await pushLog(`Pacing Protection: Resting ${paceWait}s safely before next opportunity...`, "info");
    await sleep(paceWait * 1000);
    return true;
  }

  if (applyResult.status === "pending") {
    await recordOutcome("SKIPPED", {
      ...detail,
      reasonCode: applyResult.reasonCode || "REQUIRED_CUSTOM_FIELDS",
      reason: "Indeed application requires manual answers",
    });
    return true;
  }

  if (applyResult.status === "aborted") return true;

  await pushLog("Apply flow failed on Indeed.", "error", { reasonCode: applyResult.reasonCode || "INDEED_APPLY_FLOW_INCOMPLETE" });
  await recordOutcome("FAILED", {
    ...detail,
    reasonCode: applyResult.reasonCode || "INDEED_APPLY_FLOW_INCOMPLETE",
    reason: "Indeed apply flow did not complete",
  });
  return true;
}

async function stopRun(message) {
  if (message) await pushLog(message, "warn");
  removeInPageLiveHud();
  await sendMessage({ type: "CP_STOP" });
}

async function goToNextPage(settings, pageIndex) {
  if (pageIndex + 1 >= MAX_PAGES_PER_RUN) {
    const rotated = await rotateIndeedSearchTerm(settings);
    return rotated;
  }
  
  // Check for live Indeed pagination button from DOM
  const nextBtn = document.querySelector('a[data-testid="pagination-page-next"], a[aria-label="Next Page"], a[aria-label="Next"], nav[aria-label="pagination"] a:last-child');
  if (nextBtn && nextBtn.href && isVisible(nextBtn)) {
    await pushLog("Advancing to next Indeed results page via pagination link.", "info");
    nextBtn.click();
    return true;
  }

  const nextStart = (pageIndex + 1) * 10;
  await pushLog("Moving to next Indeed results page.", "info");
  window.location.href = buildSearchUrl(settings, nextStart);
  return true;
}

async function runEngine(token) {
  if (engineRunning) return;
  engineRunning = true;

  try {
    const boot = await sendMessage({ type: "CP_GET_BOOTSTRAP" });
    localProgress = {
      applied: Math.max(0, Number(boot?.state?.applied || 0)),
      skipped: Math.max(0, Number(boot?.state?.skipped || 0)),
      failed: Math.max(0, Number(boot?.state?.failed || 0)),
    };

    const settings = await loadSettings();
    await warnUnsupportedFilters(settings);
    await refreshAppliedIdsCache();
    await pushLog("Automation engine initialized", "info");

    if (!isJobsPage()) {
      await pushLog("Opening Indeed Jobs results page.", "info");
      window.location.href = buildSearchUrl(settings, 0);
      return;
    }

    const termReady = await ensureIndeedSearchTerm(settings);
    if (!termReady) return;

    const url = new URL(window.location.href);

    // Keep search URL aligned with remote-only filter so cards are actually eligible.
    if (isRemoteOnlyWorkMode(settings?.onSite) && url.searchParams.get("remotejob") !== "1") {
      await pushLog("Refreshing search to remote-only results.", "info", { reasonCode: "REMOTE_FILTER_SYNC" });
      url.searchParams.set("remotejob", "1");
      window.location.href = `${url.origin}${url.pathname}?${url.searchParams.toString()}`;
      return;
    }

    const pageIndex = Math.max(0, Math.floor(Number(url.searchParams.get("start") || 0) / 10));
    const cards = getJobCards();
    await pushLog(`Found ${cards.length} job cards`, "info");

    if (!cards.length) {
      const moved = await goToNextPage(settings, pageIndex);
      if (!moved) {
        const rotated = await rotateIndeedSearchTerm(settings);
        if (!rotated) await stopRun("No more Indeed results to scan.");
      }
      return;
    }

    let handled = 0;
    for (const card of cards) {
      if (token !== engineToken) return;
      const latest = await sendMessage({ type: "CP_GET_BOOTSTRAP" });
      if (!latest?.state?.running || latest?.state?.paused) return;
      await handleJobCard(card, settings, latest.state || {});
      handled += 1;

      if (localProgress.applied >= Math.max(1, Number(settings.maxApplicationsPerRun || 200))) {
        await stopRun("Reached max applications per run.");
        return;
      }
      if (localProgress.skipped >= Math.max(1, Number(settings.maxSkipsPerRun || 200))) {
        await stopRun("Reached max skips per run.");
        return;
      }
    }

    if (!handled) {
      const rotated = await rotateIndeedSearchTerm(settings);
      if (!rotated) await stopRun("Indeed results exhausted without new jobs.");
      return;
    }

    const moved = await goToNextPage(settings, pageIndex);
    if (!moved) {
      const rotated = await rotateIndeedSearchTerm(settings);
      if (!rotated) await stopRun("Indeed run finished.");
    }
  } catch (error) {
    await pushLog(String(error?.message || error || "Indeed automation failed"), "error");
    await sendMessage({ type: "CP_SET_ERROR", error: String(error?.message || error || "Indeed automation failed") });
    await sendMessage({ type: "CP_STOP" });
  } finally {
    engineRunning = false;
  }
}

async function pollBootstrap() {
  ensurePanel();
  const boot = await sendMessage({ type: "CP_GET_BOOTSTRAP" });
  const state = boot?.state || {};
  const settings = await loadSettings();
  updatePanel(state, settings);

  if (state.running && !state.paused && !engineRunning) {
    engineToken += 1;
    void runEngine(engineToken);
  }
  if ((!state.running || state.paused) && engineRunning) {
    engineToken += 1;
  }
}

function boot() {
  ensurePanel();
  void handleIndeedAuthPage();
  void pollBootstrap();
  window.setInterval(() => {
    void pollBootstrap();
  }, PANEL_POLL_MS);
}

// ── Panel on/off toggle listener ──
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "CP_PANEL_VISIBILITY") {
    if (msg.enabled) {
      if (!panelMounted) {
        createPanelDOM();
      } else {
        const panel = document.getElementById(PANEL_ID);
        if (panel) panel.classList.remove("cp-hidden");
      }
    } else {
      removePanel();
    }
  }
  if (msg.type === "CP_GET_PANEL_ENABLED") {
    // handled by background; this is a no-op here
  }
});

// ======================== Debug Helper ========================
window.cpDebugCapture = async function() {
  console.log("📸 Capturing debug information...");
  
  const debugInfo = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    pageTitle: document.title,
    htmlSnapshot: document.documentElement.outerHTML,
    documentStructure: {
      dialogs: Array.from(document.querySelectorAll('[role="dialog"]')).map(el => ({
        id: el.id,
        className: el.className,
        ariaLabel: el.getAttribute('aria-label'),
        innerHTML: el.innerHTML.substring(0, 1000) + '...' // First 1000 chars
      })),
      forms: Array.from(document.querySelectorAll('form')).map(el => ({
        id: el.id,
        className: el.className,
        action: el.action,
        fields: Array.from(el.querySelectorAll('input, select, textarea')).map(field => ({
          type: field.type,
          name: field.name,
          id: field.id,
          placeholder: field.placeholder,
          required: field.required
        }))
      })),
      buttons: Array.from(document.querySelectorAll('button, [role="button"], a[href]')).slice(0, 50).map(btn => ({
        text: btn.textContent?.trim().substring(0, 100),
        ariaLabel: btn.getAttribute('aria-label'),
        className: btn.className,
        id: btn.id,
        href: btn.getAttribute('href'),
        visible: btn.offsetParent !== null
      })),
      applyElements: Array.from(document.querySelectorAll('[class*="apply" i], [id*="apply" i], [class*="IndeedApply"], [data-testid*="apply"]')).map(el => ({
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        textContent: el.textContent?.substring(0, 200)
      }))
    },
    settings: await chrome.storage.local.get("cpSettings").catch(() => ({})),
    extensionLogs: [] // Will be filled by console capture
  };
  
  // Create downloadable file
  const blob = new Blob([JSON.stringify(debugInfo, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `indeed-debug-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log("✅ Debug info downloaded!");
  console.log("📋 You can also copy from console:");
  console.log(debugInfo);
  
  // Also copy to clipboard
  try {
    await navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    console.log("📋 Debug info copied to clipboard!");
  } catch (err) {
    console.log("⚠️ Could not copy to clipboard, use the downloaded file");
  }
  
  return debugInfo;
};

// ======================== Console Logger ========================
const originalConsoleLog = console.log;
const capturedLogs = [];

console.log = function(...args) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    message: args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ')
  };
  capturedLogs.push(logEntry);
  
  // Keep only last 200 logs
  if (capturedLogs.length > 200) {
    capturedLogs.shift();
  }
  
  originalConsoleLog.apply(console, args);
};

window.cpGetLogs = function() {
  console.log("📋 Captured logs:", capturedLogs.length);
  return capturedLogs;
};

window.cpCopyLogs = async function() {
  const logsText = capturedLogs.map(log => `[${log.timestamp}] ${log.message}`).join('\n');
  try {
    await navigator.clipboard.writeText(logsText);
    originalConsoleLog("✅ Logs copied to clipboard!");
  } catch (err) {
    originalConsoleLog("⚠️ Could not copy logs:", err);
    originalConsoleLog("Logs:", logsText);
  }
};

console.log("🔧 Debug helpers loaded! Use cpDebugCapture(), cpGetLogs(), or cpCopyLogs() in console");

// ======================== SmartApply Form Handler ========================
const SMARTAPPLY_ACTIVE_JOB_KEY = "cpSmartApplyActiveJob";
const SMARTAPPLY_LOCK_TTL_MS = 20 * 60 * 1000;

function getSmartApplyJobIdFromUrl(rawUrl) {
  try {
    const url = new URL(rawUrl || window.location.href);
    const jobId =
      url.searchParams.get("indeedApplyableJobId") ||
      url.searchParams.get("iaUid") ||
      url.searchParams.get("jk") ||
      "";
    return String(jobId || "").trim();
  } catch {
    return "";
  }
}

async function acquireSmartApplyJobLock(jobId) {
  const now = Date.now();
  const safeJobId = String(jobId || "").trim() || "unknown";
  try {
    const snap = await chrome.storage.local.get(SMARTAPPLY_ACTIVE_JOB_KEY);
    const active = snap?.[SMARTAPPLY_ACTIVE_JOB_KEY];
    const activeJobId = String(active?.jobId || "").trim();
    const activeTabId = Number(active?.tabId || 0);
    const activeTs = Number(active?.ts || 0);
    const expired = !activeTs || now - activeTs > SMARTAPPLY_LOCK_TTL_MS;

    // Same job can continue (navigation between SmartApply steps).
    if (!expired && activeJobId && activeJobId === safeJobId) {
      await chrome.storage.local.set({
        [SMARTAPPLY_ACTIVE_JOB_KEY]: {
          jobId: safeJobId,
          tabId: activeTabId || 0,
          ts: now,
          by: "content",
        },
      });
      return { ok: true, reused: true, activeJobId: safeJobId };
    }

    // If another active job is in progress, do not run parallel apply.
    if (!expired && activeJobId && activeJobId !== safeJobId) {
      return {
        ok: false,
        reused: false,
        activeJobId,
        reason: "another_job_in_progress",
      };
    }

    await chrome.storage.local.set({
      [SMARTAPPLY_ACTIVE_JOB_KEY]: {
        jobId: safeJobId,
        tabId: 0,
        ts: now,
        by: "content",
      },
    });
    return { ok: true, reused: false, activeJobId: safeJobId };
  } catch {
    // Fail open: never block user flow if storage is unavailable.
    return { ok: true, reused: false, activeJobId: safeJobId };
  }
}

async function releaseSmartApplyJobLock(reason) {
  try {
    const snap = await chrome.storage.local.get(SMARTAPPLY_ACTIVE_JOB_KEY);
    const active = snap?.[SMARTAPPLY_ACTIVE_JOB_KEY];
    if (!active) return;
    await chrome.storage.local.remove(SMARTAPPLY_ACTIVE_JOB_KEY);
    console.log("[Indeed SmartApply] 🔓 Released active job lock", {
      reason: reason || "unknown",
      jobId: active?.jobId || "",
    });
  } catch {
    // no-op
  }
}

function detectSmartApplyPageType(currentUrl, doc = document) {
  const url = String(currentUrl || "");
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return "";
    }
  })();

  // Count form elements for detailed logging
  const radios = doc.querySelectorAll('input[type="radio"]');
  const textInputs = doc.querySelectorAll('input[type="text"], textarea');
  const selects = doc.querySelectorAll('select');
  const checkboxes = doc.querySelectorAll('input[type="checkbox"]');
  const allInputs = doc.querySelectorAll('input, textarea, select');
  const buttons = doc.querySelectorAll('button');
  
  console.log("[Indeed SmartApply] 📊 Form inventory:", {
    radios: radios.length,
    textInputs: textInputs.length,
    selects: selects.length,
    checkboxes: checkboxes.length,
    totalInputs: allInputs.length,
    buttons: buttons.length,
    path: path
  });

  const hasResumeSignals =
    !!doc.querySelector('input[type="radio"], [role="radio"], [data-testid*="resume" i], [class*="resume" i]') ||
    /resume/i.test(doc.body?.textContent || "");
  const hasQuestionsSignals =
    !!doc.querySelector('textarea, select, input[type="text"], [data-testid*="question" i]') ||
    /question|qualification|email|phone|name/i.test(doc.body?.textContent || "");
  const hasReviewSignals =
    !!doc.querySelector('[data-testid*="review" i], [class*="review" i]') ||
    /review application|submit application/i.test(doc.body?.textContent || "");
  const hasSubmittedSignals = /application submitted|you applied|thank you for applying/i.test(
    (doc.body?.textContent || "").toLowerCase()
  );

  console.log("[Indeed SmartApply] 🔍 Page signals detected:", {
    hasResumeSignals,
    hasQuestionsSignals,
    hasReviewSignals,
    hasSubmittedSignals
  });

  // applybyapplyablejobid can be either resume picker or full details/questions form.
  // Prefer questions when form inputs exist so we actually fill user details.
  if (path.includes("/applybyapplyablejobid")) {
    const pageType = hasQuestionsSignals || textInputs.length > 0 || selects.length > 0 ? "questions" : "resume-selection";
    console.log("[Indeed SmartApply] ✅ Page type for applybyapplyablejobid:", pageType);
    return pageType;
  }

  if (path.includes("/resume-selection") || hasResumeSignals) {
    console.log("[Indeed SmartApply] ✅ Page type: resume-selection");
    return "resume-selection";
  }
  if (path.includes("/questions") || path.includes("qualification-questions") || hasQuestionsSignals) {
    console.log("[Indeed SmartApply] ✅ Page type: questions");
    return "questions";
  }
  if (path.includes("/contact-info") || path.includes("/contact-information")) {
    console.log("[Indeed SmartApply] ✅ Page type: contact-info");
    return "contact-info";
  }
  if (path.includes("/review") || hasReviewSignals) {
    console.log("[Indeed SmartApply] ✅ Page type: review");
    return "review";
  }
  if (path.includes("/confirmation") || hasSubmittedSignals) {
    console.log("[Indeed SmartApply] ✅ Page type: submitted");
    return "submitted";
  }
  console.log("[Indeed SmartApply] ⚠️ Page type: unknown");
  return "unknown";
}

async function handleSmartApplyForm() {
  const currentUrl = window.location.href;
  
  // Check if we're on smartapply.indeed.com
  if (!currentUrl.includes('smartapply.indeed.com')) {
    return;
  }
  
  console.log("[Indeed SmartApply] 🎯 Detected SmartApply form page");
  console.log("[Indeed SmartApply] 📍 URL:", currentUrl);
  console.log("[Indeed SmartApply] 📍 Full URL with params:", currentUrl);

  const smartApplyJobId = getSmartApplyJobIdFromUrl(currentUrl);
  console.log("[Indeed SmartApply] 🆔 Job ID:", smartApplyJobId || "unknown");

  const lock = await acquireSmartApplyJobLock(smartApplyJobId);
  if (!lock.ok) {
    console.log("[Indeed SmartApply] ⛔ Another job already in progress, focusing on one active job", {
      activeJobId: lock.activeJobId,
      incomingJobId: smartApplyJobId || "unknown",
      reason: lock.reason,
    });
    return;
  }
  console.log(
    `[Indeed SmartApply] 🔒 Active job lock ${lock.reused ? "reused" : "acquired"}:`,
    lock.activeJobId || "unknown"
  );
  
  const settings = await loadSettings();
  
  // If auto-submit is disabled, don't auto-fill
  if (!settings.autoSubmit) {
    console.log("[Indeed SmartApply] ⏸️ Auto-submit disabled, skipping auto-fill");
    return;
  }
  
  // Wait for page to fully load - check multiple times
  console.log("[Indeed SmartApply] ⏳ Waiting for page to fully load...");
  
  let loadAttempts = 0;
  const maxLoadAttempts = 25; // 25 seconds max wait
  let pageContentReady = false;
  
  while (loadAttempts < maxLoadAttempts) {
    await sleep(1000);
    loadAttempts++;
    
    // Check if page has loaded content
    const hasButtons = document.querySelectorAll('button').length > 0;
    const hasRadios = document.querySelectorAll('input[type="radio"]').length > 0;
    const hasTextInputs = document.querySelectorAll('input[type="text"], textarea').length > 0;
    const hasSelects = document.querySelectorAll('select').length > 0;
    const hasInputFields = hasTextInputs || hasSelects || hasRadios;
    const bodyText = document.body.textContent || '';
    const hasResumeText = bodyText.includes('resume') || bodyText.includes('Resume');
    const hasContent = bodyText.length > 100;
    const hasFormIndicators = hasRadios || hasResumeText || hasInputFields;
    
    console.log(`[Indeed SmartApply] ⏳ Load check ${loadAttempts}s - buttons: ${hasButtons}, inputs: ${hasInputFields}, form: ${hasFormIndicators}`);
    
    // applybyapplyablejobid can have either resume UI or form fields
    if (currentUrl.includes('/applybyapplyablejobid')) {
      if (hasFormIndicators && hasButtons && hasContent) {
        console.log(`[Indeed SmartApply] ✅ ApplyByApplyableJobId page loaded after ${loadAttempts}s`);
        pageContentReady = true;
        break;
      }
    } else if (currentUrl.includes('/resume-selection')) {
      if (hasRadios || hasResumeText) {
        console.log(`[Indeed SmartApply] ✅ Resume selection UI loaded after ${loadAttempts}s`);
        pageContentReady = true;
        break;
      }
    } else if (hasButtons && hasContent) {
      console.log(`[Indeed SmartApply] ✅ Page content loaded after ${loadAttempts}s`);
      pageContentReady = true;
      break;
    }
  }
  
  if (!pageContentReady) {
    console.log("[Indeed SmartApply] ⚠️ Page did not fully load after 25 seconds");
    console.log("[Indeed SmartApply] 📊 Current page state:", {
      hasButtons: document.querySelectorAll('button').length,
      hasInputs: document.querySelectorAll('input, textarea, select').length,
      bodyTextLength: (document.body.textContent || '').length,
      textSample: document.body.textContent.substring(0, 300)
    });
  }
  
  // Extra stabilization wait
  await sleep(2000);
  console.log("[Indeed SmartApply] ✅ Page fully stabilized, proceeding with automation");
  
  // Diagnostic: Log current page structure before detection
  console.log("[Indeed SmartApply] 📊 PRE-DETECTION PAGE STATE:");
  console.log("[Indeed SmartApply]   - URL:", currentUrl);
  console.log("[Indeed SmartApply]   - Buttons:", document.querySelectorAll('button').length);
  console.log("[Indeed SmartApply]   - Text inputs:", document.querySelectorAll('input[type="text"], textarea').length);
  console.log("[Indeed SmartApply]   - Selects:", document.querySelectorAll('select').length);
  console.log("[Indeed SmartApply]   - Radios:", document.querySelectorAll('input[type="radio"]').length);
  console.log("[Indeed SmartApply]   - Total form elements:", document.querySelectorAll('input, textarea, select').length);
  console.log("[Indeed SmartApply]   - Body text length:", (document.body.textContent || '').length);

  const pageType = detectSmartApplyPageType(currentUrl, document);
  console.log("[Indeed SmartApply] 🧭 Detected page type:", pageType);
  
  // Step 1: Handle resume selection page
  if (pageType === 'resume-selection') {
    console.log("[Indeed SmartApply] 📄 Resume selection page detected");
    
    // Check for iframes first
    const iframes = document.querySelectorAll('iframe');
    console.log(`[Indeed SmartApply] 🖼️ Found ${iframes.length} iframes on page`);
    
    // Try to access iframe content (if same-origin)
    let workingDocument = document;
    if (iframes.length > 0) {
      try {
        const mainIframe = iframes[0];
        const iframeDoc = mainIframe.contentDocument || mainIframe.contentWindow?.document;
        if (iframeDoc) {
          console.log("[Indeed SmartApply] ✅ Accessing iframe content");
          workingDocument = iframeDoc;
        }
      } catch (err) {
        console.log("[Indeed SmartApply] ⚠️ Cannot access iframe (cross-origin):", err.message);
      }
    }
    
    // Look for resume cards/sections (Indeed might use divs instead of radio buttons)
    const resumeCards = Array.from(workingDocument.querySelectorAll('[class*="resume" i], [data-testid*="resume" i], [role="radio"], [role="radiogroup"] > *'));
    console.log(`[Indeed SmartApply] 📋 Found ${resumeCards.length} resume card elements`);
    
    // Log all button-like elements for debugging
    const allButtons = workingDocument.querySelectorAll('button, [role="button"], input[type="radio"], label, a, div[role="button"], [class*="button" i]');
    console.log(`[Indeed SmartApply] 🔍 Total interactive elements found: ${allButtons.length}`);
    
    // Log first 15 for debugging (increased from 10)
    Array.from(allButtons).slice(0, 15).forEach((el, idx) => {
      const text = el.textContent?.trim().substring(0, 50) || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const type = el.tagName + (el.type ? `[${el.type}]` : '');
      const role = el.getAttribute('role') || '';
      console.log(`[Indeed SmartApply]   ${idx + 1}. ${type}${role ? ` role="${role}"` : ''}: "${text}" / aria: "${ariaLabel}"`);
    });
    
    // Look for the recommended resume (Indeed Resume or uploaded PDF)
    const resumeButtons = Array.from(workingDocument.querySelectorAll('button, [role="button"], input[type="radio"], label, div[role="button"], [class*="selectable" i]'));
    console.log(`[Indeed SmartApply] Found ${resumeButtons.length} potential resume buttons`);
    
    // Try to find and click a resume option
    let resumeClicked = false;
    for (const btn of resumeButtons) {
      const label = normalizeLabel(btn.textContent || btn.getAttribute('aria-label') || btn.getAttribute('title') || '');
      if (label.includes('indeed resume') || 
          label.includes('recommended') ||
          label.includes('.pdf') ||
          label.includes('resume') ||
          label.includes('use your') ||
          label.includes('upload')) {
        console.log(`[Indeed SmartApply] ✅ Clicking resume option: "${label}"`);
        
        // Simulate user interaction to avoid beforeunload block
        btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        btn.click();
        
        resumeClicked = true;
        await sleep(1500);
        break;
      }
    }
    
    if (!resumeClicked) {
      console.log("[Indeed SmartApply] ⚠️ No resume option found by label, checking for checked/selected states");
      
      // Maybe resume is already selected?
      const checkedRadio = workingDocument.querySelector('input[type="radio"]:checked');
      const selectedCard = workingDocument.querySelector('[class*="selected" i], [aria-selected="true"], [aria-checked="true"]');
      
      if (checkedRadio || selectedCard) {
        console.log("[Indeed SmartApply] ℹ️ Resume already selected");
        resumeClicked = true; // Consider it clicked since one is selected
      } else {
        console.log("[Indeed SmartApply] ⚠️ No selected resume found, trying first clickable resume element");
        const firstClickable = workingDocument.querySelector('input[type="radio"], [role="radio"], div[class*="resume" i][class*="card" i], [data-testid*="resume" i]');
        if (firstClickable) {
          console.log("[Indeed SmartApply] 🔘 Clicking first resume element:", firstClickable.tagName, firstClickable.className);
          firstClickable.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
          firstClickable.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
          firstClickable.click();
          resumeClicked = true;
          await sleep(1500);
        } else {
          console.log("[Indeed SmartApply] ❌ No radio buttons or resume cards found");
          console.log("[Indeed SmartApply] 📊 Page structure - main elements:", 
            Array.from(workingDocument.querySelectorAll('main, [role="main"], #main')).map(el => el.tagName + '.' + el.className).join(', '));
        }
      }
    }
    
    // Find and click Continue/Next button with proper user gesture
    await sleep(1500);
    
    console.log("[Indeed SmartApply] 🔍 Looking for Continue/Next button...");
    const allButtonsForContinue = Array.from(workingDocument.querySelectorAll('button, [role="button"], input[type="submit"], a[class*="button" i]'));
    console.log(`[Indeed SmartApply] Found ${allButtonsForContinue.length} button elements`);
    
    // Log all buttons to see what's available
    allButtonsForContinue.forEach((btn, idx) => {
      const text = normalizeLabel(btn.textContent || '');
      console.log(`[Indeed SmartApply]   Button ${idx + 1}: "${text}"`);
    });
    
    const continueBtn = allButtonsForContinue.find(btn => {
      const text = normalizeLabel(btn.textContent || btn.getAttribute('aria-label') || '');
      return text.includes('continue') || text.includes('next') || text === 'submit' || text.includes('proceed') || text.includes('review');
    });
    
    if (continueBtn) {
      const btnText = normalizeLabel(continueBtn.textContent || '');
      console.log(`[Indeed SmartApply] ➡️ Clicking Continue button: "${btnText}"`);
      
      // Simulate full click sequence to establish user gesture
      continueBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window }));
      await sleep(100);
      continueBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      await sleep(50);
      continueBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      continueBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      continueBtn.click(); // Also use regular click as fallback
      
      console.log("[Indeed SmartApply] ✅ Continue button clicked");
    } else {
      console.log("[Indeed SmartApply] ⚠️ Continue button not found - check button labels above");
      console.log("[Indeed SmartApply] 💡 TIP: You may need to manually click Continue to proceed");
    }
    
    console.log("[Indeed SmartApply] ✅ Resume selection handling complete");
    return; // Exit after handling resume page
  }
  
  // Step 2: Handle questions page (both types)
  if (pageType === 'questions') {
    console.log("[Indeed SmartApply] ❓ Questions page detected");
    console.log("[Indeed SmartApply] 📋 URL type:", currentUrl.includes('qualification-questions') ? 'Qualification Questions' : 'General Questions');
    
    // Count questions
    const textInputs = document.querySelectorAll('textarea, input[type="text"]:not([type="hidden"])');
    const selects = document.querySelectorAll('select');
    const radios = document.querySelectorAll('input[type="radio"]');
    
    console.log(`[Indeed SmartApply] 📊 Found: ${textInputs.length} text fields, ${selects.length} dropdowns, ${radios.length} radio buttons`);
    
    // Auto-fill known profile answers from settings and pause only for unresolved required questions.
    const pendingQuestions = fillBasicFields(document, settings);
    console.log(`[Indeed SmartApply] 📝 Auto-fill complete. Pending required questions: ${pendingQuestions.length}`);

    if (pendingQuestions.length) {
      await sendMessage({ type: "CP_REGISTER_PENDING_QUESTIONS", questions: pendingQuestions }).catch(() => {});
      console.log("[Indeed SmartApply] ⏸️ Manual input still required for unresolved fields");
      console.log("[Indeed SmartApply] 📌 Pending:", pendingQuestions);
      return;
    }

    // If everything required is filled, continue to next step.
    const continueBtn = findPrimaryActionButton(document);
    if (continueBtn) {
      const text = normalizeText(continueBtn.textContent || continueBtn.getAttribute('aria-label') || 'Continue');
      console.log(`[Indeed SmartApply] ➡️ Clicking action after auto-fill: "${text}"`);
      continueBtn.click();
      return;
    }

    console.log("[Indeed SmartApply] ⚠️ No action button found after auto-fill. Manual continue may be required.");
    return; // Stay on this page - don't navigate away
  }
  
  // Step 3: Handle contact info page
  if (pageType === 'contact-info') {
    console.log("[Indeed SmartApply] 📱 Contact info page detected");
    const pendingContactFields = fillBasicFields(document, settings);
    console.log(`[Indeed SmartApply] 🧾 Contact auto-fill complete. Pending required fields: ${pendingContactFields.length}`);

    if (!pendingContactFields.length) {
      const continueBtn = findPrimaryActionButton(document);
      if (continueBtn) {
        const text = normalizeText(continueBtn.textContent || continueBtn.getAttribute('aria-label') || 'Continue');
        console.log(`[Indeed SmartApply] ➡️ Clicking contact action: "${text}"`);
        continueBtn.click();
        return;
      }
    }

    console.log("[Indeed SmartApply] ℹ️ Verify your contact information and click Continue");
    
    return; // Let user verify contact info
  }
  
  // Step 4: Handle review page
  if (pageType === 'review') {
    console.log("[Indeed SmartApply] 👀 Review page detected");
    if (settings?.autoSubmit) {
      console.log("[Indeed SmartApply] 🚀 Auto-submitting reviewed application...");
      const submitBtn = findPrimaryApplyAction(document);
      if (submitBtn) {
        submitBtn.click();
        await sleep(2000);
      } else {
        console.log("[Indeed SmartApply] ⚠️ Submit button not found on review page");
      }
    } else {
      console.log("[Indeed SmartApply] ⚠️ Review application before submitting (manual submit mode)");
    }
    return;
  }

  // Step 5: Handle confirmation/submitted page
  if (pageType === 'submitted') {
    console.log("[Indeed SmartApply] 🎉 Application submitted page detected");
    await releaseSmartApplyJobLock("submitted");
    const safeJobId = smartApplyJobId || "indeed_smartapply_job";
    await recordOutcome("APPLIED", {
      jobId: safeJobId,
      title: document.title || "Indeed Job Application",
      company: "Indeed Employer",
      reasonCode: "SUBMITTED",
      reason: "Application submitted via SmartApply",
    }).catch(() => {});
    await pushLog("SmartApply application successfully submitted!", "success").catch(() => {});
    return;
  }
  
  // Unknown page type
  console.log("[Indeed SmartApply] ❓ Unknown SmartApply page type");
  const signature = {
    pathname: (() => {
      try {
        return new URL(currentUrl).pathname;
      } catch {
        return "";
      }
    })(),
    title: document.title,
    buttonCount: document.querySelectorAll('button').length,
    inputCount: document.querySelectorAll('input, textarea, select').length,
    firstButtons: Array.from(document.querySelectorAll('button'))
      .slice(0, 8)
      .map((b) => normalizeText(b.textContent || b.getAttribute('aria-label') || '')),
  };
  console.log("[Indeed SmartApply] 🧪 Unknown page signature:", signature);
  console.log("[Indeed SmartApply] ℹ️ Manual interaction required");
}

// Run SmartApply handler if we're on that page
if (window.location.href.includes('smartapply.indeed.com')) {
  try {
    const smartApplyUrl = new URL(window.location.href);
    if (smartApplyUrl.pathname.startsWith('/jobs')) {
      const fallbackUrl = `https://www.indeed.com/jobs${smartApplyUrl.search || ''}`;
      console.warn('[Indeed SmartApply] ⚠️ Invalid SmartApply jobs URL detected. Redirecting to Indeed jobs:', fallbackUrl);
      window.location.replace(fallbackUrl);
    }
  } catch {
    // no-op
  }

  console.log("[Indeed SmartApply] 🚀 SmartApply page detected, initializing handler");
  
  // Prevent beforeunload dialogs from blocking navigation
  window.addEventListener('beforeunload', (e) => {
    // Don't show confirmation dialog
    delete e['returnValue'];
  }, { capture: true });
  
  // Run with error handling
  handleSmartApplyForm().then(() => {
    console.log("[Indeed SmartApply] ✅ Handler completed successfully");
  }).catch(err => {
    console.error("[Indeed SmartApply] ❌ Error handling SmartApply form:", err);
    console.error("[Indeed SmartApply] ❌ Error stack:", err.stack);
  });
}

// Start Cloudflare challenge monitoring on all Indeed and SmartApply pages
if (window.location.href.includes('indeed.com') || window.location.href.includes('smartapply.indeed.com')) {
  startCloudflareMonitoring();
}

// Always run boot to show the floating panel on every Indeed page
boot();
