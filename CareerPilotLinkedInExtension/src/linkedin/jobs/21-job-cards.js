/*
 * LinkedIn Jobs auto-apply - part 21: job-cards
 *
 * Job cards on the results page: collectJobCards (CPLinkedInDom chain + legacy fallback), Easy
 * Apply signal, waiting for cards, list scroll container, loading all cards, dismissing a card.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

const JOB_CARD_SELECTORS = [
  ".job-card-container",
  "[data-occludable-job-id]",
  "li.jobs-search-results__list-item",
  ".jobs-search-results-list__list-item",
  "li.scaffold-layout__list-item",
  "[data-job-id]",
  "[data-view-name='job-card']",
  "[data-view-name*='job-search-card']"
];

/** Climbs from a job link to the largest ancestor that still holds only this one job. */
function cardRootFromJobAnchor(anchor) {
  const jobId = extractLinkedInJobIdFromUrl(anchor?.href || "");
  let node = anchor;
  let best = anchor.closest("li") || anchor.parentElement;
  while (node?.parentElement && node.parentElement !== document.body) {
    const parent = node.parentElement;
    // Never grow past page chrome or into something far bigger than a job tile.
    if (parent.matches("main, header, nav, [role='main']") || parent.querySelector("header, nav")) break;
    if (String(parent.innerText || "").length > 1500) break;
    const ids = new Set(
      Array.from(parent.querySelectorAll("a[href*='/jobs/view/'], a[href*='currentJobId=']"))
        .map((a) => extractLinkedInJobIdFromUrl(a.href))
        .filter(Boolean)
    );
    if (ids.size > 1 || (jobId && ids.size === 1 && !ids.has(jobId))) break;
    best = parent;
    node = parent;
  }
  return best;
}

let lastJobCardStrategy = "";

function collectJobCards({ passive = false } = {}) {
  // Preferred: the shared fallback chain in linkedin-dom.js (known classes → data attributes →
  // job-id attributes → job links → repeated list structure → tile words).
  // passive: background repaint, skips the expensive full-page fallbacks.
  const Dom = globalThis.CPLinkedInDom;
  if (Dom) {
    const found = Dom.findJobTiles({ passive });
    if (passive && !found.tiles.length) return [];
    lastJobCardStrategy = found.strategy;
    return found.tiles;
  }

  // Strategy 1: known card selectors (outermost match only, so nested matches don't double count).
  const detailRootSelector = JOB_DETAIL_ROOT_SELECTORS.join(", ");
  const directCards = getAllBySelectorList(JOB_CARD_SELECTORS).filter((card) => !card.closest(detailRootSelector));
  if (directCards.length) {
    const outermost = directCards.filter(
      (card) => !directCards.some((other) => other !== card && other.contains(card))
    );
    lastJobCardStrategy = "selectors";
    return outermost;
  }

  // Strategy 2: walk up from job links (works when LinkedIn obfuscates class names).
  const anchors = Array.from(
    document.querySelectorAll("a[href*='/jobs/view/'], a[href*='currentJobId=']")
  ).filter((a) => !a.closest(detailRootSelector));
  // Links to a single job are the open job's own links, not a results list.
  const distinctIds = new Set(anchors.map((a) => extractLinkedInJobIdFromUrl(a.href)).filter(Boolean));
  if (distinctIds.size < 2) {
    lastJobCardStrategy = "none";
    return [];
  }
  const cardSet = new Set();
  for (const a of anchors) {
    const card = cardRootFromJobAnchor(a);
    if (card) cardSet.add(card);
  }
  lastJobCardStrategy = cardSet.size ? "anchor-walk" : "none";
  return Array.from(cardSet);
}

