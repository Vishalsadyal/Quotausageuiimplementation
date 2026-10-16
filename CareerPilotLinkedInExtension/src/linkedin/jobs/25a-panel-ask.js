/*
 * LinkedIn Jobs auto-apply - part 25a: panel-ask
 *
 * Asks the user an unanswered question right in the AutoApply panel, instead of sending them to the
 * dashboard. The answer is put into the real LinkedIn field and checked live: our own type check first
 * (a number field needs a number, a dropdown needs one of its options), then LinkedIn's validation message.
 * If either says no, the card stays open with the reason so the user can fix it and try again.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Used by processEasyApplyModal in 26-easy-apply-flow.js.
 */

const ASK_FIELD_KIND_LABEL = {
  number: "Number",
  text: "Text",
  textarea: "Long text",
  select: "Pick one",
  radio: "Pick one",
  checkbox: "Yes / No",
  email: "Email",
  tel: "Phone number",
  url: "Link",
  date: "Date",
  combobox: "Text",
};

let panelAskCancel = null;

/** Closes an open question card (for example when the answer arrived from the dashboard instead). */
function cancelPanelAsk() {
  if (typeof panelAskCancel === "function") panelAskCancel("cancelled");
}

function askAnswerTypeFor(fieldType) {
  if (fieldType === "number") return "number";
  if (fieldType === "select" || fieldType === "radio") return "choice";
  if (fieldType === "checkbox") return "boolean";
  return "text";
}

function askTypeMismatchMessage(q) {
  if (q.type === "number") return "This field needs a number, for example 5.";
  if (q.type === "select" || q.type === "radio") {
    const names = (q.options || []).map((o) => o.text).filter(Boolean).slice(0, 8).join(", ");
    return names ? `Pick one of these options: ${names}.` : "Pick one of the options.";
  }
  if (q.type === "email") return "Enter a valid email address.";
  if (q.type === "tel") return "Enter a valid phone number.";
  if (q.type === "url") return "Enter a valid link, starting with https://";
  return "That answer does not fit this field.";
}

function askFireInput(el) {
  el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
}

/** The suggestions LinkedIn lists under a search-as-you-type box. */
function collectTypeaheadOptions(block, input) {
  const controlsId = input?.getAttribute?.("aria-controls");
  const listbox = (controlsId && document.getElementById(controlsId)) || block.querySelector("[role='listbox']");
  return Array.from((listbox || document).querySelectorAll("[role='option'], li[role='option'], .artdeco-typeahead__result"))
    .filter((el) => isVisibleElement(el))
    .map((el) => ({ text: String(el.textContent || "").replace(/\s+/g, " ").trim(), value: "", el }))
    .filter((o) => o.text);
}

/**
 * Fields like "Location (city)" only accept one of LinkedIn's suggestions, not free text.
 * Types the answer, reads the suggestions and clicks the matching one. When none matches clearly,
 * returns the suggestions so the card can offer them as buttons.
 */
async function applyTypeaheadAnswer(block, q, typed, settings) {
  const input = block.querySelector("input[role='combobox'], input:not([type='hidden']):not([type='checkbox']):not([type='radio'])");
  if (!input) {
    // A button dropdown: the normal combobox routine handles it.
    const changed = await applyComboboxOption(block, q.label, typed, { ...settings, overwritePreviousAnswers: true });
    return changed
      ? { ok: true, value: typed, suggestions: [] }
      : { ok: false, error: "Could not pick that option. Open the dropdown on the form and choose it there.", suggestions: [] };
  }

  input.focus();
  setNativeValue(input, "");
  askFireInput(input);
  setNativeValue(input, typed);
  askFireInput(input);
  input.dispatchEvent(new KeyboardEvent("keyup", { key: typed.slice(-1), bubbles: true }));
  await sleep(1000);

  const options = collectTypeaheadOptions(block, input);
  if (!options.length) {
    return { ok: false, error: "LinkedIn shows no suggestions for that. Try just the city or a shorter name.", suggestions: [] };
  }
  const wanted = normalizeLabel(typed);
  const target =
    options.find((o) => normalizeLabel(o.text) === wanted) ||
    (options.length === 1 ? options[0] : null) ||
    selectBestOption(options, typed);
  if (!target) {
    return { ok: false, error: "LinkedIn only accepts one of its suggestions. Pick one:", suggestions: options.slice(0, 8).map((o) => o.text) };
  }

  for (const type of ["mousedown", "mouseup", "click"]) {
    target.el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: window }));
    await sleep(60);
  }
  await sleep(450);
  return { ok: true, value: target.text, suggestions: [] };
}

/**
 * Puts the answer into the question's field on the form and lets LinkedIn validate it.
 * Returns { ok, value, error, suggestions }. When the field cannot be found the answer is accepted as is.
 */
