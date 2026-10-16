/*
 * LinkedIn Jobs auto-apply - part 06: panel-layout
 *
 * Panel position/size preferences, minimise/maximise, and dragging.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

function loadPanelPrefs() {
  try {
    const raw = localStorage.getItem(PANEL_PREFS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    panelPrefs = {
      ...panelPrefs,
      ...parsed,
      minimized: false,
      maximized: false
    };
  } catch {
    // ignore corrupted prefs
  }
}

function savePanelPrefs() {
  try {
    localStorage.setItem(PANEL_PREFS_KEY, JSON.stringify(panelPrefs));
  } catch {
    // ignore storage failures
  }
}

function syncPageAdjustment(width) {
  if (!document.body) return;
  const isDocked = panelEl && !panelEl.classList.contains("cp-sidebar-collapsed") && !panelEl.classList.contains("cp-hidden");
  if (isDocked) {
    const w = width || (panelEl ? panelEl.getBoundingClientRect().width : 410) || 410;
    document.documentElement.style.setProperty("--cp-sidebar-width", `${w}px`);
    document.body.style.marginRight = `${w}px`;
    document.body.classList.add("cp-has-docked-sidebar");
  } else {
    document.body.style.marginRight = "";
    document.body.classList.remove("cp-has-docked-sidebar");
  }
}

function applyPanelLayout() {
  if (!panelEl) return;
  panelPrefs.minimized = false;
  panelPrefs.maximized = false;
  panelEl.classList.remove("cp-minimized", "cp-maximized", "cp-hidden", "cp-sidebar-collapsed");

  panelEl.style.left = "auto";
  panelEl.style.top = "0";
  panelEl.style.right = "0";
  panelEl.style.bottom = "0";
  const fallbackWidth = 410;
  const targetWidth = typeof panelPrefs.width === "number" && panelPrefs.width >= 320
    ? Math.min(window.innerWidth - 24, panelPrefs.width)
    : fallbackWidth;
  panelEl.style.width = `${targetWidth}px`;
  panelEl.style.height = "100vh";
  panelEl.style.height = "100dvh";
  panelEl.style.maxHeight = "100vh";
  panelEl.style.maxHeight = "100dvh";

  syncPageAdjustment(targetWidth);
  logPanelDebug("apply-layout");
}

function setPanelMinimized(minimized) {
  panelPrefs.minimized = Boolean(minimized);
  savePanelPrefs();
  applyPanelLayout();
}

function setPanelMaximized(maximized) {
  panelPrefs.maximized = Boolean(maximized);
  if (maximized) {
    panelPrefs.minimized = false;
  }
  savePanelPrefs();
  applyPanelLayout();
}

function enablePanelDragging() {
  if (!panelEl) return;
  const head = panelEl.querySelector(".cp-head");
  if (!head) return;

  let resizing = false;
  let startX = 0;
  let startWidth = 410;

  const onMouseMove = (event) => {
    if (!resizing || !panelEl) return;
    const delta = startX - event.clientX;
    const nextWidth = Math.max(340, Math.min(Math.floor(window.innerWidth * 0.8), startWidth + delta));
    panelPrefs.width = nextWidth;
    panelEl.style.width = `${nextWidth}px`;
    syncPageAdjustment(nextWidth);
  };

  const onMouseUp = () => {
    if (!resizing) return;
    resizing = false;
    panelEl?.classList.remove("cp-dragging");
    savePanelPrefs();
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  head.addEventListener("mousedown", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest(".cp-window-actions, button, input")) {
      return;
    }
    if (panelPrefs.maximized) {
      setPanelMaximized(false);
    }
    if (!panelEl) return;
    resizing = true;
    startX = event.clientX;
    startWidth = panelEl.getBoundingClientRect().width;
    panelEl.classList.add("cp-dragging");
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  });
}
