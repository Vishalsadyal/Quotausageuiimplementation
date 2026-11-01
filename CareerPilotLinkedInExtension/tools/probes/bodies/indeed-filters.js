// Indeed filters probe - learn what Indeed gives us for the dashboard filters the Indeed run doesn't use yet:
// job type (full-time / internship ...), work mode (remote / hybrid / on-site), location, years of experience.
// Read-only: it NEVER clicks anything and never calls Indeed's APIs itself.
//
//   SEARCH page (in.indeed.com/jobs?q=...):
//     1. every key in the page's job data (window.mosaic jobcards) + per job the fields that look like
//        job type / remote / location / experience / level, and experience phrases in the snippet;
//     2. Indeed's own filter bar: each filter button and, WHILE IT WATCHES, every option you see when you
//        open a filter menu yourself (Job type, Remote, Experience level, Date posted, Location, Pay ...),
//        with the URL each option goes to (the sc=... / jt= / explvl= codes).
//     WATCH: open EVERY filter dropdown in the bar one by one (just open it, you don't have to pick).
//
//   JOB page (in.indeed.com/viewjob?jk=...):
//     the job details (Job type, Pay, Work location, Experience / Qualifications lines), and the keys of
//     the page's job data (window._initialData) that look like those fields.
//
// No personal data: emails / phone numbers are masked. Downloads ONE .json file. Stop early: cpFiltersStop().
(async () => {
  const CONFIG = {
    watchSeconds: 60, // time to open the filter menus by hand
    maxJobs: 20, // jobs sampled in full from the page data
    ...(window.__cpFiltersOptions || {}),
  };
  console.log("%cAutoApply CV - Indeed filters probe", "font-weight:700;color:#6366f1");
  if (!/(^|\.)indeed\.com$/i.test(location.hostname)) return console.error("Open an Indeed search results page or a job page (/viewjob?jk=...) first.");

  const clean = (t) => String(t || "").replace(/\s+/g, " ").trim();
  const redact = (t) =>
    clean(t)
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<email>")
      .replace(/(\+?\d[\d\s-]{8,}\d)/g, "<number>")
      .slice(0, 400);
  const isVisible = (el) => {
    const r = el?.getBoundingClientRect?.();
    return Boolean(r && r.width > 0 && r.height > 0);
  };
  const INTERESTING = /type|remote|hybrid|location|loc|city|state|country|exp|year|senior|level|seniority|attribute|taxonomy|shift|schedule|benefit|requirement|qualif|salary|pay|education|workplace|work_?model|onsite/i;
  const EXPERIENCE = /(\d+(?:\.\d+)?\s*(?:\+|plus)?\s*(?:-|to|–)?\s*\d*\s*\+?\s*(?:years?|yrs?)\b[^.;]{0,60})|(fresher|entry[- ]level|no experience|experienced|senior|junior|mid[- ]level|lead\b|principal|intern(ship)?)/gi;
  const experiencePhrases = (text) => [...new Set((clean(text).match(EXPERIENCE) || []).map((m) => redact(m).slice(0, 90)))].slice(0, 8);

  /** Small copy of a value: primitives as they are, arrays / objects cut short. */
  function sample(value, depth = 0) {
    if (value == null || typeof value !== "object") return typeof value === "string" ? redact(value) : value;
    if (depth > 3) return Array.isArray(value) ? `[array ${value.length}]` : "{object}";
    if (Array.isArray(value)) return value.slice(0, 8).map((v) => sample(v, depth + 1));
    const out = {};
    for (const [k, v] of Object.entries(value).slice(0, 30)) out[k] = sample(v, depth + 1);
    return out;
  }

  /** Every key path in an object (a.b.c), with the type and one example value. */
  function keyPaths(obj, prefix = "", out = {}, depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 4) return out;
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${Array.isArray(obj) ? "[]" : k}` : k;
      if (out[path] === undefined) out[path] = Array.isArray(v) ? `array(${v.length})` : v === null ? "null" : typeof v === "object" ? "object" : `${typeof v}: ${redact(String(v)).slice(0, 60)}`;
      if (v && typeof v === "object") keyPaths(Array.isArray(v) ? v[0] : v, path, out, depth + 1);
      if (Array.isArray(obj)) break;
    }
    return out;
  }

  /** The fields of an object whose key looks like a filter (job type / remote / location / experience ...). */
  function interestingFields(obj, prefix = "", out = {}, depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 4) return out;
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (INTERESTING.test(k)) out[path] = sample(v);
      else if (v && typeof v === "object" && !Array.isArray(v)) interestingFields(v, path, out, depth + 1);
    }
    return out;
  }

  const report = {
    probe: "indeed-filters",
    version: 1,
    at: new Date().toISOString(),
    url: location.href.replace(/([?&](?:bb|xkcb|tk|mobtk)=)[^&]+/g, "$1<cut>"),
    page: /\/viewjob/.test(location.pathname) ? "job" : "search",
    urlParams: Object.fromEntries(new URLSearchParams(location.search)),
  };

  // ------------------------------------------------------------------ SEARCH page
  function readJobData() {
    const model = window.mosaic?.providerData?.["mosaic-provider-jobcards"]?.metaData?.mosaicProviderJobCardsModel;
    const results = Array.isArray(model?.results) ? model.results : [];
    const allKeys = {};
    for (const job of results) for (const k of Object.keys(job || {})) allKeys[k] = (allKeys[k] || 0) + 1;
    return {
      found: results.length > 0,
      count: results.length,
      allKeys, // key -> how many jobs have it
      keyPathsOfFirst: results[0] ? keyPaths(results[0]) : {},
      modelKeys: model ? Object.keys(model) : [],
      jobs: results.slice(0, CONFIG.maxJobs).map((job) => ({
        jobkey: job.jobkey,
        title: redact(job.displayTitle || job.title),
        easy: job.indeedApplyEnabled === true || job.indeedApplyable === true,
        fields: interestingFields(job),
        snippetExperience: experiencePhrases(`${job.snippet || ""} ${job.displayTitle || ""}`),
        snippet: redact(String(job.snippet || "").replace(/<[^>]+>/g, " ")).slice(0, 300),
      })),
    };
  }

  /** Other page data providers: anything that looks like filter definitions (labels + URLs / codes). */
  function readFilterData() {
    const providers = window.mosaic?.providerData || {};
    const found = [];
    const walk = (obj, path, depth) => {
      if (!obj || typeof obj !== "object" || depth > 7 || found.length > 300) return;
      if (Array.isArray(obj)) {
        const items = obj.filter((o) => o && typeof o === "object");
        const looksLikeOptions = items.length > 1 && items.every((o) => ("text" in o || "label" in o || "displayText" in o) && ("href" in o || "url" in o || "value" in o || "id" in o || "key" in o));
        if (looksLikeOptions) found.push({ path, options: items.slice(0, 25).map((o) => sample(o, 2)) });
        obj.slice(0, 40).forEach((v, i) => walk(v, `${path}[${i}]`, depth + 1));
        return;
      }
      for (const [k, v] of Object.entries(obj)) walk(v, `${path}.${k}`, depth + 1);
    };
    for (const [name, data] of Object.entries(providers)) if (name !== "mosaic-provider-jobcards") walk(data, name, 0);
    walk(window._initialData, "_initialData", 0);
    return { providers: Object.keys(providers), optionLists: found };
  }

  /** Indeed's filter bar: buttons now, and every menu option that shows up while watching. */
  const filterBar = { buttons: [], menus: {} };
  const FILTER_NAMES = /^(pay|salary|remote|work ?(setting|mode|type)|job type|date posted|location|experience( level)?|education( level)?|company|job language|posted by|encouraged to apply|programming language|industry|all filters|filters?|distance|within|sort)\b/i;
  function readFilterButtons() {
    const seen = new Set();
    {
      for (const el of document.querySelectorAll("button, a, [role='button'], [aria-haspopup], select")) {
        if (el.closest("#cp-linkedin-copilot-panel, #mosaic-provider-jobcards")) continue;
        const text = clean(el.textContent || el.getAttribute("aria-label"));
        if (!text || text.length > 60 || seen.has(text)) continue;
        if (!FILTER_NAMES.test(text) && !el.hasAttribute("aria-haspopup") && !/filter/i.test(`${el.id} ${el.className} ${el.getAttribute("data-testid") || ""}`)) continue;
        seen.add(text);
        filterBar.buttons.push({
          text,
          testid: el.getAttribute("data-testid") || "",
          id: el.id || "",
          expanded: el.getAttribute("aria-expanded"),
          controls: el.getAttribute("aria-controls") || "",
          href: el.getAttribute("href") || "",
          haspopup: el.getAttribute("aria-haspopup") || "",
          tag: el.tagName.toLowerCase(),
          classes: String(el.className || "").slice(0, 120),
          visible: isVisible(el),
          options: el.tagName === "SELECT" ? Array.from(el.options).map((o) => ({ text: clean(o.textContent), value: o.value })) : undefined,
        });
      }
    }
  }
  const FILTER_PARAMS = ["sc", "jt", "explvl", "fromage", "salaryType", "remotejob", "l", "radius", "rbl", "rbc", "jlid", "lang", "sr", "taxo", "fcckey"];
  const pageParams = new URLSearchParams(location.search);
  function readFilterLinks() {
    for (const a of document.querySelectorAll("a[href*='/jobs?'], a[href^='?']")) {
      if (!isVisible(a) || a.closest("#cp-linkedin-copilot-panel, #mosaic-provider-jobcards")) continue;
      let u;
      try {
        u = new URL(a.getAttribute("href"), location.href);
      } catch {
        continue;
      }
      const changed = FILTER_PARAMS.filter((k) => (u.searchParams.get(k) || "") !== (pageParams.get(k) || ""));
      if (!changed.length) continue;
      const group = clean(a.closest("ul, [role='menu'], [role='listbox'], [role='dialog'], fieldset, div[id]")?.getAttribute("aria-label") || a.closest("[id]")?.id || "links").slice(0, 60);
      const list = (filterBar.menus[`link:${group}`] ||= []);
      const text = clean(a.textContent).slice(0, 80);
      if (text && !list.some((o) => o.text === text)) list.push({ text, changed: Object.fromEntries(changed.map((k) => [k, u.searchParams.get(k) || ""])) });
    }
    for (const input of document.querySelectorAll("input[type='checkbox'], input[type='radio']")) {
      if (input.closest("#cp-linkedin-copilot-panel, #mosaic-provider-jobcards")) continue;
      const box = input.closest("[role='dialog'], [role='menu'], [role='listbox'], fieldset, form");
      if (!box || !isVisible(box)) continue;
      const label = clean((input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`)?.textContent) || input.closest("label")?.textContent || input.getAttribute("aria-label")).slice(0, 80);
      const group = clean(box.querySelector("legend, h2, h3")?.textContent || box.getAttribute("aria-label") || input.name || "inputs").slice(0, 60);
      const list = (filterBar.menus[`input:${group}`] ||= []);
      if (label && !list.some((o) => o.text === label)) list.push({ text: label, name: input.name || "", value: input.value || "", type: input.type });
    }
  }
  function readOpenMenus() {
    readFilterLinks();
    const menus = document.querySelectorAll("[role='menu'], [role='listbox'], [role='dialog'], [id*='filter-'][id*='menu'], ul[id*='filter'], [data-testid*='filter'][data-testid*='menu'], [class*='dropdown'] ul");
    for (const menu of menus) {
      if (!isVisible(menu) || menu.closest("#cp-linkedin-copilot-panel")) continue;
      const opener = document.querySelector(`[aria-controls="${CSS.escape(menu.id || "-")}"]`) || document.querySelector("[aria-expanded='true']");
      const name = clean(opener?.textContent || menu.getAttribute("aria-label") || menu.id || "menu").slice(0, 60);
      const options = Array.from(menu.querySelectorAll("a, button, [role='menuitem'], [role='option'], label, li"))
        .filter((o) => isVisible(o))
        .map((o) => {
          const href = o.getAttribute("href") || o.querySelector("a")?.getAttribute("href") || "";
          let params = {};
          try {
            if (href) params = Object.fromEntries(new URL(href, location.href).searchParams);
          } catch {}
          for (const k of ["bb", "xkcb", "vjk", "from"]) delete params[k];
          return { text: clean(o.textContent).slice(0, 80), href: href.slice(0, 300), params, value: o.getAttribute("value") || o.querySelector("input")?.value || "" };
        })
        .filter((o, i, all) => o.text && all.findIndex((x) => x.text === o.text) === i);
      if (!options.length) continue;
      const key = `${name}`;
      const known = new Set((filterBar.menus[key] || []).map((o) => o.text));
      filterBar.menus[key] = [...(filterBar.menus[key] || []), ...options.filter((o) => !known.has(o.text))].slice(0, 60);
    }
  }

  // ------------------------------------------------------------------ JOB page
  function readJobPage() {
    const textOf = (sel) => clean(document.querySelector(sel)?.innerText);
    const details = {};
    for (const section of document.querySelectorAll("#jobDetailsSection, [data-testid*='jobDetails'], [aria-label*='Job details'], #salaryInfoAndJobType, [data-testid*='jobsearch-OtherJobDetailsContainer']")) {
      details[section.id || section.getAttribute("data-testid") || section.getAttribute("aria-label")] = redact(section.innerText).slice(0, 600);
    }
    const description = textOf("#jobDescriptionText");
    const lines = description.split(/\n|•|·/).map(clean).filter((l) => /experience|years?|yrs|fresher|senior|junior|qualification|education|job type|full[- ]time|part[- ]time|intern|contract|remote|hybrid|in person|work location/i.test(l));
    const initial = window._initialData || {};
    return {
      title: redact(textOf("h1")),
      detailsSections: details,
      descriptionLines: lines.slice(0, 40).map((l) => redact(l).slice(0, 160)),
      experiencePhrases: experiencePhrases(description),
      initialDataKeys: Object.keys(initial),
      initialDataInteresting: interestingFields(initial),
      jobInfoKeyPaths: keyPaths(initial.jobInfoWrapperModel || initial.jobInfoModel || {}),
    };
  }

  function download(data, suffix) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `indeed-filters-${data.page}${suffix}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  // Menus seen before Indeed reloaded the page (picking an option reloads it): kept and added to this report.
  const SAVED = "cpFiltersProbeMenus";
  try {
    const before = JSON.parse(sessionStorage.getItem(SAVED) || "null");
    if (before?.menus) {
      Object.assign(filterBar.menus, before.menus);
      report.menusFromBeforeReload = Object.keys(before.menus);
    }
  } catch {}

  // ------------------------------------------------------------------ run
  if (report.page === "search") {
    report.jobData = readJobData();
    report.filterData = readFilterData();
    readFilterButtons();
    readFilterLinks();
    report.filterBar = filterBar;
    download(report, "-1-data"); // the job data, saved now in case the page reloads while watching
    console.log(`Page data: ${report.jobData.count} jobs, ${Object.keys(report.jobData.allKeys).length} keys. Filter buttons: ${filterBar.buttons.map((b) => b.text).join(" | ") || "none found"}`);
    console.log("%cOpen each dropdown and close it again (Esc). Don't pick an option: that reloads the page. If it does reload, paste the probe again; what it saw is kept.", "color:#b45309;font-weight:700");
    console.log(`%cNow open EVERY filter dropdown in Indeed's filter bar one by one (Job type, Remote, Experience level, Date posted, Location, Pay...). Watching ${CONFIG.watchSeconds}s. cpFiltersStop() ends early.`, "color:#6366f1;font-weight:700");
    let stop = false;
    window.cpFiltersStop = () => (stop = true);
    const until = Date.now() + CONFIG.watchSeconds * 1000;
    while (!stop && Date.now() < until) {
      readOpenMenus();
      try {
        sessionStorage.setItem(SAVED, JSON.stringify({ menus: filterBar.menus }));
      } catch {}
      await new Promise((r) => setTimeout(r, 300));
    }
    report.filterBar.menuNames = Object.keys(filterBar.menus);
    console.log(`Menus seen: ${report.filterBar.menuNames.join(" | ") || "none (open the dropdowns while it watches)"}`);
  } else {
    report.jobPage = readJobPage();
    console.log("Job page read:", report.jobPage.experiencePhrases, Object.keys(report.jobPage.detailsSections));
  }

  window.__cpFilters = report;
  download(report, report.page === "search" ? "-2-menus" : "");
  try {
    sessionStorage.removeItem(SAVED);
  } catch {}
  console.log("%cDone. A .json file was downloaded - send it to Claude. Also in window.__cpFilters.", "font-weight:700;color:#6366f1");
})();
