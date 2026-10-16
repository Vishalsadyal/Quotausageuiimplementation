/*
 * Shared UI helpers for the three outreach widgets (WhatsApp, Email, LinkedIn comments).
 * They build the same panel as the Auto Apply copilot: header + status badge, Start/Pause/Stop row,
 * Sent / Pending / Skipped / Activity tabs with counts, and a newest-first list of cards.
 * Styles: outreach_base.css (everything is scoped under .cp-ow).
 *
 * Loaded before the widget scripts (see manifest.json). All names start with cpOw to stay out of the
 * widgets' own scope.
 */

// A panel opens only when the user asks for it: the dashboard and popup buttons and the widgets' own searches
// put #autoapply-module=<tool> in the address. LinkedIn drops that marker as soon as you click around, so the
// choice is remembered for this tab. Closing a panel forgets it.
const CP_OW_MODULE_KEY = "cpOwModule";

function cpOwRequestedModule() {
  const found = /(?:autoapply-)?module=([a-z_]+)/.exec((window.location.hash || "").toLowerCase());
  try {
    if (found) {
      window.sessionStorage.setItem(CP_OW_MODULE_KEY, found[1]);
      return found[1];
    }
    // The jobs pages belong to the Auto Apply panel: a remembered outreach panel does not open over it.
    if (window.location.pathname.startsWith("/jobs")) return "";
    return window.sessionStorage.getItem(CP_OW_MODULE_KEY) || "";
  } catch {
    return found ? found[1] : "";
  }
}

function cpOwRememberModule(tool) {
  try {
    window.sessionStorage.setItem(CP_OW_MODULE_KEY, tool);
  } catch {
    // storage blocked: the panel then follows the address only
  }
}

function cpOwForgetModule() {
  try {
    window.sessionStorage.removeItem(CP_OW_MODULE_KEY);
  } catch {
    // nothing to forget
  }
}

const CP_OW_DASHBOARD_MESSAGES_URL = "https://www.autoapplycv.in/dashboard/jobs/linkedin/messages";

const CP_OW_ICONS = {
  sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  skip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5Z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 10c0-1 1.1-1.7 2.5-1.7s2.5.7 2.5 1.7-1.1 1.5-2.5 1.7-2.5.7-2.5 1.7 1.1 1.7 2.5 1.7 2.5-.7 2.5-1.7"/></svg>',
  scroll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
};

function cpOwIcon(name) {
  return CP_OW_ICONS[name] || "";
}

/**
 * Default "skip posts that mention" words for the WhatsApp, Email and Comment tools (clear job-seeker signals only).
 * The dashboard starts with the same list (OutreachMessages.tsx) and overwrites it when the user saves their own.
 */
const CP_OW_DEFAULT_SKIP_KEYWORDS = ["open to work", "#opentowork", "looking for a job", "looking for a new job", "looking for new opportunities", "seeking new opportunities", "job seeker", "#jobseeker", "#fresherjobseeker"];

/**
 * First keyword from the user's "skip posts that mention" list that appears in `text`, or "".
 * Case-insensitive; a keyword made of letters/digits only matches as a whole word ("hire" does not match "hired").
 * `list` is an array or a comma-separated string.
 */
function cpOwMatchIgnoreKeyword(text, list) {
  const haystack = String(text || "").toLowerCase();
  const words = Array.isArray(list) ? list : String(list || "").split(",");
  for (const raw of words) {
    const keyword = String(raw || "").trim().toLowerCase();
    if (!keyword) continue;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const left = /^[a-z0-9]/.test(keyword) ? "(?:^|[^a-z0-9])" : "";
    const right = /[a-z0-9]$/.test(keyword) ? "(?:[^a-z0-9]|$)" : "";
    if (new RegExp(left + escaped + right).test(haystack)) return keyword;
  }
  return "";
}

/**
 * Marks a LinkedIn post in red when a tool skipped it, e.g. "WhatsApp found · skipped: job seeker".
 * Built with textContent (the reason can contain the user's own keyword) and inline styles (LinkedIn's CSS must not
 * restyle it). Safe to call on every scan: an identical badge is left alone, a different one is replaced.
 */
