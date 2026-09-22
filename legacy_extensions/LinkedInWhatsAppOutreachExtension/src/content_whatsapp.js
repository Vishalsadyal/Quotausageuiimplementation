/**
 * LinkedIn to WhatsApp Job Outreach Pro - WhatsApp Web Content Automation
 * Injected on https://web.whatsapp.com/*
 */

(function () {
  console.log('[WA-Helper] WhatsApp Web automation script loaded.');

  const urlParams = new URLSearchParams(window.location.search);
  const targetPhone = urlParams.get('phone');
  const hasTextParam = urlParams.has('text');

  if (!targetPhone && !hasTextParam) {
    // Normal WhatsApp Web browsing, don't interfere
    return;
  }

  let settings = {
    autoSendWhatsApp: false,
    autoCloseTab: true
  };

  // Fetch settings from storage
  chrome.storage.local.get(['waSettings'], (data) => {
    if (data.waSettings) {
      settings = { ...settings, ...data.waSettings };
    }
    initWhatsAppAutomation();
  });

  function initWhatsAppAutomation() {
    createWhatsAppOverlay();
    waitForChatAndSend();
  }

  function createWhatsAppOverlay() {
    const existing = document.getElementById('li-wa-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'li-wa-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(12px);
      color: #ffffff;
      padding: 16px 20px;
      border-radius: 14px;
      border: 1px solid rgba(37, 211, 102, 0.4);
      box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(37, 211, 102, 0.2);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      min-width: 320px;
      max-width: 400px;
      animation: liWaSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    overlay.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
        <div style="display:flex; align-items:center; gap:8px; font-weight:700; color:#25D366; font-size:15px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2z"/></svg>
          WhatsApp Outreach Pro
        </div>
        <span id="li-wa-status-badge" style="background:#1e293b; color:#94a3b8; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:600;">Connecting...</span>
      </div>
      <div id="li-wa-info-text" style="color:#e2e8f0; font-size:13px; line-height:1.4; margin-bottom:12px;">
        Target: <b style="color:#38bdf8;">+${targetPhone}</b><br>
        Waiting for WhatsApp chat & prefilled message to load...
      </div>
      <div id="li-wa-actions" style="display:flex; gap:8px;">
        <button id="li-wa-manual-send" style="flex:1; background:#25D366; color:#0f172a; border:none; padding:8px 14px; border-radius:8px; font-weight:700; cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center; gap:6px;">
          🚀 Send Message Now
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('li-wa-manual-send')?.addEventListener('click', () => {
      triggerSendMessage(true);
    });
  }

  function updateOverlay(statusText, badgeText, badgeColor = '#25D366') {
    const infoEl = document.getElementById('li-wa-info-text');
    const badgeEl = document.getElementById('li-wa-status-badge');
    if (infoEl && statusText) infoEl.innerHTML = statusText;
    if (badgeEl && badgeText) {
      badgeEl.textContent = badgeText;
      badgeEl.style.color = badgeColor;
    }
  }

  async function waitForChatAndSend() {
    let attempts = 0;
    const maxAttempts = 60; // 30 seconds max

    while (attempts < maxAttempts) {
      attempts++;
      await sleep(500);

      // Check for error dialogs (e.g. "Phone number shared via url is invalid")
      const invalidPopup = document.querySelector('div[data-animate-modal-popup="true"], div[data-testid="popup-contents"]');
      if (invalidPopup && (invalidPopup.innerText.toLowerCase().includes('invalid') || invalidPopup.innerText.toLowerCase().includes('not on whatsapp'))) {
        updateOverlay(`❌ <b>Phone number (+${targetPhone}) is not on WhatsApp or invalid.</b>`, 'Invalid Number', '#ef4444');
        return;
      }

      // Find the message box or active send button
      const sendBtn = findWhatsAppSendButton();
      const messageInput = document.querySelector('footer div[contenteditable="true"], div[role="textbox"][data-tab="10"], div[role="textbox"]');

      if (sendBtn || (messageInput && messageInput.innerText.trim().length > 5)) {
        updateOverlay(`✅ Chat loaded for <b>+${targetPhone}</b> with message prepared.`, 'Ready to Send', '#25D366');

        if (settings.autoSendWhatsApp) {
          updateOverlay(`⚡ Auto-sending message to <b>+${targetPhone}</b> in 1.5s...`, 'Sending...', '#fbbf24');
          await sleep(1500);
          await triggerSendMessage();
        }
        return;
      }
    }

    updateOverlay(`⏳ Chat is taking longer to load. Please make sure you are logged into WhatsApp Web.`, 'Waiting QR / Sync', '#f59e0b');
  }

  function findWhatsAppSendButton() {
    // Standard WhatsApp Web Send Button Selectors (2024-2026)
    const selectors = [
      'button[aria-label="Send"]',
      'span[data-icon="send"]',
      'span[data-testid="send"]',
      'button[data-tab="11"]',
      'footer button:has(span[data-icon="send"])',
      'footer button:has(svg)'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        return el.closest('button') || el;
      }
    }

    // Fallback: search buttons in footer
    const footer = document.querySelector('footer');
    if (footer) {
      const btns = footer.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.querySelector('span[data-icon="send"]') || btn.getAttribute('aria-label') === 'Send') {
          return btn;
        }
      }
    }

    return null;
  }

  async function triggerSendMessage(isManual = false) {
    const sendBtn = findWhatsAppSendButton();
    const messageInput = document.querySelector('footer div[contenteditable="true"], div[role="textbox"][data-tab="10"], div[role="textbox"]');

    if (sendBtn) {
      sendBtn.focus();
      sendBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      sendBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      sendBtn.click();
    } else if (messageInput) {
      messageInput.focus();
      messageInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    }

    await sleep(600);

    // Notify background script that message was dispatched
    chrome.runtime.sendMessage({
      type: 'WHATSAPP_MESSAGE_SENT',
      payload: {
        phone: targetPhone,
        autoClose: settings.autoCloseTab
      }
    }).catch(() => {});

    updateOverlay(`🎉 <b>Message sent successfully to +${targetPhone}!</b><br>${settings.autoCloseTab ? 'Closing tab in 2 seconds...' : 'Outreach completed.'}`, 'Sent ✅', '#25D366');

    const actionsEl = document.getElementById('li-wa-actions');
    if (actionsEl) actionsEl.style.display = 'none';

    if (settings.autoCloseTab) {
      setTimeout(() => {
        window.close();
      }, 2000);
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
