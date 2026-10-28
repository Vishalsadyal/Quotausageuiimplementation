/*
 * LinkedIn Jobs auto-apply - part 13: skip-rules
 *
 * Skip rules: title/company/experience rules, job description and About-the-company checks,
 * details-pane refresh checks, and LinkedIn's daily Easy Apply limit detection + pause.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

// Whole-word match for exclude words: "Intern" skips "Marketing Intern" but not "Internal Auditor" or
// "International". Joined words from the AI ("VicePresident") are split first, to "vice president".
function splitWordsForMatch(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim();
}

function textHasExcludedWord(text, word) {
  const w = splitWordsForMatch(word);
  if (!w) return false;
  return ` ${splitWordsForMatch(text)} `.includes(` ${w} `);
}

function shouldSkipByRules(card, settings) {
  const { title, titleRaw, company } = extractCardMeta(card);
  const blacklistCompanies = parseListSetting(settings.blacklistedCompanies).map((s) => normalizeLabel(s));

  if (company && blacklistCompanies.some((name) => name && company.includes(name))) {
    return { skip: true, reasonCode: "BLACKLISTED_COMPANY", reason: `Company blacklisted: ${company}` };
  }
  const titleWord = title ? parseListSetting(settings.badWords).find((w) => textHasExcludedWord(titleRaw || title, w)) : "";
  if (titleWord) {
    return { skip: true, reasonCode: "BAD_WORD_TITLE", reason: `"${titleWord}" found in the job title`, matchedWord: titleWord };
  }

  const activeKeyword = getCurrentSearchKeyword() || parseListSetting(settings?.searchTerms)[0] || "";
  if (activeKeyword && !isJobMatchingSearchKeywords(titleRaw || title, activeKeyword, settings)) {
    return {
      skip: true,
      reasonCode: "KEYWORD_MISMATCH",
      reason: `Title "${titleRaw || title}" does not match active keyword "${activeKeyword}" or related dictionary skills`
    };
  }

  return { skip: false, reasonCode: "", reason: "" };
}

function extractYearsOfExperience(text) {
  const raw = String(text || "");
  const matches = [...raw.matchAll(/(?:^|\s)(\d{1,2})\s*(?:\+|plus|-|to)?\s*(?:\d{0,2})?\s*years?/gi)];
  if (!matches.length) return 0;
  const values = matches
    .map((m) => Number(m?.[1] || 0))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 40);
  return values.length ? Math.max(...values) : 0;
}

function getJobDescriptionText() {
  const el = getBySelectorList([
    ".jobs-box__html-content",
    ".jobs-description__content",
    ".jobs-description-content__text",
    ".jobs-unified-top-card__job-insight",
    ".jobs-details__main-content"
  ]);
  const text = String(el?.textContent || "").trim();
  // Class-free fallback (src/linkedin/core/job.js): the "About the job" section of the details pane.
  return text || globalThis.CPLinkedInJob?.descriptionText() || "";
}

// Class-free details read (title/company) for layouts without the classes below. Cached briefly:
// waitForDetailPaneRefresh polls this every ~180 ms.
let genericDetailsCache = { at: 0, url: "", value: null };
function getGenericDetails() {
  const Job = globalThis.CPLinkedInJob;
  if (!Job) return null;
  if (genericDetailsCache.value && genericDetailsCache.url === location.href && Date.now() - genericDetailsCache.at < 300) {
    return genericDetailsCache.value;
  }
  const value = Job.readDetails();
  genericDetailsCache = { at: Date.now(), url: location.href, value };
  return value;
}

function getDetailPaneTitleText() {
  const el = getBySelectorList([
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-unified-top-card h1",
    ".jobs-unified-top-card__job-title",
    ".jobs-details-top-card__job-title",
    ".jobs-details__main-content h1",
  ]);
  return cleanQuestionLabel(el?.textContent || getGenericDetails()?.title || "");
}

function getDetailPaneCompanyText() {
  const el = getBySelectorList([
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name",
    ".jobs-details-top-card__company-url",
    ".jobs-unified-top-card__subtitle-primary-grouping a",
  ]);
  return cleanQuestionLabel(el?.textContent || getGenericDetails()?.company || "");
}

function getDetailPaneSnapshot() {
  return {
    jobId: extractLinkedInJobIdFromUrl(window.location.href),
    url: window.location.href,
    title: getDetailPaneTitleText(),
    company: getDetailPaneCompanyText(),
    description: getJobDescriptionText(),
    aboutCompany: getAboutCompanyText(),
  };
}

function textLooselyMatches(value, target) {
  const left = normalizeLabel(value);
  const right = normalizeLabel(target);
  if (!left || !right) return false;
  if (left === right) return true;
  return left.includes(right) || right.includes(left);
}

function didDetailPaneRefreshForCard(snapshot, cardMeta, previousContext = {}) {
  const targetTitle = String(cardMeta?.titleRaw || cardMeta?.title || "").trim();
  const targetCompany = String(cardMeta?.companyRaw || cardMeta?.company || "").trim();
  const previousTitle = String(previousContext?.title || "").trim();
  const previousDescription = normalizeLabel(String(previousContext?.description || "").slice(0, 500));
  const currentDescription = normalizeLabel(String(snapshot?.description || "").slice(0, 500));
  const descriptionChanged = Boolean(currentDescription) && currentDescription !== previousDescription;

  const titleMatches = textLooselyMatches(snapshot?.title || "", targetTitle);
  const companyMatches = textLooselyMatches(snapshot?.company || "", targetCompany);
  const movedAwayFromPreviousTitle =
    Boolean(snapshot?.title) &&
    (!previousTitle || !textLooselyMatches(snapshot.title, previousTitle));

  if (titleMatches && (companyMatches || !targetCompany || descriptionChanged)) return true;
  if (companyMatches && descriptionChanged) return true;
  if (movedAwayFromPreviousTitle && descriptionChanged) return true;
  if (Boolean(snapshot?.jobId) && snapshot.jobId !== String(previousContext?.jobId || "").trim()) return true;
  return false;
}

/**
 * After clicking a card: smart-wait (src/linkedin/core/job.js) until the details pane shows THIS
 * job (same title), with its apply state and description. LinkedIn sometimes changes the URL but
 * keeps the previous job on screen for 10-20 s, so the card is clicked once more before giving up.
 * Returns { ok, sameJob, missing, waitedMs, retried, available }. available=false when the shared
 * module is missing (callers fall back to waitForDetailPaneRefresh).
 */