async function tryAnswerInForm(modal, pendingQuestion, rawValue, settings) {
  const typed = String(rawValue ?? "").trim();
  if (!typed) return { ok: false, error: "Type an answer first." };

  const wantLabel = normalizeLabel(pendingQuestion.questionLabel || "");
  const block = collectQuestionBlocks(modal).find((candidate) => {
    const state = getQuestionBlockState(candidate);
    return (pendingQuestion.questionKey && state.questionKey === pendingQuestion.questionKey) || normalizeLabel(state.label) === wantLabel;
  });
  if (!block) return { ok: true, value: typed };

  const q = detectQuestionType(block);
  let value;
  if (q.type === "combobox") {
    const picked = await applyTypeaheadAnswer(block, q, typed, settings);
    if (!picked.ok) return { ok: false, error: picked.error, suggestions: picked.suggestions };
    value = picked.value;
  } else {
    value = coerceAnswer({ ...q, validation: "" }, typed);
    if (value == null) return { ok: false, error: askTypeMismatchMessage(q) };
    await applyEngineAnswer(block, q, value, settings);
  }

  // LinkedIn validates a field when it loses focus; trigger that and read what it says.
  const control = q.control || block.querySelector("input:not([type='hidden']), textarea, select");
  if (control) {
    control.dispatchEvent(new Event("blur", { bubbles: true }));
    control.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  }
  await sleep(800);
  const message = getQuestionBlockValidationMessage(block);
  if (message) return { ok: false, error: `LinkedIn says: ${message}`, suggestions: [] };
  return { ok: true, value };
}

function ensurePanelAskElement() {
  ensurePanelConnected();
  if (!panelEl) return null;
  let el = panelEl.querySelector("#cp-ask");
  if (!el) {
    el = document.createElement("div");
    el.id = "cp-ask";
    el.className = "cp-ask";
    el.hidden = true;
    // Keystrokes in the card must not reach LinkedIn's own shortcut handlers.
    for (const type of ["keydown", "keyup", "keypress"]) el.addEventListener(type, (event) => event.stopPropagation());
    const anchor = panelEl.querySelector(".cp-tab-bar");
    if (anchor) anchor.parentNode.insertBefore(el, anchor);
    else panelEl.appendChild(el);
  }
  return el;
}

function askInputHtml(pq, value) {
  const type = String(pq.fieldType || "text");
  const options = Array.isArray(pq.options) ? pq.options : [];
  const val = escapeHtml(value || "");
  if (type === "checkbox") {
    return `<select id="cp-ask-input"><option value="">Choose...</option><option value="yes"${value === "yes" ? " selected" : ""}>Yes</option><option value="no"${value === "no" ? " selected" : ""}>No</option></select>`;
  }
  if ((type === "select" || type === "radio") && options.length) {
    const rows = options.map((o) => `<option value="${escapeHtml(o)}"${o === value ? " selected" : ""}>${escapeHtml(o)}</option>`).join("");
    return `<select id="cp-ask-input"><option value="">Choose...</option>${rows}</select>`;
  }
  if (type === "textarea") return `<textarea id="cp-ask-input" rows="3">${val}</textarea>`;
  const inputType = type === "number" ? "number" : type === "email" ? "email" : type === "tel" ? "tel" : type === "url" ? "url" : "text";
  const mode = type === "number" ? ' inputmode="decimal" step="any"' : "";
  return `<input id="cp-ask-input" type="${inputType}"${mode} value="${val}" autocomplete="off" />`;
}

/**
 * Shows the unresolved questions one by one in the panel.
 * Resolves { result, answers } where result is "answered" (all done), "dashboard" (user chose the
 * dashboard), "cancelled" (closed from outside) or "timeout"; answers maps questionKey to the accepted value.
 */
