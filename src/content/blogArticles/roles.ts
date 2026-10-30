// Hand-written bodies for the role-specific posts in EXTRA_TITLES (src/content/blogPosts.ts), keyed by slug.
export const ROLES_ARTICLES: Record<string, string> = {
  "auto-apply-for-software-engineers-best-filters-2026": `
    <p>The best auto apply filters for software engineers in 2026 are boring and strict: a short list of exact job titles that match your stack, a LinkedIn experience level that matches your real years, "Past week" as the date window, the Easy Apply filter switched on, and a location plus work-mode setting you would actually accept. Get those five right and an automated run sends applications that recruiters can say yes to. Get them wrong and you burn your daily limit on roles that reject you in the first screen.</p>

    <h2>Start with a title list, not a single keyword</h2>
    <p>Typing "software engineer" into LinkedIn search returns everything from embedded firmware roles to sales engineering. Instead, write down three to six titles that describe the job you do today or the next step up. For a backend developer with three years of Java and Spring Boot, a good list is:</p>
    <ul>
      <li>Backend Developer</li>
      <li>Java Developer</li>
      <li>Software Engineer - Backend</li>
      <li>SDE 2 (if you have the years for it)</li>
      <li>Software Development Engineer</li>
    </ul>
    <p>Notice what is missing: "Full Stack Developer" if you have never shipped React in production, and "Java Architect" if you are not one yet. Each title should pass a simple test. If a recruiter called you about that title tomorrow, could you explain your fit in two sentences? If not, take it off the list.</p>
    <p>Run each title as a separate search rather than stuffing them into one long query. LinkedIn's search handles short phrases better, and separate searches let you see which title actually produces relevant results.</p>

    <h3>Watch out for title collisions</h3>
    <p>Some titles pull in unrelated jobs. "Java Developer" often surfaces "JavaScript Developer" listings. "Python Developer" brings in data analyst and automation tester roles. "Engineer" alone matches civil, mechanical and field service roles. Before you let any run go, scroll the first two pages of results for each title and note the noise. If more than a few listings out of twenty are off-target, make the title more specific, for example "Python Backend Developer" or "Django Developer".</p>

    <h2>Map your years to LinkedIn's experience levels honestly</h2>
    <p>LinkedIn uses Internship, Entry level, Associate, Mid-Senior level, Director and Executive. Employers set these loosely, so treat them as a rough band:</p>
    <ul>
      <li><strong>0 to 1 year:</strong> Internship and Entry level.</li>
      <li><strong>1 to 3 years:</strong> Entry level and Associate.</li>
      <li><strong>3 to 7 years:</strong> Associate and Mid-Senior level.</li>
      <li><strong>7 years and above:</strong> Mid-Senior level, and Director only if you manage managers.</li>
    </ul>
    <p>Selecting two adjacent levels is fine. Selecting all of them is the single most common reason an engineer's applications go nowhere. A two-year developer applying to "Staff Engineer" roles is not being ambitious; they are being filtered out by the first screening question about years of experience.</p>

    <h2>Use "Past week" as your default date window</h2>
    <p>Fresh postings get reviewed. Listings that are three weeks old have often moved to interviews already, or they are evergreen postings that collect resumes without an active opening. "Past 24 hours" is great if you run daily, but it can be thin for niche stacks like Elixir or Rust. "Past week" gives enough volume while keeping the list current. Avoid "Any time" unless you are searching a narrow title in a small city.</p>

    <h2>Turn on Easy Apply and accept what that means</h2>
    <p>Automation tools that work inside LinkedIn, including the <a href="/auto-apply-chrome-extension">AutoApply CV Chrome extension</a>, only submit LinkedIn Easy Apply jobs. Jobs that send you to a company careers page cannot be completed in one flow, so AutoApply CV records them as skipped for you to apply manually. That is useful: the skipped list often contains your best targets, because many product companies use their own careers sites. Set aside fifteen minutes a week to apply to those by hand.</p>

    <h2>Set location and work mode like a filter, not a wish</h2>
    <p>Pick the cities you would actually move to or commute to. For many Indian engineers that means a short list such as Bengaluru, Hyderabad, Pune and Chennai, plus Remote. Adding "India" as a whole sounds efficient but brings in roles in cities where you would decline the offer. Use the On-site, Hybrid and Remote toggles to match reality. If you will not go to an office five days a week, untick On-site.</p>
    <p>If you are willing to relocate, say so consistently in your saved answers. If you are not, do not tick cities you have no plan to move to just to get more results.</p>

    <h2>Three example filter sets</h2>
    <h3>Two years, frontend, Pune</h3>
    <ul>
      <li>Titles: Frontend Developer, React Developer, UI Engineer, Software Engineer - Frontend</li>
      <li>Experience level: Entry level, Associate</li>
      <li>Location: Pune, Mumbai, Remote (India)</li>
      <li>Date posted: Past week; Easy Apply on</li>
    </ul>
    <h3>Five years, backend, Bengaluru</h3>
    <ul>
      <li>Titles: Senior Backend Engineer, SDE 2, Senior Software Engineer, Golang Developer</li>
      <li>Experience level: Associate, Mid-Senior level</li>
      <li>Location: Bengaluru, Hybrid and Remote</li>
      <li>Date posted: Past week; Easy Apply on</li>
    </ul>
    <h3>Eight years, platform and SRE</h3>
    <ul>
      <li>Titles: Site Reliability Engineer, Senior DevOps Engineer, Platform Engineer, Staff SRE</li>
      <li>Experience level: Mid-Senior level</li>
      <li>Location: Hyderabad, Bengaluru, Remote</li>
      <li>Date posted: Past 24 hours, run daily</li>
    </ul>

    <h2>Prepare the screening answers your filters will trigger</h2>
    <p>Engineering Easy Apply forms in India almost always ask for total experience, relevant experience in a named skill, current CTC, expected CTC, notice period and current location. Global roles add work authorization and time-zone questions. Save truthful answers once so every application uses the same numbers. AutoApply CV uses your saved answers and pauses when a question needs a human, such as "Describe a system you designed", instead of guessing. Our guide to <a href="/blog/auto-apply-screening-questions-answer-bank">building a screening answer bank</a> covers the wording for each of these.</p>
    <p>Be precise with skill-specific experience. If a form asks "How many years of experience do you have with Kubernetes?" and you used it for one year inside a four-year career, answer one. Inflated numbers get caught in the technical round and can end the process.</p>

    <h2>Review the filters every week</h2>
    <p>Filters are a hypothesis. After a week, look at what you applied to and what came back. If recruiter calls are all for one title, add similar titles. If a title produced many applications and zero responses, drop it or fix your resume for it. Our post on <a href="/blog/auto-apply-tracking-what-to-measure">what to measure weekly</a> gives a simple way to do this without spreadsheets.</p>

    <h2>Next step</h2>
    <p>Write your title list and experience band on paper, run each search manually once to check for noise, then put the cleaned settings into the extension and start with a small daily number. The free plan's 3 auto-apply actions per day is enough to test whether your filters are right before you scale; see <a href="/pricing">pricing</a> if you need more.</p>
  `,

  "auto-apply-tools-for-engineers-filters-that-matter": `
    <p>When you compare auto apply tools as an engineer, the filters that matter most are the ones that stop bad applications: precise title matching, stack keyword checks, exclusions for roles you would never take, and experience bands that read the job description rather than just the title. Speed and volume are easy to sell. Filtering quality is what decides whether a tool helps your search or quietly damages it, and you can test it yourself in about thirty minutes.</p>

    <h2>Why filtering beats speed for engineering roles</h2>
    <p>Engineering hiring is narrow. A recruiter hiring a "Senior Android Developer (Kotlin, Jetpack Compose)" will not consider a Flutter-only profile, however fast it arrived. Every mismatched application also has a cost you do not see: it uses a daily action, it may sit in a company's applicant system for months, and it adds noise to your own tracking. A tool that applies to 200 loosely matched jobs gives you less information than one that applies to 30 good ones.</p>
    <p>So when a product page boasts about applications per hour, look past it and ask how it decides which jobs to apply to.</p>

    <h2>Test 1: Does title matching understand engineering titles?</h2>
    <p>Engineering titles are messy. The same job may be listed as SDE 2, Software Development Engineer II, Software Engineer II or Member of Technical Staff. Meanwhile, very similar words mean different jobs. Try these checks with any tool:</p>
    <ul>
      <li>Search "Java Developer" and see if "JavaScript Developer" listings slip through.</li>
      <li>Search "Data Engineer" and check whether "Data Entry Operator" appears.</li>
      <li>Search "Test Engineer" and see if it mixes software QA with hardware or automotive testing.</li>
      <li>Search "Software Engineer" and look for "Sales Engineer" or "Support Engineer" in the results.</li>
    </ul>
    <p>A tool that sits on top of LinkedIn search inherits LinkedIn's matching, which is reasonably good but not perfect. That is fine as long as you can see the results and refine the query. Be cautious with tools that hide the job list entirely and only report a count.</p>

    <h2>Test 2: Can it respect stack keywords?</h2>
    <p>Titles tell you the level. Stack keywords tell you the fit. A good setup lets you look for jobs where the description mentions your core technologies, for example:</p>
    <ul>
      <li>Backend: Java, Spring Boot, Microservices, Kafka, PostgreSQL</li>
      <li>Frontend: React, TypeScript, Next.js, Redux</li>
      <li>Mobile: Kotlin, Swift, React Native, Flutter</li>
      <li>Cloud and DevOps: AWS, Terraform, Kubernetes, Docker, CI/CD</li>
    </ul>
    <p>If the tool cannot filter on description keywords, you can still get most of the benefit by building them into your search title, such as "React TypeScript Developer", and by checking a sample of results before each run. What you want to avoid is a tool that applies to any job with "Developer" in the title.</p>

    <h2>Test 3: Can you exclude what you never want?</h2>
    <p>Exclusions are underrated. Most engineers have a clear list of things they will not accept, and each one is a filter:</p>
    <ul>
      <li>Contract-to-hire or third-party payroll roles, often labelled C2H or "on behalf of our client".</li>
      <li>Night shifts for support roles, if you are not looking for them.</li>
      <li>Bond clauses, common in some fresher listings.</li>
      <li>Technologies you have moved away from, for example legacy mainframe or PHP if you now work in Go.</li>
      <li>Specific companies, such as your current employer or one you left recently.</li>
    </ul>
    <p>Not every tool offers keyword or company exclusions. If yours does not, compensate on the LinkedIn side: use "Job type: Full-time" to drop many contract roles and pick narrower titles. Then check the skipped and applied lists in the tool's tracker every few days and note patterns you need to block.</p>

    <h2>Test 4: Does it handle experience bands properly?</h2>
    <p>Job titles under-report seniority. A "Software Engineer" listing may ask for 6 to 9 years, and a "Senior Software Engineer" listing at a startup may accept 3. The real band is in the description and in the screening questions. Things to check:</p>
    <ul>
      <li>Can you limit the LinkedIn experience level to one or two adjacent bands?</li>
      <li>When a form asks "years of experience with Python", does the tool use your saved, truthful number, or does it fill something to pass the question?</li>
      <li>When a question falls outside your saved answers, does it pause for you or guess?</li>
    </ul>
    <p>The last point matters more than anything else on this list. A tool that invents answers to get through a form is creating applications you cannot defend in an interview. AutoApply CV takes the conservative approach: it fills from your saved answers and pauses when a question needs a human.</p>

    <h2>Test 5: Duplicates and external applies</h2>
    <p>Engineers often run the same searches daily, so the same listing appears again and again. A good tool must skip jobs you have already applied to. It should also be honest about jobs it cannot complete, such as those that redirect to Workday, Greenhouse or a company careers page. AutoApply CV skips duplicates and records company-website jobs as skipped, and neither of those uses a daily action. Ask any tool you are evaluating how it treats both cases, and whether you are charged for them.</p>

    <h2>A 30-minute trial protocol</h2>
    <ol>
      <li>Pick one title and one city. Run the search manually on LinkedIn and save the first 20 job links in a note.</li>
      <li>Mark each link as "would apply" or "would not apply" by reading the description. This is your baseline.</li>
      <li>Set up the same search in the tool and run a small batch, three to five applications.</li>
      <li>Compare what the tool applied to with your baseline. Any job you marked "would not apply" that got an application is a filter failure.</li>
      <li>Open each submitted application and check the screening answers it used.</li>
      <li>Run the same search again the next day and confirm it does not reapply to the same jobs.</li>
    </ol>
    <p>If a tool passes this with your real search, it is good enough to scale. If it fails, tighten your filters and test again before giving it a bigger daily number.</p>

    <h2>Where AutoApply CV fits</h2>
    <p>AutoApply CV works inside LinkedIn Easy Apply through a Chrome extension. You set target titles, locations and work mode, it applies using your saved answers, and every outcome lands in an application tracker so you can audit it. It does not apply on other job boards or company sites. For engineers who live on LinkedIn, that narrow scope is often an advantage because the results are easy to check. See <a href="/how-it-works">how it works</a> for the full flow, and if you want the specific LinkedIn filter values to start with, read <a href="/blog/auto-apply-for-software-engineers-best-filters-2026">best filters for software engineers</a>.</p>

    <h2>Next step</h2>
    <p>Before you commit to any tool, run the six-step trial above on one search you care about. Write down how many of the tool's applications you would have sent yourself. That single number tells you more than any feature list.</p>
  `,

  "auto-apply-for-freshers-avoid-spam": `
    <p>Freshers avoid low-quality spam applications by doing three things before turning on automation: limiting searches to roles that genuinely accept 0 to 1 year of experience, cleaning up their resume and screening answers so every application is complete and truthful, and keeping the daily number small enough to review. Auto apply is not the problem. Applying to every listing with "developer" in it is. A small, well-filtered run gets more interview calls than a large careless one.</p>

    <h2>What spam looks like from the recruiter's side</h2>
    <p>A recruiter screening a "Graduate Engineer Trainee" opening may receive hundreds of applications within days. They sort quickly. The applications that get rejected in seconds have predictable patterns:</p>
    <ul>
      <li>The candidate is a 2025 graduate applying to a role that needs 3+ years.</li>
      <li>The resume is for a mechanical engineer, but the job is for a Java developer.</li>
      <li>Screening answers contradict the resume, for example "2 years of React" on a fresher profile.</li>
      <li>The same person applied to five different openings at the same company in one day.</li>
    </ul>
    <p>None of these are caused by automation itself. They are caused by loose settings. Fix the settings and auto apply simply saves you the clicking.</p>

    <h2>Filter for roles that actually hire freshers</h2>
    <p>On LinkedIn, set Experience level to Internship and Entry level only. Then build a title list that companies use for fresher hiring. Common ones in India include:</p>
    <ul>
      <li>Graduate Engineer Trainee (GET)</li>
      <li>Associate Software Engineer</li>
      <li>Trainee Software Engineer</li>
      <li>Software Engineer - Fresher</li>
      <li>SDE 1 or Junior Developer</li>
      <li>Associate Data Analyst or Junior Data Analyst</li>
    </ul>
    <p>Even with these filters, some listings labelled Entry level ask for 2 years. Read a handful before each run. If the first lines of a description say "minimum 2 years", that listing is not for you, however tempting the company name.</p>

    <h3>Match your degree to the role</h3>
    <p>A B.Tech in Electronics can apply for software roles, but the resume must show coding work: projects, internships, competitive programming or open-source contributions. A BCA or B.Sc graduate should target titles that explicitly list those degrees. Do not let a tool apply to "Embedded Engineer" listings if you have never touched a microcontroller.</p>

    <h2>Avoid listings that are themselves spam</h2>
    <p>Fresher searches attract low-quality and sometimes fraudulent postings. Skip any listing that:</p>
    <ul>
      <li>Asks for a fee for training, certification, placement or "security deposit".</li>
      <li>Promises a job after you complete a paid course.</li>
      <li>Asks you to move the conversation to Telegram or a personal WhatsApp number before any interview.</li>
      <li>Has no company page, no description of the work and a salary that is far above market for freshers.</li>
      <li>Is posted by a "consultancy" that lists dozens of unrelated roles every day.</li>
    </ul>
    <p>Real employers do not charge candidates to apply. If you see a pattern of these in your results, change your search titles rather than hoping the tool will avoid them.</p>

    <h2>Make your resume worth sending first</h2>
    <p>Automation multiplies whatever you give it. Before the first run, make sure your resume:</p>
    <ul>
      <li>Fits on one page and is a text-based PDF, not an image or a Canva export with text as graphics.</li>
      <li>Lists two or three projects with what you built, the stack and a link to code or a demo.</li>
      <li>Shows your graduation year, degree, college and CGPA if it is 7 or above (many Indian companies ask anyway).</li>
      <li>Includes the skill keywords you genuinely know, like Java, Python, SQL, HTML, CSS, React, Git.</li>
    </ul>
    <p>For a deeper checklist, see <a href="/blog/auto-apply-resume-tips-ats-keywords">resume tips for ATS keywords</a>.</p>

    <h2>Save truthful fresher screening answers</h2>
    <p>Fresher Easy Apply forms ask a fairly standard set of questions. Save your answers once so they are consistent across every application:</p>
    <ul>
      <li>Total experience: 0, or the months of internship if the form allows decimals.</li>
      <li>Year of graduation and percentage or CGPA.</li>
      <li>Active backlogs: answer honestly. Hiding a backlog fails at document verification.</li>
      <li>Willingness to sign a service bond, relocate or work in shifts.</li>
      <li>Expected CTC: a realistic range for the role, not a guess copied from social media.</li>
      <li>Notice period: usually "Immediate" for freshers, or your exam end date if you are still studying.</li>
    </ul>
    <p>AutoApply CV uses these saved answers and pauses when a question needs your input, such as "Why do you want to join us?". Answer those once from the dashboard and the run continues. That pause is a feature; it stops the tool from sending a half-filled or invented form.</p>

    <h2>Keep volume low enough to review</h2>
    <p>Freshers often feel they must apply to hundreds of jobs. In practice, a few good applications a day plus off-campus drives and referrals works better than a flood. The free plan's 3 auto-apply actions per day fits a fresher well: it forces you to choose. Our guide on <a href="/blog/auto-apply-daily-limits-pick-best-jobs">picking the 3 best jobs each day</a> shows how to choose them.</p>
    <p>Do not apply to every opening at the same company. If Infosys, TCS or a startup has five similar fresher roles, apply to the one that best matches your degree and skills.</p>

    <h2>Use the time you save</h2>
    <p>The real benefit of auto apply for a fresher is time. Use it on what automation cannot do:</p>
    <ul>
      <li>Register for official off-campus hiring programmes on company career sites.</li>
      <li>Ask seniors from your college for referrals at companies where they work.</li>
      <li>Practise aptitude tests and basic DSA, since many fresher processes start with an online test.</li>
      <li>Apply manually to the company-website jobs that the extension records as skipped.</li>
    </ul>

    <h2>Next step</h2>
    <p>Set your LinkedIn search to Internship and Entry level with four fresher titles, read ten listings to confirm they fit, and fill your answer bank honestly. Then <a href="/signup">create a free account</a> and start with three applications a day. Check the tracker after a week before you change anything.</p>
  `,

  "auto-apply-internships-what-to-optimize": `
    <p>For internships, optimize eligibility first, then your resume, then your search settings, and only then volume. Internship listings reject people mainly for practical reasons: wrong graduation year, wrong dates, wrong duration or wrong location. A tool can only apply to what you point it at, so the first job is making sure every internship it applies to is one you are actually eligible for and can join on the dates asked.</p>

    <h2>1. Eligibility: the filter most students skip</h2>
    <p>Internship descriptions are unusually specific. Before searching, write down your facts:</p>
    <ul>
      <li><strong>Batch:</strong> your expected graduation year, such as 2027 or 2028.</li>
      <li><strong>Availability:</strong> exact months you can work. A summer internship in India commonly runs May to July; a final-semester internship can run six months from January.</li>
      <li><strong>Duration:</strong> 2 months, 3 months or 6 months. Many listings state this clearly.</li>
      <li><strong>Mode:</strong> on-site in a specific city, hybrid or remote. Check whether your college allows remote internships for credit.</li>
      <li><strong>College rules:</strong> some institutes require a No Objection Certificate (NOC) or a minimum duration.</li>
    </ul>
    <p>Now read five internship listings in your field and see how many match all of the above. If only two do, your search is too wide. Applying to a 6-month internship when you can only do 8 weeks wastes your slot and the recruiter's time.</p>

    <h2>2. Resume: one page, projects first</h2>
    <p>Internship recruiters know you have little or no work experience. They look for evidence you can do the work. Put it near the top:</p>
    <ul>
      <li><strong>Education:</strong> college, degree, batch and CGPA.</li>
      <li><strong>Projects:</strong> two or three, each with one line on the problem, one on the stack and a link. A deployed app or a GitHub repo with a clear README is worth more than a list of certificates.</li>
      <li><strong>Skills:</strong> only what you could use in a test tomorrow. For software interns that might be C++, Python, SQL, React, Git. For data interns, Excel, SQL, Python with pandas, and a BI tool.</li>
      <li><strong>Achievements:</strong> hackathons, competitive programming ratings, a paper or open-source pull requests.</li>
    </ul>
    <p>Keep it to one page and export it as a text-based PDF so applicant tracking systems can read it. If you are applying in two different directions, say web development and data analysis, make two versions instead of one confused document.</p>

    <h2>3. Search settings: Internship type, not just the word</h2>
    <p>On LinkedIn, use the Job type filter set to Internship and the Experience level set to Internship. Searching only the word "intern" pulls in full-time roles that mention interns in the description, such as "manage a team of interns". Useful title searches include:</p>
    <ul>
      <li>Software Engineering Intern or SDE Intern</li>
      <li>Frontend Developer Intern, Backend Intern</li>
      <li>Data Analyst Intern, Data Science Intern</li>
      <li>Product Management Intern, Business Analyst Intern</li>
      <li>UI/UX Design Intern</li>
    </ul>
    <p>Set Date posted to "Past week" during peak season. Internship listings fill fast, and an old listing has often closed its shortlist. Set location to your college city, your home city and Remote if your college permits it.</p>

    <h2>4. Answer bank: internship-specific questions</h2>
    <p>Internship Easy Apply forms ask questions that full-time forms do not. Save truthful answers once:</p>
    <ul>
      <li>Start date and end date of availability.</li>
      <li>Can you commit to the full duration? Yes or no.</li>
      <li>Current year of study and graduation year.</li>
      <li>Are you open to a pre-placement offer (PPO) or full-time conversion?</li>
      <li>Expected stipend, if asked. A range is fine.</li>
      <li>Do you have a laptop and stable internet, for remote roles.</li>
    </ul>
    <p>AutoApply CV fills screening questions from your saved answers and pauses when something needs a human, for instance "Why are you interested in this internship?". Write two or three sentences specific to the field, save them, and they can be reused where the question is the same. Our guide to <a href="/blog/auto-apply-screening-questions-answer-bank">creating an answer bank</a> has examples.</p>

    <h2>5. Timing and volume</h2>
    <p>Internship hiring is seasonal. In India, many companies open summer internship roles from roughly the previous autumn to early spring, and startups hire year-round. US and European summer internships often recruit many months ahead. Look at when listings in your field appear and plan your runs then, instead of applying steadily all year.</p>
    <p>Volume should come last. With good eligibility filters, even the free plan's 3 auto-apply actions per day adds up to a solid number of targeted applications over a season. If you need more during a short peak, <a href="/pricing">Pro offers unlimited auto-apply</a>.</p>

    <h2>What not to optimize yet</h2>
    <p>Students often spend hours on things that matter less at the internship stage:</p>
    <ul>
      <li>A long cover letter for every application. Most internship Easy Apply forms do not ask for one.</li>
      <li>A fancy designed resume. Clean and readable wins.</li>
      <li>Applying to every big brand. A small company where you will do real work can be a better first internship.</li>
    </ul>

    <h2>Use skipped jobs and campus channels too</h2>
    <p>Some of the best internships are on company career pages or come through your college placement cell. When the extension meets a job that applies on a company website, it records it as skipped so you can open it and apply manually. Treat that list as a to-do list. Also keep an eye on official internship programmes run by large companies, which usually have their own application portals.</p>

    <h2>Next step</h2>
    <p>Write your batch, dates and duration at the top of a note, then read ten internship listings and keep only the ones that match. Use those titles in your search, update your one-page resume, and see <a href="/how-it-works">how AutoApply CV works</a> before starting your first small run.</p>
  `,

  "auto-apply-remote-jobs-location-rules": `
    <p>The location rules that increase responses on remote applications are simple: only apply where the employer can legally hire you, where the working hours overlap with yours, and where the contract type suits you. "Remote" on a job listing rarely means "anyone, anywhere". It usually means remote within one country, or within a few time zones. Setting your auto apply searches around those three rules removes most of the applications that were never going to be answered.</p>

    <h2>Rule 1: Match the hiring country, not just the word "remote"</h2>
    <p>Most remote listings are tied to a country because of payroll, tax and labour law. On LinkedIn the location field tells you a lot:</p>
    <ul>
      <li><strong>"Remote" with location "India":</strong> the company can hire in India. These are usually the best fit for Indian candidates.</li>
      <li><strong>"Remote" with location "United States":</strong> usually US residents or people already authorized to work there. A candidate in Pune is almost always rejected here, however strong the profile.</li>
      <li><strong>"Remote" with a region like "EMEA" or "APAC":</strong> check the description. APAC can include India, but some listings mean only Singapore or Australia.</li>
      <li><strong>"Anywhere" or "Worldwide":</strong> rare, and often contractor arrangements.</li>
    </ul>
    <p>So the most effective setting for an Indian candidate is often: location "India", work mode "Remote". That one rule keeps you out of the large pool of US-only remote roles. If you are searching from another country, apply the same idea with your own.</p>

    <h3>Answer work authorization honestly</h3>
    <p>Global remote forms ask "Are you legally authorized to work in the United States?" or "Will you require sponsorship?". Save truthful answers once. Do not answer "Yes" to get past a question you do not meet; it ends the process at the offer stage. Our article on <a href="/blog/auto-apply-work-authorization-forms">handling work authorization forms</a> explains the common variations.</p>

    <h2>Rule 2: Check the time-zone overlap</h2>
    <p>Even when a company can hire in India, the team may expect overlap with another time zone. Look for phrases such as "overlap with EST", "available until 9 PM IST" or "working hours 2 PM to 11 PM IST". Then decide your own rule before you search:</p>
    <ul>
      <li>India-based teams: standard IST hours. No conflict.</li>
      <li>UK and Europe teams: a few hours of afternoon overlap in IST. Usually manageable.</li>
      <li>US East Coast: overlap often lands in the IST evening.</li>
      <li>US West Coast: overlap can mean late nights or very early mornings in IST.</li>
    </ul>
    <p>If you cannot work late evenings because of family or health, exclude US-hours roles from your searches entirely. Applying and then declining at the HR call wastes a slot for both sides. If you are fine with it, say so clearly in the screening answer about working hours.</p>

    <h2>Rule 3: Understand the contract type</h2>
    <p>Remote roles in India come in a few employment structures. Each answers questions on the form differently:</p>
    <ul>
      <li><strong>Direct employee of an Indian entity:</strong> normal CTC, PF and notice period. Most familiar.</li>
      <li><strong>Employee via an Employer of Record (EOR):</strong> a foreign company hires you through a local payroll provider. Benefits and contracts look like a regular job.</li>
      <li><strong>Independent contractor:</strong> you invoice the company, usually in USD or EUR, and handle your own tax. No PF or gratuity.</li>
    </ul>
    <p>Decide which you accept. If you only want full-time employment, use the Job type filter "Full-time" and keep "Contract" off. When forms ask for expected compensation, be clear whether your figure is annual CTC in INR or a monthly or hourly rate in another currency.</p>

    <h2>Rule 4: Treat hybrid as a separate search</h2>
    <p>Many listings tagged Remote say inside the description "hybrid, two days a week in our Gurugram office" or "remote for now, office later". These are not bad jobs, but they belong in a location-specific search. Keep two searches:</p>
    <ul>
      <li><strong>Remote, India:</strong> for roles you can take from anywhere.</li>
      <li><strong>Hybrid, your city:</strong> for roles where a commute is acceptable.</li>
    </ul>
    <p>This keeps your saved answers consistent. "Are you willing to come to the office twice a week?" is a yes in the second search and may be a no in the first.</p>

    <h2>Rule 5: Make your profile location match your answers</h2>
    <p>Recruiters check your LinkedIn location against the role. If your profile says Bengaluru but your screening answer says you live in Indore, it looks careless. Keep your current city in your profile, resume and saved answers the same. If you are open to relocating for a hybrid role, save that answer explicitly so it is the same everywhere.</p>

    <h2>Example remote search setups</h2>
    <h3>Backend developer in India who wants IST hours only</h3>
    <ul>
      <li>Location: India. Work mode: Remote. Job type: Full-time.</li>
      <li>Titles: Backend Engineer, Node.js Developer, Senior Software Engineer.</li>
      <li>Saved answer on working hours: available 10 AM to 7 PM IST.</li>
    </ul>
    <h3>Designer open to European overlap</h3>
    <ul>
      <li>Location: India and EMEA listings that mention India. Work mode: Remote.</li>
      <li>Titles: Product Designer, UI/UX Designer.</li>
      <li>Saved answer on working hours: can overlap until 8 PM IST.</li>
    </ul>

    <h2>How AutoApply CV helps with remote searches</h2>
    <p>The <a href="/auto-apply-linkedin">AutoApply CV LinkedIn tool</a> uses the titles, locations and work mode you set, so the rules above go directly into your search settings. It answers location, authorization and time-zone questions from your saved answers and pauses when a question is new. Because it skips jobs you have already applied to, running the same remote search daily is safe. Remote roles attract large applicant numbers, so being early and correct matters more than sending many.</p>

    <h2>Next step</h2>
    <p>Write your three rules in one line each: which countries can hire you, which hours you can work, and which contract types you accept. Change your remote search to match them, then read our follow-up on <a href="/blog/auto-apply-tools-for-remote-jobs-avoid-low-signal">avoiding low-signal remote listings</a> before your next run.</p>
  `,

  "auto-apply-tools-for-remote-jobs-avoid-low-signal": `
    <p>To avoid low-signal remote applications, skip listings that show signs of not being a real, active, remote opening: the same job reposted every few days, "remote" in the title but a city office in the description, staffing aggregators reposting other companies' roles, and vague postings with no team, stack or pay information. Auto apply tools are good at sending applications quickly. They are only as good as the listings they are pointed at, and remote search results contain more noise than most.</p>

    <h2>Why remote listings are noisier</h2>
    <p>A remote role can attract applicants from an entire country, sometimes several. That makes remote postings attractive for recruiters building pipelines, agencies collecting resumes and, occasionally, scammers. It also means a single genuine remote role may get a very large number of applications. In both cases, a careless application has a low chance of being seen. The answer is to spend your daily applications on listings that show signs of a real, current, hireable opening.</p>

    <h2>Signal 1: Reposted and evergreen listings</h2>
    <p>Some companies repost the same remote role every week to stay at the top of search results. Others keep a "talent community" listing open all year. Signs to watch:</p>
    <ul>
      <li>You have seen the same title from the same company many times across weeks.</li>
      <li>The description says "we are always looking for" or "future openings".</li>
      <li>The listing says "Reposted" with a long history of applicants.</li>
    </ul>
    <p>One application to an evergreen listing is fine. Repeated applications are pointless. AutoApply CV skips jobs you have already applied to, so a reposted listing with the same job ID will not get a second application. If a company reposts under a new job ID, you need to notice the pattern yourself and leave it.</p>

    <h2>Signal 2: "Remote" that is not remote</h2>
    <p>Many listings carry a Remote tag but the description says otherwise. Common phrases:</p>
    <ul>
      <li>"Remote initially, must relocate to Hyderabad within three months."</li>
      <li>"Hybrid: three days in our Noida office."</li>
      <li>"Remote within 50 km of our Pune office."</li>
      <li>"Must be based in the US" on a listing that LinkedIn shows to Indian users.</li>
    </ul>
    <p>Read the first and last paragraphs of the description; location conditions usually sit there. If you cannot meet them, the application has no signal regardless of fit. Our post on <a href="/blog/auto-apply-remote-jobs-location-rules">remote location rules</a> covers how to set your search so fewer of these appear.</p>

    <h2>Signal 3: Aggregators and resume collectors</h2>
    <p>Some accounts post large numbers of remote roles on behalf of unnamed clients. A few are genuine recruitment agencies. Many are reposting public listings to collect resumes. Look for:</p>
    <ul>
      <li>A company page with very few employees but hundreds of open jobs across unrelated fields.</li>
      <li>"Our client, a leading MNC" with no detail on the actual employer.</li>
      <li>The same job text appearing under several different agency names.</li>
      <li>A request to register on a separate portal before anything else.</li>
    </ul>
    <p>When you find the original company's listing, apply there instead. If you cannot tell who the employer is, decide whether the agency is one you trust. Your resume will sit in their database either way.</p>

    <h2>Signal 4: Vague or copy-paste descriptions</h2>
    <p>A real opening usually tells you something specific: the product, the team, the stack, the level and sometimes a pay range. Low-signal listings read like they could be for any company:</p>
    <ul>
      <li>"Looking for a rockstar developer with skills in all technologies."</li>
      <li>A list of 20 unrelated tools, such as React, SAP, Salesforce and Photoshop in one role.</li>
      <li>No mention of years of experience, team or reporting line.</li>
    </ul>
    <p>A vague description is not proof of a fake job, but it does mean you cannot tailor anything, and the screening will be arbitrary. Put these at the bottom of your priority list.</p>

    <h2>Signal 5: Red flags for remote scams</h2>
    <p>Remote search results occasionally include fraudulent postings. Do not apply, and report them on LinkedIn, if a listing:</p>
    <ul>
      <li>Asks you to pay for equipment, training or onboarding.</li>
      <li>Offers high pay for simple tasks like "liking videos" or "data entry from home".</li>
      <li>Moves the conversation to Telegram or WhatsApp before any interview.</li>
      <li>Asks for Aadhaar, PAN or bank details before an offer letter.</li>
    </ul>
    <p>No auto apply tool can detect every scam. This is one of the reasons you should review results rather than run blind.</p>

    <h2>What a tool can and cannot filter for you</h2>
    <p>An auto apply tool working through LinkedIn can respect the filters you set: titles, location, work mode, date posted, experience level and Easy Apply. It can skip duplicates and, in AutoApply CV's case, record company-website listings as skipped instead of half-applying. What it generally cannot do is judge whether a description is genuine or whether "remote" really means remote. That part is on you, and it takes a few minutes a day.</p>

    <h2>A simple pre-run check</h2>
    <ol>
      <li>Run your remote search and open the first 10 results.</li>
      <li>For each, check three things: who the real employer is, whether the location conditions fit you, and whether the description is specific.</li>
      <li>If more than three of the ten fail, tighten the search: narrower titles, "Past week" or "Past 24 hours", and Full-time only.</li>
      <li>Keep a short note of companies or agencies to avoid and check it before each run.</li>
      <li>After the run, look at your <a href="/features">application tracker</a> and remove any search that keeps producing low-signal results.</li>
    </ol>

    <h2>Use fewer, better remote applications</h2>
    <p>Remote roles reward speed and accuracy more than volume. Applying within a day or two of posting, to a listing you clearly qualify for, with consistent truthful answers, gives you a fair chance. If you are on the free plan's 3 auto-apply actions per day, spend them on the three remote listings with the strongest signal from your check. See <a href="/blog/auto-apply-daily-limits-pick-best-jobs">how to pick the 3 best jobs today</a> for a quick ranking method.</p>

    <h2>Next step</h2>
    <p>Before your next remote run, do the ten-listing check above and write down the reasons each one failed. Those reasons become your personal filter rules, and you will see the same patterns repeat within a week.</p>
  `,

  "auto-apply-senior-roles-quality-controls": `
    <p>Auto apply can work for senior roles, but only with strict quality controls: a narrow list of target titles and companies, a low daily cap, saved answers that state your real compensation and notice period, and a manual review of anything that matters. At senior levels, each application is closer to a first conversation than a lottery ticket. The goal is to save time on form filling while keeping your judgement on where you apply.</p>

    <h2>Why senior searches need different rules</h2>
    <p>A senior engineer, engineering manager or lead designer has fewer suitable openings, and those openings are often filled through referrals, recruiters and networks. Hiring managers also look at applicant history. Applying to six roles at the same company in a week, or to roles two levels below your experience, sends a signal you do not want. Quality controls protect your reputation in a smaller market.</p>

    <h2>Control 1: Define your title ladder precisely</h2>
    <p>Senior titles vary widely between companies. A "Senior Software Engineer" at one company is a mid-level role; at another it is close to staff. Decide which titles match your scope:</p>
    <ul>
      <li><strong>Individual contributor track:</strong> Senior Software Engineer, Staff Engineer, Principal Engineer, Lead Engineer, Architect.</li>
      <li><strong>Management track:</strong> Engineering Manager, Senior Engineering Manager, Head of Engineering, Director of Engineering.</li>
      <li><strong>Other functions:</strong> Senior Product Manager, Group Product Manager, Lead Product Designer, Principal Data Scientist.</li>
    </ul>
    <p>Pick one track. Mixing IC and management titles in one run creates applications with an inconsistent story. If you are genuinely open to both, run them as separate searches with separate resume versions.</p>

    <h2>Control 2: Set a low daily cap</h2>
    <p>Senior candidates rarely need volume. Three to five well-matched applications a day is plenty, and many weeks will have fewer good openings than that. A low cap also means you can open each submitted application in the tracker and confirm the answers. If you find yourself raising the cap because there is "nothing to apply to", the answer is usually a better title list or more networking, not more applications.</p>

    <h2>Control 3: Keep a target and avoid list of companies</h2>
    <p>At senior levels, which company matters as much as which role. Keep two short lists:</p>
    <ul>
      <li><strong>Target companies:</strong> where you would accept an offer. For these, consider applying manually or seeking a referral rather than automating.</li>
      <li><strong>Avoid companies:</strong> your current employer, recent past employers, direct competitors where a leak would be awkward, and places you have already interviewed with recently.</li>
    </ul>
    <p>Review search results against the avoid list before each run. Some tools support company exclusions directly; if yours does not, a quick scan of the result page does the job.</p>

    <h2>Control 4: Save precise compensation and notice answers</h2>
    <p>Senior Easy Apply forms in India almost always ask for current CTC, expected CTC and notice period. These answers shape the conversation, so decide them carefully once:</p>
    <ul>
      <li><strong>Current CTC:</strong> state it consistently, and know whether you are including variable pay and stock.</li>
      <li><strong>Expected CTC:</strong> a figure or range you are actually prepared to discuss. Too low anchors the offer; too high gets you filtered out by a numeric field.</li>
      <li><strong>Notice period:</strong> 60 or 90 days is common for senior roles in India. If your company allows a buyout or you can negotiate an early release, say so in the optional text where possible.</li>
      <li><strong>Serving notice:</strong> if you have resigned, give your last working day.</li>
    </ul>
    <p>AutoApply CV uses your saved, truthful answers for these fields and pauses when a question needs a human. For a senior candidate that pause is valuable: questions like "Describe the largest team you have managed" deserve your own words.</p>

    <h2>Control 5: Tailor the resume by role family</h2>
    <p>One resume does not fit every senior role. Keep two or three versions focused on different strengths, for example:</p>
    <ul>
      <li>A platform version that leads with scale, reliability and cost work: "migrated payments service to Kubernetes", "owned on-call for 40 services".</li>
      <li>A product engineering version that leads with features shipped and cross-functional work.</li>
      <li>A management version that leads with hiring, team growth and delivery outcomes.</li>
    </ul>
    <p>Use real outcomes you can talk about in detail. The <a href="/features">AutoApply CV resume tools</a> can help tailor wording to a job description, but the facts must be yours.</p>

    <h2>Control 6: Decide what never gets automated</h2>
    <p>Some applications should always be manual:</p>
    <ul>
      <li>Roles at your top five target companies.</li>
      <li>Leadership roles where a short personal note to the hiring manager will matter more than the form.</li>
      <li>Roles where you have a mutual connection who could refer you.</li>
      <li>Any listing that applies on a company website. The extension records these as skipped, which works well as a review queue.</li>
    </ul>
    <p>Automation is for the long tail of good-fit roles at companies you would consider but do not know well.</p>

    <h2>Control 7: Review outcomes, not just counts</h2>
    <p>For senior roles, look at the tracker weekly and ask specific questions. Which titles led to recruiter calls? Did any company respond with "overqualified" or "budget mismatch"? Did a numeric expected-CTC field cause instant rejections? Adjust one thing at a time. Our article on <a href="/blog/auto-apply-rejections-diagnose-callbacks">diagnosing low callback rates</a> walks through this.</p>

    <h2>Pair automation with outreach</h2>
    <p>Senior hiring moves through people. Use the time saved on forms to message hiring managers, reply to recruiters and ask former colleagues for referrals. A short message after an application, such as "I applied for the Staff Engineer role; I led a similar migration at my last company", can lift a good application out of a large pile.</p>

    <h2>Next step</h2>
    <p>Write your title ladder, your avoid list and your compensation answers before you change any tool settings. Then run three applications a day for a week, review each one in the tracker, and only increase the cap if every application was one you would have sent by hand.</p>
  `,

  "auto-apply-data-roles-resume-filter-tips": `
    <p>For data roles, auto apply works when you treat data analyst, data engineer, data scientist and analytics engineer as separate searches, each with its own title list, skill keywords and resume version. "Data" is one of the most confusing job families to search: the same word covers SQL reporting, Spark pipelines, machine learning and even data entry. Clear filters and a matching resume decide whether your applications reach the right screen.</p>

    <h2>Split the data family before you search</h2>
    <p>Recruiters screen data candidates against the specific role. Decide which one you are, or which two at most:</p>
    <ul>
      <li><strong>Data Analyst / Business Analyst / Product Analyst:</strong> SQL, Excel, dashboards, stakeholder questions.</li>
      <li><strong>Data Engineer:</strong> pipelines, warehouses, orchestration, cloud data services.</li>
      <li><strong>Analytics Engineer:</strong> SQL modelling, dbt, data quality, semantic layers.</li>
      <li><strong>Data Scientist:</strong> statistics, experimentation, modelling, Python.</li>
      <li><strong>Machine Learning Engineer:</strong> model deployment, MLOps, production systems.</li>
    </ul>
    <p>If you are a data analyst with some Python, you are not yet a data scientist in most screens. Search for the role you can defend in a technical round, and add the next step only when your resume shows real projects in it.</p>

    <h2>Title lists that reduce noise</h2>
    <h3>Analyst searches</h3>
    <ul>
      <li>Data Analyst, Senior Data Analyst, Product Analyst, Business Intelligence Analyst, Power BI Developer</li>
      <li>Watch for noise: "MIS Executive", "Data Entry Operator" and "Business Analyst" roles that are really requirements-gathering for IT projects.</li>
    </ul>
    <h3>Engineering searches</h3>
    <ul>
      <li>Data Engineer, Senior Data Engineer, Big Data Engineer, ETL Developer, Analytics Engineer</li>
      <li>Watch for noise: "Database Administrator" roles and "Data Engineer" listings that are actually SAP or Informatica support.</li>
    </ul>
    <h3>Science searches</h3>
    <ul>
      <li>Data Scientist, Machine Learning Engineer, Applied Scientist, NLP Engineer</li>
      <li>Watch for noise: "AI Trainer" or annotation roles, and research roles that require a PhD.</li>
    </ul>
    <p>Run each title separately on LinkedIn and look at the first page of results. If you see more off-target listings than good ones, make the title more specific, for example "Data Analyst SQL Power BI".</p>

    <h2>Skill keywords by role</h2>
    <p>Applicant tracking systems and recruiters look for specific tool names. Make sure the ones you genuinely use appear in your resume, written the way job ads write them:</p>
    <ul>
      <li><strong>Analyst:</strong> SQL, Excel (pivot tables, VLOOKUP or XLOOKUP), Power BI, Tableau, Looker, Python (pandas), Google Analytics, A/B testing.</li>
      <li><strong>Data engineer:</strong> Python, SQL, Apache Spark, PySpark, Airflow, Kafka, Snowflake, BigQuery, Redshift, Databricks, AWS Glue, Azure Data Factory, dbt.</li>
      <li><strong>Data scientist:</strong> Python, statistics, hypothesis testing, regression, scikit-learn, XGBoost, PyTorch or TensorFlow, feature engineering, experiment design.</li>
      <li><strong>ML engineer:</strong> model serving, Docker, Kubernetes, MLflow, CI/CD, monitoring, vector databases if relevant.</li>
    </ul>
    <p>Do not list everything. A resume that names 35 tools reads as unfocused. Choose the ten or so you can discuss in depth. Our guide on <a href="/blog/auto-apply-keywords-how-to-choose-skill-tags">choosing skill tags that convert</a> explains how to prioritise.</p>

    <h2>Resume tips specific to data roles</h2>
    <h3>Write outcomes in data terms</h3>
    <p>Data hiring managers want to know what your work changed. Use the numbers you actually have:</p>
    <ul>
      <li>"Built a Power BI sales dashboard used by the regional team every Monday, replacing a manual Excel report."</li>
      <li>"Moved nightly ETL from cron scripts to Airflow; pipeline failures became visible through alerts."</li>
      <li>"Ran an A/B test on checkout copy and presented the result with confidence intervals to the product team."</li>
    </ul>
    <p>If you do not have a business metric, describe scale and scope instead: tables, data volume, number of users of a dashboard, refresh frequency. Never invent figures.</p>
    <h3>Link proof</h3>
    <p>For analysts and data scientists, a GitHub repo with a clean notebook, or a public Tableau or Power BI dashboard, is strong evidence. For data engineers, a repo with a small pipeline project and a clear README works. Put one or two links near the top of the resume.</p>
    <h3>Keep a version per role</h3>
    <p>An analyst resume should lead with SQL and dashboards. An engineering resume should lead with pipelines and cloud. If you search both families, keep two resumes and pair each with its own search.</p>

    <h2>Filters beyond the title</h2>
    <ul>
      <li><strong>Experience level:</strong> data roles are often posted as Associate or Mid-Senior even for 2 to 3 years. Read the "years required" line before including a band.</li>
      <li><strong>Date posted:</strong> "Past week" keeps results current.</li>
      <li><strong>Industry:</strong> if your experience is in BFSI, e-commerce or healthcare, those industries value domain knowledge. Prioritise them.</li>
      <li><strong>Work mode:</strong> data roles are often hybrid in Bengaluru, Gurugram, Hyderabad and Pune. Set this honestly.</li>
    </ul>

    <h2>Screening questions data roles ask</h2>
    <p>Data Easy Apply forms often ask tool-specific experience: "How many years of experience do you have with SQL?", "with Power BI?", "with Spark?". Save truthful, tool-by-tool numbers. Saying 4 years of Spark when you used it for 6 months will be found out in the first technical round. AutoApply CV fills these from your saved answers and pauses when a new question appears, so you can add the answer once and reuse it.</p>

    <h2>Switching between data roles</h2>
    <p>Many people move from analyst to data engineer, or from data engineer to ML engineer. During a switch, apply to bridge titles rather than jumping straight to the target. An analyst learning pipelines can search "Analytics Engineer" or "BI Engineer", where SQL depth counts and dbt or Airflow exposure is a bonus. A data engineer moving into ML can look at "ML Platform Engineer" or "MLOps Engineer", where pipeline experience is the core requirement. Keep these as a separate search with its own resume, and be honest in screening answers about how many years you have in the new area.</p>

    <h2>Where automation fits for data candidates</h2>
    <p>Use the <a href="/auto-apply-linkedin">LinkedIn auto apply tool</a> for well-matched Easy Apply listings and keep take-home assignments, SQL tests and case studies for your own time. Many data roles include a test early in the process. Applying to fewer, better-matched roles leaves you energy to do those well.</p>

    <h2>Next step</h2>
    <p>Pick your primary data role, write a ten-tool keyword list from three real job descriptions for it, and update one resume version to match. Then set a single search for that role and review the first week's results before adding a second family.</p>
  `,

  "auto-apply-product-roles-keyword-mapping": `
    <p>Keyword mapping for product roles means taking the phrases that product manager job ads use, such as "roadmap", "discovery", "PRD", "stakeholder management" and "north star metric", and matching each one to a specific, truthful line of evidence in your resume. Product job descriptions are full of soft, overlapping language, so a resume that simply says "managed products" gets lost. Map the keywords first, then automate applications to roles where the map is strong.</p>

    <h2>Know the product title landscape</h2>
    <p>Product titles vary by company size and maturity. Decide which apply to you:</p>
    <ul>
      <li><strong>Associate Product Manager (APM):</strong> early career, often from engineering, consulting or a top campus programme.</li>
      <li><strong>Product Manager / Senior Product Manager:</strong> owns a product area, roadmap and outcomes.</li>
      <li><strong>Technical Product Manager:</strong> works on APIs, platforms or developer tools; expects technical depth.</li>
      <li><strong>Growth Product Manager:</strong> focuses on acquisition, activation, retention, experiments.</li>
      <li><strong>Product Owner:</strong> often a Scrum role in services companies or banks, focused on backlog and sprint delivery.</li>
      <li><strong>Product Analyst:</strong> data role supporting product decisions; a common path into PM.</li>
    </ul>
    <p>"Product Owner" and "Product Manager" are not interchangeable in many Indian companies. Product Owner listings at IT services firms often value Jira, user stories and Scrum certification. Product Manager listings at startups value discovery, metrics and shipping. Map to the right one.</p>

    <h2>Build the keyword map</h2>
    <p>Collect five to ten job descriptions for the exact title you want. Highlight repeated phrases, then group them. For each phrase, write the resume evidence you have. A typical map looks like this:</p>
    <h3>Discovery and research</h3>
    <ul>
      <li>Ad phrases: user research, customer interviews, problem discovery, Jobs to be Done.</li>
      <li>Evidence: "Ran 18 customer interviews with SME owners to define the invoicing MVP."</li>
    </ul>
    <h3>Strategy and roadmap</h3>
    <ul>
      <li>Ad phrases: product roadmap, prioritisation, OKRs, product vision.</li>
      <li>Evidence: "Owned the quarterly roadmap for the onboarding team; prioritised with RICE scoring."</li>
    </ul>
    <h3>Execution</h3>
    <ul>
      <li>Ad phrases: PRD, user stories, agile, sprint planning, cross-functional delivery.</li>
      <li>Evidence: "Wrote PRDs and acceptance criteria for a team of 6 engineers and 1 designer; shipped every two weeks."</li>
    </ul>
    <h3>Metrics and experimentation</h3>
    <ul>
      <li>Ad phrases: KPIs, north star metric, A/B testing, funnel analysis, retention.</li>
      <li>Evidence: "Defined weekly active payers as the team metric; ran three onboarding experiments using Mixpanel."</li>
    </ul>
    <h3>Stakeholders and go-to-market</h3>
    <ul>
      <li>Ad phrases: stakeholder management, GTM, sales enablement, launch.</li>
      <li>Evidence: "Coordinated launch with sales and support; wrote the enablement deck and FAQ."</li>
    </ul>
    <h3>Tools</h3>
    <ul>
      <li>Ad phrases: Jira, Confluence, Figma, Mixpanel, Amplitude, SQL, Google Analytics.</li>
      <li>Evidence: list only the ones you use, ideally inside the bullets above rather than in a separate block.</li>
    </ul>
    <p>Any group where you cannot write a truthful evidence line is a gap. Either fix it with real work, or avoid roles where that group is the main requirement.</p>

    <h2>Domain keywords matter as much as skill keywords</h2>
    <p>Product hiring is often domain-led. A fintech company may screen for "UPI", "lending", "KYC" or "payments". A B2B SaaS company may look for "self-serve", "PLG", "enterprise onboarding" or "admin console". A consumer app may care about "DAU", "engagement" and "notifications". If you have domain experience, put the domain terms in your headline and first bullets. If you are switching domain, say so honestly and lean on transferable evidence.</p>

    <h2>Turn the map into search filters</h2>
    <ul>
      <li><strong>Titles:</strong> search the two or three titles where your map is strongest. For an engineer moving to product, that may be Technical Product Manager and Associate Product Manager rather than Senior PM.</li>
      <li><strong>Experience level:</strong> product roles are commonly posted as Mid-Senior level even for 3 to 5 years. Read the years line in the description.</li>
      <li><strong>Industry:</strong> filter to industries where your domain keywords match.</li>
      <li><strong>Location:</strong> product roles cluster in Bengaluru, Gurugram, Mumbai and Pune, with fewer fully remote openings than engineering. Set this realistically.</li>
    </ul>
    <p>Then set these as your targets in the <a href="/auto-apply">AutoApply CV auto apply</a> settings and run a small batch.</p>

    <h2>Screening questions product forms ask</h2>
    <p>Product Easy Apply forms ask things like "Years of product management experience?", "Have you worked on B2B SaaS products?", "Have you worked with engineering teams directly?" and current or expected CTC. Count PM years strictly; time as an analyst or engineer is relevant experience but not PM experience. Save these answers once. AutoApply CV uses the saved answers and pauses when a question needs a human, such as "Describe a product you launched", so you can write a real answer instead of a generic one.</p>

    <h2>Common mapping mistakes</h2>
    <ul>
      <li>Copying the job ad's phrases into a skills list without evidence. Recruiters notice.</li>
      <li>Writing activities instead of outcomes: "attended stand-ups" says nothing.</li>
      <li>Calling a project management role "product management". If you ran timelines but did not decide what to build, describe it accurately.</li>
      <li>Using one resume for Product Owner and Growth PM roles.</li>
    </ul>

    <h2>Mapping for career switchers</h2>
    <p>Engineers, consultants and analysts moving into product often have more evidence than they think. An engineer who wrote technical design documents, pushed back on scope and talked to customers during incidents has discovery and stakeholder evidence. A consultant who ran workshops and built business cases has strategy and prioritisation evidence. Rewrite those bullets in product language without changing the facts, and target APM or Technical Product Manager roles, where that background is expected.</p>

    <h2>Use automation for the long tail</h2>
    <p>For product roles, referrals and direct outreach often do the heavy lifting. Use automation for good-fit roles at companies you do not have a connection to, and spend the saved time on case study practice and messages to hiring managers. For a broader approach to keywords, see <a href="/blog/auto-apply-keywords-how-to-choose-skill-tags">how to choose skill tags</a>, and for resume structure, <a href="/blog/auto-apply-resume-tips-ats-keywords">ATS resume tips</a>.</p>

    <h2>Next step</h2>
    <p>Copy five product job descriptions for your target title into one document, highlight the repeated phrases, and fill in the six groups above with one truthful evidence line each. Update your resume from that map, then run your first small batch and compare responses by title after a week.</p>
  `,

  "auto-apply-designers-portfolio-ats-tips": `
    <p>Designers can use auto apply successfully if two things are in place before the first run: a text-based resume that applicant tracking systems can read, and a portfolio link that is easy to find and quick to judge. Most design applications are decided by the portfolio, but the resume has to get through the system first. Set both up properly, choose design titles carefully, and save your portfolio URL as a standard answer so every application includes it.</p>

    <h2>Why designers fail ATS screens</h2>
    <p>Designers often build visually rich resumes in Figma, Illustrator or Canva. Those look great to a human but can confuse applicant tracking systems. Common problems:</p>
    <ul>
      <li>Text exported as outlines or images, so the system reads nothing.</li>
      <li>Two- or three-column layouts that get read in the wrong order.</li>
      <li>Skills shown as icons or progress bars with no text labels.</li>
      <li>Your name and email placed inside a graphic header.</li>
    </ul>
    <p>The fix is not to make an ugly resume. Keep it clean, one column for the main content, real text, standard section headings (Experience, Projects, Skills, Education), and export it as a PDF where you can select and copy the text. Test it by copying everything into a plain text editor. If the order and words survive, it is ATS-readable.</p>

    <h2>Design keywords that should be in plain text</h2>
    <p>Recruiters and systems search for tool and method names. Include the ones you genuinely use:</p>
    <ul>
      <li><strong>Tools:</strong> Figma, FigJam, Adobe XD, Illustrator, Photoshop, After Effects, Framer, Webflow, Miro, ProtoPie.</li>
      <li><strong>Methods:</strong> user research, usability testing, wireframing, prototyping, information architecture, interaction design, journey mapping.</li>
      <li><strong>Systems:</strong> design systems, component libraries, design tokens, handoff to developers.</li>
      <li><strong>Quality:</strong> accessibility, WCAG, responsive design, mobile-first.</li>
      <li><strong>Domain:</strong> fintech, e-commerce, SaaS dashboards, edtech, healthcare apps.</li>
    </ul>
    <p>Put these inside your experience bullets where possible, for example "Built a Figma component library with 60 components and documented tokens for the frontend team", rather than only in a list.</p>

    <h2>Make the portfolio easy to find</h2>
    <p>Your portfolio link should appear in at least four places:</p>
    <ul>
      <li>The resume header, as a short readable URL next to your email.</li>
      <li>Your LinkedIn profile, in the Featured section and the contact info.</li>
      <li>Your saved answer for "Portfolio URL" or "Website" questions in Easy Apply forms.</li>
      <li>Optional cover note fields when a form provides them.</li>
    </ul>
    <p>Use a stable domain such as your own site, Behance or a Notion page you control. Avoid links that expire, like shared Google Drive files with changing permissions. If you use a password for NDA work, put the password in the resume and in the saved answer, or offer a public case study as the first link. Recruiters will not email you to ask for access. For more on what to include and remove, read <a href="/blog/auto-apply-portfolio-what-to-link">what to link in your portfolio</a>.</p>

    <h2>Structure case studies for a two-minute review</h2>
    <p>A recruiter or design lead may spend only a couple of minutes on a first look. Make each case study readable in that time:</p>
    <ol>
      <li>One line on the problem and who it was for.</li>
      <li>Your role and the team, so it is clear what you did.</li>
      <li>The key decisions, with one or two before and after screens.</li>
      <li>The outcome: what shipped, what changed, what you learned.</li>
    </ol>
    <p>Three strong case studies beat ten thin ones. Put the one most relevant to the jobs you are applying for at the top.</p>

    <h2>Choose design titles carefully</h2>
    <p>"Designer" is a very broad word on job boards. A search for it returns fashion, interior, mechanical and graphic design roles alongside product design. Build a specific title list:</p>
    <ul>
      <li><strong>Product and UX:</strong> Product Designer, UI/UX Designer, UX Designer, Interaction Designer, Senior Product Designer.</li>
      <li><strong>Research:</strong> UX Researcher, User Researcher.</li>
      <li><strong>Visual and brand:</strong> Visual Designer, Brand Designer, Graphic Designer, Motion Designer.</li>
    </ul>
    <p>Product designers should usually leave out Graphic Designer, and the reverse is also true; the portfolios expected are very different. Run each title on LinkedIn and check the first page for noise before letting a tool apply.</p>

    <h2>Set filters that fit design hiring</h2>
    <ul>
      <li><strong>Experience level:</strong> design teams are small and level gaps matter. Use one or two adjacent bands.</li>
      <li><strong>Industry:</strong> if your portfolio is strong in one domain, such as fintech dashboards, prioritise that industry.</li>
      <li><strong>Work mode:</strong> many product design roles in India are hybrid in Bengaluru, Mumbai, Gurugram and Pune. Add Remote, India for fully remote ones.</li>
      <li><strong>Date posted:</strong> "Past week" keeps you ahead of the large pile that design listings attract.</li>
    </ul>

    <h2>Screening questions designers face</h2>
    <p>Design Easy Apply forms ask for portfolio URL, years with Figma, experience with design systems, current and expected CTC, and notice period. Save truthful answers once. AutoApply CV fills these from your saved answers and pauses when a question needs a human, for example "Which case study best represents your work and why?". Write that answer once with care; it can be reused wherever the question repeats.</p>

    <h2>Design assignments and automation</h2>
    <p>Many design processes include a take-home assignment or a whiteboard exercise. These take hours. That is another reason to keep automated volume moderate: apply to roles where your portfolio is a clear fit, so the assignments you get are worth doing. If an assignment looks like unpaid production work for the company's real product, it is fine to ask about scope or decline.</p>

    <h2>Where AutoApply CV helps designers</h2>
    <p>The <a href="/auto-apply-chrome-extension">Chrome extension</a> handles LinkedIn Easy Apply forms using your saved answers, including your portfolio link, and logs each outcome in the tracker. Jobs that apply through a company website are recorded as skipped so you can apply there yourself, which is common for design roles at product companies. The <a href="/help-center">help center</a> covers setup if your saved answers are not being used.</p>

    <h2>Next step</h2>
    <p>Copy your current resume into a plain text editor and fix anything that comes out scrambled. Then check that your portfolio link works in a private browser window, add it to your saved answers, and run a small batch for one design title before expanding.</p>
  `,
};
