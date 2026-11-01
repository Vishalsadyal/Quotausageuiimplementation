// Naukri job-page probe - what the auto-apply run sees on a job page, plus the run's own state.
// Read-only, never clicks. Paste on a Naukri job page (naukri.com/job-listings-...), during or after a run.
// Reports: the Apply / Apply on company site / Already applied / Save buttons and the chatbot, exactly as
// content_naukri.js looks for them; the job id in the URL; the run state in sessionStorage (queue, current
// job, phase, duplicates). With CONFIG.watchSeconds it also logs every change of those buttons, so you can
// click Apply yourself and see what changes. Copies the report to the clipboard and downloads ONE .json file.
(async () => {
  const CONFIG = {
    watchSeconds: 30, // 0 = snapshot only
    ...(window.__cpNaukriJobOptions || {}),
  };
  console.log("%cAutoApply CV - Naukri job-page probe", "font-weight:700;color:#6366f1");
  if (!/(^|\.)naukri\.com$/i.test(location.hostname)) return console.error("Open a Naukri job page first.");

  const clean = (t) => String(t || "").replace(/\s+/g, " ").trim();
  const isVisible = (el) => {
    const r = el?.getBoundingClientRect?.();
    return Boolean(r && r.width > 0 && r.height > 0);
  };
  const sig = (el) => {
    if (!el || el.nodeType !== 1) return "";
    let s = el.tagName.toLowerCase();
    if (el.id) s += `#${el.id}`;
    const classes = Array.from(el.classList).slice(0, 5);
    if (classes.length) s += `.${classes.join(".")}`;
    return s;
  };
  const path = (el) => {
    const out = [];
    for (let n = el; n && n.nodeType === 1 && out.length < 4; n = n.parentElement) out.push(sig(n));
    return out.join(" < ");
  };
  const describe = (el) =>
    el
      ? { found: true, text: clean(el.textContent).slice(0, 60), visible: isVisible(el), disabled: Boolean(el.disabled) || el.getAttribute("aria-disabled") === "true", path: path(el) }
      : { found: false };
  const jobIdFromUrl = (url) => (String(url || "").split("?")[0].match(/-(\d{6,})\/?$/) || [])[1] || "";

  /** The same lookups content_naukri.js uses (naukriApplyControls). */
  function controls() {
    const apply = document.querySelector("#apply-button");
    return {
      applyButton: describe(apply),
      applyButtonUsable: Boolean(apply && /^apply$/i.test(clean(apply.textContent)) && !apply.disabled),
      companySiteButton: describe(document.querySelector("#company-site-button")),
      alreadyApplied: describe(document.querySelector("#already-applied")),
      chatbot: describe(document.querySelector("[id*='ChatbotContainer'], .chatbot_Drawer")),
      // Every button-ish element whose text mentions apply / save / interested, wherever it is.
      otherApplyLike: Array.from(document.querySelectorAll("button, a, [role='button']"))
        .filter((el) => /^(apply|apply now|apply on company site|applied|already applied|save|saved|i am interested|interested|login to apply)$/i.test(clean(el.textContent)))
        .slice(0, 12)
        .map((el) => ({ text: clean(el.textContent), id: el.id || "", visible: isVisible(el), path: path(el) })),
    };
  }

  let run = null;
  try {
    run = JSON.parse(sessionStorage.getItem("cpNaukriRun") || "null");
  } catch {
    run = "unreadable";
  }
  const queueIds = Array.isArray(run?.queue) ? run.queue.map((q) => q.jobId) : [];
  const report = {
    probe: "naukri-job",
    version: 1,
    at: new Date().toISOString(),
    path: location.pathname,
    isJobPage: /\/job-listings-/i.test(location.pathname),
    jobIdInUrl: jobIdFromUrl(location.href),
    title: clean(document.querySelector("h1")?.textContent).slice(0, 100),
    extensionSidebar: Boolean(document.getElementById("cp-linkedin-copilot-panel")),
    controls: controls(),
    blockedText: /captcha|verify you are (a )?human|unusual activity|too many requests|temporarily blocked|access denied/i.test(document.body?.innerText || ""),
    run: run && typeof run === "object"
      ? {
          status: run.status,
          live: run.live,
          phase: run.phase || null,
          index: run.index,
          queueLength: queueIds.length,
          currentJob: run.queue?.[run.index] ? { jobId: run.queue[run.index].jobId, title: run.queue[run.index].title } : null,
          currentMatchesThisPage: run.queue?.[run.index]?.jobId === jobIdFromUrl(location.href),
          duplicateJobIdsInQueue: queueIds.filter((id, i) => queueIds.indexOf(id) !== i),
          queue: (run.queue || []).map((q) => `${q.jobId} ${q.title}`.slice(0, 90)),
          lastResults: (run.results || []).slice(-6).map((r) => `${r.outcome}: ${r.title} (${r.detail})`.slice(0, 140)),
          returnUrl: String(run.returnUrl || "").replace(/\?.*$/, "?…"),
        }
      : run,
    watch: [],
  };
  console.log("Controls:", report.controls);
  console.log("Run:", report.run);

  if (CONFIG.watchSeconds > 0) {
    console.log(`%cWatching the buttons for ${CONFIG.watchSeconds}s (click Apply yourself if you want to see what changes)…`, "color:#16a34a;font-weight:600");
    let last = JSON.stringify(controls());
    const until = Date.now() + CONFIG.watchSeconds * 1000;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, 300));
      const now = JSON.stringify(controls());
      if (now !== last) {
        last = now;
        const step = { t: new Date().toISOString().slice(11, 19), url: location.pathname, ...JSON.parse(now) };
        report.watch.push(step);
        console.log("changed:", step);
      }
    }
  }

  window.__cpNaukriJob = report;
  const json = JSON.stringify(report, null, 2);
  try {
    await navigator.clipboard.writeText(json);
  } catch {
    // clipboard needs page focus; the download below still works
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  a.download = `naukri-job-probe-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  console.log("%cDone. A .json file was downloaded (also copied) - send it to Claude. Also in window.__cpNaukriJob.", "font-weight:700;color:#6366f1");
})();
