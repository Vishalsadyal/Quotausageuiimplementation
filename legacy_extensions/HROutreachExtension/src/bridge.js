// ─────────────────────────────────────────────────────────────────────────────
// HR Direct Outreach — bridge.js
// Content script injected into the AutoApplyCV dashboard.
// Communication is entirely via postMessage (content scripts run in an
// isolated world in MV3, so window.__xxx is invisible to the page).
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  if (window.__hroBridgeInjected) return;
  window.__hroBridgeInjected = true;

  const BRIDGE_START_TS = Date.now();
  let HEARTBEAT_COUNT = 0;

  function bLog(label, detail) {
    const elapsed = ((Date.now() - BRIDGE_START_TS) / 1000).toFixed(1);
    console.log(`[HRO Bridge] ${elapsed}s | ${label}`, detail || '');
  }

  console.log('[HRO Bridge] bridge.js executing on', window.location.href);
  bLog('BRIDGE_INIT', `origin=${window.location.origin}`);

  // ── Unique ID generator for request/response matching ────────────────────────

  let _rid = 0;
  function nextId() {
    return `hro_${Date.now()}_${++_rid}`;
  }

  // ── RPC: webapp sends a typed request → bridge forwards to background → posts response ──

  window.addEventListener('message', async (event) => {
    const msg = event.data;
    if (!msg || msg._src !== 'webapp' || !msg.type?.startsWith('HRO_')) return;
    if (msg.type === 'HRO_WEB_PING') {
      window.postMessage({ _src: 'hro_bridge', type: 'HRO_WEB_PONG', _id: msg._id }, '*');
      return;
    }

    const requestId = msg._id || nextId();
    const t0 = Date.now();
    bLog('RPC_REQUEST', `${msg.type} id=${requestId} keyword="${msg.keyword}"`);
    console.log('[HRO Bridge] RPC request:', msg.type, requestId);

    try {
      const response = await chrome.runtime.sendMessage({
        type: msg.type,
        keyword: msg.keyword,
        enabled: msg.enabled,
        timeRange: msg.timeRange,
        _id: requestId,
      });
      bLog('RPC_RESPONSE', `${msg.type} id=${requestId} took ${Date.now() - t0}ms ok=${response?.ok}`);
      console.log('[HRO Bridge] RPC response:', msg.type, requestId, response);
      window.postMessage({
        _src: 'hro_bridge',
        type: 'HRO_RES',
        _id: requestId,
        action: msg.type,
        data: response,
      }, '*');
    } catch (err) {
      bLog('RPC_ERROR', `${msg.type} id=${requestId} error="${err.message}" took ${Date.now() - t0}ms`);
      console.error('[HRO Bridge] RPC error:', msg.type, requestId, err.message);
      if (err.message?.includes('Extension context invalidated')) {
        bLog('CTX_INVALIDATED', 'Resetting guard for re-injection');
        console.warn('[HRO Bridge] Context invalidated — resetting for re-injection');
        window.__hroBridgeInjected = false;
        window.postMessage({ _src: 'hro_bridge', type: 'HRO_BRIDGE_DISCONNECTED' }, '*');
      }
      window.postMessage({
        _src: 'hro_bridge',
        type: 'HRO_RES',
        _id: requestId,
        action: msg.type,
        error: err.message,
      }, '*');
    }
  });

  // ── Background → webapp (push notifications) ────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'HRO_COLLECTING_STATUS' || msg.type === 'HRO_COLLECTING_DONE') {
      bLog('BG_PUSH', `${msg.type} count=${msg.count}`);
      window.postMessage({
        _src: 'hro_bridge',
        type: msg.type,
        count: msg.count,
        max: msg.max,
        stopped: msg.stopped || false,
        ts: Date.now(),
      }, '*');
    }
    if (msg._src === 'background') {
      bLog('BG_PUSH', `${msg.type} → webapp`);
      window.postMessage(msg, '*');
    }
    sendResponse({ ok: true });
  });

  // ── Announce bridge ready ────────────────────────────────────────────────────

  window.postMessage({ _src: 'hro_bridge', type: 'HRO_BRIDGE_READY' }, '*');
  console.log('[HRO Bridge] Posted HRO_BRIDGE_READY');

  try {
    chrome.runtime.sendMessage({
      type: 'HRO_BRIDGE_READY',
      origin: window.location.origin,
    }, () => {
      void chrome.runtime.lastError;
    });
  } catch {
    // ignore
  }

  // ── Keep service worker alive with periodic heartbeat ─────────────────────────
  // MV3 service workers terminate after ~30s idle. Ping every 25s.

  bLog('HEARTBEAT', 'starting interval (25s)');
  setInterval(() => {
    HEARTBEAT_COUNT++;
    const t0 = Date.now();
    try {
      chrome.runtime.sendMessage({ type: 'HRO_HEARTBEAT' }, (resp) => {
        void chrome.runtime.lastError;
        if (chrome.runtime.lastError) {
          bLog(`HEARTBEAT#${HEARTBEAT_COUNT}`, `ERROR: ${chrome.runtime.lastError.message} | took ${Date.now() - t0}ms`);
        } else {
          bLog(`HEARTBEAT#${HEARTBEAT_COUNT}`, `OK ts=${resp?.ts} took ${Date.now() - t0}ms`);
        }
      });
    } catch (e) {
      bLog(`HEARTBEAT#${HEARTBEAT_COUNT}`, `EXCEPTION: ${e.message} — stopping heartbeat`);
      // context invalidated — extension was reloaded, stop heartbeat
    }
  }, 25000);
})();
