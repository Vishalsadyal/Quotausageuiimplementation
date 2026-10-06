import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Mail, Lock, CreditCard } from 'lucide-react';

// Ring of 12 stars around the GDPR padlock seal.
const gdprStars = Array.from({ length: 12 }, (_, i) => {
  const angle = (i * 30 * Math.PI) / 180;
  return { x: 26 + 18 * Math.sin(angle), y: 26 - 18 * Math.cos(angle) };
});

const starPoints = (cx: number, cy: number, r = 2.6) =>
  Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.42;
    const angle = (i * 36 - 90) * (Math.PI / 180);
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');

const trustBadges: { title: string; subtitle: string; href?: string; logo: ReactNode }[] = [
  {
    title: 'GDPR',
    subtitle: 'Compliant',
    logo: (
      <svg viewBox="0 0 52 52" className="w-full h-full" role="img" aria-label="GDPR compliant">
        <circle cx="26" cy="26" r="26" fill="#003399" />
        {gdprStars.map((star, i) => (
          <polygon key={i} points={starPoints(star.x, star.y)} fill="#ffcc00" />
        ))}
        <rect x="19.5" y="24" width="13" height="10" rx="2" fill="#ffffff" />
        <path d="M22 24v-3a4 4 0 0 1 8 0v3" fill="none" stroke="#ffffff" strokeWidth="2.2" />
      </svg>
    ),
  },
  {
    title: 'SSL',
    subtitle: 'Secured',
    logo: (
      <span className="w-full h-full flex items-center justify-center bg-[#16a36a]">
        <Lock className="w-6 h-6 text-white" strokeWidth={2.4} />
      </span>
    ),
  },
  {
    title: 'Razorpay',
    subtitle: 'Secure payments',
    logo: (
      <span className="w-full h-full flex items-center justify-center bg-[#3395ff]">
        <CreditCard className="w-6 h-6 text-white" strokeWidth={2.4} />
      </span>
    ),
  },
  {
    title: 'Chrome Web Store',
    subtitle: 'Available now',
    href: 'https://chromewebstore.google.com/detail/mcfmniiniaigfhhjlaegpmhecbdoikjd',
    logo: (
      <svg viewBox="0 0 48 48" className="w-full h-full" role="img" aria-label="Chrome Web Store">
        <circle cx="24" cy="24" r="24" fill="#ffffff" />
        <path d="M24 24 L4.95 13 A22 22 0 0 1 43.05 13 Z" fill="#ea4335" />
        <path d="M24 24 L43.05 13 A22 22 0 0 1 24 46 Z" fill="#fbbc04" />
        <path d="M24 24 L24 46 A22 22 0 0 1 4.95 13 Z" fill="#34a853" />
        <circle cx="24" cy="24" r="10" fill="#ffffff" />
        <circle cx="24" cy="24" r="8" fill="#1a73e8" />
      </svg>
    ),
  },
  {
    title: 'LinkedIn',
    subtitle: 'Partner',
    logo: (
      <svg viewBox="0 0 24 24" className="w-full h-full" role="img" aria-label="LinkedIn Partner">
        <circle cx="12" cy="12" r="12" fill="#0a66c2" />
        <path
          transform="translate(-1.5 0.4)"
          fill="#ffffff"
          d="M7.1 9.6h2.5v8.1H7.1V9.6Zm1.25-4a1.45 1.45 0 1 1 0 2.9 1.45 1.45 0 0 1 0-2.9Zm2.8 4h2.4v1.1h.03c.34-.63 1.15-1.3 2.37-1.3 2.53 0 3 1.67 3 3.83v4.47h-2.5v-3.96c0-.95-.02-2.16-1.32-2.16-1.32 0-1.52 1.03-1.52 2.1v4.02h-2.5V9.6Z"
        />
      </svg>
    ),
  },
];

