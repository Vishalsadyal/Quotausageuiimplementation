/*
 * LinkedIn Jobs auto-apply - part 09: apply-button
 *
 * Clicking (resilientClick), selecting a job card in the list, finding the Apply / Easy Apply
 * button in the details pane (class selectors, then the class-free CPLinkedInDom.findApplyAction),
 * and waiting for it.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

async function resilientClick(el, name) {
  if (!el) return false;
  try {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(180);
    el.click();
    return true;
  } catch {
    try {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true, view: window }));
      return true;
    } catch {
      await logLine(`Failed to click ${name}`, "warn");
      return false;
    }
  }
}

async function selectJobCardInSearchList(card) {
  if (!card) return false;
  const rootCard = card.closest?.(".job-card-container, .jobs-search-results__list-item, li") || card;
  try {
    rootCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch {}
  await sleep(150);

  // Target the container element so LinkedIn's React SPA updates the side-detail pane in-place
  // without triggering a full browser link navigation to /jobs/view/
  const clickableTarget =
    rootCard.querySelector?.(".job-card-container--clickable") ||
    rootCard.querySelector?.(".job-card-list__entity-lockup") ||
    rootCard.querySelector?.(".artdeco-entity-lockup__content") ||
    rootCard.querySelector?.(".job-card-container") ||
    // Class-free layout: the card's title / role=button element (src/linkedin/core/dom.js).
    globalThis.CPLinkedInDom?.clickTargetsFor(rootCard)[0]?.el ||
    rootCard;

  // Prevent full page navigation if an anchor receives the click
  const anchors = Array.from(rootCard.querySelectorAll?.("a[href*='/jobs/view/']") || []);
  const preventNavHandler = (e) => {
    if (isJobsSearchPage()) {
      e.preventDefault();
    }
  };

  anchors.forEach((a) => {
    a.addEventListener("click", preventNavHandler, { capture: true, once: true });
  });

  try {
    const target = clickableTarget;
    // Full pointer sequence with real coordinates (some handlers ignore coordinate-less events).
    if (globalThis.CPLinkedInDom?.realClick) {
      globalThis.CPLinkedInDom.realClick(target);
      return true;
    }
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, composed: true, view: window }));
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, composed: true, view: window }));
    target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, composed: true, view: window }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, composed: true, view: window }));
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true, view: window }));
    return true;
  } catch {
    try {
      clickableTarget.click();
      return true;
    } catch {
      return false;
    }
  } finally {
    setTimeout(() => {
      anchors.forEach((a) => {
        a.removeEventListener("click", preventNavHandler, { capture: true });
      });
    }, 1000);
  }
}



function getApplyButtonFromDetailPane() {
  // Scope strictly to job detail/top-card areas to avoid matching filter pills.
  const detailRoots = getAllBySelectorList([
    ".jobs-search__job-details",
    ".jobs-details",
    ".jobs-unified-top-card",
    ".jobs-details-top-card",
    ".scaffold-layout__detail"
  ]);
  if (!detailRoots.length) {
    // Class-free layout: the old selectors below would search the WHOLE page (and once matched this
    // extension's own "AutoApply CV Copilot" button as an external Apply). Use the details-pane finder.
    const generic = globalThis.CPLinkedInDom?.findApplyAction?.();
    if (generic && generic.type !== "none") return generic;
    return { type: "none", button: null };
  }
  const roots = detailRoots;

  const candidates = [];
  for (const root of roots) {
    const localButtons = Array.from(
      root.querySelectorAll(
        "button.jobs-apply-button, .jobs-s-apply button, button[aria-label*='Apply'], button[data-control-name*='jobdetails_topcard']"
      )
    );
    candidates.push(...localButtons);
  }

  const enabled = candidates.filter((b) => {
    if (!b || b.disabled) return false;
    // Ignore job search filter buttons and pill controls.
    if (b.closest(".jobs-search-box__filters-bar, .search-reusables__filters-bar, .jobs-search-box__filter-item")) return false;
    if (b.closest("[id^='cp-']")) return false; // this extension's own panel / toggle
    const cls = normalizeLabel(b.className || "");
    const aria = normalizeLabel(b.getAttribute("aria-label") || "");
    const txt = normalizeLabel(b.textContent || "");
    if (cls.includes("filter") || aria.includes("filter")) return false;
    if (txt === "easy apply" && cls.includes("filter")) return false;
    return true;
  });

  const easyApply = enabled.find((b) => {
    const txt = `${normalizeLabel(b.getAttribute("aria-label") || "")} ${normalizeLabel(b.textContent || "")}`;
    return txt.includes("easy apply");
  });
  if (easyApply) return { type: "easy", button: easyApply };

  const externalApply = enabled.find((b) => {
    const txt = `${normalizeLabel(b.getAttribute("aria-label") || "")} ${normalizeLabel(b.textContent || "")}`;
    if (!/(^|[^a-z])apply(ing)?([^a-z]|$)/.test(txt)) return false;
    if (txt.includes("easy apply")) return false;
    return true;
  });
  if (externalApply) return { type: "external", button: externalApply };

  // Class-free fallback: LinkedIn's newer layouts render Apply as a link or role=button inside
  // obfuscated containers, which the selectors above miss.
  const generic = globalThis.CPLinkedInDom?.findApplyAction?.();
  if (generic && generic.type !== "none") return generic;
  return { type: "none", button: null };
}

function isDetailPaneStillLoading() {
  const detailRoot =
    getBySelectorList([
      ".jobs-search__job-details",
      ".jobs-details",
      ".jobs-unified-top-card",
      ".jobs-details-top-card",
      ".scaffold-layout__detail"
    ]) || globalThis.CPLinkedInDom?.findDetailPane?.().element;
  if (!detailRoot) return false;
  if (detailRoot.matches?.("[aria-busy='true']")) return true;

  const loadingSelectors = [
    "[aria-busy='true']",
    ".artdeco-loader",
    ".artdeco-loader__bar",
    "[class*='skeleton']",
    "[class*='loading']",
    "[data-test-loading]"
  ];
  for (const selector of loadingSelectors) {
    const matches = safeQuerySelectorAll(detailRoot, selector, null, "detail pane loading check");
    if (matches.some((node) => isVisibleElement(node))) return true;
  }
  return false;
}

function shouldUseConservativeExternalApplyWait() {
  const href = String(window.location.href || "");
  return isJobsViewPage() || /[?&]eBP=|[?&]trk=|[?&]refId=|[?&]trackingId=/i.test(href);
}

async function waitForApplyButtonFromDetailPane(settings, timeoutMs = 7000, context = "detail pane") {
  const timeout = Math.max(1000, Number(timeoutMs || 7000));
  const start = Date.now();
  let deadline = start + timeout;
  let polls = 0;
  let extendedForLoading = false;
  let extendedForExternal = false;
  let extendedForConservativeExternal = false;
  let firstExternalSeenAt = 0;
  let lastExternalAction = null;
  const conservativeExternalWait = shouldUseConservativeExternalApplyWait();
  const minimumDecisionMs = conservativeExternalWait ? 3600 : 1400;
  const stableExternalMs = conservativeExternalWait ? 2600 : 1200;
  while (Date.now() < deadline) {
    polls += 1;
    const action = getApplyButtonFromDetailPane();
    const detailLoading = isDetailPaneStillLoading();
    if (action.type === "easy" && action.button) {
      if (polls > 1) {
        await debugLog(settings, "Apply button appeared after wait", {
          context,
          polls,
          elapsedMs: Date.now() - start,
          type: action.type
        });
      }
      return action;
    }

    if (action.type === "external" && action.button) {
      lastExternalAction = action;
      if (!firstExternalSeenAt) firstExternalSeenAt = Date.now();
      const externalVisibleForMs = Date.now() - firstExternalSeenAt;
      if (!detailLoading && Date.now() - start >= minimumDecisionMs && externalVisibleForMs >= stableExternalMs) {
        await debugLog(settings, "External apply button confirmed after settle wait", {
          context,
          polls,
          elapsedMs: Date.now() - start,
          externalVisibleForMs,
          conservativeExternalWait
        });
        return action;
      }
    } else if (action.type === "none") {
      firstExternalSeenAt = 0;
    }

    if (polls % 5 === 0) {
      const detailRoot = getBySelectorList([
        ".jobs-search__job-details",
        ".jobs-details",
        ".jobs-unified-top-card",
        ".jobs-details-top-card",
        ".scaffold-layout__detail"
      ]);
      if (detailRoot && typeof detailRoot.scrollBy === "function") {
        detailRoot.scrollBy({ top: 120, behavior: "smooth" });
      }
    }

    if (Date.now() + 220 >= deadline) {
      if (!extendedForLoading && detailLoading) {
        extendedForLoading = true;
        deadline += 2200;
        await debugLog(settings, "Extending apply button wait because detail pane is still loading", {
          context,
          polls,
          elapsedMs: Date.now() - start
        });
      } else if (!extendedForExternal && lastExternalAction?.button) {
        extendedForExternal = true;
        deadline += 1500;
        await debugLog(settings, "Extending apply button wait to confirm external apply state", {
          context,
          polls,
          elapsedMs: Date.now() - start
        });
      } else if (!extendedForConservativeExternal && conservativeExternalWait && lastExternalAction?.button) {
        extendedForConservativeExternal = true;
        deadline += 2200;
        await debugLog(settings, "Extending apply button wait because jobs view may still promote Easy Apply", {
          context,
          polls,
          elapsedMs: Date.now() - start
        });
      }
    }
    await sleep(220);
  }
  if (conservativeExternalWait && lastExternalAction?.button) {
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // ignore scroll failures
    }
    await sleep(900);
    const finalAction = getApplyButtonFromDetailPane();
    if (finalAction.type === "easy" && finalAction.button) {
      await debugLog(settings, "Easy Apply appeared after conservative external wait", {
        context,
        polls,
        elapsedMs: Date.now() - start
      });
      return finalAction;
    }
  }
  if (lastExternalAction?.button) {
    await debugLog(settings, "Returning external apply after full wait window", {
      context,
      polls,
      elapsedMs: Date.now() - start,
      conservativeExternalWait
    });
    return lastExternalAction;
  }
  await debugLog(settings, "Apply button wait timed out", {
    context,
    elapsedMs: Date.now() - start,
    detailRoots: document.querySelectorAll(".jobs-search__job-details, .jobs-details, .jobs-unified-top-card, .jobs-details-top-card, .scaffold-layout__detail").length,
    applyButtonsVisible: document.querySelectorAll("button.jobs-apply-button, .jobs-s-apply button").length
  });
  return { type: "none", button: null };
}
