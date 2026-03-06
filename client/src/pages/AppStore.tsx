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
              className="relative mb-10 cursor-pointer group border-b border-line-subtle pb-8"
              onClick={() => setSelectedAgent(bevoneItem)}
            >
              <div className="relative z-10 flex items-center gap-6 sm:gap-8">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-accent-bg flex items-center justify-center border border-accent-border flex-shrink-0 group-hover:bg-accent-bg transition-all duration-500">
                  <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="text-xs font-semibold text-accent uppercase tracking-[0.15em]">Featured</span>
                    <Star className="w-3.5 h-3.5 text-accent fill-[#C9A96E]" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight" data-testid="text-featured-name">
                    BevOne
                  </h2>
                  <p className="text-[13px] text-ink-faint mt-1.5 max-w-md leading-relaxed" data-testid="text-featured-description">
                    {AGENT_TYPE_DESCRIPTIONS["bevone"]}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-accent/70 text-xs font-medium border border-accent-border bg-accent-bg">
                      <Wrench className="w-3.5 h-3.5" /> 20+ Tools
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-accent/70 text-xs font-medium border border-accent-border bg-accent-bg">
                      <Volume2 className="w-3.5 h-3.5" /> Voice
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-accent/70 text-xs font-medium border border-accent-border bg-accent-bg">
                      <Zap className="w-3.5 h-3.5" /> All-in-One
                    </span>
                  </div>
                </div>
                <div className="hidden sm:flex flex-shrink-0 w-10 h-10 items-center justify-center border border-line-subtle group-hover:border-accent-border transition-colors">
                  <ArrowRight className="w-5 h-5 text-ink-faint group-hover:text-accent transition-colors" />
                </div>
              </div>
            </motion.div>
          )}

          <div className="flex items-center gap-0 mb-8 border-b border-line-subtle overflow-x-auto">
            {CATEGORY_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeCategory === tab.key;
              return (
                <button
                  key={tab.key}
                  data-testid={`tab-category-${tab.key}`}
                  onClick={() => setActiveCategory(tab.key)}
                  className={`relative flex items-center gap-2 px-5 py-4 text-base font-medium whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? "text-accent"
                      : "text-ink-faint hover:text-ink-secondary"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="category-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-5 bg-surface-1 border border-line-subtle animate-pulse">
                  <div className="w-10 h-10 bg-surface-4 mb-4" />
                  <div className="h-4 bg-surface-4 w-3/4 mb-2" />
                  <div className="h-3 bg-surface-2 w-full mb-1" />
                  <div className="h-3 bg-surface-2 w-2/3" />
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
              <Layers className="w-12 h-12 text-ink-ghost mx-auto mb-4" />
              <p className="text-ink-muted text-lg font-medium">No agents in this category</p>
              <p className="text-ink-faint text-sm mt-1">Try selecting a different category</p>
            </motion.div>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              <AnimatePresence mode="popLayout">
                {filteredItems.map((item, index) => {
                  const Icon = AGENT_TYPE_ICONS[item.type];
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
                      className="relative group cursor-pointer bg-surface-1 border border-line-subtle hover:border-accent-border transition-all duration-300 p-5"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-accent-bg flex items-center justify-center border border-accent-border group-hover:bg-accent-bg transition-all duration-300">
                          <Icon className="w-5 h-5 text-accent" />
                        </div>
                        <span
                          data-testid={`badge-status-${item.id}`}
                          className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${
                            isActive
                              ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                              : isDraft
                              ? "text-accent bg-accent-bg border border-accent-border"
                              : item.isTemplate
                              ? "text-ink-faint bg-surface-2 border border-line-subtle"
                              : "text-blue-400 bg-blue-500/10 border border-blue-500/20"
                          }`}
                        >
                          {isActive ? "Active" : isDraft ? "Draft" : item.isTemplate ? "Available" : item.status}
                        </span>
                      </div>

                      <h3
                        className="font-semibold text-ink text-base mb-1 truncate"
                        data-testid={`text-agent-name-${item.id}`}
                      >
                        {item.name}
                      </h3>
                      <p className="text-xs text-ink-faint mb-2" data-testid={`text-agent-type-${item.id}`}>
                        {AGENT_TYPE_LABELS[item.type]}
                      </p>
                      <p className="text-[13px] text-ink-faint leading-relaxed line-clamp-2 mb-4 min-h-[2.5rem]">
                        {item.description}
                      </p>

                      <div className="flex items-center justify-between pt-3 border-t border-line-subtle">
                        <span className="text-xs text-ink-faint font-medium">{toolCount} tools</span>
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
                          className={`px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                            isActive || isDraft
                              ? "bg-surface-3 text-ink-secondary hover:bg-surface-4 hover:text-ink border border-line-subtle"
                              : "bg-accent text-black hover:bg-accent/90"
                          }`}
                        >
                          {isActive || isDraft ? "Open" : "Get"}
                        </button>
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
              className="fixed inset-0 bg-backdrop backdrop-blur-md z-50"
              onClick={() => setSelectedAgent(null)}
              data-testid="overlay-detail"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card max-h-[85vh] overflow-y-auto border-t border-accent-border"
              data-testid="sheet-agent-detail"
            >
              <div className="sticky top-0 bg-card z-10 pt-3 pb-2 px-6">
                <div className="w-10 h-0.5 bg-accent/30 mx-auto mb-4" />
                <button
                  data-testid="button-close-detail"
                  onClick={() => setSelectedAgent(null)}
                  className="absolute top-4 right-4 p-2.5 hover:bg-surface-3 transition-colors"
                >
                  <X className="w-5 h-5 text-ink-muted" />
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
        <div className="w-16 h-16 bg-accent-bg flex items-center justify-center border border-accent-border flex-shrink-0">
          <Icon className="w-8 h-8 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-ink tracking-tight" data-testid="text-detail-name">
            {item.name}
          </h2>
          <p className="text-sm text-ink-faint mt-1" data-testid="text-detail-type">
            {AGENT_TYPE_LABELS[item.type]}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span
              data-testid="badge-detail-status"
              className={`inline-flex items-center px-3 py-1 text-xs font-semibold border ${
                isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-surface-2 text-ink-faint border-line-subtle"
              }`}
            >
              {isActive ? "Active" : item.isTemplate ? "Available" : item.status}
            </span>
            <span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-surface-1 text-ink-faint border border-line-subtle">
              {tools.length} tools
            </span>
          </div>
        </div>
      </div>

      <div className="mb-6 pb-6 border-b border-line-subtle">
        <h3 className="text-sm font-semibold text-accent/70 uppercase tracking-[0.15em] mb-3">About</h3>
        <p className="text-[15px] text-ink-muted leading-relaxed" data-testid="text-detail-description">
          {item.description}
        </p>
      </div>

      <div className="mb-6 pb-6 border-b border-line-subtle">
        <h3 className="text-sm font-semibold text-accent/70 uppercase tracking-[0.15em] mb-3">
          Capabilities
        </h3>
        <div className="space-y-4" data-testid="list-tools">
          {Object.entries(toolsByCategory).map(([category, categoryTools]) => (
            <div key={category}>
              <p className="text-xs font-medium text-ink-faint uppercase tracking-wider mb-2">{category}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categoryTools.map((tool) => (
                  <div
                    key={tool.name}
                    data-testid={`tool-${tool.name}`}
                    className="flex items-start gap-3 p-3 bg-surface-1 border border-line-subtle hover:border-accent-border transition-colors"
                  >
                    <div className="w-7 h-7 bg-accent-bg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Wrench className="w-3.5 h-3.5 text-accent/60" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-secondary">{tool.name.replace(/_/g, " ")}</p>
                      <p className="text-xs text-ink-faint mt-0.5 leading-relaxed">{tool.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-semibold text-accent/70 uppercase tracking-[0.15em] mb-3">Voice Configuration</h3>
        <div className="bg-surface-1 p-4 space-y-3 border border-line-subtle" data-testid="section-voice-config">
          {[
            { label: "Voice", value: (voiceConfig?.voice as string) || "Default" },
            { label: "Language", value: (voiceConfig?.language as string) || "English" },
            { label: "Speed", value: `${(voiceConfig?.speed as number) || 1.0}x` },
            { label: "VAD Sensitivity", value: String((voiceConfig?.vadSensitivity as number) || 0.5) },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center text-sm">
              <span className="text-ink-faint">{label}</span>
              <span className="text-ink-secondary font-medium text-sm bg-surface-1 px-3 py-1.5 border border-line-subtle">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 bg-card pt-4 pb-2 border-t border-line-subtle">
        {!item.isTemplate ? (
          <button
            data-testid="button-open-agent"
            onClick={() => onOpen(item)}
            className="w-full py-4 bg-accent text-black font-semibold text-base hover:bg-accent/90 transition-all duration-200"
          >
            Configure Agent
          </button>
        ) : (
          <button
            data-testid="button-activate"
            onClick={handleActivate}
            disabled={activating}
            className="w-full py-4 bg-accent text-black font-semibold text-base hover:bg-accent/90 transition-all duration-200 disabled:opacity-50"
          >
            {activating ? "Creating..." : "Create Agent"}
          </button>
        )}
      </div>
    </div>
  );
}

export default AppStorePage;
