import { Star } from 'lucide-react';
import { publishedRatings, type RatingPlatform } from 'src/content/ratings';

const PLATFORM_META: Record<RatingPlatform, { name: string; color: string; mark: string }> = {
  g2: { name: 'G2', color: '#ff492c', mark: 'G2' },
  trustpilot: { name: 'Trustpilot', color: '#00b67a', mark: '★' },
  capterra: { name: 'Capterra', color: '#044d80', mark: 'C' },
  producthunt: { name: 'Product Hunt', color: '#da552f', mark: 'P' },
};

// "Top rated by" row. Renders nothing until real ratings are added in
// src/content/ratings.ts, so it never shows an unearned rating.
export function TopRatedBadges({ className = '' }: { className?: string }) {
  const ratings = publishedRatings();
  if (!ratings.length) return null;

  return (
    <div className={className}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#a49fc0] mb-1.5">Top rated by</div>
      <div className="flex flex-wrap gap-2">
        {ratings.map((r) => {
          const meta = PLATFORM_META[r.platform];
          return (
            <a
              key={r.platform}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#17152b] shadow-sm hover:-translate-y-px transition-transform"
              title={`${meta.name}: ${r.rating.toFixed(1)} out of 5${r.reviewCount ? ` from ${r.reviewCount} reviews` : ''}`}
            >
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-extrabold text-white"
                style={{ backgroundColor: meta.color }}
                aria-hidden="true"
              >
                {meta.mark}
              </span>
              {meta.name}
              <Star className="w-3 h-3 fill-[#fbbc04] text-[#fbbc04]" aria-hidden="true" />
              {r.rating.toFixed(1)}
            </a>
          );
        })}
      </div>
    </div>
  );
}
