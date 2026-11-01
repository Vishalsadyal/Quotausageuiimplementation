/*
 * Naukri Jobs copilot - search data reader (runs in the PAGE's world, at document_start)
 *
 * Naukri's job cards don't say whether a job is applied to on Naukri or on the company's site; only the
 * search API response does (found with tools/probes/out/naukri-cards-probe.js):
 *   companyApplyJob false            -> "Apply" on Naukri (Easy Apply)
 *   companyApplyJob true + applyRedirectUrl -> "Apply on company site"
 *   questionnaireIdPresent true      -> the recruiter chatbot will ask questions
 * This script reads those fields from Naukri's own search responses (fetch and XHR) and posts them to
 * content_naukri.js with window.postMessage. It also reports the result of Naukri's own apply call.
 * It only reads responses; it never sends requests.
 */
(() => {
  if (window.__cpNaukriSearchHook) return;
  window.__cpNaukriSearchHook = true;

  const SEARCH_PATH = /\/jobapi\/v\d+\/search|\/recom-jobs/i;
  // Naukri's apply call (POST .../apply-workflow/v1/apply). Its response says applied / needs the
  // recruiter questions / daily quota used up (customErrorCode 403009).
  const APPLY_PATH = /apply-workflow|\/v\d+\/apply\b/i;

  function publishApply(status, text) {
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON
    }
    const jobs = Array.isArray(json?.jobs) ? json.jobs : [];
    window.postMessage(
      {
        source: "cp-naukri-apply",
        httpStatus: status,
        message: String(json?.message || "").slice(0, 200),
        customErrorCode: json?.customErrorCode ?? null,
        dailyApplied: json?.quotaDetails?.dailyApplied ?? null,
        jobs: jobs.map((job) => ({
          jobId: String(job?.jobId || ""),
          status: job?.status ?? null,
          // Naukri's own words when it refuses a job (shown in the run's result).
          message: String(job?.message || job?.statusMessage || "").slice(0, 200),
          questions: Array.isArray(job?.questionnaire) && job.questionnaire.length > 0,
        })),
      },
      location.origin
    );
  }

  /** Arrays of job objects (they have a jobId) anywhere in the response. */
  function findJobs(root, found = [], depth = 0) {
    if (!root || typeof root !== "object" || depth > 6) return found;
    if (Array.isArray(root)) {
      if (root.length && root[0] && typeof root[0] === "object" && "jobId" in root[0]) found.push(...root);
      else for (const item of root.slice(0, 50)) findJobs(item, found, depth + 1);
    } else {
      for (const value of Object.values(root)) findJobs(value, found, depth + 1);
    }
    return found;
  }

  function publish(text) {
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return;
    }
    const jobs = findJobs(json)
      .filter((job) => job && job.jobId)
      .map((job) => ({
        jobId: String(job.jobId),
        companyApply: job.companyApplyJob === true || Boolean(job.applyRedirectUrl),
        redirectHost: (() => {
          try {
            return job.applyRedirectUrl ? new URL(job.applyRedirectUrl).hostname : "";
          } catch {
            return "";
          }
        })(),
        questions: job.questionnaireIdPresent === true,
        walkin: job.walkinJob === true,
        // For the user's filters (dashboard keywords / skills / exclude words / experience).
        title: String(job.title || "").slice(0, 200),
        company: String(job.companyName || "").slice(0, 120),
        skills: String(job.tagsAndSkills || "").slice(0, 600),
        minExp: Number.isFinite(Number(job.minimumExperience)) ? Number(job.minimumExperience) : null,
        maxExp: Number.isFinite(Number(job.maximumExperience)) ? Number(job.maximumExperience) : null,
      }));
    if (!jobs.length) return;
    for (const job of jobs) seen.set(job.jobId, job);
    window.postMessage({ source: "cp-naukri-search", jobs }, location.origin);
  }

  // The first search response can arrive before content_naukri.js (document_idle) listens, so keep what
  // was seen and send it again when the content script asks.
  const seen = new Map();
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "cp-naukri-request") return;
    if (seen.size) window.postMessage({ source: "cp-naukri-search", jobs: [...seen.values()] }, location.origin);
  });

  // Network tracker for content_naukri.js's smart waits: Naukri requests still in flight (all / chatbot /
  // apply) and when the last apply request STARTED, as attributes on <html> (the content script reads
  // the same DOM): data-cp-net-inflight, data-cp-net-chat, data-cp-net-apply, data-cp-apply-started-at.
  const CHAT_PATH = /chatbot/i;
  const STATIC_FILE = /\.(js|css|png|jpe?g|gif|svg|webp|woff2?|ico)(\?|$)/i;
  const net = { inflight: 0, chat: 0, apply: 0 };
  const publishNet = () => {
    const root = document.documentElement;
    if (!root) return;
    root.dataset.cpNetInflight = String(net.inflight);
    root.dataset.cpNetChat = String(net.chat);
    root.dataset.cpNetApply = String(net.apply);
  };
  /** Count a Naukri request (not analytics / static files); returns the function that ends it. */
  const track = (rawUrl) => {
    let url;
    try {
      url = new URL(String(rawUrl || ""), location.href);
    } catch {
      return () => {};
    }
    if (!/(^|\.)naukri\.com$/i.test(url.hostname) || STATIC_FILE.test(url.pathname)) return () => {};
    const kinds = ["inflight", CHAT_PATH.test(url.pathname) && "chat", APPLY_PATH.test(url.pathname) && "apply"].filter(Boolean);
    for (const kind of kinds) net[kind] += 1;
    if (kinds.includes("apply") && document.documentElement) document.documentElement.dataset.cpApplyStartedAt = String(Date.now());
    publishNet();
    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      for (const kind of kinds) net[kind] = Math.max(0, net[kind] - 1);
      publishNet();
    };
  };

  const originalFetch = window.fetch;
  window.fetch = async function (input) {
    const url = typeof input === "string" ? input : input?.url || "";
    const end = track(url);
    let response;
    try {
      response = await originalFetch.apply(this, arguments);
    } finally {
      end();
    }
    try {
      if (SEARCH_PATH.test(url)) response.clone().text().then(publish).catch(() => {});
      else if (APPLY_PATH.test(url)) response.clone().text().then((text) => publishApply(response.status, text)).catch(() => {});
    } catch {
      // never break Naukri's own request
    }
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    let end = null;
    this.addEventListener("loadstart", () => {
      end = track(url);
    });
    this.addEventListener("loadend", () => end?.());
    const isSearch = SEARCH_PATH.test(String(url || ""));
    const isApply = !isSearch && APPLY_PATH.test(String(url || ""));
    if (isSearch || isApply) {
      this.addEventListener("loadend", () => {
        try {
          const text = this.responseType === "" || this.responseType === "text" ? this.responseText : JSON.stringify(this.response);
          if (isSearch) publish(text);
          else publishApply(this.status, text);
        } catch {
          // unreadable response
        }
      });
    }
    return originalOpen.apply(this, arguments);
  };
})();
