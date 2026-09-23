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
      <div className="bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white py-2.5 px-4 text-center text-sm">
        <span className="inline-flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-300" />
          <span><strong>Free:</strong> Start applying with $0 signup + 30 Hires bonus credits.</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img
                src="/logos/brandmark-80.png"
                alt="AutoApply CV logo"
                className="w-10 h-10 object-contain"
                width={40}
                height={40}
                loading="eager"
                decoding="async"
              />
              <span className="text-xl font-bold bg-gradient-to-r from-[#6366F1] to-[#A855F7] bg-clip-text text-transparent">
                AutoApply CV
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
                  className="flex items-center gap-1.5 text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors py-2 focus:outline-none"
                >
                  <Building2 className="w-4 h-4 text-[#8B5CF6]" />
                  <span>Recruitment Agency</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${recruitmentMenuOpen ? 'rotate-180 text-[#8B5CF6]' : 'text-gray-400'}`} />
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

              <Link to="/how-it-works" className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors">
                How It Works
              </Link>
              <Link to="/auto-apply" className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors">
                Auto Apply
              </Link>
              <Link to="/pricing" className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors">
                Pricing
              </Link>
              <Link to="/roadmap" className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors">
                Roadmap
              </Link>
              <Link to="/about" className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors">
                About Us
              </Link>
              <Link to="/faq" className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors">
                FAQ
              </Link>
              <Link to="/blog" className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors">
                Blog
              </Link>
            </div>

            {/* CTA Buttons */}
            <div className="hidden lg:flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => navigate(isAdmin ? '/admin' : '/dashboard')}
                    className="flex items-center gap-2 text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors"
                  >
                    {isAdmin ? <Shield className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
                    {isAdmin ? 'Admin' : 'Dashboard'}
                  </button>
                  <button
                    onClick={handleAuthAction}
                    className="flex items-center gap-2 text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleAuthAction}
                    className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={handleGetStarted}
                    className="px-6 py-2.5 bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white rounded-lg font-semibold hover:shadow-xl hover:scale-105 transition-all duration-200"
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
                  className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors px-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  How It Works
                </Link>
                <Link 
                  to="/pricing" 
                  className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors px-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Link 
                  to="/roadmap" 
                  className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors px-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Roadmap
                </Link>
                <Link 
                  to="/about" 
                  className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors px-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  About Us
                </Link>
                <Link 
                  to="/faq" 
                  className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors px-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  FAQ
                </Link>
                <Link 
                  to="/blog" 
                  className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors px-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Blog
                </Link>
                <div className="pt-4 border-t border-gray-200 flex flex-col gap-2">
                  {isAuthenticated ? (
                    <>
                      <button
                        onClick={() => navigate(isAdmin ? '/admin' : '/dashboard')}
                        className="flex items-center gap-2 text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors text-left"
                      >
                        {isAdmin ? <Shield className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
                        {isAdmin ? 'Admin' : 'Dashboard'}
                      </button>
                      <button
                        onClick={handleAuthAction}
                        className="flex items-center gap-2 text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleAuthAction}
                        className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors text-left"
                      >
                        Sign In
                      </button>
                      <button 
                        onClick={() => {
                          handleGetStarted();
                          setMobileMenuOpen(false);
                        }}
                        className="px-6 py-2.5 bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white rounded-lg font-semibold"
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
