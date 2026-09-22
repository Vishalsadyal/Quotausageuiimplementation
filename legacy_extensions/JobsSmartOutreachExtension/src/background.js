// ─────────────────────────────────────────────────────────────────────────────
// Jobs Smart Outreach — background.js (Service Worker)
// PRIMARY strategy: drive collection via the webapp's /api/user/hr-outreach/search
// (reliable, email-verified results). Content.js is a secondary scraper only.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_CONTACTS = 100;
const STORAGE_KEY   = 'jso_collected_hrs';
const LOG_KEY       = 'jso_debug_logs';
const MAX_LOGS      = 600;

// NOTE: Service workers can be killed at any time — NEVER rely on in-memory
// variables for persistent state. Always read from chrome.storage.local.

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function nowIso() {
  return new Date().toISOString();
}

function safeClone(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

async function appendLog(level, event, data = {}) {
  try {
    const payload = {
      ts: nowIso(),
      level: String(level || 'info'),
      event: String(event || 'unknown'),
      data: safeClone(data) || {},
    };
    const r = await chrome.storage.local.get(LOG_KEY);
    const prev = Array.isArray(r[LOG_KEY]) ? r[LOG_KEY] : [];
    const next = [...prev, payload].slice(-MAX_LOGS);
    await chrome.storage.local.set({ [LOG_KEY]: next });
    const fn = payload.level === 'error' ? console.error : payload.level === 'warn' ? console.warn : console.log;
    fn('[JSO]', payload.event, payload.data);
  } catch {
    // ignore logging failure
  }
}

async function getLogs() {
  const r = await chrome.storage.local.get(LOG_KEY);
  return Array.isArray(r[LOG_KEY]) ? r[LOG_KEY] : [];
}

async function clearLogs() {
  await chrome.storage.local.set({ [LOG_KEY]: [] });
}

async function getContacts() {
  const r = await chrome.storage.local.get(STORAGE_KEY);
  return r[STORAGE_KEY] ?? [];
}

function updateBadge(count) {
  chrome.action.setBadgeText({ text: count >= MAX_CONTACTS ? '✓' : (count > 0 ? String(count) : '') });
  chrome.action.setBadgeBackgroundColor({ color: count >= MAX_CONTACTS ? '#10b981' : '#6366f1' });
}

async function addContact(contact) {
  const contacts = await getContacts();
  if (contacts.length >= MAX_CONTACTS) return { capped: true };

  // Deduplicate by email OR by name+company when no email
  const makeKey = c => (c.email || `${c.name}||${c.company}`).toLowerCase().trim();
  const seen = new Set(contacts.map(makeKey));
  if (seen.has(makeKey(contact))) return { duplicate: true };

  const updated = [...contacts, {
    ...contact,
    id: `hr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    collectedAt: new Date().toISOString(),
  }];
  await chrome.storage.local.set({ [STORAGE_KEY]: updated });
  updateBadge(updated.length);
  if (updated.length % 10 === 0 || updated.length <= 3 || updated.length >= MAX_CONTACTS) {
    await appendLog('info', 'contact_added', {
      count: updated.length,
      name: contact?.name || '',
      company: contact?.company || '',
      hasEmail: Boolean(contact?.email),
    });
  }

  if (updated.length >= MAX_CONTACTS) {
    await chrome.storage.local.set({ jso_is_collecting: false });
    chrome.notifications.create('jso_cap', {
      type: 'basic', iconUrl: 'icons/icon48.png',
      title: 'Jobs Smart Outreach',
      message: `🎯 ${MAX_CONTACTS} HR contacts collected! Open the dashboard to send your campaign.`,
    });
  }
  return { added: true, count: updated.length };
}

// ── Portal helpers ────────────────────────────────────────────────────────────

const PORTAL_ORIGINS = [
  'https://autoapplycv.in',
  'https://www.autoapplycv.in',
  'https://autoapplycv.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

function normalizeOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
}

async function getOriginPriority() {
  const { jso_preferred_origin } = await chrome.storage.local.get('jso_preferred_origin');
  const preferred = normalizeOrigin(jso_preferred_origin);
  if (!preferred) return PORTAL_ORIGINS;
  return [preferred, ...PORTAL_ORIGINS.filter((o) => o !== preferred)];
}

async function findOrOpenDashboardTab() {
  const tabs = await chrome.tabs.query({});
  const origins = await getOriginPriority();
  for (const origin of origins) {
    const tab = tabs.find(t => t.url?.startsWith(origin));
    if (tab) {
      await appendLog('info', 'dashboard_tab_found', { origin, tabId: tab.id });
      return tab;
    }
  }
  // No dashboard tab open — open one silently in the background
  return new Promise(resolve => {
    chrome.tabs.create({ url: origins[0] + '/dashboard/cold-emails', active: false }, newTab => {
      void appendLog('warn', 'dashboard_tab_opened', { origin: origins[0], tabId: newTab?.id || 0 });
      const listener = (tabId, info) => {
        if (tabId === newTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          // Give the SPA a moment to hydrate
          setTimeout(() => resolve(newTab), 1500);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(() => resolve(newTab), 8000); // hard fallback
    });
  });
}

async function sendMessageToTab(tabId, message) {
  if (!tabId) return { ok: false, error: 'Missing tab id' };
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve({ ok: true, response });
      });
    } catch (error) {
      resolve({ ok: false, error: String(error?.message || error) });
    }
  });
}

async function ensureBridgeInTab(tabId) {
  if (!tabId) return false;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/bridge.js'],
    });
    await appendLog('info', 'bridge_injected', { tabId });
    return true;
  } catch (error) {
    await appendLog('warn', 'bridge_inject_failed', {
      tabId,
      error: String(error?.message || error),
    });
    return false;
  }
}

async function ensureContentInTab(tabId) {
  if (!tabId) return false;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content.js'],
    });
    await appendLog('info', 'content_injected', { tabId });
    return true;
  } catch (error) {
    await appendLog('warn', 'content_inject_failed', {
      tabId,
      error: String(error?.message || error),
    });
    return false;
  }
}

async function sendMessageToTabWithRetry(tabId, message, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    const result = await sendMessageToTab(tabId, message);
    if (result.ok) return result;
    const err = String(result?.error || '').toLowerCase();
    if (err.includes('receiving end does not exist')) {
      await ensureContentInTab(tabId);
    }
    await sleep(350);
  }
  return { ok: false, error: 'Unable to reach tab receiver after retries' };
}

async function searchViaBridge(tabId, query) {
  // Bridge may not be ready immediately on freshly opened dashboard tab.
  let bridgeInjected = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    const result = await sendMessageToTab(tabId, {
      type: 'JSO_WEB_SEARCH_HR',
      query,
      platform: 'linkedin',
      country: 'all',
    });
    if (result.ok && result.response?.attempted) {
      const status = Number(result.response.status || 0);
      await appendLog(status >= 400 ? 'warn' : 'info', 'bridge_search_response', {
        attempt: attempt + 1,
        status,
        query,
        contacts: Array.isArray(result.response.contacts) ? result.response.contacts.length : 0,
      });
      if (status === 401 || status === 403) {
        await chrome.storage.local.set({ jso_last_error: 'AUTH_REQUIRED' });
        await appendLog('error', 'auth_required', { status, query });
      }
      return {
        status,
        contacts: Array.isArray(result.response.contacts) ? result.response.contacts : [],
      };
    }
    const err = String(result?.error || '');
    if (!bridgeInjected && err.toLowerCase().includes('receiving end does not exist')) {
      bridgeInjected = await ensureBridgeInTab(tabId);
      // give page a tiny moment to attach listeners
      await sleep(250);
    }
    await appendLog('warn', 'bridge_search_retry', {
      attempt: attempt + 1,
      query,
      error: err || 'bridge not ready',
    });
    await sleep(500);
  }
  await appendLog('warn', 'bridge_search_unavailable', { query });
  return null;
}

async function getLinkedInTab() {
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((t) => String(t.url || '').includes('linkedin.com'));
  if (existing?.id) return existing;
  return null;
}

async function startLinkedInDomCollection(keyword, category) {
  let tab = await getLinkedInTab();
  if (!tab) {
    // Smart search queries - optimized for HR emails with high-quality leads
  const smartQueries = [
    'we are hiring email',              // Direct: hiring + email keyword
    'hiring engineer contact',           // Role-based + contact
    'we are expanding team',             // Hiring signal
    'recruiting developer',              // Direct recruiting
    'talent acquisition hr',             // HR-specific
    'open position contact',             // Position open
    'join our team',                     // Team expansion
    'looking for talent',                // Talent search
  ];

  let query = keyword || 'we are hiring';
  
  // If keyword provided, enhance with email intent
  if (keyword && !keyword.toLowerCase().includes('email')) {
    query = `${keyword} email`;
  } else if (!keyword) {
    // Use smart queries if no keyword provided
    const randomIdx = Math.floor(Math.random() * smartQueries.length);
    query = smartQueries[randomIdx];
  }

  debugLog('using_smart_search', { query, hasCustomKeyword: !!keyword });
  
  const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(query)}&origin=GLOBAL_SEARCH_HEADER`;
    tab = await new Promise((resolve) => chrome.tabs.create({ url: searchUrl, active: true }, resolve));
  }
  if (!tab?.id) {
    await appendLog('error', 'linkedin_tab_missing_for_dom_collect');
    return { ok: false, error: 'No LinkedIn tab available' };
  }

  // Ensure tab is fully loaded before sending
  await new Promise((resolve) => {
    const listener = (tabId, info) => {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(null);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      try { chrome.tabs.onUpdated.removeListener(listener); } catch {}
      resolve(null);
    }, 7000);
  });

  const result = await sendMessageToTabWithRetry(tab.id, {
    type: 'JSO_START_SCRAPE',
    keyword: keyword || 'we are hiring',
    category: category || '',
  });
  if (result.ok && result.response?.ok) {
    await appendLog('info', 'dom_collection_started', { tabId: tab.id, keyword, category });
    
    // Set a timeout to stop collection if no completion signal received within 20s
    // (content.js has 25s timeout, so this ensures we catch hangs)
    setTimeout(async () => {
      const stored = await chrome.storage.local.get('jso_is_collecting');
      if (stored.jso_is_collecting) {
        await appendLog('warn', 'dom_collection_timeout', { tabId: tab.id, maxWait: 20000 });
        await chrome.storage.local.set({ jso_is_collecting: false, jso_active_run_id: '' });
        // Try to stop scraping on the tab
        chrome.tabs.sendMessage(tab.id, { type: 'JSO_STOP_SCRAPE' }, () => void 0);
      }
    }, 20000);
    
    return { ok: true };
  }
  await appendLog('error', 'dom_collection_start_failed', {
    tabId: tab.id,
    error: result?.error || result?.response?.reason || 'unknown',
  });
  return { ok: false, error: result?.error || 'Failed to start DOM collection' };
}

// Call the webapp search API via scripting on the dashboard tab
async function searchViaWebapp(query) {
  let tab;
  try {
    tab = await findOrOpenDashboardTab();
  } catch {
    return [];
  }
  // Prefer tested pattern: ask dashboard bridge content-script to fetch API.
  const bridgeResults = await searchViaBridge(tab.id, query);
  if (bridgeResults && typeof bridgeResults === 'object') return bridgeResults;

  // Fallback: execute script directly in dashboard tab.
  try {
    await appendLog('warn', 'search_fallback_execute_script', { query, tabId: tab?.id || 0 });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (q) => {
        try {
          const res = await fetch('/api/user/hr-outreach/search', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: q, platform: 'linkedin', country: 'all' }),
          });
          if (!res.ok) return { status: res.status, contacts: [] };
          const data = await res.json();
          const contacts = Array.isArray(data?.results)
            ? data.results
            : (Array.isArray(data?.contacts) ? data.contacts : []);
          return {
            status: res.status,
            contacts,
          };
        } catch {
          return { status: 0, contacts: [] };
        }
      },
      args: [query],
    });
    const parsed = results?.[0]?.result ?? { status: 0, contacts: [] };
    const status = Number(parsed?.status || 0);
    const contacts = Array.isArray(parsed?.contacts) ? parsed.contacts : [];
    if (status === 401 || status === 403) {
      await chrome.storage.local.set({ jso_last_error: 'AUTH_REQUIRED' });
      await appendLog('error', 'fallback_auth_required', { query, status });
    }
    await appendLog('info', 'search_fallback_result', { query, status, contacts: contacts.length });
    return { status, contacts };
  } catch (err) {
    await appendLog('error', 'search_fallback_failed', { query, error: String(err?.message || err) });
    console.warn('[JSO] searchViaWebapp failed:', err.message);
    return { status: 0, contacts: [] };
  }
}

