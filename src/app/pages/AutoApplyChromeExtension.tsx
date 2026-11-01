import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function AutoApplyChromeExtension() {
  return (
    <MarketingInfoPage
      eyebrow="Chrome Extension Copilot"
      title="Free Auto Apply Chrome Extension for LinkedIn, Naukri & Indeed"
      description="Apply to jobs in 1 click with the AutoApply CV Chrome extension. It opens a sidebar on LinkedIn, naukri.com, and Indeed, auto-fills screening questions from your answer bank, and logs applications directly to your dashboard."
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
            "Say goodbye to repetitive manual form filling on LinkedIn Easy Apply, Naukri, and Indeed. One Chrome extension acts as your personal job application assistant on all three.",
          cards: [
            {
              kicker: "Live Assistant",
              title: "In-Browser Copilot Panel",
              description:
                "The extension opens a sidebar alongside LinkedIn, Naukri, and Indeed job pages, showing real-time form filling progress and match analysis.",
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
            "Naukri auto-apply: applies to jobs with Naukri's own Apply button (skips \"Apply on company site\"), answers Naukri's recruiter chatbot from your answer bank or AI, asks you in the sidebar when it can't, and stays within Naukri's daily apply limit.",
            "Indeed auto-apply: applies only to \"Easily apply\" jobs in the same tab, fills screening questions, skips jobs where Indeed says you don't meet a required qualification, and pauses for \"verify you're human\" checks.",
            "Live status feedback showing exact form filling and submission progress.",
            "Automatic duplicate detection that skips jobs you've already applied to.",
            "Full resume and profile synchronization with your AutoApply CV cloud dashboard.",
            "Customizable application limits and delay pacing to safeguard your LinkedIn, Naukri, and Indeed accounts.",
            "WhatsApp and email outreach to recruiters who share contact details in LinkedIn hiring posts.",
            "Detailed application outcome logs (applied, skipped, pending) synced instantly.",
          ],
        },
        {
          title: "Frequently Asked Questions About the Extension",
          bullets: [
            "Where can I download the Auto Apply Chrome extension? You can install it directly from the Chrome Web Store or download the CRX package from your dashboard.",
            "Is the Chrome extension free to use? Yes. It includes 3 free auto-applies a day and full access to the screening answer bank. Each confirmed application on LinkedIn, Naukri, or Indeed uses 1 free daily apply or 1 Hire; Pro (₹99/month) is unlimited.",
            "Does the extension read my personal passwords? No. It only accesses job posting and application form fields on supported job boards.",
            "How do I connect the extension to my account? Simply log in to autoapplycv.in, and the extension syncs your profile and answers automatically.",
          ],
        },
      ]}
      ctaTitle="Get the free Auto Apply Chrome extension"
      ctaDescription="Install in seconds, connect your answer bank, and let our copilot handle your LinkedIn, Naukri, and Indeed applications."
      primaryAction={{ label: "Install Chrome Extension", to: "/signup" }}
      secondaryAction={{ label: "View Setup Guide", to: "/help-center" }}
    />
  );
}

