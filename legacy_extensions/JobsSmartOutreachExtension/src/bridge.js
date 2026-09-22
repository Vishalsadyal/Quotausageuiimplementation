// ─────────────────────────────────────────────────────────────────────────────
// Jobs Smart Outreach — bridge.js
// Injected into the AutoApplyCV dashboard.
// Provides a bidirectional postMessage bridge so the webapp can talk to the
// extension background (same pattern as CareerPilotLinkedInExtension/bridge.js).
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  const BRIDGE_VERSION = '2026.03.19';
  const EXT_ID = chrome.runtime.id;

  function nowIso() {
    return new Date().toISOString();
  }

  function sendDebug(level, event, data = {}) {
    try {
      chrome.runtime.sendMessage({
        type: 'JSO_DEBUG_EVENT',
        source: 'bridge',
        level,
        event,
        data: {
          origin: window.location.origin,
          pageUrl: window.location.href,
          ...data,
        },
      }, () => void 0);
    } catch {
      // ignore
    }
  }

  // ── Webapp → Extension ────────────────────────────────────────────────────────
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg._src !== 'webapp' || !msg.type) return;

    chrome.runtime.sendMessage(msg, (response) => {
      window.postMessage({ _src: 'extension', _id: msg._id, ...response }, '*');
    });
  });

  // ── Extension → Webapp ────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'JSO_WEB_SEARCH_HR') {
      (async () => {
        try {
          const q = String(msg.query || '').trim();
          if (!q) {
            sendDebug('warn', 'web_search_empty_query');
            sendResponse({ attempted: true, contacts: [] });
            return;
          }
          const platform = String(msg.platform || 'linkedin');
          const country = String(msg.country || 'all');
          const endpoint = `${window.location.origin}/api/user/hr-outreach/search`;
          
          sendDebug('info', 'web_search_request', {
            query: q,
            platform,
            country,
            endpoint,
          });
          
          const res = await fetch(endpoint, {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: q, platform, country }),
          });
          
          const body = await res.json().catch(() => ({}));
          
          sendDebug('info', 'api_raw_response', {
            status: res.status,
            bodyKeys: Object.keys(body || {}),
            hasResults: Array.isArray(body?.results),
            hasContacts: Array.isArray(body?.contacts),
            resultsCount: Array.isArray(body?.results) ? body.results.length : 0,
            contactsCount: Array.isArray(body?.contacts) ? body.contacts.length : 0,
            fullBody: JSON.stringify(body).slice(0, 500), // First 500 chars
          });
          
          const parsedContacts = Array.isArray(body?.results)
            ? body.results
            : (Array.isArray(body?.contacts) ? body.contacts : []);
          
          sendDebug(res.ok ? 'info' : 'warn', 'web_search_completed', {
            query: q,
            status: res.status,
            contacts: parsedContacts.length,
            hasResultsField: Array.isArray(body?.results),
          });
          sendResponse({
            attempted: true,
            ok: res.ok,
            status: res.status,
            contacts: parsedContacts,
            ts: nowIso(),
          });
        } catch (error) {
          sendDebug('error', 'web_search_failed', {
            error: String(error?.message || error),
          });
          sendResponse({
            attempted: true,
            ok: false,
            status: 0,
            contacts: [],
            error: String(error?.message || error),
            ts: nowIso(),
          });
        }
      })();
      return true;
    }

    if (msg._src === 'background') {
      window.postMessage({ _src: 'extension', ...msg }, '*');
      sendResponse({ ok: true });
    }
    return true;
  });

  // ── Announce presence ─────────────────────────────────────────────────────────
  window.postMessage({
    _src: 'extension',
    type: 'JSO_BRIDGE_READY',
    version: BRIDGE_VERSION,
    extensionId: EXT_ID,
  }, '*');

  // Let service worker remember this as preferred live dashboard origin.
  try {
    chrome.runtime.sendMessage({
      type: 'JSO_BRIDGE_READY',
      origin: window.location.origin,
      version: BRIDGE_VERSION,
    }, () => void 0);
    sendDebug('info', 'bridge_ready_sent', {
      version: BRIDGE_VERSION,
      extensionId: EXT_ID,
    });
  } catch {
    // ignore
  }

  // ── Expose helper on window so dashboard JS can call directly ─────────────────
  window.__jso = {
    version: BRIDGE_VERSION,
    getContacts: () => new Promise((res) =>
      chrome.runtime.sendMessage({ type: 'JSO_GET_CONTACTS' }, res)
    ),
    startCollecting: (keyword, category) => new Promise((res) =>
      chrome.runtime.sendMessage({ type: 'JSO_START_COLLECTING', keyword, category }, res)
    ),
    stopCollecting: () => new Promise((res) =>
      chrome.runtime.sendMessage({ type: 'JSO_STOP_COLLECTING' }, res)
    ),
    getStatus: () => new Promise((res) =>
      chrome.runtime.sendMessage({ type: 'JSO_GET_STATUS' }, res)
    ),
    syncToDashboard: () => new Promise((res) =>
      chrome.runtime.sendMessage({ type: 'JSO_SYNC_TO_DASHBOARD' }, res)
    ),
  };

  console.log(`[JSO Bridge v${BRIDGE_VERSION}] Ready on ${window.location.origin}`);
})();
