import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router";
import { Lock } from "lucide-react";

// A paid page shown blurred behind an upgrade card, so people can see what they would get.
// The blur is only visual: pass sample data as children, never the real paid content.
export function LockedPreview({
  title,
  description,
  children,
  cta = "Upgrade to Pro Connect · ₹500/month",
  to = "/dashboard/billing",
}: {
  title: string;
  description: string;
  children: ReactNode;
  cta?: string;
  to?: string;
}) {
  const previewRef = useRef<HTMLDivElement | null>(null);

  // inert: nothing under the blur can be clicked, focused with Tab, or read by screen readers.
  useEffect(() => {
    previewRef.current?.setAttribute("inert", "");
  }, []);

  return (
    <div className="relative">
      <div
        ref={previewRef}
        aria-hidden="true"
        className="pointer-events-none select-none max-h-[760px] overflow-hidden blur-[4px] [mask-image:linear-gradient(to_bottom,black_65%,transparent)]"
      >
        {children}
      </div>
      <div className="absolute inset-0 flex justify-center px-4 pt-10 sm:pt-20">
        <div className="sticky top-24 h-fit w-full max-w-md rounded-2xl border border-emerald-200 bg-white/95 p-5 text-center shadow-xl backdrop-blur-sm">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
            <Lock className="h-3 w-3" /> Pro Connect
          </div>
          <h2 className="mt-2 text-base font-bold text-gray-900">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">{description}</p>
          <Link
            to={to}
            className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            {cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
