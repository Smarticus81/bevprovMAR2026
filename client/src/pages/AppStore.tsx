import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Sparkles, ShoppingCart, Package, Building2, Layers, Mic, ChevronRight, Wrench, Volume2, Zap, ArrowRight } from "lucide-react";
import { Agent, AGENT_TYPES, AGENT_TYPE_LABELS, AGENT_TYPE_DESCRIPTIONS, AgentType } from "@shared/schema";
import { getToolsForAgentType } from "@/lib/agentTools";
import { apiRequest } from "@/lib/queryClient";

const CATEGORY_TABS = [
  { key: "all", label: "All Agents", icon: Layers },
  { key: "pos", label: "POS", icon: ShoppingCart },
  { key: "inventory", label: "Inventory", icon: Package },
  { key: "operations", label: "Operations", icon: Building2 },
  { key: "all-in-one", label: "All-in-One", icon: Sparkles },
] as const;

type CategoryKey = (typeof CATEGORY_TABS)[number]["key"];

const AGENT_TYPE_CATEGORY: Record<AgentType, CategoryKey> = {
  "pos-integration": "pos",
  "voice-pos": "pos",
  "inventory": "inventory",
  "venue-admin": "operations",
  "bevone": "all-in-one",
};

const AGENT_TYPE_ACCENTS: Record<AgentType, { gradient: string; glow: string; badge: string }> = {
  "pos-integration": {
    gradient: "from-blue-500/20 via-blue-400/10 to-blue-600/5",
    glow: "bg-blue-500/30",
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/20",
  },
  "voice-pos": {
    gradient: "from-violet-500/20 via-purple-400/10 to-violet-600/5",
    glow: "bg-violet-500/30",
    badge: "bg-violet-500/20 text-violet-300 border-violet-500/20",
  },
  "inventory": {
    gradient: "from-emerald-500/20 via-green-400/10 to-emerald-600/5",
    glow: "bg-emerald-500/30",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/20",
  },
  "venue-admin": {
    gradient: "from-amber-500/20 via-orange-400/10 to-amber-600/5",
    glow: "bg-amber-500/30",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/20",
  },
  "bevone": {
    gradient: "from-white/15 via-white/5 to-white/[0.02]",
    glow: "bg-white/20",
    badge: "bg-white/10 text-white/70 border-white/10",
  },
};

const AGENT_TYPE_ICONS: Record<AgentType, React.ElementType> = {
  "pos-integration": ShoppingCart,
  "voice-pos": Mic,
  "inventory": Package,
  "venue-admin": Building2,
  "bevone": Sparkles,
};

interface StoreItem {
  id: number | string;
  name: string;
  type: AgentType;
  description: string;
  status: string;
  isTemplate: boolean;
  config?: Record<string, unknown>;
}

