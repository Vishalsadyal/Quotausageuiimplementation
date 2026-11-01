/*
 * Indeed Jobs copilot - sidebar + auto-apply (Easily apply / Indeed Apply)
 *
 * The LinkedIn-style docked sidebar on Indeed. It reuses the LinkedIn panel's ids and panel.css (same look),
 * ICONS / PANEL_ID / TOGGLE_ID / UPGRADE_URL from src/linkedin/jobs/01-config.js and CPLinkedInWait from
 * src/linkedin/core/wait.js (both loaded first). Same design as the Naukri module (src/naukri/content_naukri.js).
 *
 * Card banners: Easily apply / Company site / Applied / Expired, from Indeed's own page data
 * (indeedApplyEnabled, appliedOrGreater, expired), read by search-data-main.js and posted here.
 *
 * Run, all in the SAME tab, always live. Start on a search page searches it, then every target job title from
 * the dashboard (up to INDEED_PAGES_PER_SEARCH pages each, &start=10, 20, ...). For each Easily apply job that
 * fits the dashboard filters:
 *   highlight the card --> /viewjob?jk=<id> --> its "Apply now" link (Indeed opens it in a new tab; we open it
 *   in this one) --> smartapply.indeed.com form: fill empty fields from the answer bank, ask in the sidebar what
 *   it can't answer, Continue ... "Submit your application" --> /form/post-apply (Indeed's confirmation)
 *   --> back to the results --(20-45 s)--> next job.
 * The form is on another site (smartapply.indeed.com), so the run state lives in chrome.storage.local (shared by
 * both Indeed sites), cached in memory for synchronous reads; navigation waits for pending writes.
 * Each confirmed apply is reported as APPLIED / SUBMITTED, provider "indeed": 1 free apply or 1 Hire.
 */

const INDEED_RUN_KEY = "cpIndeedRun";
const INDEED_PREFS_KEY = "cpIndeedPanelPrefs";
const INDEED_DAILY_KEY = "cpIndeedDaily";
const INDEED_QUOTA_KEY = "cpIndeedQuota";
const INDEED_DEBUG_KEY = "cpIndeedDebug";
const INDEED_PANEL_WIDTH = 410;
const INDEED_PAGES_PER_SEARCH = 5;
const INDEED_PACE_MS = [20000, 45000];
const INDEED_FOCUS_CARD_MS = 2500;
const INDEED_READ_JOB_MS = [2000, 3500];
const INDEED_READ_STEP_MS = [1500, 3000];
const INDEED_CONFIRMATION_WAIT_MS = [3000, 4000];
const INDEED_MAX_FORM_STEPS = 15;
const INDEED_CHALLENGE_TEXT = /verify you are (a )?human|are you a robot|unusual activity|security check|additional verification required/i;

let indeedPanel = null;
let indeedJobs = [];
let indeedTab = "jobs";
let indeedBusy = false;
let indeedLeaving = false;
let indeedQuota = null;
/** jobId -> { easy, applied, expired, title, company, snippet } from Indeed's page data. */
const indeedPageJobs = new Map();
let indeedSpotJobId = ""; // card in focus during the wait before the next job
let indeedRescannedUrl = ""; // results page already re-checked since it loaded

// ------------------------------------------------------------------ pages
const isIndeedApplySite = () => /^smartapply\./i.test(location.hostname);
const isIndeedConfirmationPage = () => isIndeedApplySite() && /post-apply/i.test(location.pathname);
const isIndeedApplyForm = () => isIndeedApplySite() && !isIndeedConfirmationPage();
const isIndeedJobPage = () => !isIndeedApplySite() && /^\/viewjob/i.test(location.pathname);
function isIndeedListPage() {
  if (isIndeedApplySite()) return false;
  const path = location.pathname.toLowerCase();
  return path === "/jobs" || path === "/jobs/" || /^\/q-[a-z0-9-]+-jobs\.html$/.test(path);
}
const indeedJobIdFromUrl = (url = location.href) => {
  try {
    return new URL(url, location.href).searchParams.get("jk") || new URL(url, location.href).searchParams.get("vjk") || "";
  } catch {
    return "";
  }
};

// ------------------------------------------------------------------ helpers
const indeedClean = (text) => String(text || "").replace(/\s+/g, " ").trim();
const indeedTime = () => new Date().toTimeString().slice(0, 8);
const indeedSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const indeedRandom = ([min, max]) => Math.round(min + Math.random() * (max - min));
const indeedToday = () => new Date().toISOString().slice(0, 10);
const indeedNorm = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();

