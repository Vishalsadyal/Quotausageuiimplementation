function sendMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (res) => {
        const err = chrome.runtime?.lastError;
        if (err) {
          resolve({ ok: false, error: err.message || "Extension unavailable" });
          return;
        }
        resolve(res || { ok: false });
      });
    } catch (e) {
      resolve({ ok: false, error: e?.message || "Extension unavailable" });
    }
  });
}

function setStatus(text, ok = true) {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = text;
  el.style.color = ok ? "#166534" : "#b91c1c";
}

// Every setting on the page is an element with data-setting="<settings key>" and a data-kind:
//   text | number | check | list (comma/newline separated) | chips (a group of checkboxes).
// Only the settings that have a field here are read and saved, so values the dashboard owns
// (name, phone, address, salary, screening answers...) are never overwritten from this page.
function settingElements() {
  return Array.from(document.querySelectorAll("[data-setting]"));
}

function parseList(text) {
  return String(text || "")
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

const sameItem = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

function writeField(el, value) {
  const kind = el.dataset.kind || "text";
  const fallback = el.dataset.default;

  if (kind === "check") {
    el.checked = value === undefined || value === null ? fallback === "true" : Boolean(value);
    return;
  }
  if (kind === "chips") {
    const values = Array.isArray(value) ? value.map(String) : [];
    const boxes = Array.from(el.querySelectorAll("input[type='checkbox']"));
    for (const box of boxes) box.checked = values.some((item) => sameItem(item, box.value));
    // Values saved earlier that have no chip stay saved instead of being dropped.
    el.dataset.extras = JSON.stringify(values.filter((item) => !boxes.some((box) => sameItem(item, box.value))));
    return;
  }
  if (kind === "list") {
    el.value = Array.isArray(value) ? value.join(", ") : "";
    return;
  }
  const isBlank = value === undefined || value === null || value === "";
  el.value = String(isBlank ? fallback ?? "" : value);
}

function readField(el) {
  const kind = el.dataset.kind || "text";

  if (kind === "check") return Boolean(el.checked);
  if (kind === "chips") {
    const chosen = Array.from(el.querySelectorAll("input[type='checkbox']"))
      .filter((box) => box.checked)
      .map((box) => box.value);
    let extras = [];
    try {
      extras = JSON.parse(el.dataset.extras || "[]");
    } catch {
      extras = [];
    }
    return [...chosen, ...extras];
  }
  if (kind === "list") return parseList(el.value);
  if (kind === "number") {
    const raw = String(el.value ?? "").trim();
    const parsed = raw === "" ? Number(el.dataset.default ?? 0) : Number(raw);
    const min = el.dataset.min === undefined ? -Infinity : Number(el.dataset.min);
    return Number.isFinite(parsed) ? Math.max(min, parsed) : Number(el.dataset.default ?? 0);
  }
  return String(el.value || "").trim();
}

function setForm(settings) {
  for (const el of settingElements()) writeField(el, settings[el.dataset.setting]);

  const chip = document.getElementById("account-chip");
  if (chip) {
    const who = settings.fullName || settings.contactEmail;
    chip.textContent = who ? `Connected as ${who}` : "Not connected. Open your dashboard to sync.";
    chip.classList.toggle("connected", Boolean(who));
  }
}

function readForm() {
  const settings = {
    // The backend sync fields are no longer used; every save clears them.
    apiBaseUrl: "",
    authToken: "",
    enableBackendSync: false,
  };
  for (const el of settingElements()) settings[el.dataset.setting] = readField(el);
  return settings;
}

async function init() {
  const loaded = await sendMessage({ type: "CP_LOAD_SETTINGS" });
  if (loaded.ok) setForm(loaded.settings || {});
}

function installAutoRefresh() {
  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      if (!changes || !changes.cpSettings) return;
      void (async () => {
        const loaded = await sendMessage({ type: "CP_LOAD_SETTINGS" });
        if (loaded.ok) {
          setForm(loaded.settings || {});
          setStatus("Settings updated (synced).");
        }
      })();
    });
  } catch {
    // ignore
  }

  try {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      void init();
    });
  } catch {
    // ignore
  }
}

document.getElementById("settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const saved = await sendMessage({ type: "CP_SAVE_SETTINGS", settings: readForm() });
  if (saved.ok) {
    setStatus("Settings saved");
    return;
  }
  setStatus(saved.error || "Failed to save settings", false);
});

// Ad-tracker blocking on LinkedIn: the block rules (src/rules/block-linkedin-trackers.json) only
// take effect once the user grants these optional host permissions, so the toggle mirrors that grant.
function trackerOrigins() {
  return chrome.runtime.getManifest().optional_host_permissions || [];
}

async function syncTrackerToggle() {
  const box = document.getElementById("blockLinkedInTrackers");
  if (!box || !chrome.permissions) return;
  try {
    box.checked = await chrome.permissions.contains({ origins: trackerOrigins() });
  } catch {
    box.checked = false;
  }
}

function installTrackerToggle() {
  const box = document.getElementById("blockLinkedInTrackers");
  if (!box || !chrome.permissions) return;
  box.addEventListener("change", async () => {
    try {
      if (box.checked) {
        // Must run inside the click handler: Chrome only shows the permission prompt for a user gesture.
        const granted = await chrome.permissions.request({ origins: trackerOrigins() });
        setStatus(granted ? "Ad trackers blocked on LinkedIn" : "Permission not granted; trackers not blocked", granted);
      } else {
        await chrome.permissions.remove({ origins: trackerOrigins() });
        setStatus("Ad trackers allowed again on LinkedIn");
      }
    } catch (err) {
      setStatus(err?.message || "Could not change tracker blocking", false);
    }
    await syncTrackerToggle();
  });
  void syncTrackerToggle();
}

init().catch(() => setStatus("Failed to load settings", false));
installAutoRefresh();
installTrackerToggle();
