// Content script injected into the dashboard (localhost:3000 or *.vercel.app)
// Bridges campaign sending from the dashboard UI to the extension background worker.

(function () {
  // ─── Helpers ──────────────────────────────────────────────────

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

  // Generate a unique campaign ID
  function genId() {
    return "wa_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  }

  // ─── Listen for Extension Events (from background.js) ─────────

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;

    if (msg.type === "send_wa_campaign") {
      handleSendCampaign(msg.campaign);
    }

    if (msg.type === "get_wa_extension_status") {
      chrome.runtime.sendMessage({ type: "get_status" }, (response) => {
        window.postMessage(
          { type: "wa_extension_status_result", data: response },
          "*"
        );
      });
    }
  });

  // Also listen for direct messages from background (long-lived connection)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "wa_extension_event") {
      // Forward to the page
      window.postMessage({ type: "wa_extension_event", ...msg }, "*");
    }
  });

  // ─── Send Campaign to Extension ───────────────────────────────

  async function handleSendCampaign(campaign) {
    if (!campaign || !campaign.contacts || campaign.contacts.length === 0) {
      window.postMessage(
        {
          type: "wa_send_response",
          success: false,
          error: "No contacts provided",
        },
        "*"
      );
      return;
    }

    if (!campaign.message) {
      window.postMessage(
        {
          type: "wa_send_response",
          success: false,
          error: "No message provided",
        },
        "*"
      );
      return;
    }

    // Add to extension queue
    const queueKey = "wa_campaign_queue";
    const queue = (await get(queueKey)) || [];

    const queueItem = {
      campaignId: campaign.id || genId(),
      campaignName: campaign.name || "Untitled Campaign",
      contacts: campaign.contacts,
      message: campaign.message,
      createdAt: Date.now(),
    };

    queue.push(queueItem);
    await set(queueKey, queue);

    // Set initial state
    await set("wa_campaign_state", {
      status: "queued",
      campaignId: queueItem.campaignId,
      progress: { current: 0, total: campaign.contacts.length, contact: "" },
    });

    window.postMessage(
      {
        type: "wa_send_response",
        success: true,
        campaignId: queueItem.campaignId,
      },
      "*"
    );
  }

  // ─── Inject a button into the dashboard UI ────────────────────
  // This creates a hidden bridge that the Marketing page can use
  // to check if the extension is installed.

  const bridge = document.createElement("div");
  bridge.id = "wa-extension-bridge";
  bridge.style.display = "none";
  bridge.dataset.installed = "true";
  document.body.appendChild(bridge);

  // Notify the page that extension is ready
  window.postMessage({ type: "wa_extension_ready", installed: true }, "*");
})();
