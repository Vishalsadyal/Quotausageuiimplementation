/**
 * AutoApply CV Suite - Unified Popup Controller
 * Manages LinkedIn Apply, WhatsApp Outreach, Auto Commenter, Email Outreach, Call Copilot & Settings.
 */

function sendMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (res) => {
        const err = chrome.runtime?.lastError;
        if (err) {
          resolve({ ok: false, error: err.message || "Extension unavailable" });
          return;
        }
        resolve(res || { ok: false });
      });
    } catch (e) {
      resolve({ ok: false, error: e?.message || "Extension unavailable" });
    }
  });
}

const JOBS_SEARCH_URL = "https://www.linkedin.com/jobs/search/?f_AL=true";
const PROD_BASE_URL = "https://autoapplycv.in";
let portalBaseUrl = PROD_BASE_URL;

// ── Tab Switching Logic ──
function setupTabs() {
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.getAttribute("data-tab");
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      document.querySelectorAll(".tab-pane").forEach((pane) => {
        pane.classList.remove("active");
      });

      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add("active");
      }

      // Refresh specific tab data
      if (targetId === "tab-whatsapp") loadWhatsAppStatus();
      if (targetId === "tab-commenter") loadCommenterStatus();
      if (targetId === "tab-emailoutreach" || targetId === "tab-hroutreach") loadEmailOutreachStatus();
    });
  });
}

// ── Module 1: LinkedIn Auto Apply ──
async function updateLinkedInState() {
  const res = await sendMessage({ type: "CP_GET_BOOTSTRAP" });
  if (!res.ok) return;

  const { state = {}, settings = {}, dailyCap = {}, portalQuota = {} } = res;

  // Status Badge
  const badge = document.getElementById("statusBadge");
  if (state.running) {
    badge.className = "status-badge running";
    badge.textContent = "Running";
  } else if (state.paused) {
    badge.className = "status-badge paused";
    badge.textContent = "Paused";
  } else {
    badge.className = "status-badge idle";
    badge.textContent = "Ready";
  }

  // Live Counts
  document.getElementById("applied").textContent = state.applied || 0;
  document.getElementById("skipped").textContent = state.skipped || 0;
  document.getElementById("failed").textContent = state.failed || 0;

  // Now Running Details
  const nowTitle = document.getElementById("nowTitle");
  const nowDetail = document.getElementById("nowDetail");
  if (state.running) {
    nowTitle.textContent = "Easy Apply Bot Active";
    nowDetail.textContent = "Scanning jobs & autofilling application forms...";
  } else {
    nowTitle.textContent = "Ready on LinkedIn";
    nowDetail.textContent = "Open LinkedIn Jobs to start autonomous job application.";
  }

  // Mode Switch
  const toggle = document.getElementById("liveModeToggle");
  const modeBadge = document.getElementById("modeBadge");
  if (toggle && modeBadge) {
    const isLive = Boolean(settings.autoSubmit && !settings.dryRun);
    toggle.checked = isLive;
    modeBadge.textContent = isLive ? "Live Submit" : "Dry Run";
    modeBadge.style.background = isLive ? "#d1fae5" : "#fef3c7";
    modeBadge.style.color = isLive ? "#065f46" : "#92400e";
  }

  // Quota
  // Only write a number the extension really has. Its short-term quota cache is empty right after it restarts,
  // and showing 0 then made the count flash 0 until the next refresh.
  const spendable = knownSpendable(portalQuota);
  const plan = String(portalQuota?.data?.plan || "").toLowerCase();
  const unlimited = isUnlimitedPlan(plan, spendable);
  if (spendable !== null) {
    document.getElementById("popupHiresCount").textContent = unlimited ? "Unlimited" : spendable;
    document.getElementById("popupQuotaDetail").textContent = unlimited
      ? `${PLAN_NAMES[plan] || "Paid"} plan \u2022 no daily limit`
      : `Daily Free: ${dailyCap.used || 0}/${dailyCap.cap || 3} \u2022 Spendable: ${spendable}`;
    const topup = document.getElementById("popupTopupLink");
    if (topup) {
      topup.href = `${portalBaseUrl}/dashboard/billing`;
      topup.textContent = unlimited ? "Manage" : "Top Up";
    }
  }

  // Account Card
  // Signed in when the website answered the quota check (it needs the login), even if the profile
  // name hasn't synced to the extension yet. The name comes from the synced profile when there is one.
  const accountCard = document.getElementById("accountCard");
  const accountBadge = document.getElementById("accountBadge");
  const accountText = document.getElementById("accountText");
  const accountAction = document.getElementById("accountAction");
  const accountActionText = document.getElementById("accountActionText");
  const who = settings.fullName || settings.contactEmail || "";
  const isConnected = Boolean(plan) || Boolean(who);
  if (isConnected) {
    accountCard.className = "account-card connected";
    accountBadge.className = "account-badge connected";
    accountBadge.textContent = "Connected";
    accountText.textContent = who
      ? `Signed in as ${who}${plan ? ` \u2022 ${PLAN_NAMES[plan] || plan} plan` : ""}`
      : `Signed in${plan ? ` \u2022 ${PLAN_NAMES[plan] || plan} plan` : ""}`;
    if (accountActionText) accountActionText.textContent = "Open my dashboard";
    if (accountAction) accountAction.dataset.target = "dashboard";
  } else {
    accountCard.className = "account-card disconnected";
    accountBadge.className = "account-badge disconnected";
    accountBadge.textContent = "Disconnected";
    accountText.textContent = "Sign in to connect your profile and sync your Hires.";
    if (accountActionText) accountActionText.textContent = "Sign in to AutoApply CV";
    if (accountAction) accountAction.dataset.target = "login";
    document.getElementById("popupHiresCount").textContent = "--";
    document.getElementById("popupQuotaDetail").textContent = "Sign in to see your Hires.";
  }
}

