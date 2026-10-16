import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Clock } from "lucide-react";

type Announcement = { text: string; code: string; ctaLabel: string; ctaHref: string; endsAt: string | null };

// The lime offer bar above the site nav. Rotates every ROTATE_MS between the standing Pro offer
// and the promotion set in Admin > Growth (e.g. GOINDIA) while one is active. Hover pauses it.
const ROTATE_MS = 5000;

export function SiteAnnouncementBar() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/announcement")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled) setAnnouncement((body?.data?.announcement as Announcement | null) || null);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!announcement || paused) return;
    const timer = window.setInterval(() => setSlide((s) => (s + 1) % 2), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [announcement, paused]);

  const cta = "hidden sm:inline-flex shrink-0 items-center gap-1 font-extrabold hover:underline";

  const proOffer = (
    <>
      <strong className="shrink-0 inline-flex items-center gap-1.5 font-extrabold">
        <Clock className="w-3 h-3" /> Limited offer
      </strong>
      <p className="m-0 min-w-0 truncate text-[#496312]">
        Pro is 80% off: unlimited auto-apply for ₹99/month, plus a free{" "}
        <strong className="font-extrabold italic text-[#17142e]">WhatsApp &amp; email auto-sender to HR numbers and emails</strong>
      </p>
      <Link to="/pricing" className={cta}>
        View Pro plan <ArrowRight className="w-3 h-3" />
      </Link>
    </>
  );

  let promo: React.ReactNode = null;
  if (announcement) {
    // Survives the login redirect: Billing applies the code when it opens.
    const rememberCode = () => {
      try {
        if (announcement.code) sessionStorage.setItem("cp_pending_coupon", announcement.code);
      } catch {
        // storage blocked
      }
    };
    // The label already says "Special offer", so drop a repeated prefix from the admin text.
    const text = announcement.text.replace(/^\s*special offer\s*[:\-–]\s*/i, "");
    const code = announcement.code?.trim();
    const hasCodeInText = Boolean(code && text.toLowerCase().includes(code.toLowerCase()));
    const displayText = !hasCodeInText && code ? `${text.replace(/\.+$/, "")} with code ${code}.` : text;
    const label = (
      <>
        {announcement.ctaLabel} <ArrowRight className="w-3 h-3" />
      </>
    );
    promo = (
      <>
        <strong className="shrink-0 inline-flex items-center gap-1.5 font-extrabold">
          <Clock className="w-3 h-3" /> Special offer
        </strong>
        <p className="m-0 min-w-0 truncate text-[#496312]">{displayText}</p>
        {announcement.ctaLabel && announcement.ctaHref ? (
          announcement.ctaHref.startsWith("https://") ? (
            <a href={announcement.ctaHref} onClick={rememberCode} className={cta} target="_blank" rel="noreferrer">
              {label}
            </a>
          ) : (
            <Link to={announcement.ctaHref} onClick={rememberCode} className={cta}>
              {label}
            </Link>
          )
        ) : null}
      </>
    );
  }

  const slides = promo ? [promo, proOffer] : [proOffer];
  const current = slide % slides.length;

  return (
    <div
      className="relative w-full h-8 overflow-hidden bg-[#c8ff62] text-[#3b2600] text-xs"
      role="region"
      aria-label="Offers"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {slides.map((content, i) => (
        <div
          key={i}
          aria-hidden={i !== current}
          className={`absolute inset-0 px-3 sm:px-6 flex items-center justify-center gap-2.5 transition-all duration-500 motion-reduce:transition-none ${
            i === current ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-2"
          }`}
        >
          {content}
        </div>
      ))}
    </div>
  );
}
