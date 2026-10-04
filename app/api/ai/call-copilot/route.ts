import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "src/lib/guards";
import { ok, fail, handleApiError } from "src/lib/api";

// Client Call Copilot (Google Meet, extension v3.2.0+).
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

const requestSchema = z.object({
  mode: z.enum(["auto", "answer", "objection", "pricing", "close", "recap"]).default("auto"),
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

function buildPrompts(payload: CopilotRequest) {
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
- The call may be in English, Hindi or Hinglish (Hindi written in Roman letters), and live captions garble words. Work out what they most likely meant. Reply in the same style the lead is using: Hinglish in Roman script if they speak Hinglish, otherwise English.

Return ONLY a JSON object:
{
  "say": "what I say next",
  "points": ["up to 3 very short supporting points I can mention"],
  "ask": "one question to ask the lead next (or empty string)",
  "signal": "buying signal, concern or red flag you noticed, very short (or empty string)",
  "stage": "one of: rapport | discovery | pitch | objection | pricing | closing | next-steps"
}`;

  const user = `TASK: ${MODE_INSTRUCTIONS[payload.mode]}

CALL TRANSCRIPT SO FAR (from live captions, may contain recognition errors):
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
