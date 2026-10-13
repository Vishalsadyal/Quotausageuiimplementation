/*
 * LinkedIn Jobs auto-apply - part 11: card-tags
 *
 * Highlights the active card and draws APPLIED / ALREADY APPLIED / SKIPPED tags on cards; a light
 * MutationObserver repaints tags when LinkedIn re-renders the list.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

function clearActiveJobCardHighlights() {
  try {
    const highlighted = document.querySelectorAll(".cp-active-eval-card");
    for (const el of highlighted) {
      el.classList.remove("cp-active-eval-card");
      const existingBadge = el.querySelector(".cp-card-live-badge");
      if (existingBadge) existingBadge.remove();
    }
  } catch {
    // ignore
  }
}

function highlightActiveJobCard(card, badgeText = "AI Evaluating...") {
  try {
    const container = getCardElementContainer(card);
    if (!container) return;

    clearActiveJobCardHighlights();
    container.classList.add("cp-active-eval-card");

    try {
      container.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    } catch {
      // ignore
    }

    let badge = container.querySelector(".cp-card-live-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "cp-card-live-badge";
      container.appendChild(badge);
    }
    badge.innerHTML = `<span class="cp-badge-pulse"></span><span>${escapeHtml(badgeText)}</span>`;
  } catch {
    // ignore
  }
}

function formatFriendlySkipReason(label) {
  const norm = normalizeLabel(label);
  if (!norm) return "Filtered";
  if (norm.includes("already applied") || norm.includes("applied_cache_hit")) return "Already Applied";
  if (norm.includes("keyword") || norm.includes("mismatch")) return "Keyword Mismatch";
  if (norm.includes("experience") || norm.includes("years") || norm.includes("too_high")) return "Experience > Allowed";
  if (norm.includes("blacklisted") || norm.includes("company")) return "Company Blocked";
  if (norm.includes("bad_word") || norm.includes("excluded word")) return "Title Blocked";
  if (norm.includes("external")) return "External Apply";
  if (norm.includes("modal_not_found") || norm.includes("no easy apply")) return "No Easy Apply";
  if (norm.includes("resume")) return "Resume Required";
  if (norm.includes("phone")) return "Phone Validation";
  if (norm.includes("input") || norm.includes("selection") || norm.includes("pending_user_input")) return "Custom Input Required";
  return label.length > 25 ? `${label.slice(0, 22)}...` : label;
}

function markJobCardStatus(card, status = "applied", label = "", options = {}) {
  try {
    const container = getCardElementContainer(card);
    if (!container) return;

    container.classList.remove("cp-active-eval-card");
    const liveBadge = container.querySelector(".cp-card-live-badge");
    if (liveBadge) liveBadge.remove();

    // Remove any previous outcome tag on this card
    const existingTag = container.querySelector(".cp-card-outcome-tag");
    if (existingTag) existingTag.remove();

    const tag = document.createElement("div");
    tag.className = `cp-card-outcome-tag ${status === "applied" ? "cp-tag-applied" : "cp-tag-skipped"}`;

    if (status === "applied") {
      container.classList.add("cp-card-completed-applied");
      tag.innerHTML = `<span>✅</span><span>APPLIED</span>`;
    } else if (formatFriendlySkipReason(label) === "Already Applied") {
      container.classList.add("cp-card-completed-applied");
      tag.className = "cp-card-outcome-tag cp-tag-applied";
      tag.innerHTML = `<span>✅</span><span>ALREADY APPLIED</span>`;
    } else {
      container.classList.add("cp-card-completed-skipped");
      const reasonText = formatFriendlySkipReason(label);
      tag.innerHTML = `<span>⏭️</span><span>SKIPPED: ${escapeHtml(reasonText)}</span>`;
    }

    // Inject into the title/entity area of the card
    const targetArea =
      container.querySelector(".artdeco-entity-lockup__content") ||
      container.querySelector(".job-card-list__entity-lockup") ||
      container.querySelector(".job-card-container__primary-description")?.parentElement ||
      getCardAnchor(container)?.parentElement ||
      container;
    targetArea.appendChild(tag);

    // Remember the outcome so the tag can be redrawn when LinkedIn re-renders the list.
    const key = getJobKeyFromCard(container) || getJobKeyFromCard(card);
    if (key && !options.fromRepaint) {
      cardStatusByJobKey.set(key, { status, label });
      paintCheckedCards = new WeakSet();
    }
  } catch {
    // ignore
  }
}

// Job key → last outcome tag shown on its card during this page session.
const cardStatusByJobKey = new Map();

// Cards already checked with nothing to paint; reset whenever what we know changes.
let paintCheckedCards = new WeakSet();
let paintKnownAppliedSize = -1;

/** Tags every visible card that we already know about; safe to call repeatedly. */
function paintJobCardStatuses() {
  if (!isJobsSearchPage()) return;
  if (knownAppliedJobIds.size !== paintKnownAppliedSize) {
    paintKnownAppliedSize = knownAppliedJobIds.size;
    paintCheckedCards = new WeakSet();
  }
  for (const card of collectJobCards({ passive: true })) {
    const container = getCardElementContainer(card);
    if (!container || paintCheckedCards.has(container)) continue;
    if (container.querySelector(".cp-card-outcome-tag, .cp-card-live-badge")) continue;
    const key = getJobKeyFromCard(card);
    const known = key ? cardStatusByJobKey.get(key) : null;
    if (known) {
      markJobCardStatus(card, known.status, known.label, { fromRepaint: true });
    } else if ((key && knownAppliedJobIds.has(key)) || isAlreadyAppliedCard(card)) {
      markJobCardStatus(card, "skipped", "Already Applied", { fromRepaint: true });
    } else {
      paintCheckedCards.add(container);
    }
  }
}

