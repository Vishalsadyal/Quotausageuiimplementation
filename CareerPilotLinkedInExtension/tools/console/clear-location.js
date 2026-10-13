/*
 * AutoApply CV - clear location probe.
 *
 * Paste into the DevTools console on a LinkedIn Jobs page (extension loaded).
 *   1. Sends "clear locations" to the extension panel chat: clears the saved Search Location and
 *      Preferred Locations, so runs stop typing a place or adding a Location filter.
 *   2. Removes LinkedIn's place filter from the current search URL (geoId, location, distance...)
 *      and reloads the search without it.
 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 1. Extension settings
  const input = document.getElementById("cp-chat-input");
  const send = document.getElementById("cp-chat-send");
  if (input && send) {
    input.value = "clear locations";
    send.click();
    await sleep(1200);
    console.log("%c✓ Sent 'clear locations' to the extension (saved Search Location + Preferred Locations cleared)", "color:#10b981;font-weight:700");
  } else {
    console.warn("Extension panel not found: reload the extension at chrome://extensions, refresh this tab, then paste again.");
  }

  // 2. LinkedIn's own place filter in the URL
  const url = new URL(location.href);
  const PLACE_KEYS = ["geoId", "location", "locationId", "locationUrn", "geoUrn", "distance", "f_PP"];
  const removed = PLACE_KEYS.filter((k) => url.searchParams.has(k)).map((k) => `${k}=${url.searchParams.get(k)}`);
  PLACE_KEYS.forEach((k) => url.searchParams.delete(k));
  try {
    // The extension's search-redirect guard remembers the last search; let it accept the new URL.
    sessionStorage.removeItem("cpSearchRedirectGuard");
  } catch {}

  if (removed.length) {
    console.log(`%c✓ Removed place filter from the search: ${removed.join(", ")}. Reloading…`, "color:#10b981;font-weight:700");
    location.href = url.toString();
  } else {
    console.log("%c✓ This search has no place filter in the URL.", "color:#10b981;font-weight:700");
    const box = Array.from(document.querySelectorAll("input")).find((i) =>
      /location|city|place/i.test(`${i.getAttribute("aria-label") || ""} ${i.getAttribute("placeholder") || ""}`),
    );
    if (box?.value) console.warn(`LinkedIn's location box still shows "${box.value}". Clear it and press Enter to search everywhere.`);
  }
})();
