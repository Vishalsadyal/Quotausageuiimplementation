const BRIDGE_VERSION = "2026.03.03";
const EXTENSION_PROVIDER = "indeed";
const PLATFORM_STATUS_MESSAGE = "CP_INDEED_STATUS";
const PLATFORM_STATUS_KEY = "indeed";
const BRIDGE_DEBUG = (() => {
  try {
    return localStorage.getItem("cpBridgeDebug") === "1";
  } catch {
    return false;
  }
})();

const DEFAULT_ALLOWLIST = [
  "https://autoapplycv.in",
  "https://www.autoapplycv.in",
  "https://autoapplycv.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost",
  "https://localhost",
  "http://127.0.0.1",
  "https://127.0.0.1",
];

function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin.toLowerCase();
  } catch {
    return "";
  }
}

function isAllowedDashboardOrigin(origin, allowlist) {
  const set = new Set((Array.isArray(allowlist) ? allowlist : []).map((item) => normalizeOrigin(item)).filter(Boolean));
  if (set.has(normalizeOrigin(origin))) return true;
  try {
    const hostname = new URL(String(origin || "")).hostname.toLowerCase();
    return (
      hostname === "autoapplycv.in" ||
      hostname.endsWith(".autoapplycv.in") ||
      hostname === "autoapplycv.vercel.app"
    );
  } catch {
    return false;
  }
}

let dynamicAllowlist = [...DEFAULT_ALLOWLIST];
let BRIDGE_ENABLED = isAllowedDashboardOrigin(window.location.origin, dynamicAllowlist);
let bridgeHeartbeatTimer = null;

function nowIso() {
  return new Date().toISOString();
}

function bridgeMeta() {
  return {
    provider: EXTENSION_PROVIDER,
    version: BRIDGE_VERSION,
    pageUrl: window.location.href,
    origin: window.location.origin,
  };
}

function logBridge(...args) {
  if (!BRIDGE_DEBUG) return;
  try {
    console.debug("[AutoApplyCVBridge]", ...args);
  } catch {
    // ignore
  }
}

function safePost(message) {
  if (!BRIDGE_ENABLED) return;
  try {
    window.postMessage(message, window.location.origin);
  } catch (error) {
    logBridge("postMessage failed", String(error?.message || error));
  }
}

function markDomBridgeReady() {
  if (!BRIDGE_ENABLED) return;
  try {
    const root = document.documentElement;
    if (!root) return;
    root.setAttribute("data-cp-bridge-ready", "1");
    root.setAttribute("data-cp-bridge-version", BRIDGE_VERSION);
    root.setAttribute("data-cp-bridge-runtime-id", chrome?.runtime?.id || "");
    root.setAttribute("data-cp-bridge-ts", nowIso());
  } catch (error) {
    logBridge("failed to mark dom bridge ready", String(error?.message || error));
  }
}

function announceBridgeReady() {
  if (!BRIDGE_ENABLED) return;
  markDomBridgeReady();
  safePost({
    type: "CP_WEB_BRIDGE_READY",
    provider: EXTENSION_PROVIDER,
    installed: true,
    runtimeId: chrome?.runtime?.id || "",
    bridge: bridgeMeta(),
    ts: nowIso(),
  });
  logBridge("bridge ready", bridgeMeta(), "runtimeId=", chrome?.runtime?.id || "");
}

function ensureBridgeHeartbeat() {
  if (!BRIDGE_ENABLED) return;
  if (bridgeHeartbeatTimer) return;
  bridgeHeartbeatTimer = window.setInterval(() => {
    if (!BRIDGE_ENABLED) return;
    markDomBridgeReady();
    safePost({
      type: "CP_WEB_BRIDGE_HEARTBEAT",
      provider: EXTENSION_PROVIDER,
      installed: true,
      runtimeId: chrome?.runtime?.id || "",
      bridge: bridgeMeta(),
      ts: nowIso(),
    });
    void pushQuotaToExtension();
  }, 10000);
}

async function hydrateDynamicAllowlist() {
  try {
    const res = await fetch(`${window.location.origin}/api/public/extension-config`, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
    });
    if (!res.ok) return;
    const data = await res.json();
    const incoming = Array.isArray(data?.data?.allowedDashboardOrigins)
      ? data.data.allowedDashboardOrigins.map((item) => String(item || ""))
      : [];
    if (!incoming.length) return;
    dynamicAllowlist = Array.from(new Set([...DEFAULT_ALLOWLIST, ...incoming.map((item) => normalizeOrigin(item)).filter(Boolean)]));
    const wasEnabled = BRIDGE_ENABLED;
    BRIDGE_ENABLED = isAllowedDashboardOrigin(window.location.origin, dynamicAllowlist);
    if (!wasEnabled && BRIDGE_ENABLED) {
      announceBridgeReady();
      ensureBridgeHeartbeat();
    }
  } catch (error) {
    logBridge("failed to hydrate extension config", String(error?.message || error));
  }
}

