// Live check of job card detection on the current LinkedIn Jobs page (read-only, never clicks anything).
(() => {
  const Dom = window.CPLinkedInDom;
  const found = Dom.findJobTiles({});
  const rows = found.tiles.map((tile) => {
    const r = Dom.jobIdOf(tile);
    const id = (r && typeof r === "object" ? r.id : r) || "";
    const title = String(Dom.tileTitle(tile) || "");
    const tail = title.slice(Math.ceil(title.length / 2));
    const doubled = title.length > 6 && title.endsWith(tail) && title.indexOf(tail) < Math.floor(title.length / 2);
    return { id, title: title.slice(0, 70), doubled };
  });
  const ids = rows.map((r) => r.id).filter(Boolean);
  const checks = [
    ["job cards found", rows.length > 0, `${rows.length} (strategy: ${found.strategy})`],
    ["no card counted twice", new Set(ids).size === ids.length, `${ids.length} ids, ${new Set(ids).size} unique`],
    ["every card has a job id", ids.length === rows.length, `${ids.length}/${rows.length}`],
    ["every card has a title", rows.every((r) => r.title), `${rows.filter((r) => !r.title).length} without title`],
    ["titles are not doubled", !rows.some((r) => r.doubled), `${rows.filter((r) => r.doubled).length} doubled`],
  ];
  console.table(rows.slice(0, 15));
  for (const [name, ok, detail] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${name} - ${detail}`);
  window.__cpCards = { strategy: found.strategy, rows, checks };
  console.log("Result kept in window.__cpCards");
})();