const PLAN_NAMES = { free: "Free", pro: "Pro", connect: "Pro Connect", coach: "Career Coach" };

// Paid plans have no Hires limit; the website sends 1000000 for them (src/lib/hires.ts getWalletSummary).
function isUnlimitedPlan(plan, spendable) {
  return ["pro", "connect", "coach"].includes(plan) || (spendable !== null && spendable >= 1000000);
}

function setupLinkedInControls() {
  document.getElementById("start")?.addEventListener("click", async () => {
    await sendMessage({ type: "CP_START" });
    await updateLinkedInState();
  });

  document.getElementById("pause")?.addEventListener("click", async () => {
    await sendMessage({ type: "CP_PAUSE" });
    await updateLinkedInState();
  });

  document.getElementById("stop")?.addEventListener("click", async () => {
    await sendMessage({ type: "CP_STOP" });
    await updateLinkedInState();
  });

  document.getElementById("liveModeToggle")?.addEventListener("change", async (e) => {
    const isLive = e.target.checked;
    await sendMessage({
      type: "CP_SAVE_SETTINGS",
      settings: { autoSubmit: isLive, dryRun: !isLive }
    });
    await updateLinkedInState();
  });

  document.getElementById("popupClearLogs")?.addEventListener("click", async () => {
    await sendMessage({ type: "CP_CLEAR_LOGS" });
    await updateLinkedInState();
  });

  // Signed out: the website's login page. Signed in: the dashboard.
  document.getElementById("accountAction")?.addEventListener("click", (e) => {
    const target = e.currentTarget?.dataset?.target === "dashboard" ? "/dashboard" : "/login";
    chrome.tabs.create({ url: `${portalBaseUrl}${target}` });
  });
}

// ── Modules 3-5: WhatsApp, LinkedIn comments, Email ──
// The message and the options are written in the dashboard (Auto Apply > Messages) and handed to the
// extension from there. These tabs only show what will be sent and start the tool.
function dashboardMessagesUrl() {
  return `${portalBaseUrl}/dashboard/jobs/linkedin/messages`;
}

// Shows whether the message exists. Without one the Start button is off, because nothing can be sent.
function showMessageState(prefix, text, startButtonId) {
  const clean = String(text || "").trim();
  const state = document.getElementById(`${prefix}MessageState`);
  const preview = document.getElementById(`${prefix}MessagePreview`);
  const link = document.getElementById(`${prefix}EditLink`);
  if (link) link.href = dashboardMessagesUrl();
  if (state) {
    state.textContent = clean ? "Ready" : "Not written yet";
    state.className = `msg-state ${clean ? "ready" : "empty"}`;
  }
  if (preview) {
    preview.textContent = clean
      ? clean.length > 220 ? `${clean.slice(0, 217)}...` : clean
      : "Write it in your dashboard first. Nothing is sent until you do.";
  }
  const start = startButtonId ? document.getElementById(startButtonId) : null;
  if (start) {
    start.disabled = !clean;
    start.title = clean ? "" : "Write your message in the dashboard first";
  }
}

