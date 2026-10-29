// Where to install the extension: the Chrome Web Store, or Microsoft Edge Add-ons for Edge users.
// The site talks to the extension through its content script (dashboard-bridge), not by extension ID,
// so the Edge build (a different ID) works the same.

export const CHROME_EXTENSION_ID = "mcfmniiniaigfhhjlaegpmhecbdoikjd";
export const EDGE_EXTENSION_ID = "pkbinmflffpfkaiabakaalaodidgfpna";

export const CHROME_STORE_URL = `https://chromewebstore.google.com/detail/${CHROME_EXTENSION_ID}`;
export const EDGE_STORE_URL = `https://microsoftedge.microsoft.com/addons/detail/${EDGE_EXTENSION_ID}`;

// Set to true once Microsoft approves the Edge Add-ons listing; until then its link is a 404, so
// Edge users are sent to the Chrome Web Store (Edge installs Chrome extensions too).
export const EDGE_ADDON_PUBLISHED = false;

export type ExtensionStore = {
  browser: "chrome" | "edge";
  /** Store listing to install from. */
  url: string;
  /** Where to leave a review. */
  reviewUrl: string;
  /** "Chrome Web Store" or "Edge Add-ons", for button text. */
  name: string;
  /** "Chrome" or "Edge", as in "Add to Chrome". */
  browserName: string;
};

export const CHROME_STORE: ExtensionStore = {
  browser: "chrome",
  url: CHROME_STORE_URL,
  reviewUrl: `${CHROME_STORE_URL}/reviews`,
  name: "Chrome Web Store",
  browserName: "Chrome",
};

export const EDGE_STORE: ExtensionStore = {
  browser: "edge",
  url: EDGE_STORE_URL,
  // Edge shows ratings and reviews on the listing page itself.
  reviewUrl: EDGE_STORE_URL,
  name: "Edge Add-ons",
  browserName: "Edge",
};

/** Desktop Edge says "Edg/" in its user agent (Chrome does not). */
export function isEdgeUserAgent(userAgent: string) {
  return /\bEdg\//.test(userAgent);
}

/**
 * Whether this browser can install the extension: desktop Chrome, Edge and other Chromium browsers
 * (Brave, Opera…). Not Firefox, Safari, or any phone or tablet (mobile Chrome has no extensions).
 */
export function canInstallExtension(userAgent: string) {
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)) return false;
  if (/Firefox\/|FxiOS\//.test(userAgent)) return false;
  return /\bChrome\/|\bEdg\//.test(userAgent);
}

export function storeForUserAgent(userAgent: string): ExtensionStore {
  return EDGE_ADDON_PUBLISHED && isEdgeUserAgent(userAgent) ? EDGE_STORE : CHROME_STORE;
}

/** Official store listings, for structured data (sameAs). */
export function publishedStoreUrls(): string[] {
  return EDGE_ADDON_PUBLISHED ? [CHROME_STORE_URL, EDGE_STORE_URL] : [CHROME_STORE_URL];
}
