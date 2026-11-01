import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function Product() {
  return (
    <MarketingInfoPage
      eyebrow="AutoApply CV Product Suite"
      title="Complete AI Job Search Assistant for LinkedIn, Naukri & Indeed"
      description="Free to start. AutoApply CV unites LinkedIn Easy Apply, Naukri, and Indeed auto-apply, AI resume tailoring, WhatsApp and email recruiter outreach, direct HR contacts, Interview Call AI, and application tracking in one workflow."
      metrics={[
        { label: "Auto Apply", value: "LinkedIn, Naukri, Indeed", note: "One Chrome extension" },
        { label: "Resume Tech", value: "AI ATS Optimization", note: "Real-time keyword tailoring" },
        { label: "Outreach", value: "WhatsApp + Email", note: "Recruiters from LinkedIn hiring posts" },
        { label: "Safety", value: "Human-in-the-Loop", note: "Pause, review & resume anytime" },
      ]}
      sections={[
        {
          title: "Core Platform Features & Tools",
          cards: [
            {
              kicker: "Automation",
              title: "LinkedIn Easy Apply Auto Apply",
              description:
                "Apply to hundreds of LinkedIn Easy Apply jobs automatically with customizable search filters, human typing pacing, and duplicate prevention.",
            },
            {
              kicker: "Automation",
              title: "Naukri & Indeed Auto Apply",
              description:
                "The same extension applies to Naukri jobs with Naukri's own Apply (answering the recruiter chatbot) and to Indeed \"Easily apply\" jobs, using your dashboard filters and a human pace.",
            },
            {
              kicker: "Resume AI",
              title: "AI Resume Tailoring & ATS Builder",
              description:
                "Automatically adapts your resume bullets and technical skills to match target job descriptions, ensuring maximum pass rates through ATS filters.",
            },
            {
              kicker: "Efficiency",
              title: "Reusable Screening Answer Bank",
              description:
                "Store verified answers to common recruiter questions (years of experience, visa status, notice period) and auto-fill them on every application.",
            },
            {
              kicker: "Tracking",
              title: "Job Application Tracker CRM",
              description:
                "Organize your entire pipeline with Kanban-style boards. Track applied, skipped, interviewing, and offered stages in real time.",
            },
            {
              kicker: "Chrome Extension",
              title: "In-Browser Copilot Extension",
              description:
                "One AutoApply CV extension opens a sidebar on LinkedIn, Naukri, and Indeed, providing live feedback, instant autofill, and automatic data synchronization.",
            },
            {
              kicker: "Outreach",
              title: "WhatsApp & Email Recruiter Outreach",
              description:
                "Find recruiter phone numbers and emails shared in LinkedIn hiring posts and message them on WhatsApp or email from the extension.",
            },
            {
              kicker: "Pro Connect",
              title: "HR Contacts: Direct Recruiter WhatsApp Numbers",
              description:
                "20 new recruiter contacts a day (WhatsApp-checked phone numbers and emails shared in public LinkedIn hiring posts), matched to your target roles, emailed every morning, with free 1-click messaging from the dashboard. ₹500/month.",
            },
            {
              kicker: "Pro Connect",
              title: "Interview Call AI",
              description:
                "Keep the page open during an interview or client call. It listens and shows a short answer to each question from your own notes. Works with Zoom, Google Meet, Teams, or a phone on speaker. Nothing from the call is saved.",
            },
          ],
        },
        {
          title: "Designed for Safe, High-Converting Job Search Automation",
          bullets: [
            "Quality-First Pacing: Prevents account bans by using randomized human-like delays and mouse movement simulation.",
            "Smart Duplicate Guard: Automatically detects and skips roles you have already submitted to across platforms.",
            "Live Error Detection: Surfaces validation issues immediately and lets you fix answer fields with a single click.",
            "Transparent Conversion Analytics: Track weekly application velocity, callback rates, and interview conversion ratios.",
          ],
        },
      ]}
      ctaTitle="Accelerate your job search with AutoApply CV"
      ctaDescription="Experience how automated job applying, AI resume building, and application tracking transform your career."
      primaryAction={{ label: "Sign Up Free", to: "/signup" }}
      secondaryAction={{ label: "How It Works", to: "/how-it-works" }}
    />
  );
}
