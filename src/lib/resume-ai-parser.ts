export type AiParsedResume = {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  yearsOfExperience?: string;
  educationLevel?: string;
  skills?: string[];
  skillsWithYears?: Record<string, number>;
  jobTitles?: string[];
  workAuthorization?: string;
  summary?: string;
  screeningAnswers?: Record<string, string | number>;
  experience?: Array<{
    title: string;
    company: string;
    location?: string;
    startDate: string;
    endDate?: string;
    description?: string[];
  }>;
  projects?: Array<{
    name: string;
    description?: string;
    technologies?: string[];
    link?: string;
  }>;
  education?: Array<{
    degree: string;
    field?: string;
    institution: string;
    location?: string;
    startDate?: string;
    endDate?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer?: string;
    date?: string;
  }>;
};

const SYSTEM_PROMPT = `You extract structured data, 100 target search keywords, and LinkedIn screening answers from resumes. Return ONLY valid JSON with these exact fields:
{
  "name": "Full name",
  "email": "Email address",
  "phone": "Phone number with country code",
  "city": "Current City",
  "state": "State or region",
  "country": "Country",
  "linkedinUrl": "LinkedIn profile URL",
  "portfolioUrl": "Portfolio or personal website URL",
  "yearsOfExperience": "Total years of professional experience (integer number only as string, e.g. '5')",
  "educationLevel": "Highest education level (e.g. 'Bachelor\\'s Degree', 'Master\\'s Degree', 'Doctorate / PhD', 'Associate Degree', 'High School')",
  "skills": ["Array of EXACTLY 50 technical skills, tools, frameworks, protocols, and domain keywords extracted from and relevant to the resume, each written exactly as it is officially spelled, keeping dots, spaces and symbols (e.g. 'Next.js', 'Node.js', 'React Query', 'C++', 'CI/CD', not 'Nextjs' or 'Nodejs') (e.g. 'PLC', 'SCADA', 'Automation', 'Wiring', 'Schematics', 'Switchgear', 'Earthing', 'Voltage', 'Relays', 'Motors', 'Drives', 'VFD', 'Modbus', 'Profibus', 'Ethernet', 'Safety', 'Python', 'MATLAB', 'Simulink', 'AutoCAD')"],
  "skillsWithYears": {
    "JavaScript": 5,
    "React": 4,
    "WordPress": 3,
    "Adobe XD": 3
  },
  "jobTitles": ["Array of EXACTLY 50 specific multi-word job titles and search terms matching the candidate's exact tech stack, variations, and seniority (e.g. 'PLC Programmer', 'SCADA Engineer', 'Industrial Automation Engineer', 'Control Systems Engineer', 'Electrical Engineer', 'Junior Electrical Engineer', 'Automation Engineer', 'Instrumentation Engineer', etc.)"],
  "workAuthorization": "Work authorization / visa status ONLY if the resume states it explicitly, otherwise an empty string",
  "summary": "High-impact keyword-rich professional summary (3-4 sentences) highlighting core stack, years of experience, and key accomplishments",
  "screeningAnswers": {
    "bachelors_degree_completed": "Yes or No, from the education section",
    "masters_degree_completed": "Yes or No, from the education section"
  },
  "experience": [
    {
      "title": "Job title",
      "company": "Company name",
      "location": "City, State, Country (optional)",
      "startDate": "YYYY-MM or Month YYYY",
      "endDate": "YYYY-MM or Month YYYY or Present",
      "description": ["bullet point 1", "bullet point 2"]
    }
  ],
  "projects": [
    {
      "name": "Project name",
      "description": "Brief description",
      "technologies": ["tech1", "tech2"],
      "link": "Project URL (optional)"
    }
  ],
  "education": [
    {
      "degree": "Degree name (e.g., Bachelor of Technology, Master of Science)",
      "field": "Field of study (e.g., Computer Science)",
      "institution": "University/Institution name",
      "location": "City, State, Country (optional)",
      "startDate": "YYYY or Month YYYY (optional)",
      "endDate": "YYYY or Month YYYY (optional)"
    }
  ],
  "certifications": [
    {
      "name": "Certification name",
      "issuer": "Issuing organization",
      "date": "YYYY-MM or YYYY (optional)"
    }
  ]
}

Rules:
1. Generate a total of 100 rich, unique keywords across 'jobTitles' (30-50 titles/search queries) and 'skills' (50-70 technical skills/tools/frameworks).
2. Populate 'summary' with a compelling ATS summary tailored to the candidate's actual projects and experience.
3. Never guess facts about the candidate. Visa sponsorship, work authorization, notice period, driving licence, background checks, commuting and relocation are answered by the candidate later: leave them out unless the resume states them word for word.
4. portfolioUrl is the candidate's own website or portfolio only, never a client or project site. Empty string if there is none.
5. Return ONLY the JSON object. Do not include markdown explanation.`;

export async function parseResumeWithAi(
  resumeText: string,
  signal?: AbortSignal,
): Promise<AiParsedResume> {
  const apiKey = process.env.GROQ_API_KEY || "";
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const truncated = resumeText.slice(0, 30000);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Extract data from this resume:\n\n${truncated}` },
      ],
      temperature: 0.1,
      max_tokens: 8192,
      response_format: { type: "json_object" },
    }),
    signal,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Groq API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq returned empty response");
  }

  try {
    const raw = JSON.parse(content) as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v === null || v === undefined) continue;
      if (k === "yearsOfExperience") cleaned[k] = String(v);
      else if (k === "skills" || k === "jobTitles") cleaned[k] = Array.isArray(v) ? v : [];
      else if (k === "experience" || k === "projects" || k === "education" || k === "certifications") {
        cleaned[k] = Array.isArray(v) ? v : [];
      }
      else if (typeof v === "string") cleaned[k] = v;
      else if (typeof v === "number") cleaned[k] = String(v);
      else cleaned[k] = v;
    }
    return cleaned as unknown as AiParsedResume;
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${content.slice(0, 200)}`);
  }
}
