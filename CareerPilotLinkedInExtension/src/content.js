const PANEL_ID = "cp-linkedin-copilot-panel";
const TOGGLE_ID = "cp-linkedin-copilot-toggle";
const STATE_POLL_MS = 1200;
const STEP_DELAY_MS = 900;
const NO_PROGRESS_TIMEOUT_MS = 120000;
const NO_PROGRESS_MAX_CYCLES = 25;
const EXHAUSTED_RESULTS_PAGE_STREAK_LIMIT = 6;
const MANUAL_ANSWER_WAIT_MS = 180000;
const MANUAL_ANSWER_POLL_MS = 1500;
const JOBS_SEARCH_URL = "https://www.linkedin.com/jobs/search/?f_AL=true";
const PANEL_PREFS_KEY = "cpPanelPrefs";
const RUN_SEEN_STORAGE_KEY = "cpRunSeenSnapshot";
const JOB_OUTCOME_CACHE_KEY = "cpSeenJobOutcomeCache";
const JOB_OUTCOME_CACHE_SCHEMA_KEY = "cpSeenJobOutcomeCacheSchema";
const LAST_SEARCH_RESULTS_URL_KEY = "cpLastSearchResultsUrl";
const ADVANCED_FILTERS_APPLIED_KEY = "cpAdvancedFiltersApplied";
const JOB_OUTCOME_CACHE_SCHEMA_VERSION = 2;
const APPLIED_JOB_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ALREADY_APPLIED_TTL_MS = 24 * 60 * 60 * 1000;
const NO_APPLY_TTL_MS = 35 * 60 * 1000;
const GENERIC_SKIP_TTL_MS = 20 * 60 * 1000;
const MAX_JOB_OUTCOME_CACHE_ITEMS = 8000;
const KNOWN_APPLIED_REFRESH_MS = 30 * 1000;
const REMOTE_LOCATION_KEYWORDS = [
  "Remote",
  "Work from home",
  "WFH",
  "Telecommute",
  "Distributed",
  "Virtual",
  "Anywhere",
  "100% Remote",
  "Telework",
];

let panelEl = null;
let runningLoop = false;
let runStats = { applied: 0, skipped: 0, failed: 0 };
let preparedRun = false;
let exhaustedSearchPageStreak = 0;
let extensionContextAlive = true;
let debugBadgeEl = null;
let debugUiEnabled = false;
let runSeenJobKeys = new Set();
let runSearchTermCursor = 0;
let runSearchTermSuccessCount = 0;
let runRemoteLocationKeywordCursor = 0;
let lastRunStartedAt = null;
let dailyLimitHandledRunId = "";
let resumeChoiceCache = new Map();
let aiAnswerCache = new Map();
let lastBootstrapSettings = {};
let lastPortalQuota = null;
let knownAppliedJobIds = new Set();
let knownAppliedLoadedAt = 0;
let logAutoScrollPinnedToBottom = true;
let lastLogRenderSignature = "";
let lastAutoSubmitAtMs = 0;
let activeSubmitPaceDelayMs = 0;
let activeSubmitPaceStartMs = 0;
let warnedDefaultYearsFallback = false;
let remoteSelectors = null;
let remoteSelectorsVersion = 0;
let panelActiveTab = "feed";

const ICONS = {
  sparkle: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
  rocket: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`,
  skip: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`,
  coin: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  target: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  file: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  clock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  alert: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  bolt: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  play: `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  pause: `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
  stop: `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`,
  activity: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  trash: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  list: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`
};

// ── Detailed debug log buffer ──────────────────────────────────────────
const MAX_DEBUG_LOG_ENTRIES = 2000;
let debugLogBuffer = [];
let debugTimers = {};

function captureDebugEvent(category, event, data = {}) {
  const entry = {
    ts: new Date().toISOString(),
    cat: category,
    evt: event,
    ...data,
  };
  debugLogBuffer.push(entry);
  if (debugLogBuffer.length > MAX_DEBUG_LOG_ENTRIES) {
    debugLogBuffer = debugLogBuffer.slice(-MAX_DEBUG_LOG_ENTRIES);
  }
  try {
    console.debug(`[CP][${category}]`, event, data);
  } catch { /* ignore */ }
}

function startTimer(label) {
  debugTimers[label] = performance.now();
}

function endTimer(label) {
  const start = debugTimers[label];
  if (start == null) return 0;
  const elapsed = Math.round(performance.now() - start);
  delete debugTimers[label];
  return elapsed;
}

function capturePageSnapshot(context = "") {
  return {
    url: window.location.href,
    pathname: window.location.pathname,
    title: document.title || "",
    context,
  };
}

function buildDebugLogExport() {
  const settingsSnapshot = {};
  try {
    const raw = window.sessionStorage.getItem("cpLastSearchResultsUrl") || "";
    settingsSnapshot.lastSearchUrl = raw;
  } catch { /* ignore */ }
  return {
    exportedAt: new Date().toISOString(),
    bufferSize: debugLogBuffer.length,
    page: capturePageSnapshot(),
    settingsSnapshot,
    entries: debugLogBuffer,
  };
}

async function downloadDebugLogFile() {
  const payload = buildDebugLogExport();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `cp-debug-log-${stamp}.json`;
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    captureDebugEvent("debug-export", "download-triggered", { filename, entries: payload.bufferSize });
    await botChat(`Debug log downloaded (${payload.bufferSize} entries).`);
  } catch (err) {
    captureDebugEvent("debug-export", "download-failed", { error: String(err) });
    await botChat("Failed to download debug log.", "error");
  }
}

function readPersistedNumber(key) {
  try {
    const raw = window.localStorage.getItem(key);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writePersistedNumber(key, value) {
  try {
    window.localStorage.setItem(key, String(Number(value) || 0));
  } catch {
    // ignore
  }
}

function hydrateSubmitPaceFromStorage() {
  if (lastAutoSubmitAtMs) return;
  const persisted = readPersistedNumber("cpLastAutoSubmitAtMs");
  if (persisted > 0) {
    lastAutoSubmitAtMs = persisted;
  }
}

function clampNumber(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function getSubmitPaceRangeMs(settings) {
  const minSec = clampNumber(settings?.submitRateMinSec, 40, 5, 600);
  const maxSec = clampNumber(settings?.submitRateMaxSec, 70, minSec, 900);
  return { minMs: Math.floor(minSec * 1000), maxMs: Math.floor(maxSec * 1000) };
}

function formatPaceLabel(range) {
  const minSec = Math.round(range.minMs / 1000);
  const maxSec = Math.round(range.maxMs / 1000);
  if (minSec === maxSec) return `${minSec}s`;
  return `${minSec}–${maxSec}s`;
}

function pickPaceDelayMs(range) {
  const span = Math.max(0, Number(range.maxMs || 0) - Number(range.minMs || 0));
  const jitter = span > 0 ? Math.floor(Math.random() * (span + 1)) : 0;
  return Math.max(0, Number(range.minMs || 0) + jitter);
}

function setRateLimitUiText(text) {
  try {
    const el = panelEl?.querySelector?.("#cp-rate");
    if (!el) return;
    el.textContent = String(text || "");
  } catch {
    // ignore
  }
}

async function enforceSubmitRateLimit(settings) {
  if (!settings || settings.dryRun || !settings.autoSubmit) return { ok: true, waitedMs: 0 };
  hydrateSubmitPaceFromStorage();
  await debugLog(settings, "Rate limit check", {
    dryRun: Boolean(settings?.dryRun),
    autoSubmit: Boolean(settings?.autoSubmit),
    lastAutoSubmitAtMs,
    persistedLastAutoSubmitAtMs: readPersistedNumber("cpLastAutoSubmitAtMs") || 0,
  });
  const range = getSubmitPaceRangeMs(settings);
  const paceLabel = formatPaceLabel(range);
  if (!lastAutoSubmitAtMs) {
    setRateLimitUiText(`Rate limit: ${paceLabel} between submits · first submit (no wait)`);
    await debugLog(settings, "Rate limit decision: first submit (no wait)", { paceLabel });
    return { ok: true, waitedMs: 0 };
  }

  const now = Date.now();
  if (!activeSubmitPaceDelayMs || !activeSubmitPaceStartMs || activeSubmitPaceStartMs < lastAutoSubmitAtMs) {
    activeSubmitPaceStartMs = lastAutoSubmitAtMs;
    activeSubmitPaceDelayMs = pickPaceDelayMs(range);
    await debugLog(settings, "Rate limit picked new delay", {
      paceLabel,
      activeSubmitPaceStartMs,
      activeSubmitPaceDelayMs,
    });
  }
  const nextAllowedAt = activeSubmitPaceStartMs + activeSubmitPaceDelayMs;
  let remainingMs = Math.max(0, nextAllowedAt - now);
  if (!remainingMs) {
    const elapsedSec = Math.max(0, Math.floor((now - lastAutoSubmitAtMs) / 1000));
    const targetSec = Math.max(0, Math.floor(activeSubmitPaceDelayMs / 1000));
    setRateLimitUiText(`Rate limit: ${paceLabel} between submits · ok (elapsed ${elapsedSec}s / target ${targetSec}s)`);
    await debugLog(settings, "Rate limit decision: no wait needed", {
      paceLabel,
      elapsedSec,
      targetSec,
      lastAutoSubmitAtMs,
      now,
    });
    return { ok: true, waitedMs: 0 };
  }

  await logLine(`Rate limit: waiting ${Math.ceil(remainingMs / 1000)}s before next submit`, "info");
  const startedWaitingAt = Date.now();
  while (remainingMs > 0) {
    const state = (await sendMessage({ type: "CP_GET_BOOTSTRAP" })).state;
    if (!state?.running || state?.paused) {
      setRateLimitUiText(`Rate limit: ${paceLabel} between submits`);
      return { ok: false, waitedMs: Date.now() - startedWaitingAt, canceled: true };
    }
    setRateLimitUiText(`Rate limit: ${paceLabel} · next submit in ${Math.ceil(remainingMs / 1000)}s`);
    const step = Math.min(1000, remainingMs);
    await sleep(step);
    remainingMs = Math.max(0, nextAllowedAt - Date.now());
  }
  setRateLimitUiText(`Rate limit: ${paceLabel} between submits · ok`);
  return { ok: true, waitedMs: Date.now() - startedWaitingAt };
}
let currentJobContext = {
  title: "",
  company: "",
  workLocation: "",
  description: "",
  aboutCompany: "",
  jobId: "",
  jobUrl: ""
};
let panelPrefs = {
  left: null,
  top: null,
  width: null,
  height: null,
  minimized: false,
  maximized: false
};

function wantsDebugUiFromUrl() {
  try {
    const v = new URLSearchParams(window.location.search || "").get("cpDebug");
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

function wantsDebugUiFromLocalStorage() {
  try {
    return localStorage.getItem("cpDebugUi") === "1";
  } catch {
    return false;
  }
}

function removeDebugBadge() {
  try {
    if (debugBadgeEl && debugBadgeEl.parentNode) debugBadgeEl.remove();
  } catch {
    // ignore
  } finally {
    debugBadgeEl = null;
  }
}

function setDebugUiEnabled(enabled) {
  debugUiEnabled = Boolean(enabled);
  if (panelEl) panelEl.classList.toggle("cp-debug-ui", debugUiEnabled);
  if (!debugUiEnabled) removeDebugBadge();
}

function ensureDebugBadge() {
  if (!debugUiEnabled) return null;
  if (debugBadgeEl && document.body.contains(debugBadgeEl)) return debugBadgeEl;
  const el = document.createElement("div");
  el.id = "cp-panel-debug-badge";
  Object.assign(el.style, {
    position: "fixed",
    left: "10px",
    top: "10px",
    zIndex: "2147483647",
    background: "rgba(0,0,0,0.72)",
    color: "#fff",
    fontSize: "11px",
    padding: "4px 8px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.3)",
    fontFamily: "monospace",
    cursor: "pointer",
    maxWidth: "70vw",
  });
  el.title = "Click to reset copilot panel position";
  el.addEventListener("click", () => {
    panelPrefs.left = Math.max(8, window.innerWidth - 440);
    panelPrefs.top = 84;
    panelPrefs.minimized = false;
    panelPrefs.maximized = false;
    savePanelPrefs();
    applyPanelLayout();
    logPanelDebug("debug-badge-reset");
  });
  document.body.appendChild(el);
  debugBadgeEl = el;
  return el;
}

function logPanelDebug(reason = "state") {
  if (!debugUiEnabled) return;
  try {
    const badge = ensureDebugBadge();
    if (!badge) return;
    if (!panelEl) {
      badge.textContent = `CP: panel missing (${reason})`;
      console.debug("[CP]", reason, "panel missing");
      return;
    }
    const rect = panelEl.getBoundingClientRect();
    const visible =
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth;
    badge.textContent = `CP: ${visible ? "visible" : "offscreen"} x=${Math.round(rect.left)} y=${Math.round(rect.top)} w=${Math.round(rect.width)} h=${Math.round(rect.height)} (${reason})`;
    console.debug("[CP]", reason, {
      visible,
      rect: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      prefs: panelPrefs,
      className: panelEl.className,
    });
  } catch {
    // ignore debug failures
  }
}

function markContextInvalidated() {
  extensionContextAlive = false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadRunSeenJobKeys(runStartedAt) {
  const runId = String(runStartedAt || "").trim();
  if (!runId) return new Set();
  try {
    const raw = localStorage.getItem(RUN_SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return new Set();
    if (String(parsed.startedAt || "") !== runId) return new Set();
    const keys = Array.isArray(parsed.keys) ? parsed.keys : [];
    return new Set(keys.map((k) => String(k || "").trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

function persistRunSeenJobKeys(runStartedAt) {
  const runId = String(runStartedAt || "").trim();
  try {
    if (!runId) {
      localStorage.removeItem(RUN_SEEN_STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      RUN_SEEN_STORAGE_KEY,
      JSON.stringify({
        startedAt: runId,
        keys: Array.from(runSeenJobKeys).slice(0, 5000)
      })
    );
  } catch {
    // ignore storage failures
  }
}

function markJobSeen(jobKey) {
  const key = String(jobKey || "").trim();
  if (!key) return;
  runSeenJobKeys.add(key);
  persistRunSeenJobKeys(lastRunStartedAt);
}

function normalizeJobOutcomeCacheEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const jobKey = String(entry.jobKey || "").trim();
  if (!jobKey) return null;
  return {
    jobKey,
    status: String(entry.status || "SEEN").trim().toUpperCase(),
    reasonCode: String(entry.reasonCode || "").trim().toUpperCase(),
    ts: Number(entry.ts || Date.now()),
    expiresAt: Number(entry.expiresAt || Date.now()),
  };
}

function ensureJobOutcomeCacheSchema() {
  try {
    const raw = localStorage.getItem(JOB_OUTCOME_CACHE_SCHEMA_KEY);
    const current = Number(raw || 0);
    if (current === JOB_OUTCOME_CACHE_SCHEMA_VERSION) return;
    localStorage.removeItem(JOB_OUTCOME_CACHE_KEY);
    localStorage.setItem(JOB_OUTCOME_CACHE_SCHEMA_KEY, String(JOB_OUTCOME_CACHE_SCHEMA_VERSION));
  } catch {
    // ignore storage failures
  }
}

function loadJobOutcomeCache() {
  ensureJobOutcomeCacheSchema();
  try {
    const raw = localStorage.getItem(JOB_OUTCOME_CACHE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : [];
    const now = Date.now();
    const map = new Map();
    for (const item of items) {
      const normalized = normalizeJobOutcomeCacheEntry(item);
      if (!normalized) continue;
      if (normalized.expiresAt <= now) continue;
      map.set(normalized.jobKey, normalized);
    }
    return map;
  } catch {
    return new Map();
  }
}

function persistJobOutcomeCache(cacheMap) {
  try {
    const items = Array.from(cacheMap.values())
      .sort((a, b) => b.ts - a.ts)
      .slice(0, MAX_JOB_OUTCOME_CACHE_ITEMS);
    localStorage.setItem(JOB_OUTCOME_CACHE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage failures
  }
}

function getJobOutcomeTtlMs(status, reasonCode = "") {
  const s = String(status || "").toUpperCase();
  const reason = String(reasonCode || "").toUpperCase();
  if (s === "APPLIED") return APPLIED_JOB_TTL_MS;
  if (reason === "ALREADY_APPLIED") return ALREADY_APPLIED_TTL_MS;
  if (reason === "NO_APPLY_BUTTON" || reason === "EXTERNAL_APPLY_ONLY") return NO_APPLY_TTL_MS;
  return GENERIC_SKIP_TTL_MS;
}

function recordJobOutcomeCache(jobKey, status, reasonCode = "") {
  const key = String(jobKey || "").trim();
  if (!key) return;
  const now = Date.now();
  const ttlMs = getJobOutcomeTtlMs(status, reasonCode);
  const cache = loadJobOutcomeCache();
  cache.set(key, {
    jobKey: key,
    status: String(status || "SEEN").toUpperCase(),
    reasonCode: String(reasonCode || "").toUpperCase(),
    ts: now,
    expiresAt: now + ttlMs,
  });
  persistJobOutcomeCache(cache);
}

function getCachedJobOutcome(jobKey) {
  const key = String(jobKey || "").trim();
  if (!key) return null;
  const cache = loadJobOutcomeCache();
  const found = cache.get(key);
  if (!found) return null;
  if (found.expiresAt <= Date.now()) {
    cache.delete(key);
    persistJobOutcomeCache(cache);
    return null;
  }
  return found;
}

function isTransientSkipCooldownOutcome(entry) {
  if (!entry || typeof entry !== "object") return false;
  const reason = String(entry.reasonCode || "").toUpperCase();
  const ageMs = Math.max(0, Date.now() - Number(entry.ts || 0));
  if (reason === "NO_APPLY_BUTTON") return ageMs < 20 * 60 * 1000;
  if (reason === "MODAL_NOT_FOUND") return ageMs < 20 * 60 * 1000;
  if (reason === "EXTERNAL_APPLY_ONLY") return ageMs < 60 * 60 * 1000;
  return false;
}

function isAppliedCacheHit(entry) {
  if (!entry || typeof entry !== "object") return false;
  const status = String(entry.status || "").toUpperCase();
  const reason = String(entry.reasonCode || "").toUpperCase();
  const ageMs = Math.max(0, Date.now() - Number(entry.ts || 0));
  if (status === "APPLIED") return true;
  if (reason === "ALREADY_APPLIED") return ageMs < ALREADY_APPLIED_TTL_MS;
  return false;
}

function collectKnownAppliedFromLocalOutcomeCache() {
  const cache = loadJobOutcomeCache();
  const ids = [];
  for (const entry of cache.values()) {
    const status = String(entry?.status || "").toUpperCase();
    const reasonCode = String(entry?.reasonCode || "").toUpperCase();
    const key = String(entry?.jobKey || "").trim();
    if (!/^\d+$/.test(key)) continue;
    if (status === "APPLIED" || reasonCode === "ALREADY_APPLIED") ids.push(key);
  }
  return ids;
}

async function refreshKnownAppliedJobIds(force = false) {
  const now = Date.now();
  if (!force && now - knownAppliedLoadedAt < KNOWN_APPLIED_REFRESH_MS && knownAppliedJobIds.size) {
    return knownAppliedJobIds;
  }

  const merged = new Set([...knownAppliedJobIds, ...collectKnownAppliedFromLocalOutcomeCache()]);
  const res = await sendMessage({ type: "CP_GET_APPLIED_JOB_IDS" });
  if (res?.ok && Array.isArray(res.jobIds)) {
    for (const id of res.jobIds) {
      const normalized = String(id || "").trim();
      if (/^\d+$/.test(normalized)) merged.add(normalized);
    }
  }
  knownAppliedJobIds = merged;
  knownAppliedLoadedAt = now;
  return knownAppliedJobIds;
}

function markKnownApplied(jobKey) {
  const key = String(jobKey || "").trim();
  if (!/^\d+$/.test(key)) return;
  knownAppliedJobIds.add(key);
}

function clearSeenJobsForRun(runStartedAt = "") {
  runSeenJobKeys = new Set();
  persistRunSeenJobKeys(runStartedAt);
}

function loadPanelPrefs() {
  try {
    const raw = localStorage.getItem(PANEL_PREFS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    panelPrefs = {
      ...panelPrefs,
      ...parsed
    };
  } catch {
    // ignore corrupted prefs
  }
}

function savePanelPrefs() {
  try {
    localStorage.setItem(PANEL_PREFS_KEY, JSON.stringify(panelPrefs));
  } catch {
    // ignore storage failures
  }
}

function applyPanelLayout() {
  if (!panelEl) return;
  panelEl.classList.toggle("cp-minimized", Boolean(panelPrefs.minimized));
  panelEl.classList.toggle("cp-maximized", Boolean(panelPrefs.maximized));
  if (panelPrefs.maximized) {
    panelEl.style.left = "12px";
    panelEl.style.top = "12px";
    panelEl.style.right = "12px";
    panelEl.style.bottom = "12px";
    panelEl.style.width = "auto";
    panelEl.style.maxHeight = "none";
    panelEl.style.height = "calc(100vh - 24px)";
    return;
  }

  panelEl.style.right = "auto";
  panelEl.style.bottom = "auto";
  const fallbackLeft = Math.max(8, window.innerWidth - 440);
  const fallbackTop = 84;
  if (typeof panelPrefs.left === "number") {
    const maxLeft = Math.max(8, window.innerWidth - 140);
    panelEl.style.left = `${Math.max(8, Math.min(maxLeft, panelPrefs.left))}px`;
  } else {
    panelEl.style.left = `${fallbackLeft}px`;
    panelPrefs.left = fallbackLeft;
  }
  if (typeof panelPrefs.top === "number") {
    const maxTop = Math.max(8, window.innerHeight - 90);
    panelEl.style.top = `${Math.max(8, Math.min(maxTop, panelPrefs.top))}px`;
  } else {
    panelEl.style.top = `${fallbackTop}px`;
    panelPrefs.top = fallbackTop;
  }
  if (typeof panelPrefs.width === "number" && panelPrefs.width >= 320) {
    panelEl.style.width = `${Math.min(window.innerWidth - 16, panelPrefs.width)}px`;
  } else {
    panelEl.style.width = "min(520px, calc(100vw - 22px))";
  }
  // Give the flex column a definite height so the log can shrink and the composer stays visible.
  panelEl.style.height = "78vh";
  panelEl.style.maxHeight = "78vh";
  logPanelDebug("apply-layout");
}

function setPanelMinimized(minimized) {
  panelPrefs.minimized = Boolean(minimized);
  savePanelPrefs();
  applyPanelLayout();
}

function setPanelMaximized(maximized) {
  panelPrefs.maximized = Boolean(maximized);
  if (maximized) {
    panelPrefs.minimized = false;
  }
  savePanelPrefs();
  applyPanelLayout();
}

function enablePanelDragging() {
  if (!panelEl) return;
  const head = panelEl.querySelector(".cp-head");
  if (!head) return;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const onMouseMove = (event) => {
    if (!dragging || !panelEl) return;
    const nextLeft = Math.max(8, Math.min(window.innerWidth - 120, event.clientX - offsetX));
    const nextTop = Math.max(8, Math.min(window.innerHeight - 80, event.clientY - offsetY));
    panelPrefs.left = nextLeft;
    panelPrefs.top = nextTop;
    panelEl.style.left = `${nextLeft}px`;
    panelEl.style.top = `${nextTop}px`;
    panelEl.style.right = "auto";
    panelEl.style.bottom = "auto";
  };

  const onMouseUp = () => {
    if (!dragging) return;
    dragging = false;
    panelEl?.classList.remove("cp-dragging");
    savePanelPrefs();
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  head.addEventListener("mousedown", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest(".cp-window-actions, button, input")) {
      return;
    }
    if (panelPrefs.maximized) {
      setPanelMaximized(false);
    }
    if (!panelEl) return;
    const rect = panelEl.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    dragging = true;
    panelEl.classList.add("cp-dragging");
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  });
}

function sendMessage(message) {
  return new Promise((resolve) => {
    if (!extensionContextAlive) {
      resolve({ ok: false, error: "Extension context invalidated" });
      return;
    }
    if (!chrome?.runtime?.id) {
      markContextInvalidated();
      resolve({ ok: false, error: "Extension runtime unavailable" });
      return;
    }
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const runtimeError = chrome.runtime?.lastError;
        if (runtimeError) {
          const msg = String(runtimeError.message || "Runtime message error");
          if (msg.toLowerCase().includes("context invalidated")) {
            markContextInvalidated();
          }
          resolve({ ok: false, error: msg });
          return;
        }
        resolve(response || { ok: false });
      });
    } catch (error) {
      const msg = String(error?.message || error || "Runtime sendMessage failed");
      if (msg.toLowerCase().includes("context invalidated")) {
        markContextInvalidated();
      }
      resolve({ ok: false, error: msg });
    }
  });
}

async function reportProgress() {
  const response = await sendMessage({ type: "CP_PROGRESS", ...runStats });
  if (response?.ok) return true;
  const code = String(response?.errorCode || "").toUpperCase();
  if (code === "DAILY_CAP_REACHED") {
    await logLine("Daily cap reached (3/day). Stopping run.", "warn");
    await botChat("Daily application limit reached. AI Copilot is pausing for today.", "warn");
    await sendMessage({ type: "CP_STOP" });
    return false;
  }
  return true;
}

window.addEventListener("unhandledrejection", (event) => {
  const msg = String(event?.reason?.message || event?.reason || "");
  if (msg.toLowerCase().includes("extension context invalidated")) {
    markContextInvalidated();
    event.preventDefault();
  }
});

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function logLine(message, level = "info", meta = undefined) {
  return sendMessage({ type: "CP_LOG", message, level, meta });
}

function userChat(text) {
  return logLine(`You: ${String(text || "").trim()}`, "user");
}

function botChat(text, level = "info") {
  return logLine(`Copilot: ${String(text || "").trim()}`, level);
}

async function debugLog(settings, message, meta = undefined) {
  if (!settings?.debugMode) return;
  await logLine(`[debug] ${message}`, "info", meta);
}

function getBySelectorList(selectors, root = document) {
  for (const s of selectors) {
    const el = root.querySelector(s);
    if (el) return el;
  }
  return null;
}

function getAllBySelectorList(selectors, root = document) {
  for (const s of selectors) {
    const list = root.querySelectorAll(s);
    if (list.length) return Array.from(list);
  }
  return [];
}

async function loadRemoteSelectors() {
  try {
    const res = await sendMessage({ type: "CP_GET_SELECTORS" });
    if (res?.ok && res.selectors) {
      remoteSelectors = res.selectors;
      remoteSelectorsVersion = res.version || 0;
    }
  } catch {}
}

function getS(key) {
  if (remoteSelectors && remoteSelectors[key]) return remoteSelectors[key];
  return null;
}

function checkSelectorHealth() {
  const jobCards = getAllBySelectorList(getS("jobCards") || [
    ".job-card-container",
    "[data-occludable-job-id]",
    "li.jobs-search-results__list-item",
    ".jobs-search-results-list__list-item",
    "li.scaffold-layout__list-item",
  ]);
  const hasJobCards = jobCards.length > 0;
  const hasSearchInput = !!getBySelectorList(getS("searchInput") || [
    "input.jobs-search-box__text-input",
    "input[aria-label*='Search by']",
    "input[placeholder*='Search']",
  ]);
  const hasApplyButton = !!getBySelectorList(getS("easyApplyButton") || [
    "button.jobs-apply-button",
    "button[aria-label*='Easy Apply']",
    "button[aria-label*='Apply']",
  ]);
  return {
    ok: hasJobCards || hasSearchInput,
    hasJobCards,
    hasSearchInput,
    hasApplyButton,
    jobCardCount: jobCards.length,
  };
}

function safeQuerySelectorAll(root, selector, settings = null, context = "querySelectorAll") {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch (error) {
    void debugLog(settings || { debugMode: true }, `${context} selector failed`, {
      selector,
      error: error?.message || String(error)
    });
    return [];
  }
}

function isJobsPage() {
  return window.location.pathname.startsWith("/jobs");
}

function isJobsSearchPage() {
  return window.location.pathname.startsWith("/jobs/search") && !isPostApplySearchPage();
}

function isJobsViewPage() {
  return window.location.pathname.startsWith("/jobs/view") || window.location.href.includes("/jobs/view/");
}

function isPostApplySearchPage() {
  return window.location.pathname.startsWith("/jobs/search/post-apply");
}

async function isRunActive() {
  const boot = await getBootstrap();
  return Boolean(boot?.state?.running && !boot?.state?.paused);
}

function normalizeLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalQuestionKey(label) {
  const n = String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!n) return "";
  if (n === "full name" || n === "full legal name" || n === "legal name") return "full_name";
  if (n === "first name" || n === "given name") return "first_name";
  if (n === "last name" || n === "family name" || n === "surname") return "last_name";
  if (n === "email" || n === "email address") return "email_address";
  if (n === "phone" || n === "phone number" || n === "mobile phone" || n === "mobile phone number" || n === "contact number") {
    return "phone_number";
  }
  if (n.includes("linkedin") && (n.includes("profile") || n.includes("url"))) return "linkedin_url";
  if (n.includes("portfolio") && (n.includes("url") || n.includes("website") || n.includes("site") || n === "portfolio")) {
    return "portfolio_url";
  }
  if (n === "current city" || n === "city" || n.includes("location city") || n.includes("city state")) {
    return "current_city";
  }
  if (n === "state" || n === "state region" || n === "region") return "state_region";
  if (n === "country") return "country";
  if (
    ((n.includes("authorized") && n.includes("work")) ||
      (n.includes("eligible") && n.includes("work")) ||
      (n.includes("work") && n.includes("authorization"))) &&
    (n.includes("united states") || n.includes("u s") || n.includes("us"))
  ) {
    return "work_authorization_us";
  }
  if ((n.includes("visa") && n.includes("sponsorship")) || (n.includes("require") && n.includes("sponsorship"))) {
    return "visa_sponsorship_required";
  }
  if (n.includes("onsite") || n.includes("on site")) return "comfortable_working_onsite";
  if (n.includes("commut")) return "comfortable_commuting";
  if (n.includes("relocat")) return "comfortable_relocation";
  if ((n.includes("salary") || n.includes("compensation") || n.includes("pay")) && n.includes("expect")) {
    return "expected_salary";
  }
  if (n.includes("year") && n.includes("experience")) return "years_of_experience";
  if (n.includes("bachelor") && n.includes("degree")) return "bachelors_degree_completed";
  if (n.includes("english") && n.includes("proficiency")) return "english_proficiency";
  if (n.includes("confidence") && n.includes("level")) return "cp_pref_confidence_level";
  if (n.includes("notice") && n.includes("period")) return "notice_period_days";
  if (n.includes("start") && n.includes("date")) return "start_date_availability";
  return n.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120);
}

function questionKeyFromLabel(label) {
  return canonicalQuestionKey(label);
}

function cleanQuestionLabel(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getQuestionLabel(block) {
  if (!block) return "";
  const candidates = [];
  const labelNodes = block.querySelectorAll(
    "label, legend, .fb-dash-form-element__label, .artdeco-text-input--label, [data-test-form-builder-radio-button-form-component__title], [class*='label']"
  );
  for (const el of labelNodes) {
    const text = cleanQuestionLabel(el.textContent || "");
    if (text) candidates.push(text);
  }

  const inputLike = block.querySelector(
    "input:not([type='hidden']), textarea, select, [role='combobox'], button[aria-haspopup='listbox'], [aria-labelledby]"
  );
  if (inputLike) {
    const ariaLabel = cleanQuestionLabel(inputLike.getAttribute("aria-label") || "");
    if (ariaLabel) candidates.push(ariaLabel);
    const labelledBy = String(inputLike.getAttribute("aria-labelledby") || "").trim();
    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/g)) {
        const el = document.getElementById(id);
        const txt = cleanQuestionLabel(el?.textContent || "");
        if (txt) candidates.push(txt);
      }
    }
  }

  if (!candidates.length) return "";
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

function normalizePhoneForInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/[^\d]/g, "");
}

function normalizeNumberString(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return "";
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return "";
  return String(Math.max(0, Math.round(n)));
}

function normalizeAmount(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function formatNumericAnswer(value, maxFractionDigits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const rounded = Number(n.toFixed(maxFractionDigits));
  return String(rounded);
}

function getSalaryAnswer(label, settings) {
  const l = normalizeLabel(label);
  const useCurrent = l.includes("current") || l.includes("present");
  const amount = normalizeAmount(useCurrent ? settings.currentCtc : settings.desiredSalary);
  if (amount === null) return "";
  if (l.includes("month")) return formatNumericAnswer(amount / 12, 2);
  if (l.includes("lakh") || l.includes("lac")) return formatNumericAnswer(amount / 100000, 2);
  return String(Math.round(amount));
}

function normalizeCityAnswer(currentCityValue, workLocationValue = "") {
  const source = String(currentCityValue || "").trim() || String(workLocationValue || "").trim();
  if (!source) return "";
  const noParen = source.split("(", 1)[0].trim();
  const firstPart = noParen.split(",", 1)[0].trim();
  const normalized = normalizeLabel(firstPart);
  if (!firstPart || ["remote", "united states", "usa", "india", "worldwide"].includes(normalized)) {
    return "";
  }
  return firstPart;
}

function buildFullName(settings) {
  const explicit = String(settings.fullName || "").trim();
  if (explicit) return explicit;
  return [settings.firstName, settings.middleName, settings.lastName]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function visibleText(el) {
  return normalizeLabel(el?.textContent || el?.innerText || "");
}

function isMarketingConsentQuestion(label) {
  const l = normalizeLabel(label);
  return (
    (l.includes("receive") && (l.includes("email") || l.includes("text") || l.includes("phone"))) ||
    l.includes("matching opportunities") ||
    l.includes("prerecorded voice")
  );
}

function answerCommonQuestion(label, settings) {
  const l = normalizeLabel(label);
  const key = questionKeyFromLabel(l);

  const fullName = buildFullName(settings);
  const currentCity = normalizeCityAnswer(settings.currentCity, currentJobContext.workLocation);
  const yearsValue =
    String(settings.yearsOfExperienceAnswer || "").trim() ||
    (Number(settings.currentExperience) >= 0 ? String(Number(settings.currentExperience)) : "3");
  const noticeDays = normalizeNumberString(settings.noticePeriodDays) || "30";
  const noticeMonths = noticeDays ? String(Math.floor(Number(noticeDays) / 30)) : "1";
  const noticeWeeks = noticeDays ? String(Math.floor(Number(noticeDays) / 7)) : "4";

  const identityKeys = new Set(["full_name", "first_name", "last_name", "phone_number", "email_address", "linkedin_url"]);
  const manualByKey = settings?.screeningAnswers?.[key];
  const manualByLabel = settings?.screeningAnswers?.[l];
  const manualValue = manualByKey ? String(manualByKey) : manualByLabel ? String(manualByLabel) : "";
  // Prefer explicit profile fields over screeningAnswers for identity fields to avoid bad/stale overrides.
  if (manualValue && !identityKeys.has(String(key || "").trim())) return manualValue;

  // 1. Visa sponsorship & Work Authorization
  if (l.includes("visa") || l.includes("sponsorship") || l.includes("require sponsorship") || l.includes("need sponsorship")) {
    return settings.requireVisa || "No";
  }
  if (
    l.includes("citizenship") ||
    l.includes("employment eligibility") ||
    l.includes("work authorization") ||
    (l.includes("authorized") && l.includes("work")) ||
    l.includes("legally authorized") ||
    l.includes("eligible to work")
  ) {
    return settings.usCitizenship || "Yes";
  }

  // 2. Skill-specific experience matching (e.g. "How many years of work experience do you have with [Skill]?")
  if (l.includes("experience") || l.includes("years of work") || l.includes("how many years") || l.includes("how many years of")) {
    const skillMatch = l.match(/(?:with|in|using|experience with|knowledge of|working with)\s+([^?.,]+)/i);
    if (skillMatch && skillMatch[1]) {
      const skillName = normalizeLabel(skillMatch[1].trim());
      const skillKey = questionKeyFromLabel(skillName);
      if (settings?.screeningAnswers) {
        if (!isBlankValue(settings.screeningAnswers[skillKey])) return String(settings.screeningAnswers[skillKey]);
        if (!isBlankValue(settings.screeningAnswers[skillName])) return String(settings.screeningAnswers[skillName]);
        for (const [k, v] of Object.entries(settings.screeningAnswers)) {
          const kNorm = normalizeLabel(k);
          if (kNorm.includes(skillName) || skillName.includes(kNorm)) {
            if (!isBlankValue(v)) return String(v);
          }
        }
      }
    }
    return yearsValue;
  }

  // 3. Education levels & degree completion
  if (l.includes("bachelor") || l.includes("undergraduate") || l.includes("b.tech") || l.includes("bs degree") || l.includes("ba degree")) {
    return settings.screeningAnswers?.["bachelors_degree_completed"] || "Yes";
  }
  if (l.includes("master") || l.includes("postgraduate") || l.includes("ms degree") || l.includes("mba")) {
    return settings.screeningAnswers?.["masters_degree_completed"] || "No";
  }
  if (l.includes("high school") || l.includes("ged") || l.includes("secondary education")) {
    return "Yes";
  }
  if (l.includes("highest") && (l.includes("education") || l.includes("degree") || l.includes("level of education"))) {
    return settings.educationLevel || "Bachelor's Degree";
  }

  // 4. Commute, On-site, and Relocation
  if (l.includes("commute") || l.includes("commuting") || l.includes("reliable transportation") || l.includes("travel to")) {
    return settings.screeningAnswers?.["comfortable_commuting"] || "Yes";
  }
  if (l.includes("on-site") || l.includes("onsite") || l.includes("in-person") || l.includes("in office") || l.includes("hybrid") || l.includes("work location")) {
    return settings.screeningAnswers?.["comfortable_working_onsite"] || "Yes";
  }
  if (l.includes("relocate") || l.includes("relocation") || l.includes("willing to move")) {
    return settings.screeningAnswers?.["comfortable_relocation"] || "Yes";
  }

  // 5. Background Checks, Drug Test, Driver's License
  if (l.includes("background check") || l.includes("background screening") || l.includes("background investigation")) {
    return settings.screeningAnswers?.["willing_background_check"] || "Yes";
  }
  if (l.includes("drug test") || l.includes("drug screen") || l.includes("drug screening")) {
    return settings.screeningAnswers?.["willing_drug_test"] || "Yes";
  }
  if (l.includes("driver") || l.includes("driver's license") || l.includes("driving license") || l.includes("valid license")) {
    return settings.screeningAnswers?.["valid_drivers_license"] || "Yes";
  }

  // 6. Language & English Proficiency
  if (l.includes("english") || l.includes("language proficiency") || l.includes("fluent in english") || l.includes("english proficiency")) {
    return settings.englishProficiency || settings.screeningAnswers?.["english_proficiency"] || "Professional";
  }

  // 7. Demographics & EEO
  if (l.includes("protected") && l.includes("veteran")) return settings.veteranStatus || "I am not a protected veteran";
  if (l.includes("veteran")) return settings.veteranStatus || "No";
  if (l.includes("disability") || l.includes("handicapped")) return settings.disabilityStatus || "No, I don't have a disability";
  if (l.includes("gender") || l.includes("sex")) return settings.gender || "";
  if (l.includes("ethnicity") || l.includes("race")) return settings.ethnicity || "";
  if (isMarketingConsentQuestion(l)) {
    return settings.marketingConsent || "Yes";
  }

  // 8. Notice Period & Availability
  if (l.includes("notice")) {
    if (l.includes("month")) return noticeMonths;
    if (l.includes("week")) return noticeWeeks;
    return noticeDays;
  }
  if (l.includes("available immediately") || l.includes("start immediately") || l.includes("immediate joiner")) {
    return "Yes";
  }
  if (l.includes("start date") || l.includes("when can you start") || l.includes("how soon can you start") || l.includes("earliest start")) {
    return "Immediately";
  }

  // 9. Compensation
  if (l.includes("salary") || l.includes("compensation") || l.includes("ctc") || l.includes("pay") || l.includes("hourly rate")) {
    return getSalaryAnswer(l, settings);
  }

  // 10. Contact & Profile Information
  if (l.includes("location") || l.includes("city") || l.includes("address")) return currentCity || "";
  if (l.includes("email")) return settings.contactEmail || "";
  if (l.includes("phone number") || l === "phone" || l.includes("mobile")) return normalizePhoneForInput(settings.phoneNumber || "");
  if (l.includes("phone country code")) return settings.phoneCountryCode || "";
  if (l.includes("signature")) return fullName;
  if (l.includes("name")) {
    if (l.includes("full")) return fullName;
    if (l.includes("first") && !l.includes("last")) return settings.firstName || fullName;
    if (l.includes("middle") && !l.includes("last")) return settings.middleName || "";
    if (l.includes("last") && !l.includes("first")) return settings.lastName || fullName;
    if (l.includes("employer")) return settings.recentEmployer || "";
    return fullName;
  }
  if (l.includes("linkedin")) return settings.linkedinUrl || "";
  if (l.includes("website") || l.includes("blog") || l.includes("portfolio") || l.includes("link") || l.includes("github")) return settings.websiteUrl || "";
  if (l.includes("scale of 1-10") || l.includes("confidence level")) return settings.confidenceLevel || "8";
  if ((l.includes("hear") || l.includes("come across")) && l.includes("this") && (l.includes("job") || l.includes("position"))) {
    return settings.websiteUrl || settings.linkedinUrl || "LinkedIn";
  }
  if (l.includes("headline")) return settings.linkedinHeadline || "";
  if (
    l.includes("description") ||
    l.includes("describe your") ||
    l.includes("brief description") ||
    l.includes("work description") ||
    l.includes("job description") ||
    l.includes("project description") ||
    l.includes("summary") ||
    l.includes("about yourself") ||
    l.includes("about you") ||
    l.includes("bio") ||
    l.includes("background")
  ) {
    const userSummary =
      settings.linkedinSummary ||
      settings.coverLetter ||
      settings.screeningAnswers?.["description"] ||
      settings.screeningAnswers?.["summary"] ||
      settings.screeningAnswers?.["profile_summary"] ||
      "";
    if (userSummary) return userSummary;
  }
  if (l.includes("cover")) return settings.coverLetter || "";
  if (l.includes("street")) return settings.streetAddress || "";
  if (l.includes("state") || l.includes("province")) return settings.stateRegion || "";
  if (l.includes("zip") || l.includes("postal")) return settings.postalCode || "";
  if (l.includes("country")) return settings.country || "";
  return "";
}

async function resilientClick(el, name) {
  if (!el) return false;
  try {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(180);
    el.click();
    return true;
  } catch {
    try {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      return true;
    } catch {
      await logLine(`Failed to click ${name}`, "warn");
      return false;
    }
  }
}

async function selectJobCardInSearchList(card) {
  if (!card) return false;
  const rootCard = card.closest?.(".job-card-container, .jobs-search-results__list-item, li") || card;
  try {
    rootCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch {}
  await sleep(150);

  // Target the container element so LinkedIn's React SPA updates the side-detail pane in-place
  // without triggering a full browser link navigation to /jobs/view/
  const clickableTarget =
    rootCard.querySelector?.(".job-card-container--clickable") ||
    rootCard.querySelector?.(".job-card-list__entity-lockup") ||
    rootCard.querySelector?.(".artdeco-entity-lockup__content") ||
    rootCard.querySelector?.(".job-card-container") ||
    rootCard;

  // Prevent full page navigation if an anchor receives the click
  const anchors = Array.from(rootCard.querySelectorAll?.("a[href*='/jobs/view/']") || []);
  const preventNavHandler = (e) => {
    if (isJobsSearchPage()) {
      e.preventDefault();
    }
  };

  anchors.forEach((a) => {
    a.addEventListener("click", preventNavHandler, { capture: true, once: true });
  });

  try {
    const target = clickableTarget;
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, view: window }));
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, view: window }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return true;
  } catch {
    try {
      clickableTarget.click();
      return true;
    } catch {
      return false;
    }
  } finally {
    setTimeout(() => {
      anchors.forEach((a) => {
        a.removeEventListener("click", preventNavHandler, { capture: true });
      });
    }, 1000);
  }
}



function getApplyButtonFromDetailPane() {
  // Scope strictly to job detail/top-card areas to avoid matching filter pills.
  const detailRoots = getAllBySelectorList([
    ".jobs-search__job-details",
    ".jobs-details",
    ".jobs-unified-top-card",
    ".jobs-details-top-card",
    ".scaffold-layout__detail"
  ]);
  const roots = detailRoots.length ? detailRoots : [document];

  const candidates = [];
  for (const root of roots) {
    const localButtons = Array.from(
      root.querySelectorAll(
        "button.jobs-apply-button, .jobs-s-apply button, button[aria-label*='Apply'], button[data-control-name*='jobdetails_topcard']"
      )
    );
    candidates.push(...localButtons);
  }

  const enabled = candidates.filter((b) => {
    if (!b || b.disabled) return false;
    // Ignore job search filter buttons and pill controls.
    if (b.closest(".jobs-search-box__filters-bar, .search-reusables__filters-bar, .jobs-search-box__filter-item")) return false;
    const cls = normalizeLabel(b.className || "");
    const aria = normalizeLabel(b.getAttribute("aria-label") || "");
    const txt = normalizeLabel(b.textContent || "");
    if (cls.includes("filter") || aria.includes("filter")) return false;
    if (txt === "easy apply" && cls.includes("filter")) return false;
    return true;
  });

  const easyApply = enabled.find((b) => {
    const txt = `${normalizeLabel(b.getAttribute("aria-label") || "")} ${normalizeLabel(b.textContent || "")}`;
    return txt.includes("easy apply");
  });
  if (easyApply) return { type: "easy", button: easyApply };

  const externalApply = enabled.find((b) => {
    const txt = `${normalizeLabel(b.getAttribute("aria-label") || "")} ${normalizeLabel(b.textContent || "")}`;
    if (!txt.includes("apply")) return false;
    if (txt.includes("easy apply")) return false;
    return true;
  });
  if (externalApply) return { type: "external", button: externalApply };
  return { type: "none", button: null };
}

function isDetailPaneStillLoading() {
  const detailRoot = getBySelectorList([
    ".jobs-search__job-details",
    ".jobs-details",
    ".jobs-unified-top-card",
    ".jobs-details-top-card",
    ".scaffold-layout__detail"
  ]);
  if (!detailRoot) return false;
  if (detailRoot.matches?.("[aria-busy='true']")) return true;

  const loadingSelectors = [
    "[aria-busy='true']",
    ".artdeco-loader",
    ".artdeco-loader__bar",
    "[class*='skeleton']",
    "[class*='loading']",
    "[data-test-loading]"
  ];
  for (const selector of loadingSelectors) {
    const matches = safeQuerySelectorAll(detailRoot, selector, null, "detail pane loading check");
    if (matches.some((node) => isVisibleElement(node))) return true;
  }
  return false;
}

function shouldUseConservativeExternalApplyWait() {
  const href = String(window.location.href || "");
  return isJobsViewPage() || /[?&]eBP=|[?&]trk=|[?&]refId=|[?&]trackingId=/i.test(href);
}

async function waitForApplyButtonFromDetailPane(settings, timeoutMs = 7000, context = "detail pane") {
  const timeout = Math.max(1000, Number(timeoutMs || 7000));
  const start = Date.now();
  let deadline = start + timeout;
  let polls = 0;
  let extendedForLoading = false;
  let extendedForExternal = false;
  let extendedForConservativeExternal = false;
  let firstExternalSeenAt = 0;
  let lastExternalAction = null;
  const conservativeExternalWait = shouldUseConservativeExternalApplyWait();
  const minimumDecisionMs = conservativeExternalWait ? 3600 : 1400;
  const stableExternalMs = conservativeExternalWait ? 2600 : 1200;
  while (Date.now() < deadline) {
    polls += 1;
    const action = getApplyButtonFromDetailPane();
    const detailLoading = isDetailPaneStillLoading();
    if (action.type === "easy" && action.button) {
      if (polls > 1) {
        await debugLog(settings, "Apply button appeared after wait", {
          context,
          polls,
          elapsedMs: Date.now() - start,
          type: action.type
        });
      }
      return action;
    }

    if (action.type === "external" && action.button) {
      lastExternalAction = action;
      if (!firstExternalSeenAt) firstExternalSeenAt = Date.now();
      const externalVisibleForMs = Date.now() - firstExternalSeenAt;
      if (!detailLoading && Date.now() - start >= minimumDecisionMs && externalVisibleForMs >= stableExternalMs) {
        await debugLog(settings, "External apply button confirmed after settle wait", {
          context,
          polls,
          elapsedMs: Date.now() - start,
          externalVisibleForMs,
          conservativeExternalWait
        });
        return action;
      }
    } else if (action.type === "none") {
      firstExternalSeenAt = 0;
    }

    if (polls % 5 === 0) {
      const detailRoot = getBySelectorList([
        ".jobs-search__job-details",
        ".jobs-details",
        ".jobs-unified-top-card",
        ".jobs-details-top-card",
        ".scaffold-layout__detail"
      ]);
      if (detailRoot && typeof detailRoot.scrollBy === "function") {
        detailRoot.scrollBy({ top: 120, behavior: "smooth" });
      }
    }

    if (Date.now() + 220 >= deadline) {
      if (!extendedForLoading && detailLoading) {
        extendedForLoading = true;
        deadline += 2200;
        await debugLog(settings, "Extending apply button wait because detail pane is still loading", {
          context,
          polls,
          elapsedMs: Date.now() - start
        });
      } else if (!extendedForExternal && lastExternalAction?.button) {
        extendedForExternal = true;
        deadline += 1500;
        await debugLog(settings, "Extending apply button wait to confirm external apply state", {
          context,
          polls,
          elapsedMs: Date.now() - start
        });
      } else if (!extendedForConservativeExternal && conservativeExternalWait && lastExternalAction?.button) {
        extendedForConservativeExternal = true;
        deadline += 2200;
        await debugLog(settings, "Extending apply button wait because jobs view may still promote Easy Apply", {
          context,
          polls,
          elapsedMs: Date.now() - start
        });
      }
    }
    await sleep(220);
  }
  if (conservativeExternalWait && lastExternalAction?.button) {
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // ignore scroll failures
    }
    await sleep(900);
    const finalAction = getApplyButtonFromDetailPane();
    if (finalAction.type === "easy" && finalAction.button) {
      await debugLog(settings, "Easy Apply appeared after conservative external wait", {
        context,
        polls,
        elapsedMs: Date.now() - start
      });
      return finalAction;
    }
  }
  if (lastExternalAction?.button) {
    await debugLog(settings, "Returning external apply after full wait window", {
      context,
      polls,
      elapsedMs: Date.now() - start,
      conservativeExternalWait
    });
    return lastExternalAction;
  }
  await debugLog(settings, "Apply button wait timed out", {
    context,
    elapsedMs: Date.now() - start,
    detailRoots: document.querySelectorAll(".jobs-search__job-details, .jobs-details, .jobs-unified-top-card, .jobs-details-top-card, .scaffold-layout__detail").length,
    applyButtonsVisible: document.querySelectorAll("button.jobs-apply-button, .jobs-s-apply button").length
  });
  return { type: "none", button: null };
}

function isAppliedStatusText(text) {
  const t = normalizeLabel(text);
  if (!t) return false;
  if (t.includes("easy apply")) return false;
  if (/\bapplication submitted\b/.test(t)) return true;
  if (/\bapplied\b/.test(t)) return true;
  if (/\bsubmitted\b/.test(t) && t.includes("application")) return true;
  return false;
}

function isAlreadyAppliedCard(card) {
  const footerNodes = Array.from(
    card?.querySelectorAll?.(
      ".job-card-container__footer-job-state, .job-card-list__footer-wrapper, .jobs-card__listdate, .job-card-list__footer-wrapper *"
    ) || []
  );
  for (const node of footerNodes) {
    if (isAppliedStatusText(node?.textContent || "")) return true;
  }

  const stateBadgeNodes = Array.from(
    card?.querySelectorAll?.("[aria-label], [data-test-id*='appl'], [class*='appl']") || []
  );
  for (const node of stateBadgeNodes) {
    const aria = String(node?.getAttribute?.("aria-label") || "");
    if (isAppliedStatusText(aria)) return true;
    if (isAppliedStatusText(node?.textContent || "")) return true;
  }

  return false;
}

function extractLinkedInJobIdFromUrl(url) {
  const raw = String(url || "");
  if (!raw) return "";
  const viewMatch = raw.match(/\/jobs\/view\/(\d+)/);
  if (viewMatch?.[1]) return viewMatch[1];
  const currentJobIdMatch = raw.match(/[?&]currentJobId=(\d+)/);
  if (currentJobIdMatch?.[1]) return currentJobIdMatch[1];
  const jobIdMatch = raw.match(/[?&]jobId=(\d+)/);
  if (jobIdMatch?.[1]) return jobIdMatch[1];
  return "";
}

function extractLinkedInViewJobIdFromUrl(url) {
  const raw = String(url || "");
  if (!raw) return "";
  const viewMatch = raw.match(/\/jobs\/view\/(\d+)/);
  return viewMatch?.[1] ? String(viewMatch[1]) : "";
}

function buildCanonicalLinkedInJobUrl(jobId, fallbackUrl = "") {
  const normalizedJobId = String(jobId || "").trim();
  if (/^\d+$/.test(normalizedJobId)) {
    return `https://www.linkedin.com/jobs/view/${normalizedJobId}/`;
  }
  const fallbackJobId = extractLinkedInViewJobIdFromUrl(fallbackUrl) || extractLinkedInJobIdFromUrl(fallbackUrl);
  if (/^\d+$/.test(fallbackJobId)) {
    return `https://www.linkedin.com/jobs/view/${fallbackJobId}/`;
  }
  return String(fallbackUrl || "");
}

