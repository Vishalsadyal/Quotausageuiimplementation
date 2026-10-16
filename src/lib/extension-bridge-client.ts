import {
  normalizeExtensionProvider,
  type ExtensionProvider,
} from "src/lib/extension-providers";

type ExtensionHistoryBucket = {
  applied: any[];
  failed: any[];
  external: any[];
  skipped: any[];
};

export type ExtensionBridgeProviderSnapshot = {
  provider: ExtensionProvider;
  installed: boolean;
  runtimeId?: string;
  version?: string;
  state?: Record<string, unknown> | null;
  dailyCap?: Record<string, unknown> | null;
  historySummary?: Record<string, unknown> | null;
  currentRunSummary?: Record<string, unknown> | null;
  pendingQuestions: Array<Record<string, unknown>>;
  screeningAnswers: Record<string, string>;
  // Email of the account the extension's saved answers belong to (lowercase; absent on older versions).
  accountEmail?: string;
  history: ExtensionHistoryBucket;
  linkedIn?: {
    hasLinkedInTab: boolean;
    hasJobsTab: boolean;
  };
  indeed?: {
    hasIndeedTab: boolean;
    hasJobsTab: boolean;
  };
  error?: string | null;
};

export type ExtensionBridgeSnapshot = {
  installed: boolean;
  providers: Partial<Record<ExtensionProvider, ExtensionBridgeProviderSnapshot>>;
  activeProvider: ExtensionProvider | null;
  runtimeId?: string;
  version?: string;
  state?: Record<string, unknown> | null;
  dailyCap?: Record<string, unknown> | null;
  historySummary?: Record<string, unknown> | null;
  currentRunSummary?: Record<string, unknown> | null;
  pendingQuestions: Array<Record<string, unknown>>;
  screeningAnswers: Record<string, string>;
  accountEmail?: string;
  history: ExtensionHistoryBucket;
  linkedIn?: ExtensionBridgeProviderSnapshot["linkedIn"];
  indeed?: ExtensionBridgeProviderSnapshot["indeed"];
  error?: string | null;
};

function emptyHistory(): ExtensionHistoryBucket {
  return {
    applied: [],
    failed: [],
    external: [],
    skipped: [],
  };
}

function inferProviderFromPayload(data: any): ExtensionProvider {
  const explicit = String(data?.provider || "").trim().toLowerCase();
  if (explicit) return normalizeExtensionProvider(explicit);
  if (data?.indeed) return "indeed";
  return "linkedin";
}

function normalizeHistoryBucket(raw: any, provider: ExtensionProvider): ExtensionHistoryBucket {
  const history = raw && typeof raw === "object" ? raw : {};
  const withProvider = (items: any[]) =>
    items.map((item) => ({
      ...(item && typeof item === "object" ? item : {}),
      provider,
      data: {
        ...((item?.data && typeof item.data === "object") ? item.data : {}),
        provider,
      },
    }));

  return {
    applied: withProvider(Array.isArray(history.applied) ? history.applied : []),
    failed: withProvider(Array.isArray(history.failed) ? history.failed : []),
    external: withProvider(Array.isArray(history.external) ? history.external : []),
    skipped: withProvider(Array.isArray(history.skipped) ? history.skipped : []),
  };
}

function normalizeProviderSnapshot(data: any): ExtensionBridgeProviderSnapshot {
  const provider = inferProviderFromPayload(data);
  const bridgeError = String(data?.error || "").trim();
  const runtimeBootstrapOk =
    Boolean(data?.runtimeBootstrapOk) ||
    (Boolean(data?.state) && typeof data.state === "object" && !Array.isArray(data.state));

  return {
    provider,
    installed: Boolean(data?.installed) && !bridgeError && runtimeBootstrapOk,
    runtimeId: String(data?.runtimeId || "").trim() || undefined,
    version: String(data?.extensionVersion || data?.version || "").trim() || undefined,
    state:
      data?.state && typeof data.state === "object" && !Array.isArray(data.state)
        ? (data.state as Record<string, unknown>)
        : null,
    dailyCap:
      data?.dailyCap && typeof data.dailyCap === "object" && !Array.isArray(data.dailyCap)
        ? (data.dailyCap as Record<string, unknown>)
        : null,
    historySummary:
      data?.historySummary && typeof data.historySummary === "object" && !Array.isArray(data.historySummary)
        ? (data.historySummary as Record<string, unknown>)
        : null,
    currentRunSummary:
      data?.currentRunSummary && typeof data.currentRunSummary === "object" && !Array.isArray(data.currentRunSummary)
        ? (data.currentRunSummary as Record<string, unknown>)
        : null,
    pendingQuestions: Array.isArray(data?.pendingQuestions) ? data.pendingQuestions : [],
    screeningAnswers:
      data?.screeningAnswers && typeof data.screeningAnswers === "object" && !Array.isArray(data.screeningAnswers)
        ? (data.screeningAnswers as Record<string, string>)
        : {},
    accountEmail: String(data?.accountEmail || "").trim().toLowerCase() || undefined,
    history: normalizeHistoryBucket(data?.history, provider),
    linkedIn: data?.linkedIn && typeof data.linkedIn === "object" ? data.linkedIn : undefined,
    indeed: data?.indeed && typeof data.indeed === "object" ? data.indeed : undefined,
    error: bridgeError || null,
  };
}