function askQuestionsInPanel(modal, pendingQuestions, settings, timeoutMs = 180000) {
  const questions = (Array.isArray(pendingQuestions) ? pendingQuestions : []).filter((pq) => pq && pq.questionLabel);
  const el = ensurePanelAskElement();
  if (!el || !questions.length) return Promise.resolve({ result: "dashboard", answers: {} });

  if (panelPrefs?.minimized) setPanelMinimized(false);

  return new Promise((resolve) => {
    const answers = {};
    let index = 0;
    let lastTyped = "";
    let done = false;
    let busy = false;

    // LinkedIn moves focus to its own invalid field (and its dialog pulls focus back inside) on its own
    // timer, which swallowed the first keystrokes. While the card is open and in use, keep typing in it,
    // unless the user clicks another field on purpose.
    let lastOutsideClick = 0;
    let lastCardUse = Date.now();
    const onPointer = (event) => {
      if (panelEl?.contains(event.target)) lastCardUse = Date.now();
      else lastOutsideClick = Date.now();
    };
    const onFocusIn = (event) => {
      if (done || busy || !panelEl || panelEl.contains(event.target)) return;
      if (Date.now() - lastOutsideClick < 1500) return;
      if (Date.now() - lastCardUse > 20000) return;
      const input = el.querySelector("#cp-ask-input");
      if (input) window.setTimeout(() => input.focus({ preventScroll: true }), 0);
    };
    document.addEventListener("mousedown", onPointer, true);
    document.addEventListener("focusin", onFocusIn, true);

    const finish = (result) => {
      if (done) return;
      done = true;
      document.removeEventListener("mousedown", onPointer, true);
      document.removeEventListener("focusin", onFocusIn, true);
      window.clearTimeout(timer);
      panelAskCancel = null;
      el.hidden = true;
      el.innerHTML = "";
      resolve({ result, answers });
    };
    panelAskCancel = finish;
    const timer = window.setTimeout(() => finish("timeout"), Math.max(5000, Number(timeoutMs) || 180000));

    const show = (error = "", suggestions = []) => {
      const pq = questions[index];
      const kind = ASK_FIELD_KIND_LABEL[String(pq.fieldType || "text")] || "Text";
      const lines = [];
      if (pq.rejectedAnswer && !error) lines.push(`LinkedIn rejected "${escapeHtml(pq.rejectedAnswer)}"${pq.validationMessage ? `: ${escapeHtml(pq.validationMessage)}` : ""}`);
      else if (pq.validationMessage && !error && pq.validationMessage !== "Required field answer missing") lines.push(escapeHtml(pq.validationMessage));
      el.innerHTML = `
        <div class="cp-ask-head">
          <span class="cp-ask-count">Question ${index + 1} of ${questions.length}</span>
          <span class="cp-ask-kind">${escapeHtml(kind)}</span>
        </div>
        <div class="cp-ask-label">${escapeHtml(pq.questionLabel)}</div>
        ${pq.hint ? `<div class="cp-ask-hint">${escapeHtml(pq.hint)}</div>` : ""}
        ${lines.length ? `<div class="cp-ask-error">${lines.join("<br>")}</div>` : ""}
        ${error ? `<div class="cp-ask-error">${escapeHtml(error)}</div>` : ""}
        ${suggestions.length ? `<div class="cp-ask-chips">${suggestions.map((s) => `<button type="button" class="cp-ask-chip" data-value="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}</div>` : ""}
        <div class="cp-ask-row">
          ${askInputHtml(pq, lastTyped)}
          <button type="button" id="cp-ask-submit" class="cp-ask-submit">Answer</button>
        </div>
        <button type="button" id="cp-ask-dashboard" class="cp-ask-link">Answer in the dashboard instead</button>`;
      el.hidden = false;
      lastCardUse = Date.now();
      const input = el.querySelector("#cp-ask-input");
      input?.focus();
      input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && input.tagName !== "TEXTAREA") {
          event.preventDefault();
          void submit();
        }
      });
      el.querySelector("#cp-ask-submit")?.addEventListener("click", () => void submit());
      for (const chip of el.querySelectorAll(".cp-ask-chip")) {
        chip.addEventListener("click", () => void submit(chip.getAttribute("data-value") || ""));
      }
      el.querySelector("#cp-ask-dashboard")?.addEventListener("click", () => finish("dashboard"));
    };

    const submit = async (chosen) => {
      if (busy || done) return;
      const pq = questions[index];
      const input = el.querySelector("#cp-ask-input");
      lastTyped = typeof chosen === "string" && chosen ? chosen : String(input?.value ?? "").trim();
      busy = true;
      const button = el.querySelector("#cp-ask-submit");
      if (button) {
        button.disabled = true;
        button.textContent = "Checking...";
      }
      let check;
      try {
        check = await tryAnswerInForm(modal, pq, lastTyped, settings);
      } catch (error) {
        check = { ok: false, error: `Could not check this answer: ${String(error?.message || error).slice(0, 120)}` };
      }
      busy = false;
      if (done) return;
      if (!check.ok) {
        show(check.error, check.suggestions || []);
        return;
      }
      answers[pq.questionKey] = check.value;
      // Saved in the extension and sent to the dashboard in the background, so it is not asked again.
      await sendMessage({
        type: "CP_SAVE_QUESTION_ANSWER",
        questionKey: pq.questionKey,
        questionLabel: pq.questionLabel,
        answer: check.value,
        answerType: askAnswerTypeFor(String(pq.fieldType || "")),
        fromPanel: true,
      });
      index += 1;
      lastTyped = "";
      if (index >= questions.length) finish("answered");
      else show();
    };

    show();
  });
}
