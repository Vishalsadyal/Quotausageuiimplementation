import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import { Mail, KeyRound, Lock, Eye, EyeOff, RefreshCcw } from "lucide-react";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const sendOtp = async () => {
    if (!email.trim()) {
      setErrorMessage("Enter your email first.");
      return;
    }
    try {
      setSendingOtp(true);
      setErrorMessage("");
      setSuccessMessage("");
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "password_reset" }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to send OTP");
      setOtpSent(true);
      setSuccessMessage("OTP sent to your email. Enter it below to reset password.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!otpSent) {
      setErrorMessage("Send OTP first.");
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      setErrorMessage("Enter a valid 6-digit OTP.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, password }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to reset password");
      setSuccessMessage("Password reset successful. Redirecting to login...");
      window.setTimeout(() => navigate("/login"), 1200);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-grid-pattern opacity-40"></div>
      <motion.div
        className="w-full max-w-xl relative"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="glass rounded-3xl shadow-premium-lg p-8 lg:p-10 border-2 border-white">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Forgot Password</h1>
            <p className="text-gray-600">Reset your AutoApply CV account password</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMessage ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
            ) : null}
            {successMessage ? (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMessage}</div>
            ) : null}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => void sendOtp()}
              disabled={sendingOtp}
              className="w-full px-4 py-3 rounded-xl border-2 border-purple-200 bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100 transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              {sendingOtp ? "Sending OTP..." : otpSent ? "Resend OTP" : "Send OTP"}
            </button>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">OTP</label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  required
                  className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none tracking-[0.3em]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                  className="w-full pl-12 pr-12 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  minLength={8}
                  className="w-full pl-12 pr-12 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((p) => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full btn-premium gradient-primary text-white py-4 rounded-xl font-bold shadow-premium hover:shadow-premium-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Resetting Password..." : "Reset Password"}
            </button>
          </form>

          <div className="text-center mt-6 text-sm">
            <Link to="/login" className="text-purple-600 hover:text-purple-700 font-semibold">
              Back to Sign In
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
