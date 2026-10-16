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

// Generates job titles, 1-word keywords, 2-word phrases, core skills and exclude keywords + 50 single-word keywords and a summary from the user's
// saved resume, and saves them as screening answers the dashboard and extension read.
export async function generateSearchProfileForUser(userId: string) {
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
5. "excludeKeywords": 12 words or short phrases in job titles that are WRONG for this applicant and should be
   auto-skipped: wrong seniority (e.g. "Intern" for a senior, "Director" or "Principal" for a junior), unrelated
   functions (e.g. "Sales", "Telecaller", "Nurse"), unpaid roles. Tailor them to this resume.
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
  let excludeList = cleanKeywordList(parsed.excludeKeywords || parsed.negativeKeywords, { max: 20, minLength: 2 });

  // Fallbacks built from this applicant's own results (never another profession's defaults).
  if (twoWordsList.length < 5) {
    twoWordsList = Array.from(new Set([...twoWordsList, ...searchTermsList.filter((t) => t.split(/\s+/).length === 2)])).slice(0, 40);
  }
  if (coreSkillsList.length < 5) coreSkillsList = Array.from(new Set([...coreSkillsList, ...singleWordList])).slice(0, 25);
  if (!excludeList.length) excludeList = ["Unpaid", "Internship", "Sales", "Telecaller"];

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
  for (const [questionKey, questionLabel, list] of keywordAnswers) {
    if (!list.length) continue;
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
