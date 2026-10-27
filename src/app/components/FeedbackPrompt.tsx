import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, Star, X } from 'lucide-react';
import { toast } from 'sonner';

// "Rate us" popup: stars → pick what they love / what to improve → write a review.
// Opens from the sidebar button, and by itself once after the 10th application ("Later" waits 14 days).
// 4-5 stars are then asked to also rate us on the Chrome Web Store; 1-3 stars stay private.

const STORE_REVIEW_URL = 'https://chromewebstore.google.com/detail/mcfmniiniaigfhhjlaegpmhecbdoikjd/reviews';
const AUTO_AFTER_APPLICATIONS = 10;
const SNOOZE_DAYS = 14;

const LOVE_TAGS = ['Auto Apply', 'Resume builder', 'HR Contacts', 'Cold emails', 'AI Assistant', 'Chrome extension', 'Saves time', 'Good price'];
const IMPROVE_TAGS = ['Bugs / errors', 'Too slow', 'Job matches', 'Pricing', 'Missing feature', 'Confusing to use', 'Extension issues', 'Support'];
const RATING_LABEL = ['', 'Very bad', 'Not good', 'Okay', 'Good', 'Excellent'];

type Step = 'rating' | 'tags' | 'review' | 'done';

const snoozeKey = (userId: string) => `cp:feedback:snooze:${userId}`;

function readSnooze(userId: string) {
  try {
    return Number(window.localStorage.getItem(snoozeKey(userId)) || 0);
  } catch {
    return 0;
  }
}

