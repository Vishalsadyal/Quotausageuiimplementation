/*
 * LinkedIn Jobs auto-apply - part 28: run-loop
 *
 * runAutomationLoop (cycles, page/term rotation, no-progress guard) and state polling from the
 * background worker.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

async function runAutomationLoop() {
  if (runningLoop) return;
  runningLoop = true;
  try {
    const boot = await getBootstrap();
    dailyLimitHandledRunId = "";
    exhaustedSearchPageStreak = 0;
    runSeenJobKeys = loadRunSeenJobKeys(boot?.state?.startedAt || "");
    runStats = {
      applied: Number(boot.state.applied || 0),
      skipped: Number(boot.state.skipped || 0),
      failed: Number(boot.state.failed || 0)
    };
    await refreshKnownAppliedJobIds(true);
    let lastProgressAt = Date.now();
    let noProgressCycles = 0;
    let noProgressRecoveries = 0;
    let lastProgressMarker = `${runStats.applied}|${runStats.skipped}|${runStats.failed}`;
    await logLine("Automation engine initialized");
    startCardPaintObserver();
    await botChat("AI Copilot engaged. Scanning for opportunities...");

    let guard = 0;
    while (guard < 200) {
      guard += 1;
      const { state, settings } = await getBootstrap();
      if (!state.running || state.paused) break;

      if (state.startedAt && state.startedAt !== lastRunStartedAt) {
        lastRunStartedAt = state.startedAt;
        const terms = getConfiguredSearchTerms(settings);
        captureDebugEvent("run", "RUN_START", {
          startedAt: state.startedAt,
          dryRun: settings.dryRun,
          autoSubmit: settings.autoSubmit,
          easyApplyOnly: settings.easyApplyOnly,
          searchTerms: terms,
          searchLocation: settings.searchLocation || "",
          currentCity: settings.currentCity || "",
          maxApplicationsPerRun: settings.maxApplicationsPerRun || 3,
          submitRateMinSec: settings.submitRateMinSec,
          submitRateMaxSec: settings.submitRateMaxSec,
          pauseBeforeSubmit: settings.pauseBeforeSubmit,
          pauseAtFailedQuestion: settings.pauseAtFailedQuestion,
          filterLocations: settings.filterLocations || [],
          datePosted: settings.datePosted || "",
          sortBy: settings.sortBy || "",
          debugMode: settings.debugMode || false,
          runNonStop: settings.runNonStop || false,
        });
        dailyLimitHandledRunId = "";
        runSeenJobKeys = loadRunSeenJobKeys(lastRunStartedAt);
        await refreshKnownAppliedJobIds(true);
        resumeChoiceCache.clear();
        runSearchTermSuccessCount = 0;
        resetRemoteLocationKeywordCursor();
        currentJobContext = {
          title: "",
          company: "",
          workLocation: "",
          description: "",
          aboutCompany: "",
          jobId: "",
          jobUrl: ""
        };
        exhaustedSearchPageStreak = 0;
        if (terms.length > 0) {
          runSearchTermCursor = settings.randomizeSearchOrder
            ? Math.floor(Math.random() * terms.length)
            : 0;
        } else {
          runSearchTermCursor = 0;
        }
        lastProgressAt = Date.now();
        noProgressCycles = 0;
        lastProgressMarker = `${runStats.applied}|${runStats.skipped}|${runStats.failed}`;
      }

      const maxPerRun = Number(settings.maxApplicationsPerRun || 3);
      if (runStats.applied >= maxPerRun) {
        if (settings.runNonStop) {
          const settingsPatch = {};
          if (settings.cycleDatePosted) {
            settingsPatch.datePosted = getNextDatePostedValue(settings.datePosted, settings.stopDateCycleAt24hr !== false);
          }
          if (settings.alternateSortBy) {
            settingsPatch.sortBy = getAlternateSortValue(settings.sortBy);
          }
          if (Object.keys(settingsPatch).length > 0) {
            await sendMessage({ type: "CP_SAVE_SETTINGS", settings: settingsPatch });
            await logLine(
              `Starting next cycle with date "${settingsPatch.datePosted || settings.datePosted}" and sort "${settingsPatch.sortBy || settings.sortBy}".`,
              "info"
            );
          } else {
            await logLine("Starting next non-stop cycle.", "info");
          }
          runStats = { applied: 0, skipped: 0, failed: 0 };
          dailyLimitHandledRunId = "";
          exhaustedSearchPageStreak = 0;
          clearSeenJobsForRun(lastRunStartedAt);
          resumeChoiceCache.clear();
          aiAnswerCache.clear();
          runSearchTermSuccessCount = 0;
          resetRemoteLocationKeywordCursor();
          preparedRun = false;
          await reportProgress();
          continue;
        }
        await logLine("Max applications reached. Stopping run.");
        await sendMessage({ type: "CP_STOP" });
        break;
      }
      if (!preparedRun) {
        const ok = await prepareRun(settings);
        if (!ok) break;
      }
      const beforeMarker = `${runStats.applied}|${runStats.skipped}|${runStats.failed}`;
      const cycled = await runCycle(settings);
      const afterMarker = `${runStats.applied}|${runStats.skipped}|${runStats.failed}`;
      if (afterMarker !== beforeMarker) {
        lastProgressAt = Date.now();
        noProgressCycles = 0;
        lastProgressMarker = afterMarker;
      } else {
        noProgressCycles += 1;
        if (noProgressCycles % 5 === 0) {
          await debugLog(settings, "No progress cycle", {
            noProgressCycles,
            elapsedMs: Date.now() - lastProgressAt,
            marker: lastProgressMarker
          });
        }
      }

      const noProgressElapsedMs = Date.now() - lastProgressAt;
      if (noProgressCycles >= NO_PROGRESS_MAX_CYCLES || noProgressElapsedMs >= NO_PROGRESS_TIMEOUT_MS) {
        noProgressRecoveries += 1;
        await logLine(
          `No progress for ${Math.round(noProgressElapsedMs / 1000)}s. Trying recovery (${noProgressRecoveries}/3)...`,
          "warn"
        );
        await botChat("Stuck on current page. Trying recovery strategy...", "warn");

        const selectorHealth = checkSelectorHealth();
        if (!selectorHealth.ok) {
          await logLine(
            `Selector health warning: cards=${selectorHealth.jobCardCount}, search=${selectorHealth.hasSearchInput}, apply=${selectorHealth.hasApplyButton}. LinkedIn layout may have changed.`,
            "warn"
          );
        }

        // Recovery strategy:
        // 1) If on a job view/post-apply page, force back to search.
        // 2) Try to move to the next results page (scroll-to-pagination + click Next).
        // 3) Rotate search term.
        // 4) As a last resort, reload the current page.
        try {
          if (!isJobsSearchPage()) {
            resetRemoteLocationKeywordCursor();
            window.location.href = getResumableSearchUrl(settings);
            return;
          }
          // Ensure pagination is in view.
          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
          await sleep(1200);
          const moved = (await gotoNextResultsPage(settings)) || (await rotateSearchTerm(settings));
          if (!moved) {
            window.location.reload();
            return;
          }
        } catch {
          window.location.reload();
          return;
        }

        lastProgressAt = Date.now();
        noProgressCycles = 0;
        lastProgressMarker = `${runStats.applied}|${runStats.skipped}|${runStats.failed}`;
        preparedRun = false;

        if (noProgressRecoveries >= 3) {
          await logLine("Recovery attempts exhausted. Stopping run.", "warn");
          await sendMessage({ type: "CP_STOP" });
          break;
        }
        continue;
      }
      if (!cycled && runStats.applied >= maxPerRun) {
        await sendMessage({ type: "CP_STOP" });
        break;
      }
      await sleep(1200);
    }
    if (guard >= 200) {
      await logLine("Safety guard limit reached. Stopping run.", "warn");
      await sendMessage({ type: "CP_STOP" });
    }
  } catch (error) {
    await sendMessage({ type: "CP_SET_ERROR", error: error?.message || String(error) });
  } finally {
    try {
      const prompt = findSaveApplicationPromptModal();
      if (prompt) {
        await dismissSaveApplicationPrompt(prompt);
      }
    } catch {
      // best-effort modal cleanup
    }
    runningLoop = false;
  }
}

async function startStatePolling() {
  while (true) {
    if (!extensionContextAlive) break;
    const boot = await getBootstrap();
    if (!boot || !boot.state) {
      await sleep(STATE_POLL_MS);
      continue;
    }
    renderState(boot.state);
    if (!boot.state.running) {
      preparedRun = false;
      lastRunStartedAt = null;
      exhaustedSearchPageStreak = 0;
      runSearchTermSuccessCount = 0;
      resetRemoteLocationKeywordCursor();
      clearSeenJobsForRun();
      resumeChoiceCache.clear();
      aiAnswerCache.clear();
    }
    if (boot.state.running && !runningLoop) {
      runAutomationLoop().catch((err) => {
        console.error("[CP] Automation loop crashed:", err);
        sendMessage({ type: "CP_SET_ERROR", error: err?.message || String(err) });
      });
    }
    await sleep(STATE_POLL_MS);
  }
}
