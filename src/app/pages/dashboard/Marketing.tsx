"use client";

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";
import TemplateDesigner from "../../components/TemplateDesigner";
import {
  Mail,
  MessageSquare,
  Plus,
  Send,
  Calendar,
  Users,
  TrendingUp,
  BarChart2,
  Edit,
  Trash2,
  Play,
  Pause,
  RefreshCw,
  FileText,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  Smartphone,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "paused";
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  templateId: string | null;
  recipientList: string[];
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
  };
  _count?: {
    emails: number;
  };
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  category: string;
  isGlobal: boolean;
  createdAt: string;
}

interface WACampaign {
  id: string;
  name: string;
  message: string;
  contacts: string[];
  createdAt: number;
  sentCount: number;
}

type Channel = "email" | "whatsapp";

const WA_STORAGE_KEY = "whatsapp_campaigns";

function loadWACampaigns(): WACampaign[] {
  try {
    const raw = localStorage.getItem(WA_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWACampaigns(campaigns: WACampaign[]) {
  localStorage.setItem(WA_STORAGE_KEY, JSON.stringify(campaigns));
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return digits.slice(1);
  if (digits.startsWith("+")) return digits.slice(1);
  return digits;
}

export default function Marketing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const channel: Channel = location.pathname.endsWith("/whatsapp") ? "whatsapp" : "email";

  // Email state
  const [activeTab, setActiveTab] = useState<"campaigns" | "templates">("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [showRichEditor, setShowRichEditor] = useState(false);
  const [editorContent, setEditorContent] = useState("");

  const [newCampaign, setNewCampaign] = useState({
    name: "",
    subject: "",
    templateId: "",
    scheduledAt: "",
    recipientList: [] as string[],
    status: "draft" as const,
  });

  const [newTemplate, setNewTemplate] = useState({
    name: "",
    subject: "",
    htmlContent: "",
    textContent: "",
    category: "general",
  });

  const [recipientInput, setRecipientInput] = useState("");

  // WhatsApp state
  const [waCampaigns, setWACampaigns] = useState<WACampaign[]>([]);
  const [showNewWA, setShowNewWA] = useState(false);
  const [newWA, setNewWA] = useState({ name: "", message: "", contactsInput: "" });
  const [sendingWA, setSendingWA] = useState(false);
  const [waSendStatus, setWASendStatus] = useState("");

  // Extension state
  const [extInstalled, setExtInstalled] = useState(false);
  const [extState, setExtState] = useState<{ status: string; campaignId?: string; progress?: { current: number; total: number; contact: string } } | null>(null);
  const [extResults, setExtResults] = useState<Record<string, { successCount: number; failCount: number; results: Array<{ contact: string; success: boolean; error?: string }> }>>({});

  useEffect(() => {
    if (channel === "email") {
      void loadCampaigns();
      void loadTemplates();
    } else {
      setWACampaigns(loadWACampaigns());
    }
  }, [channel]);

  // Extension detection & message listener
  useEffect(() => {
    const bridge = document.getElementById("wa-extension-bridge");
    if (bridge?.dataset.installed === "true") {
      setExtInstalled(true);
    }

    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      const msg = event.data;

      if (msg.type === "wa_extension_ready") {
        setExtInstalled(true);
      }

      if (msg.type === "wa_extension_event" && msg.campaignId) {
        setExtState({
          status: msg.status || "sending",
          campaignId: msg.campaignId,
          progress: msg.current ? { current: msg.current, total: msg.total, contact: msg.contact || "" } : undefined,
        });

        if (msg.results) {
          setExtResults((prev) => ({
            ...prev,
            [msg.campaignId]: {
              successCount: msg.successCount,
              failCount: msg.failCount,
              results: msg.results,
            },
          }));
        }
      }

      if (msg.type === "wa_send_response") {
        if (msg.success) {
          setWASendStatus("Campaign sent to extension! Check the extension popup for progress.");
        } else {
          setWASendStatus(`Extension error: ${msg.error}`);
        }
        setSendingWA(false);
      }

      if (msg.type === "wa_extension_status_result" && msg.data) {
        setExtState(msg.data.state);
      }
    };

    window.addEventListener("message", handler);

    // Check for existing bridge (in case event fired before mount)
    setTimeout(() => {
      const b = document.getElementById("wa-extension-bridge");
      if (b?.dataset.installed === "true") setExtInstalled(true);
    }, 500);

    return () => window.removeEventListener("message", handler);
  }, []);

  const sendViaExtension = async (campaign: WACampaign) => {
    setSendingWA(true);
    setWASendStatus("Sending to extension...");
    window.postMessage(
      {
        type: "send_wa_campaign",
        campaign: {
          id: campaign.id,
          name: campaign.name,
          contacts: campaign.contacts,
          message: campaign.message,
        },
      },
      "*"
    );
  };

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/marketing/campaigns");
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error("Failed to load campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetch("/api/marketing/templates");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  };

  const createCampaign = async () => {
    try {
      const response = await fetch("/api/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCampaign),
      });
      if (response.ok) {
        await loadCampaigns();
        setShowNewCampaign(false);
        setNewCampaign({ name: "", subject: "", templateId: "", scheduledAt: "", recipientList: [], status: "draft" });
      }
    } catch (error) {
      console.error("Failed to create campaign:", error);
    }
  };

  const createTemplate = async () => {
    try {
      const response = await fetch("/api/marketing/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTemplate),
      });
      if (response.ok) {
        await loadTemplates();
        setShowNewTemplate(false);
        setShowRichEditor(false);
        setNewTemplate({ name: "", subject: "", htmlContent: "", textContent: "", category: "general" });
      }
    } catch (error) {
      console.error("Failed to create template:", error);
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Delete this campaign?")) return;
    try {
      const response = await fetch(`/api/marketing/campaigns?id=${id}`, { method: "DELETE" });
      if (response.ok) await loadCampaigns();
    } catch (error) {
      console.error("Failed to delete campaign:", error);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      const response = await fetch(`/api/marketing/templates?id=${id}`, { method: "DELETE" });
      if (response.ok) await loadTemplates();
    } catch (error) {
      console.error("Failed to delete template:", error);
    }
  };

  const addRecipient = () => {
    const emails = recipientInput
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));
    if (emails.length === 0) return;
    setNewCampaign((prev) => ({
      ...prev,
      recipientList: [...new Set([...prev.recipientList, ...emails])],
    }));
    setRecipientInput("");
  };

  const removeRecipient = (email: string) => {
    setNewCampaign((prev) => ({
      ...prev,
      recipientList: prev.recipientList.filter((e) => e !== email),
    }));
  };

  // WhatsApp functions
  const createWACampaign = () => {
    const contacts = newWA.contactsInput
      .split(/[\s,;]+/)
      .map((c) => c.trim())
      .filter((c) => c.length > 5);
    if (!newWA.name || !newWA.message || contacts.length === 0) return;

    const campaign: WACampaign = {
      id: Date.now().toString(),
      name: newWA.name,
      message: newWA.message,
      contacts,
      createdAt: Date.now(),
      sentCount: 0,
    };

    const updated = [campaign, ...waCampaigns];
    setWACampaigns(updated);
    saveWACampaigns(updated);
    setShowNewWA(false);
    setNewWA({ name: "", message: "", contactsInput: "" });
  };

  const deleteWACampaign = (id: string) => {
    if (!confirm("Delete this campaign?")) return;
    const updated = waCampaigns.filter((c) => c.id !== id);
    setWACampaigns(updated);
    saveWACampaigns(updated);
  };

  const sendWACampaign = useCallback(async (campaign: WACampaign) => {
    setSendingWA(true);
    setWASendStatus(`Starting WhatsApp for ${campaign.contacts.length} contacts...`);

    for (let i = 0; i < campaign.contacts.length; i++) {
      const contact = campaign.contacts[i];
      const phone = formatPhone(contact);
      const text = encodeURIComponent(campaign.message);
      const url = `https://wa.me/${phone}?text=${text}`;

      setWASendStatus(`Opening WhatsApp for contact ${i + 1}/${campaign.contacts.length}: ${contact}`);

      window.open(url, "_blank");

      if (i < campaign.contacts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    const updated = waCampaigns.map((c) =>
      c.id === campaign.id ? { ...c, sentCount: campaign.contacts.length } : c
    );
    setWACampaigns(updated);
    saveWACampaigns(updated);
    setWASendStatus("Done! WhatsApp tabs opened for each contact.");
    setSendingWA(false);
  }, [waCampaigns]);

  // Rich text helpers
  const insertTag = (tag: string) => {
    setEditorContent((prev) => prev + `<${tag}></${tag}>`);
  };

  const getStatusColor = (status: Campaign["status"]) => {
    const colors = {
      draft: "bg-gray-100 text-gray-700",
      scheduled: "bg-blue-100 text-blue-700",
      sending: "bg-yellow-100 text-yellow-700",
      sent: "bg-green-100 text-green-700",
      paused: "bg-orange-100 text-orange-700",
    };
    return colors[status] || colors.draft;
  };

  const getStatusIcon = (status: Campaign["status"]) => {
    const icons = {
      draft: FileText,
      scheduled: Clock,
      sending: Play,
      sent: CheckCircle,
      paused: Pause,
    };
    const Icon = icons[status] || FileText;
    return <Icon className="w-4 h-4" />;
  };

  const totalStats = campaigns.reduce(
    (acc, campaign) => ({
      sent: acc.sent + campaign.stats.sent,
      delivered: acc.delivered + campaign.stats.delivered,
      opened: acc.opened + campaign.stats.opened,
      clicked: acc.clicked + campaign.stats.clicked,
    }),
    { sent: 0, delivered: 0, opened: 0, clicked: 0 }
  );

  const openRate = totalStats.delivered > 0
    ? ((totalStats.opened / totalStats.delivered) * 100).toFixed(1)
    : "0";

  const clickRate = totalStats.opened > 0
    ? ((totalStats.clicked / totalStats.opened) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Marketing</h1>
          <p className="text-gray-600">
            Create and manage email and WhatsApp campaigns
          </p>
        </div>
        <button
          onClick={() => { if (channel === "email") { void loadCampaigns(); } else { setWACampaigns(loadWACampaigns()); } }}
          className="px-5 py-4 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Channel Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-200">
          <div className="flex gap-6 px-6">
            <button
              onClick={() => navigate("/dashboard/marketing/email")}
              className={`py-4 px-2 font-medium border-b-2 transition-colors flex items-center gap-2 ${
                channel === "email"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Mail className="w-5 h-5" />
              Email
            </button>
            <button
              onClick={() => navigate("/dashboard/marketing/whatsapp")}
              className={`py-4 px-2 font-medium border-b-2 transition-colors flex items-center gap-2 ${
                channel === "whatsapp"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              WhatsApp
            </button>
          </div>
        </div>

        <div className="p-6">
          {channel === "email" ? (
            <>
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <Mail className="w-8 h-8 text-purple-600" />
                    <span className="text-sm font-medium text-gray-500">Total Sent</span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">{totalStats.sent.toLocaleString()}</div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                    <span className="text-sm font-medium text-gray-500">Delivered</span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">{totalStats.delivered.toLocaleString()}</div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <Eye className="w-8 h-8 text-blue-600" />
                    <span className="text-sm font-medium text-gray-500">Open Rate</span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">{openRate}%</div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="w-8 h-8 text-orange-600" />
                    <span className="text-sm font-medium text-gray-500">Click Rate</span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">{clickRate}%</div>
                </div>
              </div>

              {/* Sub-tabs: Campaigns / Templates */}
              <div className="border-b border-gray-200 mb-6">
                <div className="flex gap-6">
                  <button
                    onClick={() => setActiveTab("campaigns")}
                    className={`py-3 px-2 font-medium border-b-2 transition-colors ${
                      activeTab === "campaigns"
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Campaigns ({campaigns.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("templates")}
                    className={`py-3 px-2 font-medium border-b-2 transition-colors ${
                      activeTab === "templates"
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Email Templates ({templates.length})
                  </button>
                </div>
              </div>

              {activeTab === "campaigns" ? (
                <div className="space-y-4">
                  {!showNewCampaign && (
                    <button
                      onClick={() => setShowNewCampaign(true)}
                      className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-purple-600 font-medium"
                    >
                      <Plus className="w-5 h-5" />
                      Create New Campaign
                    </button>
                  )}

                  {showNewCampaign && (
                    <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Plus className="w-5 h-5" />
                        New Email Campaign
                      </h3>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Campaign Name</label>
                        <input
                          type="text"
                          value={newCampaign.name}
                          onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="e.g., Welcome Series"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email Subject</label>
                        <input
                          type="text"
                          value={newCampaign.subject}
                          onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="e.g., Welcome to AutoApply CV!"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email Template</label>
                        <select
                          value={newCampaign.templateId}
                          onChange={(e) => setNewCampaign({ ...newCampaign, templateId: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="">Select a template</option>
                          {templates.map((template) => (
                            <option key={template.id} value={template.id}>{template.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Recipients</label>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={recipientInput}
                            onChange={(e) => setRecipientInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRecipient(); } }}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Enter email addresses..."
                          />
                          <button
                            onClick={addRecipient}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                          >
                            Add
                          </button>
                        </div>
                        {newCampaign.recipientList.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {newCampaign.recipientList.map((email) => (
                              <span key={email} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                                {email}
                                <button onClick={() => removeRecipient(email)} className="hover:text-red-600">&times;</button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Date (Optional)</label>
                        <input
                          type="datetime-local"
                          value={newCampaign.scheduledAt}
                          onChange={(e) => setNewCampaign({ ...newCampaign, scheduledAt: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => void createCampaign()}
                          className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold flex items-center justify-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          Create Campaign
                        </button>
                        <button
                          onClick={() => setShowNewCampaign(false)}
                          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {loading ? (
                    <div className="text-center py-12">
                      <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
                      <p className="text-gray-600">Loading campaigns...</p>
                    </div>
                  ) : campaigns.length === 0 && !showNewCampaign ? (
                    <div className="text-center py-12">
                      <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 mb-2">No campaigns yet</p>
                      <p className="text-sm text-gray-500">Create your first campaign to start engaging with your audience</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {campaigns.map((campaign) => (
                        <div key={campaign.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-bold text-gray-900">{campaign.name}</h3>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${getStatusColor(campaign.status)}`}>
                                  {getStatusIcon(campaign.status)}
                                  {campaign.status}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">
                                <strong>Subject:</strong> {campaign.subject}
                              </p>
                              {campaign.scheduledAt && (
                                <p className="text-sm text-gray-500 flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  Scheduled: {new Date(campaign.scheduledAt).toLocaleString()}
                                </p>
                              )}
                              <p className="text-xs text-gray-400">
                                {campaign.recipientList.length} recipient{campaign.recipientList.length !== 1 ? "s" : ""}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => alert("Edit feature coming soon")}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => void deleteCampaign(campaign.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-6 gap-3 pt-4 border-t border-gray-100">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-900">{campaign.stats.sent}</div>
                              <div className="text-xs text-gray-500">Sent</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-900">{campaign.stats.delivered}</div>
                              <div className="text-xs text-gray-500">Delivered</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-900">{campaign.stats.opened}</div>
                              <div className="text-xs text-gray-500">Opened</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-900">{campaign.stats.clicked}</div>
                              <div className="text-xs text-gray-500">Clicked</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-900">{campaign.stats.bounced}</div>
                              <div className="text-xs text-gray-500">Bounced</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-900">{campaign.stats.unsubscribed}</div>
                              <div className="text-xs text-gray-500">Unsub</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {!showNewTemplate && (
                    <button
                      onClick={() => setShowNewTemplate(true)}
                      className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-purple-600 font-medium"
                    >
                      <Plus className="w-5 h-5" />
                      Create New Template
                    </button>
                  )}

                  {showNewTemplate && (
                    <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Plus className="w-5 h-5" />
                        New Email Template
                      </h3>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Template Name</label>
                        <input
                          type="text"
                          value={newTemplate.name}
                          onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="e.g., Welcome Email"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Subject Line</label>
                        <input
                          type="text"
                          value={newTemplate.subject}
                          onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="e.g., Welcome to AutoApply CV!"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                        <select
                          value={newTemplate.category}
                          onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="general">General</option>
                          <option value="welcome">Welcome</option>
                          <option value="promotional">Promotional</option>
                          <option value="newsletter">Newsletter</option>
                          <option value="transactional">Transactional</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Template Designer</label>
                        <TemplateDesigner
                          initialHtml={newTemplate.htmlContent}
                          onHtmlChange={(html) => {
                            setNewTemplate({ ...newTemplate, htmlContent: html });
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Plain Text Content</label>
                        <textarea
                          value={newTemplate.textContent}
                          onChange={(e) => setNewTemplate({ ...newTemplate, textContent: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          rows={6}
                          placeholder="Plain text version for email clients that don't support HTML..."
                        />
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => void createTemplate()}
                          className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold flex items-center justify-center gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          Create Template
                        </button>
                        <button
                          onClick={() => { setShowNewTemplate(false); setShowRichEditor(false); }}
                          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {templates.length === 0 && !showNewTemplate ? (
                    <div className="text-center py-12">
                      <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 mb-2">No templates yet</p>
                      <p className="text-sm text-gray-500">Create your first email template to use in campaigns</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {templates.map((template) => (
                        <div key={template.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-lg font-bold text-gray-900">{template.name}</h3>
                                {template.isGlobal && (
                                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">Global</span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-2">
                                <strong>Subject:</strong> {template.subject}
                              </p>
                              <p className="text-xs text-gray-500 capitalize">Category: {template.category}</p>
                            </div>
                            {!template.isGlobal && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => alert("Edit feature coming soon")}
                                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => void deleteTemplate(template.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => alert(template.htmlContent.slice(0, 500))}
                            className="w-full mt-3 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            Preview Content
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* WhatsApp Channel */
            <div className="space-y-4">
              {/* WhatsApp Info Banner */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">WhatsApp Campaigns</p>
                  <p className="text-xs text-green-700 mt-1">
                    Create a message campaign and send it to your contacts via WhatsApp.
                    {extInstalled
                      ? " Use the Extension button for auto-send with delivery tracking."
                      : ' Click "Send All" to open each contact in WhatsApp Web, or install the companion extension for auto-send.'}
                  </p>
                </div>
              </div>
              {!extInstalled && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                  <span className="text-amber-600 text-sm">💡</span>
                  <p className="text-xs text-amber-800">
                    Install the <strong>WhatsApp Campaign Extension</strong> to auto-send messages and track delivery. 
                    Load the <code className="bg-amber-100 px-1 rounded">whatsapp-extension/</code> folder in <code className="bg-amber-100 px-1 rounded">chrome://extensions</code> (Developer mode).
                  </p>
                </div>
              )}

              {/* New WhatsApp Campaign */}
              {!showNewWA && (
                <button
                  onClick={() => setShowNewWA(true)}
                  className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-green-500 hover:bg-green-50 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-green-600 font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Create WhatsApp Campaign
                </button>
              )}

              {showNewWA && (
                <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    New WhatsApp Campaign
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Campaign Name</label>
                    <input
                      type="text"
                      value={newWA.name}
                      onChange={(e) => setNewWA({ ...newWA, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="e.g., Product Launch Announcement"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                    <textarea
                      value={newWA.message}
                      onChange={(e) => setNewWA({ ...newWA, message: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      rows={5}
                      placeholder="Hi {name}, check out our latest offer..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Tip: Use {'{name}'} as a placeholder. You'll need to replace it manually when sending.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Numbers <span className="text-gray-400 font-normal">(one per line, with country code)</span>
                    </label>
                    <textarea
                      value={newWA.contactsInput}
                      onChange={(e) => setNewWA({ ...newWA, contactsInput: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      rows={4}
                      placeholder={`+1234567890\n+1987654321\n+1123456789`}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={createWACampaign}
                      disabled={!newWA.name || !newWA.message || !newWA.contactsInput.trim()}
                      className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FileText className="w-4 h-4" />
                      Create Campaign
                    </button>
                    <button
                      onClick={() => setShowNewWA(false)}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* WhatsApp Campaigns List */}
              {waSendStatus && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800 flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 ${sendingWA ? "animate-spin" : ""}`} />
                  {waSendStatus}
                </div>
              )}

              {waCampaigns.length === 0 && !showNewWA ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">No WhatsApp campaigns yet</p>
                  <p className="text-sm text-gray-500">Create your first WhatsApp campaign to send messages to your contacts</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {waCampaigns.map((campaign) => (
                    <div key={campaign.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-gray-900">{campaign.name}</h3>
                            {(() => {
                              const extRes = extResults[campaign.id];
                              if (extRes) {
                                const total = extRes.successCount + extRes.failCount;
                                return (
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${extRes.failCount === 0 ? "bg-green-100 text-green-700" : extRes.failCount > 0 && extRes.successCount > 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                                    {extRes.successCount}/{total} Sent
                                  </span>
                                );
                              }
                              if (extState?.campaignId === campaign.id) {
                                return (
                                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                    {extState.progress ? `${extState.progress.current}/${extState.progress.total}` : "Sending"}
                                  </span>
                                );
                              }
                              return (
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                  {campaign.sentCount > 0 ? `${campaign.sentCount} Sent` : "Ready"}
                                </span>
                              );
                            })()}
                          </div>
                          <p className="text-sm text-gray-600 mb-1 line-clamp-2">{campaign.message}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {campaign.contacts.length} contact{campaign.contacts.length !== 1 ? "s" : ""}
                            </span>
                            <span>
                              Created {new Date(campaign.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          {campaign.contacts.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                                Show contacts
                              </summary>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {campaign.contacts.map((contact, i) => (
                                  <span key={i} className="text-xs bg-gray-100 px-2 py-0.5 rounded">{contact}</span>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => void sendWACampaign(campaign)}
                              disabled={sendingWA}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Send className="w-4 h-4" />
                              Send All
                            </button>
                            {extInstalled && (
                              <button
                                onClick={() => void sendViaExtension(campaign)}
                                disabled={sendingWA}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Send using the WhatsApp Campaign extension (auto-send)"
                              >
                                <Send className="w-4 h-4" />
                                Ext
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const first = campaign.contacts[0];
                                if (first) {
                                  const phone = formatPhone(first);
                                  const text = encodeURIComponent(campaign.message);
                                  window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
                                }
                              }}
                              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm flex items-center gap-2"
                              title="Test send to first contact"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Test
                            </button>
                            <button
                              onClick={() => {
                                const text = encodeURIComponent(campaign.message);
                                navigator.clipboard.writeText(`https://wa.me/PHONENUMBER?text=${text}`);
                                alert("Link copied! Replace PHONENUMBER with the actual number.");
                              }}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Copy wa.me link"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteWACampaign(campaign.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {extResults[campaign.id] && (
                            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                              {extResults[campaign.id].results.map((r, i) => (
                                <span key={i} className={`inline-flex items-center gap-1 mr-2 ${r.success ? "text-green-600" : "text-red-600"}`}>
                                  {r.success ? "✓" : "✗"} {r.contact}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
