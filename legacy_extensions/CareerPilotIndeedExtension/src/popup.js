function sendMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (res) => {
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

const JOBS_SEARCH_URL = "https://www.indeed.com/jobs";
const PROD_BASE_URL = "https://autoapplycv.in";
const DEV_BASE_URL = "http://localhost:3001";
const REMOTE_BASE_CANDIDATES = [
  "https://autoapplycv.in",
  "https://www.autoapplycv.in",
  "https://autoapplycv.vercel.app",
];
let accountConnected = false;
let portalBaseUrl = PROD_BASE_URL;
let popupCollapsed = false;

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function stripLogPrefix(raw) {
  const text = String(raw || "").trim();
  if (text.startsWith("You:")) return text.slice(4).trim();
  if (text.startsWith("Copilot:")) return text.slice(8).trim();
  if (text.startsWith("[debug]")) return text.slice(7).trim();
  return text;
}

function setStatus(text, kind = "info") {
  const el = document.getElementById("status");
  el.textContent = String(text || "");
  el.dataset.kind = kind;
}

function buildPortalUrl(path) {
  const safePath = String(path || "/").startsWith("/") ? String(path || "/") : `/${String(path || "")}`;
  return `${portalBaseUrl.replace(/\/+$/, "")}${safePath}`;
}

async function resolvePortalBaseUrl() {
  try {
    const tabs = await chrome.tabs.query({ url: [
      "https://autoapplycv.in/*",
      "https://www.autoapplycv.in/*",
      "https://autoapplycv.vercel.app/*",
      "http://localhost:3001/*",
      "http://127.0.0.1:3001/*",
    ] });
    const origins = new Set(
      (Array.isArray(tabs) ? tabs : [])
        .map((tab) => {
          try {
            return new URL(String(tab?.url || "")).origin;
          } catch {
            return "";
          }
        })
        .filter(Boolean),
    );
    for (const origin of REMOTE_BASE_CANDIDATES) {
      if (origins.has(origin)) {
        portalBaseUrl = origin;
        return;
      }
    }
    // Keep production domain as default so popup actions stay on live dashboard.
    // Localhost is still supported by bridge/import logic when explicitly opened.
  } catch {
    // ignore and use prod default
  }
  portalBaseUrl = PROD_BASE_URL;
}

function isAccountConnected(settings) {
  if (!settings || typeof settings !== "object") return false;
  const email = String(settings.contactEmail || "").trim();
  const fullName = String(settings.fullName || settings.firstName || "").trim();
  const screeningAnswers = settings.screeningAnswers && typeof settings.screeningAnswers === "object"
    ? settings.screeningAnswers
    : {};
  const hasAnswers = Object.keys(screeningAnswers).length > 0;
  return Boolean(email && (fullName || hasAnswers));
}

async function detectSignedInUserFromTabs() {
  const patterns = [
    "https://autoapplycv.in/*",
    "https://www.autoapplycv.in/*",
    "https://autoapplycv.vercel.app/*",
    "http://localhost:3001/*",
    "http://127.0.0.1:3001/*",
  ];
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: patterns });
  } catch {
    return null;
  }
  for (const tab of tabs) {
    if (!tab?.id) continue;
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          try {
            const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
            let data = null;
            try {
              data = await res.json();
            } catch {
              data = null;
            }
            const user = data?.data?.user || data?.user || null;
            return {
              ok: Boolean(res.ok && data?.success && user?.email),
              email: String(user?.email || ""),
              name: String(user?.name || ""),
              origin: window.location.origin,
            };
          } catch (error) {
            return { ok: false, error: String(error?.message || error) };
          }
        },
      });
      const payload = result?.[0]?.result;
      if (payload?.ok) return payload;
    } catch {
      // continue scanning tabs
    }
  }
  return null;
}

