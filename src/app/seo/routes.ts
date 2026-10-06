// Server-side mirror of the client routes in src/app/App.tsx. Keep both lists in
// sync: any path not matched here is answered with a real 404 instead of being
// served (and indexed) as a copy of the home page.

const STATIC_APP_PATHS = new Set<string>([
  "/",
  "/product",
  "/features",
  "/how-it-works",
  "/pricing",
  "/auto-apply",
  "/auto-apply-linkedin",
  "/auto-apply-jobs",
  "/auto-apply-chrome-extension",
  "/about",
  "/faq",
  "/roadmap",
  "/careers",
  "/contact",
  "/press-kit",
  "/help-center",
  "/community",
  "/privacy-policy",
  "/terms-of-service",
  "/cookie-policy",
  "/extension-design",
  "/blog",
  "/thank-you",
  "/recruitment-agency",
  "/recruitment",
  "/login",
  "/forgot-password",
  "/admin/login",
  "/signup",
]);

// Private app areas: their sub-routes are resolved client-side and are noindex.
const PRIVATE_PREFIXES = ["/dashboard", "/admin"];

// Public pages pre-rendered at build time (and then served from cache).
export function prerenderedAppPaths(): string[] {
  return [...STATIC_APP_PATHS].filter((path) => path !== "/" && path !== "/recruitment");
}

export function isKnownAppPath(pathname: string): boolean {
  if (STATIC_APP_PATHS.has(pathname)) return true;
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function blogSlugFromPath(pathname: string): string | null {
  const match = /^\/blog\/([^/]+)$/.exec(pathname);
  return match ? decodeURIComponent(match[1]).trim().toLowerCase() : null;
}
