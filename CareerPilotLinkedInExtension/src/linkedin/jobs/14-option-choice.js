/*
 * LinkedIn Jobs auto-apply - part 14: option-choice
 *
 * Outcome recording, AI answer requests, choosing the best option for selects/radios, and picking
 * the preferred resume.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

async function recordOutcome(outcomeType, data) {
  await sendMessage({
    type: "CP_RECORD_OUTCOME",
    outcomeType,
    data: {
      ...(data || {}),
      pageUrl: window.location.href
    }
  });
}

async function requestAiAnswer(questionLabel, questionType, options = [], validationMessage = "") {
  const cacheKey = `${normalizeLabel(questionLabel)}|${questionType}|${(options || []).map(normalizeLabel).sort().join(",")}`;
  const cached = aiAnswerCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const response = await sendMessage({
    type: "CP_AI_ANSWER",
    question: questionLabel,
    questionType,
    options,
    validationMessage,
    jobContext: currentJobContext
  });
  if (!response?.ok) {
    aiAnswerCache.set(cacheKey, "");
    return "";
  }
  const answer = String(response.answer || "").trim();
  aiAnswerCache.set(cacheKey, answer);
  // Keep AI answers in the local answer bank (24a-answer-engine.js) so the same question is
  // answered locally next time; it is ranked down automatically if LinkedIn rejects it.
  // Choice questions: only an answer that matches one of the offered options is worth keeping.
  const fitsOptions = !(options || []).length || Boolean(selectBestOption((options || []).map((o) => ({ text: String(o), value: String(o) })), answer));
  if (answer && fitsOptions && response.source !== "screening_answers") await rememberAnswer(questionLabel, questionType, answer, "ai");
  return answer;
}

/**
 * AI answer plus alternatives for a retry after LinkedIn rejected answers (`avoid`). Not cached:
 * each retry asks again with the growing avoid list. Returns [best, ...alternatives].
 */
async function requestAiAnswerCandidates(questionLabel, questionType, options = [], validationMessage = "", avoid = []) {
  const response = await sendMessage({
    type: "CP_AI_ANSWER",
    question: questionLabel,
    questionType,
    options,
    validationMessage,
    avoid,
    wantAlternatives: true,
    jobContext: currentJobContext
  });
  if (!response?.ok) return [];
  return [response.answer, ...(Array.isArray(response.alternatives) ? response.alternatives : [])]
    .map((a) => String(a || "").trim())
    .filter(Boolean);
}

function buildAnswerPhrases(answer) {
  const normalized = normalizeLabel(answer);
  if (!normalized) return [];
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  const phrases = [normalized];
  if (compact && compact !== normalized) phrases.push(compact);
  if (normalized === "decline" || normalized.includes("prefer not")) {
    phrases.push("decline", "prefer not", "not wish", "don't wish", "not want", "opt out", "do not contact", "no");
  } else if (normalized.includes("yes")) {
    phrases.push("yes", "agree", "i do", "i have", "accept", "consent", "opt in");
  } else if (normalized.includes("no")) {
    phrases.push("no", "disagree", "i don't", "i do not", "decline", "do not contact", "opt out");
  }
  return [...new Set(phrases.filter(Boolean))];
}

function optionFingerprint(value) {
  return normalizeLabel(value).replace(/[^a-z0-9]/g, "");
}

function isConsentLikeQuestion(label) {
  const l = normalizeLabel(label);
  return (
    isMarketingConsentQuestion(l) ||
    l.includes("consent") ||
    l.includes("permission") ||
    l.includes("opt in") ||
    l.includes("opt-in") ||
    (l.includes("receive") && (l.includes("email") || l.includes("sms") || l.includes("text") || l.includes("phone"))) ||
    l.includes("contact you") ||
    l.includes("do you agree") ||
    l.includes("i agree") ||
    l.includes("terms") ||
    l.includes("privacy")
  );
}

function selectBestOption(options, answer) {
  const phrases = buildAnswerPhrases(answer);
  if (!phrases.length) return null;
  for (const phrase of phrases) {
    const phraseFp = optionFingerprint(phrase);
    const target =
      options.find((o) => normalizeLabel(o.text || "") === phrase) ||
      options.find((o) => normalizeLabel(o.text || "").includes(phrase)) ||
      options.find((o) => phrase.includes(normalizeLabel(o.text || ""))) ||
      options.find((o) => optionFingerprint(o.text || "") === phraseFp) ||
      options.find((o) => optionFingerprint(o.text || "").includes(phraseFp)) ||
      options.find((o) => phraseFp.includes(optionFingerprint(o.text || "")));
    if (target) return target;
  }
  return null;
}

