import { NextRequest } from "next/server";
import { requireAuth } from "src/lib/guards";
import { ok, fail, handleApiError } from "src/lib/api";
import { interviewAiBlocked } from "src/lib/plan-access";

// Speech-to-text for the Call Copilot page (/dashboard/interview) in "Auto-detect" mode.
// Whisper detects the spoken language itself, so English, Hindi, Hinglish and other
// languages work without picking one. Stateless: the audio is forwarded to Groq and discarded.

const MAX_BYTES = 8 * 1024 * 1024;
const MODEL = "whisper-large-v3-turbo";
const ROMANIZE_MODEL = "llama-3.1-8b-instant";
// Whisper copies the style of its prompt, so a Roman-script Hinglish sample keeps
// spoken Hindi in English letters ("kya tune khana khaya") instead of Devanagari.
const HINGLISH_PROMPT = "Haan, maine yeh project kiya tha. Kya tune khana khaya? Okay, let's discuss the next step.";
const DEVANAGARI = /[ऀ-ॿ]/;

// Fallback when Whisper still returns Devanagari: transliterate (not translate) to Roman Hinglish.
async function romanize(text: string, apiKey: string) {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        model: ROMANIZE_MODEL,
        temperature: 0,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content:
              "Transliterate the user's text into Hinglish: the same words written in casual Roman (English) letters, the way Indians type on WhatsApp (e.g. \"क्या तूने खाना खाया\" -> \"kya tune khana khaya\"). Do NOT translate. Keep English words as they are. Output only the transliterated text.",
          },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) return text;
    const data = await res.json();
    return String(data?.choices?.[0]?.message?.content || "").trim() || text;
  } catch {
    return text;
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const blocked = await interviewAiBlocked(authResult.auth.user);
    if (blocked) return blocked;

    const apiKey = process.env.GROQ_API_KEY || "";
    if (!apiKey) {
      return fail("GROQ_API_KEY is not configured", 500);
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return fail("Expected multipart form data", 400);
    }

    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) {
      return fail("Missing audio", 400);
    }
    if (audio.size > MAX_BYTES) {
      return fail("Audio clip too long", 413);
    }

    const upstream = new FormData();
    const type = audio.type || "audio/webm";
    const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm";
    upstream.append("file", audio, `clip.${ext}`);
    upstream.append("model", MODEL);
    upstream.append("response_format", "verbose_json");
    upstream.append("temperature", "0");
    const roman = form.get("script") !== "native";
    if (roman) upstream.append("prompt", HINGLISH_PROMPT);

    const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20000),
      body: upstream,
    });

    if (groqRes.status === 429) {
      return fail("AI rate limit hit — wait a few seconds", 429);
    }
    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => "");
      return fail(`Transcription failed: ${errText.slice(0, 200)}`, 502);
    }

    const data = await groqRes.json();
    // Whisper invents filler ("I'm not sure.", "Thank you.") on quiet or noisy clips.
    // Keep only segments it is confident contain real speech.
    const segments: { text?: string; no_speech_prob?: number; avg_logprob?: number; compression_ratio?: number }[] =
      Array.isArray(data?.segments) ? data.segments : [];
    const text = segments.length
      ? segments
          .filter(
            (s) =>
              (s.no_speech_prob ?? 0) < 0.5 &&
              (s.avg_logprob ?? 0) > -0.9 &&
              (s.compression_ratio ?? 1) < 2.4,
          )
          .map((s) => String(s.text || "").trim())
          .filter(Boolean)
          .join(" ")
      : String(data?.text || "").trim();
    return ok("Transcribed", {
      text: roman && DEVANAGARI.test(text) ? await romanize(text, apiKey) : text,
      language: String(data?.language || ""),
    });
  } catch (error) {
    return handleApiError(error, "Transcription failed");
  }
}
