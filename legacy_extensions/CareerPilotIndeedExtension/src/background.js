const MAX_LOG_ENTRIES = 500;
const MAX_HISTORY_ENTRIES = 1000;
const MAX_RUN_SUMMARIES = 50;
const API_TIMEOUT_MS = 8000;
const EXT_DAILY_CAP = 3;
const DAILY_CAP_STORAGE_KEY = "cpDailyCapState";
const RUN_SUMMARY_STORAGE_KEY = "cpRunSummaries";
const SETTINGS_SCHEMA_VERSION = 2;
const PORTAL_IMPORT_QUEUE_KEY = "cpPortalImportQueue";
const PORTAL_SYNC_COOLDOWN_KEY = "cpPortalSyncCooldown";
const PORTAL_ORIGIN_STATE_KEY = "cpPortalOriginState";
const PORTAL_ORIGIN_FAILURE_THRESHOLD = 3;
const PORTAL_DEFAULT_ORIGIN = "https://www.autoapplycv.in";
const PORTAL_REMOTE_ORIGIN_PRIORITY = [
  PORTAL_DEFAULT_ORIGIN,
  "https://autoapplycv.in",
  "https://autoapplycv.vercel.app",
];
const PORTAL_FALLBACK_ORIGINS = [
  PORTAL_DEFAULT_ORIGIN,
  "https://autoapplycv.in",
  "https://autoapplycv.vercel.app",
  "http://localhost:3001",
  "http://localhost:3000",
];
const PORTAL_ISSUE_REPORTED_KEY = "cpPortalIssueReported";
const PORTAL_LAST_SYNC_SNAPSHOT_KEY = "cpPortalLastSyncSnapshot";
const EXTENSION_PROVIDER = "indeed";

// Cloudflare & Bot Detection Handling
const CLOUDFLARE_BYPASS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

// Best-effort portal sync (AutoApply CV web app). This is fed by dashboard-bridge.js running on the site origin.
let portalQuotaCache = {
  ts: 0,
  data: null,
};
let portalOrigin = "";
let portalImportInFlight = false;
let portalOriginState = {
  origin: "",
  failureCount: 0,
  updatedAt: 0,
};
let lastPortalSyncSnapshot = {
  ts: "",
  origin: "",
  imported: 0,
  chargedJobs: 0,
  consumedTotal: 0,
  freeConsumed: 0,
  paidConsumed: 0,
  chargeFailures: 0,
  lastChargedJobId: "",
  lastChargedJobTitle: "",
  lastChargedJobCompany: "",
};


// Centralized logging utility
function logDetails(level, message, data = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
  };
  console[level](JSON.stringify(logEntry));
}

function normalizePortalOrigin(value) {
  logDetails("info", "Normalizing portal origin", { value });

  const raw = String(value || "").trim();
  if (!raw) {
    logDetails("warn", "Empty portal origin provided.");
    return "";
  }

  try {
    const normalized = new URL(raw).origin;
    logDetails("info", "Normalized portal origin", { normalized });
    return normalized;
  } catch (error) {
    logDetails("error", "Failed to normalize portal origin", { error: error.message });
    return "";
  }
}

function persistPortalOriginState() {
  const payload = {
    origin: String(portalOriginState.origin || "").trim(),
    failureCount: Math.max(0, Math.floor(Number(portalOriginState.failureCount || 0))),
    updatedAt: Date.now(),
  };
  return chrome.storage.local.set({ [PORTAL_ORIGIN_STATE_KEY]: payload }).catch(() => {});
}

function setPreferredPortalOrigin(origin, opts = {}) {
  const normalized = normalizePortalOrigin(origin);
  if (!normalized) return;
  const resetFailures = opts.resetFailures !== false;
  portalOrigin = normalized;
  portalOriginState = {
    origin: normalized,
    failureCount: resetFailures ? 0 : Math.max(0, Math.floor(Number(portalOriginState.failureCount || 0))),
    updatedAt: Date.now(),
  };
  void persistPortalOriginState();
}

async function markPortalOriginFailure(origin) {
  const normalized = normalizePortalOrigin(origin);
  if (!normalized) return;
  if (normalizePortalOrigin(portalOriginState.origin) !== normalized) return;
  const nextFailures = Math.max(0, Math.floor(Number(portalOriginState.failureCount || 0))) + 1;
  portalOriginState = {
    origin: nextFailures >= PORTAL_ORIGIN_FAILURE_THRESHOLD ? "" : normalized,
    failureCount: nextFailures >= PORTAL_ORIGIN_FAILURE_THRESHOLD ? 0 : nextFailures,
    updatedAt: Date.now(),
  };
  if (!portalOriginState.origin) portalOrigin = "";
  await persistPortalOriginState();
}

/**
 * Check if a response indicates Cloudflare challenge
 * @param {Response} response - Fetch response object
 * @returns {boolean} - True if Cloudflare challenge detected
 */
function isCloudflareChallenge(response) {
  if (!response) return false;
  
  // Check status code
  if (response.status === 403 || response.status === 503) {
    return true;
  }
  
  // Check for Cloudflare headers
  const serverHeader = response.headers?.get?.('server') || '';
  if (serverHeader.includes('cloudflare')) {
    return true;
  }
  
  return false;
}

/**
 * Log Cloudflare challenge with Ray ID
 * @param {string} url - URL that triggered challenge
 * @param {Response} response - Response object
 */
function logCloudflareChallenge(url, response) {
  const rayId = response?.headers?.get?.('CF-Ray') || 'unknown';
  const statusCode = response?.status || 'unknown';
  
  console.warn("[CareerPilot] ⚠️  Cloudflare Challenge Detected", {
    url,
    rayId,
    statusCode,
    timestamp: new Date().toISOString(),
  });
}

function normalizeLastPortalSyncSnapshot(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...lastPortalSyncSnapshot };
  }
  return {
    ts: String(raw.ts || "").trim(),
    origin: normalizePortalOrigin(raw.origin),
    imported: Math.max(0, Math.floor(Number(raw.imported || 0))),
    chargedJobs: Math.max(0, Math.floor(Number(raw.chargedJobs || 0))),
    consumedTotal: Math.max(0, Math.floor(Number(raw.consumedTotal || 0))),
    freeConsumed: Math.max(0, Math.floor(Number(raw.freeConsumed || 0))),
    paidConsumed: Math.max(0, Math.floor(Number(raw.paidConsumed || 0))),
    chargeFailures: Math.max(0, Math.floor(Number(raw.chargeFailures || 0))),
    lastChargedJobId: String(raw.lastChargedJobId || "").trim(),
    lastChargedJobTitle: String(raw.lastChargedJobTitle || "").trim(),
    lastChargedJobCompany: String(raw.lastChargedJobCompany || "").trim(),
  };
}

function setLastPortalSyncSnapshot(raw) {
  lastPortalSyncSnapshot = normalizeLastPortalSyncSnapshot(raw);
  void chrome.storage.local
    .set({ [PORTAL_LAST_SYNC_SNAPSHOT_KEY]: lastPortalSyncSnapshot })
    .catch(() => {});
  return lastPortalSyncSnapshot;
}

void chrome.storage.local.get([PORTAL_ORIGIN_STATE_KEY, PORTAL_LAST_SYNC_SNAPSHOT_KEY]).then((snap) => {
  const raw = snap?.[PORTAL_ORIGIN_STATE_KEY];
  if (raw && typeof raw === "object") {
    const normalized = normalizePortalOrigin(raw.origin);
    portalOriginState = {
      origin: normalized,
      failureCount: Math.max(0, Math.floor(Number(raw.failureCount || 0))),
      updatedAt: Math.max(0, Number(raw.updatedAt || 0)),
    };
    if (normalized) portalOrigin = normalized;
  }
  const lastSync = normalizeLastPortalSyncSnapshot(snap?.[PORTAL_LAST_SYNC_SNAPSHOT_KEY]);
  lastPortalSyncSnapshot = lastSync;
}).catch(() => {});

async function notifyDashboardTabs(payload) {
  try {
    const origin = getPortalOrigin();
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs || []) {
      const url = String(tab?.url || "");
      if (!url) continue;
      let tabOrigin = "";
      try {
        tabOrigin = new URL(url).origin;
      } catch {
        tabOrigin = "";
      }
      if (!tabOrigin || tabOrigin !== origin) continue;
      if (!tab.id) continue;
      try {
        chrome.tabs.sendMessage(tab.id, { type: "CP_PORTAL_SYNCED", ...payload }, () => void 0);
      } catch {
        // ignore per-tab failures
      }
    }
  } catch {
    // ignore
  }
}

async function sendMessageToTab(tabId, message) {
  if (!tabId) return { ok: false, error: "Missing tab id" };
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve({ ok: true, response });
      });
    } catch (error) {
      resolve({ ok: false, error: String(error?.message || error) });
    }
  });
}

async function importPortalBatchViaDashboardTab(origin, batch) {
  const targetOrigin = normalizePortalOrigin(origin);
  if (!targetOrigin || !Array.isArray(batch) || !batch.length) {
    return { attempted: false, status: 0, body: null };
  }
  try {
    const tabs = await chrome.tabs.query({});
    const matchingTabs = (tabs || []).filter((tab) => {
      if (!tab?.id || !tab?.url) return false;
      try {
        return new URL(tab.url).origin === targetOrigin;
      } catch {
        return false;
      }
    });
    for (const tab of matchingTabs) {
      const result = await sendMessageToTab(tab.id, {
        type: "CP_WEB_IMPORT_OUTCOMES",
        entries: batch,
      });
      if (!result.ok) continue;
      const payload = result.response && typeof result.response === "object" ? result.response : {};
      const status = Math.max(0, Number(payload.status || 0));
      return {
        attempted: Boolean(payload.attempted),
        status,
        body: payload.body && typeof payload.body === "object" ? payload.body : null,
      };
    }
  } catch {
    // ignore
  }
  return { attempted: false, status: 0, body: null };
}

async function finalizePortalImportSuccess(origin, body, queue, batch) {
  const imported = Math.max(0, Number(body?.data?.imported ?? batch.length));
  const billingRaw = body?.data?.billing && typeof body.data.billing === "object" ? body.data.billing : {};
  const resultItems = Array.isArray(body?.data?.results) ? body.data.results : [];
  let chargedJobs = Math.max(0, Math.floor(Number(billingRaw.chargedJobs || 0)));
  let consumedTotal = Math.max(0, Math.floor(Number(billingRaw.consumedTotal || 0)));
  let freeConsumed = Math.max(0, Math.floor(Number(billingRaw.freeConsumed || 0)));
  let paidConsumed = Math.max(0, Math.floor(Number(billingRaw.paidConsumed || 0)));
  let chargeFailures = Math.max(0, Math.floor(Number(billingRaw.chargeFailures || 0)));
  if (!chargedJobs && resultItems.length) {
    chargedJobs = resultItems.filter((item) => Boolean(item?.billing?.charged)).length;
  }
  if (!consumedTotal && resultItems.length) {
    consumedTotal = resultItems.reduce((sum, item) => sum + Math.max(0, Number(item?.billing?.consumed || 0)), 0);
  }
  if (!freeConsumed && resultItems.length) {
    freeConsumed = resultItems.reduce(
      (sum, item) => sum + Math.max(0, Number(item?.billing?.sourceBreakdown?.free || 0)),
      0,
    );
  }
  if (!paidConsumed && resultItems.length) {
    paidConsumed = resultItems.reduce(
      (sum, item) => sum + Math.max(0, Number(item?.billing?.sourceBreakdown?.paid || 0)),
      0,
    );
  }
  if (!chargeFailures && resultItems.length) {
    chargeFailures = resultItems.filter((item) => {
      const shouldCharge = String(item?.outcomeType || "").toUpperCase() === "APPLIED";
      const reason = String(item?.billing?.reason || "").toUpperCase();
      return shouldCharge && !item?.billing?.charged && reason && reason !== "NOT_CHARGED_ALREADY_SUBMITTED";
    }).length;
  }
  const lastCharged = [...resultItems]
    .reverse()
    .find((item) => Boolean(item?.billing?.charged));
  const syncSnapshot = setLastPortalSyncSnapshot({
    ts: nowIso(),
    origin,
    imported,
    chargedJobs,
    consumedTotal,
    freeConsumed,
    paidConsumed,
    chargeFailures,
    lastChargedJobId: String(lastCharged?.externalJobId || "").trim(),
    lastChargedJobTitle: String(lastCharged?.title || "").trim(),
    lastChargedJobCompany: String(lastCharged?.company || "").trim(),
  });
  setPreferredPortalOrigin(origin, { resetFailures: true });
  await setPortalQueue(queue.slice(batch.length));
  await clearPortalCooldown();
  await refreshPortalQuota();
  await pushLog(
    `Synced ${imported} update(s) to dashboard via ${origin}. Charged ${chargedJobs} (free ${freeConsumed}, paid ${paidConsumed}).`,
    "info",
    {
      chargedJobs,
      consumedTotal,
      freeConsumed,
      paidConsumed,
      chargeFailures,
    },
  );
  await notifyDashboardTabs({
    imported,
    ts: syncSnapshot.ts || nowIso(),
    chargedJobs,
    consumedTotal,
    freeConsumed,
    paidConsumed,
    chargeFailures,
    lastChargedJobId: syncSnapshot.lastChargedJobId || "",
  });
}

