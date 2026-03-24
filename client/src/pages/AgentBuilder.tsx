import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getAuthHeaders } from "@/lib/queryClient";
import { getToolsForAgentType } from "@/lib/agentTools";
import type { Agent, AgentConfig, ExternalDbConfig, RagConfig, RagDocument } from "@shared/schema";
import { AGENT_TYPE_LABELS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { VoiceTestPanel } from "@/components/VoiceTestPanel";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Save, ArrowLeft, ArrowRight, CheckCircle2,
  Mic, Settings2, PlayCircle, Plug,
  Database, Globe, FileText, Upload, Trash2, Volume2,
  ChevronDown, ChevronRight, Circle, Zap, ExternalLink
} from "lucide-react";

const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"] as const;
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

const STEPS = [
  { id: "identity", label: "Identity", num: "01" },
  { id: "voice", label: "Voice & Behavior", num: "02" },
  { id: "connections", label: "Connections", num: "03" },
  { id: "test", label: "Test & Launch", num: "04" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium tracking-wide uppercase transition-all duration-300 ${
      active ? "text-emerald-400" : "text-ink-faint"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-ink-ghost"}`} />
      {active ? "Active" : "Draft"}
    </span>
  );
}

function SectionToggle({
  enabled,
  onToggle,
  testId,
}: {
  enabled: boolean;
  onToggle: () => void;
  testId: string;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onToggle}
      className={`relative w-12 h-7 rounded-full transition-all duration-300 ${
        enabled ? "bg-accent" : "bg-surface-4"
      }`}
    >
      <span
        className={`absolute top-[3px] w-5 h-5 rounded-full bg-white transition-all duration-300 ${
          enabled ? "left-[26px]" : "left-[3px]"
        }`}
      />
    </button>
  );
}

