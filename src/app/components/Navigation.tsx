import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Menu,
  X,
  Sparkles,
  LogOut,
  LayoutDashboard,
  Shield,
  ChevronDown,
  Building2,
  FileText,
  Workflow,
  Star,
  ExternalLink,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [recruitmentMenuOpen, setRecruitmentMenuOpen] = useState(false);
  const [mobileRecruitmentOpen, setMobileRecruitmentOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, logout, user } = useAuth();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setRecruitmentMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate(isAdmin ? '/admin' : '/dashboard');
    } else {
      navigate('/pricing');
    }
  };

  const handleAuthAction = () => {
    if (isAuthenticated) {
      logout();
      navigate('/');
    } else {
      navigate('/login');
    }
  };

  return (
    <>
      {/* Announcement Bar */}
      <div className="w-full h-8 px-3 sm:px-6 flex items-center justify-center gap-2.5 bg-[#17142e] text-[#eae7ff] text-xs">
        <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#c8ff62] text-[#17142e] text-[10px] font-extrabold uppercase">
          New
        </span>
        <p className="m-0 min-w-0 truncate text-[#bdb8d4]">
          <strong className="text-white">Free:</strong> Start applying with $0 signup + 30 Hires bonus credits.
        </p>
        <Link to="/signup" className="hidden sm:inline-flex shrink-0 items-center gap-1 font-bold text-white hover:underline">
          Get started <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Urgency Bar */}
      <div className="w-full h-8 px-3 sm:px-6 flex items-center justify-center gap-2.5 bg-[#c8ff62] text-[#3b2600] text-xs">
        <strong className="shrink-0 inline-flex items-center gap-1.5 font-extrabold">
          <Clock className="w-3 h-3" /> Limited offer
        </strong>
        <p className="m-0 min-w-0 truncate text-[#496312]">
          Pro is 90% off: unlimited auto-apply for ₹49/month.
        </p>
        <Link to="/pricing" className="hidden sm:inline-flex shrink-0 items-center gap-1 font-extrabold hover:underline">
          View Pro plan <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-[14px] border-b border-gray-200/75">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-[72px]">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img
                src="/logos/brandmark-80.webp"
                alt="AutoApply CV logo"
                className="w-10 h-10 object-contain"
                width={40}
                height={40}
                loading="eager"
                decoding="async"
              />
              <span className="flex flex-col leading-none">
                <span className="text-lg font-extrabold tracking-[-0.5px] text-gray-900 leading-tight">
                  AutoApply <span className="text-[#6047f5]">CV</span>
                </span>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-3.5 h-3.5 shrink-0"
                    role="img"
                    aria-label="LinkedIn"
                  >
                    <rect width="24" height="24" rx="4" fill="#0a66c2" />
                    <path
                      fill="#ffffff"
                      d="M7.1 9.6h2.5v8.1H7.1V9.6Zm1.25-4a1.45 1.45 0 1 1 0 2.9 1.45 1.45 0 0 1 0-2.9Zm2.8 4h2.4v1.1h.03c.34-.63 1.15-1.3 2.37-1.3 2.53 0 3 1.67 3 3.83v4.47h-2.5v-3.96c0-.95-.02-2.16-1.32-2.16-1.32 0-1.52 1.03-1.52 2.1v4.02h-2.5V9.6Z"
                    />
                  </svg>
                  LinkedIn Partner
                </span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-7">
              {/* Recruitment Agency Dropdown Submenu */}
              <div
                ref={dropdownRef}
                className="relative"
                onMouseEnter={() => setRecruitmentMenuOpen(true)}
                onMouseLeave={() => setRecruitmentMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setRecruitmentMenuOpen(!recruitmentMenuOpen)}
                  className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#6047f5] font-semibold transition-colors py-2 focus:outline-none"
                >
                  <Building2 className="w-4 h-4 text-[#6047f5]" />
                  <span>Recruitment Agency</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${recruitmentMenuOpen ? 'rotate-180 text-[#6047f5]' : 'text-gray-400'}`} />
                </button>

                {recruitmentMenuOpen && (
                  <div className="absolute top-full left-0 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-2 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 rounded-xl mb-2">
                      <div className="text-[11px] font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-purple-600" />
                        <span>Agency Services &amp; Outreach</span>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        Direct recruiter discovery, candidate matching &amp; outreach suite.
                      </p>
                    </div>

                    <Link
                      to="/recruitment-agency"
                      onClick={() => setRecruitmentMenuOpen(false)}
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-purple-50/70 transition-colors group"
                    >
                      <div className="p-2 rounded-lg bg-purple-100 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 group-hover:text-purple-700">Agency Overview &amp; Plans</div>
                        <div className="text-[11px] text-gray-500">Discover full agency services &amp; assistance</div>
                      </div>
                    </Link>

                    <Link
                      to="/recruitment-agency#brochure"
                      onClick={() => setRecruitmentMenuOpen(false)}
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-purple-50/70 transition-colors group"
                    >
                      <div className="p-2 rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 group-hover:text-blue-700 flex items-center gap-1.5">
                          <span>Official Brochure</span>
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">PDF</span>
                        </div>
                        <div className="text-[11px] text-gray-500">Download or view 2-page corporate brochure</div>
                      </div>
                    </Link>

                    <Link
                      to="/recruitment-agency#how-it-works"
                      onClick={() => setRecruitmentMenuOpen(false)}
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-purple-50/70 transition-colors group"
                    >
                      <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Workflow className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 group-hover:text-indigo-700">How It Works</div>
                        <div className="text-[11px] text-gray-500">5-step roadmap to recruiter connections</div>
                      </div>
                    </Link>

                    <Link
                      to="/recruitment-agency#reviews"
                      onClick={() => setRecruitmentMenuOpen(false)}
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-purple-50/70 transition-colors group"
                    >
                      <div className="p-2 rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                        <Star className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 group-hover:text-amber-700">Candidate Reviews</div>
                        <div className="text-[11px] text-gray-500">Verified success stories across 0–15 YOE</div>
                      </div>
                    </Link>

                    <div className="pt-2 mt-1 border-t border-gray-100">
                      <a
                        href="https://recruitment.autoapplycv.in/index.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setRecruitmentMenuOpen(false)}
                        className="flex items-center justify-between p-2 rounded-xl bg-gray-50 hover:bg-purple-50 text-gray-700 hover:text-purple-700 text-xs font-semibold transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <ExternalLink className="w-3.5 h-3.5 text-purple-600" />
                          <span>Dedicated Candidate Portal</span>
                        </span>
                        <span className="text-[10px] text-purple-600 font-bold">Open →</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <Link to="/how-it-works" className="text-sm text-gray-600 hover:text-[#6047f5] font-semibold transition-colors">
                How It Works
              </Link>
              <Link to="/auto-apply" className="text-sm text-gray-600 hover:text-[#6047f5] font-semibold transition-colors">
                Auto Apply
              </Link>
              <Link to="/pricing" className="text-sm text-gray-600 hover:text-[#6047f5] font-semibold transition-colors">
                Pricing
              </Link>
              <Link to="/roadmap" className="text-sm text-gray-600 hover:text-[#6047f5] font-semibold transition-colors">
                Roadmap
              </Link>
              <Link to="/about" className="text-sm text-gray-600 hover:text-[#6047f5] font-semibold transition-colors">
                About Us
              </Link>
              <Link to="/faq" className="text-sm text-gray-600 hover:text-[#6047f5] font-semibold transition-colors">
                FAQ
              </Link>
              <Link to="/blog" className="text-sm text-gray-600 hover:text-[#6047f5] font-semibold transition-colors">
                Blog
              </Link>
            </div>

            {/* CTA Buttons */}
            <div className="hidden lg:flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => navigate(isAdmin ? '/admin' : '/dashboard')}
                    className="flex items-center gap-2 text-gray-700 hover:text-[#6047f5] font-medium transition-colors"
                  >
                    {isAdmin ? <Shield className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
                    {isAdmin ? 'Admin' : 'Dashboard'}
                  </button>
                  <button
                    onClick={handleAuthAction}
                    className="flex items-center gap-2 text-gray-700 hover:text-[#6047f5] font-medium transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleAuthAction}
                    className="text-sm text-gray-600 hover:text-[#6047f5] font-semibold transition-colors"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={handleGetStarted}
                    className="min-h-[42px] px-[17px] bg-[#17142e] hover:bg-[#6047f5] text-white text-sm rounded-[10px] font-semibold hover:-translate-y-px transition-all duration-200"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-site-menu"
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div id="mobile-site-menu" className="lg:hidden py-4 border-t border-gray-200 animate-in slide-in-from-top duration-200">
              <div className="flex flex-col gap-3">
                {/* Mobile Recruitment Agency Submenu */}
                <div className="border border-purple-100 rounded-xl bg-purple-50/40 p-2.5 space-y-2">
                  <button
                    type="button"
                    onClick={() => setMobileRecruitmentOpen(!mobileRecruitmentOpen)}
                    className="w-full flex items-center justify-between text-purple-900 font-bold text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-purple-600" />
                      <span>Recruitment Agency</span>
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${mobileRecruitmentOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {mobileRecruitmentOpen && (
                    <div className="pl-6 pt-2 space-y-2 text-xs border-t border-purple-100/60 flex flex-col">
                      <Link
                        to="/recruitment-agency"
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-gray-700 hover:text-purple-700 py-1 font-medium"
                      >
                        Agency Overview &amp; Plans
                      </Link>
                      <Link
                        to="/recruitment-agency#brochure"
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-gray-700 hover:text-purple-700 py-1 font-medium"
                      >
                        Official Brochure (PDF)
                      </Link>
                      <Link
                        to="/recruitment-agency#how-it-works"
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-gray-700 hover:text-purple-700 py-1 font-medium"
                      >
                        How It Works
                      </Link>
                      <Link
                        to="/recruitment-agency#reviews"
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-gray-700 hover:text-purple-700 py-1 font-medium"
                      >
                        Candidate Reviews
                      </Link>
                      <a
                        href="https://recruitment.autoapplycv.in/index.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-700 font-semibold py-1 flex items-center gap-1"
                      >
                        <span>External Portal</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                <Link 
                  to="/how-it-works" 
                  className="text-gray-700 hover:text-[#6047f5] font-medium transition-colors px-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  How It Works
                </Link>
                <Link 
                  to="/pricing" 
                  className="text-gray-700 hover:text-[#6047f5] font-medium transition-colors px-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Link 
                  to="/roadmap" 
                  className="text-gray-700 hover:text-[#6047f5] font-medium transition-colors px-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Roadmap
                </Link>
                <Link 
                  to="/about" 
                  className="text-gray-700 hover:text-[#6047f5] font-medium transition-colors px-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  About Us
                </Link>
                <Link 
                  to="/faq" 
                  className="text-gray-700 hover:text-[#6047f5] font-medium transition-colors px-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  FAQ
                </Link>
                <Link 
                  to="/blog" 
                  className="text-gray-700 hover:text-[#6047f5] font-medium transition-colors px-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Blog
                </Link>
                <div className="pt-4 border-t border-gray-200 flex flex-col gap-2">
                  {isAuthenticated ? (
                    <>
                      <button
                        onClick={() => navigate(isAdmin ? '/admin' : '/dashboard')}
                        className="flex items-center gap-2 text-gray-700 hover:text-[#6047f5] font-medium transition-colors text-left"
                      >
                        {isAdmin ? <Shield className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
                        {isAdmin ? 'Admin' : 'Dashboard'}
                      </button>
                      <button
                        onClick={handleAuthAction}
                        className="flex items-center gap-2 text-gray-700 hover:text-[#6047f5] font-medium transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleAuthAction}
                        className="text-gray-700 hover:text-[#6047f5] font-medium transition-colors text-left"
                      >
                        Sign In
                      </button>
                      <button 
                        onClick={() => {
                          handleGetStarted();
                          setMobileMenuOpen(false);
                        }}
                        className="min-h-[42px] px-[17px] bg-[#17142e] hover:bg-[#6047f5] text-white text-sm rounded-[10px] font-semibold"
                      >
                        Get Started
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
