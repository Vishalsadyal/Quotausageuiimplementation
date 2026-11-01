/*
 * Naukri Jobs copilot - sidebar + auto-apply
 *
 * The LinkedIn-style docked sidebar on Naukri. It reuses the LinkedIn panel's ids and panel.css (same
 * look) and the ICONS / PANEL_ID / TOGGLE_ID constants from src/linkedin/jobs/01-config.js, which
 * manifest.json loads first.
 *
 * Card banners: every job card says Easy Apply / Easy Apply + recruiter questions / Company site. The type
 * comes from Naukri's search responses, read by search-data-main.js (page world) and posted here.
 *
 * Run (all in the SAME tab, always live: on Naukri, Apply sends the application at once). Start searches
 * this page's term, then every target job title from the dashboard, up to NAUKRI_PAGES_PER_SEARCH pages
 * each. On each results page it queues the Easy Apply jobs that fit the dashboard filters (skills /
 * keywords, exclude words, blacklisted companies, experience), then for each one:
 *   highlight the card --> job page --(click Apply, answer the recruiter chatbot)--> Naukri's confirmation
 *   page (/myapply/saveApply, result in the URL) --> back to the results --(20-45 s)--> next job.
 * The run state lives in sessionStorage (survives the page changes, ends with the tab).
 * Selectors and limits: docs/NAUKRI_RESEARCH.md.
 */

const NAUKRI_PREFS_KEY = "cpNaukriPanelPrefs";
const NAUKRI_DAILY_KEY = "cpNaukriDaily";
const NAUKRI_RUN_KEY = "cpNaukriRun";
const NAUKRI_PANEL_WIDTH = 410;
const NAUKRI_PACE_MS = [20000, 45000];
// Results pages per search term before moving on to the next target job title.
const NAUKRI_PAGES_PER_SEARCH = 5;
// Visible, human-paced steps: highlight the card before opening it, "read" the job before Apply.
const NAUKRI_FOCUS_CARD_MS = 2500;
const NAUKRI_READ_JOB_MS = [2000, 3500];
// Human pace in the recruiter chat: reading each question, then a short pause before pressing Save.
const NAUKRI_READ_QUESTION_MS = [1200, 2500];
const NAUKRI_BEFORE_SAVE_MS = [600, 1200];
// Time spent on Naukri's "Applied to …" confirmation page before going back to the results.
const NAUKRI_CONFIRMATION_WAIT_MS = [3000, 4000];
const NAUKRI_BLOCKED_TEXT = /captcha|verify you are (a )?human|unusual activity|too many requests|temporarily blocked|access denied|you have been blocked/i;

let naukriPanel = null;
let naukriJobs = [];
let naukriTab = "jobs";
let naukriBusy = false;
// Set once this page has started navigating away (to the next job or back to the results), so the
// 1-second tick does nothing more on it.
let naukriLeaving = false;
let naukriLastApplyMessage = null;
/** jobId -> { companyApply, redirectHost, questions, walkin } from Naukri's search responses. */
const naukriApplyTypes = new Map();

// ------------------------------------------------------------------ page detection
/** Search results (/react-developer-jobs, -jobs-2, -jobs-in-pune) and recommended jobs. */
function isNaukriJobsListPage() {
  const path = location.pathname.toLowerCase();
  return /-jobs(-in-[a-z0-9-]+)?(-\d+)?\/?$/.test(path) || path.startsWith("/mnjuser/recommendedjobs");
}

function isNaukriJobPage() {
  return /\/job-listings-/i.test(location.pathname);
}

/**
 * After Apply, Naukri loads a confirmation page whose URL carries the result:
 *   /myapply/saveApply?strJobsarr=[221026928288]&...&multiApplyResp={"221026928288":200}
 */
function isNaukriApplyConfirmationPage() {
  return /\/myapply\/saveapply/i.test(location.pathname);
}

/** { jobIds: ["221026928288"], statuses: { "221026928288": 200 } } from the confirmation page URL. */
function readNaukriApplyConfirmation() {
  const params = new URLSearchParams(location.search);
  const jobIds = (String(params.get("strJobsarr") || "").match(/\d{6,}/g) || []).map(String);
  let statuses = {};
  try {
    statuses = JSON.parse(params.get("multiApplyResp") || "{}") || {};
  } catch {
    statuses = {};
  }
  return { jobIds, statuses };
}

function naukriJobIdFromUrl(url) {
  return (String(url || "").split("?")[0].match(/-(\d{6,})\/?$/) || [])[1] || "";
}