function setPortalQuota(data) {
  try {
    const maybeOrigin = String(data?._origin || "").trim();
    if (maybeOrigin) {
      setPreferredPortalOrigin(maybeOrigin, { resetFailures: true });
    }
  } catch {
    // ignore
  }
  portalQuotaCache = { ts: Date.now(), data: data && typeof data === "object" ? data : null };
  return portalQuotaCache;
}

function getPortalQuota() {
  // Consider stale after 3 minutes.
  const stale = Date.now() - Number(portalQuotaCache.ts || 0) > 3 * 60 * 1000;
  return { ...portalQuotaCache, stale };
}

function portalSpendable() {
  const q = portalQuotaCache?.data;
  const spendable = Number(q?.spendable ?? NaN);
  if (Number.isFinite(spendable)) return Math.max(0, spendable);
  const bal = Number(q?.hireBalance ?? NaN);
  if (Number.isFinite(bal)) return Math.max(0, bal);
  return 0;
}

function getPortalOrigin() {
  const fromState = normalizePortalOrigin(portalOriginState.origin);
  if (fromState) return fromState;
  const raw = String(portalOrigin || "").trim();
  if (raw) return raw;
  const fromQuota = String(portalQuotaCache?.data?._origin || "").trim();
  if (fromQuota) return fromQuota;
  return "";
}

function normalizeLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function detectPortalOriginsFromTabs() {
  const locals = [];
  const remotes = [];
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs || []) {
      const url = String(tab?.url || "");
      if (!url) continue;
      let origin = "";
      let host = "";
      try {
        const u = new URL(url);
        origin = u.origin;
        host = u.hostname.toLowerCase();
      } catch {
        origin = "";
        host = "";
      }
      if (!origin) continue;
      if (host === "localhost" || host === "127.0.0.1") locals.push(origin);
      if (
        host === "autoapplycv.in" ||
        host.endsWith(".autoapplycv.in") ||
        host === "autoapplycv.vercel.app"
      ) {
        remotes.push(origin);
      }
    }
  } catch {
    // ignore
  }
  const sortByPriority = (items, priority) => {
    const order = new Map(priority.map((origin, idx) => [String(origin || "").trim(), idx]));
    return [...items].sort((a, b) => {
      const aRank = order.has(a) ? Number(order.get(a)) : Number.MAX_SAFE_INTEGER;
      const bRank = order.has(b) ? Number(order.get(b)) : Number.MAX_SAFE_INTEGER;
      return aRank - bRank;
    });
  };
  const sortedRemotes = sortByPriority(remotes, PORTAL_REMOTE_ORIGIN_PRIORITY);
  const localPriority = ["http://localhost:3001", "http://127.0.0.1:3001", "http://localhost:3000", "http://127.0.0.1:3000"];
  const sortedLocals = sortByPriority(locals, localPriority);
  const uniq = new Set();
  const out = [];
  const preferred = normalizePortalOrigin(getPortalOrigin());
  for (const o of [preferred, ...sortedRemotes, ...PORTAL_REMOTE_ORIGIN_PRIORITY, ...PORTAL_FALLBACK_ORIGINS, ...sortedLocals]) {
    const key = String(o || "").trim();
    if (!key || uniq.has(key)) continue;
    uniq.add(key);
    out.push(key);
  }
  return out;
}

async function detectPortalOriginFromTabs() {
  try {
    const origins = await detectPortalOriginsFromTabs();
    return origins[0] || "";
  } catch {
    // ignore
  }
  return "";
}

async function refreshPortalScreeningAnswersIntoSettings() {
  const preferred = getPortalOrigin();
  const candidates = preferred ? [preferred, ...(await detectPortalOriginsFromTabs()).filter((o) => o !== preferred)] : await detectPortalOriginsFromTabs();
  for (const origin of candidates) {
    try {
      const res = await fetch(`${origin}/api/user/screening/answers?limit=100&scanLimit=300`, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) continue;

      const items = Array.isArray(body?.data?.answers) ? body.data.answers : [];
      const settings = await getSettings();
      const merged = { ...(settings?.screeningAnswers && typeof settings.screeningAnswers === "object" ? settings.screeningAnswers : {}) };
      for (const item of items) {
        const key = String(item?.questionKey || "").trim();
        const label = String(item?.questionLabel || "").trim();
        const answer = String(item?.answer || "").trim();
        if (!answer) continue;
        if (key) merged[key] = answer;
        if (label) merged[normalizeLabel(label)] = answer;
      }
      await saveSettings({ screeningAnswers: merged });
      setPreferredPortalOrigin(origin, { resetFailures: true });
      return true;
    } catch {
      // try next
    }
  }
  return false;
}

let portalAnswerPollTimer = null;
function ensurePortalAnswerPoller() {
  if (portalAnswerPollTimer) return;
  portalAnswerPollTimer = setInterval(async () => {
    try {
      const snap = await chrome.storage.local.get("cpPendingQuestions");
      const pending = Array.isArray(snap?.cpPendingQuestions) ? snap.cpPendingQuestions : [];
      if (!pending.length) {
        clearInterval(portalAnswerPollTimer);
        portalAnswerPollTimer = null;
        return;
      }
      await refreshPortalScreeningAnswersIntoSettings();
    } catch {
      // ignore
    }
  }, 8000);
}

async function reportPendingQuestionsToPortal(questions) {
  const pending = Array.isArray(questions) ? questions.filter(Boolean) : [];
  if (!pending.length) return false;

  const reportedSnap = await chrome.storage.local.get(PORTAL_ISSUE_REPORTED_KEY);
  const reported = reportedSnap?.[PORTAL_ISSUE_REPORTED_KEY] && typeof reportedSnap[PORTAL_ISSUE_REPORTED_KEY] === "object"
    ? { ...reportedSnap[PORTAL_ISSUE_REPORTED_KEY] }
    : {};

  const preferred = getPortalOrigin();
  const candidates = preferred ? [preferred, ...(await detectPortalOriginsFromTabs()).filter((o) => o !== preferred)] : await detectPortalOriginsFromTabs();
  if (!candidates.length) return false;

  let usedOrigin = "";
  for (const origin of candidates) {
    try {
      let unauthorized = false;
      for (const q of pending) {
        const questionKey = String(q?.questionKey || "").trim();
        const questionLabel = String(q?.questionLabel || "").trim();
        const validationMessage = String(q?.validationMessage || "").trim();
        if (!questionKey || !questionLabel) continue;
        const signature = `${questionLabel}::${validationMessage}`;
        if (reported[questionKey] === signature) continue;

        const res = await fetch(`${origin}/api/user/screening/issues`, {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionKey, questionLabel, validationMessage }),
        });
        if (res.status === 401 || res.status === 403) {
          unauthorized = true;
          break;
        }
        if (!res.ok) continue;
        reported[questionKey] = signature;
      }
      if (unauthorized) continue;
      usedOrigin = origin;
      break;
    } catch {
      // try next origin
    }
  }

  if (usedOrigin) {
    setPreferredPortalOrigin(usedOrigin, { resetFailures: true });
    await chrome.storage.local.set({ [PORTAL_ISSUE_REPORTED_KEY]: reported });
    return true;
  }
  return false;
}

async function getPortalCooldown() {
  const snap = await chrome.storage.local.get(PORTAL_SYNC_COOLDOWN_KEY);
  const raw = snap?.[PORTAL_SYNC_COOLDOWN_KEY] || {};
  const until = Number(raw.untilMs || 0);
  return {
    untilMs: Number.isFinite(until) ? until : 0,
    reason: String(raw.reason || ""),
  };
}

async function setPortalCooldown(ms, reason) {
  const untilMs = Date.now() + Math.max(0, Number(ms || 0));
  await chrome.storage.local.set({ [PORTAL_SYNC_COOLDOWN_KEY]: { untilMs, reason: String(reason || "") } });
}

async function clearPortalCooldown() {
  await chrome.storage.local.set({ [PORTAL_SYNC_COOLDOWN_KEY]: { untilMs: 0, reason: "" } });
}

function buildPortalImportEntryId(entry) {
  const normalized = entry && typeof entry === "object" ? entry : {};
  const data = normalized.data && typeof normalized.data === "object" ? normalized.data : {};
  const outcomeType = String(normalized.outcomeType || "SKIPPED").toUpperCase();
  const ts = String(normalized.ts || "").trim();
  const stableJobId =
    extractLinkedInJobId(data.jobId) ||
    extractLinkedInJobId(data.externalJobId) ||
    extractLinkedInJobId(data.jobUrl) ||
    extractLinkedInJobId(data.pageUrl) ||
    String(data.jobId || data.externalJobId || "").trim();
  const reasonCode = String(data.reasonCode || "").trim().toUpperCase();
  return `${EXTENSION_PROVIDER}:${outcomeType}:${stableJobId || "unknown"}:${reasonCode || "na"}:${ts || nowIso()}`;
}

function normalizePortalImportEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const outcomeType = String(entry.outcomeType || "SKIPPED").trim().toUpperCase();
  const ts = String(entry.ts || "").trim() || nowIso();
  const rawData = entry.data && typeof entry.data === "object" ? entry.data : {};
  const data = {
    ...rawData,
    provider: String(rawData.provider || entry.provider || EXTENSION_PROVIDER).trim().toLowerCase() || EXTENSION_PROVIDER,
  };
  const normalized = {
    ts,
    outcomeType,
    data,
    provider: data.provider,
    entryId: String(entry.entryId || "").trim(),
  };
  if (!normalized.entryId) {
    normalized.entryId = buildPortalImportEntryId(normalized);
  }
  return normalized;
}

function dedupePortalImportEntries(entries) {
  const map = new Map();
  for (const raw of Array.isArray(entries) ? entries : []) {
    const normalized = normalizePortalImportEntry(raw);
    if (!normalized) continue;
    map.set(normalized.entryId, normalized);
  }
  return Array.from(map.values());
}

async function getPortalQueue() {
  const snap = await chrome.storage.local.get(PORTAL_IMPORT_QUEUE_KEY);
  const raw = snap?.[PORTAL_IMPORT_QUEUE_KEY];
  const deduped = dedupePortalImportEntries(Array.isArray(raw) ? raw : []);
  if (Array.isArray(raw) && raw.length !== deduped.length) {
    await chrome.storage.local.set({ [PORTAL_IMPORT_QUEUE_KEY]: deduped });
  }
  return deduped;
}

