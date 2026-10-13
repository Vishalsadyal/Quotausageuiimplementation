/*
 * LinkedIn Jobs auto-apply - part 16: search-nav
 *
 * Search term rotation, next results page (CPLinkedInPages: load all cards, page number, next
 * control, URL fallback), and the LinkedIn location input.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

async function ensureSearchTermIfNeeded(settings) {
  if (!isJobsSearchPage()) return true;
  const terms = getConfiguredSearchTerms(settings);
  if (!terms.length) return true;

  const currentKeyword = getCurrentSearchKeyword();
  const currentNorm = normalizeLabel(currentKeyword);

  // If current page keyword matches any of the configured terms/synonyms, align cursor and do not reload
  if (currentNorm) {
    const matchingIndex = terms.findIndex((t) => normalizeLabel(t) === currentNorm);
    if (matchingIndex >= 0) {
      runSearchTermCursor = matchingIndex;
      return true;
    }
    // If user didn't specify explicit searchTerms in settings, accept whatever LinkedIn has
    const userTerms = parseListSetting(settings?.searchTerms);
    if (!userTerms.length) {
      return true;
    }
  }

  if (runSearchTermCursor < 0 || runSearchTermCursor >= terms.length) {
    runSearchTermCursor = 0;
  }
  const selected = terms[runSearchTermCursor];
  if (currentNorm === normalizeLabel(selected)) return true;

  const target = getActiveRunSearchUrl(settings);
  if (wasRecentlyRedirectedTo(target)) {
    captureDebugEvent("search", "SEARCH_TERM_REDIRECT_LOOP_PREVENTED", { selected, currentKeyword, target });
    return true;
  }
  noteSearchRedirect(target);

  await logLine(`Switching search term: ${selected}`);
  resetRemoteLocationKeywordCursor();
  window.location.href = target;
  return false;
}

async function rotateSearchTerm(settings) {
  const terms = getConfiguredSearchTerms(settings);
  if (terms.length <= 1) return false;
  const prevCursor = runSearchTermCursor;
  runSearchTermCursor = (runSearchTermCursor + 1) % terms.length;
  runSearchTermSuccessCount = 0;
  resetRemoteLocationKeywordCursor();
  const nextTerm = terms[runSearchTermCursor];
  noteSearchRedirect(getActiveRunSearchUrl(settings));
  captureDebugEvent("search", "TERM_ROTATED", { from: terms[prevCursor], to: nextTerm, cursor: runSearchTermCursor, totalTerms: terms.length });
  await logLine(`Switching to alternative keyword: "${nextTerm}"`, "info");
  await botChat(`Switching search to related keyword: "${nextTerm}"...`);
  window.location.href = getActiveRunSearchUrl(settings);
  return true;
}

function buildNextPageUrlByStart(settings, currentUrl, step = 25) {
  try {
    const url = buildCanonicalSearchUrl(settings, {
      baseUrl: currentUrl || window.location.href,
      preserveStart: true
    });
    const currentStartRaw = String(url.searchParams.get("start") || "0").trim();
    const currentStart = Number.isFinite(Number(currentStartRaw)) ? Number(currentStartRaw) : 0;
    const nextStart = Math.max(0, currentStart + Math.max(1, Number(step || 25)));
    url.searchParams.set("start", String(nextStart));
    writeStoredSearchResultsUrl(url.toString());
    return url.toString();
  } catch {
    return "";
  }
}

// Goes to the next results page. Detection lives in src/linkedin/core/pages.js (CPLinkedInPages),
// the same code tools/probes/out/1-pages-probe.js tests. Returns true when a new page is loading.
async function gotoNextResultsPage(settings) {
  const currentKeyword = getCurrentSearchKeyword() || "current search";
  const Pages = globalThis.CPLinkedInPages;

  // Load every card first: the pagination bar only renders at the bottom of the list.
  await Pages.loadAllCards({ settleMs: 800, timeoutMs: 12000 });

  const info = Pages.currentPageInfo();
  if (info.total > 0 && info.page >= info.total) {
    await debugLog(settings, `Reached last page (${info.page}/${info.total}) for keyword "${currentKeyword}"`);
    return false;
  }

  const { chosen, results } = Pages.findNext(info);
  if (!chosen) {
    await debugLog(settings, "No enabled next-page control; all pages done for keyword", { keyword: currentKeyword, page: info, strategies: results });
    return false;
  }

  const nextPageNum = info.page + 1;
  const ofTotal = info.total ? ` of ${info.total}` : "";
  await logLine(`📄 Finished page ${info.page}. Loading page ${nextPageNum}${ofTotal} for "${currentKeyword}"...`, "info");
  await botChat(`Loading page ${nextPageNum}${ofTotal} for "${currentKeyword}"...`);
  await debugLog(settings, "Next page control", { via: chosen.via, page: info, strategies: results });

  const moved = await Pages.goNext(chosen, { click: (el) => resilientClick(el, "Next page") });
  if (moved.endOfResults) {
    await debugLog(settings, "Next page shows no results: all pages done for keyword", { keyword: currentKeyword, page: info });
    return false;
  }
  if (moved.moved) {
    await loadAllJobCardsOnPage(settings);
    return true;
  }

  // Click did not change the cards: fall back to the URL (start=+25).
  const fallbackNextUrl = buildNextPageUrlByStart(settings, window.location.href, 25);
  if (fallbackNextUrl && fallbackNextUrl !== window.location.href) {
    await logLine(`📄 Loading next page of jobs for "${currentKeyword}"...`, "info");
    window.location.href = fallbackNextUrl;
    return true;
  }
  return false;
}

async function setSearchLocationIfNeeded(settings, locationOverride = "") {
  const location = getEffectiveSearchLocation(settings, locationOverride);
  await debugLog(settings, "Search location decision", buildSearchLocationDecisionMeta(settings, locationOverride, location));
  if (!location) return;
  if (!locationOverride) {
    try {
      const currentUrl = new URL(window.location.href);
      if (hasSearchLocationQueryParams(currentUrl) && !shouldClearStaleLocationQueryParams(settings, currentUrl)) {
        await debugLog(settings, "Search location already represented in URL", { location, url: currentUrl.toString() });
        return;
      }
    } catch {
      // ignore URL parsing issues and fall through to input-based location setting
    }
  }
  const input = getJobsSearchLocationInput();
  if (!input) {
    await debugLog(settings, "Search location input not found", { url: window.location.href });
    return;
  }
  if (normalizeLabel(input.value || "") === normalizeLabel(location)) {
    await debugLog(settings, "Search location already set", { location, url: window.location.href });
    return;
  }
  await debugLog(settings, "Setting search location input", {
    before: String(input.value || ""),
    next: location,
    url: window.location.href
  });
  input.focus();
  input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  input.value = location;
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  captureDebugEvent("search", "SEARCH_LOCATION_SET", { location });
  await logLine(`Search location set: ${location}`);
  await botChat(`Location locked: ${location}. Scanning relevant jobs...`);
  await sleep(800);
}

function getJobsSearchLocationInput(root = document) {
  // LinkedIn renders multiple inputs with the same class; avoid selecting the keywords input by mistake.
  const byLabel = getBySelectorList(
    ["input[aria-label*='City, state, or zip code']", "input[placeholder*='City, state, or zip code']"],
    root
  );
  if (byLabel) return byLabel;

  const candidates = Array.from(root.querySelectorAll("input.jobs-search-box__text-input"));
  const locationLike = candidates.find((el) => {
    const aria = String(el.getAttribute("aria-label") || "");
    const placeholder = String(el.getAttribute("placeholder") || "");
    const combined = normalizeLabel(`${aria} ${placeholder}`);
    return combined.includes("city") || combined.includes("state") || combined.includes("zip") || combined.includes("location");
  });
  if (locationLike) return locationLike;

  // Heuristic: when there are 2 search inputs, LinkedIn typically renders keywords first, location second.
  if (candidates.length === 2) return candidates[1];
  return null;
}

async function clearLinkedInSearchLocationInput(settings) {
  const input = getJobsSearchLocationInput();
  if (!input) {
    await debugLog(settings, "Search location input not found for clearing", { url: window.location.href });
    return false;
  }
  const before = String(input.value || "").trim();

  // LinkedIn sometimes renders the selected location as a pill/token with an "X" button,
  // while the actual input value can be empty. Try to remove any token first.
  const container =
    input.closest(".jobs-search-box__text-input")?.parentElement ||
    input.closest(".jobs-search-box__inner") ||
    input.closest("form") ||
    input.parentElement;
  const clearBtn = container
    ? getBySelectorList(
        [
          "button[aria-label*='Clear location']",
          "button[aria-label*='Clear']",
          "button[aria-label*='Remove']",
          "button[aria-label*='Dismiss']"
        ],
        container
      )
    : null;
  if (clearBtn) {
    const clicked = await resilientClick(clearBtn, "Clear location token");
    if (clicked) {
      await logLine("Cleared LinkedIn search location token/button", "info");
      await sleep(500);
    }
  }

  // If we still have a visible value, clear the text input.
  const afterToken = String(input.value || "").trim();
  if (!before && !afterToken && !clearBtn) {
    await debugLog(settings, "Search location input already empty", { url: window.location.href });
    return false;
  }
  input.focus();
  input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  // As a fallback, backspace a few times to remove any remaining tokenized value.
  for (let i = 0; i < 5; i += 1) {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "Backspace", bubbles: true }));
  }
  await logLine("Cleared LinkedIn search location input", "info", { before });
  await sleep(800);
  return true;
}

async function rotateRemoteLocationKeyword(settings) {
  if (!shouldUseRemoteLocationKeywords(settings)) return false;
  const pool = getRemoteLocationKeywordPool(settings);
  if (pool.length <= 1) return false;
  if (runRemoteLocationKeywordCursor >= pool.length - 1) return false;
  runRemoteLocationKeywordCursor += 1;
  const nextKeyword = pool[runRemoteLocationKeywordCursor] || "";
  if (!nextKeyword) return false;
  await logLine(`No jobs. Trying remote location keyword: ${nextKeyword}.`, "info");
  await botChat("No results found. Adjusting search strategy...");
  await setSearchLocationIfNeeded(settings, nextKeyword);
  return true;
}
