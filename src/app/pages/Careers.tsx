import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function Careers() {
  return (
    <MarketingInfoPage
      eyebrow="Careers"
      title="Help build the job search platform people trust"
      description="We are building practical automation tools for modern job seekers. If you like shipping product with real user feedback, we should talk."
      metrics={[
        { label: "Work style", value: "Remote-first" },
        { label: "Team model", value: "Small, senior, shipping-focused" },
        { label: "Hiring focus", value: "Product + engineering + growth" },
      ]}
      sections={[
        {
          title: "Why join",
          bullets: [
            "Direct customer impact with short feedback loops.",
            "Ownership over end-to-end product areas, not isolated tickets.",
            "Pragmatic engineering culture focused on reliability and outcomes.",
            "Transparent roadmap prioritization tied to user pain points.",
          ],
        },
        {
          title: "Open roles",
          cards: [
            {
              kicker: "Engineering",
              title: "Frontend Engineer (React + TypeScript)",
              description: "Own UX reliability for public pages and dashboard workflows with production-grade polish.",
            },
            {
              kicker: "Engineering",
              title: "Automation Engineer",
              description: "Improve browser workflow robustness, validation handling, and run-state recovery behavior.",
            },
            {
              kicker: "Product/Growth",
              title: "Product Growth Analyst",
              description: "Drive activation, retention, and conversion improvements using event data and experiment design.",
            },
          ],
        },
        {
          title: "What we look for",
          bullets: [
            "You have shipped real products and can show the work: links, repositories, or write-ups.",
            "You care about the people using the product, not just the code or the metric.",
            "You write clearly. Most decisions are made in writing in a remote-first team.",
            "You are comfortable owning a problem end to end, from investigation to release.",
          ],
        },
        {
          title: "How to apply",
          bullets: [
            "Email the team through the contact page with the role name in the subject line.",
            "Include your resume or LinkedIn profile and two or three links to work you are proud of.",
            "Add a few sentences on the problem area you would want to own at AutoApply CV.",
            "If there is no open role that fits, tell us anyway. We keep strong profiles on file.",
          ],
        },
      ]}
      ctaTitle="No matching role right now?"
      ctaDescription="Send a short note with your profile and the problem area you want to own."
      primaryAction={{ label: "Contact Hiring Team", to: "/contact" }}
      secondaryAction={{ label: "Read About Us", to: "/about" }}
    />
  );
}