function extractLinkedInJobIdFromEntityUrn(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  // Examples:
  // urn:li:jobPosting:4375945722
  // urn:li:fsd_jobPosting:4375945722
  const m = raw.match(/jobPosting:(\d+)/i);
  if (m?.[1]) return String(m[1]);
  return "";
}

function getJobKeyFromCard(card) {
  // Prefer stable LinkedIn job IDs; do not fall back to title (causes duplicate opens).
  const explicitCandidates = [
    card?.getAttribute?.("data-occludable-job-id"),
    card?.closest?.("[data-occludable-job-id]")?.getAttribute?.("data-occludable-job-id"),
    card?.getAttribute?.("data-job-id"),
    card?.querySelector?.("[data-job-id]")?.getAttribute?.("data-job-id"),
  ].filter(Boolean);
  for (const candidate of explicitCandidates) {
    const explicit = String(candidate || "").trim();
    if (explicit && /^\d+$/.test(explicit)) return explicit;
  }

  const urnCandidates = [
    getCardAnchor(card)?.getAttribute?.("data-entity-urn"),
    card?.getAttribute?.("data-entity-urn"),
    card?.querySelector?.("[data-entity-urn]")?.getAttribute?.("data-entity-urn"),
  ].filter(Boolean);
  for (const urn of urnCandidates) {
    const id = extractLinkedInJobIdFromEntityUrn(urn) || extractLinkedInJobIdFromUrl(urn);
    if (id) return id;
  }

  const hrefCandidates = [
    String(getCardAnchor(card)?.href || ""),
    String(card?.querySelector?.("a[href*='/jobs/view/']")?.href || ""),
  ].filter(Boolean);
  for (const href of hrefCandidates) {
    const fromViewHref = extractLinkedInViewJobIdFromUrl(href);
    if (fromViewHref) return fromViewHref;
  }
  for (const href of hrefCandidates) {
    const fromHref = extractLinkedInJobIdFromUrl(href);
    if (fromHref) return fromHref;
  }

  return "";
}

function parseListSetting(value) {
  if (Array.isArray(value)) return value.map((v) => String(v || "").trim()).filter(Boolean);
  const raw = String(value || "").trim();
  if (!raw) return [];
  return raw
    .split(/[,\n]/g)
    .map((v) => v.trim())
    .filter(Boolean);
}

function cleanJobTitle(raw) {
  let title = String(raw || "").trim();
  if (!title) return "Job";

  // Remove common LinkedIn badge and status noise
  title = title
    .replace(/\bwith verification\b/gi, "")
    .replace(/\bactively recruiting\b/gi, "")
    .replace(/\bbe an early applicant\b/gi, "")
    .replace(/\bpromoted by hirer\b/gi, "")
    .replace(/\bpromoted\b/gi, "")
    .replace(/\bviewed\b/gi, "")
    .replace(/\beasy apply\b/gi, "")
    .replace(/\bapplied \d+ .* ago\b/gi, "")
    .replace(/\bapplied\b/gi, "")
    .trim();

  // If word is duplicated together without space like "Web DesignerWeb Designer"
  if (title.length >= 6 && title.length % 2 === 0) {
    const half = title.length / 2;
    if (title.slice(0, half).toLowerCase() === title.slice(half).toLowerCase()) {
      title = title.slice(0, half);
    }
  }

  // If words are duplicated with space like "Javascript Developer Javascript Developer"
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length % 2 === 0) {
    const half = words.length / 2;
    const firstHalf = words.slice(0, half).join(" ");
    const secondHalf = words.slice(half).join(" ");
    if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
      title = firstHalf;
    }
  }

  return title.replace(/\s+/g, " ").trim() || "Job";
}

function extractCardMeta(card) {
  const anchor = getCardAnchor(card);
  const rawTitle = String(
    anchor?.querySelector(".job-card-list__title--link span[aria-hidden='true']")?.textContent ||
    anchor?.querySelector("span[aria-hidden='true']")?.textContent ||
    anchor?.querySelector("strong")?.textContent ||
    anchor?.textContent ||
    card?.querySelector("a span")?.textContent ||
    ""
  ).trim();
  const titleRaw = cleanJobTitle(rawTitle);
  const title = normalizeLabel(titleRaw);
  const companyCandidates = [
    card?.querySelector(".artdeco-entity-lockup__subtitle"),
    card?.querySelector(".job-card-container__primary-description"),
    card?.querySelector(".job-card-list__subtitle"),
  ].filter(Boolean);
  const locationCandidates = [
    card?.querySelector(".job-card-container__metadata-item"),
    card?.querySelector(".job-card-container__metadata-wrapper li"),
    card?.querySelector(".job-card-list__location"),
    card?.querySelector(".artdeco-entity-lockup__caption")
  ].filter(Boolean);
  const companyRaw = String(companyCandidates[0]?.textContent || "").trim();
  const workLocationRaw = String(locationCandidates[0]?.textContent || "").trim();
  const company = normalizeLabel(companyRaw);
  const workLocation = normalizeLabel(workLocationRaw);
  return { title, titleRaw, company, companyRaw, workLocation, workLocationRaw };
}

function getCardElementContainer(card) {
  if (!card) return null;
  return (
    card.closest(".job-card-container, li.jobs-search-results__list-item, .jobs-search-results-list__list-item, div[data-job-id], [data-occludable-job-id]") ||
    card
  );
}

function clearActiveJobCardHighlights() {
  try {
    const highlighted = document.querySelectorAll(".cp-active-eval-card");
    for (const el of highlighted) {
      el.classList.remove("cp-active-eval-card");
      const existingBadge = el.querySelector(".cp-card-live-badge");
      if (existingBadge) existingBadge.remove();
    }
  } catch {
    // ignore
  }
}

function highlightActiveJobCard(card, badgeText = "AI Evaluating...") {
  try {
    const container = getCardElementContainer(card);
    if (!container) return;

    clearActiveJobCardHighlights();
    container.classList.add("cp-active-eval-card");

    try {
      container.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    } catch {
      // ignore
    }

    let badge = container.querySelector(".cp-card-live-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "cp-card-live-badge";
      container.appendChild(badge);
    }
    badge.innerHTML = `<span class="cp-badge-pulse"></span><span>${escapeHtml(badgeText)}</span>`;
  } catch {
    // ignore
  }
}

function formatFriendlySkipReason(label) {
  const norm = normalizeLabel(label);
  if (!norm) return "Filtered";
  if (norm.includes("already applied") || norm.includes("applied_cache_hit")) return "Already Applied";
  if (norm.includes("keyword") || norm.includes("mismatch")) return "Keyword Mismatch";
  if (norm.includes("experience") || norm.includes("years") || norm.includes("too_high")) return "Experience > Allowed";
  if (norm.includes("blacklisted") || norm.includes("company")) return "Company Blocked";
  if (norm.includes("bad_word") || norm.includes("excluded word")) return "Title Blocked";
  if (norm.includes("external")) return "External Apply";
  if (norm.includes("modal_not_found") || norm.includes("no easy apply")) return "No Easy Apply";
  if (norm.includes("resume")) return "Resume Required";
  if (norm.includes("phone")) return "Phone Validation";
  if (norm.includes("input") || norm.includes("selection") || norm.includes("pending_user_input")) return "Custom Input Required";
  return label.length > 25 ? `${label.slice(0, 22)}...` : label;
}

function markJobCardStatus(card, status = "applied", label = "") {
  try {
    const container = getCardElementContainer(card);
    if (!container) return;

    container.classList.remove("cp-active-eval-card");
    const liveBadge = container.querySelector(".cp-card-live-badge");
    if (liveBadge) liveBadge.remove();

    // Remove any previous outcome tag on this card
    const existingTag = container.querySelector(".cp-card-outcome-tag");
    if (existingTag) existingTag.remove();

    const tag = document.createElement("div");
    tag.className = `cp-card-outcome-tag ${status === "applied" ? "cp-tag-applied" : "cp-tag-skipped"}`;

    if (status === "applied") {
      container.classList.add("cp-card-completed-applied");
      tag.innerHTML = `<span>✅</span><span>APPLIED</span>`;
    } else {
      container.classList.add("cp-card-completed-skipped");
      const reasonText = formatFriendlySkipReason(label);
      tag.innerHTML = `<span>⏭️</span><span>SKIPPED: ${escapeHtml(reasonText)}</span>`;
    }

    // Inject into the title/entity area of the card
    const targetArea =
      container.querySelector(".artdeco-entity-lockup__content") ||
      container.querySelector(".job-card-list__entity-lockup") ||
      container.querySelector(".job-card-container__primary-description")?.parentElement ||
      container;
    targetArea.appendChild(tag);
  } catch {
    // ignore
  }
}

function highlightDetailPane(jobTitle = "") {
  try {
    const pane =
      document.querySelector(".jobs-search__job-details") ||
      document.querySelector(".jobs-details") ||
      document.querySelector(".job-details-jobs-unified-top-card") ||
      document.querySelector(".scaffold-layout__detail");
    if (!pane) return;

    let indicator = pane.querySelector(".cp-detail-live-indicator");
    if (!indicator) {
      indicator = document.createElement("div");
      indicator.className = "cp-detail-live-indicator";
      pane.prepend(indicator);
    }
    indicator.innerHTML = `<span style="color:#6366f1;">✨</span><span><strong>AutoApply CV Copilot</strong> is analyzing: <em>${escapeHtml(jobTitle || "Current Opportunity")}</em></span>`;
  } catch {
    // ignore
  }
}

const KEYWORD_SYNONYM_DICTIONARY = {
  joomla: [
    "joomla developer",
    "wordpress developer",
    "php developer",
    "cms developer",
    "drupal developer",
    "web developer",
    "backend developer",
    "full stack developer"
  ],
  drupal: [
    "drupal developer",
    "php developer",
    "cms developer",
    "wordpress developer",
    "backend developer",
    "web developer"
  ],
  wordpress: [
    "wordpress developer",
    "wordpress engineer",
    "php developer",
    "woocommerce developer",
    "elementor developer",
    "cms developer",
    "web developer",
    "frontend developer"
  ],
  php: [
    "php developer",
    "laravel developer",
    "wordpress developer",
    "backend developer",
    "web developer",
    "full stack developer"
  ],
  react: [
    "react developer",
    "react js developer",
    "frontend developer",
    "frontend engineer",
    "next.js developer",
    "full stack developer",
    "javascript developer",
    "ui developer"
  ],
  angular: [
    "angular developer",
    "frontend developer",
    "frontend engineer",
    "typescript developer",
    "javascript developer",
    "web developer"
  ],
  vue: [
    "vue developer",
    "vue.js developer",
    "frontend developer",
    "nuxt developer",
    "javascript developer",
    "web developer"
  ],
  javascript: [
    "javascript developer",
    "frontend developer",
    "react developer",
    "node.js developer",
    "full stack developer",
    "web developer"
  ],
  typescript: [
    "typescript developer",
    "frontend developer",
    "full stack developer",
    "backend developer",
    "react developer",
    "node developer"
  ],
  python: [
    "python developer",
    "backend developer",
    "django developer",
    "fastapi developer",
    "data engineer",
    "python engineer",
    "software engineer"
  ],
  node: [
    "node.js developer",
    "nodejs developer",
    "backend engineer",
    "full stack developer",
    "express developer",
    "backend developer"
  ],
  java: [
    "java developer",
    "backend developer",
    "spring boot developer",
    "software engineer",
    "java software engineer"
  ],
  "c#": [
    "c# developer",
    ".net developer",
    "dotnet developer",
    "asp.net developer",
    "backend developer",
    "software engineer"
  ],
  ".net": [
    ".net developer",
    "dotnet developer",
    "c# developer",
    "asp.net developer",
    "backend developer"
  ],
  flutter: [
    "flutter developer",
    "mobile app developer",
    "dart developer",
    "android developer",
    "ios developer"
  ],
  "react native": [
    "react native developer",
    "mobile app developer",
    "frontend developer",
    "cross platform developer"
  ],
  android: [
    "android developer",
    "mobile app developer",
    "kotlin developer",
    "flutter developer"
  ],
  ios: [
    "ios developer",
    "swift developer",
    "mobile app developer",
    "flutter developer"
  ],
  "software engineer": [
    "software developer",
    "full stack engineer",
    "full stack developer",
    "backend engineer",
    "frontend engineer",
    "web developer"
  ],
  "software developer": [
    "software engineer",
    "full stack developer",
    "backend developer",
    "frontend developer",
    "web developer"
  ],
  "full stack": [
    "full stack developer",
    "full stack engineer",
    "software developer",
    "web developer",
    "backend developer",
    "frontend developer"
  ],
  frontend: [
    "frontend developer",
    "frontend engineer",
    "ui developer",
    "web developer",
    "react developer",
    "javascript developer"
  ],
  backend: [
    "backend developer",
    "backend engineer",
    "api developer",
    "software engineer",
    "server side developer"
  ],
  "data analyst": [
    "data analyst",
    "business analyst",
    "bi analyst",
    "analytics engineer",
    "sql analyst",
    "data reporting analyst"
  ],
  "business analyst": [
    "business analyst",
    "data analyst",
    "product analyst",
    "business systems analyst",
    "operations analyst"
  ],
  "data engineer": [
    "data engineer",
    "etl developer",
    "big data engineer",
    "analytics engineer",
    "python data engineer"
  ],
  "data scientist": [
    "data scientist",
    "machine learning engineer",
    "ai engineer",
    "data analyst",
    "quantitative analyst"
  ],
  "machine learning": [
    "machine learning engineer",
    "ai engineer",
    "data scientist",
    "nlp engineer",
    "deep learning engineer"
  ],
  "ai": [
    "ai engineer",
    "artificial intelligence engineer",
    "machine learning engineer",
    "data scientist",
    "python engineer"
  ],
  "ui/ux": [
    "ui/ux designer",
    "product designer",
    "ux designer",
    "ui designer",
    "web designer",
    "figma designer"
  ],
  "ux designer": [
    "ux designer",
    "product designer",
    "ui/ux designer",
    "interaction designer",
    "user researcher"
  ],
  "graphic designer": [
    "graphic designer",
    "visual designer",
    "brand designer",
    "digital designer",
    "creative designer"
  ],
  devops: [
    "devops engineer",
    "cloud engineer",
    "site reliability engineer",
    "sre",
    "aws engineer",
    "infrastructure engineer"
  ],
  cloud: [
    "cloud engineer",
    "aws engineer",
    "azure engineer",
    "devops engineer",
    "cloud architect"
  ],
  qa: [
    "qa engineer",
    "qa tester",
    "quality assurance engineer",
    "software tester",
    "automation tester",
    "sdet"
  ],
  tester: [
    "software tester",
    "qa engineer",
    "qa analyst",
    "automation tester",
    "manual tester"
  ],
  "digital marketing": [
    "digital marketing specialist",
    "seo specialist",
    "performance marketer",
    "growth marketer",
    "social media manager",
    "content marketer"
  ],
  marketing: [
    "marketing specialist",
    "digital marketer",
    "performance marketer",
    "growth marketer",
    "marketing coordinator"
  ],
  seo: [
    "seo specialist",
    "seo expert",
    "search engine optimization",
    "content marketer",
    "digital marketing specialist"
  ],
  "social media": [
    "social media manager",
    "social media specialist",
    "content creator",
    "community manager",
    "digital marketing specialist"
  ],
  content: [
    "content writer",
    "copywriter",
    "content strategist",
    "technical writer",
    "content creator"
  ],
  "appointment setter": [
    "appointment setter",
    "lead generation specialist",
    "cold caller",
    "inside sales representative",
    "sales development representative"
  ],
  sales: [
    "sales representative",
    "business development representative",
    "bdr",
    "sdr",
    "account executive",
    "inside sales"
  ],
  "customer support": [
    "customer support specialist",
    "customer service representative",
    "customer success manager",
    "technical support specialist"
  ],
  "human resources": [
    "hr specialist",
    "hr generalist",
    "recruiter",
    "talent acquisition specialist",
    "hr coordinator"
  ],
  recruiter: [
    "technical recruiter",
    "talent acquisition specialist",
    "it recruiter",
    "hr recruiter",
    "sourcer"
  ],
  "project manager": [
    "project manager",
    "scrum master",
    "product manager",
    "technical project manager",
    "program manager"
  ],
  "product manager": [
    "product manager",
    "associate product manager",
    "product owner",
    "technical product manager"
  ],
  sql: [
    "sql developer",
    "database developer",
    "database administrator",
    "sql engineer",
    "data engineer",
    "data analyst",
    "bi developer",
    "backend developer",
    "mysql developer",
    "postgresql developer"
  ],
  database: [
    "database developer",
    "database administrator",
    "dba",
    "sql developer",
    "data engineer",
    "data analyst",
    "backend developer"
  ],
  mysql: [
    "mysql developer",
    "database developer",
    "sql developer",
    "backend developer",
    "php developer"
  ],
  postgresql: [
    "postgresql developer",
    "database developer",
    "sql developer",
    "backend developer"
  ],
  mongodb: [
    "mongodb developer",
    "nosql developer",
    "backend developer",
    "full stack developer"
  ]
};

const COMMON_ROLE_MODIFIERS = new Set([
  "developer", "engineer", "specialist", "expert", "consultant", "analyst",
  "manager", "lead", "senior", "junior", "intern", "associate", "staff",
  "principal", "director", "head", "remote", "hybrid", "onsite", "freelance",
  "contract", "full-time", "part-time", "job", "role", "position"
]);

function getAlternativeKeywordsForTerm(term) {
  const norm = normalizeLabel(term);
  if (!norm) return [];
  for (const [key, synonyms] of Object.entries(KEYWORD_SYNONYM_DICTIONARY)) {
    const keyNorm = normalizeLabel(key);
    if (norm === keyNorm || norm.includes(keyNorm) || keyNorm.includes(norm)) {
      return synonyms;
    }
  }
  return [];
}

function isKnownDictionaryRole(jobTitleRaw) {
  const title = normalizeLabel(jobTitleRaw);
  if (!title) return false;

  // 1. Direct dictionary key/synonym check
  for (const [key, synonyms] of Object.entries(KEYWORD_SYNONYM_DICTIONARY)) {
    const keyNorm = normalizeLabel(key);
    if (keyNorm && (title.includes(keyNorm) || keyNorm.includes(title))) return true;
    for (const syn of synonyms) {
      const synNorm = normalizeLabel(syn);
      if (synNorm && (title.includes(synNorm) || synNorm.includes(title))) return true;
    }
  }

  // 2. Universal recognized professional / tech domain stems
  const UNIVERSAL_DICTIONARY_ROLES = [
    "developer", "software engineer", "programmer", "coder", "full stack",
    "frontend", "backend", "web developer", "web designer", "ui designer",
    "ux designer", "ui/ux", "product designer", "data analyst", "data scientist",
    "data engineer", "database", "sql", "mysql", "postgresql", "mongodb", "devops", "cloud engineer", "qa engineer",
    "software tester", "qa tester", "product manager", "project manager", "scrum master",
    "joomla", "drupal", "cms", "wordpress", "php", "laravel", "react", "next.js", "node", "nodejs",
    "python", "django", "fastapi", "java", "spring boot", ".net", "c#", "flutter",
    "android", "ios", "angular", "vue", "nuxt", "typescript", "javascript", "html", "css"
  ];

  return UNIVERSAL_DICTIONARY_ROLES.some((kw) => title.includes(normalizeLabel(kw)));
}

function isJobMatchingSearchKeywords(jobTitleRaw, activeKeyword, settings) {
  const title = normalizeLabel(jobTitleRaw);
  if (!title) return true;
  const active = normalizeLabel(activeKeyword);
  if (!active) return true;

  // 1. Direct exact/substring match
  if (title.includes(active) || active.includes(title)) return true;

  // 2. Split active keyword into core domain keywords (excluding generic words like developer/engineer/senior)
  const activeWords = active.split(/\s+/).filter((w) => w.length >= 3 && !COMMON_ROLE_MODIFIERS.has(w));
  if (activeWords.length > 0 && activeWords.some((w) => title.includes(w))) {
    return true;
  }

  // 3. Check synonym dictionary for matches
  const synonyms = getAlternativeKeywordsForTerm(active);
  for (const syn of synonyms) {
    const synNorm = normalizeLabel(syn);
    if (title.includes(synNorm) || synNorm.includes(title)) return true;
    const synWords = synNorm.split(/\s+/).filter((w) => w.length >= 3 && !COMMON_ROLE_MODIFIERS.has(w));
    if (synWords.length > 0 && synWords.some((w) => title.includes(w))) {
      return true;
    }
  }

  // 4. Check user-configured searchTerms
  const userTerms = parseListSetting(settings?.searchTerms);
  for (const ut of userTerms) {
    const utNorm = normalizeLabel(ut);
    if (utNorm && (title.includes(utNorm) || utNorm.includes(title))) return true;
    const utWords = utNorm.split(/\s+/).filter((w) => w.length >= 3 && !COMMON_ROLE_MODIFIERS.has(w));
    if (utWords.length > 0 && utWords.some((w) => title.includes(w))) {
      return true;
    }
  }

  // 5. Smart Cross-Dictionary Match:
  // If the job title matches ANY recognized role/skill in our dictionary (e.g. WordPress, PHP, React, SQL, Full Stack, Software Engineer, Data Analyst, etc.), accept it!
  if (isKnownDictionaryRole(title)) {
    return true;
  }

  return false;
}

