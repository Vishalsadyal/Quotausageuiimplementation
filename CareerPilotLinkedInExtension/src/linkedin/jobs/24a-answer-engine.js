/*
 * LinkedIn Jobs auto-apply - part 24a: answer-engine
 *
 * One ordered pipeline for every Easy Apply question:
 *   1. type     detectQuestionType: number / email / tel / url / text / textarea / select / radio /
 *               checkbox / combobox / date, plus the options a choice question offers
 *   2. stored   the local answer bank (chrome.storage.local "cpAnswerBank": answers that passed
 *               before, AI answers, dashboard answers) and settings.screeningAnswers; exact
 *               question key first, then a close label match (same type only)
 *   3. profile  rules over the saved profile (answerCommonQuestion + structured fallbacks)
 *   4. AI       Groq through the portal (/api/ai/answer), asked for alternatives too
 *   5. you      the dashboard "Action needed" question (existing tier in 26-easy-apply-flow.js)
 * Every candidate is converted to the question's type before use (a number question gets "3",
 * a select gets one of its own options, an email must look like an email); a candidate that
 * cannot fit is dropped instead of typed in.
 * When LinkedIn rejects an answer, retryRejectedAnswers fills the next-ranked candidate not tried
 * yet for that field. Answers that pass a step are counted as good, rejected ones are ranked down.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

const ANSWER_BANK_KEY = "cpAnswerBank";
const ANSWER_BANK_MAX_ENTRIES = 1500;
// Trust order of sources (higher wins at equal track record).
const ANSWER_SOURCE_WEIGHT = { user: 6, stored: 5, profile: 3, ai: 2, rule: 1 };

let answerBankState = null; // { entries: { [key]: { label, type, answers: [{ value, source, ok, fail, at }] } } }
let answerBankSaveTimer = 0;

// ---------------------------------------------------------------- answer bank (local storage)
async function loadAnswerBank() {
  if (answerBankState) return answerBankState;
  answerBankState = { entries: {} };
  if (!isExtensionContextValid()) return answerBankState;
  try {
    const stored = await chrome.storage.local.get(ANSWER_BANK_KEY);
    const bank = stored?.[ANSWER_BANK_KEY];
    if (bank && typeof bank === "object" && bank.entries && typeof bank.entries === "object") answerBankState = bank;
  } catch {
    // storage unavailable: keep an in-memory bank for this page
  }
  return answerBankState;
}

function scheduleAnswerBankSave() {
  if (answerBankSaveTimer) return;
  answerBankSaveTimer = setTimeout(async () => {
    answerBankSaveTimer = 0;
    if (!answerBankState || !isExtensionContextValid()) return;
    try {
      await chrome.storage.local.set({ [ANSWER_BANK_KEY]: answerBankState });
    } catch {
      // ignore: retried on the next change
    }
  }, 600);
}

function answerBankKey(label) {
  return canonicalQuestionKey(label) || questionKeyFromLabel(label) || normalizeLabel(label);
}

const answerScore = (a) => (ANSWER_SOURCE_WEIGHT[a.source] || 0) + (a.ok || 0) * 2 - (a.fail || 0) * 4;
const rankAnswers = (a, b) => answerScore(b) - answerScore(a) || (b.at || 0) - (a.at || 0);

/**
 * Remembers an answer for a question. outcome "ok" = it passed a step, "fail" = LinkedIn rejected
 * it, undefined = just learned (e.g. from AI). Keeps the 8 best answers per question.
 */
async function rememberAnswer(label, type, value, source, outcome) {
  const v = String(value ?? "").trim();
  if (!label || !v || v.length > 2000) return;
  const bank = await loadAnswerBank();
  const key = answerBankKey(label);
  if (!key) return;
  const entry = bank.entries[key] || (bank.entries[key] = { label: cleanQuestionLabel(label), type, answers: [] });
  if (type) entry.type = type;
  entry.concept = questionConcept(label); // links related wordings of the same question
  let item = entry.answers.find((a) => normalizeLabel(a.value) === normalizeLabel(v));
  if (!item) {
    item = { value: v, source, ok: 0, fail: 0, at: Date.now() };
    entry.answers.push(item);
  }
  if ((ANSWER_SOURCE_WEIGHT[source] || 0) > (ANSWER_SOURCE_WEIGHT[item.source] || 0)) item.source = source;
  if (outcome === "ok") item.ok = (item.ok || 0) + 1;
  if (outcome === "fail") item.fail = (item.fail || 0) + 1;
  item.at = Date.now();
  entry.updatedAt = Date.now();
  entry.answers = entry.answers.sort(rankAnswers).slice(0, 8);
  const keys = Object.keys(bank.entries);
  if (keys.length > ANSWER_BANK_MAX_ENTRIES) {
    keys
      .sort((a, b) => (bank.entries[a].updatedAt || 0) - (bank.entries[b].updatedAt || 0))
      .slice(0, keys.length - ANSWER_BANK_MAX_ENTRIES)
      .forEach((k) => delete bank.entries[k]);
  }
  scheduleAnswerBankSave();
}

