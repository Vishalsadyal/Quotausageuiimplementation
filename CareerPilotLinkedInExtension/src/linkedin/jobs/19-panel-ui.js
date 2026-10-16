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

// LinkedIn's Easy Apply popup is a <dialog> opened with showModal(), which lives in the browser top layer.
// z-index can never beat the top layer, so the panel and toggle join it too (popover="manual") and are
// re-promoted whenever a new modal dialog opens, which puts them back above it.
let topLayerWatchTimer = null;
let lastSeenModalDialog = null;

function promoteToTopLayer(el) {
  if (!el || !el.isConnected || typeof el.showPopover !== "function") return;
  try {
    if (!el.hasAttribute("popover")) el.setAttribute("popover", "manual");
    if (el.matches(":popover-open")) el.hidePopover();
    el.showPopover();
  } catch {
    // popover unsupported or element not eligible; z-index fallback still applies
  }
}

function promotePanelElementsToTopLayer() {
  promoteToTopLayer(document.getElementById(PANEL_ID));
  promoteToTopLayer(document.getElementById(TOGGLE_ID));
}

function findOpenModalDialog() {
  const roots = [document, document.getElementById("interop-outlet")?.shadowRoot].filter(Boolean);
  for (const root of roots) {
    const dlg = root.querySelector("dialog[open], [role='dialog'][aria-modal='true']");
    if (dlg) return dlg;
  }
  return null;
}

function startTopLayerWatch() {
  if (topLayerWatchTimer) return;
  topLayerWatchTimer = setInterval(() => {
    const dlg = findOpenModalDialog();
    if (dlg && dlg !== lastSeenModalDialog) promotePanelElementsToTopLayer();
    lastSeenModalDialog = dlg;
  }, 400);
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
    promotePanelElementsToTopLayer();
    startTopLayerWatch();
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
    const label = document.createElement("span");
    label.textContent = "Copilot";
    label.style.fontWeight = "700";
    toggle.appendChild(label);
  } catch {
    toggle.textContent = "CP";
  }

  function toggleInPageDockedSidebar() {
    const p = document.getElementById(PANEL_ID);
    if (!p) return;
    p.classList.remove("cp-hidden");
    p.classList.toggle("cp-sidebar-collapsed");
    p.style.zIndex = "2147483646";
    if (typeof syncPageAdjustment === "function") {
      syncPageAdjustment();
    }
  }

  toggle.addEventListener("click", () => {
    toggleInPageDockedSidebar();
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
        </div>
      </div>
    </div>
    <div class="cp-controls">
      <div class="cp-run-mode">
        <div class="cp-metric-pill cp-metric-quota" id="cp-wallet">
          <span class="cp-svg-icon cp-icon-primary">${ICONS.coin}</span>
          <span id="cp-wallet-text">Free Quota</span>
        </div>
        <button id="cp-upgrade" class="cp-upgrade-btn" type="button" hidden title="You are out of Hires. See plans and upgrade.">Upgrade</button>
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
      <button id="cp-tab-applied" class="cp-tab"><span>Applied</span><b class="cp-tab-count" id="cp-count-applied" hidden>0</b></button>
      <button id="cp-tab-skipped" class="cp-tab"><span>Skipped</span><b class="cp-tab-count" id="cp-count-skipped" hidden>0</b></button>
      <button id="cp-tab-feed" class="cp-tab cp-active"><span>Activity</span></button>
    </div>
    <div class="cp-log" id="cp-log" aria-live="polite"></div>
  `;
  (document.body || document.documentElement).appendChild(panel);
  panelEl = panel;
  lastLogRenderSignature = "";
  panelEl.classList.remove("cp-hidden", "cp-sidebar-collapsed", "cp-minimized", "cp-maximized");
  promotePanelElementsToTopLayer();
  startTopLayerWatch();

  try {
    const orbImg = panel.querySelector(".cp-orb-img");
    if (orbImg) orbImg.src = extensionAssetUrl("icons/icon48.png");
  } catch {
    // ignore
  }

  panel.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-cp-upgrade]")) window.open(UPGRADE_URL, "_blank", "noopener");
  });
  panel.querySelector("#cp-upgrade")?.addEventListener("click", () => window.open(UPGRADE_URL, "_blank", "noopener"));
  panel.querySelector("#cp-wallet")?.addEventListener("click", () => {
    if (panel.querySelector("#cp-wallet")?.classList.contains("cp-quota-out")) window.open(UPGRADE_URL, "_blank", "noopener");
  });
  panel.querySelector("#cp-start").addEventListener("click", async () => handleChatCommand("start"));
  panel.querySelector("#cp-pause").addEventListener("click", async () => handleChatCommand("pause"));
  panel.querySelector("#cp-stop").addEventListener("click", async () => handleChatCommand("stop"));

  const tabButtons = {
    applied: panel.querySelector("#cp-tab-applied"),
    skipped: panel.querySelector("#cp-tab-skipped"),
    feed: panel.querySelector("#cp-tab-feed"),
  };
  const setTab = (tab) => {
    panelActiveTab = tab;
    for (const [name, button] of Object.entries(tabButtons)) button?.classList.toggle("cp-active", name === tab);
    lastLogRenderSignature = "";
    if (tab === "applied" || tab === "skipped") void refreshPanelHistory();
    void getBootstrap().then((b) => renderState(b.state));
  };
  for (const [name, button] of Object.entries(tabButtons)) button?.addEventListener("click", () => setTab(name));

  panel.querySelector("#cp-clear-logs")?.addEventListener("click", async () => {
    const res = await sendMessage({ type: "CP_CLEAR_LOGS" });
    if (res?.ok) {
      runStats = { applied: 0, skipped: 0, failed: 0 };
      lastLogRenderSignature = "";
      renderState(res.state || { applied: 0, skipped: 0, failed: 0, logs: [] });
      await botChat("Logs and run counters cleared.");
    }
  });

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

  applyPanelLayout();
  enablePanelDragging();
  logPanelDebug("ensure-new");
}
