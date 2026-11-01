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
          description: "AutoApply CV is an AI job search platform that helps software engineers and tech professionals apply to LinkedIn Easy Apply, Naukri, and Indeed jobs faster without losing control. Its Chrome extension fills repetitive application forms with saved, truthful answers, skips jobs the user already applied to, and pauses when a question needs human input, while the dashboard tailors resumes for applicant tracking systems and tracks every application from submission to interview. The Pro Connect plan adds daily recruiter contacts from public LinkedIn hiring posts and Interview Call AI, which shows short answers from the user's own notes during live calls.",
        },
        {
          title: "Product facts",
          bullets: [
            "Product: AutoApply CV, a web dashboard plus the AutoApply CV Chrome extension (works on LinkedIn, Naukri, and Indeed).",
            "Distribution: Chrome Web Store.",
            "Platforms: LinkedIn Easy Apply; Naukri (applies with Naukri's own Apply and answers its recruiter chatbot); Indeed (\"Easily apply\" jobs only). All from the same Chrome extension.",
            "Pricing: Free plan with 3 auto-apply actions per day plus 30 Hires signup bonus; Pro at ₹99 per month for unlimited auto-apply; Pro Connect at ₹500 per month (Pro plus HR Contacts and Interview Call AI); pay-as-you-go Hires wallet.",
            "Core features: LinkedIn, Naukri, and Indeed auto-apply, answer bank, duplicate prevention, WhatsApp and email recruiter outreach, HR Contacts (20 recruiter contacts a day on Pro Connect), Interview Call AI, LinkedIn auto-commenter, AI resume tailoring, application tracker.",
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
