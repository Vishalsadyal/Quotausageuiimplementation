import { useNavigate } from 'react-router';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function BlogLinkedInEasyApplyDoesItWork() {
  const navigate = useNavigate();

  return (
    <div className="bg-white">
      <section className="bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <p className="text-sm font-semibold text-purple-700 mb-4">linkedin easy apply does it work</p>
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            LinkedIn Easy Apply: Does It Work for Software Engineers?
          </h1>
          <p className="text-xl text-gray-600">
            LinkedIn Easy Apply can work, but results improve when you combine it with resume tailoring, targeting filters, and a job application tracker.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 space-y-10">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">When Easy Apply works best</h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />You apply early to relevant roles</li>
              <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />Your resume is tailored to each job description</li>
              <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />You track interviews and iterate weekly</li>
            </ul>
          </div>

          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why many applications fail</h2>
            <p className="text-gray-700 leading-relaxed">
              Poor-fit targeting and generic resumes are the two biggest reasons users think Easy Apply does not work. Job search automation should improve relevance, not just speed. Use ATS resume optimization and job match scoring before applying.
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8 border border-purple-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Better Easy Apply workflow</h2>
            <p className="text-gray-700 mb-6">
              AutoApply CV helps you apply to LinkedIn jobs automatically while keeping screening controls, resume optimization, and tracking in one dashboard.
            </p>
            <button
              onClick={() => navigate('/how-it-works')}
              className="inline-flex items-center gap-2 px-7 py-3 bg-[#6047f5] text-white rounded-xl font-semibold"
            >
              See how it works
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
