import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "src/lib/guards";
import { ok, fail, handleApiError } from "src/lib/api";
import { interviewAiBlocked } from "src/lib/plan-access";

// Call Copilot, used by the /dashboard/interview page (listens in the browser, no extension).
// Stateless by design: the call setup and transcript arrive with each request,
// are forwarded to Groq, and are never written to the database or logs.

const MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"] as const;

const MODE_INSTRUCTIONS = {
  auto: "The lead just finished speaking. Give the best next thing for ME to say in reply.",
  answer: "Answer the lead's most recent question or point directly and convincingly.",
  objection: "The lead raised a concern or objection. Acknowledge it, reframe it, and address it with the facts I provided.",
  pricing:
    "Help me talk about price: anchor on value and outcomes, state the price or range from my facts confidently, and offer options (scope tiers or milestones) instead of discounting.",
  close:
    "Move toward closing: summarize the fit, propose a concrete next step (Upwork offer / contract, start date, first milestone) and ask for commitment.",
  recap: "Recap what was agreed so far and the open questions, then propose clear next steps with owners and dates.",
} as const;

const TONES = {
  consultative: "consultative and calm",
  confident: "confident and direct",
  friendly: "warm and friendly",
} as const;

const INTERVIEW_MODE_INSTRUCTIONS = {
  auto: "The interviewer just finished speaking. Give the best answer for ME to say now.",
  answer: "Answer the interviewer's most recent question directly and confidently.",
  objection: "The interviewer doubted something or pushed back. Address it honestly and positively with my facts.",
  pricing: "The salary / notice-period / compensation topic came up. Answer professionally using my facts, and give a range rather than a single number.",
  close: "The interview is wrapping up. Give a strong closing statement and smart questions I can ask them.",
  recap: "Summarize the key questions asked so far and the strongest points I made, plus what to follow up on.",
} as const;

const MEETING_MODE_INSTRUCTIONS = {
  auto: "Someone just finished speaking. Give the best thing for ME to say or contribute now.",
  answer: "Answer the question just asked to me (or the team) clearly and directly, using my notes.",
  objection: "Someone disagreed or raised a concern. Respond diplomatically: acknowledge it, give my reasoning, and suggest a way forward.",
  pricing: "Give a short status update / estimate on my work: what's done, what's next, timeline and any blocker.",
  close: "The meeting is wrapping up. Propose clear decisions and action items with owners and dates.",
  recap: "Write quick meeting notes: key decisions, action items (owner + date), and open questions.",
} as const;

const REPLY_LANGUAGES = {
  auto: "", // filled per context in languageRule()
  english: "Always reply in clear English, even if they speak another language.",
  hinglish: "Always reply in Hinglish: natural Hindi-English mix written in Roman (Latin) letters, never Devanagari.",
  hindi: "Always reply in simple spoken Hindi written in Devanagari script (हिंदी).",
} as const;

function languageRule(payload: CopilotRequest, other: string) {
  if (payload.replyLanguage !== "auto") {
    return `- The call may be in any language and speech recognition garbles words. Work out what the ${other} most likely meant. ${REPLY_LANGUAGES[payload.replyLanguage]}`;
  }
  return `- The call may be in any language (English, Hindi, Hinglish, Tamil, Spanish…) and speech recognition garbles words. Work out what the ${other} most likely meant. Reply in the SAME language the ${other} is using. If they speak Hindi or Hinglish, reply in Hinglish written in Roman (English) letters, like "Haan, maine yeh project 2 saal kiya hai" — never Devanagari. If they speak English, reply in English.`;
}

const requestSchema = z.object({
  context: z.enum(["interview", "client", "meeting"]).default("interview"),
  mode: z.enum(["auto", "answer", "objection", "pricing", "close", "recap"]).default("auto"),
  replyLanguage: z.enum(["auto", "english", "hinglish", "hindi"]).default("auto"),
  trigger: z.string().max(1500).optional().default(""),
  transcript: z.string().max(8000).optional().default(""),
  setup: z
    .object({
      myRole: z.string().max(300).optional().default(""),
      theirRole: z.string().max(300).optional().default(""),
      goal: z.string().max(600).optional().default(""),
      offer: z.string().max(3000).optional().default(""),
      tone: z.enum(["consultative", "confident", "friendly"]).optional().default("consultative"),
      model: z.enum(MODELS).optional().default("openai/gpt-oss-20b"),
    })
    .optional()
    .default({
      myRole: "",
      theirRole: "",
      goal: "",
      offer: "",
      tone: "consultative",
      model: "openai/gpt-oss-20b",
    }),
});