// LinkedIn's hiring posts page for a tool, searching the user's first keyword (set in the dashboard).
function outreachPostsUrl(moduleName, keyword) {
  const query = `${String(keyword || "").trim()} hiring ${moduleName}`.trim();
  return `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(query)}&sortBy=%5B%22date_posted%22%5D#autoapply-module=${moduleName}`;
}

const outreachKeyword = { whatsapp: "", email: "" };

function showOpenPostsLink(moduleName, linkId, keywords) {
  outreachKeyword[moduleName] = Array.isArray(keywords) && keywords[0] ? String(keywords[0]) : "";
  const link = document.getElementById(linkId);
  if (link) link.href = outreachPostsUrl(moduleName, outreachKeyword[moduleName]);
}

// Opens the hiring posts page in the right mode, or tells the LinkedIn tab that is already open to start.
async function startOutreachOnLinkedIn(triggerType, moduleName) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  const feedUrl = outreachPostsUrl(moduleName, outreachKeyword[moduleName]);
  if (currentTab && currentTab.url && currentTab.url.includes("linkedin.com")) {
    chrome.tabs.sendMessage(currentTab.id, { type: triggerType }, () => {
      if (chrome.runtime.lastError) chrome.tabs.create({ url: feedUrl });
    });
  } else {
    chrome.tabs.create({ url: feedUrl });
  }
}

async function loadWhatsAppStatus() {
  const res = await sendMessage({ type: "WA_GET_STATUS" });
  if (!res) return;
  document.getElementById("waTotalLeads").textContent = res.totalLeads || 0;
  document.getElementById("waContactedCount").textContent = res.contactedCount || 0;
  showMessageState("wa", res.settings?.messageTemplate, "waAutoSendAllBtn");
  showOpenPostsLink("whatsapp", "waOpenPosts", res.settings?.targetKeywords);
}

function setupWhatsAppControls() {
  document.getElementById("waAutoSendAllBtn")?.addEventListener("click", () => {
    void startOutreachOnLinkedIn("TRIGGER_AUTO_SEND_ALL", "whatsapp");
  });
}

async function loadCommenterStatus() {
  const res = await sendMessage({ type: "AC_GET_STATUS" });
  if (!res) return;
  document.getElementById("acSessionCount").textContent = res.state?.sessionCount || 0;
  document.getElementById("acTotalCount").textContent = res.totalCount || 0;
  showMessageState("ac", res.settings?.commentText, "acStartBtn");
}

function setupCommenterControls() {
  document.getElementById("acStartBtn")?.addEventListener("click", async () => {
    // The comment text and options come from the saved settings (written in the dashboard).
    await sendMessage({ type: "START_COMMENTING", payload: {} });
    await loadCommenterStatus();
  });

  document.getElementById("acStopBtn")?.addEventListener("click", async () => {
    await sendMessage({ type: "STOP_COMMENTING" });
    await loadCommenterStatus();
  });
}

async function loadEmailOutreachStatus() {
  const res = await sendMessage({ type: "EMAIL_GET_STATUS" });
  if (!res) return;
  const totalLeadsEl = document.getElementById("emailTotalLeads");
  const contactedCountEl = document.getElementById("emailContactedCount");
  if (totalLeadsEl) totalLeadsEl.textContent = res.totalLeads || 0;
  if (contactedCountEl) contactedCountEl.textContent = res.contactedCount || 0;
  const subject = String(res.settings?.subjectTemplate || "").trim();
  const body = String(res.settings?.messageTemplate || "").trim();
  // An email needs both a subject and a body.
  showMessageState("email", subject && body ? `${subject}

${body}` : "", "emailAutoSendAllBtn");
  showOpenPostsLink("email", "emailOpenPosts", res.settings?.targetKeywords);
}

