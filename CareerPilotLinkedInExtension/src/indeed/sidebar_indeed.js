/*
 * Indeed Jobs copilot - sidebar (preview)
 *
 * The LinkedIn-style docked sidebar on Indeed search pages (in.indeed.com, www.indeed.com, ...). It reuses
 * the LinkedIn panel's ids and panel.css (same look) and the ICONS / PANEL_ID / TOGGLE_ID constants from
 * src/linkedin/jobs/01-config.js, which manifest.json loads first.
 *
 * Preview: "Scan jobs" reads the job cards on the page (title, company, location, posted, Easily apply,
 * already applied) and lists them. It NEVER clicks Apply and never calls Indeed's APIs, so it does not
 * trip Cloudflare. The apply flow comes once a live probe has confirmed the Indeed Apply selectors.
 * (src/indeed/content_indeed.js is the old v0.1 beta script; it is not loaded.)
 */

const INDEED_PREFS_KEY = "cpIndeedPanelPrefs";
const INDEED_PANEL_WIDTH = 410;

let indeedPanel = null;
let indeedJobs = [];
let indeedFeed = [];
let indeedTab = "jobs";
let indeedScanning = false;
let indeedStopRequested = false;

// ------------------------------------------------------------------ page detection
/** Search results: /jobs?q=..., /q-react-developer-jobs.html, /q-react-l-pune-jobs.html. */
function isIndeedJobsListPage() {
  const path = location.pathname.toLowerCase();
  return path === "/jobs" || path === "/jobs/" || /^\/q-[a-z0-9-]+-jobs\.html$/.test(path);
}

/** The search itself, without vjk (clicking a card only changes vjk, which must not reset the panel). */
function indeedSearchKey() {
  const params = new URLSearchParams(location.search);
  return [location.host, location.pathname, params.get("q"), params.get("l"), params.get("start"), params.get("sort")].join("|");
}

