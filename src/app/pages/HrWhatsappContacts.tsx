import MarketingInfoPage from "../components/marketing/MarketingInfoPage";
import FeatureLinks from "../components/marketing/FeatureLinks";
import { HR_CONTACTS_FAQS, faqBullets } from "../seo/featureFaqs";

export default function HrWhatsappContacts() {
  return (
    <>
      <MarketingInfoPage
        eyebrow="HR Contacts · Pro Connect"
        title="Direct HR WhatsApp Numbers for Your Job Search"
        description="Get 20 new recruiter contacts every day, matched to the roles you want: WhatsApp-checked HR numbers and recruiter emails that recruiters shared publicly in their LinkedIn hiring posts. Emailed to you every morning, and free to message in one click."
        metrics={[
          { label: "New contacts", value: "20 / day", note: "Matched to your job roles" },
          { label: "Phone numbers", value: "WhatsApp-checked", note: "Plus recruiter emails" },
          { label: "Delivery", value: "Every morning", note: "Straight to your inbox" },
          { label: "Plan", value: "₹500/month", note: "Pro Connect, includes Pro" },
        ]}
        sections={[
          {
            title: "How HR Contacts works",
            description:
              "Recruiters across India post openings on LinkedIn with “DM me” or “share your CV on WhatsApp” and their number or email. We collect those public posts so you can reach the person hiring directly.",
            cards: [
              {
                kicker: "Step 1",
                title: "Choose Pro Connect",
                description:
                  "Sign up and pick the Pro Connect plan. Add the job roles you are targeting to your profile so the contacts can be matched to them.",
              },
              {
                kicker: "Step 2",
                title: "We find hiring recruiters",
                description:
                  "Recruiter phone numbers and emails are taken from public LinkedIn hiring posts. Phone numbers are checked to be on WhatsApp before you get them.",
              },
              {
                kicker: "Step 3",
                title: "20 contacts every morning",
                description:
                  "Each day you get 20 new recruiter contacts matched to your roles, emailed to you at about 9 AM IST and listed on the HR Contacts page of your dashboard.",
              },
              {
                kicker: "Step 4",
                title: "Message them in one click",
                description:
                  "Open a contact and message the recruiter on WhatsApp or email in one click. Messaging is free; there are no per-message charges.",
              },
            ],
          },
          {
            title: "Why a direct HR contact for jobs works",
            bullets: [
              "A short message to the recruiter who posted the opening is read by a person, not filtered out with hundreds of portal applications.",
              "Every contact comes from a hiring post, so the recruiter was actively looking for candidates when they shared it.",
              "Contacts are matched to your target roles, so you are not scrolling through numbers for jobs you would never take.",
              "WhatsApp-checked numbers mean less time wasted on numbers that aren't on WhatsApp.",
              "Use it next to auto apply: let the extension handle LinkedIn, Naukri and Indeed applications while you follow up with recruiters directly.",
            ],
          },
          {
            title: "Tips for messaging recruiters on WhatsApp",
            bullets: [
              "Keep the first message short: the role you are interested in, your total experience, notice period and current location.",
              "Mention the post you saw so the recruiter knows which opening you mean.",
              "Attach or link your resume in the same message instead of waiting to be asked.",
              "Message during working hours and don't send repeated follow-ups on the same day.",
            ],
          },
          {
            title: "What HR Contacts costs",
            description: "HR Contacts is only on the Pro Connect plan.",
            cards: [
              {
                kicker: "Pro Connect",
                title: "₹500/month",
                description:
                  "20 matched recruiter contacts a day, emailed every morning, free one-click messaging, Interview Call AI, and everything in Pro.",
              },
              {
                kicker: "Pro",
                title: "₹99/month",
                description: "Unlimited auto-applies on LinkedIn, Naukri and Indeed. Does not include HR Contacts.",
              },
              {
                kicker: "Free",
                title: "₹0",
                description: "3 auto-applies a day plus 30 Hires on signup. Does not include HR Contacts.",
              },
            ],
          },
          {
            title: "For recruiters",
            description:
              "If you are a recruiter or HR professional and don't want your number or email shared, go to /remove-my-contact. It takes under a minute and your details are taken out of the recruiter contacts.",
          },
          {
            title: "HR Contacts FAQ",
            bullets: faqBullets(HR_CONTACTS_FAQS),
          },
        ]}
        ctaTitle="Get 20 recruiter contacts in your inbox tomorrow morning"
        ctaDescription="HR Contacts comes with Pro Connect at ₹500/month, together with Interview Call AI and unlimited auto apply."
        primaryAction={{ label: "Get Pro Connect", to: "/signup?plan=connect" }}
        secondaryAction={{ label: "Compare plans", to: "/pricing" }}
      />
      <FeatureLinks current="/hr-whatsapp-contacts" />
    </>
  );
}