// ------------------------------------------------------------------ helpers
function naukriEscape(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const naukriClean = (text) => String(text || "").replace(/\s+/g, " ").trim();
const naukriTime = () => new Date().toTimeString().slice(0, 8);
const naukriSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const naukriRandom = ([min, max]) => Math.round(min + Math.random() * (max - min));
const naukriToday = () => new Date().toISOString().slice(0, 10);

function naukriAssetUrl(path) {
  try {
    return chrome.runtime.getURL(path);
  } catch {
    return "";
  }
}

function naukriRead(storage, key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function naukriWrite(storage, key, value) {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked: the run can't survive page changes, but the page still works
  }
}

const loadNaukriRun = () => naukriRead(sessionStorage, NAUKRI_RUN_KEY, null);
const saveNaukriRun = (run) => naukriWrite(sessionStorage, NAUKRI_RUN_KEY, run);

/** Live applications sent today (resets each day). */
function naukriAppliedToday() {
  const daily = naukriRead(localStorage, NAUKRI_DAILY_KEY, {});
  return daily.date === naukriToday() ? Number(daily.applied || 0) : 0;
}

function countNaukriAppliedToday() {
  naukriWrite(localStorage, NAUKRI_DAILY_KEY, { date: naukriToday(), applied: naukriAppliedToday() + 1 });
}

/** Naukri's own count from its apply call (quotaDetails.dailyApplied): includes jobs applied by hand. */
function syncNaukriAppliedToday(dailyApplied) {
  const count = Number(dailyApplied);
  if (Number.isFinite(count) && count > naukriAppliedToday()) naukriWrite(localStorage, NAUKRI_DAILY_KEY, { date: naukriToday(), applied: count });
}

// ------------------------------------------------------------------ smart waits
// No fixed timers for page / element / Naukri answers: wait for what Naukri is actually doing, so a slow
// connection makes the run slower, never skip a step. Built on CPLinkedInWait (src/linkedin/core/wait.js,
// loaded before this file) plus:
//   speed factor   how slow Naukri is right now (page load timing + how long recent waits took), 1-4,
//                  remembered across pages; every timeout is stretched by it
//   network        Naukri requests in flight (all / chatbot / apply) and when the last apply request
//                  started, published by search-data-main.js as data-cp-* attributes on <html>
//   page problems  offline (waits for the connection), Naukri error page (reload, then move on),
//                  logged out (pause), captcha (stop), job expired (skip)
// Human pacing (highlight, reading, gaps between jobs) stays random on top of this.
const NaukriWait = window.CPLinkedInWait;
const NAUKRI_SPEED_KEY = "cpNaukriSpeed";
const NAUKRI_ERROR_PAGE_TEXT = /oops!? something went wrong|error loading the page|this page (isn'?t|is not) working|site can'?t be reached/i;
const NAUKRI_EXPIRED_TEXT = /no longer (available|accepting applications)|job (has )?expired|this job is closed|job is not available/i;
const NAUKRI_NO_RESULTS_TEXT = /no (jobs|results) found|we couldn'?t find (any )?(matching )?jobs|0 jobs? found|no matching jobs/i;

/** 1 = Naukri is quick; up to 4 when slow. */
function naukriSpeed() {
  const remembered = Number(naukriRead(sessionStorage, NAUKRI_SPEED_KEY, 1)) || 1;
  const nav = performance.getEntriesByType?.("navigation")?.[0];
  const loadMs = nav ? Number(nav.domContentLoadedEventEnd || nav.responseEnd || 0) : 0;
  const fromLoad = loadMs > 0 ? loadMs / 3000 : 1; // ~3 s to load a Naukri page is normal
  return Math.min(4, Math.max(1, remembered, fromLoad));
}

/** Learn from a wait that took waitedMs where expectedMs is normal (moving average, 1-4). */
function noteNaukriLatency(waitedMs, expectedMs) {
  const sample = Math.min(4, Math.max(0.5, waitedMs / expectedMs));
  const previous = Number(naukriRead(sessionStorage, NAUKRI_SPEED_KEY, 1)) || 1;
  naukriWrite(sessionStorage, NAUKRI_SPEED_KEY, Math.min(4, Math.max(1, previous * 0.7 + sample * 0.3)));
}

/** A timeout stretched by the speed factor. */
const naukriTimeout = (baseMs, maxMs = baseMs * 4) => Math.min(maxMs, Math.round(baseMs * naukriSpeed()));

/** Naukri requests in flight, from search-data-main.js. */
function naukriNet() {
  const data = document.documentElement?.dataset || {};
  return {
    inflight: Number(data.cpNetInflight || 0),
    chat: Number(data.cpNetChat || 0),
    apply: Number(data.cpNetApply || 0),
    applyStartedAt: Number(data.cpApplyStartedAt || 0),
  };
}

/** "" or what stops the page from being used: offline | login | blocked | error | expired. */
function naukriPageProblem() {
  if (navigator.onLine === false) return "offline";
  if (/^login\./i.test(location.hostname) || /^\/nlogin/i.test(location.pathname)) return "login";
  const text = document.body?.innerText || "";
  if (NAUKRI_BLOCKED_TEXT.test(text)) return "blocked";
  if (NAUKRI_ERROR_PAGE_TEXT.test(text) && text.length < 3000) return "error";
  if (isNaukriJobPage() && NAUKRI_EXPIRED_TEXT.test(text) && !document.querySelector("#apply-button, #company-site-button")) return "expired";
  return "";
}

const naukriOnline = () => new Promise((resolve) => (navigator.onLine ? resolve() : window.addEventListener("online", () => resolve(), { once: true })));

/**
 * Wait until check() is truthy AND the page has settled (no loaders, DOM quiet), stretching baseMs by
 * the speed factor up to maxMs, and longer while Naukri still has requests in flight (never past maxMs).
 * Offline time does not count. Returns { ok, value, problem, waitedMs } (problem: "" | "timeout" |
 * offline/login/blocked/error/expired from naukriPageProblem).
 */
async function naukriWhenReady(check, { baseMs = 10000, maxMs = 60000, expectedMs = 0 } = {}) {
  const start = Date.now();
  let offlineMs = 0;
  for (;;) {
    let problem = naukriPageProblem();
    if (problem === "offline") {
      setNaukriStatus("Offline…");
      setNaukriWait("Waiting for the internet connection", 60000);
      const since = Date.now();
      await naukriOnline();
      offlineMs += Date.now() - since;
      await naukriSleep(1500); // let the page recover
      continue;
    }
    if (problem) return { ok: false, value: null, problem, waitedMs: Date.now() - start };
    const spent = Date.now() - start - offlineMs;
    const budget = naukriTimeout(baseMs, maxMs) - spent;
    // Past the normal budget: keep going only while Naukri is still answering requests, never past maxMs.
    if (budget <= 0 && (naukriNet().inflight === 0 || spent >= maxMs)) return { ok: false, value: null, problem: "timeout", waitedMs: Date.now() - start };
    const slice = Math.max(1000, Math.min(budget > 0 ? budget : 2000, 5000));
    const result = NaukriWait
      ? await NaukriWait.settled(document.body, () => (naukriPageProblem() ? "problem" : check()), { timeoutMs: slice, quietMs: 400, maxQuietWaitMs: 1500, loaderGraceMs: 2500 })
      : { ok: Boolean(check()), value: check() };
    if (result.ok && result.value === "problem") continue;
    if (result.ok) {
      if (expectedMs) noteNaukriLatency(Date.now() - start - offlineMs, expectedMs);
      return { ok: true, value: result.value, problem: "", waitedMs: Date.now() - start };
    }
  }
}

/**
 * Wait for read() (no "settled" requirement: for answers from Naukri such as a new chatbot question or a
 * confirmation). Same stretching: baseMs x speed, longer while busy() (default: any Naukri request in
 * flight), at most maxMs; offline time does not count.
 */
async function naukriWaitWhileBusy(read, { baseMs, maxMs, busy = () => naukriNet().inflight > 0, everyMs = 400, expectedMs = 0 }) {
  const start = Date.now();
  let offlineMs = 0;
  for (;;) {
    const value = read();
    if (value) {
      if (expectedMs) noteNaukriLatency(Date.now() - start - offlineMs, expectedMs);
      return value;
    }
    if (navigator.onLine === false) {
      const since = Date.now();
      setNaukriWait("Waiting for the internet connection", 60000);
      await naukriOnline();
      offlineMs += Date.now() - since;
      continue;
    }
    const spent = Date.now() - start - offlineMs;
    if (spent >= maxMs || (spent >= naukriTimeout(baseMs, maxMs) && !busy())) return null;
    await naukriSleep(everyMs);
  }
}

/** Visible, enabled and not hidden: an element a person could click now. */
function naukriActionable(el) {
  if (!el?.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (!(rect.width > 0 && rect.height > 0)) return false;
  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0 || style.pointerEvents === "none") return false;
  return !(el.disabled || el.getAttribute("aria-disabled") === "true" || /\bdisabled\b/.test(el.className || ""));
}

/**
 * Smart locator: find() an element, wait until it is actionable, scroll it into view, wait until it stops
 * moving (layout settling) and nothing covers its centre (Naukri overlays). Returns the live element.
 */
async function naukriLocate(find, { baseMs = 8000, maxMs = 30000 } = {}) {
  const found = await naukriWhenReady(() => {
    const el = find();
    return naukriActionable(el) ? el : null;
  }, { baseMs, maxMs });
  if (!found.ok) return found;
  let el = found.value;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  if (NaukriWait) await NaukriWait.stable(() => {
    const r = (el.isConnected ? el : find())?.getBoundingClientRect();
    return r ? `${Math.round(r.top)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}` : "";
  }, { stableMs: 300, timeoutMs: naukriTimeout(3000, 8000), intervalMs: 100 });
  await naukriWaitWhileBusy(() => {
    el = el.isConnected ? el : find();
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    // Our own sidebar never counts as covering (it sits beside the page).
    return !hit || hit === el || el.contains(hit) || hit.contains(el) || hit.closest?.(`#${PANEL_ID}`) ? el : null;
  }, { baseMs: 3000, maxMs: 8000, busy: () => false, everyMs: 200 });
  el = el?.isConnected ? el : find();
  return el && naukriActionable(el) ? { ok: true, value: el, problem: "" } : { ok: false, value: null, problem: "timeout" };
}

/**
 * React to a page problem during a run. Returns true when it took over (reload / pause / stop / skip).
 *   error   Naukri's error page: reload (up to 2 times for this URL), then skip the job / move on
 *   login   pause: log in to Naukri, then Resume
 *   blocked stop (captcha / unusual activity)
 *   expired skip the job
 */
function handleNaukriProblem(run, problem) {
  if (problem === "blocked") {
    stopNaukriRun("Naukri is showing a security check (captcha / unusual activity). Stopped to protect your account. Solve it, wait a while, then start again.");
    return true;
  }
  if (problem === "login") {
    pauseNaukriRun("Naukri logged you out. Log in to Naukri in this tab, open your search again and press <strong>Resume</strong>.");
    return true;
  }
  const job = run.queue?.[run.index];
  if (problem === "expired" && isNaukriJobPage() && job) {
    finishNaukriJob(run, job, "skipped", "This job is no longer available on Naukri.");
    return true;
  }
  if (problem === "error") {
    const tries = run.reloadUrl === location.href ? Number(run.reloadTries || 0) : 0;
    if (tries < 2) {
      run.reloadUrl = location.href;
      run.reloadTries = tries + 1;
      if (isNaukriJobPage()) run.phase = null; // nothing was clicked on an error page
      saveNaukriRun(run);
      addNaukriFeed(ICONS.alert, `Naukri showed an error page, reloading (${tries + 1}/2)…`);
      naukriLeaving = true;
      setTimeout(() => location.reload(), naukriTimeout(3000, 10000));
      return true;
    }
    if (isNaukriJobPage() && job) {
      finishNaukriJob(run, job, "failed", "Naukri kept showing an error page for this job.");
      return true;
    }
    addNaukriFeed(ICONS.alert, "Naukri kept showing an error page here, moving on.");
    advanceNaukriSearch(run);
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ job cards
/**
 * Job cards on the page. Known wrappers first (search: .srp-jobtuple-wrapper, recommended:
 * article.jobTuple); otherwise the smallest element holding exactly one /job-listings- link.
 */
function findNaukriCards() {
  // On search pages each card is .srp-jobtuple-wrapper with an article.jobTuple inside: keep only the
  // outermost, or every job is counted twice.
  const known = Array.from(document.querySelectorAll(".srp-jobtuple-wrapper, article.jobTuple"));
  if (known.length) return known.filter((el) => !known.some((other) => other !== el && other.contains(el)));
  const cards = new Set();
  for (const link of document.querySelectorAll("a[href*='/job-listings-']")) {
    let card = link;
    for (let node = link.parentElement; node && node !== document.body; node = node.parentElement) {
      const urls = new Set(Array.from(node.querySelectorAll("a[href*='/job-listings-']")).map((a) => a.href.split("?")[0]));
      if (urls.size > 1) break;
      card = node;
    }
    if (card !== link) cards.add(card);
  }
  return Array.from(cards);
}

function readNaukriCard(card) {
  const text = (selector) => naukriClean(card.querySelector(selector)?.textContent);
  const link = card.querySelector("a.title, a[href*='/job-listings-']");
  const url = link?.href || "";
  const jobId = card.getAttribute("data-job-id") || naukriJobIdFromUrl(url);
  // Applied cards carry an "Applied" label (a leaf element with just that text) or an *applied* class.
  const applied =
    Boolean(card.querySelector("[class*='applied' i]:not(.cp-naukri-flag)")) ||
    Array.from(card.querySelectorAll("span, div, p, i")).some((el) => el.children.length === 0 && /^applied$/i.test(naukriClean(el.textContent)));
  return {
    jobId,
    url,
    type: naukriApplyType(jobId),
    redirectHost: naukriApplyTypes.get(jobId)?.redirectHost || "",
    title: naukriClean(link?.getAttribute("title") || link?.textContent),
    company: text(".comp-name, a[href*='-jobs-careers-'], [class*='comp-name'], [class*='companyName']"),
    experience: text(".exp-wrap, .expwdth, [class*='exp-wrap'], [title*='Yrs']"),
    location: text(".loc-wrap, .locWdth, [class*='loc-wrap']"),
    posted: text(".job-post-day, [class*='job-post-day']"),
    applied,
  };
}

function readNaukriPageJobs() {
  const seen = new Set();
  const jobs = [];
  for (const card of findNaukriCards()) {
    const job = readNaukriCard(card);
    const key = job.jobId || job.url.split("?")[0] || job.title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    jobs.push(job);
  }
  return jobs;
}

// ------------------------------------------------------------------ apply type + card banners
/** "easy" | "easy-questions" | "company" | "unknown" (no search data for this job yet). */
function naukriApplyType(jobId) {
  const info = naukriApplyTypes.get(String(jobId || ""));
  if (!info) return "unknown";
  if (info.companyApply) return "company";
  return info.questions ? "easy-questions" : "easy";
}

// Line icons for the card banners (Lucide style, like the site's icons), drawn in the banner's colour.
const NAUKRI_FLAG_ICONS = {
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
};
const naukriFlagIcon = (name, color) =>
  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex:none" aria-hidden="true">${NAUKRI_FLAG_ICONS[name]}</svg>`;

// Card banners in the AutoApply CV colours: brand purple (#6047f5, as on the site and the sidebar) for
// what the run will apply to, emerald for applied, grey for what it skips.
const NAUKRI_FLAG_STYLES = {
  easy: { text: "Easy Apply", sub: "AutoApply CV can apply", color: "#4f38e0", bg: "#f4f2ff", border: "#d4ccff", icon: "bolt", iconColor: "#6047f5" },
  "easy-questions": { text: "Easy Apply · recruiter questions", sub: "answered from your answer bank", color: "#4f38e0", bg: "#f4f2ff", border: "#d4ccff", icon: "chat", iconColor: "#6047f5" },
  company: { text: "Apply on company site", sub: "AutoApply CV skips it", color: "#4b5563", bg: "#f9fafb", border: "#e5e7eb", icon: "external", iconColor: "#9ca3af" },
  applied: { text: "Already applied", sub: "", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0", icon: "check", iconColor: "#10b981" },
  "applied-run": { text: "Applied by AutoApply CV", sub: "", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0", icon: "check", iconColor: "#10b981" },
};

/** Put a banner at the top of every job card whose apply type is known. Safe to call repeatedly. */
function flagNaukriCards() {
  const appliedInRun = new Set((loadNaukriRun()?.results || []).filter((r) => r.outcome === "applied").map((r) => r.jobId));
  for (const card of findNaukriCards()) {
    const job = readNaukriCard(card);
    const kind = appliedInRun.has(job.jobId) ? "applied-run" : job.applied ? "applied" : job.type;
    const style = NAUKRI_FLAG_STYLES[kind];
    const existing = card.querySelector(":scope > .cp-naukri-flag");
    if (!style) {
      existing?.remove();
      continue;
    }
    if (existing?.dataset.kind === kind) continue;
    existing?.remove();
    const host = kind === "company" ? job.redirectHost : "";
    const flag = document.createElement("div");
    flag.className = "cp-naukri-flag";
    flag.dataset.kind = kind;
    flag.style.cssText = `display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 8px;padding:5px 10px;border-radius:8px;border:1px solid ${style.border};background:${style.bg};color:${style.color};font:600 12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif`;
    flag.innerHTML = `${naukriFlagIcon(style.icon, style.iconColor)}<span>${naukriEscape(style.text)}</span>${style.sub || host ? `<span style="font-weight:500;opacity:.75">${naukriEscape([host, style.sub].filter(Boolean).join(" · "))}</span>` : ""}`;
    card.prepend(flag);
  }
}

/** Scroll a job's card into view and ring it: "next" (purple), "applied" (green), "done" (grey). */
function spotlightNaukriCard(jobId, kind, label) {
  const card = findNaukriCards().find((c) => readNaukriCard(c).jobId === jobId);
  if (!card) return null;
  const colors = { next: "#6047f5", applied: "#10b981", done: "#9ca3af" };
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.style.transition = "box-shadow .4s ease";
  card.style.boxShadow = `0 0 0 3px ${colors[kind]}, 0 8px 24px rgba(0,0,0,.12)`;
  card.style.borderRadius = card.style.borderRadius || "12px";
  card.querySelector(":scope > .cp-naukri-spot")?.remove();
  if (label) {
    const tag = document.createElement("div");
    tag.className = "cp-naukri-spot";
    tag.style.cssText = `display:inline-block;margin:0 0 6px;padding:3px 10px;border-radius:999px;background:${colors[kind]};color:#fff;font:700 12px/1.5 system-ui,-apple-system,Segoe UI,sans-serif`;
    tag.textContent = label;
    card.prepend(tag);
  }
  return card;
}

function clearNaukriSpotlight(card) {
  if (!card) return;
  card.style.boxShadow = "";
  card.querySelector(":scope > .cp-naukri-spot")?.remove();
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.source === "cp-naukri-search" && Array.isArray(event.data.jobs)) {
    for (const job of event.data.jobs) {
      if (job?.jobId) naukriApplyTypes.set(String(job.jobId), job);
    }
    if (naukriPanel) flagNaukriCards();
  } else if (event.data?.source === "cp-naukri-apply") {
    naukriLastApplyMessage = { ...event.data, at: Date.now() };
    if (event.data.dailyApplied != null) syncNaukriAppliedToday(event.data.dailyApplied);
    // Naukri's own words about this job (e.g. why it refused it), kept for the result after its page change.
    const run = loadNaukriRun();
    const job = run?.queue?.[run.index];
    const mine = job && (event.data.jobs || []).find((j) => j.jobId === job.jobId);
    const said = naukriClean(mine?.message || event.data.message || "");
    if (run && job && said) {
      run.naukriSaid = { jobId: job.jobId, text: said.slice(0, 200), status: mine?.status ?? event.data.httpStatus };
      saveNaukriRun(run);
    }
  }
});
// Ask search-data-main.js for the responses it saw before this script loaded.
window.postMessage({ source: "cp-naukri-request" }, location.origin);

// ------------------------------------------------------------------ activity feed (kept in the run)
function addNaukriFeed(icon, html) {
  const run = loadNaukriRun() || { feed: [] };
  run.feed = [...(run.feed || []), { icon, html, time: naukriTime() }].slice(-80);
  run.progressAt = Date.now(); // every logged step counts as progress (stuck watchdog)
  saveNaukriRun(run);
  renderNaukriPanel();
}

// ------------------------------------------------------------------ Hires (same billing as LinkedIn)
// Each Naukri-confirmed application is reported to the portal as APPLIED (reasonCode SUBMITTED), which
// uses one free daily application, then one Hire, once per job (app/api/extension/import). Skipped and
// failed jobs are reported too (tracker) but cost nothing.
const NAUKRI_OUT_OF_HIRES_HTML = `Today's free applications are used up and you have no Hires left, so the run has stopped. <a href="${UPGRADE_URL}" target="_blank" rel="noopener">Upgrade or buy Hires</a> to keep applying, or come back tomorrow: free applications reset daily.`;
const NAUKRI_QUOTA_KEY = "cpNaukriQuota";
let naukriQuota = naukriRead(sessionStorage, NAUKRI_QUOTA_KEY, null);

/**
 * Take a balance (setAt = when the background got it). After a confirmed apply the sidebar has already
 * deducted it, so a HIGHER balance is only believed when it is real portal data (not the background's own
 * estimate, marked _extEstimatedAt) fetched after that apply: a stale figure can't undo a charge, while
 * Hires bought mid-run still show up once the portal reports them.
 */
function setNaukriQuota(data, setAt = Date.now()) {
  if (!data) return;
  const lastApplied = Number(loadNaukriRun()?.lastAppliedAt || 0);
  if (lastApplied && naukriQuota && !data.unlimited && Number(data.spendable) > Number(naukriQuota.spendable)) {
    const freshFromPortal = Number(setAt) > lastApplied && !data._extEstimatedAt;
    if (!freshFromPortal) return;
  }
  naukriQuota = data;
  naukriWrite(sessionStorage, NAUKRI_QUOTA_KEY, data);
}

function naukriMessage(message, timeoutMs = 8000) {
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

/**
 * Free applications or Hires left? Uses the balance the extension already has (the background answers
 * { ts, data, stale }) and refreshes it from the portal in the background; it only waits for that refresh
 * (up to 6 s) when there is no balance yet. Unknown balance (portal not reachable) does not block.
 */
async function naukriHasHires() {
  const take = (response) => {
    if (response?.portalQuota?.data) setNaukriQuota(response.portalQuota.data, response.portalQuota.ts);
    return response;
  };
  const cached = take(await naukriMessage({ type: "CP_GET_PORTAL_QUOTA" }, 3000));
  const refresh = naukriMessage({ type: "CP_GET_PORTAL_QUOTA", refresh: true }, 30000).then((r) => {
    take(r);
    renderNaukriPanel();
    return r;
  });
  if (!cached?.portalQuota?.data || cached.portalQuota.stale) await Promise.race([refresh, naukriSleep(6000)]);
  const q = naukriQuota;
  if (!q || q.unlimited) return true;
  const spendable = Number(q.spendable);
  return !Number.isFinite(spendable) || spendable > 0;
}

/** "2 free + 27 Hires left" (or "29 left" / "Unlimited (Pro)"), from the latest balance. */
function naukriHiresLabel() {
  const q = naukriQuota;
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

/**
 * Keep the pill live: the background updates its balance as soon as an application is reported and
 * again when the portal confirms the charge, so re-read it every 10 s and ask the portal every 2 min.
 */
let naukriQuotaReadAt = 0;
let naukriQuotaRefreshAt = 0;
function pollNaukriQuota() {
  const now = Date.now();
  const justApplied = now - Number(loadNaukriRun()?.lastAppliedAt || 0) < 30000;
  if (now - naukriQuotaReadAt < (justApplied ? 2000 : 10000)) return;
  naukriQuotaReadAt = now;
  const refresh = now - naukriQuotaRefreshAt > 120000;
  if (refresh) naukriQuotaRefreshAt = now;
  void naukriMessage({ type: "CP_GET_PORTAL_QUOTA", refresh }, refresh ? 30000 : 3000).then((r) => {
    if (r?.portalQuota?.data) {
      setNaukriQuota(r.portalQuota.data, r.portalQuota.ts);
      renderNaukriPanel();
    }
  });
}

/** Send a result to the portal (Applications tracker; APPLIED is what gets charged). */
function reportNaukriOutcome(job, outcome, detail) {
  const outcomeType = { applied: "APPLIED", failed: "FAILED" }[outcome] || "SKIPPED";
  const jobUrl = String(job.url || "").split("?")[0] || (job.jobId ? `https://www.naukri.com/job-listings-${job.jobId}` : "");
  void naukriMessage({
    type: "CP_RECORD_OUTCOME",
    outcomeType,
    data: {
      provider: "naukri",
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
    // The background already lowered its balance for this application: show it now.
    if (outcome === "applied") {
      naukriQuotaReadAt = 0;
      pollNaukriQuota();
    }
  });
  // Show the charge at once (same rule as the portal: a free application first, then a Hire); the
  // background's figure replaces this within seconds.
  if (outcome === "applied" && naukriQuota && !naukriQuota.unlimited) {
    const q = { ...naukriQuota };
    if (Number(q.freeRemaining) > 0) q.freeRemaining = Number(q.freeRemaining) - 1;
    else if (Number(q.hireBalance) > 0) q.hireBalance = Number(q.hireBalance) - 1;
    if (Number.isFinite(Number(q.spendable))) q.spendable = Math.max(0, Number(q.spendable) - 1);
    setNaukriQuota(q);
    renderNaukriPanel();
  }
}

// ------------------------------------------------------------------ dashboard filters (synced to the extension)
// The dashboard syncs the user's job preferences to the extension (src/lib/sync-profile.ts -> cpSettings):
// searchTerms (target job titles), skills + oneWordKeywords + twoWordsKeywords (tech they want), badWords
// (exclude words), blacklistedCompanies, currentExperience, searchLocation. Same settings LinkedIn uses.
let naukriUserSettings = null;

function loadNaukriUserSettings() {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(naukriUserSettings || {}), 5000);
    try {
      chrome.runtime.sendMessage({ type: "CP_GET_BOOTSTRAP" }, (response) => {
        void chrome.runtime.lastError;
        clearTimeout(timer);
        if (response?.settings) naukriUserSettings = response.settings;
        resolve(naukriUserSettings || {});
      });
    } catch {
      clearTimeout(timer);
      resolve(naukriUserSettings || {});
    }
  });
}

const naukriList = (value) =>
  (Array.isArray(value) ? value : String(value || "").split(/[,\n]/))
    .map((item) => String(item || "").trim())
    .filter(Boolean);

/** Words for whole-word matching; keeps tech characters (c++, c#, node.js -> "node js"). */
const naukriWords = (value) => ` ${String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim()} `;
// Both sides lowercased first: "JavaScript" in a job must match the skill "javascript" (not split to "java script").
const naukriHasWord = (text, word) => {
  const w = naukriWords(String(word || "").toLowerCase()).trim();
  return Boolean(w) && naukriWords(String(text || "").toLowerCase()).includes(` ${w} `);
};

/** The user's tech: skills + 1-word + 2-word keywords from the dashboard. */
function naukriWantedTech(settings) {
  return [...new Set([...naukriList(settings?.skills), ...naukriList(settings?.oneWordKeywords), ...naukriList(settings?.twoWordsKeywords)].map((w) => w.toLowerCase()))];
}

/** Why a job doesn't fit the user's dashboard filters ("" = it fits). Also sets job.matched. */
function naukriFilterReason(job, settings) {
  const info = naukriApplyTypes.get(job.jobId) || {};
  const title = info.title || job.title || "";
  const company = info.company || job.company || "";
  const blacklisted = naukriList(settings?.blacklistedCompanies).find((name) => company && naukriWords(company).includes(naukriWords(name)));
  if (blacklisted) return `Company on your blacklist (${blacklisted})`;
  const bad = naukriList(settings?.badWords).find((word) => naukriHasWord(title, word));
  if (bad) return `"${bad}" is in the title (your exclude keywords)`;

  const years = Number(settings?.currentExperience);
  if (Number.isFinite(years) && years >= 0 && info.minExp != null) {
    if (info.minExp > years + 1) return `Needs ${info.minExp}+ years (you have ${years})`;
    if (info.maxExp != null && info.maxExp < years - 3) return `For ${info.minExp}-${info.maxExp} years (you have ${years})`;
  }

  const tech = naukriWantedTech(settings);
  if (tech.length) {
    const haystack = `${title} ${info.skills || ""}`;
    job.matched = tech.filter((word) => naukriHasWord(haystack, word)).slice(0, 5);
    if (!job.matched.length) return "No match with your skills / keywords";
  }
  return "";
}

// Naukri's filter parameters (seen on a real filtered search):
//   /full-stack-developer-jobs-in-palampur?experience=4&wfhType=0&ctcFilter=6to10&ctcFilter=3to6&jobAge=15
// City goes in the path; wfhType 0 = office, 2 = remote, 3 = hybrid; ctcFilter = salary range in lakhs;
// jobAge = posted within N days. The dashboard's "Open Naukri Jobs" button builds the same URL (Jobs.tsx).
const NAUKRI_CTC_RANGES = [[0, 3], [3, 6], [6, 10], [10, 15], [15, 25], [25, 50], [50, 75], [75, 100]];
const NAUKRI_WFH_TYPES = { onsite: "0", "on-site": "0", office: "0", remote: "2", hybrid: "3" };
const NAUKRI_JOB_AGE = { "past 24 hours": "1", "past week": "7", "past month": "30" };

/** A salary preference in lakhs: "6", "6 LPA" or rupees per year ("600000"). */
function naukriLakhs(value) {
  const amount = Number.parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount >= 1000 ? amount / 100000 : amount;
}

/** Naukri's own filtered search URL for a job title, from the dashboard filters. */
function naukriSearchUrl(term, settings, page = 1) {
  const query = String(term || "").trim().toLowerCase().replace(/\s+/g, " ");
  const slug = query.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const workModes = naukriList(settings?.onSite).map((mode) => mode.toLowerCase());
  const city = String(settings?.searchLocation || naukriList(settings?.filterLocations)[0] || "").trim().toLowerCase();
  const citySlug = city && !workModes.includes("remote") && !/remote|anywhere|india/.test(city) ? city.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") : "";
  const params = new URLSearchParams({ k: query });
  const years = Number(settings?.currentExperience);
  if (Number.isFinite(years) && years >= 0) params.set("experience", String(years));
  for (const type of new Set(workModes.map((mode) => NAUKRI_WFH_TYPES[mode]).filter(Boolean))) params.append("wfhType", type);
  const low = naukriLakhs(settings?.salaryMin);
  const high = naukriLakhs(settings?.salaryMax);
  if (low !== null || high !== null) {
    for (const [from, to] of NAUKRI_CTC_RANGES) {
      if ((low === null || to > low) && (high === null || from < high)) params.append("ctcFilter", `${from}to${to}`);
    }
  }
  const jobAge = NAUKRI_JOB_AGE[String(settings?.datePosted || "").trim().toLowerCase()];
  if (jobAge) params.set("jobAge", jobAge);
  params.set("nignbevent_src", "jobsearchDeskGNB");
  return `https://www.naukri.com/${slug}-jobs${citySlug ? `-in-${citySlug}` : ""}${page > 1 ? `-${page}` : ""}?${params.toString()}`;
}

/** Same search, next results page (/x-jobs -> /x-jobs-2 -> /x-jobs-3), or "" when there are no pages. */
function naukriNextPageUrl(url) {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/^(.*-jobs(?:-in-[a-z0-9-]+)?)(?:-(\d+))?\/?$/i);
    if (!match) return "";
    u.pathname = `${match[1]}-${Number(match[2] || 1) + 1}`;
    return u.toString();
  } catch {
    return "";
  }
}

/** The search term of the current results page (?k=..., else from the path). */
function naukriCurrentTerm() {
  const k = new URLSearchParams(location.search).get("k");
  if (k) return k.trim().toLowerCase();
  const match = location.pathname.match(/^\/(.+?)-jobs/i);
  return match ? match[1].replace(/-/g, " ") : "";
}

function naukriFiltersSummary(settings) {
  const titles = naukriList(settings?.searchTerms);
  const tech = naukriWantedTech(settings);
  const exclude = naukriList(settings?.badWords);
  const years = Number(settings?.currentExperience);
  return [
    titles.length ? `${titles.length} job title${titles.length === 1 ? "" : "s"}` : "no job titles",
    tech.length ? `${tech.length} skills` : "any skills",
    exclude.length ? `${exclude.length} exclude words` : "",
    Number.isFinite(years) && years >= 0 ? `${years} yrs exp` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

// ------------------------------------------------------------------ run: start / pause / stop
async function startNaukriRun() {
  const existing = loadNaukriRun();
  if (existing?.status === "paused") return resumeNaukriRun();
  if (existing?.status === "running") return;
  if (!isNaukriJobsListPage()) return;
  if (!(await naukriHasHires())) {
    addNaukriFeed(ICONS.alert, NAUKRI_OUT_OF_HIRES_HTML);
    return;
  }
  const settings = await loadNaukriUserSettings();
  // This page's search first, then every target job title from the dashboard.
  const terms = [...new Set([naukriCurrentTerm(), ...naukriList(settings.searchTerms).map((t) => t.toLowerCase())].filter(Boolean))];

  const run = {
    status: "running",
    returnUrl: location.href,
    queue: [],
    index: 0,
    needsQueue: true,
    plan: { terms, termIndex: 0, pagesDone: 0 },
    nextAt: Date.now(),
    results: [],
    feed: (existing?.feed || []).slice(-40),
  };
  saveNaukriRun(run);
  addNaukriFeed(
    ICONS.play,
    `Run started with your dashboard filters: ${naukriEscape(naukriFiltersSummary(settings))}. Searching: ${terms.map((t) => `<strong>${naukriEscape(t)}</strong>`).join(", ") || "this page"}.`
  );
  naukriTab = "feed";
  renderNaukriPanel();
}

/** On a results page: queue the Easy Apply jobs that fit the user's filters. */
async function queueNaukriPage(run) {
  const settings = await loadNaukriUserSettings();
  // Cards and their apply types (Naukri's search answer) arrive after the page loads, later on a slow
  // connection. The page only counts as empty when Naukri itself says there are no jobs.
  setNaukriStatus("Loading jobs…");
  const ready = await naukriWhenReady(() => {
    if (NAUKRI_NO_RESULTS_TEXT.test(document.body?.innerText || "") && !findNaukriCards().length) return "no-results";
    const jobs = readNaukriPageJobs();
    return jobs.length && jobs.filter((j) => j.type !== "unknown").length >= Math.min(jobs.length, 3) ? "jobs" : null;
  }, { baseMs: 15000, maxMs: 90000, expectedMs: 3000 });
  if (!ready.ok && ready.problem !== "timeout" && handleNaukriProblem(run, ready.problem)) return;
  if (!ready.ok && !findNaukriCards().length) {
    // Neither jobs nor Naukri's "no jobs" message: reload this page once before treating it as empty.
    if (run.emptyReloadUrl !== location.href) {
      run.emptyReloadUrl = location.href;
      saveNaukriRun(run);
      addNaukriFeed(ICONS.alert, "The results didn't load, reloading the page once…");
      naukriLeaving = true;
      location.reload();
      return;
    }
  }
  naukriJobs = readNaukriPageJobs();

  const done = new Set(run.results.map((r) => r.jobId));
  const queue = [];
  let company = 0;
  let filtered = 0;
  for (const job of naukriJobs) {
    if (!job.jobId || done.has(job.jobId) || queue.some((q) => q.jobId === job.jobId) || job.applied) continue;
    if (job.type === "company") {
      company += 1;
      continue;
    }
    const reason = naukriFilterReason(job, settings);
    if (reason) {
      filtered += 1;
      run.results.push({ jobId: job.jobId, url: job.url, title: job.title, company: job.company, outcome: "skipped", detail: reason, ts: naukriTime() });
      reportNaukriOutcome(job, "skipped", reason);
      continue;
    }
    queue.push({ jobId: job.jobId, url: job.url, title: job.title, company: job.company, type: job.type, matched: job.matched || [] });
  }
  run.queue = queue;
  run.index = 0;
  run.needsQueue = false;
  run.returnUrl = location.href;
  run.shownResult = run.results.length;
  run.nextAt = Date.now() + 1500;
  run.emptyPage = naukriJobs.length === 0;
  saveNaukriRun(run);
  const term = run.plan?.terms?.[run.plan.termIndex] || naukriCurrentTerm();
  addNaukriFeed(
    queue.length ? ICONS.target : ICONS.skip,
    `<strong>${naukriEscape(term || "This page")}</strong>, page ${(run.plan?.pagesDone || 0) + 1}: <strong>${queue.length}</strong> to apply` +
      `${filtered ? `, ${filtered} skipped by your filters` : ""}${company ? `, ${company} company site` : ""}.`
  );
}

/** Done with this page: next results page, then the next job title; finish after the last one. */
function advanceNaukriSearch(run) {
  const plan = run.plan || { terms: [], termIndex: 0, pagesDone: 0 };
  plan.pagesDone += 1;
  let url = "";
  if (!run.emptyPage && plan.pagesDone < NAUKRI_PAGES_PER_SEARCH) url = naukriNextPageUrl(run.returnUrl);
  if (!url) {
    plan.termIndex += 1;
    plan.pagesDone = 0;
    if (plan.termIndex < plan.terms.length) url = naukriSearchUrl(plan.terms[plan.termIndex], naukriUserSettings, 1);
  }
  run.plan = plan;
  if (!url) {
    saveNaukriRun(run);
    finishNaukriRun();
    return;
  }
  run.needsQueue = true;
  run.queue = [];
  run.index = 0;
  saveNaukriRun(run);
  addNaukriFeed(ICONS.search, plan.pagesDone ? `Next page of <strong>${naukriEscape(plan.terms[plan.termIndex] || "this search")}</strong>…` : `Next job title: <strong>${naukriEscape(plan.terms[plan.termIndex])}</strong>…`);
  naukriGoTo(url);
}

function pauseNaukriRun(reason) {
  const run = loadNaukriRun();
  if (!run || run.status !== "running") return;
  run.status = "paused";
  run.phase = null;
  saveNaukriRun(run);
  addNaukriFeed(ICONS.pause, reason || "Paused. Press Resume to continue.");
}

function resumeNaukriRun() {
  const run = loadNaukriRun();
  if (!run || run.status !== "paused") return;
  run.status = "running";
  run.nextAt = Date.now();
  saveNaukriRun(run);
  addNaukriFeed(ICONS.play, "Resumed.");
  if (isNaukriJobPage() && run.returnUrl) naukriGoTo(run.returnUrl);
}

function stopNaukriRun(reason) {
  const run = loadNaukriRun();
  if (!run || run.status === "done" || run.status === "stopped") return;
  run.status = "stopped";
  run.phase = null;
  saveNaukriRun(run);
  addNaukriFeed(ICONS.stop, reason || "Stopped.");
}

function finishNaukriRun() {
  const run = loadNaukriRun();
  if (!run) return;
  run.status = "done";
  saveNaukriRun(run);
  const count = (outcome) => run.results.filter((r) => r.outcome === outcome).length;
  addNaukriFeed(
    ICONS.check,
    `Run finished: <strong>${count("applied")}</strong> applied, ${count("skipped")} skipped, ${count("failed")} failed. Every job title from your dashboard was searched.`
  );
}

function recordNaukriResult(run, job, outcome, detail) {
  run.results.push({ jobId: job.jobId, url: job.url, title: job.title, company: job.company, outcome, detail, ts: naukriTime() });
  reportNaukriOutcome(job, outcome, detail);
  run.index += 1;
  run.phase = null;
  run.nextAt = Date.now() + naukriRandom(NAUKRI_PACE_MS);
  if (outcome === "applied") run.lastAppliedAt = Date.now(); // pill re-checks the balance quickly for 30 s
  run.wait = null;
  run.naukriSaid = null;
  saveNaukriRun(run);
}

// ------------------------------------------------------------------ Naukri elements under the sidebar
/**
 * Naukri pins its chatbot drawer and some floating buttons to the right edge (position: fixed), where
 * the docked sidebar covers them. Move those left of the sidebar while it is open.
 */
function keepNaukriOverlaysVisible() {
  const docked = naukriPanel && !naukriPanel.classList.contains("cp-sidebar-collapsed");
  for (const el of document.querySelectorAll("[data-cp-shifted]")) {
    if (!docked) {
      el.style.removeProperty("right");
      delete el.dataset.cpShifted;
    }
  }
  if (!docked) return;
  const candidates = new Set(document.querySelectorAll(".chatbot_Drawer, [id*='ChatbotContainer'], .chatbot_DrawerContentWrapper, body > div, body > section, body > aside, body > button, body > a"));
  for (const start of candidates) {
    for (let el = start; el && el !== document.body; el = el.parentElement) {
      if (el.id === PANEL_ID || el.id === TOGGLE_ID || el.dataset.cpShifted) break;
      const style = getComputedStyle(el);
      if (style.position !== "fixed") continue;
      const rect = el.getBoundingClientRect();
      // Only drawers and floating buttons on the right: not full-width bars.
      if (rect.width > 0 && rect.width < 700 && rect.right > window.innerWidth - NAUKRI_PANEL_WIDTH) {
        el.style.setProperty("right", `${NAUKRI_PANEL_WIDTH + Math.max(0, parseFloat(style.right) || 0)}px`, "important");
        el.dataset.cpShifted = "1";
      }
      break;
    }
  }
}

// ------------------------------------------------------------------ recruiter chatbot (questions after Apply)
// Markup (seen live): .chatbot_DrawerContentWrapper > .chatbot_MessageContainer > ul.list > li.botItem .botMsg
// (questions); answers as radio (.ssrc__radio + label.ssrc__label), checkboxes (.mcc__label), chips
// (.chatbot_Chip) or text (.textArea[contenteditable]); Save = .sendMsg inside #sendMsg__… which has the
// class "disabled" until an answer is picked.
const NAUKRI_DONE_TEXT = /successfully applied|applied successfully|thank you for your responses|application (has been )?(sent|submitted)/i;

function naukriChatbot() {
  const root = document.querySelector(".chatbot_DrawerContentWrapper") || document.querySelector("[id*='ChatbotContainer'], .chatbot_Drawer");
  const rect = root?.getBoundingClientRect();
  return rect && rect.width > 0 && rect.height > 0 ? root : null;
}

const naukriShown = (el) => {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && !el.closest(".d-none");
};

/** The current question and how it is answered: { text, count, type, options: [{ text, el }], input }. */
function readNaukriQuestion(root) {
  const bots = Array.from(root.querySelectorAll(".botItem .botMsg, .chatbot_ListItem .botMsg"))
    .map((el) => naukriClean(el.textContent))
    .filter(Boolean);
  const question = { text: bots[bots.length - 1] || "", count: bots.length, type: "", options: [], input: null };

  const radios = Array.from(root.querySelectorAll("input.ssrc__radio")).filter((input) => naukriShown(input.closest(".ssrc__radio-btn-container") || input));
  const checkboxes = Array.from(root.querySelectorAll(".multicheckboxes-container input[type='checkbox'], .multiselectcheckboxes input[type='checkbox']")).filter((input) => naukriShown(input.closest("div") || input));
  const chips = Array.from(root.querySelectorAll(".chatbot_Chip, .chipsContainer .chip")).filter(naukriShown);
  const select = Array.from(root.querySelectorAll("select")).find(naukriShown);
  const text = Array.from(root.querySelectorAll(".textArea[contenteditable='true']")).find(naukriShown);
  const labelOf = (input) =>
    naukriClean(input.closest(".ssrc__radio-btn-container, div")?.querySelector("label")?.textContent || input.value || input.id);

  if (radios.length) {
    question.type = "radio";
    question.options = radios.map((input) => ({ text: labelOf(input), el: input.closest(".ssrc__radio-btn-container")?.querySelector("label") || input }));
  } else if (checkboxes.length) {
    question.type = "checkbox";
    question.options = checkboxes.map((input) => ({ text: labelOf(input), el: input.closest("div")?.querySelector("label.mcc__label, label") || input }));
  } else if (chips.length) {
    question.type = "radio";
    question.options = chips.map((chip) => ({ text: naukriClean(chip.textContent), el: chip }));
  } else if (select) {
    question.type = "select";
    question.input = select;
    question.options = Array.from(select.options).filter((o) => o.value).map((o) => ({ text: naukriClean(o.textContent), el: o }));
  } else if (text) {
    question.type = "text";
    question.input = text;
  }
  return question;
}

const naukriNorm = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// "Skip this question" / "Prefer not to say" leave a mandatory question unanswered: Naukri then rejects the
// whole application (406 "incomplete information"). Never picked automatically; the user is asked instead.
const NAUKRI_SKIP_OPTION = /^(skip|skip this( question)?|prefer not to (say|answer)|i'?d rather not (say|answer)|not applicable|n\/?a)$/i;

/** The number range an option stands for: "3-5 years" -> [3, 5], "5+" -> [5, inf), "less than 2" -> [-inf, 2). */
function naukriOptionRange(text) {
  const t = String(text || "").toLowerCase();
  const range = t.match(/(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)/);
  if (range) return [Number(range[1]), Number(range[2])];
  const plus = t.match(/(\d+(?:\.\d+)?)\s*\+|(?:more than|above|over|at least|minimum)\s*(\d+(?:\.\d+)?)/);
  if (plus) return [Number(plus[1] ?? plus[2]), Infinity];
  const less = t.match(/(?:less than|below|under|upto|up to|max(?:imum)?)\s*(\d+(?:\.\d+)?)/);
  if (less) return [-Infinity, Number(less[1]) - 1e-9];
  return null;
}

/**
 * Best option for an answer, strictest first: exact text; the option as a whole word/phrase in the answer
 * ("Yes, I have" -> "Yes") or the answer as a whole phrase in the option ("30" -> "30 Days"); then a number
 * inside the option's range ("4" -> "3-5 years"). Skip-style options only when allowSkip (the user chose it).
 */
function matchNaukriOption(options, answer, { allowSkip = false } = {}) {
  const target = naukriNorm(answer);
  if (!target) return null;
  const usable = options.filter((o) => allowSkip || !NAUKRI_SKIP_OPTION.test(naukriClean(o.text)));
  const padded = (v) => ` ${naukriNorm(v)} `;
  const exact = usable.find((o) => naukriNorm(o.text) === target);
  if (exact) return exact;
  const optionInAnswer = usable.filter((o) => naukriNorm(o.text).length > 1 && padded(target).includes(padded(o.text)));
  if (optionInAnswer.length) return optionInAnswer.sort((a, b) => naukriNorm(b.text).length - naukriNorm(a.text).length)[0];
  const answerInOption = usable.find((o) => padded(o.text).includes(padded(target)));
  if (answerInOption) return answerInOption;
  const number = Number((String(answer).match(/-?\d+(?:\.\d+)?/) || [])[0]);
  if (Number.isFinite(number)) {
    const inRange = usable.find((o) => {
      const r = naukriOptionRange(o.text);
      return r && number >= r[0] && number <= r[1];
    });
    if (inRange) return inRange;
  }
  return null;
}

/** Answer bank first, then AI from the resume (background CP_AI_ANSWER, shared with LinkedIn). */
function askNaukriAnswer(question, type, options) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(""), 25000);
    try {
      chrome.runtime.sendMessage({ type: "CP_AI_ANSWER", question, questionType: type, options, jobContext: { source: "naukri" } }, (response) => {
        void chrome.runtime.lastError;
        clearTimeout(timer);
        resolve(response?.ok ? String(response.answer || "").trim() : "");
      });
    } catch {
      clearTimeout(timer);
      resolve("");
    }
  });
}

/**
 * Fill the answer into the chatbot. Returns what was entered, or "" when it doesn't fit the question.
 * Chips (".chatbot_Chip") send the answer as soon as one is pressed; when none fits, "Load more" shows
 * the rest of them.
 */
async function fillNaukriAnswer(question, answer, { allowSkip = false } = {}) {
  if (question.type === "radio") {
    let option = matchNaukriOption(question.options, answer, { allowSkip });
    for (let more = 0; !option && more < 3; more += 1) {
      const loadMore = Array.from(naukriChatbot()?.querySelectorAll("._link, .chatbot_Chips [class*='link']") || []).find(
        (el) => /load more/i.test(el.textContent || "") && naukriShown(el)
      );
      if (!loadMore) break;
      const before = readNaukriQuestion(naukriChatbot() || document).options.length;
      naukriPress(loadMore);
      await naukriWaitWhileBusy(() => readNaukriQuestion(naukriChatbot() || document).options.length > before, { baseMs: 3000, maxMs: 15000, busy: () => naukriNet().chat > 0 });
      option = matchNaukriOption(readNaukriQuestion(naukriChatbot() || document).options, answer, { allowSkip });
    }
    if (!option) return "";
    naukriPress(option.el);
    return option.text;
  }
  if (question.type === "checkbox") {
    const picked = String(answer)
      .split(/\s*(?:,|;|\band\b)\s*/i)
      .map((part) => matchNaukriOption(question.options, part, { allowSkip }))
      .filter(Boolean);
    for (const option of new Set(picked)) {
      naukriPress(option.el);
      await naukriSleep(250);
    }
    return picked.map((o) => o.text).join(", ");
  }
  if (question.type === "select") {
    const option = matchNaukriOption(question.options, answer, { allowSkip });
    if (!option) return "";
    question.input.value = option.el.value;
    question.input.dispatchEvent(new Event("change", { bubbles: true }));
    return option.text;
  }
  if (question.type === "text") {
    // Enter sends the message, so keep it on one line.
    let value = String(answer).replace(/[\r\n]+/g, " ").trim().slice(0, 300);
    // "Expected CTC in Lacs per annum?" with an answer in rupees ("800000") -> "8".
    const rupees = Number(value.replace(/[,\s]/g, "").replace(/(inr|rs\.?|₹)/gi, ""));
    if (/\b(lacs?|lakhs?|lpa)\b/i.test(question.text) && Number.isFinite(rupees) && rupees >= 1000) {
      value = String(Math.round((rupees / 100000) * 10) / 10);
    }
    const box = question.input;
    box.focus();
    document.execCommand("selectAll", false);
    if (!document.execCommand("insertText", false, value)) box.textContent = value;
    box.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
    return value;
  }
  return "";
}

/** Your replies so far in the chat (each sent answer adds one). */
const naukriUserReplies = (root) => (root || naukriChatbot() || document).querySelectorAll(".chatbot_ListItem.userItem, .userMsg").length;

/** The Save wrapper (#sendMsg__…) of the chat that is open now: visible ones first, never a stale one. */
function naukriSendWrapper(root) {
  const all = [...(root?.querySelectorAll("[id^='sendMsg__']") || []), ...document.querySelectorAll("[id^='sendMsg__']")];
  return all.find((el) => el.getBoundingClientRect().width > 0) || all[0] || null;
}

/**
 * Press Save once Naukri enables it (#sendMsg__… loses "disabled") and confirm Naukri took the answer
 * (a new reply of yours appears or the question moves on). If a press doesn't take: a native click, then
 * Enter in the text box. For chip questions Naukri hides Save (.sendMsgbtn_container.visibility-hidden):
 * pressing the chip already sent the answer. Returns true when the answer was sent.
 */
async function sendNaukriAnswer(root, question) {
  const repliesBefore = naukriUserReplies(root);
  const sent = () => {
    const now = naukriChatbot();
    if (!now || isNaukriApplyConfirmationPage()) return true;
    if (naukriUserReplies(now) > repliesBefore) return true;
    const q = readNaukriQuestion(now);
    return Boolean(question) && (q.count !== question.count || q.text !== question.text);
  };
  const wrapper = naukriSendWrapper(root);
  const container = wrapper?.closest(".sendMsgbtn_container");
  if (!wrapper || (container && (container.classList.contains("visibility-hidden") || getComputedStyle(container).visibility === "hidden"))) {
    // Chips: the answer goes on press. Give Naukri a moment to show it.
    return Boolean(await naukriWaitWhileBusy(sent, { baseMs: 3000, maxMs: 12000, busy: () => naukriNet().chat > 0 }));
  }
  const enabled = await naukriWaitWhileBusy(() => {
    const el = naukriSendWrapper(naukriChatbot() || root);
    return el && !el.classList.contains("disabled") ? el : null;
  }, { baseMs: 5000, maxMs: 20000, everyMs: 200, busy: () => naukriNet().chat > 0 });
  if (!enabled) return Boolean(sent());
  const attempts = [
    (w) => naukriPress(w.querySelector(".sendMsg") || w),
    (w) => (w.querySelector(".sendMsg") || w).click(),
    (w) => w.click(),
    () => {
      const box = Array.from(document.querySelectorAll(".textArea[contenteditable='true']")).find(naukriShown);
      if (!box) return;
      box.focus();
      for (const type of ["keydown", "keypress", "keyup"]) box.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    },
  ];
  for (const attempt of attempts) {
    const current = naukriSendWrapper(naukriChatbot() || root);
    if (!current || sent()) break;
    if (current.classList.contains("disabled")) {
      // Disabled again right after a press usually means Naukri is sending it.
      if (await naukriWaitWhileBusy(sent, { baseMs: 3000, maxMs: 15000, busy: () => naukriNet().chat > 0 })) return true;
      break;
    }
    attempt(current);
    if (await naukriWaitWhileBusy(sent, { baseMs: 2500, maxMs: 15000, busy: () => naukriNet().chat > 0 })) return true;
  }
  return Boolean(sent());
}

/**
 * The chatbot drawer, waiting through the moment Naukri re-draws it between questions: only "gone"
 * after it has been missing for 3 s in a row (or the confirmation page has loaded).
 */
async function naukriChatbotSettled() {
  const until = Date.now() + naukriTimeout(3000, 10000);
  while (Date.now() < until) {
    if (isNaukriApplyConfirmationPage()) return null;
    const root = naukriChatbot();
    if (root) return root;
    await naukriSleep(300);
  }
  return null;
}

/** Wait until the chatbot moves on from this question (or closes / the confirmation page loads). */
/**
 * Whose turn it is in the recruiter chat:
 *   "asking"    a bot question is the last message, Naukri has no chatbot request in flight and the
 *               answer controls are drawn: answer it
 *   "thinking"  your reply is the last message or a chatbot request is in flight. Naukri briefly
 *               re-enables Save here (~1 s) before the next question: that is NOT a question to answer
 *   "done"      "Thank you for your responses" / applied text
 */
function naukriChatTurn(root) {
  if (!root) return "thinking";
  if (NAUKRI_DONE_TEXT.test(root.innerText || "")) return "done";
  if (naukriNet().chat > 0) return "thinking";
  const items = Array.from(root.querySelectorAll(".chatbot_ListItem")).filter((li) => !li.classList.contains("botLogo"));
  const last = items[items.length - 1];
  if (!last || !last.classList.contains("botItem")) return "thinking";
  const q = readNaukriQuestion(root);
  return q.type && q.text ? "asking" : "thinking";
}

/**
 * Wait for Naukri's turn to ask, steady for a moment (the question and its controls fully drawn).
 * Resolves "asking" | "done" | "confirmation" | null (timeout).
 */
function naukriWaitForQuestion() {
  let since = 0;
  let lastKey = "";
  return naukriWaitWhileBusy(() => {
    if (isNaukriApplyConfirmationPage()) return "confirmation";
    const root = naukriChatbot();
    if (!root) return null;
    const turn = naukriChatTurn(root);
    if (turn === "done") return "done";
    if (turn !== "asking") {
      since = 0;
      return null;
    }
    const q = readNaukriQuestion(root);
    const key = `${q.count}|${q.text}|${q.type}|${q.options.length}`;
    if (key !== lastKey) {
      lastKey = key;
      since = Date.now();
      return null;
    }
    return Date.now() - since >= 600 ? "asking" : null;
  }, { baseMs: 15000, maxMs: 60000, everyMs: 200, busy: () => naukriNet().chat > 0 });
}

function naukriQuestionChanged(question, timeoutMs, { manual = false } = {}) {
  let missingSince = 0;
  const read = () => {
    if (isNaukriApplyConfirmationPage()) return "confirmation";
    const root = naukriChatbot();
    if (!root) {
      // Naukri re-draws the drawer between questions; only call it closed after it stays gone a while.
      missingSince ||= Date.now();
      return Date.now() - missingSince > naukriTimeout(3000, 10000) && naukriNet().chat === 0 ? "closed" : null;
    }
    missingSince = 0;
    const turn = naukriChatTurn(root);
    if (turn === "done") return "done";
    const now = readNaukriQuestion(root);
    // Moved on only once Naukri asks the next question (not during its "thinking" moment, when the old
    // question is still the last bot message and Save flickers on).
    return (now.count !== question.count || now.text !== question.text) && turn === "asking" ? "next" : null;
  };
  // Waiting for the person to answer: a plain time limit. Waiting for Naukri: stretched, and longer while
  // its chatbot request is still in flight.
  if (manual) return naukriWaitWhileBusy(read, { baseMs: timeoutMs, maxMs: timeoutMs, busy: () => false });
  return naukriWaitWhileBusy(read, { baseMs: timeoutMs, maxMs: timeoutMs * 4, busy: () => naukriNet().chat > 0, expectedMs: 2000 });
}

/** Save an answer to the answer bank (extension + dashboard), so the question is automatic next time. */
function saveNaukriAnswer(question, answer) {
  const value = naukriClean(answer);
  if (!question?.text || !value) return;
  void naukriMessage({
    type: "CP_SAVE_QUESTION_ANSWER",
    questionKey: naukriNorm(question.text).replace(/\s+/g, "_").slice(0, 120),
    questionLabel: question.text,
    answer: value,
    answerType: question.type === "text" ? "text" : "choice",
    fromPanel: true,
    source: "naukri",
  });
}

/** The last answer you sent in the chat (to save what you answered in Naukri yourself). */
function naukriLastUserReply() {
  const replies = (naukriChatbot() || document).querySelectorAll(".chatbot_ListItem.userItem, .userMsg");
  return naukriClean(replies[replies.length - 1]?.textContent || "");
}

/**
 * Ask the user in the sidebar: the question with Naukri's options as buttons (checkboxes as toggles, then
 * Answer) or a text box, the suggestion pre-filled. The answer goes into the Naukri chat (Save pressed) and
 * into the answer bank. Answering in the Naukri chat directly also works (and is saved too).
 * Resolves "next" | "closed" | "done" | "confirmation" | null (3 minutes without an answer).
 */
function askNaukriInSidebar(question, suggestion) {
  const panel = naukriPanel;
  if (!panel) return naukriQuestionChanged(question, 180000, { manual: true });
  let card = panel.querySelector("#cp-ask");
  if (!card) {
    card = document.createElement("div");
    card.id = "cp-ask";
    card.className = "cp-ask";
    // Keystrokes in the card must not reach Naukri's own handlers (Enter would send its chat).
    for (const type of ["keydown", "keyup", "keypress"]) card.addEventListener(type, (event) => event.stopPropagation());
    const anchor = panel.querySelector(".cp-tab-bar");
    if (anchor) anchor.parentNode.insertBefore(card, anchor);
    else panel.appendChild(card);
  }
  naukriTab = "feed";
  const kind = { radio: "Pick one", select: "Pick one", checkbox: "Pick one or more", text: "Text" }[question.type] || "Text";
  const picked = new Set();

  return new Promise((resolve) => {
    let done = false;
    let busy = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearInterval(watch);
      card.hidden = true;
      card.innerHTML = "";
      resolve(result);
    };
    const show = (error = "") => {
      const options = readNaukriQuestion(naukriChatbot() || document).options.map((o) => o.text);
      const choices = question.type === "text" ? [] : options;
      const chipStyle = (c) => (picked.has(c) ? ' style="outline:2px solid #6047f5;outline-offset:1px"' : "");
      card.innerHTML = `
        <div class="cp-ask-head"><span class="cp-ask-count">Recruiter question</span><span class="cp-ask-kind">${naukriEscape(kind)}</span></div>
        <div class="cp-ask-label">${naukriEscape(question.text)}</div>
        <div class="cp-ask-hint">Your answer is sent in the Naukri chat and saved to your answer bank, so next time it's automatic.</div>
        ${error ? `<div class="cp-ask-error">${naukriEscape(error)}</div>` : ""}
        ${choices.length ? `<div class="cp-ask-chips">${choices.map((c) => `<button type="button" class="cp-ask-chip" data-value="${naukriEscape(c)}"${chipStyle(c)}>${naukriEscape(c)}</button>`).join("")}</div>` : ""}
        ${question.type === "text" ? `<div class="cp-ask-row"><input id="cp-ask-input" type="text" autocomplete="off" value="${naukriEscape(suggestion || "")}" /><button type="button" id="cp-ask-submit" class="cp-ask-submit">Answer</button></div>` : ""}
        ${question.type === "checkbox" ? `<div class="cp-ask-row"><button type="button" id="cp-ask-submit" class="cp-ask-submit">Answer</button></div>` : ""}
        <div class="cp-ask-hint">Or answer in the Naukri chat yourself. Waiting up to 3 minutes.</div>`;
      card.hidden = false;
      const input = card.querySelector("#cp-ask-input");
      input?.focus();
      input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void submit(input.value);
        }
      });
      card.querySelector("#cp-ask-submit")?.addEventListener("click", () => void submit(question.type === "checkbox" ? [...picked].join(", ") : input?.value || ""));
      for (const chip of card.querySelectorAll(".cp-ask-chip")) {
        chip.addEventListener("click", () => {
          const value = chip.getAttribute("data-value") || "";
          if (question.type === "checkbox") {
            if (picked.has(value)) picked.delete(value);
            else picked.add(value);
            show();
          } else void submit(value);
        });
      }
    };
    const submit = async (value) => {
      const answer = naukriClean(value);
      if (done || busy) return;
      if (!answer) return show("Type or pick an answer first.");
      const root = naukriChatbot();
      const live = root ? readNaukriQuestion(root) : null;
      if (!live || live.text !== question.text) return; // already moved on (answered in the chat)
      busy = true;
      const entered = await fillNaukriAnswer(live, answer, { allowSkip: true });
      if (!entered) {
        busy = false;
        return show(`"${answer}" doesn't fit this question. Pick one of the options.`);
      }
      addNaukriFeed(ICONS.check, `You answered: ${naukriEscape(entered)} (saved to your answer bank)`);
      saveNaukriAnswer(question, entered);
      await naukriSleep(300);
      await sendNaukriAnswer(root, live);
      const moved = await naukriQuestionChanged(live, 15000);
      busy = false;
      if (moved) finish(moved);
      else show("Naukri didn't take that answer. Try again, or answer in the Naukri chat.");
    };
    // Answered in the Naukri chat instead: save what was sent and carry on.
    const deadline = Date.now() + 180000;
    const watch = setInterval(() => {
      if (done || busy) return;
      if (isNaukriApplyConfirmationPage()) return finish("confirmation");
      const root = naukriChatbot();
      if (!root) return;
      const now = readNaukriQuestion(root);
      const turn = naukriChatTurn(root);
      if ((now.count !== question.count || now.text !== question.text || turn === "done") && turn !== "thinking") {
        const reply = naukriLastUserReply();
        if (reply) {
          saveNaukriAnswer(question, reply);
          addNaukriFeed(ICONS.check, `You answered in the chat: ${naukriEscape(reply)} (saved to your answer bank)`);
        }
        finish(NAUKRI_DONE_TEXT.test(root.innerText || "") ? "done" : "next");
      } else if (Date.now() > deadline) finish(null);
    }, 700);
    show();
  });
}

