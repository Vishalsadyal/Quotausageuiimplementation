import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, X, Zap, Crown, Users, ArrowRight, Sparkles, Shield, Clock } from 'lucide-react';
import { MediaSlot } from '../components/marketing/MediaSlot';

type Plan = {
  name: string;
  icon: typeof Zap;
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
  gradient: string;
  badge?: string;
  customPriceLabel?: string;
};

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const navigate = useNavigate();
  const mediaAssets = {
    billingEvidenceImageSrc: '/marketing/billing-evidence.png',
    billingEvidenceVideoSrc: '',
  };

  const plans: Plan[] = [
    {
      name: 'Free',
      icon: Zap,
      monthlyPrice: 0,
      yearlyPrice: 0,
      description: 'Starter access with daily apply limit',
      features: [
        '3 Auto-Apply actions per day (0/3 cap)',
        '30 Hires coins signup bonus',
        'Basic job matching',
        'Application tracker',
        'Resume builder',
        'Community support',
        'Email notifications'
      ],
      cta: 'Start Free ($0)',
      popular: false,
      gradient: 'from-gray-600 to-gray-700'
    },
    {
      name: 'Pro',
      icon: Crown,
      monthlyPrice: 0.59,
      yearlyPrice: 5.9,
      customPriceLabel: '₹49 / month',
      description: 'Unlimited applications with premium automation',
      features: [
        'Unlimited Auto-Apply',
        'HR Recruiter Direct Email & Phone Extractor',
        'Advanced AI job matching',
        'AI resume builder and optimization',
        'Interview preparation AI tools',
        'Weekly analytics dashboard',
        'Priority support',
        'Cover letter generator',
        'LinkedIn & Indeed automation'
      ],
      cta: 'Start Pro (₹49/mo)',
      popular: true,
      gradient: 'from-[#6366F1] via-[#8B5CF6] to-[#A855F7]',
      badge: 'LIMITED OFFER • 90% OFF'
    },
    {
      name: 'Custom Hires',
      icon: Users,
      monthlyPrice: 0,
      yearlyPrice: 0,
      customPriceLabel: '$0.54 min top-up',
      description: 'Pay-as-you-go wallet, no monthly commitment',
      features: [
        'Buy only what you need',
        '1 Hire = 1 Apply',
        'Minimum top-up $0.54',
        'Works with daily cap controls',
        'No monthly subscription',
        'Great for flexible usage'
      ],
      cta: 'Go to Hires Wallet',
      popular: false,
      gradient: 'from-purple-600 to-pink-600'
    }
  ];

  const billingRules = [
    { event: 'Application submitted successfully', charged: true, note: 'Counts as 1 apply action or 1 Hire credit.' },
    { event: 'Skipped: External Apply only', charged: false, note: 'Not counted when easy-apply-only is enabled.' },
    { event: 'Skipped: Already applied / cache hit', charged: false, note: 'Duplicate prevention avoids repeat charging.' },
    { event: 'Skipped: Validation error (form blocked)', charged: false, note: 'Run pauses and asks for corrected answer.' },
    { event: 'Paused/stopped by operator before submit', charged: false, note: 'No submit means no charge event.' },
  ];

  const handleSelectPlan = (planName: string) => {
    if (planName === 'Custom Hires') {
      navigate('/dashboard/billing');
      return;
    }
    navigate(`/signup?plan=${planName.toLowerCase().replace(/\s+/g, '-')}`);
  };

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative text-center">
          <div className="inline-block px-4 py-2 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full text-purple-700 text-sm font-semibold mb-6">
            <Sparkles className="w-4 h-4 inline mr-2" />
            3 Simple Plans
          </div>

          <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Clear pricing in <span className="bg-gradient-to-r from-[#6366F1] to-[#A855F7] bg-clip-text text-transparent">USD</span>
          </h1>

          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-10">
            Free ($0) with 3/day, Pro at $3/month unlimited, or Custom Hires top-up when you need flexibility.
          </p>

          <div className="inline-flex items-center gap-3 bg-white rounded-full p-2 shadow-lg border border-gray-200">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2.5 rounded-full font-semibold transition-all duration-200 ${
                billingCycle === 'monthly'
                  ? 'bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2.5 rounded-full font-semibold transition-all duration-200 relative ${
                billingCycle === 'yearly'
                  ? 'bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Yearly
            </button>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative rounded-3xl p-8 transition-all duration-300 ${
                  plan.popular
                    ? 'bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white shadow-2xl scale-105 border-4 border-purple-300'
                    : 'bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 hover:border-purple-300 hover:shadow-xl'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 px-6 py-2 rounded-full text-sm font-bold shadow-lg">
                    {plan.badge}
                  </div>
                )}

                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-6 shadow-lg`}>
                  <plan.icon className="w-8 h-8 text-white" />
                </div>

                <h3 className={`text-2xl font-bold mb-2 ${plan.popular ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
                <p className={`mb-6 ${plan.popular ? 'text-purple-100' : 'text-gray-600'}`}>{plan.description}</p>

                <div className="mb-8">
                  <div className="flex items-baseline gap-2">
                    {plan.customPriceLabel ? (
                      <span className={`text-4xl font-bold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>{plan.customPriceLabel}</span>
                    ) : (
                      <>
                        <span className={`text-5xl font-bold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                          ${billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
                        </span>
                        <span className={plan.popular ? 'text-purple-100' : 'text-gray-600'}>
                          /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        plan.popular ? 'bg-white/20' : 'bg-green-100'
                      }`}>
                        <Check className={`w-3 h-3 ${plan.popular ? 'text-white' : 'text-green-600'}`} />
                      </div>
                      <span className={plan.popular ? 'text-purple-50' : 'text-gray-700'}>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan.name)}
                  className={`w-full py-4 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                    plan.popular
                      ? 'bg-white text-purple-700 hover:bg-gray-100 shadow-lg'
                      : 'bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white hover:shadow-xl hover:scale-105'
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-br from-slate-50 to-white border-y border-gray-200">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-8">
            <div className="inline-block px-4 py-2 bg-green-100 rounded-full text-green-700 text-sm font-semibold mb-4">
              Billing Transparency
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">Exactly what is charged and what is not</h2>
            <p className="text-lg text-gray-600">
              Compare tools on billing clarity. AutoApply CV records charge intent only on successful submit outcomes.
            </p>
          </div>

          <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">
            {billingRules.map((rule, index) => (
              <div
                key={rule.event}
                className={`grid md:grid-cols-[1.2fr_0.45fr_1.35fr] gap-3 px-5 py-4 ${index === billingRules.length - 1 ? '' : 'border-b border-gray-100'}`}
              >
                <div className="font-semibold text-gray-900">{rule.event}</div>
                <div>
                  {rule.charged ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                      Charged
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">
                      <X className="w-3.5 h-3.5" />
                      Not Charged
                    </span>
                  )}
                </div>
                <div className="text-gray-600">{rule.note}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl overflow-hidden border border-gray-200 bg-white">
            <MediaSlot
              imageSrc={mediaAssets.billingEvidenceImageSrc}
              videoSrc={mediaAssets.billingEvidenceVideoSrc}
              className="w-full h-[260px] object-cover"
              placeholderTitle="Billing evidence media"
              placeholderHint="Add log screenshot or 15-20s clip showing charged vs skipped outcomes in real runs."
              videoControls
            />
          </div>
        </div>
      </section>

      <section className="py-24 bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm font-semibold mb-8">
            <Sparkles className="w-4 h-4" />
            Join 50,000+ Engineers
          </div>

          <h2 className="text-4xl lg:text-5xl font-bold mb-6">Start your journey today</h2>

          <p className="text-xl text-purple-100 mb-12">Free starts at $0 with 3/day. Pro is $3/month unlimited.</p>

          <button
            onClick={() => handleSelectPlan('Free')}
            className="px-10 py-5 bg-white text-purple-700 rounded-xl font-bold text-lg hover:bg-gray-100 shadow-2xl hover:scale-105 transition-all duration-200 inline-flex items-center gap-2"
          >
            Start Free ($0)
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap justify-center items-center gap-8 mt-12 pt-12 border-t border-white/20">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span className="text-sm">Secure Payments</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span className="text-sm">14-Day Money Back</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5" />
              <span className="text-sm">Cancel Anytime</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
