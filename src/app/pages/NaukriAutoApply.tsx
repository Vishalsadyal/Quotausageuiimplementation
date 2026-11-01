import MarketingInfoPage from "../components/marketing/MarketingInfoPage";
import FeatureLinks from "../components/marketing/FeatureLinks";
import { NAUKRI_FAQS, faqBullets } from "../seo/featureFaqs";

export default function NaukriAutoApply() {
  return (
    <>
      <MarketingInfoPage
        eyebrow="Naukri Auto Apply Extension"
        title="Naukri Auto Apply: Apply to Matching Naukri Jobs Automatically"
        description="The AutoApply CV Chrome extension opens a sidebar on naukri.com, finds jobs that match your filters, applies with Naukri's own Apply button and answers the recruiter chatbot for you. The same extension you use for LinkedIn and Indeed."
        metrics={[
          { label: "Free plan", value: "3 / day", note: "Plus 30 Hires on signup" },
          { label: "Pro", value: "₹99/month", note: "Unlimited auto-applies" },
          { label: "Chatbot questions", value: "Answered", note: "Answer bank first, then AI" },
          { label: "Naukri daily limit", value: "Respected", note: "Stops when Naukri's limit is hit" },
        ]}
        sections={[
          {
            title: "How Naukri auto apply works",
            description:
              "You set your filters once in the dashboard. The extension does the searching, clicking and chatbot replies on naukri.com while you watch it in the sidebar.",
            cards: [
              {
                kicker: "Step 1",
                title: "Install the extension and sign in",
                description:
                  "Add the AutoApply CV Chrome extension and log in to your AutoApply CV account. Then log in to Naukri in the same browser as you normally would.",
              },
              {
                kicker: "Step 2",
                title: "Set your job filters",
                description:
                  "In the dashboard, choose job titles, skills and keywords, words to exclude, companies to blacklist, years of experience, location, work mode, date posted and salary.",
              },
              {
                kicker: "Step 3",
                title: "Fill your answer bank",
                description:
                  "Save answers to the questions Naukri recruiters ask most: notice period, current and expected CTC, current location, relocation, total experience.",
              },
              {
                kicker: "Step 4",
                title: "Start from the sidebar",
                description:
                  "Open naukri.com and press start in the AutoApply CV sidebar. It searches with your filters and opens each matching job one at a time.",
              },
              {
                kicker: "Step 5",
                title: "It applies and answers the chatbot",
                description:
                  "On jobs with Naukri's own Apply button it applies, then replies to the recruiter chatbot from your answer bank or with AI. If it is unsure, it asks you in the sidebar.",
              },
              {
                kicker: "Step 6",
                title: "Track every application",
                description:
                  "Each confirmed application appears in the Applications tracker on your dashboard with the role, company and date, alongside your LinkedIn and Indeed applications.",
              },
            ],
          },
          {
            title: "What the Naukri auto apply extension does (and doesn't)",
            description:
              "It is built to send applications you would have sent yourself, not to spray every listing on the site.",
            bullets: [
              "Applies only to jobs with Naukri's own Apply button. \"Apply on company site\" jobs are skipped because they leave Naukri.",
              "Answers Naukri's recruiter chatbot questions from your saved answers first, and uses AI with your profile only when there is no saved answer.",
              "Asks you in the sidebar when it is not confident about an answer, then remembers what you said for the next job.",
              "Skips jobs whose title or description contains your exclude words, and never applies to companies on your blacklist.",
              "Stays within Naukri's daily apply limit and moves at a human-like pace, with pauses between jobs.",
              "Runs in your own logged-in browser session. Your Naukri password is never asked for or stored by AutoApply CV.",
            ],
          },
          {
            title: "What Naukri auto apply costs",
            description:
              "Naukri, LinkedIn and Indeed share the same daily applies and Hires. Nothing is charged for jobs that are skipped or fail.",
            cards: [
              {
                kicker: "Free",
                title: "₹0",
                description:
                  "3 auto-applies a day plus 30 Hires on signup. Each confirmed Naukri application uses 1 free daily apply, or 1 Hire once the daily applies are used.",
              },
              {
                kicker: "Pro",
                title: "₹99/month",
                description:
                  "Unlimited auto-applies on Naukri, LinkedIn and Indeed. No Hires are spent. You are still limited by Naukri's own daily apply cap.",
              },
              {
                kicker: "Pro Connect",
                title: "₹500/month",
                description:
                  "Everything in Pro, plus 20 matched HR contacts a day with WhatsApp numbers, and Interview Call AI for live interviews.",
              },
            ],
          },
          {
            title: "Who it is for",
            bullets: [
              "Freshers and early-career candidates applying to many similar roles on Naukri every day.",
              "Experienced professionals who want Naukri applications to keep going while they work, without answering the same chatbot questions again and again.",
              "Anyone already using AutoApply CV for LinkedIn who wants Naukri covered from the same dashboard and tracker.",
              "Job seekers who want one tracker for every application, whichever job site it was sent on.",
            ],
          },
          {
            title: "Naukri auto apply FAQ",
            bullets: faqBullets(NAUKRI_FAQS),
          },
        ]}
        ctaTitle="Start auto applying to Naukri jobs"
        ctaDescription="Sign up free, set your filters and let the extension apply on Naukri with your answers. 3 free auto-applies a day, no card needed."
        primaryAction={{ label: "Sign up free", to: "/signup" }}
        secondaryAction={{ label: "Get the Chrome extension", to: "/auto-apply-chrome-extension" }}
      />
      <FeatureLinks current="/naukri-auto-apply" />
    </>
  );
}
