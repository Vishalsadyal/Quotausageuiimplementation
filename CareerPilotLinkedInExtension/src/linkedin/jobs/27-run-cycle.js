/*
 * LinkedIn Jobs auto-apply - part 27: run-cycle
 *
 * runCycle: one pass over the current results page (pick next card, open it, checks, apply or skip,
 * record outcome).
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

async function runCycle(settings) {
  startTimer("runCycle");
  captureDebugEvent("cycle", "CYCLE_START", { url: window.location.href, isJobsPage: isJobsPage(), isViewPage: isJobsViewPage() });
  if (hasDailyEasyApplyLimitSignal()) {
    captureDebugEvent("cycle", "DAILY_LIMIT_REACHED", { durationMs: endTimer("runCycle") });
    await pauseRunForDailyEasyApplyLimit(settings, "LinkedIn daily submission limit reached while scanning jobs");
    return false;
  }
  if (!isJobsPage()) {
    captureDebugEvent("cycle", "LEFT_JOBS_PAGE", { durationMs: endTimer("runCycle") });
    await logLine("Left jobs page. Pausing run.", "warn");
    return false;
  }
  if (isPostApplySearchPage()) {
    const cleanUrl = getResumableSearchUrl(settings);
    window.history.replaceState(null, "", cleanUrl);
    const hasCardsInDom = document.querySelectorAll(".job-card-container, [data-occludable-job-id], li.jobs-search-results__list-item").length > 0;
    if (!hasCardsInDom) {
      captureDebugEvent("cycle", "POST_APPLY_REDIRECT", { durationMs: endTimer("runCycle"), path: window.location.pathname });
      await debugLog(settings, "Detected post-apply page without cards in DOM; returning to search", { path: window.location.pathname });
      resetRemoteLocationKeywordCursor();
      window.location.href = cleanUrl;
      return false;
    }
  }

  if (normalizeSearchUrlWithoutReload(settings)) {
    await debugLog(settings, "Normalized sticky search URL during run cycle", {
      url: window.location.href
    });
  }

  await refreshKnownAppliedJobIds(false);
  const cycleStartApplied = runStats.applied;
  let cycleConsideredCandidates = 0;
  let cycleExhaustedCandidates = 0;
  let cycleHadActionableCandidate = false;

  if (isJobsViewPage()) {
    const resumeSearchUrl = getResumableSearchUrl(settings);
    await debugLog(settings, "Running from jobs view page");
    const viewDescription = getJobDescriptionText();
    const aboutCompany = getAboutCompanyText();
    currentJobContext = {
      ...currentJobContext,
      title: String(document.querySelector("h1")?.textContent || "").trim(),
      company: String(document.querySelector(".jobs-unified-top-card__company-name, .jobs-details-top-card__company-url")?.textContent || "").trim(),
      description: viewDescription,
      aboutCompany,
      jobUrl: buildCanonicalLinkedInJobUrl(
        window.location.href.match(/\/jobs\/view\/(\d+)/)?.[1] || extractLinkedInJobIdFromUrl(window.location.href),
        window.location.href
      ),
      jobId: (window.location.href.match(/\/jobs\/view\/(\d+)/)?.[1] || "")
    };
    const viewJobKey = String(currentJobContext.jobId || "").trim();
    if (viewJobKey && runSeenJobKeys.has(viewJobKey)) {
      await debugLog(settings, "Skipping already-seen jobs view in this run", { jobKey: viewJobKey });
      window.location.href = resumeSearchUrl;
      return false;
    }
    if (viewJobKey && knownAppliedJobIds.has(viewJobKey)) {
      await debugLog(settings, "Skipping jobs view from known applied ids", { jobKey: viewJobKey });
      runStats.skipped += 1;
      await logOutcome("info", "Skipped (already applied earlier)", "APPLIED_CACHE_HIT");
      await recordOutcome("SKIPPED", {
        reasonCode: "APPLIED_CACHE_HIT",
        reason: "Known applied job id cache hit",
        ...currentJobContext
      });
      recordJobOutcomeCache(viewJobKey, "SKIPPED", "ALREADY_APPLIED");
      markKnownApplied(viewJobKey);
      await reportProgress();
      markJobSeen(viewJobKey);
      window.location.href = resumeSearchUrl;
      return true;
    }
    const cachedViewOutcome = getCachedJobOutcome(viewJobKey);
    const viewAlreadyAppliedCacheHit = isAppliedCacheHit(cachedViewOutcome);
    if (viewAlreadyAppliedCacheHit) {
      runStats.skipped += 1;
      await logOutcome("info", "Skipped (already applied earlier)", "APPLIED_CACHE_HIT");
      await recordOutcome("SKIPPED", {
        reasonCode: "APPLIED_CACHE_HIT",
        reason: "Applied cache hit from local outcome cache",
        ...currentJobContext
      });
      recordJobOutcomeCache(viewJobKey, "SKIPPED", "ALREADY_APPLIED");
      markKnownApplied(viewJobKey);
      await reportProgress();
      markJobSeen(viewJobKey);
      window.location.href = resumeSearchUrl;
      return true;
    }
    if (cachedViewOutcome && isTransientSkipCooldownOutcome(cachedViewOutcome)) {
      await debugLog(settings, "Skipping jobs view from temporary cooldown cache", {
        jobKey: viewJobKey,
        reasonCode: cachedViewOutcome.reasonCode,
      });
      await logLine("Deferred retry for recently attempted job (cooldown active).", "info");
      markJobSeen(viewJobKey);
      window.location.href = resumeSearchUrl;
      return true;
    }
    const viewAboutCompanyDecision = shouldSkipByAboutCompany(currentJobContext.aboutCompany, settings);
    if (viewAboutCompanyDecision.skip) {
      runStats.skipped += 1;
      await logOutcome("warn", `Skipped: ${viewAboutCompanyDecision.reason}`, viewAboutCompanyDecision.reasonCode);
      await recordOutcome("SKIPPED", {
        reasonCode: viewAboutCompanyDecision.reasonCode,
        reason: viewAboutCompanyDecision.reason,
        ...currentJobContext
      });
      recordJobOutcomeCache(viewJobKey, "SKIPPED", viewAboutCompanyDecision.reasonCode);
      await reportProgress();
      markJobSeen(viewJobKey);
      window.location.href = resumeSearchUrl;
      return true;
    }
    const viewDescriptionDecision = shouldSkipByDescription(currentJobContext.description, settings);
    if (viewDescriptionDecision.skip) {
      runStats.skipped += 1;
      await logOutcome("warn", `Skipped: ${viewDescriptionDecision.reason}`, viewDescriptionDecision.reasonCode);
      await recordOutcome("SKIPPED", {
        reasonCode: viewDescriptionDecision.reasonCode,
        reason: viewDescriptionDecision.reason,
        matchedWord: viewDescriptionDecision.matchedWord || "",
        ...currentJobContext
      });
      recordJobOutcomeCache(viewJobKey, "SKIPPED", viewDescriptionDecision.reasonCode);
      await reportProgress();
      markJobSeen(viewJobKey);
      window.location.href = resumeSearchUrl;
      return true;
    }
    let applyAction = await waitForApplyButtonFromDetailPane(settings, 9000, "jobs view");
    if (applyAction.type === "none" || !applyAction.button) {
      await sleep(650);
      applyAction = await waitForApplyButtonFromDetailPane(settings, 3000, "jobs view recovery");
    }
    if (applyAction.type === "none" || !applyAction.button) {
      await refreshKnownAppliedJobIds(true);
      if (viewJobKey && knownAppliedJobIds.has(viewJobKey)) {
        runStats.skipped += 1;
        await logOutcome("info", "Skipped (already applied earlier)", "APPLIED_CACHE_HIT");
        await recordOutcome("SKIPPED", {
          reasonCode: "APPLIED_CACHE_HIT",
          reason: "Re-checked after missing apply button; job already applied",
          ...currentJobContext
        });
        recordJobOutcomeCache(viewJobKey, "SKIPPED", "ALREADY_APPLIED");
        markKnownApplied(viewJobKey);
        await reportProgress();
        markJobSeen(viewJobKey);
        window.location.href = resumeSearchUrl;
        return true;
      }
      if (hasDailyEasyApplyLimitSignal()) {
        await pauseRunForDailyEasyApplyLimit(settings);
        return false;
      }
      runStats.skipped += 1;
      await logOutcome("warn", "No Apply button on current job view", "NO_APPLY_BUTTON");
      await recordOutcome("SKIPPED", {
        reasonCode: "NO_APPLY_BUTTON",
        reason: "No apply button on jobs view",
        ...currentJobContext
      });
      recordJobOutcomeCache(viewJobKey, "SKIPPED", "NO_APPLY_BUTTON");
      await reportProgress();
      markJobSeen(viewJobKey);
      await debugLog(settings, "Recovering from jobs view without apply button", {
        jobKey: viewJobKey || undefined,
        redirectUrl: resumeSearchUrl
      });
      window.location.href = resumeSearchUrl;
      return true;
    }
    if (applyAction.type === "external") {
      if (settings.easyApplyOnly) {
        runStats.skipped += 1;
        await logOutcome("warn", "Skipped (external apply)", "EXTERNAL_APPLY_ONLY");
        await recordOutcome("SKIPPED", {
          reasonCode: "EXTERNAL_APPLY_ONLY",
          reason: "External apply blocked because easyApplyOnly is enabled",
          ...currentJobContext
        });
        recordJobOutcomeCache(viewJobKey, "SKIPPED", "EXTERNAL_APPLY_ONLY");
      } else {
        await resilientClick(applyAction.button, "External Apply");
        runStats.skipped += 1;
        runSearchTermSuccessCount += 1;
        await logOutcome("info", "Opened external apply link (manual completion required)", "EXTERNAL_APPLY_OPENED");
        await recordOutcome("EXTERNAL", {
          reasonCode: "EXTERNAL_APPLY_OPENED",
          reason: "External apply opened",
          ...currentJobContext
        });
        recordJobOutcomeCache(viewJobKey, "EXTERNAL", "EXTERNAL_APPLY_OPENED");
      }
      await reportProgress();
      markJobSeen(viewJobKey);
      return true;
    }
    await clearLeftoverDialogs(settings);
    await resilientClick(applyAction.button, "Easy Apply");
    const modal = await waitForModalOpen(4500);
    if (!modal) {
      if (hasDailyEasyApplyLimitSignal()) {
        await pauseRunForDailyEasyApplyLimit(settings);
        return false;
      }
      runStats.skipped += 1;
      await logOutcome("warn", "Skipped: Easy Apply click did not open modal", "MODAL_NOT_FOUND");
      await recordOutcome("SKIPPED", {
        reasonCode: "MODAL_NOT_FOUND",
        reason: "Easy Apply modal not found",
        ...currentJobContext
      });
      recordJobOutcomeCache(viewJobKey, "SKIPPED", "MODAL_NOT_FOUND");
      await reportProgress();
      markJobSeen(viewJobKey);
      window.location.href = resumeSearchUrl;
      return true;
    }
    await sleep(400);
    const resultFromView = await processEasyApplyModal(settings);
    await debugLog(settings, "Modal result (view page)", resultFromView);
    if (resultFromView.submitted || (settings.dryRun && resultFromView.reachedSubmit)) {
      runStats.applied += 1;
      runSearchTermSuccessCount += 1;
      await recordOutcome("APPLIED", {
        reasonCode: settings.dryRun ? "DRY_RUN_REACHED_SUBMIT" : "SUBMITTED",
        reason: settings.dryRun ? "Dry-run reached submit stage" : "Application submitted",
        ...currentJobContext
      });
      recordJobOutcomeCache(viewJobKey, "APPLIED", "SUBMITTED");
      markKnownApplied(viewJobKey);
    } else if (resultFromView.skipped) {
      runStats.skipped += 1;
      if (resultFromView.reason) await logLine(`Skipped: ${resultFromView.reason}`, "warn");
      await recordOutcome("SKIPPED", {
        reasonCode: "VIEW_MODAL_SKIPPED",
        reason: resultFromView.reason || "Modal flow skipped",
        ...currentJobContext
      });
      recordJobOutcomeCache(viewJobKey, "SKIPPED", "VIEW_MODAL_SKIPPED");
    } else {
      runStats.failed += 1;
      await recordOutcome("FAILED", {
        reasonCode: "VIEW_MODAL_FAILED",
        reason: resultFromView.reason || "Modal flow failed",
        ...currentJobContext
      });
      recordJobOutcomeCache(viewJobKey, "FAILED", "VIEW_MODAL_FAILED");
    }
    await reportProgress();
    markJobSeen(viewJobKey);
    return true;
  }

  let cards = await loadAllJobCardsOnPage(settings);
  await debugLog(settings, "Selector diagnostics", {
    jobCardContainer: document.querySelectorAll(".job-card-container").length,
    occludable: document.querySelectorAll("[data-occludable-job-id]").length,
    listItems: document.querySelectorAll("li.jobs-search-results__list-item").length,
    jobAnchors: document.querySelectorAll("a[href*='/jobs/view/']").length,
    cards: cards.length,
    path: window.location.pathname
  });
  if (!cards.length) {
    exhaustedSearchPageStreak = 0;
    captureDebugEvent("cycle", "NO_CARDS_FOUND", { durationMs: endTimer("runCycle") });
    await logLine("No jobs found on current page", "warn");
    const rotatedRemoteLocation = await rotateRemoteLocationKeyword(settings);
    if (rotatedRemoteLocation) return true;
    const broadenedDate = await relaxDatePostedForEmptyResults(settings);
    if (broadenedDate) return true;
    const scrollRoot =
      document.querySelector(".jobs-search-results-list") ||
      document.querySelector(".scaffold-layout__list-detail-inner") ||
      document.scrollingElement ||
      document.body;
    if (scrollRoot && typeof scrollRoot.scrollBy === "function") {
      scrollRoot.scrollBy({ top: 900, behavior: "smooth" });
    } else {
      window.scrollBy({ top: 900, behavior: "smooth" });
    }
    await sleep(900);
    const movedToNextPage = await gotoNextResultsPage(settings);
    if (movedToNextPage) return true;
    const movedToNextTerm = await rotateSearchTerm(settings);
    if (movedToNextTerm) return true;
    return false;
  }

  await logLine(`Found ${cards.length} job cards`);
  await botChat(`Found ${cards.length} jobs. Analyzing each one for the best fit...`);
  let cardsToProcess = cards;
  if (settings.easyApplyOnly) {
    const easyApplyCards = cards.filter((card) => hasEasyApplySignalOnCard(card));
    if (easyApplyCards.length > 0 && easyApplyCards.length < cards.length) {
      cardsToProcess = easyApplyCards;
      await logLine(`Easy Apply candidates: ${easyApplyCards.length}/${cards.length}`);
      // Tag the cards left out so they don't just sit there unexplained. Tag only: nothing is
      // opened, applied to or counted as skipped, and cards that already carry a tag keep it.
      for (const card of cards) {
        if (easyApplyCards.includes(card)) continue;
        const container = getCardElementContainer(card);
        if (!container || container.querySelector(".cp-card-outcome-tag")) continue;
        markJobCardStatus(card, "skipped", "No Easy Apply");
      }
    } else if (easyApplyCards.length === 0) {
      await debugLog(settings, "No explicit Easy Apply badge on cards; processing all cards as fallback", {
        cards: cards.length,
      });
    }
  }

  for (const card of cardsToProcess) {
    const state = (await sendMessage({ type: "CP_GET_BOOTSTRAP" })).state;
    if (!state.running || state.paused) return false;

    // Nothing left to spend (no Hires and no free applications): stop before opening another job.
    if (describeHiresState(lastPortalQuota).out) {
      await pauseRunOutOfHires(settings);
      return false;
    }

    const targetApplyLimit = Math.max(1, Number(settings.maxApplicationsPerRun || 10));
    if (runStats.applied >= targetApplyLimit) {
      await logLine(`Reached target application goal (${runStats.applied}/${targetApplyLimit} applied). Run complete.`, "info");
      await botChat(`Target goal of ${targetApplyLimit} applications completed! Pausing.`);
      await sendMessage({ type: "CP_PAUSE" });
      return false;
    }

    let jobKey = getJobKeyFromCard(card);
    if (!jobKey) {
      await debugLog(settings, "Skipping card without stable job id", {
        title: String(getCardAnchor(card)?.textContent || "").trim(),
      });
      continue;
    }

    const cardMeta = extractCardMeta(card);
    const candidateTitle = cardMeta.titleRaw || "Job Candidate";
    await logLine(`[Candidate] Evaluating: "${candidateTitle}" (${cardMeta.companyRaw || 'Company'})`, "info");
    highlightActiveJobCard(card, `AI Checking: ${candidateTitle.slice(0, 30)}`);

    const jobAliasKeys = new Set([jobKey]);
    const recordOutcomeCacheForAliases = (status, reasonCode = "") => {
      for (const alias of jobAliasKeys) {
        recordJobOutcomeCache(alias, status, reasonCode);
      }
    };
    const markSeenForAliases = () => {
      for (const alias of jobAliasKeys) {
        markJobSeen(alias);
      }
    };
    const markAppliedForAliases = () => {
      for (const alias of jobAliasKeys) {
        markKnownApplied(alias);
      }
    };
    let cardClassifiedForCycle = false;
    const classifyExhaustedCandidate = () => {
      if (cardClassifiedForCycle) return;
      cardClassifiedForCycle = true;
      cycleConsideredCandidates += 1;
      cycleExhaustedCandidates += 1;
    };
    const classifyActionableCandidate = () => {
      if (cardClassifiedForCycle) return;
      cardClassifiedForCycle = true;
      cycleConsideredCandidates += 1;
      cycleHadActionableCandidate = true;
    };

    if (jobKey && runSeenJobKeys.has(jobKey)) {
      await debugLog(settings, "Skipping already-seen card in this run", { jobKey });
      continue;
    }
    if (jobKey && knownAppliedJobIds.has(jobKey)) {
      classifyExhaustedCandidate();
      await debugLog(settings, "Skipping job from known applied ids", { jobKey });
      runStats.skipped += 1;
      markJobCardStatus(card, "skipped", "Already Applied");
      await logOutcome("info", "Skipped (already applied earlier)", "APPLIED_CACHE_HIT");
      await recordOutcome("SKIPPED", {
        reasonCode: "APPLIED_CACHE_HIT",
        reason: "Known applied job id cache hit",
        jobId: jobKey,
        ...cardMeta
      });
      recordOutcomeCacheForAliases("SKIPPED", "ALREADY_APPLIED");
      markAppliedForAliases();
      await reportProgress();
      markSeenForAliases();
      continue;
    }
    const cachedOutcome = getCachedJobOutcome(jobKey);
    const alreadyAppliedCacheHit = isAppliedCacheHit(cachedOutcome);
    if (alreadyAppliedCacheHit) {
      classifyExhaustedCandidate();
      await debugLog(settings, "Skipping job from applied cache", { jobKey, reasonCode: cachedOutcome.reasonCode });
      runStats.skipped += 1;
      markJobCardStatus(card, "skipped", "Already Applied");
      await logOutcome("info", "Skipped (already applied earlier)", "APPLIED_CACHE_HIT");
      await recordOutcome("SKIPPED", {
        reasonCode: "APPLIED_CACHE_HIT",
        reason: "Applied cache hit from local outcome cache",
        jobId: jobKey,
        ...cardMeta
      });
      recordOutcomeCacheForAliases("SKIPPED", "ALREADY_APPLIED");
      markAppliedForAliases();
      await reportProgress();
      markSeenForAliases();
      continue;
    }
    if (cachedOutcome && isTransientSkipCooldownOutcome(cachedOutcome)) {
      classifyExhaustedCandidate();
      await debugLog(settings, "Skipping job from temporary cooldown cache", {
        jobKey,
        reasonCode: cachedOutcome.reasonCode,
      });
      markJobCardStatus(card, "skipped", "Cooldown");
      await logLine("Deferred retry for recently attempted job (cooldown active).", "info");
      markSeenForAliases();
      continue;
    }
    if (isAlreadyAppliedCard(card)) {
      classifyExhaustedCandidate();
      const stableJobId = jobKey || extractLinkedInJobIdFromUrl(getCardAnchor(card)?.href) || "";
      if (stableJobId) jobAliasKeys.add(stableJobId);
      runStats.skipped += 1;
      markJobCardStatus(card, "skipped", "Already Applied");
      await logOutcome("info", "Skipped (already applied)", "ALREADY_APPLIED");
      await recordOutcome("SKIPPED", {
        reasonCode: "ALREADY_APPLIED",
        reason: "LinkedIn card marked as already applied",
        detection: detectAppliedCardMethod(card),
        jobId: stableJobId,
        ...cardMeta
      });
      recordOutcomeCacheForAliases("SKIPPED", "ALREADY_APPLIED");
      markAppliedForAliases();
      await reportProgress();
      markSeenForAliases();
      continue;
    }
    const ruleDecision = shouldSkipByRules(card, settings);
    if (ruleDecision.skip) {
      classifyActionableCandidate();
      runStats.skipped += 1;
      markJobCardStatus(card, "skipped", ruleDecision.reasonCode);
      await logOutcome("warn", `Skipped: ${ruleDecision.reason}`, ruleDecision.reasonCode);
      await recordOutcome("SKIPPED", {
        reasonCode: ruleDecision.reasonCode,
        reason: ruleDecision.reason,
        matchedWord: ruleDecision.matchedWord || "",
        jobId: jobKey,
        ...cardMeta
      });
      recordOutcomeCacheForAliases("SKIPPED", ruleDecision.reasonCode);
      await dismissJobCard(card);
      await reportProgress();
      markSeenForAliases();
      continue;
    }

    const anchor = getCardAnchor(card);
    const title = cardMeta.titleRaw || anchor?.textContent?.trim() || card.textContent?.trim()?.slice(0, 80) || "Job";
    const previousJobContext = { ...currentJobContext };
    await debugLog(settings, "Processing card", { title, company: cardMeta.companyRaw || cardMeta.company || "" });
    highlightActiveJobCard(card, "Opening Details...");
    highlightDetailPane(title);
    await logLine(`Opening: ${title}`);
    await botChat(`Reading job details for "${title}"...`);
    await sleep(400);
    await selectJobCardInSearchList(card);
    // Never read or click anything until the details pane shows THIS job (smart wait + one re-click).
    const detailsWait = await waitForCardDetails(card, cardMeta, settings);
    if (detailsWait.available && !detailsWait.sameJob) {
      runStats.skipped += 1;
      await logOutcome("warn", "Skipped: job details did not load (LinkedIn kept showing another job)", "DETAILS_NOT_LOADED");
      await debugLog(settings, "Details pane never showed this job", { title, missing: detailsWait.missing, waitedMs: detailsWait.waitedMs });
      markJobCardStatus(card, "skipped", "Details did not load");
      await reportProgress();
      markSeenForAliases();
      continue;
    }
    if (detailsWait.available) {
      await debugLog(settings, "Job details loaded", { title, waitedMs: detailsWait.waitedMs, retried: detailsWait.retried, missing: detailsWait.missing });
    }
    const detailSnapshot = detailsWait.available
      ? getDetailPaneSnapshot()
      : await (async () => {
          await sleep(1200);
          return waitForDetailPaneRefresh(cardMeta, previousJobContext, 4800);
        })();

    // After navigation/selection, re-derive a stable LinkedIn job id from the current URL.
    const resolvedJobId = detailSnapshot.jobId || extractLinkedInJobIdFromUrl(window.location.href);
    if (resolvedJobId && resolvedJobId !== jobKey) {
      await debugLog(settings, "Resolved job id differs from card key", { from: jobKey, to: resolvedJobId });
      jobAliasKeys.add(resolvedJobId);
      jobKey = resolvedJobId;
    }

    const description = detailSnapshot.description || "";
    const aboutCompany = detailSnapshot.aboutCompany || "";
    const detailUrl = detailSnapshot.url || window.location.href;
    const canonicalJobUrl = buildCanonicalLinkedInJobUrl(resolvedJobId || jobKey, anchor?.href || detailUrl);
    currentJobContext = {
      title: detailSnapshot.title || title,
      company: detailSnapshot.company || cardMeta.companyRaw || cardMeta.company || "",
      workLocation: cardMeta.workLocationRaw || cardMeta.workLocation || "",
      description,
      aboutCompany,
      jobId: jobKey || "",
      jobUrl: canonicalJobUrl
    };

    const detailAppliedMethod = detectAppliedInDetailPane();
    if (detailAppliedMethod) {
      classifyExhaustedCandidate();
      runStats.skipped += 1;
      markJobCardStatus(card, "skipped", "Already Applied");
      await logOutcome("info", "Skipped (already applied)", "ALREADY_APPLIED");
      await recordOutcome("SKIPPED", {
        reasonCode: "ALREADY_APPLIED",
        reason: "Job detail pane shows the job as already applied",
        detection: detailAppliedMethod,
        ...currentJobContext
      });
      recordOutcomeCacheForAliases("SKIPPED", "ALREADY_APPLIED");
      markAppliedForAliases();
      await reportProgress();
      markSeenForAliases();
      continue;
    }

    const aboutCompanyDecision = shouldSkipByAboutCompany(aboutCompany, settings);
    if (aboutCompanyDecision.skip) {
      classifyActionableCandidate();
      runStats.skipped += 1;
      await logOutcome("warn", `Skipped: ${aboutCompanyDecision.reason}`, aboutCompanyDecision.reasonCode);
      await recordOutcome("SKIPPED", {
        reasonCode: aboutCompanyDecision.reasonCode,
        reason: aboutCompanyDecision.reason,
        ...currentJobContext
      });
      recordOutcomeCacheForAliases("SKIPPED", aboutCompanyDecision.reasonCode);
      markJobCardStatus(card, "skipped", aboutCompanyDecision.reasonCode);
      await dismissJobCard(card);
      await reportProgress();
      markSeenForAliases();
      continue;
    }

    const descriptionDecision = shouldSkipByDescription(description, settings);
    if (descriptionDecision.skip) {
      classifyActionableCandidate();
      runStats.skipped += 1;
      await logOutcome("warn", `Skipped: ${descriptionDecision.reason}`, descriptionDecision.reasonCode);
      await recordOutcome("SKIPPED", {
        reasonCode: descriptionDecision.reasonCode,
        reason: descriptionDecision.reason,
        matchedWord: descriptionDecision.matchedWord || "",
        ...currentJobContext
      });
      recordOutcomeCacheForAliases("SKIPPED", descriptionDecision.reasonCode);
      markJobCardStatus(card, "skipped", descriptionDecision.reasonCode);
      await dismissJobCard(card);
      await reportProgress();
      markSeenForAliases();
      continue;
    }

    let applyAction = await waitForApplyButtonFromDetailPane(settings, 5000, "search card detail");
    if (!applyAction.button && isJobsViewPage()) {
      await debugLog(settings, "Card click navigated to jobs view page");
    }
    if (!applyAction.button) {
      if (anchor) {
        const anchorTarget = anchor.querySelector("span") || anchor;
        const retryClick = await selectJobCardInSearchList(anchorTarget);
        if (retryClick) {
          await sleep(900);
          applyAction = await waitForApplyButtonFromDetailPane(settings, 7000, "search card anchor retry");
          if (applyAction.button) {
            await debugLog(settings, "Apply button found after anchor retry click", {
              type: applyAction.type
            });
          }
        }
      }
    }
    if (!applyAction.button) {
      await sleep(650);
      applyAction = await waitForApplyButtonFromDetailPane(settings, 3200, "search card settle retry");
    }
    if (!applyAction.button) {
      await refreshKnownAppliedJobIds(true);
      const appliedAlias =
        Array.from(jobAliasKeys).find((alias) => knownAppliedJobIds.has(alias)) || detectAppliedInDetailPane();
      if (appliedAlias) {
        classifyExhaustedCandidate();
        runStats.skipped += 1;
        await logOutcome("info", "Skipped (already applied earlier)", "APPLIED_CACHE_HIT");
        await recordOutcome("SKIPPED", {
          reasonCode: "APPLIED_CACHE_HIT",
          reason: "Re-checked after missing apply button; job already applied",
          ...currentJobContext
        });
        recordOutcomeCacheForAliases("SKIPPED", "ALREADY_APPLIED");
        markAppliedForAliases();
        markJobCardStatus(card, "skipped", "Already Applied");
        await reportProgress();
        markSeenForAliases();
        continue;
      }
      if (hasDailyEasyApplyLimitSignal()) {
        await pauseRunForDailyEasyApplyLimit(settings);
        return false;
      }
      classifyActionableCandidate();
      await debugLog(settings, "No detail apply button found", {
        detailRoots: document.querySelectorAll(".jobs-search__job-details, .jobs-details, .jobs-unified-top-card, .jobs-details-top-card, .scaffold-layout__detail").length,
        applyButtonsVisible: document.querySelectorAll("button.jobs-apply-button, .jobs-s-apply button").length
      });
      runStats.skipped += 1;
      await logOutcome("warn", "Skipped (no Easy Apply button)", "NO_APPLY_BUTTON");
      await recordOutcome("SKIPPED", {
        reasonCode: "NO_APPLY_BUTTON",
        reason: "No apply button found in job detail pane",
        ...currentJobContext
      });
      recordOutcomeCacheForAliases("SKIPPED", "NO_APPLY_BUTTON");
      markJobCardStatus(card, "skipped", "No Easy Apply");
      await dismissJobCard(card);
      await reportProgress();
      markSeenForAliases();
      continue;
    }
    // The card says "Easy Apply" but the details pane shows an external Apply link: the pane is most
    // likely still showing the previous job. Open this card again and re-read before believing it.
    if (applyAction.type === "external" && hasEasyApplySignalOnCard(card)) {
      for (let recheck = 1; recheck <= 2 && applyAction.type === "external"; recheck += 1) {
        captureDebugEvent("cycle", "EXTERNAL_CONFLICT", {
          recheck,
          jobKey,
          urlJobId: extractLinkedInJobIdFromUrl(window.location.href),
          title,
          paneHeading: globalThis.CPLinkedInDom?.jobHeading?.(globalThis.CPLinkedInDom?.findDetailPane?.().element) || "",
          buttonLabel: String(applyAction.button?.getAttribute?.("aria-label") || applyAction.button?.textContent || "").trim().slice(0, 60),
        });
        await logLine(`"${title.slice(0, 50)}" shows Easy Apply on the card but the pane says external. Re-checking (${recheck}/2)...`, "info");
        await selectJobCardInSearchList(card);
        await sleep(1500);
        applyAction = await waitForApplyButtonFromDetailPane(settings, 5000, "easy-apply badge recheck");
      }
    }
    if (applyAction.type === "external") {
      if (settings.easyApplyOnly) {
        classifyExhaustedCandidate();
        runStats.skipped += 1;
        await logOutcome("warn", "Skipped (external apply)", "EXTERNAL_APPLY_ONLY");
        await recordOutcome("SKIPPED", {
          reasonCode: "EXTERNAL_APPLY_ONLY",
          reason: "External apply blocked because easyApplyOnly is enabled",
          ...currentJobContext
        });
        recordOutcomeCacheForAliases("SKIPPED", "EXTERNAL_APPLY_ONLY");
        markJobCardStatus(card, "skipped", "External Apply");
        await dismissJobCard(card);
      } else {
        classifyActionableCandidate();
        await resilientClick(applyAction.button, "External Apply");
        runStats.skipped += 1;
        runSearchTermSuccessCount += 1;
        await logOutcome("info", "Opened external apply link (manual completion required)", "EXTERNAL_APPLY_OPENED");
        await recordOutcome("EXTERNAL", {
          reasonCode: "EXTERNAL_APPLY_OPENED",
          reason: "External apply opened",
          ...currentJobContext
        });
        recordOutcomeCacheForAliases("EXTERNAL", "EXTERNAL_APPLY_OPENED");
      }
      await reportProgress();
      markSeenForAliases();
      continue;
    }

    classifyActionableCandidate();
    await clearLeftoverDialogs(settings);
    await resilientClick(applyAction.button, "Easy Apply");
    await botChat("Easy Apply form opened. Analyzing fields...");
    await sleep(300);
    let modal = await waitForModalOpen(3000);
    if (!modal && applyAction?.button && isVisibleElement(applyAction.button)) {
      await resilientClick(applyAction.button, "Easy Apply (retry)");
      modal = await waitForModalOpen(3500);
    }
    if (!modal) {
      if (hasDailyEasyApplyLimitSignal()) {
        captureDebugEvent("cycle", "DAILY_LIMIT_IN_MODAL_WAIT", { jobKey, durationMs: endTimer("runCycle") });
        await pauseRunForDailyEasyApplyLimit(settings);
        return false;
      }
      captureDebugEvent("cycle", "MODAL_NOT_FOUND_ON_CLICK", { jobKey, title: currentJobContext.title, company: currentJobContext.company });
      runStats.skipped += 1;
      await logOutcome("warn", "Skipped: Easy Apply click did not open modal", "MODAL_NOT_FOUND");
      await recordOutcome("SKIPPED", {
        reasonCode: "MODAL_NOT_FOUND",
        reason: "Easy Apply modal not found",
        ...currentJobContext
      });
      recordOutcomeCacheForAliases("SKIPPED", "MODAL_NOT_FOUND");
      markJobCardStatus(card, "skipped", "MODAL_NOT_FOUND");
      await dismissJobCard(card);
      await reportProgress();
      markSeenForAliases();
      continue;
    }
    await sleep(400);
    const result = await processEasyApplyModal(settings);
    captureDebugEvent("cycle", "CARD_MODAL_RESULT", {
      jobKey,
      title: currentJobContext.title,
      company: currentJobContext.company,
      submitted: result.submitted,
      skipped: result.skipped,
      reachedSubmit: result.reachedSubmit,
      reason: result.reason || ""
    });
    await debugLog(settings, "Modal result", result);
    if (result.submitted || (settings.dryRun && result.reachedSubmit)) {
      runStats.applied += 1;
      runSearchTermSuccessCount += 1;
      exhaustedSearchPageStreak = 0;
      markJobCardStatus(card, "applied", "Applied");
      await recordOutcome("APPLIED", {
        reasonCode: settings.dryRun ? "DRY_RUN_REACHED_SUBMIT" : "SUBMITTED",
        reason: settings.dryRun ? "Dry-run reached submit stage" : "Application submitted",
        ...currentJobContext
      });
      recordOutcomeCacheForAliases("APPLIED", "SUBMITTED");
      markAppliedForAliases();
      await dismissJobCard(card);
    } else if (result.skipped) {
      runStats.skipped += 1;
      const skipReason = result.reason || "Easy Apply modal could not reach submit stage";
      const reasonNorm = normalizeLabel(skipReason);
      const reasonCode = reasonNorm.includes("resume is required")
        ? "RESUME_REQUIRED"
        : reasonNorm.includes("valid phone")
        ? "VALIDATION_BLOCKED_PHONE"
        : (reasonNorm.includes("required") || reasonNorm.includes("selection"))
          ? "PENDING_USER_INPUT"
          : "SUBMIT_NOT_REACHED";
      markJobCardStatus(card, "skipped", reasonCode);
      await logOutcome("warn", `Skipped: ${skipReason}`, reasonCode);
      // Exactly where the form was when we gave up, so every skip can be explained.
      const skipState = describeModalState(getActiveModal());
      const blockers = describeStepBlockers(getActiveModal());
      captureDebugEvent("cycle", "SKIP_DETAILS", { jobKey, reason: skipReason, reasonCode, ...skipState, blockers });
      await logLine(`Skip details: ${summarizeModalState(skipState)}`, "info");
      if (blockers.length) {
        await logLine(
          `Fields still empty or invalid: ${blockers.map((b) => `"${b.label.slice(0, 45)}" [${b.type}${b.inputType ? `/${b.inputType}` : ""}] = "${b.value}"${b.message ? ` (${b.message})` : ""}`).join("; ")}`,
          "warn"
        );
      }
      await recordOutcome("SKIPPED", {
        reasonCode,
        reason: skipReason,
        ...currentJobContext
      });
      recordOutcomeCacheForAliases("SKIPPED", reasonCode);
      await closePostSubmitUi(settings, { discardDraft: true });
      await dismissJobCard(card);
    } else {
      runStats.failed += 1;
      const failReason = result.reason || "Failed to process easy apply modal";
      markJobCardStatus(card, "skipped", "MODAL_FLOW_ERROR");
      await logOutcome("error", `Failed: ${failReason}`, "MODAL_FLOW_ERROR");
      await recordOutcome("FAILED", {
        reasonCode: "MODAL_FLOW_ERROR",
        reason: failReason,
        ...currentJobContext
      });
      recordOutcomeCacheForAliases("FAILED", "MODAL_FLOW_ERROR");
      await closePostSubmitUi(settings, { discardDraft: true });
      await dismissJobCard(card);
    }
    await reportProgress();
    markSeenForAliases();
    await sleep(900);
  }

  const exhaustedResultsPage =
    cycleConsideredCandidates > 0 &&
    cycleExhaustedCandidates === cycleConsideredCandidates &&
    !cycleHadActionableCandidate &&
    runStats.applied === cycleStartApplied;
  if (exhaustedResultsPage) {
    exhaustedSearchPageStreak += 1;
    await debugLog(settings, "Exhausted results page detected", {
      streak: exhaustedSearchPageStreak,
      considered: cycleConsideredCandidates,
      exhausted: cycleExhaustedCandidates,
      url: window.location.href
    });
    if (exhaustedSearchPageStreak >= EXHAUSTED_RESULTS_PAGE_STREAK_LIMIT) {
      exhaustedSearchPageStreak = 0;
      const movedToNextTerm = await rotateSearchTerm(settings);
      if (movedToNextTerm) return true;
      await logLine("All search keywords and result pages exhausted. Stopping run.", "info");
      await sendMessage({ type: "CP_STOP" });
      return false;
    }
  } else if (cycleConsideredCandidates > 0 || runStats.applied !== cycleStartApplied) {
    exhaustedSearchPageStreak = 0;
  }

  // 1. First, paginate to next results page for the CURRENT keyword
  const movedToNextPage = await gotoNextResultsPage(settings);
  if (movedToNextPage) {
    await logLine(`Moving to next results page for keyword "${getCurrentSearchKeyword() || 'current'}"...`, "info");
    return true;
  }

  // 2. Only when ALL pages for the current keyword are fully exhausted, rotate to the NEXT keyword in sequence
  const movedToNextTerm = await rotateSearchTerm(settings);
  if (movedToNextTerm) {
    exhaustedSearchPageStreak = 0;
    return true;
  }

  captureDebugEvent("cycle", "CYCLE_END_NO_MORE_PAGES", {
    durationMs: endTimer("runCycle"),
    applied: runStats.applied,
    skipped: runStats.skipped,
    failed: runStats.failed
  });
  await logLine("All search keywords and result pages exhausted. Run complete.", "info");
  await sendMessage({ type: "CP_STOP" });
  return false;
}