async function setPortalQueue(queue) {
  const trimmed = dedupePortalImportEntries(Array.isArray(queue) ? queue : []).slice(-1500);
  await chrome.storage.local.set({ [PORTAL_IMPORT_QUEUE_KEY]: trimmed });
  return trimmed;
}

async function enqueuePortalImport(entry) {
  const normalized = normalizePortalImportEntry(entry);
  if (!normalized) return;
  const queue = await getPortalQueue();
  if (queue.find((item) => String(item?.entryId || "") === normalized.entryId)) return;
  queue.push(normalized);
  await setPortalQueue(queue);
  void flushPortalImportsSoon();
}

let portalFlushTimer = null;
function flushPortalImportsSoon() {
  if (portalFlushTimer) return;
  portalFlushTimer = setTimeout(() => {
    portalFlushTimer = null;
    void flushPortalImports();
  }, 800);
}

async function refreshPortalQuota() {
  const preferred = getPortalOrigin();
  const candidates = preferred ? [preferred, ...(await detectPortalOriginsFromTabs()).filter((o) => o !== preferred)] : await detectPortalOriginsFromTabs();
  for (const origin of candidates) {
    try {
      const res = await fetch(`${origin}/api/user/quota`, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) continue;
      setPortalQuota({ ...(body.data || {}), _origin: origin });
      setPreferredPortalOrigin(origin, { resetFailures: true });
      return true;
    } catch {
      // try next origin
    }
  }
  return false;
}

async function flushPortalImports() {
  if (portalImportInFlight) return;
  const cooldown = await getPortalCooldown();
  if (Date.now() < cooldown.untilMs) return;

  const queue = await getPortalQueue();
  if (!queue.length) return;

  portalImportInFlight = true;
  const preferred = getPortalOrigin();
  const candidates = preferred ? [preferred, ...(await detectPortalOriginsFromTabs()).filter((o) => o !== preferred)] : await detectPortalOriginsFromTabs();
  try {
    if (!candidates.length) {
      // Don't spam errors if the portal isn't open / origin unknown yet.
      await setPortalCooldown(60 * 1000, "NO_PORTAL_ORIGIN");
      return;
    }
    const batch = queue.slice(0, 50);

    let lastStatus = 0;
    let lastNotFound = false;
    let authFailed = false;
    let networkFailed = false;
    const statusByOrigin = [];
    const notFoundOrigins = [];
    const authOrigins = [];
    const processImportResponse = async (origin, status, body, label = "") => {
      lastStatus = status;
      statusByOrigin.push(`${origin}=${status}${label}`);
      if (status === 401 || status === 403) {
        authFailed = true;
        authOrigins.push(origin);
        if (preferred && origin === preferred) await markPortalOriginFailure(origin);
        return "continue";
      }
      if (status === 404) {
        lastNotFound = true;
        notFoundOrigins.push(origin);
        if (preferred && origin === preferred) await markPortalOriginFailure(origin);
        return "continue";
      }
      if (!status) return "fallback";
      if (!body?.success) {
        if (preferred && origin === preferred) await markPortalOriginFailure(origin);
        await pushLog(`Portal sync failed on ${origin} (HTTP ${status}). Will retry.`, "warn");
        await setPortalCooldown(30 * 1000, "HTTP_ERROR");
        return "stop";
      }
      await finalizePortalImportSuccess(origin, body, queue, batch);
      return "success";
    };
    for (const origin of candidates) {
      const bridgeResult = await importPortalBatchViaDashboardTab(origin, batch);
      if (bridgeResult.attempted && bridgeResult.status > 0) {
        const bridgeOutcome = await processImportResponse(origin, bridgeResult.status, bridgeResult.body, ":bridge");
        if (bridgeOutcome === "success" || bridgeOutcome === "stop") return;
        if (bridgeOutcome === "continue") continue;
      }
      try {
        const res = await fetch(`${origin}/api/extension/import`, {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: batch }),
        });
        const body = await res.json().catch(() => null);
        const directOutcome = await processImportResponse(origin, res.status, body);
        if (directOutcome === "success" || directOutcome === "stop") return;
        if (directOutcome === "continue") {
          continue; // try another origin (common when both prod + localhost are open)
        }
        if (directOutcome === "fallback") {
          return;
        }
      } catch {
        networkFailed = true;
        statusByOrigin.push(`${origin}=NETWORK_ERROR`);
        if (preferred && origin === preferred) await markPortalOriginFailure(origin);
        continue;
      }
    }

    if (authFailed) {
      const authHint = authOrigins.length ? ` (${authOrigins.join(", ")})` : "";
      const attemptHint = statusByOrigin.length ? ` Attempts: ${statusByOrigin.join(" | ")}` : "";
      await pushLog(`Portal sync needs login${authHint}. Open dashboard once to sync and deduct Hires.${attemptHint}`, "warn");
      await setPortalCooldown(10 * 60 * 1000, "AUTH_REQUIRED");
      return;
    }
    if (lastNotFound) {
      const originsHint = notFoundOrigins.length ? ` (${notFoundOrigins.join(", ")})` : "";
      await pushLog(`Portal sync endpoint not found (404)${originsHint}. Check dashboard URL/port and keep it open once.`, "warn");
      await setPortalCooldown(5 * 60 * 1000, "NOT_FOUND");
      return;
    }
    if (networkFailed) {
      await pushLog("Portal sync network issue. Will retry shortly.", "warn");
      await setPortalCooldown(30 * 1000, "NETWORK_ERROR");
      return;
    }
    await pushLog(`Portal sync failed (HTTP ${lastStatus || "?"}). Will retry.`, "warn");
    await setPortalCooldown(30 * 1000, "HTTP_ERROR");
  } catch {
    await setPortalCooldown(30 * 1000, "NETWORK_ERROR");
  } finally {
    portalImportInFlight = false;
    // Continue draining if more queued.
    const nextQueue = await getPortalQueue();
    if (nextQueue.length) void flushPortalImportsSoon();
  }
}

const HISTORY_KEY_MAP = {
  APPLIED: "cpAppliedHistory",
  FAILED: "cpFailedHistory",
  EXTERNAL: "cpExternalHistory",
  SKIPPED: "cpSkippedHistory"
};

function emptyRunCounts() {
  return {
    applied: 0,
    skipped: 0,
    failed: 0,
    external: 0,
    submitted: 0,
  };
}

function normalizeCount(value) {
  return Math.max(0, Math.floor(Number(value || 0)));
}

function normalizeRunCounts(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    applied: normalizeCount(source.applied),
    skipped: normalizeCount(source.skipped),
    failed: normalizeCount(source.failed),
    external: normalizeCount(source.external),
    submitted: normalizeCount(source.submitted),
  };
}

function normalizeRunOutcome(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    ts: String(raw.ts || ""),
    outcomeType: String(raw.outcomeType || "").toUpperCase(),
    reasonCode: String(raw.reasonCode || "").toUpperCase(),
    jobId: String(raw.jobId || ""),
    title: String(raw.title || "").trim(),
    company: String(raw.company || "").trim(),
    entryId: String(raw.entryId || "").trim(),
  };
}

function normalizeRunSummary(raw) {
  if (!raw || typeof raw !== "object") return null;
  const runId = String(raw.runId || raw.startedAt || "").trim();
  if (!runId) return null;
  const startedAt = String(raw.startedAt || runId).trim() || runId;
  return {
    runId,
    startedAt,
    endedAt: raw.endedAt ? String(raw.endedAt) : null,
    lastUpdatedAt: String(raw.lastUpdatedAt || startedAt || nowIso()),
    counts: normalizeRunCounts(raw.counts),
    lastOutcome: normalizeRunOutcome(raw.lastOutcome),
  };
}

function sortRunSummaries(runs) {
  return [...runs].sort((a, b) => {
    const aTime = new Date(String(a?.startedAt || a?.runId || 0)).getTime();
    const bTime = new Date(String(b?.startedAt || b?.runId || 0)).getTime();
    return aTime - bTime;
  });
}

async function getRunSummariesState() {
  const snapshot = await chrome.storage.local.get(RUN_SUMMARY_STORAGE_KEY);
  const raw = snapshot?.[RUN_SUMMARY_STORAGE_KEY] || {};
  const runs = sortRunSummaries(
    (Array.isArray(raw.runs) ? raw.runs : [])
      .map((entry) => normalizeRunSummary(entry))
      .filter(Boolean)
      .slice(-MAX_RUN_SUMMARIES)
  );
  const currentRunId = String(raw.currentRunId || "").trim();
  return {
    currentRunId: currentRunId && runs.some((entry) => entry.runId === currentRunId) ? currentRunId : null,
    runs,
    updatedAt: String(raw.updatedAt || ""),
  };
}

async function setRunSummariesState(next) {
  const runs = sortRunSummaries(
    (Array.isArray(next?.runs) ? next.runs : [])
      .map((entry) => normalizeRunSummary(entry))
      .filter(Boolean)
      .slice(-MAX_RUN_SUMMARIES)
  );
  const payload = {
    currentRunId: String(next?.currentRunId || "").trim() || null,
    runs,
    updatedAt: String(next?.updatedAt || nowIso()),
  };
  if (payload.currentRunId && !runs.some((entry) => entry.runId === payload.currentRunId)) {
    payload.currentRunId = null;
  }
  await chrome.storage.local.set({ [RUN_SUMMARY_STORAGE_KEY]: payload });
  return payload;
}

function findRunSummary(store, runId) {
  const key = String(runId || "").trim();
  if (!key) return null;
  return (Array.isArray(store?.runs) ? store.runs : []).find((entry) => entry.runId === key) || null;
}

async function upsertRunSummary(runId, updater) {
  const key = String(runId || "").trim();
  if (!key) return null;
  const store = await getRunSummariesState();
  const existing = findRunSummary(store, key) || {
    runId: key,
    startedAt: key,
    endedAt: null,
    lastUpdatedAt: key,
    counts: emptyRunCounts(),
    lastOutcome: null,
  };
  const nextSummary = normalizeRunSummary(
    typeof updater === "function" ? updater(existing, store) : existing
  );
  if (!nextSummary) return null;
  const nextRuns = [...store.runs.filter((entry) => entry.runId !== key), nextSummary];
  const nextStore = await setRunSummariesState({
    ...store,
    runs: nextRuns,
    updatedAt: nowIso(),
  });
  return findRunSummary(nextStore, key);
}

async function activateRunSummary(runId, startedAt = runId) {
  const key = String(runId || "").trim();
  if (!key) return null;
  const summary = await upsertRunSummary(key, (existing) => ({
    ...existing,
    runId: key,
    startedAt: String(startedAt || key).trim() || key,
    endedAt: null,
    lastUpdatedAt: nowIso(),
  }));
  const store = await getRunSummariesState();
  await setRunSummariesState({
    ...store,
    currentRunId: key,
    updatedAt: nowIso(),
  });
  return summary;
}

async function finishRunSummary(runId, endedAt = nowIso()) {
  const key = String(runId || "").trim();
  if (!key) return null;
  const summary = await upsertRunSummary(key, (existing) => ({
    ...existing,
    endedAt: String(endedAt || nowIso()),
    lastUpdatedAt: nowIso(),
  }));
  const store = await getRunSummariesState();
  if (store.currentRunId === key) {
    await setRunSummariesState({
      ...store,
      currentRunId: null,
      updatedAt: nowIso(),
    });
  }
  return summary;
}

function getCurrentRunSummary(store, state) {
  const startedAt = String(state?.startedAt || "").trim();
  if (startedAt) return findRunSummary(store, startedAt);
  if (store?.currentRunId) return findRunSummary(store, store.currentRunId);
  return null;
}

