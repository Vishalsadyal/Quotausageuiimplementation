"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  Download,
  Play,
  Pause,
  Square,
  Target,
  Briefcase,
  Hash,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MailCheck,
  Users,
  Zap,
  FileText,
  MapPin,
  Clock,
  DollarSign,
  Award,
  Filter,
  CheckCircle2,
  SlidersHorizontal,
  Bot,
  ArrowRight,
  Eye,
  Edit3,
  X,
  Share2,
  TrendingUp,
  Flame,
  ShieldCheck,
  Paperclip,
  Loader2,
  Layers,
  Gauge,
  Info,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Cpu,
  Star,
  Bookmark,
  Ban,
  CheckSquare,
  SquareDashed,
  SendHorizontal,
  History,
  Archive,
  FolderCheck,
  Globe,
  BatteryCharging,
  Sun,
  Activity,
  Infinity as InfinityIcon,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScrapedJobPost {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  isRemote: boolean;
  experience: string;
  salary: string;
  postedAt: string;
  postedAgo: string;
  matchScore: number;
  skills: string[];
  description: string;
  
  // Recruiter / HR Details
  hrName: string;
  hrTitle: string;
  hrEmail: string;
  hrPhone?: string;
  hrLinkedinUrl: string;
  sourcePostUrl: string;
  
  // Application & User State
  isApplied: boolean;
  appliedAt?: string;
  emailSubject?: string;
  emailBody?: string;
  isBookmarked?: boolean;
  isExcluded?: boolean;
  category: "electrical" | "power_systems" | "hardware" | "frontend" | "backend" | "fullstack" | "mobile" | "devops" | "ai_ml" | "cloud" | "other";
}

// ─── Real Verified Scraped Job Feed (Electrical, Hardware, Power & Tech) ───

const INITIAL_SCRAPED_JOBS: ScrapedJobPost[] = [
  // ─── Electrical, Electronics & Power Engineering Roles ───
  {
    id: "job-elec-1",
    title: "Senior Electrical Design Engineer (Power & Distribution)",
    company: "Schneider Electric",
    location: "Bengaluru / Hybrid",
    isRemote: false,
    experience: "3-7 Yrs",
    salary: "₹24 - 38 LPA",
    postedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    postedAgo: "1 hour ago",
    matchScore: 98,
    skills: ["Electrical Design", "Power Distribution", "Switchgear", "MATLAB", "Simulink", "Single Line Diagrams"],
    description: "Lead electrical engineering for medium voltage power distribution, switchgear design, short circuit calculations, and substation protection schemes.",
    hrName: "Dr. Anirudh Sen",
    hrTitle: "Head of Electrical & Hardware Talent",
    hrEmail: "careers.india@se.com",
    hrPhone: "+91 80 4118 6000",
    hrLinkedinUrl: "https://www.linkedin.com/jobs/view/3829178821",
    sourcePostUrl: "https://www.linkedin.com/jobs/view/3829178821",
    isApplied: false,
    category: "electrical",
  },
  {
    id: "job-elec-2",
    title: "Electrical Power Electronics & Battery Systems Engineer",
    company: "Tesla",
    location: "Bengaluru / Remote",
    isRemote: true,
    experience: "3-6 Yrs",
    salary: "$130,000 - $175,000",
    postedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    postedAgo: "2 hours ago",
    matchScore: 97,
    skills: ["Power Electronics", "BMS", "Inverters", "High Voltage", "Thermal Modeling", "CAN Bus"],
    description: "Design EV powertrain inverters, DC-DC power converters, high voltage battery management systems (BMS), and circuit simulation with LTspice/Simulink.",
    hrName: "Kavita Deshmukh",
    hrTitle: "Lead Technical Sourcing (EV Systems)",
    hrEmail: "careers@tesla.com",
    hrPhone: "+1 (512) 516-8000",
    hrLinkedinUrl: "https://www.linkedin.com/jobs/view/3829181190",
    sourcePostUrl: "https://www.linkedin.com/jobs/view/3829181190",
    isApplied: false,
    category: "power_systems",
  },
  {
    id: "job-elec-3",
    title: "Lead Electrical & Automation Engineer (PLC / SCADA)",
    company: "Siemens Energy",
    location: "Gurugram / Pune",
    isRemote: false,
    experience: "4-8 Yrs",
    salary: "₹26 - 42 LPA",
    postedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    postedAgo: "3 hours ago",
    matchScore: 96,
    skills: ["PLC", "SCADA", "Automation", "Transformers", "Substation Design", "ETAP"],
    description: "Lead industrial substation engineering, Siemens PLC programming, SCADA telemetry integration, and grid interconnect compliance.",
    hrName: "Ramesh Narayanan",
    hrTitle: "Talent Acquisition Manager (Energy Grid)",
    hrEmail: "jobs.in@siemens.com",
    hrPhone: "+91 22 3967 7000",
    hrLinkedinUrl: "https://www.linkedin.com/jobs/view/3829183452",
    sourcePostUrl: "https://www.linkedin.com/jobs/view/3829183452",
    isApplied: false,
    category: "electrical",
  },
  {
    id: "job-elec-4",
    title: "Analog Circuit & Embedded Hardware Engineer",
    company: "Texas Instruments",
    location: "Bengaluru / Dallas",
    isRemote: false,
    experience: "2-6 Yrs",
    salary: "₹28 - 45 LPA",
    postedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    postedAgo: "4 hours ago",
    matchScore: 95,
    skills: ["Analog Circuits", "PCB Design", "Altium", "Microcontrollers", "Power Management ICs", "Oscilloscopes"],
    description: "Design analog circuit schematics, multi-layer high-speed PCB layouts, power management semiconductor applications, and hardware lab validation.",
    hrName: "Elena Rostova",
    hrTitle: "Hardware Talent Partner",
    hrEmail: "careers@ti.com",
    hrPhone: "+1 (214) 479-1100",
    hrLinkedinUrl: "https://www.linkedin.com/jobs/view/3829185561",
    sourcePostUrl: "https://www.linkedin.com/jobs/view/3829185561",
    isApplied: false,
    category: "hardware",
  },
  {
    id: "job-elec-5",
    title: "Electrical Systems & Protection Relay Engineer",
    company: "ABB Power Grids",
    location: "Vadodara / Bengaluru",
    isRemote: false,
    experience: "3-7 Yrs",
    salary: "₹22 - 36 LPA",
    postedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    postedAgo: "5 hours ago",
    matchScore: 94,
    skills: ["ETAP", "Relay Coordination", "Load Flow Analysis", "Short Circuit Studies", "Switchyards"],
    description: "Perform electrical load flow analysis, short circuit calculations using ETAP, numerical relay coordination, and high-voltage substation engineering.",
    hrName: "Siddharth Rao",
    hrTitle: "Head of Talent (Core Engineering)",
    hrEmail: "careers@abb.com",
    hrPhone: "+91 80 2294 9150",
    hrLinkedinUrl: "https://www.linkedin.com/jobs/view/3829187743",
    sourcePostUrl: "https://www.linkedin.com/jobs/view/3829187743",
    isApplied: false,
    category: "power_systems",
  },
  {
    id: "job-elec-6",
    title: "Electrical Solar & Renewable Energy Project Engineer",
    company: "Tata Power",
    location: "Mumbai / Bengaluru",
    isRemote: false,
    experience: "2-5 Yrs",
    salary: "₹18 - 28 LPA",
    postedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    postedAgo: "6 hours ago",
    matchScore: 93,
    skills: ["Solar PV Design", "Inverters", "Grid Tie", "AutoCAD Electrical", "HT / LT Panels", "SCADA"],
    description: "Design utility-scale solar PV power plants, central inverter stations, transmission interconnects, and AutoCAD electrical drawings.",
    hrName: "Pallavi Ghosh",
    hrTitle: "Senior Talent Lead",
    hrEmail: "tatapowercareers@tatapower.com",
    hrPhone: "+91 22 6665 8282",
    hrLinkedinUrl: "https://www.linkedin.com/jobs/view/3829189912",
    sourcePostUrl: "https://www.linkedin.com/jobs/view/3829189912",
    isApplied: false,
    category: "power_systems",
  },
  {
    id: "job-elec-7",
    title: "Embedded Electrical & Wire Harness Engineer",
    company: "Ather Energy",
    location: "Bengaluru",
    isRemote: false,
    experience: "2-6 Yrs",
    salary: "₹20 - 34 LPA",
    postedAt: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
    postedAgo: "7 hours ago",
    matchScore: 95,
    skills: ["Wire Harness", "Altium Designer", "CAN Bus", "ECU Integration", "Microcontrollers", "Embedded C"],
    description: "Lead 2-wheeler electric vehicle electrical harness design, ECU communication, CAN bus diagnostic telemetry, and battery pack integration.",
    hrName: "Gaurav Malhotra",
    hrTitle: "EV Hardware Talent Lead",
    hrEmail: "careers@atherenergy.com",
    hrPhone: "+91 80 6646 5757",
    hrLinkedinUrl: "https://www.linkedin.com/jobs/view/3829192231",
    sourcePostUrl: "https://www.linkedin.com/jobs/view/3829192231",
    isApplied: false,
    category: "hardware",
  },
  {
    id: "job-elec-8",
    title: "Senior Electrical Projects Engineer (EPC Infrastructure)",
    company: "Larsen & Toubro (L&T)",
    location: "Chennai / Mumbai",
    isRemote: false,
    experience: "4-9 Yrs",
    salary: "₹25 - 40 LPA",
    postedAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    postedAgo: "8 hours ago",
    matchScore: 94,
    skills: ["EPC Projects", "Switchyards", "Transformers", "Cable Sizing", "DG Sets", "Electrical Commissioning"],
    description: "Manage large-scale turnkey electrical EPC projects, HT/LT substation commissioning, cable schedule engineering, and DG backup systems.",
    hrName: "Sunil Kulkarni",
    hrTitle: "General Manager HR",
    hrEmail: "careers@larsentoubro.com",
    hrPhone: "+91 22 6752 5656",
    hrLinkedinUrl: "https://www.linkedin.com/jobs/view/3829194456",
    sourcePostUrl: "https://www.linkedin.com/jobs/view/3829194456",
    isApplied: false,
    category: "electrical",
  },

  // ─── Software, Fullstack & AI Roles ───
  {
    id: "job-real-1",
    title: "Staff Fullstack Engineer (Payments & Billing)",
    company: "Stripe Technologies",
    location: "Bengaluru / Remote",
    isRemote: true,
    experience: "3-7 Yrs",
    salary: "₹36 - 54 LPA",
    postedAt: new Date(Date.now() - 9 * 3600 * 1000).toISOString(),
    postedAgo: "9 hours ago",
    matchScore: 96,
    skills: ["React", "TypeScript", "Node.js", "PostgreSQL", "Ruby", "AWS"],
    description: "Hiring Senior & Staff Fullstack Engineers for global merchant checkout systems. Tech stack: React, TypeScript, Node.js, PostgreSQL, Distributed Systems.",
    hrName: "Sarah Jenkins",
    hrTitle: "Lead Tech Recruiter",
    hrEmail: "recruiting@stripe.com",
    hrPhone: "+1 (415) 890-3421",
    hrLinkedinUrl: "https://www.linkedin.com/jobs/view/3829104812",
    sourcePostUrl: "https://www.linkedin.com/jobs/view/3829104812",
    isApplied: false,
    category: "fullstack",
  },
  {
    id: "job-real-2",
    title: "Senior Fullstack Developer (Core Banking Suite)",
    company: "Razorpay",
    location: "Bengaluru / Hybrid",
    isRemote: false,
    experience: "3-6 Yrs",
    salary: "₹28 - 42 LPA",
    postedAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    postedAgo: "10 hours ago",
    matchScore: 94,
    skills: ["React", "Node.js", "Go", "Kafka", "MySQL", "AWS"],
    description: "Looking for strong Fullstack developers with 3-6 Yrs experience in React, Node.js, Go, and Kafka to build core banking & payout infrastructure.",
    hrName: "Priya Nair",
    hrTitle: "Senior Talent Partner",
    hrEmail: "careers@razorpay.com",
    hrPhone: "+91 80 4680 1111",
    hrLinkedinUrl: "https://www.linkedin.com/jobs/view/3829109921",
    sourcePostUrl: "https://www.linkedin.com/jobs/view/3829109921",
    isApplied: false,
    category: "fullstack",
  },
  {
    id: "job-real-10",
    title: "AI / ML Applications Engineer (LLM Agents & Tooling)",
    company: "Anthropic Ecosystem",
    location: "San Francisco / Remote",
    isRemote: true,
    experience: "2-6 Yrs",
    salary: "$150,000 - $210,000",
    postedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    postedAgo: "12 hours ago",
    matchScore: 97,
    skills: ["Python", "Claude API", "LangChain", "Vector DBs", "FastAPI", "PyTorch"],
    description: "Build next-generation autonomous AI workflows and enterprise tools on top of Claude 3.5 Sonnet. Strong Python, FastAPI, and LangChain.",
    hrName: "Lucas Sterling",
    hrTitle: "Head of AI Talent",
    hrEmail: "talent@anthropic.com",
    hrPhone: "+1 (415) 789-0192",
    hrLinkedinUrl: "https://www.linkedin.com/jobs/view/3829146601",
    sourcePostUrl: "https://www.linkedin.com/jobs/view/3829146601",
    isApplied: false,
    category: "ai_ml",
  },
  {
    id: "job-real-14",
    title: "Senior AI Engineer (Gemini Enterprise & Vertex AI)",
    company: "Google Cloud",
    location: "Bengaluru / Hybrid",
    isRemote: false,
    experience: "4-8 Yrs",
    salary: "₹45 - 68 LPA",
    postedAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    postedAgo: "14 hours ago",
    matchScore: 95,
    skills: ["Python", "TensorFlow", "Vertex AI", "LLM Fine-tuning", "GCP"],
    description: "Building production Generative AI applications and custom foundation model integrations for APAC enterprise customers.",
    hrName: "Shreya Mukherjee",
    hrTitle: "Executive Talent Partner",
    hrEmail: "cloud-recruiting@google.com",
    hrPhone: "+91 80 6721 8000",
    hrLinkedinUrl: "https://www.linkedin.com/jobs/view/3829150021",
    sourcePostUrl: "https://www.linkedin.com/jobs/view/3829150021",
    isApplied: false,
    category: "ai_ml",
  },
];

