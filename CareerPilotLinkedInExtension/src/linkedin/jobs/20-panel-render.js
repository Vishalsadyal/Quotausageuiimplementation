/*
 * LinkedIn Jobs auto-apply - part 20: panel-render
 *
 * Panel log feed: AI cards, decision chains, 'now' card, and renderState() which paints run status,
 * counters and logs.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

function trimLogPrefix(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  if (text.startsWith("You:")) return text.slice(4).trim();
  if (text.startsWith("Copilot:")) return text.slice(8).trim();
  if (text.startsWith("[debug]")) return text.slice(7).trim();
  return text;
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

  // Out of Hires: a card with the reason and a real Upgrade button (click handled in 19-panel-ui.js).
  if (entry?.meta?.card === "out-of-hires") {
    return `<div class="cp-ai-card cp-out-of-hires"><span class="cp-ai-icon">${ICONS.alert}</span><span class="cp-ai-text"><strong>You are out of Hires</strong><span class="cp-out-body">${escapeHtml(rawMsg)}</span><button type="button" class="cp-out-upgrade" data-cp-upgrade>Upgrade now</button></span><span class="cp-ai-time">${escapeHtml(time)}</span></div>`;
  }

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

// ---------------------------------------------------------------- applied / skipped lists
// Why a job was skipped, in plain words. Unknown codes fall back to the reason the run recorded.
const SKIP_REASON_TEXT = {
  APPLIED_CACHE_HIT: "Already applied before",
  ALREADY_APPLIED: "Already applied before",
  NO_APPLY_BUTTON: "No Easy Apply button on this job",
  EXTERNAL_APPLY_ONLY: "You apply on the company website",
  EXTERNAL_APPLY_OPENED: "Opened the company website to apply",
  MODAL_NOT_FOUND: "The Easy Apply form did not open",
  VIEW_MODAL_SKIPPED: "Could not finish the application form",
  VIEW_MODAL_FAILED: "Could not finish the application form",
  MODAL_FLOW_ERROR: "Could not finish the application form",
  BLACKLISTED_COMPANY: "Company is on your blocked list",
  BAD_WORD_TITLE: "Job title has a word you excluded",
  KEYWORD_MISMATCH: "Title does not match your keywords",
  BAD_WORD_DESCRIPTION: "Description has a word you excluded",
  SECURITY_CLEARANCE_REQUIRED: "Needs a security clearance",
  EXPERIENCE_TOO_HIGH: "Asks for more experience than you have",
  ABOUT_COMPANY_BAD_WORD: "Company description has a word you excluded",
  DAILY_EASY_APPLY_LIMIT: "LinkedIn daily Easy Apply limit reached",
};

function skipReasonParts(entry) {
  const data = entry?.data && typeof entry.data === "object" ? entry.data : {};
  const code = String(data.reasonCode || "").trim().toUpperCase();
  const detail = String(data.reason || data.errorMessage || "").replace(/\s+/g, " ").trim();
  const mapped = SKIP_REASON_TEXT[code];
  if (mapped) return { primary: mapped, secondary: detail && detail.length <= 120 && detail !== mapped ? detail : "" };
  const human = code ? code.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "";
  return { primary: detail || human || "Skipped", secondary: "" };
}

function formatJobHistoryCard(entry, listKind) {
  const data = entry?.data && typeof entry.data === "object" ? entry.data : {};
  const jobId = String(data.jobId || data.externalJobId || "").trim();
  const title = cleanJobTitle(String(data.title || "").trim()) || (jobId ? `LinkedIn job ${jobId}` : "LinkedIn job");
  const company = String(data.company || "").trim();
  const time = String(entry?.ts || "").slice(11, 19);
  const url = String(data.jobUrl || data.pageUrl || "");
  const titleHtml = /^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(url)
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>`
    : escapeHtml(title);
  const sub = [company, time].filter(Boolean).map(escapeHtml).join(" · ");

  if (listKind === "applied") {
    return `<div class="cp-job-card cp-job-applied"><span class="cp-job-icon">${ICONS.check}</span><div class="cp-job-main"><div class="cp-job-title">${titleHtml}</div><div class="cp-job-sub">${sub}</div></div></div>`;
  }
  const { primary, secondary } = skipReasonParts(entry);
  const tag = entry?.kind === "failed" ? "Failed" : entry?.kind === "external" ? "External" : "";
  return `<div class="cp-job-card cp-job-skipped"><span class="cp-job-icon">${ICONS.skip}</span><div class="cp-job-main"><div class="cp-job-title">${titleHtml}${tag ? `<span class="cp-job-tag">${tag}</span>` : ""}</div><div class="cp-job-sub">${sub}</div><div class="cp-job-reason">${escapeHtml(primary)}</div>${secondary ? `<div class="cp-job-sub">${escapeHtml(secondary)}</div>` : ""}</div></div>`;
}

/** Newest first, only this run's entries, and none at all after "Clear logs & reset counters". */
function historyForPanel(list, state, countNow) {
  if (!Number(countNow || 0)) return [];
  const since = Date.parse(String(state?.startedAt || ""));
  return (Array.isArray(list) ? list : [])
    .filter((entry) => !Number.isFinite(since) || Date.parse(String(entry?.ts || "")) >= since)
    .sort((a, b) => String(b?.ts || "").localeCompare(String(a?.ts || "")))
    .slice(0, 60);
}