// Build a diverse set of search queries from the keyword + category
function buildQueries(keyword, category) {
  const kw = keyword || 'we are hiring';
  const cat = category || '';
  return [...new Set([
    kw,
    cat ? `${kw} ${cat}` : `${kw} developer`,
    cat ? `hiring ${cat}` : 'hiring software engineer',
    cat ? `recruiting ${cat}` : 'recruiting developer',
    cat ? `HR recruiter ${cat}` : 'HR recruiter technology',
    'we are expanding team hiring',
    cat ? `open position ${cat}` : 'open position software engineer',
    cat ? `looking for ${cat}` : 'looking for talented engineer',
    'talent acquisition hiring manager',
    cat ? `${cat} jobs recruiter` : 'engineering jobs recruiter',
  ])];
}

// ── Main collection loop (DOM-based scraping from real LinkedIn) ──────────────

async function runCollection(keyword, category) {
  await appendLog('info', 'collection_started', { keyword, category });
  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await chrome.storage.local.set({ jso_active_run_id: runId });

  // Skip API - go straight to real LinkedIn DOM scraping
  await appendLog('info', 'using_dom_scraping_mode', { keyword, category });
  
  const domStart = await startLinkedInDomCollection(keyword, category);
  if (!domStart.ok) {
    await appendLog('error', 'dom_collection_failed', { error: domStart.error });
    await chrome.storage.local.set({ jso_is_collecting: false, jso_active_run_id: '' });
    return;
  }

  // Wait for DOM scraping to complete (content.js will send JSO_SCRAPE_DONE)
  // The timeout in startLinkedInDomCollection will handle if it hangs
}