let lastQuotaFetchAt = 0;
let cachedQuota = null;

async function fetchPortalQuota() {
  const now = Date.now();
  if (now - lastQuotaFetchAt < 5000 && cachedQuota) return cachedQuota;
  lastQuotaFetchAt = now;
  try {
    const res = await fetch(`${window.location.origin}/api/user/quota`, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) return cachedQuota;
    cachedQuota = body.data || null;
    return cachedQuota;
  } catch {
    return cachedQuota;
  }
}

async function pushQuotaToExtension() {
  if (!BRIDGE_ENABLED) return;
  const quota = await fetchPortalQuota();
  if (!quota) return;
  try {
    chrome.runtime.sendMessage(
      { type: "CP_SET_PORTAL_QUOTA", data: { ...quota, _origin: window.location.origin } },
      () => void 0,
    );
  } catch {
    // ignore
  }
}

function toggleIndeedPanel(enabled) {
  if (!BRIDGE_ENABLED) return Promise.resolve({ ok: false, error: "bridge disabled" });
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: "CP_TOGGLE_PANEL", enabled }, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(res || { ok: false });
      });
    } catch (err) {
      resolve({ ok: false, error: String(err?.message || err) });
    }
  });
}

function getIndeedPanelEnabled() {
  if (!BRIDGE_ENABLED) return Promise.resolve({ ok: false, error: "bridge disabled" });
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: "CP_GET_PANEL_ENABLED" }, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(res || { ok: false });
      });
    } catch (err) {
      resolve({ ok: false, error: String(err?.message || err) });
    }
  });
}

if (BRIDGE_ENABLED) {
  announceBridgeReady();
  ensureBridgeHeartbeat();
}

// Allow the extension service worker to notify the dashboard tab that it just synced/charged.
try {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message) return;
    if (message.type === "CP_PORTAL_SYNCED") {
      try {
        // Trigger React listeners (DashboardLayout listens for this to refresh the user wallet immediately).
        window.dispatchEvent(new CustomEvent("cp:extensionImported", { detail: message }));
      } catch {
        // ignore
      }
      safePost({
        type: "CP_WEB_PORTAL_SYNCED",
        imported: Number(message.imported || 0),
        ts: message.ts || nowIso(),
        chargedJobs: Number(message.chargedJobs || 0),
        consumedTotal: Number(message.consumedTotal || 0),
        freeConsumed: Number(message.freeConsumed || 0),
        paidConsumed: Number(message.paidConsumed || 0),
        chargeFailures: Number(message.chargeFailures || 0),
        lastChargedJobId: String(message.lastChargedJobId || ""),
        bridge: bridgeMeta(),
      });
      return;
    }
    if (message.type === "CP_WEB_IMPORT_OUTCOMES") {
      (async () => {
        try {
          const entries = Array.isArray(message.entries) ? message.entries : [];
          if (!entries.length) {
            sendResponse({ attempted: true, status: 400, body: { success: false, message: "No entries to import" } });
            return;
          }
          const res = await fetch(`${window.location.origin}/api/extension/import`, {
            method: "POST",
            cache: "no-store",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entries }),
          });
          const body = await res.json().catch(() => null);
          if (res.ok && body?.success) {
            try {
              window.dispatchEvent(new Event("cp:extensionImported"));
            } catch {
              // ignore
            }
          }
          sendResponse({ attempted: true, status: res.status, body });
        } catch (error) {
          sendResponse({
            attempted: true,
            status: 0,
            body: { success: false, message: String(error?.message || error || "Import failed") },
          });
        }
      })();
      return true;
    }
  });
} catch {
  // ignore
}

