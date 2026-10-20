import { NextRequest } from "next/server";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { cacheGet, cacheSet } from "src/lib/cache";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";

// Turns the city the user typed in onboarding into map coordinates, or (mode=suggest) into a short
// list of matching places for autocomplete (OpenStreetMap Nominatim). Done on the server so the
// browser CSP stays closed and Nominatim gets a proper User-Agent.
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const q = String(req.nextUrl.searchParams.get("q") || "").trim().slice(0, 120);
    if (q.length < 2) return fail("Query too short", 400, "VALIDATION_ERROR");

    if (req.nextUrl.searchParams.get("mode") === "suggest") return suggest(req, q);

    const cacheKey = `geocode:${q.toLowerCase()}`;
    const cached = await cacheGet<{ lat: number; lon: number; label: string } | { none: true }>(cacheKey);
    if (cached) return ok("Location", "none" in cached ? null : cached);

    const rl = await enforceRateLimit({ key: rateLimitKey(req, "onboarding.geocode"), limit: 20, windowMs: 60_000 });
    if (rl) return rl;

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=0&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "AutoApplyCV/1.0 (https://www.autoapplycv.in)", "Accept-Language": "en" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return ok("Location", null);
    const rows = (await res.json().catch(() => [])) as Array<{ lat?: string; lon?: string; display_name?: string }>;
    const first = rows[0];
    const lat = Number(first?.lat);
    const lon = Number(first?.lon);
    if (!first || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      await cacheSet(cacheKey, { none: true }, CACHE_TTL_SECONDS);
      return ok("Location", null);
    }
    const result = { lat, lon, label: String(first.display_name || q).split(",").slice(0, 3).join(",").trim() };
    await cacheSet(cacheKey, result, CACHE_TTL_SECONDS);
    return ok("Location", result);
  } catch (error) {
    return handleApiError(error, "Failed to look up location");
  }
}

type Place = { city: string; state: string; country: string; label: string };

async function suggest(req: NextRequest, q: string) {
  const cacheKey = `geosuggest:${q.toLowerCase()}`;
  const cached = await cacheGet<Place[]>(cacheKey);
  if (cached) return ok("Places", cached);

  const rl = await enforceRateLimit({ key: rateLimitKey(req, "onboarding.geosuggest"), limit: 40, windowMs: 60_000 });
  if (rl) return rl;

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=8&addressdetails=1&featureType=settlement&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "AutoApplyCV/1.0 (https://www.autoapplycv.in)", "Accept-Language": "en" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return ok("Places", []);
  const rows = (await res.json().catch(() => [])) as Array<{ address?: Record<string, string> }>;
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const row of rows) {
    const a = row.address || {};
    const city = a.city || a.town || a.village || a.municipality || a.hamlet || a.county || "";
    const state = a.state || a.state_district || a.region || "";
    const country = a.country || "";
    if (!city || !country) continue;
    const label = [city, state, country].filter(Boolean).join(", ");
    if (seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    places.push({ city, state, country, label });
    if (places.length >= 5) break;
  }
  await cacheSet(cacheKey, places, CACHE_TTL_SECONDS);
  return ok("Places", places);
}
