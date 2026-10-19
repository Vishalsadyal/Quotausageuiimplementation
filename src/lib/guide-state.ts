// Where the user is in the live guides (kept per user in this browser) and how any page can ask for a guide to start.
import { GUIDES, getGuide, type GuideId } from "./guides";

export type GuideState = {
  /** The guide in progress and the step it is on. */
  active: { id: GuideId; step: number } | null;
  /** Guides the user has finished. */
  done: GuideId[];
  /** The first-login offer was answered (started or "Not now"), so it never comes back. */
  offerDismissed: boolean;
  /** The "Guide me" button was opened once, so it stops pulsing for attention. */
  launcherSeen: boolean;
};

export const EMPTY_GUIDE_STATE: GuideState = { active: null, done: [], offerDismissed: false, launcherSeen: false };

export const guideStorageKey = (userId?: string | null) => `cp_guide_v1:${userId || "anon"}`;

/** Reads saved progress. Anything unreadable or out of date (a guide that no longer exists) is dropped, never thrown. */
export function loadGuideState(userId?: string | null): GuideState {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(guideStorageKey(userId));
    if (!raw) return { ...EMPTY_GUIDE_STATE };
    const parsed = JSON.parse(raw) as Partial<GuideState> | null;
    const done = Array.isArray(parsed?.done) ? (parsed!.done.filter((id) => Boolean(getGuide(String(id)))) as GuideId[]) : [];
    let active: GuideState["active"] = null;
    const candidate = parsed?.active;
    if (candidate && typeof candidate === "object") {
      const guide = getGuide(String((candidate as { id?: unknown }).id));
      const step = Number((candidate as { step?: unknown }).step);
      if (guide && Number.isInteger(step) && step >= 0 && step < guide.steps.length) active = { id: guide.id, step };
    }
    return { active, done: Array.from(new Set(done)), offerDismissed: Boolean(parsed?.offerDismissed), launcherSeen: Boolean(parsed?.launcherSeen) };
  } catch {
    return { ...EMPTY_GUIDE_STATE };
  }
}

export function saveGuideState(userId: string | null | undefined, state: GuideState) {
  try {
    window.localStorage.setItem(guideStorageKey(userId), JSON.stringify(state));
  } catch {
    // private mode / storage full: the guide still works for this visit
  }
}

// ── asking for a guide from anywhere (Help Center "Show me live", the AI assistant, a link) ──────────────
export const GUIDE_REQUEST_EVENT = "cp:guideRequest";
const GUIDE_REQUEST_KEY = "cp_guide_requested";

/** Starts a guide. Works from any page: remembered until the dashboard (which hosts the engine) is on screen. */
export function requestGuide(id: GuideId) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(GUIDE_REQUEST_KEY, id);
  } catch {
    // ignore: the event below still reaches an open dashboard
  }
  window.dispatchEvent(new CustomEvent(GUIDE_REQUEST_EVENT, { detail: { id } }));
}

/** The guide asked for before the dashboard was ready, if any; asking clears it. */
export function consumeGuideRequest(): GuideId | "" {
  if (typeof window === "undefined") return "";
  try {
    const value = window.sessionStorage.getItem(GUIDE_REQUEST_KEY) || "";
    window.sessionStorage.removeItem(GUIDE_REQUEST_KEY);
    return GUIDES.some((guide) => guide.id === value) ? (value as GuideId) : "";
  } catch {
    return "";
  }
}
