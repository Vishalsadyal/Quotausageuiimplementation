// Background service worker for WhatsApp Campaign extension
// Orchestrates campaign sending: opens tabs, communicates with content scripts,
// tracks progress and stores results.

const STATE_KEY = "wa_campaign_state";
const QUEUE_KEY = "wa_campaign_queue";

let isProcessing = false;

// ─── Storage Helpers ────────────────────────────────────────────

function get(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => resolve(result[key]));
  });
}

function set(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

// ─── Campaign State ─────────────────────────────────────────────

async function getState() {
  return (await get(STATE_KEY)) || { status: "idle", campaignId: null };
}

async function setState(partial) {
  const current = await getState();
  await set(STATE_KEY, { ...current, ...partial });
}

async function getQueue() {
  return (await get(QUEUE_KEY)) || [];
}

async function saveQueue(queue) {
  await set(QUEUE_KEY, queue);
}

// ─── Message Logging ────────────────────────────────────────────

function log(campaignId, contact, type, detail) {
  const entry = {
    timestamp: Date.now(),
    campaignId,
    contact,
    type, // "info" | "success" | "error" | "retry"
    detail,
  };
  // Store last 500 log entries
  get("wa_logs").then((logs = []) => {
    logs = Array.isArray(logs) ? logs : [];
    logs.push(entry);
    if (logs.length > 500) logs = logs.slice(-500);
    set("wa_logs", logs);
  });
}

// ─── Send a Single Contact via WhatsApp Tab ─────────────────────

function sendContact(contactIdx, queueItem) {
  return new Promise((resolve) => {
    const { campaignId, contact, message, campaignName } = queueItem;
    const phone = contact.replace(/\D/g, "").replace(/^0+/, "").replace(/^\+?/, "");

    if (!phone) {
      log(campaignId, contact, "error", "Invalid phone number");
      resolve({ contact, success: false, error: "invalid_phone" });
      return;
    }

    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    chrome.tabs.create({ url: waUrl, active: false }, (tab) => {
      const timeout = setTimeout(() => {
        log(campaignId, contact, "error", "Timeout — page did not load in time");
        chrome.tabs.remove(tab.id);
        resolve({ contact, success: false, error: "timeout" });
      }, 25000);

      // Listen for response from content script
      const listener = (message, sender) => {
        if (sender.tab?.id !== tab.id) return;
        if (message.type === "wa_send_result") {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(updateListener);
          chrome.runtime.onMessage.removeListener(listener);
          if (message.success) {
            log(campaignId, contact, "success", "Message sent");
          } else {
            log(campaignId, contact, "error", message.error || "send_failed");
          }
          // Close tab after a short delay
          setTimeout(() => {
            try { chrome.tabs.remove(tab.id); } catch (_) {}
          }, 2000);
          resolve({ contact, success: message.success, error: message.error });
        }
      };

      const updateListener = (tabId, changeInfo) => {
        if (tabId !== tab.id || changeInfo.status !== "complete") return;
        // Inject content script if needed
        chrome.tabs.sendMessage(tab.id, { type: "wa_send", message }, () => {
          if (chrome.runtime.lastError) {
            // Content script not yet injected — inject it
            chrome.scripting.executeScript(
              { target: { tabId: tab.id }, files: ["content-wa.js"] },
              () => {
                setTimeout(() => {
                  chrome.tabs.sendMessage(tab.id, { type: "wa_send", message });
                }, 500);
              }
            );
          }
        });
      };

      chrome.runtime.onMessage.addListener(listener);
      chrome.tabs.onUpdated.addListener(updateListener);
    });
  });
}

// ─── Process Full Campaign Queue ────────────────────────────────

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    let queue = await getQueue();
    if (queue.length === 0) {
      await setState({ status: "idle", campaignId: null });
      notifyDashboard({ type: "campaign_complete", campaignId: null });
      isProcessing = false;
      return;
    }

    const current = queue[0];
    const { campaignId, contacts, message, campaignName } = current;

    await setState({ status: "sending", campaignId });

    const results = [];

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      await setState({
        status: "sending",
        progress: { current: i + 1, total: contacts.length, contact },
      });

      notifyDashboard({
        type: "campaign_progress",
        campaignId,
        current: i + 1,
        total: contacts.length,
        contact,
      });

      // Send with retry logic (max 2 retries)
      let result = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        result = await sendContact(i, { ...current, contact });
        if (result.success) break;
        if (attempt < 2) {
          log(campaignId, contact, "retry", `Attempt ${attempt + 1} failed, retrying...`);
          await new Promise((r) => setTimeout(r, 3000));
        }
      }

      results.push(result);

      // Rate limiting delay between contacts
      if (i < contacts.length - 1) {
        await new Promise((r) => setTimeout(r, 4000));
      }
    }

    // Mark this queue item as done
    const successCount = results.filter((r) => r?.success).length;
    log(campaignId, "ALL", "info", `Campaign done: ${successCount}/${contacts.length} sent`);

    // Remove from queue
    await saveQueue(queue.slice(1));

    // Store results
    const campaignResult = {
      campaignId,
      campaignName,
      completedAt: Date.now(),
      results,
      successCount,
      failCount: contacts.length - successCount,
      totalContacts: contacts.length,
    };

    const history = (await get("wa_campaign_history")) || [];
    history.push(campaignResult);
    await set("wa_campaign_history", history.slice(-50)); // keep last 50

    notifyDashboard({
      type: "campaign_contact_done",
      campaignId,
      results,
      successCount,
      failCount: contacts.length - successCount,
    });

    // Process next in queue
    await setState({ status: "idle", campaignId: null });
    isProcessing = false;
    processQueue(); // recurse
  } catch (err) {
    console.error("Queue processing error:", err);
    await setState({ status: "error", error: err.message });
    isProcessing = false;
  }
}

// ─── Notify Dashboard Content Script ────────────────────────────

function notifyDashboard(data) {
  chrome.tabs.query({ url: ["http://localhost:3000/*", "https://*.vercel.app/*"] }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { type: "wa_extension_event", ...data }).catch(() => {});
    });
  });
}

// ─── Storage Change Listener ────────────────────────────────────

chrome.storage.onChanged.addListener((changes) => {
  if (changes[QUEUE_KEY]) {
    const newQueue = changes[QUEUE_KEY].newValue || [];
    if (newQueue.length > 0) {
      processQueue();
    }
  }
});

// ─── Extension Installed / Updated ──────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  setState({ status: "idle", campaignId: null });
});

// ─── Messages from Popup ────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "get_status") {
    getState().then((state) => {
      getQueue().then((queue) => {
        sendResponse({ state, queueLength: queue.length });
      });
    });
    return true; // Keep channel open for async response
  }

  if (msg.type === "get_logs") {
    get("wa_logs").then((logs) => sendResponse(logs || []));
    return true;
  }

  if (msg.type === "get_history") {
    get("wa_campaign_history").then((history) => sendResponse(history || []));
    return true;
  }

  if (msg.type === "cancel_campaign") {
    isProcessing = false;
    saveQueue([]);
    setState({ status: "idle", campaignId: null });
    notifyDashboard({ type: "campaign_cancelled" });
    sendResponse({ success: true });
  }
});
