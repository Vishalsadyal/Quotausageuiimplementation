// Content script injected into web.whatsapp.com
// Waits for the wa.me page to load, clicks the send button,
// and reports back the result.

(function () {
  // ─── Configuration ────────────────────────────────────────────

  const MAX_WAIT_MS = 20000;     // Max time to wait for send button
  const RETRY_INTERVAL = 500;     // How often to check for button
  const POST_SEND_WAIT = 3000;    // Wait after clicking send

  // ─── Listen for Send Commands ─────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "wa_send") {
      executeSend(msg.message, sendResponse);
      return true; // Keep channel open
    }
  });

  // Also check if we're on a wa.me page and auto-start
  if (window.location.hostname === "wa.me") {
    const urlParams = new URLSearchParams(window.location.search);
    const text = urlParams.get("text");
    if (text) {
      // Wait for page to fully render then send
      waitForSendButton(text);
    }
  }

  // ─── Execute Send (triggered by background message) ───────────

  async function executeSend(message, sendResponse) {
    try {
      const result = await doSend(message);
      sendResponse({ type: "wa_send_result", ...result });
    } catch (err) {
      sendResponse({
        type: "wa_send_result",
        success: false,
        error: err.message || "unknown_error",
      });
    }
  }

  // ─── Core Send Logic ──────────────────────────────────────────

  async function doSend(message) {
    // Try method 1: wa.me page with pre-filled message
    const sendBtn = await waitForElement(
      [
        'button[data-testid="send-button"]',
        'div[role="button"][aria-label*="Send"]',
        'button[aria-label*="Send"]',
        'div[data-testid="conversation-compose-box-input"]',
      ],
      MAX_WAIT_MS
    );

    if (sendBtn) {
      // Click the send button
      sendBtn.click();
      await sleep(POST_SEND_WAIT);

      // Verify it was sent
      const sent = checkSent();
      return {
        success: true,
        method: "wa.me",
        sent,
      };
    }

    // Try method 2: Full WhatsApp Web interface
    const chatInput = await waitForElement(
      [
        'div[contenteditable="true"][data-tab="10"]',
        'div[contenteditable="true"][spellcheck="true"]',
        '.copyable-text.selectable-text',
      ],
      15000
    );

    if (chatInput) {
      // Type the message
      chatInput.focus();
      document.execCommand("insertText", false, message);

      // Wait a moment then click send
      await sleep(1000);

      const sendBtn2 = document.querySelector(
        'button[data-testid="compose-btn-send"], button[aria-label="Send"], span[data-testid="send"]'
      );
      if (sendBtn2) {
        sendBtn2.click();
        await sleep(POST_SEND_WAIT);
        return { success: true, method: "web_full", sent: true };
      }

      // Try pressing Enter
      const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
      });
      chatInput.dispatchEvent(enterEvent);
      await sleep(POST_SEND_WAIT);
      return { success: true, method: "web_enter", sent: true };
    }

    return { success: false, error: "no_send_button_found" };
  }

  // ─── Auto-start for wa.me pages ───────────────────────────────

  async function waitForSendButton(text) {
    const result = await doSend(text || "");
    chrome.runtime.sendMessage({
      type: "wa_send_result",
      ...result,
    });
  }

  // ─── Helper: Wait for DOM element ─────────────────────────────

  function waitForElement(selectors, timeoutMs) {
    return new Promise((resolve) => {
      const start = Date.now();

      function check() {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) return resolve(el);
        }
        if (Date.now() - start > timeoutMs) {
          return resolve(null);
        }
        setTimeout(check, RETRY_INTERVAL);
      }

      check();
    });
  }

  // ─── Helper: Check if message was sent ────────────────────────

  function checkSent() {
    // Look for message status indicators
    const statusIcons = document.querySelectorAll(
      '[data-testid="msg-dblcheck"], [data-testid="msg-check"], [data-testid="msg-time"]'
    );
    return statusIcons.length > 0;
  }

  // ─── Helper: Sleep ────────────────────────────────────────────

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