type CopilotRequest = z.infer<typeof requestSchema>;

function buildInterviewPrompts(payload: CopilotRequest) {
  const setup = payload.setup;
  const system = `You are a real-time interview coach helping a job candidate during a live job interview.
The candidate glances at your answer and says it out loud, so it must be quick to read.

WHO IS ON THE CALL
- Me (the candidate): ${setup.myRole?.trim() || "Job candidate"}
- The interviewer / company: ${setup.theirRole?.trim() || "Interviewer"}
- The role I'm interviewing for: ${setup.goal?.trim() || "Not specified"}

MY BACKGROUND (the only facts you may use about me: resume, skills, projects, salary, notice period)
${setup.offer?.trim() || "(none provided)"}

RULES
- Write what I should SAY, in first person, natural spoken English, ${TONES[setup.tone || "consultative"]}. 2-4 short sentences.
- For technical questions, give the correct, concise answer a strong candidate would give, with one concrete example if useful.
- For behavioural questions, use a quick STAR shape (situation, action, result) from my background.
- Never invent employers, degrees, numbers or projects not in my background. If unknown, give an honest, general answer.
- Always respond to the INTERVIEWER'S LATEST TURN first; earlier transcript is only context.
${languageRule(payload, "interviewer")}

Return ONLY a JSON object:
{
  "say": "the answer I say now",
  "points": ["up to 3 very short key points / keywords to mention"],
  "ask": "a good question I could ask back (or empty string)",
  "signal": "what the interviewer is really testing, very short (or empty string)",
  "stage": "one of: intro | technical | behavioural | hr | salary | closing"
}`;

  const user = `TASK: ${INTERVIEW_MODE_INSTRUCTIONS[payload.mode]}

INTERVIEW TRANSCRIPT SO FAR (from speech recognition, may contain errors):
${payload.transcript.trim() || "(no transcript yet)"}
${payload.trigger.trim() ? `\nINTERVIEWER'S LATEST TURN:\n${payload.trigger.trim()}\n` : ""}
Respond with the JSON object only.`;

  return { system, user };
}

function buildMeetingPrompts(payload: CopilotRequest) {
  const setup = payload.setup;
  const system = `You are a real-time meeting assistant helping me during a live team meeting at work.
I glance at your suggestion and say it out loud, so it must be quick to read.

WHO IS IN THE MEETING
- Me: ${setup.myRole?.trim() || "Team member"}
- The others (team / manager / stakeholders): ${setup.theirRole?.trim() || "My team"}
- Meeting topic / agenda: ${setup.goal?.trim() || "Not specified"}

MY NOTES (the only facts you may use about my work: status, numbers, blockers, deadlines)
${setup.offer?.trim() || "(none provided)"}

RULES
- Write what I should SAY, in first person, natural spoken English, ${TONES[setup.tone || "consultative"]}. 1-3 short sentences.
- Be clear, constructive and professional. Disagree politely with reasons; never blame people.
- Never invent progress, numbers, dates or commitments not in my notes. If unknown, have me say I'll check and get back by a specific time.
- When asked for an estimate or deadline, give a realistic one with the main dependency or risk.
- Always respond to the LATEST THING SAID in the meeting first; earlier transcript is only context.
${languageRule(payload, "speaker")}

Return ONLY a JSON object:
{
  "say": "what I say now",
  "points": ["up to 3 very short points / facts to mention"],
  "ask": "a useful clarifying question I could ask (or empty string)",
  "signal": "decision, action item or risk you noticed, very short (or empty string)",
  "stage": "one of: update | discussion | decision | planning | wrap-up"
}`;

  const user = `TASK: ${MEETING_MODE_INSTRUCTIONS[payload.mode]}

MEETING TRANSCRIPT SO FAR (from speech recognition, may contain errors):
${payload.transcript.trim() || "(no transcript yet)"}
${payload.trigger.trim() ? `\nLATEST THING SAID:\n${payload.trigger.trim()}\n` : ""}
Respond with the JSON object only.`;

  return { system, user };
}

function buildPrompts(payload: CopilotRequest) {
  if (payload.context === "interview") return buildInterviewPrompts(payload);
  if (payload.context === "meeting") return buildMeetingPrompts(payload);
  const setup = payload.setup;
  const system = `You are a real-time sales call coach whispering to a freelancer during a live video call with a potential client they met on Upwork.
Your job: help them understand the client, show fit, handle concerns, and win the contract.

WHO IS ON THE CALL
- Me (the freelancer): ${setup.myRole?.trim() || "Freelancer"}
- The lead: ${setup.theirRole?.trim() || "Potential client"}
- My goal for this call: ${setup.goal?.trim() || "Win the project"}

FACTS I'VE GIVEN YOU (the only facts you may use about me, my work, rates or availability)
${setup.offer?.trim() || "(none provided)"}

RULES
- Write what I should SAY, in first person, natural spoken English, ${TONES[setup.tone || "consultative"]}. 1-3 short sentences, easy to say out loud.
- Never invent experience, clients, numbers, guarantees or timelines not in my facts. If something is unknown, have me say I'll confirm it or ask a question instead.
- Prefer asking a sharp discovery question over pitching when the client's need is still unclear.
- Keep the contract and payment on Upwork; never suggest moving payment or communication off-platform.
- Be concise: this is read on screen mid-conversation.
- Always respond to the LEAD'S LATEST TURN first; earlier transcript is only context.
${languageRule(payload, "lead")}

Return ONLY a JSON object:
{
  "say": "what I say next",
  "points": ["up to 3 very short supporting points I can mention"],
  "ask": "one question to ask the lead next (or empty string)",
  "signal": "buying signal, concern or red flag you noticed, very short (or empty string)",
  "stage": "one of: rapport | discovery | pitch | objection | pricing | closing | next-steps"
}`;

  const user = `TASK: ${MODE_INSTRUCTIONS[payload.mode]}

CALL TRANSCRIPT SO FAR (from speech recognition, may contain errors):
${payload.transcript.trim() || "(no transcript yet)"}
${payload.trigger.trim() ? `\nLEAD'S LATEST TURN:\n${payload.trigger.trim()}\n` : ""}
Respond with the JSON object only.`;

  return { system, user };
}

function parseSuggestion(raw: string) {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    try {
      data = match ? JSON.parse(match[0]) : { say: raw };
    } catch {
      data = { say: raw };
    }
  }
  return {
    say: String(data.say || ""),
    points: Array.isArray(data.points) ? data.points.map(String).slice(0, 4) : [],
    ask: String(data.ask || ""),
    signal: String(data.signal || ""),
    stage: String(data.stage || ""),
  };
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const blocked = await interviewAiBlocked(authResult.auth.user);
    if (blocked) return blocked;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail("Invalid JSON payload", 400);
    }

    const payload = requestSchema.parse(body);
    const apiKey = process.env.GROQ_API_KEY || "";
    if (!apiKey) {
      return fail("GROQ_API_KEY is not configured", 500);
    }

    const model = payload.setup.model || MODELS[0];
    const isReasoningModel = model.startsWith("openai/");
    const { system, user } = buildPrompts(payload);

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
        max_tokens: isReasoningModel ? 1200 : 400,
        response_format: { type: "json_object" },
        ...(isReasoningModel ? { reasoning_effort: "low" } : {}),
      }),
    });

    if (groqRes.status === 429) {
      return fail("AI rate limit hit — wait a few seconds", 429);
    }
    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => "");
      return fail(`Groq AI request failed: ${errText.slice(0, 200)}`, 502);
    }

    const groqData = await groqRes.json();
    const rawContent = String(groqData?.choices?.[0]?.message?.content || "").trim();
    return ok("Suggestion ready", parseSuggestion(rawContent));
  } catch (error) {
    return handleApiError(error, "Call Copilot suggestion failed");
  }
}
