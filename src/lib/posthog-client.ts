// Browser-only PostHog wrapper (session replay + product analytics).
//
// - posthog-js is imported lazily, and only after the visitor has granted analytics consent, so
//   nothing is downloaded, stored or sent before consent.
// - Every export is safe to call anywhere: without configuration, consent or a browser it is a no-op.
// - Privacy: inputs are always masked; all text is masked on private areas (dashboard, opt-out page);
//   admins and admin-impersonation sessions are never recorded; query strings are redacted.
import type { PostHog, PostHogConfig, Properties } from "posthog-js";
import { clearCookie, readConsentPreferences, readCookie } from "../../app/cookieConsent";
import { POSTHOG_HOST, POSTHOG_TOKEN, isPostHogConfigured } from "./posthog-config";

export { isPostHogConfigured };

export type AppEvent =
  | "form_submission_failed"
  | "form_submission_succeeded"
  | "api_request_failed"
  | "user_action_failed"
  | "checkout_abandoned"
  | "auth_succeeded"
  | "onboarding_step_viewed"
  | "onboarding_completed";

export type AuthMethod = "password" | "otp" | "google" | "resume_upload";

export type TrackedUser = { id: string; role: "user" | "admin"; impersonated: boolean };

// Areas whose on-screen text (names, emails, resumes, contacts, billing) must not be recorded.
const PRIVATE_PATH_PREFIXES = ["/dashboard", "/admin", "/remove-my-contact"];
// Query parameters that are safe to keep in recorded URLs; everything else is redacted.
const SAFE_QUERY_PARAMS = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]);
const SENSITIVE_KEY = /pass|token|secret|cookie|authorization|otp|email|phone|signature|card/i;

let ready: Promise<PostHog | null> | null = null;
let active = false;
let bootedOnAdmin = false;
let userSuppressed = false;
let desiredUserId: string | null = null;
let identifiedUserId: string | null = null;
let recordingPausedByUs = false;
let fetchObserverInstalled = false;

function isBrowser() {
  return typeof window !== "undefined";
}

function hasAnalyticsConsent() {
  return readConsentPreferences()?.analytics_storage === true;
}

function isSuppressed() {
  return userSuppressed || bootedOnAdmin;
}

