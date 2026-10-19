// Live guides: step-by-step walkthroughs that point at the real buttons on the real screens and move on when
// the user actually clicks. Data only; the engine is src/app/components/guide/LiveGuide.tsx.
//
// A step points at an element by its `data-guide="..."` marker (never a CSS class or button text, so a redesign
// does not break the guide). scripts/check-guides.cjs fails when a guide names a marker that no page defines.

export type GuideId = "setup" | "first-run";

export type GuideContext = {
  pathname: string;
  user: { resumeFileName?: string | null; onboardingCompleted?: boolean | null } | null;
};

export type GuideStep = {
  id: string;
  /** The page this step happens on (path prefix, or the exact path with `exact`). Elsewhere the guide offers to take the user there. */
  page?: string;
  exact?: boolean;
  /** data-guide marker of the element to point at. Without one the step is a centred note. */
  target?: string;
  /** Point at this instead (with `fallback` as the text) when `target` is not on screen, e.g. a menu that is closed. */
  targetFallback?: string;
  title: string;
  body: string;
  /** click: the user clicks the target. next: the user presses the button in the tooltip. */
  advance: "click" | "next";
  /** Silently skipped when this is already true (for example the resume is already uploaded). */
  skipIf?: (ctx: GuideContext) => boolean;
  /** Shown when the target cannot be found on screen. */
  fallback?: string;
  /** Label of the tooltip button for `next` steps. */
  nextLabel?: string;
};

export type Guide = {
  id: GuideId;
  title: string;
  summary: string;
  steps: GuideStep[];
};

const hasResume = (ctx: GuideContext) => Boolean(ctx.user?.resumeFileName);

