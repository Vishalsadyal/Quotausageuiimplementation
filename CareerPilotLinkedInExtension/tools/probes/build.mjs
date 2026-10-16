// Builds the paste-into-console probes from the SAME modules the extension loads
// (src/linkedin/core/*), so a probe always tests exactly the code the extension runs.
//
//   tools/probes/bodies/<name>.js  - the test itself (uses the CPLinkedIn* modules)
//   tools/probes/out/<file>        - generated: modules + body, paste into the DevTools console
//
// Run: npm run probe   (also runs as part of npm run build)
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const read = (p) => readFileSync(resolve(root, p), "utf8");

// Shared modules, in load order (same order as manifest.json content_scripts).
const MODULES = {
  dom: { file: "src/linkedin/core/dom.js", global: "CPLinkedInDom" },
  wait: { file: "src/linkedin/core/wait.js", global: "CPLinkedInWait" },
  pages: { file: "src/linkedin/core/pages.js", global: "CPLinkedInPages" },
  job: { file: "src/linkedin/core/job.js", global: "CPLinkedInJob" },
};

const PROBES = [
  {
    out: "1-pages-probe.js",
    body: "bodies/pages.js",
    modules: ["dom", "wait", "pages"],
    title: "Test 1 - job cards + pagination",
    about: `On every results page it scrolls the list to load all job cards, counts them, then goes to the
 * next page, until the last page. It never opens a job or applies.
 * Each next-page strategy is reported separately. Stop with cpPagesStop().
 * Report: copied to the clipboard and kept in window.__cpPages.`,
  },
  {
    out: "2-jobs-probe.js",
    body: "bodies/jobs.js",
    modules: ["dom", "wait", "pages", "job"],
    title: "Test 2 - open every job card and read its facts",
    about: `For each card on the page: reads title / company / location / posted time from the card, clicks it,
 * waits until the job's details are fully loaded, reads the same facts from the details pane and checks
 * they match. Never clicks Apply or Submit. Edit CONFIG (maxJobs, pages) first. Stop with cpJobsStop().
 * Report: copied to the clipboard and kept in window.__cpJobs.`,
  },
  {
    out: "3-capture-probe.js",
    body: "bodies/capture.js",
    modules: ["dom", "wait", "pages", "job"],
    title: "Test 3 - capture card + details HTML of every job",
    about: `For each card on the page: saves the card HTML, opens it, waits for the full details, saves the
 * details HTML and what the readers extracted. Downloads ONE .json file (icons, styles, tracking removed).
 * Never clicks Apply or Save. Stop with cpCaptureStop(). Also kept in window.__cpCapture.`,
  },
  {
    out: "4-layout-probe.js",
    body: "bodies/layout.js",
    modules: ["dom", "wait", "pages", "job"],
    title: "Test 4 - page layout map (+ optional Easy Apply form)",
    about: `Outlines every page region (header, search, filters, results list, first card, pagination, details)
 * using stable markers only, repeated items collapsed. Set CONFIG.openEasyApply = true to also map the
 * Easy Apply form (fields, buttons), then close + discard it: never clicks Next/Review/Submit.
 * Downloads ONE .json file. Also kept in window.__cpLayout.`,
  },
  {
    out: "4b-easyapply-layout-probe.js",
    body: "bodies/layout.js",
    preamble: "window.__cpLayoutOptions = { openEasyApply: true };\n",
    modules: ["dom", "wait", "pages", "job"],
    title: "Test 4b - Easy Apply form layout",
    about: `Same as test 4 with the Easy Apply form mapping ON - open an Easy Apply job first. Opens the form, maps every
 * question and button (also inside shadow roots / iframes), then Dismiss + Discard. Never clicks Next/Review/Submit.`,
  },
  {
    out: "tiles-probe.js",
    body: "bodies/tiles.js",
    modules: ["dom"],
    title: "Job tile snapshot",
    about: `Runs every tile / job id / applied / detail-pane strategy on the current page and shows which work.
 * Outlines: green = applied, orange = not applied, red = no stable job id, dashed = detail pane.
 * Report: copied to the clipboard and kept in window.__cpProbe. cpProbeClear() removes outlines.`,
  },
  {
    out: "cards-check-probe.js",
    body: "bodies/cards-check.js",
    modules: ["dom"],
    title: "Job card check",
    about: `Read-only: finds the job cards on the current page and prints PASS / FAIL for card count, unique job ids
 * and clean (not doubled) titles. Result kept in window.__cpCards.`,
  },
  {
    out: "phone-check-probe.js",
    body: "bodies/phone-check.js",
    modules: [],
    title: "Phone field check",
    about: `Paste while an Easy Apply form is open (do not submit). Lists the phone / mobile fields (type, label,
 * value), shows what the saved number becomes, and whether the "years" fallback could type a stray 1 into it.
 * Edit CONFIG.phone first; CONFIG.fill = true also types the cleaned number. Result in window.__cpPhone.`,
  },
  {
    out: "apply-check-probe.js",
    body: "bodies/apply-check.js",
    modules: ["dom"],
    title: "Apply button check",
    about: `Read-only. Snapshot of how the Apply button, the details pane and every job card are seen, then a WATCH
 * (CONFIG.watchSeconds): click the job that gets called "external" and it records what the URL, the pane and the
 * apply button looked like every 250 ms. Never clicks. Result in window.__cpApply.`,
  },
  {
    out: "limit-check-probe.js",
    body: "bodies/limit-check.js",
    modules: [],
    title: "Daily limit + Hires check",
    about: `Read-only. A) is LinkedIn's daily Easy Apply limit message on the page, and do the extension's rules detect it?
 * B) what the panel shows for Hires, and does "0 Hires + no free applications" mean stopped + Upgrade button?
 * Run it on a Jobs page (also while the limit dialog is open). Result in window.__cpLimits.`,
  },
  {
    out: "walk-probe.js",
    body: "bodies/walk.js",
    modules: ["dom"],
    title: "Walk (dry run)",
    about: `A DRY RUN of the auto-apply flow: opens every job tile, reads the details panel, pages through results
 * and search terms. It NEVER applies or submits. Edit CONFIG in the walk section first. Stop with cpWalkStop().`,
  },
  {
    out: "health-probe.js",
    body: "bodies/health.js",
    modules: ["dom"],
    title: "Health check",
    about: `Checks page, extension, detection and live job loading; prints PASS / WARN / FAIL with hints.
 * Optionally opens the Easy Apply form, lists its questions, then discards it (never clicks Next/Submit).
 * Report: copied to the clipboard and kept in window.__cpHealth.`,
  },
];

const outDir = resolve(here, "out");
mkdirSync(outDir, { recursive: true });

for (const probe of PROBES) {
  const mods = probe.modules.map((name) => MODULES[name]);
  const header = `/*
 * AutoApply CV - ${probe.title}
 * GENERATED by tools/probes/build.mjs from ${[...mods.map((m) => m.file), `tools/probes/${probe.body}`].join(", ")}. Do not edit.
 *
 * Paste into the DevTools console on a LinkedIn Jobs search page (pause any extension run first).
 * ${probe.about}
 */
// Load fresh copies of the modules even if the extension already loaded them on this page.
${mods.map((m) => `delete window.${m.global};`).join("\n")}
`;
  const parts = [header, ...mods.map((m) => `\n// ===== ${m.file}\n${read(m.file)}`), `\n// ===== tools/probes/${probe.body}\n${probe.preamble || ""}${read(`tools/probes/${probe.body}`)}`];
  writeFileSync(resolve(outDir, probe.out), parts.join(""));
}
console.log(`Wrote ${PROBES.map((p) => `tools/probes/out/${p.out}`).join(", ")}`);
