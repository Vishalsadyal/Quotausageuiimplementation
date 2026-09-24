import { useState } from "react";
import { Link } from "react-router";
import {
  Sparkles,
  CheckCircle2,
  FileText,
  Download,
  Share2,
  MessageCircle,
  Mail,
  ExternalLink,
  Target,
  Briefcase,
  Users,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Star,
  Globe,
  Award,
  Clock,
  Send,
  Zap,
  HelpCircle,
  X,
  ChevronLeft,
} from "lucide-react";
import { motion } from "motion/react";

export default function RecruitmentAgency() {
  const [activeTestimonialTab, setActiveTestimonialTab] = useState<"all" | "tech" | "engineering" | "mid_senior">("all");
  const [brochureModalOpen, setBrochureModalOpen] = useState(false);
  const [selectedBrochurePage, setSelectedBrochurePage] = useState<number>(1);

  const testimonials = [
    {
      id: 1,
      name: "Rohit Verma",
      role: "Senior Full Stack Engineer",
      experience: "6 Years Experience",
      category: "tech",
      rating: 5,
      avatar: "RV",
      avatarBg: "bg-blue-600",
      quote:
        "The Premium Job Outreach plan opened up conversations with hiring leads that I couldn't reach on my own. Within two weeks, I had direct email introductions to 4 tech recruiters.",
      package: "₹24 LPA Offer",
      companyType: "Product Scale-up",
    },
    {
      id: 2,
      name: "Ananya Sharma",
      role: "Control Systems & SCADA Lead",
      experience: "9 Years Experience",
      category: "engineering",
      rating: 5,
      avatar: "AS",
      avatarBg: "bg-purple-600",
      quote:
        "AutoApplyCV's structured recruiter outreach saved me countless hours of manual search. The team helped match my industrial automation background directly to relevant hiring managers.",
      package: "Industrial Automation",
      companyType: "MNC Engineering",
    },
    {
      id: 3,
      name: "Priya Nair",
      role: "Product & Operations Manager",
      experience: "4 Years Experience",
      category: "mid_senior",
      rating: 5,
      avatar: "PN",
      avatarBg: "bg-emerald-600",
      quote:
        "Transparent, professional, and ethical. They clearly explain that they assist with outreach without making false job guarantees, which gave me immense trust in their service.",
      package: "FinTech Sector",
      companyType: "Growth Enterprise",
    },
    {
      id: 4,
      name: "Siddharth Mehta",
      role: "DevOps & Cloud Architect",
      experience: "11 Years Experience",
      category: "tech",
      rating: 5,
      avatar: "SM",
      avatarBg: "bg-indigo-600",
      quote:
        "The recruiter contact database and WhatsApp outreach guidance were spot on. I received genuine recruiter callbacks within days of starting the outreach cycle.",
      package: "Enterprise Cloud",
      companyType: "US Tech Firm",
    },
    {
      id: 5,
      name: "Karan Patel",
      role: "Embedded Systems Developer",
      experience: "3 Years Experience",
      category: "engineering",
      rating: 5,
      avatar: "KP",
      avatarBg: "bg-amber-600",
      quote:
        "Started with the ₹500 Job Search Access plan and later upgraded. The quality of verified recruiter contact info gave my applications a noticeable edge.",
      package: "Robotics & IoT",
      companyType: "Hardware Tech",
    },
    {
      id: 6,
      name: "Meera Krishnan",
      role: "Lead Business Analyst",
      experience: "7 Years Experience",
      category: "mid_senior",
      rating: 5,
      avatar: "MK",
      avatarBg: "bg-rose-600",
      quote:
        "Their resume circulation across LinkedIn recruiter networks helped get my profile viewed by active corporate recruiters in Gurgaon and Bangalore.",
      package: "Consulting Lead",
      companyType: "Global Advisory",
    },
  ];

  const filteredTestimonials = testimonials.filter((t) => {
    if (activeTestimonialTab === "all") return true;
    return t.category === activeTestimonialTab;
  });

  const faqs = [
    {
      q: "What is AutoApplyCV Recruitment Agency & Job Search Assistance?",
      a: "AutoApplyCV is a professional recruitment and job-search assistance agency. We help candidates discover high-intent job openings, access verified recruiter details, and connect directly with hiring managers via structured email and WhatsApp outreach.",
    },
    {
      q: "How does the ₹500 Job Search Access plan work?",
      a: "The ₹500 Job Search Access plan gives you immediate access to active job openings curated for your role, along with direct recruiter and HR contact details (including verified email and WhatsApp contact information where available), plus outreach guidance templates.",
    },
    {
      q: "What is included in the ₹2,000 Premium Job Outreach plan?",
      a: "The Premium Job Outreach plan includes end-to-end recruiter engagement: tailored opening matching, direct recruiter outreach over WhatsApp and professional email, resume circulation in active recruiter communities, application tracking, and follow-up support.",
    },
    {
      q: "Do you guarantee job placements or interview calls?",
      a: "No. In compliance with fair recruitment standards, interview calls and job offers depend entirely on employer requirements and recruiter responses. Our services assist with discovery and outreach to maximize your visibility, but we do not guarantee employment.",
    },
    {
      q: "Who is eligible for your assistance services?",
      a: "Our services are designed for candidates with 0 to 15 years of experience across all major sectors including Software & Tech, Industrial Engineering, SCADA & Automation, Business Analysis, Operations, Marketing, and Finance.",
    },
    {
      q: "How can I download the official agency brochure and application form?",
      a: "You can download the full 6-page official corporate booklet (including real placement stories, 6-phase candidate framework, candidate enrollment application, and authorized verification signed by Vishal) directly from this page by clicking 'Download 6-Page PDF' or access it anytime at /AutoApplyCV_Recruitment_Brochure.pdf.",
    },
  ];

  const shareBrochureOnWhatsApp = () => {
    const text = encodeURIComponent(
      "Check out AutoApplyCV Recruitment & Job Search Assistance Agency Brochure: https://autoapplycv.in/AutoApplyCV_Recruitment_Brochure.pdf"
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* 1. TOP HERO SECTION - Solid Light Background */}
      <section className="bg-white text-slate-900 pt-16 pb-20 px-6 lg:px-8 border-b border-slate-200">
        <div className="max-w-6xl mx-auto text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Official Recruitment &amp; Candidate Assistance Agency</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight max-w-4xl mx-auto text-slate-900">
            Your Next Career Opportunity{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-teal-600 bg-clip-text text-transparent">
              Starts Here
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-xl text-slate-600 font-medium max-w-3xl mx-auto leading-relaxed">
            Connect with Relevant Recruiters. Explore Better Opportunities. Fast-track your hiring pipeline with dedicated recruiter matching and multi-channel outreach.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-4">
            <a
              href="#plans"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition-all hover:scale-[1.02] inline-flex items-center gap-2"
            >
              <span>Explore Service Plans</span>
              <ChevronRight className="w-4 h-4" />
            </a>

            <a
              href="/AutoApplyCV_Recruitment_Brochure.pdf"
              target="_blank"
              rel="noreferrer"
              className="px-5 py-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-sm font-semibold shadow-xs transition-all inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              <span>Download Brochure (PDF)</span>
            </a>

            <a
              href="https://recruitment.autoapplycv.in/index.html"
              target="_blank"
              rel="noreferrer"
              className="px-5 py-3 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-semibold shadow-xs transition-all inline-flex items-center gap-2"
            >
              <Globe className="w-4 h-4 text-teal-600" />
              <span>Candidate Portal</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>

          {/* Key Metrics Ribbon - Solid Light Cards */}
          <div className="pt-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center shadow-xs">
              <div className="text-xl font-extrabold text-slate-900">0 – 15 YOE</div>
              <div className="text-xs text-slate-500 mt-0.5">Entry to Senior Leads</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center shadow-xs">
              <div className="text-xl font-extrabold text-blue-600">500+ Recruiters</div>
              <div className="text-xs text-slate-500 mt-0.5">Verified Direct Contacts</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center shadow-xs">
              <div className="text-xl font-extrabold text-indigo-600">Multi-Channel</div>
              <div className="text-xs text-slate-500 mt-0.5">Email, WhatsApp &amp; LinkedIn</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center shadow-xs">
              <div className="text-xl font-extrabold text-teal-600">100% Ethical</div>
              <div className="text-xs text-slate-500 mt-0.5">Clear Policy Compliance</div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. THE 3 CORE SERVICE PILLARS */}
      <section className="py-16 px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="text-center space-y-3 mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
            Core Agency Capabilities
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            How We Accelerate Your Job Search
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
            AutoApplyCV is a recruitment and job-search assistance agency helping candidates discover relevant job opportunities and connect with hiring leads.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pillar 1 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
              <Target className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Personalized Job Search Assistance
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              We curate and filter available vacancies tailored specifically to your target roles, technology stack, years of experience, and preferred work location.
            </p>
            <ul className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Custom skill &amp; keyword alignment</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Active vacancy filtering</span>
              </li>
            </ul>
          </div>

          {/* Pillar 2 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center font-bold">
              <MessageCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Recruiter Outreach
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Direct introduction to verified corporate recruiters, HR talent partners, and headhunters across multiple communication channels where permitted.
            </p>
            <ul className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>WhatsApp direct recruiter messaging</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Professional introductory cold emails</span>
              </li>
            </ul>
          </div>

          {/* Pillar 3 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center font-bold">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Resume Circulation
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Targeted candidate profile and CV circulation across specialized recruiter circles, hiring forums, and professional LinkedIn communities.
            </p>
            <ul className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                <span>LinkedIn community placement</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                <span>Direct portal submission guidance</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 3. DEDICATED BROCHURE PREVIEW & DOWNLOAD HUB - Solid Light Section */}
      <section id="brochure" className="py-16 px-6 lg:px-8 bg-slate-100 border-y border-slate-200">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
                Official Agency Publication
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900">
                Official 6-Page Corporate Booklet (PDF)
              </h2>
              <p className="text-sm sm:text-base text-slate-600 max-w-2xl">
                Download our complete 6-page corporate booklet featuring our agency profile, core capabilities, 6-phase candidate framework, transparent pricing tiers, and contact directory with scannable QR portal access.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <a
                href="/AutoApplyCV_Recruitment_Brochure.pdf"
                download="AutoApplyCV_Recruitment_Brochure.pdf"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download 6-Page PDF</span>
              </a>

              <button
                type="button"
                onClick={shareBrochureOnWhatsApp}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Share via WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Individual 6-Page Detailed Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {[
              { num: 1, title: "Page 1: Front Cover", subtitle: "Official corporate title & candidate highlights", img: "/images/brochure_page_1.png?v=2" },
              { num: 2, title: "Page 2: About & Founder Seal", subtitle: "Placement metrics & authorized founder signature", img: "/images/brochure_page_2.png?v=2" },
              { num: 3, title: "Page 3: Core Capabilities", subtitle: "Job discovery, outreach & offer guidance", img: "/images/brochure_page_3.png?v=2" },
              { num: 4, title: "Page 4: 6-Phase Framework", subtitle: "Systematic recruiter outreach methodology", img: "/images/brochure_page_4.png?v=2" },
              { num: 5, title: "Page 5: Pricing & Comparison", subtitle: "₹500 & ₹2,000 packages with zero commissions", img: "/images/brochure_page_5.png?v=2" },
              { num: 6, title: "Page 6: Contact & WhatsApp Desks", subtitle: "Direct WhatsApp (+91 98055 59015 / 78149 58809) & QR portal", img: "/images/brochure_page_6.png?v=2" },
            ].map((p) => (
              <div
                key={p.num}
                onClick={() => {
                  setSelectedBrochurePage(p.num);
                  setBrochureModalOpen(true);
                }}
                className="rounded-2xl border-2 border-slate-200 hover:border-indigo-500 bg-white p-4 shadow-sm hover:shadow-lg transition-all space-y-3 cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{p.title}</h4>
                    <p className="text-[11px] text-slate-500 font-medium">{p.subtitle}</p>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    View
                  </span>
                </div>
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-inner relative">
                  <img src={p.img} alt={p.title} className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-200" />
                  <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/10 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 bg-slate-900/80 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-opacity shadow-md">
                      Click to Enlarge
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. HOW THE RECRUITMENT AGENCY WORKS (6-PHASE FRAMEWORK) */}
      <section id="how-it-works" className="py-16 px-6 lg:px-8 max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
            Structured Candidate Framework
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Our 6-Phase Candidate Placement Framework
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
            A systematic, multi-tiered outreach methodology designed to bypass recruiter black holes and secure hiring decision-maker engagement.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">
              1
            </div>
            <h4 className="text-sm font-bold text-slate-900 leading-tight">Phase 1: Profile Audit &amp; Keyword Alignment</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              In-depth ATS compatibility analysis, technical skill benchmarking, and tailored resume optimization to match hiring parameters.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
              2
            </div>
            <h4 className="text-sm font-bold text-slate-900 leading-tight">Phase 2: Target Recruiter &amp; Role Mapping</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Identifying active requisitions across target employers and mapping verified HR managers, department heads, and talent partners.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white font-bold flex items-center justify-center text-sm">
              3
            </div>
            <h4 className="text-sm font-bold text-slate-900 leading-tight">Phase 3: Multi-Channel Outreach Dispatch</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Deploying customized introductory pitches directly to verified corporate email IDs, official WhatsApp desks, and LinkedIn inboxes.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white font-bold flex items-center justify-center text-sm">
              4
            </div>
            <h4 className="text-sm font-bold text-slate-900 leading-tight">Phase 4: Warm Pipeline &amp; Follow-Up Cycles</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Systematic second-touch and re-engagement messaging with responsive recruiters to keep your profile front-of-mind.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
              5
            </div>
            <h4 className="text-sm font-bold text-slate-900 leading-tight">Phase 5: Interview Scheduling Support</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Direct coordination assistance when recruiters request screening discussions, portfolio submissions, or technical rounds.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600 text-white font-bold flex items-center justify-center text-sm">
              6
            </div>
            <h4 className="text-sm font-bold text-slate-900 leading-tight">Phase 6: Offer Negotiation &amp; Onboarding</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Compensation benchmarking guidance and professional transition support to ensure you secure fair market value.
            </p>
          </div>
        </div>
      </section>

      {/* 5. SERVICE PLANS & PRICING - Solid Light Section */}
      <section id="plans" className="py-16 px-6 lg:px-8 bg-slate-100 border-t border-slate-200">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
              Transparent Pricing Packages
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900">
              Choose the Support That Fits Your Job Search
            </h2>
            <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
              Straightforward pricing with no recurring lock-ins. Pick the right tier for your target career leap.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* PLAN 1 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Job Search Access</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Essential job discovery &amp; direct recruiter contact database.
                  </p>
                </div>

                <div className="flex items-baseline gap-1.5 py-3 border-y border-slate-100">
                  <span className="text-2xl font-bold text-slate-900">₹</span>
                  <span className="text-4xl font-extrabold text-slate-900">500</span>
                  <span className="text-xs text-slate-500 font-medium">/ one-time</span>
                </div>

                <ul className="space-y-3 text-xs text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Access to Available Openings:</strong> Curated relevant job openings matched to your profile.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>HR &amp; Recruiter Contact Details:</strong> Verified contact info &amp; emails where available.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>WhatsApp Contact Information:</strong> Direct recruiter messaging contacts where available.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Recruiter Outreach Guidance:</strong> Proven templates and best practices for outreach.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Job Opportunity Updates:</strong> Regular alerts on newly published matching roles.</span>
                  </li>
                </ul>
              </div>

              <a
                href="https://recruitment.autoapplycv.in/index.html"
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 text-center rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-all shadow-sm block"
              >
                Enroll in Job Search Access (₹500)
              </a>
            </div>

            {/* PLAN 2 - FEATURED */}
            <div className="bg-white rounded-2xl border-2 border-indigo-600 p-8 shadow-md flex flex-col justify-between space-y-6 relative">
              <div className="absolute -top-3.5 right-6 bg-indigo-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                ⭐ Recommended Package
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Premium Job Outreach</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Comprehensive end-to-end recruiter engagement &amp; circulation.
                  </p>
                </div>

                <div className="flex items-baseline gap-1.5 py-3 border-y border-indigo-100">
                  <span className="text-2xl font-bold text-indigo-700">₹</span>
                  <span className="text-4xl font-extrabold text-indigo-700">2,000</span>
                  <span className="text-xs text-slate-500 font-medium">/ one-time</span>
                </div>

                <ul className="space-y-3 text-xs text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span><strong>Relevant Opportunity Matching:</strong> Deep algorithmic matching to premier hiring requisitions.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span><strong>WhatsApp Recruiter Outreach:</strong> Direct candidate intro dispatch where permitted.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span><strong>Email Recruiter Outreach:</strong> Personalized introductory emails to relevant recruiters.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span><strong>Application Outreach Assistance:</strong> Structured support navigating company job portals.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span><strong>LinkedIn Community Circulation:</strong> Resume placement in recruiter communities where permitted.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span><strong>Tracking &amp; Follow-up Assistance:</strong> Pipeline dashboard and follow-up guidance.</span>
                  </li>
                </ul>
              </div>

              <a
                href="https://recruitment.autoapplycv.in/index.html"
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 text-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm transition-all shadow-sm block"
              >
                Enroll in Premium Outreach (₹2,000)
              </a>
            </div>
          </div>

          {/* 6. TRANSPARENCY & DISCLAIMER BOX - Solid Amber Card */}
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 shadow-xs flex items-start gap-3.5">
            <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Ethical Policy &amp; Transparency Notice
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed font-medium">
                Interview calls and job offers depend on employer requirements and recruiter responses. Our services assist with job discovery and outreach but do not guarantee employment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. VERIFIED CANDIDATE REVIEWS & TESTIMONIALS */}
      <section id="reviews" className="py-16 px-6 lg:px-8 max-w-6xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
            Candidate Success Stories
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900">
            Verified Reviews from Real Candidates
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
            See how professionals across tech, engineering, and business accelerated their career conversations.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex justify-center gap-2 overflow-x-auto pb-2">
          {[
            { id: "all", label: "All Reviews (6)" },
            { id: "tech", label: "Software & Tech" },
            { id: "engineering", label: "SCADA & Engineering" },
            { id: "mid_senior", label: "Mid & Senior Leads" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTestimonialTab(tab.id as any)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTestimonialTab === tab.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredTestimonials.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                    {t.package}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed italic">
                  "{t.quote}"
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full ${t.avatarBg} text-white font-bold text-xs flex items-center justify-center shadow-xs`}>
                  {t.avatar}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-none">{t.name}</h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">{t.role}</p>
                  <p className="text-[10px] text-slate-400">{t.experience} · {t.companyType}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 8. AGENCY FAQ ACCORDION - Solid Light Section */}
      <section className="py-16 px-6 lg:px-8 bg-slate-100 max-w-5xl mx-auto rounded-3xl border border-slate-200 my-10 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Got Questions?</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4 max-w-3xl mx-auto">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>{faq.q}</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed pl-6">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 9. FINAL CALL TO ACTION BANNER - Solid Light Card */}
      <section className="py-16 px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-3xl p-8 sm:p-12 text-slate-900 shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-white border border-indigo-200 px-3 py-1 rounded-full inline-block">
              Take the Next Career Leap
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
              Ready to Explore Your Next Opportunity?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Submit your resume today and let our recruitment outreach specialists connect you with hiring managers across the country.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <a
              href="https://recruitment.autoapplycv.in/index.html"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-md text-center transition-all inline-flex items-center justify-center gap-2"
            >
              <span>Submit Your Resume Today</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href="https://wa.me/919805559015"
              target="_blank"
              rel="noreferrer"
              className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl text-center shadow-xs transition-all inline-flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp (9805559015)</span>
            </a>

            <a
              href="https://wa.me/917814958809"
              target="_blank"
              rel="noreferrer"
              className="px-5 py-3.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-sm rounded-xl text-center shadow-xs transition-all inline-flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>WhatsApp (7814958809)</span>
            </a>
          </div>
        </div>

        {/* Agency Footer Notice */}
        <div className="mt-8 text-center text-xs text-slate-500 space-y-1">
          <p className="font-bold text-slate-700">AutoApplyCV | Connecting Talent With Opportunities</p>
          <p>Official Website: <a href="https://autoapplycv.in" className="text-indigo-600 underline">https://autoapplycv.in</a> · Support Email: <a href="mailto:support@autoapplycv.in" className="text-indigo-600 underline">support@autoapplycv.in</a></p>
        </div>
      </section>

      {/* BROCHURE MODAL VIEWER */}
      {brochureModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={() => setBrochureModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col overflow-hidden border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="font-extrabold text-sm text-slate-900">
                  Corporate Booklet · Page {selectedBrochurePage} of 6
                </span>
                <span className="text-xs text-slate-500 hidden sm:inline">
                  (High-Resolution Print Preview)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/AutoApplyCV_Recruitment_Brochure.pdf"
                  download="AutoApplyCV_Recruitment_Brochure.pdf"
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download PDF</span>
                </a>
                <button
                  type="button"
                  onClick={() => setBrochureModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Close Preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Main Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-center justify-center bg-slate-100 relative">
              <img
                src={`/images/brochure_page_${selectedBrochurePage}.png?v=2`}
                alt={`Brochure Page ${selectedBrochurePage}`}
                className="max-h-[72vh] w-auto object-contain rounded-xl shadow-lg border border-slate-300 bg-white"
              />

              {/* Prev / Next Floating Buttons */}
              {selectedBrochurePage > 1 && (
                <button
                  type="button"
                  onClick={() => setSelectedBrochurePage((prev) => Math.max(1, prev - 1))}
                  className="absolute left-6 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white shadow-lg transition-all cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              {selectedBrochurePage < 6 && (
                <button
                  type="button"
                  onClick={() => setSelectedBrochurePage((prev) => Math.min(6, prev + 1))}
                  className="absolute right-6 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white shadow-lg transition-all cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Modal Bottom Thumbnail Pagination */}
            <div className="px-4 py-3 bg-white border-t border-slate-200 flex items-center justify-between overflow-x-auto gap-2">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSelectedBrochurePage(num)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedBrochurePage === num
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                    }`}
                  >
                    Page {num}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden md:block">
                Press Esc or click outside to close
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

