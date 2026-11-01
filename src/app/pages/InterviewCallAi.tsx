import MarketingInfoPage from "../components/marketing/MarketingInfoPage";
import FeatureLinks from "../components/marketing/FeatureLinks";
import { INTERVIEW_CALL_AI_FAQS, faqBullets } from "../seo/featureFaqs";

export default function InterviewCallAi() {
  return (
    <>
      <MarketingInfoPage
        eyebrow="Interview Call AI · Pro Connect"
        title="Interview Call AI: Your Live AI Interview Assistant"
        description="Keep Interview Call AI open during an interview or client call. It listens, and when the other person stops talking it shows a short answer to their question, built from your own notes. Works with any call app, in English, Hindi or Hinglish."
        metrics={[
          { label: "Call apps", value: "Any", note: "Zoom, Meet, Teams, phone on speaker" },
          { label: "Languages", value: "3", note: "English, Hindi, Hinglish" },
          { label: "Install", value: "None", note: "Runs in your dashboard tab" },
          { label: "Saved from your call", value: "Nothing", note: "No recording kept" },
        ]}
        sections={[
          {
            title: "How Interview Call AI works",
            description:
              "Think of it as an interview copilot that only knows what you tell it: your experience, your projects and the points you want to make.",
            cards: [
              {
                kicker: "Step 1",
                title: "Add your notes",
                description:
                  "Open Interview Call AI in your AutoApply CV dashboard and add your notes: your resume highlights, projects, numbers you want to mention, and answers you have prepared.",
              },
              {
                kicker: "Step 2",
                title: "Join your call as usual",
                description:
                  "Start the interview or client call in Zoom, Google Meet, Microsoft Teams, or on your phone with the speaker on. Nothing changes about how you join.",
              },
              {
                kicker: "Step 3",
                title: "Keep the page open",
                description:
                  "Start listening on the Interview Call AI page and keep it open next to your call. It hears the conversation through your microphone, so use laptop speakers instead of headphones, or put your phone on speaker next to the laptop.",
              },
              {
                kicker: "Step 4",
                title: "Read the short answer",
                description:
                  "When the interviewer or client finishes a question and stops talking, a short answer appears on screen, based on your notes. Glance at it and answer in your own words.",
              },
            ],
          },
          {
            title: "Why use a live interview answers AI",
            bullets: [
              "Answers come from your own notes, so what you see on screen matches your real experience instead of generic text.",
              "Answers are short on purpose: a few key points you can glance at, not a paragraph you have to read out.",
              "It waits until the other person stops talking, so answers don't jump around while the question is still being asked.",
              "Understands English, Hindi and Hinglish, which suits most interviews and client calls in India.",
              "No extension and no meeting bot joins your call. It is just a page in your dashboard.",
              "Nothing from the call is saved. Close the page and the conversation is gone.",
            ],
          },
          {
            title: "Where it helps",
            cards: [
              {
                kicker: "Job interviews",
                title: "HR and technical rounds",
                description:
                  "Keep your project details, numbers and prepared answers in front of you when a question catches you off guard.",
              },
              {
                kicker: "Client calls",
                title: "Sales and freelance calls",
                description:
                  "Add notes about your service, pricing and past work, and get a short prompt when a client asks something you have covered in them.",
              },
              {
                kicker: "Practice",
                title: "Mock interviews",
                description:
                  "Run it during a practice call with a friend to see which questions your notes don't cover yet, then add to them.",
              },
            ],
          },
          {
            title: "What Interview Call AI costs",
            description:
              "Interview Call AI is part of the Pro Connect plan. It is not on the Free or Pro plans.",
            cards: [
              {
                kicker: "Pro Connect",
                title: "₹500/month",
                description:
                  "Interview Call AI, plus 20 matched HR contacts with WhatsApp numbers every day, plus everything in Pro, including unlimited auto-applies on LinkedIn, Naukri and Indeed.",
              },
              {
                kicker: "Pro",
                title: "₹99/month",
                description: "Unlimited auto-applies. Does not include Interview Call AI or HR Contacts.",
              },
              {
                kicker: "Free",
                title: "₹0",
                description: "3 auto-applies a day plus 30 Hires on signup, the application tracker and resume tools.",
              },
            ],
          },
          {
            title: "Interview Call AI FAQ",
            bullets: faqBullets(INTERVIEW_CALL_AI_FAQS),
          },
        ]}
        ctaTitle="Walk into your next interview with your notes on screen"
        ctaDescription="Interview Call AI comes with Pro Connect at ₹500/month, together with daily HR contacts and unlimited auto apply."
        primaryAction={{ label: "Get Pro Connect", to: "/signup?plan=connect" }}
        secondaryAction={{ label: "Compare plans", to: "/pricing" }}
      />
      <FeatureLinks current="/interview-call-ai" />
    </>
  );
}
