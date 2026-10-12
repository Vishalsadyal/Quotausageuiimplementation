import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "src/lib/guards";

export const dynamic = "force-dynamic";

interface SearchResult {
  name: string;
  title: string;
  company: string;
  email: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  snippet: string;
}

interface GoogleSearchItem {
  title?: string;
  snippet?: string;
  link?: string;
  pagemap?: {
    person?: Array<{ name?: string; title?: string; jobtitle?: string }>;
    metatags?: Array<{ [key: string]: string }>;
    organization?: Array<{ name?: string }>;
  };
}

/**
 * Extract email addresses from raw text using a regex.
 * Returns all emails found, deduplicated.
 */
function extractEmails(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  return [...new Set(matches)].filter(
    (e) =>
      !e.includes("example.com") &&
      !e.includes("sentry.io") &&
      !e.includes("placeholder") &&
      !e.endsWith(".png") &&
      !e.endsWith(".jpg")
  );
}

/**
 * Parse a Google CSE result item into a structured contact.
 * Returns null if we can't extract a usable email.
 */
function parseGoogleItem(item: GoogleSearchItem, index: number): SearchResult | null {
  const rawTitle = item.title || "";
  const snippet = item.snippet || "";
  const link = item.link || "";

  // Try to extract email from snippet / title / link
  const emailsFound = extractEmails(`${rawTitle} ${snippet} ${link}`);
  if (emailsFound.length === 0) return null;

  const email = emailsFound[0];

  // Try to get person name from structured pagemap
  const personEntry = item.pagemap?.person?.[0];
  const orgEntry = item.pagemap?.organization?.[0];

  const name =
    personEntry?.name ||
    extractPersonName(rawTitle) ||
    `Contact ${index + 1}`;

  const title =
    personEntry?.jobtitle ||
    personEntry?.title ||
    extractJobTitle(rawTitle) ||
    extractJobTitle(snippet) ||
    "HR / Hiring Manager";

  const company =
    orgEntry?.name ||
    extractCompanyFromUrl(link) ||
    extractCompanyFromTitle(rawTitle) ||
    "Unknown Company";

  const linkedinUrl = extractLinkedInUrl(`${rawTitle} ${snippet} ${link}`);

  return {
    name,
    title,
    company,
    email,
    linkedinUrl,
    websiteUrl: link && link.startsWith("http") ? new URL(link).origin : undefined,
    snippet: snippet.slice(0, 200),
  };
}

function extractPersonName(text: string): string {
  // Matches patterns like "John Smith - HR Manager at Acme"
  const m = text.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)/);
  return m ? m[1] : "";
}

function extractJobTitle(text: string): string {
  const patterns = [
    /\b(HR Manager|Human Resources Manager|Talent Acquisition|Recruiter|Technical Recruiter|Head of Talent|Hiring Manager|People Operations|VP of Engineering|Engineering Manager|CTO|CEO|Founder|Co-Founder|Director of Engineering|Director of HR|Director of Recruiting)\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return "";
}

function extractCompanyFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      return parts[0]
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  } catch {
    // ignore invalid URLs
  }
  return "";
}

function extractCompanyFromTitle(title: string): string {
  // Patterns like "John at Acme Corp" or "Jobs at Acme"
  const m = title.match(/(?:at|@)\s+([A-Za-z0-9 ]+?)(?:\s*[-|·]|$)/i);
  return m ? m[1].trim() : "";
}

function extractLinkedInUrl(text: string): string | undefined {
  const m = text.match(/https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+/);
  return m ? m[0] : undefined;
}

/**
 * Build the Google CSE query string with country and platform filters.
 */
