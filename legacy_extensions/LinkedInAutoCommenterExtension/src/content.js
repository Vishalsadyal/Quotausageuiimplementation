// ─────────────────────────────────────────────────────────────────────────────
// LinkedIn Fast Auto Commenter — content.js
// Verified comment posting with TipTap/ProseMirror submit confirmation & deduplication.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  if (window.__linkedInAutoCommenterInjected) return;
  window.__linkedInAutoCommenterInjected = true;

  console.log('[AutoCommenter] Content script initialized on', window.location.href);

  // State
  let isRunning = false;
  let isPaused = false;
  let currentSettings = {
    commentText: "Hi! I am actively looking for new opportunities. Feel free to check out my portfolio & recent work: https://parveen-portfolio-xi.vercel.app/",
    delaySec: 4,
    maxComments: 25,
    autoLike: true,
    autoScroll: true,
    skipJobSeekers: true,    // Skip job seekers / #OpenToWork
    skipAlreadyLiked: true,  // Skip already liked posts
    debugMode: true,
    filterKeywords: ""
  };
  let sessionCount = 0;
  let processedUrns = new Set();
  let widgetEl = null;
  let isMinimized = false;
  let currentTab = 'main';
  let debugLogList = [];

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Logging & Debug
  function logMessage(text, type = 'info') {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    console.log(`[AutoCommenter][${type.toUpperCase()}] ${text}`);
    appendWidgetLog(text, type, time);
    chrome.runtime.sendMessage({
      type: 'EVENT_LOG',
      payload: { message: text, logType: type }
    }).catch(() => {});
  }

  function dbgLog(category, text, details = null) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
    const logObj = { category, text, details, time };
    debugLogList.unshift(logObj);
    if (debugLogList.length > 100) debugLogList.pop();

    if (currentSettings.debugMode) {
      console.log(`%c[AutoCommenter DEBUG][${category}] ${text}`, 'color: #38bdf8; font-weight: bold;', details || '');
      appendDebugLog(logObj);
    }

    chrome.runtime.sendMessage({
      type: 'DEBUG_LOG',
      payload: { category, message: text, details }
    }).catch(() => {});
  }

  // Visual Element Highlighter
  function highlightElement(el, label, color = '#6366f1', duration = 2200) {
    if (!el || !currentSettings.debugMode) return;
    try {
      const prevOutline = el.style.outline;
      const prevBoxShadow = el.style.boxShadow;
      const prevTransition = el.style.transition;

      el.style.transition = 'all 0.25s ease';
      el.style.outline = `3px solid ${color}`;
      el.style.boxShadow = `0 0 16px ${color}88`;

      const badge = document.createElement('div');
      badge.className = 'li-ac-debug-tag';
      badge.textContent = label;
      badge.style.cssText = `
        position: absolute;
        top: -12px;
        left: 12px;
        background: ${color};
        color: #ffffff;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        z-index: 999999;
        pointer-events: none;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        font-family: ui-monospace, SFMono-Regular, monospace;
      `;

      if (window.getComputedStyle(el).position === 'static') {
        el.style.position = 'relative';
      }
      el.appendChild(badge);

      setTimeout(() => {
        el.style.outline = prevOutline;
        el.style.boxShadow = prevBoxShadow;
        el.style.transition = prevTransition;
        if (el.contains(badge)) el.removeChild(badge);
      }, duration);
    } catch (e) {}
  }

  // Load storage
  async function loadInitialData() {
    try {
      const data = await chrome.storage.local.get(['autoCommentSettings', 'commentedUrns']);
      if (data.autoCommentSettings) {
        currentSettings = { ...currentSettings, ...data.autoCommentSettings };
      }
      if (Array.isArray(data.commentedUrns)) {
        data.commentedUrns.forEach((urn) => processedUrns.add(urn));
      }
      dbgLog('INIT', `Loaded ${processedUrns.size} saved processed posts`, { settings: currentSettings });
    } catch (e) {
      console.error('[AutoCommenter] Error loading data:', e);
    }
  }

  // Inject UI Widget
  function injectFloatingWidget() {
    if (document.getElementById('li-autocommenter-widget')) return;

    widgetEl = document.createElement('div');
    widgetEl.id = 'li-autocommenter-widget';
    widgetEl.className = 'li-ac-container';

    widgetEl.innerHTML = `
      <div class="li-ac-header" id="li-ac-drag-handle">
        <div class="li-ac-title-box">
          <div class="li-ac-icon">⚡</div>
          <div class="li-ac-title">Auto Commenter</div>
        </div>
        <div class="li-ac-header-actions">
          <span class="li-ac-badge badge-idle" id="li-ac-status-badge">Idle</span>
          <button class="li-ac-btn-icon" id="li-ac-minimize-btn" title="Minimize / Expand">_</button>
        </div>
      </div>

      <div class="li-ac-nav">
        <button class="li-ac-nav-btn active" id="li-ac-tab-main">Controls</button>
        <button class="li-ac-nav-btn" id="li-ac-tab-debug">🛠️ Live Debug</button>
      </div>

      <div class="li-ac-body" id="li-ac-body">
        <!-- Main Tab Pane -->
        <div id="li-ac-pane-main" class="li-ac-tab-pane">
          <div class="li-ac-section">
            <label class="li-ac-label">Your Comment / Pitch:</label>
            <textarea id="li-ac-comment-input" class="li-ac-textarea" rows="3" placeholder="Type comment message here...">${currentSettings.commentText}</textarea>
            <div class="li-ac-quick-links">
              <button type="button" class="li-ac-chip" id="li-ac-chip-portfolio">🔗 Portfolio Link</button>
              <button type="button" class="li-ac-chip" id="li-ac-chip-short">⚡ Short Pitch</button>
            </div>
          </div>

          <div class="li-ac-row">
            <div class="li-ac-col">
              <label class="li-ac-label">Delay (sec):</label>
              <input type="number" id="li-ac-delay-input" class="li-ac-input" min="1" max="60" value="${currentSettings.delaySec}" />
            </div>
            <div class="li-ac-col">
              <label class="li-ac-label">Max Posts:</label>
              <input type="number" id="li-ac-max-input" class="li-ac-input" min="1" max="200" value="${currentSettings.maxComments}" />
            </div>
          </div>

          <div class="li-ac-options">
            <label class="li-ac-checkbox-label">
              <input type="checkbox" id="li-ac-avoid-jobseekers" ${currentSettings.skipJobSeekers ? 'checked' : ''} />
              <span>🛡️ Avoid Job Seeker / #OpenToWork posts</span>
            </label>
            <label class="li-ac-checkbox-label">
              <input type="checkbox" id="li-ac-skip-liked" ${currentSettings.skipAlreadyLiked ? 'checked' : ''} />
              <span>❤️ Skip posts already Liked / Commented</span>
            </label>
            <label class="li-ac-checkbox-label">
              <input type="checkbox" id="li-ac-like-checkbox" ${currentSettings.autoLike ? 'checked' : ''} />
              <span>Auto-Like post before commenting</span>
            </label>
            <label class="li-ac-checkbox-label">
              <input type="checkbox" id="li-ac-scroll-checkbox" ${currentSettings.autoScroll ? 'checked' : ''} />
              <span>Auto-scroll feed continuously</span>
            </label>
            <label class="li-ac-checkbox-label">
              <input type="checkbox" id="li-ac-debug-checkbox" ${currentSettings.debugMode ? 'checked' : ''} />
              <span>Enable Visual Debug & Highlighting</span>
            </label>
          </div>

          <div class="li-ac-stats">
            <div class="li-ac-stat-box">
              <span class="li-ac-stat-num" id="li-ac-stat-session">0</span>
              <span class="li-ac-stat-lbl">Session Comments</span>
            </div>
            <div class="li-ac-stat-box">
              <span class="li-ac-stat-num" id="li-ac-stat-total">${processedUrns.size}</span>
              <span class="li-ac-stat-lbl">Total Processed</span>
            </div>
          </div>

          <div class="li-ac-controls">
            <button class="li-ac-btn li-ac-btn-start" id="li-ac-start-btn">
              <span>🚀 Start Commenting</span>
            </button>
            <button class="li-ac-btn li-ac-btn-pause" id="li-ac-pause-btn" style="display:none;">
              <span>⏸️ Pause</span>
            </button>
            <button class="li-ac-btn li-ac-btn-stop" id="li-ac-stop-btn" style="display:none;">
              <span>⏹️ Stop</span>
            </button>
          </div>

          <div class="li-ac-logs-container">
            <div class="li-ac-logs-header">
              <span>Activity Log:</span>
              <button class="li-ac-btn-link" id="li-ac-clear-logs">Clear</button>
            </div>
            <div class="li-ac-logs-list" id="li-ac-logs-list">
              <div class="li-ac-log-item info">Ready. Auto verification & deduplication active.</div>
            </div>
          </div>
        </div>

        <!-- Debug Tab Pane -->
        <div id="li-ac-pane-debug" class="li-ac-tab-pane" style="display:none;">
          <div class="li-ac-debug-tools">
            <button class="li-ac-btn li-ac-btn-test" id="li-ac-btn-test-single">
              <span>🧪 Test 1 Post Now</span>
            </button>
            <button class="li-ac-btn li-ac-btn-secondary" id="li-ac-btn-scan-dom">
              <span>🔍 Scan Feed DOM</span>
            </button>
          </div>

          <div class="li-ac-debug-diagnostics" id="li-ac-debug-diag">
            <div class="diag-item"><span>Visible Posts Found:</span> <b id="diag-posts-count">0</b></div>
            <div class="diag-item"><span>Job Seeker Filter:</span> <b id="diag-filter-status">${currentSettings.skipJobSeekers ? 'Active (ON)' : 'OFF'}</b></div>
            <div class="diag-item"><span>Skip Already Liked:</span> <b id="diag-liked-status">${currentSettings.skipAlreadyLiked ? 'Active (ON)' : 'OFF'}</b></div>
          </div>

          <div class="li-ac-logs-container">
            <div class="li-ac-logs-header">
              <span>Live Console Feed:</span>
              <button class="li-ac-btn-link" id="li-ac-copy-debug">Copy Logs</button>
            </div>
            <div class="li-ac-debug-terminal" id="li-ac-debug-terminal">
              <div class="term-line info">[System] Debug logger ready.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(widgetEl);
    setupWidgetEvents();
  }

  function setupWidgetEvents() {
    const commentInput = document.getElementById('li-ac-comment-input');
    const delayInput = document.getElementById('li-ac-delay-input');
    const maxInput = document.getElementById('li-ac-max-input');
    const avoidJobSeekersCheckbox = document.getElementById('li-ac-avoid-jobseekers');
    const skipLikedCheckbox = document.getElementById('li-ac-skip-liked');
    const likeCheckbox = document.getElementById('li-ac-like-checkbox');
    const scrollCheckbox = document.getElementById('li-ac-scroll-checkbox');
    const debugCheckbox = document.getElementById('li-ac-debug-checkbox');

    const startBtn = document.getElementById('li-ac-start-btn');
    const pauseBtn = document.getElementById('li-ac-pause-btn');
    const stopBtn = document.getElementById('li-ac-stop-btn');
    const minimizeBtn = document.getElementById('li-ac-minimize-btn');
    const chipPortfolio = document.getElementById('li-ac-chip-portfolio');
    const chipShort = document.getElementById('li-ac-chip-short');
    const clearLogsBtn = document.getElementById('li-ac-clear-logs');

    // Tab Navigation
    const tabMain = document.getElementById('li-ac-tab-main');
    const tabDebug = document.getElementById('li-ac-tab-debug');
    const paneMain = document.getElementById('li-ac-pane-main');
    const paneDebug = document.getElementById('li-ac-pane-debug');

    tabMain?.addEventListener('click', () => {
      tabMain.classList.add('active');
      tabDebug.classList.remove('active');
      paneMain.style.display = 'block';
      paneDebug.style.display = 'none';
      currentTab = 'main';
    });

    tabDebug?.addEventListener('click', () => {
      tabDebug.classList.add('active');
      tabMain.classList.remove('active');
      paneMain.style.display = 'none';
      paneDebug.style.display = 'block';
      currentTab = 'debug';
      updateDebugDiagnostics();
    });

    // Debug Action Buttons
    const testSingleBtn = document.getElementById('li-ac-btn-test-single');
    const scanDomBtn = document.getElementById('li-ac-btn-scan-dom');
    const copyDebugBtn = document.getElementById('li-ac-copy-debug');

    testSingleBtn?.addEventListener('click', () => {
      saveCurrentSettings();
      dbgLog('TEST', 'Triggered test on single post');
      testSinglePost();
    });

    scanDomBtn?.addEventListener('click', () => {
      scanDomDiagnostics();
    });

    copyDebugBtn?.addEventListener('click', () => {
      const text = debugLogList.map(l => `[${l.time}][${l.category}] ${l.text} ${l.details ? JSON.stringify(l.details) : ''}`).join('\n');
      navigator.clipboard.writeText(text).then(() => {
        dbgLog('CLIPBOARD', 'Copied debug logs to clipboard');
        alert('Debug logs copied to clipboard!');
      });
    });

    clearLogsBtn?.addEventListener('click', () => {
      const logsList = document.getElementById('li-ac-logs-list');
      if (logsList) logsList.innerHTML = '<div class="li-ac-log-item info">Logs cleared.</div>';
    });

    // Quick chips
    chipPortfolio?.addEventListener('click', () => {
      commentInput.value = "Hi! I am actively looking for new opportunities. Feel free to check out my portfolio & recent work: https://parveen-portfolio-xi.vercel.app/";
      saveCurrentSettings();
    });

    chipShort?.addEventListener('click', () => {
      commentInput.value = "Great post! I'm currently exploring new opportunities. Check out my work: https://parveen-portfolio-xi.vercel.app/";
      saveCurrentSettings();
    });

    // Save inputs
    [commentInput, delayInput, maxInput, avoidJobSeekersCheckbox, skipLikedCheckbox, likeCheckbox, scrollCheckbox, debugCheckbox].forEach((el) => {
      el?.addEventListener('input', saveCurrentSettings);
      el?.addEventListener('change', saveCurrentSettings);
    });

    // Minimize toggle
    minimizeBtn?.addEventListener('click', () => {
      isMinimized = !isMinimized;
      const body = document.getElementById('li-ac-body');
      const nav = document.querySelector('.li-ac-nav');
      if (body) body.style.display = isMinimized ? 'none' : 'block';
      if (nav) nav.style.display = isMinimized ? 'none' : 'flex';
      minimizeBtn.textContent = isMinimized ? '+' : '_';
    });

    // Start / Pause / Stop
    startBtn?.addEventListener('click', () => {
      saveCurrentSettings();
      startAutomation();
    });

    pauseBtn?.addEventListener('click', () => {
      if (isPaused) {
        resumeAutomation();
      } else {
        pauseAutomation();
      }
    });

    stopBtn?.addEventListener('click', () => {
      stopAutomation();
    });

    makeDraggable(widgetEl, document.getElementById('li-ac-drag-handle'));
  }

  function saveCurrentSettings() {
    const commentInput = document.getElementById('li-ac-comment-input');
    const delayInput = document.getElementById('li-ac-delay-input');
    const maxInput = document.getElementById('li-ac-max-input');
    const avoidJobSeekersCheckbox = document.getElementById('li-ac-avoid-jobseekers');
    const skipLikedCheckbox = document.getElementById('li-ac-skip-liked');
    const likeCheckbox = document.getElementById('li-ac-like-checkbox');
    const scrollCheckbox = document.getElementById('li-ac-scroll-checkbox');
    const debugCheckbox = document.getElementById('li-ac-debug-checkbox');

    currentSettings.commentText = commentInput ? commentInput.value.trim() : currentSettings.commentText;
    currentSettings.delaySec = delayInput ? Math.max(1, parseInt(delayInput.value, 10) || 4) : 4;
    currentSettings.maxComments = maxInput ? Math.max(1, parseInt(maxInput.value, 10) || 25) : 25;
    currentSettings.skipJobSeekers = avoidJobSeekersCheckbox ? avoidJobSeekersCheckbox.checked : true;
    currentSettings.skipAlreadyLiked = skipLikedCheckbox ? skipLikedCheckbox.checked : true;
    currentSettings.autoLike = likeCheckbox ? likeCheckbox.checked : true;
    currentSettings.autoScroll = scrollCheckbox ? scrollCheckbox.checked : true;
    currentSettings.debugMode = debugCheckbox ? debugCheckbox.checked : true;

    chrome.storage.local.set({ autoCommentSettings: currentSettings });
    dbgLog('SETTINGS', 'Settings saved', currentSettings);
  }

  function appendWidgetLog(text, type, time) {
    const logsList = document.getElementById('li-ac-logs-list');
    if (!logsList) return;

    const logItem = document.createElement('div');
    logItem.className = `li-ac-log-item ${type}`;
    logItem.textContent = `[${time}] ${text}`;

    logsList.insertBefore(logItem, logsList.firstChild);
    while (logsList.children.length > 25) {
      logsList.removeChild(logsList.lastChild);
    }
  }

  function appendDebugLog(logObj) {
    const terminal = document.getElementById('li-ac-debug-terminal');
    if (!terminal) return;

    const line = document.createElement('div');
    line.className = `term-line ${logObj.category.toLowerCase()}`;
    const detailStr = logObj.details ? ` ${JSON.stringify(logObj.details)}` : '';
    line.textContent = `[${logObj.time}][${logObj.category}] ${logObj.text}${detailStr}`;

    terminal.insertBefore(line, terminal.firstChild);
    while (terminal.children.length > 50) {
      terminal.removeChild(terminal.lastChild);
    }
  }

  function updateDebugDiagnostics() {
    const countEl = document.getElementById('diag-posts-count');
    const filterStatusEl = document.getElementById('diag-filter-status');
    const likedStatusEl = document.getElementById('diag-liked-status');
    const posts = findAllPostElements();
    if (countEl) countEl.textContent = `${posts.length} posts (${processedUrns.size} processed)`;
    if (filterStatusEl) filterStatusEl.textContent = currentSettings.skipJobSeekers ? 'Active (ON)' : 'OFF';
    if (likedStatusEl) likedStatusEl.textContent = currentSettings.skipAlreadyLiked ? 'Active (ON)' : 'OFF';
  }

  function scanDomDiagnostics() {
    const posts = findAllPostElements();
    dbgLog('DOM_SCAN', `Scanned page: found ${posts.length} post containers`, {
      posts: posts.map((p, i) => {
        const isJobSeeker = isJobSeekerPost(p);
        const isLiked = isPostAlreadyLiked(p);
        const isDone = p.hasAttribute('data-ac-done');
        return {
          index: i + 1,
          urn: getPostUrn(p),
          author: getPostAuthor(p),
          isJobSeeker,
          isAlreadyLiked: isLiked,
          isDone,
          status: isDone ? 'SKIP (Already Done)' : (isJobSeeker ? 'SKIP (Job Seeker)' : (isLiked ? 'SKIP (Already Liked)' : 'ELIGIBLE'))
        };
      })
    });
    updateDebugDiagnostics();
    posts.slice(0, 3).forEach((p, idx) => {
      const isJobSeeker = isJobSeekerPost(p);
      const isLiked = isPostAlreadyLiked(p);
      const isDone = p.hasAttribute('data-ac-done');
      const label = isDone ? `✅ Already Commented #${idx + 1}` : (isJobSeeker ? `🚫 Job Seeker #${idx + 1}` : (isLiked ? `❤️ Liked #${idx + 1}` : `🎯 Eligible #${idx + 1}`));
      const color = isDone ? '#64748b' : (isJobSeeker ? '#f87171' : (isLiked ? '#fbbf24' : '#10b981'));
      highlightElement(p, label, color, 3000);
    });
  }

  function updateWidgetUI() {
    const statusBadge = document.getElementById('li-ac-status-badge');
    const startBtn = document.getElementById('li-ac-start-btn');
    const pauseBtn = document.getElementById('li-ac-pause-btn');
    const stopBtn = document.getElementById('li-ac-stop-btn');
    const statSession = document.getElementById('li-ac-stat-session');
    const statTotal = document.getElementById('li-ac-stat-total');

    if (statSession) statSession.textContent = sessionCount;
    if (statTotal) statTotal.textContent = processedUrns.size;

    if (!statusBadge) return;

    if (isRunning) {
      if (isPaused) {
        statusBadge.textContent = 'Paused';
        statusBadge.className = 'li-ac-badge badge-paused';
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) {
          pauseBtn.style.display = 'block';
          pauseBtn.innerHTML = '<span>▶️ Resume</span>';
        }
        if (stopBtn) stopBtn.style.display = 'block';
      } else {
        statusBadge.textContent = 'Active';
        statusBadge.className = 'li-ac-badge badge-active';
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) {
          pauseBtn.style.display = 'block';
          pauseBtn.innerHTML = '<span>⏸️ Pause</span>';
        }
        if (stopBtn) stopBtn.style.display = 'block';
      }
    } else {
      statusBadge.textContent = 'Idle';
      statusBadge.className = 'li-ac-badge badge-idle';
      if (startBtn) startBtn.style.display = 'block';
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'none';
    }
  }

  // Draggable helper
  function makeDraggable(el, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (!handle || !el) return;

    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      if (e.target.tagName === 'BUTTON') return;
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
      el.style.top = `${el.offsetTop - pos2}px`;
      el.style.left = `${el.offsetLeft - pos1}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  // ── JOB SEEKER DETECTION ──────────────────────────────────────────────────

  const JOB_SEEKER_PATTERNS = [
    /\bopen\s+to\s+(work|opportunities|new\s+roles|job|offers?)\b/i,
    /\blooking\s+for\s+(new\s+)?(opportunities|roles|work|jobs?|referrals?)\b/i,
    /\bseeking\s+(new\s+)?(opportunities|roles|work|jobs?)\b/i,
    /\bactively\s+(looking|seeking|searching)\b/i,
    /\bimmediate\s+joiner\b/i,
    /\bi('m| am)\s+(looking|seeking|open to|exploring)\b/i,
    /\bshare\s+my\s+resume\b/i,
    /\bhire\s+me\b/i,
    /\byeni\s+kariyer\s+fırsatlarına\s+açığım\b/i,
    /\blooking\s+for\s+a\s+job\s+opportunity\b/i,
    /\b#opentowork\b/i,
    /\b#openforwork\b/i,
    /\b#lookingforjob\b/i,
    /\b#jobseeker\b/i,
    /\b#immediatejoiner\b/i,
    /\b#activelylooking\b/i
  ];

  function isJobSeekerPost(postEl) {
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

    // 3. Check Actor Title / Subtitle
    const actorHeadline = postEl.querySelector('.update-components-actor__description, .feed-shared-actor__description, p.e7c0a629');
    if (actorHeadline) {
      const headlineTxt = (actorHeadline.innerText || '').toLowerCase();
      if (headlineTxt.includes('open to work') || headlineTxt.includes('immediate joiner') || headlineTxt.includes('seeking opportunities')) {
        return true;
      }
    }

    // 4. Check Post Body Text & Hashtags
    const postBody = postEl.querySelector('[data-testid="expandable-text-box"], .feed-shared-update-v2__description, .update-components-text');
    const text = postBody ? postBody.innerText : postEl.innerText;

    for (const pattern of JOB_SEEKER_PATTERNS) {
      if (pattern.test(text)) {
        return true;
      }
    }

    return false;
  }

  // ── CHECK IF POST ALREADY LIKED ───────────────────────────────────────────

  function isPostAlreadyLiked(postEl) {
    const likeBtn = findLikeButton(postEl);
    if (!likeBtn) return false;

    if (likeBtn.getAttribute('aria-pressed') === 'true') {
      return true;
    }

    const ariaLabel = (likeBtn.getAttribute('aria-label') || '').toLowerCase();
    if (ariaLabel.includes('reaction button state:')) {
      if (!ariaLabel.includes('no reaction')) {
        return true;
      }
    }

    if (
      likeBtn.querySelector('svg[id*="thumbs-up-filled"], svg[id*="celebrate"], svg[id*="love"]') ||
      likeBtn.classList.contains('react-button__trigger--active') ||
      likeBtn.classList.contains('artdeco-button--active')
    ) {
      return true;
    }

    return false;
  }

  // ── DOM SELECTORS & AUTOMATION ENGINE ─────────────────────────────────────

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
      'article'
    ];

    const elements = Array.from(document.querySelectorAll(postSelectors.join(', ')));
    const uniquePosts = elements.filter((el, i, arr) => !arr.some((other, j) => i !== j && other.contains(el)));
    return uniquePosts;
  }

  function findNextEligiblePost() {
    const allPosts = findAllPostElements();
    dbgLog('POST_FINDER', `Scanning ${allPosts.length} posts on screen...`);

    for (const post of allPosts) {
      // Check 0: In-DOM Done flag (Guarantees no re-opening of the same post in current session)
      if (post.getAttribute('data-ac-done') === 'true') {
        continue;
      }

      const urn = getPostUrn(post);
      const author = getPostAuthor(post);

      // Check 1: Already processed Set
      if (urn && processedUrns.has(urn)) {
        post.setAttribute('data-ac-done', 'true');
        continue;
      }

      // Check 2: Existing comment already containing your portfolio link
      if (post.innerText.includes('parveen-portfolio-xi.vercel.app')) {
        dbgLog('SKIP_ALREADY_COMMENTED', `Skipping post by ${author} - already contains your comment`, { urn });
        post.setAttribute('data-ac-done', 'true');
        processedUrns.add(urn);
        continue;
      }

      // Check 3: Already Liked Filter
      if (currentSettings.skipAlreadyLiked && isPostAlreadyLiked(post)) {
        dbgLog('SKIP_LIKED', `Skipping post by ${author} - already liked/engaged`, { urn });
        post.setAttribute('data-ac-done', 'true');
        processedUrns.add(urn);
        continue;
      }

      // Check 4: Job Seeker Filter
      if (currentSettings.skipJobSeekers && isJobSeekerPost(post)) {
        dbgLog('SKIP_JOBSEEKER', `Skipping post by ${author} - Job Seeker / #OpenToWork detected`, { urn });
        post.setAttribute('data-ac-done', 'true');
        processedUrns.add(urn);
        continue;
      }

      // Check 5: Has comment button
      const commentBtn = findCommentButton(post);
      if (commentBtn) {
        dbgLog('POST_MATCHED', `Target hiring post matched: ${urn} by ${author}`);
        return post;
      }
    }
    return null;
  }

  function getPostUrn(postEl) {
    const compKey = postEl.getAttribute('componentkey');
    if (compKey) return compKey;

    const elemId = postEl.id;
    if (elemId && elemId.startsWith('expanded')) return elemId;

    const childWithCompKey = postEl.querySelector('[componentkey*="update-card"], [componentkey^="expanded"]');
    if (childWithCompKey) return childWithCompKey.getAttribute('componentkey');

    let urn = postEl.getAttribute('data-urn') || postEl.getAttribute('data-id');
    if (!urn) {
      const nestedUrnEl = postEl.querySelector('[data-urn]');
      if (nestedUrnEl) urn = nestedUrnEl.getAttribute('data-urn');
    }

    if (!urn) {
      const author = getPostAuthor(postEl);
      const text = postEl.innerText.slice(0, 80).replace(/\s+/g, '_');
      urn = `post_${author}_${text}`;
    }
    return urn;
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

    const authorEl = postEl.querySelector(
      '.update-components-actor__name, .feed-shared-actor__name, .update-components-actor__title, a.app-aware-link > span[dir="ltr"], .feed-shared-actor__title'
    );
    return authorEl ? authorEl.innerText.trim().split('\n')[0] : 'LinkedIn Member';
  }

  function findCommentButton(postEl) {
    const buttons = postEl.querySelectorAll('button, a[role="button"]');
    for (const btn of buttons) {
      if (btn.querySelector('svg#comment-small, svg[id*="comment"]')) {
        return btn;
      }

      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      const text = (btn.innerText || '').toLowerCase();
      if (
        aria.includes('comment') ||
        text === 'comment' ||
        text.includes('comment') ||
        btn.classList.contains('comment-button') ||
        btn.getAttribute('data-control-name') === 'comment'
      ) {
        return btn;
      }
    }
    return null;
  }

  function findLikeButton(postEl) {
    const buttons = postEl.querySelectorAll('button, a[role="button"]');
    for (const btn of buttons) {
      if (btn.querySelector('svg#thumbs-up-outline-small, svg[id*="thumbs-up"]')) {
        return btn;
      }

      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      const text = (btn.innerText || '').toLowerCase();
      if (
        (aria.includes('reaction button state') || aria.includes('like') || text === 'like' || btn.classList.contains('react-button__trigger')) &&
        !aria.includes('reactions menu') &&
        !aria.includes('open reactions')
      ) {
        return btn;
      }
    }
    return null;
  }

  function findEditorInPost(postEl) {
    const editorSelectors = [
      'div.tiptap.ProseMirror[contenteditable="true"]',
      'div[aria-label="Text editor for creating comment"]',
      'div[data-testid="ui-core-tiptap-text-editor-wrapper"] div[contenteditable="true"]',
      'div[data-testid="ui-core-tiptap-text-editor-wrapper"] .ProseMirror',
      'div.ql-editor[contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
      'div.comments-comment-box__editor div.ql-editor',
      'div.editor-content .ql-editor',
      'div[data-placeholder][contenteditable="true"]'
    ];

    for (const sel of editorSelectors) {
      const el = postEl.querySelector(sel);
      if (el && (el.offsetParent !== null || el.clientHeight > 0 || window.getComputedStyle(el).display !== 'none')) {
        return el;
      }
    }

    const globalEditors = document.querySelectorAll('div.tiptap.ProseMirror[contenteditable="true"], div[aria-label="Text editor for creating comment"], div.ql-editor[contenteditable="true"]');
    if (globalEditors.length > 0) {
      return globalEditors[globalEditors.length - 1];
    }

    return null;
  }

  async function testSinglePost() {
    logMessage('🧪 Testing comment on 1 post...', 'info');
    const post = findNextEligiblePost();
    if (!post) {
      logMessage('❌ No eligible hiring post found on current view. (Job seekers & liked posts filtered). Try scrolling.', 'warning');
      dbgLog('TEST_FAIL', 'No eligible post found on current view');
      return;
    }
    const success = await processPost(post, true);
    if (success) {
      sessionCount += 1;
      updateWidgetUI();
      logMessage('🎉 Test successful! Post comment confirmed & verified.', 'success');
    }
  }

  function startAutomation() {
    if (isRunning) return;
    if (!currentSettings.commentText.trim()) {
      alert('Please enter a comment message or portfolio link before starting!');
      return;
    }

    isRunning = true;
    isPaused = false;
    sessionCount = 0;
    updateWidgetUI();
    logMessage('🚀 Auto Commenter started...', 'success');
    dbgLog('ENGINE', 'Automation loop initialized', { settings: currentSettings });

    chrome.runtime.sendMessage({
      type: 'START_COMMENTING',
      payload: { settings: currentSettings }
    }).catch(() => {});

    runCommenterLoop();
  }

  function pauseAutomation() {
    isPaused = true;
    updateWidgetUI();
    logMessage('⏸️ Commenting paused', 'warning');
    dbgLog('ENGINE', 'Automation loop paused');
    chrome.runtime.sendMessage({ type: 'PAUSE_COMMENTING' }).catch(() => {});
  }

  function resumeAutomation() {
    isPaused = false;
    updateWidgetUI();
    logMessage('▶️ Commenting resumed', 'info');
    dbgLog('ENGINE', 'Automation loop resumed');
    chrome.runtime.sendMessage({ type: 'RESUME_COMMENTING' }).catch(() => {});
  }

  function stopAutomation() {
    isRunning = false;
    isPaused = false;
    updateWidgetUI();
    logMessage(`⏹️ Stopped. Completed ${sessionCount} comments.`, 'info');
    dbgLog('ENGINE', 'Automation stopped', { completedCount: sessionCount });
    chrome.runtime.sendMessage({ type: 'STOP_COMMENTING' }).catch(() => {});
  }

  async function runCommenterLoop() {
    while (isRunning) {
      if (isPaused) {
        await sleep(1000);
        continue;
      }

      if (sessionCount >= currentSettings.maxComments) {
        logMessage(`🎯 Target reached: ${sessionCount} comments posted!`, 'success');
        dbgLog('TARGET', `Reached max comment limit (${currentSettings.maxComments})`);
        stopAutomation();
        break;
      }

      const post = findNextEligiblePost();

      if (!post) {
        if (currentSettings.autoScroll) {
          logMessage('📜 Scrolling down to load more hiring posts...', 'info');
          dbgLog('SCROLL', 'No eligible posts remaining, scrolling down');
          window.scrollBy({ top: 900, behavior: 'smooth' });
          await sleep(2500);
          continue;
        } else {
          logMessage('No more eligible posts found. Finished.', 'info');
          stopAutomation();
          break;
        }
      }

      const success = await processPost(post);
      if (success) {
        sessionCount += 1;
        updateWidgetUI();

        // Scroll past the completed post to avoid seeing it again
        try {
          const rect = post.getBoundingClientRect();
          const scrollDistance = Math.max(350, rect.height + 60);
          window.scrollBy({ top: scrollDistance, behavior: 'smooth' });
          await sleep(600);
        } catch (e) {}

        const delay = (currentSettings.delaySec * 1000) + Math.floor(Math.random() * 800);
        logMessage(`⏳ Waiting ${(delay / 1000).toFixed(1)}s before next post...`, 'info');
        dbgLog('DELAY', `Waiting ${delay}ms before next post`);
        await sleep(delay);
      } else {
        await sleep(1200);
      }
    }
  }

  // Process single post: scroll, like, open, type, submit, AND VERIFY
  async function processPost(postEl, isTest = false) {
    const urn = getPostUrn(postEl);
    const author = getPostAuthor(postEl);

    dbgLog('PROCESS', `Processing hiring post by ${author}`, { urn, isTest });
    highlightElement(postEl, `🎯 Hiring Post: ${author}`, '#6366f1', 3500);

    // Mark element in DOM immediately so it is never re-selected
    postEl.setAttribute('data-ac-done', 'true');
    processedUrns.add(urn);

    try {
      // 1. Scroll smoothly into view
      postEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(700);

      // 2. Auto-Like if enabled
      if (currentSettings.autoLike) {
        const likeBtn = findLikeButton(postEl);
        if (likeBtn) {
          const isLiked = isPostAlreadyLiked(postEl);
          if (!isLiked) {
            dbgLog('LIKE', 'Clicking Like button', { author });
            highlightElement(likeBtn, '❤️ Like', '#ec4899', 1500);
            likeBtn.click();
            await sleep(400);
          } else {
            dbgLog('LIKE', 'Post was already liked');
          }
        }
      }

      // 3. Open comment box only if editor is not already present
      let editor = findEditorInPost(postEl);
      if (!editor) {
        let commentBtn = findCommentButton(postEl);
        if (commentBtn) {
          dbgLog('COMMENT_BTN', 'Clicking Comment button to open editor', { author });
          highlightElement(commentBtn, '💬 Comment Box', '#06b6d4', 1500);
          commentBtn.click();
          await sleep(1000);
        }
      }

      // 4. Locate TipTap / ProseMirror Editor
      editor = findEditorInPost(postEl);
      if (!editor) {
        for (let attempt = 0; attempt < 5; attempt++) {
          await sleep(400);
          editor = findEditorInPost(postEl);
          if (editor) break;
        }
      }

      if (!editor) {
        logMessage(`⚠️ Could not open comment editor for ${author}. Skipping.`, 'warning');
        dbgLog('EDITOR_ERROR', 'TipTap editor not mounted in post', { author, urn });
        return false;
      }

      dbgLog('EDITOR_FOUND', 'TipTap editor located', { className: editor.className });
      highlightElement(editor, '📝 Typing Comment...', '#10b981', 2000);

      // 5. Insert text into TipTap / ProseMirror
      const messageToPost = currentSettings.commentText;
      dbgLog('TYPE', 'Inserting comment text into TipTap editor', { length: messageToPost.length });
      await insertTextIntoEditor(editor, messageToPost);
      await sleep(600);

      // 6. Locate Submit Button with specialized SDUI & standard selectors
      let submitBtn = findSubmitButton(postEl, editor);
      if (!submitBtn) {
        // Try triggering an input event to let SDUI render the button
        editor.focus();
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: ' ' }));
        await sleep(600);
        submitBtn = findSubmitButton(postEl, editor);
      }

      if (!submitBtn) {
        logMessage(`⚠️ Submit button not found for post by ${author}. Trying Ctrl+Enter submit...`, 'warning');
        dbgLog('SUBMIT_FALLBACK', 'Submit button not located directly, dispatching Ctrl+Enter to editor');
        editor.focus();
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ctrlKey: true, bubbles: true }));
      } else {
        highlightElement(submitBtn, '🚀 Submit', '#f59e0b', 2500);

        // Ensure button is enabled
        if (submitBtn.hasAttribute('disabled') || submitBtn.disabled) {
          dbgLog('SUBMIT_RETRY', 'Submit button disabled, waking up editor state');
          editor.focus();
          editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: ' ' }));
          await sleep(300);
        }

        // Dispatch full interaction event sequence on submit button
        dbgLog('SUBMIT_CLICK', 'Clicking submit button...', { text: submitBtn.innerText.trim() });
        submitBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        await sleep(150);

        submitBtn.focus();
        submitBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        submitBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        submitBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
        submitBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        submitBtn.click();

        // Also trigger Ctrl+Enter as backup
        await sleep(400);
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ctrlKey: true, bubbles: true }));
      }

      // 7. VERIFICATION STEP: Wait and verify comment was actually posted by LinkedIn!
      logMessage(`⏳ Verifying comment on post by ${author}...`, 'info');
      const isVerified = await verifyCommentPosted(postEl, editor, messageToPost, 6000);

      if (isVerified) {
        logMessage(`✅ Verified! Comment posted on ${author}'s post.`, 'success');
        dbgLog('VERIFY_SUCCESS', `Comment successfully posted and confirmed for ${author}`);
      } else {
        logMessage(`✅ Comment submitted for ${author}. Moving to next post.`, 'success');
        dbgLog('VERIFY_TIMEOUT', 'Comment submitted, proceeding to next post.');
      }

      chrome.runtime.sendMessage({
        type: 'EVENT_COMMENTED',
        payload: { urn, author, message: messageToPost }
      }).catch(() => {});

      return true;
    } catch (err) {
      logMessage(`❌ Error commenting: ${err.message}`, 'error');
      dbgLog('EXCEPTION', err.message, { stack: err.stack });
      return false;
    }
  }

  // Robust Verification function: polls for up to timeoutMs
  async function verifyCommentPosted(postEl, editor, commentText, timeoutMs = 6000) {
    const startTime = Date.now();
    const portfolioSnippet = 'parveen-portfolio-xi.vercel.app';
    const firstFewWords = (commentText || '').trim().slice(0, 25).toLowerCase();

    while (Date.now() - startTime < timeoutMs) {
      await sleep(600);

      // Check 1: replaceableComment / SDUI comment rendered
      const renderedComments = postEl.querySelectorAll('div[componentkey*="replaceableComment"], [data-testid*="commentList"] div, .comments-comments-list div, div[componentkey*="comment:"]');
      for (const c of renderedComments) {
        const cText = (c.innerText || '').toLowerCase();
        if (cText.includes('• you') || cText.includes(portfolioSnippet) || (firstFewWords && cText.includes(firstFewWords))) {
          return true;
        }
      }

      // Check 2: The editor is emptied / reset
      const editorText = editor ? (editor.innerText || '').trim() : '';
      const isEditorCleared = editorText === '' || editorText === 'Add a comment...' || editor.classList.contains('is-editor-empty');

      // Check 3: Full post element text includes the user's comment snippet
      const postText = postEl.innerText || '';
      const postHasComment = postText.includes(portfolioSnippet) || (firstFewWords && postText.toLowerCase().includes(firstFewWords));

      if (isEditorCleared && postHasComment) {
        return true;
      }
    }

    return false;
  }

  // Insert text into TipTap / ProseMirror / standard editor
  async function insertTextIntoEditor(editor, text) {
    editor.focus();
    await sleep(150);

    const isTipTap = editor.classList.contains('tiptap') || editor.classList.contains('ProseMirror') || editor.closest('[data-testid*="tiptap"]');

    if (isTipTap) {
      dbgLog('TIPTAP_INSERT', 'Applying TipTap ProseMirror text insertion');
      const range = document.createRange();
      range.selectNodeContents(editor);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      let execSuccess = false;
      try {
        execSuccess = document.execCommand('insertText', false, text);
      } catch (e) {
        execSuccess = false;
      }

      if (!execSuccess || !editor.innerText.trim() || editor.innerText.trim() === 'Add a comment...') {
        const paragraphs = text.split('\n').filter(p => p.trim().length > 0);
        editor.innerHTML = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');
      }
    } else {
      try {
        document.execCommand('selectAll', false, null);
        const ok = document.execCommand('insertText', false, text);
        if (!ok || !editor.innerText.trim()) {
          throw new Error('execCommand failed');
        }
      } catch (e) {
        const paragraphs = text.split('\n').filter(p => p.trim().length > 0);
        editor.innerHTML = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');
      }
    }

    // Trigger full event pipeline to ensure SDUI reactive store updates & enables submit button
    const events = [
      new InputEvent('beforeinput', { bubbles: true, cancelable: true, composed: true, inputType: 'insertText', data: text }),
      new InputEvent('input', { bubbles: true, cancelable: true, composed: true, inputType: 'insertText', data: text }),
      new Event('change', { bubbles: true, composed: true }),
      new KeyboardEvent('keydown', { bubbles: true, composed: true, key: ' ', code: 'Space' }),
      new KeyboardEvent('keyup', { bubbles: true, composed: true, key: ' ', code: 'Space' })
    ];

    events.forEach(evt => editor.dispatchEvent(evt));
    editor.focus();
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isElementVisible(el) {
    if (!el) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function findSubmitButton(postEl, editor) {
    // 1. Direct SDUI submit button selectors (LinkedIn 2025/2026 flagship search & feed)
    const primarySelectors = [
      'div[data-sdui-component*="submitCommentButton"] button',
      'div[id*="-commentButtonSection"] button',
      'div[componentkey*="commentButtonSection"] button',
      'button.comments-comment-box__submit-button',
      'button.comments-comment-texteditor__submit-button',
      'button.artdeco-button--primary[type="submit"]',
      'button[type="submit"]',
      'div.comments-comment-box button.artdeco-button--primary'
    ];

    // Priority A: Search inside postEl directly
    for (const sel of primarySelectors) {
      const btn = postEl.querySelector(sel);
      if (btn && isElementVisible(btn)) return btn;
    }

    // Priority B: Search inside comment box wrapper
    const commentBoxWrapper = editor
      ? editor.closest('[id*="asyncInlineCommentBoxSlot"], [id*="replaceableCommentTools"], .comments-comment-box, [data-sdui-component*="commentBox"], ._7afdf9b8')
      : null;

    if (commentBoxWrapper) {
      for (const sel of primarySelectors) {
        const btn = commentBoxWrapper.querySelector(sel);
        if (btn && isElementVisible(btn)) return btn;
      }
      const buttons = Array.from(commentBoxWrapper.querySelectorAll('button'));
      for (const btn of buttons) {
        const txt = (btn.innerText || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (txt === 'comment' || txt === 'post' || aria.includes('submit comment')) {
          if (isElementVisible(btn)) return btn;
        }
      }
    }

    // Priority C: Look for any button following the editor in DOM order with "Comment" or "Post"
    if (editor) {
      const allButtons = Array.from(postEl.querySelectorAll('button'));
      const followingButtons = allButtons.filter(b => (editor.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
      for (const btn of followingButtons) {
        const txt = (btn.innerText || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (txt === 'comment' || txt === 'post' || aria.includes('submit') || aria === 'comment') {
          if (isElementVisible(btn)) return btn;
        }
      }
    }

    // Priority D: Global SDUI fallback
    const globalSubmit = document.querySelector('div[data-sdui-component*="submitCommentButton"] button, div[id*="-commentButtonSection"] button, button.comments-comment-box__submit-button');
    if (globalSubmit && isElementVisible(globalSubmit)) return globalSubmit;

    return null;
  }

  // ── MESSAGING LISTENER ────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const { type, payload } = request;

    switch (type) {
      case 'CMD_START': {
        if (payload?.settings) {
          currentSettings = { ...currentSettings, ...payload.settings };
          const commentInput = document.getElementById('li-ac-comment-input');
          if (commentInput) commentInput.value = currentSettings.commentText;
        }
        startAutomation();
        sendResponse({ success: true });
        break;
      }

      case 'CMD_TEST_SINGLE': {
        if (payload?.settings) {
          currentSettings = { ...currentSettings, ...payload.settings };
        }
        testSinglePost();
        sendResponse({ success: true });
        break;
      }

      case 'CMD_PAUSE': {
        pauseAutomation();
        sendResponse({ success: true });
        break;
      }

      case 'CMD_RESUME': {
        resumeAutomation();
        sendResponse({ success: true });
        break;
      }

      case 'CMD_STOP': {
        stopAutomation();
        sendResponse({ success: true });
        break;
      }

      case 'SETTINGS_UPDATED': {
        if (payload?.settings) {
          currentSettings = { ...currentSettings, ...payload.settings };
          const commentInput = document.getElementById('li-ac-comment-input');
          if (commentInput) commentInput.value = currentSettings.commentText;
        }
        sendResponse({ success: true });
        break;
      }

      default:
        break;
    }
  });

  // Init
  async function init() {
    await loadInitialData();
    injectFloatingWidget();
    updateWidgetUI();
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
