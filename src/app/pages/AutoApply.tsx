import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function AutoApply() {
  return (
    <MarketingInfoPage
      eyebrow="Free Auto Apply CV Platform"
      title="Free Auto Apply CV | Automated Job Application System"
      description="Automate your job search and apply to hundreds of relevant roles with zero friction. AutoApply CV is the premier free auto apply tool combining AI resume tailoring, automated screening question answers, and real-time job application tracking."
      metrics={[
        { label: "Cost", value: "100% Free", note: "Daily auto apply credits included" },
        { label: "Supported Platforms", value: "LinkedIn", note: "Easy Apply jobs" },
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
            "Automated Easy Apply Submissions: Let the copilot fill complex application forms in seconds.",
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
            "Is auto applying safe for my LinkedIn account? Yes. AutoApply CV is an assisted browser copilot with human-pacing guardrails, not a headless scraper.",
            "How many jobs can I auto apply to each day? Free users receive generous daily credits, while premium plans offer expanded high-velocity quotas.",
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

