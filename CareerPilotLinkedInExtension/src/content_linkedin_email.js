/**
 * LinkedIn to Email Job Outreach Pro - LinkedIn Content Script
 * Robust scraper with obfuscated email detection, duplicate tracking,
 * Gmail Web Compose & Default Mailto dispatching, and in-feed post badges.
 */

(function () {
  'use strict';

  if (window.__linkedInEmailOutreachInjected) return;
  window.__linkedInEmailOutreachInjected = true;

  console.log('%c[LinkedIn-Email] Content script initialized on ' + window.location.href, 'color: #6366f1; font-weight: bold; font-size: 13px;');

  let settings = {
    targetKeywords: [
      'wordpress',
      'shopify',
      'php',
      'web developer',
      'frontend',
      'full stack',
      'react',
      'web designer',
      'javascript',
      'html',
      'developer',
      'fresher',
      'electrical',
      'field engineer',
      'python',
      'node'
    ],
    subjectTemplate: 'Application for {job_title} - Parveen',
    messageTemplate: `Hi {name},

I saw your hiring post on LinkedIn regarding the {job_title} role at {company}.

I am actively looking for new opportunities and have hands-on experience in modern web technologies, WordPress, Shopify, React, and Full Stack development.

Feel free to check out my portfolio & recent work:
🌐 https://parveen-portfolio-xi.vercel.app/

I am available for immediate joining and would love to discuss how I can contribute to your team!

Best regards,
Parveen`,
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

  let extractedLeads = [];
  let contactedEmails = new Set();
  let duplicateCount = 0;
  let isScanning = false;
  let isPaused = false;
  let isWidgetMinimized = false;
  let currentTab = 'search';
  let activeLeadFilter = 'all'; // 'all', 'pending', 'sent'

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

  // Load storage
  async function loadStorage() {
    try {
      const data = await chrome.storage.local.get(['emailSettings', 'emailLeads', 'contactedEmails', 'duplicateEmailStats']);
      if (data.emailSettings) settings = { ...settings, ...data.emailSettings };
      if (Array.isArray(data.emailLeads)) extractedLeads = data.emailLeads;
      if (Array.isArray(data.contactedEmails)) contactedEmails = new Set(data.contactedEmails.map(e => e.toLowerCase().trim()));
      if (data.duplicateEmailStats && typeof data.duplicateEmailStats.skippedCount === 'number') {
        duplicateCount = data.duplicateEmailStats.skippedCount;
      }
    } catch (e) {
      console.error('[LinkedIn-Email] Load storage error:', e);
    }
  }

  // ── FLOATING WIDGET UI ────────────────────────────────────────────────────

  function checkModuleVisibility() {
    const widget = document.getElementById('li-email-widget');
    if (!widget) return;
    const hash = (window.location.hash || '').toLowerCase();

    // If explicit module requested
    if (hash.includes('autoapply-module=email') || hash.includes('module=email')) {
      widget.style.display = 'block';
      return;
    }

    // If another module was requested
    if (
      hash.includes('autoapply-module=whatsapp') ||
      hash.includes('module=whatsapp') ||
      hash.includes('autoapply-module=commenter') ||
      hash.includes('module=commenter') ||
      hash.includes('autoapply-module=easy_apply') ||
      hash.includes('module=easy_apply')
    ) {
      widget.style.display = 'none';
      return;
    }

    // On /jobs/ page, default to hidden
    if (window.location.pathname.startsWith('/jobs')) {
      widget.style.display = 'none';
      return;
    }

    widget.style.display = 'block';
  }

  function injectFloatingWidget() {
    if (document.getElementById('li-email-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'li-email-widget';
    widget.className = 'li-email-container';
    widget.innerHTML = `
      <div class="li-email-header" id="li-email-drag-header">
        <div class="li-email-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <span>Email Job Outreach Pro</span>
        </div>
        <div class="li-email-window-actions">
          <button class="li-email-btn-icon" id="li-email-min-btn" title="Minimize / Expand">_</button>
        </div>
      </div>

      <div class="li-email-nav">
        <button class="li-email-tab-btn active" id="tab-email-search">🔍 Quick Search</button>
        <button class="li-email-tab-btn" id="tab-email-leads">📋 Leads (<span id="email-lead-count-badge">0</span>)</button>
        <button class="li-email-tab-btn" id="tab-email-settings">⚙️ Settings</button>
        <button class="li-email-tab-btn" id="tab-email-logs">📜 Console & Diag</button>
      </div>

      <div class="li-email-body" id="li-email-body">
        <!-- SEARCH PANE -->
        <div id="pane-email-search" class="li-email-pane active">
          <div class="li-email-search-box">
            <label class="li-email-label">🎯 Search Email Hiring Posts on LinkedIn:</label>
            <div class="li-email-search-input-group">
              <input type="text" id="widget-email-search-query" class="li-email-input" placeholder="e.g. WordPress developer hiring email cv" />
              <button class="li-email-btn li-email-btn-primary" id="btn-email-exec-search">
                <span>🔍 Search</span>
              </button>
            </div>
            <div class="li-email-chips-row">
              <span class="li-email-quick-chip" data-q="WordPress developer hiring email cv">🌐 WordPress</span>
              <span class="li-email-quick-chip" data-q="React developer hiring email hr">⚛️ React Dev</span>
              <span class="li-email-quick-chip" data-q="Web developer send resume email">💻 Web Dev</span>
              <span class="li-email-quick-chip" data-q="Frontend developer hiring email">🎨 Frontend</span>
              <span class="li-email-quick-chip" data-q="Full stack developer hiring email cv">🚀 Full Stack</span>
              <span class="li-email-quick-chip" data-q="Python developer hiring email">🐍 Python</span>
              <span class="li-email-quick-chip" data-q="Electrical engineer hiring email">⚡ Electrical</span>
              <span class="li-email-quick-chip" data-q="Fresher hiring share cv email">🎓 Fresher</span>
            </div>
          </div>

          <div class="li-email-toolbar" style="margin-top: 10px; display:flex; gap:6px; flex-wrap:wrap;">
            <button class="li-email-btn li-email-btn-primary" id="btn-email-start-scan" style="flex:1;">
              <span>🚀 Scan Feed</span>
            </button>
            <button class="li-email-btn" id="btn-email-deep-scroll" style="flex:1.1; background:linear-gradient(135deg, #0ea5e9, #0284c7); color:#ffffff; font-weight:700; border:none; box-shadow:0 2px 8px rgba(14,165,233,0.35); display:flex; align-items:center; justify-content:center; gap:4px; cursor:pointer; border-radius:6px; padding:7px 10px; font-size:12px;">
              <span>📜 Full Auto-Scroll</span>
            </button>
            <button class="li-email-btn li-email-btn-action" id="btn-email-auto-send-all" style="flex:1.2; background:linear-gradient(135deg, #6366f1, #4f46e5); color:#ffffff; font-weight:700; border:none; box-shadow:0 2px 10px rgba(99,102,241,0.35); display:flex; align-items:center; justify-content:center; gap:5px;">
              <span>⚡ Batch Send Emails</span>
            </button>
            <button class="li-email-btn li-email-btn-pause" id="btn-email-pause-scan" style="display:none;">
              <span>⏸️ Pause</span>
            </button>
          </div>

          <div style="margin-top: 8px; padding: 6px 10px; background: rgba(15, 23, 42, 0.4); border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between;">
            <label class="li-email-checkbox" style="margin: 0; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <input type="checkbox" id="quick-check-email-show-contacted" ${settings.showAlreadyContacted ? 'checked' : ''} />
              <span style="color: #cbd5e1; font-weight: 500;">👁️ Show Already Contacted Recruiter Posts</span>
            </label>
            <span id="quick-status-email-contacted" style="font-size: 10px; color: ${settings.showAlreadyContacted ? '#818cf8' : '#94a3b8'}; font-weight: 600;">${settings.showAlreadyContacted ? 'Visible' : 'Hidden'}</span>
          </div>

          <div class="li-email-stats-bar">
            <div>Cards: <b id="stat-email-posts-seen">0</b></div>
            <div>Emails: <b id="stat-email-total-leads" style="color:#818cf8;">0</b></div>
            <div>Sent: <b id="stat-email-sent-leads" style="color:#38bdf8;">0</b></div>
            <div>🔁 Dupes: <b id="stat-email-dupes-count" style="color:#fbbf24;">0</b></div>
          </div>
        </div>

        <!-- LEADS PANE -->
        <div id="pane-email-leads" class="li-email-pane" style="display:none;">
          <div class="li-email-subnav">
            <button class="li-email-filter-btn active" data-filter="all">All (<span id="count-email-filter-all">0</span>)</button>
            <button class="li-email-filter-btn" data-filter="pending">⏳ Pending (<span id="count-email-filter-pending">0</span>)</button>
            <button class="li-email-filter-btn" data-filter="sent">✅ Sent (<span id="count-email-filter-sent">0</span>)</button>
          </div>

          <div class="li-email-toolbar" style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
            <button class="li-email-btn li-email-btn-action" id="btn-email-leads-auto-send" style="flex:1.3; background:linear-gradient(135deg, #6366f1, #4f46e5); color:#ffffff; font-weight:700; border:none; box-shadow:0 2px 10px rgba(99,102,241,0.35); display:flex; align-items:center; justify-content:center; gap:5px;">
              <span>⚡ Batch Send Pending (<span id="count-btn-email-pending">0</span>)</span>
            </button>
            <button class="li-email-btn li-email-btn-secondary" id="btn-email-export-csv" title="Export leads to CSV" style="padding:6px 10px;">
              <span>📥 CSV</span>
            </button>
            <button class="li-email-btn li-email-btn-danger" id="btn-email-clear-leads" title="Clear pending leads" style="padding:6px 10px;">
              <span>🗑️ Clear</span>
            </button>
          </div>

          <div class="li-email-leads-list" id="li-email-leads-list">
            <div class="li-email-empty-state">
              No recruiter emails extracted yet.<br>
              Click <b>"🚀 Scan Feed"</b> or search hiring posts!
            </div>
          </div>
        </div>

        <!-- SETTINGS PANE -->
        <div id="pane-email-settings" class="li-email-pane" style="display:none;">
          <div class="li-email-field-group">
            <label class="li-email-label">🎯 Target Keywords (comma separated):</label>
            <input type="text" id="input-email-keywords" class="li-email-input" value="${settings.targetKeywords.join(', ')}" />
            <span class="li-email-hint">Example: wordpress, react, web developer, php, shopify, python, electrical, fresher</span>
          </div>

          <div class="li-email-field-group">
            <label class="li-email-label">✉️ Email Client Mode:</label>
            <select id="select-email-client" class="li-email-input" style="background:#0f172a; color:#f8fafc;">
              <option value="gmail_web" ${settings.emailClient === 'gmail_web' ? 'selected' : ''}>🌐 Gmail Web Compose (Recommended)</option>
              <option value="mailto" ${settings.emailClient === 'mailto' ? 'selected' : ''}>📧 System Default Mail Client (Mailto)</option>
            </select>
          </div>

          <div class="li-email-field-group">
            <label class="li-email-label">📝 Email Subject Template:</label>
            <div class="li-email-chips">
              <span class="li-email-chip" data-target="input-email-subject" data-token="{name}">+ {name}</span>
              <span class="li-email-chip" data-target="input-email-subject" data-token="{job_title}">+ {job_title}</span>
              <span class="li-email-chip" data-target="input-email-subject" data-token="{company}">+ {company}</span>
            </div>
            <input type="text" id="input-email-subject" class="li-email-input" value="${escapeHtml(settings.subjectTemplate || '')}" />
          </div>

          <div class="li-email-field-group">
            <label class="li-email-label">💬 Cold Email Message Template:</label>
            <div class="li-email-chips">
              <span class="li-email-chip" data-target="input-email-template" data-token="{name}">+ {name}</span>
              <span class="li-email-chip" data-target="input-email-template" data-token="{job_title}">+ {job_title}</span>
              <span class="li-email-chip" data-target="input-email-template" data-token="{company}">+ {company}</span>
              <span class="li-email-chip" data-target="input-email-template" data-token="{email}">+ {email}</span>
            </div>
            <textarea id="input-email-template" class="li-email-textarea" rows="6">${escapeHtml(settings.messageTemplate || '')}</textarea>
          </div>

          <div class="li-email-options">
            <label class="li-email-checkbox">
              <input type="checkbox" id="check-email-auto-send" ${settings.autoSendEmail !== false ? 'checked' : ''} />
              <span>⚡ <b>Auto-Submit Send on Gmail Web</b></span>
            </label>
            <label class="li-email-checkbox">
              <input type="checkbox" id="check-email-auto-close" ${settings.autoCloseTab !== false ? 'checked' : ''} />
              <span>🚪 <b>Auto-Close Gmail Tab after Sending (Proceeds to Next)</b></span>
            </label>
            <label class="li-email-checkbox">
              <input type="checkbox" id="check-email-hide-non-email" ${settings.hideNonEmailPosts ? 'checked' : ''} />
              <span>🎯 <b>Hide Non-Email Posts (Brings Email Hiring Posts to Top)</b></span>
            </label>
            <label class="li-email-checkbox">
              <input type="checkbox" id="check-email-show-contacted" ${settings.showAlreadyContacted ? 'checked' : ''} />
              <span>👁️ <b>Show Already Contacted Recruiter Posts</b></span>
            </label>
            <label class="li-email-checkbox">
              <input type="checkbox" id="check-email-auto-like" ${settings.autoLikePosts ? 'checked' : ''} />
              <span>👍 <b>Auto-Like Recruiter Hiring Posts on LinkedIn</b></span>
            </label>
            <label class="li-email-checkbox">
              <input type="checkbox" id="check-email-remove-sent" ${settings.removeSentPostFromFeed ? 'checked' : ''} />
              <span>🚪 <b>Auto-Remove post from feed after email sent</b></span>
            </label>
            <label class="li-email-checkbox">
              <input type="checkbox" id="check-email-match-all" ${settings.matchAllHiringPosts ? 'checked' : ''} />
              <span>🌟 Match All Hiring Posts with Email (Broad Reach)</span>
            </label>
            <label class="li-email-checkbox">
              <input type="checkbox" id="check-email-filter-seekers" ${settings.filterJobSeekers ? 'checked' : ''} />
              <span>🛡️ Filter out Job Seekers / #OpenToWork</span>
            </label>
            <label class="li-email-checkbox">
              <input type="checkbox" id="check-email-auto-scroll" ${settings.autoScroll ? 'checked' : ''} />
              <span>📜 Auto-Scroll feed during active scan</span>
            </label>
          </div>

          <button class="li-email-btn li-email-btn-primary" id="btn-email-save-settings" style="width:100%; margin-top:10px;">
            <span>💾 Save Settings</span>
          </button>
        </div>

        <!-- LOGS PANE -->
        <div id="pane-email-logs" class="li-email-pane" style="display:none;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <button class="li-email-btn li-email-btn-secondary" id="btn-email-run-diag" style="font-size:10px; padding:4px 8px;">
              🔍 Run Diagnostics Scan
            </button>
          </div>
          <div class="li-email-terminal" id="li-email-terminal">
            <div class="term-line info">[System] Email Job Outreach Pro ready on ${window.location.hostname}.</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    try {
      const savedPos = JSON.parse(localStorage.getItem('li_email_widget_pos') || 'null');
      if (savedPos && savedPos.top && savedPos.left) {
        widget.style.top = savedPos.top;
        widget.style.left = savedPos.left;
        widget.style.right = 'auto';
        widget.style.bottom = 'auto';
      } else {
        const waWidget = document.getElementById('li-wa-widget');
        if (waWidget && waWidget.style.display !== 'none') {
          widget.style.bottom = '24px';
          widget.style.right = '480px';
        }
      }
    } catch {}

    setupWidgetEvents();
    renderLeadsList();
    makeDraggable(widget, document.getElementById('li-email-drag-header'));
  }

  function setupWidgetEvents() {
    const minBtn = document.getElementById('li-email-min-btn');
    const tabSearch = document.getElementById('tab-email-search');
    const tabLeads = document.getElementById('tab-email-leads');
    const tabSettings = document.getElementById('tab-email-settings');
    const tabLogs = document.getElementById('tab-email-logs');
    const paneSearch = document.getElementById('pane-email-search');
    const paneLeads = document.getElementById('pane-email-leads');
    const paneSettings = document.getElementById('pane-email-settings');
    const paneLogs = document.getElementById('pane-email-logs');

    // Minimize
    minBtn?.addEventListener('click', () => {
      isWidgetMinimized = !isWidgetMinimized;
      const body = document.getElementById('li-email-body');
      const nav = document.querySelector('.li-email-nav');
      if (body) body.style.display = isWidgetMinimized ? 'none' : 'block';
      if (nav) nav.style.display = isWidgetMinimized ? 'none' : 'flex';
      minBtn.textContent = isWidgetMinimized ? '+' : '_';
    });

    // Navigation Tabs
    tabSearch?.addEventListener('click', () => switchTab('search'));
    tabLeads?.addEventListener('click', () => switchTab('leads'));
    tabSettings?.addEventListener('click', () => switchTab('settings'));
    tabLogs?.addEventListener('click', () => switchTab('logs'));

    function switchTab(tab) {
      currentTab = tab;
      [tabSearch, tabLeads, tabSettings, tabLogs].forEach(t => t?.classList.remove('active'));
      [paneSearch, paneLeads, paneSettings, paneLogs].forEach(p => { if (p) p.style.display = 'none'; });

      if (tab === 'search') {
        tabSearch?.classList.add('active');
        if (paneSearch) paneSearch.style.display = 'block';
      } else if (tab === 'leads') {
        tabLeads?.classList.add('active');
        if (paneLeads) paneLeads.style.display = 'block';
      } else if (tab === 'settings') {
        tabSettings?.classList.add('active');
        if (paneSettings) paneSettings.style.display = 'block';
      } else if (tab === 'logs') {
        tabLogs?.classList.add('active');
        if (paneLogs) paneLogs.style.display = 'block';
      }
    }

    // Filter Buttons in Leads Pane
    document.querySelectorAll('.li-email-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.li-email-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeLeadFilter = btn.getAttribute('data-filter') || 'all';
        renderLeadsList();
      });
    });

    // Diagnostics button
    document.getElementById('btn-email-run-diag')?.addEventListener('click', () => {
      runDiagnostics();
    });

    // Search Trigger
    const searchInput = document.getElementById('widget-email-search-query');
    const searchBtn = document.getElementById('btn-email-exec-search');

    function performSearch(query) {
      const q = (query || '').trim();
      if (!q) {
        alert('Please enter keywords to search.');
        return;
      }
      logTerminal(`🔍 Navigating to LinkedIn Content Search for: "${q}"...`, 'info');
      const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(q)}&sortBy=%5B%22date_posted%22%5D#autoapply-module=email`;
      window.location.href = searchUrl;
    }

    searchBtn?.addEventListener('click', () => {
      performSearch(searchInput ? searchInput.value : '');
    });

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        performSearch(searchInput.value);
      }
    });

    // Quick Search Chips
    document.querySelectorAll('.li-email-quick-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.getAttribute('data-q');
        if (searchInput) searchInput.value = query;
        performSearch(query);
      });
    });

    // Token Chips in Template editor & Subject
    document.querySelectorAll('.li-email-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const token = chip.getAttribute('data-token');
        const targetId = chip.getAttribute('data-target') || 'input-email-template';
        const targetEl = document.getElementById(targetId);
        if (targetEl && token) {
          const start = targetEl.selectionStart || targetEl.value.length;
          const end = targetEl.selectionEnd || targetEl.value.length;
          targetEl.value = targetEl.value.substring(0, start) + token + targetEl.value.substring(end);
          targetEl.focus();
          targetEl.selectionStart = targetEl.selectionEnd = start + token.length;
        }
      });
    });

    // Save Settings
    document.getElementById('btn-email-save-settings')?.addEventListener('click', saveSettingsFromUI);

    // Start / Pause Scanner
    document.getElementById('btn-email-start-scan')?.addEventListener('click', () => {
      if (isScanning) {
        stopScanner();
      } else {
        startScanner();
      }
    });

    // Deep Full Auto-Scroll Button
    document.getElementById('btn-email-deep-scroll')?.addEventListener('click', () => {
      startFullAutoScroll();
    });

    // Auto-Send Batch Buttons
    document.getElementById('btn-email-auto-send-all')?.addEventListener('click', () => {
      startAutoSendingQueue();
    });

    document.getElementById('btn-email-leads-auto-send')?.addEventListener('click', () => {
      startAutoSendingQueue();
    });

    document.getElementById('btn-email-pause-scan')?.addEventListener('click', () => {
      isPaused = !isPaused;
      const pauseBtn = document.getElementById('btn-email-pause-scan');
      if (pauseBtn) pauseBtn.querySelector('span').textContent = isPaused ? '▶️ Resume' : '⏸️ Pause';
      logTerminal(isPaused ? 'Scanner paused.' : 'Scanner resumed.', 'warning');
    });

    // Quick Toggle & Settings Toggle for Show Already Contacted
    const quickContactedToggle = document.getElementById('quick-check-email-show-contacted');
    const settingsContactedToggle = document.getElementById('check-email-show-contacted');
    const quickStatusContacted = document.getElementById('quick-status-email-contacted');

    function handleContactedToggleChange(isChecked) {
      settings.showAlreadyContacted = isChecked;
      if (quickContactedToggle) quickContactedToggle.checked = isChecked;
      if (settingsContactedToggle) settingsContactedToggle.checked = isChecked;
      if (quickStatusContacted) {
        quickStatusContacted.textContent = isChecked ? 'Visible' : 'Hidden';
        quickStatusContacted.style.color = isChecked ? '#818cf8' : '#94a3b8';
      }
      chrome.storage.local.set({ emailSettings: settings });
      logTerminal(isChecked ? '👁️ Showing already contacted recruiter posts in LinkedIn feed.' : '🚫 Hiding already contacted recruiter posts from LinkedIn feed.', 'info');
      scanCurrentDOMForLeads();
    }

    quickContactedToggle?.addEventListener('change', (e) => handleContactedToggleChange(e.target.checked));
    settingsContactedToggle?.addEventListener('change', (e) => handleContactedToggleChange(e.target.checked));

    // Export CSV & Clear
    document.getElementById('btn-email-export-csv')?.addEventListener('click', exportLeadsToCSV);
    document.getElementById('btn-email-clear-leads')?.addEventListener('click', clearPendingLeads);
  }

  function saveSettingsFromUI() {
    const kwInput = document.getElementById('input-email-keywords');
    const clientSelect = document.getElementById('select-email-client');
    const subjInput = document.getElementById('input-email-subject');
    const tplInput = document.getElementById('input-email-template');

    if (kwInput) {
      settings.targetKeywords = kwInput.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    }
    if (clientSelect) {
      settings.emailClient = clientSelect.value;
    }
    if (subjInput) {
      settings.subjectTemplate = subjInput.value.trim();
    }
    if (tplInput) {
      settings.messageTemplate = tplInput.value;
    }

    settings.autoSendEmail = document.getElementById('check-email-auto-send')?.checked ?? settings.autoSendEmail;
    settings.autoCloseTab = document.getElementById('check-email-auto-close')?.checked ?? settings.autoCloseTab;
    settings.hideNonEmailPosts = document.getElementById('check-email-hide-non-email')?.checked ?? settings.hideNonEmailPosts;
    settings.showAlreadyContacted = document.getElementById('check-email-show-contacted')?.checked ?? settings.showAlreadyContacted;
    settings.autoLikePosts = document.getElementById('check-email-auto-like')?.checked ?? settings.autoLikePosts;
    settings.removeSentPostFromFeed = document.getElementById('check-email-remove-sent')?.checked ?? settings.removeSentPostFromFeed;
    settings.matchAllHiringPosts = document.getElementById('check-email-match-all')?.checked ?? settings.matchAllHiringPosts;
    settings.filterJobSeekers = document.getElementById('check-email-filter-seekers')?.checked ?? settings.filterJobSeekers;
    settings.autoScroll = document.getElementById('check-email-auto-scroll')?.checked ?? settings.autoScroll;

    chrome.storage.local.set({ emailSettings: settings }, () => {
      logTerminal('💾 Email Outreach settings saved successfully!', 'success');
      alert('Email Outreach settings saved!');
    });
  }

  function logTerminal(msg, type = 'info') {
    const term = document.getElementById('li-email-terminal');
    if (!term) return;
    const line = document.createElement('div');
    line.className = `term-line ${type}`;
    const time = new Date().toLocaleTimeString();
    line.textContent = `[${time}] ${msg}`;
    term.appendChild(line);
    term.scrollTop = term.scrollHeight;

    while (term.children.length > 150) {
      term.removeChild(term.firstChild);
    }
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
    const startBtn = document.getElementById('btn-email-start-scan');
    const pauseBtn = document.getElementById('btn-email-pause-scan');
    if (startBtn) {
      startBtn.innerHTML = '<span>🛑 Stop Scan</span>';
      startBtn.classList.replace('li-email-btn-primary', 'li-email-btn-danger');
    }
    if (pauseBtn) pauseBtn.style.display = 'flex';

    logTerminal('🚀 Email scanner started. Scanning visible LinkedIn feed...', 'info');
    scanCurrentDOMForLeads();

    let scrollCounter = 0;
    scanInterval = setInterval(() => {
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
          logTerminal('📜 Auto-scrolled feed for new hiring posts...', 'info');
        }
      }
    }, 2800);
  }

  function stopScanner() {
    isScanning = false;
    isPaused = false;
    isFullScrolling = false;
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    const startBtn = document.getElementById('btn-email-start-scan');
    const pauseBtn = document.getElementById('btn-email-pause-scan');
    if (startBtn) {
      startBtn.innerHTML = '<span>🚀 Scan Feed</span>';
      startBtn.classList.replace('li-email-btn-danger', 'li-email-btn-primary');
    }
    if (pauseBtn) pauseBtn.style.display = 'none';
    updateFullScrollButton(false);
    logTerminal('🛑 Email scanner stopped.', 'warning');
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
      const startBtn = document.getElementById('btn-email-start-scan');
      if (startBtn) {
        startBtn.innerHTML = '<span>🚀 Scan Feed</span>';
        startBtn.classList.replace('li-email-btn-danger', 'li-email-btn-primary');
      }
    }

    isFullScrolling = true;
    updateFullScrollButton(true);
    logTerminal('📜 Full Auto-Scroll started! Navigating LinkedIn 3s lazy loading batches...', 'info');

    let stagnantCount = 0;
    let cycleCount = 0;
    let lastPostCount = findAllPostElements().length;

    while (isFullScrolling) {
      cycleCount++;

      // 1. Expand all "...see more" buttons on currently visible posts
      expandAllSeeMoreButtons();

      // 2. Scan DOM for new email leads
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
      logTerminal(`⏳ [Batch #${cycleCount}] Waiting 3s for LinkedIn lazy load (Posts: ${prevPosts}, Leads: ${extractedLeads.length})...`, 'info');
      
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
        logTerminal(`✅ Loaded +${addedPosts > 0 ? addedPosts : 'new'} posts from LinkedIn! Total cards: ${newPosts}`, 'success');
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
          logTerminal('👆 Clicked "Show more results" button on LinkedIn. Waiting 3s...', 'info');
          const ok = await abortableSleep(3000, () => isFullScrolling);
          if (!ok || !isFullScrolling) break;
          continue;
        }

        stagnantCount++;
        logTerminal(`⏳ Reached feed pause (${stagnantCount}/4)... retrying scroll.`, 'warning');
        if (stagnantCount >= 4) {
          logTerminal('🏁 Reached the end of LinkedIn feed / search results! All available posts loaded.', 'success');
          break;
        }
      }
    }

    const wasRunning = isFullScrolling;
    isFullScrolling = false;
    updateFullScrollButton(false);
    expandAllSeeMoreButtons();
    scanCurrentDOMForLeads();
    renderLeadsList();
    if (wasRunning) {
      logTerminal(`🎉 Full Scroll complete! Extracted total ${extractedLeads.length} email leads from ${findAllPostElements().length} posts.`, 'success');
    }
  }

  function stopFullAutoScroll() {
    isFullScrolling = false;
    isScanning = false;
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    updateFullScrollButton(false);
    const startBtn = document.getElementById('btn-email-start-scan');
    if (startBtn) {
      startBtn.innerHTML = '<span>🚀 Scan Feed</span>';
      startBtn.classList.replace('li-email-btn-danger', 'li-email-btn-primary');
    }
    logTerminal('🛑 Full Auto-Scroll stopped immediately.', 'warning');
  }

  function updateFullScrollButton(running) {
    const btn = document.getElementById('btn-email-deep-scroll');
    if (btn) {
      btn.style.background = running ? '#ef4444' : 'linear-gradient(135deg, #0ea5e9, #0284c7)';
      const span = btn.querySelector('span');
      if (span) span.textContent = running ? '⏹️ Stop Full Scroll' : '📜 Full Auto-Scroll';
    }
  }

  function scanCurrentDOMForLeads() {
    const postElements = findAllPostElements();
    const seenCountEl = document.getElementById('stat-email-posts-seen');
    if (seenCountEl) seenCountEl.textContent = postElements.length;

    let newCount = 0;

    for (const post of postElements) {
      const postText = getAllTextFromPost(post);
      if (!postText || postText.length < 20) continue;

      // 1. Filter out pure job seekers if enabled
      const isSeeker = settings.filterJobSeekers && isJobSeekerPost(post, postText);
      if (isSeeker) continue;

      // 2. Extract recruiter emails
      const emails = extractEmailsFromPost(post, postText);
      if (!emails || emails.length === 0) continue;

      // 3. Match Job Titles & Keywords
      const matchedKeyword = matchTargetKeywords(postText);
      if (!matchedKeyword && !settings.matchAllHiringPosts) continue;

      // 4. Extract Post Details
      const urn = getPostUrn(post);
      const author = getPostAuthor(post);
      const company = extractCompany(post, postText);
      const jobTitle = extractJobTitle(postText, matchedKeyword || 'Job Role');

      for (const email of emails) {
        const cleanEmail = email.toLowerCase().trim();
        if (!cleanEmail || !isValidEmail(cleanEmail)) continue;

        const isContacted = contactedEmails.has(cleanEmail);

        // Check if already extracted
        const existingLead = extractedLeads.find(l => l.email === cleanEmail || (urn && l.urn === urn && l.email === cleanEmail));
        if (existingLead) {
          injectPostActionBadge(post, existingLead);
          continue;
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

        console.log('%c[LinkedIn-Email] Extracted Lead: ' + author + ' (' + jobTitle + ') -> ' + cleanEmail + (isContacted ? ' [Already Sent]' : ''), 'color: #6366f1; font-weight: bold;');

        // Save to background
        chrome.runtime.sendMessage({
          type: 'SAVE_EMAIL_LEAD',
          payload: lead
        }).catch(() => {});

        injectPostActionBadge(post, lead);
      }
    }

    if (newCount > 0) {
      chrome.storage.local.set({
        emailLeads: extractedLeads,
        duplicateEmailStats: { skippedCount: duplicateCount }
      });
      updateStatsBar();
      logTerminal(`✨ Found ${newCount} new verified recruiter email(s)!`, 'success');
    }

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
    badge.className = 'li-email-post-badge';
    badge.setAttribute('data-sent', isSent ? 'true' : 'false');
    badge.innerHTML = `
      <div class="badge-content" style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:10px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span style="font-size:14px;">📧</span>
          <span class="badge-tag" style="font-size:12px; font-weight:700; color:#818cf8;">
            ${escapeHtml(lead.recruiterName)} &bull; ${escapeHtml(lead.jobTitle)}
          </span>
          <span style="font-size:11px; font-weight:700; color:#38bdf8;">✉️ ${escapeHtml(lead.email)}</span>
          ${isSent ? '<span style="font-size:10px; color:#22c55e; background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.3); padding:2px 7px; border-radius:10px; font-weight:600;">✅ Contacted</span>' : '<span style="font-size:10px; color:#fbbf24; background:rgba(251,191,36,0.15); border:1px solid rgba(251,191,36,0.3); padding:2px 7px; border-radius:10px; font-weight:600;">⚡ Verified Email</span>'}
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button class="badge-email-btn" id="btn-badge-email-send-${lead.id}" style="background:linear-gradient(135deg, #6366f1, #4f46e5); color:#ffffff; border:none; border-radius:6px; padding:6px 13px; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:5px; transition:all 0.2s;" title="Compose email with customized pitch">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <span>${isSent ? 'Re-Send Email' : 'Compose Email'}</span>
          </button>
          <button class="badge-copy-btn" id="btn-badge-email-copy-${lead.id}" style="background:rgba(255,255,255,0.08); color:#cbd5e1; border:1px solid rgba(255,255,255,0.15); border-radius:6px; padding:6px 8px; font-size:11px; cursor:pointer;" title="Copy Email">
            📋
          </button>
        </div>
      </div>
    `;

    badge.querySelector(`#btn-badge-email-send-${lead.id}`)?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      dispatchEmailOutreach(lead, postEl);
    });

    badge.querySelector(`#btn-badge-email-copy-${lead.id}`)?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      navigator.clipboard.writeText(lead.email);
      logTerminal(`📋 Copied ${lead.email} to clipboard!`, 'info');
      const copyBtn = badge.querySelector(`#btn-badge-email-copy-${lead.id}`);
      if (copyBtn) copyBtn.textContent = '✅';
      setTimeout(() => { if (copyBtn) copyBtn.textContent = '📋'; }, 2000);
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
      logTerminal(`✉️ Dispatching Email to ${lead.recruiterName} (${lead.email})...`, 'info');

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
            logTerminal(`✅ Mailto opened for ${lead.email}!`, 'success');
            lead.status = 'sent';
            contactedEmails.add(lead.email.toLowerCase().trim());
            chrome.storage.local.set({
              emailLeads: extractedLeads,
              contactedEmails: Array.from(contactedEmails)
            });
            renderLeadsList();
          } else {
            logTerminal(`✅ Gmail tab opened for ${lead.email}. Preparing auto-send...`, 'info');
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
          logTerminal(`❌ Failed to dispatch Email: ${response?.error || 'Unknown error'}`, 'error');
          resolve({ success: false, error: response?.error });
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
    logTerminal(`⏳ Waiting for Gmail auto-submit on ${cleanEmail}...`, 'info');

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
        logTerminal(`✅ Outreach confirmed sent to ${cleanEmail}!`, 'success');
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
          logTerminal(`🚪 Gmail tab closed for ${cleanEmail}.`, 'info');
          break;
        }
      } catch {
        break;
      }
    }

    // Graceful cooldown between emails
    const cooldown = Math.max(2, Number(settings.delayBetweenEmails) || 5);
    logTerminal(`⏳ Cooling down ${cooldown}s before next recruiter...`, 'info');
    await new Promise(r => setTimeout(r, cooldown * 1000));
    return { success: true };
  }

  async function startAutoSendingQueue() {
    if (isAutoSending) {
      isAutoSending = false;
      const sendBtn = document.getElementById('btn-email-auto-send-all');
      const leadsSendBtn = document.getElementById('btn-email-leads-auto-send');
      if (sendBtn) sendBtn.innerHTML = '<span>⚡ Batch Send Emails</span>';
      if (leadsSendBtn) leadsSendBtn.innerHTML = '<span>⚡ Batch Send Pending</span>';
      logTerminal('⏹️ Batch sending stopped by user.', 'warning');
      return;
    }

    const pendingLeads = extractedLeads.filter(l => l.status === 'pending' && !contactedEmails.has(l.email.toLowerCase().trim()));
    if (pendingLeads.length === 0) {
      alert('No pending leads found! Click "🚀 Scan Feed" or search hiring posts first.');
      return;
    }

    const confirmMsg = `Start autonomous 1-by-1 email sending for ${pendingLeads.length} pending lead(s)?\n\nEach email will open in Gmail, automatically click Send, close the tab, and proceed to the next lead.`;
    if (!confirm(confirmMsg)) return;

    isAutoSending = true;
    const sendBtn = document.getElementById('btn-email-auto-send-all');
    const leadsSendBtn = document.getElementById('btn-email-leads-auto-send');
    if (sendBtn) sendBtn.innerHTML = '<span>⏹️ Stop Batch Sending</span>';
    if (leadsSendBtn) leadsSendBtn.innerHTML = '<span>⏹️ Stop Batch Sending</span>';

    logTerminal(`⚡ Starting autonomous batch email outreach for ${pendingLeads.length} lead(s)...`, 'info');

    let successCount = 0;
    for (let i = 0; i < pendingLeads.length; i++) {
      if (!isAutoSending) break;

      const lead = pendingLeads[i];
      logTerminal(`[${i + 1}/${pendingLeads.length}] Auto-sending email to ${lead.recruiterName} (${lead.email})...`, 'info');

      // Find on-screen post card if visible & move focus to it
      const postCard = findPostElementForLead(lead) || document.querySelector(`[data-email-lead="${lead.email}"]`);
      if (postCard) {
        focusAndHighlightPost(postCard, '#0ea5e9');
      }

      // Also scroll sidebar row into view
      const leadRow = document.getElementById(`email-lead-item-${lead.id}`);
      if (leadRow) {
        leadRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      await dispatchEmailOutreachAndWait(lead, postCard);
      successCount++;
    }

    isAutoSending = false;
    if (sendBtn) sendBtn.innerHTML = '<span>⚡ Batch Send Emails</span>';
    if (leadsSendBtn) leadsSendBtn.innerHTML = '<span>⚡ Batch Send Pending</span>';
    logTerminal(`🎉 Autonomous batch outreach complete! Sent ${successCount} emails.`, 'success');
  }

  function tryAutoLikePost(postEl) {
    try {
      const likeBtn = postEl.querySelector('button[aria-label*="React Like"], button.react-button__trigger, button[aria-label*="Like"]');
      if (likeBtn && !likeBtn.getAttribute('aria-pressed') === 'true') {
        likeBtn.click();
        logTerminal('👍 Auto-liked recruiter post on LinkedIn!', 'info');
      }
    } catch {}
  }

  // ── LEADS LIST RENDERING & CSV EXPORT ─────────────────────────────────────

  function renderLeadsList() {
    const listEl = document.getElementById('li-email-leads-list');
    const badgeEl = document.getElementById('email-lead-count-badge');
    if (!listEl) return;

    const allCount = extractedLeads.length;
    const pendingCount = extractedLeads.filter(l => l.status === 'pending' && !contactedEmails.has(l.email.toLowerCase().trim())).length;
    const sentCount = extractedLeads.filter(l => l.status === 'sent' || contactedEmails.has(l.email.toLowerCase().trim())).length;

    if (badgeEl) badgeEl.textContent = allCount;
    const cAll = document.getElementById('count-email-filter-all');
    const cPen = document.getElementById('count-email-filter-pending');
    const cSen = document.getElementById('count-email-filter-sent');
    const cBtnPen = document.getElementById('count-btn-email-pending');
    if (cAll) cAll.textContent = allCount;
    if (cPen) cPen.textContent = pendingCount;
    if (cSen) cSen.textContent = sentCount;
    if (cBtnPen) cBtnPen.textContent = pendingCount;

    updateStatsBar();

    let filtered = extractedLeads;
    if (activeLeadFilter === 'pending') {
      filtered = extractedLeads.filter(l => l.status === 'pending' && !contactedEmails.has(l.email.toLowerCase().trim()));
    } else if (activeLeadFilter === 'sent') {
      filtered = extractedLeads.filter(l => l.status === 'sent' || contactedEmails.has(l.email.toLowerCase().trim()));
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="li-email-empty-state">
          No ${activeLeadFilter === 'all' ? '' : activeLeadFilter} recruiter emails found.<br>
          Click <b>"🚀 Scan Feed"</b> to discover leads!
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map(lead => {
      const isSent = lead.status === 'sent' || contactedEmails.has(lead.email.toLowerCase().trim());
      return `
        <div class="li-email-lead-card ${isSent ? 'sent' : ''}" id="email-card-${lead.id}">
          <div class="lead-header">
            <div>
              <strong class="lead-name">${escapeHtml(lead.recruiterName)}</strong>
              ${lead.company ? `<span class="lead-company">@ ${escapeHtml(lead.company)}</span>` : ''}
            </div>
            <span class="lead-status-pill ${isSent ? 'sent' : 'pending'}">${isSent ? '✅ Sent' : '⏳ Pending'}</span>
          </div>

          <div style="font-size:11px; color:#38bdf8; font-weight:600; margin-bottom:4px;">
            💼 ${escapeHtml(lead.jobTitle)}
          </div>

          <div style="font-size:12px; color:#818cf8; font-weight:700; margin-bottom:6px;">
            ✉️ ${escapeHtml(lead.email)}
          </div>

          ${lead.postSnippet ? `<div style="font-size:10px; color:#94a3b8; line-height:1.4; margin-bottom:8px; background:rgba(0,0,0,0.25); padding:4px 6px; border-radius:4px;">${escapeHtml(lead.postSnippet)}</div>` : ''}

          <div class="lead-actions" style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="li-email-btn li-email-btn-primary btn-lead-send" data-id="${lead.id}" style="flex:2; font-size:11px; padding:5px 8px;">
              <span>✉️ Send Email</span>
            </button>
            <button class="li-email-btn li-email-btn-secondary btn-lead-copy" data-email="${escapeHtml(lead.email)}" style="flex:1; font-size:11px; padding:5px 8px;">
              <span>📋 Copy</span>
            </button>
            <button class="li-email-btn li-email-btn-danger btn-lead-del" data-id="${lead.id}" style="padding:5px 8px; font-size:11px;">
              <span>🗑️</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach actions
    listEl.querySelectorAll('.btn-lead-send').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const lead = extractedLeads.find(l => l.id === id);
        if (lead) dispatchEmailOutreach(lead);
      });
    });

    listEl.querySelectorAll('.btn-lead-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const email = btn.getAttribute('data-email');
        navigator.clipboard.writeText(email);
        btn.querySelector('span').textContent = '✅ Copied';
        setTimeout(() => { btn.querySelector('span').textContent = '📋 Copy'; }, 2000);
      });
    });

    listEl.querySelectorAll('.btn-lead-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        extractedLeads = extractedLeads.filter(l => l.id !== id);
        chrome.storage.local.set({ emailLeads: extractedLeads });
        renderLeadsList();
      });
    });
  }

  function updateStatsBar() {
    const totalLeadsEl = document.getElementById('stat-email-total-leads');
    const sentLeadsEl = document.getElementById('stat-email-sent-leads');
    const dupesCountEl = document.getElementById('stat-email-dupes-count');

    const total = extractedLeads.length;
    const sent = extractedLeads.filter(l => l.status === 'sent' || contactedEmails.has(l.email.toLowerCase().trim())).length;

    if (totalLeadsEl) totalLeadsEl.textContent = total;
    if (sentLeadsEl) sentLeadsEl.textContent = sent;
    if (dupesCountEl) dupesCountEl.textContent = duplicateCount;
  }

  function exportLeadsToCSV() {
    if (extractedLeads.length === 0) {
      alert('No leads to export.');
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
    logTerminal('📥 Exported leads to CSV successfully!', 'success');
  }

  function clearPendingLeads() {
    if (!confirm('Clear all pending leads? Contacted/Sent leads will be preserved.')) return;
    extractedLeads = extractedLeads.filter(l => l.status === 'sent' || contactedEmails.has(l.email.toLowerCase().trim()));
    chrome.storage.local.set({ emailLeads: extractedLeads });
    renderLeadsList();
    logTerminal('🗑️ Cleared pending leads.', 'info');
  }

  function runDiagnostics() {
    logTerminal('🔍 Running Email Outreach Pro diagnostics...', 'info');
    const posts = findAllPostElements();
    logTerminal(`DOM Status: Found ${posts.length} candidate post cards on ${window.location.pathname}`, 'info');

    let withEmails = 0;
    for (const p of posts) {
      const txt = getAllTextFromPost(p);
      const emails = extractEmailsFromPost(p, txt);
      if (emails.length > 0) withEmails++;
    }
    logTerminal(`Email Extraction: ${withEmails} of ${posts.length} visible posts contain valid recruiter emails.`, 'success');
    logTerminal(`Storage State: ${extractedLeads.length} saved leads, ${contactedEmails.size} contacted emails.`, 'info');
  }

  // ── DRAGGABLE HELPER ──────────────────────────────────────────────────────

  function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      element.style.top = (element.offsetTop - pos2) + 'px';
      element.style.left = (element.offsetLeft - pos1) + 'px';
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
      try {
        localStorage.setItem('li_email_widget_pos', JSON.stringify({
          top: element.style.top,
          left: element.style.left
        }));
      } catch {}
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

  // ── MESSAGES & ROUTING ────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'TRIGGER_EMAIL_AUTO_SEND_ALL') {
      startAutoSendingQueue();
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'EMAIL_LEAD_SENT') {
      const email = msg.payload?.email?.toLowerCase().trim();
      if (email) {
        contactedEmails.add(email);
        extractedLeads.forEach(l => {
          if (l.email.toLowerCase().trim() === email) l.status = 'sent';
        });
        renderLeadsList();
      }
      sendResponse({ ok: true });
      return true;
    }

    return true;
  });

  // ── INITIALIZATION ────────────────────────────────────────────────────────

  async function init() {
    await loadStorage();
    injectFloatingWidget();
    checkModuleVisibility();

    // Re-check on hash change or navigation
    window.addEventListener('hashchange', checkModuleVisibility);
    window.addEventListener('popstate', checkModuleVisibility);

    // Initial DOM scan after 2 seconds
    setTimeout(() => {
      scanCurrentDOMForLeads();
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
