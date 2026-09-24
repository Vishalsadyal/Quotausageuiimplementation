export type SeoEntry = {
  title: string;
  description: string;
  index: boolean;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
};

import { STATIC_BLOG_POSTS_BY_SLUG } from "src/content/blogPosts";

export const DEFAULT_SEO: SeoEntry = {
  title: "Free AutoApply CV | LinkedIn Auto Apply Bot & AI Job Search Tool",
  description:
    "AutoApply CV is a free AI job search automation platform with a LinkedIn auto apply bot, AI resume builder, and job application tracker.",
  index: true,
};

export function normalizeCanonicalBaseUrl(value?: string) {
  const fallback = "https://www.autoapplycv.in";
  const raw = value?.trim();
  if (!raw) return fallback;

  try {
    const url = new URL(raw);
    if (url.hostname === "autoapplycv.in") {
      url.hostname = "www.autoapplycv.in";
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

export const SEO_BY_PATH: Record<string, SeoEntry> = {
  "/": {
    title: "Free AutoApply CV | Free LinkedIn Auto Apply Bot & Job Search Automation",
    description:
      "Free LinkedIn auto apply bot & job search automation. Apply to LinkedIn Easy Apply jobs automatically with AutoApply CV, featuring custom answer banks, duplicate prevention, and real-time tracking.",
    index: true,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "AutoApply CV",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "AI job search automation platform with LinkedIn auto apply, resume optimization, and job application tracking.",
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "AutoApply CV",
        url: "https://www.autoapplycv.in",
      },
    ],
  },
  "/features": {
    title: "AI Resume Builder, Job Tracker & Auto Apply Features | AutoApply CV",
    description:
      "Explore job search automation features: LinkedIn easy apply bot workflows, AI resume tailoring, interview preparation AI, and application analytics.",
    index: true,
  },
  "/product": {
    title: "Product Overview | AutoApply CV",
    description:
      "See the complete AutoApply CV platform: LinkedIn automation workflows, AI resume optimization, and application tracking.",
    index: true,
  },
  "/how-it-works": {
    title: "How AutoApply CV Auto Apply Works | AutoApply CV",
    description:
      "See how to set up AutoApply CV with page-ready submission checks, dashboard answer sync, ATS resume optimization, and pipeline tracking.",
    index: true,
  },
  "/pricing": {
    title: "Pricing | LinkedIn Auto Apply Bot Plans | AutoApply CV",
    description:
      "Compare transparent AutoApply CV pricing with clear charged vs skipped outcomes, LinkedIn automation limits, and AI resume optimization tools.",
    index: true,
  },
  "/recruitment-agency": {
    title: "Recruitment & Candidate Job Search Assistance Agency | AutoApply CV",
    description:
      "AutoApplyCV is an authorized recruitment & candidate assistance agency connecting professionals with 500+ verified corporate recruiters via WhatsApp & direct email outreach. Download our official 6-page brochure.",
    index: true,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "EmploymentAgency",
        name: "AutoApplyCV Recruitment Agency",
        url: "https://www.autoapplycv.in/recruitment-agency",
        description:
          "Professional recruitment & candidate job-search assistance agency connecting ambitious job seekers with verified recruiters across India.",
        telephone: "+919805559015",
        email: "support@autoapplycv.in",
        priceRange: "₹500 - ₹2000",
        address: {
          "@type": "PostalAddress",
          addressCountry: "IN",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "What is AutoApplyCV Recruitment Agency?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "AutoApplyCV is a professional recruitment & candidate job-search assistance agency connecting candidates directly with verified HR decision-makers via multi-channel outreach.",
            },
          },
          {
            "@type": "Question",
            name: "How can candidates submit their profile on WhatsApp?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Candidates can send their updated resume, target job roles, total years of experience, preferred locations, and CTC details directly to our official WhatsApp desks at +91 98055 59015 or +91 78149 58809.",
            },
          },
          {
            "@type": "Question",
            name: "What are the service pricing packages?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "AutoApplyCV offers transparent one-time plans: ₹500 for Job Search Access and ₹2,000 for Full-Service Premium Job Outreach, with zero salary commission cuts.",
            },
          },
        ],
      },
    ],
  },
  "/auto-apply": {
    title: "Auto Apply | Free Auto Apply Tool | AutoApply CV",
    description:
      "Free auto apply tool to apply faster with quality controls, reusable answers, and tracking. Learn how to auto apply without wasting applications.",
    index: true,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "AutoApply CV",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: "Free auto apply tool with LinkedIn automation, resume optimization, and application tracking.",
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Is AutoApply CV free?",
            acceptedAnswer: { "@type": "Answer", text: "AutoApply CV is free to start and includes a daily cap for applications." },
          },
          {
            "@type": "Question",
            name: "What is auto apply?",
            acceptedAnswer: { "@type": "Answer", text: "Auto apply is a workflow that uses automation to submit job applications faster while maintaining quality controls." },
          },
        ],
      },
    ],
  },
  "/auto-apply-linkedin": {
    title: "LinkedIn Auto Apply Bot (Free) | AutoApply CV",
    description:
      "Free LinkedIn auto apply bot & Easy Apply copilot. Automate job applications safely on LinkedIn with custom answer banks, smart resume matching, and live tracking.",
    index: true,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "AutoApply CV - LinkedIn Auto Apply Bot",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Chrome Browser Extension, Web",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        description:
          "Free LinkedIn auto apply bot and Easy Apply copilot for software engineers and professionals.",
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Is there a free LinkedIn auto apply bot?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. AutoApply CV provides a free LinkedIn auto apply bot and Chrome extension copilot that automates Easy Apply submissions with safety pacing and answer bank sync.",
            },
          },
          {
            "@type": "Question",
            name: "How does the LinkedIn auto apply bot work?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "The AutoApply CV extension sits alongside your LinkedIn job search, identifies Easy Apply jobs matching your criteria, automatically fills screening questions from your saved answers, and tracks applied roles in your dashboard.",
            },
          },
          {
            "@type": "Question",
            name: "Will LinkedIn ban my account for using an auto apply bot?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "AutoApply CV is engineered with human-in-the-loop safety controls, realistic delays, duplicate prevention, and pause/resume capabilities so you remain completely in control of your LinkedIn account.",
            },
          },
          {
            "@type": "Question",
            name: "Can I track my LinkedIn auto apply job applications?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. Every application submitted by the LinkedIn auto apply bot is logged with status (applied, skipped, failed), role details, company name, and timestamps in your AutoApply CV dashboard.",
            },
          },
        ],
      },
    ],
  },
  "/auto-apply-jobs": {
    title: "Auto Apply Jobs (Free) | Automated Job Applications | AutoApply CV",
    description:
      "Free auto apply jobs tool to apply to LinkedIn and Indeed roles automatically. Match resumes, submit applications with verified answers, and track interviews.",
    index: true,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "How can I auto apply to jobs for free?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "You can sign up on AutoApply CV for free, configure your job preferences and screening answers, and use the automated copilot to apply to matched jobs.",
          },
        },
        {
          "@type": "Question",
          name: "Which platforms does AutoApply CV support for auto applying?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "AutoApply CV currently supports LinkedIn Easy Apply and Indeed jobs, with intelligent form filling and outcome tracking.",
          },
        },
      ],
    },
  },
  "/auto-apply-chrome-extension": {
    title: "Auto Apply Chrome Extension for LinkedIn (Free) | AutoApply CV",
    description:
      "Free auto apply Chrome extension for LinkedIn Easy Apply. Automates repetitive application forms, syncs screening answers, and prevents duplicate applications.",
    index: true,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "AutoApply CV Chrome Extension",
      applicationCategory: "BrowserExtension",
      operatingSystem: "Google Chrome",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  },
  "/about": {
    title: "About | AutoApply CV",
    description: "Learn about the AutoApply CV mission to help job seekers land better opportunities faster.",
    index: true,
  },
  "/faq": {
    title: "FAQ | LinkedIn Auto Apply Bot Questions | AutoApply CV",
    description:
      "Get answers about LinkedIn easy apply bot behavior, auto apply limits, AI resume builder features, and job search automation setup.",
    index: true,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Is AutoApply CV a LinkedIn auto apply bot?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "AutoApply CV includes LinkedIn easy apply automation with controls to keep users in charge of their applications.",
          },
        },
        {
          "@type": "Question",
          name: "Do you include a job application tracker?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. AutoApply CV includes a job application tracker for organizing roles, stages, notes, and interview status.",
          },
        },
        {
          "@type": "Question",
          name: "Can I use AutoApply CV as an AI resume builder?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. AutoApply CV helps tailor resume content to job descriptions and improve ATS keyword alignment.",
          },
        },
      ],
    },
  },
  "/roadmap": {
    title: "Roadmap | AutoApply CV",
    description: "Track upcoming AutoApply CV improvements across run reliability, automation quality, and reporting.",
    index: true,
  },
  "/careers": {
    title: "Careers | AutoApply CV",
    description: "Explore open roles and help build reliable job search automation workflows for modern candidates.",
    index: true,
  },
  "/contact": {
    title: "Contact | AutoApply CV",
    description: "Reach AutoApply CV support for product, billing, and automation troubleshooting questions.",
    index: true,
  },
  "/press-kit": {
    title: "Press Kit | AutoApply CV",
    description: "Press resources, company summary, and media contact details for AutoApply CV.",
    index: true,
  },
  "/help-center": {
    title: "Help Center | AutoApply CV",
    description: "Guides for setup, extension sync, and troubleshooting LinkedIn automation workflows.",
    index: true,
  },
  "/community": {
    title: "Community | AutoApply CV",
    description: "Join the AutoApply CV community to share workflow strategies and improve application quality.",
    index: true,
  },
  "/privacy-policy": {
    title: "Privacy Policy | AutoApply CV",
    description: "Read how AutoApply CV collects, uses, and protects user data.",
    index: true,
  },
  "/terms-of-service": {
    title: "Terms of Service | AutoApply CV",
    description: "Review the terms governing use of AutoApply CV services.",
    index: true,
  },
  "/cookie-policy": {
    title: "Cookie Policy | AutoApply CV",
    description: "See how cookies and browser storage are used across AutoApply CV.",
    index: true,
  },
  "/blog": {
    title: "Job Search Automation Blog | AutoApply CV",
    description:
      "Read guides on LinkedIn auto apply, AI resume builder strategy, ATS optimization, and job application tracking.",
    index: true,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "AutoApply CV Blog",
      description: "Guides about AI job search automation and LinkedIn auto apply workflows.",
    },
  },
  "/blog/lazyapply-alternative": {
    title: "LazyApply Alternative for Better Results | AutoApply CV Blog",
    description:
      "Looking for a LazyApply alternative? Compare automation quality, ATS resume optimization, and tracking for better interviews.",
    index: true,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "LazyApply Alternative: What to Pick for Better Interview Results",
      description:
        "A practical comparison guide for users evaluating LazyApply alternatives and LinkedIn auto apply workflows.",
      author: { "@type": "Organization", name: "AutoApply CV" },
    },
  },
  "/blog/best-ai-job-search-tools": {
    title: "Best AI Job Search Tools for 2026 | AutoApply CV Blog",
    description:
      "Compare AI job search tools for engineers: automation quality, resume tailoring, tracking, and practical guardrails that prevent wasted applications.",
    index: true,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Best AI Job Search Tools for Engineers (2026)",
      description: "A comparison of AI job search tools and automation workflows for engineers.",
      author: { "@type": "Organization", name: "AutoApply CV" },
    },
  },
  "/blog/linkedin-easy-apply-does-it-work": {
    title: "LinkedIn Easy Apply: Does It Work? | AutoApply CV Blog",
    description:
      "See when LinkedIn Easy Apply works, why applications fail, and how to improve callbacks with resume and targeting changes.",
    index: true,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "LinkedIn Easy Apply: Does It Work for Software Engineers?",
      description: "Guidance on improving LinkedIn Easy Apply results with tailored resumes and better targeting.",
      author: { "@type": "Organization", name: "AutoApply CV" },
    },
  },
  "/login": {
    title: "Login | AutoApply CV",
    description: "Login to your AutoApply CV account.",
    index: true,
  },
  "/signup": {
    title: "Sign Up | AutoApply CV",
    description: "Create your AutoApply CV account.",
    index: true,
  },
  "/admin/login": {
    title: "Admin Login | AutoApply CV",
    description: "Admin access portal for AutoApply CV platform operations.",
    index: true,
  },
};

