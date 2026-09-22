import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Target,
  BarChart3,
  MessageSquare,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  LogOut,
  User,
  CreditCard,
  ChevronDown,
  Zap,
  PlayCircle,
  Mail,
  Users,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { hasCompletedRequiredOnboarding } from 'src/lib/onboarding';
import { useExtensionPipelineStats } from '../hooks/useExtensionPipelineStats';
import {
  DASHBOARD_TOUR_JOBS_EXTENSION,
  DASHBOARD_TOUR_ONBOARDING_EXTENSION,
  queueDashboardTourRequest,
} from 'src/lib/dashboard-tour';

export default function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const profileRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const extensionStats = useExtensionPipelineStats();

  const onboardingComplete = hasCompletedRequiredOnboarding(user) && Boolean(user?.onboardingCompleted);
  const dailyCap = Math.max(1, user?.dailyHireCap ?? 3);
  const mergedDailyUsed = Math.min(
    dailyCap,
    Math.max(user?.dailyHireUsed ?? 0, extensionStats.loaded ? extensionStats.appliedToday : 0)
  );
  const hireBalance = user?.hireBalance ?? 0;
  const freeLeft = user?.plan === 'free' ? Math.max(0, 3 - mergedDailyUsed) : 0;
  const spendableNow = user?.plan === 'pro' ? Number.MAX_SAFE_INTEGER : Math.max(0, hireBalance + freeLeft);
  const needsHires = spendableNow <= 0;
  const primaryTourId = onboardingComplete ? DASHBOARD_TOUR_JOBS_EXTENSION : DASHBOARD_TOUR_ONBOARDING_EXTENSION;
  const primaryTourRoute = onboardingComplete ? '/dashboard/jobs' : '/dashboard/onboarding';

  useEffect(() => {
    const handler = () => {
      refreshUser().catch(() => {});
    };
    window.addEventListener('cp:extensionImported', handler);
    return () => window.removeEventListener('cp:extensionImported', handler);
  }, [refreshUser]);

  // Close dropdowns on outside click or route change
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    setProfileOpen(false);
    setOpenDropdown(null);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Top navigation menu items
  const navigation = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Auto Apply', href: '/dashboard/jobs/linkedin', icon: Target, matchPrefix: '/dashboard/jobs' },
    { name: 'Apply Email', href: '/dashboard/cold-emails', icon: Mail, matchPrefix: '/dashboard/cold-emails' },
    {
      name: 'Recruitment Agency',
      href: 'https://recruitment.autoapplycv.in/index.html',
      icon: Users,
      isExternal: true,
    },
    { name: 'Applications', href: '/dashboard/applications', icon: Briefcase },
    { name: 'Resume', href: '/dashboard/resume', icon: FileText },
    { name: 'Live AI Interview', href: '/dashboard/interview', icon: MessageSquare, badge: 'BETA' },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    onboardingComplete
      ? { name: 'Billing', href: '/dashboard/billing', icon: CreditCard }
      : { name: 'Onboarding', href: '/dashboard/onboarding', icon: FileText },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleStartTour = () => {
    queueDashboardTourRequest(primaryTourId);
    if (location.pathname !== primaryTourRoute) {
      navigate(primaryTourRoute);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFBFC] relative overflow-hidden flex">
      {/* Ambient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80rem_60rem_at_20%_10%,rgba(99,102,241,0.18)_0,transparent_55%),radial-gradient(70rem_50rem_at_80%_0%,rgba(139,92,246,0.18)_0,transparent_55%),radial-gradient(60rem_50rem_at_50%_100%,rgba(6,182,212,0.12)_0,transparent_60%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(15,23,42,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.15)_1px,transparent_1px)] [background-size:48px_48px]"
      />

      {/* Mobile Sidebar Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Vertical Sidebar Navigation ── */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white/95 backdrop-blur-2xl border-r border-gray-200/80 z-50 flex flex-col shadow-xs transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Sidebar Brand Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100/80">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img
              src="/logos/android-chrome-192x192.png"
              alt="AutoApply CV"
              className="w-8 h-8 rounded-xl shadow-xs transition-transform group-hover:scale-105 shrink-0"
              loading="eager"
              decoding="async"
            />
            <div className="flex flex-col">
              <span className="font-bold text-base text-gradient leading-tight">AutoApply CV</span>
              <span className="text-[10px] text-gray-400 font-semibold tracking-wider uppercase">Dashboard</span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
          {navigation.map((item) => {
            const isMatchPrefix = (item as any).matchPrefix && location.pathname.startsWith((item as any).matchPrefix);
            const isDirectMatch = location.pathname === item.href;
            const isActive = isDirectMatch || isMatchPrefix;

            if ((item as any).isExternal) {
              return (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-purple-700 bg-purple-50/70 hover:bg-purple-100/80 border border-purple-200/60 shadow-2xs transition-all duration-200 group"
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon className="w-4 h-4 text-purple-600 transition-transform group-hover:scale-110" />
                    <span>{item.name}</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-purple-500 opacity-80" />
                </a>
              );
            }

            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group ${
                  isActive
                    ? 'gradient-primary text-white shadow-xs font-bold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-purple-50/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <item.icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-purple-600'}`} />
                  <span>{item.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {(item as any).badge && (
                    <span
                      className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md border tracking-wider ${
                        isActive
                          ? 'bg-white/25 text-white border-white/40'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {(item as any).badge}
                    </span>
                  )}
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Quota Card */}
        <div className="p-3 border-t border-gray-100/80 bg-gray-50/50">
          <div className="p-3 bg-white border border-purple-100 rounded-xl shadow-2xs space-y-2.5">
            {/* Plan Badge & Balance */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Plan:</span>
                <span
                  className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border tracking-wider ${
                    user?.plan === 'pro'
                      ? 'bg-purple-100 text-purple-800 border-purple-300'
                      : user?.plan === 'coach'
                      ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                      : 'bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  {user?.plan || 'Free'}
                </span>
              </div>
              <span className="text-[11px] font-bold text-purple-700">
                {user?.plan === 'pro' ? 'Unlimited' : `${hireBalance.toLocaleString()} Hires`}
              </span>
            </div>

            {/* Daily Usage */}
            <div className="text-[10px] text-gray-500 flex justify-between items-center bg-gray-50/80 px-2 py-1 rounded-lg border border-gray-100">
              <span>Today:</span>
              <span className="font-semibold text-gray-800">
                {user?.plan === 'pro' ? `${mergedDailyUsed} (Unlimited)` : `${mergedDailyUsed} / ${dailyCap} free`}
              </span>
            </div>

            {/* Upgrade or Manage Billing */}
            {user?.plan !== 'pro' && user?.plan !== 'coach' ? (
              <div className="space-y-1.5 pt-0.5">
                <Link
                  to="/dashboard/billing"
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-xs hover:shadow-purple-500/20 transition-all cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 fill-white text-white" />
                  <span>Upgrade to Pro (₹49)</span>
                </Link>
                <Link
                  to="/dashboard/billing"
                  className="w-full flex items-center justify-center gap-1 py-1 px-2 text-[10px] font-medium text-gray-500 hover:text-purple-700 transition-colors"
                >
                  <CreditCard className="w-3 h-3" />
                  <span>Manage Billing / Top Up</span>
                </Link>
              </div>
            ) : (
              <Link
                to="/dashboard/billing"
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Manage Billing</span>
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main Content Area with Top Header ── */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen relative z-10 w-full">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/80 shadow-xs">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
              {/* Mobile Sidebar Toggle & Logo */}
              <div className="flex items-center gap-3 lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                  aria-label="Open Sidebar Menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <Link to="/" className="flex items-center gap-2">
                  <img
                    src="/logos/android-chrome-192x192.png"
                    alt="AutoApply CV"
                    className="w-7 h-7 rounded-xl"
                  />
                  <span className="font-bold text-sm text-gradient">AutoApply CV</span>
                </Link>
              </div>

              {/* Global Search Bar */}
              <div className="flex-1 max-w-md hidden md:block">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search jobs, applications, skills..."
                    className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-gray-200 bg-gray-50/70 focus:bg-white focus:border-purple-300 focus:ring-4 focus:ring-purple-100 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Right Utility Group */}
              <div className="flex items-center gap-1.5 sm:gap-3 ml-auto">
                {/* Tour Button */}
                <button
                  type="button"
                  onClick={handleStartTour}
                  className="inline-flex items-center gap-1 rounded-xl border border-sky-200 bg-sky-50 px-2 sm:px-3 py-1.5 text-xs font-semibold text-sky-700 transition-all hover:border-sky-300 hover:bg-sky-100 hover:shadow-xs"
                  title="Start Interactive Tour"
                >
                  <PlayCircle className="w-3.5 h-3.5 text-sky-600" />
                  <span className="hidden sm:inline">Tour</span>
                </button>

                {/* Hires Top Pill */}
                <Link
                  to="/dashboard/billing"
                  className="flex items-center gap-1 sm:gap-2 px-2.5 py-1.5 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl hover:shadow-xs hover:border-purple-300 transition-all shrink-0"
                >
                  <Zap className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span className="text-xs font-bold text-purple-700">
                    {user?.plan === 'pro' ? 'Unlimited' : `${hireBalance} Hires`}
                  </span>
                </Link>

                {/* Notifications Bell */}
                <button
                  type="button"
                  aria-label="Notifications"
                  className="relative p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors shrink-0"
                >
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
                </button>

                {/* User Account Dropdown */}
                <div className="relative" ref={profileRef}>
                  <button
                    type="button"
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 p-1 pl-1.5 rounded-xl hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-all"
                  >
                    <img
                      src={user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400'}
                      alt={user?.name || 'User'}
                      className="w-7 h-7 rounded-lg object-cover border border-purple-200 shadow-2xs"
                    />
                    <div className="text-left hidden sm:block">
                      <div className="text-xs font-semibold text-gray-800 leading-tight max-w-[90px] truncate">
                        {user?.name || 'My Account'}
                      </div>
                      <div className="text-[10px] text-purple-600 font-medium capitalize leading-tight">
                        {user?.plan || 'free'} plan
                      </div>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Profile Menu Dropdown */}
                  {profileOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white/95 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-xs font-bold text-gray-900 truncate">{user?.name}</p>
                        <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
                      </div>
                      <Link
                        to="/dashboard/profile"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                        onClick={() => setProfileOpen(false)}
                      >
                        <User className="w-4 h-4 text-gray-400" />
                        <span>Profile</span>
                      </Link>
                      <Link
                        to="/dashboard/billing"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                        onClick={() => setProfileOpen(false)}
                      >
                        <CreditCard className="w-4 h-4 text-gray-400" />
                        <span>Billing</span>
                      </Link>
                      <Link
                        to="/dashboard/settings"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                        onClick={() => setProfileOpen(false)}
                      >
                        <Settings className="w-4 h-4 text-gray-400" />
                        <span>Settings</span>
                      </Link>
                      <div className="my-1 border-t border-gray-100" />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4 text-red-500" />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
