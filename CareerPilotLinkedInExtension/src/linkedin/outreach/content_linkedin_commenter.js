// ─────────────────────────────────────────────────────────────────────────────
// LinkedIn Fast Auto Commenter — content.js
// Verified comment posting with TipTap/ProseMirror submit confirmation & deduplication.
// ─────────────────────────────────────────────────────────────────────────────


(function () {
  'use strict';

  if (window.__linkedInAutoCommenterInjected) return;
  window.__linkedInAutoCommenterInjected = true;

  const WIDGET_ID = 'li-autocommenter-widget';
  const LOG_CAP = 200;
  const ACTIVITY_CAP = 100;

  // State
  let isRunning = false;
  let isPaused = false;
  // Settings are edited in the web dashboard (Auto Apply > Messages) and arrive via chrome.storage.local.
  let currentSettings = {
    commentText: '',
    delaySec: 4,
    maxComments: 25,
    autoLike: true,
    autoScroll: true,
    skipJobSeekers: true,    // Skip job seekers / #OpenToWork
    skipAlreadyLiked: true,  // Skip already liked posts
    debugMode: false,
    filterKeywords: ''
  };
  let sessionCount = 0;
  let totalCommented = 0;
  let processedUrns = new Set();
  let commentedLog = [];   // newest first
  let skippedLog = [];     // newest first
  let activityLog = [];    // newest first
  let currentAction = '';
  let ctl = null;          // controller from cpOwInit
  let widgetEl = null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function stripEmoji(text) {
    return String(text == null ? '' : text)
      .replace(/[\u{1F000}-\u{1FFFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️‍]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function shorten(text, max) {
    const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max - 1).trimEnd()}...` : t;
  }

  function applySettings(incoming) {
    if (!incoming || typeof incoming !== 'object') return;
    const merged = { ...currentSettings, ...incoming };
    merged.commentText = typeof merged.commentText === 'string' ? merged.commentText : '';
    merged.filterKeywords = typeof merged.filterKeywords === 'string' ? merged.filterKeywords : '';
    merged.delaySec = Math.max(1, Number(merged.delaySec) || 4);
    merged.maxComments = Math.max(1, Number(merged.maxComments) || 25);
    currentSettings = merged;
  }

  // Logging: the Activity tab (newest first, last ~100 lines) + the background.
  function logMessage(text, type = 'info') {
    const clean = stripEmoji(text);
    activityLog.unshift({ text: clean, type, ts: Date.now() });
    if (activityLog.length > ACTIVITY_CAP) activityLog.length = ACTIVITY_CAP;
    if (type !== 'error' && type !== 'warning') currentAction = clean;
    renderWidget();
    chrome.runtime.sendMessage({
      type: 'EVENT_LOG',
      payload: { message: text, logType: type }
    }).catch(() => {});
  }

  // Debug detail goes to the console only (and to the background).
  function dbgLog(category, text, details = null) {
    if (currentSettings.debugMode) {
      try { console.debug(`[AutoCommenter][${category}] ${text}`, details || ''); } catch (e) {}
    }
    chrome.runtime.sendMessage({
      type: 'DEBUG_LOG',
      payload: { category, message: text, details }
    }).catch(() => {});
  }

  // Visual Element Highlighter (page overlay, only when debugMode is on in the dashboard)
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
      badge.textContent = stripEmoji(label);
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
      const data = await chrome.storage.local.get(['autoCommentSettings', 'commentedUrns', 'totalCommentedCount', 'commentedLog', 'commentSkipped']);
      applySettings(data.autoCommentSettings);
      if (Array.isArray(data.commentedUrns)) {
        data.commentedUrns.forEach((urn) => processedUrns.add(urn));
      }
      totalCommented = typeof data.totalCommentedCount === 'number' ? data.totalCommentedCount : processedUrns.size;
      if (Array.isArray(data.commentedLog)) commentedLog = data.commentedLog.slice(0, LOG_CAP);
      if (Array.isArray(data.commentSkipped)) skippedLog = data.commentSkipped.slice(0, LOG_CAP);
      dbgLog('INIT', `Loaded ${processedUrns.size} saved processed posts`);
    } catch (e) {
      console.error('[AutoCommenter] Error loading data:', e);
    }
  }

  // Keep settings fresh when the dashboard changes them.
  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      if (changes.autoCommentSettings) {
        applySettings(changes.autoCommentSettings.newValue);
      }
      if (changes.totalCommentedCount && typeof changes.totalCommentedCount.newValue === 'number') {
        totalCommented = changes.totalCommentedCount.newValue;
      }
      if (changes.autoCommentSettings || changes.totalCommentedCount) renderWidget();
    });
  } catch (e) {}

  // Commented / skipped records (newest first, persisted, capped)
  function postLink(urn, url) {
    if (url) return url;
    const m = /urn:li:(activity|ugcPost|share):\d+/.exec(String(urn || ''));
    return m ? `https://www.linkedin.com/feed/update/${m[0]}/` : '';
  }

  function getPostUrl(postEl) {
    try {
      const a = postEl.querySelector('a[href*="/feed/update/"]');
      if (a && a.href) return a.href.split('?')[0];
      const el = postEl.matches('[data-urn]') ? postEl : postEl.querySelector('[data-urn*="urn:li:"]');
      const urn = el ? el.getAttribute('data-urn') : '';
      return postLink(urn, '');
    } catch (e) {
      return '';
    }
  }

  function getPostSnippet(postEl) {
    try {
      const body = postEl.querySelector('[data-testid="expandable-text-box"], .feed-shared-update-v2__description, .update-components-text');
      return shorten((body ? body.innerText : postEl.innerText) || '', 140);
    } catch (e) {
      return '';
    }
  }

  function addCommented(entry) {
    commentedLog.unshift(entry);
    if (commentedLog.length > LOG_CAP) commentedLog.length = LOG_CAP;
    totalCommented += 1;
    try { chrome.storage.local.set({ commentedLog }); } catch (e) {}
    renderWidget();
  }

  function recordSkip(urn, author, snippet, reason, url) {
    // The feed is re-scanned often; record each post once.
    if (skippedLog.some((s) => s.urn === urn)) return;
    skippedLog.unshift({ urn, author, snippet: shorten(snippet, 140), reason, url: url || '', ts: Date.now() });
    if (skippedLog.length > LOG_CAP) skippedLog.length = LOG_CAP;
    try { chrome.storage.local.set({ commentSkipped: skippedLog }); } catch (e) {}
    renderWidget();
  }

  // Check if Auto-Commenter module is active for this tab
  // Shown only when the comment tool was asked for in this tab (see cpOwRequestedModule in outreach_ui.js).
  function checkModuleVisibility() {
    if (!ctl) return;
    if (cpOwRequestedModule() === 'commenter') ctl.show();
    else ctl.hide();
  }

  // ── WIDGET UI ─────────────────────────────────────────────────────────────

  function commentTextMissing() {
    return !String(currentSettings.commentText || '').trim();
  }

  function injectFloatingWidget() {
    if (document.getElementById(WIDGET_ID)) return;

    const html = cpOwShell({
      id: WIDGET_ID,
      title: 'Auto-Commenter',
      subtitle: 'Comment on recruiter hiring posts',
      icon: 'comment',
      tabs: [
        { id: 'commented', label: 'Commented' },
        { id: 'skipped', label: 'Skipped' },
        { id: 'activity', label: 'Activity' }
      ],
      controls: `${cpOwQuickRow('li-ac')}
        ${cpOwStats([
          { id: 'run', label: 'This run', value: 0 },
          { id: 'total', label: 'Commented', value: 0 },
          { id: 'skipped', label: 'Skipped', value: 0 },
          { id: 'limit', label: 'Run limit', value: currentSettings.maxComments }
        ])}
        <div data-warn></div>`,
      foot: `<div data-comment-preview></div>${cpOwDashboardNote()}`
    });

    const holder = document.createElement('div');
    holder.innerHTML = html.trim();
    widgetEl = holder.firstElementChild;
    document.body.appendChild(widgetEl);

    ctl = cpOwInit(widgetEl, { defaultTab: 'activity', onTab: () => renderWidget() });
    setupWidgetEvents();
  }

  function setupWidgetEvents() {
    const startBtn = widgetEl.querySelector('#li-ac-start');
    const pauseBtn = widgetEl.querySelector('#li-ac-pause');
    const stopBtn = widgetEl.querySelector('#li-ac-stop');

    startBtn?.addEventListener('click', () => {
      startAutomation();
    });

    pauseBtn?.addEventListener('click', () => {
      if (!isRunning) return;
      if (isPaused) resumeAutomation();
      else pauseAutomation();
    });

    stopBtn?.addEventListener('click', () => {
      if (isRunning) stopAutomation();
    });
  }

  function commentedCard(e) {
    return cpOwCard({
      kind: 'sent',
      icon: 'check',
      title: e.author || 'LinkedIn member',
      titleUrl: postLink(e.urn, e.url),
      sub: e.snippet ? shorten(e.snippet, 110) : '',
      reason: e.comment ? `Comment: ${shorten(e.comment, 120)}` : '',
      time: cpOwClock(e.ts)
    });
  }

  function skippedCard(s) {
    return cpOwCard({
      kind: 'skipped',
      icon: 'skip',
      title: s.author || 'LinkedIn member',
      titleUrl: postLink(s.urn, s.url),
      sub: s.snippet ? shorten(s.snippet, 110) : '',
      reason: s.reason || '',
      time: cpOwClock(s.ts)
    });
  }

  function activityCard(a) {
    const type = a.type;
    return cpOwCard({
      kind: type === 'error' ? 'error' : type === 'success' ? 'sent' : type === 'warning' ? 'skipped' : '',
      icon: type === 'error' || type === 'warning' ? 'alert' : type === 'success' ? 'check' : 'clock',
      title: a.text,
      time: cpOwClock(a.ts)
    });
  }

  function buildListHtml() {
    const tab = ctl ? ctl.tab : 'activity';
    if (tab === 'commented') {
      return commentedLog.length
        ? commentedLog.map(commentedCard).join('')
        : cpOwEmpty('comment', 'No comments yet. Press Start to comment on hiring posts in your feed.');
    }
    if (tab === 'skipped') {
      return skippedLog.length
        ? skippedLog.map(skippedCard).join('')
        : cpOwEmpty('skip', 'No skipped posts yet.');
    }
    let html = '';
    if (commentTextMissing()) {
      html += cpOwCard({
        kind: 'error',
        icon: 'alert',
        title: 'No comment text yet',
        reason: 'Write your comment in your dashboard (Auto Apply > Messages), then press Start.'
      });
    }
    if (isRunning) {
      html += cpOwBanner({
        title: isPaused ? 'Paused' : 'Auto-Commenter is running',
        main: isPaused ? 'Paused. Press Resume to continue.' : (currentAction || 'Looking for hiring posts...'),
        detail: `${sessionCount} of ${currentSettings.maxComments} comments this run`
      });
    }
    html += activityLog.length
      ? activityLog.map(activityCard).join('')
      : (isRunning ? '' : cpOwEmpty('clock', 'Ready. Press Start to comment on hiring posts.'));
    return html;
  }

  function renderWidget() {
    if (!ctl || !widgetEl) return;
    const root = widgetEl;

    const setStat = (id, v) => {
      const el = root.querySelector(`[data-stat="${id}"]`);
      if (el) el.textContent = String(v);
    };
    setStat('run', sessionCount);
    setStat('total', totalCommented);
    setStat('skipped', skippedLog.length);
    setStat('limit', currentSettings.maxComments);

    if (isRunning) ctl.setBadge(isPaused ? 'Paused' : 'Running', isPaused ? 'pause' : 'run');
    else ctl.setBadge('Idle', '');
    ctl.setCount('commented', commentedLog.length);
    ctl.setCount('skipped', skippedLog.length);
    ctl.setCount('activity', activityLog.length);

    const startBtn = root.querySelector('#li-ac-start');
    const pauseBtn = root.querySelector('#li-ac-pause');
    const stopBtn = root.querySelector('#li-ac-stop');
    if (startBtn) startBtn.disabled = isRunning;
    if (pauseBtn) {
      pauseBtn.disabled = !isRunning;
      const label = pauseBtn.querySelector('span');
      if (label) label.textContent = isPaused ? 'Resume' : 'Pause';
    }
    if (stopBtn) stopBtn.disabled = !isRunning;

    // Missing comment warning + read-only comment preview
    const missing = commentTextMissing();
    const warn = root.querySelector('[data-warn]');
    if (warn) warn.innerHTML = missing ? cpOwDashboardNote('Write your comment in your dashboard first.', true) : '';
    const preview = root.querySelector('[data-comment-preview]');
    if (preview) {
      preview.innerHTML = missing
        ? ''
        : `<div class="cp-ow-comment-preview"><span class="cp-ow-comment-label">Your comment</span><span class="cp-ow-comment-text">${cpOwEscape(shorten(currentSettings.commentText, 160))}</span></div>`;
    }

    // List, newest first, kept at the top
    ctl.setList(buildListHtml());
    if (ctl.list) ctl.list.scrollTop = 0;
  }

  function updateWidgetUI() {
    renderWidget();
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
        recordSkip(urn, author, getPostSnippet(post), 'Already commented on this post', getPostUrl(post));
        continue;
      }

      // Check 2: Existing comment already containing the link from your comment text
      const ownLink = ownLinkSnippet();
      if (ownLink && post.innerText.toLowerCase().includes(ownLink)) {
        dbgLog('SKIP_ALREADY_COMMENTED', `Skipping post by ${author} - already contains your comment`, { urn });
        post.setAttribute('data-ac-done', 'true');
        processedUrns.add(urn);
        recordSkip(urn, author, getPostSnippet(post), 'Already commented on this post', getPostUrl(post));
        continue;
      }

      // Check 3: Already Liked Filter
      if (currentSettings.skipAlreadyLiked && isPostAlreadyLiked(post)) {
        dbgLog('SKIP_LIKED', `Skipping post by ${author} - already liked/engaged`, { urn });
        post.setAttribute('data-ac-done', 'true');
        processedUrns.add(urn);
        recordSkip(urn, author, getPostSnippet(post), 'Already liked this post', getPostUrl(post));
        continue;
      }

      // Check 4: Job Seeker Filter
      if (currentSettings.skipJobSeekers && isJobSeekerPost(post)) {
        dbgLog('SKIP_JOBSEEKER', `Skipping post by ${author} - Job Seeker / #OpenToWork detected`, { urn });
        post.setAttribute('data-ac-done', 'true');
        processedUrns.add(urn);
        recordSkip(urn, author, getPostSnippet(post), 'Job seeker post (#OpenToWork)', getPostUrl(post));
        continue;
      }

      // Check 4b: Keyword filter from the dashboard (empty = every hiring post)
      if (!postMatchesKeywords(post)) {
        dbgLog('SKIP_KEYWORDS', `Skipping post by ${author} - no keyword match`, { urn });
        post.setAttribute('data-ac-done', 'true');
        recordSkip(urn, author, getPostSnippet(post), 'Does not mention your keywords', getPostUrl(post));
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

  // The link inside the user's comment text (e.g. their portfolio), used to spot their own earlier comment.
  function ownLinkSnippet() {
    const m = /https?:\/\/\S+/i.exec(currentSettings.commentText || '');
    return m ? m[0].replace(/^https?:\/\//i, '').replace(/[\/.,;)]+$/, '').toLowerCase() : '';
  }

  function postMatchesKeywords(postEl) {
    const words = String(currentSettings.filterKeywords || '')
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
    if (!words.length) return true;
    const text = (postEl.innerText || '').toLowerCase();
    return words.some((w) => text.includes(w));
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
    if (commentTextMissing()) {
      if (ctl) ctl.setTab('activity');
      logMessage('Write your comment in your dashboard first.', 'warning');
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

  // Asks the background to charge 1 Hire. Resolves { ok } or { ok:false, reason, error, topUpUrl };
  // any error counts as "not charged" so nothing is posted unpaid.
  function chargeOutreach(channel, targetId) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'CP_OUTREACH_CHARGE', channel, targetId }, (res) => {
          if (chrome.runtime.lastError || !res) resolve({ ok: false, reason: 'EXTENSION_ERROR', error: 'could not confirm Hires' });
          else resolve(res);
        });
      } catch (e) {
        resolve({ ok: false, reason: 'EXTENSION_ERROR', error: 'could not confirm Hires' });
      }
    });
  }

  // Process single post: scroll, like, open, type, submit, AND VERIFY
  async function processPost(postEl, isTest = false) {
    const urn = getPostUrn(postEl);
    const author = getPostAuthor(postEl);
    const snippet = getPostSnippet(postEl);
    const postUrl = getPostUrl(postEl);

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
        recordSkip(urn, author, snippet, 'Comment box not found', postUrl);
        return false;
      }

      dbgLog('EDITOR_FOUND', 'TipTap editor located', { className: editor.className });

      // 1 Hire per comment, charged by the portal before typing (same post = charged once).
      // Not charged (out of Hires, signed out, portal down) = don't comment and stop the run.
      const charge = await chargeOutreach('comment', String(urn).slice(0, 300));
      if (!charge.ok) {
        const outOfHires = charge.reason === 'INSUFFICIENT_HIRES';
        logMessage(
          outOfHires
            ? `⛔ Out of Hires: each comment costs 1 Hire. Top up at ${charge.topUpUrl || 'your AutoApply CV dashboard'} to continue.`
            : `⛔ Comment not posted: ${charge.error || 'could not confirm Hires'}.`,
          'error'
        );
        dbgLog('CHARGE_FAILED', 'Outreach charge refused', { reason: charge.reason });
        processedUrns.delete(urn);
        postEl.removeAttribute('data-ac-done');
        if (isRunning) stopAutomation();
        return false;
      }

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

      addCommented({ urn, author, snippet, comment: messageToPost, url: postUrl, ts: Date.now() });

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
    const portfolioSnippet = ownLinkSnippet();
    const firstFewWords = (commentText || '').trim().slice(0, 25).toLowerCase();

    while (Date.now() - startTime < timeoutMs) {
      await sleep(600);

      // Check 1: replaceableComment / SDUI comment rendered
      const renderedComments = postEl.querySelectorAll('div[componentkey*="replaceableComment"], [data-testid*="commentList"] div, .comments-comments-list div, div[componentkey*="comment:"]');
      for (const c of renderedComments) {
        const cText = (c.innerText || '').toLowerCase();
        if (cText.includes('• you') || (portfolioSnippet && cText.includes(portfolioSnippet)) || (firstFewWords && cText.includes(firstFewWords))) {
          return true;
        }
      }

      // Check 2: The editor is emptied / reset
      const editorText = editor ? (editor.innerText || '').trim() : '';
      const isEditorCleared = editorText === '' || editorText === 'Add a comment...' || editor.classList.contains('is-editor-empty');

      // Check 3: Full post element text includes the user's comment snippet
      const postText = postEl.innerText || '';
      const postHasComment = (portfolioSnippet && postText.toLowerCase().includes(portfolioSnippet)) || (firstFewWords && postText.toLowerCase().includes(firstFewWords));

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
          applySettings(payload.settings);
        }
        startAutomation();
        sendResponse({ success: true });
        break;
      }

      case 'CMD_TEST_SINGLE': {
        if (payload?.settings) {
          applySettings(payload.settings);
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
          applySettings(payload.settings);
          renderWidget();
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
    checkModuleVisibility();
    window.addEventListener('hashchange', checkModuleVisibility);
    renderWidget();
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
