import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function AutoApplyJobs() {
  return (
    <MarketingInfoPage
      eyebrow="Auto Apply Jobs & Automation Platform"
      title="Free Auto Apply Jobs Platform | Automate Job Applications in Minutes"
      description="Apply to hundreds of relevant LinkedIn Easy Apply jobs automatically. AutoApply CV combines AI resume keyword tailoring, screening answer automation, and live application tracking so you get more interviews in less time."
      metrics={[
        { label: "Hours Saved / Week", value: "20+ hrs", note: "Zero repetitive form clicking" },
        { label: "Application Velocity", value: "50+ / day", note: "Targeted auto apply jobs" },
        { label: "ATS Keyword Match", value: "95%", note: "Tailored to job descriptions" },
        { label: "Cost", value: "100% Free", note: "Start auto applying today" },
      ]}
      sections={[
        {
          title: "Why Job Seekers Auto Apply with AutoApply CV",
          description:
            "Manual job applications take 15–30 minutes each. AutoApply CV’s intelligent job application automation handles the tedious form filling, document uploads, and screening questions so you can focus on interview prep.",
          cards: [
            {
              kicker: "Smart Targeting",
              title: "Filter by Role, Seniority & Location",
              description:
                "Set strict job search automation criteria to auto apply only to positions that match your exact skillset, salary range, and remote preferences.",
            },
            {
              kicker: "ATS Resume Optimization",
              title: "Keyword-Optimized Resume Matching",
              description:
                "Automatically align your resume with keywords from the job description to pass Applicant Tracking Systems (ATS) and reach hiring managers.",
            },
            {
              kicker: "Unified Pipeline",
              title: "Automated Job Application Tracker",
              description:
                "Monitor all submitted, skipped, and interviewed roles across LinkedIn and company portals in one organized dashboard.",
            },
          ],
        },
        {
          title: "3-Step Automated Job Application Strategy",
          description:
            "How top software engineers and professionals land high-paying roles using our auto apply jobs system.",
          cards: [
            {
              kicker: "Step 1: Set Search Criteria",
              title: "Define Target Titles & Filters",
              description:
                "Select primary job titles (e.g., Software Engineer, DevOps, Full Stack) and filter out non-fitting roles using custom keyword exclusions.",
            },
            {
              kicker: "Step 2: Sync Answer Bank",
              title: "Save Screening Answers Once",
              description:
                "Store your work authorization, years of experience, notice period, and compensation expectations to auto-fill every application correctly.",
            },
            {
              kicker: "Step 3: Launch Auto Apply",
              title: "Apply to 50+ Jobs Daily",
              description:
                "Start the copilot to automatically process and submit applications across LinkedIn Easy Apply and partner job boards.",
            },
          ],
        },
        {
          title: "Frequently Asked Questions About Auto Apply Jobs",
          description:
            "Everything you need to know about automated job applications and interview success.",
          bullets: [
            "Can I auto apply to jobs for free? Yes. AutoApply CV provides free daily application credits so you can start landing interviews at zero cost.",
            "How does auto apply improve callback rates? By applying early within minutes of a job being posted and matching resume ATS keywords directly.",
            "Which job sites does it support? LinkedIn Easy Apply. Jobs that need a company website application are logged as skipped so you can apply manually.",
            "Will I apply to duplicate jobs? No. AutoApply CV tracks your complete application history and skips any job you previously applied to.",
          ],
        },
      ]}
      ctaTitle="Start applying to jobs automatically today"
      ctaDescription="Create your free account, configure your answer bank, and let AI handle your job applications."
      primaryAction={{ label: "Start Free Auto Apply", to: "/signup" }}
      secondaryAction={{ label: "Explore LinkedIn Bot", to: "/auto-apply-linkedin" }}
    />
  );
}

