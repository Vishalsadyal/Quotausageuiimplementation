/*
 * LinkedIn Jobs auto-apply - part 01: config
 *
 * Constants (timeouts, storage keys, TTLs) and the module-level run state shared by every file
 * below (panel element, run stats, caches).
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

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
let lastLogRenderSignature = "";
let panelRenderedTab = "";
let lastAutoSubmitAtMs = 0;
let activeSubmitPaceDelayMs = 0;
let activeSubmitPaceStartMs = 0;
let warnedDefaultYearsFallback = false;
let remoteSelectors = null;
let remoteSelectorsVersion = 0;
let panelActiveTab = "feed";
// Applied / skipped jobs listed in the panel, read from the extension's run history (20-panel-render.js).
let panelHistory = { applied: [], skipped: [] };
let panelHistoryKey = "";
let panelHistoryVersion = 0;
let panelLastState = null;

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
