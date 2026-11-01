import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function AutoApply() {
  return (
    <MarketingInfoPage
      eyebrow="Free Auto Apply CV Platform"
      title="Free Auto Apply CV | Automated Job Application System"
      description="Automate your job search on LinkedIn, Naukri and Indeed from one Chrome extension. AutoApply CV is a free auto apply tool combining AI resume tailoring, automated screening question answers, recruiter outreach, and real-time job application tracking."
      metrics={[
        { label: "Cost", value: "100% Free", note: "Daily auto apply credits included" },
        { label: "Supported Platforms", value: "LinkedIn, Naukri, Indeed", note: "One Chrome extension" },
        { label: "Form Accuracy", value: "98%", note: "Verified screening answer bank" },
        { label: "Time Saved", value: "15+ hrs/wk", note: "Focus on interviews, not forms" },
      ]}
      sections={[
        {
          title: "What is Auto Apply CV and How Does It Work?",
          description:
            "AutoApply CV is an AI-powered career automation platform designed to submit high-quality job applications faster while keeping you in complete control.",
          bullets: [
            "Smart Job Search Automation: Target jobs by seniority, industry keywords, and compensation ranges.",
            "Automated Submissions on LinkedIn Easy Apply: Let the copilot fill application forms in seconds.",
            "Naukri and Indeed Auto Apply: The same extension applies to Naukri jobs with Naukri's own Apply (answering the recruiter chatbot) and to Indeed \"Easily apply\" jobs, using your dashboard filters.",
            "Reusable Screening Answer Bank: Store answers for notice periods, legal eligibility, and experience once.",
            "ATS Resume Tailoring: Automatically adjusts resume keywords to match what recruiters search for.",
            "Complete Pipeline Tracking: View all applied, skipped, and interviewed roles in one central hub.",
          ],
        },
        {
          title: "Auto Apply with Quality-First Guardrails",
          description:
            "Unlike generic bot scripts that spam irrelevant companies, AutoApply CV puts your career reputation first.",
          cards: [
            {
              kicker: "Targeting",
              title: "Relevance Filters",
              description:
                "Filter out unwanted roles, agencies, or low-match positions with customizable keyword blacklists.",
            },
            {
              kicker: "Safety",
              title: "Human-Paced Simulation",
              description:
                "Realistic delays and pauses mirror human browsing behavior, preventing automated account flagging.",
            },
            {
              kicker: "Intelligence",
              title: "AI Resume Optimization",
              description:
                "Highlights required skills and certifications to maximize your score in applicant tracking systems.",
            },
          ],
        },
        {
          title: "Frequently Asked Questions About AutoApply CV",
          bullets: [
            "Is AutoApply CV really free? Yes. We offer a 100% free plan with daily application credits, making advanced job search automation accessible to every professional.",
            "Is auto applying safe for my account? AutoApply CV is an assisted browser copilot with human-pacing guardrails, not a headless scraper. It keeps a human-like pace on LinkedIn, Naukri and Indeed, stays within Naukri's daily apply limit, and pauses for Indeed's \"verify you're human\" checks.",
            "How many jobs can I auto apply to each day? The Free plan includes 3 auto-applies a day plus a 30 Hires signup bonus (1 Hire = 1 application). Pro (₹99/month) is unlimited. On Naukri the extension also stays within Naukri's own daily apply limit.",
            "Which job sites are supported? LinkedIn Easy Apply, Naukri (jobs with Naukri's own Apply button), and Indeed (\"Easily apply\" jobs only).",
            "Can I review applications before they are submitted? Yes. You can run the extension in assisted review mode or fully automated mode.",
          ],
        },
      ]}
      ctaTitle="Start applying automatically for free"
      ctaDescription="Join over 50,000 job seekers landing better jobs faster with AutoApply CV."
      primaryAction={{ label: "Sign Up Free", to: "/signup" }}
      secondaryAction={{ label: "Explore Features", to: "/features" }}
    />
  );
}

