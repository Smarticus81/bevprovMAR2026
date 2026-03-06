import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getToolsForAgentType } from "@/lib/agentTools";
import type { Agent, AgentConfig, ExternalDbConfig, RagConfig, RagDocument } from "@shared/schema";
import { AGENT_TYPE_LABELS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { VoiceTestPanel } from "@/components/VoiceTestPanel";
import { motion } from "framer-motion";
import {
  Loader2, Save, ArrowLeft, CheckCircle2,
  Mic, Wrench, Settings2, PlayCircle, ExternalLink, Plug,
  Database, Globe, FileText, Upload, X, Trash2, Volume2
} from "lucide-react";

const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
];

const TABS = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "voice", label: "Voice", icon: Mic },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "test", label: "Test", icon: PlayCircle },
] as const;

type TabId = (typeof TABS)[number]["id"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AgentBuilder() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("general");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [voice, setVoice] = useState("alloy");
  const [language, setLanguage] = useState("en");
  const [speed, setSpeed] = useState(1);
  const [greeting, setGreeting] = useState("");
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [maxConversationLength, setMaxConversationLength] = useState(10);
  const [isActive, setIsActive] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [wakeWordPhrase, setWakeWordPhrase] = useState("hey bev");
  const [wakeWordEndPhrases, setWakeWordEndPhrases] = useState("goodbye, we are done, that's all, thank you that's it");
  const [wakeWordShutdownPhrases, setWakeWordShutdownPhrases] = useState("stop listening, shut down, terminate");
  const [levenshteinThreshold, setLevenshteinThreshold] = useState(2);

  const [externalDbEnabled, setExternalDbEnabled] = useState(false);
  const [externalDbType, setExternalDbType] = useState<ExternalDbConfig["type"]>("supabase");
  const [externalDbConnectionString, setExternalDbConnectionString] = useState("");
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [ragMaxResults, setRagMaxResults] = useState(5);
  const [fileUploadEnabled, setFileUploadEnabled] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: ["agents", id],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Agent not found");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery<RagDocument[]>({
    queryKey: ["agents", id, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${id}/documents`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    enabled: !!id && ragEnabled,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/agents/${id}/documents`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", id, "documents"] });
      toast({ title: "Uploaded", description: "Document uploaded successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Upload Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("DELETE", `/api/agents/${id}/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", id, "documents"] });
      toast({ title: "Deleted", description: "Document removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleFileDrop = useCallback((files: FileList | null) => {
    if (!files) return;
    const allowed = [".txt", ".md", ".csv", ".json"];
    const maxSize = 5 * 1024 * 1024;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!allowed.includes(ext)) {
        toast({ title: "Invalid file type", description: `${file.name} is not supported. Use .txt, .md, .csv, or .json`, variant: "destructive" });
        continue;
      }
      if (file.size > maxSize) {
        toast({ title: "File too large", description: `${file.name} exceeds 5MB limit.`, variant: "destructive" });
        continue;
      }
      uploadMutation.mutate(file);
    }
  }, [uploadMutation, toast]);

  useEffect(() => {
    if (agent) {
      setName(agent.name || "");
      setDescription(agent.description || "");
      const c = agent.config as AgentConfig | null;
      setVoice(c?.voice || "alloy");
      setLanguage(c?.language || "en");
      setSpeed(c?.speed || 1);
      setGreeting(c?.greeting || "");
      setFallbackMessage(c?.fallbackMessage || "");
      setMaxConversationLength(c?.maxConversationLength || 10);
      setIsActive(agent.status === "active");
      setExternalDbEnabled(c?.externalDb?.enabled || false);
      setExternalDbType(c?.externalDb?.type || "supabase");
      setExternalDbConnectionString(c?.externalDb?.connectionString || "");
      setMcpEnabled(c?.mcpEnabled || false);
      setRagEnabled(c?.rag?.enabled || false);
      setRagMaxResults(c?.rag?.maxResults || 5);
      setFileUploadEnabled(c?.fileUploadEnabled || false);
      if (c?.wakeWord) {
        setWakeWordEnabled(c.wakeWord.enabled ?? false);
        setWakeWordPhrase(c.wakeWord.phrase || "hey bev");
        setWakeWordEndPhrases(c.wakeWord.endPhrases?.join(", ") || "goodbye, we are done, that's all, thank you that's it");
        setWakeWordShutdownPhrases(c.wakeWord.shutdownPhrases?.join(", ") || "stop listening, shut down, terminate");
        setLevenshteinThreshold(c.wakeWord.levenshteinThreshold ?? 2);
      }
    }
  }, [agent]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/agents/${id}`, {
        name,
        description,
        status: isActive ? "active" : "draft",
        config: {
          voice, language, speed, greeting, fallbackMessage, maxConversationLength,
          externalDb: {
            enabled: externalDbEnabled,
            type: externalDbType,
            connectionString: externalDbConnectionString,
          },
          mcpEnabled,
          rag: {
            enabled: ragEnabled,
            maxResults: ragMaxResults,
          },
          fileUploadEnabled,
          wakeWord: {
            enabled: wakeWordEnabled,
            phrase: wakeWordPhrase,
            endPhrases: wakeWordEndPhrases.split(',').map(s => s.trim()).filter(Boolean),
            shutdownPhrases: wakeWordShutdownPhrases.split(',').map(s => s.trim()).filter(Boolean),
            levenshteinThreshold,
          },
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast({ title: "Saved", description: "Agent configuration saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50 mb-4" data-testid="text-agent-not-found">Agent not found</p>
          <Link href="/dashboard" className="text-white/70 hover:text-white text-sm underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const availableTools = getToolsForAgentType(agent.type);
  const toolsByCategory = availableTools.reduce<Record<string, typeof availableTools>>((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category].push(tool);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <button className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors" data-testid="link-back-dashboard">
                <ArrowLeft size={16} />
                Back
              </button>
            </Link>
            <div className="h-5 w-px bg-white/10" />
            <div>
              <h1 className="text-base font-semibold" data-testid="text-agent-name-header">{name || "Untitled Agent"}</h1>
              <p className="text-xs text-white/40">{AGENT_TYPE_LABELS[agent.type as keyof typeof AGENT_TYPE_LABELS] || agent.type}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              data-testid="switch-activate"
              onClick={() => { setIsActive(!isActive); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                isActive ? "border border-green-500/30 text-green-400 bg-transparent" : "border border-white/10 text-white/40 bg-transparent"
              }`}
            >
              {isActive ? "Active" : "Draft"}
            </button>
            <button
              data-testid="button-save-agent"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 border border-white/20 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-white hover:text-black disabled:opacity-50 transition-all duration-300"
            >
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
            <Link href={`/app/${id}`}>
              <button
                data-testid="button-launch-agent"
                className="flex items-center gap-2 border border-white/20 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-white hover:text-black transition-all duration-300"
              >
                <ExternalLink size={14} />
                Launch
              </button>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                data-testid={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                  activeTab === tab.id
                    ? "border border-white/30 text-white bg-white/[0.06]"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "general" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-6">
              <h2 className="text-lg font-semibold text-white/90">General</h2>
              <div className="space-y-2">
                <label className="text-sm text-white/40 block">Agent Name</label>
                <input
                  data-testid="input-agent-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Front Bar POS"
                  className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/40 block">Description</label>
                <textarea
                  data-testid="input-agent-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this agent handles..."
                  rows={3}
                  className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/40 block">Greeting Message</label>
                <textarea
                  data-testid="input-greeting"
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder="Hi! How can I help you today?"
                  rows={2}
                  className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/40 block">Fallback Message</label>
                <textarea
                  data-testid="input-fallback-message"
                  value={fallbackMessage}
                  onChange={(e) => setFallbackMessage(e.target.value)}
                  placeholder="Sorry, I didn't catch that. Could you say it again?"
                  rows={2}
                  className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Wrench size={16} className="text-white/30" />
                <h2 className="text-lg font-semibold text-white/90">Included Tools</h2>
                <span className="text-xs text-white/30 ml-auto">{availableTools.length} tools auto-enabled</span>
              </div>
              <p className="text-sm text-white/30">
                These tools are automatically enabled based on your agent type.
              </p>
              {Object.entries(toolsByCategory).map(([category, tools]) => (
                <div key={category} className="space-y-1.5">
                  <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider">{category}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {tools.map((tool) => (
                      <div
                        key={tool.name}
                        data-testid={`info-tool-${tool.name}`}
                        className="flex items-center gap-2 p-3 rounded-xl border border-white/5 bg-transparent"
                      >
                        <CheckCircle2 size={14} className="text-white/30 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white/60 truncate">
                            {tool.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </p>
                          <p className="text-xs text-white/20 truncate">{tool.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 size={16} className="text-white/30" />
                  <h2 className="text-lg font-semibold text-white/90">Wake Word</h2>
                </div>
                <button
                  data-testid="toggle-wake-word"
                  onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                    wakeWordEnabled ? "border border-green-500/30 text-green-400 bg-transparent" : "border border-white/10 text-white/40 bg-transparent"
                  }`}
                >
                  {wakeWordEnabled ? "Enabled" : "Disabled"}
                </button>
              </div>
              <p className="text-sm text-white/30">
                Enable wake word detection to activate the agent hands-free using a voice trigger phrase.
              </p>
              {wakeWordEnabled && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-sm text-white/40 block">Wake Word Phrase</label>
                    <input
                      data-testid="input-wake-word-phrase"
                      value={wakeWordPhrase}
                      onChange={(e) => setWakeWordPhrase(e.target.value)}
                      placeholder="hey bev"
                      className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-white/40 block">End Phrases (comma-separated)</label>
                    <textarea
                      data-testid="input-wake-word-end-phrases"
                      value={wakeWordEndPhrases}
                      onChange={(e) => setWakeWordEndPhrases(e.target.value)}
                      placeholder="goodbye, we are done, that's all"
                      rows={2}
                      className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-white/40 block">Shutdown Phrases (comma-separated)</label>
                    <textarea
                      data-testid="input-wake-word-shutdown-phrases"
                      value={wakeWordShutdownPhrases}
                      onChange={(e) => setWakeWordShutdownPhrases(e.target.value)}
                      placeholder="stop listening, shut down, terminate"
                      rows={2}
                      className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-white/40">Levenshtein Threshold</label>
                      <span className="text-sm text-white/60 font-medium">{levenshteinThreshold}</span>
                    </div>
                    <input
                      data-testid="slider-levenshtein-threshold"
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={levenshteinThreshold}
                      onChange={(e) => setLevenshteinThreshold(Number(e.target.value))}
                      className="w-full accent-white"
                    />
                    <div className="flex justify-between text-xs text-white/20">
                      <span>Strict (1)</span>
                      <span>Flexible (5)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "voice" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-6">
              <h2 className="text-lg font-semibold text-white/90">Voice</h2>
              <div className="space-y-3">
                <label className="text-sm text-white/40 block">Voice Model</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {VOICES.map((v) => (
                    <button
                      key={v}
                      data-testid={`button-voice-${v}`}
                      onClick={() => setVoice(v)}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium text-center transition-all duration-300 ${
                        voice === v
                          ? "border border-white/30 text-white bg-white/[0.06]"
                          : "border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
                      }`}
                    >
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm text-white/40 block">Language</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.value}
                      data-testid={`button-language-${l.value}`}
                      onClick={() => setLanguage(l.value)}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium text-center transition-all duration-300 ${
                        language === l.value
                          ? "border border-white/30 text-white bg-white/[0.06]"
                          : "border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-white/40">Speech Speed</label>
                  <span className="text-sm text-white/60 font-medium">{speed < 1 ? "Slow" : speed > 1.3 ? "Fast" : speed > 1 ? "Slightly Fast" : "Normal"}</span>
                </div>
                <input
                  data-testid="slider-speed"
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.1}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full accent-white"
                />
                <div className="flex justify-between text-xs text-white/20">
                  <span>Slow</span>
                  <span>Normal</span>
                  <span>Fast</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-white/40">Max Conversation Length</label>
                  <span className="text-sm text-white/60 font-medium">{maxConversationLength} turns</span>
                </div>
                <input
                  data-testid="slider-max-conversation"
                  type="range"
                  min={1}
                  max={50}
                  value={maxConversationLength}
                  onChange={(e) => setMaxConversationLength(Number(e.target.value))}
                  className="w-full accent-white"
                />
                <div className="flex justify-between text-xs text-white/20">
                  <span>1</span>
                  <span>25</span>
                  <span>50</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "integrations" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database size={16} className="text-white/30" />
                  <h2 className="text-lg font-semibold text-white/90">External Database</h2>
                </div>
                <button
                  data-testid="switch-external-db"
                  onClick={() => setExternalDbEnabled(!externalDbEnabled)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                    externalDbEnabled ? "border border-green-500/30 text-green-400 bg-transparent" : "border border-white/10 text-white/40 bg-transparent"
                  }`}
                >
                  {externalDbEnabled ? "Enabled" : "Disabled"}
                </button>
              </div>
              {externalDbEnabled && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <label className="text-sm text-white/40 block">Database Type</label>
                    <div className="flex gap-2">
                      {([
                        { value: "supabase" as const, label: "Supabase" },
                        { value: "convex" as const, label: "Convex" },
                        { value: "custom" as const, label: "Custom Postgres" },
                      ]).map((opt) => (
                        <button
                          key={opt.value}
                          data-testid={`radio-db-type-${opt.value}`}
                          onClick={() => setExternalDbType(opt.value)}
                          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                            externalDbType === opt.value
                              ? "border border-white/30 text-white bg-white/[0.06]"
                              : "border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-white/40 block">Connection String</label>
                    <input
                      data-testid="input-db-connection-string"
                      type="password"
                      value={externalDbConnectionString}
                      onChange={(e) => setExternalDbConnectionString(e.target.value)}
                      placeholder="postgres://user:pass@host:5432/db"
                      className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe size={16} className="text-white/30" />
                  <h2 className="text-lg font-semibold text-white/90">MCP Connection</h2>
                </div>
                <button
                  data-testid="switch-mcp-enabled"
                  onClick={() => setMcpEnabled(!mcpEnabled)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                    mcpEnabled ? "border border-green-500/30 text-green-400 bg-transparent" : "border border-white/10 text-white/40 bg-transparent"
                  }`}
                >
                  {mcpEnabled ? "Enabled" : "Disabled"}
                </button>
              </div>
              {mcpEnabled && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-white/40 block">MCP Endpoint URL</label>
                    <input
                      data-testid="input-mcp-endpoint"
                      type="text"
                      readOnly
                      value={typeof window !== "undefined" ? window.location.origin + "/api/mcp" : "/api/mcp"}
                      className="w-full bg-white/[0.02] border border-white/10 rounded-xl px-4 py-3 text-sm text-white/60 focus:outline-none cursor-default"
                    />
                  </div>
                  <p className="text-xs text-white/30">Use this endpoint to connect MCP-compatible tools</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-white/30" />
                  <h2 className="text-lg font-semibold text-white/90">RAG / Knowledge Base</h2>
                </div>
                <button
                  data-testid="switch-rag-enabled"
                  onClick={() => setRagEnabled(!ragEnabled)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                    ragEnabled ? "border border-green-500/30 text-green-400 bg-transparent" : "border border-white/10 text-white/40 bg-transparent"
                  }`}
                >
                  {ragEnabled ? "Enabled" : "Disabled"}
                </button>
              </div>
              {ragEnabled && (
                <div className="space-y-5">
                  <div
                    data-testid="dropzone-rag-upload"
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileDrop(e.dataTransfer.files); }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                      isDragging ? "border-white/40 bg-white/[0.04]" : "border-white/10 hover:border-white/20 bg-transparent"
                    }`}
                  >
                    <Upload size={24} className="mx-auto text-white/30 mb-3" />
                    <p className="text-sm text-white/50 mb-1">
                      {uploadMutation.isPending ? "Uploading..." : "Drop files here or click to upload"}
                    </p>
                    <p className="text-xs text-white/20">.txt, .md, .csv, .json — up to 5MB</p>
                    <input
                      ref={fileInputRef}
                      data-testid="input-rag-file"
                      type="file"
                      accept=".txt,.md,.csv,.json"
                      className="hidden"
                      onChange={(e) => { handleFileDrop(e.target.files); e.target.value = ""; }}
                    />
                  </div>

                  {documentsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 size={16} className="text-white/30 animate-spin" />
                    </div>
                  ) : documents.length > 0 ? (
                    <div className="space-y-2">
                      <label className="text-sm text-white/40 block">Uploaded Documents</label>
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          data-testid={`row-document-${doc.id}`}
                          className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-transparent"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText size={14} className="text-white/30 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm text-white/70 truncate" data-testid={`text-doc-name-${doc.id}`}>{doc.filename}</p>
                              <p className="text-xs text-white/30">{formatFileSize(doc.sizeBytes)}</p>
                            </div>
                          </div>
                          <button
                            data-testid={`button-delete-doc-${doc.id}`}
                            onClick={() => deleteMutation.mutate(doc.id)}
                            disabled={deleteMutation.isPending}
                            className="text-white/30 hover:text-red-400 transition-colors p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-white/40">Max Results</label>
                      <span className="text-sm text-white/60 font-medium">{ragMaxResults}</span>
                    </div>
                    <input
                      data-testid="slider-rag-max-results"
                      type="range"
                      min={1}
                      max={10}
                      value={ragMaxResults}
                      onChange={(e) => setRagMaxResults(Number(e.target.value))}
                      className="w-full accent-white"
                    />
                    <div className="flex justify-between text-xs text-white/20">
                      <span>1</span>
                      <span>5</span>
                      <span>10</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Upload size={16} className="text-white/30" />
                  <h2 className="text-lg font-semibold text-white/90">File Upload</h2>
                </div>
                <button
                  data-testid="switch-file-upload"
                  onClick={() => setFileUploadEnabled(!fileUploadEnabled)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                    fileUploadEnabled ? "border border-green-500/30 text-green-400 bg-transparent" : "border border-white/10 text-white/40 bg-transparent"
                  }`}
                >
                  {fileUploadEnabled ? "Enabled" : "Disabled"}
                </button>
              </div>
              <p className="text-sm text-white/30">
                Allow users to upload files during live voice sessions with this agent.
              </p>
            </div>
          </motion.div>
        )}

        {activeTab === "test" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white/90">Test Your Agent</h2>
              <p className="text-sm text-white/30">
                Start a live voice session to test how your agent responds. 
                Make sure you've saved your configuration first.
              </p>
            </div>
            <VoiceTestPanel agentId={parseInt(id!)} agentName={name} />
          </motion.div>
        )}
      </div>
    </div>
  );
}
