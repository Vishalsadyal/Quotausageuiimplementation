/*
 * LinkedIn Jobs pagination: load all cards on a results page, read the page number, find and use
 * the next-page control. Each question has an ordered list of strategies (class-free ones included),
 * so a LinkedIn markup change degrades to the next strategy instead of stopping the run.
 *
 * Depends on src/linkedin/core/dom.js (CPLinkedInDom) and wait.js (CPLinkedInWait). Shared by the content script and
 * tools/probes/out/1-pages-probe.js, so the probe tests exactly the code the extension runs.
 * Exposes globalThis.CPLinkedInPages.
 */
(function initCPLinkedInPages(global) {
  if (global.CPLinkedInPages) return;
  const Dom = global.CPLinkedInDom;
  const Wait = global.CPLinkedInWait; // smart waits (src/linkedin/core/wait.js)

  const norm = (t) => String(t || "").toLowerCase().replace(/\s+/g, " ").trim();
  const isVisible = (el) => {
    const r = el?.getBoundingClientRect?.();
    return Boolean(r && r.width > 0 && r.height > 0);
  };
  const isDisabled = (el) =>
    el.disabled === true || el.getAttribute("aria-disabled") === "true" || /\bdisabled\b/.test(String(el.className || ""));
  const OUR_UI =
    "header, #global-nav, #msg-overlay, [id^='cp-'], .cp-probe-label, .cp-card-outcome-tag, #li-wa-widget, #li-email-widget, #li-autocommenter-widget";
  const controls = () =>
    Array.from(document.querySelectorAll("button, a, [role='button']")).filter((el) => isVisible(el) && !el.closest(OUR_UI));
  const labelOf = (el) => norm(el.getAttribute("aria-label")) || norm(el.textContent);
  const tileKey = (t) => Dom.jobIdOf(t).id;

  // ---------------------------------------------------------------- loading all cards on a page
  /** Nearest scrollable ancestor of a job card (the results list), or null for window scrolling. */
  function scrollRootOf(tile) {
    for (let n = tile?.parentElement; n && n !== document.body; n = n.parentElement) {
      const oy = getComputedStyle(n).overflowY;
      if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 20) return n;
    }
    return null;
  }

  /** The results list element (scroll container of the cards), or the page body. */
  function listRoot() {
    return scrollRootOf(Dom.findJobTiles().tiles[0]) || document.querySelector("main") || document.body;
  }

  /**
   * Smart wait for cards: at least minTiles cards, none of them loaders, list DOM quiet. With
   * notIds, at least one of the first cards must be NEW (the next page, not the old one still on
   * screen): LinkedIn changes the URL first and renders the new cards later.
   * Resolves { ok, found, waitedMs, reason }.
   */
  async function waitForCards({ timeoutMs = 12000, minTiles = 2, notIds = null, quietMs = 500, shouldStop } = {}) {
    let found = { tiles: [], strategy: "none", attempts: [] };
    // One card search per poll: the root is derived from the cards just found (findJobTiles can be
    // expensive on layouts that need the full-page fallbacks).
    let root = null;
    const check = () => {
      found = Dom.findJobTiles();
      root = scrollRootOf(found.tiles[0]);
      if (found.tiles.length < minTiles) return false;
      return !notIds || found.tiles.slice(0, 5).some((t) => !notIds.has(tileKey(t)));
    };
    const res = await Wait.settled(() => root || document.querySelector("main") || document.body, check, { timeoutMs, quietMs, shouldStop });
    if (!res.ok) check(); // report what is on the page now
    return { ok: res.ok, found, waitedMs: res.waitedMs, reason: res.reason };
  }

  /** Scrolls the results list (or the window) back to the top so LinkedIn renders cards from #1. */
  function scrollListToTop(root) {
    if (root?.isConnected) root.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }

  /**
   * Scrolls the results list to the bottom (LinkedIn lazy-loads cards and only fills the ones near
   * the viewport). After each scroll step it waits for the list to stop changing instead of a fixed
   * sleep, and stops at the bottom once the card count is stable.
   * Resolves { found, scrollRoot: "list container" | "window", ms, waitedForFirstCardsMs, reason }.
   */
  async function loadAllCards({ settleMs = 1200, timeoutMs = 20000, shouldStop = () => false } = {}) {
    const start = Date.now();
    // 1. the page may still be rendering (just navigated): wait for the first cards to settle
    const first = await waitForCards({ timeoutMs: Math.min(12000, timeoutMs), shouldStop });
    let found = first.found;
    if (!first.ok && !found.tiles.length) {
      return { found, scrollRoot: "none", ms: Date.now() - start, waitedForFirstCardsMs: first.waitedMs, reason: first.reason };
    }
    let root = scrollRootOf(found.tiles[0]);
    let lastCount = found.tiles.length;
    let stableSince = Date.now();
    // 2. scroll down step by step, waiting for each batch of cards to render
    while (Date.now() - start < timeoutMs && !shouldStop()) {
      if (root?.isConnected) root.scrollBy({ top: Math.max(400, root.clientHeight * 0.8) });
      else window.scrollBy({ top: 800 });
      await Wait.domQuiet(root?.isConnected ? root : document.body, { quietMs: 250, timeoutMs: 900 });
      found = Dom.findJobTiles();
      if (!root?.isConnected) root = scrollRootOf(found.tiles[0]);
      if (found.tiles.length !== lastCount) {
        lastCount = found.tiles.length;
        stableSince = Date.now();
      }
      const atBottom = root
        ? root.scrollTop + root.clientHeight >= root.scrollHeight - 5
        : innerHeight + scrollY >= document.body.scrollHeight - 5;
      if (atBottom && Wait.noLoaders(root || document.body) && Date.now() - stableSince >= settleMs) break;
    }
    return { found, scrollRoot: root ? "list container" : "window", ms: Date.now() - start, waitedForFirstCardsMs: first.waitedMs, reason: "" };
  }

  // ---------------------------------------------------------------- page number
  const PAGE_INFO_STRATEGIES = [
    [
      "page-state-text", // "Page 2 of 9"
      () => {
        const text = Array.from(document.querySelectorAll("p, span, div"))
          .filter((el) => el.childElementCount === 0 && !el.closest(OUR_UI))
          .map((el) => norm(el.textContent))
          .find((t) => /^page \d+ of \d+$/.test(t));
        if (!text) return null;
        const [, cur, total] = text.match(/^page (\d+) of (\d+)$/);
        return { page: Number(cur), total: Number(total) };
      },
    ],
    [
      "aria-current",
      () => {
        const active = Array.from(document.querySelectorAll("[aria-current='true'], [aria-current='page'], [aria-pressed='true']")).find(
          (el) => /^\d+$/.test(norm(el.textContent)) && !el.closest(OUR_UI),
        );
        return active ? { page: Number(norm(active.textContent)), total: 0 } : null;
      },
    ],
    [
      "url-start",
      () => {
        const start = Number(new URL(location.href).searchParams.get("start") || 0);
        return { page: Math.floor(start / 25) + 1, total: 0 };
      },
    ],
  ];

  /** { page, total (0 = unknown), via } */
  function currentPageInfo() {
    for (const [via, fn] of PAGE_INFO_STRATEGIES) {
      try {
        const info = fn();
        if (info) return { ...info, via };
      } catch {
        // next strategy
      }
    }
    return { page: 1, total: 0, via: "none" };
  }

  // ---------------------------------------------------------------- pagination bar
  // LinkedIn shows a sliding window of page numbers, e.g. page 1: "1 2 3 Next", page 3:
  // "Previous 2 3 4 Next", last page: "Previous 2 3 4" (no Next). The total is never shown, so the
  // last page is the one without an enabled Next and without a "Page N+1" button.
  // Other "Next" buttons exist on the page (carousels in the job details), so the next control
  // must come from the pagination bar whenever one is found.
  const isPageButton = (el) =>
    /^page \d+$/.test(norm(el.getAttribute("aria-label"))) ||
    (/^\d+$/.test(norm(el.textContent)) && Boolean(el.closest("ul, ol, nav, [role='navigation']")));
  const isNextControl = (el) =>
    /pagination.*next|next.*pagination/i.test(el.getAttribute("data-testid") || "") ||
    /^(view )?next( page)?$|^page next$/.test(norm(el.getAttribute("aria-label"))) ||
    /^next$/.test(norm(el.textContent));

  /** The element holding the numbered page buttons plus Previous/Next, or null. */
  function paginationBar() {
    const firstPageButton = controls().find(isPageButton);
    if (!firstPageButton) return null;
    const list = firstPageButton.closest("ul, ol, nav, [role='navigation']") || firstPageButton.parentElement;
    // Previous/Next usually sit next to the list: climb a few levels until a Next control is inside,
    // but only while the container is still just a pagination bar ("Previous 2 3 4 Next" is short).
    // On the last page there is no Next, and climbing further would reach the job list / details
    // (and their carousel "Next" buttons).
    let node = list;
    for (let i = 0; i < 3 && node.parentElement && node.parentElement !== document.body; i += 1) {
      const parent = node.parentElement;
      if (String(parent.textContent || "").replace(/\s+/g, " ").trim().length > 120) break;
      node = parent;
      if (Array.from(node.querySelectorAll("button, a, [role='button']")).some(isNextControl)) return node;
    }
    return node; // last page: no Next in the bar
  }

  // ---------------------------------------------------------------- next-page control
  // Each strategy gets { info, bar, inBar }; when a bar exists, matches outside it are ignored.
  const NEXT_STRATEGIES = [
    [
      "testid", // data-testid="pagination-controls-next-button-visible"
      ({ inBar }) => controls().find((el) => /pagination.*next|next.*pagination/i.test(el.getAttribute("data-testid") || "") && inBar(el)),
    ],
    ["bar-next", ({ bar }) => (bar ? controls().find((el) => bar.contains(el) && isNextControl(el)) : null)],
    [
      "page-number",
      ({ info, inBar }) =>
        controls().find((el) => norm(el.getAttribute("aria-label")) === `page ${info.page + 1}` && inBar(el)) ||
        controls().find((el) => norm(el.textContent) === String(info.page + 1) && isPageButton(el) && inBar(el)),
    ],
    [
      "known-classes",
      ({ inBar }) =>
        Array.from(
          document.querySelectorAll(
            [
              "button.jobs-search-pagination__button--next",
              "button[aria-label='View next page']",
              "button[aria-label='Next']",
              "button[aria-label='Page next']",
              "button.artdeco-pagination__button--next",
              ".jobs-search-pagination__button--next",
            ].join(", "),
          ),
        ).find(inBar),
    ],
    ["aria-next", ({ inBar }) => controls().find((el) => /^(view )?next( page)?\b|^page next\b/.test(norm(el.getAttribute("aria-label"))) && inBar(el))],
    ["text-next", ({ inBar }) => controls().find((el) => /^next\b/.test(norm(el.textContent)) && inBar(el))],
    ["load-more", () => controls().find((el) => /^(see|show|load) more (jobs|results)\b/.test(labelOf(el)))],
  ];

  /**
   * Finds the next-page control. Returns { chosen: { el, via } | null, results } where results
   * maps every strategy to "found" / "disabled" / "-" (for logs and the probe).
   */
  function findNext(info = currentPageInfo()) {
    const results = {};
    let chosen = null;
    const bar = paginationBar();
    const ctx = { info, bar, inBar: (el) => !bar || bar.contains(el) };
    results.bar = bar ? "found" : "-";
    for (const [name, fn] of NEXT_STRATEGIES) {
      let el = null;
      try {
        el = fn(ctx) || null;
      } catch {
        el = null;
      }
      results[name] = el ? (isDisabled(el) ? "disabled" : "found") : "-";
      if (!chosen && el && !isDisabled(el)) chosen = { el, via: name };
    }
    return { chosen, results };
  }

  /** Job ids of the first cards on the page, to detect that a new page has loaded. */
  function firstCardIds(n = 5) {
    return new Set(Dom.findJobTiles().tiles.slice(0, n).map(tileKey));
  }

  /**
   * Clicks the next control, then smart-waits for the NEW page:
   *   1. something reacts (URL changes, old cards disappear, or new cards show)
   *   2. list scrolled back to the top, so LinkedIn fills the cards from #1 (not empty placeholders)
   *   3. new cards present, no loaders, list DOM quiet (waitForCards with notIds)
   * click: optional custom click (the extension passes its human-like click).
   * Resolves { moved, ms, cards, urlChanged, reason }.
   */
  async function goNext(next, { beforeIds = firstCardIds(), timeoutMs = 15000, click, shouldStop = () => false } = {}) {
    const beforeUrl = location.href;
    const root = scrollRootOf(Dom.findJobTiles().tiles[0]);
    next.el.scrollIntoView({ block: "center" });
    await Wait.domQuiet(document.body, { quietMs: 200, timeoutMs: 800 });
    if (click) await click(next.el);
    else Dom.realClick(next.el);
    const start = Date.now();
    const left = () => Math.max(1000, timeoutMs - (Date.now() - start));

    // 1. did the click do anything? (URL is the cheap signal; card ids only if the URL stays)
    const reacted = await Wait.until(
      () => {
        if (location.href !== beforeUrl) return true;
        const ids = Dom.findJobTiles().tiles.slice(0, 5).map(tileKey);
        return !ids.length || ids.some((id) => !beforeIds.has(id));
      },
      { timeoutMs: Math.min(5000, left()), shouldStop },
    );
    scrollListToTop(root);

    // 2. wait for the new page's cards, but stop at once if LinkedIn says there are no more results
    //    (it can show Next on the real last page; the page after it is "No matching jobs found").
    const res = await waitForCards({ timeoutMs: left(), notIds: beforeIds, shouldStop: () => shouldStop() || isNoResultsPage() });
    const endOfResults = !res.ok && isNoResultsPage();
    return {
      moved: res.ok,
      endOfResults,
      ms: Date.now() - start,
      reactMs: reacted.waitedMs, // click -> first reaction
      cardsMs: res.waitedMs, // reaction -> new cards settled
      cards: res.found.tiles.length,
      urlChanged: location.href !== beforeUrl,
      reason: res.ok
        ? ""
        : endOfResults
          ? "no more results (LinkedIn shows 'no matching jobs')"
          : reacted.ok
            ? `new page did not finish loading (${res.reason})`
            : "nothing happened after the click",
      waitNote: res.ok ? res.reason : "", // which wait shortcut was taken, if any
    };
  }

  // LinkedIn's empty-results page ("No matching jobs found", "No results found", ...).
  const NO_RESULTS_RE = /\bno (matching )?jobs found\b|\bno results found\b|\bwe couldn['’]t find (a match|any jobs)\b|\bno jobs match\b/i;

  /** True when the page shows LinkedIn's "no results" message and has no job cards. */
  function isNoResultsPage() {
    const main = document.querySelector("main") || document.body;
    if (!NO_RESULTS_RE.test(String(main.innerText || ""))) return false;
    return Dom.findJobTiles().tiles.length === 0;
  }

  global.CPLinkedInPages = {
    version: 1,
    scrollRootOf,
    isNoResultsPage,
    paginationBar,
    listRoot,
    waitForCards,
    scrollListToTop,
    loadAllCards,
    currentPageInfo,
    findNext,
    firstCardIds,
    goNext,
    strategies: {
      pageInfo: PAGE_INFO_STRATEGIES.map(([n]) => n),
      next: NEXT_STRATEGIES.map(([n]) => n),
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