function cpOwMarkSkippedPost(postEl, { label, reason }) {
  if (!postEl || typeof postEl.insertBefore !== "function") return;
  const key = `${label}|${reason}`;
  const old = postEl.querySelector(":scope > .cp-ow-skip-badge");
  if (old) {
    if (old.getAttribute("data-key") === key) return;
    old.remove();
  }
  const badge = document.createElement("div");
  badge.className = "cp-ow-skip-badge";
  badge.setAttribute("data-key", key);
  badge.style.cssText =
    "display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:6px 12px;padding:6px 12px;border-radius:8px;" +
    "border:1px solid #fca5a5;background:#fef2f2;color:#b91c1c;font:12px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;";
  const title = document.createElement("strong");
  title.textContent = `⛔ ${label}`;
  const why = document.createElement("span");
  why.textContent = `· skipped: ${reason}`;
  badge.append(title, why);
  postEl.insertBefore(badge, postEl.firstChild);
}

function cpOwEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** The panel frame. `controls` and `foot` are HTML strings; `tabs` is [{ id, label }]. */
function cpOwShell({ id, title, subtitle, icon, tabs, controls = "", foot = "" }) {
  const tabHtml = tabs
    .map((t) => `<button type="button" class="cp-ow-tab" data-tab="${cpOwEscape(t.id)}"><span>${cpOwEscape(t.label)}</span><b class="cp-ow-count" data-count="${cpOwEscape(t.id)}" hidden>0</b></button>`)
    .join("");
  return `
    <div class="cp-ow" id="${cpOwEscape(id)}">
      <div class="cp-ow-head" data-drag>
        <div class="cp-ow-brand">
          <div class="cp-ow-orb">${cpOwIcon(icon)}</div>
          <div><div class="cp-ow-title">${cpOwEscape(title)}</div><div class="cp-ow-sub">${cpOwEscape(subtitle)}</div></div>
        </div>
        <div class="cp-ow-head-right">
          <span class="cp-ow-hires" data-hires role="button" tabindex="0" title="Hires left. Each message or comment costs 1. Click for plans and top-up.">${cpOwIcon("coin")}<b data-hires-text>-- Hires</b></span>
          <span class="cp-ow-badge" data-badge>Idle</span>
          <div class="cp-ow-actions">
            <button type="button" data-act="min" title="Minimize">&ndash;</button>
            <button type="button" data-act="max" title="Maximize">+</button>
            <button type="button" data-act="close" title="Close">&times;</button>
          </div>
        </div>
      </div>
      <div class="cp-ow-body">
        <div class="cp-ow-controls">${controls}</div>
        <div class="cp-ow-tabs">${tabHtml}</div>
        <div class="cp-ow-list" data-list aria-live="polite"></div>
        <div class="cp-ow-foot">${foot}</div>
      </div>
    </div>`;
}

/** kind: start | pause | stop | ghost | "" ; icon: a CP_OW_ICONS name or "". */
function cpOwButton({ id = "", label, kind = "", icon = "", title = "" }) {
  return `<button type="button" class="cp-ow-btn${kind ? ` is-${kind}` : ""}"${id ? ` id="${cpOwEscape(id)}"` : ""}${title ? ` title="${cpOwEscape(title)}"` : ""}>${icon ? cpOwIcon(icon) : ""}<span>${cpOwEscape(label)}</span></button>`;
}

/** Start / Pause / Stop row. Ids are `${prefix}-start`, `${prefix}-pause`, `${prefix}-stop`. */
function cpOwQuickRow(prefix, labels = {}) {
  return `<div class="cp-ow-quick">
    ${cpOwButton({ id: `${prefix}-start`, label: labels.start || "Start", kind: "start", icon: "play" })}
    ${cpOwButton({ id: `${prefix}-pause`, label: labels.pause || "Pause", kind: "pause", icon: "pause" })}
    ${cpOwButton({ id: `${prefix}-stop`, label: labels.stop || "Stop", kind: "stop", icon: "stop" })}
  </div>`;
}

