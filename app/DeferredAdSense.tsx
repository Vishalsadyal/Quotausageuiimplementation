"use client";

import { useEffect } from "react";

// AdSense is ~220 KB of script and ~1 s of main-thread work on a mid-range phone. Loading it right
// after hydration made it the biggest drag on mobile page speed, so it now loads on the visitor's
// first interaction (scroll, tap, key, mouse move) or after FALLBACK_MS, whichever comes first.
const FALLBACK_MS = 6000;
const EVENTS = ["scroll", "pointerdown", "keydown", "mousemove", "touchstart"] as const;

export default function DeferredAdSense({ client }: { client: string }) {
  useEffect(() => {
    if (!client || document.getElementById("adsense-script")) return;
    let done = false;
    const load = () => {
      if (done) return;
      done = true;
      cleanup();
      const script = document.createElement("script");
      script.id = "adsense-script";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
      document.head.appendChild(script);
    };
    const timer = window.setTimeout(load, FALLBACK_MS);
    const cleanup = () => {
      window.clearTimeout(timer);
      for (const e of EVENTS) window.removeEventListener(e, load);
    };
    for (const e of EVENTS) window.addEventListener(e, load, { once: true, passive: true });
    return cleanup;
  }, [client]);

  return null;
}
