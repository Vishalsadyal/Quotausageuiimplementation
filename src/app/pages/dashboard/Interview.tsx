import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Briefcase,
  Check,
  CircleDollarSign,
  Copy,
  Handshake,
  ListChecks,
  Loader2,
  MessageCircleQuestion,
  Mic,
  MicOff,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { hasInterviewAi } from "src/lib/plans";
import { LockedPreview } from "../../components/LockedPreview";

// Interview Call AI (formerly Call Copilot) runs entirely in this page: the browser's speech recognition
// listens through the microphone and /api/ai/call-copilot returns the answer.
// No extension, and nothing from the call is saved.

const PAUSE_MS = 1500; // the other person is considered "done talking" after this silence
const MIN_TURN_CHARS = 12;
const MAX_TRANSCRIPT_CHARS = 8000;
const MAX_ANSWERS_KEPT = 8;

// Auto-detect (Whisper) voice-activity settings.
const VAD_TICK_MS = 100;
const VAD_SILENCE_MS = 1100; // pause that ends a spoken phrase
const MIN_VOICED_MS = 600; // ignore coughs, clicks and background noise
const MAX_SEGMENT_MS = 25000;
const IDLE_SEGMENT_MS = 8000;
// Whisper sometimes "hears" these in near-silence, or echoes its own prompt.
const WHISPER_NOISE = /^(\W*|(thank you|thanks for watching|you|bye|okay)[.!]*|.*kya tune khana khaya.*)$/i;

type CallContext = "interview" | "client" | "meeting";
type Mode = "auto" | "answer" | "objection" | "pricing" | "close" | "recap";
type Tone = "consultative" | "confident" | "friendly";
type Model = "openai/gpt-oss-20b" | "openai/gpt-oss-120b";
type ReplyLanguage = "auto" | "english" | "hinglish" | "hindi";

type AutoDetectSession = {
  stream: MediaStream;
  audioCtx: AudioContext;
  recorder: { stop: (send: boolean) => void } | null;
  timer: number;
  queue: Promise<void>;
};

type Answer = {
  id: number;
  mode: Mode;
  trigger: string;
  say: string;
  points: string[];
  ask: string;
  signal: string;
  stage: string;
};

type TranscriptLine = { id: number; text: string };

// Minimal typing for the Web Speech API (not in every TS DOM lib).
type RecognitionResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const CONTEXTS: Record<
  CallContext,
  {
    label: string;
    icon: typeof Briefcase;
    other: string;
    theirRoleLabel: string;
    myRolePlaceholder: string;
    theirRolePlaceholder: string;
    goalLabel: string;
    goalPlaceholder: string;
    factsLabel: string;
    factsPlaceholder: string;
    modes: { mode: Mode; label: string; icon: typeof Sparkles }[];
  }
> = {
  interview: {
    label: "Job interview",
    icon: Briefcase,
    other: "interviewer",
    theirRoleLabel: "Interviewer / company",
    myRolePlaceholder: "e.g. Frontend developer, 3 years React",
    theirRolePlaceholder: "e.g. Tech lead at a fintech startup",
    goalLabel: "Role I'm interviewing for",
    goalPlaceholder: "e.g. Senior React Developer, Bangalore (paste key JD points)",
    factsLabel: "My background",
    factsPlaceholder:
      "Paste your resume summary: skills, projects, achievements with numbers, current CTC / expected CTC, notice period…",
    modes: [
      { mode: "answer", label: "Answer this", icon: MessageCircleQuestion },
      { mode: "objection", label: "Handle doubt", icon: ShieldCheck },
      { mode: "pricing", label: "Salary / notice", icon: CircleDollarSign },
      { mode: "close", label: "Closing + questions", icon: Handshake },
      { mode: "recap", label: "Recap", icon: ListChecks },
    ],
  },
  client: {
    label: "Client call",
    icon: Users,
    other: "client",
    theirRoleLabel: "The client",
    myRolePlaceholder: "e.g. Freelance full-stack developer (React / Node)",
    theirRolePlaceholder: "e.g. SaaS founder hiring for an MVP",
    goalLabel: "Goal of this call",
    goalPlaceholder: "e.g. Understand their needs, show fit, agree on a next step",
    factsLabel: "My offer & facts",
    factsPlaceholder: "Services, rate / pricing, relevant work & results, availability, what their job post asks for…",
    modes: [
      { mode: "answer", label: "Answer this", icon: MessageCircleQuestion },
      { mode: "objection", label: "Handle objection", icon: ShieldCheck },
      { mode: "pricing", label: "Talk price", icon: CircleDollarSign },
      { mode: "close", label: "Close the deal", icon: Handshake },
      { mode: "recap", label: "Recap", icon: ListChecks },
    ],
  },
  meeting: {
    label: "Team meeting",
    icon: Video,
    other: "speaker",
    theirRoleLabel: "Who's in the meeting",
    myRolePlaceholder: "e.g. Backend developer on the payments team",
    theirRolePlaceholder: "e.g. My manager, PM and 4 engineers",
    goalLabel: "Meeting topic / agenda",
    goalPlaceholder: "e.g. Sprint planning, weekly status, design review",
    factsLabel: "My notes",
    factsPlaceholder: "What you've done, what's next, numbers, blockers, deadlines, points you want to raise…",
    modes: [
      { mode: "answer", label: "Answer this", icon: MessageCircleQuestion },
      { mode: "pricing", label: "Give my update", icon: ListChecks },
      { mode: "objection", label: "Handle disagreement", icon: ShieldCheck },
      { mode: "close", label: "Action items", icon: Handshake },
      { mode: "recap", label: "Meeting notes", icon: Sparkles },
    ],
  },
};

