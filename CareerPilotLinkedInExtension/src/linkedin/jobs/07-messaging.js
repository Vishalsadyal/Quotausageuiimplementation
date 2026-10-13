/*
 * LinkedIn Jobs auto-apply - part 07: messaging
 *
 * Messages to the background worker, progress reports, panel log/chat helpers, remote selector
 * overrides, safe querySelector helpers, and page-type checks (search / view / post-apply).
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

function sendMessage(message) {
  return new Promise((resolve) => {
    if (!extensionContextAlive) {
      resolve({ ok: false, error: "Extension context invalidated" });
      return;
    }
    if (!chrome?.runtime?.id) {
      markContextInvalidated();
      resolve({ ok: false, error: "Extension runtime unavailable" });
      return;
    }
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const runtimeError = chrome.runtime?.lastError;
        if (runtimeError) {
          const msg = String(runtimeError.message || "Runtime message error");
          if (msg.toLowerCase().includes("context invalidated")) {
            markContextInvalidated();
          }
          resolve({ ok: false, error: msg });
          return;
        }
        resolve(response || { ok: false });
      });
    } catch (error) {
      const msg = String(error?.message || error || "Runtime sendMessage failed");
      if (msg.toLowerCase().includes("context invalidated")) {
        markContextInvalidated();
      }
      resolve({ ok: false, error: msg });
    }
  });
}

async function reportProgress() {
  const response = await sendMessage({ type: "CP_PROGRESS", ...runStats });
  if (response?.ok) return true;
  const code = String(response?.errorCode || "").toUpperCase();
  if (code === "DAILY_CAP_REACHED") {
    await logLine("Daily cap reached (3/day). Stopping run.", "warn");
    await botChat("Daily application limit reached. AI Copilot is pausing for today.", "warn");
    await sendMessage({ type: "CP_STOP" });
    return false;
  }
  return true;
}

window.addEventListener("unhandledrejection", (event) => {
  const msg = String(event?.reason?.message || event?.reason || "");
  if (msg.toLowerCase().includes("extension context invalidated")) {
    markContextInvalidated();
    event.preventDefault();
  }
});

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function logLine(message, level = "info", meta = undefined) {
  return sendMessage({ type: "CP_LOG", message, level, meta });
}

function userChat(text) {
  return logLine(`You: ${String(text || "").trim()}`, "user");
}

function botChat(text, level = "info") {
  return logLine(`Copilot: ${String(text || "").trim()}`, level);
}

async function debugLog(settings, message, meta = undefined) {
  if (!settings?.debugMode) return;
  await logLine(`[debug] ${message}`, "info", meta);
}

function getBySelectorList(selectors, root = document) {
  for (const s of selectors) {
    const el = root.querySelector(s);
    if (el) return el;
  }
  return null;
}

function getAllBySelectorList(selectors, root = document) {
  for (const s of selectors) {
    const list = root.querySelectorAll(s);
    if (list.length) return Array.from(list);
  }
  return [];
}

async function loadRemoteSelectors() {
  try {
    const res = await sendMessage({ type: "CP_GET_SELECTORS" });
    if (res?.ok && res.selectors) {
      remoteSelectors = res.selectors;
      remoteSelectorsVersion = res.version || 0;
    }
  } catch {}
}

function getS(key) {
  if (remoteSelectors && remoteSelectors[key]) return remoteSelectors[key];
  return null;
}

function checkSelectorHealth() {
  const jobCards = getAllBySelectorList(getS("jobCards") || [
    ".job-card-container",
    "[data-occludable-job-id]",
    "li.jobs-search-results__list-item",
    ".jobs-search-results-list__list-item",
    "li.scaffold-layout__list-item",
  ]);
  const hasJobCards = jobCards.length > 0;
  const hasSearchInput = !!getBySelectorList(getS("searchInput") || [
    "input.jobs-search-box__text-input",
    "input[aria-label*='Search by']",
    "input[placeholder*='Search']",
  ]);
  const hasApplyButton = !!getBySelectorList(getS("easyApplyButton") || [
    "button.jobs-apply-button",
    "button[aria-label*='Easy Apply']",
    "button[aria-label*='Apply']",
  ]);
  return {
    ok: hasJobCards || hasSearchInput,
    hasJobCards,
    hasSearchInput,
    hasApplyButton,
    jobCardCount: jobCards.length,
  };
}

function safeQuerySelectorAll(root, selector, settings = null, context = "querySelectorAll") {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch (error) {
    void debugLog(settings || { debugMode: true }, `${context} selector failed`, {
      selector,
      error: error?.message || String(error)
    });
    return [];
  }
}

function isJobsPage() {
  return window.location.pathname.startsWith("/jobs");
}

function isJobsSearchPage() {
  return window.location.pathname.startsWith("/jobs/search") && !isPostApplySearchPage();
}

function isJobsViewPage() {
  return window.location.pathname.startsWith("/jobs/view") || window.location.href.includes("/jobs/view/");
}

function isPostApplySearchPage() {
  return window.location.pathname.startsWith("/jobs/search/post-apply");
}

async function isRunActive() {
  const boot = await getBootstrap();
  return Boolean(boot?.state?.running && !boot?.state?.paused);
}