export function Footer() {
  const openCookieConsent = () => {
    try {
      window.localStorage.removeItem("cp_cookie_consent");
    } catch {
      // Ignore.
    }
    try {
      document.cookie = "cp_cookie_consent=; Max-Age=0; Path=/; SameSite=Lax";
    } catch {
      // Ignore.
    }
    try {
      window.dispatchEvent(new Event("cp:cookie-consent:edit"));
    } catch {
      // Ignore.
    }
  };

  return (
    <footer className="bg-[#17142e] text-[#eae7ff]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-[58px] pb-[25px]">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity">
              <img
                src="/logos/brandmark-80.png"
                alt="AutoApply CV logo"
                className="w-10 h-10 object-contain"
                width={40}
                height={40}
                loading="lazy"
                decoding="async"
              />
              <span className="flex flex-col leading-none">
                <span className="text-lg font-extrabold tracking-[-0.5px] text-white leading-tight">
                  AutoApply <span className="text-[#8d7aff]">CV</span>
                </span>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#a49fc0]">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-3.5 h-3.5 shrink-0"
                    role="img"
                    aria-label="LinkedIn"
                  >
                    <rect width="24" height="24" rx="4" fill="#0a66c2" />
                    <path
                      fill="#ffffff"
                      d="M7.1 9.6h2.5v8.1H7.1V9.6Zm1.25-4a1.45 1.45 0 1 1 0 2.9 1.45 1.45 0 0 1 0-2.9Zm2.8 4h2.4v1.1h.03c.34-.63 1.15-1.3 2.37-1.3 2.53 0 3 1.67 3 3.83v4.47h-2.5v-3.96c0-.95-.02-2.16-1.32-2.16-1.32 0-1.52 1.03-1.52 2.1v4.02h-2.5V9.6Z"
                    />
                  </svg>
                  LinkedIn Partner
                </span>
              </span>
            </Link>
            <p className="text-sm text-[#a49fc0] mb-6 leading-relaxed">
              AI-powered career platform helping engineers land better jobs, faster. Join 50,000+ successful job seekers.
            </p>
            <div className="flex gap-3">
              <a
                href="mailto:help@autoapplycv.in"
                aria-label="Email AutoApply CV support"
                title="help@autoapplycv.in"
                className="h-10 px-3.5 gap-2 rounded-[10px] bg-white/5 border border-[#2c2650] text-sm font-semibold text-[#a49fc0] hover:text-white hover:bg-[#6047f5] hover:border-[#6047f5] inline-flex items-center justify-center transition-all duration-200 hover:-translate-y-px"
              >
                <Mail className="w-4 h-4" />
                help@autoapplycv.in
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h2 className="text-sm font-semibold text-white mb-4">Product & Automations</h2>
            <ul className="space-y-3 text-[13px]">
              <li>
                <Link to="/auto-apply-linkedin" className="text-[#a49fc0] hover:text-white transition-colors font-medium">
                  LinkedIn Auto Apply Bot
                </Link>
              </li>
              <li>
                <Link to="/auto-apply-jobs" className="text-[#a49fc0] hover:text-white transition-colors font-medium">
                  Auto Apply to Jobs
                </Link>
              </li>
              <li>
                <Link to="/auto-apply-chrome-extension" className="text-[#a49fc0] hover:text-white transition-colors font-medium">
                  Chrome Extension Copilot
                </Link>
              </li>
              <li>
                <Link to="/product" className="text-[#a49fc0] hover:text-white transition-colors">
                  Product Overview
                </Link>
              </li>
              <li>
                <Link to="/features" className="text-[#a49fc0] hover:text-white transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-[#a49fc0] hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="text-[#a49fc0] hover:text-white transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link to="/roadmap" className="text-[#a49fc0] hover:text-white transition-colors">
                  Roadmap
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-white mb-4">Company</h2>
            <ul className="space-y-3 text-[13px]">
              <li>
                <Link to="/about" className="text-[#a49fc0] hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/careers" className="text-[#a49fc0] hover:text-white transition-colors">
                  Careers
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-[#a49fc0] hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/press-kit" className="text-[#a49fc0] hover:text-white transition-colors">
                  Press Kit
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-white mb-4">Resources</h2>
            <ul className="space-y-3 text-[13px]">
              <li>
                <Link to="/blog" className="text-[#a49fc0] hover:text-white transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link to="/extension-design" className="text-[#a49fc0] hover:text-white transition-colors">
                  Extension Design
                </Link>
              </li>
              <li>
                <Link to="/faq" className="text-[#a49fc0] hover:text-white transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/help-center" className="text-[#a49fc0] hover:text-white transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/community" className="text-[#a49fc0] hover:text-white transition-colors">
                  Community
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-11 pt-10 pb-4 border-t border-[#2c2650] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-6 gap-y-10 justify-items-center">
          {trustBadges.map((badge) => {
            const content = (
              <>
                <span className="w-[52px] h-[52px] rounded-full ring-2 ring-white/10 shadow-[0_6px_16px_rgba(0,0,0,.35)] overflow-hidden">
                  {badge.logo}
                </span>
                <span className="text-center leading-tight mt-1">
                  <span className="block text-[11px] font-bold text-[#eae7ff]">{badge.title}</span>
                  <span className="block mt-1 text-[10px] text-[#8f89a8]">{badge.subtitle}</span>
                </span>
              </>
            );
            return badge.href ? (
              <a
                key={badge.title}
                href={badge.href}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center gap-3 w-[120px] hover:-translate-y-px transition-transform"
              >
                {content}
              </a>
            ) : (
              <div key={badge.title} className="flex flex-col items-center gap-3 w-[120px]">
                {content}
              </div>
            );
          })}
        </div>

        {/* Bottom Bar */}
        <div className="mt-[22px] pt-[22px] border-t border-[#2c2650] flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[#8f89a8] text-xs">
            © 2026 AutoApply CV. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link to="/privacy-policy" className="text-xs text-[#8f89a8] hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms-of-service" className="text-xs text-[#8f89a8] hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link to="/cookie-policy" className="text-xs text-[#8f89a8] hover:text-white transition-colors">
              Cookie Policy
            </Link>
            <button
              type="button"
              onClick={openCookieConsent}
              className="text-xs text-[#8f89a8] hover:text-white transition-colors"
            >
              Cookie settings
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}


