import { useState } from "react";
import { useNavigate } from "react-router";
import { Bell, User, LogOut, RefreshCw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [notifications, setNotifications] = useState({
    email: true,
    product: true,
    jobAlerts: true,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">Settings</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage your account and dashboard preferences.</p>
        </div>
        <button
          onClick={() => void refreshUser()}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh User
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-4">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User className="w-4 h-4 text-purple-600" />
              Account Snapshot
            </h2>
            <div className="grid md:grid-cols-2 gap-3 text-xs">
              <div className="p-2 bg-gray-50/50 rounded-lg border border-gray-100">
                <div className="text-gray-400 text-[10px] uppercase font-bold">Name</div>
                <div className="font-semibold text-gray-900 mt-0.5">{user?.name || "-"}</div>
              </div>
              <div className="p-2 bg-gray-50/50 rounded-lg border border-gray-100">
                <div className="text-gray-400 text-[10px] uppercase font-bold">Email</div>
                <div className="font-semibold text-gray-900 mt-0.5 truncate">{user?.email || "-"}</div>
              </div>
              <div className="p-2 bg-gray-50/50 rounded-lg border border-gray-100">
                <div className="text-gray-400 text-[10px] uppercase font-bold">Phone</div>
                <div className="font-semibold text-gray-900 mt-0.5">{user?.phone || "-"}</div>
              </div>
              <div className="p-2 bg-gray-50/50 rounded-lg border border-gray-100">
                <div className="text-gray-400 text-[10px] uppercase font-bold">Plan</div>
                <div className="font-semibold text-gray-900 capitalize mt-0.5">{user?.plan || "-"}</div>
              </div>
              <div className="p-2 bg-gray-50/50 rounded-lg border border-gray-100">
                <div className="text-gray-400 text-[10px] uppercase font-bold">User ID</div>
                <div className="font-semibold font-mono text-gray-900 mt-0.5 break-all select-all">{user?.id || "-"}</div>
              </div>
              <div className="p-2 bg-gray-50/50 rounded-lg border border-gray-100">
                <div className="text-gray-400 text-[10px] uppercase font-bold">Onboarding</div>
                <div className="font-semibold text-gray-900 mt-0.5">{user?.onboardingCompleted ? "Completed" : "Pending"}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-4">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-purple-600" />
              Notification Preferences
            </h2>
            <div className="space-y-2">
              {[
                { key: "email", label: "Email notifications" },
                { key: "product", label: "Product updates" },
                { key: "jobAlerts", label: "Job alerts" },
              ].map((item) => (
                <label key={item.key} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2 bg-gray-50/30 hover:bg-gray-50 cursor-pointer transition-colors">
                  <span className="text-xs text-gray-700">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={notifications[item.key as keyof typeof notifications]}
                    onChange={(e) => setNotifications((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-red-200/80 shadow-xs p-4">
            <h2 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">Session</h2>
            <button
              onClick={() => logout()}
              className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigate("/dashboard/profile")}
            className="w-full text-left p-3.5 bg-white hover:bg-purple-50/50 rounded-xl border border-gray-200/80 shadow-xs transition-colors"
          >
            <div className="font-semibold text-xs text-gray-900">Edit Profile</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Update personal details and resume files.</div>
          </button>
          <button
            onClick={() => navigate("/dashboard/billing")}
            className="w-full text-left p-3.5 bg-white hover:bg-purple-50/50 rounded-xl border border-gray-200/80 shadow-xs transition-colors"
          >
            <div className="font-semibold text-xs text-gray-900">Manage Billing</div>
            <div className="text-[11px] text-gray-500 mt-0.5">View your current plan and top up hires.</div>
          </button>
        </div>
      </div>
    </div>
  );
}