function withDurableRunCounts(state, runSummary) {
  const next = { ...(state || {}) };
  const counts = runSummary?.counts;
  if (!counts) return next;
  next.applied = Math.max(normalizeCount(next.applied), normalizeCount(counts.applied));
  next.skipped = Math.max(
    normalizeCount(next.skipped),
    normalizeCount(counts.skipped) + normalizeCount(counts.external)
  );
  next.failed = Math.max(normalizeCount(next.failed), normalizeCount(counts.failed));
  return next;
}

const DEFAULT_STATE = {
  running: false,
  paused: false,
  startedAt: null,
  applied: 0,
  skipped: 0,
  failed: 0,
  logs: [],
  lastError: null
};

const DEFAULT_SETTINGS = {
  settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
  apiBaseUrl: "http://localhost:5000/api",
  authToken: "",
  enableBackendSync: false,
  aiAnswerPath: "/ai/answer",
  dryRun: false,
  autoSubmit: true,
  liveModeAcknowledged: true,
  autoResumeOnAnswer: true,
  runNonStop: false,
  alternateSortBy: false,
  cycleDatePosted: false,
  stopDateCycleAt24hr: true,
  // Per-run caps. Free plan is still limited by daily free credits, not this.
  maxApplicationsPerRun: 200,
  maxSkipsPerRun: 200,
  switchNumber: 30,
  searchLocation: "",
  searchTerms: [],
  randomizeSearchOrder: false,
  sortBy: "",
  datePosted: "Past week",
  easyApplyOnly: true,
  salary: "",
  experienceLevel: [],
  jobType: [],
  onSite: [],
  companies: [],
  filterLocations: [],
  industry: [],
  jobFunction: [],
  jobTitles: [],
  benefits: [],
  commitments: [],
  under10Applicants: false,
  inYourNetwork: false,
  fairChanceEmployer: false,
  debugMode: false,
  blacklistedCompanies: [],
  aboutCompanyBadWords: [],
  aboutCompanyGoodWords: [],
  badWords: [],
  currentExperience: -1,
  didMasters: false,
  securityClearance: true,
  followCompanies: false,
  pauseBeforeSubmit: false,
  pauseAtFailedQuestion: true,
  overwritePreviousAnswers: false,
  manualAnswerWaitMs: 45000,
  currentCity: "",
  contactEmail: "",
  phoneNumber: "",
  phoneCountryCode: "",
  marketingConsent: "No",
  requireVisa: "No",
  usCitizenship: "",
  veteranStatus: "",
  disabilityStatus: "",
  gender: "",
  ethnicity: "",
  yearsOfExperienceAnswer: "",
  desiredSalary: "",
  currentCtc: "",
  noticePeriodDays: "",
  linkedinUrl: "",
  websiteUrl: "",
  recentEmployer: "",
  confidenceLevel: "",
  linkedinHeadline: "",
  linkedinSummary: "",
  coverLetter: "",
  firstName: "",
  middleName: "",
  lastName: "",
  fullName: "",
  streetAddress: "",
  stateRegion: "",
  postalCode: "",
  country: "",
  screeningAnswers: {}
};

let didSettingsMigration = false;

function nowIso() {
  return new Date().toISOString();
}

function currentUtcDateKey() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function nextUtcMidnightIso() {
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(0, 0, 0, 0);
  return next.toISOString();
}

async function getDailyCapState() {
  const dayKey = currentUtcDateKey();
  const snapshot = await chrome.storage.local.get(DAILY_CAP_STORAGE_KEY);
  const raw = snapshot?.[DAILY_CAP_STORAGE_KEY] || {};
  const existingDay = String(raw.dayKey || "");
  const usedRaw = Number(raw.used || 0);
  const capRaw = Number(raw.cap || EXT_DAILY_CAP);
  if (existingDay !== dayKey) {
    const reset = {
      dayKey,
      used: 0,
      cap: EXT_DAILY_CAP,
      resetAt: nextUtcMidnightIso(),
      updatedAt: nowIso(),
    };
    await chrome.storage.local.set({ [DAILY_CAP_STORAGE_KEY]: reset });
    return reset;
  }
  const normalized = {
    dayKey,
    used: Math.max(0, Math.floor(usedRaw)),
    cap: Math.max(1, Math.floor(capRaw || EXT_DAILY_CAP)),
    resetAt: String(raw.resetAt || nextUtcMidnightIso()),
    updatedAt: String(raw.updatedAt || nowIso()),
  };
  return normalized;
}

async function setDailyCapUsed(nextUsed) {
  const current = await getDailyCapState();
  const updated = {
    ...current,
    used: Math.max(0, Math.min(current.cap, Math.floor(nextUsed))),
    updatedAt: nowIso(),
  };
  await chrome.storage.local.set({ [DAILY_CAP_STORAGE_KEY]: updated });
  return updated;
}

function sanitizeApiBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").trim()).filter(Boolean);
  }
  const raw = String(value || "").trim();
  if (!raw) return [];
  return raw
    .split(/[\n,]/g)
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasWords(label, words) {
  return words.every((word) => label.includes(word));
}

function canonicalScreeningKey(label) {
  const n = normalizeLabel(label);
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
    (hasWords(n, ["authorized", "work"]) || hasWords(n, ["eligible", "work"]) || hasWords(n, ["work", "authorization"])) &&
    (n.includes("united states") || n.includes("u s") || n.includes("us"))
  ) {
    return "work_authorization_us";
  }
  if (hasWords(n, ["visa", "sponsorship"]) || hasWords(n, ["require", "sponsorship"])) {
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
  return canonicalScreeningKey(label);
}

function resolveScreeningAnswer(screeningAnswers, questionLabel) {
  const source = screeningAnswers && typeof screeningAnswers === "object" ? screeningAnswers : {};
  const raw = String(questionLabel || "").trim();
  const norm = normalizeLabel(raw);
  const key = questionKeyFromLabel(raw);

  const directCandidates = [raw, key, norm];
  for (const candidate of directCandidates) {
    if (!candidate) continue;
    const value = String(source[candidate] || "").trim();
    if (value) return value;
  }
  for (const [k, value] of Object.entries(source)) {
    const answer = String(value || "").trim();
    if (!answer) continue;
    if (normalizeLabel(k) === norm) return answer;
  }
  return "";
}

async function getState() {
  const { cpState } = await chrome.storage.local.get("cpState");
  return { ...DEFAULT_STATE, ...(cpState || {}) };
}

async function setState(next) {
  await chrome.storage.local.set({ cpState: next });
  return next;
}

async function getSettings() {
  const { cpSettings } = await chrome.storage.local.get("cpSettings");
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(cpSettings || {}),
    settingsSchemaVersion: Number(cpSettings?.settingsSchemaVersion ?? DEFAULT_SETTINGS.settingsSchemaVersion ?? 0),
    apiBaseUrl: sanitizeApiBaseUrl(cpSettings?.apiBaseUrl ?? DEFAULT_SETTINGS.apiBaseUrl),
    searchTerms: normalizeArray(cpSettings?.searchTerms ?? DEFAULT_SETTINGS.searchTerms),
    experienceLevel: normalizeArray(cpSettings?.experienceLevel ?? DEFAULT_SETTINGS.experienceLevel),
    jobType: normalizeArray(cpSettings?.jobType ?? DEFAULT_SETTINGS.jobType),
    onSite: normalizeArray(cpSettings?.onSite ?? DEFAULT_SETTINGS.onSite),
    companies: normalizeArray(cpSettings?.companies ?? DEFAULT_SETTINGS.companies),
    filterLocations: normalizeArray(cpSettings?.filterLocations ?? DEFAULT_SETTINGS.filterLocations),
    industry: normalizeArray(cpSettings?.industry ?? DEFAULT_SETTINGS.industry),
    jobFunction: normalizeArray(cpSettings?.jobFunction ?? DEFAULT_SETTINGS.jobFunction),
    jobTitles: normalizeArray(cpSettings?.jobTitles ?? DEFAULT_SETTINGS.jobTitles),
    benefits: normalizeArray(cpSettings?.benefits ?? DEFAULT_SETTINGS.benefits),
    commitments: normalizeArray(cpSettings?.commitments ?? DEFAULT_SETTINGS.commitments),
    blacklistedCompanies: normalizeArray(cpSettings?.blacklistedCompanies ?? DEFAULT_SETTINGS.blacklistedCompanies),
    aboutCompanyBadWords: normalizeArray(cpSettings?.aboutCompanyBadWords ?? DEFAULT_SETTINGS.aboutCompanyBadWords),
    aboutCompanyGoodWords: normalizeArray(cpSettings?.aboutCompanyGoodWords ?? DEFAULT_SETTINGS.aboutCompanyGoodWords),
    badWords: normalizeArray(cpSettings?.badWords ?? DEFAULT_SETTINGS.badWords)
  };

  // One-time migration: older builds forced maxApplicationsPerRun to 3.
  // Raise the default so paid Hires / Pro users don't stop after 3 applications per run.
  if (!didSettingsMigration) {
    didSettingsMigration = true;
    const currentVersion = Number(merged.settingsSchemaVersion || 0);
    const patch = {};
    if (currentVersion < SETTINGS_SCHEMA_VERSION) {
      patch.settingsSchemaVersion = SETTINGS_SCHEMA_VERSION;
      const rawMax = Number(merged.maxApplicationsPerRun ?? 0);
      if (!Number.isFinite(rawMax) || rawMax <= 3) {
        patch.maxApplicationsPerRun = 200;
      }
      // Keep debug off by default unless the user explicitly enabled it.
      if (cpSettings && typeof cpSettings.debugMode === "undefined") {
        patch.debugMode = false;
      }
      // Migration: Reset onSite filter if it was incorrectly set to only "Remote"
      const currentOnSite = normalizeArray(merged.onSite);
      if (currentOnSite.length === 1 && currentOnSite[0].toLowerCase() === 'remote') {
        console.log('[Indeed Migration] Resetting onSite filter from ["Remote"] to []');
        patch.onSite = [];
      }
    }
    if (Object.keys(patch).length > 0) {
      try {
        await chrome.storage.local.set({ cpSettings: { ...(cpSettings || {}), ...patch } });
        return { ...merged, ...patch };
      } catch {
        // ignore storage failures; merged fallback is still safe
      }
    }
  }

  return merged;
}

function apiHeaders(settings) {
  const headers = {
    "Content-Type": "application/json"
  };
  const token = String(settings?.authToken || "").trim();
  if (token) {
    headers.Authorization = token.toLowerCase().startsWith("bearer ") ? token : `Bearer ${token}`;
  }
  return headers;
}

