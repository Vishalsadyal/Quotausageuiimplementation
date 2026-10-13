/*
 * LinkedIn Jobs auto-apply - part 05: job-memory
 *
 * Extension-context checks (reload/update detection), sleep, and job memory: jobs seen this run,
 * the per-job outcome cache with TTLs, and the known-applied job id set.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

// After the extension is reloaded or updated, scripts already running in an open tab lose
// their connection: chrome.runtime.id goes away and getURL() returns "chrome-extension://invalid/".
function isExtensionContextValid() {
  try {
    return Boolean(chrome?.runtime?.id);
  } catch {
    return false;
  }
}

function extensionAssetUrl(path) {
  return isExtensionContextValid() ? chrome.runtime.getURL(path) : "";
}

function markContextInvalidated() {
  const wasAlive = extensionContextAlive;
  extensionContextAlive = false;
  if (!wasAlive) return;
  // Broken icon links make the page retry loading chrome-extension://invalid/ over and over.
  document.querySelectorAll("img[src^='chrome-extension://invalid']").forEach((img) => img.removeAttribute("src"));
  console.warn("[CP] Extension was reloaded or updated. Refresh this LinkedIn tab to reconnect AutoApply CV.");
  try {
    const log = document.querySelector(`#${PANEL_ID} #cp-log`);
    if (log && !log.querySelector(".cp-context-lost")) {
      const note = document.createElement("div");
      note.className = "cp-context-lost";
      note.style.cssText = "margin:8px;padding:8px 10px;border-radius:8px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:600";
      note.textContent = "Extension was updated. Refresh this page (F5) to reconnect.";
      log.prepend(note);
    }
  } catch {
    // panel may not exist
  }
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
