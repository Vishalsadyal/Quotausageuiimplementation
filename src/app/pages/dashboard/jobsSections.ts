import { BookOpen, LayoutGrid, MessageSquareText, Send, SlidersHorizontal } from "lucide-react";

export type JobsSectionId = "autopilot" | "dictionary" | "screening" | "settings" | "messages";

// Each Auto Apply section has its own URL: /dashboard/jobs/:provider/:slug.
// The overview has no slug, so /dashboard/jobs/linkedin stays the landing page.
export const JOBS_SECTIONS = [
  { id: "autopilot", slug: "", label: "Overview", icon: LayoutGrid },
  { id: "dictionary", slug: "keywords", label: "Keywords", icon: BookOpen },
  { id: "screening", slug: "screening", label: "Screening Answers", icon: MessageSquareText },
  { id: "settings", slug: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "messages", slug: "messages", label: "Messages", icon: Send },
] as const satisfies ReadonlyArray<{ id: JobsSectionId; slug: string; label: string; icon: unknown }>;

// The Applications page lives at its own URL but is listed inside the Auto Apply menu (after Screening Answers).
export const APPLICATIONS_PATH = "/dashboard/applications";

export type JobsProvider = "linkedin" | "indeed";

// Indeed is still in beta, so the LinkedIn / Indeed switch in the Auto Apply header is hidden.
// Set to true to show it again.
export const SHOW_INDEED_SWITCH = false;

export function jobsSectionFromSlug(slug: string | undefined): JobsSectionId | null {
  const match = JOBS_SECTIONS.find((section) => section.slug === (slug || ""));
  return match ? match.id : null;
}

export function jobsSectionPath(provider: JobsProvider, sectionId: JobsSectionId) {
  const section = JOBS_SECTIONS.find((item) => item.id === sectionId);
  return section?.slug ? `/dashboard/jobs/${provider}/${section.slug}` : `/dashboard/jobs/${provider}`;
}
