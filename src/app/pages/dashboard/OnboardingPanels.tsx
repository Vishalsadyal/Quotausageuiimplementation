import { useEffect, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Briefcase,
  Building2,
  Clock,
  Crown,
  FileText,
  Globe2,
  GraduationCap,
  Linkedin,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  User,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

// Side panels for the onboarding flow (large screens only). Every number shown comes from
// /api/user/onboarding/insights (real, aggregated counts); nothing here is made up.

export type OnboardingInsights = {
  totalUsers: number;
  resumesUploaded: number;
  applicationsSent: number;
  linkedinPct: number;
  portfolioPct: number;
  topCities: Array<{ city: string; users: number }>;
  topTitles: Array<{ title: string; applications: number }>;
};

export function useOnboardingInsights() {
  const [insights, setInsights] = useState<OnboardingInsights | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/user/onboarding/insights", { credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        if (!alive || !json?.success || !json.data) return;
        // Defaults for anything missing, so a partial response can never break the page.
        const d = json.data as Partial<OnboardingInsights>;
        const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
        setInsights({
          totalUsers: num(d.totalUsers),
          resumesUploaded: num(d.resumesUploaded),
          applicationsSent: num(d.applicationsSent),
          linkedinPct: num(d.linkedinPct),
          portfolioPct: num(d.portfolioPct),
          topCities: Array.isArray(d.topCities) ? d.topCities : [],
          topTitles: Array.isArray(d.topTitles) ? d.topTitles : [],
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return insights;
}

const fmt = (n: number) => n.toLocaleString("en-IN");

export function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_8px_30px_rgba(76,29,149,0.08)] backdrop-blur">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-700">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm">
          <Icon className="h-3.5 w-3.5" />
        </span>
        {title}
      </div>
      {children}
    </div>
  );
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="bg-gradient-to-r from-violet-700 to-indigo-600 bg-clip-text text-3xl font-black text-transparent">{value}</div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}

function Bar({ label, pct, icon: Icon }: { label: string; pct: number; icon: LucideIcon }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
        <span className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-violet-600" />
          {label}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-violet-100">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500" style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}

function Bullet({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-slate-700">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
      <span>{children}</span>
    </li>
  );
}

// ───────────────────────── live profile card (the "journey") ─────────────────────────

export type CardData = {
  name: string;
  phone: string;
  city: string;
  titles: string[];
  years: string;
  education: string;
  workModes: string[];
  skills: string[];
  hasResume: boolean;
  hasLinkedin: boolean;
};

export function ProfileCard({ data, step, total }: { data: CardData; step: number; total: number }) {
  const filled = [data.name, data.phone, data.city, data.titles.length, data.years, data.education, data.workModes.length, data.skills.length, data.hasResume, data.hasLinkedin].filter(Boolean).length;
  const strength = Math.round((filled / 10) * 100);
  const initials = data.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
  const row = (icon: LucideIcon, value: string) => {
    const Icon = icon;
    return (
      <div className={`flex items-center gap-2 text-sm ${value ? "text-slate-800" : "text-slate-400"}`}>
        <Icon className={`h-4 w-4 shrink-0 ${value ? "text-violet-600" : "text-slate-300"}`} />
        <span className="truncate">{value || "…"}</span>
      </div>
    );
  };
  return (
    <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-[0_8px_30px_rgba(76,29,149,0.10)] backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-lg font-bold text-white shadow-md">{initials}</div>
        <div className="min-w-0">
          <div className="truncate text-base font-bold text-slate-900">{data.name || "Your profile"}</div>
          <div className="truncate text-xs text-slate-500">{data.titles[0] || "Building your candidate profile"}</div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {row(MapPin, data.city)}
        {row(Briefcase, data.years ? `${data.years} years experience` : "")}
        {row(GraduationCap, data.education)}
        {row(Building2, data.workModes.join(" · "))}
        {row(FileText, data.hasResume ? "Resume ready" : "")}
        {row(Linkedin, data.hasLinkedin ? "LinkedIn added" : "")}
      </div>
      {data.skills.length ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {data.skills.slice(0, 6).map((s) => (
            <span key={s} className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">{s}</span>
          ))}
        </div>
      ) : null}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-600">Profile strength</span>
          <span className="text-violet-700">{strength}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-violet-100">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-emerald-400 transition-all duration-700" style={{ width: `${strength}%` }} />
        </div>
        <div className="mt-2 text-[11px] text-slate-400">Step {step} of {total}</div>
      </div>
    </div>
  );
}

