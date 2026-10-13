// Probe body (walk). Bundled with src/linkedin/core/* by tools/probes/build.mjs.
// It NEVER applies: it only opens jobs, optionally opens the Easy Apply form and closes it with "Discard".
(async () => {
  // ------------------------------------------------------------------ settings (edit before pasting)
  const CONFIG = {
    searchTerms: [], // e.g. ["Frontend Developer", "React Developer"]; empty = only the current search
    maxPagesPerSearch: 2, // results pages to walk per search term
    maxTilesPerPage: 25, // tiles to open per page
    openEasyApplyForm: false, // true = open the Easy Apply form, record step 1, then close + discard
    delayMs: 1200, // pause between tiles (be gentle with LinkedIn)
    detailTimeoutMs: 15000, // max wait for the job to be fully loaded (id/title + apply button + no spinners)
    stableMs: 700, // the details panel text must stop changing for this long before reading it
  };

  const Dom = window.CPLinkedInDom;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (t) => String(t || "").toLowerCase().replace(/\s+/g, " ").trim();
  const linesOf = (el) => String(el?.innerText || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const isVisible = (el) => {
    const r = el?.getBoundingClientRect?.();
    return Boolean(r && r.width > 0 && r.height > 0);
  };
  async function waitFor(fn, timeoutMs, intervalMs = 200) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const v = fn();
        if (v) return v;
      } catch {
        // keep waiting
      }
      await sleep(intervalMs);
    }
    return null;
  }

  // Never click anything that could submit or advance an application.
  const FORBIDDEN_RE = /\b(submit|send application|review|next|continue|apply now)\b/i;

  let stopped = false;
  window.cpWalkStop = () => {
    stopped = true;
    console.log("[walk] stop requested; finishing current step...");
  };

  const results = [];
  const pages = [];
  const searches = [];
  const status = (msg) => console.log(`%c[walk] ${msg}`, "color:#6366f1");

  // ------------------------------------------------------------------ helpers
  function tileLabel(tile, text, color) {
    tile.querySelector(".cp-probe-label")?.remove();
    const label = document.createElement("div");
    label.className = "cp-probe-label";
    label.textContent = text;
    label.style.cssText = `font:700 11px/1.4 system-ui;color:#fff;background:${color};padding:1px 6px;border-radius:4px;width:fit-content;margin:2px 0;`;
    tile.prepend(label);
    tile.style.outline = `3px solid ${color}`;
    tile.setAttribute("data-cp-probe", "1");
  }

  function detailSnapshot() {
    const pane = Dom.findDetailPane();
    const el = pane.element;
    const heading = el ? Dom.jobHeading(el) : "";
    const btn = el ? Dom.findApplyButton(el) : null;
    return {
      paneVia: pane.strategy,
      urlJobId: Dom.jobIdFromString(location.href),
      title: heading.slice(0, 80),
      applyButton: btn ? norm(btn.getAttribute("aria-label") || btn.textContent).slice(0, 50) : "",
      appliedVia: el ? Dom.detailAppliedMethod(el) : "",
      button: btn,
    };
  }

  // ------------------------------------------------------------------ Easy Apply form (read-only)
  function activeDialog() {
    return Array.from(document.querySelectorAll("[role='dialog'], .artdeco-modal")).find(
      (d) => isVisible(d) && linesOf(d).length > 0,
    );
  }

  async function inspectEasyApplyForm(button) {
    const before = activeDialog();
    button.click();
    const dialog = await waitFor(() => {
      const d = activeDialog();
      return d && d !== before ? d : null;
    }, 6000);
    if (!dialog) return { opened: false };
    await sleep(600);
    const fields = Array.from(dialog.querySelectorAll("input, select, textarea")).filter(
      (f) => f.type !== "hidden" && isVisible(f),
    );
    const labels = Array.from(dialog.querySelectorAll("label, legend"))
      .map((l) => norm(l.textContent).slice(0, 60))
      .filter(Boolean)
      .slice(0, 12);
    const buttons = Array.from(dialog.querySelectorAll("button"))
      .map((b) => norm(b.getAttribute("aria-label") || b.textContent).slice(0, 40))
      .filter(Boolean);
    const info = {
      opened: true,
      step: norm(dialog.querySelector("h2, h3")?.textContent || "").slice(0, 60),
      fieldCount: fields.length,
      labels,
      buttons,
      closed: false,
    };

    // Close: Dismiss/Close (never a forbidden button), then confirm "Discard" if LinkedIn asks.
    const dismiss = Array.from(dialog.querySelectorAll("button")).find((b) => {
      const l = norm(b.getAttribute("aria-label") || b.textContent);
      return /^(dismiss|close)\b/.test(l) && !FORBIDDEN_RE.test(l);
    });
    if (dismiss) dismiss.click();
    else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(700);
    const confirm = activeDialog();
    if (confirm) {
      const discard = Array.from(confirm.querySelectorAll("button")).find((b) =>
        /^discard\b/.test(norm(b.getAttribute("aria-label") || b.textContent)),
      );
      if (discard) {
        discard.click();
        await sleep(600);
      }
    }
    info.closed = !activeDialog();
    return info;
  }

  // ------------------------------------------------------------------ pagination (fallback chain)
  function currentPageNumber() {
    const cur = Array.from(document.querySelectorAll("[aria-current='true'], [aria-current='page']")).find((el) =>
      /^\d+$/.test(norm(el.textContent)),
    );
    return cur ? Number(norm(cur.textContent)) : 1;
  }

  function findNextPageControl() {
    const page = currentPageNumber();
    // Skip the top bar (its "2" notification badges look like page numbers) and our own UI.
    const candidates = Array.from(document.querySelectorAll("button, a")).filter(
      (el) =>
        isVisible(el) &&
        !el.disabled &&
        el.getAttribute("aria-disabled") !== "true" &&
        !el.closest("header, #global-nav, #msg-overlay, [id^='cp-'], .cp-probe-label"),
    );
    const label = (el) => norm(`${el.getAttribute("aria-label") || ""} ${el.textContent || ""}`);
    const chain = [
      ["aria-next", () => candidates.find((el) => /^(view )?next( page)?\b/.test(norm(el.getAttribute("aria-label"))))],
      ["page-number", () => candidates.find((el) => norm(el.getAttribute("aria-label")) === `page ${page + 1}` || norm(el.textContent) === String(page + 1))],
      ["next-text", () => candidates.find((el) => /^next\b/.test(norm(el.textContent)))],
      ["more-results", () => candidates.find((el) => /^(see|show|load) more (jobs|results)\b/.test(label(el)))],
    ];
    for (const [via, fn] of chain) {
      const el = fn();
      if (el) return { el, via };
    }
    return null;
  }

  function firstTileKey() {
    const { tiles } = Dom.findJobTiles();
    return tiles.length ? Dom.jobIdOf(tiles[0]).id : "";
  }

  async function goToNextPage() {
    const control = findNextPageControl();
    if (!control) return { moved: false, via: "none" };
    const beforeKey = firstTileKey();
    const beforePage = currentPageNumber();
    control.el.scrollIntoView({ block: "center" });
    control.el.click();
    const changed = await waitFor(() => firstTileKey() && firstTileKey() !== beforeKey, 10000, 300);
    return { moved: Boolean(changed), via: control.via, from: beforePage, to: currentPageNumber() };
  }

  // ------------------------------------------------------------------ search box (fallback chain)
  function findSearchInput() {
    const inputs = Array.from(document.querySelectorAll("input")).filter((i) => isVisible(i) && i.type !== "hidden");
    const hint = (i) => norm(`${i.getAttribute("aria-label") || ""} ${i.getAttribute("placeholder") || ""}`);
    const chain = [
      ["title-label", () => inputs.find((i) => /title|skill|company/.test(hint(i)) && !/location|city/.test(hint(i)))],
      ["describe-job", () => inputs.find((i) => /describe|job you want|search jobs/.test(hint(i)))],
      ["jobs-combobox", () => inputs.find((i) => i.getAttribute("role") === "combobox" && /job/.test(hint(i)))],
      ["any-search", () => inputs.find((i) => /search/.test(hint(i)) && !/location|city|messag/.test(hint(i)))],
    ];
    for (const [via, fn] of chain) {
      const el = fn();
      if (el) return { el, via };
    }
    return null;
  }

  async function runSearch(term) {
    const found = findSearchInput();
    if (!found) return { ok: false, via: "none" };
    const input = found.el;
    const beforeKey = firstTileKey();
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, term);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(400);
    for (const type of ["keydown", "keypress", "keyup"]) {
      input.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    }
    input.form?.requestSubmit?.();
    const changed = await waitFor(() => firstTileKey() && firstTileKey() !== beforeKey, 12000, 300);
    return { ok: Boolean(changed), via: found.via };
  }

  // ------------------------------------------------------------------ walk one results page
  async function walkPage(searchLabel, pageNo) {
    const found = Dom.findJobTiles();
    const page = { search: searchLabel, page: pageNo, tilesVia: found.strategy, tiles: found.tiles.length, opened: 0, failedToOpen: 0 };
    status(`"${searchLabel}" page ${pageNo}: ${found.tiles.length} tiles via ${found.strategy}`);

    const seen = new Set();
    for (const tile of found.tiles.slice(0, CONFIG.maxTilesPerPage)) {
      if (stopped) break;
      if (!tile.isConnected) continue;
      const { id: tileId, via: idVia } = Dom.jobIdOf(tile);
      if (seen.has(tileId)) continue;
      seen.add(tileId);

      // Read the tile ignoring labels added by the probes or the extension.
      const tileTitle = norm(Dom.tileTitle(tile)).slice(0, 50);
      const tileEasyApply = Dom.hasEasyApply(tile);
      const tileApplied = Dom.appliedMethodOf(tile);

      tile.scrollIntoView({ block: "center" });
      tileLabel(tile, "opening…", "#6366f1");
      // Click through the target chain (title → title text → job link → tile button → tile)
      // until LinkedIn actually selects this job.
      const open = await Dom.openTile(tile, { jobId: tileId, title: tileTitle });

      // Wait for FULL readiness: this job's id/title in the pane, an apply action rendered,
      // no loading placeholders, and the pane text stable for CONFIG.stableMs.
      const readiness = await Dom.waitForJobReady(
        { jobId: tileId, title: tileTitle },
        { timeoutMs: CONFIG.detailTimeoutMs, stableMs: CONFIG.stableMs },
      );
      const after = open.opened && (readiness.ready || readiness.last?.idMatch || readiness.last?.titleMatch) ? detailSnapshot() : null;

      const row = {
        search: searchLabel,
        page: pageNo,
        tileJobId: tileId,
        idVia,
        tileTitle,
        tileEasyApply,
        tileApplied: tileApplied || "no",
        opened: Boolean(after),
        clickVia: open.via || `failed (tried ${open.tried.join(" > ")})`,
        ready: readiness.ready,
        openMs: after ? readiness.waitedMs : null,
        notReadyBecause: readiness.ready
          ? ""
          : [
              !readiness.last?.pane && "no details pane",
              readiness.last?.pane && !readiness.last.idMatch && !readiness.last.titleMatch && "pane still shows another job",
              readiness.last?.pane && !readiness.last.action && "no apply button/applied/closed state",
              readiness.last?.loading && "still loading",
            ]
              .filter(Boolean)
              .join(", ") || "text kept changing",
        urlJobId: after?.urlJobId || "",
        idMatchesUrl: Boolean(after && after.urlJobId && after.urlJobId === tileId),
        detailTitle: after?.title || "",
        detailVia: after?.paneVia || "",
        applyButton: after?.applyButton || "(none)",
        detailApplied: after?.appliedVia || "no",
        form: "",
      };

      if (after && CONFIG.openEasyApplyForm && after.button && /easy apply/.test(after.applyButton) && !after.appliedVia) {
        const form = await inspectEasyApplyForm(after.button);
        row.form = form.opened
          ? `step "${form.step}", ${form.fieldCount} fields, buttons: ${form.buttons.join("/")}${form.closed ? "" : " (NOT CLOSED)"}`
          : "did not open";
        row.formDetail = form;
      }

      results.push(row);
      if (row.opened) page.opened += 1;
      else page.failedToOpen += 1;

      const applied = row.tileApplied !== "no" || row.detailApplied !== "no";
      const color = !row.opened ? "#ef4444" : !row.ready ? "#a855f7" : applied ? "#10b981" : row.applyButton.includes("easy apply") ? "#0ea5e9" : "#f59e0b";
      const text = !row.opened
        ? "did not open"
        : !row.ready
          ? `not ready: ${row.notReadyBecause}`
          : applied
          ? `APPLIED (${row.tileApplied !== "no" ? row.tileApplied : row.detailApplied})`
          : `${row.applyButton || "no apply button"} · ${row.openMs}ms`;
      tileLabel(tile, `#${results.length} ${text}`, color);
      console.log(`[walk] #${results.length} ${row.tileTitle} → ${text}${row.idMatchesUrl ? "" : " (url id differs)"}`);
      await sleep(CONFIG.delayMs);
    }
    pages.push(page);
  }

  // ------------------------------------------------------------------ main
  if (!Dom) {
    console.error("[walk] CPLinkedInDom missing");
    return;
  }
  document.querySelectorAll(".cp-probe-label").forEach((el) => el.remove());
  console.log("%cAutoApply CV walk probe (dry run, never applies)", "font-weight:700;font-size:14px;color:#6366f1");
  console.log("[walk] Pause the extension's run first. Stop any time with cpWalkStop().", CONFIG);

  const terms = CONFIG.searchTerms.length ? CONFIG.searchTerms : [null];
  for (const [index, term] of terms.entries()) {
    if (stopped) break;
    let label = term || `current (${new URL(location.href).searchParams.get("keywords") || "search"})`;
    if (term) {
      status(`searching "${term}"…`);
      const s = await runSearch(term);
      searches.push({ term, ...s });
      if (!s.ok) {
        if (index > 0 || s.via === "none") {
          status(`search "${term}" did not change the results (input via ${s.via}); skipping`);
          continue;
        }
        // First term: the page may already be showing this search, so walk what is there.
        status(`results unchanged after searching "${term}"; walking the current results`);
        s.note = "results unchanged (probably already showing this search)";
      }
      label = term;
      await sleep(1500);
    }
    for (let pageNo = 1; pageNo <= CONFIG.maxPagesPerSearch && !stopped; pageNo += 1) {
      await walkPage(label, pageNo);
      if (pageNo === CONFIG.maxPagesPerSearch || stopped) break;
      const move = await goToNextPage();
      pages[pages.length - 1].nextPage = move;
      if (!move.moved) {
        status(`no further page (next control via ${move.via})`);
        break;
      }
      status(`moved to page ${move.to} via ${move.via}`);
      await sleep(1500);
    }
  }

  // ------------------------------------------------------------------ report
  const summary = {
    tilesOpened: results.filter((r) => r.opened).length,
    tilesFailedToOpen: results.filter((r) => !r.opened).length,
    tilesNotFullyReady: results.filter((r) => r.opened && !r.ready).length,
    alreadyApplied: results.filter((r) => r.tileApplied !== "no" || r.detailApplied !== "no").length,
    appliedOnTileButNotDetail: results.filter((r) => r.tileApplied !== "no" && r.detailApplied === "no").length,
    appliedInDetailButNotTile: results.filter((r) => r.tileApplied === "no" && r.detailApplied !== "no").length,
    easyApplyButtons: results.filter((r) => /easy apply/.test(r.applyButton)).length,
    externalApplyButtons: results.filter((r) => r.opened && /^apply\b/.test(r.applyButton) && !/easy/.test(r.applyButton)).length,
    noApplyButton: results.filter((r) => r.opened && r.applyButton === "(none)").length,
    tileIdNotMatchingUrl: results.filter((r) => r.opened && /^\d+$/.test(r.tileJobId) && !r.idMatchesUrl).length,
    avgOpenMs: Math.round(
      results.filter((r) => r.openMs).reduce((s, r) => s + r.openMs, 0) / Math.max(1, results.filter((r) => r.openMs).length),
    ),
    formsOpened: results.filter((r) => r.formDetail?.opened).length,
    formsNotClosed: results.filter((r) => r.formDetail?.opened && !r.formDetail.closed).length,
  };
  const report = { url: location.href, at: new Date().toISOString(), config: CONFIG, summary, searches, pages, results };
  window.__cpWalk = report;

  console.log("%c[walk] done", "font-weight:700;color:#10b981");
  console.table(summary);
  console.table(pages);
  console.table(results.map(({ formDetail, ...r }) => r));
  try {
    if (typeof copy === "function") {
      copy(JSON.stringify(report, null, 2));
      console.log("[walk] Full report copied to clipboard (also in window.__cpWalk). cpProbeClear() removes labels.");
    }
  } catch {
    console.log("[walk] Full report is in window.__cpWalk");
  }
  window.cpProbeClear =
    window.cpProbeClear ||
    (() => {
      document.querySelectorAll("[data-cp-probe]").forEach((el) => {
        el.style.outline = "";
        el.removeAttribute("data-cp-probe");
      });
      document.querySelectorAll(".cp-probe-label").forEach((el) => el.remove());
    });
})();
