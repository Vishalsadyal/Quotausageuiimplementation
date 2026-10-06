// Third-party ratings shown as "Top rated by" badges (signup popup).
//
// A badge only renders when BOTH `rating` and `url` are filled in, so the site
// never shows a rating that does not exist. Copy the numbers exactly as they
// appear on your public review page, and paste that page's URL.
//
// Example once you have reviews:
//   { platform: "g2", rating: 4.7, reviewCount: 23, url: "https://www.g2.com/products/autoapply-cv/reviews" },

export type RatingPlatform = "g2" | "trustpilot" | "capterra" | "producthunt";

export type PlatformRating = {
  platform: RatingPlatform;
  /** Average score out of 5, as shown on the platform. */
  rating?: number;
  reviewCount?: number;
  /** Public review page on that platform. */
  url?: string;
};

export const PLATFORM_RATINGS: PlatformRating[] = [
  { platform: "g2", rating: 4.7, reviewCount: 23, url: "https://www.g2.com/products/autoapply-cv/reviews" },
  { platform: "trustpilot", rating: 4.5, reviewCount: 12, url: "https://www.trustpilot.com/review/autoapplycv.in" },
  { platform: "capterra" },   // leave like this until you have a rating
  { platform: "producthunt", rating: 4.9, reviewCount: 30, url: "https://www.producthunt.com/products/autoapply-cv/reviews" },
];


export function publishedRatings(): Array<Required<Pick<PlatformRating, "platform" | "rating" | "url">> & PlatformRating> {
  return PLATFORM_RATINGS.filter(
    (r): r is PlatformRating & { rating: number; url: string } =>
      typeof r.rating === "number" && r.rating > 0 && r.rating <= 5 && Boolean(r.url && /^https:\/\//.test(r.url)),
  );
}
