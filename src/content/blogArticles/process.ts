// Hand-written bodies for the process and troubleshooting posts in EXTRA_TITLES (src/content/blogPosts.ts), keyed by slug.
export const PROCESS_ARTICLES: Record<string, string> = {
  "auto-apply-chrome-extension-setup-troubleshooting": `
    <p>To set up the AutoApply CV Chrome extension, create a free account, finish your profile, upload a resume, install the AutoApply CV LinkedIn Copilot from the Chrome Web Store, pin it to the toolbar, fill your answer bank once and then start a small run from the dashboard. Most problems after that fall into five buckets: the dashboard cannot see the extension, LinkedIn shows red field errors, the run gets stuck on the same page, outcomes do not appear in your tracker, or saved answers are not being used. This guide walks through setup in order and then gives the fix for each of those buckets.</p>

    <p>One scope note before you start: the extension works on <strong>LinkedIn Easy Apply</strong> jobs. Jobs that send you to a company careers site are recorded as skipped so you can apply to them yourself.</p>

    <h2>Setup in five steps</h2>

    <h3>1. Create an account and complete your profile</h3>
    <p>Sign up at <a href="/signup">/signup</a> and fill the basics: name, phone, current city, total experience and notice period. These are not decoration. Easy Apply forms ask for a phone number and city on almost every job, and many Indian employers ask for notice period on the first screen. If the profile is empty, the extension has nothing truthful to put into those fields and the run will pause more often.</p>

    <h3>2. Upload a resume</h3>
    <p>Upload a PDF, DOCX or TXT file up to 5MB, or build one in the resume builder. Use the version you would be comfortable sending to every role in your target list. If you apply to two different role families, such as backend and data engineering, keep the run focused on one family at a time rather than using a resume that tries to cover both.</p>

    <h3>3. Install and pin the extension</h3>
    <p>Install the AutoApply CV LinkedIn Copilot from the Chrome Web Store, then click the puzzle-piece icon in Chrome and pin it. Pinning matters because it keeps the extension visible, so you can see at a glance that it is installed and active. Stay logged in to both LinkedIn and autoapplycv.in in the same Chrome profile. If you use several Chrome profiles (work and personal, for example), the extension, your LinkedIn session and your dashboard login all need to live in the same one.</p>

    <h3>4. Fill the answer bank once</h3>
    <p>The answer bank holds the replies to screening questions you see again and again: expected salary range, work authorization, willingness to relocate, years of experience with specific tools. Fill it before your first run. When a question comes up that the bank cannot answer truthfully, the extension pauses instead of guessing, and the question appears as a pending question in the dashboard.</p>

    <h3>5. Set targets and start small</h3>
    <p>On the LinkedIn auto-apply page of the dashboard, set target job titles, locations and work mode (remote, hybrid or on-site). Start with a modest daily limit, watch the first few applications, and open the applications tracker afterwards to check what was submitted, skipped or paused. On the free plan you get 3 auto-apply actions per day, which is a sensible size for a first test anyway. You can read more about the overall flow on <a href="/how-it-works">How it works</a>.</p>

    <h2>Troubleshooting the five common problems</h2>

    <h3>The dashboard says the extension is not detected</h3>
    <ol>
      <li>Confirm the extension is installed from the Chrome Web Store and enabled on the chrome://extensions page.</li>
      <li>Pin it to the toolbar.</li>
      <li>Reload the dashboard tab. The dashboard checks for the extension when the page loads, so a tab opened before installation will not see it.</li>
      <li>Check that the dashboard shows the installed version number. If it does not, make sure you are in the same Chrome profile where the extension is installed.</li>
    </ol>

    <h3>Red field errors inside Easy Apply</h3>
    <p>A red outline under a field means LinkedIn rejected the value. Typical causes are a decimal in a whole-number field, an empty required dropdown, or a text answer that is too long. The run pauses on that job rather than submitting something broken. Open the pending questions in the dashboard, enter a corrected answer, save it, and resume. Paused jobs are not charged against your daily allowance. If the same field keeps failing, see our guide to <a href="/blog/auto-apply-errors-fix-common-form-issues">fixing date, number and upload errors</a>.</p>

    <h3>Stuck jobs or the same page repeating</h3>
    <p>If the extension keeps opening the same job or cycles through one results page, it is usually working from stale search state. Update the extension to the latest version from the Chrome Web Store, then reset the run from the dashboard so it starts with a fresh job selection. Changing your search terms or filters and starting again also clears the old state.</p>

    <h3>Applications not showing in the tracker</h3>
    <p>The extension queues outcomes and imports them into your dashboard. If you ran it while the dashboard was closed, or your session on autoapplycv.in had expired, results can sit in that queue. Open the dashboard once while logged in and leave it open for a moment so the extension can flush the pending queue. Then check the applications tracker again.</p>

    <h3>Saved answers are not being used</h3>
    <p>Answers you type in the dashboard need to reach the extension settings. Save them in the dashboard first, then sync them to the extension. If an answer still is not used, check that the question wording matches. "How many years of experience do you have with Python?" and "Years of Python experience" may need the same answer saved against both phrasings.</p>

    <h2>Quick checks before you contact support</h2>
    <ul>
      <li>Same Chrome profile for LinkedIn, the dashboard and the extension.</li>
      <li>Latest extension version installed.</li>
      <li>Dashboard reloaded after any install or update.</li>
      <li>The job actually shows an Easy Apply button, not just "Apply" with an external link.</li>
      <li>Your daily free allowance has not run out. It resets at 00:00 UTC, which is 5:30 AM IST.</li>
    </ul>
    <p>If all of those check out and the problem continues, write in through <a href="/contact">the contact page</a> with the job URL and a description of what the extension showed at the moment it stopped. That pair of details is what support needs to reproduce the issue.</p>

    <h2>Next step</h2>
    <p>Do one supervised run today: three Easy Apply jobs, dashboard open in another tab, and the applications tracker checked at the end. If all three end as submitted or as clearly explained skips, your setup is working and you can expand your search with confidence.</p>
  `,

  "auto-apply-tracking-what-to-measure": `
    <p>Each week, track five numbers: how many applications you submitted, how many replies you got per 100 submissions, how many of those replies became interviews, why jobs were skipped or paused, and how your results differ by role title. Together they tell you whether to change your resume, your filters, or your volume. Everything else is optional. The aim is a short weekly review that leads to one concrete change, not a dashboard you stare at every day.</p>

    <h2>Why weekly, not daily</h2>
    <p>Recruiters do not reply on your schedule. An application sent on Monday might get a reply on Thursday or the following Tuesday, and a single day of data can swing wildly because of one lucky or unlucky posting. A week is long enough to smooth out that noise and short enough that you can still correct course before a month is gone. Pick a fixed day, Sunday evening or Monday morning, and do the review in the same order every time.</p>

    <h2>Metric 1: Submitted applications</h2>
    <p>Count only applications that were actually submitted. Skipped and paused jobs are not applications. In the AutoApply CV <a href="/features">applications tracker</a>, each job lands as submitted, skipped or failed, so this number comes straight from the submitted count. Write it down even if it is small. A free plan user applying 3 times a day will see around 21 in a week, and that is enough to start spotting patterns if the targeting is tight.</p>

    <h2>Metric 2: Reply rate per 100 applications</h2>
    <p>A reply is any human response: a recruiter email, a LinkedIn message, a call, a screening test link, or even a polite rejection written by a person. Automated "we received your application" emails do not count.</p>
    <p>Normalize the number to "replies per 100 applications" so weeks of different sizes are comparable. If you sent 40 applications and got 2 replies, that is 5 per 100. If next week you send 25 and get 2, that is 8 per 100, which is a real improvement even though the raw count did not move.</p>
    <p>Do not compare your number with figures you read online. Reply rates depend heavily on role, seniority, market and city. Compare yourself with your own previous weeks.</p>

    <h2>Metric 3: Reply-to-interview conversion</h2>
    <p>Of the replies, how many turned into an actual interview round? If you get replies but few interviews, the problem is usually after the application: the screening call, your stated salary or notice period, or a mismatch the recruiter noticed when they spoke to you. If you get almost no replies at all, the problem is upstream, in the resume or the jobs you are choosing.</p>

    <h2>Metric 4: Skip and pause reasons</h2>
    <p>This is the metric most people ignore, and it is the cheapest to act on. Group your skipped and paused jobs by reason:</p>
    <ul>
      <li><strong>External apply:</strong> the job sends you to a company site. If this is a large share of your search, your filters may be pulling in roles that are not Easy Apply. These are worth a manual application if the role is strong.</li>
      <li><strong>Already applied:</strong> duplicate prevention caught it. A high count means your searches overlap heavily, and you can broaden titles or locations.</li>
      <li><strong>Validation pause:</strong> LinkedIn rejected an answer, such as a decimal in a whole-number field. Each repeated pause points to one answer you should fix in the answer bank.</li>
      <li><strong>Unknown question:</strong> a screening question the answer bank could not answer truthfully. Add an answer once and it stops costing you jobs.</li>
    </ul>
    <p>None of these are charged against your allowance, but each one is a job that did not get an application. Fixing the top reason each week usually gives you more submissions without changing anything else.</p>

    <h2>Metric 5: Results by role title</h2>
    <p>Split submitted applications and replies by the title you targeted. You might find that "Backend Engineer" gets replies while "Full Stack Developer" gets none with the same resume. That is a signal either to drop the weaker title or to make a version of your resume that genuinely fits it. Our guide on <a href="/blog/auto-apply-keywords-how-to-choose-skill-tags">choosing skill tags that convert</a> covers how to adjust keywords per title.</p>

    <h2>A simple weekly log</h2>
    <p>You do not need a spreadsheet template. A note with these lines works:</p>
    <ol>
      <li>Week of: date</li>
      <li>Submitted: number</li>
      <li>Replies: number, and replies per 100</li>
      <li>Interviews: number</li>
      <li>Top skip or pause reason: one line</li>
      <li>Best and worst role title: one line each</li>
      <li>One change for next week: one line</li>
    </ol>
    <p>The last line is the point of the whole exercise. If you cannot name one change, you have not finished the review.</p>

    <h2>How to read the numbers together</h2>
    <ul>
      <li><strong>Low submissions, decent reply rate:</strong> your targeting works. Increase volume, either by widening locations or by moving beyond the free daily limit. See <a href="/pricing">pricing</a> for options.</li>
      <li><strong>High submissions, very low reply rate:</strong> volume is not the issue. Tighten filters and rework the resume before sending more.</li>
      <li><strong>Many pauses:</strong> spend ten minutes on the answer bank before the next run.</li>
      <li><strong>Replies but no interviews:</strong> review what you are saying on screening calls and in salary or notice period fields.</li>
    </ul>

    <h2>Change one thing at a time</h2>
    <p>If you rewrite your resume, change titles and switch locations in the same week, you will not know which change helped. Make one change, run a full week, and compare. It feels slower, but it is the only way the tracking actually teaches you something.</p>

    <h2>Next step</h2>
    <p>Open your applications tracker now and fill in last week's seven lines, even if the numbers are small. Then pick the single most common skip or pause reason and fix it before your next run.</p>
  `,

  "auto-apply-screening-questions-answer-bank": `
    <p>An answer bank is a saved set of truthful replies to the screening questions employers ask again and again: years of experience with a skill, notice period, current and expected CTC, work authorization, relocation and commute. Build it once, in about thirty minutes, and every later application reuses the same consistent answers instead of you retyping them, or worse, answering differently on Monday than on Friday. This post lists the question types you will meet on LinkedIn Easy Apply, how to write each answer, and how to keep the bank current.</p>

    <h2>Why consistency matters more than speed</h2>
    <p>Speed is the obvious benefit, but consistency is the real one. Recruiters at the same company often see several of your applications, and some applicant tracking systems keep your previous answers. If you said 4 years of React on one form and 6 on another, that looks careless at best. A single source of truth prevents that. It also prevents the quiet drift where tired evening answers get vaguer than morning ones.</p>

    <h2>The question types to cover</h2>

    <h3>Years of experience with a specific skill</h3>
    <p>Easy Apply frequently asks "How many years of work experience do you have with Java?" with a number box. List every skill in your resume and write a whole number for each. Be honest and conservative: count professional use, not a weekend course. If you used a tool for 18 months, write 1, not 2. Some forms reject decimals, so a whole number is both safer and easier to defend in an interview.</p>
    <p>Add the skills that appear in job descriptions you target, even if you have little experience. For a skill you have never used professionally, the truthful answer is 0, and it is better to save that than to leave the question unanswered and have the run pause every time.</p>

    <h3>Notice period</h3>
    <p>Indian employers ask this almost universally, sometimes as a dropdown (Immediate, 15 days, 30 days, 60 days, 90 days) and sometimes as a number of days. Save both forms: the number of days and the closest dropdown label. If you are serving notice, decide how you will phrase it and keep it the same everywhere.</p>

    <h3>Current CTC and expected CTC</h3>
    <p>Decide on the unit before writing anything. Some forms want annual figures in rupees, some in lakhs per annum, some ask for monthly figures, and global roles may want a currency. Save your figures in each format you are likely to meet, for example annual rupees as a plain number and lakhs per annum as a decimal like 12.5. Write your expected figure as a realistic range in text fields and a single number in numeric fields.</p>

    <h3>Work authorization and visa sponsorship</h3>
    <p>"Are you legally authorized to work in this country?" and "Will you now or in the future require sponsorship?" are yes/no questions with legal weight. Answer them exactly as your situation stands for each country you target. This topic has enough traps that we cover it separately in <a href="/blog/auto-apply-work-authorization-forms">handling work authorization forms</a>.</p>

    <h3>Relocation and commute</h3>
    <p>"Are you willing to relocate?" and "Are you comfortable commuting to this job's location?" look harmless, but answering yes to roles you would never take wastes your application and the recruiter's call. Decide your real limits: which cities you would move to, and how far you would commute for a hybrid role. If your answer genuinely depends on the city, narrow your location filters rather than saying yes everywhere.</p>

    <h3>Education and certifications</h3>
    <p>Degree level, graduation year, and yes/no questions like "Do you have an AWS certification?" Save your highest degree, the year, and a clear list of certifications you hold right now, not ones in progress.</p>

    <h3>Free-text questions</h3>
    <p>Occasionally a form asks "Why are you interested in this role?" or "Describe a project using Kafka." These do not reuse well. Keep a short, honest two-sentence summary of your background that you are comfortable sending, and accept that some questions deserve a manual answer.</p>

    <h2>How the answer bank works in AutoApply CV</h2>
    <p>You save answers in the dashboard and sync them to the extension settings. During a run on LinkedIn Easy Apply, the extension fills matching questions from those saved answers. When it meets a question it cannot answer truthfully from the bank, it pauses that job instead of guessing, and the question shows up under pending questions on the dashboard. Answer it there, save, and the next time that question appears it is filled for you. Paused jobs do not use your daily allowance. More detail on the extension side is on the <a href="/auto-apply-chrome-extension">Chrome extension page</a>.</p>

    <h2>Writing rules that save you trouble later</h2>
    <ul>
      <li><strong>Only write what you can defend in an interview.</strong> If a recruiter asks you to talk about your 5 years of Kubernetes, you need 5 years of stories.</li>
      <li><strong>Use whole numbers for years.</strong> They pass more validation rules and are easier to keep consistent.</li>
      <li><strong>Save multiple phrasings.</strong> "Years of experience with SQL" and "How many years have you worked with SQL databases?" may need separate entries with the same answer.</li>
      <li><strong>Avoid absolute claims you cannot meet.</strong> "Can you start immediately?" should only be yes if it is true.</li>
      <li><strong>Keep salary units explicit.</strong> Note in the bank whether a figure is annual, monthly, rupees or lakhs.</li>
    </ul>

    <h2>Keep it current</h2>
    <p>An answer bank goes stale. Your experience count rises every year, your notice period changes when you resign, and your expected CTC moves after an offer. Set a reminder to review it monthly, and immediately after any of those life events. Re-sync to the extension after each edit so old values do not keep going out.</p>

    <h2>Next step</h2>
    <p>Open the last five job descriptions you were interested in, copy every skill named in them, and write a whole-number year count for each into your answer bank today. That one list covers the most common pause reason before your next run.</p>
  `,

  "auto-apply-errors-fix-common-form-issues": `
    <p>Most auto-apply form errors come from a value that is correct for you but in the wrong format for the field: a decimal where only whole numbers are accepted, a date written as 05/03/2024 when the field wants a month picker, a phone number with or without the country code in the wrong place, or a required resume or cover letter upload that is missing. Fix the format once in your saved answers and the same error stops coming back. This guide covers each error type, what LinkedIn Easy Apply usually expects, and how to correct it inside AutoApply CV.</p>

    <h2>How errors show up</h2>
    <p>On LinkedIn Easy Apply, a rejected value shows as a red outline with a short message under the field, such as "Enter a whole number between 0 and 99" or "Please make a selection." The form will not advance until it is fixed. When the AutoApply CV extension hits one of these, it pauses that job rather than trying random values, and the question appears in the dashboard's pending questions. Paused jobs are not charged. The fix is always the same shape: work out what format the field wants, save the corrected answer, sync and resume.</p>

    <h2>Number format errors</h2>

    <h3>Decimal versus whole number</h3>
    <p>The most common case. A field asks "How many years of experience do you have with Python?" and you saved 2.5. Many of these fields accept only integers. Save whole numbers for experience questions. Round down if you are unsure; it is better to understate slightly than to claim time you cannot account for.</p>
    <p>The opposite also happens: a field for CTC in lakhs may accept 12.5, while a field for annual salary in rupees expects 1250000 with no decimal point.</p>

    <h3>Commas, currency symbols and units</h3>
    <p>Numeric fields usually reject "12,50,000", "₹12 LPA" or "12 lakhs". They want digits only. Keep a plain-digit version of each salary figure in your answer bank, and put units or ranges only in fields that are clearly free text.</p>

    <h3>Range limits</h3>
    <p>Some fields set a minimum or maximum, such as 0 to 50 for years of experience, or a minimum salary figure. If your value is outside it, the message usually tells you the range. A notice period entered as 90 into a field limited to 60 will fail; in that case the honest fix is to choose the highest option and explain in a text field or later on the call.</p>

    <h2>Date format errors</h2>
    <p>Dates appear in questions like "When can you start?", "Graduation date" or "Date of birth" on some company forms. Common formats include:</p>
    <ul>
      <li>MM/DD/YYYY, used by many US-built forms.</li>
      <li>DD/MM/YYYY, the usual format in India and the UK.</li>
      <li>Month and year pickers with two separate dropdowns.</li>
      <li>A year-only number field for graduation.</li>
    </ul>
    <p>The danger is a date like 05/03/2025, which is valid in both formats but means March 5 in one and May 3 in the other. The form accepts it and you end up with the wrong start date on record. When a field shows a placeholder such as mm/dd/yyyy, follow it exactly. For start dates, a relative answer in a text field ("30 days from offer") is often clearer than a calendar date that will be out of date next week.</p>

    <h2>Phone number and country code errors</h2>
    <p>Easy Apply usually shows a separate country code dropdown and a phone number box. If you save your number as +91 98xxxxxxxx in the number box while India is already selected, the code can be doubled or the field can reject the plus sign. Save the national number only, 10 digits for an Indian mobile, without spaces, dashes or a leading zero, and make sure your LinkedIn profile has the right country selected. For roles abroad where you have a local number, keep the number that matches the country you are applying from.</p>

    <h2>Required uploads</h2>

    <h3>Resume</h3>
    <p>Most Easy Apply flows offer resumes you have uploaded to LinkedIn before and ask you to pick one. If none is selected or the file is missing, the form stops. Upload your current resume to AutoApply CV as PDF, DOCX or TXT, under 5MB. PDF is the safest choice for layout. Remove old versions you no longer want sent so the wrong one is never chosen.</p>

    <h3>Cover letter</h3>
    <p>Some postings make a cover letter mandatory. If you do not have one available, the job cannot be completed automatically. You can either keep a short, honest general cover letter ready for these roles, or treat them as manual applications where a tailored letter is worth the effort. Our post on <a href="/blog/auto-apply-cover-letters-when-to-skip">when to skip or generate a cover letter</a> helps you decide.</p>

    <h3>File size and type</h3>
    <p>A scanned resume saved as a large image PDF can exceed size limits or be unreadable by an ATS. Export from a document editor instead of scanning, and keep the file text-based.</p>

    <h2>Dropdown and checkbox errors</h2>
    <p>"Please make a selection" means a required dropdown or radio button was left empty, often because your saved answer does not match any option text. If you saved "Yes, I am willing" and the options are only Yes and No, the match can fail. Save short answers that match option labels exactly, such as Yes, No, Immediate, or 30 days.</p>

    <h2>Text length errors</h2>
    <p>Single-line text fields sometimes cap length. A three-paragraph summary pasted into a short field will be rejected or cut off. Keep a one-sentence version of any long answer.</p>

    <h2>Fixing an error in AutoApply CV, step by step</h2>
    <ol>
      <li>Open the pending questions on the LinkedIn auto-apply page of your dashboard.</li>
      <li>Read the question and, if you can, open the job to see the exact error message.</li>
      <li>Enter the value in the format the field wants: digits only, whole number, correct date order, or an exact option label.</li>
      <li>Save it to the answer bank and sync to the extension settings.</li>
      <li>Resume the run.</li>
    </ol>
    <p>If the same field still fails after a correct answer, update the extension and check the <a href="/help-center">Help Center</a>, or contact support with the job URL.</p>

    <h2>Next step</h2>
    <p>Go through your saved answers now and convert every experience figure to a whole number and every salary figure to digits only. Then check your phone number has no country code in it. Those three edits remove the most frequent pauses.</p>
  `,

  "auto-apply-work-authorization-forms": `
    <p>Handle work authorization forms cleanly by deciding your exact, truthful answer for each country you target before you apply, saving it once, and only auto-applying to jobs in countries where that answer is stable. The two questions you will see most are "Are you legally authorized to work in [country]?" and "Will you now or in the future require sponsorship for employment visa status?" They are yes/no, they are often used as hard filters, and a wrong answer can end your candidacy even after an offer. This post explains how to work out your answers, the variations you will meet on LinkedIn Easy Apply, and how to keep automation from sending the wrong reply.</p>

    <p>This is general guidance, not legal advice. If your status is complicated, check with the immigration authority of the country or a qualified adviser.</p>

    <h2>The two core questions, and why they are separate</h2>
    <p><strong>Authorization</strong> asks about today: can you legally work for this employer in this country right now? <strong>Sponsorship</strong> asks about the future: will the employer ever need to file paperwork for you to keep working? A person can be authorized now and still need sponsorship later, for example someone on a time-limited permit. Answer each question on its own terms. Saying "No" to sponsorship because you do not need it this month, when you will need it next year, is the kind of answer that causes problems at the offer stage.</p>

    <h2>Work out your answer per country</h2>
    <p>Make a short list of every country that appears in your job search filters. For each, write:</p>
    <ol>
      <li>Am I authorized to work there today without employer help? Yes or no.</li>
      <li>Will I need employer sponsorship now or later to work there? Yes or no.</li>
      <li>Any condition worth noting, such as a permit expiry date.</li>
    </ol>
    <p>For many readers in India, the result is simple: authorized in India, no sponsorship needed in India, and for most other countries not authorized and sponsorship required. That is a perfectly good set of answers. It just means your auto-apply targeting should match it.</p>

    <h2>Variations you will see</h2>
    <ul>
      <li><strong>Country-named versions:</strong> "Are you legally authorized to work in the United States?" or "...in India?" The country in the question decides the answer, not where the company is headquartered.</li>
      <li><strong>Citizenship or residency questions:</strong> "Are you a citizen or permanent resident?" This is narrower than authorization. Someone with a valid work permit is authorized but may not be a permanent resident.</li>
      <li><strong>Visa type dropdowns:</strong> some forms list specific visa categories. Pick only the one you actually hold.</li>
      <li><strong>Remote role versions:</strong> "This role is remote within the UK. Are you able to work from the UK?" Remote does not remove the authorization requirement for the country named.</li>
      <li><strong>Security clearance or background checks:</strong> occasionally attached to government or defence roles. Answer only what is true.</li>
    </ul>

    <h2>Why automation needs extra care here</h2>
    <p>A saved answer is reused by design. That is great for years of experience, but an authorization answer that is correct for India is wrong for a role in Germany. If your search includes several countries, a single saved "Yes" will go out everywhere. Two habits prevent this:</p>
    <ul>
      <li><strong>Match location filters to your authorization.</strong> If you are only authorized in India, set your auto-apply locations to India and to remote roles open to India-based candidates. Apply to roles abroad manually, where you can read each posting's sponsorship policy.</li>
      <li><strong>Save country-specific answers.</strong> Where a question names the country, save the exact phrasing with the correct answer for that country. When the extension meets a phrasing it has no answer for, it pauses and the question appears in your dashboard's pending questions, so you can answer it deliberately rather than letting a guess through.</li>
    </ul>
    <p>The <a href="/auto-apply-linkedin">LinkedIn auto apply page</a> explains how locations and work mode are set before a run.</p>

    <h2>Remote jobs and the "worldwide" trap</h2>
    <p>Many postings say remote but are limited to candidates in one country or time zone for tax and employment law reasons. The authorization question is where that limit is enforced. If you answer "Yes" to work authorization in a country where you do not live, you may pass the form but you will fail later when payroll or the employer of record checks. Read the location line of remote postings and keep your filters aligned. Our post on <a href="/blog/auto-apply-remote-jobs-location-rules">location rules for remote jobs</a> goes deeper on this.</p>

    <h2>Related questions that sit next to authorization</h2>
    <p>Forms often group these together, so prepare them at the same time:</p>
    <ul>
      <li><strong>Relocation:</strong> "Are you willing to relocate to [city]?" Being willing to relocate does not make you authorized there.</li>
      <li><strong>Commute:</strong> "Are you comfortable commuting to this location?" Answer for the actual office in the posting.</li>
      <li><strong>Travel:</strong> "Are you able to travel up to 25%?" Consider whether that travel needs visas you do not have.</li>
      <li><strong>Background check consent:</strong> usually a yes if you are comfortable with standard checks.</li>
    </ul>

    <h2>What to do if you answered wrongly</h2>
    <p>If you realise you sent an incorrect authorization answer, tell the recruiter as soon as they contact you, briefly and plainly. It is far better to correct it early than to have it discovered during document checks. Then fix the saved answer and re-sync it to the extension so it does not repeat.</p>

    <h2>Next step</h2>
    <p>Write your three-line authorization note for each country in your current search filters, then remove any country where your honest answer is "not authorized, sponsorship required" from your auto-apply locations. Apply to those roles by hand when a posting says it sponsors.</p>
  `,

  "auto-apply-daily-limits-pick-best-jobs": `
    <p>With a daily limit of 3 applications, pick the three jobs where you meet nearly every must-have requirement, the posting is recent, the role uses Easy Apply, and nothing in the screening questions is likely to disqualify you, such as location, notice period or sponsorship. Spend five minutes ranking candidates before you start the run, not after. Three well-chosen applications a day add up to around twenty a week, which is enough to get interviews if each one is a real fit.</p>

    <h2>How the free daily limit works</h2>
    <p>On the AutoApply CV free plan you get 3 auto-apply actions per day. The count resets at 00:00 UTC, which is 5:30 AM IST. Only submitted applications use an action. Jobs that are skipped because they need a company-site apply, skipped because you already applied, or paused because of a form error are not charged. That matters for planning: a bad pick that pauses does not burn your quota, but it also does not move your search forward. If you want more volume later, the options are on the <a href="/pricing">pricing page</a>.</p>

    <h2>Think of it as a shortlist, not a lottery</h2>
    <p>A limit changes the question from "how many can I send?" to "which ones deserve my slot?" That is a healthy question. Recruiters notice careful applications, and your tracking becomes meaningful because each result is tied to a choice you made deliberately.</p>

    <h2>A five-minute selection routine</h2>

    <h3>Step 1: Pull a candidate list of 10 to 15</h3>
    <p>Run your normal LinkedIn search with your target title and location, filter to Easy Apply and to postings from the past few days. Open anything that looks plausible in new tabs. You are not deciding yet.</p>

    <h3>Step 2: Remove hard mismatches</h3>
    <p>Close any tab where one of these is true:</p>
    <ul>
      <li>The required years of experience are well above yours.</li>
      <li>The location or work mode does not work for you, and the role is not remote for your country.</li>
      <li>The posting requires work authorization you do not have.</li>
      <li>It asks for a notice period you cannot meet, such as "immediate joiners only" when you have 90 days.</li>
      <li>A must-have skill is something you have never used.</li>
    </ul>
    <p>This step usually removes half the list.</p>

    <h3>Step 3: Score what is left</h3>
    <p>For each remaining job, give one point for each of these:</p>
    <ol>
      <li>You match every listed must-have skill.</li>
      <li>Your current or previous title closely matches the posting's title.</li>
      <li>The posting is very recent.</li>
      <li>The company or team is one you would genuinely accept an offer from.</li>
      <li>Your resume already uses the key terms in the description, without edits.</li>
    </ol>
    <p>Take the top three. Ties go to the more recent posting.</p>

    <h3>Step 4: Check the form will go through</h3>
    <p>Look at whether your answer bank covers the likely questions: years with each named skill, notice period, expected CTC, relocation. If a top pick will obviously ask something you have not saved, add the answer first so the job does not pause. See our guide to <a href="/blog/auto-apply-screening-questions-answer-bank">building an answer bank once</a>.</p>

    <h2>Running the three</h2>
    <p>Open the LinkedIn auto-apply page in the dashboard, make sure your search settings match the shortlist (title, location, work mode), and start the run. Keep the dashboard open in another tab so outcomes import. When it finishes, check the applications tracker: you want three submitted entries. If one paused, fix the answer in pending questions; the slot is still available because paused jobs are not charged.</p>

    <h2>What to do with the jobs you did not pick</h2>
    <ul>
      <li><strong>Strong fits that use company-site applications:</strong> apply manually. These are often worth the extra ten minutes.</li>
      <li><strong>Good fits you ran out of slots for:</strong> save them on LinkedIn and consider them tomorrow if they are still recent.</li>
      <li><strong>Roles with a named recruiter or hiring manager:</strong> a short, specific message can matter as much as the application. Our <a href="/blog/auto-apply-networking-10-minute-addon">10-minute networking add-on</a> explains a simple routine.</li>
    </ul>

    <h2>Mistakes that waste a limited quota</h2>
    <ul>
      <li><strong>Applying to the first three results.</strong> Search order reflects LinkedIn's ranking, not your fit.</li>
      <li><strong>Stretch roles every day.</strong> One stretch role a week is fine. Three a day means most of your quota goes to long shots.</li>
      <li><strong>Reapplying to similar postings from the same company.</strong> Duplicate prevention catches exact repeats, but three near-identical roles at one company mostly reach the same recruiter.</li>
      <li><strong>Ignoring the resume match.</strong> If you need to rewrite your resume for a role, it probably should not be one of today's three.</li>
    </ul>

    <h2>A worked example</h2>
    <p>Say you are a backend developer in Pune with 3 years of experience and a 60-day notice period. Your morning search returns 14 recent Easy Apply postings. Four ask for 6 or more years, two are on-site in Gurugram where you will not relocate, and one says immediate joiners only. That leaves seven. Scoring them, two match every must-have skill, your title and your resume terms, and are at companies you would join; they score 5. Three score 4, missing only a close title match. You take the two top scorers and the most recent of the 4-pointers. The remaining two 4-pointers go on your saved list for tomorrow's shortlist, where they compete with whatever is newly posted.</p>

    <h2>When to consider more volume</h2>
    <p>Stay at three a day for two weeks and track replies. If your shortlists are consistently longer than three strong fits and you are getting replies, you are leaving good roles on the table, and more volume makes sense. If you are struggling to find three good fits, more volume will not help; widen your titles or locations instead.</p>

    <h2>Next step</h2>
    <p>Tomorrow, before you start any run, open 12 recent Easy Apply postings, cut the hard mismatches, score the rest on the five points above, and run only the top three.</p>
  `,

  "auto-apply-timing-best-days-times": `
    <p>The best time to apply is soon after a job is posted, on a day when a recruiter is likely to open their queue, which in practice means applying within the first few days of a posting and preferring working-day mornings in the employer's time zone. There is no magic hour. What matters is where your application lands in the queue when a human reviews it. This post explains how recruiter review and ATS queues work, and what that implies for when you run auto-apply. We are deliberately not quoting "best hour" statistics here, because those figures vary by company and are rarely measured in a way that applies to you.</p>

    <h2>How a typical application queue works</h2>
    <p>When you submit through LinkedIn Easy Apply, your application goes into a list for that posting. Recruiters see it either on LinkedIn or in the company's applicant tracking system. Most recruiters handle several open roles at once, and they review applicants in batches rather than one at a time as they arrive. A common pattern is to sort by newest or by match, scan a set, move a few forward, and come back later.</p>
    <p>Three things follow from that:</p>
    <ul>
      <li><strong>Early applicants get seen while the recruiter is still actively looking.</strong> Once a role has a healthy shortlist, later applications may not get the same attention, even if they are strong.</li>
      <li><strong>The first review often happens within days, not weeks.</strong> Many teams want interviews scheduled quickly after a posting goes live.</li>
      <li><strong>Batching means the exact minute rarely matters.</strong> An application sent at 9:05 and one sent at 9:40 will usually be seen in the same batch.</li>
    </ul>

    <h2>Recency beats time of day</h2>
    <p>The biggest timing decision is how old the posting is. LinkedIn lets you filter by date posted. Applying to roles from the past day or few days keeps you inside the period when the recruiter is still building a pipeline. A posting that is several weeks old may still be open, but the shortlist may already exist, or the role may be close to closed. Older postings are not worthless, they just deserve a quicker fit check before you spend an application on them.</p>
    <p>In AutoApply CV, you can set the date range in your search preferences before a run, so the extension works through recent postings first. This setting has more effect on your results than any choice of hour.</p>

    <h2>Why working-day mornings make sense</h2>
    <p>Reasoning from how recruiters work: they tend to review applicants during their working hours, and many start the day by clearing new items. An application that arrives overnight or early in their morning is near the top of a newest-first list when they sit down. An application that arrives late on a Friday may sit under everything submitted over the weekend by Monday.</p>
    <p>For Indian roles, that means an early-morning IST run fits well. Conveniently, the free daily allowance resets at 00:00 UTC, which is 5:30 AM IST, so a morning run uses a fresh allowance on the same schedule. For roles in other countries, think in the employer's time zone. An evening run in India can land in the working morning on the US east coast, but daylight saving shifts the offset by an hour during the year, so check the current difference for the specific city rather than relying on a fixed rule of thumb.</p>

    <h2>Days of the week</h2>
    <p>Without inventing data, here is the process view:</p>
    <ul>
      <li><strong>Early in the working week:</strong> recruiters are planning interviews for the week and actively reviewing. A reasonable time to apply.</li>
      <li><strong>Midweek:</strong> also fine. Many roles get posted midweek, so recent postings are plentiful.</li>
      <li><strong>Friday afternoon and weekends:</strong> applications sit until the next working day. Not harmful, but there is no advantage unless the posting is brand new and you want to be in the Monday batch.</li>
      <li><strong>Public holidays:</strong> check holidays in the employer's country. A run on a holiday there behaves like a weekend run.</li>
    </ul>
    <p>The practical rule is that any working day is fine as long as the posting is recent. Do not skip a strong, fresh posting just because it is Friday.</p>

    <h2>Timing and daily limits</h2>
    <p>If you are on the free plan with 3 actions a day, timing your run daily is more useful than saving them up. Three applications to postings that went live today usually beat a batch of older ones sent later in the week. If you use more volume, spreading runs through the morning lets you include postings that appear during the day. For choosing which three, see <a href="/blog/auto-apply-daily-limits-pick-best-jobs">how to pick the 3 best jobs today</a>.</p>

    <h2>Things that matter more than timing</h2>
    <p>Timing is a small lever. If your resume does not match the role, a perfectly timed application still gets passed over. In rough order of impact:</p>
    <ol>
      <li>Fit between your experience and the must-have requirements.</li>
      <li>A resume that uses the role's key terms honestly. See <a href="/blog/auto-apply-resume-tips-ats-keywords">resume tips for ATS keywords</a>.</li>
      <li>Correct, consistent screening answers so nothing disqualifies you.</li>
      <li>Posting recency.</li>
      <li>Day and time.</li>
    </ol>

    <h2>A simple timing routine</h2>
    <ul>
      <li>Set your search date range to recent postings.</li>
      <li>Run once each working-day morning in the employer's time zone.</li>
      <li>For high-priority roles you spot later in the day, apply that day rather than waiting.</li>
      <li>Skip deliberate timing tricks such as scheduling for a specific minute. They add effort without a clear benefit.</li>
    </ul>
    <p>The <a href="/how-it-works">How it works</a> page shows where search preferences and runs fit in the overall flow.</p>

    <h2>Next step</h2>
    <p>For the next two weeks, run auto-apply each working morning with the date filter set to recent postings, and note in your tracker which day each reply came from. Your own replies are better evidence than any general rule.</p>
  `,

  "auto-apply-rejections-diagnose-callbacks": `
    <p>To diagnose a low callback rate, work through the funnel in order: first check whether your applications are actually being submitted correctly, then whether the jobs you target match your experience, then whether your resume shows that match clearly, and finally whether your screening answers are filtering you out. Most low callback rates have one main cause, and the order matters because fixing a later stage does nothing if an earlier one is broken. This post gives you a checklist for each stage and the signs that point to it.</p>

    <h2>Start with a baseline</h2>
    <p>Before diagnosing, you need a number. Take the last two to four weeks and count submitted applications and human replies (recruiter messages, calls, assessment links, personal rejections). Express it as replies per 100 applications. If you have fewer than about 30 submissions, the number is too noisy to read much into, and the first fix is simply to keep going with a consistent approach while you collect more. Compare against your own earlier weeks, not against figures from other people's posts.</p>

    <h2>Stage 1: Are the applications going through correctly?</h2>
    <p>This is the most overlooked stage. Open the applications tracker and look at outcomes, not just counts.</p>
    <ul>
      <li>Are most entries <strong>submitted</strong>, or are many skipped or paused? Skips for company-site applications and duplicates are normal, but they are not applications.</li>
      <li>Are pauses coming from the same question again and again? That question is blocking jobs that might have been your best fits.</li>
      <li>Is the right resume attached? An old file left in LinkedIn's saved resumes can quietly go out instead of your current one.</li>
      <li>Is your phone number and email correct on the submitted forms? A typo here means recruiters cannot reach you at all.</li>
    </ul>
    <p>If anything here is wrong, fix it before touching anything else. Our post on <a href="/blog/auto-apply-errors-fix-common-form-issues">fixing common form errors</a> covers the usual causes.</p>

    <h2>Stage 2: Are you applying to the right jobs?</h2>
    <p>If submissions are clean, look at targeting. Pull ten recent submitted jobs and honestly score each:</p>
    <ul>
      <li>Do your years of experience fall inside the stated range?</li>
      <li>Do you have every must-have skill, used professionally?</li>
      <li>Is the title close to what you do now or did last?</li>
      <li>Does the location and work mode fit you, and are you authorized to work there?</li>
    </ul>
    <p>If fewer than seven of the ten pass all four, your callback problem is mostly a targeting problem. Narrow your titles, tighten seniority, and check location filters. Broad titles like "Software Engineer" with no seniority filter often pull in roles several levels above or below you.</p>

    <h2>Stage 3: Does your resume show the match?</h2>
    <p>If you are applying to well-matched jobs and still hearing nothing, the resume is the likely cause. A recruiter typically scans quickly, and an ATS may rank or filter by terms. Check:</p>
    <ul>
      <li><strong>Top third:</strong> does it show your target title and the three or four skills these jobs ask for most?</li>
      <li><strong>Terms:</strong> does it use the same words as the postings? "Node.js" versus "NodeJS" usually does not matter, but "data pipelines" versus no mention of pipelines at all does.</li>
      <li><strong>Evidence:</strong> do bullet points say what you built and what changed, or only list duties?</li>
      <li><strong>Format:</strong> is it a text-based PDF or DOCX that an ATS can read, without key details trapped in images or text boxes?</li>
    </ul>
    <p>The <a href="/features">AutoApply CV resume tools</a> can tailor wording for ATS, but tailoring only helps if the underlying experience is a real fit.</p>

    <h2>Stage 4: Are screening answers filtering you out?</h2>
    <p>Some rejections come seconds or hours after applying, before any person could have read your resume. Fast, automatic rejections often point to a knockout question. Look at what you are saving for:</p>
    <ul>
      <li><strong>Years of experience with a skill:</strong> if you saved 0 or 1 for a skill the role lists as required, the ATS may filter you out. That is correct behaviour if it is true; the fix is targeting, not inflating.</li>
      <li><strong>Notice period:</strong> a 90-day notice against roles asking for immediate or 30-day joiners will be filtered often. Consider prioritizing roles that accept longer notice, or check if early release is possible.</li>
      <li><strong>Expected CTC:</strong> a figure well above the role's band can trigger automatic rejection. Check that you are not saving a number in the wrong unit, such as rupees where lakhs were expected.</li>
      <li><strong>Sponsorship and authorization:</strong> roles that do not sponsor will reject a "yes, I need sponsorship" answer, correctly. Keep those countries out of your auto-apply locations.</li>
      <li><strong>Relocation and commute:</strong> answering "no" for on-site roles in other cities is honest, and also a reason to remove those cities from your filters.</li>
    </ul>

    <h2>Reading rejection timing</h2>
    <ul>
      <li><strong>Rejected within minutes or hours:</strong> likely an automated knockout from a screening answer or a hard filter.</li>
      <li><strong>Rejected after a week or more:</strong> a person probably reviewed it and chose others, which points to Stage 2 or 3.</li>
      <li><strong>No response at all:</strong> the most common outcome. It can mean the role was filled, paused, or that your application was not in the batch the recruiter reviewed. Recency matters here; see <a href="/blog/auto-apply-timing-best-days-times">timing based on how recruiter queues work</a>.</li>
    </ul>

    <h2>Fix one stage, then re-measure</h2>
    <p>Pick the earliest broken stage, make one change, and run for a full week before judging. Changing resume, titles and answers all at once leaves you guessing which one helped. If you also add a short, specific message to a recruiter for your strongest fits, keep that separate in your notes so you can see its effect.</p>

    <h2>When it is not you</h2>
    <p>Sometimes the market for a role and city is simply slow. If your applications are clean, well targeted, your resume clearly matches, and screening answers are reasonable, keep the routine steady and widen carefully: a neighbouring title, an extra city, or remote roles open to your country. Review your search titles, locations and work mode against the setup notes on <a href="/auto-apply-linkedin">LinkedIn auto apply</a> to make sure nothing has drifted.</p>

    <h2>Next step</h2>
    <p>Pull your last ten submitted applications from the tracker today and score them against the four Stage 2 questions. The result tells you whether to spend this week on targeting or on your resume.</p>
  `,
};
