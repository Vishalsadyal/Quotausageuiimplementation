import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Pencil, RefreshCw, Search, Trash2, UserCheck, Users as UsersIcon, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "user" | "admin";
  plan: "free" | "pro" | "coach";
  quotaUsed: number;
  quotaTotal: number;
  hireBalance: number;
  hireSpent: number;
  hirePurchased: number;
  dailyHireUsed: number;
  dailyHireCap: number;
  createdAt: string;
  updatedAt: string;
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

const roleBadgeClass: Record<AdminUser["role"], string> = {
  admin: "bg-indigo-100 text-indigo-800 border-indigo-200",
  user: "bg-slate-100 text-slate-700 border-slate-200",
};

const planBadgeClass: Record<AdminUser["plan"], string> = {
  free: "bg-gray-100 text-gray-700 border-gray-200",
  pro: "bg-violet-100 text-violet-800 border-violet-200",
  coach: "bg-amber-100 text-amber-800 border-amber-200",
};

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
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

  const loadUsers = async (searchQuery?: string) => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/admin/users?${params.toString()}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to fetch users");
      setUsers(data?.data?.users || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      void loadUsers(search || undefined);
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

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

  const adminCount = useMemo(() => users.filter((u) => u.role === "admin").length, [users]);
  const proOrCoachCount = useMemo(
    () => users.filter((u) => u.plan === "pro" || u.plan === "coach").length,
    [users],
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
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-wide text-indigo-100">Total Users</div>
            <div className="mt-1 text-2xl font-bold">{users.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-wide text-indigo-100">Admins</div>
            <div className="mt-1 text-2xl font-bold">{adminCount}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-wide text-indigo-100">Paid Plans</div>
            <div className="mt-1 text-2xl font-bold">{proOrCoachCount}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, plan, role"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:bg-white"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {loading ? <div className="text-sm text-gray-500">Loading users...</div> : null}

      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-gradient-to-r from-gray-50 to-slate-100">
              <tr className="text-xs uppercase tracking-wide text-gray-600">
                <th className="px-4 py-3 text-left font-semibold">User</th>
                <th className="px-4 py-3 text-left font-semibold">Phone</th>
                <th className="px-4 py-3 text-left font-semibold">Role</th>
                <th className="px-4 py-3 text-left font-semibold">Plan</th>
                <th className="px-4 py-3 text-left font-semibold">Daily Usage</th>
                <th className="px-4 py-3 text-left font-semibold">Hires</th>
                <th className="px-4 py-3 text-left font-semibold">Created</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const dailyPercent = Math.min(
                  100,
                  Math.round((u.dailyHireUsed / Math.max(1, u.dailyHireCap)) * 100),
                );

                return (
                  <tr key={u.id} className="border-t border-gray-100 transition hover:bg-indigo-50/40">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-200 to-cyan-200 font-semibold text-indigo-900">
                          {u.name?.trim()?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{u.name}</div>
                          <div className="text-xs text-gray-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-700">{u.phone || "-"}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${roleBadgeClass[u.role]}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${planBadgeClass[u.plan]}`}>
                        {u.plan}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                        <span>Used</span>
                        <span className="font-semibold text-gray-700">
                          {u.dailyHireUsed}/{u.dailyHireCap}
                        </span>
                      </div>
                      <div className="h-2 w-36 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500"
                          style={{ width: `${dailyPercent}%` }}
                        />
                      </div>
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
                          className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        {u.role === "user" && (
                          <button
                            onClick={() => void impersonateUser(u)}
                            disabled={impersonatingUserId !== null}
                            className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 font-medium text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <UserCheck className="h-4 w-4" />
                            {impersonatingUserId === u.id ? "Opening..." : "Impersonate"}
                          </button>
                        )}
                        <button
                          onClick={() => void deleteUser(u)}
                          disabled={deletingUserId === u.id || savingUserId === u.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                          {deletingUserId === u.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

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
