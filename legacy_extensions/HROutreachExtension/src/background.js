// ─────────────────────────────────────────────────────────────────────────────
// HR Direct Outreach — background.js
// Service worker: manages collection state, storage, badge, communication.
// ─────────────────────────────────────────────────────────────────────────────

const SW_START_TS = Date.now();
let MSG_COUNTER = 0;
let LAST_MSG_TS = Date.now();
let LAST_MSG_TYPE = '';

function dbgLog(label, detail) {
  const elapsed = ((Date.now() - SW_START_TS) / 1000).toFixed(1);
  console.log(`[HRO BG] ${elapsed}s | ${label}`, detail || '');
}

console.log('[HRO Background] Service worker loaded at', new Date().toISOString());
dbgLog('SW_INIT', 'Service worker started, SW_START_TS=' + SW_START_TS);

const MAX_CONTACTS = 100000;
const STORAGE_KEY = 'hro_collected_contacts';
const SAVED_COUNT_KEY = 'hro_saved_collected_count';
const PENDING_SYNC_KEY = 'hro_pending_sync';
const SYNC_URL = 'http://localhost:3000/api/user/hr-outreach/contacts';

dbgLog('CONSTS', `MAX_CONTACTS=${MAX_CONTACTS}, STORAGE_KEY=${STORAGE_KEY}`);

function buildSearchUrl(keyword, timeRange) {
  const base = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(keyword)}&origin=FACETED_SEARCH&sortBy=%5B%22date_posted%22%5D`;
  if (timeRange && timeRange !== 'any') return `${base}&datesPosted=${timeRange}`;
  return base;
}

// ── Contact deduplication and storage ──────────────────────────────────────────

function makeKey(c) {
  return (c.email || `${c.name}||${c.company}`).toLowerCase().trim();
}

async function addContact(contact) {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const contacts = data[STORAGE_KEY] || [];

  const key = makeKey(contact);
  const existing = new Set(contacts.map(makeKey));

  if (existing.has(key)) {
    return { duplicate: true, count: contacts.length };
  }

  if (contacts.length >= MAX_CONTACTS) {
    return { capped: true, count: contacts.length };
  }

  const newContact = {
    ...contact,
    id: `hro_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    collectedAt: new Date().toISOString(),
  };

  contacts.push(newContact);
  await chrome.storage.local.set({ [STORAGE_KEY]: contacts });

  updateBadge(contacts.length);

  // Milestone logs
  if (contacts.length % 10 === 0 || contacts.length <= 3 || contacts.length === MAX_CONTACTS) {
    console.log(`[HRO] Milestone: ${contacts.length} contacts collected`);
  }

  return { added: true, count: contacts.length };
}

function updateBadge(count) {
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: count >= 50 ? '#10b981' : '#6366f1' });
}

// ── Sync contacts to dashboard API ─────────────────────────────────────────────

async function syncToDashboard() {
  try {
    const data = await chrome.storage.local.get([STORAGE_KEY, PENDING_SYNC_KEY]);
    const contacts = data[STORAGE_KEY] || [];
    const pending = data[PENDING_SYNC_KEY] || [];
    const allToSync = [...pending, ...contacts].filter(c => !c._synced);

    if (allToSync.length === 0) return { synced: 0 };

    dbgLog('SYNC', `attempting to sync ${allToSync.length} contacts`);
    const resp = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts: allToSync }),
    });

    if (resp.ok) {
      // Mark all as synced
      const synced = contacts.map(c => ({ ...c, _synced: true }));
      await chrome.storage.local.set({ [STORAGE_KEY]: synced, [PENDING_SYNC_KEY]: [] });
      dbgLog('SYNC', `successfully synced ${allToSync.length} contacts`);
      return { synced: allToSync.length };
    } else {
      // Store pending for retry
      await chrome.storage.local.set({ [PENDING_SYNC_KEY]: allToSync });
      dbgLog('SYNC', `sync failed (${resp.status}), queued for retry`);
      return { synced: 0, error: `HTTP ${resp.status}` };
    }
  } catch (e) {
    // Network error — store for retry
    const data = await chrome.storage.local.get([STORAGE_KEY]);
    const contacts = data[STORAGE_KEY] || [];
    const unsynced = contacts.filter(c => !c._synced);
    if (unsynced.length > 0) {
      await chrome.storage.local.set({ [PENDING_SYNC_KEY]: unsynced });
    }
    dbgLog('SYNC', `sync error: ${e.message} — queued for retry`);
    return { synced: 0, error: e.message };
  }
}

