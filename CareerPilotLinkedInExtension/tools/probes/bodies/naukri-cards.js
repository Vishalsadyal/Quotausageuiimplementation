// Naukri card probe - can a search card tell "Apply" (on Naukri) from "Apply on company site" WITHOUT opening it?
// Read-only, never clicks. Paste on a Naukri search results page while logged in. It looks in four places:
//  A) every card: attributes, class names and hidden elements that mention apply / company / redirect / easy;
//  B) job data the page already holds (embedded JSON, window state);
//  C) Naukri's search API responses: click page 2 or change a filter WHILE it watches;
//  D) ground truth: fetches up to CONFIG.groundTruthJobs job pages in the background (GET, slowly) and
//     reads whether each is an on-Naukri apply or a company-site apply.
// Then it reports which card / API fields separate the two exactly. Downloads ONE .json file.
// Jobs are public data; no profile data, cookies or tokens are recorded. Stop early with cpNaukriCardsStop().
(async () => {
  // ------------------------------------------------------------------ settings (edit before pasting)
  const CONFIG = {
    watchSeconds: 45, // click page 2 / change a filter during this time so the search API fires
    groundTruthJobs: 10, // job pages to fetch for the real answer (0 = skip)
    fetchDelayMs: 1500, // pause between those fetches
    maxJobsKept: 60,
    ...(window.__cpNaukriCardsOptions || {}),
  };

  console.log("%cAutoApply CV - Naukri card probe", "font-weight:700;color:#6366f1");
  if (!/(^|\.)naukri\.com$/i.test(location.hostname)) return console.error("Open a Naukri search results page first.");

  const clean = (t) => String(t || "").replace(/\s+/g, " ").trim();
  const APPLYISH = /apply|company.?site|redirect|external|easy|quick|walkin|walk-in|chatbot|questionnaire|ats|career/i;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const jobIdFromUrl = (url) => (String(url || "").match(/-(\d{6,})(?:[/?#]|$)/) || [])[1] || "";
  let stopped = false;
  window.cpNaukriCardsStop = () => {
    stopped = true;
  };

  // ------------------------------------------------------------------ A) cards
  function findCards() {
    const known = Array.from(document.querySelectorAll(".srp-jobtuple-wrapper, article.jobTuple"));
    if (known.length) return known;
    const cards = new Set();
    for (const link of document.querySelectorAll("a[href*='/job-listings-']")) {
      let card = link;
      for (let n = link.parentElement; n && n !== document.body; n = n.parentElement) {
        if (new Set(Array.from(n.querySelectorAll("a[href*='/job-listings-']")).map((a) => a.href.split("?")[0])).size > 1) break;
        card = n;
      }
      if (card !== link) cards.add(card);
    }
    return Array.from(cards);
  }
  const isHidden = (el) => {
    const s = getComputedStyle(el);
    return s.display === "none" || s.visibility === "hidden" || el.hidden || el.getAttribute("aria-hidden") === "true" || (el.getBoundingClientRect().width === 0 && clean(el.textContent));
  };
  function readCard(card) {
    const link = card.querySelector("a.title, a[href*='/job-listings-']");
    const url = link?.href?.split("?")[0] || "";
    const jobId = card.getAttribute("data-job-id") || jobIdFromUrl(url);
    const attrs = {};
    const classTokens = new Set();
    const hiddenTexts = [];
    for (const el of [card, ...card.querySelectorAll("*")]) {
      for (const a of Array.from(el.attributes)) {
        if (a.name === "class") {
          for (const c of el.classList) if (APPLYISH.test(c)) classTokens.add(c);
        } else if (a.name !== "style" && (APPLYISH.test(a.name) || APPLYISH.test(a.value) || a.name.startsWith("data-"))) {
          attrs[`${el.tagName.toLowerCase()}@${a.name}`] = String(a.value).slice(0, 120);
        }
      }
      if (el !== card && el.children.length === 0 && clean(el.textContent) && isHidden(el)) hiddenTexts.push(clean(el.textContent).slice(0, 80));
    }
    const visibleApplyText = Array.from(card.querySelectorAll("*"))
      .filter((el) => el.children.length === 0 && APPLYISH.test(clean(el.textContent)) && clean(el.textContent).length < 40)
      .map((el) => clean(el.textContent));
    return { jobId, url, title: clean(link?.textContent).slice(0, 80), attrs, applyClassTokens: [...classTokens], hiddenTexts: hiddenTexts.slice(0, 10), visibleApplyText };
  }

  // ------------------------------------------------------------------ B/C) job objects in page state + API
  /** Flatten a job object to path -> short primitive value (job data is public). */
  function flatten(obj, prefix = "", out = {}, depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 3) return out;
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix + k;
      if (v === null || ["string", "number", "boolean"].includes(typeof v)) {
        out[key] = typeof v === "string" ? v.slice(0, 100) : v;
      } else if (Array.isArray(v)) {
        out[`${key}[]`] = `array(${v.length})`;
        if (v.length && typeof v[0] === "object") flatten(v[0], `${key}[0].`, out, depth + 1);
      } else {
        flatten(v, `${key}.`, out, depth + 1);
      }
    }
    return out;
  }
  /** Find arrays of job-like objects (have jobId) anywhere inside a value. */
  function findJobArrays(root, found = [], seen = new Set(), depth = 0) {
    if (!root || typeof root !== "object" || seen.has(root) || depth > 8) return found;
    seen.add(root);
    if (Array.isArray(root)) {
      if (root.length && root.slice(0, 3).every((x) => x && typeof x === "object" && ("jobId" in x || "jobid" in x || "jobID" in x))) found.push(root);
      for (const x of root.slice(0, 50)) findJobArrays(x, found, seen, depth + 1);
    } else {
      for (const v of Object.values(root)) findJobArrays(v, found, seen, depth + 1);
    }
    return found;
  }
  const jobsById = new Map(); // jobId -> { source, fields }
  function addJobs(arrays, source) {
    for (const arr of arrays) {
      for (const job of arr) {
        const id = String(job.jobId ?? job.jobid ?? job.jobID ?? "");
        if (!id || jobsById.size >= CONFIG.maxJobsKept) continue;
        if (!jobsById.has(id)) jobsById.set(id, { source, fields: flatten(job) });
      }
    }
  }
  const stateSources = [];
  for (const s of document.querySelectorAll("script[type='application/json'], script#__NEXT_DATA__, script[type='application/ld+json']")) {
    try {
      const arrays = findJobArrays(JSON.parse(s.textContent || "null"));
      if (arrays.length) {
        stateSources.push(`script${s.id ? `#${s.id}` : ""}[${s.type}]`);
        addJobs(arrays, "embedded-json");
      }
    } catch {
      // not JSON
    }
  }
  for (const key of Object.keys(window)) {
    if (!/state|data|store|initial|props|redux|apollo|__/i.test(key)) continue;
    try {
      const arrays = findJobArrays(window[key]);
      if (arrays.length) {
        stateSources.push(`window.${key}`);
        addJobs(arrays, `window.${key}`);
      }
    } catch {
      // unreadable global
    }
  }

  const apiCalls = [];
  const onApiJson = (url, status, text) => {
    try {
      const path = new URL(url, location.href).pathname;
      if (!/jobapi|search|recom/i.test(path)) return;
      const json = JSON.parse(text);
      const arrays = findJobArrays(json);
      apiCalls.push({ path, status, jobArrays: arrays.map((a) => a.length), topKeys: Object.keys(json || {}).slice(0, 25) });
      addJobs(arrays, `api:${path}`);
    } catch {
      // not JSON
    }
  };
  const origFetch = window.fetch;
  window.fetch = async function (input) {
    const res = await origFetch.apply(this, arguments);
    const url = typeof input === "string" ? input : input?.url;
    res.clone().text().then((t) => onApiJson(url, res.status, t)).catch(() => {});
    return res;
  };
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.addEventListener("loadend", () => {
      try {
        if (this.responseType === "" || this.responseType === "text") onApiJson(url, this.status, this.responseText);
        else if (this.responseType === "json") onApiJson(url, this.status, JSON.stringify(this.response));
      } catch {
        // unreadable
      }
    });
    return origOpen.apply(this, arguments);
  };

  // ------------------------------------------------------------------ watch for search API calls
  const cards0 = findCards().map(readCard);
  console.log(`Cards: ${cards0.length} | jobs in page data: ${jobsById.size} (${stateSources.join(", ") || "none"})`);
  if (CONFIG.watchSeconds > 0) {
    console.log(`%cNow click page 2 (or change a filter) within ${CONFIG.watchSeconds}s so the search API runs. cpNaukriCardsStop() skips ahead.`, "color:#16a34a;font-weight:600");
    const until = Date.now() + CONFIG.watchSeconds * 1000;
    while (!stopped && Date.now() < until) await sleep(500);
  }
  window.fetch = origFetch;
  XMLHttpRequest.prototype.open = origOpen;
  stopped = false;
  const cards = findCards().map(readCard);
  const allCards = [...new Map([...cards0, ...cards].map((c) => [c.jobId || c.url, c])).values()];

  // ------------------------------------------------------------------ D) ground truth from job pages
  // Reads the job page HTML (GET only) for the apply markers the open-source bots use.
  function classifyJobHtml(html) {
    const external = /company-site-button|apply on company site|"applyRedirectUrl"\s*:\s*"https?:|"companyApplyUrl"\s*:\s*"https?:/i.test(html);
    const naukri = /id=["']apply-button["']|"applyRedirectUrl"\s*:\s*(null|"")/i.test(html);
    const keys = [...new Set((html.match(/"[a-zA-Z]*[Aa]pply[a-zA-Z]*"\s*:/g) || []).map((k) => k.replace(/[":\s]/g, "")))].slice(0, 20);
    return { label: external ? "company-site" : naukri ? "naukri" : "unknown", applyKeysInHtml: keys };
  }
  const truth = {};
  const targets = allCards.filter((c) => c.url && c.jobId).slice(0, CONFIG.groundTruthJobs);
  for (const [i, card] of targets.entries()) {
    if (stopped) break;
    try {
      const res = await origFetch(card.url, { credentials: "include" });
      const html = await res.text();
      truth[card.jobId] = { status: res.status, ...classifyJobHtml(html) };
      console.log(`ground truth ${i + 1}/${targets.length}: ${truth[card.jobId].label}  ${card.title}`);
    } catch (e) {
      truth[card.jobId] = { status: 0, label: "unknown", error: String(e?.message || e).slice(0, 80) };
    }
    await sleep(CONFIG.fetchDelayMs);
  }

  // ------------------------------------------------------------------ which fields separate the labels?
  function separatingFields(rowsById) {
    const labeled = Object.entries(truth).filter(([id, t]) => t.label !== "unknown" && rowsById[id]);
    const labels = new Set(labeled.map(([, t]) => t.label));
    if (labeled.length < 2 || labels.size < 2) return { note: "Need jobs of both kinds with known labels.", labeled: labeled.length, labels: [...labels] };
    const keys = new Set(labeled.flatMap(([id]) => Object.keys(rowsById[id])));
    const results = [];
    for (const key of keys) {
      const byLabel = {};
      for (const [id, t] of labeled) (byLabel[t.label] ||= new Set()).add(JSON.stringify(rowsById[id][key] ?? null));
      const [a, b] = Object.values(byLabel);
      // Skip identifiers (job id, title, url): a value unique to every job "separates" anything.
      const isIdentifier = a && b && a.size + b.size === labeled.length;
      if (a && b && !isIdentifier && [...a].every((v) => !b.has(v))) results.push({ field: key, values: Object.fromEntries(Object.entries(byLabel).map(([l, s]) => [l, [...s].slice(0, 4)])) });
    }
    return { labeled: labeled.length, separating: results.sort((x, y) => (APPLYISH.test(y.field) ? 1 : 0) - (APPLYISH.test(x.field) ? 1 : 0)).slice(0, 25) };
  }
  const cardRows = Object.fromEntries(
    allCards.map((c) => [c.jobId, { ...c.attrs, ...Object.fromEntries(c.applyClassTokens.map((t) => [`class:${t}`, true])), hidden: c.hiddenTexts.join(" | "), visibleApply: c.visibleApplyText.join(" | ") }])
  );
  const apiRows = Object.fromEntries([...jobsById].map(([id, j]) => [id, j.fields]));

  const report = {
    probe: "naukri-cards",
    version: 1,
    at: new Date().toISOString(),
    path: location.pathname,
    counts: { cards: allCards.length, jobsInData: jobsById.size, groundTruth: Object.keys(truth).length },
    stateSources,
    apiCalls,
    groundTruth: truth,
    cards: allCards.slice(0, CONFIG.maxJobsKept).map((c) => ({ ...c, label: truth[c.jobId]?.label })),
    dataJobFieldNames: [...new Set([...jobsById.values()].flatMap((j) => Object.keys(j.fields)))].slice(0, 200),
    dataJobsApplyFields: Object.fromEntries([...jobsById].slice(0, 30).map(([id, j]) => [id, { label: truth[id]?.label, ...Object.fromEntries(Object.entries(j.fields).filter(([k]) => APPLYISH.test(k))) }])),
    answer: {
      fromCards: separatingFields(cardRows),
      fromPageOrApiData: separatingFields(apiRows),
    },
  };
  window.__cpNaukriCards = report;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
  a.download = `naukri-cards-probe-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  const labels = Object.values(truth).reduce((m, t) => ((m[t.label] = (m[t.label] || 0) + 1), m), {});
  console.log("%cDone. A .json file was downloaded - send it to Claude. Also in window.__cpNaukriCards.", "font-weight:700;color:#6366f1");
  console.log("Ground truth:", labels);
  console.log("Card fields that separate them:", report.answer.fromCards.separating?.map((r) => r.field) || report.answer.fromCards.note);
  console.log("Data/API fields that separate them:", report.answer.fromPageOrApiData.separating?.map((r) => r.field) || report.answer.fromPageOrApiData.note);
})();
