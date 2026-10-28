import { prisma } from "src/lib/prisma";
import { writeAuditLog } from "src/lib/audit";
import { invalidateUserAnswersCache } from "src/lib/screening-cache";

export class SearchProfileError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v ?? "").trim()).filter(Boolean) : [];
}

/** Trims, de-duplicates (case-insensitive) and enforces a word count / length on an AI keyword list. */
function cleanKeywordList(value: unknown, opts: { max: number; words?: 1 | 2; minLength?: number }): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of toStringList(value)) {
    const item = raw.replace(/\s+/g, " ").replace(/^[^a-zA-Z0-9+#.]+|[^a-zA-Z0-9+#.)]+$/g, "").trim();
    if (item.length < (opts.minLength ?? 2) || item.length > 60) continue;
    if (opts.words && item.split(" ").length !== opts.words) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= opts.max) break;
  }
  return out;
}

// Exclude words skip any job whose title has them (extension skip rules), so broad words would skip good jobs:
// "Sales" blocks "Sales Tax Accountant", "Manager" blocks "Accounts Manager".
const COMMON_JOB_POST_WORDS = new Set([
  "sales", "marketing", "manager", "management", "director", "lead", "head", "senior", "junior", "executive",
  "officer", "assistant", "associate", "finance", "operations", "support", "hr", "human resources", "admin",
  "administration", "business", "team", "president", "vice president", "principal", "specialist", "analyst",
]);

const wordsForMatch = (value: string) =>
  value.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();

/**
 * Makes the AI's exclude list safe: splits joined words ("VicePresident" -> "Vice President"), drops words
 * common in job posts, and drops any word found in the user's own job titles ("Junior" while they search
 * "Junior Accountant").
 */
function safeExcludeList(list: string[], titles: string[]): string[] {
  const titleText = ` ${titles.map(wordsForMatch).join(" | ")} `;
  const out: string[] = [];
  for (const raw of list) {
    const item = raw.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim();
    const key = wordsForMatch(item);
    if (!key || COMMON_JOB_POST_WORDS.has(key)) continue;
    if (titleText.includes(` ${key} `)) continue;
    if (out.some((o) => wordsForMatch(o) === key)) continue;
    out.push(item);
    if (out.length >= 8) break;
  }
  return out;
}

// Answers the user picked themselves are kept when the AI runs again (e.g. after a new resume upload).
const USER_CHOICE_KEYS = ["preferred_job_titles", "cp_pref_search_terms", "bad_words", "exclude_keywords"];

async function keysTheUserChose(userId: string): Promise<Set<string>> {
  const rows = await prisma.auditLog.findMany({
    where: { actorUserId: userId, action: "user.screening_answer_saved", targetId: { in: USER_CHOICE_KEYS } },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { targetId: true, metadataJson: true },
  });
  const latest = new Map<string, { source?: unknown; answer?: unknown }>();
  for (const row of rows) {
    if (row.targetId && !latest.has(row.targetId)) latest.set(row.targetId, (row.metadataJson || {}) as { source?: unknown; answer?: unknown });
  }
  const chosen = new Set<string>();
  for (const [key, meta] of latest) {
    if (["manual", "extension_capture"].includes(String(meta.source)) && String(meta.answer || "").trim()) chosen.add(key);
  }
  return chosen;
}

// Generates job titles, 1-word keywords, 2-word phrases, core skills and exclude keywords + 50 single-word keywords and a summary from the user's
// saved resume, and saves them as screening answers the dashboard and extension read.
/**
 * Generates the AI search profile and saves it as answers. `saveOnly` limits which answers are
 * written (e.g. just the skills), so a suggestion doesn't overwrite titles or skip words the user chose.
 */
