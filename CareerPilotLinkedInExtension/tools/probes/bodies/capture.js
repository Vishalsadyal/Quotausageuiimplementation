// Test 3 - capture the HTML of every job card and its details pane.
// For each card on the current results page: saves the card's HTML, opens it, waits until the
// details are fully loaded (CPLinkedInJob.waitForDetails), saves the details HTML plus what the
// readers extracted from it. Everything is downloaded as ONE .json file (too big for the clipboard).
// HTML is shrunk: icons, styles, image URLs and tracking parameters are removed.
// Never clicks Apply, Save or anything inside the details pane.
(async () => {
  // ------------------------------------------------------------------ settings (edit before pasting)
  const CONFIG = {
    maxJobs: 25, // cards to capture on this page
    maxDetailsChars: 25000, // per job, after shrinking
    detailTimeoutMs: 15000,
  };

  const Dom = window.CPLinkedInDom;
  const Pages = window.CPLinkedInPages;
  const Job = window.CPLinkedInJob;
  if (!Dom || !Pages || !Job) return console.error("CPLinkedIn modules missing: paste the whole probe file.");

  let stopped = false;
  window.cpCaptureStop = () => {
    stopped = true;
    console.log("Capture: stopping after this job (the file is still downloaded).");
  };
  console.log("%cAutoApply CV - Test 3: capturing card + details HTML for every job (cpCaptureStop() to stop)", "font-weight:700;color:#6366f1");

  /** outerHTML without icons, styles, classes, image URLs and tracking parameters. */
  function shrink(el, max = Infinity) {
    if (!el) return "";
    const html = el.outerHTML
      .replace(/<svg[\s\S]*?<\/svg>/g, "<svg/>")
      .replace(/<(script|style)[\s\S]*?<\/\1>/g, "")
      .replace(/ (class|style|src|srcset|fetchpriority|data-token-id|data-supported-dps|viewBox|xmlns|d|fill)="[^"]*"/g, "")
      .replace(/((?:[?&]|&amp;)(eBP|trackingId|refId|mt|urlhash|lipi|midToken|trk|upsellOrderOrigin|referenceId)=)[^&"]*/g, "$1x")
      .replace(/\s{2,}/g, " ");
    return html.length > max ? `${html.slice(0, max)}<!-- truncated ${html.length - max} chars -->` : html;
  }

  /** The block that holds the results list: nearest ancestor of the cards that contains them all. */
  function listContainer(tiles) {
    let node = tiles[0]?.parentElement;
    while (node && node !== document.body && !tiles.every((t) => node.contains(t))) node = node.parentElement;
    return node;
  }

  // ------------------------------------------------------------------ page-level structure
  const { found } = await Pages.loadAllCards({ shouldStop: () => stopped });
  Pages.scrollListToTop(Pages.scrollRootOf(found.tiles[0]));
  const list = listContainer(found.tiles);
  const bar = Pages.paginationBar();
  const capture = {
    url: location.href,
    at: new Date().toISOString(),
    userAgent: navigator.userAgent,
    config: CONFIG,
    page: {
      title: document.title,
      cardsFound: found.tiles.length,
      cardStrategy: found.strategy,
      cardAttempts: found.attempts,
      detailPane: (({ strategy, attempts }) => ({ strategy, attempts }))(Dom.findDetailPane({ fresh: true })),
      pageInfo: Pages.currentPageInfo(),
      next: Pages.findNext().results,
      // the list without its cards (separators, banners, upsells) and the pagination bar
      listSkeleton: list ? shrink(list).replace(/<div role="button" tabindex="0" componentkey="job-card-component-ref-[\s\S]*?<hr role="presentation">/g, "<!-- card -->").slice(0, 8000) : "",
      paginationHtml: shrink(bar, 4000),
      filtersHtml: shrink(document.querySelector("#JobsSearchFilters, [componentkey='JobsSearchFilters']"), 6000),
    },
    jobs: [],
  };

  // ------------------------------------------------------------------ every card
  const seen = new Set();
  for (let i = 0; i < found.tiles.length && capture.jobs.length < CONFIG.maxJobs && !stopped; i += 1) {
    const tile = Dom.findJobTiles().tiles[i]; // re-find: LinkedIn re-renders the list
    if (!tile) break;
    const id = Dom.jobIdOf(tile).id;
    if (seen.has(id)) continue;
    seen.add(id);
    const cardHtml = shrink(tile, 8000);
    const jobIdVia = Dom.jobIdOf(tile).via;
    // Same open + full-load wait (+ one re-click if the details stay on the previous job) as the extension.
    const r = await Job.openAndRead(tile, { timeoutMs: CONFIG.detailTimeoutMs, shouldStop: () => stopped });
    const pane = Dom.findDetailPane({ fresh: true });
    capture.jobs.push({
      n: i + 1,
      jobId: r.card.jobId,
      jobIdVia,
      urlJobId: Dom.jobIdFromString(location.href),
      card: r.card,
      cardHtml,
      opened: r.opened,
      clickVia: r.clickVia,
      ready: r.ready,
      sameJob: r.titleMatch,
      retried: r.retried,
      notLoaded: r.missing,
      openMs: r.openMs, // click -> job opened (URL / heading)
      readyMs: r.readyMs, // opened -> details fully loaded
      details: r.details,
      actions: r.actions,
      detailPaneVia: pane.strategy,
      detailsHtml: shrink(pane.element, CONFIG.maxDetailsChars),
    });
    const last = capture.jobs[capture.jobs.length - 1];
    console.log(
      `${last.n}. ${r.card.title} | ${r.card.company} | ${last.opened ? (last.ready ? "captured" : `captured, not fully loaded (${last.notLoaded.join(", ")})`) : "DID NOT OPEN"}` +
        `${last.retried ? " (re-clicked)" : ""} | open ${last.openMs} ms + load ${last.readyMs} ms | details title "${r.details.title}"`,
    );
  }

  // ------------------------------------------------------------------ save
  const json = JSON.stringify(capture, null, 1);
  const name = `linkedin-capture-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 2000);
  } catch (e) {
    console.warn("Download failed; the capture is in window.__cpCapture", e);
  }
  window.__cpCapture = capture;
  const ok = capture.jobs.filter((j) => j.ready).length;
  console.log(
    `RESULT: captured ${capture.jobs.length} jobs (${ok} fully loaded) -> downloaded ${name} (${Math.round(json.length / 1024)} KB). ` +
      "Send that file. Also kept in window.__cpCapture.",
  );
  return `${capture.jobs.length} jobs captured`;
})();