async function postToApi(settings, path, payload) {
  if (!settings?.enableBackendSync) {
    return { ok: false, skipped: true, error: "backend sync disabled" };
  }
  const baseUrl = sanitizeApiBaseUrl(settings.apiBaseUrl);
  if (!baseUrl) {
    return { ok: false, skipped: true, error: "api base url missing" };
  }
  const normalizedPath = String(path || "").startsWith("/") ? path : `/${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}${normalizedPath}`, {
      method: "POST",
      headers: apiHeaders(settings),
      body: JSON.stringify(payload || {}),
      signal: controller.signal
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      body,
      error: response.ok ? null : body?.error || `HTTP ${response.status}`
    };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function pushLog(message, level = "info", meta = undefined) {
  const state = await getState();
  const entry = { ts: nowIso(), level, message, meta };
  const logs = [...(state.logs || []), entry].slice(-MAX_LOG_ENTRIES);
  await setState({ ...state, logs });

  const settings = await getSettings();
  void postToApi(settings, "/extension/logs", {
    ...entry,
    state: {
      running: state.running,
      paused: state.paused,
      applied: state.applied,
      skipped: state.skipped,
      failed: state.failed
    }
  });

  return entry;
}

function summarizeHistoryForExport(histories, startedAt, currentRunSummary = null) {
  const applied = Array.isArray(histories?.applied) ? histories.applied : [];
  const skipped = Array.isArray(histories?.skipped) ? histories.skipped : [];
  const failed = Array.isArray(histories?.failed) ? histories.failed : [];
  const external = Array.isArray(histories?.external) ? histories.external : [];

  const startMs = startedAt ? new Date(String(startedAt)).getTime() : NaN;
  const hasStart = Number.isFinite(startMs);
  const inRun = (entry) => {
    if (!hasStart) return false;
    const ts = new Date(String(entry?.ts || "")).getTime();
    return Number.isFinite(ts) && ts >= startMs;
  };
  const now = new Date();
  const isSameLocalDay = (entry) => {
    const ts = new Date(String(entry?.ts || ""));
    if (Number.isNaN(ts.getTime())) return false;
    return (
      ts.getFullYear() === now.getFullYear() &&
      ts.getMonth() === now.getMonth() &&
      ts.getDate() === now.getDate()
    );
  };

  const reasonCounts = {};
  const bumpReason = (entry) => {
    const code = String(entry?.data?.reasonCode || "UNKNOWN").trim().toUpperCase();
    if (!code) return;
    reasonCounts[code] = Number(reasonCounts[code] || 0) + 1;
  };
  for (const entry of applied) bumpReason(entry);
  for (const entry of skipped) bumpReason(entry);
  for (const entry of failed) bumpReason(entry);
  for (const entry of external) bumpReason(entry);

  const submitted = applied.filter((entry) => String(entry?.data?.reasonCode || "").toUpperCase() === "SUBMITTED");
  const submittedThisRun = submitted.filter((entry) => inRun(entry));
  const lastSubmitted = submitted.length ? submitted[submitted.length - 1] : null;
  const lastSubmittedJobId = extractLinkedInJobId(
    lastSubmitted?.data?.jobId || lastSubmitted?.data?.jobUrl || lastSubmitted?.data?.pageUrl
  );

  return {
    totals: {
      applied: applied.length,
      skipped: skipped.length,
      failed: failed.length,
      external: external.length,
    },
    today: {
      applied: applied.filter((entry) => isSameLocalDay(entry)).length,
      skipped: skipped.filter((entry) => isSameLocalDay(entry)).length,
      failed: failed.filter((entry) => isSameLocalDay(entry)).length,
      external: external.filter((entry) => isSameLocalDay(entry)).length,
      submitted: submitted.filter((entry) => isSameLocalDay(entry)).length,
    },
    currentRun: currentRunSummary
      ? {
          runId: String(currentRunSummary.runId || ""),
          startedAt: String(currentRunSummary.startedAt || ""),
          endedAt: currentRunSummary.endedAt ? String(currentRunSummary.endedAt) : null,
          counts: normalizeRunCounts(currentRunSummary.counts),
          lastOutcome: normalizeRunOutcome(currentRunSummary.lastOutcome),
        }
      : hasStart
      ? {
          runId: String(startedAt || ""),
          startedAt: String(startedAt || ""),
          endedAt: null,
          counts: {
            applied: applied.filter((entry) => inRun(entry)).length,
            skipped: skipped.filter((entry) => inRun(entry)).length,
            failed: failed.filter((entry) => inRun(entry)).length,
            external: external.filter((entry) => inRun(entry)).length,
            submitted: submittedThisRun.length,
          },
          lastOutcome: null,
        }
      : null,
    submitted: {
      total: submitted.length,
      thisRun: submittedThisRun.length,
      estimatedDeductionTotal: submitted.length,
      estimatedDeductionThisRun: submittedThisRun.length,
      last: lastSubmitted
        ? {
            ts: String(lastSubmitted.ts || ""),
            jobId: lastSubmittedJobId,
            title: String(lastSubmitted?.data?.title || "").trim(),
            company: String(lastSubmitted?.data?.company || "").trim(),
          }
        : null,
    },
    reasonCounts,
  };
}

async function exportLogs() {
  const state = await getState();
  const settings = await getSettings();
  const dailyCap = await getDailyCapState();
  const histories = await getRunHistory();
  const runStore = await getRunSummariesState();
  const currentRunSummary = getCurrentRunSummary(runStore, state);
  const queue = await getPortalQueue();
  const cooldown = await getPortalCooldown();
  const portalQuota = getPortalQuota();
  let historySummary = summarizeHistoryForExport(histories, state.startedAt, currentRunSummary);
  const historyTotalsCount =
    Number(historySummary?.totals?.applied || 0) +
    Number(historySummary?.totals?.skipped || 0) +
    Number(historySummary?.totals?.failed || 0) +
    Number(historySummary?.totals?.external || 0);
  const stateTotalsCount =
    Number(state?.applied || 0) + Number(state?.skipped || 0) + Number(state?.failed || 0);
  if (historyTotalsCount === 0 && stateTotalsCount > 0) {
    historySummary = {
      ...historySummary,
      totals: {
        applied: Number(state.applied || 0),
        skipped: Number(state.skipped || 0),
        failed: Number(state.failed || 0),
        external: 0,
      },
      submitted: {
        ...historySummary.submitted,
        total: Math.max(Number(historySummary?.submitted?.total || 0), Number(state.applied || 0)),
        thisRun: Math.max(Number(historySummary?.submitted?.thisRun || 0), Number(state.applied || 0)),
        estimatedDeductionTotal: Math.max(
          Number(historySummary?.submitted?.estimatedDeductionTotal || 0),
          Number(state.applied || 0),
        ),
        estimatedDeductionThisRun: Math.max(
          Number(historySummary?.submitted?.estimatedDeductionThisRun || 0),
          Number(state.applied || 0),
        ),
      },
    };
  }
  const syncOrigins = await detectPortalOriginsFromTabs();
  const queueByOutcome = {};
  for (const entry of queue) {
    const key = String(entry?.outcomeType || "UNKNOWN").toUpperCase();
    queueByOutcome[key] = Number(queueByOutcome[key] || 0) + 1;
  }
  const logs = Array.isArray(state.logs) ? state.logs : [];
  const sync404Count = logs.filter((entry) =>
    String(entry?.message || "").toLowerCase().includes("portal sync endpoint not found")
  ).length;
  const syncAuthCount = logs.filter((entry) =>
    String(entry?.message || "").toLowerCase().includes("portal sync needs login")
  ).length;
  const syncNetworkCount = logs.filter((entry) =>
    String(entry?.message || "").toLowerCase().includes("portal sync network issue")
  ).length;
  const q = portalQuota?.data && typeof portalQuota.data === "object" ? portalQuota.data : {};
  const runMode = settings?.dryRun ? "dry_run" : settings?.autoSubmit ? "auto_submit" : "manual_submit";
  const panelStatus = state.running ? "running" : state.paused ? "paused" : "idle";
  const cooldownUntilMs = Number(cooldown?.untilMs || 0);
  const cooldownRemainingMs = Math.max(0, cooldownUntilMs - Date.now());
  const hiresPlan = String(q?.plan || "").toLowerCase() || "unknown";
  const hireBalance = Math.max(0, Number(q?.hireBalance ?? 0));
  const freeRemaining = Math.max(0, Number(q?.freeRemaining ?? 0));
  const dailyRemaining = Math.max(0, Number(q?.dailyRemaining ?? 0));
  const spendable = Math.max(0, Number(q?.spendable ?? (hireBalance + freeRemaining)));
  const quotaUsed = Math.max(0, Number(q?.quotaUsed ?? 0));
  const quotaTotal = Math.max(1, Number(q?.quotaTotal ?? dailyCap.cap ?? 3));

  const payload = {
    exportedAt: nowIso(),
    state: {
      running: state.running,
      paused: state.paused,
      applied: state.applied,
      skipped: state.skipped,
      failed: state.failed,
      startedAt: state.startedAt,
      lastError: state.lastError
    },
    panel: {
      status: panelStatus,
      mode: runMode,
      startedAt: state.startedAt,
      counters: {
        applied: Number(state.applied || 0),
        skipped: Number(state.skipped || 0),
        failed: Number(state.failed || 0),
      },
    },
    hires: {
      plan: hiresPlan,
      total: {
        paidBalance: hireBalance,
        freeTodayCap: quotaTotal,
        freeTodayUsed: quotaUsed,
      },
      left: {
        spendable,
        paidBalance: hireBalance,
        freeTodayLeft: freeRemaining,
        dailyRemaining,
      },
      deducted: {
        estimatedFromSubmittedHistory: historySummary.submitted.estimatedDeductionTotal,
        estimatedThisRun: historySummary.submitted.estimatedDeductionThisRun,
        lastSynced: {
          ts: lastPortalSyncSnapshot.ts || null,
          chargedJobs: Number(lastPortalSyncSnapshot.chargedJobs || 0),
          consumedTotal: Number(lastPortalSyncSnapshot.consumedTotal || 0),
          freeConsumed: Number(lastPortalSyncSnapshot.freeConsumed || 0),
          paidConsumed: Number(lastPortalSyncSnapshot.paidConsumed || 0),
          chargeFailures: Number(lastPortalSyncSnapshot.chargeFailures || 0),
        },
      },
      lastJobDeduction: {
        fromSync: {
          jobId: lastPortalSyncSnapshot.lastChargedJobId || null,
          title: lastPortalSyncSnapshot.lastChargedJobTitle || null,
          company: lastPortalSyncSnapshot.lastChargedJobCompany || null,
          ts: lastPortalSyncSnapshot.ts || null,
        },
        fromHistory: historySummary.submitted.last,
      },
    },
    sync: {
      endpoint: "/api/extension/import",
      preferredOrigin: getPortalOrigin() || null,
      detectedOrigins: syncOrigins,
      queue: {
        pending: queue.length,
        byOutcome: queueByOutcome,
      },
      cooldown: {
        reason: String(cooldown?.reason || ""),
        untilMs: cooldownUntilMs,
        remainingMs: cooldownRemainingMs,
      },
      portalQuotaCache: {
        ts: Number(portalQuota.ts || 0),
        stale: Boolean(portalQuota.stale),
      },
      originState: {
        origin: normalizePortalOrigin(portalOriginState.origin) || null,
        failureCount: Number(portalOriginState.failureCount || 0),
        updatedAt: Number(portalOriginState.updatedAt || 0),
      },
      issues: {
        endpoint404: sync404Count,
        authRequired: syncAuthCount,
        network: syncNetworkCount,
      },
      lastSyncSnapshot: lastPortalSyncSnapshot,
    },
    historySummary,
    runSummaries: runStore,
    logs,
    history: histories
  };
  return JSON.stringify(payload, null, 2);
}

async function resetRunState() {
  const state = await getState();
  return setState({
    ...state,
    running: false,
    paused: false,
    startedAt: null,
    applied: 0,
    skipped: 0,
    failed: 0,
    lastError: null
  });
}

async function getRunHistory() {
  const snapshot = await chrome.storage.local.get(Object.values(HISTORY_KEY_MAP));
  return {
    applied: Array.isArray(snapshot.cpAppliedHistory) ? snapshot.cpAppliedHistory : [],
    failed: Array.isArray(snapshot.cpFailedHistory) ? snapshot.cpFailedHistory : [],
    external: Array.isArray(snapshot.cpExternalHistory) ? snapshot.cpExternalHistory : [],
    skipped: Array.isArray(snapshot.cpSkippedHistory) ? snapshot.cpSkippedHistory : []
  };
}

function extractLinkedInJobId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const indeedMatch = raw.match(/[?&](?:jk|vjk)=([a-z0-9_-]+)/i);
  if (EXTENSION_PROVIDER === "indeed" && indeedMatch?.[1]) return String(indeedMatch[1]);
  if (EXTENSION_PROVIDER === "indeed" && /^[a-z0-9_-]{8,}$/i.test(raw)) return raw;
  const viewMatch = raw.match(/\/jobs\/view\/(\d+)/i);
  if (viewMatch?.[1]) return String(viewMatch[1]);
  const currentJobIdMatch = raw.match(/[?&]currentJobId=(\d+)/i);
  if (currentJobIdMatch?.[1]) return String(currentJobIdMatch[1]);
  const jobIdMatch = raw.match(/[?&]jobId=(\d+)/i);
  if (jobIdMatch?.[1]) return String(jobIdMatch[1]);
  if (/^\d+$/.test(raw)) return raw;
  return "";
}