// ───────────────────────── map (location step) ─────────────────────────

type Point = { lat: number; lon: number; label: string };

export function useGeocode(query: string) {
  const [point, setPoint] = useState<Point | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setPoint(null);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/user/onboarding/geocode?q=${encodeURIComponent(q)}`, { credentials: "include" })
        .then((res) => res.json())
        .then((json) => {
          if (alive) setPoint(json?.success && json.data ? (json.data as Point) : null);
        })
        .catch(() => {})
        .finally(() => alive && setLoading(false));
    }, 700);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query]);
  return { point, loading };
}

// OpenStreetMap tiles (img-src allows https), 3x3 around the point, pin in the middle.
export function MapPanel({ query }: { query: string }) {
  const { point, loading } = useGeocode(query);
  const zoom = 10;
  const size = 256;
  let tiles: Array<{ x: number; y: number; left: number; top: number }> = [];
  let offset = { x: 0, y: 0 };
  if (point) {
    const n = 2 ** zoom;
    const xf = ((point.lon + 180) / 360) * n;
    const latRad = (point.lat * Math.PI) / 180;
    const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
    const tx = Math.floor(xf);
    const ty = Math.floor(yf);
    offset = { x: (xf - tx) * size, y: (yf - ty) * size };
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles.push({ x: tx + dx, y: ty + dy, left: (dx + 1) * size, top: (dy + 1) * size });
  }
  return (
    <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/85 shadow-[0_8px_30px_rgba(76,29,149,0.10)]">
      <div className="relative h-72 w-full overflow-hidden bg-gradient-to-br from-violet-100 via-indigo-50 to-emerald-50">
        {point ? (
          <div
            className="absolute"
            style={{ width: size * 3, height: size * 3, left: `calc(50% - ${size + offset.x}px)`, top: `calc(50% - ${size + offset.y}px)` }}
          >
            {tiles.map((t) => (
              <img
                key={`${t.x}-${t.y}`}
                src={`https://tile.openstreetmap.org/${zoom}/${t.x}/${t.y}.png`}
                alt=""
                className="absolute select-none"
                style={{ left: t.left, top: t.top, width: size, height: size }}
                draggable={false}
              />
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Globe2 className={`h-10 w-10 text-violet-400 ${loading ? "animate-pulse" : ""}`} />
            <span className="text-xs font-medium">{loading ? "Finding your city…" : "Type your city to see it here"}</span>
          </div>
        )}
        {point ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
            <span className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-violet-500/50" />
            <MapPin className="h-9 w-9 fill-violet-600 text-white drop-shadow-lg" />
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <span className="truncate text-sm font-semibold text-slate-800">{point?.label || query || "Your location"}</span>
        <span className="shrink-0 text-[10px] text-slate-400">© OpenStreetMap</span>
      </div>
    </div>
  );
}

// ───────────────────────── right-hand insight per step ─────────────────────────