function indeedEscape(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function indeedAssetUrl(path) {
  try {
    return chrome.runtime.getURL(path);
  } catch {
    return "";
  }
}

function indeedMessage(message, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    try {
      chrome.runtime.sendMessage(message, (response) => {
        void chrome.runtime.lastError;
        clearTimeout(timer);
        resolve(response || null);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

// ------------------------------------------------------------------ run state (chrome.storage.local, cached)
// in.indeed.com and smartapply.indeed.com don't share sessionStorage, so the run lives in the extension's
// storage. Reads come from the in-memory copy (loaded before anything runs); writes update it at once and
// are flushed in the background; navigation waits for the last write.
// Everything on this page shares ONE run object (no stale copies overwriting newer feed lines); writes are
// tagged with this page's id so its own storage echoes don't replace it.
const indeedStore = { run: null, daily: null, quota: null, debug: [], writes: Promise.resolve() };
const INDEED_PAGE_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function loadIndeedStore() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([INDEED_RUN_KEY, INDEED_DAILY_KEY, INDEED_QUOTA_KEY, INDEED_DEBUG_KEY], (data) => {
        void chrome.runtime.lastError;
        indeedStore.run = data?.[INDEED_RUN_KEY] || null;
        indeedStore.debug = Array.isArray(data?.[INDEED_DEBUG_KEY]) ? data[INDEED_DEBUG_KEY] : [];
        indeedStore.daily = data?.[INDEED_DAILY_KEY] || null;
        indeedQuota = data?.[INDEED_QUOTA_KEY] || null;
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

function indeedPersist(key, value) {
  indeedStore.writes = indeedStore.writes.then(
    () =>
      new Promise((resolve) => {
        try {
          if (value === null) chrome.storage.local.remove(key, () => resolve());
          else chrome.storage.local.set({ [key]: value }, () => resolve());
        } catch {
          resolve();
        }
      })
  );
}

const loadIndeedRun = () => indeedStore.run;

/** The page's visible text without our sidebar (its Activity log quotes Indeed's messages). */
function indeedPageText() {
  if (!document.body) return "";
  return Array.from(document.body.children)
    .filter((el) => el.id !== PANEL_ID && el.id !== TOGGLE_ID && !el.matches?.("script, style"))
    .map((el) => el.innerText || "")
    .join("\n");
}

// ------------------------------------------------------------------ debug log (chrome.storage.local cpIndeedDebug, for support)
/** A debug line: what the run read and decided (kept across pages, last 150). */
function indeedDebug(label, data) {
  const entry = { t: new Date().toLocaleTimeString(), page: location.pathname.split("/").pop() || location.hostname, label, data: data === undefined ? null : JSON.parse(JSON.stringify(data)) };
  indeedStore.debug = [...indeedStore.debug, entry].slice(-150);
  indeedPersist(INDEED_DEBUG_KEY, indeedStore.debug);
}

/** The dashboard settings the Indeed run uses, as the extension has them. */
function indeedSettingsForDebug(settings) {
  const s = settings || {};
  const list = (v) => indeedList(v);
  const titles = list(s.searchTerms);
  return {
    jobTitles: titles.length ? `${titles.length}: ${titles.slice(0, 6).join(", ")}${titles.length > 6 ? ", ..." : ""}` : "(none)",
    locations: list(s.filterLocations).join(", ") || "(none)",
    searchLocation: s.searchLocation || "(none)",
    workMode: list(s.onSite).join(", ") || "(any)",
    jobType: list(s.jobType).join(", ") || "(any)",
    yearsOfExperience: indeedUserYears(s) ?? "(not set)",
    datePosted: s.datePosted || "(any time)",
    distanceMiles: s.distance ?? "(not set)",
    sortBy: s.sortBy || "(most recent)",
    skills: [...list(s.skills), ...list(s.oneWordKeywords), ...list(s.twoWordsKeywords)].join(", ") || "(any)",
    excludeWords: list(s.badWords).join(", ") || "(none)",
    blacklistedCompanies: list(s.blacklistedCompanies).join(", ") || "(none)",
  };
}

/** Search URL params, decoded, for the debug log. */
function indeedUrlParams(url) {
  try {
    const out = {};
    for (const [k, v] of new URL(url).searchParams) if (!["vjk", "from", "advn", "bb", "xkcb"].includes(k)) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

/** One job's facts and the run's decision, for the debug log. */
function indeedJobDebug(job, settings, result) {
  const info = indeedPageJobs.get(job.jobId) || {};
  const reason = job.type === "easy" ? indeedFilterReason(job, settings) : "";
  const decision = result ? `${result.outcome}: ${result.detail || ""}` : job.type !== "easy" ? `not Easily apply (${job.type})` : reason ? `skip: ${reason}` : "would apply";
  return {
    jobId: job.jobId,
    title: job.title,
    company: job.company || info.company || "",
    workMode: info.workMode || "",
    jobTypes: info.jobTypes || [],
    location: info.location || job.location || "",
    experience: (info.experience || []).map((e) => `${e.label} (${e.required ? "required" : "preferred"})`),
    decision,
  };
}

function saveIndeedRun(run) {
  if (run) run.writer = INDEED_PAGE_ID;
  indeedStore.run = run || null;
  indeedPersist(INDEED_RUN_KEY, run ? JSON.parse(JSON.stringify(run)) : null);
}

/** Navigate for the run once the run state is saved; retry, then reload, if the page change doesn't happen. */
async function indeedGoTo(url) {
  indeedLeaving = true;
  await indeedStore.writes;
  location.href = url;
  setTimeout(() => {
    location.assign(url);
    setTimeout(() => location.reload(), indeedTimeout(30000, 90000));
  }, indeedTimeout(30000, 90000));
}

// ------------------------------------------------------------------ today's count + Hires (same rules as Naukri)
function indeedAppliedToday() {
  const daily = indeedStore.daily;
  return daily?.date === indeedToday() ? Number(daily.applied || 0) : 0;
}

function countIndeedAppliedToday() {
  indeedStore.daily = { date: indeedToday(), applied: indeedAppliedToday() + 1 };
  indeedPersist(INDEED_DAILY_KEY, indeedStore.daily);
}

const INDEED_OUT_OF_HIRES_HTML = `Today's free applications are used up and you have no Hires left, so the run has stopped. <a href="${UPGRADE_URL}" target="_blank" rel="noopener">Upgrade or buy Hires</a> to keep applying, or come back tomorrow: free applications reset daily.`;

/** Take a balance; after a confirmed apply a HIGHER one is only believed when fresh from the portal. */
function setIndeedQuota(data, setAt = Date.now()) {
  if (!data) return;
  const lastApplied = Number(loadIndeedRun()?.lastAppliedAt || 0);
  if (lastApplied && indeedQuota && !data.unlimited && Number(data.spendable) > Number(indeedQuota.spendable)) {
    if (!(Number(setAt) > lastApplied && !data._extEstimatedAt)) return;
  }
  indeedQuota = data;
  indeedPersist(INDEED_QUOTA_KEY, data);
}

/** Applies left: the portal's spendable, else free applies + Hires (the same numbers the sidebar shows). */
function indeedSpendable(q = indeedQuota) {
  if (!q || q.unlimited) return Infinity;
  const known = (v) => v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v));
  const counts = [];
  if (known(q.spendable)) counts.push(Number(q.spendable));
  if (known(q.freeRemaining) || known(q.hireBalance)) counts.push(Math.max(0, Number(q.freeRemaining) || 0) + Math.max(0, Number(q.hireBalance) || 0));
  return counts.length ? Math.min(...counts) : NaN; // NaN: not known yet
}
const indeedOutOfHires = () => indeedSpendable() <= 0;

async function indeedHasHires() {
  const take = (r) => {
    if (r?.portalQuota?.data) setIndeedQuota(r.portalQuota.data, r.portalQuota.ts);
    return r;
  };
  const cached = take(await indeedMessage({ type: "CP_GET_PORTAL_QUOTA" }, 3000));
  const refresh = indeedMessage({ type: "CP_GET_PORTAL_QUOTA", refresh: true }, 30000).then((r) => {
    take(r);
    renderIndeedPanel();
    return r;
  });
  if (!cached?.portalQuota?.data || cached.portalQuota.stale) await Promise.race([refresh, indeedSleep(6000)]);
  return !indeedOutOfHires();
}

function indeedHiresLabel() {
  const q = indeedQuota;
  if (!q) return "checking Hires…";
  if (q.unlimited) return "Unlimited (Pro)";
  const free = Number(q.freeRemaining);
  const hires = Number(q.hireBalance);
  if (Number.isFinite(free) && Number.isFinite(hires)) {
    if (free > 0 && hires > 0) return `${free} free + ${hires} Hires left`;
    if (free > 0) return `${free} free left`;
    return `${Math.max(0, hires)} Hires left`;
  }
  const spendable = Number(q.spendable);
  return Number.isFinite(spendable) ? `${Math.max(0, spendable)} left` : "checking Hires…";
}

let indeedQuotaReadAt = 0;
let indeedQuotaRefreshAt = 0;
function pollIndeedQuota() {
  const now = Date.now();
  const justApplied = now - Number(loadIndeedRun()?.lastAppliedAt || 0) < 30000;
  if (now - indeedQuotaReadAt < (justApplied ? 2000 : 10000)) return;
  indeedQuotaReadAt = now;
  const refresh = now - indeedQuotaRefreshAt > 120000;
  if (refresh) indeedQuotaRefreshAt = now;
  void indeedMessage({ type: "CP_GET_PORTAL_QUOTA", refresh }, refresh ? 30000 : 3000).then((r) => {
    if (r?.portalQuota?.data) {
      setIndeedQuota(r.portalQuota.data, r.portalQuota.ts);
      // Out of free applies and Hires: stop now (not on the next job's Submit). An apply already being
      // submitted is left to finish.
      if (indeedOutOfHires() && loadIndeedRun()?.status === "running" && loadIndeedRun()?.phase !== "applying") stopIndeedRun(INDEED_OUT_OF_HIRES_HTML);
      renderIndeedPanel();
    }
  });
}

/** Send a result to the portal (Applications tracker; APPLIED / SUBMITTED is what gets charged). */
function reportIndeedOutcome(job, outcome, detail) {
  const jobUrl = job.jobId ? `https://${location.hostname.replace(/^smartapply\./, "in.")}/viewjob?jk=${encodeURIComponent(job.jobId)}` : "";
  void indeedMessage({
    type: "CP_RECORD_OUTCOME",
    outcomeType: { applied: "APPLIED", failed: "FAILED" }[outcome] || "SKIPPED",
    data: {
      provider: "indeed",
      jobId: job.jobId,
      externalJobId: job.jobId,
      jobUrl,
      pageUrl: jobUrl,
      title: job.title || "",
      company: job.company || "",
      reasonCode: outcome === "applied" ? "SUBMITTED" : outcome === "failed" ? "FAILED" : "SKIPPED",
      reason: String(detail || "").slice(0, 200),
    },
  }).then(() => {
    if (outcome === "applied") {
      indeedQuotaReadAt = 0;
      pollIndeedQuota();
    }
  });
  if (outcome === "applied" && indeedQuota && !indeedQuota.unlimited) {
    const q = { ...indeedQuota };
    if (Number(q.freeRemaining) > 0) q.freeRemaining = Number(q.freeRemaining) - 1;
    else if (Number(q.hireBalance) > 0) q.hireBalance = Number(q.hireBalance) - 1;
    if (Number.isFinite(Number(q.spendable))) q.spendable = Math.max(0, Number(q.spendable) - 1);
    setIndeedQuota(q);
    renderIndeedPanel();
  }
}

// ------------------------------------------------------------------ smart waits (as in the Naukri module)
const IndeedWait = window.CPLinkedInWait;
let indeedSpeed = 1;

function indeedSpeedFactor() {
  const nav = performance.getEntriesByType?.("navigation")?.[0];
  const loadMs = nav ? Number(nav.domContentLoadedEventEnd || nav.responseEnd || 0) : 0;
  return Math.min(4, Math.max(1, indeedSpeed, loadMs > 0 ? loadMs / 3000 : 1));
}
const indeedTimeout = (baseMs, maxMs = baseMs * 4) => Math.min(maxMs, Math.round(baseMs * indeedSpeedFactor()));
const indeedInflight = () => Number(document.documentElement?.dataset.cpNetInflight || 0);
const indeedOnline = () => new Promise((resolve) => (navigator.onLine ? resolve() : window.addEventListener("online", () => resolve(), { once: true })));

/** "" or: offline | challenge (captcha / verification) | login. */
function indeedPageProblem() {
  if (navigator.onLine === false) return "offline";
  if (/\/account\/login|secure\.indeed\.com\/auth/i.test(location.href)) return "login";
  const visibleCaptcha = Array.from(document.querySelectorAll("iframe[src*='hcaptcha'], iframe[src*='challenges.cloudflare.com'], iframe[title*='challenge' i]")).some(
    (f) => f.getBoundingClientRect().width > 50
  );
  if (visibleCaptcha || /just a moment|attention required/i.test(document.title) || INDEED_CHALLENGE_TEXT.test(indeedPageText().slice(0, 4000))) return "challenge";
  return "";
}

async function indeedWhenReady(check, { baseMs = 10000, maxMs = 60000 } = {}) {
  const start = Date.now();
  let offlineMs = 0;
  for (;;) {
    const problem = indeedPageProblem();
    if (problem === "offline") {
      const since = Date.now();
      setIndeedWait("Waiting for the internet connection", 60000);
      await indeedOnline();
      offlineMs += Date.now() - since;
      continue;
    }
    if (problem) return { ok: false, problem };
    const spent = Date.now() - start - offlineMs;
    const budget = indeedTimeout(baseMs, maxMs) - spent;
    if (budget <= 0 && (indeedInflight() === 0 || spent >= maxMs)) return { ok: false, problem: "timeout" };
    const slice = Math.max(1000, Math.min(budget > 0 ? budget : 2000, 5000));
    const result = IndeedWait
      ? await IndeedWait.settled(document.body, () => (indeedPageProblem() ? "problem" : check()), { timeoutMs: slice, quietMs: 400, maxQuietWaitMs: 1500, loaderGraceMs: 2500 })
      : { ok: Boolean(check()), value: check() };
    if (result.ok && result.value === "problem") continue;
    if (result.ok) {
      indeedSpeed = Math.min(4, Math.max(1, indeedSpeed * 0.7 + Math.min(4, (Date.now() - start) / 3000) * 0.3));
      return { ok: true, value: result.value, problem: "" };
    }
  }
}

async function indeedWaitWhileBusy(read, { baseMs, maxMs, busy = () => indeedInflight() > 0, everyMs = 400 }) {
  const start = Date.now();
  let offlineMs = 0;
  for (;;) {
    const value = read();
    if (value) return value;
    if (navigator.onLine === false) {
      const since = Date.now();
      await indeedOnline();
      offlineMs += Date.now() - since;
      continue;
    }
    const spent = Date.now() - start - offlineMs;
    if (spent >= maxMs || (spent >= indeedTimeout(baseMs, maxMs) && !busy())) return null;
    await indeedSleep(everyMs);
  }
}

function indeedActionable(el) {
  if (!el?.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (!(rect.width > 0 && rect.height > 0)) return false;
  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none" || style.pointerEvents === "none") return false;
  return !(el.disabled || el.getAttribute("aria-disabled") === "true");
}

/** Press like a mouse: hover, press, release, click (React apps ignore a bare element.click() at times). */
function indeedPress(el) {
  const box = el.getBoundingClientRect();
  if (box.top < 0 || box.bottom > innerHeight) el.scrollIntoView({ behavior: "smooth", block: "center" });
  const rect = el.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, composed: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, button: 0 };
  const pointer = { ...at, pointerId: 1, pointerType: "mouse", isPrimary: true };
  el.dispatchEvent(new PointerEvent("pointerover", pointer));
  el.dispatchEvent(new MouseEvent("mouseover", at));
  el.dispatchEvent(new PointerEvent("pointerdown", { ...pointer, buttons: 1 }));
  el.dispatchEvent(new MouseEvent("mousedown", { ...at, buttons: 1 }));
  el.focus?.({ preventScroll: true });
  el.dispatchEvent(new PointerEvent("pointerup", pointer));
  el.dispatchEvent(new MouseEvent("mouseup", at));
  el.dispatchEvent(new MouseEvent("click", { ...at, detail: 1 }));
}

/** Set a React-controlled input's value the way typing does (native setter + input / change / blur). */
function indeedSetValue(el, value) {
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  el.focus?.({ preventScroll: true });
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
}

// ------------------------------------------------------------------ dashboard filters (same settings as LinkedIn / Naukri)
let indeedUserSettings = null;
const indeedList = (value) =>
  (Array.isArray(value) ? value : String(value || "").split(/[,\n]/))
    .map((item) => String(item || "").trim())
    .filter(Boolean);
const indeedWords = (value) => ` ${String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim()} `;
// Both sides lowercased first: "JavaScript" in a job must match the skill "javascript" (not split to "java script").
const indeedHasWord = (text, word) => {
  const w = indeedWords(String(word || "").toLowerCase()).trim();
  return Boolean(w) && indeedWords(String(text || "").toLowerCase()).includes(` ${w} `);
};

// Why the dashboard settings are missing ("" = loaded); Start refuses to run without them.
let indeedSettingsProblem = "Loading…";
let indeedSettingsTriedAt = 0;

async function loadIndeedUserSettings() {
  indeedSettingsTriedAt = Date.now();
  if (!chrome.runtime?.id) {
    // The extension was reloaded or updated: this page's copy can't reach it any more.
    indeedSettingsProblem = "The extension was reloaded. Refresh this Indeed page.";
    return indeedUserSettings || {};
  }
  const response = await indeedMessage({ type: "CP_GET_BOOTSTRAP" }, 5000);
  if (response?.settings) {
    indeedUserSettings = response.settings;
    indeedSettingsProblem = "";
  } else if (!indeedUserSettings) indeedSettingsProblem = "No answer from the extension yet (retrying every 5 s).";
  return indeedUserSettings || {};
}

function indeedWantedTech(settings) {
  return [...new Set([...indeedList(settings?.skills), ...indeedList(settings?.oneWordKeywords), ...indeedList(settings?.twoWordsKeywords)].map((w) => w.toLowerCase()))];
}

// Dashboard job types (Full-time, Part-time, Contract, Internship, Temporary) -> Indeed's job type labels.
const INDEED_JOB_TYPES = {
  "full-time": /full[- ]?time|permanent/i,
  "part-time": /part[- ]?time/i,
  contract: /contract|freelance/i,
  internship: /intern/i,
  temporary: /temporary|contractual/i,
};

/** Years of experience from the dashboard, or null when not set. */
function indeedUserYears(settings) {
  const years = Number(settings?.currentExperience);
  return Number.isFinite(years) && years >= 0 ? years : null;
}

/**
 * Experience check, the same rule as Naukri: skip a job that asks for clearly more than you have (more than
 * 1 year above for a required skill, 2 for a preferred one), or a senior title when you have under 3 years,
 * or an intern / fresher job when you have 4+.
 */
function indeedExperienceReason({ title = "", experience = [], text = "" }, settings) {
  const years = indeedUserYears(settings);
  if (years === null) return "";
  for (const need of experience) {
    if (need.years > years + (need.required ? 1 : 2)) return `Needs ${need.years}+ years${need.label ? ` (${need.label.replace(/:\s*\d.*$/, "")})` : ""}, you have ${years}`;
  }
  const textYears = indeedTextYears(text);
  if (textYears !== null && textYears > years + 1) return `Asks for ${textYears}+ years of experience, you have ${years}`;
  if (years < 3 && /\b(senior|sr\.?|lead|principal|architect|head|manager|director|staff engineer)\b/i.test(title)) return `Senior role ("${title.slice(0, 40)}"), you have ${years} years`;
  if (years >= 4 && /\b(intern|internship|fresher|trainee|apprentice)\b/i.test(title)) return `Fresher / intern role, you have ${years} years`;
  return "";
}

/** The smallest "N years" asked for in experience wording ("3+ years of experience", "minimum 2 years"), else null. */
function indeedTextYears(text) {
  const found = [];
  const pattern = /(?:(?:minimum|min\.?|at least)\s*(?:of\s*)?(\d{1,2})(?:\.\d)?\s*\+?\s*(?:years?|yrs?))|(?:(\d{1,2})(?:\.\d)?\s*(?:\+|plus)?\s*(?:-|to|–)?\s*(?:\d{1,2}\s*)?(?:years?|yrs?)(?:'s)?\s+(?:of\s+)?(?:[\w-]+\s+){0,3}?experience)/gi;
  for (const m of String(text || "").matchAll(pattern)) {
    const n = Number(m[1] || m[2]);
    if (n > 0 && n < 30) found.push(n);
  }
  return found.length ? Math.min(...found) : null;
}

/** Why a job doesn't fit the dashboard filters ("" = it fits). */
function indeedFilterReason(job, settings) {
  const info = indeedPageJobs.get(job.jobId) || {};
  const title = info.title || job.title || "";
  const company = info.company || job.company || "";
  const blacklisted = indeedList(settings?.blacklistedCompanies).find((name) => company && indeedWords(company).includes(indeedWords(name)));
  if (blacklisted) return `Company on your blacklist (${blacklisted})`;
  const bad = indeedList(settings?.badWords).find((word) => indeedHasWord(title, word));
  if (bad) return `"${bad}" is in the title (your exclude keywords)`;

  // Work mode: Remote / Hybrid / Onsite (Flexible = any). Indeed only marks remote and hybrid jobs.
  const modes = indeedList(settings?.onSite).map((m) => m.toLowerCase());
  if (modes.length && !modes.some((m) => /flex|any/.test(m))) {
    const mode = info.workMode || "";
    const wantsOnsite = modes.some((m) => /on-?site|office/.test(m));
    if (mode && !modes.some((m) => m.includes(mode))) return `${mode === "remote" ? "Remote" : "Hybrid"} job (you want ${indeedList(settings?.onSite).join(" / ")})`;
    if (!mode && !wantsOnsite) return `Not remote / hybrid (you want ${indeedList(settings?.onSite).join(" / ")})`;
  }

  // Job type: only when Indeed says what it is.
  const wantedTypes = indeedList(settings?.jobType).map((t) => t.toLowerCase()).filter((t) => INDEED_JOB_TYPES[t]);
  // Indeed often tags internships as Full-time: an "Intern" title counts as an internship too.
  const types = [...(info.jobTypes || []), ...(/\bintern(ship)?\b/i.test(title) ? ["Internship"] : [])].filter((t) => Object.values(INDEED_JOB_TYPES).some((re) => re.test(t)));
  if (wantedTypes.length && types.length && !types.some((t) => wantedTypes.some((w) => INDEED_JOB_TYPES[w].test(t)))) return `${types.join(", ")} (you want ${indeedList(settings?.jobType).join(" / ")})`;

  // Location: your dashboard cities; remote jobs and country-wide picks always fit. When the search itself has a
  // location (l=), Indeed already searched that area with its radius (nearby towns included): no extra check.
  const searchHasPlace = Boolean(new URLSearchParams(location.search).get("l"));
  const places = searchHasPlace ? [] : indeedList(settings?.filterLocations).filter((p) => !/^(india|remote|anywhere|worldwide)$/i.test(p));
  const where = info.location || "";
  if (places.length && where && info.workMode !== "remote" && !/^(remote|india)$/i.test(where) && !places.some((p) => indeedWords(where).includes(indeedWords(p.split(",")[0])))) return `In ${where} (your locations: ${places.join(", ")})`;

  const experience = indeedExperienceReason({ title, experience: info.experience || [], text: `${info.snippet || ""} ${job.snippet || ""}` }, settings);
  if (experience) return experience;

  // Skills: a job whose title is one of your dashboard job titles fits (you chose that title); otherwise one of
  // your skills must be in the title, Indeed's summary or the skills Indeed lists for the job.
  if (indeedTitleMatch(title, settings)) return "";
  const tech = indeedWantedTech(settings);
  const text = `${title} ${info.snippet || ""} ${job.snippet || ""} ${(info.requirements || []).join(" , ")}`;
  if (tech.length && !tech.some((word) => indeedHasWord(indeedTitleWords(text), indeedTitleWords(word)))) return "No match with your skills / keywords";
  return "";
}

/** Words for title matching: "Full-Stack" / "Fullstack" -> "full stack", "Frontend" -> "front end", "Node.js" -> "node js". */
function indeedTitleWords(text) {
  return indeedWords(String(text || "").toLowerCase())
    .replace(/\bfullstack\b/g, "full stack")
    .replace(/\bfrontend\b/g, "front end")
    .replace(/\bbackend\b/g, "back end")
    .replace(/\breactjs\b/g, "react")
    .replace(/\bnodejs\b/g, "node js")
    .trim();
}

/** The dashboard job title this job's title matches (all its words, in any order: "Senior Full Stack Developer" has "full stack developer"), or "". */
function indeedTitleMatch(title, settings) {
  const have = new Set(indeedTitleWords(title).split(" "));
  return indeedList(settings?.searchTerms).find((term) => {
    const words = indeedTitleWords(term).split(" ").filter((w) => w && !/^(senior|sr|junior|jr|lead)$/.test(w));
    return words.length > 0 && words.every((w) => have.has(w));
  }) || "";
}

function indeedFiltersSummary(settings) {
  const titles = indeedList(settings?.searchTerms);
  const tech = indeedWantedTech(settings);
  const exclude = indeedList(settings?.badWords);
  const years = indeedUserYears(settings);
  const modes = indeedList(settings?.onSite);
  const types = indeedList(settings?.jobType);
  const places = indeedList(settings?.filterLocations);
  return [
    titles.length ? `${titles.length} job titles` : "no job titles",
    tech.length ? `${tech.length} skills` : "any skills",
    exclude.length ? `${exclude.length} exclude words` : "",
    years !== null ? `${years} yrs experience` : "",
    modes.length ? modes.join("/") : "",
    types.length ? types.join("/") : "",
    places.length ? `${places.length} locations` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Indeed's own filter codes for the dashboard's work mode and job type, in Indeed's sc format
 * ("0kf:attr(CF3CP)attr(DSQF7|PAXZC%2COR);", as Indeed writes it). Only codes seen in Indeed's job data:
 * Remote DSQF7, Hybrid PAXZC, Full-time CF3CP. "" when nothing applies (on-site / flexible / other types).
 */
function indeedFilterCodes(settings) {
  const attrs = [];
  if (indeedList(settings?.jobType).length === 1 && /full[- ]?time/i.test(indeedList(settings.jobType)[0])) attrs.push("attr(CF3CP)");
  const modes = indeedList(settings?.onSite).map((m) => m.toLowerCase());
  if (modes.length && !modes.some((m) => /on-?site|office|flex|any/.test(m))) {
    const codes = [modes.some((m) => m.includes("remote")) && "DSQF7", modes.some((m) => m.includes("hybrid")) && "PAXZC"].filter(Boolean);
    if (codes.length === 1) attrs.push(`attr(${codes[0]})`);
    if (codes.length === 2) attrs.push(`attr(${codes.join("|")}%2COR)`);
  }
  return attrs.length ? `0kf:${attrs.join("")};` : "";
}

const INDEED_FROMAGE = { "past 24 hours": "1", "past week": "7", "past month": "14" };
const INDEED_RADIUS_KM = [0, 5, 10, 15, 25, 35, 50, 100];
/**
 * Indeed search for a job title from the dashboard's search filters (they decide the search, like on
 * LinkedIn / Naukri): q, l (first location, not for remote-only), radius (distance), fromage (date posted),
 * sort=date (unless "Most relevant"), iafilter=1 (Easily apply only: the run can only apply to those),
 * sc (work mode / job type codes).
 */
function indeedSearchUrl(term, settings, start = 0) {
  const host = location.hostname.replace(/^smartapply\./, "in.");
  const params = new URLSearchParams({ q: String(term || "").trim() });
  const modes = indeedList(settings?.onSite).map((m) => m.toLowerCase());
  const remoteOnly = modes.length > 0 && modes.every((m) => m.includes("remote"));
  const city = String(indeedList(settings?.filterLocations)[0] || settings?.searchLocation || "").trim();
  if (city && !remoteOnly && !/^(remote|anywhere|india|worldwide)$/i.test(city)) {
    params.set("l", city);
    const miles = Number(settings?.distance);
    if (settings?.distance !== undefined && settings?.distance !== "" && Number.isFinite(miles) && miles >= 0) {
      const km = miles * 1.609;
      params.set("radius", String(INDEED_RADIUS_KM.reduce((best, r) => (Math.abs(r - km) < Math.abs(best - km) ? r : best))));
    }
  }
  const fromage = INDEED_FROMAGE[String(settings?.datePosted || "").trim().toLowerCase()];
  if (fromage) params.set("fromage", fromage);
  if (!/relevan/i.test(String(settings?.sortBy || ""))) params.set("sort", "date");
  params.set("iafilter", "1");
  const sc = indeedFilterCodes(settings);
  if (sc) params.set("sc", sc);
  if (start > 0) params.set("start", String(start));
  return `https://${host}/jobs?${params.toString()}`;
}

/** Whether a results page already is the dashboard's search (same title and same filters). */
function isIndeedSearchFor(url, target) {
  try {
    const a = new URL(url).searchParams;
    const b = new URL(target).searchParams;
    return ["q", "l", "radius", "fromage", "sort", "iafilter", "sc"].every((k) => String(a.get(k) || "").trim().toLowerCase() === String(b.get(k) || "").trim().toLowerCase());
  } catch {
    return false;
  }
}

function indeedNextPageUrl(url) {
  try {
    const u = new URL(url);
    u.searchParams.set("start", String(Number(u.searchParams.get("start") || 0) + 10));
    for (const key of ["vjk", "from", "advn"]) u.searchParams.delete(key);
    return u.toString();
  } catch {
    return "";
  }
}

const indeedCurrentTerm = () => indeedClean(new URLSearchParams(location.search).get("q") || "").toLowerCase();

// ------------------------------------------------------------------ job cards + banners
/**
 * A real job key: 16 hex characters, not Indeed's template placeholder (abcdef0123456789, seen on hidden
 * template cards), and, once the page's data has arrived, one that the page's data lists.
 */
const INDEED_PLACEHOLDER_JK = /^(abcdef0123456789|0123456789abcdef|0+)$/i;
function isRealIndeedJobKey(jk) {
  if (!/^[0-9a-f]{16}$/i.test(jk || "") || INDEED_PLACEHOLDER_JK.test(jk)) return false;
  return indeedPageJobs.size === 0 || indeedPageJobs.has(jk);
}

/** Hex digits counting up (456789abcdef0123, abcdef0123456789): Indeed's made-up key on decoy cards. */
function isCountingIndeedKey(jk) {
  const digits = String(jk || "").toLowerCase().split("").map((c) => parseInt(c, 16));
  return digits.length > 6 && digits.every((d, i) => i === 0 || d === (digits[i - 1] + 1) % 16);
}

/**
 * Decoy cards: Indeed mixes hidden copies of real cards into the list (aria-hidden, tabindex -1, a direct
 * /viewjob link, a made-up counting key, the copied card's title id). A person never sees them, so only a
 * bot would open one: never queue, flag or open them.
 */
function isIndeedDecoyLink(link) {
  const jk = link.getAttribute("data-jk") || "";
  if (isCountingIndeedKey(jk)) return true;
  if (link.closest("[aria-hidden='true']") || link.getAttribute("tabindex") === "-1") return true;
  const titleId = link.querySelector("span[id^='jobTitle-']")?.id.slice("jobTitle-".length);
  return Boolean(titleId && titleId !== jk);
}

function findIndeedCards() {
  const cards = new Set();
  for (const link of document.querySelectorAll("a[data-jk]")) {
    if (!isRealIndeedJobKey(link.getAttribute("data-jk")) || isIndeedDecoyLink(link)) continue;
    const box = link.getBoundingClientRect();
    if (!(box.width > 0 && box.height > 0)) continue; // hidden template / off-screen copy
    let card = link;
    for (let node = link.parentElement; node && node !== document.body; node = node.parentElement) {
      const keys = new Set(Array.from(node.querySelectorAll("a[data-jk]")).filter((a) => isRealIndeedJobKey(a.getAttribute("data-jk")) && !isIndeedDecoyLink(a)).map((a) => a.getAttribute("data-jk")));
      if (keys.size > 1) break;
      card = node;
    }
    if (card !== link) cards.add(card);
  }
  return Array.from(cards);
}

const indeedHasLabel = (root, pattern) => Array.from(root.querySelectorAll("span, div, p, li")).some((el) => el.children.length === 0 && pattern.test(indeedClean(el.textContent)));

function readIndeedCard(card) {
  const link = Array.from(card.querySelectorAll("a.jcs-JobTitle, h2.jobTitle a, a[data-jk]")).find((a) => isRealIndeedJobKey(a.getAttribute("data-jk")) && !isIndeedDecoyLink(a));
  const jobId = link?.getAttribute("data-jk") || "";
  const info = indeedPageJobs.get(jobId);
  const text = (selector) => indeedClean(card.querySelector(selector)?.textContent);
  const applied = info?.applied || indeedHasLabel(card, /^applied\b/i);
  const easy = info ? info.easy : indeedHasLabel(card, /^easily apply$/i);
  return {
    jobId,
    url: jobId ? `${location.origin}/viewjob?jk=${encodeURIComponent(jobId)}` : "",
    title: indeedClean(info?.title || link?.textContent).replace(/^new\s+/i, ""),
    company: info?.company || text("[data-testid='company-name']"),
    location: text("[data-testid='text-location']"),
    salary: text("[data-testid*='salary-snippet']"),
    snippet: info?.snippet || "",
    type: applied ? "applied" : info?.expired ? "expired" : easy ? "easy" : "company",
    applied,
    card,
  };
}

function readIndeedPageJobs() {
  const seen = new Set();
  return findIndeedCards()
    .map(readIndeedCard)
    .filter((job) => job.jobId && !seen.has(job.jobId) && seen.add(job.jobId));
}

const INDEED_FLAG_ICONS = {
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
};
const indeedFlagIcon = (name, color) =>
  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex:none" aria-hidden="true">${INDEED_FLAG_ICONS[name]}</svg>`;
const INDEED_FLAG_STYLES = {
  easy: { text: "Easily apply", sub: "AutoApply CV can apply", color: "#4f38e0", bg: "#f4f2ff", border: "#d4ccff", icon: "bolt", iconColor: "#6047f5" },
  company: { text: "Apply on company site", sub: "AutoApply CV skips it", color: "#4b5563", bg: "#f9fafb", border: "#e5e7eb", icon: "external", iconColor: "#9ca3af" },
  expired: { text: "Expired", sub: "no longer open", color: "#4b5563", bg: "#f9fafb", border: "#e5e7eb", icon: "clock", iconColor: "#9ca3af" },
  applied: { text: "Already applied", sub: "", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0", icon: "check", iconColor: "#10b981" },
  "applied-run": { text: "Applied by AutoApply CV", sub: "", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0", icon: "check", iconColor: "#10b981" },
};

function flagIndeedCards() {
  const appliedInRun = new Set((loadIndeedRun()?.results || []).filter((r) => r.outcome === "applied").map((r) => r.jobId));
  for (const card of findIndeedCards()) {
    const job = readIndeedCard(card);
    const kind = appliedInRun.has(job.jobId) ? "applied-run" : job.type;
    const style = INDEED_FLAG_STYLES[kind];
    const existing = card.querySelector(".cp-indeed-flag");
    if (existing?.dataset.kind === kind) continue;
    existing?.remove();
    if (!style) continue;
    const flag = document.createElement("div");
    flag.className = "cp-indeed-flag";
    flag.dataset.kind = kind;
    flag.style.cssText = `display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0;padding:5px 10px;border-radius:8px;border:1px solid ${style.border};background:${style.bg};color:${style.color};font:600 12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif`;
    flag.innerHTML = `${indeedFlagIcon(style.icon, style.iconColor)}<span>${indeedEscape(style.text)}</span>${style.sub ? `<span style="font-weight:500;opacity:.75">${indeedEscape(style.sub)}</span>` : ""}`;
    card.prepend(flag);
  }
}

function spotlightIndeedCard(jobId, kind, label, { scroll = true } = {}) {
  const card = findIndeedCards().find((c) => readIndeedCard(c).jobId === jobId);
  if (!card) return null;
  const colors = { next: "#6047f5", applied: "#10b981", done: "#9ca3af" };
  if (scroll) card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.style.transition = "box-shadow .4s ease";
  card.style.boxShadow = `0 0 0 3px ${colors[kind]}, 0 8px 24px rgba(0,0,0,.12)`;
  card.querySelector(".cp-indeed-spot")?.remove();
  if (label) {
    const tag = document.createElement("div");
    tag.className = "cp-indeed-spot";
    tag.style.cssText = `display:inline-block;margin:4px 0;padding:3px 10px;border-radius:999px;background:${colors[kind]};color:#fff;font:700 12px/1.5 system-ui,-apple-system,Segoe UI,sans-serif`;
    tag.textContent = label;
    card.prepend(tag);
  }
  return card;
}

function clearIndeedSpotlight(card) {
  if (!card) return;
  card.style.boxShadow = "";
  card.querySelector(".cp-indeed-spot")?.remove();
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "cp-indeed-jobs" || !Array.isArray(event.data.jobs)) return;
  for (const job of event.data.jobs) if (job?.jobId) indeedPageJobs.set(String(job.jobId), job);
  if (indeedPanel) flagIndeedCards();
});

// ------------------------------------------------------------------ feed + waits
function addIndeedFeed(icon, html) {
  const run = loadIndeedRun() || { feed: [] };
  run.feed = [...(run.feed || []), { icon, html, time: indeedTime() }].slice(-80);
  run.progressAt = Date.now();
  saveIndeedRun(run);
  renderIndeedPanel();
}

function setIndeedWait(label, ms, logLine) {
  const run = loadIndeedRun();
  if (!run) return;
  run.wait = { label, until: Date.now() + ms };
  saveIndeedRun(run);
  if (logLine) addIndeedFeed(ICONS.clock, indeedEscape(logLine));
  else renderIndeedPanel();
}

function setIndeedStatus(text) {
  const badge = indeedPanel?.querySelector("#cp-status-badge");
  if (badge && badge.textContent !== text) badge.textContent = text;
}

// ------------------------------------------------------------------ run: start / pause / stop / results
async function startIndeedRun() {
  const existing = loadIndeedRun();
  if (existing?.status === "paused") return resumeIndeedRun();
  if (existing?.status === "running" || !isIndeedListPage()) return;
  if (!(await indeedHasHires())) {
    addIndeedFeed(ICONS.alert, INDEED_OUT_OF_HIRES_HTML);
    return;
  }
  const settings = await loadIndeedUserSettings();
  if (indeedSettingsProblem) {
    // Never run without the dashboard filters (it would apply to everything).
    addIndeedFeed(ICONS.alert, `Couldn't load your dashboard filters: ${indeedEscape(indeedSettingsProblem)} Press Start again in a moment.`);
    return;
  }
  // The dashboard's job titles decide the search (starting with this page's title when it is one of them);
  // with no titles on the dashboard, this page's title.
  const titles = [...new Set(indeedList(settings.searchTerms).map((t) => t.toLowerCase()))];
  const here = indeedCurrentTerm();
  const terms = titles.length ? (titles.includes(here) ? [here, ...titles.filter((t) => t !== here)] : titles) : [here].filter(Boolean);
  const target = terms.length ? indeedSearchUrl(terms[0], settings) : location.href;
  saveIndeedRun({
    status: "running",
    returnUrl: location.href,
    queue: [],
    index: 0,
    needsQueue: true,
    plan: { terms, termIndex: 0, pagesDone: 0 },
    nextAt: Date.now(),
    results: [],
    feed: (existing?.feed || []).slice(-40),
  });
  indeedDebug("Start", { dashboard: indeedSettingsForDebug(settings), searchUrl: target, thisPage: location.href, titles: terms.length });
  addIndeedFeed(ICONS.play, `Run started with your dashboard filters: ${indeedEscape(indeedFiltersSummary(settings))}. ${terms.length} job titles, starting with <strong>${indeedEscape(terms[0] || "this page")}</strong>.`);
  indeedTab = "feed";
  // This page was searched with other filters (Indeed's own, or none): open the dashboard's search instead.
  if (!isIndeedSearchFor(location.href, target)) {
    addIndeedFeed(ICONS.search, "Opening the Indeed search with your dashboard filters…");
    void indeedGoTo(target);
  }
}

function pauseIndeedRun(reason) {
  const run = loadIndeedRun();
  if (!run || run.status !== "running") return;
  run.status = "paused";
  saveIndeedRun(run);
  addIndeedFeed(ICONS.pause, reason || "Paused. Press Resume to continue.");
}

function resumeIndeedRun() {
  const run = loadIndeedRun();
  if (!run || run.status !== "paused") return;
  run.status = "running";
  run.nextAt = Date.now();
  saveIndeedRun(run);
  addIndeedFeed(ICONS.play, "Resumed.");
}

function stopIndeedRun(reason) {
  const run = loadIndeedRun();
  if (!run || run.status === "done" || run.status === "stopped") return;
  run.status = "stopped";
  run.phase = null;
  run.endedAt = Date.now();
  saveIndeedRun(run);
  addIndeedFeed(ICONS.stop, reason || "Stopped.");
}

function finishIndeedRun() {
  const run = loadIndeedRun();
  if (!run) return;
  run.status = "done";
  run.endedAt = Date.now();
  saveIndeedRun(run);
  const count = (outcome) => run.results.filter((r) => r.outcome === outcome).length;
  addIndeedFeed(ICONS.check, `Run finished: <strong>${count("applied")}</strong> applied, ${count("skipped")} skipped, ${count("failed")} failed. Every job title from your dashboard was searched.`);
}

/** Record a job's result, report it, and plan the human-pace pause before the next one. */
function recordIndeedResult(run, job, outcome, detail) {
  run.results.push({ jobId: job.jobId, url: job.url, title: job.title, company: job.company, outcome, detail, ts: indeedTime() });
  reportIndeedOutcome(job, outcome, detail);
  run.index += 1;
  run.phase = null;
  run.applyUrl = null;
  run.nextAt = Date.now() + indeedRandom(INDEED_PACE_MS);
  if (outcome === "applied") run.lastAppliedAt = Date.now();
  run.wait = null;
  saveIndeedRun(run);
}

function finishIndeedJob(run, job, outcome, detail) {
  recordIndeedResult(run, job, outcome, detail);
  const icon = { applied: ICONS.check, skipped: ICONS.skip, failed: ICONS.alert }[outcome] || ICONS.sparkle;
  const label = { applied: "Applied", skipped: "Skipped", failed: "Failed" }[outcome] || outcome;
  addIndeedFeed(icon, `<strong>${label}:</strong> ${indeedEscape(job.title || "job")}. ${indeedEscape(detail)}`);
  const latest = loadIndeedRun();
  if (latest?.status !== "running" || !latest.returnUrl) return;
  const seconds = Math.max(0, Math.round((latest.nextAt - Date.now()) / 1000));
  if (isIndeedConfirmationPage()) {
    indeedLeaving = true;
    const stay = indeedRandom(INDEED_CONFIRMATION_WAIT_MS);
    setIndeedWait("Staying on Indeed's confirmation page", stay, `Staying ${Math.round(stay / 1000)} s on Indeed's confirmation page.`);
    addIndeedFeed(ICONS.clock, `Waiting ${seconds} s before the next job (human pace).`);
    setTimeout(() => {
      if (loadIndeedRun()?.status === "running") void indeedGoTo(latest.returnUrl);
      else indeedLeaving = false;
    }, stay);
    return;
  }
  addIndeedFeed(ICONS.clock, `Waiting ${seconds} s before the next job (human pace).`);
  void indeedGoTo(latest.returnUrl);
}

/**
 * On a results page: queue the Easily apply jobs that fit the dashboard filters.
 * With rescan (coming back after a job), Indeed has usually refreshed and reshuffled the list, so every
 * card is checked again: jobs still waiting stay queued, new Easily apply jobs are added, and jobs that
 * Indeed now shows as applied or expired are dropped.
 */
async function queueIndeedPage(run, rescan = false) {
  const settings = await loadIndeedUserSettings();
  setIndeedStatus("Loading jobs…");
  window.postMessage({ source: "cp-indeed-request" }, location.origin);
  const ready = await indeedWhenReady(() => {
    if (/did not match any jobs|no jobs found/i.test(indeedPageText())) return "none";
    const cards = findIndeedCards();
    return cards.length && indeedPageJobs.size ? "jobs" : null;
  }, { baseMs: 15000, maxMs: 90000 });
  if (!ready.ok && ready.problem === "challenge") return pauseIndeedRun("Indeed is asking you to verify you're human. Solve it on the page, then press <strong>Resume</strong>.");
  indeedJobs = readIndeedPageJobs();
  const done = new Set(run.results.map((r) => r.jobId));
  const onPage = new Map(indeedJobs.map((job) => [job.jobId, job]));
  const pending = rescan ? run.queue.slice(run.index).filter((q) => !done.has(q.jobId) && !["applied", "expired"].includes(onPage.get(q.jobId)?.type)) : [];
  const queue = [...pending];
  let company = 0;
  let filtered = 0;
  for (const job of indeedJobs) {
    if (done.has(job.jobId) || queue.some((q) => q.jobId === job.jobId)) continue;
    if (job.type !== "easy") {
      if (job.type === "company") company += 1;
      continue;
    }
    const reason = indeedFilterReason(job, settings);
    if (reason) {
      filtered += 1;
      run.results.push({ jobId: job.jobId, url: job.url, title: job.title, company: job.company, outcome: "skipped", detail: reason, ts: indeedTime() });
      reportIndeedOutcome(job, "skipped", reason);
      continue;
    }
    queue.push({ jobId: job.jobId, url: job.url, title: job.title, company: job.company });
  }
  indeedDebug(rescan ? "Results page re-checked" : "Results page read", {
    search: indeedUrlParams(location.href),
    matchesDashboard: isIndeedSearchFor(location.href, indeedSearchUrl(run.plan?.terms?.[run.plan.termIndex] || indeedCurrentTerm(), settings)),
    cards: indeedJobs.length,
    pageData: indeedPageJobs.size,
    queued: queue.map((q) => q.title),
    companySite: company,
    jobs: indeedJobs.map((job) => {
      const d = indeedJobDebug(job, settings, run.results.find((r) => r.jobId === job.jobId));
      return `${d.title} | ${d.workMode || "on-site?"} | ${d.jobTypes.join("/") || "type?"} | ${d.location} | ${d.experience.join("; ") || "-"} => ${d.decision}`;
    }),
  });
  if (rescan) {
    const added = queue.length - pending.length;
    Object.assign(run, { queue, index: 0, shownResult: run.results.length });
    saveIndeedRun(run);
    if (added || filtered) addIndeedFeed(ICONS.search, `Indeed refreshed the list: checked all ${indeedJobs.length} cards again, <strong>${added}</strong> new to apply${filtered ? `, ${filtered} new skipped by your filters` : ""}. ${queue.length} left on this page.`);
    return;
  }
  Object.assign(run, { queue, index: 0, needsQueue: false, returnUrl: location.href, shownResult: run.results.length, nextAt: Date.now() + 1500, emptyPage: indeedJobs.length === 0 });
  saveIndeedRun(run);
  const term = run.plan?.terms?.[run.plan.termIndex] || indeedCurrentTerm();
  addIndeedFeed(queue.length ? ICONS.target : ICONS.skip, `<strong>${indeedEscape(term || "This page")}</strong>, page ${(run.plan?.pagesDone || 0) + 1}: <strong>${queue.length}</strong> to apply${filtered ? `, ${filtered} skipped by your filters` : ""}${company ? `, ${company} company site` : ""}.`);
}

function advanceIndeedSearch(run) {
  const plan = run.plan || { terms: [], termIndex: 0, pagesDone: 0 };
  plan.pagesDone += 1;
  let url = !run.emptyPage && plan.pagesDone < INDEED_PAGES_PER_SEARCH ? indeedNextPageUrl(run.returnUrl) : "";
  if (!url) {
    plan.termIndex += 1;
    plan.pagesDone = 0;
    if (plan.termIndex < plan.terms.length) url = indeedSearchUrl(plan.terms[plan.termIndex], indeedUserSettings);
  }
  run.plan = plan;
  if (!url) {
    saveIndeedRun(run);
    return finishIndeedRun();
  }
  Object.assign(run, { needsQueue: true, queue: [], index: 0 });
  saveIndeedRun(run);
  indeedDebug(plan.pagesDone ? "Next page" : "Next job title", { title: plan.terms[plan.termIndex] || "", url });
  addIndeedFeed(ICONS.search, plan.pagesDone ? `Next page of <strong>${indeedEscape(plan.terms[plan.termIndex] || "this search")}</strong>…` : `Next job title: <strong>${indeedEscape(plan.terms[plan.termIndex])}</strong>…`);
  void indeedGoTo(url);
}

// ------------------------------------------------------------------ job page: find "Apply now", open it in this tab
async function openIndeedApplyForm(run) {
  const job = run.queue[run.index];
  addIndeedFeed(ICONS.target, `Opened <strong>${indeedEscape(job.title || "job")}</strong>${job.company ? ` at ${indeedEscape(job.company)}` : ""}.`);
  setIndeedStatus("Loading job…");
  const ready = await indeedWhenReady(() => {
    if (/we can.t find this page|this job has expired|job (is )?no longer available/i.test(indeedPageText())) return { gone: true };
    // A link, or (newer layout) a button; a greyed-out one reads "Applied".
    const easy = document.querySelector("a[data-testid='viewjob-indeed-apply'], button[data-testid='viewjob-indeed-apply']:not([disabled]):not([aria-disabled='true']), #indeedApplyButton:not([disabled]), [data-testid='indeedApplyButton-test']");
    const company = document.querySelector("a[data-testid='viewjob-apply'], #applyButtonLinkContainer a");
    const applied = Array.from(document.querySelectorAll("button, a, span, div")).find((el) => el.children.length === 0 && /^(applied|you applied)/i.test(indeedClean(el.textContent)));
    if (easy || company || applied) return { easy, company, applied };
    return null;
  }, { baseMs: 20000, maxMs: 120000 });
  if (!ready.ok) {
    if (ready.problem === "challenge") return pauseIndeedRun("Indeed is asking you to verify you're human. Solve it on the page, then press <strong>Resume</strong>.");
    return finishIndeedJob(run, job, "failed", "The job page didn't show an Apply button, even after waiting for it to load.");
  }
  if (ready.value.gone) return finishIndeedJob(run, job, "skipped", "Indeed says this job page doesn't exist or has expired.");
  // The full description often says more about experience than the search card ("3+ years of experience").
  const description = document.querySelector("#jobDescriptionText")?.innerText || "";
  const tooSenior = indeedExperienceReason({ text: description }, await loadIndeedUserSettings());
  indeedDebug("Job page experience check", {
    job: job.title,
    yearsAsked: indeedTextYears(description),
    lines: description.split(/\n/).filter((l) => /experience|years?|yrs/i.test(l)).map((l) => l.trim().slice(0, 140)).slice(0, 8),
    decision: tooSenior || "fits",
  });

  if (tooSenior) return finishIndeedJob(run, job, "skipped", tooSenior);
  const { easy, company, applied } = ready.value;
  if (applied && !easy) return finishIndeedJob(run, job, "skipped", "Already applied.");
  if (!easy && company) return finishIndeedJob(run, job, "skipped", "Applies on the company site.");
  const href = easy.href || easy.getAttribute("href") || "";
  easy.scrollIntoView({ behavior: "smooth", block: "center" });
  easy.style.outline = "3px solid #6047f5";
  easy.style.outlineOffset = "3px";
  const reading = indeedRandom(INDEED_READ_JOB_MS);
  setIndeedWait("Reading the job", reading);
  await indeedSleep(reading);
  easy.style.outline = "";
  if (!(await indeedHasHires())) return stopIndeedRun(INDEED_OUT_OF_HIRES_HTML);
  run.phase = "applying";
  run.applyUrl = href;
  run.formSteps = 0;
  saveIndeedRun(run);
  if (href && /^https:\/\/smartapply\.indeed\.com\//i.test(href)) {
    // Indeed opens the form in a new tab (target=_blank): open the same address in this tab instead.
    addIndeedFeed(ICONS.bolt, "Opening Indeed's application form in this tab…");
    void indeedGoTo(href);
  } else {
    // No direct link (older layout): press it; if Indeed opens a new tab, that tab continues the run.
    addIndeedFeed(ICONS.bolt, "Pressing Apply now…");
    indeedPress(easy);
  }
}

// ------------------------------------------------------------------ the application form (smartapply.indeed.com)
const indeedFormRoot = () => document.querySelector("main, #ia-container, [class*='ia-BasePage']") || document.body;

function indeedFieldLabel(input) {
  const byFor = input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
  if (byFor && !["radio", "checkbox"].includes(input.type)) return indeedClean(byFor.textContent);
  const labelled = input.getAttribute("aria-labelledby");
  if (labelled) {
    const text = labelled.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ");
    if (indeedClean(text)) return indeedClean(text);
  }
  const legend = input.closest("fieldset")?.querySelector("legend");
  if (legend) return indeedClean(legend.textContent);
  if (byFor) return indeedClean(byFor.textContent);
  const near = input.closest("[class*='question' i], [data-testid*='question' i], li, div")?.querySelector("label, legend, [class*='label' i]");
  return indeedClean(near?.textContent || input.getAttribute("aria-label") || input.placeholder || "");
}

function indeedOptionText(input) {
  const byFor = input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
  return indeedClean(byFor?.textContent || input.closest("label")?.textContent || input.getAttribute("aria-label") || input.value || "");
}

/**
 * The questions on this step that still need an answer: empty text / number / textarea fields, unpicked
 * radio groups and dropdowns, required checkbox groups with nothing ticked. Prefilled fields (Indeed fills
 * contact info from the profile) and optional ones ("(optional)") are left alone.
 */
function readIndeedQuestions() {
  const root = indeedFormRoot();
  const visible = (el) => el.getBoundingClientRect().width > 0 && !el.closest(`#${PANEL_ID}`);
  const inputs = Array.from(root.querySelectorAll("input, textarea, select")).filter((el) => el.type !== "hidden" && el.type !== "file" && visible(el));
  const questions = [];
  const groups = new Map();
  for (const el of inputs) {
    if (el.type === "radio" || el.type === "checkbox") {
      const key = el.name || el.closest("fieldset")?.id || indeedFieldLabel(el);
      const g = groups.get(key) || { type: el.type, label: indeedFieldLabel(el), inputs: [] };
      g.inputs.push(el);
      groups.set(key, g);
      continue;
    }
    const label = indeedFieldLabel(el);
    const optional = /\(optional\)/i.test(label) && !el.required;
    if (optional) continue;
    if (el.tagName === "SELECT") {
      const chosen = el.value && el.selectedIndex > 0;
      if (!chosen) questions.push({ type: "select", label, el, options: Array.from(el.options).filter((o) => o.value).map((o) => ({ text: indeedClean(o.textContent), value: o.value })) });
      continue;
    }
    if (!String(el.value || "").trim()) questions.push({ type: el.type === "number" ? "number" : el.tagName === "TEXTAREA" ? "textarea" : el.type === "date" ? "date" : "text", label, el, options: [] });
  }
  for (const g of groups.values()) {
    if (g.inputs.some((i) => i.checked)) continue;
    const optional = /\(optional\)/i.test(g.label) && !g.inputs.some((i) => i.required);
    if (optional || (g.type === "checkbox" && g.inputs.length === 1 && !g.inputs[0].required)) continue;
    questions.push({ type: g.type, label: g.label, options: g.inputs.map((i) => ({ text: indeedOptionText(i), el: i })) });
  }
  return questions.filter((q) => q.label);
}

const INDEED_SKIP_OPTION = /^(skip|prefer not to (say|answer)|i'?d rather not (say|answer)|decline to (answer|self.identify))$/i;

/** Best option for an answer: exact, whole word/phrase either way, then a number inside an option's range. */
function matchIndeedOption(options, answer, { allowSkip = false } = {}) {
  const target = indeedNorm(answer);
  if (!target) return null;
  const usable = options.filter((o) => allowSkip || !INDEED_SKIP_OPTION.test(indeedClean(o.text)));
  const padded = (v) => ` ${indeedNorm(v)} `;
  const exact = usable.find((o) => indeedNorm(o.text) === target);
  if (exact) return exact;
  const inAnswer = usable.filter((o) => indeedNorm(o.text).length > 1 && padded(target).includes(padded(o.text)));
  if (inAnswer.length) return inAnswer.sort((a, b) => indeedNorm(b.text).length - indeedNorm(a.text).length)[0];
  const inOption = usable.find((o) => padded(o.text).includes(padded(target)));
  if (inOption) return inOption;
  const number = Number((String(answer).match(/-?\d+(?:\.\d+)?/) || [])[0]);
  if (Number.isFinite(number)) {
    return (
      usable.find((o) => {
        const t = String(o.text).toLowerCase();
        const range = t.match(/(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)/);
        if (range) return number >= Number(range[1]) && number <= Number(range[2]);
        const plus = t.match(/(\d+(?:\.\d+)?)\s*\+|(?:more than|above|over|at least)\s*(\d+(?:\.\d+)?)/);
        if (plus) return number >= Number(plus[1] ?? plus[2]);
        const less = t.match(/(?:less than|below|under|up to)\s*(\d+(?:\.\d+)?)/);
        return less ? number < Number(less[1]) : false;
      }) || null
    );
  }
  return null;
}

/** Answer bank first, then AI from the resume (background CP_AI_ANSWER, shared with LinkedIn / Naukri). */
/**
 * Experience questions ("Experience building LLM-powered applications", "How many years of React experience?",
 * "Do you have experience with …?") get your dashboard years of experience: the number, the range option that
 * holds it, or Yes. "" when it isn't an experience question or the years aren't set (then the AI answers).
 */
function indeedExperienceAnswer(question) {
  const years = indeedUserYears(indeedUserSettings);
  if (years === null || question.type === "textarea" || question.type === "checkbox" || question.type === "date") return "";
  const label = indeedClean(question.label);
  if (!/\bexperience\b|\byears?\b|\byrs\b/i.test(label) || /salary|ctc|notice|gap|age\b|old\b|relocat|travel|shift/i.test(label)) return "";
  if (question.type === "radio" || question.type === "select") {
    const texts = question.options.map((o) => indeedClean(o.text).toLowerCase());
    if (texts.some((t) => /^yes\b/.test(t)) && texts.some((t) => /^no\b/.test(t))) return years > 0 ? "Yes" : "No";
    return matchIndeedOption(question.options, String(years)) ? String(years) : "";
  }
  return String(years);
}

async function askIndeedAnswer(question) {
  // The form starts right after the page loads: make sure the dashboard settings (your years) are here first.
  if (!indeedUserSettings) await loadIndeedUserSettings();
  const fromYears = indeedExperienceAnswer(question);
  if (fromYears) return fromYears;
  const type = { select: "radio", radio: "radio", checkbox: "checkbox", number: "number" }[question.type] || "text";
  const options = question.options.map((o) => o.text).filter((t) => !INDEED_SKIP_OPTION.test(t));
  const response = await indeedMessage({ type: "CP_AI_ANSWER", question: question.label, questionType: type, options, jobContext: { source: "indeed" } }, 25000);
  return response?.ok ? String(response.answer || "").trim() : "";
}

/** Smoothly scroll Indeed's form to the question being answered and outline it; returns an undo. */
function focusIndeedQuestion(question) {
  const field = question.el || question.options?.[0]?.el;
  // The question's own block: its fieldset/group, else the smallest box holding both the field and its label.
  const label = field?.id ? document.querySelector(`label[for="${CSS.escape(field.id)}"]`) : field?.closest("label");
  let box = field?.closest("fieldset, [role='group'], [role='radiogroup']");
  if (!box && label) for (box = field.parentElement; box && !box.contains(label); box = box.parentElement);
  if (!box || box === indeedFormRoot() || box.contains(indeedFormButton()?.el || null)) box = field;
  if (!box?.isConnected) return () => {};
  box.scrollIntoView({ behavior: "smooth", block: "center" });
  const before = { outline: box.style.outline, offset: box.style.outlineOffset, radius: box.style.borderRadius, transition: box.style.transition };
  box.style.transition = "outline-color .3s ease";
  box.style.outline = "2px solid #6047f5";
  box.style.outlineOffset = "6px";
  box.style.borderRadius = box.style.borderRadius || "8px";
  return () => {
    box.style.outline = before.outline;
    box.style.outlineOffset = before.offset;
    box.style.borderRadius = before.radius;
    box.style.transition = before.transition;
  };
}

/** Put an answer into the field. Returns what was entered, or "" when it doesn't fit. */
function fillIndeedQuestion(question, answer, { allowSkip = false } = {}) {
  if (question.type === "radio" || question.type === "select") {
    const option = matchIndeedOption(question.options, answer, { allowSkip });
    if (!option) return "";
    if (question.type === "select") indeedSetValue(question.el, option.value);
    else indeedPress(option.el.id ? document.querySelector(`label[for="${CSS.escape(option.el.id)}"]`) || option.el : option.el);
    return option.text;
  }
  if (question.type === "checkbox") {
    const picked = String(answer)
      .split(/\s*(?:,|;|\band\b)\s*/i)
      .map((part) => matchIndeedOption(question.options, part, { allowSkip }))
      .filter(Boolean);
    for (const option of new Set(picked)) if (!option.el.checked) indeedPress(option.el);
    return picked.map((o) => o.text).join(", ");
  }
  if (question.type === "date") return "";
  let value = String(answer).trim();
  if (question.type === "number") {
    const number = (value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/) || [])[0];
    if (!number) return "";
    value = number;
  }
  indeedSetValue(question.el, value.slice(0, question.type === "textarea" ? 2000 : 300));
  return value;
}

/** Save an answer to the answer bank (extension + dashboard): automatic next time. */
function saveIndeedAnswer(question, answer) {
  const value = indeedClean(answer);
  if (!question?.label || !value) return;
  void indeedMessage({
    type: "CP_SAVE_QUESTION_ANSWER",
    questionKey: indeedNorm(question.label).replace(/\s+/g, "_").slice(0, 120),
    questionLabel: question.label,
    answer: value,
    answerType: ["radio", "select", "checkbox"].includes(question.type) ? "choice" : "text",
    fromPanel: true,
    source: "naukri", // site-specific question: never overwrite the general years-of-experience answer
  });
}

/**
 * Ask in the sidebar: options as buttons (checkboxes as toggles + Answer) or a text box with the suggestion.
 * The answer goes into the form and the answer bank. Resolves the value, or null after 3 minutes.
 */
function askIndeedInSidebar(question, suggestion) {
  const panel = indeedPanel;
  if (!panel) return Promise.resolve(null);
  let card = panel.querySelector("#cp-ask");
  if (!card) {
    card = document.createElement("div");
    card.id = "cp-ask";
    card.className = "cp-ask";
    for (const type of ["keydown", "keyup", "keypress"]) card.addEventListener(type, (event) => event.stopPropagation());
    const anchor = panel.querySelector(".cp-tab-bar");
    if (anchor) anchor.parentNode.insertBefore(card, anchor);
    else panel.appendChild(card);
  }
  const choice = ["radio", "select", "checkbox"].includes(question.type);
  const kind = { radio: "Pick one", select: "Pick one", checkbox: "Pick one or more", number: "Number", textarea: "Text", date: "Date" }[question.type] || "Text";
  const picked = new Set();
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      card.hidden = true;
      card.innerHTML = "";
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 180000);
    const show = (error = "") => {
      const chips = choice ? question.options.map((o) => o.text) : [];
      card.innerHTML = `
        <div class="cp-ask-head"><span class="cp-ask-count">Indeed question</span><span class="cp-ask-kind">${indeedEscape(kind)}</span></div>
        <div class="cp-ask-label">${indeedEscape(question.label)}</div>
        <div class="cp-ask-hint">Your answer goes into Indeed's form and your answer bank, so next time it's automatic.</div>
        ${error ? `<div class="cp-ask-error">${indeedEscape(error)}</div>` : ""}
        ${chips.length ? `<div class="cp-ask-chips">${chips.map((c) => `<button type="button" class="cp-ask-chip" data-value="${indeedEscape(c)}"${picked.has(c) ? ' style="outline:2px solid #6047f5;outline-offset:1px"' : ""}>${indeedEscape(c)}</button>`).join("")}</div>` : ""}
        ${!choice ? `<div class="cp-ask-row"><input id="cp-ask-input" type="${question.type === "number" ? "number" : question.type === "date" ? "date" : "text"}" autocomplete="off" value="${indeedEscape(suggestion || "")}" /><button type="button" id="cp-ask-submit" class="cp-ask-submit">Answer</button></div>` : ""}
        ${question.type === "checkbox" ? `<div class="cp-ask-row"><button type="button" id="cp-ask-submit" class="cp-ask-submit">Answer</button></div>` : ""}
        <div class="cp-ask-hint">Or fill it in on Indeed's form yourself. Waiting up to 3 minutes.</div>`;
      card.hidden = false;
      const input = card.querySelector("#cp-ask-input");
      input?.focus();
      input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit(input.value);
        }
      });
      card.querySelector("#cp-ask-submit")?.addEventListener("click", () => submit(question.type === "checkbox" ? [...picked].join(", ") : input?.value || ""));
      for (const chip of card.querySelectorAll(".cp-ask-chip")) {
        chip.addEventListener("click", () => {
          const value = chip.getAttribute("data-value") || "";
          if (question.type === "checkbox") {
            if (picked.has(value)) picked.delete(value);
            else picked.add(value);
            show();
          } else submit(value);
        });
      }
    };
    const submit = (value) => {
      const answer = indeedClean(value);
      if (!answer) return show("Type or pick an answer first.");
      const entered = question.type === "date" ? (indeedSetValue(question.el, answer), answer) : fillIndeedQuestion(question, answer, { allowSkip: true });
      if (!entered) return show(`"${answer}" doesn't fit this question.`);
      saveIndeedAnswer(question, entered);
      addIndeedFeed(ICONS.check, `You answered: ${indeedEscape(entered)} (saved to your answer bank)`);
      finish(entered);
    };
    show();
  });
}

/** The button that moves the form on: "Submit your application" on the review step, else Continue / Next. */
function indeedFormButton() {
  const buttons = Array.from(indeedFormRoot().querySelectorAll("button, [role='button'], input[type='submit']")).filter((b) => indeedActionable(b) && !b.closest(`#${PANEL_ID}`));
  const label = (b) => indeedClean(b.textContent || b.value || b.getAttribute("aria-label"));
  const submit = buttons.find((b) => /^submit( your)? application$|^submit$/i.test(label(b)));
  if (submit) return { el: submit, kind: "submit" };
  const next = buttons.find((b) => /^(continue|next|review your application|review)$/i.test(label(b)) || /continue/i.test(b.getAttribute("data-testid") || ""));
  return next ? { el: next, kind: "continue" } : null;
}

/** A fingerprint of the current form step (URL path + headings + field labels), to see that it moved on. */
const indeedStepKey = () =>
  `${location.pathname}|${Array.from(indeedFormRoot().querySelectorAll("h1, h2, legend")).map((h) => indeedClean(h.textContent)).join("/")}|${readIndeedQuestions().map((q) => q.label).join("/")}`;

/**
 * Walk Indeed's form: per step fill what still needs an answer (answer bank / AI, else the sidebar card),
 * pause like a person, press Continue or Submit, and wait for the next step. Ends on /post-apply (the tick
 * records it). Returns a failure reason, or "" when the form reached post-apply / Indeed took over.
 */
/**
 * Indeed's "It looks like you don't meet these employer requirements" step (/questions-module/intervention):
 * { unmet: ["…: 8 years (Required)", …] }, else null.
 */
function indeedRequirementsWarning() {
  const text = indeedPageText();
  if (!/\/intervention\b/i.test(location.pathname) && !/don.t meet (these|the) employer.?s? requirements/i.test(text)) return null;
  const unmet = text
    .split("\n")
    .map(indeedClean)
    .filter((line) => /\((required|preferred)\)\s*$/i.test(line))
    .map((line) => line.slice(0, 120));
  return { unmet: [...new Set(unmet)].slice(0, 5) };
}

async function runIndeedForm(run) {
  const job = run.queue[run.index];
  for (let step = Number(run.formSteps || 0); step < INDEED_MAX_FORM_STEPS; step += 1) {
    const ready = await indeedWhenReady(() => (isIndeedConfirmationPage() ? "done" : indeedRequirementsWarning() ? "warning" : indeedFormButton() ? "step" : null), { baseMs: 20000, maxMs: 120000 });
    if (isIndeedConfirmationPage()) return "";
    // Indeed: "It looks like you don't meet these employer requirements" (a Required screening answer, e.g. 8 years).
    // Applying anyway would most likely be rejected and still cost an apply: skip the job instead.
    const warning = indeedRequirementsWarning();
    if (warning) {
      indeedDebug("Indeed requirements warning", { job: job?.title, unmet: warning.unmet, url: location.pathname });
      finishIndeedJob(run, job, "skipped", `Indeed says you don't meet the employer's requirements${warning.unmet.length ? `: ${warning.unmet.join("; ")}` : ""}. Not applied.`);
      return "";
    }
    if (!ready.ok) {
      if (ready.problem === "challenge") {
        pauseIndeedRun("Indeed is asking you to verify you're human. Solve it on the page, then press <strong>Resume</strong>; the form continues from here.");
        return "";
      }
      if (ready.problem === "login") {
        pauseIndeedRun("Indeed logged you out. Log in, then press <strong>Resume</strong>.");
        return "";
      }
      return "Indeed's form didn't load (no Continue / Submit button).";
    }
    run.formSteps = step;
    saveIndeedRun(run);
    const heading = indeedClean(indeedFormRoot().querySelector("h1, h2")?.textContent);
    setIndeedStatus(`Form step ${step + 1}`);

    // Answer what this step still needs.
    for (const question of readIndeedQuestions()) {
      addIndeedFeed(ICONS.edit, `Indeed asks: <strong>${indeedEscape(question.label)}</strong>`);
      const unfocus = focusIndeedQuestion(question);
      const reading = indeedRandom([1200, 2500]);
      setIndeedWait("Reading the question", reading);
      const [answer] = await Promise.all([askIndeedAnswer(question), indeedSleep(reading)]);
      let entered = answer ? fillIndeedQuestion(question, answer) : "";
      if (entered) addIndeedFeed(ICONS.check, `Answered: ${indeedEscape(entered)}`);
      else {
        addIndeedFeed(ICONS.alert, `Your answer is needed: "<strong>${indeedEscape(question.label)}</strong>"${answer ? ` (suggested: ${indeedEscape(answer)})` : ""}. Answer it in the card above (or on the form).`);
        setIndeedStatus("Your answer needed");
        setIndeedWait("Waiting for your answer", 180000);
        entered = await Promise.race([
          askIndeedInSidebar(question, answer),
          indeedWaitWhileBusy(() => (readIndeedQuestions().some((q) => q.label === question.label) ? null : "filled-on-page"), { baseMs: 180000, maxMs: 180000, busy: () => false, everyMs: 700 }),
        ]);
        if (!entered) {
          unfocus();
          return `"${question.label}" waited 3 minutes without an answer.`;
        }
      }
      await indeedSleep(indeedRandom([400, 900]));
      unfocus();
    }

    // Read the step like a person, then move on.
    const pause = indeedRandom(INDEED_READ_STEP_MS);
    setIndeedWait(heading ? `Checking "${heading.slice(0, 40)}"` : "Checking the form", pause);
    await indeedSleep(pause);
    const button = indeedFormButton();
    if (!button) continue;
    const before = indeedStepKey();
    if (button.kind === "submit") {
      if (!(await indeedHasHires())) {
        stopIndeedRun(INDEED_OUT_OF_HIRES_HTML);
        return "";
      }
      addIndeedFeed(ICONS.bolt, "Pressing <strong>Submit your application</strong>, waiting for Indeed…");
    }
    indeedPress(button.el);
    const moved = await indeedWaitWhileBusy(() => (isIndeedConfirmationPage() ? "done" : indeedStepKey() !== before ? "next" : null), { baseMs: 15000, maxMs: 90000 });
    if (moved === "done") return "";
    if (!moved) {
      const errors = Array.from(indeedFormRoot().querySelectorAll("[role='alert'], [class*='error' i]"))
        .filter((el) => el.getBoundingClientRect().width > 0 && indeedClean(el.textContent))
        .map((el) => indeedClean(el.textContent))
        .slice(0, 2);
      if (errors.length) addIndeedFeed(ICONS.alert, `Indeed says: ${indeedEscape(errors.join(" · "))}`);
      if (!readIndeedQuestions().length) return errors.length ? `Indeed didn't accept the step: ${errors.join(" · ")}` : "Indeed's form didn't move on after Continue.";
      // Questions it wants answered: the next loop asks them.
    }
    await indeedSleep(indeedRandom([600, 1200]));
  }
  return `Indeed's form went past ${INDEED_MAX_FORM_STEPS} steps without finishing.`;
}

// ------------------------------------------------------------------ run tick (every second)
async function indeedRunTick() {
  const run = loadIndeedRun();
  if (!run || run.status !== "running" || indeedBusy || indeedLeaving) return;
  const problem = indeedPageProblem();
  if (problem === "offline") {
    setIndeedStatus("Offline…");
    return setIndeedWait("Waiting for the internet connection", 60000);
  }
  if (problem === "challenge") return pauseIndeedRun("Indeed is asking you to verify you're human. Solve it on the page, then press <strong>Resume</strong>.");
  const job = run.queue[run.index];

  // Indeed's confirmation page: applied.
  if (isIndeedConfirmationPage()) {
    if (job && run.phase === "applying") {
      countIndeedAppliedToday();
      return finishIndeedJob(run, job, "applied", "Applied: Indeed's confirmation page.");
    }
    if (run.returnUrl) {
      indeedLeaving = true;
      setTimeout(() => void indeedGoTo(run.returnUrl), indeedRandom(INDEED_CONFIRMATION_WAIT_MS));
    }
    return;
  }

  // Indeed's form: step through it.
  if (isIndeedApplyForm()) {
    if (!job || run.phase !== "applying") return;
    indeedBusy = true;
    try {
      const failure = await runIndeedForm(run);
      const latest = loadIndeedRun();
      if (failure && latest?.status === "running") finishIndeedJob(latest, latest.queue[latest.index], "failed", failure);
    } finally {
      indeedBusy = false;
    }
    return;
  }

  // The job's page: find Apply now and open it here.
  if (isIndeedJobPage()) {
    if (!job) return void indeedGoTo(run.returnUrl);
    if (indeedJobIdFromUrl() !== job.jobId) return pauseIndeedRun("You opened another page during the run, so it paused. Press Resume to go back to the results.");
    if (run.phase === "applying") return finishIndeedJob(run, job, "failed", "Came back to the job page during the application. Open the job to check whether it went through.");
    indeedBusy = true;
    try {
      await openIndeedApplyForm(run);
    } finally {
      indeedBusy = false;
    }
    return;
  }

  if (!isIndeedListPage()) return;
  if (run.needsQueue) {
    indeedBusy = true;
    try {
      await queueIndeedPage(run);
      indeedRescannedUrl = location.href;
    } finally {
      indeedBusy = false;
    }
    return;
  }
  const last = run.results[run.results.length - 1];
  if (last && run.shownResult !== run.results.length) {
    run.shownResult = run.results.length;
    saveIndeedRun(run);
    indeedBusy = true;
    try {
      flagIndeedCards();
      const card = spotlightIndeedCard(last.jobId, last.outcome === "applied" ? "applied" : "done", { applied: "Applied", skipped: "Skipped", failed: "Failed" }[last.outcome]);
      await indeedSleep(2500);
      clearIndeedSpotlight(card);
    } finally {
      indeedBusy = false;
    }
    return;
  }
  // Came back after a job: Indeed reshuffles the list, so check every card again (once per page load).
  if (indeedRescannedUrl !== location.href) {
    indeedRescannedUrl = location.href;
    indeedBusy = true;
    try {
      await queueIndeedPage(run, true);
    } finally {
      indeedBusy = false;
    }
    return;
  }
  const wait = run.nextAt - Date.now();
  if (run.index >= run.queue.length) {
    setIndeedStatus(wait > 0 ? `Next page in ${Math.ceil(wait / 1000)}s` : "Next page…");
    if (wait <= 0) advanceIndeedSearch(run);
    return;
  }
  setIndeedStatus(wait > 0 ? `Next in ${Math.ceil(wait / 1000)}s` : "Opening…");
  const next = run.queue[run.index];
  if (isCountingIndeedKey(next.jobId)) {
    run.index += 1;
    saveIndeedRun(run);
    return;
  }
  if (wait > 0) {
    // While waiting, keep the card that comes next in focus (scrolled to once, then only the countdown moves).
    const first = indeedSpotJobId !== next.jobId;
    if (spotlightIndeedCard(next.jobId, "next", `Next: ${next.title || "job"} · in ${Math.ceil(wait / 1000)}s`, { scroll: first }) && first) indeedSpotJobId = next.jobId;
    return;
  }
  // Busy from here: the 1 s ticks must not start this same job again while the checks below wait.
  indeedBusy = true;
  let pane = "";
  try {
    if (!(await indeedHasHires())) return stopIndeedRun(INDEED_OUT_OF_HIRES_HTML);
    spotlightIndeedCard(next.jobId, "next", `Opening next: ${next.title || "job"}`);
    setIndeedWait(`Checking ${next.title || "the next job"}`, INDEED_FOCUS_CARD_MS);
    // Indeed's list data doesn't always know you already applied; its quick details pane does.
    [pane] = await Promise.all([peekIndeedJob(next), indeedSleep(INDEED_FOCUS_CARD_MS)]);
  } finally {
    indeedBusy = false;
  }
  const latest = loadIndeedRun();
  if (latest?.status !== "running") return;
  indeedDebug("Quick details check", { job: next.title, pane: pane || "pane didn't load (opening the job page)" });
  if (pane === "applied") {
    recordIndeedResult(latest, next, "skipped", "Already applied (Indeed's details show Applied).");
    latest.nextAt = Date.now() + indeedRandom([2000, 4000]); // nothing was opened: no long human-pace pause
    saveIndeedRun(latest);
    addIndeedFeed(ICONS.skip, `<strong>Skipped:</strong> ${indeedEscape(next.title || "job")}. Already applied (Indeed's details show Applied).`);
    return;
  }
  void indeedGoTo(next.url);
}

/** Indeed's Apply button in the quick details pane (results page), not ours. */
function indeedPaneApplyButton() {
  return Array.from(document.querySelectorAll("[data-testid='viewjob-indeed-apply'], #indeedApplyButton")).find((el) => !el.closest(`#${PANEL_ID}`) && el.getBoundingClientRect().width > 0) || null;
}

/**
 * Open a card's quick details pane on the results page (a click on the card, like a person) and read its Apply
 * button: "applied" (reads Applied / greyed out), "open", or "" when the pane didn't show this job.
 */
async function peekIndeedJob(job) {
  const selected = () => new URLSearchParams(location.search).get("vjk") === job.jobId;
  const paneTitle = () => indeedClean(document.querySelector("[data-testid='vj-job-title'], [data-testid='jobsearch-JobInfoHeader-title'], h2.jobsearch-JobInfoHeader-title")?.textContent).toLowerCase();
  const sameJob = () => {
    const title = paneTitle();
    return !title || !job.title || title.includes(indeedClean(job.title).toLowerCase().slice(0, 25));
  };
  if (!selected()) {
    const card = findIndeedCards().find((c) => readIndeedCard(c).jobId === job.jobId);
    if (!card) return "";
    // The card body, not the title link (that one can open the job page itself).
    indeedPress(card.querySelector("td.resultContent, .job_seen_beacon") || card);
  }
  const ready = await indeedWhenReady(() => (selected() && sameJob() && indeedPaneApplyButton()) || null, { baseMs: 8000, maxMs: 15000 });
  if (!ready.ok || !ready.value) return "";
  const button = ready.value;
  const text = indeedClean(button.textContent);
  return /^applied\b/i.test(text) || button.disabled || button.getAttribute("aria-disabled") === "true" ? "applied" : "open";
}

// ------------------------------------------------------------------ panel
function indeedJobCardHtml(job, result) {
  const title = job.url ? `<a href="${indeedEscape(job.url)}" target="_blank" rel="noopener noreferrer">${indeedEscape(job.title || "Indeed job")}</a>` : indeedEscape(job.title || "Indeed job");
  const sub = [job.company, job.location, job.salary].filter(Boolean).map(indeedEscape).join(" · ");
  const good = result ? result.outcome === "applied" : job.type === "applied";
  const tagText = result ? { applied: "Applied", skipped: "Skipped", failed: "Failed" }[result.outcome] : { easy: "Easily apply", company: "Company site", expired: "Expired", applied: "" }[job.type];
  const note = result?.detail ? `<div class="cp-job-reason">${indeedEscape(result.detail)}</div>` : "";
  return `<div class="cp-job-card ${good ? "cp-job-applied" : "cp-job-skipped"}"><span class="cp-job-icon">${good ? ICONS.check : job.type === "easy" && !result ? ICONS.target : ICONS.skip}</span><div class="cp-job-main"><div class="cp-job-title">${title}${tagText ? `<span class="cp-job-tag">${tagText}</span>` : ""}</div><div class="cp-job-sub">${sub}</div>${note}</div></div>`;
}

function renderIndeedPanel() {
  if (!indeedPanel) return;
  const run = loadIndeedRun();
  const results = run?.results || [];
  const appliedInRun = new Set(results.filter((r) => r.outcome === "applied").map((r) => r.jobId));
  const open = indeedJobs.filter((job) => job.type !== "applied" && !appliedInRun.has(job.jobId));
  const easyJobs = open.filter((job) => job.type === "easy");
  const companyJobs = open.filter((job) => job.type !== "easy");
  for (const [tab, count] of Object.entries({ jobs: easyJobs.length, company: companyJobs.length, results: results.length })) {
    const badge = indeedPanel.querySelector(`#cp-count-${tab}`);
    if (badge) {
      badge.textContent = String(count);
      badge.hidden = !count;
    }
  }
  for (const tab of ["jobs", "company", "results", "feed"]) indeedPanel.querySelector(`#cp-tab-${tab}`)?.classList.toggle("cp-active", indeedTab === tab);
  const active = run?.status === "running" || run?.status === "paused";
  const startLabel = indeedPanel.querySelector("#cp-start span");
  if (startLabel) startLabel.textContent = run?.status === "paused" ? "Resume" : run?.status === "running" ? "Running…" : "Start";
  indeedPanel.querySelector("#cp-start").disabled = run?.status === "running" || (!active && !isIndeedListPage());
  indeedPanel.querySelector("#cp-pause").disabled = run?.status !== "running";
  indeedPanel.querySelector("#cp-stop").disabled = !active;
  const filters = indeedPanel.querySelector("#cp-indeed-filters");
  if (filters && indeedUserSettings) {
    const text = `Your dashboard filters: ${indeedFiltersSummary(indeedUserSettings)}`;
    if (filters.textContent !== text) filters.textContent = text;
  }
  const today = indeedPanel.querySelector("#cp-today-text");
  const todayText = `Today: ${indeedAppliedToday()} applied · ${indeedHiresLabel()}`;
  if (today && today.textContent !== todayText) today.textContent = todayText;
  if (!active) setIndeedStatus(run?.status === "done" ? "Done" : run?.status === "stopped" ? "Stopped" : "Idle");
  else if (run.status === "paused") setIndeedStatus("Paused");

  const log = indeedPanel.querySelector("#cp-log");
  const empty = (icon, text) => `<div class="cp-empty-state"><span>${icon}</span><span>${text}</span></div>`;
  let html;
  if (indeedTab === "jobs") html = easyJobs.length ? easyJobs.map((j) => indeedJobCardHtml(j)).join("") : empty(ICONS.search, "No Easily apply jobs on this page yet. Open an Indeed search results page.");
  else if (indeedTab === "company") html = companyJobs.length ? companyJobs.map((j) => indeedJobCardHtml(j)).join("") : empty(ICONS.skip, "No company-site jobs on this page.");
  else if (indeedTab === "results") html = results.length ? [...results].reverse().map((r) => indeedJobCardHtml(r, r)).join("") : empty(ICONS.check, "Results of the current run show here.");
  else {
    const feed = run?.feed || [];
    html = feed.length
      ? [...feed].reverse().map((item) => `<div class="cp-ai-card"><span class="cp-ai-icon">${item.icon}</span><span class="cp-ai-text">${item.html}</span><span class="cp-ai-time">${indeedEscape(item.time)}</span></div>`).join("")
      : empty(ICONS.sparkle, "Indeed Copilot is standing by. Press <strong>Start</strong> to apply to the Easily apply jobs on this page.");
  }
  if (log && log.dataset.html !== html) {
    log.innerHTML = html;
    log.dataset.html = html;
  }
  // Live countdown in its own bar (only its text changes: the log doesn't blink).
  const waitBar = indeedPanel.querySelector("#cp-indeed-wait");
  if (waitBar) {
    const now = Date.now();
    let wait = null;
    if (run?.status === "running") {
      if (run.wait && run.wait.until > now) wait = run.wait;
      else if (isIndeedListPage() && !run.needsQueue && run.nextAt > now) wait = { label: run.index >= run.queue.length ? "Next page in" : "Next job in", until: run.nextAt };
    }
    const text = wait ? `${wait.label}: ${Math.ceil((wait.until - now) / 1000)}s` : "";
    const label = waitBar.querySelector(".cp-indeed-wait-text");
    if (label && label.textContent !== text) label.textContent = text;
    waitBar.style.display = text ? "flex" : "none";
  }
}

function syncIndeedPageShift() {
  if (!document.body) return;
  const docked = indeedPanel && !indeedPanel.classList.contains("cp-sidebar-collapsed");
  document.documentElement.style.setProperty("--cp-sidebar-width", `${INDEED_PANEL_WIDTH}px`);
  document.body.style.marginRight = docked ? `${INDEED_PANEL_WIDTH}px` : "";
  document.body.classList.toggle("cp-has-docked-sidebar", Boolean(docked));
}

function mountIndeedPanel() {
  if (document.getElementById(PANEL_ID)) return;
  let prefs = { collapsed: false };
  try {
    prefs = { ...prefs, ...JSON.parse(localStorage.getItem(INDEED_PREFS_KEY) || "{}") };
  } catch {
    // default prefs
  }
  const toggle = document.createElement("button");
  toggle.id = TOGGLE_ID;
  toggle.title = "AutoApply CV Copilot";
  toggle.setAttribute("aria-label", "AutoApply CV Copilot");
  toggle.innerHTML = `<img src="${indeedAssetUrl("icons/icon32.png")}" alt="" width="26" height="26" style="display:block;margin:0 auto;border-radius:10px" /><span style="font-weight:700">Copilot</span>`;
  toggle.addEventListener("click", () => {
    indeedPanel?.classList.toggle("cp-sidebar-collapsed");
    try {
      localStorage.setItem(INDEED_PREFS_KEY, JSON.stringify({ collapsed: indeedPanel?.classList.contains("cp-sidebar-collapsed") }));
    } catch {
      // not remembered
    }
    syncIndeedPageShift();
  });
  (document.body || document.documentElement).appendChild(toggle);

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="cp-head">
      <div class="cp-brand">
        <div class="cp-orb"><img class="cp-orb-img" alt="" src="${indeedAssetUrl("icons/icon48.png")}" /></div>
        <div>
          <div class="cp-title">AutoApply CV <span class="cp-ai-sparkle">${ICONS.sparkle}</span></div>
          <div class="cp-sub">Indeed Copilot · Beta</div>
        </div>
      </div>
      <div class="cp-head-right">
        <div class="cp-badge" id="cp-status-badge">Idle</div>
        <div class="cp-window-actions"><button id="cp-clear-logs" class="cp-icon-btn" title="Clear results">${ICONS.trash}</button></div>
      </div>
    </div>
    <div class="cp-controls">
      <div class="cp-run-mode">
        <div class="cp-metric-pill cp-metric-quota" title="Free applications first, then 1 Hire per application, charged only when Indeed confirms it"><span class="cp-svg-icon cp-icon-primary">${ICONS.coin}</span><span id="cp-today-text">Today: 0 applied</span></div>
        <span class="cp-run-mode-chip" title="Start applies for real">Live</span>
      </div>
      <div id="cp-indeed-filters" style="font-size:11px;color:#6b7280;margin:-2px 0 6px">Your dashboard filters: loading…</div>
      <div class="cp-quick">
        <button id="cp-start" class="cp-btn-start">${ICONS.play} <span>Start</span></button>
        <button id="cp-pause" class="cp-btn-pause">${ICONS.pause} <span>Pause</span></button>
        <button id="cp-stop" class="cp-btn-stop">${ICONS.stop} <span>Stop</span></button>
      </div>
    </div>
    <div class="cp-tab-bar">
      <button id="cp-tab-jobs" class="cp-tab"><span>Easily apply</span><b class="cp-tab-count" id="cp-count-jobs" hidden>0</b></button>
      <button id="cp-tab-company" class="cp-tab" title="Apply on company site / expired: skipped"><span>Company</span><b class="cp-tab-count" id="cp-count-company" hidden>0</b></button>
      <button id="cp-tab-results" class="cp-tab"><span>Results</span><b class="cp-tab-count" id="cp-count-results" hidden>0</b></button>
      <button id="cp-tab-feed" class="cp-tab cp-active"><span>Activity</span></button>
    </div>
    <div id="cp-indeed-wait" style="display:none;margin:0 12px 8px;padding:7px 12px;border:1px solid #d4ccff;border-radius:10px;background:#f4f2ff;color:#4f38e0;font:600 12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;align-items:center;gap:8px"><span style="display:inline-flex">${ICONS.clock}</span><span class="cp-indeed-wait-text"></span></div>
    <div class="cp-log" id="cp-log" aria-live="polite"></div>`;
  Object.assign(panel.style, { top: "0", right: "0", bottom: "0", left: "auto", width: `${INDEED_PANEL_WIDTH}px`, zIndex: "2147483646" });
  if (prefs.collapsed) panel.classList.add("cp-sidebar-collapsed");
  (document.body || document.documentElement).appendChild(panel);
  indeedPanel = panel;
  panel.querySelector("#cp-start").addEventListener("click", () => void startIndeedRun());
  panel.querySelector("#cp-pause").addEventListener("click", () => pauseIndeedRun());
  panel.querySelector("#cp-stop").addEventListener("click", () => stopIndeedRun());
  panel.querySelector("#cp-clear-logs").addEventListener("click", () => {
    const run = loadIndeedRun();
    if (run?.status === "running" || run?.status === "paused") return;
    saveIndeedRun(null);
    renderIndeedPanel();
  });
  for (const tab of ["jobs", "company", "results", "feed"]) {
    panel.querySelector(`#cp-tab-${tab}`).addEventListener("click", () => {

      indeedTab = tab;
      renderIndeedPanel();
    });
  }
  indeedTab = "feed";
  renderIndeedPanel();
  syncIndeedPageShift();
  void loadIndeedUserSettings().then(() => renderIndeedPanel());
  void indeedHasHires().then(() => renderIndeedPanel());
}

function unmountIndeedPanel() {
  for (const el of document.querySelectorAll(".cp-indeed-flag, .cp-indeed-spot")) el.remove();
  document.getElementById(PANEL_ID)?.remove();
  document.getElementById(TOGGLE_ID)?.remove();
  indeedPanel = null;
  if (document.body) {
    document.body.style.marginRight = "";
    document.body.classList.remove("cp-has-docked-sidebar");
  }
}

// ------------------------------------------------------------------ init
(async () => {
  await loadIndeedStore();
  // Keep the in-memory run in step when another Indeed page (the form, the results) changes it.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const next = changes[INDEED_RUN_KEY]?.newValue;
    if (changes[INDEED_RUN_KEY] && next?.writer !== INDEED_PAGE_ID) indeedStore.run = next || null;
    if (changes[INDEED_DAILY_KEY]) indeedStore.daily = changes[INDEED_DAILY_KEY].newValue || null;
  });
  window.postMessage({ source: "cp-indeed-request" }, location.origin);

  let pageChanged = true;
  let lastPageRead = 0;
  new MutationObserver((records) => {
    if (records.some((r) => !(r.target?.nodeType === 1 && r.target.closest?.(`#${PANEL_ID}, .cp-indeed-flag, .cp-indeed-spot`)))) pageChanged = true;
  }).observe(document.documentElement, { childList: true, subtree: true });

  const sync = () => {
    const run = loadIndeedRun();
    const runActive = run?.status === "running" || run?.status === "paused";
    // On job / form pages: while a run is on, and for 15 min after it stopped there (so the reason stays visible).
    const justEnded = Date.now() - Number(run?.endedAt || 0) < 15 * 60000;
    const wantPanel = isIndeedListPage() || ((isIndeedJobPage() || isIndeedApplySite()) && (runActive || justEnded));
    if (wantPanel) {
      mountIndeedPanel();
      if (isIndeedListPage() && (pageChanged || Date.now() - lastPageRead > 5000)) {
        pageChanged = false;
        lastPageRead = Date.now();
        flagIndeedCards();
        indeedJobs = readIndeedPageJobs();
      }
      pollIndeedQuota();
      // Dashboard filters didn't arrive (background asleep / restarting): ask again.
      if (!indeedUserSettings && Date.now() - indeedSettingsTriedAt > 5000) void loadIndeedUserSettings().then(() => renderIndeedPanel());
      renderIndeedPanel();
    } else if (indeedPanel) unmountIndeedPanel();
    void indeedRunTick();
  };
  sync();
  setInterval(sync, 1000);

  // Stuck watchdog: nothing logged for minutes while online -> record the job for a manual check / reload.
  let recovering = false;
  setInterval(() => {
    const run = loadIndeedRun();
    if (recovering || !run || run.status !== "running" || navigator.onLine === false) return;
    const idleMs = Date.now() - Number(run.progressAt || Date.now());
    if (idleMs < indeedTimeout(4 * 60000, 12 * 60000)) return;
    recovering = true;
    const job = run.queue?.[run.index];
    const minutes = Math.round(idleMs / 60000);
    if ((isIndeedJobPage() || isIndeedApplySite()) && job) finishIndeedJob(run, job, "failed", `No progress for ${minutes} min on this job. Open it to check whether it went through.`);
    else if (isIndeedListPage()) {
      addIndeedFeed(ICONS.alert, `No progress for ${minutes} min, reloading the results page…`);
      indeedLeaving = true;
      location.reload();
    } else if (run.returnUrl) void indeedGoTo(run.returnUrl);
  }, 15000);
})();