function shouldSkipByRules(card, settings) {
  const { title, titleRaw, company } = extractCardMeta(card);
  const blacklistCompanies = parseListSetting(settings.blacklistedCompanies).map((s) => normalizeLabel(s));
  const badWords = parseListSetting(settings.badWords).map((s) => normalizeLabel(s));

  if (company && blacklistCompanies.some((name) => name && company.includes(name))) {
    return { skip: true, reasonCode: "BLACKLISTED_COMPANY", reason: `Company blacklisted: ${company}` };
  }
  if (title && badWords.some((w) => w && title.includes(w))) {
    return { skip: true, reasonCode: "BAD_WORD_TITLE", reason: `Title contains excluded word: ${title}` };
  }

  const activeKeyword = getCurrentSearchKeyword() || parseListSetting(settings?.searchTerms)[0] || "";
  if (activeKeyword && !isJobMatchingSearchKeywords(titleRaw || title, activeKeyword, settings)) {
    return {
      skip: true,
      reasonCode: "KEYWORD_MISMATCH",
      reason: `Title "${titleRaw || title}" does not match active keyword "${activeKeyword}" or related dictionary skills`
    };
  }

  return { skip: false, reasonCode: "", reason: "" };
}

function extractYearsOfExperience(text) {
  const raw = String(text || "");
  const matches = [...raw.matchAll(/(?:^|\s)(\d{1,2})\s*(?:\+|plus|-|to)?\s*(?:\d{0,2})?\s*years?/gi)];
  if (!matches.length) return 0;
  const values = matches
    .map((m) => Number(m?.[1] || 0))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 40);
  return values.length ? Math.max(...values) : 0;
}

function getJobDescriptionText() {
  const el = getBySelectorList([
    ".jobs-box__html-content",
    ".jobs-description__content",
    ".jobs-description-content__text",
    ".jobs-unified-top-card__job-insight",
    ".jobs-details__main-content"
  ]);
  const text = String(el?.textContent || "").trim();
  return text || "";
}

function getDetailPaneTitleText() {
  const el = getBySelectorList([
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-unified-top-card h1",
    ".jobs-unified-top-card__job-title",
    ".jobs-details-top-card__job-title",
    ".jobs-details__main-content h1",
  ]);
  return cleanQuestionLabel(el?.textContent || "");
}

function getDetailPaneCompanyText() {
  const el = getBySelectorList([
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name",
    ".jobs-details-top-card__company-url",
    ".jobs-unified-top-card__subtitle-primary-grouping a",
  ]);
  return cleanQuestionLabel(el?.textContent || "");
}

function getDetailPaneSnapshot() {
  return {
    jobId: extractLinkedInJobIdFromUrl(window.location.href),
    url: window.location.href,
    title: getDetailPaneTitleText(),
    company: getDetailPaneCompanyText(),
    description: getJobDescriptionText(),
    aboutCompany: getAboutCompanyText(),
  };
}

function textLooselyMatches(value, target) {
  const left = normalizeLabel(value);
  const right = normalizeLabel(target);
  if (!left || !right) return false;
  if (left === right) return true;
  return left.includes(right) || right.includes(left);
}

function didDetailPaneRefreshForCard(snapshot, cardMeta, previousContext = {}) {
  const targetTitle = String(cardMeta?.titleRaw || cardMeta?.title || "").trim();
  const targetCompany = String(cardMeta?.companyRaw || cardMeta?.company || "").trim();
  const previousTitle = String(previousContext?.title || "").trim();
  const previousDescription = normalizeLabel(String(previousContext?.description || "").slice(0, 500));
  const currentDescription = normalizeLabel(String(snapshot?.description || "").slice(0, 500));
  const descriptionChanged = Boolean(currentDescription) && currentDescription !== previousDescription;

  const titleMatches = textLooselyMatches(snapshot?.title || "", targetTitle);
  const companyMatches = textLooselyMatches(snapshot?.company || "", targetCompany);
  const movedAwayFromPreviousTitle =
    Boolean(snapshot?.title) &&
    (!previousTitle || !textLooselyMatches(snapshot.title, previousTitle));

  if (titleMatches && (companyMatches || !targetCompany || descriptionChanged)) return true;
  if (companyMatches && descriptionChanged) return true;
  if (movedAwayFromPreviousTitle && descriptionChanged) return true;
  if (Boolean(snapshot?.jobId) && snapshot.jobId !== String(previousContext?.jobId || "").trim()) return true;
  return false;
}

async function waitForDetailPaneRefresh(cardMeta, previousContext = {}, timeoutMs = 5000) {
  const timeout = Math.max(800, Number(timeoutMs || 5000));
  const start = Date.now();
  let snapshot = getDetailPaneSnapshot();
  if (didDetailPaneRefreshForCard(snapshot, cardMeta, previousContext)) return snapshot;

  while (Date.now() - start < timeout) {
    await sleep(180);
    snapshot = getDetailPaneSnapshot();
    if (didDetailPaneRefreshForCard(snapshot, cardMeta, previousContext)) return snapshot;
  }

  return snapshot;
}

function shouldSkipByDescription(description, settings) {
  const text = normalizeLabel(description);
  if (!text) return { skip: false, reasonCode: "", reason: "" };

  const badWords = parseListSetting(settings.badWords).map((s) => normalizeLabel(s));
  if (badWords.some((w) => w && text.includes(w))) {
    return {
      skip: true,
      reasonCode: "BAD_WORD_DESCRIPTION",
      reason: "Blocked by description bad word rule"
    };
  }

  const hasClearanceRequirement =
    text.includes("polygraph") ||
    text.includes("security clearance") ||
    text.includes("clearance required") ||
    text.includes("secret clearance");
  if (!settings.securityClearance && hasClearanceRequirement) {
    return {
      skip: true,
      reasonCode: "SECURITY_CLEARANCE_REQUIRED",
      reason: "Security clearance requirement detected"
    };
  }

  const configuredExperience = Number(settings.currentExperience);
  if (Number.isFinite(configuredExperience) && configuredExperience >= 0) {
    const required = extractYearsOfExperience(text);
    if (required > 0) {
      const allowed = configuredExperience + (settings.didMasters ? 2 : 0);
      if (required > allowed) {
        return {
          skip: true,
          reasonCode: "EXPERIENCE_TOO_HIGH",
          reason: `Required experience ${required} > allowed ${allowed}`
        };
      }
    }
  }

  return { skip: false, reasonCode: "", reason: "" };
}

function getAboutCompanyText() {
  const el = getBySelectorList([
    ".jobs-company__box",
    ".jobs-company__company-description",
    ".jobs-company__overview",
    ".jobs-company__inline-information"
  ]);
  return String(el?.textContent || "").trim();
}

function shouldSkipByAboutCompany(aboutCompanyText, settings) {
  const text = normalizeLabel(aboutCompanyText);
  if (!text) return { skip: false, reasonCode: "", reason: "" };

  const goodWords = parseListSetting(settings.aboutCompanyGoodWords).map((s) => normalizeLabel(s));
  if (goodWords.some((w) => w && text.includes(w))) {
    return { skip: false, reasonCode: "", reason: "" };
  }

  const badWords = parseListSetting(settings.aboutCompanyBadWords).map((s) => normalizeLabel(s));
  const match = badWords.find((w) => w && text.includes(w));
  if (match) {
    return {
      skip: true,
      reasonCode: "ABOUT_COMPANY_BAD_WORD",
      reason: `About company contains blocked word: ${match}`
    };
  }

  return { skip: false, reasonCode: "", reason: "" };
}

let lastDailyEasyApplyLimitEvidence = "";

function hasDailyEasyApplyLimitSignal(root = document) {
  const targetRoot = root || document;
  const candidates = getAllBySelectorList(
    [
      ".artdeco-inline-feedback__message",
      ".artdeco-inline-feedback",
      "[role='alert']",
      "[aria-live='polite']",
      "[aria-live='assertive']",
      ".artdeco-toast-item__message",
      ".artdeco-toast-item",
      ".jobs-easy-apply-modal",
      ".artdeco-modal",
      "[role='dialog']",
      ".jobs-apply-button--top-card + .artdeco-inline-feedback__message",
      ".jobs-unified-top-card .artdeco-inline-feedback__message",
      ".jobs-s-apply",
      ".jobs-unified-top-card",
      ".job-details-jobs-unified-top-card__container--two-pane"
    ],
    targetRoot
  );

  const scopedText = normalizeLabel(candidates.map((el) => String(el?.textContent || "")).join(" "));
  lastDailyEasyApplyLimitEvidence = "";
  if (!scopedText) return false;

  const isExactDailyLimitMsg =
    scopedText.includes("we limit daily submissions") ||
    scopedText.includes("limit daily submissions") ||
    (scopedText.includes("maintain quality and prevent bots") && scopedText.includes("tomorrow")) ||
    (scopedText.includes("save this job") && scopedText.includes("apply tomorrow")) ||
    scopedText.includes("helping each application get the right attention");

  const coreLimitPhrases = [
    "we limit the number of applications you can submit in a day",
    "limit the number of applications you can submit in a day",
    "we limit the number of applications you can submit per day",
    "limit the number of applications you can submit per day",
    "daily application limit",
    "exceeded the daily application limit",
    "we limit daily submissions",
    "limit daily submissions"
  ];

  const coreMatch = coreLimitPhrases.find((phrase) => scopedText.includes(phrase));
  const hasTomorrowSignal =
    scopedText.includes("apply tomorrow") ||
    scopedText.includes("try again tomorrow") ||
    scopedText.includes("please try again tomorrow") ||
    scopedText.includes("tomorrow");

  if (isExactDailyLimitMsg || (coreMatch && (hasTomorrowSignal || scopedText.includes("submit in a day") || scopedText.includes("per day")))) {
    lastDailyEasyApplyLimitEvidence = `matched:${coreMatch || "exact_daily_limit_message"}${hasTomorrowSignal ? "+tomorrow" : ""}`;
    return true;
  }
  return false;
}

async function pauseRunForDailyEasyApplyLimit(settings, reason = "LinkedIn daily submission limit reached: We limit daily submissions to maintain quality and prevent bots. Save this job and apply tomorrow.") {
  const runId = String(lastRunStartedAt || "");
  if (runId && dailyLimitHandledRunId === runId) return false;
  if (runId) dailyLimitHandledRunId = runId;

  runStats.skipped += 1;
  await logOutcome("warn", "🛑 LinkedIn daily Easy Apply limit reached ('We limit daily submissions...'). Safe stop activated.", "DAILY_EASY_APPLY_LIMIT");
  await recordOutcome("SKIPPED", {
    reasonCode: "DAILY_EASY_APPLY_LIMIT",
    reason,
    ...currentJobContext
  });
  await reportProgress();
  await sendMessage({ type: "CP_PAUSE" });
  await botChat(
    "🛑 LinkedIn daily submission limit reached ('We limit daily submissions to maintain quality and prevent bots... Save this job and apply tomorrow.'). The run has been safely stopped to protect your account.",
    "warn"
  );
  await debugLog(settings, "Paused due daily limit", { reason, evidence: lastDailyEasyApplyLimitEvidence });
  return true;
}

async function recordOutcome(outcomeType, data) {
  await sendMessage({
    type: "CP_RECORD_OUTCOME",
    outcomeType,
    data: {
      ...(data || {}),
      pageUrl: window.location.href
    }
  });
}

async function requestAiAnswer(questionLabel, questionType, options = [], validationMessage = "") {
  const cacheKey = `${normalizeLabel(questionLabel)}|${questionType}|${(options || []).map(normalizeLabel).sort().join(",")}`;
  const cached = aiAnswerCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const response = await sendMessage({
    type: "CP_AI_ANSWER",
    question: questionLabel,
    questionType,
    options,
    validationMessage,
    jobContext: currentJobContext
  });
  if (!response?.ok) {
    aiAnswerCache.set(cacheKey, "");
    return "";
  }
  const answer = String(response.answer || "").trim();
  aiAnswerCache.set(cacheKey, answer);
  return answer;
}

function buildAnswerPhrases(answer) {
  const normalized = normalizeLabel(answer);
  if (!normalized) return [];
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  const phrases = [normalized];
  if (compact && compact !== normalized) phrases.push(compact);
  if (normalized === "decline" || normalized.includes("prefer not")) {
    phrases.push("decline", "prefer not", "not wish", "don't wish", "not want", "opt out", "do not contact", "no");
  } else if (normalized.includes("yes")) {
    phrases.push("yes", "agree", "i do", "i have", "accept", "consent", "opt in");
  } else if (normalized.includes("no")) {
    phrases.push("no", "disagree", "i don't", "i do not", "decline", "do not contact", "opt out");
  }
  return [...new Set(phrases.filter(Boolean))];
}

function optionFingerprint(value) {
  return normalizeLabel(value).replace(/[^a-z0-9]/g, "");
}

function isConsentLikeQuestion(label) {
  const l = normalizeLabel(label);
  return (
    isMarketingConsentQuestion(l) ||
    l.includes("consent") ||
    l.includes("permission") ||
    l.includes("opt in") ||
    l.includes("opt-in") ||
    (l.includes("receive") && (l.includes("email") || l.includes("sms") || l.includes("text") || l.includes("phone"))) ||
    l.includes("contact you") ||
    l.includes("do you agree") ||
    l.includes("i agree") ||
    l.includes("terms") ||
    l.includes("privacy")
  );
}

function selectBestOption(options, answer) {
  const phrases = buildAnswerPhrases(answer);
  if (!phrases.length) return null;
  for (const phrase of phrases) {
    const phraseFp = optionFingerprint(phrase);
    const target =
      options.find((o) => normalizeLabel(o.text || "") === phrase) ||
      options.find((o) => normalizeLabel(o.text || "").includes(phrase)) ||
      options.find((o) => phrase.includes(normalizeLabel(o.text || ""))) ||
      options.find((o) => optionFingerprint(o.text || "") === phraseFp) ||
      options.find((o) => optionFingerprint(o.text || "").includes(phraseFp)) ||
      options.find((o) => phraseFp.includes(optionFingerprint(o.text || "")));
    if (target) return target;
  }
  return null;
}

function selectFallbackOption(options, contextLabel = "") {
  if (!Array.isArray(options) || !options.length) return null;
  const cleaned = options.filter((o) => !isPlaceholderOptionText(String(o?.text || "")));
  if (!cleaned.length) return null;

  const isConsent = isConsentLikeQuestion(contextLabel);

  const yesOption = cleaned.find((o) => {
    const t = normalizeLabel(o.text || "");
    return t === "yes" || t.startsWith("yes ") || t.endsWith(" yes") || t.includes(" yes ");
  });
  const noOption = cleaned.find((o) => {
    const t = normalizeLabel(o.text || "");
    return (
      t === "no" ||
      t.includes(" no ") ||
      t.startsWith("no ") ||
      t.endsWith(" no") ||
      t.includes("decline") ||
      t.includes("prefer not")
    );
  });

  // Default behavior: prefer YES when it's a classic yes/no question (except consent-like prompts).
  if (!isConsent && yesOption && noOption) return yesOption;

  if (isConsent) {
    const safeNo = cleaned.find((o) => {
      const t = normalizeLabel(o.text || "");
      return (
        t === "no" ||
        t.includes(" no ") ||
        t.startsWith("no ") ||
        t.endsWith(" no") ||
        t.includes("decline") ||
        t.includes("prefer not")
      );
    });
    if (safeNo) return safeNo;
  }

  const notApplicable = cleaned.find((o) => {
    const t = normalizeLabel(o.text || "");
    return t.includes("not applicable") || t === "n/a";
  });
  if (notApplicable) return notApplicable;

  const preferNot = cleaned.find((o) => normalizeLabel(o.text || "").includes("prefer not"));
  if (preferNot) return preferNot;

  // Deterministic fallback avoids oscillating answers across retries.
  return cleaned[0];
}

function getRadioOptionText(input, root = document) {
  if (!input) return "";
  const candidates = [];
  const inlineLabel = input.closest("label");
  if (inlineLabel) candidates.push(cleanQuestionLabel(inlineLabel.textContent || ""));
  if (input.id) {
    const forLabel =
      root?.querySelector?.(`label[for='${CSS.escape(input.id)}']`) ||
      document.querySelector(`label[for='${CSS.escape(input.id)}']`);
    if (forLabel) candidates.push(cleanQuestionLabel(forLabel.textContent || ""));
  }
  const parentText = cleanQuestionLabel(input.parentElement?.textContent || "");
  if (parentText) candidates.push(parentText);
  const ariaText = cleanQuestionLabel(input.getAttribute("aria-label") || "");
  if (ariaText) candidates.push(ariaText);
  const valueText = cleanQuestionLabel(input.value || "");
  if (valueText) candidates.push(valueText);
  candidates.sort((a, b) => b.length - a.length);
  return candidates.find(Boolean) || "";
}

function getRadioClickTarget(input, root = document) {
  if (!input) return null;
  if (input.id) {
    const forLabel =
      root?.querySelector?.(`label[for='${CSS.escape(input.id)}']`) ||
      document.querySelector(`label[for='${CSS.escape(input.id)}']`);
    if (forLabel) return forLabel;
  }
  return input.closest("label") || input;
}

function isResumeOptionText(value) {
  const text = normalizeLabel(value);
  if (!text) return false;
  if (text.includes("select resume") || text.includes("deselect resume")) return true;
  if (text.includes("resume") && (text.includes(".pdf") || text.includes(".doc") || text.includes(".docx"))) return true;
  return false;
}

function getResumeOptionIdentity(value) {
  const raw = normalizeLabel(value);
  if (!raw) return "";
  const cleaned = raw
    .replace(/\bselect resume\b/g, "")
    .replace(/\bdeselect resume\b/g, "")
    .replace(/\buploaded\b.*$/g, "")
    .replace(/\blast updated\b.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return optionFingerprint(cleaned || raw);
}

function getResumeChoiceCacheKey(questionLabel = "") {
  const jobKey = String(currentJobContext.jobId || currentJobContext.jobUrl || window.location.pathname || "job")
    .trim()
    .slice(0, 180);
  const labelKey = questionKeyFromLabel(questionLabel || "resume") || "resume";
  return `${jobKey}::${labelKey}`;
}

function getResumeOptionRecencyScore(textValue) {
  const raw = String(textValue || "");
  const norm = normalizeLabel(raw);
  if (!norm) return 0;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  if (norm.includes("today")) return now;
  if (norm.includes("yesterday")) return now - dayMs;

  const agoMatch = norm.match(/(\d+)\s*(minute|hour|day|week|month|year)s?\s+ago/);
  if (agoMatch) {
    const amount = Number(agoMatch[1] || 0);
    const unit = agoMatch[2] || "";
    if (Number.isFinite(amount) && amount >= 0) {
      const multipliers = {
        minute: 60 * 1000,
        hour: 60 * 60 * 1000,
        day: dayMs,
        week: 7 * dayMs,
        month: 30 * dayMs,
        year: 365 * dayMs
      };
      const unitMs = multipliers[unit] || 0;
      if (unitMs > 0) return now - amount * unitMs;
    }
  }

  const monthMap = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11
  };
  const monthMatch = raw.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,|\s)\s*(\d{2,4})\b/i);
  if (monthMatch) {
    const monthKey = String(monthMatch[1] || "").slice(0, 3).toLowerCase();
    const day = Number(monthMatch[2] || 0);
    let year = Number(monthMatch[3] || 0);
    if (year < 100) year += 2000;
    if (monthKey in monthMap && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
      return new Date(year, monthMap[monthKey], day).getTime();
    }
  }

  const numericMatch = raw.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (numericMatch) {
    let month = Number(numericMatch[1] || 0);
    let day = Number(numericMatch[2] || 0);
    let year = Number(numericMatch[3] || 0);
    if (year < 100) year += 2000;
    if (month > 12 && day <= 12) {
      const tmp = month;
      month = day;
      day = tmp;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
      return new Date(year, month - 1, day).getTime();
    }
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPreferredResumeOption(options, questionLabel = "") {
  if (!Array.isArray(options) || !options.length) return null;
  const resumeOptions = options.filter((option) => isResumeOptionText(option?.text || option?.value || ""));
  if (!resumeOptions.length) return null;

  const cacheKey = getResumeChoiceCacheKey(questionLabel);
  const cachedIdentity = resumeChoiceCache.get(cacheKey);
  if (cachedIdentity) {
    const cachedMatches = resumeOptions
      .map((option, index) => ({
        option,
        index,
        text: String(option?.text || option?.value || ""),
      }))
      .filter((entry) => getResumeOptionIdentity(entry.text) === cachedIdentity)
      .sort((a, b) => {
        const aNorm = normalizeLabel(a.text);
        const bNorm = normalizeLabel(b.text);
        const aSelectionScore = aNorm.includes("select resume") ? 2 : aNorm.includes("deselect resume") ? 1 : 0;
        const bSelectionScore = bNorm.includes("select resume") ? 2 : bNorm.includes("deselect resume") ? 1 : 0;
        if (bSelectionScore !== aSelectionScore) return bSelectionScore - aSelectionScore;
        const aChecked = a.option?.input?.checked ? 1 : 0;
        const bChecked = b.option?.input?.checked ? 1 : 0;
        if (aChecked !== bChecked) return aChecked - bChecked;
        return a.index - b.index;
      });
    const cached = cachedMatches[0]?.option || null;
    if (cached) return cached;
  }

  const ranked = resumeOptions
    .map((option, index) => {
      const text = String(option?.text || option?.value || "");
      const norm = normalizeLabel(text);
      const recencyScore = getResumeOptionRecencyScore(text);
      const selectionScore = norm.includes("select resume") ? 2 : norm.includes("deselect resume") ? 1 : 0;
      const checkedScore = option?.input?.checked ? 1 : 0;
      return { option, index, recencyScore, selectionScore, checkedScore };
    })
    .sort((a, b) => {
      if (b.recencyScore !== a.recencyScore) return b.recencyScore - a.recencyScore;
      if (b.selectionScore !== a.selectionScore) return b.selectionScore - a.selectionScore;
      if (b.checkedScore !== a.checkedScore) return b.checkedScore - a.checkedScore;
      return a.index - b.index;
    });

  const picked = ranked[0]?.option || null;
  if (picked) {
    resumeChoiceCache.set(cacheKey, getResumeOptionIdentity(picked?.text || picked?.value || ""));
  }
  return picked;
}

async function logOutcome(kind, message, reasonCode = "", meta = undefined) {
  const m = reasonCode ? `${message}` : message;
  await logLine(m, kind, { ...(meta || {}), reasonCode: reasonCode || undefined });
}

function getConfiguredSearchTerms(settings) {
  const userTerms = parseListSetting(settings?.searchTerms);
  const activeKeyword = getCurrentSearchKeyword();
  const baseTerm = userTerms.length > 0 ? userTerms[0] : activeKeyword;
  if (!baseTerm) return userTerms;

  const alternatives = getAlternativeKeywordsForTerm(baseTerm);
  const combined = new Set([...userTerms, ...alternatives]);
  return Array.from(combined);
}

function getSwitchNumber(settings) {
  return Math.max(1, Number(settings.switchNumber || 1));
}

function getCurrentSearchKeyword() {
  try {
    const url = new URL(window.location.href);
    return String(url.searchParams.get("keywords") || "").trim();
  } catch {
    return "";
  }
}

const SEARCH_LOCATION_QUERY_PARAM_KEYS = ["geoId", "locationId", "locationUrn", "geoUrn", "f_PP"];

function isRemoteLikeSearchValue(value) {
  const normalized = normalizeLabel(value);
  return (
    normalized === "remote" ||
    normalized === "work from home" ||
    normalized === "wfh" ||
    normalized === "anywhere" ||
    normalized === "worldwide"
  );
}

function isRemoteModeSelected(settings) {
  return parseListSetting(settings?.onSite).some((value) => normalizeLabel(value) === "remote");
}

function clearSearchLocationQueryParams(url) {
  for (const key of SEARCH_LOCATION_QUERY_PARAM_KEYS) {
    url.searchParams.delete(key);
  }
}

function resetRemoteLocationKeywordCursor() {
  runRemoteLocationKeywordCursor = 0;
}

function getRemoteLocationKeywordPool(settings) {
  const deduped = new Set();
  const merged = [
    String(settings?.searchLocation || "").trim(),
    ...parseListSetting(settings?.filterLocations).filter((value) => isRemoteLikeSearchValue(value)),
    ...REMOTE_LOCATION_KEYWORDS,
  ];
  const values = [];
  for (const rawValue of merged) {
    const value = String(rawValue || "").trim();
    if (!value || !isRemoteLikeSearchValue(value)) continue;
    const normalized = normalizeLabel(value);
    if (!normalized || deduped.has(normalized)) continue;
    deduped.add(normalized);
    values.push(value);
  }
  return values;
}

function shouldUseRemoteLocationKeywords(settings) {
  if (!isRemoteModeSelected(settings)) return false;
  const searchLocation = String(settings?.searchLocation || "").trim();
  const filterLocations = parseListSetting(settings?.filterLocations);
  if (searchLocation && !isRemoteLikeSearchValue(searchLocation)) return false;
  return filterLocations.every((value) => !value || isRemoteLikeSearchValue(value));
}

function getEffectiveSearchLocation(settings, locationOverride = "") {
  const override = String(locationOverride || "").trim();
  if (override) return override;
  const explicitSearchLocation = String(settings?.searchLocation || "").trim();
  // Treat remote-like values as "do not set location input".
  // LinkedIn already has an explicit Remote workplace filter; typing "remote" into the location box
  // creates confusing searches (e.g. "remote" location tokens) and can keep results pinned to a region.
  if (isRemoteLikeSearchValue(explicitSearchLocation)) return "";
  if (shouldUseRemoteLocationKeywords(settings)) {
    // When remote mode is already selected, repeatedly typing "remote" back into
    // LinkedIn's location field causes avoidable reloads and search resets.
    return isRemoteLikeSearchValue(explicitSearchLocation) ? "" : explicitSearchLocation;
  }
  // Fall back to first non-remote filterLocations value when searchLocation is empty,
  // so Preferred Locations (e.g. "Mohali") are used as the LinkedIn search location.
  // Skip this when remote mode is active — typing a city into the location field
  // while f_WT=2 (Remote) causes LinkedIn to set a geoId that produces zero results.
  if (!explicitSearchLocation && !isRemoteModeSelected(settings)) {
    const filterLocations = parseListSetting(settings?.filterLocations);
    const firstRealLocation = filterLocations.find((value) => value && !isRemoteLikeSearchValue(value));
    if (firstRealLocation) return firstRealLocation;
  }
  return explicitSearchLocation;
}

function buildSearchLocationDecisionMeta(settings, locationOverride = "", resolvedLocation = "") {
  const override = String(locationOverride || "").trim();
  const explicitSearchLocation = String(settings?.searchLocation || "").trim();
  const filterLocations = parseListSetting(settings?.filterLocations);
  const remoteModeSelected = isRemoteModeSelected(settings);
  const useRemoteLocationKeywords = shouldUseRemoteLocationKeywords(settings);
  const skipRemoteLocationTyping =
    useRemoteLocationKeywords && isRemoteLikeSearchValue(explicitSearchLocation) && !override;

  let source = "none";
  if (override) source = "override";
  else if (explicitSearchLocation) source = "settings.searchLocation";

  return {
    resolvedLocation: String(resolvedLocation || "").trim(),
    source,
    locationOverride: override || "",
    settingsSearchLocation: explicitSearchLocation,
    remoteModeSelected,
    useRemoteLocationKeywords,
    skipRemoteLocationTyping,
    filterLocations
  };
}

function shouldClearStaleLocationQueryParams(settings, url) {
  if (!url) return false;
  const hasLocationParams = SEARCH_LOCATION_QUERY_PARAM_KEYS.some((key) => url.searchParams.has(key));
  if (!hasLocationParams) return false;

  const searchLocation = String(settings?.searchLocation || "").trim();
  const filterLocations = parseListSetting(settings?.filterLocations);

  if (isRemoteLikeSearchValue(searchLocation)) return true;
  if (filterLocations.length > 0 && filterLocations.every((value) => isRemoteLikeSearchValue(value))) return true;
  if (isRemoteModeSelected(settings) && filterLocations.length > 0 && filterLocations.every((value) => !value || isRemoteLikeSearchValue(value))) {
    return true;
  }
  // When remote mode is active but filterLocations has non-remote values (e.g. "Mohali"),
  // the search location won't be typed into the input (see getEffectiveSearchLocation),
  // so any stale geoId in the URL from a previous non-remote search should be cleared.
  if (isRemoteModeSelected(settings) && getEffectiveSearchLocation(settings) === "") {
    return true;
  }
  return false;
}

function buildJobsSearchUrl(keyword = "") {
  const url = new URL(JOBS_SEARCH_URL);
  const cleanKeyword = String(keyword || "").trim();
  if (cleanKeyword) {
    url.searchParams.set("keywords", cleanKeyword);
  }
  return url.toString();
}

function getActiveRunSearchUrl(settings) {
  const term = getConfiguredSearchTerms(settings)[runSearchTermCursor] || "";
  const url = new URL(buildJobsSearchUrl(term));
  const dateParam = datePostedToLinkedInParam(settings?.datePosted || "");
  const sortParam = sortByToLinkedInParam(settings?.sortBy || "");
  const workplaceParam = onSiteToLinkedInParam(settings?.onSite || "");
  if (dateParam) url.searchParams.set("f_TPR", dateParam);
  if (sortParam) url.searchParams.set("sortBy", sortParam);
  if (workplaceParam) url.searchParams.set("f_WT", workplaceParam);
  return url.toString();
}

function datePostedToLinkedInParam(value) {
  const v = normalizeLabel(value);
  if (v === "past 24 hours") return "r86400";
  if (v === "past week") return "r604800";
  if (v === "past month") return "r2592000";
  return "";
}

function workModeValueToLinkedInCode(value) {
  const normalized = normalizeLabel(value);
  if (normalized === "on site" || normalized === "onsite") return "1";
  if (normalized === "remote") return "2";
  if (normalized === "hybrid") return "3";
  return "";
}

function onSiteToLinkedInParam(value) {
  const codes = parseListSetting(value)
    .map((item) => workModeValueToLinkedInCode(item))
    .filter(Boolean);
  return Array.from(new Set(codes)).join(",");
}

function getBroaderDatePostedValue(currentValue) {
  const normalizedCurrent = normalizeLabel(currentValue);
  if (normalizedCurrent === "past 24 hours") return "Past week";
  if (normalizedCurrent === "past week") return "Past month";
  if (normalizedCurrent === "past month") return "Any time";
  return "";
}

function getNextDatePostedValue(currentValue, stopAt24Hours = true) {
  const options = ["Any time", "Past month", "Past week", "Past 24 hours"];
  const normalizedCurrent = normalizeLabel(currentValue);
  const currentIndex = Math.max(
    0,
    options.findIndex((value) => normalizeLabel(value) === normalizedCurrent)
  );
  const nextIndex = Math.min(options.length - 1, currentIndex + 1);
  if (stopAt24Hours) {
    return options[nextIndex];
  }
  return options[(currentIndex + 1) % options.length];
}

function sortByToLinkedInParam(value) {
  const v = normalizeLabel(value);
  if (v === "most recent") return "DD";
  if (v === "most relevant") return "R";
  return "";
}

function getAlternateSortValue(currentValue) {
  return normalizeLabel(currentValue) === "most recent" ? "Most relevant" : "Most recent";
}

const TRANSIENT_SEARCH_QUERY_PARAM_KEYS = ["currentJobId", "jobId", "postApplyJobId", "refresh", "origin"];

function clearTransientSearchQueryParams(url) {
  for (const key of TRANSIENT_SEARCH_QUERY_PARAM_KEYS) {
    url.searchParams.delete(key);
  }
}

function hasTransientSearchQueryParams(url) {
  try {
    const parsed = url instanceof URL ? url : new URL(String(url || window.location.href));
    return TRANSIENT_SEARCH_QUERY_PARAM_KEYS.some((key) => parsed.searchParams.has(key));
  } catch {
    return false;
  }
}

function hasSearchLocationQueryParams(url) {
  try {
    const parsed = url instanceof URL ? url : new URL(String(url || window.location.href));
    return SEARCH_LOCATION_QUERY_PARAM_KEYS.some((key) => parsed.searchParams.has(key));
  } catch {
    return false;
  }
}

function readStoredSearchResultsUrl() {
  try {
    const raw = String(sessionStorage.getItem(LAST_SEARCH_RESULTS_URL_KEY) || "").trim();
    if (!raw) return "";
    const url = new URL(raw);
    if (!url.pathname.startsWith("/jobs/search")) return "";
    clearTransientSearchQueryParams(url);
    return url.toString();
  } catch {
    return "";
  }
}

function writeStoredSearchResultsUrl(urlValue) {
  try {
    const url = new URL(String(urlValue || "").trim());
    if (!url.pathname.startsWith("/jobs/search")) return;
    clearTransientSearchQueryParams(url);
    sessionStorage.setItem(LAST_SEARCH_RESULTS_URL_KEY, url.toString());
  } catch {
    // ignore storage failures
  }
}

function buildCanonicalSearchUrl(settings, options = {}) {
  const preserveStart = options?.preserveStart !== false;
  const baseCandidates = [
    options?.baseUrl,
    readStoredSearchResultsUrl(),
    window.location.href,
    getActiveRunSearchUrl(settings)
  ];

  let url = null;
  for (const candidate of baseCandidates) {
    try {
      const parsed = new URL(String(candidate || "").trim());
      if (parsed.pathname.startsWith("/jobs/search")) {
        url = parsed;
        break;
      }
    } catch {
      // ignore invalid candidates
    }
  }

  if (!url) {
    url = new URL(getActiveRunSearchUrl(settings));
  }

  const currentStart = String(url.searchParams.get("start") || "").trim();
  const dateParam = datePostedToLinkedInParam(settings?.datePosted || "");
  const sortParam = sortByToLinkedInParam(settings?.sortBy || "");
  const workplaceParam = onSiteToLinkedInParam(settings?.onSite || "");

  const terms = getConfiguredSearchTerms(settings);
  if (terms.length > 0) {
    const activeTerm = terms[Math.min(runSearchTermCursor, terms.length - 1)] || "";
    if (activeTerm) {
      url.searchParams.set("keywords", activeTerm);
      captureDebugEvent("search", "KEYWORDS_ENFORCED", { term: activeTerm, cursor: runSearchTermCursor });
    }
  }

  if (dateParam) url.searchParams.set("f_TPR", dateParam);
  else url.searchParams.delete("f_TPR");

  if (sortParam) url.searchParams.set("sortBy", sortParam);
  else url.searchParams.delete("sortBy");

  if (workplaceParam) url.searchParams.set("f_WT", workplaceParam);
  else url.searchParams.delete("f_WT");

  if (settings?.easyApplyOnly !== false) {
    url.searchParams.set("f_AL", "true");
  }

  if (shouldClearStaleLocationQueryParams(settings, url)) {
    clearSearchLocationQueryParams(url);
  }

  if (!preserveStart || !/^\d+$/.test(currentStart) || Number(currentStart) <= 0) {
    url.searchParams.delete("start");
  } else {
    url.searchParams.set("start", currentStart);
  }

  clearTransientSearchQueryParams(url);
  return url;
}

function normalizeSearchUrlWithoutReload(settings) {
  if (!isJobsSearchPage()) return false;
  try {
    const before = new URL(window.location.href).toString();
    const after = buildCanonicalSearchUrl(settings, { baseUrl: before, preserveStart: true }).toString();
    writeStoredSearchResultsUrl(after);
    if (after === before) return false;
    window.history.replaceState(null, "", after);
    return true;
  } catch {
    return false;
  }
}

function getResumableSearchUrl(settings, options = {}) {
  const resumeUrl = buildCanonicalSearchUrl(settings, {
    baseUrl: options?.baseUrl,
    preserveStart: options?.preserveStart !== false
  });
  try {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.pathname.startsWith("/jobs/search")) {
      if (!shouldClearStaleLocationQueryParams(settings, currentUrl)) {
        for (const key of SEARCH_LOCATION_QUERY_PARAM_KEYS) {
          const value = String(currentUrl.searchParams.get(key) || "").trim();
          if (value) resumeUrl.searchParams.set(key, value);
        }
      }
    }
  } catch {
    // fall back to the active run search URL
  }
  clearTransientSearchQueryParams(resumeUrl);
  writeStoredSearchResultsUrl(resumeUrl.toString());
  return resumeUrl.toString();
}

function isSameSearchUrl(urlA, urlB) {
  try {
    const a = urlA instanceof URL ? urlA : new URL(String(urlA || ""));
    const b = urlB instanceof URL ? urlB : new URL(String(urlB || ""));
    if (a.origin !== b.origin || a.pathname !== b.pathname) return false;
    const meaningfulKeys = ["keywords", "geoId", "location", "f_AL", "f_TPR", "f_WT", "f_E", "f_JT", "start", "sortBy"];
    for (const key of meaningfulKeys) {
      const valA = normalizeLabel(String(a.searchParams.get(key) || ""));
      const valB = normalizeLabel(String(b.searchParams.get(key) || ""));
      if (valA !== valB) return false;
    }
    return true;
  } catch {
    return false;
  }
}