/**
 * Answer every recruiter question: answer bank / AI first; when that doesn't fit, ask in the sidebar.
 * Returns "confirmation" | "closed" | "done" | "manual-timeout".
 */
async function answerNaukriChatbot() {
  const until = Date.now() + 8 * 60000;
  while (Date.now() < until) {
    if (isNaukriApplyConfirmationPage()) return "confirmation";
    const root = await naukriChatbotSettled();
    if (!root) return isNaukriApplyConfirmationPage() ? "confirmation" : "closed";
    keepNaukriOverlaysVisible();
    // Only on Naukri's turn to ask, with the question and its controls fully drawn (not while it is
    // processing the last answer, when Save briefly looks enabled).
    const turn = await naukriWaitForQuestion();
    if (turn === "done" || turn === "confirmation") return turn;
    if (!turn) {
      if (!naukriChatbot()) continue; // re-drawn / closed: the settled check above decides
      if (naukriChatTurn(naukriChatbot()) !== "asking") continue;
    }
    const question = readNaukriQuestion(naukriChatbot() || root);
    if (!question.type || !question.text) {
      await naukriSleep(500);
      continue;
    }

    addNaukriFeed(ICONS.edit, `Recruiter asks: <strong>${naukriEscape(question.text)}</strong>`);
    const reading = naukriRandom(NAUKRI_READ_QUESTION_MS);
    setNaukriWait("Reading the question", reading);
    const [answer] = await Promise.all([askNaukriAnswer(question.text, question.type, question.options.map((o) => o.text).filter((t) => !NAUKRI_SKIP_OPTION.test(naukriClean(t)))), naukriSleep(reading)]);
    const entered = answer ? await fillNaukriAnswer(question, answer) : "";
    let moved = null;
    if (entered) {
      addNaukriFeed(ICONS.check, `Answered: ${naukriEscape(entered)}`);
      await naukriSleep(naukriRandom(NAUKRI_BEFORE_SAVE_MS));
      await sendNaukriAnswer(root, question);
      moved = await naukriQuestionChanged(question, 15000);
    }
    if (!moved) {
      addNaukriFeed(
        ICONS.alert,
        `Your answer is needed: "<strong>${naukriEscape(question.text)}</strong>"${answer ? ` (suggested: ${naukriEscape(answer)})` : ""}. Answer it in the card above (or in the Naukri chat).`
      );
      setNaukriStatus("Your answer needed");
      setNaukriWait("Waiting for your answer", 180000);
      moved = await askNaukriInSidebar(question, answer);
      if (!moved) return "manual-timeout";
    }
    if (moved !== "next") return moved;
  }
  return "manual-timeout";
}