// Auto-retry sync every 60s if there are pending items
setInterval(async () => {
  const data = await chrome.storage.local.get(PENDING_SYNC_KEY);
  if (data[PENDING_SYNC_KEY]?.length > 0) {
    dbgLog('SYNC_AUTO_RETRY', `${data[PENDING_SYNC_KEY].length} contacts pending`);
    await syncToDashboard();
  }
}, 60000);

// ── Collection orchestration ───────────────────────────────────────────────────

async function runCollection(keyword, timeRange, isResume = false) {
  dbgLog('runCollection', `keyword="${keyword}" timeRange="${timeRange}" isResume=${isResume}`);
  console.log('[HRO Background] runCollection called with keyword:', keyword, 'timeRange:', timeRange, 'isResume:', isResume);
  const searchUrl = buildSearchUrl(keyword, timeRange);
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    dbgLog('runCollection', `activeTab url="${activeTab?.url}" id=${activeTab?.id}`);
    console.log('[HRO Background] Active tab:', activeTab?.url);

    let linkedinTab = null;

    // Always prefer an existing LinkedIn tab over the active tab
    if (activeTab?.url?.includes('linkedin.com')) {
      linkedinTab = activeTab;
      dbgLog('runCollection', `using active tab as LinkedIn tab id=${linkedinTab.id}`);
    } else {
      const liTabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
      dbgLog('runCollection', `found ${liTabs.length} LinkedIn tabs`);
      if (liTabs.length > 0) {
        linkedinTab = liTabs[0];
        dbgLog('runCollection', `switching to existing LinkedIn tab id=${linkedinTab.id} url="${linkedinTab.url}"`);
        await chrome.tabs.update(linkedinTab.id, { active: true });
      } else {
        dbgLog('runCollection', `creating new LinkedIn tab: ${searchUrl}`);
        linkedinTab = await chrome.tabs.create({ url: searchUrl, active: true });
        dbgLog('runCollection', `created tab id=${linkedinTab.id}`);
        await chrome.tabs.update(linkedinTab.id, { active: true });
        await new Promise((resolve) => {
          const listener = (tabId, changeInfo) => {
            if (tabId === linkedinTab.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
          setTimeout(resolve, 10000);
        });
      }
    }

    if (!linkedinTab) {
      dbgLog('runCollection', 'ERROR: no LinkedIn tab found or created');
      return { ok: false, reason: 'no_linkedin_tab' };
    }

    const alreadyOnSearch = linkedinTab?.url?.includes('/search/results/content') ||
      linkedinTab?.url?.includes('/feed');

    dbgLog('runCollection', `tab id=${linkedinTab.id} alreadyOnSearch=${alreadyOnSearch} url="${linkedinTab?.url}"`);

    if (!alreadyOnSearch) {
      await chrome.tabs.update(linkedinTab.id, { url: searchUrl });
      await new Promise((resolve) => {
        const listener = (tabId, changeInfo) => {
          if (tabId === linkedinTab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(resolve, 10000);
      });
    } else if (linkedinTab?.status !== 'complete') {
      await new Promise((resolve) => {
        const listener = (tabId, changeInfo) => {
          if (tabId === linkedinTab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(resolve, 7000);
      });
    }

    const msgType = isResume ? 'HRO_RESUME_SCRAPE' : 'HRO_START_SCRAPE';
    const msgPayload = isResume
      ? { type: msgType, keyword, searchDate: new Date().toISOString() }
      : { type: msgType, keyword, timeRange, searchDate: new Date().toISOString() };

    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        dbgLog('runCollection', `send ${msgType} to tab ${linkedinTab.id} attempt ${attempt}`);
        console.log('[HRO Background] Sending', msgType, 'to tab', linkedinTab.id, 'attempt:', attempt);
        const response = await chrome.tabs.sendMessage(linkedinTab.id, msgPayload);
        console.log('[HRO Background]', msgType, 'response:', JSON.stringify(response));
        dbgLog('runCollection', `${msgType} response: ${JSON.stringify(response)}`);
        if (response?.ok) return { ok: true };
        if (response?.reason === 'already_running') {
          dbgLog('runCollection', 'content script already running — treating as success');
          return { ok: true, alreadyRunning: true };
        }
      } catch (err) {
        dbgLog('runCollection', `${msgType} attempt ${attempt} error: ${err.message}`);
        console.log('[HRO Background]', msgType, 'attempt', attempt, 'failed:', err.message);

        // If content script not injected, inject it now
        if (attempt === 0 && err.message?.includes('Receiving end does not exist') && linkedinTab?.url?.includes('linkedin.com')) {
          try {
            dbgLog('runCollection', `injecting content script into tab ${linkedinTab.id}`);
            await chrome.scripting.executeScript({
              target: { tabId: linkedinTab.id },
              files: ['src/content.js'],
            });
            await chrome.scripting.insertCSS({
              target: { tabId: linkedinTab.id },
              files: ['src/panel.css'],
            });
            dbgLog('runCollection', `content script injected, waiting for initialization`);
            await new Promise((r) => setTimeout(r, 1500));
          } catch (injErr) {
            dbgLog('runCollection', `injection failed: ${injErr.message}`);
            // If already injected, scripting.executeScript may fail — that's ok
          }
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    dbgLog('runCollection', `all 6 attempts failed, falling back`);
    if (linkedinTab.url?.includes('linkedin.com') && !alreadyOnSearch) {
      await chrome.tabs.update(linkedinTab.id, { url: searchUrl });
      return { ok: true, navigated: true };
    }

    return { ok: false, reason: 'could_not_start' };
  } catch (err) {
    dbgLog('runCollection', `ERROR: ${err.message}`);
    console.error('[HRO] Collection error:', err);
    return { ok: false, reason: err.message };
  }
}

// ── Message handler ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  MSG_COUNTER++;
  const msgTs = Date.now();
  const gapMs = msgTs - LAST_MSG_TS;
  LAST_MSG_TS = msgTs;
  LAST_MSG_TYPE = msg.type;
  dbgLog(`MSG#${MSG_COUNTER} RECV`, `${msg.type} | gap=${gapMs}ms | sender=${sender?.origin || sender?.id || 'unknown'}`);
  console.log('[HRO Background] Received message:', msg.type, msg);
  switch (msg.type) {
    case 'HRO_GET_CONTACTS': {
      const t0 = Date.now();
      dbgLog('HRO_GET_CONTACTS', 'start');
      chrome.storage.local.get(STORAGE_KEY, (data) => {
        if (!data) { sendResponse({ contacts: [], count: 0, max: MAX_CONTACTS }); return; }
        dbgLog('HRO_GET_CONTACTS', `done in ${Date.now() - t0}ms`);
        sendResponse({
          contacts: data[STORAGE_KEY] || [],
          count: (data[STORAGE_KEY] || []).length,
          max: MAX_CONTACTS,
        });
      });
      return true;
    }

    case 'HRO_ADD_CONTACT': {
      const t0 = Date.now();
      dbgLog('HRO_ADD_CONTACT', `start contact=${JSON.stringify(msg.contact?.name || msg.contact?.email || '?')}`);
      console.log('[HRO Background] HRO_ADD_CONTACT:', JSON.stringify(msg.contact));
      addContact(msg.contact).then((result) => {
        dbgLog('HRO_ADD_CONTACT', `done in ${Date.now() - t0}ms result=${JSON.stringify(result)}`);
        console.log('[HRO Background] HRO_ADD_CONTACT result:', JSON.stringify(result));
        sendResponse(result);
        // Notify popup of progress
        chrome.runtime.sendMessage({
          type: 'HRO_COLLECTING_STATUS',
          count: result.count,
          max: MAX_CONTACTS,
        }).catch(() => {});
      });
      return true;
    }

    case 'HRO_CLEAR_CONTACTS': {
      const t0 = Date.now();
      dbgLog('HRO_CLEAR_CONTACTS', 'start');
      chrome.storage.local.remove([STORAGE_KEY, SAVED_COUNT_KEY, 'hro_saved_seen_keys', 'hro_saved_scroll_y'], () => {
        dbgLog('HRO_CLEAR_CONTACTS', `done in ${Date.now() - t0}ms`);
        updateBadge(0);
        sendResponse({ ok: true });
      });
      return true;
    }

    case 'HRO_START_COLLECTING': {
      const t0 = Date.now();
      dbgLog('HRO_START_COLLECTING', `start keyword="${msg.keyword}" timeRange="${msg.timeRange}"`);

      // Set session flag + clear saved state
      chrome.storage.local.remove([SAVED_COUNT_KEY, 'hro_saved_seen_keys', 'hro_saved_scroll_y'], () => {
        dbgLog('HRO_START_COLLECTING', 'cleared saved scrape state');
        chrome.storage.local.set({
          hro_is_collecting: true,
          hro_collection_active: true,
          hro_collection_started_at: Date.now(),
          hro_keyword: msg.keyword,
          hro_time_range: msg.timeRange || 'any',
        }, () => {
          dbgLog('HRO_START_COLLECTING', `storage set done in ${Date.now() - t0}ms, calling runCollection`);
          updateBadge(0);
          runCollection(msg.keyword || 'we are hiring', msg.timeRange || 'any', false)
            .then((rc) => dbgLog('HRO_START_COLLECTING', `runCollection completed: ${JSON.stringify(rc)}`))
            .catch((e) => dbgLog('HRO_START_COLLECTING', `runCollection ERROR: ${e.message}`));
          sendResponse({ ok: true });
        });
      });
      return true;
    }

    case 'HRO_STOP_COLLECTING': {
      const t0 = Date.now();
      dbgLog('HRO_STOP_COLLECTING', 'start');
      chrome.storage.local.set({
        hro_is_collecting: false,
        hro_collection_active: false,
      }, () => {
        dbgLog('HRO_STOP_COLLECTING', 'storage set done');
        chrome.tabs.query({ url: 'https://www.linkedin.com/*' }, (tabs) => {
          dbgLog('HRO_STOP_COLLECTING', `notifying ${tabs.length} LinkedIn tabs`);
          for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, { type: 'HRO_STOP_SCRAPE' }).catch(() => {});
          }
        });
        chrome.runtime.sendMessage({
          type: 'HRO_COLLECTING_DONE',
          count: 0,
          stopped: true,
        }).catch(() => {});
        sendResponse({ ok: true });
      });
      return true;
    }

    case 'HRO_GET_STATUS': {
      const t0 = Date.now();
      dbgLog('HRO_GET_STATUS', 'start');
      chrome.storage.local.get([STORAGE_KEY, 'hro_is_collecting', 'hro_collection_active', 'hro_collection_started_at', 'hro_keyword', 'hro_time_range'], (data) => {
        if (!data) { sendResponse({ count: 0, max: MAX_CONTACTS, isCollecting: false, collectionActive: false, keyword: '', timeRange: 'any' }); return; }
        dbgLog('HRO_GET_STATUS', `done in ${Date.now() - t0}ms count=${(data[STORAGE_KEY] || []).length} collecting=${data.hro_is_collecting}`);
        sendResponse({
          count: (data[STORAGE_KEY] || []).length,
          max: MAX_CONTACTS,
          isCollecting: data.hro_is_collecting || false,
          collectionActive: data.hro_collection_active || false,
          collectionStartedAt: data.hro_collection_started_at || null,
          keyword: data.hro_keyword || '',
          timeRange: data.hro_time_range || 'any',
        });
      });
      return true;
    }

    case 'HRO_SCRAPE_DONE': {
      const t0 = Date.now();
      dbgLog('HRO_SCRAPE_DONE', `start count=${msg.count}`);
      console.log('[HRO Background] HRO_SCRAPE_DONE, count:', msg.count);
      chrome.storage.local.set({
        hro_is_collecting: false,
        hro_collection_active: false,
      }, () => {
        chrome.storage.local.remove(['hro_saved_seen_keys', 'hro_saved_scroll_y', SAVED_COUNT_KEY, 'hro_collection_started_at']);
        dbgLog('HRO_SCRAPE_DONE', `storage done in ${Date.now() - t0}ms`);
        // Try to sync to dashboard API
        syncToDashboard().then(r => dbgLog('HRO_SCRAPE_DONE', `sync: ${JSON.stringify(r)}`)).catch(() => {});
        // Broadcast done
        chrome.runtime.sendMessage({
          type: 'HRO_COLLECTING_DONE',
          count: msg.count || 0,
          stopped: false,
        }).catch(() => {});
      });
      sendResponse({ ok: true });
      return true;
    }

    case 'HRO_TOGGLE_PANEL': {
      const t0 = Date.now();
      dbgLog('HRO_TOGGLE_PANEL', `start enabled=${msg.enabled}`);
      chrome.storage.local.set({ hro_panel_enabled: !!msg.enabled }, () => {
        chrome.tabs.query({ url: 'https://www.linkedin.com/*' }, (tabs) => {
          dbgLog('HRO_TOGGLE_PANEL', `notifying ${tabs.length} LinkedIn tabs`);
          for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'HRO_PANEL_VISIBILITY',
              enabled: !!msg.enabled,
            }).catch(() => {});
          }
        });
        sendResponse({ ok: true, enabled: !!msg.enabled });
      });
      return true;
    }

    case 'HRO_GET_PANEL_ENABLED': {
      const t0 = Date.now();
      dbgLog('HRO_GET_PANEL_ENABLED', 'start');
      chrome.storage.local.get('hro_panel_enabled', (data) => {
        if (!data) { sendResponse({ ok: true, enabled: true }); return; }
        dbgLog('HRO_GET_PANEL_ENABLED', `done in ${Date.now() - t0}ms enabled=${data.hro_panel_enabled}`);
        sendResponse({ ok: true, enabled: !!data.hro_panel_enabled });
      });
      return true;
    }

    case 'HRO_EXPORT_CSV': {
      const t0 = Date.now();
      dbgLog('HRO_EXPORT_CSV', 'start');
      chrome.storage.local.get(STORAGE_KEY, (data) => {
        if (!data) { sendResponse({ csv: '' }); return; }
        const contacts = data[STORAGE_KEY] || [];
        const headers = ['Name', 'Title', 'Company', 'Email', 'Phone', 'Category', 'LinkedIn URL', 'Collected At'];
        const rows = contacts.map((c) => [
          c.name, c.title, c.company, c.email, c.phone || '', c.category, c.linkedinUrl, c.collectedAt,
        ]);
        const csv = [headers, ...rows].map((r) => r.map((v) => `"${(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        dbgLog('HRO_EXPORT_CSV', `done in ${Date.now() - t0}ms rows=${rows.length}`);
        sendResponse({ csv });
      });
      return true;
    }

    case 'HRO_HEARTBEAT': {
      dbgLog(`HRO_HEARTBEAT`, `gap=${gapMs}ms total=${MSG_COUNTER}`);
      sendResponse({ ok: true, ts: Date.now() });
      // Check pending syncs on heartbeat
      chrome.storage.local.get(PENDING_SYNC_KEY, (d) => {
        if (d[PENDING_SYNC_KEY]?.length > 0) {
          syncToDashboard().then(r => dbgLog('SYNC_HEARTBEAT', JSON.stringify(r))).catch(() => {});
        }
      });
      return true;
    }

    case 'HRO_SYNC_CONTACTS': {
      dbgLog('HRO_SYNC_CONTACTS', 'manual sync triggered');
      syncToDashboard().then(r => sendResponse(r)).catch(e => sendResponse({ error: e.message }));
      return true;
    }

    default:
      dbgLog('UNKNOWN_MSG', `type=${msg.type}`);
      console.log('[HRO Background] Unknown message type:', msg.type);
      return false;
  }
});

// ── Restore badge and check persisted state on service worker restart ──────

chrome.storage.local.get([STORAGE_KEY, 'hro_is_collecting', 'hro_collection_active', 'hro_collection_started_at', 'hro_keyword', 'hro_time_range', SAVED_COUNT_KEY, 'hro_panel_enabled'], (data) => {
  if (!data) { dbgLog('SW_RESTORE', 'ERROR: data is undefined, SW may be shutting down'); return; }
  const contacts = data[STORAGE_KEY] || [];
  updateBadge(contacts.length);

  // Clean up stale collection state (>10min old with no activity)
  const startedAt = data.hro_collection_started_at;
  if (data.hro_is_collecting && startedAt && (Date.now() - startedAt > 600000)) {
    dbgLog('SW_RESTORE', `stale collection detected (${Math.round((Date.now() - startedAt) / 1000)}s old) — clearing`);
    chrome.storage.local.set({
      hro_is_collecting: false,
      hro_collection_active: false,
    });
    chrome.storage.local.remove(['hro_collection_started_at', SAVED_COUNT_KEY, 'hro_saved_seen_keys', 'hro_saved_scroll_y']);
  }

  dbgLog('SW_RESTORE', `contacts=${contacts.length} isCollecting=${data.hro_is_collecting} active=${data.hro_collection_active} keyword="${data.hro_keyword}" savedCount=${data[SAVED_COUNT_KEY] || 0} panelEnabled=${data.hro_panel_enabled}`);
  if (data.hro_is_collecting) {
    dbgLog('SW_RESTORE', 'WARNING: was_collecting=true — content script should auto-resume on LinkedIn pages');
  }
  // Enable panel by default if not explicitly set
  if (data.hro_panel_enabled === undefined) {
    dbgLog('SW_RESTORE', 'panel_enabled not set — defaulting to true');
    chrome.storage.local.set({ hro_panel_enabled: true });
  }
});

// ── SW lifecycle listeners ────────────────────────────────────────────────────

try {
  self.addEventListener('install', () => {
    dbgLog('SW_LIFECYCLE', 'INSTALL event');
  });
  self.addEventListener('activate', () => {
    dbgLog('SW_LIFECYCLE', 'ACTIVATE event');
  });
} catch (e) {
  // ServiceWorkerGlobalScope events not available in all contexts
  dbgLog('SW_LIFECYCLE', `listener registration failed: ${e.message}`);
}
