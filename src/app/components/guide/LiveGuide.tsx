import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowRight, Check, Circle, MapPin, MousePointerClick, PlayCircle, X } from "lucide-react";
import { GUIDES, getGuide, nextOpenStep, onStepPage, type Guide, type GuideContext, type GuideId, type GuideStep } from "src/lib/guides";
import {
  GUIDE_REQUEST_EVENT,
  consumeGuideRequest,
  guideStorageKey,
  loadGuideState,
  saveGuideState,
  type GuideState,
} from "src/lib/guide-state";

// Live guide engine. A spotlight and a tooltip point at the real element and the guide moves on when the user
// really clicks it (the click still goes through to the page, nothing is faked). It never clicks for the user.
// Steps and their `data-guide` markers are in src/lib/guides.ts.

type GuideUser = { id?: string | null; resumeFileName?: string | null; onboardingCompleted?: boolean | null } | null;

type GuideApi = {
  state: GuideState;
  start: (id: GuideId) => void;
  stop: () => void;
  /** The "Guide me" button was opened: it stops pulsing. */
  markLauncherSeen: () => void;
};

const GuideContextValue = createContext<GuideApi | null>(null);

export function useGuide() {
  const api = useContext(GuideContextValue);
  if (!api) throw new Error("useGuide must be used inside <GuideProvider>");
  return api;
}

const addDone = (done: GuideId[], id: GuideId) => (done.includes(id) ? done : [...done, id]);

export function GuideProvider({
  user,
  offerEnabled = false,
  openMenu,
  targetTimeoutMs = 6000,
  children,
}: {
  user: GuideUser;
  /** Show the first-login offer (turn on once the user is out of onboarding). */
  offerEnabled?: boolean;
  /** Opens the side menu on phones, where the menu targets are hidden until it is open. */
  openMenu?: () => void;
  targetTimeoutMs?: number;
  children: ReactNode;
}) {
  const location = useLocation();
  const userId = user?.id ?? null;
  const key = guideStorageKey(userId);

  // Progress is per user: a different user gets their own, loaded during render so it can never be written to the wrong key.
  const [holder, setHolder] = useState(() => ({ key, value: loadGuideState(userId) }));
  const state = holder.key === key ? holder.value : loadGuideState(userId);
  const stateRef = useRef(state);
  stateRef.current = state;

  const ctxRef = useRef<GuideContext>({ pathname: location.pathname, user });
  ctxRef.current = { pathname: location.pathname, user };

  const update = useCallback(
    (fn: (s: GuideState) => GuideState) => {
      const next = fn(stateRef.current);
      stateRef.current = next;
      saveGuideState(userId, next);
      setHolder({ key, value: next });
    },
    [userId, key]
  );

  const start = useCallback(
    (id: GuideId) => {
      const guide = getGuide(id);
      if (!guide) return;
      const first = nextOpenStep(guide, 0, ctxRef.current);
      update((s) => ({ ...s, offerDismissed: true, launcherSeen: true, active: first < 0 ? null : { id, step: first }, done: first < 0 ? addDone(s.done, id) : s.done }));
    },
    [update]
  );

  /** Moves past `fromStep`. Ignored when the guide is no longer on that step (a double click must not skip two steps). */
  const advance = useCallback(
    (fromStep: number) => {
      const active = stateRef.current.active;
      if (!active || active.step !== fromStep) return;
      const guide = getGuide(active.id);
      if (!guide) return;
      const next = nextOpenStep(guide, active.step + 1, ctxRef.current);
      update((s) => (next < 0 ? { ...s, active: null, done: addDone(s.done, active.id) } : { ...s, active: { id: active.id, step: next } }));
    },
    [update]
  );

  const stop = useCallback(() => update((s) => ({ ...s, active: null })), [update]);
  const dismissOffer = useCallback(() => update((s) => ({ ...s, offerDismissed: true })), [update]);
  const markLauncherSeen = useCallback(() => {
    if (!stateRef.current.launcherSeen) update((s) => ({ ...s, launcherSeen: true }));
  }, [update]);

  // A guide asked for from elsewhere (Help Center, assistant, a link), before or after the dashboard opened.
  useEffect(() => {
    const queued = consumeGuideRequest();
    if (queued) start(queued);
    const onRequest = (event: Event) => {
      const id = (event as CustomEvent<{ id?: GuideId }>).detail?.id;
      if (id) {
        consumeGuideRequest();
        start(id);
      }
    };
    window.addEventListener(GUIDE_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(GUIDE_REQUEST_EVENT, onRequest);
  }, [start]);

  const api = useMemo<GuideApi>(() => ({ state, start, stop, markLauncherSeen }), [state, start, stop, markLauncherSeen]);
  const activeGuide = state.active ? getGuide(state.active.id) : undefined;

  return (
    <GuideContextValue.Provider value={api}>
      {children}
      {activeGuide && state.active ? (
        <GuideOverlay
          key={`${activeGuide.id}:${state.active.step}`}
          guide={activeGuide}
          stepIndex={state.active.step}
          pathname={location.pathname}
          ctx={{ pathname: location.pathname, user }}
          onAdvance={advance}
          onExit={stop}
          openMenu={openMenu}
          targetTimeoutMs={targetTimeoutMs}
        />
      ) : null}
      {offerEnabled ? <GuideOffer state={state} onStart={start} onDismiss={dismissOffer} /> : null}
    </GuideContextValue.Provider>
  );
}

// ───────────────────────────── finding the element a step points at ─────────────────────────────

type Box = { left: number; top: number; width: number; height: number; right: number; bottom: number };
const toBox = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom });
const sameBox = (a: Box, b: Box) =>
  Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;

