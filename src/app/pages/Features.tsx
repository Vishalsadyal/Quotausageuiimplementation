import { useNavigate } from 'react-router';
import { 
  FileText, 
  Target, 
  BarChart3, 
  MessageSquare, 
  TrendingUp, 
  Users,
  Zap,
  Clock,
  Brain,
  Shield,
  ArrowRight,
  Check
} from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

export default function Features() {
  const navigate = useNavigate();

  const mainFeatures = [
    {
      icon: Zap,
      title: 'LinkedIn Auto Apply Bot & Easy Apply Copilot',
      description: 'Automatically apply to hundreds of LinkedIn and Indeed jobs with intelligent 1-click automation',
      details: [
        'Automated LinkedIn Easy Apply submission',
        'Custom screening answer bank auto-fill',
        'Human-paced delays for 100% account safety',
        'Duplicate application prevention',
        'Real-time status tracking & outcome logging'
      ],
      image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
      gradient: 'from-purple-600 to-indigo-600'
    },
    {
      icon: FileText,
      title: 'AI Resume Builder & ATS Tailor',
      description: 'Build and tailor your resume for each job posting with real-time ATS optimization',
      details: [
        'AI-powered keyword optimization',
        'ATS-friendly formatting',
        'Multiple resume versions',
        'Real-time preview',
        'PDF export'
      ],
      image: 'https://images.unsplash.com/photo-1580894896813-652ff5aa8146?w=800',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Target,
      title: 'Smart Job Matching Algorithm',
      description: 'Get compatibility scores and keyword alignment for every job opportunity',
      details: [
        'Match score algorithm',
        'Skill gap analysis',
        'Salary compatibility',
        'Location preferences',
        'Culture fit assessment'
      ],
      image: 'https://images.unsplash.com/photo-1580894896813-652ff5aa8146?w=800',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      icon: BarChart3,
      title: 'Application Tracker CRM',
      description: 'Manage your complete job application tracker and search pipeline',
      details: [
        'Kanban-style board',
        'Application status tracking',
        'Reminder system',
        'Notes and documents',
        'Interview scheduling'
      ],
      image: 'https://images.unsplash.com/photo-1718220216044-006f43e3a9b1?w=800',
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      icon: MessageSquare,
      title: 'Interview Preparation AI',
      description: 'Practice and ace your technical interviews with AI coaching',
      details: [
        'AI-generated questions',
        'Mock interview sessions',
        'Feedback and scoring',
        'Company-specific prep',
        'Video practice mode'
      ],
      image: 'https://images.unsplash.com/photo-1758518730380-04c8e0d57b68?w=800',
      gradient: 'from-orange-500 to-red-500'
    },
    {
      icon: TrendingUp,
      title: 'Analytics & Insights',
      description: 'Track your progress with detailed application metrics and conversion data',
      details: [
        'Callback rate tracking',
        'Application velocity',
        'Skill demand trends',
        'Weekly reports',
        'Goal setting'
      ],
      image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
      gradient: 'from-indigo-500 to-blue-500'
    },
    {
      icon: Users,
      title: 'Coach Workspace',
      description: 'Collaborate with career coaches or manage candidates',
      details: [
        'Multi-client dashboard',
        'Shared templates',
        'Progress tracking',
        'Team collaboration',
        'White-label options'
      ],
      image: 'https://images.unsplash.com/photo-1739298061766-e2751d92e9db?w=800',
      gradient: 'from-pink-500 to-rose-500'
    }
  ];

  const benefits = [
    {
      icon: Zap,
      title: 'Save Time',
      description: 'Automate repetitive tasks and focus on what matters',
      stat: '15hrs/week'
    },
    {
      icon: TrendingUp,
      title: 'More Interviews',
      description: 'Increase your callback rate significantly',
      stat: '3x more'
    },
    {
      icon: Brain,
      title: 'AI-Powered',
      description: 'Leverage an AI job search tool built for faster outcomes',
      stat: '95% accuracy'
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Your data is encrypted and never shared',
      stat: 'Bank-level'
    }
  ];

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-block px-4 py-2 bg-purple-100 rounded-full text-purple-700 text-sm font-semibold mb-6">
            Features & Capabilities
          </div>
          
          <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Powerful LinkedIn Auto Apply Bot &{' '}
            <span className="bg-[#6047f5] bg-clip-text text-transparent">
              Job Search Automation
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Free to start. Automatically apply to LinkedIn and Indeed jobs, optimize resumes with AI ATS keyword matching, and manage your entire application pipeline in one unified platform.
          </p>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="text-center p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100"
              >
                <div className={`w-16 h-16 rounded-2xl bg-[#6047f5] flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                  <benefit.icon className="w-8 h-8 text-white" />
                </div>
                <div className="text-3xl font-bold bg-[#6047f5] bg-clip-text text-transparent mb-2">
                  {benefit.stat}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-sm text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Features */}
      {mainFeatures.map((feature, index) => (
        <section 
          key={index}
          className={`py-24 ${index % 2 === 0 ? 'bg-white' : 'bg-gradient-to-br from-gray-50 to-purple-50'}`}
        >
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className={`grid lg:grid-cols-2 gap-12 items-center ${index % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}>
              <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 shadow-lg`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-4xl font-bold text-gray-900 mb-4">{feature.title}</h2>
                <p className="text-xl text-gray-600 mb-8">{feature.description}</p>
                
                <ul className="space-y-4 mb-8">
                  {feature.details.map((detail, dIndex) => (
                    <li key={dIndex} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-gray-700 text-lg">{detail}</span>
                    </li>
                  ))}
                </ul>

                <button 
                  onClick={() => navigate('/pricing')}
                  className="px-8 py-4 bg-[#6047f5] text-white rounded-xl font-semibold hover:shadow-xl hover:-translate-y-px transition-all duration-200 inline-flex items-center gap-2"
                >
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
                  <ImageWithFallback
                    src={feature.image}
                    alt={feature.title}
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* CTA Section */}
      <section className="py-24 bg-[#6047f5] text-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            Ready to transform your job search?
          </h2>
          
          <p className="text-xl text-purple-100 mb-12">
            Join 50,000+ engineers using AutoApply CV for job search automation, AI resume building, and interview preparation
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => navigate('/pricing')}
              className="px-10 py-5 bg-white text-purple-700 rounded-xl font-bold text-lg hover:bg-gray-100 shadow-2xl hover:-translate-y-px transition-all duration-200"
            >
              Start Free (Start Free Trial)
            </button>
            <button 
              onClick={() => navigate('/how-it-works')}
              className="px-10 py-5 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white rounded-xl font-bold text-lg hover:bg-white/20 transition-all duration-200"
            >
              See How It Works
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
