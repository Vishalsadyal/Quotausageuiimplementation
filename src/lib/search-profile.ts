import { prisma } from "src/lib/prisma";
import { writeAuditLog } from "src/lib/audit";
import { invalidateUserAnswersCache } from "src/lib/screening-cache";

export class SearchProfileError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// Generates 50 job titles + 50 single-word keywords and a summary from the user's
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
Analyze the applicant's resume carefully and generate STRICTLY 100 keywords total, consisting of EXACTLY 50 multi-word job titles/search phrases and EXACTLY 50 single-word core technical keywords:

1. "searchTerms": Array of EXACTLY 50 specific multi-word job titles and search phrases for LinkedIn/Indeed based on the resume (e.g. "PLC Programmer", "SCADA Engineer", "Industrial Automation Engineer", "Control Systems Engineer", "Electrical Engineer", "Junior Electrical Engineer", "Automation Engineer", "Instrumentation Engineer", "Power Systems Engineer", "Renewable Energy Engineer", "Solar Energy Engineer", "Electrical Design Engineer", "HMI Developer", "Embedded Systems Engineer", "Arduino Developer", "Mechatronics Engineer", "Automation Technician", "Electrical Maintenance Engineer", "Process Automation Engineer", "Control Panel Designer", "Electrical Project Engineer", "Junior PLC Engineer", "SCADA Developer", etc.).
2. "singleWordKeywords": Array of EXACTLY 50 single-word technical skills, tools, components, protocols, and domain terms from the resume (e.g. "PLC", "SCADA", "Automation", "Electrical", "Solar", "HMI", "Arduino", "Circuits", "Sensors", "Robotics", "Wiring", "Schematics", "Switchgear", "Earthing", "Voltage", "Inverters", "Microcontrollers", "Firmware", "MATLAB", "Simulink", "AutoCAD", "Instrumentation", "Relays", "Transformers", "Motors", "Drives", "VFD", "IoT", "Modbus", "Profibus", "Ethernet", "Safety", "Power", "Energy", "Embedded", "PCB", "Diagnostics", "Commissioning", "Maintenance", "Calibration", "Telemetry", "Hydraulics", "Pneumatics", "Actuators", "Soldering", "Testing", "Prototyping", "Multimeter", "Oscilloscope", "Profinet"). Each item in this array MUST BE A STRICT SINGLE WORD (no spaces).
3. "description": A high-impact 3-4 sentence professional ATS summary highlighting core technical strengths, projects, and domain experience.

Return ONLY a valid JSON object matching this schema:
{
"searchTerms": ["Title 1", "Title 2", ... exactly 50 items ...],
"singleWordKeywords": ["Keyword1", "Keyword2", ... exactly 50 single words ...],
"description": "Professional summary..."
}`;

  const userPrompt = `Applicant Resume & Details:
Candidate: ${user?.name || "Applicant"}
Location: ${user?.currentCity || "Remote"}

Resume Content:
${resumeContent.slice(0, 15000)}