let lastSearchRedirectTimestamp = 0;

async function ensureSearchQueryParams(settings) {
  if (!isJobsSearchPage()) return true;
  try {
    const before = new URL(window.location.href).toString();
    const transientOnlyUrl = new URL(before);
    clearTransientSearchQueryParams(transientOnlyUrl);
    const url = buildCanonicalSearchUrl(settings, { baseUrl: before, preserveStart: true });

    const after = url.toString();
    if (after !== before) {
      if (isSameSearchUrl(before, after) || after === transientOnlyUrl.toString()) {
        window.history.replaceState(null, "", after);
        writeStoredSearchResultsUrl(after);
        await debugLog(settings, "Normalized search URL without reload", { before, after });
        return true;
      }

      const now = Date.now();
      if (now - lastSearchRedirectTimestamp < 4000) {
        window.history.replaceState(null, "", after);
        writeStoredSearchResultsUrl(after);
        return true;
      }
      lastSearchRedirectTimestamp = now;

      writeStoredSearchResultsUrl(after);
      await logLine("Applied search query preferences (date/sort/work mode)", "info");
      window.location.href = after;
      return false;
    }
    writeStoredSearchResultsUrl(after);
    return true;
  } catch {
    return true;
  }
}

async function relaxDatePostedForEmptyResults(settings) {
  const nextDatePosted = getBroaderDatePostedValue(settings?.datePosted || "");
  if (!nextDatePosted) return false;

  const currentDatePosted = String(settings?.datePosted || "Any time").trim() || "Any time";
  const saved = await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { datePosted: nextDatePosted } });
  const nextSettings =
    saved?.ok && saved.settings && typeof saved.settings === "object"
      ? { ...settings, ...saved.settings, datePosted: nextDatePosted }
      : { ...settings, datePosted: nextDatePosted };
  const nextUrl = getActiveRunSearchUrl(nextSettings);
  if (!nextUrl) return false;

  await logLine(`No jobs with "${currentDatePosted}". Trying "${nextDatePosted}".`, "info");
  resetRemoteLocationKeywordCursor();
  window.location.href = nextUrl;
  return true;
}

async function ensureSearchTermIfNeeded(settings) {
  if (!isJobsSearchPage()) return true;
  const terms = getConfiguredSearchTerms(settings);
  if (!terms.length) return true;

  const currentKeyword = getCurrentSearchKeyword();
  const currentNorm = normalizeLabel(currentKeyword);

  // If current page keyword matches any of the configured terms/synonyms, align cursor and do not reload
  if (currentNorm) {
    const matchingIndex = terms.findIndex((t) => normalizeLabel(t) === currentNorm);
    if (matchingIndex >= 0) {
      runSearchTermCursor = matchingIndex;
      return true;
    }
    // If user didn't specify explicit searchTerms in settings, accept whatever LinkedIn has
    const userTerms = parseListSetting(settings?.searchTerms);
    if (!userTerms.length) {
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

  await logLine(`Switching search term: ${selected}`);
  resetRemoteLocationKeywordCursor();
  window.location.href = getActiveRunSearchUrl(settings);
  return false;
}

async function rotateSearchTerm(settings) {
  const terms = getConfiguredSearchTerms(settings);
  if (terms.length <= 1) return false;
  const prevCursor = runSearchTermCursor;
  runSearchTermCursor = (runSearchTermCursor + 1) % terms.length;
  runSearchTermSuccessCount = 0;
  resetRemoteLocationKeywordCursor();
  const nextTerm = terms[runSearchTermCursor];
  lastSearchRedirectTimestamp = Date.now();
  captureDebugEvent("search", "TERM_ROTATED", { from: terms[prevCursor], to: nextTerm, cursor: runSearchTermCursor, totalTerms: terms.length });
  await logLine(`Switching to alternative keyword: "${nextTerm}"`, "info");
  await botChat(`Switching search to related keyword: "${nextTerm}"...`);
  window.location.href = getActiveRunSearchUrl(settings);
  return true;
}

function buildNextPageUrlByStart(settings, currentUrl, step = 25) {
  try {
    const url = buildCanonicalSearchUrl(settings, {
      baseUrl: currentUrl || window.location.href,
      preserveStart: true
    });
    const currentStartRaw = String(url.searchParams.get("start") || "0").trim();
    const currentStart = Number.isFinite(Number(currentStartRaw)) ? Number(currentStartRaw) : 0;
    const nextStart = Math.max(0, currentStart + Math.max(1, Number(step || 25)));
    url.searchParams.set("start", String(nextStart));
    writeStoredSearchResultsUrl(url.toString());
    return url.toString();
  } catch {
    return "";
  }
}

async function gotoNextResultsPage(settings) {
  const currentKeyword = getCurrentSearchKeyword() || "current search";

  // Scroll down to the bottom of the list container to reveal pagination
  try {
    const listScrollRoot = getJobListScrollContainer();

    if (listScrollRoot && typeof listScrollRoot.scrollTo === "function") {
      listScrollRoot.scrollTo({ top: listScrollRoot.scrollHeight || 10000, behavior: "smooth" });
    } else if (listScrollRoot && typeof listScrollRoot.scrollBy === "function") {
      listScrollRoot.scrollBy({ top: 3500, behavior: "smooth" });
    }
    window.scrollTo({ top: document.body.scrollHeight || 10000, behavior: "smooth" });
    await sleep(800);
  } catch {
    // ignore
  }

  // Check if LinkedIn pagination component exists in DOM (matches Untitled-2.xml)
  const paginationContainer = getBySelectorList([
    ".jobs-search-pagination",
    ".jobs-search-results-list__pagination",
    ".jobs-search-results-list__pagination-container",
    ".artdeco-pagination"
  ]);

  // Parse page state text like "Page 1 of 9" or "Page 2 of 8"
  const pageStateElem = document.querySelector(".jobs-search-pagination__page-state");
  const pageStateText = pageStateElem?.textContent || "";
  const pageStateMatch = pageStateText.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
  const currentPageFromState = pageStateMatch ? Number(pageStateMatch[1]) : 0;
  const totalPagesFromState = pageStateMatch ? Number(pageStateMatch[2]) : 0;

  const currentPageButton = getBySelectorList([
    "button.jobs-search-pagination__indicator-button--active",
    "button.jobs-search-pagination__indicator-button[aria-current='page']",
    ".artdeco-pagination__indicator--number.active button",
    ".artdeco-pagination__indicator--number.selected button",
    "li.artdeco-pagination__indicator--number.active button",
    "li.artdeco-pagination__indicator--number.selected button"
  ]);
  const currentPage = currentPageFromState || Number(String(currentPageButton?.textContent || "").trim() || "0") || 1;

  // If page state clearly says we are on the last page (e.g. Page 9 of 9), then this keyword is exhausted
  if (totalPagesFromState > 0 && currentPage >= totalPagesFromState) {
    await debugLog(settings, `Reached last page (${currentPage}/${totalPagesFromState}) for keyword "${currentKeyword}"`);
    return false;
  }

  // Find Next button using exact LinkedIn selectors from Untitled-2.xml
  let nextButton = getBySelectorList([
    "button.jobs-search-pagination__button--next",
    "button[aria-label='View next page']",
    "button[aria-label='Next']",
    "button[aria-label='Page next']",
    "button.artdeco-pagination__button--next",
    ".jobs-search-pagination__button--next"
  ]);

  if (!nextButton && currentPage > 0) {
    nextButton = getBySelectorList([
      `button.jobs-search-pagination__indicator-button[aria-label='Page ${currentPage + 1}']`,
      `button[aria-label='Page ${currentPage + 1}']`,
      `.artdeco-pagination__pages button[aria-label='Page ${currentPage + 1}']`,
      `.artdeco-pagination__pages button[aria-label='page ${currentPage + 1}']`
    ]);
  }

  const hasNextPageButton = Boolean(
    nextButton &&
    !nextButton.disabled &&
    !nextButton.classList.contains("artdeco-button--disabled") &&
    !nextButton.classList.contains("disabled") &&
    nextButton.getAttribute("aria-disabled") !== "true"
  );

  // If no pagination exists or next button is disabled, there are no more pages for this keyword
  if (!paginationContainer && !hasNextPageButton) {
    await debugLog(settings, "No pagination container found; search has only 1 page", { keyword: currentKeyword });
    return false;
  }

  if (nextButton && (nextButton.disabled || nextButton.classList.contains("artdeco-button--disabled") || nextButton.getAttribute("aria-disabled") === "true")) {
    await debugLog(settings, "Next page button is disabled; all pages exhausted for keyword", { keyword: currentKeyword });
    return false;
  }

  const fallbackNextUrl = buildNextPageUrlByStart(settings, window.location.href, 25);

  if (nextButton && hasNextPageButton && isVisibleElement(nextButton)) {
    const nextPageNum = currentPage + 1;
    await logLine(`📄 Finished page ${currentPage}. Loading page ${nextPageNum}${totalPagesFromState ? ` of ${totalPagesFromState}` : ""} for "${currentKeyword}"...`, "info");
    await botChat(`Loading page ${nextPageNum}${totalPagesFromState ? ` of ${totalPagesFromState}` : ""} for "${currentKeyword}"...`);
    const clicked = await resilientClick(nextButton, "Next page");
    if (clicked) {
      await sleep(1500);
      await loadAllJobCardsOnPage(settings);
      return true;
    }
  }

  if (fallbackNextUrl && fallbackNextUrl !== window.location.href && hasNextPageButton) {
    await logLine(`📄 Loading next page of jobs for "${currentKeyword}"...`, "info");
    window.location.href = fallbackNextUrl;
    return true;
  }

  return false;
}

async function setSearchLocationIfNeeded(settings, locationOverride = "") {
  const location = getEffectiveSearchLocation(settings, locationOverride);
  await debugLog(settings, "Search location decision", buildSearchLocationDecisionMeta(settings, locationOverride, location));
  if (!location) return;
  if (!locationOverride) {
    try {
      const currentUrl = new URL(window.location.href);
      if (hasSearchLocationQueryParams(currentUrl) && !shouldClearStaleLocationQueryParams(settings, currentUrl)) {
        await debugLog(settings, "Search location already represented in URL", { location, url: currentUrl.toString() });
        return;
      }
    } catch {
      // ignore URL parsing issues and fall through to input-based location setting
    }
  }
  const input = getJobsSearchLocationInput();
  if (!input) {
    await debugLog(settings, "Search location input not found", { url: window.location.href });
    return;
  }
  if (normalizeLabel(input.value || "") === normalizeLabel(location)) {
    await debugLog(settings, "Search location already set", { location, url: window.location.href });
    return;
  }
  await debugLog(settings, "Setting search location input", {
    before: String(input.value || ""),
    next: location,
    url: window.location.href
  });
  input.focus();
  input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.value = location;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  captureDebugEvent("search", "SEARCH_LOCATION_SET", { location });
  await logLine(`Search location set: ${location}`);
  await botChat(`Location locked: ${location}. Scanning relevant jobs...`);
  await sleep(800);
}

function getJobsSearchLocationInput(root = document) {
  // LinkedIn renders multiple inputs with the same class; avoid selecting the keywords input by mistake.
  const byLabel = getBySelectorList(
    ["input[aria-label*='City, state, or zip code']", "input[placeholder*='City, state, or zip code']"],
    root
  );
  if (byLabel) return byLabel;

  const candidates = Array.from(root.querySelectorAll("input.jobs-search-box__text-input"));
  const locationLike = candidates.find((el) => {
    const aria = String(el.getAttribute("aria-label") || "");
    const placeholder = String(el.getAttribute("placeholder") || "");
    const combined = normalizeLabel(`${aria} ${placeholder}`);
    return combined.includes("city") || combined.includes("state") || combined.includes("zip") || combined.includes("location");
  });
  if (locationLike) return locationLike;

  // Heuristic: when there are 2 search inputs, LinkedIn typically renders keywords first, location second.
  if (candidates.length === 2) return candidates[1];
  return null;
}

async function clearLinkedInSearchLocationInput(settings) {
  const input = getJobsSearchLocationInput();
  if (!input) {
    await debugLog(settings, "Search location input not found for clearing", { url: window.location.href });
    return false;
  }
  const before = String(input.value || "").trim();

  // LinkedIn sometimes renders the selected location as a pill/token with an "X" button,
  // while the actual input value can be empty. Try to remove any token first.
  const container =
    input.closest(".jobs-search-box__text-input")?.parentElement ||
    input.closest(".jobs-search-box__inner") ||
    input.closest("form") ||
    input.parentElement;
  const clearBtn = container
    ? getBySelectorList(
        [
          "button[aria-label*='Clear location']",
          "button[aria-label*='Clear']",
          "button[aria-label*='Remove']",
          "button[aria-label*='Dismiss']"
        ],
        container
      )
    : null;
  if (clearBtn) {
    const clicked = await resilientClick(clearBtn, "Clear location token");
    if (clicked) {
      await logLine("Cleared LinkedIn search location token/button", "info");
      await sleep(500);
    }
  }

  // If we still have a visible value, clear the text input.
  const afterToken = String(input.value || "").trim();
  if (!before && !afterToken && !clearBtn) {
    await debugLog(settings, "Search location input already empty", { url: window.location.href });
    return false;
  }
  input.focus();
  input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  // As a fallback, backspace a few times to remove any remaining tokenized value.
  for (let i = 0; i < 5; i += 1) {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "Backspace", bubbles: true }));
  }
  await logLine("Cleared LinkedIn search location input", "info", { before });
  await sleep(800);
  return true;
}

async function rotateRemoteLocationKeyword(settings) {
  if (!shouldUseRemoteLocationKeywords(settings)) return false;
  const pool = getRemoteLocationKeywordPool(settings);
  if (pool.length <= 1) return false;
  if (runRemoteLocationKeywordCursor >= pool.length - 1) return false;
  runRemoteLocationKeywordCursor += 1;
  const nextKeyword = pool[runRemoteLocationKeywordCursor] || "";
  if (!nextKeyword) return false;
  await logLine(`No jobs. Trying remote location keyword: ${nextKeyword}.`, "info");
  await botChat("No results found. Adjusting search strategy...");
  await setSearchLocationIfNeeded(settings, nextKeyword);
  return true;
}

async function applyEasyApplyFilterIfNeeded(settings) {
  if (!settings.easyApplyOnly) return;
  let urlHasEasyApplyParam = false;
  try {
    const url = new URL(window.location.href);
    urlHasEasyApplyParam = url.searchParams.get("f_AL") === "true";
  } catch {
    urlHasEasyApplyParam = window.location.href.includes("f_AL=true");
  }
  let easyBtn = getBySelectorList([
    "button[aria-label*='Easy Apply filter']",
    "button[aria-label*='Easy Apply']",
    "button.jobs-search-box__filter-pill-button"
  ]);
  if (!easyBtn) {
    const candidates = Array.from(document.querySelectorAll("button, label, span"));
    easyBtn = candidates.find((el) => visibleText(el).includes("easy apply")) || null;
  }
  if (!easyBtn) {
    // Fallback: use "All filters" modal and toggle Easy Apply there.
    const allFiltersBtn = getBySelectorList([
      "button[aria-label*='All filters']",
      "button[aria-label='All filters']",
      "button.search-reusables__all-filters-pill-button"
    ]);
    if (!allFiltersBtn) {
      if (urlHasEasyApplyParam) {
        await debugLog(settings, "Easy Apply button not visible, but URL already has f_AL=true", { url: window.location.href });
      } else {
        await logLine("Easy Apply filter button not found", "warn");
        await debugLog(settings, "Easy Apply filter selectors failed", { url: window.location.href });
      }
      return;
    }
    await resilientClick(allFiltersBtn, "All filters");
    await sleep(700);
    const switchInput = getBySelectorList([
      "input[role='switch'][aria-label*='Easy Apply']",
      "input[role='switch'][id*='easy-apply']"
    ]);
    if (switchInput) {
      const checked = switchInput.getAttribute("aria-checked") === "true" || switchInput.checked;
      if (!checked) {
        await resilientClick(switchInput, "Easy Apply switch");
        await logLine("Easy Apply filter enabled (all filters)");
        await botChat("Easy Apply filter activated. Focusing on quick applications...");
      }
      const showResults = getBySelectorList([
        "button[aria-label*='Apply current filters']",
        "button[aria-label*='Show']",
        "button[data-control-name*='all_filters_apply']"
      ]);
      if (showResults) {
        await resilientClick(showResults, "Show results");
      } else {
        const dismiss = getBySelectorList(["button[aria-label='Dismiss']", "button[aria-label*='Close']"]);
        if (dismiss) await resilientClick(dismiss, "Close filters");
      }
      await sleep(700);
      return;
    }
    if (urlHasEasyApplyParam) {
      await debugLog(settings, "Easy Apply switch not found in filters modal, but URL already has f_AL=true", { url: window.location.href });
    } else {
      await logLine("Easy Apply filter button not found", "warn");
      await debugLog(settings, "Easy Apply filter selectors failed", { url: window.location.href });
    }
    return;
  }
  const active = easyBtn.getAttribute("aria-pressed") === "true" || /active|selected/i.test(easyBtn.className);
  if (active) {
    await logLine("Easy Apply filter already active");
    return;
  }
  await resilientClick(easyBtn, "Easy Apply filter");
  await logLine("Easy Apply filter enabled");
  await sleep(900);
}

function hasAdvancedFiltersConfigured(settings) {
  return (
    Boolean(String(settings.salary || "").trim()) ||
    parseListSetting(settings.experienceLevel).length > 0 ||
    parseListSetting(settings.jobType).length > 0 ||
    parseListSetting(settings.companies).length > 0 ||
    parseListSetting(settings.filterLocations).length > 0 ||
    parseListSetting(settings.industry).length > 0 ||
    parseListSetting(settings.jobFunction).length > 0 ||
    parseListSetting(settings.jobTitles).length > 0 ||
    parseListSetting(settings.benefits).length > 0 ||
    parseListSetting(settings.commitments).length > 0 ||
    Boolean(settings.under10Applicants) ||
    Boolean(settings.inYourNetwork) ||
    Boolean(settings.fairChanceEmployer)
  );
}

function getAdvancedFilterSignature(settings) {
  return JSON.stringify({
    salary: String(settings?.salary || "").trim(),
    experienceLevel: parseListSetting(settings?.experienceLevel),
    jobType: parseListSetting(settings?.jobType),
    companies: parseListSetting(settings?.companies),
    filterLocations: parseListSetting(settings?.filterLocations),
    industry: parseListSetting(settings?.industry),
    jobFunction: parseListSetting(settings?.jobFunction),
    jobTitles: parseListSetting(settings?.jobTitles),
    benefits: parseListSetting(settings?.benefits),
    commitments: parseListSetting(settings?.commitments),
    under10Applicants: Boolean(settings?.under10Applicants),
    inYourNetwork: Boolean(settings?.inYourNetwork),
    fairChanceEmployer: Boolean(settings?.fairChanceEmployer),
  });
}

function hasAppliedAdvancedFiltersForCurrentRun(settings) {
  try {
    const raw = String(sessionStorage.getItem(ADVANCED_FILTERS_APPLIED_KEY) || "").trim();
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return (
      parsed &&
      parsed.runId &&
      parsed.runId === String(lastRunStartedAt || "") &&
      parsed.signature === getAdvancedFilterSignature(settings)
    );
  } catch {
    return false;
  }
}

function markAdvancedFiltersAppliedForCurrentRun(settings) {
  try {
    sessionStorage.setItem(
      ADVANCED_FILTERS_APPLIED_KEY,
      JSON.stringify({
        runId: String(lastRunStartedAt || ""),
        signature: getAdvancedFilterSignature(settings)
      })
    );
  } catch {
    // ignore storage failures
  }
}

function optionTextMatches(candidate, target) {
  const c = normalizeLabel(candidate);
  const t = normalizeLabel(target);
  if (!c || !t) return false;
  if (c === t) return true;
  if (c.startsWith(`${t} `)) return true;
  if (c.endsWith(` ${t}`)) return true;
  if (c.includes(` ${t} `)) return true;
  return false;
}

function isVisibleElement(el) {
  if (!(el instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findVisibleControlByText(root, text) {
  const labels = Array.from(root.querySelectorAll("label"));
  for (const label of labels) {
    if (!isVisibleElement(label)) continue;
    if (optionTextMatches(label.textContent || "", text)) return label;
  }

  const controls = Array.from(root.querySelectorAll("button, [role='button'], span"));
  for (const control of controls) {
    if (!isVisibleElement(control)) continue;
    if (optionTextMatches(control.textContent || "", text)) return control;
  }
  return null;
}

function findFiltersModal() {
  return getBySelectorList([
    ".artdeco-modal[role='dialog']",
    ".search-reusables__all-filters-modal",
    ".jobs-search-box__all-filters"
  ]);
}

async function waitForFiltersModalOpen(timeoutMs = 3500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const modal = findFiltersModal();
    if (modal) return modal;
    await sleep(120);
  }
  return null;
}

function findFilterApplyButton(modal) {
  return getBySelectorList([
    "button[aria-label*='Apply current filters']",
    "button[aria-label*='Show']",
    "button[data-control-name*='all_filters_apply']"
  ], modal);
}

async function setSwitchFilterByLabel(modal, labelText, enabled, settings) {
  const label = findVisibleControlByText(modal, labelText);
  if (!label) {
    await debugLog(settings, "Boolean filter label not found", { labelText });
    return false;
  }
  const container = label.closest("fieldset, section, li, div") || modal;
  const input = container.querySelector("input[role='switch'], input[type='checkbox']");
  if (!input) {
    await debugLog(settings, "Boolean filter switch not found", { labelText });
    return false;
  }
  const checked = input.getAttribute("aria-checked") === "true" || input.checked;
  if (checked === Boolean(enabled)) return true;
  const control = input.closest("label") || label;
  await resilientClick(control, `${labelText} filter switch`);
  await sleep(120);
  return true;
}

function findAutocompleteInputByHint(modal, hint) {
  const targetHint = normalizeLabel(hint);
  const inputs = Array.from(modal.querySelectorAll("input[placeholder], input[aria-label]"));
  return (
    inputs.find((input) => {
      const label = `${input.getAttribute("placeholder") || ""} ${input.getAttribute("aria-label") || ""}`;
      return normalizeLabel(label).includes(targetHint);
    }) || null
  );
}

async function addAutocompleteFilterValues(modal, hint, values, settings) {
  const cleaned = parseListSetting(values);
  if (!cleaned.length) return;
  for (const value of cleaned) {
    const input = findAutocompleteInputByHint(modal, hint);
    if (!input) {
      await debugLog(settings, "Autocomplete filter input not found", { hint, value });
      return;
    }
    input.focus();
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await sleep(180);
  }
}

async function applyAdvancedFiltersIfNeeded(settings) {
  if (!hasAdvancedFiltersConfigured(settings)) return;
  if (hasAppliedAdvancedFiltersForCurrentRun(settings)) {
    await debugLog(settings, "Advanced filters already applied for this run/settings signature", {
      runId: String(lastRunStartedAt || ""),
    });
    return;
  }
  const allFiltersBtn = getBySelectorList([
    "button[aria-label*='All filters']",
    "button[aria-label='All filters']",
    "button.search-reusables__all-filters-pill-button"
  ]);
  if (!allFiltersBtn) {
    await logLine("All filters button not found (advanced filters skipped)", "warn");
    await debugLog(settings, "All filters button missing", { url: window.location.href });
    return;
  }

  await resilientClick(allFiltersBtn, "All filters");
  const modal = await waitForFiltersModalOpen();
  if (!modal) {
    await logLine("Advanced filters modal did not open", "warn");
    return;
  }

  const optionTextValues = [
    ...parseListSetting(settings.experienceLevel),
    ...parseListSetting(settings.jobType),
    ...parseListSetting(settings.industry),
    ...parseListSetting(settings.jobFunction),
    ...parseListSetting(settings.jobTitles),
    ...parseListSetting(settings.benefits),
    ...parseListSetting(settings.commitments)
  ];
  const salary = String(settings.salary || "").trim();
  if (salary) optionTextValues.push(salary);

  for (const value of optionTextValues) {
    const control = findVisibleControlByText(modal, value);
    if (control) {
      await resilientClick(control, `filter option "${value}"`);
      await sleep(100);
    } else {
      await debugLog(settings, "Advanced filter option not found", { value });
    }
  }

  await addAutocompleteFilterValues(modal, "company", settings.companies, settings);
  await addAutocompleteFilterValues(modal, "location", settings.filterLocations, settings);

  await setSwitchFilterByLabel(modal, "Under 10 applicants", settings.under10Applicants, settings);
  await setSwitchFilterByLabel(modal, "In your network", settings.inYourNetwork, settings);
  await setSwitchFilterByLabel(modal, "Fair Chance Employer", settings.fairChanceEmployer, settings);

  const showResults = findFilterApplyButton(modal);
  if (showResults) {
    await resilientClick(showResults, "Apply current filters");
    await sleep(800);
    markAdvancedFiltersAppliedForCurrentRun(settings);
    return;
  }

  const dismiss = getBySelectorList(["button[aria-label='Dismiss']", "button[aria-label*='Close']"], modal);
  if (dismiss) {
    await resilientClick(dismiss, "Close filters");
  }
  markAdvancedFiltersAppliedForCurrentRun(settings);
}

async function prepareRun(settings) {
  await botChat("Preparing search filters and preferences...");
  await sleep(300);
  if (hasDailyEasyApplyLimitSignal()) {
    await pauseRunForDailyEasyApplyLimit(settings, "LinkedIn daily submission limit reached before run preparation");
    return false;
  }
  if (isPostApplySearchPage()) {
    const cleanUrl = getResumableSearchUrl(settings);
    window.history.replaceState(null, "", cleanUrl);
    const hasCardsInDom = document.querySelectorAll(".job-card-container, [data-occludable-job-id], li.jobs-search-results__list-item").length > 0;
    if (hasCardsInDom) {
      preparedRun = true;
      return true;
    }
    await logLine("Returning to Jobs Search results.", "info");
    resetRemoteLocationKeywordCursor();
    window.location.href = cleanUrl;
    return false;
  }
  if (!isJobsPage()) {
    await logLine("Not on Jobs page. Redirecting to LinkedIn Jobs Search.", "warn");
    await debugLog(settings, "Redirecting to jobs search (not jobs path)", { url: window.location.href });
    captureDebugEvent("search", "NAVIGATE_TO_SEARCH", { reason: "not-jobs-page", currentUrl: window.location.href });
    resetRemoteLocationKeywordCursor();
    window.location.href = getActiveRunSearchUrl(settings);
    return false;
  }
  if (!isJobsSearchPage()) {
    await logLine("Opening LinkedIn Jobs Search results page.", "info");
    await debugLog(settings, "Redirecting to jobs search", { url: window.location.href });
    captureDebugEvent("search", "NAVIGATE_TO_SEARCH", { reason: "not-search-page", currentUrl: window.location.href });
    resetRemoteLocationKeywordCursor();
    window.location.href = getActiveRunSearchUrl(settings);
    return false;
  }
  await debugLog(settings, "Preparing run", { url: window.location.href });
  const keywordReady = await ensureSearchTermIfNeeded(settings);
  if (!keywordReady) return false;
  const queryReady = await ensureSearchQueryParams(settings);
  if (!queryReady) return false;
  await setSearchLocationIfNeeded(settings);
  await applyAdvancedFiltersIfNeeded(settings);
  await applyEasyApplyFilterIfNeeded(settings);
  preparedRun = true;
  return true;
}

async function setLiveAutoSubmitEnabled(enabled, options = {}) {
  const patch = enabled
    ? { autoSubmit: true, dryRun: false, liveModeAcknowledged: true }
    : { autoSubmit: false, dryRun: true };
  const saved = await sendMessage({ type: "CP_SAVE_SETTINGS", settings: patch });
  if (!saved?.ok) {
    if (!options.silent) {
      await botChat(saved?.error || "Could not update run mode settings.", "error");
    }
    return false;
  }
  lastBootstrapSettings = {
    ...(lastBootstrapSettings || {}),
    ...(saved.settings || {}),
  };
  const boot = await getBootstrap();
  if (boot?.settings && typeof boot.settings === "object") {
    lastBootstrapSettings = boot.settings;
  }
  if (boot?.state) {
    renderState(boot.state);
  }
  if (!options.silent) {
    await botChat(
      enabled
        ? "Live auto-submit enabled. Start will submit applications."
        : "Live auto-submit disabled. Dry-run is now enabled.",
      enabled ? "warn" : "info",
    );
  }
  return true;
}

async function handleChatCommand(input) {
  const raw = String(input || "").trim();
  if (!raw) return;
  await userChat(raw);
  const cmd = normalizeLabel(raw);

  if (cmd === "ack live" || cmd === "i acknowledge" || cmd === "acknowledge") {
    const modeSaved = await setLiveAutoSubmitEnabled(true, { silent: true });
    if (!modeSaved) return;
    const startRes = await sendMessage({ type: "CP_START", forceRestart: false });
    if (!startRes?.ok) {
      await botChat(startRes?.error || "Could not start auto-submit run.", "error");
      return;
    }
    await botChat("Acknowledged. Auto-submit is ON.", "warn");
    return;
  }

  if (cmd === "start live" || cmd === "live start" || cmd === "/live") {
    const modeSaved = await setLiveAutoSubmitEnabled(true, { silent: true });
    if (!modeSaved) return;
    const startRes = await sendMessage({ type: "CP_START", forceRestart: false });
    if (!startRes?.ok) {
      await botChat(startRes?.error || "Auto-submit run start failed.", "error");
      return;
    }
    await botChat("Auto-submit run started. Auto-submit is ON.", "warn");
    return;
  }

  if (cmd === "start" || cmd === "/start" || cmd.includes("start applying")) {
    const boot = await getBootstrap();
    if (boot?.settings?.dryRun) {
      await botChat("Dry-run is ON: I will not click Submit. Use: start live", "warn");
    } else if (!boot?.settings?.autoSubmit) {
      await botChat("Auto-submit is OFF. I will fill forms, but submit may need manual click.", "warn");
    }
    const startRes = await sendMessage({ type: "CP_START", forceRestart: false });
    if (!startRes?.ok) {
      await botChat(startRes?.error || "Run start failed. Check settings.", "error");
      return;
    }
    await botChat("Run started. AI Copilot is now scanning for jobs...");
    return;
  }
  if (cmd === "restart" || cmd === "/restart") {
    const startRes = await sendMessage({ type: "CP_START", forceRestart: true });
    if (!startRes?.ok) {
      await botChat(startRes?.error || "Run restart failed.", "error");
      return;
    }
    await botChat("Run restarted. AI Copilot is resuming the scan...", "warn");
    return;
  }
  if (cmd === "restart live" || cmd === "/restart-live") {
    const modeSaved = await setLiveAutoSubmitEnabled(true, { silent: true });
    if (!modeSaved) return;
    const startRes = await sendMessage({ type: "CP_START", forceRestart: true });
    if (!startRes?.ok) {
      await botChat(startRes?.error || "Live run restart failed.", "error");
      return;
    }
    await botChat("Live run restarted. Auto-submit is ON.", "warn");
    return;
  }
  if (cmd === "pause" || cmd === "/pause") {
    await sendMessage({ type: "CP_PAUSE" });
    await botChat("Run paused. AI Copilot is standing by...");
    return;
  }
  if (cmd === "resume" || cmd === "/resume") {
    await sendMessage({ type: "CP_RESUME" });
    await botChat("Run resumed. AI Copilot is back to work...");
    return;
  }
  if (cmd === "stop" || cmd === "/stop") {
    await sendMessage({ type: "CP_STOP" });
    await botChat("Run stopped. AI Copilot is offline.");
    return;
  }
  if (cmd.startsWith("set city ")) {
    const city = raw.slice(9).trim();
    if (!city) {
      await botChat("City value is empty. Use: set city New York", "warn");
      return;
    }
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { currentCity: city } });
    await botChat(`Saved current city as ${city}. (This affects form questions like "current location", not the LinkedIn search location box.)`);
    return;
  }
  if (cmd.startsWith("set search location ")) {
    const location = raw.slice("set search location ".length).trim();
    if (!location) {
      await botChat("Search location value is empty. Use: set search location Ireland", "warn");
      return;
    }
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { searchLocation: location } });
    await botChat(`Saved search location as ${location}.`);
    return;
  }
  if (cmd === "clear city" || cmd === "reset city") {
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { currentCity: "" } });
    await botChat("Cleared current city. (Search location box is unchanged.)", "info");
    return;
  }
  if (cmd === "clear search location" || cmd === "reset search location") {
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { searchLocation: "" } });
    await botChat("Cleared search location. LinkedIn search will no longer be forced to a specific location.", "info");
    const boot = await getBootstrap();
    await clearLinkedInSearchLocationInput(boot?.settings || {});
    return;
  }
  if (cmd === "clear locations" || cmd === "reset locations") {
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { searchLocation: "", filterLocations: [] } });
    await botChat("Cleared preferred locations (filterLocations) + search location. Runs will rely on LinkedIn UI filters.", "info");
    return;
  }
  if (cmd.startsWith("set pace ")) {
    const rawValue = raw.slice(9).trim();
    const parts = rawValue.split(/\s+/).filter(Boolean);
    const minSec = clampNumber(parts[0], NaN, 5, 900);
    const maxSec = parts.length > 1 ? clampNumber(parts[1], minSec, 5, 900) : minSec;
    if (!Number.isFinite(minSec) || !Number.isFinite(maxSec)) {
      await botChat("Invalid pace. Use: set pace 60 90 (seconds between submits)", "warn");
      return;
    }
    const min = Math.min(minSec, maxSec);
    const max = Math.max(minSec, maxSec);
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { submitRateMinSec: min, submitRateMaxSec: max } });
    await botChat(`Saved rate limit to ${min}${min === max ? "" : `-${max}`} seconds between submits.`, "info");
    return;
  }
  if (cmd.startsWith("set years ")) {
    const rawValue = raw.slice(10).trim();
    const n = clampNumber(rawValue, NaN, 0, 60);
    if (!Number.isFinite(n)) {
      await botChat("Invalid years value. Use: set years 3", "warn");
      return;
    }
    const asText = String(Math.round(n));
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { currentExperience: Number(asText), yearsOfExperienceAnswer: asText } });
    await botChat(`Saved Years of Experience to ${asText}.`, "info");
    return;
  }
  if (cmd.startsWith("set phone ")) {
    const phone = raw.slice(10).trim();
    if (!phone) {
      await botChat("Phone value is empty. Use: set phone 9876543210", "warn");
      return;
    }
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { phoneNumber: phone } });
    await botChat("Saved phone number.");
    return;
  }
  if (cmd.startsWith("set email ")) {
    const email = raw.slice(10).trim();
    if (!email) {
      await botChat("Email value is empty. Use: set email you@example.com", "warn");
      return;
    }
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { contactEmail: email } });
    await botChat("Saved contact email.");
    return;
  }
  if (cmd === "dry run on") {
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { dryRun: true, autoSubmit: false } });
    await botChat("Dry run enabled.");
    return;
  }
  if (cmd === "dry run off" || cmd === "manual mode" || cmd === "manual submit") {
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { dryRun: false, autoSubmit: false } });
    await botChat("Dry run disabled. Auto-submit is OFF (manual submit).");
    return;
  }
  if (cmd === "auto submit on" || cmd === "autosubmit on") {
    const enabled = await setLiveAutoSubmitEnabled(true, { silent: true });
    if (!enabled) return;
    await botChat("Auto-submit ON.", "warn");
    return;
  }
  if (cmd === "auto submit off" || cmd === "autosubmit off") {
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { autoSubmit: false, dryRun: true } });
    await botChat("Auto-submit OFF. Dry-run enabled.");
    return;
  }
  if (cmd === "export logs") {
    const res = await sendMessage({ type: "CP_GET_LOG_EXPORT" });
    if (res?.ok && res.logsJson) {
      try {
        await navigator.clipboard.writeText(res.logsJson);
        await botChat("Logs copied to clipboard.");
      } catch {
        await botChat("Could not copy logs.", "warn");
      }
      return;
    }
  }
  if (cmd === "download debug log" || cmd === "debug log" || cmd === "save debug log") {
    downloadDebugLogFile();
    return;
  }
  await botChat(
    "Unknown command. Try: start, start live, restart, restart live, pause, resume, stop, set city <name>, clear city, clear locations, set pace <minSec> <maxSec>, set years <n>, set phone <num>, set email <mail>, dry run on/off, download debug log",
    "warn"
  );
}

function ensurePanelConnected() {
  if (!panelEl) {
    panelEl = document.getElementById(PANEL_ID);
  }
  if (panelEl && !panelEl.isConnected) {
    panelEl = document.getElementById(PANEL_ID);
  }
  return panelEl;
}

