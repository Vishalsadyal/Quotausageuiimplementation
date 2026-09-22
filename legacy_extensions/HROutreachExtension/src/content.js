// ─────────────────────────────────────────────────────────────────────────────
// HR Direct Outreach — content.js
// Injected into linkedin.com pages.
// Scrapes hiring posts, extracts HR contacts (name, title, company, email, phone).
// Floating panel uses panel.css styles matching CareerPilotLinkedInExtension.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  if (window.__hroContentInjected) return;
  window.__hroContentInjected = true;

  const CONTENT_START_TS = Date.now();

  function cLog(label, detail) {
    const elapsed = ((Date.now() - CONTENT_START_TS) / 1000).toFixed(1);
    console.log(`[HRO CS] ${elapsed}s | ${label}`, detail || '');
  }

  cLog('CONTENT_INIT', `url=${window.location.href}`);

  let isScraping = false;
  let stopFlag = false;
  let collectedCount = 0;
  let scrapeTimeoutId = null;
  let scrapeSessionId = 0;
  let panelEl = null;
  let toggleEl = null;
  let panelVisible = true;
  let seenPostKeys = new Set();
  let currentKeyword = '';
  let currentSearchDate = '';

  const STORAGE_KEY = 'hro_collected_contacts';
  const SAVED_KEYS_KEY = 'hro_saved_seen_keys';
  const SAVED_SCROLL_KEY = 'hro_saved_scroll_y';
  const SAVED_COUNT_KEY = 'hro_saved_collected_count';
  const PANEL_ID = 'hro-panel';
  const TOGGLE_ID = 'hro-toggle';

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  function extractEmailFromText(text) {
    const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    return match ? match[0] : null;
  }

  function extractPhoneFromText(text) {
    const patterns = [
      /\+?1\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
      /\d{3}[-.\s]\d{3}[-.\s]\d{4}/,
      /\(\d{3}\)\s*\d{3}[-.\s]\d{4}/,
    ];
    for (const pat of patterns) {
      const match = text.match(pat);
      if (match) return match[0].trim();
    }
    return null;
  }

  function debugLog(event, data = {}) {
    chrome.runtime.sendMessage({
      type: 'HRO_DEBUG_EVENT',
      level: 'info',
      event: `content_${event}`,
      source: 'content',
      data,
    }).catch(() => {});
  }

  function buildContentSearchUrl(keyword, timeRange) {
    const base = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(keyword || 'we are hiring')}&origin=FACETED_SEARCH&sortBy=%5B%22date_posted%22%5D`;
    if (timeRange && timeRange !== 'any') return `${base}&datesPosted=${timeRange}`;
    return base;
  }

  // ── Parse a post card ────────────────────────────────────────────────────────

  const JOB_SEEKER_HASHTAGS = new Set([
    'opentowork', 'openforwork', 'availableforwork', 'lookingforwork',
    'jobsearch', 'seekingopportunities',
  ]);

  const JOB_SEEKER_PATTERNS = [
    /\bopen\s+to\s+work\b/i,
    /\bavailable\s+for\s+work\b/i,
    /\blooking\s+for\s+(new\s+)?opportunities?\b/i,
    /\bseeking\s+(new\s+)?opportunities?\b/i,
    /\bactively\s+looking\b/i,
    /\blooking\s+for\s+work\b/i,
    /\blooking\s+for\s+a\s+job\b/i,
    /\b#opentowork\b/i,
    /\b#openforwork\b/i,
  ];

  function isJobSeekerPost(card, category) {
    const text = (card.innerText || '').toLowerCase();
    if (category && JOB_SEEKER_HASHTAGS.has(category.split(',')[0]?.trim().toLowerCase())) return true;
    for (const pat of JOB_SEEKER_PATTERNS) {
      if (pat.test(text)) return true;
    }
    return false;
  }

  function parsePostCard(card) {
    const contact = {
      name: '',
      title: '',
      company: '',
      email: '',
      phone: '',
      category: '',
      linkedinUrl: '',
      sourcePostUrl: window.location.href,
      searchKeyword: '',
      searchDate: '',
    };

    const mailtoLink = card.querySelector('a[href^="mailto:"]');
    if (mailtoLink) {
      const email = mailtoLink.getAttribute('href').replace('mailto:', '').split('?')[0].trim();
      if (email && email.includes('@')) contact.email = email;
    }

    const profileLinks = card.querySelectorAll('a[href*="/in/"]');
    for (const link of profileLinks) {
      const href = link.getAttribute('href') || '';
      if (href.includes('/in/')) {
        contact.linkedinUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href.split('?')[0]}`;
        const ariaLabel = link.getAttribute('aria-label') || '';
        if (ariaLabel && !contact.name) {
          contact.name = ariaLabel.replace(/\s*\d+\w*\+?\s*$/, '').trim();
        }
        break;
      }
    }

    const text = card.innerText || '';
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const bulletIdx = lines.findIndex((l) => l.startsWith('•') || l === '•');
    if (!contact.name && bulletIdx > 0) {
      contact.name = lines[bulletIdx - 1] || '';
    }
    for (let i = Math.max(0, bulletIdx); i < Math.min(lines.length, bulletIdx + 5); i++) {
      const line = lines[i];
      const atMatch = line.match(/(.+?)\s+at\s+(.+)/i);
      if (atMatch) {
        contact.title = atMatch[1].replace(/^Ex[–-]\s*/i, '').trim();
        contact.company = atMatch[2].trim();
        break;
      }
    }

    const phone = extractPhoneFromText(text);
    if (phone) contact.phone = phone;

    const hashtagEls = card.querySelectorAll('a[href*="/feed/hashtag/"]');
    const hashtags = [...hashtagEls].map((a) => a.innerText.replace('#', '').trim()).filter(Boolean);
    if (hashtags.length > 0) {
      contact.category = hashtags.slice(0, 3).join(', ');
    }

    return contact;
  }

  // ── Expand a post "see more" button ──────────────────────────────────────────

  let highlightedCard = null;
  let scanEls = [];
  let scanStyleInjected = false;

  function ensureScanStyle() {
    if (scanStyleInjected) return;
    const style = document.createElement('style');
    style.id = 'hro-scan-style';
    style.textContent = `
      @keyframes hro-flash{0%{opacity:0.7}50%{opacity:0.1}100%{opacity:0.7}}
      @keyframes hro-pulse{0%,100%{box-shadow:0 0 4px #6366f1}50%{box-shadow:0 0 14px #a78bfa}}
    `;
    document.head.appendChild(style);
    scanStyleInjected = true;
  }

  function clearScanElements() {
    for (const el of scanEls) {
      try { if (el.isConnected) el.remove(); } catch {}
    }
    scanEls = [];
  }

  async function animateScan(card) {
    const rect = card.getBoundingClientRect();
    if (rect.height < 60 || rect.width < 100) return;

    ensureScanStyle();
    clearScanElements();
    const origPosition = card.style.position;
    const origOverflow = card.style.overflow;
    card.style.position = card.style.position || 'relative';
    card.style.overflow = 'hidden';

    function addEl(className, cssText) {
      const el = document.createElement('div');
      el.className = className;
      el.style.cssText = `position:absolute;pointer-events:none;${cssText}`;
      card.appendChild(el);
      scanEls.push(el);
      return el;
    }

    const w = rect.width; const h = rect.height;

    console.log(`[HRO] 🔬 SCAN | ${Math.round(w)}x${Math.round(h)}px`);

    addEl('', `top:0;left:0;width:100%;height:100%;
      background-image:linear-gradient(rgba(99,102,241,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.07) 1px,transparent 1px);
      background-size:24px 24px;z-index:1;`);
    addEl('', `top:0;left:0;width:28px;height:28px;border-left:2px solid #6366f1;border-top:2px solid #6366f1;z-index:2;animation:hro-pulse 0.4s ease-in-out alternate 2;`);
    addEl('', `top:0;right:0;width:28px;height:28px;border-right:2px solid #6366f1;border-top:2px solid #6366f1;z-index:2;animation:hro-pulse 0.4s ease-in-out alternate 2;`);
    addEl('', `bottom:0;left:0;width:28px;height:28px;border-left:2px solid #6366f1;border-bottom:2px solid #6366f1;z-index:2;animation:hro-pulse 0.4s ease-in-out alternate 2;`);
    addEl('', `bottom:0;right:0;width:28px;height:28px;border-right:2px solid #6366f1;border-bottom:2px solid #6366f1;z-index:2;animation:hro-pulse 0.4s ease-in-out alternate 2;`);
    await sleep(200);

    const line = addEl('', `top:0;left:0;width:100%;height:3px;z-index:3;
      background:linear-gradient(90deg,transparent,#6366f1 20%,#a78bfa 50%,#6366f1 80%,transparent);
      filter:blur(1px);`);
    const startLine = performance.now();
    await new Promise(resolve => {
      function tick() {
        const elapsed = performance.now() - startLine;
        const pct = Math.min(1, elapsed / 600);
        line.style.top = `${pct * 100}%`;
        if (pct < 1) { requestAnimationFrame(tick); } else { resolve(); }
      }
      requestAnimationFrame(tick);
    });
    try { line.remove(); } catch {}

    if (savedThisPost === undefined || savedThisPost > 0) {
      const g = addEl('', `top:0;left:0;width:100%;height:100%;z-index:3;
        background:radial-gradient(ellipse at center,rgba(16,185,129,0.12) 0%,transparent 70%);`);
      g.style.animation = 'hro-flash 0.3s ease-out';
      await sleep(300);
      try { g.remove(); } catch {}
    }

    card.style.position = origPosition;
    card.style.overflow = origOverflow;
    clearScanElements();
  }

  function highlightCard(card) {
    if (highlightedCard) {
      highlightedCard.style.outline = '';
      highlightedCard.style.boxShadow = '';
      highlightedCard.style.transition = '';
    }
    if (card) {
      card.style.outline = '3px solid #6366f1';
      card.style.boxShadow = '0 0 0 6px rgba(99,102,241,0.25)';
      highlightedCard = card;
    }
  }

  function clearHighlight() {
    if (highlightedCard) {
      highlightedCard.style.outline = '';
      highlightedCard.style.boxShadow = '';
      highlightedCard.style.transition = '';
      highlightedCard = null;
    }
  }

  function extractFromCard(el) {
    const text = (el.innerText || '').trim();
    const emails = (text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])
      .filter(e => !e.includes('example.com') && !e.includes('sentry.io') && !e.includes('placeholder') && !e.includes('linkedin.com') && !e.includes('noreply'));
    const phones = (text.match(/\+?1?\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || []);
    return { emails: [...new Set(emails)], phones: [...new Set(phones.map(p => p.trim()))], textLen: text.length };
  }

  async function expandPost(card) {
    try {
      card.scrollIntoView({ block: 'center', behavior: 'instant' });
      await sleep(500);

      const beforeText = (card.innerText || '').trim();
      const beforeLen = beforeText.length;
      const beforeLines = beforeText.split('\n').filter(Boolean).length;

      if (beforeLen < 10) return null;

      const textLower = beforeText.toLowerCase();
      const hasSeeMore = textLower.includes('more') || textLower.includes('\u2026') || textLower.includes('...');

      if (!hasSeeMore) return null;

      console.log(`[HRO] 🔍 expandPost: ${beforeLen} chars, ${beforeLines} lines`);

      function tryClick(clickTarget, label) {
        const events = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'];
        for (const evt of events) {
          clickTarget.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, button: 0 }));
        }
        clickTarget.click();
        console.log(`[HRO] 👆 ${label} — waiting...`);
      }

      async function attemptClick(clickTarget, strategyLabel) {
        clickTarget.style.outline = '3px solid #10b981';
        clickTarget.style.boxShadow = '0 0 12px #10b981';
        clickTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
        clickTarget.style.borderRadius = '4px';
        clickTarget.style.padding = '3px 8px';
        await sleep(300);

        tryClick(clickTarget, strategyLabel);
        await sleep(2000);

        let liveCard = card;
        if (!card.isConnected) {
          const cr = card.getBoundingClientRect();
          const els = document.elementsFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2);
          for (const el of els) {
            const wrapper = el.closest('[data-feed-id], .occludable-update, .feed-shared-update-v2, [role="listitem"], article');
            if (wrapper) { liveCard = wrapper; break; }
          }
          if (!liveCard || !liveCard.isConnected) liveCard = card;
        }

        const extracted = extractFromCard(liveCard);
        const diff = extracted.textLen - beforeLen;

        clickTarget.style.outline = '';
        clickTarget.style.boxShadow = '';
        clickTarget.style.backgroundColor = '';
        clickTarget.style.padding = '';

        if (diff > 20) {
          console.log(`[HRO] ✅ ${strategyLabel} SUCCESS! +${diff} chars | ${extracted.emails.length}📧 ${extracted.phones.length}📞`);
          return extracted;
        }
        console.log(`[HRO] ⚠️ ${strategyLabel}: no effect (+${diff} chars)`);
        return null;
      }

      // ── Strategy 1: data-testid button ──
      const testIdBtn = card.querySelector('[data-testid="expandable-text-button"]');
      if (testIdBtn) {
        console.log(`[HRO] 🎯 S1: [data-testid="expandable-text-button"]`);
        const clickTarget = testIdBtn.querySelector('span[style*="pointer-events: auto"]') || testIdBtn;
        const result = await attemptClick(clickTarget, 'S1');
        if (result && (result.emails.length || result.phones.length)) return result;
        if (result && result.textLen > beforeLen + 20) return result;
      }

      // ── Strategy 2: any clickable with "more" ──
      const allClickables = card.querySelectorAll('button, [role="button"], [tabindex="0"], span[style*="pointer-events"], a');
      for (const el of allClickables) {
        if (el.offsetParent === null && getComputedStyle(el).display === 'none') continue;
        const txt = (el.textContent || '').trim();
        const txtLower = txt.toLowerCase();
        if ((txtLower.includes('more') || txtLower.includes('\u2026')) && txtLower.length <= 30 &&
            (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.closest('button'))) {
          const actualTarget = el.querySelector('[style*="pointer-events: auto"]') || el;
          console.log(`[HRO] 🎯 S2: <${el.tagName}> "${txt.slice(0, 30)}"`);
          const result = await attemptClick(actualTarget, 'S2');
          if (result && (result.emails.length || result.phones.length)) return result;
          if (result && result.textLen > beforeLen + 20) return result;
        }
      }

      // ── Strategy 3: elementsFromPoint ──
      const rect = card.getBoundingClientRect();
      const points = [
        { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.75 },
        { x: rect.left + rect.width * 0.3, y: rect.bottom - 15 },
        { x: rect.left + rect.width * 0.7, y: rect.bottom - 15 },
      ];
      for (const pt of points) {
        const els = document.elementsFromPoint(pt.x, pt.y);
        for (const el of els) {
          const txt = (el.textContent || '').trim().toLowerCase();
          if ((txt.includes('more') || txt.includes('\u2026')) && !txt.includes('share') && !txt.includes('comment')) {
            const clickable = el.closest('button, [role="button"]') || el;
            const target = clickable.querySelector('[style*="pointer-events: auto"]') || clickable;
            console.log(`[HRO] 🎯 S3: elementsFromPoint <${clickable.tagName}> "${txt.slice(0, 30)}"`);
            const result = await attemptClick(target, 'S3');
            if (result && (result.emails.length || result.phones.length)) return result;
            if (result && result.textLen > beforeLen + 20) return result;
          }
        }
      }

      console.log(`[HRO] 🤷 expandPost: ALL strategies failed. Text unchanged: ${beforeLen} chars`);
      return null;
    } catch (e) {
      console.log(`[HRO] 💥 expandPost error: ${e.message}`);
    }
    return null;
  }

  // ── Extract emails/phones from expanded post text ────────────────────────────

  async function scrapePostDetail(card) {
    try {
      const pageText = card.innerText || '';
      const emails = (pageText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])
        .filter((e) => !e.includes('example.com') && !e.includes('sentry.io') && !e.includes('placeholder') && !e.includes('linkedin.com') && !e.includes('noreply'));
      const phones = (pageText.match(/\+?1?\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || []);

      const result = {
        emails: [...new Set(emails)],
        phones: [...new Set(phones.map((p) => p.trim()))],
      };
      if (result.emails.length || result.phones.length) {
        console.log(`[HRO] 📬 scrapePostDetail: found ${result.emails.length} email(s), ${result.phones.length} phone(s) in ${pageText.length} chars`);
        if (result.emails.length) console.log(`[HRO]    📧 ${result.emails.join(', ')}`);
        if (result.phones.length) console.log(`[HRO]    📞 ${result.phones.join(', ')}`);
      }
      return result;
    } catch {
      return { emails: [], phones: [] };
    }
  }

  // ── Post deduplication ────────────────────────────────────────────────────────

  function removePostWrapper(card) {
    if (!card || !card.isConnected) return;
    try {
      const topWrappers = [
        '.occludable-update',
        'div[data-feed-id]',
        '.feed-shared-update-v2',
        'li[data-feed-id]',
      ];
      let best = card;
      for (const sel of topWrappers) {
        const found = card.closest(sel);
        if (found && found.isConnected && found.contains(card)) {
          best = found;
          break;
        }
      }
      if (best !== card && best.isConnected) {
        try { best.remove(); } catch {}
      } else {
        try { card.remove(); } catch {}
      }

      let parent = best.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const children = [...parent.children].filter(c => {
          const tag = c.tagName || '';
          return tag !== 'SCRIPT' && tag !== 'STYLE' && tag !== 'LINK' && tag !== 'META';
        });
        if (children.length === 0) {
          const grandparent = parent.parentElement;
          try { parent.remove(); } catch {}
          parent = grandparent;
        } else {
          break;
        }
      }
    } catch {}
  }

  function getPostKey(card) {
    const profileLink = card.querySelector('a[href*="/in/"]');
    const profileHref = profileLink?.getAttribute('href')?.split('?')[0] || '';
    const text = (card.innerText || '').substring(0, 120).trim().replace(/\s+/g, ' ');
    return `${profileHref}||${text}`;
  }

  // ── Scrape visible posts ─────────────────────────────────────────────────────

  async function moveToCard(card) {
    card.scrollIntoView({ block: 'center', behavior: 'instant' });
    await sleep(150);
  }

  async function clickExpandBtn(card) {
    try {
      const beforeText = (card.innerText || '').trim();
      const beforeLen = beforeText.length;
      if (beforeLen < 10) return null;

      function tryClick(target) {
        const events = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'];
        for (const evt of events) {
          target.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, button: 0 }));
        }
        target.click();
      }

      // Strategy 1: data-testid button
      const testIdBtn = card.querySelector('[data-testid="expandable-text-button"]');
      if (testIdBtn) {
        console.log('[HRO] 🎯 S1: [data-testid="expandable-text-button"]');
        const clickTarget = testIdBtn.querySelector('span[style*="pointer-events: auto"]') || testIdBtn;
        tryClick(clickTarget);
        await sleep(1200);
        const text = (card.innerText || '').trim();
        const emails = (text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])
          .filter(e => !e.includes('example.com') && !e.includes('sentry.io') && !e.includes('placeholder') && !e.includes('linkedin.com') && !e.includes('noreply'));
        const phones = (text.match(/\+?1?\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || []);
        if (text.length > beforeLen + 20) {
          console.log(`[HRO] ✅ Expanded! +${text.length - beforeLen} chars`);
          return { emails: [...new Set(emails)], phones: [...new Set(phones.map(p => p.trim()))], textLen: text.length };
        }
        console.log('[HRO] ⚠️ S1 no effect');
      }

      // Strategy 2: fallback — any clickable with "more"
      const allClickables = card.querySelectorAll('button, [role="button"], [tabindex="0"]');
      for (const el of allClickables) {
        const txt = (el.textContent || '').trim().toLowerCase();
        if ((txt.includes('more') || txt.includes('\u2026')) && txt.length <= 30) {
          const actual = el.querySelector('[style*="pointer-events: auto"]') || el;
          console.log(`[HRO] 🎯 S2: <${el.tagName}> "${txt.slice(0, 30)}"`);
          tryClick(actual);
          await sleep(2200);
          const text = (card.innerText || '').trim();
          if (text.length > beforeLen + 20) {
            const emails = (text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])
              .filter(e => !e.includes('example.com') && !e.includes('sentry.io'));
            const phones = (text.match(/\+?1?\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || []);
            return { emails: [...new Set(emails)], phones: [...new Set(phones.map(p => p.trim()))], textLen: text.length };
          }
        }
      }

      // Strategy 3: elementsFromPoint
      const rect = card.getBoundingClientRect();
      for (const py of [rect.top + rect.height * 0.75, rect.bottom - 15]) {
        const els = document.elementsFromPoint(rect.left + rect.width * 0.5, py);
        for (const el of els) {
          const txt = (el.textContent || '').trim().toLowerCase();
          if ((txt.includes('more') || txt.includes('\u2026')) && !txt.includes('share') && !txt.includes('comment')) {
            const clickable = el.closest('button, [role="button"]') || el;
            const target = clickable.querySelector('[style*="pointer-events: auto"]') || clickable;
            console.log(`[HRO] 🎯 S3: elementsFromPoint <${clickable.tagName}> "${txt.slice(0, 30)}"`);
            tryClick(target);
            await sleep(2200);
            const text = (card.innerText || '').trim();
            if (text.length > beforeLen + 20) {
              const emails = (text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])
                .filter(e => !e.includes('example.com'));
              const phones = (text.match(/\+?1?\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || []);
              return { emails: [...new Set(emails)], phones: [...new Set(phones.map(p => p.trim()))], textLen: text.length };
            }
          }
        }
      }
      return null;
    } catch (e) {
      console.log('[HRO] 💥 clickExpandBtn error:', e.message);
    }
    return null;
  }

  async function scrapeVisiblePosts() {
    const cardSelectors = [
      'div[role="listitem"]',
      'div[data-feed-id]',
      'li[data-feed-id]',
      '.feed-shared-update-v2',
      '.occludable-update',
      'article',
    ];

    let cards = [];
    for (const sel of cardSelectors) {
      try {
        cards = [...document.querySelectorAll(sel)];
        if (cards.length > 0) break;
      } catch {}
    }

    if (cards.length === 0) {
      console.log('[HRO] scrapeVisiblePosts: 0 cards found, returning early');
      return;
    }

    console.log(`[HRO] scrapeVisiblePosts: ${cards.length} cards, ${seenPostKeys.size} seen, scanning...`);
    let scannedCount = 0;
    let skippedDupes = 0;
    let removedCount = 0;
    for (let i = 0; i < cards.length; i++) {
      if (stopFlag) break;

      const card = cards[i];
      if (!card || !card.isConnected) { removedCount++; continue; }

      const postKey = getPostKey(card);
      if (seenPostKeys.has(postKey)) {
        skippedDupes++;
        try { removePostWrapper(card); removedCount++; } catch {}
        continue;
      }
      seenPostKeys.add(postKey);
      scannedCount++;

      highlightCard(card);

      // ═══════════════════════════════════════════════════════════
      // LAYER 1: Quick filter — skip only obvious junk
      // ═══════════════════════════════════════════════════════════

      const l1Text = (card.innerText || '').trim();

      if (l1Text.length < 30) {
        console.log(`[HRO] ❌ L1 SKIP: tiny post (${l1Text.length} chars)`);
        try { removePostWrapper(card); removedCount++; } catch {}
        continue;
      }
      if (isJobSeekerPost(card, '')) {
        console.log('[HRO] ❌ L1 SKIP: job seeker (open to work)');
        try { removePostWrapper(card); removedCount++; } catch {}
        continue;
      }
      console.log(`[HRO] ✅ L1 PASS | ${l1Text.length} chars`);

      // ═══════════════════════════════════════════════════════════
      // LAYER 2: Expand & extract ALL contact data
      // ═══════════════════════════════════════════════════════════

      await moveToCard(card);
      await clickExpandBtn(card);

      let cardToUse = card;
      if (!card.isConnected) {
        const cr = card.getBoundingClientRect();
        if (cr.width > 0) {
          const els = document.elementsFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2);
          for (const el of els) {
            const wrapper = el.closest('[data-feed-id], .occludable-update, .feed-shared-update-v2, [role="listitem"], article');
            if (wrapper) { cardToUse = wrapper; break; }
          }
        }
        if (!cardToUse || !cardToUse.isConnected) cardToUse = card;
      }

      const fullText = (cardToUse.innerText || '').trim();
      const allEmails = [...new Set((fullText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])
        .filter(e => !e.includes('example.com') && !e.includes('sentry.io') && !e.includes('placeholder') && !e.includes('linkedin.com') && !e.includes('noreply')))];
      const allPhones = [...new Set((fullText.match(/\+?1?\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || []).map(p => p.trim()))];

      console.log(`[HRO] ✅ L2 DONE | ${fullText.length} chars | ${allEmails.length} emails | ${allPhones.length} phones`);

      // ═══════════════════════════════════════════════════════════
      // LAYER 3: Parse + validate + save EVERY contact found
      // ═══════════════════════════════════════════════════════════

      const baseContact = parsePostCard(cardToUse);
      baseContact.searchKeyword = currentKeyword;
      baseContact.searchDate = currentSearchDate;

      let savedThisPost = 0;

      if (allEmails.length === 0 && allPhones.length === 0) {
        console.log('[HRO] ❌ L3 SKIP: no emails or phones in full text');
        try { removePostWrapper(cardToUse); removedCount++; } catch {}
        continue;
      }

      // Save one entry per email found
      for (const email of allEmails) {
        if (!email || email.length < 6 || !email.includes('@') || !email.includes('.')) continue;

        const contact = { ...baseContact, email, phone: allPhones[0] || baseContact.phone || '' };
        console.log(`[HRO] 📧 L3: "${contact.name}" <${contact.email}>`);

        const result = await chrome.runtime.sendMessage({ type: 'HRO_ADD_CONTACT', contact });
        if (result?.added) { collectedCount++; savedThisPost++; if (collectedCount % 3 === 0) updatePanelProgress(collectedCount); }
      }

      // If only phone found, save phone entry
      if (allEmails.length === 0 && allPhones.length > 0) {
        const contact = { ...baseContact, phone: allPhones[0] };
        const result = await chrome.runtime.sendMessage({ type: 'HRO_ADD_CONTACT', contact });
        if (result?.added) { collectedCount++; savedThisPost++; if (collectedCount % 3 === 0) updatePanelProgress(collectedCount); }
      }

      if (savedThisPost > 0) await animateScan(cardToUse);

      console.log(`[HRO] 📊 Post: ${allEmails.length}e + ${allPhones.length}p → ${savedThisPost} saved, ${fullText.length} chars`);
      try { removePostWrapper(cardToUse); removedCount++; } catch {}

      await sleep(50);
    }
    if (removedCount > 0) {
      console.log(`[HRO] scrapeVisiblePosts: removed ${removedCount} cards from DOM`);
    }
  }

  // ── Wait for feed ────────────────────────────────────────────────────────────

  async function waitForFeedReady(maxWaitMs = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      if (document.body.scrollHeight > 1200 || (document.body.innerText?.trim().length || 0) > 5000) {
        return true;
      }
      const feedEls = document.querySelectorAll(
        'div[data-feed-id], li[data-feed-id], div.feed-shared-update-v2, main article'
      );
      if (feedEls.length > 0) return true;
      await sleep(250);
    }
    return false;
  }

  function countCards() {
    const selectors = [
      'div[role="listitem"]',
      'div[data-feed-id]',
      'li[data-feed-id]',
      '.feed-shared-update-v2',
      '.occludable-update',
      'article',
    ];
    for (const sel of selectors) {
      try {
        const count = document.querySelectorAll(sel).length;
        if (count > 0) return count;
      } catch {}
    }
    return 0;
  }

  // ── Auto-scroll and scrape ───────────────────────────────────────────────────

  async function autoScrollAndScrape(maxScrolls = 40, sessionId = 0) {
    const startMs = Date.now();
    cLog('SCRAPE_START', `session#${sessionId} maxScrolls=${maxScrolls} seen=${seenPostKeys.size} saved=${collectedCount}`);
    console.log('[HRO] ═══ SCRAPE START ═══ session:', sessionId, 'maxScrolls:', maxScrolls);

    const feedReady = await waitForFeedReady(8000);
    cLog('FEED_READY', `result=${feedReady} bodyH=${document.body.scrollHeight} textLen=${(document.body.innerText || '').length}`);
    console.log('[HRO] feedReady:', feedReady, 'bodyHeight:', document.body.scrollHeight, 'textLen:', (document.body.innerText || '').length);

    let previousCardCount = 0;
    let previousBodyHeight = 0;
    let noNewContentStreak = 0;
    let totalCardsProcessed = seenPostKeys.size;

    for (let i = 0; i < maxScrolls && !stopFlag; i++) {
      const iterStart = Date.now();
      await scrapeVisiblePosts();

      const countBefore = countCards();
      const heightBefore = document.body.scrollHeight;

      if (countBefore === 0 && seenPostKeys.size === totalCardsProcessed && i > 0) {
        console.log('[HRO] ⛔ BREAK: No cards found on page');
        break;
      }

      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });

      let waited = 0;
      while (waited < 5000 && !stopFlag) {
        await sleep(200);
        waited += 200;
        const currentCount = countCards();
        const currentHeight = document.body.scrollHeight;
        if (currentCount > countBefore || currentHeight > heightBefore + 200) {
          break;
        }
      }

      const loadMoreBtn = document.querySelector('button[aria-label*="Load more"]') ||
        document.querySelector('button[aria-label*="Show more"]') ||
        document.querySelector('button[aria-label*="See more"]');
      if (loadMoreBtn) {
        console.log('[HRO] Clicked "Load more" button, waiting 500ms...');
        loadMoreBtn.click();
        await sleep(500);
      }

      const countAfter = countCards();
      const bodyHeightAfter = document.body.scrollHeight;

      const cardsMatch = countAfter === previousCardCount;
      const heightMatch = bodyHeightAfter === previousBodyHeight;
      const noPostsProcessed = seenPostKeys.size === totalCardsProcessed;
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      const iterMs = Date.now() - iterStart;

      console.log(`[HRO] Scroll #${i + 1} | cards:${countBefore}→${countAfter} | height:${heightBefore}→${bodyHeightAfter} | seen:${seenPostKeys.size} | saved:${collectedCount} | streak:${noNewContentStreak} | iter:${iterMs}ms | total:${elapsed}s | cardsMatch:${cardsMatch} heightMatch:${heightMatch} noPosts:${noPostsProcessed}`);

      if (cardsMatch && heightMatch && noPostsProcessed) {
        noNewContentStreak++;
        console.log(`[HRO] ⚠ STUCK (all 3) streak:${noNewContentStreak}/3`);
        if (noNewContentStreak >= 3) {
          console.log('[HRO] ⛔ BREAK: No new content after 3 scrolls (cards+height+posts unchanged)');
          break;
        }
      } else if (cardsMatch && heightMatch) {
        noNewContentStreak++;
        console.log(`[HRO] ⚠ STUCK (cards+height) streak:${noNewContentStreak}/4`);
        if (noNewContentStreak >= 4) {
          console.log('[HRO] ⛔ BREAK: No new content after 4 scrolls (cards+height unchanged)');
          break;
        }
      } else {
        noNewContentStreak = 0;
      }
      previousCardCount = countAfter;
      previousBodyHeight = bodyHeightAfter;
      totalCardsProcessed = seenPostKeys.size;

      await sleep(150);
    }

    const totalElapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    if (stopFlag) {
      cLog('SCRAPE_END', `STOPPED stopFlag set | saved=${collectedCount} seen=${seenPostKeys.size} time=${totalElapsed}s`);
      console.log(`[HRO] ═══ SCRAPE STOPPED ═══ stopFlag set | saved:${collectedCount} | seen:${seenPostKeys.size} | time:${totalElapsed}s`);
    } else {
      cLog('SCRAPE_END', `DONE saved=${collectedCount} seen=${seenPostKeys.size} time=${totalElapsed}s`);
      console.log(`[HRO] ═══ SCRAPE DONE ═══ saved:${collectedCount} | seen:${seenPostKeys.size} | time:${totalElapsed}s`);
    }
    clearHighlight();
  }

  // ── Floating panel ───────────────────────────────────────────────────────────

  function updatePanelStatus(message, detail) {
    const nowTitle = document.getElementById('hro-now-title');
    const nowDetail = document.getElementById('hro-now-detail');
    if (nowTitle) nowTitle.textContent = message;
    if (nowDetail) nowDetail.textContent = detail || '';
  }

  function updatePanelProgress(count) {
    const countEl = document.getElementById('hro-count');
    const barEl = document.getElementById('hro-bar');
    const subEl = document.getElementById('hro-sub');
    const nowTitle = document.getElementById('hro-now-title');
    const nowDetail = document.getElementById('hro-now-detail');
    const badgeEl = document.getElementById('hro-badge');
    if (countEl) countEl.textContent = count;
    if (barEl) barEl.style.width = `${Math.min(100, count)}%`;
    if (subEl) subEl.textContent = `${count}`;
    if (nowTitle) nowTitle.textContent = 'Collecting contacts...';
    if (nowDetail) nowDetail.textContent = `${count} contacts saved · ${seenPostKeys.size} unique posts scanned.`;
    if (badgeEl) {
      badgeEl.textContent = 'Running';
      badgeEl.className = 'hro-badge hro-run';
    }
  }

  function setPanelIdle(count) {
    clearHighlight();
    const countEl = document.getElementById('hro-count');
    const barEl = document.getElementById('hro-bar');
    const subEl = document.getElementById('hro-sub');
    const nowTitle = document.getElementById('hro-now-title');
    const nowDetail = document.getElementById('hro-now-detail');
    const badgeEl = document.getElementById('hro-badge');
    if (countEl) countEl.textContent = count;
    if (barEl) barEl.style.width = `${Math.min(100, count)}%`;
    if (subEl) subEl.textContent = `${count}`;
    if (nowTitle) nowTitle.textContent = count > 0 ? 'Collection paused' : 'Ready to collect';
    if (nowDetail) nowDetail.textContent = count > 0 ? `${count} contacts found. Click Start to continue.` : 'Click Start Collecting to begin scraping.';
    if (badgeEl) {
      badgeEl.textContent = 'Idle';
      badgeEl.className = 'hro-badge';
    }
    const startBtn = document.getElementById('hro-start-btn');
    if (startBtn) {
      startBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start';
      startBtn.className = 'hro-start';
    }
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;

    chrome.storage.local.get([STORAGE_KEY, 'hro_is_collecting'], (data) => {
      const count = (data[STORAGE_KEY] || []).length;
      const collecting = data.hro_is_collecting || false;
      const pct = Math.min(100, count);

      panelEl = document.createElement('div');
      panelEl.id = PANEL_ID;
      panelEl.innerHTML = `
        <div class="hro-head" id="hro-drag-handle">
          <div class="hro-brand">
            <div class="hro-orb">
              <img src="${chrome.runtime.getURL('icons/icon48.png')}" alt="HR" />
            </div>
            <div>
              <div class="hro-title">HR Direct Outreach</div>
              <div class="hro-sub" id="hro-sub">${count}</div>
            </div>
          </div>
          <div class="hro-head-right">
            <span class="hro-badge ${collecting ? 'hro-run' : ''}" id="hro-badge">${collecting ? 'Running' : 'Idle'}</span>
            <div class="hro-window-actions">
              <button id="hro-minimize" title="Minimize">—</button>
              <button id="hro-close" title="Hide panel">✕</button>
            </div>
          </div>
        </div>
        <div class="hro-now">
          <div class="hro-now-title" id="hro-now-title">${collecting ? 'Collecting contacts...' : (count > 0 ? 'Collection paused' : 'Ready to collect')}</div>
          <div class="hro-now-detail" id="hro-now-detail">${collecting ? `${count} contacts found on this page.` : (count > 0 ? `${count} contacts found. Click Start to continue.` : 'Click Start Collecting to begin scraping.')}</div>
        </div>
        <div class="hro-progress">
          <div class="hro-progress-bar-bg">
            <div class="hro-progress-bar" id="hro-bar" style="width:${pct}%"></div>
          </div>
          <div class="hro-progress-text">
            <span>Progress</span>
            <span id="hro-count" style="font-weight:700;color:#6d7bff">${count}</span>
          </div>
        </div>
        <div class="hro-controls">
          <div class="hro-quick">
            <button class="hro-start" id="hro-start-btn">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              ${collecting ? 'Collecting...' : 'Start'}
            </button>
            <button class="hro-stop" id="hro-stop-btn">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
              Stop
            </button>
            <button class="hro-dashboard" id="hro-dash-btn">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              Dashboard
            </button>
          </div>
          <div class="hro-info-row">
            <span class="hro-info-pill">Scrapes LinkedIn hiring posts</span>
            <span class="hro-info-pill">·</span>
            <span class="hro-info-pill">Extracts email & phone</span>
          </div>
        </div>
      `;
      document.body.appendChild(panelEl);
      panelVisible = true;

      document.getElementById('hro-start-btn').addEventListener('click', () => {
        if (isScraping) {
          chrome.runtime.sendMessage({ type: 'HRO_STOP_COLLECTING' });
          stopFlag = true;
          isScraping = false;
          setPanelIdle(collectedCount);
        } else {
          chrome.runtime.sendMessage({ type: 'HRO_START_COLLECTING', keyword: 'we are hiring' });
          const btn = document.getElementById('hro-start-btn');
          if (btn) {
            btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Collecting...';
          }
          updatePanelProgress(collectedCount);
        }
      });

      document.getElementById('hro-stop-btn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'HRO_STOP_COLLECTING' });
        stopFlag = true;
        isScraping = false;
        if (scrapeTimeoutId !== null) { clearTimeout(scrapeTimeoutId); scrapeTimeoutId = null; }
        setPanelIdle(collectedCount);
      });

      document.getElementById('hro-dash-btn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'HRO_SYNC_TO_DASHBOARD' }).catch(() => {});
        window.open('http://localhost:3000/dashboard/hr-outreach', '_blank');
      });

      document.getElementById('hro-minimize').addEventListener('click', () => {
        panelEl.classList.toggle('hro-minimized');
      });

      document.getElementById('hro-close').addEventListener('click', () => {
        panelEl.classList.add('hro-hidden');
        panelVisible = false;
        if (toggleEl) toggleEl.style.display = 'flex';
      });

      enableDragging();

      if (collecting) {
        const btn = document.getElementById('hro-start-btn');
        if (btn) {
          btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Collecting...';
        }
        updatePanelProgress(count);
      }
    });
  }

  function createToggle() {
    if (document.getElementById(TOGGLE_ID)) return;
    toggleEl = document.createElement('button');
    toggleEl.id = TOGGLE_ID;
    toggleEl.title = 'Show HR Outreach panel';
    toggleEl.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
    toggleEl.style.display = 'none';
    document.body.appendChild(toggleEl);

    toggleEl.addEventListener('click', () => {
      if (panelEl) {
        panelEl.classList.remove('hro-hidden');
        panelVisible = true;
      }
      toggleEl.style.display = 'none';
    });
  }

  function enableDragging() {
    if (!panelEl) return;
    const handle = document.getElementById('hro-drag-handle');
    if (!handle) return;

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const onMouseMove = (event) => {
      if (!dragging || !panelEl) return;
      const nextLeft = Math.max(8, Math.min(window.innerWidth - 120, event.clientX - offsetX));
      const nextTop = Math.max(8, Math.min(window.innerHeight - 80, event.clientY - offsetY));
      panelEl.style.left = `${nextLeft}px`;
      panelEl.style.top = `${nextTop}px`;
      panelEl.style.right = 'auto';
      panelEl.style.bottom = 'auto';
    };

    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      panelEl?.classList.remove('hro-dragging');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('.hro-window-actions, button')) return;
      if (!panelEl) return;
      const rect = panelEl.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      dragging = true;
      panelEl.classList.add('hro-dragging');
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  function removePanel() {
    if (panelEl) { panelEl.remove(); panelEl = null; }
    if (toggleEl) { toggleEl.remove(); toggleEl = null; }
  }

  // ── Message listener ─────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'HRO_START_SCRAPE') {
      const mySession = ++scrapeSessionId;
      cLog('HRO_START_SCRAPE', `session#${mySession} keyword="${msg.keyword}"`);

      // Kill any running scrape (auto-resume or previous)
      if (isScraping) {
        cLog('HRO_START_SCRAPE', `stopping session#${scrapeSessionId - 1} to restart fresh`);
        stopFlag = true;
        isScraping = false;
        if (scrapeTimeoutId !== null) { clearTimeout(scrapeTimeoutId); scrapeTimeoutId = null; }
      }

      console.log('[HRO] FRESH START — keyword:', msg.keyword, 'session:', mySession);
      isScraping = true;
      stopFlag = false;
      collectedCount = 0;
      seenPostKeys = new Set();
      currentKeyword = msg.keyword || '';
      currentSearchDate = msg.searchDate || new Date().toISOString();

      if (scrapeTimeoutId !== null) clearTimeout(scrapeTimeoutId);
      const safetyTimeoutMs = 300000;
      scrapeTimeoutId = setTimeout(() => {
        if (isScraping && scrapeSessionId === mySession) {
          cLog('SAFETY_TIMEOUT', `session#${mySession} FIRE! Forcing stop`);
          console.log('[HRO] ⏰ SAFETY TIMEOUT fired — forcing stop');
          isScraping = false;
          stopFlag = true;
          chrome.runtime.sendMessage({ type: 'HRO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        }
      }, safetyTimeoutMs);

      if (window.location.href.includes('linkedin.com/search') || window.location.href.includes('linkedin.com/feed')) {
        sendResponse({ ok: true });
        cLog('HRO_START_SCRAPE', `session#${mySession} calling autoScrollAndScrape`);
        autoScrollAndScrape(40, mySession).then(() => {
          if (scrapeSessionId !== mySession) return;
          cLog('HRO_START_SCRAPE', `session#${mySession} autoScrollAndScrape COMPLETED`);
          if (scrapeTimeoutId !== null) clearTimeout(scrapeTimeoutId);
          isScraping = false;
          chrome.runtime.sendMessage({ type: 'HRO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        }).catch((e) => {
          if (scrapeSessionId !== mySession) return;
          cLog('HRO_START_SCRAPE', `session#${mySession} autoScrollAndScrape ERROR: ${e.message}`);
          if (scrapeTimeoutId !== null) clearTimeout(scrapeTimeoutId);
          isScraping = false;
          chrome.runtime.sendMessage({ type: 'HRO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        });
      } else {
        const searchUrl = buildContentSearchUrl(msg.keyword, msg.timeRange);
        cLog('HRO_START_SCRAPE', `redirecting to searchUrl: ${searchUrl}`);
        chrome.storage.local.set({
          hro_is_collecting: true,
          hro_keyword: msg.keyword,
          hro_time_range: msg.timeRange || 'any',
        }, () => {
          sendResponse({ ok: true });
          window.location.href = searchUrl;
        });
      }
      return true;
    }

    if (msg.type === 'HRO_STOP_SCRAPE') {
      cLog('HRO_STOP_SCRAPE', `stopFlag set, isScraping was ${isScraping}, collectedCount=${collectedCount}`);
      stopFlag = true;
      isScraping = false;
      if (scrapeTimeoutId !== null) { clearTimeout(scrapeTimeoutId); scrapeTimeoutId = null; }
      chrome.storage.local.set({
        [SAVED_KEYS_KEY]: [...seenPostKeys],
        [SAVED_SCROLL_KEY]: window.scrollY,
        [SAVED_COUNT_KEY]: collectedCount,
      }, () => {
        cLog('HRO_STOP_SCRAPE', `state saved: seenKeys=${seenPostKeys.size} scrollY=${window.scrollY} collected=${collectedCount}`);
      });
      sendResponse({ ok: true });
    }

    if (msg.type === 'HRO_RESUME_SCRAPE') {
      if (isScraping) { sendResponse({ ok: false, reason: 'already_running' }); return true; }
      const mySession = ++scrapeSessionId;
      cLog('HRO_RESUME_SCRAPE', `session#${mySession} keyword="${msg.keyword}"`);
      chrome.storage.local.get([SAVED_KEYS_KEY, SAVED_SCROLL_KEY, SAVED_COUNT_KEY], (saved) => {
        const keysLen = saved[SAVED_KEYS_KEY]?.length || 0;
        const savedCount = saved[SAVED_COUNT_KEY] || 0;
        cLog('HRO_RESUME_SCRAPE', `restored seenKeys=${keysLen} collected=${savedCount}`);
        console.log('[HRO] RESUME — restoring seenKeys:', keysLen, 'collected:', savedCount);
        if (saved[SAVED_KEYS_KEY] && saved[SAVED_KEYS_KEY].length > 0) {
          seenPostKeys = new Set(saved[SAVED_KEYS_KEY]);
        }
        if (saved[SAVED_COUNT_KEY] != null) {
          collectedCount = saved[SAVED_COUNT_KEY];
        }
        isScraping = true;
        stopFlag = false;
        currentKeyword = msg.keyword || currentKeyword;
        currentSearchDate = msg.searchDate || new Date().toISOString();
        if (scrapeTimeoutId !== null) clearTimeout(scrapeTimeoutId);
        const resumeTimeoutMs = 300000;
        cLog('HRO_RESUME_SCRAPE', `session#${mySession} timeout set to ${resumeTimeoutMs}ms`);
        scrapeTimeoutId = setTimeout(() => {
          if (isScraping && scrapeSessionId === mySession) {
            cLog('RESUME_TIMEOUT', `session#${mySession} FIRE!! Forcing stop`);
            isScraping = false;
            stopFlag = true;
            chrome.runtime.sendMessage({ type: 'HRO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
          }
        }, resumeTimeoutMs);
        sendResponse({ ok: true });
        updatePanelProgress(collectedCount);
        autoScrollAndScrape(40, mySession).then(() => {
          if (scrapeSessionId !== mySession) return;
          cLog('HRO_RESUME_SCRAPE', `session#${mySession} COMPLETED`);
          if (scrapeTimeoutId !== null) clearTimeout(scrapeTimeoutId);
          isScraping = false;
          chrome.runtime.sendMessage({ type: 'HRO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        }).catch((e) => {
          if (scrapeSessionId !== mySession) return;
          cLog('HRO_RESUME_SCRAPE', `session#${mySession} ERROR: ${e.message}`);
          if (scrapeTimeoutId !== null) clearTimeout(scrapeTimeoutId);
          isScraping = false;
          chrome.runtime.sendMessage({ type: 'HRO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        });
      });
      return true;
    }

    return true;
  });

  // ── Auto-resume if navigated during collection ───────────────────────────────

  chrome.storage.local.get(['hro_is_collecting', 'hro_keyword', 'hro_time_range', SAVED_KEYS_KEY, SAVED_COUNT_KEY], (data) => {
    cLog('AUTO_RESUME_CHECK', `isCollecting=${data.hro_is_collecting} onPage=${window.location.href.includes('/search/results/content') || window.location.href.includes('/feed')}`);
    if (
      data.hro_is_collecting &&
      (window.location.href.includes('/search/results/content') || window.location.href.includes('/feed'))
    ) {
      const mySession = ++scrapeSessionId;
      cLog('AUTO_RESUME', `session#${mySession} TRIGGERED`);
      isScraping = true;
      stopFlag = false;
      const keysLen = data[SAVED_KEYS_KEY]?.length || 0;
      const savedCount = data[SAVED_COUNT_KEY] || 0;
      console.log('[HRO] AUTO-RESUME — restoring seenKeys:', keysLen, 'collected:', savedCount);
      if (data[SAVED_KEYS_KEY] && data[SAVED_KEYS_KEY].length > 0) {
        seenPostKeys = new Set(data[SAVED_KEYS_KEY]);
      } else {
        seenPostKeys = new Set();
      }
      collectedCount = data[SAVED_COUNT_KEY] || 0;
      currentKeyword = data.hro_keyword || '';
      currentSearchDate = new Date().toISOString();

      autoScrollAndScrape(40, mySession).then(() => {
        if (scrapeSessionId !== mySession) return;
        cLog('AUTO_RESUME', `session#${mySession} COMPLETED`);
        isScraping = false;
        chrome.runtime.sendMessage({ type: 'HRO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        chrome.storage.local.remove('hro_is_collecting');
        chrome.storage.local.remove(SAVED_KEYS_KEY);
        chrome.storage.local.remove(SAVED_COUNT_KEY);
        chrome.storage.local.remove(SAVED_SCROLL_KEY);
      }).catch((e) => {
        if (scrapeSessionId !== mySession) return;
        cLog('AUTO_RESUME', `session#${mySession} ERROR: ${e.message}`);
        isScraping = false;
        chrome.runtime.sendMessage({ type: 'HRO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        chrome.storage.local.remove('hro_is_collecting');
      });
    }
  });

  // ── Status update listener ───────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'HRO_COLLECTING_STATUS') {
      cLog('PUSH_STATUS', `count=${msg.count}`);
      updatePanelProgress(msg.count);
    }
    if (msg.type === 'HRO_COLLECTING_DONE') {
      cLog('PUSH_DONE', `count=${msg.count}`);
      setPanelIdle(msg.count);
      isScraping = false;
    }

    if (msg.type === 'HRO_PANEL_VISIBILITY') {
      cLog('PANEL_VISIBILITY', `enabled=${msg.enabled}`);
      if (msg.enabled) {
        if (!panelEl) {
          createPanel();
          createToggle();
        } else {
          panelEl.classList.remove('hro-hidden');
          panelVisible = true;
          if (toggleEl) toggleEl.style.display = 'none';
        }
      } else {
        removePanel();
      }
    }
  });

  // ── Show panel only if enabled in settings ───────────────────────────────────

  if (window.location.href.includes('linkedin.com')) {
    cLog('PANEL_INIT', 'linkedin.com detected, checking panel enabled');
    const initPanel = () => {
      chrome.storage.local.get('hro_panel_enabled', (data) => {
        cLog('PANEL_CHECK', `panel_enabled=${data.hro_panel_enabled}`);
        if (data.hro_panel_enabled) {
          createPanel();
          createToggle();
        }
      });
    };

    if (document.body) {
      initPanel();
    } else {
      document.addEventListener('DOMContentLoaded', initPanel);
    }
  }
})();