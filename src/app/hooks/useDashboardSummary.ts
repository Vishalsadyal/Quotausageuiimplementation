import { useEffect, useRef, useState } from "react";

export type DashboardRecentItem = {
  id: string;
  company: string;
  position: string;
  status: "Submitted" | "Running" | "Queued" | "Failed" | "Cancelled";
  date: string;
  match: number | null;
  provider: "linkedin" | "indeed";
  sourceLabel: string;
  sourceUrl: string;
  externalJobId: string;
};

export type DashboardSummary = {
  jobs: {
    total: number;
    queued: number;
    running: number;
    active: number;
    succeeded: number;
    failed: number;
    cancelled: number;
    deadLetter: number;
  };
  applications: {
    total: number;
    submitted: number;
    skipped: number;
    failed: number;
  };
  metrics: {
    responseRate: number;
    completionRate: number;
    interviewReadiness: number;
  };
  recent: DashboardRecentItem[];
  activityByDay: Array<{
    key: string;
    label: string;
    value: number;
  }>;
  proTip: {
    title: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
  };
  interview: {
    upcomingCount: number;
    title: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
  };
};

const EMPTY_SUMMARY: DashboardSummary = {
  jobs: {
    total: 0,
    queued: 0,
    running: 0,
    active: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    deadLetter: 0,
  },
  applications: {
    total: 0,
    submitted: 0,
    skipped: 0,
    failed: 0,
  },
  metrics: {
    responseRate: 0,
    completionRate: 0,
    interviewReadiness: 10,
  },
  recent: [],
  activityByDay: [],
  proTip: {
    title: "Complete onboarding",
    body: "Finish your profile to unlock better automation results.",
    ctaLabel: "Open onboarding",
    ctaHref: "/dashboard/onboarding",
  },
  interview: {
    upcomingCount: 0,
    title: "No interviews tracked yet",
    body: "Start your first run to build interview-ready data.",
    ctaLabel: "Find jobs",
    ctaHref: "/dashboard/jobs/linkedin",
  },
};

export function useDashboardSummary() {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);

  const loadRef = useRef(async (_silent = false) => {});

  loadRef.current = async (silent = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    if (!silent && mountedRef.current) {
      setLoading(true);
    }

    try {
      const res = await fetch("/api/user/dashboard", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to fetch dashboard summary");
      }
      if (!mountedRef.current) return;
      setSummary((data?.data || EMPTY_SUMMARY) as DashboardSummary);
      setError("");
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to fetch dashboard summary");
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    void loadRef.current();

    const onImported = () => {
      if (document.visibilityState === "visible") {
        void loadRef.current(true);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadRef.current(true);
      }
    };
    // 45s interval that only fires when visible
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadRef.current(true);
      }
    }, 45000);

    window.addEventListener("cp:extensionImported", onImported);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mountedRef.current = false;
      window.clearInterval(intervalId);
      window.removeEventListener("cp:extensionImported", onImported);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return {
    summary,
    loading,
    error,
    refresh: () => loadRef.current(),
  };
}
