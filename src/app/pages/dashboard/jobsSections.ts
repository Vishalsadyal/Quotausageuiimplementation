import { BookOpen, Briefcase, LayoutGrid, MessageSquareText, SlidersHorizontal } from "lucide-react";

export type JobsSectionId = "autopilot" | "dictionary" | "screening" | "queue" | "settings";

// Each Auto Apply section has its own URL: /dashboard/jobs/:provider/:slug.
// The overview has no slug, so /dashboard/jobs/linkedin stays the landing page.
export const JOBS_SECTIONS = [
  { id: "autopilot", slug: "", label: "Overview", icon: LayoutGrid },
  { id: "dictionary", slug: "keywords", label: "Keywords", icon: BookOpen },
  { id: "screening", slug: "screening", label: "Screening Answers", icon: MessageSquareText },
  { id: "queue", slug: "queue", label: "Applications Queue", icon: Briefcase },
  { id: "settings", slug: "preferences", label: "Preferences", icon: SlidersHorizontal },
] as const satisfies ReadonlyArray<{ id: JobsSectionId; slug: string; label: string; icon: unknown }>;

export type JobsProvider = "linkedin" | "indeed";

export function jobsSectionFromSlug(slug: string | undefined): JobsSectionId | null {
  const match = JOBS_SECTIONS.find((section) => section.slug === (slug || ""));
  return match ? match.id : null;
}

export function jobsSectionPath(provider: JobsProvider, sectionId: JobsSectionId) {
  const section = JOBS_SECTIONS.find((item) => item.id === sectionId);
  return section?.slug ? `/dashboard/jobs/${provider}/${section.slug}` : `/dashboard/jobs/${provider}`;
}
