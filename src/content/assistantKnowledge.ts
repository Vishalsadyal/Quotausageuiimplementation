// Site knowledge for the dashboard AI assistant (app/api/assistant).
// Keep in sync with Pricing.tsx, HelpCenter.tsx, src/lib/hires.ts and the dashboard routes in App.tsx.

export const ASSISTANT_SITE_KNOWLEDGE = `
# AutoApply CV — product facts

AutoApply CV (https://www.autoapplycv.in) is an AI job search platform for software engineers and tech professionals.
- One Chrome extension (AutoApply CV) auto-applies on LinkedIn, Naukri and Indeed. On LinkedIn it applies to Easy Apply jobs using saved, truthful screening answers, skips jobs already applied to, and pauses when a question needs a human answer.
- Naukri auto-apply: the extension opens a sidebar on naukri.com, finds matching jobs that use Naukri's own "Apply" (skips "Apply on company site"), answers Naukri's recruiter chatbot questions from the answer bank or AI (asks in the sidebar when it can't), uses the dashboard filters (job titles, skills/keywords, exclude words, blacklisted companies, years of experience, location, work mode, date posted, salary), stays within Naukri's daily apply limit, and keeps a human-like pace.
- Indeed auto-apply: the extension sidebar on Indeed applies only to "Easily apply" jobs (Indeed's own form), all in the same tab. It fills screening questions from the answer bank or AI, answers experience questions with the user's years, skips jobs where Indeed says the user doesn't meet a required requirement, skips jobs already applied, ignores Indeed's hidden decoy cards, searches with the dashboard filters (job titles, location + radius, date posted, Remote/Hybrid, job type, experience, skills, exclude words, blacklist), waits 20-45 seconds between jobs, and pauses for "verify you're human" checks. Built and tested on in.indeed.com.
- On LinkedIn, Naukri and Indeed, each confirmed application costs 1 free daily apply or 1 Hire; Pro and Pro Connect are unlimited. Every application is logged in the Applications tracker.
- Jobs that require applying on a company website are skipped so the user can apply manually.
- Recruiter outreach: WhatsApp and email outreach to recruiters from LinkedIn hiring posts, plus a LinkedIn auto-commenter.
- HR Contacts (Pro Connect only): 20 new recruiter contacts a day (WhatsApp-checked phone numbers and recruiter emails shared publicly in LinkedIn hiring posts), matched to the user's target roles, emailed every morning, and messageable free with one click from /dashboard/hr-contacts. Recruiters can ask to be removed at /remove-my-contact.
- Interview Call AI (formerly "Call Copilot", /dashboard/interview): keep the page open during an interview or client call; it listens and shows a short answer to each question from the user's own notes as soon as the other person stops talking. Works with any call app (Zoom, Google Meet, Teams, phone on speaker), English/Hindi/Hinglish, no extension needed, nothing from the call is saved. Included in Pro Connect and Coach.
- The dashboard also tailors resumes for ATS (resume builder) and tracks every application.

## Plans and pricing
- Free (₹0): 3 auto-apply actions per day, plus a one-time 30 Hires coin signup bonus. Basic job matching, application tracker, resume builder, email notifications.
- Pro (₹99 per month, limited 80% off offer vs ₹499): unlimited auto-apply, HR recruiter email & phone extractor, personal AI assistant that knows your account (free users get pre-written answers instead), direct WhatsApp support, advanced AI job matching, AI resume builder and optimization, interview preparation AI tools, weekly analytics, cover letter generator, LinkedIn, Naukri & Indeed auto-apply, priority support.
- Pro Connect (₹500 per month): everything in Pro, plus HR Contacts (20 new recruiter contacts a day, emailed every morning, free 1-click messaging) and Interview Call AI.
- Custom Hires wallet (pay as you go): 1 Hire = 1 submitted application. Minimum top-up ₹49. No monthly subscription. Paid Hires can be used beyond the free daily cap.
- Payments are processed by Razorpay. Upgrade from Dashboard → Billing.
- The free daily allowance resets every day at 00:00 UTC (5:30 AM IST).

## What is charged
- Charged: application submitted successfully on LinkedIn, Naukri or Indeed (1 apply action or 1 Hire; unlimited on Pro and Pro Connect).
- Not charged: skipped because it is an external (company website) apply; skipped because already applied (duplicate prevention); paused on a validation error; paused or stopped before submit.

## Getting started (five steps)
1. Create a free account and complete your profile: name, phone, current city, experience, notice period.
2. Upload a resume (PDF, DOCX or TXT, max 5MB) or build one in the resume builder.
3. Install the AutoApply CV extension from the Chrome Web Store and pin it to the toolbar. The same extension works on LinkedIn, naukri.com and Indeed.
4. Fill the answer bank once (salary range, work authorization, relocation) so screening questions are answered consistently.
5. Set target job titles, locations and work mode, then start with a modest daily limit and review the results.

## Troubleshooting
- Extension not detected: install from the Chrome Web Store, pin it, reload the dashboard and confirm the installed version shows.
- Red field errors in Easy Apply: LinkedIn rejected an answer. The run pauses; update the answer from the dashboard's pending questions and resume.
- Stuck jobs or repeated pages: update to the latest extension version and reset the run to clear stale search state.
- Pending queue not imported: keep the dashboard open once while logged in so the extension can flush queued outcomes.
- Saved answers not used: save typed answers in the dashboard, then sync them to the extension settings.
- Naukri chatbot question not answered: the sidebar asks the user; the answer is used for that question.
- Indeed run paused: Indeed showed a "verify you're human" check. Complete it in the tab and the run continues.

## Dashboard pages (use these exact paths for links)
- Overview: /dashboard — summary, recent runs, activity, pro tip.
- Auto Apply (LinkedIn): /dashboard/jobs/linkedin — search settings, run the extension, pending questions.
- Auto Apply (Indeed): /dashboard/jobs/indeed
- HR Contacts (Pro Connect daily recruiter contacts): /dashboard/hr-contacts (the old /dashboard/cold-emails redirects here)
- HR Outreach (recruiter contacts): /dashboard/hr-outreach
- Applications (tracker of submitted/skipped/failed): /dashboard/applications
- Resume (upload, ATS tailoring, builder): /dashboard/resume
- Interview Call AI (live interview assistant, formerly Call Copilot): /dashboard/interview
- Analytics: /dashboard/analytics
- Billing (plans, Pro upgrade, Hires wallet top-up, transactions): /dashboard/billing
- Onboarding (profile, resume, preferences setup): /dashboard/onboarding
- Profile: /dashboard/profile
- Settings: /dashboard/settings
- Public pages: /pricing, /help-center, /faq, /contact, /privacy-policy, /terms-of-service, /auto-apply-chrome-extension, /naukri-auto-apply, /indeed-auto-apply, /interview-call-ai, /hr-whatsapp-contacts, /remove-my-contact

## Support
- Contact page: /contact. WhatsApp support: https://wa.me/919805559015
- For run problems, ask the user to share the job URL and what the extension showed.
`.trim();
