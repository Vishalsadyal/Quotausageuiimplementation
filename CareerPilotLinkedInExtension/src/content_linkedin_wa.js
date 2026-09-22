/**
 * LinkedIn to WhatsApp Job Outreach Pro - LinkedIn Content Script
 * Robust scraper with duplicate tracking & automatic post removal after outreach.
 */

(function () {
  'use strict';

  if (window.__linkedInWhatsAppOutreachInjected) return;
  window.__linkedInWhatsAppOutreachInjected = true;

  console.log('%c[LinkedIn-WA] Content script initialized on ' + window.location.href, 'color: #25D366; font-weight: bold; font-size: 13px;');

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
      'field engineer'
    ],
    messageTemplate: `Hi {name}!

I saw your hiring post on LinkedIn regarding the {job_title} role.

I am actively looking for new opportunities. Feel free to check out my portfolio & recent work (specializing in WordPress, Shopify, PHP & Web Development):
🌐 https://parveen-portfolio-xi.vercel.app/

I am available for immediate joining and would love to connect and share more details!

Best regards,
Parveen`,
    autoSendWhatsApp: true,       // Auto-send on WhatsApp Web
    autoCloseTab: true,           // Auto-close WhatsApp Web tab after send
    autoLikePosts: true,
    showAlreadyContacted: true,   // Keep all posts visible
    filterJobSeekers: true,
    autoScroll: true,
    matchAllHiringPosts: true,
    removeSentPostFromFeed: false,// Keep all elements intact in feed
    hideNonWhatsAppPosts: false,  // Keep all posts visible in feed
    debugMode: true,
    delayBetweenMessages: 4
  };

  let extractedLeads = [];
  let contactedPhones = new Set();
  let duplicateCount = 0;
  let isScanning = false;
  let isPaused = false;
  let isWidgetMinimized = false;
  let currentTab = 'search';
  let activeLeadFilter = 'all'; // 'all', 'pending', 'sent'

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

  // Load storage
  async function loadStorage() {
    try {
      const data = await chrome.storage.local.get(['waSettings', 'waLeads', 'contactedPhones', 'duplicateStats']);
      if (data.waSettings) settings = { ...settings, ...data.waSettings };
      if (Array.isArray(data.waLeads)) extractedLeads = data.waLeads;
      if (Array.isArray(data.contactedPhones)) contactedPhones = new Set(data.contactedPhones);
      if (data.duplicateStats && typeof data.duplicateStats.skippedCount === 'number') {
        duplicateCount = data.duplicateStats.skippedCount;
      }
    } catch (e) {
      console.error('[LinkedIn-WA] Load storage error:', e);
    }
  }

  // ── FLOATING WIDGET UI ────────────────────────────────────────────────────

  function checkModuleVisibility() {
    const widget = document.getElementById('li-wa-widget');
    if (!widget) return;
    const hash = (window.location.hash || '').toLowerCase();

    // If explicit module requested
    if (hash.includes('autoapply-module=whatsapp') || hash.includes('module=whatsapp')) {
      widget.style.display = 'block';
      return;
    }

    // If another module was requested
    if (
      hash.includes('autoapply-module=email') ||
      hash.includes('module=email') ||
      hash.includes('autoapply-module=commenter') ||
      hash.includes('module=commenter') ||
      hash.includes('autoapply-module=easy_apply') ||
      hash.includes('module=easy_apply') ||
      hash.includes('autoapply-module=hr_leads') ||
      hash.includes('module=hr_leads')
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
    if (document.getElementById('li-wa-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'li-wa-widget';
    widget.className = 'li-wa-container';
    widget.innerHTML = `
      <div class="li-wa-header" id="li-wa-drag-header">
        <div class="li-wa-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2z"/></svg>
          <span>WhatsApp Job Outreach Pro</span>
        </div>
        <div class="li-wa-window-actions">
          <button class="li-wa-btn-icon" id="li-wa-min-btn" title="Minimize / Expand">_</button>
        </div>
      </div>

      <div class="li-wa-nav">
        <button class="li-wa-tab-btn active" id="tab-search">🔍 Quick Search</button>
        <button class="li-wa-tab-btn" id="tab-leads">📋 Leads (<span id="lead-count-badge">0</span>)</button>
        <button class="li-wa-tab-btn" id="tab-settings">⚙️ Settings</button>
        <button class="li-wa-tab-btn" id="tab-logs">📜 Console & Diag</button>
      </div>

      <div class="li-wa-body" id="li-wa-body">
        <!-- SEARCH PANE -->
        <div id="pane-search" class="li-wa-pane active">
          <div class="li-wa-search-box">
            <label class="li-wa-label">🎯 Search Hiring Posts on LinkedIn:</label>
            <div class="li-wa-search-input-group">
              <input type="text" id="widget-search-query" class="li-wa-input" placeholder="e.g. WordPress developer hiring whatsapp" />
              <button class="li-wa-btn li-wa-btn-primary" id="btn-exec-search">
                <span>🔍 Search</span>
              </button>
            </div>
            <div class="li-wa-chips-row">
              <span class="li-wa-quick-chip" data-q="WordPress developer hiring whatsapp">🌐 WordPress</span>
              <span class="li-wa-quick-chip" data-q="React developer hiring whatsapp">⚛️ React Dev</span>
              <span class="li-wa-quick-chip" data-q="Web developer hiring whatsapp">💻 Web Dev</span>
              <span class="li-wa-quick-chip" data-q="Frontend developer hiring whatsapp">🎨 Frontend</span>
              <span class="li-wa-quick-chip" data-q="Electrical fresher hiring whatsapp">⚡ Electrical</span>
              <span class="li-wa-quick-chip" data-q="Field engineer hiring whatsapp">🔌 Field Engineer</span>
            </div>
          </div>

          <div class="li-wa-toolbar" style="margin-top: 10px; display:flex; gap:6px; flex-wrap:wrap;">
            <button class="li-wa-btn li-wa-btn-primary" id="btn-start-scan" style="flex:1;">
              <span>🚀 Scan Feed</span>
            </button>
            <button class="li-wa-btn" id="btn-deep-scroll" style="flex:1.1; background:linear-gradient(135deg, #0ea5e9, #0284c7); color:#ffffff; font-weight:700; border:none; box-shadow:0 2px 8px rgba(14,165,233,0.35); display:flex; align-items:center; justify-content:center; gap:4px; cursor:pointer; border-radius:6px; padding:7px 10px; font-size:12px;">
              <span>📜 Full Auto-Scroll</span>
            </button>
            <button class="li-wa-btn li-wa-btn-wa" id="btn-auto-send-all" style="flex:1.2; background:#25D366; color:#0f172a; font-weight:700; border:none; box-shadow:0 2px 8px rgba(37,211,102,0.3); display:flex; align-items:center; justify-content:center; gap:4px;">
              <span>⚡ Auto-Send WhatsApp</span>
            </button>
            <button class="li-wa-btn li-wa-btn-pause" id="btn-pause-scan" style="display:none;">
              <span>⏸️ Pause</span>
            </button>
          </div>

          <div style="margin-top: 8px; padding: 6px 10px; background: rgba(15, 23, 42, 0.4); border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between;">
            <label class="li-wa-checkbox" style="margin: 0; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <input type="checkbox" id="quick-check-show-contacted" ${settings.showAlreadyContacted ? 'checked' : ''} />
              <span style="color: #cbd5e1; font-weight: 500;">👁️ Show Already Contacted Posts</span>
            </label>
            <span id="quick-status-contacted" style="font-size: 10px; color: ${settings.showAlreadyContacted ? '#22c55e' : '#94a3b8'}; font-weight: 600;">${settings.showAlreadyContacted ? 'Visible' : 'Hidden'}</span>
          </div>

          <div class="li-wa-stats-bar">
            <div>Cards: <b id="stat-posts-seen">0</b></div>
            <div>Matched: <b id="stat-total-leads" style="color:#25D366;">0</b></div>
            <div>Sent: <b id="stat-sent-leads" style="color:#38bdf8;">0</b></div>
            <div>🔁 Dupes: <b id="stat-dupes-count" style="color:#fbbf24;">0</b></div>
          </div>
        </div>

        <!-- LEADS PANE -->
        <div id="pane-leads" class="li-wa-pane" style="display:none;">
          <div class="li-wa-subnav">
            <button class="li-wa-filter-btn active" data-filter="all">All (<span id="count-filter-all">0</span>)</button>
            <button class="li-wa-filter-btn" data-filter="pending">⏳ Pending (<span id="count-filter-pending">0</span>)</button>
            <button class="li-wa-filter-btn" data-filter="sent">✅ Sent (<span id="count-filter-sent">0</span>)</button>
          </div>

          <div class="li-wa-toolbar" style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
            <button class="li-wa-btn li-wa-btn-wa" id="btn-leads-auto-send" style="flex:1.2; background:#25D366; color:#0f172a; font-weight:700; border:none; box-shadow:0 2px 8px rgba(37,211,102,0.3); display:flex; align-items:center; justify-content:center; gap:4px;">
              <span>⚡ Auto-Send Pending (<span id="count-btn-pending">0</span>)</span>
            </button>
            <button class="li-wa-btn li-wa-btn-secondary" id="btn-export-csv" title="Export leads to CSV" style="padding:6px 10px;">
              <span>📥 CSV</span>
            </button>
            <button class="li-wa-btn li-wa-btn-danger" id="btn-clear-leads" title="Clear pending leads" style="padding:6px 10px;">
              <span>🗑️ Clear</span>
            </button>
          </div>

          <div class="li-wa-leads-list" id="li-wa-leads-list">
            <div class="li-wa-empty-state">
              No WhatsApp leads extracted yet.<br>
              Click <b>"🚀 Scan Feed & Match Leads"</b> or search hiring posts!
            </div>
          </div>
        </div>

        <!-- SETTINGS PANE -->
        <div id="pane-settings" class="li-wa-pane" style="display:none;">
          <div class="li-wa-field-group">
            <label class="li-wa-label">🎯 Target Keywords (comma separated):</label>
            <input type="text" id="input-keywords" class="li-wa-input" value="${settings.targetKeywords.join(', ')}" />
            <span class="li-wa-hint">Example: wordpress, react, web developer, php, shopify, electrical, fresher</span>
          </div>

          <div class="li-wa-field-group">
            <label class="li-wa-label">💬 WhatsApp Outreach Message Template:</label>
            <div class="li-wa-chips">
              <span class="li-wa-chip" data-token="{name}">+ {name}</span>
              <span class="li-wa-chip" data-token="{job_title}">+ {job_title}</span>
              <span class="li-wa-chip" data-token="{company}">+ {company}</span>
              <span class="li-wa-chip" data-token="{phone}">+ {phone}</span>
            </div>
            <textarea id="input-template" class="li-wa-textarea" rows="5">${settings.messageTemplate}</textarea>
          </div>

          <div class="li-wa-options">
            <label class="li-wa-checkbox">
              <input type="checkbox" id="check-hide-non-wa" ${settings.hideNonWhatsAppPosts !== false ? 'checked' : ''} />
              <span>🎯 <b>Hide Non-WhatsApp Posts (Brings WhatsApp Jobs to Top)</b></span>
            </label>
            <label class="li-wa-checkbox">
              <input type="checkbox" id="check-show-contacted" ${settings.showAlreadyContacted ? 'checked' : ''} />
              <span>👁️ <b>Show Already Contacted Posts (Uncheck to hide already sent posts)</b></span>
            </label>
            <label class="li-wa-checkbox">
              <input type="checkbox" id="check-auto-like" ${settings.autoLikePosts !== false ? 'checked' : ''} />
              <span>👍 <b>Auto-Like Recruiter Hiring Posts on LinkedIn</b></span>
            </label>
            <label class="li-wa-checkbox">
              <input type="checkbox" id="check-remove-sent" ${settings.removeSentPostFromFeed !== false ? 'checked' : ''} />
              <span>🚪 <b>Auto-Remove post from feed after message sent (Brings next post to top)</b></span>
            </label>
            <label class="li-wa-checkbox">
              <input type="checkbox" id="check-match-all" ${settings.matchAllHiringPosts ? 'checked' : ''} />
              <span>🌟 Match All Hiring Posts with Phone (Broad Reach)</span>
            </label>
            <label class="li-wa-checkbox">
              <input type="checkbox" id="check-auto-send" ${settings.autoSendWhatsApp ? 'checked' : ''} />
              <span>⚡ Auto-Click Send on WhatsApp Web</span>
            </label>
            <label class="li-wa-checkbox">
              <input type="checkbox" id="check-auto-close" ${settings.autoCloseTab ? 'checked' : ''} />
              <span>🚪 Auto-Close WhatsApp Tab after sending</span>
            </label>
            <label class="li-wa-checkbox">
              <input type="checkbox" id="check-filter-seekers" ${settings.filterJobSeekers ? 'checked' : ''} />
              <span>🛡️ Filter out Job Seekers / #OpenToWork</span>
            </label>
            <label class="li-wa-checkbox">
              <input type="checkbox" id="check-auto-scroll" ${settings.autoScroll ? 'checked' : ''} />
              <span>📜 Auto-Scroll feed during active scan</span>
            </label>
          </div>

          <button class="li-wa-btn li-wa-btn-primary" id="btn-save-settings" style="width:100%; margin-top:10px;">
            <span>💾 Save Settings</span>
          </button>
        </div>

        <!-- LOGS PANE -->
        <div id="pane-logs" class="li-wa-pane" style="display:none;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <button class="li-wa-btn li-wa-btn-secondary" id="btn-run-diag" style="font-size:10px; padding:4px 8px;">
              🔍 Run Diagnostics Scan
            </button>
          </div>
          <div class="li-wa-terminal" id="li-wa-terminal">
            <div class="term-line info">[System] WhatsApp Job Outreach ready on ${window.location.hostname}.</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(widget);
    setupWidgetEvents();
    renderLeadsList();
    makeDraggable(widget, document.getElementById('li-wa-drag-header'));
  }

  function setupWidgetEvents() {
    const minBtn = document.getElementById('li-wa-min-btn');
    const tabSearch = document.getElementById('tab-search');
    const tabLeads = document.getElementById('tab-leads');
    const tabSettings = document.getElementById('tab-settings');
    const tabLogs = document.getElementById('tab-logs');
    const paneSearch = document.getElementById('pane-search');
    const paneLeads = document.getElementById('pane-leads');
    const paneSettings = document.getElementById('pane-settings');
    const paneLogs = document.getElementById('pane-logs');

    // Minimize
    minBtn?.addEventListener('click', () => {
      isWidgetMinimized = !isWidgetMinimized;
      const body = document.getElementById('li-wa-body');
      const nav = document.querySelector('.li-wa-nav');
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
    document.querySelectorAll('.li-wa-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.li-wa-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeLeadFilter = btn.getAttribute('data-filter') || 'all';
        renderLeadsList();
      });
    });

    // Diagnostics button
    document.getElementById('btn-run-diag')?.addEventListener('click', () => {
      runDiagnostics();
    });

    // Search Trigger
    const searchInput = document.getElementById('widget-search-query');
    const searchBtn = document.getElementById('btn-exec-search');

    function performSearch(query) {
      const q = (query || '').trim();
      if (!q) {
        alert('Please enter keywords to search.');
        return;
      }
      logTerminal(`🔍 Navigating to LinkedIn Content Search for: "${q}"...`, 'info');
      const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(q)}&sortBy=%5B%22date_posted%22%5D`;
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
    document.querySelectorAll('.li-wa-quick-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.getAttribute('data-q');
        if (searchInput) searchInput.value = query;
        performSearch(query);
      });
    });

    // Token Chips in Template editor
    document.querySelectorAll('.li-wa-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const token = chip.getAttribute('data-token');
        const textarea = document.getElementById('input-template');
        if (textarea && token) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          textarea.value = textarea.value.substring(0, start) + token + textarea.value.substring(end);
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = start + token.length;
        }
      });
    });

    // Save Settings
    document.getElementById('btn-save-settings')?.addEventListener('click', saveSettingsFromUI);

    // Start / Pause Scanner
    document.getElementById('btn-start-scan')?.addEventListener('click', () => {
      if (isScanning) {
        stopScanner();
      } else {
        startScanner();
      }
    });

    // Deep Full Auto-Scroll Button
    document.getElementById('btn-deep-scroll')?.addEventListener('click', () => {
      startFullAutoScroll();
    });

    // Auto-Send to WhatsApp Queue Buttons
    document.getElementById('btn-auto-send-all')?.addEventListener('click', () => {
      startAutoSendingQueue();
    });

    document.getElementById('btn-leads-auto-send')?.addEventListener('click', () => {
      startAutoSendingQueue();
    });

    document.getElementById('btn-pause-scan')?.addEventListener('click', () => {
      isPaused = !isPaused;
      const pauseBtn = document.getElementById('btn-pause-scan');
      if (pauseBtn) pauseBtn.querySelector('span').textContent = isPaused ? '▶️ Resume' : '⏸️ Pause';
      logTerminal(isPaused ? 'Scanner paused.' : 'Scanner resumed.', 'warning');
    });

    // Quick Toggle & Settings Toggle for Show Already Contacted
    const quickContactedToggle = document.getElementById('quick-check-show-contacted');
    const settingsContactedToggle = document.getElementById('check-show-contacted');
    const quickStatusContacted = document.getElementById('quick-status-contacted');

    function handleContactedToggleChange(isChecked) {
      settings.showAlreadyContacted = isChecked;
      if (quickContactedToggle) quickContactedToggle.checked = isChecked;
      if (settingsContactedToggle) settingsContactedToggle.checked = isChecked;
      if (quickStatusContacted) {
        quickStatusContacted.textContent = isChecked ? 'Visible' : 'Hidden';
        quickStatusContacted.style.color = isChecked ? '#22c55e' : '#94a3b8';
      }
      chrome.storage.local.set({ waSettings: settings });
      logTerminal(isChecked ? '👁️ Showing already contacted recruiter posts in LinkedIn feed.' : '🚫 Hiding already contacted recruiter posts from LinkedIn feed.', 'info');
      // Instantly refresh feed visibility
      scanCurrentDOMForLeads();
    }

    quickContactedToggle?.addEventListener('change', (e) => handleContactedToggleChange(e.target.checked));
    settingsContactedToggle?.addEventListener('change', (e) => handleContactedToggleChange(e.target.checked));

    // Clear leads & history
    document.getElementById('btn-clear-leads')?.addEventListener('click', () => {
      if (confirm('Clear all leads and reset contacted history for fresh outreach testing?')) {
        extractedLeads = [];
        contactedPhones = new Set();
        duplicateCount = 0;
        chrome.storage.local.set({ waLeads: [], contactedPhones: [], contactedLog: [], duplicateStats: { skippedCount: 0 } });
        renderLeadsList();
        logTerminal('Cleared all leads & reset contact history.', 'info');
        scanCurrentDOMForLeads();
      }
    });

    // Export CSV
    document.getElementById('btn-export-csv')?.addEventListener('click', exportLeadsToCSV);
  }

  function saveSettingsFromUI() {
    const kwInput = document.getElementById('input-keywords');
    const tplInput = document.getElementById('input-template');
    const hideNonWaCheck = document.getElementById('check-hide-non-wa');
    const showContactedCheck = document.getElementById('check-show-contacted');
    const autoLikeCheck = document.getElementById('check-auto-like');
    const removeSentCheck = document.getElementById('check-remove-sent');
    const matchAllCheck = document.getElementById('check-match-all');
    const autoSendCheck = document.getElementById('check-auto-send');
    const autoCloseCheck = document.getElementById('check-auto-close');
    const filterSeekersCheck = document.getElementById('check-filter-seekers');
    const autoScrollCheck = document.getElementById('check-auto-scroll');

    const rawKws = kwInput ? kwInput.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : settings.targetKeywords;
    
    settings.targetKeywords = rawKws.length > 0 ? rawKws : ['wordpress', 'react', 'web developer', 'fresher'];
    settings.messageTemplate = tplInput ? tplInput.value.trim() : settings.messageTemplate;
    settings.hideNonWhatsAppPosts = hideNonWaCheck ? hideNonWaCheck.checked : true;
    settings.showAlreadyContacted = showContactedCheck ? showContactedCheck.checked : false;
    settings.autoLikePosts = autoLikeCheck ? autoLikeCheck.checked : true;
    settings.removeSentPostFromFeed = removeSentCheck ? removeSentCheck.checked : true;
    settings.matchAllHiringPosts = matchAllCheck ? matchAllCheck.checked : true;
    settings.autoSendWhatsApp = autoSendCheck ? autoSendCheck.checked : true;
    settings.autoCloseTab = autoCloseCheck ? autoCloseCheck.checked : true;
    settings.filterJobSeekers = filterSeekersCheck ? filterSeekersCheck.checked : true;
    settings.autoScroll = autoScrollCheck ? autoScrollCheck.checked : true;

    // Sync quick toggle
    const quickContactedToggle = document.getElementById('quick-check-show-contacted');
    const quickStatusContacted = document.getElementById('quick-status-contacted');
    if (quickContactedToggle) quickContactedToggle.checked = settings.showAlreadyContacted;
    if (quickStatusContacted) {
      quickStatusContacted.textContent = settings.showAlreadyContacted ? 'Visible' : 'Hidden';
      quickStatusContacted.style.color = settings.showAlreadyContacted ? '#22c55e' : '#94a3b8';
    }

    chrome.storage.local.set({ waSettings: settings });
    logTerminal('Settings saved successfully!', 'success');
    scanCurrentDOMForLeads();
    alert('Settings saved!');
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
    updateScanButtons(true);
    logTerminal('🚀 Starting LinkedIn Scanner for Hiring Posts & WhatsApp Numbers...', 'info');
    runScanLoop();
  }

  function stopScanner() {
    isScanning = false;
    isPaused = false;
    isFullScrolling = false;
    updateScanButtons(false);
    updateFullScrollButton(false);
    logTerminal('⏹️ Scanner stopped.', 'info');
  }

  function updateScanButtons(scanning) {
    const startBtn = document.getElementById('btn-start-scan');
    const pauseBtn = document.getElementById('btn-pause-scan');
    if (startBtn) {
      startBtn.className = scanning ? 'li-wa-btn li-wa-btn-danger' : 'li-wa-btn li-wa-btn-primary';
      startBtn.querySelector('span').textContent = scanning ? '⏹️ Stop Scan' : '🚀 Scan Feed & Match Leads';
    }
    if (pauseBtn) {
      pauseBtn.style.display = scanning ? 'flex' : 'none';
    }
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
        logTerminal(`✨ Found ${newLeadsFound} new hiring lead(s) with WhatsApp numbers!`, 'success');
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
      updateScanButtons(false);
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
          focusAndHighlightPost(newestPost, '#22c55e');
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
      logTerminal(`🎉 Full Scroll complete! Extracted total ${extractedLeads.length} leads from ${findAllPostElements().length} posts.`, 'success');
    }
  }

  function stopFullAutoScroll() {
    isFullScrolling = false;
    isScanning = false;
    updateFullScrollButton(false);
    updateScanButtons(false);
    logTerminal('🛑 Full Auto-Scroll stopped immediately.', 'warning');
  }

  function updateFullScrollButton(running) {
    const btn = document.getElementById('btn-deep-scroll');
    if (btn) {
      btn.style.background = running ? '#ef4444' : 'linear-gradient(135deg, #0ea5e9, #0284c7)';
      const span = btn.querySelector('span');
      if (span) span.textContent = running ? '⏹️ Stop Full Scroll' : '📜 Full Auto-Scroll';
    }
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

  // Diagnostics runner
  function runDiagnostics() {
    expandAllSeeMoreButtons();
    const posts = findAllPostElements();
    logTerminal(`[Diagnostics] Found ${posts.length} post containers on screen.`, 'info');
    console.log('%c[LinkedIn-WA] Diagnostics Report - Posts on screen: ' + posts.length, 'color: #38bdf8; font-weight: bold;');

    posts.forEach((post, i) => {
      const fullText = getAllTextFromPost(post).trim();
      const author = getPostAuthor(post);
      const phones = extractPhoneNumbersFromPost(post, fullText);
      const isSeeker = settings.filterJobSeekers && isJobSeekerPost(post, fullText);
      const matchedKw = matchTargetKeywords(fullText);

      console.log(`[Post #${i + 1}] Author: ${author} | Phones: [${phones.join(', ')}] | Seeker: ${isSeeker} | Keyword: ${matchedKw || 'None'}`);
      
      if (phones.length > 0) {
        logTerminal(`Card #${i+1} (${author}): Phone +${phones.join(', +')} | Role: ${matchedKw || 'Hiring'}`, 'success');
      }
    });
  }

  // Scan all visible posts on the page (Non-destructive: keeps all posts in feed)
  function scanCurrentDOMForLeads() {
    expandAllSeeMoreButtons();
    const postElements = findAllPostElements();
    const statPostsSeen = document.getElementById('stat-posts-seen');
    if (statPostsSeen) statPostsSeen.textContent = `${postElements.length}`;

    let newCount = 0;
    let sessionDupes = 0;

    for (const post of postElements) {
      const postText = getAllTextFromPost(post).trim();
      if (!postText) continue;

      // 1. Check Job Seeker filter
      const isSeeker = settings.filterJobSeekers && isJobSeekerPost(post, postText);
      if (isSeeker) continue;

      // 2. Extract Phone / WhatsApp Numbers from text & links
      const phones = extractPhoneNumbersFromPost(post, postText);
      if (!phones || phones.length === 0) continue;

      // 3. Match Job Titles & Keywords
      const matchedKeyword = matchTargetKeywords(postText);
      if (!matchedKeyword && !settings.matchAllHiringPosts) continue;

      // 4. Extract Post Details
      const urn = getPostUrn(post);
      const author = getPostAuthor(post);
      const company = extractCompany(post, postText);
      const jobTitle = extractJobTitle(postText, matchedKeyword || 'Job Role');

      for (const phone of phones) {
        const cleanPhone = cleanPhoneNumber(phone);
        if (!cleanPhone || cleanPhone.length < 10) continue;

        // Check if phone was already contacted
        const isContacted = contactedPhones.has(cleanPhone);

        // Check if already in extractedLeads (Duplicate)
        const existingLead = extractedLeads.find(l => l.cleanPhone === cleanPhone || (urn && l.urn === urn && l.cleanPhone === cleanPhone));
        if (existingLead) {
          injectPostActionBadge(post, existingLead);
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

        console.log('%c[LinkedIn-WA] Extracted Lead: ' + author + ' (' + jobTitle + ') -> +' + cleanPhone + (isContacted ? ' [Already Sent]' : ''), 'color: #25D366; font-weight: bold;');

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
      updateStatsBar();
      console.log(`%c[LinkedIn-WA] Scanned ${postElements.length} posts | Found ${newCount} new WhatsApp lead(s)!`, 'color: #25D366; font-weight: bold;');
    }

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
          <span style="font-size:14px;">🟢</span>
          <span class="badge-tag" style="font-size:12px; font-weight:700; color:#38bdf8;">
            ${escapeHtml(lead.recruiterName)} &bull; ${escapeHtml(lead.jobTitle)}
          </span>
          <span style="font-size:11px; font-weight:700; color:#25D366;">📞 +${lead.cleanPhone}</span>
          ${isSent ? '<span style="font-size:10px; color:#22c55e; background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.3); padding:2px 7px; border-radius:10px; font-weight:600;">✅ Contacted</span>' : '<span style="font-size:10px; color:#fbbf24; background:rgba(251,191,36,0.15); border:1px solid rgba(251,191,36,0.3); padding:2px 7px; border-radius:10px; font-weight:600;">⚡ WhatsApp Lead</span>'}
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

  function dispatchOutreach(lead, originPostEl = null, forceAutoSend = false) {
    return new Promise((resolve) => {
      logTerminal(`📲 Opening WhatsApp for ${lead.recruiterName} (+${lead.cleanPhone})...`, 'info');

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
          logTerminal(`✅ WhatsApp Web opened for +${lead.cleanPhone}!`, 'success');

          // If card was clicked directly on LinkedIn and removal is enabled, collapse it
          if (originPostEl && settings.removeSentPostFromFeed) {
            setTimeout(() => {
              animateCardRemoval(originPostEl);
            }, 600);
          }
          resolve({ success: true, tabId: response.tabId });
        } else {
          logTerminal(`❌ Failed to dispatch WhatsApp: ${response?.error || 'Unknown error'}`, 'error');
          lead.status = 'pending';
          renderLeadsList();
          resolve({ success: false, error: response?.error });
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
    logTerminal(`⏳ Processing auto-send for +${lead.cleanPhone} (waiting for dispatch & tab completion)...`, 'info');

    // Wait until the message is confirmed sent OR the tab completes/closes (up to 120s for slow network)
    const startTime = Date.now();
    const maxWaitMs = 120000;

    while (Date.now() - startTime < maxWaitMs) {
      if (!isAutoSending) break;
      await sleep(1000);

      // 1. Check if lead was marked sent in memory / storage
      if (contactedPhones.has(lead.cleanPhone)) {
        logTerminal(`🎉 Outreach confirmed sent to +${lead.cleanPhone}!`, 'success');
        break;
      }

      // 2. Check if lead was marked invalid (Not on WhatsApp)
      const invData = await chrome.storage.local.get(['invalidPhones']);
      if (invData.invalidPhones && invData.invalidPhones.includes(lead.cleanPhone)) {
        logTerminal(`❌ Recruiter (+${lead.cleanPhone}) isn't on WhatsApp. Skipping lead...`, 'error');
        lead.status = 'invalid';
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
          logTerminal(`🚪 WhatsApp tab finished & closed for +${lead.cleanPhone}.`, 'info');
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
    } else if (contactedPhones.has(lead.cleanPhone)) {
      lead.status = 'sent';
    } else {
      // If time expired or user closed early, check storage once
      const data = await chrome.storage.local.get(['contactedPhones']);
      if (data.contactedPhones && data.contactedPhones.includes(lead.cleanPhone)) {
        contactedPhones.add(lead.cleanPhone);
        lead.status = 'sent';
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
    logTerminal(`⏳ Pausing ${cooldown}s before next contact...`, 'info');
    await sleep(cooldown * 1000);
    return res;
  }

  async function startAutoSendingQueue() {
    if (isAutoSending) {
      stopAutoSendingQueue();
      return;
    }

    let pendingLeads = extractedLeads.filter(l => l.status !== 'sent' && l.status !== 'invalid' && !contactedPhones.has(l.cleanPhone));

    if (pendingLeads.length === 0) {
      logTerminal('🔍 Scanning feed for verified WhatsApp hiring posts first...', 'info');
      expandAllSeeMoreButtons();
      scanCurrentDOMForLeads();
      renderLeadsList();
      pendingLeads = extractedLeads.filter(l => l.status !== 'sent' && l.status !== 'invalid' && !contactedPhones.has(l.cleanPhone));
    }

    if (pendingLeads.length === 0) {
      logTerminal('⚠️ No verified WhatsApp hiring leads found. Try searching keywords or scrolling feed.', 'warning');
      alert('No pending WhatsApp hiring leads found! Please scroll through LinkedIn feed or search hiring keywords first.');
      return;
    }

    isAutoSending = true;
    updateAutoSendButtons(true);
    logTerminal(`⚡ Starting Single-Tab Auto-Outreach to ${pendingLeads.length} recruiter(s)...`, 'success');

    for (let i = 0; i < pendingLeads.length; i++) {
      if (!isAutoSending) {
        logTerminal('⏸️ Auto-sending stopped by user.', 'warning');
        break;
      }

      const lead = pendingLeads[i];
      if (contactedPhones.has(lead.cleanPhone)) {
        logTerminal(`⏩ Skipping +${lead.cleanPhone} (Already contacted).`, 'info');
        lead.status = 'sent';
        continue;
      }

      updateAutoSendButtonText(`⏸️ Stop (${i + 1}/${pendingLeads.length})`);
      logTerminal(`[${i + 1}/${pendingLeads.length}] 🚀 Processing WhatsApp for ${lead.recruiterName} (+${lead.cleanPhone})...`, 'info');

      // Move focus to the corresponding LinkedIn post and sidebar lead row
      const targetPost = findPostElementForLead(lead);
      if (targetPost) {
        focusAndHighlightPost(targetPost, '#25D366');
      }
      const leadRow = document.getElementById(`lead-item-${lead.id}`);
      if (leadRow) {
        leadRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      // Strictly open one tab at a time and wait for it to finish!
      await dispatchOutreachAndWait(lead);
    }

    isAutoSending = false;
    updateAutoSendButtons(false);
    logTerminal('🎉 Auto-Outreach queue completed! All leads processed one by one.', 'success');
  }

  function stopAutoSendingQueue() {
    isAutoSending = false;
    updateAutoSendButtons(false);
    logTerminal('🛑 Auto-Outreach queue stopped.', 'warning');
  }

  function updateAutoSendButtons(running) {
    const btn1 = document.getElementById('btn-auto-send-all');
    const btn2 = document.getElementById('btn-leads-auto-send');

    if (btn1) {
      btn1.style.background = running ? '#ef4444' : '#25D366';
      btn1.style.color = running ? '#ffffff' : '#0f172a';
      const span = btn1.querySelector('span');
      if (span) span.textContent = running ? '⏸️ Stop Auto-Send' : '⚡ Auto-Send WhatsApp';
    }

    if (btn2) {
      btn2.style.background = running ? '#ef4444' : '#25D366';
      btn2.style.color = running ? '#ffffff' : '#0f172a';
      const pendingCount = extractedLeads.filter(l => l.status !== 'sent').length;
      const span = btn2.querySelector('span');
      if (span) span.innerHTML = running ? '⏸️ Stop Auto-Send' : `⚡ Auto-Send Pending (<span id="count-btn-pending">${pendingCount}</span>)`;
    }
  }

  function updateAutoSendButtonText(text) {
    const btn1 = document.getElementById('btn-auto-send-all');
    const btn2 = document.getElementById('btn-leads-auto-send');
    if (btn1) {
      const span = btn1.querySelector('span');
      if (span) span.textContent = text;
    }
    if (btn2) {
      const span = btn2.querySelector('span');
      if (span) span.textContent = text;
    }
  }

  function updateStatsBar() {
    const countBadge = document.getElementById('lead-count-badge');
    const statTotal = document.getElementById('stat-total-leads');
    const statSent = document.getElementById('stat-sent-leads');
    const statDupes = document.getElementById('stat-dupes-count');
    const countFilterAll = document.getElementById('count-filter-all');
    const countFilterPending = document.getElementById('count-filter-pending');
    const countFilterSent = document.getElementById('count-filter-sent');
    const countBtnPending = document.getElementById('count-btn-pending');

    const sentCount = extractedLeads.filter(l => l.status === 'sent').length;
    const pendingCount = extractedLeads.length - sentCount;

    if (countBadge) countBadge.textContent = `${extractedLeads.length}`;
    if (statTotal) statTotal.textContent = `${extractedLeads.length}`;
    if (statSent) statSent.textContent = `${sentCount}`;
    if (statDupes) statDupes.textContent = `${duplicateCount}`;

    if (countFilterAll) countFilterAll.textContent = `${extractedLeads.length}`;
    if (countFilterPending) countFilterPending.textContent = `${pendingCount}`;
    if (countFilterSent) countFilterSent.textContent = `${sentCount}`;
    if (countBtnPending) countBtnPending.textContent = `${pendingCount}`;
  }

  function renderLeadsList() {
    updateStatsBar();

    const container = document.getElementById('li-wa-leads-list');
    if (!container) return;

    let itemsToRender = extractedLeads;
    if (activeLeadFilter === 'pending') {
      itemsToRender = extractedLeads.filter(l => l.status !== 'sent');
    } else if (activeLeadFilter === 'sent') {
      itemsToRender = extractedLeads.filter(l => l.status === 'sent');
    }

    if (itemsToRender.length === 0) {
      container.innerHTML = `
        <div class="li-wa-empty-state">
          No ${activeLeadFilter !== 'all' ? activeLeadFilter : ''} WhatsApp leads found.<br>
          Click <b>"🚀 Scan Feed & Match Leads"</b> to extract more!
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    itemsToRender.forEach(lead => {
      const isSent = lead.status === 'sent';
      const isInvalid = lead.status === 'invalid';
      const item = document.createElement('div');
      item.className = `li-wa-lead-card ${isSent ? 'sent' : ''} ${isInvalid ? 'invalid' : ''}`;
      
      let statusPill = `<span class="lead-status-pill pending">⏳ Ready</span>`;
      if (isSent) {
        statusPill = `<span class="lead-status-pill sent">✅ Sent</span>`;
      } else if (isInvalid) {
        statusPill = `<span class="lead-status-pill" style="background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.3);">❌ Not on WA</span>`;
      }

      item.innerHTML = `
        <div class="lead-header">
          <div class="lead-name">
            <b>${escapeHtml(lead.recruiterName)}</b>
            ${lead.company ? `<span class="lead-company">@ ${escapeHtml(lead.company)}</span>` : ''}
          </div>
          ${statusPill}
        </div>
        <div class="lead-title">🎯 ${escapeHtml(lead.jobTitle)}</div>
        <div class="lead-phone">📞 <b>+${lead.cleanPhone}</b></div>
        <div class="lead-snippet">"${escapeHtml(lead.postSnippet)}..."</div>
        <div class="lead-actions">
          <button class="li-wa-btn li-wa-btn-wa ${isSent ? 'btn-sent' : ''}" id="btn-wa-${lead.id}" ${isInvalid ? 'style="opacity:0.6;"' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2z"/></svg>
            <span>${isSent ? 'Message Again' : isInvalid ? 'Retry WhatsApp' : 'Send WhatsApp Message'}</span>
          </button>
        </div>
      `;

      item.querySelector(`#btn-wa-${lead.id}`)?.addEventListener('click', () => {
        dispatchOutreach(lead);
      });

      container.appendChild(item);
    });
  }

  function exportLeadsToCSV() {
    if (extractedLeads.length === 0) {
      alert('No leads available to export.');
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

  function logTerminal(text, type = 'info') {
    const terminal = document.getElementById('li-wa-terminal');
    if (!terminal) return;

    const line = document.createElement('div');
    line.className = `term-line ${type}`;
    const time = new Date().toLocaleTimeString();
    line.textContent = `[${time}] ${text}`;

    terminal.insertBefore(line, terminal.firstChild);
    while (terminal.children.length > 80) {
      terminal.removeChild(terminal.lastChild);
    }
  }

  function makeDraggable(el, handle) {
    let posX = 0, posY = 0, mouseX = 0, mouseY = 0;
    if (!handle) return;

    handle.onmousedown = (e) => {
      if (['BUTTON', 'INPUT', 'A', 'TEXTAREA'].includes(e.target.tagName)) return;
      e.preventDefault();
      mouseX = e.clientX;
      mouseY = e.clientY;
      document.onmouseup = () => {
        document.onmouseup = null;
        document.onmousemove = null;
      };
      document.onmousemove = (e2) => {
        e2.preventDefault();
        posX = mouseX - e2.clientX;
        posY = mouseY - e2.clientY;
        mouseX = e2.clientX;
        mouseY = e2.clientY;
        el.style.top = (el.offsetTop - posY) + 'px';
        el.style.left = (el.offsetLeft - posX) + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
      };
    };
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

  // Periodic passive DOM scan observer
  function setupDOMObserver() {
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!isScanning) {
          // Passive scan when user scrolls
          expandAllSeeMoreButtons();
          scanCurrentDOMForLeads();
          renderLeadsList();
        }
      }, 1500);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // SPA navigation detector
  function setupHistoryListener() {
    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('[LinkedIn-WA] URL changed to:', lastUrl);
        logTerminal(`Navigated to: ${window.location.pathname}`, 'info');
        setTimeout(() => {
          expandAllSeeMoreButtons();
          scanCurrentDOMForLeads();
          renderLeadsList();
        }, 2000);
      }
    }, 1000);
  }

  // Message listener for broadcast from background or WhatsApp Web
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'TRIGGER_AUTO_SEND_ALL') {
        startAutoSendingQueue();
        sendResponse({ success: true });
        return;
      }

      if (request.type === 'LEAD_MESSAGE_SENT') {
        const { phone, urn } = request.payload || {};
        console.log('[LinkedIn-WA] Received notification of sent message for +', phone);
        if (phone) {
          contactedPhones.add(phone);
          extractedLeads = extractedLeads.map(l => {
            if (l.cleanPhone === phone) return { ...l, status: 'sent' };
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
    injectFloatingWidget();
    checkModuleVisibility();
    window.addEventListener('hashchange', () => {
      checkModuleVisibility();
      setTimeout(() => {
        expandAllSeeMoreButtons();
        scanCurrentDOMForLeads();
        renderLeadsList();
      }, 500);
    });
    setupDOMObserver();
    setupHistoryListener();
    setupMessageListener();

    // Window scroll listener for continuous passive scanning
    let scrollDebounce = null;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollDebounce);
      scrollDebounce = setTimeout(() => {
        expandAllSeeMoreButtons();
        scanCurrentDOMForLeads();
      }, 800);
    }, { passive: true });

    // Progressive initial scans for dynamic AJAX content loading
    [500, 1200, 2500, 4500, 7000].forEach((delay) => {
      setTimeout(() => {
        expandAllSeeMoreButtons();
        scanCurrentDOMForLeads();
        renderLeadsList();
      }, delay);
    });
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
