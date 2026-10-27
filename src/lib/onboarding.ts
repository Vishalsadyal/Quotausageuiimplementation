type OnboardingUser = {
  name?: string | null;
  phone?: string | null;
  currentCity?: string | null;
  addressLine?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
};

function hasValue(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export function hasCompletedRequiredOnboarding(user: OnboardingUser | null | undefined) {
  if (!user) return false;
  return hasValue(user.name) && hasValue(user.phone);
}

// The 25 screens of the onboarding flow (pages/dashboard/OnboardingFlow.tsx), index = step number - 1.
// Shown in Admin > Users as the step a user stopped at. Keep in sync with the screens.
export const ONBOARDING_TOTAL_STEPS = 25;
export const ONBOARDING_STEP_LABELS = [
  "Upload resume", "Resume summary", "Name", "Phone", "Location", "Links", "US work authorization", "Visa sponsorship",
  "Experience", "Education", "English level", "Job titles", "Job types", "Work mode", "Cities", "Countries", "Salary",
  "Skills", "Skip keywords", "Excluded companies", "Screening answers", "Search filters", "Messages", "Install extension", "Choose plan",
];

export function onboardingStepLabel(step: number | null | undefined) {
  if (!step) return "";
  return ONBOARDING_STEP_LABELS[step - 1] || `Step ${step}`;
}
