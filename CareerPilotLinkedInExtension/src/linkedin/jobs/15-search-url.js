/*
 * LinkedIn Jobs auto-apply - part 15: search-url
 *
 * Search terms and location decisions, building/normalising LinkedIn search URLs (keywords, date
 * posted, sort, work mode), stored last-search URL, and the redirect-loop guard.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

function getConfiguredSearchTerms(settings) {
  const userTerms = parseListSetting(settings?.searchTerms);
  const activeKeyword = getCurrentSearchKeyword();
  const baseTerm = userTerms.length > 0 ? userTerms[0] : activeKeyword;
  if (!baseTerm) return userTerms;

  const alternatives = getAlternativeKeywordsForTerm(baseTerm);
  const combined = new Set([...userTerms, ...alternatives]);
  return Array.from(combined);
}

function getSwitchNumber(settings) {
  return Math.max(1, Number(settings.switchNumber || 1));
}

function getCurrentSearchKeyword() {
  try {
    const url = new URL(window.location.href);
    return String(url.searchParams.get("keywords") || "").trim();
  } catch {
    return "";
  }
}

const SEARCH_LOCATION_QUERY_PARAM_KEYS = ["geoId", "locationId", "locationUrn", "geoUrn", "f_PP"];

function isRemoteLikeSearchValue(value) {
  const normalized = normalizeLabel(value);
  return (
    normalized === "remote" ||
    normalized === "work from home" ||
    normalized === "wfh" ||
    normalized === "anywhere" ||
    normalized === "worldwide"
  );
}

function isRemoteModeSelected(settings) {
  return parseListSetting(settings?.onSite).some((value) => normalizeLabel(value) === "remote");
}

function clearSearchLocationQueryParams(url) {
  for (const key of SEARCH_LOCATION_QUERY_PARAM_KEYS) {
    url.searchParams.delete(key);
  }
}

function resetRemoteLocationKeywordCursor() {
  runRemoteLocationKeywordCursor = 0;
}

function getRemoteLocationKeywordPool(settings) {
  const deduped = new Set();
  const merged = [
    String(settings?.searchLocation || "").trim(),
    ...parseListSetting(settings?.filterLocations).filter((value) => isRemoteLikeSearchValue(value)),
    ...REMOTE_LOCATION_KEYWORDS,
  ];
  const values = [];
  for (const rawValue of merged) {
    const value = String(rawValue || "").trim();
    if (!value || !isRemoteLikeSearchValue(value)) continue;
    const normalized = normalizeLabel(value);
    if (!normalized || deduped.has(normalized)) continue;
    deduped.add(normalized);
    values.push(value);
  }
  return values;
}

function shouldUseRemoteLocationKeywords(settings) {
  if (!isRemoteModeSelected(settings)) return false;
  const searchLocation = String(settings?.searchLocation || "").trim();
  const filterLocations = parseListSetting(settings?.filterLocations);
  if (searchLocation && !isRemoteLikeSearchValue(searchLocation)) return false;
  return filterLocations.every((value) => !value || isRemoteLikeSearchValue(value));
}

function getEffectiveSearchLocation(settings, locationOverride = "") {
  const override = String(locationOverride || "").trim();
  if (override) return override;
  const explicitSearchLocation = String(settings?.searchLocation || "").trim();
  // Treat remote-like values as "do not set location input".
  // LinkedIn already has an explicit Remote workplace filter; typing "remote" into the location box
  // creates confusing searches (e.g. "remote" location tokens) and can keep results pinned to a region.
  if (isRemoteLikeSearchValue(explicitSearchLocation)) return "";
  if (shouldUseRemoteLocationKeywords(settings)) {
    // When remote mode is already selected, repeatedly typing "remote" back into
    // LinkedIn's location field causes avoidable reloads and search resets.
    return isRemoteLikeSearchValue(explicitSearchLocation) ? "" : explicitSearchLocation;
  }
  // Fall back to first non-remote filterLocations value when searchLocation is empty,
  // so Preferred Locations (e.g. "Mohali") are used as the LinkedIn search location.
  // Skip this when remote mode is active — typing a city into the location field
  // while f_WT=2 (Remote) causes LinkedIn to set a geoId that produces zero results.
  if (!explicitSearchLocation && !isRemoteModeSelected(settings)) {
    const filterLocations = parseListSetting(settings?.filterLocations);
    const firstRealLocation = filterLocations.find((value) => value && !isRemoteLikeSearchValue(value));
    if (firstRealLocation) return firstRealLocation;
  }
  return explicitSearchLocation;
}

function buildSearchLocationDecisionMeta(settings, locationOverride = "", resolvedLocation = "") {
  const override = String(locationOverride || "").trim();
  const explicitSearchLocation = String(settings?.searchLocation || "").trim();
  const filterLocations = parseListSetting(settings?.filterLocations);
  const remoteModeSelected = isRemoteModeSelected(settings);
  const useRemoteLocationKeywords = shouldUseRemoteLocationKeywords(settings);
  const skipRemoteLocationTyping =
    useRemoteLocationKeywords && isRemoteLikeSearchValue(explicitSearchLocation) && !override;

  let source = "none";
  if (override) source = "override";
  else if (explicitSearchLocation) source = "settings.searchLocation";

  return {
    resolvedLocation: String(resolvedLocation || "").trim(),
    source,
    locationOverride: override || "",
    settingsSearchLocation: explicitSearchLocation,
    remoteModeSelected,
    useRemoteLocationKeywords,
    skipRemoteLocationTyping,
    filterLocations
  };
}

function shouldClearStaleLocationQueryParams(settings, url) {
  if (!url) return false;
  const hasLocationParams = SEARCH_LOCATION_QUERY_PARAM_KEYS.some((key) => url.searchParams.has(key));
  if (!hasLocationParams) return false;

  const searchLocation = String(settings?.searchLocation || "").trim();
  const filterLocations = parseListSetting(settings?.filterLocations);

  if (isRemoteLikeSearchValue(searchLocation)) return true;
  if (filterLocations.length > 0 && filterLocations.every((value) => isRemoteLikeSearchValue(value))) return true;
  if (isRemoteModeSelected(settings) && filterLocations.length > 0 && filterLocations.every((value) => !value || isRemoteLikeSearchValue(value))) {
    return true;
  }
  // When remote mode is active but filterLocations has non-remote values (e.g. "Mohali"),
  // the search location won't be typed into the input (see getEffectiveSearchLocation),
  // so any stale geoId in the URL from a previous non-remote search should be cleared.
  if (isRemoteModeSelected(settings) && getEffectiveSearchLocation(settings) === "") {
    return true;
  }
  return false;
}

function buildJobsSearchUrl(keyword = "") {
  const url = new URL(JOBS_SEARCH_URL);
  const cleanKeyword = String(keyword || "").trim();
  if (cleanKeyword) {
    url.searchParams.set("keywords", cleanKeyword);
  }
  return url.toString();
}

function getActiveRunSearchUrl(settings) {
  const term = getConfiguredSearchTerms(settings)[runSearchTermCursor] || "";
  const url = new URL(buildJobsSearchUrl(term));
  const dateParam = datePostedToLinkedInParam(settings?.datePosted || "");
  const sortParam = sortByToLinkedInParam(settings?.sortBy || "");
  const workplaceParam = onSiteToLinkedInParam(settings?.onSite || "");
  if (dateParam) url.searchParams.set("f_TPR", dateParam);
  if (sortParam) url.searchParams.set("sortBy", sortParam);
  if (workplaceParam) url.searchParams.set("f_WT", workplaceParam);
  return url.toString();
}

function datePostedToLinkedInParam(value) {
  const v = normalizeLabel(value);
  if (v === "past 24 hours") return "r86400";
  if (v === "past week") return "r604800";
  if (v === "past month") return "r2592000";
  return "";
}

function workModeValueToLinkedInCode(value) {
  const normalized = normalizeLabel(value);
  if (normalized === "on site" || normalized === "onsite") return "1";
  if (normalized === "remote") return "2";
  if (normalized === "hybrid") return "3";
  return "";
}

function onSiteToLinkedInParam(value) {
  const codes = parseListSetting(value)
    .map((item) => workModeValueToLinkedInCode(item))
    .filter(Boolean);
  return Array.from(new Set(codes)).join(",");
}

function getBroaderDatePostedValue(currentValue) {
  const normalizedCurrent = normalizeLabel(currentValue);
  if (normalizedCurrent === "past 24 hours") return "Past week";
  if (normalizedCurrent === "past week") return "Past month";
  if (normalizedCurrent === "past month") return "Any time";
  return "";
}

function getNextDatePostedValue(currentValue, stopAt24Hours = true) {
  const options = ["Any time", "Past month", "Past week", "Past 24 hours"];
  const normalizedCurrent = normalizeLabel(currentValue);
  const currentIndex = Math.max(
    0,
    options.findIndex((value) => normalizeLabel(value) === normalizedCurrent)
  );
  const nextIndex = Math.min(options.length - 1, currentIndex + 1);
  if (stopAt24Hours) {
    return options[nextIndex];
  }
  return options[(currentIndex + 1) % options.length];
}

function sortByToLinkedInParam(value) {
  const v = normalizeLabel(value);
  if (v === "most recent") return "DD";
  if (v === "most relevant") return "R";
  return "";
}

function getAlternateSortValue(currentValue) {
  return normalizeLabel(currentValue) === "most recent" ? "Most relevant" : "Most recent";
}

const TRANSIENT_SEARCH_QUERY_PARAM_KEYS = ["currentJobId", "jobId", "postApplyJobId", "refresh", "origin"];

function clearTransientSearchQueryParams(url) {
  for (const key of TRANSIENT_SEARCH_QUERY_PARAM_KEYS) {
    url.searchParams.delete(key);
  }
}

function hasTransientSearchQueryParams(url) {
  try {
    const parsed = url instanceof URL ? url : new URL(String(url || window.location.href));
    return TRANSIENT_SEARCH_QUERY_PARAM_KEYS.some((key) => parsed.searchParams.has(key));
  } catch {
    return false;
  }
}

function hasSearchLocationQueryParams(url) {
  try {
    const parsed = url instanceof URL ? url : new URL(String(url || window.location.href));
    return SEARCH_LOCATION_QUERY_PARAM_KEYS.some((key) => parsed.searchParams.has(key));
  } catch {
    return false;
  }
}

function readStoredSearchResultsUrl() {
  try {
    const raw = String(sessionStorage.getItem(LAST_SEARCH_RESULTS_URL_KEY) || "").trim();
    if (!raw) return "";
    const url = new URL(raw);
    if (!url.pathname.startsWith("/jobs/search")) return "";
    clearTransientSearchQueryParams(url);
    return url.toString();
  } catch {
    return "";
  }
}

function writeStoredSearchResultsUrl(urlValue) {
  try {
    const url = new URL(String(urlValue || "").trim());
    if (!url.pathname.startsWith("/jobs/search")) return;
    clearTransientSearchQueryParams(url);
    sessionStorage.setItem(LAST_SEARCH_RESULTS_URL_KEY, url.toString());
  } catch {
    // ignore storage failures
  }
}

function buildCanonicalSearchUrl(settings, options = {}) {
  const preserveStart = options?.preserveStart !== false;
  const baseCandidates = [
    options?.baseUrl,
    readStoredSearchResultsUrl(),
    window.location.href,
    getActiveRunSearchUrl(settings)
  ];

  let url = null;
  for (const candidate of baseCandidates) {
    try {
      const parsed = new URL(String(candidate || "").trim());
      if (parsed.pathname.startsWith("/jobs/search")) {
        url = parsed;
        break;
      }
    } catch {
      // ignore invalid candidates
    }
  }

  if (!url) {
    url = new URL(getActiveRunSearchUrl(settings));
  }

  const currentStart = String(url.searchParams.get("start") || "").trim();
  const dateParam = datePostedToLinkedInParam(settings?.datePosted || "");
  const sortParam = sortByToLinkedInParam(settings?.sortBy || "");
  const workplaceParam = onSiteToLinkedInParam(settings?.onSite || "");

  const terms = getConfiguredSearchTerms(settings);
  if (terms.length > 0) {
    const activeTerm = terms[Math.min(runSearchTermCursor, terms.length - 1)] || "";
    if (activeTerm) {
      url.searchParams.set("keywords", activeTerm);
      captureDebugEvent("search", "KEYWORDS_ENFORCED", { term: activeTerm, cursor: runSearchTermCursor });
    }
  }

  if (dateParam) url.searchParams.set("f_TPR", dateParam);
  else url.searchParams.delete("f_TPR");

  if (sortParam) url.searchParams.set("sortBy", sortParam);
  else url.searchParams.delete("sortBy");

  if (workplaceParam) url.searchParams.set("f_WT", workplaceParam);
  else url.searchParams.delete("f_WT");

  if (settings?.easyApplyOnly !== false) {
    url.searchParams.set("f_AL", "true");
  }

  if (shouldClearStaleLocationQueryParams(settings, url)) {
    clearSearchLocationQueryParams(url);
  }

  if (!preserveStart || !/^\d+$/.test(currentStart) || Number(currentStart) <= 0) {
    url.searchParams.delete("start");
  } else {
    url.searchParams.set("start", currentStart);
  }

  clearTransientSearchQueryParams(url);
  return url;
}

function normalizeSearchUrlWithoutReload(settings) {
  if (!isJobsSearchPage()) return false;
  try {
    const before = new URL(window.location.href).toString();
    const after = buildCanonicalSearchUrl(settings, { baseUrl: before, preserveStart: true }).toString();
    writeStoredSearchResultsUrl(after);
    if (after === before) return false;
    window.history.replaceState(null, "", after);
    return true;
  } catch {
    return false;
  }
}

function getResumableSearchUrl(settings, options = {}) {
  const resumeUrl = buildCanonicalSearchUrl(settings, {
    baseUrl: options?.baseUrl,
    preserveStart: options?.preserveStart !== false
  });
  try {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.pathname.startsWith("/jobs/search")) {
      if (!shouldClearStaleLocationQueryParams(settings, currentUrl)) {
        for (const key of SEARCH_LOCATION_QUERY_PARAM_KEYS) {
          const value = String(currentUrl.searchParams.get(key) || "").trim();
          if (value) resumeUrl.searchParams.set(key, value);
        }
      }
    }
  } catch {
    // fall back to the active run search URL
  }
  clearTransientSearchQueryParams(resumeUrl);
  writeStoredSearchResultsUrl(resumeUrl.toString());
  return resumeUrl.toString();
}

function isSameSearchUrl(urlA, urlB) {
  try {
    const a = urlA instanceof URL ? urlA : new URL(String(urlA || ""));
    const b = urlB instanceof URL ? urlB : new URL(String(urlB || ""));
    if (a.origin !== b.origin || a.pathname !== b.pathname) return false;
    const meaningfulKeys = ["keywords", "geoId", "location", "f_AL", "f_TPR", "f_WT", "f_E", "f_JT", "start", "sortBy"];
    for (const key of meaningfulKeys) {
      const valA = normalizeLabel(String(a.searchParams.get(key) || ""));
      const valB = normalizeLabel(String(b.searchParams.get(key) || ""));
      if (valA !== valB) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Redirect guard kept in sessionStorage: each redirect reloads the page and resets in-memory state,
// so an in-memory timestamp could never stop LinkedIn rewriting the URL → we redirect → repeat loops.
const SEARCH_REDIRECT_GUARD_KEY = "cpSearchRedirectGuard";
const SEARCH_REDIRECT_GUARD_WINDOW_MS = 2 * 60 * 1000;

function readSearchRedirectGuard() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SEARCH_REDIRECT_GUARD_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function noteSearchRedirect(target) {
  try {
    sessionStorage.setItem(SEARCH_REDIRECT_GUARD_KEY, JSON.stringify({ target: String(target), at: Date.now() }));
  } catch {
    // storage unavailable: fall back to allowing redirects
  }
}

/** True if we already redirected to this same search recently (LinkedIn rewrote it after load). */
function wasRecentlyRedirectedTo(target) {
  const guard = readSearchRedirectGuard();
  if (!guard?.target || Date.now() - Number(guard.at || 0) > SEARCH_REDIRECT_GUARD_WINDOW_MS) return false;
  return guard.target === String(target) || isSameSearchUrl(guard.target, target);
}