Generate the strict 50 job titles + 50 single-word keywords (100 total) and description JSON:`;

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
      max_tokens: 3500,
      response_format: { type: "json_object" },
    }),
  });

  if (!groqRes.ok) {
    const errText = await groqRes.text().catch(() => "");
    throw new SearchProfileError(`Groq AI request failed: ${errText}`, 502);
  }

  const groqData = await groqRes.json();
  const rawContent = groqData?.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(rawContent);

  const rawSearchTerms: string[] = Array.isArray(parsed.searchTerms)
    ? parsed.searchTerms.map((t: unknown) => String(t).trim()).filter(Boolean)
    : [];
  const description: string = String(parsed.description || "").trim();
  const rawSingleWords: string[] = Array.isArray(parsed.singleWordKeywords || parsed.keywords)
    ? (parsed.singleWordKeywords || parsed.keywords).map((k: unknown) => String(k).trim()).filter(Boolean)
    : [];

  // Ensure single words are strictly 1 word each
  const singleWordList: string[] = [];
  const seenSingle = new Set<string>();
  for (const item of rawSingleWords) {
    const parts = item.split(/[\s/,|]+/g).map((p) => p.trim().replace(/[^a-zA-Z0-9+#.-]/g, "")).filter(Boolean);
    for (const p of parts) {
      const lower = p.toLowerCase();
      if (!seenSingle.has(lower) && p.length >= 2) {
        seenSingle.add(lower);
        singleWordList.push(p);
      }
    }
  }

  // Ensure multi-word search terms
  const searchTermsList: string[] = [];
  const seenTerms = new Set<string>();
  for (const term of rawSearchTerms) {
    const lower = term.toLowerCase();
    if (!seenTerms.has(lower) && term.length > 2) {
      seenTerms.add(lower);
      searchTermsList.push(term);
    }
  }

  // Deduplicate and combine strictly 100 keywords total
  const allKeywords = Array.from(new Set([...searchTermsList, ...singleWordList])).slice(0, 100);

  // Save directly to userResume.parsedData so /api/user/resume immediately returns all 100 keywords
  const existingResume = await prisma.userResume.findUnique({
    where: { userId },
    select: { parsedData: true, resumeText: true },
  });
  const currentParsed = (existingResume?.parsedData as Record<string, unknown>) || {};
  const updatedParsed = {
    ...currentParsed,
    jobTitles: searchTermsList,
    skills: allKeywords,
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

  const titlesJoined = searchTermsList.join(", ");
  const singleWordJoined = singleWordList.slice(0, 50).join(", ");
  const twoWordsList = searchTermsList.filter((t) => t.includes(" "));
  const twoWordsJoined = twoWordsList.join(", ");
  const skillsJoined = allKeywords.slice(0, 30).join(", ");
  const excludeDefault = "Internship, Junior, Unpaid, Security Clearance";

  if (titlesJoined) {
    await writeAuditLog({
      actorUserId: userId,
      action: "user.screening_answer_saved",
      targetType: "screening_answer",
      targetId: "preferred_job_titles",
      metadataJson: {
        questionKey: "preferred_job_titles",
        questionLabel: "Preferred Job Titles / Search Terms",
        answer: titlesJoined,
        answerType: "multiselect",
        source: "system",
        lastUsed: new Date().toISOString(),
      },
    }).catch(() => null);

    await writeAuditLog({
      actorUserId: userId,
      action: "user.screening_answer_saved",
      targetType: "screening_answer",
      targetId: "cp_pref_search_terms",
      metadataJson: {
        questionKey: "cp_pref_search_terms",
        questionLabel: "Preferred Job Titles / Search Terms",
        answer: titlesJoined,
        answerType: "multiselect",
        source: "system",
        lastUsed: new Date().toISOString(),
      },
    }).catch(() => null);
  }

  if (singleWordJoined) {
    await writeAuditLog({
      actorUserId: userId,
      action: "user.screening_answer_saved",
      targetType: "screening_answer",
      targetId: "one_word_keywords",
      metadataJson: {
        questionKey: "one_word_keywords",
        questionLabel: "1-Word Keywords & Acronyms",
        answer: singleWordJoined,
        answerType: "multiselect",
        source: "system",
        lastUsed: new Date().toISOString(),
      },
    }).catch(() => null);
  }

  if (twoWordsJoined) {
    await writeAuditLog({
      actorUserId: userId,
      action: "user.screening_answer_saved",
      targetType: "screening_answer",
      targetId: "two_words_keywords",
      metadataJson: {
        questionKey: "two_words_keywords",
        questionLabel: "2-Word Phrases & Combos",
        answer: twoWordsJoined,
        answerType: "multiselect",
        source: "system",
        lastUsed: new Date().toISOString(),
      },
    }).catch(() => null);
  }

  if (skillsJoined) {
    await writeAuditLog({
      actorUserId: userId,
      action: "user.screening_answer_saved",
      targetType: "screening_answer",
      targetId: "core_skills",
      metadataJson: {
        questionKey: "core_skills",
        questionLabel: "Technical Skills & Competencies",
        answer: skillsJoined,
        answerType: "multiselect",
        source: "system",
        lastUsed: new Date().toISOString(),
      },
    }).catch(() => null);

    await writeAuditLog({
      actorUserId: userId,
      action: "user.screening_answer_saved",
      targetType: "screening_answer",
      targetId: "skills",
      metadataJson: {
        questionKey: "skills",
        questionLabel: "Technical Skills & Competencies",
        answer: skillsJoined,
        answerType: "multiselect",
        source: "system",
        lastUsed: new Date().toISOString(),
      },
    }).catch(() => null);
  }

  await writeAuditLog({
    actorUserId: userId,
    action: "user.screening_answer_saved",
    targetType: "screening_answer",
    targetId: "bad_words",
    metadataJson: {
      questionKey: "bad_words",
      questionLabel: "Blacklist / Exclude Keywords",
      answer: excludeDefault,
      answerType: "multiselect",
      source: "system",
      lastUsed: new Date().toISOString(),
    },
  }).catch(() => null);

  // Invalidate cached screening answers so GET /api/user/screening/answers immediately returns the new answers
  invalidateUserAnswersCache(userId);

  return {
    searchTerms: searchTermsList,
    singleWordKeywords: singleWordList.slice(0, 50),
    twoWordsKeywords: twoWordsList,
    skills: allKeywords.slice(0, 30),
    excludeKeywords: ["Internship", "Junior", "Unpaid", "Security Clearance"],
    allKeywords,
    totalCount: allKeywords.length,
    singleWordCount: singleWordList.filter((w) => !w.includes(" ")).length,
    description,
  };
}