export default function AgentBuilder() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<StepId>("identity");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [voice, setVoice] = useState("alloy");
  const [language, setLanguage] = useState("en");
  const [speed, setSpeed] = useState(1);
  const [greeting, setGreeting] = useState("");
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [maxConversationLength, setMaxConversationLength] = useState(50);
  const [isActive, setIsActive] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
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

  // Square connection state
  const [squareConnecting, setSquareConnecting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: ["agents", id],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${id}`, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Agent not found");
      return res.json();
    },
    enabled: !!id,
  });

  // Square connection status query
  const { data: squareStatus, isLoading: squareStatusLoading, refetch: refetchSquareStatus } = useQuery<{
    connected: boolean;
    merchantId: string | null;
    locationId: string | null;
    businessName?: string;
    country?: string;
    currency?: string;
  }>({
    queryKey: ["square", "status"],
    queryFn: async () => {
      const res = await fetch("/api/square/status", { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch Square status");
      return res.json();
    },
  });

  const { data: squareLocations } = useQuery<{ locations: Array<{ id: string; name: string; address: any; status: string }>; activeLocationId: string | null }>({
    queryKey: ["square", "locations"],
    queryFn: async () => {
      const res = await fetch("/api/square/locations", { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch locations");
      return res.json();
    },
    enabled: !!squareStatus?.connected,
  });

  const connectSquare = useCallback(async () => {
    setSquareConnecting(true);
    try {
      const res = await fetch("/api/square/oauth/authorize", { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to get authorization URL");
      const { url } = await res.json();

      // Open OAuth popup
      const popup = window.open(url, "square-oauth", "width=600,height=700,scrollbars=yes");
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "square-oauth-success") {
          window.removeEventListener("message", handleMessage);
          setSquareConnecting(false);
          refetchSquareStatus();
          queryClient.invalidateQueries({ queryKey: ["square"] });
          toast({ title: "Square Connected", description: "Your Square account has been connected successfully." });
        } else if (event.data?.type === "square-oauth-error") {
          window.removeEventListener("message", handleMessage);
          setSquareConnecting(false);
          toast({ title: "Connection Failed", description: event.data.error || "Failed to connect Square.", variant: "destructive" });
        }
      };
      window.addEventListener("message", handleMessage);

      // Cleanup if popup closed without completing
      const pollClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollClosed);
          window.removeEventListener("message", handleMessage);
          setSquareConnecting(false);
        }
      }, 500);
    } catch (err: any) {
      setSquareConnecting(false);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }, [refetchSquareStatus, queryClient, toast]);

  const disconnectSquare = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/square/disconnect", { method: "POST", credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to disconnect");
      return res.json();
    },
    onSuccess: () => {
      refetchSquareStatus();
      queryClient.invalidateQueries({ queryKey: ["square"] });
      toast({ title: "Disconnected", description: "Square has been disconnected." });
    },
  });

  const setSquareLocation = useMutation({
    mutationFn: async (locationId: string) => {
      const res = await fetch("/api/square/locations/set", {
        method: "POST",
        credentials: "include",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      if (!res.ok) throw new Error("Failed to set location");
      return res.json();
    },
    onSuccess: () => {
      refetchSquareStatus();
      queryClient.invalidateQueries({ queryKey: ["square"] });
      toast({ title: "Location Set", description: "Square location updated." });
    },
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery<RagDocument[]>({
    queryKey: ["agents", id, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${id}/documents`, { credentials: "include", headers: getAuthHeaders() });
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
        headers: getAuthHeaders(),
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
        setWakeWordEnabled(c.wakeWord.enabled ?? true);
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
          squareEnabled: !!squareStatus?.connected,
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
      <div className="min-h-screen bg-page flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-ink-faint animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="text-center">
          <p className="text-ink-muted mb-4" data-testid="text-agent-not-found">Agent not found</p>
          <Link href="/dashboard" className="text-ink-secondary hover:text-ink text-sm underline">Back to Dashboard</Link>
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

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
  const canGoNext = currentStepIndex < STEPS.length - 1;
  const canGoPrev = currentStepIndex > 0;

  const stepComplete = (stepId: StepId) => {
    switch (stepId) {
      case "identity": return name.length > 0 && description.length > 0;
      case "voice": return voice.length > 0;
      case "connections": return true;
      case "test": return true;
    }
  };

  return (
    <div className="min-h-screen bg-page text-ink font-sans flex">
      <aside className="hidden lg:flex w-64 flex-col border-r border-line-subtle bg-surface-1">
        <div className="p-6 border-b border-line-subtle">
          <Link href="/dashboard" className="flex items-center gap-2 text-ink-faint hover:text-ink-secondary text-sm transition-colors" data-testid="link-back-dashboard">
            <ArrowLeft size={14} />
            <span>Back to agents</span>
          </Link>
        </div>

        <div className="p-6 border-b border-line-subtle">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-faint font-medium mb-2">Agent</p>
          <h2 className="text-base font-semibold text-ink truncate" data-testid="text-agent-name-header">{name || "Untitled"}</h2>
          <p className="text-xs text-ink-faint mt-0.5">{AGENT_TYPE_LABELS[agent.type as keyof typeof AGENT_TYPE_LABELS] || agent.type}</p>
        </div>

        <nav className="flex-1 py-4">
          {STEPS.map((step, i) => {
            const isCurrent = currentStep === step.id;
            const isCompleted = stepComplete(step.id) && !isCurrent;
            return (
              <button
                key={step.id}
                data-testid={`tab-${step.id === "identity" ? "general" : step.id === "connections" ? "integrations" : step.id}`}
                onClick={() => setCurrentStep(step.id)}
                className={`w-full flex items-center gap-3 px-6 py-3.5 text-left transition-all duration-200 relative ${
                  isCurrent
                    ? "text-ink bg-surface-2"
                    : "text-ink-faint hover:text-ink-muted hover:bg-surface-1"
                }`}
              >
                {isCurrent && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-accent" />
                )}
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  isCurrent
                    ? "bg-accent text-black"
                    : isCompleted
                      ? "bg-surface-4 text-ink-secondary"
                      : "bg-surface-2 text-ink-ghost"
                }`}>
                  {isCompleted ? <CheckCircle2 size={12} /> : step.num}
                </span>
                <span className="text-sm font-medium">{step.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-6 border-t border-line-subtle space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-faint uppercase tracking-wider">Status</span>
            <button
              data-testid="switch-activate"
              onClick={() => setIsActive(!isActive)}
            >
              <StatusPill active={isActive} />
            </button>
          </div>
          <button
            data-testid="button-save-agent"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-accent text-black py-2.5 text-sm font-semibold hover:bg-accent-hover disabled:opacity-50 transition-all duration-300"
          >
            {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Configuration
          </button>
          <Link href={`/app/${id}`} className="w-full flex items-center justify-center gap-2 border border-line text-ink-secondary py-2.5 text-sm font-medium hover:bg-surface-2 hover:text-ink transition-all duration-300" data-testid="button-launch-agent">
            <ExternalLink size={14} />
            Launch Agent
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="lg:hidden sticky top-0 z-40 bg-page/90 backdrop-blur-xl border-b border-line-subtle">
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <button className="text-ink-faint hover:text-ink p-1" data-testid="link-back-dashboard-mobile">
                  <ArrowLeft size={20} />
                </button>
              </Link>
              <span className="text-base font-semibold text-ink truncate max-w-[160px]">{name || "Untitled"}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                data-testid="switch-activate-mobile"
                onClick={() => setIsActive(!isActive)}
                className="shrink-0"
              >
                <StatusPill active={isActive} />
              </button>
              <Link href={`/app/${id}`} className="flex items-center gap-1.5 border border-line text-ink-muted px-3 py-2 text-sm font-medium" data-testid="button-launch-agent-mobile">
                <ExternalLink size={13} />
                Launch
              </Link>
              <button
                data-testid="button-save-agent-mobile"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="flex items-center gap-1.5 bg-accent text-black px-4 py-2 text-sm font-semibold"
              >
                {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </button>
            </div>
          </div>
          <div className="flex overflow-x-auto px-2 pb-2 gap-1">
            {STEPS.map((step) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                data-testid={`tab-mobile-${step.id}`}
                className={`shrink-0 px-4 py-2.5 text-sm font-medium rounded transition-all ${
                  currentStep === step.id
                    ? "bg-surface-4 text-ink"
                    : "text-ink-faint"
                }`}
              >
                {step.label}
              </button>
            ))}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 lg:py-16">
            <AnimatePresence mode="wait">
              {currentStep === "identity" && (
                <motion.div
                  key="identity"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-8"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-accent/60 font-medium mb-3">Step 01</p>
                    <h1 className="text-2xl font-light text-ink tracking-tight mb-2">Define your agent</h1>
                    <p className="text-sm text-ink-faint max-w-md">Give your agent a name and describe what it does. This shapes how it introduces itself and interacts with users.</p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="text-xs uppercase tracking-[0.15em] text-ink-faint font-medium block mb-3">Agent Name</label>
                      <input
                        data-testid="input-agent-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Front Bar POS"
                        className="w-full bg-transparent border-0 border-b border-line px-0 py-3 text-lg text-ink placeholder:text-ink-ghost focus:outline-none focus:border-accent/40 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.15em] text-ink-faint font-medium block mb-3">Description</label>
                      <textarea
                        data-testid="input-agent-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe what this agent handles..."
                        rows={3}
                        className="w-full bg-transparent border-0 border-b border-line px-0 py-3 text-base text-ink placeholder:text-ink-ghost focus:outline-none focus:border-accent/40 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.15em] text-ink-faint font-medium block mb-3">Greeting Message</label>
                      <textarea
                        data-testid="input-greeting"
                        value={greeting}
                        onChange={(e) => setGreeting(e.target.value)}
                        placeholder="Hi! How can I help you today?"
                        rows={2}
                        className="w-full bg-transparent border-0 border-b border-line px-0 py-3 text-base text-ink placeholder:text-ink-ghost focus:outline-none focus:border-accent/40 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.15em] text-ink-faint font-medium block mb-3">Fallback Message</label>
                      <textarea
                        data-testid="input-fallback-message"
                        value={fallbackMessage}
                        onChange={(e) => setFallbackMessage(e.target.value)}
                        placeholder="Sorry, I didn't catch that. Could you say it again?"
                        rows={2}
                        className="w-full bg-transparent border-0 border-b border-line px-0 py-3 text-base text-ink placeholder:text-ink-ghost focus:outline-none focus:border-accent/40 transition-colors resize-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex-1 h-px bg-line-subtle" />
                      <span className="text-[10px] uppercase tracking-[0.2em] text-ink-ghost">Capabilities</span>
                      <div className="flex-1 h-px bg-line-subtle" />
                    </div>

                    <p className="text-xs uppercase tracking-[0.15em] text-ink-faint font-medium mb-4">
                      {availableTools.length} tools enabled for this agent type
                    </p>

                    {Object.entries(toolsByCategory).map(([category, tools]) => (
                      <div key={category} className="mb-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-ink-faint mb-2">{category}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {tools.map((tool) => (
                            <span
                              key={tool.name}
                              data-testid={`info-tool-${tool.name}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-1 text-ink-faint text-xs"
                              title={tool.description}
                            >
                              <Zap size={9} className="text-accent/40" />
                              {tool.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {currentStep === "voice" && (
                <motion.div
                  key="voice"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-8"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-accent/60 font-medium mb-3">Step 02</p>
                    <h1 className="text-2xl font-light text-ink tracking-tight mb-2">Voice & Behavior</h1>
                    <p className="text-sm text-ink-faint max-w-md">Choose how your agent sounds and responds. Set the voice, speed, and language that fits your venue.</p>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <label className="text-xs uppercase tracking-[0.15em] text-ink-faint font-medium block mb-4">Voice</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {VOICES.map((v) => (
                          <button
                            key={v}
                            data-testid={`button-voice-${v}`}
                            onClick={() => setVoice(v)}
                            className={`relative py-5 text-center text-sm font-medium transition-all duration-300 rounded ${
                              voice === v
                                ? "bg-surface-3 text-ink border-b-2 border-accent"
                                : "text-ink-faint hover:text-ink-secondary hover:bg-surface-1 border-b border-transparent"
                            }`}
                          >
                            <Mic size={18} className={`mx-auto mb-2 ${voice === v ? "text-accent" : "text-ink-ghost"}`} />
                            {v.charAt(0).toUpperCase() + v.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-[0.15em] text-ink-faint font-medium block mb-4">Language</label>
                      <div className="flex flex-wrap gap-1.5">
                        {LANGUAGES.map((l) => (
                          <button
                            key={l.value}
                            data-testid={`button-language-${l.value}`}
                            onClick={() => setLanguage(l.value)}
                            className={`px-4 py-2 text-sm transition-all duration-300 ${
                              language === l.value
                                ? "bg-surface-3 text-ink border-b border-accent"
                                : "text-ink-faint hover:text-ink-muted"
                            }`}
                          >
                            {l.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between mb-4">
                        <label className="text-xs uppercase tracking-[0.15em] text-ink-faint font-medium">Speed</label>
                        <span className="text-xs text-ink-faint">
                          {speed < 1 ? "Slow" : speed > 1.3 ? "Fast" : speed > 1 ? "Slightly Fast" : "Normal"}
                        </span>
                      </div>
                      <input
                        data-testid="slider-speed"
                        type="range"
                        min={0.5}
                        max={1.5}
                        step={0.1}
                        value={speed}
                        onChange={(e) => setSpeed(Number(e.target.value))}
                        className="w-full accent-accent"
                      />
                      <div className="flex justify-between text-[10px] text-ink-ghost mt-1.5">
                        <span>Slow</span>
                        <span>Normal</span>
                        <span>Fast</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="flex-1 h-px bg-line-subtle" />
                      <span className="text-[10px] uppercase tracking-[0.2em] text-ink-ghost">Wake Word</span>
                      <div className="flex-1 h-px bg-line-subtle" />
                    </div>

                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <p className="text-sm text-ink-secondary">Hands-free activation</p>
                        <p className="text-xs text-ink-faint mt-0.5">Activate with a voice trigger phrase</p>
                      </div>
                      <SectionToggle
                        enabled={wakeWordEnabled}
                        onToggle={() => setWakeWordEnabled(!wakeWordEnabled)}
                        testId="toggle-wake-word"
                      />
                    </div>

                    <AnimatePresence>
                      {wakeWordEnabled && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-6 overflow-hidden"
                        >
                          <div>
                            <label className="text-xs uppercase tracking-[0.15em] text-ink-faint font-medium block mb-2">Trigger Phrase</label>
                            <input
                              data-testid="input-wake-word-phrase"
                              value={wakeWordPhrase}
                              onChange={(e) => setWakeWordPhrase(e.target.value)}
                              placeholder="hey bev"
                              className="w-full bg-transparent border-0 border-b border-line px-0 py-3 text-base text-ink placeholder:text-ink-ghost focus:outline-none focus:border-accent/40 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="text-xs uppercase tracking-[0.15em] text-ink-faint font-medium block mb-2">End Phrases</label>
                            <textarea
                              data-testid="input-wake-word-end-phrases"
                              value={wakeWordEndPhrases}
                              onChange={(e) => setWakeWordEndPhrases(e.target.value)}
                              placeholder="goodbye, we are done, that's all"
                              rows={2}
                              className="w-full bg-transparent border-0 border-b border-line px-0 py-3 text-sm text-ink placeholder:text-ink-ghost focus:outline-none focus:border-accent/40 transition-colors resize-none"
                            />
                          </div>
                          <div>
                            <label className="text-xs uppercase tracking-[0.15em] text-ink-faint font-medium block mb-2">Shutdown Phrases</label>
                            <textarea
                              data-testid="input-wake-word-shutdown-phrases"
                              value={wakeWordShutdownPhrases}
                              onChange={(e) => setWakeWordShutdownPhrases(e.target.value)}
                              placeholder="stop listening, shut down, terminate"
                              rows={2}
                              className="w-full bg-transparent border-0 border-b border-line px-0 py-3 text-sm text-ink placeholder:text-ink-ghost focus:outline-none focus:border-accent/40 transition-colors resize-none"
                            />
                          </div>
                          <div>
                            <div className="flex items-baseline justify-between mb-3">
                              <label className="text-xs uppercase tracking-[0.15em] text-ink-faint font-medium">Sensitivity</label>
                              <span className="text-xs text-ink-faint">{levenshteinThreshold}</span>
                            </div>
                            <input
                              data-testid="slider-levenshtein-threshold"
                              type="range"
                              min={1}
                              max={3}
                              step={1}
                              value={Math.min(levenshteinThreshold, 3)}
                              onChange={(e) => setLevenshteinThreshold(Number(e.target.value))}
                              className="w-full accent-accent"
                            />
                            <div className="flex justify-between text-[10px] text-ink-ghost mt-1.5">
                              <span>Strict</span>
                              <span>Flexible</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {currentStep === "connections" && (
                <motion.div
                  key="connections"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-8"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-accent/60 font-medium mb-3">Step 03</p>
                    <h1 className="text-2xl font-light text-ink tracking-tight mb-2">Connections</h1>
                    <p className="text-sm text-ink-faint max-w-md">Connect your agent to databases, knowledge bases, and external tools. Enable only what you need.</p>
                  </div>

                  <div className="space-y-1">
                    <ConnectionSection
                      title="Square POS"
                      description="Connect to your Square account for orders, payments, catalog, and inventory"
                      icon={<Zap size={16} />}
                      enabled={!!squareStatus?.connected}
                      onToggle={() => {
                        if (squareStatus?.connected) {
                          disconnectSquare.mutate();
                        } else {
                          connectSquare();
                        }
                      }}
                      toggleTestId="switch-square-pos"
                    >
                      <div className="space-y-4 pt-2">
                        {squareStatusLoading ? (
                          <div className="flex items-center gap-2 py-3">
                            <Loader2 size={14} className="text-ink-ghost animate-spin" />
                            <span className="text-sm text-ink-faint">Checking connection...</span>
                          </div>
                        ) : squareStatus?.connected ? (
                          <>
                            <div className="flex items-center gap-2 py-2">
                              <CheckCircle2 size={14} className="text-emerald-400" />
                              <span className="text-sm text-ink">Connected to Square</span>
                            </div>
                            {squareStatus.businessName && (
                              <div className="text-xs text-ink-faint">
                                Business: <span className="text-ink-muted">{squareStatus.businessName}</span>
                              </div>
                            )}
                            {squareStatus.merchantId && (
                              <div className="text-xs text-ink-faint">
                                Merchant: <span className="text-ink-muted font-mono">{squareStatus.merchantId.slice(0, 12)}...</span>
                              </div>
                            )}

                            {/* Location selector */}
                            {squareLocations && squareLocations.locations.length > 0 && (
                              <div>
                                <label className="text-xs uppercase tracking-[0.15em] text-ink-faint font-medium block mb-2">Active Location</label>
                                <div className="space-y-1">
                                  {squareLocations.locations.map((loc) => (
                                    <button
                                      key={loc.id}
                                      onClick={() => setSquareLocation.mutate(loc.id)}
                                      className={`w-full text-left px-3 py-2.5 text-sm transition-all duration-200 border-b border-line-subtle ${
                                        squareLocations.activeLocationId === loc.id
                                          ? "text-ink bg-accent/5 border-l-2 border-l-accent"
                                          : "text-ink-muted hover:text-ink hover:bg-surface-2"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span>{loc.name}</span>
                                        {squareLocations.activeLocationId === loc.id && (
                                          <CheckCircle2 size={12} className="text-accent" />
                                        )}
                                      </div>
                                      <span className="text-xs text-ink-faint">{loc.status}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="text-xs text-ink-ghost pt-2 space-y-1">
                              <p>Scopes: Catalog, Orders, Payments, Inventory</p>
                              <p>Your agents can now create orders, manage inventory, and process payments through voice commands.</p>
                            </div>

                            <button
                              onClick={() => disconnectSquare.mutate()}
                              disabled={disconnectSquare.isPending}
                              className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
                            >
                              {disconnectSquare.isPending ? "Disconnecting..." : "Disconnect Square"}
                            </button>
                          </>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-sm text-ink-faint">
                              Connect your Square account to enable voice-driven orders, payments, catalog sync, and inventory management.
                            </p>
                            <button
                              onClick={connectSquare}
                              disabled={squareConnecting}
                              className="flex items-center gap-2 px-4 py-2.5 bg-surface-3 hover:bg-surface-4 text-ink text-sm transition-all duration-200 border border-line hover:border-line-strong"
                            >
                              {squareConnecting ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <ExternalLink size={14} />
                              )}
                              {squareConnecting ? "Connecting..." : "Connect with Square"}
                            </button>
                            <div className="text-xs text-ink-ghost space-y-1">
                              <p>Required permissions: Merchant Profile, Catalog, Orders, Payments, Inventory</p>
                              <p>A popup will open to authorize your Square account via OAuth 2.0.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </ConnectionSection>

                    <ConnectionSection
                      title="External Database"
                      description="Connect to Supabase, Convex, or a custom PostgreSQL database"
                      icon={<Database size={16} />}
                      enabled={externalDbEnabled}
                      onToggle={() => setExternalDbEnabled(!externalDbEnabled)}
                      toggleTestId="switch-external-db"
                    >
                      <div className="space-y-5 pt-2">
                        <div>
                          <label className="text-xs uppercase tracking-[0.15em] text-ink-faint font-medium block mb-3">Type</label>
                          <div className="flex gap-1.5">
                            {([
                              { value: "supabase" as const, label: "Supabase" },
                              { value: "convex" as const, label: "Convex" },
                              { value: "custom" as const, label: "Custom" },
                            ]).map((opt) => (
                              <button
                                key={opt.value}
                                data-testid={`radio-db-type-${opt.value}`}
                                onClick={() => setExternalDbType(opt.value)}
                                className={`px-4 py-2 text-sm transition-all duration-300 ${
                                  externalDbType === opt.value
                                    ? "bg-surface-3 text-ink border-b border-accent"
                                    : "text-ink-faint hover:text-ink-muted"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-[0.15em] text-ink-faint font-medium block mb-2">Connection String</label>
                          <input
                            data-testid="input-db-connection-string"
                            type="password"
                            value={externalDbConnectionString}
                            onChange={(e) => setExternalDbConnectionString(e.target.value)}
                            placeholder="postgres://user:pass@host:5432/db"
                            className="w-full bg-transparent border-0 border-b border-line px-0 py-3 text-sm text-ink placeholder:text-ink-ghost focus:outline-none focus:border-accent/40 transition-colors"
                          />
                        </div>
                      </div>
                    </ConnectionSection>

                    <ConnectionSection
                      title="MCP Protocol"
                      description="Connect MCP-compatible tools and services"
                      icon={<Globe size={16} />}
                      enabled={mcpEnabled}
                      onToggle={() => setMcpEnabled(!mcpEnabled)}
                      toggleTestId="switch-mcp-enabled"
                    >
                      <div className="pt-2">
                        <label className="text-xs uppercase tracking-[0.15em] text-ink-faint font-medium block mb-2">Endpoint</label>
                        <input
                          data-testid="input-mcp-endpoint"
                          type="text"
                          readOnly
                          value={typeof window !== "undefined" ? window.location.origin + "/api/mcp" : "/api/mcp"}
                          className="w-full bg-surface-1 border-0 border-b border-line px-0 py-3 text-sm text-ink-muted focus:outline-none cursor-default"
                        />
                        <p className="text-xs text-ink-ghost mt-2">Use this endpoint to connect MCP-compatible tools</p>
                      </div>
                    </ConnectionSection>

                    <ConnectionSection
                      title="Knowledge Base"
                      description="Upload documents for RAG-powered contextual answers"
                      icon={<FileText size={16} />}
                      enabled={ragEnabled}
                      onToggle={() => setRagEnabled(!ragEnabled)}
                      toggleTestId="switch-rag-enabled"
                    >
                      <div className="space-y-5 pt-2">
                        <div
                          data-testid="dropzone-rag-upload"
                          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                          onDragLeave={() => setIsDragging(false)}
                          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileDrop(e.dataTransfer.files); }}
                          onClick={() => fileInputRef.current?.click()}
                          className={`border border-dashed py-8 text-center cursor-pointer transition-all duration-300 ${
                            isDragging ? "border-accent/40 bg-accent-bg" : "border-line hover:border-line-strong"
                          }`}
                        >
                          <Upload size={20} className="mx-auto text-ink-ghost mb-2" />
                          <p className="text-sm text-ink-faint">
                            {uploadMutation.isPending ? "Uploading..." : "Drop files or click to upload"}
                          </p>
                          <p className="text-xs text-ink-faint mt-1">.txt, .md, .csv, .json — up to 5MB</p>
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
                            <Loader2 size={14} className="text-ink-ghost animate-spin" />
                          </div>
                        ) : documents.length > 0 ? (
                          <div className="space-y-1">
                            {documents.map((doc) => (
                              <div
                                key={doc.id}
                                data-testid={`row-document-${doc.id}`}
                                className="flex items-center justify-between py-3 border-b border-line-subtle"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <FileText size={13} className="text-ink-ghost shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-sm text-ink-muted truncate" data-testid={`text-doc-name-${doc.id}`}>{doc.filename}</p>
                                    <p className="text-xs text-ink-faint">{formatFileSize(doc.sizeBytes)}</p>
                                  </div>
                                </div>
                                <button
                                  data-testid={`button-delete-doc-${doc.id}`}
                                  onClick={() => deleteMutation.mutate(doc.id)}
                                  disabled={deleteMutation.isPending}
                                  className="text-ink-ghost hover:text-red-400 transition-colors p-1"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <div>
                          <div className="flex items-baseline justify-between mb-3">
                            <label className="text-xs uppercase tracking-[0.15em] text-ink-faint font-medium">Max Results</label>
                            <span className="text-xs text-ink-faint">{ragMaxResults}</span>
                          </div>
                          <input
                            data-testid="slider-rag-max-results"
                            type="range"
                            min={1}
                            max={10}
                            value={ragMaxResults}
                            onChange={(e) => setRagMaxResults(Number(e.target.value))}
                            className="w-full accent-accent"
                          />
                          <div className="flex justify-between text-[10px] text-ink-ghost mt-1.5">
                            <span>1</span>
                            <span>5</span>
                            <span>10</span>
                          </div>
                        </div>
                      </div>
                    </ConnectionSection>

                    <ConnectionSection
                      title="File Upload"
                      description="Allow users to upload files during live voice sessions"
                      icon={<Upload size={16} />}
                      enabled={fileUploadEnabled}
                      onToggle={() => setFileUploadEnabled(!fileUploadEnabled)}
                      toggleTestId="switch-file-upload"
                    >
                      <p className="text-sm text-ink-faint pt-2">Users can upload files through the agent interface during active sessions.</p>
                    </ConnectionSection>
                  </div>
                </motion.div>
              )}

              {currentStep === "test" && (
                <motion.div
                  key="test"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-8"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-accent/60 font-medium mb-3">Step 04</p>
                    <h1 className="text-2xl font-light text-ink tracking-tight mb-2">Test & Launch</h1>
                    <p className="text-sm text-ink-faint max-w-md">Run a live voice session to verify your agent works as expected. Save your configuration first.</p>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-3 p-4 bg-surface-1 border border-line-subtle">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-400" : "bg-amber-400"}`} />
                        <span className="text-sm text-ink-muted">
                          {isActive
                            ? "Your agent is active and ready to test."
                            : "Your agent is in draft mode. Activate it to enable voice sessions."
                          }
                        </span>
                      </div>
                      <button
                        data-testid="button-activate-test-step"
                        onClick={() => {
                          setIsActive(!isActive);
                          // Auto-save when toggling status from the test step
                          setTimeout(() => saveMutation.mutate(), 100);
                        }}
                        className={`shrink-0 px-4 py-2 text-sm font-semibold rounded transition-all duration-300 ${
                          isActive
                            ? "bg-emerald-500/15 text-emerald-400 hover:bg-red-500/15 hover:text-red-400"
                            : "bg-accent text-black hover:bg-accent-hover"
                        }`}
                      >
                        {isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                    <VoiceTestPanel agentId={parseInt(id!)} agentName={name} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between mt-10 sm:mt-16 pt-4 sm:pt-6 lg:relative fixed bottom-0 left-0 right-0 lg:bottom-auto lg:left-auto lg:right-auto bg-page/90 backdrop-blur-xl lg:bg-transparent lg:backdrop-blur-none px-4 py-4 sm:px-0 sm:py-0 border-t border-line-subtle lg:border-line-subtle z-30">
              <button
                data-testid="button-prev-step"
                onClick={() => canGoPrev && setCurrentStep(STEPS[currentStepIndex - 1].id)}
                disabled={!canGoPrev}
                className={`flex items-center gap-2 text-base py-2 px-4 transition-colors ${
                  canGoPrev ? "text-ink-muted hover:text-ink hover:bg-surface-2 rounded" : "text-ink-ghost cursor-not-allowed"
                }`}
              >
                <ArrowLeft size={16} />
                {canGoPrev ? STEPS[currentStepIndex - 1].label : ""}
              </button>
              <button
                data-testid="button-next-step"
                onClick={() => canGoNext && setCurrentStep(STEPS[currentStepIndex + 1].id)}
                disabled={!canGoNext}
                className={`flex items-center gap-2 text-base py-2 px-4 transition-colors ${
                  canGoNext ? "text-ink-muted hover:text-ink hover:bg-surface-2 rounded" : "text-ink-ghost cursor-not-allowed"
                }`}
              >
                {canGoNext ? STEPS[currentStepIndex + 1].label : ""}
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="h-14 lg:hidden" />
          </div>
        </main>
      </div>
    </div>
  );
}

function ConnectionSection({
  title,
  description,
  icon,
  enabled,
  onToggle,
  toggleTestId,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  onToggle: () => void;
  toggleTestId: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`py-6 border-b border-line-subtle transition-all duration-300 ${enabled ? "" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 ${enabled ? "text-accent" : "text-ink-ghost"} transition-colors`}>
            {icon}
          </span>
          <div>
            <p className={`text-sm font-medium transition-colors ${enabled ? "text-ink" : "text-ink-muted"}`}>{title}</p>
            <p className="text-sm text-ink-faint mt-0.5">{description}</p>
          </div>
        </div>
        <SectionToggle enabled={enabled} onToggle={onToggle} testId={toggleTestId} />
      </div>
      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden pl-7 mt-4"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
