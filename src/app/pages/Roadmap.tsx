import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function Roadmap() {
  return (
    <MarketingInfoPage
      eyebrow="Roadmap"
      title="What we are shipping next"
      description="The roadmap focuses on reliability, smarter fit scoring, and better workflow speed for serious job seekers."
      metrics={[
        { label: "Cadence", value: "Weekly updates" },
        { label: "Focus", value: "Reliability + quality" },
        { label: "Now", value: "v3.1.x hardening" },
      ]}
      sections={[
        {
          title: "Now in progress",
          cards: [
            {
              kicker: "Reliability",
              title: "Smarter LinkedIn page-state handling",
              description: "Reduce refresh loops and sticky job state issues on long runs across paginated search results.",
            },
            {
              kicker: "Validation",
              title: "Field-level error feedback",
              description: "Push exact validation messages from Easy Apply into dashboard answer flows for faster correction.",
            },
            {
              kicker: "Sync",
              title: "Cross-surface preference consistency",
              description: "Keep dashboard, extension, and active run settings aligned for search term + location behavior.",
            },
          ],
        },
        {
          title: "Next up",
          cards: [
            {
              kicker: "Targeting",
              title: "Better role-fit ranking",
              description: "Improve ranking of jobs by skill/experience overlap to prioritize stronger applications first.",
            },
            {
              kicker: "Workflow",
              title: "Saved strategy presets",
              description: "Store reusable search + filter strategies for different role tracks and geographies.",
            },
            {
              kicker: "Reporting",
              title: "Weekly performance digest",
              description: "Get summary insights for submitted, skipped reasons, and interview conversion trend.",
            },
          ],
        },
        {
          title: "Planned",
          bullets: [
            "Team workspace improvements for coach-led workflows.",
            "Extended interview preparation module with targeted question packs.",
            "Public API endpoints for external reporting and automation hooks.",
          ],
        },
        {
          title: "Recently shipped",
          cards: [
            {
              kicker: "September 2026",
              title: "Chrome Web Store release (v3.1.x)",
              description: "The LinkedIn Copilot installs directly from the Chrome Web Store, with tighter permissions and no manual package loading.",
            },
            {
              kicker: "September 2026",
              title: "Extension status in the jobs dashboard",
              description: "The dashboard now shows whether the extension is installed and links straight to the install page when it is not.",
            },
            {
              kicker: "September 2026",
              title: "Pro plan and billing updates",
              description: "A ₹49 per month Pro plan with unlimited auto-apply, plus clearer plan and billing screens.",
            },
            {
              kicker: "August 2026",
              title: "Rebuilt dashboard",
              description: "A modular dashboard for profile, analytics, settings, and job management.",
            },
          ],
        },
      ]}
      ctaTitle="Want to influence the roadmap?"
      ctaDescription="Share the most painful workflow blockers and we will prioritize based on user impact."
      primaryAction={{ label: "Contact Product Team", to: "/contact" }}
      secondaryAction={{ label: "Join Community", to: "/community" }}
    />
  );
}
