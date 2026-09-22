import { CalendarCheck2, CircleCheckBig, AlertTriangle, MessagesSquare, RefreshCw } from "lucide-react";
import { useDashboardSummary } from "../../hooks/useDashboardSummary";

export default function Interview() {
  const { summary, loading, error, refresh } = useDashboardSummary();
  const mostRecentRole = summary.recent[0]?.position || "software role";
  const mostRecentCompany = summary.recent[0]?.company || "this company";

  const prepChecklist = [
    {
      title: "Review top applied roles",
      done: summary.applications.submitted > 0,
      help: "Focus on roles where your applications were submitted successfully.",
    },
    {
      title: "Fix recurring application failures",
      done: summary.applications.failed === 0,
      help: "Resolve blockers like invalid phone/city/required fields to increase interview chances.",
    },
    {
      title: "Prepare role-specific intro",
      done: summary.applications.submitted >= 2,
      help: "Create a 60-second summary tailored to your target role.",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight flex items-center gap-2">
            <span>Live AI Interview</span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 tracking-wider">
              BETA
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time AI voice & role-specific interview simulation tailored to your applications.
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {loading ? <div className="text-xs text-gray-400 py-2">Loading interview readiness...</div> : null}
      {error ? <div className="text-xs text-rose-600 py-2">{error}</div> : null}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-gray-200/80 shadow-xs rounded-xl p-3.5">
          <div className="text-[11px] text-gray-500 font-medium">Submitted Jobs</div>
          <div className="text-lg font-bold text-gray-900 mt-0.5">{summary.applications.submitted}</div>
        </div>
        <div className="bg-white border border-gray-200/80 shadow-xs rounded-xl p-3.5">
          <div className="text-[11px] text-gray-500 font-medium">In Progress</div>
          <div className="text-lg font-bold text-gray-900 mt-0.5">{summary.jobs.active}</div>
        </div>
        <div className="bg-white border border-gray-200/80 shadow-xs rounded-xl p-3.5">
          <div className="text-[11px] text-gray-500 font-medium">Failed Jobs</div>
          <div className="text-lg font-bold text-gray-900 mt-0.5">{summary.applications.failed}</div>
        </div>
        <div className="bg-white border border-gray-200/80 shadow-xs rounded-xl p-3.5">
          <div className="text-[11px] text-gray-500 font-medium">Skipped Jobs</div>
          <div className="text-lg font-bold text-gray-900 mt-0.5">{summary.applications.skipped}</div>
        </div>
        <div className="bg-white border border-gray-200/80 shadow-xs rounded-xl p-3.5">
          <div className="text-[11px] text-gray-500 font-medium">Readiness Score</div>
          <div className="text-lg font-bold text-gray-900 mt-0.5">{summary.metrics.interviewReadiness}%</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200/80 shadow-xs rounded-xl p-4">
          <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <CalendarCheck2 className="w-4 h-4 text-purple-600" />
            Interview Checklist
          </h2>
          <div className="space-y-2.5">
            {prepChecklist.map((item) => (
              <div key={item.title} className="border border-gray-100 rounded-lg p-3 bg-gray-50/40">
                <div className="flex items-center gap-2 font-semibold text-xs text-gray-900">
                  {item.done ? <CircleCheckBig className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                  <span>{item.title}</span>
                </div>
                <div className="text-[11px] text-gray-500 mt-1 pl-5.5 leading-relaxed">{item.help}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200/80 shadow-xs rounded-xl p-4">
          <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <MessagesSquare className="w-4 h-4 text-purple-600" />
            Suggested Practice Prompts
          </h2>
          <div className="space-y-2 text-xs text-gray-700">
            <div className="border border-gray-100 rounded-lg p-2.5 bg-gray-50/40">Tell me about yourself for a {mostRecentRole} role.</div>
            <div className="border border-gray-100 rounded-lg p-2.5 bg-gray-50/40">Why do you want to work at {mostRecentCompany}?</div>
            <div className="border border-gray-100 rounded-lg p-2.5 bg-gray-50/40">Describe a challenging bug you fixed and how you debugged it.</div>
            <div className="border border-gray-100 rounded-lg p-2.5 bg-gray-50/40">How do you prioritize tasks when deadlines are tight?</div>
            <div className="border border-gray-100 rounded-lg p-2.5 bg-gray-50/40">Walk me through one project from architecture to delivery.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
