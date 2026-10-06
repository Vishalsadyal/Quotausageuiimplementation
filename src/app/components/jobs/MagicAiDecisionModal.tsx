import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  X,
  Bot,
  Loader2,
  Wrench,
  Zap,
  CheckCircle2,
  FileText,
  BookOpen,
  HelpCircle,
  FileEdit,
  TrendingUp,
  Database,
  Activity,
  UserCheck,
  Edit3,
  Radio,
  Check,
  Maximize2,
  Minus,
  ChevronRight,
  Terminal,
  ExternalLink,
  Play,
  SkipForward,
  CheckCircle,
  Sliders,
  ArrowRight,
  Copy,
  RefreshCw,
  Cpu,
  Layers,
  Search,
  CheckCheck,
} from "lucide-react";

export interface MagicAiJobContext {
  id?: string;
  title?: string;
  company?: string;
  location?: string;
  reason?: string;
  status?: string;
  matchScore?: number;
  requirements?: string[];
}

export interface MagicAiUserProfile {
  name?: string;
  email?: string;
  phone?: string;
  currentCity?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  experienceYears?: number | string;
  skills?: string[];
}

export interface MagicAiPipelineStats {
  total?: number;
  queued?: number;
  submitted?: number;
  failed?: number;
  skipped?: number;
}

export interface MagicAiDecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetJob?: MagicAiJobContext | null;
  userProfile?: MagicAiUserProfile | null;
  pipelineStats?: MagicAiPipelineStats | null;
  screeningAnswers?: Record<string, string>;
  pendingQuestions?: Array<{ questionKey: string; questionLabel: string; validationMessage?: string }>;
  onAutoCustomize?: () => Promise<void> | void;
  onAutoOptimize?: (job?: MagicAiJobContext | null) => Promise<void> | void;
  onLaunchAutoApply?: (job?: MagicAiJobContext | null) => Promise<void> | void;
  onReQueueJob?: (jobId?: string) => Promise<void> | void;
  onSkipJob?: (jobId?: string) => Promise<void> | void;
  onSolveScreening?: () => Promise<void> | void;
  onSyncExtension?: () => Promise<void> | void;
  onSaveCustomTag?: (tag: string) => Promise<void> | void;
  searchTerms?: string[];
  pendingQuestionsCount?: number;
  totalSyncedCount?: number;
  linkedInConnected?: boolean;
  extensionVersion?: string;
}

const LinkedInSvg = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
  </svg>
);

const OpenAiLogo = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zm-1.22-8.72a4.47 4.47 0 0 1 2.34-1.974l-.141.085L9.362 10.45a.795.795 0 0 0 .783 0l5.84-3.37-2.02-1.168a.08.08 0 0 0-.071 0l-4.839 2.79a4.508 4.508 0 0 0-4.075 4.882zm14.864 3.012l-5.843 3.37-2.02-1.168a.08.08 0 0 1-.038-.052V9.163a4.504 4.504 0 0 1 7.37-3.454l-.142.081-4.779 2.758a.795.795 0 0 0-.392.681v6.737l5.844-3.37zM20.4 14.416a4.47 4.47 0 0 1-.535 3.014l-.142-.085-4.783-2.759a.771.771 0 0 0-.78 0L8.317 17.955v-2.332a.08.08 0 0 1 .033-.062l4.84-2.79a4.508 4.508 0 0 1 6.14 1.646zm1.22-5.696a4.47 4.47 0 0 1-2.34 1.974l.141-.085-4.783-2.759a.795.795 0 0 0-.783 0l-5.84 3.37 2.02 1.168a.08.08 0 0 0 .071 0l4.839-2.79a4.508 4.508 0 0 0 4.075-4.882z" />
  </svg>
);

export type AgentNodeKey =
  | "resume_parser"
  | "knowledge_base"
  | "screening_solver"
  | "linkedin_scout"
  | "letter_tailor"
  | "salary_analyzer"
  | "browser_pilot"
  | "groq_matcher"
  | "mysql_vector"
  | "app_tracker"
  | "interview_prep";

