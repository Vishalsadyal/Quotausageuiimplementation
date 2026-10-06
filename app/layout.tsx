import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";
import CookieConsentBanner from "./CookieConsentBanner";
import AnalyticsScripts from "./AnalyticsScripts";
import GoogleConsentMode from "./GoogleConsentMode";
import ChatWidget from "./ChatWidget";
import { OG_IMAGE } from "../src/app/seo/seoConfig";

// Self-hosted at build time: no request to Google Fonts, which the CSP blocks.
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

const GOOGLE_TAG_ID = String(process.env.NEXT_PUBLIC_GOOGLE_TAG_ID || "").trim();
const GTM_ID = String(process.env.NEXT_PUBLIC_GTM_ID || "").trim();
const CLARITY_TAG_ID = String(process.env.NEXT_PUBLIC_CLARITY_TAG_ID || "").trim();
const ADSENSE_CLIENT = String(process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-5625706421007973").trim();

// Google Consent Mode defaults, computed in the browser from the
// cp_cookie_consent cookie before GTM loads. Reading the cookie here instead of
// with cookies() on the server lets every page be statically cached.
const CONSENT_DEFAULT_SCRIPT = `
(function () {
  var KEYS = ["ad_storage", "ad_user_data", "ad_personalization", "analytics_storage", "functionality_storage", "personalization_storage", "security_storage"];
  var base = {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    functionality_storage: "granted",
    personalization_storage: "denied",
    security_storage: "granted"
  };

  function readCookie() {
    var match = document.cookie.match(/(?:^|;\s*)cp_cookie_consent=([^;]*)/);
    if (!match) return "";
    try { return decodeURIComponent(match[1]); } catch (e) { return match[1]; }
  }

  function defaults(raw) {
    var trimmed = String(raw || "").trim();
    if (!trimmed) return base;
    var lower = trimmed.toLowerCase();
    if (["granted", "accept", "accepted", "yes", "true"].indexOf(lower) !== -1) {
      var all = {};
      KEYS.forEach(function (k) { all[k] = "granted"; });
      return all;
    }
    if (["denied", "reject", "rejected", "no", "false"].indexOf(lower) !== -1) return base;
    try {
      var parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== "object") return base;
      // Back-compat with old { analytics, advertising }.
      if (typeof parsed.analytics === "boolean" || typeof parsed.advertising === "boolean") {
        var analytics = Boolean(parsed.analytics);
        var advertising = Boolean(parsed.advertising);
        return {
          ad_storage: advertising ? "granted" : "denied",
          ad_user_data: advertising ? "granted" : "denied",
          ad_personalization: advertising ? "granted" : "denied",
          analytics_storage: analytics ? "granted" : "denied",
          functionality_storage: "granted",
          personalization_storage: advertising ? "granted" : "denied",
          security_storage: "granted"
        };
      }
      var out = {};
      for (var i = 0; i < KEYS.length; i++) {
        var v = parsed[KEYS[i]];
        if (v === true) out[KEYS[i]] = "granted";
        else if (v === false) out[KEYS[i]] = "denied";
        else return base;
      }
      return out;
    } catch (e) {
      return base;
    }
  }

  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag("consent", "default", defaults(readCookie()), { wait_for_update: 500 });
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL("https://www.autoapplycv.in"),
  title: "Free Auto Apply CV | AI-Powered Job Application Automation",
  description: "Free auto apply CV tool for LinkedIn and Indeed. Save hours with AI resume matching, smart application tracking and automated job search.",
  manifest: "/site.webmanifest",
  keywords: ["free auto apply cv", "free job application automation", "auto apply jobs free", "automated job applications", "LinkedIn auto apply", "Indeed auto apply", "free AI job search", "resume automation free"],
  openGraph: {
    title: "Free Auto Apply CV | Automate Your Job Search",
    description: "Apply to hundreds of jobs automatically for free! AI-powered job application automation for LinkedIn and Indeed. Smart resume matching and application tracking included.",
    type: "website",
    url: "https://www.autoapplycv.in",
    siteName: "AutoApply CV",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Auto Apply CV | AI Job Application Automation",
    description: "Free tool to auto-apply to jobs on LinkedIn & Indeed. Save time with AI-powered automation. Start now!",
    images: [OG_IMAGE.url],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
      { url: "/favicon-48x48.png", type: "image/png", sizes: "48x48" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <Script id="gtag-consent-default" strategy="beforeInteractive">
          {CONSENT_DEFAULT_SCRIPT}
        </Script>
        {ADSENSE_CLIENT ? (
          <Script
            id="adsense"
            async
            strategy="afterInteractive"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`}
            crossOrigin="anonymous"
          />
        ) : null}
        {GTM_ID ? (
          <Script id="gtm-init" strategy="beforeInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${GTM_ID}');
            `}
          </Script>
        ) : null}
      </head>
      <body>
        <GoogleConsentMode />
        {GTM_ID ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        ) : null}
        <AnalyticsScripts googleTagId={GOOGLE_TAG_ID} clarityProjectId={CLARITY_TAG_ID} />
        {children}
        <CookieConsentBanner clarityProjectId={CLARITY_TAG_ID} googleTagId={GOOGLE_TAG_ID} gtmId={GTM_ID} />
        <ChatWidget />
      </body>
    </html>
  );
}