function writeSnooze(userId: string) {
  try {
    window.localStorage.setItem(snoozeKey(userId), String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
  } catch {
    // storage blocked: the popup may show again next visit
  }
}

type Props = {
  userId: string;
  page: string;
  /** Applications counted by the extension, added to the ones the server knows. */
  extensionApplied: number;
  /** Bumped by the sidebar button to open the popup. */
  openSignal: number;
  /** Off while an admin is viewing as the user. */
  autoPrompt?: boolean;
};

export default function FeedbackPrompt({ userId, page, extensionApplied, openSignal, autoPrompt = true }: Props) {
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<'manual' | 'auto'>('manual');
  const [step, setStep] = useState<Step>('rating');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [allowPublic, setAllowPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ rated: boolean; applications: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/user/feedback', { credentials: 'include' })
      .then((res) => res.json())
      .then((body) => {
        if (cancelled || !body?.success) return;
        setStatus({ rated: Boolean(body.data.last), applications: Number(body.data.applications) || 0 });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Ask once, after the 10th application, unless they already rated us or chose "Later".
  useEffect(() => {
    if (!autoPrompt || !status || status.rated || open) return;
    if (Math.max(status.applications, extensionApplied) < AUTO_AFTER_APPLICATIONS) return;
    if (readSnooze(userId) > Date.now()) return;
    const timer = window.setTimeout(() => {
      setTrigger('auto');
      setOpen(true);
    }, 4000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, extensionApplied, userId, autoPrompt]);

  useEffect(() => {
    if (openSignal > 0) {
      reset();
      setTrigger('manual');
      setOpen(true);
    }
  }, [openSignal]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  function reset() {
    setStep('rating');
    setRating(0);
    setHover(0);
    setTags([]);
    setComment('');
    setAllowPublic(true);
  }

  function close() {
    // Closing without sending counts as "Later", so the popup doesn't open by itself again soon.
    if (step !== 'done') writeSnooze(userId);
    setOpen(false);
  }

  function pickRating(value: number) {
    // Changing between happy and unhappy changes the options, so drop the old picks.
    if ((value >= 4) !== (rating >= 4)) setTags([]);
    setRating(value);
    setStep('tags');
  }

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch('/api/user/feedback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, tags, comment, allowPublic: happy && allowPublic, page, trigger }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) throw new Error(body?.message || 'Could not send your feedback');
      setStatus((prev) => (prev ? { ...prev, rated: true } : prev));
      setStep('done');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send your feedback');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const happy = rating >= 4;
  const shown = hover || rating;
  const tagOptions = happy ? LOVE_TAGS : IMPROVE_TAGS;
  const stepIndex = step === 'rating' ? 0 : step === 'tags' ? 1 : 2;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={close} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        className="relative w-full max-w-md rounded-2xl border border-purple-100 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {step !== 'done' && (
          <div className="flex gap-1.5 px-6 pt-5">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i <= stepIndex ? 'gradient-primary' : 'bg-gray-100'}`} />
            ))}
          </div>
        )}

        <div className="px-6 pb-6 pt-4">
          {step === 'rating' && (
            <div className="text-center">
              <h2 id="feedback-title" className="text-lg font-bold text-gray-900">How is AutoApply CV for you?</h2>
              <p className="mt-1 text-sm text-gray-500">Your rating helps us make it better.</p>
              <div className="mt-5 flex justify-center gap-1.5" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => pickRating(value)}
                    onMouseEnter={() => setHover(value)}
                    aria-label={`${value} star${value > 1 ? 's' : ''}`}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star className={`w-9 h-9 ${value <= shown ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>
              <p className="mt-2 h-5 text-sm font-semibold text-amber-600">{RATING_LABEL[shown]}</p>
            </div>
          )}

          {step === 'tags' && (
            <div>
              <h2 id="feedback-title" className="text-lg font-bold text-gray-900">
                {happy ? 'What do you love most?' : 'What should we improve?'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">Pick all that apply.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {tagOptions.map((tag) => {
                  const active = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      aria-pressed={active}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        active
                          ? 'bg-purple-600 border-purple-600 text-white'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 flex justify-between">
                <button type="button" onClick={() => setStep('rating')} className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-800">
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep('review')}
                  className="px-5 py-2 rounded-xl text-sm font-bold text-white gradient-primary shadow-xs hover:opacity-95"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div>
              <h2 id="feedback-title" className="text-lg font-bold text-gray-900">
                {happy ? 'Write a short review' : 'Tell us what went wrong'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">Optional, but it helps us a lot.</p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={2000}
                rows={4}
                autoFocus
                placeholder={happy ? 'e.g. Got 3 interview calls in my first week…' : 'e.g. The extension stops after a few jobs…'}
                className="mt-4 w-full rounded-xl border border-gray-200 bg-gray-50/70 px-3.5 py-2.5 text-sm outline-none focus:bg-white focus:border-purple-300 focus:ring-4 focus:ring-purple-100 transition-all resize-none"
              />
              {happy && (
                <label className="mt-3 flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowPublic}
                    onChange={(e) => setAllowPublic(e.target.checked)}
                    className="mt-0.5 accent-purple-600"
                  />
                  <span>You can show my review (with my first name) on the AutoApply CV website.</span>
                </label>
              )}
              <div className="mt-6 flex justify-between">
                <button type="button" onClick={() => setStep('tags')} className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-800">
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white gradient-primary shadow-xs hover:opacity-95 disabled:opacity-60"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send feedback
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center pt-2">
              <CheckCircle2 className="mx-auto w-12 h-12 text-emerald-500" />
              <h2 id="feedback-title" className="mt-3 text-lg font-bold text-gray-900">Thank you!</h2>
              {happy ? (
                <>
                  <p className="mt-1 text-sm text-gray-500">
                    Glad you like it. Would you also rate us on the Chrome Web Store? It helps other job seekers find us.
                  </p>
                  <a
                    href={STORE_REVIEW_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white gradient-primary shadow-xs hover:opacity-95"
                  >
                    <Star className="w-4 h-4 fill-white" />
                    Rate on Chrome Web Store
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button type="button" onClick={() => setOpen(false)} className="mt-2 block w-full py-2 text-xs font-medium text-gray-500 hover:text-gray-800">
                    Maybe later
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm text-gray-500">Sorry it wasn't great. Our team reads every message and will work on this.</p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="mt-5 px-5 py-2 rounded-xl text-sm font-bold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
