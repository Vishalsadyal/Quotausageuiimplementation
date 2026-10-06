import { useNavigate } from 'react-router';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function BlogBestAiJobSearchTools() {
  const navigate = useNavigate();

  return (
    <div className="bg-white">
      <section className="bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <p className="text-sm font-semibold text-purple-700 mb-4">best ai job search tools</p>
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Best AI Job Search Tools in 2026: Practical Picks for Engineers
          </h1>
          <p className="text-xl text-gray-600">
            The best AI job search tools combine job discovery, resume optimization, and application tracking so you can improve callbacks consistently.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 space-y-10">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How to evaluate AI job tools</h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />Does it improve ATS keyword alignment?</li>
              <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />Can you apply to jobs automatically with quality controls?</li>
              <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />Do you get analytics for callbacks and interview rates?</li>
            </ul>
          </div>

          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Common mistake to avoid</h2>
            <p className="text-gray-700 leading-relaxed">
              Many users choose tools based only on automation speed. That usually creates low-fit applications. A better setup uses AI resume builder workflows plus match scoring and a job application tracker to focus on fit first.
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8 border border-purple-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">One workflow, end to end</h2>
            <p className="text-gray-700 mb-6">
              AutoApply CV combines LinkedIn auto apply workflows, ATS resume optimization, and interview prep AI in one platform.
            </p>
            <button
              onClick={() => navigate('/features')}
              className="inline-flex items-center gap-2 px-7 py-3 bg-[#6047f5] text-white rounded-xl font-semibold"
            >
              Explore features
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
