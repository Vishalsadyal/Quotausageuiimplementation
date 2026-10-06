import { Link } from "react-router";
import { ArrowRight } from "lucide-react";

type MarketingMetric = {
  label: string;
  value: string;
  note?: string;
};

type MarketingCard = {
  kicker?: string;
  title: string;
  description: string;
};

type MarketingSection = {
  title: string;
  description?: string;
  cards?: MarketingCard[];
  bullets?: string[];
};

type MarketingAction = {
  label: string;
  to: string;
};

type MarketingInfoPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  metrics?: MarketingMetric[];
  sections: MarketingSection[];
  ctaTitle?: string;
  ctaDescription?: string;
  primaryAction?: MarketingAction;
  secondaryAction?: MarketingAction;
};

export default function MarketingInfoPage({
  eyebrow,
  title,
  description,
  metrics = [],
  sections,
  ctaTitle,
  ctaDescription,
  primaryAction,
  secondaryAction,
}: MarketingInfoPageProps) {
  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20 pb-16">
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
        <div className="max-w-6xl mx-auto px-6 lg:px-8 relative">
          <div className="max-w-4xl">
            <div className="inline-flex items-center rounded-full bg-purple-100 px-4 py-2 text-sm font-semibold text-purple-700">
              {eyebrow}
            </div>
            <h1 className="mt-6 text-4xl lg:text-6xl font-bold text-gray-900 leading-tight">{title}</h1>
            <p className="mt-6 text-lg lg:text-xl text-gray-600 leading-relaxed max-w-3xl">{description}</p>
          </div>
          {metrics.length > 0 ? (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((metric) => (
                <div
                  key={`${metric.label}-${metric.value}`}
                  className="rounded-2xl border border-purple-100 bg-white/80 backdrop-blur px-5 py-4 shadow-premium"
                >
                  <div className="text-sm text-gray-600">{metric.label}</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">{metric.value}</div>
                  {metric.note ? <div className="mt-1 text-xs text-purple-700">{metric.note}</div> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 space-y-16">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-3xl font-bold text-gray-900">{section.title}</h2>
              {section.description ? <p className="mt-3 text-lg text-gray-600 max-w-3xl">{section.description}</p> : null}

              {section.cards && section.cards.length > 0 ? (
                <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {section.cards.map((card) => (
                    <article
                      key={`${section.title}-${card.title}`}
                      className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 shadow-sm hover:shadow-premium transition-shadow"
                    >
                      {card.kicker ? <div className="text-xs font-semibold uppercase tracking-wide text-purple-700">{card.kicker}</div> : null}
                      <h3 className="mt-2 text-xl font-bold text-gray-900">{card.title}</h3>
                      <p className="mt-3 text-gray-600 leading-relaxed">{card.description}</p>
                    </article>
                  ))}
                </div>
              ) : null}

              {section.bullets && section.bullets.length > 0 ? (
                <ul className="mt-7 grid gap-3 md:grid-cols-2">
                  {section.bullets.map((bullet) => (
                    <li
                      key={`${section.title}-${bullet}`}
                      className="flex items-start gap-3 rounded-xl border border-purple-100 bg-purple-50/40 px-4 py-3 text-gray-700"
                    >
                      <span className="mt-2 h-2 w-2 rounded-full bg-purple-500 flex-shrink-0" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </section>

      {ctaTitle || ctaDescription || primaryAction || secondaryAction ? (
        <section className="pb-20">
          <div className="max-w-5xl mx-auto px-6 lg:px-8">
            <div className="rounded-3xl bg-[#6047f5] px-8 py-10 text-white shadow-premium-lg">
              {ctaTitle ? <h2 className="text-3xl font-bold">{ctaTitle}</h2> : null}
              {ctaDescription ? <p className="mt-3 text-purple-100 text-lg">{ctaDescription}</p> : null}
              {(primaryAction || secondaryAction) ? (
                <div className="mt-7 flex flex-wrap gap-3">
                  {primaryAction ? (
                    <Link
                      to={primaryAction.to}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-purple-700 hover:bg-purple-50 transition-colors"
                    >
                      {primaryAction.label}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : null}
                  {secondaryAction ? (
                    <Link
                      to={secondaryAction.to}
                      className="inline-flex items-center rounded-xl border border-white/40 bg-white/10 px-5 py-3 font-semibold text-white hover:bg-white/20 transition-colors"
                    >
                      {secondaryAction.label}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
