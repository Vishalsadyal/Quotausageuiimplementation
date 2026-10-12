import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, Sparkles, Shield, Zap, KeyRound, RefreshCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password');

  const [otp, setOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpSuccess, setOtpSuccess] = useState('');

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, refreshUser } = useAuth();

  // Sent here by the home-page resume upload when the resume's email already has an account.
  const existingAccount = searchParams.get('existing') === '1';
  useEffect(() => {
    const prefill = searchParams.get('email');
    if (prefill) setEmail(prefill);
  }, [searchParams]);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'oauth_cancelled') {
      setErrorMessage('Google sign-in was cancelled.');
    } else if (err === 'state_mismatch') {
      setErrorMessage('Session expired. Please try signing in with Google again.');
    } else if (err) {
      setErrorMessage('Unable to sign in with Google. Please try again or use email.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      await login(email, password, 'user');
      navigate('/dashboard');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const sendOtp = async () => {
    if (!email.trim()) {
      setErrorMessage('Enter your email first.');
      return;
    }
    try {
      setSendingOtp(true);
      setErrorMessage('');
      setOtpSuccess('');
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'login' }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || 'Failed to send OTP');
      setOtpSent(true);
      setOtpSuccess('OTP sent to your email. Enter it below to sign in.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setOtpSuccess('');

    if (!otpSent) {
      setErrorMessage('Send OTP first.');
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      setErrorMessage('Enter a valid 6-digit OTP.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || 'OTP login failed');
      await refreshUser();
      navigate('/dashboard');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'OTP login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-grid-pattern opacity-40"></div>

      <div className="max-w-6xl w-full relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            className="hidden lg:block"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Link to="/" className="flex items-center gap-3 mb-8">
              <img
                src="/logos/android-chrome-192x192.png"
                alt="AutoApply CV"
                className="w-12 h-12 rounded-xl"
                loading="eager"
                decoding="async"
              />
              <span className="text-2xl font-bold text-gradient">AutoApply CV</span>
            </Link>

            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Welcome back to your <span className="text-gradient">career journey</span>
            </h1>

            <p className="text-xl text-gray-600 mb-8">
              Log in to continue building your path to success
            </p>

            <div className="space-y-4">
              {[
                { icon: Zap, text: 'Access your personalized job matches' },
                { icon: Shield, text: 'Secure and encrypted login' },
                { icon: Sparkles, text: 'AI-powered resume optimization' }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                >
                  <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center shadow-md">
                    <feature.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-gray-700">{feature.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="glass rounded-3xl shadow-premium-lg p-8 lg:p-10 border-2 border-white">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Sign In</h2>
                <p className="text-gray-600">User account login</p>
              </div>

              {existingAccount && (
                <div className="mb-6 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900">
                  <b>You already have an account.</b> Please log in. Forgot your password? Use the <b>OTP Code</b> tab to log in with a code sent to your email.
                </div>
              )}

              {/* Google Sign In Button */}
              <a
                href="/api/auth/google"
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-gray-700 font-semibold shadow-sm transition-all duration-200 mb-6 group"
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
              </a>

              <div className="relative mb-6 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <span className="relative bg-white px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  or continue with email
                </span>
              </div>

              <div className="flex rounded-xl border-2 border-gray-200 overflow-hidden mb-6">
                <button
                  type="button"
                  onClick={() => { setLoginMode('password'); setErrorMessage(''); setOtpSuccess(''); }}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                    loginMode === 'password'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Lock className="w-4 h-4 inline mr-1.5" />
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginMode('otp'); setErrorMessage(''); setOtpSuccess(''); }}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                    loginMode === 'otp'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <KeyRound className="w-4 h-4 inline mr-1.5" />
                  OTP Code
                </button>
              </div>

              {loginMode === 'password' ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {errorMessage && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {errorMessage}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none"
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-12 pr-12 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none"
                        placeholder="Enter your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <div className="mt-2 text-right">
                      <Link to="/forgot-password" className="text-sm text-purple-600 hover:text-purple-700 font-semibold">
                        Forgot password?
                      </Link>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full btn-premium gradient-primary text-white py-4 rounded-xl font-bold shadow-premium hover:shadow-premium-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleOtpLogin} className="space-y-6">
                  {errorMessage && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {errorMessage}
                    </div>
                  )}
                  {otpSuccess && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                      {otpSuccess}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none"
                        placeholder="you@example.com"
                        required
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
                    {sendingOtp ? 'Sending OTP...' : otpSent ? 'Resend OTP' : 'Send OTP'}
                  </button>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      OTP Code
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                        placeholder="6-digit code"
                        required
                        className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none tracking-[0.3em]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full btn-premium gradient-primary text-white py-4 rounded-xl font-bold shadow-premium hover:shadow-premium-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Signing in...' : 'Sign In with OTP'}
                  </button>
                </form>
              )}

              <p className="text-center text-gray-600 mt-6">
                Don't have an account?{' '}
                <Link to="/signup" className="text-purple-600 hover:text-purple-700 font-semibold">
                  Sign up for free
                </Link>
              </p>

              <div className="text-center mt-4">
                <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
                  Back to home
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
