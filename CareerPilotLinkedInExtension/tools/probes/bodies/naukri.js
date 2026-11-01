// Naukri probe - learn Naukri.com's pages before building the Naukri auto-apply module.
// Known selectors and the apply API come from docs/NAUKRI_RESEARCH.md; this checks them on the live site.
// Read-only: it NEVER clicks anything. Paste on a Naukri page while logged in:
//   - a search results page (naukri.com/<role>-jobs...): maps the job cards and pagination;
//   - a job page (naukri.com/job-listings-...): maps the job facts and every Apply-type button.
// WATCH (CONFIG.watchSeconds): while it runs, click Apply YOURSELF on a job you really want and answer
// the screening chatbot by hand. It records every drawer / question / input / button that appears and
// every Naukri API call (path, method, status, header NAMES only). Typed values, cookies, tokens,
// emails and phone numbers are never recorded.
// Downloads ONE .json file and keeps it in window.__cpNaukri. Stop early with cpNaukriStop().
(async () => {
  // ------------------------------------------------------------------ settings (edit before pasting)
  const CONFIG = {
    watchSeconds: 180, // 0 = snapshot only; otherwise record what appears while you apply by hand
    snapshotEveryMs: 400, // how often the watch looks for new drawers / questions
    maxNetworkCalls: 300,
    maxCards: 8, // sample cards read in full (all are counted)
    ...(window.__cpNaukriOptions || {}),
  };

  console.log("%cAutoApply CV - Naukri probe", "font-weight:700;color:#6366f1");
  if (!/(^|\.)naukri\.com$/i.test(location.hostname)) {
    return console.error("Open a naukri.com page first (search results or a job page).");
  }

  // ------------------------------------------------------------------ helpers
  const clean = (t) => String(t || "").replace(/\s+/g, " ").trim();
  // Never store personal data: emails, phone numbers, long digit runs.
  const redact = (t) =>
    clean(t)
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<email>")
      .replace(/(\+?\d[\d\s-]{8,}\d)/g, "<number>")
      .slice(0, 300);
  const isVisible = (el) => {
    const r = el?.getBoundingClientRect?.();
    return Boolean(r && r.width > 0 && r.height > 0);
  };
  const generalise = (v) =>
    String(v)
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
      .replace(/\d{6,}/g, "<id>");
  /** tag#id.classes[data-*][role][aria-label] - the markers a selector could use. */
  function signature(el) {
    if (!el || el.nodeType !== 1) return "";
    let s = el.tagName.toLowerCase();
    if (el.id) s += `#${generalise(el.id)}`;
    const classes = Array.from(el.classList || []).slice(0, 6).map(generalise);
    if (classes.length) s += `.${classes.join(".")}`;
    for (const a of Array.from(el.attributes || [])) {
      if (/^(data-|role$|aria-label$|type$|name$|title$)/.test(a.name) && !/^data-(gtm|ga|track)/.test(a.name)) {
        s += `[${a.name}${a.value ? `="${generalise(a.value).slice(0, 40)}"` : ""}]`;
      }
    }
    return s;
  }
  /** Signatures from el up to 4 parents, to see which wrapper is stable. */
  const path = (el, depth = 4) => {
    const out = [];
    for (let n = el; n && n.nodeType === 1 && out.length <= depth; n = n.parentElement) out.push(signature(n));
    return out;
  };
  const pageType = () => {
    if (/\/job-listings-/i.test(location.pathname)) return "job";
    if (/-jobs(-in-[\w-]+)?(-\d+)?$/i.test(location.pathname) || /\/jobs?(\/|$)/i.test(location.pathname) || location.search.includes("k=")) return "search";
    if (/\/mnjuser\/(homepage|recommendedjobs)/i.test(location.pathname)) return "recommended";
    return "other";
  };
  // URL without personal query values: keep parameter names, drop values except paging/sort.
  const safeUrl = (u = location.href) => {
    try {
      const url = new URL(u, location.href);
      const keep = new Set(["pageNo", "page", "sort", "experience", "jobAge", "wfhType"]);
      const params = Array.from(url.searchParams.keys()).map((k) => (keep.has(k) ? `${k}=${url.searchParams.get(k)}` : `${k}=…`));
      return `${url.origin}${generalise(url.pathname)}${params.length ? `?${params.join("&")}` : ""}`;
    } catch {
      return "";
    }
  };

  // ------------------------------------------------------------------ known selectors
  // Selectors used by recent open-source Naukri bots (see docs/NAUKRI_RESEARCH.md). The probe checks
  // which of them still match today, so the module is built on the ones that work.
  const KNOWN = {
    searchCard: ".srp-jobtuple-wrapper",
    searchCardTitle: ".srp-jobtuple-wrapper a.title",
    recommendedCard: "article.jobTuple",
    recommendedCheckbox: ".tuple-check-box",
    multiApply: ".multi-apply-button",
    applyButton: "#apply-button",
    companySiteButton: "#company-site-button",
    alreadyApplied: "#already-applied",
    applyContainer: "[class*='apply-button-container']",
    chatbotDrawer: "[id*='ChatbotContainer'], .chatbot_Drawer",
    chatbotMessages: ".chatbot_MessageContainer",
    botQuestion: ".chatbot_ListItem.botItem .msg, .chatbot_ListItem .botMsg .msg",
    userReply: ".chatbot_ListItem.userItem .msg, .userMsg .msg",
    textArea: ".textArea[contenteditable='true']",
    radio: ".ssrc__radio",
    radioLabel: ".ssrc__label",
    checkboxGroup: ".multiselectcheckboxes, .multicheckboxes-container",
    checkboxLabel: ".mcc__label",
    chip: ".chatbot_Chip",
    select: ".chatbot_MessageContainer select",
    dob: ".dob__container",
    sendWrapper: "[id^='sendMsg__']",
    sendButton: ".sendMsg",
    overlay: ".chatbot_Overlay",
  };
  function knownSelectors() {
    const out = {};
    for (const [name, sel] of Object.entries(KNOWN)) {
      const els = Array.from(document.querySelectorAll(sel));
      if (!els.length) continue;
      out[name] = {
        count: els.length,
        visible: els.filter(isVisible).length,
        first: signature(els[0]),
        text: redact(els[els.length - 1].textContent).slice(0, 120),
        disabled: /disabled/.test(els[0].className) || Boolean(els[0].disabled),
      };
    }
    return out;
  }

  // ------------------------------------------------------------------ job cards (search pages)
  /** Cards = the smallest repeated element that contains exactly one /job-listings- link. */
  function findCards() {
    const links = Array.from(document.querySelectorAll("a[href*='/job-listings-']")).filter(isVisible);
    const cards = new Map();
    for (const link of links) {
      let card = link;
      for (let n = link.parentElement; n && n !== document.body; n = n.parentElement) {
        const inside = new Set(Array.from(n.querySelectorAll("a[href*='/job-listings-']")).map((a) => a.href.split("?")[0]));
        if (inside.size > 1) break;
        card = n;
      }
      cards.set(card, link);
    }
    return Array.from(cards.entries());
  }
  function readCard(card, link) {
    const text = (sel) => clean(card.querySelector(sel)?.textContent);
    const idFromUrl = (link.href.match(/-(\d{6,})(?:[?#]|$)/) || [])[1] || "";
    return {
      signature: signature(card),
      path: path(card, 3),
      jobIdAttrs: Array.from(card.attributes).filter((a) => /\d{6,}/.test(a.value)).map((a) => a.name),
      jobIdFromUrl: Boolean(idFromUrl),
      linkSignature: signature(link),
      title: redact(link.textContent),
      // Candidate readers; we report which ones return text so the module uses the reliable ones.
      fields: {
        company: text("a[href*='-jobs-careers-'], .comp-name, [class*='comp-name'], [class*='companyName']"),
        experience: text("[class*='exp'], [title*='Yrs']"),
        salary: text("[class*='sal']"),
        location: text("[class*='loc']"),
        posted: text("[class*='job-post-day'], [class*='posted'], [class*='date']"),
      },
      labels: Array.from(card.querySelectorAll("[class*='tag'], [class*='label'], [class*='badge']"))
        .map((el) => redact(el.textContent))
        .filter(Boolean)
        .slice(0, 8),
    };
  }
  function paginationReport() {
    const candidates = Array.from(document.querySelectorAll("a, button")).filter((el) => /^(next|previous|prev|\d{1,3})$/i.test(clean(el.textContent)) || /next|prev/i.test(el.getAttribute("aria-label") || ""));
    return candidates.slice(0, 15).map((el) => ({ text: clean(el.textContent), signature: signature(el), href: el.href ? safeUrl(el.href) : "", disabled: el.disabled || el.getAttribute("aria-disabled") === "true" || /disabled/i.test(el.className) }));
  }

  // ------------------------------------------------------------------ job page
  const APPLY_TEXT = /^(apply|apply now|apply on company site|apply on company website|i am interested|interested|applied|already applied|login to apply|register to apply|save|saved)$/i;
  function applyButtons() {
    return Array.from(document.querySelectorAll("button, a, [role='button'], input[type='button'], input[type='submit']"))
      .filter((el) => APPLY_TEXT.test(clean(el.textContent || el.value)) || /apply/i.test(el.id || ""))
      .slice(0, 20)
      .map((el) => ({
        text: clean(el.textContent || el.value),
        visible: isVisible(el),
        disabled: Boolean(el.disabled) || el.getAttribute("aria-disabled") === "true",
        path: path(el, 3),
        href: el.href ? safeUrl(el.href) : "",
        opensNewTab: el.target === "_blank",
      }));
  }
  function jobFacts() {
    const h1 = document.querySelector("h1");
    const headerBox = h1?.closest("section, div[class*='header'], div[class*='Header']") || h1?.parentElement?.parentElement;
    return {
      title: redact(h1?.textContent),
      titlePath: path(h1, 3),
      headerSignature: signature(headerBox),
      headerText: redact(headerBox?.innerText).slice(0, 300),
      sections: Array.from(document.querySelectorAll("h2, h3"))
        .filter(isVisible)
        .slice(0, 20)
        .map((h) => ({ heading: redact(h.textContent), signature: signature(h), container: signature(h.parentElement) })),
      stats: Array.from(document.querySelectorAll("[class*='stat'], [class*='posted'], [class*='applicant'], [class*='opening']"))
        .filter(isVisible)
        .slice(0, 10)
        .map((el) => ({ text: redact(el.textContent), signature: signature(el) })),
    };
  }

  // ------------------------------------------------------------------ drawers, questions, inputs
  /** Overlays that look like the apply chatbot / questionnaire / success dialog. */
  function overlays() {
    const els = Array.from(document.querySelectorAll("[role='dialog'], [aria-modal='true'], [class*='chatbot' i], [class*='Chatbot'], [class*='drawer' i], [class*='Drawer'], [class*='modal' i], [class*='popup' i], [class*='layer' i]"));
    // keep only outermost visible ones
    return els.filter((el) => isVisible(el) && !els.some((o) => o !== el && o.contains(el) && isVisible(o)));
  }
  function fieldLabel(input) {
    const id = input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    if (id) return redact(id.textContent);
    const near = input.closest("label") || input.closest("li, div")?.querySelector("label, legend, [class*='question' i], [class*='label' i]");
    return redact(near?.textContent || input.getAttribute("aria-label") || input.placeholder || "");
  }
  function mapOverlay(root) {
    const inputs = Array.from(root.querySelectorAll("input, textarea, select, [contenteditable='true'], [role='radio'], [role='checkbox'], [role='option'], [role='textbox'], [role='combobox']"));
    const chips = Array.from(root.querySelectorAll("[class*='chip' i], [class*='Chip'], [class*='option' i], [class*='suggestion' i]")).filter(isVisible);
    return {
      signature: signature(root),
      path: path(root, 3),
      headings: Array.from(root.querySelectorAll("h1, h2, h3, h4, [class*='title' i], [class*='header' i]"))
        .filter(isVisible)
        .slice(0, 6)
        .map((h) => redact(h.textContent))
        .filter(Boolean),
      // Bot messages / questions: text blocks that end in "?" or look like prompts.
      messages: Array.from(root.querySelectorAll("li, p, span, div"))
        .filter((el) => isVisible(el) && el.children.length <= 2 && clean(el.textContent).length > 3 && clean(el.textContent).length < 300)
        .map((el) => ({ text: redact(el.textContent), signature: signature(el), parent: signature(el.parentElement) }))
        .filter((m, i, all) => all.findIndex((x) => x.text === m.text) === i)
        .slice(-25),
      inputs: inputs.slice(0, 30).map((el) => ({
        tag: el.tagName.toLowerCase(),
        type: el.type || el.getAttribute("role") || (el.isContentEditable ? "contenteditable" : ""),
        signature: signature(el),
        label: fieldLabel(el),
        placeholder: redact(el.placeholder || ""),
        required: Boolean(el.required) || el.getAttribute("aria-required") === "true",
        options: el.tagName === "SELECT" ? Array.from(el.options).slice(0, 15).map((o) => redact(o.textContent)) : undefined,
        hasValue: Boolean(el.value || el.textContent?.trim()), // never the value itself
      })),
      chips: chips.slice(0, 20).map((el) => ({ text: redact(el.textContent), signature: signature(el) })),
      // Naukri's chatbot uses plain divs for Save / Send, so also take short leaf elements named like a button.
      buttons: Array.from(root.querySelectorAll("button, [role='button'], a[class*='btn' i], input[type='submit'], [class*='send' i], [class*='submit' i], [class*='save' i], [class*='skip' i]"))
        .filter((el) => el.children.length <= 1 && clean(el.textContent || el.value).length <= 40)
        .filter(isVisible)
        .slice(0, 15)
        .map((el) => ({ text: clean(el.textContent || el.value).slice(0, 60), signature: signature(el), disabled: Boolean(el.disabled) || el.getAttribute("aria-disabled") === "true" })),
      errors: Array.from(root.querySelectorAll("[class*='error' i], [role='alert'], [aria-invalid='true']"))
        .filter(isVisible)
        .slice(0, 10)
        .map((el) => ({ text: redact(el.textContent), signature: signature(el) })),
      iframes: Array.from(root.querySelectorAll("iframe")).map((f) => String(f.getAttribute("src") || "").replace(/[?#].*$/, "").slice(0, 120)),
      openShadowRoots: Array.from(root.querySelectorAll("*")).filter((el) => el.shadowRoot).length,
    };
  }
  /** Success / limit / captcha messages anywhere on the page. */
  function statusMessages() {
    const PATTERNS = /successfully applied|applied successfully|application (has been )?(sent|submitted)|you have applied|already applied|daily (apply )?limit|limit reached|too many|captcha|verify you are|unusual activity|try again later/i;
    return Array.from(document.querySelectorAll("body *"))
      .filter((el) => el.children.length === 0 && PATTERNS.test(el.textContent || "") && isVisible(el))
      .slice(0, 10)
      .map((el) => ({ text: redact(el.textContent), path: path(el, 3) }));
  }

  // ------------------------------------------------------------------ network (paths only)
  const network = [];
  const SAFE_HEADER_VALUES = new Set(["appid", "systemid", "clientid", "content-type", "accept"]);
  const recordCall = (method, url, status, headerNames, headerValues, bodyKeys) => {
    if (network.length >= CONFIG.maxNetworkCalls) return;
    let u;
    try {
      u = new URL(url, location.href);
    } catch {
      return;
    }
    if (!/naukri\.com$/i.test(u.hostname) || /\.(js|css|png|jpe?g|gif|svg|webp|woff2?)$/i.test(u.pathname)) return;
    network.push({
      t: Math.round(performance.now()),
      method,
      host: u.hostname,
      path: generalise(u.pathname),
      query: Array.from(u.searchParams.keys()),
      status,
      headerNames,
      headerValues, // only appid / systemid / clientid / content-type: public app constants
      bodyKeys, // JSON body field NAMES only, never values
    });
  };
  const headerInfo = (headers) => {
    const names = [];
    const values = {};
    try {
      new Headers(headers || {}).forEach((v, k) => {
        names.push(k);
        if (SAFE_HEADER_VALUES.has(k.toLowerCase())) values[k] = v.slice(0, 40);
      });
    } catch {
      // unreadable headers
    }
    return { names, values };
  };
  const bodyKeys = (body) => {
    try {
      const obj = typeof body === "string" ? JSON.parse(body) : null;
      if (!obj || typeof obj !== "object") return [];
      const keys = [];
      const walk = (o, prefix, depth) => {
        for (const [k, v] of Object.entries(o)) {
          keys.push(prefix + k);
          if (v && typeof v === "object" && !Array.isArray(v) && depth < 2) walk(v, `${prefix}${k}.`, depth + 1);
        }
      };
      walk(obj, "", 0);
      return keys.slice(0, 40);
    } catch {
      return [];
    }
  };
  // The apply API's response carries the outcome, the daily quota and the screening questions.
  // Keep its shape and those fields; no answers, ids of the user or tokens.
  const applyResponses = [];
  const isApplyCall = (url) => /apply-workflow|\/v\d+\/apply\b/i.test(String(url || ""));
  function recordApplyResponse(url, status, text) {
    if (applyResponses.length >= 20) return;
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON
    }
    const jobs = Array.isArray(json?.jobs) ? json.jobs : [];
    applyResponses.push({
      path: generalise(new URL(url, location.href).pathname),
      status,
      topKeys: json && typeof json === "object" ? Object.keys(json).slice(0, 30) : [],
      message: redact(json?.message || ""),
      customErrorCode: json?.customErrorCode ?? null,
      quotaDetails: json?.quotaDetails || null,
      jobs: jobs.slice(0, 5).map((j) => ({
        keys: Object.keys(j).slice(0, 30),
        status: j.status ?? null,
        message: redact(j.message || ""),
        questionnaire: (Array.isArray(j.questionnaire) ? j.questionnaire : []).slice(0, 20).map((q) => ({
          keys: Object.keys(q),
          questionType: q.questionType ?? null,
          questionName: redact(q.questionName || ""),
          isMandatory: q.isMandatory ?? q.mandatory ?? null,
          answerOption: q.answerOption && typeof q.answerOption === "object" ? Object.values(q.answerOption).slice(0, 12).map(redact) : q.answerOption ?? null,
        })),
      })),
    });
  }
  const origFetch = window.fetch;
  window.fetch = async function (input, init = {}) {
    const url = typeof input === "string" ? input : input?.url;
    const method = (init.method || input?.method || "GET").toUpperCase();
    const h = headerInfo(init.headers || input?.headers);
    const res = await origFetch.apply(this, arguments);
    recordCall(method, url, res.status, h.names, h.values, bodyKeys(init.body));
    if (isApplyCall(url)) res.clone().text().then((t) => recordApplyResponse(url, res.status, t)).catch(() => {});
    return res;
  };
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__cp = { method: String(method).toUpperCase(), url, names: [], values: {} };
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    if (this.__cp) {
      this.__cp.names.push(k);
      if (SAFE_HEADER_VALUES.has(String(k).toLowerCase())) this.__cp.values[k] = String(v).slice(0, 40);
    }
    return origSetHeader.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const info = this.__cp;
    if (info) {
      this.addEventListener("loadend", () => {
        recordCall(info.method, info.url, this.status, info.names, info.values, bodyKeys(body));
        if (isApplyCall(info.url)) {
          try {
            recordApplyResponse(info.url, this.status, this.responseType === "" || this.responseType === "text" ? this.responseText : JSON.stringify(this.response));
          } catch {
            // unreadable response
          }
        }
      });
    }
    return origSend.apply(this, arguments);
  };
  const restoreNetwork = () => {
    window.fetch = origFetch;
    XMLHttpRequest.prototype.open = origOpen;
    XMLHttpRequest.prototype.send = origSend;
    XMLHttpRequest.prototype.setRequestHeader = origSetHeader;
  };

  // ------------------------------------------------------------------ snapshot
  const report = {
    probe: "naukri",
    version: 1,
    at: new Date().toISOString(),
    url: safeUrl(),
    pageType: pageType(),
    loggedIn: Boolean(document.querySelector("[class*='nI-gNb-drawer'], [class*='user-name'], a[href*='/mnjuser/profile'], img[alt*='profile' i]")),
    viewport: `${innerWidth}x${innerHeight}`,
    cards: null,
    pagination: null,
    job: null,
    applyButtons: applyButtons(),
    statusAtStart: statusMessages(),
    knownAtStart: knownSelectors(),
    knownSeenDuringWatch: {},
    applyResponses,
    watch: { seconds: CONFIG.watchSeconds, steps: [] },
    network,
  };
  if (report.pageType !== "job") {
    const cards = findCards();
    report.cards = { count: cards.length, signatures: [...new Set(cards.map(([c]) => signature(c)))].slice(0, 5), sample: cards.slice(0, CONFIG.maxCards).map(([c, l]) => readCard(c, l)) };
    report.pagination = paginationReport();
  }
  if (report.pageType === "job" || document.querySelector("h1")) report.job = jobFacts();

  console.log(`Page: ${report.pageType} | logged in: ${report.loggedIn} | cards: ${report.cards?.count ?? "-"} | apply buttons: ${report.applyButtons.map((b) => b.text).join(", ") || "none"}`);

  // ------------------------------------------------------------------ watch
  let stopped = false;
  window.cpNaukriStop = () => {
    stopped = true;
  };
  if (CONFIG.watchSeconds > 0) {
    console.log(`%cWatching for ${CONFIG.watchSeconds}s. Click Apply yourself on a job you want and answer the questions by hand. cpNaukriStop() ends early.`, "color:#16a34a;font-weight:600");
    const seen = new Set();
    let lastUrl = location.href;
    const deadline = Date.now() + CONFIG.watchSeconds * 1000;
    while (!stopped && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, CONFIG.snapshotEveryMs));
      const step = { t: Math.round(performance.now()) };
      if (location.href !== lastUrl) {
        step.navigatedTo = safeUrl();
        lastUrl = location.href;
      }
      const maps = overlays().map(mapOverlay);
      // Record an overlay only when its questions / inputs / buttons changed.
      step.overlays = maps.filter((m) => {
        const key = JSON.stringify([m.signature, m.messages.slice(-3).map((x) => x.text), m.inputs.map((i) => i.label + i.type), m.buttons.map((b) => b.text + b.disabled), m.errors.length]);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const status = statusMessages();
      const statusKey = `status:${status.map((s) => s.text).join("|")}`;
      if (status.length && !seen.has(statusKey)) {
        seen.add(statusKey);
        step.status = status;
      }
      for (const [name, info] of Object.entries(knownSelectors())) {
        if (!report.knownSeenDuringWatch[name]) report.knownSeenDuringWatch[name] = info;
      }
      const buttonsKey = `buttons:${applyButtons().map((b) => b.text + b.disabled).join("|")}`;
      if (!seen.has(buttonsKey)) {
        seen.add(buttonsKey);
        step.applyButtons = applyButtons();
      }
      if (step.navigatedTo || step.overlays.length || step.status || step.applyButtons) {
        report.watch.steps.push(step);
        console.log(`step ${report.watch.steps.length}:`, step.navigatedTo || "", step.overlays.map((o) => `${o.signature.slice(0, 60)} | ${o.inputs.length} inputs | ${o.buttons.map((b) => b.text).join("/")}`).join(" ; "), step.status ? step.status.map((s) => s.text).join(" ; ") : "");
      }
    }
  }
  restoreNetwork();

  // ------------------------------------------------------------------ output
  report.summary = {
    pageType: report.pageType,
    cards: report.cards?.count ?? null,
    applyButtonTexts: [...new Set(report.applyButtons.map((b) => b.text))],
    watchSteps: report.watch.steps.length,
    overlaysSeen: report.watch.steps.reduce((n, s) => n + (s.overlays?.length || 0), 0),
    knownSelectorsMatched: [...new Set([...Object.keys(report.knownAtStart), ...Object.keys(report.knownSeenDuringWatch)])],
    knownSelectorsMissing: Object.keys(KNOWN).filter((k) => !report.knownAtStart[k] && !report.knownSeenDuringWatch[k]),
    applyResponses: applyResponses.map((r) => `${r.status} ${r.message || ""} ${r.quotaDetails ? JSON.stringify(r.quotaDetails) : ""}`.trim()),
    naukriApiPaths: [...new Set(network.map((c) => `${c.method} ${c.host}${c.path}`))].slice(0, 60),
  };
  window.__cpNaukri = report;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `naukri-probe-${report.pageType}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  console.log("%cDone. A .json file was downloaded - send it to Claude. Also in window.__cpNaukri.", "font-weight:700;color:#6366f1");
  console.table(report.summary.naukriApiPaths.map((p) => ({ call: p })));
})();