export async function generateSearchProfileForUser(userId: string, opts?: { saveOnly?: string[] }) {
  const apiKey = process.env.GROQ_API_KEY || "";
  if (!apiKey) {
    throw new SearchProfileError("GROQ_API_KEY is not configured", 500);
  }

  // Load applicant profile and resume
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      currentCity: true,
      resumeText: true,
      resume: {
        select: {
          resumeText: true,
          parsedData: true,
        },
      },
    },
  });

  const resumeContent =
    user?.resume?.resumeText ||
    user?.resumeText ||
    (user?.resume?.parsedData ? JSON.stringify(user.resume.parsedData, null, 2) : "");

  if (!resumeContent || resumeContent.trim().length < 20) {
    throw new SearchProfileError("Please upload your resume first so Groq AI can generate tailored search terms and description.", 400);
  }

  const systemPrompt = `You are an expert AI Career Strategist and ATS Search Specialist.
Read the applicant's resume and build their job-search keyword profile. Use ONLY the applicant's real
field, seniority and skills: the examples below show the FORMAT for different professions, never copy them
unless they truly match this resume.

Return ONLY a JSON object with these keys:
1. "searchTerms": 40 job titles / search queries to type into LinkedIn or Indeed for this person
   (e.g. a frontend developer: "React Developer", "Frontend Engineer"; a data engineer: "Data Engineer", "ETL Developer";
   an electrical engineer: "PLC Programmer", "Automation Engineer").
2. "singleWordKeywords": 40 single-word skills, tools, languages, protocols or acronyms from the resume
   (e.g. "React", "TypeScript", "Kafka", "SQL", "PLC", "AutoCAD"). Each item MUST be ONE word, no spaces.
3. "twoWordPhrases": 30 two-word skill / technology / domain phrases recruiters search for
   (e.g. "React Native", "REST APIs", "Data Pipelines", "Machine Learning", "Ladder Logic", "Power BI").
   Each item MUST be EXACTLY two words. Do NOT repeat job titles here.
4. "coreSkills": 25 core technical skills and stack items the applicant is strongest in, most important first
   (e.g. "React", "Node.js", "PostgreSQL", "AWS", "Apache Spark", "Siemens TIA Portal"). Not job titles.
5. "excludeKeywords": up to 8 words that, if they appear in a JOB TITLE, mean the job is clearly WRONG for this
   applicant: other professions far from theirs (e.g. "Nurse", "Teacher", "Driver", "Telecaller" for an
   accountant), roles far below their level ("Intern", "Trainee" for someone with 5+ years), and "Unpaid".
   NEVER include broad words that appear in many good titles for this person: Sales, Marketing, Manager,
   Director, Lead, Head, Senior, Junior, Executive, Officer, Assistant, Associate, Finance, Operations,
   Support, HR, Human Resources, Admin, Business.
   Never include a word that appears in any of the applicant's searchTerms. Write each one as normal words
   with spaces ("Vice President", never "VicePresident").
6. "description": a high-impact 3-4 sentence professional ATS summary of their strengths and experience.

JSON shape:
{"searchTerms": [...], "singleWordKeywords": [...], "twoWordPhrases": [...], "coreSkills": [...], "excludeKeywords": [...], "description": "..."}`;

  const userPrompt = `Applicant Resume & Details:
Candidate: ${user?.name || "Applicant"}
Location: ${user?.currentCity || "Remote"}

Resume Content:
${resumeContent.slice(0, 15000)}

Generate the keyword profile JSON for this applicant:`;

  // The model sometimes spends its whole token budget reasoning and returns nothing usable, so retry once.
  const requestKeywordProfile = async (): Promise<Record<string, unknown>> => {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 8000,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => "");
      throw new SearchProfileError(`Groq AI request failed: ${errText}`, 502);
    }

    const groqData = await groqRes.json();
    const choice = groqData?.choices?.[0];
    try {
      const result = JSON.parse(choice?.message?.content || "{}") as Record<string, unknown>;
      if (!Array.isArray(result.singleWordKeywords) && !Array.isArray(result.searchTerms)) {
        throw new Error(`no keyword lists (finish_reason: ${choice?.finish_reason})`);
      }
      return result;
    } catch (error) {
      console.error("Groq keyword profile unusable:", error instanceof Error ? error.message : error);
      throw new SearchProfileError("AI returned an unreadable answer. Please try again.", 502);
    }
  };

  let parsed: Record<string, unknown>;
  try {
    parsed = await requestKeywordProfile();
  } catch {
    parsed = await requestKeywordProfile();
  }

  const description: string = String(parsed.description || "").trim();
  const searchTermsList = cleanKeywordList(parsed.searchTerms, { max: 50, minLength: 3 });
  // Single words: split anything multi-word the model sent ("React Native" -> "React", "Native").
  const singleWordList = cleanKeywordList(
    toStringList(parsed.singleWordKeywords || parsed.keywords).flatMap((k) => k.split(/[\s/,|]+/g)),
    { max: 50, words: 1, minLength: 2 }
  );
  const titleSet = new Set(searchTermsList.map((t) => t.toLowerCase()));
  let twoWordsList = cleanKeywordList(parsed.twoWordPhrases || parsed.twoWordKeywords, { max: 40, words: 2 }).filter(
    (p) => !titleSet.has(p.toLowerCase())
  );
  let coreSkillsList = cleanKeywordList(parsed.coreSkills || parsed.skills, { max: 30, minLength: 2 }).filter(
    (s) => !titleSet.has(s.toLowerCase())
  );
  let excludeList = safeExcludeList(
    cleanKeywordList(parsed.excludeKeywords || parsed.negativeKeywords, { max: 20, minLength: 2 }),
    searchTermsList
  );

  // Fallbacks built from this applicant's own results (never another profession's defaults).
  if (twoWordsList.length < 5) {
    twoWordsList = Array.from(new Set([...twoWordsList, ...searchTermsList.filter((t) => t.split(/\s+/).length === 2)])).slice(0, 40);
  }
  if (coreSkillsList.length < 5) coreSkillsList = Array.from(new Set([...coreSkillsList, ...singleWordList])).slice(0, 25);
  if (!excludeList.length) excludeList = safeExcludeList(["Unpaid", "Internship", "Telecaller"], searchTermsList);

  if (!searchTermsList.length && !singleWordList.length) {
    throw new SearchProfileError("AI could not build keywords from your resume. Please try again.", 502);
  }

  // Everything, for the resume profile / extension (titles first, then skills).
  const allKeywords = Array.from(new Set([...searchTermsList, ...singleWordList, ...twoWordsList, ...coreSkillsList])).slice(0, 150);

  // Save directly to userResume.parsedData so /api/user/resume immediately returns all 100 keywords
  const existingResume = await prisma.userResume.findUnique({
    where: { userId },
    select: { parsedData: true, resumeText: true },
  });
  const currentParsed = (existingResume?.parsedData as Record<string, unknown>) || {};
  const updatedParsed = {
    ...currentParsed,
    jobTitles: searchTermsList,
    skills: Array.from(new Set([...coreSkillsList, ...singleWordList])),
    keywordCategories: {
      singleWord: singleWordList,
      twoWord: twoWordsList,
      coreSkills: coreSkillsList,
      exclude: excludeList,
    },
    summary: description || (currentParsed.summary as string) || "",
  };

  await prisma.userResume.upsert({
    where: { userId },
    update: { parsedData: updatedParsed },
    create: {
      userId,
      resumeText: resumeContent.slice(0, 100000),
      parsedData: updatedParsed,
    },
  });

  // Save description & search terms to screening answers so LinkedIn copilot uses them automatically
  if (description) {
    await writeAuditLog({
      actorUserId: userId,
      action: "user.screening_answer_saved",
      targetType: "screening_answer",
      targetId: "description",
      metadataJson: {
        questionKey: "description",
        questionLabel: "Professional Description / Summary",
        answer: description,
        answerType: "text",
        source: "system",
        lastUsed: new Date().toISOString(),
      },
    }).catch(() => null);

    await writeAuditLog({
      actorUserId: userId,
      action: "user.screening_answer_saved",
      targetType: "screening_answer",
      targetId: "summary",
      metadataJson: {
        questionKey: "summary",
        questionLabel: "Summary of Experience",
        answer: description,
        answerType: "text",
        source: "system",
        lastUsed: new Date().toISOString(),
      },
    }).catch(() => null);
  }

  const lastUsed = new Date().toISOString();
  const keywordAnswers: Array<[string, string, string[]]> = [
    ["preferred_job_titles", "Preferred Job Titles / Search Terms", searchTermsList],
    ["cp_pref_search_terms", "Preferred Job Titles / Search Terms", searchTermsList],
    ["one_word_keywords", "1-Word Keywords & Acronyms", singleWordList],
    ["two_words_keywords", "2-Word Phrases & Combos", twoWordsList],
    ["core_skills", "Technical Skills & Competencies", coreSkillsList],
    ["skills", "Technical Skills & Competencies", coreSkillsList],
    ["bad_words", "Blacklist / Exclude Keywords", excludeList],
    ["exclude_keywords", "Blacklist / Exclude Keywords", excludeList],
  ];
  const userChosen = await keysTheUserChose(userId);
  for (const [questionKey, questionLabel, list] of keywordAnswers) {
    if (!list.length) continue;
    if (opts?.saveOnly && !opts.saveOnly.includes(questionKey)) continue;
    // Never replace job titles or exclude words the user set themselves.
    if (userChosen.has(questionKey)) continue;
    await writeAuditLog({
      actorUserId: userId,
      action: "user.screening_answer_saved",
      targetType: "screening_answer",
      targetId: questionKey,
      metadataJson: { questionKey, questionLabel, answer: list.join(", "), answerType: "multiselect", source: "system", lastUsed },
    }).catch(() => null);
  }

  // Invalidate cached screening answers so GET /api/user/screening/answers immediately returns the new answers
  invalidateUserAnswersCache(userId);

  return {
    searchTerms: searchTermsList,
    singleWordKeywords: singleWordList,
    twoWordsKeywords: twoWordsList,
    skills: coreSkillsList,
    excludeKeywords: excludeList,
    allKeywords,
    totalCount: allKeywords.length,
    singleWordCount: singleWordList.length,
    description,
  };
}
