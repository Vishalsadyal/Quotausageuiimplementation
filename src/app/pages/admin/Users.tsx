import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronLeft, ChevronRight, Monitor, Pencil, RefreshCw, Search, Trash2, UserCheck, Users as UsersIcon, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ONBOARDING_TOTAL_STEPS, onboardingStepLabel } from "src/lib/onboarding";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "user" | "admin";
  plan: "free" | "pro" | "coach" | "connect";
  quotaUsed: number;
  quotaTotal: number;
  hireBalance: number;
  hireSpent: number;
  hirePurchased: number;
  dailyHireUsed: number;
  dailyHireCap: number;
  createdAt: string;
  updatedAt: string;
  registerMethod?: "google" | "email" | "resume_upload" | "unknown";
  onboardingCompleted: boolean;
  onboardingStep: number | null;
  onboardingStepAt: string | null;
  hasResume: boolean;
  lastSeenAt: string | null;
  online: boolean;
  lastDevice: string | null;
  activeSessions: number;
};

type UsersSummary = { total: number; onlineNow: number; activeToday: number; onboardingDone: number; onboardingInProgress: number };

type UserSession = {
  id: string;
  status: "active" | "revoked" | "expired";
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  viewedByAdmin: boolean;
};

type EditUserForm = {
  name: string;
  email: string;
  phone: string;
  role: AdminUser["role"];
  plan: AdminUser["plan"];
  quotaTotal: string;
  quotaUsed: string;
  hireBalance: string;
  dailyHireCap: string;
  dailyHireUsed: string;
};

const PAGE_SIZE = 50;

// "5 min ago", "3 h ago", "2 days ago", then a date.
function timeAgo(iso: string | null) {
  if (!iso) return "";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d > 1 ? "s" : ""} ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// A short device name from the browser's user agent, e.g. "Chrome · Windows".
function deviceLabel(ua: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
    ? "Opera"
    : /Chrome\//.test(ua)
    ? "Chrome"
    : /Firefox\//.test(ua)
    ? "Firefox"
    : /Safari\//.test(ua)
    ? "Safari"
    : "Browser";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X/.test(ua)
    ? "Mac"
    : /Linux/.test(ua)
    ? "Linux"
    : "";
  return os ? `${browser} · ${os}` : browser;
}

const sessionStatusClass: Record<UserSession["status"], string> = {
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  revoked: "bg-gray-100 text-gray-600 border-gray-200",
  expired: "bg-amber-100 text-amber-800 border-amber-200",
};

