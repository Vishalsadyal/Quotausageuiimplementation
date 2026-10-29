import { useEffect, useState } from "react";
import { CHROME_STORE, canInstallExtension, storeForUserAgent, type ExtensionStore } from "src/lib/extension-store";

export type VisitorExtensionStore = ExtensionStore & {
  /** False on Firefox, Safari and phones, where the extension can't be installed. */
  supported: boolean;
};

/**
 * The store this visitor should install the extension from (Edge Add-ons on Edge, else the Chrome Web
 * Store), and whether their browser can install it at all. Pages are server-rendered, so the first
 * render is always "Chrome, supported" and switches after load, which keeps the server and browser
 * HTML the same.
 */
export function useExtensionStore(): VisitorExtensionStore {
  const [store, setStore] = useState<VisitorExtensionStore>({ ...CHROME_STORE, supported: true });
  useEffect(() => {
    const ua = window.navigator.userAgent;
    setStore({ ...storeForUserAgent(ua), supported: canInstallExtension(ua) });
  }, []);
  return store;
}