function buildQuery(query: string, country: string, platform: string): string {
  const countryKeyword: Record<string, string> = {
    US: "site:linkedin.com OR site:indeed.com OR site:wellfound.com",
    CA: "site:ca.linkedin.com OR site:ca.indeed.com",
    UK: "site:uk.linkedin.com OR site:uk.indeed.com",
    AU: "site:au.linkedin.com",
    all: "",
  };

  const platformFilter: Record<string, string> = {
    linkedin: 'site:linkedin.com/in OR site:linkedin.com/pub',
    indeed: "site:indeed.com",
    google: "",
  };

  const parts = [query];

  if (platform !== "google") {
    parts.push(platformFilter[platform] || "");
  } else if (country !== "all") {
    parts.push(countryKeyword[country] || "");
  }

  // Always add email indicator so results are likely to have emails
  if (!query.toLowerCase().includes("email") && !query.toLowerCase().includes("contact")) {
    parts.push("email contact");
  }

  return parts.filter(Boolean).join(" ");
}

/**
 * POST /api/user/hr-outreach/search
 *
 * Body: { query: string, country: string, platform: string }
 *
 * Requires env vars:
 *   GOOGLE_CSE_API_KEY  – Google Custom Search JSON API key
 *   GOOGLE_CSE_ID       – Programmable Search Engine ID (cx)
 *
 * Returns: { results: SearchResult[] }
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const _userId = authResult.auth.user.id; // auth confirmed

    const body = (await req.json()) as {
      query?: string;
      country?: string;
      platform?: string;
    };

    const { query = "", country = "US", platform = "google" } = body;

    if (!query.trim()) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_CSE_API_KEY;
    const cseId = process.env.GOOGLE_CSE_ID;

    // If Google CSE not configured, return mock data for testing
    if (!apiKey || !cseId) {
      const mockResults: SearchResult[] = [
        {
          name: "Alice Johnson",
          title: "HR Manager",
          company: "TechCorp Solutions",
          email: "alice.johnson@techcorp.com",
          linkedinUrl: "https://linkedin.com/in/alicejohnson",
          websiteUrl: "https://techcorp.com",
          snippet: "Hiring for software engineering roles"
        },
        {
          name: "Bob Smith",
          title: "Recruiting Director",
          company: "InnovateTech Inc",
          email: "bob.smith@innovatetech.io",
          linkedinUrl: "https://linkedin.com/in/bobsmith",
          websiteUrl: "https://innovatetech.io",
          snippet: "We are hiring talented engineers"
        },
        {
          name: "Carol Davis",
          title: "Talent Acquisition Lead",
          company: "CloudFirst Systems",
          email: "carol.davis@cloudfirst.io",
          linkedinUrl: "https://linkedin.com/in/caroldavis",
          websiteUrl: "https://cloudfirst.io",
          snippet: "Looking for experienced developers"
        },
        {
          name: "David Chen",
          title: "VP of Human Resources",
          company: "DataViz Analytics",
          email: "david.chen@dataviz.com",
          linkedinUrl: "https://linkedin.com/in/davidchen",
          websiteUrl: "https://dataviz.com",
          snippet: "Open positions in multiple departments"
        },
        {
          name: "Emma Wilson",
          title: "Recruitment Specialist",
          company: "FullStack Digital",
          email: "emma.wilson@fullstack.dev",
          linkedinUrl: "https://linkedin.com/in/emmawilson",
          websiteUrl: "https://fullstack.dev",
          snippet: "We are expanding our tech team"
        }
      ];
      
      return NextResponse.json({ results: mockResults }, { status: 200 });
    }

    const builtQuery = buildQuery(query, country, platform);
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("cx", cseId);
    url.searchParams.set("q", builtQuery);
    url.searchParams.set("num", "10");

    // Filter by country using Google CSE's geolocation
    const glMap: Record<string, string> = { US: "us", CA: "ca", UK: "uk", AU: "au" };
    if (glMap[country]) url.searchParams.set("gl", glMap[country]);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const errText = await response.text();
      console.error("[hr-outreach/search] Google CSE error:", errText);
      return NextResponse.json(
        { error: "Google search request failed. Check your API key and CSE ID." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { items?: GoogleSearchItem[] };
    const items: GoogleSearchItem[] = data.items || [];

    const results: SearchResult[] = items
      .map((item, idx) => parseGoogleItem(item, idx))
      .filter((r): r is SearchResult => r !== null)
      .slice(0, 15);

    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    console.error("[hr-outreach/search] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