// ------------------------------------------------------------------ run: one job (on the job page)
function naukriApplyControls() {
  const apply = document.querySelector("#apply-button");
  return {
    apply: apply && /^apply$/i.test(naukriClean(apply.textContent)) && !apply.disabled ? apply : null,
    applyText: naukriClean(apply?.textContent),
    companySite: document.querySelector("#company-site-button"),
    alreadyApplied: document.querySelector("#already-applied") || (apply && /applied/i.test(naukriClean(apply.textContent)) ? apply : null),
    chatbot: naukriChatbot(),
  };
}

/**
 * Press a button like a mouse does: hover, press, release, click, at the button's centre. Naukri's Apply
 * button ignores a bare element.click(); the full pointer + mouse sequence is what a real click sends.
 */
function naukriPress(el) {
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

async function applyOnNaukriJobPage(run) {
  const job = run.queue[run.index];
  run.phase = "applying";
  saveNaukriRun(run);
  addNaukriFeed(ICONS.target, `Opened <strong>${naukriEscape(job.title || "job")}</strong>${job.company ? ` at ${naukriEscape(job.company)}` : ""}.`);

  // The job page (and its Apply / company-site / Applied button) can take a while on a slow connection.
  setNaukriStatus("Loading job…");
  const ready = await naukriWhenReady(() => {
    const c = naukriApplyControls();
    return c.apply || c.companySite || c.alreadyApplied ? c : null;
  }, { baseMs: 20000, maxMs: 120000, expectedMs: 3000 });
  if (!ready.ok && ready.problem !== "timeout" && handleNaukriProblem(run, ready.problem)) return;
  const found = ready.ok ? ready.value : null;
  if (!found) return finishNaukriJob(run, job, "failed", "The job page didn't show an Apply button, even after waiting for it to load.");
  if (found.alreadyApplied) return finishNaukriJob(run, job, "skipped", "Already applied.");
  if (!found.apply && found.companySite) return finishNaukriJob(run, job, "skipped", "Applies on the company site.");

  // The live Apply button, once it can really be clicked: visible, enabled, still, not covered.
  const located = await naukriLocate(() => naukriApplyControls().apply, { baseMs: 8000, maxMs: 30000 });
  if (!located.ok) {
    if (located.problem !== "timeout" && handleNaukriProblem(run, located.problem)) return;
    return finishNaukriJob(run, job, "failed", "The Apply button never became clickable.");
  }
  let applyButton = located.value;

  // "Read" the job like a person: ring the Apply button and pause a moment.
  applyButton.style.outline = "3px solid #6047f5";
  applyButton.style.outlineOffset = "3px";
  setNaukriStatus("Reading job…");
  const reading = naukriRandom(NAUKRI_READ_JOB_MS);
  setNaukriWait("Reading the job", reading);
  await naukriSleep(reading);
  applyButton.style.outline = "";
  // Free applications first, then 1 Hire per application (charged by the portal only when Naukri confirms).
  if (!(await naukriHasHires())) {
    stopNaukriRun(NAUKRI_OUT_OF_HIRES_HTML);
    return;
  }
  // The page may have re-rendered while we read: use the current, clickable button.
  if (!naukriActionable(applyButton)) {
    const again = await naukriLocate(() => naukriApplyControls().apply, { baseMs: 5000, maxMs: 20000 });
    if (!again.ok) return finishNaukriJob(run, job, "failed", "The Apply button disappeared before it could be clicked.");
    applyButton = again.value;
  }

  // Click exactly #apply-button (never its container: Save sits next to it), the way a mouse does.
  naukriLastApplyMessage = null;
  const clickedAt = Date.now();
  naukriPress(applyButton);
  addNaukriFeed(ICONS.bolt, "Clicked <strong>Apply</strong>, waiting for Naukri…");

  // Did Naukri react? Its apply request starting, the chatbot, or the confirmation page. On a slow connection
  // that can take a while; only when nothing at all happened is Apply pressed once more.
  const reacted = () =>
    isNaukriApplyConfirmationPage() || naukriChatbot() || naukriNet().applyStartedAt >= clickedAt || (naukriLastApplyMessage && naukriLastApplyMessage.at >= clickedAt);
  if (!(await naukriWaitWhileBusy(reacted, { baseMs: 6000, maxMs: 30000 }))) {
    const again = naukriApplyControls().apply;
    if (again && naukriActionable(again) && !naukriLeaving) {
      addNaukriFeed(ICONS.bolt, "Naukri didn't react to the click, pressing Apply once more…");
      naukriPress(again);
    }
  }

  // Usually Apply loads Naukri's confirmation page (/myapply/saveApply...), which ends this page; the
  // run tick reads the result there. The checks below cover answers shown on the job page itself.
  const outcome = await naukriWaitWhileBusy(() => {
    if (isNaukriApplyConfirmationPage()) return { kind: "confirmation-page" };
    const message = naukriLastApplyMessage && naukriLastApplyMessage.at >= clickedAt ? naukriLastApplyMessage : null;
    if (message) {
      const quota = message.customErrorCode === 403009 || /quota/i.test(message.message);
      if (quota) return { kind: "quota" };
      const mine = message.jobs.find((j) => j.jobId === job.jobId) || message.jobs[0];
      if (mine?.questions) return { kind: "questions" };
      if (message.httpStatus >= 400) return { kind: "failed", detail: `Naukri answered ${message.httpStatus}${naukriClean(mine?.message || message.message) ? `: "${naukriClean(mine?.message || message.message).slice(0, 200)}"` : ""}.` };
    }
    if (naukriChatbot()) return { kind: "questions" };
    const proof = naukriAppliedProof(job, clickedAt);
    return proof ? { kind: "applied", proof } : null;
  }, { baseMs: 25000, maxMs: 120000, expectedMs: 4000 });

  if (outcome?.kind === "confirmation-page") return; // the tick handles the confirmation page
  if (outcome?.kind === "quota") {
    stopNaukriRun("Naukri says today's application quota is used up. Stopped; try again tomorrow.");
    return;
  }
  if (outcome?.kind === "questions") {
    addNaukriFeed(ICONS.sparkle, "The recruiter has questions: answering from your answer bank…");
    const chat = await answerNaukriChatbot();
    if (chat === "confirmation") return; // the tick reads the confirmation page
    if (chat === "manual-timeout") return finishNaukriJob(run, job, "failed", "A recruiter question waited 3 minutes without an answer.");
    // "Thank you for your responses" is not the application yet: Naukri submits a few seconds later and
    // then opens its confirmation page. Stay on the job page until Naukri itself confirms.
    const confirmMs = naukriTimeout(45000, 150000);
    addNaukriFeed(ICONS.clock, "All questions answered, waiting for Naukri to confirm…");
    setNaukriWait("Waiting for Naukri to confirm (at most)", confirmMs);
    const proof = await naukriWaitWhileBusy(() => naukriAppliedProof(job, clickedAt), { baseMs: 45000, maxMs: 150000, everyMs: 500, expectedMs: 4000 });
    if (proof === "confirmation-page") return; // the tick reads the confirmation page
    if (proof) {
      // Let Naukri finish and open its own confirmation page rather than leaving under it.
      const page = await naukriWaitWhileBusy(() => (isNaukriApplyConfirmationPage() ? "confirmation-page" : null), { baseMs: 8000, maxMs: 30000 });
      if (page) return;
      return finishNaukriApplied(run, job, proof);
    }
    const said = naukriSaidAbout(loadNaukriRun(), job);
    return finishNaukriJob(run, job, "failed", `Answered the questions, but Naukri did not confirm within ${Math.round(confirmMs / 1000)} s${said ? `. Naukri says: "${said}"` : ""}. Open the job to check whether it went through.`);
  }
  if (outcome?.kind === "applied") {
    // Naukri usually still opens its confirmation page after its apply call: give it the chance.
    const page = await naukriWaitWhileBusy(() => (isNaukriApplyConfirmationPage() ? "confirmation-page" : null), { baseMs: 8000, maxMs: 30000 });
    if (page) return;
    return finishNaukriApplied(run, job, outcome.proof);
  }
  if (!outcome && naukriPageProblem() && handleNaukriProblem(run, naukriPageProblem())) return;
  const said = naukriSaidAbout(loadNaukriRun(), job);
  return finishNaukriJob(run, job, "failed", outcome?.detail || `No answer from Naukri after clicking Apply, even after waiting${said ? `. Naukri says: "${said}"` : ""}. Open the job to check.`);
}

/**
 * Naukri's own proof that this job was applied, or null. Text on the page ("thank you for your
 * responses", "successfully apply") never counts: only Naukri's confirmation page, its apply call
 * answering 200 for this job, or the job switching to "Applied".
 */
function naukriAppliedProof(job, since) {
  if (isNaukriApplyConfirmationPage()) return "confirmation-page";
  const message = naukriLastApplyMessage && naukriLastApplyMessage.at >= since ? naukriLastApplyMessage : null;
  const mine = message && (message.jobs.find((j) => j.jobId === job.jobId) || message.jobs[0]);
  if (mine && Number(mine.status) === 200 && !mine.questions) return "api";
  const button = document.querySelector("#apply-button");
  if (document.querySelector("#already-applied") || (button && /^applied$/i.test(naukriClean(button.textContent)))) return "marked-applied";
  return null;
}

/**
 * What Naukri said about this job when it didn't apply: the message on its apply call (kept in the run),
 * else the visible message on the current page (error box / headline), never our own sidebar.
 */
function naukriSaidAbout(run, job) {
  if (run?.naukriSaid?.jobId === job.jobId && run.naukriSaid.text) return run.naukriSaid.text;
  const candidates = Array.from(document.querySelectorAll("[class*='error' i], [class*='msg' i], [class*='message' i], [class*='alert' i], [role='alert'], .header-content, h1, h2, h3"))
    .filter((el) => !el.closest(`#${PANEL_ID}`) && !el.closest(".cp-naukri-flag"))
    .map((el) => naukriClean(el.innerText || el.textContent))
    .filter((text) => text.length > 3 && text.length < 300);
  const text = candidates.find((t) => /error|not|unable|already|limit|quota|sorry|fail|could|expired|closed|invalid/i.test(t)) || candidates[0] || "";
  return text.slice(0, 200);
}

function finishNaukriApplied(run, job, proof) {
  countNaukriAppliedToday();
  const how = { api: "Naukri's apply call answered 200", "marked-applied": "the job now shows Applied" }[proof] || "Naukri confirmed it";
  return finishNaukriJob(run, job, "applied", `Applied: ${how}.`);
}

function finishNaukriJob(run, job, outcome, detail) {
  recordNaukriResult(run, job, outcome, detail);
  const icon = { applied: ICONS.check, skipped: ICONS.skip, failed: ICONS.alert }[outcome] || ICONS.sparkle;
  const label = { applied: "Applied", skipped: "Skipped", failed: "Failed" }[outcome] || outcome;
  addNaukriFeed(icon, `<strong>${label}:</strong> ${naukriEscape(job.title || "job")}. ${naukriEscape(detail)}`);
  const latest = loadNaukriRun();
  if (latest?.status !== "running" || !latest.returnUrl) return;
  // On Naukri's confirmation page, stay a few seconds (like a person reading it) before going back.
  if (isNaukriApplyConfirmationPage()) {
    naukriLeaving = true; // no more ticks on this page
    setNaukriStatus(outcome === "applied" ? "Applied" : label);
    const stay = naukriRandom(NAUKRI_CONFIRMATION_WAIT_MS);
    setNaukriWait("Staying on Naukri's confirmation page", stay, `Staying ${Math.round(stay / 1000)} s on Naukri's confirmation page.`);
    logNaukriNextPause();
    setTimeout(() => {
      if (loadNaukriRun()?.status === "running") location.href = latest.returnUrl;
      else naukriLeaving = false; // paused / stopped while waiting: stay here
    }, stay);
    return;
  }
  logNaukriNextPause();
  naukriGoTo(latest.returnUrl);
}

/**
 * The wait the run is in right now ("Reading the job", "Staying on Naukri's confirmation page", ...),
 * shown as a live countdown at the top of Activity. `logLine` also adds it to the log once.
 */
function setNaukriWait(label, ms, logLine) {
  const run = loadNaukriRun();
  if (!run) return;
  run.wait = { label, until: Date.now() + ms };
  saveNaukriRun(run);
  if (logLine) addNaukriFeed(ICONS.clock, naukriEscape(logLine));
  else renderNaukriPanel();
}

/** Log the human-pace pause before the next job / page (the countdown itself shows on the results page). */
function logNaukriNextPause() {
  const run = loadNaukriRun();
  if (!run || run.status !== "running") return;
  const seconds = Math.max(0, Math.round((run.nextAt - Date.now()) / 1000));
  const what = run.index >= run.queue.length ? "the next page" : "the next job";
  addNaukriFeed(ICONS.clock, `Waiting ${seconds} s before ${what} (human pace).`);
}

/**
 * Navigate for the run. If the page change doesn't happen (this script is still alive afterwards), try
 * again, then reload: a page that loads replaces this script, so the timers never fire then.
 */
function naukriGoTo(url) {
  naukriLeaving = true;
  location.href = url;
  setTimeout(() => {
    location.assign(url);
    setTimeout(() => location.reload(), naukriTimeout(30000, 90000));
  }, naukriTimeout(30000, 90000));
}

// ------------------------------------------------------------------ run: tick (every second)
async function naukriRunTick() {
  const run = loadNaukriRun();
  if (!run || run.status !== "running" || naukriBusy || naukriLeaving) return;

  // Offline: hold everything (countdowns resume when the connection is back). Other page problems
  // (logged out, captcha, Naukri error page, expired job) are handled before anything else.
  const problem = naukriPageProblem();
  if (problem === "offline") {
    setNaukriStatus("Offline…");
    setNaukriWait("Waiting for the internet connection", 60000);
    return;
  }
  if (problem && !(isNaukriJobPage() && run.phase === "applying") && handleNaukriProblem(run, problem)) return;

  // Naukri's confirmation page after a click on Apply: the result is in the URL. Let it finish loading.
  if (isNaukriApplyConfirmationPage() && document.readyState !== "complete") {
    naukriBusy = true;
    try {
      await naukriWaitWhileBusy(() => document.readyState === "complete", { baseMs: 5000, maxMs: 30000, busy: () => true });
    } finally {
      naukriBusy = false;
    }
  }
  if (isNaukriApplyConfirmationPage()) {
    const job = run.queue[run.index];
    if (!job || run.phase !== "applying") {
      // Result already recorded on the job page: still stay a moment on the confirmation page.
      if (run.returnUrl) {
        naukriLeaving = true;
        setNaukriStatus("Applied");
        setTimeout(() => {
          if (loadNaukriRun()?.status === "running") location.href = run.returnUrl;
          else naukriLeaving = false;
        }, naukriRandom(NAUKRI_CONFIRMATION_WAIT_MS));
      }
      return;
    }
    const { jobIds, statuses } = readNaukriApplyConfirmation();
    const status = Number(statuses[job.jobId] ?? (jobIds.includes(job.jobId) ? statuses[jobIds[0]] : NaN));
    if (status === 200) {
      countNaukriAppliedToday();
      finishNaukriJob(run, job, "applied", "Applied: Naukri's confirmation page answered 200.");
    } else if (status === 403009 || /quota/i.test(document.body?.innerText || "")) {
      stopNaukriRun("Naukri says today's application quota is used up. Stopped; try again tomorrow.");
    } else if (Number.isFinite(status)) {
      const said = naukriSaidAbout(run, job);
      finishNaukriJob(run, job, "failed", `Naukri answered ${status} instead of 200 (applied)${said ? `: "${said}"` : ""}.`);
    } else {
      finishNaukriJob(run, job, "failed", "Naukri's confirmation page did not include this job. Open the job to check.");
    }
    return;
  }

  if (isNaukriJobPage()) {
    const job = run.queue[run.index];
    // Queue finished while on a job page: go back to the results, the summary is shown there.
    if (!job) {
      naukriGoTo(run.returnUrl);
      return;
    }
    if (naukriJobIdFromUrl(location.href) !== job.jobId) {
      pauseNaukriRun("You opened another page during the run, so it paused. Press Resume to go back to the search results.");
      return;
    }
    // "applying" left over from before a reload: Apply may already have been clicked, so never click
    // again; record it for a manual check and move on.
    if (run.phase === "applying") {
      finishNaukriJob(run, job, "failed", "The page reloaded while applying. Open the job to check whether it went through.");
      return;
    }
    naukriBusy = true;
    try {
      await applyOnNaukriJobPage(run);
    } finally {
      naukriBusy = false;
    }
    return;
  }

  if (!isNaukriJobsListPage()) return;

  // A new results page (next page / next job title): queue the jobs that fit the user's filters.
  if (run.needsQueue) {
    naukriBusy = true;
    try {
      await queueNaukriPage(run);
    } finally {
      naukriBusy = false;
    }
    return;
  }

  // Back from a job: show its card with the result once, before counting down to the next one.
  const last = run.results[run.results.length - 1];
  if (last && run.shownResult !== run.results.length) {
    run.shownResult = run.results.length;
    saveNaukriRun(run);
    const kind = last.outcome === "applied" ? "applied" : "done";
    const label = { applied: "Applied", skipped: "Skipped", failed: "Failed" }[last.outcome] || last.outcome;
    naukriBusy = true;
    try {
      flagNaukriCards();
      const card = spotlightNaukriCard(last.jobId, kind, label);
      await naukriSleep(2500);
      clearNaukriSpotlight(card);
    } finally {
      naukriBusy = false;
    }
    return;
  }

  const wait = run.nextAt - Date.now();
  if (run.index >= run.queue.length) {
    // This page is done: after the usual pause, the next page / next job title.
    setNaukriStatus(wait > 0 ? `Next page in ${Math.ceil(wait / 1000)}s` : "Next page…");
    if (wait <= 0) advanceNaukriSearch(run);
    return;
  }
  setNaukriStatus(wait > 0 ? `Next in ${Math.ceil(wait / 1000)}s` : "Opening…");
  if (wait > 0) return;

  // Go to the next card first, ring it, then open it.
  const next = run.queue[run.index];
  naukriBusy = true;
  try {
    spotlightNaukriCard(next.jobId, "next", `Opening next: ${next.title || "job"}`);
    setNaukriStatus("Opening…");
    setNaukriWait(`Opening ${next.title || "the next job"}`, NAUKRI_FOCUS_CARD_MS);
    await naukriSleep(NAUKRI_FOCUS_CARD_MS);
  } finally {
    naukriBusy = false;
  }
  const latest = loadNaukriRun();
  if (latest?.status !== "running") return; // paused / stopped while the card was shown
  latest.phase = "opening";
  saveNaukriRun(latest);
  naukriGoTo(next.url);
}

// ------------------------------------------------------------------ panel
function setNaukriStatus(text) {
  const badge = naukriPanel?.querySelector("#cp-status-badge");
  if (badge && badge.textContent !== text) badge.textContent = text;
}

const NAUKRI_RESULT_TAGS = { applied: "Applied", skipped: "Skipped", failed: "Failed" };

function naukriJobCardHtml(job, result) {
  const title = job.url
    ? `<a href="${naukriEscape(job.url)}" target="_blank" rel="noopener noreferrer">${naukriEscape(job.title || "Naukri job")}</a>`
    : naukriEscape(job.title || "Naukri job");
  const sub = [job.company, job.experience, job.location].filter(Boolean).map(naukriEscape).join(" · ");
  const good = result ? result.outcome === "applied" : job.applied;
  const tagText = result
    ? NAUKRI_RESULT_TAGS[result.outcome]
    : job.applied
      ? ""
      : { easy: "Easy Apply", "easy-questions": "Easy Apply · Questions", company: "Company site", unknown: "Type unknown" }[job.type];
  const tag = tagText ? `<span class="cp-job-tag">${tagText}</span>` : "";
  const note = result?.detail
    ? `<div class="cp-job-reason">${naukriEscape(result.detail)}</div>`
    : job.type === "company" && job.redirectHost
      ? `<div class="cp-job-reason">Applies on ${naukriEscape(job.redirectHost)}</div>`
      : "";
  const icon = good ? ICONS.check : job.type === "company" || result ? ICONS.skip : ICONS.target;
  return `<div class="cp-job-card ${good ? "cp-job-applied" : "cp-job-skipped"}"><span class="cp-job-icon">${icon}</span><div class="cp-job-main"><div class="cp-job-title">${title}${tag}</div><div class="cp-job-sub">${sub}</div>${job.posted ? `<div class="cp-job-sub">${naukriEscape(job.posted)}</div>` : ""}${note}</div></div>`;
}

function renderNaukriPanel() {
  if (!naukriPanel) return;
  const run = loadNaukriRun();
  if (isNaukriJobsListPage() && !naukriJobs.length) naukriJobs = readNaukriPageJobs();
  const results = run?.results || [];
  const appliedInRun = new Set(results.filter((r) => r.outcome === "applied").map((r) => r.jobId));
  const open = naukriJobs.filter((job) => !job.applied && !appliedInRun.has(job.jobId));
  const easyJobs = open.filter((job) => job.type !== "company");
  const companyJobs = open.filter((job) => job.type === "company");

  const counts = { jobs: easyJobs.length, company: companyJobs.length, results: results.length };
  for (const [tab, count] of Object.entries(counts)) {
    const badge = naukriPanel.querySelector(`#cp-count-${tab}`);
    if (badge) {
      badge.textContent = String(count);
      badge.hidden = !count;
    }
  }
  for (const tab of ["jobs", "company", "results", "feed"]) {
    naukriPanel.querySelector(`#cp-tab-${tab}`)?.classList.toggle("cp-active", naukriTab === tab);
  }

  // Controls: Start / Resume, Pause, Stop.
  const active = run?.status === "running" || run?.status === "paused";
  const startLabel = naukriPanel.querySelector("#cp-start span");
  if (startLabel) startLabel.textContent = run?.status === "paused" ? "Resume" : run?.status === "running" ? "Running…" : "Start";
  naukriPanel.querySelector("#cp-start").disabled = run?.status === "running";
  naukriPanel.querySelector("#cp-pause").disabled = run?.status !== "running";
  naukriPanel.querySelector("#cp-stop").disabled = !active;
  const filters = naukriPanel.querySelector("#cp-naukri-filters");
  if (filters && naukriUserSettings) {
    const text = `Your dashboard filters: ${naukriFiltersSummary(naukriUserSettings)}`;
    if (filters.textContent !== text) filters.textContent = text;
  }
  const today = naukriPanel.querySelector("#cp-today-text");
  const todayText = `Today: ${naukriAppliedToday()} applied · ${naukriHiresLabel()}`;
  if (today && today.textContent !== todayText) today.textContent = todayText;
  if (!active) setNaukriStatus(run?.status === "done" ? "Done" : run?.status === "stopped" ? "Stopped" : "Idle");
  else if (run.status === "paused") setNaukriStatus("Paused");
  else if (isNaukriJobPage()) setNaukriStatus("Applying…");

  const log = naukriPanel.querySelector("#cp-log");
  if (!log) return;
  const empty = (icon, text) => `<div class="cp-empty-state"><span>${icon}</span><span>${text}</span></div>`;
  let html;
  if (naukriTab === "jobs") {
    html = easyJobs.length ? easyJobs.map((job) => naukriJobCardHtml(job)).join("") : empty(ICONS.search, "No Easy Apply jobs on this page yet. Open a Naukri search results page.");
  } else if (naukriTab === "company") {
    html = companyJobs.length ? companyJobs.map((job) => naukriJobCardHtml(job)).join("") : empty(ICONS.skip, "No company-site jobs on this page.");
  } else if (naukriTab === "results") {
    html = results.length ? [...results].reverse().map((r) => naukriJobCardHtml(r, r)).join("") : empty(ICONS.check, "Results of the current run show here.");
  } else {
    const feed = run?.feed || [];
    html = feed.length
      ? [...feed]
          .reverse()
          .map((item) => `<div class="cp-ai-card"><span class="cp-ai-icon">${item.icon}</span><span class="cp-ai-text">${item.html}</span><span class="cp-ai-time">${naukriEscape(item.time)}</span></div>`)
          .join("")
      : empty(ICONS.sparkle, "Naukri Copilot is standing by. Press <strong>Start</strong> to apply to the Easy Apply jobs on this page.");
  }

  // Live countdown of the current wait in its own bar: only its text changes each second, so the list
  // below is not rebuilt (rebuilding it replays every card's fade-in and makes the log blink).
  const waitBar = naukriPanel.querySelector("#cp-naukri-wait");
  if (waitBar) {
    const now = Date.now();
    let wait = null;
    if (run?.status === "running") {
      if (run.wait && run.wait.until > now) wait = run.wait;
      else if (isNaukriJobsListPage() && !run.needsQueue && run.nextAt > now) wait = { label: run.index >= run.queue.length ? "Next page in" : "Next job in", until: run.nextAt };
    }
    const text = wait ? `${wait.label}: ${Math.ceil((wait.until - now) / 1000)}s` : "";
    const label = waitBar.querySelector(".cp-naukri-wait-text");
    if (label && label.textContent !== text) label.textContent = text;
    // style.display, not the hidden attribute: the bar's inline display:flex would override [hidden].
    waitBar.style.display = text ? "flex" : "none";
  }
  if (log.dataset.html !== html) {
    log.innerHTML = html;
    log.dataset.html = html;
  }
}

function syncNaukriPageShift() {
  if (!document.body) return;
  const docked = naukriPanel && !naukriPanel.classList.contains("cp-sidebar-collapsed");
  document.documentElement.style.setProperty("--cp-sidebar-width", `${NAUKRI_PANEL_WIDTH}px`);
  document.body.style.marginRight = docked ? `${NAUKRI_PANEL_WIDTH}px` : "";
  document.body.classList.toggle("cp-has-docked-sidebar", Boolean(docked));
}

function mountNaukriPanel() {
  if (document.getElementById(PANEL_ID)) return;
  const prefs = naukriRead(localStorage, NAUKRI_PREFS_KEY, { collapsed: false });

  const toggle = document.createElement("button");
  toggle.id = TOGGLE_ID;
  toggle.title = "AutoApply CV Copilot";
  toggle.setAttribute("aria-label", "AutoApply CV Copilot");
  toggle.innerHTML = `<img src="${naukriAssetUrl("icons/icon32.png")}" alt="" width="26" height="26" style="display:block;margin:0 auto;border-radius:10px" /><span style="font-weight:700">Copilot</span>`;
  toggle.addEventListener("click", () => {
    naukriPanel?.classList.toggle("cp-sidebar-collapsed");
    naukriWrite(localStorage, NAUKRI_PREFS_KEY, { collapsed: naukriPanel?.classList.contains("cp-sidebar-collapsed") });
    syncNaukriPageShift();
  });
  (document.body || document.documentElement).appendChild(toggle);

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="cp-head">
      <div class="cp-brand">
        <div class="cp-orb"><img class="cp-orb-img" alt="" src="${naukriAssetUrl("icons/icon48.png")}" /></div>
        <div>
          <div class="cp-title">AutoApply CV <span class="cp-ai-sparkle">${ICONS.sparkle}</span></div>
          <div class="cp-sub">Naukri Copilot · Beta</div>
        </div>
      </div>
      <div class="cp-head-right">
        <div class="cp-badge" id="cp-status-badge">Idle</div>
        <div class="cp-window-actions">
          <button id="cp-clear-logs" class="cp-icon-btn" title="Clear results">${ICONS.trash}</button>
        </div>
      </div>
    </div>
    <div class="cp-controls">
      <div class="cp-run-mode">
        <div class="cp-metric-pill cp-metric-quota" title="Free applications first, then 1 Hire per application, charged only when Naukri confirms it"><span class="cp-svg-icon cp-icon-primary">${ICONS.coin}</span><span id="cp-today-text">Today: 0 applied</span></div>
        <span class="cp-run-mode-chip" title="Start applies for real: on Naukri, Apply sends the application at once">Live</span>
      </div>
      <div id="cp-naukri-filters" title="Synced from your AutoApply CV dashboard: target job titles, skills and keywords, exclude words, experience" style="font-size:11px;color:#6b7280;margin:-2px 0 6px">Your dashboard filters: loading…</div>
      <div class="cp-quick">
        <button id="cp-start" class="cp-btn-start">${ICONS.play} <span>Start</span></button>
        <button id="cp-pause" class="cp-btn-pause">${ICONS.pause} <span>Pause</span></button>
        <button id="cp-stop" class="cp-btn-stop">${ICONS.stop} <span>Stop</span></button>
      </div>
    </div>
    <div class="cp-tab-bar">
      <button id="cp-tab-jobs" class="cp-tab"><span>Easy Apply</span><b class="cp-tab-count" id="cp-count-jobs" hidden>0</b></button>
      <button id="cp-tab-company" class="cp-tab" title="Apply on company site: skipped"><span>Company</span><b class="cp-tab-count" id="cp-count-company" hidden>0</b></button>
      <button id="cp-tab-results" class="cp-tab"><span>Results</span><b class="cp-tab-count" id="cp-count-results" hidden>0</b></button>
      <button id="cp-tab-feed" class="cp-tab cp-active"><span>Activity</span></button>
    </div>
    <div id="cp-naukri-wait" style="display:none;margin:0 12px 8px;padding:7px 12px;border:1px solid #d4ccff;border-radius:10px;background:#f4f2ff;color:#4f38e0;font:600 12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;align-items:center;gap:8px"><span style="display:inline-flex">${ICONS.clock}</span><span class="cp-naukri-wait-text"></span></div>
    <div class="cp-log" id="cp-log" aria-live="polite"></div>
  `;
  panel.style.top = "0";
  panel.style.right = "0";
  panel.style.bottom = "0";
  panel.style.left = "auto";
  panel.style.width = `${NAUKRI_PANEL_WIDTH}px`;
  panel.style.zIndex = "2147483646";
  if (prefs.collapsed) panel.classList.add("cp-sidebar-collapsed");
  (document.body || document.documentElement).appendChild(panel);
  naukriPanel = panel;

  panel.querySelector("#cp-start").addEventListener("click", () => void startNaukriRun());
  panel.querySelector("#cp-pause").addEventListener("click", () => pauseNaukriRun());
  panel.querySelector("#cp-stop").addEventListener("click", () => stopNaukriRun());
  panel.querySelector("#cp-clear-logs").addEventListener("click", () => {
    const run = loadNaukriRun();
    if (run?.status === "running" || run?.status === "paused") return;
    saveNaukriRun(null);
    renderNaukriPanel();
  });
  for (const tab of ["jobs", "company", "results", "feed"]) {
    panel.querySelector(`#cp-tab-${tab}`).addEventListener("click", () => {
      naukriTab = tab;
      renderNaukriPanel();
    });
  }

  naukriTab = "feed";
  renderNaukriPanel();
  syncNaukriPageShift();
  void loadNaukriUserSettings().then(() => renderNaukriPanel());
  void naukriHasHires().then(() => renderNaukriPanel());
}

