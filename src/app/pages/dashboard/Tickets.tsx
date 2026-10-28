import { useEffect, useState } from 'react';
import { CheckCircle2, CircleDot, LifeBuoy, Loader2, MessageSquareReply, Star } from 'lucide-react';

// Settings > My Tickets: bad ratings and bug reports from the "Rate us" popup (components/FeedbackPrompt.tsx),
// with the team's reply and whether the ticket is open or closed. Replies come from Admin > Ratings.

type Ticket = {
  id: string;
  rating: number;
  tags: string[];
  comment: string;
  ticketStatus: 'open' | 'closed';
  adminReply: string;
  repliedAt: string | null;
  closedAt: string | null;
  createdAt: string;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Tickets() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/user/feedback/tickets', { credentials: 'include' })
      .then((res) => res.json())
      .then((body) => {
        if (!body?.success) throw new Error(body?.message || 'Could not load your tickets');
        setTickets(body.data.tickets);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your tickets'));
  }, []);

  const open = tickets?.filter((t) => t.ticketStatus === 'open').length ?? 0;

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <LifeBuoy className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Tickets</h1>
          <p className="text-sm text-gray-500">
            Problems you told us about. We reply here and close the ticket once it's fixed.
          </p>
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
          <ul className="space-y-3">
            {tickets.map((t) => (
              <li key={t.id} className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-0.5" aria-label={`${t.rating} out of 5 stars`}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className={`w-4 h-4 ${i <= t.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                      ))}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">Sent {formatDate(t.createdAt)}</div>
                  </div>
                  {t.ticketStatus === 'open' ? (
                    <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      <CircleDot className="w-3.5 h-3.5" /> Open
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Closed{t.closedAt ? ` ${new Date(t.closedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
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
                {t.comment ? <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">{t.comment}</p> : null}

                {t.adminReply ? (
                  <div className="mt-3 rounded-xl border border-purple-100 bg-purple-50/60 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700">
                      <MessageSquareReply className="w-3.5 h-3.5" />
                      AutoApply CV team{t.repliedAt ? ` · ${formatDate(t.repliedAt)}` : ''}
                    </div>
                    <p className="mt-1 text-sm text-gray-800 whitespace-pre-line">{t.adminReply}</p>
                  </div>
                ) : t.ticketStatus === 'open' ? (
                  <p className="mt-3 text-xs text-gray-500">We're looking into this. You'll see our reply here.</p>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
