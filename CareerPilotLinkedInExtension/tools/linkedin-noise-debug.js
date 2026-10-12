/*
 * AutoApply CV - LinkedIn console noise debugger
 *
 * Paste into the DevTools console on a LinkedIn page. For CONFIG.seconds it records every
 * network request the page makes (fetch, XHR, beacons, images, scripts) plus every console.*
 * call, then prints who is responsible for the "Fetch finished loading" / "Fetch failed loading" /
 * "chrome-extension://invalid" flood:
 *   - requests grouped by category (LinkedIn API, LinkedIn tracking, Google ads, Tealium,
 *     bot detection, extension checks, AutoApply CV, other)
 *   - top domains and top initiating scripts (from the call stack)
 *   - failed requests with the error and the script that made them
 *   - extension IDs LinkedIn probes, and whether AutoApply CV is among them
 *   - which scripts call console.log/warn/error and how often
 * Read-only: it wraps fetch/XHR/sendBeacon/console only to observe, and restores them when done.
 * Stop early with cpNoiseStop(). Full report: window.__cpNoise (also copied to the clipboard).
 */
(() => {
  const CONFIG = {
    seconds: 60, // how long to record
    includeAlreadyLoaded: true, // also count requests made before the script was pasted
  };

  if (window.__cpNoiseRestore) window.__cpNoiseRestore();

  const started = Date.now();
  const calls = []; // fetch/XHR/beacon calls observed live, with initiator script
  const consoleCalls = [];
  let ownExtensionId = "";
  try {
    // The extension marks its panel; its icon URLs reveal its id if present on the page.
    const img = document.querySelector("img[src^='chrome-extension://']");
    ownExtensionId = img ? new URL(img.src).host : "";
  } catch {
    // ignore
  }

  // ---------------------------------------------------------------- classification
  const CATEGORIES = [
    ["extension check (chrome-extension://)", (u) => u.startsWith("chrome-extension://")],
    ["AutoApply CV backend", (u) => /autoapplycv|localhost|127\.0\.0\.1/.test(u)],
    ["bot detection (HUMAN/PerimeterX)", (u) => /protechts\.net|perimeterx|px-cdn|px-cloud|captcha/.test(u)],
    ["Google ads/analytics", (u) => /doubleclick\.net|googletagmanager|google-analytics|googleadservices|google\.com\/(ccm|pagead)|gstatic\.com\/.*ads/.test(u)],
    ["Tealium analytics (utag)", (u) => /tiqcdn|utag|tealium/.test(u)],
    ["other ads/trackers", (u) => /bing\.com|facebook\.|adsrvr|demdex|omtrdc|quantserve|criteo|taboola|clarity\.ms|hotjar/.test(u)],
    ["LinkedIn tracking/telemetry", (u) => /linkedin\.com\/(li\/track|li\/tscp|tscp|px|collect|sensorCollect|realtime|mob\/tracking)|px\.ads\.linkedin|snap\.licdn|dc\.ads\.linkedin|\/sct|\/pt\/|beacon/i.test(u)],
    ["LinkedIn API (voyager/graphql)", (u) => /linkedin\.com\/(voyager|graphql|flagship-web|jobs-guest)/.test(u)],
    ["LinkedIn static assets", (u) => /licdn\.com|static\.linkedin/.test(u)],
    ["LinkedIn other", (u) => /linkedin\.com/.test(u)],
  ];
  const categorize = (url) => (CATEGORIES.find(([, test]) => test(String(url))) || ["other"])[0];
  const hostOf = (url) => {
    try {
      return new URL(url, location.href).host || String(url).slice(0, 40);
    } catch {
      return String(url).slice(0, 40);
    }
  };

  /** First script in the stack that is not this debugger: the code really responsible. */
  function initiatorFromStack() {
    const stack = String(new Error().stack || "").split("\n").slice(2);
    for (const line of stack) {
      if (/cpNoise|linkedin-noise-debug|<anonymous>|VM\d+/.test(line)) continue;
      const m = line.match(/(https?:\/\/[^\s)]+|chrome-extension:\/\/[^\s)]+)/);
      if (m) return m[1].replace(/:\d+:\d+$/, "").replace(/\?.*$/, "").split("/").slice(-2).join("/");
    }
    return "(unknown)";
  }

  // ---------------------------------------------------------------- wrap fetch / XHR / beacon / console
  const orig = {
    fetch: window.fetch,
    open: XMLHttpRequest.prototype.open,
    send: XMLHttpRequest.prototype.send,
    beacon: navigator.sendBeacon?.bind(navigator),
    console: {},
  };

  window.fetch = function cpNoiseFetch(input, init) {
    const url = typeof input === "string" ? input : input?.url || String(input);
    const entry = { kind: "fetch", method: (init?.method || input?.method || "GET").toUpperCase(), url, by: initiatorFromStack(), at: Date.now() - started };
    calls.push(entry);
    return orig.fetch.apply(this, arguments).then(
      (res) => {
        entry.status = res.status;
        entry.ok = res.ok;
        return res;
      },
      (err) => {
        entry.status = 0;
        entry.ok = false;
        entry.error = String(err?.message || err);
        throw err;
      },
    );
  };

  XMLHttpRequest.prototype.open = function cpNoiseOpen(method, url) {
    this.__cpNoise = { kind: "xhr", method: String(method).toUpperCase(), url: String(url), by: initiatorFromStack(), at: Date.now() - started };
    return orig.open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function cpNoiseSend() {
    const entry = this.__cpNoise;
    if (entry) {
      calls.push(entry);
      this.addEventListener("loadend", () => {
        entry.status = this.status;
        entry.ok = this.status >= 200 && this.status < 400;
        if (!this.status) entry.error = "network error / blocked";
      });
    }
    return orig.send.apply(this, arguments);
  };

  if (orig.beacon) {
    navigator.sendBeacon = function cpNoiseBeacon(url) {
      const queued = orig.beacon.apply(navigator, arguments);
      calls.push({ kind: "beacon", method: "POST", url: String(url), by: initiatorFromStack(), at: Date.now() - started, ok: queued, status: queued ? 204 : 0 });
      return queued;
    };
  }

  for (const level of ["log", "info", "warn", "error", "debug"]) {
    orig.console[level] = console[level];
    console[level] = function cpNoiseConsole(...args) {
      consoleCalls.push({ level, by: initiatorFromStack(), text: String(args[0] ?? "").slice(0, 80) });
      return orig.console[level].apply(console, args);
    };
  }

  function restore() {
    window.fetch = orig.fetch;
    XMLHttpRequest.prototype.open = orig.open;
    XMLHttpRequest.prototype.send = orig.send;
    if (orig.beacon) navigator.sendBeacon = orig.beacon;
    for (const level of Object.keys(orig.console)) console[level] = orig.console[level];
    delete window.__cpNoiseRestore;
  }
  window.__cpNoiseRestore = restore;

  try {
    performance.setResourceTimingBufferSize(10000);
  } catch {
    // ignore
  }

  // ---------------------------------------------------------------- report
  function countBy(items, key) {
    const map = new Map();
    for (const it of items) {
      const k = typeof key === "function" ? key(it) : it[key];
      map.set(k, (map.get(k) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }

  function report() {
    restore();
    const seconds = Math.max(1, Math.round((Date.now() - started) / 1000));

    // Resource timing sees everything the browser loaded, including images/scripts/iframes.
    const resources = performance
      .getEntriesByType("resource")
      .filter((r) => CONFIG.includeAlreadyLoaded || r.startTime >= performance.now() - seconds * 1000)
      .map((r) => ({
        url: r.name,
        type: r.initiatorType,
        status: r.responseStatus ?? null,
        failed: (r.responseStatus === 0 || r.responseStatus >= 400) && r.transferSize === 0,
      }));

    const all = [
      ...resources.map((r) => ({ url: r.url, source: `resource:${r.type}`, failed: r.failed, status: r.status })),
      ...calls.map((c) => ({ url: c.url, source: c.kind, failed: c.ok === false, status: c.status, by: c.by, error: c.error })),
    ];

    const byCategory = countBy(all, (r) => categorize(r.url)).map(([category, requests]) => ({
      category,
      requests,
      failed: all.filter((r) => categorize(r.url) === category && r.failed).length,
    }));

    const topDomains = countBy(all, (r) => hostOf(r.url))
      .slice(0, 15)
      .map(([domain, requests]) => ({ domain, category: categorize(`https://${domain}/`), requests }));

    const topInitiators = countBy(calls, "by")
      .slice(0, 15)
      .map(([script, requests]) => ({
        script,
        requests,
        failed: calls.filter((c) => c.by === script && c.ok === false).length,
        mainlyTo: countBy(calls.filter((c) => c.by === script), (c) => categorize(c.url))[0]?.[0] || "",
      }));

    const failures = countBy(
      calls.filter((c) => c.ok === false),
      (c) => `${categorize(c.url)} | ${hostOf(c.url)} | by ${c.by} | ${c.error || `HTTP ${c.status}`}`,
    )
      .slice(0, 20)
      .map(([what, count]) => {
        const [category, domain, by, reason] = what.split(" | ");
        return { count, category, domain, by: by.replace(/^by /, ""), reason };
      });

    const extensionProbes = all.filter((r) => String(r.url).startsWith("chrome-extension://"));
    const probedIds = countBy(extensionProbes, (r) => hostOf(r.url)).map(([id, times]) => ({
      extensionId: id,
      times,
      isAutoApplyCV: Boolean(ownExtensionId && id === ownExtensionId),
    }));
    const probeCallers = countBy(calls.filter((c) => String(c.url).startsWith("chrome-extension://")), "by").map(([script, times]) => ({ script, times }));

    const ownRequests = all.filter((r) => categorize(r.url) === "AutoApply CV backend" || (ownExtensionId && String(r.url).includes(ownExtensionId)));
    const consoleByScript = countBy(consoleCalls, (c) => `${c.level} | ${c.by}`)
      .slice(0, 15)
      .map(([k, times]) => {
        const [level, script] = k.split(" | ");
        return { level, script, times, sample: consoleCalls.find((c) => c.level === level && c.by === script)?.text || "" };
      });

    const live = calls.length;
    const summary = {
      recordedSeconds: seconds,
      totalRequestsSeen: all.length,
      liveFetchXhrBeacon: live,
      perMinute: Math.round((live / seconds) * 60),
      failedLive: calls.filter((c) => c.ok === false).length,
      extensionChecks: extensionProbes.length,
      autoApplyCvRequests: ownRequests.length,
      consoleCalls: consoleCalls.length,
      verdict: ownRequests.length
        ? "Some requests come from AutoApply CV; see autoApplyCv in the report."
        : "No request comes from AutoApply CV: the noise is LinkedIn's own traffic, logged by DevTools' 'Log XMLHttpRequests' setting.",
    };

    const reportObj = { url: location.href, at: new Date().toISOString(), summary, byCategory, topDomains, topInitiators, failures, extensionProbes: { probedIds, probeCallers }, autoApplyCv: ownRequests.slice(0, 20), consoleByScript };
    window.__cpNoise = reportObj;

    const log = orig.console.log;
    log("%cAutoApply CV - LinkedIn noise report", "font-weight:700;font-size:14px;color:#6366f1");
    console.table(summary);
    log("Requests by category:");
    console.table(byCategory);
    log("Top domains:");
    console.table(topDomains);
    log("Top initiating scripts (who calls fetch/XHR):");
    console.table(topInitiators);
    log("Failed requests (what the 'Fetch failed loading' lines are):");
    console.table(failures);
    log("Extension checks (chrome-extension://invalid):");
    console.table(probedIds);
    console.table(probeCallers);
    log("console.* calls by script:");
    console.table(consoleByScript);
    try {
      if (typeof copy === "function") {
        copy(JSON.stringify(reportObj, null, 2));
        log("Full report copied to the clipboard (also in window.__cpNoise).");
      }
    } catch {
      log("Full report is in window.__cpNoise");
    }
  }

  const timer = setTimeout(report, CONFIG.seconds * 1000);
  window.cpNoiseStop = () => {
    clearTimeout(timer);
    report();
  };
  orig.console.log(
    `%c[noise] recording LinkedIn requests for ${CONFIG.seconds}s (scroll / click jobs meanwhile). Stop early: cpNoiseStop()`,
    "color:#6366f1",
  );
})();
