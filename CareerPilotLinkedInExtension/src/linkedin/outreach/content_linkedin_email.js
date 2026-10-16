/**
 * LinkedIn to Email Job Outreach Pro - LinkedIn Content Script
 * Robust scraper with obfuscated email detection, duplicate tracking,
 * Gmail Web Compose & Default Mailto dispatching, and in-feed post badges.
 */

(function () {
  'use strict';

  if (window.__linkedInEmailOutreachInjected) return;
  window.__linkedInEmailOutreachInjected = true;


  // The dashboard (Auto Apply > Messages) writes the real values into chrome.storage.local "emailSettings".
  // Nothing personal is hard-coded here: until the user writes a subject and message, sending is blocked.
  const DEFAULT_SETTINGS = {
    targetKeywords: [],
    subjectTemplate: '',
    messageTemplate: '',
    emailClient: 'gmail_web', // 'gmail_web' or 'mailto'
    autoSendEmail: true,
    autoCloseTab: true,
    autoLikePosts: false,
    showAlreadyContacted: true,
    filterJobSeekers: true,
    autoScroll: true,
    matchAllHiringPosts: true,
    removeSentPostFromFeed: false,
    hideNonEmailPosts: false,
    debugMode: true,
    delayBetweenEmails: 5
  };

  let settings = { ...DEFAULT_SETTINGS };

  let extractedLeads = [];
  let contactedEmails = new Set();
  let duplicateCount = 0;
  let isScanning = false;
  let isPaused = false;
  let postsSeen = 0;
  let currentTab = 'pending';

  // Widget state
  const WIDGET_ID = 'li-email-widget';
  const MAX_ACTIVITY = 100;
  const MAX_SKIPPED = 200;
  let ui = null; // controller returned by cpOwInit
  let skippedItems = []; // newest first: { id, name, title, company, reason, ts }
  const skippedKeys = new Set();
  let activityLog = []; // newest first: { msg, type, ts }
  let sendingNow = null; // { index, total, name, email, sent } while the batch queue runs
  let skippedSaveTimer = null;
  let renderTimer = null;
  let lastSetupHtml = null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


  // Comprehensive Email regexes & patterns
  const STANDARD_EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/gi;
  // Obfuscated emails: e.g. "name [at] company [dot] com", "name(at)company(dot)com", "name at company dot com"
  const OBFUSCATED_EMAIL_REGEX = /([a-zA-Z0-9._%+\-]+)\s*(?:\[at\]|\(at\)|\bat\b|@)\s*([a-zA-Z0-9.\-]+)\s*(?:\[dot\]|\(dot\)|\bdot\b|\.)\s*([a-zA-Z]{2,10})/gi;

  const IGNORED_DOMAINS = [
    'example.com',
    'sentry.io',
    'domain.com',
    'email.com',
    'yourcompany.com',
    'test.com',
    'company.com',
    'wixpress.com',
    'linkedin.com',
    'licdn.com'
  ];

  // Job Seeker patterns to filter out
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

  // Recruiter / hiring indicators (Takes precedence over job seeker filters)
  const HIRING_INDICATORS = [
    /\b(?:we\s*are\s*hiring|we're\s*hiring|actively\s*hiring|urgent\s*hiring|hiring\s*alert|company\s*is\s*hiring)\b/i,
    /\b(?:openings?\s*for|hiring\s*for|requirements?\s*for|urgent\s*requirement|urgent\s*opening)\b/i,
    /\b(?:share\s*(?:your\s*)?(?:cv|resume|profile)|send\s*(?:your\s*)?(?:cv|resume|profile)|mail\s*(?:your\s*)?(?:cv|resume|profile))\s*(?:to|at|on|via|email)\b/i,
    /\b(?:drop\s*(?:your\s*)?(?:cv|resume|profile)\s*(?:at|to|on))\b/i,
    /\b(?:email\s*(?:your\s*cv|resume|profile|at|to|us|me))\b/i,
    /\binterested\s*candidates?\s*(?:can|please)?\s*(?:share|send|apply|email|mail|reach)\b/i,
    /\b(?:job\s*location|work\s*location|salary\s*package|ctc\s*:|stipend\s*:|experience\s*required)\b/i,
    /\b(?:apply\s*here|apply\s*now|mail\s*cv|send\s*resume)\b/i,
    /\b(?:hiring|vacancy|openings?)\b/i
  ];

  function mergeSettings(raw) {
    const merged = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
    merged.targetKeywords = Array.isArray(merged.targetKeywords)
      ? merged.targetKeywords.map((k) => String(k || '').trim()).filter(Boolean)
      : [];
    merged.subjectTemplate = typeof merged.subjectTemplate === 'string' ? merged.subjectTemplate : '';
    merged.messageTemplate = typeof merged.messageTemplate === 'string' ? merged.messageTemplate : '';
    return merged;
  }

  function templatesReady() {
    return Boolean((settings.subjectTemplate || '').trim() && (settings.messageTemplate || '').trim());
  }

  // Load storage
  async function loadStorage() {
    // Disconnected after an extension reload: storage is gone until the tab is refreshed.
    if (!chrome?.runtime?.id) return;
    try {
      const data = await chrome.storage.local.get(['emailSettings', 'emailLeads', 'contactedEmails', 'duplicateEmailStats', 'emailSkipped']);
      settings = mergeSettings(data.emailSettings);
      if (Array.isArray(data.emailLeads)) extractedLeads = data.emailLeads;
      if (Array.isArray(data.contactedEmails)) contactedEmails = new Set(data.contactedEmails.map(e => String(e).toLowerCase().trim()));
      if (data.duplicateEmailStats && typeof data.duplicateEmailStats.skippedCount === 'number') {
        duplicateCount = data.duplicateEmailStats.skippedCount;
      }
      if (Array.isArray(data.emailSkipped)) {
        skippedItems = data.emailSkipped.slice(0, MAX_SKIPPED);
        skippedItems.forEach((s) => skippedKeys.add(`${s.reason}|${s.id}`));
      }
    } catch (e) {
      console.error('[LinkedIn-Email] Load storage error:', e);
    }
  }

  // Keep `settings` fresh when the dashboard changes it (written through the extension background).
  function watchSettings() {
    if (!chrome?.storage?.onChanged) return;
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes.emailSettings) return;
      settings = mergeSettings(changes.emailSettings.newValue);
      lastSetupHtml = null;
      renderChips();
      scheduleRender();
    });
  }

  // ── FLOATING WIDGET UI ────────────────────────────────────────────────────

  let positionedBesideOthers = false;

  // Shown only when Email outreach was asked for in this tab (see cpOwRequestedModule in outreach_ui.js).
  function checkModuleVisibility() {
    if (!ui) return;
    if (cpOwRequestedModule() === 'email') {
      ui.show();
      nudgeBesideOthers();
    } else {
      ui.hide();
    }
  }

  // When another outreach widget is already open in the corner, sit to its left instead of on top of it.
  function nudgeBesideOthers() {
    if (positionedBesideOthers || !ui || ui.root.style.left) return;
    const other = Array.from(document.querySelectorAll('.cp-ow.is-visible')).find((el) => el !== ui.root);
    if (other) {
      ui.root.style.right = '444px';
      positionedBesideOthers = true;
    }
  }

  function injectFloatingWidget() {
    if (document.getElementById(WIDGET_ID)) return;

    const controls = `
      <div class="cp-ow-search">
        <input type="text" id="cp-email-query" class="cp-ow-input" placeholder="Search hiring posts, e.g. react developer email" autocomplete="off" />
        ${cpOwButton({ id: 'cp-email-search', label: 'Search', icon: 'search' })}
      </div>
      <div class="cp-ow-chips" id="cp-email-chips"></div>
      ${cpOwQuickRow('cp-email', { start: 'Scan feed', pause: 'Pause', stop: 'Stop' })}
      <div class="cp-ow-quick is-two">
        ${cpOwButton({ id: 'cp-email-scroll', label: 'Full auto-scroll', icon: 'scroll', kind: 'ghost' })}
        ${cpOwButton({ id: 'cp-email-send', label: 'Send queue', icon: 'mail', kind: 'ghost' })}
      </div>
      ${cpOwStats([
        { id: 'seen', label: 'Cards seen', value: 0 },
        { id: 'matched', label: 'Matched', value: 0 },
        { id: 'sent', label: 'Sent', value: 0 },
        { id: 'dupes', label: 'Duplicates', value: 0 }
      ])}
      <div id="cp-email-setup"></div>
      <div class="cp-ow-quick is-two">
        ${cpOwButton({ id: 'cp-email-csv', label: 'Export CSV', icon: 'download', kind: 'ghost', title: 'Export leads to CSV' })}
        ${cpOwButton({ id: 'cp-email-clear', label: 'Clear pending', icon: 'trash', kind: 'ghost', title: 'Remove leads that are not emailed yet' })}
      </div>`;

    const holder = document.createElement('div');
    holder.innerHTML = cpOwShell({
      id: WIDGET_ID,
      title: 'Email Outreach',
      subtitle: 'Email recruiters who post an address',
      icon: 'mail',
      tabs: [
        { id: 'pending', label: 'Pending' },
        { id: 'sent', label: 'Sent' },
        { id: 'skipped', label: 'Skipped' },
        { id: 'activity', label: 'Activity' }
      ],
      controls,
      foot: cpOwDashboardNote()
    });
    const root = holder.firstElementChild;
    document.body.appendChild(root);

    ui = cpOwInit(root, {
      defaultTab: 'pending',
      onTab: (id) => {
        currentTab = id;
        if (ui) ui.list.scrollTop = 0;
        scheduleRender();
      }
    });

    setupWidgetEvents(root);
    renderChips();
    render();
  }

  function renderChips() {
    const box = document.getElementById('cp-email-chips');
    if (!box) return;
    const keywords = (settings.targetKeywords || []).map((k) => String(k).trim()).filter(Boolean).slice(0, 6);
    const chips = keywords
      .map((k) => `<button type="button" class="cp-ow-chip" data-q="${cpOwEscape(`${k} hiring email`)}">${cpOwEscape(k)}</button>`)
      .join('');
    const toggle = `<button type="button" class="cp-ow-chip${settings.showAlreadyContacted ? ' is-on' : ''}" id="cp-email-contacted" title="Show posts from recruiters you already emailed">Show contacted posts</button>`;
    const hint = keywords.length === 0
      ? '<div class="cp-ow-hint">Quick searches come from your keywords. Add them in your dashboard (Auto Apply > Messages).</div>'
      : '';
    box.innerHTML = chips + toggle + hint;
  }

  function setupWidgetEvents(root) {
    const byId = (id) => root.querySelector(`#${id}`);

    // Search
    const searchInput = byId('cp-email-query');
    function performSearch(query) {
      const q = (query || '').trim();
      if (!q) {
        logActivity('Type some keywords to search for.', 'warning');
        setActivityTab();
        if (searchInput) searchInput.focus();
        return;
      }
      logActivity(`Navigating to LinkedIn Content Search for: "${q}"...`, 'info');
      const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(q)}&sortBy=%5B%22date_posted%22%5D#autoapply-module=email`;
      window.location.href = searchUrl;
    }

    byId('cp-email-search')?.addEventListener('click', () => performSearch(searchInput ? searchInput.value : ''));
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performSearch(searchInput.value);
    });

    // Quick chips (keyword searches) and the "Show contacted posts" toggle
    byId('cp-email-chips')?.addEventListener('click', (e) => {
      const target = e.target instanceof Element ? e.target.closest('button') : null;
      if (!target) return;
      if (target.id === 'cp-email-contacted') {
        settings.showAlreadyContacted = !settings.showAlreadyContacted;
        try {
          chrome.storage.local.set({ emailSettings: settings });
        } catch (_) {}
        logActivity(settings.showAlreadyContacted ? 'Showing posts from recruiters you already contacted.' : 'Hiding posts from recruiters you already contacted.', 'info');
        renderChips();
        scanCurrentDOMForLeads();
        return;
      }
      const query = target.getAttribute('data-q');
      if (query) {
        if (searchInput) searchInput.value = query;
        performSearch(query);
      }
    });

    // Start / Pause / Stop
    byId('cp-email-start')?.addEventListener('click', () => {
      if (isScanning) {
        if (isPaused) togglePause();
        return;
      }
      startScanner();
    });
    byId('cp-email-pause')?.addEventListener('click', togglePause);
    byId('cp-email-stop')?.addEventListener('click', stopAll);

    byId('cp-email-scroll')?.addEventListener('click', () => {
      startFullAutoScroll();
    });
    byId('cp-email-send')?.addEventListener('click', () => {
      startAutoSendingQueue();
    });

    byId('cp-email-csv')?.addEventListener('click', exportLeadsToCSV);
    byId('cp-email-clear')?.addEventListener('click', clearPendingLeads);

    // Per-lead actions on the Pending tab
    ui.list.addEventListener('click', (e) => {
      const btn = e.target instanceof Element ? e.target.closest('[data-lead-act]') : null;
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const act = btn.getAttribute('data-lead-act');
      const lead = extractedLeads.find((l) => l.id === id);
      if (!lead) return;
      if (act === 'send') {
        dispatchEmailOutreach(lead);
      } else if (act === 'copy') {
        try { navigator.clipboard.writeText(lead.email); } catch (_) {}
        const label = btn.querySelector('span');
        if (label) {
          label.textContent = 'Copied';
          setTimeout(() => { label.textContent = 'Copy'; }, 2000);
        }
      } else if (act === 'remove') {
        extractedLeads = extractedLeads.filter((l) => l.id !== id);
        chrome.storage.local.set({ emailLeads: extractedLeads });
        scheduleRender();
      }
    });
  }

  function setActivityTab() {
    if (ui && ui.tab !== 'activity') ui.setTab('activity');
  }

  function togglePause() {
    if (!(isScanning || isFullScrolling || isAutoSending)) return;
    isPaused = !isPaused;
    logActivity(isPaused ? 'Paused.' : 'Resumed.', 'warning');
    scheduleRender();
  }

  function stopAll() {
    const wasRunning = isScanning || isFullScrolling || isAutoSending;
    isScanning = false;
    isFullScrolling = false;
    isAutoSending = false;
    isPaused = false;
    sendingNow = null;
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    if (wasRunning) logActivity('Stopped.', 'warning');
    scheduleRender();
  }

  function logActivity(msg, type = 'info') {
    activityLog.unshift({ msg: String(msg), type, ts: Date.now() });
    if (activityLog.length > MAX_ACTIVITY) activityLog.length = MAX_ACTIVITY;
    scheduleRender();
  }

  // ── SKIPPED LEADS ─────────────────────────────────────────────────────────

  function persistSkippedSoon() {
    if (skippedSaveTimer) return;
    skippedSaveTimer = setTimeout(() => {
      skippedSaveTimer = null;
      if (!chrome?.runtime?.id) return;
      try {
        chrome.storage.local.set({ emailSkipped: skippedItems });
      } catch (_) {}
    }, 1000);
  }

  // Returns true when this is a new skip (the same post/reason is only recorded once).
  function recordSkip({ id, name = '', title = '', company = '', reason }) {
    const key = `${reason}|${id}`;
    if (skippedKeys.has(key)) return false;
    skippedKeys.add(key);
    skippedItems.unshift({ id, name, title, company, reason, ts: new Date().toISOString() });
    if (skippedItems.length > MAX_SKIPPED) skippedItems.length = MAX_SKIPPED;
    persistSkippedSoon();
    scheduleRender();
    return true;
  }

  // A key for a post that does not change between scans (falls back to its opening text).
  function stablePostKey(postEl, text) {
    const attr = postEl.getAttribute('componentkey') || postEl.id || postEl.getAttribute('data-urn') || postEl.getAttribute('data-chameleon-result-urn');
    if (attr) return attr;
    return `txt_${String(text || '').slice(0, 80).replace(/\s+/g, ' ').trim()}`;
  }

  // ── CARD BUILDERS (pure: take data, return HTML) ──────────────────────────

  function fmtTime(value) {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return cpOwClock(d);
    return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  function leadSub(lead) {
    const title = (lead.jobTitle || '').trim();
    const company = (lead.company || '').trim();
    if (title && company) return `${title} at ${company}`;
    return title || company;
  }

  function leadExtra(lead, withActions) {
    const email = `<div class="cp-ow-email-line">${cpOwEscape(lead.email || '')}</div>`;
    if (!withActions) return `<div class="cp-ow-lead-extra">${email}</div>`;
    const id = cpOwEscape(lead.id);
    return `<div class="cp-ow-lead-extra">${email}<div class="cp-ow-lead-btns">
      <button type="button" class="cp-ow-btn is-start cp-ow-mini" data-lead-act="send" data-id="${id}"><span>Send now</span></button>
      <button type="button" class="cp-ow-btn is-ghost cp-ow-mini" data-lead-act="copy" data-id="${id}"><span>Copy</span></button>
      <button type="button" class="cp-ow-btn is-stop cp-ow-mini" data-lead-act="remove" data-id="${id}"><span>Remove</span></button>
    </div></div>`;
  }

  function buildPendingCards(leads) {
    if (!leads.length) {
      return cpOwEmpty('mail', 'No recruiter emails waiting.<br>Press <b>Scan feed</b> or search hiring posts.');
    }
    return leads.map((lead) => cpOwCard({
      icon: 'mail',
      title: lead.recruiterName || 'Hiring Manager',
      sub: leadSub(lead),
      time: fmtTime(lead.timestamp),
      actionsHtml: leadExtra(lead, true)
    })).join('');
  }

  function buildSentCards(leads) {
    if (!leads.length) {
      return cpOwEmpty('check', 'No emails sent yet.');
    }
    return leads.map((lead) => cpOwCard({
      kind: 'sent',
      icon: 'check',
      title: lead.recruiterName || 'Hiring Manager',
      sub: leadSub(lead),
      time: fmtTime(lead.sentAt || lead.timestamp),
      actionsHtml: leadExtra(lead, false)
    })).join('');
  }

  function buildSkippedCards(items) {
    if (!items.length) {
      return cpOwEmpty('skip', 'Nothing skipped yet.<br>Posts that are passed over show up here with the reason.');
    }
    return items.map((item) => cpOwCard({
      kind: 'skipped',
      icon: 'skip',
      title: item.name || 'Unknown poster',
      sub: [item.title, item.company].filter(Boolean).join(' at '),
      reason: item.reason,
      time: fmtTime(item.ts)
    })).join('');
  }

  function buildActivityCards(log, banner, missingSetup) {
    let html = '';
    if (banner) html += cpOwBanner(banner) + cpOwWorking('Working...');
    if (missingSetup) {
      html += cpOwCard({
        kind: 'error',
        icon: 'alert',
        title: 'Email message not set',
        sub: 'Write your email subject and message in your dashboard first. Sending stays off until then; scanning still works.'
      });
    }
    if (!log.length && !html) {
      return cpOwEmpty('clock', 'Nothing has happened yet.<br>What the widget does will be listed here.');
    }
    const icons = { success: 'check', warning: 'alert', error: 'alert', info: 'sparkle' };
    const kinds = { success: 'sent', warning: 'skipped', error: 'error', info: '' };
    html += log.map((entry) => cpOwCard({
      kind: kinds[entry.type] || '',
      icon: icons[entry.type] || 'sparkle',
      title: entry.msg,
      time: cpOwClock(entry.ts)
    })).join('');
    return html;
  }
  // ── END CARD BUILDERS ─────────────────────────────────────────────────────

  function isLeadSent(lead) {
    return lead.status === 'sent' || contactedEmails.has(String(lead.email || '').toLowerCase().trim());
  }

  function byNewest(a, b) {
    return new Date(b.sortTs || 0) - new Date(a.sortTs || 0);
  }

  function getPendingLeads() {
    return extractedLeads
      .filter((l) => !isLeadSent(l))
      .map((l) => ({ lead: l, sortTs: l.timestamp }))
      .sort(byNewest)
      .map((x) => x.lead);
  }

  function getSentLeads() {
    return extractedLeads
      .filter(isLeadSent)
      .map((l) => ({ lead: l, sortTs: l.sentAt || l.timestamp }))
      .sort(byNewest)
      .map((x) => x.lead);
  }

  function getBannerInfo() {
    if (!(isScanning || isFullScrolling || isAutoSending)) return null;
    const title = isPaused ? 'Paused' : (isAutoSending ? 'Sending emails' : 'Scanning');
    if (isAutoSending) {
      const s = sendingNow;
      return {
        title,
        main: s ? `Emailing ${s.name || s.email}` : 'Starting the send queue',
        detail: s ? `${s.index} of ${s.total} - ${s.sent} sent` : ''
      };
    }
    return {
      title,
      main: isFullScrolling ? 'Scrolling the feed to the end' : 'Scanning the feed for hiring emails',
      detail: `${postsSeen} cards seen - ${extractedLeads.length} emails found`
    };
  }

  function scheduleRender() {
    if (renderTimer) return;
    renderTimer = setTimeout(() => {
      renderTimer = null;
      render();
    }, 80);
  }

  function setBtnLabel(id, text, disabled) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const span = btn.querySelector('span');
    if (span && span.textContent !== text) span.textContent = text;
    if (typeof disabled === 'boolean') btn.disabled = disabled;
  }

  function render() {
    if (!ui) return;
    const pending = getPendingLeads();
    const sent = getSentLeads();
    const ready = templatesReady();
    const running = isScanning || isFullScrolling || isAutoSending;

    ui.setCount('pending', pending.length);
    ui.setCount('sent', sent.length);
    ui.setCount('skipped', skippedItems.length);

    // Stats
    const setStat = (id, value) => {
      const el = ui.root.querySelector(`[data-stat="${id}"]`);
      if (el) el.textContent = String(value);
    };
    setStat('seen', postsSeen);
    setStat('matched', extractedLeads.length);
    setStat('sent', sent.length);
    setStat('dupes', duplicateCount);

    // Badge + buttons
    if (isPaused && running) ui.setBadge('Paused', 'pause');
    else if (isAutoSending) ui.setBadge('Sending', 'run');
    else if (isScanning || isFullScrolling) ui.setBadge('Scanning', 'run');
    else ui.setBadge('Idle', '');

    setBtnLabel('cp-email-start', isScanning && !isPaused ? 'Scanning' : (isScanning ? 'Continue' : 'Scan feed'), isScanning && !isPaused);
    setBtnLabel('cp-email-pause', isPaused ? 'Resume' : 'Pause', !running);
    setBtnLabel('cp-email-stop', 'Stop', !running);
    setBtnLabel('cp-email-scroll', isFullScrolling ? 'Stop auto-scroll' : 'Full auto-scroll');
    setBtnLabel('cp-email-send', isAutoSending ? 'Stop sending' : `Send queue (${pending.length})`);

    // Setup note
    const setup = document.getElementById('cp-email-setup');
    const setupHtml = ready ? '' : cpOwDashboardNote('Write your email subject and message in your dashboard first.', true);
    if (setup && setupHtml !== lastSetupHtml) {
      setup.innerHTML = setupHtml;
      lastSetupHtml = setupHtml;
    }

    // List for the current tab
    let html = '';
    if (currentTab === 'sent') html = buildSentCards(sent);
    else if (currentTab === 'skipped') html = buildSkippedCards(skippedItems);
    else if (currentTab === 'activity') html = buildActivityCards(activityLog, getBannerInfo(), !ready);
    else html = buildPendingCards(pending);
    ui.setList(html);
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

  // ── SCANNING & SCRAPING ENGINE ────────────────────────────────────────────

  let scanInterval = null;

  function startScanner() {
    if (isFullScrolling) stopFullAutoScroll();
    isScanning = true;
    isPaused = false;

    logActivity('Email scanner started. Scanning visible LinkedIn feed...', 'info');
    scanCurrentDOMForLeads();

    let scrollCounter = 0;
    scanInterval = setInterval(() => {
      if (!chrome?.runtime?.id) {
        clearInterval(scanInterval);
        return;
      }
      if (!isScanning || isPaused) return;

      scanCurrentDOMForLeads();

      if (settings.autoScroll && isScanning) {
        scrollCounter++;
        const allPosts = findAllPostElements();
        if (allPosts.length > 0 && isScanning) {
          const bottomPost = allPosts[allPosts.length - 1];
          focusAndHighlightPost(bottomPost, '#0ea5e9');
        }
        if (!isScanning) return;
        window.scrollBy({ top: 600, behavior: 'smooth' });
        if (scrollCounter % 4 === 0) {
          logActivity('Auto-scrolled feed for new hiring posts...', 'info');
        }
      }
    }, 2800);
    scheduleRender();
  }


  // ── DEEP FULL AUTO-SCROLL TO FEED BOTTOM ENGINE ──
  let isFullScrolling = false;

  // Helper to focus & highlight a LinkedIn post element
  function focusAndHighlightPost(postEl, color = '#0ea5e9') {
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

  // Helper to find the DOM post element associated with an email lead
  function findPostElementForLead(lead) {
    if (!lead) return null;
    if (lead.urn) {
      const match = document.querySelector(`[data-urn*="${lead.urn}"], [data-id*="${lead.urn}"]`);
      if (match) return match;
    }
    const allPosts = findAllPostElements();
    for (const post of allPosts) {
      const text = post.innerText || '';
      if (lead.email && text.toLowerCase().includes(lead.email.toLowerCase())) {
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

    // Stop background scanner interval if running
    if (isScanning || scanInterval) {
      isScanning = false;
      if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
      }
    }

    isFullScrolling = true;
    isPaused = false;
    scheduleRender();
    logActivity('Full Auto-Scroll started! Navigating LinkedIn 3s lazy loading batches...', 'info');

    let stagnantCount = 0;
    let cycleCount = 0;
    let lastPostCount = findAllPostElements().length;

    while (isFullScrolling) {
      while (isPaused && isFullScrolling) await sleep(300);
      if (!isFullScrolling) break;
      cycleCount++;

      // 1. Expand all "...see more" buttons on currently visible posts
      expandAllSeeMoreButtons();

      // 2. Scan DOM for new email leads
      const found = scanCurrentDOMForLeads();
      if (found > 0) {
        scheduleRender();
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
      logActivity(`[Batch #${cycleCount}] Waiting 3s for LinkedIn lazy load (Posts: ${prevPosts}, Leads: ${extractedLeads.length})...`, 'info');
      
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
        logActivity(`Loaded +${addedPosts > 0 ? addedPosts : 'new'} posts from LinkedIn! Total cards: ${newPosts}`, 'success');
        lastPostCount = newPosts;
        stagnantCount = 0;

        if (newPostsList.length > 0 && isFullScrolling) {
          const newestPost = newPostsList[newPostsList.length - 1];
          focusAndHighlightPost(newestPost, '#38bdf8');
        }
      } else {
        // Try clicking show more button if feed paused
        const clicked = findAndClickShowMoreButton();
        if (clicked) {
          logActivity('Clicked "Show more results" button on LinkedIn. Waiting 3s...', 'info');
          const ok = await abortableSleep(3000, () => isFullScrolling);
          if (!ok || !isFullScrolling) break;
          continue;
        }

        stagnantCount++;
        logActivity(`Reached feed pause (${stagnantCount}/4)... retrying scroll.`, 'warning');
        if (stagnantCount >= 4) {
          logActivity('Reached the end of LinkedIn feed / search results! All available posts loaded.', 'success');
          break;
        }
      }
    }

    const wasRunning = isFullScrolling;
    isFullScrolling = false;
    scheduleRender();
    expandAllSeeMoreButtons();
    scanCurrentDOMForLeads();
    scheduleRender();
    if (wasRunning) {
      logActivity(`Full Scroll complete! Extracted total ${extractedLeads.length} email leads from ${findAllPostElements().length} posts.`, 'success');
    }
  }

  function stopFullAutoScroll() {
    isFullScrolling = false;
    isScanning = false;
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    isPaused = false;
    scheduleRender();
    logActivity('Full Auto-Scroll stopped immediately.', 'warning');
  }

  function scanCurrentDOMForLeads() {
    const postElements = findAllPostElements();
    postsSeen = postElements.length;
    let duplicatesAdded = 0;

    let newCount = 0;

    for (const post of postElements) {
      const postText = getAllTextFromPost(post);
      if (!postText || postText.length < 20) continue;

      const skipKey = stablePostKey(post, postText);

      // 1. Filter out pure job seekers if enabled
      const isSeeker = settings.filterJobSeekers && isJobSeekerPost(post, postText);
      if (isSeeker) {
        recordSkip({ id: skipKey, name: getPostAuthor(post), reason: 'Job seeker post (#OpenToWork)' });
        continue;
      }

      // 2. Extract recruiter emails
      const emails = extractEmailsFromPost(post, postText);
      if (!emails || emails.length === 0) {
        // Only hiring-looking posts are worth listing; ordinary feed posts are not leads at all.
        if (HIRING_INDICATORS.some(rx => rx.test(postText))) {
          recordSkip({
            id: skipKey,
            name: getPostAuthor(post),
            title: extractJobTitle(postText, 'Job Role'),
            company: extractCompany(post, postText),
            reason: 'No email address in the post'
          });
        }
        continue;
      }

      // 3. Match Job Titles & Keywords
      const matchedKeyword = matchTargetKeywords(postText);
      if (!matchedKeyword && !settings.matchAllHiringPosts) {
        recordSkip({
          id: skipKey,
          name: getPostAuthor(post),
          title: extractJobTitle(postText, 'Job Role'),
          company: extractCompany(post, postText),
          reason: 'Does not match your keywords'
        });
        continue;
      }

      // 4. Extract Post Details
      const urn = getPostUrn(post);
      const author = getPostAuthor(post);
      const company = extractCompany(post, postText);
      const jobTitle = extractJobTitle(postText, matchedKeyword || 'Job Role');

      for (const email of emails) {
        const cleanEmail = email.toLowerCase().trim();
        if (!cleanEmail || !isValidEmail(cleanEmail)) {
          recordSkip({ id: `${skipKey}|${cleanEmail}`, name: author, title: jobTitle, company, reason: 'Invalid email address' });
          continue;
        }

        const isContacted = contactedEmails.has(cleanEmail);

        // Check if already extracted
        const existingLead = extractedLeads.find(l => l.email === cleanEmail || (urn && l.urn === urn && l.email === cleanEmail));
        if (existingLead) {
          injectPostActionBadge(post, existingLead);
          // The same address showing up in a different post is a duplicate; the same post seen again is not.
          const stableUrn = !/^urn_\d+_/.test(String(urn)) && !/^urn_\d+_/.test(String(existingLead.urn || ''));
          if (stableUrn && existingLead.urn !== urn) {
            const reason = isLeadSent(existingLead) ? 'Already emailed this address' : 'Already in your list';
            if (recordSkip({ id: cleanEmail, name: author, title: jobTitle, company, reason })) duplicatesAdded++;
          }
          continue;
        }

        if (isContacted) {
          recordSkip({ id: cleanEmail, name: author, title: jobTitle, company, reason: 'Already emailed this address' });
        }

        const lead = {
          id: `lead_email_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          urn: urn,
          recruiterName: author,
          jobTitle: jobTitle,
          company: company,
          email: cleanEmail,
          matchedKeyword: matchedKeyword || 'Hiring Post',
          postSnippet: postText.slice(0, 220).replace(/\s+/g, ' '),
          timestamp: new Date().toISOString(),
          status: isContacted ? 'sent' : 'pending'
        };

        extractedLeads.unshift(lead);
        newCount++;


        // Save to background
        chrome.runtime.sendMessage({
          type: 'SAVE_EMAIL_LEAD',
          payload: lead
        }).catch(() => {});

        injectPostActionBadge(post, lead);
      }
    }

    if (duplicatesAdded > 0) {
      duplicateCount += duplicatesAdded;
      chrome.storage.local.set({ duplicateEmailStats: { skippedCount: duplicateCount } });
    }

    if (newCount > 0) {
      chrome.storage.local.set({
        emailLeads: extractedLeads,
        duplicateEmailStats: { skippedCount: duplicateCount }
      });
      logActivity(`Found ${newCount} new verified recruiter email(s)!`, 'success');
    }
    scheduleRender();

    return newCount;
  }

  // Inject clean single-row in-feed Email action badge on the LinkedIn post (Stable - no layout jitter)
  function injectPostActionBadge(postEl, lead) {
    if (!lead || !postEl) return;
    const cleanEmail = (lead.email || '').toLowerCase().trim();
    const isSent = lead.status === 'sent' || contactedEmails.has(cleanEmail);

    const existing = postEl.querySelector('.li-email-post-badge');
    if (existing) {
      const currentLead = postEl.getAttribute('data-email-lead');
      const isSentMarked = existing.getAttribute('data-sent') === 'true';
      if (currentLead === cleanEmail && isSent === isSentMarked) {
        return; // Fully stable and up-to-date! Never re-render or shift DOM.
      }
      existing.remove();
    }

    postEl.setAttribute('data-email-lead', cleanEmail);

    const badge = document.createElement('div');
    badge.className = 'li-email-post-badge cp-fb';
    badge.setAttribute('data-sent', isSent ? 'true' : 'false');
    const sendId = `btn-badge-email-send-${lead.id}`;
    const copyId = `btn-badge-email-copy-${lead.id}`;
    badge.innerHTML = `
      <div class="cp-fb-row">
        <div class="cp-fb-info">
          <span class="cp-fb-who">${escapeHtml(lead.recruiterName)} &bull; ${escapeHtml(lead.jobTitle)}</span>
          <span class="cp-fb-mail">${escapeHtml(lead.email)}</span>
          <span class="cp-fb-pill${isSent ? ' is-sent' : ''}">${isSent ? 'Contacted' : 'Verified email'}</span>
        </div>
        <div class="cp-fb-actions">
          <button type="button" class="cp-fb-send" id="${sendId}" title="Compose email with your message">${isSent ? 'Re-send email' : 'Compose email'}</button>
          <button type="button" class="cp-fb-copy" id="${copyId}" title="Copy email">Copy</button>
        </div>
      </div>
    `;

    badge.querySelector(`#${sendId}`)?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      dispatchEmailOutreach(lead, postEl);
    });

    badge.querySelector(`#${copyId}`)?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      try { navigator.clipboard.writeText(lead.email); } catch (_) {}
      logActivity(`Copied ${lead.email} to clipboard.`, 'info');
      const copyBtn = badge.querySelector(`#${copyId}`);
      if (copyBtn) copyBtn.textContent = 'Copied';
      setTimeout(() => { if (copyBtn) copyBtn.textContent = 'Copy'; }, 2000);
    });

    postEl.insertBefore(badge, postEl.firstChild);
  }



  // ── EXTRACTION & MATCHING HELPERS ─────────────────────────────────────────

  function extractEmailsFromPost(postEl, text) {
    const results = new Set();
    const fullText = (text || '') + '\n' + getAllTextFromPost(postEl);

    // 1. Mailto links
    const mailtoLinks = postEl.querySelectorAll('a[href^="mailto:"]');
    for (const link of mailtoLinks) {
      const href = link.getAttribute('href') || '';
      const email = href.replace(/^mailto:/i, '').split('?')[0].trim();
      if (isValidEmail(email)) {
        results.add(email.toLowerCase());
      }
    }

    // 2. Standard email pattern
    const standardMatches = fullText.match(STANDARD_EMAIL_REGEX) || [];
    for (const raw of standardMatches) {
      const clean = raw.trim().replace(/[.,;:]$/, '');
      if (isValidEmail(clean)) {
        results.add(clean.toLowerCase());
      }
    }

    // 3. Obfuscated email patterns
    let match;
    const obfRegex = new RegExp(OBFUSCATED_EMAIL_REGEX);
    while ((match = obfRegex.exec(fullText)) !== null) {
      if (match[1] && match[2] && match[3]) {
        const assembled = `${match[1].trim()}@${match[2].trim()}.${match[3].trim()}`.replace(/\s+/g, '');
        if (isValidEmail(assembled)) {
          results.add(assembled.toLowerCase());
        }
      }
    }

    return Array.from(results);
  }

  function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const clean = email.toLowerCase().trim();
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,10}$/.test(clean)) return false;

    // Filter invalid file extensions parsed as domains
    if (/\.(png|jpg|jpeg|gif|svg|webp|pdf|docx?|zip|exe)$/i.test(clean)) return false;

    // Filter dummy/placeholder domains
    for (const ignored of IGNORED_DOMAINS) {
      if (clean.endsWith(`@${ignored}`) || clean.includes(`@${ignored}`)) return false;
    }

    return true;
  }

  function isJobSeekerPost(postEl, text) {
    const lower = text.toLowerCase();
    const hasHiringKeywords = HIRING_INDICATORS.some(rx => rx.test(text));
    if (hasHiringKeywords) return false;

    for (const rx of JOB_SEEKER_PATTERNS) {
      if (rx.test(text)) return true;
    }
    return false;
  }

  function matchTargetKeywords(text) {
    const lower = text.toLowerCase();
    for (const kw of settings.targetKeywords) {
      const cleaned = kw.trim().toLowerCase();
      if (cleaned && lower.includes(cleaned)) {
        return kw.trim();
      }
    }
    return null;
  }

  function extractJobTitle(text, fallbackKeyword = 'Developer') {
    const lines = text.split('\n');
    for (const line of lines) {
      const m = line.match(/(?:hiring|looking\s+for|opening\s+for|requirement\s+for|urgent\s+requirement\s+for)\s+[:\-]?\s*([A-Za-z0-9\s\/\+\#\.\-]{3,40})/i);
      if (m && m[1] && !m[1].toLowerCase().includes('immediate') && !m[1].toLowerCase().includes('candidate')) {
        return m[1].trim().split(',')[0].slice(0, 35);
      }
    }
    return fallbackKeyword
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ') + ' Role';
  }

  function extractCompany(postEl, text) {
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

    if (rawElements.length === 0) {
      const actors = document.querySelectorAll('.update-components-actor, .feed-shared-actor');
      for (const actor of actors) {
        const card = actor.closest('div.feed-shared-update-v2, div[role="listitem"], li.search-results__list-item, div.occludable-update, article');
        if (card && !rawElements.includes(card)) {
          rawElements.push(card);
        }
      }
    }

    return rawElements.filter((el, i, arr) => !arr.some((other, j) => i !== j && el.contains(other)));
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

  function getAllTextFromPost(postEl) {
    if (!postEl) return '';
    return postEl.innerText || '';
  }

  // ── DISPATCH & SENDING QUEUE ──────────────────────────────────────────────

  let isAutoSending = false;

  function dispatchEmailOutreach(lead, originPostEl = null) {
    return new Promise((resolve) => {
      // Subject and message are written in the dashboard; never send without them.
      if (!templatesReady()) {
        logActivity('Sending is off: write your email subject and message in your dashboard first.', 'warning');
        setActivityTab();
        scheduleRender();
        resolve({ success: false, error: 'Email subject and message are not set', reason: 'NO_TEMPLATE' });
        return;
      }

      logActivity(`Dispatching Email to ${lead.recruiterName} (${lead.email})...`, 'info');

      // Auto-Like post if enabled
      if (settings.autoLikePosts && originPostEl) {
        tryAutoLikePost(originPostEl);
      }

      const clientMode = settings.emailClient || 'gmail_web';

      chrome.runtime.sendMessage({
        type: 'DISPATCH_EMAIL_MESSAGE',
        payload: {
          lead: lead,
          client: clientMode,
          subjectTemplate: settings.subjectTemplate,
          messageTemplate: settings.messageTemplate,
          autoSend: settings.autoSendEmail !== false,
          autoClose: settings.autoCloseTab !== false
        }
      }, (response) => {
        if (response && response.success) {
          if (clientMode === 'mailto') {
            logActivity(`Mailto opened for ${lead.email}!`, 'success');
            lead.status = 'sent';
            lead.sentAt = new Date().toISOString();
            contactedEmails.add(lead.email.toLowerCase().trim());
            chrome.storage.local.set({
              emailLeads: extractedLeads,
              contactedEmails: Array.from(contactedEmails)
            });
            scheduleRender();
          } else {
            logActivity(`Gmail tab opened for ${lead.email}. Preparing auto-send...`, 'info');
          }

          if (originPostEl && settings.removeSentPostFromFeed) {
            setTimeout(() => {
              originPostEl.style.transition = 'all 0.5s ease';
              originPostEl.style.opacity = '0';
              originPostEl.style.maxHeight = '0';
              originPostEl.style.overflow = 'hidden';
              setTimeout(() => originPostEl.remove(), 500);
            }, 600);
          }
          resolve({ success: true, tabId: response.tabId });
        } else {
          logActivity(`Failed to dispatch Email: ${response?.error || 'Unknown error'}`, 'error');
          if (response?.reason === 'INSUFFICIENT_HIRES') {
            logActivity(`Each email costs 1 Hire. Top up: ${response.topUpUrl || 'AutoApply CV dashboard > Billing'}`, 'warning');
          }
          resolve({ success: false, error: response?.error, reason: response?.reason });
        }
      });
    });
  }

  async function dispatchEmailOutreachAndWait(lead, originPostEl = null) {
    const res = await dispatchEmailOutreach(lead, originPostEl);
    if (!res || !res.success || !res.tabId) {
      return res;
    }

    const tabId = res.tabId;
    const cleanEmail = (lead.email || '').toLowerCase().trim();
    logActivity(`Waiting for Gmail auto-submit on ${cleanEmail}...`, 'info');

    // Wait until email is sent and tab is closed before moving to next lead
    const startTime = Date.now();
    const maxWaitMs = 30000;

    // Small initial grace delay for Gmail tab creation
    await new Promise(r => setTimeout(r, 1200));

    while (Date.now() - startTime < maxWaitMs) {
      if (!isAutoSending) break;
      await new Promise(r => setTimeout(r, 800));

      // 1. Check if lead was marked sent in memory / storage
      if (contactedEmails.has(cleanEmail)) {
        logActivity(`Outreach confirmed sent to ${cleanEmail}!`, 'success');
        break;
      }

      // 2. Check if the tab has closed
      try {
        const isTabOpen = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'EMAIL_CHECK_TAB_STATUS',
            payload: { tabId }
          }, (resp) => {
            resolve(resp && Boolean(resp.open));
          });
        });

        if (!isTabOpen) {
          logActivity(`Gmail tab closed for ${cleanEmail}.`, 'info');
          break;
        }
      } catch {
        break;
      }
    }

    // Graceful cooldown between emails
    const cooldown = Math.max(2, Number(settings.delayBetweenEmails) || 5);
    logActivity(`Cooling down ${cooldown}s before next recruiter...`, 'info');
    await new Promise(r => setTimeout(r, cooldown * 1000));
    return { success: true };
  }

  async function startAutoSendingQueue() {
    if (isAutoSending) {
      isAutoSending = false;
      isPaused = false;
      sendingNow = null;
      logActivity('Batch sending stopped by user.', 'warning');
      scheduleRender();
      return;
    }

    if (!templatesReady()) {
      logActivity('Sending is off: write your email subject and message in your dashboard first.', 'warning');
      setActivityTab();
      scheduleRender();
      return;
    }

    const pendingLeads = extractedLeads.filter(l => l.status === 'pending' && !contactedEmails.has(l.email.toLowerCase().trim()));
    if (pendingLeads.length === 0) {
      logActivity('No pending leads yet. Scan the feed or search hiring posts first.', 'warning');
      setActivityTab();
      return;
    }

    const confirmMsg = `Start autonomous 1-by-1 email sending for ${pendingLeads.length} pending lead(s)?\n\nEach email will open in Gmail, automatically click Send, close the tab, and proceed to the next lead.`;
    if (!confirm(confirmMsg)) return;

    isAutoSending = true;
    isPaused = false;
    sendingNow = null;
    scheduleRender();

    logActivity(`Starting autonomous batch email outreach for ${pendingLeads.length} lead(s)...`, 'info');

    let successCount = 0;
    for (let i = 0; i < pendingLeads.length; i++) {
      while (isPaused && isAutoSending) await sleep(300);
      if (!isAutoSending) break;

      const lead = pendingLeads[i];
      sendingNow = { index: i + 1, total: pendingLeads.length, name: lead.recruiterName, email: lead.email, sent: successCount };
      scheduleRender();
      logActivity(`[${i + 1}/${pendingLeads.length}] Auto-sending email to ${lead.recruiterName} (${lead.email})...`, 'info');

      // Find on-screen post card if visible & move focus to it
      const postCard = findPostElementForLead(lead) || document.querySelector(`[data-email-lead="${lead.email}"]`);
      if (postCard) {
        focusAndHighlightPost(postCard, '#0ea5e9');
      }

      const result = await dispatchEmailOutreachAndWait(lead, postCard);
      // Out of Hires / signed out / portal down: every next lead would be refused too.
      if (result && ['INSUFFICIENT_HIRES', 'NOT_SIGNED_IN', 'PORTAL_UNREACHABLE', 'RATE_LIMITED'].includes(result.reason)) {
        logActivity(`Batch stopped after ${successCount} emails: ${result.error || result.reason}`, 'warning');
        break;
      }
      successCount++;
    }

    isAutoSending = false;
    isPaused = false;
    sendingNow = null;
    logActivity(`Autonomous batch outreach complete! Sent ${successCount} emails.`, 'success');
  }

  function tryAutoLikePost(postEl) {
    try {
      const likeBtn = postEl.querySelector('button[aria-label*="React Like"], button.react-button__trigger, button[aria-label*="Like"]');
      if (likeBtn && !likeBtn.getAttribute('aria-pressed') === 'true') {
        likeBtn.click();
        logActivity('Auto-liked recruiter post on LinkedIn!', 'info');
      }
    } catch {}
  }

  // ── LEADS LIST RENDERING & CSV EXPORT ─────────────────────────────────────
  function exportLeadsToCSV() {
    if (extractedLeads.length === 0) {
      logActivity('No leads to export yet.', 'warning');
      setActivityTab();
      return;
    }

    const headers = ['Recruiter Name', 'Job Title', 'Company', 'Email', 'Matched Keyword', 'Status', 'Timestamp', 'Post Snippet'];
    const rows = extractedLeads.map(l => [
      `"${(l.recruiterName || '').replace(/"/g, '""')}"`,
      `"${(l.jobTitle || '').replace(/"/g, '""')}"`,
      `"${(l.company || '').replace(/"/g, '""')}"`,
      `"${(l.email || '').replace(/"/g, '""')}"`,
      `"${(l.matchedKeyword || '').replace(/"/g, '""')}"`,
      `"${(l.status || 'pending').replace(/"/g, '""')}"`,
      `"${(l.timestamp || '').replace(/"/g, '""')}"`,
      `"${(l.postSnippet || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `linkedin_email_leads_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    logActivity('Exported leads to CSV successfully!', 'success');
  }

  function clearPendingLeads() {
    if (!confirm('Clear all pending leads? Contacted/Sent leads will be preserved.')) return;
    extractedLeads = extractedLeads.filter(l => l.status === 'sent' || contactedEmails.has(l.email.toLowerCase().trim()));
    chrome.storage.local.set({ emailLeads: extractedLeads });
    scheduleRender();
    logActivity('Cleared pending leads.', 'info');
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

  // ── MESSAGES & ROUTING ────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'TRIGGER_EMAIL_AUTO_SEND_ALL') {
      // Started from the popup: bring the panel up so the run is visible.
      cpOwRememberModule('email');
      checkModuleVisibility();
      startAutoSendingQueue();
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'EMAIL_LEAD_SENT') {
      const email = msg.payload?.email?.toLowerCase().trim();
      if (email) {
        const alreadyKnown = contactedEmails.has(email);
        contactedEmails.add(email);
        extractedLeads.forEach(l => {
          if (l.email.toLowerCase().trim() === email) {
            if (l.status !== 'sent') l.sentAt = new Date().toISOString();
            l.status = 'sent';
          }
        });
        if (!alreadyKnown) logActivity(`Email sent to ${email}.`, 'success');
        scheduleRender();
      }
      sendResponse({ ok: true });
      return true;
    }

    return true;
  });

  // ── INITIALIZATION ────────────────────────────────────────────────────────

  async function init() {
    await loadStorage();
    watchSettings();
    injectFloatingWidget();
    checkModuleVisibility();

    // Re-check on hash change or navigation
    window.addEventListener('hashchange', checkModuleVisibility);
    window.addEventListener('popstate', checkModuleVisibility);

    // Initial DOM scan after 2 seconds (not on /jobs, where there are no feed posts to scan)
    setTimeout(() => {
      if (!window.location.pathname.startsWith('/jobs')) scanCurrentDOMForLeads();
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();