function pickActiveProvider(
  providers: ExtensionBridgeProviderSnapshot[],
): ExtensionBridgeProviderSnapshot | null {
  return (
    providers.find((item) => Boolean(item.state?.running)) ||
    providers.find((item) => item.installed) ||
    providers[0] ||
    null
  );
}

function mergeHistories(providers: ExtensionBridgeProviderSnapshot[]): ExtensionHistoryBucket {
  return providers.reduce<ExtensionHistoryBucket>(
    (acc, provider) => ({
      applied: [...acc.applied, ...provider.history.applied],
      failed: [...acc.failed, ...provider.history.failed],
      external: [...acc.external, ...provider.history.external],
      skipped: [...acc.skipped, ...provider.history.skipped],
    }),
    emptyHistory(),
  );
}

function mergePendingQuestions(providers: ExtensionBridgeProviderSnapshot[]) {
  const seen = new Set<string>();
  const merged: Array<Record<string, unknown>> = [];
  for (const provider of providers) {
    for (const item of provider.pendingQuestions) {
      const questionKey = String(item?.questionKey || item?.questionLabel || "").trim();
      const key = `${provider.provider}:${questionKey}:${String(item?.validationMessage || "").trim()}`;
      if (!questionKey || seen.has(key)) continue;
      seen.add(key);
      merged.push({ ...item, provider: provider.provider });
    }
  }
  return merged;
}

export function collectExtensionBridgeSnapshot(opts?: {
  timeoutMs?: number;
  settleMs?: number;
  requestIdPrefix?: string;
}) {
  if (typeof window === "undefined") {
    return Promise.resolve<ExtensionBridgeSnapshot>({
      installed: false,
      providers: {},
      activeProvider: null,
      pendingQuestions: [],
      screeningAnswers: {},
      history: emptyHistory(),
      error: null,
    });
  }

  const timeoutMs = Math.max(500, Number(opts?.timeoutMs || 4500));
  const settleMs = Math.max(100, Number(opts?.settleMs || 450));
  const requestId = `${String(opts?.requestIdPrefix || "cp_bridge")}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return new Promise<ExtensionBridgeSnapshot>((resolve) => {
    let settled = false;
    let settleTimer = 0;
    const providerMap = new Map<ExtensionProvider, ExtensionBridgeProviderSnapshot>();

    const finalize = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutTimer);
      window.clearTimeout(settleTimer);
      window.removeEventListener("message", onMessage);

      const providers = Array.from(providerMap.values());
      const active = pickActiveProvider(providers);
      const screeningAnswers = providers.reduce<Record<string, string>>(
        (acc, item) => ({ ...acc, ...item.screeningAnswers }),
        {},
      );
      resolve({
        installed: providers.some((item) => item.installed),
        providers: Object.fromEntries(providers.map((item) => [item.provider, item])),
        activeProvider: active?.provider || null,
        runtimeId: active?.runtimeId,
        version: active?.version,
        state: active?.state || null,
        dailyCap: active?.dailyCap || null,
        historySummary: active?.historySummary || null,
        currentRunSummary: active?.currentRunSummary || null,
        pendingQuestions: mergePendingQuestions(providers),
        screeningAnswers,
        accountEmail: active?.accountEmail || providers.find((item) => item.accountEmail)?.accountEmail,
        history: mergeHistories(providers),
        linkedIn: providerMap.get("linkedin")?.linkedIn,
        indeed: providerMap.get("indeed")?.indeed,
        error: active?.error || null,
      });
    };

    const timeoutTimer = window.setTimeout(finalize, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as any;
      if (!data || data.type !== "CP_WEB_PONG" || data.requestId !== requestId) return;
      const snapshot = normalizeProviderSnapshot(data);
      providerMap.set(snapshot.provider, snapshot);
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(finalize, settleMs);
    };

    window.addEventListener("message", onMessage);
    window.postMessage({ type: "CP_WEB_PING", requestId }, window.location.origin);
  });
}