async function detectSignedInUserOnOrigin(origin) {
  const base = String(origin || "").trim().replace(/\/+$/, "");
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/auth/me`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    const user = data?.data?.user || data?.user || null;
    if (!res.ok || !data?.success || !user?.email) return null;
    return {
      ok: true,
      email: String(user.email || ""),
      name: String(user.name || ""),
      origin: base,
    };
  } catch {
    return null;
  }
}

function renderAccountState(settings, sessionUser) {
  const card = document.getElementById("accountCard");
  const title = document.getElementById("accountTitle");
  const badge = document.getElementById("accountBadge");
  const text = document.getElementById("accountText");
  const action = document.getElementById("accountAction");
  const runArea = document.getElementById("runArea");
  const body = document.body;

  const connectedFromSettings = isAccountConnected(settings || {});
  const connectedFromSession = Boolean(sessionUser?.ok && sessionUser?.email);
  accountConnected = connectedFromSettings || connectedFromSession;
  if (body) {
    body.classList.toggle("cp-connected", accountConnected);
    body.classList.toggle("cp-disconnected", !accountConnected);
  }
  const contactEmail = String(sessionUser?.email || settings?.contactEmail || "").trim();
  if (accountConnected) {
    card.classList.remove("disconnected");
    card.classList.add("connected");
    badge.classList.remove("disconnected");
    badge.classList.add("connected");
    badge.textContent = "Connected";
    title.textContent = "Account connected";
    if (connectedFromSession) {
      text.textContent = contactEmail
        ? `Signed in on ${sessionUser.origin} as ${contactEmail}. You can run auto-apply now.`
        : "Website session detected. You can run auto-apply now.";
    } else {
      text.textContent = contactEmail
        ? `Signed in as ${contactEmail}. You can run auto-apply now.`
        : "Your account is connected. You can run auto-apply now.";
    }
    action.textContent = "Open AutoApply CV Dashboard";
    action.dataset.action = "dashboard";
    action.classList.add("btn-primary");
    if (runArea) runArea.style.display = "block";
  } else {
    card.classList.remove("connected");
    card.classList.add("disconnected");
    badge.classList.remove("connected");
    badge.classList.add("disconnected");
    badge.textContent = "Disconnected";
    title.textContent = "Sign in required";
    text.textContent = "Sign in to AutoApply CV to continue.";
    action.textContent = "Sign in to AutoApply CV";
    action.dataset.action = "login";
    action.classList.add("btn-primary");
    if (runArea) runArea.style.display = "none";
  }

  for (const id of ["start", "pause", "stop"]) {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !accountConnected;
  }
  const liveModeToggle = document.getElementById("liveModeToggle");
  if (liveModeToggle) liveModeToggle.disabled = !accountConnected;
}

function updateStatusBadge(state) {
  const badge = document.getElementById("statusBadge");
  const running = Boolean(state?.running);
  const paused = Boolean(state?.paused);
  badge.textContent = running ? "Running" : paused ? "Paused" : "Idle";
  badge.className = `status-badge ${running ? "running" : paused ? "paused" : "idle"}`;
}

function deriveNowCard(state) {
  const logs = Array.isArray(state?.logs) ? state.logs : [];
  const latestAny = logs.length ? logs[logs.length - 1] : null;
  const latestNonDebug = [...logs].reverse().find((entry) => !String(entry?.message || "").startsWith("[debug]")) || latestAny;
  const message = stripLogPrefix(latestNonDebug?.message || "");
  const norm = normalizeText(message);

  let title = "Idle and ready to start.";
  if (state?.paused) {
    title = "Run is paused.";
  } else if (state?.running) {
    if (norm.includes("preparing run")) {
      title = "Preparing search and filters.";
    } else if (norm.includes("found") && norm.includes("job cards")) {
      title = "Scanning job cards.";
    } else if (norm.includes("opening:")) {
      title = "Opening selected job.";
    } else if (norm.includes("modal step")) {
      title = "Filling Easy Apply form.";
    } else if (norm.includes("application submitted")) {
      title = "Application submitted.";
    } else if (norm.includes("submit blocked") || norm.includes("submit did not complete")) {
      title = "Submit blocked. Running fallbacks.";
    } else if (norm.includes("skipped")) {
      title = "Skipping current job and continuing.";
    } else {
      title = "Automation running.";
    }
  }

  const detail = message || (state?.running ? "Working on next action..." : "Press Start to begin.");
  return { title, detail };
}

function getFeedVisual(entry) {
  const raw = String(entry?.message || "");
  const level = String(entry?.level || "info").toLowerCase();
  const isUser = level === "user" || raw.startsWith("You:");
  const isDebug = raw.startsWith("[debug]");
  const sender = isUser ? "You" : "Copilot";
  const kind = level === "error"
    ? "Error"
    : level === "warn"
      ? "Warning"
      : isDebug
        ? "Debug"
        : isUser
          ? "Command"
          : "Update";
  const className = isUser ? "user" : level === "error" ? "error" : level === "warn" ? "warn" : "";
  return {
    sender,
    kind,
    className,
    text: stripLogPrefix(raw),
    time: String(entry?.ts || "").slice(11, 19)
  };
}

function renderFeed(logs) {
  const feed = document.getElementById("feed");
  feed.innerHTML = "";
  const items = Array.isArray(logs) ? logs.slice(-12) : [];
  if (!items.length) {
    const empty = document.createElement("li");
    empty.className = "feed-item";
    const msg = document.createElement("p");
    msg.className = "feed-msg";
    msg.textContent = "No events yet. Start a run to see live steps.";
    empty.appendChild(msg);
    feed.appendChild(empty);
    return;
  }

  for (const entry of items) {
    const visual = getFeedVisual(entry);
    const li = document.createElement("li");
    li.className = `feed-item ${visual.className}`.trim();

    const head = document.createElement("div");
    head.className = "feed-head";

    const sender = document.createElement("span");
    sender.className = "feed-sender";
    sender.textContent = visual.sender;

    const kind = document.createElement("span");
    kind.className = "feed-kind";
    kind.textContent = visual.kind;

    const time = document.createElement("span");
    time.className = "feed-time";
    time.textContent = visual.time;

    head.append(sender, kind, time);

    const msg = document.createElement("p");
    msg.className = "feed-msg";
    msg.textContent = visual.text || "(empty log)";

    li.append(head, msg);
    feed.appendChild(li);
  }
  feed.scrollTop = feed.scrollHeight;
}

function modeLine(settings) {
  const s = settings || {};
  if (s.dryRun) return "Mode: Dry Run (no submit).";
  if (s.autoSubmit) return "Mode: Auto Submit (will click Submit).";
  return "Mode: Manual Submit (fills forms; submit manually).";
}

function applyModeControls(settings) {
  const s = settings || {};
  const toggle = document.getElementById("liveModeToggle");
  const badge = document.getElementById("modeBadge");
  const isLive = Boolean(!s.dryRun && s.autoSubmit);
  const label = isLive ? "Live Auto Submit" : s.dryRun ? "Dry Run" : "Manual Submit";
  if (toggle) toggle.checked = isLive;
  if (badge) {
    badge.textContent = label;
    badge.className = `mode-badge ${isLive ? "live" : s.dryRun ? "" : "manual"}`.trim();
  }
}

function setStats(state, settings) {
  document.getElementById("applied").textContent = String(state?.applied || 0);
  document.getElementById("skipped").textContent = String(state?.skipped || 0);
  document.getElementById("failed").textContent = String(state?.failed || 0);
  updateStatusBadge(state || {});
  const now = deriveNowCard(state || {});
  document.getElementById("nowTitle").textContent = now.title;
  document.getElementById("nowDetail").textContent = `${modeLine(settings)} ${now.detail}`;
  applyModeControls(settings);
  // Popup is intentionally minimal; live feed is available in the floating panel.
}

function applyPopupCollapsed(collapsed, persist = true) {
  popupCollapsed = Boolean(collapsed);
  const body = document.body;
  const toggle = document.getElementById("popupToggle");
  if (body) body.classList.toggle("cp-collapsed", popupCollapsed);
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(!popupCollapsed));
    toggle.title = popupCollapsed ? "Show popup content" : "Hide popup content";
  }
  if (persist) {
    try {
      chrome.storage.local.set({ cpPopupCollapsed: popupCollapsed });
    } catch {
      // ignore storage failures
    }
  }
}

function togglePopupCollapsed() {
  applyPopupCollapsed(!popupCollapsed, true);
}

async function loadCollapsedPreference() {
  try {
    const stored = await chrome.storage.local.get(["cpPopupCollapsed"]);
    applyPopupCollapsed(Boolean(stored?.cpPopupCollapsed), false);
  } catch {
    applyPopupCollapsed(false, false);
  }
}

function bindPopupToggle() {
  const toggle = document.getElementById("popupToggle");
  if (!toggle) return;
  toggle.addEventListener("click", () => togglePopupCollapsed());
  toggle.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    togglePopupCollapsed();
  });
}

async function refresh() {
  await resolvePortalBaseUrl();
  const [boot, loadedSettings, selectedOriginSession] = await Promise.all([
    sendMessage({ type: "CP_GET_BOOTSTRAP" }),
    sendMessage({ type: "CP_LOAD_SETTINGS" }),
    detectSignedInUserOnOrigin(portalBaseUrl),
  ]);
  const sessionUser = selectedOriginSession || await detectSignedInUserFromTabs();
  if (!boot.ok) {
    setStatus("Extension service unavailable.", "error");
    return;
  }
  renderAccountState(loadedSettings?.settings || {}, sessionUser);
  if (!accountConnected) {
    setStatus("Sign in to AutoApply CV to enable run controls.", "warn");
    return;
  }
  setStats(boot.state || {}, loadedSettings?.settings || {});
  setStatus(boot.state?.running ? "Run active." : boot.state?.paused ? "Run paused." : "Ready.");
}

function isLinkedInUrl(url) {
  try {
    const u = new URL(String(url || ""));
    return u.hostname === "www.indeed.com" || u.hostname.endsWith(".indeed.com");
  } catch {
    return false;
  }
}

function isLinkedInJobsUrl(url) {
  try {
    const u = new URL(String(url || ""));
    return isLinkedInUrl(url) && (u.pathname.startsWith("/jobs") || u.pathname.startsWith("/viewjob"));
  } catch {
    return false;
  }
}

function waitForTabComplete(tabId, timeoutMs = 20000) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      resolve(false);
    }, timeoutMs);

    const onUpdated = (id, info) => {
      if (done) return;
      if (id !== tabId) return;
      if (info.status === "complete") {
        done = true;
        cleanup();
        resolve(true);
      }
    };

    function cleanup() {
      clearTimeout(timer);
      try {
        chrome.tabs.onUpdated.removeListener(onUpdated);
      } catch {
        // ignore
      }
    }

    try {
      chrome.tabs.onUpdated.addListener(onUpdated);
    } catch {
      clearTimeout(timer);
      resolve(false);
    }
  });
}

function getIndeedJobsUrl(fromUrl) {
  try {
    const u = new URL(String(fromUrl || ""));
    if (u.hostname.endsWith(".indeed.com") || u.hostname === "indeed.com") {
      return `https://${u.hostname}/jobs`;
    }
  } catch { /* ignore */ }
  return JOBS_SEARCH_URL;
}

