import { useNavigate } from 'react-router';
import { Heart, Target, Users, TrendingUp, ArrowRight } from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

export default function About() {
  const navigate = useNavigate();

  const values = [
    {
      icon: Heart,
      title: 'Engineer-First',
      description: 'Built by engineers, for engineers. We understand your journey.',
      gradient: 'from-red-500 to-pink-500'
    },
    {
      icon: Target,
      title: 'Results-Driven',
      description: 'Focused on outcomes that matter: more interviews, better offers.',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Users,
      title: 'Community-Powered',
      description: 'Learn from thousands of successful job seekers in our community.',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      icon: TrendingUp,
      title: 'Continuous Innovation',
      description: 'Always improving with the latest AI and automation technology.',
      gradient: 'from-green-500 to-emerald-500'
    }
  ];

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block px-4 py-2 bg-purple-100 rounded-full text-purple-700 text-sm font-semibold mb-6">
                Our Story
              </div>
              
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                We're on a mission to help{' '}
                <span className="bg-[#6047f5] bg-clip-text text-transparent">
                  every engineer
                </span>{' '}
                land their dream job
              </h1>
              
              <p className="text-xl text-gray-600 leading-relaxed mb-8">
                AutoApply CV was born from frustration with the traditional job search process. Free to start, built to help engineers land better roles faster with automation and clear guardrails.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => navigate('/pricing')}
                  className="px-8 py-4 bg-[#6047f5] text-white rounded-xl font-semibold hover:shadow-xl hover:-translate-y-px transition-all duration-200 inline-flex items-center justify-center gap-2"
                >
                  Join Our Mission
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="rounded-3xl overflow-hidden shadow-2xl">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1739298061766-e2751d92e9db?w=800"
                alt="Team"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { number: '50K+', label: 'Active Users' },
              { number: '500K+', label: 'Applications Sent' },
              { number: '15K+', label: 'Offers Received' },
              { number: '95%', label: 'Satisfaction Rate' }
            ].map((stat, index) => (
              <div key={index} className="text-center p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-blue-50">
                <div className="text-4xl font-bold bg-[#6047f5] bg-clip-text text-transparent mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 bg-gradient-to-br from-gray-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Our core values
            </h2>
            <p className="text-xl text-gray-600">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${value.gradient} flex items-center justify-center mb-6 shadow-lg`}>
                  <value.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{value.title}</h3>
                <p className="text-gray-600 leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What we do */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">What AutoApply CV does</h2>
              <p className="text-lg text-gray-600 leading-relaxed mb-4">
                Job searching has become a numbers game, and most of the time goes into retyping the same details into
                application forms. AutoApply CV takes that repetitive work off your plate without taking you out of
                control.
              </p>
              <p className="text-lg text-gray-600 leading-relaxed">
                Our Chrome extension fills LinkedIn Easy Apply forms with answers you have saved and checked once. It
                skips jobs you have already applied to, and it pauses when a question needs a human answer. The dashboard
                tailors your resume for applicant tracking systems and tracks every application from submission to
                interview, so you can see what is actually working.
              </p>
            </div>
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">How we build it</h2>
              <ul className="space-y-4 text-lg text-gray-600 leading-relaxed">
                <li>
                  <strong className="text-gray-900">Quality over volume.</strong> Targeting filters and daily limits keep
                  applications relevant, because a tailored application beats ten generic ones.
                </li>
                <li>
                  <strong className="text-gray-900">Truthful automation.</strong> The extension only uses answers you
                  provide. It never invents experience or fills a question it cannot answer honestly.
                </li>
                <li>
                  <strong className="text-gray-900">Transparent results.</strong> Every job ends as submitted, skipped, or
                  paused with a reason, and skipped jobs are never charged.
                </li>
                <li>
                  <strong className="text-gray-900">Fair pricing.</strong> Start free with 3 applications a day, or go
                  unlimited with Pro for ₹49 a month.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-[#6047f5] text-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            Join our growing community
          </h2>
          
          <p className="text-xl text-purple-100 mb-12">
            Be part of 50,000+ engineers transforming their careers
          </p>

          <button 
            onClick={() => navigate('/pricing')}
            className="px-10 py-5 bg-white text-purple-700 rounded-xl font-bold text-lg hover:bg-gray-100 shadow-2xl hover:-translate-y-px transition-all duration-200"
          >
            Get Started Today
          </button>
        </div>
      </section>
    </div>
  );
}