export function resolveSeo(pathname: string): SeoEntry {
  if (pathname === "/blog") {
    return {
      title: "Free Auto Apply Blog | AutoApply CV",
      description:
        "Free auto apply guides, LinkedIn workflows, resume optimization, and job tracking tactics to get more interviews.",
      index: true,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: "AutoApply CV Blog",
        description: "Free auto apply guides and job search automation content.",
      },
    };
  }

  if (pathname.startsWith("/blog/")) {
    const slug = pathname.replace("/blog/", "").trim().toLowerCase();
    const post = STATIC_BLOG_POSTS_BY_SLUG[slug];
    if (post) {
      return {
        title: `${post.title} | AutoApply CV`,
        description: post.excerpt,
        index: true,
        structuredData: {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: post.excerpt,
          author: { "@type": "Organization", name: "AutoApply CV" },
        },
      };
    }
  }

  const base =
    SEO_BY_PATH[pathname] ||
    (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")
      ? {
          title: "AutoApply CV Dashboard",
          description: "Private dashboard area.",
          index: true,
        }
      : DEFAULT_SEO);

  const shouldAddFree =
    !pathname.startsWith("/dashboard") &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/api");

  if (!shouldAddFree) return base;

  const hasFreeTitle = /\bfree\b/i.test(base.title);
  const hasFreeDesc = /\bfree\b/i.test(base.description);

  return {
    ...base,
    title: hasFreeTitle ? base.title : `Free ${base.title}`,
    description: hasFreeDesc ? base.description : `Free to start. ${base.description}`,
  };
}

export function canonicalForPath(pathname: string, baseUrl = "https://www.autoapplycv.in") {
  const normalizedBase = normalizeCanonicalBaseUrl(baseUrl);
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${normalizedBase}${path === "/" ? "" : path}`;
}