function isPrivatePath() {
  if (!isBrowser()) return true;
  const path = window.location.pathname.toLowerCase();
  return PRIVATE_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Drops the fragment and redacts every query value except UTM parameters. */
export function sanitizeUrl(raw: string): string {
  try {
    const url = new URL(raw, isBrowser() ? window.location.href : "https://invalid.local");
    url.hash = "";
    for (const key of Array.from(url.searchParams.keys())) {
      if (!SAFE_QUERY_PARAMS.has(key.toLowerCase())) url.searchParams.set(key, "[REDACTED]");
    }
    return /^[a-z][a-z0-9+.-]*:/i.test(raw) ? url.toString() : `${url.pathname}${url.search}`;
  } catch {
    return String(raw).split(/[?#]/)[0];
  }
}

const URL_PROPERTIES = ["$current_url", "$referrer", "$initial_current_url", "$initial_referrer"];

function redactUrlProperties(bag: Properties | undefined) {
  if (!bag) return;
  for (const key of URL_PROPERTIES) {
    if (typeof bag[key] === "string" && bag[key]) bag[key] = sanitizeUrl(bag[key] as string);
  }
}

/** Custom event properties: primitives only, short, and never sensitive-looking keys. */
function safeProperties(props: Record<string, unknown> | undefined): Properties {
  const out: Properties = {};
  if (!props) return out;
  for (const [key, value] of Object.entries(props)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (typeof value === "string") out[key] = value.slice(0, 80);
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean") out[key] = value;
  }
  return out;
}

function buildConfig(): Partial<PostHogConfig> {
  return {
    api_host: POSTHOG_HOST,
    // Pinned config snapshot (see PostHog docs); keeps behaviour stable across posthog-js upgrades.
    defaults: "2026-05-30",
    // Fires on every client-side route change (react-router uses the History API) and only when the
    // path actually changes, so there is no manual pageview code and no duplicate pageviews.
    capture_pageview: "history_change",
    capture_pageleave: true,
    // Anonymous visitors do not get person profiles; only identified (signed-in) users do.
    person_profiles: "identified_only",
    respect_dnt: true,
    disable_surveys: true,
    capture_exceptions: true,
    capture_dead_clicks: true,
    // Autocapture records clicks (needed for rage/dead-click detection) but never element text.
    mask_all_text: true,
    mask_personal_data_properties: true,
    enable_recording_console_log: true,
    capture_performance: { network_timing: true, web_vitals: false },
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: { password: true },
      // Text is masked only on private areas; elements marked data-ph-unmask stay readable there.
      maskTextSelector: "*",
      maskTextFn: (text, element) => {
        if (!isPrivatePath()) return text;
        if (element?.closest?.("[data-ph-unmask]")) return text;
        return text.replace(/\S/g, "*");
      },
      // Network entries keep method/status/timing only: no headers, no request/response bodies.
      recordHeaders: false,
      recordBody: false,
      maskCapturedNetworkRequestFn: (request) => {
        if (request.name) request.name = sanitizeUrl(request.name);
        return request;
      },
    },
    before_send: (event) => {
      if (!event || isSuppressed()) return null;
      redactUrlProperties(event.properties);
      redactUrlProperties(event.$set);
      redactUrlProperties(event.$set_once);
      return event;
    },
  };
}

function loadClient(): Promise<PostHog | null> {
  return import("posthog-js")
    .then((mod) => {
      const posthog = mod.default;
      // __loaded also survives hot reloads, so init never runs twice.
      if (!posthog.__loaded) posthog.init(POSTHOG_TOKEN, buildConfig());
      return posthog;
    })
    .catch(() => null);
}

/** Applies recording/identity state. Called after init and whenever the signed-in user changes. */
function applyState(posthog: PostHog) {
  if (!active) return;

  if (isSuppressed()) {
    posthog.stopSessionRecording();
    recordingPausedByUs = true;
  } else if (recordingPausedByUs) {
    // Only resumes what this wrapper paused; otherwise recording follows the project's replay settings.
    posthog.startSessionRecording();
    recordingPausedByUs = false;
  }

  if (isSuppressed() || !desiredUserId) {
    if (identifiedUserId) {
      posthog.reset();
      identifiedUserId = null;
    }
    return;
  }
  if (identifiedUserId !== desiredUserId) {
    // Internal id only: no name, email or other personal properties are attached.
    posthog.identify(desiredUserId);
    identifiedUserId = desiredUserId;
  }
}

/** Starts PostHog. Requires configuration and analytics consent; safe to call repeatedly. */
export function startPostHog(): Promise<void> {
  if (!isBrowser() || !isPostHogConfigured || !hasAnalyticsConsent()) return Promise.resolve();
  if (window.location.pathname.toLowerCase().startsWith("/admin")) bootedOnAdmin = true;

  const wasActive = active;
  active = true;
  if (!ready) ready = loadClient();

  return ready.then((posthog) => {
    if (!posthog || !active) return;
    if (!wasActive && posthog.has_opted_out_capturing()) {
      // Consent was withdrawn earlier in this browser and has now been given again.
      posthog.opt_in_capturing({ captureEventName: false });
      posthog.capture("$pageview");
    }
    applyState(posthog);
    installFetchObserver();
  });
}

/** Stops recording and capturing (consent withdrawn). Persisted opt-out keeps it off on reload. */
export function stopPostHog() {
  if (!active) return;
  active = false;
  void ready?.then((posthog) => {
    if (!posthog || active) return;
    posthog.stopSessionRecording();
    recordingPausedByUs = true;
    posthog.opt_out_capturing();
    identifiedUserId = null;
  });
}

/** Tells PostHog who is signed in (internal id only). Admins and impersonation are never tracked. */
export function syncPostHogUser(user: TrackedUser | null) {
  desiredUserId = user ? user.id : null;
  userSuppressed = Boolean(user && (user.role === "admin" || user.impersonated));
  if (!active || !ready) return;
  void ready.then((posthog) => {
    if (posthog) applyState(posthog);
  });
}

/** Captures a custom event with sanitized, non-sensitive properties. No-op without consent. */
export function captureEvent(name: AppEvent, props?: Record<string, unknown>) {
  if (!active || !ready || isSuppressed()) return;
  const properties = safeProperties(props);
  void ready.then((posthog) => {
    if (posthog && active) posthog.capture(name, properties);
  });
}

type FormName = "login" | "login_otp" | "login_otp_request" | "signup" | "password_reset" | "password_reset_otp_request" | "resume_quick_start";

/** A sign-in or account creation the server accepted, with how it happened. */
export function trackAuthSucceeded(method: AuthMethod, isNewUser: boolean) {
  captureEvent("auth_succeeded", { auth_method: method, is_new_user: isNewUser });
}

// Google sign-in is a full-page redirect, so the browser never sees the result of the call. The OAuth
// callback leaves a one-shot cookie (cp_auth_event) on success; it is read and deleted here on the
// next page load, whether or not analytics consent was given.
const AUTH_EVENT_COOKIE = "cp_auth_event";

/** Reports a Google sign-in that completed just before this page load, then removes the hint. */
export function reportPendingAuthEvent(): Promise<void> {
  if (!isBrowser()) return Promise.resolve();
  const hint = readCookie(AUTH_EVENT_COOKIE);
  if (!hint) return Promise.resolve();
  clearCookie(AUTH_EVENT_COOKIE);
  if (hint !== "google_signup" && hint !== "google_login") return Promise.resolve();
  // Without consent startPostHog does nothing and the event below is dropped.
  return startPostHog().then(() => trackAuthSucceeded("google", hint === "google_signup"));
}

/** Google sign-in came back to /login with an error code (fixed server codes, e.g. state_mismatch). */
let lastGoogleFailure = "";

export function trackGoogleSignInFailed(errorCode: string) {
  // A cancelled consent screen is the user's choice, not a failure.
  if (errorCode === "oauth_cancelled") return;
  // The /login effect can re-run (React strict mode, param changes) for the same redirect.
  if (lastGoogleFailure === errorCode) return;
  lastGoogleFailure = errorCode;
  captureEvent("user_action_failed", {
    action: "google_sign_in",
    stage: errorCode.replace(/[^a-z_]/g, "").slice(0, 40),
    failure_type: "rejected",
  });
}

/** A form submission the server accepted. */
export function trackFormSucceeded(form: FormName) {
  captureEvent("form_submission_succeeded", { form_name: form });
}

/**
 * A form submission that failed. Only a coarse type is sent: "network" when the request never
 * reached the server, otherwise "rejected" (the server answered with an error). The error message
 * itself is deliberately not sent.
 */
export function trackFormFailed(form: FormName, error: unknown) {
  captureEvent("form_submission_failed", {
    form_name: form,
    failure_type: error instanceof TypeError ? "network" : "rejected",
  });
}

/** A user-initiated action (e.g. starting a payment) that failed after the app tried it. */
export function trackActionFailed(action: string, stage: string, error: unknown, extra?: Record<string, unknown>) {
  captureEvent("user_action_failed", {
    action,
    stage,
    failure_type: error instanceof TypeError ? "network" : "rejected",
    ...extra,
  });
}

/** The user closed a payment dialog that was opened for a created order, without paying. */
export function trackCheckoutAbandoned(checkout: string, extra?: Record<string, unknown>) {
  captureEvent("checkout_abandoned", { checkout, ...extra });
}

// --- api_request_failed -----------------------------------------------------------------------
// Observes same-origin /api/ calls and reports only transport failures and 5xx responses. Expected
// 4xx answers (validation, auth, quota) are product outcomes and are covered by the form/action events.

const API_FAILURE_WINDOW_MS = 60_000;
const API_FAILURE_SESSION_CAP = 25;
const recentApiFailures = new Map<string, number>();
let apiFailuresReported = 0;

function normalizeApiPath(pathname: string) {
  return pathname
    .split("/")
    .map((seg) => (/^\d+$/.test(seg) || /^[0-9a-f-]{16,}$/i.test(seg) || seg.length > 24 ? ":id" : seg))
    .join("/");
}

function reportApiFailure(input: RequestInfo | URL, init: RequestInit | undefined, status: number, startedAt: number) {
  if (!active || isSuppressed()) return;
  try {
    const request = typeof Request !== "undefined" && input instanceof Request ? input : null;
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : request?.url || "";
    const url = new URL(rawUrl, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return;

    const method = String(init?.method || request?.method || "GET").toUpperCase();
    const path = normalizeApiPath(url.pathname);
    const key = `${method} ${path} ${status}`;
    const now = Date.now();
    const last = recentApiFailures.get(key);
    if (last !== undefined && now - last < API_FAILURE_WINDOW_MS) return;
    if (apiFailuresReported >= API_FAILURE_SESSION_CAP) return;
    recentApiFailures.set(key, now);
    apiFailuresReported += 1;

    captureEvent("api_request_failed", {
      method,
      path,
      status,
      failure_type: status === 0 ? "network" : "server",
      duration_ms: Math.round(performance.now() - startedAt),
      page_path: window.location.pathname,
    });
  } catch {
    // Reporting must never affect the request.
  }
}

function installFetchObserver() {
  if (fetchObserverInstalled || !isBrowser() || typeof window.fetch !== "function") return;
  fetchObserverInstalled = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function observedFetch(input: RequestInfo | URL, init?: RequestInit) {
    const startedAt = performance.now();
    let response: Response;
    try {
      response = await originalFetch(input, init);
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      if (!aborted) reportApiFailure(input, init, 0, startedAt);
      throw error;
    }
    if (response.status >= 500) reportApiFailure(input, init, response.status, startedAt);
    return response;
  };
}
