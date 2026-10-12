// Probe report body. Combined with src/linkedin-dom.js by tools/build-probe.mjs.
(() => {
  const Dom = window.CPLinkedInDom;
  const norm = (t) => String(t || "").toLowerCase().replace(/\s+/g, " ").trim();
  const linesOf = (el) => String(el?.innerText || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const cssPath = (el) => {
    const parts = [];
    for (let n = el; n && n !== document.body && parts.length < 6; n = n.parentElement) {
      let part = n.tagName.toLowerCase();
      const cls = String(n.className || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) part += "." + cls.join(".");
      const vn = n.getAttribute("data-view-name");
      if (vn) part += `[data-view-name="${vn}"]`;
      parts.unshift(part);
    }
    return parts.join(" > ");
  };
  const trimHtml = (el, max = 2500) =>
    el ? el.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, "<svg/>").replace(/\s+/g, " ").slice(0, max) : "";

  // 1. Tiles: run the whole chain, then also report every strategy on its own.
  const result = Dom.findJobTiles();
  const pane = Dom.findDetailPane();

  // 2. Per tile: job id chain, applied chain, easy apply.
  const rows = result.tiles.map((tile, i) => {
    const { id, via } = Dom.jobIdOf(tile);
    const applied = Dom.appliedReport(tile);
    const lines = linesOf(tile);
    return {
      i,
      jobId: id || "(none)",
      idVia: via,
      title: norm(lines[0] || "").slice(0, 45),
      applied: applied.length ? applied.join("+") : "no",
      easyApply: Dom.hasEasyApply(tile),
      shortLines: lines.filter((l) => l.length <= 40).slice(0, 6).join(" | "),
      _el: tile,
    };
  });

  // 3. Detail pane.
  const applyBtn = pane.element ? Dom.findApplyButton(pane.element) : null;
  const detail = {
    foundVia: pane.strategy,
    attempts: pane.attempts,
    path: pane.element ? cssPath(pane.element) : "",
    applyButton: applyBtn ? norm(applyBtn.getAttribute("aria-label") || applyBtn.textContent).slice(0, 60) : "(none)",
    appliedVia: Dom.detailAppliedMethod(pane.element) || "no",
    urlJobId: Dom.jobIdFromString(location.href) || "",
  };

  // 4. Raw page facts, useful when every strategy fails.
  const viewNameCounts = {};
  for (const el of document.querySelectorAll("[data-view-name]")) {
    const v = el.getAttribute("data-view-name");
    viewNameCounts[v] = (viewNameCounts[v] || 0) + 1;
  }
  const idAttrs = {};
  for (const el of document.querySelectorAll("body *")) {
    for (const attr of el.attributes) {
      if (attr.name === "style" || attr.name === "class") continue;
      const m = String(attr.value).match(/(?:^|\D)(\d{9,11})(?:\D|$)/);
      if (!m) continue;
      const entry = (idAttrs[attr.name] ||= { count: 0, ids: new Set(), samples: [] });
      entry.count += 1;
      entry.ids.add(m[1]);
      if (entry.samples.length < 3) entry.samples.push(`${el.tagName.toLowerCase()} ${attr.name}="${String(attr.value).slice(0, 120)}"`);
    }
  }
  const appliedLines = [];
  for (const el of document.querySelectorAll("span, li, p, div, time, strong, small")) {
    if (el.childElementCount === 0 && Dom.isAppliedLine(el.textContent)) {
      appliedLines.push({ text: norm(el.textContent), path: cssPath(el) });
      if (appliedLines.length >= 10) break;
    }
  }
  const page = {
    pathname: location.pathname,
    viewNameCounts,
    idAttributes: Object.fromEntries(
      Object.entries(idAttrs)
        .map(([k, v]) => [k, { count: v.count, distinctIds: v.ids.size, samples: v.samples }])
        .sort((a, b) => b[1].distinctIds - a[1].distinctIds)
        .slice(0, 15),
    ),
    appliedLines,
  };

  // 5. Outlines: green = applied, orange = not applied, red = no stable job id.
  window.cpProbeClear = () => {
    document.querySelectorAll("[data-cp-probe]").forEach((el) => {
      el.style.outline = "";
      el.removeAttribute("data-cp-probe");
    });
    document.querySelectorAll(".cp-probe-label").forEach((el) => el.remove());
  };
  window.cpProbeClear();
  for (const r of rows) {
    const color = r.jobId === "(none)" || r.idVia === "text-hash" ? "#ef4444" : r.applied !== "no" ? "#10b981" : "#f59e0b";
    r._el.style.outline = `3px solid ${color}`;
    r._el.setAttribute("data-cp-probe", "1");
    const label = document.createElement("div");
    label.className = "cp-probe-label";
    label.textContent = `#${r.i} ${r.applied !== "no" ? `APPLIED (${r.applied})` : "not applied"} · id via ${r.idVia}`;
    label.style.cssText = `font:700 11px/1.4 system-ui;color:#fff;background:${color};padding:1px 6px;border-radius:4px;width:fit-content;margin:2px 0;`;
    r._el.prepend(label);
  }
  if (pane.element) {
    pane.element.style.outline = "3px dashed #6366f1";
    pane.element.setAttribute("data-cp-probe", "1");
  }

  const report = {
    url: location.href,
    at: new Date().toISOString(),
    domModuleVersion: Dom.version,
    tiles: { foundVia: result.strategy, attempts: result.attempts, total: rows.length },
    appliedTiles: rows.filter((r) => r.applied !== "no").length,
    tilesWithoutStableId: rows.filter((r) => r.jobId === "(none)" || r.idVia === "text-hash").length,
    detail,
    cards: rows.map(({ _el, ...rest }) => rest),
    page,
    sampleTileHtml: trimHtml(result.tiles[0]),
    sampleDetailHtml: trimHtml(pane.element, 1500),
  };
  window.__cpProbe = report;

  console.log("%cAutoApply CV tile probe", "font-weight:700;font-size:14px;color:#6366f1");
  console.log(`Tiles via: ${result.strategy} | tiles: ${rows.length} | applied: ${report.appliedTiles} | no stable id: ${report.tilesWithoutStableId}`);
  console.log("Tile strategies (first with 2+ tiles wins):");
  console.table(result.attempts);
  console.table(report.cards);
  console.log(`Detail pane via: ${pane.strategy}`);
  console.table(pane.attempts);
  console.log("Detail:", detail);
  console.log("Page facts:", page);
  try {
    if (typeof copy === "function") {
      copy(JSON.stringify(report, null, 2));
      console.log("Full report copied to clipboard (also in window.__cpProbe). Run cpProbeClear() to remove outlines.");
    }
  } catch {
    console.log("Full report is in window.__cpProbe");
  }
  return `${rows.length} tiles via ${result.strategy}`;
})();
