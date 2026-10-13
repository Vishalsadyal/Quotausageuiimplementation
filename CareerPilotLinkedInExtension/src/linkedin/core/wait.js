/*
 * Smart waits: wait for what the page is actually doing instead of fixed sleeps.
 *
 * LinkedIn is a single-page app: after a click it changes the URL at once, shows spinners or
 * skeleton cards, then renders the real content in several passes. A fixed sleep is either too
 * short (we read a half-rendered page) or too long (slow runs). These helpers wait until the
 * condition is really true AND the page has stopped changing, with a timeout as a safety net.
 *
 *   until(check)          poll a condition until it returns something truthy
 *   noLoaders(root)       true when no spinner / skeleton / aria-busy is visible inside root
 *   domQuiet(root)        resolves once root has had no DOM changes for quietMs
 *   stable(read)          resolves once read() returns the same value for stableMs
 *   settled(root, check)  check() true + no loaders + DOM quiet: "fully loaded"
 *
 * Every wait resolves { ok, value, waitedMs, reason } and never throws, so callers can log why
 * a wait gave up. No dependencies. Exposes globalThis.CPLinkedInWait.
 */
(function initCPLinkedInWait(global) {
  if (global.CPLinkedInWait) return;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Content loaders only. Not "ghost" (LinkedIn's ghost buttons) or progress bars (video/upload UI).
  const LOADER_SELECTOR = [
    "[aria-busy='true']",
    ".artdeco-loader",
    ".artdeco-loader__bar",
    "[class*='skeleton' i]",
    "[class*='shimmer' i]",
    "[class*='placeholder-loading' i]",
    "[data-testid='loader']", // 2026 layout spinner (e.g. inside the Easy Apply dialog)
  ].join(", ");
  const isVisible = (el) => {
    const r = el?.getBoundingClientRect?.();
    return Boolean(r && r.width > 0 && r.height > 0);
  };

  /** Polls check() until it returns a truthy value. */
  async function until(check, { timeoutMs = 10000, intervalMs = 200, shouldStop = () => false } = {}) {
    const start = Date.now();
    let value;
    while (Date.now() - start < timeoutMs) {
      if (shouldStop()) return { ok: false, value, waitedMs: Date.now() - start, reason: "stopped" };
      try {
        value = check();
      } catch {
        value = undefined;
      }
      if (value) return { ok: true, value, waitedMs: Date.now() - start, reason: "" };
      await sleep(intervalMs);
    }
    return { ok: false, value, waitedMs: Date.now() - start, reason: "timeout" };
  }

  /** No visible loading indicator inside root. */
  function noLoaders(root = document) {
    if (!root) return true;
    if (root.getAttribute?.("aria-busy") === "true") return false;
    return !Array.from(root.querySelectorAll(LOADER_SELECTOR)).some(isVisible);
  }

  /**
   * Resolves once root has had no added/removed nodes or text changes for quietMs.
   * Attribute changes are ignored: LinkedIn toggles classes/aria all the time (hover, focus, ads).
   */
  function domQuiet(root = document.body, { quietMs = 500, timeoutMs = 8000, ignore = null } = {}) {
    return new Promise((resolve) => {
      const start = Date.now();
      let last = Date.now();
      let done = false;
      const finish = (ok, reason) => {
        if (done) return;
        done = true;
        observer.disconnect();
        clearInterval(timer);
        resolve({ ok, value: null, waitedMs: Date.now() - start, reason });
      };
      const observer = new MutationObserver((records) => {
        if (ignore && records.every((r) => r.target?.nodeType === 1 && r.target.closest?.(ignore))) return;
        last = Date.now();
      });
      if (!root) return finish(true, "");
      observer.observe(root, { childList: true, subtree: true, characterData: true });
      const timer = setInterval(() => {
        if (Date.now() - last >= quietMs) finish(true, "");
        else if (Date.now() - start >= timeoutMs) finish(false, "still changing");
      }, 100);
    });
  }

  /** Resolves once read() has returned the same value for stableMs (e.g. a card count). */
  async function stable(read, { stableMs = 800, timeoutMs = 10000, intervalMs = 200, same = (a, b) => a === b } = {}) {
    const start = Date.now();
    let prev = read();
    let since = Date.now();
    while (Date.now() - start < timeoutMs) {
      await sleep(intervalMs);
      const next = read();
      if (!same(prev, next)) {
        prev = next;
        since = Date.now();
      } else if (Date.now() - since >= stableMs) {
        return { ok: true, value: next, waitedMs: Date.now() - start, reason: "" };
      }
    }
    return { ok: false, value: prev, waitedMs: Date.now() - start, reason: "kept changing" };
  }

  /**
   * "Fully loaded": check() is truthy, no loaders are visible in root, and root's DOM has been
   * quiet for quietMs. Real pages are never perfectly still (ads, trackers, lazy images), so it
   * degrades instead of failing:
   *   - a loader that stays visible is ignored once check() has been true for loaderGraceMs
   *   - a DOM that never goes quiet is accepted after maxQuietWaitMs if check() is still true
   * The result's `reason` says which shortcut was taken ("" = clean settle).
   */
  async function settled(
    root,
    check = () => true,
    { timeoutMs = 15000, quietMs = 500, maxQuietWaitMs = 1500, loaderGraceMs = 1500, intervalMs = 250, shouldStop = () => false } = {},
  ) {
    const start = Date.now();
    const rootNow = () => (typeof root === "function" ? root() : root);
    const safeCheck = () => {
      try {
        return check();
      } catch {
        return undefined;
      }
    };
    let trueSince = 0;
    let lastReason = "condition never true";
    while (Date.now() - start < timeoutMs) {
      if (shouldStop()) return { ok: false, value: undefined, waitedMs: Date.now() - start, reason: "stopped" };
      const value = safeCheck();
      if (!value) {
        trueSince = 0;
        lastReason = noLoaders(rootNow()) ? "condition never true" : "still loading";
        await sleep(intervalMs);
        continue;
      }
      if (!trueSince) trueSince = Date.now();
      const loadersGone = noLoaders(rootNow());
      if (!loadersGone && Date.now() - trueSince < loaderGraceMs) {
        lastReason = "still loading";
        await sleep(intervalMs);
        continue;
      }
      const quiet = await domQuiet(rootNow(), { quietMs, timeoutMs: maxQuietWaitMs });
      // Re-check a few times: a single read can catch the page mid re-render and flip to false.
      let after = safeCheck();
      for (let i = 0; !after && i < 3; i += 1) {
        await sleep(intervalMs);
        after = safeCheck();
      }
      if (after) {
        const shortcuts = [!loadersGone && "loader stayed visible", !quiet.ok && "page kept changing"].filter(Boolean);
        return { ok: true, value: after, waitedMs: Date.now() - start, reason: shortcuts.join(", ") };
      }
      trueSince = 0;
      lastReason = "changed while settling";
    }
    return { ok: false, value: undefined, waitedMs: Date.now() - start, reason: lastReason };
  }

  global.CPLinkedInWait = { version: 1, sleep, until, noLoaders, domQuiet, stable, settled, LOADER_SELECTOR };
})(typeof window !== "undefined" ? window : globalThis);
