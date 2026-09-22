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
const EXTENSION_PROVIDER = "linkedin";

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

function normalizePortalOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
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

const SELECTORS_CACHE_KEY = "cpRemoteSelectors";
const SELECTORS_FETCH_INTERVAL_MS = 3600000;

async function fetchRemoteSelectors() {
  try {
    const origin = getPortalOrigin();
    if (!origin) return null;
    const res = await fetchWithTimeout(`${origin}/api/public/extension-selectors`, {}, 10000);
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.data?.selectors) {
      await chrome.storage.local.set({ [SELECTORS_CACHE_KEY]: json.data });
      return json.data;
    }
    return null;
  } catch {
    return null;
  }
}

async function getRemoteSelectors() {
  try {
    const snap = await chrome.storage.local.get(SELECTORS_CACHE_KEY);
    const cached = snap?.[SELECTORS_CACHE_KEY];
    if (cached && cached.selectors && cached.version) {
      const age = Date.now() - new Date(cached.updatedAt || 0).getTime();
      if (age < SELECTORS_FETCH_INTERVAL_MS) return cached;
    }
  } catch {}
  return fetchRemoteSelectors();
}

getRemoteSelectors();

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
    `[debug] Synced ${imported} update(s) to dashboard via ${origin}. Charged ${chargedJobs} (free ${freeConsumed}, paid ${paidConsumed}).`,
    "debug",
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
  try {
    chrome.alarms.create("cpPortalAnswerPoll", { periodInMinutes: 1.0 });
    portalAnswerPollTimer = true;
  } catch {
    // fallback: ignore if alarms permission not available
  }
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
  dryRun: true,
  autoSubmit: false,
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
  securityClearance: false,
  followCompanies: false,
  pauseBeforeSubmit: false,
  pauseAtFailedQuestion: true,
  overwritePreviousAnswers: false,
  manualAnswerWaitMs: 45000,
  submitRateMinSec: 40,
  submitRateMaxSec: 70,
  currentCity: "",
  contactEmail: "",
  phoneNumber: "",
  phoneCountryCode: "",
  marketingConsent: "Yes",
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
    if (/^\d+$/.test(normalized)) set.add(normalized);
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

// ─────────────────────────────────────────────────────────────────────────────
// Combined Extension Suite Constants & State Management
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_WA_SETTINGS = {
  targetKeywords: [
    'wordpress', 'shopify', 'php', 'web developer', 'frontend',
    'full stack', 'react', 'web designer', 'javascript', 'html',
    'developer', 'fresher', 'electrical', 'field engineer'
  ],
  messageTemplate: `Hi {name}!

I saw your hiring post on LinkedIn regarding the {job_title} role.

I am actively looking for new opportunities. Feel free to check out my portfolio & recent work:
🌐 https://parveen-portfolio-xi.vercel.app/

I am available for immediate joining and would love to connect and share more details!

Best regards,
Parveen`,
  autoSendWhatsApp: true,
  autoCloseTab: true,
  autoLikePosts: true,
  showAlreadyContacted: true,
  filterJobSeekers: true,
  matchAllHiringPosts: true,
  removeSentPostFromFeed: false,
  hideNonWhatsAppPosts: false,
  autoScroll: true,
  debugMode: true,
  delayBetweenMessages: 4
};

const DEFAULT_EMAIL_SETTINGS = {
  targetKeywords: [
    'wordpress',
    'shopify',
    'php',
    'web developer',
    'frontend',
    'full stack',
    'react',
    'web designer',
    'javascript',
    'html',
    'developer',
    'fresher',
    'electrical',
    'field engineer',
    'python',
    'node'
  ],
  subjectTemplate: 'Application for {job_title} - Parveen',
  messageTemplate: `Hi {name},

I saw your hiring post on LinkedIn regarding the {job_title} role at {company}.

I am actively looking for new opportunities and have hands-on experience in modern web technologies, WordPress, Shopify, React, and Full Stack development.

Feel free to check out my portfolio & recent work:
🌐 https://parveen-portfolio-xi.vercel.app/

I am available for immediate joining and would love to discuss how I can contribute to your team!

Best regards,
Parveen`,
  emailClient: 'gmail_web', // 'gmail_web' or 'mailto'
  autoCloseTab: false,
  autoLikePosts: false,
  showAlreadyContacted: true,
  filterJobSeekers: true,
  matchAllHiringPosts: true,
  removeSentPostFromFeed: false,
  hideNonEmailPosts: false,
  autoScroll: true,
  debugMode: true,
  delayBetweenEmails: 5
};

const DEFAULT_AC_SETTINGS = {
  commentText: "Hi! I am actively looking for new opportunities. Feel free to check out my portfolio & recent work: https://parveen-portfolio-xi.vercel.app/",
  delaySec: 4,
  maxComments: 25,
  autoLike: true,
  autoScroll: true,
  skipJobSeekers: true,
  skipAlreadyLiked: true,
  debugMode: true,
  filterKeywords: ""
};

let activeOutreachTask = null;
let activeEmailOutreachTask = null;