async function refreshPanelHistory() {
  const res = await sendMessage({ type: "CP_GET_RUN_HISTORY" });
  if (!res?.ok || !res.history) return;
  const h = res.history;
  const tag = (list, kind) => (Array.isArray(list) ? list : []).map((entry) => ({ ...entry, kind }));
  panelHistory = {
    applied: tag(h.applied, "applied"),
    skipped: [...tag(h.skipped, "skipped"), ...tag(h.external, "external"), ...tag(h.failed, "failed")],
  };
  panelHistoryVersion += 1;
  lastLogRenderSignature = "";
  if (panelLastState) renderState(panelLastState);
}

function nowBannerHtml(nowCard) {
  return `<div class="cp-now-banner"><div class="cp-now-head"><span class="cp-hero-status-pulse"></span><span class="cp-now-title">${escapeHtml(nowCard.title)}</span></div><div class="cp-now-job">${escapeHtml(nowCard.jobTitle)}</div><div class="cp-now-detail">${escapeHtml(nowCard.detail)}</div></div>`;
}

function emptyListHtml(icon, text) {
  return `<div class="cp-empty-state"><span>${icon}</span><span>${text}</span></div>`;
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

/**
 * What the portal quota says about spending: paid Hires, free applications used, and whether nothing is
 * left (free + paid). Unknown quota is never treated as out. Shared by the panel pill and the run loop.
 */
function describeHiresState(quota) {
  const q = quota || {};
  const hireBalance = Number(q.hireBalance ?? NaN);
  const quotaUsed = Number(q.quotaUsed ?? NaN);
  const quotaTotal = Number(q.quotaTotal ?? NaN);
  const spendable = Number(q.spendable ?? NaN);
  const hasFree = Number.isFinite(quotaUsed) && Number.isFinite(quotaTotal);
  const freeLeft = hasFree ? Math.max(0, quotaTotal - quotaUsed) : 0;
  // Paid Hires: the explicit balance, else whatever is spendable beyond the free allowance.
  const hires = Number.isFinite(hireBalance)
    ? Math.max(0, hireBalance)
    : Number.isFinite(spendable)
      ? Math.max(0, spendable - freeLeft)
      : null;
  const out = Number.isFinite(spendable) ? spendable <= 0 : hires !== null && hasFree && hires <= 0 && freeLeft <= 0;
  return { quotaUsed, quotaTotal, hasFree, freeLeft, hires, out };
}

function renderState(state) {
  ensurePanelConnected();
  if (!panelEl) return;
  panelLastState = state;
  panelEl.classList.remove("cp-hidden", "cp-sidebar-collapsed");
  if (state.running && panelPrefs.minimized) {
    setPanelMinimized(false);
  }

  // The lists come from the run history; read it again whenever a count changes.
  const historyKey = `${Number(state.applied || 0)}|${Number(state.skipped || 0)}|${Number(state.failed || 0)}`;
  if (historyKey !== panelHistoryKey) {
    panelHistoryKey = historyKey;
    void refreshPanelHistory();
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

  // Counts sit on the Applied / Skipped tabs; they stay hidden while zero.
  const setTabCount = (selector, count) => {
    const el = panelEl.querySelector(selector);
    if (!el) return;
    el.textContent = String(count);
    el.hidden = count <= 0;
  };
  const appliedNow = Number(state.applied || 0);
  const skippedNow = Number(state.skipped || 0) + Number(state.failed || 0);
  setTabCount("#cp-count-applied", appliedNow);
  setTabCount("#cp-count-skipped", skippedNow);

  const walletTextEl = panelEl.querySelector("#cp-wallet-text");
  if (walletTextEl) {
    const { quotaUsed, quotaTotal, hasFree, hires, out } = describeHiresState(lastPortalQuota);

    if (hires === null && !hasFree) {
      walletTextEl.textContent = "Quota Active";
    } else {
      const hiresText = hires === null ? "-- Hires" : `${hires} ${hires === 1 ? "Hire" : "Hires"}`;
      const freeText = hasFree ? ` · ${Math.max(0, quotaUsed)}/${Math.max(0, quotaTotal)} Free used` : "";
      walletTextEl.textContent = out ? `${hiresText}${freeText} · Out` : `${hiresText}${freeText}`;
    }
    panelEl.querySelector("#cp-wallet")?.classList.toggle("cp-quota-out", out);
    const upgradeBtn = panelEl.querySelector("#cp-upgrade");
    if (upgradeBtn) upgradeBtn.hidden = !out;
  }

  const logs = state.logs || [];
  const nowCard = deriveNowCard(state, logs);

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
  const logSignature = `${buildLogRenderSignature(logsWindow, state, s, panelActiveTab)}|${panelHistoryVersion}|${nowCard.jobTitle}|${nowCard.detail}`;
  if (logSignature !== lastLogRenderSignature && logEl) {
    const previousTop = Number(logEl.scrollTop || 0);
    const previousHeight = Number(logEl.scrollHeight || 0);
    const tabChanged = panelRenderedTab !== panelActiveTab;

    if (panelActiveTab === "applied") {
      const items = historyForPanel(panelHistory.applied, state, appliedNow);
      logEl.innerHTML = items.length
        ? items.map((entry) => formatJobHistoryCard(entry, "applied")).join("")
        : emptyListHtml(ICONS.check, "No applications yet. Click <strong>Start</strong> and the jobs you apply to will be listed here.");
    } else if (panelActiveTab === "skipped") {
      const items = historyForPanel(panelHistory.skipped, state, skippedNow);
      logEl.innerHTML = items.length
        ? items.map((entry) => formatJobHistoryCard(entry, "skipped")).join("")
        : emptyListHtml(ICONS.skip, "Nothing skipped yet. Skipped jobs will be listed here with the reason.");
    } else if (panelActiveTab === "feed") {
      const feedItems = logsWindow.filter((l) => isUserFacingAiLog(l));
      const banner = state.running || state.paused ? nowBannerHtml(nowCard) : "";
      if (!feedItems.length && !state.running) {
        logEl.innerHTML = banner + emptyListHtml(ICONS.sparkle, "AI Copilot is standing by. Click <strong>Start</strong> to begin auto-applying.");
      } else {
        // Newest first, like the Applied and Skipped lists.
        logEl.innerHTML = banner + typingCard + [...feedItems].reverse().map((l) => formatAiFeedCard(l)).join("");
      }
    }

    lastLogRenderSignature = logSignature;
    panelRenderedTab = panelActiveTab;

    // The newest item is at the top: stay there, or keep the user's place after they scrolled down
    // (new items add height above, so shift by that much).
    if (tabChanged || previousTop <= 36) {
      logEl.scrollTop = 0;
    } else {
      logEl.scrollTop = previousTop + Math.max(0, Number(logEl.scrollHeight || 0) - previousHeight);
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
