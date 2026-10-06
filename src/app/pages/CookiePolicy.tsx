import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function CookiePolicy() {
  return (
    <MarketingInfoPage
      eyebrow="Cookie Policy"
      title="How cookies are used on AutoApply CV"
      description="Cookies and local storage are used to keep sessions active, remember preferences, and improve product stability."
      metrics={[{ label: "Last updated", value: "March 10, 2026" }]}
      sections={[
        {
          title: "Essential usage",
          bullets: [
            "Authentication and session continuity across dashboard workflows.",
            "Security checks and request validation for protected routes.",
            "Basic UI state persistence such as panel and navigation preferences.",
          ],
        },
        {
          title: "Product functionality usage",
          bullets: [
            "Remember extension setup state and public-page preferences.",
            "Preserve in-progress run context for reliability and recovery.",
            "Support diagnostic logging used to resolve user-reported issues.",
          ],
        },
        {
          title: "Analytics cookies and consent",
          bullets: [
            "Analytics cookies are only used with your consent, to understand how the site is used and improve it.",
            "Essential cookies for security and session management are always active.",
            "Change your choice at any time with the Cookie settings link in the site footer.",
          ],
        },
        {
          title: "How to control cookies",
          bullets: [
            "You can clear site data from browser settings at any time.",
            "Blocking essential cookies may break login and dashboard behavior.",
            "For account-level data questions, contact support directly.",
          ],
        },
      ]}
      ctaTitle="Need a data handling clarification?"
      ctaDescription="Support can explain how browser storage and account data interact in your workflow."
      primaryAction={{ label: "Contact Support", to: "/contact" }}
      secondaryAction={{ label: "Privacy Policy", to: "/privacy-policy" }}
    />
  );
}
