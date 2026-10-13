// Test 1 - job cards + pagination.
// Uses CPLinkedInDom (cards) and CPLinkedInPages (loading, page number, next page): the exact
// functions the extension calls, so what passes here works in a real run.
// Never opens a job, never applies.
(async () => {
  // ------------------------------------------------------------------ settings (edit before pasting)
  const CONFIG = {
    maxPages: 40, // safety stop
    pageLoadTimeoutMs: 15000, // wait this long for the next page's cards
    settleMs: 1200, // cards must stop changing for this long before counting
  };

  const Dom = window.CPLinkedInDom;
  const Pages = window.CPLinkedInPages;
  if (!Dom || !Pages) return console.error("CPLinkedInDom / CPLinkedInPages missing: paste the whole probe file.");

  let stopped = false;
  window.cpPagesStop = () => {
    stopped = true;
    console.log("Pages probe: stopping after this step.");
  };
  console.log("%cAutoApply CV - Test 1: job cards on every page until the last page (cpPagesStop() to stop)", "font-weight:700;color:#6366f1");

  /** What the page looks like when cards were not found: helps fix detection on a new layout. */
  function diagnose(found) {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const items = Array.from(document.querySelectorAll("main li"));
    return {
      url: location.href,
      attempts: found.attempts,
      jobLinks: document.querySelectorAll("a[href*='/jobs/view/'], a[href*='currentJobId=']").length,
      listItems: items.length,
      emptyListItems: items.filter((li) => !String(li.textContent || "").trim()).length,
      loadersVisible: !window.CPLinkedInWait.noLoaders(document.body),
      noResultsText: /no (matching )?jobs found|no results/i.test(document.body.innerText || ""),
      pageButtons: Array.from(document.querySelectorAll("button, a"))
        .filter((el) => /^\d+$/.test(String(el.textContent || "").trim()) && visible(el))
        .map((el) => `${el.textContent.trim()}${el.getAttribute("aria-current") === "true" ? "*" : ""}`)
        .join(" "),
    };
  }

  const pages = [];
  const allIds = new Set();
  let endReason = "max pages reached";

  for (let i = 0; i < CONFIG.maxPages; i += 1) {
    if (stopped) {
      endReason = "stopped by you";
      break;
    }
    // 1. load every card on this page (LinkedIn lazy-loads them while scrolling)
    const { found, scrollRoot, waitedForFirstCardsMs, reason, ms: loadAllMs } = await Pages.loadAllCards({ settleMs: CONFIG.settleMs, shouldStop: () => stopped });
    const info = Pages.currentPageInfo();
    const rows = found.tiles.map((t) => ({ id: Dom.jobIdOf(t).id, easy: Dom.hasEasyApply(t), applied: Boolean(Dom.appliedMethodOf(t)) }));
    const repeats = rows.filter((r) => allIds.has(r.id)).length;
    rows.forEach((r) => allIds.add(r.id));

    // 2. find the next-page control (every strategy reported)
    const { chosen, results } = Pages.findNext(info);
    const row = {
      page: info.page,
      of: info.total || "?",
      pageVia: info.via,
      cards: rows.length,
      cardsVia: found.strategy,
      realIds: rows.filter((r) => /^\d+$/.test(r.id)).length,
      easyApply: rows.filter((r) => r.easy).length,
      applied: rows.filter((r) => r.applied).length,
      seenBefore: repeats,
      scroll: scrollRoot,
      firstCardsMs: waitedForFirstCardsMs,
      loadAllMs,
      next: chosen ? chosen.via : "none",
      ...Object.fromEntries(Object.entries(results).map(([k, v]) => [`next:${k}`, v])),
    };
    pages.push(row);
    console.log(`Page ${info.page}${info.total ? `/${info.total}` : ""}: ${rows.length} cards via ${found.strategy} · next: ${row.next}`);

    // 3. stop conditions
    if (!rows.length) {
      endReason = `no job cards found on this page (waited ${waitedForFirstCardsMs} ms: ${reason || "none"})`;
      row.diag = diagnose(found);
      console.warn(`No cards found. Diagnostics: ${JSON.stringify(row.diag)}`);
      break;
    }
    if (info.total && info.page >= info.total) {
      endReason = `last page (${info.page} of ${info.total})`;
      break;
    }
    if (!chosen) {
      endReason =
        results.bar === "found"
          ? `last page (page ${info.page}: the pagination bar has no Next)`
          : "no enabled next-page control (single page, or pagination not recognised)";
      break;
    }

    // 4. go to the next page and wait for new cards
    const moved = await Pages.goNext(chosen, {
      beforeIds: new Set(rows.slice(0, 5).map((r) => r.id)),
      timeoutMs: CONFIG.pageLoadTimeoutMs,
      shouldStop: () => stopped,
    });
    row.loadMs = moved.ms;
    row.reactMs = moved.reactMs;
    row.cardsMs = moved.cardsMs;
    row.waitNote = moved.waitNote || "";
    if (!moved.moved && moved.endOfResults) {
      endReason = `last page (page ${info.page}: LinkedIn shows "no matching jobs" after it)`;
      break;
    }
    if (!moved.moved) {
      endReason = `clicked next (${chosen.via}): ${moved.reason} after ${moved.ms} ms (url changed: ${moved.urlChanged}, cards: ${moved.cards})`;
      row.diag = diagnose(Dom.findJobTiles());
      console.warn(`Next page did not load: ${moved.reason}. Diagnostics: ${JSON.stringify(row.diag)}`);
      break;
    }
  }

  // ------------------------------------------------------------------ report
  const summary = {
    pagesVisited: pages.length,
    lastPage: pages.at(-1)?.page,
    totalPages: pages.at(-1)?.of,
    uniqueJobs: allIds.size,
    endReason,
    pass: pages.length > 0 && pages.every((p) => p.cards > 0) && /^last page|^no enabled next/.test(endReason) ? "PASS" : "CHECK",
  };
  const report = { url: location.href, at: new Date().toISOString(), config: CONFIG, summary, pages };
  window.__cpPages = report;
  console.log("%cResult", "font-weight:700");
  console.log(`RESULT ${summary.pass}: ${summary.pagesVisited} pages, ${summary.uniqueJobs} jobs. Stopped because: ${endReason}`);
  console.log(pages.map((p) => `page ${p.page}: ${p.cards} cards (${p.cardsVia}), next=${p.next}, scroll ${p.loadAllMs} ms, next ${p.loadMs ?? "-"} ms (react ${p.reactMs ?? "-"} + cards ${p.cardsMs ?? "-"})${p.waitNote ? ` [${p.waitNote}]` : ""}`).join(" | "));
  console.table([summary]);
  console.table(pages);
  try {
    if (typeof copy === "function") {
      copy(JSON.stringify(report, null, 2));
      console.log("Report copied to the clipboard (also in window.__cpPages).");
    }
  } catch {
    console.log("Report is in window.__cpPages");
  }
  return `${summary.pass}: ${pages.length} pages · ${allIds.size} jobs · ${endReason}`;
})();
