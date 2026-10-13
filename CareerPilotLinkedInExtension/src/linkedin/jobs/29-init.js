/*
 * LinkedIn Jobs auto-apply - part 29: init
 *
 * Entry point: runs once per tab. Creates the panel, hotkey (Alt+Shift+C), remote selectors,
 * card-tag observer, and state polling.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

if (!window.__CP_COPILOT_ACTIVE__) {
  window.__CP_COPILOT_ACTIVE__ = true;
  ensurePanel();
  window.addEventListener("resize", () => {
    applyPanelLayout();
    logPanelDebug("window-resize");
  });
  window.addEventListener("keydown", (event) => {
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === "c") {
      panelPrefs.left = Math.max(8, window.innerWidth - 440);
      panelPrefs.top = 84;
      panelPrefs.minimized = false;
      panelPrefs.maximized = false;
      savePanelPrefs();
      applyPanelLayout();
      logPanelDebug("hotkey-reset");
    }
  });
  loadRemoteSelectors().catch(() => {});
  // Show "Already applied" tags on job tiles even before a run starts.
  refreshKnownAppliedJobIds(false).catch(() => {}).finally(() => startCardPaintObserver());
  startStatePolling().catch((err) => {
    console.error("[CP] State polling crashed:", err);
  });
} else {
  ensurePanel();
  if (!extensionContextAlive) {
    extensionContextAlive = true;
    logPanelDebug("context-reconnected");
    loadRemoteSelectors().catch(() => {});
    startStatePolling().catch((err) => {
      console.error("[CP] State polling crashed:", err);
    });
  } else {
    logPanelDebug("reused-script-instance");
  }
}
