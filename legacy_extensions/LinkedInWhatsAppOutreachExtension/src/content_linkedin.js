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
    autoSendWhatsApp: false,
    autoCloseTab: true,
    filterJobSeekers: true,
    autoScroll: true,
    matchAllHiringPosts: true,
    removeSentPostFromFeed: true, // Automatically removes sent post from DOM so next post appears at top
    debugMode: true,
    delayBetweenMessages: 6
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
  const PHONE_REGEX_1 = /(?:(?:\+|0{0,2})91[\s\.\-]*)?(?:(?:\(?\d{3}\)?[\s\.\-]*)|\d{4}[\s\.\-]*)?[6-9]\d{4}[\s\.\-]?\d{5}\b/g;
  const PHONE_REGEX_2 = /(?:\b[6-9]\d{9}\b)|(?:\b[6-9]\d{4}[\s\.\-]\d{5}\b)|(?:\b[6-9]\d{2}[\s\.\-]\d{3}[\s\.\-]\d{4}\b)|(?:\b[6-9]\d{3}[\s\.\-]\d{3}[\s\.\-]\d{3}\b)/g;
  const PREFIXED_PHONE_REGEX = /(?:whatsapp|wa|call|contact|ph|phone|mobile|mob|tel|dm|share\s*cv|send\s*resume)[\s:–\-\/]+(\+?(?:91[\s\-]*)?[6-9][\d\s\.\-]{8,14}\d)/gi;
  const WA_LINK_REGEX = /(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/(\+?\d{10,15})/gi;

  // Job Seeker patterns to filter out (Only when NO strong hiring signals exist)
  const JOB_SEEKER_PATTERNS = [
    /\bopen\s*to\s*work\b/i,
    /\b#opentowork\b/i,
    /\b#lookingforjob\b/i,
    /\b#jobseeker\b/i,
    /\bi\s*am\s*(?:an?\s*)?(?:fresher|job\s*seeker|looking\s*for\s*(?:a\s*)?job)\b/i,
    /\bi\s*am\s*writing\s*to\s*express\s*my\s*(?:strong\s*)?interest\b/i,
    /\bplease\s*(?:find|check)\s*my\s*(?:attached\s*)?(?:cv|resume)\b/i,
    /\bhire\s*me\b/i,
    /\bseeking\s*entry\s*level\s*roles?\s*for\s*myself\b/i
  ];

  // Strong hiring indicators that override job seeker false positives
  const HIRING_INDICATORS = [
    /\b#?hiring\b/i,
    /\b#?urgentrequirement\b/i,
    /\b#?urgentopening\b/i,
    /\bwe\s*are\s*hiring\b/i,
    /\bopenings?\s*for\b/i,
    /\bposition\s*:\b/i,
    /\brole\s*:\b/i,
    /\bjob\s*title\s*:\b/i,
    /\bshare\s*(?:your\s*)?(?:cv|resume|profile)\b/i,
    /\bsend\s*(?:your\s*)?(?:cv|resume)\b/i,
    /\bwhatsapp\s*(?:your\s*cv|resume|profile|on|at|no|number|cv)?\b/i,
    /\bcall\s*\/?\s*whatsapp\b/i,
    /\bexperience\s*:\b/i,
    /\bsalary\s*:\b/i,
    /\blocation\s*:\b/i,
    /\binterested\s*candidates\b/i,
    /\bapply\s*now\b/i,
    /\bdrop\s*your\s*cv\b/i,
    /\bmail\s*(?:your\s*)?cv\b/i
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

          <div class="li-wa-toolbar" style="margin-top: 10px;">
            <button class="li-wa-btn li-wa-btn-primary" id="btn-start-scan">
              <span>🚀 Scan Feed & Match Leads</span>
            </button>
            <button class="li-wa-btn li-wa-btn-pause" id="btn-pause-scan" style="display:none;">
              <span>⏸️ Pause</span>
            </button>
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

          <div class="li-wa-toolbar" style="margin-top:8px;">
            <button class="li-wa-btn li-wa-btn-secondary" id="btn-export-csv" title="Export leads to CSV">
              <span>📥 Export CSV</span>
            </button>
            <button class="li-wa-btn li-wa-btn-danger" id="btn-clear-leads" title="Clear pending leads">
              <span>🗑️ Clear Pending</span>
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

    document.getElementById('btn-pause-scan')?.addEventListener('click', () => {
      isPaused = !isPaused;
      const pauseBtn = document.getElementById('btn-pause-scan');
      if (pauseBtn) pauseBtn.querySelector('span').textContent = isPaused ? '▶️ Resume' : '⏸️ Pause';
      logTerminal(isPaused ? 'Scanner paused.' : 'Scanner resumed.', 'warning');
    });

    // Clear leads
    document.getElementById('btn-clear-leads')?.addEventListener('click', () => {
      if (confirm('Clear all pending leads?')) {
        extractedLeads = extractedLeads.filter(l => l.status === 'sent');
        chrome.storage.local.set({ waLeads: extractedLeads });
        renderLeadsList();
        logTerminal('Cleared pending leads from list.', 'info');
      }
    });

    // Export CSV
    document.getElementById('btn-export-csv')?.addEventListener('click', exportLeadsToCSV);
  }

  function saveSettingsFromUI() {
    const kwInput = document.getElementById('input-keywords');
    const tplInput = document.getElementById('input-template');
    const removeSentCheck = document.getElementById('check-remove-sent');
    const matchAllCheck = document.getElementById('check-match-all');
    const autoSendCheck = document.getElementById('check-auto-send');
    const autoCloseCheck = document.getElementById('check-auto-close');
    const filterSeekersCheck = document.getElementById('check-filter-seekers');
    const autoScrollCheck = document.getElementById('check-auto-scroll');

    const rawKws = kwInput ? kwInput.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : settings.targetKeywords;
    
    settings.targetKeywords = rawKws.length > 0 ? rawKws : ['wordpress', 'react', 'web developer', 'fresher'];
    settings.messageTemplate = tplInput ? tplInput.value.trim() : settings.messageTemplate;
    settings.removeSentPostFromFeed = removeSentCheck ? removeSentCheck.checked : true;
    settings.matchAllHiringPosts = matchAllCheck ? matchAllCheck.checked : true;
    settings.autoSendWhatsApp = autoSendCheck ? autoSendCheck.checked : false;
    settings.autoCloseTab = autoCloseCheck ? autoCloseCheck.checked : true;
    settings.filterJobSeekers = filterSeekersCheck ? filterSeekersCheck.checked : true;
    settings.autoScroll = autoScrollCheck ? autoScrollCheck.checked : true;

    chrome.storage.local.set({ waSettings: settings });
    logTerminal('Settings saved successfully!', 'success');
    alert('Settings saved!');
  }

  // ── SCANNING & EXTRACTION ENGINE ──────────────────────────────────────────

  function startScanner() {
    isScanning = true;
    isPaused = false;
    updateScanButtons(true);
    logTerminal('🚀 Starting LinkedIn Scanner for Hiring Posts & WhatsApp Numbers...', 'info');
    runScanLoop();
  }

  function stopScanner() {
    isScanning = false;
    isPaused = false;
    updateScanButtons(false);
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
        await sleep(1000);
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

      if (settings.autoScroll) {
        window.scrollBy({ top: 750, behavior: 'smooth' });
        await sleep(2500);
      } else {
        await sleep(3000);
      }
    }
  }

  // Expand "...see more" buttons so phone numbers hidden below the fold are revealed
  function expandAllSeeMoreButtons() {
    const seeMoreButtons = document.querySelectorAll(
      'button.feed-shared-inline-show-more-text__see-more-less-toggle, ' +
      'button.inline-show-more-text__button, ' +
      'button[aria-label*="see more" i], ' +
      'button[aria-label*="Show more" i], ' +
      'button.feed-shared-see-more'
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

  // Diagnostics runner
  function runDiagnostics() {
    expandAllSeeMoreButtons();
    const posts = findAllPostElements();
    logTerminal(`[Diagnostics] Found ${posts.length} post containers on screen.`, 'info');
    console.log('[LinkedIn-WA] Diagnostics Report - Posts on screen:', posts.length);

    posts.forEach((post, i) => {
      const text = (post.innerText || '').trim();
      const author = getPostAuthor(post);
      const phones = extractPhoneNumbersFromPost(post, text);
      const isSeeker = settings.filterJobSeekers && isJobSeekerPost(post, text);
      const matchedKw = matchTargetKeywords(text);

      console.log(`[Post #${i + 1}] Author: ${author} | Phones: ${phones.join(', ') || 'None'} | Seeker: ${isSeeker} | Keyword: ${matchedKw || 'None'}`);
      
      if (phones.length > 0) {
        logTerminal(`Card #${i+1} (${author}): Phone ${phones.join(', ')} | Role: ${matchedKw || 'Hiring'}`, 'success');
      }
    });
  }

  // Scan all visible posts on the page
  function scanCurrentDOMForLeads() {
    const postElements = findAllPostElements();
    const statPostsSeen = document.getElementById('stat-posts-seen');
    if (statPostsSeen) statPostsSeen.textContent = `${postElements.length}`;

    let newCount = 0;
    let sessionDupes = 0;

    for (const post of postElements) {
      const postText = (post.innerText || '').trim();
      if (!postText) continue;

      // 1. Check Job Seeker filter
      if (settings.filterJobSeekers && isJobSeekerPost(post, postText)) {
        continue;
      }

      // 2. Extract Phone / WhatsApp Numbers from text & links
      const phones = extractPhoneNumbersFromPost(post, postText);
      if (!phones || phones.length === 0) continue;

      // 3. Match Job Titles & Keywords
      const matchedKeyword = matchTargetKeywords(postText);
      if (!matchedKeyword && !settings.matchAllHiringPosts) {
        continue;
      }

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
          sessionDupes++;
          duplicateCount++;
          // Inject action badge on card if not yet present
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
          postSnippet: postText.slice(0, 180).replace(/\s+/g, ' '),
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

        // Inject direct WhatsApp button onto the LinkedIn post card
        injectPostActionBadge(post, lead);
      }
    }

    if (newCount > 0 || sessionDupes > 0) {
      chrome.storage.local.set({
        waLeads: extractedLeads,
        duplicateStats: { skippedCount: duplicateCount }
      });
      updateStatsBar();
    }

    return newCount;
  }

  // Inject a direct "WhatsApp Recruiter" button on the LinkedIn post card
  function injectPostActionBadge(postEl, lead) {
    if (!lead || postEl.querySelector('.li-wa-post-badge')) return;

    postEl.setAttribute('data-wa-lead-phone', lead.cleanPhone);

    const isSent = lead.status === 'sent' || contactedPhones.has(lead.cleanPhone);
    const badge = document.createElement('div');
    badge.className = `li-wa-post-badge ${isSent ? 'is-sent' : ''}`;
    badge.innerHTML = `
      <div class="badge-content">
        <span class="badge-tag">${isSent ? '✅ Contacted:' : '⚡ Match:'} ${escapeHtml(lead.jobTitle)}</span>
        <button class="badge-wa-btn ${isSent ? 'btn-sent' : ''}" title="Open WhatsApp chat with recruiter">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2z"/></svg>
          <span>${isSent ? 'Message Again (+ ' + lead.cleanPhone + ')' : 'WhatsApp +' + lead.cleanPhone}</span>
        </button>
      </div>
    `;

    badge.querySelector('.badge-wa-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      dispatchOutreach(lead, postEl);
    });

    // Append to top of post or action bar
    postEl.insertBefore(badge, postEl.firstChild);
  }

  // ── AUTO-COLLAPSE & REMOVE SENT POST FROM FEED ────────────────────────────

  function removeOrCollapseSentPostCard(phone, urn = '') {
    if (settings.removeSentPostFromFeed === false) return;

    const posts = findAllPostElements();
    let removed = false;

    for (const post of posts) {
      const cardPhone = post.getAttribute('data-wa-lead-phone');
      const postUrn = getPostUrn(post);
      const text = post.innerText || '';
      const phones = extractPhoneNumbersFromPost(post, text);

      if (cardPhone === phone || phones.includes(phone) || (urn && postUrn === urn)) {
        removed = true;
        animateCardRemoval(post);
      }
    }

    if (removed) {
      logTerminal(`🚪 Removed sent post from feed. Next post auto-shifted to top!`, 'success');
      setTimeout(() => {
        expandAllSeeMoreButtons();
        scanCurrentDOMForLeads();
        renderLeadsList();
      }, 600);
    }
  }

  function animateCardRemoval(cardEl) {
    try {
      cardEl.style.transition = 'all 0.45s cubic-bezier(0.4, 0, 0.2, 1)';
      cardEl.style.opacity = '0';
      cardEl.style.transform = 'scale(0.96) translateY(-12px)';
      cardEl.style.maxHeight = (cardEl.offsetHeight || 300) + 'px';
      
      setTimeout(() => {
        cardEl.style.maxHeight = '0px';
        cardEl.style.margin = '0px';
        cardEl.style.padding = '0px';
        cardEl.style.border = 'none';
        cardEl.style.overflow = 'hidden';
      }, 50);

      setTimeout(() => {
        if (cardEl && cardEl.parentNode) {
          cardEl.remove();
        }
      }, 500);
    } catch (e) {}
  }

  // ── EXTRACTION & MATCHING HELPERS ─────────────────────────────────────────

  function extractPhoneNumbersFromPost(postEl, text) {
    const results = new Set();

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

    if (text) {
      // 2. Look for WhatsApp prefix keywords in text
      let match;
      const prefixRegex = new RegExp(PREFIXED_PHONE_REGEX);
      while ((match = prefixRegex.exec(text)) !== null) {
        if (match[1]) {
          const clean = cleanPhoneNumber(match[1]);
          if (isValidMobileNumber(clean)) {
            results.add(clean);
          }
        }
      }

      // 3. Scan regex 1
      const m1 = text.match(PHONE_REGEX_1) || [];
      for (const raw of m1) {
        const clean = cleanPhoneNumber(raw);
        if (isValidMobileNumber(clean)) {
          results.add(clean);
        }
      }

      // 4. Scan regex 2
      const m2 = text.match(PHONE_REGEX_2) || [];
      for (const raw of m2) {
        const clean = cleanPhoneNumber(raw);
        if (isValidMobileNumber(clean)) {
          results.add(clean);
        }
      }
    }

    return Array.from(results);
  }

  function isValidMobileNumber(clean) {
    if (!clean) return false;
    // Exclude timestamp/epoch IDs (e.g. 1788957900000)
    if (clean.length === 13 && clean.startsWith('17')) return false;

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

  function isJobSeekerPost(postEl, text) {
    // Check if strong hiring indicators exist in post -> NOT a job seeker!
    for (const pat of HIRING_INDICATORS) {
      if (pat.test(text)) {
        return false;
      }
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

    // 3. Check Post Body Text
    for (const pattern of JOB_SEEKER_PATTERNS) {
      if (pattern.test(text)) return true;
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
      'div[data-view-name="feed-full-update"]',
      'div[data-view-name="search-entity-result-universal-template"]',
      'div[data-view-name="feed-update"]',
      'div[data-view-name="search-entity-result"]',
      'div[role="listitem"][componentkey*="update-card"]',
      'div[componentkey*="update-card-focus"]',
      'div[id^="expanded"][componentkey^="expanded"]',
      'div[data-testid="lazy-column"] > div > div > div[id^="expanded"]',
      'div.feed-shared-update-v2',
      'div[data-urn*="urn:li:activity:"]',
      'div[data-urn*="urn:li:ugcPost:"]',
      'div.occludable-update',
      'div[data-id*="urn:li:"]',
      'li.search-results__list-item',
      'div.search-results-container div.artdeco-card',
      'div.reusable-search__result-container',
      'ul.reusable-search__entity-result-list > li',
      'div.fie-impression-container',
      'div[data-chameleon-result-urn]',
      'li[data-chameleon-result-urn]',
      'main div.artdeco-card',
      'article'
    ];
    let elements = Array.from(document.querySelectorAll(postSelectors.join(', ')));

    // Fallback: find closest card containers for actor profiles
    if (elements.length === 0) {
      const actors = document.querySelectorAll('.update-components-actor, .feed-shared-actor');
      for (const actor of actors) {
        const card = actor.closest('div.artdeco-card, div[role="listitem"], div.feed-shared-update-v2, li, article');
        if (card && !elements.includes(card)) {
          elements.push(card);
        }
      }
    }

    return elements.filter((el, i, arr) => !arr.some((other, j) => i !== j && other.contains(el)));
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

  function dispatchOutreach(lead, originPostEl = null) {
    logTerminal(`📲 Dispatching WhatsApp to ${lead.recruiterName} (+${lead.cleanPhone})...`, 'info');

    chrome.runtime.sendMessage({
      type: 'DISPATCH_WHATSAPP_MESSAGE',
      payload: lead
    }, (response) => {
      if (response && response.success) {
        logTerminal(`✅ WhatsApp Web opened for +${lead.cleanPhone}!`, 'success');
        lead.status = 'sent';
        contactedPhones.add(lead.cleanPhone);
        chrome.storage.local.set({ waLeads: extractedLeads, contactedPhones: Array.from(contactedPhones) });
        renderLeadsList();

        // If card was clicked directly on LinkedIn, collapse it
        if (originPostEl && settings.removeSentPostFromFeed !== false) {
          setTimeout(() => {
            animateCardRemoval(originPostEl);
          }, 600);
        }
      } else {
        logTerminal(`❌ Failed to dispatch WhatsApp: ${response?.error || 'Unknown error'}`, 'error');
      }
    });
  }

  function updateStatsBar() {
    const countBadge = document.getElementById('lead-count-badge');
    const statTotal = document.getElementById('stat-total-leads');
    const statSent = document.getElementById('stat-sent-leads');
    const statDupes = document.getElementById('stat-dupes-count');
    const countFilterAll = document.getElementById('count-filter-all');
    const countFilterPending = document.getElementById('count-filter-pending');
    const countFilterSent = document.getElementById('count-filter-sent');

    const sentCount = extractedLeads.filter(l => l.status === 'sent').length;
    const pendingCount = extractedLeads.length - sentCount;

    if (countBadge) countBadge.textContent = `${extractedLeads.length}`;
    if (statTotal) statTotal.textContent = `${extractedLeads.length}`;
    if (statSent) statSent.textContent = `${sentCount}`;
    if (statDupes) statDupes.textContent = `${duplicateCount}`;

    if (countFilterAll) countFilterAll.textContent = `${extractedLeads.length}`;
    if (countFilterPending) countFilterPending.textContent = `${pendingCount}`;
    if (countFilterSent) countFilterSent.textContent = `${sentCount}`;
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
      const item = document.createElement('div');
      item.className = `li-wa-lead-card ${isSent ? 'sent' : ''}`;
      item.innerHTML = `
        <div class="lead-header">
          <div class="lead-name">
            <b>${escapeHtml(lead.recruiterName)}</b>
            ${lead.company ? `<span class="lead-company">@ ${escapeHtml(lead.company)}</span>` : ''}
          </div>
          <span class="lead-status-pill ${isSent ? 'sent' : 'pending'}">${isSent ? '✅ Sent' : '⏳ Ready'}</span>
        </div>
        <div class="lead-title">🎯 ${escapeHtml(lead.jobTitle)}</div>
        <div class="lead-phone">📞 <b>+${lead.cleanPhone}</b></div>
        <div class="lead-snippet">"${escapeHtml(lead.postSnippet)}..."</div>
        <div class="lead-actions">
          <button class="li-wa-btn li-wa-btn-wa ${isSent ? 'btn-sent' : ''}" id="btn-wa-${lead.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2z"/></svg>
            <span>${isSent ? 'Message Again' : 'Send WhatsApp Message'}</span>
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
    setupDOMObserver();
    setupHistoryListener();
    setupMessageListener();

    // Initial scans with progressive delays for AJAX hydration
    [1500, 3500, 5500].forEach((delay) => {
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