let acAppState = {
  isRunning: false,
  isPaused: false,
  sessionCount: 0,
  totalCount: 0,
  activeTabId: null,
  recentLogs: [],
  debugLogs: []
};

const MAX_JSO_CONTACTS = 100;
const JSO_STORAGE_KEY = 'jso_collected_hrs';
const JSO_LOG_KEY = 'jso_debug_logs';

function cleanPhoneNumber(raw) {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    digits = '91' + digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = '91' + digits.substring(1);
  }
  return digits;
}

async function saveLeadToStorage(lead) {
  const { waLeads = [], contactedPhones = [] } = await chrome.storage.local.get(['waLeads', 'contactedPhones']);
  const cleanPhone = cleanPhoneNumber(lead.phone);
  const existingIndex = waLeads.findIndex(l => l.cleanPhone === cleanPhone || (lead.urn && l.urn === lead.urn));
  const isAlreadyContacted = contactedPhones.includes(cleanPhone);

  const leadRecord = {
    id: lead.id || `lead_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    urn: lead.urn || '',
    recruiterName: lead.recruiterName || 'Hiring Manager',
    jobTitle: lead.jobTitle || 'Engineer',
    company: lead.company || '',
    rawPhone: lead.phone,
    cleanPhone: cleanPhone,
    postSnippet: lead.postSnippet || '',
    timestamp: lead.timestamp || new Date().toISOString(),
    status: isAlreadyContacted ? 'sent' : (lead.status || 'pending')
  };

  if (existingIndex >= 0) {
    waLeads[existingIndex] = { ...waLeads[existingIndex], ...leadRecord };
  } else {
    waLeads.unshift(leadRecord);
  }

  while (waLeads.length > 300) {
    waLeads.pop();
  }

  await chrome.storage.local.set({ waLeads });
  return { success: true, lead: leadRecord };
}

async function handleDispatchWhatsApp(lead) {
  const { waSettings, contactedPhones = [] } = await chrome.storage.local.get(['waSettings', 'contactedPhones']);
  const settings = waSettings || DEFAULT_WA_SETTINGS;
  const cleanPhone = cleanPhoneNumber(lead.phone);
  if (!cleanPhone) {
    throw new Error('Invalid phone number: ' + lead.phone);
  }

  let text = settings.messageTemplate || DEFAULT_WA_SETTINGS.messageTemplate;
  text = text.replace(/{name}/g, lead.recruiterName || 'Hiring Manager');
  text = text.replace(/{job_title}/g, lead.jobTitle || 'Engineer');
  text = text.replace(/{company}/g, lead.company || 'your team');
  text = text.replace(/{phone}/g, cleanPhone);

  const shouldAutoSend = lead.autoSend !== undefined ? Boolean(lead.autoSend) : (settings.autoSendWhatsApp !== false);
  const shouldAutoClose = lead.autoClose !== undefined ? Boolean(lead.autoClose) : (settings.autoCloseTab !== false);

  const encodedText = encodeURIComponent(text);
  const waUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}&app_absent=0&cp_auto_send=${shouldAutoSend ? '1' : '0'}&cp_auto_close=${shouldAutoClose ? '1' : '0'}`;

  // Strict single-tab policy: close any prior WhatsApp outreach tab before opening next
  if (activeOutreachTask && activeOutreachTask.tabId) {
    try {
      await chrome.tabs.remove(activeOutreachTask.tabId);
    } catch {
      // already closed
    }
  }

  activeOutreachTask = {
    leadId: lead.id,
    urn: lead.urn || '',
    phone: cleanPhone,
    recruiterName: lead.recruiterName,
    jobTitle: lead.jobTitle,
    company: lead.company,
    autoSend: shouldAutoSend,
    autoClose: shouldAutoClose,
    startTime: Date.now()
  };

  const tab = await chrome.tabs.create({ url: waUrl, active: true });
  activeOutreachTask.tabId = tab.id;
  return { success: true, tabId: tab.id, phone: cleanPhone };
}

async function handleMessageSent(payload, sender) {
  const phone = payload.phone || (activeOutreachTask ? activeOutreachTask.phone : null);
  const { waLeads = [], contactedPhones = [], contactedLog = [] } = await chrome.storage.local.get(['waLeads', 'contactedPhones', 'contactedLog']);

  if (phone && !contactedPhones.includes(phone)) {
    contactedPhones.push(phone);
  }

  const nowIsoStr = new Date().toISOString();
  const existingLogIndex = contactedLog.findIndex(item => item.phone === phone);
  const logEntry = {
    phone: phone,
    recruiterName: activeOutreachTask?.recruiterName || 'Recruiter',
    jobTitle: activeOutreachTask?.jobTitle || 'Role',
    company: activeOutreachTask?.company || '',
    urn: activeOutreachTask?.urn || '',
    sentAt: nowIsoStr
  };

  if (existingLogIndex >= 0) {
    contactedLog[existingLogIndex] = { ...contactedLog[existingLogIndex], ...logEntry };
  } else {
    contactedLog.unshift(logEntry);
  }

  const updatedLeads = waLeads.map(l => {
    if (l.cleanPhone === phone || (activeOutreachTask && l.id === activeOutreachTask.leadId)) {
      return { ...l, status: 'sent', sentAt: nowIsoStr };
    }
    return l;
  });

  await chrome.storage.local.set({
    waLeads: updatedLeads,
    contactedPhones: contactedPhones,
    contactedLog: contactedLog
  });

  chrome.tabs.query({ url: ["https://*.linkedin.com/*", "http://*.linkedin.com/*"] }, (tabs) => {
    tabs.forEach(t => {
      chrome.tabs.sendMessage(t.id, {
        type: 'LEAD_MESSAGE_SENT',
        payload: {
          phone: phone,
          urn: activeOutreachTask ? activeOutreachTask.urn : '',
          leadId: activeOutreachTask ? activeOutreachTask.leadId : ''
        }
      }).catch(() => {});
    });
  });

  const targetTabId = (sender && sender.tab && sender.tab.id) || (activeOutreachTask ? activeOutreachTask.tabId : null);
  const shouldClose = payload.autoClose !== false;
  if (shouldClose && targetTabId) {
    setTimeout(() => {
      chrome.tabs.remove(targetTabId).catch(() => {});
    }, 1000);
  }

  activeOutreachTask = null;
  return { success: true };
}

// ── Email Outreach Pro Helpers ──
async function saveEmailLeadToStorage(lead) {
  const { emailLeads = [], contactedEmails = [] } = await chrome.storage.local.get(['emailLeads', 'contactedEmails']);
  const cleanEmail = (lead.email || '').toLowerCase().trim();
  if (!cleanEmail) return { success: false, error: 'Empty email' };

  const existingIndex = emailLeads.findIndex(l => l.email === cleanEmail || (lead.urn && l.urn === lead.urn && l.email === cleanEmail));
  const isAlreadyContacted = contactedEmails.map(e => e.toLowerCase().trim()).includes(cleanEmail);

  const leadRecord = {
    id: lead.id || `lead_email_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    urn: lead.urn || '',
    recruiterName: lead.recruiterName || 'Hiring Manager',
    jobTitle: lead.jobTitle || 'Developer',
    company: lead.company || '',
    email: cleanEmail,
    matchedKeyword: lead.matchedKeyword || 'Hiring Post',
    postSnippet: lead.postSnippet || '',
    timestamp: lead.timestamp || new Date().toISOString(),
    status: isAlreadyContacted ? 'sent' : (lead.status || 'pending')
  };

  if (existingIndex >= 0) {
    emailLeads[existingIndex] = { ...emailLeads[existingIndex], ...leadRecord };
  } else {
    emailLeads.unshift(leadRecord);
  }

  while (emailLeads.length > 350) {
    emailLeads.pop();
  }

  await chrome.storage.local.set({ emailLeads });
  return { success: true, lead: leadRecord };
}

async function handleDispatchEmail(payload) {
  const lead = payload?.lead || payload;
  const { emailSettings, contactedEmails = [] } = await chrome.storage.local.get(['emailSettings', 'contactedEmails']);
  const settings = emailSettings || DEFAULT_EMAIL_SETTINGS;
  const cleanEmail = (lead.email || '').toLowerCase().trim();
  if (!cleanEmail) {
    throw new Error('Invalid email: ' + lead.email);
  }

  const clientMode = payload?.client || settings.emailClient || 'gmail_web';

  let subject = payload?.subjectTemplate || settings.subjectTemplate || DEFAULT_EMAIL_SETTINGS.subjectTemplate;
  subject = subject.replace(/{name}/g, lead.recruiterName || 'Hiring Manager');
  subject = subject.replace(/{job_title}/g, lead.jobTitle || 'Developer');
  subject = subject.replace(/{company}/g, lead.company || 'your team');
  subject = subject.replace(/{email}/g, cleanEmail);

  let body = payload?.messageTemplate || settings.messageTemplate || DEFAULT_EMAIL_SETTINGS.messageTemplate;
  body = body.replace(/{name}/g, lead.recruiterName || 'Hiring Manager');
  body = body.replace(/{job_title}/g, lead.jobTitle || 'Developer');
  body = body.replace(/{company}/g, lead.company || 'your team');
  body = body.replace(/{email}/g, cleanEmail);

  // Strict single-tab policy: close any prior Email outreach tab before opening next
  if (activeEmailOutreachTask && activeEmailOutreachTask.tabId) {
    try {
      await chrome.tabs.remove(activeEmailOutreachTask.tabId);
    } catch {
      // already closed
    }
  }

  activeEmailOutreachTask = {
    leadId: lead.id,
    urn: lead.urn || '',
    email: cleanEmail,
    recruiterName: lead.recruiterName,
    jobTitle: lead.jobTitle,
    company: lead.company,
    autoClose: settings.autoCloseTab,
    startTime: Date.now()
  };

  let targetUrl = '';
  if (clientMode === 'gmail_web') {
    targetUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(cleanEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const tab = await chrome.tabs.create({ url: targetUrl, active: true });
    activeEmailOutreachTask.tabId = tab.id;
    // content_gmail.js will handle auto-send and send EMAIL_MESSAGE_SENT
    return { success: true, tabId: tab.id, email: cleanEmail, client: 'gmail_web' };
  } else {
    targetUrl = `mailto:${cleanEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const tab = await chrome.tabs.create({ url: targetUrl, active: false });
    activeEmailOutreachTask.tabId = tab.id;
    setTimeout(() => {
      chrome.tabs.remove(tab.id).catch(() => {});
    }, 1500);
    await handleEmailMessageSent({ email: cleanEmail });
    return { success: true, email: cleanEmail, client: 'mailto' };
  }
}

async function handleEmailMessageSent(payload, sender) {
  const email = (payload?.email || (activeEmailOutreachTask ? activeEmailOutreachTask.email : null) || '').toLowerCase().trim();
  if (!email) return { success: false };

  const { emailLeads = [], contactedEmails = [], contactedEmailLog = [] } = await chrome.storage.local.get(['emailLeads', 'contactedEmails', 'contactedEmailLog']);

  const cleanContacted = contactedEmails.map(e => e.toLowerCase().trim());
  if (!cleanContacted.includes(email)) {
    cleanContacted.push(email);
  }

  const nowIsoStr = new Date().toISOString();
  const existingLogIndex = contactedEmailLog.findIndex(item => (item.email || '').toLowerCase().trim() === email);
  const logEntry = {
    email: email,
    recruiterName: activeEmailOutreachTask?.recruiterName || 'Recruiter',
    jobTitle: activeEmailOutreachTask?.jobTitle || 'Role',
    company: activeEmailOutreachTask?.company || '',
    urn: activeEmailOutreachTask?.urn || '',
    sentAt: nowIsoStr
  };

  if (existingLogIndex >= 0) {
    contactedEmailLog[existingLogIndex] = { ...contactedEmailLog[existingLogIndex], ...logEntry };
  } else {
    contactedEmailLog.unshift(logEntry);
  }

  const updatedLeads = emailLeads.map(l => {
    if ((l.email || '').toLowerCase().trim() === email || (activeEmailOutreachTask && l.id === activeEmailOutreachTask.leadId)) {
      return { ...l, status: 'sent', sentAt: nowIsoStr };
    }
    return l;
  });

  await chrome.storage.local.set({
    emailLeads: updatedLeads,
    contactedEmails: cleanContacted,
    contactedEmailLog: contactedEmailLog
  });

  chrome.tabs.query({ url: ["https://*.linkedin.com/*", "http://*.linkedin.com/*"] }, (tabs) => {
    tabs.forEach(t => {
      chrome.tabs.sendMessage(t.id, {
        type: 'EMAIL_LEAD_SENT',
        payload: {
          email: email,
          urn: activeEmailOutreachTask ? activeEmailOutreachTask.urn : '',
          leadId: activeEmailOutreachTask ? activeEmailOutreachTask.leadId : ''
        }
      }).catch(() => {});
    });
  });

  const shouldClose = payload?.autoClose !== undefined ? payload.autoClose : (activeEmailOutreachTask ? activeEmailOutreachTask.autoClose : false);
  if (shouldClose && sender && sender.tab && sender.tab.id) {
    setTimeout(() => {
      chrome.tabs.remove(sender.tab.id).catch(() => {});
    }, 1400);
  }

  activeEmailOutreachTask = null;
  return { success: true };
}

function addAcLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = { timestamp, message, type, id: Date.now() + Math.random() };
  acAppState.recentLogs.unshift(entry);
  if (acAppState.recentLogs.length > 50) acAppState.recentLogs.pop();
  return entry;
}

function addAcDebugLog(category, message, details = null) {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  const entry = {
    timestamp,
    category,
    message,
    details: details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null,
    id: Date.now() + Math.random()
  };
  acAppState.debugLogs.unshift(entry);
  if (acAppState.debugLogs.length > 150) acAppState.debugLogs.pop();
  return entry;
}

async function getJsoContacts() {
  const r = await chrome.storage.local.get(JSO_STORAGE_KEY);
  return r[JSO_STORAGE_KEY] ?? [];
}

async function addJsoContact(contact) {
  const contacts = await getJsoContacts();
  if (contacts.length >= MAX_JSO_CONTACTS) return { capped: true };
  const makeKey = c => (c.email || `${c.name}||${c.company}`).toLowerCase().trim();
  const seen = new Set(contacts.map(makeKey));
  if (seen.has(makeKey(contact))) return { duplicate: true };

  const updated = [...contacts, {
    ...contact,
    id: `hr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    collectedAt: new Date().toISOString(),
  }];
  await chrome.storage.local.set({ [JSO_STORAGE_KEY]: updated });
  return { added: true, count: updated.length };
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
    "waSettings",
    "waLeads",
    "contactedPhones",
    "contactedLog",
    "emailSettings",
    "emailLeads",
    "contactedEmails",
    "contactedEmailLog",
    "autoCommentSettings",
    "totalCommentedCount",
    "commentedUrns",
    JSO_STORAGE_KEY,
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
    waSettings: existing.waSettings ? { ...DEFAULT_WA_SETTINGS, ...existing.waSettings } : DEFAULT_WA_SETTINGS,
    waLeads: Array.isArray(existing.waLeads) ? existing.waLeads : [],
    contactedPhones: Array.isArray(existing.contactedPhones) ? existing.contactedPhones : [],
    contactedLog: Array.isArray(existing.contactedLog) ? existing.contactedLog : [],
    emailSettings: existing.emailSettings ? { ...DEFAULT_EMAIL_SETTINGS, ...existing.emailSettings } : DEFAULT_EMAIL_SETTINGS,
    emailLeads: Array.isArray(existing.emailLeads) ? existing.emailLeads : [],
    contactedEmails: Array.isArray(existing.contactedEmails) ? existing.contactedEmails : [],
    contactedEmailLog: Array.isArray(existing.contactedEmailLog) ? existing.contactedEmailLog : [],
    autoCommentSettings: existing.autoCommentSettings ? { ...DEFAULT_AC_SETTINGS, ...existing.autoCommentSettings } : DEFAULT_AC_SETTINGS,
    totalCommentedCount: typeof existing.totalCommentedCount === 'number' ? existing.totalCommentedCount : 0,
    commentedUrns: Array.isArray(existing.commentedUrns) ? existing.commentedUrns : [],
    [JSO_STORAGE_KEY]: Array.isArray(existing[JSO_STORAGE_KEY]) ? existing[JSO_STORAGE_KEY] : [],
    [RUN_SUMMARY_STORAGE_KEY]:
      existing?.[RUN_SUMMARY_STORAGE_KEY] && typeof existing[RUN_SUMMARY_STORAGE_KEY] === "object"
        ? existing[RUN_SUMMARY_STORAGE_KEY]
        : { currentRunId: null, runs: [], updatedAt: nowIso() },
    [DAILY_CAP_STORAGE_KEY]: capState,
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "cpPortalAnswerPoll") return;
  try {
    const snap = await chrome.storage.local.get("cpPendingQuestions");
    const pending = Array.isArray(snap?.cpPendingQuestions) ? snap.cpPendingQuestions : [];
    if (!pending.length) {
      chrome.alarms.clear("cpPortalAnswerPoll");
      portalAnswerPollTimer = null;
      return;
    }
    await refreshPortalScreeningAnswersIntoSettings();
  } catch {
    // ignore
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (!message || !message.type) return;

    if (message.type === "CP_GET_SELECTORS") {
      const selectors = await getRemoteSelectors();
      sendResponse({ ok: true, selectors: selectors?.selectors || null, version: selectors?.version || 0 });
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

    if (message.type === "CP_CLEAR_LOGS") {
      const rawState = await getState();
      const next = await setState({
        ...rawState,
        logs: [],
        applied: 0,
        skipped: 0,
        failed: 0,
        lastError: null
      });
      sendResponse({ ok: true, state: next });
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

      const preferred = getPortalOrigin();
      const candidates = preferred ? [preferred, ...(await detectPortalOriginsFromTabs()).filter((o) => o !== preferred)] : await detectPortalOriginsFromTabs();
      const targetOrigins = candidates.length ? candidates : [settings.apiBaseUrl ? new URL(settings.apiBaseUrl).origin : "http://localhost:3000"];

      for (const origin of targetOrigins) {
        try {
          const res = await fetch(`${origin}/api/ai/answer`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(settings.authToken ? { Authorization: settings.authToken.startsWith("Bearer ") ? settings.authToken : `Bearer ${settings.authToken}` } : {})
            },
            credentials: "include",
            body: JSON.stringify({
              question: String(message.question || "").trim(),
              questionType: String(message.questionType || "text").trim(),
              options: Array.isArray(message.options) ? message.options : [],
              validationMessage: String(message.validationMessage || "").trim(),
              jobContext: message.jobContext && typeof message.jobContext === "object" ? message.jobContext : {}
            })
          });
          const body = await res.json().catch(() => null);
          if (res.ok && body?.success && body?.data?.answer) {
            sendResponse({ ok: true, answer: body.data.answer, source: body.data.source || "ai_resume" });
            return;
          }
        } catch {
          // try next origin
        }
      }

      // If backend call fails, fallback to intelligent heuristic answer
      sendResponse({ ok: false, error: "AI answer request failed" });
      return;
    }

    if (message.type === "CP_LINKEDIN_STATUS") {
      const tabs = await chrome.tabs.query({ url: "https://www.linkedin.com/*" });
      const hasLinkedInTab = tabs.length > 0;
      const hasJobsTab = tabs.some((t) => String(t.url || "").includes("/jobs"));
      sendResponse({
        ok: true,
        provider: EXTENSION_PROVIDER,
        data: {
          hasLinkedInTab,
          hasJobsTab
        }
      });
      return;
    }

    if (message.type === "CP_INDEED_STATUS") {
      const tabs = await chrome.tabs.query({ url: "*://*.indeed.com/*" });
      const hasIndeedTab = tabs.length > 0;
      const hasJobsTab = tabs.some((t) => String(t.url || "").includes("/jobs") || String(t.url || "").includes("/viewjob"));
      sendResponse({
        ok: true,
        provider: "indeed",
        data: {
          hasIndeedTab,
          hasJobsTab
        }
      });
      return;
    }

    if (message.type === "CP_CLOUDFLARE_CHALLENGE_DETECTED") {
      await pushLog(`Cloudflare challenge detected on Indeed (Ray ID: ${message.payload?.cfRayId || 'unknown'})`, 'warn');
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "CP_SAFE_REDIRECT_SMARTAPPLY") {
      const targetUrl = String(message.url || "").trim();
      if (targetUrl && (targetUrl.includes("smartapply.indeed.com") || targetUrl.includes("indeed.com"))) {
        const tab = await chrome.tabs.create({ url: targetUrl, active: true });
        sendResponse({ ok: true, tabId: tab.id });
      } else {
        sendResponse({ ok: false, error: "Invalid redirect URL" });
      }
      return;
    }

    // ── WhatsApp Outreach Message Handlers ──
    if (message.type === "DISPATCH_WHATSAPP_MESSAGE") {
      const result = await handleDispatchWhatsApp(message.payload);
      sendResponse(result);
      return;
    }

    if (message.type === "WHATSAPP_MESSAGE_SENT") {
      const result = await handleMessageSent(message.payload, sender);
      sendResponse(result);
      return;
    }

    if (message.type === "WA_NUMBER_INVALID") {
      const phone = message.payload?.phone || '';
      const data = await chrome.storage.local.get(['invalidPhones']);
      const invalidPhones = data.invalidPhones || [];
      if (phone && !invalidPhones.includes(phone)) {
        invalidPhones.push(phone);
        await chrome.storage.local.set({ invalidPhones });
      }
      sendResponse({ success: true });
      return;
    }

    if (message.type === "DUPLICATE_WA_DETECTED") {
      const phone = message.payload?.phone || '';
      const data = await chrome.storage.local.get(['duplicateStats', 'contactedPhones']);
      const duplicateStats = data.duplicateStats || { skippedCount: 0 };
      duplicateStats.skippedCount = (duplicateStats.skippedCount || 0) + 1;
      await chrome.storage.local.set({ duplicateStats });
      sendResponse({ success: true, skippedCount: duplicateStats.skippedCount });
      return;
    }

    if (message.type === "WA_CHECK_TAB_STATUS") {
      const tabId = message.payload?.tabId;
      if (!tabId) {
        sendResponse({ open: false });
        return;
      }
      try {
        const tab = await chrome.tabs.get(tabId);
        sendResponse({ open: Boolean(tab && tab.id) });
      } catch {
        sendResponse({ open: false });
      }
      return;
    }

    if (message.type === "WA_CLOSE_TAB") {
      if (sender && sender.tab && sender.tab.id) {
        chrome.tabs.remove(sender.tab.id).catch(() => {});
      }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "WA_CLOSE_TAB_ID") {
      const tabId = message.payload?.tabId;
      if (tabId) {
        chrome.tabs.remove(tabId).catch(() => {});
      }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "SAVE_LEAD") {
      const result = await saveLeadToStorage(message.payload);
      sendResponse(result);
      return;
    }

    if (message.type === "WA_GET_STATUS" || (message.type === "GET_STATUS" && message.module === "wa")) {
      const data = await chrome.storage.local.get(['waSettings', 'waLeads', 'contactedPhones', 'contactedLog', 'duplicateStats']);
      sendResponse({
        settings: data.waSettings || DEFAULT_WA_SETTINGS,
        totalLeads: (data.waLeads || []).length,
        contactedCount: (data.contactedPhones || []).length,
        contactedLog: data.contactedLog || [],
        duplicateStats: data.duplicateStats || { skippedCount: 0 },
        activeTask: activeOutreachTask
      });
      return;
    }

    if (message.type === "WA_SAVE_SETTINGS") {
      const current = (await chrome.storage.local.get('waSettings')).waSettings || DEFAULT_WA_SETTINGS;
      const merged = { ...current, ...(message.payload?.settings || {}) };
      await chrome.storage.local.set({ waSettings: merged });
      sendResponse({ success: true, settings: merged });
      return;
    }

    // ── Email Outreach Pro Message Handlers ──
    if (message.type === "DISPATCH_EMAIL_MESSAGE") {
      const result = await handleDispatchEmail(message.payload);
      sendResponse(result);
      return;
    }

    if (message.type === "EMAIL_MESSAGE_SENT") {
      const result = await handleEmailMessageSent(message.payload, sender);
      sendResponse(result);
      return;
    }

    if (message.type === "DUPLICATE_EMAIL_DETECTED") {
      const data = await chrome.storage.local.get(['duplicateEmailStats']);
      const duplicateStats = data.duplicateEmailStats || { skippedCount: 0 };
      duplicateStats.skippedCount = (duplicateStats.skippedCount || 0) + 1;
      await chrome.storage.local.set({ duplicateEmailStats: duplicateStats });
      sendResponse({ success: true, skippedCount: duplicateStats.skippedCount });
      return;
    }

    if (message.type === "EMAIL_CHECK_TAB_STATUS") {
      const tabId = message.payload?.tabId;
      if (!tabId) {
        sendResponse({ open: false });
        return;
      }
      try {
        const tab = await chrome.tabs.get(tabId);
        sendResponse({ open: Boolean(tab && tab.id) });
      } catch {
        sendResponse({ open: false });
      }
      return;
    }

    if (message.type === "SAVE_EMAIL_LEAD") {
      const result = await saveEmailLeadToStorage(message.payload);
      sendResponse(result);
      return;
    }

    if (message.type === "EMAIL_GET_STATUS" || (message.type === "GET_STATUS" && message.module === "email")) {
      const data = await chrome.storage.local.get(['emailSettings', 'emailLeads', 'contactedEmails', 'contactedEmailLog', 'duplicateEmailStats']);
      sendResponse({
        settings: data.emailSettings || DEFAULT_EMAIL_SETTINGS,
        totalLeads: (data.emailLeads || []).length,
        contactedCount: (data.contactedEmails || []).length,
        contactedLog: data.contactedEmailLog || [],
        duplicateStats: data.duplicateEmailStats || { skippedCount: 0 },
        activeTask: activeEmailOutreachTask
      });
      return;
    }

    if (message.type === "EMAIL_SAVE_SETTINGS") {
      await chrome.storage.local.set({ emailSettings: message.payload?.settings || DEFAULT_EMAIL_SETTINGS });
      sendResponse({ success: true });
      return;
    }

    // ── Auto Commenter Message Handlers ──
    if (message.type === "AC_GET_STATUS" || (message.type === "GET_STATUS" && message.module === "ac")) {
      const data = await chrome.storage.local.get(['autoCommentSettings', 'totalCommentedCount', 'commentedUrns']);
      sendResponse({
        state: acAppState,
        settings: data.autoCommentSettings || DEFAULT_AC_SETTINGS,
        totalCount: data.totalCommentedCount || 0,
        savedUrnsCount: (data.commentedUrns || []).length,
        debugLogs: acAppState.debugLogs
      });
      return;
    }

    if (message.type === "START_COMMENTING") {
      acAppState.isRunning = true;
      acAppState.isPaused = false;
      acAppState.sessionCount = 0;
      addAcLog('🚀 Auto commenting started', 'success');

      const tabId = sender.tab ? sender.tab.id : null;
      if (tabId) {
        acAppState.activeTabId = tabId;
        chrome.tabs.sendMessage(tabId, { type: 'CMD_START', payload: { settings: message.payload?.settings } }).catch(() => {});
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            acAppState.activeTabId = tabs[0].id;
            chrome.tabs.sendMessage(tabs[0].id, { type: 'CMD_START', payload: { settings: message.payload?.settings } }).catch(() => {});
          }
        });
      }
      sendResponse({ success: true, state: acAppState });
      return;
    }

    if (message.type === "PAUSE_COMMENTING") {
      acAppState.isPaused = true;
      addAcLog('⏸️ Auto commenting paused', 'warning');
      if (acAppState.activeTabId) {
        chrome.tabs.sendMessage(acAppState.activeTabId, { type: 'CMD_PAUSE' }).catch(() => {});
      }
      sendResponse({ success: true, state: acAppState });
      return;
    }

    if (message.type === "RESUME_COMMENTING") {
      acAppState.isPaused = false;
      addAcLog('▶️ Auto commenting resumed', 'info');
      if (acAppState.activeTabId) {
        chrome.tabs.sendMessage(acAppState.activeTabId, { type: 'CMD_RESUME' }).catch(() => {});
      }
      sendResponse({ success: true, state: acAppState });
      return;
    }

    if (message.type === "STOP_COMMENTING") {
      acAppState.isRunning = false;
      acAppState.isPaused = false;
      addAcLog(`⏹️ Stopped commenting. Completed ${acAppState.sessionCount} comments.`, 'info');
      if (acAppState.activeTabId) {
        chrome.tabs.sendMessage(acAppState.activeTabId, { type: 'CMD_STOP' }).catch(() => {});
      }
      sendResponse({ success: true, state: acAppState });
      return;
    }

    if (message.type === "TEST_SINGLE_POST") {
      const tabId = sender.tab ? sender.tab.id : acAppState.activeTabId;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { type: 'CMD_TEST_SINGLE', payload: { settings: message.payload?.settings } }).catch(() => {});
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'CMD_TEST_SINGLE', payload: { settings: message.payload?.settings } }).catch(() => {});
          }
        });
      }
      sendResponse({ success: true });
      return;
    }

    if (message.type === "EVENT_COMMENTED") {
      acAppState.sessionCount += 1;
      const urn = message.payload?.urn;
      const author = message.payload?.author || 'Author';
      addAcLog(`💬 Commented on post by ${author}`, 'success');

      const data = await chrome.storage.local.get(['totalCommentedCount', 'commentedUrns']);
      const total = (data.totalCommentedCount || 0) + 1;
      const urns = data.commentedUrns || [];
      if (urn && !urns.includes(urn)) urns.push(urn);
      await chrome.storage.local.set({ totalCommentedCount: total, commentedUrns: urns });
      acAppState.totalCount = total;

      sendResponse({ success: true, sessionCount: acAppState.sessionCount });
      return;
    }

    if (message.type === "EVENT_LOG") {
      addAcLog(message.payload?.message, message.payload?.logType || 'info');
      sendResponse({ success: true });
      return;
    }

    if (message.type === "DEBUG_LOG") {
      addAcDebugLog(message.payload?.category || 'DOM', message.payload?.message, message.payload?.details);
      sendResponse({ success: true });
      return;
    }

    if (message.type === "RESET_HISTORY") {
      await chrome.storage.local.set({ totalCommentedCount: 0, commentedUrns: [] });
      acAppState.sessionCount = 0;
      acAppState.totalCount = 0;
      acAppState.recentLogs = [];
      acAppState.debugLogs = [];
      sendResponse({ success: true });
      return;
    }

    // ── Jobs Smart HR Outreach Message Handlers ──
    if (message.type === "JSO_GET_CONTACTS") {
      const contacts = await getJsoContacts();
      sendResponse({ contacts, count: contacts.length, max: MAX_JSO_CONTACTS });
      return;
    }

    if (message.type === "JSO_ADD_CONTACT" || message.type === "JSO_QUEUE_PROFILE_FOR_EMAIL") {
      if (message.contact?.name || message.contact?.email) {
        const result = await addJsoContact(message.contact);
        sendResponse(result);
      } else {
        sendResponse({ skipped: true });
      }
      return;
    }

    if (message.type === "JSO_CLEAR_CONTACTS") {
      await chrome.storage.local.set({ [JSO_STORAGE_KEY]: [], jso_is_collecting: false, jso_active_run_id: '' });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "JSO_START_COLLECTING") {
      const contacts = await getJsoContacts();
      if (contacts.length >= MAX_JSO_CONTACTS) {
        sendResponse({ ok: false, reason: 'capped' });
        return;
      }
      const kw = message.keyword || 'we are hiring';
      const cat = message.category || '';
      await chrome.storage.local.set({
        jso_is_collecting: true,
        jso_keyword: kw,
        jso_category: cat,
        jso_last_error: '',
        jso_active_run_id: Date.now().toString()
      });

      // Broadcast to LinkedIn tabs to start scraping
      chrome.tabs.query({ url: "https://*.linkedin.com/*" }, (tabs) => {
        tabs.forEach((t) => {
          chrome.tabs.sendMessage(t.id, { type: 'JSO_START_SCRAPE', keyword: kw, category: cat }).catch(() => {});
        });
      });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "JSO_STOP_COLLECTING") {
      await chrome.storage.local.set({ jso_is_collecting: false, jso_last_error: '', jso_active_run_id: '' });
      chrome.tabs.query({ url: "https://*.linkedin.com/*" }, (tabs) => {
        tabs.forEach((t) => {
          chrome.tabs.sendMessage(t.id, { type: 'JSO_STOP_SCRAPE' }).catch(() => {});
        });
      });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "JSO_GET_STATUS") {
      const contacts = await getJsoContacts();
      const stored = await chrome.storage.local.get(['jso_is_collecting', 'jso_keyword', 'jso_category', 'jso_preferred_origin', 'jso_last_error']);
      sendResponse({
        count: contacts.length,
        max: MAX_JSO_CONTACTS,
        isCollecting: !!stored.jso_is_collecting,
        keyword: stored.jso_keyword ?? 'we are hiring',
        category: stored.jso_category ?? '',
        preferredOrigin: stored.jso_preferred_origin ?? '',
        lastError: String(stored.jso_last_error || '')
      });
      return;
    }

    if (message.type === "JSO_SCRAPE_DONE") {
      await chrome.storage.local.set({ jso_is_collecting: false, jso_active_run_id: '' });
      const contacts = await getJsoContacts();
      chrome.runtime.sendMessage({ type: 'JSO_COLLECTING_DONE', count: contacts.length }).catch(() => {});
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "JSO_SYNC_TO_DASHBOARD") {
      const origin = getPortalOrigin() || PORTAL_DEFAULT_ORIGIN;
      const targetUrl = `${origin}/dashboard/cold-emails`;
      const tabs = await chrome.tabs.query({});
      const dashTab = tabs.find(t => String(t.url || '').startsWith(origin));
      if (dashTab?.id) {
        chrome.tabs.update(dashTab.id, { active: true, url: targetUrl });
        chrome.windows.update(dashTab.windowId, { focused: true });
      } else {
        chrome.tabs.create({ url: targetUrl });
      }
      sendResponse({ ok: true });
      return;
    }
  })().catch(async (error) => {
    await pushLog(error?.message || String(error), "error");
    sendResponse({ ok: false, error: error?.message || "Internal extension error" });
  });

  return true;
});
