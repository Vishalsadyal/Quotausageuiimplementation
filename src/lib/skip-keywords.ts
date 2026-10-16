// "Skip posts that mention": AI-suggested words and phrases for the WhatsApp, Email and LinkedIn comment tools.
// A post with any of these words is skipped. Kept free of database imports so it can be tested on its own.

export type SkipTool = "wa" | "email" | "comment" | "all";

const TOOL_DESC: Record<SkipTool, string> = {
  wa: "Their tool sends WhatsApp messages to recruiters who post a phone number.",
  email: "Their tool sends emails to recruiters who post an email address.",
  comment: "Their tool comments on recruiters' hiring posts.",
  all: "Their tools send WhatsApp messages and emails to recruiters who post their contact details, and comment on hiring posts. One skip list covers all three.",
};

/** Words that appear in normal hiring posts. A suggestion made only of these would make the tool skip real recruiters. */
const HIRING_WORDS = new Set(
  "hiring vacancy vacancies opening openings urgent job jobs apply now resume cv recruiting recruitment send walk in we are looking for join our team".split(" ")
);

const norm = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Cleans an AI list into skip keywords: lowercase, 2-40 characters, at most 5 words, no commas (the box is
 * comma-separated), nothing already in `existing`, no duplicates, and nothing made only of normal hiring words.
 */
export function cleanSkipKeywords(value: unknown, existing: string[] = [], max = 20): string[] {
  const seen = new Set(existing.map(norm));
  const out: string[] = [];
  const items = Array.isArray(value) ? value : [];
  for (const raw of items) {
    if (typeof raw !== "string") continue; // numbers, null and objects are not keywords
    for (const piece of raw.split(",")) {
      const item = norm(piece)
        .replace(/[^a-z0-9 #+.&'-]/g, "")
        .replace(/^[\s.'-]+|[\s.'-]+$/g, "")
        .replace(/\s+/g, " ");
      if (item.length < 2 || item.length > 40) continue;
      if (!/[a-z]/.test(item)) continue; // a bare number or symbol would skip every post that contains it
      const words = item.split(" ");
      if (words.length > 5) continue;
      if (words.every((w) => HIRING_WORDS.has(w))) continue;
      if (seen.has(item)) continue;
      seen.add(item);
      out.push(item);
      if (out.length >= max) return out;
    }
  }
  return out;
}

export class SkipKeywordsError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

/** Asks the AI for skip words, tailored to the user's roles. Throws SkipKeywordsError with a message fit to show. */
export async function suggestSkipKeywords(opts: {
  apiKey: string;
  tool: SkipTool;
  roles: string[];
  existing: string[];
  fetchImpl?: typeof fetch;
}): Promise<string[]> {
  if (!opts.apiKey) throw new SkipKeywordsError("AI is not set up on this server yet.", 500);
  const doFetch = opts.fetchImpl ?? fetch;

  const systemPrompt = `You help a job seeker automate outreach on LinkedIn. ${TOOL_DESC[opts.tool]} They must SKIP posts that are not a real hiring post for them.
Suggest words or short phrases (1 to 5 words, lowercase) that, when they appear in a post, mean the post should be skipped. Cover:
1. Posts written by job seekers, not recruiters (for example "open to work", "looking for a job", "available immediately").
2. People selling courses, coaching, services or "earn from home" schemes.
3. Roles or seniority that do not fit this person's roles (use the roles given).
4. Unpaid, commission-only or "work for exposure" offers.
NEVER suggest words that appear in normal hiring posts, such as "hiring", "vacancy", "opening", "urgent", "apply", "resume" or "cv". Every item must be specific enough that a real recruiter's post would not contain it.
Return ONLY JSON: {"keywords": ["...", "..."]} with about 20 items.`;
  const userPrompt = `The person's target roles: ${opts.roles.length ? opts.roles.join(", ") : "not provided"}.
Already on their skip list (do not repeat): ${opts.existing.length ? opts.existing.join(", ") : "nothing yet"}.
Give the JSON now.`;

  const ask = async (): Promise<string[]> => {
    const res = await doFetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new SkipKeywordsError("The AI service did not answer. Please try again in a moment.", 502);
    const data = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string } }> } | null;
    let parsed: { keywords?: unknown } = {};
    try {
      parsed = JSON.parse(data?.choices?.[0]?.message?.content || "{}");
    } catch {
      throw new SkipKeywordsError("The AI returned an unreadable answer. Please try again.", 502);
    }
    const cleaned = cleanSkipKeywords(parsed.keywords, opts.existing);
    if (!cleaned.length) throw new SkipKeywordsError("The AI had no new suggestions. Try again or add your own words.", 502);
    return cleaned;
  };

  // The model sometimes spends its whole budget thinking and returns nothing usable: try once more.
  try {
    return await ask();
  } catch (error) {
    if (error instanceof SkipKeywordsError && error.status === 500) throw error;
    return await ask();
  }
}
