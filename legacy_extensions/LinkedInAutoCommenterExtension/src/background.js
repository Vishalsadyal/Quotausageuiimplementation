// ─────────────────────────────────────────────────────────────────────────────
// LinkedIn Fast Auto Commenter — background.js
// Manages state, storage, job-seeker filters, skip-already-liked & debug.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  commentText: "Hi! I am actively looking for new opportunities. Feel free to check out my portfolio & recent work: https://parveen-portfolio-xi.vercel.app/",
  delaySec: 4,
  maxComments: 25,
  autoLike: true,
  autoScroll: true,
  skipJobSeekers: true,    // Skip #OpenToWork and job seeker posts
  skipAlreadyLiked: true,  // Skip posts already liked (prevents double commenting)
  debugMode: true,
  filterKeywords: ""
};

let appState = {
  isRunning: false,
  isPaused: false,
  sessionCount: 0,
  totalCount: 0,
  activeTabId: null,
  recentLogs: [],
  debugLogs: []
};

// Initialize settings on installation
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(['autoCommentSettings', 'totalCommentedCount', 'commentedUrns']);
  if (!existing.autoCommentSettings) {
    await chrome.storage.local.set({ autoCommentSettings: DEFAULT_SETTINGS });
  } else {
    const merged = { ...DEFAULT_SETTINGS, ...existing.autoCommentSettings };
    await chrome.storage.local.set({ autoCommentSettings: merged });
  }
  if (existing.totalCommentedCount === undefined) {
    await chrome.storage.local.set({ totalCommentedCount: 0 });
  }
  if (!existing.commentedUrns) {
    await chrome.storage.local.set({ commentedUrns: [] });
  }
  console.log('[AutoCommenter BG] Initialized successfully with job-seeker filtering and skip-already-liked');
});

// Update extension toolbar badge
function updateBadge(count, running) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: running ? '#10b981' : '#6366f1' });
  } else if (running) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Add user-facing log entry
function addLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = { timestamp, message, type, id: Date.now() + Math.random() };
  appState.recentLogs.unshift(entry);
  if (appState.recentLogs.length > 50) appState.recentLogs.pop();
  return entry;
}

// Add detailed technical debug log
function addDebugLog(category, message, details = null) {
  const now = new Date();
  const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  const entry = {
    timestamp,
    category,
    message,
    details: details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null,
    id: Date.now() + Math.random()
  };
  appState.debugLogs.unshift(entry);
  if (appState.debugLogs.length > 150) appState.debugLogs.pop();
  console.log(`[AutoCommenter DEBUG][${category}] ${message}`, details || '');
  return entry;
}

