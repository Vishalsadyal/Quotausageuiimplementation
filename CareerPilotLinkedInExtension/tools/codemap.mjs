// Generates docs/CODE_MAP.md: where every piece of extension code lives.
//   - a dependency map (which LinkedIn Jobs part calls functions defined in which other part)
//   - every source file with its purpose (from its header comment) and every top-level function + line
//
// Run: npm run codemap   (also runs as part of npm run build)
import { parseAst } from "rollup/parseAst";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const rel = (p) => relative(root, p).replace(/\\/g, "/");
const lineOf = (src, pos) => src.slice(0, pos).split("\n").length;

/** First block comment of a file, flattened to one paragraph (the file's purpose). */
function purposeOf(src) {
  const m = src.match(/^\s*\/\*([\s\S]*?)\*\//);
  if (!m) return "";
  return m[1]
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, "").trim())
    .filter((l) => l && !/^LinkedIn Jobs auto-apply - part|^Plain content script|^Functions here may call|^Map of all parts/.test(l))
    .join(" ");
}

/** Top-level functions (incl. those inside an IIFE module wrapper) with line numbers. */
function functionsOf(src) {
  let ast;
  try {
    ast = parseAst(src);
  } catch {
    return { fns: [], ast: null };
  }
  const fns = [];
  const visit = (body) => {
    for (const n of body) {
      if (n.type === "FunctionDeclaration") fns.push({ name: n.id.name, line: lineOf(src, n.start) });
      // (function init(global) { ... })(...) or (() => { ... })()
      if (n.type === "ExpressionStatement" && n.expression.type === "CallExpression") {
        const callee = n.expression.callee;
        if (/Function/.test(callee.type) && callee.body?.type === "BlockStatement") visit(callee.body.body);
      }
    }
  };
  visit(ast.body);
  return { fns, ast };
}

// ---------------------------------------------------------------- files, in manifest load order first
const loadOrder = [
  manifest.background.service_worker,
  ...manifest.content_scripts.flatMap((c) => c.js || []),
  manifest.action?.default_popup?.replace(/\.html$/, ".js"),
  manifest.options_page?.replace(/\.html$/, ".js"),
].filter(Boolean);
const allJs = walk(join(root, "src")).filter((p) => p.endsWith(".js")).map(rel);
const files = [...new Set([...loadOrder.filter((f) => allJs.includes(f)), ...allJs.sort()])];

const info = files.map((file) => {
  const src = readFileSync(join(root, file), "utf8");
  const { fns, ast } = functionsOf(src);
  return { file, src, ast, fns, lines: src.split("\n").length, purpose: purposeOf(src) };
});

// where each content-script trigger runs
const runsOn = new Map();
for (const c of manifest.content_scripts) for (const f of c.js || []) runsOn.set(f, c.matches.join(", "));
runsOn.set(manifest.background.service_worker, "background service worker");

