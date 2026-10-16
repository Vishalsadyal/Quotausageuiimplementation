/*
 * LinkedIn Jobs auto-apply - part 26: easy-apply-flow
 *
 * processEasyApplyModal: walks the Easy Apply steps (fill, Next/Review, Submit, stop on unknown
 * questions).
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

async function processEasyApplyModal(settings) {
  startTimer("processEasyApplyModal");
  await botChat("Processing application form. Filling in your details...");
  // "let": LinkedIn can re-render the form between steps, so it is looked up again each step.
  let modal = getActiveModal();
  if (!modal) {
    captureDebugEvent("modal", "MODAL_NOT_FOUND", { page: capturePageSnapshot() });
    return { submitted: false, skipped: true, reason: "No apply modal found" };
  }

  // The first load regularly takes 5-6 seconds; give it time like a person would.
  const isReady = await waitForModalReady(modal, 15000);
  if (!isReady) {
    captureDebugEvent("modal", "MODAL_STUCK_LOADING", describeModalState(getActiveModal()));
    await logLine("⚠️ Easy Apply form still loading after 15s. Skipping job...", "warn");
    return { submitted: false, skipped: true, reachedSubmit: false, reason: "Modal stuck loading (spinner timeout)" };
  }

  let activeSettings = {
    ...settings,
    screeningAnswers: { ...(settings?.screeningAnswers || {}) }
  };
  let safety = 0;
  let stagnantSteps = 0;
  const stepStateBySignature = new Map();
  const shouldPauseForInput = settings.pauseAtFailedQuestion !== false;
  const maxStagnantSteps = shouldPauseForInput ? 10 : 6;
  let previousSignature = getModalSignature(modal);
  while (safety < 16) {
    if (!await isRunActive()) {
      captureDebugEvent("modal", "RUN_STOPPED_BY_OPERATOR", { stepAttempt: safety, durationMs: endTimer("processEasyApplyModal") });
      return { submitted: false, skipped: true, reachedSubmit: false, reason: "Run stopped by operator" };
    }
    if (hasDailyEasyApplyLimitSignal(modal) || hasDailyEasyApplyLimitSignal(document)) {
      await pauseRunForDailyEasyApplyLimit(settings);
      return { submitted: false, skipped: true, reachedSubmit: false, reason: "LinkedIn daily Easy Apply limit reached" };
    }
    safety += 1;
    const freshModal = getActiveModal();
    if (freshModal && freshModal !== modal) {
      captureDebugEvent("modal", "MODAL_NODE_REPLACED", { stepAttempt: safety });
      modal = freshModal;
    }
    const questionBlocks = collectQuestionBlocks(modal);
    let changedAny = false;
    const filledThisStep = [];
    const beforeDiagnostics = collectQuestionBlockDiagnostics(modal);
    const unresolvedBefore = beforeDiagnostics.filter((d) => doesQuestionStateNeedAttention(d));
    await debugLog(settings, "Modal step coverage (before fill)", {
      stepAttempt: safety,
      totalBlocks: beforeDiagnostics.length,
      requiredBlocks: beforeDiagnostics.filter((d) => d.required).length,
      unresolvedRequired: unresolvedBefore.length,
      unresolvedFields: unresolvedBefore.slice(0, 10).map((d) => summarizeQuestionBlockState(d))
    });
    for (const block of questionBlocks) {
      const beforeState = settings?.debugMode ? getQuestionBlockState(block) : null;
      const changed = await fillQuestionBlock(block, activeSettings);
      if (changed) changedAny = true;
      if (settings?.debugMode) {
        const afterState = getQuestionBlockState(block);
        if (changed || (beforeState && !beforeState.answered && afterState.answered)) {
          filledThisStep.push(summarizeQuestionBlockState(afterState));
        }
      }
    }
    const todaySelected = await selectTodayDateIfPresent(modal);
    if (todaySelected) {
      changedAny = true;
      filledThisStep.push("date|required|answered|date picker -> today");
    }
    const consentChecked = await applySubmitConsentCheckboxes(modal, activeSettings);
    if (consentChecked) {
      changedAny = true;
      filledThisStep.push("checkbox|required|answered|submit consent");
    }
    const afterDiagnostics = collectQuestionBlockDiagnostics(modal);
    const unresolvedAfter = afterDiagnostics.filter((d) => doesQuestionStateNeedAttention(d));
    const unresolvedImproved = unresolvedAfter.length < unresolvedBefore.length;
    const unresolvedKnownAfter = unresolvedAfter.filter((d) => d.type !== "unknown");
    const unresolvedUnknownOnly = unresolvedAfter.length > 0 && unresolvedKnownAfter.length === 0;
    await debugLog(settings, "Modal step coverage (after fill)", {
      stepAttempt: safety,
      changedAny,
      filledThisStep: filledThisStep.slice(0, 12),
      totalBlocks: afterDiagnostics.length,
      requiredBlocks: afterDiagnostics.filter((d) => d.required).length,
      unresolvedRequired: unresolvedAfter.length,
      unresolvedFields: unresolvedAfter.slice(0, 12).map((d) => summarizeQuestionBlockState(d))
    });

    const stepSignature = getModalSignature(modal);
    const stepState = stepStateBySignature.get(stepSignature) || { preflightAttempts: 0, nextClicks: 0, manualAnswerWaits: 0 };
    const modalValidationBeforeActionRaw = getModalValidationMessageRaw(modal);
    const modalValidationBeforeAction = normalizeLabel(modalValidationBeforeActionRaw);
    const hasVisibleSubmit = Boolean(findSubmitButton(modal));
    const hasVisibleNext = Boolean(findNextOrReviewButton(modal, { includeDisabled: true }));
    const hasVisibleDone = Boolean(findDoneOrCloseButton(modal));

    await debugLog(settings, "Modal step plan", {
      stepAttempt: safety,
      signature: truncateDebugText(stepSignature, 120),
      preflightAttempts: stepState.preflightAttempts,
      nextClicks: stepState.nextClicks,
      manualAnswerWaits: stepState.manualAnswerWaits,
      unresolvedRequired: unresolvedAfter.length,
      unresolvedUnknownOnly,
      hasVisibleNext,
      hasVisibleSubmit,
      hasVisibleDone,
      validation: modalValidationBeforeAction || ""
    });

    // Progressive 4-Stage Resolution for Unresolved Required Questions
    if (unresolvedAfter.length > 0 && !unresolvedUnknownOnly) {
      if (changedAny && unresolvedImproved) {
        stepState.preflightAttempts += 1;
        stepStateBySignature.set(stepSignature, stepState);
        await debugLog(settings, "Preflight waiting after detected field updates", {
          preflightAttempts: stepState.preflightAttempts,
          unresolvedRequired: unresolvedAfter.length,
          unresolvedImproved
        });
        previousSignature = stepSignature;
        await sleep(Math.min(700, Math.floor(STEP_DELAY_MS * 0.7)));
        continue;
      }

      // ── TIER 0: next-ranked answer for fields LinkedIn rejected (answer bank, then AI alternatives) ──
      const retriedFields = await retryRejectedAnswers(modal, activeSettings);
      if (retriedFields > 0) {
        stepState.preflightAttempts += 1;
        stepStateBySignature.set(stepSignature, stepState);
        previousSignature = getModalSignature(modal);
        await sleep(Math.min(700, Math.floor(STEP_DELAY_MS * 0.7)));
        continue;
      }

      // ── TIER 1: Ask the user, in the panel first (the dashboard still works), wait up to 3 minutes ──
      // Asked again (up to 3 times a step) when LinkedIn rejects an answer, so the user sees its message.
      if (stepState.manualAnswerWaits < 3 && shouldPauseForInput) {
        const pendingQuestions = buildPendingQuestionsFromDiagnostics(unresolvedAfter, modalValidationBeforeActionRaw);
        if (pendingQuestions.length > 0) {
          await sendMessage({ type: "CP_REGISTER_PENDING_QUESTIONS", questions: pendingQuestions });
          const firstLabel = pendingQuestions[0].questionLabel || "Required field";
          await logLine(
            `⏳ Unresolved question: "${firstLabel.slice(0, 55)}". Answer it in this panel (or in the Dashboard). Waiting 3 minutes...`,
            "warn"
          );
          stepState.manualAnswerWaits += 1;
          stepStateBySignature.set(stepSignature, stepState);

          // Both run together: whichever answer comes first wins.
          const dashboardWait = waitForPendingAnswersFromSettings(pendingQuestions, 180000, 1500).catch(() => ({ ok: false, screeningAnswers: {} }));
          const asked = await Promise.race([
            askQuestionsInPanel(modal, pendingQuestions, activeSettings, 180000),
            dashboardWait.then((r) => (r.ok ? { result: "dashboard-answered", answers: {} } : new Promise(() => {}))),
          ]);
          if (asked.result === "answered") {
            for (const [key, value] of Object.entries(asked.answers || {})) {
              activeSettings.screeningAnswers[key] = value;
              const pq = pendingQuestions.find((item) => item.questionKey === key);
              if (pq) activeSettings.screeningAnswers[normalizeLabel(pq.questionLabel)] = value;
            }
            await logLine("✅ Got your answer in the panel. Continuing...", "info");
            for (const block of questionBlocks) {
              await fillQuestionBlock(block, activeSettings);
            }
            previousSignature = getModalSignature(modal);
            await sleep(350);
            continue;
          }
          cancelPanelAsk();
          const waitResult = await dashboardWait;
          if (waitResult.ok) {
            activeSettings.screeningAnswers = { ...activeSettings.screeningAnswers, ...waitResult.screeningAnswers };
            await logLine("✅ Received user answers from Dashboard! Applying to form...", "info");
            for (const block of questionBlocks) {
              await fillQuestionBlock(block, activeSettings);
            }
            previousSignature = getModalSignature(modal);
            await sleep(350);
            continue;
          } else {
            await logLine("⏱️ 3-minute dashboard wait elapsed. Attempting AI contextual & resume relation matching...", "info");
          }
        }
      }

      // ── TIER 2: Contextual AI & Resume Relationship Match ──
      let aiResolvedAny = false;
      for (const block of questionBlocks) {
        const state = getQuestionBlockState(block);
        if (state && doesQuestionStateNeedAttention(state)) {
          const aiLabel = state.label || getQuestionLabel(block);
          if (aiLabel) {
            const aiAnswer = await requestAiAnswer(aiLabel, state.type, state.options || [], modalValidationBeforeActionRaw);
            if (aiAnswer) {
              activeSettings.screeningAnswers[questionKeyFromLabel(aiLabel)] = aiAnswer;
              activeSettings.screeningAnswers[normalizeLabel(aiLabel)] = aiAnswer;
              const changed = await fillQuestionBlock(block, activeSettings);
              if (changed) {
                aiResolvedAny = true;
                await logLine(`🤖 AI Auto-Answered from Resume: "${aiLabel.slice(0, 45)}" ➔ ${aiAnswer}`, "info");
              }
            }
          }
        }
      }

      if (aiResolvedAny) {
        stagnantSteps = 0;
        previousSignature = getModalSignature(modal);
        await sleep(350);
        continue;
      }

      // ── TIER 3: Fallback / Positive Match / Default Valid Selection ──
      const preflightAggressiveFill = await forceAnswerModalQuestions(modal, activeSettings);
      const preflightAutoFixed = await attemptValidationAutoFix(modal, activeSettings);
      if (preflightAggressiveFill || preflightAutoFixed) {
        stepState.preflightAttempts += 1;
        stepStateBySignature.set(stepSignature, stepState);
        await logLine("Applied best fallback option for remaining required fields.", "warn");
        previousSignature = getModalSignature(modal);
        await sleep(Math.min(700, Math.floor(STEP_DELAY_MS * 0.7)));
        continue;
      }

      // ── TIER 4: Preflight DOM registration pass ──
      stepState.preflightAttempts += 1;
      stepStateBySignature.set(stepSignature, stepState);
      if (stepState.preflightAttempts <= 2) {
        previousSignature = stepSignature;
        await sleep(Math.min(700, Math.floor(STEP_DELAY_MS * 0.7)));
        continue;
      }
    } else if (unresolvedUnknownOnly) {
      await debugLog(settings, "Unresolved fields are unknown type; proceeding to action button to trigger explicit validation", {
        unresolvedRequired: unresolvedAfter.length,
        unresolvedFields: unresolvedAfter.slice(0, 8).map((d) => summarizeQuestionBlockState(d))
      });
    }

    const submitBtn = findSubmitButton(modal);
    if (submitBtn) {
      await applyFollowCompanyPreference(modal, activeSettings);
      if (!settings.dryRun && settings.pauseBeforeSubmit) {
        await logLine("Paused before submit. Review the form, submit manually, then resume run.", "warn");
        captureDebugEvent("modal", "PAUSED_BEFORE_SUBMIT", { stepAttempt: safety, reason: "pauseBeforeSubmit", durationMs: endTimer("processEasyApplyModal") });
        await sendMessage({ type: "CP_PAUSE" });
        return {
          submitted: false,
          skipped: true,
          reachedSubmit: true,
          reason: "Paused before submit for manual review"
        };
      }
      if (!settings.dryRun && !settings.autoSubmit) {
        await logLine("Auto-submit is OFF. Paused at submit step. Submit manually, then resume run.", "warn");
        captureDebugEvent("modal", "AUTO_SUBMIT_DISABLED", { stepAttempt: safety, durationMs: endTimer("processEasyApplyModal") });
        await sendMessage({ type: "CP_PAUSE" });
        return {
          submitted: false,
          skipped: true,
          reachedSubmit: true,
          reason: "Paused before submit because auto-submit is disabled"
        };
      }
      if (!settings.dryRun && settings.autoSubmit) {
        await botChat("Ready to submit. Verifying all fields...");
        await sleep(500);
        const paced = await enforceSubmitRateLimit(activeSettings);
        if (!paced.ok) {
          captureDebugEvent("modal", "RATE_LIMIT_WAIT_PAUSED", { stepAttempt: safety, durationMs: endTimer("processEasyApplyModal") });
          return {
            submitted: false,
            skipped: true,
            reachedSubmit: true,
            reason: "Run paused/stopped during rate limit wait"
          };
        }
        const submitSnapshot = snapshotStepAnswers(modal); // remembered as good if the submit goes through
        const clicked = await resilientClick(submitBtn, "Submit");
        lastAutoSubmitAtMs = Date.now();
        writePersistedNumber("cpLastAutoSubmitAtMs", lastAutoSubmitAtMs);
        activeSubmitPaceDelayMs = 0;
        activeSubmitPaceStartMs = 0;
        await sleep(STEP_DELAY_MS);
        // Submitting shows a spinner too; wait for it before judging the result.
        await waitUntil(() => didSubmitComplete(modal) || !isModalLoading(getActiveModal()), 15000, 250);
        const submitCompleted = didSubmitComplete(modal);
        if (submitCompleted) {
          await rememberAcceptedAnswers(submitSnapshot);
          await logLine("Application submitted", "info");
          await botChat("Application submitted successfully! Moving to next opportunity...");
          captureDebugEvent("modal", "SUBMIT_SUCCESS", { stepAttempt: safety, durationMs: endTimer("processEasyApplyModal") });
          // LinkedIn shows "Application sent" a second or two later; close it with Done before moving on.
          await finishPostApplyDialog(settings, 10000);
          await closePostSubmitUi(settings, { discardDraft: false });
          return { submitted: true, skipped: false, reachedSubmit: true };
        }
        const submitValidationRaw = getModalValidationMessageRaw(getActiveModal() || modal);
        const submitValidation = normalizeLabel(submitValidationRaw);
        const unresolvedAfterSubmit = collectQuestionBlockDiagnostics(getActiveModal() || modal)
          .filter((d) => doesQuestionStateNeedAttention(d));
        await debugLog(settings, "Submit click did not complete application", {
          clicked,
          validation: submitValidationRaw || submitValidation,
          unresolvedRequired: unresolvedAfterSubmit.length,
          unresolvedFields: unresolvedAfterSubmit.slice(0, 12).map((d) => summarizeQuestionBlockState(d))
        });
        const submitRetried = await retryRejectedAnswers(getActiveModal() || modal, activeSettings);
        const submitFixedValidation = await attemptValidationAutoFix(getActiveModal() || modal, activeSettings);
        const submitForcedAnswers = await forceAnswerModalQuestions(getActiveModal() || modal, activeSettings);
        if (submitRetried || submitFixedValidation || submitForcedAnswers) {
          await logLine("Submit was blocked. Filled remaining fields and retrying submit.", "warn");
          captureDebugEvent("modal", "SUBMIT_RETRY_AFTER_FIX", { stepAttempt: safety, fixedValidation: submitFixedValidation, forcedAnswers: submitForcedAnswers });
          stagnantSteps = 0;
          previousSignature = getModalSignature(getActiveModal() || modal);
          continue;
        }
        return {
          submitted: false,
          skipped: true,
          reachedSubmit: true,
          reason: submitValidationRaw || submitValidation || "Submit click did not complete application"
        };
      }
      captureDebugEvent("modal", "DRY_RUN_REACHED_SUBMIT", { stepAttempt: safety, durationMs: endTimer("processEasyApplyModal") });
      await logLine("Dry-run: reached submit step (not submitting). Use 'start live' to submit for real.", "warn");
      await botChat("Dry run complete for this job. Form filled successfully.");
      await closePostSubmitUi(settings, { discardDraft: true });
      return { submitted: false, skipped: false, reachedSubmit: true };
    }

    let nextBtn = findNextOrReviewButton(modal);
    if (!nextBtn && isModalLoading(modal)) {
      // Buttons are hidden while LinkedIn is loading; wait instead of giving up on the job.
      const settledAgain = await waitForModalStepSettled(getModalSignature(modal));
      captureDebugEvent("modal", "WAITED_FOR_SPINNER_BEFORE_NEXT", { stepAttempt: safety, waitedMs: settledAgain.waitedMs, timedOut: settledAgain.timedOut });
      if (settledAgain.modal) modal = settledAgain.modal;
      nextBtn = findNextOrReviewButton(modal);
    }
    if (!nextBtn) {
      const blockedNextBtn = findNextOrReviewButton(modal, { includeDisabled: true });
      if (blockedNextBtn) {
        const validationRaw = getModalValidationMessageRaw(modal);
        const blockedRetried = await retryRejectedAnswers(modal, activeSettings);
        const blockedFixedValidation = await attemptValidationAutoFix(modal, activeSettings);
        const blockedForcedAnswers = await forceAnswerModalQuestions(modal, activeSettings);
        if (blockedRetried || blockedFixedValidation || blockedForcedAnswers) {
          await logLine("Next step was blocked. Filled remaining fields and retrying.", "warn");
          captureDebugEvent("modal", "NEXT_BLOCKED_RETRY", { stepAttempt: safety });
          stagnantSteps = 0;
          previousSignature = getModalSignature(modal);
          continue;
        }
        return {
          submitted: false,
          skipped: true,
          reachedSubmit: false,
          reason: validationRaw || "Next/review button is disabled"
        };
      }
      // Only a real "Done" button means the application finished. The form's X ("Dismiss")
      // is always present; clicking it here closed live forms and counted them as submitted.
      const doneBtn = findModalButtonByIncludes(modal, ["done"]);
      if (doneBtn) {
        captureDebugEvent("modal", "DONE_CLOSE_CLICKED", { stepAttempt: safety, durationMs: endTimer("processEasyApplyModal") });
        await resilientClick(doneBtn, "Done/Close");
        return {
          submitted: Boolean(settings.autoSubmit && !settings.dryRun),
          skipped: false,
          reachedSubmit: true
        };
      }
      const validationRaw = getModalValidationMessageRaw(modal);
      captureDebugEvent("modal", "NO_ACTION_BUTTON", {
        stepAttempt: safety,
        hasVisibleSubmit: Boolean(findSubmitButton(modal)),
        validation: validationRaw || "",
        durationMs: endTimer("processEasyApplyModal"),
        modalState: describeModalState(modal),
        buttons: Array.from(modal.querySelectorAll("button")).filter((b) => isVisibleElement(b)).map((b) => normalizeLabel(b.textContent || b.getAttribute("aria-label") || "").slice(0, 30)),
        ...capturePageSnapshot()
      });
      return {
        submitted: false,
        skipped: true,
        reachedSubmit: false,
        reason: validationRaw ? `No next/review button. Validation: ${validationRaw}` : "No next/review button"
      };
    }

    await debugLog(settings, "Clicking modal action", {
      text: normalizeLabel(nextBtn.textContent || ""),
      ariaLabel: normalizeLabel(nextBtn.getAttribute("aria-label") || ""),
      disabled: Boolean(nextBtn.disabled)
    });
    stepState.nextClicks += 1;
    stepStateBySignature.set(stepSignature, stepState);
    const stepSnapshot = snapshotStepAnswers(modal); // remembered as good if LinkedIn accepts the step
    if (!await resilientClick(nextBtn, "Next/Review")) break;
    // Like a person: wait for LinkedIn's spinner to finish before looking at the next step.
    const settled = await waitForModalStepSettled(previousSignature);
    captureDebugEvent("modal", "NEXT_CLICK_SETTLED", {
      stepAttempt: safety,
      waitedMs: settled.waitedMs,
      sawSpinner: settled.sawLoading,
      timedOut: settled.timedOut,
      savePrompt: settled.savePrompt,
      formClosed: !settled.modal,
    });
    if (settled.sawLoading || settled.timedOut) {
      await debugLog(settings, "Waited for LinkedIn after Next", { waitedMs: settled.waitedMs, timedOut: settled.timedOut });
    }
    if (settled.modal) modal = settled.modal;

    const currentSignature = getModalSignature(modal);
    const stepAccepted = currentSignature !== previousSignature && !getModalValidationMessageRaw(modal);
    if (stepAccepted || !settled.modal) await rememberAcceptedAnswers(stepSnapshot);
    const autoFixed = await attemptValidationAutoFix(modal, activeSettings);
    // Same step again = LinkedIn rejected something: try the next-ranked answer for those fields.
    const retriedAfterNext = currentSignature === previousSignature ? await retryRejectedAnswers(modal, activeSettings) : 0;
    if (!changedAny && !autoFixed && !retriedAfterNext && currentSignature === previousSignature) {
      stagnantSteps += 1;
      const validationRaw = getModalValidationMessageRaw(modal);
      const validation = normalizeLabel(validationRaw);
      const postClickDiagnostics = collectQuestionBlockDiagnostics(modal);
      const unresolvedPostClick = postClickDiagnostics.filter((d) => doesQuestionStateNeedAttention(d));
      await debugLog(settings, "No modal progress detected", {
        stagnantSteps,
        validation: validationRaw || validation,
        unresolvedRequired: unresolvedPostClick.length,
        unresolvedFields: unresolvedPostClick.slice(0, 12).map((d) => summarizeQuestionBlockState(d))
      });
      if (stagnantSteps >= 2) {
        const aggressiveChanged = await forceAnswerModalQuestions(modal, activeSettings);
        if (aggressiveChanged) {
          await logLine("Applied aggressive fallback answers and retrying next step.", "warn");
          stagnantSteps = 0;
          previousSignature = getModalSignature(modal);
          continue;
        }
      }
      if (stagnantSteps >= maxStagnantSteps) {
        const validationNorm = normalizeLabel(validationRaw || validation || "");
        const blockedDiagnostics = collectQuestionBlockDiagnostics(modal);
        const unresolvedBlocked = blockedDiagnostics.filter((d) => doesQuestionStateNeedAttention(d));
        await debugLog(settings, "Modal blocked at step", {
          stagnantSteps,
          validation: validationRaw || validation,
          unresolvedRequired: unresolvedBlocked.length,
          unresolvedFields: unresolvedBlocked.slice(0, 16).map((d) => summarizeQuestionBlockState(d))
        });
        if (validationNorm.includes("resume") && validationNorm.includes("required")) {
          captureDebugEvent("modal", "RESUME_REQUIRED", { stepAttempt: safety, validation: validationRaw || "", durationMs: endTimer("processEasyApplyModal") });
          if (shouldPauseForInput) {
            await sendMessage({
              type: "CP_REGISTER_PENDING_QUESTIONS",
              questions: [
                {
                  questionKey: "resume_upload_required",
                  questionLabel: "LinkedIn resume upload required",
                  validationMessage:
                    "A resume is required. Upload resume in LinkedIn Easy Apply profile. Copilot will auto-pick the latest attached resume after you resume."
                }
              ]
            });
            await logLine(
              "Resume required: upload resume in LinkedIn Easy Apply profile, then resume run. Copilot will auto-pick the latest attached resume.",
              "warn"
            );
            await sendMessage({ type: "CP_PAUSE" });
          } else {
            await logLine("Resume required and pause-at-failed-question is disabled. Skipping job.", "warn");
          }
          return {
            submitted: false,
            skipped: true,
            reachedSubmit: false,
            reason: "a resume is required"
          };
        }

        const unanswered = buildPendingQuestionsFromValidation(modal, validationRaw || "Required field answer missing");
        if (unanswered.length) {
          await sendMessage({ type: "CP_REGISTER_PENDING_QUESTIONS", questions: unanswered });
          await logLine("Unresolved required fields after all retry tiers. Skipping to next job...", "warn");
        }
        captureDebugEvent("modal", "UNANSWERED_FIELDS_SKIPPED", {
          stepAttempt: safety,
          stagnantSteps,
          validation: validationRaw || validation || "",
          unansweredCount: unanswered.length,
          durationMs: endTimer("processEasyApplyModal")
        });
        return {
          submitted: false,
          skipped: true,
          reachedSubmit: false,
          reason: validationRaw || validation || "Could not progress modal (likely unanswered required field)"
        };
      }
    } else {
      stagnantSteps = 0;
    }
    previousSignature = currentSignature;
  }

  captureDebugEvent("modal", "LOOP_EXHAUSTED", { totalSteps: safety, durationMs: endTimer("processEasyApplyModal") });
  return { submitted: false, skipped: true, reachedSubmit: false, reason: "Could not reach submit step" };
}