function AppStorePage() {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
  const [selectedAgent, setSelectedAgent] = useState<StoreItem | null>(null);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch("/api/agents", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load agents");
      return res.json();
    },
  });

  const storeItems = useMemo<StoreItem[]>(() => {
    const existingTypes = new Set(agents.map((a) => a.type));
    const items: StoreItem[] = agents.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type as AgentType,
      description: a.description || AGENT_TYPE_DESCRIPTIONS[a.type as AgentType] || "",
      status: a.status,
      isTemplate: false,
      config: a.config as Record<string, unknown> | undefined,
    }));

    for (const agentType of AGENT_TYPES) {
      if (!existingTypes.has(agentType)) {
        items.push({
          id: `template-${agentType}`,
          name: AGENT_TYPE_LABELS[agentType],
          type: agentType,
          description: AGENT_TYPE_DESCRIPTIONS[agentType],
          status: "available",
          isTemplate: true,
        });
      }
    }
    return items;
  }, [agents]);

  const filteredItems = useMemo(() => {
    return storeItems.filter((item) => {
      if (item.type === "bevone") return false;
      const matchesCategory =
        activeCategory === "all" || AGENT_TYPE_CATEGORY[item.type] === activeCategory;
      return matchesCategory;
    });
  }, [storeItems, activeCategory]);

  const bevoneItem = useMemo(() => storeItems.find((i) => i.type === "bevone"), [storeItems]);

  const activateAgent = async (item: StoreItem) => {
    if (item.isTemplate) {
      const res = await apiRequest("POST", "/api/agents", {
        name: item.name,
        type: item.type,
        description: item.description,
      });
      const newAgent = await res.json();
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setSelectedAgent(null);
      setLocation(`/dashboard/agents/${newAgent.id}`);
    } else {
      setSelectedAgent(null);
      setLocation(`/dashboard/agents/${item.id}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

          {bevoneItem && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              data-testid="banner-featured"
              className="relative overflow-hidden rounded-3xl mb-10 cursor-pointer group"
              onClick={() => setSelectedAgent(bevoneItem)}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl" />
              <div className="absolute inset-0 border border-white/[0.08] rounded-3xl" />
              <div className="absolute inset-0 opacity-40">
                <div className="absolute -top-20 -right-20 w-80 h-80 bg-gradient-to-bl from-purple-500/30 via-blue-500/20 to-transparent rounded-full blur-3xl group-hover:from-purple-500/40 transition-all duration-700" />
                <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-gradient-to-tr from-blue-500/20 to-transparent rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-32 bg-white/5 rounded-full blur-3xl" />
              </div>

              <div className="relative z-10 p-8 sm:p-10 flex items-center gap-8">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-2xl flex-shrink-0 group-hover:scale-105 transition-transform duration-500">
                  <Sparkles className="w-12 h-12 sm:w-14 sm:h-14 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-[0.15em]">Featured</span>
                    <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight" data-testid="text-featured-name">
                    BevOne
                  </h2>
                  <p className="text-sm sm:text-base text-white/40 mt-2 max-w-md leading-relaxed" data-testid="text-featured-description">
                    {AGENT_TYPE_DESCRIPTIONS["bevone"]}
                  </p>
                  <div className="flex items-center gap-3 mt-5">
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.07] text-white/70 text-xs font-medium border border-white/[0.06]">
                      <Wrench className="w-3 h-3" /> 20+ Tools
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.07] text-white/70 text-xs font-medium border border-white/[0.06]">
                      <Volume2 className="w-3 h-3" /> Voice Enabled
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.07] text-white/70 text-xs font-medium border border-white/[0.06]">
                      <Zap className="w-3 h-3" /> All-in-One
                    </span>
                  </div>
                </div>
                <div className="hidden sm:flex flex-shrink-0 w-10 h-10 items-center justify-center rounded-full bg-white/[0.07] border border-white/[0.06] group-hover:bg-white/10 transition-colors">
                  <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/70 transition-colors" />
                </div>
              </div>
            </motion.div>
          )}

          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORY_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeCategory === tab.key;
              return (
                <button
                  key={tab.key}
                  data-testid={`tab-category-${tab.key}`}
                  onClick={() => setActiveCategory(tab.key)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? "bg-white text-black shadow-lg shadow-white/10"
                      : "bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/70 border border-white/[0.06]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl p-5 bg-white/[0.03] border border-white/[0.05] animate-pulse">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 mb-4" />
                  <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-white/5 rounded w-full mb-1" />
                  <div className="h-3 bg-white/5 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
              data-testid="text-empty-state"
            >
              <Layers className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <p className="text-white/50 text-lg font-medium">No agents in this category</p>
              <p className="text-white/25 text-sm mt-1">Try selecting a different category</p>
            </motion.div>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              <AnimatePresence mode="popLayout">
                {filteredItems.map((item, index) => {
                  const Icon = AGENT_TYPE_ICONS[item.type];
                  const accent = AGENT_TYPE_ACCENTS[item.type];
                  const isActive = item.status === "active";
                  const isDraft = item.status === "draft";
                  const toolCount = getToolsForAgentType(item.type).length;
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.3, delay: index * 0.04 }}
                      data-testid={`card-agent-${item.id}`}
                      onClick={() => setSelectedAgent(item)}
                      className="relative group cursor-pointer"
                    >
                      <div className={`absolute inset-0 rounded-2xl ${accent.glow} opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500`} />
                      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${accent.gradient} backdrop-blur-xl border border-white/[0.08] group-hover:border-white/[0.15] transition-all duration-300 p-5`}>
                        <div className="flex items-start justify-between mb-4">
                          <div className="w-12 h-12 rounded-2xl bg-white/[0.08] backdrop-blur-sm flex items-center justify-center border border-white/[0.06] group-hover:scale-110 transition-transform duration-300">
                            <Icon className="w-6 h-6 text-white/80" />
                          </div>
                          <span
                            data-testid={`badge-status-${item.id}`}
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider border ${
                              isActive
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                                : isDraft
                                ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"
                                : item.isTemplate
                                ? "bg-white/[0.06] text-white/35 border-white/[0.06]"
                                : "bg-blue-500/15 text-blue-400 border-blue-500/20"
                            }`}
                          >
                            {isActive ? "Active" : isDraft ? "Draft" : item.isTemplate ? "Available" : item.status}
                          </span>
                        </div>

                        <h3
                          className="font-semibold text-white text-[15px] mb-1 truncate"
                          data-testid={`text-agent-name-${item.id}`}
                        >
                          {item.name}
                        </h3>
                        <p className="text-[11px] text-white/30 mb-2" data-testid={`text-agent-type-${item.id}`}>
                          {AGENT_TYPE_LABELS[item.type]}
                        </p>
                        <p className="text-xs text-white/40 leading-relaxed line-clamp-2 mb-4 min-h-[2.5rem]">
                          {item.description}
                        </p>

                        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                          <span className="text-[11px] text-white/25 font-medium">{toolCount} tools</span>
                          <button
                            data-testid={`button-action-${item.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.isTemplate) {
                                setSelectedAgent(item);
                              } else {
                                setLocation(`/dashboard/agents/${item.id}`);
                              }
                            }}
                            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                              isActive || isDraft
                                ? "bg-white/[0.08] text-white/70 hover:bg-white/[0.12] hover:text-white"
                                : "bg-white/90 text-black hover:bg-white shadow-lg shadow-white/10"
                            }`}
                          >
                            {isActive || isDraft ? "Open" : "Get"}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedAgent && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
              onClick={() => setSelectedAgent(null)}
              data-testid="overlay-detail"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d0d] rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto border-t border-white/[0.08]"
              data-testid="sheet-agent-detail"
            >
              <div className="sticky top-0 bg-[#0d0d0d] z-10 pt-3 pb-2 px-6 rounded-t-3xl">
                <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-4" />
                <button
                  data-testid="button-close-detail"
                  onClick={() => setSelectedAgent(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-white/[0.06] hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>

              <div className="px-6 pb-8">
                <AgentDetailContent
                  item={selectedAgent}
                  onActivate={activateAgent}
                  onClose={() => setSelectedAgent(null)}
                  onOpen={(item) => {
                    setSelectedAgent(null);
                    setLocation(`/dashboard/agents/${item.id}`);
                  }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function AgentDetailContent({
  item,
  onActivate,
  onClose,
  onOpen,
}: {
  item: StoreItem;
  onActivate: (item: StoreItem) => void;
  onClose: () => void;
  onOpen: (item: StoreItem) => void;
}) {
  const Icon = AGENT_TYPE_ICONS[item.type];
  const accent = AGENT_TYPE_ACCENTS[item.type];
  const tools = getToolsForAgentType(item.type);
  const isActive = item.status === "active";
  const [activating, setActivating] = useState(false);

  const handleActivate = async () => {
    setActivating(true);
    try {
      await onActivate(item);
    } catch {
      setActivating(false);
    }
  };

  const voiceConfig = item.config as Record<string, unknown> | undefined;

  const toolsByCategory = useMemo(() => {
    const grouped: Record<string, typeof tools> = {};
    tools.forEach((tool) => {
      if (!grouped[tool.category]) grouped[tool.category] = [];
      grouped[tool.category].push(tool);
    });
    return grouped;
  }, [tools]);

  return (
    <div>
      <div className="flex items-start gap-5 mb-8">
        <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${accent.gradient} backdrop-blur-sm flex items-center justify-center border border-white/[0.08] shadow-xl flex-shrink-0`}>
          <Icon className="w-10 h-10 text-white/80" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-white tracking-tight" data-testid="text-detail-name">
            {item.name}
          </h2>
          <p className="text-sm text-white/35 mt-1" data-testid="text-detail-type">
            {AGENT_TYPE_LABELS[item.type]}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span
              data-testid="badge-detail-status"
              className={`inline-flex items-center px-3 py-1 rounded-lg text-[11px] font-semibold border ${
                isActive ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-white/[0.06] text-white/35 border-white/[0.06]"
              }`}
            >
              {isActive ? "Active" : item.isTemplate ? "Available" : item.status}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-lg text-[11px] font-medium bg-white/[0.04] text-white/30 border border-white/[0.06]">
              {tools.length} tools
            </span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">About</h3>
        <p className="text-sm text-white/55 leading-relaxed" data-testid="text-detail-description">
          {item.description}
        </p>
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
          Capabilities
        </h3>
        <div className="space-y-4" data-testid="list-tools">
          {Object.entries(toolsByCategory).map(([category, categoryTools]) => (
            <div key={category}>
              <p className="text-[11px] font-medium text-white/25 uppercase tracking-wider mb-2">{category}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categoryTools.map((tool) => (
                  <div
                    key={tool.name}
                    data-testid={`tool-${tool.name}`}
                    className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/[0.05] hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Wrench className="w-3.5 h-3.5 text-white/30" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white/70">{tool.name.replace(/_/g, " ")}</p>
                      <p className="text-[11px] text-white/30 mt-0.5 leading-relaxed">{tool.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Voice Configuration</h3>
        <div className="bg-white/[0.03] rounded-xl p-4 space-y-3 border border-white/[0.05]" data-testid="section-voice-config">
          {[
            { label: "Voice", value: (voiceConfig?.voice as string) || "Default" },
            { label: "Language", value: (voiceConfig?.language as string) || "English" },
            { label: "Speed", value: `${(voiceConfig?.speed as number) || 1.0}x` },
            { label: "VAD Sensitivity", value: String((voiceConfig?.vadSensitivity as number) || 0.5) },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center text-sm">
              <span className="text-white/30">{label}</span>
              <span className="text-white/70 font-medium text-xs bg-white/[0.04] px-2.5 py-1 rounded-md">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 bg-[#0d0d0d] pt-4 pb-2 border-t border-white/[0.06]">
        {!item.isTemplate ? (
          <button
            data-testid="button-open-agent"
            onClick={() => onOpen(item)}
            className="w-full py-3.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-all duration-200 shadow-lg shadow-white/10"
          >
            Configure Agent
          </button>
        ) : (
          <button
            data-testid="button-activate"
            onClick={handleActivate}
            disabled={activating}
            className="w-full py-3.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-all duration-200 disabled:opacity-50 shadow-lg shadow-white/10"
          >
            {activating ? "Creating..." : "Create Agent"}
          </button>
        )}
      </div>
    </div>
  );
}

export default AppStorePage;
