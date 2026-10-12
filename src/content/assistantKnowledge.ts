// Site knowledge for the dashboard AI assistant (app/api/assistant).
// Keep in sync with Pricing.tsx, HelpCenter.tsx, src/lib/hires.ts and the dashboard routes in App.tsx.

export const ASSISTANT_SITE_KNOWLEDGE = `
# AutoApply CV — product facts

AutoApply CV (https://www.autoapplycv.in) is an AI job search platform for software engineers and tech professionals.
- A Chrome extension ("AutoApply CV LinkedIn Copilot") auto-applies to LinkedIn Easy Apply jobs using saved, truthful screening answers, skips jobs already applied to, and pauses when a question needs a human answer.
- The dashboard tailors resumes for ATS, tracks every application, sends cold emails to recruiters, and has a live interview Call Copilot.
- Indeed applications are tracked in the same dashboard. Jobs that require applying on a company website are recorded as skipped so the user can apply manually.

## Plans and pricing
- Free (₹0): 3 auto-apply actions per day, plus a one-time 30 Hires coin signup bonus. Basic job matching, application tracker, resume builder, email notifications.
- Pro (₹99 per month, limited 80% off offer vs ₹499): unlimited auto-apply, HR recruiter email & phone extractor, personal AI assistant that knows your account (free users get pre-written answers instead), direct WhatsApp support, advanced AI job matching, AI resume builder and optimization, interview preparation AI tools, weekly analytics, cover letter generator, LinkedIn & Indeed automation, priority support.
- Custom Hires wallet (pay as you go): 1 Hire = 1 submitted application. Minimum top-up ₹49. No monthly subscription. Paid Hires can be used beyond the free daily cap.
- Payments are processed by Razorpay. Upgrade from Dashboard → Billing.
- The free daily allowance resets every day at 00:00 UTC (5:30 AM IST).

## What is charged
- Charged: application submitted successfully (1 apply action or 1 Hire).
- Not charged: skipped because it is an external (company website) apply; skipped because already applied (duplicate prevention); paused on a validation error; paused or stopped before submit.

## Getting started (five steps)
1. Create a free account and complete your profile: name, phone, current city, experience, notice period.
2. Upload a resume (PDF, DOCX or TXT, max 5MB) or build one in the resume builder.
3. Install the AutoApply CV LinkedIn Copilot from the Chrome Web Store and pin it to the toolbar.
4. Fill the answer bank once (salary range, work authorization, relocation) so screening questions are answered consistently.
5. Set target job titles, locations and work mode, then start with a modest daily limit and review the results.

## Troubleshooting
- Extension not detected: install from the Chrome Web Store, pin it, reload the dashboard and confirm the installed version shows.
- Red field errors in Easy Apply: LinkedIn rejected an answer. The run pauses; update the answer from the dashboard's pending questions and resume.
- Stuck jobs or repeated pages: update to the latest extension version and reset the run to clear stale search state.
- Pending queue not imported: keep the dashboard open once while logged in so the extension can flush queued outcomes.
- Saved answers not used: save typed answers in the dashboard, then sync them to the extension settings.

## Dashboard pages (use these exact paths for links)
- Overview: /dashboard — summary, recent runs, activity, pro tip.
- Auto Apply (LinkedIn): /dashboard/jobs/linkedin — search settings, run the extension, pending questions.
- Auto Apply (Indeed): /dashboard/jobs/indeed
- Apply Email (cold emails to recruiters): /dashboard/cold-emails
- HR Outreach (recruiter contacts): /dashboard/hr-outreach
- Applications (tracker of submitted/skipped/failed): /dashboard/applications
- Resume (upload, ATS tailoring, builder): /dashboard/resume
- Call Copilot (live interview assistant): /dashboard/interview
- Analytics: /dashboard/analytics
- Billing (plans, Pro upgrade, Hires wallet top-up, transactions): /dashboard/billing
- Onboarding (profile, resume, preferences setup): /dashboard/onboarding
- Profile: /dashboard/profile
- Settings: /dashboard/settings
- Public pages: /pricing, /help-center, /faq, /contact, /privacy-policy, /terms-of-service, /auto-apply-chrome-extension

## Support
- Contact page: /contact. WhatsApp support: https://wa.me/919805559015
- For run problems, ask the user to share the job URL and what the extension showed.
`.trim();
