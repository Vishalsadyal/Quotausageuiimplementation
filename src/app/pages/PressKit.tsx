import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function PressKit() {
  return (
    <MarketingInfoPage
      eyebrow="Press Kit"
      title="Brand and product facts for media use"
      description="Everything needed for coverage, product listings, and reference links in one place."
      sections={[
        {
          title: "Company summary",
          cards: [
            {
              kicker: "What we do",
              title: "AI-assisted job search execution",
              description: "AutoApply CV helps users run high-quality applications with automation controls, resume optimization, and tracking.",
            },
            {
              kicker: "Primary audience",
              title: "Software engineers and tech professionals",
              description: "Designed for users who need speed without sacrificing quality or review control.",
            },
            {
              kicker: "Website",
              title: "https://www.autoapplycv.in",
              description: "Canonical public site and product onboarding entry point.",
            },
          ],
        },
        {
          title: "Brand assets",
          bullets: [
            "Wordmark: AutoApply CV",
            "Primary logo files: PNG app icons in /public/logos",
            "Recommended primary color: #6047f5",
            "Tagline: Apply smarter, not blindly.",
          ],
        },
        {
          title: "Press inquiries",
          cards: [
            {
              kicker: "Media",
              title: "press@autoapplycv.in",
              description: "Interview requests, product announcements, and launch coverage requests.",
            },
          ],
        },
        {
          title: "Boilerplate",
          description: "AutoApply CV is an AI job search platform that helps software engineers and tech professionals apply to LinkedIn Easy Apply jobs faster without losing control. Its Chrome extension fills repetitive application forms with saved, truthful answers, skips jobs the user already applied to, and pauses when a question needs human input, while the dashboard tailors resumes for applicant tracking systems and tracks every application from submission to interview.",
        },
        {
          title: "Product facts",
          bullets: [
            "Product: AutoApply CV, a web dashboard plus the AutoApply CV LinkedIn Copilot Chrome extension.",
            "Distribution: Chrome Web Store.",
            "Platforms: LinkedIn Easy Apply, with Indeed applications tracked in the same dashboard.",
            "Pricing: Free plan with 3 auto-apply actions per day; Pro at ₹49 per month for unlimited auto-apply; pay-as-you-go Hires wallet.",
            "Core features: Easy Apply automation, answer bank, duplicate prevention, AI resume tailoring, application tracker, interview preparation.",
          ],
        },
        {
          title: "Logo usage",
          bullets: [
            "Use the logo files as provided, without stretching, recoloring, or adding effects.",
            "Leave clear space around the logo equal to at least half its height.",
            "Write the name as AutoApply CV, with a space before CV.",
          ],
        },
      ]}
      ctaTitle="Need custom assets or a statement?"
      ctaDescription="Send publication details and deadlines so we can respond with the right format quickly."
      primaryAction={{ label: "Contact Press Team", to: "/contact" }}
      secondaryAction={{ label: "About Company", to: "/about" }}
    />
  );
}