async function waitForCardDetails(card, cardMeta, settings) {
  const Job = globalThis.CPLinkedInJob;
  const Dom = globalThis.CPLinkedInDom;
  if (!Job || !Dom) return { ok: false, sameJob: true, missing: [], waitedMs: 0, retried: false, available: false };
  const target = { jobId: getJobKeyFromCard(card), title: cardMeta?.titleRaw || cardMeta?.title || "" };
  let res = await Job.waitForDetails(target, { timeoutMs: 9000 });
  let waitedMs = res.waitedMs;
  let retried = false;
  if (!res.ready && res.missing.includes("same job")) {
    retried = true;
    await debugLog(settings, "Details still show another job; clicking the card again", { title: target.title, missing: res.missing });
    // LinkedIn re-renders the list when a job opens: click the card as it is on the page now.
    const current = (card.isConnected && card) || Dom.findJobTiles().tiles.find((t) => Dom.jobIdOf(t).id === target.jobId) || card;
    await selectJobCardInSearchList(current);
    res = await Job.waitForDetails(target, { timeoutMs: 9000 });
    waitedMs += res.waitedMs;
  }
  return { ok: res.ready, sameJob: !res.missing.includes("same job"), missing: res.missing, waitedMs, retried, available: true };
}

async function waitForDetailPaneRefresh(cardMeta, previousContext = {}, timeoutMs = 5000) {
  const timeout = Math.max(800, Number(timeoutMs || 5000));
  const start = Date.now();
  let snapshot = getDetailPaneSnapshot();
  if (didDetailPaneRefreshForCard(snapshot, cardMeta, previousContext)) return snapshot;

  while (Date.now() - start < timeout) {
    await sleep(180);
    snapshot = getDetailPaneSnapshot();
    if (didDetailPaneRefreshForCard(snapshot, cardMeta, previousContext)) return snapshot;
  }

  return snapshot;
}

