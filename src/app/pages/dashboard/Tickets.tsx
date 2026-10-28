import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, CircleDot, LifeBuoy, Loader2, Send, Star } from 'lucide-react';

// Settings > My Tickets: bad ratings and bug reports from the "Rate us" popup (components/FeedbackPrompt.tsx),
// as a conversation with the team (who answer in Admin > Ratings). Replying to a closed ticket reopens it.

type Message = { id: string; author: 'user' | 'admin'; body: string; createdAt: string };
type Ticket = {
  id: string;
  rating: number;
  tags: string[];
  comment: string;
  ticketStatus: 'open' | 'closed';
  closedAt: string | null;
  lastMessageBy: 'user' | 'admin' | null;
  createdAt: string;
  messages: Message[];
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function Bubble({ mine, who, at, text }: { mine: boolean; who: string; at: string; text: string }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
          mine ? 'bg-purple-600 text-white rounded-br-md' : 'bg-gray-100 text-gray-900 rounded-bl-md border border-gray-200'
        }`}
      >
        <div className={`text-[11px] font-semibold ${mine ? 'text-purple-100' : 'text-purple-700'}`}>
          {who} · {formatDate(at)}
        </div>
        <p className="mt-0.5 text-sm whitespace-pre-line break-words">{text}</p>
      </div>
    </div>
  );
}

export default function Tickets() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/user/feedback/tickets', { credentials: 'include' })
      .then((res) => res.json())
      .then((body) => {
        if (!body?.success) throw new Error(body?.message || 'Could not load your tickets');
        setTickets(body.data.tickets);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your tickets'));
  }, []);

  const sendReply = async (ticket: Ticket) => {
    const text = (drafts[ticket.id] || '').trim();
    if (!text) return;
    setSending(ticket.id);
    try {
      const res = await fetch(`/api/user/feedback/tickets/${ticket.id}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) throw new Error(body?.message || 'Could not send your reply');
      const { message, feedback } = body.data as { message: Message; feedback: Pick<Ticket, 'ticketStatus' | 'closedAt' | 'lastMessageBy'> };
      setTickets((prev) =>
        prev ? prev.map((t) => (t.id === ticket.id ? { ...t, ...feedback, messages: [...t.messages, message] } : t)) : prev,
      );
      setDrafts((prev) => ({ ...prev, [ticket.id]: '' }));
      toast.success(ticket.ticketStatus === 'closed' ? 'Reply sent, ticket reopened' : 'Reply sent');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send your reply');
    } finally {
      setSending(null);
    }
  };

  const open = tickets?.filter((t) => t.ticketStatus === 'open').length ?? 0;

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <LifeBuoy className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Tickets</h1>
          <p className="text-sm text-gray-500">Problems you told us about. Chat with our team here; we close the ticket once it's fixed.</p>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {tickets === null && !error ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        </div>
      ) : tickets && tickets.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500">You have no tickets.</div>
      ) : tickets ? (
        <>
          <p className="text-sm text-gray-600">
            {open} open · {tickets.length - open} closed
          </p>
          <ul className="space-y-4">
            {tickets.map((t) => (
              <li key={t.id} className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-0.5" aria-label={`${t.rating} out of 5 stars`}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className={`w-4 h-4 ${i <= t.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                    ))}
                  </div>
                  {t.ticketStatus === 'open' ? (
                    <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      <CircleDot className="w-3.5 h-3.5" /> Open
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Closed
                      {t.closedAt ? ` ${new Date(t.closedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                    </span>
                  )}
                </div>

                {t.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-100">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Conversation: what they first wrote, then every reply */}
                <div className="mt-3 space-y-2.5">
                  <Bubble mine who="You" at={t.createdAt} text={t.comment || '(No message, rating only)'} />
                  {t.messages.map((m) => (
                    <Bubble
                      key={m.id}
                      mine={m.author === 'user'}
                      who={m.author === 'user' ? 'You' : 'AutoApply CV team'}
                      at={m.createdAt}
                      text={m.body}
                    />
                  ))}
                  {t.ticketStatus === 'open' && t.lastMessageBy !== 'admin' ? (
                    <p className="text-xs text-gray-500">We're looking into this. You'll see our reply here.</p>
                  ) : null}
                </div>

                {/* Reply */}
                <div className="mt-3 border-t border-gray-100 pt-3">
                  {t.ticketStatus === 'closed' ? (
                    <p className="mb-1.5 text-xs text-gray-500">This ticket is closed. Still having the problem? Reply and we'll open it again.</p>
                  ) : null}
                  <div className="flex items-end gap-2">
                    <textarea
                      value={drafts[t.id] || ''}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void sendReply(t);
                      }}
                      rows={2}
                      maxLength={4000}
                      placeholder="Write a reply…"
                      className="flex-1 rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2 text-sm outline-none focus:bg-white focus:border-purple-300 focus:ring-4 focus:ring-purple-100 resize-none"
                    />
                    <button
                      type="button"
                      onClick={() => void sendReply(t)}
                      disabled={sending === t.id || !(drafts[t.id] || '').trim()}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white gradient-primary shadow-xs hover:opacity-95 disabled:opacity-50"
                    >
                      {sending === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
