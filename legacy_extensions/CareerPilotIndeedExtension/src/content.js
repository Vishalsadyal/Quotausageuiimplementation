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

function buildSearchUrl(settings = {}, pageStart = 0) {
  const params = new URLSearchParams();
  const terms = Array.isArray(settings.searchTerms) ? settings.searchTerms.filter(Boolean) : [];
  const firstTerm = normalizeText(terms[0] || settings.keywords || "developer");
  if (firstTerm) params.set("q", firstTerm);

  const location =
    normalizeText(settings.searchLocation) ||
    normalizeText(Array.isArray(settings.filterLocations) ? settings.filterLocations[0] : "");
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

function getPanelElements() {
  return {
    panel: document.getElementById(PANEL_ID),
    toggle: document.getElementById(TOGGLE_ID),
    statusBadge: document.getElementById("cp-status-badge"),
    title: document.getElementById("cp-now-title"),
    detail: document.getElementById("cp-now-detail"),
    applied: document.getElementById("cp-stat-applied"),
    skipped: document.getElementById("cp-stat-skipped"),
    failed: document.getElementById("cp-stat-failed"),
    logs: document.getElementById("cp-log"),
    start: document.getElementById("cp-start"),
    pause: document.getElementById("cp-pause"),
    stop: document.getElementById("cp-stop"),
    mode: document.getElementById("cp-run-mode"),
  };
}

function ensurePanel() {
  if (panelMounted) return;
  if (document.getElementById(PANEL_ID) || document.getElementById(TOGGLE_ID)) {
    panelMounted = true;
    return;
  }

  // Check if panel is enabled in settings (default: false)
  chrome.storage.local.get("indeed_panel_enabled", (data) => {
    if (!data.indeed_panel_enabled) return;
    createPanelDOM();
  });
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
  toggle.textContent = "AI";
  toggle.title = "Toggle AutoApply CV Indeed Copilot";

  const panel = document.createElement("aside");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="cp-head">
      <div class="cp-brand">
        <div class="cp-orb">
          <img class="cp-orb-img" src="${chrome.runtime.getURL("icons/icon48.png")}" alt="AutoApply CV" />
        </div>
        <div class="cp-title-wrap">
          <div class="cp-title">AutoApply CV Copilot</div>
          <div class="cp-sub">Indeed job assistant</div>
        </div>
      </div>
      <div class="cp-head-right">
        <span id="cp-status-badge" class="cp-badge">Idle</span>
      </div>
    </div>
    <div class="cp-stats">
      <div class="cp-stat"><div class="cp-stat-k">Applied</div><div id="cp-stat-applied">0</div></div>
      <div class="cp-stat"><div class="cp-stat-k">Skipped</div><div id="cp-stat-skipped">0</div></div>
      <div class="cp-stat"><div class="cp-stat-k">Failed</div><div id="cp-stat-failed">0</div></div>
    </div>
    <div class="cp-run-mode">
      <div class="cp-run-mode-label">Mode</div>
      <div id="cp-run-mode" class="cp-run-mode-chip cp-dry">Dry run</div>
    </div>
    <div class="cp-now">
      <div id="cp-now-title" class="cp-now-title">Indeed copilot ready.</div>
      <div id="cp-now-detail" class="cp-now-detail">Open Indeed Jobs and start the run.</div>
    </div>
    <div class="cp-quick">
      <button id="cp-start" type="button">Start</button>
      <button id="cp-pause" type="button">Pause</button>
      <button id="cp-stop" type="button">Stop</button>
    </div>
    <div class="cp-quick" style="margin-top: 8px;">
      <button id="cp-copy-logs" type="button" style="background: #6c757d; flex: 1;">📋 Copy Logs</button>
    </div>
    <div id="cp-log" class="cp-log"></div>
  `;

  document.documentElement.appendChild(toggle);
  document.documentElement.appendChild(panel);

  toggle.addEventListener("click", () => {
    panel.classList.toggle("cp-hidden");
  });

  const els = getPanelElements();
  els.start?.addEventListener("click", async () => {
    // Don't force restart - continue from where we left off
    await sendMessage({ type: "CP_START", forceRestart: false });
    if (!isJobsPage()) {
      window.location.href = buildSearchUrl(await loadSettings());
      return;
    }
    // Only log "started" if not resuming
    const state = await chrome.storage.local.get("cpState").catch(() => ({}));
    const isResuming = state?.cpState?.paused;
    const message = isResuming ? "Copilot: Resuming from pause..." : "Copilot: Run started.";
    await sendMessage({ type: "CP_LOG", level: "info", message });
  });
  els.pause?.addEventListener("click", async () => {
    await sendMessage({ type: "CP_PAUSE" });
  });
  els.stop?.addEventListener("click", async () => {
    await sendMessage({ type: "CP_STOP" });
  });

  const copyLogsBtn = document.getElementById("cp-copy-logs");
  copyLogsBtn?.addEventListener("click", async () => {
    try {
      const logs = window.cpGetLogs ? window.cpGetLogs() : [];
      const logsText = logs.map(log => `[${log.timestamp}] ${log.message}`).join('\n');
      
      if (logsText) {
        await navigator.clipboard.writeText(logsText);
        copyLogsBtn.textContent = "✅ Copied!";
        setTimeout(() => {
          copyLogsBtn.textContent = "📋 Copy Logs";
        }, 2000);
      } else {
        copyLogsBtn.textContent = "⚠️ No logs";
        setTimeout(() => {
          copyLogsBtn.textContent = "📋 Copy Logs";
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to copy logs:", err);
      copyLogsBtn.textContent = "❌ Failed";
      setTimeout(() => {
        copyLogsBtn.textContent = "📋 Copy Logs";
      }, 2000);
    }
  });

  panelMounted = true;
}

function renderLogs(logs) {
  const container = getPanelElements().logs;
  if (!container) return;
  const items = Array.isArray(logs) ? logs.slice(-10) : [];
  container.innerHTML = items
    .map((entry) => {
      const kind = normalizeLabel(entry?.level || "info");
      const message = normalizeText(entry?.message || "");
      const ts = normalizeText(entry?.ts || "");
      return `
        <div class="cp-line cp-${kind}">
          <div class="cp-bubble">
            <div class="cp-msg-head">
              <span class="cp-sender">${kind === "user" ? "You" : "Copilot"}</span>
              <span class="cp-time">${ts ? new Date(ts).toLocaleTimeString() : ""}</span>
            </div>
            <div class="cp-msg-text">${message || "-"}</div>
          </div>
        </div>
      `;
    })
    .join("");
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
  const lastLog = Array.isArray(state?.logs) && state.logs.length ? state.logs[state.logs.length - 1] : null;

  if (els.statusBadge) {
    els.statusBadge.textContent = running ? "Running" : paused ? "Paused" : "Idle";
    els.statusBadge.className = `cp-badge ${running ? "cp-run" : paused ? "cp-pause" : ""}`.trim();
  }
  if (els.title) {
    els.title.textContent = running
      ? "Scanning Indeed job results."
      : paused
      ? "Run paused."
      : "Indeed copilot ready.";
  }
  if (els.detail) {
    els.detail.textContent =
      normalizeText(lastLog?.message) ||
      (running ? "Working through visible jobs and syncing outcomes." : "Open Indeed Jobs and click Start.");
  }
  if (els.applied) els.applied.textContent = String(applied);
  if (els.skipped) els.skipped.textContent = String(skipped);
  if (els.failed) els.failed.textContent = String(failed);
  if (els.mode) {
    const live = Boolean(settings?.autoSubmit) && !Boolean(settings?.dryRun);
    const manual = !Boolean(settings?.autoSubmit) && !Boolean(settings?.dryRun);
    els.mode.textContent = live ? "Live auto submit" : manual ? "Manual review" : "Dry run";
    els.mode.className = `cp-run-mode-chip ${live ? "cp-live" : manual ? "cp-manual" : "cp-dry"}`;
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
  const title =
    normalizeText(
      card?.querySelector?.("[data-testid='job-title'], h2, h3, .jobTitle")?.textContent || anchor?.textContent,
    ) || "Indeed Job";
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

async function focusCard(card) {
  try {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch {
    // ignore
  }
  await sleep(250);
  const clickable =
    getCardAnchor(card) ||
    card?.querySelector?.("button") ||
    card;
  if (clickable instanceof HTMLElement) clickable.click();
  await sleep(CARD_OPEN_DELAY_MS);
}

function extractDetailSnapshot(fallback) {
  const title =
    normalizeText(
      document.querySelector("[data-testid='jobsearch-JobInfoHeader-title'], [data-testid='viewJobTitle'], h1")?.textContent,
    ) || fallback.title;
  const company =
    normalizeText(
      document.querySelector("[data-testid='inlineHeader-companyName'], [data-testid='company-name'], .jobsearch-CompanyInfoWithoutHeaderImage div")?.textContent,
    ) || fallback.company;
  const workLocation =
    normalizeText(
      document.querySelector("[data-testid='job-location'], [data-testid='inlineHeader-companyLocation'], .jobsearch-DesktopStickyContainer-subtitle")?.textContent,
    ) || fallback.workLocation;
  const description =
    normalizeText(
      document.querySelector("#jobDescriptionText, [data-testid='jobsearch-JobComponent-description'], .jobsearch-JobComponent-description")?.textContent,
    ) || "";
  const metadataText = normalizeText(
    [
      document.querySelector("[data-testid='jobsearch-OtherJobDetailsContainer']")?.textContent,
      document.querySelector("#salaryInfoAndJobType")?.textContent,
      document.querySelector("[data-testid='attribute_snippet_testid']")?.textContent,
      document.querySelector("[data-testid='jobsearch-JobMetadataHeader']")?.textContent,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const aboutCompany = normalizeText(
    [
      document.querySelector("[data-testid='companyInfo-metadata']")?.textContent,
      document.querySelector("[data-testid='companyInfo-container']")?.textContent,
      document.querySelector("#jobCompanyDescription")?.textContent,
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

  if (!matchesConfiguredValues(detail?.title || "", settings?.jobTitles)) {
    return {
      skip: true,
      reasonCode: "JOB_TITLE_FILTER_MISMATCH",
      reason: "Job title did not match configured job-title filters",
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
  console.log(`[Indeed Debug] 🔍 Checking filters for job:`, {
    title: detail?.title,
    company: detail?.company,
    workLocation: detail?.workLocation,
    metadataText: detail?.metadataText
  });
  console.log(`[Indeed Debug] 🔍 Settings onSite filter:`, settings?.onSite);
  
  const locationText = `${detail?.workLocation || ""} ${detail?.metadataText || ""}`;
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

  if (!matchesConfiguredValues(locationText, settings?.filterLocations)) {
    const configuredLocations = parseListSetting(settings?.filterLocations);
    const remoteConfigured = configuredLocations.some((value) => isRemoteLikeValue(value));
    if (!remoteConfigured || !workModeMatches(locationText, ["Remote"])) {
      return {
        skip: true,
        reasonCode: "LOCATION_FILTER_MISMATCH",
        reason: "Location did not match configured location filters",
      };
    }
  }

  if (!workModeMatches(locationText, settings?.onSite)) {
    return {
      skip: true,
      reasonCode: "WORK_MODE_FILTER_MISMATCH",
      reason: "Work mode did not match configured on-site filters",
    };
  }

  if (!matchesConfiguredValues(combinedText, settings?.experienceLevel)) {
    return {
      skip: true,
      reasonCode: "EXPERIENCE_LEVEL_FILTER_MISMATCH",
      reason: "Experience level did not match configured filters",
    };
  }

  if (!matchesConfiguredValues(combinedText, settings?.jobType)) {
    return {
      skip: true,
      reasonCode: "JOB_TYPE_FILTER_MISMATCH",
      reason: "Job type did not match configured filters",
    };
  }

  if (!matchesConfiguredValues(combinedText, settings?.industry)) {
    return {
      skip: true,
      reasonCode: "INDUSTRY_FILTER_MISMATCH",
      reason: "Industry did not match configured filters",
    };
  }

  if (!matchesConfiguredValues(combinedText, settings?.jobFunction)) {
    return {
      skip: true,
      reasonCode: "JOB_FUNCTION_FILTER_MISMATCH",
      reason: "Job function did not match configured filters",
    };
  }

  if (!matchesConfiguredValues(combinedText, settings?.benefits)) {
    return {
      skip: true,
      reasonCode: "BENEFITS_FILTER_MISMATCH",
      reason: "Benefits did not match configured filters",
    };
  }

  if (!matchesConfiguredValues(combinedText, settings?.commitments)) {
    return {
      skip: true,
      reasonCode: "COMMITMENTS_FILTER_MISMATCH",
      reason: "Commitments did not match configured filters",
    };
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
  const candidates = queryAllVisible([
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
  const ariaLabel = normalizeText(element.getAttribute("aria-label"));
  if (ariaLabel) return ariaLabel;
  const placeholder = normalizeText(element.getAttribute("placeholder"));
  if (placeholder) return placeholder;
  const id = element.getAttribute("id");
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label) return normalizeText(label.textContent);
  }
  const wrappingLabel = element.closest("label");
  if (wrappingLabel) return normalizeText(wrappingLabel.textContent);
  const parentText = normalizeText(element.parentElement?.textContent || "");
  return parentText;
}

function resolveFieldAnswer(label, settings) {
  const normalized = normalizeLabel(label);
  const screeningAnswers =
    settings?.screeningAnswers && typeof settings.screeningAnswers === "object"
      ? settings.screeningAnswers
      : {};
  if (screeningAnswers[normalized]) return String(screeningAnswers[normalized] || "").trim();

  if (normalized.includes("email")) return normalizeText(settings.contactEmail);
  if (normalized.includes("phone")) return normalizeText(settings.phoneNumber || settings.phone);
  if (normalized === "full name" || normalized.includes("legal name")) {
    return normalizeText(settings.fullName || `${settings.firstName || ""} ${settings.lastName || ""}`);
  }
  if (normalized.includes("first name")) return normalizeText(settings.firstName || settings.fullName);
  if (normalized.includes("last name") || normalized.includes("surname")) return normalizeText(settings.lastName);
  if (normalized.includes("city")) return normalizeText(settings.currentCity || settings.searchLocation);
  if (normalized.includes("linkedin")) return normalizeText(settings.linkedinUrl);
  if (normalized.includes("website") || normalized.includes("portfolio")) {
    return normalizeText(settings.websiteUrl || settings.portfolioUrl || settings.linkedinUrl);
  }
  if (normalized.includes("experience")) {
    const years = Number(settings.currentExperience);
    if (Number.isFinite(years) && years >= 0) return String(years);
  }
  if (normalized.includes("salary")) return normalizeText(settings.salary);
  if (normalized.includes("visa") || normalized.includes("sponsor")) return normalizeText(settings.requireVisa || "No");
  if (normalized.includes("citizen") || normalized.includes("authorized")) {
    return normalizeText(settings.usCitizenship || settings.workAuthorizationUS || "");
  }
  if (normalized.includes("country")) return normalizeText(settings.country);
  return "";
}

function isRequiredField(element) {
  return (
    Boolean(element.required) ||
    String(element.getAttribute("aria-required") || "").toLowerCase() === "true"
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
  const setter = Object.getOwnPropertyDescriptor(element.__proto__, "value")?.set;
  setter ? setter.call(element, value) : (element.value = value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function chooseSelectOption(select, answer) {
  const normalizedAnswer = normalizeLabel(answer);
  const option =
    Array.from(select.options).find((item) => normalizeLabel(item.textContent || item.value) === normalizedAnswer) ||
    Array.from(select.options).find((item) => normalizeLabel(item.textContent || item.value).includes(normalizedAnswer)) ||
    null;
  if (!option) return false;
  select.value = option.value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
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
      const matched = group.find((item) => normalizeLabel(fieldLabelFor(item) || item.value).includes(normalizeLabel(answer)));
      if (matched) matched.click();
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
      } else if ((normalized.includes("consent") || normalized.includes("terms")) && isRequiredField(field) && !field.checked) {
        field.click();
      }
      continue;
    }

    if (field instanceof HTMLInputElement && field.type === "file") {
      if (isRequiredField(field)) {
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
  
  // Check if button will open in new tab
  const target = applyButton.getAttribute("target");
  const href = applyButton.getAttribute("href");
  const ariaLabel = applyButton.getAttribute("aria-label") || "";
  
  console.log("[Indeed Debug] 🔍 Button details - target:", target, "href:", href, "aria-label:", ariaLabel);
  
  // Check if href is a SmartApply URL - use safe redirect if so
  if (href && href.includes('smartapply.indeed.com')) {
    console.log("[Indeed Debug] 🔗 SmartApply URL detected, using safe redirect handler");
    
    const redirectSuccess = await sendMessage({ 
      type: "CP_SAFE_REDIRECT_SMARTAPPLY", 
      url: href 
    }).then(response => response?.ok === true).catch(() => false);
    
    if (redirectSuccess) {
      console.log("[Indeed Debug] ✅ Safe redirect to SmartApply completed");
      return { 
        status: "pending", 
        reasonCode: "SMARTAPPLY_REDIRECT",
        message: "Safely redirected to SmartApply"
      };
    } else {
      console.error("[Indeed Debug] 🚨 Safe redirect failed - URL may be malicious");
      return { 
        status: "failed", 
        reasonCode: "UNSAFE_URL",
        message: "SmartApply URL failed security validation"
      };
    }
  }
  
  // If it opens in new tab, try to prevent that and open in modal instead
  if (target === "_blank" || ariaLabel.includes("new tab")) {
    console.log("[Indeed Debug] ⚠️ Button opens in new tab, attempting to open in current page");
    
    // Remove target="_blank" temporarily
    if (target) {
      applyButton.removeAttribute("target");
    }
    
    // Click the button
    applyButton.click();
    
    // Restore target if needed
    if (target) {
      setTimeout(() => applyButton.setAttribute("target", target), 100);
    }
  } else {
    applyButton.click();
  }
  
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
    console.log("[Indeed Debug] ⚠️ Apply modal did not appear - opened in new tab");
    console.log("[Indeed Debug] ℹ️ Application continues in SmartApply tab - user can complete manually");
    await pushLog("Application opened in new tab - complete manually or enable SmartApply auto-fill", "info");
    return { 
      status: "pending", 
      reasonCode: "INDEED_APPLY_NEW_TAB",
      message: "Application opened in new tab"
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
  if (appliedJobIdsCache.has(snapshot.jobId)) {
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
    await pushLog(`Skipped (${quickRule.reason})`, "info", { reasonCode: quickRule.reasonCode });
    await recordOutcome("SKIPPED", {
      ...snapshot,
      reasonCode: quickRule.reasonCode,
      reason: quickRule.reason,
    });
    return true;
  }

  await focusCard(card);
  const detail = extractDetailSnapshot(snapshot);
  currentJobContext = detail;

  await pushLog(`Opening: ${detail.title}`, "info");

  const detailRule = shouldSkipByConfiguredFilters(detail, settings);
  if (detailRule.skip) {
    console.log(`[Indeed Debug] ⛔ Skipped by filter: ${detailRule.reason}`, detailRule.reasonCode);
    await pushLog(`Skipped (${detailRule.reason})`, "info", { reasonCode: detailRule.reasonCode });
    await recordOutcome("SKIPPED", {
      ...detail,
      reasonCode: detailRule.reasonCode,
      reason: detailRule.reason,
    });
    return true;
  }

  const applyButton = findApplyButton();
  if (!applyButton) {
    console.log("[Indeed Debug] ❌ No apply button found for this job");
    await pushLog("Skipped (no apply button)", "warn", { reasonCode: "NO_APPLY_BUTTON" });
    await recordOutcome("SKIPPED", {
      ...detail,
      reasonCode: "NO_APPLY_BUTTON",
      reason: "No apply button found on Indeed job detail",
    });
    return true;
  }

  const applyKind = classifyApplyButton(applyButton);
  if (applyKind === "external") {
    console.log("[Indeed Debug] 🌐 External apply detected, skipping");
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

  console.log("[Indeed Debug] 🚀 Starting Indeed apply flow...");
  const applyResult = await runIndeedApplyFlow(applyButton, settings, engineToken);
  console.log("[Indeed Debug] 📊 Apply result:", applyResult);
  if (applyResult.status === "applied") {
    console.log("[Indeed Debug] ✅ Application submitted successfully!");
    appliedJobIdsCache.add(detail.jobId);
    await pushLog("Application submitted", "info");
    await recordOutcome("APPLIED", {
      ...detail,
      reasonCode: "SUBMITTED",
      reason: "Application submitted",
    });
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
  await sendMessage({ type: "CP_STOP" });
}

async function goToNextPage(settings, pageIndex) {
  if (pageIndex + 1 >= MAX_PAGES_PER_RUN) return false;
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

    const url = new URL(window.location.href);
    if (!url.searchParams.get("q") && !url.pathname.startsWith("/viewjob")) {
      window.location.href = buildSearchUrl(settings, Number(url.searchParams.get("start") || 0));
      return;
    }

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
      if (!moved) await stopRun("No more Indeed results to scan.");
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
      await stopRun("Indeed results exhausted without new jobs.");
      return;
    }

    const moved = await goToNextPage(settings, pageIndex);
    if (!moved) await stopRun("Indeed run finished.");
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
    console.log("[Indeed SmartApply] ⚠️ Review application before submitting");
    
    return; // Let user review
  }

  // Step 5: Handle confirmation/submitted page
  if (pageType === 'submitted') {
    console.log("[Indeed SmartApply] 🎉 Application submitted page detected");
    await releaseSmartApplyJobLock("submitted");
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
