import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { Bot, Loader2, Maximize2, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const STARTER_QUESTIONS = [
  'How many applies do I have left today?',
  'Why did my last auto-apply run fail?',
  'How do I install and connect the Chrome extension?',
  'What do I get with Pro?',
  'How can I improve my resume for my target roles?',
  'Which applications did I send this week?',
];

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.21-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47 2.53 0 4.91.99 6.7 2.78a9.41 9.41 0 0 1 2.77 6.7c0 5.22-4.25 9.47-9.47 9.47zm8.06-17.53A11.33 11.33 0 0 0 12.04.64C5.76.64.65 5.75.65 12.03c0 2.01.52 3.97 1.52 5.69L.55 23.36l5.77-1.51a11.37 11.37 0 0 0 5.71 1.46h.01c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.19-5.9-3.33-8.05z" />
    </svg>
  );
}

// Links come from AI output (which can echo scraped job text), so only allow
// in-app paths and http(s)/mailto URLs; anything else (e.g. javascript:) renders as plain text.
function safeLinkTarget(href: string): { internal: boolean; href: string } | null {
  if (href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/\\')) return { internal: true, href };
  try {
    const url = new URL(href);
    if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:') {
      return { internal: false, href: url.href };
    }
  } catch {
    // not an absolute URL
  }
  return null;
}

// Minimal Markdown: **bold**, [label](href), bullet / numbered lists, paragraphs.
function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[1]) {
      parts.push(<strong key={match.index} className="font-semibold text-slate-900">{match[1]}</strong>);
    } else {
      const target = safeLinkTarget(match[3]);
      const cls = 'font-medium text-indigo-600 underline decoration-indigo-200 underline-offset-2 hover:decoration-indigo-600';
      parts.push(
        !target ? (
          match[2]
        ) : target.internal ? (
          <Link key={match.index} to={target.href} className={cls}>{match[2]}</Link>
        ) : (
          <a key={match.index} href={target.href} target="_blank" rel="noopener noreferrer" className={cls}>{match[2]}</a>
        ),
      );
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function MarkdownText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter((l) => l.trim());
        const isList = lines.length > 0 && lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l));
        if (isList) {
          const ordered = /^\s*\d+[.)]/.test(lines[0]);
          const ListTag = ordered ? 'ol' : 'ul';
          return (
            <ListTag key={bi} className={`${ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1`}>
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''))}</li>
              ))}
            </ListTag>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export default function Assistant() {
  const location = useLocation();
  const fromPage = (location.state as { from?: string } | null)?.from || '';
  return <AssistantChat variant="page" page={fromPage} />;
}