// "auto" uses Whisper (any language, Hinglish, mixed). The rest use the browser's live captions.
const LANGUAGES = [
  { id: "auto", label: "Auto-detect (Hinglish, any language)" },
  { id: "en-IN", label: "English (India)" },
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "hi-IN", label: "Hindi" },
  { id: "bn-IN", label: "Bengali" },
  { id: "mr-IN", label: "Marathi" },
  { id: "gu-IN", label: "Gujarati" },
  { id: "pa-IN", label: "Punjabi" },
  { id: "ta-IN", label: "Tamil" },
  { id: "te-IN", label: "Telugu" },
  { id: "kn-IN", label: "Kannada" },
  { id: "ml-IN", label: "Malayalam" },
  { id: "ur-PK", label: "Urdu" },
  { id: "ar-AE", label: "Arabic" },
  { id: "es-ES", label: "Spanish" },
  { id: "fr-FR", label: "French" },
  { id: "de-DE", label: "German" },
];

const REPLY_LANGUAGES: { id: ReplyLanguage; label: string }[] = [
  { id: "auto", label: "Same as speaker" },
  { id: "english", label: "English" },
  { id: "hinglish", label: "Hinglish (Hindi in English letters)" },
  { id: "hindi", label: "Hindi (हिंदी script)" },
];

function micErrorMessage(name: string) {
  if (name === "NotAllowedError" || name === "not-allowed" || name === "service-not-allowed") {
    return "Microphone access is blocked. Allow it from the lock icon in the address bar, then try again.";
  }
  if (name === "NotFoundError" || name === "audio-capture") return "No microphone found. Connect one and try again.";
  return "Couldn't start the microphone. Refresh the page and try again.";
}

const TIPS = [
  "Use laptop speakers, not headphones, so the mic can hear the other person. Or call from your phone on speaker next to the laptop.",
  "Auto-detect understands English, Hindi, Hinglish and mixed speech. Pick a fixed language for faster live captions (Chrome / Edge).",
  "Fill in your background first. Answers only use the facts you give, so nothing is made up.",
  "Use Answer now if auto-answer misses a question, or type it in the box.",
];

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const disabled = !value.trim();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — nothing else to do
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      disabled={disabled}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

const inputClass =
  "w-full px-3 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 placeholder:text-gray-400";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

// Interview Call AI is part of Pro Connect (the APIs check it too: /api/ai/call-copilot, /api/ai/transcribe).
export default function Interview() {
  const { user } = useAuth();
  if (user?.role === "admin" || hasInterviewAi(user?.plan)) return <CallCopilot />;
  return (
    <LockedPreview
      title="A quick answer for every interview question, live"
      description="Keep this page open during your interview or client call. It listens and shows a short answer, from your own notes, as soon as the other person stops talking. Works with any call app, in English, Hindi or Hinglish. Included in Pro Connect with 20 HR contacts a day and everything in Pro."
    >
      <CallCopilot preview />
    </LockedPreview>
  );
}

