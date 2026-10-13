/*
 * LinkedIn Jobs auto-apply - part 02: debug-log
 *
 * In-memory debug event buffer, timers, page snapshots, and the downloadable debug log export.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

function captureDebugEvent(category, event, data = {}) {
  const entry = {
    ts: new Date().toISOString(),
    cat: category,
    evt: event,
    ...data,
  };
  debugLogBuffer.push(entry);
  if (debugLogBuffer.length > MAX_DEBUG_LOG_ENTRIES) {
    debugLogBuffer = debugLogBuffer.slice(-MAX_DEBUG_LOG_ENTRIES);
  }
  try {
    console.debug(`[CP][${category}]`, event, data);
  } catch { /* ignore */ }
}

function startTimer(label) {
  debugTimers[label] = performance.now();
}

function endTimer(label) {
  const start = debugTimers[label];
  if (start == null) return 0;
  const elapsed = Math.round(performance.now() - start);
  delete debugTimers[label];
  return elapsed;
}

function capturePageSnapshot(context = "") {
  return {
    url: window.location.href,
    pathname: window.location.pathname,
    title: document.title || "",
    context,
  };
}

function buildDebugLogExport() {
  const settingsSnapshot = {};
  try {
    const raw = window.sessionStorage.getItem("cpLastSearchResultsUrl") || "";
    settingsSnapshot.lastSearchUrl = raw;
  } catch { /* ignore */ }
  return {
    exportedAt: new Date().toISOString(),
    bufferSize: debugLogBuffer.length,
    page: capturePageSnapshot(),
    settingsSnapshot,
    entries: debugLogBuffer,
  };
}

async function downloadDebugLogFile() {
  const payload = buildDebugLogExport();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `cp-debug-log-${stamp}.json`;
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    captureDebugEvent("debug-export", "download-triggered", { filename, entries: payload.bufferSize });
    await botChat(`Debug log downloaded (${payload.bufferSize} entries).`);
  } catch (err) {
    captureDebugEvent("debug-export", "download-failed", { error: String(err) });
    await botChat("Failed to download debug log.", "error");
  }
}