function diffSearchUrlKeys(urlA, urlB) {
  try {
    const a = new URL(String(urlA));
    const b = new URL(String(urlB));
    const keys = new Set([...a.searchParams.keys(), ...b.searchParams.keys()]);
    TRANSIENT_SEARCH_QUERY_PARAM_KEYS.forEach((k) => keys.delete(k));
    return [...keys].filter((k) => (a.searchParams.get(k) || "") !== (b.searchParams.get(k) || ""))
      .map((k) => `${k}: "${a.searchParams.get(k) || ""}" → "${b.searchParams.get(k) || ""}"`);
  } catch {
    return [];
  }
}

async function ensureSearchQueryParams(settings) {
  if (!isJobsSearchPage()) return true;
  try {
    const before = new URL(window.location.href).toString();
    const transientOnlyUrl = new URL(before);
    clearTransientSearchQueryParams(transientOnlyUrl);
    const url = buildCanonicalSearchUrl(settings, { baseUrl: before, preserveStart: true });

    const after = url.toString();
    if (after !== before) {
      if (isSameSearchUrl(before, after) || after === transientOnlyUrl.toString()) {
        window.history.replaceState(null, "", after);
        writeStoredSearchResultsUrl(after);
        await debugLog(settings, "Normalized search URL without reload", { before, after });
        return true;
      }

      if (wasRecentlyRedirectedTo(after)) {
        // LinkedIn changed our URL again after the reload; continue on the current results instead of looping.
        const changed = diffSearchUrlKeys(after, before);
        captureDebugEvent("search", "SEARCH_REDIRECT_LOOP_PREVENTED", { before, after, changed });
        await logLine(`LinkedIn adjusted the search URL (${changed.join(", ") || "params"}); continuing with current results.`, "warn");
        writeStoredSearchResultsUrl(before);
        return true;
      }
      noteSearchRedirect(after);

      writeStoredSearchResultsUrl(after);
      await logLine("Applied search query preferences (date/sort/work mode)", "info");
      window.location.href = after;
      return false;
    }
    writeStoredSearchResultsUrl(after);
    return true;
  } catch {
    return true;
  }
}

async function relaxDatePostedForEmptyResults(settings) {
  const nextDatePosted = getBroaderDatePostedValue(settings?.datePosted || "");
  if (!nextDatePosted) return false;

  const currentDatePosted = String(settings?.datePosted || "Any time").trim() || "Any time";
  const saved = await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { datePosted: nextDatePosted } });
  const nextSettings =
    saved?.ok && saved.settings && typeof saved.settings === "object"
      ? { ...settings, ...saved.settings, datePosted: nextDatePosted }
      : { ...settings, datePosted: nextDatePosted };
  const nextUrl = getActiveRunSearchUrl(nextSettings);
  if (!nextUrl) return false;

  await logLine(`No jobs with "${currentDatePosted}". Trying "${nextDatePosted}".`, "info");
  resetRemoteLocationKeywordCursor();
  window.location.href = nextUrl;
  return true;
}
