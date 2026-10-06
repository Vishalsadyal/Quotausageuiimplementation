import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function HelpCenter() {
  return (
    <MarketingInfoPage
      eyebrow="Help Center"
      title="Documentation for setup, sync, and run troubleshooting"
      description="Use these guides to configure your profile, extension, and search strategy for stable runs and better submission quality."
      sections={[
        {
          title: "Setup guides",
          cards: [
            {
              kicker: "Start here",
              title: "Extension install + version check",
              description: "Install the extension from the Chrome Web Store, pin it, and confirm the dashboard detects the installed version.",
            },
            {
              kicker: "Profile",
              title: "Sync answers from dashboard",
              description: "Save typed answers once and push them to extension settings for reuse in LinkedIn screening fields.",
            },
            {
              kicker: "Preferences",
              title: "Search terms, location, and work mode",
              description: "Configure remote/on-site behavior, date range, and role keywords before starting automation.",
            },
          ],
        },
        {
          title: "Troubleshooting topics",
          cards: [
            {
              kicker: "Validation",
              title: "Red field errors in Easy Apply",
              description: "When LinkedIn rejects an answer, update it from dashboard pending questions and resume.",
            },
            {
              kicker: "Navigation",
              title: "Stuck jobs or repeated pages",
              description: "Use latest extension version and reset runs to avoid stale selected-job search state.",
            },
            {
              kicker: "Sync",
              title: "Pending queue not imported",
              description: "Keep dashboard open once and verify site auth so extension import can flush queued outcomes.",
            },
          ],
        },
        {
          title: "Get started in five steps",
          description: "Most users are applying within ten minutes. Follow these steps in order the first time.",
          bullets: [
            "Create a free account and complete your profile: name, phone, current city, experience, and notice period.",
            "Upload your resume or build one in the resume builder so every application uses an up-to-date, ATS-friendly version.",
            "Install the AutoApply CV LinkedIn Copilot from the Chrome Web Store and pin it to your toolbar.",
            "Fill the answer bank once (salary range, work authorization, relocation) so screening questions are answered consistently.",
            "Set target job titles, locations, and work mode, then start with a modest daily limit and review the results.",
          ],
        },
        {
          title: "Understanding run outcomes",
          description: "Every job the extension touches ends in one of these states. Only successful submissions use an apply action or Hire credit.",
          cards: [
            {
              kicker: "Charged",
              title: "Application submitted",
              description: "The Easy Apply form was completed and submitted. Counts as one apply action or one Hire credit.",
            },
            {
              kicker: "Not charged",
              title: "Skipped: external apply",
              description: "The job sends you to the company website instead of Easy Apply, so it is skipped when easy-apply-only is enabled.",
            },
            {
              kicker: "Not charged",
              title: "Skipped: already applied",
              description: "Duplicate prevention found the job in your history, so it is not submitted or charged twice.",
            },
            {
              kicker: "Not charged",
              title: "Paused: validation error",
              description: "LinkedIn rejected an answer. The run pauses and asks you for a corrected answer in the dashboard.",
            },
          ],
        },
        {
          title: "Plans and limits",
          bullets: [
            "Free plan: 3 auto-apply actions per day plus a 30 Hires coin signup bonus.",
            "Pro plan: unlimited auto-apply for ₹49 per month, with advanced job matching and priority support.",
            "Hires wallet: pay as you go, where 1 Hire equals 1 submitted application, with no monthly subscription.",
            "Skipped, paused, or stopped jobs are never charged.",
          ],
        },
        {
          title: "Supported job platforms",
          bullets: [
            "LinkedIn Easy Apply, through the AutoApply CV Chrome extension.",
            "Indeed applications, tracked in the same dashboard.",
            "Jobs that require applying on a company website are recorded as skipped so you can apply manually.",
          ],
        },
      ]}
      ctaTitle="Need help beyond docs?"
      ctaDescription="Share logs + job URL and the support team will help you resolve the exact blocker."
      primaryAction={{ label: "Contact Support", to: "/contact" }}
      secondaryAction={{ label: "Open FAQ", to: "/faq" }}
    />
  );
}
