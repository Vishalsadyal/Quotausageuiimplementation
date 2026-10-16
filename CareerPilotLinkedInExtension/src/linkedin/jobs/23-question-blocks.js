/*
 * LinkedIn Jobs auto-apply - part 23: question-blocks
 *
 * Form question blocks: collecting them, required/invalid state, validation messages (class-based +
 * aria fallback), pending questions and manual answers.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

const QUESTION_CONTROL_SELECTOR =
  "input:not([type='hidden']), textarea, select, [role='combobox'], button[aria-haspopup='listbox'], [contenteditable='true']";

/** Number of separate questions inside `el` (a radio/checkbox group with one name counts once). */
function countQuestionsIn(el) {
  const names = new Set();
  let count = 0;
  for (const c of el.querySelectorAll(QUESTION_CONTROL_SELECTOR)) {
    if (c.type === "radio" || c.type === "checkbox") {
      const key = c.name || c.closest("fieldset, [role='radiogroup'], [role='group']") || c;
      if (names.has(key)) continue;
      names.add(key);
    }
    count += 1;
  }
  return count;
}

/**
 * Block for one form control on class-free layouts: the LARGEST ancestor that still holds only this
 * one question (label + control + hint/error), never a container shared with another question.
 * A shared container would make getQuestionLabel read one question's label while the first control
 * in it (another question) gets the answer.
 */
function singleQuestionBlock(control, modal) {
  let node = control;
  while (node.parentElement && node.parentElement !== modal && countQuestionsIn(node.parentElement) <= 1) {
    node = node.parentElement;
  }
  // The control itself is not a usable block (callers query INSIDE the block): when even its parent
  // holds other questions, the parent is used and getQuestionLabel pairs the label with the block's
  // FIRST control (the one fillQuestionBlock fills) via <label for=id> / aria-labelledby.
  if (node === control) return control.parentElement;
  return node;
}

function collectQuestionBlocks(modal) {
  if (!modal) return [];
  const selectors = [
    // 2026 layout: componentkey="easyApplyFieldFocus_ea.q::<id>::PHONE_MOBILE::..." wraps one question
    "[componentkey^='easyApplyFieldFocus_']",
    ".fb-dash-form-element",
    ".jobs-easy-apply-form-section__grouping",
    ".jobs-easy-apply-form-element",
    "div[data-test-form-element]",
    "div[data-test-single-line-text-form-component]",
    "div[data-test-text-entity-list-form-component]",
    "div[data-test-multiline-text-form-component]",
    "div[data-test-checkbox-form-component]",
    "div[data-test-date-form-component]",
    "div[data-test-form-builder-dropdown-form-component]",
    "fieldset[data-test-form-builder-radio-button-form-component='true']",
    "fieldset"
  ];
  const all = safeQuerySelectorAll(modal, selectors.join(","), null, "collectQuestionBlocks(all)");
  const unique = [];
  const seen = new Set();
  for (const block of all) {
    if (!(block instanceof HTMLElement)) continue;
    if (seen.has(block)) continue;
    seen.add(block);
    if (!isVisibleElement(block)) {
      const visibleControl = block.querySelector(
        "input:not([type='hidden']), textarea, select, [role='combobox'], button[aria-haspopup='listbox'], button[aria-label*='today'], input[type='date'], input[data-test-date-input]"
      );
      if (!visibleControl || !isVisibleElement(visibleControl)) continue;
    }
    unique.push(block);
  }

  // Also derive blocks from visible controls that are NOT inside a block found above. On class-free
  // layouts only some questions match the selectors (e.g. a <fieldset> radio group) while text
  // inputs / selects sit in plain divs, and returning early would skip those questions.
  const fallbackControls = safeQuerySelectorAll(
    modal,
    "input:not([type='hidden']), textarea, select, [role='combobox'], button[aria-haspopup='listbox'], button[aria-label*='today'], input[type='date'], input[data-test-date-input]",
    null,
    "collectQuestionBlocks(fallbackControls)"
  ).filter((el) => isVisibleElement(el) && !unique.some((block) => block.contains(el)));
  const fallbackBlocks = [];
  const fallbackSeen = new Set();
  for (const control of fallbackControls) {
    const block = control.closest(selectors.join(",")) || singleQuestionBlock(control, modal);
    if (!(block instanceof HTMLElement) || fallbackSeen.has(block) || unique.includes(block)) continue;
    fallbackSeen.add(block);
    fallbackBlocks.push(block);
  }
  if (!fallbackBlocks.length) return unique;
  // Keep page order so questions are answered top to bottom.
  return [...unique, ...fallbackBlocks].sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  );
}