function shouldSkipByDescription(description, settings) {
  const text = normalizeLabel(description);
  if (!text) return { skip: false, reasonCode: "", reason: "" };

  // Exclude words are checked on the job title only (shouldSkipByRules), not here: descriptions mention
  // them in normal jobs ("Intern to 7 years", "report to the Finance Director", "sales tax").

  const hasClearanceRequirement =
    text.includes("polygraph") ||
    text.includes("security clearance") ||
    text.includes("clearance required") ||
    text.includes("secret clearance");
  if (!settings.securityClearance && hasClearanceRequirement) {
    return {
      skip: true,
      reasonCode: "SECURITY_CLEARANCE_REQUIRED",
      reason: "Security clearance requirement detected"
    };
  }

  const configuredExperience = Number(settings.currentExperience);
  if (Number.isFinite(configuredExperience) && configuredExperience >= 0) {
    const required = extractYearsOfExperience(text);
    if (required > 0) {
      const allowed = configuredExperience + (settings.didMasters ? 2 : 0);
      if (required > allowed) {
        return {
          skip: true,
          reasonCode: "EXPERIENCE_TOO_HIGH",
          reason: `Required experience ${required} > allowed ${allowed}`
        };
      }
    }
  }

  return { skip: false, reasonCode: "", reason: "" };
}

function getAboutCompanyText() {
  const el = getBySelectorList([
    ".jobs-company__box",
    ".jobs-company__company-description",
    ".jobs-company__overview",
    ".jobs-company__inline-information"
  ]);
  return String(el?.textContent || "").trim() || globalThis.CPLinkedInJob?.aboutCompanyText() || "";
}

function shouldSkipByAboutCompany(aboutCompanyText, settings) {
  const text = normalizeLabel(aboutCompanyText);
  if (!text) return { skip: false, reasonCode: "", reason: "" };

  const goodWords = parseListSetting(settings.aboutCompanyGoodWords).map((s) => normalizeLabel(s));
  if (goodWords.some((w) => w && text.includes(w))) {
    return { skip: false, reasonCode: "", reason: "" };
  }

  const badWords = parseListSetting(settings.aboutCompanyBadWords).map((s) => normalizeLabel(s));
  const match = badWords.find((w) => w && text.includes(w));
  if (match) {
    return {
      skip: true,
      reasonCode: "ABOUT_COMPANY_BAD_WORD",
      reason: `About company contains blocked word: ${match}`
    };
  }

  return { skip: false, reasonCode: "", reason: "" };
}

let lastDailyEasyApplyLimitEvidence = "";

