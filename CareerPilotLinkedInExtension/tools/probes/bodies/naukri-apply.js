// Naukri apply recorder - a timeline of ONE application on a job page, across Naukri's page change.
// Read-only, never clicks. 1) Paste on a Naukri job page. 2) Apply yourself (or let the extension run)
// and answer the recruiter questions. 3) When Naukri opens its confirmation page (/myapply/saveApply…),
// paste this again THERE: it adds what that page says and downloads the whole timeline as ONE .json file.
// Recorded: Naukri API calls (path, status; for apply calls the job status + whether questions came back),
// chatbot questions / options / your answers, Apply / Applied button changes, "thank you" texts, URL
// changes, and when the page was left. No cookies, tokens, emails or phone numbers.
// Saved as it goes in sessionStorage ("cpApplyRecording"); cpApplyStop() downloads early.
(() => {
  const KEY = "cpApplyRecording";
  const clean = (t) => String(t || "").replace(/\s+/g, " ").trim();
  const redact = (t) => clean(t).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<email>").replace(/(\+?\d[\d\s-]{8,}\d)/g, "<number>").slice(0, 200);
  const load = () => {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) || "null");
    } catch {
      return null;
    }
  };
  const save = (rec) => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(rec));
    } catch {
      // storage full: keep the in-memory copy
    }
  };
  const t0 = performance.timeOrigin;
  const now = () => new Date().toISOString().slice(11, 23);
  const download = (rec) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(rec, null, 2)], { type: "application/json" }));
    a.download = `naukri-apply-recording-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    sessionStorage.removeItem(KEY);
    console.log("%cDone. naukri-apply-recording-….json downloaded - send it to Claude.", "font-weight:700;color:#6366f1");
  };

  // ---- 2nd paste: on the confirmation page (or any page after the job page) -> finish
  const previous = load();
  if (previous && !/\/job-listings-/i.test(location.pathname)) {
    const params = new URLSearchParams(location.search);
    let statuses = null;
    try {
      statuses = JSON.parse(params.get("multiApplyResp") || "null");
    } catch {
      statuses = params.get("multiApplyResp");
    }
    previous.events.push({
      t: now(),
      type: "arrived",
      path: location.pathname,
      queryKeys: Array.from(params.keys()),
      strJobsarr: params.get("strJobsarr"),
      multiApplyResp: statuses,
      applyMode: params.get("ApplyMode"),
      pageHeadline: redact(document.querySelector("h1, h2")?.textContent),
      pageMentionsApplied: /successfully applied|applied successfully|application (has been )?(sent|submitted)|you have applied/i.test(document.body?.innerText || ""),
    });
    previous.finishedAt = new Date().toISOString();
    console.log("Confirmation page:", previous.events[previous.events.length - 1]);
    download(previous);
    return;
  }
  if (!/\/job-listings-/i.test(location.pathname)) return console.error("Paste this on a Naukri job page first (naukri.com/job-listings-…).");

  // ---- 1st paste: on the job page -> record
  const rec = {
    probe: "naukri-apply",
    version: 1,
    startedAt: new Date().toISOString(),
    jobId: (location.pathname.match(/-(\d{6,})\/?$/) || [])[1] || "",
    title: redact(document.querySelector("h1")?.textContent),
    extensionRun: (() => {
      try {
        const run = JSON.parse(sessionStorage.getItem("cpNaukriRun") || "null");
        return run ? { status: run.status, phase: run.phase || null, index: run.index, queueLength: run.queue?.length } : null;
      } catch {
        return null;
      }
    })(),
    events: [],
  };
  const push = (event) => {
    rec.events.push({ t: now(), ...event });
    save(rec);
    console.log(`[${event.type}]`, event);
  };
  save(rec);
  console.log("%cRecording. Apply now (by hand or with the extension). When Naukri opens its confirmation page, paste this probe again there.", "color:#16a34a;font-weight:600");

  // Buttons
  const buttonsState = () => {
    const apply = document.querySelector("#apply-button");
    return `apply=${clean(apply?.textContent) || "-"}|already=${Boolean(document.querySelector("#already-applied"))}|company=${Boolean(document.querySelector("#company-site-button"))}`;
  };
  let lastButtons = buttonsState();
  push({ type: "buttons", state: lastButtons });
  document.addEventListener(
    "click",
    (e) => {
      const el = e.target?.closest?.("button, a, [role='button'], .chatbot_Chip, .ssrc__label, .sendMsg, label");
      if (el) push({ type: "click", trusted: e.isTrusted, target: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}.${Array.from(el.classList).slice(0, 3).join(".")}`, text: redact(el.textContent).slice(0, 60) });
    },
    true
  );

  // Network
  const APPLY = /apply/i;
  const onResponse = (method, url, status, text) => {
    let path = "";
    try {
      path = new URL(url, location.href).pathname.replace(/\d{6,}/g, "<id>");
    } catch {
      return;
    }
    if (/\.(js|css|png|jpe?g|gif|svg|webp|woff2?)$/i.test(path)) return;
    const event = { type: "network", method, path, status };
    if (APPLY.test(path)) {
      try {
        const json = JSON.parse(text);
        event.topKeys = Object.keys(json || {}).slice(0, 20);
        event.message = redact(json?.message || "");
        event.customErrorCode = json?.customErrorCode ?? null;
        event.quota = json?.quotaDetails || null;
        event.jobs = (json?.jobs || []).slice(0, 3).map((j) => ({ status: j.status ?? null, questions: Array.isArray(j.questionnaire) ? j.questionnaire.length : 0, keys: Object.keys(j).slice(0, 15) }));
      } catch {
        event.notJson = true;
      }
    }
    push(event);
  };
  const origFetch = window.fetch;
  window.fetch = async function (input, init = {}) {
    const res = await origFetch.apply(this, arguments);
    const url = typeof input === "string" ? input : input?.url;
    res.clone().text().then((text) => onResponse((init.method || input?.method || "GET").toUpperCase(), url, res.status, text)).catch(() => {});
    return res;
  };
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.addEventListener("loadend", () => {
      try {
        onResponse(String(method).toUpperCase(), url, this.status, this.responseType === "" || this.responseType === "text" ? this.responseText : JSON.stringify(this.response));
      } catch {
        // unreadable
      }
    });
    return origOpen.apply(this, arguments);
  };

  // Chatbot + page text, every 300 ms
  const seenMessages = new Set();
  let chatbotOpen = false;
  let lastUrl = location.href;
  let lastQuestionKey = "";
  const timer = setInterval(() => {
    const root = document.querySelector(".chatbot_DrawerContentWrapper, [id*='ChatbotContainer'], .chatbot_Drawer");
    const open = Boolean(root && root.getBoundingClientRect().width > 0);
    if (open !== chatbotOpen) {
      chatbotOpen = open;
      push({ type: open ? "chatbot-open" : "chatbot-gone" });
    }
    if (root) {
      for (const li of root.querySelectorAll(".chatbot_ListItem")) {
        const text = redact(li.textContent);
        const who = li.classList.contains("userItem") ? "you" : li.classList.contains("botItem") ? "bot" : "other";
        const key = `${who}:${text}`;
        if (text && !seenMessages.has(key)) {
          seenMessages.add(key);
          push({ type: "chat", who, text });
        }
      }
      const offered = {
        chips: Array.from(root.querySelectorAll(".chatbot_Chip")).map((c) => redact(c.textContent)).slice(0, 15),
        radios: Array.from(root.querySelectorAll(".ssrc__label")).map((c) => redact(c.textContent)).slice(0, 15),
        checkboxes: Array.from(root.querySelectorAll(".mcc__label")).map((c) => redact(c.textContent)).slice(0, 15),
        textBox: Boolean(root.querySelector(".chatbot_SendMessageContainer:not(.d-none) .textArea")),
        saveHidden: Boolean(document.querySelector(".sendMsgbtn_container.visibility-hidden")),
        saveDisabled: Boolean(document.querySelector("[id^='sendMsg__'].disabled")),
      };
      const questionKey = JSON.stringify(offered);
      if (questionKey !== lastQuestionKey) {
        lastQuestionKey = questionKey;
        push({ type: "answer-controls", ...offered });
      }
    }
    const buttons = buttonsState();
    if (buttons !== lastButtons) {
      lastButtons = buttons;
      push({ type: "buttons", state: buttons });
    }
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      push({ type: "url", path: location.pathname });
    }
  }, 300);
  window.addEventListener("beforeunload", () => push({ type: "leaving-page", from: location.pathname }));

  window.cpApplyStop = () => {
    clearInterval(timer);
    window.fetch = origFetch;
    XMLHttpRequest.prototype.open = origOpen;
    rec.finishedAt = new Date().toISOString();
    rec.note = "Stopped on the job page (no confirmation page reached).";
    download(rec);
  };
  void t0;
})();
