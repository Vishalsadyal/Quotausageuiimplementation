import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Send, Sparkles } from 'lucide-react';
import { HeroLead, normalizeLinkedinInput, saveHeroLead } from 'src/lib/heroLead';

type StepKey = 'linkedinUrl' | 'jobTitle' | 'yearsOfExperience' | 'workMode';

type Step = {
  key: StepKey;
  question: (answers: Partial<HeroLead>) => string;
  placeholder?: string;
  chips?: { label: string; value: string }[];
  chipsOnly?: boolean;
  // Returns the stored value, or null with an error message for the AI to reply with.
  parse: (input: string) => { value: string } | { error: string };
};

const STEPS: Step[] = [
  {
    key: 'linkedinUrl',
    question: () => "Hi! I'm your AI job agent 👋 Paste your LinkedIn profile URL or username and I'll take it from there.",
    placeholder: 'linkedin.com/in/your-name',
    parse: (input) => {
      const url = normalizeLinkedinInput(input);
      return url ? { value: url } : { error: "Hmm, that doesn't look like a LinkedIn profile. Try the URL or just your username." };
    },
  },
  {
    key: 'jobTitle',
    question: () => 'Got it! What role should I apply to for you?',
    placeholder: 'e.g. Frontend Engineer',
    chips: ['Software Engineer', 'Frontend Engineer', 'Data Analyst', 'Product Manager'].map((t) => ({ label: t, value: t })),
    parse: (input) => (input.trim().length >= 2 ? { value: input.trim() } : { error: 'Tell me the job title you want, e.g. "Backend Engineer".' }),
  },
  {
    key: 'yearsOfExperience',
    question: (a) => `Nice, ${a.jobTitle} it is. How many years of experience do you have?`,
    placeholder: 'Years, e.g. 3',
    chips: [
      { label: '0–1', value: '1' },
      { label: '2–3', value: '3' },
      { label: '4–6', value: '5' },
      { label: '7–10', value: '8' },
      { label: '10+', value: '10' },
    ],
    parse: (input) => {
      const years = Number(input.replace(/[^\d.]/g, ''));
      return input.trim() && Number.isFinite(years) && years >= 0 && years <= 50
        ? { value: String(Math.round(years)) }
        : { error: 'Just a number works, like 3.' };
    },
  },
  {
    key: 'workMode',
    question: () => 'Last one: where do you want to work?',
    chips: [
      { label: '🏠 Remote', value: 'Remote' },
      { label: '🔀 Hybrid', value: 'Hybrid' },
      { label: '🏢 On-site', value: 'Onsite' },
    ],
    chipsOnly: true,
    parse: (input) => ({ value: input }),
  },
];

type Message = { from: 'ai' | 'user'; text: string };

