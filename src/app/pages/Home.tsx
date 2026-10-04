import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { 
  ArrowRight, 
  Zap, 
  FileText, 
  Target, 
  BarChart3, 
  MessageSquare,
  Star,
  Check,
  TrendingUp,
  Users,
  Clock,
  Shield,
  Sparkles,
  Download
} from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { MediaSlot } from '../components/marketing/MediaSlot';
import { HeroQuickStart } from '../components/HeroQuickStart';

export default function Home() {
  const navigate = useNavigate();
  const mediaAssets = {
    heroVideoSrc: '/uploads/resumes/AutoApplyMax.mp4',
    heroImageSrc: '',
    valueImageSrc: '/marketing/value-dashboard.png',
    reliabilityEvidenceImageSrc: '/marketing/reliability-evidence.png',
  };

  const extensionDemo = {
    name: 'AutoApplyCV',
    version: 'v1.5',
    status: 'Active',
    runningLabel: 'Running...',
    applied: 47,
    skipped: 12,
    progressLabel: 'Applying to jobs...',
    progressPct: 78,
    activity: [
      { label: 'Software Engineer - Google', time: 'Just now' },
      { label: 'Full Stack Dev - Microsoft', time: '2m ago' },
      { label: 'Frontend Engineer - Meta', time: '5m ago' },
    ],
  };

  const ExtensionDemoCard = ({ className = '' }: { className?: string }) => (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className={`glass backdrop-blur-md rounded-3xl shadow-2xl p-6 border border-white/50 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-sm">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="w-full h-full">
              <rect width="24" height="24" rx="6" fill="url(#ext-grad)"></rect>
              <path
                d="M7 12L10 15L17 8"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              ></path>
              <defs>
                <linearGradient id="ext-grad" x1="0" y1="0" x2="24" y2="24">
                  <stop stopColor="#0a66c2"></stop>
                  <stop offset="1" stopColor="#378fe9"></stop>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold text-gray-900">{extensionDemo.name}</span>
              <span className="text-xs font-semibold text-gray-500">{extensionDemo.version}</span>
            </div>
            <div className="text-xs text-gray-600">LinkedIn extension</div>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
          {extensionDemo.status}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white/75 border border-white/60 px-3 py-3">
          <div className="text-[11px] text-gray-600 font-semibold">Status</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-bold text-emerald-700">{extensionDemo.runningLabel}</span>
          </div>
        </div>

        <div className="rounded-2xl bg-white/75 border border-white/60 px-3 py-3 text-center">
          <div className="text-2xl font-extrabold text-gray-900 leading-none">{extensionDemo.applied}</div>
          <div className="text-[11px] text-gray-600 font-semibold">Applied</div>
        </div>

        <div className="rounded-2xl bg-white/75 border border-white/60 px-3 py-3 text-center">
          <div className="text-2xl font-extrabold text-gray-900 leading-none">{extensionDemo.skipped}</div>
          <div className="text-[11px] text-gray-600 font-semibold">Skipped</div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-gray-700">
          <span className="font-semibold">{extensionDemo.progressLabel}</span>
          <span className="font-bold">{extensionDemo.progressPct}%</span>
        </div>
        <div className="mt-2 h-2.5 rounded-full bg-gray-200/70 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${extensionDemo.progressPct}%` }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            className="h-full rounded-full bg-gradient-to-r from-[#0a66c2] to-[#378fe9]"
          />
        </div>
      </div>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.35 }}
        variants={{
          hidden: { opacity: 0, y: 6 },
          show: { opacity: 1, y: 0, transition: { delayChildren: 0.2, staggerChildren: 0.08 } },
        }}
        className="mt-5 space-y-2"
      >
        {extensionDemo.activity.map((item) => (
          <motion.div
            key={item.label}
            variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
            className="flex items-center justify-between gap-3 rounded-2xl bg-white/75 border border-white/60 px-3 py-2.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-emerald-600 shrink-0"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span className="text-xs font-semibold text-gray-800 truncate">{item.label}</span>
            </div>
            <span className="text-[11px] font-semibold text-gray-500 shrink-0">{item.time}</span>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );

  const features = [
    {
      icon: FileText,
      title: 'AI Resume Builder & Tailor',
      description: 'Build and customize ATS-friendly resumes for each role with AI optimization',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Target,
      title: 'Smart Job Matching',
      description: 'Get compatibility scores based on your skills and experience',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      icon: BarChart3,
      title: 'Job Application Tracker',
      description: 'Track every application stage with our Kanban-style job tracker',
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      icon: MessageSquare,
      title: 'Interview Prep',
      description: 'Practice with AI-generated questions and feedback',
      gradient: 'from-orange-500 to-red-500'
    },
    {
      icon: TrendingUp,
      title: 'Analytics & Insights',
      description: 'Track callback rates, velocity, and career progress',
      gradient: 'from-indigo-500 to-blue-500'
    },
    {
      icon: Users,
      title: 'Coach Workspace',
      description: 'Collaborate with coaches or manage multiple clients',
      gradient: 'from-pink-500 to-rose-500'
    }
  ];

  const testimonials = [
    {
      name: 'Sarah Chen',
      role: 'Senior SDE',
      company: 'Google',
      image: '',
      content: 'Increased my interview callbacks by 3x in just 2 weeks!'
    },
    {
      name: 'Michael Rodriguez',
      role: 'Full Stack Dev',
      company: 'Meta',
      image: '',
      content: 'The AI resume tailoring saved me hours. Worth every penny!'
    },
    {
      name: 'Emily Watson',
      role: 'Software Engineer',
      company: 'Amazon',
      image: '',
      content: 'Got 4 FAANG offers using AutoApply CV. Simply amazing!'
    }
  ];

  const switchReasons = [
    {
      icon: Clock,
      title: 'Page-ready submission guard',
      description: 'AutoApply CV waits for LinkedIn Easy Apply modal readiness before answering and submitting.',
    },
    {
      icon: Shield,
      title: 'Duplicate prevention by job ID + URL',
      description: 'Recently attempted and already-submitted jobs are skipped automatically to avoid repeated loops.',
    },
    {
      icon: MessageSquare,
      title: 'Actionable validation feedback',
      description: 'If a field fails (for example decimal/number format), run pauses and sends exact fix prompts to dashboard.',
    },
  ];

  const comparisonRows = [
    {
      area: 'Page stability',
      legacy: 'Attempts while job card/modal is still loading',
      modern: 'Waits for stable form state before next action',
    },
    {
      area: 'Repeat protection',
      legacy: 'May revisit same jobs after refresh',
      modern: 'Dedupes by applied cache, job ID, and retry cooldown',
    },
    {
      area: 'Skip visibility',
      legacy: 'Generic skipped status',
      modern: 'Exact reason codes: external apply, cache hit, required input, validation',
    },
    {
      area: 'Human control',
      legacy: 'Limited recovery when forms fail',
      modern: 'Auto-pause and resume after user answer sync from dashboard',
    },
  ];

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-mesh pt-20 pb-32">
        <div className="absolute inset-0 bg-grid-pattern opacity-40"></div>
        <div className="absolute inset-0 bg-dot-pattern opacity-20"></div>
        
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-stretch">
            {/* Left Column */}
            <div className="space-y-8 self-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full text-purple-700 text-sm font-semibold shadow-premium">
                <Sparkles className="w-4 h-4" />
                Trusted by 50,000+ Engineers
              </div>
              
              <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 leading-tight">
                Free LinkedIn Auto Apply Bot
                <br />
                for Your{' '}
                <span className="text-gradient-animated">
                  Tech Job
                </span>{' '}
                Faster
              </h1>
              
              <p className="text-xl text-gray-600 leading-relaxed">
                Free AI-powered job search automation to apply to LinkedIn jobs automatically, optimize your ATS resume, and manage everything in one job application tracker.
              </p>

              <button
                onClick={() => document.getElementById('demo-video')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-sm font-semibold text-purple-700 hover:text-purple-900 underline-offset-4 hover:underline"
              >
                See Auto Apply Demo ↓
              </button>

              {/* Stats */}
              <div className="flex items-center gap-8 pt-4">
                {[
                  { value: '50K+', label: 'Active Users' },
                  { value: '3x', label: 'More Interviews' },
                  { value: '60%', label: 'Faster Results' }
                ].map((stat, index) => (
                  <div key={index}>
                    <div className="text-3xl font-bold text-gradient">
                      {stat.value}
                    </div>
                    <div className="text-sm text-gray-600">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column */}
            <div className="relative">
              <div className="relative z-10 h-full flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-gray-900">Get your job matches in 30 seconds</h2>
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Free to start
                  </span>
                </div>

                <HeroQuickStart className="flex-1" />

                {/* What happens next */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Target, title: 'Matches roles', text: 'Finds jobs that fit your profile' },
                    { icon: FileText, title: 'Tailors resume', text: 'ATS-ready for every job' },
                    { icon: Zap, title: 'Auto-applies', text: 'Easy Apply on autopilot' },
                  ].map((item) => (
                    <div key={item.title} className="glass rounded-xl border border-white/60 p-3 shadow-sm">
                      <item.icon className="w-5 h-5 text-purple-600 mb-1.5" />
                      <div className="text-sm font-bold text-gray-900">{item.title}</div>
                      <div className="text-xs text-gray-600 leading-snug">{item.text}</div>
                    </div>
                  ))}
                </div>

                {/* Live activity */}
                <div className="glass rounded-xl border border-white/60 px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Recently applied by the agent</span>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {extensionDemo.activity.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
                        <span className="flex items-center gap-2 min-w-0 font-semibold text-gray-800">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        <span className="text-gray-500 shrink-0">{item.time}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> No credit card</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Takes 30 seconds</span>
                  <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5" /> 30 free Hires coins</span>
                </div>
              </div>
              {/* Decorative blurs */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-3xl opacity-20 animate-pulse-slow"></div>
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full blur-3xl opacity-20 animate-float"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Video */}
      <section id="demo-video" className="py-20 bg-white scroll-mt-20">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-bold text-gray-900 mb-3">See AutoApply CV in action</h2>
            <p className="text-lg text-gray-600">Watch the extension apply to LinkedIn Easy Apply jobs on its own.</p>
          </div>
          <div className="rounded-3xl overflow-hidden shadow-premium-lg border-8 border-white">
            <MediaSlot
              videoSrc={mediaAssets.heroVideoSrc}
              imageSrc={mediaAssets.heroImageSrc}
              className="w-full aspect-video object-cover"
              placeholderTitle="Demo video"
              placeholderHint="Add a 8-12s product clip (recommended) or dashboard screenshot."
              autoPlay
              loop
              muted
              videoControls={false}
            />
          </div>
        </div>
      </section>

      {/* Trust Logos */}
      <section className="py-12 bg-white border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="text-center text-sm text-gray-600 mb-8 font-semibold">
            ENGINEERS FROM TOP COMPANIES TRUST US
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12">
            {['Google', 'Meta', 'Amazon', 'Microsoft', 'Apple', 'Netflix'].map((company) => (
              <div key={company} className="text-2xl font-bold text-gray-600">
                {company}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reliability Positioning */}
      <section className="py-20 bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-2 bg-indigo-100 rounded-full text-indigo-700 font-semibold text-sm mb-4">
              Why Users Switch
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Built for reliable runs, not blind mass apply
            </h2>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto">
              If you are comparing LiftmyCV, LazyApply, and other auto apply tools, focus on control quality:
              page waits, duplicate protection, and clear error routing.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {switchReasons.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm hover:shadow-lg transition-all duration-200"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#A855F7] flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="md:hidden grid gap-4">
            {comparisonRows.map((row) => (
              <div key={row.area} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="font-semibold text-gray-900 mb-2">{row.area}</p>
                <p className="text-sm text-gray-500 mb-1">Typical Mass-Apply</p>
                <p className="text-sm text-gray-700 mb-3">{row.legacy}</p>
                <p className="text-sm text-indigo-600 mb-1 font-medium">AutoApply CV</p>
                <p className="text-sm text-gray-800">{row.modern}</p>
              </div>
            ))}
          </div>

          <div className="hidden md:block rounded-2xl border border-gray-200 overflow-hidden bg-white">
            <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700">
              <div className="px-5 py-3">Decision Area</div>
              <div className="px-5 py-3 border-l border-gray-200">Typical Mass-Apply</div>
              <div className="px-5 py-3 border-l border-gray-200">AutoApply CV</div>
            </div>
            {comparisonRows.map((row) => (
              <div key={row.area} className="grid grid-cols-3 text-sm">
                <div className="px-5 py-3 font-semibold text-gray-900 border-b border-gray-100">{row.area}</div>
                <div className="px-5 py-3 text-gray-600 border-l border-b border-gray-100">{row.legacy}</div>
                <div className="px-5 py-3 text-gray-700 border-l border-b border-gray-100">{row.modern}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl overflow-hidden border border-purple-100/80 bg-white shadow-xl hover:shadow-2xl transition-all duration-300">
            <MediaSlot
              imageSrc={mediaAssets.reliabilityEvidenceImageSrc}
              className="w-full h-auto max-h-[540px] object-cover md:object-contain bg-slate-50"
              alt="AutoApply CV Reliability, Modal Check and Duplicate Prevention Guardrails"
              placeholderTitle="Reliability evidence image"
              placeholderHint="Live verification logs showing modal check, duplicate prevention, and human pacing."
            />
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-24 bg-gradient-to-br from-purple-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-block px-4 py-2 bg-purple-100 rounded-full text-purple-700 font-semibold text-sm mb-6">
                Why Choose Us
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                Great companies are built by{' '}
                <span className="bg-gradient-to-r from-[#6366F1] to-[#A855F7] bg-clip-text text-transparent">
                  great people
                </span>
              </h2>
              <p className="text-xl text-gray-600 leading-relaxed mb-8">
                We help software engineers run smarter job search automation with a LinkedIn easy apply workflow, AI resume builder, and interview prep tools.
              </p>
              <div className="space-y-4">
                {[
                  'Save 15+ hours per week on applications',
                  '3x more interview callbacks on average',
                  'Track everything in one organized dashboard',
                  'AI-powered resume optimization for each job'
                ].map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-gray-700 text-lg">{benefit}</span>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => navigate('/features')}
                className="mt-8 px-8 py-4 bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white rounded-xl font-semibold hover:shadow-xl hover:scale-105 transition-all duration-200 inline-flex items-center gap-2"
              >
                Explore All Features
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <div className="relative">
              <ExtensionDemoCard />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-blue-100 rounded-full text-blue-700 font-semibold text-sm mb-6">
              Features
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Job search automation tools that convert
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From LinkedIn auto apply to resume optimization and application tracking, built specifically for software engineers
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group bg-gradient-to-br from-white to-gray-50 rounded-2xl p-8 border-2 border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all duration-300"
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chrome Extensions Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-green-100 rounded-full text-green-700 font-semibold text-sm mb-6">
              Chrome Extensions
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              The #1 extensions for your hiring workflow
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Install directly from the Chrome Web Store — no ZIP files, no developer mode, no load unpacked.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="group bg-gradient-to-br from-blue-50 to-white rounded-2xl p-8 border-2 border-blue-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 flex flex-col">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">AutoApply CV LinkedIn Copilot</h3>
              <p className="text-gray-600 leading-relaxed flex-1 mb-6">
                The #1 LinkedIn auto apply extension in Chrome. Fills Easy Apply forms, reuses your screening answers, and tracks every submission.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/auto-apply-chrome-extension"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A855F7] px-6 py-3 font-bold text-white hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                >
                  Extension page
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="https://chromewebstore.google.com/detail/mcfmniiniaigfhhjlaegpmhecbdoikjd"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white border-2 border-blue-200 px-6 py-3 font-bold text-blue-700 hover:border-blue-400 hover:shadow-lg transition-all duration-200"
                >
                  <Download className="w-4 h-4" />
                  Install from Web Store
                </a>
              </div>
            </div>

            <div className="group bg-gradient-to-br from-indigo-50 to-white rounded-2xl p-8 border-2 border-indigo-200 hover:border-indigo-400 hover:shadow-xl transition-all duration-300 flex flex-col">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">HR Direct Outreach</h3>
              <p className="text-gray-600 leading-relaxed flex-1 mb-6">
                The #1 HR outreach extension for Chrome. Scrapes name, title, company, email & phone from LinkedIn hiring posts and syncs up to 100 contacts to your dashboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="https://chromewebstore.google.com/detail/cilkgachncgahbonpdcfjmjifingpnah"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3 font-bold text-white hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                >
                  <Download className="w-4 h-4" />
                  Install from Web Store
                </a>
                <Link
                  to="/hr-outreach"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white border-2 border-indigo-200 px-6 py-3 font-bold text-indigo-700 hover:border-indigo-400 hover:shadow-lg transition-all duration-200"
                >
                  Outreach dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Blog Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-2 bg-purple-100 rounded-full text-purple-700 font-semibold text-sm mb-5">
              Blog
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Free auto apply guides and SEO-friendly checklists
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Learn how to auto apply with quality controls, improve your resume for ATS, and track outcomes to get more interviews.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'The #1 Auto Apply Extension in Chrome', to: '/blog/no-1-auto-apply-extension-available-in-chrome' },
              { title: 'Why AutoApply CV Is #1 for LinkedIn', to: '/blog/why-autoapply-cv-is-no-1-linkedin-extension' },
              { title: 'LinkedIn Auto Apply vs HR Outreach', to: '/blog/best-linkedin-extension-hr-outreach-vs-auto-apply' }
            ].map((guide) => (
              <Link
                key={guide.to}
                to={guide.to}
                className="bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all duration-200"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-3">{guide.title}</h3>
                <p className="text-purple-700 font-semibold inline-flex items-center gap-2">
                  Read now
                  <ArrowRight className="w-4 h-4" />
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-purple-700 border-2 border-purple-200 hover:border-purple-300 hover:shadow-lg transition-all duration-200"
            >
              View all blogs
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white font-semibold text-sm mb-6">
              Success Stories
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Join thousands of successful engineers
            </h2>
            <p className="text-xl text-purple-100">
              Real results from real people using AutoApply CV
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300"
              >
                <div className="flex gap-1 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-300 text-yellow-300" />
                  ))}
                </div>
                <p className="text-lg text-white mb-6 leading-relaxed">
                  "{testimonial.content}"
                </p>
                <div className="flex items-center gap-4">
                  {testimonial.image ? (
                    <ImageWithFallback
                      src={testimonial.image}
                      alt={testimonial.name}
                      className="w-14 h-14 rounded-full object-cover border-2 border-white/30"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full border-2 border-white/30 bg-white/15 flex items-center justify-center text-sm font-bold text-white">
                      {testimonial.name
                        .split(' ')
                        .map((part) => part[0] || '')
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-white">{testimonial.name}</div>
                    <div className="text-sm text-purple-100">{testimonial.role}</div>
                    <div className="text-sm text-purple-200">{testimonial.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-gray-50 to-purple-50">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full text-purple-700 text-sm font-semibold mb-8">
            <Zap className="w-4 h-4" />
            Limited Time Offer
          </div>
          
          <h2 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6">
            Ready to automate your job search?
          </h2>
          
          <p className="text-xl text-gray-600 mb-12">
            Join 50,000+ engineers using AutoApply CV as their AI job search tool to auto apply, tailor resumes, and land interviews faster.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => navigate('/auto-apply')}
              className="px-10 py-5 bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2"
            >
              Start Free Auto Apply
              <ArrowRight className="w-5 h-5" />
            </button>
            <button 
              onClick={() => navigate('/features')}
              className="px-10 py-5 bg-white border-2 border-purple-200 text-gray-700 rounded-xl font-bold text-lg hover:border-purple-400 hover:shadow-lg transition-all duration-200"
            >
              Learn More
            </button>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center items-center gap-8 mt-12 pt-12 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              <span className="text-sm text-gray-600 font-medium">Secure & Private</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-600 font-medium">24/7 Support</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              <span className="text-sm text-gray-600 font-medium">No Credit Card Required</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
