import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { BellRing, Clock, MessageSquareText, X } from 'lucide-react';
import { jobsSectionPath } from '../pages/dashboard/jobsSections';
import type { PendingQuestion } from '../hooks/usePendingQuestions';

// Shown when the extension is waiting on questions it could not answer itself (saved answers,
// profile and AI all failed). "Answer now" opens Auto Apply > Screening Answers.
// "Remind me later" snoozes; "Dismiss" hides it until a NEW question comes in.

const SNOOZE_OPTIONS = [
  { label: '15 minutes', ms: 15 * 60_000 },
  { label: '1 hour', ms: 60 * 60_000 },
  { label: '4 hours', ms: 4 * 60 * 60_000 },
  { label: 'Tomorrow', ms: 0 }, // 9 AM tomorrow
];

type PromptMemory = { snoozeUntil: number; dismissedSignature: string; notifiedSignature: string };

const storageKey = (userId: string) => `cp_pending_prompt_${userId}`;

function readMemory(userId: string): PromptMemory {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (raw) return { snoozeUntil: 0, dismissedSignature: '', notifiedSignature: '', ...JSON.parse(raw) };
  } catch {
    // storage blocked: start fresh
  }
  return { snoozeUntil: 0, dismissedSignature: '', notifiedSignature: '' };
}

function writeMemory(userId: string, memory: PromptMemory) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(memory));
  } catch {
    // ignore: the prompt just shows again next time
  }
}

function tomorrowMorning() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

export default function PendingQuestionsPrompt({
  userId,
  questions,
  openSignal,
}: {
  userId: string;
  questions: PendingQuestion[];
  /** Increment to open the prompt even when snoozed/dismissed (e.g. from the bell). */
  openSignal: number;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [memory, setMemory] = useState<PromptMemory>(() => readMemory(userId));
  const [forcedOpen, setForcedOpen] = useState(false);
  const [snoozeMenu, setSnoozeMenu] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastSignal = useRef(openSignal);

  const signature = useMemo(() => questions.map((q) => q.questionKey).sort().join('|'), [questions]);
  const provider = questions[0]?.provider || 'linkedin';
  const answerPath = jobsSectionPath(provider, 'screening');
  const onAnswerPage = location.pathname.startsWith(answerPath);

  useEffect(() => setMemory(readMemory(userId)), [userId]);

  // Re-check the snooze every minute so "Remind me in 15 minutes" actually comes back.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (openSignal !== lastSignal.current) {
      lastSignal.current = openSignal;
      setForcedOpen(true);
    }
  }, [openSignal]);

  const save = (patch: Partial<PromptMemory>) => {
    const next = { ...memory, ...patch };
    setMemory(next);
    writeMemory(userId, next);
  };

  // Desktop notification for NEW questions while the dashboard tab is in the background.
  useEffect(() => {
    if (!questions.length || !signature || signature === memory.notifiedSignature) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return;
    if (memory.snoozeUntil > Date.now()) return;
    const n = new Notification(`${questions.length} question${questions.length > 1 ? 's' : ''} need your answer`, {
      body: `AutoApply CV is waiting on: ${questions[0].questionLabel.slice(0, 90)}`,
      tag: 'cp-pending-questions',
    });
    n.onclick = () => {
      window.focus();
      navigate(answerPath);
      n.close();
    };
    save({ notifiedSignature: signature });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const visible =
    questions.length > 0 &&
    !onAnswerPage &&
    (forcedOpen || (memory.snoozeUntil <= now && memory.dismissedSignature !== signature));

  if (!visible) return null;

  const close = () => {
    setForcedOpen(false);
    setSnoozeMenu(false);
  };
  const answerNow = () => {
    close();
    navigate(answerPath);
  };
  const snooze = (ms: number) => {
    save({ snoozeUntil: ms ? Date.now() + ms : tomorrowMorning() });
    close();
  };
  const dismiss = () => {
    save({ dismissedSignature: signature });
    close();
  };
  const canAskDesktop = typeof Notification !== 'undefined' && Notification.permission === 'default';

  return (
    <div
      role="alertdialog"
      aria-labelledby="cp-pending-title"
      aria-describedby="cp-pending-desc"
      className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 sm:w-[380px] rounded-2xl border border-amber-200 bg-white shadow-2xl animate-in slide-in-from-bottom-4 duration-200"
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          <MessageSquareText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p id="cp-pending-title" className="text-sm font-semibold text-gray-900">
            {questions.length} question{questions.length > 1 ? 's' : ''} need{questions.length > 1 ? '' : 's'} your answer
          </p>
          <p id="cp-pending-desc" className="mt-0.5 text-xs text-gray-500">
            Auto-apply could not answer {questions.length > 1 ? 'these' : 'this'} from your profile or AI, and is waiting for you.
          </p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <ul className="mx-4 mb-3 space-y-1.5">
        {questions.slice(0, 3).map((q) => (
          <li key={q.questionKey} className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
            <span className="line-clamp-2">{q.questionLabel}</span>
            {q.validationMessage && <span className="mt-0.5 block text-[11px] text-red-500 line-clamp-1">{q.validationMessage}</span>}
          </li>
        ))}
        {questions.length > 3 && <li className="px-1 text-[11px] text-gray-400">and {questions.length - 3} more</li>}
      </ul>

      <div className="flex items-center gap-2 border-t border-gray-100 p-3">
        <button
          type="button"
          onClick={answerNow}
          className="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Answer now
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setSnoozeMenu((v) => !v)}
            aria-expanded={snoozeMenu}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Clock className="h-4 w-4" />
            Remind me later
          </button>
          {snoozeMenu && (
            <div className="absolute bottom-full right-0 mb-2 w-40 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
              {SNOOZE_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => snooze(opt.ms)}
                  className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {canAskDesktop && (
        <button
          type="button"
          onClick={() => void Notification.requestPermission()}
          className="flex w-full items-center justify-center gap-1.5 border-t border-gray-100 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-b-2xl"
        >
          <BellRing className="h-3.5 w-3.5" />
          Also alert me on desktop when a new question comes in
        </button>
      )}
    </div>
  );
}
