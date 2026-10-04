import { NextRequest, NextResponse } from "next/server";

function createRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function middleware(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || createRequestId();
  const path = req.nextUrl.pathname;
  const isProd = process.env.NODE_ENV === "production";
  const hasGoogleAnalytics = Boolean(String(process.env.NEXT_PUBLIC_GOOGLE_TAG_ID || "").trim());
  const hasGoogleTagManager = Boolean(String(process.env.NEXT_PUBLIC_GTM_ID || "").trim());
  // In development, allow GTM/GA endpoints so debugging tools (e.g. Tag Assistant)
  // don't spam the console when GA isn't configured.
  const allowGoogleAnalyticsEndpoints = hasGoogleAnalytics || hasGoogleTagManager || !isProd;

  if (isProd && path.startsWith("/downloads/")) {
    return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
  }

  if (path.startsWith("/api/")) {
    const method = req.method.toUpperCase();
    const isWriteMethod = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
    if (isWriteMethod) {
      const origin = req.headers.get("origin");
      const host = req.headers.get("host");
      let sameOrigin = false;
      if (origin && host) {
        try {
          sameOrigin = new URL(origin).host === host;
        } catch {
          sameOrigin = false;
        }
      }
      const allowNoOrigin =
        path === "/api/billing/webhook/razorpay" ||
        path === "/api/integrations/telegram/webhook" ||
        path === "/api/internal/worker/run";
      // The Chrome extension's service worker calls these with its own
      // chrome-extension:// origin; they still require the user's auth.
      const allowExtensionOrigin =
        path === "/api/ai/call-copilot" && Boolean(origin?.startsWith("chrome-extension://"));
      if (!sameOrigin && !allowExtensionOrigin && !(allowNoOrigin && !origin)) {
        return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
      }
    }
  }

  const hasAdSense = Boolean(String(process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "").trim());
  const allowAdSense = hasAdSense || !isProd;

  const res = NextResponse.next();
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `img-src 'self' data: blob: https: https://www.googletagmanager.com${allowGoogleAnalyticsEndpoints ? " https://www.google-analytics.com" : ""}${allowAdSense ? " https://pagead2.googlesyndication.com https://*.google.com https://*.doubleclick.net" : ""}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline'",
    `style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.clarity.ms https://c.clarity.ms https://scripts.clarity.ms https://www.googletagmanager.com${allowGoogleAnalyticsEndpoints ? " https://www.google-analytics.com" : ""}`,
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://www.clarity.ms https://c.clarity.ms https://scripts.clarity.ms https://www.googletagmanager.com${allowGoogleAnalyticsEndpoints ? " https://www.google-analytics.com" : ""}${allowAdSense ? " https://pagead2.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.googleadservices.com" : ""}`,
    `connect-src 'self' https://api.razorpay.com https://*.razorpay.com https://db.prisma.io https://*.upstash.io https://www.clarity.ms https://c.clarity.ms https://l.clarity.ms https://scripts.clarity.ms https://www.googletagmanager.com${allowGoogleAnalyticsEndpoints ? " https://www.google-analytics.com" : ""}${allowAdSense ? " https://pagead2.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.googleadservices.com" : ""}`,
    `frame-src https://api.razorpay.com https://checkout.razorpay.com https://www.googletagmanager.com${allowGoogleAnalyticsEndpoints ? " https://www.google-analytics.com" : ""}${allowAdSense ? " https://googleads.g.doubleclick.net https://*.google.com" : ""}`,
    "form-action 'self' https://api.razorpay.com https://checkout.razorpay.com",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  res.headers.set("x-request-id", requestId);
  res.headers.set("x-content-type-options", "nosniff");
  res.headers.set("x-frame-options", "DENY");
  res.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  res.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("x-dns-prefetch-control", "off");
  res.headers.set("cross-origin-opener-policy", "same-origin");
  res.headers.set("cross-origin-resource-policy", "same-origin");
  res.headers.set("origin-agent-cluster", "?1");
  if (isProd) {
    res.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains; preload");
  }
  res.headers.set("content-security-policy", csp);

  if (path.startsWith("/api/")) {
    res.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    res.headers.set("cache-control", "no-store");
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|\\.well-known/).*)"],
};
