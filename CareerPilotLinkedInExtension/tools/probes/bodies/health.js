// Probe body (health). Bundled with src/linkedin/core/* by tools/probes/build.mjs.
// Read-only except for opening a few jobs (clicks tiles) and, if enabled, opening + discarding the
// Easy Apply form. It never clicks Next, Review or Submit.
(async () => {
  // ------------------------------------------------------------------ settings (edit before pasting)
  const CONFIG = {
    testOpenJobs: 3, // open this many tiles to test click + full-load timing (0 = skip)
    openEasyApplyForm: false, // true = open the current job's Easy Apply form, list its questions, then discard
    detailTimeoutMs: 15000,
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

  const checks = [];
  const details = {};
  const add = (group, name, status, detail = "", hint = "") => checks.push({ group, check: name, status, detail: String(detail).slice(0, 140), hint });

  // ================================================================== A. page
  const url = new URL(location.href);
  const path = url.pathname;
  const onJobs = /^\/jobs\/(search-results|search|view|collections)\b/.test(path);
  add("A page", "On a LinkedIn Jobs page", onJobs ? "PASS" : "FAIL", path, onJobs ? "" : "Open linkedin.com/jobs and search first");
  add("A page", "Layout", "INFO", path.startsWith("/jobs/search-results") ? "new layout (/jobs/search-results)" : path.startsWith("/jobs/search") ? "classic layout (/jobs/search)" : path);

  const signInLink = Array.from(document.querySelectorAll("a, button")).find((el) => /^sign in$/i.test(norm(el.textContent)) && isVisible(el));
  const meMenu = document.querySelector("img.global-nav__me-photo, [data-control-name='nav.settings'], button[aria-label*='Me' i], img[alt*='photo' i]");
  add("A page", "Logged in to LinkedIn", signInLink ? "FAIL" : meMenu ? "PASS" : "WARN", signInLink ? "a 'Sign in' button is visible" : meMenu ? "profile menu found" : "could not confirm", signInLink ? "Log in to LinkedIn" : "");

  const easyApplyFilter = url.searchParams.get("f_AL") === "true";
  add("A page", "Easy Apply filter (f_AL=true)", easyApplyFilter ? "PASS" : "WARN", `f_AL=${url.searchParams.get("f_AL") || "(none)"}`, easyApplyFilter ? "" : "Without it, many results are external-apply jobs that get skipped");
  add("A page", "Search keywords", url.searchParams.get("keywords") ? "PASS" : "WARN", url.searchParams.get("keywords") || "(none)");

  const limitRe = /reached (the|your)? ?(daily )?(easy apply )?(application )?limit|limit on (easy apply|applications)|you('ve| have) reached the .*limit|try again tomorrow/i;
  const limitEl = Array.from(document.querySelectorAll("[role='alert'], [aria-live], .artdeco-inline-feedback, .artdeco-toast-item, [role='dialog']")).find((el) => limitRe.test(el.innerText || ""));
  add("A page", "LinkedIn daily Easy Apply limit", limitEl ? "FAIL" : "PASS", limitEl ? linesOf(limitEl).slice(0, 2).join(" ") : "no limit banner", limitEl ? "LinkedIn blocks more Easy Apply submissions today; runs will stop" : "");

  try {
    const guard = JSON.parse(sessionStorage.getItem("cpSearchRedirectGuard") || "null");
    const ageS = guard ? Math.round((Date.now() - guard.at) / 1000) : null;
    add("A page", "Search redirect guard", "INFO", guard ? `last redirect ${ageS}s ago` : "no recent redirect");
    details.redirectGuard = guard;
    details.lastSearchUrl = sessionStorage.getItem("cpLastSearchResultsUrl") || "";
  } catch {
    // ignore
  }

  // ================================================================== B. extension
  const panel = document.getElementById("cp-linkedin-copilot-panel");
  add("B extension", "Extension panel on this tab", panel ? "PASS" : "FAIL", panel ? "panel found" : "no panel", panel ? "" : "Enable the extension, reload it at chrome://extensions, then refresh this tab");
  const text = (id) => norm(document.getElementById(id)?.textContent || "");
  if (panel) {
    const logLines = Array.from(panel.querySelectorAll("#cp-log .cp-diag-msg, #cp-log li, #cp-log div.cp-log-line"))
      .map((el) => (el.textContent || "").trim())
      .filter(Boolean);
    const lastLines = logLines.slice(-15);
    details.extensionLog = lastLines;
    const disconnected = logLines.some((l) => /extension was reloaded or updated|context invalidated|refresh this linkedin tab/i.test(l));
    add("B extension", "Connected to the extension", disconnected ? "FAIL" : "PASS", disconnected ? "panel says the extension was reloaded" : "no disconnect message", disconnected ? "Refresh this LinkedIn tab" : "");
    add("B extension", "Run status", "INFO", `${text("cp-status-badge") || "?"} · mode: ${text("cp-run-mode-chip") || "?"}`);
    add("B extension", "Counters", "INFO", `applied ${text("cp-applied-count") || "0"} · skipped ${text("cp-skipped-count") || "0"} · ${text("cp-wallet-text") || "wallet ?"}`);
    const errorLines = logLines.filter((l) => /error|failed|not found|could not|timeout|blocked/i.test(l));
    add("B extension", "Errors in recent log", errorLines.length ? "WARN" : "PASS", errorLines.slice(-3).join(" | ") || "none", errorLines.length ? "See details.extensionLog in the report" : "");
    const skipReasons = {};
    for (const l of logLines) {
      const m = l.match(/^skipped:?\s*\(?([^)]+)\)?/i);
      if (m) skipReasons[norm(m[1]).slice(0, 40)] = (skipReasons[norm(m[1]).slice(0, 40)] || 0) + 1;
    }
    details.skipReasons = skipReasons;
    if (Object.keys(skipReasons).length) add("B extension", "Skip reasons in log", "INFO", Object.entries(skipReasons).map(([k, v]) => `${k}: ${v}`).join(" · "));
  }
  const tagCount = document.querySelectorAll(".cp-card-outcome-tag").length;
  add("B extension", "Tags drawn on job tiles", tagCount ? "PASS" : "INFO", `${tagCount} tags`, tagCount ? "" : "Normal before a run unless some jobs are already applied");

  // ================================================================== C. detection
  if (!Dom) {
    add("C detection", "Detection module", "FAIL", "CPLinkedInDom missing", "Paste the whole probe file");
  } else {
    const found = Dom.findJobTiles();
    details.tileAttempts = found.attempts;
    add("C detection", "Job tiles found", found.tiles.length >= 2 ? "PASS" : "FAIL", `${found.tiles.length} via ${found.strategy}`, found.tiles.length >= 2 ? "" : "LinkedIn layout not recognised: send the tile-probe report");
    const rows = found.tiles.map((t) => {
      const { id, via } = Dom.jobIdOf(t);
      return { id, via, title: norm(Dom.tileTitle(t)).slice(0, 50), easy: Dom.hasEasyApply(t), applied: Dom.appliedMethodOf(t) };
    });
    details.tiles = rows;
    if (rows.length) {
      const realIds = rows.filter((r) => /^\d+$/.test(r.id)).length;
      add("C detection", "Tiles with a real job ID", realIds / rows.length >= 0.8 ? "PASS" : "WARN", `${realIds}/${rows.length} (via ${[...new Set(rows.map((r) => r.via))].join(", ")})`, realIds / rows.length >= 0.8 ? "" : "Jobs fall back to a text fingerprint until opened");
      const dupes = rows.length - new Set(rows.map((r) => r.id)).size;
      add("C detection", "Duplicate job IDs", dupes ? "WARN" : "PASS", `${dupes} duplicates`);
      add("C detection", "Easy Apply tiles", rows.some((r) => r.easy) ? "PASS" : "WARN", `${rows.filter((r) => r.easy).length}/${rows.length}`, rows.some((r) => r.easy) ? "" : "No Easy Apply jobs on this page");
      add("C detection", "Already-applied tiles", "INFO", `${rows.filter((r) => r.applied).length} (${[...new Set(rows.filter((r) => r.applied).map((r) => r.applied))].join(", ") || "none"})`);
    }

    const pane = Dom.findDetailPane({ fresh: true });
    details.detailAttempts = pane.attempts;
    const jobOpen = Boolean(Dom.jobIdFromString(location.href));
    add(
      "C detection",
      "Job details panel",
      pane.element ? "PASS" : jobOpen ? "FAIL" : "WARN",
      pane.element ? `via ${pane.strategy}` : jobOpen ? "a job is open but its panel was not found" : "no job open yet",
      pane.element ? "" : jobOpen ? "LinkedIn layout changed: send the report" : "Re-checked after the live test opens a job",
    );
    if (pane.element) {
      const btn = Dom.findApplyButton(pane.element);
      const label = btn ? norm(btn.getAttribute("aria-label") || btn.textContent).slice(0, 60) : "";
      const appliedVia = Dom.detailAppliedMethod(pane.element);
      add("C detection", "Apply button in details", btn ? "PASS" : appliedVia ? "INFO" : "WARN", label || (appliedVia ? `already applied (${appliedVia})` : "none"), btn || appliedVia ? "" : "Job may be closed or still loading");
      const heading = Dom.jobHeading(pane.element);
      const urlId = Dom.jobIdFromString(location.href);
      add("C detection", "Open job", "INFO", `${heading.slice(0, 60) || "(no heading)"} · url id ${urlId || "-"}`);
      const readiness = Dom.detailReadiness({ jobId: urlId });
      add("C detection", "Open job fully loaded", readiness.ready ? "PASS" : "WARN", readiness.ready ? "ready" : `action=${readiness.action || "none"} loading=${readiness.loading}`);
    }

    // pagination
    const page = Number(norm(Array.from(document.querySelectorAll("[aria-current='true'], [aria-current='page']")).find((el) => /^\d+$/.test(norm(el.textContent)))?.textContent || "1"));
    const controls = Array.from(document.querySelectorAll("button, a")).filter((el) => isVisible(el) && !el.disabled && !el.closest("header, #global-nav, #msg-overlay, [id^='cp-'], .cp-probe-label"));
    const next =
      controls.find((el) => /^(view )?next( page)?\b/.test(norm(el.getAttribute("aria-label")))) ||
      controls.find((el) => norm(el.getAttribute("aria-label")) === `page ${page + 1}` || norm(el.textContent) === String(page + 1)) ||
      controls.find((el) => /^next\b/.test(norm(el.textContent))) ||
      controls.find((el) => /^(see|show|load) more (jobs|results)\b/.test(norm(`${el.getAttribute("aria-label") || ""} ${el.textContent}`)));
    add("C detection", "Next-page control", next ? "PASS" : "WARN", next ? `page ${page} → "${norm(next.getAttribute("aria-label") || next.textContent).slice(0, 30)}"` : `page ${page}, none visible`, next ? "" : "Scroll the results list to the bottom and re-run, or this is the last page");

    // search box
    const inputs = Array.from(document.querySelectorAll("input")).filter((i) => isVisible(i) && i.type !== "hidden");
    const hint = (i) => norm(`${i.getAttribute("aria-label") || ""} ${i.getAttribute("placeholder") || ""}`);
    const search =
      inputs.find((i) => /title|skill|company/.test(hint(i)) && !/location|city/.test(hint(i))) ||
      inputs.find((i) => /describe|job you want|search jobs/.test(hint(i))) ||
      inputs.find((i) => /search/.test(hint(i)) && !/location|city|messag/.test(hint(i)));
    add("C detection", "Job search box", search ? "PASS" : "WARN", search ? hint(search).slice(0, 60) : "not found");

    // ================================================================== D. live tests
    if (CONFIG.testOpenJobs > 0 && found.tiles.length) {
      const opened = [];
      for (const tile of found.tiles.slice(0, CONFIG.testOpenJobs)) {
        if (!tile.isConnected) continue;
        const { id } = Dom.jobIdOf(tile);
        const title = norm(Dom.tileTitle(tile)).slice(0, 50);
        const open = await Dom.openTile(tile, { jobId: id, title });
        const ready = open.opened ? await Dom.waitForJobReady({ jobId: id, title }, { timeoutMs: CONFIG.detailTimeoutMs }) : { ready: false, waitedMs: 0, last: {} };
        opened.push({ title, opened: open.opened, clickVia: open.via || `failed (${open.tried.join(">")})`, ready: ready.ready, ms: ready.waitedMs, action: ready.last?.action || "" });
        await sleep(800);
      }
      details.openTest = opened;
      const ok = opened.filter((o) => o.opened && o.ready).length;
      add("D live", `Open + fully load ${opened.length} jobs`, ok === opened.length ? "PASS" : ok ? "WARN" : "FAIL", opened.map((o) => `${o.opened ? (o.ready ? `${o.ms}ms` : "not ready") : "did not open"}`).join(", "), ok === opened.length ? "" : "See details.openTest (clickVia / action)");
      const after = Dom.findDetailPane({ fresh: true });
      const afterBtn = after.element ? Dom.findApplyButton(after.element) : null;
      add(
        "D live",
        "Details panel + apply button after opening a job",
        after.element && (afterBtn || Dom.detailAppliedMethod(after.element)) ? "PASS" : after.element ? "WARN" : "FAIL",
        after.element ? `panel via ${after.strategy}; button: ${afterBtn ? norm(afterBtn.getAttribute("aria-label") || afterBtn.textContent).slice(0, 40) : Dom.detailAppliedMethod(after.element) || "none"}` : "panel not found",
        after.element ? "" : "LinkedIn layout changed: send the report",
      );
    }

    if (CONFIG.openEasyApplyForm) {
      const paneEl = Dom.findDetailPane({ fresh: true }).element;
      const btn = paneEl ? Dom.findApplyButton(paneEl) : null;
      const label = btn ? norm(btn.getAttribute("aria-label") || btn.textContent) : "";
      if (!btn || !/easy apply/.test(label) || Dom.detailAppliedMethod(paneEl)) {
        add("D live", "Easy Apply form", "INFO", "skipped: open job has no Easy Apply button (or is applied)");
      } else {
        const dialogs = () => Array.from(document.querySelectorAll("[role='dialog'], .artdeco-modal")).filter((d) => isVisible(d) && linesOf(d).length);
        const before = dialogs()[0];
        btn.click();
        const dialog = await waitFor(() => dialogs().find((d) => d !== before), 6000);
        if (!dialog) {
          add("D live", "Easy Apply form opens", "FAIL", "no dialog after clicking Easy Apply", "Daily limit, login wall or LinkedIn changed the form");
        } else {
          await sleep(700);
          const fields = Array.from(dialog.querySelectorAll("input, select, textarea")).filter((f) => f.type !== "hidden" && (isVisible(f) || f.type === "file" || f.type === "radio"));
          const labelFor = (f) => norm(f.labels?.[0]?.textContent || f.getAttribute("aria-label") || f.closest("fieldset")?.querySelector("legend")?.textContent || f.name || f.id).slice(0, 60);
          const fieldRows = fields.map((f) => ({
            label: labelFor(f),
            type: f.tagName === "SELECT" ? "select" : f.type || f.tagName.toLowerCase(),
            required: f.required || f.getAttribute("aria-required") === "true",
            empty: f.type === "radio" || f.type === "checkbox" ? null : !String(f.value || "").trim() || /select an option/i.test(f.value),
          }));
          const progress = (linesOf(dialog).find((l) => /^\d{1,3}%$/.test(l)) || "").trim();
          const buttons = Array.from(dialog.querySelectorAll("button")).map((b) => norm(b.getAttribute("aria-label") || b.textContent).slice(0, 30)).filter(Boolean);
          details.easyApplyForm = { step: norm(dialog.querySelector("h2, h3")?.textContent || ""), progress, fields: fieldRows, buttons };
          add("D live", "Easy Apply form opens", "PASS", `step "${details.easyApplyForm.step.slice(0, 40)}" ${progress}`);
          const emptyRequired = fieldRows.filter((r) => r.required && r.empty);
          add("D live", "Required fields still empty (step 1)", emptyRequired.length ? "WARN" : "PASS", emptyRequired.map((r) => r.label).join(" | ") || "none", emptyRequired.length ? "The extension must fill these from your saved answers" : "");
          add("D live", "Resume upload/select on step 1", fieldRows.some((r) => r.type === "file") || /resume/i.test(dialog.innerText || "") ? "INFO" : "INFO", fieldRows.some((r) => r.type === "file") ? "file upload present" : /resume/i.test(dialog.innerText || "") ? "resume section present" : "none");
          // Close without saving: Dismiss/Close, then Discard. Never Next/Review/Submit.
          const dismiss = Array.from(dialog.querySelectorAll("button")).find((b) => /^(dismiss|close)\b/.test(norm(b.getAttribute("aria-label") || b.textContent)));
          if (dismiss) dismiss.click();
          else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          await sleep(800);
          const confirm = dialogs()[0];
          const discard = confirm && Array.from(confirm.querySelectorAll("button")).find((b) => /^discard\b/.test(norm(b.getAttribute("aria-label") || b.textContent)));
          if (discard) {
            discard.click();
            await sleep(600);
          }
          add("D live", "Easy Apply form closed + discarded", dialogs().length ? "WARN" : "PASS", dialogs().length ? "a dialog is still open" : "closed", dialogs().length ? "Close it manually" : "");
        }
      }
    }
  }

  // ================================================================== report
  const counts = checks.reduce((a, c) => ((a[c.status] = (a[c.status] || 0) + 1), a), {});
  const report = { url: location.href, at: new Date().toISOString(), config: CONFIG, counts, checks, details };
  window.__cpHealth = report;
  const colors = { PASS: "#10b981", WARN: "#f59e0b", FAIL: "#ef4444", INFO: "#64748b" };
  console.log("%cAutoApply CV health check", "font-weight:700;font-size:14px;color:#6366f1");
  console.log(`%cPASS ${counts.PASS || 0}  WARN ${counts.WARN || 0}  FAIL ${counts.FAIL || 0}`, "font-weight:700");
  for (const c of checks.filter((c) => c.status === "FAIL" || c.status === "WARN")) {
    console.log(`%c${c.status}%c ${c.check}: ${c.detail}${c.hint ? `  → ${c.hint}` : ""}`, `color:#fff;background:${colors[c.status]};padding:1px 5px;border-radius:3px`, "");
  }
  console.table(checks);
  if (details.extensionLog?.length) {
    console.log("Last extension log lines:");
    console.table(details.extensionLog.map((line) => ({ line })));
  }
  if (details.openTest) console.table(details.openTest);
  try {
    if (typeof copy === "function") {
      copy(JSON.stringify(report, null, 2));
      console.log("Full report copied to the clipboard (also in window.__cpHealth).");
    }
  } catch {
    console.log("Full report is in window.__cpHealth");
  }
  return `PASS ${counts.PASS || 0} · WARN ${counts.WARN || 0} · FAIL ${counts.FAIL || 0}`;
})();
