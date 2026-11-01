// Indeed probe - learn Indeed's pages before building the Indeed Easily-apply module.
// Read-only: it NEVER clicks anything and never calls Indeed's APIs itself. Paste it in the DevTools console
// while logged in to Indeed. It has two modes, picked from the page:
//
//   A) SEARCH page (in.indeed.com/jobs?q=..., /q-...-jobs.html, /viewjob?jk=...):
//      maps job cards, the page's built-in job data (window.mosaic), "Easily apply" vs company-site jobs,
//      pagination and the details pane. WATCH: click a few job cards yourself (Easily apply ones and
//      company-site ones); every Apply button the pane shows is recorded.
//
//   B) APPLY form (smartapply.indeed.com/..., opened by "Apply now" on an Easily apply job):
//      paste AGAIN here (the first paste stops when the page changes site). WATCH: go through the form
//      by hand (contact info, resume, screening questions, review). Every step's URL, questions, input
//      types, options, buttons and errors are recorded, plus the API calls (paths and JSON key names only).
//      Submit only if it is a job you really want - or close the tab at the Review step.
//
// Both modes also record Cloudflare / captcha checks. Typed values, cookies, tokens, emails and phone
// numbers are never recorded. Downloads ONE .json per paste and keeps it in window.__cpIndeed.
// Stop early with cpIndeedStop().
(async () => {
  // ------------------------------------------------------------------ settings (edit before pasting)
  const CONFIG = {
    watchSeconds: 30, // 0 = snapshot only; otherwise record what appears while you click / fill by hand
    snapshotEveryMs: 400,
    maxNetworkCalls: 400,
    maxCards: 10, // sample cards read in full (all are counted)
    ...(window.__cpIndeedOptions || {}),
  };

  console.log("%cAutoApply CV - Indeed probe", "font-weight:700;color:#6366f1");
  if (!/(^|\.)indeed\.com$/i.test(location.hostname)) {
    return console.error("Open an Indeed page first (a search results page, or the Easily apply form on smartapply.indeed.com).");
  }
  const MODE = /^smartapply\./i.test(location.hostname) || /indeedapply/i.test(location.pathname) ? "apply" : "search";

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
      .replace(/\b[0-9a-f]{16}\b/gi, "<jk>")
      .replace(/\d{6,}/g, "<id>");
  /** tag#id.classes[data-*][role][aria-label] - the markers a selector could use. */
  function signature(el) {
    if (!el || el.nodeType !== 1) return "";
    let s = el.tagName.toLowerCase();
    if (el.id) s += `#${generalise(el.id)}`;
    const classes = Array.from(el.classList || []).slice(0, 6).map(generalise);
    if (classes.length) s += `.${classes.join(".")}`;
    for (const a of Array.from(el.attributes || [])) {
      if (/^(data-testid|data-jk|data-tn-element|data-indeed-apply-[\w-]+|role$|aria-label$|type$|name$|for$)/.test(a.name)) {
        // data-indeed-apply-* can hold tokens / URLs: attribute name only.
        const showValue = a.value && !/^data-indeed-apply-|^data-jk$/.test(a.name);
        s += `[${a.name}${showValue ? `="${generalise(a.value).slice(0, 40)}"` : ""}]`;
      }
    }
    return s;
  }
  /** Signatures from el up to `depth` parents, to see which wrapper is stable. */
  const path = (el, depth = 4) => {
    const out = [];
    for (let n = el; n && n.nodeType === 1 && out.length <= depth; n = n.parentElement) out.push(signature(n));
    return out;
  };
  // URL without personal query values: keep parameter names, drop values except paging / sort / filters.
  const safeUrl = (u = location.href) => {
    try {
      const url = new URL(u, location.href);
      const keep = new Set(["start", "sort", "fromage", "sc", "radius", "vjk", "jk"]);
      const params = Array.from(url.searchParams.keys()).map((k) => (keep.has(k) ? `${k}=${generalise(url.searchParams.get(k))}` : `${k}=…`));
      return `${url.origin}${generalise(url.pathname)}${params.length ? `?${params.join("&")}` : ""}`;
    } catch {
      return "";
    }
  };
  const pageType = () => {
    if (MODE === "apply") return "apply";
    const p = location.pathname.toLowerCase();
    if (p.startsWith("/viewjob")) return "job";
    if (p === "/jobs" || p === "/jobs/" || /^\/q-[\w-]+-jobs\.html$/.test(p)) return "search";
    return "other";
  };

  // ------------------------------------------------------------------ Cloudflare / captcha
  function challengeSignals() {
    const found = [];
    const check = (name, ok) => ok && found.push(name);
    check("title:just-a-moment", /just a moment|attention required|verify you are human/i.test(document.title));
    check("cf-challenge-form", Boolean(document.querySelector("#challenge-form, #challenge-running, #cf-challenge-running")));
    check("cf-turnstile", Boolean(document.querySelector(".cf-turnstile, [name='cf-turnstile-response'], iframe[src*='challenges.cloudflare.com']")));
    check("hcaptcha", Boolean(document.querySelector("iframe[src*='hcaptcha'], .h-captcha, [name='h-captcha-response']")));
    check("recaptcha", Boolean(document.querySelector("iframe[src*='recaptcha'], .g-recaptcha")));
    check("text:unusual-activity", Array.from(document.querySelectorAll("h1, h2, p")).some((el) => /unusual activity|are you a robot|security check|verify you are human/i.test(el.textContent || "")));
    return found;
  }

  // ------------------------------------------------------------------ known selectors
  // Selectors from Indeed's current markup and open-source Indeed bots. The probe reports which still match,
  // so the module is built on the ones that work.
  const KNOWN_SEARCH = {
    cardsList: "#mosaic-provider-jobcards",
    card: ".job_seen_beacon",
    cardResultContent: "td.resultContent, .resultContent",
    cardTitleLink: "a.jcs-JobTitle",
    cardTitleSpan: "h2.jobTitle span[title]",
    cardJk: "a[data-jk]",
    cardCompany: "[data-testid='company-name']",
    cardLocation: "[data-testid='text-location']",
    cardEasyApplyLabel: ".iaLabel, [data-testid='indeedApply']",
    cardAppliedSnippet: ".applied-snippet, [data-testid='applied-snippet']",
    cardSalary: "[data-testid='attribute_snippet_testid'], .salary-snippet-container",
    cardDate: "[data-testid='myJobsStateDate'], span.date",
    paginationNav: "nav[aria-label*='pagination' i], nav[role='navigation']",
    paginationNext: "[data-testid='pagination-page-next'], a[aria-label='Next Page']",
    detailsPane: "#jobsearch-ViewjobPaneWrapper, .jobsearch-RightPane",
    detailsTitle: "[data-testid='jobsearch-JobInfoHeader-title'], h2.jobsearch-JobInfoHeader-title, h1.jobsearch-JobInfoHeader-title",
    detailsCompany: "[data-testid='inlineHeader-companyName'], [data-company-name='true']",
    applyButtonIndeed: "#indeedApplyButton, .jobsearch-IndeedApplyButton-newDesign, [data-testid='indeedApplyButton-test'], .ia-IndeedApplyButton",
    applyWidget: ".indeed-apply-widget, span[data-indeed-apply-joburl], [data-indeed-apply-jobid]",
    applyButtonCompany: "#applyButtonLinkContainer a, #applyButtonLinkContainer button, [data-testid='apply-button-container'] a",
    applyContainer: "#jobsearch-ViewJobButtons-container, .jobsearch-ViewJobButtons-container, #applyButtonLinkContainer",
    alreadyAppliedBanner: "[data-testid*='applied' i], .jobsearch-AppliedBanner",
    jobDescription: "#jobDescriptionText",
    loggedInMenu: "#AccountMenu, [data-gnav-element-name='AccountMenu'], [data-testid='gnav-AccountMenu']",
  };
  const KNOWN_APPLY = {
    basePage: ".ia-BasePage, [class*='ia-BasePage']",
    progress: "[role='progressbar'], [class*='ia-Progress'], [data-testid*='progress' i]",
    continueButton: "[data-testid='ia-continueButton'], .ia-continueButton, button[data-testid*='continue' i]",
    submitButton: "[data-testid*='submit' i], button[class*='submit' i]",
    backButton: "[data-testid*='back' i], button[aria-label*='back' i]",
    contactInfo: "[data-testid*='contact' i], #ia-container [name*='firstName' i]",
    resumeCards: "[data-testid*='resume-selection' i], [data-testid*='resume' i][role='radio'], .ia-ResumeSelection",
    resumeUpload: "input[type='file']",
    questionsItem: ".ia-Questions-item, [id^='q_'], [data-testid*='question' i]",
    questionsContainer: ".ia-Questions, [class*='Questions' i]",
    fieldset: "fieldset",
    radio: "input[type='radio']",
    checkbox: "input[type='checkbox']",
    select: "select",
    combobox: "[role='combobox']",
    textInput: "input[type='text'], input[type='number'], input[type='tel'], input[type='email'], input:not([type])",
    textarea: "textarea",
    dateInput: "input[type='date'], [data-testid*='date' i]",
    workExperience: "[data-testid*='work-experience' i], [class*='WorkExperience' i]",
    review: "[data-testid*='review' i], .ia-Review, [class*='ReviewPage' i]",
    errors: "[role='alert'], [class*='error' i], [aria-invalid='true']",
    postApply: "[data-testid*='post-apply' i], [class*='PostApply' i]",
  };
  const KNOWN = MODE === "apply" ? KNOWN_APPLY : KNOWN_SEARCH;
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
        disabled: Boolean(els[0].disabled) || els[0].getAttribute("aria-disabled") === "true",
      };
    }
    return out;
  }

  // ------------------------------------------------------------------ search mode: cards
  /** Cards = the smallest element holding exactly one job key (data-jk). */
  function findCards() {
    const links = Array.from(document.querySelectorAll("a[data-jk]")).filter(isVisible);
    const cards = new Map();
    for (const link of links) {
      let card = link;
      for (let n = link.parentElement; n && n !== document.body; n = n.parentElement) {
        const inside = new Set(Array.from(n.querySelectorAll("a[data-jk]")).map((a) => a.getAttribute("data-jk")));
        if (inside.size > 1) break;
        card = n;
      }
      cards.set(card, link);
    }
    return Array.from(cards.entries());
  }
  const leafLabel = (root, re) => Array.from(root.querySelectorAll("span, div, p, li")).some((el) => el.children.length === 0 && re.test(clean(el.textContent)));
  function readCard(card, link) {
    const text = (sel) => clean(card.querySelector(sel)?.textContent);
    return {
      signature: signature(card),
      path: path(card, 4),
      linkSignature: signature(link),
      linkHrefShape: safeUrl(link.href),
      title: redact(card.querySelector("h2.jobTitle span[title]")?.getAttribute("title") || link.textContent),
      fields: {
        company: text("[data-testid='company-name'], .companyName, [class*='companyName']"),
        location: text("[data-testid='text-location'], .companyLocation, [class*='companyLocation']"),
        salary: text("[data-testid='attribute_snippet_testid'], [class*='salary']"),
        posted: text("[data-testid='myJobsStateDate'], span.date, [class*='date']"),
      },
      easyApply: {
        bySelector: Boolean(card.querySelector(".iaLabel, [data-testid='indeedApply'], .ialbl")),
        byText: leafLabel(card, /^easily apply$/i),
        sponsored: leafLabel(card, /^sponsored$/i),
      },
      applied: {
        bySelector: Boolean(card.querySelector(".applied-snippet, [data-testid='applied-snippet']")),
        byText: leafLabel(card, /^applied\b|you applied/i),
      },
      labels: Array.from(card.querySelectorAll("[data-testid], [class*='label' i], [class*='snippet' i]"))
        .map((el) => `${el.getAttribute("data-testid") || ""}: ${redact(el.textContent).slice(0, 60)}`)
        .filter((s) => s.length > 2)
        .slice(0, 12),
    };
  }
  function paginationReport() {
    const candidates = Array.from(document.querySelectorAll("nav a, nav button, a[aria-label], [data-testid^='pagination']")).filter(
      (el) => /^(next|previous|prev|\d{1,3})$/i.test(clean(el.textContent)) || /next|prev|pagination/i.test(`${el.getAttribute("aria-label") || ""} ${el.getAttribute("data-testid") || ""}`),
    );
    return candidates.slice(0, 15).map((el) => ({ text: clean(el.textContent), signature: signature(el), href: el.href ? safeUrl(el.href) : "", disabled: el.getAttribute("aria-disabled") === "true" }));
  }

  /**
   * Indeed embeds the search results as JSON (window.mosaic.providerData["mosaic-provider-jobcards"]).
   * If it has an Indeed Apply flag per job, the module can tell Easily apply jobs apart without opening them.
   * Keys and flags only; no job text.
   */
  function mosaicData() {
    const model = window.mosaic?.providerData?.["mosaic-provider-jobcards"]?.metaData?.mosaicProviderJobCardsModel;
    const results = Array.isArray(model?.results) ? model.results : [];
    const flagKeys = results.length ? Object.keys(results[0]).filter((k) => /apply|applied|sponsor|indeedApply|thirdParty|expired|urgent|remote/i.test(k)) : [];
    const inScriptTag = Array.from(document.scripts).some((s) => (s.textContent || "").includes("mosaic-provider-jobcards"));
    return {
      found: Boolean(model),
      inScriptTag, // content scripts run in an isolated world: if true they can parse it from the <script> text
      count: results.length,
      modelKeys: model ? Object.keys(model).slice(0, 40) : [],
      resultKeys: results.length ? Object.keys(results[0]).slice(0, 120) : [],
      flagKeys,
      sample: results.slice(0, 15).map((r) => {
        const flags = {};
        for (const k of flagKeys) {
          const v = r[k];
          flags[k] = typeof v === "string" ? (v ? "<string>" : "") : v && typeof v === "object" ? "<object>" : v;
        }
        return { hasJobkey: Boolean(r.jobkey), ...flags };
      }),
    };
  }

  // ------------------------------------------------------------------ search mode: details pane + Apply buttons
  const APPLY_TEXT = /^(apply now|apply|easily apply|apply on company site|apply on company website|continue application|applied|you applied|application submitted|save|saved|save job)$/i;
  function applyButtons() {
    return Array.from(document.querySelectorAll("button, a, [role='button']"))
      .filter((el) => APPLY_TEXT.test(clean(el.textContent)) || /apply/i.test(`${el.id} ${el.getAttribute("aria-label") || ""} ${el.getAttribute("data-testid") || ""}`))
      .filter((el) => clean(el.textContent).length < 60)
      .slice(0, 20)
      .map((el) => ({
        text: clean(el.textContent),
        ariaLabel: redact(el.getAttribute("aria-label") || "").slice(0, 80),
        visible: isVisible(el),
        disabled: Boolean(el.disabled) || el.getAttribute("aria-disabled") === "true",
        path: path(el, 3),
        hrefShape: el.href ? safeUrl(el.href) : "",
        opensNewTab: el.target === "_blank",
        indeedApplyAttrs: Array.from(el.closest("[data-indeed-apply-jobid], .indeed-apply-widget, span[data-indeed-apply-joburl]")?.attributes || [])
          .map((a) => a.name)
          .filter((n) => n.startsWith("data-indeed-apply")),
      }));
  }
  function detailsPane() {
    const pane = document.querySelector("#jobsearch-ViewjobPaneWrapper, .jobsearch-RightPane, #viewJobSSRRoot, .jobsearch-ViewJobLayout");
    if (!pane) return null;
    return {
      signature: signature(pane),
      title: redact(pane.querySelector("h1, h2")?.textContent),
      titlePath: path(pane.querySelector("h1, h2"), 3),
      iframes: Array.from(pane.querySelectorAll("iframe")).map((f) => safeUrl(f.getAttribute("src") || "")),
      sections: Array.from(pane.querySelectorAll("h2, h3"))
        .filter(isVisible)
        .slice(0, 12)
        .map((h) => redact(h.textContent)),
    };
  }

  // ------------------------------------------------------------------ apply mode: the form step
  function fieldLabel(input) {
    const byFor = input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    if (byFor) return redact(byFor.textContent);
    const labelled = input.getAttribute("aria-labelledby");
    if (labelled) return redact(labelled.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" "));
    const legend = input.closest("fieldset")?.querySelector("legend");
    if (legend && (input.type === "radio" || input.type === "checkbox")) return redact(legend.textContent);
    const near = input.closest("label") || input.closest("[class*='question' i], [data-testid*='question' i], li, div")?.querySelector("label, legend, [class*='label' i]");
    return redact(near?.textContent || input.getAttribute("aria-label") || input.placeholder || "");
  }
  function optionText(input) {
    const byFor = input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    return redact(byFor?.textContent || input.closest("label")?.textContent || input.getAttribute("aria-label") || input.value || "");
  }
  /** One form step: questions grouped by radio / checkbox name, every other input on its own. */
  function mapStep(root = document.querySelector("main, #ia-container, [class*='ia-BasePage']") || document.body) {
    const all = Array.from(root.querySelectorAll("input, textarea, select, [contenteditable='true'], [role='combobox'], [role='radio'], [role='checkbox'], [role='listbox']")).filter(
      (el) => el.type !== "hidden",
    );
    const groups = new Map();
    const fields = [];
    for (const el of all) {
      const type = el.type || el.getAttribute("role") || (el.isContentEditable ? "contenteditable" : el.tagName.toLowerCase());
      if ((type === "radio" || type === "checkbox") && el.name) {
        const g = groups.get(el.name) || { type, label: fieldLabel(el), signature: signature(el.closest("fieldset") || el.parentElement), required: false, options: [] };
        g.required = g.required || Boolean(el.required) || el.getAttribute("aria-required") === "true";
        if (g.options.length < 15) g.options.push(optionText(el));
        groups.set(el.name, g);
        continue;
      }
      fields.push({
        tag: el.tagName.toLowerCase(),
        type,
        signature: signature(el),
        label: fieldLabel(el),
        placeholder: redact(el.placeholder || ""),
        autocomplete: el.getAttribute("autocomplete") || "",
        required: Boolean(el.required) || el.getAttribute("aria-required") === "true",
        visible: isVisible(el),
        options: el.tagName === "SELECT" ? Array.from(el.options).slice(0, 20).map((o) => redact(o.textContent)) : undefined,
        hasValue: Boolean(el.value || (el.isContentEditable && el.textContent?.trim())), // never the value itself
        prefilled: Boolean(el.defaultValue), // Indeed fills contact info from the profile
      });
    }
    return {
      url: safeUrl(),
      title: redact(document.title),
      headings: Array.from(root.querySelectorAll("h1, h2, h3, legend"))
        .filter(isVisible)
        .slice(0, 12)
        .map((h) => redact(h.textContent))
        .filter(Boolean),
      progress: redact(root.querySelector("[role='progressbar'], [class*='Progress' i]")?.getAttribute("aria-valuetext") || root.querySelector("[role='progressbar'], [class*='Progress' i]")?.textContent || ""),
      questionGroups: Array.from(groups.values()),
      fields,
      resumeOptions: Array.from(root.querySelectorAll("[data-testid*='resume' i]"))
        .filter(isVisible)
        .slice(0, 8)
        .map((el) => ({ signature: signature(el), role: el.getAttribute("role") || "", checked: el.getAttribute("aria-checked") || el.querySelector("input")?.checked || null })),
      buttons: Array.from(root.querySelectorAll("button, [role='button'], a[class*='button' i], input[type='submit']"))
        .filter((el) => isVisible(el) && clean(el.textContent || el.value).length <= 50)
        .slice(0, 20)
        .map((el) => ({ text: clean(el.textContent || el.value), signature: signature(el), disabled: Boolean(el.disabled) || el.getAttribute("aria-disabled") === "true" })),
      errors: Array.from(root.querySelectorAll("[role='alert'], [class*='error' i], [aria-invalid='true']"))
        .filter(isVisible)
        .slice(0, 10)
        .map((el) => ({ text: redact(el.textContent), signature: signature(el) })),
      iframes: Array.from(document.querySelectorAll("iframe")).map((f) => safeUrl(f.getAttribute("src") || "")).filter(Boolean),
      openShadowRoots: Array.from(root.querySelectorAll("*")).filter((el) => el.shadowRoot).length,
    };
  }
  /** Success / limit / captcha / error messages anywhere on the page. */
  function statusMessages() {
    const PATTERNS = /application (has been )?(sent|submitted)|your application has been|you applied|already applied|applied on|we.?ve received|too many|unusual activity|try again later|something went wrong|session expired|verify you are|captcha/i;
    return Array.from(document.querySelectorAll("body *"))
      .filter((el) => el.children.length === 0 && PATTERNS.test(el.textContent || "") && isVisible(el))
      .slice(0, 10)
      .map((el) => ({ text: redact(el.textContent), path: path(el, 3) }));
  }

  // ------------------------------------------------------------------ network (paths + JSON key names only)
  const network = [];
  const responseShapes = [];
  /** Keys and value types of a JSON value, 3 levels deep; arrays show their first item. Never values. */
  const shape = (v, depth = 0) => {
    if (Array.isArray(v)) return depth > 3 ? "array" : [`array(${v.length})`, v.length ? shape(v[0], depth + 1) : null];
    if (v && typeof v === "object") {
      if (depth > 3) return "object";
      const out = {};
      for (const k of Object.keys(v).slice(0, 40)) out[k] = shape(v[k], depth + 1);
      return out;
    }
    return v === null ? "null" : typeof v;
  };
  // Form / question / submit calls: keep the response SHAPE so the module knows where questions live.
  const isApplyCall = (url) => /indeedapply|smartapply|question|screener|submit|apply/i.test(String(url || ""));
  const recordCall = (method, url, status, bodyText, resText) => {
    if (network.length >= CONFIG.maxNetworkCalls) return;
    let u;
    try {
      u = new URL(url, location.href);
    } catch {
      return;
    }
    if (!/indeed\.com$/i.test(u.hostname) || /\.(js|css|png|jpe?g|gif|svg|webp|woff2?|ico)$/i.test(u.pathname) || /\/(log|rpc\/log|m\/log|track|beacon)/i.test(u.pathname)) return;
    let bodyKeys = [];
    try {
      const body = typeof bodyText === "string" ? JSON.parse(bodyText) : null;
      if (body && typeof body === "object") bodyKeys = Object.keys(body).slice(0, 40);
    } catch {
      // not JSON
    }
    network.push({ t: Math.round(performance.now()), method, host: u.hostname, path: generalise(u.pathname), query: Array.from(u.searchParams.keys()), status, bodyKeys });
    if (resText && isApplyCall(u.href) && responseShapes.length < 25) {
      try {
        responseShapes.push({ path: generalise(u.pathname), status, shape: shape(JSON.parse(resText)) });
      } catch {
        // not JSON
      }
    }
  };
  const origFetch = window.fetch;
  window.fetch = async function (input, init = {}) {
    const url = typeof input === "string" ? input : input?.url;
    const method = (init.method || input?.method || "GET").toUpperCase();
    const res = await origFetch.apply(this, arguments);
    const body = typeof init.body === "string" ? init.body : null;
    if (isApplyCall(url)) res.clone().text().then((t) => recordCall(method, url, res.status, body, t)).catch(() => recordCall(method, url, res.status, body, null));
    else recordCall(method, url, res.status, body, null);
    return res;
  };
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__cp = { method: String(method).toUpperCase(), url };
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const info = this.__cp;
    if (info) {
      this.addEventListener("loadend", () => {
        let text = null;
        try {
          if (isApplyCall(info.url)) text = this.responseType === "" || this.responseType === "text" ? this.responseText : JSON.stringify(this.response);
        } catch {
          // unreadable response
        }
        recordCall(info.method, info.url, this.status, typeof body === "string" ? body : null, text);
      });
    }
    return origSend.apply(this, arguments);
  };
  const restoreNetwork = () => {
    window.fetch = origFetch;
    XMLHttpRequest.prototype.open = origOpen;
    XMLHttpRequest.prototype.send = origSend;
  };

  // ------------------------------------------------------------------ snapshot
  const report = {
    probe: "indeed",
    version: 1,
    mode: MODE,
    at: new Date().toISOString(),
    url: safeUrl(),
    host: location.hostname,
    pageType: pageType(),
    loggedIn: Boolean(document.querySelector("#AccountMenu, [data-gnav-element-name='AccountMenu'], [data-testid='gnav-AccountMenu'], [aria-label*='account' i]")),
    viewport: `${innerWidth}x${innerHeight}`,
    challengeAtStart: challengeSignals(),
    knownAtStart: knownSelectors(),
    knownSeenDuringWatch: {},
    statusAtStart: statusMessages(),
    cards: null,
    mosaic: null,
    pagination: null,
    pane: null,
    applyButtons: null,
    step: null,
    watch: { seconds: CONFIG.watchSeconds, steps: [] },
    responseShapes,
    network,
  };
  if (MODE === "search") {
    const cards = findCards();
    const sample = cards.slice(0, CONFIG.maxCards).map(([c, l]) => readCard(c, l));
    report.cards = {
      count: cards.length,
      signatures: [...new Set(cards.map(([c]) => signature(c)))].slice(0, 5),
      easyApplyCount: cards.filter(([c]) => c.querySelector(".iaLabel, [data-testid='indeedApply'], .ialbl") || leafLabel(c, /^easily apply$/i)).length,
      appliedCount: cards.filter(([c]) => c.querySelector(".applied-snippet, [data-testid='applied-snippet']") || leafLabel(c, /^applied\b|you applied/i)).length,
      sample,
    };
    report.mosaic = mosaicData();
    report.pagination = paginationReport();
    report.pane = detailsPane();
    report.applyButtons = applyButtons();
    console.log(
      `Search mode | page: ${report.pageType} | logged in: ${report.loggedIn} | cards: ${cards.length} (Easily apply ${report.cards.easyApplyCount}, applied ${report.cards.appliedCount}) | page data: ${report.mosaic.found ? `${report.mosaic.count} jobs` : "not found"} | challenge: ${report.challengeAtStart.join(", ") || "none"}`,
    );
  } else {
    report.step = mapStep();
    console.log(`Apply-form mode | step: ${report.step.headings[0] || report.url} | fields: ${report.step.fields.length} | question groups: ${report.step.questionGroups.length} | challenge: ${report.challengeAtStart.join(", ") || "none"}`);
  }

  // ------------------------------------------------------------------ watch
  let stopped = false;
  window.cpIndeedStop = () => {
    stopped = true;
  };
  if (CONFIG.watchSeconds > 0) {
    console.log(
      MODE === "search"
        ? `%cWatching for ${CONFIG.watchSeconds}s. Click several job cards yourself (Easily apply AND company-site ones). Do not click Apply here - paste the probe again on the apply form. cpIndeedStop() ends early.`
        : `%cWatching for ${CONFIG.watchSeconds}s. Go through the form by hand, step by step. Submit only if you want this job (or close at Review). cpIndeedStop() ends early.`,
      "color:#16a34a;font-weight:600",
    );
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
      const challenge = challengeSignals();
      if (challenge.length && !seen.has(`ch:${challenge.join()}`)) {
        seen.add(`ch:${challenge.join()}`);
        step.challenge = challenge;
      }
      if (MODE === "search") {
        const buttons = applyButtons();
        const pane = detailsPane();
        const key = `pane:${pane?.title}|${buttons.map((b) => b.text + b.disabled).join("|")}`;
        if (!seen.has(key)) {
          seen.add(key);
          step.pane = pane;
          step.applyButtons = buttons;
        }
      } else {
        const form = mapStep();
        const key = JSON.stringify([form.url, form.headings, form.fields.map((f) => f.label + f.type), form.questionGroups.map((g) => g.label), form.buttons.map((b) => b.text + b.disabled), form.errors.length]);
        if (!seen.has(key)) {
          seen.add(key);
          step.form = form;
        }
      }
      const status = statusMessages();
      const statusKey = `status:${status.map((s) => s.text).join("|")}`;
      if (status.length && !seen.has(statusKey)) {
        seen.add(statusKey);
        step.status = status;
      }
      for (const [name, info] of Object.entries(knownSelectors())) {
        if (!report.knownSeenDuringWatch[name]) report.knownSeenDuringWatch[name] = info;
      }
      if (step.navigatedTo || step.challenge || step.pane !== undefined || step.form || step.status) {
        report.watch.steps.push(step);
        const what = step.form
          ? `${step.form.headings[0] || ""} | ${step.form.fields.length} fields, ${step.form.questionGroups.length} choice questions | ${step.form.buttons.map((b) => b.text).join("/")}`
          : step.applyButtons
            ? `${step.pane?.title || "(no pane)"} | ${step.applyButtons.map((b) => b.text || b.ariaLabel).join("/")}`
            : "";
        console.log(`step ${report.watch.steps.length}:`, step.navigatedTo || "", what, step.challenge ? `CHALLENGE ${step.challenge.join(",")}` : "", step.status ? step.status.map((s) => s.text).join(" ; ") : "");
      }
    }
  }
  restoreNetwork();

  // ------------------------------------------------------------------ output
  const formSteps = report.watch.steps.filter((s) => s.form).map((s) => s.form);
  if (report.step) formSteps.unshift(report.step);
  report.summary = {
    mode: MODE,
    pageType: report.pageType,
    cards: report.cards?.count ?? null,
    easyApplyCards: report.cards?.easyApplyCount ?? null,
    pageDataHasApplyFlag: report.mosaic ? report.mosaic.flagKeys : null,
    applyButtonTexts: [...new Set(report.watch.steps.flatMap((s) => s.applyButtons || []).concat(report.applyButtons || []).map((b) => b.text || b.ariaLabel))],
    formSteps: formSteps.map((f) => `${f.url} | ${f.headings[0] || ""} | ${f.fields.length} fields, ${f.questionGroups.length} choice | ${f.buttons.map((b) => b.text).join("/")}`),
    fieldTypes: [...new Set(formSteps.flatMap((f) => f.fields.map((x) => x.type).concat(f.questionGroups.map((g) => g.type))))],
    challengeSeen: [...new Set(report.challengeAtStart.concat(report.watch.steps.flatMap((s) => s.challenge || [])))],
    knownSelectorsMatched: [...new Set([...Object.keys(report.knownAtStart), ...Object.keys(report.knownSeenDuringWatch)])],
    knownSelectorsMissing: Object.keys(KNOWN).filter((k) => !report.knownAtStart[k] && !report.knownSeenDuringWatch[k]),
    indeedApiPaths: [...new Set(network.map((c) => `${c.method} ${c.host}${c.path}`))].slice(0, 80),
  };
  window.__cpIndeed = report;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `indeed-probe-${MODE}-${report.pageType}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  console.log("%cDone. A .json file was downloaded - send it to Claude. Also in window.__cpIndeed.", "font-weight:700;color:#6366f1");
  console.table(report.summary.indeedApiPaths.map((p) => ({ call: p })));
})();
