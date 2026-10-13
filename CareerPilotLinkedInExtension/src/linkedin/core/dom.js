/*
 * LinkedIn Jobs DOM resolver: update-safe detection with fallback chains.
 *
 * LinkedIn renames CSS classes often, so every question ("where are the job tiles?",
 * "what is this tile's job id?", "is it applied?", "where is the detail pane?") is answered
 * by an ordered list of strategies. The first strategy that gives a plausible answer wins,
 * and the result reports which one it was, so breakages are visible instead of silent.
 *
 * Shared by the content script (loaded before linkedin/jobs/*) and the probes in tools/probes/out/.
 * No dependencies; exposes globalThis.CPLinkedInDom.
 */
(function initCPLinkedInDom(global) {
  if (global.CPLinkedInDom) return;

  const JOB_ID_RE = /(\d{9,11})/;
  const JOB_REF_PATTERNS = [
    /jobPosting[:(%3A]+(\d{6,})/i, // urn:li:jobPosting:123 / fsd_jobPosting:123
    /\/jobs\/view\/(\d{6,})/,
    /[?&]currentJobId=(\d{6,})/,
    /[?&]jobId=(\d{6,})/,
    /job[-_]?(?:posting|card|id)[-_:=]+(\d{9,11})/i,
    /job-card-component-ref-(\d{6,})/, // componentkey of the 2026 class-free job cards
  ];
  const APPLIED_RE =
    /^(you )?(applied|application (submitted|sent|viewed))( (\d+|a|an) (second|minute|hour|day|week|month|year)s? ago| on [a-z ]+| [·•].*)?$/;
  const TILE_WORDS_RE =
    /^(easy apply|promoted|viewed|applied|verified( job)?|actively (reviewing|recruiting)( applicants)?|be an early applicant|\d+ (applicants?|connections?|alumni)|(reposted )?\d+ (minutes?|hours?|days?|weeks?|months?) ago|new)$/;

  const KNOWN_TILE_SELECTORS = [
    ".job-card-container",
    "li.jobs-search-results__list-item",
    ".jobs-search-results-list__list-item",
    "li.scaffold-layout__list-item",
  ];
  const DATA_TILE_SELECTORS = [
    // 2026 class-free layout: <div role="button" componentkey="job-card-component-ref-<jobId>">
    "[componentkey^='job-card-component-ref-']",
    "[data-occludable-job-id]",
    "[data-job-id]",
    "[data-view-name='job-card']",
    "[data-view-name*='job-search-card']",
    "[data-view-name*='job-card']",
  ];
  const KNOWN_DETAIL_SELECTORS = [
    ".jobs-search__job-details",
    ".jobs-details",
    ".job-details-jobs-unified-top-card",
    ".jobs-unified-top-card",
    ".jobs-details-top-card",
    ".scaffold-layout__detail",
  ];
  const DATA_DETAIL_SELECTORS = [
    // 2026 layout: <div data-sdui-screen="com.linkedin.sdui.flagshipnav.jobs.SemanticJobDetails">
    "[data-sdui-screen*='JobDetails' i]",
    "[data-view-name*='job-details']",
    "[data-view-name*='job-detail']",
    "[data-view-name*='jobs-details']",
    "[data-view-name*='top-card']",
  ];

  const norm = (t) => String(t || "").toLowerCase().replace(/\s+/g, " ").trim();
  const linesOf = (el) =>
    String(el?.innerText || el?.textContent || "")
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
  // Page chrome, LinkedIn messaging, and our own injected UI (copilot panel, widgets, probe labels),
  // which would otherwise look like a "repeated list" of tiles.
  const EXCLUDED_REGIONS = [
    "header",
    "nav",
    "footer",
    "[role='banner']",
    "[role='navigation']",
    "#msg-overlay",
    ".msg-overlay-container",
    "[id^='cp-']",
    "#li-wa-widget",
    "#li-email-widget",
    "#li-autocommenter-widget",
    "#jso-panel",
    "#jso-post-selector",
    ".cp-probe-label",
  ].join(", ");
  const isChrome = (el) => Boolean(el?.closest?.(EXCLUDED_REGIONS));
  const isVisible = (el) => {
    if (!el?.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  function isAppliedLine(text) {
    const t = norm(text);
    return t.length > 0 && t.length <= 60 && APPLIED_RE.test(t);
  }

  function jobIdFromString(value) {
    const raw = String(value || "");
    for (const re of JOB_REF_PATTERNS) {
      const m = raw.match(re);
      if (m?.[1]) return m[1];
    }
    return "";
  }

  /** All distinct job ids referenced by an element and its descendants (attributes only). */
  function jobIdsIn(el, { includeBareNumbers = false } = {}) {
    const ids = new Set();
    const nodes = [el, ...el.querySelectorAll("*")];
    for (const node of nodes) {
      for (const attr of node.attributes || []) {
        if (attr.name === "class" || attr.name === "style") continue;
        const fromRef = jobIdFromString(attr.value);
        if (fromRef) ids.add(fromRef);
        else if (includeBareNumbers && /job|occludable|entity|urn|componentkey/i.test(attr.name)) {
          const m = String(attr.value).match(JOB_ID_RE);
          if (m) ids.add(m[1]);
        }
      }
    }
    return ids;
  }

  function hashText(text) {
    let h = 0;
    for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
    return `txt:${(h >>> 0).toString(36)}`;
  }

  // ---------------------------------------------------------------- job id of a tile
  const JOB_ID_STRATEGIES = [
    [
      "data-attr",
      (tile) => {
        for (const v of [
          tile.getAttribute("data-occludable-job-id"),
          tile.closest("[data-occludable-job-id]")?.getAttribute("data-occludable-job-id"),
          tile.getAttribute("data-job-id"),
          // 2026 layout: componentkey="job-card-component-ref-<jobId>" on the card (or its inner div)
          (tile.getAttribute("componentkey") || tile.querySelector("[componentkey^='job-card-component-ref-']")?.getAttribute("componentkey") || "").match(/^job-card-component-ref-(\d+)$/)?.[1],
          tile.querySelector("[data-job-id], [data-occludable-job-id]")?.getAttribute("data-job-id") ||
            tile.querySelector("[data-occludable-job-id]")?.getAttribute("data-occludable-job-id"),
        ]) {
          if (/^\d+$/.test(String(v || "").trim())) return String(v).trim();
        }
        return "";
      },
    ],
    [
      "job-ref-attr",
      (tile) => {
        const ids = jobIdsIn(tile);
        return ids.size === 1 ? [...ids][0] : "";
      },
    ],
    [
      "link",
      (tile) => jobIdFromString(tile.querySelector("a[href*='/jobs/view/'], a[href*='currentJobId=']")?.href),
    ],
    [
      "numeric-attr",
      (tile) => {
        const ids = jobIdsIn(tile, { includeBareNumbers: true });
        return ids.size === 1 ? [...ids][0] : "";
      },
    ],
    [
      "selected-url",
      (tile) => {
        const selected =
          tile.matches("[aria-current='true'], [aria-selected='true'], [aria-current='page']") ||
          Boolean(tile.querySelector("[aria-current='true'], [aria-selected='true'], [aria-current='page']")) ||
          /active|selected/i.test(String(tile.className || ""));
        return selected ? jobIdFromString(location.href) : "";
      },
    ],
    [
      "text-hash",
      (tile) => {
        const lines = tileLines(tile).filter((l) => !TILE_WORDS_RE.test(norm(l))).slice(0, 3);
        return lines.length ? hashText(norm(lines.join("|"))) : "";
      },
    ],
  ];

  function jobIdOf(tile) {
    if (!tile) return { id: "", via: "none" };
    for (const [via, fn] of JOB_ID_STRATEGIES) {
      try {
        const id = fn(tile);
        if (id) return { id, via };
      } catch {
        // try next strategy
      }
    }
    return { id: "", via: "none" };
  }

  // ---------------------------------------------------------------- tiles
  /** Climb from a seed element to the largest ancestor that still contains exactly one job. */
  function climbToTile(seed, seedId) {
    let best = seed;
    let node = seed;
    while (node?.parentElement && node.parentElement !== document.body) {
      const parent = node.parentElement;
      if (parent.matches("main, header, nav, [role='main']") || parent.querySelector("header, nav")) break;
      if (linesOf(parent).join(" ").length > 1500) break;
      const ids = jobIdsIn(parent);
      if (ids.size > 1 || (seedId && ids.size === 1 && !ids.has(seedId))) break;
      best = parent;
      node = parent;
    }
    return best;
  }

  /** Outermost elements only, excluding the detail pane and page chrome. */
  function cleanTiles(elements, detailPane) {
    const list = Array.from(new Set(elements)).filter(
      (el) => el && !isChrome(el) && (!detailPane || !detailPane.contains(el)),
    );
    return list.filter((el) => !list.some((other) => other !== el && other.contains(el)));
  }

  function tilesFromSeeds(seeds, detailPane) {
    const tiles = [];
    const seen = new Set();
    for (const seed of seeds) {
      if (detailPane?.contains(seed) || isChrome(seed)) continue;
      const id = [...jobIdsIn(seed)][0] || jobIdFromString(seed.href);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      tiles.push(climbToTile(seed, id));
    }
    return seen.size >= 2 ? cleanTiles(tiles, detailPane) : [];
  }

  /** Largest group of same-tag siblings that each look like a job tile. */
  function repeatedSiblingGroups(minCount, detailPane, predicate) {
    const groups = [];
    for (const parent of document.querySelectorAll("ul, ol, div, section")) {
      if (isChrome(parent) || (detailPane && detailPane.contains(parent))) continue;
      const kids = Array.from(parent.children).filter((k) => {
        const text = linesOf(k).join(" ");
        return text.length >= 15 && text.length <= 900 && predicate(k);
      });
      if (kids.length < minCount) continue;
      const tag = kids[0].tagName;
      if (!kids.every((k) => k.tagName === tag)) continue;
      // Real job tiles usually carry words like "Easy Apply", "Promoted", "Viewed", "3 days ago".
      const withTileWords = kids.filter((k) => linesOf(k).some((l) => TILE_WORDS_RE.test(norm(l)))).length;
      groups.push({ parent, kids, score: kids.length + withTileWords * 3 });
    }
    groups.sort((a, b) => b.score - a.score);
    return groups[0]?.kids || [];
  }

  const TILE_STRATEGIES = [
    ["known-classes", (pane) => cleanTiles(document.querySelectorAll(KNOWN_TILE_SELECTORS.join(", ")), pane)],
    ["data-attributes", (pane) => cleanTiles(document.querySelectorAll(DATA_TILE_SELECTORS.join(", ")), pane)],
    [
      "job-ref-attributes",
      (pane) => {
        const seeds = [];
        for (const el of document.querySelectorAll("body *")) {
          for (const attr of el.attributes) {
            if (attr.name !== "class" && attr.name !== "style" && jobIdFromString(attr.value)) {
              seeds.push(el);
              break;
            }
          }
        }
        return tilesFromSeeds(seeds, pane);
      },
    ],
    ["job-links", (pane) => tilesFromSeeds(document.querySelectorAll("a[href*='/jobs/view/'], a[href*='currentJobId=']"), pane)],
    [
      "repeated-list",
      (pane) =>
        repeatedSiblingGroups(5, pane, (k) => {
          const lines = linesOf(k);
          return lines.length >= 2 && lines.length <= 14 && isVisible(k);
        }),
    ],
    [
      "tile-words",
      (pane) =>
        repeatedSiblingGroups(3, pane, (k) => linesOf(k).some((l) => TILE_WORDS_RE.test(norm(l)))),
    ],
  ];

  /**
   * Finds job tiles on a search results page.
   * Returns { tiles, strategy, attempts: [{ strategy, count, error? }] }.
   */
  let lastTileStrategy = "";
  // The list element that held the tiles last time, so passive callers can skip detection.
  let lastTileList = null;
  const CHEAP_TILE_STRATEGIES = new Set(["known-classes", "data-attributes", "job-links"]);

  function tilesFromList(list) {
    return Array.from(list.children).filter((k) => !isChrome(k) && String(k.textContent || "").trim().length >= 15);
  }

  /**
   * passive: true is for background repaints. It reuses the last tile list and never runs the
   * full-page fallbacks (job-ref-attributes, repeated-list, tile-words), which are expensive.
   */
  function findJobTiles({ minTiles = 2, passive = false } = {}) {
    if (passive && lastTileList?.isConnected) {
      const tiles = tilesFromList(lastTileList);
      if (tiles.length >= minTiles) return { tiles, strategy: `${lastTileStrategy}(cached)`, attempts: [] };
    }
    const pane = findDetailPane().element;
    const attempts = [];
    // Try the strategy that worked last time first: later strategies scan the whole page,
    // and this runs on every DOM change. Falls back to the full chain if it stops matching.
    const ordered = lastTileStrategy
      ? [...TILE_STRATEGIES.filter(([n]) => n === lastTileStrategy), ...TILE_STRATEGIES.filter(([n]) => n !== lastTileStrategy)]
      : TILE_STRATEGIES;
    for (const [strategy, fn] of ordered) {
      if (passive && !CHEAP_TILE_STRATEGIES.has(strategy)) continue;
      try {
        const tiles = fn(pane).filter((t) => t.isConnected);
        attempts.push({ strategy, count: tiles.length });
        if (tiles.length >= minTiles) {
          lastTileStrategy = strategy;
          const list = tiles[0].parentElement;
          lastTileList = list && tiles.every((t) => t.parentElement === list) ? list : null;
          return { tiles, strategy, attempts };
        }
      } catch (error) {
        attempts.push({ strategy, count: 0, error: String(error?.message || error) });
      }
    }
    return { tiles: [], strategy: "none", attempts };
  }

  // ---------------------------------------------------------------- applied state
  const APPLIED_STRATEGIES = [
    [
      "footer-classes",
      (tile, outside) =>
        Array.from(
          tile.querySelectorAll(
            ".job-card-container__footer-job-state, .job-card-container__footer-item, .job-card-list__footer-wrapper li, .job-card-container__footer-wrapper li, .jobs-card__listdate",
          ),
        ).some((n) => outside(n) && isAppliedLine(n.textContent)),
    ],
    [
      "leaf-text",
      (tile, outside) =>
        Array.from(tile.querySelectorAll("li, span, time, strong, p, div, small")).some(
          (n) => n.childElementCount === 0 && outside(n) && isAppliedLine(n.textContent),
        ),
    ],
    ["text-lines", (tile) => linesOf(tile).some(isAppliedLine)],
    [
      "aria-label",
      (tile, outside) =>
        Array.from(tile.querySelectorAll("[aria-label]")).some(
          (n) => outside(n) && isAppliedLine(n.getAttribute("aria-label")),
        ),
    ],
    [
      "status-attribute",
      (tile) =>
        Array.from(tile.querySelectorAll("[data-test-job-state], [data-job-state], [data-state]")).some((n) =>
          /applied|submitted/i.test(
            `${n.getAttribute("data-test-job-state") || ""} ${n.getAttribute("data-job-state") || ""} ${n.getAttribute("data-state") || ""}`,
          ),
        ),
    ],
  ];

  /** Returns the name of the first strategy that sees an "Applied" marker on the tile, or "". */
  function appliedMethodOf(tile) {
    if (!tile?.querySelectorAll) return "";
    const titleLink = tile.querySelector("a[href*='/jobs/view/'], a[href*='currentJobId=']");
    const outside = (n) => !titleLink || !titleLink.contains(n);
    for (const [name, fn] of APPLIED_STRATEGIES) {
      try {
        if (fn(tile, outside)) return name;
      } catch {
        // try next strategy
      }
    }
    return "";
  }

  /** All strategies' verdicts (for the probe). */
  function appliedReport(tile) {
    const titleLink = tile.querySelector("a[href*='/jobs/view/'], a[href*='currentJobId=']");
    const outside = (n) => !titleLink || !titleLink.contains(n);
    return APPLIED_STRATEGIES.filter(([, fn]) => {
      try {
        return fn(tile, outside);
      } catch {
        return false;
      }
    }).map(([name]) => name);
  }

  function hasEasyApply(tile) {
    return (
      linesOf(tile).some((l) => norm(l).includes("easy apply")) ||
      Boolean(tile.querySelector("[aria-label*='Easy Apply' i]"))
    );
  }

  // ---------------------------------------------------------------- detail pane
  const APPLY_BUTTON_RE = /^(easy apply|apply|applied|apply now|continue applying)\b/;

  function findApplyButton(root = document) {
    for (const el of root.querySelectorAll("button, a[role='button'], a")) {
      if (isChrome(el)) continue;
      const label = norm(`${el.getAttribute("aria-label") || ""}`) || norm(el.textContent);
      if (APPLY_BUTTON_RE.test(label) || /^(easy )?apply to\b/.test(label)) return el;
    }
    return null;
  }

  /**
   * Largest ancestor of `el` that is still about ONE job: stops before it would contain several
   * job ids (that would be the results list too), then returns the biggest candidate that has a
   * heading and a decent amount of text.
   */
  /** Does `root` contain a list: an element with 3+ same-tag children that each hold a few lines of text? */
  function containsList(root) {
    for (const el of [root, ...root.querySelectorAll("ul, ol, div, section")]) {
      const kids = Array.from(el.children).filter((k) => {
        const n = linesOf(k).length;
        return n >= 2 && n <= 14 && linesOf(k).join(" ").length <= 900;
      });
      if (kids.length >= 3 && kids.every((k) => k.tagName === kids[0].tagName)) return true;
    }
    return false;
  }

  function paneAround(el) {
    let node = el;
    let best = null;
    while (node?.parentElement && node.parentElement !== document.body) {
      const parent = node.parentElement;
      if (parent.matches("main, [role='main']") || isChrome(parent)) break;
      // Stop before swallowing the results list: more than one job id, or a sibling branch that is a list.
      if (jobIdsIn(parent, { includeBareNumbers: true }).size > 1) break;
      if (Array.from(parent.children).some((sib) => sib !== node && !isChrome(sib) && containsList(sib))) break;
      node = parent;
      if (node.querySelector("h1, h2, h3") && linesOf(node).join(" ").length > 400) best = node;
    }
    return best;
  }

  /**
   * The open job's details column on the class-free layout: the top card (company link, title link
   * to /jobs/view/<id>, "Location · 3 days ago · applicants", chips, Apply/Save) and the "About the
   * job" section are SIBLINGS without a common heading. Start at "About the job" and climb until the
   * container also holds a link to the open job (id from the URL), stopping before the results list
   * (more than one job id).
   */
  function jobColumn() {
    const id = jobIdFromString(location.href);
    if (!id) return null;
    const about = Array.from(document.querySelectorAll("h1, h2, h3, h4")).find(
      (h) => !isChrome(h) && /^(about the job|job description)$/.test(norm(h.textContent)),
    );
    if (!about) return null;
    const ownLink = `a[href*='/jobs/view/${id}'], a[href*='currentJobId=${id}']`;
    for (let node = about.parentElement; node && node !== document.body; node = node.parentElement) {
      if (node.matches("main, [role='main']") || isChrome(node)) break;
      if (jobIdsIn(node).size > 1) break; // reached the results list
      if (node.querySelector(ownLink)) return node;
    }
    return null;
  }

  const DETAIL_STRATEGIES = [
    ["known-classes", () => document.querySelector(KNOWN_DETAIL_SELECTORS.join(", "))],
    ["data-view-name", () => document.querySelector(DATA_DETAIL_SELECTORS.join(", "))],
    ["job-column", jobColumn],
    [
      "apply-button",
      () => {
        const btn = findApplyButton();
        return btn ? paneAround(btn) : null;
      },
    ],
    [
      "job-heading",
      () => {
        for (const h of document.querySelectorAll("h1, h2")) {
          if (isChrome(h)) continue;
          const pane = paneAround(h);
          if (pane && /about the job|job description|about the company/i.test(pane.innerText || "")) return pane;
        }
        return null;
      },
    ],
    [
      "scroll-column",
      () => {
        let best = null;
        let bestScore = 0;
        for (const el of document.querySelectorAll("div, section, main > *")) {
          if (el.scrollHeight <= el.clientHeight + 50 || isChrome(el)) continue;
          // textContent, not innerText: innerText forces a layout for every element checked.
          const text = String(el.textContent || "");
          if (!/about the job|job description/i.test(text)) continue;
          const score = text.length;
          if (score > bestScore) {
            best = el;
            bestScore = score;
          }
        }
        return best;
      },
    ],
  ];

  let paneCache = null;

  /** Returns { element, strategy, attempts }. Cached for ~1.5s while the element stays attached. */
  function findDetailPane({ fresh = false } = {}) {
    // A "no pane" result is cached too: otherwise every call re-runs the full-page fallbacks.
    if (!fresh && paneCache && (paneCache.element ? paneCache.element.isConnected : true) && Date.now() - paneCache.at < 1500) {
      return paneCache.result;
    }
    const result = findDetailPaneUncached();
    paneCache = { element: result.element, result, at: Date.now() };
    return result;
  }

  function findDetailPaneUncached() {
    const attempts = [];
    for (const [strategy, fn] of DETAIL_STRATEGIES) {
      try {
        const element = fn();
        attempts.push({ strategy, found: Boolean(element) });
        if (element) return { element, strategy, attempts };
      } catch (error) {
        attempts.push({ strategy, found: false, error: String(error?.message || error) });
      }
    }
    return { element: null, strategy: "none", attempts };
  }

  /** Returns how the open job's pane shows it as applied, or "". */
  function detailAppliedMethod(pane = findDetailPane().element) {
    if (!pane) return "";
    if (pane.querySelector(".jobs-apply-button--applied, .post-apply-timeline")) return "applied-class";
    const btn = findApplyButton(pane);
    if (btn && /^applied\b/.test(norm(btn.getAttribute("aria-label") || btn.textContent))) return "applied-button";
    for (const node of pane.querySelectorAll("a, button")) {
      const label = norm(`${node.getAttribute("aria-label") || ""} ${node.textContent || ""}`);
      if (/^(see|view) (your )?application\b/.test(label) || /^application status\b/.test(label)) return "see-application";
    }
    for (const node of pane.querySelectorAll("span, li, p, div, time, small, strong")) {
      if (node.childElementCount === 0 && isAppliedLine(node.textContent)) return "status-text";
    }
    return "";
  }

  // ---------------------------------------------------------------- opening a tile
  /** Dispatches the full pointer/mouse sequence a real click produces (some handlers ignore bare .click()). */
  function realClick(el) {
    const r = el.getBoundingClientRect();
    // composed: true like a real click, so it crosses shadow-root boundaries (LinkedIn's interop
    // layer renders some UI, e.g. dialogs, inside shadow DOM).
    const opts = { bubbles: true, cancelable: true, composed: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + Math.min(r.height / 2, 20), button: 0 };
    el.dispatchEvent(new PointerEvent("pointerdown", { ...opts, pointerType: "mouse", isPrimary: true }));
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new PointerEvent("pointerup", { ...opts, pointerType: "mouse", isPrimary: true }));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));
  }

  /**
   * Ordered elements to click to open a tile's job: title's clickable element, the title text,
   * a job link, a button inside the tile, the tile itself. Never company/profile links or
   * dismiss/save/hide controls.
   */
  function clickTargetsFor(tile) {
    const targets = [];
    const okEl = (el) => {
      if (!el || !tile.contains(el) || el.closest(INJECTED_LABELS)) return false;
      if (el.tagName === "A" && !/\/jobs\//.test(el.getAttribute("href") || "")) return false;
      const label = norm(`${el.getAttribute?.("aria-label") || ""} ${el.textContent || ""}`);
      return !/^(dismiss|save|unsave|hide|not interested)\b|dismiss .* job/.test(label);
    };
    const add = (el, via) => {
      if (okEl(el) && !targets.some((t) => t.el === el)) targets.push({ el, via });
    };
    const title = norm(tileTitle(tile));
    const titleEl = Array.from(tile.querySelectorAll("*")).find(
      (e) => e.childElementCount === 0 && !e.closest(INJECTED_LABELS) && title && norm(e.textContent) === title,
    );
    if (titleEl) {
      add(titleEl.closest("a[href*='/jobs/'], [role='button'], button, [tabindex]"), "title-clickable");
      add(titleEl, "title-text");
    }
    add(tile.querySelector("a[href*='/jobs/view/'], a[href*='currentJobId=']"), "job-link");
    add(
      Array.from(tile.querySelectorAll("[role='button'], [tabindex='0']")).find((el) => okEl(el)),
      "tile-button",
    );
    if (tile !== document.body) targets.push({ el: tile, via: "tile" });
    return targets;
  }

  /**
   * Clicks through clickTargetsFor(tile) until the job opens (URL job id or pane heading matches).
   * Resolves { opened, via, tried }.
   */
  async function openTile(tile, { jobId = "", title = "", perTargetMs = 3000 } = {}) {
    const tried = [];
    const opened = () => {
      const urlId = jobIdFromString(location.href);
      if (/^\d+$/.test(jobId) && urlId === jobId) return true;
      const pane = findDetailPane({ fresh: true }).element;
      return Boolean(title && pane && titlesMatch(jobHeading(pane), title));
    };
    if (opened()) return { opened: true, via: "already-open", tried };
    for (const { el, via } of clickTargetsFor(tile)) {
      tried.push(via);
      try {
        el.scrollIntoView({ block: "center" });
        realClick(el);
      } catch {
        continue;
      }
      const start = Date.now();
      while (Date.now() - start < perTargetMs) {
        await new Promise((r) => setTimeout(r, 150));
        if (opened()) return { opened: true, via, tried };
      }
    }
    return { opened: false, via: "", tried };
  }

  // ---------------------------------------------------------------- readiness of the open job
  const INJECTED_LABELS = ".cp-probe-label, .cp-card-outcome-tag, .cp-card-live-badge, .cp-detail-live-indicator";
  const LOADING_SELECTORS =
    "[aria-busy='true'], .artdeco-loader, [class*='skeleton' i], [class*='shimmer' i], [class*='placeholder-loading' i]";
  const CLOSED_RE = /no longer accepting applications|this job is closed|job (has )?expired/i;

  /** Text lines of a tile, ignoring labels injected by the extension or the probes. */
  function tileLines(tile) {
    const injected = new Set();
    for (const el of tile?.querySelectorAll?.(INJECTED_LABELS) || []) {
      for (const line of linesOf(el)) injected.add(line);
    }
    return linesOf(tile).filter((l) => !injected.has(l));
  }

  const GENERIC_HEADING_RE =
    /^(about the (job|company)|job description|are these results helpful|people (also )?viewed|similar jobs|more jobs|meet the hiring team|premium|skills|how you match|unlock hiring insights|people you can reach out to|interested in working with us|company photos|benefits|job match|pay found in job post|set alert)/;

  /** The job title heading of a pane (first h1/h2/h3 that is not a generic section heading). */
  function jobHeading(pane) {
    for (const h of pane?.querySelectorAll?.("h1, h2, h3") || []) {
      const t = norm(h.textContent);
      if (t && !GENERIC_HEADING_RE.test(t)) return t;
    }
    return "";
  }

  /** The tile's job title: first text line that is not a badge/status word ("Verified", "Promoted"...). */
  function tileTitle(tile) {
    return tileLines(tile).find((l) => l.length > 2 && !TILE_WORDS_RE.test(norm(l))) || "";
  }

  function titlesMatch(a, b) {
    const x = norm(a).replace(/[^a-z0-9 ]/g, "").slice(0, 30);
    const y = norm(b).replace(/[^a-z0-9 ]/g, "").slice(0, 30);
    if (!x || !y) return false;
    return x.includes(y.slice(0, 20)) || y.includes(x.slice(0, 20));
  }

  /**
   * Is the job details pane fully loaded for this job? Checks each condition separately so a
   * caller can report which one never became true.
   * Pass { jobId, title } of the tile that was clicked.
   */
  function detailReadiness({ jobId = "", title = "" } = {}) {
    const pane = findDetailPane().element;
    if (!pane) return { ready: false, pane: false };
    const urlJobId = jobIdFromString(location.href);
    const heading = jobHeading(pane);
    const idMatch = /^\d+$/.test(jobId) ? urlJobId === jobId : true;
    const titleMatch = title ? titlesMatch(heading, title) : true;
    const btn = findApplyButton(pane);
    const applied = detailAppliedMethod(pane);
    const closed = CLOSED_RE.test(pane.innerText || "");
    const action = applied ? "applied" : btn ? "button" : closed ? "closed" : "";
    const loading = Array.from(pane.querySelectorAll(LOADING_SELECTORS)).some((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const textLength = String(pane.innerText || "").length;
    const description = linesOf(pane).filter((l) => l.length > 40).slice(0, 3).join(" ").slice(0, 300);
    const signature = `${heading}|${action}|${norm(btn?.getAttribute("aria-label") || btn?.textContent || "")}|${description}`;
    return {
      signature,
      ready: Boolean((idMatch || titleMatch) && action && !loading),
      pane: true,
      idMatch,
      titleMatch,
      action,
      loading,
      textLength,
      urlJobId,
      heading: heading.slice(0, 80),
    };
  }

  /**
   * Waits until detailReadiness() is true and the pane text has stopped changing for `stableMs`.
   * Resolves { ready, waitedMs, last } where `last` is the final readiness snapshot.
   */
  async function waitForJobReady(target, { timeoutMs = 12000, stableMs = 700, intervalMs = 200 } = {}) {
    const start = Date.now();
    let last = null;
    let stableSince = 0;
    let lastLength = -1;
    while (Date.now() - start < timeoutMs) {
      last = detailReadiness(target);
      if (last.ready) {
        if (last.signature === lastLength) {
          if (!stableSince) stableSince = Date.now();
          if (Date.now() - stableSince >= stableMs) return { ready: true, waitedMs: Date.now() - start, last };
        } else {
          stableSince = 0;
        }
      } else {
        stableSince = 0;
      }
      lastLength = last.signature ?? -1;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return { ready: false, waitedMs: Date.now() - start, last };
  }

  // ---------------------------------------------------------------- apply action (class-free)
  const isDisabledControl = (el) => el.disabled === true || el.getAttribute("aria-disabled") === "true";
  const FILTER_AREA = "[class*='filter' i], [aria-label*='filter' i], [role='toolbar']";
  const EASY_APPLY_LABEL_RE = /^easy apply\b/;
  const EXTERNAL_APPLY_LABEL_RE = /^(apply|apply now|apply on company (website|site)|continue applying)\b/;

  /**
   * The open job's apply control without relying on LinkedIn class names: any visible, enabled
   * button / link / role=button in the details panel whose label STARTS with the apply words
   * (tile links start with the job title, so they never match).
   * Returns { type: "easy" | "external" | "none", button }.
   */
  function findApplyAction(root = findDetailPane().element) {
    if (!root) return { type: "none", button: null };
    let external = null;
    for (const el of root.querySelectorAll("button, a[href], [role='button']")) {
      if (isChrome(el) || isDisabledControl(el) || el.closest(FILTER_AREA) || !isVisible(el)) continue;
      const label = norm(el.getAttribute("aria-label")) || norm(el.textContent);
      if (EASY_APPLY_LABEL_RE.test(label)) return { type: "easy", button: el };
      if (!external && EXTERNAL_APPLY_LABEL_RE.test(label)) external = el;
    }
    return external ? { type: "external", button: external } : { type: "none", button: null };
  }

  global.CPLinkedInDom = {
    version: 2,
    tileLines,
    tileTitle,
    jobHeading,
    realClick,
    clickTargetsFor,
    openTile,
    detailReadiness,
    waitForJobReady,
    isAppliedLine,
    jobIdFromString,
    jobIdOf,
    findJobTiles,
    appliedMethodOf,
    appliedReport,
    hasEasyApply,
    findDetailPane,
    findApplyButton,
    findApplyAction,
    detailAppliedMethod,
    strategies: {
      tiles: TILE_STRATEGIES.map(([n]) => n),
      jobId: JOB_ID_STRATEGIES.map(([n]) => n),
      applied: APPLIED_STRATEGIES.map(([n]) => n),
      detail: DETAIL_STRATEGIES.map(([n]) => n),
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
