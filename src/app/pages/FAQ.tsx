import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown, MessageCircle, ArrowRight } from 'lucide-react';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const navigate = useNavigate();

  const faqs = [
    {
      category: 'Getting Started',
      questions: [
        {
          q: 'How do I get started with AutoApply CV?',
          a: 'Simply sign up for a free account, upload your resume or import from LinkedIn, and you\'ll be matched with jobs within minutes. Our onboarding process takes less than 5 minutes.'
        },
        {
          q: 'Do I need to provide my credit card for the free plan?',
          a: 'No! Our free plan requires no credit card. You can start using AutoApply CV immediately and upgrade anytime when you need more features.'
        },
        {
          q: 'Can I import my resume from LinkedIn?',
          a: 'Yes! We offer one-click LinkedIn import that automatically extracts your experience, skills, and education into your AutoApply CV profile.'
        }
      ]
    },
    {
      category: 'Features & Functionality',
      questions: [
        {
          q: 'How does the AI resume tailor work?',
          a: 'Our AI analyzes job descriptions and automatically optimizes your resume by highlighting relevant skills, adjusting keywords for ATS systems, and reorganizing content to match what recruiters are looking for.'
        },
        {
          q: 'What is the job match score?',
          a: 'The match score is an AI-calculated compatibility rating (0-100%) based on your skills, experience, salary expectations, location preferences, and the job requirements. Higher scores indicate better fits.'
        },
        {
          q: 'How many applications can I send with the free plan?',
          a: 'Free (₹0) includes 3 Auto-Apply actions per day, and new accounts get a free 30 Hires coins signup bonus. If you need more volume, you can upgrade to Pro (₹49/month) for unlimited applications or use Custom Hires top-up (1 Hire = 1 Apply, minimum top-up $0.54).'
        },
        {
          q: 'Is AutoApply CV a LinkedIn auto apply bot?',
          a: 'AutoApply CV includes LinkedIn easy apply automation to help you apply faster, plus safeguards and review controls so you can stay in charge of your job search.'
        },
        {
          q: 'Do you include a job application tracker?',
          a: 'Yes. Every plan includes a job application tracker so you can organize roles by stage, add notes, and monitor interview progress from one dashboard.'
        }
      ]
    },
    {
      category: 'Pricing & Plans',
      questions: [
        {
          q: 'Can I upgrade or downgrade my plan at any time?',
          a: 'Yes! You can change your plan anytime. Upgrades take effect immediately, and downgrades will apply at the end of your current billing cycle.'
        },
        {
          q: 'What payment methods do you accept?',
          a: 'We accept all major credit cards (Visa, Mastercard, Amex), PayPal, and bank transfers for annual plans.'
        },
        {
          q: 'Do you offer refunds?',
          a: 'Yes, we offer a 14-day money-back guarantee on all paid plans. If you\'re not satisfied, contact support for a full refund, no questions asked.'
        },
        {
          q: 'Is there a discount for annual plans?',
          a: 'Yes! Annual plans save you 17% compared to monthly billing. That\'s about 2 months free!'
        }
      ]
    },
    {
      category: 'Privacy & Security',
      questions: [
        {
          q: 'Is my data secure?',
          a: 'Absolutely. We use bank-level encryption (AES-256) to protect your data. Your information is never shared with third parties without your explicit consent.'
        },
        {
          q: 'Who can see my resume and applications?',
          a: 'Only you have access to your data by default. If you work with a career coach, you can grant them limited access. We never share your information with recruiters or companies without your permission.'
        },
        {
          q: 'Can I delete my data?',
          a: 'Yes, you have full control over your data. You can export or delete all your data at any time from your account settings.'
        }
      ]
    },
    {
      category: 'Technical Support',
      questions: [
        {
          q: 'What kind of support do you offer?',
          a: 'Free users get email support with 48-hour response time. Pro users get priority email support with 24-hour response. Coach plan includes dedicated account management.'
        },
        {
          q: 'Do you have a mobile app?',
          a: 'Not yet, but our web platform is fully responsive and works great on mobile devices. A native mobile app is on our roadmap for 2026.'
        },
        {
          q: 'What browsers are supported?',
          a: 'AutoApply CV works on all modern browsers including Chrome, Firefox, Safari, and Edge. We recommend using the latest version for the best experience.'
        },
        {
          q: 'Can I use AutoApply CV as an AI resume builder?',
          a: 'Yes. You can use the AI resume builder to tailor resume content for specific job descriptions and improve ATS keyword alignment before applying.'
        }
      ]
    }
  ];

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-block px-4 py-2 bg-purple-100 rounded-full text-purple-700 text-sm font-semibold mb-6">
            Help Center
          </div>
          
          <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Frequently Asked{' '}
            <span className="bg-[#6047f5] bg-clip-text text-transparent">
              Questions
            </span>
          </h1>
          
          <p className="text-xl text-gray-600">
            Answers about LinkedIn auto apply, AI resume builder tools, pricing, and job search automation
          </p>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          {faqs.map((category, catIndex) => (
            <div key={catIndex} className="mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-8">
                {category.category}
              </h2>
              
              <div className="space-y-4">
                {category.questions.map((faq, faqIndex) => {
                  const globalIndex = catIndex * 100 + faqIndex;
                  const isOpen = openIndex === globalIndex;
                  
                  return (
                    <div
                      key={faqIndex}
                      className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-2xl overflow-hidden hover:border-purple-300 transition-all duration-200"
                    >
                      <button
                        onClick={() => setOpenIndex(isOpen ? null : globalIndex)}
                        className="w-full px-6 py-5 flex items-center justify-between text-left"
                      >
                        <span className="text-lg font-semibold text-gray-900 pr-4">
                          {faq.q}
                        </span>
                        <ChevronDown
                          className={`w-6 h-6 text-purple-600 flex-shrink-0 transition-transform duration-300 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      
                      {isOpen && (
                        <div className="px-6 pb-5 animate-in slide-in-from-top-2 duration-200">
                          <p className="text-gray-600 leading-relaxed">{faq.a}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact Support */}
      <section className="py-24 bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="bg-white rounded-3xl shadow-2xl p-12 text-center border border-purple-100">
            <div className="w-20 h-20 rounded-full bg-[#6047f5] flex items-center justify-center mx-auto mb-6 shadow-lg">
              <MessageCircle className="w-10 h-10 text-white" />
            </div>
            
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Still have questions?
            </h2>
            
            <p className="text-xl text-gray-600 mb-8">
              Our support team is here to help. Get in touch and we'll respond within 24 hours.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="px-8 py-4 bg-[#6047f5] text-white rounded-xl font-semibold hover:shadow-xl hover:-translate-y-px transition-all duration-200">
                Contact Support
              </button>
              <button 
                onClick={() => navigate('/pricing')}
                className="px-8 py-4 bg-gradient-to-br from-purple-50 to-blue-50 text-purple-700 rounded-xl font-semibold border-2 border-purple-200 hover:border-purple-400 transition-all duration-200"
              >
                View Pricing
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Getting Started Guide',
                description: 'Step-by-step guide to set up your account',
                link: '/how-it-works'
              },
              {
                title: 'Feature Documentation',
                description: 'Learn about all our powerful features',
                link: '/features'
              },
              {
                title: 'SEO Blog Guides',
                description: 'Learn practical auto-apply and resume tactics',
                link: '/blog'
              }
            ].map((resource, index) => (
              <button
                key={index}
                onClick={() => resource.link !== '#' && navigate(resource.link)}
                className="group bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all duration-200 text-left"
              >
                <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center justify-between">
                  {resource.title}
                  <ArrowRight className="w-5 h-5 text-purple-600 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-gray-600">{resource.description}</p>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