function hasDailyEasyApplyLimitSignal(root = document) {
  const targetRoot = root || document;
  // 2026 layout: the limit dialog is a server-driven screen with a stable name, whatever its wording
  // or class names are. Looked up on the page and inside LinkedIn's shadow root for dialogs.
  const LIMIT_SCREEN = "[data-sdui-screen*='EasyApplyFuseLimit' i]";
  const screenRoots = [targetRoot, document, document.getElementById("interop-outlet")?.shadowRoot].filter(Boolean);
  for (const r of screenRoots) {
    if (r.querySelector?.(LIMIT_SCREEN)) {
      lastDailyEasyApplyLimitEvidence = "matched:sdui-screen EasyApplyFuseLimit";
      return true;
    }
  }
  const candidates = getAllBySelectorList(
    [
      ".artdeco-inline-feedback__message",
      ".artdeco-inline-feedback",
      "[role='alert']",
      "[aria-live='polite']",
      "[aria-live='assertive']",
      ".artdeco-toast-item__message",
      ".artdeco-toast-item",
      ".jobs-easy-apply-modal",
      ".artdeco-modal",
      "[role='dialog']",
      ".jobs-apply-button--top-card + .artdeco-inline-feedback__message",
      ".jobs-unified-top-card .artdeco-inline-feedback__message",
      ".jobs-s-apply",
      ".jobs-unified-top-card",
      ".job-details-jobs-unified-top-card__container--two-pane"
    ],
    targetRoot
  );

  const scopedText = normalizeLabel(candidates.map((el) => String(el?.textContent || "")).join(" "));
  lastDailyEasyApplyLimitEvidence = "";
  if (!scopedText) return false;

  const isExactDailyLimitMsg =
    scopedText.includes("we limit daily submissions") ||
    scopedText.includes("limit daily submissions") ||
    (scopedText.includes("maintain quality and prevent bots") && scopedText.includes("tomorrow")) ||
    (scopedText.includes("save this job") && scopedText.includes("apply tomorrow")) ||
    scopedText.includes("helping each application get the right attention") ||
    // 2026 wording: "You reached today's Easy Apply limit. ... Save this job and continue applying tomorrow."
    (scopedText.includes("reached today") && scopedText.includes("easy apply limit")) ||
    (scopedText.includes("easy apply limit") && scopedText.includes("tomorrow")) ||
    (scopedText.includes("save this job") && scopedText.includes("applying tomorrow")) ||
    (scopedText.includes("limit easy apply submissions") && scopedText.includes("tomorrow"));

  const coreLimitPhrases = [
    "we limit the number of applications you can submit in a day",
    "limit the number of applications you can submit in a day",
    "we limit the number of applications you can submit per day",
    "limit the number of applications you can submit per day",
    "daily application limit",
    "exceeded the daily application limit",
    "we limit daily submissions",
    "limit daily submissions"
  ];

  const coreMatch = coreLimitPhrases.find((phrase) => scopedText.includes(phrase));
  const hasTomorrowSignal =
    scopedText.includes("apply tomorrow") ||
    scopedText.includes("try again tomorrow") ||
    scopedText.includes("please try again tomorrow") ||
    scopedText.includes("tomorrow");

  if (isExactDailyLimitMsg || (coreMatch && (hasTomorrowSignal || scopedText.includes("submit in a day") || scopedText.includes("per day")))) {
    lastDailyEasyApplyLimitEvidence = `matched:${coreMatch || "exact_daily_limit_message"}${hasTomorrowSignal ? "+tomorrow" : ""}`;
    return true;
  }
  return false;
}

async function pauseRunForDailyEasyApplyLimit(settings, reason = "LinkedIn daily submission limit reached: We limit daily submissions to maintain quality and prevent bots. Save this job and apply tomorrow.") {
  const runId = String(lastRunStartedAt || "");
  if (runId && dailyLimitHandledRunId === runId) return false;
  if (runId) dailyLimitHandledRunId = runId;

  runStats.skipped += 1;
  await logOutcome("warn", "🛑 LinkedIn daily Easy Apply limit reached. Safe stop activated.", "DAILY_EASY_APPLY_LIMIT");
  await recordOutcome("SKIPPED", {
    reasonCode: "DAILY_EASY_APPLY_LIMIT",
    reason,
    ...currentJobContext
  });
  await reportProgress();
  await sendMessage({ type: "CP_PAUSE" });
  await botChat(
    "🛑 LinkedIn says you reached today's Easy Apply limit. The run has been stopped to protect your account. Click \"Got it\" on LinkedIn's message and continue tomorrow.",
    "warn"
  );
  await debugLog(settings, "Paused due daily limit", { reason, evidence: lastDailyEasyApplyLimitEvidence });
  return true;
}

/** Out of Hires with no free applications left: stop now and tell the user how to continue. */
async function pauseRunOutOfHires(settings) {
  const runId = String(lastRunStartedAt || "");
  if (runId && outOfHiresHandledRunId === runId) return false;
  if (runId) outOfHiresHandledRunId = runId;
  await logOutcome("warn", "Out of Hires. Run stopped.", "OUT_OF_HIRES");
  await sendMessage({ type: "CP_PAUSE" });
  await botChat(OUT_OF_HIRES_TEXT, "warn", OUT_OF_HIRES_META);
  await debugLog(settings, "Paused: out of Hires", { quota: lastPortalQuota });
  return true;
}
