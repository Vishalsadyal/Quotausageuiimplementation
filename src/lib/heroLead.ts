// Details read from the resume a visitor uploads in the home-page hero agent.
// They pre-fill signup and onboarding, and are cleared once onboarding completes.
export type HeroLead = {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  linkedinUrl?: string;
  jobTitle?: string;
  yearsOfExperience?: string;
  workMode?: 'Remote' | 'Hybrid' | 'Onsite';
  resumeFileName?: string;
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
  let hadLead = false;
  try {
    hadLead = window.localStorage.getItem(HERO_LEAD_KEY) !== null;
    if (hadLead) window.localStorage.removeItem(HERO_LEAD_KEY);
  } catch {
    // ignore storage failures
  }
  // Called on every protected render once onboarding is done; only touch IndexedDB when needed.
  if (hadLead || pendingResume) void clearPendingResume();
}

// The resume file itself waits in memory (email signup stays in the SPA) and in
// IndexedDB (survives the full-page redirect of "Continue with Google") until
// onboarding uploads it to the new account.
const DB_NAME = 'autoapply-hero';
const STORE = 'files';
const RESUME_KEY = 'pendingResume';
let pendingResume: File | null = null;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    } finally {
      db.close();
    }
  });
}

export async function savePendingResume(file: File) {
  pendingResume = file;
  await withStore('readwrite', (store) => store.put({ blob: file, name: file.name, type: file.type }, RESUME_KEY));
}

export async function readPendingResume(): Promise<File | null> {
  if (pendingResume) return pendingResume;
  const saved = await withStore<{ blob: Blob; name: string; type: string } | undefined>('readonly', (store) => store.get(RESUME_KEY));
  if (!saved?.blob) return null;
  pendingResume = new File([saved.blob], saved.name, { type: saved.type });
  return pendingResume;
}

export async function clearPendingResume() {
  pendingResume = null;
  await withStore('readwrite', (store) => store.delete(RESUME_KEY));
}
