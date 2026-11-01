// Hand-written bodies for the feature-launch posts (Naukri, Indeed, multi-site, HR contacts,
// Interview Call AI) listed in FEATURE_POSTS (src/content/blogPosts.ts), keyed by slug.
// Prices must match src/lib/plans.ts (Pro ₹99/month, Pro Connect ₹500/month).
export const FEATURE_ARTICLES: Record<string, string> = {
  "naukri-auto-apply-step-by-step-guide": `
    <p>To auto apply on Naukri, install the AutoApply CV Chrome extension, log in to Naukri in the same browser, set your job filters and chatbot answers once in the AutoApply CV dashboard, then press start in the sidebar that opens on naukri.com. The extension searches with your filters, opens each matching job, applies with Naukri's own Apply button and replies to the recruiter chatbot for you. The setup takes about twenty minutes, and most of that time goes into two things that decide whether the applications are any good: your filters and your answers. This guide walks through both, with the mistakes Indian job seekers most often make on Naukri.</p>

    <h2>Before you start: what you need</h2>
    <ul>
      <li><strong>A complete Naukri profile.</strong> Recruiters on Naukri see your Naukri profile and resume, not anything the extension types. Update your headline, key skills, current CTC, notice period and resume before automating anything.</li>
      <li><strong>Google Chrome</strong> (or another Chromium browser such as Edge) with the <a href="/auto-apply-chrome-extension">AutoApply CV extension</a> installed and pinned.</li>
      <li><strong>An AutoApply CV account.</strong> The <a href="/signup">free plan</a> gives you 3 auto-applies a day plus 30 Hires on signup, which is enough to test the whole flow.</li>
    </ul>
    <p>You log in to Naukri yourself, the normal way. AutoApply CV never asks for your Naukri password; the extension works inside the tab you are already signed in to.</p>

    <h2>Step 1: Set filters that describe jobs you would really take</h2>
    <p>Open the dashboard and go to the Naukri settings. The filters available are job titles, skills and keywords, exclude words, blacklisted companies, years of experience, location, work mode, date posted and salary. Here is how to think about each one for Naukri specifically.</p>
    <h3>Job titles: two to four, not fifteen</h3>
    <p>Naukri search is generous: type "Java Developer" and you also get support roles, trainers and "Java + anything" listings. Start with the exact titles on jobs you have shortlisted by hand, such as "Java Developer", "Backend Developer" and "Spring Boot Developer". Add more only after you have checked a few days of results.</p>
    <h3>Skills and keywords</h3>
    <p>Use the skills that appear in the job descriptions you want, and that you can defend in an interview. If you list "Kubernetes" because it sounds good, you will be matched to jobs where the first technical round asks about it.</p>
    <h3>Exclude words do the most work</h3>
    <p>This is the filter people skip and regret. Naukri carries a lot of listings that look right in the title but are not. Common exclude words for Indian searches:</p>
    <ul>
      <li>"Trainee", "Intern" or "Fresher" if you are experienced, or "Senior", "Lead" and "Manager" if you are not.</li>
      <li>"Bond", "Security deposit" or "Training fee", which often signal listings you do not want.</li>
      <li>"Night shift", "Telecalling" or "Field sales" if those are not what you are looking for.</li>
      <li>"Contract" or "C2H" (contract to hire) if you only want permanent roles.</li>
    </ul>
    <p>Any job whose title or description contains one of your exclude words is skipped.</p>
    <h3>Blacklisted companies</h3>
    <p>Add your current employer, so you do not apply to your own company by accident, plus any company you have already interviewed with recently and anything you have heard bad things about. Blacklisted companies are never applied to.</p>
    <h3>Experience, location, work mode, date posted and salary</h3>
    <p>Set years of experience to your real number. Pick locations you would actually move to or commute to; "Bengaluru, Hyderabad, Pune" is better than "anywhere in India" if you would decline Kolkata. Use date posted to stay on fresh listings, because a Naukri job posted three weeks ago has usually had hundreds of applicants already.</p>

    <h2>Step 2: Prepare answers for the recruiter chatbot</h2>
    <p>Many Naukri jobs open a short recruiter chatbot after you click Apply. It asks the same handful of questions again and again: notice period, current CTC, expected CTC, current location, willingness to relocate, total experience and sometimes years with a specific skill. Save truthful answers to these in your answer bank.</p>
    <p>When a question comes up, the extension answers it from your answer bank first. If there is no saved answer, it uses AI with your profile. If it is still not confident, it asks you in the sidebar, and your reply is saved for the next job. In practice, your first few days will include a few sidebar questions, and after that runs get quieter.</p>
    <p>A few tips for answers that hold up later:</p>
    <ul>
      <li><strong>CTC in lakhs, consistently.</strong> Decide whether you write "8.5" or "8.5 LPA" and keep it the same everywhere. A recruiter who sees different numbers on two applications will ask why.</li>
      <li><strong>Notice period as it really is.</strong> If you can buy out part of it, say so in words: "60 days, can negotiate to 30".</li>
      <li><strong>Expected CTC you would accept.</strong> Not a hopeful number you will walk back on the first call.</li>
    </ul>
    <p>Our guide to <a href="/blog/auto-apply-screening-questions-answer-bank">building an answer bank once</a> covers each question type in more detail.</p>

    <h2>Step 3: Start a run and watch the first few jobs</h2>
    <p>Open naukri.com and press start in the AutoApply CV sidebar. The extension searches with your filters and opens matching jobs one at a time. On jobs with Naukri's own Apply button it applies and handles the chatbot. Jobs that say "Apply on company site" are skipped, because they take you off Naukri to a different form.</p>
    <p>Watch the first three or four jobs. You are checking that the jobs it picks match what you expected and that the chatbot answers look like yours. If a wrong kind of job appears, add an exclude word and start again. This five-minute check saves you from fifty bad applications.</p>

    <h2>Step 4: Understand the daily limit</h2>
    <p>There are two separate limits, and it helps to know which one you are hitting.</p>
    <ul>
      <li><strong>Naukri's own daily apply limit.</strong> Naukri caps how many jobs one account can apply to per day. The extension stays within it and stops when the cap is reached. No plan can lift this, because it is Naukri's rule.</li>
      <li><strong>Your AutoApply CV allowance.</strong> On the free plan each confirmed application uses one of your 3 free daily auto-applies, then one Hire. Pro at ₹99/month is unlimited. Jobs that are skipped or fail are not charged. See <a href="/pricing">pricing</a> for the current plans.</li>
      <li><strong>Pace.</strong> Either way, the extension moves at a human-like pace with pauses between jobs, rather than clicking as fast as it can.</li>
    </ul>

    <h2>Step 5: Review results in the Applications tracker</h2>
    <p>Every confirmed Naukri application is logged in the Applications tracker on your dashboard with the role, company and date, next to anything you applied to on LinkedIn or Indeed. Once a week, sort by company and look for patterns. If recruiters from one kind of company call back and another never does, adjust your titles and exclude words.</p>

    <h2>Mistakes that waste Naukri applications</h2>
    <ul>
      <li><strong>An old Naukri resume.</strong> Automation multiplies whatever resume is on your profile, good or bad.</li>
      <li><strong>No exclude words.</strong> Results drift into roles you would never take.</li>
      <li><strong>Never updating your profile.</strong> Many Indian job seekers refresh their Naukri profile regularly so it stays recent for recruiter searches. That is separate from applying and still worth doing.</li>
    </ul>

    <h2>Frequently asked questions</h2>
    <h3>Is Naukri auto apply free?</h3>
    <p>You can start free: 3 auto-applies a day plus 30 Hires on signup. Pro (₹99/month) removes the AutoApply CV limit, though Naukri's own daily cap still applies.</p>
    <h3>Does it apply to "Apply on company site" jobs?</h3>
    <p>No. It only applies to jobs that use Naukri's own Apply button. Company-site jobs are skipped so you can apply to them by hand if you want.</p>
    <h3>What if the chatbot asks something unusual?</h3>
    <p>If there is no saved answer and the AI is not confident, the extension asks you in the sidebar and remembers your reply.</p>

    <h2>Your next step</h2>
    <p>Write down your notice period, current and expected CTC, and three exclude words for the jobs you do not want. Then <a href="/signup">create a free account</a>, add them to the dashboard and run three Naukri applications today. The <a href="/naukri-auto-apply">Naukri auto apply page</a> has a summary of what the extension does.</p>
  `,

  "indeed-auto-apply-easily-apply-jobs-india": `
    <p>Indeed auto apply works best on one kind of listing: jobs marked "Easily apply", which use Indeed's own application form instead of sending you to a company website. The AutoApply CV Chrome extension adds a sidebar to Indeed, searches with the filters you set in your dashboard, and works through those "Easily apply" jobs in the same tab, filling screening questions from your answer bank. It was built and tested on Indeed India (in.indeed.com). This guide explains how Indeed's flow differs from LinkedIn and Naukri, how to set up a search that sends good applications, and what the extension checks before it submits anything.</p>

    <h2>What "Easily apply" means on Indeed</h2>
    <p>On Indeed India you will see two kinds of listings. Some send you to the employer's own careers page, where every company has a different form. Others carry the "Easily apply" label: you apply on Indeed with your Indeed profile or resume and answer a few employer questions. Only the second kind can be applied to reliably without you, so the extension skips the first kind.</p>
    <p>The employer questions on Indeed tend to be more structured than Naukri's chatbot. Expect things like "How many years of experience do you have with SQL?", "Are you willing to relocate to Chennai?", "What is your expected salary?", "Do you have a valid two-wheeler licence?" or "Can you start immediately?". Some are marked as required qualifications by the employer, which matters, as you will see below.</p>

    <h2>Step 1: Get Indeed ready</h2>
    <ol>
      <li>Log in to Indeed in Chrome and check your Indeed resume and profile. Employers see what is on Indeed.</li>
      <li>Install the <a href="/auto-apply-chrome-extension">AutoApply CV extension</a> and log in to your AutoApply CV account.</li>
      <li>Make sure your years of experience are correct in your AutoApply CV profile. Experience questions on Indeed are answered with the years from your dashboard.</li>
    </ol>
    <p>AutoApply CV never asks for your Indeed password. Everything happens in your own logged-in tab.</p>

    <h2>Step 2: Build an Indeed search in the dashboard</h2>
    <p>The Indeed filters are job titles, location and radius, date posted, Remote or Hybrid, job type, experience, skills, exclude words and blacklisted companies. A few tips specific to Indeed India:</p>
    <ul>
      <li><strong>Radius is your friend in big cities.</strong> "Pune within 25 km" covers Hinjewadi, Kharadi and Magarpatta without pulling in jobs from another district. Increase the radius only if results are thin.</li>
      <li><strong>Remote and Hybrid are separate choices.</strong> If you need to stay at home, choose Remote only. Hybrid jobs usually expect office days.</li>
      <li><strong>Job type removes noise.</strong> Indeed lists full-time, part-time, contract, internship and fresher roles together. Pick the types you want.</li>
      <li><strong>Date posted keeps you early.</strong> Recent listings have fewer applicants ahead of you.</li>
      <li><strong>Exclude words still matter.</strong> Words like "Commission only", "Work from home data entry" or "Registration fee" are worth excluding on any large board.</li>
    </ul>

    <h2>Step 3: Prepare your screening answers</h2>
    <p>Save answers to the questions Indeed employers ask most: notice period, expected salary, work authorization, willingness to relocate and commute. When the form asks something, the extension fills it from your answer bank first, then with AI using your profile. Experience questions ("How many years of experience do you have in customer support?") are answered with your dashboard years, so keep that number honest.</p>
    <p>If you have different experience in different skills, say five years overall but two with Power BI, save the skill-specific answer too. Otherwise you risk a form saying five years of Power BI, which the interviewer will notice in the first ten minutes.</p>

    <h2>Step 4: Start the run</h2>
    <p>Open Indeed and press start in the sidebar. The extension runs the search with your filters and works through "Easily apply" results one at a time, all in the same tab, so you will not end up with twenty open windows. It waits 20 to 45 seconds between jobs.</p>

    <h2>What it checks before submitting</h2>
    <p>This is the part that separates a careful Indeed easily apply bot from one that just clicks. On every job, before anything is sent:</p>
    <ul>
      <li><strong>Already applied?</strong> It checks Indeed's job details and skips jobs you have already applied to, so there are no duplicates even if you applied by hand last week.</li>
      <li><strong>Required qualification not met?</strong> If Indeed says you don't meet a requirement the employer marked as required, for example a minimum number of years or a specific licence, the job is skipped. An application that will be auto-rejected is not worth a daily apply.</li>
      <li><strong>Hidden decoy cards.</strong> Indeed's results page can contain job cards that are hidden from view. The extension ignores them and only works with jobs that are actually shown in the results.</li>
      <li><strong>Exclude words and blacklist.</strong> Jobs with your exclude words, or from blacklisted companies, are never applied to.</li>
    </ul>
    <p>If Indeed shows a "verify you're human" check, the extension pauses. Solve it yourself and the run carries on. Do not leave a run going unattended for hours if you know Indeed is likely to ask; check back now and then.</p>

    <h2>How Indeed applications are counted</h2>
    <p>Each confirmed Indeed application uses 1 free daily apply, or 1 Hire once the free applies are used. The free plan includes 3 auto-applies a day and 30 Hires on signup. Pro at ₹99/month is unlimited across Indeed, LinkedIn and Naukri, with no Hires spent. Jobs that are skipped are not charged. Every confirmed application appears in the Applications tracker on your dashboard. Compare plans on the <a href="/pricing">pricing page</a>.</p>

    <h2>Who gets the most from Indeed in India</h2>
    <p>Indeed India has a broad mix of listings: IT and non-IT, office and on-site, large companies and small ones. It tends to suit:</p>
    <ul>
      <li>Candidates for customer support, operations, accounts, sales and admin roles, which Indeed lists in large numbers.</li>
      <li>Candidates looking in a specific city, where the radius filter does real work.</li>
      <li>Anyone already applying on LinkedIn or Naukri who wants a third source covered without a third routine.</li>
    </ul>

    <h2>Frequently asked questions</h2>
    <h3>Does it apply to jobs on company websites?</h3>
    <p>No. It only applies to "Easily apply" jobs that use Indeed's own form. Others are skipped.</p>
    <h3>Will it apply to the same job twice?</h3>
    <p>No. It checks Indeed's job details and skips jobs you have already applied to.</p>
    <h3>Does it work outside India?</h3>
    <p>It was built and tested on in.indeed.com, so Indeed India is where it is proven.</p>

    <h2>Your next step</h2>
    <p>Pick one city, a radius and two job titles, and save answers for notice period and expected salary. Then <a href="/signup">sign up free</a> and run your first three Indeed applications. The <a href="/indeed-auto-apply">Indeed auto apply page</a> summarises the feature.</p>
  `,

  "linkedin-vs-naukri-vs-indeed-auto-apply-jobs-india": `
    <p>For most job seekers in India in 2026, the honest answer to "LinkedIn, Naukri or Indeed?" is "all three, for different reasons". LinkedIn is strongest for corporate, tech and mid-to-senior roles and for reaching recruiters directly. Naukri is the largest India-only board and is where many Indian recruiters search for candidates. Indeed is broad, with plenty of non-IT and city-specific jobs. Auto-apply helps on each one in a slightly different way, and the main cost of using all three is not applications but management: three sets of filters, three sets of answers, three places to check. This post compares the three and shows how to run them from one dashboard.</p>

    <h2>How the three sites differ</h2>
    <h3>LinkedIn</h3>
    <ul>
      <li><strong>Best for:</strong> IT, product, data, consulting, finance and other corporate roles; mid and senior candidates; MNCs and funded startups.</li>
      <li><strong>Apply flow:</strong> Easy Apply on LinkedIn, or a link to the company site.</li>
      <li><strong>Unique advantage:</strong> recruiters post openings in their own feed, often with "share your CV" and an email or WhatsApp number. That makes direct outreach possible in a way the other two do not offer.</li>
    </ul>
    <h3>Naukri</h3>
    <ul>
      <li><strong>Best for:</strong> almost every industry in India, freshers through to experienced, IT services, BFSI, manufacturing and sales.</li>
      <li><strong>Apply flow:</strong> Naukri's own Apply, often followed by a recruiter chatbot, or "Apply on company site".</li>
      <li><strong>Unique advantage:</strong> recruiters actively search Naukri's database, so a fresh, complete profile can bring calls even without applying.</li>
      <li><strong>Constraint:</strong> Naukri caps how many jobs you can apply to per day.</li>
    </ul>
    <h3>Indeed</h3>
    <ul>
      <li><strong>Best for:</strong> a wide range of roles including support, operations, accounts and admin; local searches by city and radius.</li>
      <li><strong>Apply flow:</strong> "Easily apply" on Indeed's own form with employer screening questions, or a company website.</li>
      <li><strong>Unique advantage:</strong> the radius filter and job-type filters make focused local searches easy.</li>
    </ul>

    <h2>Where auto-apply helps on each</h2>
    <p>The AutoApply CV Chrome extension works on all three, but the work it removes is different on each site.</p>
    <div style="overflow-x:auto"><table style="width:100%; border-collapse:collapse">
      <thead>
        <tr><th style="text-align:left; padding:6px; border-bottom:1px solid #ddd">Site</th><th style="text-align:left; padding:6px; border-bottom:1px solid #ddd">What it applies to</th><th style="text-align:left; padding:6px; border-bottom:1px solid #ddd">Repetitive work it removes</th><th style="text-align:left; padding:6px; border-bottom:1px solid #ddd">Main safeguard</th></tr>
      </thead>
      <tbody>
        <tr><td style="padding:6px; border-bottom:1px solid #eee; vertical-align:top">LinkedIn</td><td style="padding:6px; border-bottom:1px solid #eee; vertical-align:top">Easy Apply jobs</td><td style="padding:6px; border-bottom:1px solid #eee; vertical-align:top">Multi-step forms and screening questions</td><td style="padding:6px; border-bottom:1px solid #eee; vertical-align:top">Skips jobs already applied to; pauses on questions it can't answer</td></tr>
        <tr><td style="padding:6px; border-bottom:1px solid #eee; vertical-align:top">Naukri</td><td style="padding:6px; border-bottom:1px solid #eee; vertical-align:top">Jobs with Naukri's own Apply</td><td style="padding:6px; border-bottom:1px solid #eee; vertical-align:top">The recruiter chatbot after each apply</td><td style="padding:6px; border-bottom:1px solid #eee; vertical-align:top">Stays within Naukri's daily limit at a human-like pace</td></tr>
        <tr><td style="padding:6px; border-bottom:1px solid #eee; vertical-align:top">Indeed</td><td style="padding:6px; border-bottom:1px solid #eee; vertical-align:top">"Easily apply" jobs</td><td style="padding:6px; border-bottom:1px solid #eee; vertical-align:top">Employer screening questions, in the same tab</td><td style="padding:6px; border-bottom:1px solid #eee; vertical-align:top">Skips jobs where you miss a required qualification; 20 to 45 s between jobs</td></tr>
      </tbody>
    </table></div>
    <p>On all three, jobs that send you to a company website are skipped. Those are worth applying to by hand when the role is a strong match.</p>

    <h2>A weekly plan for running all three</h2>
    <p>Here is a routine that works for a typical experienced candidate with a day job. Adjust the numbers to your plan and stage.</p>
    <ol>
      <li><strong>Sunday, 30 minutes:</strong> review last week's Applications tracker. Which site produced calls? Which titles? Tighten exclude words where results were off.</li>
      <li><strong>Morning, 5 minutes:</strong> start a Naukri run. Fresh Naukri listings fill up quickly, so morning is a good time.</li>
      <li><strong>Lunch, 5 minutes:</strong> start a LinkedIn run, or an Indeed run on alternate days.</li>
      <li><strong>Evening, 15 minutes:</strong> answer any questions waiting in the sidebar, then spend ten minutes on manual applications for the two or three best company-site jobs you saw.</li>
    </ol>
    <p>The point is that each run takes five minutes of your attention, not an hour of clicking.</p>

    <h2>One profile, three sites: keep it consistent</h2>
    <p>The biggest risk with three sites is contradicting yourself. A recruiter who sees 6 years on Naukri and 4 on LinkedIn will ask. Keep these identical everywhere:</p>
    <ul>
      <li>Total years of experience and current title.</li>
      <li>Current and expected CTC, in the same format.</li>
      <li>Notice period, including whether it can be bought out.</li>
      <li>The resume file. One master version, updated in all three places on the same day.</li>
    </ul>
    <p>With AutoApply CV, your answer bank and experience live in one dashboard and are reused on all three sites, so the extension gives the same answers everywhere.</p>

    <h2>How one dashboard handles three sites</h2>
    <ul>
      <li><strong>One allowance.</strong> LinkedIn, Naukri and Indeed share the same daily applies and Hires. The free plan gives 3 auto-applies a day plus 30 Hires on signup; Pro at ₹99/month is unlimited on all three. Skipped and failed jobs are not charged.</li>
      <li><strong>One tracker.</strong> Every confirmed application, from any of the three sites, appears in the Applications tracker with role, company and date.</li>
      <li><strong>One answer bank.</strong> Notice period, CTC and relocation answers are saved once and reused.</li>
      <li><strong>Site-specific filters.</strong> Each site has its own search settings, because a good Naukri search and a good Indeed search do not look the same.</li>
    </ul>

    <h2>Which to prioritise if you only have time for one</h2>
    <ul>
      <li><strong>Fresher or early career, any industry:</strong> Naukri first, Indeed second.</li>
      <li><strong>Tech, product or corporate, 3+ years:</strong> LinkedIn first, with direct recruiter outreach, then Naukri.</li>
      <li><strong>Local, non-IT or shift-based roles:</strong> Indeed first, with a tight radius.</li>
      <li><strong>Senior or niche roles:</strong> LinkedIn, mostly manual, plus recruiter messages. With only a few right openings, automation matters less than a good note.</li>
    </ul>
    <p>For a broader comparison that also covers company career sites, see <a href="/blog/auto-apply-job-boards-linkedin-indeed-company">LinkedIn vs Indeed vs company sites</a>.</p>

    <h2>Beyond applying: reaching recruiters directly</h2>
    <p>Applications are one channel. On LinkedIn, many recruiters publish hiring posts with their email or WhatsApp number, and AutoApply CV can help you reach them by WhatsApp or email. If you want those contacts delivered to you, the Pro Connect plan (₹500/month) adds 20 matched <a href="/hr-whatsapp-contacts">HR contacts</a> a day on top of everything in Pro.</p>

    <h2>Frequently asked questions</h2>
    <h3>Do I need three different tools?</h3>
    <p>No. One AutoApply CV extension works on LinkedIn, Naukri and Indeed, with one dashboard and one tracker.</p>
    <h3>Will applying on all three look like spam?</h3>
    <p>Not if your filters are narrow. Applying to the same company on two sites is usually fine; applying to jobs you don't fit is what hurts.</p>

    <h2>Your next step</h2>
    <p>Look at your last 20 applications and count which site each came from and which led to a call. Then <a href="/signup">sign up free</a>, set up filters for the site that worked best, and add the other two over the week. The guides for <a href="/auto-apply-linkedin">LinkedIn</a>, <a href="/naukri-auto-apply">Naukri</a> and <a href="/indeed-auto-apply">Indeed</a> explain each one, and <a href="/pricing">pricing</a> lists the plans.</p>
  `,

  "hr-whatsapp-number-for-job-message-recruiters": `
    <p>The most reliable way to get an HR WhatsApp number for a job in India is to take it from the recruiter's own hiring post. Many recruiters write "share your CV on WhatsApp" or "DM me" with their number or email in a LinkedIn post, because they want candidates to contact them. A number found that way is one the recruiter chose to share for hiring, which is very different from a number scraped from a company directory or bought from a list. This post covers where to find these contacts, what to send, when to send it, and the etiquette that decides whether a recruiter replies or blocks you.</p>

    <h2>Where HR WhatsApp numbers legitimately come from</h2>
    <ul>
      <li><strong>LinkedIn hiring posts.</strong> Search LinkedIn posts (not jobs) for phrases like "hiring", "immediate joiners", "share your resume" plus your role and city. Recruiters often include a number or email.</li>
      <li><strong>Job descriptions</strong> that list a contact person.</li>
      <li><strong>Referrals.</strong> A friend at the company passes on the recruiter's details with their permission.</li>
    </ul>
    <p>Avoid paid "HR database" lists sold on Telegram or WhatsApp groups. The numbers are often old, the people on them never agreed to be contacted, and messaging them is far more likely to get you reported than hired.</p>

    <h2>Getting matched contacts without searching every day</h2>
    <p>Searching LinkedIn posts by hand works, but it takes time every day. AutoApply CV's HR Contacts feature does the collecting for you: it gathers recruiter numbers and emails that recruiters shared publicly in LinkedIn hiring posts, checks that phone numbers are on WhatsApp, and matches them to the target roles in your profile. You get 20 new recruiter contacts a day, emailed every morning at about 9 AM IST and listed in your dashboard, where you can message them free in one click. It is part of the Pro Connect plan at ₹500/month, which also includes everything in Pro. Details are on the <a href="/hr-whatsapp-contacts">HR WhatsApp contacts page</a>.</p>

    <h2>What to send: the first message</h2>
    <p>A recruiter with an open role may receive dozens of messages a day on WhatsApp. Yours should take ten seconds to read and give them everything they need to decide. Include:</p>
    <ol>
      <li>The role and the post you saw, so they know which opening you mean.</li>
      <li>Your total experience and current title.</li>
      <li>Notice period.</li>
      <li>Current location, and whether you can relocate if the job is elsewhere.</li>
      <li>Your resume as a PDF, in the same message.</li>
    </ol>
    <p>An example for a mid-level role:</p>
    <blockquote>Hi Priya, I saw your LinkedIn post for a QA Automation Engineer in Pune. I have 4 years in Selenium and API testing with Java at a fintech company, 30 days notice, currently in Pune. Resume attached. Happy to share anything else you need. Thanks, Rahul</blockquote>
    <p>And one for a fresher:</p>
    <blockquote>Hi Arjun, I saw your post about fresher hiring for Customer Support in Hyderabad. I'm a 2026 B.Com graduate, fluent in English, Hindi and Telugu, available to join immediately, based in Hyderabad. Resume attached. Thank you, Sneha</blockquote>
    <p>Notice what these do not include: a long introduction, "Respected Sir/Madam", a request to "please check my profile", or a voice note. Recruiters read text faster than they listen to audio, and many will not open a voice note from an unknown number.</p>

    <h2>Timing</h2>
    <ul>
      <li><strong>Working hours, working days.</strong> Between about 10 AM and 6 PM, Monday to Friday, is a safe window. Avoid late nights and early mornings; a message at 11 PM feels intrusive on a personal phone.</li>
      <li><strong>Soon after the post.</strong> A hiring post is most active in its first few days. That is one reason daily contacts are useful: they are fresh.</li>
      <li><strong>Follow up once.</strong> If there is no reply after three or four working days, one short follow-up is fine: "Hi Priya, just following up on the QA role. Still very interested." After that, move on.</li>
    </ul>

    <h2>Etiquette that gets replies</h2>
    <ul>
      <li><strong>Only message for roles you fit.</strong> If the post asks for 5+ years and you have 1, don't. You use up the recruiter's goodwill for nothing.</li>
      <li><strong>One message, not five.</strong> Send your full message in one go instead of "Hi", then "Sir", then the resume.</li>
      <li><strong>Don't call unless invited.</strong> A WhatsApp number shared for CVs is not an invitation to phone.</li>
      <li><strong>Don't add them to groups</strong> or forward chain messages. Ever.</li>
      <li><strong>Take "no" or silence gracefully.</strong> A polite candidate is remembered for the next opening.</li>
      <li><strong>Email when they asked for email.</strong> If the post says "send your CV to" an email address, use email, with the role in the subject line.</li>
    </ul>

    <h2>Privacy and opt-out</h2>
    <p>A recruiter's number is personal data even when they shared it in a public post. They shared it for a specific reason, hiring, so use it only for that. Don't pass numbers on to friends, post them in groups, or save them for unrelated purposes.</p>
    <p>On our side, contacts in HR Contacts come only from public LinkedIn hiring posts, and any recruiter who doesn't want their number or email shared can remove it at <a href="/remove-my-contact">/remove-my-contact</a>. If you are a recruiter reading this, that page takes under a minute.</p>

    <h2>Combine outreach with applications</h2>
    <p>Direct messages work best alongside applications, not instead of them. A practical routine: let auto-apply handle <a href="/auto-apply-linkedin">LinkedIn</a>, <a href="/naukri-auto-apply">Naukri</a> and <a href="/indeed-auto-apply">Indeed</a> in the background, and spend fifteen minutes each morning messaging the few recruiters whose roles fit you best. For more on short outreach routines, see <a href="/blog/auto-apply-networking-10-minute-addon">the 10-minute networking add-on</a>.</p>

    <h2>Frequently asked questions</h2>
    <h3>Is it okay to message HR on WhatsApp for a job?</h3>
    <p>Yes, when the recruiter shared the number for hiring and your message is short, relevant and sent during working hours.</p>
    <h3>Should I send my resume in the first message?</h3>
    <p>Yes. Attach it as a PDF so the recruiter doesn't need to ask.</p>
    <h3>How many contacts does Pro Connect include?</h3>
    <p>20 new recruiter contacts a day, matched to your target roles. See <a href="/pricing">pricing</a> for plan details.</p>

    <h2>Your next step</h2>
    <p>Write your own version of the first message above, with your role, experience, notice period and location, and save it in your phone's notes. Then find one hiring post for your role today and send it.</p>
  `,

  "ai-interview-assistant-live-interview-guide": `
    <p>An AI interview assistant is a tool that listens to a live interview and shows you short prompts while you talk. Used well, it works like the notes you would keep beside you on a phone interview: your project details, numbers and key points, appearing when the question needs them. Used badly, it turns you into someone reading from a screen, and interviewers notice that quickly. This post explains how AutoApply CV's Interview Call AI works, how to prepare notes that make it useful, how to set it up so it can actually hear the call, and how to use it honestly.</p>

    <h2>How Interview Call AI works</h2>
    <p>Interview Call AI is a page in your AutoApply CV dashboard. You keep it open during an interview or client call. It listens through your microphone, and when the other person finishes a question and stops talking, it shows a short answer to that question, built from your own notes.</p>
    <ul>
      <li>It works with any call app: Zoom, Google Meet, Microsoft Teams, or a phone call on speaker.</li>
      <li>It understands English, Hindi and Hinglish.</li>
      <li>There is no extension to install and no bot joins your meeting.</li>
      <li>Nothing from the call is saved.</li>
    </ul>
    <p>It is included in the Pro Connect plan at ₹500/month, with HR Contacts and everything in Pro. More detail is on the <a href="/interview-call-ai">Interview Call AI page</a>.</p>

    <h2>Your notes are the whole product</h2>
    <p>Because answers are built from your notes, the quality of what you see depends on what you write before the call. Generic notes give generic prompts. Specific notes give you the exact project name, number or example you were trying to remember. Spend 30 to 45 minutes preparing them for each important interview.</p>
    <h3>What to put in your notes</h3>
    <ul>
      <li><strong>A 60-second introduction</strong> in bullet points: current role, years, two strongest areas, why you are looking.</li>
      <li><strong>Three to five projects</strong>, each with the problem, what you did, the tools, and one result with a number. For example: "Payments reconciliation: built Python job replacing manual Excel work, cut daily effort from 3 hours to 20 minutes."</li>
      <li><strong>Behavioural stories</strong> for the usual questions: a conflict with a teammate, a deadline you missed or nearly missed, a time you disagreed with your manager.</li>
      <li><strong>The basics recruiters always ask:</strong> notice period, current and expected CTC, reason for change, relocation.</li>
      <li><strong>Points about the company and role</strong> from the job description, so the prompts connect your experience to what they need.</li>
      <li><strong>Questions you want to ask them</strong> at the end.</li>
    </ul>
    <p>Write in short phrases, not paragraphs. A prompt you can read in two seconds is useful; a paragraph is not.</p>

    <h2>Setup: make sure it can hear both sides</h2>
    <p>Interview Call AI hears the conversation through your microphone, so the interviewer's voice has to reach the mic.</p>
    <ol>
      <li><strong>Use laptop speakers, not headphones.</strong> With headphones, the mic hears only you. Keep the speaker volume at a normal level.</li>
      <li><strong>For phone interviews,</strong> put the phone on speaker next to the laptop.</li>
      <li><strong>Allow microphone access</strong> when the browser asks.</li>
      <li><strong>Choose a quiet room.</strong> Fans, traffic and TV noise make it harder to pick up questions.</li>
      <li><strong>Arrange your screen.</strong> Put the Interview Call AI page close to your camera, for example just under it, so glancing at it doesn't look like looking away.</li>
      <li><strong>Do a test call</strong> with a friend the day before. Ask them five questions you expect, see what appears, and add notes for anything that came up empty.</li>
    </ol>

    <h2>How to use it honestly: a prompt, not a script</h2>
    <p>This is the most important part of the post. An interviewer is trying to find out how you think and whether you really did the work on your resume. If you read answers word for word, three things go wrong: your voice goes flat, your eyes move across the screen, and you cannot handle the follow-up question, because the follow-up is always about something you said.</p>
    <p>Use it the way you would use a paper note:</p>
    <ul>
      <li><strong>Glance, then talk.</strong> Read the two or three points, look back at the camera, and answer in your own words.</li>
      <li><strong>Let it remind you, not decide for you.</strong> If the prompt suggests a project but a different one fits better, use the better one.</li>
      <li><strong>Pause naturally.</strong> "Let me think of a good example" is a normal thing to say in an interview.</li>
      <li><strong>Never claim what isn't true.</strong> The prompts come from your notes, so keep your notes truthful. Anything you say in an interview can come up again in a technical round or a background check.</li>
    </ul>
    <p>Also respect the rules of the interview you are in. Some companies, especially for online assessments or proctored coding rounds, explicitly say no external help is allowed. If a process says that, follow it. The tool is meant to help you remember your own experience, not to stand in for knowledge you don't have.</p>

    <h2>Beyond job interviews</h2>
    <ul>
      <li><strong>Client and sales calls:</strong> add notes about your services, pricing and past work, and get a reminder when a client asks something you have covered.</li>
      <li><strong>Practice sessions:</strong> run it during a mock interview to find gaps in your notes, then fill them.</li>
      <li><strong>Interviews in Hinglish:</strong> many Indian interviews switch between English and Hindi, and Interview Call AI understands both.</li>
    </ul>

    <h2>Frequently asked questions</h2>
    <h3>Does the interviewer see the AI interview assistant?</h3>
    <p>Nothing joins your meeting. Interview Call AI is a page in your own browser, listening through your microphone.</p>
    <h3>Is my interview recorded?</h3>
    <p>No. Nothing from the call is saved. Close the page and it is gone.</p>
    <h3>Will it get me the job?</h3>
    <p>No tool can promise that. It helps you remember your own points under pressure; your preparation and your answers do the rest.</p>

    <h2>Your next step</h2>
    <p>Before your next interview, write your 60-second introduction and three project stories as short bullet points. That is useful with or without any tool. If you want those notes on screen during the call, Interview Call AI comes with Pro Connect; see <a href="/pricing">pricing</a> or <a href="/signup">sign up</a> to start.</p>
  `,
};