function truncateDebugText(value, max = 72) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function isRequiredQuestionBlock(block, rawLabel = "") {
  const labelNorm = normalizeLabel(rawLabel || "");
  if (String(block?.getAttribute?.("data-required") || "").toLowerCase() === "true") return true;
  if (Boolean(block?.querySelector?.("[required], [aria-required='true']"))) return true;
  if (labelNorm.includes(" required")) return true;
  if (String(rawLabel || "").includes("*")) return true;
  return false;
}

function collapseValidationText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getValidationMessageFromElements(elements) {
  for (const element of Array.isArray(elements) ? elements : []) {
    if (!(element instanceof HTMLElement)) continue;
    if (String(element.getAttribute("aria-hidden") || "").toLowerCase() === "true") continue;
    const text = collapseValidationText(element.textContent || element.getAttribute("aria-label") || "");
    if (text) return text;
  }
  return "";
}

function getQuestionBlockValidationMessage(block) {
  if (!(block instanceof HTMLElement)) return "";
  const selector = [
    ".artdeco-inline-feedback__message",
    "[role='alert']",
    ".fb-dash-form-element__error",
    ".jobs-easy-apply-form-element__error"
  ].join(",");

  const directMessage = getValidationMessageFromElements(Array.from(block.querySelectorAll(selector)));
  if (directMessage) return directMessage;

  const describedByIds = new Set();
  const controls = Array.from(
    block.querySelectorAll(
      "input, select, textarea, [role='combobox'], button[aria-haspopup='listbox'], [aria-describedby]"
    )
  );
  for (const control of controls) {
    const ids = String(control.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .map((id) => id.trim())
      .filter(Boolean);
    // aria-describedby also points at hints ("_r_aa_-info" on the phone field in the 2026 layout):
    // only an invalid control, or an element that is clearly an error, counts as a validation message.
    const controlInvalid = control.getAttribute("aria-invalid") === "true";
    for (const id of ids) if (controlInvalid || /error|invalid/i.test(id)) describedByIds.add(id);
  }

  if (describedByIds.size) {
    const describedByElements = Array.from(describedByIds)
      .map((id) => document.getElementById(id))
      .filter((element) => element instanceof HTMLElement);
    const describedByMessage = getValidationMessageFromElements(describedByElements);
    if (describedByMessage) return describedByMessage;
  }

  return "";
}

function isQuestionBlockInvalid(block, validationMessage = "") {
  if (!(block instanceof HTMLElement)) return Boolean(validationMessage);
  if (validationMessage) return true;
  return Boolean(block.querySelector("[aria-invalid='true'], .artdeco-text-input--error, .fb-dash-form-element--error"));
}

/**
 * What kind of answer the field takes, so the dashboard can ask for the right thing:
 * fieldType (text | number | email | tel | url | textarea | select | radio | checkbox | date | combobox),
 * the offered options for select/radio, and a short hint from the input's limits.
 */
function describeQuestionField(block, state) {
  const out = { fieldType: "", options: [], hint: "" };
  if (!(block instanceof HTMLElement)) return out;
  const stateType = String(state?.type || "");

  if (stateType === "select") {
    out.fieldType = "select";
    out.options = Array.from(block.querySelector("select")?.options || [])
      .map((o) => collapseValidationText(o.textContent))
      .filter((text) => text && !isPlaceholderOptionText(text))
      .slice(0, 40);
    return out;
  }
  if (stateType === "radio") {
    out.fieldType = "radio";
    out.options = Array.from(block.querySelectorAll("input[type='radio']"))
      .filter((r) => isVisibleElement(r))
      .map((r) => collapseValidationText(typeof getRadioOptionText === "function" ? getRadioOptionText(r, block) : r.closest("label")?.textContent || r.value))
      .filter(Boolean)
      .slice(0, 40);
    return out;
  }
  if (stateType === "checkbox" || stateType === "date" || stateType === "date-picker" || stateType === "combobox") {
    out.fieldType = stateType === "date-picker" ? "date" : stateType;
    return out;
  }

  const input = block.querySelector(
    "input:not([type='hidden']):not([type='radio']):not([type='checkbox']):not([type='file']), textarea"
  );
  if (!input) return out;
  if (input.tagName === "TEXTAREA") {
    out.fieldType = "textarea";
  } else {
    const inputType = String(input.getAttribute("type") || "text").toLowerCase();
    const inputMode = String(input.getAttribute("inputmode") || "").toLowerCase();
    const label = typeof normalizeLabel === "function" ? normalizeLabel(state?.label || "") : "";
    const validation = typeof normalizeLabel === "function" ? normalizeLabel(state?.validationMessage || "") : "";
    if (["number", "email", "tel", "url", "date"].includes(inputType)) out.fieldType = inputType;
    else if (inputMode === "numeric" || inputMode === "decimal") out.fieldType = "number";
    else if (typeof NUMBER_VALIDATION_RE !== "undefined" && NUMBER_VALIDATION_RE.test(validation)) out.fieldType = "number";
    else if (typeof NUMBER_LABEL_RE !== "undefined" && NUMBER_LABEL_RE.test(label)) out.fieldType = "number";
    else out.fieldType = "text";
  }
  const parts = [];
  const placeholder = collapseValidationText(input.getAttribute("placeholder") || "");
  if (placeholder) parts.push(`e.g. ${placeholder}`);
  const maxLength = Number(input.getAttribute("maxlength"));
  if (Number.isFinite(maxLength) && maxLength > 0 && maxLength < 5000) parts.push(`max ${maxLength} characters`);
  const min = input.getAttribute("min");
  const max = input.getAttribute("max");
  if (min !== null && min !== "") parts.push(`min ${min}`);
  if (max !== null && max !== "") parts.push(`max ${max}`);
  out.hint = parts.join(" · ").slice(0, 160);
  return out;
}

function getQuestionBlockState(block) {
  const state = getQuestionBlockStateBase(block);
  return { ...state, ...describeQuestionField(block, state) };
}

function getQuestionBlockStateBase(block) {
  const rawLabel = getQuestionLabel(block) || "LinkedIn required field";
  const label = cleanQuestionLabel(rawLabel) || "LinkedIn required field";
  const required = isRequiredQuestionBlock(block, rawLabel);
  const questionKey = questionKeyFromLabel(label) || questionKeyFromLabel(rawLabel) || "";
  const validationMessage = getQuestionBlockValidationMessage(block);
  const invalid = isQuestionBlockInvalid(block, validationMessage);

  const select = block.querySelector("select");
  if (select && isVisibleElement(select)) {
    const selected = select.options?.[select.selectedIndex];
    const selectedText = String(selected?.textContent || "").trim();
    const answered = Boolean(selectedText && !isPlaceholderOptionText(selectedText));
    return {
      questionKey,
      label,
      required,
      type: "select",
      answered,
      value: selectedText,
      invalid,
      validationMessage
    };
  }

  const radios = Array.from(block.querySelectorAll("input[type='radio']")).filter((r) => isVisibleElement(r));
  if (radios.length) {
    const selected = radios.find((r) => r.checked);
    const selectedLabel = selected
      ? cleanQuestionLabel((selected.closest("label")?.textContent || selected.value || "").trim())
      : "";
    return {
      questionKey,
      label,
      required,
      type: "radio",
      answered: Boolean(selected),
      value: selectedLabel,
      invalid,
      validationMessage
    };
  }

  const textInput = getBySelectorList(
    ["input[type='text']", "input[type='email']", "input[type='tel']", "input[type='number']", "textarea"],
    block
  );
  if (textInput && isVisibleElement(textInput)) {
    const value = String(textInput.value || "").trim();
    return {
      questionKey,
      label,
      required,
      type: textInput.tagName.toLowerCase() === "textarea" ? "textarea" : "text",
      answered: Boolean(value),
      value,
      invalid,
      validationMessage
    };
  }

  const combobox = getBySelectorList(
    ["[role='combobox']", "button[aria-haspopup='listbox']", "input[role='combobox']"],
    block
  );
  if (combobox && isVisibleElement(combobox)) {
    const comboText = String(combobox.value || combobox.textContent || combobox.getAttribute("aria-label") || "").trim();
    const answered = Boolean(comboText && !isPlaceholderOptionText(comboText));
    return {
      questionKey,
      label,
      required,
      type: "combobox",
      answered,
      value: comboText,
      invalid,
      validationMessage
    };
  }

  const checkboxes = Array.from(block.querySelectorAll("input[type='checkbox']")).filter((c) => isVisibleElement(c));
  if (checkboxes.length) {
    const requiredBoxes = checkboxes.filter(
      (c) => c.required || c.getAttribute("aria-required") === "true" || required
    );
    const targetBoxes = requiredBoxes.length ? requiredBoxes : checkboxes;
    const answered = targetBoxes.every((c) => c.checked || c.getAttribute("aria-checked") === "true");
    return {
      questionKey,
      label,
      required,
      type: "checkbox",
      answered,
      value: answered ? "checked" : "",
      invalid,
      validationMessage
    };
  }

  const dateInput = getBySelectorList(["input[type='date']", "input[data-test-date-input]"], block);
  if (dateInput && isVisibleElement(dateInput)) {
    const value = String(dateInput.value || "").trim();
    return {
      questionKey,
      label,
      required,
      type: "date",
      answered: Boolean(value),
      value,
      invalid,
      validationMessage
    };
  }

  const dateHint = normalizeLabel(label || rawLabel || "");
  const hiddenDateInput = getBySelectorList(
    [
      "input[type='hidden'][id*='date']",
      "input[type='hidden'][name*='date']",
      "input[id*='date']",
      "input[name*='date']"
    ],
    block
  );
  const hiddenDateValue = String(hiddenDateInput?.value || "").trim();
  if (dateHint.includes("date") || dateHint.includes("start")) {
    if (hiddenDateValue) {
      return {
        questionKey,
        label,
        required,
        type: "date",
        answered: true,
        value: hiddenDateValue,
        invalid,
        validationMessage
      };
    }
  }

  const todayButton = getBySelectorList(
    [
      "button[aria-label*='This is today']",
      "button[aria-label*='today']",
      ".artdeco-calendar__today button"
    ],
    block
  );
  if (todayButton && isVisibleElement(todayButton)) {
    const value = hiddenDateValue;
    const answered = Boolean(value || todayButton.dataset.cpAutoSelectedToday === "1");
    return {
      questionKey,
      label,
      required,
      type: "date-picker",
      answered,
      value: value || (answered ? "today-selected" : ""),
      invalid,
      validationMessage
    };
  }

  return {
    questionKey,
    label,
    required,
    type: "unknown",
    answered: !required,
    value: "",
    invalid,
    validationMessage
  };
}

function summarizeQuestionBlockState(state) {
  const label = truncateDebugText(state?.label || "Unknown");
  const type = String(state?.type || "unknown");
  const required = state?.required ? "required" : "optional";
  const answered = state?.answered ? "answered" : "missing";
  const invalid = state?.invalid ? "invalid" : "valid";
  const value = truncateDebugText(state?.value || "", 36);
  const validationMessage = truncateDebugText(state?.validationMessage || "", 48);
  return `${type}|${required}|${answered}|${invalid}|${label}${value ? ` -> ${value}` : ""}${
    validationMessage ? ` ! ${validationMessage}` : ""
  }`;
}

function collectQuestionBlockDiagnostics(modal) {
  const blocks = collectQuestionBlocks(modal);
  return blocks.map((block) => getQuestionBlockState(block));
}

function isBlankValue(value) {
  return String(value || "").trim().length === 0;
}

function isPlaceholderOption(optionText) {
  const t = normalizeLabel(optionText);
  return !t || t.includes("select an option") || t.includes("choose an option");
}

function doesQuestionStateNeedAttention(state) {
  if (!state) return false;
  if (state.invalid) return true;
  return Boolean(state.required && !state.answered);
}

function collectActionableQuestions(modal) {
  const diagnostics = collectQuestionBlockDiagnostics(modal);
  const pending = [];
  const seen = new Set();
  for (const d of diagnostics) {
    if (!doesQuestionStateNeedAttention(d)) continue;
    const questionKey = d.questionKey || questionKeyFromLabel(d.label) || "linkedin_required_selection";
    const questionLabel = d.label || "LinkedIn required selection";
    const dedupeKey = `${questionKey}::${normalizeLabel(questionLabel)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    pending.push({
      questionKey,
      questionLabel,
      validationMessage: d.validationMessage || "",
      fieldType: d.fieldType || "",
      options: Array.isArray(d.options) ? d.options : [],
      hint: d.hint || "",
      rejectedAnswer: d.invalid ? String(d.value || "").slice(0, 300) : ""
    });
  }
  return pending;
}

function buildPendingQuestionsFromValidation(modal, validationMessage) {
  const questions = collectActionableQuestions(modal);
  if (questions.length) {
    return questions.map((q) => ({
      ...q,
      validationMessage:
        q.validationMessage ||
        validationMessage ||
        "Required field answer missing"
    }));
  }

  // Fallback for LinkedIn custom components that do not expose native select/radio state clearly.
  const firstBlock = collectQuestionBlocks(modal)[0];
  const rawLabel = firstBlock ? getQuestionLabel(firstBlock) : "";
  const fallbackLabel = rawLabel || "LinkedIn required selection";
  const fallbackKey = questionKeyFromLabel(fallbackLabel || "linkedin_required_selection");
  return [
    {
      questionKey: fallbackKey || "linkedin_required_selection",
      questionLabel: fallbackLabel,
      validationMessage: validationMessage || "Please make a selection"
    }
  ];
}

function buildPendingQuestionsFromDiagnostics(unresolvedDiagnostics, validationMessage = "") {
  const items = Array.isArray(unresolvedDiagnostics) ? unresolvedDiagnostics : [];
  const pending = [];
  const seen = new Set();
  for (const d of items) {
    if (!doesQuestionStateNeedAttention(d)) continue;
    const questionKey = d.questionKey || questionKeyFromLabel(d.label) || "linkedin_required_selection";
    const questionLabel = d.label || "LinkedIn required selection";
    const dedupeKey = `${questionKey}::${normalizeLabel(questionLabel)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    pending.push({
      questionKey,
      questionLabel,
      validationMessage:
        d.validationMessage ||
        validationMessage ||
        (d.invalid ? "Please correct this answer" : "Required field answer missing"),
      fieldType: d.fieldType || "",
      options: Array.isArray(d.options) ? d.options : [],
      hint: d.hint || "",
      // The answer LinkedIn refused (empty when the field was simply left blank).
      rejectedAnswer: d.invalid ? String(d.value || "").slice(0, 300) : ""
    });
  }
  return pending;
}

function resolveManualAnswer(screeningAnswers, questionKey, questionLabel) {
  const source = screeningAnswers && typeof screeningAnswers === "object" ? screeningAnswers : {};
  const key = String(questionKey || "").trim();
  const labelNorm = normalizeLabel(questionLabel || "");
  const canonicalKey = canonicalQuestionKey(questionKey || questionLabel || "");
  if (key && !isBlankValue(source[key])) return String(source[key] || "").trim();
  if (canonicalKey && !isBlankValue(source[canonicalKey])) return String(source[canonicalKey] || "").trim();
  if (labelNorm && !isBlankValue(source[labelNorm])) return String(source[labelNorm] || "").trim();
  for (const [k, value] of Object.entries(source)) {
    if (isBlankValue(value)) continue;
    if (normalizeLabel(k) === labelNorm) return String(value || "").trim();
    if (canonicalQuestionKey(k) === canonicalKey && canonicalKey) return String(value || "").trim();
  }
  return "";
}

async function waitForPendingAnswersFromSettings(questions, timeoutMs = MANUAL_ANSWER_WAIT_MS, pollMs = MANUAL_ANSWER_POLL_MS) {
  const pending = Array.isArray(questions) ? questions.filter(Boolean) : [];
  if (!pending.length) {
    return { ok: false, screeningAnswers: {} };
  }
  const timeout = Math.max(3000, Number(timeoutMs || MANUAL_ANSWER_WAIT_MS));
  const poll = Math.max(400, Number(pollMs || MANUAL_ANSWER_POLL_MS));
  const started = Date.now();

  while (Date.now() - started < timeout) {
    if (!await isRunActive()) {
      return { ok: false, screeningAnswers: {} };
    }
    const loaded = await sendMessage({ type: "CP_LOAD_SETTINGS" });
    const screeningAnswers = loaded?.ok ? (loaded.settings?.screeningAnswers || {}) : {};
    const allResolved = pending.every((q) =>
      Boolean(resolveManualAnswer(screeningAnswers, q.questionKey, q.questionLabel))
    );
    if (allResolved) {
      return { ok: true, screeningAnswers };
    }
    await sleep(poll);
  }
  return { ok: false, screeningAnswers: {} };
}

function getModalValidationMessage(modal) {
  return normalizeLabel(getModalValidationMessageRaw(modal));
}

function getModalValidationMessageRaw(modal) {
  return getKnownValidationMessage(modal) || getAriaValidationMessage(modal);
}

// Class-free fallback: an invalid field points at its error text through aria-describedby /
// aria-errormessage.
function getAriaValidationMessage(modal) {
  if (!modal?.querySelectorAll) return "";
  for (const field of modal.querySelectorAll("[aria-invalid='true']")) {
    if (!isVisibleElement(field)) continue;
    const ids = `${field.getAttribute("aria-errormessage") || ""} ${field.getAttribute("aria-describedby") || ""}`
      .split(/\s+/)
      .filter(Boolean);
    const message = getValidationMessageFromElements(ids.map((id) => document.getElementById(id)).filter(Boolean));
    if (message) return message;
  }
  return "";
}

function getKnownValidationMessage(modal) {
  return getValidationMessageFromElements(
    Array.from(
      modal?.querySelectorAll?.(
        [
          ".artdeco-inline-feedback__message",
          "[role='alert']",
          ".fb-dash-form-element__error",
          ".jobs-easy-apply-form-element__error"
        ].join(",")
      ) || []
    )
  );
}

function getModalSignature(modal) {
  const labels = Array.from(
    modal.querySelectorAll("label, legend, .fb-dash-form-element__label, [data-test-form-element] label")
  )
    .map((el) => normalizeLabel(el.textContent || ""))
    .filter(Boolean)
    .slice(0, 12);
  const heading = normalizeLabel(
    getBySelectorList(["h3", "h2", ".artdeco-modal__header h2", ".jobs-easy-apply-content__title"], modal)?.textContent || ""
  );
  const validation = getModalValidationMessage(modal);
  return `${heading}|${validation}|${labels.join("|")}`;
}
