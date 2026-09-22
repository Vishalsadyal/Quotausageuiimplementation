// ─────────────────────────────────────────────────────────────────────────────
// HR Direct Outreach — popup.js
// Popup UI logic for the extension popup.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  const POPUP_START_TS = Date.now();
  let POLL_COUNT = 0;

  function pLog(label, detail) {
    const elapsed = ((Date.now() - POPUP_START_TS) / 1000).toFixed(1);
    console.log(`[HRO Popup] ${elapsed}s | ${label}`, detail || '');
  }

  pLog('POPUP_INIT', 'Popup opened');

  const ringFill = document.getElementById('ringFill');
  const ringCount = document.getElementById('ringCount');
  const ringMax = document.getElementById('ringMax');
  const statusEl = document.getElementById('status');
  const keywordInput = document.getElementById('keyword');
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const btnClear = document.getElementById('btnClear');
  const btnExport = document.getElementById('btnExport');
  const btnDashboard = document.getElementById('btnDashboard');
  const nowTitle = document.getElementById('nowTitle');
  const nowDetail = document.getElementById('nowDetail');
  const statusBadge = document.getElementById('statusBadge');

  function updateRing(count) {
    ringCount.textContent = count;
    ringMax.textContent = count;
    ringFill.style.stroke = '#6366f1';
  }

  function setStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.dataset.kind = kind || '';
  }

  function updateNowCard(count, isCollecting) {
    if (isCollecting) {
      nowTitle.textContent = 'Collecting contacts...';
      nowDetail.textContent = `${count} contacts found. Open LinkedIn to watch progress.`;
    } else if (count > 0) {
      nowTitle.textContent = 'Ready to collect';
      nowDetail.textContent = `${count} contacts collected. Start again to find more.`;
    } else {
      nowTitle.textContent = 'Ready to start';
      nowDetail.textContent = 'Enter a keyword and click Start Collecting.';
    }
  }

  function updateStatusBadge(isCollecting) {
    if (isCollecting) {
      statusBadge.textContent = 'Running';
      statusBadge.className = 'status-badge running';
    } else {
      statusBadge.textContent = 'Idle';
      statusBadge.className = 'status-badge idle';
    }
  }

  function setButtons(state) {
    switch (state) {
      case 'idle':
        btnStart.disabled = false;
        btnStop.disabled = true;
        break;
      case 'collecting':
        btnStart.disabled = true;
        btnStop.disabled = false;
        break;
    }
  }

  // ── Init ──

  async function init() {
    try {
      const t0 = Date.now();
      pLog('INIT', 'sending HRO_GET_STATUS');
      const status = await chrome.runtime.sendMessage({ type: 'HRO_GET_STATUS' });
      pLog('INIT', `HRO_GET_STATUS done in ${Date.now() - t0}ms count=${status.count} collecting=${status.isCollecting}`);
      updateRing(status.count);
      updateNowCard(status.count, status.isCollecting);
      updateStatusBadge(status.isCollecting);

      if (status.isCollecting) {
        setButtons('collecting');
        setStatus('Collecting...', 'info');
      } else {
        setButtons('idle');
        if (status.count > 0) {
          setStatus(`${status.count} contacts collected.`, '');
        } else {
          setStatus('', '');
        }
      }

      if (status.keyword) keywordInput.value = status.keyword;
    } catch (e) {
      pLog('INIT_ERROR', e.message);
      setStatus('Extension not ready. Refresh the page.', 'error');
      nowTitle.textContent = 'Extension unavailable';
      nowDetail.textContent = 'Refresh the page or reinstall the extension.';
    }
  }

  init();

  // ── Polling ──

  pLog('POLLING', 'Starting 2s interval');
  setInterval(async () => {
    POLL_COUNT++;
    try {
      const t0 = Date.now();
      const status = await chrome.runtime.sendMessage({ type: 'HRO_GET_STATUS' });
      const elapsed = Date.now() - t0;
      if (POLL_COUNT <= 5 || POLL_COUNT % 10 === 0) {
        pLog(`POLL#${POLL_COUNT}`, `done in ${elapsed}ms count=${status.count} collecting=${status.isCollecting}`);
      }
      updateRing(status.count);
      updateNowCard(status.count, status.isCollecting);
      updateStatusBadge(status.isCollecting);

      if (status.isCollecting) {
        setButtons('collecting');
      } else {
        setButtons('idle');
      }
    } catch (e) {
      if (POLL_COUNT <= 5 || POLL_COUNT % 10 === 0) {
        pLog(`POLL#${POLL_COUNT}`, `ERROR: ${e.message}`);
      }
    }
  }, 2000);

  // ── Message listener ──

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'HRO_COLLECTING_STATUS') {
      pLog('PUSH', `COLLECTING_STATUS count=${msg.count}`);
      updateRing(msg.count);
      updateNowCard(msg.count, true);
      updateStatusBadge(true);
      setButtons('collecting');
    }
    if (msg.type === 'HRO_COLLECTING_DONE') {
      pLog('PUSH', `COLLECTING_DONE count=${msg.count}`);
      updateRing(msg.count);
      updateNowCard(msg.count, false);
      updateStatusBadge(false);
      setButtons('idle');
      setStatus(`Done! ${msg.count} contacts collected.`, '');
    }
  });

  // ── Button handlers ──

  btnStart.addEventListener('click', async () => {
    const keyword = keywordInput.value.trim();
    if (!keyword) {
      setStatus('Please enter a keyword.', 'warn');
      return;
    }
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'HRO_START_COLLECTING',
        keyword,
      });
      if (res?.ok) {
        setButtons('collecting');
        updateStatusBadge(true);
        setStatus('Starting collection...', 'info');
        nowTitle.textContent = 'Starting collection...';
        nowDetail.textContent = 'Opening LinkedIn search page.';
      } else {
        setStatus('Failed to start. Try again.', 'error');
      }
    } catch {
      setStatus('Error starting collection.', 'error');
    }
  });

  btnStop.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'HRO_STOP_COLLECTING' });
    setButtons('idle');
    updateStatusBadge(false);
    setStatus('Stopped.', 'warn');
    nowTitle.textContent = 'Stopped';
    nowDetail.textContent = 'Collection paused. Click Start to resume.';
  });

  btnClear.addEventListener('click', async () => {
    if (!confirm('Clear all collected contacts?')) return;
    await chrome.runtime.sendMessage({ type: 'HRO_CLEAR_CONTACTS' });
    updateRing(0);
    setButtons('idle');
    updateStatusBadge(false);
    updateNowCard(0, false);
    setStatus('All contacts cleared.', '');
  });

  btnExport.addEventListener('click', async () => {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'HRO_EXPORT_CSV' });
      if (res?.csv) {
        const blob = new Blob([res.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hr_contacts_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setStatus('CSV exported!', '');
      }
    } catch {
      setStatus('Export failed.', 'error');
    }
  });

  btnDashboard.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000/dashboard/hr-outreach' });
    window.close();
  });

  // ── Panel toggle ──

  const panelToggle = document.getElementById('panelToggle');

  async function loadPanelToggle() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'HRO_GET_PANEL_ENABLED' });
      if (panelToggle) panelToggle.checked = !!res?.enabled;
    } catch {}
  }

  panelToggle?.addEventListener('change', async () => {
    const enabled = !!panelToggle.checked;
    try {
      await chrome.runtime.sendMessage({ type: 'HRO_TOGGLE_PANEL', enabled });
    } catch {}
  });

  loadPanelToggle();
})();