function hasEasyApplySignalOnCard(card) {
  if (!card) return false;
  // Ignore text this extension added itself ("SKIPPED: No Easy Apply" tags, live badges): it would
  // make a card without the LinkedIn badge look like an Easy Apply card on the next scan.
  let cardText = String(card.textContent || "");
  for (const injected of card.querySelectorAll?.(".cp-card-outcome-tag, .cp-card-live-badge, .cp-probe-label") || []) {
    cardText = cardText.replace(String(injected.textContent || ""), " ");
  }
  const quickText = normalizeLabel(cardText);
  if (quickText.includes("easy apply")) return true;

  const explicitSignal = getBySelectorList(
    [
      ".job-card-container__apply-method",
      ".job-card-list__apply-method",
      "[data-test-job-card-easy-apply]",
      "[aria-label*='Easy Apply']",
      "[aria-label*='easy apply']",
    ],
    card,
  );
  if (explicitSignal) return true;

  const buttonSignal = Array.from(card.querySelectorAll("button, a, span"))
    .filter((el) => !el.closest(".cp-card-outcome-tag, .cp-card-live-badge, .cp-probe-label"))
    .slice(0, 40)
    .some((el) => normalizeLabel(`${el.getAttribute?.("aria-label") || ""} ${el.textContent || ""}`).includes("easy apply"));
  return buttonSignal;
}

function getCardAnchor(card) {
  return getBySelectorList(
    [
      "a[href*='/jobs/view/']",
      "a.job-card-container__link",
      "a.job-card-list__title--link",
      "a[data-control-name*='job_card']",
      "a"
    ],
    card
  );
}

async function waitForJobsToRender(settings, timeoutMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const cards = collectJobCards();
    if (cards.length) return cards;
    await sleep(250);
  }
  await debugLog(settings, "Job list render timeout", { timeoutMs, url: window.location.href });
  return [];
}

function getJobListScrollContainer() {
  const sentinel = document.querySelector("[data-results-list-top-scroll-sentinel]");
  const ul = document.querySelector("ul:has(li.scaffold-layout__list-item)") || document.querySelector("ul:has([data-occludable-job-id])") || document.querySelector("ul:has(.job-card-container)");
  const target = sentinel || ul;
  if (target) {
    let parent = target.parentElement;
    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      if (/(auto|scroll)/.test(style.overflowY || "") || parent.classList.contains("scaffold-layout__list") || parent.classList.contains("jobs-search-results-list")) {
        return parent;
      }
      parent = parent.parentElement;
    }
  }
  return (
    document.querySelector(".scaffold-layout__list") ||
    document.querySelector(".jobs-search-results-list") ||
    document.querySelector(".scaffold-layout__list-detail-inner") ||
    document.querySelector(".scaffold-layout__list-container") ||
    document.scrollingElement ||
    document.body
  );
}

async function loadAllJobCardsOnPage(settings) {
  let cards = collectJobCards();
  if (!cards.length) {
    cards = await waitForJobsToRender(settings, 7000);
  }
  if (!cards.length) return [];

  // Scroll the list until LinkedIn stops lazy-loading cards (src/linkedin/core/pages.js).
  await globalThis.CPLinkedInPages.loadAllCards({ settleMs: 800, timeoutMs: 12000 });
  const scrollRoot = getJobListScrollContainer() || globalThis.CPLinkedInPages.scrollRootOf(cards[0]);

  // Scroll back to top so processing starts cleanly from card #1
  if (scrollRoot && typeof scrollRoot.scrollTo === "function") {
    scrollRoot.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  await sleep(350);

  return collectJobCards();
}

async function dismissJobCard(card) {
  if (!card || !(card instanceof HTMLElement)) return false;
  try {
    const dismissBtn = getBySelectorList([
      "button[aria-label*='Dismiss']",
      "button[aria-label*='dismiss']",
      "button.job-card-container__action",
      ".job-card-list__actions-container button",
      "button[data-test-icon='close-small']",
      "button:has(svg[data-test-icon='close-small'])",
      "button:has(use[href*='close'])",
      "button[data-control-name*='dismiss']"
    ], card);

    if (dismissBtn && isVisibleElement(dismissBtn) && !dismissBtn.disabled) {
      await resilientClick(dismissBtn, "Dismiss job card (X)");
      await sleep(250);
      return true;
    }
  } catch {
    // best-effort dismiss
  }
  return false;
}