// A made-up call shown blurred to people without Pro Connect, so the page looks like it does mid-interview.
const PREVIEW_LINES: TranscriptLine[] = [
  { id: 1, text: "Can you walk me through a project you're proud of?" },
  { id: 2, text: "And how did you handle the deadline pressure on that?" },
];
const PREVIEW_ANSWERS: Answer[] = [
  {
    id: 1,
    mode: "answer",
    trigger: PREVIEW_LINES[1].text,
    say: "I split the release into two phases, shipped the core checkout first, and kept everyone updated daily so there were no surprises.",
    points: ["Cut scope to what customers needed first", "Daily 10-minute check-ins with the PM", "Shipped on time, phase two a week later"],
    ask: "How does your team usually plan releases?",
    signal: "",
    stage: "",
  },
];

function CallCopilot({ preview = false }: { preview?: boolean }) {
  // Everything lives in component state only — nothing is saved.
  const [context, setContext] = useState<CallContext>("interview");
  const [myRole, setMyRole] = useState(preview ? "Frontend Developer" : "");
  const [theirRole, setTheirRole] = useState(preview ? "Engineering Manager" : "");
  const [goal, setGoal] = useState(preview ? "Get to the final round" : "");
  const [facts, setFacts] = useState("");
  const [tone, setTone] = useState<Tone>("confident");
  const [model, setModel] = useState<Model>("openai/gpt-oss-20b");
  const [lang, setLang] = useState("auto");
  const [replyLanguage, setReplyLanguage] = useState<ReplyLanguage>("auto");

  const [browserSpeech] = useState(() => Boolean(getRecognitionCtor()));
  const [autoDetectSupported] = useState(
    () => typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
  );
  const supported = lang === "auto" ? autoDetectSupported : browserSpeech;
  const [listening, setListening] = useState(false);
  const [hearing, setHearing] = useState(false); // auto-detect: voice currently detected
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [autoAnswer, setAutoAnswer] = useState(true);
  const [micError, setMicError] = useState("");
  const [fallbackToAuto, setFallbackToAuto] = useState(""); // reason, when browser captions fail
  const [lines, setLines] = useState<TranscriptLine[]>(preview ? PREVIEW_LINES : []);
  const [interim, setInterim] = useState("");
  const [answers, setAnswers] = useState<Answer[]>(preview ? PREVIEW_ANSWERS : []);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [typed, setTyped] = useState("");

  const recognitionRef = useRef<Recognition | null>(null);
  const autoRef = useRef<AutoDetectSession | null>(null);
  const wantListeningRef = useRef(false);
  const pendingTurnRef = useRef(""); // speech heard since the last answer
  const turnTimerRef = useRef<number | null>(null);
  const requestSeqRef = useRef(0);
  const lineSeqRef = useRef(0);
  const transcriptBoxRef = useRef<HTMLDivElement | null>(null);

  // Latest values for callbacks fired by the recognizer.
  const latest = useRef({ context, myRole, theirRole, goal, facts, tone, model, lines, autoAnswer, replyLanguage });
  latest.current = { context, myRole, theirRole, goal, facts, tone, model, lines, autoAnswer, replyLanguage };

  const ctx = CONTEXTS[context];

  const suggest = useCallback(async (mode: Mode, trigger: string) => {
    const s = latest.current;
    const transcript = s.lines.map((l) => l.text).join("\n").slice(-MAX_TRANSCRIPT_CHARS);
    const seq = ++requestSeqRef.current;
    setLoading(true);
    setApiError("");
    try {
      const res = await fetch("/api/ai/call-copilot", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: s.context,
          mode,
          replyLanguage: s.replyLanguage,
          trigger: trigger.slice(-1500),
          transcript,
          setup: {
            myRole: s.myRole.slice(0, 300),
            theirRole: s.theirRole.slice(0, 300),
            goal: s.goal.slice(0, 600),
            offer: s.facts.slice(0, 3000),
            tone: s.tone,
            model: s.model,
          },
        }),
      });
      const body = await res.json().catch(() => null);
      if (seq !== requestSeqRef.current) return; // a newer request replaced this one
      if (!res.ok || !body?.success || !body?.data) {
        const msg = body?.error?.message || body?.error || body?.message;
        setApiError(res.status === 401 ? "Your session expired. Sign in again." : String(msg || `Request failed (${res.status})`));
        return;
      }
      const d = body.data;
      setAnswers((prev) =>
        [
          {
            id: seq,
            mode,
            trigger,
            say: String(d.say || ""),
            points: Array.isArray(d.points) ? d.points.map(String) : [],
            ask: String(d.ask || ""),
            signal: String(d.signal || ""),
            stage: String(d.stage || ""),
          },
          ...prev,
        ].slice(0, MAX_ANSWERS_KEPT),
      );
    } catch {
      if (seq === requestSeqRef.current) setApiError("Couldn't reach the server. Check your connection.");
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  }, []);

  const flushTurn = useCallback(
    (mode: Mode, force: boolean) => {
      if (turnTimerRef.current) {
        window.clearTimeout(turnTimerRef.current);
        turnTimerRef.current = null;
      }
      const turn = pendingTurnRef.current.trim();
      if (!force && turn.length < MIN_TURN_CHARS) return;
      pendingTurnRef.current = "";
      void suggest(mode, turn);
    },
    [suggest],
  );

  const addHeard = useCallback((text: string) => {
    setLines((prev) => [...prev, { id: ++lineSeqRef.current, text }]);
    pendingTurnRef.current = `${pendingTurnRef.current} ${text}`.trim();
  }, []);

  // Browser speech recognition: one fixed language, live captions.
  const startBrowserListening = useCallback(
    (speechLang: string) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) return;
      const rec = new Ctor();
      rec.lang = speechLang;
      rec.continuous = true;
      rec.interimResults = true;

      let gotResult = false;
      let networkErrors = 0;
      // Chrome reports nothing visible when it can't hear the mic, so warn after a while.
      const watchdog = window.setTimeout(() => {
        if (!gotResult && recognitionRef.current === rec) {
          setMicError("Not hearing anything yet. Check the right mic is selected in Chrome, or switch to Auto-detect.");
        }
      }, 12000);

      rec.onresult = (e) => {
        if (!gotResult) {
          gotResult = true;
          setMicError("");
        }
        networkErrors = 0;
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          const text = result[0].transcript.trim();
          if (!text) continue;
          if (result.isFinal) addHeard(text);
          else interimText += `${text} `;
        }
        setInterim(interimText.trim());

        // Restart the silence timer on every bit of speech.
        if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current);
        turnTimerRef.current = window.setTimeout(() => {
          turnTimerRef.current = null;
          if (latest.current.autoAnswer) flushTurn("auto", false);
        }, PAUSE_MS);
      };

      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") {
          wantListeningRef.current = false;
          setMicError(micErrorMessage(e.error));
        } else if (e.error === "network") {
          // Chrome's live captions run on Google's servers; if they can't be reached, use Whisper instead.
          networkErrors++;
          if (networkErrors >= 2) {
            wantListeningRef.current = false;
            setFallbackToAuto("Chrome's live captions couldn't connect, so we switched to Auto-detect.");
          }
        } else if (e.error === "language-not-supported") {
          wantListeningRef.current = false;
          setFallbackToAuto("Chrome can't caption this language, so we switched to Auto-detect.");
        }
        // "no-speech" / "aborted": onend restarts below if still wanted.
      };

      rec.onend = () => {
        if (recognitionRef.current !== rec) return; // replaced by a newer recognizer
        setInterim("");
        // Chrome stops recognition after silence or ~60s, so keep it going.
        if (wantListeningRef.current) {
          try {
            rec.start();
            return;
          } catch {
            // fall through and stop
          }
        }
        window.clearTimeout(watchdog);
        wantListeningRef.current = false;
        recognitionRef.current = null;
        setListening(false);
      };

      recognitionRef.current = rec;
      wantListeningRef.current = true;
      try {
        rec.start();
        setListening(true);
      } catch {
        wantListeningRef.current = false;
        setMicError(micErrorMessage(""));
      }
    },
    [addHeard, flushTurn],
  );

  // Auto-detect: record each spoken phrase and let Whisper work out the language.
  const startAutoListening = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        // Echo cancellation would erase the other person's voice coming out of the speakers.
        audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true },
      });
    } catch (error) {
      setMicError(micErrorMessage((error as { name?: string })?.name || ""));
      return;
    }

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));

    const session: AutoDetectSession = { stream, audioCtx, recorder: null, timer: 0, queue: Promise.resolve() };
    let speaking = false;
    let voicedMs = 0;
    let lastVoiceAt = 0;
    let segmentStart = Date.now();
    let noiseFloor = 0.01;

    const transcribe = (blob: Blob) => {
      // Keep transcripts in the order they were spoken.
      session.queue = session.queue.then(async () => {
        try {
          const form = new FormData();
          form.append("audio", blob, "clip");
          // Hindi speech is shown in English letters unless the user picked Hindi script.
          form.append("script", latest.current.replyLanguage === "hindi" ? "native" : "roman");
          const res = await fetch("/api/ai/transcribe", { method: "POST", credentials: "include", body: form });
          const body = await res.json().catch(() => null);
          if (!res.ok || !body?.success) {
            if (res.status === 401) setApiError("Your session expired. Sign in again.");
            else if (res.status === 429) setApiError("Too many requests. Wait a few seconds.");
            return;
          }
          const text = String(body.data?.text || "").trim();
          if (!text || WHISPER_NOISE.test(text) || text.replace(/\W/g, "").length < 3) return;
          const prev = latest.current.lines[latest.current.lines.length - 1]?.text || "";
          if (prev.toLowerCase() === text.toLowerCase()) return; // repeated hallucination
          if (body.data?.language) setDetectedLanguage(String(body.data.language));
          addHeard(text);
          if (latest.current.autoAnswer && !speaking) flushTurn("auto", false);
        } catch {
          // network blip — drop this clip
        }
      });
    };

    const startSegment = () => {
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      let keep = false;
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        if (keep && chunks.length) transcribe(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      };
      recorder.start();
      segmentStart = Date.now();
      session.recorder = {
        stop: (send: boolean) => {
          keep = send;
          if (recorder.state !== "inactive") recorder.stop();
        },
      };
    };

    const cutSegment = (send: boolean) => {
      session.recorder?.stop(send);
      speaking = false;
      voicedMs = 0;
      setHearing(false);
      if (wantListeningRef.current) startSegment();
    };

    session.timer = window.setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
      const rms = Math.sqrt(sum / samples.length);
      const now = Date.now();
      const voiced = rms > Math.max(0.015, noiseFloor * 3);
      if (!voiced) noiseFloor = noiseFloor * 0.95 + rms * 0.05;

      if (voiced) {
        if (!speaking) {
          speaking = true;
          setHearing(true);
        }
        voicedMs += VAD_TICK_MS;
        lastVoiceAt = now;
      }
      if (speaking && now - lastVoiceAt > VAD_SILENCE_MS) {
        cutSegment(voicedMs >= MIN_VOICED_MS);
      } else if (speaking && now - segmentStart > MAX_SEGMENT_MS) {
        cutSegment(true);
      } else if (!speaking && now - segmentStart > IDLE_SEGMENT_MS) {
        cutSegment(false); // drop silence so clips stay short
      }
    }, VAD_TICK_MS);

    autoRef.current = session;
    wantListeningRef.current = true;
    startSegment();
    setListening(true);
  }, [addHeard, flushTurn]);

  const stopAutoListening = useCallback((sendLast: boolean) => {
    const session = autoRef.current;
    if (!session) return;
    autoRef.current = null;
    window.clearInterval(session.timer);
    session.recorder?.stop(sendLast);
    session.stream.getTracks().forEach((t) => t.stop());
    void session.audioCtx.close().catch(() => undefined);
    setHearing(false);
  }, []);

  const startListening = useCallback(
    (speechLang: string) => {
      setMicError("");
      if (speechLang === "auto") void startAutoListening();
      else startBrowserListening(speechLang);
    },
    [startAutoListening, startBrowserListening],
  );

  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    recognitionRef.current?.stop();
    stopAutoListening(true);
    setListening(false);
    if (turnTimerRef.current) {
      window.clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
  }, [stopAutoListening]);

  // Stop the mic when leaving the page.
  useEffect(
    () => () => {
      wantListeningRef.current = false;
      recognitionRef.current?.abort();
      stopAutoListening(false);
      if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current);
    },
    [stopAutoListening],
  );

  useEffect(() => {
    if (!fallbackToAuto) return;
    const reason = fallbackToAuto;
    setFallbackToAuto("");
    setLang("auto");
    const old = recognitionRef.current;
    recognitionRef.current = null; // its onend now ignores itself
    old?.abort();
    startListening("auto");
    setMicError(reason);
  }, [fallbackToAuto, startListening]);

  useEffect(() => {
    const box = transcriptBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [lines, interim]);

  const changeLanguage = (value: string) => {
    setLang(value);
    setDetectedLanguage("");
    if (listening) {
      // Restart with the new language.
      wantListeningRef.current = false;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      stopAutoListening(false);
      setListening(false);
      window.setTimeout(() => startListening(value), 300);
    }
  };

  const submitTyped = () => {
    const q = typed.trim();
    if (!q) return;
    setLines((prev) => [...prev, { id: ++lineSeqRef.current, text: q }]);
    setTyped("");
    pendingTurnRef.current = "";
    void suggest("answer", q);
  };

  const clearSession = () => {
    stopListening();
    requestSeqRef.current++;
    pendingTurnRef.current = "";
    setLines([]);
    setInterim("");
    setDetectedLanguage("");
    setAnswers([]);
    setLoading(false);
    setApiError("");
  };

  const latestAnswer = answers[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight flex items-center gap-2">
            <span>Interview Call AI</span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 tracking-wider">
              LIVE
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5 max-w-xl">
            Keep this page open during your call. It listens and shows a quick answer when the {ctx.other} stops
            talking. Works with any call app and needs no extension.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
          {(Object.keys(CONTEXTS) as CallContext[]).map((key) => {
            const { icon: Icon, label } = CONTEXTS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setContext(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  context === key ? "bg-purple-600 text-white" : "text-gray-600 hover:text-purple-700"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {!supported ? (
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-900">
          <span className="font-semibold">This browser can't listen in this language mode.</span>{" "}
          <span className="text-amber-800/80">
            {lang === "auto" ? "Use a recent Chrome, Edge or Safari." : "Pick Auto-detect, or open this page in Chrome or Edge."} You can still
            type questions below.
          </span>
        </div>
      ) : null}

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Quick answer */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200/80 shadow-xs rounded-xl p-5 min-h-[18rem]">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Quick answer
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" /> : null}
            </h2>
            {apiError ? <p className="mb-2 text-[11px] text-red-600">{apiError}</p> : null}
            {!latestAnswer ? (
              <p className="text-[11px] text-gray-400">
                {loading ? "Thinking…" : `Start listening. An answer appears when the ${ctx.other} stops talking.`}
              </p>
            ) : (
              <div className="space-y-3">
                <AnswerCard answer={latestAnswer} primary />
                {answers.slice(1).map((a) => (
                  <AnswerCard key={a.id} answer={a} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live listening panel */}
        <div>
          <div className="bg-white border border-gray-200/80 shadow-xs rounded-xl p-4 lg:sticky lg:top-4">
            <div className="flex flex-wrap items-center gap-2">
              {listening ? (
                <button
                  type="button"
                  onClick={stopListening}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
                >
                  <MicOff className="w-4 h-4" />
                  Stop listening
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startListening(lang)}
                  disabled={!supported}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Mic className="w-4 h-4" />
                  Start listening
                </button>
              )}
              <button
                type="button"
                onClick={() => flushTurn("auto", true)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold transition-colors disabled:opacity-40"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                Answer now
              </button>
              <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 ml-1">
                <input
                  type="checkbox"
                  checked={autoAnswer}
                  onChange={(e) => setAutoAnswer(e.target.checked)}
                  className="accent-purple-600"
                />
                Auto-answer
              </label>
              <select
                value={lang}
                onChange={(e) => changeLanguage(e.target.value)}
                className="ml-auto px-2 py-1.5 text-[11px] border border-gray-200 rounded-lg bg-white text-gray-700"
                aria-label="Speech language"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={clearSession}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-800"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>

            {listening ? (
              <div className="mt-2 flex items-center gap-2 text-[11px] text-emerald-700">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
                </span>
                {lang === "auto" ? (hearing ? "Hearing speech…" : "Listening… (auto-detect)") : "Listening…"}
                {detectedLanguage ? (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 capitalize">{detectedLanguage}</span>
                ) : null}
              </div>
            ) : null}
            {micError ? <p className="mt-2 text-[11px] text-red-600">{micError}</p> : null}

            {/* Transcript */}
            <div ref={transcriptBoxRef} className="mt-3 h-56 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/60 p-3 text-[11px] leading-relaxed text-gray-700">
              {lines.length === 0 && !interim ? (
                <span className="text-gray-400">What the mic hears shows up here.</span>
              ) : (
                <>
                  {lines.map((l) => (
                    <p key={l.id}>{l.text}</p>
                  ))}
                  {interim ? <p className="text-gray-400 italic">{interim}</p> : null}
                </>
              )}
            </div>

            {/* Type a question */}
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submitTyped();
              }}
            >
              <input
                className={inputClass}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={`Or type the ${ctx.other}'s question…`}
              />
              <button
                type="submit"
                disabled={!typed.trim() || loading}
                className="inline-flex items-center gap-1 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {ctx.modes.map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => flushTurn(mode, true)}
                  disabled={loading}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-gray-200 bg-white text-gray-600 hover:border-purple-300 hover:text-purple-700 disabled:opacity-40 transition-colors"
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Prep */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200/80 shadow-xs rounded-xl p-4">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <ListChecks className="w-4 h-4 text-purple-600" />
              Before the call
            </h2>
            <div className="mt-3 grid md:grid-cols-2 gap-3">
              <Field label="Me">
                <input className={inputClass} value={myRole} onChange={(e) => setMyRole(e.target.value)} placeholder={ctx.myRolePlaceholder} />
              </Field>
              <Field label={ctx.theirRoleLabel}>
                <input
                  className={inputClass}
                  value={theirRole}
                  onChange={(e) => setTheirRole(e.target.value)}
                  placeholder={ctx.theirRolePlaceholder}
                />
              </Field>
              <Field label={ctx.goalLabel}>
                <textarea className={`${inputClass} resize-y`} rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={ctx.goalPlaceholder} />
              </Field>
              <Field label={ctx.factsLabel}>
                <textarea className={`${inputClass} resize-y`} rows={5} value={facts} onChange={(e) => setFacts(e.target.value)} placeholder={ctx.factsPlaceholder} />
              </Field>
              <Field label="Answer in">
                <select className={inputClass} value={replyLanguage} onChange={(e) => setReplyLanguage(e.target.value as ReplyLanguage)}>
                  {REPLY_LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Tone">
                  <select className={inputClass} value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
                    <option value="confident">Confident</option>
                    <option value="consultative">Calm</option>
                    <option value="friendly">Friendly</option>
                  </select>
                </Field>
                <Field label="AI">
                  <select className={inputClass} value={model} onChange={(e) => setModel(e.target.value as Model)}>
                    <option value="openai/gpt-oss-20b">Fast</option>
                    <option value="openai/gpt-oss-120b">Smarter</option>
                  </select>
                </Field>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white border border-gray-200/80 shadow-xs rounded-xl p-4">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-purple-600" />
              Tips
            </h2>
            <ul className="space-y-1.5 text-[11px] text-gray-600 leading-relaxed list-disc pl-4">
              {TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4">
            <h2 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Private by design
            </h2>
            <ul className="space-y-1.5 text-[11px] text-emerald-900/80 leading-relaxed list-disc pl-4">
              <li>The transcript and your notes stay on this page and are gone when you leave or press Clear.</li>
              <li>Each answer request is processed and discarded. Calls are never saved to your account.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnswerCard({ answer, primary = false }: { answer: Answer; primary?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${primary ? "border-purple-200 bg-purple-50/40" : "border-gray-100 bg-gray-50/40 opacity-80"}`}>
      {answer.trigger ? <p className="text-[10px] text-gray-400 mb-1 line-clamp-2">“{answer.trigger}”</p> : null}
      <div className="flex items-start justify-between gap-2">
        <p className={`${primary ? "text-sm font-semibold" : "text-xs"} text-gray-900 leading-relaxed`}>{answer.say}</p>
        <CopyButton value={answer.say} />
      </div>
      {answer.points.length ? (
        <ul className="mt-2 space-y-0.5">
          {answer.points.map((p) => (
            <li key={p} className="flex gap-1.5 text-[11px] text-gray-700">
              <Check className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
              {p}
            </li>
          ))}
        </ul>
      ) : null}
      {answer.ask ? (
        <p className="mt-2 text-[11px] text-purple-800">
          <span className="font-semibold">Ask: </span>
          {answer.ask}
        </p>
      ) : null}
      {answer.signal ? (
        <p className="mt-1 text-[11px] text-amber-800">
          <span className="font-semibold">Note: </span>
          {answer.signal}
        </p>
      ) : null}
    </div>
  );
}
