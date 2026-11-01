import MarketingInfoPage from "../components/marketing/MarketingInfoPage";
import FeatureLinks from "../components/marketing/FeatureLinks";
import { INDEED_FAQS, faqBullets } from "../seo/featureFaqs";

export default function IndeedAutoApply() {
  return (
    <>
      <MarketingInfoPage
        eyebrow="Indeed Auto Apply Bot"
        title="Indeed Auto Apply for “Easily Apply” Jobs"
        description="The AutoApply CV Chrome extension adds a sidebar to Indeed, searches with your filters and applies to “Easily apply” jobs in the same tab, filling screening questions from your answer bank. Built and tested on Indeed India (in.indeed.com)."
        metrics={[
          { label: "Free plan", value: "3 / day", note: "Plus 30 Hires on signup" },
          { label: "Pro", value: "₹99/month", note: "Unlimited auto-applies" },
          { label: "Pace", value: "20–45 sec", note: "Between each job" },
          { label: "Jobs applied to", value: "Easily apply", note: "Indeed's own form only" },
        ]}
        sections={[
          {
            title: "How Indeed auto apply works",
            description:
              "Set your search once in the dashboard. The extension runs the Indeed search, opens each job and fills Indeed's application form while you watch in the sidebar.",
            cards: [
              {
                kicker: "Step 1",
                title: "Install the extension and sign in",
                description:
                  "Add the AutoApply CV Chrome extension, log in to your AutoApply CV account, and make sure you are logged in to Indeed in the same browser.",
              },
              {
                kicker: "Step 2",
                title: "Set your Indeed search",
                description:
                  "In the dashboard, choose job titles, location and radius, date posted, Remote or Hybrid, job type, experience, skills, exclude words and blacklisted companies.",
              },
              {
                kicker: "Step 3",
                title: "Save your screening answers",
                description:
                  "Add answers to common employer questions such as notice period, expected salary, work authorization and willingness to relocate. Your years of experience come from your profile.",
              },
              {
                kicker: "Step 4",
                title: "Start from the sidebar",
                description:
                  "Open Indeed and press start. The extension searches with your filters and works through “Easily apply” results in the same tab, one job at a time.",
              },
              {
                kicker: "Step 5",
                title: "It fills and submits the form",
                description:
                  "Screening questions are answered from your answer bank or with AI, experience questions with your years, and the application is submitted on Indeed's own form.",
              },
              {
                kicker: "Step 6",
                title: "See it in your tracker",
                description:
                  "Each confirmed application is logged in the Applications tracker on your dashboard, together with your LinkedIn and Naukri applications.",
              },
            ],
          },
          {
            title: "Built to skip the jobs you shouldn't apply to",
            description:
              "An Indeed easily apply bot is only useful if it sends good applications. These checks run on every job before anything is submitted.",
            bullets: [
              "Only “Easily apply” jobs. Listings that send you to a company website are skipped.",
              "If Indeed says you don't meet a required qualification, the job is skipped instead of sending an application that will be rejected.",
              "Jobs you have already applied to on Indeed are skipped, so there are no duplicates.",
              "Jobs containing your exclude words, or from companies on your blacklist, are never applied to.",
              "Human pace: it waits 20 to 45 seconds between jobs instead of firing off applications back to back.",
              "If Indeed shows a “verify you're human” check, the extension pauses until you complete it yourself.",
            ],
          },
          {
            title: "What Indeed auto apply costs",
            description:
              "Indeed shares the same daily applies and Hires as LinkedIn and Naukri. You are charged only for applications that are actually submitted.",
            cards: [
              {
                kicker: "Free",
                title: "₹0",
                description:
                  "3 auto-applies a day plus 30 Hires on signup. Each confirmed Indeed application uses 1 free daily apply, or 1 Hire after that.",
              },
              {
                kicker: "Pro",
                title: "₹99/month",
                description: "Unlimited auto-applies on Indeed, LinkedIn and Naukri, with no Hires spent.",
              },
              {
                kicker: "Pro Connect",
                title: "₹500/month",
                description:
                  "Everything in Pro, plus 20 matched HR contacts a day with WhatsApp numbers, and Interview Call AI.",
              },
            ],
          },
          {
            title: "Good to know",
            bullets: [
              "Indeed support was built and tested on in.indeed.com, so it is the best choice for auto applying to Indeed jobs in India.",
              "It works in your own logged-in browser. AutoApply CV never asks for your Indeed password.",
              "Every confirmed application is logged in your dashboard tracker with the role, company and date, so you can follow up.",
            ],
          },
          {
            title: "Indeed auto apply FAQ",
            bullets: faqBullets(INDEED_FAQS),
          },
        ]}
        ctaTitle="Auto apply to Indeed jobs with your own answers"
        ctaDescription="Sign up free, set your Indeed search and let the extension handle “Easily apply” forms. 3 free auto-applies a day, no card needed."
        primaryAction={{ label: "Sign up free", to: "/signup" }}
        secondaryAction={{ label: "Get the Chrome extension", to: "/auto-apply-chrome-extension" }}
      />
      <FeatureLinks current="/indeed-auto-apply" />
    </>
  );
}
