/*
 * LinkedIn Jobs auto-apply - part 03: submit-pace
 *
 * Human-like pacing between submissions: persisted pace range, random delay, wait-before-submit
 * with a countdown in the panel.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

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