/** Chat UI shared by the full page and the slide-in panel; both use the same saved conversation. */
export function AssistantChat({
  variant,
  page,
  onClose,
}: {
  variant: 'page' | 'panel';
  page: string;
  onClose?: () => void;
}) {
  const { user } = useAuth();
  const fromPage = page;
  const isPanel = variant === 'panel';
  const storageKey = `cp_assistant_chat_${user?.id || 'anon'}`;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(saved) ? saved.slice(-40) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [faqQuestions, setFaqQuestions] = useState<string[]>([]);
  const [reporting, setReporting] = useState(false);
  const [reportNote, setReportNote] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/assistant', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        setIsPaid(Boolean(data?.data?.isPaid));
        setFaqQuestions(Array.isArray(data?.data?.faqQuestions) ? data.data.faqQuestions : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)));
    } catch {
      // storage unavailable — chat still works for this visit
    }
  }, [messages, storageKey]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setError('');
    setReportNote('');
    setInput('');
    const history: ChatMessage[] = [...messages, { role: 'user', content: text.slice(0, 4000) }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setBusy(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-20), page: fromPage }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'The assistant could not respond.');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        const current = answer;
        setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: current }]);
      }
      if (!answer.trim()) throw new Error('The assistant returned an empty answer. Please try again.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The assistant could not respond.');
      setMessages((prev) => (prev[prev.length - 1]?.content ? prev : prev.slice(0, -1)));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const reportOnWhatsApp = async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const question = input.trim() || lastUser?.content || '';
    if (!question) {
      setReportNote('Type your issue or feedback first, then tap WhatsApp.');
      inputRef.current?.focus();
      return;
    }
    const lastAnswer = messages[messages.length - 1]?.role === 'assistant' ? messages[messages.length - 1].content : '';
    // Open the tab synchronously so popup blockers allow it, then point it at WhatsApp.
    const waWindow = window.open('', '_blank');
    setReporting(true);
    setReportNote('');
    try {
      const res = await fetch('/api/assistant/report', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer: input.trim() ? '' : lastAnswer, page: fromPage }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.data?.whatsappUrl) throw new Error(data?.message || 'Could not send your report.');
      if (waWindow) waWindow.location.href = data.data.whatsappUrl;
      else window.location.href = data.data.whatsappUrl;
      if (input.trim()) setInput('');
      setReportNote('Sent to our team. Tap Send in WhatsApp to chat with us directly.');
    } catch (e) {
      waWindow?.close();
      setReportNote(e instanceof Error ? e.message : 'Could not send your report.');
    } finally {
      setReporting(false);
    }
  };

  const firstName = (user?.name || '').split(' ')[0];
  // Free users get pre-written answers, so offer the question list; paid users get AI starters.
  const starters = isPaid || !faqQuestions.length
    ? (isPanel ? STARTER_QUESTIONS.slice(0, 4) : STARTER_QUESTIONS)
    : faqQuestions.slice(0, isPanel ? 6 : 8);
  const asked = new Set(messages.filter((m) => m.role === 'user').map((m) => m.content));
  const followUps = isPaid ? [] : faqQuestions.filter((q) => !asked.has(q)).slice(0, 6);

  return (
    <div
      className={
        isPanel
          ? 'flex h-full flex-col overflow-hidden bg-white'
          : 'mx-auto flex h-[calc(100vh-8rem)] min-h-[520px] max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'
      }
    >
      {/* Header */}
      <div className={`flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50 ${isPanel ? 'px-4 py-3' : 'px-5 py-4'}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-sm ${isPanel ? 'h-8 w-8' : 'h-10 w-10'}`}>
            <Bot className={isPanel ? 'h-4 w-4 text-white' : 'h-5 w-5 text-white'} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900">AI Assistant</h1>
            <p className="truncate text-xs text-slate-500">
              {isPanel ? 'Knows your account and this page' : 'Knows your account, plan, applications and the whole AutoApply CV site'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError('');
                setReportNote('');
              }}
              title="New chat"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-white hover:text-slate-800 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {!isPanel && 'New chat'}
            </button>
          )}
          {isPanel && (
            <>
              <Link
                to="/dashboard/assistant"
                state={{ from: page }}
                onClick={onClose}
                title="Open full page"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-800"
              >
                <Maximize2 className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={onClose}
                title="Close"
                aria-label="Close assistant"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className={`min-h-0 flex-1 space-y-4 overflow-y-auto ${isPanel ? 'px-4 py-4' : 'px-5 py-5'}`}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
              <Sparkles className="h-6 w-6 text-indigo-500" />
            </div>
            <p className="text-lg font-semibold text-slate-900">Hi{firstName ? ` ${firstName}` : ''}, how can I help?</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              {isPaid
                ? 'Ask about your applications, auto-apply runs, the extension, billing, or anything on AutoApply CV.'
                : 'Pick a common question or type your own for an instant answer.'}
            </p>
            <div className={`mt-6 grid w-full max-w-2xl gap-2 ${isPanel ? '' : 'sm:grid-cols-2'}`}>
              {starters.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50/50 cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start gap-2.5'}>
              {m.role === 'assistant' && (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                  <Bot className="h-4 w-4 text-indigo-600" />
                </div>
              )}
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-sm text-white'
                    : 'max-w-[85%] rounded-2xl rounded-tl-md border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm leading-relaxed text-slate-700'
                }
              >
                {m.role === 'user' ? (
                  m.content
                ) : m.content ? (
                  <MarkdownText text={m.content} />
                ) : (
                  <span className="inline-flex items-center gap-2 text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-slate-100 px-4 py-3">
        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
        {reportNote && <p className="mb-2 text-xs text-emerald-700">{reportNote}</p>}
        {messages.length > 0 && followUps.length > 0 && !busy && (
          <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {followUps.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={isPaid ? 'Ask anything about your job search or AutoApply CV…' : 'Type a question, e.g. how many applies do I have left?'}
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
          {isPaid && (
            <button
              type="button"
              onClick={reportOnWhatsApp}
              disabled={reporting}
              title="Send this issue or feedback to the AutoApply CV team on WhatsApp"
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-sm transition-colors hover:bg-[#1ebe5b] disabled:opacity-60 cursor-pointer"
            >
              {reporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <WhatsAppIcon className="h-5 w-5" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            className="flex h-[42px] shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 text-sm font-semibold text-white shadow-sm hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 cursor-pointer"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          {isPaid ? (
            <>
              AI answers can be wrong. Check billing details on the <Link to="/dashboard/billing" className="underline">Billing</Link> page.
              {' '}Use the WhatsApp button to send an issue or feedback straight to our team.
            </>
          ) : (
            <>
              Free plan: instant answers from our help library.{' '}
              <Link to="/dashboard/billing" onClick={onClose} className="font-semibold text-indigo-600 underline">Upgrade to Pro</Link>
              {' '}for AI answers about anything on your account, plus WhatsApp support.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
