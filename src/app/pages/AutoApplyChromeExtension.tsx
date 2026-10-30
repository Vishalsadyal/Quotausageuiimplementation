import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function AutoApplyChromeExtension() {
  return (
    <MarketingInfoPage
      eyebrow="Chrome Extension Copilot"
      title="Free Auto Apply Chrome Extension for LinkedIn"
      description="Apply to jobs in 1 click with the AutoApply CV Chrome extension. An intelligent Easy Apply bot that sits alongside your browser, auto-fills screening questions from your answer bank, and logs applications directly to your dashboard."
      metrics={[
        { label: "Install Time", value: "< 30 sec", note: "Chrome Web Store verified" },
        { label: "Form Fill Accuracy", value: "98%", note: "Synced screening answer bank" },
        { label: "Account Protection", value: "100%", note: "Client-side human simulation" },
        { label: "Price", value: "Free", note: "Daily free auto apply credits" },
      ]}
      sections={[
        {
          title: "How the Auto Apply Chrome Extension Works",
          description:
            "Say goodbye to repetitive manual form filling on LinkedIn Easy Apply. Our Chrome extension acts as your personal job application assistant.",
          cards: [
            {
              kicker: "Live Assistant",
              title: "In-Browser Copilot Panel",
              description:
                "The extension opens alongside LinkedIn job postings, showing real-time form filling progress and match analysis.",
            },
            {
              kicker: "Answer Bank Sync",
              title: "Instant Screening Form Autofill",
              description:
                "Automatically inputs your salary requirements, visa authorization, years of experience, and custom answers into screening fields.",
            },
            {
              kicker: "Safe Automation",
              title: "Human Pacing & Pause-to-Review",
              description:
                "Employs natural typing delays and mouse pacing. Auto-pauses on unfamiliar questions so you maintain 100% control.",
            },
          ],
        },
        {
          title: "Key Features of the Auto Apply Extension",
          bullets: [
            "1-Click Easy Apply automation for LinkedIn jobs.",
            "Live status feedback showing exact form filling and submission progress.",
            "Automatic duplicate detection that skips jobs you've already applied to.",
            "Full resume and profile synchronization with your AutoApply CV cloud dashboard.",
            "Customizable application limits and delay pacing to safeguard your LinkedIn profile.",
            "Detailed application outcome logs (applied, skipped, pending) synced instantly.",
          ],
        },
        {
          title: "Frequently Asked Questions About the Extension",
          bullets: [
            "Where can I download the Auto Apply Chrome extension? You can install it directly from the Chrome Web Store or download the CRX package from your dashboard.",
            "Is the Chrome extension free to use? Yes. It includes free daily auto apply credits and full access to the screening answer bank.",
            "Does the extension read my personal passwords? No. It only accesses job posting and application form fields on supported job boards.",
            "How do I connect the extension to my account? Simply log in to autoapplycv.in, and the extension syncs your profile and answers automatically.",
          ],
        },
      ]}
      ctaTitle="Get the free Auto Apply Chrome extension"
      ctaDescription="Install in seconds, connect your answer bank, and let our copilot handle your LinkedIn applications."
      primaryAction={{ label: "Install Chrome Extension", to: "/signup" }}
      secondaryAction={{ label: "View Setup Guide", to: "/help-center" }}
    />
  );
}