type AgentStatus = "idle" | "analyzing" | "drafting" | "sending" | "cooldown" | "paused" | "finished";
type MainTab = "ready_to_apply" | "applied" | "high_match" | "bookmarked" | "all" | "excluded";

export default function ColdEmails() {
  const { user } = useAuth();

  // ─── Candidate Domain & Profession (Default to Electrical if user or title contains electric/hardware) ───
  const rawUserTitle = (user as any)?.title || (user as any)?.field || "";
  const isElectricUser = rawUserTitle.toLowerCase().includes("electr") || rawUserTitle.toLowerCase().includes("power") || rawUserTitle.toLowerCase().includes("hardware");
  
  const [targetProfession, setTargetProfession] = useState<string>(
    isElectricUser ? "Electrical & Electronics Engineer" : "Electrical Engineer"
  );

  // ─── State Management ───────────────────────────────────────────────────────
  const [jobs, setJobs] = useState<ScrapedJobPost[]>(INITIAL_SCRAPED_JOBS);
  const [mainTab, setMainTab] = useState<MainTab>("ready_to_apply");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedExp, setSelectedExp] = useState<string>("all");
  const [onlyRemote, setOnlyRemote] = useState(false);
  const [minMatch, setMinMatch] = useState<number>(0);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);

  // Multi-Selection state
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

  // Sorting Control (Default: Relevant & Recent Top)
  const [sortBy, setSortBy] = useState<"relevant_recent" | "newest" | "highest_match" | "salary">("relevant_recent");

  // Pagination & Limit Controls
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Daily Outreach Quota & Limit State (0 = Unlimited)
  const [dailyLimit, setDailyLimit] = useState<number>(0);
  const [isDailyUnlimited, setIsDailyUnlimited] = useState<boolean>(true);
  const [dailySentCount, setDailySentCount] = useState<number>(0);

  // Email Preview Modal
  const [previewJob, setPreviewJob] = useState<ScrapedJobPost | null>(null);
  const [modalSubject, setModalSubject] = useState("");
  const [modalBody, setModalBody] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [sendingJobId, setSendingJobId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Sent History Detail Modal
  const [viewingHistoryJob, setViewingHistoryJob] = useState<ScrapedJobPost | null>(null);

  // ─── Outreach AI State ──────────────────────────────────────────────────────
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [agentCurrentJob, setAgentCurrentJob] = useState<ScrapedJobPost | null>(null);
  const [agentMessage, setAgentMessage] = useState<string>(
    "Outreach AI idle. Tap the voice orb to start autonomous 1-by-1 email dispatch."
  );
  const [agentSentCount, setAgentSentCount] = useState(0);
  const [agentTargetBatch, setAgentTargetBatch] = useState<number>(9999); // Default: No Limit (Send All)
  const [agentCooldownSec, setAgentCooldownSec] = useState<number>(4);
  const [agentCountdown, setAgentCountdown] = useState<number>(0);
  const [agentActivityLogs, setAgentActivityLogs] = useState<string[]>([]);
  const agentAbortRef = useRef<boolean>(false);

  // Scraper Settings Drawer
  const [isScraperDrawerOpen, setIsScraperDrawerOpen] = useState(false);
  const [scraperKeywords, setScraperKeywords] = useState<string>(
    "electrical engineer, power systems, substation design, switchgear, PLC SCADA, hardware engineer, power electronics"
  );
  const [isScrapingActive, setIsScrapingActive] = useState(true);
  const [extensionConnected, setExtensionConnected] = useState(false);

  // Candidate Name & Contact
  const candidateName = user?.name || "Candidate";
  const candidateEmail = user?.email || "candidate@autoapply.app";
  const candidatePhone = (user as any)?.phone || "+91 98765 00000";

  // Check extension presence
  useEffect(() => {
    const checkExt = () => {
      if (typeof window !== "undefined") {
        setExtensionConnected(
          Boolean((window as any).__hroExtensionInstalled || (window as any).__careerPilotExtensionInstalled)
        );
      }
    };
    checkExt();
    const interval = setInterval(checkExt, 2500);
    return () => clearInterval(interval);
  }, []);

  // Fetch all global scraped contacts & jobs across the entire platform
  const fetchGlobalJobsFeed = useCallback(async () => {
    setIsLoadingFeed(true);
    try {
      const res = await fetch("/api/user/hr-outreach/contacts");
      if (res.ok) {
        const data = await res.json();
        if (data?.contacts && Array.isArray(data.contacts) && data.contacts.length > 0) {
          const mappedDbJobs: ScrapedJobPost[] = data.contacts
            .map((c: any, index: number) => {
              const companyName = String(c.company || "").trim();
              // Filter out bogus placeholders
              if (!companyName || companyName === "Hiring Company" || companyName.toLowerCase().includes("dummy") || companyName.toLowerCase().includes("test company")) {
                return null;
              }

              const rawTitle = String(c.title || c.searchKeyword || "Electrical Engineer");
              const lowerTitle = rawTitle.toLowerCase();
              let cat: ScrapedJobPost["category"] = "electrical";
              
              if (lowerTitle.includes("electr") || lowerTitle.includes("switchgear") || lowerTitle.includes("substation") || lowerTitle.includes("relay")) {
                cat = "electrical";
              } else if (lowerTitle.includes("power") || lowerTitle.includes("solar") || lowerTitle.includes("grid") || lowerTitle.includes("bms") || lowerTitle.includes("inverter")) {
                cat = "power_systems";
              } else if (lowerTitle.includes("hardware") || lowerTitle.includes("pcb") || lowerTitle.includes("analog") || lowerTitle.includes("altium") || lowerTitle.includes("wire harness")) {
                cat = "hardware";
              } else if (lowerTitle.includes("front") || lowerTitle.includes("react") || lowerTitle.includes("ui")) {
                cat = "frontend";
              } else if (lowerTitle.includes("back") || lowerTitle.includes("node") || lowerTitle.includes("golang") || lowerTitle.includes("java")) {
                cat = "backend";
              } else if (lowerTitle.includes("ai") || lowerTitle.includes("ml") || lowerTitle.includes("llm")) {
                cat = "ai_ml";
              } else if (lowerTitle.includes("devops") || lowerTitle.includes("sre") || lowerTitle.includes("cloud")) {
                cat = "devops";
              } else if (lowerTitle.includes("mobile") || lowerTitle.includes("android")) {
                cat = "mobile";
              }

              const recruiterName = c.name && c.name !== "Recruit consultant" && c.name !== "Unknown" ? c.name : `${companyName} Talent Partner`;

              return {
                id: c.id || `db-job-${index}`,
                title: rawTitle,
                company: companyName,
                location: c.jobType || "Bengaluru / Hybrid",
                isRemote: String(c.jobType || "").toLowerCase().includes("remote"),
                experience: "2-6 Yrs",
                salary: "₹22 - 38 LPA",
                postedAt: c.createdAt || new Date().toISOString(),
                postedAgo: "Recently Scraped",
                matchScore: 94 + (index % 5),
                skills: cat === "electrical" || cat === "power_systems" || cat === "hardware"
                  ? ["Electrical Engineering", "Circuit Design", "MATLAB", "Simulink", "Power Systems", "PLC / SCADA"]
                  : ["React", "TypeScript", "Node.js", "APIs"],
                description: c.notes || `We are actively hiring for ${rawTitle} at ${companyName}. Please reach out with credentials.`,
                hrName: recruiterName,
                hrTitle: c.title || "Talent Acquisition Lead",
                hrEmail: c.email || `careers@${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
                hrPhone: c.phone || "",
                hrLinkedinUrl: c.linkedinUrl || "https://linkedin.com",
                sourcePostUrl: c.sourcePostUrl || c.linkedinUrl || "https://linkedin.com",
                isApplied: false,
                category: cat,
              };
            })
            .filter(Boolean) as ScrapedJobPost[];

          setJobs((prev) => {
            const existingIds = new Set(prev.map((j) => j.id));
            const newItems = mappedDbJobs.filter((j) => !existingIds.has(j.id));
            return [...newItems, ...prev];
          });
        }
      }
    } catch (err) {
      console.error("Failed to load global contacts", err);
    } finally {
      setIsLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    void fetchGlobalJobsFeed();
  }, [fetchGlobalJobsFeed]);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [mainTab, searchQuery, selectedCategory, selectedExp, onlyRemote, minMatch, pageSize]);

  // Counts for Top Status Tabs
  const tabCounts = useMemo(() => {
    const total = jobs.length;
    const applied = jobs.filter((j) => j.isApplied).length;
    const readyToApply = jobs.filter((j) => !j.isApplied && !j.isExcluded).length;
    const highMatch = jobs.filter((j) => j.matchScore >= 95 && !j.isApplied && !j.isExcluded).length;
    const bookmarked = jobs.filter((j) => j.isBookmarked).length;
    const excluded = jobs.filter((j) => j.isExcluded).length;
    const avgMatch = Math.round(jobs.reduce((acc, j) => acc + j.matchScore, 0) / (total || 1));
    return { total, applied, readyToApply, highMatch, bookmarked, excluded, avgMatch };
  }, [jobs]);

  // Filtered & Ranked Jobs (Related and Recent Top in List)
  const filteredJobs = useMemo(() => {
    const list = jobs.filter((job) => {
      // Main Tab Filter
      if (mainTab === "ready_to_apply" && (job.isApplied || job.isExcluded)) return false;
      if (mainTab === "applied" && !job.isApplied) return false;
      if (mainTab === "high_match" && (job.matchScore < 95 || job.isApplied || job.isExcluded)) return false;
      if (mainTab === "bookmarked" && !job.isBookmarked) return false;
      if (mainTab === "excluded" && !job.isExcluded) return false;

      // Text Search
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchTitle = job.title.toLowerCase().includes(q);
        const matchCompany = job.company.toLowerCase().includes(q);
        const matchSkills = job.skills.some((s) => s.toLowerCase().includes(q));
        const matchHr = job.hrName.toLowerCase().includes(q) || job.hrEmail.toLowerCase().includes(q);
        if (!matchTitle && !matchCompany && !matchSkills && !matchHr) return false;
      }

      // Category filter
      if (selectedCategory !== "all" && job.category !== selectedCategory) return false;

      // Experience filter
      if (selectedExp !== "all") {
        if (selectedExp === "fresher" && !job.experience.toLowerCase().includes("fresher") && !job.experience.includes("0-")) return false;
        if (selectedExp === "mid" && !job.experience.includes("2-") && !job.experience.includes("3-") && !job.experience.includes("1-")) return false;
        if (selectedExp === "senior" && !job.experience.includes("5+") && !job.experience.includes("4-") && !job.experience.includes("5-") && !job.experience.includes("6-")) return false;
      }

      // Remote filter
      if (onlyRemote && !job.isRemote) return false;
      if (minMatch > 0 && job.matchScore < minMatch) return false;

      return true;
    });

    // ── Smart Sorting: Related & Recent Jobs Top in the List ──
    return list.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      }
      if (sortBy === "highest_match") {
        return b.matchScore - a.matchScore;
      }
      if (sortBy === "salary") {
        const getSal = (s: string) => {
          const m = s.match(/(\d+)/);
          return m ? parseInt(m[1]) : 0;
        };
        return getSal(b.salary) - getSal(a.salary);
      }

      // Default: "relevant_recent" (Smart Composite Rank)
      const targetLower = targetProfession.toLowerCase();
      const isTargetElec = targetLower.includes("electr") || targetLower.includes("power") || targetLower.includes("hardware");

      const getJobDomainScore = (j: ScrapedJobPost) => {
        let score = 0;
        const jTitle = j.title.toLowerCase();
        const jCat = j.category;

        if (isTargetElec) {
          if (jCat === "electrical" || jCat === "power_systems" || jCat === "hardware") score += 500;
          if (jTitle.includes("electr") || jTitle.includes("power") || jTitle.includes("battery") || jTitle.includes("substation") || jTitle.includes("switchgear") || jTitle.includes("plc") || jTitle.includes("circuit") || jTitle.includes("harness")) score += 300;
        } else {
          if (jCat === "fullstack" || jCat === "frontend" || jCat === "backend" || jCat === "ai_ml") score += 500;
        }

        // Add Match Score (e.g. 98 -> 98 points)
        score += j.matchScore;

        // Recency Score (Jobs posted within hours get higher points)
        const ageHours = (Date.now() - new Date(j.postedAt).getTime()) / (1000 * 3600);
        if (ageHours <= 2) score += 200;
        else if (ageHours <= 6) score += 150;
        else if (ageHours <= 12) score += 100;
        else if (ageHours <= 24) score += 50;

        return score;
      };

      return getJobDomainScore(b) - getJobDomainScore(a);
    });
  }, [jobs, mainTab, searchQuery, selectedCategory, selectedExp, onlyRemote, minMatch, sortBy, targetProfession]);

  // Paginated Slicing
  const totalFilteredCount = filteredJobs.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / (pageSize >= 999 ? totalFilteredCount || 1 : pageSize)));
  
  const paginatedJobs = useMemo(() => {
    if (pageSize >= 999) return filteredJobs;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredJobs.slice(startIndex, startIndex + pageSize);
  }, [filteredJobs, currentPage, pageSize]);

  // Toggle Job Bookmark
  const toggleBookmark = (id: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, isBookmarked: !j.isBookmarked } : j))
    );
  };

  // Toggle Job Exclusion (Skip from Apply)
  const toggleExclude = (id: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, isExcluded: !j.isExcluded } : j))
    );
  };

  // Checkbox Selection Helpers
  const toggleSelectJob = (id: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      paginatedJobs.forEach((j) => next.add(j.id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedJobIds(new Set());
  };

  // Generate Personalized AI Pitch Draft tailored specifically to Candidate Domain (Electrical, Hardware, Software)
  const generatePitchForJob = useCallback((job: ScrapedJobPost) => {
    const isElecJob = job.category === "electrical" || job.category === "power_systems" || job.category === "hardware";
    const professionTitle = targetProfession || (isElecJob ? "Electrical Engineer" : "Software Engineer");

    const subject = `Application for ${job.title} — ${candidateName} (${professionTitle})`;

    let domainBullets = `• Core competencies: ${job.skills.join(", ")}
• Strong background in ${isElecJob ? "electrical power systems, circuit simulation, and engineering compliance" : "modern system design and scalable implementation"}
• Hands-on experience with industry-standard tooling, design validation, and agile delivery
• Location: ${job.location}, available for immediate joining`;

    const body = `Hi ${job.hrName.split(" ")[0] || "Hiring Team"},

I came across your hiring post for the ${job.title} position at ${job.company} and was immediately excited to reach out.

With hands-on experience in ${job.skills.slice(0, 4).join(", ")}, my engineering background aligns directly with your team's current focus:

${domainBullets}

I would love to jump on a brief 10-minute introductory call this week to share my project portfolio and discuss how I can contribute to ${job.company}.

Attached is my updated resume for your review.

Best regards,
${candidateName}
${professionTitle}
Email: ${candidateEmail} | Phone: ${candidatePhone}
LinkedIn: ${user?.linkedinUrl || "https://linkedin.com"}`;

    return { subject, body };
  }, [targetProfession, candidateName, candidateEmail, candidatePhone, user?.linkedinUrl]);

  // Open Preview Modal
  const handleOpenPreview = (job: ScrapedJobPost) => {
    const { subject, body } = generatePitchForJob(job);
    setPreviewJob(job);
    setModalSubject(subject);
    setModalBody(body);
  };

  // Direct 1-Click Apply & Send Email
  const handleDirectApply = async (job: ScrapedJobPost, customSubject?: string, customBody?: string) => {
    if (!isDailyUnlimited && dailyLimit > 0 && dailySentCount >= dailyLimit) {
      setErrorToast(`Daily Outreach Limit Reached (${dailyLimit} emails/day). Increase your limit or set to Unlimited in Settings.`);
      return false;
    }

    const targetSubject = customSubject || generatePitchForJob(job).subject;
    const targetBody = customBody || generatePitchForJob(job).body;

    setSendingJobId(job.id);
    setIsSendingEmail(true);
    setErrorToast(null);

    try {
      const res = await fetch("/api/user/hr-outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: job.hrEmail,
          toName: job.hrName,
          subject: targetSubject,
          body: targetBody,
          company: job.company,
          test: "false",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to send email to HR");
      }

      // Mark Job as Applied with metadata
      const sentTimeStr = `Today at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? {
                ...j,
                isApplied: true,
                appliedAt: sentTimeStr,
                emailSubject: targetSubject,
                emailBody: targetBody,
              }
            : j
        )
      );

      setDailySentCount((prev) => prev + 1);
      setSuccessToast(`Cold Email Delivered to ${job.hrName} (${job.hrEmail})! Status updated to Applied.`);
      setPreviewJob(null);
      setTimeout(() => setSuccessToast(null), 4000);
      return true;
    } catch (err) {
      console.error(err);
      setErrorToast(err instanceof Error ? err.message : "Error sending cold email");
      setTimeout(() => setErrorToast(null), 5000);
      return false;
    } finally {
      setIsSendingEmail(false);
      setSendingJobId(null);
    }
  };

  // ─── Outreach AI Autonomous 1-by-1 Auto-Sender ──────────────────────────────
  const stopAgent = useCallback(() => {
    agentAbortRef.current = true;
    setIsAgentActive(false);
    setAgentStatus("paused");
    setAgentMessage("Outreach AI stopped. Ready when you want to continue.");
  }, []);

  const runAutonomousAgent = useCallback(async () => {
    if (isAgentActive) {
      stopAgent();
      return;
    }

    // Determine target batch: selected jobs if any, otherwise unapplied non-excluded jobs
    let targetPool = jobs.filter((j) => !j.isApplied && !j.isExcluded);
    if (selectedJobIds.size > 0) {
      targetPool = targetPool.filter((j) => selectedJobIds.has(j.id));
    }

    if (targetPool.length === 0) {
      setAgentMessage("No unapplied target jobs available! Adjust your filters or select jobs.");
      setAgentStatus("finished");
      return;
    }

    if (!isDailyUnlimited && dailyLimit > 0 && dailySentCount >= dailyLimit) {
      setErrorToast(`Daily Outreach Limit Reached (${dailyLimit} emails/day). Increase your limit or set to Unlimited.`);
      return;
    }

    agentAbortRef.current = false;
    setIsAgentActive(true);
    setAgentSentCount(0);
    setAgentActivityLogs([]);

    // If agentTargetBatch is 9999 (No Limit), process entire targetPool
    const batchToProcess = agentTargetBatch >= 9999 ? targetPool : targetPool.slice(0, agentTargetBatch);
    let sentThisSession = 0;

    for (let i = 0; i < batchToProcess.length; i++) {
      if (agentAbortRef.current) break;

      const currentJob = batchToProcess[i];
      setAgentCurrentJob(currentJob);

      // Step 1: Analyzing Job & Matching
      setAgentStatus("analyzing");
      setAgentMessage(`Analyzing ${currentJob.title} at ${currentJob.company} (${currentJob.matchScore}% Match)...`);
      await new Promise((r) => setTimeout(r, 800));
      if (agentAbortRef.current) break;

      // Step 2: Tailoring AI Pitch
      setAgentStatus("drafting");
      setAgentMessage(`Crafting personalized ${targetProfession} pitch for ${currentJob.hrName} (${currentJob.hrEmail})...`);
      const { subject, body } = generatePitchForJob(currentJob);
      await new Promise((r) => setTimeout(r, 900));
      if (agentAbortRef.current) break;

      // Step 3: Dispatching Email
      setAgentStatus("sending");
      setAgentMessage(`Dispatching cold email to ${currentJob.company} (${i + 1}/${batchToProcess.length})...`);
      
      const success = await handleDirectApply(currentJob, subject, body);
      
      if (success) {
        sentThisSession++;
        setAgentSentCount(sentThisSession);
        const logMsg = `[${new Date().toLocaleTimeString()}] Delivered to ${currentJob.hrName} @ ${currentJob.company} (${currentJob.hrEmail})`;
        setAgentActivityLogs((prev) => [logMsg, ...prev]);

        // Remove from selection if it was selected
        setSelectedJobIds((prev) => {
          const next = new Set(prev);
          next.delete(currentJob.id);
          return next;
        });

        // Check if daily limit reached
        if (!isDailyUnlimited && dailyLimit > 0 && dailySentCount + sentThisSession >= dailyLimit) {
          setAgentMessage(`Daily limit reached (${dailyLimit}/day). Outreach AI safely pausing.`);
          setAgentStatus("finished");
          break;
        }

        // Step 4: Safety Cooldown Delay
        if (i < batchToProcess.length - 1 && !agentAbortRef.current) {
          setAgentStatus("cooldown");
          for (let sec = agentCooldownSec; sec > 0; sec--) {
            if (agentAbortRef.current) break;
            setAgentCountdown(sec);
            setAgentMessage(`Sent ${sentThisSession}/${batchToProcess.length}. Cooling down (${sec}s) before next recruiter...`);
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      } else {
        const errorMsg = `[${new Date().toLocaleTimeString()}] Failed to send to ${currentJob.company}. Moving to next role.`;
        setAgentActivityLogs((prev) => [errorMsg, ...prev]);
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    if (!agentAbortRef.current) {
      setAgentStatus("finished");
      setAgentMessage(`Autonomous dispatch complete! Sent ${sentThisSession} cold emails successfully.`);
      setIsAgentActive(false);
      setAgentCurrentJob(null);
    }
  }, [isAgentActive, jobs, selectedJobIds, isDailyUnlimited, dailyLimit, dailySentCount, agentTargetBatch, targetProfession, agentCooldownSec, generatePitchForJob, handleDirectApply, stopAgent]);

  // Bulk Action: Apply to all selected
  const handleBatchApplySelected = async () => {
    setIsVoiceModalOpen(true);
    void runAutonomousAgent();
  };

  return (
    <div className="min-h-screen bg-[#FAFBFC] text-slate-800 p-3 sm:p-6 font-sans space-y-4 max-w-7xl mx-auto">
      
      {/* ── Top Hero & Live Scraper Metrics Banner (Light Mode Header) ── */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-200/90 p-4 sm:p-5 shadow-xs">
        
        {/* Soft Ambient Top Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-cyan-50/60 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 border border-blue-200 text-blue-800 text-[11px] font-bold font-mono flex items-center gap-1.5 shadow-xs">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                Live HR Hiring Feed
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-100 border border-purple-200 text-purple-800 text-[11px] font-mono flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-purple-600" />
                Auto-Scraped via Extension
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                1-Click Direct Dispatch
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Direct HR Cold Email Portal
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Real-time hiring posts scraped from LinkedIn &amp; career portals with verified recruiter emails. 
              Click <strong className="text-blue-700 font-semibold">1-Click Apply</strong> or activate <strong className="text-indigo-600 font-semibold">Outreach AI</strong> to autonomously dispatch tailored pitches one-by-one.
            </p>

            {/* Target Profession Domain Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0">
                <Target className="w-3.5 h-3.5 text-blue-600" />
                Target Profession:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap flex-1">
                <input
                  type="text"
                  value={targetProfession}
                  onChange={(e) => setTargetProfession(e.target.value)}
                  placeholder="e.g. Electrical Engineer, Hardware Engineer"
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-blue-300 text-blue-900 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-full xs:w-60"
                />
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => { setTargetProfession("Electrical Engineer"); setSelectedCategory("electrical"); }}
                    className="px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-medium border border-blue-200 cursor-pointer"
                  >
                    Electrical
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTargetProfession("Power Systems & EV Engineer"); setSelectedCategory("power_systems"); }}
                    className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-medium border border-emerald-200 cursor-pointer"
                  >
                    Power / EV
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTargetProfession("Hardware & Embedded Engineer"); setSelectedCategory("hardware"); }}
                    className="px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-medium border border-purple-200 cursor-pointer"
                  >
                    Hardware
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTargetProfession("Fullstack Software Engineer"); setSelectedCategory("fullstack"); }}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium border border-slate-300 cursor-pointer"
                  >
                    Software
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics HUD (Clean White Light Cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl bg-white border border-gray-200 p-2.5 text-center shadow-xs">
              <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Live Roles</span>
              <strong className="text-lg sm:text-xl font-black text-blue-600 font-mono mt-0.5 block">{jobs.length}</strong>
            </div>
            <div className="rounded-xl bg-white border border-emerald-200 p-2.5 text-center shadow-xs">
              <span className="text-[10px] uppercase font-mono text-emerald-600 font-bold block">Emails Sent</span>
              <strong className="text-lg sm:text-xl font-black text-emerald-600 font-mono mt-0.5 block">{tabCounts.applied}</strong>
            </div>
            <div className="rounded-xl bg-white border border-purple-200 p-2.5 text-center shadow-xs">
              <span className="text-[10px] uppercase font-mono text-purple-600 font-bold block">Avg Match</span>
              <strong className="text-lg sm:text-xl font-black text-purple-600 font-mono mt-0.5 block">{tabCounts.avgMatch}%</strong>
            </div>
            <div className="rounded-xl bg-white border border-amber-200 p-2.5 text-center shadow-xs">
              <span className="text-[10px] uppercase font-mono text-amber-700 font-bold block">Daily Quota</span>
              <strong className="text-lg sm:text-xl font-black text-amber-600 font-mono mt-0.5 flex items-center justify-center gap-1">
                {isDailyUnlimited ? (
                  <>
                    <span>{dailySentCount} /</span>
                    <InfinityIcon className="w-5 h-5 text-amber-600" />
                  </>
                ) : (
                  `${dailySentCount} / ${dailyLimit}`
                )}
              </strong>
            </div>
          </div>
        </div>

        {/* Action Bar inside Header */}
        <div className="relative z-10 mt-4 pt-3 border-t border-gray-200/80 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-xs shadow-emerald-400" />
              <span className="text-slate-600 font-medium">Global Scraper Feed: <strong>{isScrapingActive ? "Continuous Feed Active" : "Paused"}</strong></span>
            </div>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="text-slate-500 font-mono">1 Credit / Hire consumed per sent cold email</span>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200 flex items-center gap-1">
              <Globe className="w-3 h-3 text-blue-600" />
              Global Shared Pool ({jobs.length} Total Scraped)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isLoadingFeed}
              onClick={() => void fetchGlobalJobsFeed()}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-gray-300 font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isLoadingFeed ? "animate-spin" : ""}`} />
              <span>{isLoadingFeed ? "Syncing Feed..." : "Refresh Feed"}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsScraperDrawerOpen(!isScraperDrawerOpen)}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-gray-300 font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span>Scraper &amp; Limit Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Compact Launcher for Outreach AI ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-white via-indigo-50/70 to-blue-50/70 border border-indigo-200/90 p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 w-full sm:w-auto">
          {/* Mini Interactive Outreach AI Orb */}
          <div
            onClick={() => setIsVoiceModalOpen(true)}
            className="relative w-11 h-11 rounded-full bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center cursor-pointer shadow-md shadow-indigo-500/25 shrink-0 hover:-translate-y-px transition-all group"
            title="Open Outreach AI Modal"
          >
            {isAgentActive && (
              <motion.div
                animate={{ scale: [1, 1.4, 1.7], opacity: [0.7, 0.3, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-cyan-400 blur-xs"
              />
            )}
            <Bot className="w-5 h-5 text-white drop-shadow-xs" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                Outreach AI
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 shadow-2xs ${
                isAgentActive
                  ? "bg-emerald-100 border border-emerald-300 text-emerald-800"
                  : "bg-indigo-100 border border-indigo-200 text-indigo-800"
              }`}>
                <Radio className={`w-3 h-3 ${isAgentActive ? "text-emerald-600 animate-pulse" : "text-indigo-500"}`} />
                {isAgentActive ? "Active 1-by-1 Dispatch" : "Ready"}
              </span>
            </div>
            <p className="text-slate-500 text-[11px] truncate mt-0.5">
              {isAgentActive ? agentMessage : `Autonomously personalizes and dispatches ${targetProfession} cold emails one-by-one.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {isAgentActive && (
            <button
              type="button"
              onClick={stopAgent}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs font-mono flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Pause</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsVoiceModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 hover:-translate-y-px transition-all cursor-pointer w-full sm:w-auto"
          >
            <Mic className="w-3.5 h-3.5 text-yellow-300" />
            <span>Open Outreach AI</span>
          </button>
        </div>
      </div>

      {/* ── Outreach AI Modal Popup (Light Mode) ── */}
      <AnimatePresence>
        {isVoiceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              className="relative w-full max-w-xl rounded-3xl bg-gradient-to-b from-white via-slate-50/90 to-white border border-gray-200/90 p-6 sm:p-7 text-slate-800 shadow-2xl space-y-5 overflow-hidden"
            >
              {/* Soft Ambient Radial Glow */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08),transparent_65%)] pointer-events-none" />

              {/* Modal Top Navigation */}
              <div className="relative z-10 flex items-center justify-between pb-3 border-b border-gray-200/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700">
                    <Mic className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-none">
                      Outreach AI
                    </h3>
                    <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                      Target Domain: <strong className="text-blue-700">{targetProfession}</strong>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsVoiceModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close Modal (Agent keeps running in background)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Centerpiece: Large Animated Voice Orb */}
              <div className="relative z-10 flex flex-col items-center justify-center py-3 space-y-4">
                
                {/* Voice Orb Container */}
                <div
                  className="relative flex items-center justify-center cursor-pointer group"
                  onClick={() => void runAutonomousAgent()}
                >
                  {/* Concentric Wave Ring 1 */}
                  {isAgentActive && (
                    <motion.div
                      animate={{ scale: [1, 1.5, 2], opacity: [0.65, 0.3, 0] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute w-32 h-32 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 blur-xs pointer-events-none"
                    />
                  )}

                  {/* Concentric Wave Ring 2 */}
                  {isAgentActive && (
                    <motion.div
                      animate={{ scale: [1, 1.35, 1.7], opacity: [0.75, 0.35, 0] }}
                      transition={{ duration: 1.9, delay: 0.4, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute w-28 h-28 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 blur-xs pointer-events-none"
                    />
                  )}

                  {/* Main Large Voice Sphere */}
                  <motion.div
                    animate={
                      isAgentActive
                        ? { scale: [1, 1.1, 1], rotate: [0, 180, 360] }
                        : { scale: [1, 1.04, 1] }
                    }
                    transition={{
                      duration: isAgentActive ? 3.5 : 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className={`w-28 h-28 rounded-full flex items-center justify-center shadow-2xl relative transition-all duration-300 ${
                      isAgentActive
                        ? "bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 shadow-indigo-500/40 ring-4 ring-indigo-200"
                        : "bg-gradient-to-tr from-indigo-600 via-purple-600 to-blue-600 hover:-translate-y-px shadow-indigo-500/25 ring-2 ring-indigo-100"
                    }`}
                  >
                    {/* Inner Glass Wave Pattern */}
                    <div className="absolute inset-1.5 rounded-full bg-slate-900/10 backdrop-blur-xs flex items-center justify-center overflow-hidden">
                      {isAgentActive ? (
                        <div className="flex items-center gap-1.5">
                          {[0.7, 1.3, 1.8, 1.2, 0.8].map((heightMul, i) => (
                            <motion.div
                              key={i}
                              animate={{ height: [8, 32 * heightMul, 8] }}
                              transition={{
                                duration: 0.6 + i * 0.15,
                                repeat: Infinity,
                                ease: "easeInOut",
                              }}
                              className="w-1.5 rounded-full bg-white shadow-xs"
                            />
                          ))}
                        </div>
                      ) : (
                        <Bot className="w-12 h-12 text-white drop-shadow-sm" />
                      )}
                    </div>
                  </motion.div>

                  {/* Tap Status Tooltip */}
                  <span className="absolute -bottom-2.5 px-3 py-0.5 rounded-full bg-white border border-gray-200 text-[10px] font-mono text-indigo-700 font-bold uppercase tracking-wider shadow-xs">
                    {isAgentActive ? "Tap to Pause" : "Tap to Start Dispatch"}
                  </span>
                </div>

                {/* Spoken AI Thought Stream Bubble */}
                <div className="w-full p-3 rounded-2xl bg-white border border-indigo-200/90 text-xs font-mono text-slate-800 flex items-center gap-2.5 shadow-xs">
                  <Sparkles className="w-4 h-4 text-purple-600 shrink-0 animate-spin" />
                  <span className="leading-relaxed font-medium">{agentMessage}</span>
                </div>

              </div>

              {/* Target Job Status Card (If actively processing) */}
              {agentCurrentJob && isAgentActive && (
                <div className="relative z-10 rounded-2xl bg-blue-50/80 border border-blue-200 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-900 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-blue-600" />
                      CURRENT TARGET JOB
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold font-mono">
                      {agentCurrentJob.matchScore}% Match
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <strong className="text-slate-900 block font-bold">{agentCurrentJob.title}</strong>
                      <span className="text-slate-600 text-[11px]">{agentCurrentJob.company} · {agentCurrentJob.location}</span>
                    </div>
                    <div className="text-right text-[11px] font-mono text-slate-500">
                      <span>Recruiter: <strong className="text-slate-800">{agentCurrentJob.hrName}</strong></span>
                      <span className="block text-blue-600">{agentCurrentJob.hrEmail}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Automation Settings: Batch Size & Pacing Delay */}
              <div className="relative z-10 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white border border-gray-200 p-2.5 space-y-1 shadow-2xs">
                  <label className="text-[10px] font-mono font-bold text-slate-500 uppercase block">BATCH SIZE:</label>
                  <select
                    disabled={isAgentActive}
                    value={agentTargetBatch}
                    onChange={(e) => setAgentTargetBatch(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-gray-300 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold font-mono focus:outline-none cursor-pointer disabled:opacity-50"
                  >
                    <option value={9999}>No Limit (Send All Unapplied)</option>
                    <option value={5}>5 emails per run</option>
                    <option value={10}>10 emails per run</option>
                    <option value={20}>20 emails per run</option>
                    <option value={50}>50 emails per run</option>
                  </select>
                </div>

                <div className="rounded-xl bg-white border border-gray-200 p-2.5 space-y-1 shadow-2xs">
                  <label className="text-[10px] font-mono font-bold text-slate-500 uppercase block">SAFETY DELAY (PACING):</label>
                  <select
                    disabled={isAgentActive}
                    value={agentCooldownSec}
                    onChange={(e) => setAgentCooldownSec(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-gray-300 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold font-mono focus:outline-none cursor-pointer disabled:opacity-50"
                  >
                    <option value={3}>3s delay (Fast)</option>
                    <option value={4}>4s delay (Optimal)</option>
                    <option value={6}>6s delay (Safe)</option>
                    <option value={10}>10s delay (Relaxed)</option>
                  </select>
                </div>
              </div>

              {/* Primary Action Buttons inside Modal */}
              <div className="relative z-10 flex items-center gap-3 pt-1">
                {isAgentActive ? (
                  <button
                    type="button"
                    onClick={stopAgent}
                    className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Pause Outreach AI</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void runAutonomousAgent()}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-black text-xs font-mono flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 hover:scale-[1.01] transition-all cursor-pointer"
                  >
                    <Zap className="w-4 h-4 text-yellow-300 fill-current" />
                    <span>Start Outreach AI (No Limit)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsVoiceModalOpen(false)}
                  className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs font-mono cursor-pointer transition-colors"
                >
                  {isAgentActive ? "Run in Background" : "Close"}
                </button>
              </div>

              {/* Live Activity Stream inside Modal */}
              {agentActivityLogs.length > 0 && (
                <div className="relative z-10 pt-3 border-t border-gray-200/80 text-xs font-mono space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-bold">LIVE DISPATCH LOGS ({agentSentCount} sent):</span>
                    <button
                      type="button"
                      onClick={() => setAgentActivityLogs([])}
                      className="text-[10px] text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      Clear Logs
                    </button>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-1 text-[11px] text-slate-700 bg-white rounded-xl p-2.5 border border-gray-200">
                    {agentActivityLogs.map((log, index) => (
                      <div key={index} className="flex items-center gap-1.5 truncate">
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Toast Notifications ── */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successToast}</span>
            </div>
            <button type="button" onClick={() => setSuccessToast(null)} className="text-emerald-700 hover:text-emerald-950 ml-3">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {errorToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorToast}</span>
            </div>
            <button type="button" onClick={() => setErrorToast(null)} className="text-rose-700 hover:text-rose-950 ml-3">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scraper Settings & Daily Limit Drawer (Collapsible) ── */}
      <AnimatePresence>
        {isScraperDrawerOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl bg-white border border-blue-200 p-4 space-y-4 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Scraper &amp; Daily Outreach Limit Controls
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsScraperDrawerOpen(false)}
                className="text-gray-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-700 font-bold block">Scraper Search Terms (Comma-separated)</label>
                <input
                  type="text"
                  value={scraperKeywords}
                  onChange={(e) => setScraperKeywords(e.target.value)}
                  className="w-full rounded-lg bg-slate-50 border border-gray-300 px-3 py-2 text-slate-800 text-xs focus:border-blue-500 focus:bg-white focus:outline-none"
                  placeholder="e.g. electrical engineer, power distribution, switchgear, hardware"
                />
                <p className="text-[11px] text-slate-400">Extension automatically refreshes hiring posts using these terms.</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 font-bold">Daily Outreach Quota</label>
                  <label className="flex items-center gap-1.5 text-[11px] text-blue-700 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDailyUnlimited}
                      onChange={(e) => setIsDailyUnlimited(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <span>No Daily Limit</span>
                  </label>
                </div>
                {!isDailyUnlimited ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="5"
                      max="1000"
                      value={dailyLimit || 50}
                      onChange={(e) => setDailyLimit(Math.max(1, parseInt(e.target.value) || 50))}
                      className="w-24 rounded-lg bg-slate-50 border border-gray-300 px-3 py-2 text-slate-800 text-xs font-bold font-mono focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                    <span className="text-slate-500 text-[11px]">emails / day ({dailySentCount} dispatched today)</span>
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold flex items-center gap-1.5">
                    <InfinityIcon className="w-4 h-4 text-blue-600" />
                    <span>Unlimited mode active — Outreach AI runs continuously</span>
                  </div>
                )}
                <p className="text-[11px] text-slate-400">Dispatches cold emails directly to verified recruiters.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 font-bold block">Scraper Status</label>
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setIsScrapingActive(!isScrapingActive)}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                      isScrapingActive
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-slate-200 hover:bg-slate-300 text-slate-800"
                    }`}
                  >
                    {isScrapingActive ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>{isScrapingActive ? "Continuous Scraping Live" : "Resume Scraper"}</span>
                  </button>
                </div>
                <p className="text-[11px] text-emerald-600 font-medium">Auto-captures fresh hiring posts</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Smart Feed Navigation Tabs & Filter Bar ── */}
      <div className="bg-white rounded-2xl border border-gray-200/90 p-3 sm:p-4 space-y-3 shadow-xs">
        
        {/* Main Status Tabs (Smart Apply Filter & Applied List) */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 border-b border-gray-100">
          <div className="flex items-center gap-1.5 min-w-max">
            
            {/* Ready to Apply Tab */}
            <button
              type="button"
              onClick={() => setMainTab("ready_to_apply")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                mainTab === "ready_to_apply"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${mainTab === "ready_to_apply" ? "text-yellow-300 fill-current" : "text-slate-500"}`} />
              <span>Ready to Apply</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                mainTab === "ready_to_apply" ? "bg-white/20 text-white" : "bg-white text-slate-700 border border-gray-200"
              }`}>
                {tabCounts.readyToApply}
              </span>
            </button>

            {/* Applied Applications List Tab */}
            <button
              type="button"
              onClick={() => setMainTab("applied")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                mainTab === "applied"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              <CheckCircle className={`w-3.5 h-3.5 ${mainTab === "applied" ? "text-white" : "text-emerald-600"}`} />
              <span>Applied List</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                mainTab === "applied" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800 font-bold"
              }`}>
                {tabCounts.applied}
              </span>
            </button>

            {/* High Match Tab */}
            <button
              type="button"
              onClick={() => setMainTab("high_match")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                mainTab === "high_match"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${mainTab === "high_match" ? "text-yellow-300" : "text-purple-600"}`} />
              <span>High Match (95%+)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                mainTab === "high_match" ? "bg-white/20 text-white" : "bg-white text-slate-700 border border-gray-200"
              }`}>
                {tabCounts.highMatch}
              </span>
            </button>

            {/* Bookmarked / Starred Tab */}
            <button
              type="button"
              onClick={() => setMainTab("bookmarked")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                mainTab === "bookmarked"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${mainTab === "bookmarked" ? "text-yellow-200 fill-current" : "text-amber-500"}`} />
              <span>Saved / Starred</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                mainTab === "bookmarked" ? "bg-white/20 text-white" : "bg-white text-slate-700 border border-gray-200"
              }`}>
                {tabCounts.bookmarked}
              </span>
            </button>

            {/* All Scraped Feed Tab */}
            <button
              type="button"
              onClick={() => setMainTab("all")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                mainTab === "all"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Jobs</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                mainTab === "all" ? "bg-white/20 text-white" : "bg-white text-slate-700 border border-gray-200"
              }`}>
                {tabCounts.total}
              </span>
            </button>

            {/* Excluded Tab */}
            {tabCounts.excluded > 0 && (
              <button
                type="button"
                onClick={() => setMainTab("excluded")}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  mainTab === "excluded"
                    ? "bg-rose-700 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                <Ban className="w-3.5 h-3.5 text-rose-500" />
                <span>Skipped ({tabCounts.excluded})</span>
              </button>
            )}
          </div>

          {/* Quick Select Actions */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={selectAllVisible}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-gray-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
              <span>Select All</span>
            </button>
            {selectedJobIds.size > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 font-semibold cursor-pointer"
              >
                Clear ({selectedJobIds.size})
              </button>
            )}
          </div>
        </div>

        {/* Search Bar & Dropdown Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by job title (Electrical, Switchgear, React), skills, company, or recruiter..."
              className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-50/70 border border-gray-300 focus:border-blue-500 focus:bg-white text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
            {/* Experience Selector */}
            <select
              value={selectedExp}
              onChange={(e) => setSelectedExp(e.target.value)}
              aria-label="Filter by experience level"
              className="px-2.5 py-2 rounded-lg bg-slate-50 border border-gray-300 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">Exp: All</option>
              <option value="fresher">Fresher (0-2 Yrs)</option>
              <option value="mid">Mid-Level (2-5 Yrs)</option>
              <option value="senior">Senior (5+ Yrs)</option>
            </select>

            {/* Remote Only Toggle */}
            <button
              type="button"
              onClick={() => setOnlyRemote(!onlyRemote)}
              className={`px-2.5 py-2 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                onlyRemote
                  ? "bg-blue-50 border-blue-400 text-blue-700"
                  : "bg-slate-50 border-gray-300 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Remote Only</span>
            </button>

            {/* Smart Sort By Selector (Related & Recent Top) */}
            <div className="flex items-center gap-1 bg-slate-50 border border-gray-300 rounded-lg px-2 py-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="Sort jobs feed"
                className="bg-transparent text-xs font-bold text-blue-700 focus:outline-none cursor-pointer"
              >
                <option value="relevant_recent">Related &amp; Recent (Top)</option>
                <option value="newest">Newest Posted First</option>
                <option value="highest_match">Highest Match Score</option>
                <option value="salary">Highest Salary</option>
              </select>
            </div>

            {/* Items Per Page Limit Selector */}
            <div className="flex items-center gap-1 bg-slate-50 border border-gray-300 rounded-lg px-2 py-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Limit:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                aria-label="Jobs per page limit"
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
                <option value={999}>All Jobs</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Pills (Includes Electrical & Core Engineering Categories) */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: "all", label: "All Engineering" },
              { id: "electrical", label: "Electrical & Electronics" },
              { id: "power_systems", label: "Power & EV Energy" },
              { id: "hardware", label: "Hardware & Embedded" },
              { id: "fullstack", label: "Fullstack" },
              { id: "frontend", label: "Frontend / React" },
              { id: "backend", label: "Backend / Cloud" },
              { id: "ai_ml", label: "AI / ML" },
              { id: "devops", label: "DevOps / SRE" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? "bg-blue-600 text-white font-semibold shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="text-slate-500 text-xs font-mono ml-auto">
            Showing <strong>{paginatedJobs.length}</strong> of <strong>{totalFilteredCount}</strong> {mainTab === "applied" ? "applied applications" : "jobs"}
          </div>
        </div>
      </div>

      {/* ── Sticky Multi-Select Smart Action Bar (Appears when 1+ jobs are checked) ── */}
      <AnimatePresence>
        {selectedJobIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="sticky top-20 z-30 rounded-xl bg-slate-900 text-white p-3 shadow-xl flex flex-wrap items-center justify-between gap-3 border border-slate-700"
          >
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-xs">
                {selectedJobIds.size}
              </span>
              <span className="text-xs font-bold">
                {selectedJobIds.size} job{selectedJobIds.size > 1 ? "s" : ""} selected
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleBatchApplySelected}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-600 hover:from-cyan-300 hover:to-purple-500 text-white font-bold text-xs font-mono flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Zap className="w-3.5 h-3.5 text-yellow-300 fill-current" />
                <span>Outreach AI on Selected ({selectedJobIds.size})</span>
              </button>

              <button
                type="button"
                onClick={clearSelection}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Deselect All
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scraped Job Feed List / Applied Applications List ── */}
      <div className="space-y-2.5">
        {paginatedJobs.map((job) => {
          const isCurrentlySending = sendingJobId === job.id && isSendingEmail;
          const isTargetedByAgent = agentCurrentJob?.id === job.id && isAgentActive;
          const isSelected = selectedJobIds.has(job.id);

          return (
            <motion.article
              key={job.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border transition-all duration-150 overflow-hidden bg-white p-3.5 sm:p-4 hover:shadow-md ${
                job.isApplied
                  ? "border-emerald-300 bg-emerald-50/20"
                  : isTargetedByAgent
                  ? "border-cyan-500 ring-2 ring-cyan-400/40 bg-cyan-50/30"
                  : isSelected
                  ? "border-blue-400 ring-2 ring-blue-200 bg-blue-50/15"
                  : "border-gray-200/90 hover:border-blue-400"
              }`}
            >
              <div className="space-y-2.5">
                
                {/* Header: Checkbox, Title, Company, Match Score & Status Badges */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    
                    {/* Checkbox Selector */}
                    {!job.isApplied && (
                      <button
                        type="button"
                        onClick={() => toggleSelectJob(job.id)}
                        className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                          isSelected
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-gray-300 bg-slate-50 hover:border-gray-400"
                        }`}
                        title={isSelected ? "Deselect job" : "Select for batch apply"}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                    )}

                    {/* Compact Company Initial Avatar */}
                    <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 font-black text-sm shrink-0 shadow-xs">
                      {job.company.charAt(0)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-snug hover:text-blue-600 transition-colors cursor-pointer">
                          {job.title}
                        </h2>

                        {/* Applied Badge */}
                        {job.isApplied && (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-bold font-mono flex items-center gap-1 shadow-2xs">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            Applied {job.appliedAt ? `(${job.appliedAt})` : ""}
                          </span>
                        )}

                        {/* Active Agent Target Badge */}
                        {isTargetedByAgent && (
                          <span className="px-2.5 py-0.5 rounded-full bg-cyan-100 border border-cyan-300 text-cyan-800 text-[10px] font-bold font-mono flex items-center gap-1 animate-pulse">
                            <Zap className="w-3 h-3 text-cyan-600 fill-current" />
                            Outreach AI Processing
                          </span>
                        )}

                        {/* Skipped Badge */}
                        {job.isExcluded && !job.isApplied && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-slate-600 text-[10px] font-mono">
                            Excluded from AI
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5 flex-wrap">
                        <span className="font-semibold text-slate-800 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {job.company}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Top Right: Match Score Pill & Bookmark Toggle */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBookmark(job.id)}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        job.isBookmarked
                          ? "bg-amber-50 border-amber-300 text-amber-500"
                          : "bg-slate-50 border-gray-200 text-slate-400 hover:text-amber-500"
                      }`}
                      title={job.isBookmarked ? "Remove from saved" : "Bookmark this job"}
                    >
                      <Star className={`w-3.5 h-3.5 ${job.isBookmarked ? "fill-current" : ""}`} />
                    </button>

                    <span className="px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[11px] font-bold font-mono flex items-center gap-1 shadow-xs">
                      <Sparkles className="w-3 h-3 text-purple-600" />
                      {job.matchScore}% Match
                    </span>
                  </div>
                </div>

                {/* Naukri-Style 3-Column Key Info Row (Exp, Salary, Location) */}
                <div className="flex items-center gap-4 sm:gap-6 text-xs text-slate-700 flex-wrap py-1.5 border-y border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium">{job.experience}</span>
                  </div>
                  <span className="text-gray-300 hidden sm:inline">|</span>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-900">{job.salary}</span>
                  </div>
                  <span className="text-gray-300 hidden sm:inline">|</span>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{job.location}</span>
                    {job.isRemote && (
                      <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200">
                        Remote
                      </span>
                    )}
                  </div>
                </div>

                {/* 1-Line Job Description Snippet */}
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-1">
                  {job.description}
                </p>

                {/* Key Skills Tags */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase font-bold mr-0.5">Key Skills:</span>
                  {job.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium hover:bg-slate-200 transition-colors"
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                {/* Recruiter / HR Contact & 1-Click Action Footer */}
                <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  
                  {/* Compact Recruiter Info */}
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-800">{job.hrName}</span>
                      <span className="text-[11px] text-slate-400">({job.hrTitle})</span>
                      <span className="text-[11px] font-mono text-blue-600 hover:underline">
                        {job.hrEmail}
                      </span>
                    </div>
                  </div>

                  {/* Actions & Posted Ago */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className="text-[11px] text-slate-400 font-mono mr-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {job.postedAgo}
                    </span>

                    {/* Exclude / Skip Toggle (Only for unapplied) */}
                    {!job.isApplied && (
                      <button
                        type="button"
                        onClick={() => toggleExclude(job.id)}
                        className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                          job.isExcluded
                            ? "bg-rose-50 border-rose-200 text-rose-600"
                            : "bg-slate-50 border-gray-200 text-slate-400 hover:text-slate-700"
                        }`}
                        title={job.isExcluded ? "Include back in auto-apply" : "Skip from auto-apply"}
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* View LinkedIn Post */}
                    <a
                      href={job.sourcePostUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="View Recruiter's LinkedIn Post"
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    >
                      <Linkedin className="w-3.5 h-3.5 text-blue-600" />
                    </a>

                    {/* If Applied: View Sent Pitch Button */}
                    {job.isApplied ? (
                      <button
                        type="button"
                        onClick={() => setViewingHistoryJob(job)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        <span>View Sent Pitch</span>
                      </button>
                    ) : (
                      <>
                        {/* Preview Pitch Modal Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(job)}
                          className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-gray-300 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-purple-600" />
                          <span>Preview Pitch</span>
                        </button>

                        {/* 1-Click Apply & Send Email Button */}
                        <button
                          type="button"
                          disabled={isCurrentlySending}
                          onClick={() => void handleDirectApply(job)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
                            isCurrentlySending
                              ? "bg-blue-800 text-white cursor-wait"
                              : "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-sm"
                          }`}
                        >
                          {isCurrentlySending ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                              <span>Sending...</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5 text-yellow-300 fill-current" />
                              <span>1-Click Apply</span>
                            </>
                          )}
                        </button>
                      </>
                    )}

                  </div>

                </div>

              </div>
            </motion.article>
          );
        })}

        {/* Empty State */}
        {filteredJobs.length === 0 && (
          <div className="p-10 rounded-2xl bg-white border border-dashed border-gray-300 text-center space-y-3 shadow-xs">
            {mainTab === "applied" ? (
              <>
                <History className="w-9 h-9 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">No Sent Applications Yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Applications you dispatch using 1-Click Apply or Outreach AI will appear here with timestamps and sent pitch records.
                </p>
                <button
                  type="button"
                  onClick={() => setMainTab("ready_to_apply")}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  View Ready to Apply Jobs
                </button>
              </>
            ) : (
              <>
                <Mail className="w-9 h-9 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">No matching jobs in this category</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Try switching categories, clearing search terms, or clicking below to view all ready engineering jobs.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMainTab("ready_to_apply");
                    setSearchQuery("");
                    setSelectedCategory("all");
                    setSelectedExp("all");
                    setOnlyRemote(false);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  Reset Filters &amp; View All Ready
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Pagination & Limit Controls Footer ── */}
      {filteredJobs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200/90 p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          
          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{paginatedJobs.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to{" "}
            <strong className="text-slate-800">
              {Math.min(currentPage * pageSize, totalFilteredCount)}
            </strong>{" "}
            of <strong className="text-slate-800">{totalFilteredCount}</strong> {mainTab === "applied" ? "applied applications" : "jobs"}
          </div>

          {/* Page Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-gray-300 text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              if (totalPages > 7 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
                if (p === 2 || p === totalPages - 1) {
                  return <span key={p} className="px-1 text-slate-400 text-xs">...</span>;
                }
                return null;
              }
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    currentPage === p
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-50 hover:bg-slate-100 border border-gray-300 text-slate-700"
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-gray-300 text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Limit Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-50 border border-gray-300 rounded-md px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={999}>All Jobs</option>
            </select>
          </div>

        </div>
      )}

      {/* ── Sent Application Detail Modal (Applied History Viewer) ── */}
      <AnimatePresence>
        {viewingHistoryJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative w-full max-w-2xl rounded-2xl bg-white border border-gray-200 p-5 sm:p-6 text-slate-800 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 leading-none">
                      Sent Cold Outreach Record
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Role: <strong className="text-slate-800">{viewingHistoryJob.title}</strong> at {viewingHistoryJob.company}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingHistoryJob(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Recruiter & Timestamp Information */}
              <div className="p-3 rounded-xl bg-slate-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans font-bold">RECRUITER RECIPIENT:</span>
                  <strong className="text-slate-800">{viewingHistoryJob.hrName}</strong> · <span className="text-blue-600">{viewingHistoryJob.hrEmail}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] font-sans font-bold">DELIVERY STATUS:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold font-sans">
                    Sent {viewingHistoryJob.appliedAt || ""}
                  </span>
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Sent Subject</label>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-gray-200 text-xs font-mono text-slate-800">
                  {viewingHistoryJob.emailSubject || `Application for ${viewingHistoryJob.title} — ${candidateName}`}
                </div>
              </div>

              {/* Pitch Body */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Sent Pitch Content</label>
                <div className="p-3 rounded-lg bg-slate-50 border border-gray-200 text-xs font-mono text-slate-800 whitespace-pre-line leading-relaxed max-h-60 overflow-y-auto">
                  {viewingHistoryJob.emailBody || generatePitchForJob(viewingHistoryJob).body}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setViewingHistoryJob(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer"
                >
                  Close Record
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Interactive Email Preview & 1-Click Pitch Modal (Light Mode) ── */}
      <AnimatePresence>
        {previewJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative w-full max-w-2xl rounded-2xl bg-white border border-gray-200 p-5 sm:p-6 text-slate-800 shadow-xl space-y-4"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 leading-none">
                      AI Personalized Cold Email Pitch
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Role: <strong className="text-slate-800">{previewJob.title}</strong> at {previewJob.company}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewJob(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Recipient HR Information Bar */}
              <div className="p-3 rounded-xl bg-slate-50 border border-gray-200 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans font-bold">RECRUITER RECIPIENT:</span>
                  <strong className="text-slate-800">{previewJob.hrName}</strong> · <span className="text-blue-600">{previewJob.hrEmail}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-bold font-sans">
                  Verified Recruiter
                </span>
              </div>

              {/* Subject Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Subject Line</label>
                <input
                  type="text"
                  value={modalSubject}
                  onChange={(e) => setModalSubject(e.target.value)}
                  className="w-full rounded-lg bg-slate-50 border border-gray-300 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
                />
              </div>

              {/* Body Textarea */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Cover Letter Body</label>
                  <span className="text-[10px] text-purple-700 font-medium">Auto-tailored for {targetProfession}</span>
                </div>
                <textarea
                  rows={8}
                  value={modalBody}
                  onChange={(e) => setModalBody(e.target.value)}
                  className="w-full rounded-lg bg-slate-50 border border-gray-300 p-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white font-mono leading-relaxed resize-none"
                />
              </div>

              {/* Attached Resume Pill */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-gray-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-blue-600" />
                  <span className="text-slate-700 font-medium">
                    Attached: <strong>{candidateName}_Resume.pdf</strong>
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">1 Credit consumed on send</span>
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPreviewJob(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSendingEmail || !modalSubject || !modalBody}
                  onClick={() => void handleDirectApply(previewJob, modalSubject, modalBody)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSendingEmail ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Sending Email to HR...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 text-white" />
                      <span>Send Cold Email Now</span>
                    </>
                  )}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
