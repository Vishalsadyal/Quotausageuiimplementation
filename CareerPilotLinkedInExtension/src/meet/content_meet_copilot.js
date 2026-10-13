/* ─────────────────────────────────────────────────────────────────────────────
   Client Call Copilot — content_meet_copilot.js
   Live talking points for sales / discovery calls with leads on Google Meet.

   Privacy model: everything lives in this tab's memory only.
   - Setup fields, transcript and suggestions are plain JS variables.
   - Nothing is written to chrome.storage, localStorage, or any backend.
   - Closing / leaving the meeting (or "Clear") wipes it.
   - AI suggestions come from the AutoApply CV portal (/api/ai/call-copilot),
     which uses the server's Groq key and does not store the call.
   ───────────────────────────────────────────────────────────────────────────── */
(() => {
  if (window.__mcCopilotLoaded) return;
  window.__mcCopilotLoaded = true;

  const MEETING_PATH_RE = /^\/[a-z]{3,4}-[a-z]{4}-[a-z]{3,4}(?:\/|$)/i;
  const PAUSE_MS = 1600; // lead considered "done talking" after this silence
  const MIN_TURN_CHARS = 12;
  const MAX_TRANSCRIPT_LINES = 400;
  const MAX_SUGGESTIONS_KEPT = 8;

  const MODELS = [
    { id: "openai/gpt-oss-20b", label: "Fast" },
    { id: "openai/gpt-oss-120b", label: "Smarter" }
  ];

  // ── In-memory state (never persisted) ──
  const state = {
    setup: {
      myName: "",
      myRole: "",
      theirRole: "",
      goal: "",
      offer: "",
      tone: "consultative",
      model: MODELS[0].id
    },
    live: false,
    autoSuggest: true,
    transcript: [], // { id, speaker, isMe, text, updatedAt }
    suggestions: [], // { id, mode, say, points, ask, signal, stage, trigger, at }
    blockMap: new WeakMap(), // caption DOM block -> transcript entry
    lastSuggested: null, // { id, length } of the lead turn last auto-answered
    inflight: null, // request token
    captionsSeen: false,
    minimized: false
  };

  let els = null;
  let captionObserver = null;
  let observedRegion = null;
  let parseTimer = null;
  let turnTimer = null;
  let entrySeq = 0;

  // ── Utilities ──
  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : String(v));
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return el;
  }

  function clean(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function isInMeeting() {
    return MEETING_PATH_RE.test(location.pathname);
  }

  function send(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message || "Extension unavailable" });
            return;
          }
          resolve(res || { ok: false, error: "No response" });
        });
      } catch (err) {
        resolve({ ok: false, error: "Extension was reloaded — refresh this Meet tab." });
      }
    });
  }

  // ── Google Meet caption reading ──
  // Meet's class names change often, so try known selectors first and fall
  // back to structural parsing of the captions region.
  const REGION_SELECTORS = [
    'div[role="region"][aria-label*="aption" i]',
    'div[role="region"][aria-label*="ubtit" i]',
    "div[jsname='dsyhDe']",
    ".a4cQT"
  ];
  const BLOCK_SELECTORS = ".nMcdL, .TBMuR, .CNusmb";
  const NAME_SELECTORS = ".NWpY1d, .zs7s8d, .KcIKyf, .jxFHg";
  const TEXT_SELECTORS = ".ygicle, .bh44bd, .iTTPOb, .VbkSUe";

  function findCaptionRegion() {
    for (const sel of REGION_SELECTORS) {
      const el = document.querySelector(sel);
      if (!el || (els && els.root.contains(el))) continue;
      // Meet can keep the region in the DOM while captions are switched off.
      const visible = typeof el.checkVisibility === "function" ? el.checkVisibility() : el.getClientRects().length > 0;
      if (visible) return el;
    }
    return null;
  }

  function getCaptionBlocks(region) {
    const known = region.querySelectorAll(BLOCK_SELECTORS);
    if (known.length) return Array.from(known);
    // Fallback: descend through single-child wrappers, then treat children as blocks.
    let node = region;
    while (node && node.children.length === 1) node = node.children[0];
    return node ? Array.from(node.children).filter((c) => clean(c.innerText).length > 0) : [];
  }

  function parseBlock(block) {
    const nameEl = block.querySelector(NAME_SELECTORS);
    const textEl = block.querySelector(TEXT_SELECTORS);
    if (nameEl && textEl) {
      return { speaker: clean(nameEl.innerText), text: clean(textEl.innerText) };
    }
    const lines = String(block.innerText || "")
      .split("\n")
      .map(clean)
      .filter(Boolean);
    if (lines.length < 2) return lines.length ? { speaker: "", text: lines[0] } : null;
    return { speaker: lines[0], text: lines.slice(1).join(" ") };
  }

  function isMeSpeaker(speaker) {
    const s = clean(speaker).toLowerCase();
    if (!s) return false;
    if (s === "you" || s === "you (presenting)") return true;
    const mine = clean(state.setup.myName).toLowerCase();
    return !!mine && (s === mine || s.startsWith(mine + " "));
  }

  function normForCompare(text) {
    return clean(text).toLowerCase().replace(/[^a-z0-9ऀ-ॿ ]/g, "");
  }

  // Meet keeps revising a line while someone talks, but it also recycles caption
  // elements for brand-new lines. Treat it as the same line only if the speaker
  // matches and the new text still continues the old one.
  function isContinuation(oldText, newText) {
    const a = normForCompare(oldText);
    const b = normForCompare(newText);
    if (!a || !b) return true;
    const head = Math.min(12, a.length, b.length);
    if (a.slice(0, head) === b.slice(0, head)) return true;
    // Long lines can get trimmed from the front: the old tail should still be in there.
    const tail = a.slice(-20);
    return b.includes(tail) || a.includes(b.slice(0, 20));
  }

  function scanCaptions() {
    const region = findCaptionRegion();
    if (!region) {
      updateCaptionStatus();
      return;
    }
    if (!state.captionsSeen) {
      state.captionsSeen = true;
      updateCaptionStatus();
    }
    let changed = false;
    const visible = [];
    for (const block of getCaptionBlocks(region)) {
      const parsed = parseBlock(block);
      if (!parsed || !parsed.text) continue;
      const speaker = parsed.speaker || "Lead";
      let entry = state.blockMap.get(block);
      if (entry && (entry.speaker !== speaker || !isContinuation(entry.text, parsed.text))) {
        entry = null; // recycled element → new line
      }
      if (!entry) {
        entry = {
          id: ++entrySeq,
          speaker,
          isMe: isMeSpeaker(speaker),
          text: parsed.text,
          updatedAt: Date.now()
        };
        state.blockMap.set(block, entry);
        state.transcript.push(entry);
        changed = true;
      } else if (entry.text !== parsed.text) {
        entry.text = parsed.text;
        entry.updatedAt = Date.now();
        changed = true;
      }
      if (!visible.includes(entry)) visible.push(entry);
    }

    // Keep the transcript tail in the same order as the captions on screen.
    if (visible.length) {
      const tail = state.transcript.slice(-visible.length);
      const inOrder = tail.length === visible.length && tail.every((e, i) => e === visible[i]);
      if (!inOrder) {
        const onScreen = new Set(visible);
        state.transcript = state.transcript.filter((e) => !onScreen.has(e)).concat(visible);
        changed = true;
      }
    }
    if (state.transcript.length > MAX_TRANSCRIPT_LINES) {
      state.transcript.splice(0, state.transcript.length - MAX_TRANSCRIPT_LINES);
    }

    if (changed) {
      renderTranscript();
      scheduleTurnCheck();
    }
  }

  function attachCaptionObserver() {
    const region = findCaptionRegion();
    if (region === observedRegion) return;
    if (captionObserver) captionObserver.disconnect();
    observedRegion = region;
    if (!region) return;
    captionObserver = new MutationObserver(() => {
      clearTimeout(parseTimer);
      parseTimer = setTimeout(scanCaptions, 250);
    });
    captionObserver.observe(region, { childList: true, subtree: true, characterData: true });
    scanCaptions();
  }

  function tryEnableCaptions() {
    const btn = Array.from(document.querySelectorAll("button[aria-label]")).find((b) =>
      /turn on captions|captions? \(c\)|show captions/i.test(b.getAttribute("aria-label") || "")
    );
    if (btn) {
      btn.click();
      toast("Captions turned on");
    } else {
      toast("Press C in Meet (or the CC button) to turn on captions");
    }
  }

  // ── Turn detection → auto suggestion ──
  function scheduleTurnCheck() {
    clearTimeout(turnTimer);
    turnTimer = setTimeout(checkTurnEnded, PAUSE_MS);
  }

  function checkTurnEnded() {
    if (!state.live || !state.autoSuggest) return;
    const last = state.transcript[state.transcript.length - 1];
    if (!last || last.isMe) return;
    if (Date.now() - last.updatedAt < PAUSE_MS - 50) {
      scheduleTurnCheck();
      return;
    }
    const leadTurn = collectLastLeadTurn();
    if (leadTurn.length < MIN_TURN_CHARS) return;
    // Skip if this is the same line we already answered with only small caption revisions.
    const prev = state.lastSuggested;
    if (prev && prev.id === last.id && Math.abs(leadTurn.length - prev.length) < 8) return;
    state.lastSuggested = { id: last.id, length: leadTurn.length };
    requestSuggestion("auto", leadTurn);
  }

  function collectLastLeadTurn() {
    const parts = [];
    for (let i = state.transcript.length - 1; i >= 0; i--) {
      const e = state.transcript[i];
      if (e.isMe) break;
      parts.unshift(e.text);
    }
    return clean(parts.join(" "));
  }

  function transcriptForPrompt(maxChars = 7000) {
    const lines = [];
    let total = 0;
    for (let i = state.transcript.length - 1; i >= 0; i--) {
      const e = state.transcript[i];
      const line = `${e.isMe ? "ME" : "LEAD"}${e.speaker && !e.isMe ? ` (${e.speaker})` : ""}: ${e.text}`;
      total += line.length + 1;
      if (total > maxChars) break;
      lines.unshift(line);
    }
    return lines.join("\n");
  }

  // ── AI requests ──
  async function requestSuggestion(mode, trigger = "") {
    const token = Symbol(mode);
    state.inflight = token;
    setThinking(true);
    const res = await send({
      type: "MC_SUGGEST",
      mode,
      trigger: trigger.slice(0, 1500),
      setup: { ...state.setup },
      transcript: transcriptForPrompt()
    });
    if (state.inflight !== token) return; // superseded by a newer request
    state.inflight = null;
    setThinking(false);
    if (!res.ok) {
      showError(res.error || "Suggestion failed");
      return;
    }
    const s = {
      id: Date.now(),
      mode,
      trigger,
      at: new Date(),
      say: clean(res.data?.say),
      points: Array.isArray(res.data?.points) ? res.data.points.map(clean).filter(Boolean).slice(0, 4) : [],
      ask: clean(res.data?.ask),
      signal: clean(res.data?.signal),
      stage: clean(res.data?.stage)
    };
    state.suggestions.unshift(s);
    if (state.suggestions.length > MAX_SUGGESTIONS_KEPT) state.suggestions.pop();
    renderSuggestions();
  }

  // ── UI ──
  function buildUI() {
    const launcher = h("button", {
      class: "mc-launcher",
      title: "Client Call Copilot (Alt+Shift+M)",
      onclick: () => setMinimized(false)
    }, h("span", { class: "mc-launcher-dot" }), "Call Copilot");

    const field = (label, input, hint) =>
      h("label", { class: "mc-field" }, h("span", { class: "mc-label", text: label }), input, hint ? h("span", { class: "mc-hint", text: hint }) : null);

    const inMyName = h("input", { class: "mc-input", placeholder: "Your name as shown in Meet (optional)" });
    const inMyRole = h("input", { class: "mc-input", placeholder: "e.g. Freelance full-stack developer (React / Node)" });
    const inTheirRole = h("input", { class: "mc-input", placeholder: "e.g. Startup founder hiring for an MVP" });
    const inGoal = h("textarea", { class: "mc-input mc-textarea", rows: "2", placeholder: "e.g. Understand scope, show fit, agree on fixed price and send the Upwork offer today" });
    const inOffer = h("textarea", { class: "mc-input mc-textarea", rows: "4", placeholder: "Facts the copilot may use: services, rate, relevant past projects, availability, timeline, what the job post asked for…" });
    const inTone = h("select", { class: "mc-input" },
      h("option", { value: "consultative", text: "Consultative" }),
      h("option", { value: "confident", text: "Confident & direct" }),
      h("option", { value: "friendly", text: "Warm & friendly" })
    );
    const inModel = h("select", { class: "mc-input" }, MODELS.map((m) => h("option", { value: m.id, text: m.label })));

    const setupView = h("div", { class: "mc-view mc-setup" },
      h("p", { class: "mc-intro", text: "Tell the copilot who is on the call and what you want out of it. Nothing here is saved — it disappears when you leave the meeting." }),
      field("My role", inMyRole),
      field("Their role", inTheirRole),
      field("Goal of this call", inGoal),
      field("My offer & facts", inOffer, "Only these facts are used — the copilot won't invent experience or numbers."),
      h("div", { class: "mc-row2" }, field("Tone", inTone), field("Model", inModel)),
      field("My name in Meet", inMyName, "Your own captions show as \"You\"; set this only if they show your name instead."),
      h("button", { class: "mc-btn mc-btn-primary mc-full", onclick: startLive, text: "Start live copilot" })
    );

    const captionStatus = h("span", { class: "mc-cap-status" });
    const thinking = h("span", { class: "mc-thinking", text: "Thinking…" });
    const errorBox = h("div", { class: "mc-error" });
    const heard = h("div", { class: "mc-heard" });
    const suggestionList = h("div", { class: "mc-suggestions" });
    const autoToggle = h("input", { type: "checkbox", checked: true, onchange: (e) => { state.autoSuggest = e.target.checked; } });
    const manualInput = h("textarea", {
      class: "mc-input mc-textarea",
      rows: "2",
      placeholder: "Type what they said (if captions miss it) and press Enter",
      onkeydown: (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          submitManual();
        }
      }
    });
    const transcriptBox = h("div", { class: "mc-transcript" });
    const transcriptDetails = h("details", { class: "mc-details" },
      h("summary", { text: "Live transcript" }),
      transcriptBox
    );

    const quick = (label, mode) => h("button", { class: "mc-chip", text: label, onclick: () => requestSuggestion(mode, collectLastLeadTurn()) });

    const liveView = h("div", { class: "mc-view mc-live" },
      h("div", { class: "mc-statusbar" },
        captionStatus,
        h("label", { class: "mc-toggle" }, autoToggle, h("span", { text: "Auto" })),
        thinking
      ),
      heard,
      errorBox,
      suggestionList,
      h("div", { class: "mc-chips" },
        quick("Answer this", "answer"),
        quick("Handle objection", "objection"),
        quick("Talk price", "pricing"),
        quick("Close the deal", "close"),
        quick("Recap & next steps", "recap")
      ),
      manualInput,
      transcriptDetails,
      h("div", { class: "mc-footer-actions" },
        h("button", { class: "mc-btn mc-btn-ghost", onclick: () => showView("setup"), text: "Edit setup" }),
        h("button", { class: "mc-btn mc-btn-danger", onclick: clearAll, text: "Clear everything" })
      )
    );

    const header = h("div", { class: "mc-header" },
      h("div", { class: "mc-title" }, h("span", { class: "mc-logo", text: "◆" }), "Client Call Copilot"),
      h("div", { class: "mc-header-actions" },
        h("button", { class: "mc-icon-btn", title: "Minimize (Alt+Shift+M)", onclick: () => setMinimized(true), text: "–" })
      )
    );

    const panel = h("div", { class: "mc-panel" }, header, h("div", { class: "mc-body" }, setupView, liveView));
    const toastEl = h("div", { class: "mc-toast" });
    const root = h("div", { id: "mc-copilot-root" }, launcher, panel, toastEl);
    document.documentElement.appendChild(root);

    els = {
      root, launcher, panel, header, setupView, liveView, toastEl,
      inMyName, inMyRole, inTheirRole, inGoal, inOffer, inTone, inModel, captionStatus, heard, thinking, errorBox, suggestionList, manualInput, transcriptBox
    };

    makeDraggable(panel, header);
    showView("setup");
    setThinking(false);
    setMinimized(true);
  }

  function readSetup() {
    state.setup = {
      myName: clean(els.inMyName.value),
      myRole: clean(els.inMyRole.value),
      theirRole: clean(els.inTheirRole.value),
      goal: els.inGoal.value.trim(),
      offer: els.inOffer.value.trim(),
      tone: els.inTone.value,
      model: els.inModel.value
    };
    // Re-evaluate who is "me" with the updated name.
    for (const e of state.transcript) {
      if (e.speaker) e.isMe = isMeSpeaker(e.speaker);
    }
  }

  function startLive() {
    readSetup();
    if (!state.setup.myRole || !state.setup.goal) {
      toast("Add at least your role and the goal of the call");
      return;
    }
    state.live = true;
    showView("live");
    attachCaptionObserver();
    updateCaptionStatus();
    renderSuggestions();
    renderTranscript();
  }

  function showView(view) {
    if (!els) return;
    els.setupView.style.display = view === "setup" ? "" : "none";
    els.liveView.style.display = view === "live" ? "" : "none";
  }

  function setMinimized(min) {
    state.minimized = min;
    if (!els) return;
    els.panel.style.display = min ? "none" : "";
    els.launcher.style.display = min ? "" : "none";
  }

  function setThinking(on) {
    if (els) els.thinking.style.visibility = on ? "visible" : "hidden";
    if (on && els) els.errorBox.style.display = "none";
  }

  function showError(msg) {
    if (!els) return;
    els.errorBox.textContent = msg;
    els.errorBox.style.display = "block";
  }

  let toastTimer = null;
  function toast(msg) {
    if (!els) return;
    els.toastEl.textContent = msg;
    els.toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toastEl.classList.remove("show"), 2600);
  }

  function updateCaptionStatus() {
    if (!els) return;
    const on = !!findCaptionRegion();
    els.captionStatus.replaceChildren(
      h("span", { class: `mc-dot ${on ? "on" : "off"}` }),
      on ? "Listening to captions" : "Captions off ",
      ...(on ? [] : [h("button", { class: "mc-link", onclick: tryEnableCaptions, text: "Turn on" })])
    );
  }

  function submitManual() {
    const text = clean(els.manualInput.value);
    if (!text) return;
    els.manualInput.value = "";
    state.transcript.push({ id: ++entrySeq, speaker: "Lead", isMe: false, text, updatedAt: Date.now() });
    renderTranscript();
    requestSuggestion("answer", text);
  }

  function clearAll() {
    state.transcript = [];
    state.suggestions = [];
    state.blockMap = new WeakMap();
    state.lastSuggested = null;
    state.inflight = null;
    setThinking(false);
    renderSuggestions();
    renderTranscript();
    toast("Transcript and suggestions cleared");
  }

  const MODE_LABELS = {
    auto: "Reply",
    answer: "Answer",
    objection: "Objection",
    pricing: "Pricing",
    close: "Close",
    recap: "Recap"
  };

  function renderSuggestions() {
    if (!els) return;
    if (!state.suggestions.length) {
      els.suggestionList.replaceChildren(
        h("div", { class: "mc-empty", text: "When the lead finishes talking, what to say next will appear here. Use the buttons below any time." })
      );
      return;
    }
    const cards = state.suggestions.map((s, idx) => {
      const copy = () => {
        navigator.clipboard?.writeText([s.say, s.ask].filter(Boolean).join(" ")).then(() => toast("Copied"), () => {});
      };
      return h("div", { class: `mc-card ${idx === 0 ? "latest" : "older"}` },
        h("div", { class: "mc-card-head" },
          h("span", { class: "mc-tag", text: MODE_LABELS[s.mode] || "Reply" }),
          s.stage ? h("span", { class: "mc-tag mc-tag-stage", text: s.stage }) : null,
          h("span", { class: "mc-time", text: s.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }),
          h("button", { class: "mc-link", onclick: copy, text: "Copy" })
        ),
        s.signal ? h("div", { class: "mc-signal", text: s.signal }) : null,
        s.say ? h("div", { class: "mc-say" }, h("span", { class: "mc-k", text: "SAY" }), h("p", { text: s.say })) : null,
        s.points.length ? h("ul", { class: "mc-points" }, s.points.map((p) => h("li", { text: p }))) : null,
        s.ask ? h("div", { class: "mc-ask" }, h("span", { class: "mc-k", text: "ASK" }), h("p", { text: s.ask })) : null
      );
    });
    els.suggestionList.replaceChildren(...cards);
  }

  function renderHeard() {
    const lastLead = [...state.transcript].reverse().find((e) => !e.isMe);
    if (!lastLead) {
      els.heard.style.display = "none";
      return;
    }
    const text = lastLead.text.length > 160 ? `…${lastLead.text.slice(-160)}` : lastLead.text;
    els.heard.style.display = "";
    els.heard.replaceChildren(h("span", { class: "mc-k", text: "HEARD" }), h("span", {}, h("strong", { text: lastLead.speaker }), ` ${text}`));
  }

  function renderTranscript() {
    if (!els) return;
    renderHeard();
    const recent = state.transcript.slice(-30);
    els.transcriptBox.replaceChildren(
      ...(recent.length
        ? recent.map((e) => h("div", { class: `mc-line ${e.isMe ? "me" : "lead"}` },
            h("strong", { text: e.isMe ? "Me" : e.speaker || "Lead" }), " ", e.text))
        : [h("div", { class: "mc-empty", text: "No captions captured yet." })])
    );
    els.transcriptBox.scrollTop = els.transcriptBox.scrollHeight;
  }

  function makeDraggable(panel, handle) {
    let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      dragging = true;
      const r = panel.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const x = Math.min(Math.max(0, ox + e.clientX - sx), window.innerWidth - 120);
      const y = Math.min(Math.max(0, oy + e.clientY - sy), window.innerHeight - 60);
      panel.style.left = `${x}px`;
      panel.style.top = `${y}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });
    window.addEventListener("mouseup", () => { dragging = false; });
  }

  // ── Lifecycle ──
  function wipeMemory() {
    state.transcript = [];
    state.suggestions = [];
    state.blockMap = new WeakMap();
    state.setup = { ...state.setup, goal: "", offer: "", myRole: "", theirRole: "", myName: "" };
  }

  function syncWithPage() {
    const inMeeting = isInMeeting();
    if (inMeeting && !els) {
      buildUI();
    }
    if (!els) return;
    if (!inMeeting) {
      // Left the meeting: tear down the panel and drop everything from memory.
      state.live = false;
      wipeMemory();
      if (captionObserver) captionObserver.disconnect();
      observedRegion = null;
      els.root.remove();
      els = null;
      return;
    }
    if (state.live) {
      attachCaptionObserver();
      updateCaptionStatus();
    }
  }

  document.addEventListener("keydown", (e) => {
    if (!els || !e.altKey || !e.shiftKey) return;
    if (e.code === "KeyM") {
      e.preventDefault();
      setMinimized(!state.minimized);
    } else if (e.code === "KeyS" && state.live) {
      e.preventDefault();
      requestSuggestion("answer", collectLastLeadTurn());
    }
  }, true);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "MC_TOGGLE_PANEL") {
      if (!els && isInMeeting()) buildUI();
      if (els) setMinimized(!state.minimized);
      sendResponse({ ok: !!els, inMeeting: isInMeeting() });
    }
  });

  window.addEventListener("pagehide", wipeMemory);
  setInterval(syncWithPage, 1500);
  syncWithPage();
})();