// Listen to messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, payload } = request;

  switch (type) {
    case 'GET_STATUS': {
      chrome.storage.local.get(['autoCommentSettings', 'totalCommentedCount', 'commentedUrns']).then(data => {
        sendResponse({
          state: appState,
          settings: data.autoCommentSettings || DEFAULT_SETTINGS,
          totalCount: data.totalCommentedCount || 0,
          savedUrnsCount: (data.commentedUrns || []).length,
          debugLogs: appState.debugLogs
        });
      });
      return true;
    }

    case 'SAVE_SETTINGS': {
      chrome.storage.local.set({ autoCommentSettings: payload.settings }).then(() => {
        addDebugLog('SETTINGS', 'Settings updated by user', payload.settings);
        if (appState.activeTabId) {
          chrome.tabs.sendMessage(appState.activeTabId, {
            type: 'SETTINGS_UPDATED',
            payload: { settings: payload.settings }
          }).catch(() => {});
        }
        sendResponse({ success: true });
      });
      return true;
    }

    case 'START_COMMENTING': {
      appState.isRunning = true;
      appState.isPaused = false;
      appState.sessionCount = 0;
      addLog('🚀 Auto commenting started', 'success');
      addDebugLog('ACTION', 'Start command issued', { tabId: sender.tab?.id });

      const tabId = sender.tab ? sender.tab.id : null;
      if (tabId) {
        appState.activeTabId = tabId;
        chrome.tabs.sendMessage(tabId, {
          type: 'CMD_START',
          payload: { settings: payload.settings }
        }).catch(() => {});
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0] && tabs[0].id) {
            appState.activeTabId = tabs[0].id;
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'CMD_START',
              payload: { settings: payload.settings }
            }).catch(() => {});
          }
        });
      }
      updateBadge(appState.sessionCount, true);
      sendResponse({ success: true, state: appState });
      return true;
    }

    case 'TEST_SINGLE_POST': {
      addDebugLog('TEST', 'Test single post command received');
      const tabId = sender.tab ? sender.tab.id : appState.activeTabId;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: 'CMD_TEST_SINGLE',
          payload: { settings: payload?.settings }
        }).catch(() => {});
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'CMD_TEST_SINGLE',
              payload: { settings: payload?.settings }
            }).catch(() => {});
          }
        });
      }
      sendResponse({ success: true });
      return true;
    }

    case 'PAUSE_COMMENTING': {
      appState.isPaused = true;
      addLog('⏸️ Auto commenting paused', 'warning');
      addDebugLog('ACTION', 'Paused');
      if (appState.activeTabId) {
        chrome.tabs.sendMessage(appState.activeTabId, { type: 'CMD_PAUSE' }).catch(() => {});
      }
      sendResponse({ success: true, state: appState });
      return true;
    }

    case 'RESUME_COMMENTING': {
      appState.isPaused = false;
      addLog('▶️ Auto commenting resumed', 'info');
      addDebugLog('ACTION', 'Resumed');
      if (appState.activeTabId) {
        chrome.tabs.sendMessage(appState.activeTabId, { type: 'CMD_RESUME' }).catch(() => {});
      }
      sendResponse({ success: true, state: appState });
      return true;
    }

    case 'STOP_COMMENTING': {
      appState.isRunning = false;
      appState.isPaused = false;
      addLog(`⏹️ Stopped. Completed ${appState.sessionCount} comments.`, 'info');
      addDebugLog('ACTION', 'Stopped commenting session', { count: appState.sessionCount });
      if (appState.activeTabId) {
        chrome.tabs.sendMessage(appState.activeTabId, { type: 'CMD_STOP' }).catch(() => {});
      }
      updateBadge(appState.sessionCount, false);
      sendResponse({ success: true, state: appState });
      return true;
    }

    case 'EVENT_COMMENTED': {
      appState.sessionCount += 1;
      const urn = payload.urn;
      const author = payload.author || 'Author';

      addLog(`💬 Commented on post by ${author}`, 'success');
      addDebugLog('SUCCESS', `Successfully posted comment on post: ${urn}`, { author, urn, message: payload.message });

      chrome.storage.local.get(['totalCommentedCount', 'commentedUrns']).then(data => {
        const total = (data.totalCommentedCount || 0) + 1;
        const urns = data.commentedUrns || [];
        if (urn && !urns.includes(urn)) {
          urns.push(urn);
        }
        chrome.storage.local.set({
          totalCommentedCount: total,
          commentedUrns: urns
        });
        appState.totalCount = total;
        updateBadge(appState.sessionCount, appState.isRunning);
      });

      sendResponse({ success: true, sessionCount: appState.sessionCount });
      return true;
    }

    case 'EVENT_LOG': {
      addLog(payload.message, payload.logType || 'info');
      sendResponse({ success: true });
      return true;
    }

    case 'DEBUG_LOG': {
      addDebugLog(payload.category || 'DOM', payload.message, payload.details);
      sendResponse({ success: true });
      return true;
    }

    case 'CLEAR_DEBUG_LOGS': {
      appState.debugLogs = [];
      sendResponse({ success: true });
      return true;
    }

    case 'RESET_HISTORY': {
      chrome.storage.local.set({ totalCommentedCount: 0, commentedUrns: [] }).then(() => {
        appState.sessionCount = 0;
        appState.totalCount = 0;
        appState.recentLogs = [];
        appState.debugLogs = [];
        updateBadge(0, appState.isRunning);
        addDebugLog('SYSTEM', 'History and cache reset');
        sendResponse({ success: true });
      });
      return true;
    }

    default:
      break;
  }
});
