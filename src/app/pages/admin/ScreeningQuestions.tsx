import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw, Search } from "lucide-react";
import { screeningTypeTag } from "src/lib/screening-groups";

type QuestionRow = {
  questionKey: string;
  group: string | null;
  answerType: string;
  questionLabel: string;
  labelVariants: number;
  users: number;
  answered: number;
  pending: number;
  distinctAnswers: number;
  sources: Array<{ source: string; count: number }>;
  topAnswers: Array<{ answer: string; users: number }>;
  lastUpdatedAt: string;
};

type UserAnswer = {
  userId: string;
  userName: string;
  userEmail: string;
  status: "answered" | "pending";
  answer: string;
  source: string;
  updatedAt: string;
};

type UserDetail = { users: UserAnswer[]; total: number; page: number };
type GroupRow = {
  name: string;
  keys: number;
  savedAnswers: number;
  pending: number;
  users: number;
  members: Array<{ questionKey: string; questionLabel: string; users: number; answered: number; topAnswer: string }>;
};
type Totals = {
  questions: number;
  users: number;
  answers: number;
  pending: number;
  groupedKeys: number;
  ungroupedKeys: number;
  groups: number;
  duplicateWordings: number;
};
type Filter = "all" | "pending" | "answered";
type View = "questions" | "groups";
const NO_GROUP = "__none__";

const PAGE_SIZES = [25, 50, 100, 200];
const USER_PAGE_SIZE = 50;

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

