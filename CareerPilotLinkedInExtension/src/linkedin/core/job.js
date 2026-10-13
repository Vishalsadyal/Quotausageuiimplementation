/*
 * Job facts: title, company, location, workplace type and posted time, read from a job card in the
 * results list and from the opened job's details pane. Class-free with fallbacks: each field tries
 * LinkedIn's known classes first, then structure (job link, company link, <time>), then text lines.
 * Every value comes with the strategy that produced it ("via"), so breakages show up in the probes.
 *
 * Depends on src/linkedin/core/dom.js (CPLinkedInDom) and wait.js (CPLinkedInWait).
 * Shared by the content script and tools/probes/out/2-jobs-probe.js. Exposes globalThis.CPLinkedInJob.
 */
(function initCPLinkedInJob(global) {
  if (global.CPLinkedInJob) return;
  const Dom = global.CPLinkedInDom;
  const Wait = global.CPLinkedInWait;

  const clean = (t) => String(t || "").replace(/\s+/g, " ").trim();
  const norm = (t) => clean(t).toLowerCase();
  const textOf = (el) => clean(el?.innerText || el?.textContent);

  // Lines that are badges/status, never title/company/location.
  const BADGE_RE =
    /^(easy apply|promoted|viewed|applied|saved|new|verified( job)?|actively (reviewing|recruiting)( applicants)?|be an early applicant|top applicant|your profile matches.*|\d+ (applicants?|connections?|alumni|school alumni).*|over \d+ applicants|.*works? here|response insights.*|apply|save|dismiss.*|show more|.*with verification)$/i;
  const TIME_RE = /\b(just now|today|yesterday|\d+\s*(second|minute|min|hour|hr|day|week|wk|month|mo|year|yr)s?\s+ago|reposted\b.*)/i;
  const WORKPLACE_RE = /\b(remote|hybrid|on-?site)\b/i;
  // "City, Region, Country", "Bengaluru, Karnataka, India (Hybrid)", "India", "Remote", "United States"
  const LOCATION_RE = /^([A-Z][\w .'-]+(, [A-Z][\w .'-]+){0,3})( \((remote|hybrid|on-?site)\))?$|^(remote|hybrid|on-?site)$/i;

  /** Result helper: { value, via } for the first strategy that returns a non-empty string. */
  function pick(strategies) {
    for (const [via, fn] of strategies) {
      try {
        const value = clean(fn());
        if (value) return { value, via };
      } catch {
        // next strategy
      }
    }
    return { value: "", via: "none" };
  }

  /** "Frontend Developer Frontend Developer" / "... with verification" -> "Frontend Developer". */
  function cleanTitle(raw) {
    // LinkedIn appends "(Verified job)" / "with verification" to the visible or screen-reader title.
    // "Selected, <title>" is the screen-reader text of the currently open card.
    let t = clean(raw).replace(/^selected,\s*/i, "").replace(/\s*\(verified( job)?\)\s*$/i, "").replace(/\s+with verification$/i, "");
    const half = Math.floor(t.length / 2);
    if (t.length > 6 && t.slice(0, half).trim() === t.slice(half).trim()) t = t.slice(0, half).trim();
    return t;
  }

  function splitDots(text) {
    return clean(text).split(/\s*[·•]\s*/).map(clean).filter(Boolean);
  }

  /** Card text lines without badges, injected labels, or consecutive duplicates. */
  function contentLines(el) {
    const out = [];
    for (const line of Dom.tileLines(el).map(clean)) {
      // skip badges, bare separators ("·"), and repeats of the previous line
      if (!line || BADGE_RE.test(line) || SEPARATOR_RE.test(line) || out[out.length - 1] === line) continue;
      out.push(line);
    }
    return out;
  }

  const SEPARATOR_RE = /^[·•|,\-–—\s]+$/;
  // "600K INR/yr - 1M INR/yr", "$120K/yr", "₹12 LPA", "£40/hr"
  const SALARY_RE = /(\b(inr|usd|eur|gbp|lpa|ctc)\b|[$₹€£]\s?\d|\d\s?k?\s?\/(yr|year|hr|hour|mo|month)\b)/i;

  // ---------------------------------------------------------------- job card (results list)
  /** Reads a job card. Returns { jobId, title, company, location, workplace, posted, easyApply, applied, via }. */
  function readCard(tile) {
    const lines = contentLines(tile);
    const link = tile.querySelector("a[href*='/jobs/view/'], a[href*='currentJobId=']");
    const title = pick([
      ["known-classes", () => tile.querySelector(".job-card-list__title--link span[aria-hidden='true'], .job-card-list__title, .artdeco-entity-lockup__title")?.textContent],
      ["job-link", () => cleanTitle(link?.querySelector("span[aria-hidden='true'], strong")?.textContent || link?.getAttribute("aria-label") || link?.textContent)],
      ["first-line", () => cleanTitle(lines[0])],
    ]);
    const titleNorm = norm(cleanTitle(title.value));
    const afterTitle = lines.filter((l) => norm(cleanTitle(l)) !== titleNorm);
    const company = pick([
      ["known-classes", () => tile.querySelector(".artdeco-entity-lockup__subtitle, .job-card-container__primary-description, .job-card-list__subtitle")?.textContent],
      ["company-link", () => tile.querySelector("a[href*='/company/']")?.textContent],
      ["line-after-title", () => afterTitle.find((l) => !TIME_RE.test(l) && !LOCATION_RE.test(l) && !SALARY_RE.test(l)) || afterTitle.find((l) => !SALARY_RE.test(l))],
    ]);
    const rest = afterTitle.filter((l) => l !== company.value && !SALARY_RE.test(l));
    const salary = afterTitle.find((l) => SALARY_RE.test(l)) || "";
    const location = pick([
      ["known-classes", () => tile.querySelector(".job-card-container__metadata-item, .job-card-container__metadata-wrapper li, .job-card-list__location, .artdeco-entity-lockup__caption")?.textContent],
      ["location-pattern", () => rest.find((l) => LOCATION_RE.test(l) && !TIME_RE.test(l))],
      ["line-after-company", () => rest.find((l) => !TIME_RE.test(l))],
    ]);
    const posted = pick([
      ["time-element", () => {
        const t = tile.querySelector("time");
        return t ? clean(t.textContent) || t.getAttribute("datetime") : "";
      }],
      ["time-text", () => lines.concat(Dom.tileLines(tile)).find((l) => TIME_RE.test(l))?.match(TIME_RE)?.[0]],
    ]);
    const workplace = (location.value.match(WORKPLACE_RE) || Dom.tileLines(tile).join(" ").match(WORKPLACE_RE) || [""])[0];
    return {
      jobId: Dom.jobIdOf(tile).id,
      title: cleanTitle(title.value),
      company: company.value,
      location: location.value,
      workplace,
      posted: posted.value,
      salary,
      easyApply: Dom.hasEasyApply(tile),
      applied: Boolean(Dom.appliedMethodOf(tile)),
      // every badge/status line on the card: "Promoted", "Actively reviewing applicants", "Viewed", ...
      badges: [...new Set(Dom.tileLines(tile).map(clean).filter((l) => BADGE_RE.test(l) && !/^(apply|save|dismiss.*|show more)$/i.test(l)))],
      lines: Dom.tileLines(tile).map(clean).filter(Boolean).slice(0, 15), // raw text, for debugging new layouts
      via: { title: title.via, company: company.via, location: location.via, posted: posted.via },
    };
  }

  // ---------------------------------------------------------------- details pane (opened job)
  /** Reads the opened job's top card. Returns { title, company, location, workplace, posted, applicants, via }. */
  function readDetails(pane = Dom.findDetailPane().element) {
    if (!pane) return { title: "", company: "", location: "", workplace: "", posted: "", applicants: "", via: {} };
    // The job title heading: the first h1/h2/h3 that is not a section heading ("About the job").
    const headingText = Dom.jobHeading(pane);
    const heading = Array.from(pane.querySelectorAll("h1, h2, h3")).find((h) => headingText && norm(h.textContent) === headingText);
    const title = pick([
      ["known-classes", () => pane.querySelector(".job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, .t-24.job-details-jobs-unified-top-card__job-title")?.textContent],
      // 2026 layout: the title is a link to the open job (/jobs/view/<id>), not a heading. Checked
      // before headings because the pane has many section headings ("Unlock hiring insights on X").
      ["job-link", () => {
        const id = Dom.jobIdFromString(global.location.href);
        const link = id && Array.from(pane.querySelectorAll(`a[href*='/jobs/view/${id}']`)).find((a) => clean(a.textContent).length > 2);
        return link ? link.textContent : "";
      }],
      ["heading", () => heading?.textContent],
    ]);
    const company = pick([
      ["known-classes", () => pane.querySelector(".job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name")?.textContent],
      ["company-link", () => Array.from(pane.querySelectorAll("a[href*='/company/']")).map((a) => clean(a.textContent)).find((t) => t && t.length < 80)],
      ["line-near-title", () => {
        const lines = contentLines(pane).slice(0, 8);
        const i = lines.findIndex((l) => norm(l) === norm(title.value));
        return lines.slice(i + 1).find((l) => !TIME_RE.test(l) && !l.includes("·"));
      }],
    ]);
    // Top card summary line: "Bengaluru, Karnataka, India · 3 days ago · Over 100 applicants"
    const summary = pick([
      ["known-classes", () => pane.querySelector(".job-details-jobs-unified-top-card__primary-description-container, .job-details-jobs-unified-top-card__tertiary-description-container, .jobs-unified-top-card__primary-description")?.textContent],
      ["dot-line", () => contentLines(pane).slice(0, 15).find((l) => l.includes("·") && (TIME_RE.test(l) || /applicant/i.test(l)))],
    ]);
    const parts = splitDots(summary.value);
    const location = pick([
      ["summary-line", () => parts.find((p) => !TIME_RE.test(p) && !/applicant|clicked apply|promoted|responses? managed/i.test(p))],
      ["location-pattern", () => contentLines(pane).slice(0, 15).find((l) => LOCATION_RE.test(l))],
    ]);
    const posted = pick([
      ["summary-line", () => parts.find((p) => TIME_RE.test(p))?.match(TIME_RE)?.[0]],
      ["time-element", () => pane.querySelector("time")?.textContent],
      ["time-text", () => contentLines(pane).slice(0, 20).find((l) => TIME_RE.test(l))?.match(TIME_RE)?.[0]],
    ]);
    const applicants = parts.find((p) => /applicant|clicked apply/i.test(p)) || "";
    const top = contentLines(pane).slice(0, 25);
    const topText = top.join(" ");
    const workplace = (location.value.match(WORKPLACE_RE) || topText.match(WORKPLACE_RE) || [""])[0];
    // chips like "Full-time", "Contract", "Internship", alone or inside "Hybrid · Full-time" /
    // "Hybrid Full-time" (skip the title line: "ReactJS Development Internship" is not a job type)
    const titleKey = norm(cleanTitle(title.value));
    const jobType = [
      ...new Set(
        top
          .filter((l) => norm(cleanTitle(l)) !== titleKey)
          .flatMap((l) => (l.match(JOB_TYPE_WORDS_RE) || []).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())),
      ),
    ].join(", ");
    return {
      title: cleanTitle(title.value),
      company: company.value,
      location: location.value,
      workplace,
      posted: posted.value,
      applicants,
      jobType,
      salary: top.flatMap(splitDots).find((p) => SALARY_RE.test(p)) || "",
      descriptionChars: descriptionChars(pane),
      closed: CLOSED_RE.test(String(pane.innerText || "")),
      via: { title: title.via, company: company.via, location: location.via, posted: posted.via },
    };
  }

  const JOB_TYPE_WORDS_RE = /\b(full-time|part-time|contract|internship|temporary|volunteer|freelance)\b/gi;
  const CLOSED_RE = /no longer accepting applications|this job is closed|job (has )?expired/i;

  /**
   * Text of a details-pane section whose heading matches `headingRe` (e.g. /^about the job$/i),
   * without the heading itself. "" when the section is not rendered.
   */
  function sectionText(pane, headingRe) {
    if (!pane) return "";
    const heading = Array.from(pane.querySelectorAll("h1, h2, h3, h4, strong")).find((h) => headingRe.test(clean(h.textContent)));
    if (!heading) return "";
    let section = heading.parentElement;
    while (section && section !== pane && textOf(section).length < textOf(heading).length + 100) section = section.parentElement;
    return textOf(section || pane).replace(textOf(heading), "").trim();
  }

  /** The job description ("About the job"). */
  const descriptionText = (pane = Dom.findDetailPane().element) => sectionText(pane, /^(about the job|job description)$/i);
  /** The "About the company" section. */
  const aboutCompanyText = (pane = Dom.findDetailPane().element) => sectionText(pane, /^about the company$/i);

  /** Length of the job description ("About the job" section), 0 while it has not rendered. */
  function descriptionChars(pane) {
    const heading = Array.from(pane.querySelectorAll("h1, h2, h3, h4, strong")).find((h) => /^(about the job|job description)$/i.test(clean(h.textContent)));
    if (!heading) return 0;
    // the section that holds the heading plus its text
    let section = heading.parentElement;
    while (section && section !== pane && textOf(section).length < textOf(heading).length + 100) section = section.parentElement;
    return Math.max(0, textOf(section || pane).length - textOf(heading).length);
  }

  // ---------------------------------------------------------------- buttons in the details pane
  const ACTION_KINDS = [
    ["easy-apply", /^easy apply\b/],
    ["applied", /^applied\b|^(see|view) (your )?application\b|^application (submitted|sent)\b/],
    ["apply", /^apply\b|^apply now\b|^continue applying\b|apply on company/],
    ["save", /^(save|saved|unsave)\b/],
    ["share", /^share\b|^copy link\b|^send in a (private )?message\b/],
    ["more", /^more\b|^more (options|actions)\b|^(…|\.\.\.)$/],
    ["follow", /^(\+ )?follow(ing)?\b/],
    ["message", /^message\b/],
    ["show-more", /^(show|see) (more|less|all)\b|^…\s*(more|see more)$/],
    ["dismiss", /^(dismiss|close|hide|not interested)\b/],
    ["report", /^report\b/],
    ["premium", /premium|try .* (free|for ₹0)|reactivate/],
    ["carousel", /^(next|previous|back)\b|^[›‹<>]$/],
    ["feedback", /^(yes|no|helpful|not helpful)$|^(thumbs|was this helpful)|^is this information helpful/],
  ];
  const isVisibleEl = (el) => {
    const r = el?.getBoundingClientRect?.();
    return Boolean(r && r.width > 0 && r.height > 0);
  };

  /**
   * Every visible action in the details pane: buttons, role=button elements, and apply links.
   * Returns [{ label, kind, tag, disabled }] in page order, without duplicates.
   */
  function listActions(pane = Dom.findDetailPane().element) {
    if (!pane) return [];
    const out = [];
    const seen = new Set();
    for (const el of pane.querySelectorAll("button, [role='button'], a[href]")) {
      if (!isVisibleEl(el)) continue;
      const label = clean(el.getAttribute("aria-label")) || textOf(el);
      if (!label || label.length > 90) continue;
      const key = norm(label);
      const kind = (ACTION_KINDS.find(([, re]) => re.test(key)) || ["other"])[0];
      // plain links (company page, hashtags, profile) are not actions, except apply / application links
      if (el.tagName === "A" && !el.matches("[role='button']") && !["easy-apply", "apply", "applied"].includes(kind)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ label: label.slice(0, 60), kind, tag: el.tagName.toLowerCase(), disabled: el.disabled === true || el.getAttribute("aria-disabled") === "true" });
    }
    return out;
  }

  /** Is the details pane showing the job of this card? Titles match, or the card title is near the top. */
  function sameJobAs(card, details, pane) {
    const key = (t) => norm(cleanTitle(t)).replace(/[^a-z0-9 ]/g, "");
    const a = key(card.title);
    const b = key(details.title);
    if (!a) return false;
    if (b && (a.includes(b.slice(0, 20)) || b.includes(a.slice(0, 20)))) return true;
    const paneTop = pane ? contentLines(pane).slice(0, 12).map(key) : [];
    return paneTop.some((l) => l === a || (a.length > 12 && l.startsWith(a.slice(0, 20))));
  }

  /**
   * Smart wait for a FULLY loaded details pane for this card: same job, title + company read,
   * an apply state (Easy Apply / Apply / Applied / closed), and the description rendered; no
   * loaders and the pane DOM quiet. Resolves { ready, waitedMs, note, missing, details, actions, pane }.
   * `missing` names what never became true, e.g. ["apply button", "description"].
   */
  async function waitForDetails(card, { timeoutMs = 15000, shouldStop } = {}) {
    let snap = { pane: null, details: readDetails(null), actions: [], missing: ["details panel"] };
    const check = () => {
      const pane = Dom.findDetailPane().element;
      if (!pane) {
        snap = { pane: null, details: readDetails(null), actions: [], missing: ["details panel"] };
        return false;
      }
      const details = readDetails(pane);
      const actions = listActions(pane);
      const hasApplyState = details.closed || actions.some((x) => ["easy-apply", "apply", "applied"].includes(x.kind));
      const missing = [
        !sameJobAs(card, details, pane) && "same job",
        !details.title && "title",
        !details.company && "company",
        !hasApplyState && "apply button",
        details.descriptionChars < 150 && "description",
      ].filter(Boolean);
      snap = { pane, details, actions, missing };
      return missing.length === 0;
    };
    // The details pane keeps loading sections below the fold ("People you can reach out to", company
    // photos) with their own skeletons, so only a short grace for loaders / DOM changes once every
    // check above is already true.
    const res = await Wait.settled(() => snap.pane || document.body, check, {
      timeoutMs,
      quietMs: 300,
      maxQuietWaitMs: 800,
      loaderGraceMs: 800,
      shouldStop,
    });
    check(); // final read after the pane settled
    return { ready: res.ok, waitedMs: res.waitedMs, note: res.reason, ...snap };
  }

  // ---------------------------------------------------------------- open a card and read it
  /**
   * Opens a card (CPLinkedInDom.openTile click chain), smart-waits until its details are loaded and
   * stable, then reads card + details. Never clicks Apply.
   * Resolves { card, details, actions, missing, opened, ready, clickVia, openMs, readyMs, titleMatch, diag? }.
   */
  async function openAndRead(tile, { timeoutMs = 15000, shouldStop } = {}) {
    const card = readCard(tile);
    const start = Date.now();
    const open = await Dom.openTile(tile, { jobId: card.jobId, title: card.title });
    const openMs = Date.now() - start;
    // Wait for the FULL details (same job, title, company, apply state, description), not just a click.
    let loaded = open.opened
      ? await waitForDetails(card, { timeoutMs: Math.min(timeoutMs, 8000), shouldStop })
      : { ready: false, waitedMs: 0, note: "", missing: ["opened"], details: readDetails(null), actions: [], pane: null };
    // LinkedIn sometimes updates the URL but keeps showing the previous job's details. Click the
    // card once more and wait again before giving up.
    let retried = false;
    if (open.opened && !loaded.ready && loaded.missing.includes("same job")) {
      retried = true;
      // LinkedIn re-renders the list when a job opens: click the card as it is on the page NOW.
      const current = (tile.isConnected && tile) || Dom.findJobTiles().tiles.find((t) => Dom.jobIdOf(t).id === card.jobId) || tile;
      const target = Dom.clickTargetsFor(current)[0];
      if (target) Dom.realClick(target.el);
      const second = await waitForDetails(card, { timeoutMs, shouldStop });
      loaded = { ...second, waitedMs: loaded.waitedMs + second.waitedMs };
    }
    const paneResult = Dom.findDetailPane();
    const titleMatch = open.opened && !loaded.missing.includes("same job") && sameJobAs(card, loaded.details, loaded.pane);
    const result = {
      card,
      details: loaded.details,
      actions: loaded.actions, // every button in the details pane: [{ label, kind, tag, disabled }]
      missing: loaded.missing, // what never finished loading
      waitNote: loaded.note,
      opened: open.opened,
      ready: Boolean(loaded.ready),
      clickVia: open.via || `failed (${open.tried.join(" > ")})`,
      openMs,
      readyMs: loaded.waitedMs,
      retried, // clicked the card a second time because the details stayed on the previous job
      titleMatch,
    };
    // When something is off, say what the code saw (for fixing detection on a new layout).
    if (!result.ready || !titleMatch) result.diag = diagnoseDetails(card, tile, paneResult, Dom.detailReadiness({ jobId: card.jobId, title: card.title }));
    return result;
  }

  /** What the details pane looked like when it did not load or showed a different job. */
  function diagnoseDetails(card, tile, paneResult, last) {
    const pane = paneResult.element;
    return {
      cardId: `${card.jobId} via ${Dom.jobIdOf(tile).via}`,
      urlJobId: Dom.jobIdFromString(global.location.href),
      pane: pane ? `${paneResult.strategy}: <${pane.tagName.toLowerCase()}> ${clean(pane.innerText).length} chars` : "not found",
      readiness: last ? `idMatch=${last.idMatch} titleMatch=${last.titleMatch} action=${last.action || "none"} loading=${last.loading} heading="${last.heading || ""}"` : "",
      headings: pane ? Array.from(pane.querySelectorAll("h1, h2, h3")).slice(0, 5).map((h) => `${h.tagName}:${clean(h.textContent).slice(0, 50)}`) : [],
      paneTop: pane ? contentLines(pane).slice(0, 8).map((l) => l.slice(0, 60)) : [],
      loaders: pane ? Array.from(pane.querySelectorAll("[aria-busy='true'], .artdeco-loader, [class*='skeleton' i], [class*='shimmer' i], [class*='placeholder-loading' i]"))
        .filter((el) => el.getBoundingClientRect().width > 0)
        .slice(0, 3)
        .map((el) => `<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 60)}">`) : [],
    };
  }

  global.CPLinkedInJob = {
    version: 2,
    readCard,
    readDetails,
    descriptionText,
    aboutCompanyText,
    listActions,
    sameJobAs,
    waitForDetails,
    openAndRead,
    cleanTitle,
    TIME_RE,
    LOCATION_RE,
    ACTION_KINDS: ACTION_KINDS.map(([k]) => k),
  };
})(typeof window !== "undefined" ? window : globalThis);
