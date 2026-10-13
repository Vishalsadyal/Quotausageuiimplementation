/*
 * LinkedIn Jobs auto-apply - part 22: modal
 *
 * The Easy Apply dialog: finding it, post-apply 'Application sent' screen, waiting for
 * open/ready/step-settled, loading state.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

const ACTIVE_MODAL_SELECTORS = [
  // 2026 layout: native <dialog data-testid="dialog" aria-labelledby="dialog-header"> "Apply to <Company>"
  "dialog[open][data-testid='dialog']",
  ".jobs-easy-apply-modal",
  ".artdeco-modal[role='dialog']",
  ".artdeco-modal",
  "div[data-test-modal]",
  "div[data-view-name*='easy-apply-modal']",
  "div[role='dialog'][aria-labelledby*='easy-apply']",
  "div[role='dialog'][aria-label*='Easy Apply']",
  "div[role='dialog']",
  // Class-free fallbacks for layouts that drop the artdeco markup.
  "dialog[open]",
  "[role='dialog'][aria-modal='true']",
  "[role='dialog']"
];

// The Easy Apply form. LinkedIn's "Application sent" screen and the "Save this application?"
// prompt match the same selectors, so they are skipped here; treating them as the form made
// the next job look like it had no Next button.
function getActiveModal() {
  for (const selector of ACTIVE_MODAL_SELECTORS) {
    for (const el of document.querySelectorAll(selector)) {
      if (!isSaveApplicationPrompt(el) && !isPostApplyDialog(el)) return el;
    }
  }
  return null;
}

// LinkedIn's confirmation after a submit ("Application sent" / "Applied to <company>").
function isPostApplyDialog(el) {
  if (!el) return false;
  const heading = normalizeLabel(el.querySelector("h2, h3")?.textContent || "");
  if (heading.startsWith("applied to") || heading.includes("application sent") || heading.includes("application was sent")) return true;
  const text = normalizeLabel(el.textContent || "").slice(0, 400);
  return text.includes("your application was sent") || (text.includes("application sent") && !findSubmitButton(el));
}

function findPostApplyDialog() {
  const dialogs = Array.from(document.querySelectorAll(".artdeco-modal, div[data-test-modal], div[role='dialog']"));
  return dialogs.find((d) => isVisibleElement(d) && isPostApplyDialog(d)) || null;
}

async function waitUntil(check, timeoutMs, intervalMs = 200) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = check();
    if (value) return value;
    await sleep(intervalMs);
  }
  return check();
}

// Compact picture of the form for logs: why did we skip or stall here?
function describeModalState(modal) {
  if (!modal) return { modalPresent: false, postApplyDialog: Boolean(findPostApplyDialog()), savePrompt: Boolean(findSaveApplicationPromptModal()) };
  return {
    modalPresent: true,
    heading: truncateDebugText(normalizeLabel(modal.querySelector("h2, h3")?.textContent || ""), 80),
    loading: isModalLoading(modal),
    questionBlocks: collectQuestionBlocks(modal).length,
    nextEnabled: Boolean(findNextOrReviewButton(modal)),
    nextAny: Boolean(findNextOrReviewButton(modal, { includeDisabled: true })),
    submit: Boolean(findSubmitButton(modal)),
    validation: truncateDebugText(getModalValidationMessageRaw(modal) || "", 120),
    postApplyDialog: Boolean(findPostApplyDialog()),
    savePrompt: Boolean(findSaveApplicationPromptModal()),
  };
}

function summarizeModalState(state) {
  if (!state.modalPresent) {
    return `form closed${state.postApplyDialog ? ", 'Application sent' screen open" : ""}${state.savePrompt ? ", Save/Discard prompt open" : ""}`;
  }
  return [
    `step "${state.heading || "?"}"`,
    state.loading ? "spinner showing" : "no spinner",
    state.nextEnabled ? "Next enabled" : state.nextAny ? "Next disabled" : "no Next",
    state.submit ? "Submit visible" : "",
    state.validation ? `error: ${state.validation}` : "",
    state.savePrompt ? "Save/Discard prompt open" : "",
  ].filter(Boolean).join(", ");
}

// Like a person after submitting: wait for the "Application sent" screen to finish loading,
// then click Done (or its X). Returns true when no confirmation screen is left open.
async function finishPostApplyDialog(settings, appearTimeoutMs = 10000) {
  const dialog = appearTimeoutMs > 0 ? await waitUntil(findPostApplyDialog, appearTimeoutMs, 250) : findPostApplyDialog();
  if (!dialog) return true;
  await waitUntil(() => !isModalLoading(findPostApplyDialog()), 10000, 250);
  const current = findPostApplyDialog();
  if (!current) return true;
  const doneBtn =
    findModalButtonByIncludes(current, ["done"]) ||
    current.querySelector("button[aria-label*='Dismiss'], button.artdeco-modal__dismiss");
  if (doneBtn) {
    await resilientClick(doneBtn, "Done (application sent)");
    captureDebugEvent("modal", "POST_APPLY_DONE_CLICKED", {});
    await debugLog(settings, "Closed 'Application sent' screen with Done");
  }
  const gone = await waitUntil(() => !findPostApplyDialog(), 5000, 250);
  if (!gone) captureDebugEvent("modal", "POST_APPLY_DIALOG_STUCK", { ...capturePageSnapshot() });
  return Boolean(gone);
}

// Before opening the next job, make sure nothing from the previous one is still on screen.
async function clearLeftoverDialogs(settings) {
  if (findPostApplyDialog()) {
    await logLine("Closing the previous 'Application sent' screen before the next job.", "info");
    await finishPostApplyDialog(settings, 0);
  }
  const prompt = findSaveApplicationPromptModal();
  if (prompt) {
    captureDebugEvent("modal", "LEFTOVER_SAVE_PROMPT", {});
    await dismissSaveApplicationPrompt(prompt);
  }
}

// After clicking Next, LinkedIn shows a spinner while it saves the step. Wait for it like a
// person would, then return the (possibly re-rendered) form.
async function waitForModalStepSettled(previousSignature, timeoutMs = 15000) {
  const start = Date.now();
  let sawLoading = false;
  while (Date.now() - start < timeoutMs) {
    if (findSaveApplicationPromptModal()) {
      return { modal: getActiveModal(), waitedMs: Date.now() - start, sawLoading, savePrompt: true, timedOut: false };
    }
    const modal = getActiveModal();
    if (!modal || !isVisibleElement(modal)) {
      return { modal: null, waitedMs: Date.now() - start, sawLoading, savePrompt: false, timedOut: false };
    }
    const loading = isModalLoading(modal);
    if (loading) sawLoading = true;
    const hasAction = Boolean(findNextOrReviewButton(modal, { includeDisabled: true }) || findSubmitButton(modal) || findDoneOrCloseButton(modal));
    const changed = getModalSignature(modal) !== previousSignature;
    if (!loading && hasAction && (changed || Date.now() - start >= STEP_DELAY_MS)) {
      return { modal, waitedMs: Date.now() - start, sawLoading, savePrompt: false, timedOut: false };
    }
    await sleep(200);
  }
  return { modal: getActiveModal(), waitedMs: Date.now() - start, sawLoading, savePrompt: false, timedOut: true };
}

function isModalLoading(modal) {
  if (!modal) return false;
  if (modal.getAttribute("aria-busy") === "true") return true;
  const loader = modal.querySelector(".artdeco-loader, .artdeco-loader__bar, [class*='skeleton'], [data-test-loading], .loader, .jobs-easy-apply-modal--loading, [data-testid='loader']");
  if (loader && isVisibleElement(loader)) return true;
  return false;
}

async function waitForModalOpen(timeoutMs = 4500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const modal = getActiveModal();
    if (modal && isVisibleElement(modal)) return modal;
    await sleep(180);
  }
  return null;
}

async function waitForModalReady(modal, timeoutMs = 4500) {
  if (!modal) return false;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const loading = isModalLoading(modal);
    const blocks = collectQuestionBlocks(modal);
    const nextBtn = findNextOrReviewButton(modal, { includeDisabled: true });
    const submitBtn = findSubmitButton(modal);
    if (!loading && (blocks.length > 0 || nextBtn || submitBtn)) {
      return true;
    }
    await sleep(250);
  }
  const finalBlocks = collectQuestionBlocks(modal);
  const finalNext = findNextOrReviewButton(modal, { includeDisabled: true });
  const finalSubmit = findSubmitButton(modal);
  return finalBlocks.length > 0 || Boolean(finalNext) || Boolean(finalSubmit);
}