/** Follows the element every frame (it can move, scroll, or appear later). `missing` turns true after `timeoutMs` without a visible match. */
function useGuideTarget(names: string[], enabled: boolean, timeoutMs: number, retryKey: number) {
  const [found, setFound] = useState<{ name: string; el: HTMLElement; box: Box } | null>(null);
  const [missing, setMissing] = useState(false);
  const namesKey = names.join("|");

  useEffect(() => {
    if (!enabled || names.length === 0) {
      setFound(null);
      setMissing(false);
      return;
    }
    let alive = true;
    let raf = 0;
    let scrolledTo: HTMLElement | null = null;
    const started = performance.now();

    const tick = () => {
      if (!alive) return;
      let hit: { name: string; el: HTMLElement; box: Box } | null = null;
      for (const name of names) {
        const el = document.querySelector<HTMLElement>(`[data-guide="${name}"]`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          hit = { name, el, box: toBox(r) };
          break;
        }
      }
      if (hit) {
        if (scrolledTo !== hit.el) {
          scrolledTo = hit.el;
          const { top, bottom } = hit.box;
          if (top < 0 || bottom > window.innerHeight) hit.el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        const next = hit;
        setFound((prev) => (prev && prev.el === next.el && prev.name === next.name && sameBox(prev.box, next.box) ? prev : next));
        setMissing(false);
      } else {
        setFound((prev) => (prev ? null : prev));
        if (performance.now() - started > timeoutMs) setMissing(true);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesKey, enabled, timeoutMs, retryKey]);

  return { found, missing };
}

// ───────────────────────────── the spotlight and tooltip ─────────────────────────────

const TIP_WIDTH = 320;
const EDGE = 12;
const GAP = 14;
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), Math.max(min, max));

function placeTip(box: Box | null, tip: { w: number; h: number }, vw: number, vh: number) {
  if (vw < 640) {
    // Phone: full-width card on the side of the screen away from the target.
    const w = vw - EDGE * 2;
    const top = box && box.top > vh / 2 ? EDGE : vh - tip.h - EDGE;
    return { left: EDGE, top: Math.max(EDGE, top), width: w };
  }
  const width = TIP_WIDTH;
  if (!box) return { left: (vw - width) / 2, top: Math.max(EDGE, (vh - tip.h) / 2), width };
  const fitsRight = box.right + GAP + width <= vw - EDGE;
  const fitsLeft = box.left - GAP - width >= EDGE;
  const fitsBelow = box.bottom + GAP + tip.h <= vh - EDGE;
  const fitsAbove = box.top - GAP - tip.h >= EDGE;
  const centreY = box.top + box.height / 2 - tip.h / 2;
  const centreX = box.left + box.width / 2 - width / 2;
  if (fitsRight) return { left: box.right + GAP, top: clamp(centreY, EDGE, vh - tip.h - EDGE), width };
  if (fitsBelow) return { left: clamp(centreX, EDGE, vw - width - EDGE), top: box.bottom + GAP, width };
  if (fitsAbove) return { left: clamp(centreX, EDGE, vw - width - EDGE), top: box.top - GAP - tip.h, width };
  if (fitsLeft) return { left: box.left - GAP - width, top: clamp(centreY, EDGE, vh - tip.h - EDGE), width };
  return { left: clamp(centreX, EDGE, vw - width - EDGE), top: clamp(box.bottom + GAP, EDGE, vh - tip.h - EDGE), width };
}

function GuideOverlay({
  guide,
  stepIndex,
  pathname,
  ctx,
  onAdvance,
  onExit,
  openMenu,
  targetTimeoutMs,
}: {
  guide: Guide;
  stepIndex: number;
  pathname: string;
  ctx: GuideContext;
  onAdvance: (fromStep: number) => void;
  onExit: () => void;
  openMenu?: () => void;
  targetTimeoutMs: number;
}) {
  const navigate = useNavigate();
  const step: GuideStep = guide.steps[stepIndex];
  const onPage = onStepPage(step, pathname);
  const [retryKey, setRetryKey] = useState(0);
  const [away, setAway] = useState(false);

  // Off the step's page: wait a moment (a click may still be changing the page), then offer to take the user there.
  useEffect(() => {
    if (onPage) {
      setAway(false);
      return;
    }
    const timer = window.setTimeout(() => setAway(true), 700);
    return () => window.clearTimeout(timer);
  }, [onPage]);

  const names = useMemo(() => (step.target ? [step.target, ...(step.targetFallback ? [step.targetFallback] : [])] : []), [step.target, step.targetFallback]);
  const { found, missing } = useGuideTarget(names, onPage && names.length > 0, targetTimeoutMs, retryKey);
  const pointingAtFallback = Boolean(found && step.target && found.name !== step.target);

  // A step that was already done (for example the resume exists by now) disappears without a click.
  useEffect(() => {
    if (step.skipIf?.(ctx)) onAdvance(stepIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.user?.resumeFileName, ctx.user?.onboardingCompleted, ctx.pathname]);

  // Click steps finish on the user's real click on the real target. The click is not blocked or faked: our check only
  // runs after the page's own handler (the timeout), so a link still navigates and a button still does its job.
  useEffect(() => {
    if (step.advance !== "click" || !step.target) return;
    const selector = `[data-guide="${step.target}"]`;
    const onClick = (event: MouseEvent) => {
      const hit = (event.target as Element | null)?.closest?.(selector);
      if (hit) window.setTimeout(() => onAdvance(stepIndex), 0);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [step.advance, step.target, stepIndex, onAdvance]);

  // Esc leaves the guide.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  // Menu targets are hidden on phones until the side menu is open: open it for the user once per step.
  const isMenuTarget = Boolean(step.target && /^(nav|sub)-/.test(step.target));
  const menuOpened = useRef(false);
  useEffect(() => {
    if (!isMenuTarget || found || !onPage || menuOpened.current) return;
    if (typeof window !== "undefined" && window.innerWidth < 1024 && openMenu) {
      menuOpened.current = true;
      openMenu();
    }
  }, [isMenuTarget, found, onPage, openMenu]);

  const tipRef = useRef<HTMLDivElement>(null);
  const [tipSize, setTipSize] = useState({ w: TIP_WIDTH, h: 200 });
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    const next = { w: el.offsetWidth, h: el.offsetHeight };
    setTipSize((prev) => (prev.w === next.w && prev.h === next.h ? prev : next));
  });

  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const pointing = Boolean(onPage && found);
  const centred = !pointing;
  const pos = placeTip(pointing ? found!.box : null, tipSize, vw, vh);
  const total = guide.steps.length;

  const bodyText = pointingAtFallback && step.fallback ? step.fallback : step.body;
  const showMissing = onPage && names.length > 0 && missing && !found;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]" data-live-guide-overlay>
      {pointing ? (
        <div
          className="absolute rounded-xl transition-all duration-150"
          style={{
            left: found!.box.left - 6,
            top: found!.box.top - 6,
            width: found!.box.width + 12,
            height: found!.box.height + 12,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55), 0 0 0 3px #8b5cf6",
          }}
          data-live-guide-spotlight
        >
          <span className="absolute inset-0 animate-pulse rounded-xl ring-4 ring-purple-300/60" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-slate-900/40" />
      )}

      {away && !onPage ? (
        <div
          className="pointer-events-auto absolute bottom-6 left-1/2 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-purple-200 bg-white p-4 shadow-2xl"
          role="dialog"
          aria-label="Guide: go to the next page"
          data-live-guide-away
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700">
              <MapPin className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-gray-900">Next: {step.title}</div>
              <p className="mt-0.5 text-xs text-gray-600">This step is on a different page.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => step.page && navigate(step.page)}
                  className="rounded-full bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-purple-700"
                >
                  Take me there
                </button>
                <button type="button" onClick={() => onAdvance(stepIndex)} className="text-xs font-semibold text-gray-500 hover:text-gray-800">
                  Skip step
                </button>
                <button type="button" onClick={onExit} className="ml-auto text-xs font-semibold text-gray-400 hover:text-gray-700">
                  Exit guide
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={tipRef}
          className="pointer-events-auto absolute rounded-2xl border border-purple-200 bg-white p-4 shadow-2xl"
          style={{ left: pos.left, top: pos.top, width: pos.width }}
          role="dialog"
          aria-live="polite"
          aria-label={`${guide.title}: ${step.title}`}
          data-live-guide-tip
          data-centred={centred ? "true" : "false"}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
              {guide.title} · Step {stepIndex + 1} of {total}
            </span>
            <button type="button" onClick={onExit} aria-label="Exit guide" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mb-3 h-1 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${((stepIndex + 1) / total) * 100}%` }} />
          </div>

          <h3 className="text-sm font-bold text-gray-900">{step.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">{showMissing ? `I can't see this on screen right now. ${step.fallback || "Scroll or open the menu, then try again."}` : bodyText}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {showMissing ? (
              <button type="button" onClick={() => setRetryKey((k) => k + 1)} className="rounded-full bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-purple-700">
                Try again
              </button>
            ) : step.advance === "next" ? (
              <button
                type="button"
                onClick={() => onAdvance(stepIndex)}
                className="inline-flex items-center gap-1 rounded-full bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-purple-700"
              >
                {step.nextLabel || "Next"} <ArrowRight className="h-3 w-3" />
              </button>
            ) : pointing && !pointingAtFallback ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700">
                <MousePointerClick className="h-3.5 w-3.5" /> Click the highlighted button
              </span>
            ) : null}
            {step.advance === "click" ? (
              <button type="button" onClick={() => onAdvance(stepIndex)} className="ml-auto text-xs font-semibold text-gray-400 hover:text-gray-700">
                {step.nextLabel || "Skip step"}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── the "Guide me" button ─────────────────────────────

export function GuideLauncher({ onInstallTour }: { onInstallTour?: () => void }) {
  const { state, start, markLauncherSeen } = useGuide();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          markLauncherSeen();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Guide me"
        className="relative inline-flex items-center gap-1.5 rounded-xl border border-purple-300 bg-purple-50 px-2.5 py-1.5 text-xs font-bold text-purple-700 transition-all hover:border-purple-400 hover:bg-purple-100 hover:shadow-xs sm:px-3.5"
        title="Guided walkthroughs: it shows you where to click"
        data-guide="guide-launcher"
      >
        <PlayCircle className="h-3.5 w-3.5 text-purple-600" />
        <span className="hidden sm:inline">Guide me</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-[60] mt-2 w-[min(92vw,340px)] rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl" role="menu">
          <div className="px-2.5 pb-1.5 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Show me live</div>
          {GUIDES.map((guide) => {
            const done = state.done.includes(guide.id);
            const active = state.active?.id === guide.id ? state.active : null;
            return (
              <button
                key={guide.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  start(guide.id);
                }}
                className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-purple-50/60"
              >
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                  {done ? <Check className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-gray-900">{guide.title}</span>
                  <span className="block text-[11px] leading-snug text-gray-500">{guide.summary}</span>
                </span>
                <span className="mt-0.5 shrink-0 text-[11px] font-semibold text-purple-700">
                  {active ? `Continue (${active.step + 1}/${guide.steps.length})` : done ? "Do again" : "Start"}
                </span>
              </button>
            );
          })}
          {onInstallTour ? (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onInstallTour();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-sky-50"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                  <PlayCircle className="h-3 w-3" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-gray-900">Install the extension</span>
                  <span className="block text-[11px] text-gray-500">Step by step with screenshots (Chrome's own screens can't be highlighted).</span>
                </span>
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ───────────────────────────── the first-login offer ─────────────────────────────

/** Where the "Guide me" button is on screen right now (null when it is hidden). */
function useLauncherBox(enabled: boolean) {
  const [box, setBox] = useState<Box | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let raf = 0;
    const tick = () => {
      if (!alive) return;
      const r = document.querySelector<HTMLElement>('[data-guide="guide-launcher"]')?.getBoundingClientRect();
      const next = r && r.width > 0 && r.height > 0 ? toBox(r) : null;
      setBox((prev) => (prev === null && next === null ? prev : prev && next && sameBox(prev, next) ? prev : next));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [enabled]);
  return box;
}

function GuideOffer({ state, onStart, onDismiss }: { state: GuideState; onStart: (id: GuideId) => void; onDismiss: () => void }) {
  const [ready, setReady] = useState(false);
  const eligible = !state.offerDismissed && !state.active && state.done.length === 0;

  useEffect(() => {
    if (!eligible) {
      setReady(false);
      return;
    }
    const timer = window.setTimeout(() => setReady(true), 1500);
    return () => window.clearTimeout(timer);
  }, [eligible]);

  const launcher = useLauncherBox(eligible && ready);
  if (!eligible || !ready) return null;

  // Under the "Guide me" button, with an arrow to it. If the button is not on screen, a corner card.
  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const width = vw < 640 ? vw - 24 : 340;
  const anchored = launcher
    ? { left: clamp(vw < 640 ? 12 : launcher.right - width, 12, vw - width - 12), top: launcher.bottom + 12, width }
    : null;
  const arrowLeft = launcher && anchored ? clamp(launcher.left + launcher.width / 2 - anchored.left - 6, 14, width - 26) : 0;
  return (
    <div
      className={`z-[70] rounded-2xl border border-purple-200 bg-white p-4 shadow-2xl ${anchored ? "fixed" : "fixed bottom-4 right-4 w-[min(92vw,340px)]"}`}
      style={anchored ? { left: anchored.left, top: anchored.top, width: anchored.width } : undefined}
      role="dialog"
      aria-label="Guided setup"
      data-live-guide-offer
      data-anchored={anchored ? "true" : "false"}
    >
      {anchored ? (
        <span aria-hidden="true" className="absolute -top-1.5 h-3 w-3 rotate-45 border-l border-t border-purple-200 bg-white" style={{ left: arrowLeft }} data-live-guide-arrow />
      ) : null}
      <div className="text-sm font-bold text-gray-900">New here? Take a quick guided setup</div>
      <p className="mt-1 text-xs text-gray-600">A live guide points at exactly what to click. Nothing is sent to employers while you practise.</p>
      <ul className="mt-2.5 space-y-1.5">
        {GUIDES.map((guide) => (
          <li key={guide.id} className="flex items-center gap-2 text-xs text-gray-700">
            <Circle className="h-3 w-3 shrink-0 text-gray-300" />
            {guide.title}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={() => onStart("setup")} className="rounded-full bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-purple-700">
          Start the guide
        </button>
        <button type="button" onClick={onDismiss} className="text-xs font-semibold text-gray-500 hover:text-gray-800">
          Not now
        </button>
      </div>
      <p className="mt-2 text-[10px] text-gray-400">You can open it any time from "Guide me" at the top.</p>
    </div>
  );
}