export function InsightPanel({
  step,
  insights,
  city,
  years,
  search,
  messagePreview,
}: {
  step: number;
  insights: OnboardingInsights | null;
  city: string;
  years: string;
  search: { titles: string[]; jobTypes: string[]; modes: string[]; cities: string[]; countries: string[]; salary: number };
  messagePreview: string;
}) {
  const i = insights;
  if (step <= 2) {
    return (
      <Panel title="What we read" icon={Sparkles}>
        {i && i.resumesUploaded > 0 ? <BigStat value={fmt(i.resumesUploaded)} label="resumes already set up on AutoApply" /> : null}
        <ul className="mt-3 space-y-2">
          <Bullet icon={User}>Name, phone and city</Bullet>
          <Bullet icon={Briefcase}>Job titles and experience</Bullet>
          <Bullet icon={Zap}>Skills for job matching</Bullet>
          <Bullet icon={ShieldCheck}>Never shared with anyone</Bullet>
        </ul>
      </Panel>
    );
  }
  if (step <= 4) {
    return (
      <Panel title="You're in good company" icon={Users}>
        <div className="space-y-4">
          {i && i.totalUsers > 0 ? <BigStat value={fmt(i.totalUsers)} label="job seekers use AutoApply CV" /> : null}
          {i && i.applicationsSent > 0 ? <BigStat value={fmt(i.applicationsSent)} label="applications sent for them" /> : null}
          <ul className="space-y-2">
            <Bullet icon={Phone}>Your number is only filled into job applications</Bullet>
          </ul>
        </div>
      </Panel>
    );
  }
  if (step === 5) {
    const mine = city.trim().toLowerCase();
    return (
      <Panel title="Top cities on AutoApply" icon={TrendingUp}>
        {i?.topCities.length ? (
          <ol className="space-y-1.5">
            {i.topCities.map((c, idx) => {
              const isMine = mine && c.city.toLowerCase() === mine;
              return (
                <li key={c.city} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm ${isMine ? "bg-violet-600 text-white" : "text-slate-700"}`}>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold ${isMine ? "bg-white/20" : "bg-violet-50 text-violet-700"}`}>{idx + 1}</span>
                  <span className="flex-1 truncate font-semibold">{c.city}</span>
                  <span className={`text-xs ${isMine ? "text-white/80" : "text-slate-400"}`}>{fmt(c.users)} users</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">Your city helps us find jobs near you and answer location questions.</p>
        )}
      </Panel>
    );
  }
  if (step === 6) {
    return (
      <Panel title="Stand out to recruiters" icon={BadgeCheck}>
        {i && i.totalUsers > 0 ? (
          <div className="space-y-3">
            <Bar label="Users with LinkedIn" pct={i.linkedinPct} icon={Linkedin} />
            <Bar label="Users with a portfolio" pct={i.portfolioPct} icon={Globe2} />
          </div>
        ) : null}
        <ul className="mt-4 space-y-2">
          <Bullet icon={MessageSquare}>Your portfolio link is added to recruiter messages automatically</Bullet>
          <Bullet icon={Target}>Filled into every application that asks for it</Bullet>
        </ul>
      </Panel>
    );
  }
  if (step <= 8) {
    return (
      <Panel title="Answered for you" icon={ShieldCheck}>
        <ul className="space-y-2">
          <Bullet icon={BadgeCheck}>"Are you legally authorized to work…?"</Bullet>
          <Bullet icon={BadgeCheck}>"Will you require visa sponsorship?"</Bullet>
          <Bullet icon={Clock}>Asked on almost every application. Answer once here.</Bullet>
        </ul>
      </Panel>
    );
  }
  if (step === 9) {
    const n = Number(years);
    const level = !years ? "" : n < 2 ? "Entry level" : n < 5 ? "Associate" : n < 10 ? "Mid-Senior level" : "Senior / Director";
    return (
      <Panel title="Your level" icon={Target}>
        {level ? <BigStat value={level} label="roles we'll focus on" /> : <p className="text-sm text-slate-500">Pick your years to see which roles we'll target.</p>}
        <p className="mt-3 text-sm text-slate-600">Also used to answer "How many years of experience do you have with…" questions.</p>
      </Panel>
    );
  }
  if (step <= 11) {
    return (
      <Panel title="Saved once, used everywhere" icon={Zap}>
        <ul className="space-y-2">
          <Bullet icon={GraduationCap}>Education and language questions are filled automatically</Bullet>
          <Bullet icon={Clock}>Saves minutes on every single application</Bullet>
        </ul>
      </Panel>
    );
  }
  if (step === 12) {
    return (
      <Panel title="Most applied roles" icon={TrendingUp}>
        {i?.topTitles.length ? (
          <ol className="space-y-1.5">
            {i.topTitles.map((t, idx) => (
              <li key={t.title} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50 text-xs font-bold text-violet-700">{idx + 1}</span>
                <span className="flex-1 truncate font-semibold">{t.title}</span>
                <span className="text-xs text-slate-400">{fmt(t.applications)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">Titles decide which jobs match. Add every title you'd accept.</p>
        )}
      </Panel>
    );
  }
  if (step <= 17) {
    const rows: Array<[LucideIcon, string, string]> = [
      [Briefcase, "Titles", search.titles.slice(0, 3).join(", ")],
      [Clock, "Type", search.jobTypes.join(", ")],
      [Building2, "Mode", search.modes.join(", ")],
      [MapPin, "Cities", search.cities.slice(0, 3).join(", ")],
      [Globe2, "Countries", search.countries.slice(0, 3).join(", ")],
      [Wallet, "Salary", search.salary ? `${fmt(Math.round(search.salary / 12))} / month` : ""],
    ];
    return (
      <Panel title="Your job search" icon={Target}>
        <ul className="space-y-2">
          {rows.map(([Icon, label, value]) => (
            <li key={label} className="flex items-start gap-2 text-sm">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${value ? "text-violet-600" : "text-slate-300"}`} />
              <span className="w-16 shrink-0 text-slate-500">{label}</span>
              <span className={`min-w-0 flex-1 truncate font-semibold ${value ? "text-slate-800" : "text-slate-300"}`}>{value || "…"}</span>
            </li>
          ))}
        </ul>
      </Panel>
    );
  }
  if (step <= 20) {
    return (
      <Panel title="How matching works" icon={Zap}>
        <ul className="space-y-2">
          <Bullet icon={Sparkles}>Skills raise a job's match score</Bullet>
          <Bullet icon={ShieldCheck}>Skip words block a job before it's applied to</Bullet>
          <Bullet icon={Building2}>Excluded companies are never contacted</Bullet>
        </ul>
      </Panel>
    );
  }
  if (step <= 22) {
    return (
      <Panel title="Applies like you would" icon={BadgeCheck}>
        <ul className="space-y-2">
          <Bullet icon={MessageSquare}>Screening answers are reused on every form</Bullet>
          <Bullet icon={Target}>Filters keep applications relevant</Bullet>
          <Bullet icon={Zap}>Easy Apply jobs only, applied right inside LinkedIn</Bullet>
        </ul>
      </Panel>
    );
  }
  if (step === 23) {
    return (
      <Panel title="Preview" icon={MessageSquare}>
        <div className="max-h-64 overflow-hidden whitespace-pre-line rounded-2xl rounded-tl-sm bg-emerald-50 p-3 text-xs leading-relaxed text-slate-700">{messagePreview}</div>
      </Panel>
    );
  }
  if (step === 24) {
    return (
      <Panel title="What the extension does" icon={Zap}>
        <ul className="space-y-2">
          <Bullet icon={Target}>Finds jobs that match your titles and skills</Bullet>
          <Bullet icon={BadgeCheck}>Fills Easy Apply forms with your saved answers</Bullet>
          <Bullet icon={ShieldCheck}>Skips jobs with your skip keywords</Bullet>
          <Bullet icon={MessageSquare}>Sends your message to recruiters</Bullet>
        </ul>
      </Panel>
    );
  }
  return (
    <Panel title="Free vs Pro" icon={Crown}>
      <ul className="space-y-2 text-sm">
        {[
          ["Auto-applies per day", "3", "Unlimited"],
          ["Recruiter outreach", "Hires", "Unlimited"],
          ["AI assistant", "No", "Yes"],
          ["Priority support", "No", "Yes"],
        ].map(([label, free, pro]) => (
          <li key={label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
            <span className="text-slate-600">{label}</span>
            <span className="text-xs text-slate-400">{free}</span>
            <span className="text-xs font-bold text-violet-700">{pro}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
