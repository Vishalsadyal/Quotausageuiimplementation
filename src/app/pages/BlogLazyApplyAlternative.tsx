import { useNavigate } from 'react-router';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function BlogLazyApplyAlternative() {
  const navigate = useNavigate();

  return (
    <div className="bg-white">
      <section className="bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <p className="text-sm font-semibold text-purple-700 mb-4">lazyapply alternative</p>
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            LazyApply Alternative: What to Pick for Better Interview Results
          </h1>
          <p className="text-xl text-gray-600">
            If you need a LazyApply alternative, prioritize control, ATS resume optimization, and a built-in job application tracker instead of blind volume.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 space-y-10">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">What matters most in a LinkedIn auto apply bot</h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />Resume tailoring before each apply action</li>
              <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />Screening question controls and review checkpoints</li>
              <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />Post-apply tracking and interview analytics</li>
            </ul>
          </div>

          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why alternatives outperform one-click bots</h2>
            <p className="text-gray-700 leading-relaxed">
              Most users searching for a LazyApply alternative want higher callback quality, not just higher application count. A stronger workflow combines AI resume builder support with filtered job matching and a job application tracker so each application is relevant and measurable.
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8 border border-purple-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Recommended setup</h2>
            <p className="text-gray-700 mb-6">
              Use AutoApply CV to apply to LinkedIn jobs automatically with resume tailoring, ATS checks, and pipeline tracking in one place.
            </p>
            <button
              onClick={() => navigate('/pricing')}
              className="inline-flex items-center gap-2 px-7 py-3 bg-[#6047f5] text-white rounded-xl font-semibold"
            >
              Compare plans
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
