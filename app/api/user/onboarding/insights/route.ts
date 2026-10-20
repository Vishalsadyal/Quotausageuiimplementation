import { prisma } from "src/lib/prisma";
import { requireAuth } from "src/lib/guards";
import { handleApiError, ok } from "src/lib/api";
import { cacheGet, cacheSet } from "src/lib/cache";

// Real, aggregated community numbers for the onboarding side panels. No personal data: cities and
// job titles are only listed when at least MIN_GROUP users / applications share them.
const CACHE_KEY = "onboarding:insights:v1";
const CACHE_TTL_SECONDS = 60 * 30;
const MIN_GROUP = 2;

export type OnboardingInsights = {
  totalUsers: number;
  resumesUploaded: number;
  applicationsSent: number;
  linkedinPct: number;
  portfolioPct: number;
  topCities: Array<{ city: string; users: number }>;
  topTitles: Array<{ title: string; applications: number }>;
};

function cityKey(raw: string) {
  return raw.split(",")[0].trim().replace(/\s+/g, " ");
}

async function computeInsights(): Promise<OnboardingInsights> {
  const users = { role: "user" as const };
  const [totalUsers, resumesUploaded, applicationsSent, withLinkedin, withPortfolio, cityGroups, titleGroups] = await Promise.all([
    prisma.user.count({ where: users }),
    prisma.user.count({ where: { ...users, resumeFileName: { not: null } } }),
    prisma.application.count(),
    prisma.user.count({ where: { ...users, linkedinUrl: { not: null }, NOT: { linkedinUrl: "" } } }),
    prisma.user.count({ where: { ...users, portfolioUrl: { not: null }, NOT: { portfolioUrl: "" } } }),
    prisma.user.groupBy({ by: ["currentCity"], where: { ...users, currentCity: { not: null } }, _count: { _all: true } }),
    prisma.application.groupBy({
      by: ["title"],
      where: { title: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { title: "desc" } },
      take: 40,
    }),
  ]);

  // "Bangalore, Karnataka" and "bangalore" count as one city.
  const cities = new Map<string, { city: string; users: number }>();
  for (const group of cityGroups) {
    const name = cityKey(String(group.currentCity || ""));
    if (!name) continue;
    const key = name.toLowerCase();
    const entry = cities.get(key) || { city: name, users: 0 };
    entry.users += group._count._all;
    cities.set(key, entry);
  }
  const topCities = [...cities.values()].filter((c) => c.users >= MIN_GROUP).sort((a, b) => b.users - a.users).slice(0, 6);

  const titles = new Map<string, { title: string; applications: number }>();
  for (const group of titleGroups) {
    const name = String(group.title || "").trim().replace(/\s+/g, " ");
    if (!name || name.length > 60) continue;
    const key = name.toLowerCase();
    const entry = titles.get(key) || { title: name, applications: 0 };
    entry.applications += group._count._all;
    titles.set(key, entry);
  }
  const topTitles = [...titles.values()].filter((t) => t.applications >= MIN_GROUP).sort((a, b) => b.applications - a.applications).slice(0, 6);

  const pct = (n: number) => (totalUsers ? Math.round((n / totalUsers) * 100) : 0);
  return {
    totalUsers,
    resumesUploaded,
    applicationsSent,
    linkedinPct: pct(withLinkedin),
    portfolioPct: pct(withPortfolio),
    topCities,
    topTitles,
  };
}

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const cached = await cacheGet<OnboardingInsights>(CACHE_KEY);
    if (cached) return ok("Insights fetched", cached);
    const insights = await computeInsights();
    await cacheSet(CACHE_KEY, insights, CACHE_TTL_SECONDS);
    return ok("Insights fetched", insights);
  } catch (error) {
    return handleApiError(error, "Failed to load insights");
  }
}