void hydrateDynamicAllowlist();
window.addEventListener("message", async (event) => {
  if (!BRIDGE_ENABLED) return;
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.type !== "CP_WEB_PING") return;
  logBridge("received CP_WEB_PING", { requestId: data.requestId || "" });

  const requestId = data.requestId || "";
  const defaultPlatformStatus = {
    hasIndeedTab: false,
    hasJobsTab: false,
  };
  const response = {
    type: "CP_WEB_PONG",
    provider: EXTENSION_PROVIDER,
    requestId,
    installed: false,
    runtimeId: chrome?.runtime?.id || "",
    extensionVersion: chrome?.runtime?.getManifest?.()?.version || "",
    state: null,
    dailyCap: null,
    historySummary: null,
    currentRunSummary: null,
    indeed: defaultPlatformStatus,
    pendingQuestions: [],
    history: {
      applied: [],
      failed: [],
      external: [],
      skipped: [],
    },
    runtimeBootstrapOk: false,
    screeningAnswers: {},
    error: null,
    bridge: {
      ...bridgeMeta(),
      ts: nowIso(),
    },
  };

  try {
    const bootstrap = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "CP_GET_BOOTSTRAP" }, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(res || { ok: false });
      });
    });
    if (bootstrap && bootstrap.ok) {
      response.state = bootstrap.state || null;
      response.dailyCap = bootstrap.dailyCap || null;
      response.historySummary = bootstrap.historySummary || null;
      response.currentRunSummary = bootstrap.currentRunSummary || null;
      response.portalQuota = bootstrap.portalQuota || null;
      response.installed = true;
      response.runtimeBootstrapOk = true;
    } else if (bootstrap && bootstrap.error) {
      response.error = bootstrap.error;
      response.installed = false;
      response.runtimeBootstrapOk = false;
    }
  } catch (error) {
    response.error = String(error?.message || error);
    response.installed = false;
    response.runtimeBootstrapOk = false;
  }

  try {
    if (!response.installed) {
      logBridge("runtime unavailable for CP_WEB_PONG", { requestId, error: response.error || "" });
    }
    if (response.installed) {
      // Best-effort update of portal quota cache inside the extension.
      await pushQuotaToExtension();
      const pending = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "CP_GET_PENDING_QUESTIONS" }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false });
            return;
          }
          resolve(res || { ok: false });
        });
      });
      if (pending && pending.ok) {
        response.pendingQuestions = Array.isArray(pending.questions) ? pending.questions : [];
      }

      const settingsRes = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "CP_LOAD_SETTINGS" }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false });
            return;
          }
          resolve(res || { ok: false });
        });
      });
      if (settingsRes && settingsRes.ok) {
        response.screeningAnswers = settingsRes.settings?.screeningAnswers || {};
      }

      const historyRes = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "CP_GET_RUN_HISTORY" }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false });
            return;
          }
          resolve(res || { ok: false });
        });
      });
      if (historyRes && historyRes.ok) {
        response.history = historyRes.history || response.history;
      }
    }
  } catch {
    // ignore
  }

  try {
    if (!response.installed) {
      safePost(response);
      return;
    }
    const platformStatus = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: PLATFORM_STATUS_MESSAGE }, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false });
          return;
        }
        resolve(res || { ok: false });
      });
    });
    if (platformStatus && platformStatus.ok) {
      response[PLATFORM_STATUS_KEY] = platformStatus.data || response[PLATFORM_STATUS_KEY];
    }
  } catch {
    // Ignore platform tab status failures.
  }

  logBridge("sending CP_WEB_PONG", {
    requestId,
    installed: response.installed,
    runtimeBootstrapOk: response.runtimeBootstrapOk,
    runtimeId: response.runtimeId,
    extensionVersion: response.extensionVersion,
    indeed: response.indeed,
    error: response.error,
  });
  safePost(response);
});

window.addEventListener("message", async (event) => {
  if (!BRIDGE_ENABLED) return;
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.type !== "CP_WEB_SAVE_ANSWER") return;
  logBridge("received CP_WEB_SAVE_ANSWER", {
    requestId: data.requestId || "",
    questionKey: data.questionKey || "",
  });
  const requestId = data.requestId || "";

  try {
    const saved = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "CP_SAVE_QUESTION_ANSWER",
          questionKey: data.questionKey,
          questionLabel: data.questionLabel,
          answer: data.answer,
        },
        (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(res || { ok: false });
        },
      );
    });
    safePost({
      type: "CP_WEB_SAVE_ANSWER_ACK",
      requestId,
      ok: Boolean(saved && saved.ok),
      data: saved,
      error: saved?.error || null,
    });
  } catch (error) {
    safePost({
      type: "CP_WEB_SAVE_ANSWER_ACK",
      requestId,
      ok: false,
      error: String(error?.message || error),
    });
  }
});

window.addEventListener("message", async (event) => {
  if (!BRIDGE_ENABLED) return;
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.type !== "CP_WEB_SYNC_SETTINGS") return;
  logBridge("received CP_WEB_SYNC_SETTINGS", { requestId: data.requestId || "" });
  const requestId = data.requestId || "";
  try {
    const incoming = data.settings && typeof data.settings === "object" ? data.settings : {};
    const loaded = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "CP_LOAD_SETTINGS" }, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(res || { ok: false });
      });
    });
    if (!loaded || !loaded.ok) {
      safePost({
        type: "CP_WEB_SYNC_SETTINGS_ACK",
        requestId,
        ok: false,
        error: loaded?.error || "Failed to load extension settings",
      });
      return;
    }

    const merged = {
      ...(loaded.settings || {}),
      ...incoming,
      screeningAnswers: {
        ...(loaded.settings?.screeningAnswers || {}),
        ...(incoming.screeningAnswers || {}),
      },
    };
    const saved = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "CP_SAVE_SETTINGS", settings: merged }, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(res || { ok: false });
      });
    });
    safePost({
      type: "CP_WEB_SYNC_SETTINGS_ACK",
      requestId,
      ok: Boolean(saved && saved.ok),
      data: saved,
      error: saved?.error || null,
    });
  } catch (error) {
    safePost({
      type: "CP_WEB_SYNC_SETTINGS_ACK",
      requestId,
      ok: false,
      error: String(error?.message || error),
    });
  }
});