function ensurePanel() {
  const existing = document.getElementById(PANEL_ID);
  if (existing) {
    existing.classList.remove("cp-hidden");
    panelEl = existing;
    if (!panelEl.querySelector("#cp-log")?.children?.length) {
      lastLogRenderSignature = "";
    }
    panelEl.classList.toggle("cp-debug-ui", debugUiEnabled);
    applyPanelLayout();
    logPanelDebug("ensure-existing");
    return;
  }
  loadPanelPrefs();
  // Debug UI should be off by default; allow opt-in via URL (?cpDebug=1) or localStorage (cpDebugUi=1).
  setDebugUiEnabled(wantsDebugUiFromUrl() || wantsDebugUiFromLocalStorage());
  ensureDebugBadge();

  const toggle = document.createElement("button");
  toggle.id = TOGGLE_ID;
  toggle.textContent = "";
  toggle.title = "AutoApply CV Copilot";
  toggle.setAttribute("aria-label", "AutoApply CV Copilot");
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
  toggle.addEventListener("click", () => {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    // Keep panel always visible; toggle now acts as "bring to front/show".
    panel.classList.remove("cp-hidden");
    panel.style.zIndex = "2147483646";
  });
  (document.body || document.documentElement).appendChild(toggle);

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="cp-head">
      <div class="cp-brand">
        <div class="cp-orb"><img class="cp-orb-img" alt="" /></div>
        <div>
          <div class="cp-title">AutoApply CV <span class="cp-ai-sparkle">${ICONS.sparkle}</span></div>
          <div class="cp-sub">AI Application Assistant</div>
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
    <div class="cp-hero" id="cp-now-card">
      <div class="cp-hero-header">
        <div class="cp-hero-status-pulse"></div>
        <span class="cp-hero-status-title" id="cp-now-title">AI Copilot Ready</span>
      </div>
      <div class="cp-hero-job-title" id="cp-now-job-title">Standing by for next task</div>
      <div class="cp-hero-job-sub" id="cp-now-detail">Press Start or toggle Live Auto Submit</div>
      <div class="cp-hero-metrics">
        <div class="cp-metric-pill" id="cp-applied-pill">
          <span class="cp-svg-icon cp-icon-success">${ICONS.rocket}</span>
          <span class="cp-metric-val" id="cp-applied-count">0</span> applied
        </div>
        <div class="cp-metric-pill" id="cp-skipped-pill">
          <span class="cp-svg-icon cp-icon-warning">${ICONS.skip}</span>
          <span class="cp-metric-val" id="cp-skipped-count">0</span> skipped
        </div>
        <div class="cp-metric-pill cp-metric-quota" id="cp-wallet">
          <span class="cp-svg-icon cp-icon-primary">${ICONS.coin}</span>
          <span id="cp-wallet-text">Free Quota</span>
        </div>
      </div>
    </div>
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
    <div class="cp-tab-bar">
      <button id="cp-tab-feed" class="cp-tab cp-active">${ICONS.sparkle} <span>Activity</span></button>
      <button id="cp-tab-debug" class="cp-tab">${ICONS.activity} <span>Decision Chain</span></button>
      <button id="cp-tab-logs" class="cp-tab">${ICONS.list} <span>Logs</span></button>
    </div>
    <div class="cp-log" id="cp-log" aria-live="polite"></div>
    <div class="cp-composer">
      <input id="cp-chat-input" type="text" placeholder="Type a command (e.g. pause, start, resume)..." />
      <button id="cp-chat-send">Send</button>
    </div>
  `;
  (document.body || document.documentElement).appendChild(panel);
  panelEl = panel;
  lastLogRenderSignature = "";
  panelEl.classList.remove("cp-hidden");

  try {
    const orbImg = panel.querySelector(".cp-orb-img");
    if (orbImg) orbImg.src = chrome.runtime.getURL("icons/icon48.png");
  } catch {
    // ignore
  }

  panel.querySelector("#cp-start").addEventListener("click", async () => handleChatCommand("start"));
  panel.querySelector("#cp-pause").addEventListener("click", async () => handleChatCommand("pause"));
  panel.querySelector("#cp-stop").addEventListener("click", async () => handleChatCommand("stop"));

  const tabFeedBtn = panel.querySelector("#cp-tab-feed");
  const tabDebugBtn = panel.querySelector("#cp-tab-debug");
  const tabLogsBtn = panel.querySelector("#cp-tab-logs");
  const setTab = (tab) => {
    panelActiveTab = tab;
    tabFeedBtn?.classList.toggle("cp-active", tab === "feed");
    tabDebugBtn?.classList.toggle("cp-active", tab === "debug");
    tabLogsBtn?.classList.toggle("cp-active", tab === "logs");
    lastLogRenderSignature = "";
    void getBootstrap().then((b) => renderState(b.state));
  };
  tabFeedBtn?.addEventListener("click", () => setTab("feed"));
  tabDebugBtn?.addEventListener("click", () => setTab("debug"));
  tabLogsBtn?.addEventListener("click", () => setTab("logs"));

  panel.querySelector("#cp-clear-logs")?.addEventListener("click", async () => {
    const res = await sendMessage({ type: "CP_CLEAR_LOGS" });
    if (res?.ok) {
      runStats = { applied: 0, skipped: 0, failed: 0 };
      lastLogRenderSignature = "";
      renderState(res.state || { applied: 0, skipped: 0, failed: 0, logs: [] });
      await botChat("Logs and run counters cleared.");
    }
  });

  const logEl = panel.querySelector("#cp-log");
  if (logEl) {
    logAutoScrollPinnedToBottom = true;
    logEl.addEventListener(
      "scroll",
      () => {
        logAutoScrollPinnedToBottom = isLogNearBottom(logEl);
      },
      { passive: true }
    );
  }
  const liveModeToggle = panel.querySelector("#cp-auto-submit-toggle");
  liveModeToggle.addEventListener("change", async () => {
    const enableLive = Boolean(liveModeToggle?.checked);
    const ok = await setLiveAutoSubmitEnabled(enableLive, { silent: false });
    if (!ok && liveModeToggle) {
      liveModeToggle.checked = Boolean(lastBootstrapSettings?.autoSubmit && !lastBootstrapSettings?.dryRun);
    }
  });
  // Copy logs without surfacing debug UI controls in the panel.
  panel.querySelector(".cp-head-right").insertAdjacentHTML(
    "beforeend",
    `<button id="cp-copy-logs-mini" class="cp-icon-btn" title="Copy logs">\u29c9</button>
     <button id="cp-download-debug" class="cp-icon-btn" title="Download detailed debug log">\u2b07</button>`
  );
  panel.querySelector("#cp-copy-logs-mini").addEventListener("click", async () => {
    const res = await sendMessage({ type: "CP_GET_LOG_EXPORT" });
    if (!res?.ok || !res.logsJson) {
      await botChat("Failed to export logs.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(res.logsJson);
      await botChat("Logs copied to clipboard.");
    } catch {
      await botChat("Clipboard write failed.", "warn");
    }
  });
  panel.querySelector("#cp-download-debug").addEventListener("click", () => {
    downloadDebugLogFile();
  });
  panel.querySelector("#cp-minimize").addEventListener("click", () => {
    setPanelMinimized(!panelPrefs.minimized);
  });
  panel.querySelector("#cp-maximize").addEventListener("click", () => {
    setPanelMaximized(!panelPrefs.maximized);
  });
  const chatInput = panel.querySelector("#cp-chat-input");
  const sendBtn = panel.querySelector("#cp-chat-send");
  sendBtn.addEventListener("click", async () => {
    const text = chatInput.value;
    chatInput.value = "";
    await handleChatCommand(text);
  });
  chatInput.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const text = chatInput.value;
    chatInput.value = "";
    await handleChatCommand(text);
  });
  applyPanelLayout();
  enablePanelDragging();
  logPanelDebug("ensure-new");
}

function trimLogPrefix(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  if (text.startsWith("You:")) return text.slice(4).trim();
  if (text.startsWith("Copilot:")) return text.slice(8).trim();
  if (text.startsWith("[debug]")) return text.slice(7).trim();
  return text;
}

function summarizeMeta(meta) {
  if (!meta || typeof meta !== "object") return "";
  const parts = [];
  const add = (label, value) => {
    const text = String(value ?? "").trim();
    if (!text) return;
    parts.push(`${label}: ${text}`);
  };
  add("reason", meta.reasonCode);
  add("step", meta.stepAttempt);
  add("validation", meta.validation);
  add("pending", meta.unresolvedRequired);
  add("cards", meta.cards);
  add("url", meta.url);
  if (Array.isArray(meta.unresolvedFields) && meta.unresolvedFields.length) {
    add("fields", meta.unresolvedFields.slice(0, 2).join(" | "));
  }
  if (parts.length) return parts.join(" | ");
  try {
    const raw = JSON.stringify(meta);
    return raw.length > 220 ? `${raw.slice(0, 219)}...` : raw;
  } catch {
    return "";
  }
}

function isUserFacingAiLog(entry) {
  const msg = String(entry?.message || "").trim();
  const norm = normalizeLabel(msg);
  // Hide internal billing/dashboard syncs and json telemetry
  if (norm.includes("synced") && norm.includes("update(s) to dashboard")) return false;
  if (msg.startsWith("{") && msg.endsWith("}")) return false;
  if (norm.includes("automation engine initialized")) return false;
  if (norm.includes("disabled follow-company")) return false;
  if (msg.startsWith("[debug]")) return false;
  // Hide raw selector counts that are immediately followed by botChat
  if (/^found \d+ job cards$/i.test(msg)) return false;
  return true;
}

function formatAiFeedCard(entry) {
  const rawMsg = trimLogPrefix(entry?.message || "");
  const norm = normalizeLabel(rawMsg);
  const time = String(entry?.ts?.slice(11, 19) || "");
  const level = String(entry?.level || "info").toLowerCase();

  let icon = ICONS.sparkle;
  let cardClass = "";
  let formattedHtml = escapeHtml(rawMsg);

  if (norm.startsWith("opening:") || norm.startsWith("targeting")) {
    icon = ICONS.target;
    const title = cleanJobTitle(rawMsg.replace(/^opening:\s*/i, "").replace(/^targeting\s*/i, ""));
    formattedHtml = `Targeting <strong>${escapeHtml(title)}</strong>`;
  } else if (norm.startsWith("reading job details for") || norm.startsWith("analyzing requirements")) {
    icon = ICONS.search;
    const title = cleanJobTitle(rawMsg.replace(/^reading job details for\s*"?/i, "").replace(/"?\.\.\.$/, ""));
    formattedHtml = `Analyzing requirements for <strong>${escapeHtml(title)}</strong>`;
  } else if (norm.includes("application submitted successfully") || norm.includes("application submitted")) {
    icon = ICONS.check;
    cardClass = "cp-submitted";
    formattedHtml = `<strong>Application Submitted Successfully!</strong>`;
  } else if (norm.startsWith("selected resume option:") || norm.includes("attached resume")) {
    icon = ICONS.file;
    const resumeName = rawMsg.replace(/^selected resume option:\s*/i, "").replace(/^select resume\s*/i, "");
    formattedHtml = `Attached Resume: <strong>${escapeHtml(resumeName)}</strong>`;
  } else if (norm.startsWith("answered:")) {
    icon = ICONS.edit;
    const parts = rawMsg.replace(/^answered:\s*/i, "").split("->");
    const question = (parts[0] || "").trim();
    const answer = (parts[1] || "").trim();
    formattedHtml = `Auto-answered: <em>${escapeHtml(question)}</em> ➔ <strong>${escapeHtml(answer)}</strong>`;
  } else if (norm.includes("skipped")) {
    icon = ICONS.skip;
    cardClass = "cp-skipped";
    formattedHtml = `Skipped: <strong>${escapeHtml(rawMsg.replace(/^skipped:?\s*/i, ""))}</strong>`;
  } else if (norm.includes("rate limit") || norm.includes("waiting")) {
    icon = ICONS.clock;
    formattedHtml = `Pacing Protection: <strong>${escapeHtml(rawMsg.replace(/^rate limit:?\s*/i, ""))}</strong>`;
  } else if (norm.includes("easy apply filter")) {
    icon = ICONS.bolt;
    formattedHtml = `Easy Apply filter activated`;
  } else if (level === "error") {
    icon = ICONS.alert;
    cardClass = "cp-error";
  } else if (level === "warn") {
    icon = ICONS.alert;
  }

  return `<div class="cp-ai-card ${cardClass}"><span class="cp-ai-icon">${icon}</span><span class="cp-ai-text">${formattedHtml}</span><span class="cp-ai-time">${escapeHtml(time)}</span></div>`;
}

function formatDecisionChainCard(entry) {
  const rawMsg = trimLogPrefix(entry?.message || "");
  const norm = normalizeLabel(rawMsg);
  const time = String(entry?.ts?.slice(11, 19) || "");
  const meta = entry?.meta && typeof entry.meta === "object" ? entry.meta : {};
  const reasonCode = String(meta?.reasonCode || "").toUpperCase();

  let chainClass = "cp-diag-info";
  let badge = "DECISION";
  let icon = ICONS.activity;

  if (norm.includes("application submitted") || norm.includes("submitted successfully")) {
    chainClass = "cp-diag-success";
    badge = "SUBMITTED";
    icon = ICONS.check;
  } else if (norm.includes("mismatch") || norm.includes("does not match")) {
    chainClass = "cp-diag-warn";
    badge = "KEYWORD FILTER";
    icon = ICONS.search;
  } else if (norm.includes("already applied") || reasonCode === "APPLIED_CACHE_HIT") {
    chainClass = "cp-diag-muted";
    badge = "DUPLICATE GUARD";
    icon = ICONS.check;
  } else if (norm.includes("experience") || reasonCode === "EXPERIENCE_TOO_HIGH") {
    chainClass = "cp-diag-warn";
    badge = "EXPERIENCE RULE";
    icon = ICONS.target;
  } else if (norm.includes("modal") || norm.includes("easy apply")) {
    chainClass = "cp-diag-warn";
    badge = "APPLY FLOW";
    icon = ICONS.bolt;
  } else if (entry?.level === "error") {
    chainClass = "cp-diag-error";
    badge = "ERROR";
    icon = ICONS.alert;
  }

  const metaHtml = reasonCode ? `<span class="cp-diag-code">${escapeHtml(reasonCode)}</span>` : "";

  return `<div class="cp-diag-card ${chainClass}"><div class="cp-diag-head"><span class="cp-diag-badge">${badge}</span>${metaHtml}<span class="cp-diag-time">${escapeHtml(time)}</span></div><div class="cp-diag-body"><span class="cp-diag-icon">${icon}</span><span class="cp-diag-msg">${escapeHtml(rawMsg)}</span></div></div>`;
}

const AI_KIND_KEYWORDS = [
  "analyzing", "reviewing", "processing", "evaluating", "preparing",
  "checking", "scanning", "optimizing", "verifying", "reading",
  "thinking", "examining", "inspecting", "studying", "assessing"
];

function getLogVisual(entry) {
  const level = String(entry?.level || "info").toLowerCase();
  const raw = String(entry?.message || "");
  const isUser = level === "user" || raw.startsWith("You:");
  const isDebug = raw.startsWith("[debug]");
  const isBotChat = raw.startsWith("Copilot:");
  const role = isUser ? "cp-user" : "cp-bot";
  const sender = isUser ? "You" : "Copilot";

  let kind;
  if (level === "error") {
    kind = "Error";
  } else if (level === "warn") {
    kind = "Warning";
  } else if (isDebug) {
    kind = "Debug";
  } else if (isUser) {
    kind = "Command";
  } else if (isBotChat) {
    const norm = normalizeLabel(trimLogPrefix(raw));
    const matched = AI_KIND_KEYWORDS.some((kw) => norm.includes(kw));
    kind = matched ? "Thinking" : "Update";
  } else {
    kind = "Update";
  }

  return {
    level,
    role,
    sender,
    kind,
    isDebug,
    message: trimLogPrefix(raw)
  };
}

const AI_THINKING_TITLES = [
  "Analyzing job requirements...",
  "Reviewing application form...",
  "Processing your profile data...",
  "Evaluating best responses...",
  "Filling in application details...",
  "Checking form validation...",
  "Preparing smart answers...",
  "Scanning for required fields...",
  "Optimizing your application...",
  "Verifying submission readiness...",
];
const AI_IDLE_TITLES = [
  "Ready to apply. Standing by...",
  "AI Copilot online. Awaiting your command...",
  "Standing by for next task...",
  "Copilot initialized. Ready when you are...",
];

function pickAiTitle(pool, fallback) {
  if (!pool.length) return fallback;
  return pool[Math.floor(Math.random() * pool.length)];
}

function deriveNowCard(state, logs) {
  const entries = Array.isArray(logs) ? logs : [];
  const latestAny = entries.length ? entries[entries.length - 1] : null;
  const latestNonDebug = [...entries].reverse().find((entry) => !String(entry?.message || "").startsWith("[debug]")) || latestAny;
  const latestMessage = trimLogPrefix(latestNonDebug?.message || "");
  const norm = normalizeLabel(latestMessage);

  let title = "AI Copilot Ready";
  let jobTitle = "Standing by for next task";
  let detail = "Press Start or toggle Live Auto Submit";

  if (!isJobsSearchPage() && isJobsPage() && !isJobsViewPage()) {
    jobTitle = "LinkedIn Jobs Hub";
    detail = "Click Start to search matching jobs and begin auto-applying.";
  }

  if (state.paused) {
    title = "Paused";
    detail = "Awaiting your input or resume command.";
  } else if (state.running) {
    title = "AI Copilot Active";
    if (!isJobsSearchPage() && isJobsPage() && !isJobsViewPage()) {
      jobTitle = "Navigating to Job Search...";
      detail = "Opening search results with Easy Apply filters...";
    } else if (norm.includes("preparing run")) {
      jobTitle = "Setting up search filters...";
      detail = "Configuring keywords & Easy Apply";
    } else if (norm.includes("found") && norm.includes("job")) {
      jobTitle = "Scanning Matching Opportunities";
      detail = "Analyzing positions on current page";
    } else if (norm.includes("opening:") || norm.includes("reading job details")) {
      const cleanTitleText = cleanJobTitle(latestMessage.replace(/^opening:\s*/i, "").replace(/^reading job details for\s*"?/i, ""));
      jobTitle = cleanTitleText || "Opening Job Position";
      detail = "Reading requirements & matching qualifications";
    } else if (norm.includes("easy apply") || norm.includes("modal step") || norm.includes("filling")) {
      jobTitle = currentJobContext.title ? cleanJobTitle(currentJobContext.title) : "Filling Application";
      detail = "Smart-answering screening questions & attaching resume";
    } else if (norm.includes("application submitted")) {
      jobTitle = currentJobContext.title ? cleanJobTitle(currentJobContext.title) : "Application Submitted";
      detail = "Submitted successfully! Moving to next job.";
    } else if (norm.includes("rate limit") || norm.includes("waiting")) {
      jobTitle = "Pacing Protection Active";
      detail = latestMessage || "Resting safely between submissions";
    } else if (norm.includes("skipped")) {
      jobTitle = "Skipped Current Position";
      detail = latestMessage || "Scanning next opportunity";
    } else {
      jobTitle = currentJobContext.title ? cleanJobTitle(currentJobContext.title) : "Automating Application Process";
      detail = latestMessage || "Analyzing next action...";
    }
  }

  return { title, jobTitle, detail };
}

function isLogNearBottom(logEl, threshold = 36) {
  if (!logEl) return true;
  const maxScrollTop = Math.max(0, Number(logEl.scrollHeight || 0) - Number(logEl.clientHeight || 0));
  const current = Math.max(0, Number(logEl.scrollTop || 0));
  return maxScrollTop - current <= Math.max(0, Number(threshold || 0));
}

function buildLogRenderSignature(logs, state, settings, activeTab) {
  const list = Array.isArray(logs) ? logs.slice(-80) : [];
  const last = list.length ? list[list.length - 1] : null;
  return [
    activeTab || "feed",
    list.length,
    String(last?.ts || ""),
    String(last?.message || ""),
    String(last?.level || ""),
    Number(state?.running ? 1 : 0),
    Number(state?.paused ? 1 : 0),
    Number(state?.applied || 0),
    Number(state?.skipped || 0),
    Number(settings?.dryRun ? 1 : 0),
    Number(settings?.autoSubmit ? 1 : 0),
  ].join("|");
}

function renderState(state) {
  ensurePanelConnected();
  if (!panelEl) return;
  panelEl.classList.remove("cp-hidden");
  if (state.running && panelPrefs.minimized) {
    setPanelMinimized(false);
  }

  const s = lastBootstrapSettings || {};
  const modeLabel = s?.dryRun ? "Dry Run" : s?.autoSubmit ? "Auto Submit" : "Manual Submit";
  const liveAutoSubmitEnabled = Boolean(!s?.dryRun && s?.autoSubmit);
  const status = panelEl.querySelector("#cp-status-badge");
  const base = state.running ? "Running" : state.paused ? "Paused" : "Idle";
  status.textContent = `${base} \u00b7 ${modeLabel}`;
  status.className = `cp-badge ${state.running ? "cp-run" : state.paused ? "cp-pause" : ""}`;
  const modeToggle = panelEl.querySelector("#cp-auto-submit-toggle");
  if (modeToggle) {
    modeToggle.checked = liveAutoSubmitEnabled;
  }
  const modeChip = panelEl.querySelector("#cp-run-mode-chip");
  if (modeChip) {
    modeChip.textContent = liveAutoSubmitEnabled ? "Live" : s?.dryRun ? "Dry Run" : "Manual";
    modeChip.className = `cp-run-mode-chip ${liveAutoSubmitEnabled ? "cp-live" : s?.dryRun ? "cp-dry" : "cp-manual"}`;
  }

  // Update hero stats
  const appliedCountEl = panelEl.querySelector("#cp-applied-count");
  if (appliedCountEl) appliedCountEl.textContent = String(Number(state.applied || 0));
  const skippedCountEl = panelEl.querySelector("#cp-skipped-count");
  if (skippedCountEl) skippedCountEl.textContent = String(Number(state.skipped || 0));

  const walletTextEl = panelEl.querySelector("#cp-wallet-text");
  if (walletTextEl) {
    const q = lastPortalQuota || {};
    const hireBalance = Number(q.hireBalance ?? NaN);
    const quotaUsed = Number(q.quotaUsed ?? NaN);
    const quotaTotal = Number(q.quotaTotal ?? NaN);
    const spendable = Number(q.spendable ?? NaN);

    if (Number.isFinite(hireBalance) && hireBalance > 0) {
      walletTextEl.textContent = `${hireBalance} Hires (${Number.isFinite(quotaUsed) ? quotaUsed : 0}/${Number.isFinite(quotaTotal) ? quotaTotal : 3} Free)`;
    } else if (Number.isFinite(spendable) && spendable > 0) {
      walletTextEl.textContent = `${spendable} Hires`;
    } else if (Number.isFinite(quotaUsed) && Number.isFinite(quotaTotal)) {
      walletTextEl.textContent = `${Math.max(0, quotaUsed)}/${Math.max(0, quotaTotal)} Free Used`;
    } else {
      walletTextEl.textContent = "Quota Active";
    }
  }

  const logs = state.logs || [];
  const nowCard = deriveNowCard(state, logs);
  const nowTitle = panelEl.querySelector("#cp-now-title");
  const nowJobTitle = panelEl.querySelector("#cp-now-job-title");
  const nowDetail = panelEl.querySelector("#cp-now-detail");
  if (nowTitle) nowTitle.textContent = nowCard.title;
  if (nowJobTitle) nowJobTitle.textContent = nowCard.jobTitle;
  if (nowDetail) nowDetail.textContent = nowCard.detail;

  const logEl = panelEl.querySelector("#cp-log");
  const typingKind = s?.dryRun ? "Dry Run" : s?.autoSubmit ? "Auto" : "Manual";
  const AI_TYPING_MESSAGES = [
    "Analyzing next opportunity...",
    "Smart-filling application fields...",
    "Reviewing screening questions...",
    "Verifying application readiness...",
    "Selecting optimal responses...",
  ];
  const typingMsg = state.running
    ? AI_TYPING_MESSAGES[Math.floor(Date.now() / 3000) % AI_TYPING_MESSAGES.length]
    : "";
  const typingCard = state.running
    ? `<div class="cp-typing-card"><span class="cp-dot"></span><span class="cp-dot"></span><span class="cp-dot"></span> ${escapeHtml(typingMsg)}</div>`
    : "";

  const logsWindow = logs.slice(-80);
  const logSignature = buildLogRenderSignature(logsWindow, state, s, panelActiveTab);
  if (logSignature !== lastLogRenderSignature && logEl) {
    const previousDistanceFromBottom = Math.max(
      0,
      Number(logEl.scrollHeight || 0) - Number(logEl.clientHeight || 0) - Number(logEl.scrollTop || 0)
    );
    const wasNearBottom = isLogNearBottom(logEl);
    const shouldStickToBottom = logAutoScrollPinnedToBottom || wasNearBottom;

    if (panelActiveTab === "feed") {
      const feedItems = logsWindow.filter((l) => isUserFacingAiLog(l));
      if (!feedItems.length && !state.running) {
        logEl.innerHTML = `<div style="text-align:center;padding:28px 12px;color:#94a3b8;font-size:11.5px;display:flex;flex-direction:column;align-items:center;gap:8px;"><span style="color:#6366f1;">${ICONS.sparkle}</span><span>AI Copilot is standing by. Click <strong>Start</strong> to begin auto-applying.</span></div>`;
      } else {
        logEl.innerHTML = feedItems.map((l) => formatAiFeedCard(l)).join("") + typingCard;
      }
    } else if (panelActiveTab === "debug") {
      const diagItems = logsWindow.filter((l) => !String(l?.message || "").startsWith("{") && !String(l?.message || "").includes("automation engine"));
      if (!diagItems.length && !state.running) {
        logEl.innerHTML = `<div style="text-align:center;padding:28px 12px;color:#94a3b8;font-size:11.5px;display:flex;flex-direction:column;align-items:center;gap:8px;"><span style="color:#6366f1;">${ICONS.activity}</span><span>No decision chain entries yet. Start a run to trace decision checks in real time.</span></div>`;
      } else {
        logEl.innerHTML = diagItems.map((l) => formatDecisionChainCard(l)).join("") + typingCard;
      }
    } else {
      logEl.innerHTML =
        logsWindow
          .map((l) => {
            const visual = getLogVisual(l);
            const level = escapeHtml(visual.level || "info");
            const role = escapeHtml(visual.role || "cp-bot");
            const sender = escapeHtml(visual.sender || "Copilot");
            const kind = escapeHtml(visual.kind || "Update");
            const msg = escapeHtml(visual.message || "");
            const metaText = summarizeMeta(l?.meta);
            const metaHtml = metaText ? `<div class="cp-msg-meta">${escapeHtml(metaText)}</div>` : "";
            const debugClass = visual.isDebug ? " cp-debug" : "";
            return `<div class="cp-line ${role} cp-${level}${debugClass}"><div class="cp-bubble"><div class="cp-msg-head"><span class="cp-sender">${sender}</span><span class="cp-kind">${kind}</span><span class="cp-time">${escapeHtml(l.ts?.slice(11, 19) || "")}</span></div><div class="cp-msg-text">${msg}</div>${metaHtml}</div></div>`;
          })
          .join("") + typingCard;
    }

    lastLogRenderSignature = logSignature;

    if (shouldStickToBottom) {
      logEl.scrollTop = logEl.scrollHeight;
      logAutoScrollPinnedToBottom = true;
    } else {
      const nextTop = Math.max(
        0,
        Number(logEl.scrollHeight || 0) - Number(logEl.clientHeight || 0) - previousDistanceFromBottom
      );
      logEl.scrollTop = nextTop;
    }
  }
  logPanelDebug("render");
}

async function getBootstrap() {
  const boot = await sendMessage({ type: "CP_GET_BOOTSTRAP" });
  const normalized = boot.ok ? boot : { state: {}, settings: {} };
  lastBootstrapSettings = normalized?.settings || {};
  lastPortalQuota = normalized?.portalQuota?.data || null;
  setDebugUiEnabled(Boolean(normalized?.settings?.debugMode) || wantsDebugUiFromUrl() || wantsDebugUiFromLocalStorage());
  return normalized;
}

function getEasyApplyButton() {
  const candidates = Array.from(
    document.querySelectorAll(
      "button.jobs-apply-button, button[aria-label*='Easy Apply'], button[aria-label*='Apply']"
    )
  );
  for (const btn of candidates) {
    const label = normalizeLabel(btn.getAttribute("aria-label") || "");
    const text = normalizeLabel(btn.textContent || "");
    const combined = `${label} ${text}`;
    if (combined.includes("easy apply")) {
      return btn;
    }
  }
  return null;
}

function collectJobCards() {
  const directCards = getAllBySelectorList([
    ".job-card-container",
    "[data-occludable-job-id]",
    "li.jobs-search-results__list-item",
    ".jobs-search-results-list__list-item",
    "li.scaffold-layout__list-item"
  ]);
  if (directCards.length) return directCards;

  const anchors = Array.from(document.querySelectorAll("a[href*='/jobs/view/']"));
  const cardSet = new Set();
  for (const a of anchors) {
    const card = a.closest(
      "li.jobs-search-results__list-item, li.scaffold-layout__list-item, .jobs-search-results-list__list-item, .job-card-container, li, article, div"
    );
    if (card) cardSet.add(card);
  }
  return Array.from(cardSet);
}

function hasEasyApplySignalOnCard(card) {
  if (!card) return false;
  const quickText = normalizeLabel(card.textContent || "");
  if (quickText.includes("easy apply")) return true;

  const explicitSignal = getBySelectorList(
    [
      ".job-card-container__apply-method",
      ".job-card-list__apply-method",
      "[data-test-job-card-easy-apply]",
      "[aria-label*='Easy Apply']",
      "[aria-label*='easy apply']",
    ],
    card,
  );
  if (explicitSignal) return true;

  const buttonSignal = Array.from(card.querySelectorAll("button, a, span"))
    .slice(0, 40)
    .some((el) => normalizeLabel(`${el.getAttribute?.("aria-label") || ""} ${el.textContent || ""}`).includes("easy apply"));
  return buttonSignal;
}

function getCardAnchor(card) {
  return getBySelectorList(
    [
      "a[href*='/jobs/view/']",
      "a.job-card-container__link",
      "a.job-card-list__title--link",
      "a[data-control-name*='job_card']",
      "a"
    ],
    card
  );
}

async function waitForJobsToRender(settings, timeoutMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const cards = collectJobCards();
    if (cards.length) return cards;
    await sleep(250);
  }
  await debugLog(settings, "Job list render timeout", { timeoutMs, url: window.location.href });
  return [];
}

function getJobListScrollContainer() {
  const sentinel = document.querySelector("[data-results-list-top-scroll-sentinel]");
  const ul = document.querySelector("ul:has(li.scaffold-layout__list-item)") || document.querySelector("ul:has([data-occludable-job-id])") || document.querySelector("ul:has(.job-card-container)");
  const target = sentinel || ul;
  if (target) {
    let parent = target.parentElement;
    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      if (/(auto|scroll)/.test(style.overflowY || "") || parent.classList.contains("scaffold-layout__list") || parent.classList.contains("jobs-search-results-list")) {
        return parent;
      }
      parent = parent.parentElement;
    }
  }
  return (
    document.querySelector(".scaffold-layout__list") ||
    document.querySelector(".jobs-search-results-list") ||
    document.querySelector(".scaffold-layout__list-detail-inner") ||
    document.querySelector(".scaffold-layout__list-container") ||
    document.scrollingElement ||
    document.body
  );
}

async function loadAllJobCardsOnPage(settings) {
  let cards = collectJobCards();
  if (!cards.length) {
    cards = await waitForJobsToRender(settings, 7000);
  }
  if (!cards.length) return [];

  const scrollRoot = getJobListScrollContainer();
  let previousCardCount = cards.length;
  let stagnantCount = 0;

  // Progressively scroll down to trigger LinkedIn lazy loading until all cards (up to ~25) & pagination appear
  for (let i = 0; i < 12; i++) {
    if (scrollRoot && typeof scrollRoot.scrollBy === "function") {
      scrollRoot.scrollBy({ top: 800, behavior: "smooth" });
    } else {
      window.scrollBy({ top: 800, behavior: "smooth" });
    }
    await sleep(400);

    const currentCards = collectJobCards();
    const hasPagination = Boolean(
      document.querySelector(".jobs-search-pagination, .jobs-search-results-list__pagination, .jobs-search-pagination__pages")
    );

    if (currentCards.length > previousCardCount) {
      previousCardCount = currentCards.length;
      stagnantCount = 0;
    } else {
      stagnantCount++;
      if (stagnantCount >= 2 && (hasPagination || currentCards.length >= 25)) {
        break;
      }
    }

    if (currentCards.length >= 25 && hasPagination) break;
  }

  // Scroll back to top so processing starts cleanly from card #1
  if (scrollRoot && typeof scrollRoot.scrollTo === "function") {
    scrollRoot.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  await sleep(350);

  return collectJobCards();
}

async function dismissJobCard(card) {
  if (!card || !(card instanceof HTMLElement)) return false;
  try {
    const dismissBtn = getBySelectorList([
      "button[aria-label*='Dismiss']",
      "button[aria-label*='dismiss']",
      "button.job-card-container__action",
      ".job-card-list__actions-container button",
      "button[data-test-icon='close-small']",
      "button:has(svg[data-test-icon='close-small'])",
      "button:has(use[href*='close'])",
      "button[data-control-name*='dismiss']"
    ], card);

    if (dismissBtn && isVisibleElement(dismissBtn) && !dismissBtn.disabled) {
      await resilientClick(dismissBtn, "Dismiss job card (X)");
      await sleep(250);
      return true;
    }
  } catch {
    // best-effort dismiss
  }
  return false;
}

function getActiveModal() {
  return getBySelectorList([
    ".jobs-easy-apply-modal",
    ".artdeco-modal[role='dialog']",
    ".artdeco-modal",
    "div[data-test-modal]",
    "div[data-view-name*='easy-apply-modal']",
    "div[role='dialog'][aria-labelledby*='easy-apply']",
    "div[role='dialog'][aria-label*='Easy Apply']",
    "div[role='dialog']"
  ]);
}

function isModalLoading(modal) {
  if (!modal) return false;
  if (modal.getAttribute("aria-busy") === "true") return true;
  const loader = modal.querySelector(".artdeco-loader, .artdeco-loader__bar, [class*='skeleton'], [data-test-loading], .loader, .jobs-easy-apply-modal--loading");
  if (loader && isVisibleElement(loader)) return true;
  return false;
}

async function waitForModalOpen(timeoutMs = 4500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const modal = getActiveModal();
    if (modal && isVisibleElement(modal)) return modal;
    await sleep(180);
  }
  return null;
}

async function waitForModalReady(modal, timeoutMs = 4500) {
  if (!modal) return false;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const loading = isModalLoading(modal);
    const blocks = collectQuestionBlocks(modal);
    const nextBtn = findNextOrReviewButton(modal, { includeDisabled: true });
    const submitBtn = findSubmitButton(modal);
    if (!loading && (blocks.length > 0 || nextBtn || submitBtn)) {
      return true;
    }
    await sleep(250);
  }
  const finalBlocks = collectQuestionBlocks(modal);
  const finalNext = findNextOrReviewButton(modal, { includeDisabled: true });
  const finalSubmit = findSubmitButton(modal);
  return finalBlocks.length > 0 || Boolean(finalNext) || Boolean(finalSubmit);
}

function collectQuestionBlocks(modal) {
  if (!modal) return [];
  const selectors = [
    ".fb-dash-form-element",
    ".jobs-easy-apply-form-section__grouping",
    ".jobs-easy-apply-form-element",
    "div[data-test-form-element]",
    "div[data-test-single-line-text-form-component]",
    "div[data-test-text-entity-list-form-component]",
    "div[data-test-multiline-text-form-component]",
    "div[data-test-checkbox-form-component]",
    "div[data-test-date-form-component]",
    "div[data-test-form-builder-dropdown-form-component]",
    "fieldset[data-test-form-builder-radio-button-form-component='true']",
    "fieldset"
  ];
  const all = safeQuerySelectorAll(modal, selectors.join(","), null, "collectQuestionBlocks(all)");
  const unique = [];
  const seen = new Set();
  for (const block of all) {
    if (!(block instanceof HTMLElement)) continue;
    if (seen.has(block)) continue;
    seen.add(block);
    if (!isVisibleElement(block)) {
      const visibleControl = block.querySelector(
        "input:not([type='hidden']), textarea, select, [role='combobox'], button[aria-haspopup='listbox'], button[aria-label*='today'], input[type='date'], input[data-test-date-input]"
      );
      if (!visibleControl || !isVisibleElement(visibleControl)) continue;
    }
    unique.push(block);
  }

  if (unique.length) return unique;

  // Fallback: derive blocks from visible controls when LinkedIn wrapper selectors change.
  const fallbackControls = safeQuerySelectorAll(
    modal,
    "input:not([type='hidden']), textarea, select, [role='combobox'], button[aria-haspopup='listbox'], button[aria-label*='today'], input[type='date'], input[data-test-date-input]",
    null,
    "collectQuestionBlocks(fallbackControls)"
  ).filter((el) => isVisibleElement(el));
  const fallbackBlocks = [];
  const fallbackSeen = new Set();
  for (const control of fallbackControls) {
    const block =
      control.closest(selectors.join(",")) ||
      control.closest("div, fieldset, section, li, article");
    if (!(block instanceof HTMLElement) || fallbackSeen.has(block)) continue;
    fallbackSeen.add(block);
    fallbackBlocks.push(block);
  }
  return fallbackBlocks;
}

function truncateDebugText(value, max = 72) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function isRequiredQuestionBlock(block, rawLabel = "") {
  const labelNorm = normalizeLabel(rawLabel || "");
  if (String(block?.getAttribute?.("data-required") || "").toLowerCase() === "true") return true;
  if (Boolean(block?.querySelector?.("[required], [aria-required='true']"))) return true;
  if (labelNorm.includes(" required")) return true;
  if (String(rawLabel || "").includes("*")) return true;
  return false;
}

function collapseValidationText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getValidationMessageFromElements(elements) {
  for (const element of Array.isArray(elements) ? elements : []) {
    if (!(element instanceof HTMLElement)) continue;
    if (String(element.getAttribute("aria-hidden") || "").toLowerCase() === "true") continue;
    const text = collapseValidationText(element.textContent || element.getAttribute("aria-label") || "");
    if (text) return text;
  }
  return "";
}

function getQuestionBlockValidationMessage(block) {
  if (!(block instanceof HTMLElement)) return "";
  const selector = [
    ".artdeco-inline-feedback__message",
    "[role='alert']",
    ".fb-dash-form-element__error",
    ".jobs-easy-apply-form-element__error"
  ].join(",");

  const directMessage = getValidationMessageFromElements(Array.from(block.querySelectorAll(selector)));
  if (directMessage) return directMessage;

  const describedByIds = new Set();
  const controls = Array.from(
    block.querySelectorAll(
      "input, select, textarea, [role='combobox'], button[aria-haspopup='listbox'], [aria-describedby]"
    )
  );
  for (const control of controls) {
    const ids = String(control.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .map((id) => id.trim())
      .filter(Boolean);
    for (const id of ids) describedByIds.add(id);
  }

  if (describedByIds.size) {
    const describedByElements = Array.from(describedByIds)
      .map((id) => document.getElementById(id))
      .filter((element) => element instanceof HTMLElement);
    const describedByMessage = getValidationMessageFromElements(describedByElements);
    if (describedByMessage) return describedByMessage;
  }

  return "";
}

function isQuestionBlockInvalid(block, validationMessage = "") {
  if (!(block instanceof HTMLElement)) return Boolean(validationMessage);
  if (validationMessage) return true;
  return Boolean(block.querySelector("[aria-invalid='true'], .artdeco-text-input--error, .fb-dash-form-element--error"));
}

function getQuestionBlockState(block) {
  const rawLabel = getQuestionLabel(block) || "LinkedIn required field";
  const label = cleanQuestionLabel(rawLabel) || "LinkedIn required field";
  const required = isRequiredQuestionBlock(block, rawLabel);
  const questionKey = questionKeyFromLabel(label) || questionKeyFromLabel(rawLabel) || "";
  const validationMessage = getQuestionBlockValidationMessage(block);
  const invalid = isQuestionBlockInvalid(block, validationMessage);

  const select = block.querySelector("select");
  if (select && isVisibleElement(select)) {
    const selected = select.options?.[select.selectedIndex];
    const selectedText = String(selected?.textContent || "").trim();
    const answered = Boolean(selectedText && !isPlaceholderOptionText(selectedText));
    return {
      questionKey,
      label,
      required,
      type: "select",
      answered,
      value: selectedText,
      invalid,
      validationMessage
    };
  }

  const radios = Array.from(block.querySelectorAll("input[type='radio']")).filter((r) => isVisibleElement(r));
  if (radios.length) {
    const selected = radios.find((r) => r.checked);
    const selectedLabel = selected
      ? cleanQuestionLabel((selected.closest("label")?.textContent || selected.value || "").trim())
      : "";
    return {
      questionKey,
      label,
      required,
      type: "radio",
      answered: Boolean(selected),
      value: selectedLabel,
      invalid,
      validationMessage
    };
  }

  const textInput = getBySelectorList(
    ["input[type='text']", "input[type='email']", "input[type='tel']", "input[type='number']", "textarea"],
    block
  );
  if (textInput && isVisibleElement(textInput)) {
    const value = String(textInput.value || "").trim();
    return {
      questionKey,
      label,
      required,
      type: textInput.tagName.toLowerCase() === "textarea" ? "textarea" : "text",
      answered: Boolean(value),
      value,
      invalid,
      validationMessage
    };
  }

  const combobox = getBySelectorList(
    ["[role='combobox']", "button[aria-haspopup='listbox']", "input[role='combobox']"],
    block
  );
  if (combobox && isVisibleElement(combobox)) {
    const comboText = String(combobox.value || combobox.textContent || combobox.getAttribute("aria-label") || "").trim();
    const answered = Boolean(comboText && !isPlaceholderOptionText(comboText));
    return {
      questionKey,
      label,
      required,
      type: "combobox",
      answered,
      value: comboText,
      invalid,
      validationMessage
    };
  }

  const checkboxes = Array.from(block.querySelectorAll("input[type='checkbox']")).filter((c) => isVisibleElement(c));
  if (checkboxes.length) {
    const requiredBoxes = checkboxes.filter(
      (c) => c.required || c.getAttribute("aria-required") === "true" || required
    );
    const targetBoxes = requiredBoxes.length ? requiredBoxes : checkboxes;
    const answered = targetBoxes.every((c) => c.checked || c.getAttribute("aria-checked") === "true");
    return {
      questionKey,
      label,
      required,
      type: "checkbox",
      answered,
      value: answered ? "checked" : "",
      invalid,
      validationMessage
    };
  }

  const dateInput = getBySelectorList(["input[type='date']", "input[data-test-date-input]"], block);
  if (dateInput && isVisibleElement(dateInput)) {
    const value = String(dateInput.value || "").trim();
    return {
      questionKey,
      label,
      required,
      type: "date",
      answered: Boolean(value),
      value,
      invalid,
      validationMessage
    };
  }

  const dateHint = normalizeLabel(label || rawLabel || "");
  const hiddenDateInput = getBySelectorList(
    [
      "input[type='hidden'][id*='date']",
      "input[type='hidden'][name*='date']",
      "input[id*='date']",
      "input[name*='date']"
    ],
    block
  );
  const hiddenDateValue = String(hiddenDateInput?.value || "").trim();
  if (dateHint.includes("date") || dateHint.includes("start")) {
    if (hiddenDateValue) {
      return {
        questionKey,
        label,
        required,
        type: "date",
        answered: true,
        value: hiddenDateValue,
        invalid,
        validationMessage
      };
    }
  }

  const todayButton = getBySelectorList(
    [
      "button[aria-label*='This is today']",
      "button[aria-label*='today']",
      ".artdeco-calendar__today button"
    ],
    block
  );
  if (todayButton && isVisibleElement(todayButton)) {
    const value = hiddenDateValue;
    const answered = Boolean(value || todayButton.dataset.cpAutoSelectedToday === "1");
    return {
      questionKey,
      label,
      required,
      type: "date-picker",
      answered,
      value: value || (answered ? "today-selected" : ""),
      invalid,
      validationMessage
    };
  }

  return {
    questionKey,
    label,
    required,
    type: "unknown",
    answered: !required,
    value: "",
    invalid,
    validationMessage
  };
}

function summarizeQuestionBlockState(state) {
  const label = truncateDebugText(state?.label || "Unknown");
  const type = String(state?.type || "unknown");
  const required = state?.required ? "required" : "optional";
  const answered = state?.answered ? "answered" : "missing";
  const invalid = state?.invalid ? "invalid" : "valid";
  const value = truncateDebugText(state?.value || "", 36);
  const validationMessage = truncateDebugText(state?.validationMessage || "", 48);
  return `${type}|${required}|${answered}|${invalid}|${label}${value ? ` -> ${value}` : ""}${
    validationMessage ? ` ! ${validationMessage}` : ""
  }`;
}

function collectQuestionBlockDiagnostics(modal) {
  const blocks = collectQuestionBlocks(modal);
  return blocks.map((block) => getQuestionBlockState(block));
}

function isBlankValue(value) {
  return String(value || "").trim().length === 0;
}

function isPlaceholderOption(optionText) {
  const t = normalizeLabel(optionText);
  return !t || t.includes("select an option") || t.includes("choose an option");
}

function doesQuestionStateNeedAttention(state) {
  if (!state) return false;
  if (state.invalid) return true;
  return Boolean(state.required && !state.answered);
}

function collectActionableQuestions(modal) {
  const diagnostics = collectQuestionBlockDiagnostics(modal);
  const pending = [];
  const seen = new Set();
  for (const d of diagnostics) {
    if (!doesQuestionStateNeedAttention(d)) continue;
    const questionKey = d.questionKey || questionKeyFromLabel(d.label) || "linkedin_required_selection";
    const questionLabel = d.label || "LinkedIn required selection";
    const dedupeKey = `${questionKey}::${normalizeLabel(questionLabel)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    pending.push({
      questionKey,
      questionLabel,
      validationMessage: d.validationMessage || ""
    });
  }
  return pending;
}

