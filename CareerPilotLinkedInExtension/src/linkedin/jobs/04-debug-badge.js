/*
 * LinkedIn Jobs auto-apply - part 04: debug-badge
 *
 * Current job context, saved panel preferences, and the optional on-page debug badge (?cpDebug=1).
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

let currentJobContext = {
  title: "",
  company: "",
  workLocation: "",
  description: "",
  aboutCompany: "",
  jobId: "",
  jobUrl: ""
};
let panelPrefs = {
  left: null,
  top: null,
  width: null,
  height: null,
  minimized: false,
  maximized: false
};

function wantsDebugUiFromUrl() {
  try {
    const v = new URLSearchParams(window.location.search || "").get("cpDebug");
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

function wantsDebugUiFromLocalStorage() {
  try {
    return localStorage.getItem("cpDebugUi") === "1";
  } catch {
    return false;
  }
}

function removeDebugBadge() {
  try {
    if (debugBadgeEl && debugBadgeEl.parentNode) debugBadgeEl.remove();
  } catch {
    // ignore
  } finally {
    debugBadgeEl = null;
  }
}

function setDebugUiEnabled(enabled) {
  debugUiEnabled = Boolean(enabled);
  if (panelEl) panelEl.classList.toggle("cp-debug-ui", debugUiEnabled);
  if (!debugUiEnabled) removeDebugBadge();
}

function ensureDebugBadge() {
  if (!debugUiEnabled) return null;
  if (debugBadgeEl && document.body.contains(debugBadgeEl)) return debugBadgeEl;
  const el = document.createElement("div");
  el.id = "cp-panel-debug-badge";
  Object.assign(el.style, {
    position: "fixed",
    left: "10px",
    top: "10px",
    zIndex: "2147483647",
    background: "rgba(0,0,0,0.72)",
    color: "#fff",
    fontSize: "11px",
    padding: "4px 8px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.3)",
    fontFamily: "monospace",
    cursor: "pointer",
    maxWidth: "70vw",
  });
  el.title = "Click to reset copilot panel position";
  el.addEventListener("click", () => {
    panelPrefs.left = Math.max(8, window.innerWidth - 440);
    panelPrefs.top = 84;
    panelPrefs.minimized = false;
    panelPrefs.maximized = false;
    savePanelPrefs();
    applyPanelLayout();
    logPanelDebug("debug-badge-reset");
  });
  document.body.appendChild(el);
  debugBadgeEl = el;
  return el;
}

function logPanelDebug(reason = "state") {
  if (!debugUiEnabled) return;
  try {
    const badge = ensureDebugBadge();
    if (!badge) return;
    if (!panelEl) {
      badge.textContent = `CP: panel missing (${reason})`;
      console.debug("[CP]", reason, "panel missing");
      return;
    }
    const rect = panelEl.getBoundingClientRect();
    const visible =
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth;
    badge.textContent = `CP: ${visible ? "visible" : "offscreen"} x=${Math.round(rect.left)} y=${Math.round(rect.top)} w=${Math.round(rect.width)} h=${Math.round(rect.height)} (${reason})`;
    console.debug("[CP]", reason, {
      visible,
      rect: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      prefs: panelPrefs,
      className: panelEl.className,
    });
  } catch {
    // ignore debug failures
  }
}
