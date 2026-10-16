// Why does a job with an Easy Apply button get called "external"? Read-only: never clicks anything.
// 1) prints a snapshot of what the extension would see right now,
// 2) WATCH mode: click a job card yourself and it records, every 250 ms, which job the URL and the details
//    pane show and which apply button is found, so a stale or still-loading pane shows up in the timeline.
(() => {
  const CONFIG = {
    watchSeconds: 30, // 0 = snapshot only. Click the misdetected job card during this time.
    sampleMs: 250,
    maxCards: 12,
  };

  const Dom = window.CPLinkedInDom;
  const norm = (t) => String(t || "").toLowerCase().replace(/\s+/g, " ").trim();
  const INJECTED = ".cp-card-outcome-tag, .cp-card-live-badge, .cp-probe-label, .cp-detail-live-indicator";
  const labelOf = (el) => (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // Same rules as src/linkedin/jobs/09-apply-button.js getApplyButtonFromDetailPane (the older, class-based finder).
  const LEGACY_ROOTS = ".jobs-search__job-details, .jobs-details, .jobs-unified-top-card, .jobs-details-top-card, .scaffold-layout__detail";
  function legacyDecision() {
    const roots = Array.from(document.querySelectorAll(LEGACY_ROOTS));
    const scopes = roots.length ? roots : [document];
    const candidates = scopes.flatMap((r) => Array.from(r.querySelectorAll("button.jobs-apply-button, .jobs-s-apply button, button[aria-label*='Apply'], button[data-control-name*='jobdetails_topcard']")));
    const enabled = candidates.filter((b) => {
      if (!b || b.disabled) return false;
      if (b.closest(".jobs-search-box__filters-bar, .search-reusables__filters-bar, .jobs-search-box__filter-item")) return false;
      const cls = norm(b.className || "");
      const aria = norm(b.getAttribute("aria-label") || "");
      return !(cls.includes("filter") || aria.includes("filter"));
    });
    const text = (b) => `${norm(b.getAttribute("aria-label") || "")} ${norm(b.textContent || "")}`;
    const easy = enabled.find((b) => text(b).includes("easy apply"));
    if (easy) return { type: "easy", button: easy, legacyRoots: roots.length };
    const ext = enabled.find((b) => text(b).includes("apply") && !text(b).includes("easy apply"));
    if (ext) return { type: "external", button: ext, legacyRoots: roots.length };
    return { type: "none", button: null, legacyRoots: roots.length };
  }

  function where(el, pane, tiles) {
    if (!el) return "-";
    if (pane && pane.contains(el)) return "details pane";
    const i = tiles.findIndex((t) => t.contains(el));
    if (i >= 0) return `job card #${i + 1}`;
    if (el.closest("header, nav, [role='banner']")) return "page header";
    if (el.closest("[class*='filter' i], [role='toolbar']")) return "filter bar";
    return "elsewhere";
  }

  function snapshot() {
    const found = Dom.findJobTiles({});
    const tiles = found.tiles;
    const paneInfo = Dom.findDetailPane({ fresh: true });
    const pane = paneInfo.element;
    const heading = pane ? Dom.jobHeading(pane) : "";
    const urlJobId = Dom.jobIdFromString(location.href);
    const generic = Dom.findApplyAction();
    const legacy = legacyDecision();
    const loading = pane
      ? Array.from(pane.querySelectorAll("[aria-busy='true'], .artdeco-loader, [class*='skeleton' i], [class*='shimmer' i]")).some(visible)
      : false;
    const openTile = tiles.find((t) => {
      const id = Dom.jobIdOf(t);
      return (id && id.id) === urlJobId;
    });
    const openTitle = openTile ? String(Dom.tileTitle(openTile) || "") : "";
    const applyControls = Array.from(document.querySelectorAll("button, a, [role='button']"))
      .filter((el) => /apply/i.test(el.getAttribute("aria-label") || "") || /^(easy )?apply\b/i.test((el.textContent || "").trim()))
      .filter((el) => !el.closest(INJECTED) && !el.closest("[id^='cp-']"))
      .slice(0, 25)
      .map((el) => ({
        label: labelOf(el),
        tag: el.tagName.toLowerCase(),
        where: where(el, pane, tiles),
        visible: visible(el),
        disabled: el.disabled === true || el.getAttribute("aria-disabled") === "true",
      }));
    const cards = tiles.slice(0, CONFIG.maxCards).map((t, i) => {
      const clone = t.cloneNode(true);
      clone.querySelectorAll(INJECTED).forEach((n) => n.remove());
      const badge = /easy apply/i.test(clone.textContent || "") || Boolean(clone.querySelector("[aria-label*='Easy Apply' i]"));
      const idr = Dom.jobIdOf(t);
      return { "#": i + 1, jobId: (idr && idr.id) || "", title: String(Dom.tileTitle(t) || "").slice(0, 45), easyApplyBadge: badge, open: ((idr && idr.id) || "") === urlJobId };
    });
    return {
      at: new Date().toISOString().slice(11, 23),
      url: location.href.slice(0, 110),
      urlJobId,
      paneStrategy: paneInfo.strategy,
      paneHeading: heading.slice(0, 60),
      openCardTitle: openTitle.slice(0, 60),
      paneLoading: loading,
      generic: { type: generic.type, label: generic.button ? labelOf(generic.button) : "", where: where(generic.button, pane, tiles) },
      legacy: { type: legacy.type, label: legacy.button ? labelOf(legacy.button) : "", where: where(legacy.button, pane, tiles), legacyRoots: legacy.legacyRoots },
      applyControls,
      cards,
    };
  }

  const s = snapshot();
  console.log("%cSNAPSHOT", "font-weight:bold", `${s.at} job ${s.urlJobId || "(none in URL)"}`);
  console.table([{ pane: s.paneStrategy, heading: s.paneHeading, openCard: s.openCardTitle, loading: s.paneLoading }]);
  console.table([{ finder: "generic (dom.js)", ...s.generic }, { finder: "legacy (09-apply-button.js)", type: s.legacy.type, label: s.legacy.label, where: s.legacy.where, legacyRoots: s.legacy.legacyRoots }]);
  console.log("Apply-like controls on the page:");
  console.table(s.applyControls);
  console.log("Job cards (does the card show the Easy Apply badge?):");
  console.table(s.cards);

  const norm2 = (t) => norm(t).replace(/[^a-z0-9 ]/g, "");
  const headingMatchesCard = !s.openCardTitle || !s.paneHeading || norm2(s.paneHeading).includes(norm2(s.openCardTitle).slice(0, 20)) || norm2(s.openCardTitle).includes(norm2(s.paneHeading).slice(0, 20));
  const checks = [
    ["details pane found", Boolean(s.paneStrategy && s.paneStrategy !== "none"), s.paneStrategy],
    ["pane is not loading", !s.paneLoading, s.paneLoading ? "skeleton / spinner visible" : "ok"],
    ["pane heading matches the open job's card", headingMatchesCard, `"${s.paneHeading}" vs card "${s.openCardTitle}"`],
    ["apply button is inside the details pane", s.generic.where === "details pane", s.generic.where],
    ["generic and legacy finders agree", s.generic.type === s.legacy.type, `generic=${s.generic.type} legacy=${s.legacy.type}`],
  ];
  for (const [name, ok, detail] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${name} - ${detail}`);

  const result = { snapshot: s, checks, timeline: [] };
  window.__cpApply = result;
  if (!CONFIG.watchSeconds) return console.log("Result kept in window.__cpApply");

  console.log(`%cWATCHING for ${CONFIG.watchSeconds}s: click the job card that gets called external now.`, "font-weight:bold;color:#b45309");
  const started = performance.now();
  let lastKey = "";
  const timer = setInterval(() => {
    const t = snapshot();
    const key = `${t.urlJobId}|${t.paneHeading}|${t.paneLoading}|${t.generic.type}|${t.generic.label}|${t.legacy.type}`;
    if (key !== lastKey) {
      lastKey = key;
      result.timeline.push({
        "+ms": Math.round(performance.now() - started),
        urlJobId: t.urlJobId,
        paneHeading: t.paneHeading,
        loading: t.paneLoading,
        generic: `${t.generic.type}: ${t.generic.label}`,
        legacy: `${t.legacy.type}: ${t.legacy.label}`,
      });
    }
    if (performance.now() - started >= CONFIG.watchSeconds * 1000) {
      clearInterval(timer);
      console.log("%cTIMELINE (a row appears whenever something changed)", "font-weight:bold");
      console.table(result.timeline);
      const wrong = result.timeline.filter((r) => /^external/.test(r.generic) || /^external/.test(r.legacy));
      console.log(wrong.length
        ? `FOUND ${wrong.length} moment(s) where an external apply button was reported. Look at paneHeading/urlJobId on those rows: a heading from a different job means the pane was stale.`
        : "No external apply button reported while watching.");
      console.log("Result kept in window.__cpApply");
    }
  }, CONFIG.sampleMs);
})();