function collectAppliedJobIdsFromEntries(entries = []) {
  const out = new Set();
  for (const entry of entries) {
    const data = entry?.data && typeof entry.data === "object" ? entry.data : {};
    const reasonCode = String(data?.reasonCode || "").toUpperCase();
    const candidates = [
      data?.jobId,
      data?.externalJobId,
      data?.jobUrl,
      data?.pageUrl,
    ];
    for (const candidate of candidates) {
      const id = extractLinkedInJobId(candidate);
      if (id) out.add(id);
    }
    if (reasonCode === "ALREADY_APPLIED" || reasonCode === "APPLIED_CACHE_HIT") {
      const id = extractLinkedInJobId(data?.jobId || data?.jobUrl || data?.pageUrl);
      if (id) out.add(id);
    }
  }
  return out;
}

async function getAppliedJobIdsFromHistory(limit = 5000) {
  const history = await getRunHistory();
  const set = new Set();
  const appliedSet = collectAppliedJobIdsFromEntries(history.applied || []);
  for (const id of appliedSet) set.add(id);
  const skippedSet = collectAppliedJobIdsFromEntries(
    (history.skipped || []).filter((entry) => {
      const reasonCode = String(entry?.data?.reasonCode || "").toUpperCase();
      return reasonCode === "ALREADY_APPLIED" || reasonCode === "APPLIED_CACHE_HIT";
    })
  );
  for (const id of skippedSet) set.add(id);
  return Array.from(set).slice(-Math.max(1, Number(limit || 5000)));
}

async function getAppliedJobIdsFromPortal(limit = 400) {
  const set = new Set();
  const preferred = getPortalOrigin();
  const candidates = preferred
    ? [preferred, ...(await detectPortalOriginsFromTabs()).filter((o) => o !== preferred)]
    : await detectPortalOriginsFromTabs();
  const fetchLimit = Math.max(25, Math.min(1000, Number(limit || 400)));

  for (const origin of candidates) {
    try {
      const res = await fetch(`${origin}/api/auto-apply/jobs?limit=${fetchLimit}&page=1`, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });
      if (res.status === 401 || res.status === 403) continue;
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) continue;

      const jobs = Array.isArray(body?.data?.jobs) ? body.data.jobs : [];
      for (const job of jobs) {
        const status = String(job?.status || "").toLowerCase();
        const criteria = job?.criteriaJson && typeof job.criteriaJson === "object" ? job.criteriaJson : {};
        const reasonCode = String(criteria?.reasonCode || "").toUpperCase();
        const shouldCountApplied =
          status === "succeeded" ||
          reasonCode === "ALREADY_APPLIED" ||
          reasonCode === "APPLIED_CACHE_HIT";
        if (!shouldCountApplied) continue;
        const id = extractLinkedInJobId(criteria?.jobId || criteria?.jobUrl || criteria?.pageUrl);
        if (id) set.add(id);
      }

      if (set.size) return Array.from(set);
    } catch {
      // try next origin
    }
  }
  return Array.from(set);
}

async function getKnownAppliedJobIds(limit = 5000) {
  const set = new Set(await getAppliedJobIdsFromHistory(limit));
  const portalIds = await getAppliedJobIdsFromPortal(Math.min(600, Number(limit || 5000))).catch(() => []);
  for (const id of portalIds) {
    const normalized = String(id || "").trim();
    if (normalized) set.add(normalized);
  }
  return Array.from(set).slice(-Math.max(1, Number(limit || 5000)));
}

function buildHistoryEntryId(outcomeType, ts, data = {}) {
  const payload = data && typeof data === "object" ? data : {};
  const jobKey =
    extractLinkedInJobId(payload.jobUrl) ||
    extractLinkedInJobId(payload.pageUrl) ||
    extractLinkedInJobId(payload.jobId) ||
    String(payload.jobId || payload.externalJobId || "").trim() ||
    "unknown";
  const reasonCode = String(payload.reasonCode || "").trim().toUpperCase() || "NA";
  return `${EXTENSION_PROVIDER}:${String(outcomeType || "SKIPPED").toUpperCase()}:${jobKey}:${reasonCode}:${String(ts || "").trim()}`;
}

function buildRunOutcomeSnapshot(entry) {
  const data = entry?.data && typeof entry.data === "object" ? entry.data : {};
  return {
    ts: String(entry?.ts || ""),
    outcomeType: String(entry?.outcomeType || "").toUpperCase(),
    reasonCode: String(data.reasonCode || "").trim().toUpperCase(),
    jobId: String(
      extractLinkedInJobId(data.jobUrl) ||
      extractLinkedInJobId(data.pageUrl) ||
      data.jobId ||
      data.externalJobId ||
      ""
    ),
    title: String(data.title || "").trim(),
    company: String(data.company || "").trim(),
    entryId: String(entry?.entryId || "").trim(),
  };
}

async function appendRunHistory(outcomeType, data = {}, opts = {}) {
  const key = HISTORY_KEY_MAP[String(outcomeType || "").toUpperCase()] || HISTORY_KEY_MAP.SKIPPED;
  const current = await chrome.storage.local.get(key);
  const list = Array.isArray(current[key]) ? current[key] : [];
  const ts = String(opts.ts || nowIso());
  const runId = String(opts.runId || "").trim();
  const normalizedData = {
    ...(data && typeof data === "object" ? data : {}),
    provider: String(data?.provider || EXTENSION_PROVIDER).trim().toLowerCase() || EXTENSION_PROVIDER,
  };
  const entry = {
    ts,
    entryId: String(opts.entryId || buildHistoryEntryId(outcomeType, ts, normalizedData)).trim(),
    runId: runId || null,
    outcomeType: String(outcomeType || "SKIPPED").toUpperCase(),
    provider: EXTENSION_PROVIDER,
    data: normalizedData
  };
  const next = [...list, entry].slice(-MAX_HISTORY_ENTRIES);
  await chrome.storage.local.set({ [key]: next });

  const settings = await getSettings();
  void postToApi(settings, "/extension/outcomes", entry);
  return entry;
}

async function persistProgress(applied, skipped, failed) {
  const state = await getState();
  const runStore = await getRunSummariesState();
  const currentRun = getCurrentRunSummary(runStore, state);
  const currentCounts = currentRun?.counts || emptyRunCounts();
  const nextApplied = Math.max(
    normalizeCount(state.applied),
    normalizeCount(currentCounts.applied),
    normalizeCount(applied ?? state.applied)
  );
  const nextSkipped = Math.max(
    normalizeCount(state.skipped),
    normalizeCount(currentCounts.skipped) + normalizeCount(currentCounts.external),
    normalizeCount(skipped ?? state.skipped)
  );
  const nextFailed = Math.max(
    normalizeCount(state.failed),
    normalizeCount(currentCounts.failed),
    normalizeCount(failed ?? state.failed)
  );
  const next = await setState({
    ...state,
    applied: nextApplied,
    skipped: nextSkipped,
    failed: nextFailed
  });
  if (currentRun?.runId) {
    await upsertRunSummary(currentRun.runId, (existing) => ({
      ...existing,
      lastUpdatedAt: nowIso(),
      counts: {
        ...existing.counts,
        applied: Math.max(normalizeCount(existing.counts?.applied), nextApplied),
        skipped: Math.max(
          normalizeCount(existing.counts?.skipped),
          Math.max(0, nextSkipped - normalizeCount(existing.counts?.external))
        ),
        failed: Math.max(normalizeCount(existing.counts?.failed), nextFailed),
      },
    }));
  }
  const settings = await getSettings();
  void postToApi(settings, "/extension/progress", {
    ts: nowIso(),
    applied: next.applied,
    skipped: next.skipped,
    failed: next.failed,
    running: next.running,
    paused: next.paused
  });
  return next;
}

