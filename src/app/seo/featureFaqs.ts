// FAQs for the feature landing pages. The pages render these and seoConfig turns the same
// list into FAQPage JSON-LD, so the visible answers and the structured data never drift apart.
// Prices must match src/lib/plans.ts (Pro ₹99/month, Pro Connect ₹500/month).

export type FeatureFaq = { question: string; answer: string };

export const NAUKRI_FAQS: FeatureFaq[] = [
  {
    question: "Is there a free Naukri auto apply tool?",
    answer:
      "Yes. The AutoApply CV Chrome extension auto applies to Naukri jobs on the free plan: 3 auto-applies a day plus 30 Hires on signup. Pro (₹99/month) makes it unlimited.",
  },
  {
    question: "Which Naukri jobs does it apply to?",
    answer:
      "Only jobs that use Naukri's own Apply button and match your dashboard filters. Jobs that say \"Apply on company site\" are skipped, because they leave Naukri.",
  },
  {
    question: "How does it answer Naukri's recruiter chatbot questions?",
    answer:
      "It answers from your saved answer bank first, then with AI using your profile. When it is not sure, it asks you in the sidebar and saves your answer for next time.",
  },
  {
    question: "Will it go over Naukri's daily apply limit?",
    answer:
      "No. It stops when Naukri's daily apply limit is reached and applies at a human-like pace with pauses between jobs.",
  },
  {
    question: "Where do I see my Naukri applications?",
    answer:
      "Every confirmed application is logged in the Applications tracker on your AutoApply CV dashboard, next to your LinkedIn and Indeed applications.",
  },
];

export const INDEED_FAQS: FeatureFaq[] = [
  {
    question: "Can I auto apply to Indeed jobs for free?",
    answer:
      "Yes. The free plan gives 3 auto-applies a day plus 30 Hires on signup, and each confirmed Indeed application uses one. Pro (₹99/month) is unlimited.",
  },
  {
    question: "Which Indeed jobs does the bot apply to?",
    answer:
      "Only \"Easily apply\" jobs that use Indeed's own application form. Jobs that send you to a company website are skipped, and so are jobs you have already applied to.",
  },
  {
    question: "How are Indeed screening questions answered?",
    answer:
      "From your answer bank first, then with AI. Experience questions are answered with your years of experience. If Indeed says you don't meet a required qualification, the job is skipped.",
  },
  {
    question: "Does it work on Indeed India?",
    answer:
      "Yes. It was built and tested on in.indeed.com, so it works with Indeed India job listings and its \"Easily apply\" form.",
  },
  {
    question: "What happens if Indeed asks me to verify I'm human?",
    answer:
      "The extension pauses and waits for you. Complete the check yourself and it carries on. It also waits 20 to 45 seconds between jobs.",
  },
];

export const INTERVIEW_CALL_AI_FAQS: FeatureFaq[] = [
  {
    question: "What is Interview Call AI?",
    answer:
      "A page in your AutoApply CV dashboard that listens to your interview or client call and, when the other person stops talking, shows a short answer to their question based on your own notes.",
  },
  {
    question: "Which call apps does it work with?",
    answer:
      "Any of them: Zoom, Google Meet, Microsoft Teams or a phone call on speaker. It runs in the browser tab, so there is no extension or app to install.",
  },
  {
    question: "Which languages does it understand?",
    answer: "English, Hindi and Hinglish.",
  },
  {
    question: "Is my call recorded or saved?",
    answer: "No. Nothing from the call is saved. Answers are shown on screen while you talk and are gone when you close the page.",
  },
  {
    question: "How much does Interview Call AI cost?",
    answer:
      "It is included in the Pro Connect plan at ₹500/month, which also includes everything in Pro and daily HR contacts.",
  },
];

export const HR_CONTACTS_FAQS: FeatureFaq[] = [
  {
    question: "Where do the HR WhatsApp numbers come from?",
    answer:
      "From recruiters who shared them publicly in LinkedIn hiring posts. Phone numbers are checked to be on WhatsApp before they are sent to you.",
  },
  {
    question: "How many recruiter contacts do I get?",
    answer:
      "20 new recruiter contacts a day, matched to the job roles in your profile, with phone numbers and recruiter emails. They are emailed to you every morning.",
  },
  {
    question: "How much does it cost?",
    answer:
      "HR Contacts is part of the Pro Connect plan at ₹500/month. Pro Connect includes everything in Pro, plus Interview Call AI.",
  },
  {
    question: "Do I pay extra to message the recruiters?",
    answer: "No. Messaging your contacts is free and takes one click from your dashboard.",
  },
  {
    question: "I'm a recruiter. How do I remove my number?",
    answer:
      "Go to autoapplycv.in/remove-my-contact and submit your phone number or email. It is removed from the recruiter contacts.",
  },
];

export function faqPageJsonLd(faqs: FeatureFaq[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export function faqBullets(faqs: FeatureFaq[]): string[] {
  return faqs.map((faq) => `${faq.question} ${faq.answer}`);
}
