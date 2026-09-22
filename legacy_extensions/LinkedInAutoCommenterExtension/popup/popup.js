// ─────────────────────────────────────────────────────────────────────────────
// LinkedIn Fast Auto Commenter — popup.js
// Logic for Extension Toolbar Popup with Debug & Filtering
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // Elements
  const commentInput = document.getElementById('commentInput');
  const delayInput = document.getElementById('delayInput');
  const maxInput = document.getElementById('maxInput');
  const avoidJobSeekersToggle = document.getElementById('avoidJobSeekersToggle');
  const skipLikedToggle = document.getElementById('skipLikedToggle');
  const likeToggle = document.getElementById('likeToggle');
  const scrollToggle = document.getElementById('scrollToggle');
  const debugToggle = document.getElementById('debugToggle');
  const statusBadge = document.getElementById('statusBadge');
  const sessionCount = document.getElementById('sessionCount');
  const totalCount = document.getElementById('totalCount');
  const btnStart = document.getElementById('btnStart');
  const runningGroup = document.getElementById('runningGroup');
  const btnPause = document.getElementById('btnPause');
  const btnStop = document.getElementById('btnStop');
  const btnOpenLinkedIn = document.getElementById('btnOpenLinkedIn');
  const btnResetHistory = document.getElementById('btnResetHistory');
  const chipPortfolio = document.getElementById('chipPortfolio');
  const chipShort = document.getElementById('chipShort');
  const statusMessage = document.getElementById('statusMessage');

  // Tabs
  const tabMain = document.getElementById('tabMain');
  const tabDebug = document.getElementById('tabDebug');
  const paneMain = document.getElementById('paneMain');
  const paneDebug = document.getElementById('paneDebug');
  const btnTestSingle = document.getElementById('btnTestSingle');
  const btnClearDebug = document.getElementById('btnClearDebug');
  const debugTerminal = document.getElementById('debugTerminal');

  let pollInterval = null;

  // Preset templates
  const PORTFOLIO_TEMPLATE = "Hi! I am actively looking for new opportunities. Feel free to check out my portfolio & recent work: https://parveen-portfolio-xi.vercel.app/";
  const SHORT_TEMPLATE = "Great post! I'm currently exploring new opportunities. Check out my work: https://parveen-portfolio-xi.vercel.app/";

  function setStatus(text, color = '#94a3b8') {
    if (statusMessage) {
      statusMessage.textContent = text;
      statusMessage.style.color = color;
    }
  }

  function getSettingsFromUI() {
    return {
      commentText: commentInput.value.trim() || PORTFOLIO_TEMPLATE,
      delaySec: Math.max(1, parseInt(delayInput.value, 10) || 4),
      maxComments: Math.max(1, parseInt(maxInput.value, 10) || 25),
      skipJobSeekers: avoidJobSeekersToggle ? avoidJobSeekersToggle.checked : true,
      skipAlreadyLiked: skipLikedToggle ? skipLikedToggle.checked : true,
      autoLike: likeToggle ? likeToggle.checked : true,
      autoScroll: scrollToggle ? scrollToggle.checked : true,
      debugMode: debugToggle ? debugToggle.checked : true
    };
  }

  function saveSettings() {
    const settings = getSettingsFromUI();
    chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      payload: { settings }
    }).catch(() => {});
  }

  function renderDebugLogs(logs) {
    if (!debugTerminal || !Array.isArray(logs)) return;
    if (logs.length === 0) {
      debugTerminal.innerHTML = '<div class="term-line info">[System] No debug logs recorded yet.</div>';
      return;
    }

    debugTerminal.innerHTML = logs.map(l => {
      const cls = (l.category || 'info').toLowerCase();
      const det = l.details ? ` ${l.details}` : '';
      return `<div class="term-line ${cls}">[${l.timestamp}][${l.category}] ${escapeHtml(l.message)}${escapeHtml(det)}</div>`;
    }).join('');
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function updateUIState(state, settings, totalLifetimeCount, debugLogs) {
    if (settings) {
      if (document.activeElement !== commentInput && !commentInput.value) {
        commentInput.value = settings.commentText || PORTFOLIO_TEMPLATE;
      }
      if (document.activeElement !== delayInput) {
        delayInput.value = settings.delaySec || 4;
      }
      if (document.activeElement !== maxInput) {
        maxInput.value = settings.maxComments || 25;
      }
      if (avoidJobSeekersToggle) avoidJobSeekersToggle.checked = settings.skipJobSeekers !== undefined ? settings.skipJobSeekers : true;
      if (skipLikedToggle) skipLikedToggle.checked = settings.skipAlreadyLiked !== undefined ? settings.skipAlreadyLiked : true;
      if (likeToggle) likeToggle.checked = settings.autoLike !== undefined ? settings.autoLike : true;
      if (scrollToggle) scrollToggle.checked = settings.autoScroll !== undefined ? settings.autoScroll : true;
      if (debugToggle) debugToggle.checked = settings.debugMode !== undefined ? settings.debugMode : true;
    }

    if (sessionCount) sessionCount.textContent = state.sessionCount || 0;
    if (totalCount) totalCount.textContent = totalLifetimeCount || state.totalCount || 0;

    if (state.isRunning) {
      btnStart.style.display = 'none';
      runningGroup.style.display = 'grid';

      if (state.isPaused) {
        statusBadge.textContent = 'Paused';
        statusBadge.className = 'status-badge badge-paused';
        btnPause.innerHTML = '<span>▶️ Resume</span>';
        setStatus('Paused. Click Resume to continue.', '#fbbf24');
      } else {
        statusBadge.textContent = 'Active';
        statusBadge.className = 'status-badge badge-active';
        btnPause.innerHTML = '<span>⏸️ Pause</span>';
        setStatus('Auto-commenting is active...', '#34d399');
      }
    } else {
      btnStart.style.display = 'flex';
      runningGroup.style.display = 'none';
      statusBadge.textContent = 'Idle';
      statusBadge.className = 'status-badge badge-idle';
      setStatus('Ready to start commenting.', '#94a3b8');
    }

    if (debugLogs) {
      renderDebugLogs(debugLogs);
    }
  }

  async function fetchStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      if (response && response.state) {
        updateUIState(response.state, response.settings, response.totalCount, response.debugLogs);
      }
    } catch (e) {}
  }

  // Event Listeners
  function initEvents() {
    tabMain?.addEventListener('click', () => {
      tabMain.classList.add('active');
      tabDebug.classList.remove('active');
      paneMain.style.display = 'flex';
      paneDebug.style.display = 'none';
    });

    tabDebug?.addEventListener('click', () => {
      tabDebug.classList.add('active');
      tabMain.classList.remove('active');
      paneMain.style.display = 'none';
      paneDebug.style.display = 'flex';
      fetchStatus();
    });

    btnTestSingle?.addEventListener('click', async () => {
      saveSettings();
      const settings = getSettingsFromUI();
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.includes('linkedin.com')) {
        alert('Please open a LinkedIn page first to test commenting on a post!');
        return;
      }
      chrome.runtime.sendMessage({
        type: 'TEST_SINGLE_POST',
        payload: { settings }
      }, () => {
        setStatus('Testing comment on 1 post...', '#60a5fa');
        setTimeout(fetchStatus, 1500);
      });
    });

    btnClearDebug?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'CLEAR_DEBUG_LOGS' }, () => {
        if (debugTerminal) debugTerminal.innerHTML = '<div class="term-line info">[System] Debug logs cleared.</div>';
      });
    });

    chipPortfolio.addEventListener('click', () => {
      commentInput.value = PORTFOLIO_TEMPLATE;
      saveSettings();
    });

    chipShort.addEventListener('click', () => {
      commentInput.value = SHORT_TEMPLATE;
      saveSettings();
    });

    [commentInput, delayInput, maxInput, avoidJobSeekersToggle, skipLikedToggle, likeToggle, scrollToggle, debugToggle].forEach((el) => {
      el?.addEventListener('input', saveSettings);
      el?.addEventListener('change', saveSettings);
    });

    btnStart.addEventListener('click', async () => {
      saveSettings();
      const settings = getSettingsFromUI();

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.includes('linkedin.com')) {
        chrome.tabs.create({ url: 'https://www.linkedin.com/feed/' });
        setStatus('Opening LinkedIn feed... Run from there!', '#60a5fa');
        return;
      }

      chrome.runtime.sendMessage({
        type: 'START_COMMENTING',
        payload: { settings }
      }, () => {
        fetchStatus();
      });
    });

    btnPause.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
        if (res && res.state && res.state.isPaused) {
          chrome.runtime.sendMessage({ type: 'RESUME_COMMENTING' }, () => fetchStatus());
        } else {
          chrome.runtime.sendMessage({ type: 'PAUSE_COMMENTING' }, () => fetchStatus());
        }
      });
    });

    btnStop.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'STOP_COMMENTING' }, () => fetchStatus());
    });

    btnOpenLinkedIn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://www.linkedin.com/feed/' });
    });

    btnResetHistory.addEventListener('click', () => {
      if (confirm('Reset all processed posts history, counters, and logs?')) {
        chrome.runtime.sendMessage({ type: 'RESET_HISTORY' }, () => fetchStatus());
      }
    });
  }

  async function init() {
    initEvents();
    await fetchStatus();
    pollInterval = setInterval(fetchStatus, 1500);
  }

  window.addEventListener('unload', () => {
    if (pollInterval) clearInterval(pollInterval);
  });

  document.addEventListener('DOMContentLoaded', init);
})();
