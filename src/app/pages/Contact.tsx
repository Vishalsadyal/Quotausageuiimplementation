import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function Contact() {
  return (
    <MarketingInfoPage
      eyebrow="Contact"
      title="Reach the right team quickly"
      description="Use the best channel below and include your account email + relevant job ID/run timestamp so we can diagnose issues faster."
      metrics={[
        { label: "Support response", value: "< 24h on business days" },
        { label: "Priority", value: "Paid users get queue priority" },
        { label: "Coverage", value: "Product, billing, technical support" },
      ]}
      sections={[
        {
          title: "Support channels",
          cards: [
            {
              kicker: "General support",
              title: "help@autoapplycv.in",
              description: "Account access, run behavior, answer sync, and dashboard questions.",
            },
            {
              kicker: "Billing",
              title: "billing@autoapplycv.in",
              description: "Plan changes, invoices, top-up questions, and transaction support.",
            },
            {
              kicker: "Partnerships",
              title: "partners@autoapplycv.in",
              description: "Coach workflows, collaboration opportunities, and integration inquiries.",
            },
          ],
        },
        {
          title: "When reporting automation issues, include",
          bullets: [
            "Extension version and browser version.",
            "A short log export or last 20 run log lines.",
            "The exact LinkedIn URL where behavior diverged.",
            "Whether the issue happened in jobs search or jobs view flow.",
          ],
        },
        {
          title: "Which channel should I use?",
          cards: [
            {
              kicker: "Login or account",
              title: "Email general support",
              description: "Include the email you signed up with. Never send your password or one-time login codes.",
            },
            {
              kicker: "Payments",
              title: "Email billing",
              description: "Include the payment date and the Razorpay order or payment ID shown on your receipt.",
            },
            {
              kicker: "Extension",
              title: "Check the Help Center first",
              description: "Install, sync, and validation issues usually have a documented fix you can apply in minutes.",
            },
          ],
        },
        {
          title: "What happens after you write to us",
          bullets: [
            "Your message is routed to the right team based on the address you used.",
            "We may ask for a log export or screenshot if an automation issue cannot be reproduced.",
            "Billing questions are checked against your payment record before any change is made.",
            "You will hear back by email at the address you wrote from.",
          ],
        },
      ]}
      ctaTitle="Need quick self-service help first?"
      ctaDescription="Most setup and run-flow questions are already documented."
      primaryAction={{ label: "Open Help Center", to: "/help-center" }}
      secondaryAction={{ label: "Read FAQ", to: "/faq" }}
    />
  );
}