async function saveSettings(incoming = {}) {
  const current = await getSettings();
  const merged = {
    ...current,
    ...(incoming || {}),
    apiBaseUrl: sanitizeApiBaseUrl(incoming?.apiBaseUrl ?? current.apiBaseUrl),
    searchTerms: normalizeArray(incoming?.searchTerms ?? current.searchTerms),
    experienceLevel: normalizeArray(incoming?.experienceLevel ?? current.experienceLevel),
    jobType: normalizeArray(incoming?.jobType ?? current.jobType),
    onSite: normalizeArray(incoming?.onSite ?? current.onSite),
    companies: normalizeArray(incoming?.companies ?? current.companies),
    filterLocations: normalizeArray(incoming?.filterLocations ?? current.filterLocations),
    industry: normalizeArray(incoming?.industry ?? current.industry),
    jobFunction: normalizeArray(incoming?.jobFunction ?? current.jobFunction),
    jobTitles: normalizeArray(incoming?.jobTitles ?? current.jobTitles),
    benefits: normalizeArray(incoming?.benefits ?? current.benefits),
    commitments: normalizeArray(incoming?.commitments ?? current.commitments),
    blacklistedCompanies: normalizeArray(incoming?.blacklistedCompanies ?? current.blacklistedCompanies),
    aboutCompanyBadWords: normalizeArray(incoming?.aboutCompanyBadWords ?? current.aboutCompanyBadWords),
    aboutCompanyGoodWords: normalizeArray(incoming?.aboutCompanyGoodWords ?? current.aboutCompanyGoodWords),
    badWords: normalizeArray(incoming?.badWords ?? current.badWords),
    // Per-run cap; independent of daily free cap.
    maxApplicationsPerRun: Math.min(
      200,
      Math.max(1, Number((incoming?.maxApplicationsPerRun ?? current.maxApplicationsPerRun) ?? 1)),
    ),
    maxSkipsPerRun: Math.max(1, Number((incoming?.maxSkipsPerRun ?? current.maxSkipsPerRun) ?? 1)),
    switchNumber: Math.max(1, Number((incoming?.switchNumber ?? current.switchNumber) ?? 1)),
    manualAnswerWaitMs: Math.max(3000, Math.min(300000, Number((incoming?.manualAnswerWaitMs ?? current.manualAnswerWaitMs) ?? 45000))),
    currentExperience: Number.isFinite(Number(incoming?.currentExperience ?? current.currentExperience))
      ? Number(incoming?.currentExperience ?? current.currentExperience)
      : -1
  };
  await chrome.storage.local.set({ cpSettings: merged });
  return merged;
}

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  const capState = await getDailyCapState();
  const existing = await chrome.storage.local.get([
    "cpPendingQuestions",
    "cpAppliedHistory",
    "cpFailedHistory",
    "cpExternalHistory",
    "cpSkippedHistory",
    RUN_SUMMARY_STORAGE_KEY,
  ]);
  await chrome.storage.local.set({
    cpSettings: settings,
    cpState: await getState(),
    cpPendingQuestions: Array.isArray(existing.cpPendingQuestions) ? existing.cpPendingQuestions : [],
    cpAppliedHistory: Array.isArray(existing.cpAppliedHistory) ? existing.cpAppliedHistory : [],
    cpFailedHistory: Array.isArray(existing.cpFailedHistory) ? existing.cpFailedHistory : [],
    cpExternalHistory: Array.isArray(existing.cpExternalHistory) ? existing.cpExternalHistory : [],
    cpSkippedHistory: Array.isArray(existing.cpSkippedHistory) ? existing.cpSkippedHistory : [],
    [RUN_SUMMARY_STORAGE_KEY]:
      existing?.[RUN_SUMMARY_STORAGE_KEY] && typeof existing[RUN_SUMMARY_STORAGE_KEY] === "object"
        ? existing[RUN_SUMMARY_STORAGE_KEY]
        : { currentRunId: null, runs: [], updatedAt: nowIso() },
    [DAILY_CAP_STORAGE_KEY]: capState,
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (!message || !message.type) return;

    // Cloudflare challenge detection handler
    if (message.type === "CP_CLOUDFLARE_CHALLENGE_DETECTED") {
      const challenge = message.payload || {};
      console.warn("[CareerPilot] 🚨 Cloudflare Challenge Alert", {
        timestamp: new Date().toISOString(),
        url: challenge.url,
        rayId: challenge.rayId,
        pageTitle: challenge.pageTitle,
      });

      // Store challenge info for debugging
      const storedChallenges = await chrome.storage.local.get("cpCloudflareHistory") || {};
      const history = storedChallenges.cpCloudflareHistory || [];
      
      history.unshift({
        ...challenge,
        storedAt: new Date().toISOString(),
      });

      // Keep last 10 challenges
      if (history.length > 10) history.pop();
      
      await chrome.storage.local.set({ cpCloudflareHistory: history });

      sendResponse({ ok: true, stored: true });
      return;
    }

    // Safe SmartApply redirect handler
    if (message.type === "CP_SAFE_REDIRECT_SMARTAPPLY") {
      const url = String(message.url || "").trim();
      
      if (!url) {
        console.error("[CareerPilot] Safe redirect: URL missing");
        sendResponse({ ok: false, error: "URL missing" });
        return;
      }

      try {
        const urlObj = new URL(url);
        
        // Strict whitelist: only smartapply.indeed.com
        if (urlObj.hostname !== "smartapply.indeed.com" && !urlObj.hostname.endsWith(".smartapply.indeed.com")) {
          console.error("[CareerPilot] Security: Blocked redirect to untrusted domain:", urlObj.hostname);
          sendResponse({ ok: false, error: "Untrusted domain" });
          return;
        }

        // Validate path
        const pathname = urlObj.pathname;
        const validPaths = ['/beta/indeedapply/applybyapplyablejobid', '/resume-selection', '/questions'];
        const isValidPath = validPaths.some(path => pathname.includes(path)) || pathname.includes('/beta/');
        
        if (!isValidPath) {
          console.error("[CareerPilot] Security: Invalid SmartApply path:", pathname);
          sendResponse({ ok: false, error: "Invalid path" });
          return;
        }

        // For applybyapplyablejobid, validate parameters
        if (pathname.includes('applybyapplyablejobid')) {
          const params = urlObj.searchParams;
          if (!params.has('indeedApplyableJobId')) {
            console.error("[CareerPilot] Security: Missing indeedApplyableJobId parameter");
            sendResponse({ ok: false, error: "Missing required parameter" });
            return;
          }
        }

        console.log("[CareerPilot] ✅ Safe redirect validated:", {
          domain: urlObj.hostname,
          path: pathname,
        });

        // Open in new tab safely
        chrome.tabs.create({ url, active: true }, (tab) => {
          if (tab) {
            console.log("[CareerPilot] ✅ Opened SmartApply in tab:", tab.id);
            sendResponse({ ok: true, tabId: tab.id });
          } else {
            const error = chrome.runtime.lastError?.message || "Unknown error";
            console.error("[CareerPilot] Failed to open tab:", error);
            sendResponse({ ok: false, error });
          }
        });

      } catch (error) {
        console.error("[CareerPilot] Redirect validation error:", error?.message || error);
        sendResponse({ ok: false, error: error?.message || "Invalid URL" });
      }
      return;
    }

    if (message.type === "CP_GET_BOOTSTRAP") {
      const dailyCap = await getDailyCapState();
      const state = await getState();
      const runStore = await getRunSummariesState();
      const currentRunSummary = getCurrentRunSummary(runStore, state);
      const durableState = withDurableRunCounts(state, currentRunSummary);
      const history = await getRunHistory();
      const historySummary = summarizeHistoryForExport(history, durableState.startedAt, currentRunSummary);
      sendResponse({
        ok: true,
        state: durableState,
        settings: await getSettings(),
        dailyCap: {
          cap: dailyCap.cap,
          used: dailyCap.used,
          remaining: Math.max(0, dailyCap.cap - dailyCap.used),
          resetAt: dailyCap.resetAt,
        },
        currentRunSummary,
        runSummaries: runStore,
        historySummary,
        portalQuota: getPortalQuota(),
      });
      return;
    }

    if (message.type === "CP_SET_PORTAL_QUOTA") {
      setPortalQuota(message.data || null);
      sendResponse({ ok: true, portalQuota: getPortalQuota() });
      // Best-effort: if we have queued outcomes, try syncing now that we have an origin and likely auth cookies.
      void flushPortalImportsSoon();
      return;
    }

    if (message.type === "CP_GET_PORTAL_QUOTA") {
      sendResponse({ ok: true, portalQuota: getPortalQuota() });
      return;
    }

    if (message.type === "CP_START") {
      let settings = await getSettings();
      const dailyCap = await getDailyCapState();
      const remaining = Math.max(0, dailyCap.cap - dailyCap.used);
      let spendable = portalSpendable();
      if (remaining <= 0 && spendable <= 0) {
        // If we don't yet have portal quota loaded, refresh once before blocking.
        await refreshPortalQuota();
        spendable = portalSpendable();
      }
      if (remaining <= 0 && spendable <= 0) {
        await pushLog("Daily apply cap reached (3/day). Run blocked until reset.", "warn");
        sendResponse({
          ok: false,
          error: "Daily application cap reached (3/day). Try again after reset.",
          errorCode: "DAILY_CAP_REACHED",
          dailyCap: {
            cap: dailyCap.cap,
            used: dailyCap.used,
            remaining,
            resetAt: dailyCap.resetAt,
          },
        });
        return;
      }
      // If the user has spendable Hires/free credits, lift the per-run apply limit automatically
      // so runs don't stop after 3. User can still override in settings.
      if (spendable > 3) {
        const desired = Math.min(200, Math.max(5, Math.floor(spendable)));
        const currentMax = Number(settings.maxApplicationsPerRun || 0);
        if (!Number.isFinite(currentMax) || currentMax < desired) {
          settings = await saveSettings({ maxApplicationsPerRun: desired });
          await pushLog(`Auto-adjusted max applies per run to ${desired}`, "info");
        }
      }

      const state = await getState();
      const forceRestart = Boolean(message.forceRestart);
      const modeText = settings.dryRun
        ? "dry-run (no submit)"
        : settings.autoSubmit
        ? "auto-submit (will click Submit)"
        : "manual submit (no auto-submit)";
      if (state.running && !state.paused) {
        if (forceRestart) {
          if (state.startedAt) {
            await finishRunSummary(state.startedAt, nowIso());
          }
          const nextRunId = nowIso();
          const reset = await setState({
            ...state,
            running: false,
            paused: false,
            startedAt: null,
            applied: 0,
            skipped: 0,
            failed: 0,
            lastError: null
          });
          await pushLog("Run force-restarted by operator", "warn");
          const next = await setState({
            ...reset,
            running: true,
            paused: false,
            startedAt: nextRunId,
            lastError: null
          });
          await activateRunSummary(nextRunId, nextRunId);
        await pushLog(`Run started: ${modeText}`, "info");
        sendResponse({ ok: true, state: next });
        return;
      }
      await pushLog("Start ignored (already running)", "warn");
      sendResponse({ ok: true, state: withDurableRunCounts(state, getCurrentRunSummary(await getRunSummariesState(), state)) });
      return;
    }
      const nextRunId = String(state.startedAt || "").trim() || nowIso();
      const next = await setState({
        ...state,
        running: true,
        paused: false,
        startedAt: nextRunId,
        lastError: null
      });
      await activateRunSummary(nextRunId, nextRunId);
      await pushLog(`Run started: ${modeText}`, "info");
      sendResponse({ ok: true, state: next });
      return;
    }

    if (message.type === "CP_PAUSE") {
      const state = await getState();
      const next = await setState({
        ...state,
        paused: true,
        running: false
      });
      if (state.startedAt) {
        await activateRunSummary(state.startedAt, state.startedAt);
      }
      await pushLog("Run paused", "warn");
      sendResponse({ ok: true, state: next });
      return;
    }

    if (message.type === "CP_RESUME") {
      const dailyCap = await getDailyCapState();
      const remaining = Math.max(0, dailyCap.cap - dailyCap.used);
      let spendable = portalSpendable();
      if (remaining <= 0 && spendable <= 0) {
        await refreshPortalQuota();
        spendable = portalSpendable();
      }
      if (remaining <= 0 && spendable <= 0) {
        await pushLog("Resume blocked: daily apply cap reached.", "warn");
        sendResponse({
          ok: false,
          error: "Daily application cap reached (3/day).",
          errorCode: "DAILY_CAP_REACHED",
          dailyCap: {
            cap: dailyCap.cap,
            used: dailyCap.used,
            remaining,
            resetAt: dailyCap.resetAt,
          },
        });
        return;
      }
      const state = await getState();
      const nextRunId = String(state.startedAt || "").trim() || nowIso();
      const next = await setState({
        ...state,
        startedAt: nextRunId,
        paused: false,
        running: true
      });
      await activateRunSummary(nextRunId, nextRunId);
      await pushLog("Run resumed", "info");
      sendResponse({ ok: true, state: next });
      return;
    }

    if (message.type === "CP_STOP") {
      const state = await getState();
      if (state.startedAt) {
        await finishRunSummary(state.startedAt, nowIso());
      }
      const next = await resetRunState();
      await pushLog("Run stopped", "warn");
      sendResponse({ ok: true, state: next });
      return;
    }

    if (message.type === "CP_LOG") {
      await pushLog(message.message || "log", message.level || "info", message.meta);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "CP_PROGRESS") {
      const rawState = await getState();
      const runStore = await getRunSummariesState();
      const currentRunSummary = getCurrentRunSummary(runStore, rawState);
      const state = withDurableRunCounts(rawState, currentRunSummary);
      const incomingApplied = Math.max(0, Number(message.applied ?? state.applied ?? 0));
      const appliedDelta = Math.max(0, incomingApplied - Number(state.applied || 0));

      if (appliedDelta > 0) {
        const dailyCap = await getDailyCapState();
        const remaining = Math.max(0, dailyCap.cap - dailyCap.used);
        let spendable = portalSpendable();
        if (remaining <= 0 && spendable <= 0) {
          await refreshPortalQuota();
          spendable = portalSpendable();
        }
        if (remaining <= 0 && spendable <= 0) {
          const blocked = await setState({
            ...rawState,
            applied: state.applied,
            skipped: state.skipped,
            failed: state.failed,
            running: false,
            paused: true,
            lastError: "Daily application cap reached (3/day)",
          });
          sendResponse({
            ok: false,
            error: "Daily application cap reached (3/day).",
            errorCode: "DAILY_CAP_REACHED",
            state: blocked,
            dailyCap: {
              cap: dailyCap.cap,
              used: dailyCap.used,
              remaining: 0,
              resetAt: dailyCap.resetAt,
            },
          });
          return;
        }
        await setDailyCapUsed(dailyCap.used + Math.min(appliedDelta, remaining));
      }

      const next = await persistProgress(message.applied, message.skipped, message.failed);
      const dailyCap = await getDailyCapState();
      let spendable = portalSpendable();
      if (dailyCap.used >= dailyCap.cap && next.running && spendable <= 0) {
        await refreshPortalQuota();
        spendable = portalSpendable();
      }
      if (dailyCap.used >= dailyCap.cap && next.running && spendable <= 0) {
          const blocked = await setState({
          ...next,
          running: false,
          paused: true,
          lastError: "Daily application cap reached (3/day)",
        });
        sendResponse({
          ok: false,
          error: "Daily application cap reached (3/day).",
          errorCode: "DAILY_CAP_REACHED",
          state: blocked,
          dailyCap: {
            cap: dailyCap.cap,
            used: dailyCap.used,
            remaining: 0,
            resetAt: dailyCap.resetAt,
          },
        });
        return;
      }
      sendResponse({
        ok: true,
        state: next,
        dailyCap: {
          cap: dailyCap.cap,
          used: dailyCap.used,
          remaining: Math.max(0, dailyCap.cap - dailyCap.used),
          resetAt: dailyCap.resetAt,
        },
      });
      return;
    }

    if (message.type === "CP_RECORD_OUTCOME") {
      const outcomeType = String(message.outcomeType || "SKIPPED").toUpperCase();
      const data = {
        ...(message.data && typeof message.data === "object" ? message.data : {}),
        provider: EXTENSION_PROVIDER,
      };
      const state = await getState();
      const runStore = await getRunSummariesState();
      const runId =
        String(state.startedAt || "").trim() ||
        String(runStore.currentRunId || "").trim() ||
        nowIso();
      if (runId) {
        await activateRunSummary(runId, runId);
      }
      const entry = await appendRunHistory(outcomeType, message.data || {}, { runId });
      await upsertRunSummary(runId, (existing) => {
        const counts = normalizeRunCounts(existing.counts);
        if (outcomeType === "APPLIED") counts.applied += 1;
        else if (outcomeType === "FAILED") counts.failed += 1;
        else if (outcomeType === "EXTERNAL") counts.external += 1;
        else counts.skipped += 1;
        if (outcomeType === "APPLIED" && String(data.reasonCode || "").toUpperCase() === "SUBMITTED") {
          counts.submitted += 1;
        }
        return {
          ...existing,
          runId,
          startedAt: String(existing.startedAt || runId || "").trim() || runId,
          lastUpdatedAt: nowIso(),
          counts,
          lastOutcome: buildRunOutcomeSnapshot(entry),
        };
      });

      // Always enqueue outcome for portal import so Hires deduction stays in sync even if the dashboard isn't open.
      try {
        await enqueuePortalImport({
          ts: String(entry?.ts || nowIso()),
          outcomeType,
          data,
          entryId: String(entry?.entryId || buildPortalImportEntryId({ ts: entry?.ts || nowIso(), outcomeType, data })),
        });
      } catch {
        // ignore enqueue failures
      }

      // Optimistic portal quota updates so the panel shows live Hires usage even if dashboard isn't refreshed yet.
      try {
        const q = portalQuotaCache?.data;
        const reasonCode = String(data?.reasonCode || "").toUpperCase();
        if (outcomeType === "APPLIED" && reasonCode === "SUBMITTED" && q && typeof q === "object") {
          const freeRemaining = Math.max(0, Number(q.freeRemaining ?? 0));
          const quotaUsed = Math.max(0, Number(q.quotaUsed ?? 0));
          const quotaTotal = Math.max(1, Number(q.quotaTotal ?? 3));
          const hireBalance = Math.max(0, Number(q.hireBalance ?? 0));
          const dailyRemaining = Math.max(0, Number(q.dailyRemaining ?? 0));

          if (freeRemaining > 0) {
            q.freeRemaining = freeRemaining - 1;
            q.quotaUsed = Math.min(quotaTotal, quotaUsed + 1);
            // dailyRemaining tracks the free daily allowance only.
            q.dailyRemaining = Math.max(0, dailyRemaining - 1);
          } else if (hireBalance > 0) {
            q.hireBalance = hireBalance - 1;
          }
          q.spendable = Math.max(0, Number(q.hireBalance ?? 0) + Number(q.freeRemaining ?? 0));
          q._extEstimatedAt = nowIso();
          setPortalQuota(q);
        }
      } catch {
        // ignore optimistic quota update failures
      }

      sendResponse({ ok: true, entry });
      return;
    }

    if (message.type === "CP_GET_RUN_HISTORY") {
      sendResponse({ ok: true, history: await getRunHistory() });
      return;
    }

    if (message.type === "CP_GET_APPLIED_JOB_IDS") {
      const limit = Math.max(1, Math.min(10000, Number(message.limit || 5000)));
      sendResponse({ ok: true, jobIds: await getKnownAppliedJobIds(limit) });
      return;
    }

    if (message.type === "CP_CLEAR_RUN_HISTORY") {
      await chrome.storage.local.set({
        cpAppliedHistory: [],
        cpFailedHistory: [],
        cpExternalHistory: [],
        cpSkippedHistory: [],
        [RUN_SUMMARY_STORAGE_KEY]: { currentRunId: null, runs: [], updatedAt: nowIso() },
      });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "CP_SET_ERROR") {
      const state = await getState();
      const next = await setState({
        ...state,
        lastError: message.error || "Unknown error",
        running: false
      });
      await pushLog(`Error: ${next.lastError}`, "error");
      await appendRunHistory("FAILED", {
        reasonCode: "ENGINE_ERROR",
        reason: next.lastError
      });
      sendResponse({ ok: true, state: next });
      return;
    }

    if (message.type === "CP_SAVE_SETTINGS") {
      const next = await saveSettings(message.settings || {});
      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "CP_LOAD_SETTINGS") {
      sendResponse({ ok: true, settings: await getSettings() });
      return;
    }

    if (message.type === "CP_CLEAR_LOGS") {
      const state = await getState();
      await setState({ ...state, logs: [], lastError: null });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "CP_GET_LOG_EXPORT") {
      const logsJson = await exportLogs();
      sendResponse({ ok: true, logsJson });
      return;
    }

    if (message.type === "CP_GET_PENDING_QUESTIONS") {
      const { cpPendingQuestions } = await chrome.storage.local.get("cpPendingQuestions");
      sendResponse({ ok: true, questions: Array.isArray(cpPendingQuestions) ? cpPendingQuestions : [] });
      return;
    }

    if (message.type === "CP_REGISTER_PENDING_QUESTIONS") {
      const incoming = Array.isArray(message.questions) ? message.questions : [];
      const { cpPendingQuestions } = await chrome.storage.local.get("cpPendingQuestions");
      const merged = Array.isArray(cpPendingQuestions) ? [...cpPendingQuestions] : [];
      for (const q of incoming) {
        const key = String(q.questionKey || "").trim();
        const label = String(q.questionLabel || "").trim();
        if (!key || !label) continue;
        if (!merged.find((m) => String(m.questionKey) === key)) {
          merged.push({
            questionKey: key,
            questionLabel: label,
            validationMessage: String(q.validationMessage || "").trim(),
            createdAt: nowIso()
          });
        }
      }
      await chrome.storage.local.set({ cpPendingQuestions: merged });

      // Best effort: notify portal/admin about new unknown questions, and pull latest saved answers so the run can continue.
      void reportPendingQuestionsToPortal(merged);
      void refreshPortalScreeningAnswersIntoSettings();
      ensurePortalAnswerPoller();

      sendResponse({ ok: true, questions: merged });
      return;
    }

    if (message.type === "CP_SAVE_QUESTION_ANSWER") {
      const questionKey = String(message.questionKey || "").trim();
      const questionLabel = String(message.questionLabel || "").trim();
      const answer = String(message.answer || "").trim();
      if (!questionKey || !answer) {
        sendResponse({ ok: false, error: "questionKey and answer are required" });
        return;
      }

      const settings = await getSettings();
      const nextSettings = {
        ...settings,
        screeningAnswers: {
          ...(settings.screeningAnswers || {}),
          [questionKey]: answer,
          ...(questionLabel ? {
            [questionLabel.toLowerCase()]: answer,
            [normalizeLabel(questionLabel)]: answer,
            ...(questionKeyFromLabel(questionLabel) ? { [questionKeyFromLabel(questionLabel)]: answer } : {}),
          } : {})
        }
      };
      await chrome.storage.local.set({ cpSettings: nextSettings });

      const { cpPendingQuestions } = await chrome.storage.local.get("cpPendingQuestions");
      const nextQuestions = (Array.isArray(cpPendingQuestions) ? cpPendingQuestions : []).filter(
        (q) => String(q.questionKey || "") !== questionKey
      );
      await chrome.storage.local.set({ cpPendingQuestions: nextQuestions });

      const state = await getState();
      let nextState = state;
      if (nextSettings.autoResumeOnAnswer && nextQuestions.length === 0 && state.paused) {
        nextState = await setState({
          ...state,
          paused: false,
          running: true,
          startedAt: state.startedAt || nowIso(),
          lastError: null
        });
        await pushLog("Run auto-resumed after required answer saved", "info");
      }

      sendResponse({ ok: true, settings: nextSettings, questions: nextQuestions, state: nextState });
      return;
    }

    if (message.type === "CP_AI_ANSWER") {
      const settings = await getSettings();
      const screeningAnswer = resolveScreeningAnswer(settings.screeningAnswers || {}, message.question);
      if (screeningAnswer) {
        sendResponse({ ok: true, answer: screeningAnswer, source: "screening_answers" });
        return;
      }
      const path = String(settings.aiAnswerPath || "/ai/answer").trim() || "/ai/answer";
      const result = await postToApi(settings, path, {
        ts: nowIso(),
        question: String(message.question || "").trim(),
        questionType: String(message.questionType || "text").trim(),
        options: Array.isArray(message.options) ? message.options : [],
        validationMessage: String(message.validationMessage || "").trim(),
        jobContext: message.jobContext && typeof message.jobContext === "object" ? message.jobContext : {}
      });
      if (!result.ok) {
        sendResponse({ ok: false, error: result.error || "AI answer request failed" });
        return;
      }
      const body = result.body && typeof result.body === "object" ? result.body : {};
      const answer = String(body.answer ?? body.data?.answer ?? body.result?.answer ?? "").trim();
      if (!answer) {
        sendResponse({ ok: false, error: "AI response did not include answer" });
        return;
      }
      sendResponse({ ok: true, answer, raw: body });
      return;
    }

    if (message.type === "CP_INDEED_STATUS") {
      const tabs = await chrome.tabs.query({ url: ["https://www.indeed.com/*", "https://*.indeed.com/*"] });
      const hasIndeedTab = tabs.length > 0;
      const hasJobsTab = tabs.some((t) => String(t.url || "").includes("/jobs"));
      sendResponse({
        ok: true,
        provider: EXTENSION_PROVIDER,
        data: {
          hasIndeedTab,
          hasJobsTab
        }
      });
      return;
    }

    if (message.type === "CP_TOGGLE_PANEL") {
      await chrome.storage.local.set({ indeed_panel_enabled: Boolean(message.enabled) });
      const tabs = await chrome.tabs.query({ url: ["https://www.indeed.com/*", "https://*.indeed.com/*"] });
      for (const tab of tabs || []) {
        if (!tab?.id) continue;
        try {
          chrome.tabs.sendMessage(tab.id, {
            type: "CP_PANEL_VISIBILITY",
            enabled: Boolean(message.enabled),
          }, () => void 0);
        } catch {
          // ignore per-tab failures
        }
      }
      sendResponse({ ok: true, enabled: Boolean(message.enabled) });
      return;
    }

    if (message.type === "CP_GET_PANEL_ENABLED") {
      const snap = await chrome.storage.local.get("indeed_panel_enabled");
      sendResponse({ ok: true, enabled: Boolean(snap?.indeed_panel_enabled) });
      return;
    }
  })().catch(async (error) => {
    await pushLog(error?.message || String(error), "error");
    sendResponse({ ok: false, error: error?.message || "Internal extension error" });
  });

  return true;
});
