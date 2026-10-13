/*
 * LinkedIn Jobs auto-apply - part 19: panel-ui
 *
 * Builds the copilot panel (tabs, buttons, chat box) and wires its events.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

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
    img.src = extensionAssetUrl("icons/icon32.png");
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
    if (orbImg) orbImg.src = extensionAssetUrl("icons/icon48.png");
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
