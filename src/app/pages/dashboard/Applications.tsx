import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Search,
  Calendar,
  FileText,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  LayoutGrid,
  List,
  Bot,
  Sparkles,
  Zap,
} from "lucide-react";
import { useExtensionPipelineStats } from "../../hooks/useExtensionPipelineStats";
import { buildJobSourceUrl, cleanJobText, inferJobProvider, jobProviderLabel, parseExternalJobId } from "src/lib/job-source";
import MagicAiDecisionModal, { MagicAiJobContext } from "../../components/jobs/MagicAiDecisionModal";

type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "dead_letter";
type DisplayStatus = JobStatus | "skipped";
type View = "kanban" | "list";

type Job = {
  id: string;
  status: JobStatus;
  createdAt: string;
  errorMessage?: string | null;
  criteriaJson?: Record<string, unknown>;
};

type PreparedJob = Job & {
  title: string;
  company: string;
  reason: string;
  provider: "linkedin" | "indeed";
  sourceLabel: string;
  sourceUrl: string;
  externalJobId: string;
  displayStatus: DisplayStatus;
  createdLabel: string;
};

type ColumnDef = {
  id: JobStatus;
  title: string;
  badgeClass: string;
  borderClass: string;
  panelClass: string;
};

const columns: ColumnDef[] = [
  {
    id: "queued",
    title: "Queued",
    badgeClass: "text-violet-700 bg-violet-100 border-violet-200",
    borderClass: "border-violet-200",
    panelClass: "bg-violet-50/60",
  },
  {
    id: "running",
    title: "Running",
    badgeClass: "text-sky-700 bg-sky-100 border-sky-200",
    borderClass: "border-sky-200",
    panelClass: "bg-sky-50/60",
  },
  {
    id: "succeeded",
    title: "Submitted",
    badgeClass: "text-emerald-700 bg-emerald-100 border-emerald-200",
    borderClass: "border-emerald-200",
    panelClass: "bg-emerald-50/60",
  },
  {
    id: "cancelled",
    title: "Skipped",
    badgeClass: "text-amber-700 bg-amber-100 border-amber-200",
    borderClass: "border-amber-200",
    panelClass: "bg-amber-50/60",
  },
  {
    id: "failed",
    title: "Failed",
    badgeClass: "text-rose-700 bg-rose-100 border-rose-200",
    borderClass: "border-rose-200",
    panelClass: "bg-rose-50/60",
  },
  {
    id: "dead_letter",
    title: "Dead Letter",
    badgeClass: "text-red-700 bg-red-100 border-red-200",
    borderClass: "border-red-200",
    panelClass: "bg-red-50/60",
  },
];

const STATUS_BADGES: Record<DisplayStatus, string> = {
  queued: "text-violet-700 bg-violet-100 border-violet-200",
  running: "text-sky-700 bg-sky-100 border-sky-200",
  succeeded: "text-emerald-700 bg-emerald-100 border-emerald-200",
  failed: "text-rose-700 bg-rose-100 border-rose-200",
  cancelled: "text-amber-700 bg-amber-100 border-amber-200",
  skipped: "text-amber-700 bg-amber-100 border-amber-200",
  dead_letter: "text-red-700 bg-red-100 border-red-200",
};

const REASON_CODE_LABELS: Record<string, string> = {
  NO_APPLY_BUTTON: "No Easy Apply button",
  APPLIED_CACHE_HIT: "Already applied earlier",
  RECENTLY_RETRIED: "Skipped: recently retried",
  EASY_APPLY_MODAL_MISSING: "Easy Apply form not opened",
  MAX_SKIPS_REACHED: "Skipped: max skips reached",
  REQUIRED_CUSTOM_FIELDS: "Pending user input",
  PENDING_USER_INPUT: "Pending user input",
};

