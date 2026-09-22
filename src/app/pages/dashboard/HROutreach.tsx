"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HR_OUTREACH_EXTENSION_STORE_URL } from "src/lib/extension-providers";
import { useAuth } from "../../context/AuthContext";
import {
  Search,
  Mail,
  Send,
  User,
  Building2,
  Linkedin,
  Globe,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  Target,
  X,
  FileText,
  Phone,
  Download,
  Puzzle,
  ArrowRight,
  Play,
  Square,
  Users,
  Zap,
  Hash,
  SlidersHorizontal,
  MapPin,
  Smartphone,
  Wifi,
  List,
  LayoutGrid,
  Filter,
  Minus,
  Upload,
  Paperclip,
  Eye,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HRContact {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  country: string;
  source: "google" | "manual" | "extension";
  addedAt: string;
  searchKeyword?: string;
  searchDate?: string;
}

interface OutreachRecord {
  id: string;
  contactEmail: string;
  contactName: string;
  company: string;
  subject: string;
  body: string;
  sentAt: string;
  status: "sent" | "failed";
  error?: string;
}

type Tab = "collect" | "contacts" | "history";

// ─── Email Templates ───────────────────────────────────────────────────────────

const EMAIL_TEMPLATES = [
  {
    id: "cold-short",
    label: "Impact-driven",
    subject: "{role} with {skills} — quick intro for {company}",
    body: `Hi {name},

I came across {company} and I'm genuinely impressed by what you're building. I'm reaching out because I believe my background in {field} could be a strong fit for your team.

About me:
• {years}+ years of experience in {field}
• Core strengths: {skills}
• Based in {location}

I'd love to jump on a quick 10-minute call this week to discuss how I can contribute to {company}'s success.

Best,
{sender}
{sender_email} | {sender_phone}
{sender_linkedin}`,
  },
  {
    id: "value-based",
    label: "Value-First",
    subject: "Adding value at {company} as a {role}",
    body: `Hi {name},

I've been following {company}'s recent work and I'm excited about the direction you're heading. Your focus on innovation aligns perfectly with my experience.

Here's what I bring to the table:
• {years}+ years of experience in {field}
• Skilled in: {skills}
• Track record of delivering {results}
• {location}-based, ready to hit the ground running

I'd love the opportunity to share my portfolio and discuss how I can contribute to your upcoming projects.

Looking forward to connecting,
{sender}
{sender_phone} | {sender_email} | {sender_linkedin}`,
  },
  {
    id: "high-converting",
    label: "Professional (Formal)",
    subject: "Application for {role} position at {company}",
    body: `Dear {name},

I am writing to express my strong interest in the {role} role at {company}. With {years} years of comprehensive experience in {field}, I have a proven track record of delivering measurable results.

My expertise spans:
• {skills}
• {years}+ years delivering {results}
• Strong background in {field}

I would welcome the opportunity to discuss how my experience aligns with {company}'s objectives. I've attached my resume for your review and am available for an interview at your convenience.

Thank you for your time and consideration.

Sincerely,
{sender}
{sender_email} | {sender_phone}
{sender_linkedin} | {sender_portfolio}`,
  },
  {
    id: "job-application",
    label: "Remote-Ready (US/CA)",
    subject: "Remote {role} — {years}+ years, available immediately",
    body: `Hi {name},

I noticed {company} is actively growing and I'm reaching out because I believe my skills as a {role} would be a great addition to your team.

I am a remote-first professional based in {location} with {years}+ years of experience in {field}. I've successfully collaborated across time zones and delivered high-impact results:

• Technical skills: {skills}
• Proven track record: {results}
• Fully equipped for remote work with a reliable setup

I'd love to connect briefly to discuss how I can help {company} achieve its goals.

Best regards,
{sender}
{sender_phone} | {sender_email} | {sender_linkedin}`,
  },
  {
    id: "bold-direct",
    label: "Bold & Direct",
    subject: "{role} — I can help {company} scale",
    body: `Hi {name},

I'll keep this brief: I'm a {role} with {years}+ years in {field} and a strong track record of delivering results. I've been watching {company} and I know I can contribute immediately.

Key highlights:
• {skills}
• {years}+ years shipping production-grade work
• Based in {location} — remote or onsite

I'm not sending a generic application — I genuinely believe I can move the needle for {company}. Let's set up a 10-minute call this week.

Let's talk,
{sender}
{sender_email} | {sender_phone}
{sender_linkedin}`,
  },
  {
    id: "storytelling",
    label: "Storytelling",
    subject: "My journey in {field} — and why {company} caught my eye",
    body: `Hi {name},

I'll be honest — I don't usually reach out to companies cold. But when I came across {company}, something clicked.

I've spent the last {years} years building my career in {field}, working on challenging problems and delivering real results. My core strengths — {skills} — have helped me ship products that users love and stakeholders trust.

I'm currently exploring {role} opportunities and would love to see if my background aligns with what {company} needs next. I've attached my portfolio for a deeper look.

Would you have 10 minutes this week for a quick chat?

Warmly,
{sender}
{sender_phone} | {sender_email} | {sender_linkedin} | {sender_portfolio}`,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function applyTemplate(body: string, contact: Partial<HRContact>, senderName: string, role: string, skills?: string, field?: string, years?: string, location?: string, achievements?: string, results?: string, senderEmail?: string, senderPhone?: string, senderLinkedin?: string, senderPortfolio?: string) {
  let result = body
    .replace(/\{name\}/g, contact.name?.split(" ")[0] || "there")
    .replace(/\{company\}/g, contact.company || "your company")
    .replace(/\{sender\}/g, senderName || "me")
    .replace(/\{role\}/g, role || "Software Engineer")
    .replace(/\{skills\}/g, skills || "your skills")
    .replace(/\{field\}/g, field || "your field")
    .replace(/\{years\}/g, years || "X")
    .replace(/\{location\}/g, location || "your location")
    .replace(/\{achievements\}/g, achievements || "2–3 bullet points of your top achievements")
    .replace(/\{results\}/g, results || "specific results")
    .replace(/\{sender_email\}/g, senderEmail || "")
    .replace(/\{sender_phone\}/g, senderPhone || "")
    .replace(/\{sender_linkedin\}/g, senderLinkedin || "")
    .replace(/\{sender_portfolio\}/g, senderPortfolio || "");
  // Strip lines that are empty or only contain whitespace/pipe/separator chars
  result = result.split("\n").filter(l => l.trim() && !/^[\s|·\-—•]+$/.test(l)).join("\n");
  return result;
}

function saveContacts(contacts: HRContact[]) {
  localStorage.setItem("cp_hr_contacts", JSON.stringify(contacts));
}

function loadHistory(): OutreachRecord[] {
  try {
    return JSON.parse(localStorage.getItem("cp_hr_history") || "[]");
  } catch {
    return [];
  }
}

function saveHistory(history: OutreachRecord[]) {
  localStorage.setItem("cp_hr_history", JSON.stringify(history));
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function HROutreach() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("collect");

  // Extension state
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [extensionChecking, setExtensionChecking] = useState(true);
  const [extCount, setExtCount] = useState(0);
  const [extMax] = useState(100);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectKeyword, setCollectKeyword] = useState("we are hiring software engineer");
  const [timeRange, setTimeRange] = useState("any");
  const [lastSyncTime, setLastSyncTime] = useState<string>("");
  const [detectAttempts, setDetectAttempts] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncCountRef = useRef(0);
  const [panelEnabled, setPanelEnabled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Contacts state
  const [contacts, setContacts] = useState<HRContact[]>(() => {
    try { return JSON.parse(localStorage.getItem("cp_hr_contacts") || "[]"); } catch { return []; }
  });
  const [contactsLoaded, setContactsLoaded] = useState(false);

  // Manual add
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: "", title: "HR Manager", company: "", email: "", phone: "", linkedinUrl: "", country: "US",
  });

  // Email compose
  const [composeContact, setComposeContact] = useState<HRContact | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(EMAIL_TEMPLATES[3].id);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [senderName, setSenderName] = useState(() => localStorage.getItem("cp_sender_name") || "");
  const [senderEmail, setSenderEmail] = useState(() => localStorage.getItem("cp_sender_email") || "");
  const [senderPhone, setSenderPhone] = useState(() => localStorage.getItem("cp_sender_phone") || "");
  const [senderLinkedin, setSenderLinkedin] = useState(() => localStorage.getItem("cp_sender_linkedin") || "");
  const [senderPortfolio, setSenderPortfolio] = useState(() => localStorage.getItem("cp_sender_portfolio") || "");

  // Resume skills for skill picker
  const [availableSkills, setAvailableSkills] = useState<string[]>([]);

  const [role, setRole] = useState("Software Engineer");
  const [skills, setSkills] = useState(() => localStorage.getItem("cp_skills") || "");
  const [field, setField] = useState(() => localStorage.getItem("cp_field") || "");
  const [years, setYears] = useState(() => localStorage.getItem("cp_years") || "5");
  const [location, setLocation] = useState(() => localStorage.getItem("cp_location") || "");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState(false);
  const [hireBalance, setHireBalance] = useState<number | null>(null);

  // History
  const [history, setHistory] = useState<OutreachRecord[]>(() => loadHistory());

  // ── Filter state ──
  const [filterSearch, setFilterSearch] = useState("");
  const [filterSource, setFilterSource] = useState<"all" | "extension" | "manual" | "google">("all");
  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [filterJobType, setFilterJobType] = useState<"all" | "remote" | "onsite">("all");
  const [filterKeyword, setFilterKeyword] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name">("newest");

  // ── Bulk selection state ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkCompose, setShowBulkCompose] = useState(false);

  // Bulk compose state
  const [bulkTemplateId, setBulkTemplateId] = useState(EMAIL_TEMPLATES[0].id);
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkBody, setBulkBody] = useState("");
  const [bulkSubjectRaw, setBulkSubjectRaw] = useState("");
  const [bulkBodyRaw, setBulkBodyRaw] = useState("");
  const [bulkRole, setBulkRole] = useState("Software Engineer");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ sent: 0, total: 0 });
  const [bulkResults, setBulkResults] = useState<{ email: string; name: string; status: "pending" | "sending" | "sent" | "failed"; error?: string }[]>([]);
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState(false);

  // Session resume upload
  const [sessionResumeName, setSessionResumeName] = useState<string | null>(() => sessionStorage.getItem("cp_hr_resume_name"));
  const resumeBlobRef = useRef<Blob | null>(null);
  const bulkResumeInputRef = useRef<HTMLInputElement>(null);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // ── Computed stats ──
  const stats = useMemo(() => ({
    total: contacts.length,
    withEmail: contacts.filter(c => c.email).length,
    withPhone: contacts.filter(c => c.phone).length > 0 ? contacts.filter(c => c.phone).length : 0,
    withLinkedIn: contacts.filter(c => c.linkedinUrl).length,
    remoteMatch: contacts.filter(c => /remote/i.test(`${c.title} ${c.company}`)).length,
    onsiteMatch: contacts.filter(c => /on.?site/i.test(`${c.title} ${c.company}`)).length,
    withWhatsApp: contacts.filter(c => c.phone).length,
  }), [contacts]);

  const filteredContacts = useMemo(() => {
    let result = [...contacts];
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q)
      );
    }
    if (filterSource !== "all") result = result.filter(c => c.source === filterSource);
    if (filterHasEmail) result = result.filter(c => c.email);
    if (filterHasPhone) result = result.filter(c => c.phone);
    if (filterJobType === "remote") result = result.filter(c => /remote/i.test(`${c.title} ${c.company}`));
    else if (filterJobType === "onsite") result = result.filter(c => /on.?site/i.test(`${c.title} ${c.company}`));
    if (filterKeyword !== "all") result = result.filter(c => c.searchKeyword === filterKeyword);
    if (sortBy === "newest") result.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
    else if (sortBy === "oldest") result.sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
    else if (sortBy === "name") result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [contacts, filterSearch, filterSource, filterHasEmail, filterHasPhone, filterJobType, filterKeyword, sortBy]);

  const uniqueKeywords = useMemo(() => {
    const kw = new Set(contacts.map(c => c.searchKeyword).filter(Boolean));
    return [...kw].sort();
  }, [contacts]);

  const selectAll = useCallback(() => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
    }
  }, [filteredContacts, selectedIds.size]);

  // Search (fallback API)
  const [searchQuery, setSearchQuery] = useState("Hiring WordPress Developer Remote");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState("");

  // ── Extension detection + sync ────────────────────────────────────────────────

  // postMessage RPC to bridge (content scripts are isolated in MV3)
  const hroRpc = useCallback((type: string, extra?: Record<string, unknown>, timeoutMs = 5000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const _id = `hro_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const timer = setTimeout(() => {
        window.removeEventListener('message', onRes);
        reject(new Error('timeout'));
      }, timeoutMs);

      function onRes(event: MessageEvent) {
        const d = event.data;
        if (d?._src === 'hro_bridge' && d?.type === 'HRO_RES' && d?._id === _id) {
          clearTimeout(timer);
          window.removeEventListener('message', onRes);
          if (d.error) reject(new Error(d.error));
          else resolve(d.data);
        }
      }
      window.addEventListener('message', onRes);
      window.postMessage({ _src: 'webapp', type, _id, ...extra }, '*');
    });
  }, []);

  const syncFromExtension = useCallback(async () => {
    try {
      const res = await hroRpc('HRO_GET_CONTACTS', undefined, 4000);
      if (res?.contacts) {
        setExtCount(res.count || res.contacts.length || 0);
        setExtensionConnected(true);

        setContacts((prev) => {
          const existing = new Set(prev.map((c) => c.email.toLowerCase()));
          const merged = [...prev];
          for (const c of res.contacts) {
            if (c.email && !existing.has(c.email.toLowerCase())) {
              merged.push({
                id: c.id || `ext_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                name: c.name || "Unknown",
                title: c.title || "",
                company: c.company || "",
                email: c.email,
                phone: c.phone || "",
                linkedinUrl: c.linkedinUrl || "",
                country: "US",
                source: "extension" as const,
                addedAt: c.collectedAt || new Date().toISOString(),
                searchKeyword: c.searchKeyword || "",
                searchDate: c.searchDate || "",
              });
              existing.add(c.email.toLowerCase());
            } else if (!c.email && c.phone) {
              // Contact with phone but no email — use phone for dedup
              const phoneKey = c.phone.replace(/\D/g, '');
              if (!merged.some(m => m.phone?.replace(/\D/g, '') === phoneKey)) {
                merged.push({
                  id: c.id || `ext_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  name: c.name || "Unknown",
                  title: c.title || "",
                  company: c.company || "",
                  email: "",
                  phone: c.phone,
                  linkedinUrl: c.linkedinUrl || "",
                  country: "US",
                  source: "extension" as const,
                  addedAt: c.collectedAt || new Date().toISOString(),
                  searchKeyword: c.searchKeyword || "",
                  searchDate: c.searchDate || "",
                });
              }
            }
          }
          saveContacts(merged);
          return merged;
        });
      }
    } catch {
      // context invalidated or timeout — poll will catch disconnected state
    }
  }, [hroRpc]);

  useEffect(() => {
    let mounted = true;
    console.log('[HRO] useEffect: detection flow starting');

    // Initial check with timeout — if extension not found after 6s, show not-installed state
    detectTimeoutRef.current = setTimeout(() => {
      if (mounted && !extensionConnected) {
        setExtensionChecking(false);
        setDetectAttempts((a) => a + 1);
      }
    }, 6000);

    // Listen for bridge ready + disconnect events
    const handler = (event: MessageEvent) => {
      if (event.data?._src !== 'hro_bridge') return;
      if (event.data?.type === 'HRO_BRIDGE_READY') {
        console.log('[HRO] BRIDGE_READY — waiting 1.5s for service worker...');
        clearTimeout(detectTimeoutRef.current);
        setTimeout(() => {
          if (mounted) syncFromExtension();
        }, 1500);
      } else if (event.data?.type === 'HRO_BRIDGE_DISCONNECTED') {
        console.log('[HRO] BRIDGE_DISCONNECTED — extension was reloaded');
        setExtensionConnected(false);
        setExtensionChecking(true);
      }
    };
    window.addEventListener('message', handler);

    // Try immediate sync (bridge may already be alive from a prior page load)
    syncFromExtension().then(() => {
      hroRpc('HRO_GET_STATUS', undefined, 2000).then((s: any) => {
        if (s?.count) lastSyncCountRef.current = s.count;
      }).catch(() => {});
    }).catch(() => {});

    // Poll extension status every 4s via RPC and sync new contacts
    pollRef.current = setInterval(async () => {
      try {
        const status = await hroRpc('HRO_GET_STATUS', undefined, 3000);
        setExtensionConnected(true);
        setExtensionChecking(false);
        setExtCount(status.count || 0);
        setIsCollecting(status.isCollecting || false);
        // If count changed since last sync, pull fresh contacts
        if (status.count > 0 && status.count !== lastSyncCountRef.current) {
          await syncFromExtension();
          lastSyncCountRef.current = status.count;
        }
      } catch {
        setExtensionConnected(false);
      }
    }, 4000);

    return () => {
      mounted = false;
      window.removeEventListener('message', handler);
      if (pollRef.current) clearInterval(pollRef.current);
      if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
    };
  }, [syncFromExtension, hroRpc]);

  // ── Extension collect actions ─────────────────────────────────────────────────

  const buildLinkedInUrl = useCallback((keyword: string, range: string) => {
    const base = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(keyword)}&origin=FACETED_SEARCH&sortBy=%5B%22date_posted%22%5D`;
    if (range && range !== "any") return `${base}&datesPosted=${range}`;
    return base;
  }, []);

  const handleStartCollect = async () => {
    try {
      setIsCollecting(true);
      await hroRpc('HRO_START_COLLECTING', { keyword: collectKeyword, timeRange });
    } catch {
      setIsCollecting(false);
    }
  };

  const handleStopCollect = async () => {
    try {
      await hroRpc('HRO_STOP_COLLECTING');
      setIsCollecting(false);
    } catch {}
  };

  const handleClearContacts = async () => {
    if (!window.confirm("Clear all collected contacts?")) return;
    try { await hroRpc('HRO_CLEAR_CONTACTS'); } catch {}
    setContacts([]);
    setExtCount(0);
    saveContacts([]);
  };

  const handleTogglePanel = async (enabled: boolean) => {
    setPanelEnabled(enabled);
    try { await hroRpc('HRO_TOGGLE_PANEL', { enabled }); } catch {}
  };

  useEffect(() => {
    if (!extensionConnected) return;
    hroRpc('HRO_GET_PANEL_ENABLED', undefined, 3000).then((res: any) => {
      if (res?.enabled !== undefined) setPanelEnabled(res.enabled);
    }).catch(() => {});
  }, [extensionConnected, hroRpc]);

  // Fetch user skills from resume
  useEffect(() => {
    fetch("/api/user/resume", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        const parsed = data?.parsed;
        if (parsed?.skills && Array.isArray(parsed.skills)) {
          setAvailableSkills(parsed.skills);
        }
      })
      .catch(() => {});
  }, []);

  // Pre-fill sender details from user profile
  useEffect(() => {
    if (!user) return;
    if (user.name && !senderName) { setSenderName(user.name); localStorage.setItem("cp_sender_name", user.name); }
    if (user.email && !senderEmail) { setSenderEmail(user.email); localStorage.setItem("cp_sender_email", user.email); }
    if (user.phone && !senderPhone) { setSenderPhone(user.phone); localStorage.setItem("cp_sender_phone", user.phone); }
    if (user.linkedinUrl && !senderLinkedin) { setSenderLinkedin(user.linkedinUrl); localStorage.setItem("cp_sender_linkedin", user.linkedinUrl); }
    if (user.portfolioUrl && !senderPortfolio) { setSenderPortfolio(user.portfolioUrl); localStorage.setItem("cp_sender_portfolio", user.portfolioUrl); }
    if (user.currentCity && !location) { setLocation(user.currentCity); localStorage.setItem("cp_location", user.currentCity); }
    if (!role) setRole("Software Engineer");
  }, [user, senderName, senderEmail, senderPhone, senderLinkedin, senderPortfolio, location, role]);

  // Load contacts from server (per-user), fall back to localStorage
  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/hr-outreach/contacts", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        if (data?.contacts && data.contacts.length > 0) {
          const mapped = data.contacts.map((c: any) => ({
            id: c.id || `svr_${c.email}`,
            name: c.name || "Unknown",
            title: c.title || "",
            company: c.company || "",
            email: c.email,
            phone: c.phone || "",
            linkedinUrl: c.linkedinUrl || "",
            source: (c.source === "ext" ? "extension" : c.source === "man" ? "manual" : "google") as HRContact["source"],
            addedAt: c.createdAt || new Date().toISOString(),
            searchKeyword: c.searchKeyword || "",
            searchDate: c.searchDate || "",
          }));
          setContacts(mapped);
          saveContacts(mapped);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setContactsLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  // Debounced sync contacts to server whenever they change
  useEffect(() => {
    if (!contactsLoaded) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      try {
        const payload = contacts.map(c => ({
          name: c.name, title: c.title || "", company: c.company || "",
          email: c.email, phone: c.phone || "", linkedinUrl: c.linkedinUrl || "",
          source: c.source === "extension" ? "ext" : c.source === "manual" ? "man" : "web",
          jobType: "",
          searchKeyword: c.searchKeyword || "",
          searchDate: c.searchDate || "",
          notes: "",
        }));
        await fetch("/api/user/hr-outreach/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ contacts: payload }),
        });
      } catch {}
    }, 2000);
    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current); };
  }, [contacts, contactsLoaded]);

  const detectExtension = useCallback(async () => {
    setRefreshing(true);
    setExtensionChecking(true);
    setDetectAttempts(0);

    // Try up to 3 times with increasing delay (service worker may need startup time)
    for (let attempt = 0; attempt < 3; attempt++) {
      // Try bridge postMessage ping
      try {
        const pong = await new Promise<any>((resolve) => {
          const handler = (event: MessageEvent) => {
            if (event.data?._src === 'hro_bridge' && (event.data?.type === 'HRO_BRIDGE_READY' || event.data?.type === 'HRO_WEB_PONG')) {
              window.removeEventListener('message', handler);
              resolve(event.data);
            }
          };
          window.addEventListener('message', handler);
          window.postMessage({ type: 'HRO_WEB_PING', _src: 'webapp' }, '*');
          setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve(null);
          }, 2000);
        });
        if (pong) {
          setExtensionConnected(true);
          setExtensionChecking(false);
          setRefreshing(false);
          await syncFromExtension();
          return;
        }
      } catch {}

      // Try direct RPC
      try {
        const status = await hroRpc('HRO_GET_STATUS', undefined, 3000);
        if (status) {
          setExtensionConnected(true);
          setExtensionChecking(false);
          setRefreshing(false);
          setExtCount(status.count || 0);
          setIsCollecting(status.isCollecting || false);
          await syncFromExtension();
          return;
        }
      } catch {}

      // Wait before retry (service worker startup can take a few seconds)
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // All attempts failed
    setExtensionChecking(false);
    setDetectAttempts((a) => a + 1);
    setRefreshing(false);
  }, [syncFromExtension, hroRpc]);

  // ── Manual contact ────────────────────────────────────────────────────────────

  const addManualContact = () => {
    if (!manualForm.email || !manualForm.name) return;
    const newContact: HRContact = {
      id: generateId(), ...manualForm, source: "manual", addedAt: new Date().toISOString(),
    };
    const updated = [newContact, ...contacts];
    setContacts(updated);
    saveContacts(updated);
    setManualForm({ name: "", title: "HR Manager", company: "", email: "", phone: "", linkedinUrl: "", country: "US" });
    setShowAddManual(false);
  };

  const removeContact = (id: string) => {
    const updated = contacts.filter((c) => c.id !== id);
    setContacts(updated);
    saveContacts(updated);
  };

  // ── Search fallback ───────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError("");
    setSearchResults([]);
    try {
      const res = await fetch("/api/user/hr-outreach/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, country: "all", platform: "linkedin" }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const addFromSearch = (result: any) => {
    if (contacts.some((c) => c.email === result.email)) return;
    const newContact: HRContact = {
      id: generateId(), name: result.name || "Unknown", title: result.title || "",
      company: result.company || "", email: result.email, phone: "",
      linkedinUrl: result.linkedinUrl || "", country: "US", source: "google",
      addedAt: new Date().toISOString(),
    };
    const updated = [newContact, ...contacts];
    setContacts(updated);
    saveContacts(updated);
  };

  // ── Compose & Send ────────────────────────────────────────────────────────────

  const selectedTemplate = EMAIL_TEMPLATES.find((t) => t.id === selectedTemplateId) || EMAIL_TEMPLATES[3];

  const openCompose = async (contact: HRContact) => {
    setEmailSubject(applyTemplate(selectedTemplate.subject, contact, senderName, role, skills, field, years, location, undefined, undefined, senderEmail, senderPhone, senderLinkedin, senderPortfolio));
    setEmailBody(applyTemplate(selectedTemplate.body, contact, senderName, role, skills, field, years, location, undefined, undefined, senderEmail, senderPhone, senderLinkedin, senderPortfolio));
    setComposeContact(contact);
    setSendError("");
    setSendSuccess(false);
    // Fetch wallet balance
    try {
      const res = await fetch("/api/wallet", { credentials: "include" });
      const data = await res.json();
      setHireBalance(data?.spendable ?? null);
    } catch {
      setHireBalance(null);
    }
  };

  // Re-apply template for single compose when user data changes
  const reapplySingleTemplate = useCallback(() => {
    if (!composeContact) return;
    const tmpl = EMAIL_TEMPLATES.find((t) => t.id === selectedTemplateId) || EMAIL_TEMPLATES[3];
    setEmailSubject(applyTemplate(tmpl.subject, composeContact, senderName, role, skills, field, years, location, undefined, undefined, senderEmail, senderPhone, senderLinkedin, senderPortfolio));
    setEmailBody(applyTemplate(tmpl.body, composeContact, senderName, role, skills, field, years, location, undefined, undefined, senderEmail, senderPhone, senderLinkedin, senderPortfolio));
  }, [composeContact, selectedTemplateId, senderName, role, skills, field, years, location, senderEmail, senderPhone, senderLinkedin, senderPortfolio]);

  // Re-apply template for bulk compose
  const reapplyBulkTemplate = useCallback(() => {
    const first = contacts.find((c) => selectedIds.has(c.id)) || contacts[0];
    if (!first) return;
    const tmpl = EMAIL_TEMPLATES.find((t) => t.id === bulkTemplateId) || EMAIL_TEMPLATES[0];
    setBulkSubject(applyTemplate(tmpl.subject, first, senderName, bulkRole, skills, field, years, location, undefined, undefined, senderEmail, senderPhone, senderLinkedin, senderPortfolio));
    setBulkBody(applyTemplate(tmpl.body, first, senderName, bulkRole, skills, field, years, location, undefined, undefined, senderEmail, senderPhone, senderLinkedin, senderPortfolio));
  }, [contacts, selectedIds, bulkTemplateId, senderName, bulkRole, skills, field, years, location, senderEmail, senderPhone, senderLinkedin, senderPortfolio]);

  // Toggle a skill in the skills string
  const toggleSkill = useCallback((skill: string) => {
    setSkills((prev) => {
      const list = prev ? prev.split(", ").map(s => s.trim()).filter(Boolean) : [];
      const idx = list.findIndex(s => s.toLowerCase() === skill.toLowerCase());
      let next: string[];
      if (idx >= 0) next = list.filter((_, i) => i !== idx);
      else next = [...list, skill];
      const joined = next.join(", ");
      localStorage.setItem("cp_skills", joined);
      return joined;
    });
  }, []);

  // Re-apply template preview when skills or sender details change
  useEffect(() => {
    if (composeContact) reapplySingleTemplate();
  }, [skills, senderEmail, senderPhone, senderLinkedin, senderPortfolio, field, years, location, role]);

  useEffect(() => {
    if (showBulkCompose) reapplyBulkTemplate();
  }, [skills, senderEmail, senderPhone, senderLinkedin, senderPortfolio, field, years, location, bulkRole]);

  const sendEmail = async () => {
    if (!composeContact || !emailSubject || !emailBody) return;
    setSending(true);
    setSendError("");
    setSendSuccess(false);
    try {
      let res: Response;
      res = await fetch("/api/user/hr-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: composeContact.email, name: composeContact.name, company: composeContact.company, subject: emailSubject, body: emailBody }),
      });
      const data = await res.json();

      // Update local wallet balance on success
      if (res.ok && data.success) {
        setHireBalance((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
      }

      if (res.status === 402) {
        throw new Error("Insufficient Hires. Please top up your wallet.");
      }

      const record: OutreachRecord = {
        id: generateId(), contactEmail: composeContact.email, contactName: composeContact.name,
        company: composeContact.company, subject: emailSubject, body: emailBody,
        sentAt: new Date().toISOString(), status: res.ok && data.success ? "sent" : "failed", error: data.error,
      };
      const updatedHistory = [record, ...history];
      setHistory(updatedHistory);
      saveHistory(updatedHistory);
      if (res.ok && data.success) {
        setSendSuccess(true);
        setTimeout(() => { setComposeContact(null); setSendSuccess(false); setActiveTab("history"); }, 1500);
      } else {
        throw new Error(data.error || "Failed to send");
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  // ── Send test email ──────────────────────────────────────────────────────────

  const sendTestEmail = useCallback(async (testEmail: string) => {
    if (!composeContact || !emailSubject || !emailBody) return;
    setSending(true);
    setSendError("");
    setSendSuccess(false);
    try {
      const res = await fetch("/api/user/hr-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail, name: composeContact.name, company: composeContact.company, subject: emailSubject, body: emailBody, test: "true" }),
      });
      const data = await res.json();
      const testRecord: OutreachRecord = {
        id: generateId(), contactEmail: testEmail, contactName: "Test — " + testEmail,
        company: "", subject: emailSubject, body: emailBody,
        sentAt: new Date().toISOString(), status: res.ok && data.success ? "sent" : "failed", error: data.error,
      };
      const updatedHistory = [testRecord, ...history];
      setHistory(updatedHistory);
      saveHistory(updatedHistory);
      if (res.ok && data.success) {
        setSendSuccess(true);
        setTimeout(() => setSendSuccess(false), 3000);
      } else {
        throw new Error(data.error || "Test send failed");
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Test send failed");
    } finally {
      setSending(false);
    }
  }, [composeContact, emailSubject, emailBody, history]);

  // ── Bulk resume upload (session) ──────────────────────────────────────────────

  const handleBulkResumeUpload = useCallback((file: File) => {
    if (!file.name.match(/\.(pdf|docx|doc)$/i)) {
      setBulkError("Only PDF, DOCX files are supported");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setBulkError("File must be <= 5MB");
      return;
    }
    sessionStorage.setItem("cp_hr_resume_name", file.name);
    setSessionResumeName(file.name);
    file.arrayBuffer().then((buf) => {
      resumeBlobRef.current = new Blob([buf], { type: file.type });
    });
  }, []);

  const clearSessionResume = useCallback(() => {
    sessionStorage.removeItem("cp_hr_resume_name");
    setSessionResumeName(null);
    resumeBlobRef.current = null;
  }, []);

  // ── Bulk compose / send ──────────────────────────────────────────────────────

  const openBulkCompose = useCallback(() => {
    const first = contacts.find((c) => selectedIds.has(c.id));
    const tmpl = EMAIL_TEMPLATES.find((t) => t.id === bulkTemplateId) || EMAIL_TEMPLATES[0];
    setBulkSubjectRaw(tmpl.subject);
    setBulkBodyRaw(tmpl.body);
    setBulkSubject(applyTemplate(tmpl.subject, first || contacts[0], senderName, bulkRole, skills, field, years, location, undefined, undefined, senderEmail, senderPhone, senderLinkedin, senderPortfolio));
    setBulkBody(applyTemplate(tmpl.body, first || contacts[0], senderName, bulkRole, skills, field, years, location, undefined, undefined, senderEmail, senderPhone, senderLinkedin, senderPortfolio));
    setBulkError("");
    setBulkSuccess(false);
    setBulkProgress({ sent: 0, total: selectedIds.size });
    setBulkResults(
      contacts.filter((c) => selectedIds.has(c.id) && c.email).map(c => ({
        email: c.email, name: c.name, status: "pending" as const,
      }))
    );
    setShowBulkCompose(true);
  }, [contacts, selectedIds, senderName, bulkTemplateId, bulkRole]);

  const bulkSendAll = useCallback(async () => {
    const targets = contacts.filter((c) => selectedIds.has(c.id) && c.email);
    if (targets.length === 0) {
      setBulkError("No contacts with email selected");
      return;
    }
    setBulkSending(true);
    setBulkError("");
    setBulkProgress({ sent: 0, total: targets.length });
    setBulkResults(targets.map(c => ({ email: c.email, name: c.name, status: "pending" as const })));
    let sentCount = 0;
    for (const contact of targets) {
      setBulkResults(prev => prev.map(r => r.email === contact.email ? { ...r, status: "sending" } : r));
      try {
        const body = applyTemplate(bulkBodyRaw || bulkBody, contact, senderName, bulkRole, skills, field, years, location, undefined, undefined, senderEmail, senderPhone, senderLinkedin, senderPortfolio);
        const subject = applyTemplate(bulkSubjectRaw || bulkSubject, contact, senderName, bulkRole, skills, field, years, location, undefined, undefined, senderEmail, senderPhone, senderLinkedin, senderPortfolio);
        const res = await fetch("/api/user/hr-outreach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ to: contact.email, name: contact.name, company: contact.company || "", subject, body }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          sentCount++;
          setBulkResults(prev => prev.map(r => r.email === contact.email ? { ...r, status: "sent" } : r));
          setBulkProgress({ sent: sentCount, total: targets.length });
          const record: OutreachRecord = {
            id: generateId(), contactEmail: contact.email, contactName: contact.name,
            company: contact.company || "", subject, body,
            sentAt: new Date().toISOString(), status: "sent",
          };
          const updatedHistory = [record, ...history];
          setHistory(updatedHistory);
          saveHistory(updatedHistory);
        } else {
          setBulkResults(prev => prev.map(r => r.email === contact.email ? { ...r, status: "failed", error: data.error || "Send failed" } : r));
        }
        // Small delay to avoid rate limits
        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        setBulkResults(prev => prev.map(r => r.email === contact.email ? { ...r, status: "failed", error: err instanceof Error ? err.message : "Send failed" } : r));
        const record: OutreachRecord = {
          id: generateId(), contactEmail: contact.email, contactName: contact.name,
          company: contact.company || "", subject: bulkSubject, body: bulkBody,
          sentAt: new Date().toISOString(), status: "failed", error: "Send failed",
        };
        const updatedHistory = [record, ...history];
        setHistory(updatedHistory);
        saveHistory(updatedHistory);
      }
    }
    setBulkSending(false);
    setBulkProgress({ sent: sentCount, total: targets.length });
    setBulkSuccess(sentCount === targets.length);
    if (sentCount === targets.length) {
      clearSelection();
    }
  }, [contacts, selectedIds, bulkBodyRaw, bulkSubjectRaw, bulkBody, bulkSubject, senderName, bulkRole, history, clearSelection]);

  // ── Export CSV ─────────────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    const headers = ["Name", "Title", "Company", "Email", "Phone", "LinkedIn URL", "Source", "Added At"];
    const rows = contacts.map((c) => [c.name, c.title, c.company, c.email, c.phone || "", c.linkedinUrl || "", c.source, c.addedAt]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hr_contacts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const progressPct = Math.min(100, Math.round((extCount / extMax) * 100));

  return (
    <div className="p-4 md:p-6 space-y-6 relative z-0">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">HR Direct Outreach</h1>
            <p className="text-sm text-gray-500">Collect HR contacts from LinkedIn & send personalized emails</p>
          </div>
          {/* Extension status badge */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium ${
            extensionConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : extensionChecking
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <Puzzle className="w-4 h-4" />
            {extensionConnected ? 'Extension Connected' : extensionChecking ? 'Checking...' : 'Extension Not Found'}
            {!extensionConnected && !extensionChecking && (
              <button
                onClick={detectExtension}
                disabled={refreshing}
                className="ml-1 p-1 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                title="Refresh extension detection"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Extension Not Installed Banner ── */}
      {!extensionConnected && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg flex-shrink-0">
              <Puzzle className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 text-lg">Install the HR Outreach Extension</h3>
              <p className="text-sm text-gray-600 mt-1">
                The extension scrapes LinkedIn hiring posts for HR contacts — name, title, company, email & phone number.
                It auto-collects up to 100 contacts and syncs them to this dashboard.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <a
                  href={HR_OUTREACH_EXTENSION_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-md"
                >
                  <ExternalLink className="w-4 h-4" />
                  Install from Chrome Web Store
                </a>
                <button
                  onClick={detectExtension}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-md disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Detecting...' : 'Refresh & Detect'}
                </button>
                {detectAttempts > 0 && (
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-amber-300 text-amber-700 text-sm font-semibold rounded-xl hover:bg-amber-50 transition-colors shadow-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reload Page
                  </button>
                )}
                <span className="text-xs text-gray-400">
                  {detectAttempts > 0
                    ? 'Extension not detected. Install it then reload this page.'
                    : 'Make sure extension is installed & enabled'}
                </span>
              </div>
            </div>
          </div>
          {/* Steps */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { step: "1", title: "Install Extension", desc: "Add HR Direct Outreach from the Chrome Web Store" },
              { step: "2", title: "Open LinkedIn & Collect", desc: "Click Start — extension scrapes hiring posts" },
              { step: "3", title: "Send Emails", desc: "Contacts sync here automatically" },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex items-start gap-3 bg-white/60 rounded-xl p-3 border border-amber-100">
                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{step}</div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Extension Connected — Collect Panel ── */}
      {extensionConnected && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur border border-white/60 rounded-2xl p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-500" />
              Collect HR Contacts from LinkedIn
            </h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold text-indigo-600">{extCount}</span>
              <span className="text-gray-400">/ {extMax}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <motion.div
              className="h-3 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          {extCount >= extMax && (
            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Target reached! Ready to send emails.
            </p>
          )}

          {/* Keyword input + time filter + action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={collectKeyword}
                onChange={(e) => setCollectKeyword(e.target.value)}
                placeholder="e.g. we are hiring software engineer"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
            >
              <option value="any">Any time</option>
              <option value="past24h">Past 24 hours</option>
              <option value="pastWeek">Past week</option>
              <option value="pastMonth">Past month</option>
            </select>
            <div className="flex gap-2">
              {!isCollecting ? (
                <button
                  onClick={handleStartCollect}
                  disabled={extCount >= extMax}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-md"
                >
                  <Play className="w-4 h-4" />
                  Start Collecting
                </button>
              ) : (
                <button
                  onClick={handleStopCollect}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition-colors shadow-md"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              )}
              <button
                onClick={handleClearContacts}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-2.5 rounded-xl transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
              {contacts.length > 0 && (
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 px-3 py-2 rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              )}
            </div>
          </div>

          {/* Status */}
          {isCollecting && (
            <div className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 rounded-xl px-4 py-3 border border-indigo-100">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Collecting on LinkedIn... Contacts sync automatically.</span>
              <a
                href={buildLinkedInUrl(collectKeyword, timeRange)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open LinkedIn
              </a>
            </div>
          )}

          {/* How it works */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Scrapes LinkedIn hiring posts</span>
            <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-indigo-400" /> Extracts email & phone</span>
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-indigo-400" /> Auto-syncs to this dashboard</span>
          </div>

          {/* Panel on/off toggle */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Puzzle className="w-4 h-4 text-indigo-500" />
              <span className="font-medium text-gray-700">Show floating panel on LinkedIn</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={panelEnabled}
                onChange={(e) => handleTogglePanel(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
            </label>
          </div>
        </motion.div>
      )}

      {/* ── Fallback: API Search (always available) ── */}
      <div className="bg-white/80 backdrop-blur border border-white/60 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
          <Search className="w-4 h-4 text-gray-400" />
          Manual Search (API Fallback)
        </h2>
        <div className="flex gap-2">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search LinkedIn via API..."
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>
        {searchError && (
          <p className="text-xs text-red-500">{searchError}</p>
        )}
        {searchResults.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {searchResults.map((r: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:border-indigo-200 transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {(r.name || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                  <p className="text-xs text-gray-500 truncate">{r.title} · {r.company}</p>
                </div>
                <button
                  onClick={() => addFromSearch(r)}
                  disabled={contacts.some((c) => c.email === r.email)}
                  className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-40 transition-colors"
                >
                  {contacts.some((c) => c.email === r.email) ? "Added" : "+ Add"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Tabs: Contacts / History ── */}
      <div className="flex gap-1 bg-white/70 border border-gray-200 rounded-xl p-1 backdrop-blur-sm">
        {([
          { id: "contacts" as Tab, label: "Outreach List", icon: Users, count: contacts.length },
          { id: "history" as Tab, label: "Sent History", icon: Clock, count: history.length },
        ]).map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === id
                ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === id ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: CONTACTS DASHBOARD                                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {activeTab === "contacts" && (
          <motion.div key="contacts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">

            {/* ── Stats Overview ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Contacts", value: stats.total, icon: Users, color: "from-indigo-500 to-purple-600", bg: "bg-indigo-50" },
                { label: "Got Email", value: stats.withEmail, icon: Mail, color: "from-emerald-500 to-teal-600", bg: "bg-emerald-50" },
                { label: "Got Phone", value: stats.withPhone, icon: Smartphone, color: "from-blue-500 to-cyan-600", bg: "bg-blue-50" },
                { label: "LinkedIn Profiles", value: stats.withLinkedIn, icon: Linkedin, color: "from-sky-500 to-blue-600", bg: "bg-sky-50" },
                { label: "Remote Jobs", value: stats.remoteMatch, icon: Wifi, color: "from-amber-500 to-orange-600", bg: "bg-amber-50" },
                { label: "On-site Jobs", value: stats.onsiteMatch, icon: MapPin, color: "from-rose-500 to-pink-600", bg: "bg-rose-50" },
                { label: "WhatsApp Ready", value: stats.withWhatsApp, icon: Smartphone, color: "from-green-500 to-emerald-600", bg: "bg-green-50" },
                { label: "Total Matches", value: filteredContacts.length, icon: Hash, color: "from-violet-500 to-purple-600", bg: "bg-violet-50" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <motion.div key={label} whileHover={{ scale: 1.02, y: -2 }}
                  className={`${bg} rounded-2xl p-4 border border-white/60 shadow-sm cursor-pointer transition-shadow hover:shadow-md`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{label}</span>
                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-sm`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">{value}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {stats.total > 0 ? `${Math.round((value / stats.total) * 100)}%` : '—'} of total
                  </div>
                </motion.div>
              ))}
            </div>

            {/* ── Filter Bar ── */}
            <div className="bg-white/80 backdrop-blur border border-white/60 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Filter className="w-4 h-4 text-indigo-500" />
                Filters
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    placeholder="Search name, company, email..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <select value={filterSource} onChange={(e) => setFilterSource(e.target.value as any)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
                >
                  <option value="all">All Sources</option>
                  <option value="extension">Extension</option>
                  <option value="manual">Manual</option>
                  <option value="google">Google</option>
                </select>
                <select value={filterJobType} onChange={(e) => setFilterJobType(e.target.value as any)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
                >
                  <option value="all">All Types</option>
                  <option value="remote">Remote</option>
                  <option value="onsite">On-site</option>
                </select>
                {uniqueKeywords.length > 0 && (
                  <select value={filterKeyword} onChange={(e) => setFilterKeyword(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
                  >
                    <option value="all">All Keywords</option>
                    {uniqueKeywords.map(kw => (
                      <option key={kw} value={kw}>{kw}</option>
                    ))}
                  </select>
                )}
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name">Name A-Z</option>
                </select>
                <label className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm cursor-pointer hover:bg-gray-50 transition-colors">
                  <input type="checkbox" checked={filterHasEmail} onChange={() => setFilterHasEmail(v => !v)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                  <Mail className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-600">Has Email</span>
                </label>
                <label className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm cursor-pointer hover:bg-gray-50 transition-colors">
                  <input type="checkbox" checked={filterHasPhone} onChange={() => setFilterHasPhone(v => !v)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                  <Phone className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-600">Has Phone</span>
                </label>
                {(filterSearch || filterSource !== "all" || filterHasEmail || filterHasPhone || filterJobType !== "all" || filterKeyword !== "all") && (
                  <button onClick={() => { setFilterSearch(""); setFilterSource("all"); setFilterHasEmail(false); setFilterHasPhone(false); setFilterJobType("all"); setFilterKeyword("all"); setSortBy("newest"); }}
                    className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-xl text-sm transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
              </div>
            </div>

            {/* ── Toolbar ── */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {filteredContacts.length > 0 && (
                  <button onClick={selectAll} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selectedIds.size === filteredContacts.length ? "bg-indigo-600 border-indigo-600" : selectedIds.size > 0 ? "bg-indigo-400 border-indigo-400" : "border-gray-300"}`}>
                      {selectedIds.size === filteredContacts.length && <Check className="w-3 h-3 text-white" />}
                      {selectedIds.size > 0 && selectedIds.size < filteredContacts.length && <Minus className="w-3 h-3 text-white" />}
                    </div>
                    Select All
                  </button>
                )}
                <p className="text-sm font-medium text-gray-700">
                  {filteredContacts.length} <span className="text-gray-400 font-normal">of {contacts.length}</span>
                </p>
                <span className="text-xs text-gray-400">contacts</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportCSV}
                  disabled={contacts.length === 0}
                  className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 hover:border-gray-400 px-3 py-2 rounded-xl transition-colors disabled:opacity-40"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
                <button
                  onClick={handleClearContacts}
                  disabled={contacts.length === 0}
                  className="flex items-center gap-1.5 text-sm text-red-600 border border-red-200 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" /> Clear All
                </button>
                <button
                  onClick={() => setShowAddManual((v) => !v)}
                  className="flex items-center gap-1.5 text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-2 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Add Contact
                </button>
              </div>
            </div>

            {/* ── Bulk action bar ── */}
            <AnimatePresence>
              {selectedIds.size > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl px-4 py-2.5 mb-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <Check className="w-4 h-4 text-indigo-600" />
                      </div>
                      <span className="text-sm font-semibold text-indigo-900">{selectedIds.size} selected</span>
                      <button onClick={clearSelection} className="text-xs text-indigo-500 hover:text-indigo-700 underline ml-1">Clear</button>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={openBulkCompose}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" /> Send Mail
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Manual add form ── */}
            <AnimatePresence>
              {showAddManual && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white/80 backdrop-blur border border-indigo-100 rounded-2xl p-5 shadow-sm overflow-hidden"
                >
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-500" /> Add HR Contact Manually
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "name", placeholder: "Full Name *", icon: User },
                      { key: "title", placeholder: "Job Title", icon: Building2 },
                      { key: "company", placeholder: "Company", icon: Building2 },
                      { key: "email", placeholder: "Email *", icon: Mail },
                      { key: "phone", placeholder: "Phone", icon: Phone },
                      { key: "linkedinUrl", placeholder: "LinkedIn URL", icon: Linkedin },
                    ].map(({ key, placeholder, icon: Icon }) => (
                      <div key={key} className="relative">
                        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          value={(manualForm as any)[key]}
                          onChange={(e) => setManualForm((p) => ({ ...p, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={addManualContact} disabled={!manualForm.email || !manualForm.name}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                      Add Contact
                    </button>
                    <button onClick={() => setShowAddManual(false)}
                      className="px-4 py-2 text-gray-600 text-sm border border-gray-200 rounded-xl hover:border-gray-400 transition-colors">
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Sender name ── */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-amber-700 block mb-1">Your Name (shown in emails)</label>
                <input
                  type="text" value={senderName}
                  onChange={(e) => { setSenderName(e.target.value); localStorage.setItem("cp_sender_name", e.target.value); }}
                  placeholder="e.g. Alex Kumar"
                  className="w-full px-3 py-1.5 border border-amber-200 rounded-lg text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            {/* ── Contact Cards ── */}
            {contacts.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 bg-white/60 rounded-2xl border border-white/60">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-indigo-400" />
                </div>
                <p className="font-semibold text-gray-600 text-lg">No contacts yet</p>
                <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
                  Use the extension to collect from LinkedIn, or add manually using the button above
                </p>
              </motion.div>
            ) : filteredContacts.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 bg-white/60 rounded-2xl border border-white/60">
                <Filter className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-500">No contacts match your filters</p>
                <button onClick={() => { setFilterSearch(""); setFilterSource("all"); setFilterHasEmail(false); setFilterHasPhone(false); setFilterJobType("all"); }}
                  className="mt-2 text-sm text-indigo-600 hover:underline"
                >
                  Clear all filters
                </button>
              </motion.div>
            ) : (
              <div className="grid gap-2.5">
                  {filteredContacts.map((contact) => (
                    <motion.div key={contact.id} layout initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
                      className={`bg-white/80 backdrop-blur border rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all hover:border-indigo-200 group ${selectedIds.has(contact.id) ? "border-indigo-400 bg-indigo-50/60" : "border-white/60"}`}
                    >
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleSelect(contact.id)} className="flex-shrink-0">
                          <div className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-colors ${selectedIds.has(contact.id) ? "bg-indigo-600 border-indigo-600" : "border-gray-300 hover:border-indigo-400"}`}>
                            {selectedIds.has(contact.id) && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </button>
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="text-indigo-600 font-bold text-xs">{contact.name.charAt(0).toUpperCase()}</span>
                        </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <p className="font-semibold text-gray-900 text-sm">{contact.name}</p>
                          {contact.source === "extension" && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">EXT</span>
                          )}
                          {contact.source === "manual" && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">MAN</span>
                          )}
                          {contact.source === "google" && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-700 border border-sky-200">WEB</span>
                          )}
                          <span className="text-xs text-gray-400 truncate max-w-[200px]">{contact.title}</span>
                          <span className="hidden sm:inline text-xs text-gray-300">·</span>
                          <span className="hidden sm:inline text-xs text-gray-400 truncate max-w-[150px]">{contact.company}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                          {contact.email && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Mail className="w-3 h-3 text-emerald-500" />
                              {contact.email}
                            </span>
                          )}
                          {contact.phone && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-blue-500" />
                              {contact.phone}
                            </span>
                          )}
                          {/remote/i.test(`${contact.title} ${contact.company}`) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex items-center gap-0.5">
                              <Wifi className="w-2.5 h-2.5" /> Remote
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                        {contact.linkedinUrl && (
                          <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer"
                            className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 flex items-center justify-center transition-colors" title="LinkedIn">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button onClick={() => openCompose(contact)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity shadow-sm">
                          <Send className="w-3 h-3" /> Send
                        </button>
                        <button onClick={() => removeContact(contact.id)}
                          className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center transition-colors" title="Remove">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* TAB: HISTORY                                                          */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "history" && (
          <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{history.length} email{history.length !== 1 ? "s" : ""} sent</p>
              {history.length > 0 && (
                <button onClick={() => { if (confirm("Clear all sent history?")) { setHistory([]); saveHistory([]); } }}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Clear
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <div className="text-center py-16 bg-white/60 rounded-2xl border border-white/60">
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-500">No emails sent yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((rec) => (
                  <div key={rec.id} className="bg-white/80 backdrop-blur border border-white/60 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0">
                        {rec.status === "sent" ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{rec.contactName}</p>
                        <p className="text-xs text-gray-500 truncate">{rec.contactEmail} · {rec.company}</p>
                        <p className="text-xs text-gray-400 truncate">{rec.subject}</p>
                        {rec.error && <p className="text-xs text-red-400 mt-0.5">{rec.error}</p>}
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                        rec.status === "sent" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                      }`}>{rec.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Compose Email Modal ── */}
      <AnimatePresence>
        {composeContact && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setComposeContact(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h2 className="font-bold text-gray-900 flex items-center gap-2">
                    <Send className="w-4 h-4 text-indigo-500" /> Compose Email
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    To: <span className="font-medium text-gray-700">{composeContact.name}</span> · <span className="text-gray-500">{composeContact.email}</span>
                  </p>
                </div>
                <button onClick={() => setComposeContact(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  Fill in all fields below — they replace the placeholders in your chosen template.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Your Name</label>
                    <input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Your full name"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Target Role</label>
                    <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Frontend Developer"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Skills</label>
                    <input value={skills} onChange={(e) => { setSkills(e.target.value); localStorage.setItem("cp_skills", e.target.value); }} placeholder="e.g. React, Node.js, Python"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    {availableSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {availableSkills.map((sk) => {
                          const sel = skills.split(", ").map(s => s.trim().toLowerCase()).includes(sk.toLowerCase());
                          return (
                            <button key={sk} type="button" onClick={() => toggleSkill(sk)}
                              className={`text-xs px-2 py-1 rounded-lg border transition-all ${sel ? 'bg-indigo-100 border-indigo-300 text-indigo-700 font-medium' : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'}`}>
                              {sel ? '✓ ' : ''}{sk}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Field</label>
                    <input value={field} onChange={(e) => { setField(e.target.value); localStorage.setItem("cp_field", e.target.value); }} placeholder="e.g. Full-Stack Development"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Years of Exp</label>
                    <input value={years} onChange={(e) => { setYears(e.target.value); localStorage.setItem("cp_years", e.target.value); }} placeholder="e.g. 5"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Location</label>
                    <input value={location} onChange={(e) => { setLocation(e.target.value); localStorage.setItem("cp_location", e.target.value); }} placeholder="e.g. San Francisco, CA"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>
                {/* ── Sender contact details ── */}
                <details open className="group">
                  <summary className="text-xs font-semibold text-indigo-600 cursor-pointer hover:text-indigo-800 transition-colors select-none">
                    ↓ Your Contact Details (appears in email signature)
                  </summary>
                  <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Your Email</label>
                      <input value={senderEmail} onChange={(e) => { setSenderEmail(e.target.value); localStorage.setItem("cp_sender_email", e.target.value); }} placeholder="your@email.com"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Your Phone</label>
                      <input value={senderPhone} onChange={(e) => { setSenderPhone(e.target.value); localStorage.setItem("cp_sender_phone", e.target.value); }} placeholder="+1 555-123-4567"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">LinkedIn URL</label>
                      <input value={senderLinkedin} onChange={(e) => { setSenderLinkedin(e.target.value); localStorage.setItem("cp_sender_linkedin", e.target.value); }} placeholder="linkedin.com/in/yourprofile"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Portfolio URL</label>
                      <input value={senderPortfolio} onChange={(e) => { setSenderPortfolio(e.target.value); localStorage.setItem("cp_sender_portfolio", e.target.value); }} placeholder="yourportfolio.com"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                  </div>
                  <p className="text-xs text-amber-600 mt-1">Fill these in so your email signature includes your contact info.</p>
                </details>
                {/* Template Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600">Choose Template</label>
                  <div className="grid grid-cols-2 gap-2">
                    {EMAIL_TEMPLATES.map((t) => (
                      <button key={t.id} onClick={() => {
                        setSelectedTemplateId(t.id);
                        if (composeContact) {
                          setEmailSubject(applyTemplate(t.subject, composeContact, senderName, role, skills, field, years, location, undefined, undefined, senderEmail, senderPhone, senderLinkedin, senderPortfolio));
                          setEmailBody(applyTemplate(t.body, composeContact, senderName, role, skills, field, years, location, undefined, undefined, senderEmail, senderPhone, senderLinkedin, senderPortfolio));
                        }
                      }}
                        className={`text-left px-3 py-2.5 rounded-xl text-sm border transition-all ${
                          selectedTemplateId === t.id
                            ? 'bg-indigo-50 border-indigo-300 shadow-sm ring-1 ring-indigo-200'
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="font-medium text-gray-800">{t.label}</span>
                        <span className="block text-[10px] text-gray-400 mt-0.5 truncate">{t.subject}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Subject</label>
                  <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>

                {/* Body */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-600">Body</label>
                    <span className="text-[10px] text-gray-400">{"{name}"} {"{company}"} {"{role}"} {"{sender}"} {"{skills}"} {"{field}"} {"{years}"} {"{location}"} {"{sender_email}"} {"{sender_phone}"} {"{sender_linkedin}"} {"{sender_portfolio}"}</span>
                  </div>
                  <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={8}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none font-mono" />
                </div>

                {/* Preview */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">Preview</span>
                    <span className="text-[10px] text-gray-400">How recipient will see it</span>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-100 p-3 text-sm text-gray-700 whitespace-pre-wrap break-words max-h-40 overflow-y-auto leading-relaxed">
                    {emailBody}
                  </div>
                </div>
                {sendError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4" /> {sendError}
                  </div>
                )}
                {sendSuccess && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
                    <CheckCircle className="w-4 h-4" /> Email sent successfully!
                  </div>
                )}
                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm">
                  <span className="text-gray-600">Cost: <span className="font-semibold text-indigo-600">1 Hire</span></span>
                  <span className="text-gray-500">Balance: <span className={`font-semibold ${hireBalance !== null && hireBalance > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{hireBalance !== null ? hireBalance : '...'}</span> Hires</span>
                </div>
                {hireBalance !== null && hireBalance <= 0 && (
                  <a href="/dashboard/billing" className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                    <Zap className="w-3 h-3" /> Top up your Hires wallet to send emails
                  </a>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={sendEmail} disabled={sending || !emailSubject || !emailBody || (hireBalance !== null && hireBalance <= 0)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl shadow-sm hover:from-indigo-600 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all">
                    {sending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sending...</> : <><Send className="w-4 h-4" /> Send Email</>}
                  </button>
                  <button onClick={() => {
                    const testTo = prompt("Send test email to:", senderEmail || "your@email.com");
                    if (testTo) sendTestEmail(testTo);
                  }} disabled={sending || !emailSubject || !emailBody}
                    className="flex items-center gap-1.5 px-4 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 text-sm">
                    <Mail className="w-4 h-4" /> Test (free)
                  </button>
                  <button onClick={() => setComposeContact(null)}
                    className="px-5 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* BULK COMPOSE MODAL                                                    */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {showBulkCompose && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && !bulkSending && setShowBulkCompose(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h2 className="font-bold text-gray-900 flex items-center gap-2">
                    <Send className="w-4 h-4 text-indigo-500" /> Bulk Email ({selectedIds.size} recipients)
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">Send same email to all selected contacts</p>
                </div>
                <button onClick={() => !bulkSending && setShowBulkCompose(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  Fill in all fields below — they replace the placeholders in your chosen template.
                </div>
                {/* Sender info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Your Name</label>
                    <input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Your full name"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Target Role</label>
                    <input value={bulkRole} onChange={(e) => setBulkRole(e.target.value)} placeholder="e.g. Frontend Developer"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Skills</label>
                    <input value={skills} onChange={(e) => { setSkills(e.target.value); localStorage.setItem("cp_skills", e.target.value); }} placeholder="e.g. React, Node.js, Python"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    {availableSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {availableSkills.map((sk) => {
                          const sel = skills.split(", ").map(s => s.trim().toLowerCase()).includes(sk.toLowerCase());
                          return (
                            <button key={sk} type="button" onClick={() => toggleSkill(sk)}
                              className={`text-xs px-2 py-1 rounded-lg border transition-all ${sel ? 'bg-indigo-100 border-indigo-300 text-indigo-700 font-medium' : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'}`}>
                              {sel ? '✓ ' : ''}{sk}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Field</label>
                    <input value={field} onChange={(e) => { setField(e.target.value); localStorage.setItem("cp_field", e.target.value); }} placeholder="e.g. Full-Stack Development"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Years of Exp</label>
                    <input value={years} onChange={(e) => { setYears(e.target.value); localStorage.setItem("cp_years", e.target.value); }} placeholder="e.g. 5"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Location</label>
                    <input value={location} onChange={(e) => { setLocation(e.target.value); localStorage.setItem("cp_location", e.target.value); }} placeholder="e.g. San Francisco, CA"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>
                {/* ── Sender contact details ── */}
                <details className="group">
                  <summary className="text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-700 transition-colors select-none">
                    Your Contact Details (appears in email signature) ▾
                  </summary>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Your Email</label>
                      <input value={senderEmail} onChange={(e) => { setSenderEmail(e.target.value); localStorage.setItem("cp_sender_email", e.target.value); }} placeholder="your@email.com"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Your Phone</label>
                      <input value={senderPhone} onChange={(e) => { setSenderPhone(e.target.value); localStorage.setItem("cp_sender_phone", e.target.value); }} placeholder="+1 555-123-4567"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">LinkedIn URL</label>
                      <input value={senderLinkedin} onChange={(e) => { setSenderLinkedin(e.target.value); localStorage.setItem("cp_sender_linkedin", e.target.value); }} placeholder="linkedin.com/in/yourprofile"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Portfolio URL</label>
                      <input value={senderPortfolio} onChange={(e) => { setSenderPortfolio(e.target.value); localStorage.setItem("cp_sender_portfolio", e.target.value); }} placeholder="yourportfolio.com"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                  </div>
                </details>

                {/* Template Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600">Choose Template</label>
                  <div className="grid grid-cols-2 gap-2">
                    {EMAIL_TEMPLATES.map((t) => (
                      <button key={t.id} onClick={() => {
                        setBulkTemplateId(t.id);
                        const first = contacts.find((c) => selectedIds.has(c.id)) || contacts[0];
                        setBulkSubjectRaw(t.subject);
                        setBulkBodyRaw(t.body);
                        setBulkSubject(applyTemplate(t.subject, first, senderName, bulkRole, skills, field, years, location, undefined, undefined, senderEmail, senderPhone, senderLinkedin, senderPortfolio));
                        setBulkBody(applyTemplate(t.body, first, senderName, bulkRole, skills, field, years, location, undefined, undefined, senderEmail, senderPhone, senderLinkedin, senderPortfolio));
                      }}
                        className={`text-left px-3 py-2.5 rounded-xl text-sm border transition-all ${
                          bulkTemplateId === t.id
                            ? 'bg-indigo-50 border-indigo-300 shadow-sm ring-1 ring-indigo-200'
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="font-medium text-gray-800">{t.label}</span>
                        <span className="block text-[10px] text-gray-400 mt-0.5 truncate">{t.subject}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Subject</label>
                  <input value={bulkSubject} onChange={(e) => { setBulkSubject(e.target.value); setBulkSubjectRaw(e.target.value); }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>

                {/* Body */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-600">Body</label>
                    <span className="text-[10px] text-gray-400">{"{name}"} {"{company}"} {"{role}"} {"{sender}"} {"{skills}"} {"{field}"} {"{years}"} {"{location}"} {"{sender_email}"} {"{sender_phone}"} {"{sender_linkedin}"} {"{sender_portfolio}"}</span>
                  </div>
                  <textarea value={bulkBody} onChange={(e) => { setBulkBody(e.target.value); setBulkBodyRaw(e.target.value); }} rows={6}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none font-mono" />
                </div>

                {/* Resume attachment (session-scoped) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-600">Attach Resume (optional)</label>
                    <span className="text-[10px] text-gray-400">PDF / DOCX, max 5MB — stored per session</span>
                  </div>
                  {sessionResumeName ? (
                    <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-800">{sessionResumeName}</span>
                      </div>
                      <button onClick={clearSessionResume} className="text-xs text-red-600 hover:text-red-800 underline">
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => bulkResumeInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl px-4 py-4 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 cursor-pointer transition-colors"
                    >
                      <Upload className="w-4 h-4" /> Click to upload resume
                    </div>
                  )}
                  <input
                    ref={bulkResumeInputRef}
                    type="file" accept=".pdf,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleBulkResumeUpload(f);
                      e.target.value = "";
                    }}
                  />
                </div>

                {/* Preview */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">Preview</span>
                    <span className="text-[10px] text-gray-400">Shown with first recipient's details</span>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-100 p-3 text-sm text-gray-700 whitespace-pre-wrap break-words max-h-32 overflow-y-auto leading-relaxed">
                    {bulkBody}
                  </div>
                </div>

                {/* Error / Success */}
                {bulkError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4" /> {bulkError}
                  </div>
                )}
                {bulkSuccess && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
                    <CheckCircle className="w-4 h-4" /> All {bulkProgress.sent} emails sent successfully!
                  </div>
                )}

                {/* Progress */}
                {bulkSending && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" /> Sending...
                      </span>
                      <span className="font-medium text-indigo-700">{bulkProgress.sent} / {bulkProgress.total}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${bulkProgress.total > 0 ? (bulkProgress.sent / bulkProgress.total) * 100 : 0}%` }}
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
                      />
                    </div>
                  </div>
                )}

                {/* Live results log */}
                {bulkResults.length > 0 && (bulkSending || bulkSuccess || bulkResults.some(r => r.status === "failed")) && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
                      {bulkResults.map(r => (
                        <div key={r.email} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                          {r.status === "pending" && <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />}
                          {r.status === "sending" && <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />}
                          {r.status === "sent" && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                          {r.status === "failed" && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                          <span className="text-gray-700 truncate flex-1">{r.name} — {r.email}</span>
                          {r.status === "failed" && r.error && <span className="text-red-500 truncate max-w-[140px]" title={r.error}>{r.error}</span>}
                          {r.status === "sent" && <span className="text-emerald-600 font-medium">Sent</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cost */}
                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm">
                  <span className="text-gray-600">Cost: <span className="font-semibold text-indigo-600">{selectedIds.size} Hires</span></span>
                  <span className="text-gray-500">Balance: <span className={`font-semibold ${hireBalance !== null && hireBalance >= selectedIds.size ? 'text-emerald-600' : 'text-red-500'}`}>{hireBalance !== null ? hireBalance : '...'}</span> Hires</span>
                </div>
                {hireBalance !== null && hireBalance < selectedIds.size && (
                  <a href="/dashboard/billing" className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                    <Zap className="w-3 h-3" /> Insufficient Hires. Top up your wallet.
                  </a>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={bulkSendAll} disabled={bulkSending || bulkSuccess || !bulkSubject || !bulkBody || (hireBalance !== null && hireBalance < selectedIds.size)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl shadow-sm hover:from-indigo-600 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all">
                    {bulkSending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sending...</> : bulkSuccess ? <><CheckCircle className="w-4 h-4" /> Sent</> : <><Send className="w-4 h-4" /> Send to {selectedIds.size} contacts</>}
                  </button>
                  <button onClick={() => {
                    const testTo = prompt("Send test email to:", senderEmail || "your@email.com");
                    if (testTo && bulkSubject && bulkBody) {
                      setBulkSending(true);
                      setBulkError("");
                      setBulkSuccess(false);
                      fetch("/api/user/hr-outreach", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ to: testTo, name: "Test", company: "", subject: bulkSubject, body: bulkBody, test: "true" }),
                      }).then(r => r.json()).then(d => {
                        if (d.success) { setBulkSuccess(true); setBulkError(""); }
                        else setBulkError(d.error || "Test failed");
                      }).catch(e => setBulkError(e.message)).finally(() => setBulkSending(false));
                    }
                  }} disabled={bulkSending || !bulkSubject || !bulkBody}
                    className="flex items-center gap-1.5 px-4 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 text-sm">
                    <Mail className="w-4 h-4" /> Test (free)
                  </button>
                  <button onClick={() => { setShowBulkCompose(false); clearSelection(); setBulkResults([]); }}
                    disabled={bulkSending}
                    className="px-5 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40">
                    {bulkSuccess ? "Close" : "Cancel"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