/** kind: sent | skipped | error | "" . Everything is escaped here; pass plain text. */
function cpOwCard({ kind = "", icon = "sparkle", title = "", titleUrl = "", sub = "", reason = "", tag = "", time = "", actionsHtml = "" }) {
  const safeUrl = /^https:\/\/([a-z0-9-]+\.)*linkedin\.com\//i.test(titleUrl) ? titleUrl : "";
  const titleHtml = safeUrl ? `<a href="${cpOwEscape(safeUrl)}" target="_blank" rel="noopener noreferrer">${cpOwEscape(title)}</a>` : cpOwEscape(title);
  return `<div class="cp-ow-card${kind ? ` is-${kind}` : ""}">
    <span class="cp-ow-card-icon">${cpOwIcon(icon)}</span>
    <div class="cp-ow-card-main">
      <div class="cp-ow-card-title">${titleHtml}${tag ? `<span class="cp-ow-tag">${cpOwEscape(tag)}</span>` : ""}</div>
      ${sub ? `<div class="cp-ow-card-sub">${cpOwEscape(sub)}</div>` : ""}
      ${reason ? `<div class="cp-ow-card-reason">${cpOwEscape(reason)}</div>` : ""}
      ${actionsHtml ? `<div class="cp-ow-card-actions">${actionsHtml}</div>` : ""}
    </div>
    ${time ? `<span class="cp-ow-time">${cpOwEscape(time)}</span>` : ""}
  </div>`;
}

function cpOwBanner({ title, main, detail = "" }) {
  return `<div class="cp-ow-banner"><div class="cp-ow-banner-head"><span class="cp-ow-pulse"></span><span class="cp-ow-banner-title">${cpOwEscape(title)}</span></div><div class="cp-ow-banner-main">${cpOwEscape(main)}</div>${detail ? `<div class="cp-ow-banner-detail">${cpOwEscape(detail)}</div>` : ""}</div>`;
}

function cpOwWorking(text) {
  return `<div class="cp-ow-working"><span class="cp-ow-dot"></span><span class="cp-ow-dot"></span><span class="cp-ow-dot"></span> ${cpOwEscape(text)}</div>`;
}

/** The empty state. `text` may contain simple markup written by the widget (not user data). */
function cpOwEmpty(icon, text) {
  return `<div class="cp-ow-empty"><span>${cpOwIcon(icon)}</span><span>${text}</span></div>`;
}

/** A row of 3 or 4 live numbers: items = [{ id, label, value }]. Update with root.querySelector(`[data-stat="id"]`). */
function cpOwStats(items) {
  return `<div class="cp-ow-stats">${items.map((s) => `<div class="cp-ow-stat"><b data-stat="${cpOwEscape(s.id)}">${cpOwEscape(s.value ?? 0)}</b><span>${cpOwEscape(s.label)}</span></div>`).join("")}</div>`;
}

/** The line that points to where the messages and options are edited. */
function cpOwDashboardNote(text = "Your message and options are edited in your dashboard.", warn = false) {
  return `<div class="cp-ow-note${warn ? " is-warn" : ""}"><span>${cpOwEscape(text)}</span><a href="${CP_OW_DASHBOARD_MESSAGES_URL}" target="_blank" rel="noopener noreferrer">Edit messages</a></div>`;
}

/**
 * Wires a shell built with cpOwShell: drag by the header, minimize / maximize, tabs.
 * Returns a controller: { root, list, tab, setTab(id), setBadge(text, kind), setCount(id, n), setList(html), show(), hide() }
 * kind for setBadge: "run" | "pause" | "" .
 */
