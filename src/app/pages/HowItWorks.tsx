import { useNavigate } from 'react-router';
import { Download, Target, Rocket, Check, ArrowRight, Play, Shield, Clock, MessageSquare } from 'lucide-react';
import { MediaSlot } from '../components/marketing/MediaSlot';

export default function HowItWorks() {
  const navigate = useNavigate();
  const mediaAssets = {
    demoVideoSrc: '/uploads/resumes/AutoApplyMax.mp4',
    demoPosterSrc: '',
    guardrailVideoSrcs: [
      '/uploads/resumes/AutoApplyMax.mp4',
      '/uploads/resumes/AutoApplyMax.mp4',
      '/uploads/resumes/AutoApplyMax.mp4',
    ],
  };

  const steps = [
    {
      number: '01',
      icon: Download,
      title: 'Install Extension',
      description: 'Install the AutoApply CV Chrome extension, connect it to your account, and launch your LinkedIn automation flow in minutes.',
      mediaImageSrc: '/marketing/howitworks-install.png',
      details: [
        'One-click Chrome extension setup',
        'Connect directly with AutoApply CV',
        'Sync screening answers from dashboard',
        'Start from LinkedIn Jobs instantly',
      ],
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      number: '02',
      icon: Target,
      title: 'Match & Customize',
      description: 'Get personalized job matches with compatibility scores. Auto-tailor your resume for each application with one click.',
      mediaImageSrc: '/marketing/howitworks-match.png',
      details: [
        'AI job matching',
        'Compatibility scoring',
        'One-click customization',
        'ATS optimization'
      ],
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      number: '03',
      icon: Rocket,
      title: 'Auto Apply & Track',
      description: 'Apply to LinkedIn jobs automatically, then manage your full pipeline with a built-in job application tracker and analytics.',
      mediaImageSrc: '/marketing/howitworks-track.png',
      details: [
        'LinkedIn easy apply automation',
        'Pipeline management',
        'Interview prep tools',
        'Progress analytics'
      ],
      gradient: 'from-green-500 to-emerald-500'
    }
  ];

  const runGuardrails = [
    {
      icon: Clock,
      title: 'Wait-for-ready checks',
      detail: 'Before every answer/submit action, the extension verifies modal state and required button visibility.',
    },
    {
      icon: Shield,
      title: 'Duplicate + retry cooldown',
      detail: 'Already-applied jobs and recently-attempted jobs are skipped to prevent refresh loops and repeat actions.',
    },
    {
      icon: MessageSquare,
      title: 'Validation feedback to dashboard',
      detail: 'If LinkedIn returns a red field error, the run pauses and requests the exact corrected value.',
    },
  ];

  const guardrailMediaHints = [
    'Add 10-15s clip: wait for modal/form readiness before answering.',
    'Add 10-15s clip: already-applied and cooldown skip behavior.',
    'Add 10-15s clip: validation error -> dashboard correction -> resume.',
  ];

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-block px-4 py-2 bg-purple-100 rounded-full text-purple-700 text-sm font-semibold mb-6">
            How It Works
          </div>
          
          <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            From AI resume builder to{' '}
            <span className="bg-[#6047f5] bg-clip-text text-transparent">
              LinkedIn auto apply
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Free to start. Get started in minutes with job search automation, ATS resume optimization, and application tracking. No technical knowledge required.
          </p>

          <button className="px-8 py-4 bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 inline-flex items-center gap-2">
            <Play className="w-5 h-5" />
            Watch 2-min Demo Video
          </button>

          <div className="mt-8 max-w-5xl mx-auto rounded-2xl overflow-hidden border border-indigo-200 bg-white shadow-sm">
            <MediaSlot
              videoSrc={mediaAssets.demoVideoSrc}
              posterSrc={mediaAssets.demoPosterSrc}
              className="w-full h-[320px] object-cover"
              placeholderTitle="How-it-works demo video"
              placeholderHint="Add a 90-120s walkthrough: setup, run guardrails, and dashboard correction flow."
              videoControls
            />
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="space-y-32">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                  {/* Content */}
                  <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                    <div className="text-8xl font-bold text-gray-100 mb-4">{step.number}</div>
                    <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mb-6 shadow-xl`}>
                      <step.icon className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-4xl font-bold text-gray-900 mb-4">{step.title}</h2>
                    <p className="text-xl text-gray-600 mb-8 leading-relaxed">{step.description}</p>
                    
                    <ul className="space-y-4">
                      {step.details.map((detail, dIndex) => (
                        <li key={dIndex} className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-gray-700 text-lg">{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Visual */}
                  <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                    <div className={`rounded-3xl bg-gradient-to-br ${step.gradient} p-1 shadow-2xl`}>
                      <div className="rounded-3xl bg-white overflow-hidden h-96">
                        <MediaSlot
                          imageSrc={step.mediaImageSrc}
                          className="w-full h-full object-cover"
                          placeholderTitle={`${step.title} media`}
                          placeholderHint="Add a real screenshot that matches this step."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connecting Line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute left-1/2 bottom-0 w-1 h-32 bg-gradient-to-b from-purple-300 to-transparent -mb-32"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-2 bg-indigo-100 rounded-full text-indigo-700 text-sm font-semibold mb-4">
              Run Guardrails
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Safety checks built into each apply cycle</h2>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto">
              This is where reliable automation differs from generic auto-apply tools: stable waits, dedupe logic, and actionable pauses.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {runGuardrails.map((item, index) => (
              <div key={item.title} className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
                <div className="w-11 h-11 rounded-xl bg-[#6047f5] flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.detail}</p>
                <div className="mt-4 rounded-xl overflow-hidden border border-gray-200">
                  <MediaSlot
                    videoSrc={mediaAssets.guardrailVideoSrcs[index]}
                    className="w-full h-[140px] object-cover"
                    placeholderTitle={`${item.title} media`}
                    placeholderHint={guardrailMediaHints[index] || 'Add short feature clip.'}
                    videoControls
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white border border-gray-200 p-7">
            <h3 className="text-xl font-bold text-gray-900 mb-4">If LinkedIn returns an input error</h3>
            <ol className="space-y-3 text-gray-700">
              <li className="flex items-start gap-3"><span className="font-bold text-indigo-600">1.</span><span>AutoApply CV captures the exact LinkedIn error text (example: decimal number format issue).</span></li>
              <li className="flex items-start gap-3"><span className="font-bold text-indigo-600">2.</span><span>The run pauses automatically so no incorrect submission is attempted.</span></li>
              <li className="flex items-start gap-3"><span className="font-bold text-indigo-600">3.</span><span>You update the answer in dashboard and the run resumes from the same queue safely.</span></li>
            </ol>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-24 bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Typical journey timeline
            </h2>
            <p className="text-xl text-gray-600">
              See how fast you can get results
            </p>
          </div>

          <div className="space-y-8">
            {[
              { time: 'Day 1', action: 'Install extension and connect account', result: 'Automation ready in 5 minutes' },
              { time: 'Day 2-3', action: 'Get job matches', result: 'Receive 20-50 compatible jobs' },
              { time: 'Week 1', action: 'Apply to positions', result: 'Send 10-30 tailored applications' },
              { time: 'Week 2-3', action: 'Interview invitations', result: '3-5 interview callbacks' },
              { time: 'Week 4-6', action: 'Interview process', result: 'Multiple offer letters' }
            ].map((milestone, index) => (
              <div key={index} className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-32">
                  <div className="text-xl font-bold bg-[#6047f5] bg-clip-text text-transparent">
                    {milestone.time}
                  </div>
                </div>
                <div className="flex-1 bg-white rounded-xl p-6 shadow-md border border-purple-100">
                  <h3 className="font-bold text-gray-900 mb-1">{milestone.action}</h3>
                  <p className="text-gray-600">{milestone.result}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-[#6047f5] text-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            Start your success story today
          </h2>
          
          <p className="text-xl text-purple-100 mb-12">
            Join thousands of engineers who've transformed their careers
          </p>

          <button 
            onClick={() => navigate('/pricing')}
            className="px-10 py-5 bg-white text-purple-700 rounded-xl font-bold text-lg hover:bg-gray-100 shadow-2xl hover:-translate-y-px transition-all duration-200 inline-flex items-center gap-2"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>
    </div>
  );
}