// ------------------------------------------------------------------ helpers
function indeedEscape(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const indeedClean = (text) => String(text || "").replace(/\s+/g, " ").trim();
const indeedTime = () => new Date().toTimeString().slice(0, 8);

function indeedAssetUrl(path) {
  try {
    return chrome.runtime.getURL(path);
  } catch {
    return "";
  }
}

function loadIndeedPrefs() {
  try {
    return { collapsed: false, ...JSON.parse(localStorage.getItem(INDEED_PREFS_KEY) || "{}") };
  } catch {
    return { collapsed: false };
  }
}

function saveIndeedPrefs(prefs) {
  try {
    localStorage.setItem(INDEED_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // storage blocked: the panel still works, it just won't remember being collapsed
  }
}

// ------------------------------------------------------------------ job cards
/**
 * Job cards on the page. Known wrapper first (div.job_seen_beacon inside #mosaic-provider-jobcards);
 * otherwise the smallest element holding exactly one job key (data-jk).
 */
function findIndeedCards() {
  const known = Array.from(document.querySelectorAll("#mosaic-provider-jobcards .job_seen_beacon, .jobsearch-ResultsList .job_seen_beacon"));
  if (known.length) return known;
  const cards = new Set();
  for (const link of document.querySelectorAll("a[data-jk]")) {
    let card = link;
    for (let node = link.parentElement; node && node !== document.body; node = node.parentElement) {
      const keys = new Set(Array.from(node.querySelectorAll("a[data-jk]")).map((a) => a.getAttribute("data-jk")));
      if (keys.size > 1) break;
      card = node;
    }
    if (card !== link) cards.add(card);
  }
  return Array.from(cards);
}

/** Leaf elements whose whole text matches the pattern (labels like "Applied" or "Easily apply"). */
function indeedHasLabel(card, pattern) {
  return Array.from(card.querySelectorAll("span, div, p, li")).some((el) => el.children.length === 0 && pattern.test(indeedClean(el.textContent)));
}

function readIndeedCard(card) {
  const text = (selector) => indeedClean(card.querySelector(selector)?.textContent);
  const link = card.querySelector("a.jcs-JobTitle, h2.jobTitle a, a[data-jk]");
  const jobId = link?.getAttribute("data-jk") || card.querySelector("[data-jk]")?.getAttribute("data-jk") || "";
  const url = jobId ? `${location.origin}/viewjob?jk=${encodeURIComponent(jobId)}` : link?.href || "";
  const title = indeedClean(card.querySelector("h2.jobTitle span[title]")?.getAttribute("title") || card.querySelector("h2.jobTitle, .jobTitle")?.textContent || link?.textContent);
  return {
    jobId,
    url,
    title: title.replace(/^new\s+/i, ""),
    company: text("[data-testid='company-name'], .companyName, [class*='companyName']"),
    location: text("[data-testid='text-location'], .companyLocation, [class*='companyLocation']"),
    salary: text("[data-testid='attribute_snippet_testid'][class*='salary'], .salary-snippet-container, [class*='salary-snippet']"),
    posted: text("[data-testid='myJobsStateDate'], span.date, [class*='date']").replace(/^posted\s*/i, ""),
    easyApply: Boolean(card.querySelector(".iaLabel, [data-testid='indeedApply'], .ialbl")) || indeedHasLabel(card, /^easily apply$/i),
    applied: Boolean(card.querySelector(".applied-snippet, [data-testid='applied-snippet']")) || indeedHasLabel(card, /^applied\b/i),
    card,
  };
}

function outlineIndeedCard(card, applied) {
  card.style.outline = `2px solid ${applied ? "#10b981" : "#6366f1"}`;
  card.style.outlineOffset = "2px";
  card.dataset.cpIndeed = applied ? "applied" : "new";
}

function clearIndeedOutlines() {
  for (const card of document.querySelectorAll("[data-cp-indeed]")) {
    card.style.outline = "";
    card.style.outlineOffset = "";
    delete card.dataset.cpIndeed;
  }
}

// ------------------------------------------------------------------ scan (read-only)
async function scanIndeedJobs() {
  if (indeedScanning) return;
  indeedScanning = true;
  indeedStopRequested = false;
  indeedJobs = [];
  clearIndeedOutlines();
  setIndeedStatus("Scanning");
  addIndeedFeed(ICONS.search, "Scanning the job cards on this page…");

  // Load lazily rendered cards: scroll down in steps, then back to the top.
  const startY = window.scrollY;
  for (let i = 0; i < 6 && !indeedStopRequested; i += 1) {
    window.scrollBy(0, Math.round(window.innerHeight * 0.9));
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  window.scrollTo({ top: startY });

  if (!indeedStopRequested) {
    const seen = new Set();
    for (const card of findIndeedCards()) {
      const job = readIndeedCard(card);
      const key = job.jobId || job.url || job.title;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      indeedJobs.push(job);
      outlineIndeedCard(card, job.applied);
    }
    const applied = indeedJobs.filter((job) => job.applied).length;
    const easy = indeedJobs.filter((job) => !job.applied && job.easyApply).length;
    if (indeedJobs.length) {
      addIndeedFeed(
        ICONS.check,
        `Found <strong>${indeedJobs.length}</strong> jobs: ${indeedJobs.length - applied} new (${easy} Easily apply), ${applied} already applied.`,
      );
      addIndeedFeed(ICONS.sparkle, "Preview mode: auto-apply on Indeed is coming soon. Nothing was applied.");
    } else {
      addIndeedFeed(ICONS.alert, "No job cards found on this page. Open an Indeed search results page and scan again.");
    }
    indeedTab = indeedJobs.length ? "jobs" : "feed";
  } else {
    addIndeedFeed(ICONS.stop, "Scan stopped.");
  }
  indeedScanning = false;
  setIndeedStatus(indeedJobs.length ? `${indeedJobs.length} jobs` : "Idle");
  renderIndeedPanel();
}

function stopIndeedScan() {
  indeedStopRequested = true;
  clearIndeedOutlines();
  if (!indeedScanning) {
    indeedJobs = [];
    setIndeedStatus("Idle");
    addIndeedFeed(ICONS.stop, "Cleared the scan results.");
  }
}

// ------------------------------------------------------------------ panel
function addIndeedFeed(icon, html) {
  indeedFeed.push({ icon, html, time: indeedTime() });
  indeedFeed = indeedFeed.slice(-60);
  renderIndeedPanel();
}

function setIndeedStatus(text) {
  const badge = indeedPanel?.querySelector("#cp-status-badge");
  if (badge) badge.textContent = text;
}

function indeedJobCardHtml(job) {
  const title = job.url
    ? `<a href="${indeedEscape(job.url)}" target="_blank" rel="noopener noreferrer">${indeedEscape(job.title || "Indeed job")}</a>`
    : indeedEscape(job.title || "Indeed job");
  const sub = [job.company, job.location, job.salary].filter(Boolean).map(indeedEscape).join(" · ");
  const kind = job.applied ? "cp-job-applied" : "cp-job-skipped";
  const tag = job.applied ? "" : `<span class="cp-job-tag">${job.easyApply ? "Easily apply" : "Company site"}</span>`;
  return `<div class="cp-job-card ${kind}"><span class="cp-job-icon">${job.applied ? ICONS.check : ICONS.target}</span><div class="cp-job-main"><div class="cp-job-title">${title}${tag}</div><div class="cp-job-sub">${sub}</div>${job.posted ? `<div class="cp-job-sub">${indeedEscape(job.posted)}</div>` : ""}</div></div>`;
}

function renderIndeedPanel() {
  if (!indeedPanel) return;
  const newJobs = indeedJobs.filter((job) => !job.applied);
  const appliedJobs = indeedJobs.filter((job) => job.applied);
  const counts = { jobs: newJobs.length, applied: appliedJobs.length };
  for (const [tab, count] of Object.entries(counts)) {
    const badge = indeedPanel.querySelector(`#cp-count-${tab}`);
    if (badge) {
      badge.textContent = String(count);
      badge.hidden = !count;
    }
  }
  for (const tab of ["jobs", "applied", "feed"]) {
    indeedPanel.querySelector(`#cp-tab-${tab}`)?.classList.toggle("cp-active", indeedTab === tab);
  }
  const startBtn = indeedPanel.querySelector("#cp-start span");
  if (startBtn) startBtn.textContent = indeedScanning ? "Scanning…" : "Scan jobs";

  const log = indeedPanel.querySelector("#cp-log");
  if (!log) return;
  const empty = (icon, text) => `<div class="cp-empty-state"><span>${icon}</span><span>${text}</span></div>`;
  if (indeedTab === "jobs") {
    log.innerHTML = newJobs.length ? newJobs.map(indeedJobCardHtml).join("") : empty(ICONS.search, "Click <strong>Scan jobs</strong> to list the jobs on this page.");
  } else if (indeedTab === "applied") {
    log.innerHTML = appliedJobs.length ? appliedJobs.map(indeedJobCardHtml).join("") : empty(ICONS.check, "No already-applied jobs on this page.");
  } else {
    log.innerHTML = indeedFeed.length
      ? [...indeedFeed]
          .reverse()
          .map((item) => `<div class="cp-ai-card"><span class="cp-ai-icon">${item.icon}</span><span class="cp-ai-text">${item.html}</span><span class="cp-ai-time">${indeedEscape(item.time)}</span></div>`)
          .join("")
      : empty(ICONS.sparkle, "Indeed Copilot is standing by. Click <strong>Scan jobs</strong> to begin.");
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
  const prefs = loadIndeedPrefs();

  const toggle = document.createElement("button");
  toggle.id = TOGGLE_ID;
  toggle.title = "AutoApply CV Copilot";
  toggle.setAttribute("aria-label", "AutoApply CV Copilot");
  toggle.innerHTML = `<img src="${indeedAssetUrl("icons/icon32.png")}" alt="" width="26" height="26" style="display:block;margin:0 auto;border-radius:10px" /><span style="font-weight:700">Copilot</span>`;
  toggle.addEventListener("click", () => {
    indeedPanel?.classList.toggle("cp-sidebar-collapsed");
    saveIndeedPrefs({ collapsed: indeedPanel?.classList.contains("cp-sidebar-collapsed") });
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
          <div class="cp-sub">Indeed Copilot · Preview</div>
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
        <div class="cp-metric-pill cp-metric-quota"><span class="cp-svg-icon cp-icon-primary">${ICONS.bolt}</span><span>Indeed Apply jobs only</span></div>
        <span class="cp-run-mode-chip">Read-only</span>
      </div>
      <div class="cp-quick">
        <button id="cp-start" class="cp-btn-start">${ICONS.search} <span>Scan jobs</span></button>
        <button id="cp-stop" class="cp-btn-stop">${ICONS.stop} <span>Stop</span></button>
      </div>
    </div>
    <div class="cp-tab-bar">
      <button id="cp-tab-jobs" class="cp-tab"><span>Jobs</span><b class="cp-tab-count" id="cp-count-jobs" hidden>0</b></button>
      <button id="cp-tab-applied" class="cp-tab"><span>Applied</span><b class="cp-tab-count" id="cp-count-applied" hidden>0</b></button>
      <button id="cp-tab-feed" class="cp-tab cp-active"><span>Activity</span></button>
    </div>
    <div class="cp-log" id="cp-log" aria-live="polite"></div>
  `;
  panel.style.top = "0";
  panel.style.right = "0";
  panel.style.bottom = "0";
  panel.style.left = "auto";
  panel.style.width = `${INDEED_PANEL_WIDTH}px`;
  panel.style.zIndex = "2147483646";
  if (prefs.collapsed) panel.classList.add("cp-sidebar-collapsed");
  (document.body || document.documentElement).appendChild(panel);
  indeedPanel = panel;

  panel.querySelector("#cp-start").addEventListener("click", () => void scanIndeedJobs());
  panel.querySelector("#cp-stop").addEventListener("click", () => stopIndeedScan());
  panel.querySelector("#cp-clear-logs").addEventListener("click", () => {
    indeedStopRequested = true;
    indeedFeed = [];
    indeedJobs = [];
    clearIndeedOutlines();
    setIndeedStatus("Idle");
    renderIndeedPanel();
  });
  for (const tab of ["jobs", "applied", "feed"]) {
    panel.querySelector(`#cp-tab-${tab}`).addEventListener("click", () => {
      indeedTab = tab;
      renderIndeedPanel();
    });
  }

  indeedTab = "feed";
  renderIndeedPanel();
  syncIndeedPageShift();
}

function unmountIndeedPanel() {
  clearIndeedOutlines();
  document.getElementById(PANEL_ID)?.remove();
  document.getElementById(TOGGLE_ID)?.remove();
  indeedPanel = null;
  indeedJobs = [];
  if (document.body) {
    document.body.style.marginRight = "";
    document.body.classList.remove("cp-has-docked-sidebar");
  }
}

// ------------------------------------------------------------------ init
// Indeed swaps results in place on some searches: show the sidebar on list pages, reset it when the
// search changes (not when a card is clicked), and remove it elsewhere.
(() => {
  let lastKey = "";
  const sync = () => {
    const key = indeedSearchKey();
    if (key === lastKey) return;
    lastKey = key;
    if (isIndeedJobsListPage()) {
      mountIndeedPanel();
      indeedJobs = [];
      clearIndeedOutlines();
      setIndeedStatus("Idle");
      renderIndeedPanel();
    } else {
      unmountIndeedPanel();
    }
  };
  sync();
  setInterval(sync, 1000);
})();
