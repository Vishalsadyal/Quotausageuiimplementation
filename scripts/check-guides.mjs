// Fails when a live guide (src/lib/guides.ts) points at something the dashboard no longer has: a `data-guide`
// marker nobody defines, a page that is not a route, or a malformed step. Run: npm run guides:check
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const ts = createRequire(import.meta.url)("typescript");

// the real guides (guides.ts has no imports, so it can be loaded on its own)
const js = ts.transpileModule(read("src/lib/guides.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function("module", "exports", js)(mod, mod.exports);
const { GUIDES } = mod.exports;

// ── every marker the dashboard defines ─────────────────────────────────────────
const defined = new Set();
const walk = (dir) => {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel);
    else if (/\.tsx$/.test(entry.name)) for (const m of read(rel).matchAll(/data-guide="([a-z0-9-]+)"/g)) defined.add(m[1]);
  }
};
walk("src/app");

const layout = read("src/app/layouts/DashboardLayout.tsx");
const navBlock = layout.slice(layout.indexOf("const navigation = ["), layout.indexOf("];", layout.indexOf("const navigation = [")));
for (const m of navBlock.matchAll(/name:\s*'([^']+)'/g)) defined.add(`nav-${m[1].toLowerCase().replace(/[^a-z0-9]+/g, "-")}`); // data-guide={`nav-${...}`}
const sections = read("src/app/pages/dashboard/jobsSections.ts");
const sectionIds = [...sections.matchAll(/id:\s*"(\w+)",\s*slug:\s*"([\w-]*)"/g)];
for (const [, id] of sectionIds) defined.add(`sub-${id}`); // data-guide={`sub-${sub.id}`}
if (/id:\s*'applications'/.test(layout)) defined.add("sub-applications");
const jobs = read("src/app/pages/dashboard/Jobs.tsx");
const modulesAt = jobs.indexOf("const extensionSuiteModules = [");
for (const m of jobs.slice(modulesAt, modulesAt + 6000).matchAll(/\{\s*id:\s*"(\w+)",\s*name:/g)) defined.add(`launch-${m[1]}`); // data-guide={`launch-${module.id}`}

// ── routes a step can be on ─────────────────────────────────────────────────────
const app = read("src/app/App.tsx");
const jobSlugs = new Set(sectionIds.map(([, , slug]) => slug).filter(Boolean));
const routeExists = (page) => {
  const rest = page.replace(/^\/dashboard\/?/, "");
  if (!rest) return true;
  const parts = rest.split("/");
  if (parts[0] === "jobs") return parts.length === 1 || (parts.length === 2 && ["linkedin", "indeed"].includes(parts[1])) || (parts.length === 3 && jobSlugs.has(parts[2]));
  return app.includes(`path="${parts[0]}"`);
};

const problems = [];
for (const guide of GUIDES) {
  const ids = new Set();
  guide.steps.forEach((step, i) => {
    const where = `${guide.id} step ${i + 1} (${step.id})`;
    if (ids.has(step.id)) problems.push(`${where}: duplicate step id`);
    ids.add(step.id);
    if (!step.title?.trim() || !step.body?.trim()) problems.push(`${where}: needs a title and a body`);
    if (step.advance === "click" && !step.target) problems.push(`${where}: a click step needs a target`);
    for (const name of [step.target, step.targetFallback].filter(Boolean)) {
      if (!defined.has(name)) problems.push(`${where}: no element is marked data-guide="${name}"`);
    }
    if (step.page && !routeExists(step.page)) problems.push(`${where}: "${step.page}" is not a dashboard route`);
  });
  const last = guide.steps[guide.steps.length - 1];
  if (!last || last.advance !== "next") problems.push(`${guide.id}: the last step should be a note with a Finish button`);
}

const stepCount = GUIDES.reduce((n, g) => n + g.steps.length, 0);
if (problems.length) {
  console.error(`Live guides: ${problems.length} problem(s)\n` + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log(`Live guides OK: ${GUIDES.length} guides, ${stepCount} steps, ${defined.size} markers defined.`);
