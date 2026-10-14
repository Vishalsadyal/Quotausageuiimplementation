import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function PrivacyPolicy() {
  return (
    <MarketingInfoPage
      eyebrow="Privacy Policy"
      title="How AutoApply CV handles your data"
      description="This summary explains what we collect, why we collect it, and the controls you have over your account data."
      metrics={[{ label: "Last updated", value: "October 14, 2026" }]}
      sections={[
        {
          title: "Data we collect",
          bullets: [
            "Account details such as name, email, and authentication metadata.",
            "Profile and screening answers you explicitly save in the product.",
            "Automation outcome logs (applied, skipped, failed) tied to your account.",
            "Billing metadata required for plans, top-ups, and transaction records.",
          ],
        },
        {
          title: "How data is used",
          bullets: [
            "To run requested product workflows and sync your settings to the extension.",
            "To diagnose failed runs, validation errors, and support requests.",
            "To improve platform reliability, analytics, and product experience.",
            "To meet legal, fraud prevention, and billing compliance obligations.",
          ],
        },
        {
          title: "Your controls",
          bullets: [
            "Edit or remove saved answers and profile fields from your dashboard.",
            "Revoke extension-linked data by logging out and clearing extension settings.",
            "Request account deletion by contacting support with your registered email.",
          ],
        },
        {
          title: "Resumes and AI processing",
          bullets: [
            "Resumes you upload and profile details you enter are stored with your account.",
            "To parse resumes, tailor them for applicant tracking systems, and suggest answers to screening questions, the relevant text is sent to AI service providers (currently Groq and OpenAI) for processing.",
            "AI features only use the information you provide. They do not invent experience on your behalf.",
          ],
        },
        {
          title: "HR Contacts (recruiter contact details)",
          bullets: [
            "When you send a WhatsApp message or email to a recruiter with the AutoApply CV extension, the recruiter's name, phone number or email, company, the role they posted and a link to their public LinkedIn post are added to a shared HR Contacts list.",
            "We only add contact details that a recruiter published in a public hiring post, and only after a user actually messaged them.",
            "Pro Connect members receive up to 20 of these contacts a day, matched to their target roles. We limit how many members receive the same contact each week, and contacts that are not seen again within 90 days stop being shared.",
            "Whether a number is on WhatsApp is recorded only from real messages users sent. We never send test messages.",
            "You can stop the recruiters you message from being added at any time with the \"Share recruiters I message\" switch on the HR Contacts page of your dashboard. It is on by default.",
            "Recruiters can have their phone number or email removed and blocked from being added again at autoapplycv.in/remove-my-contact. We keep only a one-way hash of removed details so they are not re-added.",
          ],
        },
        {
          title: "LinkedIn login details",
          bullets: [
            "Saving your LinkedIn login in AutoApply CV is optional.",
            "If you save it, it is encrypted before it is stored and is only used for automation you start.",
            "To have saved login details removed, contact support from your registered email.",
          ],
        },
        {
          title: "Third-party services",
          cards: [
            {
              kicker: "Payments",
              title: "Razorpay",
              description: "Processes plan and top-up payments. Card and bank details are entered with Razorpay and are not stored by AutoApply CV.",
            },
            {
              kicker: "Analytics",
              title: "Google Analytics, Tag Manager and Microsoft Clarity",
              description: "Help us understand how the site is used. They only run with your consent, which you can change at any time.",
            },
            {
              kicker: "Advertising",
              title: "Google AdSense",
              description: "May show ads on public pages. Ad personalization only happens with your consent.",
            },
            {
              kicker: "Infrastructure",
              title: "Hosting, database and email",
              description: "Store account data and deliver login codes and product emails needed to run the service.",
            },
          ],
        },
        {
          title: "Cookies",
          bullets: [
            "Essential cookies keep you signed in and protect the service.",
            "Analytics and advertising cookies are only used with your consent.",
            "See the Cookie Policy for details, and use Cookie settings in the footer to change your choice.",
          ],
        },
        {
          title: "Security",
          bullets: [
            "Account passwords are stored as one-way hashes, never in plain text.",
            "Sensitive saved values such as LinkedIn login details are encrypted at rest.",
            "All traffic to autoapplycv.in is served over HTTPS.",
          ],
        },
      ]}
      ctaTitle="Questions about privacy handling?"
      ctaDescription="Contact support and include your account email so we can respond with account-specific guidance."
      primaryAction={{ label: "Contact Support", to: "/contact" }}
      secondaryAction={{ label: "Terms of Service", to: "/terms-of-service" }}
    />
  );
}