export function HeroQuickStart({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [answers, setAnswers] = useState<Partial<HeroLead>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [input, setInput] = useState('');
  const [isDone, setIsDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const step = STEPS[stepIndex];

  const aiSay = (text: string, delay = 700) =>
    new Promise<void>((resolve) => {
      setIsTyping(true);
      window.setTimeout(() => {
        setMessages((prev) => [...prev, { from: 'ai', text }]);
        setIsTyping(false);
        resolve();
      }, delay);
    });

  const greetedRef = useRef(false);
  useEffect(() => {
    // Guard against React StrictMode running the effect twice in dev.
    if (greetedRef.current) return;
    greetedRef.current = true;
    void aiSay(STEPS[0].question({}), 900);
  }, []);

  useEffect(() => {
    // Scroll only the chat box, never the page.
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isTyping]);

  const submit = async (raw: string, displayText = raw) => {
    if (!step || isTyping || isDone || !raw.trim()) return;
    setMessages((prev) => [...prev, { from: 'user', text: displayText }]);
    setInput('');

    const result = step.parse(raw);
    if ('error' in result) {
      await aiSay(result.error, 500);
      return;
    }

    const nextAnswers = { ...answers, [step.key]: result.value };
    setAnswers(nextAnswers);

    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
      await aiSay(STEPS[stepIndex + 1].question(nextAnswers));
      inputRef.current?.focus({ preventScroll: true });
      return;
    }

    setIsDone(true);
    saveHeroLead(nextAnswers as Omit<HeroLead, 'savedAt'>);
    await aiSay(`Perfect! I'm finding ${nextAnswers.jobTitle} roles for you and setting up your dashboard…`, 600);
    window.setTimeout(() => navigate('/dashboard'), 1200);
  };

  return (
    <div className={`group relative [perspective:1400px] ${className}`}>
      {/* Tilted 3D stage: the card leans back on desktop and straightens on hover */}
      <div className="relative transition-transform duration-500 ease-out [transform-style:preserve-3d] lg:[transform:rotateY(-9deg)_rotateX(4deg)] lg:group-hover:[transform:rotateY(-2deg)_rotateX(1deg)]">
        {/* Stacked depth layers behind the card */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,#8068ff,#4932cf)] opacity-70 [transform:translate3d(22px,22px,-60px)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl bg-[#c8ff62] opacity-45 [transform:translate3d(11px,11px,-30px)]"
        />

        {/* Glowing gradient edge */}
        <div className="relative rounded-2xl p-[1.5px] bg-[linear-gradient(135deg,rgba(200,255,98,.9),rgba(96,71,245,.9)_55%,rgba(255,255,255,.25))] shadow-[0_40px_80px_-20px_rgba(4,3,14,.7),0_20px_40px_-20px_rgba(96,71,245,.6)]">
    <div className="bg-white rounded-[15px] overflow-hidden flex flex-col">
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[linear-gradient(180deg,#25204a,#17142e)] shadow-[inset_0_1px_0_rgba(255,255,255,.12)]">
        <div className="w-8 h-8 rounded-full bg-[#c8ff62] flex items-center justify-center shadow-[0_0_20px_rgba(200,255,98,.24)]">
          <Sparkles className="w-3.5 h-3.5 text-[#17142e]" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-white">AutoApply AI Agent</div>
          <div className="flex items-center gap-1.5 text-xs text-[#c8ff62] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff62] shadow-[0_0_0_3px_rgba(200,255,98,.18)]" />
            Online
          </div>
        </div>
        <div className="ml-auto px-2 py-0.5 rounded-full bg-white/10 text-xs font-semibold text-[#bdb8d4]">
          {Math.min(stepIndex + (isDone ? 1 : 0), STEPS.length)}/{STEPS.length}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-48 max-h-60 overflow-y-auto px-4 py-3 space-y-2.5 bg-[#f8f8fc]" aria-live="polite">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3.5 py-2 text-[13px] leading-relaxed rounded-2xl break-words ${
                  m.from === 'user'
                    ? 'bg-[linear-gradient(135deg,#684cff,#5237db)] text-white rounded-br-md shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_8px_18px_rgba(96,71,245,.3)]'
                    : 'bg-white border border-[#e6e3ee] text-[#17152b] rounded-bl-md shadow-[0_6px_14px_rgba(35,27,66,.08)]'
                }`}
              >
                {m.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isTyping && (
          <div className="flex justify-start" aria-label="AI is typing">
            <div className="px-3.5 py-2.5 bg-white border border-[#e6e3ee] rounded-2xl rounded-bl-md shadow-sm flex gap-1">
              {[0, 1, 2].map((d) => (
                <motion.span
                  key={d}
                  className="w-1.5 h-1.5 rounded-full bg-[#6047f5]"
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-3 pb-3 pt-2.5 bg-[#17142e] border-t border-white/10 space-y-2.5">
        {step?.chips && !isTyping && !isDone && (
          <div className="flex flex-wrap gap-2">
            {step.chips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() => void submit(chip.value, chip.label)}
                className="px-2.5 py-1 text-[13px] rounded-full border border-white/15 bg-white/[0.08] font-semibold text-[#eae7ff] shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_3px_0_rgba(0,0,0,.45)] hover:bg-[#c8ff62] hover:border-[#c8ff62] hover:text-[#17142e] hover:-translate-y-px active:translate-y-[2px] active:shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_1px_0_rgba(0,0,0,.45)] transition-all"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {!step?.chipsOnly && !isDone && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type={step?.key === 'yearsOfExperience' ? 'number' : 'text'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isTyping}
              placeholder={isTyping ? 'AI is typing…' : step?.placeholder}
              aria-label={step?.placeholder || 'Your answer'}
              className="flex-1 min-w-0 px-3.5 py-2.5 text-sm rounded-xl border border-white/20 bg-white text-[#17152b] shadow-[inset_0_2px_4px_rgba(23,20,46,.12)] caret-[#6047f5] placeholder:text-[#8f89a8] focus:border-[#8d7aff] focus:ring-4 focus:ring-[rgba(96,71,245,.35)] transition-all outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isTyping || !input.trim()}
              aria-label="Send"
              className="w-10 h-10 shrink-0 rounded-xl bg-[linear-gradient(135deg,#684cff,#5237db)] text-white flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_4px_0_#3a27a6,0_10px_24px_rgba(96,71,245,.45)] hover:-translate-y-px active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_1px_0_#3a27a6,0_4px_10px_rgba(96,71,245,.35)] disabled:opacity-40 disabled:hover:translate-y-0 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}

        {isDone && <div className="text-center text-sm font-semibold text-[#c8ff62] py-2">Opening your dashboard…</div>}
      </div>
    </div>
        </div>
      </div>
    </div>
  );
}
