// Offline probe: runs the extension's real src/linkedin/core/dom.js against a saved LinkedIn page
// (an HTML snapshot such as tools/probes/out/www.linkedin.com-*.log) and reports whether job cards,
// job ids, titles and applied state are detected. No LinkedIn login or network needed.
//
// Run: node tools/probes/offline-tiles-test.mjs [snapshot-file] [expectedCards]
//   default snapshot = newest www.linkedin.com-*.log in tools/probes/out; expectedCards defaults to the
//   number of distinct componentkey="job-card-component-ref-<id>" values found in the snapshot.
import { readdirSync, readFileSync, statSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const outDir = resolve(here, "out");

function newestSnapshot() {
  const files = readdirSync(outDir)
    .filter((f) => /^www\.linkedin\.com-.*\.log$/.test(f))
    .map((f) => ({ f, t: statSync(resolve(outDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!files.length) throw new Error(`No www.linkedin.com-*.log snapshot in ${outDir}`);
  return resolve(outDir, files[0].f);
}

const snapshot = process.argv[2] ? resolve(process.argv[2]) : newestSnapshot();
const html = readFileSync(snapshot, "utf8");
const refIds = [...new Set([...html.matchAll(/componentkey="job-card-component-ref-(\d+)"/g)].map((m) => m[1]))];
const expected = Number(process.argv[3]) || refIds.length;

const browser = await chromium.launch();
const page = await (await browser.newContext({ bypassCSP: true })).newPage();
await page.setContent(`<!doctype html><html><body>${html}</body></html>`);
await page.addScriptTag({ path: resolve(root, "src/linkedin/core/dom.js") });

const result = await page.evaluate(() => {
  const Dom = globalThis.CPLinkedInDom;
  if (!Dom) return { error: "CPLinkedInDom not defined after loading dom.js" };
  const found = Dom.findJobTiles({});
  const rows = found.tiles.map((tile) => {
    let id = "";
    try { const r = Dom.jobIdOf(tile); id = (r && typeof r === "object" ? r.id : r) || ""; } catch {}
    let title = "";
    try { title = Dom.tileTitle(tile) || ""; } catch {}
    let applied = "";
    try { applied = Dom.appliedMethodOf?.(tile) || ""; } catch {}
    const full = String(title);
    const half = Math.floor(full.length / 2);
    const titleDoubled = full.length > 6 && (full.endsWith(full.slice(Math.ceil(full.length / 2))) && full.indexOf(full.slice(Math.ceil(full.length / 2))) < Math.floor(full.length / 2));
    return { id, title: full.slice(0, 70), titleDoubled, applied };
  });
  return {
    strategy: found.strategy,
    attempts: (found.attempts || []).map((a) => (typeof a === "string" ? a : JSON.stringify(a))),
    tiles: rows,
  };
});
await browser.close();

const checks = [];
const check = (name, ok, detail = "") => checks.push({ name, ok, detail });

if (result.error) {
  check("dom.js loads", false, result.error);
} else {
  const ids = result.tiles.map((t) => t.id).filter(Boolean);
  check("job cards found", result.tiles.length === expected, `found ${result.tiles.length}, expected ${expected} (strategy: ${result.strategy})`);
  check("no card counted twice", new Set(ids).size === ids.length, `${ids.length} ids, ${new Set(ids).size} unique`);
  check("every card has a job id", ids.length === result.tiles.length, `${ids.length}/${result.tiles.length}`);
  const missing = refIds.filter((id) => !ids.includes(id));
  check("ids match componentkey refs", missing.length === 0, missing.length ? `missing: ${missing.slice(0, 5).join(", ")}` : `${refIds.length} refs`);
  const untitled = result.tiles.filter((t) => !t.title).length;
  check("every card has a title", untitled === 0, `${untitled} without title`);
  // LinkedIn renders the title twice (visually-hidden "Selected, X" + aria-hidden "X"); a clean title has no repeat.
  const doubled = result.tiles.filter((t) => t.title && t.titleDoubled);
  check("titles are not doubled", doubled.length === 0, doubled.length ? `${doubled.length} doubled, e.g. "${doubled[0].title}"` : "");
}

console.log(`Snapshot: ${snapshot}`);
if (!result.error) {
  console.log(`Strategy: ${result.strategy}`);
  if (result.attempts.length) console.log(`Attempts: ${result.attempts.join(" | ")}`);
  console.table(result.tiles.slice(0, 10));
}
for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` - ${c.detail}` : ""}`);
process.exit(checks.every((c) => c.ok) ? 0 : 1);
