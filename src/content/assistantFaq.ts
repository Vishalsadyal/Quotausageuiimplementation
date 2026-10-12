// Pre-written answers the dashboard assistant gives free users (no AI call).
// Paid users get live AI answers instead (app/api/assistant/route.ts).

export type FaqFacts = {
  firstName: string;
  plan: string;
  freeRemaining: number;
  spendable: number;
  hireBalance: number;
  resetAt: Date;
  hasResume: boolean;
  onboardingCompleted: boolean;
  appCounts: Record<string, number>;
  lastError: string;
};

type FaqEntry = {
  q: string;
  keywords: string[];
  answer: string | ((f: FaqFacts) => string);
};

function resetTimeIst(date: Date) {
  return new Date(date).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

export const ASSISTANT_FAQ: FaqEntry[] = [
  {
    q: "How many applies do I have left today?",
    keywords: ["left", "remaining", "quota", "limit", "applies", "today", "how many", "balance"],
    answer: (f) =>
      f.plan === "pro"
        ? "You're on **Pro**, so auto-apply is **unlimited**."
        : `You have **${f.freeRemaining} free applies** left today and **${f.hireBalance} Hires** in your wallet, so **${f.spendable}** applications in total right now.\n\nYour free applies reset daily at ${resetTimeIst(f.resetAt)} IST. Need more? [Upgrade to Pro](/dashboard/billing) for unlimited, or top up Hires.`,
  },
  {
    q: "Why did my last auto-apply run fail?",
    keywords: ["fail", "failed", "error", "not working", "stuck", "broken", "issue", "problem"],
    answer: (f) =>
      (f.lastError ? `Your latest failed run reported: **${f.lastError}**\n\n` : "") +
      "Common fixes:\n1. Update the extension to the latest version and reload the LinkedIn tab.\n2. If LinkedIn shows a red field error, correct the answer in your pending questions on [Auto Apply](/dashboard/jobs/linkedin).\n3. Reset the run if it keeps opening the same pages.\n4. Keep the dashboard open once so queued results can sync.\n\nSkipped, paused and failed jobs are never charged.",
  },
  {
    q: "How do I install and connect the Chrome extension?",
    keywords: ["install", "extension", "chrome", "connect", "detect", "plugin", "add on"],
    answer:
      "1. Install **AutoApply CV LinkedIn Copilot** from the Chrome Web Store.\n2. Pin it to your toolbar.\n3. Reload this dashboard while logged in. The installed version should show on [Auto Apply](/dashboard/jobs/linkedin).\n\nStep-by-step guide: [Chrome extension](/auto-apply-chrome-extension).",
  },
  {
    q: "How do I start auto-applying?",
    keywords: ["start", "begin", "run", "auto apply", "how to apply", "first", "launch"],
    answer: (f) =>
      (f.onboardingCompleted ? "" : "First finish [Onboarding](/dashboard/onboarding) so your profile and answers are complete.\n\n") +
      "1. Open [Auto Apply](/dashboard/jobs/linkedin) and set your target roles, locations and work mode.\n2. Make sure the extension is installed and pinned.\n3. Start the run and keep an eye on any paused questions.\n\nStart with a modest daily limit and review results in [Applications](/dashboard/applications).",
  },
  {
    q: "What do I get with Pro?",
    keywords: ["pro", "upgrade", "premium", "benefits", "features", "plan", "subscription", "price", "cost"],
    answer:
      "**Pro is ₹99/month** (limited 80% off offer) and includes:\n- Unlimited auto-apply\n- HR recruiter email & phone extractor\n- Advanced AI job matching and AI resume optimization\n- Interview prep AI tools and cover letter generator\n- Personal AI assistant that knows your account\n- Direct WhatsApp support\n- Priority support\n\n[Upgrade on Billing](/dashboard/billing).",
  },
  {
    q: "What are Hires and how do I top up?",
    keywords: ["hire", "hires", "wallet", "top up", "topup", "credit", "coins", "recharge"],
    answer: (f) =>
      `Hires are pay-as-you-go credits: **1 Hire = 1 submitted application**. You currently have **${f.hireBalance} Hires**.\n\nTop up from ₹49 on [Billing](/dashboard/billing). Paid Hires work beyond the free daily limit, with no subscription.`,
  },
  {
    q: "When am I charged for an application?",
    keywords: ["charged", "charge", "deduct", "deducted", "billing", "cost per", "skipped", "refund"],
    answer:
      "You're only charged when an application is **successfully submitted** (1 free apply or 1 Hire).\n\nNever charged: external company-site jobs, jobs you already applied to, runs paused on a validation error, or runs you stop before submit.",
  },
  {
    q: "How do I upgrade or pay?",
    keywords: ["pay", "payment", "razorpay", "checkout", "card", "upi", "buy"],
    answer:
      "Go to [Billing](/dashboard/billing) and choose **Pro** or a Hires top-up. Payments are processed securely by Razorpay. If your plan doesn't update right away, wait a minute and refresh, as payment confirmation can take a moment to sync.",
  },
  {
    q: "How do I upload or update my resume?",
    keywords: ["resume", "cv", "upload", "update resume", "ats"],
    answer: (f) =>
      (f.hasResume ? "You already have a resume uploaded. Upload a new one any time to replace it.\n\n" : "You haven't uploaded a resume yet.\n\n") +
      "Open [Resume](/dashboard/resume) to upload a PDF, DOCX or TXT (max 5MB), or tailor it for ATS. An up-to-date resume makes screening answers more accurate.",
  },
  {
    q: "How do I change my target job titles or locations?",
    keywords: ["job title", "target role", "roles", "location", "preferences", "search terms", "keywords", "remote"],
    answer:
      "Update your target roles, locations and work mode on [Auto Apply](/dashboard/jobs/linkedin). New runs use the updated preferences.",
  },
  {
    q: "How do screening answers work?",
    keywords: ["screening", "question", "answers", "answer bank", "salary", "notice", "visa", "pending"],
    answer:
      "Fill your answer bank once (salary, notice period, work authorization, relocation). The extension reuses these on LinkedIn Easy Apply. When it meets a question it can't answer truthfully, it pauses and the question appears under pending questions on [Auto Apply](/dashboard/jobs/linkedin).",
  },
  {
    q: "How many applications have I sent?",
    keywords: ["applications", "sent", "submitted", "history", "tracker", "how many applied"],
    answer: (f) => {
      const submitted = f.appCounts.submitted || 0;
      const skipped = f.appCounts.skipped || 0;
      const failed = f.appCounts.failed || 0;
      return `So far: **${submitted} submitted**, ${skipped} skipped and ${failed} failed.\n\nSee every application in [Applications](/dashboard/applications) and trends in [Analytics](/dashboard/analytics).`;
    },
  },
  {
    q: "Which job sites are supported?",
    keywords: ["linkedin", "indeed", "naukri", "supported", "platform", "sites", "external"],
    answer:
      "- **LinkedIn Easy Apply** through the Chrome extension\n- **Indeed** applications, tracked in the same dashboard\n\nJobs that require applying on a company website are recorded as skipped so you can apply manually.",
  },
  {
    q: "What is Call Copilot?",
    keywords: ["call copilot", "interview", "copilot", "live"],
    answer: "Call Copilot is a live interview assistant that helps you answer during calls. Open it from [Call Copilot](/dashboard/interview).",
  },
  {
    q: "How do I email recruiters?",
    keywords: ["email", "recruiter", "hr", "cold email", "outreach", "contact"],
    answer:
      "Use [Apply Email](/dashboard/cold-emails) to send cold emails to recruiters and [HR Outreach](/dashboard/hr-outreach) to manage recruiter contacts. The recruiter email & phone extractor is part of Pro.",
  },
  {
    q: "How do I contact support?",
    keywords: ["support", "help", "contact", "human", "agent", "talk", "whatsapp"],
    answer:
      "Use the [Contact page](/contact) and include the job URL and what the extension showed. **Pro users** get direct WhatsApp support from this assistant. [Upgrade on Billing](/dashboard/billing).",
  },
];

export const ASSISTANT_FAQ_QUESTIONS = ASSISTANT_FAQ.map((e) => e.q);

const FALLBACK_ANSWER =
  "I don't have a ready answer for that one. Try one of the common questions below, ask \"which page has billing?\" to find a page, or [upgrade to Pro](/dashboard/billing) for AI answers about anything on your account, plus WhatsApp support.";

function normalize(text: string) {
  return ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()} `;
}

// Everyday messages ("hello", "thanks", "what can you do"), checked before FAQ matching.
const SMALL_TALK: Array<{ pattern: RegExp; answer: (f: FaqFacts) => string }> = [
  {
    pattern: /^ (hi+|hello+|hey+|hii+|helo|hola|namaste|good (morning|afternoon|evening)|yo|sup)( there| team| bot)? $/,
    answer: (f) =>
      `Hi${f.firstName ? ` ${f.firstName}` : ""}! 👋 I can help with your applies, the Chrome extension, auto-apply runs, resume, billing and finding any page. What do you need?`,
  },
  {
    pattern: /^ (how are you|how r u|how are u|whats up|what s up)( doing)? $/,
    answer: () => "I'm doing great and ready to help! Ask me about your applies, runs, resume, billing, or which page has what.",
  },
  {
    pattern: /^ (thanks?|thank you|thx|ty|tysm|thank u|great|nice|cool|ok|okay|got it|perfect|awesome)( so much| a lot| thanks?| you)?( bot)? $/,
    answer: () => "You're welcome! Anything else I can help with?",
  },
  {
    pattern: /^ (bye|goodbye|see you|see ya|good night|gn|tc|take care) $/,
    answer: () => "Bye! Good luck with your applications. 🚀 I'm here whenever you need me.",
  },
  {
    pattern: /^ (who are you|what are you|what is this|what can you do|help|what do you do|how can you help( me)?|menu|options) $/,
    answer: (f) =>
      "I'm the AutoApply CV assistant. I can:\n- Tell you how many applies you have left\n- Explain why a run failed and how to fix it\n- Help install the Chrome extension\n- Explain plans, Hires and billing\n- Point you to any page (try \"which page has billing?\")" +
      (f.plan === "free" ? "\n\n[Upgrade to Pro](/dashboard/billing) for AI answers about anything on your account, plus WhatsApp support." : ""),
  },
];

// Pages users ask for by name ("which page has billing", "where is my resume").
const PAGES: Array<{ label: string; path: string; names: string[]; about: string }> = [
  { label: "Billing", path: "/dashboard/billing", names: ["billing", "payment", "payments", "plan", "plans", "upgrade", "subscription", "invoice", "wallet", "hires", "top up"], about: "plans, Pro upgrade, Hires top-up and your transactions" },
  { label: "Applications", path: "/dashboard/applications", names: ["applications", "application", "applied", "tracker", "history"], about: "every submitted, skipped and failed application" },
  { label: "Resume", path: "/dashboard/resume", names: ["resume", "cv", "ats"], about: "uploading and tailoring your resume" },
  { label: "Auto Apply (LinkedIn)", path: "/dashboard/jobs/linkedin", names: ["auto apply", "autoapply", "jobs", "job search", "linkedin", "preferences", "pending questions", "run"], about: "search settings, starting runs and pending questions" },
  { label: "Auto Apply (Indeed)", path: "/dashboard/jobs/indeed", names: ["indeed"], about: "Indeed applications" },
  { label: "Apply Email", path: "/dashboard/cold-emails", names: ["cold email", "cold emails", "apply email", "email recruiters"], about: "sending cold emails to recruiters" },
  { label: "HR Outreach", path: "/dashboard/hr-outreach", names: ["hr outreach", "outreach", "recruiter contacts", "hr contacts"], about: "managing recruiter contacts" },
  { label: "Call Copilot", path: "/dashboard/interview", names: ["call copilot", "copilot", "interview"], about: "the live interview assistant" },
  { label: "Analytics", path: "/dashboard/analytics", names: ["analytics", "stats", "statistics", "reports", "charts"], about: "your application trends" },
  { label: "Settings", path: "/dashboard/settings", names: ["settings", "password", "notifications", "account settings", "delete account"], about: "account and notification settings" },
  { label: "Profile", path: "/dashboard/profile", names: ["profile", "my details", "phone number", "name"], about: "your personal details and links" },
  { label: "Onboarding", path: "/dashboard/onboarding", names: ["onboarding", "setup", "set up"], about: "profile, resume and preference setup" },
  { label: "Overview", path: "/dashboard", names: ["overview", "dashboard", "home"], about: "your summary and recent activity" },
  { label: "Pricing", path: "/pricing", names: ["pricing", "price", "prices"], about: "plan prices and what's included" },
  { label: "Help Center", path: "/help-center", names: ["help center", "docs", "documentation", "guide", "guides"], about: "setup guides and troubleshooting" },
  { label: "Contact", path: "/contact", names: ["contact", "support page"], about: "reaching the support team" },
  { label: "Chrome extension guide", path: "/auto-apply-chrome-extension", names: ["extension", "chrome extension"], about: "installing the Chrome extension" },
  { label: "Privacy policy", path: "/privacy-policy", names: ["privacy", "privacy policy"], about: "how your data is handled" },
  { label: "Terms of service", path: "/terms-of-service", names: ["terms", "terms of service", "tos"], about: "plans, billing and usage terms" },
];

const NAV_WORDS = /\b(which page|what page|where|find|open|go to|goto|take me|navigate|link|page|section|tab|menu|located)\b/;

function findPage(text: string) {
  if (!NAV_WORDS.test(text)) return null;
  let best: (typeof PAGES)[number] | null = null;
  let bestLen = 0;
  for (const page of PAGES) {
    for (const name of page.names) {
      // Prefer the longest matching name ("cold email" over "email").
      if (text.includes(` ${name} `) && name.length > bestLen) {
        best = page;
        bestLen = name.length;
      }
    }
  }
  return best;
}

/** Picks the best pre-written answer for a free user's question. */
export function answerFromFaq(question: string, facts: FaqFacts) {
  const text = normalize(question);

  for (const talk of SMALL_TALK) {
    if (talk.pattern.test(text)) return talk.answer(facts);
  }
  // "hi, where is billing?" → answer the question, not the greeting.
  const withoutGreeting = text.replace(/^ (hi+|hello+|hey+|namaste|good (morning|afternoon|evening))( there| team)? /, " ");
  if (withoutGreeting !== text && withoutGreeting.trim()) return answerFromFaq(withoutGreeting, facts);

  const page = findPage(text);
  if (page) {
    return `Go to **${page.label}** for ${page.about}: [Open ${page.label}](${page.path})\n\nYou can also reach dashboard pages from the left sidebar.`;
  }
  if (/\b(which page|what page|all pages|list of pages|pages)\b/.test(text)) {
    return "Here are the main pages:\n" + PAGES.slice(0, 13).map((p) => `- [${p.label}](${p.path}): ${p.about}`).join("\n");
  }

  let best: FaqEntry | null = null;
  let bestScore = 0;
  for (const entry of ASSISTANT_FAQ) {
    if (normalize(entry.q) === text) {
      best = entry;
      break;
    }
    // Multi-word keywords count more than single words.
    const score = entry.keywords.reduce((sum, k) => (text.includes(` ${k} `) ? sum + k.split(" ").length : sum), 0);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  if (!best) return FALLBACK_ANSWER;
  return typeof best.answer === "function" ? best.answer(facts) : best.answer;
}