const registerMethodLabel: Record<NonNullable<AdminUser["registerMethod"]>, { label: string; className: string }> = {
  google: { label: "Google", className: "bg-blue-100 text-blue-800 border-blue-200" },
  email: { label: "Email", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  resume_upload: { label: "Resume upload", className: "bg-teal-100 text-teal-800 border-teal-200" },
  unknown: { label: "Unknown", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

const planBadgeClass: Record<AdminUser["plan"], string> = {
  free: "bg-gray-100 text-gray-700 border-gray-200",
  pro: "bg-violet-100 text-violet-800 border-violet-200",
  coach: "bg-amber-100 text-amber-800 border-amber-200",
  connect: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
};

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [activity, setActivity] = useState("");
  const [onboarding, setOnboarding] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMatching, setTotalMatching] = useState(0);
  const [summary, setSummary] = useState<UsersSummary | null>(null);
  const [sessionsUser, setSessionsUser] = useState<AdminUser | null>(null);
  const [sessions, setSessions] = useState<UserSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { startImpersonation } = useAuth();
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<EditUserForm>({
    name: "",
    email: "",
    phone: "",
    role: "user",
    plan: "free",
    quotaTotal: "0",
    quotaUsed: "0",
    hireBalance: "0",
    dailyHireCap: "3",
    dailyHireUsed: "0",
  });

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search.trim()) params.set("search", search.trim());
      if (activity) params.set("activity", activity);
      if (onboarding) params.set("onboarding", onboarding);
      const res = await fetch(`/api/admin/users?${params.toString()}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to fetch users");
      setUsers(data?.data?.users || []);
      setSummary(data?.data?.summary || null);
      setTotalPages(Math.max(1, data?.data?.pagination?.totalPages || 1));
      setTotalMatching(data?.data?.pagination?.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  // Typing in search waits 400 ms; filter and page changes load at once (the first load included).
  const searchMountedRef = useRef(false);
  useEffect(() => {
    if (!searchMountedRef.current) {
      searchMountedRef.current = true;
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      void loadUsers();
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, activity, onboarding]);

  const openSessions = async (user: AdminUser) => {
    setSessionsUser(user);
    setSessions(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/sessions`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to fetch sessions");
      setSessions(data?.data?.sessions || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch sessions");
      setSessionsUser(null);
    }
  };

  const impersonateUser = async (user: AdminUser) => {
    const confirmed = window.confirm(`Log in as ${user.email}? You'll see their dashboard and can return to admin from the banner.`);
    if (!confirmed) return;

    try {
      setImpersonatingUserId(user.id);
      setError("");
      await startImpersonation(user.id);
      navigate("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to impersonate user");
      setImpersonatingUserId(null);
    }
  };

  const deleteUser = async (user: AdminUser) => {
    const confirmed = window.confirm(`Delete user ${user.email}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      setDeletingUserId(user.id);
      setError("");
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to delete user");
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete user");
    } finally {
      setDeletingUserId(null);
    }
  };

  const openEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setEditForm({
      name: String(user.name || ""),
      email: String(user.email || ""),
      phone: String(user.phone || ""),
      role: user.role,
      plan: user.plan,
      quotaTotal: String(user.quotaTotal ?? 0),
      quotaUsed: String(user.quotaUsed ?? 0),
      hireBalance: String(user.hireBalance ?? 0),
      dailyHireCap: String(user.dailyHireCap ?? 3),
      dailyHireUsed: String(user.dailyHireUsed ?? 0),
    });
  };

  const closeEditModal = () => {
    setEditingUser(null);
  };

  const saveUser = async () => {
    if (!editingUser) return;
    const name = editForm.name.trim();
    const email = editForm.email.trim().toLowerCase();
    const quotaTotal = Number(editForm.quotaTotal);
    const quotaUsed = Number(editForm.quotaUsed);
    const hireBalance = Number(editForm.hireBalance);
    const dailyHireCap = Number(editForm.dailyHireCap);
    const dailyHireUsed = Number(editForm.dailyHireUsed);

    if (!name) {
      setError("Name is required");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Valid email is required");
      return;
    }
    if (!Number.isFinite(quotaTotal) || quotaTotal < 0) {
      setError("Quota total must be 0 or higher");
      return;
    }
    if (!Number.isFinite(quotaUsed) || quotaUsed < 0 || quotaUsed > quotaTotal) {
      setError("Quota used must be between 0 and quota total");
      return;
    }
    if (!Number.isFinite(hireBalance) || hireBalance < 0) {
      setError("Hire balance must be 0 or higher");
      return;
    }
    if (!Number.isFinite(dailyHireCap) || dailyHireCap < 1) {
      setError("Daily cap must be at least 1");
      return;
    }
    if (!Number.isFinite(dailyHireUsed) || dailyHireUsed < 0 || dailyHireUsed > dailyHireCap) {
      setError("Daily used must be between 0 and daily cap");
      return;
    }

    try {
      setSavingUserId(editingUser.id);
      setError("");
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: editForm.phone.trim() || undefined,
          role: editForm.role,
          plan: editForm.plan,
          quotaTotal: Math.floor(quotaTotal),
          quotaUsed: Math.floor(quotaUsed),
          hireBalance: Math.floor(hireBalance),
          dailyHireCap: Math.floor(dailyHireCap),
          dailyHireUsed: Math.floor(dailyHireUsed),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to update user");

      const updated = data?.data?.user as AdminUser | undefined;
      if (updated) {
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
      } else {
        await loadUsers();
      }
      setEditingUser(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update user");
    } finally {
      setSavingUserId(null);
    }
  };

  const filtered = users;

  const stats = useMemo(
    () => [
      { label: "Total Users", value: summary?.total ?? 0 },
      { label: "Online now", value: summary?.onlineNow ?? 0, dot: true },
      { label: "Active (24 h)", value: summary?.activeToday ?? 0 },
      { label: "Onboarding done", value: summary?.onboardingDone ?? 0, hint: `${summary?.onboardingInProgress ?? 0} left in between` },
    ],
    [summary],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide">
              <UsersIcon className="h-3.5 w-3.5" />
              ADMIN USERS
            </div>
            <h1 className="mt-3 text-3xl font-bold">User Management</h1>
            <p className="mt-1 text-indigo-100">Manage accounts, plans, and user access from one place.</p>
          </div>
          <button
            onClick={() => void loadUsers()}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/20"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-indigo-100">
                {stat.dot ? <span className="h-2 w-2 rounded-full bg-emerald-400" /> : null}
                {stat.label}
              </div>
              <div className="mt-1 text-2xl font-bold">{stat.value}</div>
              {stat.hint ? <div className="text-xs text-indigo-200">{stat.hint}</div> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, email or phone"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:bg-white"
          />
        </div>
        <select
          value={activity}
          onChange={(e) => {
            setActivity(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
        >
          <option value="">Any activity</option>
          <option value="online">Online now</option>
          <option value="today">Active in last 24 h</option>
          <option value="week">Active in last 7 days</option>
          <option value="inactive">Inactive 7+ days</option>
        </select>
        <select
          value={onboarding}
          onChange={(e) => {
            setOnboarding(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
        >
          <option value="">Any onboarding</option>
          <option value="done">Onboarding done</option>
          <option value="in_progress">Left in between</option>
          <option value="not_started">Not started</option>
        </select>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {loading ? <div className="text-sm text-gray-500">Loading users...</div> : null}

      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="bg-gradient-to-r from-gray-50 to-slate-100">
              <tr className="text-xs uppercase tracking-wide text-gray-600">
                <th className="px-4 py-3 text-left font-semibold">User</th>
                <th className="px-4 py-3 text-left font-semibold">Phone</th>
                <th className="px-4 py-3 text-left font-semibold">Last seen</th>
                <th className="px-4 py-3 text-left font-semibold">Onboarding</th>
                <th className="px-4 py-3 text-left font-semibold">Register method</th>
                <th className="px-4 py-3 text-left font-semibold">Plan</th>
                <th className="px-4 py-3 text-left font-semibold">Hires</th>
                <th className="px-4 py-3 text-left font-semibold">Created</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const stepPercent = Math.round(((u.onboardingStep ?? 0) / ONBOARDING_TOTAL_STEPS) * 100);

                return (
                  <tr key={u.id} className="border-t border-gray-100 transition hover:bg-indigo-50/40">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-200 to-cyan-200 font-semibold text-indigo-900">
                          {u.name?.trim()?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 font-semibold text-gray-900">
                            {u.name}
                            {u.role === "admin" ? (
                              <span className="rounded-md border border-indigo-200 bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-800">
                                Admin
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-gray-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-700">{u.phone || "-"}</span>
                    </td>
                    <td className="px-4 py-4">
                      <button type="button" onClick={() => void openSessions(u)} title="See logins and devices" className="group text-left">
                        {u.online ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                            Online
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-gray-800">{u.lastSeenAt ? timeAgo(u.lastSeenAt) : "Never"}</span>
                        )}
                        <div className="mt-0.5 text-xs text-gray-500 group-hover:text-indigo-600 group-hover:underline">
                          {u.lastSeenAt ? deviceLabel(u.lastDevice) : "No login yet"}
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      {u.onboardingCompleted ? (
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          ✓ Done
                        </span>
                      ) : u.onboardingStep ? (
                        <div title={u.onboardingStepAt ? `Reached ${timeAgo(u.onboardingStepAt)}` : undefined}>
                          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-amber-800">Left at: {onboardingStepLabel(u.onboardingStep)}</span>
                            <span className="text-gray-500">
                              {u.onboardingStep}/{ONBOARDING_TOTAL_STEPS}
                            </span>
                          </div>
                          <div className="h-2 w-40 overflow-hidden rounded-full bg-gray-200">
                            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${stepPercent}%` }} />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="inline-flex rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                            Not started
                          </span>
                          {u.hasResume ? <div className="mt-0.5 text-xs text-gray-500">Resume uploaded</div> : null}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {(() => {
                        const method = registerMethodLabel[u.registerMethod ?? "unknown"];
                        return (
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${method.className}`}>
                            {method.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${planBadgeClass[u.plan]}`}>
                        {u.plan}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-gray-900">{u.hireBalance} available</div>
                      <div className="text-xs text-gray-500">spent {u.hireSpent} | purchased {u.hirePurchased}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-800">{new Date(u.createdAt).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500">{new Date(u.createdAt).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditUser(u)}
                          disabled={savingUserId === u.id || deletingUserId === u.id}
                          title="Edit user"
                          aria-label={`Edit ${u.name}`}
                          className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {u.role === "user" && (
                          <button
                            onClick={() => void impersonateUser(u)}
                            disabled={impersonatingUserId !== null}
                            title={impersonatingUserId === u.id ? "Opening..." : "Impersonate user"}
                            aria-label={`Impersonate ${u.name}`}
                            className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {impersonatingUserId === u.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => void deleteUser(u)}
                          disabled={deletingUserId === u.id || savingUserId === u.id}
                          title={deletingUserId === u.id ? "Deleting..." : "Delete user"}
                          aria-label={`Delete ${u.name}`}
                          className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingUserId === u.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 text-sm">
          <span className="text-gray-500">
            {totalMatching === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(totalMatching, page * PAGE_SIZE)} of {totalMatching} users
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <span className="text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {sessionsUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" onClick={() => setSessionsUser(null)}>
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Logins &amp; devices</h2>
                <p className="text-sm text-gray-500">{sessionsUser.email}</p>
              </div>
              <button
                onClick={() => setSessionsUser(null)}
                className="rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
              {sessions === null ? (
                <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
              ) : sessions.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">This user has never logged in.</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {sessions.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                      <div className="flex items-start gap-3">
                        <Monitor className="mt-0.5 h-4 w-4 text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-900">
                            {deviceLabel(s.userAgent)}
                            {s.viewedByAdmin ? <span className="ml-2 text-xs font-semibold text-amber-700">(admin view as user)</span> : null}
                          </div>
                          <div className="text-xs text-gray-500">
                            Logged in {new Date(s.createdAt).toLocaleString("en-IN")}
                            {s.ipAddress ? ` · IP ${s.ipAddress}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${sessionStatusClass[s.status]}`}>
                          {s.status === "revoked" ? "Logged out" : s.status}
                        </span>
                        <div className="mt-0.5 text-xs text-gray-500">Last active {timeAgo(s.lastUsedAt)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {editingUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Edit User</h2>
                <p className="text-sm text-gray-500">{editingUser.email}</p>
              </div>
              <button
                onClick={closeEditModal}
                className="rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-50"
                aria-label="Close edit modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
              <label className="text-sm text-gray-700">
                <div className="mb-1 font-semibold">Name</div>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-indigo-400"
                />
              </label>

              <label className="text-sm text-gray-700">
                <div className="mb-1 font-semibold">Email</div>
                <input
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-indigo-400"
                />
              </label>

              <label className="text-sm text-gray-700">
                <div className="mb-1 font-semibold">Phone</div>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-indigo-400"
                  placeholder="+1 555 123 4567"
                />
              </label>

              <label className="text-sm text-gray-700">
                <div className="mb-1 font-semibold">Role</div>
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, role: e.target.value as AdminUser["role"] }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-indigo-400"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </label>

              <label className="text-sm text-gray-700">
                <div className="mb-1 font-semibold">Plan</div>
                <select
                  value={editForm.plan}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, plan: e.target.value as AdminUser["plan"] }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-indigo-400"
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="coach">Coach</option>
                  <option value="connect">Pro Connect</option>
                </select>
              </label>

              <label className="text-sm text-gray-700">
                <div className="mb-1 font-semibold">Quota Total</div>
                <input
                  type="number"
                  min={0}
                  value={editForm.quotaTotal}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, quotaTotal: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-indigo-400"
                />
              </label>

              <label className="text-sm text-gray-700">
                <div className="mb-1 font-semibold">Quota Used</div>
                <input
                  type="number"
                  min={0}
                  value={editForm.quotaUsed}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, quotaUsed: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-indigo-400"
                />
              </label>

              <label className="text-sm text-gray-700">
                <div className="mb-1 font-semibold">Hire Balance</div>
                <input
                  type="number"
                  min={0}
                  value={editForm.hireBalance}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, hireBalance: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-indigo-400"
                />
              </label>

              <label className="text-sm text-gray-700">
                <div className="mb-1 font-semibold">Daily Hire Cap</div>
                <input
                  type="number"
                  min={1}
                  value={editForm.dailyHireCap}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, dailyHireCap: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-indigo-400"
                />
              </label>

              <label className="text-sm text-gray-700 md:col-span-2">
                <div className="mb-1 font-semibold">Daily Hire Used</div>
                <input
                  type="number"
                  min={0}
                  value={editForm.dailyHireUsed}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, dailyHireUsed: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-indigo-400"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button
                onClick={closeEditModal}
                disabled={savingUserId === editingUser.id}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => void saveUser()}
                disabled={savingUserId === editingUser.id}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {savingUserId === editingUser.id ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
