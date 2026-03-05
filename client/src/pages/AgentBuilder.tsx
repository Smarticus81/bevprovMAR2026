import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getToolsForAgentType } from "@/lib/agentTools";
import type { Agent, AgentConfig, AgentTool } from "@shared/schema";
import { AGENT_TYPE_LABELS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { VoiceTestPanel } from "@/components/VoiceTestPanel";
import { motion } from "framer-motion";
import {
  Loader2, Save, ArrowLeft, CheckCircle2,
  Mic, Wrench, Settings2, PlayCircle, ChevronRight
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
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "test", label: "Test", icon: PlayCircle },
] as const;

type TabId = (typeof TABS)[number]["id"];

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
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({});
  const [isActive, setIsActive] = useState(false);

  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: ["agents", id],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Agent not found");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: savedTools } = useQuery<AgentTool[]>({
    queryKey: ["agents", id, "tools"],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${id}/tools`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });

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
    }
  }, [agent]);

  useEffect(() => {
    if (savedTools && agent) {
      const toolMap: Record<string, boolean> = {};
      const available = getToolsForAgentType(agent.type);
      available.forEach((t) => { toolMap[t.name] = false; });
      savedTools.forEach((t) => { toolMap[t.toolName] = t.enabled; });
      setEnabledTools(toolMap);
    }
  }, [savedTools, agent]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/agents/${id}`, {
        name,
        description,
        status: isActive ? "active" : "draft",
        config: {
          voice, language, speed, greeting, fallbackMessage, maxConversationLength,
        },
      });
      const tools = Object.entries(enabledTools).map(([toolName, enabled]) => {
        const def = getToolsForAgentType(agent!.type).find((t) => t.name === toolName);
        return { agentId: Number(id), toolName, toolCategory: def?.category || "Unknown", enabled, config: {} };
      });
      await apiRequest("PUT", `/api/agents/${id}/tools`, { tools });
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
  const enabledCount = Object.values(enabledTools).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <button className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors" data-testid="link-back-dashboard">
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
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-white/5 text-white/40 border border-white/10"
              }`}
            >
              {isActive ? "Active" : "Draft"}
            </button>
            <button
              data-testid="button-save-agent"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full text-sm font-medium hover:bg-white/90 disabled:opacity-50 transition-colors"
            >
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-white text-black"
                    : "text-white/50 hover:text-white hover:bg-white/5"
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
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-6">
              <h2 className="text-lg font-semibold">General</h2>
              <div className="space-y-2">
                <label className="text-sm text-white/60 block">Agent Name</label>
                <input
                  data-testid="input-agent-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Front Bar POS"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/60 block">Description</label>
                <textarea
                  data-testid="input-agent-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this agent handles..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/60 block">Greeting Message</label>
                <textarea
                  data-testid="input-greeting"
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder="Hi! How can I help you today?"
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/60 block">Fallback Message</label>
                <textarea
                  data-testid="input-fallback-message"
                  value={fallbackMessage}
                  onChange={(e) => setFallbackMessage(e.target.value)}
                  placeholder="Sorry, I didn't catch that. Could you say it again?"
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                />
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "voice" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-6">
              <h2 className="text-lg font-semibold">Voice</h2>
              <div className="space-y-3">
                <label className="text-sm text-white/60 block">Voice Model</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {VOICES.map((v) => (
                    <button
                      key={v}
                      data-testid={`button-voice-${v}`}
                      onClick={() => setVoice(v)}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium text-center transition-all ${
                        voice === v
                          ? "bg-white text-black"
                          : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm text-white/60 block">Language</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.value}
                      data-testid={`button-language-${l.value}`}
                      onClick={() => setLanguage(l.value)}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium text-center transition-all ${
                        language === l.value
                          ? "bg-white text-black"
                          : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-white/60">Max Conversation Length</label>
                  <span className="text-sm text-white/80 font-medium">{maxConversationLength} turns</span>
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
                <div className="flex justify-between text-xs text-white/30">
                  <span>1</span>
                  <span>25</span>
                  <span>50</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "tools" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Tools</h2>
                <span className="text-sm text-white/40">{enabledCount} / {availableTools.length} enabled</span>
              </div>
              <p className="text-sm text-white/40">
                These are the actions your agent can perform during a voice conversation.
                Enable the ones relevant to your venue.
              </p>
              {Object.entries(toolsByCategory).map(([category, tools]) => (
                <div key={category} className="space-y-2">
                  <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">{category}</h3>
                  {tools.map((tool) => {
                    const enabled = enabledTools[tool.name] || false;
                    return (
                      <button
                        key={tool.name}
                        data-testid={`switch-tool-${tool.name}`}
                        onClick={() => setEnabledTools((prev) => ({ ...prev, [tool.name]: !enabled }))}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                          enabled
                            ? "border-white/20 bg-white/[0.06]"
                            : "border-white/5 bg-white/[0.02] hover:border-white/10"
                        }`}
                      >
                        <div>
                          <p className={`text-sm font-medium ${enabled ? "text-white" : "text-white/50"}`}>
                            {tool.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </p>
                          <p className="text-xs text-white/30 mt-0.5">{tool.description}</p>
                        </div>
                        <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${
                          enabled ? "bg-green-500" : "bg-white/10"
                        }`}>
                          <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            enabled ? "translate-x-4" : "translate-x-0"
                          }`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === "test" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
              <h2 className="text-lg font-semibold">Test Your Agent</h2>
              <p className="text-sm text-white/40">
                Start a live voice session to test how your agent responds. 
                Make sure you've saved your configuration first.
              </p>
              {enabledCount === 0 && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
                  <p className="text-sm text-amber-400">No tools enabled. Your agent won't be able to perform any actions. Go to the Tools tab to enable some.</p>
                </div>
              )}
            </div>
            <VoiceTestPanel agentId={parseInt(id!)} agentName={name} />
          </motion.div>
        )}
      </div>
    </div>
  );
}
