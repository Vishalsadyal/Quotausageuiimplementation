import { useEffect, useState } from "react";
import { collectExtensionBridgeSnapshot } from "src/lib/extension-bridge-client";

export type ExtensionPipelineStats = {
  applied: number;
  skipped: number;
  failed: number;
  appliedToday: number;
  skippedToday: number;
  failedToday: number;
  loaded: boolean;
};

function normalizeCount(value: unknown) {
  return Math.max(0, Math.floor(Number(value || 0)));
}

function isSameLocalDay(value: unknown, now: Date) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function buildFallbackSummary(history: Record<string, unknown>) {
  const now = new Date();
  const appliedItems = Array.isArray(history?.applied) ? history.applied : [];
  const skippedItems = Array.isArray(history?.skipped) ? history.skipped : [];
  const failedItems = Array.isArray(history?.failed) ? history.failed : [];
  const externalItems = Array.isArray(history?.external) ? history.external : [];

  return {
    totals: {
      applied: appliedItems.length,
      skipped: skippedItems.length,
      failed: failedItems.length,
      external: externalItems.length,
    },
    today: {
      applied: appliedItems.filter((item: any) => isSameLocalDay(item?.ts, now)).length,
      skipped: skippedItems.filter((item: any) => isSameLocalDay(item?.ts, now)).length,
      failed: failedItems.filter((item: any) => isSameLocalDay(item?.ts, now)).length,
      external: externalItems.filter((item: any) => isSameLocalDay(item?.ts, now)).length,
    },
  };
}

function normalizeImportEntry(entry: any, outcomeType: string) {
  return {
    ts: String(entry?.ts || ""),
    entryId: String(entry?.entryId || "").trim(),
    runId: String(entry?.runId || "").trim(),
    provider: String(entry?.provider || entry?.data?.provider || "").trim().toLowerCase() || "linkedin",
    outcomeType: String(outcomeType || entry?.outcomeType || "").trim().toUpperCase(),
    data: {
      ...(entry?.data && typeof entry.data === "object" ? entry.data : {}),
      provider: String(entry?.provider || entry?.data?.provider || "").trim().toLowerCase() || "linkedin",
    },
  };
}

function importKeyForEntry(entry: ReturnType<typeof normalizeImportEntry>) {
  if (entry.entryId) return entry.entryId;
  const data = entry.data && typeof entry.data === "object" ? entry.data : {};
  const jobId = String(data?.jobId || data?.externalJobId || "");
  const jobUrl = String(data?.jobUrl || "");
  const reasonCode = String(data?.reasonCode || "").toUpperCase();
  return `${entry.provider}:${entry.outcomeType}:${jobId || jobUrl}:${reasonCode}:${entry.ts}`;
}

export function useExtensionPipelineStats() {
  const [stats, setStats] = useState<ExtensionPipelineStats>({
    applied: 0,
    skipped: 0,
    failed: 0,
    appliedToday: 0,
    skippedToday: 0,
    failedToday: 0,
    loaded: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    let active = true;
    const timeoutMs = 6000;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setStats((prev) => ({ ...prev, loaded: true }));
    }, timeoutMs);

    const requestSnapshot = () => {
      if (!active) return;
      void collectExtensionBridgeSnapshot({
        timeoutMs,
        settleMs: 500,
        requestIdPrefix: "cp_pipe",
      }).then((snapshot) => {
        if (!active) return;

        const history = (snapshot.history || {}) as Record<string, any[]>;
        const historySummary =
          Object.keys(snapshot.providers || {}).length === 1 &&
          snapshot.historySummary &&
          typeof snapshot.historySummary === "object"
            ? snapshot.historySummary
            : buildFallbackSummary(history);
        const fallbackSummary = buildFallbackSummary(history);
        const totals =
          historySummary?.totals && typeof historySummary.totals === "object"
            ? (historySummary.totals as Record<string, unknown>)
            : (fallbackSummary.totals as Record<string, unknown>);
        const today =
          historySummary?.today && typeof historySummary.today === "object"
            ? (historySummary.today as Record<string, unknown>)
            : (fallbackSummary.today as Record<string, unknown>);

        try {
          const importedKey = "cpExtImportedOutcomeIdsV2";
          const raw = localStorage.getItem(importedKey) || "[]";
          const seen = new Set<string>(Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []);
          const candidates = [
            ...(Array.isArray(history.applied) ? history.applied : []).map((item: any) => normalizeImportEntry(item, "APPLIED")),
            ...(Array.isArray(history.skipped) ? history.skipped : []).map((item: any) => normalizeImportEntry(item, "SKIPPED")),
            ...(Array.isArray(history.failed) ? history.failed : []).map((item: any) => normalizeImportEntry(item, "FAILED")),
            ...(Array.isArray(history.external) ? history.external : []).map((item: any) => normalizeImportEntry(item, "EXTERNAL")),
          ]
            .filter((entry) => entry.ts && entry.outcomeType)
            .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
            .slice(-200);
          const delta = candidates.filter((entry) => !seen.has(importKeyForEntry(entry))).slice(0, 100);
          if (delta.length) {
            void fetch("/api/extension/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ entries: delta, limit: 100 }),
              credentials: "include",
            })
              .then(() => {
                for (const entry of delta) seen.add(importKeyForEntry(entry));
                const next = Array.from(seen).slice(-5000);
                localStorage.setItem(importedKey, JSON.stringify(next));
                try {
                  // Debounce global broadcast to prevent rapid re-fetch storm
                  window.dispatchEvent(new CustomEvent("cp:extensionImported", { detail: { count: delta.length } }));
                } catch {
                  // ignore
                }
              })
              .catch(() => {
                // ignore import failures
              });
          }
        } catch {
          // ignore import failures
        }

        setStats({
          applied: normalizeCount(totals.applied),
          skipped: normalizeCount(totals.skipped) + normalizeCount(totals.external),
          failed: normalizeCount(totals.failed),
          appliedToday: Math.max(normalizeCount(today.applied), normalizeCount(snapshot?.dailyCap?.used)),
          skippedToday: normalizeCount(today.skipped) + normalizeCount(today.external),
          failedToday: normalizeCount(today.failed),
          loaded: true,
        });
        window.clearTimeout(timer);
      });
    };

    const pingInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        requestSnapshot();
      }
    }, 15000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") requestSnapshot();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    requestSnapshot();

    return () => {
      active = false;
      window.clearTimeout(timer);
      window.clearInterval(pingInterval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return stats;
}
