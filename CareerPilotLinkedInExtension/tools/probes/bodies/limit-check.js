// Checks two stop conditions on the live LinkedIn page. Read-only: never clicks anything.
//  A) LinkedIn's "daily Easy Apply limit" message: is it on the page, and would the extension detect it?
//  B) Hires: what the panel shows, and whether "0 Hires + no free applications" really means stopped + Upgrade.
(() => {
  const norm = (t) => String(t || "").toLowerCase().replace(/\s+/g, " ").trim();
  const checks = [];
  const check = (name, ok, detail = "") => checks.push([name, Boolean(ok), detail]);

  // ───────────────────────── A) daily limit ─────────────────────────
  // Same rules as src/linkedin/jobs/13-skip-rules.js hasDailyEasyApplyLimitSignal (old and 2026 wording).
  function limitRulesMatched(rawText) {
    const t = norm(rawText);
    const rules = {
      "we limit daily submissions": t.includes("we limit daily submissions") || t.includes("limit daily submissions"),
      "maintain quality + tomorrow": t.includes("maintain quality and prevent bots") && t.includes("tomorrow"),
      "save this job + apply tomorrow": t.includes("save this job") && t.includes("apply tomorrow"),
      "each application get the right attention": t.includes("helping each application get the right attention"),
      "2026: reached today + easy apply limit": t.includes("reached today") && t.includes("easy apply limit"),
      "2026: easy apply limit + tomorrow": t.includes("easy apply limit") && t.includes("tomorrow"),
      "2026: save this job + applying tomorrow": t.includes("save this job") && t.includes("applying tomorrow"),
      "2026: limit easy apply submissions + tomorrow": t.includes("limit easy apply submissions") && t.includes("tomorrow"),
      "daily application limit": t.includes("daily application limit") && t.includes("tomorrow"),
    };
    return Object.entries(rules).filter(([, hit]) => hit).map(([name]) => name);
  }

  // Self-test of the wording rules (so a FAIL below means the page, not the rules).
  const samples = [
    ["old wording", "We limit daily submissions to maintain quality and prevent bots. Save this job and apply tomorrow.", true],
    ["2026 wording", "You reached today’s Easy Apply limit Great effort applying today. We limit Easy Apply submissions to help ensure each application gets the right attention. Save this job and continue applying tomorrow. Learn more Got it", true],
    ["normal job card", "Frontend Engineer Jobgether India (Remote) 1 day ago Easy Apply Actively reviewing applicants", false],
    ["filter text", "Easy apply limit your search to remote jobs", false],
  ];
  for (const [name, text, expected] of samples) {
    const hit = limitRulesMatched(text).length > 0;
    check(`limit rules: ${name} -> ${expected ? "detected" : "ignored"}`, hit === expected, hit ? "detected" : "ignored");
  }

  // The same places the extension looks (page, dialogs, LinkedIn's shadow root for dialogs).
  const roots = [document, document.getElementById("interop-outlet")?.shadowRoot].filter(Boolean);
  const CANDIDATES = ".artdeco-inline-feedback__message, .artdeco-inline-feedback, [role='alert'], [aria-live='polite'], [aria-live='assertive'], .artdeco-toast-item__message, .artdeco-toast-item, .jobs-easy-apply-modal, .artdeco-modal, [role='dialog'], dialog";
  const els = roots.flatMap((r) => Array.from(r.querySelectorAll(CANDIDATES)));
  const dialogs = els.filter((e) => e.matches("dialog, [role='dialog'], .artdeco-modal"));
  console.log(`%cA) DAILY LIMIT`, "font-weight:bold", `- ${els.length} message/dialog element(s) checked, ${dialogs.length} dialog(s)`);
  if (dialogs.length) {
    console.table(dialogs.slice(0, 5).map((d) => ({
      heading: (d.querySelector("h1, h2, h3")?.textContent || "").trim().slice(0, 50),
      text: (d.textContent || "").replace(/\s+/g, " ").trim().slice(0, 110),
      gotItButton: Boolean(Array.from(d.querySelectorAll("button")).find((b) => /^got it$/i.test((b.textContent || "").trim()))),
    })));
  }
  const matched = limitRulesMatched(els.map((e) => e.textContent || "").join(" "));
  // Stable marker (does not depend on wording): the limit dialog's screen name.
  const markerHit = roots.some((r) => r.querySelector("[data-sdui-screen*='EasyApplyFuseLimit' i]"));
  if (markerHit) matched.unshift("sdui-screen EasyApplyFuseLimit (stable marker)");
  const limitOnPage = markerHit || /easy apply limit|limit daily submissions|reached today/i.test(dialogs.map((d) => d.textContent || "").join(" "));
  console.log(matched.length ? `LIMIT DETECTED by: ${matched.join(" | ")}` : "No daily-limit message detected on this page right now.");
  if (limitOnPage) check("a daily-limit dialog is on the page AND the extension rules detect it", matched.length > 0, matched.join(" | ") || "visible but NOT matched: send me its text");

  // ───────────────────────── B) hires ─────────────────────────
  // Same rule as 20-panel-render.js describeHiresState.
  function hiresState({ hireBalance, quotaUsed, quotaTotal, spendable }) {
    const n = (v) => (v === undefined || v === null ? NaN : Number(v));
    const hb = n(hireBalance), used = n(quotaUsed), total = n(quotaTotal), sp = n(spendable);
    const hasFree = Number.isFinite(used) && Number.isFinite(total);
    const freeLeft = hasFree ? Math.max(0, total - used) : 0;
    const hires = Number.isFinite(hb) ? Math.max(0, hb) : Number.isFinite(sp) ? Math.max(0, sp - freeLeft) : null;
    const out = Number.isFinite(sp) ? sp <= 0 : hires !== null && hasFree && hires <= 0 && freeLeft <= 0;
    return { hires, out };
  }
  const cases = [
    ["0 Hires, 3/3 free used (nothing left)", { hireBalance: 0, quotaUsed: 3, quotaTotal: 3, spendable: 0 }, true],
    ["0 Hires, 1/3 free used (free left)", { hireBalance: 0, quotaUsed: 1, quotaTotal: 3, spendable: 2 }, false],
    ["10 Hires, 3/3 free used (paid)", { hireBalance: 10, quotaUsed: 3, quotaTotal: 3, spendable: 10 }, false],
    ["1 Hire, 3/3 free used", { hireBalance: 1, quotaUsed: 3, quotaTotal: 3, spendable: 1 }, false],
    ["quota not loaded yet", {}, false],
  ];
  console.log(`%cB) HIRES`, "font-weight:bold");
  for (const [name, q, expectedOut] of cases) {
    const r = hiresState(q);
    check(`hires rule: ${name} -> ${expectedOut ? "STOP + Upgrade" : "keep running"}`, r.out === expectedOut, `out=${r.out}`);
  }

  const panel = document.getElementById("cp-linkedin-copilot-panel");
  const wallet = document.getElementById("cp-wallet");
  const walletText = (document.getElementById("cp-wallet-text")?.textContent || "").trim();
  const upgrade = document.getElementById("cp-upgrade");
  const badge = (document.getElementById("cp-status-badge")?.textContent || "").trim();
  const chips = Array.from(document.querySelectorAll(".cp-ow-hires")).map((c) => ({ text: (c.textContent || "").trim(), empty: c.classList.contains("is-empty") }));
  const live = {
    panelFound: Boolean(panel),
    walletText,
    marksOut: Boolean(wallet?.classList.contains("cp-quota-out")),
    upgradeButtonVisible: Boolean(upgrade && !upgrade.hidden),
    runBadge: badge,
  };
  console.table([live]);
  if (chips.length) console.table(chips);

  const m = walletText.match(/(\d+)\s+Hires?/i);
  const f = walletText.match(/(\d+)\s*\/\s*(\d+)\s*Free/i);
  const textSaysOut = /·\s*Out\s*$/i.test(walletText);
  const parsedOut = m && f ? Number(m[1]) === 0 && Number(f[1]) >= Number(f[2]) : null;
  check("the AutoApply panel is on this page", live.panelFound, live.panelFound ? "found" : "open a LinkedIn Jobs page with the extension loaded");
  if (live.panelFound) {
    check("the pill shows the Hires count", /\bhires?\b/i.test(walletText), `"${walletText}"`);
    check("pill state matches the numbers it shows", parsedOut === null || parsedOut === live.marksOut, `numbers say out=${parsedOut}, pill marked out=${live.marksOut}`);
    check("Upgrade button is visible exactly when out of Hires", live.upgradeButtonVisible === live.marksOut, `upgrade visible=${live.upgradeButtonVisible}, out=${live.marksOut}`);
    if (live.marksOut) check("when out of Hires the run is NOT running", !/^running/i.test(badge), `status badge: "${badge}"`);
    check("out text and flag agree", textSaysOut === live.marksOut, `text ends with Out=${textSaysOut}, flag=${live.marksOut}`);
  }

  for (const [name, ok, detail] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  window.__cpLimits = { matched, live, chips, checks };
  console.log("Result kept in window.__cpLimits");
})();