function setupEmailOutreachControls() {
  document.getElementById("emailAutoSendAllBtn")?.addEventListener("click", () => {
    void startOutreachOnLinkedIn("TRIGGER_EMAIL_AUTO_SEND_ALL", "email");
  });
}

// ── Module 6: Client Call Copilot (Google Meet) ──
function setupMeetCopilotControls() {
  document.getElementById("mcOpenMeetBtn")?.addEventListener("click", async () => {
    const tabs = await chrome.tabs.query({ url: "https://meet.google.com/*" });
    const meetingTab = tabs.find((t) => /meet\.google\.com\/[a-z]{3,4}-[a-z]{4}-[a-z]{3,4}/i.test(String(t.url || "")));
    if (!meetingTab?.id) {
      chrome.tabs.create({ url: "https://meet.google.com/" });
      return;
    }
    await chrome.tabs.update(meetingTab.id, { active: true });
    chrome.windows.update(meetingTab.windowId, { focused: true });
    chrome.tabs.sendMessage(meetingTab.id, { type: "MC_TOGGLE_PANEL" }).catch(() => {
      alert("Refresh the Meet tab once so the copilot can load.");
    });
  });
}

// ── Module 7: Settings & Options Page Link ──
function setupSettingsControls() {
  document.getElementById("openOptionsPageBtn")?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

// The spendable Hires from the extension's quota cache, or null when it has none yet (never 0 by default).
function knownSpendable(portalQuota) {
  const raw = portalQuota?.data?.spendable ?? portalQuota?.data?.hireBalance;
  const n = Number(raw);
  return raw === undefined || raw === null || raw === "" || !Number.isFinite(n) ? null : n;
}

// ── Hires left (WhatsApp, Comments and Email tabs) ──
// The background rewrites `cpHiresBalance` after every allowance check and every charge, so the number
// drops live while messages are being sent, even with this popup open.
function showHires(balance) {
  if (!balance) return;
  const n = Number(balance.spendable || 0);
  // Paid plans come as 1000000 spendable Hires, which means no limit.
  const unlimited = Boolean(balance.unlimited) || n >= 1000000;
  const text = unlimited ? "Unlimited" : `${n} ${n === 1 ? "Hire" : "Hires"}`;
  // The LinkedIn tab's counter fills from the same stored balance, so it shows the real number as soon as
  // the popup opens instead of waiting for the extension to answer.
  const counter = document.getElementById("popupHiresCount");
  if (counter) counter.textContent = unlimited ? "Unlimited" : String(n);
  document.querySelectorAll("[data-hires-line]").forEach((line) => {
    const before = line.dataset.last === undefined || line.dataset.last === "" ? null : Number(line.dataset.last);
    line.hidden = false;
    line.querySelector("[data-hires-text]").textContent = text;
    line.classList.toggle("is-low", !unlimited && n > 0 && n <= 3);
    line.classList.toggle("is-empty", !unlimited && n <= 0);
    if (!unlimited && before !== null && n < before) {
      line.classList.remove("is-drop");
      void line.offsetWidth; // restart the animation
      line.classList.add("is-drop");
    }
    line.dataset.last = unlimited ? "" : String(n);
  });
}

function setupHires() {
  chrome.storage.local.get("cpHiresBalance", (data) => showHires(data && data.cpHiresBalance));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.cpHiresBalance) showHires(changes.cpHiresBalance.newValue);
  });
  // A fresh number now; it arrives through the storage listener above.
  chrome.runtime.sendMessage({ type: "CP_OUTREACH_STATUS" }, () => void chrome.runtime.lastError);
}

// ── Initialize Suite ──
document.addEventListener("DOMContentLoaded", async () => {
  // The version in the footer comes from manifest.json, so it can't go out of date.
  const version = chrome.runtime?.getManifest?.()?.version;
  const foot = document.getElementById("footVersion");
  if (foot && version) foot.textContent = `AutoApply CV Suite v${version}`;

  setupTabs();
  setupLinkedInControls();
  setupWhatsAppControls();
  setupCommenterControls();
  setupEmailOutreachControls();
  setupMeetCopilotControls();
  setupSettingsControls();
  setupHires();

  await updateLinkedInState();
  setInterval(() => {
    updateLinkedInState();
  }, 3000);
});