// ---------------------------------------------------------------- 1. question type
const NUMBER_LABEL_RE = /\b(how many|number of (years|months|days)|years of|in years|in months|in days|notice period|whole number)\b/;
const NUMBER_VALIDATION_RE = /\b(whole number|decimal number|numeric|enter a number|number between|number larger|number smaller)\b/;

/**
 * { type, options?, control?, label } for a question block. options: [{ text, value, input?, clickTarget? }].
 */
function detectQuestionType(block) {
  const label = getQuestionLabel(block);
  const select = block.querySelector("select");
  if (select) {
    const options = Array.from(select.options || [])
      .map((o) => ({ text: String(o.textContent || "").trim(), value: String(o.value || "") }))
      .filter((o) => o.text && !isPlaceholderOptionText(o.text));
    return { type: "select", options, control: select, label };
  }
  const radios = Array.from(block.querySelectorAll("input[type='radio']"));
  if (radios.length) {
    const options = radios.map((r) => ({ text: getRadioOptionText(r, block), value: String(r.value || ""), input: r, clickTarget: getRadioClickTarget(r, block) }));
    return { type: "radio", options, label };
  }
  if (isCustomEntitySelectionBlock(block) || block.querySelector("[role='combobox']")) return { type: "combobox", label };
  const input = block.querySelector("input:not([type='hidden']):not([type='radio']):not([type='checkbox']):not([type='file']), textarea");
  const checkboxes = block.querySelectorAll("input[type='checkbox']");
  if (!input && checkboxes.length === 1) return { type: "checkbox", control: checkboxes[0], label };
  if (!input) return { type: "unknown", label };
  if (input.tagName === "TEXTAREA") return { type: "textarea", control: input, label };
  const inputType = String(input.getAttribute("type") || "text").toLowerCase();
  if (["number", "email", "tel", "url", "date"].includes(inputType)) return { type: inputType, control: input, label };
  const inputMode = String(input.getAttribute("inputmode") || "").toLowerCase();
  const validation = normalizeLabel(getQuestionBlockValidationMessage(block));
  if (inputMode === "numeric" || inputMode === "decimal" || NUMBER_VALIDATION_RE.test(validation) || NUMBER_LABEL_RE.test(normalizeLabel(label))) {
    return { type: "number", control: input, label };
  }
  return { type: "text", control: input, label };
}

const typeFamily = (type) => (["select", "radio", "checkbox"].includes(type) ? "choice" : type === "textarea" ? "text" : type);