function selectFallbackOption(options, contextLabel = "") {
  if (!Array.isArray(options) || !options.length) return null;
  const cleaned = options.filter((o) => !isPlaceholderOptionText(String(o?.text || "")));
  if (!cleaned.length) return null;

  const isConsent = isConsentLikeQuestion(contextLabel);

  const yesOption = cleaned.find((o) => {
    const t = normalizeLabel(o.text || "");
    return t === "yes" || t.startsWith("yes ") || t.endsWith(" yes") || t.includes(" yes ");
  });
  const noOption = cleaned.find((o) => {
    const t = normalizeLabel(o.text || "");
    return (
      t === "no" ||
      t.includes(" no ") ||
      t.startsWith("no ") ||
      t.endsWith(" no") ||
      t.includes("decline") ||
      t.includes("prefer not")
    );
  });

  // Default behavior: prefer YES when it's a classic yes/no question (except consent-like prompts).
  if (!isConsent && yesOption && noOption) return yesOption;

  if (isConsent) {
    const safeNo = cleaned.find((o) => {
      const t = normalizeLabel(o.text || "");
      return (
        t === "no" ||
        t.includes(" no ") ||
        t.startsWith("no ") ||
        t.endsWith(" no") ||
        t.includes("decline") ||
        t.includes("prefer not")
      );
    });
    if (safeNo) return safeNo;
  }

  const notApplicable = cleaned.find((o) => {
    const t = normalizeLabel(o.text || "");
    return t.includes("not applicable") || t === "n/a";
  });
  if (notApplicable) return notApplicable;

  const preferNot = cleaned.find((o) => normalizeLabel(o.text || "").includes("prefer not"));
  if (preferNot) return preferNot;

  // Deterministic fallback avoids oscillating answers across retries.
  return cleaned[0];
}

function getRadioOptionText(input, root = document) {
  if (!input) return "";
  const candidates = [];
  const inlineLabel = input.closest("label");
  if (inlineLabel) candidates.push(cleanQuestionLabel(inlineLabel.textContent || ""));
  if (input.id) {
    const forLabel =
      root?.querySelector?.(`label[for='${CSS.escape(input.id)}']`) ||
      document.querySelector(`label[for='${CSS.escape(input.id)}']`);
    if (forLabel) candidates.push(cleanQuestionLabel(forLabel.textContent || ""));
  }
  const ariaText = cleanQuestionLabel(input.getAttribute("aria-label") || "");
  if (ariaText) candidates.push(ariaText);
  // The option's own label wins. The longest-text rule used to pick the parent's text, which is the
  // whole question ("Are you comfortable ...? YesNo") when radios sit directly in the question box.
  const own = candidates.find(Boolean);
  if (own) return own;
  const parent = input.parentElement;
  if (parent && parent.querySelectorAll("input[type='radio']").length === 1) {
    const parentText = cleanQuestionLabel(parent.textContent || "");
    if (parentText) return parentText;
  }
  return cleanQuestionLabel(input.value || "");
}

function getRadioClickTarget(input, root = document) {
  if (!input) return null;
  if (input.id) {
    const forLabel =
      root?.querySelector?.(`label[for='${CSS.escape(input.id)}']`) ||
      document.querySelector(`label[for='${CSS.escape(input.id)}']`);
    if (forLabel) return forLabel;
  }
  return input.closest("label") || input;
}

function isResumeOptionText(value) {
  const text = normalizeLabel(value);
  if (!text) return false;
  if (text.includes("select resume") || text.includes("deselect resume")) return true;
  if (text.includes("resume") && (text.includes(".pdf") || text.includes(".doc") || text.includes(".docx"))) return true;
  return false;
}

