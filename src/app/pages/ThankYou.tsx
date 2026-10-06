import { useNavigate } from 'react-router';
import { CheckCircle, Sparkles, Mail, Calendar, BookOpen, ArrowRight } from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

export default function ThankYou() {
  const navigate = useNavigate();

  const nextSteps = [
    {
      icon: Mail,
      title: 'Check Your Email',
      description: 'We\'ve sent a confirmation email with your account details and getting started guide.',
      action: 'Open Email',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Calendar,
      title: 'Complete Your Profile',
      description: 'Upload your resume and set your job preferences to get personalized matches.',
      action: 'Set Up Profile',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      icon: BookOpen,
      title: 'Explore Features',
      description: 'Watch our quick tutorial videos to learn how to maximize your success.',
      action: 'Watch Tutorials',
      gradient: 'from-green-500 to-emerald-500'
    }
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* Success Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20 pb-32">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSIjOEI1Q0Y2IiBzdHJva2Utd2lkdGg9IjAuNSIgb3BhY2l0eT0iMC4xIi8+PC9nPjwvc3ZnPg==')] opacity-40"></div>
        
        <div className="max-w-4xl mx-auto px-6 lg:px-8 relative text-center">
          {/* Success Icon */}
          <div className="relative inline-block mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full blur-2xl opacity-40 animate-pulse"></div>
            <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto shadow-2xl">
              <CheckCircle className="w-20 h-20 text-white" />
            </div>
          </div>

          {/* Confetti Effect */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full h-32 pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full animate-ping"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random()}s`
                }}
              />
            ))}
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-100 to-emerald-100 rounded-full text-green-700 text-sm font-semibold mb-6">
            <Sparkles className="w-4 h-4" />
            Welcome to AutoApply CV!
          </div>
          
          <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Thank You for{' '}
            <span className="bg-[#6047f5] bg-clip-text text-transparent">
              Choosing Us
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            You're now part of 50,000+ engineers who've transformed their careers. Let's get you started on your journey to landing your dream job!
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            {[
              { number: '3x', label: 'More Interviews' },
              { number: '60%', label: 'Faster Results' },
              { number: '24/7', label: 'Support' }
            ].map((stat, index) => (
              <div key={index} className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-purple-100 shadow-lg">
                <div className="text-3xl font-bold bg-[#6047f5] bg-clip-text text-transparent">
                  {stat.number}
                </div>
                <div className="text-sm text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Next Steps */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              What happens next?
            </h2>
            <p className="text-xl text-gray-600">
              Follow these steps to get started and maximize your success
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {nextSteps.map((step, index) => (
              <div
                key={index}
                className="group bg-gradient-to-br from-white to-gray-50 rounded-3xl p-8 border-2 border-gray-200 hover:border-purple-300 hover:shadow-2xl transition-all duration-300"
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <step.icon className="w-8 h-8 text-white" />
                </div>
                
                <div className="text-sm font-bold text-purple-600 mb-2">
                  STEP {index + 1}
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  {step.title}
                </h3>
                
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {step.description}
                </p>

                <button className="w-full px-6 py-3 bg-[#6047f5] text-white rounded-xl font-semibold hover:shadow-xl hover:-translate-y-px transition-all duration-200 flex items-center justify-center gap-2">
                  {step.action}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Start Guide */}
      <section className="py-24 bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Your quick start checklist
              </h2>
              
              <div className="space-y-4">
                {[
                  'Upload your resume or import from LinkedIn',
                  'Set your job preferences and target companies',
                  'Review your first AI-matched job opportunities',
                  'Customize your first application with AI',
                  'Set up email alerts and notifications',
                  'Explore interview prep and analytics tools'
                ].map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 bg-white rounded-xl p-4 shadow-sm border border-purple-100"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-gray-700 font-medium pt-0.5">{item}</span>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => navigate('/')}
                className="mt-8 px-8 py-4 bg-[#6047f5] text-white rounded-xl font-bold hover:shadow-xl hover:-translate-y-px transition-all duration-200 inline-flex items-center gap-2"
              >
                Go to Dashboard
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-3xl overflow-hidden shadow-2xl">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1643537243683-a61ba2e77cf1?w=800"
                alt="Celebration"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Support Section */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Need help getting started?
          </h2>
          
          <p className="text-xl text-gray-600 mb-12">
            Our support team is here 24/7 to help you succeed
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'Live Chat', description: 'Instant help from our team', icon: '💬' },
              { title: 'Email Support', description: 'support@autoapplycv.in', icon: '📧' },
              { title: 'Help Center', description: 'Browse our knowledge base', icon: '📚' }
            ].map((option, index) => (
              <button
                key={index}
                className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-6 border-2 border-purple-200 hover:border-purple-400 hover:shadow-lg transition-all duration-200"
              >
                <div className="text-4xl mb-3">{option.icon}</div>
                <h3 className="font-bold text-gray-900 mb-1">{option.title}</h3>
                <p className="text-sm text-gray-600">{option.description}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-[#6047f5] text-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm font-semibold mb-8">
            <Sparkles className="w-4 h-4" />
            Your Journey Starts Now
          </div>
          
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            Let's land your dream job together
          </h2>
          
          <p className="text-xl text-purple-100 mb-12">
            You're just a few clicks away from transforming your career
          </p>

          <button 
            onClick={() => navigate('/')}
            className="px-10 py-5 bg-white text-purple-700 rounded-xl font-bold text-lg hover:bg-gray-100 shadow-2xl hover:-translate-y-px transition-all duration-200 inline-flex items-center gap-2"
          >
            Start Using AutoApply CV
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>
    </div>
  );
}
