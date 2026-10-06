import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function Community() {
  return (
    <MarketingInfoPage
      eyebrow="Community"
      title="Learn from other serious job seekers"
      description="Community is where users share working search strategies, answer templates, and run optimization patterns."
      metrics={[
        { label: "Peer support", value: "Practical, workflow-first" },
        { label: "Topics", value: "Automation, ATS, interview prep" },
      ]}
      sections={[
        {
          title: "What members share",
          bullets: [
            "Search term and filter patterns that improve callback quality.",
            "Common LinkedIn screening questions and strong answer structures.",
            "How to tune daily volume without damaging relevance.",
            "How to diagnose repeat skips and apply failures from logs.",
          ],
        },
        {
          title: "Community channels",
          cards: [
            {
              kicker: "Discussion",
              title: "Weekly strategy threads",
              description: "Review wins, blockers, and experiments with other active users.",
            },
            {
              kicker: "Knowledge base",
              title: "Reusable playbooks",
              description: "Access templates for onboarding, profile sync, and run-reliability checklists.",
            },
            {
              kicker: "Feedback",
              title: "Feature request pipeline",
              description: "Suggest improvements and upvote roadmap items based on real usage pain.",
            },
          ],
        },
        {
          title: "Topics that get the best answers",
          cards: [
            {
              kicker: "Targeting",
              title: "Which titles and filters to use",
              description: "Share the titles, seniority, and locations you target and the callback rate you are seeing.",
            },
            {
              kicker: "Resume",
              title: "ATS keywords that worked",
              description: "Post before-and-after bullet points that improved replies for a specific role type.",
            },
            {
              kicker: "Answers",
              title: "Screening question templates",
              description: "Compare honest, consistent answers for notice period, salary expectations, and relocation.",
            },
          ],
        },
        {
          title: "Community guidelines",
          bullets: [
            "Be specific: share the setting, the result, and what changed.",
            "Never post personal data such as phone numbers, emails, or full resumes in public threads.",
            "Keep answers truthful. Automation should never misrepresent your experience.",
            "Respect each job platform's terms and keep daily volumes reasonable.",
            "Report bugs through support so the product team can reproduce them.",
          ],
        },
      ]}
      ctaTitle="Want to contribute?"
      ctaDescription="Share one workflow improvement that increased your application quality or speed."
      primaryAction={{ label: "Contact Team", to: "/contact" }}
      secondaryAction={{ label: "View Roadmap", to: "/roadmap" }}
    />
  );
}
