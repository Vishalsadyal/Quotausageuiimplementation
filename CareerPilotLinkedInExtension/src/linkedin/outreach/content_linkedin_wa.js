/**
 * LinkedIn to WhatsApp Job Outreach Pro - LinkedIn Content Script
 * Robust scraper with duplicate tracking & automatic post removal after outreach.
 */

(function () {
  'use strict';

  if (window.__linkedInWhatsAppOutreachInjected) return;
  window.__linkedInWhatsAppOutreachInjected = true;


  // Defaults only. The real values (message, keywords, options) come from the dashboard through
  // chrome.storage.local key "waSettings"; nothing personal is hard-coded here.
  const DEFAULT_SETTINGS = {
    targetKeywords: [],
    messageTemplate: '',
    autoSendWhatsApp: true,       // Auto-send on WhatsApp Web
    autoCloseTab: true,           // Auto-close WhatsApp Web tab after send
    autoLikePosts: true,
    showAlreadyContacted: true,   // Keep all posts visible
    filterJobSeekers: true,
    ignoreKeywords: [...CP_OW_DEFAULT_SKIP_KEYWORDS],           // skip posts that mention any of these
    autoScroll: true,
    matchAllHiringPosts: true,
    removeSentPostFromFeed: false,// Keep all elements intact in feed
    hideNonWhatsAppPosts: false,  // Keep all posts visible in feed
    debugMode: true,
    delayBetweenMessages: 4
  };

  let settings = { ...DEFAULT_SETTINGS };

  let extractedLeads = [];
  let contactedPhones = new Set();
  let duplicateCount = 0;
  let postsSeenCount = 0;
  let isScanning = false;
  let isPaused = false;
  let sendProgress = '';

  // Skipped posts / leads (newest first, capped) and the activity feed (newest first, capped).
  const SKIPPED_CAP = 200;
  const ACTIVITY_CAP = 100;
  let skippedList = [];
  let skippedKeys = new Set();
  let skippedDirty = false;
  let skippedSaveTimer = null;
  let activityLog = [];

  // Widget controller (cpOwInit) and its root element
  let ui = null;
  let widgetRoot = null;


  // Comprehensive Phone regexes
  // 1. Explicit WhatsApp/call prefixes (e.g. "WhatsApp: 9876543210", "DM/WA +91 98765 43210", "share cv on 9876543210")
  const PREFIXED_PHONE_REGEX = /(?:whatsapp|wa|watsapp|what's\s*app|call|contact|ph|phone|mobile|mob|tel|dm|share\s*(?:your\s*)?cv|send\s*(?:your\s*)?resume|cv\s*on|resume\s*on|connect\s*on|ping\s*on|reach\s*on|number|no\.?)[\s:–\-\/]+(\+?(?:91[\s\-]*)?[6-9][\d\s\.\-]{8,14}\d)/gi;
  // 2. Indian numbers with country codes (+91, 91, 0)
  const PHONE_REGEX_WITH_CODE = /(?:(?:\+|00)91|91|0)[\s\.\-]*(?:[6-9]\d{4}[\s\.\-]?\d{5}|[6-9]\d{2}[\s\.\-]?\d{3}[\s\.\-]?\d{4}|[6-9]\d{3}[\s\.\-]?\d{3}[\s\.\-]?\d{3}|[6-9]\d{9})/g;
  // 3. Standalone 10-digit Indian mobile numbers (starts with 6-9)
  const PHONE_REGEX_STANDALONE = /(?:^|[^\d\+])([6-9]\d{4}[\s\.\-]\d{5}|[6-9]\d{2}[\s\.\-]\d{3}[\s\.\-]\d{4}|[6-9]\d{3}[\s\.\-]\d{3}[\s\.\-]\d{3}|[6-9]\d{9})(?=[^\d]|$)/g;
  // 4. WhatsApp link pattern
  const WA_LINK_REGEX = /(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/(\+?\d{10,15})/gi;

  // Job Seeker patterns to filter out (Strictly 1st-person phrases so recruiter posts are NOT matched)
  const JOB_SEEKER_PATTERNS = [
    /\b#opentowork\b/i,
    /\b#lookingforjob\b/i,
    /\b#jobseeker\b/i,
    /\b#jobhunt\b/i,
    /\b#hireme\b/i,
    /\b#lookingforopportunities\b/i,
    /\b#immediatejoiner\b/i,
    /\b#fresherjobseeker\b/i,
    /\b(?:i\s*am|i'm|myself)\s+(?:actively\s+)?(?:looking|seeking|searching|hunting|open)\s+for\s+(?:a\s+)?(?:job|opportunity|opportunities|internship|roles?|work|position|new\s+challenge)/i,
    /\b(?:i\s*am|i'm|myself)\s+(?:an?\s+)?(?:fresher|job\s*seeker|candidate|immediate\s*joiner|graduate|student)\b/i,
    /\bhire\s*me\b/i,
    /\bplease\s+(?:help|guide|refer|support)\s+me\s+(?:to\s+get|for|in\s+getting)?\s*(?:a\s+)?(?:job|role|opportunity|interview)?/i,
    /\bplease\s+(?:find|check|review|see)\s+my\s+(?:attached\s+)?(?:cv|resume|profile|portfolio)/i,
    /\bhere\s+is\s+my\s+(?:resume|cv|portfolio|profile)/i,
    /\bmy\s+(?:resume|cv)\s+is\s+attached/i,
    /\bi\s+have\s+(?:completed|done)\s+my\s+(?:btech|degree|bca|mca|graduation)/i,
    /\bkindly\s+(?:give|provide|offer)\s+me\s+(?:an?\s+)?(?:opportunity|chance|referral)/i,
    /\bif\s+anyone\s+has\s+any\s+(?:vacancy|openings?|leads?)\s+please\s+(?:let\s+me\s+know|dm\s+me|help)/i
  ];

  // Strong recruiter / hiring indicators (Takes precedence over job seeker filters)
  const HIRING_INDICATORS = [
    /\b(?:we\s*are\s*hiring|we're\s*hiring|actively\s*hiring|urgent\s*hiring|hiring\s*alert|company\s*is\s*hiring)\b/i,
    /\b(?:openings?\s*for|hiring\s*for|requirements?\s*for|urgent\s*requirement|urgent\s*opening)\b/i,
    /\b(?:share\s*(?:your\s*)?(?:cv|resume|profile)|send\s*(?:your\s*)?(?:cv|resume|profile))\s*(?:to|at|on|via|whatsapp)\b/i,
    /\b(?:whatsapp\s*(?:your\s*cv|resume|profile|on|at|no|number|cv)|dm\s*(?:your\s*)?(?:cv|resume))\b/i,
    /\binterested\s*candidates?\s*(?:can|please)?\s*(?:share|send|apply|whatsapp|dm|reach)\b/i,
    /\b(?:job\s*location|work\s*location|salary\s*package|ctc\s*:|stipend\s*:|experience\s*required)\b/i,
    /\b(?:apply\s*here|apply\s*now|drop\s*your\s*cv|mail\s*(?:your\s*)?cv)\b/i,
    /\b(?:hiring|vacancy|openings?)\b/i,
    /\b(?:whatsapp|wa\.me)\b/i
  ];

  function normalizeSettings(raw) {
    const merged = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
    merged.targetKeywords = Array.isArray(merged.targetKeywords)
      ? merged.targetKeywords.map((k) => String(k || '').trim()).filter(Boolean)
      : [];
    merged.messageTemplate = typeof merged.messageTemplate === 'string' ? merged.messageTemplate : '';
    return merged;
  }

  // Load storage
  async function loadStorage() {
    // Disconnected after an extension reload: storage is gone until the tab is refreshed.
    if (!chrome?.runtime?.id) return;
    try {
      const data = await chrome.storage.local.get(['waSettings', 'waLeads', 'contactedPhones', 'duplicateStats', 'waSkipped']);
      settings = normalizeSettings(data.waSettings);
      if (Array.isArray(data.waLeads)) extractedLeads = data.waLeads;
      if (Array.isArray(data.contactedPhones)) contactedPhones = new Set(data.contactedPhones);
      if (data.duplicateStats && typeof data.duplicateStats.skippedCount === 'number') {
        duplicateCount = data.duplicateStats.skippedCount;
      }
      if (Array.isArray(data.waSkipped)) {
        skippedList = data.waSkipped.slice(0, SKIPPED_CAP);
        skippedKeys = new Set(skippedList.map((s) => s && s.key).filter(Boolean));
      }
    } catch (e) {
      console.error('[LinkedIn-WA] Load storage error:', e);
    }
  }

  // Keep `settings` fresh when the dashboard saves new options.
  function setupSettingsListener() {
    if (!chrome?.storage?.onChanged) return;
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes.waSettings) return;
      settings = normalizeSettings(changes.waSettings.newValue);
      renderQuickChips();
      renderContactedChip();
      refreshTemplateNote();
      renderLeadsList();
    });
  }

  function hasMessageTemplate() {
    return String(settings.messageTemplate || '').trim().length > 0;
  }


  // ── FLOATING WIDGET UI (built on the shared outreach kit: outreach_ui.js / outreach_base.css) ──

  // Shown only when WhatsApp outreach was asked for in this tab (see cpOwRequestedModule in outreach_ui.js).
  function checkModuleVisibility() {
    if (!ui) return;
    if (cpOwRequestedModule() === 'whatsapp') ui.show();
    else ui.hide();
  }

  function injectFloatingWidget() {
    if (document.getElementById('li-wa-widget')) return;

    const controls = `
      <div id="li-wa-note-slot"></div>
      <div class="cp-ow-search">
        <input type="text" id="widget-search-query" class="cp-ow-input" placeholder="Search hiring posts, e.g. developer hiring whatsapp" />
        ${cpOwButton({ id: 'btn-exec-search', label: 'Search', icon: 'search', kind: 'start' })}
      </div>
      <div class="cp-ow-chips" id="li-wa-chips"></div>
      ${cpOwQuickRow('wa', { start: 'Scan feed', pause: 'Pause', stop: 'Stop' })}
      <div class="cp-ow-quick is-two">
        ${cpOwButton({ id: 'btn-deep-scroll', label: 'Full auto-scroll', icon: 'scroll', title: 'Scroll to the end of the feed and collect every lead' })}
        ${cpOwButton({ id: 'btn-auto-send-all', label: 'Auto-send', icon: 'chat', title: 'Message every pending lead on WhatsApp, one by one' })}
      </div>
      ${cpOwStats([
        { id: 'seen', label: 'Cards seen', value: 0 },
        { id: 'matched', label: 'Matched', value: 0 },
        { id: 'sent', label: 'Sent', value: 0 },
        { id: 'dupes', label: 'Duplicates', value: 0 }
      ])}
      <div class="cp-ow-chips cp-ow-wa-tools">
        <button type="button" class="cp-ow-chip" id="li-wa-chip-contacted" title="Keep posts you already messaged visible in the feed">Show contacted posts</button>
        <button type="button" class="cp-ow-chip" id="btn-export-csv" title="Download your leads as a CSV file">Export CSV</button>
        <button type="button" class="cp-ow-chip" id="btn-clear-leads" title="Clear all leads and contact history">Clear all</button>
      </div>`;

    const holder = document.createElement('div');
    holder.innerHTML = cpOwShell({
      id: 'li-wa-widget',
      title: 'WhatsApp Outreach',
      subtitle: 'Message recruiters who post a phone number',
      icon: 'chat',
      tabs: [
        { id: 'pending', label: 'Pending' },
        { id: 'sent', label: 'Sent' },
        { id: 'skipped', label: 'Skipped' },
        { id: 'activity', label: 'Activity' }
      ],
      controls,
      foot: cpOwDashboardNote()
    });
    widgetRoot = holder.firstElementChild;
    document.body.appendChild(widgetRoot);

    ui = cpOwInit(widgetRoot, { defaultTab: 'pending', onTab: () => renderLeadsList() });
    setupWidgetEvents();
    renderQuickChips();
    renderContactedChip();
    refreshTemplateNote();
    renderLeadsList();
  }

  function $wa(selector) {
    return widgetRoot ? widgetRoot.querySelector(selector) : null;
  }

  function setButtonLabel(btn, text) {
    const span = btn && btn.querySelector('span');
    if (span) span.textContent = text;
  }

  // Quick-search chips come from the keywords set in the dashboard.
  function renderQuickChips() {
    const box = $wa('#li-wa-chips');
    if (!box) return;
    const keywords = (settings.targetKeywords || []).slice(0, 6);
    if (keywords.length === 0) {
      box.innerHTML = '<span class="cp-ow-hint">Search suggestions come from the keywords in your dashboard.</span>';
      return;
    }
    box.innerHTML = keywords
      .map((kw) => {
        const query = `${kw} hiring whatsapp`;
        return `<button type="button" class="cp-ow-chip" data-q="${cpOwEscape(query)}">${cpOwEscape(kw)}</button>`;
      })
      .join('');
  }

  function renderContactedChip() {
    const chip = $wa('#li-wa-chip-contacted');
    if (chip) chip.classList.toggle('is-on', !!settings.showAlreadyContacted);
  }

  // Sending needs a message written in the dashboard. Scanning and searching work without it.
  function refreshTemplateNote() {
    const slot = $wa('#li-wa-note-slot');
    if (!slot) return;
    slot.innerHTML = hasMessageTemplate() ? '' : cpOwDashboardNote('Write your WhatsApp message in your dashboard first.', true);
  }

  function blockedByEmptyMessage() {
    if (hasMessageTemplate()) return false;
    refreshTemplateNote();
    logTerminal('Write your WhatsApp message in your dashboard first. Sending is off until you save a message there.', 'error');
    if (ui) ui.setTab('activity');
    return true;
  }

  function performSearch(query) {
    const q = (query || '').trim();
    if (!q) {
      logTerminal('Type what you want to search for first.', 'warning');
      $wa('#widget-search-query')?.focus();
      return;
    }
    logTerminal(`Opening LinkedIn content search for "${q}"...`, 'info');
    const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(q)}&sortBy=%5B%22date_posted%22%5D#autoapply-module=whatsapp`;
    window.location.href = searchUrl;
  }

  function setupWidgetEvents() {
    const searchInput = $wa('#widget-search-query');

    $wa('#btn-exec-search')?.addEventListener('click', () => performSearch(searchInput ? searchInput.value : ''));
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performSearch(searchInput.value);
    });

    // Quick search chips (built from dashboard keywords)
    $wa('#li-wa-chips')?.addEventListener('click', (e) => {
      const chip = e.target instanceof Element ? e.target.closest('[data-q]') : null;
      if (!chip) return;
      const query = chip.getAttribute('data-q') || '';
      if (searchInput) searchInput.value = query;
      performSearch(query);
    });

    // Scan feed
    $wa('#wa-start')?.addEventListener('click', () => {
      if (!isScanning) startScanner();
    });

    // Pause / resume whatever is running
    $wa('#wa-pause')?.addEventListener('click', () => {
      if (!isBusy()) return;
      isPaused = !isPaused;
      logTerminal(isPaused ? 'Paused.' : 'Resumed.', 'warning');
      updateUi();
    });

    // Stop everything
    $wa('#wa-stop')?.addEventListener('click', stopEverything);

    // Deep Full Auto-Scroll Button
    $wa('#btn-deep-scroll')?.addEventListener('click', () => startFullAutoScroll());

    // Auto-send queue
    $wa('#btn-auto-send-all')?.addEventListener('click', () => startAutoSendingQueue());

    // Only quick toggle kept in the widget; every other option is edited in the dashboard.
    $wa('#li-wa-chip-contacted')?.addEventListener('click', async () => {
      settings.showAlreadyContacted = !settings.showAlreadyContacted;
      renderContactedChip();
      try {
        const data = await chrome.storage.local.get(['waSettings']);
        await chrome.storage.local.set({ waSettings: { ...(data.waSettings || {}), showAlreadyContacted: settings.showAlreadyContacted } });
      } catch (_) {}
      logTerminal(settings.showAlreadyContacted ? 'Showing contacted posts in the LinkedIn feed.' : 'Hiding contacted posts from the LinkedIn feed.', 'info');
      scanCurrentDOMForLeads();
    });

    // Clear leads & history
    $wa('#btn-clear-leads')?.addEventListener('click', () => {
      if (confirm('Clear all leads and reset contacted history for fresh outreach testing?')) {
        extractedLeads = [];
        contactedPhones = new Set();
        duplicateCount = 0;
        skippedList = [];
        skippedKeys = new Set();
        chrome.storage.local.set({ waLeads: [], contactedPhones: [], contactedLog: [], duplicateStats: { skippedCount: 0 }, waSkipped: [] });
        renderLeadsList();
        logTerminal('Cleared all leads and reset contact history.', 'info');
        scanCurrentDOMForLeads();
      }
    });

    // Export CSV
    $wa('#btn-export-csv')?.addEventListener('click', exportLeadsToCSV);

    // Per-lead actions inside the list (event delegation)
    ui.list?.addEventListener('click', (e) => {
      const btn = e.target instanceof Element ? e.target.closest('[data-wa-act]') : null;
      if (!btn) return;
      const lead = extractedLeads.find((l) => l.id === btn.getAttribute('data-id'));
      if (lead && btn.getAttribute('data-wa-act') === 'send') dispatchOutreach(lead);
    });
  }

  // ── SKIPPED + ACTIVITY BOOKKEEPING ────────────────────────────────────────

  // Record one skipped lead/post (once per key + reason), newest first, persisted under waSkipped.
  function recordSkip({ id = '', name = '', title = '', company = '', reason, keyBase = '' }) {
    const key = `${reason}|${keyBase || id || name}`;
    if (skippedKeys.has(key)) return false;
    skippedKeys.add(key);
    skippedList.unshift({
      id: id || keyBase,
      key,
      name: name || 'Unknown poster',
      title: title || '',
      company: company || '',
      reason,
      ts: new Date().toISOString()
    });
    while (skippedList.length > SKIPPED_CAP) {
      const dropped = skippedList.pop();
      if (dropped && dropped.key) skippedKeys.delete(dropped.key);
    }
    skippedDirty = true;
    return true;
  }

  function flushSkipped() {
    if (!skippedDirty) return;
    skippedDirty = false;
    clearTimeout(skippedSaveTimer);
    skippedSaveTimer = setTimeout(() => {
      if (!chrome?.runtime?.id) return;
      try {
        chrome.storage.local.set({ waSkipped: skippedList, duplicateStats: { skippedCount: duplicateCount } });
      } catch (_) {}
    }, 300);
  }

  // Stable identity for a post even when LinkedIn gives it no id attribute.
  function stablePostKey(postEl, text) {
    const attr = postEl.getAttribute('componentkey') || postEl.id || postEl.getAttribute('data-urn') || postEl.getAttribute('data-chameleon-result-urn');
    if (attr) return attr;
    return 'txt:' + String(text || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  function formatTime(value) {
    return typeof cpOwClock === 'function' ? cpOwClock(value) : '';
  }

  function isBusy() {
    return isScanning || isFullScrolling || isAutoSending;
  }

  function pendingLeadList() {
    return extractedLeads.filter((l) => l.status !== 'sent' && l.status !== 'invalid' && !contactedPhones.has(l.cleanPhone));
  }

  function leadTime(lead) {
    return new Date(lead.sentAt || lead.timestamp || 0).getTime() || 0;
  }

  function newestFirst(list) {
    return list.slice().sort((a, b) => leadTime(b) - leadTime(a));
  }

  function leadSub(lead) {
    const role = [lead.jobTitle, lead.company].filter(Boolean).join(' at ');
    return [role, lead.cleanPhone ? `+${lead.cleanPhone}` : ''].filter(Boolean).join(' - ');
  }

  // ── CARD BUILDERS ─────────────────────────────────────────────────────────

  function pendingCardHtml(lead) {
    const sending = lead.status === 'sending';
    const actions = sending
      ? ''
      : `<button type="button" class="cp-ow-btn is-ghost cp-ow-btn-sm" data-wa-act="send" data-id="${cpOwEscape(lead.id)}">Send now</button>`;
    return cpOwCard({
      icon: 'chat',
      title: lead.recruiterName || 'Hiring Manager',
      sub: leadSub(lead),
      tag: sending ? 'Sending' : '',
      time: formatTime(lead.timestamp),
      actionsHtml: actions
    });
  }

  function sentCardHtml(lead) {
    return cpOwCard({
      kind: 'sent',
      icon: 'check',
      title: lead.recruiterName || 'Hiring Manager',
      sub: leadSub(lead),
      time: formatTime(lead.sentAt || lead.timestamp),
      actionsHtml: `<button type="button" class="cp-ow-btn is-ghost cp-ow-btn-sm" data-wa-act="send" data-id="${cpOwEscape(lead.id)}">Message again</button>`
    });
  }

  function skippedCardHtml(entry) {
    return cpOwCard({
      kind: 'skipped',
      icon: 'skip',
      title: entry.name || 'Unknown poster',
      sub: [entry.title, entry.company].filter(Boolean).join(' at '),
      reason: entry.reason,
      time: formatTime(entry.ts)
    });
  }

  function activityCardHtml(item) {
    const map = {
      success: { kind: 'sent', icon: 'check' },
      error: { kind: 'error', icon: 'alert' },
      warning: { kind: 'skipped', icon: 'alert' },
      info: { kind: '', icon: 'sparkle' }
    };
    const m = map[item.type] || map.info;
    return cpOwCard({ kind: m.kind, icon: m.icon, title: item.text, time: formatTime(item.ts) });
  }

  function bannerHtml() {
    if (!isBusy()) return '';
    let title = 'Scanning feed';
    if (isAutoSending) title = 'Sending messages';
    else if (isFullScrolling) title = 'Scrolling the feed';
    if (isPaused) title = 'Paused';
    const latest = activityLog[0];
    const main = latest ? latest.text : 'Working...';
    const detail = `${extractedLeads.length} matched, ${extractedLeads.filter((l) => l.status === 'sent').length} sent` + (sendProgress && isAutoSending ? `, lead ${sendProgress}` : '');
    return cpOwBanner({ title, main, detail }) + (isPaused ? '' : cpOwWorking(isAutoSending ? 'Sending on WhatsApp' : 'Looking for phone numbers'));
  }

  // ── STATE -> UI ───────────────────────────────────────────────────────────

  function updateUi() {
    if (!ui) return;
    const busy = isBusy();
    if (busy && isPaused) ui.setBadge('Paused', 'pause');
    else if (isAutoSending) ui.setBadge('Sending', 'run');
    else if (isScanning || isFullScrolling) ui.setBadge('Scanning', 'run');
    else ui.setBadge('Idle', '');

    const start = $wa('#wa-start');
    const pause = $wa('#wa-pause');
    const stop = $wa('#wa-stop');
    const deep = $wa('#btn-deep-scroll');
    const send = $wa('#btn-auto-send-all');
    if (start) {
      start.disabled = isScanning;
      setButtonLabel(start, isScanning ? 'Scanning' : 'Scan feed');
    }
    if (pause) {
      pause.disabled = !busy;
      setButtonLabel(pause, isPaused ? 'Resume' : 'Pause');
    }
    if (stop) stop.disabled = !busy;
    if (deep) setButtonLabel(deep, isFullScrolling ? 'Stop scroll' : 'Full auto-scroll');
    if (send) setButtonLabel(send, isAutoSending ? (sendProgress ? `Stop sending (${sendProgress})` : 'Stop sending') : 'Auto-send');
  }

  function setStat(id, value) {
    const el = $wa(`[data-stat="${id}"]`);
    if (el) el.textContent = String(value);
  }

  function updateStatsBar() {
    const sentCount = extractedLeads.filter((l) => l.status === 'sent').length;
    const pendingCount = pendingLeadList().length;
    setStat('seen', postsSeenCount);
    setStat('matched', extractedLeads.length);
    setStat('sent', sentCount);
    setStat('dupes', duplicateCount);
    if (ui) {
      ui.setCount('pending', pendingCount);
      ui.setCount('sent', sentCount);
      ui.setCount('skipped', skippedList.length);
    }
  }

  let lastListKey = '';
  let lastTab = '';

  function renderLeadsList() {
    updateStatsBar();
    updateUi();
    if (!ui || !ui.list) return;

    const tab = ui.tab;
    let html = '';
    let items = [];
    let firstKey = '';

    if (tab === 'pending') {
      items = newestFirst(pendingLeadList());
      html = items.map(pendingCardHtml).join('');
      firstKey = items[0] ? items[0].id : '';
      if (!items.length) html = cpOwEmpty('search', 'No leads waiting. Scan the feed or search for hiring posts that mention a phone number.');
    } else if (tab === 'sent') {
      items = newestFirst(extractedLeads.filter((l) => l.status === 'sent'));
      html = items.map(sentCardHtml).join('');
      firstKey = items[0] ? items[0].id : '';
      if (!items.length) html = cpOwEmpty('chat', 'No messages sent yet.');
    } else if (tab === 'skipped') {
      items = skippedList.slice().sort((a, b) => (new Date(b.ts).getTime() || 0) - (new Date(a.ts).getTime() || 0));
      html = items.map(skippedCardHtml).join('');
      firstKey = items[0] ? items[0].key : '';
      if (!items.length) html = cpOwEmpty('skip', 'Nothing skipped. Posts the widget passes over show up here with the reason.');
    } else {
      items = activityLog;
      html = bannerHtml() + items.map(activityCardHtml).join('');
      firstKey = items[0] ? `${items[0].ts}|${items[0].text}` : '';
      if (!items.length && !isBusy()) html = cpOwEmpty('clock', 'Nothing has happened yet. What the widget does will be listed here, newest first.');
    }

    const list = ui.list;
    const keepScroll = list.scrollTop;
    const listKey = `${tab}|${firstKey}`;
    ui.setList(html);
    if (tab !== lastTab || listKey !== lastListKey) list.scrollTop = 0;
    else list.scrollTop = keepScroll;
    lastTab = tab;
    lastListKey = listKey;
  }


  // Abortable sleep that checks running predicate every 50ms for instant stoppage
  async function abortableSleep(ms, isRunningFn) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (typeof isRunningFn === 'function' && !isRunningFn()) {
        return false;
      }
      await sleep(50);
    }
    return typeof isRunningFn === 'function' ? isRunningFn() : true;
  }

  // ── SCANNING & EXTRACTION ENGINE ──────────────────────────────────────────

  function startScanner() {
    if (isFullScrolling) stopFullAutoScroll();
    isScanning = true;
    isPaused = false;
    updateUi();
    logTerminal('Starting LinkedIn Scanner for Hiring Posts & WhatsApp Numbers...', 'info');
    runScanLoop();
  }

  function stopScanner() {
    isScanning = false;
    isPaused = false;
    isFullScrolling = false;
    updateUi();
    logTerminal('Scanner stopped.', 'info');
  }

  function stopEverything() {
    const wasBusy = isBusy();
    isScanning = false;
    isFullScrolling = false;
    isAutoSending = false;
    isPaused = false;
    sendProgress = '';
    updateUi();
    renderLeadsList();
    if (wasBusy) logTerminal('Stopped.', 'warning');
  }

  async function runScanLoop() {
    while (isScanning) {
      if (isPaused) {
        await abortableSleep(1000, () => isScanning && isPaused);
        continue;
      }

      // 1. Automatically expand all "...see more" buttons on posts
      expandAllSeeMoreButtons();

      // 2. Scan visible posts
      const newLeadsFound = scanCurrentDOMForLeads();

      if (newLeadsFound > 0) {
        logTerminal(`Found ${newLeadsFound} new hiring lead(s) with WhatsApp numbers!`, 'success');
        renderLeadsList();
      }

      if (!isScanning) break;

      if (settings.autoScroll) {
        const allPosts = findAllPostElements();
        if (allPosts.length > 0 && isScanning) {
          const bottomPost = allPosts[allPosts.length - 1];
          focusAndHighlightPost(bottomPost, '#25D366');
        }
        if (!isScanning) break;
        window.scrollBy({ top: 750, behavior: 'smooth' });
        await abortableSleep(2500, () => isScanning && !isPaused);
      } else {
        await abortableSleep(3000, () => isScanning && !isPaused);
      }
    }
  }

  // ── DEEP FULL AUTO-SCROLL TO FEED BOTTOM ENGINE ──
  let isFullScrolling = false;

  // Helper to focus & highlight a LinkedIn post element
  function focusAndHighlightPost(postEl, color = '#25D366') {
    if (!postEl || (!isFullScrolling && !isScanning && !isAutoSending)) return;
    try {
      postEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (!postEl.hasAttribute('tabindex')) {
        postEl.setAttribute('tabindex', '-1');
      }
      postEl.focus({ preventScroll: true });

      const prevTransition = postEl.style.transition;
      const prevOutline = postEl.style.outline;
      const prevShadow = postEl.style.boxShadow;

      postEl.style.transition = 'all 0.3s ease';
      postEl.style.outline = `2px solid ${color}`;
      postEl.style.boxShadow = `0 0 16px ${color}55`;

      setTimeout(() => {
        postEl.style.outline = prevOutline;
        postEl.style.boxShadow = prevShadow;
        postEl.style.transition = prevTransition;
      }, 3200);
    } catch (_) {}
  }

  // Helper to find the DOM post element associated with a lead
  function findPostElementForLead(lead) {
    if (!lead) return null;
    if (lead.urn) {
      const match = document.querySelector(`[data-urn*="${lead.urn}"], [data-id*="${lead.urn}"]`);
      if (match) return match;
    }
    const allPosts = findAllPostElements();
    for (const post of allPosts) {
      const text = post.innerText || '';
      if (lead.cleanPhone && text.includes(lead.cleanPhone.slice(-8))) {
        return post;
      }
      if (lead.recruiterName && lead.recruiterName !== 'LinkedIn Member' && text.includes(lead.recruiterName)) {
        return post;
      }
    }
    return null;
  }

  function findAndClickShowMoreButton() {
    const selectors = [
      'button.scaffold-finite-scroll__load-button',
      'button.feed-shared-show-more-button',
      'button[aria-label*="see more results" i]',
      'button[aria-label*="show more results" i]',
      'button[aria-label*="load more" i]',
      'button.artdeco-button--muted[aria-label*="more" i]',
      'button.search-results-loader__load-more',
      'button[data-control-name="load_more_results"]'
    ];
    for (const sel of selectors) {
      const btns = document.querySelectorAll(sel);
      for (const b of btns) {
        if (b.offsetParent !== null && !b.disabled) {
          try {
            b.click();
            return true;
          } catch (_) {}
        }
      }
    }
    return false;
  }

  async function startFullAutoScroll() {
    if (isFullScrolling) {
      stopFullAutoScroll();
      return;
    }

    // Stop scanner if running to prevent concurrent scroll loops
    if (isScanning) {
      isScanning = false;
    }

    isFullScrolling = true;
    isPaused = false;
    updateUi();
    logTerminal('Full Auto-Scroll started! Navigating LinkedIn 3s lazy loading batches...', 'info');

    let stagnantCount = 0;
    let cycleCount = 0;
    let lastPostCount = findAllPostElements().length;

    while (isFullScrolling) {
      if (isPaused) {
        await abortableSleep(1000, () => isFullScrolling && isPaused);
        continue;
      }
      cycleCount++;

      // 1. Expand all "...see more" buttons on currently visible posts
      expandAllSeeMoreButtons();

      // 2. Scan DOM for new leads
      const found = scanCurrentDOMForLeads();
      if (found > 0) {
        renderLeadsList();
      }

      if (!isFullScrolling) break;

      // 3. Check for and click any "Show more results" button if present
      findAndClickShowMoreButton();

      const prevHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
      const prevPosts = findAllPostElements().length;

      // 4. Scroll smoothly to bottom and move active focus to the latest card
      window.scrollTo({
        top: prevHeight,
        behavior: 'smooth'
      });

      if (!isFullScrolling) break;

      const currentPosts = findAllPostElements();
      if (currentPosts.length > 0 && isFullScrolling) {
        const bottomPost = currentPosts[currentPosts.length - 1];
        focusAndHighlightPost(bottomPost, '#0ea5e9');
      }

      // 5. Trigger LinkedIn IntersectionObserver via micro-scroll
      const cont1 = await abortableSleep(500, () => isFullScrolling);
      if (!cont1 || !isFullScrolling) break;

      window.scrollBy({ top: -120, behavior: 'smooth' });

      const cont2 = await abortableSleep(300, () => isFullScrolling);
      if (!cont2 || !isFullScrolling) break;

      window.scrollTo({
        top: document.documentElement.scrollHeight || document.body.scrollHeight,
        behavior: 'smooth'
      });

      // 6. Wait 3 seconds for LinkedIn lazy loader to fetch & render new ~5 posts batch
      logTerminal(`[Batch #${cycleCount}] Waiting 3s for LinkedIn lazy load (Posts: ${prevPosts}, Leads: ${extractedLeads.length})...`, 'info');
      
      let waited = 0;
      while (waited < 3000 && isFullScrolling) {
        const ok = await abortableSleep(500, () => isFullScrolling);
        if (!ok || !isFullScrolling) break;
        waited += 500;
        if (findAllPostElements().length > prevPosts) {
          break; // New posts arrived earlier
        }
      }

      if (!isFullScrolling) break;

      // 7. Check if new posts appeared & move focus to newly mounted post
      const newHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
      const newPostsList = findAllPostElements();
      const newPosts = newPostsList.length;

      if (newPosts > lastPostCount || newHeight > prevHeight + 100) {
        const addedPosts = newPosts - lastPostCount;
        logTerminal(`Loaded +${addedPosts > 0 ? addedPosts : 'new'} posts from LinkedIn! Total cards: ${newPosts}`, 'success');
        lastPostCount = newPosts;
        stagnantCount = 0;

        if (newPostsList.length > 0 && isFullScrolling) {
          const newestPost = newPostsList[newPostsList.length - 1];
          focusAndHighlightPost(newestPost, '#22c55e');
        }
      } else {
        // Try clicking show more button if feed paused
        const clicked = findAndClickShowMoreButton();
        if (clicked) {
          logTerminal('Clicked "Show more results" button on LinkedIn. Waiting 3s...', 'info');
          const ok = await abortableSleep(3000, () => isFullScrolling);
          if (!ok || !isFullScrolling) break;
          continue;
        }

        stagnantCount++;
        logTerminal(`Reached feed pause (${stagnantCount}/4)... retrying scroll.`, 'warning');
        if (stagnantCount >= 4) {
          logTerminal('Reached the end of LinkedIn feed / search results! All available posts loaded.', 'success');
          break;
        }
      }
    }

    const wasRunning = isFullScrolling;
    isFullScrolling = false;
    isPaused = false;
    updateUi();
    expandAllSeeMoreButtons();
    scanCurrentDOMForLeads();
    renderLeadsList();
    if (wasRunning) {
      logTerminal(`Full Scroll complete! Extracted total ${extractedLeads.length} leads from ${findAllPostElements().length} posts.`, 'success');
    }
  }

  function stopFullAutoScroll() {
    isFullScrolling = false;
    isScanning = false;
    isPaused = false;
    updateUi();
    logTerminal('Full auto-scroll stopped.', 'warning');
  }

  // Expand "...see more" buttons so phone numbers hidden below the fold are revealed
  function expandAllSeeMoreButtons() {
    const seeMoreButtons = document.querySelectorAll(
      'button.feed-shared-inline-show-more-text__see-more-less-toggle, ' +
      'button.inline-show-more-text__button, ' +
      'button[aria-label*="see more" i], ' +
      'button[aria-label*="Show more" i], ' +
      'button.feed-shared-see-more, ' +
      'button[data-control-name="more_control"]'
    );

    for (const btn of seeMoreButtons) {
      if (btn.offsetParent !== null && !btn.hasAttribute('data-wa-expanded')) {
        try {
          btn.setAttribute('data-wa-expanded', 'true');
          btn.click();
        } catch (e) {}
      }
    }
  }

  // Helper to extract all visible and nested text from a post card
  function getAllTextFromPost(postEl) {
    if (!postEl) return '';
    const parts = [];
    if (postEl.innerText) parts.push(postEl.innerText);
    if (postEl.textContent && postEl.textContent !== postEl.innerText) parts.push(postEl.textContent);

    const textContainers = postEl.querySelectorAll(
      '.feed-shared-update-v2__description, ' +
      '.update-components-text, ' +
      'span.break-words, ' +
      'div[data-testid="expandable-text-box"], ' +
      'span[dir="ltr"], ' +
      '.feed-shared-text, ' +
      '.feed-shared-inline-show-more-text'
    );
    for (const el of textContainers) {
      if (el.innerText) parts.push(el.innerText);
    }

    return parts.join('\n');
  }

  // Scan all visible posts on the page (Non-destructive: keeps all posts in feed)
  function scanCurrentDOMForLeads() {
    expandAllSeeMoreButtons();
    const postElements = findAllPostElements();
    postsSeenCount = postElements.length;

    let newCount = 0;
    let sessionDupes = 0;

    for (const post of postElements) {
      const postText = getAllTextFromPost(post).trim();
      if (!postText) continue;

      // 1. Skip job seekers and posts that mention an ignored keyword. A post that carried a phone number is
      //    listed and marked in red with the reason ("WhatsApp found · skipped: job seeker").
      const isSeeker = settings.filterJobSeekers && isJobSeekerPost(post, postText);
      const ignoredWord = isSeeker ? '' : cpOwMatchIgnoreKeyword(postText, settings.ignoreKeywords);
      if (isSeeker || ignoredWord) {
        // Only worth listing when the post carried a phone number (it would have been a lead otherwise).
        if (extractPhoneNumbersFromPost(post, postText).length > 0) {
          recordSkip({ keyBase: stablePostKey(post, postText), name: getPostAuthor(post), title: extractJobTitle(postText, 'Job'), company: extractCompany(post, postText), reason: isSeeker ? 'Job seeker post (#OpenToWork)' : `Ignored keyword: ${ignoredWord}` });
          cpOwMarkSkippedPost(post, { label: 'WhatsApp found', reason: isSeeker ? 'job seeker' : `ignored keyword "${ignoredWord}"` });
        }
        continue;
      }

      // 2. Extract Phone / WhatsApp Numbers from text & links
      const phones = extractPhoneNumbersFromPost(post, postText);
      if (!phones || phones.length === 0) {
        // Only hiring-style posts are listed; the rest of the feed is just not relevant.
        if (hasHiringSignals(postText)) {
          recordSkip({ keyBase: stablePostKey(post, postText), name: getPostAuthor(post), company: extractCompany(post, postText), reason: 'No phone number in the post' });
        }
        continue;
      }

      // 3. Match Job Titles & Keywords
      const matchedKeyword = matchTargetKeywords(postText);
      if (!matchedKeyword && !settings.matchAllHiringPosts) {
        recordSkip({ keyBase: stablePostKey(post, postText), name: getPostAuthor(post), company: extractCompany(post, postText), reason: 'Does not match your keywords' });
        continue;
      }

      // 4. Extract Post Details
      const urn = getPostUrn(post);
      const author = getPostAuthor(post);
      const company = extractCompany(post, postText);
      const jobTitle = extractJobTitle(postText, matchedKeyword || 'Job Role');

      for (const phone of phones) {
        const cleanPhone = cleanPhoneNumber(phone);
        if (!cleanPhone || cleanPhone.length < 10) {
          recordSkip({ keyBase: `${urn}|${phone}`, id: urn, name: author, title: jobTitle, company, reason: 'Invalid phone number' });
          continue;
        }

        // Check if phone was already contacted
        const isContacted = contactedPhones.has(cleanPhone);

        // Check if already in extractedLeads (Duplicate)
        const existingLead = extractedLeads.find(l => l.cleanPhone === cleanPhone || (urn && l.urn === urn && l.cleanPhone === cleanPhone));
        if (existingLead) {
          injectPostActionBadge(post, existingLead);
          if (existingLead.status === 'sent' || isContacted) {
            const fresh = recordSkip({ keyBase: `${urn}|${cleanPhone}`, id: existingLead.id, name: existingLead.recruiterName || author, title: existingLead.jobTitle || jobTitle, company: existingLead.company || company, reason: 'Already messaged this number' });
            if (fresh) duplicateCount++;
          }
          continue;
        }

        const lead = {
          id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          urn: urn,
          recruiterName: author,
          jobTitle: jobTitle,
          company: company,
          phone: phone,
          cleanPhone: cleanPhone,
          matchedKeyword: matchedKeyword || 'Hiring Post',
          postSnippet: postText.slice(0, 220).replace(/\s+/g, ' '),
          timestamp: new Date().toISOString(),
          status: isContacted ? 'sent' : 'pending'
        };

        extractedLeads.unshift(lead);
        newCount++;


        // Save to background
        chrome.runtime.sendMessage({
          type: 'SAVE_LEAD',
          payload: lead
        }).catch(() => {});

        // Inject simple single-row action badge onto the post
        injectPostActionBadge(post, lead);
      }
    }

    if (newCount > 0) {
      chrome.storage.local.set({
        waLeads: extractedLeads,
        duplicateStats: { skippedCount: duplicateCount }
      });
    }
    flushSkipped();
    updateStatsBar();

    return newCount;
  }

  // Inject clean single-row in-feed WhatsApp action badge on the LinkedIn post (Stable - no jitter)
  function injectPostActionBadge(postEl, lead) {
    if (!lead || !postEl) return;
    const isSent = lead.status === 'sent' || contactedPhones.has(lead.cleanPhone);

    const existing = postEl.querySelector('.li-wa-post-badge, .li-wa-post-review-card');
    if (existing) {
      const currentLeadPhone = postEl.getAttribute('data-wa-lead-phone');
      const isSentMarked = existing.getAttribute('data-sent') === 'true';
      if (currentLeadPhone === lead.cleanPhone && isSent === isSentMarked) {
        return; // Fully stable, already rendered with up-to-date status!
      }
      existing.remove();
    }

    postEl.setAttribute('data-wa-lead-phone', lead.cleanPhone);

    const badge = document.createElement('div');
    badge.className = 'li-wa-post-badge';
    badge.setAttribute('data-sent', isSent ? 'true' : 'false');
    badge.innerHTML = `
      <div class="badge-content" style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:10px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span class="badge-tag" style="font-size:12px; font-weight:700; color:#38bdf8;">
            ${escapeHtml(lead.recruiterName)} &bull; ${escapeHtml(lead.jobTitle)}
          </span>
          <span style="font-size:11px; font-weight:700; color:#25D366;">+${lead.cleanPhone}</span>
          ${isSent ? '<span style="font-size:10px; color:#22c55e; background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.3); padding:2px 7px; border-radius:10px; font-weight:600;">Contacted</span>' : '<span style="font-size:10px; color:#fbbf24; background:rgba(251,191,36,0.15); border:1px solid rgba(251,191,36,0.3); padding:2px 7px; border-radius:10px; font-weight:600;">WhatsApp Lead</span>'}
        </div>
        <button class="badge-wa-btn" id="btn-badge-send-${lead.id}" style="background:#25D366; color:#052e16; border:none; border-radius:6px; padding:6px 13px; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:5px; transition:all 0.2s;" title="Open WhatsApp Web chat to manually check and send message">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2z"/></svg>
          <span>${isSent ? 'Re-Open WhatsApp' : 'Open WhatsApp (+Message)'}</span>
        </button>
      </div>
    `;

    badge.querySelector(`#btn-badge-send-${lead.id}`)?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      dispatchOutreach(lead, postEl);
    });

    postEl.insertBefore(badge, postEl.firstChild);
  }

  function getPostRootElement(el) {
    if (!el || !(el instanceof Element)) return el;
    const candidate = el.closest('div.feed-shared-update-v2, div[data-view-name="search-entity-result-universal-template"], div.occludable-update, li.search-results__list-item, div[role="listitem"]');
    return candidate || el;
  }

  function hideNonWhatsAppPostCard(cardEl) {}
  function hideAlreadyContactedPostCard(cardEl) {}
  function unhideWhatsAppPostCard(cardEl) {}

  function animateCardRemoval(cardEl) {
    if (!cardEl) return;
    try {
      const root = getPostRootElement(cardEl);
      if (!root) return;
      root.style.transition = 'all 0.5s ease';
      root.style.opacity = '0';
      root.style.maxHeight = root.offsetHeight + 'px';
      setTimeout(() => {
        root.style.maxHeight = '0px';
        root.style.margin = '0px';
        root.style.padding = '0px';
        root.style.overflow = 'hidden';
        setTimeout(() => {
          root.style.display = 'none';
        }, 500);
      }, 100);
    } catch {}
  }

  function removeOrCollapseSentPostCard(phone, urn = '') {
    if (!settings.removeSentPostFromFeed) return;
    const clean = cleanPhoneNumber(phone);
    const posts = findAllPostElements();
    for (const post of posts) {
      const pPhone = post.getAttribute('data-wa-lead-phone');
      const pUrn = getPostUrn(post);
      if ((clean && pPhone === clean) || (urn && pUrn === urn)) {
        animateCardRemoval(post);
      }
    }
  }

  // ── EXTRACTION & MATCHING HELPERS ─────────────────────────────────────────

  function extractPhoneNumbersFromPost(postEl, text) {
    const results = new Set();
    const fullText = (text || '') + '\n' + getAllTextFromPost(postEl);

    // 1. Extract from <a> tags containing wa.me or whatsapp.com links or tel:
    const waLinks = postEl.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp.com"], a[href*="tel:"]');
    for (const link of waLinks) {
      const href = link.getAttribute('href') || '';
      const match = href.match(/(?:phone=|wa\.me\/|send\?phone=|tel:)(\+?\d{10,15})/i);
      if (match && match[1]) {
        const clean = cleanPhoneNumber(match[1]);
        if (isValidMobileNumber(clean)) {
          results.add(clean);
        }
      }
    }

    if (fullText) {
      // 2. Look for explicit WhatsApp / call prefix keywords in text
      let match;
      const prefixRegex = new RegExp(PREFIXED_PHONE_REGEX);
      while ((match = prefixRegex.exec(fullText)) !== null) {
        if (match[1]) {
          const clean = cleanPhoneNumber(match[1]);
          if (isValidMobileNumber(clean)) {
            results.add(clean);
          }
        }
      }

      // 3. Scan phone regex with country code (+91, 91, 0)
      const m1 = fullText.match(PHONE_REGEX_WITH_CODE) || [];
      for (const raw of m1) {
        const clean = cleanPhoneNumber(raw);
        if (isValidMobileNumber(clean)) {
          results.add(clean);
        }
      }

      // 4. Scan standalone 10-digit Indian numbers (starts with 6-9)
      const m2Regex = new RegExp(PHONE_REGEX_STANDALONE);
      while ((match = m2Regex.exec(fullText)) !== null) {
        if (match[1]) {
          const clean = cleanPhoneNumber(match[1]);
          if (isValidMobileNumber(clean)) {
            results.add(clean);
          }
        }
      }
    }

    return Array.from(results);
  }

  function isValidMobileNumber(clean) {
    if (!clean) return false;
    // Exclude timestamp/epoch IDs (e.g. 1788957900000)
    if (clean.length === 13 && clean.startsWith('17')) return false;

    // Exclude repeated invalid dummy strings (e.g. 1234567890, 9999999999)
    if (/^(\d)\1{9,}$/.test(clean)) return false;
    if (clean === '911234567890' || clean === '1234567890') return false;

    // Valid Indian mobile: 12 digits starting with 91 followed by [6-9]
    if (clean.length === 12 && clean.startsWith('91')) {
      const localPart = clean.substring(2);
      return /^[6-9]\d{9}$/.test(localPart);
    }
    // Standard 10 digit Indian number starting with [6-9]
    if (clean.length === 10 && /^[6-9]\d{9}$/.test(clean)) {
      return true;
    }
    // Generic international number (11-14 digits)
    if (clean.length >= 10 && clean.length <= 14 && /^\d+$/.test(clean)) {
      return true;
    }
    return false;
  }

  function matchTargetKeywords(text) {
    if (!settings.targetKeywords || settings.targetKeywords.length === 0) return 'Job Role';
    const lower = text.toLowerCase();
    for (const kw of settings.targetKeywords) {
      const cleanKw = kw.trim().toLowerCase();
      if (!cleanKw) continue;
      const pattern = new RegExp(`\\b${escapeRegExp(cleanKw)}\\b`, 'i');
      if (pattern.test(lower) || lower.includes(cleanKw)) {
        return cleanKw;
      }
    }
    return null;
  }

  function hasHiringSignals(text) {
    for (const pat of HIRING_INDICATORS) {
      if (pat.test(text)) return true;
    }
    return false;
  }

  function isJobSeekerPost(postEl, text) {
    const fullText = (text || '') + '\n' + getAllTextFromPost(postEl);

    // 0. Recruiter / Hiring signals STRICTLY OVERRIDE job seeker checks!
    if (hasHiringSignals(fullText)) {
      return false;
    }

    // 1. Check Profile Picture Frame / Badges for #OpenToWork
    const profileImg = postEl.querySelector('img[alt*="open to work" i], figure[aria-label*="open to work" i], img[src*="profile-framedphoto"]');
    if (profileImg) {
      return true;
    }

    // 2. Check Profile link / Actor aria-labels
    const profileLinks = postEl.querySelectorAll('a[href*="/in/"], div[aria-label*="open to work" i]');
    for (const link of profileLinks) {
      const aria = (link.getAttribute('aria-label') || '').toLowerCase();
      if (aria.includes('open to work') || aria.includes('open to opportunities')) {
        return true;
      }
    }

    // 3. Check Actor Title / Headline
    const actorDesc = postEl.querySelector('.update-components-actor__description, .feed-shared-actor__description');
    if (actorDesc) {
      const descText = (actorDesc.innerText || '').toLowerCase();
      const isRecruiterHeadline = descText.includes('recruiter') || descText.includes('talent') || descText.includes('hr ') || descText.includes('hiring') || descText.includes('founder') || descText.includes('ceo');
      if (!isRecruiterHeadline) {
        if (
          descText.includes('open to work') ||
          descText.includes('immediate joiner') ||
          descText.includes('seeking opportunities') ||
          descText.includes('actively looking for job') ||
          descText.includes('aspiring developer')
        ) {
          return true;
        }
      }
    }

    // 4. Check strict 1st person Job Seeker phrases in body text
    for (const pattern of JOB_SEEKER_PATTERNS) {
      if (pattern.test(fullText)) {
        return true;
      }
    }

    return false;
  }

  function extractJobTitle(text, fallbackKeyword) {
    // Look for lines like "Position: Solar Service Engineer", "Role: WordPress Developer", "#Hiring - Web Developer"
    const titlePatterns = [
      /(?:position|role|designation|job\s*role|hiring\s*for|opening\s*for)\s*[:\-–]\s*([^\n\r,•|]+)/i,
      /#(?:hiring|urgentrequirement|urgentopening)\s*[–\-:]*\s*([^\n\r,•|#]+)/i,
      /looking\s*for\s*(?:passionate|experienced|motivated|immediate)?\s*([a-zA-Z\s]{3,35}\b(?:engineer|developer|trainee|technician|designer|manager|specialist|electrician|officer|executive|fresher))\b/i
    ];

    for (const pat of titlePatterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        const clean = match[1].trim().replace(/^[^a-zA-Z0-9]+/, '');
        if (clean.length > 2 && clean.length < 40) {
          return clean;
        }
      }
    }

    // Capitalize fallback keyword
    return fallbackKeyword
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ') + ' Role';
  }

  function extractCompany(postEl, text) {
    // Check for company links or mentions
    const companyLink = postEl.querySelector('a[href*="/company/"]');
    if (companyLink && companyLink.innerText.trim()) {
      return companyLink.innerText.trim().split('\n')[0];
    }

    const compMatch = text.match(/(?:at|with|for)\s+([A-Z][a-zA-Z0-9\s&]{2,25}(?:Pvt|Ltd|Technologies|Solutions|Power|Services|Limited|Corp|India|LLP))/i);
    if (compMatch && compMatch[1]) {
      return compMatch[1].trim();
    }

    return '';
  }

  function cleanPhoneNumber(raw) {
    if (!raw) return '';
    let digits = raw.replace(/\D/g, '');
    if (digits.length === 10) {
      digits = '91' + digits;
    } else if (digits.length === 11 && digits.startsWith('0')) {
      digits = '91' + digits.substring(1);
    }
    return digits;
  }

  function findAllPostElements() {
    const postSelectors = [
      'div[role="listitem"][componentkey*="update-card"]',
      'div[componentkey*="update-card-focus"]',
      'div[id^="expanded"][componentkey^="expanded"]',
      'div[data-testid="lazy-column"] > div > div > div[id^="expanded"]',
      'div.feed-shared-update-v2',
      'div[data-urn*="urn:li:activity:"]',
      'div[data-urn*="urn:li:ugcPost:"]',
      'div.occludable-update',
      'div[data-id*="urn:li:"]',
      'div[data-view-name="search-entity-result-universal-template"]',
      'div[data-view-name="feed-full-update"]',
      'div[data-view-name="feed-update"]',
      'div.fie-impression-container',
      'li.search-results__list-item',
      'li.reusable-search__result-container'
    ];
    let rawElements = Array.from(document.querySelectorAll(postSelectors.join(', ')));

    // Fallback if LinkedIn SDUI changes
    if (rawElements.length === 0) {
      const actors = document.querySelectorAll('.update-components-actor, .feed-shared-actor');
      for (const actor of actors) {
        const card = actor.closest('div.feed-shared-update-v2, div[role="listitem"], li.search-results__list-item, div.occludable-update, article');
        if (card && !rawElements.includes(card)) {
          rawElements.push(card);
        }
      }
    }

    // Filter to keep only the innermost post containers (discard parents containing other post cards)
    const uniquePosts = rawElements.filter((el, i, arr) => !arr.some((other, j) => i !== j && el.contains(other)));
    return uniquePosts;
  }

  function getPostUrn(postEl) {
    return postEl.getAttribute('componentkey') || postEl.id || postEl.getAttribute('data-urn') || postEl.getAttribute('data-chameleon-result-urn') || `urn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  function getPostAuthor(postEl) {
    const sduiProfile = postEl.querySelector('a[href*="/in/"], a[href*="/company/"]');
    if (sduiProfile) {
      const nameEl = sduiProfile.querySelector('p span, div span') || sduiProfile;
      const txt = (nameEl.innerText || '').trim().split('\n')[0];
      if (txt && !txt.toLowerCase().includes('view') && !txt.toLowerCase().includes('profile')) {
        return txt;
      }
    }
    const authorEl = postEl.querySelector('.update-components-actor__name, .feed-shared-actor__name, a.app-aware-link > span[dir="ltr"]');
    return authorEl ? authorEl.innerText.trim().split('\n')[0] : 'Hiring Manager';
  }

  // ── ACTIONS & RENDERING ───────────────────────────────────────────────────

  let isAutoSending = false;
  // Dispatch refusals from the background billing check that stop the whole batch.
  const OUTREACH_STOP_REASONS = ['NO_TEMPLATE', 'INSUFFICIENT_HIRES', 'NOT_SIGNED_IN', 'PORTAL_UNREACHABLE', 'RATE_LIMITED'];

  function dispatchOutreach(lead, originPostEl = null, forceAutoSend = false) {
    return new Promise((resolve) => {
      if (blockedByEmptyMessage()) {
        resolve({ success: false, error: 'No message written in the dashboard', reason: 'NO_TEMPLATE' });
        return;
      }
      logTerminal(`Opening WhatsApp for ${lead.recruiterName} (+${lead.cleanPhone})...`, 'info');

      lead.status = 'sending';
      renderLeadsList();

      const shouldAutoSend = forceAutoSend || (settings.autoSendWhatsApp !== false);
      const shouldAutoClose = settings.autoCloseTab !== false;

      chrome.runtime.sendMessage({
        type: 'DISPATCH_WHATSAPP_MESSAGE',
        payload: {
          ...lead,
          autoSend: shouldAutoSend,
          autoClose: shouldAutoClose
        }
      }, (response) => {
        if (response && response.success) {
          logTerminal(`WhatsApp Web opened for +${lead.cleanPhone}!`, 'success');

          // If card was clicked directly on LinkedIn and removal is enabled, collapse it
          if (originPostEl && settings.removeSentPostFromFeed) {
            setTimeout(() => {
              animateCardRemoval(originPostEl);
            }, 600);
          }
          resolve({ success: true, tabId: response.tabId });
        } else {
          logTerminal(`Failed to dispatch WhatsApp: ${response?.error || 'Unknown error'}`, 'error');
          if (response?.reason === 'INSUFFICIENT_HIRES') {
            logTerminal(`Each WhatsApp message costs 1 Hire. Top up: ${response.topUpUrl || 'AutoApply CV dashboard > Billing'}`, 'warning');
          }
          lead.status = 'pending';
          renderLeadsList();
          resolve({ success: false, error: response?.error, reason: response?.reason });
        }
      });
    });
  }

  async function dispatchOutreachAndWait(lead, originPostEl = null) {
    // Start outreach with autoSend confirmed
    const res = await dispatchOutreach(lead, originPostEl, true);
    if (!res || !res.success || !res.tabId) {
      return res;
    }

    const tabId = res.tabId;
    logTerminal(`Processing auto-send for +${lead.cleanPhone} (waiting for dispatch & tab completion)...`, 'info');

    // Wait until the message is confirmed sent OR the tab completes/closes (up to 120s for slow network)
    const startTime = Date.now();
    const maxWaitMs = 120000;

    while (Date.now() - startTime < maxWaitMs) {
      if (!isAutoSending) break;
      await sleep(1000);

      // 1. Check if lead was marked sent in memory / storage
      if (contactedPhones.has(lead.cleanPhone)) {
        logTerminal(`Outreach confirmed sent to +${lead.cleanPhone}!`, 'success');
        break;
      }

      // 2. Check if lead was marked invalid (Not on WhatsApp)
      const invData = await chrome.storage.local.get(['invalidPhones']);
      if (invData.invalidPhones && invData.invalidPhones.includes(lead.cleanPhone)) {
        logTerminal(`Recruiter (+${lead.cleanPhone}) isn't on WhatsApp. Skipping lead...`, 'error');
        lead.status = 'invalid';
        recordSkip({ keyBase: lead.cleanPhone, id: lead.id, name: lead.recruiterName, title: lead.jobTitle, company: lead.company, reason: 'Invalid phone number (not on WhatsApp)' });
        flushSkipped();
        break;
      }

      // 3. Check if the tab has closed
      try {
        const isTabOpen = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'WA_CHECK_TAB_STATUS',
            payload: { tabId }
          }, (resp) => {
            resolve(resp && Boolean(resp.open));
          });
        });

        if (!isTabOpen) {
          logTerminal(`WhatsApp tab finished & closed for +${lead.cleanPhone}.`, 'info');
          break;
        }
      } catch {
        break;
      }
    }

    // Ensure lead status is marked in UI
    const invDataFinal = await chrome.storage.local.get(['invalidPhones']);
    if (invDataFinal.invalidPhones && invDataFinal.invalidPhones.includes(lead.cleanPhone)) {
      lead.status = 'invalid';
      recordSkip({ keyBase: lead.cleanPhone, id: lead.id, name: lead.recruiterName, title: lead.jobTitle, company: lead.company, reason: 'Invalid phone number (not on WhatsApp)' });
      flushSkipped();
    } else if (contactedPhones.has(lead.cleanPhone)) {
      lead.status = 'sent';
      if (!lead.sentAt) lead.sentAt = new Date().toISOString();
    } else {
      // If time expired or user closed early, check storage once
      const data = await chrome.storage.local.get(['contactedPhones']);
      if (data.contactedPhones && data.contactedPhones.includes(lead.cleanPhone)) {
        contactedPhones.add(lead.cleanPhone);
        lead.status = 'sent';
        if (!lead.sentAt) lead.sentAt = new Date().toISOString();
      }
    }
    renderLeadsList();

    // Close tab if still open and autoCloseTab is on
    if (tabId && settings.autoCloseTab !== false) {
      try {
        await chrome.runtime.sendMessage({
          type: 'WA_CLOSE_TAB_ID',
          payload: { tabId }
        });
      } catch {}
    }

    // Graceful cooldown between messages
    const cooldown = Math.max(2, (settings.delayBetweenMessages || 4));
    logTerminal(`Pausing ${cooldown}s before next contact...`, 'info');
    await sleep(cooldown * 1000);
    return res;
  }

  async function startAutoSendingQueue() {
    if (isAutoSending) {
      stopAutoSendingQueue();
      return;
    }
    if (blockedByEmptyMessage()) return;

    let pendingLeads = pendingLeadList();

    if (pendingLeads.length === 0) {
      logTerminal('Scanning feed for verified WhatsApp hiring posts first...', 'info');
      expandAllSeeMoreButtons();
      scanCurrentDOMForLeads();
      renderLeadsList();
      pendingLeads = pendingLeadList();
    }

    if (pendingLeads.length === 0) {
      logTerminal('No verified WhatsApp hiring leads found. Try searching keywords or scrolling feed.', 'warning');
      if (ui) ui.setTab('activity');
      return;
    }

    isAutoSending = true;
    isPaused = false;
    sendProgress = '';
    updateUi();
    logTerminal(`Starting Single-Tab Auto-Outreach to ${pendingLeads.length} recruiter(s)...`, 'success');

    for (let i = 0; i < pendingLeads.length; i++) {
      while (isPaused && isAutoSending) await sleep(500);
      if (!isAutoSending) {
        logTerminal('Auto-sending stopped by user.', 'warning');
        break;
      }

      const lead = pendingLeads[i];
      if (contactedPhones.has(lead.cleanPhone)) {
        logTerminal(`Skipping +${lead.cleanPhone} (Already contacted).`, 'info');
        lead.status = 'sent';
        continue;
      }

      sendProgress = `${i + 1}/${pendingLeads.length}`;
      updateUi();
      logTerminal(`[${i + 1}/${pendingLeads.length}] Processing WhatsApp for ${lead.recruiterName} (+${lead.cleanPhone})...`, 'info');

      // Move focus to the corresponding LinkedIn post and sidebar lead row
      const targetPost = findPostElementForLead(lead);
      if (targetPost) {
        focusAndHighlightPost(targetPost, '#25D366');
      }

      // Strictly open one tab at a time and wait for it to finish!
      const result = await dispatchOutreachAndWait(lead);
      // Out of Hires / signed out / portal down: every next lead would be refused too.
      if (result && OUTREACH_STOP_REASONS.includes(result.reason)) {
        stopAutoSendingQueue();
        return;
      }
    }

    isAutoSending = false;
    isPaused = false;
    sendProgress = '';
    updateUi();
    renderLeadsList();
    logTerminal('Auto-Outreach queue completed! All leads processed one by one.', 'success');
  }

  function stopAutoSendingQueue() {
    isAutoSending = false;
    isPaused = false;
    sendProgress = '';
    updateUi();
    renderLeadsList();
    logTerminal('Auto-Outreach queue stopped.', 'warning');
  }

  function exportLeadsToCSV() {
    if (extractedLeads.length === 0) {
      logTerminal('No leads available to export yet.', 'warning');
      return;
    }

    const headers = ['Recruiter Name', 'Company', 'Job Title', 'Phone Number', 'Status', 'Extracted At', 'Post Snippet'];
    const rows = extractedLeads.map(l => [
      `"${(l.recruiterName || '').replace(/"/g, '""')}"`,
      `"${(l.company || '').replace(/"/g, '""')}"`,
      `"${(l.jobTitle || '').replace(/"/g, '""')}"`,
      `"+${l.cleanPhone}"`,
      `"${l.status}"`,
      `"${l.timestamp}"`,
      `"${(l.postSnippet || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `linkedin_whatsapp_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logTerminal(`Exported ${extractedLeads.length} leads to CSV file!`, 'success');
  }

  // Activity feed: newest first, last ACTIVITY_CAP lines. Replaces the old terminal log.
  function logTerminal(text, type = 'info') {
    const clean = String(text || '')
      .replace(/[\u{1F000}-\u{1FFFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) return;
    activityLog.unshift({ text: clean, type, ts: Date.now() });
    if (activityLog.length > ACTIVITY_CAP) activityLog.length = ACTIVITY_CAP;
    if (ui && ui.tab === 'activity') renderLeadsList();
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Passive scanning is for feed/post pages. On /jobs it would click "Show more" in job
  // descriptions and rescan the page on every change, which makes the jobs page heavy.
  function passiveScanAllowed() {
    return !window.location.pathname.startsWith('/jobs') && !document.hidden;
  }

  function passiveScan({ render = true } = {}) {
    if (!passiveScanAllowed()) return;
    expandAllSeeMoreButtons();
    scanCurrentDOMForLeads();
    if (render) renderLeadsList();
  }

  // Periodic passive DOM scan observer
  function setupDOMObserver() {
    let debounceTimer = null;
    const observer = new MutationObserver((records) => {
      if (!passiveScanAllowed()) return;
      // Ignore changes inside our own widget (renderLeadsList would otherwise retrigger us).
      if (records.every((r) => r.target?.closest?.('#li-wa-widget'))) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!isScanning) passiveScan();
      }, 1500);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // SPA navigation detector
  function setupHistoryListener() {
    let lastUrl = window.location.href;
    const historyTimer = setInterval(() => {
      if (!chrome?.runtime?.id) {
        clearInterval(historyTimer);
        return;
      }
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        logTerminal(`Navigated to: ${window.location.pathname}`, 'info');
        setTimeout(() => passiveScan(), 2000);
      }
    }, 1000);
  }

  // Message listener for broadcast from background or WhatsApp Web
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'TRIGGER_AUTO_SEND_ALL') {
        // Started from the popup: bring the panel up so the run is visible.
        cpOwRememberModule('whatsapp');
        checkModuleVisibility();
        startAutoSendingQueue();
        sendResponse({ success: true });
        return;
      }

      if (request.type === 'LEAD_MESSAGE_SENT') {
        const { phone, urn } = request.payload || {};
        if (phone) {
          contactedPhones.add(phone);
          extractedLeads = extractedLeads.map(l => {
            if (l.cleanPhone === phone) return { ...l, status: 'sent', sentAt: l.sentAt || new Date().toISOString() };
            return l;
          });
          chrome.storage.local.set({ waLeads: extractedLeads, contactedPhones: Array.from(contactedPhones) });
          renderLeadsList();
          removeOrCollapseSentPostCard(phone, urn);
        }
      }
    });

    // When returning to this LinkedIn tab from WhatsApp tab, re-sync and remove sent cards
    window.addEventListener('focus', async () => {
      await loadStorage();
      renderQuickChips();
      renderContactedChip();
      refreshTemplateNote();
      renderLeadsList();
      // Remove any posts that have been contacted from DOM
      contactedPhones.forEach(phone => {
        removeOrCollapseSentPostCard(phone);
      });
    });
  }

  // Init
  async function init() {
    await loadStorage();
    setupSettingsListener();
    injectFloatingWidget();
    checkModuleVisibility();
    window.addEventListener('hashchange', () => {
      checkModuleVisibility();
      setTimeout(() => passiveScan(), 500);
    });
    setupDOMObserver();
    setupHistoryListener();
    setupMessageListener();

    // Window scroll listener for continuous passive scanning
    let scrollDebounce = null;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollDebounce);
      scrollDebounce = setTimeout(() => passiveScan({ render: false }), 800);
    }, { passive: true });

    // Progressive initial scans for dynamic AJAX content loading
    [500, 1200, 2500, 4500, 7000].forEach((delay) => {
      setTimeout(() => passiveScan(), delay);
    });
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
