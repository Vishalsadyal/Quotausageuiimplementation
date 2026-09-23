"use client";

import { Suspense, lazy, useMemo } from 'react';
import {
  createBrowserRouter,
  createMemoryRouter,
  createRoutesFromElements,
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  useLocation,
} from 'react-router';
import { AuthProvider, useAuth } from './context/AuthContext';
import { hasCompletedRequiredOnboarding } from 'src/lib/onboarding';

// Layouts (lightweight - keep eager)
import Root from './Root';
import DashboardLayout from './layouts/DashboardLayout';
import AdminLayout from './layouts/AdminLayout';

// Auth Pages (critical path - keep eager for fast load)
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import AdminLogin from './pages/AdminLogin';

// Marketing Pages (lazy load)
const Home = lazy(() => import('./pages/Home'));
const Product = lazy(() => import('./pages/Product'));
const Features = lazy(() => import('./pages/Features'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const Pricing = lazy(() => import('./pages/Pricing'));
const AutoApply = lazy(() => import('./pages/AutoApply'));
const AutoApplyLinkedIn = lazy(() => import('./pages/AutoApplyLinkedIn'));
const AutoApplyJobs = lazy(() => import('./pages/AutoApplyJobs'));
const AutoApplyChromeExtension = lazy(() => import('./pages/AutoApplyChromeExtension'));
const About = lazy(() => import('./pages/About'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Roadmap = lazy(() => import('./pages/Roadmap'));
const Careers = lazy(() => import('./pages/Careers'));
const Contact = lazy(() => import('./pages/Contact'));
const PressKit = lazy(() => import('./pages/PressKit'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const Community = lazy(() => import('./pages/Community'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const CookiePolicy = lazy(() => import('./pages/CookiePolicy'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const ExtensionDesign = lazy(() => import('./pages/ExtensionDesign'));
const ThankYou = lazy(() => import('./pages/ThankYou'));
const RecruitmentAgency = lazy(() => import('./pages/RecruitmentAgency'));

// Dashboard Pages (lazy load)
const DashboardOverview = lazy(() => import('./pages/dashboard/Overview'));
const Jobs = lazy(() => import('./pages/dashboard/Jobs'));
const Applications = lazy(() => import('./pages/dashboard/Applications'));
const Resume = lazy(() => import('./pages/dashboard/Resume'));
const Interview = lazy(() => import('./pages/dashboard/Interview'));
const DashboardAnalytics = lazy(() => import('./pages/dashboard/Analytics'));
const Settings = lazy(() => import('./pages/dashboard/Settings'));
const Profile = lazy(() => import('./pages/dashboard/Profile'));
const Billing = lazy(() => import('./pages/dashboard/Billing'));
const Onboarding = lazy(() => import('./pages/dashboard/Onboarding'));
const Marketing = lazy(() => import('./pages/dashboard/Marketing'));
const HROutreach = lazy(() => import('./pages/dashboard/HROutreach'));
const ColdEmails = lazy(() => import('./pages/dashboard/ColdEmails'));

// Admin Pages (lazy load)
const AdminOverview = lazy(() => import('./pages/admin/Overview'));
const Users = lazy(() => import('./pages/admin/Users'));
const AdminAnalytics = lazy(() => import('./pages/admin/Analytics'));
const AdminJobs = lazy(() => import('./pages/admin/Jobs'));
const AdminApplications = lazy(() => import('./pages/admin/AdminApplications'));
const Revenue = lazy(() => import('./pages/admin/Revenue'));
const Support = lazy(() => import('./pages/admin/Support'));
const Health = lazy(() => import('./pages/admin/Health'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminBlogs = lazy(() => import('./pages/admin/Blogs'));
const AdminBlogEditor = lazy(() => import('./pages/admin/BlogEditor'));

// SEO (lightweight - keep eager)
const SeoManager = lazy(() => import('./components/SeoManager').then(m => ({ default: m.SeoManager })));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  );
}

// Protected Route Components
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isBootstrapping, user } = useAuth();
  const location = useLocation();
  if (isBootstrapping) return null;
  if (isAuthenticated && user?.role === 'admin' && location.pathname.startsWith('/dashboard')) {
    return <Navigate to="/login" replace />;
  }
  const onboardingComplete = hasCompletedRequiredOnboarding(user) && Boolean(user?.onboardingCompleted);
  if (isAuthenticated && user?.role === 'user' && !onboardingComplete && location.pathname !== '/dashboard/onboarding') {
    return <Navigate to="/dashboard/onboarding" replace />;
  }
  if (isAuthenticated && user?.role === 'user' && onboardingComplete && location.pathname === '/dashboard/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isBootstrapping } = useAuth();
  if (isBootstrapping) return null;
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

function AppChrome() {
  return (
    <>
      <Suspense fallback={null}>
        <SeoManager />
      </Suspense>
      <Outlet />
    </>
  );
}

const routes = createRoutesFromElements(
  <>
    <Route element={<AppChrome />}>
    {/* Marketing Pages */}
    <Route path="/" element={<Root />}>
      <Route index element={<Suspense fallback={<PageLoader />}><Home /></Suspense>} />
      <Route path="product" element={<Suspense fallback={<PageLoader />}><Product /></Suspense>} />
      <Route path="features" element={<Suspense fallback={<PageLoader />}><Features /></Suspense>} />
      <Route path="how-it-works" element={<Suspense fallback={<PageLoader />}><HowItWorks /></Suspense>} />
      <Route path="pricing" element={<Suspense fallback={<PageLoader />}><Pricing /></Suspense>} />
      <Route path="auto-apply" element={<Suspense fallback={<PageLoader />}><AutoApply /></Suspense>} />
      <Route path="auto-apply-linkedin" element={<Suspense fallback={<PageLoader />}><AutoApplyLinkedIn /></Suspense>} />
      <Route path="auto-apply-jobs" element={<Suspense fallback={<PageLoader />}><AutoApplyJobs /></Suspense>} />
      <Route path="auto-apply-chrome-extension" element={<Suspense fallback={<PageLoader />}><AutoApplyChromeExtension /></Suspense>} />
      <Route path="about" element={<Suspense fallback={<PageLoader />}><About /></Suspense>} />
      <Route path="faq" element={<Suspense fallback={<PageLoader />}><FAQ /></Suspense>} />
      <Route path="roadmap" element={<Suspense fallback={<PageLoader />}><Roadmap /></Suspense>} />
      <Route path="careers" element={<Suspense fallback={<PageLoader />}><Careers /></Suspense>} />
      <Route path="contact" element={<Suspense fallback={<PageLoader />}><Contact /></Suspense>} />
      <Route path="press-kit" element={<Suspense fallback={<PageLoader />}><PressKit /></Suspense>} />
      <Route path="help-center" element={<Suspense fallback={<PageLoader />}><HelpCenter /></Suspense>} />
      <Route path="community" element={<Suspense fallback={<PageLoader />}><Community /></Suspense>} />
      <Route path="privacy-policy" element={<Suspense fallback={<PageLoader />}><PrivacyPolicy /></Suspense>} />
      <Route path="terms-of-service" element={<Suspense fallback={<PageLoader />}><TermsOfService /></Suspense>} />
      <Route path="cookie-policy" element={<Suspense fallback={<PageLoader />}><CookiePolicy /></Suspense>} />
      <Route path="extension-design" element={<Suspense fallback={<PageLoader />}><ExtensionDesign /></Suspense>} />
      <Route path="blog" element={<Suspense fallback={<PageLoader />}><Blog /></Suspense>} />
      <Route path="blog/:slug" element={<Suspense fallback={<PageLoader />}><BlogPost /></Suspense>} />
      <Route path="thank-you" element={<Suspense fallback={<PageLoader />}><ThankYou /></Suspense>} />
      <Route path="recruitment-agency" element={<Suspense fallback={<PageLoader />}><RecruitmentAgency /></Suspense>} />
      <Route path="recruitment" element={<Navigate to="/recruitment-agency" replace />} />
    </Route>

    {/* Auth Pages */}
    <Route path="/login" element={<Login />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/admin/login" element={<AdminLogin />} />
    <Route path="/signup" element={<Signup />} />

    {/* Dashboard */}
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<Suspense fallback={<PageLoader />}><DashboardOverview /></Suspense>} />
      <Route path="jobs" element={<Navigate to="linkedin" replace />} />
      <Route path="jobs/:provider" element={<Suspense fallback={<PageLoader />}><Jobs /></Suspense>} />
      <Route path="applications" element={<Suspense fallback={<PageLoader />}><Applications /></Suspense>} />
      <Route path="resume" element={<Suspense fallback={<PageLoader />}><Resume /></Suspense>} />
      <Route path="interview" element={<Suspense fallback={<PageLoader />}><Interview /></Suspense>} />
      <Route path="analytics" element={<Suspense fallback={<PageLoader />}><DashboardAnalytics /></Suspense>} />
      <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
      <Route path="profile" element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />
      <Route path="billing" element={<Suspense fallback={<PageLoader />}><Billing /></Suspense>} />
      <Route path="marketing" element={<Navigate to="/dashboard/marketing/email" replace />} />
      <Route path="marketing/email" element={<Suspense fallback={<PageLoader />}><Marketing /></Suspense>} />
      <Route path="marketing/whatsapp" element={<Suspense fallback={<PageLoader />}><Marketing /></Suspense>} />
      <Route path="hr-outreach" element={<Suspense fallback={<PageLoader />}><HROutreach /></Suspense>} />
      <Route path="cold-emails" element={<Suspense fallback={<PageLoader />}><ColdEmails /></Suspense>} />
      <Route path="onboarding" element={<Suspense fallback={<PageLoader />}><Onboarding /></Suspense>} />
    </Route>

    {/* Admin */}
    <Route
      path="/admin"
      element={
        <AdminRoute>
          <AdminLayout />
        </AdminRoute>
      }
    >
      <Route index element={<Suspense fallback={<PageLoader />}><AdminOverview /></Suspense>} />
      <Route path="users" element={<Suspense fallback={<PageLoader />}><Users /></Suspense>} />
      <Route path="analytics" element={<Suspense fallback={<PageLoader />}><AdminAnalytics /></Suspense>} />
      <Route path="jobs" element={<Suspense fallback={<PageLoader />}><AdminJobs /></Suspense>} />
      <Route path="applications" element={<Suspense fallback={<PageLoader />}><AdminApplications /></Suspense>} />
      <Route path="revenue" element={<Suspense fallback={<PageLoader />}><Revenue /></Suspense>} />
      <Route path="support" element={<Suspense fallback={<PageLoader />}><Support /></Suspense>} />
      <Route path="health" element={<Suspense fallback={<PageLoader />}><Health /></Suspense>} />
      <Route path="blogs" element={<Suspense fallback={<PageLoader />}><AdminBlogs /></Suspense>} />
      <Route path="blogs/new" element={<Suspense fallback={<PageLoader />}><AdminBlogEditor /></Suspense>} />
      <Route path="blogs/:id/edit" element={<Suspense fallback={<PageLoader />}><AdminBlogEditor /></Suspense>} />
      <Route path="settings" element={<Suspense fallback={<PageLoader />}><AdminSettings /></Suspense>} />
    </Route>

    {/* Catch-all */}
    <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </>,
);

type AppProps = {
  initialPathname?: string;
};

export default function App({ initialPathname }: AppProps) {
  const router = useMemo(() => {
    if (typeof window === 'undefined') {
      return createMemoryRouter(routes, { initialEntries: [initialPathname || '/'] });
    }
    return createBrowserRouter(routes);
  }, [initialPathname]);

  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
