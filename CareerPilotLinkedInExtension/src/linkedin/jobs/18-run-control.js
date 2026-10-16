/*
 * LinkedIn Jobs auto-apply - part 18: run-control
 *
 * Preparing a run, live auto-submit toggle, and the panel chat commands (start, pause, set city,
 * clear locations, ...).
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

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
      await reportStartFailure(startRes, "Could not start auto-submit run.");
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
      await reportStartFailure(startRes, "Auto-submit run start failed.");
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
      await reportStartFailure(startRes, "Run start failed. Check settings.");
      return;
    }
    await botChat("Run started. AI Copilot is now scanning for jobs...");
    return;
  }
  if (cmd === "restart" || cmd === "/restart") {
    const startRes = await sendMessage({ type: "CP_START", forceRestart: true });
    if (!startRes?.ok) {
      await reportStartFailure(startRes, "Run restart failed.");
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
      await reportStartFailure(startRes, "Live run restart failed.");
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

/** A refused Start: the out-of-Hires card (with its Upgrade button) when that is why, else the plain error. */
async function reportStartFailure(startRes, fallback) {
  const code = String(startRes?.errorCode || "").toUpperCase();
  if (code === "DAILY_CAP_REACHED") {
    await botChat(OUT_OF_HIRES_TEXT, "warn", OUT_OF_HIRES_META);
    return;
  }
  await botChat(startRes?.error || fallback, "error");
}
