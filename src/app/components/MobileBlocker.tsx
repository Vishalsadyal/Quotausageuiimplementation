import { Monitor, ArrowRight } from "lucide-react";

export default function MobileBlocker() {
  return (
    <div className="flex items-center justify-center min-h-screen p-6 relative z-10">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(15,23,42,0.12)] border border-gray-100 overflow-hidden">
          {/* Gradient top accent */}
          <div className="h-2 bg-[#6047f5]" />

          <div className="px-8 py-10 text-center">
            {/* Icon */}
            <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-[#6047f5] flex items-center justify-center shadow-lg">
              <Monitor className="w-8 h-8 text-white" />
            </div>

            {/* Heading */}
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Desktop Extension Required
            </h1>

            {/* Warning text */}
            <p className="text-gray-600 leading-relaxed mb-8">
              It looks like you are on a mobile device. Mobile browsers do not
              support our browser extension. Please switch to a desktop computer
              to use the extension features.
            </p>

            {/* Divider */}
            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                or
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* CTA */}
            <p className="text-sm text-gray-500 mb-4">
              Contact our recruitment agency directly! We will help you get hired
              with a{" "}
              <span className="font-semibold text-gray-700">
                100% success rate
              </span>
              .
            </p>

            <a
              href="https://recruitment.autoapplycv.in/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#6047f5] text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:-translate-y-px transition-all duration-200"
            >
              Contact Recruitment Agency
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Branding below card */}
        <p className="text-center text-xs text-gray-400 mt-6">
          AutoApply CV &mdash; Desktop browser extension for job automation
        </p>
      </div>
    </div>
  );
}
