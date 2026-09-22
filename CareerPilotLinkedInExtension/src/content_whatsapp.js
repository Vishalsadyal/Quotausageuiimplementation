/**
 * LinkedIn to WhatsApp Job Outreach Pro - WhatsApp Web Content Automation
 * Injected on https://web.whatsapp.com/*
 * Features: Auto-send with draft elimination, multi-strategy dispatch, pre-send duplicate check & single-tab queue
 */

(function () {
  console.log('[WA-Helper] WhatsApp Web automation script loaded.');

  const urlParams = new URLSearchParams(window.location.search);
  const targetPhone = urlParams.get('phone') || '';
  const hasTextParam = urlParams.has('text');

  if (!targetPhone && !hasTextParam) {
    // Normal WhatsApp Web browsing, don't interfere
    return;
  }

  const cleanPhone = cleanPhoneNumber(targetPhone);

  let settings = {
    autoSendWhatsApp: true,
    autoCloseTab: true
  };

  // Check URL params override
  if (urlParams.has('cp_auto_send')) {
    settings.autoSendWhatsApp = urlParams.get('cp_auto_send') === '1';
  }
  if (urlParams.has('cp_auto_close')) {
    settings.autoCloseTab = urlParams.get('cp_auto_close') === '1';
  }

  let isDuplicate = false;
  let countdownTimer = null;
  let autoSendCancelled = false;
  let contactedPhonesList = [];
  let contactedLogList = [];

  function closeCurrentTab() {
    try {
      chrome.runtime.sendMessage({ type: 'WA_CLOSE_TAB' }).catch(() => {});
    } catch {}
    try {
      window.close();
    } catch {}
  }

  // Fetch settings and contacted history from storage
  chrome.storage.local.get(['waSettings', 'contactedPhones', 'contactedLog'], (data) => {
    if (data.waSettings) {
      settings = { ...settings, ...data.waSettings };
    }
    // Re-apply URL params override if present
    if (urlParams.has('cp_auto_send')) {
      settings.autoSendWhatsApp = urlParams.get('cp_auto_send') === '1';
    }
    if (urlParams.has('cp_auto_close')) {
      settings.autoCloseTab = urlParams.get('cp_auto_close') === '1';
    }

    contactedPhonesList = (data.contactedPhones || []).map(cleanPhoneNumber);
    contactedLogList = data.contactedLog || [];

    // Check if phone exists in storage history
    if (cleanPhone && contactedPhonesList.includes(cleanPhone)) {
      isDuplicate = true;
      console.log(`[WA-Helper] Phone ${cleanPhone} already found in extension contact history.`);
    }

    initWhatsAppAutomation();
  });

  function cleanPhoneNumber(phone) {
    if (!phone) return '';
    return String(phone).replace(/[^\d]/g, '');
  }

  function initWhatsAppAutomation() {
    createWhatsAppOverlay();
    waitForChatAndInspect();
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
      z-index: 9999999;
      background: rgba(15, 23, 42, 0.96);
      backdrop-filter: blur(14px);
      color: #ffffff;
      padding: 16px 20px;
      border-radius: 14px;
      border: 1px solid rgba(37, 211, 102, 0.4);
      box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 24px rgba(37, 211, 102, 0.25);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      min-width: 330px;
      max-width: 420px;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    overlay.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:8px; font-weight:700; color:#25D366; font-size:15px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2z"/></svg>
          WhatsApp Outreach Pro
        </div>
        <span id="li-wa-status-badge" style="background:#1e293b; color:#94a3b8; font-size:11px; padding:3px 10px; border-radius:12px; font-weight:600; border:1px solid rgba(255,255,255,0.08);">Checking...</span>
      </div>

      <div id="li-wa-info-text" style="color:#e2e8f0; font-size:13px; line-height:1.5; margin-bottom:12px;">
        Target: <b style="color:#38bdf8;">+${cleanPhone || targetPhone}</b><br>
        <span style="color:#94a3b8; font-size:12px;">Verifying chat history & activating send...</span>
      </div>

      <div id="li-wa-progress-container" style="display:none; height:4px; width:100%; background:rgba(255,255,255,0.1); border-radius:2px; margin-bottom:12px; overflow:hidden;">
        <div id="li-wa-progress-bar" style="height:100%; width:100%; background:linear-gradient(90deg, #25D366, #38bdf8); transition:width 0.1s linear;"></div>
      </div>

      <div id="li-wa-actions" style="display:flex; gap:8px; flex-wrap:wrap;">
        <button id="li-wa-manual-send" style="flex:1; background:#25D366; color:#0f172a; border:none; padding:9px 14px; border-radius:8px; font-weight:700; cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 2px 8px rgba(37,211,102,0.3);">
          🚀 Send Message Now
        </button>
        <button id="li-wa-cancel-send" style="display:none; background:#334155; color:#f8fafc; border:none; padding:9px 12px; border-radius:8px; font-weight:600; cursor:pointer; font-size:12px;">
          Cancel
        </button>
        <button id="li-wa-close-btn" style="display:none; background:#1e293b; color:#94a3b8; border:1px solid rgba(255,255,255,0.1); padding:9px 14px; border-radius:8px; font-weight:600; cursor:pointer; font-size:12px;">
          Close Tab
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('li-wa-manual-send')?.addEventListener('click', () => {
      cancelCountdown();
      triggerSendMessage(true);
    });

    document.getElementById('li-wa-cancel-send')?.addEventListener('click', () => {
      cancelCountdown();
      autoSendCancelled = true;
      updateOverlay(`⏸️ <b>Auto-send cancelled.</b> You can inspect the chat and click Send when ready.`, 'Paused', '#f59e0b');
      const cancelBtn = document.getElementById('li-wa-cancel-send');
      if (cancelBtn) cancelBtn.style.display = 'none';
      const sendBtn = document.getElementById('li-wa-manual-send');
      if (sendBtn) {
        sendBtn.style.display = 'flex';
        sendBtn.textContent = '🚀 Send Message Now';
        sendBtn.style.background = '#25D366';
      }
    });

    document.getElementById('li-wa-close-btn')?.addEventListener('click', () => {
      closeCurrentTab();
    });
  }

  function updateOverlay(statusHtml, badgeText, badgeColor = '#25D366', borderColor = null) {
    const overlay = document.getElementById('li-wa-overlay');
    const infoEl = document.getElementById('li-wa-info-text');
    const badgeEl = document.getElementById('li-wa-status-badge');
    if (infoEl && statusHtml) infoEl.innerHTML = statusHtml;
    if (badgeEl && badgeText) {
      badgeEl.textContent = badgeText;
      badgeEl.style.color = badgeColor;
      badgeEl.style.borderColor = badgeColor + '55';
    }
    if (overlay && borderColor) {
      overlay.style.borderColor = borderColor;
      overlay.style.boxShadow = `0 10px 30px rgba(0,0,0,0.6), 0 0 20px ${borderColor}44`;
    }
  }

  /**
   * Inspect WhatsApp Web chat history for genuine previous sent messages
   * (Carefully ignores encryption notices, date headers, and system messages)
   */
  function hasExistingSentMessagesInChat() {
    const chatContainer = document.querySelector('div[data-testid="conversation-panel-messages"]') ||
      document.querySelector('#main') ||
      document.querySelector('div[role="region"]') ||
      document.body;

    if (!chatContainer) return false;

    // Search message bubbles inside conversation
    const messageRows = chatContainer.querySelectorAll('div[role="row"], div[data-testid*="conv-msg-"], div[data-testid="msg-container"], div.message-out');

    for (const row of messageRows) {
      // 1. Explicitly ignore system messages, encryption banners, and info popups
      if (
        row.querySelector('[data-testid="system_message"]') ||
        row.querySelector('[data-testid="msg-notification-container"]') ||
        row.getAttribute('data-testid') === 'msg-notification-container' ||
        (row.innerText && row.innerText.toLowerCase().includes('end-to-end encrypted')) ||
        (row.innerText && row.innerText.toLowerCase().includes('messages and calls are'))
      ) {
        continue;
      }

      // 2. Check if this row is an outbound (sent by user) bubble
      const isOutbound =
        row.classList.contains('message-out') ||
        Boolean(row.querySelector('.message-out')) ||
        Boolean(row.querySelector('span[data-icon="msg-dblcheck"]')) ||
        Boolean(row.querySelector('span[data-icon="msg-check"]')) ||
        Boolean(row.querySelector('span[data-testid="msg-dblcheck"]')) ||
        Boolean(row.querySelector('span[data-testid="msg-check"]')) ||
        Boolean(row.querySelector('span[data-icon="msg-time"]'));

      if (isOutbound) {
        const text = (row.innerText || '').trim();
        // Ignore empty containers or system notices
        if (text.length > 0 && !text.toLowerCase().includes('end-to-end encrypted')) {
          console.log('[WA-Helper] Verified existing outbound message in chat:', text.slice(0, 40));
          return true;
        }
      }
    }

    return false;
  }

  function findMessageInputElement() {
    const selectors = [
      'footer div[contenteditable="true"][data-tab="10"]',
      'footer div[contenteditable="true"][data-tab="6"]',
      'footer div[contenteditable="true"][role="textbox"]',
      'footer div[contenteditable="true"][data-lexical-editor="true"]',
      'footer div[contenteditable="true"]',
      '#main footer div[contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
      'div[data-testid="conversation-compose-box-input"]',
      'div[aria-label="Type a message"]',
      'div[title="Type a message"]',
      'div[contenteditable="true"]'
    ];

    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch {}
    }
    return null;
  }

  function isMicrophoneElement(el) {
    if (!el) return false;
    const testStr = (
      (el.getAttribute('aria-label') || '') + ' ' +
      (el.getAttribute('data-icon') || '') + ' ' +
      (el.getAttribute('data-testid') || '') + ' ' +
      (el.innerHTML || '')
    ).toLowerCase();

    return (
      testStr.includes('ptt') ||
      testStr.includes('mic') ||
      testStr.includes('voice') ||
      testStr.includes('audio') ||
      testStr.includes('record')
    );
  }

  function findWhatsAppSendButton() {
    // 1. Direct send button selectors
    const sendSelectors = [
      'button[data-testid="compose-btn-send"]',
      'button[aria-label="Send"]',
      'button[aria-label="send" i]',
      'span[data-icon="send"]',
      'span[data-testid="send"]'
    ];

    for (const sel of sendSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const btn = el.closest('button') || el.closest('div[role="button"]') || el;
          if (btn && !isMicrophoneElement(btn)) {
            return btn;
          }
        }
      } catch {}
    }

    // 2. Scan footer buttons strictly checking for send icon and rejecting microphone
    const footer = document.querySelector('footer') || document.querySelector('#main footer');
    if (footer) {
      const btns = footer.querySelectorAll('button, div[role="button"]');
      for (const btn of btns) {
        if (isMicrophoneElement(btn)) {
          continue; // NEVER return microphone button!
        }
        const hasSendIcon = Boolean(
          btn.querySelector('span[data-icon="send"]') ||
          btn.querySelector('span[data-testid="send"]') ||
          btn.getAttribute('data-testid') === 'compose-btn-send' ||
          (btn.getAttribute('aria-label') && btn.getAttribute('aria-label').toLowerCase().includes('send'))
        );
        if (hasSendIcon) {
          return btn;
        }
      }
    }

    return null;
  }

  /**
   * Activate WhatsApp Web internal editor so it switches from microphone to send button
   */
  function activateWhatsAppInput(inputEl) {
    if (!inputEl) return;
    try {
      inputEl.focus();

      // Put caret at the end of the text
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(inputEl);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);

      // Dispatch standard synthetic input events
      inputEl.dispatchEvent(new Event('focus', { bubbles: true }));
      inputEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: '' }));
    } catch (e) {
      console.warn('[WA-Helper] Error activating input:', e);
    }
  }

  function checkForInvalidNumberPopup() {
    const dialogs = document.querySelectorAll(
      'div[data-animate-modal-popup="true"], ' +
      'div[data-testid="popup-contents"], ' +
      'div[data-testid="confirm-popup"], ' +
      'div[data-testid="modal-container"], ' +
      'div[role="dialog"], ' +
      'div[data-testid="modal-popup"], ' +
      '.landing-wrapper div[role="alert"]'
    );

    for (const d of dialogs) {
      const text = (d.innerText || d.textContent || '').toLowerCase();
      if (
        text.includes("isn't on whatsapp") ||
        text.includes("isn’t on whatsapp") ||
        text.includes("is not on whatsapp") ||
        text.includes("not on whatsapp") ||
        text.includes("url is invalid") ||
        text.includes("invalid") ||
        text.includes("couldn't open this chat") ||
        text.includes("can't find this contact")
      ) {
        return { dialog: d, text: d.innerText };
      }
    }

    // Also check document.body text if modal text is in main page
    const bodyText = (document.body.innerText || '').toLowerCase();
    if (
      bodyText.includes("isn't on whatsapp") ||
      bodyText.includes("isn’t on whatsapp") ||
      bodyText.includes("phone number shared via url is invalid")
    ) {
      const modal = document.querySelector('div[role="dialog"], div[data-animate-modal-popup="true"], div[data-testid="popup-contents"]');
      return { dialog: modal || document.body, text: "Number isn't on WhatsApp" };
    }

    return null;
  }

  async function waitForChatAndInspect() {
    let attempts = 0;
    const maxAttempts = 240; // Up to 120 seconds (2 full minutes for slow network / initial WhatsApp Web sync)

    while (attempts < maxAttempts) {
      attempts++;
      await sleep(400);

      // 1. Check for invalid phone number dialogs (e.g. "The number +... isn't on WhatsApp", "Phone number shared via url is invalid", etc.)
      const invalidInfo = checkForInvalidNumberPopup();
      if (invalidInfo) {
        console.warn(`[WA-Helper] ❌ Invalid phone number detected (+${cleanPhone || targetPhone}):`, invalidInfo.text);
        
        // Click the green OK button if present to dismiss dialog cleanly
        try {
          const okBtn = invalidInfo.dialog?.querySelector('button') || document.querySelector('button[data-testid="popup-controls-ok"], div[role="dialog"] button, div[data-animate-modal-popup="true"] button');
          if (okBtn) okBtn.click();
        } catch (_) {}

        // Notify extension to mark this number invalid in memory/storage
        chrome.runtime.sendMessage({
          type: 'WA_NUMBER_INVALID',
          payload: { phone: cleanPhone || targetPhone }
        }).catch(() => {});

        updateOverlay(
          `❌ <b>The number +${cleanPhone || targetPhone} isn't on WhatsApp.</b><br>
           <span style="color:#f87171; font-size:12px;">Exiting tab immediately & skipping lead...</span>`,
          'Not On WhatsApp',
          '#ef4444',
          'rgba(239, 68, 68, 0.6)'
        );

        const actions = document.getElementById('li-wa-actions');
        if (actions) {
          actions.innerHTML = `
            <button id="li-wa-close-btn" style="flex:1; background:#ef4444; color:#ffffff; border:none; padding:9px 14px; border-radius:8px; font-weight:700; cursor:pointer; font-size:13px;">
              Exiting Tab...
            </button>
          `;
        }

        // Instantly exit tab within 350ms
        setTimeout(() => closeCurrentTab(), 350);
        return;
      }

      // 2. Check for slow network / WhatsApp Web loading screens
      const isSyncingChats = document.querySelector('progress, [data-testid="intro-loading"], [data-testid="loading-screen"], .landing-wrapper') ||
        (document.body.innerText && (
          document.body.innerText.includes('Loading your chats') ||
          document.body.innerText.includes('Connecting to WhatsApp') ||
          document.body.innerText.includes('Starting chat') ||
          document.body.innerText.includes('Downloading messages')
        ));

      if (isSyncingChats && attempts % 4 === 0) {
        updateOverlay(`⏳ <b>WhatsApp Web is loading chats...</b><br><span style="color:#94a3b8; font-size:12px;">Waiting for slow network (${Math.round(attempts * 0.5)}s)...</span>`, 'Syncing Chats...', '#38bdf8');
      }

      const messageInput = findMessageInputElement();
      const sendBtn = findWhatsAppSendButton();

      if (messageInput || sendBtn) {
        // If message input is empty but url had text, inject it
        const currentText = (messageInput ? (messageInput.innerText || messageInput.textContent || '') : '').trim();
        const textParam = urlParams.get('text') || '';
        if (messageInput && currentText.length === 0 && textParam.length > 0) {
          try {
            messageInput.focus();
            document.execCommand('insertText', false, textParam);
          } catch (e) {
            console.warn('[WA-Helper] Failed to insert textParam via execCommand:', e);
          }
        }

        // Activate input to ensure WhatsApp knows text is present
        if (messageInput) activateWhatsAppInput(messageInput);

        await sleep(500); // Allow chat history & send button to settle

        // Check if messages were already sent in this chat
        const domAlreadySent = hasExistingSentMessagesInChat();
        if (domAlreadySent) {
          handleAlreadySentState(true);
          return;
        }

        // Ready for auto-send or manual send
        handleReadyToSendState();
        return;
      }
    }

    updateOverlay(`⏳ Chat is taking longer to load. Please ensure you are logged in to WhatsApp Web.`, 'Slow Network', '#f59e0b');
  }

  /**
   * Clears any leftover draft text from the message box so no draft is left behind
   */
  function clearMessageDraftBox() {
    try {
      const messageInput = findMessageInputElement();
      if (!messageInput) return;

      messageInput.focus();

      // Select all contents and delete via execCommand (updates Lexical / DraftJS state)
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(messageInput);
      sel.removeAllRanges();
      sel.addRange(range);

      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);

      // Force empty contents
      messageInput.innerHTML = '';
      messageInput.textContent = '';

      // Dispatch synthetic input events to clear draft internally
      messageInput.dispatchEvent(new Event('focus', { bubbles: true }));
      messageInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      messageInput.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'deleteContentBackward', data: null }));
      messageInput.dispatchEvent(new Event('change', { bubbles: true }));
      messageInput.dispatchEvent(new Event('blur', { bubbles: true }));

      console.log('[WA-Helper] Leftover draft successfully cleared from input box.');
    } catch (e) {
      console.warn('[WA-Helper] Error clearing draft box:', e);
    }
  }

  function handleAlreadySentState(domDetected) {
    console.log(`[WA-Helper] ⚠️ Message already sent detected for ${cleanPhone || targetPhone} (Storage: ${isDuplicate}, DOM: ${domDetected})`);

    // Cleanly clear/empty the draft textbox so no leftover draft remains in chat
    clearMessageDraftBox();

    chrome.runtime.sendMessage({
      type: 'DUPLICATE_WA_DETECTED',
      payload: { phone: cleanPhone || targetPhone }
    }).catch(() => {});

    updateOverlay(
      `⚠️ <b>Message already sent to this recruiter earlier (+${cleanPhone || targetPhone})!</b><br>
       <span style="color:#fbbf24; font-size:12px;">Draft cleared & auto-send skipped to avoid duplicate.</span>`,
      'Already Sent ⚠️',
      '#f59e0b',
      'rgba(245, 158, 11, 0.6)'
    );

    const progressContainer = document.getElementById('li-wa-progress-container');
    if (progressContainer) progressContainer.style.display = 'none';

    const actionsEl = document.getElementById('li-wa-actions');
    if (actionsEl) {
      actionsEl.innerHTML = `
        <button id="li-wa-resend-btn" style="flex:1; background:#f59e0b; color:#0f172a; border:none; padding:9px 12px; border-radius:8px; font-weight:700; cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center; gap:4px;">
          ⚡ Send Again Anyway
        </button>
        <button id="li-wa-close-btn" style="flex:1; background:#334155; color:#ffffff; border:none; padding:9px 12px; border-radius:8px; font-weight:600; cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center; gap:4px;">
          🚪 Close Tab
        </button>
      `;

      document.getElementById('li-wa-resend-btn')?.addEventListener('click', async () => {
        const textParam = urlParams.get('text') || '';
        if (textParam) {
          const messageInput = findMessageInputElement();
          if (messageInput) {
            messageInput.focus();
            document.execCommand('insertText', false, textParam);
            activateWhatsAppInput(messageInput);
          }
        }
        await sleep(300);
        triggerSendMessage(true);
      });

      document.getElementById('li-wa-close-btn')?.addEventListener('click', () => {
        closeCurrentTab();
      });
    }

    if (settings.autoCloseTab !== false) {
      setTimeout(() => {
        closeCurrentTab();
      }, 1500);
    }
  }

  function handleReadyToSendState() {
    if (settings.autoSendWhatsApp && !autoSendCancelled) {
      startAutoSendCountdown(1800);
    } else {
      updateOverlay(
        `✅ Chat loaded for <b>+${cleanPhone || targetPhone}</b> with message prepared.<br>
         <span style="color:#94a3b8; font-size:12px;">Click below to dispatch message.</span>`,
        'Ready to Send',
        '#25D366'
      );
    }
  }

  function startAutoSendCountdown(durationMs = 1800) {
    const startTime = Date.now();
    const progressContainer = document.getElementById('li-wa-progress-container');
    const progressBar = document.getElementById('li-wa-progress-bar');
    const cancelBtn = document.getElementById('li-wa-cancel-send');
    const manualSendBtn = document.getElementById('li-wa-manual-send');

    if (progressContainer) progressContainer.style.display = 'block';
    if (cancelBtn) cancelBtn.style.display = 'block';
    if (manualSendBtn) manualSendBtn.style.display = 'none';

    updateOverlay(
      `⚡ <b>Auto-sending message in ${(durationMs / 1000).toFixed(1)}s...</b><br>
       Target: <b style="color:#38bdf8;">+${cleanPhone || targetPhone}</b>`,
      'Auto-Sending...',
      '#38bdf8',
      'rgba(56, 189, 248, 0.5)'
    );

    countdownTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, durationMs - elapsed);
      const percent = Math.max(0, (remaining / durationMs) * 100);

      if (progressBar) progressBar.style.width = `${percent}%`;

      const infoEl = document.getElementById('li-wa-info-text');
      if (infoEl) {
        infoEl.innerHTML = `⚡ <b>Auto-sending message in ${(remaining / 1000).toFixed(1)}s...</b><br>Target: <b style="color:#38bdf8;">+${cleanPhone || targetPhone}</b>`;
      }

      if (elapsed >= durationMs) {
        cancelCountdown();
        triggerSendMessage(false);
      }
    }, 50);
  }

  function cancelCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    const progressContainer = document.getElementById('li-wa-progress-container');
    if (progressContainer) progressContainer.style.display = 'none';
  }

  function dispatchClickEvents(element) {
    if (!element) return;
    const target = element.closest('button') || element.closest('div[role="button"]') || element;
    if (isMicrophoneElement(target)) {
      console.warn('[WA-Helper] Prevented click on microphone/voice element');
      return;
    }
    try {
      target.focus();
      const opts = { bubbles: true, cancelable: true, view: window, buttons: 1 };
      target.dispatchEvent(new PointerEvent('pointerdown', opts));
      target.dispatchEvent(new MouseEvent('mousedown', opts));
      target.dispatchEvent(new PointerEvent('pointerup', opts));
      target.dispatchEvent(new MouseEvent('mouseup', opts));
      target.dispatchEvent(new MouseEvent('click', opts));
      if (typeof target.click === 'function') {
        target.click();
      }
    } catch (e) {
      console.warn('[WA-Helper] Click dispatch error:', e);
    }
  }

  function dispatchEnterKey(inputEl) {
    if (!inputEl) return;
    try {
      inputEl.focus();
      const eventInit = {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        charCode: 13,
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window
      };
      inputEl.dispatchEvent(new KeyboardEvent('keydown', eventInit));
      inputEl.dispatchEvent(new KeyboardEvent('keypress', eventInit));
      inputEl.dispatchEvent(new KeyboardEvent('keyup', eventInit));
    } catch (e) {
      console.warn('[WA-Helper] Enter dispatch error:', e);
    }
  }

  async function triggerSendMessage(isManual = false) {
    cancelCountdown();

    updateOverlay(`🚀 <b>Dispatching message to +${cleanPhone || targetPhone}...</b>`, 'Sending...', '#38bdf8');

    let isDispatched = false;
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const messageInput = findMessageInputElement();
      const currentText = (messageInput ? (messageInput.innerText || messageInput.textContent || '') : '').trim();

      // If text has already cleared (e.g. sent by Enter), we are done!
      if (currentText.length === 0) {
        isDispatched = true;
        console.log(`[WA-Helper] Message is cleared / sent!`);
        break;
      }

      // 1. Activate input & try pressing Enter
      if (messageInput) {
        activateWhatsAppInput(messageInput);
        dispatchEnterKey(messageInput);
      }

      await sleep(300);

      // Check if Enter cleared the text
      const textAfterEnter = (messageInput ? (messageInput.innerText || messageInput.textContent || '') : '').trim();
      if (textAfterEnter.length === 0) {
        isDispatched = true;
        console.log(`[WA-Helper] Message sent successfully via Enter key on attempt ${attempt}!`);
        break;
      }

      // 2. Only look for Send button if text is still present in box
      const sendBtn = findWhatsAppSendButton();
      if (sendBtn && !isMicrophoneElement(sendBtn)) {
        dispatchClickEvents(sendBtn);
        await sleep(400);
      }

      // Check again if text is cleared
      const textAfterClick = (messageInput ? (messageInput.innerText || messageInput.textContent || '') : '').trim();
      if (textAfterClick.length === 0) {
        isDispatched = true;
        console.log(`[WA-Helper] Message sent successfully via Send button on attempt ${attempt}!`);
        break;
      }

      console.log(`[WA-Helper] Attempt ${attempt}: Retrying dispatch...`);
      await sleep(350);
    }

    await sleep(200);

    // Notify background script to record in contactedPhones and contactedLog
    chrome.runtime.sendMessage({
      type: 'WHATSAPP_MESSAGE_SENT',
      payload: {
        phone: cleanPhone || targetPhone,
        autoClose: true
      }
    }).catch(() => {});

    updateOverlay(
      `🎉 <b>Message sent successfully to +${cleanPhone || targetPhone}!</b><br>
       <span style="color:#94a3b8; font-size:12px;">Closing tab and returning to LinkedIn feed...</span>`,
      'Sent ✅',
      '#25D366',
      'rgba(37, 211, 102, 0.5)'
    );

    const actionsEl = document.getElementById('li-wa-actions');
    if (actionsEl) {
      actionsEl.innerHTML = `
        <button id="li-wa-close-btn" style="flex:1; background:#1e293b; color:#94a3b8; border:1px solid rgba(255,255,255,0.1); padding:8px 14px; border-radius:8px; font-weight:600; cursor:pointer; font-size:12px;">
          Close Tab
        </button>
      `;
      document.getElementById('li-wa-close-btn')?.addEventListener('click', () => closeCurrentTab());
    }

    // Immediately close tab after 600ms
    setTimeout(() => {
      closeCurrentTab();
    }, 600);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
