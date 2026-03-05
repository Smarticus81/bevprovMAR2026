import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Star, Sparkles, ShoppingCart, Package, Building2, Layers, Mic, ChevronRight, Wrench, Volume2 } from "lucide-react";
import { Agent, AGENT_TYPES, AGENT_TYPE_LABELS, AGENT_TYPE_DESCRIPTIONS, AgentType } from "@shared/schema";
import { getToolsForAgentType } from "@/lib/agentTools";
import { apiRequest } from "@/lib/queryClient";

const CATEGORY_TABS = [
  { key: "all", label: "All", icon: Layers },
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

const AGENT_TYPE_COLORS: Record<AgentType, string> = {
  "pos-integration": "from-blue-500 to-blue-600",
  "voice-pos": "from-purple-500 to-purple-600",
  "inventory": "from-green-500 to-green-600",
  "venue-admin": "from-orange-500 to-orange-600",
  "bevone": "from-gray-900 to-gray-800",
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
  const [searchQuery, setSearchQuery] = useState("");
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
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        activeCategory === "all" || AGENT_TYPE_CATEGORY[item.type] === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [storeItems, searchQuery, activeCategory]);

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
      <div className="min-h-screen bg-[#f5f5f7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            data-testid="banner-featured"
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 sm:p-10 mb-8 cursor-pointer"
            onClick={() => {
              const bevone = storeItems.find((i) => i.type === "bevone");
              if (bevone) setSelectedAgent(bevone);
            }}
          >
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-purple-500/40 to-transparent rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-blue-500/30 to-transparent rounded-full blur-2xl" />
            </div>
            <div className="relative z-10 flex items-center gap-6">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[22px] bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-sm flex items-center justify-center border border-white/10 shadow-2xl flex-shrink-0">
                <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">Featured</span>
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight" data-testid="text-featured-name">
                  BevOne
                </h2>
                <p className="text-sm sm:text-base text-gray-300 mt-1 max-w-lg" data-testid="text-featured-description">
                  {AGENT_TYPE_DESCRIPTIONS["bevone"]}
                </p>
                <div className="flex items-center gap-3 mt-4">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-medium backdrop-blur-sm">
                    <Wrench className="w-3 h-3" /> 20+ Tools
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-medium backdrop-blur-sm">
                    <Volume2 className="w-3 h-3" /> Voice Enabled
                  </span>
                </div>
              </div>
              <div className="hidden sm:block flex-shrink-0">
                <ChevronRight className="w-6 h-6 text-gray-400" />
              </div>
            </div>
          </motion.div>

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              data-testid="input-search"
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3 bg-white rounded-xl border-0 shadow-sm text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 transition-shadow"
            />
            {searchQuery && (
              <button
                data-testid="button-clear-search"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          <div className="flex gap-2 mb-8 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORY_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeCategory === tab.key;
              return (
                <button
                  key={tab.key}
                  data-testid={`tab-category-${tab.key}`}
                  onClick={() => setActiveCategory(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-gray-900 text-white shadow-md"
                      : "bg-white text-gray-600 hover:bg-gray-100 shadow-sm"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-5 shadow-sm animate-pulse">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-[14px] bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
              data-testid="text-empty-state"
            >
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg font-medium">No agents found</p>
              <p className="text-gray-400 text-sm mt-1">Try adjusting your search or category filter</p>
            </motion.div>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              <AnimatePresence mode="popLayout">
                {filteredItems.map((item, index) => {
                  const Icon = AGENT_TYPE_ICONS[item.type];
                  const gradient = AGENT_TYPE_COLORS[item.type];
                  const isActive = item.status === "active";
                  const isDraft = item.status === "draft";
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      data-testid={`card-agent-${item.id}`}
                      onClick={() => setSelectedAgent(item)}
                      className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-14 h-14 rounded-[14px] bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg flex-shrink-0 group-hover:scale-105 transition-transform`}
                        >
                          <Icon className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3
                              className="font-semibold text-gray-900 text-sm truncate"
                              data-testid={`text-agent-name-${item.id}`}
                            >
                              {item.name}
                            </h3>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5" data-testid={`text-agent-type-${item.id}`}>
                            {AGENT_TYPE_LABELS[item.type]}
                          </p>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                        <span
                          data-testid={`badge-status-${item.id}`}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            isActive
                              ? "bg-green-100 text-green-700"
                              : isDraft
                              ? "bg-yellow-100 text-yellow-700"
                              : item.isTemplate
                              ? "bg-gray-100 text-gray-500"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {isActive ? "Active" : isDraft ? "Draft" : item.isTemplate ? "Available" : item.status}
                        </span>
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
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                            isActive
                              ? "bg-gray-100 text-gray-900 hover:bg-gray-200"
                              : "bg-blue-500 text-white hover:bg-blue-600"
                          }`}
                        >
                          {isActive || isDraft ? "OPEN" : "GET"}
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
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setSelectedAgent(null)}
              data-testid="overlay-detail"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto"
              data-testid="sheet-agent-detail"
            >
              <div className="sticky top-0 bg-white z-10 pt-3 pb-2 px-6 rounded-t-3xl">
                <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
                <button
                  data-testid="button-close-detail"
                  onClick={() => setSelectedAgent(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
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
  const gradient = AGENT_TYPE_COLORS[item.type];
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

  return (
    <div>
      <div className="flex items-start gap-5 mb-6">
        <div
          className={`w-20 h-20 rounded-[20px] bg-gradient-to-br ${gradient} flex items-center justify-center shadow-xl flex-shrink-0`}
        >
          <Icon className="w-10 h-10 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-900" data-testid="text-detail-name">
            {item.name}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5" data-testid="text-detail-type">
            {AGENT_TYPE_LABELS[item.type]}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span
              data-testid="badge-detail-status"
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {isActive ? "Active" : item.isTemplate ? "Available" : item.status}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
        <p className="text-sm text-gray-600 leading-relaxed" data-testid="text-detail-description">
          {item.description}
        </p>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Tools <span className="text-gray-400 font-normal">({tools.length})</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="list-tools">
          {tools.map((tool) => (
            <div
              key={tool.name}
              data-testid={`tool-${tool.name}`}
              className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl"
            >
              <Wrench className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-800">{tool.name.replace(/_/g, " ")}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{tool.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Voice Configuration</h3>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2" data-testid="section-voice-config">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Voice</span>
            <span className="text-gray-900 font-medium">{(voiceConfig?.voice as string) || "Default"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Language</span>
            <span className="text-gray-900 font-medium">{(voiceConfig?.language as string) || "English"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Speed</span>
            <span className="text-gray-900 font-medium">{(voiceConfig?.speed as number) || 1.0}x</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">VAD Sensitivity</span>
            <span className="text-gray-900 font-medium">{(voiceConfig?.vadSensitivity as number) || 0.5}</span>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 bg-white pt-4 pb-2 border-t border-gray-100">
        {!item.isTemplate ? (
          <button
            data-testid="button-open-agent"
            onClick={() => onOpen(item)}
            className="w-full py-3.5 rounded-2xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-colors"
          >
            Configure Agent
          </button>
        ) : (
          <button
            data-testid="button-activate"
            onClick={handleActivate}
            disabled={activating}
            className="w-full py-3.5 rounded-2xl bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {activating ? "Creating..." : "Create Agent"}
          </button>
        )}
      </div>
    </div>
  );
}

export default AppStorePage;
