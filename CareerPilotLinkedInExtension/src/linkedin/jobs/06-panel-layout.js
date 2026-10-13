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
      ...parsed
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

function applyPanelLayout() {
  if (!panelEl) return;
  panelEl.classList.toggle("cp-minimized", Boolean(panelPrefs.minimized));
  panelEl.classList.toggle("cp-maximized", Boolean(panelPrefs.maximized));
  if (panelPrefs.maximized) {
    panelEl.style.left = "12px";
    panelEl.style.top = "12px";
    panelEl.style.right = "12px";
    panelEl.style.bottom = "12px";
    panelEl.style.width = "auto";
    panelEl.style.maxHeight = "none";
    panelEl.style.height = "calc(100vh - 24px)";
    return;
  }

  panelEl.style.right = "auto";
  panelEl.style.bottom = "auto";
  const fallbackLeft = Math.max(8, window.innerWidth - 440);
  const fallbackTop = 84;
  if (typeof panelPrefs.left === "number") {
    const maxLeft = Math.max(8, window.innerWidth - 140);
    panelEl.style.left = `${Math.max(8, Math.min(maxLeft, panelPrefs.left))}px`;
  } else {
    panelEl.style.left = `${fallbackLeft}px`;
    panelPrefs.left = fallbackLeft;
  }
  if (typeof panelPrefs.top === "number") {
    const maxTop = Math.max(8, window.innerHeight - 90);
    panelEl.style.top = `${Math.max(8, Math.min(maxTop, panelPrefs.top))}px`;
  } else {
    panelEl.style.top = `${fallbackTop}px`;
    panelPrefs.top = fallbackTop;
  }
  if (typeof panelPrefs.width === "number" && panelPrefs.width >= 320) {
    panelEl.style.width = `${Math.min(window.innerWidth - 16, panelPrefs.width)}px`;
  } else {
    panelEl.style.width = "min(520px, calc(100vw - 22px))";
  }
  // Give the flex column a definite height so the log can shrink and the composer stays visible.
  panelEl.style.height = "78vh";
  panelEl.style.maxHeight = "78vh";
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

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const onMouseMove = (event) => {
    if (!dragging || !panelEl) return;
    const nextLeft = Math.max(8, Math.min(window.innerWidth - 120, event.clientX - offsetX));
    const nextTop = Math.max(8, Math.min(window.innerHeight - 80, event.clientY - offsetY));
    panelPrefs.left = nextLeft;
    panelPrefs.top = nextTop;
    panelEl.style.left = `${nextLeft}px`;
    panelEl.style.top = `${nextTop}px`;
    panelEl.style.right = "auto";
    panelEl.style.bottom = "auto";
  };

  const onMouseUp = () => {
    if (!dragging) return;
    dragging = false;
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
    const rect = panelEl.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    dragging = true;
    panelEl.classList.add("cp-dragging");
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  });
}
