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
    <div className={`glass rounded-2xl shadow-premium border border-white/60 overflow-hidden flex flex-col ${className}`}>
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-white/70">
        <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center shadow-sm">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-gray-900">AutoApply AI Agent</div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Online
          </div>
        </div>
        <div className="ml-auto text-xs font-semibold text-gray-400">
          {Math.min(stepIndex + (isDone ? 1 : 0), STEPS.length)}/{STEPS.length}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-72 overflow-y-auto px-5 py-4 space-y-3 bg-white/40" aria-live="polite">
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
                className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed rounded-2xl break-words ${
                  m.from === 'user'
                    ? 'gradient-primary text-white rounded-br-md'
                    : 'bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm'
                }`}
              >
                {m.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isTyping && (
          <div className="flex justify-start" aria-label="AI is typing">
            <div className="px-4 py-3 bg-white border border-gray-100 rounded-2xl rounded-bl-md shadow-sm flex gap-1">
              {[0, 1, 2].map((d) => (
                <motion.span
                  key={d}
                  className="w-1.5 h-1.5 rounded-full bg-purple-400"
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-4 pt-3 bg-white/70 border-t border-gray-100 space-y-3">
        {step?.chips && !isTyping && !isDone && (
          <div className="flex flex-wrap gap-2">
            {step.chips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() => void submit(chip.value, chip.label)}
                className="px-3 py-1.5 rounded-full border border-purple-200 bg-white text-sm font-medium text-purple-700 hover:bg-purple-50 hover:border-purple-400 transition-all"
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
              className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 bg-white focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none disabled:bg-gray-50"
            />
            <button
              type="submit"
              disabled={isTyping || !input.trim()}
              aria-label="Send"
              className="w-12 h-12 shrink-0 rounded-xl gradient-primary text-white flex items-center justify-center shadow-premium disabled:opacity-40 transition-all"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        )}

        {isDone && <div className="text-center text-sm font-semibold text-purple-700 py-2">Opening your dashboard…</div>}
      </div>
    </div>
  );
}
