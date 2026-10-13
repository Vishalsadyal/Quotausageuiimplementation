// Test 4 - page layout map (+ optional Easy Apply form layout).
// Writes a compact outline of every region of the LinkedIn Jobs page using only the markers that
// survive LinkedIn's class renames: role, data-testid, componentkey, data-sdui-screen,
// data-view-name, aria-*, ids, headings, buttons, links, form fields. Repeated siblings (job cards,
// list items) are shown once with "x N". Downloads ONE .json file.
// With CONFIG.openEasyApply = true it also opens the open job's Easy Apply form, maps every question
// and button, then closes it and discards the draft. It NEVER clicks Next, Review or Submit.
(async () => {
  // ------------------------------------------------------------------ settings (edit before pasting)
  const CONFIG = {
    openEasyApply: false, // true = also open + map + discard the Easy Apply form of the open job
    maxLinesPerRegion: 400,
    maxDepth: 40,
    ...(window.__cpLayoutOptions || {}), // set by 4b-easyapply-layout-probe.js
  };

  const Dom = window.CPLinkedInDom;
  const Wait = window.CPLinkedInWait;
  const Pages = window.CPLinkedInPages;
  if (!Dom || !Wait || !Pages) return console.error("CPLinkedIn modules missing: paste the whole probe file.");
  console.log("%cAutoApply CV - Test 4: mapping the page layout", "font-weight:700;color:#6366f1");

  const clean = (t) => String(t || "").replace(/\s+/g, " ").trim();
  const isVisible = (el) => {
    const r = el?.getBoundingClientRect?.();
    return Boolean(r && r.width > 0 && r.height > 0);
  };
  // Generalise ids so repeated items look the same: uuids, long numbers, React ids.
  const generalise = (v) =>
    String(v)
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
      .replace(/\d{6,}/g, "<id>")
      .replace(/^_r_[0-9a-z]+_$/i, "<react-id>");

  // ------------------------------------------------------------------ shadow DOM + iframes
  // LinkedIn's "interop" layer (data-testid="interop-iframe" / "interop-shadowdom") hosts older
  // features inside an iframe or a shadow root. Normal querySelector cannot see inside them.
  /** document + every OPEN shadow root + every same-origin iframe document, recursively. */
  function allRoots(start = document) {
    const roots = [start];
    for (let i = 0; i < roots.length && roots.length < 200; i += 1) {
      for (const el of roots[i].querySelectorAll("*")) {
        if (el.shadowRoot) roots.push(el.shadowRoot);
        if (el.tagName === "IFRAME") {
          try {
            if (el.contentDocument?.body) roots.push(el.contentDocument);
          } catch {
            // cross-origin iframe: not readable
          }
        }
      }
    }
    return roots;
  }
  const deepAll = (selector) => allRoots().flatMap((r) => Array.from(r.querySelectorAll(selector)));

  /** Where the interop hosts / iframes are and whether their content can be read. */
  function interopReport() {
    return Array.from(document.querySelectorAll("[data-testid^='interop'], iframe"))
      .slice(0, 20)
      .map((el) => {
        let iframe = null;
        if (el.tagName === "IFRAME") {
          let sameOrigin = false;
          try {
            sameOrigin = Boolean(el.contentDocument);
          } catch {
            sameOrigin = false;
          }
          iframe = { src: String(el.getAttribute("src") || "").replace(/[?#].*$/, "").slice(0, 120), sameOrigin, title: el.getAttribute("title") || "" };
        }
        return {
          signature: signature(el),
          visible: isVisible(el),
          openShadowRoot: Boolean(el.shadowRoot),
          shadowChildren: el.shadowRoot ? el.shadowRoot.querySelectorAll("*").length : 0,
          children: el.querySelectorAll("*").length,
          iframe,
        };
      });
  }

  // ------------------------------------------------------------------ outline
  const KEEP_TAGS = new Set(["MAIN", "HEADER", "NAV", "FOOTER", "SECTION", "ASIDE", "FORM", "DIALOG", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "BUTTON", "A", "INPUT", "SELECT", "TEXTAREA", "LABEL", "FIELDSET", "LEGEND", "IFRAME", "TIME", "IMG"]);
  const ATTRS = ["role", "data-testid", "data-sdui-screen", "data-view-name", "data-component-type", "componentkey", "id", "aria-label", "aria-labelledby", "aria-describedby", "type", "name", "placeholder", "for", "href", "aria-current", "aria-checked", "aria-expanded", "aria-required", "aria-invalid", "aria-disabled", "required", "disabled", "target"];

  function signature(el) {
    const parts = [el.tagName.toLowerCase()];
    for (const name of ATTRS) {
      if (!el.hasAttribute(name)) continue;
      let v = el.getAttribute(name) || "";
      if (name === "href") {
        try {
          const u = new URL(v, location.href);
          v = u.hostname === location.hostname ? generalise(u.pathname) : `${u.hostname}${generalise(u.pathname)}`;
        } catch {
          v = generalise(v).slice(0, 60);
        }
      } else if (name === "aria-label" || name === "placeholder") {
        v = clean(v).slice(0, 70);
      } else {
        v = generalise(v);
      }
      parts.push(v === "" ? name : `${name}="${v}"`);
    }
    return parts.join(" ");
  }

  const isMarked = (el) => KEEP_TAGS.has(el.tagName) || ATTRS.slice(0, 7).some((a) => el.hasAttribute(a));

  /** Own short text of an element (text nodes directly inside it, or the whole text for small leaves). */
  function ownText(el) {
    const direct = clean(Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" "));
    if (direct) return direct.slice(0, 80);
    if (el.querySelectorAll("*").length <= 6) return clean(el.textContent).slice(0, 80);
    return "";
  }

  /**
   * Outline of `root`: one line per marked element, indented by marked depth. Consecutive siblings
   * with the same structure are collapsed into the first one plus "(x N similar)".
   */
  function outline(root, { maxLines = CONFIG.maxLinesPerRegion } = {}) {
    const lines = [];
    const shape = (el) => `${signature(el)}|${Array.from(el.children).map((c) => c.tagName).join(",")}`;
    function walk(el, depth) {
      if (lines.length >= maxLines || depth > CONFIG.maxDepth) return;
      if (el.tagName === "SVG" || el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.closest?.("[id^='cp-'], .cp-probe-label")) return;
      const marked = isMarked(el);
      if (marked) {
        const text = ownText(el);
        const hidden = isVisible(el) ? "" : " [hidden]";
        lines.push(`${"  ".repeat(depth)}<${signature(el)}>${text ? ` "${text}"` : ""}${hidden}`);
      }
      if (el.shadowRoot) {
        lines.push(`${"  ".repeat(depth + 1)}#shadow-root (open)`);
        for (const kid of el.shadowRoot.children) walk(kid, depth + 2);
      }
      if (el.tagName === "IFRAME") {
        try {
          if (el.contentDocument?.body) {
            lines.push(`${"  ".repeat(depth + 1)}#iframe-document`);
            walk(el.contentDocument.body, depth + 2);
          }
        } catch {
          lines.push(`${"  ".repeat(depth + 1)}#iframe (cross-origin, not readable)`);
        }
      }
      const kids = Array.from(el.children);
      for (let i = 0; i < kids.length; i += 1) {
        const kid = kids[i];
        walk(kid, depth + (marked ? 1 : 0));
        // collapse a run of same-shaped siblings (job cards, list items)
        let j = i + 1;
        while (j < kids.length && shape(kids[j]) === shape(kid)) j += 1;
        if (j - i > 2) {
          lines.push(`${"  ".repeat(depth + (marked ? 1 : 0))}... (x ${j - i - 1} more similar <${kid.tagName.toLowerCase()}>)`);
          i = j - 1;
        }
      }
    }
    walk(root, 0);
    if (lines.length >= maxLines) lines.push(`... (truncated at ${maxLines} lines)`);
    return lines.join("\n");
  }

  // ------------------------------------------------------------------ regions
  const tiles = Dom.findJobTiles().tiles;
  const listOf = (cards) => {
    let n = cards[0]?.parentElement;
    while (n && n !== document.body && !cards.every((c) => n.contains(c))) n = n.parentElement;
    return n;
  };
  const regions = {
    header: document.querySelector("header") || document.querySelector("[data-testid='primary-nav']"),
    searchBox: document.querySelector("[role='search']") || document.querySelector("input[data-testid*='typeahead' i]"),
    filters: document.querySelector("#JobsSearchFilters, [componentkey='JobsSearchFilters'], [role='toolbar']"),
    resultsHeader: Array.from(document.querySelectorAll("header")).find((h) => /results/i.test(h.textContent || "")),
    resultsList: listOf(tiles),
    firstCard: tiles[0],
    pagination: Pages.paginationBar(),
    detailsPane: Dom.findDetailPane({ fresh: true }).element,
  };

  const report = {
    url: location.href.replace(/((?:[?&])(eBP|trackingId|refId)=)[^&]*/g, "$1x"),
    at: new Date().toISOString(),
    summary: {
      cards: tiles.length,
      cardStrategy: Dom.findJobTiles().strategy,
      detailStrategy: Dom.findDetailPane().strategy,
      page: Pages.currentPageInfo(),
      next: Pages.findNext().results,
      landmarks: Array.from(document.querySelectorAll("main, header, nav, footer, [role='main'], [role='navigation'], [role='search'], [role='toolbar'], [role='dialog'], dialog"))
        .map((el) => signature(el))
        .slice(0, 40),
      testIds: [...new Set(Array.from(document.querySelectorAll("[data-testid]")).map((el) => generalise(el.getAttribute("data-testid"))))].sort(),
      sduiScreens: [...new Set(Array.from(document.querySelectorAll("[data-sdui-screen]")).map((el) => el.getAttribute("data-sdui-screen")))],
      interop: interopReport(),
      componentKeys: [...new Set(Array.from(document.querySelectorAll("[componentkey]")).map((el) => generalise(el.getAttribute("componentkey"))))].sort().slice(0, 150),
    },
    regions: {},
    easyApply: null,
  };
  console.log(
    `interop hosts: ${
      report.summary.interop
        .map((x) => `${x.signature.slice(0, 60)}${x.openShadowRoot ? " [open shadow root]" : ""}${x.iframe ? ` [iframe ${x.iframe.sameOrigin ? "same-origin" : "cross-origin"} ${x.iframe.src}]` : ""}`)
        .join(" | ") || "none"
    }`,
  );
  for (const [name, el] of Object.entries(regions)) {
    report.regions[name] = el ? { found: true, root: signature(el), outline: outline(el) } : { found: false };
    console.log(`${el ? "✓" : "✗"} ${name}${el ? ` - ${report.regions[name].outline.split("\n").length} lines` : " (not found)"}`);
  }

  // ------------------------------------------------------------------ Easy Apply form (optional)
  /** Every question in a form: label, type, required, current value, options. */
  function mapFields(root) {
    const labelFor = (f) => {
      const byFor = f.id && (f.getRootNode().querySelector?.(`label[for="${CSS.escape(f.id)}"]`) || root.querySelector(`label[for="${CSS.escape(f.id)}"]`));
      const byLabelledBy = (f.getAttribute("aria-labelledby") || "")
        .split(/\s+/)
        .map((id) => (f.getRootNode().getElementById?.(id) || document.getElementById(id))?.textContent)
        .filter(Boolean)
        .join(" ");
      return clean(byFor?.textContent || f.getAttribute("aria-label") || byLabelledBy || f.closest("fieldset")?.querySelector("legend")?.textContent || f.closest("label")?.textContent || f.getAttribute("placeholder") || f.name).slice(0, 120);
    };
    const fields = [];
    const seenRadioGroups = new Set();
    for (const f of root.querySelectorAll("input, select, textarea, [role='combobox'], [role='radiogroup'], [role='listbox'], [contenteditable='true']")) {
      if (f.type === "hidden") continue;
      if (f.type === "radio" || f.type === "checkbox") {
        const group = f.closest("fieldset, [role='radiogroup'], [role='group']") || f.parentElement;
        if (seenRadioGroups.has(group)) continue;
        seenRadioGroups.add(group);
        const options = Array.from(group.querySelectorAll(`input[type="${f.type}"]`)).map((o) => ({
          label: clean(group.querySelector(`label[for="${CSS.escape(o.id)}"]`)?.textContent || o.getAttribute("aria-label") || o.value).slice(0, 60),
          checked: o.checked,
        }));
        fields.push({ kind: f.type === "radio" ? "radio-group" : "checkbox-group", label: clean(group.querySelector("legend, [id$='-title'], span")?.textContent || labelFor(f)).slice(0, 120), required: Boolean(group.querySelector("[required], [aria-required='true']")) || /\*/.test(group.textContent || ""), options, signature: signature(f) });
        continue;
      }
      fields.push({
        kind: f.tagName === "SELECT" ? "select" : f.getAttribute("role") || f.type || f.tagName.toLowerCase(),
        label: labelFor(f),
        required: f.required || f.getAttribute("aria-required") === "true",
        value: f.tagName === "SELECT" ? clean(f.selectedOptions?.[0]?.textContent) : String(f.value || "").slice(0, 80),
        options: f.tagName === "SELECT" ? Array.from(f.options).map((o) => clean(o.textContent).slice(0, 60)).slice(0, 30) : undefined,
        invalid: f.getAttribute("aria-invalid") === "true",
        error: clean((f.getAttribute("aria-describedby") || "").split(/\s+/).map((id) => document.getElementById(id)?.textContent).join(" ")).slice(0, 120),
        visible: isVisible(f),
        signature: signature(f),
        // Does the field have its own wrapper, or share its parent with other questions? (The
        // extension groups a question's label + field by its nearest single-question ancestor.)
        ownWrapperDepth: (() => {
          let depth = 0;
          for (let n = f.parentElement; n && n !== root; n = n.parentElement, depth += 1) {
            const qs = n.querySelectorAll("input:not([type='hidden']), select, textarea, [role='combobox']").length;
            if (qs > 1) return depth; // levels of wrappers that hold only this field
          }
          return depth;
        })(),
        parentHoldsOtherQuestions:
          (f.parentElement?.querySelectorAll("input:not([type='hidden']), select, textarea, [role='combobox']").length || 0) > 1,
      });
    }
    return fields;
  }

  if (CONFIG.openEasyApply) {
    const action = Dom.findApplyAction();
    if (action.type !== "easy") {
      report.easyApply = { opened: false, reason: `open job has no Easy Apply button (found: ${action.type})` };
      console.warn(`Easy Apply: skipped - the open job has no Easy Apply button (found: ${action.type}). Open an Easy Apply job first.`);
    } else {
      // search the page AND open shadow roots / same-origin iframes (interop layer)
      const dialogs = () =>
        deepAll("[role='dialog'], [role='alertdialog'], dialog[open], [aria-modal='true']").filter((d) => isVisible(d) && clean(d.textContent).length > 20);
      const before = new Set(dialogs());
      const urlBefore = location.href;
      Dom.realClick(action.button);
      const opened = await Wait.until(() => dialogs().find((d) => !before.has(d)) || (location.href !== urlBefore && /\/apply/.test(location.href) && deepAll("form")[0]), { timeoutMs: 10000 });
      const form = opened.ok ? (opened.value?.nodeType === 1 ? opened.value : deepAll("form")[0]) : null;
      if (!form) {
        report.easyApply = {
          opened: false,
          reason: "no dialog or apply page within 10 s",
          urlAfter: location.href,
          interopAfterClick: interopReport(),
          dialogsAnywhere: deepAll("[role='dialog'], [role='alertdialog'], dialog, [aria-modal]").map((d) => ({ signature: signature(d), visible: isVisible(d), text: clean(d.textContent).slice(0, 120) })),
        };
        console.warn("Easy Apply: the form did not open within 10 s (daily limit, login wall, or a new layout). See report.easyApply.");
      } else {
        // The dialog opens first with a spinner (data-testid="loader"); wait for real content: a form
        // field or a Next / Review / Submit / Done button (Dismiss alone does not count).
        const formReady = () => {
          if (form.querySelector("[data-testid='loader'], [role='progressbar'][aria-busy='true']")) return false;
          if (form.querySelector("input:not([type='hidden']), select, textarea, [role='combobox'], [contenteditable='true']")) return true;
          return Array.from(form.querySelectorAll("button, [role='button']")).some((b) => /next|review|submit|continue|done/i.test(clean(b.getAttribute("aria-label") || b.textContent)));
        };
        const ready = await Wait.settled(form, formReady, { timeoutMs: 15000, quietMs: 500 });
        if (!ready.ok) console.warn(`Easy Apply: the form content did not finish loading (${ready.reason}); mapping what is there.`);
        const buttons = Array.from(form.querySelectorAll("button, [role='button'], a[href]"))
          .filter(isVisible)
          .map((b) => ({ label: clean(b.getAttribute("aria-label") || b.textContent).slice(0, 60), disabled: b.disabled === true || b.getAttribute("aria-disabled") === "true", signature: signature(b) }));
        report.easyApply = {
          opened: true,
          openedAs:
            (form.matches("[role='dialog'], [role='alertdialog'], dialog, [aria-modal='true']") ? "dialog" : `page ${location.pathname}`) +
            (form.getRootNode() instanceof ShadowRoot ? " inside a SHADOW ROOT" : form.ownerDocument !== document ? " inside an IFRAME" : " in the main page"),
          heading: clean(form.querySelector("h1, h2, h3")?.textContent),
          progress: clean(Array.from(form.querySelectorAll("[role='progressbar'], progress, [aria-valuenow]")).map((p) => `${p.getAttribute("aria-valuenow") || p.value || ""}${p.getAttribute("aria-valuemax") ? `/${p.getAttribute("aria-valuemax")}` : ""} ${p.getAttribute("aria-label") || ""}`).join(" ")) || (clean(form.textContent).match(/\b\d{1,3}%/) || [""])[0],
          fields: mapFields(form),
          buttons,
          outline: outline(form, { maxLines: 600 }),
        };
        console.log(`Easy Apply: opened as ${report.easyApply.openedAs}, step "${report.easyApply.heading}", ${report.easyApply.fields.length} fields, buttons: ${buttons.map((b) => b.label).join(" · ")}`);
        // Close WITHOUT submitting: Dismiss/Close, then Discard on the "Save this application?" prompt.
        const dismiss = Array.from(form.querySelectorAll("button, [role='button']")).find((b) => /^(dismiss|close)\b/i.test(clean(b.getAttribute("aria-label") || b.textContent)));
        if (dismiss) Dom.realClick(dismiss);
        else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        const prompt = await Wait.until(() => dialogs().find((d) => /discard|save this application|save application/i.test(d.textContent || "")), { timeoutMs: 3000 });
        if (prompt.ok) {
          report.easyApply.closePrompt = outline(prompt.value, { maxLines: 80 });
          const discard = Array.from(prompt.value.querySelectorAll("button, [role='button']")).find((b) => /^discard\b/i.test(clean(b.getAttribute("aria-label") || b.textContent)));
          if (discard) Dom.realClick(discard);
        }
        await Wait.until(() => !dialogs().length, { timeoutMs: 4000 });
        report.easyApply.closed = !dialogs().length;
        console.log(report.easyApply.closed ? "Easy Apply: closed and discarded." : "Easy Apply: a dialog is still open - close it manually.");
      }
    }
  }

  // ------------------------------------------------------------------ save
  const json = JSON.stringify(report, null, 1);
  const name = `linkedin-layout-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 2000);
  } catch (e) {
    console.warn("Download failed; the report is in window.__cpLayout", e);
  }
  window.__cpLayout = report;
  console.log(`RESULT: layout of ${Object.values(report.regions).filter((r) => r.found).length}/${Object.keys(report.regions).length} regions${report.easyApply?.opened ? " + Easy Apply form" : ""} -> downloaded ${name} (${Math.round(json.length / 1024)} KB). Send that file.`);
  console.log("First card outline:\n" + (report.regions.firstCard.outline || "(none)").split("\n").slice(0, 25).join("\n"));
  return name;
})();