export const MagicAiDecisionModal: React.FC<MagicAiDecisionModalProps> = ({
  isOpen,
  onClose,
  targetJob,
  userProfile,
  pipelineStats,
  screeningAnswers = {},
  pendingQuestions = [],
  onAutoCustomize,
  onAutoOptimize,
  onLaunchAutoApply,
  onReQueueJob,
  onSkipJob,
  onSolveScreening,
  onSyncExtension,
  onSaveCustomTag,
  searchTerms = [],
  pendingQuestionsCount = 0,
  totalSyncedCount = 0,
  linkedInConnected = false,
  extensionVersion = "2.6.0",
}) => {
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<string>("");
  const [matchScore, setMatchScore] = useState<number>(targetJob?.matchScore || 75);
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const [manualInputText, setManualInputText] = useState(
    targetJob?.reason ? `Requirement override: ${targetJob.reason}` : "Shopify Liquid, GraphQL API, Webhooks"
  );
  const [isCardMinimized, setIsCardMinimized] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeInspectorAgent, setActiveInspectorAgent] = useState<AgentNodeKey | null>(null);
  const [activeAgentToast, setActiveAgentToast] = useState<string | null>(null);
  const [copiedTextKey, setCopiedTextKey] = useState<string>("");
  const [isAgentExecuting, setIsAgentExecuting] = useState(false);

  // Sync state when targetJob changes
  useEffect(() => {
    if (targetJob) {
      setMatchScore(targetJob.matchScore || 75);
      if (targetJob.reason) {
        setManualInputText(`Requirement: ${targetJob.reason}`);
      }
    }
  }, [targetJob]);

  const activeJobTitle = targetJob?.title || "Shopify Plus Architect";
  const activeCompany = targetJob?.company || "TechCorp Global";
  const activeReason = targetJob?.reason || "Shopify Theme (Liquid) & APIs";
  const activeLocation = targetJob?.location || "Remote";

  // Dynamic user profile defaults
  const userName = userProfile?.name || "Candidate";
  const userEmail = userProfile?.email || "candidate@autoapply.app";
  const userSkills = userProfile?.skills || [
    "React",
    "TypeScript",
    "Node.js",
    "Next.js",
    "REST APIs",
    "TailwindCSS",
    "PostgreSQL",
  ];

  // Quick Choice 1: 1-Click Auto Optimize & Keep Doing Job with Fleet
  const handleAutoOptimizeAndContinue = async () => {
    setIsProcessing(true);
    setProcessingAction("optimize");
    setActionSuccessMsg("");

    try {
      if (onAutoOptimize) await onAutoOptimize(targetJob);
      if (onReQueueJob && targetJob?.id) {
        await onReQueueJob(targetJob.id);
      } else if (onLaunchAutoApply) {
        await onLaunchAutoApply(targetJob);
      }

      setMatchScore(96);
      setActionSuccessMsg(`✨ Fleet Optimized (+21% Match): Job '${activeJobTitle}' submitted! Fleet continuing auto-apply...`);
      
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingAction("");
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      setProcessingAction("");
    }
  };

  // Quick Choice 2: Skip Job & Keep Doing Next Job with Fleet
  const handleSkipAndContinue = async () => {
    setIsProcessing(true);
    setProcessingAction("skip");
    setActionSuccessMsg("");

    try {
      if (onSkipJob && targetJob?.id) {
        await onSkipJob(targetJob.id);
      }
      setActionSuccessMsg(`⏩ Skipped '${activeJobTitle}'. Fleet continuing with next match in queue...`);
      
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingAction("");
        onClose();
      }, 1200);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      setProcessingAction("");
    }
  };

  // Quick Choice 3: Save Custom Override & Submit
  const handleSaveOverrideAndContinue = async () => {
    if (!manualInputText.trim()) return;
    setIsProcessing(true);
    setProcessingAction("manual");
    setActionSuccessMsg("");

    try {
      if (onSaveCustomTag) {
        await onSaveCustomTag(manualInputText.trim());
      }
      if (onAutoOptimize) await onAutoOptimize(targetJob);
      if (onReQueueJob && targetJob?.id) {
        await onReQueueJob(targetJob.id);
      } else if (onLaunchAutoApply) {
        await onLaunchAutoApply(targetJob);
      }

      setMatchScore(98);
      setActionSuccessMsg(`✓ Custom tags saved! '${activeJobTitle}' queued. Fleet running...`);
      
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingAction("");
        onClose();
      }, 1400);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      setProcessingAction("");
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTextKey(key);
      setTimeout(() => setCopiedTextKey(""), 1500);
    } catch (err) {
      console.error("Clipboard copy error", err);
    }
  };

  const handleOpenInspector = (agentKey: AgentNodeKey, shortSummary: string) => {
    setActiveInspectorAgent(agentKey);
    setActiveAgentToast(shortSummary);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-slate-950/92 backdrop-blur-xl p-2 sm:p-4 font-sans select-none">
        
        {/* Style for data flowing dash animation & eclipse core */}
        <style>
          {`
            @keyframes dataFlowForward {
              from { stroke-dashoffset: 24; }
              to { stroke-dashoffset: 0; }
            }
            .animate-data-flow {
              stroke-dasharray: 6 6;
              animation: dataFlowForward 1.2s linear infinite;
            }
            .eclipse-core {
              background: radial-gradient(circle at 50% 50%, #090d16 60%, #1e1035 90%, #6047f5 100%);
              box-shadow: 
                0 0 60px rgba(139, 92, 246, 0.35),
                inset 0 0 40px rgba(6, 182, 212, 0.25);
              border: 1px solid rgba(139, 92, 246, 0.4);
            }
          `}
        </style>

        {/* Ambient Neural Starfield Grid */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_45%,rgba(67,56,202,0.22),transparent_70%)]" />

        {/* Main Holographic Canvas Container */}
        <div className="relative w-full max-w-6xl my-auto flex flex-col items-center justify-center">

          {/* Top Beacon Siren - Perfectly Aligned at Center (550px) */}
          <div className="relative z-30 flex flex-col items-center mb-0.5">
            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
              className="flex flex-col items-center cursor-pointer"
              onClick={() => handleOpenInspector("browser_pilot", "Beacon Coordinator: Telemetry live across 11 agent nodes.")}
            >
              <div className="relative flex items-center justify-center">
                <div className="absolute -top-3 w-9 h-5 border-t-2 border-cyan-400/80 rounded-t-full animate-ping" />
                <div className="absolute -top-1.5 w-6 h-3 border-t-2 border-purple-400/90 rounded-t-full" />
                
                {/* Siren Cylinder */}
                <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-b from-cyan-400 via-indigo-600 to-purple-700 border-2 border-cyan-300 flex items-center justify-center shadow-2xl shadow-cyan-400/60">
                  <span className="text-white font-black text-sm font-serif drop-shadow-md">i</span>
                </div>
              </div>
              <div className="w-12 h-1.5 bg-gradient-to-r from-purple-700 via-cyan-400 to-purple-700 rounded-full -mt-1 shadow-md" />
            </motion.div>
          </div>

          {/* Active Agent Flash Info Toast */}
          {activeAgentToast && (
            <div className="absolute top-14 z-50 px-4 py-1.5 rounded-full bg-slate-900/95 border border-cyan-400/70 text-cyan-200 text-xs font-mono shadow-2xl backdrop-blur-xl flex items-center gap-2 animate-fadeIn">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
              <span>{activeAgentToast}</span>
              <button
                type="button"
                onClick={() => setActiveAgentToast(null)}
                className="text-gray-400 hover:text-white ml-2 text-xs font-bold cursor-pointer"
              >
                ×
              </button>
            </div>
          )}

          {/* Collapsible Debug / Vector DB Terminal Drawer (Floating Top-Right) */}
          <div className="absolute right-4 top-2 z-40 hidden lg:block pointer-events-auto">
            {isDrawerOpen ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-72 rounded-xl bg-slate-900/95 border border-cyan-400/60 p-2.5 text-white shadow-2xl shadow-cyan-500/20 backdrop-blur-xl"
              >
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10">
                  <div className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[11px] font-bold text-cyan-200 font-mono">MySQL DB Memory</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="text-gray-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="p-1.5 rounded-lg bg-slate-950/90 border border-slate-800 font-mono text-[9px] text-gray-300 leading-tight space-y-0.5">
                  <div><span className="text-purple-400">&quot;target_job&quot;</span>: <span className="text-emerald-300">&quot;{activeJobTitle}&quot;</span>,</div>
                  <div><span className="text-purple-400">&quot;company&quot;</span>: <span className="text-cyan-300">&quot;{activeCompany}&quot;</span>,</div>
                  <div><span className="text-purple-400">&quot;match_score&quot;</span>: <span className="text-yellow-300">{matchScore}%</span>,</div>
                  <div><span className="text-purple-400">&quot;synced_answers&quot;</span>: <span className="text-emerald-400">{totalSyncedCount}</span>,</div>
                  <div><span className="text-purple-400">&quot;extension_bridge&quot;</span>: <span className="text-emerald-400">&quot;{linkedInConnected ? 'ready' : 'disconnected'}&quot;</span></div>
                </div>

                <div className="flex items-center gap-1 mt-2">
                  <button
                    type="button"
                    onClick={() => handleOpenInspector("mysql_vector", "MySQL Database & Vector Memory Inspector")}
                    className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[9px] font-mono text-cyan-300 border border-slate-700 cursor-pointer"
                  >
                    Inspect
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAutoOptimizeAndContinue()}
                    className="flex-1 py-1 rounded bg-purple-900/80 hover:bg-purple-800 text-[9px] font-mono text-purple-200 border border-purple-600/60 cursor-pointer"
                  >
                    Sync AI
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="flex-1 py-1 rounded bg-rose-950/60 hover:bg-rose-900/60 text-[9px] font-mono text-rose-300 border border-rose-800/60 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            ) : (
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 text-[10px] font-mono shadow-lg shadow-cyan-500/20 backdrop-blur-md transition-all hover:-translate-y-px cursor-pointer"
              >
                <Terminal className="w-3 h-3 text-cyan-400" />
                <span>MySQL DB Telemetry ({totalSyncedCount} Synced)</span>
                <ChevronRight className="w-3 h-3 text-gray-400" />
              </button>
            )}
          </div>

          {/* Holographic Stage Canvas with 3D Holographic Sphere Globe */}
          <div className="relative w-full min-h-[580px] sm:min-h-[640px] flex items-center justify-center">

            {/* SVG CANVAS: CONNECTOR CURVES + DYNAMIC FILTERS + 3D SPHERE GLOBE */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
              viewBox="0 0 1100 640"
              fill="none"
            >
              <defs>
                {/* SVG Glow Filters */}
                <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                <filter id="glowPurple" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                <filter id="glowAmber" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                {/* 3D Sphere Globe Radial Gradient */}
                <radialGradient id="sphereGlobeRadial" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
                  <stop offset="45%" stopColor="#8d7aff" stopOpacity="0.12" />
                  <stop offset="80%" stopColor="#b9adff" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#020617" stopOpacity="0" />
                </radialGradient>

                {/* Sun Core Gradients */}
                <radialGradient id="sunSphereCore" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="20%" stopColor="#fef08a" stopOpacity="0.95" />
                  <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.85" />
                  <stop offset="75%" stopColor="#ea580c" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                </radialGradient>

                <radialGradient id="sunSphereCorona" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fde047" stopOpacity="0.65" />
                  <stop offset="35%" stopColor="#fbbf24" stopOpacity="0.35" />
                  <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#020617" stopOpacity="0" />
                </radialGradient>

                <linearGradient id="sunRayBeam" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>

                <linearGradient id="fiberLeftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#b9adff" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>

                <linearGradient id="fiberRightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="50%" stopColor="#8d7aff" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
              </defs>

              {/* 1. TOP-FANNING CABLES FROM BEACON TOP */}
              <path d="M 545 45 C 530 25, 500 10, 470 0" stroke="#b9adff" strokeWidth="2" strokeOpacity="0.8" />
              <path d="M 548 45 C 540 25, 520 10, 500 0" stroke="#38bdf8" strokeWidth="2" strokeOpacity="0.8" />
              <path d="M 550 45 L 550 0" stroke="#22d3ee" strokeWidth="2.5" strokeOpacity="0.9" className="animate-pulse" />
              <path d="M 552 45 C 560 25, 580 10, 600 0" stroke="#38bdf8" strokeWidth="2" strokeOpacity="0.8" />
              <path d="M 555 45 C 570 25, 600 10, 630 0" stroke="#f472b6" strokeWidth="2" strokeOpacity="0.8" />

              {/* 2. BOTTOM-FANNING CABLES FROM BEACON TO MODAL */}
              <path d="M 545 60 C 530 80, 500 100, 480 125" stroke="#b9adff" strokeWidth="2" strokeOpacity="0.8" />
              <path d="M 548 60 C 540 80, 520 105, 510 125" stroke="#38bdf8" strokeWidth="2" strokeOpacity="0.8" />
              <path d="M 550 60 L 550 125" stroke="#22d3ee" strokeWidth="2.5" strokeOpacity="0.95" className="animate-pulse" />
              <path d="M 552 60 C 560 80, 580 105, 590 125" stroke="#38bdf8" strokeWidth="2" strokeOpacity="0.8" />
              <path d="M 555 60 C 570 80, 600 100, 620 125" stroke="#f472b6" strokeWidth="2" strokeOpacity="0.8" />

              {/* 3. 3D HOLOGRAPHIC SPHERE GLOBE (Center: 550, 320, Radius: 210) */}
              <circle cx="550" cy="320" r="210" fill="url(#sphereGlobeRadial)" />
              <circle cx="550" cy="320" r="210" stroke="#38bdf8" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="6 4" />
              <circle cx="550" cy="320" r="220" stroke="#8d7aff" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="4 6" />

              {/* Latitudes & Longitudes */}
              <ellipse cx="550" cy="320" rx="210" ry="120" stroke="#38bdf8" strokeOpacity="0.35" strokeWidth="1.2" />
              <ellipse cx="550" cy="320" rx="120" ry="210" stroke="#8d7aff" strokeOpacity="0.35" strokeWidth="1.2" />
              <ellipse cx="550" cy="320" rx="210" ry="60" stroke="#b9adff" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="4 4" />
              <ellipse cx="550" cy="320" rx="60" ry="210" stroke="#38bdf8" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="4 4" />

              {/* 4. RADIANT SUN OBJECT IN CENTER */}
              <g>
                <circle cx="550" cy="320" r="85" stroke="#fde047" strokeOpacity="0.4" strokeWidth="1.5" className="animate-ping" style={{ animationDuration: "3.5s" }} />
                <circle cx="550" cy="320" r="75" fill="url(#sunSphereCorona)" className="animate-pulse" />
                <circle cx="550" cy="320" r="46" fill="url(#sunSphereCore)" />

                <g className="animate-spin" style={{ transformOrigin: "550px 320px", animationDuration: "25s" }}>
                  <line x1="550" y1="255" x2="550" y2="285" stroke="url(#sunRayBeam)" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="550" y1="355" x2="550" y2="385" stroke="url(#sunRayBeam)" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="485" y1="320" x2="515" y2="320" stroke="url(#sunRayBeam)" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="585" y1="320" x2="615" y2="320" stroke="url(#sunRayBeam)" strokeWidth="2.5" strokeLinecap="round" />

                  <line x1="504" y1="274" x2="525" y2="295" stroke="url(#sunRayBeam)" strokeWidth="2" strokeLinecap="round" />
                  <line x1="575" y1="345" x2="596" y2="366" stroke="url(#sunRayBeam)" strokeWidth="2" strokeLinecap="round" />
                  <line x1="596" y1="274" x2="575" y2="295" stroke="url(#sunRayBeam)" strokeWidth="2" strokeLinecap="round" />
                  <line x1="525" y1="345" x2="504" y2="366" stroke="url(#sunRayBeam)" strokeWidth="2" strokeLinecap="round" />
                </g>

                <circle cx="550" cy="320" r="22" fill="#f59e0b" />
                <circle cx="550" cy="320" r="15" fill="#fef08a" className="animate-pulse" />
                <circle cx="550" cy="320" r="9" fill="#ffffff" />

                <line x1="460" y1="320" x2="640" y2="320" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.2" />
                <line x1="550" y1="230" x2="550" y2="410" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.2" />
              </g>

              {/* Rotating Globe Orbit Ring */}
              <g className="animate-spin" style={{ transformOrigin: "550px 320px", animationDuration: "40s" }}>
                <ellipse cx="550" cy="320" rx="240" ry="90" stroke="#22d3ee" strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="10 6" />
                <circle cx="310" cy="320" r="4" fill="#22d3ee" className="shadow-lg shadow-cyan-400" />
                <circle cx="790" cy="320" r="4" fill="#4932cf" />
              </g>

              {/* 5. OPTICAL FIBER RAYS TO LEFT 6 AGENT NODES */}
              <path d="M 380 200 C 330 140, 280 100, 240 90" stroke="url(#fiberLeftGrad)" strokeWidth="3.5" strokeLinecap="round" filter="url(#glowPurple)" />
              <path d="M 380 200 C 330 140, 280 100, 240 90" stroke="#fef08a" strokeWidth="1.5" className="animate-data-flow" />
              <circle cx="290" cy="135" r="5.5" fill="#0f172a" stroke="#b9adff" strokeWidth="1.8" />
              <circle cx="290" cy="135" r="2.5" fill="#22d3ee" className="animate-ping" />

              <path d="M 380 240 C 290 210, 220 190, 160 180" stroke="url(#fiberLeftGrad)" strokeWidth="3.5" strokeLinecap="round" filter="url(#glowPurple)" />
              <path d="M 380 240 C 290 210, 220 190, 160 180" stroke="#fef08a" strokeWidth="1.5" className="animate-data-flow" />
              <circle cx="250" cy="205" r="5.5" fill="#0f172a" stroke="#4932cf" strokeWidth="1.8" />
              <circle cx="250" cy="205" r="2.5" fill="#38bdf8" />

              <path d="M 380 290 C 260 280, 170 275, 90 275" stroke="url(#fiberLeftGrad)" strokeWidth="4" strokeLinecap="round" filter="url(#glowAmber)" />
              <path d="M 380 290 C 260 280, 170 275, 90 275" stroke="#ffffff" strokeWidth="1.8" className="animate-data-flow" />
              <circle cx="210" cy="280" r="6.5" fill="#0f172a" stroke="#f97316" strokeWidth="2" />
              <circle cx="210" cy="280" r="3" fill="#fef08a" className="animate-ping" />

              <path d="M 380 350 C 260 360, 160 370, 80 375" stroke="url(#fiberLeftGrad)" strokeWidth="3.5" strokeLinecap="round" filter="url(#glowCyan)" />
              <path d="M 380 350 C 260 360, 160 370, 80 375" stroke="#fef08a" strokeWidth="1.5" className="animate-data-flow" />
              <circle cx="200" cy="365" r="5.5" fill="#0f172a" stroke="#06b6d4" strokeWidth="1.8" />
              <circle cx="200" cy="365" r="2.5" fill="#22d3ee" />

              <path d="M 380 400 C 280 430, 200 455, 140 470" stroke="url(#fiberLeftGrad)" strokeWidth="3.5" strokeLinecap="round" filter="url(#glowPurple)" />
              <path d="M 380 400 C 280 430, 200 455, 140 470" stroke="#fef08a" strokeWidth="1.5" className="animate-data-flow" />
              <circle cx="240" cy="440" r="5.5" fill="#0f172a" stroke="#b9adff" strokeWidth="1.8" />
              <circle cx="240" cy="440" r="2.5" fill="#38bdf8" />

              <path d="M 380 440 C 310 490, 260 535, 220 560" stroke="url(#fiberLeftGrad)" strokeWidth="3.5" strokeLinecap="round" filter="url(#glowAmber)" />
              <path d="M 380 440 C 310 490, 260 535, 220 560" stroke="#fef08a" strokeWidth="1.5" className="animate-data-flow" />
              <circle cx="290" cy="510" r="5.5" fill="#0f172a" stroke="#f97316" strokeWidth="1.8" />
              <circle cx="290" cy="510" r="2.5" fill="#fef08a" />

              {/* 6. OPTICAL FIBER RAYS TO RIGHT 5 AGENT NODES */}
              <path d="M 720 200 C 770 150, 820 130, 860 120" stroke="url(#fiberRightGrad)" strokeWidth="3.5" strokeLinecap="round" filter="url(#glowCyan)" />
              <path d="M 720 200 C 770 150, 820 130, 860 120" stroke="#fef08a" strokeWidth="1.5" className="animate-data-flow" />
              <circle cx="800" cy="150" r="5.5" fill="#0f172a" stroke="#22d3ee" strokeWidth="1.8" />
              <circle cx="800" cy="150" r="2.5" fill="#38bdf8" />

              <path d="M 720 250 C 800 235, 870 225, 940 220" stroke="url(#fiberRightGrad)" strokeWidth="3.5" strokeLinecap="round" filter="url(#glowCyan)" />
              <path d="M 720 250 C 800 235, 870 225, 940 220" stroke="#fef08a" strokeWidth="1.5" className="animate-data-flow" />
              <circle cx="845" cy="235" r="5.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.8" />
              <circle cx="845" cy="235" r="2.5" fill="#22d3ee" />

              <path d="M 720 320 C 820 322, 910 324, 990 325" stroke="url(#fiberRightGrad)" strokeWidth="4" strokeLinecap="round" filter="url(#glowCyan)" />
              <path d="M 720 320 C 820 322, 910 324, 990 325" stroke="#ffffff" strokeWidth="1.8" className="animate-data-flow" />
              <circle cx="870" cy="323" r="6.5" fill="#0f172a" stroke="#22d3ee" strokeWidth="2" />
              <circle cx="870" cy="323" r="3" fill="#34d399" />

              <path d="M 720 390 C 810 405, 880 420, 940 430" stroke="url(#fiberRightGrad)" strokeWidth="3.5" strokeLinecap="round" filter="url(#glowCyan)" />
              <path d="M 720 390 C 810 405, 880 420, 940 430" stroke="#fef08a" strokeWidth="1.5" className="animate-data-flow" />
              <circle cx="845" cy="410" r="5.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.8" />
              <circle cx="845" cy="410" r="2.5" fill="#22d3ee" />

              <path d="M 720 440 C 780 480, 825 515, 860 535" stroke="url(#fiberRightGrad)" strokeWidth="3.5" strokeLinecap="round" filter="url(#glowCyan)" />
              <path d="M 720 440 C 780 480, 825 515, 860 535" stroke="#fef08a" strokeWidth="1.5" className="animate-data-flow" />
              <circle cx="800" cy="495" r="5.5" fill="#0f172a" stroke="#b9adff" strokeWidth="1.8" />
              <circle cx="800" cy="495" r="2.5" fill="#38bdf8" />
            </svg>

            {/* LEFT ARC: 6 NODES (INTERACTIVE & DATA-SYNCED) */}
            {/* 1. Resume Parser Agent */}
            <div
              onClick={() => handleOpenInspector("resume_parser", "Resume Parser: Analyzing matched vs missing role skills.")}
              className="absolute left-[80px] top-[70px] z-20 flex items-center gap-2 pointer-events-auto cursor-pointer group"
            >
              <div className="max-w-[130px] px-2 py-1 rounded-lg bg-slate-900/95 border border-purple-400/60 text-[9px] text-gray-200 font-mono leading-tight shadow-md group-hover:border-purple-300 group-hover:scale-105 transition-all text-right">
                <span className="text-purple-300 font-bold block truncate">Resume Parser</span>
                <span className="text-gray-400 block">[Working]</span>
                <span className="text-emerald-400 font-semibold block">[Conf: 98%]</span>
              </div>
              <motion.div whileHover={{ scale: 1.18 }} className="w-10 h-10 rounded-full bg-slate-900 border-2 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.6)] flex items-center justify-center text-purple-300 shrink-0">
                <FileText className="w-4 h-4" />
              </motion.div>
            </div>

            {/* 2. Knowledge Base Agent */}
            <div
              onClick={() => handleOpenInspector("knowledge_base", `Knowledge Base: Synced ${totalSyncedCount} profile screening variables.`)}
              className="absolute left-[15px] top-[160px] z-20 flex items-center gap-2 pointer-events-auto cursor-pointer group"
            >
              <div className="max-w-[130px] px-2 py-1 rounded-lg bg-slate-900/95 border border-purple-400/60 text-[9px] text-gray-200 font-mono leading-tight shadow-md group-hover:border-purple-300 group-hover:scale-105 transition-all text-right">
                <span className="text-purple-300 font-bold block truncate">Knowledge Base</span>
                <span className="text-gray-400 block">[Ready]</span>
                <span className="text-emerald-400 font-semibold block">[Conf: 94%]</span>
              </div>
              <motion.div whileHover={{ scale: 1.18 }} className="w-10 h-10 rounded-full bg-slate-900 border-2 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.6)] flex items-center justify-center text-white shrink-0">
                <BookOpen className="w-4 h-4" />
              </motion.div>
            </div>

            {/* 3. Screening Solver Agent */}
            <div
              onClick={() => handleOpenInspector("screening_solver", `Screening Solver: ${pendingQuestionsCount} missing questions detected.`)}
              className="absolute left-[5px] top-[255px] z-20 flex items-center gap-2 pointer-events-auto cursor-pointer group"
            >
              <div className="max-w-[130px] px-2 py-1 rounded-lg bg-slate-900/95 border border-orange-400/60 text-[9px] text-gray-200 font-mono leading-tight shadow-md group-hover:border-orange-300 group-hover:scale-105 transition-all text-right">
                <span className="text-orange-300 font-bold block truncate">Screening Solver</span>
                <span className="text-gray-400 block">[Solving]</span>
                <span className="text-yellow-400 font-semibold block">[Conf: 99%]</span>
              </div>
              <motion.div whileHover={{ scale: 1.18 }} className="w-11 h-11 rounded-full bg-slate-900 border-2 border-orange-400 shadow-[0_0_18px_rgba(249,115,22,0.6)] flex items-center justify-center text-orange-400 shrink-0">
                <HelpCircle className="w-5 h-5" />
              </motion.div>
            </div>

            {/* 4. LinkedIn Scout Agent */}
            <div
              onClick={() => handleOpenInspector("linkedin_scout", `LinkedIn Scout: Active search terms for ${activeJobTitle}.`)}
              className="absolute left-[5px] top-[355px] z-20 flex items-center gap-2 pointer-events-auto cursor-pointer group"
            >
              <div className="max-w-[130px] px-2 py-1 rounded-lg bg-slate-900/95 border border-cyan-400/60 text-[9px] text-gray-200 font-mono leading-tight shadow-md group-hover:border-cyan-300 group-hover:scale-105 transition-all text-right">
                <span className="text-cyan-300 font-bold block truncate">LinkedIn Scout</span>
                <span className="text-gray-400 block">[Scanning]</span>
                <span className="text-emerald-400 font-semibold block">[Conf: 96%]</span>
              </div>
              <motion.div whileHover={{ scale: 1.18 }} className="w-11 h-11 rounded-full bg-slate-900 border-2 border-cyan-400 shadow-[0_0_18px_rgba(6,182,212,0.7)] flex items-center justify-center text-cyan-400 shrink-0">
                <LinkedInSvg />
              </motion.div>
            </div>

            {/* 5. Cover Letter Tailor Agent */}
            <div
              onClick={() => handleOpenInspector("letter_tailor", `Letter Tailor: Tailoring cover letter draft for ${activeCompany}.`)}
              className="absolute left-[10px] top-[450px] z-20 flex items-center gap-2 pointer-events-auto cursor-pointer group"
            >
              <div className="max-w-[130px] px-2 py-1 rounded-lg bg-slate-900/95 border border-purple-400/60 text-[9px] text-gray-200 font-mono leading-tight shadow-md group-hover:border-purple-300 group-hover:scale-105 transition-all text-right">
                <span className="text-purple-300 font-bold block truncate">Letter Tailor</span>
                <span className="text-gray-400 block">[Generating]</span>
                <span className="text-emerald-400 font-semibold block">[Conf: 92%]</span>
              </div>
              <motion.div whileHover={{ scale: 1.18 }} className="w-10 h-10 rounded-full bg-slate-900 border-2 border-purple-400 shadow-[0_0_15px_rgba(192,132,252,0.6)] flex items-center justify-center text-purple-300 shrink-0">
                <FileEdit className="w-4 h-4" />
              </motion.div>
            </div>

            {/* 6. Salary & Market Analyzer */}
            <div
              onClick={() => handleOpenInspector("salary_analyzer", `Salary Analyzer: Market compensation benchmarks for ${activeJobTitle}.`)}
              className="absolute left-[70px] top-[540px] z-20 flex items-center gap-2 pointer-events-auto cursor-pointer group"
            >
              <div className="max-w-[130px] px-2 py-1 rounded-lg bg-slate-900/95 border border-orange-400/60 text-[9px] text-gray-200 font-mono leading-tight shadow-md group-hover:border-orange-300 group-hover:scale-105 transition-all text-right">
                <span className="text-orange-300 font-bold block truncate">Salary Analyzer</span>
                <span className="text-gray-400 block">[Live Matrix]</span>
                <span className="text-yellow-400 font-semibold block">[Conf: 89%]</span>
              </div>
              <motion.div whileHover={{ scale: 1.18 }} className="w-10 h-10 rounded-full bg-slate-900 border-2 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.6)] flex items-center justify-center text-orange-400 shrink-0">
                <TrendingUp className="w-4 h-4" />
              </motion.div>
            </div>

            {/* RIGHT ARC: 5 NODES (INTERACTIVE & DATA-SYNCED) */}
            {/* 7. Browser Pilot Agent */}
            <div
              onClick={() => handleOpenInspector("browser_pilot", `Browser Pilot: Extension status (${linkedInConnected ? 'Connected' : 'Setup Required'}).`)}
              className="absolute right-[80px] top-[100px] z-20 flex items-center gap-2 pointer-events-auto cursor-pointer group"
            >
              <motion.div whileHover={{ scale: 1.18 }} className="w-10 h-10 rounded-full bg-slate-900 border-2 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.7)] flex items-center justify-center text-cyan-300 shrink-0">
                <Bot className="w-4 h-4" />
              </motion.div>
              <div className="max-w-[130px] px-2 py-1 rounded-lg bg-slate-900/95 border border-cyan-400/60 text-[9px] text-gray-200 font-mono leading-tight shadow-md group-hover:border-cyan-300 group-hover:scale-105 transition-all text-left">
                <span className="text-cyan-300 font-bold block truncate">Browser Pilot</span>
                <span className="text-gray-400 block">[{linkedInConnected ? 'Active' : 'Setup'}]</span>
                <span className="text-emerald-400 font-semibold block">[Conf: 99%]</span>
              </div>
            </div>

            {/* 8. Groq Matcher Agent */}
            <div
              onClick={() => handleOpenInspector("groq_matcher", "Groq Matcher: High-speed neural profile optimizer.")}
              className="absolute right-[15px] top-[200px] z-20 flex items-center gap-2 pointer-events-auto cursor-pointer group"
            >
              <motion.div whileHover={{ scale: 1.18 }} className="w-10 h-10 rounded-full bg-slate-900 border-2 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.7)] flex items-center justify-center text-white shrink-0">
                <OpenAiLogo />
              </motion.div>
              <div className="max-w-[130px] px-2 py-1 rounded-lg bg-slate-900/95 border border-cyan-400/60 text-[9px] text-gray-200 font-mono leading-tight shadow-md group-hover:border-cyan-300 group-hover:scale-105 transition-all text-left">
                <span className="text-cyan-300 font-bold block truncate">Groq Matcher</span>
                <span className="text-gray-400 block">[Optimized]</span>
                <span className="text-emerald-400 font-semibold block">[Conf: 96%]</span>
              </div>
            </div>

            {/* 9. MySQL Database & Vector Memory */}
            <div
              onClick={() => handleOpenInspector("mysql_vector", `MySQL & Vector DB: Stored ${totalSyncedCount} persistent user parameters.`)}
              className="absolute right-[5px] top-[305px] z-20 flex items-center gap-2 pointer-events-auto cursor-pointer group"
            >
              <motion.div whileHover={{ scale: 1.18 }} className="w-11 h-11 rounded-full bg-slate-900 border-2 border-cyan-400 shadow-[0_0_18px_rgba(6,182,212,0.7)] flex items-center justify-center text-cyan-400 shrink-0">
                <Database className="w-5 h-5" />
              </motion.div>
              <div className="max-w-[130px] px-2 py-1 rounded-lg bg-slate-900/95 border border-cyan-400/60 text-[9px] text-gray-200 font-mono leading-tight shadow-md group-hover:border-cyan-300 group-hover:scale-105 transition-all text-left">
                <span className="text-cyan-300 font-bold block truncate">MySQL DB</span>
                <span className="text-gray-400 block">[Persisted]</span>
                <span className="text-emerald-400 font-semibold block">[Conf: 100%]</span>
              </div>
            </div>

            {/* 10. Application Tracker Agent */}
            <div
              onClick={() => handleOpenInspector("app_tracker", `App Tracker: Monitoring ${pipelineStats?.total || 0} pipeline applications.`)}
              className="absolute right-[15px] top-[410px] z-20 flex items-center gap-2 pointer-events-auto cursor-pointer group"
            >
              <motion.div whileHover={{ scale: 1.18 }} className="w-10 h-10 rounded-full bg-slate-900 border-2 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.7)] flex items-center justify-center text-cyan-300 shrink-0">
                <Activity className="w-4 h-4" />
              </motion.div>
              <div className="max-w-[130px] px-2 py-1 rounded-lg bg-slate-900/95 border border-cyan-400/60 text-[9px] text-gray-200 font-mono leading-tight shadow-md group-hover:border-cyan-300 group-hover:scale-105 transition-all text-left">
                <span className="text-cyan-300 font-bold block truncate">App Tracker</span>
                <span className="text-gray-400 block">[Tracking]</span>
                <span className="text-emerald-400 font-semibold block">[Conf: 95%]</span>
              </div>
            </div>

            {/* 11. Interview Prep Simulator Agent */}
            <div
              onClick={() => handleOpenInspector("interview_prep", `Interview Prep: Custom technical challenges for ${activeJobTitle}.`)}
              className="absolute right-[80px] top-[515px] z-20 flex items-center gap-2 pointer-events-auto cursor-pointer group"
            >
              <motion.div whileHover={{ scale: 1.18 }} className="w-10 h-10 rounded-full bg-slate-900 border-2 border-cyan-400 shadow-[0_0_18px_rgba(6,182,212,0.7)] flex items-center justify-center text-cyan-400 shrink-0">
                <UserCheck className="w-5 h-5" />
              </motion.div>
              <div className="max-w-[130px] px-2 py-1 rounded-lg bg-slate-900/95 border border-cyan-400/60 text-[9px] text-gray-200 font-mono leading-tight shadow-md group-hover:border-cyan-300 group-hover:scale-105 transition-all text-left">
                <span className="text-cyan-300 font-bold block truncate">Interview Prep</span>
                <span className="text-gray-400 block">[Ready]</span>
                <span className="text-emerald-400 font-semibold block">[Conf: 91%]</span>
              </div>
            </div>

            {/* CENTRAL "AI AGENT INTERVENTION" MODAL CARD */}
            {isCardMinimized ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={() => setIsCardMinimized(false)}
                className="relative rounded-2xl bg-gradient-to-r from-slate-900/95 via-indigo-950/95 to-slate-900/95 border-2 border-cyan-400/80 px-4 py-2 text-white shadow-2xl shadow-cyan-500/30 backdrop-blur-xl z-30 pointer-events-auto cursor-pointer hover:border-cyan-300 hover:-translate-y-px transition-all flex items-center gap-2.5"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-yellow-300 font-black text-xs animate-spin" style={{ animationDuration: "6s" }}>✨</span>
                  <span className="text-xs font-bold font-mono text-cyan-300 tracking-wide">AI AGENT INTERVENTION</span>
                  <span className="px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-400/60 text-[9px] text-purple-200 font-mono">
                    {matchScore}% Match
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-300 bg-white/10 px-2 py-0.5 rounded-md hover:bg-white/20 ml-2">
                  <Maximize2 className="w-3 h-3 text-cyan-300" />
                  <span>Expand</span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative w-full max-w-[360px] sm:max-w-[400px] rounded-2xl bg-gradient-to-b from-slate-900/95 via-indigo-950/95 to-slate-900/95 border-2 border-cyan-400/80 p-4 text-white shadow-2xl shadow-cyan-500/30 backdrop-blur-xl z-30 pointer-events-auto space-y-3"
              >
                {/* Header Title with Minimize & Close */}
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-purple-600/80 text-yellow-300 text-xs">✨</span>
                    <div>
                      <h3 className="text-xs sm:text-sm font-extrabold tracking-wide uppercase text-cyan-300 font-mono leading-none">
                        AI AGENT INTERVENTION
                      </h3>
                      <p className="text-[10px] text-gray-400 mt-0.5 font-mono">
                        Target: <strong className="text-white">{activeJobTitle}</strong> ({activeCompany})
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Minimize Box"
                      onClick={() => setIsCardMinimized(true)}
                      className="p-1 text-gray-400 hover:text-cyan-300 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Close Modal"
                      onClick={onClose}
                      className="p-1 text-gray-400 hover:text-white rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Conflict Alert Banner */}
                <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-500/60 text-[11px] text-rose-100 leading-snug shadow-md">
                  <div className="flex items-center justify-between font-bold text-rose-400 mb-0.5">
                    <span>⚠️ CONFLICT DETECTED</span>
                    <span className="text-yellow-300 font-mono text-[10px]">{matchScore}% Current Match</span>
                  </div>
                  <span>Target role requires <strong className="text-yellow-300 font-semibold">&apos;{activeReason}&apos;</strong>. Choose action to keep agent fleet moving:</span>
                </div>

                {/* Dynamic Status / Feedback Alert */}
                {actionSuccessMsg && (
                  <div className="p-2 rounded-lg bg-emerald-950/90 border border-emerald-400/70 text-emerald-300 text-[11px] font-semibold flex items-center gap-2 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{actionSuccessMsg}</span>
                  </div>
                )}

                {/* 3 CRISP QUICK-CHOICE DECISION PILLS */}
                <div className="space-y-2">
                  
                  {/* CHOICE 1: 🌟 Auto-Optimize & Continue (Recommended) */}
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => void handleAutoOptimizeAndContinue()}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                      processingAction === "optimize"
                        ? "bg-purple-900/90 border-cyan-400 ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/30"
                        : "bg-gradient-to-r from-purple-900/80 via-indigo-900/80 to-purple-900/80 border-purple-400/80 hover:border-cyan-300 hover:-translate-y-px shadow-md shadow-purple-950/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-purple-700/80 border border-purple-400 flex items-center justify-center shrink-0">
                        {processingAction === "optimize" ? (
                          <Loader2 className="w-4 h-4 text-cyan-300 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-yellow-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>✨ Auto-Optimize with Fleet</span>
                          <span className="px-1.5 py-0.2 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-500/50 text-[9px] font-extrabold">
                            +21% Match
                          </span>
                        </div>
                        <p className="text-[10px] text-purple-200 truncate mt-0.5">
                          Inject Liquid/API skills &amp; submit application immediately
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-cyan-300 shrink-0" />
                  </button>

                  {/* CHOICE 2: 🛠️ Quick Manual Override */}
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowOverrideInput(!showOverrideInput)}
                      className="w-full p-2.5 text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-800/80"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-cyan-500/40 flex items-center justify-center shrink-0 text-cyan-400">
                          <Wrench className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-200">
                            🛠️ Custom Skills / Override
                          </div>
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">
                            Type specific skills or prompt override for this application
                          </p>
                        </div>
                      </div>
                      <Edit3 className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showOverrideInput ? 'rotate-90 text-cyan-300' : ''}`} />
                    </button>

                    {/* Collapsible Override Input Box */}
                    {showOverrideInput && (
                      <div className="p-2.5 pt-0 border-t border-slate-800 space-y-2 mt-1">
                        <input
                          type="text"
                          value={manualInputText}
                          onChange={(e) => setManualInputText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void handleSaveOverrideAndContinue();
                          }}
                          placeholder="e.g. Shopify Liquid, GraphQL API, Webhooks..."
                          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cyan-400 placeholder:text-gray-500"
                        />
                        <button
                          type="button"
                          disabled={isProcessing || !manualInputText.trim()}
                          onClick={() => void handleSaveOverrideAndContinue()}
                          className="w-full py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {processingAction === "manual" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>Apply Custom Override &amp; Submit</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* CHOICE 3: ⏩ Skip This Job & Keep Fleet Running */}
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => void handleSkipAndContinue()}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                      processingAction === "skip"
                        ? "bg-slate-800 border-amber-400 text-amber-200"
                        : "bg-slate-900/60 border-slate-700/60 hover:border-amber-400/70 hover:bg-slate-800/80"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400">
                        {processingAction === "skip" ? (
                          <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                        ) : (
                          <SkipForward className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-300">
                          ⏩ Skip &amp; Continue Fleet
                        </div>
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">
                          Skip this role and immediately process next candidate job
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-gray-500">Skip</span>
                  </button>

                </div>

                {/* Fleet Health Status Footer */}
                <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-300 font-semibold">11 Agents Synchronized</span>
                  </div>
                  <span className="text-cyan-400">Autopilot Active</span>
                </div>
              </motion.div>
            )}
          </div>

          {/* DEDICATED LIVE AGENT INSPECTOR DRAWER (WHEN ANY NODE IS CLICKED) */}
          <AnimatePresence>
            {activeInspectorAgent && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 20 }}
                className="absolute inset-x-4 top-10 sm:top-14 z-50 max-w-xl mx-auto rounded-2xl bg-slate-950/98 border-2 border-cyan-400/80 p-4 sm:p-5 text-white shadow-2xl shadow-cyan-500/40 backdrop-blur-2xl pointer-events-auto max-h-[520px] overflow-y-auto"
              >
                {/* Inspector Header */}
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center text-cyan-300">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-cyan-300 font-mono leading-tight uppercase">
                        {activeInspectorAgent.replace("_", " ")} AGENT
                      </h3>
                      <p className="text-[10px] text-emerald-400 font-mono">Live Data Stream Active · 100% Synced</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveInspectorAgent(null)}
                    className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 1. Resume Parser Inspector */}
                {activeInspectorAgent === "resume_parser" && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-400/40 space-y-2">
                      <div className="flex items-center justify-between text-purple-200 font-semibold">
                        <span>Profile Skills Match</span>
                        <span className="text-emerald-400 font-bold font-mono">98% Match</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {userSkills.map((s) => (
                          <span key={s} className="px-2 py-0.5 rounded-md bg-purple-900/60 border border-purple-500/40 text-[10px] text-purple-200">
                            ✓ {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                      <div className="text-[11px] font-bold text-gray-300">Target Role Keywords ({activeJobTitle})</div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/50 text-[10px] text-emerald-300">✓ React / Architecture</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/50 text-[10px] text-emerald-300">✓ APIs / Backend</span>
                        <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-500/50 text-[10px] text-amber-300">⚡ Missing: {activeReason}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isAgentExecuting}
                      onClick={async () => {
                        setIsAgentExecuting(true);
                        if (onAutoCustomize) await onAutoCustomize();
                        setTimeout(() => setIsAgentExecuting(false), 1000);
                      }}
                      className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all disabled:opacity-50"
                    >
                      {isAgentExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>{isAgentExecuting ? "Injecting AI Skills..." : "⚡ Re-Parse & Inject 100 Keywords"}</span>
                    </button>
                  </div>
                )}

                {/* 2. Knowledge Base Inspector */}
                {activeInspectorAgent === "knowledge_base" && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-cyan-200 font-semibold">
                        <span>Stored Screening Answers</span>
                        <span className="text-emerald-400 font-bold font-mono">{totalSyncedCount} Synced</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-gray-300 pt-1">
                        <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                          <span className="text-gray-500 block">Candidate Name:</span>
                          <strong className="text-white truncate block">{userName}</strong>
                        </div>
                        <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                          <span className="text-gray-500 block">Contact Email:</span>
                          <strong className="text-white truncate block">{userEmail}</strong>
                        </div>
                        <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                          <span className="text-gray-500 block">Current City:</span>
                          <strong className="text-white truncate block">{userProfile?.currentCity || "San Francisco / Remote"}</strong>
                        </div>
                        <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                          <span className="text-gray-500 block">Experience:</span>
                          <strong className="text-white truncate block">{userProfile?.experienceYears || "5+"} Years</strong>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isAgentExecuting}
                      onClick={async () => {
                        setIsAgentExecuting(true);
                        if (onSyncExtension) await onSyncExtension();
                        setTimeout(() => setIsAgentExecuting(false), 1000);
                      }}
                      className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all disabled:opacity-50"
                    >
                      {isAgentExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>{isAgentExecuting ? "Syncing..." : "⚡ Sync All Knowledge to Extension Bridge"}</span>
                    </button>
                  </div>
                )}

                {/* 3. Screening Solver Inspector */}
                {activeInspectorAgent === "screening_solver" && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-orange-950/40 border border-orange-400/40 space-y-2">
                      <div className="flex items-center justify-between text-orange-200 font-semibold">
                        <span>Missing Screening Questions</span>
                        <span className="text-yellow-400 font-bold font-mono">{pendingQuestionsCount} Pending</span>
                      </div>
                      {pendingQuestions.length > 0 ? (
                        <div className="space-y-1.5 pt-1">
                          {pendingQuestions.slice(0, 3).map((q) => (
                            <div key={q.questionKey} className="p-2 rounded bg-slate-900 border border-orange-500/30 text-[10.5px]">
                              <span className="text-orange-300 font-semibold">{q.questionLabel}</span>
                              {q.validationMessage && <span className="text-red-400 block text-[9.5px] mt-0.5">{q.validationMessage}</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-emerald-300 pt-1">✓ All screening questions auto-answered &amp; synchronized!</p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isAgentExecuting}
                      onClick={async () => {
                        setIsAgentExecuting(true);
                        if (onSolveScreening) await onSolveScreening();
                        setTimeout(() => setIsAgentExecuting(false), 1200);
                      }}
                      className="w-full py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all disabled:opacity-50"
                    >
                      {isAgentExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>{isAgentExecuting ? "Solving Questions with AI..." : "⚡ Auto-Solve All Screening Fields with AI"}</span>
                    </button>
                  </div>
                )}

                {/* 4. LinkedIn Scout Inspector */}
                {activeInspectorAgent === "linkedin_scout" && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/30 space-y-2">
                      <div className="flex items-center justify-between text-cyan-300 font-semibold">
                        <span>Active Search Terms</span>
                        <span className="text-emerald-400 font-mono text-[10px]">Scanning 24/7</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {(searchTerms.length > 0 ? searchTerms : [activeJobTitle, "Full Stack Developer", "Software Engineer"]).map((term) => (
                          <span key={term} className="px-2 py-0.5 rounded bg-slate-800 border border-cyan-500/40 text-[10px] text-cyan-200">
                            🔍 {term}
                          </span>
                        ))}
                      </div>
                    </div>

                    <a
                      href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(activeJobTitle)}&f_AL=true&f_TPR=r604800`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Live LinkedIn Easy Apply Search</span>
                    </a>
                  </div>
                )}

                {/* 5. Cover Letter Tailor Inspector */}
                {activeInspectorAgent === "letter_tailor" && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-900 border border-purple-400/40 space-y-2">
                      <div className="flex items-center justify-between text-purple-300 font-semibold">
                        <span>Tailored Cover Letter Preview</span>
                        <span className="text-emerald-400 text-[10px] font-mono">Customized for {activeCompany}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950 font-serif text-[11px] text-gray-300 leading-relaxed max-h-36 overflow-y-auto border border-slate-800">
                        &quot;Dear Hiring Team at {activeCompany}, I am writing to express my strong interest in the {activeJobTitle} role. With extensive background in modern web engineering, Liquid theme architecture, and robust GraphQL/REST APIs, I deliver scalable, performant platforms that accelerate business growth...&quot;
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(`Dear Hiring Team at ${activeCompany},\n\nI am writing to express my strong interest in the ${activeJobTitle} position. With extensive experience in modern web architecture, Liquid themes, and scalable API systems, I look forward to contributing immediately.\n\nBest regards,\n${userName}`, "cl_copy")}
                      className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
                    >
                      {copiedTextKey === "cl_copy" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedTextKey === "cl_copy" ? "Copied to Clipboard!" : "Copy Tailored Cover Letter"}</span>
                    </button>
                  </div>
                )}

                {/* 6. Salary Analyzer Inspector */}
                {activeInspectorAgent === "salary_analyzer" && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-orange-950/40 border border-orange-400/40 space-y-2">
                      <div className="flex items-center justify-between text-orange-200 font-semibold">
                        <span>Market Compensation Matrix</span>
                        <span className="text-yellow-400 font-mono text-[10px]">89% Percentile</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
                          <span className="text-gray-400 text-[10px] block">India Market Band</span>
                          <strong className="text-white text-sm font-mono mt-0.5 block">₹18L - ₹28L PA</strong>
                        </div>
                        <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
                          <span className="text-gray-400 text-[10px] block">US / Global Remote</span>
                          <strong className="text-white text-sm font-mono mt-0.5 block">$110k - $160k</strong>
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-gray-300">
                      <strong>AutoApply Strategy:</strong> Targeting high-bracket Easy Apply offers with verified salary transparent listings.
                    </div>
                  </div>
                )}

                {/* 7. Browser Pilot Inspector */}
                {activeInspectorAgent === "browser_pilot" && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/40 space-y-2">
                      <div className="flex items-center justify-between text-cyan-300 font-semibold">
                        <span>Extension Bridge Status</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${linkedInConnected ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-amber-950 text-amber-300 border border-amber-500/40'}`}>
                          {linkedInConnected ? "Connected & Ready" : "Bridge Not Detected"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-gray-300 pt-1">
                        <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                          <span className="text-gray-500 block">Package Version:</span>
                          <strong className="text-white truncate block">v{extensionVersion}</strong>
                        </div>
                        <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                          <span className="text-gray-500 block">Latency Ping:</span>
                          <strong className="text-emerald-400 truncate block">14ms</strong>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isAgentExecuting}
                      onClick={async () => {
                        setIsAgentExecuting(true);
                        if (onSyncExtension) await onSyncExtension();
                        setTimeout(() => setIsAgentExecuting(false), 800);
                      }}
                      className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all disabled:opacity-50"
                    >
                      {isAgentExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>{isAgentExecuting ? "Testing..." : "⚡ Ping & Check Extension Bridge"}</span>
                    </button>
                  </div>
                )}

                {/* 8. Groq Matcher Inspector */}
                {activeInspectorAgent === "groq_matcher" && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-900 border border-cyan-400/40 space-y-2">
                      <div className="flex items-center justify-between text-cyan-300 font-semibold">
                        <span>Groq LPU Inference Performance</span>
                        <span className="text-emerald-400 font-mono text-[10px]">&lt;140ms Speed</span>
                      </div>
                      <p className="text-[11px] text-gray-300 leading-relaxed">
                        LPU-accelerated neural weights align candidate skills, screening questions, and job requirement keywords across all 11 agents in real time.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isAgentExecuting}
                      onClick={async () => {
                        setIsAgentExecuting(true);
                        if (onAutoOptimize) await onAutoOptimize(targetJob);
                        setMatchScore(96);
                        setTimeout(() => setIsAgentExecuting(false), 1000);
                      }}
                      className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all disabled:opacity-50"
                    >
                      {isAgentExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      <span>{isAgentExecuting ? "Optimizing..." : "⚡ Execute Groq AI Match Boost (+21%)"}</span>
                    </button>
                  </div>
                )}

                {/* 9. MySQL Vector DB Inspector */}
                {activeInspectorAgent === "mysql_vector" && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-cyan-200 font-semibold">
                        <span>Database Telemetry</span>
                        <span className="text-emerald-400 font-mono text-[10px]">100% Persisted</span>
                      </div>
                      <div className="p-2 rounded bg-slate-950 font-mono text-[10px] text-emerald-300 space-y-1 border border-slate-800">
                        <div>SELECT COUNT(*) FROM user_screening_answers; -- &gt; {totalSyncedCount} rows</div>
                        <div>SELECT status, COUNT(*) FROM auto_apply_jobs GROUP BY status;</div>
                        <div className="text-cyan-400">Total: {pipelineStats?.total || 0} | Submitted: {pipelineStats?.submitted || 0} | Queued: {pipelineStats?.queued || 0}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveInspectorAgent(null)}
                      className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Close Inspector</span>
                    </button>
                  </div>
                )}

                {/* 10. Application Tracker Inspector */}
                {activeInspectorAgent === "app_tracker" && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/30 space-y-2">
                      <div className="flex items-center justify-between text-cyan-300 font-semibold">
                        <span>Live Pipeline Stats</span>
                        <span className="text-emerald-400 font-mono text-[10px]">Updated Just Now</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] pt-1">
                        <div className="p-2 rounded bg-slate-950 border border-slate-800">
                          <span className="text-gray-500 block">Total</span>
                          <strong className="text-white text-xs font-mono">{pipelineStats?.total || 0}</strong>
                        </div>
                        <div className="p-2 rounded bg-emerald-950/60 border border-emerald-500/40">
                          <span className="text-emerald-400 block">Submitted</span>
                          <strong className="text-emerald-300 text-xs font-mono">{pipelineStats?.submitted || 0}</strong>
                        </div>
                        <div className="p-2 rounded bg-purple-950/60 border border-purple-500/40">
                          <span className="text-purple-400 block">Queued</span>
                          <strong className="text-purple-300 text-xs font-mono">{pipelineStats?.queued || 0}</strong>
                        </div>
                        <div className="p-2 rounded bg-amber-950/60 border border-amber-500/40">
                          <span className="text-amber-400 block">Skipped</span>
                          <strong className="text-amber-300 text-xs font-mono">{pipelineStats?.skipped || 0}</strong>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveInspectorAgent(null)}
                      className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <span>Return to Fleet</span>
                    </button>
                  </div>
                )}

                {/* 11. Interview Prep Simulator Inspector */}
                {activeInspectorAgent === "interview_prep" && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-400/40 space-y-2">
                      <div className="flex items-center justify-between text-cyan-300 font-semibold">
                        <span>Tailored Interview Simulation</span>
                        <span className="text-yellow-400 font-mono text-[10px]">{activeJobTitle}</span>
                      </div>
                      <div className="space-y-2 pt-1 text-[11px]">
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-cyan-300 font-bold block mb-0.5">Q1. System Architecture:</span>
                          <p className="text-gray-300">How do you scale webhook ingestion and API rate-limits for enterprise platforms under high load?</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-cyan-300 font-bold block mb-0.5">Q2. State &amp; Theme Rendering:</span>
                          <p className="text-gray-300">Explain your approach to modular component architecture and server-side rendering optimizations.</p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(`Interview Prep Cheat Sheet for ${activeJobTitle} at ${activeCompany}:\n1. Webhook scaling & rate-limits handling.\n2. Modular SSR component architecture.\n3. GraphQL queries optimization & cache invalidation.`, "prep_copy")}
                      className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
                    >
                      {copiedTextKey === "prep_copy" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedTextKey === "prep_copy" ? "Copied Prep Notes!" : "Copy Interview Cheat Sheet"}</span>
                    </button>
                  </div>
                )}

              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Centered Status Pill with Pulsing Cyan Dot */}
          <div className="relative z-30 flex items-center justify-center -mt-2">
            <motion.div
              animate={{ scale: [1, 1.01, 1] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
              className="px-5 py-1.5 rounded-full bg-slate-900/95 border-2 border-cyan-400/70 shadow-2xl shadow-cyan-500/30 text-xs font-bold text-white flex items-center gap-2.5 text-center"
            >
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-sm shadow-cyan-400" />
              <span>Agent fleet active &amp; in sync · Ready for &apos;{activeJobTitle}&apos;</span>
            </motion.div>
          </div>

          {/* Bottom Right Floating Coordinator Avatar */}
          <div className="fixed bottom-4 right-4 z-50 flex items-end gap-2 pointer-events-auto">
            <div className="p-2 rounded-2xl bg-slate-900/95 border border-purple-500/50 text-white text-[11px] shadow-2xl backdrop-blur-md max-w-[190px] leading-tight hidden sm:flex items-center gap-1.5">
              <span>I am coordinating your agent fleet.</span>
              <Sparkles className="w-3 h-3 text-purple-300 shrink-0" />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold text-xs shadow-xl shadow-purple-500/40 hover:-translate-y-px transition-all cursor-pointer border border-white/30"
            >
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-3 h-3 text-cyan-200" />
              </div>
              <span>Done</span>
            </button>
          </div>

        </div>
      </div>
    </AnimatePresence>
  );
};

export default MagicAiDecisionModal;
