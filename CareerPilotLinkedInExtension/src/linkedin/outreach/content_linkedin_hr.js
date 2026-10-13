// ─────────────────────────────────────────────────────────────────────────────
// Jobs Smart Outreach — content.js
// Injected into all linkedin.com pages.
// Scrapes "We are hiring" posts, extracts HR contact data, sends to background.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  if (window.__jsoContentInjected) return;
  window.__jsoContentInjected = true;

  let isScraping = false;
  let stopFlag = false;
  let currentCategory = '';
  let collectedCount = 0;
  let scrapeTimeoutId = null;  // Per-instance timeout handle

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  function extractEmailFromText(text) {
    const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    return match ? match[0] : null;
  }

  // Parse a post card and extract HR contact data
  function parsePostCard(card) {
    const contact = {
      name: '',
      title: '',
      company: '',
      email: '',
      category: currentCategory,
      linkedinUrl: '',
      sourcePostUrl: window.location.href,
    };

    // Author name — different selectors across LinkedIn layouts
    const nameEl =
      card.querySelector('.update-components-actor__name') ||
      card.querySelector('.feed-shared-actor__name') ||
      card.querySelector('[data-control-name="actor"] span') ||
      card.querySelector('.actor-name');
    if (nameEl) contact.name = nameEl.innerText.trim();

    // Title / headline
    const titleEl =
      card.querySelector('.update-components-actor__description') ||
      card.querySelector('.feed-shared-actor__description') ||
      card.querySelector('.actor-description');
    if (titleEl) {
      const raw = titleEl.innerText.trim();
      // Company is often "Title at Company" or "Title · Company"
      const atIdx = raw.indexOf(' at ');
      const bulletIdx = raw.indexOf(' · ');
      if (atIdx !== -1) {
        contact.title = raw.slice(0, atIdx).trim();
        contact.company = raw.slice(atIdx + 4).trim();
      } else if (bulletIdx !== -1) {
        contact.title = raw.slice(0, bulletIdx).trim();
        contact.company = raw.slice(bulletIdx + 3).trim();
      } else {
        contact.title = raw;
      }
    }

    // LinkedIn profile URL from author link
    const profileLink =
      card.querySelector('.update-components-actor__meta a') ||
      card.querySelector('.feed-shared-actor__container a') ||
      card.querySelector('a[data-control-name="actor"]');
    if (profileLink) {
      const href = profileLink.getAttribute('href') ?? '';
      if (href.includes('/in/')) {
        contact.linkedinUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href.split('?')[0]}`;
      }
    }

    // Extract email from post text if visible
    const postTextEl =
      card.querySelector('.update-components-text') ||
      card.querySelector('.feed-shared-text') ||
      card.querySelector('.break-words');
    if (postTextEl) {
      const email = extractEmailFromText(postTextEl.innerText);
      if (email) contact.email = email;
    }

    // Extract hashtag categories from post
    const hashtags = [...card.querySelectorAll('a[href*="/feed/hashtag/"]')]
      .map((a) => a.innerText.replace('#', '').trim())
      .filter(Boolean);
    if (hashtags.length > 0 && !contact.category) {
      contact.category = hashtags.slice(0, 3).join(', ');
    }

    return contact;
  }

  // Click "Contact info" link on a profile page and grab the email
  async function scrapeEmailFromProfile(profileUrl) {
    return new Promise((resolve) => {
      // We can't navigate away; ask background to open in a temporary tab
      // For now, try to find the email from the current DOM if we're on that profile
      const contactBtn = document.querySelector('a[href*="contact-info"]');
      if (!contactBtn) return resolve(null);

      contactBtn.click();

      setTimeout(() => {
        const modal = document.querySelector('.pv-contact-info__ci-container, .artdeco-modal__content');
        if (!modal) { resolve(null); return; }

        const emailLink = modal.querySelector('a[href^="mailto:"]');
        if (emailLink) {
          resolve(emailLink.href.replace('mailto:', '').trim());
        } else {
          const text = modal.innerText;
          resolve(extractEmailFromText(text));
        }

        // Close modal
        const closeBtn = modal.closest('.artdeco-modal')?.querySelector('button[aria-label="Dismiss"]');
        if (closeBtn) closeBtn.click();
      }, 1500);
    });
  }

  // Send debug message to background
  function debugLog(event, data = {}) {
    chrome.runtime.sendMessage({
      type: 'JSO_DEBUG_EVENT',
      level: 'info',
      event: `content_${event}`,
      source: 'content',
      data,
    }).catch(() => {});
  }

  // Click on a post to expand and look for emails
  async function scrapePostDetail(card) {
    try {
      // Find the best clickable element in the post
      const clickTargets = [
        card.querySelector('[data-control-name="comment_open_comments"]'),
        card.querySelector('a[data-control-name="feed.social_actions"]'),
        card.querySelector('[role="button"][aria-label*="post"]'),
        card.querySelector('.feed-shared-update-v2'),
        card.querySelector('.occludable-update'),
        card,
      ].filter(Boolean);

      if (clickTargets.length === 0) {
        debugLog('post_detail_no_clickable', {});
        return [];
      }

      const clickTarget = clickTargets[0];
      clickTarget.click?.();
      
      debugLog('post_clicked', {});
      await sleep(1500); // Wait for modal to open

      // Collect all text from page and look for emails
      const pageText = document.body.innerText;
      const emails = pageText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
      
      // Deduplicate and filter bad emails
      const validEmails = [...new Set(emails)].filter(e => 
        !e.includes('example.com') &&
        !e.includes('sentry.io') &&
        !e.includes('placeholder') &&
        !e.includes('png') &&
        !e.includes('jpg')
      );
      
      if (validEmails.length > 0) {
        debugLog('emails_in_detail', { count: validEmails.length, emails: validEmails.slice(0, 5) });
      }

      // Try to close any modal by pressing Escape
      const escapeEvent = new KeyboardEvent('keydown', { 
        key: 'Escape', 
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true 
      });
      document.dispatchEvent(escapeEvent);
      await sleep(500);

      return validEmails;
    } catch (err) {
      debugLog('post_detail_error', { error: String(err) });
      return [];
    }
  }

  // Main scrape loop — walks through visible post cards
  async function scrapeVisiblePosts() {
    const cardSelectors = [
      // LinkedIn feed specific (primary)
      'div[data-feed-id]',                 // Primary LinkedIn feed ID
      'div[data-view-name*="feed"]',       // Feed view name
      'li[data-feed-id]',                  // Feed item list
      '.artdeco-modal-overlay + div div[data-urn]',  // After modal
      
      // Original selectors
      '.feed-shared-update-v2',
      '.occludable-update',
      '[data-urn*="activity"]',
      '.artdeco-card',
      'div[data-test-id*="feed"]',
      
      // Semantic/ARIA selectors
      'li[data-id]',
      'article',
      'div[role="article"]',
      'div[data-test-id="feed-list-item"]',
      '.update',
      '[data-feed-id]',
      
      // Search/List selectors
      'ul[role="list"] > li',
      'div[data-view-name="feed-list-item"]',
      '.global-nav ~ div div[data-test-id]',
      
      // Additional feed containers
      'main div[role="region"]',           // Main content region
      'main article',                      // Articles in main
      'div.artdeco-feed-element',          // Feed element class
      'div[class*="feed"][class*="update"]', // Feed update combo
      'li[class*="update"]',               // Update list items
      'div.feed-item',                     // Feed item
      'div.feed-container > div',          // Feed container children
    ];
    
    let cards = [];
    let usedSelector = '';
    let selectorAttempts = [];
    
    // Log page structure for debugging
    const pageInfo = {
      documentReady: document.readyState,
      bodyClass: document.body.className,
      bodyHeight: document.body.scrollHeight,
      bodyText: document.body.innerText?.substring(0, 200) || '',
      hasLinkedinNav: !!document.querySelector('[data-test-id="global-nav"]'),
      hasFeedContainer: !!document.querySelector('[role="region"]'),
      hasMainElement: !!document.querySelector('main'),
      pageUrl: window.location.href,
      mainContentText: document.querySelector('main')?.innerText?.substring(0, 200) || '',
    };
    debugLog('page_structure_info', pageInfo);
    
    // Try all selectors
    for (const sel of cardSelectors) {
      try {
        cards = [...document.querySelectorAll(sel)];
        if (cards.length > 0) {
          usedSelector = sel;
          selectorAttempts.push({ selector: sel, found: cards.length });
          debugLog('posts_found', { selector: sel, count: cards.length });
          break;
        } else {
          selectorAttempts.push({ selector: sel, found: 0 });
        }
      } catch (err) {
        debugLog('selector_error', { selector: sel, error: String(err) });
      }
    }

    // If no posts found with specific selectors, try to find any divs with email patterns
    if (cards.length === 0) {
      debugLog('no_posts_found_trying_fallback', { attemptedSelectors: selectorAttempts });
      const allElements = document.querySelectorAll('div[role], article, li, main > div');
      const emailPattern = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
      
      for (const elem of allElements) {
        if (stopFlag) break;
        if (elem.innerText && emailPattern.test(elem.innerText) && elem.innerText.length < 1000) {
          cards.push(elem);
          if (cards.length >= 10) break;
        }
      }
      
      if (cards.length > 0) {
        debugLog('fallback_posts_found', { count: cards.length, method: 'email_pattern' });
      }
    }

    debugLog('scrape_start', { cardsFound: cards.length, selector: usedSelector });

    for (const card of cards) {
      if (stopFlag) break;

      const contact = parsePostCard(card);
      if (!contact.name && !contact.email) continue;
      
      debugLog('contact_parsed', { name: contact.name, company: contact.company, hasEmail: !!contact.email });

      // If email visible in feed, add it
      if (contact.email) {
        debugLog('email_found_in_feed', { email: contact.email });
        const result = await chrome.runtime.sendMessage({
          type: 'JSO_ADD_CONTACT',
          contact,
        });
        if (result?.capped) {
          stopFlag = true;
          break;
        }
        if (result?.added) {
          collectedCount++;
          updateFloatingPanel(collectedCount);
        }
      } else {
        // Click into post to look for emails in expanded view
        const detailEmails = await scrapePostDetail(card);
        
        if (detailEmails.length > 0) {
          for (const email of detailEmails) {
            const contactWithEmail = { ...contact, email };
            debugLog('email_captured_from_detail', { email, name: contact.name });
            
            const result = await chrome.runtime.sendMessage({
              type: 'JSO_ADD_CONTACT',
              contact: contactWithEmail,
            });
            if (result?.capped) {
              stopFlag = true;
              break;
            }
            if (result?.added) {
              collectedCount++;
              updateFloatingPanel(collectedCount);
            }
          }
        }
      }

      await sleep(300);
    }
  }

  // Helper: Wait for page to be ready (feed content rendered)
  async function waitForFeedReady(maxWaitMs = 12000) {
    const startTime = Date.now();
    let lastBodyHeight = 0;
    let stableCount = 0;
    
    while (Date.now() - startTime < maxWaitMs) {
      const bodyHeight = document.body.scrollHeight;
      const bodyText = document.body.innerText?.trim().length || 0;
      
      // If body is tall and has lots of text, feed is loading/loaded
      if (bodyHeight > 1200 || bodyText > 5000) {
        debugLog('feed_content_detected', { 
          bodyHeight,
          bodyTextLength: bodyText,
          waitedMs: Date.now() - startTime
        });
        return true;
      }
      
      // Check if specific feed elements exist
      const feedElements = document.querySelectorAll(
        'div[data-feed-id], li[data-feed-id], div.feed-shared-update-v2, ' +
        'div[role="region"] article, main article, div[class*="feed"][class*="update"]'
      );
      
      if (feedElements.length > 0) {
        debugLog('feed_elements_detected', { 
          count: feedElements.length,
          waitedMs: Date.now() - startTime
        });
        return true;
      }
      
      // Check if scrollHeight is increasing (content loading)
      if (bodyHeight > lastBodyHeight) {
        stableCount = 0;
        lastBodyHeight = bodyHeight;
      } else {
        stableCount++;
      }
      
      // If height stable for 3 checks and still minimal, page won't load feed
      if (stableCount >= 3 && bodyHeight < 1000) {
        debugLog('feed_height_stable_minimal', { 
          finalHeight: bodyHeight,
          waitedMs: Date.now() - startTime
        });
        return false;
      }

      await sleep(400);
    }
    
    debugLog('feed_ready_timeout', { 
      maxWaitMs,
      finalBodyHeight: document.body.scrollHeight,
      finalBodyTextLength: document.body.innerText?.trim().length || 0
    });
    return false;
  }

  // Auto-scroll to load more posts
  async function autoScrollAndScrape(maxScrolls = 10) {
    // Diagnostic: Log initial page state
    const initialDiagnostics = {
      maxScrolls,
      pageUrl: window.location.href,
      documentReady: document.readyState,
      bodyHeight: document.body.scrollHeight,
      viewportHeight: window.innerHeight,
      bodyTextLength: document.body.innerText?.trim().length || 0,
      allDivCount: document.querySelectorAll('div').length,
      allArticleCount: document.querySelectorAll('article').length,
      linkedinLogoVisible: !!document.querySelector('[data-test-id="global-nav"] img'),
    };
    debugLog('autoscroll_start', initialDiagnostics);

    // Wait for feed content to load
    const feedReady = await waitForFeedReady(8000);
    if (!feedReady) {
      debugLog('feed_content_never_loaded', { 
        diagnostics: initialDiagnostics 
      });
      // Continue anyway, might be minimal feed or different layout
    }
    
    for (let i = 0; i < maxScrolls && !stopFlag; i++) {
      debugLog('scroll_loop', { iteration: i + 1, maxScrolls });
      await scrapeVisiblePosts();
      window.scrollBy(0, 800);
      debugLog('content_scrolled', { pixels: 800, iteration: i + 1 });
      await sleep(1500);

      // Check if more posts loaded
      const loadMoreBtn = document.querySelector('button[aria-label*="Load more"]');
      if (loadMoreBtn) {
        debugLog('load_more_clicked', { iteration: i + 1 });
        loadMoreBtn.click();
      }
      await sleep(800);
    }
    debugLog('autoscroll_end', { totalIterations: maxScrolls, finalCount: collectedCount });
  }

  // Semi-manual mode: show posts and let user select which to extract
  function createPostSelectionUI(posts) {
    const modal = document.createElement('div');
    modal.id = 'jso-post-selector';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100000;
      font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      max-height: 600px;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    `;

    let selectedPosts = new Set();
    
    const postsHtml = posts.map((post, idx) => `
      <div style="padding: 12px; margin: 8px 0; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer;"
           data-post-idx="${idx}">
        <input type="checkbox" data-post-idx="${idx}" style="margin-right: 8px;">
        <span>${post.name || 'Unknown'}</span>
        ${post.company ? ` @ <strong>${post.company}</strong>` : ''}
        ${post.email ? `<br><code style="font-size: 12px; color: #666;">${post.email}</code>` : ''}
      </div>
    `).join('');

    content.innerHTML = `
      <h3 style="margin-top: 0;">Select posts with HR emails</h3>
      <div>${postsHtml}</div>
      <div style="margin-top: 16px; display: flex; gap: 8px;">
        <button id="jso-select-all" style="flex: 1; padding: 8px; background: #0066cc; color: white; border: none; border-radius: 6px; cursor: pointer;">Select All</button>
        <button id="jso-extract-selected" style="flex: 1; padding: 8px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer;">Extract Selected</button>
        <button id="jso-cancel-selection" style="flex: 1; padding: 8px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
      </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Handle checkbox changes
    content.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const idx = parseInt(checkbox.dataset.postIdx);
        if (checkbox.checked) {
          selectedPosts.add(idx);
        } else {
          selectedPosts.delete(idx);
        }
      });
    });

    // Select all
    document.getElementById('jso-select-all').addEventListener('click', () => {
      selectedPosts.clear();
      content.querySelectorAll('input[type="checkbox"]').forEach((cb, idx) => {
        cb.checked = true;
        selectedPosts.add(idx);
      });
    });

    // Extract selected
    document.getElementById('jso-extract-selected').addEventListener('click', () => {
      const selectedPostsList = Array.from(selectedPosts).map(idx => posts[idx]);
      debugLog('manual_selection_extracted', { count: selectedPostsList.length });
      
      selectedPostsList.forEach(post => {
        if (post.email) {
          chrome.runtime.sendMessage({ type: 'JSO_ADD_CONTACT', contact: post }).catch(() => {});
        }
      });
      
      modal.remove();
    });

    // Cancel
    document.getElementById('jso-cancel-selection').addEventListener('click', () => {
      modal.remove();
    });
  }

  // ── Manual Mode Helper ──────────────────────────────────────────────────────

  function createFloatingPanel(count) {
    if (panelEl) return;
    panelEl = document.createElement('div');
    panelEl.id = 'jso-panel';
    panelEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:16px;">🎯</span>
        <div>
          <div style="font-weight:700;font-size:13px;color:#6366f1;">Jobs Smart Outreach</div>
          <div id="jso-panel-status" style="font-size:12px;color:#64748b;">Collecting…</div>
        </div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:6px;">
          <span id="jso-panel-count" style="font-weight:700;font-size:18px;color:#6366f1;">${count}</span>
          <span style="font-size:12px;color:#94a3b8;">/ 100</span>
          <button id="jso-panel-stop" style="
            background:#ef4444;color:#fff;border:none;border-radius:8px;
            padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer;
          ">Stop</button>
        </div>
      </div>
      <div style="margin-top:8px;height:4px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
        <div id="jso-panel-bar" style="height:100%;border-radius:4px;background:linear-gradient(90deg,#6366f1,#a855f7);transition:width .4s;width:${Math.min(100, count)}%;"></div>
      </div>
    `;
    Object.assign(panelEl.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: '99999',
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(99,102,241,0.2)',
      borderRadius: '16px',
      padding: '14px 16px',
      minWidth: '280px',
      boxShadow: '0 8px 32px rgba(15,23,42,0.15)',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    });
    document.body.appendChild(panelEl);

    document.getElementById('jso-panel-stop').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'JSO_STOP_COLLECTING' });
      stopFlag = true;
      isScraping = false;
      removeFloatingPanel();
    });
  }

  function updateFloatingPanel(count) {
    const countEl = document.getElementById('jso-panel-count');
    const barEl = document.getElementById('jso-panel-bar');
    const statusEl = document.getElementById('jso-panel-status');
    if (countEl) countEl.textContent = count;
    if (barEl) barEl.style.width = `${Math.min(100, count)}%`;
    if (statusEl) statusEl.textContent = count >= 100 ? '✅ Cap reached!' : `${count} contacts collected`;
  }

  function removeFloatingPanel() {
    if (panelEl) { panelEl.remove(); panelEl = null; }
  }

  // ── Message Listener ──────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    // Semi-manual mode: show found posts for user to select
    if (msg.type === 'JSO_SHOW_POSTS_FOR_SELECTION') {
      debugLog('manual_mode_show_posts', { count: msg.posts?.length || 0 });
      createPostSelectionUI(msg.posts || []);
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'JSO_START_SCRAPE') {
      debugLog('scrape_request', { keyword: msg.keyword, currentUrl: window.location.href });
      
      if (isScraping) { 
        debugLog('scrape_rejected', { reason: 'already_running' });
        sendResponse({ ok: false, reason: 'already_running' }); 
        return true;
      }

      isScraping = true;
      stopFlag = false;
      currentCategory = msg.category ?? '';
      collectedCount = 0;

      // Clear any existing timeout first
      if (scrapeTimeoutId !== null) {
        clearTimeout(scrapeTimeoutId);
        debugLog('cleared_previous_timeout', {});
      }

      // Auto-reset isScraping flag after 25 seconds (before background.js timeout at 30s)
      scrapeTimeoutId = setTimeout(() => {
        if (isScraping) {
          debugLog('safety_timeout_triggered', { reason: 'content_timeout_25s' });
          isScraping = false;
          stopFlag = true;
          removeFloatingPanel();
          chrome.runtime.sendMessage({ type: 'JSO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        }
      }, 25000);

      createFloatingPanel(0);
      debugLog('panel_created', {});

      // If we're on a search page, start scraping; otherwise navigate
      if (window.location.href.includes('linkedin.com/search') || window.location.href.includes('linkedin.com/feed')) {
        debugLog('on_search_page', { url: window.location.href });
        sendResponse({ ok: true });
        autoScrollAndScrape(15).then(() => {
          if (scrapeTimeoutId !== null) clearTimeout(scrapeTimeoutId);
          debugLog('scrape_completed', { count: collectedCount });
          isScraping = false;
          chrome.runtime.sendMessage({ type: 'JSO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        }).catch((err) => {
          if (scrapeTimeoutId !== null) clearTimeout(scrapeTimeoutId);
          debugLog('scrape_error', { error: String(err) });
          isScraping = false;
          chrome.runtime.sendMessage({ type: 'JSO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        });
      } else {
        debugLog('not_on_search_page', { url: window.location.href });
        // Store state before navigating, then navigate to LinkedIn search
        chrome.storage.local.set({
          jso_is_collecting: true,
          jso_keyword: msg.keyword,
          jso_category: msg.category || '',
        }, () => {
          sendResponse({ ok: true });
          const url = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(msg.keyword)}&origin=GLOBAL_SEARCH_HEADER`;
          window.location.href = url;
        });
      }
      return true; // Keep channel open for async sendResponse
    }

    if (msg.type === 'JSO_STOP_SCRAPE') {
      stopFlag = true;
      isScraping = false;
      if (scrapeTimeoutId !== null) {
        clearTimeout(scrapeTimeoutId);
        scrapeTimeoutId = null;
      }
      removeFloatingPanel();
      sendResponse({ ok: true });
    }

    return true;
  });

  // ── Auto-resume if page was navigated during collection ───────────────────────

  chrome.storage.local.get(['jso_is_collecting', 'jso_keyword', 'jso_category'], (data) => {
    if (
      data.jso_is_collecting &&
      (window.location.href.includes('/search/results/content') || window.location.href.includes('/feed'))
    ) {
      currentCategory = data.jso_category ?? '';
      isScraping = true;
      stopFlag = false;
      collectedCount = 0;
      createFloatingPanel(0);
      
      autoScrollAndScrape(15).then(() => {
        isScraping = false;
        chrome.runtime.sendMessage({ type: 'JSO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        chrome.storage.local.remove('jso_is_collecting');
      }).catch(() => {
        isScraping = false;
        chrome.runtime.sendMessage({ type: 'JSO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        chrome.storage.local.remove('jso_is_collecting');
      });
    }
  });
})();