let cardPaintObserver = null;
let cardPaintTimer = 0;
const OWN_UI_SELECTOR =
  "[id^='cp-'], .cp-card-outcome-tag, .cp-card-live-badge, #li-wa-widget, #li-email-widget, #li-autocommenter-widget, #jso-panel, .cp-probe-label";

/** True when a mutation record is LinkedIn adding content (not our own panel, tags or widgets). */
function isForeignAddition(record) {
  const target = record.target;
  if (target?.nodeType === 1 && target.closest(OWN_UI_SELECTOR)) return false;
  for (const node of record.addedNodes) {
    if (node.nodeType === 1 && !node.matches(OWN_UI_SELECTOR)) return true;
  }
  return false;
}

function schedulePaint(delay = 1200) {
  if (cardPaintTimer) return;
  cardPaintTimer = window.setTimeout(() => {
    const run = () => {
      cardPaintTimer = 0;
      if (document.hidden || !isExtensionContextValid()) return;
      try {
        paintJobCardStatuses();
      } catch {
        // ignore paint failures
      }
    };
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(run, { timeout: 2000 });
    else run();
  }, delay);
}

/**
 * LinkedIn virtualizes the results list and drops our tags; repaint them after DOM changes.
 * Kept light: ignores our own UI changes, waits for idle time, pauses while the tab is hidden,
 * and uses the cached tile list instead of re-running full detection.
 */
function startCardPaintObserver() {
  if (cardPaintObserver || !document.body) return;
  cardPaintObserver = new MutationObserver((records) => {
    if (cardPaintTimer || document.hidden || !isJobsSearchPage()) return;
    if (!records.some(isForeignAddition)) return;
    schedulePaint();
  });
  cardPaintObserver.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) schedulePaint(300);
  });
  schedulePaint(300);
}

function highlightDetailPane(jobTitle = "") {
  try {
    const pane =
      document.querySelector(".jobs-search__job-details") ||
      document.querySelector(".jobs-details") ||
      document.querySelector(".job-details-jobs-unified-top-card") ||
      document.querySelector(".scaffold-layout__detail");
    if (!pane) return;

    let indicator = pane.querySelector(".cp-detail-live-indicator");
    if (!indicator) {
      indicator = document.createElement("div");
      indicator.className = "cp-detail-live-indicator";
      pane.prepend(indicator);
    }
    indicator.innerHTML = `<span style="color:#6366f1;">✨</span><span><strong>AutoApply CV Copilot</strong> is analyzing: <em>${escapeHtml(jobTitle || "Current Opportunity")}</em></span>`;
  } catch {
    // ignore
  }
}