function unmountNaukriPanel() {
  for (const flag of document.querySelectorAll(".cp-naukri-flag")) flag.remove();
  document.getElementById(PANEL_ID)?.remove();
  document.getElementById(TOGGLE_ID)?.remove();
  naukriPanel = null;
  naukriJobs = [];
  if (document.body) {
    document.body.style.marginRight = "";
    document.body.classList.remove("cp-has-docked-sidebar");
  }
}

// ------------------------------------------------------------------ init
// Naukri is a single-page app: keep the sidebar in step with the URL, and drive the run every second.
(() => {
  let lastUrl = "";
  // Re-reading every card each second is wasted work while nothing changes: track page changes instead.
  let pageChanged = true;
  let lastPageRead = 0;
  new MutationObserver((records) => {
    if (records.some((r) => !(r.target?.nodeType === 1 && r.target.closest?.(`#${PANEL_ID}, .cp-naukri-flag, .cp-naukri-spot`)))) pageChanged = true;
  }).observe(document.documentElement, { childList: true, subtree: true });
  const sync = () => {
    const run = loadNaukriRun();
    const runActive = run?.status === "running" || run?.status === "paused";
    // The sidebar shows on list pages, and on job / confirmation pages while a run is working on them.
    const wantPanel = isNaukriJobsListPage() || ((isNaukriJobPage() || isNaukriApplyConfirmationPage()) && runActive);
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      naukriJobs = [];
      if (!wantPanel) unmountNaukriPanel();
    }
    if (wantPanel) {
      mountNaukriPanel();
      if (isNaukriJobsListPage() && (pageChanged || Date.now() - lastPageRead > 5000)) {
        pageChanged = false;
        lastPageRead = Date.now();
        flagNaukriCards();
        naukriJobs = readNaukriPageJobs();
      }
      pollNaukriQuota();
      renderNaukriPanel();
    } else if (naukriPanel) {
      unmountNaukriPanel();
    }
    keepNaukriOverlaysVisible();
    void naukriRunTick();
  };
  sync();
  setInterval(sync, 1000);

  // Stuck watchdog (like the LinkedIn module's no-progress recovery): nothing logged for minutes while
  // online means a step hung. Job page: record it for a manual check and go back; results: reload.
  let recovering = false;
  setInterval(() => {
    const run = loadNaukriRun();
    if (recovering || !run || run.status !== "running" || navigator.onLine === false) return;
    const idleMs = Date.now() - Number(run.progressAt || Date.now());
    if (idleMs < naukriTimeout(4 * 60000, 12 * 60000)) return;
    recovering = true;
    const minutes = Math.round(idleMs / 60000);
    const job = run.queue?.[run.index];
    if (isNaukriJobPage() && job) {
      finishNaukriJob(run, job, "failed", `No progress for ${minutes} min on this job. Open it to check whether it went through.`);
    } else if (isNaukriJobsListPage()) {
      addNaukriFeed(ICONS.alert, `No progress for ${minutes} min, reloading the results page…`);
      naukriLeaving = true;
      location.reload();
    } else if (run.returnUrl) {
      addNaukriFeed(ICONS.alert, `No progress for ${minutes} min, going back to the results…`);
      naukriGoTo(run.returnUrl);
    }
  }, 15000);
})();
