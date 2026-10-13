/*
 * LinkedIn Jobs auto-apply - part 24: modal-buttons
 *
 * Date picker, modal controls (Next / Review / Submit / Done, native buttons first then
 * role=button), Save-application prompt, closing the dialog, submit completion, follow-company
 * checkbox.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

function isPlaceholderOptionText(text) {
  const t = normalizeLabel(text);
  return !t || t.includes("select an option") || t.includes("choose an option");
}

async function selectTodayDateIfPresent(modal) {
  if (!modal) return false;

  const dateInput = getBySelectorList(["input[type='date']", "input[data-test-date-input]"], modal);
  if (dateInput && isVisibleElement(dateInput)) {
    const prev = String(dateInput.value || "").trim();
    if (!prev) {
      const today = new Date().toISOString().slice(0, 10);
      dateInput.focus();
      dateInput.value = today;
      dateInput.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      dateInput.dispatchEvent(new Event("change", { bubbles: true }));
      await logLine("Selected today's date for date-picker field");
      return true;
    }
  }

  const buttons = Array.from(
    modal.querySelectorAll(
      "button[aria-label*='This is today'], button[aria-label*='today'], .artdeco-calendar__today button"
    )
  ).filter((b) => !b.disabled && isVisibleElement(b));
  for (const button of buttons) {
    const label = normalizeLabel(button.getAttribute("aria-label") || button.textContent || "");
    if (!label.includes("today")) continue;
    if (button.dataset.cpAutoSelectedToday === "1") continue;
    await resilientClick(button, "Date picker today");
    button.dataset.cpAutoSelectedToday = "1";
    await logLine("Selected today's date for date-picker field");
    return true;
  }
  return false;
}

function isControlDisabled(el) {
  return el.disabled === true || el.getAttribute("aria-disabled") === "true";
}

// Visible action controls in a dialog: native buttons first, then role=button elements
// (some layouts render actions as styled divs/links), so a real button always wins a match.
function getModalControls(root, includeDisabled = false) {
  if (!root?.querySelectorAll) return [];
  const usable = (el) => isVisibleElement(el) && (includeDisabled || !isControlDisabled(el));
  const buttons = Array.from(root.querySelectorAll("button")).filter(usable);
  const roleButtons = Array.from(root.querySelectorAll("[role='button']:not(button)")).filter(usable);
  return [...buttons, ...roleButtons];
}

function findSubmitButton(modal) {
  const buttons = getModalControls(modal);
  return (
    buttons.find((b) => normalizeLabel(b.getAttribute("aria-label")).includes("submit application")) ||
    buttons.find((b) => normalizeLabel(b.getAttribute("aria-label")).includes("submit")) ||
    buttons.find((b) => normalizeLabel(b.textContent).includes("submit application")) ||
    buttons.find((b) => normalizeLabel(b.textContent) === "submit")
  );
}

function findDoneOrCloseButton(modalOrRoot = document) {
  const buttons = getModalControls(modalOrRoot);
  return (
    buttons.find((b) => normalizeLabel(b.getAttribute("aria-label")).includes("done")) ||
    buttons.find((b) => normalizeLabel(b.textContent).includes("done")) ||
    buttons.find((b) => normalizeLabel(b.getAttribute("aria-label")).includes("dismiss")) ||
    buttons.find((b) => normalizeLabel(b.textContent).includes("close")) ||
    null
  );
}

function getVisibleModalButtons(modalOrRoot = document) {
  return getModalControls(modalOrRoot);
}

function findModalButtonByIncludes(modalOrRoot, includesList) {
  const buttons = getVisibleModalButtons(modalOrRoot);
  for (const button of buttons) {
    const text = normalizeLabel(`${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`);
    if (includesList.some((needle) => text.includes(needle))) return button;
  }
  return null;
}

function findSaveApplicationPromptModal() {
  const dialogs = Array.from(document.querySelectorAll("[role='alertdialog'], .artdeco-modal, div[data-test-modal], div[role='dialog']"));
  for (const d of dialogs.reverse()) {
    if (isSaveApplicationPrompt(d) && isVisibleElement(d)) {
      return d;
    }
  }
  return null;
}

function isSaveApplicationPrompt(modal) {
  const text = normalizeLabel(modal?.textContent || "");
  if (!text) return false;
  return (
    text.includes("save this application") ||
    text.includes("if you choose to not save") ||
    text.includes("your application will be discarded") ||
    text.includes("discard draft")
  );
}

// "Save this application?" -> click Discard once, like a person. If LinkedIn's Discard
// handler fails (it throws when the form never finished loading) the prompt stays; then
// close the prompt with its X and move on instead of retrying in a loop.
async function dismissSaveApplicationPrompt(modal) {
  const prompt = (modal && isSaveApplicationPrompt(modal)) ? modal : findSaveApplicationPromptModal();
  if (!prompt) return true;
  const discardBtn =
    findModalButtonByIncludes(prompt, ["discard"]) ||
    findModalButtonByIncludes(prompt, ["don't save", "dont save"]) ||
    prompt.querySelector("button[data-control-name='discard_application_confirm_btn']") ||
    prompt.querySelector("button[data-test-dialog-secondary-action]");
  if (!discardBtn) return false;

  await resilientClick(discardBtn, "Discard draft application");
  if (await waitUntil(() => !findSaveApplicationPromptModal(), 2500, 250)) {
    await logLine("Dismissed 'Save this application?' prompt by discarding draft.");
    return true;
  }

  captureDebugEvent("modal", "DISCARD_DID_NOT_CLOSE_PROMPT", { ...capturePageSnapshot() });
  await logLine("LinkedIn did not close the Save/Discard prompt after Discard; closing it and moving on.", "warn");
  const stillOpen = findSaveApplicationPromptModal();
  const closeBtn = stillOpen?.querySelector("button[aria-label*='Dismiss'], button[data-test-modal-close-btn], button.artdeco-modal__dismiss");
  if (closeBtn && isVisibleElement(closeBtn)) {
    await resilientClick(closeBtn, "Close Save/Discard prompt");
    await waitUntil(() => !findSaveApplicationPromptModal(), 1500, 250);
  }
  return !findSaveApplicationPromptModal();
}

// Close whatever is left of an application, the way a person would, in one pass:
// "Application sent" -> Done; open form -> its X; "Save this application?" -> Discard.
async function closePostSubmitUi(settings, options = {}) {
  const preferDiscardDraft = Boolean(options.discardDraft);
  try {
    await finishPostApplyDialog(settings, 0);

    const modal = getActiveModal();
    if (modal && isVisibleElement(modal)) {
      const closeBtn = findDoneOrCloseButton(modal);
      if (closeBtn) {
        await resilientClick(closeBtn, "Close application form");
      } else {
        captureDebugEvent("modal", "NO_CLOSE_BUTTON", describeModalState(modal));
      }
    }

    const prompt = await waitUntil(findSaveApplicationPromptModal, 1500, 200);
    if (prompt) {
      if (preferDiscardDraft) {
        await dismissSaveApplicationPrompt(prompt);
      } else {
        // Not discarding: cancel the close and leave the form as it is.
        const cancelBtn = prompt.querySelector("button[aria-label*='Dismiss'], button.artdeco-modal__dismiss");
        if (cancelBtn) await resilientClick(cancelBtn, "Close Save/Discard prompt");
      }
    }
    await waitUntil(() => !findSaveApplicationPromptModal() && !(getActiveModal() && isVisibleElement(getActiveModal())), 2000, 200);
  } catch {
    // best effort
  }

  if (isPostApplySearchPage()) {
    const resumeUrl = getResumableSearchUrl(settings);
    await debugLog(settings, "Redirecting out of post-apply page", { path: window.location.pathname, resumeUrl });
    window.location.href = resumeUrl;
  }
}

function findNextOrReviewButton(modal, options = {}) {
  const includeDisabled = Boolean(options?.includeDisabled);
  const buttons = getModalControls(modal, includeDisabled);
  const needles = [
    "continue to next step",
    "continue",
    "next",
    "review your application",
    "review application",
    "review",
    "save and continue",
  ];
  return buttons.find((button) => {
    const text = normalizeLabel(`${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`);
    return needles.some((needle) => text.includes(needle));
  });
}

function didSubmitComplete(modal) {
  if (isPostApplySearchPage()) return true;
  const activeModal = getActiveModal();
  if (!activeModal || !isVisibleElement(activeModal)) return true;
  const validation = getModalValidationMessage(activeModal);
  if (validation) return false;
  const successText = normalizeLabel(activeModal.textContent || "");
  if (
    successText.includes("application submitted") ||
    successText.includes("application sent") ||
    successText.includes("your application was sent")
  ) {
    return true;
  }
  const stillSubmit = findSubmitButton(activeModal);
  return !stillSubmit;
}

async function applyFollowCompanyPreference(modal, settings) {
  const checkbox = getBySelectorList(
    [
      "input#follow-company-checkbox",
      "input[id*='follow-company'][type='checkbox']",
      "input[name*='follow'][type='checkbox']"
    ],
    modal
  );
  if (!checkbox) return false;
  const shouldFollow = Boolean(settings.followCompanies);
  const checked = checkbox.checked || checkbox.getAttribute("aria-checked") === "true";
  if (checked === shouldFollow) return true;

  const label =
    modal.querySelector("label[for='follow-company-checkbox']") ||
    checkbox.closest("label") ||
    checkbox;
  await resilientClick(label, "Follow company");
  await logLine(shouldFollow ? "Enabled follow-company option" : "Disabled follow-company option");
  return true;
}
