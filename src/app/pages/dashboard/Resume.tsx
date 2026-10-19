import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router";
import { ExternalLink, Loader2, AlertCircle, CheckCircle2, UploadCloud, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import ResumeDataForm, { type ResumeFormData } from "../../components/resume/ResumeDataForm";
import ResumeTemplateCard, { TEMPLATES } from "../../components/resume/ResumeTemplateCard";
import ResumePreviewModal from "../../components/resume/ResumePreviewModal";
import {
  templateClassic,
  templateModern,
  templateProfessional,
  type ResumeData,
} from "../../../lib/resume-templates";

const TEMPLATE_FN: Record<string, (d: ResumeData) => string> = {
  classic: templateClassic,
  modern: templateModern,
  professional: templateProfessional,
};

type SkillCategory = "frontend" | "backend" | "other";

const SKILL_CATEGORIES: Array<{ category: SkillCategory; exact: string[]; partial: string[] }> = [
  {
    category: "frontend",
    exact: [
      "html", "html5", "css", "css3", "javascript", "js", "react", "react.js", "reactjs",
      "angular", "angular.js", "angularjs", "vue", "vue.js", "vuejs", "svelte", "solidjs",
      "typescript", "ts", "jquery", "bootstrap", "tailwind", "tailwindcss", "sass", "scss",
      "less", "webpack", "vite", "next.js", "nextjs", "nuxt", "nuxt.js", "gatsby", "redux",
      "mobx", "zustand", "recoil", "styled-components", "emotion", "material-ui", "mui",
      "chakra-ui", "chakra", "shadcn", "ant design", "antd", "figma", "responsive design",
      "html/css", "frontend", "front-end", "ui/ux", "ui design", "web design", "ux design",
      "flutter", "rect js", "rectjs", "dart", "dart/flutter", "react native", "expo",
      "storybook", "electron", "three.js", "d3.js", "chart.js", "gsap", "framer motion",
      "webgl", "canvas", "svg", "ajax", "fetch", "axios", "react query", "tanstack query",
      "react router", "nextui", "radix ui", "twin.macro", "postcss", "babel", "eslint",
      "prettier", "pwa", "progressive web app", "web assembly", "wasm",
    ],
    partial: [
      "html", "css", "react", "vue", "angular", "frontend", "ui/", "ui ", "ux ",
      "front.?end", "web.?design", "responsive", "bootstrap", "tailwind", "sass", "scss",
      "typescript", "javascript", "figma", "redux", "styled.?component", "material",
      "chakra", "shadcn", "next\\.?js", "gatsby", "svelte", "solid", "dart", "flutter",
      "react.?native", "electron",
    ],
  },
  {
    category: "backend",
    exact: [
      "node.js", "nodejs", "node", "node js", "express", "express.js", "expressjs",
      "django", "flask", "fastapi", "spring", "spring boot", "springboot", "laravel",
      "php", "ruby", "rails", "ruby on rails", "python", "java", "c#", "csharp",
      ".net", "asp.net", "asp.net core", "go", "golang", "rust", "kotlin", "scala",
      "graphql", "rest", "restful api", "restful", "restful apis", "rest apis",
      "rest api", "api", "microservices", "next.js api routes", "nextjs api",
      "prisma", "typeorm", "sequelize", "mongoose", "sql", "mysql", "postgresql",
      "postgres", "mongodb", "redis", "firebase", "supabase", "backend",
      "serverless", "lambda", "joomla", "shopify", "wordpress", "word press",
      "strapi", "sanity", "contentful", "hasura", "apollo", "trpc", "grpc",
      "rabbitmq", "kafka", "pub/sub", "websocket", "socket.io", "swagger",
      "postman", "insomnia", "jwt", "oauth", "saml", "ldap",
    ],
    partial: [
      "sql", "node", "php", "api", "backend", "laravel", "spring", "django",
      "express", "flask", "fastapi", "graphql", "rest", "microservice",
      "postgres", "mysql", "mongodb", "redis", "firebase", "supabase", "prisma",
      "typeorm", "sequelize", "serverless", "lambda", "joomla", "shopify",
      "wordpress", "strapi", "sanity", "hasura", "apollo", "trpc", "grpc",
      "rabbitmq", "kafka", "socket\\.?io", "websocket", "jwt", "oauth",
    ],
  },
  {
    category: "other",
    exact: [
      "git", "github", "gitlab", "bitbucket", "docker", "kubernetes", "k8s",
      "aws", "azure", "gcp", "google cloud", "google cloud platform",
      "ci/cd", "jenkins", "github actions", "gitlab ci", "vercel", "netlify",
      "heroku", "digitalocean", "terraform", "ansible", "puppet", "chef",
      "nginx", "apache", "linux", "unix", "bash", "shell", "powershell",
      "devops", "deployment", "testing", "qa", "jest", "mocha", "chai",
      "cypress", "playwright", "selenium", "puppeteer", "debugging",
      "problem-solving", "problem solving", "testing and qa", "deployment and devops",
      "problem-solving and debugging", "agile", "scrum", "jira", "confluence",
      "notion", "figma", "sketch", "adobe xd", "photoshop", "illustrator",
      "vscode", "visual studio", "intellij", "webstorm", "pycharm",
      "npm", "yarn", "pnpm", "bun", "gulp", "grunt", "rollup", "esbuild",
      "swr", "react-query", "tanstack query", "redux toolkit",
    ],
    partial: [
      "git", "devops", "deploy", "test", "qa", "debug", "problem",
      "docker", "kubernetes", "k8s", "aws", "azure", "gcp", "cloud",
      "ci/cd", "jenkins", "github.?actions", "vercel", "netlify", "heroku",
      "terraform", "ansible", "nginx", "apache", "linux", "bash", "shell",
      "agile", "scrum", "jira", "docker", "container",
    ],
  },
];

function categorizeSkills(skills: string[] | undefined): { frontend: string[]; backend: string[]; other: string[] } {
  const result: Record<SkillCategory, string[]> = { frontend: [], backend: [], other: [] };
  if (!Array.isArray(skills)) return result;
  for (const sk of skills) {
    const lower = sk.toLowerCase().trim();
    let assigned = false;
    for (const group of SKILL_CATEGORIES) {
      if (group.exact.some((keyword) => lower === keyword)) {
        result[group.category].push(sk);
        assigned = true;
        break;
      }
    }
    if (assigned) continue;
    for (const group of SKILL_CATEGORIES) {
      if (group.partial.some((pattern) => {
        const regex = new RegExp(`^${pattern}$`.replace(/\?/g, ".?"), "i");
        return regex.test(lower) || lower.includes(pattern.replace(/[.?]/g, ""));
      })) {
        result[group.category].push(sk);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      result.other.push(sk);
    }
  }
  return result;
}

function toResumeData(form: ResumeFormData): ResumeData {
  return {
    name: form.name || "Your Name",
    headline: form.headline || "Professional",
    email: form.email,
    phone: form.phone,
    currentCity: form.currentCity,
    linkedinUrl: form.linkedinUrl,
    portfolioUrl: form.portfolioUrl,
    summary: form.summary,
    skills: form.skills,
    experience: form.experience,
    projects: form.projects,
    education: form.education,
  };
}

const DEFAULT_FORM: ResumeFormData = {
  name: "",
  headline: "",
  email: "",
  phone: "",
  currentCity: "",
  linkedinUrl: "",
  portfolioUrl: "",
  summary: "",
  skills: { frontend: [], backend: [], other: [] },
  experience: [],
  projects: [],
  education: [],
};

export default function Resume() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<ResumeFormData>(DEFAULT_FORM);
  const [selectedTemplate, setSelectedTemplate] = useState("classic");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFactIndex, setUploadFactIndex] = useState(0);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewName, setPreviewName] = useState("");

  // Fetch resume data on mount
  useEffect(() => {
    async function load() {
      try {
        setError("");
        const res = await fetch("/api/user/resume");
        const json = await res.json();
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || "Failed to load resume data");
        }
        const { profile, parsed } = json.data;

        const parsedSkills = parsed?.skills;
        const skills = Array.isArray(parsedSkills)
          ? categorizeSkills(parsedSkills)
          : {
              frontend: Array.isArray(parsedSkills?.frontend) ? parsedSkills.frontend : [],
              backend: Array.isArray(parsedSkills?.backend) ? parsedSkills.backend : [],
              other: Array.isArray(parsedSkills?.other) ? parsedSkills.other : [],
            };

        setFormData({
          name: parsed?.name || profile?.name || "",
          headline: parsed?.headline || "",
          email: profile?.email || "",
          phone: profile?.phone || parsed?.phone || "",
          currentCity: profile?.currentCity || parsed?.city || "",
          linkedinUrl: profile?.linkedinUrl || parsed?.linkedinUrl || "",
          portfolioUrl: profile?.portfolioUrl || parsed?.portfolioUrl || "",
          summary: parsed?.summary || "",
          skills,
          experience: Array.isArray(parsed?.experience) ? parsed.experience : [],
          projects: Array.isArray(parsed?.projects) ? parsed.projects : [],
          education: Array.isArray(parsed?.education) ? parsed.education : [],
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load resume data");
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setError("");
      setIsSaving(true);
      const { name, headline, email, phone, currentCity, linkedinUrl, portfolioUrl, ...resumeFields } = formData;
      const payload = {
        ...resumeFields,
        name,
        headline,
        phone,
        currentCity,
        linkedinUrl,
        portfolioUrl,
      };

      const res = await fetch("/api/user/resume", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to save resume");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save resume");
    } finally {
      setIsSaving(false);
    }
  }, [formData]);

  const handlePreview = useCallback(
    (templateId: string) => {
      const fn = TEMPLATE_FN[templateId];
      if (!fn) return;
      const html = fn(toResumeData(formData));
      setPreviewHtml(html);
      setPreviewName(TEMPLATES.find((t) => t.id === templateId)?.name || templateId);
      setPreviewOpen(true);
    },
    [formData],
  );

  const handleDownload = useCallback(
    (templateId: string) => {
      const fn = TEMPLATE_FN[templateId];
      if (!fn) return;
      const html = fn(toResumeData(formData));
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Resume_${templateId}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [formData],
  );

  const handleResumeUpload = useCallback(async (file: File) => {
    try {
      setError("");
      setIsUploading(true);
      const form = new FormData();
      form.append("resume", file);
      const res = await fetch("/api/user/resume/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Upload failed");
      }

      const extracted = json?.data?.extracted || {};

      const skills = Array.isArray(extracted.skills)
        ? categorizeSkills(extracted.skills)
        : {
            frontend: Array.isArray(extracted.skills?.frontend) ? extracted.skills.frontend : [],
            backend: Array.isArray(extracted.skills?.backend) ? extracted.skills.backend : [],
            other: Array.isArray(extracted.skills?.other) ? extracted.skills.other : [],
          };

      setFormData((prev) => ({
        ...prev,
        name: extracted.name || prev.name,
        headline: extracted.headline || extracted.jobTitles?.[0] || prev.headline,
        email: extracted.email || prev.email,
        phone: extracted.phone || prev.phone,
        currentCity: extracted.city || extracted.currentCity || prev.currentCity,
        linkedinUrl: extracted.linkedinUrl || prev.linkedinUrl,
        portfolioUrl: extracted.portfolioUrl || prev.portfolioUrl,
        summary: extracted.summary || prev.summary,
        skills,
        experience: Array.isArray(extracted.experience) ? extracted.experience : prev.experience,
        projects: Array.isArray(extracted.projects) ? extracted.projects : prev.projects,
        education: Array.isArray(extracted.education) ? extracted.education : prev.education,
      }));

      await refreshUser();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }, [refreshUser]);

  const FUN_FACTS = useMemo(() => [
    "The first resume was written by Leonardo da Vinci in 1482.",
    "Recruiters spend an average of 6-8 seconds scanning a resume.",
    "ATS stands for Applicant Tracking System — 75% of resumes are rejected before a human sees them.",
    "The word 'resume' comes from French, meaning 'summary'.",
    "Using action verbs on your resume increases interview chances by 40%.",
    "LinkedIn has over 1 billion users worldwide.",
    "The ideal resume length is 1-2 pages — never more.",
    "85% of jobs are filled through networking, not applications.",
    "Adding quantifiable achievements to your resume makes it 3x more effective.",
    "The most common resume mistake is typos — 58% of recruiters reject on that alone.",
    "Gates, Jobs, and Zuckerberg all dropped out of college — but don't put that on your resume.",
    "A resume with a photo is 88% more likely to be rejected in the US.",
    "Customizing your resume per job increases interview chances by 50%.",
    "The first online resume was posted on the web in 1994.",
    "Google receives over 3 million applications per year.",
  ], []);

  useEffect(() => {
    if (!isUploading) return;
    const interval = setInterval(() => {
      setUploadFactIndex((prev) => (prev + 1) % FUN_FACTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isUploading, FUN_FACTS.length]);

  // Loading screen with quotes
  const QUOTES = useMemo(() => [
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Your resume is not a list of duties. It is a list of accomplishments.", author: "Unknown" },
    { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
    { text: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
    { text: "Your work is going to fill a large part of your life. Do what you love.", author: "Steve Jobs" },
    { text: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
    { text: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt" },
    { text: "The difference between ordinary and extraordinary is that little extra.", author: "Jimmy Johnson" },
  ], []);

  const [quoteIndex, setQuoteIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setProgress((prev) => Math.min(prev + Math.random() * 15, 92));
    }, 400);
    const quoteInterval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
    }, 3500);
    return () => {
      clearInterval(interval);
      clearInterval(quoteInterval);
    };
  }, [isLoading, QUOTES.length]);

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-6 text-center space-y-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-200">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-2">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 font-medium">Loading your resume data...</p>
          </div>
          <div className="min-h-[80px] flex items-center justify-center">
            <div className="space-y-1">
              <p className="text-base text-gray-700 italic leading-relaxed">
                &ldquo;{QUOTES[quoteIndex].text}&rdquo;
              </p>
              <p className="text-xs text-gray-400 font-medium">&mdash; {QUOTES[quoteIndex].author}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">Resume Builder</h1>
          <p className="text-xs text-gray-500 mt-0.5">Build ATS-friendly resumes with your profile data.</p>
        </div>
        <button
          onClick={() => navigate("/dashboard/onboarding")}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-semibold transition-colors"
        >
          Open Onboarding
        </button>
      </div>

      {/* Status messages */}
      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-2.5 text-xs text-green-700 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
          <span>Resume data saved successfully!</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700 font-medium">
          <AlertCircle className="w-3.5 h-3.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Resume Section */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleResumeUpload(file);
        }}
      />
      <div
        data-guide="resume-upload"
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`rounded-xl p-3.5 border cursor-pointer transition-all shadow-xs ${
          isUploading
            ? "border-purple-300 bg-purple-50/80"
            : "bg-white border-gray-200/80 hover:border-purple-300 hover:bg-purple-50/30 hover:shadow-sm"
        }`}
      >
        {isUploading ? (
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900">Uploading & parsing resume...</p>
                <p className="text-[11px] text-gray-500">Extracting skills, experience, and education</p>
              </div>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
            <p className="text-[11px] text-gray-500 italic text-center">
              Did you know? {FUN_FACTS[uploadFactIndex]}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 flex items-center justify-center shrink-0">
              <UploadCloud className="w-4.5 h-4.5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-900">Upload Resume to Auto-Fill</p>
              <p className="text-[11px] text-gray-500">PDF, DOCX, TXT · Max 5MB — Click to browse</p>
              {user?.resumeFileName && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Previously uploaded: <span className="font-medium text-gray-600">{user.resumeFileName}</span>
                </p>
              )}
            </div>
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 rounded-lg border border-purple-100">
              <UploadCloud className="w-3 h-3" />
              Choose File
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-5 gap-4 items-start">
        {/* Left Panel — Resume Data Editor */}
        <div className="lg:col-span-3 space-y-4">
          <ResumeDataForm
            data={formData}
            onChange={setFormData}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </div>

        {/* Right Panel — Templates */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200/80 shadow-xs">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 pb-1.5 border-b border-gray-100">ATS Templates</h2>
            <ResumeTemplateCard
              selected={selectedTemplate}
              onSelect={setSelectedTemplate}
              onPreview={handlePreview}
              onDownload={handleDownload}
            />
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-xl p-4 border border-gray-200/80 shadow-xs space-y-2.5">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Quick Links</h3>
            <a
              href="https://www.linkedin.com/jobs/search/?f_AL=true&f_TPR=r604800"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open LinkedIn Easy Apply Jobs
            </a>
            <div className="text-[11px] text-gray-500 leading-relaxed">
              Upload your resume on LinkedIn Easy Apply once. Future applies will reuse the latest attached resume.
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <ResumePreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        html={previewHtml}
        templateName={previewName}
        onDownload={() => {
          const templateId = TEMPLATES.find((t) => t.name === previewName)?.id || "classic";
          handleDownload(templateId);
        }}
      />
    </div>
  );
}
