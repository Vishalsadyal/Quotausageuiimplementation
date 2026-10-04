export type HeroLead = {
  linkedinUrl: string;
  jobTitle: string;
  yearsOfExperience: string;
  workMode: 'Remote' | 'Hybrid' | 'Onsite';
  savedAt: string;
};

const HERO_LEAD_KEY = 'autoapply:heroLead';

// Accepts a full profile URL, "linkedin.com/in/x", "in/x" or a bare username.
export function normalizeLinkedinInput(input: string) {
  const value = input.trim();
  if (!value) return '';
  const match = value.match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  const username = (match ? match[1] : value.replace(/^@/, '').replace(/^in\//i, '')).replace(/\/+$/, '');
  if (!/^[a-zA-Z0-9\-_%.]{3,100}$/.test(username)) return '';
  return `https://www.linkedin.com/in/${username}`;
}

export function saveHeroLead(lead: Omit<HeroLead, 'savedAt'>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HERO_LEAD_KEY, JSON.stringify({ ...lead, savedAt: new Date().toISOString() }));
  } catch {
    // ignore storage failures
  }
}

export function readHeroLead(): HeroLead | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(HERO_LEAD_KEY);
    return raw ? (JSON.parse(raw) as HeroLead) : null;
  } catch {
    return null;
  }
}

export function clearHeroLead() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(HERO_LEAD_KEY);
  } catch {
    // ignore storage failures
  }
}
