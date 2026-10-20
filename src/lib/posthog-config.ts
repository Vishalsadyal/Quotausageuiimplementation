// PostHog public configuration. Shared by the browser client (posthog-client.ts) and the
// middleware (to build the CSP), so it must stay free of browser-only and server-only imports.

const DEFAULT_HOST = "https://us.i.posthog.com";

function readToken(raw: string | undefined): string {
  const value = String(raw || "").trim();
  // Project tokens start with phc_. Refuse anything else (notably phx_ personal API keys, which are
  // private) so a wrong value pasted into a NEXT_PUBLIC_ variable is never shipped to browsers.
  return /^phc_[A-Za-z0-9]+$/.test(value) ? value : "";
}

function readHost(raw: string | undefined): string {
  const value = String(raw || "").trim() || DEFAULT_HOST;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

export const POSTHOG_TOKEN = readToken(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN);
export const POSTHOG_HOST = readHost(process.env.NEXT_PUBLIC_POSTHOG_HOST);

/** False when the token is missing/invalid, so the site runs exactly as before. */
export const isPostHogConfigured = Boolean(POSTHOG_TOKEN && POSTHOG_HOST);

/**
 * Origins the CSP must allow for PostHog: the ingestion host, plus the matching assets host that
 * serves the lazily loaded session-replay recorder on PostHog Cloud (us.i -> us-assets.i).
 */
export function posthogCspOrigins(): string[] {
  if (!isPostHogConfigured) return [];
  const origins = [POSTHOG_HOST];
  const cloud = POSTHOG_HOST.match(/^https:\/\/(us|eu)\.i\.posthog\.com$/);
  if (cloud) origins.push(`https://${cloud[1]}-assets.i.posthog.com`);
  return origins;
}
