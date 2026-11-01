/*
 * Indeed Jobs copilot - page data reader (runs in the PAGE's world, at document_start)
 *
 * Indeed's search page embeds its results as JSON (window.mosaic.providerData["mosaic-provider-jobcards"]),
 * with per job (found with tools/probes/out/indeed-probe.js):
 *   indeedApplyEnabled / indeedApplyable   "Easily apply" (Indeed's own form, smartapply.indeed.com)
 *   appliedOrGreater                        already applied
 *   expired                                 no longer open
 * This script posts those flags to content_indeed_run.js (window.postMessage), and keeps a network
 * tracker for its smart waits: Indeed requests in flight as data-cp-net-inflight on <html>.
 * It only reads; it never sends requests.
 */
(() => {
  if (window.__cpIndeedPageHook) return;
  window.__cpIndeedPageHook = true;

  // ------------------------------------------------------------------ job flags from the page's data
  // Filter facts (found with tools/probes/out/indeed-filters-probe.js):
  //   jobTypes + taxonomyAttributes "job-types" / "job-types-cc"   Full-time, Permanent, Part-time, Internship ...
  //   remoteWorkModel.type REMOTE_ALWAYS / REMOTE_HYBRID, taxonomy "remote", remoteLocation   work mode
  //   jobCardRequirementsModel requirements "Full-stack development: 2 years" (qstLabel Experience,
  //   strictness required / preferred)                                                         experience
  function jobTypesOf(job) {
    const types = new Set((Array.isArray(job.jobTypes) ? job.jobTypes : []).map(String));
    for (const group of Array.isArray(job.taxonomyAttributes) ? job.taxonomyAttributes : []) {
      if (!/^job-types/.test(String(group?.label || ""))) continue;
      for (const a of Array.isArray(group.attributes) ? group.attributes : []) if (a?.label) types.add(String(a.label));
    }
    return [...types].slice(0, 12);
  }
  function workModeOf(job) {
    const type = String(job.remoteWorkModel?.type || "");
    const remoteTags = (Array.isArray(job.taxonomyAttributes) ? job.taxonomyAttributes : []).filter((g) => g?.label === "remote").flatMap((g) => g.attributes || []).map((a) => String(a?.label || ""));
    if (/HYBRID/i.test(type) || remoteTags.some((t) => /hybrid/i.test(t))) return "hybrid";
    if (/REMOTE/i.test(type) || job.remoteLocation === true || remoteTags.some((t) => /remote/i.test(t))) return "remote";
    return ""; // Indeed doesn't mark on-site jobs: unknown
  }
  function experienceOf(job) {
    const model = job.jobCardRequirementsModel || {};
    const all = ["screenerQuestionRequirements", "jobTagRequirements", "jobOnlyRequirements"].flatMap((k) => (Array.isArray(model[k]) ? model[k] : []));
    const seen = new Set();
    const out = [];
    for (const r of all) {
      const label = String(r?.label || "");
      const years = label.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\b/i);
      if (!years || !(/experience/i.test(String(r.qstLabel || "")) || /years?/i.test(label))) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ label: label.slice(0, 80), years: Number(years[1]), required: String(r.strictness || "").toLowerCase() === "required" });
    }
    return out.slice(0, 6);
  }

  function publishJobs() {
    const model = window.mosaic?.providerData?.["mosaic-provider-jobcards"]?.metaData?.mosaicProviderJobCardsModel;
    const results = Array.isArray(model?.results) ? model.results : [];
    const jobs = results
      .filter((job) => job && job.jobkey)
      .map((job) => ({
        jobId: String(job.jobkey),
        easy: job.indeedApplyEnabled === true || job.indeedApplyable === true,
        applied: job.appliedOrGreater === true,
        expired: job.expired === true,
        title: String(job.displayTitle || job.title || "").slice(0, 200),
        company: String(job.company || "").slice(0, 120),
        snippet: String(job.snippet || "").replace(/<[^>]+>/g, " ").slice(0, 600),
        jobTypes: jobTypesOf(job),
        workMode: workModeOf(job),
        location: String(job.formattedLocation || "").slice(0, 120),
        experience: experienceOf(job),
        // Skills Indeed lists for the job ("Node.js", "MySQL", "Full-stack development: 2 years" -> "Full-stack development").
        requirements: [
          ...new Set(
            ["screenerQuestionRequirements", "jobTagRequirements", "jobOnlyRequirements"]
              .flatMap((k) => (Array.isArray(job.jobCardRequirementsModel?.[k]) ? job.jobCardRequirementsModel[k] : []))
              .map((r) => String(r?.label || "").replace(/:\s*\d.*$/, "").trim())
              .filter(Boolean)
          ),
        ].slice(0, 20),
      }));
    if (jobs.length) window.postMessage({ source: "cp-indeed-jobs", jobs }, location.origin);
  }
  window.addEventListener("message", (event) => {
    if (event.source === window && event.data?.source === "cp-indeed-request") publishJobs();
  });
  document.addEventListener("DOMContentLoaded", () => setTimeout(publishJobs, 0));
  window.addEventListener("load", () => setTimeout(publishJobs, 300));

  // ------------------------------------------------------------------ network tracker (for smart waits)
  const STATIC_FILE = /\.(js|css|png|jpe?g|gif|svg|webp|woff2?|ico)(\?|$)/i;
  const LOGGING = /\/(log|rpc\/log|m\/log|track|beacon|rawclick)/i;
  const net = { inflight: 0 };
  const publishNet = () => {
    if (document.documentElement) document.documentElement.dataset.cpNetInflight = String(net.inflight);
  };
  const track = (rawUrl) => {
    let url;
    try {
      url = new URL(String(rawUrl || ""), location.href);
    } catch {
      return () => {};
    }
    if (!/(^|\.)indeed\.com$/i.test(url.hostname) || STATIC_FILE.test(url.pathname) || LOGGING.test(url.pathname)) return () => {};
    net.inflight += 1;
    publishNet();
    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      net.inflight = Math.max(0, net.inflight - 1);
      publishNet();
    };
  };
  const originalFetch = window.fetch;
  window.fetch = async function (input) {
    const end = track(typeof input === "string" ? input : input?.url || "");
    try {
      return await originalFetch.apply(this, arguments);
    } finally {
      end();
    }
  };
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    let end = null;
    this.addEventListener("loadstart", () => {
      end = track(url);
    });
    this.addEventListener("loadend", () => end?.());
    return originalOpen.apply(this, arguments);
  };
})();
