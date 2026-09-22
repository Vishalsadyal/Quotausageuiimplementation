/**
 * AutoApply CV Suite - Unified Popup Controller
 * Manages LinkedIn Apply, Indeed Copilot, WhatsApp Outreach, Auto Commenter, HR Finder & Settings.
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
      if (targetId === "tab-indeed") updateIndeedState();
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
  const spendable = Number(portalQuota?.data?.spendable ?? portalQuota?.data?.hireBalance ?? 0);
  document.getElementById("popupHiresCount").textContent = spendable;
  document.getElementById("popupQuotaDetail").textContent = `Daily Free: ${dailyCap.used || 0}/${dailyCap.cap || 3} &bull; Spendable: ${spendable}`;

  // Account Card
  const accountCard = document.getElementById("accountCard");
  const accountBadge = document.getElementById("accountBadge");
  const accountText = document.getElementById("accountText");
  const isConnected = Boolean(settings.contactEmail || settings.fullName);
  if (isConnected) {
    accountCard.className = "account-card connected";
    accountBadge.className = "account-badge connected";
    accountBadge.textContent = "Connected";
    accountText.textContent = `Connected as ${settings.fullName || settings.contactEmail}`;
  } else {
    accountCard.className = "account-card disconnected";
    accountBadge.className = "account-badge disconnected";
    accountBadge.textContent = "Disconnected";
    accountText.textContent = "Sign in to connect your profile and sync quota.";
  }
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

  document.getElementById("accountAction")?.addEventListener("click", () => {
    chrome.tabs.create({ url: `${portalBaseUrl}/auth/login` });
  });
}

// ── Module 2: Indeed Copilot ──
async function updateIndeedState() {
  const res = await sendMessage({ type: "CP_GET_BOOTSTRAP" });
  if (!res.ok) return;

  const { state = {}, settings = {}, dailyCap = {}, portalQuota = {} } = res;

  // Live Counts
  const appliedEl = document.getElementById("indeedApplied");
  const skippedEl = document.getElementById("indeedSkipped");
  const failedEl = document.getElementById("indeedFailed");
  if (appliedEl) appliedEl.textContent = state.applied || 0;
  if (skippedEl) skippedEl.textContent = state.skipped || 0;
  if (failedEl) failedEl.textContent = state.failed || 0;

  // Now Running Details
  const nowTitle = document.getElementById("indeedNowTitle");
  const nowDetail = document.getElementById("indeedNowDetail");
  if (nowTitle && nowDetail) {
    if (state.running) {
      nowTitle.textContent = "Indeed Copilot Active";
      nowDetail.textContent = "Scanning Indeed jobs & autofilling applications...";
    } else if (state.paused) {
      nowTitle.textContent = "Indeed Copilot Paused";
      nowDetail.textContent = "Application flow paused. Press Start to resume.";
    } else {
      nowTitle.textContent = "Ready on Indeed";
      nowDetail.textContent = "Open Indeed Jobs to start autonomous job application.";
    }
  }

  // Mode Switch
  const toggle = document.getElementById("indeedLiveModeToggle");
  const modeBadge = document.getElementById("indeedModeBadge");
  if (toggle && modeBadge) {
    const isLive = Boolean(settings.autoSubmit && !settings.dryRun);
    toggle.checked = isLive;
    modeBadge.textContent = isLive ? "Live Submit" : "Dry Run";
    modeBadge.style.background = isLive ? "#d1fae5" : "#fef3c7";
    modeBadge.style.color = isLive ? "#065f46" : "#92400e";
  }

  // Quota
  const spendable = Number(portalQuota?.data?.spendable ?? portalQuota?.data?.hireBalance ?? 0);
  const hiresEl = document.getElementById("indeedPopupHiresCount");
  const quotaDetailEl = document.getElementById("indeedPopupQuotaDetail");
  if (hiresEl) hiresEl.textContent = spendable;
  if (quotaDetailEl) {
    quotaDetailEl.innerHTML = `Daily Free: ${dailyCap.used || 0}/${dailyCap.cap || 3} &bull; Spendable: ${spendable}`;
  }

  // Account Card
  const accountCard = document.getElementById("indeedAccountCard");
  const accountBadge = document.getElementById("indeedAccountBadge");
  const accountText = document.getElementById("indeedAccountText");
  const isConnected = Boolean(settings.contactEmail || settings.fullName);
  if (accountCard && accountBadge && accountText) {
    if (isConnected) {
      accountCard.className = "account-card connected";
      accountBadge.className = "account-badge connected";
      accountBadge.textContent = "Connected";
      accountText.textContent = `Connected as ${settings.fullName || settings.contactEmail}`;
    } else {
      accountCard.className = "account-card disconnected";
      accountBadge.className = "account-badge disconnected";
      accountBadge.textContent = "Disconnected";
      accountText.textContent = "Sign in to connect your profile and sync quota.";
    }
  }
}

function setupIndeedControls() {
  document.getElementById("indeedStart")?.addEventListener("click", async () => {
    await sendMessage({ type: "CP_START" });
    await updateIndeedState();
  });

  document.getElementById("indeedPause")?.addEventListener("click", async () => {
    await sendMessage({ type: "CP_PAUSE" });
    await updateIndeedState();
  });

  document.getElementById("indeedStop")?.addEventListener("click", async () => {
    await sendMessage({ type: "CP_STOP" });
    await updateIndeedState();
  });

  document.getElementById("indeedLiveModeToggle")?.addEventListener("change", async (e) => {
    const isLive = e.target.checked;
    await sendMessage({
      type: "CP_SAVE_SETTINGS",
      settings: { autoSubmit: isLive, dryRun: !isLive }
    });
    await updateIndeedState();
  });

  document.getElementById("indeedClearLogs")?.addEventListener("click", async () => {
    await sendMessage({ type: "CP_CLEAR_LOGS" });
    await updateIndeedState();
  });

  document.getElementById("indeedAccountAction")?.addEventListener("click", () => {
    chrome.tabs.create({ url: `${portalBaseUrl}/auth/login` });
  });
}

// ── Module 3: WhatsApp Outreach ──
async function loadWhatsAppStatus() {
  const res = await sendMessage({ type: "WA_GET_STATUS" });
  if (res) {
    document.getElementById("waTotalLeads").textContent = res.totalLeads || 0;
    document.getElementById("waContactedCount").textContent = res.contactedCount || 0;
    const templateInput = document.getElementById("waTemplateInput");
    if (templateInput && res.settings?.messageTemplate) {
      templateInput.value = res.settings.messageTemplate;
    }
    const autoSendToggle = document.getElementById("waAutoSendToggle");
    if (autoSendToggle && res.settings) {
      autoSendToggle.checked = res.settings.autoSendWhatsApp !== false;
    }
    const autoCloseToggle = document.getElementById("waAutoCloseToggle");
    if (autoCloseToggle && res.settings) {
      autoCloseToggle.checked = res.settings.autoCloseTab !== false;
    }
    const showContactedToggle = document.getElementById("waShowContactedToggle");
    if (showContactedToggle && res.settings) {
      showContactedToggle.checked = Boolean(res.settings.showAlreadyContacted);
    }
  }
}

function setupWhatsAppControls() {
  document.getElementById("waAutoSendAllBtn")?.addEventListener("click", async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    if (currentTab && currentTab.url && currentTab.url.includes("linkedin.com")) {
      chrome.tabs.sendMessage(currentTab.id, { type: "TRIGGER_AUTO_SEND_ALL" }, (res) => {
        if (chrome.runtime.lastError) {
          chrome.tabs.create({ url: "https://www.linkedin.com/feed/#autoapply-module=whatsapp" });
        }
      });
    } else {
      chrome.tabs.create({ url: "https://www.linkedin.com/feed/#autoapply-module=whatsapp" });
    }
  });

  document.getElementById("waSaveBtn")?.addEventListener("click", async () => {
    const template = document.getElementById("waTemplateInput").value;
    const autoSend = document.getElementById("waAutoSendToggle").checked;
    const autoClose = document.getElementById("waAutoCloseToggle")?.checked ?? true;
    const showContacted = document.getElementById("waShowContactedToggle")?.checked || false;
    await sendMessage({
      type: "WA_SAVE_SETTINGS",
      payload: {
        settings: {
          messageTemplate: template,
          autoSendWhatsApp: autoSend,
          autoCloseTab: autoClose,
          showAlreadyContacted: showContacted
        }
      }
    });
    alert("WhatsApp outreach settings saved!");
  });
}

// ── Module 4: Auto Commenter ──
async function loadCommenterStatus() {
  const res = await sendMessage({ type: "AC_GET_STATUS" });
  if (res) {
    document.getElementById("acSessionCount").textContent = res.state?.sessionCount || 0;
    document.getElementById("acTotalCount").textContent = res.totalCount || 0;
    const commentInput = document.getElementById("acCommentInput");
    if (commentInput && res.settings?.commentText) {
      commentInput.value = res.settings.commentText;
    }
  }
}

function setupCommenterControls() {
  document.getElementById("acStartBtn")?.addEventListener("click", async () => {
    const commentText = document.getElementById("acCommentInput").value;
    const skipSeekers = document.getElementById("acSkipSeekersToggle").checked;
    await sendMessage({
      type: "START_COMMENTING",
      payload: {
        settings: {
          commentText,
          skipJobSeekers: skipSeekers
        }
      }
    });
    await loadCommenterStatus();
  });

  document.getElementById("acStopBtn")?.addEventListener("click", async () => {
    await sendMessage({ type: "STOP_COMMENTING" });
    await loadCommenterStatus();
  });
}

// ── Module 5: Email Outreach Pro ──
async function loadEmailOutreachStatus() {
  const res = await sendMessage({ type: "EMAIL_GET_STATUS" });
  if (res) {
    const totalLeadsEl = document.getElementById("emailTotalLeads");
    const contactedCountEl = document.getElementById("emailContactedCount");
    if (totalLeadsEl) totalLeadsEl.textContent = res.totalLeads || 0;
    if (contactedCountEl) contactedCountEl.textContent = res.contactedCount || 0;

    const subjInput = document.getElementById("emailSubjectInput");
    if (subjInput && res.settings?.subjectTemplate) {
      subjInput.value = res.settings.subjectTemplate;
    }

    const templateInput = document.getElementById("emailTemplateInput");
    if (templateInput && res.settings?.messageTemplate) {
      templateInput.value = res.settings.messageTemplate;
    }

    const clientSelect = document.getElementById("emailClientSelect");
    if (clientSelect && res.settings?.emailClient) {
      clientSelect.value = res.settings.emailClient;
    }

    const autoSendToggle = document.getElementById("emailAutoSendToggle");
    if (autoSendToggle && res.settings) {
      autoSendToggle.checked = res.settings.autoSendEmail !== false;
    }

    const autoCloseToggle = document.getElementById("emailAutoCloseToggle");
    if (autoCloseToggle && res.settings) {
      autoCloseToggle.checked = res.settings.autoCloseTab !== false;
    }

    const showContactedToggle = document.getElementById("emailShowContactedToggle");
    if (showContactedToggle && res.settings) {
      showContactedToggle.checked = Boolean(res.settings.showAlreadyContacted);
    }
  }
}

function setupEmailOutreachControls() {
  document.getElementById("emailAutoSendAllBtn")?.addEventListener("click", async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    if (currentTab && currentTab.url && currentTab.url.includes("linkedin.com")) {
      chrome.tabs.sendMessage(currentTab.id, { type: "TRIGGER_EMAIL_AUTO_SEND_ALL" }, (res) => {
        if (chrome.runtime.lastError) {
          chrome.tabs.create({ url: "https://www.linkedin.com/feed/#autoapply-module=email" });
        }
      });
    } else {
      chrome.tabs.create({ url: "https://www.linkedin.com/feed/#autoapply-module=email" });
    }
  });

  document.getElementById("emailSaveBtn")?.addEventListener("click", async () => {
    const subject = document.getElementById("emailSubjectInput")?.value || "";
    const template = document.getElementById("emailTemplateInput")?.value || "";
    const client = document.getElementById("emailClientSelect")?.value || "gmail_web";
    const autoSend = document.getElementById("emailAutoSendToggle")?.checked !== false;
    const autoClose = document.getElementById("emailAutoCloseToggle")?.checked !== false;
    const showContacted = document.getElementById("emailShowContactedToggle")?.checked || false;

    const res = await sendMessage({ type: "EMAIL_GET_STATUS" });
    const currentSettings = res?.settings || {};

    await sendMessage({
      type: "EMAIL_SAVE_SETTINGS",
      payload: {
        settings: {
          ...currentSettings,
          subjectTemplate: subject,
          messageTemplate: template,
          emailClient: client,
          autoSendEmail: autoSend,
          autoCloseTab: autoClose,
          showAlreadyContacted: showContacted
        }
      }
    });
    alert("Email Outreach settings saved!");
  });
}

// ── Module 6: Settings & Options Page Link ──
function setupSettingsControls() {
  document.getElementById("openOptionsPageBtn")?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

// ── Initialize Suite ──
document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupLinkedInControls();
  setupIndeedControls();
  setupWhatsAppControls();
  setupCommenterControls();
  setupEmailOutreachControls();
  setupSettingsControls();

  await Promise.all([updateLinkedInState(), updateIndeedState()]);
  setInterval(() => {
    updateLinkedInState();
    updateIndeedState();
  }, 3000);
});