// ── Message Handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg.type) {

      case 'JSO_GET_CONTACTS': {
        const contacts = await getContacts();
        sendResponse({ contacts, count: contacts.length, max: MAX_CONTACTS });
        break;
      }

      case 'JSO_ADD_CONTACT':
      case 'JSO_QUEUE_PROFILE_FOR_EMAIL': {
        // Accept contacts from content.js (with or without email)
        if (msg.contact?.name || msg.contact?.email) {
          const result = await addContact(msg.contact);
          sendResponse(result);
        } else {
          sendResponse({ skipped: true });
        }
        break;
      }

      case 'JSO_CLEAR_CONTACTS': {
        await chrome.storage.local.set({ [STORAGE_KEY]: [], jso_is_collecting: false, jso_active_run_id: '' });
        chrome.action.setBadgeText({ text: '' });
        sendResponse({ ok: true });
        break;
      }

      case 'JSO_START_COLLECTING': {
        const contacts = await getContacts();
        if (contacts.length >= MAX_CONTACTS) {
          sendResponse({ ok: false, reason: 'capped' });
          break;
        }
        const kw  = msg.keyword  || 'we are hiring';
        const cat = msg.category || '';
        await chrome.storage.local.set({
          jso_is_collecting: true,
          jso_keyword: kw,
          jso_category: cat,
          jso_last_error: '',
          jso_active_run_id: '',
        });
        await appendLog('info', 'start_requested', { keyword: kw, category: cat, existingCount: contacts.length });
        // Fire-and-forget — don't await (service workers must respond quickly)
        runCollection(kw, cat);
        sendResponse({ ok: true });
        break;
      }

      case 'JSO_STOP_COLLECTING': {
        await chrome.storage.local.set({ jso_is_collecting: false, jso_last_error: '', jso_active_run_id: '' });
        await appendLog('warn', 'stop_requested');
        try {
          const tabs = await chrome.tabs.query({});
          const linkedInTabs = tabs.filter((t) => String(t.url || '').includes('linkedin.com') && t.id);
          for (const t of linkedInTabs) {
            chrome.tabs.sendMessage(t.id, { type: 'JSO_STOP_SCRAPE' }, () => void 0);
          }
        } catch {}
        sendResponse({ ok: true });
        break;
      }

      case 'JSO_RESET': {
        // Fix stuck "collecting" state without clearing contacts
        await chrome.storage.local.set({ jso_is_collecting: false, jso_last_error: '', jso_active_run_id: '' });
        await appendLog('warn', 'reset_requested');
        sendResponse({ ok: true });
        break;
      }

      case 'JSO_GET_STATUS': {
        const contacts = await getContacts();
        const stored = await chrome.storage.local.get(['jso_is_collecting', 'jso_keyword', 'jso_category', 'jso_preferred_origin', 'jso_last_error']);
        sendResponse({
          count:        contacts.length,
          max:          MAX_CONTACTS,
          isCollecting: !!stored.jso_is_collecting,
          keyword:      stored.jso_keyword  ?? 'we are hiring',
          category:     stored.jso_category ?? '',
          preferredOrigin: stored.jso_preferred_origin ?? '',
          lastError: String(stored.jso_last_error || ''),
        });
        break;
      }

      case 'JSO_SCRAPE_DONE': {
        const contacts = await getContacts();
        await chrome.storage.local.set({ jso_is_collecting: false, jso_active_run_id: '' });
        await appendLog('info', 'dom_scrape_done', {
          contentCount: Number(msg.count || 0),
          storedCount: contacts.length,
        });
        chrome.runtime.sendMessage({ type: 'JSO_COLLECTING_DONE', count: contacts.length }).catch(() => {});
        sendResponse({ ok: true });
        break;
      }

      case 'JSO_BRIDGE_READY': {
        const origin = normalizeOrigin(msg.origin);
        if (origin) {
          await chrome.storage.local.set({ jso_preferred_origin: origin });
          await appendLog('info', 'bridge_ready', { origin, version: msg.version || '' });
        }
        sendResponse({ ok: true });
        break;
      }

      case 'JSO_DEBUG_EVENT': {
        await appendLog(msg.level || 'info', msg.event || 'bridge_event', {
          source: msg.source || 'unknown',
          ...safeClone(msg.data || {}),
        });
        sendResponse({ ok: true });
        break;
      }

      case 'JSO_GET_LOGS': {
        const logs = await getLogs();
        sendResponse({ ok: true, logs });
        break;
      }

      case 'JSO_CLEAR_LOGS': {
        await clearLogs();
        sendResponse({ ok: true });
        break;
      }

      case 'JSO_SYNC_TO_DASHBOARD': {
        // Navigate the dashboard to cold-emails page where contacts are auto-loaded
        const tabs = await chrome.tabs.query({});
        let dashTab = null;
        for (const origin of PORTAL_ORIGINS) {
          dashTab = tabs.find(t => t.url?.startsWith(origin));
          if (dashTab) break;
        }
        if (dashTab) {
          chrome.tabs.update(dashTab.id, {
            active: true,
            url: dashTab.url.split('/dashboard')[0] + '/dashboard/cold-emails',
          });
          chrome.windows.update(dashTab.windowId, { focused: true });
        } else {
          chrome.tabs.create({ url: PORTAL_ORIGINS[0] + '/dashboard/cold-emails' });
        }
        sendResponse({ ok: true });
        break;
      }

      default:
        await appendLog('warn', 'unknown_message_type', { type: msg?.type || '' });
        sendResponse({ error: 'Unknown message type: ' + msg.type });
    }
  })();
  return true; // keep channel open for async response
});

// ── Restore badge on service-worker restart ───────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  const contacts = await getContacts();
  updateBadge(contacts.length);
  await appendLog('info', 'extension_installed_or_updated', { contacts: contacts.length });
});

// Restore badge when service worker wakes up (e.g. after being killed by browser)
getContacts().then(c => updateBadge(c.length));
