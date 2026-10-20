"use client";

import { useEffect } from "react";
import {
  CONSENT_CHANGED_EVENT,
  CONSENT_STORAGE_KEY,
  EDIT_CONSENT_EVENT,
  readConsentPreferences,
} from "./cookieConsent";
import { isPostHogConfigured, reportPendingAuthEvent, startPostHog, stopPostHog } from "../src/lib/posthog-client";

/**
 * Starts PostHog (analytics + session replay) only while the visitor has granted analytics
 * consent, and stops it as soon as consent is withdrawn. Renders nothing.
 */
export default function PostHogConsentBridge() {
  useEffect(() => {
    // Consumes the one-shot Google sign-in hint cookie; runs even when PostHog is not configured.
    void reportPendingAuthEvent();
    if (!isPostHogConfigured) return;

    const sync = () => {
      if (readConsentPreferences()?.analytics_storage) void startPostHog();
      else stopPostHog();
    };
    // "Cookie settings" clears the stored choice and re-opens the banner: treat it as withdrawn.
    const withdraw = () => stopPostHog();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === CONSENT_STORAGE_KEY) sync();
    };

    sync();
    window.addEventListener(CONSENT_CHANGED_EVENT, sync);
    window.addEventListener(EDIT_CONSENT_EVENT, withdraw);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
      window.removeEventListener(EDIT_CONSENT_EVENT, withdraw);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