function formatReasonCode(value: unknown) {
  const raw = cleanJobText(value);
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (REASON_CODE_LABELS[upper]) return REASON_CODE_LABELS[upper];
  return raw
    .toLowerCase()
    .split(/[_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeJobTitle(value: unknown) {
  let text = cleanJobText(value);
  if (!text) return "Auto-Apply Job";
  text = text.replace(/\s+with verification$/i, "");
  const doubledNoSpace = text.match(/^(.{4,}?)\1$/i);
  if (doubledNoSpace?.[1]) text = cleanJobText(doubledNoSpace[1]);
  const doubledWithSpace = text.match(/^(.{4,}?)\s+\1$/i);
  if (doubledWithSpace?.[1]) text = cleanJobText(doubledWithSpace[1]);
  return text || "Auto-Apply Job";
}

function getJobReason(job: Job) {
  const code = cleanJobText(job.criteriaJson?.reasonCode);
  const explicit = cleanJobText(job.criteriaJson?.reason || job.errorMessage);
  if (code) return formatReasonCode(code);
  if (explicit) return explicit;
  return "";
}

function getDisplayStatus(job: Job): DisplayStatus {
  if (job.status === "cancelled") return "skipped";
  return job.status;
}

function statusLabel(value: DisplayStatus) {
  if (value === "succeeded") return "submitted";
  if (value === "dead_letter") return "dead letter";
  return value;
}

function JobActions({
  sourceUrl,
  sourceLabel,
  externalJobId,
  copiedJobId,
  onCopy,
  compact = false,
}: {
  sourceUrl: string;
  sourceLabel: string;
  externalJobId: string;
  copiedJobId: string;
  onCopy: (jobId: string) => Promise<void>;
  compact?: boolean;
}) {
  const isCopied = copiedJobId === externalJobId;
  const sizeClass = compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-xs";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={!sourceUrl}
        onClick={() => {
          if (!sourceUrl) return;
          window.open(sourceUrl, "_blank", "noopener,noreferrer");
        }}
        className={`inline-flex items-center gap-1.5 rounded-lg border font-semibold transition-colors ${sizeClass} ${
          sourceUrl
            ? "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            : "bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed"
        }`}
        title={sourceUrl ? `Open on ${sourceLabel}` : `${sourceLabel} link not available`}
      >
        <ExternalLink className="w-3.5 h-3.5" />
        {sourceLabel}
      </button>

      <button
        type="button"
        disabled={!externalJobId}
        onClick={() => void onCopy(externalJobId)}
        className={`inline-flex items-center gap-1.5 rounded-lg border font-semibold transition-colors ${sizeClass} ${
          externalJobId
            ? "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            : "bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed"
        }`}
        title={externalJobId ? `Copy ${sourceLabel} Job ID` : "Job ID not available"}
      >
        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        {isCopied ? "Copied" : "Copy ID"}
      </button>
    </div>
  );
}

export default function Applications() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<View>("kanban");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedJobId, setCopiedJobId] = useState("");
  const extensionStats = useExtensionPipelineStats();
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [modalJob, setModalJob] = useState<MagicAiJobContext | null>(null);

  const openAiIntervention = (job?: PreparedJob | null) => {
    if (job) {
      setModalJob({
        id: job.id,
        title: job.title,
        company: job.company,
        location: "Remote / Hybrid",
        reason: job.reason || (job.displayStatus === "skipped" ? "Criteria Mismatch" : "Missing required skill tags"),
        status: job.status,
        matchScore: job.status === "succeeded" ? 98 : job.status === "cancelled" ? 68 : 78,
      });
    } else {
      setModalJob({
        title: "Senior Fullstack Engineer",
        company: "AutoApply Network",
        location: "Remote",
        reason: "TypeScript, GraphQL & Cloud Infrastructure",
        matchScore: 82,
      });
    }
    setIsAiModalOpen(true);
  };

  const loadInFlightRef = useRef(false);

  const load = async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/auto-apply/jobs");
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to fetch applications");
      setJobs((data?.data?.jobs || []) as Job[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch applications");
    } finally {
      loadInFlightRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const onImported = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };
    window.addEventListener("cp:extensionImported", onImported);
    return () => window.removeEventListener("cp:extensionImported", onImported);
  }, []);

  const prepared = useMemo<PreparedJob[]>(() => {
    return jobs.map((job) => {
      const provider = inferJobProvider(job.criteriaJson);
      const sourceUrl = buildJobSourceUrl(job.criteriaJson, provider);
      return {
        ...job,
        title: normalizeJobTitle(job.criteriaJson?.title || job.criteriaJson?.keywords),
        company: cleanJobText(job.criteriaJson?.company) || jobProviderLabel(provider),
        reason: getJobReason(job),
        provider,
        sourceLabel: jobProviderLabel(provider),
        sourceUrl,
        externalJobId:
          parseExternalJobId(job.criteriaJson?.jobId, provider) ||
          parseExternalJobId(job.criteriaJson?.externalJobId, provider) ||
          parseExternalJobId(sourceUrl, provider),
        displayStatus: getDisplayStatus(job),
        createdLabel: new Date(job.createdAt).toLocaleDateString(),
      };
    });
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return prepared;
    return prepared.filter((job) => {
      return (
        job.id.toLowerCase().includes(q) ||
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        job.reason.toLowerCase().includes(q) ||
        statusLabel(job.displayStatus).toLowerCase().includes(q) ||
        job.externalJobId.toLowerCase().includes(q)
      );
    });
  }, [prepared, searchQuery]);

  const grouped = useMemo(() => {
    const map: Record<JobStatus, PreparedJob[]> = {
      queued: [],
      running: [],
      succeeded: [],
      failed: [],
      cancelled: [],
      dead_letter: [],
    };
    for (const job of filtered) map[job.status].push(job);
    return map;
  }, [filtered]);

  const summary = useMemo(() => {
    return {
      total: prepared.length,
      submitted: prepared.filter((job) => job.status === "succeeded").length,
      failed: prepared.filter((job) => job.status === "failed" || job.status === "dead_letter").length,
      skipped: prepared.filter((job) => job.status === "cancelled").length,
    };
  }, [prepared]);

  const copyJobId = async (externalJobId: string) => {
    if (!externalJobId) return;
    try {
      await navigator.clipboard.writeText(externalJobId);
      setCopiedJobId(externalJobId);
      window.setTimeout(() => setCopiedJobId(""), 1400);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-2.5"
      >
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">Applications</h1>
          <p className="text-xs text-gray-500 mt-0.5">Real application pipeline from your auto-apply jobs.</p>
          {extensionStats.loaded ? (
            <div className="mt-1.5 inline-flex flex-wrap items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-[11px] text-gray-600">
              <span className="font-semibold text-gray-700">Extension live:</span>
              <span>Applied {extensionStats.applied}</span>
              <span>Skipped {extensionStats.skipped}</span>
              <span>Failed {extensionStats.failed}</span>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openAiIntervention(null)}
            className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5 text-cyan-200" />
            <span>✨ AI Agent Fleet</span>
          </button>
          <button
            onClick={() => void load()}
            className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-xl border border-gray-200/80 bg-white p-3 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, company, status, reason, or job id..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
            />
          </div>
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
            <button
              onClick={() => setView("kanban")}
              className={`px-3 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                view === "kanban" ? "bg-white text-gray-900 shadow-2xs" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Kanban
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                view === "list" ? "bg-white text-gray-900 shadow-2xs" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
          </div>
        </div>
      </motion.div>

      {error ? <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">{error}</div> : null}
      {loading ? <div className="text-xs text-gray-400 py-2">Loading applications...</div> : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="rounded-xl border border-gray-200/80 bg-white p-3 shadow-xs">
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Total Tracked</div>
          <div className="text-lg font-bold text-gray-900 mt-0.5">{summary.total}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 shadow-xs">
          <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-700">Submitted</div>
          <div className="text-lg font-bold text-emerald-800 mt-0.5">{summary.submitted}</div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 shadow-xs">
          <div className="text-[10px] uppercase font-bold tracking-wider text-rose-700">Failed</div>
          <div className="text-lg font-bold text-rose-800 mt-0.5">{summary.failed}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 shadow-xs">
          <div className="text-[10px] uppercase font-bold tracking-wider text-amber-700">Skipped</div>
          <div className="text-lg font-bold text-amber-800 mt-0.5">{summary.skipped}</div>
        </div>
      </div>

      {!loading && view === "kanban" ? (
        <div className="overflow-x-auto pb-1">
          <div className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-4 min-w-max">
            {columns.map((column) => (
              <section key={column.id} className={`rounded-2xl border ${column.borderClass} ${column.panelClass} p-3`}>
                <header className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{column.title}</h3>
                  <span className={`px-2 py-1 text-xs rounded-full border font-semibold ${column.badgeClass}`}>
                    {grouped[column.id].length}
                  </span>
                </header>

                <div className="space-y-3">
                  {grouped[column.id].map((job) => (
                    <article key={job.id} className={`rounded-xl border ${column.borderClass} bg-white p-3 shadow-sm`}>
                      <h4 className="font-semibold text-gray-900 leading-snug">{job.title}</h4>
                      <div className="text-sm text-gray-600 mt-1">{job.company}</div>
                      {job.reason ? (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                          <span className="font-semibold">Reason:</span> {job.reason}
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {job.createdLabel}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${
                            STATUS_BADGES[job.displayStatus]
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {statusLabel(job.displayStatus)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => openAiIntervention(job)}
                          className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-purple-800 border border-purple-200 text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition-all"
                        >
                          <Sparkles className="w-3 h-3 text-yellow-600" />
                          AI Decision
                        </button>
                        <JobActions
                          sourceUrl={job.sourceUrl}
                          sourceLabel={job.sourceLabel}
                          externalJobId={job.externalJobId}
                          copiedJobId={copiedJobId}
                          onCopy={copyJobId}
                          compact
                        />
                      </div>
                    </article>
                  ))}
                  {grouped[column.id].length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-white/70 px-3 py-4 text-sm text-gray-500">
                      No jobs in this stage.
                    </div>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && view === "list" ? (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="md:hidden divide-y divide-gray-100">
            {filtered.map((job) => (
              <article key={job.id} className="p-4 space-y-3">
                <div>
                  <h4 className="font-semibold text-gray-900 leading-snug">{job.title}</h4>
                  <div className="text-sm text-gray-600 mt-1">{job.company}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_BADGES[job.displayStatus]}`}>
                    {statusLabel(job.displayStatus)}
                  </span>
                  <span className="text-xs text-gray-500">{job.createdLabel}</span>
                  {job.externalJobId ? <span className="text-xs text-gray-500">ID: {job.externalJobId}</span> : null}
                </div>

                {job.reason ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                    <span className="font-semibold">Reason:</span> {job.reason}
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => openAiIntervention(job)}
                    className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-yellow-600" />
                    AI Decision
                  </button>
                  <JobActions
                    sourceUrl={job.sourceUrl}
                    sourceLabel={job.sourceLabel}
                    externalJobId={job.externalJobId}
                    copiedJobId={copiedJobId}
                    onCopy={copyJobId}
                  />
                </div>
              </article>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[1040px]">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Job</th>
                  <th className="text-left px-4 py-3">Company</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Reason</th>
                  <th className="text-left px-4 py-3">Created</th>
                  <th className="text-left px-4 py-3">Job ID</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((job) => (
                  <tr key={job.id} className="border-b border-gray-100 text-sm">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[320px] whitespace-normal break-words">{job.title}</td>
                    <td className="px-4 py-3 text-gray-700">{job.company}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_BADGES[job.displayStatus]}`}>
                        {statusLabel(job.displayStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-amber-700 max-w-[280px] whitespace-normal break-words">{job.reason || "-"}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{job.createdLabel}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{job.externalJobId || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openAiIntervention(job)}
                          className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-purple-800 border border-purple-200 text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition-all shrink-0"
                        >
                          <Sparkles className="w-3 h-3 text-yellow-600" />
                          AI Decision
                        </button>
                        <JobActions
                          sourceUrl={job.sourceUrl}
                          sourceLabel={job.sourceLabel}
                          externalJobId={job.externalJobId}
                          copiedJobId={copiedJobId}
                          onCopy={copyJobId}
                          compact
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-500">No applications found for the current search.</div>
          ) : null}
        </div>
      ) : null}

      {/* Magic AI Agent Intervention Decision Modal */}
      <MagicAiDecisionModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        targetJob={modalJob}
        pipelineStats={{
          total: jobs.length,
          submitted: jobs.filter((j) => j.status === "succeeded").length,
          queued: jobs.filter((j) => j.status === "queued" || j.status === "running").length,
          skipped: jobs.filter((j) => j.status === "cancelled").length,
          failed: jobs.filter((j) => j.status === "failed" || j.status === "dead_letter").length,
        }}
        onAutoOptimize={async () => {
          await load();
        }}
        onLaunchAutoApply={async () => {
          await load();
        }}
        onReQueueJob={async () => {
          await load();
        }}
        onSkipJob={async (jobId) => {
          if (jobId) {
            try {
              await fetch(`/api/auto-apply/jobs/${encodeURIComponent(jobId)}/cancel`, { method: "POST" });
              await load();
            } catch (err) {
              console.error("Cancel failed", err);
            }
          }
        }}
        linkedInConnected={true}
      />
    </div>
  );
}
