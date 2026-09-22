import { motion } from "motion/react";
import {
  TrendingUp,
  Briefcase,
  Target,
  Clock,
  ArrowRight,
  Star,
  Calendar,
  Zap,
  Users,
  ExternalLink,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { UpgradeModal } from "../../components/upgrade-modal";
import { DashboardPromoBanner } from "../../components/marketing/DashboardPromoBanner";
import { useDashboardSummary, DashboardRecentItem } from "../../hooks/useDashboardSummary";
import { buildJobSourceUrl, cleanJobText, inferJobProvider, jobProviderLabel, parseExternalJobId } from "src/lib/job-source";

const PAGE_SIZE = 6;

function formatJobItem(job: any): DashboardRecentItem {
  const criteria = (job && typeof job.criteriaJson === "object" && !Array.isArray(job.criteriaJson) ? job.criteriaJson : {}) as Record<string, unknown>;
  const provider = inferJobProvider(criteria);
  const sourceUrl = buildJobSourceUrl(criteria, provider);
  const externalJobId =
    parseExternalJobId(criteria.jobId, provider) ||
    parseExternalJobId(criteria.externalJobId, provider) ||
    parseExternalJobId(sourceUrl, provider);
  const match = Number(criteria.matchScore || 0);

  let status: "Submitted" | "Running" | "Queued" | "Failed" | "Cancelled" = "Failed";
  if (job.status === "succeeded") status = "Submitted";
  else if (job.status === "running") status = "Running";
  else if (job.status === "queued") status = "Queued";
  else if (job.status === "cancelled") status = "Cancelled";

  return {
    id: job.id,
    company: cleanJobText(criteria.company) || jobProviderLabel(provider),
    position: cleanJobText(criteria.title || criteria.keywords) || "Auto-Apply Job",
    status,
    date: job.createdAt ? new Date(job.createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
    match: match > 0 ? match : null,
    provider,
    sourceLabel: jobProviderLabel(provider),
    sourceUrl,
    externalJobId,
  };
}

export default function Overview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [copiedJobId, setCopiedJobId] = useState("");
  const { summary, loading: summaryLoading, error: summaryError } = useDashboardSummary();

  // Paginated Recent Applications state
  const [recentItems, setRecentItems] = useState<DashboardRecentItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const isFetchingRef = useRef(false);

  const fetchApplicationsPage = useCallback(async (pageToLoad: number, isInitial = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isInitial) {
      setLoadingInitial(true);
      setFetchError("");
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await fetch(`/api/auto-apply/jobs?page=${pageToLoad}&limit=${PAGE_SIZE}`);
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to fetch applications");
      }

      const rawJobs = data?.data?.jobs || [];
      const formatted: DashboardRecentItem[] = rawJobs.map(formatJobItem);
      const totalPages = data?.data?.pagination?.totalPages || 1;

      setRecentItems((prev) => (pageToLoad === 1 ? formatted : [...prev, ...formatted]));
      setPage(pageToLoad);
      setHasMore(pageToLoad < totalPages);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load applications");
    } finally {
      isFetchingRef.current = false;
      setLoadingInitial(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void fetchApplicationsPage(1, true);

    const onImported = () => {
      void fetchApplicationsPage(1, true);
    };
    window.addEventListener("cp:extensionImported", onImported);
    return () => window.removeEventListener("cp:extensionImported", onImported);
  }, [fetchApplicationsPage]);

  // Fallback to summary.recent if paginated fetch returns 0 but summary has items
  const displayItems = recentItems.length > 0 ? recentItems : summary.recent;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 40 && hasMore && !loadingMore && !loadingInitial) {
      void fetchApplicationsPage(page + 1, false);
    }
  };

  const stats = [
    {
      name: "Active Applications",
      value: String(summary.jobs.active > 0 ? summary.jobs.active : summary.applications.submitted),
      change: `${summary.applications.submitted} submitted`,
      icon: Briefcase,
      iconBg: "bg-blue-50 text-blue-600 border border-blue-100",
    },
    {
      name: "Total Jobs",
      value: String(summary.jobs.total),
      change: `${summary.jobs.failed} failed`,
      icon: Target,
      iconBg: "bg-purple-50 text-purple-600 border border-purple-100",
    },
    {
      name: "Interviews Scheduled",
      value: String(summary.interview.upcomingCount),
      change: `${summary.metrics.interviewReadiness}% readiness`,
      icon: Calendar,
      iconBg: "bg-emerald-50 text-emerald-600 border border-emerald-100",
    },
    {
      name: "Response Rate",
      value: `${summary.metrics.responseRate}%`,
      change: "Submitted vs failed",
      icon: TrendingUp,
      iconBg: "bg-amber-50 text-amber-600 border border-amber-100",
    },
  ];

  const quickActions = [
    { icon: Target, label: "Find Jobs", iconBg: "bg-blue-50 text-blue-600 border border-blue-100", href: "/dashboard/jobs/linkedin" },
    { icon: Briefcase, label: "Apply Now", iconBg: "bg-purple-50 text-purple-600 border border-purple-100", href: "/dashboard/jobs/linkedin" },
    { icon: Zap, label: "Resume Check", iconBg: "bg-emerald-50 text-emerald-600 border border-emerald-100", href: "/dashboard/resume" },
    { icon: Users, label: "Live AI Interview", iconBg: "bg-amber-50 text-amber-600 border border-amber-100", href: "/dashboard/interview" },
  ];

  return (
    <div className="space-y-4">
      <DashboardPromoBanner />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {/* Left Column: Recent Applications with Infinite Scroll */}
      <div className="lg:col-span-7 xl:col-span-7 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-xl p-4 border border-gray-200/80 shadow-xs"
        >
          <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Recent Applications</h2>
              {displayItems.length > 0 && (
                <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full font-bold">
                  {displayItems.length}
                </span>
              )}
            </div>
            <button
              onClick={() => navigate("/dashboard/applications")}
              className="text-purple-600 hover:text-purple-700 font-semibold text-xs flex items-center gap-1 transition-colors"
            >
              View All
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div
            className="space-y-2 max-h-[560px] overflow-y-auto pr-1 scroll-smooth"
            onScroll={handleScroll}
          >
            {loadingInitial && displayItems.length === 0 ? (
              <div className="text-xs text-gray-400 py-6 text-center flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                <span>Loading applications...</span>
              </div>
            ) : null}

            {fetchError && displayItems.length === 0 ? (
              <div className="text-xs text-rose-600 py-4 text-center">{fetchError}</div>
            ) : null}

            {!loadingInitial && displayItems.length === 0 ? (
              <div className="text-xs text-gray-500 py-6 text-center">
                No applications yet. Start your first auto-apply run.
              </div>
            ) : null}

            {displayItems.map((app) => (
              <div
                key={app.id}
                className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:bg-purple-50/40 hover:border-purple-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 flex items-center justify-center font-bold text-xs text-purple-700 shrink-0">
                    {app.company.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-gray-900 truncate">{app.position}</div>
                    <div className="text-[11px] text-gray-500 truncate">{app.company}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!app.sourceUrl}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!app.sourceUrl) return;
                          window.open(app.sourceUrl, "_blank", "noopener,noreferrer");
                        }}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                          app.sourceUrl
                            ? "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            : "bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                        title={app.sourceUrl ? `Open on ${app.sourceLabel}` : `${app.sourceLabel} link not available for this item`}
                      >
                        <ExternalLink className="w-3 h-3" />
                        {app.sourceLabel}
                      </button>
                      <button
                        type="button"
                        disabled={!app.externalJobId}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!app.externalJobId) return;
                          try {
                            await navigator.clipboard.writeText(app.externalJobId);
                            setCopiedJobId(app.externalJobId);
                            window.setTimeout(() => setCopiedJobId(""), 1200);
                          } catch {
                            // ignore
                          }
                        }}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                          app.externalJobId
                            ? "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            : "bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                        title={app.externalJobId ? `Copy ${app.sourceLabel} Job ID` : "Job ID not available for this item"}
                      >
                        {copiedJobId === app.externalJobId ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-500" />
                        )}
                        {copiedJobId === app.externalJobId ? "Copied" : "Copy ID"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 ml-2">
                  <div className="text-center hidden sm:block">
                    <div className="text-xs font-semibold text-gray-800">{app.match ?? "-"}</div>
                    <div className="text-[10px] text-gray-400">Match</div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        app.status === "Submitted"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : app.status === "Queued" || app.status === "Running"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : app.status === "Cancelled"
                          ? "bg-gray-100 text-gray-700"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}
                    >
                      {app.status}
                    </span>
                    <div className="text-[10px] text-gray-400 mt-0.5">{app.date}</div>
                  </div>
                </div>
              </div>
            ))}

            {/* Loading More Indicator */}
            {loadingMore && (
              <div className="py-2.5 flex items-center justify-center gap-2 text-xs text-purple-600 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Loading more...</span>
              </div>
            )}

            {/* End of list */}
            {!hasMore && displayItems.length > 0 && (
              <div className="py-2 text-center text-[10px] text-gray-400 font-medium border-t border-gray-50 mt-2">
                All applications loaded ({displayItems.length})
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Right Column: Header, 4 Stat Cards, Quick Actions, Upcoming Interviews & Pro Tip */}
      <div className="lg:col-span-5 xl:col-span-5 space-y-4">
        {/* Header Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-xl p-3.5 border border-gray-200/80 shadow-xs"
        >
          <h1 className="text-base font-bold text-gray-900 leading-tight">Welcome back, {user?.name || "User"}!</h1>
          <p className="text-xs text-gray-500 mt-0.5">Here is what is happening with your job search today.</p>
        </motion.div>

        {/* 4 Stats Cards in 2x2 Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="bg-white rounded-xl p-3 border border-gray-200/80 shadow-xs hover:border-purple-200 hover:shadow-xs transition-all"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className={`w-7 h-7 rounded-lg ${stat.iconBg} flex items-center justify-center shadow-2xs`}>
                  <stat.icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[9px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-md truncate max-w-[85px] border border-emerald-100">
                  {stat.change}
                </span>
              </div>
              <div className="text-lg font-bold text-gray-900 leading-tight">{stat.value}</div>
              <div className="text-[11px] text-gray-500 font-medium truncate mt-0.5">{stat.name}</div>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
          className="bg-white rounded-xl p-3.5 border border-gray-200/80 shadow-xs"
        >
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2.5 pb-1.5 border-b border-gray-100">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => navigate(action.href)}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-purple-50/50 hover:border-purple-200 transition-all text-center group"
              >
                <div className={`w-7 h-7 rounded-lg ${action.iconBg} flex items-center justify-center mb-1 shadow-xs transition-transform group-hover:scale-105`}>
                  <action.icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-semibold text-gray-800 leading-tight">{action.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Upcoming Interviews */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="bg-gradient-to-br from-purple-50/90 via-indigo-50/50 to-blue-50/40 rounded-xl p-3.5 text-gray-900 border border-purple-200/80 shadow-xs"
        >
          <div className="flex items-center gap-2 mb-2.5">
            <span className="p-1 rounded-md bg-purple-100 text-purple-700">
              <Calendar className="w-3.5 h-3.5" />
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-950">Upcoming Interviews</h3>
          </div>
          <div className="space-y-2">
            <div className="bg-white/80 rounded-lg p-2.5 border border-purple-100 shadow-2xs">
              <div className="text-xs font-bold text-gray-900 mb-0.5">{summary.interview.title}</div>
              <div className="text-[11px] text-gray-600 mb-2 leading-relaxed">{summary.interview.body}</div>
              <div className="flex items-center gap-1.5 text-[11px] text-purple-700 font-semibold">
                <Clock className="w-3.5 h-3.5" />
                <span>{summary.metrics.interviewReadiness}% interview readiness</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate(summary.interview.ctaHref)}
            className="w-full mt-2.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
          >
            {summary.interview.ctaLabel}
          </button>
        </motion.div>

        {/* Pro Tip Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
          className="bg-white rounded-xl p-3.5 border border-gray-200/80 shadow-xs"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-5 h-5 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Star className="w-3 h-3" />
            </div>
            <h3 className="text-xs font-bold text-gray-900">{summary.proTip.title}</h3>
          </div>
          <p className="text-xs text-gray-600 mb-2.5 leading-relaxed">{summary.proTip.body}</p>
          <button
            onClick={() => navigate(summary.proTip.ctaHref)}
            className="text-purple-600 hover:text-purple-700 font-semibold text-xs flex items-center gap-1"
          >
            {summary.proTip.ctaLabel}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      </div>

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
      </div>
    </div>
  );
}