// ---------------------------------------------------------------- concept map (related questions)
// Different wordings of the same question map to one concept key, so an answer to one answers the
// others: "How many years of experience do you have with React?", "Years of React.js experience"
// and "Experience in ReactJS (years)" all become "years:react".
const SKILL_ALIASES = [
  [/\breact(\.?js)?\b|\breactjs\b/, "react"],
  [/\bnode(\.?js)?\b|\bnodejs\b/, "node"],
  [/\bnext(\.?js)?\b|\bnextjs\b/, "next"],
  [/\bvue(\.?js)?\b/, "vue"],
  [/\bangular(\.?js)?\b/, "angular"],
  [/\bjavascript\b|\bjs\b/, "javascript"],
  [/\btypescript\b|\bts\b/, "typescript"],
  [/\bc#|c sharp\b/, "csharp"],
  [/\b\.net\b|\bdotnet\b/, "dotnet"],
  [/\bc\+\+|cpp\b/, "cpp"],
  [/\bgolang\b|\bgo lang\b/, "go"],
  [/\bpostgres(ql)?\b/, "postgresql"],
  [/\bmongo(db)?\b/, "mongodb"],
  [/\bk8s\b|\bkubernetes\b/, "kubernetes"],
  [/\baws\b|amazon web services/, "aws"],
  [/\bgcp\b|google cloud/, "gcp"],
  [/\bmachine learning\b|\bml\b/, "machine-learning"],
];
const CONCEPTS = [
  ["notice_period", /\bnotice period\b|how soon can you (join|start)|\bjoining (time|date)\b|\bearliest start\b/],
  ["expected_ctc", /\bexpected (ctc|salary|compensation|pay)\b|\bsalary expectation|\bdesired (salary|pay)\b/],
  ["current_ctc", /\bcurrent (ctc|salary|compensation|pay)\b/],
  ["relocate", /\brelocat/],
  ["commute", /\bcommut/],
  ["onsite", /\b(on-?site|in office|work from (the )?office)\b/],
  ["remote", /\bremote(ly)?\b|work from home\b/],
  ["hybrid", /\bhybrid\b/],
  ["sponsorship", /\bsponsor/],
  ["work_authorization", /\b(authori[sz]ed|legally (eligible|allowed)|work permit|right to work|eligible to work)\b/],
  ["background_check", /\bbackground (check|verification)\b/],
  ["drug_test", /\bdrug (test|screen)/],
  ["degree", /\b(bachelor|master|degree|graduat)/],
  ["linkedin_url", /\blinkedin\b.*\b(url|profile|link)\b/],
  ["github_url", /\bgithub\b/],
  ["portfolio_url", /\bportfolio\b|\bpersonal website\b/],
  ["gender", /\bgender\b/],
  ["race", /\b(race|ethnicity)\b/],
  ["veteran", /\bveteran\b/],
  ["disability", /\bdisabilit/],
  ["city", /\b(current )?(city|location)\b(?!.*\brelocat)/],
  ["start_date", /\bstart date\b|\bavailable to start\b/],
  ["shift", /\b(night|rotational|evening) shift/],
];

/** Skill named in a question ("... with React?" -> "react"), or "". */
function skillOf(text) {
  const t = normalizeLabel(text);
  for (const [re, name] of SKILL_ALIASES) if (re.test(t)) return name;
  const m = t.match(/\b(?:experience (?:in|with|using|on)|years (?:of|in|with) (?:\w+ )?(?:experience )?(?:in|with|using)?)\s+([a-z0-9+#.\- ]{2,30}?)(?:\?|$| and | or | do | have |,)/);
  return m ? m[1].trim().replace(/\s+/g, "-") : "";
}

/**
 * Concept key of a question, e.g. "years:react", "language:english", "notice_period", or "" when
 * the question is not one of the known kinds. Same key = same question for the answer bank.
 */
function questionConcept(label) {
  const t = normalizeLabel(label);
  if (/\byears?\b|\bhow (long|many)\b|\bexperience\b/.test(t) && /\bexperience\b|\bworked\b|\bused\b|\bhands-on\b/.test(t)) {
    const skill = skillOf(t);
    return skill ? `years:${skill}` : "years:total";
  }
  const lang = t.match(/\b(english|hindi|french|german|spanish|japanese|mandarin|arabic|punjabi)\b.*\b(proficien|fluen|level|speak|communicat)|\b(proficien|fluen|level)\w*\b.*\b(english|hindi|french|german|spanish|japanese|mandarin|arabic|punjabi)\b/);
  if (lang) return `language:${lang[1] || lang[4]}`;
  const cert = t.match(/\b(certif\w*|certified)\b.*\b(aws|azure|gcp|pmp|scrum|cissp|ccna|google|microsoft|oracle|salesforce)\b/);
  if (cert) return `certification:${cert[2]}`;
  for (const [key, re] of CONCEPTS) if (re.test(t)) return key;
  return "";
}

/** Character-trigram cosine similarity (0..1): catches rewordings that share few whole words. */
function trigramSimilarity(a, b) {
  const grams = (s) => {
    const t = ` ${normalizeLabel(s).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()} `;
    const m = new Map();
    for (let i = 0; i < t.length - 2; i += 1) m.set(t.slice(i, i + 3), (m.get(t.slice(i, i + 3)) || 0) + 1);
    return m;
  };
  const x = grams(a);
  const y = grams(b);
  let dot = 0;
  let nx = 0;
  let ny = 0;
  for (const [g, c] of x) {
    nx += c * c;
    if (y.has(g)) dot += c * y.get(g);
  }
  for (const c of y.values()) ny += c * c;
  return nx && ny ? dot / Math.sqrt(nx * ny) : 0;
}

// ---------------------------------------------------------------- 2 + 3. candidates
const FUZZY_STOPWORDS = new Set(
  "the a an you your do does have has of in to with are is for what how many much please and or on at this that as be we our us any if will can".split(" "),
);
const labelTokens = (s) =>
  normalizeLabel(s)
    .replace(/[^a-z0-9+#. ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !FUZZY_STOPWORDS.has(w));

/**
 * Bank entries that are the same question in other words, best first ({ entry, via }):
 *   - same concept key ("years:react" from any wording)   -> strongest
 *   - otherwise word overlap >= 75% or trigram similarity >= 0.82
 * Always the same type family (a number answer never feeds a yes/no question), and two questions
 * with DIFFERENT concepts never match (years:react vs years:angular share most words).
 */
function similarBankEntries(bank, label, type) {
  const ownKey = answerBankKey(label);
  const concept = questionConcept(label);
  const mine = new Set(labelTokens(label));
  const matches = [];
  for (const [key, entry] of Object.entries(bank.entries)) {
    if (key === ownKey || typeFamily(entry.type) !== typeFamily(type)) continue;
    const theirConcept = entry.concept || questionConcept(entry.label);
    if (concept && theirConcept) {
      if (concept === theirConcept) matches.push({ entry, score: 2, via: `same question (${concept})` });
      continue; // both known concepts but different: never mix them
    }
    const theirs = new Set(labelTokens(entry.label));
    const inter = [...mine].filter((t) => theirs.has(t)).length;
    const union = new Set([...mine, ...theirs]).size;
    const words = union && mine.size >= 2 ? inter / union : 0;
    const chars = trigramSimilarity(label, entry.label);
    if (words >= 0.75 || chars >= 0.82) matches.push({ entry, score: Math.max(words, chars), via: `similar question` });
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, 3);
}

/** Converts an answer to what this question accepts, or null when it cannot fit. */
function coerceAnswer(q, raw) {
  const v = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!v) return null;
  switch (q.type) {
    case "number": {
      const m = v.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
      if (!m) return null;
      const n = Number(m[0]);
      return /whole|integer/.test(normalizeLabel(q.validation || "")) ? String(Math.round(n)) : m[0];
    }
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
    case "tel": {
      const digits = v.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15 ? v.replace(/[^\d+\-() ]/g, "").trim() : null;
    }
    case "url":
      if (/^https?:\/\/\S+$/i.test(v)) return v;
      return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v) ? `https://${v}` : null;
    case "select":
    case "radio": {
      const target = selectBestOption(q.options || [], v);
      return target ? target.text : null;
    }
    case "checkbox":
      return /^(yes|true|checked|agree|i agree|accept|1)$/i.test(v) ? "checked" : null;
    default:
      return v.length > 2000 ? v.slice(0, 2000) : v;
  }
}

/**
 * Ranked, de-duplicated candidates for a question from local sources only (no AI, no network):
 * answer bank -> screeningAnswers (dashboard) -> similar questions -> profile rules.
 * Returns [{ value, source, via }], each already converted to the question type.
 */
async function gatherAnswerCandidates(q, settings) {
  const label = q.label;
  const norm = normalizeLabel(label);
  const raw = [];
  const bank = await loadAnswerBank();

  const entry = bank.entries[answerBankKey(label)];
  if (entry) {
    for (const a of [...entry.answers].sort(rankAnswers)) {
      if ((a.fail || 0) > (a.ok || 0) + 1) continue; // rejected more often than accepted
      raw.push({ value: a.value, source: a.source === "user" ? "user" : "stored", via: "answer bank" });
    }
  }
  const saved = settings?.screeningAnswers || {};
  for (const k of [questionKeyFromLabel(label), canonicalQuestionKey(label), norm, String(label).toLowerCase()]) {
    if (k && saved[k]) raw.push({ value: saved[k], source: "user", via: "dashboard answer" });
  }
  // Same question saved with different punctuation / spacing ("... India?" vs "... india").
  const loose = (s) => normalizeLabel(s).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const looseLabel = loose(label);
  for (const [k, v] of Object.entries(saved)) {
    if (v && loose(k) === looseLabel) raw.push({ value: v, source: "user", via: "dashboard answer" });
  }
  for (const { entry: similar, via } of similarBankEntries(bank, label, q.type)) {
    for (const a of [...similar.answers].sort(rankAnswers).slice(0, 2)) {
      if ((a.fail || 0) > (a.ok || 0)) continue;
      raw.push({ value: a.value, source: "stored", via: `${via}: "${similar.label.slice(0, 50)}"` });
    }
  }
  const common = answerCommonQuestion(norm, settings);
  if (common) raw.push({ value: common, source: "profile", via: "profile" });
  if (q.type === "select") {
    const rule = getSelectRuleAnswer(norm, settings, q.options || [], "");
    if (rule) raw.push({ value: rule, source: "rule", via: "select rule" });
  }
  if (q.type === "text" || q.type === "number") {
    const structured = getStructuredTextFallback(norm, settings);
    if (structured) raw.push({ value: structured, source: "rule", via: "structured rule" });
  }
  if (q.type === "number" && isYearsExperienceQuestion(norm)) {
    raw.push({ value: getYearsFallback(settings), source: "rule", via: "years of experience" });
  }

  const out = [];
  const seen = new Set();
  for (const c of raw) {
    const value = coerceAnswer(q, c.value);
    if (value == null) continue;
    const key = normalizeLabel(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...c, value });
  }
  return out;
}

// ---------------------------------------------------------------- applying an answer
function setNativeValue(el, value) {
  // React-controlled inputs ignore a plain `el.value =`; use the prototype setter like real typing.
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

/** The answer a field currently holds ("" when empty). */
function currentAnswerOf(block, q) {
  if (q.type === "select") {
    const opt = q.control?.selectedOptions?.[0];
    const text = String(opt?.textContent || "").trim();
    return text && !isPlaceholderOptionText(text) ? text : "";
  }
  if (q.type === "radio") return (q.options || []).find((o) => o.input?.checked)?.text || "";
  if (q.type === "checkbox") return q.control?.checked ? "checked" : "";
  return String(q.control?.value || "").trim();
}

/** Writes one answer into the field. Returns true when the field changed. */
async function applyEngineAnswer(block, q, value, settings) {
  if (q.type === "select") {
    const opt = (q.options || []).find((o) => o.text === value);
    if (!opt || q.control.value === opt.value) return false;
    setNativeValue(q.control, opt.value);
    q.control.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    q.control.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  if (q.type === "radio") {
    const opt = (q.options || []).find((o) => o.text === value);
    if (!opt || opt.input?.checked) return false;
    return Boolean(await resilientClick(opt.clickTarget || opt.input, "Radio option"));
  }
  if (q.type === "checkbox") {
    if (q.control.checked) return false;
    q.control.click();
    return true;
  }
  if (q.type === "combobox") return Boolean(await applyComboboxOption(block, q.label, value, settings));
  const input = q.control;
  if (!input || String(input.value || "").trim() === String(value).trim()) return false;
  input.focus();
  setNativeValue(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  const norm = normalizeLabel(q.label);
  if (norm.includes("city") || norm.includes("location") || norm.includes("address")) {
    // location fields are typeaheads: pick the first suggestion
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  }
  input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, composed: true }));
  return true;
}

function readTriedAnswers(block) {
  try {
    return new Set(JSON.parse(block.dataset.cpTried || "[]"));
  } catch {
    return new Set();
  }
}

function markEngineAnswer(block, q, pick, tried) {
  tried.add(normalizeLabel(pick.value));
  block.dataset.cpTried = JSON.stringify([...tried].slice(-12));
  block.dataset.cpEngine = JSON.stringify({ value: pick.value, source: pick.source });
}

// ---------------------------------------------------------------- entry points
/**
 * Fills one question from local knowledge (steps 1-3). Returns { handled, changed }:
 * handled=false means nothing local fits, and the caller continues with AI and then the dashboard.
 */
async function fillFromAnswerEngine(block, settings) {
  const q = detectQuestionType(block);
  if (!q.label || ["unknown", "date", "combobox"].includes(q.type)) return { handled: false, changed: false };
  // Resume pickers keep their dedicated "newest resume" logic.
  if (q.type === "radio" && (q.options || []).some((o) => isResumeOptionText(o.text))) return { handled: false, changed: false };
  const state = getQuestionBlockState(block);
  if (state?.answered && !state.invalid && !settings.overwritePreviousAnswers) return { handled: true, changed: false };

  const tried = readTriedAnswers(block);
  const candidates = (await gatherAnswerCandidates(q, settings)).filter((c) => !tried.has(normalizeLabel(c.value)));
  if (!candidates.length) return { handled: false, changed: false };
  const pick = candidates[0];
  const changed = await applyEngineAnswer(block, q, pick.value, settings);
  markEngineAnswer(block, q, pick, tried);
  if (changed) await logLine(`Answered from ${pick.via}: ${cleanQuestionLabel(q.label).slice(0, 60)} -> ${String(pick.value).slice(0, 60)}`);
  return { handled: true, changed };
}

/**
 * After LinkedIn rejects answers on a step (a field shows an error): ranks the rejected answer down
 * and fills the next candidate not tried yet for that field: local candidates first, then AI
 * alternatives (asked with the rejected answers to avoid). Returns how many fields changed.
 */
async function retryRejectedAnswers(modal, settings) {
  if (!modal) return 0;
  let changed = 0;
  for (const block of collectQuestionBlocks(modal)) {
    const error = getQuestionBlockValidationMessage(block);
    if (!error) continue;
    const q = detectQuestionType(block);
    if (!q.label || ["unknown", "date", "combobox"].includes(q.type)) continue;
    q.validation = error;
    const tried = readTriedAnswers(block);
    const current = currentAnswerOf(block, q);
    if (current) {
      tried.add(normalizeLabel(current));
      await rememberAnswer(q.label, q.type, current, "stored", "fail");
    }
    block.dataset.cpTried = JSON.stringify([...tried].slice(-12));

    let next = (await gatherAnswerCandidates(q, settings)).find((c) => !tried.has(normalizeLabel(c.value)));
    if (!next) {
      const aiAnswers = await requestAiAnswerCandidates(q.label, q.type, (q.options || []).map((o) => o.text), error, [...tried]);
      for (const a of aiAnswers) {
        const v = coerceAnswer(q, a);
        if (v != null && !tried.has(normalizeLabel(v))) {
          next = { value: v, source: "ai", via: "AI" };
          break;
        }
      }
    }
    if (!next) continue;
    const ok = await applyEngineAnswer(block, q, next.value, settings);
    markEngineAnswer(block, q, next, tried);
    if (next.source === "ai") await rememberAnswer(q.label, q.type, next.value, "ai");
    if (ok) {
      changed += 1;
      await logLine(`LinkedIn rejected "${String(current || "(empty)").slice(0, 30)}" (${error.slice(0, 60)}). Trying ${next.via}: ${String(next.value).slice(0, 50)}`, "warn");
    }
  }
  return changed;
}

/** Answers currently in the step's fields, captured before clicking Next/Submit. */
function snapshotStepAnswers(modal) {
  const out = [];
  if (!modal) return out;
  for (const block of collectQuestionBlocks(modal)) {
    const q = detectQuestionType(block);
    if (!q.label || ["unknown", "date"].includes(q.type)) continue;
    if (q.type === "radio" && (q.options || []).some((o) => isResumeOptionText(o.text))) continue;
    const value = q.type === "combobox" ? String(getQuestionBlockState(block)?.value || "") : currentAnswerOf(block, q);
    if (!value) continue;
    let source = "stored";
    try {
      const used = JSON.parse(block.dataset.cpEngine || "null");
      if (used && normalizeLabel(used.value) === normalizeLabel(value)) source = used.source === "rule" ? "profile" : used.source;
    } catch {
      // keep "stored"
    }
    out.push({ label: q.label, type: q.type, value, source });
  }
  return out;
}

/** The step was accepted by LinkedIn: remember every answer on it as good. */
async function rememberAcceptedAnswers(snapshot) {
  for (const a of snapshot || []) await rememberAnswer(a.label, a.type, a.value, a.source, "ok");
}
