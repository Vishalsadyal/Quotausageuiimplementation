import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { FileText, Loader2, Sparkles, Upload } from 'lucide-react';
import { normalizeLinkedinInput, saveHeroLead, savePendingResume } from 'src/lib/heroLead';

const MAX_MB = 5;
const ACCEPTED = '.pdf,.docx,.txt';

type Message = { from: 'ai' | 'user'; text: string };
type Status = 'idle' | 'reading' | 'done' | 'error';

type ReadResult = {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  linkedinUrl?: string;
  jobTitles?: string[];
  yearsOfExperience?: string;
};

function validateFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!/\.(pdf|docx|txt)$/.test(name)) return 'Please upload a PDF, DOCX or TXT file.';
  if (file.size > MAX_MB * 1024 * 1024) return `That file is over ${MAX_MB} MB. Please upload a smaller version.`;
  return null;
}

function summaryLine(profile: ReadResult) {
  const parts = [
    profile.jobTitles?.[0],
    profile.yearsOfExperience ? `${profile.yearsOfExperience} yrs experience` : '',
    profile.city,
  ].filter(Boolean);
  return parts.join(' · ');
}

export function HeroQuickStart({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(true);
  const [status, setStatus] = useState<Status>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    void aiSay("Hi! I'm your AI job agent 👋 Upload your latest resume and I'll fill in your profile automatically. No forms to type.", 900);
  }, []);

  useEffect(() => {
    // Scroll only the chat box, never the page.
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isTyping]);

  const handleFile = async (file: File | undefined) => {
    if (!file || status === 'reading' || status === 'done') return;
    setMessages((prev) => [...prev, { from: 'user', text: `📄 ${file.name}` }]);

    const invalid = validateFile(file);
    if (invalid) {
      setStatus('error');
      await aiSay(invalid, 400);
      return;
    }

    setStatus('reading');
    setIsTyping(true);
    let profile: ReadResult = {};
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const res = await fetch('/api/public/resume/parse', { method: 'POST', body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || 'Could not read this file.');
      profile = (data?.data?.profile || {}) as ReadResult;
    } catch (error) {
      setStatus('error');
      await aiSay(`${error instanceof Error ? error.message : 'Could not read this file.'} Try another file.`, 300);
      return;
    }

    saveHeroLead({
      name: profile.name || undefined,
      email: profile.email || undefined,
      phone: profile.phone || undefined,
      city: profile.city || undefined,
      linkedinUrl: profile.linkedinUrl ? normalizeLinkedinInput(profile.linkedinUrl) || undefined : undefined,
      jobTitle: profile.jobTitles?.[0] || undefined,
      yearsOfExperience: profile.yearsOfExperience || undefined,
      resumeFileName: file.name,
    });
    await savePendingResume(file);

    setStatus('done');
    const firstName = String(profile.name || '').trim().split(/\s+/)[0];
    const found = summaryLine(profile);
    await aiSay(
      `${firstName ? `Got it, ${firstName}!` : 'Got it!'}${found ? ` I found: ${found}.` : ''} Your profile is ready. Create your account and I'll start applying for you…`,
      500,
    );
    window.setTimeout(() => navigate('/dashboard'), 1400);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    void handleFile(event.dataTransfer.files?.[0]);
  };

  const busy = status === 'reading' || status === 'done';

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
          <div
            className="relative bg-white rounded-[15px] overflow-hidden flex flex-col"
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
          >
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
                ≈ 30 sec
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
                <div className="flex justify-start" aria-label={status === 'reading' ? 'Reading your resume' : 'AI is typing'}>
                  <div className="px-3.5 py-2.5 bg-white border border-[#e6e3ee] rounded-2xl rounded-bl-md shadow-sm flex items-center gap-2">
                    {status === 'reading' && <span className="text-[12px] text-[#4b5563]">Reading your resume</span>}
                    <span className="flex gap-1">
                      {[0, 1, 2].map((d) => (
                        <motion.span
                          key={d}
                          className="w-1.5 h-1.5 rounded-full bg-[#6047f5]"
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                          transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="px-3 pb-3 pt-2.5 bg-[#17142e] border-t border-white/10 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={(e) => {
                  void handleFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />

              {status === 'done' ? (
                <div className="text-center text-sm font-semibold text-[#c8ff62] py-2.5">Opening sign up…</div>
              ) : (
                <button
                  type="button"
                  disabled={busy || isTyping}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#c8ff62] text-[#17142e] text-sm font-extrabold shadow-[inset_0_1px_0_rgba(255,255,255,.6),0_4px_0_#8fbd3a,0_10px_24px_rgba(200,255,98,.25)] hover:-translate-y-px active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,.6),0_1px_0_#8fbd3a] disabled:opacity-60 disabled:hover:translate-y-0 transition-all"
                >
                  {status === 'reading' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Reading your resume…
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" /> {status === 'error' ? 'Try another file' : 'Upload your latest resume'}
                    </>
                  )}
                </button>
              )}

              <div className="flex items-center justify-between gap-2 text-[11px] text-[#a49fc0]">
                <span className="inline-flex items-center gap-1">
                  <FileText className="w-3 h-3" /> PDF, DOCX or TXT · max {MAX_MB} MB · or drag &amp; drop
                </span>
                <Link to="/signup" className="shrink-0 font-semibold text-[#eae7ff] hover:text-[#c8ff62] underline-offset-2 hover:underline">
                  No resume? Sign up
                </Link>
              </div>
            </div>

            {isDragging && (
              <div className="absolute inset-0 z-10 m-2 rounded-xl border-2 border-dashed border-[#6047f5] bg-[#eeeaff]/90 flex flex-col items-center justify-center gap-2 text-[#4932cf] pointer-events-none">
                <Upload className="w-7 h-7" />
                <span className="text-sm font-bold">Drop your resume here</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