// ---------------------------------------------------------------- dependency map of the LinkedIn Jobs parts
const parts = info.filter((i) => /^src\/linkedin\/(jobs|core)\//.test(i.file));
const definedIn = new Map();
for (const p of parts) for (const f of p.fns) if (!p.file.includes("/core/")) definedIn.set(f.name, p.file);
const edges = new Map();
for (const p of parts) {
  if (!p.ast) continue;
  const used = new Set();
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.type === "CallExpression" && node.callee.type === "Identifier") used.add(node.callee.name);
    for (const k of Object.keys(node)) if (k !== "type") visit(node[k]);
  };
  visit(p.ast);
  for (const name of used) {
    const target = definedIn.get(name);
    if (target && target !== p.file) {
      const key = `${p.file}|${target}`;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  if (/CPLinkedInDom\./.test(p.src)) edges.set(`${p.file}|src/linkedin/core/dom.js`, (p.src.match(/CPLinkedInDom\./g) || []).length);
  if (/CPLinkedInPages\./.test(p.src)) edges.set(`${p.file}|src/linkedin/core/pages.js`, (p.src.match(/CPLinkedInPages\./g) || []).length);
}
const short = (f) => f.replace(/^src\/linkedin\/(jobs|core)\//, "").replace(/\.js$/, "");
const nodeId = (f) => short(f).replace(/[^a-zA-Z0-9]/g, "_");
// Keep the diagram readable: the strongest links of each part (top 3) plus everything with 4+ calls.
const byFrom = new Map();
for (const [key, count] of edges) {
  const [from] = key.split("|");
  if (!byFrom.has(from)) byFrom.set(from, []);
  byFrom.get(from).push([key, count]);
}
const shown = [];
for (const list of byFrom.values()) {
  list.sort((a, b) => b[1] - a[1]);
  list.forEach(([key, count], i) => {
    if (i < 3 || count >= 4) shown.push([key, count]);
  });
}

const mermaid = [
  "```mermaid",
  "flowchart LR",
  '  subgraph core["src/linkedin/core (shared, also bundled into the probes)"]',
  ...parts.filter((p) => p.file.includes("/core/")).map((p) => `    ${nodeId(p.file)}["${short(p.file)}"]`),
  "  end",
  '  subgraph jobs["src/linkedin/jobs (auto-apply content script, loads 01 → 29)"]',
  ...parts.filter((p) => p.file.includes("/jobs/")).map((p) => `    ${nodeId(p.file)}["${short(p.file)}"]`),
  "  end",
  ...shown.map(([key, count]) => {
    const [from, to] = key.split("|");
    return `  ${nodeId(from)} -->|${count}| ${nodeId(to)}`;
  }),
  "```",
];

// ---------------------------------------------------------------- markdown
const out = [];
out.push("# AutoApply CV extension - code map");
out.push("");
out.push("_Generated by `tools/codemap.mjs` (`npm run codemap`). Do not edit by hand._");
out.push("");
out.push("## Folders");
out.push("");
out.push("| Folder | What lives there |");
out.push("| --- | --- |");
const FOLDERS = {
  "src/background": "Service worker: storage, settings, portal API calls, message hub for every content script.",
  "src/linkedin/core": "Shared, class-free LinkedIn detection (cards, job ids, applied state, details pane, apply button, pagination). Also bundled into the console probes.",
  "src/linkedin/jobs": "LinkedIn Jobs auto-apply content script, split into numbered parts that load in order and share one scope.",
  "src/linkedin/outreach": "LinkedIn outreach widgets: WhatsApp leads, email leads, auto-commenter, HR leads (feed/search pages; idle on /jobs).",
  "src/indeed": "Indeed auto-apply content script + panel styles.",
  "src/whatsapp": "WhatsApp Web sender.",
  "src/gmail": "Gmail sender.",
  "src/meet": "Google Meet interview copilot.",
  "src/dashboard": "Bridge between the AutoApply CV web dashboard and the extension.",
  "src/ui": "Toolbar popup and options page.",
  "src/rules": "declarativeNetRequest rules (optional LinkedIn tracker blocking).",
  "src/assets": "Fonts and images.",
  "tools/probes": "Paste-into-console test scripts, built from src/linkedin/core + tools/probes/bodies (`npm run probe` → tools/probes/out).",
  "tools/console": "Standalone console helpers (clear location filter, console-noise debugger).",
};
for (const [folder, what] of Object.entries(FOLDERS)) out.push(`| \`${folder}\` | ${what} |`);
out.push("");
out.push("## LinkedIn Jobs: who calls whom");
out.push("");
out.push("Arrows point from the caller to the part that defines the function; the number is how many different functions are called. Only the strongest links are drawn.");
out.push("");
out.push(...mermaid);
out.push("");
out.push("## Files and functions");
out.push("");
out.push("Files are listed in load order. Click a function to jump to it.");
for (const i of info) {
  out.push("");
  out.push(`### [${i.file}](../${i.file}) · ${i.lines} lines`);
  if (runsOn.get(i.file)) out.push(`Runs on: ${runsOn.get(i.file)}`);
  if (i.purpose) {
    out.push("");
    out.push(i.purpose);
  }
  if (i.fns.length) {
    out.push("");
    out.push(i.fns.map((f) => `[\`${f.name}\`](../${i.file}#L${f.line})`).join(" · "));
  }
}
out.push("");
mkdirSync(join(root, "docs"), { recursive: true });
writeFileSync(join(root, "docs", "CODE_MAP.md"), out.join("\n"));
console.log(`Wrote docs/CODE_MAP.md (${info.length} files, ${info.reduce((a, i) => a + i.fns.length, 0)} functions, ${shown.length} links drawn)`);
