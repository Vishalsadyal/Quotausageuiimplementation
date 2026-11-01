import { Link } from "react-router";
import { ArrowRight } from "lucide-react";

const FEATURE_LINKS = [
  { to: "/auto-apply-linkedin", title: "LinkedIn Auto Apply", description: "Auto apply to LinkedIn Easy Apply jobs." },
  { to: "/naukri-auto-apply", title: "Naukri Auto Apply", description: "Apply to Naukri jobs and answer the recruiter chatbot." },
  { to: "/indeed-auto-apply", title: "Indeed Auto Apply", description: "Auto apply to Indeed \"Easily apply\" jobs." },
  { to: "/hr-whatsapp-contacts", title: "HR WhatsApp Contacts", description: "20 matched recruiter contacts every day." },
  { to: "/interview-call-ai", title: "Interview Call AI", description: "Short answers from your notes during live calls." },
  { to: "/auto-apply-chrome-extension", title: "Chrome Extension", description: "One extension for LinkedIn, Naukri and Indeed." },
  { to: "/pricing", title: "Pricing", description: "Free, Pro ₹99/month and Pro Connect ₹500/month." },
];

/** Internal links between the feature landing pages, shown under each page. */
export default function FeatureLinks({ current }: { current: string }) {
  const links = FEATURE_LINKS.filter((link) => link.to !== current);
  return (
    <section className="bg-white pb-20">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900">More from AutoApply CV</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="group rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5 hover:border-purple-300 hover:shadow-premium transition-all"
            >
              <div className="flex items-center justify-between font-semibold text-gray-900">
                {link.title}
                <ArrowRight className="w-4 h-4 text-purple-600 transition-transform group-hover:translate-x-1" />
              </div>
              <p className="mt-2 text-sm text-gray-600">{link.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
