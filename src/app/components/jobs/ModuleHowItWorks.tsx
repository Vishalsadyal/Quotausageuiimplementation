import { createContext, useContext, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Bot,
  CheckCheck,
  CheckCircle2,
  FileText,
  Mail,
  MessageCircle,
  MessageSquare,
  Mic,
  MousePointer2,
  Paperclip,
  Phone,
  Sparkles,
  ThumbsUp,
} from "lucide-react";

// A looping mini screen on each tool card in place of the description: the tool at work on a small
// mock of the real site (fields typing, chat bubbles, a cursor clicking), like a GIF but sharp and light.
// Each scene is a list of phases; the scene remounts every loop so typing and entrances replay.

type SceneProps = { phase: number };
type Scene = { site: string; dot: string; durations: number[]; Scene: ComponentType<SceneProps> };

// With reduced motion every scene sits on its last phase and text shows in full.
const InstantContext = createContext(false);

function Typed({ text, on, speed = 45 }: { text: string; on: boolean; speed?: number }) {
  const instant = useContext(InstantContext);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!on || instant) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [on, instant, text, speed]);
  if (!on) return null;
  if (instant) return <>{text}</>;
  return (
    <>
      {text.slice(0, count)}
      {count < text.length && <span className="ml-px inline-block h-[1em] w-px animate-pulse bg-current align-middle" />}
    </>
  );
}

function Cursor({ x, y, click = false, hidden = false }: { x: string; y: string; click?: boolean; hidden?: boolean }) {
  return (
    <motion.div
      className="pointer-events-none absolute z-20"
      initial={false}
      animate={{ left: x, top: y, opacity: hidden ? 0 : 1, scale: click ? 0.82 : 1 }}
      transition={{ duration: 0.55, ease: "easeInOut" }}
    >
      {click && (
        <motion.span
          className="absolute -left-1.5 -top-1.5 h-5 w-5 rounded-full bg-gray-900/25"
          initial={{ scale: 0.3, opacity: 0.8 }}
          animate={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        />
      )}
      <MousePointer2 className="h-3.5 w-3.5 fill-gray-900 text-white drop-shadow" />
    </motion.div>
  );
}

function Field({ label, value, on }: { label: string; value: string; on: boolean }) {
  return (
    <div className="mt-1">
      <div className="text-[8.5px] text-gray-500">{label}</div>
      <div className={`h-3.5 rounded border px-1 leading-[13px] text-gray-900 transition-colors ${on ? "border-blue-300 bg-blue-50/50" : "border-gray-200"}`}>
        <Typed text={value} on={on} />
      </div>
    </div>
  );
}

function Success({ text, sub }: { text: string; sub?: string }) {
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex h-full flex-col items-center justify-center gap-0.5 text-center"
    >
      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
      <div className="font-bold text-gray-900">{text}</div>
      {sub && <div className="text-[8.5px] text-gray-500">{sub}</div>}
    </motion.div>
  );
}