export default function ScreeningQuestions() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("questions");
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupFilter, setGroupFilter] = useState("");
  const [openGroup, setOpenGroup] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [openKey, setOpenKey] = useState("");
  const [detail, setDetail] = useState<Record<string, UserDetail | "loading" | "error">>({});

  const totalPages = Math.max(1, Math.ceil(totalQuestions / pageSize));

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize), filter });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (groupFilter) params.set("group", groupFilter);
      const res = await fetch(`/api/admin/screening/questions?${params}`, { credentials: "include" });
      const body = await res.json();
      if (!res.ok || !body?.success) throw new Error(body?.message || "Failed to fetch screening questions");
      setQuestions(body.data.questions || []);
      setGroups(body.data.groups || []);
      setTotals(body.data.totals || null);
      setTotalQuestions(Number(body.data.pagination?.total) || 0);
      setDetail({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch screening questions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // A new search, filter or page size starts again from page 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filter, pageSize, groupFilter]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filter, debouncedSearch, groupFilter]);

  const fetchUsers = async (questionKey: string, userPage: number) => {
    const params = new URLSearchParams({ questionKey, page: String(userPage), limit: String(USER_PAGE_SIZE) });
    const res = await fetch(`/api/admin/screening/questions?${params}`, { credentials: "include" });
    const body = await res.json();
    if (!res.ok || !body?.success) throw new Error(body?.message || "Failed");
    return { users: (body.data.users || []) as UserAnswer[], total: Number(body.data.pagination?.total) || 0 };
  };

  const toggle = async (questionKey: string) => {
    if (openKey === questionKey) {
      setOpenKey("");
      return;
    }
    setOpenKey(questionKey);
    if (typeof detail[questionKey] === "object") return;
    setDetail((prev) => ({ ...prev, [questionKey]: "loading" }));
    try {
      const first = await fetchUsers(questionKey, 1);
      setDetail((prev) => ({ ...prev, [questionKey]: { ...first, page: 1 } }));
    } catch {
      setDetail((prev) => ({ ...prev, [questionKey]: "error" }));
    }
  };

  const loadMoreUsers = async (questionKey: string) => {
    const current = detail[questionKey];
    if (typeof current !== "object") return;
    try {
      const next = await fetchUsers(questionKey, current.page + 1);
      setDetail((prev) => ({
        ...prev,
        [questionKey]: { users: [...current.users, ...next.users], total: next.total, page: current.page + 1 },
      }));
    } catch {
      setError("Could not load more users.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Global Screening Questions Mapping</h1>
          <p className="text-gray-600">Every screening question across all users, with how it is answered</p>
        </div>
        <button
          onClick={() => void load()}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {totals ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Unique questions", value: totals.questions },
            { label: "Users with answers", value: totals.users },
            { label: "Saved answers", value: totals.answers },
            { label: "Pending (unanswered)", value: totals.pending },
            { label: "Related groups", value: totals.groups },
            { label: "Questions in a group", value: totals.groupedKeys },
            { label: "Not in any group", value: totals.ungroupedKeys },
            { label: "Same wording saved twice", value: totals.duplicateWordings },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-2xl border-2 border-gray-200 p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase">{item.label}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{item.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex rounded-xl border-2 border-gray-200 overflow-hidden text-sm font-semibold w-fit">
        {([
          ["questions", "All questions"],
          ["groups", "Related groups"],
        ] as Array<[View, string]>).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setView(value)}
            className={`px-4 py-2 ${view === value ? "bg-purple-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "groups" && totals ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            {totals.groupedKeys} of {totals.questions} questions ask for the same thing as another one and fall into {totals.groups} groups.
            If each group shared one answer, {totals.questions} questions would shrink to about {totals.groups + totals.ungroupedKeys}.
          </p>
          <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
            <div className="hidden md:grid grid-cols-[minmax(0,4fr)_90px_110px_90px] gap-3 px-4 py-3 bg-gray-50 text-xs font-bold text-gray-500 uppercase">
              <div>Group</div>
              <div>Questions</div>
              <div>Saved answers</div>
              <div>Pending</div>
            </div>
            {groups.map((group) => {
              const open = openGroup === group.name;
              return (
                <div key={group.name} className="border-t border-gray-100">
                  <button
                    onClick={() => setOpenGroup(open ? "" : group.name)}
                    className="w-full text-left grid md:grid-cols-[minmax(0,4fr)_90px_110px_90px] gap-3 px-4 py-3 hover:bg-gray-50 items-center"
                  >
                    <div className="flex items-center gap-2 font-semibold text-gray-900 text-sm">
                      {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                      {group.name}
                    </div>
                    <div className="text-sm font-semibold text-gray-900">{group.keys}</div>
                    <div className="text-sm text-gray-700">{group.savedAnswers}</div>
                    <div className={`text-sm font-semibold ${group.pending ? "text-amber-600" : "text-gray-400"}`}>{group.pending}</div>
                  </button>
                  {open ? (
                    <div className="px-4 pb-4 bg-gray-50/60 space-y-2">
                      <div className="overflow-auto rounded-xl border border-gray-200 bg-white max-h-96">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                            <tr>
                              <th className="text-left px-3 py-2">Question</th>
                              <th className="text-left px-3 py-2">Users</th>
                              <th className="text-left px-3 py-2">Answered</th>
                              <th className="text-left px-3 py-2">Top answer</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.members.map((member) => (
                              <tr key={member.questionKey} className="border-t border-gray-100 align-top">
                                <td className="px-3 py-2">
                                  <div className="font-semibold text-gray-900 break-words">{member.questionLabel}</div>
                                  <div className="text-gray-400 font-mono break-all">{member.questionKey}</div>
                                </td>
                                <td className="px-3 py-2">{member.users}</td>
                                <td className="px-3 py-2">{member.answered}</td>
                                <td className="px-3 py-2 text-gray-700 break-words max-w-xs">{member.topAnswer || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button
                        onClick={() => {
                          setGroupFilter(group.name);
                          setView("questions");
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-xs font-semibold text-gray-700"
                      >
                        Open in questions list
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => {
              setGroupFilter(NO_GROUP);
              setView("questions");
            }}
            className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-semibold"
          >
            Show the {totals.ungroupedKeys} questions that are not in any group
          </button>
        </div>
      ) : null}

      {view === "questions" ? (
      <>
      {groupFilter ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 font-semibold">
            {groupFilter === NO_GROUP ? "Not in any group" : `Group: ${groupFilter}`}
          </span>
          <button onClick={() => setGroupFilter("")} className="text-gray-500 hover:text-gray-800 font-semibold">
            Clear
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search question, key or answer"
            className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-gray-200 text-sm outline-none focus:border-purple-400"
          />
        </div>
        <div className="flex rounded-xl border-2 border-gray-200 overflow-hidden text-sm font-semibold">
          {(["all", "pending", "answered"] as Filter[]).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-2 capitalize ${filter === value ? "bg-purple-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="text-red-600 text-sm">{error}</div> : null}
      {loading && !questions.length ? <div className="text-gray-500 text-sm">Loading screening questions...</div> : null}

      <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
        <div className="hidden md:grid grid-cols-[minmax(0,3fr)_80px_90px_80px_minmax(0,3fr)] gap-3 px-4 py-3 bg-gray-50 text-xs font-bold text-gray-500 uppercase">
          <div>Question</div>
          <div>Users</div>
          <div>Answered</div>
          <div>Pending</div>
          <div>Most common answers</div>
        </div>
        {questions.map((row) => {
          const open = openKey === row.questionKey;
          const rows = detail[row.questionKey];
          return (
            <div key={row.questionKey} className="border-t border-gray-100">
              <button
                onClick={() => void toggle(row.questionKey)}
                className="w-full text-left grid md:grid-cols-[minmax(0,3fr)_80px_90px_80px_minmax(0,3fr)] gap-3 px-4 py-3 hover:bg-gray-50 items-start"
              >
                <div className="flex items-start gap-2 min-w-0">
                  {open ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0" /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 text-sm break-words">{row.questionLabel}</div>
                    <div className="text-[11px] text-gray-400 font-mono break-all">
                      {row.questionKey}
                      {row.labelVariants ? ` · ${row.labelVariants + 1} wordings` : ""}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${screeningTypeTag(row.answerType).className}`}>
                        {screeningTypeTag(row.answerType).label}
                      </span>
                      {row.group ? (
                        <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-semibold">
                          {row.group}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {row.sources.map((item) => `${item.source.replace(/_/g, " ")} ${item.count}`).join(" · ")}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-900">{row.users}</div>
                <div className="text-sm text-gray-700">{row.answered}</div>
                <div className={`text-sm font-semibold ${row.pending ? "text-amber-600" : "text-gray-400"}`}>{row.pending}</div>
                <div className="text-xs text-gray-600 space-y-0.5 min-w-0">
                  {row.topAnswers.length ? (
                    row.topAnswers.slice(0, 3).map((item) => (
                      <div key={item.answer} className="truncate">
                        <span className="font-semibold text-gray-800">{item.users}×</span> {item.answer}
                      </div>
                    ))
                  ) : (
                    <span className="text-gray-400">No answers yet</span>
                  )}
                </div>
              </button>

              {open ? (
                <div className="px-4 pb-4 bg-gray-50/60">
                  {rows === "loading" || rows === undefined ? <div className="text-sm text-gray-500 py-3">Loading users...</div> : null}
                  {rows === "error" ? <div className="text-sm text-red-600 py-3">Could not load answers for this question.</div> : null}
                  {rows && typeof rows === "object" ? (
                    <div className="max-h-96 overflow-auto rounded-xl border border-gray-200 bg-white">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                          <tr>
                            <th className="text-left px-3 py-2">User</th>
                            <th className="text-left px-3 py-2">Answer</th>
                            <th className="text-left px-3 py-2">Source</th>
                            <th className="text-left px-3 py-2">Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.users.map((item) => (
                            <tr key={item.userId} className="border-t border-gray-100 align-top">
                              <td className="px-3 py-2">
                                <div className="font-semibold text-gray-900">{item.userName}</div>
                                <div className="text-gray-500">{item.userEmail}</div>
                              </td>
                              <td className="px-3 py-2 text-gray-800 break-words max-w-md">
                                {item.status === "pending" ? <span className="text-amber-600 font-semibold">Pending</span> : item.answer}
                              </td>
                              <td className="px-3 py-2 text-gray-500">{item.source.replace(/_/g, " ")}</td>
                              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatDate(item.updatedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {rows && typeof rows === "object" ? (
                    <div className="flex items-center justify-between pt-2 text-xs text-gray-500">
                      <span>
                        Showing {rows.users.length} of {rows.total} users
                      </span>
                      {rows.users.length < rows.total ? (
                        <button
                          onClick={() => void loadMoreUsers(row.questionKey)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 font-semibold text-gray-700"
                        >
                          Load {Math.min(USER_PAGE_SIZE, rows.total - rows.users.length)} more
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {!loading && !questions.length ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">No screening questions match.</div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span>Questions per page</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-lg border-2 border-gray-200 px-2 py-1 bg-white"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-gray-400">
            {totalQuestions ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalQuestions)} of ${totalQuestions}` : "0 results"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 font-semibold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
      </>
      ) : null}
    </div>
  );
}
