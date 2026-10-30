// Hand-written bodies for the profile and strategy posts in EXTRA_TITLES (src/content/blogPosts.ts), keyed by slug.
export const PROFILE_ARTICLES: Record<string, string> = {
  "auto-apply-linkedin-headline-templates": `
    <p>The LinkedIn headline that works best alongside auto apply is short and literal: the job title you are applying for, two or three skills that appear in those job posts, and one concrete proof point. Recruiters search LinkedIn by title and skill, and when your application lands in their inbox the headline is the first line they read next to your name. A headline like "Passionate learner | Dreamer | Open to work" tells them nothing. "Backend Engineer | Java, Spring Boot, AWS | Payments at scale" tells them in two seconds whether to open your profile.</p>

    <h2>Why the headline matters more when you apply in volume</h2>
    <p>When you send applications by hand, you might write a note or tailor a cover letter. When you use a tool to submit LinkedIn Easy Apply forms, the recruiter sees your application card: photo, name, headline, current role, and the resume you attached. There is no extra context. If the headline matches the title of the job they posted, your card looks like a fit before anyone opens the resume. If it says something vague, it looks like a stray application, even when your experience is strong.</p>
    <p>The headline is also indexed by LinkedIn search. Recruiters on LinkedIn Recruiter and regular search type phrases like "React Native developer Bengaluru" or "SAP FICO consultant". Words in your headline count heavily in those matches, so the same line that helps your applications also helps inbound messages.</p>

    <h2>The basic formula</h2>
    <p>Most good headlines follow one pattern:</p>
    <p><strong>[Target title] | [Skill 1], [Skill 2], [Skill 3] | [Proof point or domain]</strong></p>
    <ul>
      <li><strong>Target title:</strong> use the exact wording companies put in job posts, not your internal title. If your company calls you "Member of Technical Staff II" but you apply for "Software Engineer" roles, write "Software Engineer".</li>
      <li><strong>Skills:</strong> pick the three that appear most often in the posts you are targeting. Not ten. Three is readable on mobile, where the headline gets cut off.</li>
      <li><strong>Proof point:</strong> a domain, scale, or result you can defend in an interview. "Fintech", "B2B SaaS", "Cut cloud spend 30%" (only if true), "Ex-Flipkart".</li>
    </ul>
    <p>LinkedIn allows up to 220 characters, but the first 60 to 70 are what show on most application cards and search results. Put the title and first skill there.</p>

    <h2>Templates for engineering roles</h2>
    <ul>
      <li>Fresher: <em>Software Engineer (Fresher) | Java, DSA, SQL | B.Tech CSE 2026 | Built [project name]</em></li>
      <li>Junior frontend: <em>Frontend Developer | React, TypeScript, Tailwind | Shipped [number] production features at [company]</em></li>
      <li>Mid-level backend: <em>Backend Engineer | Node.js, PostgreSQL, Kafka | [Domain] platforms serving [scale]</em></li>
      <li>Full stack: <em>Full Stack Developer | MERN, Next.js, AWS | Building SaaS products end to end</em></li>
      <li>Mobile: <em>Android Developer | Kotlin, Jetpack Compose | Apps with [number] Play Store downloads</em></li>
      <li>Senior or lead: <em>Senior Software Engineer | Distributed Systems, Go, GCP | Leading a team of [number] at [company]</em></li>
      <li>DevOps or SRE: <em>DevOps Engineer | Kubernetes, Terraform, CI/CD | Reliability for [type of product]</em></li>
      <li>QA: <em>QA Automation Engineer | Selenium, Playwright, API Testing | [Domain] apps</em></li>
    </ul>

    <h2>Templates for data, product and design</h2>
    <ul>
      <li>Data analyst: <em>Data Analyst | SQL, Power BI, Python | Retail and e-commerce analytics</em></li>
      <li>Data engineer: <em>Data Engineer | Spark, Airflow, Snowflake | Pipelines for [domain]</em></li>
      <li>ML engineer: <em>Machine Learning Engineer | PyTorch, LLMs, MLOps | Models in production at [company]</em></li>
      <li>Product manager: <em>Product Manager | B2B SaaS, Growth, Payments | Launched [product or feature]</em></li>
      <li>Associate PM: <em>Associate Product Manager | User Research, SQL, Roadmapping | Ex-[company] intern</em></li>
      <li>UI/UX designer: <em>Product Designer | Figma, Design Systems, UX Research | Portfolio: [short domain]</em></li>
    </ul>

    <h2>Templates for non-tech and support roles</h2>
    <ul>
      <li>Sales: <em>Inside Sales Executive | B2B SaaS, CRM, Lead Qualification | Consistently above quota</em> (only if you can show it)</li>
      <li>HR: <em>HR Generalist | Talent Acquisition, Payroll, HRMS | Manufacturing and IT services</em></li>
      <li>Finance: <em>Chartered Accountant | Statutory Audit, GST, IFRS | Big 4 experience</em></li>
      <li>Customer support: <em>Customer Success Associate | Zendesk, Onboarding, Retention | SaaS support for global clients</em></li>
      <li>Operations: <em>Operations Manager | Supply Chain, Vendor Management, Excel | Quick commerce</em></li>
    </ul>

    <h2>Templates for career switchers and gaps</h2>
    <p>If you are moving from one field to another, lead with the role you want and back it up with what you have already done in that direction.</p>
    <ul>
      <li><em>Data Analyst | SQL, Tableau | Moving from 4 years in banking operations</em></li>
      <li><em>Software Developer | Python, Django | Career switcher, 3 shipped projects</em></li>
      <li><em>Product Manager | Ex-Consultant | Fintech and lending products</em></li>
      <li>After a break: <em>Frontend Engineer | React, Accessibility | Returning after a planned career break</em></li>
    </ul>
    <p>Do not hide a switch with a vague headline. Recruiters will see your work history anyway. A clear target title makes it obvious why you applied.</p>

    <h2>Match the headline to your auto apply filters</h2>
    <p>The most common mismatch we see is a headline for one role and job filters for another. Someone sets their search to "Data Analyst" but their headline still says "Mechanical Engineer at XYZ". Every application then looks off-target.</p>
    <p>Before you start a run with the <a href="/auto-apply-chrome-extension">AutoApply CV Chrome extension</a>, check three things line up:</p>
    <ol>
      <li>The job titles in your search settings.</li>
      <li>The title in your headline.</li>
      <li>The title at the top of the resume you attach.</li>
    </ol>
    <p>If you target two different roles, say backend and DevOps, pick the one you apply to most and put that in the headline. Mention the other as a skill. Splitting the headline between two titles weakens both.</p>

    <h2>What to leave out</h2>
    <ul>
      <li>"Open to work", "Looking for opportunities", "Seeking job". The green frame already says this, and the words waste your first 30 characters.</li>
      <li>Emoji strings and decorative symbols. They break search matching and look odd on application cards.</li>
      <li>Every tool you have ever touched. A list of fifteen technologies reads as a keyword dump.</li>
      <li>Claims you cannot back up, like "Top 1% developer" or "Expert in everything AI".</li>
      <li>Current company only, with no title, such as "Working at Infosys". Recruiters need the role, not just the employer.</li>
    </ul>

    <h2>Test and adjust</h2>
    <p>A headline is not permanent. Change one element at a time and watch your results for about two weeks: profile views, recruiter messages, and replies to applications in your tracker. If you swap "Full Stack Developer" for "Backend Engineer" and start getting more backend interview calls, that tells you something about which title the market reads you as. The <a href="/blog/auto-apply-tracking-what-to-measure">weekly tracking guide</a> covers which numbers to watch and how to avoid reading too much into a few days of data.</p>
    <p>The headline works together with the keywords on your resume. If you have not checked those yet, <a href="/blog/auto-apply-keywords-how-to-choose-skill-tags">our guide to choosing skill tags</a> explains how to pull the right terms from job posts.</p>

    <h2>Next step</h2>
    <p>Open five job posts you would genuinely apply to today. Write down the exact title and the three skills that appear in most of them. Build your headline from those words using one template above, save it on LinkedIn, then set the same title in your search settings before your next auto apply run.</p>
  `,

  "auto-apply-cover-letters-when-to-skip": `
    <p>Skip the cover letter when the form does not ask for one or marks it optional on a high-volume Easy Apply job. Write or generate one when the field is required, when the company is small or the role is senior, or when you need to explain something your resume cannot, like a relocation, a career switch, or a gap. For most LinkedIn Easy Apply jobs, a clear resume and accurate screening answers matter far more than a letter nobody opens.</p>

    <h2>How recruiters actually handle cover letters</h2>
    <p>On a large Easy Apply posting, a recruiter may receive hundreds of applications in the first few days. They typically scan the application card and resume, and filter by screening answers. An optional cover letter is often not opened at all at this stage. That does not mean letters are useless. It means their value depends on the setting.</p>
    <p>At a 20-person startup, the founder or hiring manager often reads every application personally. A short, specific note can tip the decision. In a senior search, say a head of engineering role, the hiring panel wants to understand your thinking, and a letter is one of the few places to show it before an interview. For a fresher drive at a large IT services company, the letter almost never matters.</p>

    <h2>A simple decision rule</h2>
    <p>Ask these questions in order. The first "yes" decides it.</p>
    <ol>
      <li><strong>Is the cover letter field required?</strong> Then you need one. A blank or placeholder letter is worse than none.</li>
      <li><strong>Do you need to explain something?</strong> Relocating from Pune to Dubai, switching from teaching to UX, returning after a two-year break. Write one, even if optional.</li>
      <li><strong>Is it a small company or a role you really want?</strong> Write a short, personal one by hand.</li>
      <li><strong>Is it a senior or leadership role?</strong> Write one, focused on one or two outcomes.</li>
      <li><strong>None of the above?</strong> Skip it and spend the time on your resume and answers.</li>
    </ol>

    <h2>When to skip</h2>
    <ul>
      <li>High-volume roles with optional letters: support, sales development, junior developer roles at large companies.</li>
      <li>Easy Apply forms that only offer a resume upload with no letter field.</li>
      <li>Campus or mass hiring drives where shortlisting is by test score or degree filters.</li>
      <li>Jobs where you are a borderline fit and would be applying mainly to stay active. A letter will not fix the mismatch.</li>
    </ul>
    <p>Skipping here is not laziness. It frees time for things that change outcomes more, such as tailoring the resume top section or sending a message to someone on the team.</p>

    <h2>When to write one yourself</h2>
    <p>Write by hand when the job is on your shortlist of "would accept tomorrow". A good handwritten letter is not long. Four short paragraphs is enough:</p>
    <ol>
      <li>Which role, and one sentence on why this company specifically. Mention something real, like a product you use or a recent launch.</li>
      <li>The single most relevant thing you have done, with a concrete detail.</li>
      <li>Anything that needs explaining: notice period, relocation, visa status, switch.</li>
      <li>A one-line close. No "I look forward to hearing from you at your earliest convenience".</li>
    </ol>
    <p>Example for a backend role at a Bengaluru fintech: "I use your app for my rent payments, and I noticed the recent UPI autopay launch. At my current company I rebuilt the reconciliation service that matches 2 lakh daily transactions against bank files, and I would like to work on the same kind of problem at your scale. I am serving a 60-day notice and can join in early January."</p>
    <p>That is specific, short, and checkable in an interview.</p>

    <h2>When to generate one</h2>
    <p>Generated letters make sense in the middle band: the field is required or strongly suggested, the job is a reasonable fit, but you are not going to spend 20 minutes on it. AutoApply CV Pro includes a cover letter generator, and the same rules apply to any tool you use.</p>
    <ul>
      <li><strong>Feed it the actual job post.</strong> A letter generated from your resume alone will be generic.</li>
      <li><strong>Read it before it goes out.</strong> Check every claim. If it says you "led a team" and you did not, delete it.</li>
      <li><strong>Cut it by a third.</strong> Generated text tends to be padded. Shorter reads as more confident.</li>
      <li><strong>Remove filler phrases</strong> like "I am writing to express my keen interest", "dynamic environment", "proven track record".</li>
      <li><strong>Add one detail only you know</strong>, such as a project name or a number from your work.</li>
    </ul>
    <p>A generated letter you have edited for five minutes is fine. A generated letter you never read is a risk, because it may contain claims that will come up in an interview.</p>

    <h2>Cover letters and auto apply</h2>
    <p>The <a href="/auto-apply-linkedin">LinkedIn auto apply</a> flow in AutoApply CV fills Easy Apply forms using your saved profile, resume, and screening answers. When a form asks for something it does not have a truthful saved answer for, the run pauses so you can answer it yourself rather than guessing. That is the right behaviour for cover letters too: a required letter field on a job you care about deserves your attention, not a filler paragraph.</p>
    <p>A practical split many people use:</p>
    <ul>
      <li>Let automation handle the wide set of matching Easy Apply jobs where a letter is optional.</li>
      <li>Keep a separate short list of five to ten companies each week where you apply by hand with a written letter.</li>
      <li>Track both groups in the same dashboard so you can see which approach gets replies for your profile.</li>
    </ul>

    <h2>Mistakes that hurt more than skipping</h2>
    <ul>
      <li>Wrong company name. It happens often with reused letters, and it ends the application.</li>
      <li>Repeating the resume line by line. The letter should add context, not duplicate.</li>
      <li>Salary demands or negotiating terms in the letter. Use the screening question for that.</li>
      <li>Over-apologising for gaps or lack of experience. State the fact once and move on.</li>
      <li>A full page for an entry-level role. Half a page is plenty.</li>
    </ul>

    <h2>What to do with the time you save</h2>
    <p>If you skip letters on most applications, put that time somewhere with a clearer payoff. Tighten your resume summary for the role family (see <a href="/blog/auto-apply-resume-tips-ats-keywords">resume tips for ATS keywords</a>), or spend ten minutes finding the recruiter or hiring manager for your top jobs and sending a direct note, as explained in <a href="/blog/auto-apply-networking-10-minute-addon">the networking add-on guide</a>.</p>

    <h2>Next step</h2>
    <p>Look at the jobs you plan to apply to this week and sort them into two groups: "letter required or top choice" and "everything else". Write or generate and edit letters only for the first group, and let the second go through with a strong resume and your saved answers.</p>
  `,

  "auto-apply-networking-10-minute-addon": `
    <p>The add-on is simple: after your auto apply run each day, spend ten minutes sending short, direct messages to a recruiter or team member at two or three of the companies you just applied to. The aim is to roughly double the replies you would get from applications alone. We cannot promise a fixed multiplier, because results depend on your profile, role, and market, but the mechanism is sound: a message puts a human name next to an application that would otherwise sit in a queue with hundreds of others.</p>

    <h2>Why an application alone often gets no reply</h2>
    <p>An Easy Apply submission goes into the employer's applicant list. The recruiter may be handling ten open roles, and many applications are never reviewed in detail. Your resume can be a good fit and still not be read simply because of timing or volume.</p>
    <p>A direct message changes that in three ways:</p>
    <ul>
      <li><strong>It creates a second entry point.</strong> The recruiter sees your name in their inbox, not just in an applicant list.</li>
      <li><strong>It signals intent.</strong> You applied and followed up, which suggests you are not spraying applications blindly.</li>
      <li><strong>It gives them a reason to look now.</strong> A specific line about the role makes it easy to open your profile.</li>
    </ul>
    <p>None of this needs a long relationship. It needs a relevant, polite, short note to the right person.</p>

    <h2>The 10-minute routine</h2>
    <ol>
      <li><strong>Minutes 1 to 2: pick targets.</strong> Open your applications tracker and choose two or three of today's jobs that fit you best. Ignore the borderline ones.</li>
      <li><strong>Minutes 3 to 5: find a person.</strong> On the job post, check "Meet the hiring team". If no one is listed, search LinkedIn for "[Company] recruiter" or "[Company] talent acquisition" filtered by your city, or find an engineering manager in the relevant team.</li>
      <li><strong>Minutes 6 to 9: send messages.</strong> Use a connection note (it has a short character limit) or a direct email if you have one. Keep it under 80 words.</li>
      <li><strong>Minute 10: log it.</strong> Note who you messaged and when, so you can follow up once after five to seven working days.</li>
    </ol>
    <p>Doing this right after the run matters. The application is fresh, and your message arrives while the posting is still active.</p>

    <h2>Message templates</h2>
    <p>To a recruiter, after applying:</p>
    <p><em>Hi Priya, I just applied for the Backend Engineer role (Java, Spring Boot) at [Company]. I have 3 years building payment services at [current company] and can join within 30 days. Happy to share anything that helps your review. Thanks, Arjun</em></p>
    <p>To a hiring manager or team member:</p>
    <p><em>Hi Daniel, I applied for the Data Analyst opening on your team. I currently build SQL and Power BI reporting for a retail chain with 200 stores, which looks close to what the role describes. If you are the right person, I would value a quick look at my profile.</em></p>
    <p>For a referral from an alumnus or ex-colleague:</p>
    <p><em>Hi Sneha, we were both at NIT Trichy (I graduated in 2022). I have applied for the QA Automation role at [Company]. If you think I am a reasonable fit after seeing my profile, would you be open to referring me? No worries if not.</em></p>
    <p>Notice what these share: the role name, one concrete fact, an easy ask, and no attachment dumps or long life stories.</p>

    <h2>What not to send</h2>
    <ul>
      <li>"Hi sir, please check my profile and give me job." No role, no reason, no context.</li>
      <li>Messages to the CEO of a 5,000-person company about a junior role.</li>
      <li>The same message to five people at the same company on the same day. It looks automated even if it was not.</li>
      <li>Follow-ups every two days. One follow-up is polite. Three is pressure.</li>
      <li>Asking for a job directly from someone you have never spoken to, outside of a specific application.</li>
    </ul>

    <h2>Using recruiter contacts and cold email</h2>
    <p>LinkedIn connection requests have limits, and many recruiters rarely check LinkedIn messages. Email often works better for the follow-up. AutoApply CV Pro includes HR Outreach, which gives you recruiter contact details, and an Apply Email feature for sending cold emails to recruiters from your dashboard. You can see how these fit with the rest of the product on the <a href="/features">features page</a>.</p>
    <p>The same rules apply to email: one relevant role in the subject line ("Application: Backend Engineer, 3 yrs Java"), a short body, your resume attached or linked, and a single follow-up. Do not send the same email to a large list without personalising the first line. Recruiters can tell, and it hurts your reputation with that company.</p>

    <h2>How to tell if it is working</h2>
    <p>Run it as a simple experiment for two to three weeks. In your tracker, mark which applications got a message and which did not. Compare the reply rates between the two groups. If the messaged group gets noticeably more responses, keep going. If not, look at the messages themselves: are you contacting the right people, and is the note specific enough?</p>
    <p>Keep the groups comparable. If you only message for your best-fit jobs, those would probably get more replies anyway. A fairer test is to message for every other good-fit application and leave the rest as the control. The <a href="/blog/auto-apply-rejections-diagnose-callbacks">guide to diagnosing low callback rates</a> covers how to read these numbers without fooling yourself.</p>

    <h2>Why this pairs well with automation</h2>
    <p>Auto apply saves you the hour you would spend clicking through forms. Networking is the part a tool should not fake, because it depends on judgment and real conversations. Putting the saved time into ten minutes of human outreach is a better trade than either doing everything by hand or automating everything.</p>
    <p>If you are on the free plan with 3 auto-apply actions per day, this routine fits naturally: three careful applications, then a message for each. That is a small, focused daily habit that many people find more productive than mass applying. Upgrade options for unlimited runs and recruiter contacts are on the <a href="/pricing">pricing page</a>.</p>

    <h2>Next step</h2>
    <p>Tomorrow, after your run finishes, set a ten-minute timer. Pick the two best-fit jobs from the run, find one person at each company, and send the recruiter template above with your own details. Log both in your tracker and set a reminder to follow up in a week.</p>
  `,

  "auto-apply-job-boards-linkedin-indeed-company": `
    <p>LinkedIn, Indeed, and company career sites each have a place in a job search, but they behave differently. LinkedIn Easy Apply is the fastest to apply through and the only one of the three that AutoApply CV automates. Indeed has wide coverage, especially for non-tech and mid-market roles, but you apply there yourself. Company career sites are slower but often give your application a more direct route to the hiring team. A good plan uses LinkedIn automation for volume and spends your manual time on the other two where they matter most.</p>

    <h2>What AutoApply CV automates, plainly</h2>
    <p>Before comparing the boards, here is exactly what the tool does. The AutoApply CV Chrome extension automates <strong>LinkedIn Easy Apply only</strong>. It does not submit applications on Indeed, and it does not fill company career site forms. When a LinkedIn job sends you to an external company site to apply, the extension records that job as skipped in your tracker so you can apply manually later, and skipped jobs are not charged. If you want to understand the flow end to end, see <a href="/how-it-works">how it works</a>.</p>
    <p>We say this up front because some tools claim to apply everywhere. Workday, Greenhouse, Lever, SuccessFactors, and custom portals all differ, often need account creation, and ask questions that should not be guessed. Doing those yourself is the safer choice.</p>

    <h2>LinkedIn Easy Apply</h2>
    <p><strong>Strengths</strong></p>
    <ul>
      <li>Short forms: contact details, resume, a handful of screening questions.</li>
      <li>Strong coverage of tech, product, data, and corporate roles in India, the Gulf, Europe, and North America.</li>
      <li>Your profile travels with the application, so the recruiter sees your headline and history.</li>
      <li>Can be automated with saved, truthful answers, which is what makes it practical for daily volume.</li>
    </ul>
    <p><strong>Weaknesses</strong></p>
    <ul>
      <li>Easy to apply means many applicants. Popular posts can collect hundreds of applications quickly.</li>
      <li>Some listings are reposted or stay open long after the role is filled.</li>
      <li>Screening questions can filter you out instantly if answers are inconsistent, so the answer bank matters.</li>
    </ul>
    <p><strong>Best for:</strong> software engineers, analysts, designers, PMs, and most white-collar roles with one to ten years of experience.</p>

    <h2>Indeed</h2>
    <p><strong>Strengths</strong></p>
    <ul>
      <li>Broad coverage beyond tech: operations, healthcare, retail, logistics, BPO, customer service, and many mid-size employers that do not post on LinkedIn.</li>
      <li>Good for roles in tier-2 and tier-3 Indian cities where LinkedIn listings are thinner.</li>
      <li>Strong in the US, UK, and Canada for hourly and mid-market roles.</li>
    </ul>
    <p><strong>Weaknesses</strong></p>
    <ul>
      <li>Many listings redirect to company sites, so the "quick apply" experience varies a lot.</li>
      <li>More duplicate and aggregated listings, which makes it easy to apply twice to the same job.</li>
      <li>Your Indeed resume is separate from your LinkedIn profile, so it needs its own upkeep.</li>
    </ul>
    <p><strong>Best for:</strong> non-tech roles, regional searches, and filling gaps when LinkedIn results run dry. Apply manually, and keep a note of what you sent so you do not repeat it.</p>

    <h2>Company career sites</h2>
    <p><strong>Strengths</strong></p>
    <ul>
      <li>Your application goes straight into the employer's own applicant tracking system.</li>
      <li>Listings are usually current. If it is on the careers page, the role is likely still open.</li>
      <li>Some companies, especially large product companies and MNCs, post roles there first or only.</li>
      <li>Referrals are typically submitted through the same system, so a referred application lands in the same place.</li>
    </ul>
    <p><strong>Weaknesses</strong></p>
    <ul>
      <li>Slow. Account creation, re-typing your work history, long questionnaires.</li>
      <li>Every portal is different, so there is no reliable way to automate them safely.</li>
      <li>Applying to many roles at one company through its portal can look unfocused.</li>
    </ul>
    <p><strong>Best for:</strong> your top 10 to 20 target companies, roles where you have a referral, and senior positions.</p>

    <h2>How to split your week</h2>
    <p>A workable pattern for someone actively searching:</p>
    <ol>
      <li><strong>Daily:</strong> run LinkedIn Easy Apply automation with tight filters for your target titles and locations. Review what was submitted, skipped, and paused.</li>
      <li><strong>Two or three times a week:</strong> go through the skipped list. These are LinkedIn jobs that needed a company-site application. Apply manually to the ones that are a strong fit.</li>
      <li><strong>Once or twice a week:</strong> check Indeed for roles in your field and city, especially if you are in a non-tech function or a smaller city. Apply by hand.</li>
      <li><strong>Weekly:</strong> visit careers pages for your shortlist of dream companies, and ask for referrals where you have contacts.</li>
    </ol>
    <p>This keeps automation where it is reliable and puts your attention where judgment matters.</p>

    <h2>Avoiding duplicates across boards</h2>
    <p>The same job often appears on LinkedIn, Indeed, and the company site. Applying three times does not help and can look careless. Some practical rules:</p>
    <ul>
      <li>The extension skips LinkedIn jobs you have already applied to, but it cannot see your Indeed or career-site history. Keep a note of those manual applications.</li>
      <li>If you applied via Easy Apply, do not re-apply on the company site unless a recruiter asks you to.</li>
      <li>If you have a referral, use the channel the referrer recommends, usually the company portal.</li>
    </ul>

    <h2>Which one should a fresher focus on?</h2>
    <p>For freshers in India, LinkedIn Easy Apply gives reach, but many entry-level roles at large IT services firms go through campus drives or company portals. Use automation on LinkedIn for startups and mid-size product companies, and apply directly on career sites for mass hiring programmes. The guide on <a href="/blog/auto-apply-for-freshers-avoid-spam">auto apply for freshers</a> covers how to keep volume from turning into spam.</p>
    <p>For experienced professionals, LinkedIn is usually the main channel, with career sites reserved for target companies.</p>

    <h2>Next step</h2>
    <p>Open your applications tracker and filter for skipped jobs from the last week. Pick the three strongest fits that need a company-site application and apply to them by hand today. Then set your LinkedIn search filters so tomorrow's automated run covers the rest.</p>
  `,

  "auto-apply-keywords-how-to-choose-skill-tags": `
    <p>Choose skill tags by reading real job posts for the exact role you want, counting which skills appear again and again, and keeping only the ones you can genuinely discuss in an interview. Those words go in three places: your resume, your LinkedIn skills and headline, and your job search filters. Skills that convert are not the most impressive-sounding ones. They are the ones recruiters and applicant tracking systems are actually searching for in your target roles.</p>

    <h2>What "convert" means here</h2>
    <p>A skill tag converts when it helps move an application forward: it matches a recruiter's search, passes an ATS keyword screen, or makes your resume look relevant at a glance. A skill that appears in one in fifty job posts for your role does little. A skill that appears in most of them, which you have and which is missing from your resume, is costing you interviews.</p>

    <h2>Step 1: collect 15 to 20 job posts</h2>
    <p>Pick posts that you would genuinely apply to: same title, similar seniority, your preferred locations. Mix company sizes. For example, a mid-level frontend developer in Hyderabad might collect posts from two product startups, a fintech, an MNC captive centre, and a few remote-first companies.</p>
    <p>Copy the requirements section of each into a single document. Ignore the "about us" text.</p>

    <h2>Step 2: count and group</h2>
    <p>Go through the requirements and tally each skill. You will usually find three bands:</p>
    <ul>
      <li><strong>Core:</strong> appears in most posts. For a frontend role, this might be React, JavaScript, TypeScript, HTML, CSS.</li>
      <li><strong>Common:</strong> appears in roughly a third to half. Next.js, Redux, REST APIs, Jest, Git.</li>
      <li><strong>Occasional:</strong> appears in a few. GraphQL, Storybook, micro-frontends, Web Vitals.</li>
    </ul>
    <p>Your resume should cover every core skill you have, most common ones you have, and only the occasional skills that you are strong in or that match a specific company you are targeting.</p>

    <h2>Step 3: be honest about what you have</h2>
    <p>For each skill, ask: could I answer two technical questions about this without preparation? If yes, it belongs. If you used it once in a tutorial, leave it out or move it to a "familiar with" line. Listing skills you cannot defend gets you interviews you then fail, which wastes more time than no interview.</p>
    <p>This matters even more with automation. When your applications go out in volume, every inflated skill gets repeated across dozens of companies.</p>

    <h2>Step 4: use the employer's spelling</h2>
    <p>ATS keyword matching can be literal. If posts say "Node.js", write "Node.js", not "Node" or "NodeJS" alone. Some useful patterns:</p>
    <ul>
      <li>Write both the acronym and full form once: "Amazon Web Services (AWS)", "Search Engine Optimization (SEO)".</li>
      <li>Match version naming only when it matters: "Angular" is usually enough unless posts specify "AngularJS" for legacy work.</li>
      <li>Use standard tool names: "Microsoft Excel", "Power BI", "Google Analytics 4", "SAP S/4HANA".</li>
      <li>For soft skills, prefer concrete forms: "stakeholder management" and "client communication" are searched; "team player" is not.</li>
    </ul>

    <h2>Step 5: place skills where they count</h2>
    <p>A skills section alone is weak evidence. Recruiters trust skills that appear inside experience bullets.</p>
    <ul>
      <li><strong>Skills section:</strong> grouped by type (Languages, Frameworks, Cloud, Tools). Core skills first.</li>
      <li><strong>Experience bullets:</strong> each core skill should appear in at least one bullet with context. "Built a reporting dashboard in Power BI used by 40 regional managers" is stronger than "Power BI" in a list.</li>
      <li><strong>Summary:</strong> two or three core skills plus your target title.</li>
      <li><strong>LinkedIn:</strong> add the same core skills to your Skills section and pin the top ones. Put two or three in your headline (see <a href="/blog/auto-apply-linkedin-headline-templates">LinkedIn headline templates</a>).</li>
    </ul>

    <h2>Examples by role</h2>
    <p><strong>Data analyst (India, 2 to 4 years):</strong> core tags usually include SQL, Excel, Power BI or Tableau, Python, data visualisation. Common: statistics, A/B testing, stakeholder reporting. Occasional: dbt, BigQuery, Looker.</p>
    <p><strong>DevOps engineer:</strong> core tags often include Linux, Docker, Kubernetes, CI/CD, AWS or Azure, Terraform. Common: Jenkins or GitHub Actions, monitoring with Prometheus and Grafana, scripting in Bash or Python.</p>
    <p><strong>Product manager:</strong> core tags tend to be product roadmap, user research, PRDs, data analysis, stakeholder management, agile. Domain tags such as payments, B2B SaaS, or e-commerce often decide shortlisting.</p>
    <p><strong>Accounts executive:</strong> core tags may be Tally, GST, TDS, accounts payable, bank reconciliation, Excel. For MNCs, add SAP or Oracle if you have used them.</p>
    <p>Treat these as starting points. Your own count from real posts is what matters.</p>

    <h2>Connect skills to your auto apply filters</h2>
    <p>Skill tags are not only for the resume. Your search settings decide which jobs get applied to in the first place. If you are a React developer, searching "Software Engineer" alone will pull in Java, embedded, and SAP roles. Adding your core skill to your search terms ("React Developer", "Frontend Engineer React") narrows results to jobs where your resume keywords will actually match.</p>
    <p>A useful check: after a run, open five of the jobs that were submitted. Do your core skills appear in each? If not, tighten the job titles or keywords in your settings. The <a href="/auto-apply">auto apply overview</a> explains how search settings and daily limits work together.</p>

    <h2>Common mistakes</h2>
    <ul>
      <li><strong>Keyword stuffing.</strong> Thirty skills in white text or a giant comma list. Modern ATS and human reviewers both see through it.</li>
      <li><strong>One resume for every role.</strong> If you apply to both data analyst and data engineer roles, keep two versions with different core tags.</li>
      <li><strong>Old tags left in.</strong> jQuery, SVN, or Windows Server 2008 at the top signals an out-of-date profile unless the role needs them.</li>
      <li><strong>Missing the obvious.</strong> People forget to write "SQL" because it feels too basic. If it is in most posts, it goes on the resume.</li>
    </ul>

    <h2>Refresh every few weeks</h2>
    <p>Job requirements shift. Repeat the count every month or so, or whenever your reply rate drops. If a new skill starts appearing often and you have it, add it. For more on the resume side, see <a href="/blog/auto-apply-resume-tips-ats-keywords">resume tips for ATS keywords</a>.</p>

    <h2>Next step</h2>
    <p>Today, collect 15 job posts for your main target title and tally the skills. Mark the core skills you have but have not written into any experience bullet, and rewrite one bullet for each before your next application run.</p>
  `,

  "auto-apply-portfolio-what-to-link": `
    <p>Link the two or three pieces of work that best prove you can do the job you are applying for, and remove everything else. For engineers that usually means one strong GitHub repository or a live project, not a profile full of forks and tutorials. For designers, a focused case study site, not a Dribbble feed of unrelated shots. When applications go out in volume, every recruiter who clicks your link should land on something relevant within ten seconds.</p>

    <h2>Why fewer links work better</h2>
    <p>Recruiters screening applications spend very little time on each one. If your resume lists a GitHub, a personal site, a Behance, a Medium blog, a Kaggle profile, and a LeetCode link, they will click one at most, and probably the first. If that first link shows a half-finished to-do app from 2021, that becomes their impression of your work.</p>
    <p>A portfolio is evidence. One clear piece of evidence beats six scattered ones.</p>

    <h2>What to link, by role</h2>
    <h3>Software engineers</h3>
    <ul>
      <li>A GitHub profile with two to four pinned repositories that relate to your target role. A backend engineer might pin an API service with tests and a README that explains the design.</li>
      <li>A live deployed project, if you have one, with a link in the README.</li>
      <li>Open source contributions, linked as specific merged pull requests rather than the project home page.</li>
    </ul>
    <h3>Data analysts and data scientists</h3>
    <ul>
      <li>One or two projects with a clear question, the data used, and the conclusion. A public Power BI or Tableau dashboard works well.</li>
      <li>A notebook that reads like a short report, not raw cells with no explanation.</li>
      <li>Kaggle only if you have meaningful competition results or well-documented notebooks.</li>
    </ul>
    <h3>Designers</h3>
    <ul>
      <li>A portfolio site with three case studies: problem, your role, process, outcome. More detail on this is in <a href="/blog/auto-apply-designers-portfolio-ats-tips">portfolio and ATS tips for designers</a>.</li>
      <li>A Figma prototype link for one project if it adds something the case study cannot show.</li>
    </ul>
    <h3>Product managers</h3>
    <ul>
      <li>A short write-up of one product decision you drove, with the context and result. A one-page Notion or Google Doc is fine.</li>
      <li>A public product teardown, if you have no shipped product yet.</li>
    </ul>
    <h3>Writers, marketers, and content roles</h3>
    <ul>
      <li>Three to five published pieces in the format the job needs. Blog posts for content roles, campaign results for performance marketing.</li>
    </ul>

    <h2>What to remove</h2>
    <ul>
      <li><strong>Tutorial clones.</strong> Netflix clones, weather apps, calculator apps. They show you followed a course, not that you solved a problem. Keep one only if you added something real.</li>
      <li><strong>Unfinished projects</strong> with no README, broken builds, or "coming soon" pages.</li>
      <li><strong>Unrelated work.</strong> If you are applying for backend roles, your college Arduino project does not need to be pinned.</li>
      <li><strong>Dead links.</strong> Expired Heroku apps, old free-tier hosting, domains you stopped paying for. A broken link is worse than no link.</li>
      <li><strong>Confidential work.</strong> Screenshots or code from your employer that you do not have permission to share. This can raise real concerns with a careful recruiter.</li>
      <li><strong>Profile counters and badges</strong> as the main content. LeetCode counts or streak graphs are fine as a secondary link for SDE roles, but they are not a portfolio.</li>
    </ul>

    <h2>Make each link pass the ten-second test</h2>
    <p>Open your link in a private window on your phone and ask: within ten seconds, can a stranger tell what this is and why it matters?</p>
    <ul>
      <li>GitHub READMEs should start with one line on what the project does, a screenshot or demo link, and the stack.</li>
      <li>Case studies should open with the outcome, not three paragraphs of background.</li>
      <li>Personal sites should load quickly and look fine on mobile. Many recruiters screen on their phones.</li>
    </ul>

    <h2>Where to put the links</h2>
    <p><strong>On your resume:</strong> one line near your contact details with at most two links. Use short, readable URLs, for example github.com/yourname and yourname.dev. Make sure they are clickable in the PDF.</p>
    <p><strong>On LinkedIn:</strong> use the Featured section for your best project and add the portfolio URL to your contact info. The Featured section shows up when a recruiter opens your profile from an application.</p>
    <p><strong>In application forms:</strong> many Easy Apply forms include a "website" or "portfolio" field. Save the right link once in your profile and screening answers so it is filled consistently. If you are using <a href="/auto-apply-linkedin">LinkedIn auto apply</a>, check that the saved portfolio link points to the version that fits the roles you are targeting.</p>

    <h2>One portfolio, several roles</h2>
    <p>If you apply to two role types, such as frontend and full stack, you do not need two websites. Pin projects that serve both, or create two short landing pages on the same site and use the matching link on each resume version. Do not send a full stack recruiter to a page that only shows CSS animations.</p>

    <h2>Getting found as well as clicked</h2>
    <p>A portfolio can also bring inbound interest if it shows up when people search your name. Using your real name in the site title, adding a short bio, and linking it from LinkedIn and GitHub all help. The guide on <a href="/blog/get-portfolio-website-found-on-google">getting your portfolio website found on Google</a> goes through the basics.</p>

    <h2>A quick audit checklist</h2>
    <ol>
      <li>List every link currently on your resume and LinkedIn.</li>
      <li>Click each one. Delete any that are broken, outdated, or irrelevant to your target role.</li>
      <li>For the two or three that remain, update the README or intro so the first lines explain the project.</li>
      <li>Check each on mobile.</li>
      <li>Update your saved portfolio answer in your job tools so every application uses the cleaned-up link.</li>
    </ol>

    <h2>Next step</h2>
    <p>Spend 30 minutes today on the audit above. Unpin or archive at least one repository or project that does not support the role you want, and rewrite the opening of your best project so a recruiter understands it in ten seconds.</p>
  `,

  "auto-apply-faq-automation-safety-results": `
    <p>These are the questions people ask most often before and after they start using auto apply. The short version: AutoApply CV automates LinkedIn Easy Apply only, uses answers you have saved and checked, pauses when it is unsure instead of guessing, and only counts applications that were actually submitted. Below are the details, including the limits.</p>

    <h2>Getting started</h2>

    <h3>What exactly does AutoApply CV automate?</h3>
    <p>The Chrome extension fills and submits LinkedIn Easy Apply forms using your profile, resume, and saved screening answers. It does not apply on Indeed, Naukri, or company career sites. When a LinkedIn job sends you to an external site, it is logged as skipped so you can apply yourself. Setup details are on the <a href="/auto-apply-chrome-extension">Chrome extension page</a>.</p>

    <h3>Do I need to keep my browser open while it runs?</h3>
    <p>Yes. The extension runs inside your own Chrome browser while you are logged in to LinkedIn. It is not a server that applies from somewhere else with your password. If you close Chrome or the tab, the run stops.</p>

    <h3>Does it need my LinkedIn password?</h3>
    <p>No. You log in to LinkedIn yourself in your browser as normal. The extension works in that session and does not ask for or store your LinkedIn password.</p>

    <h2>Safety and your account</h2>

    <h3>Is it safe for my LinkedIn account?</h3>
    <p>No automation tool can promise zero risk, and anyone who does is overstating it. LinkedIn's user agreement restricts automated activity, so you should understand that before using any tool. What lowers risk in practice: running in your own browser, applying at a measured pace rather than hundreds per hour, keeping daily volumes reasonable, and not combining several automation tools at once. Start with a modest daily limit and increase only if everything looks normal.</p>

    <h3>Will recruiters know I used a tool?</h3>
    <p>The application looks like any Easy Apply submission: your profile, your resume, your answers. What recruiters do notice is a poor fit, such as a marketing profile applying to a DevOps job, or inconsistent answers, like claiming an immediate start in one application and a 90-day notice period in another. Good filters and accurate saved answers matter more than the tool itself. Many recruiters also use tools on their side to sort applications, so a clean, relevant application is what counts.</p>

    <h3>What happens with a screening question it has never seen?</h3>
    <p>The run pauses and the question appears in your dashboard as a pending question. You answer it once, and that answer is saved for next time. It does not invent an answer. Typical examples are questions like "Are you comfortable working from our Gurugram office five days a week?" or "Years of experience with Salesforce Apex?" that are specific to one employer. Once your answer bank covers the usual topics, such as notice period, expected salary, relocation, and work authorization, pauses become less frequent. The guide to <a href="/blog/auto-apply-screening-questions-answer-bank">building an answer bank</a> explains how to cover the common ones up front.</p>

    <h3>Will it lie on my behalf, for example about years of experience?</h3>
    <p>It only uses what you have saved. If you saved "3 years of Python", that is what it answers. Saving honest answers protects you in interviews and background checks, so we recommend never inflating them.</p>

    <h2>Limits and billing</h2>

    <h3>How many jobs can I apply to on the free plan?</h3>
    <p>The free plan includes 3 auto-apply actions per day. The allowance resets daily at 00:00 UTC, which is 5:30 AM in India. Pro removes the daily cap. Current plan details are on the <a href="/pricing">pricing page</a>.</p>

    <h3>What counts as a charged application?</h3>
    <p>Only an application that was successfully submitted. On the free plan that uses one of your daily actions; on a paid plan it counts as one submitted application. Jobs skipped because they need a company-site application, jobs skipped because you already applied, and runs paused on a question or validation error are not charged.</p>

    <h3>Will it apply to the same job twice?</h3>
    <p>No. It checks for jobs you have already applied to and skips them, and those skips are not charged. Note that it only knows about LinkedIn applications. If you applied to the same company via its website, keep track of that yourself.</p>

    <h2>Results</h2>

    <h3>How many interviews will I get?</h3>
    <p>We do not promise a number, because it depends on your role, experience, location, resume, and the job market. Automation saves time on form filling; it does not make a mismatched profile a match. People who see better results tend to use narrow filters, a resume tailored to one role family, and follow up with recruiters on their best-fit jobs.</p>

    <h3>Should I apply to as many jobs as possible?</h3>
    <p>Usually not. Applying to every loosely related job lowers your reply rate and fills your tracker with noise. A smaller number of well-matched applications per day, reviewed weekly, tends to be more useful. <a href="/blog/auto-apply-linkedin-setup-safety-results">Our LinkedIn setup guide</a> suggests how to set sensible limits.</p>

    <h3>Where can I see what was applied to?</h3>
    <p>Every outcome is recorded in your dashboard's applications tracker: submitted, skipped, and failed, with the job link. Review it after each run, apply manually to strong skipped jobs, and adjust your filters if you see off-target applications.</p>

    <h3>What if something goes wrong during a run?</h3>
    <p>Most issues are a field LinkedIn rejected (shown in red) or an outdated extension version. Update the answer in your dashboard, update the extension, and resume. The <a href="/help-center">help center</a> has step-by-step fixes, and you can share the job link with support if you are stuck.</p>

    <h2>Next step</h2>
    <p>If you have not set up yet, create a free account, upload your resume, and fill the answer bank before your first run. Then start with your 3 free applications a day on tightly matched jobs and review the tracker after each run before deciding whether to scale up.</p>
  `,
};