export const GUIDES: Guide[] = [
  {
    id: "setup",
    title: "Get set up",
    summary: "Resume, keywords, screening answers and preferences. About 3 minutes.",
    steps: [
      {
        id: "open-resume",
        target: "nav-resume",
        title: "Open Resume",
        body: "Your resume is how AutoApply CV learns your skills and the roles to look for. Click Resume.",
        advance: "click",
        skipIf: hasResume,
      },
      {
        id: "upload-resume",
        page: "/dashboard/resume",
        target: "resume-upload",
        title: "Upload your resume",
        body: "Click this box and choose your resume (PDF, Word or text, up to 5 MB).",
        advance: "click",
        skipIf: hasResume,
        fallback: "Open the Resume page from the menu to upload your resume.",
      },
      {
        id: "wait-upload",
        page: "/dashboard/resume",
        title: "Let it finish",
        body: "Reading your resume takes a few seconds. When the upload is done, press Next.",
        advance: "next",
        skipIf: hasResume,
      },
      {
        id: "open-auto-apply",
        target: "nav-auto-apply",
        title: "Open Auto Apply",
        body: "This is where the tool is set up and run. Click Auto Apply.",
        advance: "click",
      },
      {
        id: "open-keywords",
        page: "/dashboard/jobs",
        target: "sub-dictionary",
        title: "Open Keywords",
        body: "Keywords are the job titles and skills the tool searches LinkedIn for. Click Keywords.",
        advance: "click",
        fallback: "Open Auto Apply first, then Keywords appears in its menu.",
      },
      {
        id: "generate-keywords",
        page: "/dashboard/jobs/linkedin/keywords",
        target: "keywords-generate",
        title: "Let AI build your keywords",
        body: "Click Generate AI Keywords. AI reads your resume and fills in titles and skills. You can edit any of them afterwards.",
        advance: "click",
        fallback: "Upload your resume first, then this button is ready to use.",
      },
      {
        id: "open-screening",
        page: "/dashboard/jobs",
        target: "sub-screening",
        title: "Open Screening Answers",
        body: "Employers ask questions like salary and notice period. Answer once here and the tool reuses them. Click Screening Answers.",
        advance: "click",
      },
      {
        id: "autofill-screening",
        page: "/dashboard/jobs/linkedin/screening",
        target: "screening-autofill",
        title: "Auto-fill the answers",
        body: "Click Auto-Fill All with AI. It drafts the answers from your resume. Check Salary and Notice before you run, they come up most.",
        advance: "click",
        fallback: "This button is on the Screening Answers page.",
      },
      {
        id: "open-preferences",
        page: "/dashboard/jobs",
        target: "sub-settings",
        title: "Open Preferences",
        body: "Last setup step: where and how you want to work. Click Preferences.",
        advance: "click",
      },
      {
        id: "save-preferences",
        page: "/dashboard/jobs/linkedin/preferences",
        target: "prefs-save",
        title: "Set your filters and save",
        body: "Choose location and work mode above, then click Save preferences. This button works once the extension is connected.",
        advance: "click",
        nextLabel: "Skip",
        fallback: "Preferences are on this page. Save them when you are ready.",
      },
      {
        id: "setup-done",
        title: "You are set up",
        body: "Next, run your first application. It takes about two minutes and nothing is sent while you practise.",
        advance: "next",
        nextLabel: "Finish",
      },
    ],
  },
  {
    id: "first-run",
    title: "Run your first application",
    summary: "Open LinkedIn, practise with Dry Run, then see the results. About 2 minutes.",
    steps: [
      {
        id: "open-auto-apply",
        target: "nav-auto-apply",
        title: "Open Auto Apply",
        body: "Click Auto Apply.",
        advance: "click",
        skipIf: (ctx) => ctx.pathname.startsWith("/dashboard/jobs"),
      },
      {
        id: "check-extension",
        page: "/dashboard/jobs/linkedin",
        exact: true,
        target: "extension-status",
        title: "Check the extension is connected",
        body: "This should say Connected. If it says Not detected, use Guide me → Install the extension first.",
        advance: "next",
        fallback: "Open the Auto Apply overview page to see the connection status.",
      },
      {
        id: "open-linkedin",
        page: "/dashboard/jobs/linkedin",
        exact: true,
        target: "launch-linkedin",
        title: "Open LinkedIn Jobs",
        body: "Click this. LinkedIn opens in a new tab, filtered to Easy Apply jobs, with the AutoApply panel on the right.",
        advance: "click",
        fallback: "This button appears once the extension is detected. Install the extension from Guide me first.",
      },
      {
        id: "practise-on-linkedin",
        title: "Practise on LinkedIn",
        body: "In the AutoApply panel on LinkedIn: leave Live Auto Submit OFF (the label next to it says Dry Run, so nothing is sent), then press Start. Watch the Activity tab for a minute. Come back here when you have seen a few jobs go by.",
        advance: "next",
        nextLabel: "I have seen it run",
      },
      {
        id: "open-applications",
        target: "sub-applications",
        targetFallback: "nav-auto-apply",
        title: "See the results",
        body: "Every job the tool handled is listed under Applications. Click Applications.",
        advance: "click",
        fallback: "Open Auto Apply first, then Applications appears in its menu.",
      },
      {
        id: "applications-page",
        page: "/dashboard/applications",
        target: "applications-header",
        title: "Your applications",
        body: "Each job shows its outcome: submitted, skipped or failed. Skipped jobs tell you why.",
        advance: "next",
      },
      {
        id: "go-live",
        title: "Ready to go live?",
        body: "On LinkedIn, turn Live Auto Submit on and press Start. Each submitted application uses one of your free applications first (3 a day), then one Hire. Pro plans are unlimited.",
        advance: "next",
        nextLabel: "Finish",
      },
    ],
  },
];

export function getGuide(id: string): Guide | undefined {
  return GUIDES.find((guide) => guide.id === id);
}

/** Does the user's current page count as this step's page? */
export function onStepPage(step: GuideStep, pathname: string) {
  if (!step.page) return true;
  return step.exact ? pathname === step.page || pathname === `${step.page}/` : pathname.startsWith(step.page);
}

/** The first step at or after `from` that is not already done; -1 when the rest of the guide is already done. */
export function nextOpenStep(guide: Guide, from: number, ctx: GuideContext) {
  for (let i = Math.max(0, from); i < guide.steps.length; i += 1) {
    const step = guide.steps[i];
    if (!step.skipIf || !step.skipIf(ctx)) return i;
  }
  return -1;
}

/** Every marker a guide points at (used by the check script). */
export function guideTargets() {
  const targets = new Set<string>();
  for (const guide of GUIDES) {
    for (const step of guide.steps) {
      if (step.target) targets.add(step.target);
      if (step.targetFallback) targets.add(step.targetFallback);
    }
  }
  return Array.from(targets);
}