function cpOwInit(root, { defaultTab, onTab } = {}) {
  const head = root.querySelector("[data-drag]");
  const list = root.querySelector("[data-list]");
  const tabButtons = Array.from(root.querySelectorAll("[data-tab]"));
  const controller = {
    root,
    list,
    tab: defaultTab || (tabButtons[0] && tabButtons[0].dataset.tab) || "",
    setTab(id) {
      controller.tab = id;
      tabButtons.forEach((b) => b.classList.toggle("is-active", b.dataset.tab === id));
      if (typeof onTab === "function") onTab(id);
    },
    setBadge(text, kind = "") {
      const badge = root.querySelector("[data-badge]");
      if (!badge) return;
      badge.textContent = text;
      badge.className = `cp-ow-badge${kind ? ` is-${kind}` : ""}`;
    },
    setCount(id, n) {
      const el = root.querySelector(`[data-count="${id}"]`);
      if (!el) return;
      el.textContent = String(n);
      el.hidden = !(Number(n) > 0);
    },
    setList(html) {
      if (list) list.innerHTML = html;
    },
    show() {
      root.classList.add("is-visible");
    },
    hide() {
      root.classList.remove("is-visible");
    },
  };

  tabButtons.forEach((b) => b.addEventListener("click", () => controller.setTab(b.dataset.tab)));
  root.querySelector('[data-act="min"]')?.addEventListener("click", () => root.classList.toggle("is-minimized"));
  root.querySelector('[data-act="close"]')?.addEventListener("click", () => {
    root.classList.remove("is-visible");
    cpOwForgetModule();
  });
  root.querySelector('[data-act="max"]')?.addEventListener("click", () => {
    root.classList.remove("is-minimized");
    root.classList.toggle("is-maximized");
  });

  // Drag by the header (not from its buttons).
  if (head) {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;
    const onMove = (event) => {
      if (!dragging) return;
      const left = Math.max(8, Math.min(window.innerWidth - 120, event.clientX - offsetX));
      const top = Math.max(8, Math.min(window.innerHeight - 80, event.clientY - offsetY));
      root.style.left = `${left}px`;
      root.style.top = `${top}px`;
      root.style.right = "auto";
      root.style.bottom = "auto";
    };
    const onUp = () => {
      dragging = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    head.addEventListener("mousedown", (event) => {
      if (event.target instanceof HTMLElement && event.target.closest("button")) return;
      if (root.classList.contains("is-maximized")) root.classList.remove("is-maximized");
      const rect = root.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      dragging = true;
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
  }

  controller.setTab(controller.tab);
  cpOwBindHires(root);
  return controller;
}

const CP_OW_UPGRADE_URL = "https://www.autoapplycv.in/dashboard/billing";

/**
 * Shows the Hires left in the header chip and keeps it live. The background rewrites `cpHiresBalance` after every
 * allowance check and every charge (one per message or comment), so the number drops as each one is sent,
 * and flashes "-1". It also asks for a fresh number now and whenever the tab becomes visible again.
 */
function cpOwBindHires(root) {
  const chip = root.querySelector("[data-hires]");
  const text = root.querySelector("[data-hires-text]");
  if (!chip || !text || typeof chrome === "undefined" || !chrome.storage) return;
  let last = null;
  let flashTimer = 0;
  // Click (or Enter) opens the plans / top-up page; it is the Upgrade button once the Hires run out.
  const openPlans = () => window.open(CP_OW_UPGRADE_URL, "_blank", "noopener");
  chip.addEventListener("click", openPlans);
  chip.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") openPlans();
  });
  const apply = (balance) => {
    if (!balance) return;
    chip.hidden = false;
    const n = Number(balance.spendable || 0);
    text.textContent = balance.unlimited ? "Unlimited" : n <= 0 ? "0 Hires · Upgrade" : `${n} ${n === 1 ? "Hire" : "Hires"}`;
    chip.classList.toggle("is-low", !balance.unlimited && n > 0 && n <= 3);
    chip.classList.toggle("is-empty", !balance.unlimited && n <= 0);
    if (!balance.unlimited && last !== null && n < last) {
      chip.setAttribute("data-delta", `-${last - n}`);
      chip.classList.remove("is-drop");
      void chip.offsetWidth; // restart the animation
      chip.classList.add("is-drop");
      window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => chip.classList.remove("is-drop"), 1700);
    }
    last = balance.unlimited ? null : n;
  };
  const refresh = () => {
    try {
      chrome.runtime.sendMessage({ type: "CP_OUTREACH_STATUS" }, () => void chrome.runtime.lastError);
    } catch {
      // extension reloaded: this page needs a refresh
    }
  };
  try {
    chrome.storage.local.get("cpHiresBalance", (data) => apply(data && data.cpHiresBalance));
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.cpHiresBalance) apply(changes.cpHiresBalance.newValue);
    });
  } catch {
    // storage unavailable
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
  refresh();
}

/** "12:41:03" from an ISO string or a Date/number; empty when unknown. */
function cpOwClock(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