async function focusOrOpenLinkedInJobs() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Derive the jobs base URL from the active tab's Indeed hostname (supports in.indeed.com, etc.)
  const jobsUrl = getIndeedJobsUrl(active?.url) || JOBS_SEARCH_URL;

  // Prefer reusing the active tab if it's already on Indeed.
  if (active?.id && isLinkedInUrl(active.url)) {
    if (!isLinkedInJobsUrl(active.url)) {
      await chrome.tabs.update(active.id, { url: jobsUrl, active: true });
      await waitForTabComplete(active.id);
    }
    return active.id;
  }

  // Otherwise, activate an existing Indeed Jobs tab if present.
  const tabs = await chrome.tabs.query({ url: ["https://www.indeed.com/*", "https://*.indeed.com/*"] });
  const jobsTab = tabs.find((t) => t?.id && isLinkedInJobsUrl(t.url)) || null;
  if (jobsTab?.id) {
    await chrome.tabs.update(jobsTab.id, { active: true });
    return jobsTab.id;
  }

  // Fallback: create a new Jobs tab (prefer same subdomain as active tab).
  const created = await chrome.tabs.create({ url: jobsUrl, active: true });
  if (created?.id) await waitForTabComplete(created.id);
  return created?.id || null;
}

document.getElementById("start").addEventListener("click", async () => {
  if (!accountConnected) {
    setStatus("Sign in to AutoApply CV first.", "warn");
    return;
  }
  await focusOrOpenLinkedInJobs();
  const started = await sendMessage({ type: "CP_START", forceRestart: false });
  if (!started.ok) {
    setStatus(started.error || "Failed to start run", "error");
    return;
  }
  await refresh();
  setStatus("Run started.");
});

