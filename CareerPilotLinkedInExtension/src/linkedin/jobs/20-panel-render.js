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
