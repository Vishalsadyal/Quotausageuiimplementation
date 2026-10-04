import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Briefcase, Eye, EyeOff, Lock, Mail, Phone, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { readHeroLead } from 'src/lib/heroLead';

type Mode = 'signup' | 'login';

// Shown on /dashboard to visitors who came from the home hero form without a session:
// a blurred dashboard preview behind a sign up / log in popup.
export function DashboardAuthGate() {
  const lead = readHeroLead();
  const navigate = useNavigate();
  const { signup, login } = useAuth();
  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    try {
      if (mode === 'signup') {
        await signup(name, email, password, phone);
      } else {
        await login(email, password, 'user');
      }
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none';

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Blurred dashboard preview */}
      <div className="absolute inset-0 flex blur-sm pointer-events-none select-none" aria-hidden="true">
        <div className="hidden md:block w-64 bg-white border-r border-gray-200 p-6 space-y-4">
          <div className="h-8 w-36 rounded-lg bg-purple-100" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-5 rounded bg-gray-100" />
          ))}
        </div>
        <div className="flex-1 p-8 space-y-6">
          <div className="h-10 w-72 rounded-lg bg-gray-200" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {['Jobs matched', 'Applied', 'Interviews', 'Response rate'].map((label) => (
              <div key={label} className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
                <div className="text-sm text-gray-500">{label}</div>
                <div className="mt-2 h-7 w-16 rounded bg-purple-100" />
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-white border border-gray-200 p-6 space-y-3 shadow-sm">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-gray-50 border border-gray-100" />
            ))}
          </div>
        </div>
      </div>
      <div className="absolute inset-0 bg-gray-900/30" />

      {/* Popup */}
      <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-gate-title"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-premium-lg p-8 border border-gray-100"
        >
          <h2 id="auth-gate-title" className="text-2xl font-bold text-gray-900 text-center">
            {mode === 'signup' ? 'Create your free account' : 'Welcome back'}
          </h2>
          <p className="text-gray-600 text-center mt-1 text-sm">
            {mode === 'signup' ? 'Your dashboard is ready. Sign up to start auto-applying.' : 'Log in to open your dashboard.'}
          </p>

          {lead?.jobTitle && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-purple-50 border border-purple-100 px-3 py-2 text-sm text-purple-800">
              <Briefcase className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {lead.jobTitle} · {lead.yearsOfExperience} yrs · {lead.workMode === 'Onsite' ? 'On-site' : lead.workMode}
              </span>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
            {(['signup', 'login'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setErrorMessage('');
                }}
                className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                  mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'signup' ? 'Sign up' : 'Log in'}
              </button>
            ))}
          </div>

          <a
            href="/api/auth/google"
            className="mt-5 w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-gray-700 font-semibold transition-all"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
            </svg>
            <span>Continue with Google</span>
          </a>

          <div className="relative my-5 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <span className="relative bg-white px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">or with email</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
            )}
            {mode === 'signup' && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Full name" aria-label="Full name" required />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" aria-label="Email" autoComplete="email" required />
            </div>
            {mode === 'signup' && (
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                  placeholder="Mobile number"
                  aria-label="Mobile number"
                  autoComplete="tel"
                  minLength={6}
                  maxLength={30}
                  required
                />
              </div>
            )}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-12`}
                placeholder={mode === 'signup' ? 'Password (min 8 characters)' : 'Password'}
                aria-label="Password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={mode === 'signup' ? 8 : undefined}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {mode === 'signup' && (
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" required className="w-4 h-4 mt-0.5 rounded border-gray-300" />
                <span className="text-xs text-gray-600">
                  I agree to the{' '}
                  <Link to="/terms-of-service" className="text-purple-600 font-semibold">Terms of Service</Link> and{' '}
                  <Link to="/privacy-policy" className="text-purple-600 font-semibold">Privacy Policy</Link>
                </span>
              </label>
            )}

            {mode === 'login' && (
              <div className="text-right">
                <Link to="/login" className="text-xs text-purple-600 font-semibold">Forgot password or use OTP?</Link>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-premium gradient-primary text-white py-3.5 rounded-xl font-bold shadow-premium hover:shadow-premium-lg transition-all disabled:opacity-50"
            >
              {isLoading ? 'Please wait...' : mode === 'signup' ? 'Create Free Account' : 'Log In'}
            </button>
          </form>

          <div className="text-center mt-4">
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">← Back to home</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
