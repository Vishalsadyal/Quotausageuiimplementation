import { useCallback, useEffect, useRef, useState } from 'react';
import { collectExtensionBridgeSnapshot } from 'src/lib/extension-bridge-client';
import type { JobsProvider } from '../pages/dashboard/jobsSections';

export type PendingQuestion = {
  questionKey: string;
  questionLabel: string;
  validationMessage?: string;
  provider?: JobsProvider;
};

const POLL_MS = 30_000;

/**
 * Questions the extension is waiting on (it could not answer them from saved answers, the profile
 * or AI). Polls the extension bridge every 30 s while the tab is visible, and again on focus.
 */
export function usePendingQuestions(enabled = true) {
  const [questions, setQuestions] = useState<PendingQuestion[]>([]);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled || busy.current || typeof document === 'undefined' || document.hidden) return;
    busy.current = true;
    try {
      const snapshot = await collectExtensionBridgeSnapshot({ timeoutMs: 2500, settleMs: 300, requestIdPrefix: 'cp_pending' });
      const list = (snapshot.pendingQuestions || [])
        .map((q) => ({
          questionKey: String(q.questionKey || q.questionLabel || ''),
          questionLabel: String(q.questionLabel || q.questionKey || '').trim(),
          validationMessage: q.validationMessage ? String(q.validationMessage) : undefined,
          provider: (q.provider === 'indeed' ? 'indeed' : 'linkedin') as JobsProvider,
        }))
        .filter((q) => q.questionKey && q.questionLabel);
      setQuestions(list);
    } catch {
      // extension not installed / bridge unavailable: keep the last known list
    } finally {
      busy.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, refresh]);

  return { questions, refresh };
}