function getResumeOptionIdentity(value) {
  const raw = normalizeLabel(value);
  if (!raw) return "";
  const cleaned = raw
    .replace(/\bselect resume\b/g, "")
    .replace(/\bdeselect resume\b/g, "")
    .replace(/\buploaded\b.*$/g, "")
    .replace(/\blast updated\b.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return optionFingerprint(cleaned || raw);
}

function getResumeChoiceCacheKey(questionLabel = "") {
  const jobKey = String(currentJobContext.jobId || currentJobContext.jobUrl || window.location.pathname || "job")
    .trim()
    .slice(0, 180);
  const labelKey = questionKeyFromLabel(questionLabel || "resume") || "resume";
  return `${jobKey}::${labelKey}`;
}

function getResumeOptionRecencyScore(textValue) {
  const raw = String(textValue || "");
  const norm = normalizeLabel(raw);
  if (!norm) return 0;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  if (norm.includes("today")) return now;
  if (norm.includes("yesterday")) return now - dayMs;

  const agoMatch = norm.match(/(\d+)\s*(minute|hour|day|week|month|year)s?\s+ago/);
  if (agoMatch) {
    const amount = Number(agoMatch[1] || 0);
    const unit = agoMatch[2] || "";
    if (Number.isFinite(amount) && amount >= 0) {
      const multipliers = {
        minute: 60 * 1000,
        hour: 60 * 60 * 1000,
        day: dayMs,
        week: 7 * dayMs,
        month: 30 * dayMs,
        year: 365 * dayMs
      };
      const unitMs = multipliers[unit] || 0;
      if (unitMs > 0) return now - amount * unitMs;
    }
  }

  const monthMap = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11
  };
  const monthMatch = raw.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,|\s)\s*(\d{2,4})\b/i);
  if (monthMatch) {
    const monthKey = String(monthMatch[1] || "").slice(0, 3).toLowerCase();
    const day = Number(monthMatch[2] || 0);
    let year = Number(monthMatch[3] || 0);
    if (year < 100) year += 2000;
    if (monthKey in monthMap && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
      return new Date(year, monthMap[monthKey], day).getTime();
    }
  }

  const numericMatch = raw.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (numericMatch) {
    let month = Number(numericMatch[1] || 0);
    let day = Number(numericMatch[2] || 0);
    let year = Number(numericMatch[3] || 0);
    if (year < 100) year += 2000;
    if (month > 12 && day <= 12) {
      const tmp = month;
      month = day;
      day = tmp;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
      return new Date(year, month - 1, day).getTime();
    }
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPreferredResumeOption(options, questionLabel = "") {
  if (!Array.isArray(options) || !options.length) return null;
  const resumeOptions = options.filter((option) => isResumeOptionText(option?.text || option?.value || ""));
  if (!resumeOptions.length) return null;

  const cacheKey = getResumeChoiceCacheKey(questionLabel);
  const cachedIdentity = resumeChoiceCache.get(cacheKey);
  if (cachedIdentity) {
    const cachedMatches = resumeOptions
      .map((option, index) => ({
        option,
        index,
        text: String(option?.text || option?.value || ""),
      }))
      .filter((entry) => getResumeOptionIdentity(entry.text) === cachedIdentity)
      .sort((a, b) => {
        const aNorm = normalizeLabel(a.text);
        const bNorm = normalizeLabel(b.text);
        const aSelectionScore = aNorm.includes("select resume") ? 2 : aNorm.includes("deselect resume") ? 1 : 0;
        const bSelectionScore = bNorm.includes("select resume") ? 2 : bNorm.includes("deselect resume") ? 1 : 0;
        if (bSelectionScore !== aSelectionScore) return bSelectionScore - aSelectionScore;
        const aChecked = a.option?.input?.checked ? 1 : 0;
        const bChecked = b.option?.input?.checked ? 1 : 0;
        if (aChecked !== bChecked) return aChecked - bChecked;
        return a.index - b.index;
      });
    const cached = cachedMatches[0]?.option || null;
    if (cached) return cached;
  }

  const ranked = resumeOptions
    .map((option, index) => {
      const text = String(option?.text || option?.value || "");
      const norm = normalizeLabel(text);
      const recencyScore = getResumeOptionRecencyScore(text);
      const selectionScore = norm.includes("select resume") ? 2 : norm.includes("deselect resume") ? 1 : 0;
      const checkedScore = option?.input?.checked ? 1 : 0;
      return { option, index, recencyScore, selectionScore, checkedScore };
    })
    .sort((a, b) => {
      if (b.recencyScore !== a.recencyScore) return b.recencyScore - a.recencyScore;
      if (b.selectionScore !== a.selectionScore) return b.selectionScore - a.selectionScore;
      if (b.checkedScore !== a.checkedScore) return b.checkedScore - a.checkedScore;
      return a.index - b.index;
    });

  const picked = ranked[0]?.option || null;
  if (picked) {
    resumeChoiceCache.set(cacheKey, getResumeOptionIdentity(picked?.text || picked?.value || ""));
  }
  return picked;
}

async function logOutcome(kind, message, reasonCode = "", meta = undefined) {
  const m = reasonCode ? `${message}` : message;
  await logLine(m, kind, { ...(meta || {}), reasonCode: reasonCode || undefined });
}