function buildPendingQuestionsFromValidation(modal, validationMessage) {
  const questions = collectActionableQuestions(modal);
  if (questions.length) {
    return questions.map((q) => ({
      ...q,
      validationMessage:
        q.validationMessage ||
        validationMessage ||
        "Required field answer missing"
    }));
  }

  // Fallback for LinkedIn custom components that do not expose native select/radio state clearly.
  const firstBlock = collectQuestionBlocks(modal)[0];
  const rawLabel = firstBlock ? getQuestionLabel(firstBlock) : "";
  const fallbackLabel = rawLabel || "LinkedIn required selection";
  const fallbackKey = questionKeyFromLabel(fallbackLabel || "linkedin_required_selection");
  return [
    {
      questionKey: fallbackKey || "linkedin_required_selection",
      questionLabel: fallbackLabel,
      validationMessage: validationMessage || "Please make a selection"
    }
  ];
}

function buildPendingQuestionsFromDiagnostics(unresolvedDiagnostics, validationMessage = "") {
  const items = Array.isArray(unresolvedDiagnostics) ? unresolvedDiagnostics : [];
  const pending = [];
  const seen = new Set();
  for (const d of items) {
    if (!doesQuestionStateNeedAttention(d)) continue;
    const questionKey = d.questionKey || questionKeyFromLabel(d.label) || "linkedin_required_selection";
    const questionLabel = d.label || "LinkedIn required selection";
    const dedupeKey = `${questionKey}::${normalizeLabel(questionLabel)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    pending.push({
      questionKey,
      questionLabel,
      validationMessage:
        d.validationMessage ||
        validationMessage ||
        (d.invalid ? "Please correct this answer" : "Required field answer missing")
    });
  }
  return pending;
}

function resolveManualAnswer(screeningAnswers, questionKey, questionLabel) {
  const source = screeningAnswers && typeof screeningAnswers === "object" ? screeningAnswers : {};
  const key = String(questionKey || "").trim();
  const labelNorm = normalizeLabel(questionLabel || "");
  const canonicalKey = canonicalQuestionKey(questionKey || questionLabel || "");
  if (key && !isBlankValue(source[key])) return String(source[key] || "").trim();
  if (canonicalKey && !isBlankValue(source[canonicalKey])) return String(source[canonicalKey] || "").trim();
  if (labelNorm && !isBlankValue(source[labelNorm])) return String(source[labelNorm] || "").trim();
  for (const [k, value] of Object.entries(source)) {
    if (isBlankValue(value)) continue;
    if (normalizeLabel(k) === labelNorm) return String(value || "").trim();
    if (canonicalQuestionKey(k) === canonicalKey && canonicalKey) return String(value || "").trim();
  }
  return "";
}

async function waitForPendingAnswersFromSettings(questions, timeoutMs = MANUAL_ANSWER_WAIT_MS, pollMs = MANUAL_ANSWER_POLL_MS) {
  const pending = Array.isArray(questions) ? questions.filter(Boolean) : [];
  if (!pending.length) {
    return { ok: false, screeningAnswers: {} };
  }
  const timeout = Math.max(3000, Number(timeoutMs || MANUAL_ANSWER_WAIT_MS));
  const poll = Math.max(400, Number(pollMs || MANUAL_ANSWER_POLL_MS));
  const started = Date.now();

  while (Date.now() - started < timeout) {
    if (!await isRunActive()) {
      return { ok: false, screeningAnswers: {} };
    }
    const loaded = await sendMessage({ type: "CP_LOAD_SETTINGS" });
    const screeningAnswers = loaded?.ok ? (loaded.settings?.screeningAnswers || {}) : {};
    const allResolved = pending.every((q) =>
      Boolean(resolveManualAnswer(screeningAnswers, q.questionKey, q.questionLabel))
    );
    if (allResolved) {
      return { ok: true, screeningAnswers };
    }
    await sleep(poll);
  }
  return { ok: false, screeningAnswers: {} };
}

function getModalValidationMessage(modal) {
  return normalizeLabel(getModalValidationMessageRaw(modal));
}

function getModalValidationMessageRaw(modal) {
  return getValidationMessageFromElements(
    Array.from(
      modal?.querySelectorAll?.(
        [
          ".artdeco-inline-feedback__message",
          "[role='alert']",
          ".fb-dash-form-element__error",
          ".jobs-easy-apply-form-element__error"
        ].join(",")
      ) || []
    )
  );
}

function getModalSignature(modal) {
  const labels = Array.from(
    modal.querySelectorAll("label, legend, .fb-dash-form-element__label, [data-test-form-element] label")
  )
    .map((el) => normalizeLabel(el.textContent || ""))
    .filter(Boolean)
    .slice(0, 12);
  const heading = normalizeLabel(
    getBySelectorList(["h3", "h2", ".artdeco-modal__header h2", ".jobs-easy-apply-content__title"], modal)?.textContent || ""
  );
  const validation = getModalValidationMessage(modal);
  return `${heading}|${validation}|${labels.join("|")}`;
}

function isPlaceholderOptionText(text) {
  const t = normalizeLabel(text);
  return !t || t.includes("select an option") || t.includes("choose an option");
}

async function selectTodayDateIfPresent(modal) {
  if (!modal) return false;

  const dateInput = getBySelectorList(["input[type='date']", "input[data-test-date-input]"], modal);
  if (dateInput && isVisibleElement(dateInput)) {
    const prev = String(dateInput.value || "").trim();
    if (!prev) {
      const today = new Date().toISOString().slice(0, 10);
      dateInput.focus();
      dateInput.value = today;
      dateInput.dispatchEvent(new Event("input", { bubbles: true }));
      dateInput.dispatchEvent(new Event("change", { bubbles: true }));
      await logLine("Selected today's date for date-picker field");
      return true;
    }
  }

  const buttons = Array.from(
    modal.querySelectorAll(
      "button[aria-label*='This is today'], button[aria-label*='today'], .artdeco-calendar__today button"
    )
  ).filter((b) => !b.disabled && isVisibleElement(b));
  for (const button of buttons) {
    const label = normalizeLabel(button.getAttribute("aria-label") || button.textContent || "");
    if (!label.includes("today")) continue;
    if (button.dataset.cpAutoSelectedToday === "1") continue;
    await resilientClick(button, "Date picker today");
    button.dataset.cpAutoSelectedToday = "1";
    await logLine("Selected today's date for date-picker field");
    return true;
  }
  return false;
}

function findSubmitButton(modal) {
  const buttons = Array.from(modal.querySelectorAll("button")).filter((b) => !b.disabled && isVisibleElement(b));
  return (
    buttons.find((b) => normalizeLabel(b.getAttribute("aria-label")).includes("submit application")) ||
    buttons.find((b) => normalizeLabel(b.getAttribute("aria-label")).includes("submit")) ||
    buttons.find((b) => normalizeLabel(b.textContent).includes("submit application")) ||
    buttons.find((b) => normalizeLabel(b.textContent) === "submit")
  );
}

function findDoneOrCloseButton(modalOrRoot = document) {
  const buttons = Array.from(modalOrRoot.querySelectorAll("button")).filter((b) => !b.disabled && isVisibleElement(b));
  return (
    buttons.find((b) => normalizeLabel(b.getAttribute("aria-label")).includes("done")) ||
    buttons.find((b) => normalizeLabel(b.textContent).includes("done")) ||
    buttons.find((b) => normalizeLabel(b.getAttribute("aria-label")).includes("dismiss")) ||
    buttons.find((b) => normalizeLabel(b.textContent).includes("close")) ||
    null
  );
}

function getVisibleModalButtons(modalOrRoot = document) {
  return Array.from(modalOrRoot.querySelectorAll("button")).filter((b) => !b.disabled && isVisibleElement(b));
}

function findModalButtonByIncludes(modalOrRoot, includesList) {
  const buttons = getVisibleModalButtons(modalOrRoot);
  for (const button of buttons) {
    const text = normalizeLabel(`${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`);
    if (includesList.some((needle) => text.includes(needle))) return button;
  }
  return null;
}

function findSaveApplicationPromptModal() {
  const dialogs = Array.from(document.querySelectorAll("[role='alertdialog'], .artdeco-modal, div[data-test-modal], div[role='dialog']"));
  for (const d of dialogs.reverse()) {
    if (isSaveApplicationPrompt(d) && isVisibleElement(d)) {
      return d;
    }
  }
  return null;
}

function isSaveApplicationPrompt(modal) {
  const text = normalizeLabel(modal?.textContent || "");
  if (!text) return false;
  return (
    text.includes("save this application") ||
    text.includes("if you choose to not save") ||
    text.includes("your application will be discarded") ||
    text.includes("discard draft")
  );
}

let lastDismissPromptTime = 0;

async function dismissSaveApplicationPrompt(modal) {
  const now = Date.now();
  if (now - lastDismissPromptTime < 1400) {
    return true;
  }
  lastDismissPromptTime = now;

  const targetScope = (modal && isSaveApplicationPrompt(modal)) ? modal : (findSaveApplicationPromptModal() || document);
  const discardBtn =
    findModalButtonByIncludes(targetScope, ["discard"]) ||
    findModalButtonByIncludes(targetScope, ["don't save", "dont save"]) ||
    document.querySelector("button[data-control-name='discard_application_confirm_btn']") ||
    document.querySelector("button[data-test-dialog-secondary-action]") ||
    document.querySelector(".artdeco-modal__action-bar button:first-child");
  if (!discardBtn) return false;

  await resilientClick(discardBtn, "Discard draft application");
  await logLine("Dismissed 'Save this application?' prompt by discarding draft.");

  // Wait safely for LinkedIn to process the discard and remove the dialog from DOM
  for (let wait = 0; wait < 6; wait++) {
    await sleep(350);
    const stillThere = findSaveApplicationPromptModal();
    if (!stillThere || !isVisibleElement(stillThere)) {
      return true;
    }
  }

  // Fallback: If LinkedIn API threw an error or dialog is hung, close via 'X' button or Escape
  const closeBtn = targetScope.querySelector?.("button[aria-label*='Dismiss'], button[data-test-modal-close-btn], button.artdeco-modal__dismiss");
  if (closeBtn && isVisibleElement(closeBtn)) {
    await resilientClick(closeBtn, "Close prompt modal");
    await sleep(300);
  } else {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(200);
  }
  return true;
}

async function closePostSubmitUi(settings, options = {}) {
  const preferDiscardDraft = Boolean(options.discardDraft);
  try {
    for (let i = 0; i < 4; i += 1) {
      if (preferDiscardDraft) {
        const promptModal = findSaveApplicationPromptModal();
        if (promptModal) {
          await dismissSaveApplicationPrompt(promptModal);
          await sleep(400);
        }
      }
      const modal = getActiveModal();
      if (!modal || !isVisibleElement(modal)) break;
      if (preferDiscardDraft && isSaveApplicationPrompt(modal)) {
        await dismissSaveApplicationPrompt(modal);
        await sleep(400);
        continue;
      }
      const doneBtn = findDoneOrCloseButton(modal);
      if (doneBtn) {
        await resilientClick(doneBtn, "Done/Close");
        await sleep(450);
        if (preferDiscardDraft) {
          const promptAfter = findSaveApplicationPromptModal();
          if (promptAfter) {
            await dismissSaveApplicationPrompt(promptAfter);
            await sleep(400);
          }
        }
      } else {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await sleep(250);
      }
    }
    if (preferDiscardDraft) {
      const promptAfter = findSaveApplicationPromptModal();
      if (promptAfter) {
        await dismissSaveApplicationPrompt(promptAfter);
      }
    }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(150);
  } catch {
    // best effort
  }

  if (isPostApplySearchPage()) {
    const resumeUrl = getResumableSearchUrl(settings);
    await debugLog(settings, "Redirecting out of post-apply page", { path: window.location.pathname, resumeUrl });
    window.location.href = resumeUrl;
  }
}

function findNextOrReviewButton(modal, options = {}) {
  const includeDisabled = Boolean(options?.includeDisabled);
  const buttons = Array.from(modal.querySelectorAll("button")).filter((b) => isVisibleElement(b) && (includeDisabled || !b.disabled));
  const needles = [
    "continue to next step",
    "continue",
    "next",
    "review your application",
    "review application",
    "review",
    "save and continue",
  ];
  return buttons.find((button) => {
    const text = normalizeLabel(`${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`);
    return needles.some((needle) => text.includes(needle));
  });
}

function didSubmitComplete(modal) {
  if (isPostApplySearchPage()) return true;
  const activeModal = getActiveModal();
  if (!activeModal || !isVisibleElement(activeModal)) return true;
  const validation = getModalValidationMessage(activeModal);
  if (validation) return false;
  const successText = normalizeLabel(activeModal.textContent || "");
  if (
    successText.includes("application submitted") ||
    successText.includes("application sent") ||
    successText.includes("your application was sent")
  ) {
    return true;
  }
  const stillSubmit = findSubmitButton(activeModal);
  return !stillSubmit;
}

async function applyFollowCompanyPreference(modal, settings) {
  const checkbox = getBySelectorList(
    [
      "input#follow-company-checkbox",
      "input[id*='follow-company'][type='checkbox']",
      "input[name*='follow'][type='checkbox']"
    ],
    modal
  );
  if (!checkbox) return false;
  const shouldFollow = Boolean(settings.followCompanies);
  const checked = checkbox.checked || checkbox.getAttribute("aria-checked") === "true";
  if (checked === shouldFollow) return true;

  const label =
    modal.querySelector("label[for='follow-company-checkbox']") ||
    checkbox.closest("label") ||
    checkbox;
  await resilientClick(label, "Follow company");
  await logLine(shouldFollow ? "Enabled follow-company option" : "Disabled follow-company option");
  return true;
}

function isFollowCompanyCheckbox(input) {
  if (!input) return false;
  const id = normalizeLabel(input.id || "");
  const name = normalizeLabel(input.getAttribute("name") || "");
  const aria = normalizeLabel(input.getAttribute("aria-label") || "");
  if (id.includes("follow-company") || name.includes("follow-company") || aria.includes("follow company")) return true;
  const label = input.closest("label") || (input.id ? document.querySelector(`label[for='${CSS.escape(input.id)}']`) : null);
  const txt = normalizeLabel(label?.textContent || "");
  return txt.includes("follow") && txt.includes("company");
}

function getCheckboxLabel(input, root) {
  if (!input) return "";
  const inline = input.closest("label");
  if (inline) return cleanQuestionLabel(inline.textContent || "");
  if (input.id) {
    const byFor = root?.querySelector(`label[for='${CSS.escape(input.id)}']`) || document.querySelector(`label[for='${CSS.escape(input.id)}']`);
    if (byFor) return cleanQuestionLabel(byFor.textContent || "");
  }
  const container = input.closest("div, li, fieldset, section");
  return cleanQuestionLabel(container?.textContent || "");
}

async function applySubmitConsentCheckboxes(modal, settings) {
  const checkboxes = Array.from(modal.querySelectorAll("input[type='checkbox']")).filter((c) => isVisibleElement(c));
  if (!checkboxes.length) return false;
  let changed = false;
  for (const checkbox of checkboxes) {
    if (isFollowCompanyCheckbox(checkbox)) continue;
    const checked = checkbox.checked || checkbox.getAttribute("aria-checked") === "true";
    if (checked) continue;
    const label = normalizeLabel(getCheckboxLabel(checkbox, modal));
    const isRequired =
      checkbox.required ||
      checkbox.getAttribute("aria-required") === "true" ||
      label.includes("required") ||
      label.includes("i agree") ||
      label.includes("i acknowledge") ||
      label.includes("terms") ||
      label.includes("privacy") ||
      label.includes("employment rights") ||
      label.includes("notice");
    if (!isRequired) continue;
    const clickable =
      (checkbox.id ? modal.querySelector(`label[for='${CSS.escape(checkbox.id)}']`) : null) ||
      checkbox.closest("label") ||
      checkbox;
    const clicked = await resilientClick(clickable, "Consent checkbox");
    if (clicked) {
      changed = true;
      await logLine(`Checked submit consent field: ${label.slice(0, 80) || "required consent"}`);
    }
  }
  return changed;
}

function isCustomEntitySelectionBlock(block) {
  return Boolean(
    getBySelectorList(
      [
        "[data-test-text-entity-list-form-component]",
        "[data-test-form-builder-dropdown-form-component]",
        "[role='combobox']",
        "button[aria-haspopup='listbox']"
      ],
      block
    )
  );
}

function getYearsFallback(settings) {
  const configured = String(settings.yearsOfExperienceAnswer || "").trim();
  if (configured) return configured;
  const fromExperience = Number(settings.currentExperience);
  if (Number.isFinite(fromExperience) && fromExperience >= 0) return String(fromExperience);
  return "1";
}

function isYearsExperienceQuestion(label) {
  const l = normalizeLabel(label);
  return l.includes("year") && l.includes("experience");
}

function getStructuredTextFallback(label, settings) {
  const l = normalizeLabel(label);
  if (!l) return "";

  if (
    l.includes("current company") ||
    l.includes("current employer") ||
    l.includes("employer name") ||
    l.includes("company name")
  ) {
    return String(settings.recentEmployer || "").trim();
  }

  if (
    l.includes("employee referral") ||
    l.includes("provide their name") ||
    l.includes("if so, who")
  ) {
    return "N/A";
  }

  if (
    l.includes("how did you hear") ||
    l.includes("how did you find") ||
    (l.includes("hear") && (l.includes("position") || l.includes("role") || l.includes("job")))
  ) {
    return "LinkedIn";
  }

  if (l.includes("desired compensation") || l.includes("desired salary") || l.includes("desired pay")) {
    return getSalaryAnswer(l, settings) || "Negotiable";
  }

  if (
    (l.includes("earliest") && l.includes("start")) ||
    l.includes("available to start") ||
    l.includes("start working")
  ) {
    const noticeDays = normalizeNumberString(settings.noticePeriodDays);
    if (noticeDays) {
      const n = Number(noticeDays);
      if (Number.isFinite(n) && n <= 7) return "Immediately";
      return `${noticeDays} days`;
    }
    return "Immediately";
  }

  if (
    l.includes("description") ||
    l.includes("describe") ||
    l.includes("summary") ||
    l.includes("about yourself") ||
    l.includes("bio")
  ) {
    return String(settings.linkedinSummary || settings.coverLetter || settings.screeningAnswers?.["description"] || "").trim();
  }

  return "";
}

function shouldUseNumericFallbackForTextInput(label, textInput) {
  const inputType = normalizeLabel(textInput?.getAttribute?.("type") || "");
  if (inputType === "number") return true;
  const l = normalizeLabel(label);
  return (
    l.includes("year") ||
    l.includes("how many") ||
    l.includes("number of") ||
    l.includes("gpa") ||
    l.includes("score")
  );
}

function getSelectRuleAnswer(label, settings, optionsForMatch, currentOptionText = "") {
  const l = normalizeLabel(label);
  if (l.includes("email") && !isMarketingConsentQuestion(l)) {
    return optionsForMatch.find((o) => String(o.text || "").includes("@"))?.text || "";
  }
  if (l.includes("phone country code")) {
    if (!isPlaceholderOptionText(currentOptionText || "")) return currentOptionText;
    return String(settings.phoneCountryCode || "").trim();
  }
  if (l.includes("phone")) {
    if (!isPlaceholderOptionText(currentOptionText || "")) return currentOptionText;
  }
  if (l.includes("visa") || l.includes("sponsorship")) return String(settings.requireVisa || "No").trim();
  if (
    l.includes("citizenship") ||
    l.includes("employment eligibility") ||
    l.includes("work authorization") ||
    (l.includes("authorized") && l.includes("work"))
  ) {
    return String(settings.usCitizenship || "").trim();
  }
  if (l.includes("protected") && l.includes("veteran")) return String(settings.veteranStatus || "").trim();
  if (l.includes("veteran")) return String(settings.veteranStatus || "").trim();
  if (l.includes("disability") || l.includes("handicapped")) return String(settings.disabilityStatus || "").trim();
  if (l.includes("gender") || l.includes("sex")) return String(settings.gender || "").trim();
  if (l.includes("ethnicity") || l.includes("race")) return String(settings.ethnicity || "").trim();
  if (isMarketingConsentQuestion(l)) return String(settings.marketingConsent || "Yes").trim();
  if (l.includes("proficiency")) return "Professional";
  if (l.includes("salary") || l.includes("compensation") || l.includes("ctc") || l.includes("pay")) {
    return getSalaryAnswer(l, settings);
  }
  if (l.includes("country")) return String(settings.country || "").trim();
  if (l.includes("state") || l.includes("province")) return String(settings.stateRegion || "").trim();
  if (l.includes("city")) return normalizeCityAnswer(settings.currentCity, currentJobContext.workLocation);
  if (l.includes("location")) {
    return String(currentJobContext.workLocation || "").trim() || normalizeCityAnswer(settings.currentCity, currentJobContext.workLocation);
  }
  return "";
}

async function applyComboboxOption(block, label, answer, settings) {
  const trigger = getBySelectorList(
    [
      "button[aria-haspopup='listbox']",
      "[role='combobox']",
      "input[role='combobox']",
      ".artdeco-dropdown__trigger"
    ],
    block
  );
  if (!trigger) return false;

  const triggerText = String(trigger.textContent || trigger.value || "").trim();
  if (triggerText && !isPlaceholderOptionText(triggerText) && !String(answer || "").trim()) {
    return false;
  }
  if (!settings.overwritePreviousAnswers && triggerText && !isPlaceholderOptionText(triggerText)) {
    return false;
  }

  await resilientClick(trigger, "Combobox trigger");
  await sleep(300);

  function collectBlockOptions() {
    const listbox = block.querySelector("[role='listbox']") ||
      trigger.closest("[role='listbox']") ||
      trigger.parentElement?.querySelector("[role='listbox']");
    const scope = listbox || block;
    return Array.from(
      scope.querySelectorAll(
        "[role='option'], li[role='option'], .artdeco-typeahead__result"
      )
    ).filter((el) => isVisibleElement(el));
  }

  let optionEls = collectBlockOptions();
  if (!optionEls.length) {
    optionEls = Array.from(
      document.querySelectorAll(
        "[role='listbox'] [role='option'], [role='option'], .artdeco-typeahead__result, li[role='option']"
      )
    ).filter((el) => isVisibleElement(el));
  }

  const optionsForMatch = optionEls
    .map((el) => ({
      text: String(el.textContent || "").trim(),
      value: String(el.getAttribute("data-value") || ""),
      el
    }))
    .filter((o) => Boolean(o.text));
  if (!optionsForMatch.length) return false;

  let resolvedAnswer = String(answer || "").trim();
  if (!resolvedAnswer) {
    resolvedAnswer = getSelectRuleAnswer(label, settings, optionsForMatch, triggerText);
  }
  if (!resolvedAnswer) {
    resolvedAnswer = await requestAiAnswer(label, "select", optionsForMatch.map((o) => o.text), getModalValidationMessage(getActiveModal()));
  }
  const matchedTarget = selectBestOption(optionsForMatch, resolvedAnswer);
  const target = matchedTarget || selectFallbackOption(optionsForMatch, label);
  if (!target?.el) return false;
  if (normalizeLabel(target.text || "") === normalizeLabel(triggerText || "")) return false;

  try {
    target.el.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(120);
  } catch {}
  target.el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  await sleep(60);
  target.el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
  await sleep(60);
  target.el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  await sleep(350);

  const triggerAfter = getBySelectorList(
    ["button[aria-haspopup='listbox']", "[role='combobox']", "input[role='combobox']", ".artdeco-dropdown__trigger"],
    block
  );
  const triggerAfterText = String(triggerAfter?.textContent || triggerAfter?.value || "").trim();
  const selectionConfirmed = normalizeLabel(triggerAfterText || "") === normalizeLabel(target.text || "");

  if (!selectionConfirmed) {
    try {
      const fallbackTarget = triggerAfter || trigger;
      fallbackTarget.focus();
      await sleep(80);
      fallbackTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await sleep(150);
      fallbackTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await sleep(300);
    } catch {}
  }

  const finalTrigger = getBySelectorList(
    ["button[aria-haspopup='listbox']", "[role='combobox']", "input[role='combobox']", ".artdeco-dropdown__trigger"],
    block
  );
  const finalText = normalizeLabel(String(finalTrigger?.textContent || finalTrigger?.value || "").trim());
  const listboxStillOpen = block.querySelector("[role='listbox'] [role='option']") ||
    document.querySelector("[role='listbox'] [role='option']");

  if (!selectionConfirmed && finalText !== normalizeLabel(target.text || "") && listboxStillOpen) {
    await logLine(`Combobox option did not register for: ${label.slice(0, 60)} (dropdown still open)`, "warn");
    return false;
  }

  await logLine(
    matchedTarget
      ? `Selected combobox option for: ${label.slice(0, 60)}`
      : `Selected combobox fallback for: ${label.slice(0, 60)}`
  );
  return true;
}

async function fillUnlabeledQuestionBlock(block, settings) {
  let changed = false;

  const select = block.querySelector("select");
  if (select) {
    const selected = select.options?.[select.selectedIndex];
    if (selected && !isPlaceholderOptionText(selected.textContent || "")) {
      return changed;
    }
    const options = Array.from(select.options || [])
      .map((o) => ({ text: String(o.textContent || "").trim(), value: String(o.value || "") }))
      .filter((o) => Boolean(o.text));
    const target = selectFallbackOption(options);
    if (target && select.value !== target.value) {
      select.value = target.value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await logLine("Selected fallback option for unlabeled required field");
      changed = true;
    }
  }

  const radios = Array.from(block.querySelectorAll("input[type='radio']"));
  if (!changed && radios.length) {
    const options = radios.map((r) => ({
      text: getRadioOptionText(r, block),
      value: String(r.value || ""),
      input: r,
      clickTarget: getRadioClickTarget(r, block)
    }));
    const resumeTarget = getPreferredResumeOption(options, "resume");
    if (resumeTarget) {
      const validationNorm = normalizeLabel(getModalValidationMessage(getActiveModal()) || "");
      const resumeRequired = validationNorm.includes("resume") && validationNorm.includes("required");
      if (!resumeTarget.input?.checked || resumeRequired) {
        const clicked = await resilientClick(resumeTarget.clickTarget || resumeTarget.input, "Resume radio option");
        if (clicked) {
          await sleep(220);
          await logLine("Selected latest resume option for unlabeled required field");
          changed = true;
        }
      } else {
        return changed;
      }
    } else if (!radios.some((r) => r.checked)) {
      const target = selectFallbackOption(options);
      if (target?.input) {
        const clicked = await resilientClick(target.clickTarget || target.input, "Radio fallback option");
        if (clicked) {
          await logLine("Radio fallback answered for unlabeled required field");
          changed = true;
        }
      }
    }
  }

  const textInput = getBySelectorList(
    ["input[type='text']", "input[type='email']", "input[type='tel']", "input[type='number']"],
    block
  );
  if (!changed && textInput) {
    const prev = String(textInput.value || "").trim();
    if (!prev) {
      const inputType = normalizeLabel(textInput.getAttribute("type") || "");
      const answer = inputType === "number" ? getYearsFallback(settings) : "";
      if (answer && prev !== answer) {
        textInput.focus();
        textInput.value = answer;
        textInput.dispatchEvent(new Event("input", { bubbles: true }));
        textInput.dispatchEvent(new Event("change", { bubbles: true }));
        await logLine("Answered unlabeled required field with fallback value");
        changed = true;
      }
    }
  }

  if (!changed) {
    const dateChanged = await selectTodayDateIfPresent(block);
    if (dateChanged) {
      changed = true;
      return changed;
    }
  }

  if (!changed) {
    const comboLabel = getQuestionLabel(block) || "LinkedIn required selection";
    changed = await applyComboboxOption(block, comboLabel, "", { ...settings, overwritePreviousAnswers: true });
  }

  const checkbox = block.querySelector("input[type='checkbox']");
  if (!changed && checkbox && !checkbox.checked) {
    checkbox.click();
    await logLine("Checkbox selected for unlabeled required field");
    changed = true;
  }

  return changed;
}

async function fillQuestionBlock(block, settings) {
  let changed = false;
  const labelRaw = getQuestionLabel(block);
  const label = normalizeLabel(labelRaw);
  if (!label) {
    return fillUnlabeledQuestionBlock(block, settings);
  }
  if (label.includes("date") || label.includes("start date") || label.includes("available start")) {
    const dateChanged = await selectTodayDateIfPresent(block);
    if (dateChanged) return true;
    const dateState = getQuestionBlockState(block);
    if ((dateState.type === "date" || dateState.type === "date-picker") && dateState.answered) {
      return false;
    }
  }
  let answer = answerCommonQuestion(label, settings);

  const modal = getActiveModal();
  const validationMessage = getModalValidationMessage(modal);
  const aiQuestionLabel = labelRaw || label;

  if (answer && (label.includes("location") || label.includes("city") || label.includes("address"))) {
    await debugLog(settings, "Resolved location answer", {
      questionLabel: aiQuestionLabel,
      settingsCurrentCity: String(settings?.currentCity || ""),
      jobWorkLocation: String(currentJobContext?.workLocation || ""),
      normalizedFromSettingsOrJob: normalizeCityAnswer(settings?.currentCity, currentJobContext?.workLocation),
      finalAnswer: String(answer || "")
    });
  }

  const textInput = getBySelectorList(
    ["input[type='text']", "input[type='email']", "input[type='tel']", "input[type='number']", "textarea"],
    block
  );
  const isEntityListBlock = isCustomEntitySelectionBlock(block);
  if (textInput && isEntityListBlock) {
    const handledByCombobox = await applyComboboxOption(block, aiQuestionLabel, answer, settings);
    if (handledByCombobox) return true;
  }
  if (textInput && !answer) {
    answer = await requestAiAnswer(aiQuestionLabel, textInput.tagName.toLowerCase() === "textarea" ? "textarea" : "text", [], validationMessage);
  }
  if (textInput && !answer && textInput.tagName.toLowerCase() === "textarea") {
    answer = String(settings.coverLetter || "").trim();
  }
  if (textInput && !answer && textInput.tagName.toLowerCase() !== "textarea") {
    answer = getStructuredTextFallback(label, settings);
  }
  if (
    textInput &&
    !answer &&
    textInput.tagName.toLowerCase() !== "textarea" &&
    shouldUseNumericFallbackForTextInput(label, textInput)
  ) {
    const yearsFallback = getYearsFallback(settings);
    if (isYearsExperienceQuestion(label) && yearsFallback === "1") {
      const configured = String(settings?.yearsOfExperienceAnswer || "").trim();
      const fromExperience = Number(settings?.currentExperience);
      const isConfigured = Boolean(configured) || (Number.isFinite(fromExperience) && fromExperience >= 0);
      if (!isConfigured && !warnedDefaultYearsFallback) {
        warnedDefaultYearsFallback = true;
        await logLine("Years of experience not configured in extension settings. Defaulting to 1 year.", "warn");
      }
    }
    answer = yearsFallback;
  }
  if (textInput && answer) {
    const prev = String(textInput.value || "").trim();
    if (prev && !settings.overwritePreviousAnswers) return false;
    if (prev === String(answer).trim()) return false;
    textInput.focus();
    textInput.value = answer;
    textInput.dispatchEvent(new Event("input", { bubbles: true }));
    textInput.dispatchEvent(new Event("change", { bubbles: true }));
    const normalizedAnswer = normalizeLabel(answer);
    const shouldTryAutocomplete =
      isEntityListBlock ||
      label.includes("city") ||
      label.includes("location") ||
      label.includes("address") ||
      (isMarketingConsentQuestion(label) && (normalizedAnswer === "yes" || normalizedAnswer === "no"));
    if (shouldTryAutocomplete) {
      textInput.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      textInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }
    if (textInput.dataset.cpLastAutoValue !== String(answer).trim()) {
      await logLine(`Answered: ${label.slice(0, 60)} -> ${answer}`);
      textInput.dataset.cpLastAutoValue = String(answer).trim();
    }
    changed = true;
    return changed;
  }

  const select = block.querySelector("select");
  if (select) {
    const options = Array.from(select.options || []);
    const optionsForMatch = options
      .map((o) => ({ text: String(o.textContent || "").trim(), value: String(o.value || "") }))
      .filter((o) => Boolean(o.text));
    const current = options.find((o) => o.value === select.value);
    if (current && !isPlaceholderOptionText(current.textContent || "") && !settings.overwritePreviousAnswers) return false;

    if (!answer) {
      answer = getSelectRuleAnswer(label, settings, optionsForMatch, String(current?.textContent || ""));
    }

    if (!answer) {
      answer = await requestAiAnswer(aiQuestionLabel, "select", optionsForMatch.map((o) => o.text), validationMessage);
    }

    const matchedTarget = selectBestOption(optionsForMatch, answer);
    const target = matchedTarget || selectFallbackOption(optionsForMatch, label);
    if (target) {
      if (select.value === target.value) return false;
      select.value = target.value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      const marker = `${label}::${target.value}`;
      if (select.dataset.cpLastAutoValue !== marker) {
        await logLine(
          matchedTarget
            ? `Selected option for: ${label.slice(0, 60)}`
            : `Selected fallback option for: ${label.slice(0, 60)}`
        );
        select.dataset.cpLastAutoValue = marker;
      }
      changed = true;
      return changed;
    }
  }

  const radios = Array.from(block.querySelectorAll("input[type='radio']"));
  if (radios.length) {
    const options = radios.map((r) => ({
      text: getRadioOptionText(r, block),
      value: String(r.value || ""),
      input: r,
      clickTarget: getRadioClickTarget(r, block)
    }));
    const validationNorm = normalizeLabel(validationMessage || "");
    const resumeTarget = getPreferredResumeOption(options, aiQuestionLabel);
    if (resumeTarget) {
      const resumeRequired = validationNorm.includes("resume") && validationNorm.includes("required");
      const alreadySelectedResume = Boolean(resumeTarget.input?.checked);
      if (!alreadySelectedResume || settings.overwritePreviousAnswers || resumeRequired) {
        const clicked = await resilientClick(resumeTarget.clickTarget || resumeTarget.input, "Resume option");
        if (clicked) {
          await sleep(220);
          const marker = getResumeOptionIdentity(resumeTarget.text || resumeTarget.value || "resume");
          if (block.dataset.cpLastResumeChoice !== marker) {
            await logLine(`Selected resume option: ${cleanQuestionLabel(resumeTarget.text || "").slice(0, 80)}`);
            block.dataset.cpLastResumeChoice = marker;
          }
          changed = true;
          return changed;
        }
      }
      if (alreadySelectedResume && !settings.overwritePreviousAnswers && !resumeRequired) {
        return false;
      }
    }

    const alreadySelected = radios.some((r) => r.checked);
    if (alreadySelected && !settings.overwritePreviousAnswers) return false;
    if (!answer) {
      answer = await requestAiAnswer(aiQuestionLabel, "radio", options.map((o) => o.text), validationMessage);
    }
    const matchedTarget = selectBestOption(options, answer);
    const target = matchedTarget || selectFallbackOption(options, aiQuestionLabel);
    if (target) {
      if (target.input?.checked) {
        return false;
      }
      const clicked = await resilientClick(target.clickTarget || target.input, "Radio option");
      if (!clicked) return false;
      const marker = normalizeLabel(target.value || target.text || "selected");
      if (block.dataset.cpLastRadioValue !== marker) {
        await logLine(
          matchedTarget
            ? `Radio answered for: ${label.slice(0, 60)}`
            : `Radio fallback answered for: ${label.slice(0, 60)}`
        );
        block.dataset.cpLastRadioValue = marker;
      }
      changed = true;
      return changed;
    }
  }

  if (isEntityListBlock) {
    const handledByCombobox = await applyComboboxOption(block, aiQuestionLabel, answer, settings);
    if (handledByCombobox) return true;
  }

  const checkbox = block.querySelector("input[type='checkbox']");
  if (checkbox && !checkbox.checked) {
    checkbox.click();
    await logLine(`Checkbox selected for: ${label.slice(0, 60)}`);
    return true;
  }
  return changed;
}

function collectValidationSignals(modal) {
  const text = normalizeLabel(modal?.textContent || "");
  const inline = getModalValidationMessage(modal);
  return {
    full: text,
    inline
  };
}

async function attemptValidationAutoFix(modal, settings) {
  const { full, inline } = collectValidationSignals(modal);
  let changed = false;

  const hasPhoneValidation =
    inline.includes("valid phone") ||
    full.includes("valid phone") ||
    full.includes("enter a valid phone number");
  if (hasPhoneValidation) {
    const phoneValue = normalizePhoneForInput(settings.phoneNumber || "");
    const telInput = getBySelectorList(["input[type='tel']", "input[aria-label*='phone']", "input[name*='phone']"], modal);
    if (telInput && phoneValue) {
      telInput.focus();
      telInput.value = phoneValue;
      telInput.dispatchEvent(new Event("input", { bubbles: true }));
      telInput.dispatchEvent(new Event("change", { bubbles: true }));
      changed = true;
      await debugLog(settings, "Auto-fixed phone validation", { phoneLength: phoneValue.length });
    }
  }

  const hasEmailValidation = inline.includes("valid email") || full.includes("enter a valid email");
  if (hasEmailValidation) {
    const email = String(settings.contactEmail || "").trim();
    const emailInput = getBySelectorList(["input[type='email']", "input[aria-label*='email']", "input[name*='email']"], modal);
    if (emailInput && email) {
      emailInput.focus();
      emailInput.value = email;
      emailInput.dispatchEvent(new Event("input", { bubbles: true }));
      emailInput.dispatchEvent(new Event("change", { bubbles: true }));
      changed = true;
      await debugLog(settings, "Auto-fixed email validation");
    }
  }

  const hasResumeValidation =
    inline.includes("resume is required") ||
    full.includes("resume is required") ||
    (inline.includes("resume") && inline.includes("required"));
  if (hasResumeValidation) {
    const blocks = collectQuestionBlocks(modal);
    for (const block of blocks) {
      const radios = Array.from(block.querySelectorAll("input[type='radio']"));
      if (!radios.length) continue;
      const options = radios.map((r) => ({
        text: getRadioOptionText(r, block),
        value: String(r.value || ""),
        input: r,
        clickTarget: getRadioClickTarget(r, block)
      }));
      const resumeTarget = getPreferredResumeOption(options, getQuestionLabel(block) || "resume");
      if (!resumeTarget) continue;
      const clicked = await resilientClick(resumeTarget.clickTarget || resumeTarget.input, "Resume option auto-fix");
      if (!clicked) continue;
      await sleep(220);
      changed = true;
      await debugLog(settings, "Auto-fixed resume validation", {
        option: truncateDebugText(resumeTarget.text || resumeTarget.value || "")
      });
      break;
    }
  }

  return changed;
}

async function forceAnswerModalQuestions(modal, settings) {
  if (!modal) return false;
  let changed = false;
  const aggressiveSettings = { ...settings, overwritePreviousAnswers: true };
  const blocks = collectQuestionBlocks(modal);
  for (const block of blocks) {
    const didChange = await fillQuestionBlock(block, aggressiveSettings);
    if (didChange) changed = true;
  }
  const selectedToday = await selectTodayDateIfPresent(modal);
  if (selectedToday) changed = true;
  return changed;
}

async function processEasyApplyModal(settings) {
  startTimer("processEasyApplyModal");
  await botChat("Processing application form. Filling in your details...");
  const modal = getActiveModal();
  if (!modal) {
    captureDebugEvent("modal", "MODAL_NOT_FOUND", { page: capturePageSnapshot() });
    return { submitted: false, skipped: true, reason: "No apply modal found" };
  }

  const isReady = await waitForModalReady(modal, 4500);
  if (!isReady) {
    await logLine("⚠️ Easy Apply modal stuck loading form fields (network/spinner hang). Skipping job...", "warn");
    return { submitted: false, skipped: true, reachedSubmit: false, reason: "Modal stuck loading (spinner timeout)" };
  }

  let activeSettings = {
    ...settings,
    screeningAnswers: { ...(settings?.screeningAnswers || {}) }
  };
  let safety = 0;
  let stagnantSteps = 0;
  const stepStateBySignature = new Map();
  const shouldPauseForInput = settings.pauseAtFailedQuestion !== false;
  const maxStagnantSteps = shouldPauseForInput ? 10 : 6;
  let previousSignature = getModalSignature(modal);
  while (safety < 16) {
    if (!await isRunActive()) {
      captureDebugEvent("modal", "RUN_STOPPED_BY_OPERATOR", { stepAttempt: safety, durationMs: endTimer("processEasyApplyModal") });
      return { submitted: false, skipped: true, reachedSubmit: false, reason: "Run stopped by operator" };
    }
    if (hasDailyEasyApplyLimitSignal(modal) || hasDailyEasyApplyLimitSignal(document)) {
      await pauseRunForDailyEasyApplyLimit(settings);
      return { submitted: false, skipped: true, reachedSubmit: false, reason: "LinkedIn daily Easy Apply limit reached" };
    }
    safety += 1;
    const questionBlocks = collectQuestionBlocks(modal);
    let changedAny = false;
    const filledThisStep = [];
    const beforeDiagnostics = collectQuestionBlockDiagnostics(modal);
    const unresolvedBefore = beforeDiagnostics.filter((d) => doesQuestionStateNeedAttention(d));
    await debugLog(settings, "Modal step coverage (before fill)", {
      stepAttempt: safety,
      totalBlocks: beforeDiagnostics.length,
      requiredBlocks: beforeDiagnostics.filter((d) => d.required).length,
      unresolvedRequired: unresolvedBefore.length,
      unresolvedFields: unresolvedBefore.slice(0, 10).map((d) => summarizeQuestionBlockState(d))
    });
    for (const block of questionBlocks) {
      const beforeState = settings?.debugMode ? getQuestionBlockState(block) : null;
      const changed = await fillQuestionBlock(block, activeSettings);
      if (changed) changedAny = true;
      if (settings?.debugMode) {
        const afterState = getQuestionBlockState(block);
        if (changed || (beforeState && !beforeState.answered && afterState.answered)) {
          filledThisStep.push(summarizeQuestionBlockState(afterState));
        }
      }
    }
    const todaySelected = await selectTodayDateIfPresent(modal);
    if (todaySelected) {
      changedAny = true;
      filledThisStep.push("date|required|answered|date picker -> today");
    }
    const consentChecked = await applySubmitConsentCheckboxes(modal, activeSettings);
    if (consentChecked) {
      changedAny = true;
      filledThisStep.push("checkbox|required|answered|submit consent");
    }
    const afterDiagnostics = collectQuestionBlockDiagnostics(modal);
    const unresolvedAfter = afterDiagnostics.filter((d) => doesQuestionStateNeedAttention(d));
    const unresolvedImproved = unresolvedAfter.length < unresolvedBefore.length;
    const unresolvedKnownAfter = unresolvedAfter.filter((d) => d.type !== "unknown");
    const unresolvedUnknownOnly = unresolvedAfter.length > 0 && unresolvedKnownAfter.length === 0;
    await debugLog(settings, "Modal step coverage (after fill)", {
      stepAttempt: safety,
      changedAny,
      filledThisStep: filledThisStep.slice(0, 12),
      totalBlocks: afterDiagnostics.length,
      requiredBlocks: afterDiagnostics.filter((d) => d.required).length,
      unresolvedRequired: unresolvedAfter.length,
      unresolvedFields: unresolvedAfter.slice(0, 12).map((d) => summarizeQuestionBlockState(d))
    });

    const stepSignature = getModalSignature(modal);
    const stepState = stepStateBySignature.get(stepSignature) || { preflightAttempts: 0, nextClicks: 0, manualAnswerWaits: 0 };
    const modalValidationBeforeActionRaw = getModalValidationMessageRaw(modal);
    const modalValidationBeforeAction = normalizeLabel(modalValidationBeforeActionRaw);
    const hasVisibleSubmit = Boolean(findSubmitButton(modal));
    const hasVisibleNext = Boolean(findNextOrReviewButton(modal, { includeDisabled: true }));
    const hasVisibleDone = Boolean(findDoneOrCloseButton(modal));

    await debugLog(settings, "Modal step plan", {
      stepAttempt: safety,
      signature: truncateDebugText(stepSignature, 120),
      preflightAttempts: stepState.preflightAttempts,
      nextClicks: stepState.nextClicks,
      manualAnswerWaits: stepState.manualAnswerWaits,
      unresolvedRequired: unresolvedAfter.length,
      unresolvedUnknownOnly,
      hasVisibleNext,
      hasVisibleSubmit,
      hasVisibleDone,
      validation: modalValidationBeforeAction || ""
    });

    // Progressive 4-Stage Resolution for Unresolved Required Questions
    if (unresolvedAfter.length > 0 && !unresolvedUnknownOnly) {
      if (changedAny && unresolvedImproved) {
        stepState.preflightAttempts += 1;
        stepStateBySignature.set(stepSignature, stepState);
        await debugLog(settings, "Preflight waiting after detected field updates", {
          preflightAttempts: stepState.preflightAttempts,
          unresolvedRequired: unresolvedAfter.length,
          unresolvedImproved
        });
        previousSignature = stepSignature;
        await sleep(Math.min(700, Math.floor(STEP_DELAY_MS * 0.7)));
        continue;
      }

      // ── TIER 1: Ask user in Dashboard & Wait up to 3 minutes (180s) ──
      if (stepState.manualAnswerWaits === 0 && shouldPauseForInput) {
        const pendingQuestions = buildPendingQuestionsFromDiagnostics(unresolvedAfter, modalValidationBeforeActionRaw);
        if (pendingQuestions.length > 0) {
          await sendMessage({ type: "CP_REGISTER_PENDING_QUESTIONS", questions: pendingQuestions });
          const firstLabel = pendingQuestions[0].questionLabel || "Required field";
          await logLine(
            `⏳ Unresolved question: "${firstLabel.slice(0, 55)}". Please answer in Dashboard (Jobs). Waiting 3 minutes...`,
            "warn"
          );
          stepState.manualAnswerWaits += 1;
          stepStateBySignature.set(stepSignature, stepState);

          const waitResult = await waitForPendingAnswersFromSettings(pendingQuestions, 180000, 1500);
          if (waitResult.ok) {
            activeSettings.screeningAnswers = { ...activeSettings.screeningAnswers, ...waitResult.screeningAnswers };
            await logLine("✅ Received user answers from Dashboard! Applying to form...", "info");
            for (const block of questionBlocks) {
              await fillQuestionBlock(block, activeSettings);
            }
            previousSignature = getModalSignature(modal);
            await sleep(350);
            continue;
          } else {
            await logLine("⏱️ 3-minute dashboard wait elapsed. Attempting AI contextual & resume relation matching...", "info");
          }
        }
      }

      // ── TIER 2: Contextual AI & Resume Relationship Match ──
      let aiResolvedAny = false;
      for (const block of questionBlocks) {
        const state = getQuestionBlockState(block);
        if (state && doesQuestionStateNeedAttention(state)) {
          const aiLabel = state.label || getQuestionLabel(block);
          if (aiLabel) {
            const aiAnswer = await requestAiAnswer(aiLabel, state.type, state.options || [], modalValidationBeforeActionRaw);
            if (aiAnswer) {
              activeSettings.screeningAnswers[questionKeyFromLabel(aiLabel)] = aiAnswer;
              activeSettings.screeningAnswers[normalizeLabel(aiLabel)] = aiAnswer;
              const changed = await fillQuestionBlock(block, activeSettings);
              if (changed) {
                aiResolvedAny = true;
                await logLine(`🤖 AI Auto-Answered from Resume: "${aiLabel.slice(0, 45)}" ➔ ${aiAnswer}`, "info");
              }
            }
          }
        }
      }

      if (aiResolvedAny) {
        stagnantSteps = 0;
        previousSignature = getModalSignature(modal);
        await sleep(350);
        continue;
      }

      // ── TIER 3: Fallback / Positive Match / Default Valid Selection ──
      const preflightAggressiveFill = await forceAnswerModalQuestions(modal, activeSettings);
      const preflightAutoFixed = await attemptValidationAutoFix(modal, activeSettings);
      if (preflightAggressiveFill || preflightAutoFixed) {
        stepState.preflightAttempts += 1;
        stepStateBySignature.set(stepSignature, stepState);
        await logLine("Applied best fallback option for remaining required fields.", "warn");
        previousSignature = getModalSignature(modal);
        await sleep(Math.min(700, Math.floor(STEP_DELAY_MS * 0.7)));
        continue;
      }

      // ── TIER 4: Preflight DOM registration pass ──
      stepState.preflightAttempts += 1;
      stepStateBySignature.set(stepSignature, stepState);
      if (stepState.preflightAttempts <= 2) {
        previousSignature = stepSignature;
        await sleep(Math.min(700, Math.floor(STEP_DELAY_MS * 0.7)));
        continue;
      }
    } else if (unresolvedUnknownOnly) {
      await debugLog(settings, "Unresolved fields are unknown type; proceeding to action button to trigger explicit validation", {
        unresolvedRequired: unresolvedAfter.length,
        unresolvedFields: unresolvedAfter.slice(0, 8).map((d) => summarizeQuestionBlockState(d))
      });
    }

    const submitBtn = findSubmitButton(modal);
    if (submitBtn) {
      await applyFollowCompanyPreference(modal, activeSettings);
      if (!settings.dryRun && settings.pauseBeforeSubmit) {
        await logLine("Paused before submit. Review the form, submit manually, then resume run.", "warn");
        captureDebugEvent("modal", "PAUSED_BEFORE_SUBMIT", { stepAttempt: safety, reason: "pauseBeforeSubmit", durationMs: endTimer("processEasyApplyModal") });
        await sendMessage({ type: "CP_PAUSE" });
        return {
          submitted: false,
          skipped: true,
          reachedSubmit: true,
          reason: "Paused before submit for manual review"
        };
      }
      if (!settings.dryRun && !settings.autoSubmit) {
        await logLine("Auto-submit is OFF. Paused at submit step. Submit manually, then resume run.", "warn");
        captureDebugEvent("modal", "AUTO_SUBMIT_DISABLED", { stepAttempt: safety, durationMs: endTimer("processEasyApplyModal") });
        await sendMessage({ type: "CP_PAUSE" });
        return {
          submitted: false,
          skipped: true,
          reachedSubmit: true,
          reason: "Paused before submit because auto-submit is disabled"
        };
      }
      if (!settings.dryRun && settings.autoSubmit) {
        await botChat("Ready to submit. Verifying all fields...");
        await sleep(500);
        const paced = await enforceSubmitRateLimit(activeSettings);
        if (!paced.ok) {
          captureDebugEvent("modal", "RATE_LIMIT_WAIT_PAUSED", { stepAttempt: safety, durationMs: endTimer("processEasyApplyModal") });
          return {
            submitted: false,
            skipped: true,
            reachedSubmit: true,
            reason: "Run paused/stopped during rate limit wait"
          };
        }
        const clicked = await resilientClick(submitBtn, "Submit");
        lastAutoSubmitAtMs = Date.now();
        writePersistedNumber("cpLastAutoSubmitAtMs", lastAutoSubmitAtMs);
        activeSubmitPaceDelayMs = 0;
        activeSubmitPaceStartMs = 0;
        await sleep(STEP_DELAY_MS);
        const submitCompleted = didSubmitComplete(modal);
        if (submitCompleted) {
          await logLine("Application submitted", "info");
          await botChat("Application submitted successfully! Moving to next opportunity...");
          captureDebugEvent("modal", "SUBMIT_SUCCESS", { stepAttempt: safety, durationMs: endTimer("processEasyApplyModal") });
          await closePostSubmitUi(settings, { discardDraft: false });
          return { submitted: true, skipped: false, reachedSubmit: true };
        }
        const submitValidationRaw = getModalValidationMessageRaw(getActiveModal() || modal);
        const submitValidation = normalizeLabel(submitValidationRaw);
        const unresolvedAfterSubmit = collectQuestionBlockDiagnostics(getActiveModal() || modal)
          .filter((d) => doesQuestionStateNeedAttention(d));
        await debugLog(settings, "Submit click did not complete application", {
          clicked,
          validation: submitValidationRaw || submitValidation,
          unresolvedRequired: unresolvedAfterSubmit.length,
          unresolvedFields: unresolvedAfterSubmit.slice(0, 12).map((d) => summarizeQuestionBlockState(d))
        });
        const submitFixedValidation = await attemptValidationAutoFix(getActiveModal() || modal, activeSettings);
        const submitForcedAnswers = await forceAnswerModalQuestions(getActiveModal() || modal, activeSettings);
        if (submitFixedValidation || submitForcedAnswers) {
          await logLine("Submit was blocked. Filled remaining fields and retrying submit.", "warn");
          captureDebugEvent("modal", "SUBMIT_RETRY_AFTER_FIX", { stepAttempt: safety, fixedValidation: submitFixedValidation, forcedAnswers: submitForcedAnswers });
          stagnantSteps = 0;
          previousSignature = getModalSignature(getActiveModal() || modal);
          continue;
        }
        return {
          submitted: false,
          skipped: true,
          reachedSubmit: true,
          reason: submitValidationRaw || submitValidation || "Submit click did not complete application"
        };
      }
      captureDebugEvent("modal", "DRY_RUN_REACHED_SUBMIT", { stepAttempt: safety, durationMs: endTimer("processEasyApplyModal") });
      await logLine("Dry-run: reached submit step (not submitting). Use 'start live' to submit for real.", "warn");
      await botChat("Dry run complete for this job. Form filled successfully.");
      await closePostSubmitUi(settings, { discardDraft: true });
      return { submitted: false, skipped: false, reachedSubmit: true };
    }

    const nextBtn = findNextOrReviewButton(modal);
    if (!nextBtn) {
      const blockedNextBtn = findNextOrReviewButton(modal, { includeDisabled: true });
      if (blockedNextBtn) {
        const validationRaw = getModalValidationMessageRaw(modal);
        const blockedFixedValidation = await attemptValidationAutoFix(modal, activeSettings);
        const blockedForcedAnswers = await forceAnswerModalQuestions(modal, activeSettings);
        if (blockedFixedValidation || blockedForcedAnswers) {
          await logLine("Next step was blocked. Filled remaining fields and retrying.", "warn");
          captureDebugEvent("modal", "NEXT_BLOCKED_RETRY", { stepAttempt: safety });
          stagnantSteps = 0;
          previousSignature = getModalSignature(modal);
          continue;
        }
        return {
          submitted: false,
          skipped: true,
          reachedSubmit: false,
          reason: validationRaw || "Next/review button is disabled"
        };
      }
      const doneBtn = findDoneOrCloseButton(modal);
      if (doneBtn) {
        captureDebugEvent("modal", "DONE_CLOSE_CLICKED", { stepAttempt: safety, durationMs: endTimer("processEasyApplyModal") });
        await resilientClick(doneBtn, "Done/Close");
        return {
          submitted: Boolean(settings.autoSubmit && !settings.dryRun),
          skipped: false,
          reachedSubmit: true
        };
      }
      const validationRaw = getModalValidationMessageRaw(modal);
      captureDebugEvent("modal", "NO_ACTION_BUTTON", {
        stepAttempt: safety,
        hasVisibleSubmit: Boolean(findSubmitButton(modal)),
        validation: validationRaw || "",
        durationMs: endTimer("processEasyApplyModal"),
        ...capturePageSnapshot()
      });
      return {
        submitted: false,
        skipped: true,
        reachedSubmit: false,
        reason: validationRaw ? `No next/review button. Validation: ${validationRaw}` : "No next/review button"
      };
    }

    await debugLog(settings, "Clicking modal action", {
      text: normalizeLabel(nextBtn.textContent || ""),
      ariaLabel: normalizeLabel(nextBtn.getAttribute("aria-label") || ""),
      disabled: Boolean(nextBtn.disabled)
    });
    stepState.nextClicks += 1;
    stepStateBySignature.set(stepSignature, stepState);
    if (!await resilientClick(nextBtn, "Next/Review")) break;
    await sleep(STEP_DELAY_MS);

    const currentSignature = getModalSignature(modal);
    const autoFixed = await attemptValidationAutoFix(modal, activeSettings);
    if (!changedAny && !autoFixed && currentSignature === previousSignature) {
      stagnantSteps += 1;
      const validationRaw = getModalValidationMessageRaw(modal);
      const validation = normalizeLabel(validationRaw);
      const postClickDiagnostics = collectQuestionBlockDiagnostics(modal);
      const unresolvedPostClick = postClickDiagnostics.filter((d) => doesQuestionStateNeedAttention(d));
      await debugLog(settings, "No modal progress detected", {
        stagnantSteps,
        validation: validationRaw || validation,
        unresolvedRequired: unresolvedPostClick.length,
        unresolvedFields: unresolvedPostClick.slice(0, 12).map((d) => summarizeQuestionBlockState(d))
      });
      if (stagnantSteps >= 2) {
        const aggressiveChanged = await forceAnswerModalQuestions(modal, activeSettings);
        if (aggressiveChanged) {
          await logLine("Applied aggressive fallback answers and retrying next step.", "warn");
          stagnantSteps = 0;
          previousSignature = getModalSignature(modal);
          continue;
        }
      }
      if (stagnantSteps >= maxStagnantSteps) {
        const validationNorm = normalizeLabel(validationRaw || validation || "");
        const blockedDiagnostics = collectQuestionBlockDiagnostics(modal);
        const unresolvedBlocked = blockedDiagnostics.filter((d) => doesQuestionStateNeedAttention(d));
        await debugLog(settings, "Modal blocked at step", {
          stagnantSteps,
          validation: validationRaw || validation,
          unresolvedRequired: unresolvedBlocked.length,
          unresolvedFields: unresolvedBlocked.slice(0, 16).map((d) => summarizeQuestionBlockState(d))
        });
        if (validationNorm.includes("resume") && validationNorm.includes("required")) {
          captureDebugEvent("modal", "RESUME_REQUIRED", { stepAttempt: safety, validation: validationRaw || "", durationMs: endTimer("processEasyApplyModal") });
          if (shouldPauseForInput) {
            await sendMessage({
              type: "CP_REGISTER_PENDING_QUESTIONS",
              questions: [
                {
                  questionKey: "resume_upload_required",
                  questionLabel: "LinkedIn resume upload required",
                  validationMessage:
                    "A resume is required. Upload resume in LinkedIn Easy Apply profile. Copilot will auto-pick the latest attached resume after you resume."
                }
              ]
            });
            await logLine(
              "Resume required: upload resume in LinkedIn Easy Apply profile, then resume run. Copilot will auto-pick the latest attached resume.",
              "warn"
            );
            await sendMessage({ type: "CP_PAUSE" });
          } else {
            await logLine("Resume required and pause-at-failed-question is disabled. Skipping job.", "warn");
          }
          return {
            submitted: false,
            skipped: true,
            reachedSubmit: false,
            reason: "a resume is required"
          };
        }

        const unanswered = buildPendingQuestionsFromValidation(modal, validationRaw || "Required field answer missing");
        if (unanswered.length) {
          await sendMessage({ type: "CP_REGISTER_PENDING_QUESTIONS", questions: unanswered });
          await logLine("Unresolved required fields after all retry tiers. Skipping to next job...", "warn");
        }
        captureDebugEvent("modal", "UNANSWERED_FIELDS_SKIPPED", {
          stepAttempt: safety,
          stagnantSteps,
          validation: validationRaw || validation || "",
          unansweredCount: unanswered.length,
          durationMs: endTimer("processEasyApplyModal")
        });
        return {
          submitted: false,
          skipped: true,
          reachedSubmit: false,
          reason: validationRaw || validation || "Could not progress modal (likely unanswered required field)"
        };
      }
    } else {
      stagnantSteps = 0;
    }
    previousSignature = currentSignature;
  }

  captureDebugEvent("modal", "LOOP_EXHAUSTED", { totalSteps: safety, durationMs: endTimer("processEasyApplyModal") });
  return { submitted: false, skipped: true, reachedSubmit: false, reason: "Could not reach submit step" };
}

async function runCycle(settings) {
  startTimer("runCycle");
  captureDebugEvent("cycle", "CYCLE_START", { url: window.location.href, isJobsPage: isJobsPage(), isViewPage: isJobsViewPage() });
  if (hasDailyEasyApplyLimitSignal()) {
    captureDebugEvent("cycle", "DAILY_LIMIT_REACHED", { durationMs: endTimer("runCycle") });
    await pauseRunForDailyEasyApplyLimit(settings, "LinkedIn daily submission limit reached while scanning jobs");
    return false;
  }
  if (!isJobsPage()) {
    captureDebugEvent("cycle", "LEFT_JOBS_PAGE", { durationMs: endTimer("runCycle") });
    await logLine("Left jobs page. Pausing run.", "warn");
    return false;
  }
  if (isPostApplySearchPage()) {
    const cleanUrl = getResumableSearchUrl(settings);
    window.history.replaceState(null, "", cleanUrl);
    const hasCardsInDom = document.querySelectorAll(".job-card-container, [data-occludable-job-id], li.jobs-search-results__list-item").length > 0;
    if (!hasCardsInDom) {
      captureDebugEvent("cycle", "POST_APPLY_REDIRECT", { durationMs: endTimer("runCycle"), path: window.location.pathname });
      await debugLog(settings, "Detected post-apply page without cards in DOM; returning to search", { path: window.location.pathname });
      resetRemoteLocationKeywordCursor();
      window.location.href = cleanUrl;
      return false;
    }
  }

  if (normalizeSearchUrlWithoutReload(settings)) {
    await debugLog(settings, "Normalized sticky search URL during run cycle", {
      url: window.location.href
    });
  }

  await refreshKnownAppliedJobIds(false);
  const cycleStartApplied = runStats.applied;
  let cycleConsideredCandidates = 0;
  let cycleExhaustedCandidates = 0;
  let cycleHadActionableCandidate = false;

  if (isJobsViewPage()) {
    const resumeSearchUrl = getResumableSearchUrl(settings);
    await debugLog(settings, "Running from jobs view page");
    const viewDescription = getJobDescriptionText();
    const aboutCompany = getAboutCompanyText();
    currentJobContext = {
      ...currentJobContext,
      title: String(document.querySelector("h1")?.textContent || "").trim(),
      company: String(document.querySelector(".jobs-unified-top-card__company-name, .jobs-details-top-card__company-url")?.textContent || "").trim(),
      description: viewDescription,
      aboutCompany,
      jobUrl: buildCanonicalLinkedInJobUrl(
        window.location.href.match(/\/jobs\/view\/(\d+)/)?.[1] || extractLinkedInJobIdFromUrl(window.location.href),
        window.location.href
      ),
      jobId: (window.location.href.match(/\/jobs\/view\/(\d+)/)?.[1] || "")
    };
    const viewJobKey = String(currentJobContext.jobId || "").trim();
    if (viewJobKey && runSeenJobKeys.has(viewJobKey)) {
      await debugLog(settings, "Skipping already-seen jobs view in this run", { jobKey: viewJobKey });
      window.location.href = resumeSearchUrl;
      return false;
    }
    if (viewJobKey && knownAppliedJobIds.has(viewJobKey)) {
      await debugLog(settings, "Skipping jobs view from known applied ids", { jobKey: viewJobKey });
      runStats.skipped += 1;
      await logOutcome("info", "Skipped (already applied earlier)", "APPLIED_CACHE_HIT");
      await recordOutcome("SKIPPED", {
        reasonCode: "APPLIED_CACHE_HIT",
        reason: "Known applied job id cache hit",
        ...currentJobContext
      });
      recordJobOutcomeCache(viewJobKey, "SKIPPED", "ALREADY_APPLIED");
      markKnownApplied(viewJobKey);
      await reportProgress();
      markJobSeen(viewJobKey);
      window.location.href = resumeSearchUrl;
      return true;
    }
    const cachedViewOutcome = getCachedJobOutcome(viewJobKey);
    const viewAlreadyAppliedCacheHit = isAppliedCacheHit(cachedViewOutcome);
    if (viewAlreadyAppliedCacheHit) {
      runStats.skipped += 1;
      await logOutcome("info", "Skipped (already applied earlier)", "APPLIED_CACHE_HIT");
      await recordOutcome("SKIPPED", {
        reasonCode: "APPLIED_CACHE_HIT",
        reason: "Applied cache hit from local outcome cache",
        ...currentJobContext
      });
      recordJobOutcomeCache(viewJobKey, "SKIPPED", "ALREADY_APPLIED");
      markKnownApplied(viewJobKey);
      await reportProgress();
      markJobSeen(viewJobKey);
      window.location.href = resumeSearchUrl;
      return true;
    }
    if (cachedViewOutcome && isTransientSkipCooldownOutcome(cachedViewOutcome)) {
      await debugLog(settings, "Skipping jobs view from temporary cooldown cache", {
        jobKey: viewJobKey,
        reasonCode: cachedViewOutcome.reasonCode,
      });
      await logLine("Deferred retry for recently attempted job (cooldown active).", "info");
      markJobSeen(viewJobKey);
      window.location.href = resumeSearchUrl;
      return true;
    }
    const viewAboutCompanyDecision = shouldSkipByAboutCompany(currentJobContext.aboutCompany, settings);
    if (viewAboutCompanyDecision.skip) {
      runStats.skipped += 1;
      await logOutcome("warn", `Skipped: ${viewAboutCompanyDecision.reason}`, viewAboutCompanyDecision.reasonCode);
      await recordOutcome("SKIPPED", {
        reasonCode: viewAboutCompanyDecision.reasonCode,
        reason: viewAboutCompanyDecision.reason,
        ...currentJobContext
      });
      recordJobOutcomeCache(viewJobKey, "SKIPPED", viewAboutCompanyDecision.reasonCode);
      await reportProgress();
      markJobSeen(viewJobKey);
      window.location.href = resumeSearchUrl;
      return true;
    }
    const viewDescriptionDecision = shouldSkipByDescription(currentJobContext.description, settings);
    if (viewDescriptionDecision.skip) {
      runStats.skipped += 1;
      await logOutcome("warn", `Skipped: ${viewDescriptionDecision.reason}`, viewDescriptionDecision.reasonCode);
      await recordOutcome("SKIPPED", {
        reasonCode: viewDescriptionDecision.reasonCode,
        reason: viewDescriptionDecision.reason,
        ...currentJobContext
      });
      recordJobOutcomeCache(viewJobKey, "SKIPPED", viewDescriptionDecision.reasonCode);
      await reportProgress();
      markJobSeen(viewJobKey);
      window.location.href = resumeSearchUrl;
      return true;
    }
    let applyAction = await waitForApplyButtonFromDetailPane(settings, 9000, "jobs view");
    if (applyAction.type === "none" || !applyAction.button) {
      await sleep(650);
      applyAction = await waitForApplyButtonFromDetailPane(settings, 3000, "jobs view recovery");
    }
    if (applyAction.type === "none" || !applyAction.button) {
      await refreshKnownAppliedJobIds(true);
      if (viewJobKey && knownAppliedJobIds.has(viewJobKey)) {
        runStats.skipped += 1;
        await logOutcome("info", "Skipped (already applied earlier)", "APPLIED_CACHE_HIT");
        await recordOutcome("SKIPPED", {
          reasonCode: "APPLIED_CACHE_HIT",
          reason: "Re-checked after missing apply button; job already applied",
          ...currentJobContext
        });
        recordJobOutcomeCache(viewJobKey, "SKIPPED", "ALREADY_APPLIED");
        markKnownApplied(viewJobKey);
        await reportProgress();
        markJobSeen(viewJobKey);
        window.location.href = resumeSearchUrl;
        return true;
      }
      if (hasDailyEasyApplyLimitSignal()) {
        await pauseRunForDailyEasyApplyLimit(settings);
        return false;
      }
      runStats.skipped += 1;
      await logOutcome("warn", "No Apply button on current job view", "NO_APPLY_BUTTON");
      await recordOutcome("SKIPPED", {
        reasonCode: "NO_APPLY_BUTTON",
        reason: "No apply button on jobs view",
        ...currentJobContext
      });
      recordJobOutcomeCache(viewJobKey, "SKIPPED", "NO_APPLY_BUTTON");
      await reportProgress();
      markJobSeen(viewJobKey);
      await debugLog(settings, "Recovering from jobs view without apply button", {
        jobKey: viewJobKey || undefined,
        redirectUrl: resumeSearchUrl
      });
      window.location.href = resumeSearchUrl;
      return true;
    }
    if (applyAction.type === "external") {
      if (settings.easyApplyOnly) {
        runStats.skipped += 1;
        await logOutcome("warn", "Skipped (external apply)", "EXTERNAL_APPLY_ONLY");
        await recordOutcome("SKIPPED", {
          reasonCode: "EXTERNAL_APPLY_ONLY",
          reason: "External apply blocked because easyApplyOnly is enabled",
          ...currentJobContext
        });
        recordJobOutcomeCache(viewJobKey, "SKIPPED", "EXTERNAL_APPLY_ONLY");
      } else {
        await resilientClick(applyAction.button, "External Apply");
        runStats.skipped += 1;
        runSearchTermSuccessCount += 1;
        await logOutcome("info", "Opened external apply link (manual completion required)", "EXTERNAL_APPLY_OPENED");
        await recordOutcome("EXTERNAL", {
          reasonCode: "EXTERNAL_APPLY_OPENED",
          reason: "External apply opened",
          ...currentJobContext
        });
        recordJobOutcomeCache(viewJobKey, "EXTERNAL", "EXTERNAL_APPLY_OPENED");
      }
      await reportProgress();
      markJobSeen(viewJobKey);
      return true;
    }
    await resilientClick(applyAction.button, "Easy Apply");
    const modal = await waitForModalOpen(4500);
    if (!modal) {
      if (hasDailyEasyApplyLimitSignal()) {
        await pauseRunForDailyEasyApplyLimit(settings);
        return false;
      }
      runStats.skipped += 1;
      await logOutcome("warn", "Skipped: Easy Apply click did not open modal", "MODAL_NOT_FOUND");
      await recordOutcome("SKIPPED", {
        reasonCode: "MODAL_NOT_FOUND",
        reason: "Easy Apply modal not found",
        ...currentJobContext
      });
      recordJobOutcomeCache(viewJobKey, "SKIPPED", "MODAL_NOT_FOUND");
      await reportProgress();
      markJobSeen(viewJobKey);
      window.location.href = resumeSearchUrl;
      return true;
    }
    await sleep(400);
    const resultFromView = await processEasyApplyModal(settings);
    await debugLog(settings, "Modal result (view page)", resultFromView);
    if (resultFromView.submitted || (settings.dryRun && resultFromView.reachedSubmit)) {
      runStats.applied += 1;
      runSearchTermSuccessCount += 1;
      await recordOutcome("APPLIED", {
        reasonCode: settings.dryRun ? "DRY_RUN_REACHED_SUBMIT" : "SUBMITTED",
        reason: settings.dryRun ? "Dry-run reached submit stage" : "Application submitted",
        ...currentJobContext
      });
      recordJobOutcomeCache(viewJobKey, "APPLIED", "SUBMITTED");
      markKnownApplied(viewJobKey);
    } else if (resultFromView.skipped) {
      runStats.skipped += 1;
      if (resultFromView.reason) await logLine(`Skipped: ${resultFromView.reason}`, "warn");
      await recordOutcome("SKIPPED", {
        reasonCode: "VIEW_MODAL_SKIPPED",
        reason: resultFromView.reason || "Modal flow skipped",
        ...currentJobContext
      });
      recordJobOutcomeCache(viewJobKey, "SKIPPED", "VIEW_MODAL_SKIPPED");
    } else {
      runStats.failed += 1;
      await recordOutcome("FAILED", {
        reasonCode: "VIEW_MODAL_FAILED",
        reason: resultFromView.reason || "Modal flow failed",
        ...currentJobContext
      });
      recordJobOutcomeCache(viewJobKey, "FAILED", "VIEW_MODAL_FAILED");
    }
    await reportProgress();
    markJobSeen(viewJobKey);
    return true;
  }

  let cards = await loadAllJobCardsOnPage(settings);
  await debugLog(settings, "Selector diagnostics", {
    jobCardContainer: document.querySelectorAll(".job-card-container").length,
    occludable: document.querySelectorAll("[data-occludable-job-id]").length,
    listItems: document.querySelectorAll("li.jobs-search-results__list-item").length,
    jobAnchors: document.querySelectorAll("a[href*='/jobs/view/']").length,
    cards: cards.length,
    path: window.location.pathname
  });
  if (!cards.length) {
    exhaustedSearchPageStreak = 0;
    captureDebugEvent("cycle", "NO_CARDS_FOUND", { durationMs: endTimer("runCycle") });
    await logLine("No jobs found on current page", "warn");
    const rotatedRemoteLocation = await rotateRemoteLocationKeyword(settings);
    if (rotatedRemoteLocation) return true;
    const broadenedDate = await relaxDatePostedForEmptyResults(settings);
    if (broadenedDate) return true;
    const scrollRoot =
      document.querySelector(".jobs-search-results-list") ||
      document.querySelector(".scaffold-layout__list-detail-inner") ||
      document.scrollingElement ||
      document.body;
    if (scrollRoot && typeof scrollRoot.scrollBy === "function") {
      scrollRoot.scrollBy({ top: 900, behavior: "smooth" });
    } else {
      window.scrollBy({ top: 900, behavior: "smooth" });
    }
    await sleep(900);
    const movedToNextPage = await gotoNextResultsPage(settings);
    if (movedToNextPage) return true;
    const movedToNextTerm = await rotateSearchTerm(settings);
    if (movedToNextTerm) return true;
    return false;
  }

  await logLine(`Found ${cards.length} job cards`);
  await botChat(`Found ${cards.length} jobs. Analyzing each one for the best fit...`);
  let cardsToProcess = cards;
  if (settings.easyApplyOnly) {
    const easyApplyCards = cards.filter((card) => hasEasyApplySignalOnCard(card));
    if (easyApplyCards.length > 0 && easyApplyCards.length < cards.length) {
      cardsToProcess = easyApplyCards;
      await logLine(`Easy Apply candidates: ${easyApplyCards.length}/${cards.length}`);
    } else if (easyApplyCards.length === 0) {
      await debugLog(settings, "No explicit Easy Apply badge on cards; processing all cards as fallback", {
        cards: cards.length,
      });
    }
  }

  for (const card of cardsToProcess) {
    const state = (await sendMessage({ type: "CP_GET_BOOTSTRAP" })).state;
    if (!state.running || state.paused) return false;

    const targetApplyLimit = Math.max(1, Number(settings.maxApplicationsPerRun || 10));
    if (runStats.applied >= targetApplyLimit) {
      await logLine(`Reached target application goal (${runStats.applied}/${targetApplyLimit} applied). Run complete.`, "info");
      await botChat(`Target goal of ${targetApplyLimit} applications completed! Pausing.`);
      await sendMessage({ type: "CP_PAUSE" });
      return false;
    }

    let jobKey = getJobKeyFromCard(card);
    if (!jobKey) {
      await debugLog(settings, "Skipping card without stable job id", {
        title: String(getCardAnchor(card)?.textContent || "").trim(),
      });
      continue;
    }

    const cardMeta = extractCardMeta(card);
    const candidateTitle = cardMeta.titleRaw || "Job Candidate";
    await logLine(`[Candidate] Evaluating: "${candidateTitle}" (${cardMeta.companyRaw || 'Company'})`, "info");
    highlightActiveJobCard(card, `AI Checking: ${candidateTitle.slice(0, 30)}`);

    const jobAliasKeys = new Set([jobKey]);
    const recordOutcomeCacheForAliases = (status, reasonCode = "") => {
      for (const alias of jobAliasKeys) {
        recordJobOutcomeCache(alias, status, reasonCode);
      }
    };
    const markSeenForAliases = () => {
      for (const alias of jobAliasKeys) {
        markJobSeen(alias);
      }
    };
    const markAppliedForAliases = () => {
      for (const alias of jobAliasKeys) {
        markKnownApplied(alias);
      }
    };
    let cardClassifiedForCycle = false;
    const classifyExhaustedCandidate = () => {
      if (cardClassifiedForCycle) return;
      cardClassifiedForCycle = true;
      cycleConsideredCandidates += 1;
      cycleExhaustedCandidates += 1;
    };
    const classifyActionableCandidate = () => {
      if (cardClassifiedForCycle) return;
      cardClassifiedForCycle = true;
      cycleConsideredCandidates += 1;
      cycleHadActionableCandidate = true;
    };

    if (jobKey && runSeenJobKeys.has(jobKey)) {
      await debugLog(settings, "Skipping already-seen card in this run", { jobKey });
      continue;
    }
    if (jobKey && knownAppliedJobIds.has(jobKey)) {
      classifyExhaustedCandidate();
      await debugLog(settings, "Skipping job from known applied ids", { jobKey });
      runStats.skipped += 1;
      markJobCardStatus(card, "skipped", "Already Applied");
      await logOutcome("info", "Skipped (already applied earlier)", "APPLIED_CACHE_HIT");
      await recordOutcome("SKIPPED", {
        reasonCode: "APPLIED_CACHE_HIT",
        reason: "Known applied job id cache hit",
        jobId: jobKey,
        ...cardMeta
      });
      recordOutcomeCacheForAliases("SKIPPED", "ALREADY_APPLIED");
      markAppliedForAliases();
      await reportProgress();
      markSeenForAliases();
      continue;
    }
    const cachedOutcome = getCachedJobOutcome(jobKey);
    const alreadyAppliedCacheHit = isAppliedCacheHit(cachedOutcome);
    if (alreadyAppliedCacheHit) {
      classifyExhaustedCandidate();
      await debugLog(settings, "Skipping job from applied cache", { jobKey, reasonCode: cachedOutcome.reasonCode });
      runStats.skipped += 1;
      markJobCardStatus(card, "skipped", "Already Applied");
      await logOutcome("info", "Skipped (already applied earlier)", "APPLIED_CACHE_HIT");
      await recordOutcome("SKIPPED", {
        reasonCode: "APPLIED_CACHE_HIT",
        reason: "Applied cache hit from local outcome cache",
        jobId: jobKey,
        ...cardMeta
      });
      recordOutcomeCacheForAliases("SKIPPED", "ALREADY_APPLIED");
      markAppliedForAliases();
      await reportProgress();
      markSeenForAliases();
      continue;
    }
    if (cachedOutcome && isTransientSkipCooldownOutcome(cachedOutcome)) {
      classifyExhaustedCandidate();
      await debugLog(settings, "Skipping job from temporary cooldown cache", {
        jobKey,
        reasonCode: cachedOutcome.reasonCode,
      });
      markJobCardStatus(card, "skipped", "Cooldown");
      await logLine("Deferred retry for recently attempted job (cooldown active).", "info");
      markSeenForAliases();
      continue;
    }
    if (isAlreadyAppliedCard(card)) {
      classifyExhaustedCandidate();
      const stableJobId = jobKey || extractLinkedInJobIdFromUrl(getCardAnchor(card)?.href) || "";
      if (stableJobId) jobAliasKeys.add(stableJobId);
      runStats.skipped += 1;
      markJobCardStatus(card, "skipped", "Already Applied");
      await logOutcome("info", "Skipped (already applied)", "ALREADY_APPLIED");
      await recordOutcome("SKIPPED", {
        reasonCode: "ALREADY_APPLIED",
        reason: "LinkedIn card marked as already applied",
        jobId: stableJobId,
        ...cardMeta
      });
      recordOutcomeCacheForAliases("SKIPPED", "ALREADY_APPLIED");
      markAppliedForAliases();
      await dismissJobCard(card);
      await reportProgress();
      markSeenForAliases();
      continue;
    }
    const ruleDecision = shouldSkipByRules(card, settings);
    if (ruleDecision.skip) {
      classifyActionableCandidate();
      runStats.skipped += 1;
      markJobCardStatus(card, "skipped", ruleDecision.reasonCode);
      await logOutcome("warn", `Skipped: ${ruleDecision.reason}`, ruleDecision.reasonCode);
      await recordOutcome("SKIPPED", {
        reasonCode: ruleDecision.reasonCode,
        reason: ruleDecision.reason,
        jobId: jobKey,
        ...cardMeta
      });
      recordOutcomeCacheForAliases("SKIPPED", ruleDecision.reasonCode);
      await dismissJobCard(card);
      await reportProgress();
      markSeenForAliases();
      continue;
    }

    const anchor = getCardAnchor(card);
    const title = cardMeta.titleRaw || anchor?.textContent?.trim() || card.textContent?.trim()?.slice(0, 80) || "Job";
    const previousJobContext = { ...currentJobContext };
    await debugLog(settings, "Processing card", { title, company: cardMeta.companyRaw || cardMeta.company || "" });
    highlightActiveJobCard(card, "Opening Details...");
    highlightDetailPane(title);
    await logLine(`Opening: ${title}`);
    await botChat(`Reading job details for "${title}"...`);
    await sleep(400);
    await selectJobCardInSearchList(card);
    await sleep(1200);
    const detailSnapshot = await waitForDetailPaneRefresh(cardMeta, previousJobContext, 4800);

    // After navigation/selection, re-derive a stable LinkedIn job id from the current URL.
    const resolvedJobId = detailSnapshot.jobId || extractLinkedInJobIdFromUrl(window.location.href);
    if (resolvedJobId && resolvedJobId !== jobKey) {
      await debugLog(settings, "Resolved job id differs from card key", { from: jobKey, to: resolvedJobId });
      jobAliasKeys.add(resolvedJobId);
      jobKey = resolvedJobId;
    }

    const description = detailSnapshot.description || "";
    const aboutCompany = detailSnapshot.aboutCompany || "";
    const detailUrl = detailSnapshot.url || window.location.href;
    const canonicalJobUrl = buildCanonicalLinkedInJobUrl(resolvedJobId || jobKey, anchor?.href || detailUrl);
    currentJobContext = {
      title: detailSnapshot.title || title,
      company: detailSnapshot.company || cardMeta.companyRaw || cardMeta.company || "",
      workLocation: cardMeta.workLocationRaw || cardMeta.workLocation || "",
      description,
      aboutCompany,
      jobId: jobKey || "",
      jobUrl: canonicalJobUrl
    };

    const aboutCompanyDecision = shouldSkipByAboutCompany(aboutCompany, settings);
    if (aboutCompanyDecision.skip) {
      classifyActionableCandidate();
      runStats.skipped += 1;
      await logOutcome("warn", `Skipped: ${aboutCompanyDecision.reason}`, aboutCompanyDecision.reasonCode);
      await recordOutcome("SKIPPED", {
        reasonCode: aboutCompanyDecision.reasonCode,
        reason: aboutCompanyDecision.reason,
        ...currentJobContext
      });
      recordOutcomeCacheForAliases("SKIPPED", aboutCompanyDecision.reasonCode);
      await dismissJobCard(card);
      await reportProgress();
      markSeenForAliases();
      continue;
    }

    const descriptionDecision = shouldSkipByDescription(description, settings);
    if (descriptionDecision.skip) {
      classifyActionableCandidate();
      runStats.skipped += 1;
      await logOutcome("warn", `Skipped: ${descriptionDecision.reason}`, descriptionDecision.reasonCode);
      await recordOutcome("SKIPPED", {
        reasonCode: descriptionDecision.reasonCode,
        reason: descriptionDecision.reason,
        ...currentJobContext
      });
      recordOutcomeCacheForAliases("SKIPPED", descriptionDecision.reasonCode);
      await dismissJobCard(card);
      await reportProgress();
      markSeenForAliases();
      continue;
    }

    let applyAction = await waitForApplyButtonFromDetailPane(settings, 5000, "search card detail");
    if (!applyAction.button && isJobsViewPage()) {
      await debugLog(settings, "Card click navigated to jobs view page");
    }
    if (!applyAction.button) {
      if (anchor) {
        const anchorTarget = anchor.querySelector("span") || anchor;
        const retryClick = await selectJobCardInSearchList(anchorTarget);
        if (retryClick) {
          await sleep(900);
          applyAction = await waitForApplyButtonFromDetailPane(settings, 7000, "search card anchor retry");
          if (applyAction.button) {
            await debugLog(settings, "Apply button found after anchor retry click", {
              type: applyAction.type
            });
          }
        }
      }
    }
    if (!applyAction.button) {
      await sleep(650);
      applyAction = await waitForApplyButtonFromDetailPane(settings, 3200, "search card settle retry");
    }
    if (!applyAction.button) {
      await refreshKnownAppliedJobIds(true);
      const appliedAlias = Array.from(jobAliasKeys).find((alias) => knownAppliedJobIds.has(alias));
      if (appliedAlias) {
        classifyExhaustedCandidate();
        runStats.skipped += 1;
        await logOutcome("info", "Skipped (already applied earlier)", "APPLIED_CACHE_HIT");
        await recordOutcome("SKIPPED", {
          reasonCode: "APPLIED_CACHE_HIT",
          reason: "Re-checked after missing apply button; job already applied",
          ...currentJobContext
        });
        recordOutcomeCacheForAliases("SKIPPED", "ALREADY_APPLIED");
        markAppliedForAliases();
        await dismissJobCard(card);
        await reportProgress();
        markSeenForAliases();
        continue;
      }
      if (hasDailyEasyApplyLimitSignal()) {
        await pauseRunForDailyEasyApplyLimit(settings);
        return false;
      }
      classifyActionableCandidate();
      await debugLog(settings, "No detail apply button found", {
        detailRoots: document.querySelectorAll(".jobs-search__job-details, .jobs-details, .jobs-unified-top-card, .jobs-details-top-card, .scaffold-layout__detail").length,
        applyButtonsVisible: document.querySelectorAll("button.jobs-apply-button, .jobs-s-apply button").length
      });
      runStats.skipped += 1;
      await logOutcome("warn", "Skipped (no Easy Apply button)", "NO_APPLY_BUTTON");
      await recordOutcome("SKIPPED", {
        reasonCode: "NO_APPLY_BUTTON",
        reason: "No apply button found in job detail pane",
        ...currentJobContext
      });
      recordOutcomeCacheForAliases("SKIPPED", "NO_APPLY_BUTTON");
      await dismissJobCard(card);
      await reportProgress();
      markSeenForAliases();
      continue;
    }
    if (applyAction.type === "external") {
      if (settings.easyApplyOnly) {
        classifyExhaustedCandidate();
        runStats.skipped += 1;
        await logOutcome("warn", "Skipped (external apply)", "EXTERNAL_APPLY_ONLY");
        await recordOutcome("SKIPPED", {
          reasonCode: "EXTERNAL_APPLY_ONLY",
          reason: "External apply blocked because easyApplyOnly is enabled",
          ...currentJobContext
        });
        recordOutcomeCacheForAliases("SKIPPED", "EXTERNAL_APPLY_ONLY");
        await dismissJobCard(card);
      } else {
        classifyActionableCandidate();
        await resilientClick(applyAction.button, "External Apply");
        runStats.skipped += 1;
        runSearchTermSuccessCount += 1;
        await logOutcome("info", "Opened external apply link (manual completion required)", "EXTERNAL_APPLY_OPENED");
        await recordOutcome("EXTERNAL", {
          reasonCode: "EXTERNAL_APPLY_OPENED",
          reason: "External apply opened",
          ...currentJobContext
        });
        recordOutcomeCacheForAliases("EXTERNAL", "EXTERNAL_APPLY_OPENED");
      }
      await reportProgress();
      markSeenForAliases();
      continue;
    }

    classifyActionableCandidate();
    await resilientClick(applyAction.button, "Easy Apply");
    await botChat("Easy Apply form opened. Analyzing fields...");
    await sleep(300);
    let modal = await waitForModalOpen(3000);
    if (!modal && applyAction?.button && isVisibleElement(applyAction.button)) {
      await resilientClick(applyAction.button, "Easy Apply (retry)");
      modal = await waitForModalOpen(3500);
    }
    if (!modal) {
      if (hasDailyEasyApplyLimitSignal()) {
        captureDebugEvent("cycle", "DAILY_LIMIT_IN_MODAL_WAIT", { jobKey, durationMs: endTimer("runCycle") });
        await pauseRunForDailyEasyApplyLimit(settings);
        return false;
      }
      captureDebugEvent("cycle", "MODAL_NOT_FOUND_ON_CLICK", { jobKey, title: currentJobContext.title, company: currentJobContext.company });
      runStats.skipped += 1;
      await logOutcome("warn", "Skipped: Easy Apply click did not open modal", "MODAL_NOT_FOUND");
      await recordOutcome("SKIPPED", {
        reasonCode: "MODAL_NOT_FOUND",
        reason: "Easy Apply modal not found",
        ...currentJobContext
      });
      recordOutcomeCacheForAliases("SKIPPED", "MODAL_NOT_FOUND");
      await dismissJobCard(card);
      await reportProgress();
      markSeenForAliases();
      continue;
    }
    await sleep(400);
    const result = await processEasyApplyModal(settings);
    captureDebugEvent("cycle", "CARD_MODAL_RESULT", {
      jobKey,
      title: currentJobContext.title,
      company: currentJobContext.company,
      submitted: result.submitted,
      skipped: result.skipped,
      reachedSubmit: result.reachedSubmit,
      reason: result.reason || ""
    });
    await debugLog(settings, "Modal result", result);
    if (result.submitted || (settings.dryRun && result.reachedSubmit)) {
      runStats.applied += 1;
      runSearchTermSuccessCount += 1;
      exhaustedSearchPageStreak = 0;
      markJobCardStatus(card, "applied", "Applied");
      await recordOutcome("APPLIED", {
        reasonCode: settings.dryRun ? "DRY_RUN_REACHED_SUBMIT" : "SUBMITTED",
        reason: settings.dryRun ? "Dry-run reached submit stage" : "Application submitted",
        ...currentJobContext
      });
      recordOutcomeCacheForAliases("APPLIED", "SUBMITTED");
      markAppliedForAliases();
      await dismissJobCard(card);
    } else if (result.skipped) {
      runStats.skipped += 1;
      const skipReason = result.reason || "Easy Apply modal could not reach submit stage";
      const reasonNorm = normalizeLabel(skipReason);
      const reasonCode = reasonNorm.includes("resume is required")
        ? "RESUME_REQUIRED"
        : reasonNorm.includes("valid phone")
        ? "VALIDATION_BLOCKED_PHONE"
        : (reasonNorm.includes("required") || reasonNorm.includes("selection"))
          ? "PENDING_USER_INPUT"
          : "SUBMIT_NOT_REACHED";
      markJobCardStatus(card, "skipped", reasonCode);
      await logOutcome("warn", `Skipped: ${skipReason}`, reasonCode);
      await recordOutcome("SKIPPED", {
        reasonCode,
        reason: skipReason,
        ...currentJobContext
      });
      recordOutcomeCacheForAliases("SKIPPED", reasonCode);
      await closePostSubmitUi(settings, { discardDraft: true });
      await dismissJobCard(card);
    } else {
      runStats.failed += 1;
      const failReason = result.reason || "Failed to process easy apply modal";
      markJobCardStatus(card, "skipped", "MODAL_FLOW_ERROR");
      await logOutcome("error", `Failed: ${failReason}`, "MODAL_FLOW_ERROR");
      await recordOutcome("FAILED", {
        reasonCode: "MODAL_FLOW_ERROR",
        reason: failReason,
        ...currentJobContext
      });
      recordOutcomeCacheForAliases("FAILED", "MODAL_FLOW_ERROR");
      await closePostSubmitUi(settings, { discardDraft: true });
      await dismissJobCard(card);
    }
    await reportProgress();
    markSeenForAliases();
    await sleep(900);
  }

  const exhaustedResultsPage =
    cycleConsideredCandidates > 0 &&
    cycleExhaustedCandidates === cycleConsideredCandidates &&
    !cycleHadActionableCandidate &&
    runStats.applied === cycleStartApplied;
  if (exhaustedResultsPage) {
    exhaustedSearchPageStreak += 1;
    await debugLog(settings, "Exhausted results page detected", {
      streak: exhaustedSearchPageStreak,
      considered: cycleConsideredCandidates,
      exhausted: cycleExhaustedCandidates,
      url: window.location.href
    });
    if (exhaustedSearchPageStreak >= EXHAUSTED_RESULTS_PAGE_STREAK_LIMIT) {
      exhaustedSearchPageStreak = 0;
      const movedToNextTerm = await rotateSearchTerm(settings);
      if (movedToNextTerm) return true;
      await logLine("All search keywords and result pages exhausted. Stopping run.", "info");
      await sendMessage({ type: "CP_STOP" });
      return false;
    }
  } else if (cycleConsideredCandidates > 0 || runStats.applied !== cycleStartApplied) {
    exhaustedSearchPageStreak = 0;
  }

  // 1. First, paginate to next results page for the CURRENT keyword
  const movedToNextPage = await gotoNextResultsPage(settings);
  if (movedToNextPage) {
    await logLine(`Moving to next results page for keyword "${getCurrentSearchKeyword() || 'current'}"...`, "info");
    return true;
  }

  // 2. Only when ALL pages for the current keyword are fully exhausted, rotate to the NEXT keyword in sequence
  const movedToNextTerm = await rotateSearchTerm(settings);
  if (movedToNextTerm) {
    exhaustedSearchPageStreak = 0;
    return true;
  }

  captureDebugEvent("cycle", "CYCLE_END_NO_MORE_PAGES", {
    durationMs: endTimer("runCycle"),
    applied: runStats.applied,
    skipped: runStats.skipped,
    failed: runStats.failed
  });
  await logLine("All search keywords and result pages exhausted. Run complete.", "info");
  await sendMessage({ type: "CP_STOP" });
  return false;
}

async function runAutomationLoop() {
  if (runningLoop) return;
  runningLoop = true;
  try {
    const boot = await getBootstrap();
    dailyLimitHandledRunId = "";
    exhaustedSearchPageStreak = 0;
    runSeenJobKeys = loadRunSeenJobKeys(boot?.state?.startedAt || "");
    runStats = {
      applied: Number(boot.state.applied || 0),
      skipped: Number(boot.state.skipped || 0),
      failed: Number(boot.state.failed || 0)
    };
    await refreshKnownAppliedJobIds(true);
    let lastProgressAt = Date.now();
    let noProgressCycles = 0;
    let noProgressRecoveries = 0;
    let lastProgressMarker = `${runStats.applied}|${runStats.skipped}|${runStats.failed}`;
    await logLine("Automation engine initialized");
    await botChat("AI Copilot engaged. Scanning for opportunities...");

    let guard = 0;
    while (guard < 200) {
      guard += 1;
      const { state, settings } = await getBootstrap();
      if (!state.running || state.paused) break;

      if (state.startedAt && state.startedAt !== lastRunStartedAt) {
        lastRunStartedAt = state.startedAt;
        const terms = getConfiguredSearchTerms(settings);
        captureDebugEvent("run", "RUN_START", {
          startedAt: state.startedAt,
          dryRun: settings.dryRun,
          autoSubmit: settings.autoSubmit,
          easyApplyOnly: settings.easyApplyOnly,
          searchTerms: terms,
          searchLocation: settings.searchLocation || "",
          currentCity: settings.currentCity || "",
          maxApplicationsPerRun: settings.maxApplicationsPerRun || 3,
          submitRateMinSec: settings.submitRateMinSec,
          submitRateMaxSec: settings.submitRateMaxSec,
          pauseBeforeSubmit: settings.pauseBeforeSubmit,
          pauseAtFailedQuestion: settings.pauseAtFailedQuestion,
          filterLocations: settings.filterLocations || [],
          datePosted: settings.datePosted || "",
          sortBy: settings.sortBy || "",
          debugMode: settings.debugMode || false,
          runNonStop: settings.runNonStop || false,
        });
        dailyLimitHandledRunId = "";
        runSeenJobKeys = loadRunSeenJobKeys(lastRunStartedAt);
        await refreshKnownAppliedJobIds(true);
        resumeChoiceCache.clear();
        runSearchTermSuccessCount = 0;
        resetRemoteLocationKeywordCursor();
        currentJobContext = {
          title: "",
          company: "",
          workLocation: "",
          description: "",
          aboutCompany: "",
          jobId: "",
          jobUrl: ""
        };
        exhaustedSearchPageStreak = 0;
        if (terms.length > 0) {
          runSearchTermCursor = settings.randomizeSearchOrder
            ? Math.floor(Math.random() * terms.length)
            : 0;
        } else {
          runSearchTermCursor = 0;
        }
        lastProgressAt = Date.now();
        noProgressCycles = 0;
        lastProgressMarker = `${runStats.applied}|${runStats.skipped}|${runStats.failed}`;
      }

      const maxPerRun = Number(settings.maxApplicationsPerRun || 3);
      if (runStats.applied >= maxPerRun) {
        if (settings.runNonStop) {
          const settingsPatch = {};
          if (settings.cycleDatePosted) {
            settingsPatch.datePosted = getNextDatePostedValue(settings.datePosted, settings.stopDateCycleAt24hr !== false);
          }
          if (settings.alternateSortBy) {
            settingsPatch.sortBy = getAlternateSortValue(settings.sortBy);
          }
          if (Object.keys(settingsPatch).length > 0) {
            await sendMessage({ type: "CP_SAVE_SETTINGS", settings: settingsPatch });
            await logLine(
              `Starting next cycle with date "${settingsPatch.datePosted || settings.datePosted}" and sort "${settingsPatch.sortBy || settings.sortBy}".`,
              "info"
            );
          } else {
            await logLine("Starting next non-stop cycle.", "info");
          }
          runStats = { applied: 0, skipped: 0, failed: 0 };
          dailyLimitHandledRunId = "";
          exhaustedSearchPageStreak = 0;
          clearSeenJobsForRun(lastRunStartedAt);
          resumeChoiceCache.clear();
          aiAnswerCache.clear();
          runSearchTermSuccessCount = 0;
          resetRemoteLocationKeywordCursor();
          preparedRun = false;
          await reportProgress();
          continue;
        }
        await logLine("Max applications reached. Stopping run.");
        await sendMessage({ type: "CP_STOP" });
        break;
      }
      if (!preparedRun) {
        const ok = await prepareRun(settings);
        if (!ok) break;
      }
      const beforeMarker = `${runStats.applied}|${runStats.skipped}|${runStats.failed}`;
      const cycled = await runCycle(settings);
      const afterMarker = `${runStats.applied}|${runStats.skipped}|${runStats.failed}`;
      if (afterMarker !== beforeMarker) {
        lastProgressAt = Date.now();
        noProgressCycles = 0;
        lastProgressMarker = afterMarker;
      } else {
        noProgressCycles += 1;
        if (noProgressCycles % 5 === 0) {
          await debugLog(settings, "No progress cycle", {
            noProgressCycles,
            elapsedMs: Date.now() - lastProgressAt,
            marker: lastProgressMarker
          });
        }
      }

      const noProgressElapsedMs = Date.now() - lastProgressAt;
      if (noProgressCycles >= NO_PROGRESS_MAX_CYCLES || noProgressElapsedMs >= NO_PROGRESS_TIMEOUT_MS) {
        noProgressRecoveries += 1;
        await logLine(
          `No progress for ${Math.round(noProgressElapsedMs / 1000)}s. Trying recovery (${noProgressRecoveries}/3)...`,
          "warn"
        );
        await botChat("Stuck on current page. Trying recovery strategy...", "warn");

        const selectorHealth = checkSelectorHealth();
        if (!selectorHealth.ok) {
          await logLine(
            `Selector health warning: cards=${selectorHealth.jobCardCount}, search=${selectorHealth.hasSearchInput}, apply=${selectorHealth.hasApplyButton}. LinkedIn layout may have changed.`,
            "warn"
          );
        }

        // Recovery strategy:
        // 1) If on a job view/post-apply page, force back to search.
        // 2) Try to move to the next results page (scroll-to-pagination + click Next).
        // 3) Rotate search term.
        // 4) As a last resort, reload the current page.
        try {
          if (!isJobsSearchPage()) {
            resetRemoteLocationKeywordCursor();
            window.location.href = getResumableSearchUrl(settings);
            return;
          }
          // Ensure pagination is in view.
          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
          await sleep(1200);
          const moved = (await gotoNextResultsPage(settings)) || (await rotateSearchTerm(settings));
          if (!moved) {
            window.location.reload();
            return;
          }
        } catch {
          window.location.reload();
          return;
        }

        lastProgressAt = Date.now();
        noProgressCycles = 0;
        lastProgressMarker = `${runStats.applied}|${runStats.skipped}|${runStats.failed}`;
        preparedRun = false;

        if (noProgressRecoveries >= 3) {
          await logLine("Recovery attempts exhausted. Stopping run.", "warn");
          await sendMessage({ type: "CP_STOP" });
          break;
        }
        continue;
      }
      if (!cycled && runStats.applied >= maxPerRun) {
        await sendMessage({ type: "CP_STOP" });
        break;
      }
      await sleep(1200);
    }
    if (guard >= 200) {
      await logLine("Safety guard limit reached. Stopping run.", "warn");
      await sendMessage({ type: "CP_STOP" });
    }
  } catch (error) {
    await sendMessage({ type: "CP_SET_ERROR", error: error?.message || String(error) });
  } finally {
    try {
      const modal = getActiveModal();
      if (modal && isSaveApplicationPrompt(modal)) {
        await dismissSaveApplicationPrompt(modal);
      }
    } catch {
      // best-effort modal cleanup
    }
    runningLoop = false;
  }
}

async function startStatePolling() {
  while (true) {
    if (!extensionContextAlive) break;
    const boot = await getBootstrap();
    if (!boot || !boot.state) {
      await sleep(STATE_POLL_MS);
      continue;
    }
    renderState(boot.state);
    if (!boot.state.running) {
      preparedRun = false;
      lastRunStartedAt = null;
      exhaustedSearchPageStreak = 0;
      runSearchTermSuccessCount = 0;
      resetRemoteLocationKeywordCursor();
      clearSeenJobsForRun();
      resumeChoiceCache.clear();
      aiAnswerCache.clear();
    }
    if (boot.state.running && !runningLoop) {
      runAutomationLoop().catch((err) => {
        console.error("[CP] Automation loop crashed:", err);
        sendMessage({ type: "CP_SET_ERROR", error: err?.message || String(err) });
      });
    }
    await sleep(STATE_POLL_MS);
  }
}

if (!window.__CP_COPILOT_ACTIVE__) {
  window.__CP_COPILOT_ACTIVE__ = true;
  ensurePanel();
  window.addEventListener("resize", () => {
    applyPanelLayout();
    logPanelDebug("window-resize");
  });
  window.addEventListener("keydown", (event) => {
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === "c") {
      panelPrefs.left = Math.max(8, window.innerWidth - 440);
      panelPrefs.top = 84;
      panelPrefs.minimized = false;
      panelPrefs.maximized = false;
      savePanelPrefs();
      applyPanelLayout();
      logPanelDebug("hotkey-reset");
    }
  });
  loadRemoteSelectors().catch(() => {});
  startStatePolling().catch((err) => {
    console.error("[CP] State polling crashed:", err);
  });
} else {
  ensurePanel();
  if (!extensionContextAlive) {
    extensionContextAlive = true;
    logPanelDebug("context-reconnected");
    loadRemoteSelectors().catch(() => {});
    startStatePolling().catch((err) => {
      console.error("[CP] State polling crashed:", err);
    });
  } else {
    logPanelDebug("reused-script-instance");
  }
}