document.getElementById("liveModeToggle").addEventListener("change", async (event) => {
  if (!accountConnected) {
    setStatus("Sign in to AutoApply CV first.", "warn");
    event.target.checked = false;
    return;
  }
  const enableLive = Boolean(event?.target?.checked);
  const settingsPatch = enableLive
    ? { autoSubmit: true, dryRun: false, liveModeAcknowledged: true }
    : { autoSubmit: false, dryRun: true };
  const saved = await sendMessage({ type: "CP_SAVE_SETTINGS", settings: settingsPatch });
  if (!saved?.ok) {
    setStatus(saved?.error || "Failed to update mode", "error");
    await refresh();
    return;
  }
  await refresh();
  setStatus(enableLive ? "Live auto-submit enabled." : "Dry-run enabled.");
});

document.getElementById("pause").addEventListener("click", async () => {
  if (!accountConnected) {
    setStatus("Sign in to AutoApply CV first.", "warn");
    return;
  }
  await sendMessage({ type: "CP_PAUSE" });
  await refresh();
  setStatus("Run paused.");
});

document.getElementById("stop").addEventListener("click", async () => {
  if (!accountConnected) {
    setStatus("Sign in to AutoApply CV first.", "warn");
    return;
  }
  await sendMessage({ type: "CP_STOP" });
  await refresh();
  setStatus("Run stopped.");
});

document.getElementById("accountAction").addEventListener("click", async () => {
  const action = document.getElementById("accountAction").dataset.action || "login";
  const url = action === "dashboard" ? buildPortalUrl("/dashboard") : buildPortalUrl("/login");
  await chrome.tabs.create({ url });
  setStatus(action === "dashboard" ? "Opened dashboard." : "Opened login.");
});

async function init() {
  bindPopupToggle();
  await loadCollapsedPreference();
  await loadPanelToggle();
  await refresh();
}

async function loadPanelToggle() {
  const panelToggle = document.getElementById("panelToggle");
  if (!panelToggle) return;
  try {
    const res = await sendMessage({ type: "CP_GET_PANEL_ENABLED" });
    panelToggle.checked = Boolean(res?.enabled);
  } catch {
    panelToggle.checked = false;
  }
  panelToggle.addEventListener("change", async () => {
    const enabled = Boolean(panelToggle.checked);
    try {
      await sendMessage({ type: "CP_TOGGLE_PANEL", enabled });
    } catch {}
  });
}

init().catch(() => setStatus("Unavailable", "error"));
