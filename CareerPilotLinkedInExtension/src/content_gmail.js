/**
 * LinkedIn to Email Job Outreach Pro - Gmail Web Automation Content Script
 * Injected on https://mail.google.com/*
 * Automatically detects compose window, triggers Send button, and closes tab to progress batch queue.
 */

(function () {
  'use strict';

  console.log('%c[Email-Helper] Gmail automation content script initialized on ' + window.location.href, 'color: #6366f1; font-weight: bold;');

  const urlParams = new URLSearchParams(window.location.search);
  const targetEmail = (urlParams.get('to') || '').toLowerCase().trim();
  const isComposeView = urlParams.get('view') === 'cm' || urlParams.has('to') || window.location.href.includes('view=cm');

  if (!isComposeView && !targetEmail) {
    // Normal Gmail browsing; don't interfere
    return;
  }

  let settings = {
    autoSendEmail: true,
    autoCloseTab: true,
    delayBetweenEmails: 5
  };

  let countdownTimer = null;
  let autoSendCancelled = false;
  let isSendingInProgress = false;

  // Load extension settings
  chrome.storage.local.get(['emailSettings', 'contactedEmails'], (data) => {
    if (data.emailSettings) {
      settings = { ...settings, ...data.emailSettings };
    }

    initGmailAutomation();
  });

  function initGmailAutomation() {
    createGmailOverlay();
    waitForComposeAndTrigger();
  }

  function createGmailOverlay() {
    const existing = document.getElementById('li-gmail-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'li-gmail-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 99999999;
      background: rgba(15, 23, 42, 0.96);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      color: #ffffff;
      padding: 16px 20px;
      border-radius: 14px;
      border: 1px solid rgba(99, 102, 241, 0.45);
      box-shadow: 0 12px 36px rgba(0,0,0,0.65), 0 0 24px rgba(99, 102, 241, 0.25);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      min-width: 320px;
      max-width: 420px;
      box-sizing: border-box;
      animation: liGmailPopIn 0.3s ease-out;
    `;

    overlay.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
        <div style="display:flex; align-items:center; gap:8px; font-weight:700; color:#818cf8; font-size:14px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Email Outreach Pro
        </div>
        <span id="li-gmail-status-badge" style="background:#1e293b; color:#94a3b8; font-size:11px; padding:3px 10px; border-radius:12px; font-weight:600; border:1px solid rgba(255,255,255,0.08);">Preparing...</span>
      </div>

      <div id="li-gmail-info-text" style="color:#e2e8f0; font-size:12.5px; line-height:1.5; margin-bottom:12px;">
        Recipient: <b style="color:#38bdf8;">${escapeHtml(targetEmail || 'Recruiter')}</b><br>
        <span style="color:#94a3b8; font-size:11.5px;">Loading compose editor & validating draft...</span>
      </div>

      <div id="li-gmail-progress-container" style="display:none; height:4px; width:100%; background:rgba(255,255,255,0.1); border-radius:2px; margin-bottom:12px; overflow:hidden;">
        <div id="li-gmail-progress-bar" style="height:100%; width:100%; background:linear-gradient(90deg, #6366f1, #38bdf8); transition:width 0.1s linear;"></div>
      </div>

      <div id="li-gmail-actions" style="display:flex; gap:8px; flex-wrap:wrap;">
        <button id="li-gmail-manual-send" style="flex:1; background:linear-gradient(135deg, #6366f1, #4f46e5); color:#ffffff; border:none; padding:9px 14px; border-radius:8px; font-weight:700; cursor:pointer; font-size:12.5px; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 2px 10px rgba(99,102,241,0.35);">
          ✉️ Send Email Now
        </button>
        <button id="li-gmail-cancel-send" style="display:none; background:#334155; color:#f8fafc; border:none; padding:9px 12px; border-radius:8px; font-weight:600; cursor:pointer; font-size:12px;">
          Cancel
        </button>
        <button id="li-gmail-close-btn" style="display:none; background:#1e293b; color:#94a3b8; border:1px solid rgba(255,255,255,0.1); padding:9px 14px; border-radius:8px; font-weight:600; cursor:pointer; font-size:12px;">
          Close Tab
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('li-gmail-manual-send')?.addEventListener('click', () => {
      cancelCountdown();
      executeSendEmail();
    });

    document.getElementById('li-gmail-cancel-send')?.addEventListener('click', () => {
      cancelCountdown();
      autoSendCancelled = true;
      updateOverlay(`⏸️ <b>Auto-send cancelled.</b> You can edit your email and click Send when ready.`, 'Paused', '#f59e0b');
      const cancelBtn = document.getElementById('li-gmail-cancel-send');
      if (cancelBtn) cancelBtn.style.display = 'none';
      const sendBtn = document.getElementById('li-gmail-manual-send');
      if (sendBtn) {
        sendBtn.style.display = 'flex';
        sendBtn.textContent = '✉️ Send Email Now';
      }
    });

    document.getElementById('li-gmail-close-btn')?.addEventListener('click', () => {
      window.close();
    });
  }

  function updateOverlay(statusHtml, badgeText, badgeColor = '#6366f1') {
    const infoEl = document.getElementById('li-gmail-info-text');
    const badgeEl = document.getElementById('li-gmail-status-badge');
    if (infoEl && statusHtml) infoEl.innerHTML = statusHtml;
    if (badgeEl && badgeText) {
      badgeEl.textContent = badgeText;
      badgeEl.style.color = badgeColor;
      badgeEl.style.borderColor = badgeColor + '55';
    }
  }

  function cancelCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    const progressContainer = document.getElementById('li-gmail-progress-container');
    if (progressContainer) progressContainer.style.display = 'none';
  }

  // Find Gmail Send button across multiple possible layouts
  function findGmailSendButton() {
    const selectors = [
      'div[role="button"][data-tooltip*="Send"]',
      'div[role="button"][aria-label*="Send"]',
      'div[role="button"][data-tooltip*="Enviar"]',
      'div[role="button"][aria-label*="Enviar"]',
      'div[role="button"][data-tooltip*="Envoyer"]',
      'div[data-tooltip*="Ctrl-Enter"]',
      'div[data-tooltip*="⌘Enter"]',
      '.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3',
      '.aoO',
      '.btC .T-I'
    ];

    for (const sel of selectors) {
      const candidates = document.querySelectorAll(sel);
      for (const btn of candidates) {
        if (btn && btn.offsetParent !== null) { // Check visible
          return btn;
        }
      }
    }
    return null;
  }

  // Find Gmail editable compose body
  function findGmailComposeBody() {
    const selectors = [
      'div[aria-label*="Message Body"]',
      'div[aria-label*="Corps du message"]',
      'div[aria-label*="Cuerpo del mensaje"]',
      'div.Am.Al.editable',
      'div[role="textbox"][contenteditable="true"]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return el;
    }
    return null;
  }

  async function waitForComposeAndTrigger() {
    const startTime = Date.now();
    const maxWaitMs = 15000;

    while (Date.now() - startTime < maxWaitMs) {
      const sendBtn = findGmailSendButton();
      const bodyEl = findGmailComposeBody();

      if (sendBtn) {
        console.log('[Email-Helper] Gmail compose window and Send button detected!');
        onComposeReady(sendBtn, bodyEl);
        return;
      }
      await new Promise(r => setTimeout(r, 400));
    }

    updateOverlay(`⚠️ <b>Compose window loaded.</b> Click "Send Email Now" when ready.`, 'Ready', '#fbbf24');
  }

  function onComposeReady(sendBtn, bodyEl) {
    if (settings.autoSendEmail !== false && !autoSendCancelled) {
      startCountdownAndSend(sendBtn, bodyEl);
    } else {
      updateOverlay(`✅ <b>Draft ready for ${escapeHtml(targetEmail || 'recruiter')}.</b> Review and click Send below.`, 'Ready', '#38bdf8');
    }
  }

  function startCountdownAndSend(sendBtn, bodyEl) {
    let timeLeftMs = 2200;
    const totalTimeMs = timeLeftMs;
    const intervalMs = 100;

    const progressContainer = document.getElementById('li-gmail-progress-container');
    const progressBar = document.getElementById('li-gmail-progress-bar');
    const cancelBtn = document.getElementById('li-gmail-cancel-send');
    if (progressContainer) progressContainer.style.display = 'block';
    if (cancelBtn) cancelBtn.style.display = 'block';

    updateOverlay(`⚡ Auto-sending to <b>${escapeHtml(targetEmail || 'recruiter')}</b> in <span id="gm-countdown-sec">2.2s</span>...`, 'Sending...', '#818cf8');

    countdownTimer = setInterval(() => {
      timeLeftMs -= intervalMs;
      const progressPercent = Math.max(0, (timeLeftMs / totalTimeMs) * 100);
      if (progressBar) progressBar.style.width = `${progressPercent}%`;

      const secEl = document.getElementById('gm-countdown-sec');
      if (secEl) secEl.textContent = `${(timeLeftMs / 1000).toFixed(1)}s`;

      if (timeLeftMs <= 0) {
        cancelCountdown();
        if (!autoSendCancelled) {
          executeSendEmail(sendBtn, bodyEl);
        }
      }
    }, intervalMs);
  }

  async function executeSendEmail(presetSendBtn = null, bodyEl = null) {
    if (isSendingInProgress) return;
    isSendingInProgress = true;

    updateOverlay(`🚀 <b>Submitting email...</b> Dispatching via Gmail.`, 'Submitting', '#6366f1');

    const sendBtn = presetSendBtn || findGmailSendButton();
    const editable = bodyEl || findGmailComposeBody();

    let sendSuccess = false;

    // Strategy 1: Dispatch Click on Gmail Send Button
    if (sendBtn) {
      try {
        sendBtn.focus();
        sendBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        sendBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        sendBtn.click();
        sendSuccess = true;
        console.log('[Email-Helper] Dispatched click on Gmail Send button.');
      } catch (e) {
        console.warn('[Email-Helper] Direct click failed:', e);
      }
    }

    // Strategy 2: Dispatch Ctrl+Enter on editable compose box
    if (!sendSuccess && editable) {
      try {
        editable.focus();
        editable.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          ctrlKey: true,
          bubbles: true
        }));
        sendSuccess = true;
        console.log('[Email-Helper] Dispatched Ctrl+Enter shortcut.');
      } catch (e) {
        console.warn('[Email-Helper] Keyboard shortcut failed:', e);
      }
    }

    // Await confirmation
    await new Promise(r => setTimeout(r, 1200));

    onEmailSentSuccess();
  }

  function onEmailSentSuccess() {
    updateOverlay(`🎉 <b>Email sent successfully!</b> Closing tab and returning to LinkedIn queue...`, 'Sent!', '#22c55e');

    const manualBtn = document.getElementById('li-gmail-manual-send');
    const cancelBtn = document.getElementById('li-gmail-cancel-send');
    const closeBtn = document.getElementById('li-gmail-close-btn');
    if (manualBtn) manualBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'block';

    // Report success to background service worker
    chrome.runtime.sendMessage({
      type: 'EMAIL_MESSAGE_SENT',
      payload: {
        email: targetEmail,
        autoClose: settings.autoCloseTab !== false
      }
    }).catch(() => {});

    // Automatically close tab after 1.4 seconds if enabled
    if (settings.autoCloseTab !== false) {
      setTimeout(() => {
        window.close();
      }, 1400);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
