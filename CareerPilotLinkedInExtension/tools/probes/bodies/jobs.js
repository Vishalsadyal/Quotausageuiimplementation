// Test 2 - open every job card and read its facts.
// For each card on the current results page: read title / company / location / posted time from the
// card, click it, smart-wait until the job's details are loaded, read the same facts from the
// details pane, and check they belong to the same job. Also lists every button in the details pane. Uses CPLinkedInJob.openAndRead: the exact
// code the extension runs. Never clicks Apply, Next (in a form) or Submit.
(async () => {
  // ------------------------------------------------------------------ settings (edit before pasting)
  const CONFIG = {
    maxJobs: 25, // cards to open on this page
    pages: 1, // results pages to cover (uses the same next-page code as test 1)
    detailTimeoutMs: 15000,
  };

  const Dom = window.CPLinkedInDom;
  const Pages = window.CPLinkedInPages;
  const Job = window.CPLinkedInJob;
  if (!Dom || !Pages || !Job) return console.error("CPLinkedIn modules missing: paste the whole probe file.");

  let stopped = false;
  window.cpJobsStop = () => {
    stopped = true;
    console.log("Jobs probe: stopping after this job.");
  };
  console.log("%cAutoApply CV - Test 2: open every job card and read title, company, location, posted time (cpJobsStop() to stop)", "font-weight:700;color:#6366f1");

  const rows = [];
  const seen = new Set();
  let endReason = "done";

  for (let p = 0; p < CONFIG.pages && !stopped; p += 1) {
    const { found } = await Pages.loadAllCards({ shouldStop: () => stopped });
    Pages.scrollListToTop(Pages.scrollRootOf(found.tiles[0]));
    const pageNo = Pages.currentPageInfo().page;
    const total = found.tiles.length;
    let done = 0;
    for (let i = 0; i < total && done < CONFIG.maxJobs && !stopped; i += 1) {
      // Re-find cards each time: LinkedIn re-renders the list while jobs open.
      const tile = Dom.findJobTiles().tiles[i];
      if (!tile) break;
      const id = Dom.jobIdOf(tile).id;
      if (seen.has(id)) continue;
      seen.add(id);
      const r = await Job.openAndRead(tile, { timeoutMs: CONFIG.detailTimeoutMs, shouldStop: () => stopped });
      done += 1;
      const row = {
        page: pageNo,
        n: i + 1,
        jobId: r.card.jobId,
        title: r.card.title,
        company: r.card.company,
        location: r.card.location,
        workplace: r.card.workplace || r.details.workplace,
        posted: r.card.posted || r.details.posted,
        salary: r.card.salary || r.details.salary,
        jobType: r.details.jobType,
        badges: r.card.badges.join(", "),
        easyApply: r.card.easyApply,
        applied: r.card.applied,
        opened: r.opened,
        ready: r.ready,
        sameJob: r.titleMatch,
        notLoaded: r.missing.join(", "),
        "details:title": r.details.title,
        "details:company": r.details.company,
        "details:location": r.details.location,
        "details:posted": r.details.posted,
        applicants: r.details.applicants,
        descriptionChars: r.details.descriptionChars,
        closed: r.details.closed,
        applyButton: (r.actions.find((a) => ["easy-apply", "apply", "applied"].includes(a.kind)) || {}).label || (r.details.closed ? "(closed)" : ""),
        buttons: r.actions.map((a) => `${a.label} [${a.kind}${a.disabled ? ", disabled" : ""}]`).join(" · "),
        clickVia: r.clickVia,
        openMs: r.openMs,
        readyMs: r.readyMs,
        via: `card ${Object.entries(r.card.via).map(([k, v]) => `${k}:${v}`).join(" ")} | details ${Object.entries(r.details.via).map(([k, v]) => `${k}:${v}`).join(" ")}`,
        cardLines: r.card.lines,
      };
      rows.push(row);
      const missingFacts = ["title", "company", "location", "posted"].filter((k) => !row[k] && !row[`details:${k}`]);
      console.log(
        `${row.n}. ${row.title || "?"} | ${row.company || "?"} | ${row.location || "?"} | ${row.posted || "?"}` +
          `${row.salary ? ` | ${row.salary}` : ""}${row.jobType ? ` | ${row.jobType}` : ""}` +
          `${row.opened ? (row.ready ? ` | fully loaded in ${row.openMs + row.readyMs} ms` : ` | NOT FULLY LOADED (missing: ${row.notLoaded})`) : ` | DID NOT OPEN (clicked: ${row.clickVia})`}` +
          `${row.opened && !row.sameJob ? ` | DETAILS SHOW ANOTHER JOB: "${row["details:title"] || "(no title read)"}"` : ""}${missingFacts.length ? ` | facts not found: ${missingFacts.join(", ")}` : ""}`,
      );
      console.log(`   buttons: ${row.buttons || "(none found)"}${row.badges ? `   badges: ${row.badges}` : ""}`);
      // Full diagnostics for the first few problems only (keeps the console readable).
      if (r.diag && rows.filter((x) => x.diag).length < 3) {
        row.diag = r.diag;
        console.warn(`   diagnostics for #${row.n}: ${JSON.stringify(r.diag)}`);
      } else if (r.diag) {
        row.diag = r.diag;
      }
    }
    if (stopped) {
      endReason = "stopped by you";
      break;
    }
    if (p + 1 < CONFIG.pages) {
      const { chosen } = Pages.findNext();
      if (!chosen) {
        endReason = "no next page";
        break;
      }
      const moved = await Pages.goNext(chosen, { shouldStop: () => stopped });
      if (!moved.moved) {
        endReason = moved.endOfResults ? "last page" : `next page failed: ${moved.reason}`;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ report
  const count = (f) => rows.filter(f).length;
  const has = (k) => count((r) => r[k] || r[`details:${k}`]);
  const summary = {
    jobs: rows.length,
    opened: count((r) => r.opened),
    ready: count((r) => r.ready),
    sameJob: count((r) => r.opened && r.sameJob),
    title: has("title"),
    company: has("company"),
    location: has("location"),
    posted: has("posted"),
    applyState: count((r) => r.applyButton),
    endReason,
  };
  const all = rows.length;
  // Which button kinds were seen, and on how many jobs ("easy-apply 18 · save 22 · share 22 ...").
  const kinds = {};
  for (const r of rows) for (const k of new Set((r.buttons.match(/\[([a-z-]+)/g) || []).map((m) => m.slice(1)))) kinds[k] = (kinds[k] || 0) + 1;
  summary.buttonKinds = Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ");
  const notLoaded = {};
  for (const r of rows) for (const m of r.notLoaded ? r.notLoaded.split(", ") : []) notLoaded[m] = (notLoaded[m] || 0) + 1;
  summary.notLoaded = Object.entries(notLoaded).map(([k, v]) => `${k} ${v}`).join(" · ");
  summary.pass =
    all > 0 && summary.opened === all && summary.ready === all && summary.sameJob === all && summary.title === all && summary.company === all &&
    summary.applyState === all && summary.location >= all * 0.9 && summary.posted >= all * 0.8
      ? "PASS"
      : "CHECK";
  const report = { url: location.href, at: new Date().toISOString(), config: CONFIG, summary, rows };
  window.__cpJobs = report;
  console.log(
    `RESULT ${summary.pass}: ${all} jobs, opened ${summary.opened}, fully loaded ${summary.ready}, same job in details ${summary.sameJob}; ` +
      `found title ${summary.title}/${all}, company ${summary.company}/${all}, location ${summary.location}/${all}, posted ${summary.posted}/${all}, apply button ${summary.applyState}/${all}`,
  );
  console.log(`BUTTONS seen in the details panel (on how many jobs): ${summary.buttonKinds || "none"}`);
  if (summary.notLoaded) console.log(`NOT LOADED (what was missing, on how many jobs): ${summary.notLoaded}`);
  console.table(rows.map(({ via, cardLines, diag, ...r }) => r));
  try {
    if (typeof copy === "function") {
      copy(JSON.stringify(report, null, 2));
      console.log("Report copied to the clipboard (also in window.__cpJobs).");
    }
  } catch {
    console.log("Report is in window.__cpJobs");
  }
  return `${summary.pass}: ${all} jobs`;
})();