function Pill({ pressed, className, children }: { pressed: boolean; className: string; children: ReactNode }) {
  return (
    <motion.span
      animate={{ scale: pressed ? 0.88 : 1 }}
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold text-white ${className} ${pressed ? "brightness-75" : ""}`}
    >
      {children}
    </motion.span>
  );
}

// A LinkedIn post with a contact detail the tool picks out (scan line, then highlight).
function HiringPost({ phase, before, contact, after = "" }: { phase: number; before: string; contact: string; after?: string }) {
  return (
    <div className="relative w-1/2 overflow-hidden rounded-md border border-gray-200 bg-white p-1.5">
      <div className="flex items-center gap-1">
        <span className="h-3.5 w-3.5 rounded-full bg-gradient-to-br from-gray-300 to-gray-400" />
        <div className="leading-tight">
          <div className="font-semibold text-gray-800">Talent Lead · Acme</div>
          <div className="text-[8px] text-gray-400">2h · #hiring</div>
        </div>
      </div>
      <p className="mt-1 leading-snug text-gray-700">
        {before}{" "}
        <span className={`transition-all ${phase >= 1 ? "rounded bg-emerald-100 px-0.5 font-bold text-emerald-700 ring-1 ring-emerald-300" : "font-semibold"}`}>
          {contact}
        </span>
        {after}
      </p>
      {phase === 0 && (
        <div className="demo-scan absolute inset-x-0 h-5 bg-gradient-to-b from-transparent via-emerald-300/40 to-transparent" />
      )}
    </div>
  );
}

function FlyingChip({ show, text, className }: { show: boolean; text: string; className: string }) {
  if (!show) return null;
  return (
    <motion.div
      className={`absolute z-10 rounded px-1 text-[8.5px] font-bold text-white shadow ${className}`}
      initial={{ left: "12%", top: "62%", opacity: 0 }}
      animate={{ left: "60%", top: "8%", opacity: [0, 1, 1, 0] }}
      transition={{ duration: 0.75 }}
    >
      {text}
    </motion.div>
  );
}

// ── LinkedIn: pick a job → Easy Apply → answers type in → Submit → Applied ──
function LinkedInScene({ phase }: SceneProps) {
  const cursor = [
    { x: "47%", y: "60%" },
    { x: "72%", y: "42%" },
    { x: "74%", y: "66%" },
    { x: "88%", y: "80%" },
    { x: "88%", y: "80%" },
  ][phase];
  return (
    <div className="absolute inset-0 flex gap-1.5 p-1.5">
      <div className="w-[38%] space-y-1">
        {["Frontend Dev", "React Engineer", "UI Developer"].map((title, i) => (
          <div key={title} className={`rounded-md border bg-white px-1.5 py-1 ${i === 0 ? "border-blue-400 ring-1 ring-blue-100" : "border-gray-200"}`}>
            <div className="flex items-center gap-1">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${["bg-blue-500", "bg-orange-400", "bg-teal-500"][i]}`} />
              <span className="truncate font-semibold text-gray-800">{title}</span>
            </div>
            <div className="mt-0.5 flex h-2.5 items-center gap-1">
              <span className="h-1 w-8 rounded bg-gray-200" />
              {i === 0 && phase === 4 && (
                <motion.span initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="ml-auto rounded bg-emerald-100 px-1 text-[8px] font-bold text-emerald-700">
                  Applied
                </motion.span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="relative flex-1 rounded-md border border-gray-200 bg-white p-1.5">
        <div className="font-bold text-gray-900">Frontend Dev · Acme</div>
        <div className="mt-1 space-y-1">
          <div className="h-1 w-full rounded bg-gray-100" />
          <div className="h-1 w-4/5 rounded bg-gray-100" />
          <div className="h-1 w-3/5 rounded bg-gray-100" />
        </div>
        <div className="mt-2">
          <Pill pressed={false} className="bg-blue-600">Easy Apply</Pill>
        </div>
        <AnimatePresence>
          {phase >= 1 && (
            <motion.div
              key="modal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-1 rounded-md border border-gray-200 bg-white p-1.5 shadow-md"
            >
              {phase < 4 ? (
                <>
                  <div className="font-bold text-gray-900">Apply to Acme</div>
                  <Field label="Years of React experience?" value="5" on={phase >= 1} />
                  <Field label="Notice period?" value="Immediate" on={phase >= 2} />
                  <div className="mt-1.5 flex justify-end">
                    <Pill pressed={phase === 3} className="bg-blue-600">Submit</Pill>
                  </div>
                </>
              ) : (
                <Success text="Application sent" sub="Moving to the next job…" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Cursor x={cursor.x} y={cursor.y} click={phase === 0 || phase === 3} hidden={phase === 4} />
    </div>
  );
}

// ── Naukri: the recruiter chatbot asks, your saved answers type back, then Applied ──
const NAUKRI_CHAT = [
  { from: "bot", text: "What is your notice period?" },
  { from: "me", text: "30 days" },
  { from: "bot", text: "Expected CTC (in LPA)?" },
  { from: "me", text: "12" },
] as const;

function NaukriScene({ phase }: SceneProps) {
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex items-center gap-1 border-b border-gray-200 bg-white px-1.5 py-1">
        <Bot className="h-3 w-3 text-cyan-600" />
        <span className="font-semibold text-gray-800">Recruiter chatbot</span>
        <span className="ml-auto text-[8.5px] text-gray-400">Acme Corp</span>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-1 overflow-hidden px-1.5 py-1">
        {NAUKRI_CHAT.slice(0, Math.min(phase + 1, NAUKRI_CHAT.length)).map((bubble) => (
          <motion.div
            key={bubble.text}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={
              bubble.from === "bot"
                ? "self-start rounded-lg rounded-bl-sm border border-gray-200 bg-white px-1.5 py-0.5 text-gray-800"
                : "self-end rounded-lg rounded-br-sm bg-cyan-600 px-1.5 py-0.5 font-semibold text-white"
            }
          >
            {bubble.from === "me" ? <Typed text={bubble.text} on speed={90} /> : bubble.text}
          </motion.div>
        ))}
        {phase === 4 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-1 self-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700"
          >
            <CheckCircle2 className="h-3 w-3" /> Applied · 13/50 today
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Indeed: three-step Indeed Apply form filled and submitted ──
function IndeedScene({ phase }: SceneProps) {
  const screen = phase === 4 ? "done" : phase >= 2 ? "review" : `step${phase}`;
  return (
    <div className="absolute inset-0 p-1.5">
      <div className="relative flex h-full flex-col rounded-md border border-gray-200 bg-white p-1.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-gray-900">Indeed Apply</span>
          <span className="text-[8.5px] text-gray-400">Step {Math.min(phase + 1, 3)} of 3</span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded bg-gray-100">
          <motion.div className="h-full bg-indigo-500" initial={false} animate={{ width: `${[33, 66, 100, 100, 100][phase]}%` }} />
        </div>
        <div className="relative mt-0.5 flex-1">
          <AnimatePresence mode="wait">
            <motion.div key={screen} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="h-full">
              {screen === "step0" && (
                <>
                  <Field label="Phone" value="+91 98xxx xx210" on />
                  <Field label="City" value="Bengaluru" on />
                </>
              )}
              {screen === "step1" && (
                <>
                  <Field label="Years of Java experience?" value="4" on />
                  <Field label="Willing to relocate?" value="Yes" on />
                </>
              )}
              {screen === "review" && (
                <div className="pt-1">
                  <div className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-gray-700">
                    <FileText className="h-3 w-3 text-indigo-500" /> Resume.pdf
                  </div>
                  <div className="mt-1 text-[8.5px] text-gray-500">5 screening answers filled</div>
                  <div className="mt-1.5 flex justify-end">
                    <Pill pressed={phase === 3} className="bg-indigo-600">Submit application</Pill>
                  </div>
                </div>
              )}
              {screen === "done" && <Success text="Application submitted" sub="Logged in your dashboard" />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <Cursor x="80%" y="74%" click={phase === 3} hidden={phase < 2 || phase === 4} />
    </div>
  );
}

// ── WhatsApp: number spotted in a hiring post → chat opens → intro sent, ticks turn blue ──
function WhatsAppScene({ phase }: SceneProps) {
  return (
    <div className="absolute inset-0 flex gap-1.5 p-1.5">
      <HiringPost phase={phase} before="We're hiring React devs! Send your CV on WhatsApp" contact="98xxx xx210" />
      <div className="flex w-1/2 flex-col overflow-hidden rounded-md border border-gray-200 bg-[#efeae2]">
        <div className="flex items-center gap-1 bg-emerald-700 px-1.5 py-1 text-white">
          <Phone className="h-2.5 w-2.5" />
          <span className="truncate font-semibold">{phase >= 2 ? "+91 98xxx xx210" : "WhatsApp Web"}</span>
        </div>
        <div className="flex flex-1 flex-col justify-end p-1">
          {phase >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-[96%] self-end rounded-md rounded-tr-sm bg-[#d9fdd3] px-1.5 py-1 leading-snug text-gray-800 shadow-2xs"
            >
              <Typed text="Hi! Saw your React opening. 4 yrs exp, sharing my CV." on speed={26} />
              <CheckCheck className={`ml-1 inline h-3 w-3 align-bottom transition-colors ${phase >= 3 ? "text-sky-500" : "text-gray-400"}`} />
            </motion.div>
          )}
          {phase >= 3 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-0.5 self-center text-[8px] text-gray-600">
              Sent once · never twice
            </motion.div>
          )}
        </div>
      </div>
      <FlyingChip show={phase === 1} text="98xxx xx210" className="bg-emerald-600" />
    </div>
  );
}

// ── Email: address spotted → Gmail draft with resume → Send → Sent ──
function EmailScene({ phase }: SceneProps) {
  return (
    <div className="absolute inset-0 flex gap-1.5 p-1.5">
      <HiringPost phase={phase} before="Hiring a Data Analyst. Mail your CV to" contact="hr@acme.com" />
      <div className="relative flex w-1/2 flex-col overflow-hidden rounded-md border border-gray-200 bg-white">
        <div className="bg-gray-800 px-1.5 py-1 font-semibold text-white">New message</div>
        <div className="space-y-0.5 px-1.5 py-1 text-gray-800">
          <div className="truncate border-b border-gray-100 pb-0.5">
            <span className="text-gray-400">To </span>
            <Typed text="hr@acme.com" on={phase >= 2} speed={55} />
          </div>
          <div className="truncate border-b border-gray-100 pb-0.5">
            <span className="text-gray-400">Subject </span>
            <Typed text="Data Analyst application" on={phase >= 3} speed={30} />
          </div>
          {phase >= 3 && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-0.5 rounded border border-gray-200 bg-gray-50 px-1 text-[8.5px]">
              <Paperclip className="h-2.5 w-2.5 text-sky-600" /> Resume.pdf
            </motion.div>
          )}
        </div>
        <div className="mt-auto px-1.5 pb-1">
          <Pill pressed={phase === 4} className="bg-sky-600">Send</Pill>
        </div>
        <AnimatePresence>
          {phase === 5 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-white">
              <Success text="Message sent" sub="With your resume attached" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <FlyingChip show={phase === 1} text="hr@acme.com" className="bg-sky-600" />
      <Cursor x="56%" y="80%" click={phase === 4} hidden={phase < 3 || phase === 5} />
    </div>
  );
}

// ── HR contacts: today's recruiters slide in, matched to your roles ──
const HR_ROWS = [
  { initials: "NK", name: "Neha K.", role: "TA Lead · Fintech", match: "React" },
  { initials: "RM", name: "Rahul M.", role: "HR · SaaS", match: "Frontend" },
  { initials: "AS", name: "Ananya S.", role: "Recruiter · E-com", match: "UI" },
  { initials: "VT", name: "Vikram T.", role: "Hiring Mgr · Edtech", match: "React" },
];

function HrContactsScene({ phase }: SceneProps) {
  const shown = Math.min(phase + 1, HR_ROWS.length);
  return (
    <div className="absolute inset-0 flex flex-col p-1.5">
      <div className="flex items-center justify-between pb-1">
        <span className="font-bold text-gray-900">Today's recruiters</span>
        <span className="rounded-full bg-purple-100 px-1.5 font-bold text-purple-700">{16 + shown}/20</span>
      </div>
      <div className="space-y-1">
        {HR_ROWS.slice(0, shown).map((row, i) => (
          <motion.div
            key={row.name}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-1.5 py-0.5"
          >
            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-purple-600 text-[7px] font-bold text-white">{row.initials}</span>
            <span className="truncate font-semibold text-gray-800">{row.name}</span>
            <span className="truncate text-[8.5px] text-gray-400">{row.role}</span>
            <span className="ml-auto shrink-0 rounded bg-emerald-50 px-1 text-[8px] font-bold text-emerald-700">{row.match}</span>
            <motion.span animate={phase === 4 && i === 0 ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: 0.6, repeat: phase === 4 && i === 0 ? 2 : 0 }}>
              <MessageCircle className="h-3 w-3 shrink-0 text-emerald-600" />
            </motion.span>
            <Mail className="h-3 w-3 shrink-0 text-sky-600" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Commenter: AI writes a comment on a hiring post and posts it ──
function CommenterScene({ phase }: SceneProps) {
  const comment = "Love this! I've built 3 design systems. Portfolio: yoursite.com";
  return (
    <div className="absolute inset-0 p-1.5">
      <div className="flex h-full flex-col rounded-md border border-gray-200 bg-white p-1.5">
        <div className="flex items-center gap-1">
          <span className="h-3.5 w-3.5 rounded-full bg-gradient-to-br from-amber-300 to-orange-400" />
          <span className="font-semibold text-gray-800">Design Head · Acme</span>
          <span className="ml-auto text-[8px] text-gray-400">1h</span>
        </div>
        <p className="mt-0.5 text-gray-700">We're hiring Product Designers. Show us your work!</p>
        <div className="mt-0.5 flex gap-2 border-b border-gray-100 pb-0.5 text-[8.5px] text-gray-400">
          <span className="inline-flex items-center gap-0.5"><ThumbsUp className="h-2.5 w-2.5" /> 48</span>
          <span className="inline-flex items-center gap-0.5"><MessageSquare className="h-2.5 w-2.5" /> {phase === 3 ? 13 : 12}</span>
        </div>
        <div className="mt-1 flex-1">
          {phase < 3 ? (
            phase >= 1 && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-1 rounded-md border border-amber-300 bg-amber-50/40 px-1 py-0.5">
                <Sparkles className="mb-0.5 h-2.5 w-2.5 shrink-0 text-amber-500" />
                <span className="flex-1 leading-snug text-gray-800"><Typed text={comment} on speed={26} /></span>
                <Pill pressed={phase === 2} className="bg-amber-600">Post</Pill>
              </motion.div>
            )
          ) : (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex gap-1">
              <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-purple-500" />
              <div className="rounded-md bg-gray-100 px-1.5 py-0.5 leading-snug text-gray-800">
                <span className="font-semibold">You</span> · <span className="text-[8px] text-gray-400">just now</span>
                <div>
                  Love this! I've built 3 design systems. Portfolio: <span className="font-semibold text-blue-600">yoursite.com</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
      <Cursor x="88%" y="78%" click={phase === 2} hidden={phase !== 1 && phase !== 2} />
    </div>
  );
}

// ── Interview: listens to the question, then shows what to say ──
const WAVE = [5, 9, 14, 7, 12, 16, 8, 13, 6, 11, 15, 7, 10, 5];
const ANSWER = ["Checkout charged some users twice", "Traced it to retries, added idempotency keys", "Double charges dropped to zero"];

function InterviewScene({ phase }: SceneProps) {
  const listening = phase === 0;
  return (
    <div className="absolute inset-0 flex flex-col gap-1 p-1.5">
      <div className="rounded-md border border-gray-200 bg-white px-1.5 py-1">
        <div className="flex items-center gap-1">
          <span className="relative flex h-3 w-3 items-center justify-center">
            {listening && <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/60" />}
            <Mic className="relative h-2.5 w-2.5 text-rose-600" />
          </span>
          <span className="font-semibold text-gray-800">{listening ? "Listening…" : "Question heard"}</span>
          <div className="ml-auto flex h-4 items-center gap-[2px]">
            {WAVE.map((h, i) => (
              <span
                key={i}
                className={`demo-wave w-[2px] rounded-full bg-rose-400 ${listening ? "is-live" : ""}`}
                style={{ ["--peak" as string]: h / 16, animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        </div>
        <div className="mt-0.5 truncate text-gray-700">
          <span className="text-gray-400">Interviewer: </span>
          <Typed text="Tell me about a tough bug you fixed." on speed={40} />
        </div>
      </div>
      <div className="flex-1 rounded-md border border-purple-200 bg-purple-50/60 px-1.5 py-1">
        {phase === 1 ? (
          <div className="flex h-full items-center justify-center gap-1 text-purple-700">
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <Sparkles className="h-3 w-3" />
            </motion.span>
            Drafting your answer…
          </div>
        ) : phase >= 2 ? (
          <>
            <div className="text-[8.5px] font-bold uppercase tracking-wide text-purple-700">Say this</div>
            {ANSWER.map((line, i) => (
              <motion.div key={line} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.4 }} className="truncate text-gray-800">
                • {line}
              </motion.div>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}

const SCENES: Record<string, Scene> = {
  linkedin: { site: "linkedin.com/jobs", dot: "bg-blue-500", durations: [1100, 1400, 1300, 750, 1800], Scene: LinkedInScene },
  naukri: { site: "naukri.com", dot: "bg-cyan-500", durations: [900, 1000, 900, 1000, 1800], Scene: NaukriScene },
  indeed: { site: "indeed.com", dot: "bg-indigo-500", durations: [1500, 1400, 1000, 750, 1800], Scene: IndeedScene },
  whatsapp: { site: "linkedin.com → web.whatsapp.com", dot: "bg-emerald-500", durations: [1100, 850, 1900, 1700], Scene: WhatsAppScene },
  email: { site: "linkedin.com → mail.google.com", dot: "bg-sky-500", durations: [1100, 800, 1100, 1200, 750, 1600], Scene: EmailScene },
  hr_contacts: { site: "autoapplycv.in/hr-contacts", dot: "bg-purple-500", durations: [650, 650, 650, 650, 2000], Scene: HrContactsScene },
  commenter: { site: "linkedin.com/feed", dot: "bg-amber-500", durations: [900, 2100, 750, 1900], Scene: CommenterScene },
  interview: { site: "Zoom · Meet · Teams · phone", dot: "bg-rose-500", durations: [1900, 900, 2200, 900], Scene: InterviewScene },
};

export function ModuleHowItWorks({ moduleId, description, delayMs = 0 }: { moduleId: string; description: string; delayMs?: number }) {
  const scene = SCENES[moduleId];
  const reduceMotion = Boolean(useReducedMotion());
  const lastPhase = scene ? scene.durations.length - 1 : 0;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef({ phase: 0, cycle: 0 });
  const startedRef = useRef(false);
  const [timeline, setTimeline] = useState(timelineRef.current);
  const [visible, setVisible] = useState(true);

  // Only animate while the card is on screen and the browser tab is in front.
  useEffect(() => {
    const el = rootRef.current;
    let onScreen = true;
    const update = () => setVisible(onScreen && document.visibilityState === "visible");
    const observer =
      el && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting;
            update();
          }, { rootMargin: "80px" })
        : null;
    if (el) observer?.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    if (!scene || reduceMotion || !visible) return;
    let timer = 0;
    const schedule = (ms: number) => {
      timer = window.setTimeout(() => {
        let { phase, cycle } = timelineRef.current;
        phase += 1;
        if (phase > lastPhase) {
          phase = 0;
          cycle += 1;
        }
        timelineRef.current = { phase, cycle };
        setTimeline(timelineRef.current);
        schedule(scene.durations[phase]);
      }, ms);
    };
    // Cards start at different moments so they don't all move in sync.
    schedule(scene.durations[timelineRef.current.phase] + (startedRef.current ? 0 : delayMs));
    startedRef.current = true;
    return () => window.clearTimeout(timer);
  }, [scene, reduceMotion, visible, delayMs, lastPhase]);

  if (!scene) {
    return <p className="text-[11px] text-gray-600 leading-relaxed min-h-[32px]">{description}</p>;
  }

  const { Scene: SceneView } = scene;
  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={description}
      title={description}
      className="select-none overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50"
    >
      <div className="flex items-center gap-1.5 border-b border-gray-200/70 bg-white/80 px-2 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
        <span className={`h-1.5 w-1.5 rounded-full ${scene.dot}`} />
        <span className="ml-1 truncate text-[9px] font-medium text-gray-400">{scene.site}</span>
      </div>
      {/* contain: changes inside a scene never make the rest of the page re-layout */}
      <div aria-hidden className="relative h-[118px] text-[9.5px] leading-tight [contain:layout_paint]">
        <InstantContext.Provider value={reduceMotion}>
          <SceneView key={timeline.cycle} phase={reduceMotion ? lastPhase : timeline.phase} />
        </InstantContext.Provider>
      </div>
    </div>
  );
}
