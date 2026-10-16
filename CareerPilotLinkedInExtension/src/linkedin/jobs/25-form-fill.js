/*
 * LinkedIn Jobs auto-apply - part 25: form-fill
 *
 * Filling the form: consent checkboxes, years/number/text fallbacks, select and combobox answers,
 * unlabeled blocks, fillQuestionBlock, validation auto-fix.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

function isFollowCompanyCheckbox(input) {
  if (!input) return false;
  const id = normalizeLabel(input.id || "");
  const name = normalizeLabel(input.getAttribute("name") || "");
  const aria = normalizeLabel(input.getAttribute("aria-label") || "");
  if (id.includes("follow-company") || name.includes("follow-company") || aria.includes("follow company")) return true;
  const label = input.closest("label") || (input.id ? document.querySelector(`label[for='${CSS.escape(input.id)}']`) : null);
  const txt = normalizeLabel(label?.textContent || "");
  return txt.includes("follow") && txt.includes("company");
}

function getCheckboxLabel(input, root) {
  if (!input) return "";
  const inline = input.closest("label");
  if (inline) return cleanQuestionLabel(inline.textContent || "");
  if (input.id) {
    const byFor = root?.querySelector(`label[for='${CSS.escape(input.id)}']`) || document.querySelector(`label[for='${CSS.escape(input.id)}']`);
    if (byFor) return cleanQuestionLabel(byFor.textContent || "");
  }
  const container = input.closest("div, li, fieldset, section");
  return cleanQuestionLabel(container?.textContent || "");
}

async function applySubmitConsentCheckboxes(modal, settings) {
  const checkboxes = Array.from(modal.querySelectorAll("input[type='checkbox']")).filter((c) => isVisibleElement(c));
  if (!checkboxes.length) return false;
  let changed = false;
  for (const checkbox of checkboxes) {
    if (isFollowCompanyCheckbox(checkbox)) continue;
    const checked = checkbox.checked || checkbox.getAttribute("aria-checked") === "true";
    if (checked) continue;
    const label = normalizeLabel(getCheckboxLabel(checkbox, modal));
    const isRequired =
      checkbox.required ||
      checkbox.getAttribute("aria-required") === "true" ||
      label.includes("required") ||
      label.includes("i agree") ||
      label.includes("i acknowledge") ||
      label.includes("terms") ||
      label.includes("privacy") ||
      label.includes("employment rights") ||
      label.includes("notice");
    if (!isRequired) continue;
    const clickable =
      (checkbox.id ? modal.querySelector(`label[for='${CSS.escape(checkbox.id)}']`) : null) ||
      checkbox.closest("label") ||
      checkbox;
    const clicked = await resilientClick(clickable, "Consent checkbox");
    if (clicked) {
      changed = true;
      await logLine(`Checked submit consent field: ${label.slice(0, 80) || "required consent"}`);
    }
  }
  return changed;
}

function isCustomEntitySelectionBlock(block) {
  return Boolean(
    getBySelectorList(
      [
        "[data-test-text-entity-list-form-component]",
        "[data-test-form-builder-dropdown-form-component]",
        "[role='combobox']",
        "button[aria-haspopup='listbox']"
      ],
      block
    )
  );
}

function getYearsFallback(settings) {
  const configured = String(settings.yearsOfExperienceAnswer || "").trim();
  if (configured) return configured;
  const fromExperience = Number(settings.currentExperience);
  if (Number.isFinite(fromExperience) && fromExperience >= 0) return String(fromExperience);
  return "1";
}

function isYearsExperienceQuestion(label) {
  const l = normalizeLabel(label);
  return l.includes("year") && l.includes("experience");
}

function getStructuredTextFallback(label, settings) {
  const l = normalizeLabel(label);
  if (!l) return "";

  if (
    l.includes("current company") ||
    l.includes("current employer") ||
    l.includes("employer name") ||
    l.includes("company name")
  ) {
    return String(settings.recentEmployer || "").trim();
  }

  if (
    l.includes("employee referral") ||
    l.includes("provide their name") ||
    l.includes("if so, who")
  ) {
    return "N/A";
  }

  if (
    l.includes("how did you hear") ||
    l.includes("how did you find") ||
    (l.includes("hear") && (l.includes("position") || l.includes("role") || l.includes("job")))
  ) {
    return "LinkedIn";
  }

  if (l.includes("desired compensation") || l.includes("desired salary") || l.includes("desired pay")) {
    return getSalaryAnswer(l, settings) || "Negotiable";
  }

  if (
    (l.includes("earliest") && l.includes("start")) ||
    l.includes("available to start") ||
    l.includes("start working")
  ) {
    const noticeDays = normalizeNumberString(settings.noticePeriodDays);
    if (noticeDays) {
      const n = Number(noticeDays);
      if (Number.isFinite(n) && n <= 7) return "Immediately";
      return `${noticeDays} days`;
    }
    return "Immediately";
  }

  if (
    l.includes("description") ||
    l.includes("describe") ||
    l.includes("summary") ||
    l.includes("about yourself") ||
    l.includes("bio")
  ) {
    return String(settings.linkedinSummary || settings.coverLetter || settings.screeningAnswers?.["description"] || "").trim();
  }

  return "";
}

function shouldUseNumericFallbackForTextInput(label, textInput) {
  const inputType = normalizeLabel(textInput?.getAttribute?.("type") || "");
  const l = normalizeLabel(label);
  // Identity-style numbers are never "years" or counts: leave them empty rather than type a guess
  // (a blank phone field once received the default "1").
  if (/\b(phone|mobile|tel|telephone|contact number|zip|postal|pin ?code)\b/.test(l)) return false;
  if (inputType === "tel") return false;
  if (inputType === "number") return true;
  return (
    l.includes("year") ||
    l.includes("how many") ||
    l.includes("number of") ||
    l.includes("gpa") ||
    l.includes("score")
  );
}

function getSelectRuleAnswer(label, settings, optionsForMatch, currentOptionText = "") {
  const l = normalizeLabel(label);
  if (l.includes("email") && !isMarketingConsentQuestion(l)) {
    return optionsForMatch.find((o) => String(o.text || "").includes("@"))?.text || "";
  }
  if (l.includes("phone country code")) {
    if (!isPlaceholderOptionText(currentOptionText || "")) return currentOptionText;
    return String(settings.phoneCountryCode || "").trim();
  }
  if (l.includes("phone")) {
    if (!isPlaceholderOptionText(currentOptionText || "")) return currentOptionText;
  }
  if (l.includes("visa") || l.includes("sponsorship")) return String(settings.requireVisa || "No").trim();
  if (
    l.includes("citizenship") ||
    l.includes("employment eligibility") ||
    l.includes("work authorization") ||
    (l.includes("authorized") && l.includes("work"))
  ) {
    return String(settings.usCitizenship || "").trim();
  }
  if (l.includes("protected") && l.includes("veteran")) return String(settings.veteranStatus || "").trim();
  if (l.includes("veteran")) return String(settings.veteranStatus || "").trim();
  if (l.includes("disability") || l.includes("handicapped")) return String(settings.disabilityStatus || "").trim();
  if (l.includes("gender") || l.includes("sex")) return String(settings.gender || "").trim();
  if (l.includes("ethnicity") || l.includes("race")) return String(settings.ethnicity || "").trim();
  if (isMarketingConsentQuestion(l)) return String(settings.marketingConsent || "Yes").trim();
  if (l.includes("proficiency")) return "Professional";
  if (l.includes("salary") || l.includes("compensation") || l.includes("ctc") || l.includes("pay")) {
    return getSalaryAnswer(l, settings);
  }
  if (l.includes("country")) return String(settings.country || "").trim();
  if (l.includes("state") || l.includes("province")) return String(settings.stateRegion || "").trim();
  if (l.includes("city")) return normalizeCityAnswer(settings.currentCity, currentJobContext.workLocation);
  if (l.includes("location")) {
    return String(currentJobContext.workLocation || "").trim() || normalizeCityAnswer(settings.currentCity, currentJobContext.workLocation);
  }
  return "";
}

async function applyComboboxOption(block, label, answer, settings) {
  const trigger = getBySelectorList(
    [
      "button[aria-haspopup='listbox']",
      "[role='combobox']",
      "input[role='combobox']",
      ".artdeco-dropdown__trigger"
    ],
    block
  );
  if (!trigger) return false;

  const triggerText = String(trigger.textContent || trigger.value || "").trim();
  // A value LinkedIn already rejected ("Please enter a valid answer") is not a finished answer: redo it.
  const holdsRejectedValue = isQuestionBlockInvalid(block, getQuestionBlockValidationMessage(block));
  if (triggerText && !isPlaceholderOptionText(triggerText) && !String(answer || "").trim() && !holdsRejectedValue) {
    return false;
  }
  if (!settings.overwritePreviousAnswers && triggerText && !isPlaceholderOptionText(triggerText) && !holdsRejectedValue) {
    return false;
  }

  await resilientClick(trigger, "Combobox trigger");
  await sleep(300);

  function collectBlockOptions() {
    const listbox = block.querySelector("[role='listbox']") ||
      trigger.closest("[role='listbox']") ||
      trigger.parentElement?.querySelector("[role='listbox']");
    const scope = listbox || block;
    return Array.from(
      scope.querySelectorAll(
        "[role='option'], li[role='option'], .artdeco-typeahead__result"
      )
    ).filter((el) => isVisibleElement(el));
  }

  function collectAllOptions() {
    const inBlock = collectBlockOptions();
    if (inBlock.length) return inBlock;
    return Array.from(
      document.querySelectorAll(
        "[role='listbox'] [role='option'], [role='option'], .artdeco-typeahead__result, li[role='option']"
      )
    ).filter((el) => isVisibleElement(el));
  }

  let optionEls = collectAllOptions();
  // A search-as-you-type box (like "Location (city)") only lists suggestions after you type into it.
  if (!optionEls.length && trigger.tagName === "INPUT") {
    const typed = String(answer || "").trim() || String(getSelectRuleAnswer(label, settings, [], triggerText) || "").trim();
    if (typed) {
      trigger.focus();
      setNativeValue(trigger, "");
      trigger.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      setNativeValue(trigger, typed);
      trigger.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      trigger.dispatchEvent(new KeyboardEvent("keyup", { key: typed.slice(-1), bubbles: true }));
      await sleep(1000);
      optionEls = collectAllOptions();
    }
  }

  const optionsForMatch = optionEls
    .map((el) => ({
      text: String(el.textContent || "").trim(),
      value: String(el.getAttribute("data-value") || ""),
      el
    }))
    .filter((o) => Boolean(o.text));
  if (!optionsForMatch.length) return false;

  let resolvedAnswer = String(answer || "").trim();
  if (!resolvedAnswer) {
    resolvedAnswer = getSelectRuleAnswer(label, settings, optionsForMatch, triggerText);
  }
  if (!resolvedAnswer) {
    resolvedAnswer = await requestAiAnswer(label, "select", optionsForMatch.map((o) => o.text), getModalValidationMessage(getActiveModal()));
  }
  const matchedTarget = selectBestOption(optionsForMatch, resolvedAnswer);
  const target = matchedTarget || selectFallbackOption(optionsForMatch, label);
  if (!target?.el) return false;
  if (normalizeLabel(target.text || "") === normalizeLabel(triggerText || "")) return false;

  try {
    target.el.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(120);
  } catch {}
  target.el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, composed: true, view: window }));
  await sleep(60);
  target.el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, composed: true, view: window }));
  await sleep(60);
  target.el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true, view: window }));
  await sleep(350);

  const triggerAfter = getBySelectorList(
    ["button[aria-haspopup='listbox']", "[role='combobox']", "input[role='combobox']", ".artdeco-dropdown__trigger"],
    block
  );
  const triggerAfterText = String(triggerAfter?.textContent || triggerAfter?.value || "").trim();
  const selectionConfirmed = normalizeLabel(triggerAfterText || "") === normalizeLabel(target.text || "");

  if (!selectionConfirmed) {
    try {
      const fallbackTarget = triggerAfter || trigger;
      fallbackTarget.focus();
      await sleep(80);
      fallbackTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await sleep(150);
      fallbackTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await sleep(300);
    } catch {}
  }

  const finalTrigger = getBySelectorList(
    ["button[aria-haspopup='listbox']", "[role='combobox']", "input[role='combobox']", ".artdeco-dropdown__trigger"],
    block
  );
  const finalText = normalizeLabel(String(finalTrigger?.textContent || finalTrigger?.value || "").trim());
  const listboxStillOpen = block.querySelector("[role='listbox'] [role='option']") ||
    document.querySelector("[role='listbox'] [role='option']");

  if (!selectionConfirmed && finalText !== normalizeLabel(target.text || "") && listboxStillOpen) {
    await logLine(`Combobox option did not register for: ${label.slice(0, 60)} (dropdown still open)`, "warn");
    return false;
  }

  await logLine(
    matchedTarget
      ? `Selected combobox option for: ${label.slice(0, 60)}`
      : `Selected combobox fallback for: ${label.slice(0, 60)}`
  );
  return true;
}

async function fillUnlabeledQuestionBlock(block, settings) {
  let changed = false;

  const select = block.querySelector("select");
  if (select) {
    const selected = select.options?.[select.selectedIndex];
    if (selected && !isPlaceholderOptionText(selected.textContent || "")) {
      return changed;
    }
    const options = Array.from(select.options || [])
      .map((o) => ({ text: String(o.textContent || "").trim(), value: String(o.value || "") }))
      .filter((o) => Boolean(o.text));
    const target = selectFallbackOption(options);
    if (target && select.value !== target.value) {
      select.value = target.value;
      select.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await logLine("Selected fallback option for unlabeled required field");
      changed = true;
    }
  }

  const radios = Array.from(block.querySelectorAll("input[type='radio']"));
  if (!changed && radios.length) {
    const options = radios.map((r) => ({
      text: getRadioOptionText(r, block),
      value: String(r.value || ""),
      input: r,
      clickTarget: getRadioClickTarget(r, block)
    }));
    const resumeTarget = getPreferredResumeOption(options, "resume");
    if (resumeTarget) {
      const validationNorm = normalizeLabel(getModalValidationMessage(getActiveModal()) || "");
      const resumeRequired = validationNorm.includes("resume") && validationNorm.includes("required");
      if (!resumeTarget.input?.checked || resumeRequired) {
        const clicked = await resilientClick(resumeTarget.clickTarget || resumeTarget.input, "Resume radio option");
        if (clicked) {
          await sleep(220);
          await logLine("Selected latest resume option for unlabeled required field");
          changed = true;
        }
      } else {
        return changed;
      }
    } else if (!radios.some((r) => r.checked)) {
      const target = selectFallbackOption(options);
      if (target?.input) {
        const clicked = await resilientClick(target.clickTarget || target.input, "Radio fallback option");
        if (clicked) {
          await logLine("Radio fallback answered for unlabeled required field");
          changed = true;
        }
      }
    }
  }

  const textInput = getBySelectorList(
    ["input[type='text']", "input[type='email']", "input[type='tel']", "input[type='number']"],
    block
  );
  if (!changed && textInput) {
    const prev = String(textInput.value || "").trim();
    if (!prev) {
      const inputType = normalizeLabel(textInput.getAttribute("type") || "");
      const answer = inputType === "number" ? getYearsFallback(settings) : "";
      if (answer && prev !== answer) {
        textInput.focus();
        textInput.value = answer;
        textInput.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        textInput.dispatchEvent(new Event("change", { bubbles: true }));
        await logLine("Answered unlabeled required field with fallback value");
        changed = true;
      }
    }
  }

  if (!changed) {
    const dateChanged = await selectTodayDateIfPresent(block);
    if (dateChanged) {
      changed = true;
      return changed;
    }
  }

  if (!changed) {
    const comboLabel = getQuestionLabel(block) || "LinkedIn required selection";
    changed = await applyComboboxOption(block, comboLabel, "", { ...settings, overwritePreviousAnswers: true });
  }

  const checkbox = block.querySelector("input[type='checkbox']");
  if (!changed && checkbox && !checkbox.checked) {
    checkbox.click();
    await logLine("Checkbox selected for unlabeled required field");
    changed = true;
  }

  return changed;
}

async function fillQuestionBlock(block, settings) {
  let changed = false;
  const labelRaw = getQuestionLabel(block);
  const label = normalizeLabel(labelRaw);
  if (!label) {
    return fillUnlabeledQuestionBlock(block, settings);
  }
  {
    const telBefore = block.querySelector("input[type='tel']");
    // LinkedIn pre-fills contact info from the previous application, so a wrong number (e.g. a stray
    // "1" saved by an older run) comes back every time, and "leave filled fields alone" would keep it.
    // The phone saved in the settings is the user's own choice: correct a different value.
    const wantedPhone = normalizePhoneForInput(settings.phoneNumber || "");
    const currentPhone = telBefore ? normalizePhoneForInput(telBefore.value) : "";
    if (telBefore && wantedPhone.length >= 7 && currentPhone !== wantedPhone) {
      telBefore.focus();
      setNativeValue(telBefore, wantedPhone);
      telBefore.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      telBefore.dispatchEvent(new Event("change", { bubbles: true }));
      telBefore.dispatchEvent(new FocusEvent("focusout", { bubbles: true, composed: true }));
      await logLine(`Corrected phone number "${currentPhone || "(empty)"}" -> ${wantedPhone}`);
      return true;
    }
  }
  if (label.includes("date") || label.includes("start date") || label.includes("available start")) {
    const dateChanged = await selectTodayDateIfPresent(block);
    if (dateChanged) return true;
    const dateState = getQuestionBlockState(block);
    if ((dateState.type === "date" || dateState.type === "date-picker") && dateState.answered) {
      return false;
    }
  }
  // Answer engine first (24a-answer-engine.js): typed answers from the local answer bank, dashboard
  // answers, similar questions and profile rules. Only when nothing local fits does the flow below
  // run (AI, then structured fallbacks); the dashboard is asked later by processEasyApplyModal.
  const engine = await fillFromAnswerEngine(block, settings);
  if (engine.handled) return engine.changed;
  let answer = answerCommonQuestion(label, settings);

  const modal = getActiveModal();
  const validationMessage = getModalValidationMessage(modal);
  const aiQuestionLabel = labelRaw || label;

  if (answer && (label.includes("location") || label.includes("city") || label.includes("address"))) {
    await debugLog(settings, "Resolved location answer", {
      questionLabel: aiQuestionLabel,
      settingsCurrentCity: String(settings?.currentCity || ""),
      jobWorkLocation: String(currentJobContext?.workLocation || ""),
      normalizedFromSettingsOrJob: normalizeCityAnswer(settings?.currentCity, currentJobContext?.workLocation),
      finalAnswer: String(answer || "")
    });
  }

  const textInput = getBySelectorList(
    ["input[type='text']", "input[type='email']", "input[type='tel']", "input[type='number']", "textarea"],
    block
  );
  const isEntityListBlock = isCustomEntitySelectionBlock(block);
  if (textInput && isEntityListBlock) {
    const handledByCombobox = await applyComboboxOption(block, aiQuestionLabel, answer, settings);
    if (handledByCombobox) return true;
  }
  // A phone number is the user's own data: never ask the AI to invent one (it answered "1"). With no
  // number saved the field stays empty and the step is reported as needing input.
  const isPhoneField =
    Boolean(textInput) &&
    (normalizeLabel(textInput.getAttribute("type") || "") === "tel" || /\b(phone|mobile|telephone)\b/.test(label));
  if (isPhoneField && !answer) {
    if (!warnedMissingPhone) {
      warnedMissingPhone = true;
      await logLine("Phone number is not saved in the extension settings, so the phone field was left empty. In the panel chat type: set phone 9805559015", "warn");
    }
    return false;
  }
  if (textInput && !answer) {
    answer = await requestAiAnswer(aiQuestionLabel, textInput.tagName.toLowerCase() === "textarea" ? "textarea" : "text", [], validationMessage);
  }
  if (textInput && !answer && textInput.tagName.toLowerCase() === "textarea") {
    answer = String(settings.coverLetter || "").trim();
  }
  if (textInput && !answer && textInput.tagName.toLowerCase() !== "textarea") {
    answer = getStructuredTextFallback(label, settings);
  }
  if (
    textInput &&
    !answer &&
    textInput.tagName.toLowerCase() !== "textarea" &&
    shouldUseNumericFallbackForTextInput(label, textInput)
  ) {
    const yearsFallback = getYearsFallback(settings);
    if (isYearsExperienceQuestion(label) && yearsFallback === "1") {
      const configured = String(settings?.yearsOfExperienceAnswer || "").trim();
      const fromExperience = Number(settings?.currentExperience);
      const isConfigured = Boolean(configured) || (Number.isFinite(fromExperience) && fromExperience >= 0);
      if (!isConfigured && !warnedDefaultYearsFallback) {
        warnedDefaultYearsFallback = true;
        await logLine("Years of experience not configured in extension settings. Defaulting to 1 year.", "warn");
      }
    }
    answer = yearsFallback;
  }
  if (textInput && answer) {
    const prev = String(textInput.value || "").trim();
    if (prev && !settings.overwritePreviousAnswers) return false;
    if (prev === String(answer).trim()) return false;
    textInput.focus();
    textInput.value = answer;
    textInput.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    textInput.dispatchEvent(new Event("change", { bubbles: true }));
    const normalizedAnswer = normalizeLabel(answer);
    const shouldTryAutocomplete =
      isEntityListBlock ||
      label.includes("city") ||
      label.includes("location") ||
      label.includes("address") ||
      (isMarketingConsentQuestion(label) && (normalizedAnswer === "yes" || normalizedAnswer === "no"));
    if (shouldTryAutocomplete) {
      textInput.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      textInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }
    if (textInput.dataset.cpLastAutoValue !== String(answer).trim()) {
      await logLine(`Answered: ${label.slice(0, 60)} -> ${answer}`);
      textInput.dataset.cpLastAutoValue = String(answer).trim();
    }
    changed = true;
    return changed;
  }

  const select = block.querySelector("select");
  if (select) {
    const options = Array.from(select.options || []);
    const optionsForMatch = options
      .map((o) => ({ text: String(o.textContent || "").trim(), value: String(o.value || "") }))
      .filter((o) => Boolean(o.text));
    const current = options.find((o) => o.value === select.value);
    if (current && !isPlaceholderOptionText(current.textContent || "") && !settings.overwritePreviousAnswers) return false;

    if (!answer) {
      answer = getSelectRuleAnswer(label, settings, optionsForMatch, String(current?.textContent || ""));
    }

    if (!answer) {
      answer = await requestAiAnswer(aiQuestionLabel, "select", optionsForMatch.map((o) => o.text), validationMessage);
    }

    const matchedTarget = selectBestOption(optionsForMatch, answer);
    const target = matchedTarget || selectFallbackOption(optionsForMatch, label);
    if (target) {
      if (select.value === target.value) return false;
      select.value = target.value;
      select.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      const marker = `${label}::${target.value}`;
      if (select.dataset.cpLastAutoValue !== marker) {
        await logLine(
          matchedTarget
            ? `Selected option for: ${label.slice(0, 60)}`
            : `Selected fallback option for: ${label.slice(0, 60)}`
        );
        select.dataset.cpLastAutoValue = marker;
      }
      changed = true;
      return changed;
    }
  }

  const radios = Array.from(block.querySelectorAll("input[type='radio']"));
  if (radios.length) {
    const options = radios.map((r) => ({
      text: getRadioOptionText(r, block),
      value: String(r.value || ""),
      input: r,
      clickTarget: getRadioClickTarget(r, block)
    }));
    const validationNorm = normalizeLabel(validationMessage || "");
    const resumeTarget = getPreferredResumeOption(options, aiQuestionLabel);
    if (resumeTarget) {
      const resumeRequired = validationNorm.includes("resume") && validationNorm.includes("required");
      const alreadySelectedResume = Boolean(resumeTarget.input?.checked);
      if (!alreadySelectedResume || settings.overwritePreviousAnswers || resumeRequired) {
        const clicked = await resilientClick(resumeTarget.clickTarget || resumeTarget.input, "Resume option");
        if (clicked) {
          await sleep(220);
          const marker = getResumeOptionIdentity(resumeTarget.text || resumeTarget.value || "resume");
          if (block.dataset.cpLastResumeChoice !== marker) {
            await logLine(`Selected resume option: ${cleanQuestionLabel(resumeTarget.text || "").slice(0, 80)}`);
            block.dataset.cpLastResumeChoice = marker;
          }
          changed = true;
          return changed;
        }
      }
      if (alreadySelectedResume && !settings.overwritePreviousAnswers && !resumeRequired) {
        return false;
      }
    }

    const alreadySelected = radios.some((r) => r.checked);
    if (alreadySelected && !settings.overwritePreviousAnswers) return false;
    if (!answer) {
      answer = await requestAiAnswer(aiQuestionLabel, "radio", options.map((o) => o.text), validationMessage);
    }
    const matchedTarget = selectBestOption(options, answer);
    const target = matchedTarget || selectFallbackOption(options, aiQuestionLabel);
    if (target) {
      if (target.input?.checked) {
        return false;
      }
      const clicked = await resilientClick(target.clickTarget || target.input, "Radio option");
      if (!clicked) return false;
      const marker = normalizeLabel(target.value || target.text || "selected");
      if (block.dataset.cpLastRadioValue !== marker) {
        await logLine(
          matchedTarget
            ? `Radio answered for: ${label.slice(0, 60)}`
            : `Radio fallback answered for: ${label.slice(0, 60)}`
        );
        block.dataset.cpLastRadioValue = marker;
      }
      changed = true;
      return changed;
    }
  }

  if (isEntityListBlock) {
    const handledByCombobox = await applyComboboxOption(block, aiQuestionLabel, answer, settings);
    if (handledByCombobox) return true;
  }

  const checkbox = block.querySelector("input[type='checkbox']");
  if (checkbox && !checkbox.checked) {
    checkbox.click();
    await logLine(`Checkbox selected for: ${label.slice(0, 60)}`);
    return true;
  }
  return changed;
}

function collectValidationSignals(modal) {
  const text = normalizeLabel(modal?.textContent || "");
  const inline = getModalValidationMessage(modal);
  return {
    full: text,
    inline
  };
}

async function attemptValidationAutoFix(modal, settings) {
  const { full, inline } = collectValidationSignals(modal);
  let changed = false;

  const hasPhoneValidation =
    inline.includes("valid phone") ||
    full.includes("valid phone") ||
    full.includes("enter a valid phone number");
  if (hasPhoneValidation) {
    const phoneValue = normalizePhoneForInput(settings.phoneNumber || "");
    const telInput = getBySelectorList(["input[type='tel']", "input[aria-label*='phone']", "input[name*='phone']"], modal);
    if (telInput && phoneValue) {
      telInput.focus();
      telInput.value = phoneValue;
      telInput.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      telInput.dispatchEvent(new Event("change", { bubbles: true }));
      changed = true;
      await debugLog(settings, "Auto-fixed phone validation", { phoneLength: phoneValue.length });
    }
  }

  const hasEmailValidation = inline.includes("valid email") || full.includes("enter a valid email");
  if (hasEmailValidation) {
    const email = String(settings.contactEmail || "").trim();
    const emailInput = getBySelectorList(["input[type='email']", "input[aria-label*='email']", "input[name*='email']"], modal);
    if (emailInput && email) {
      emailInput.focus();
      emailInput.value = email;
      emailInput.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      emailInput.dispatchEvent(new Event("change", { bubbles: true }));
      changed = true;
      await debugLog(settings, "Auto-fixed email validation");
    }
  }

  const hasResumeValidation =
    inline.includes("resume is required") ||
    full.includes("resume is required") ||
    (inline.includes("resume") && inline.includes("required"));
  if (hasResumeValidation) {
    const blocks = collectQuestionBlocks(modal);
    for (const block of blocks) {
      const radios = Array.from(block.querySelectorAll("input[type='radio']"));
      if (!radios.length) continue;
      const options = radios.map((r) => ({
        text: getRadioOptionText(r, block),
        value: String(r.value || ""),
        input: r,
        clickTarget: getRadioClickTarget(r, block)
      }));
      const resumeTarget = getPreferredResumeOption(options, getQuestionLabel(block) || "resume");
      if (!resumeTarget) continue;
      const clicked = await resilientClick(resumeTarget.clickTarget || resumeTarget.input, "Resume option auto-fix");
      if (!clicked) continue;
      await sleep(220);
      changed = true;
      await debugLog(settings, "Auto-fixed resume validation", {
        option: truncateDebugText(resumeTarget.text || resumeTarget.value || "")
      });
      break;
    }
  }

  return changed;
}

async function forceAnswerModalQuestions(modal, settings) {
  if (!modal) return false;
  let changed = false;
  const aggressiveSettings = { ...settings, overwritePreviousAnswers: true };
  const blocks = collectQuestionBlocks(modal);
  for (const block of blocks) {
    const didChange = await fillQuestionBlock(block, aggressiveSettings);
    if (didChange) changed = true;
  }
  const selectedToday = await selectTodayDateIfPresent(modal);
  if (selectedToday) changed = true;
  return changed;
}
