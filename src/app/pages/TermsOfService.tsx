import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function TermsOfService() {
  return (
    <MarketingInfoPage
      eyebrow="Terms of Service"
      title="Usage terms for AutoApply CV"
      description="By using the platform, you agree to responsible use, account security practices, and applicable payment terms."
      metrics={[{ label: "Last updated", value: "October 6, 2026" }]}
      sections={[
        {
          title: "Account responsibilities",
          bullets: [
            "Use accurate information and keep your credentials secure.",
            "You are responsible for actions performed from your account and extension session.",
            "Do not use the service for unlawful, abusive, or deceptive activity.",
          ],
        },
        {
          title: "Platform usage",
          bullets: [
            "Auto-apply tools are provided to improve workflow speed, not to guarantee outcomes.",
            "You should review settings and run behavior before high-volume execution.",
            "We may limit or suspend abusive usage that risks platform integrity.",
          ],
        },
        {
          title: "Billing and plans",
          bullets: [
            "Paid plans, top-ups, and credits follow the pricing shown at checkout.",
            "Usage deductions are based on submitted application actions and plan policy.",
            "Refund and dispute handling follows the applicable billing policy and law.",
          ],
        },
        {
          title: "Free plan, Pro and Hires credits",
          bullets: [
            "The Free plan includes 3 auto-apply actions per day.",
            "Pro costs ₹49 per month for unlimited auto-apply, paid through Razorpay at checkout.",
            "Hires credits are pay as you go: 1 Hire is used for 1 successfully submitted application.",
            "Jobs that are skipped (external apply, already applied, validation errors) or runs you stop before submitting do not use an apply action or Hire credit.",
          ],
        },
        {
          title: "Your information and answers",
          bullets: [
            "You are responsible for the accuracy of your profile, resume, and saved screening answers.",
            "Only save answers you are willing to submit to employers. Automation submits what you provide.",
            "Employers decide how to evaluate applications. AutoApply CV does not guarantee interviews or offers.",
          ],
        },
        {
          title: "Third-party job platforms",
          bullets: [
            "LinkedIn, Indeed, and employer websites are third-party services with their own terms.",
            "You are responsible for using automation on those platforms in line with their terms, including keeping volumes reasonable.",
            "Third-party platforms can change their pages at any time, which may temporarily affect automation.",
          ],
        },
        {
          title: "Changes to the service and these terms",
          bullets: [
            "We may add, change, or remove features to improve the service.",
            "When these terms change, the Last updated date on this page will change.",
            "Continuing to use the service after an update means you accept the updated terms.",
          ],
        },
      ]}
      ctaTitle="Need clarification on a specific term?"
      ctaDescription="Contact support with the exact clause or workflow scenario you want clarified."
      primaryAction={{ label: "Contact Support", to: "/contact" }}
      secondaryAction={{ label: "Privacy Policy", to: "/privacy-policy" }}
    />
  );
}
