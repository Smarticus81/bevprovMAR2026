import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Mic, Store, Box, Briefcase, Sparkles, Trash2, ExternalLink, ArrowRight, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const AGENT_TYPE_META: Record<string, { label: string; icon: any; shortLabel: string }> = {
  "bevone": { label: "BevOne — All-in-One", icon: Sparkles, shortLabel: "BevOne" },
  "voice-pos": { label: "Agentic Voice POS", icon: Mic, shortLabel: "Voice POS" },
  "pos-integration": { label: "POS Integration", icon: Store, shortLabel: "POS" },
  "inventory": { label: "Inventory Manager", icon: Box, shortLabel: "Inventory" },
  "venue-admin": { label: "Venue Agent", icon: Briefcase, shortLabel: "Venue" },
};

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { organization } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentType, setNewAgentType] = useState("bevone");

  const [, navigate] = useLocation();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch("/api/agents", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load agents");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; type: string }) => {
      const res = await apiRequest("POST", "/api/agents", data);
      return res.json();
    },
    onSuccess: (newAgent) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setShowCreate(false);
      setNewAgentName("");
      window.location.href = `/dashboard/agents/${newAgent.id}`;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const activeCount = agents.filter((a: any) => a.status === "active").length;
  const draftCount = agents.filter((a: any) => a.status === "draft").length;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 lg:py-16">
        <div className="mb-8 sm:mb-12">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#C9A96E]/50 font-medium mb-2 sm:mb-3">
            {organization?.name || "Your Venue"}
          </p>
          <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight mb-2" data-testid="text-dashboard-title">
            Voice Agents
          </h1>
          <p className="text-xs sm:text-sm text-white/30 max-w-md">
            Build and manage voice assistants for your venue.
          </p>
        </div>

        {!isLoading && agents.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-6 sm:mb-10 pb-6 sm:pb-8 border-b border-white/[0.04]">
            <div>
              <p className="text-xl sm:text-2xl font-light text-white">{agents.length}</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/20 mt-1">Total</p>
            </div>
            <div className="w-px h-8 bg-white/[0.06]" />
            <div>
              <p className="text-xl sm:text-2xl font-light text-emerald-400">{activeCount}</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/20 mt-1">Active</p>
            </div>
            {draftCount > 0 && (
              <>
                <div className="w-px h-8 bg-white/[0.06]" />
                <div>
                  <p className="text-xl sm:text-2xl font-light text-white/40">{draftCount}</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/20 mt-1">Drafts</p>
                </div>
              </>
            )}
            <div className="flex-1 min-w-0" />
            <button
              data-testid="button-create-agent"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-[#C9A96E] text-black px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold hover:bg-[#D4B87A] transition-all duration-300"
            >
              <Plus size={14} />
              New Agent
            </button>
          </div>
        )}

        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowCreate(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="bg-[#0A0A0A] w-full max-w-lg border border-white/[0.08]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 sm:p-6 border-b border-white/[0.06]">
                  <h2 className="text-base sm:text-lg font-light text-white">Create Voice Agent</h2>
                  <p className="text-xs text-white/25 mt-1">Choose a type and give your agent a name.</p>
                </div>

                <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.15em] text-white/25 font-medium block mb-3">Agent Name</label>
                    <input
                      data-testid="input-agent-name"
                      type="text"
                      value={newAgentName}
                      onChange={(e) => setNewAgentName(e.target.value)}
                      placeholder="e.g., Front Bar POS"
                      className="w-full bg-transparent border-0 border-b border-white/10 px-0 py-3 text-[15px] text-white placeholder:text-white/15 focus:outline-none focus:border-[#C9A96E]/40 transition-colors"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-[11px] uppercase tracking-[0.15em] text-white/25 font-medium block mb-3">Agent Type</label>
                    <div className="space-y-0.5">
                      {Object.entries(AGENT_TYPE_META).map(([type, meta]) => {
                        const Icon = meta.icon;
                        const selected = newAgentType === type;
                        return (
                          <button
                            key={type}
                            data-testid={`button-type-${type}`}
                            onClick={() => setNewAgentType(type)}
                            className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-all duration-200 relative ${
                              selected
                                ? "bg-white/[0.04] text-white"
                                : "text-white/30 hover:text-white/50 hover:bg-white/[0.02]"
                            }`}
                          >
                            {selected && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#C9A96E]" />
                            )}
                            <Icon size={16} className={selected ? "text-[#C9A96E]" : "text-white/15"} />
                            <span className="text-sm font-medium">{meta.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 sm:p-6 border-t border-white/[0.06]">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="text-sm text-white/25 hover:text-white/50 transition-colors"
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </button>
                  <button
                    data-testid="button-confirm-create"
                    onClick={() => createMutation.mutate({ name: newAgentName, type: newAgentType })}
                    disabled={!newAgentName.trim() || createMutation.isPending}
                    className="flex items-center gap-2 bg-[#C9A96E] text-black px-5 py-2 text-sm font-semibold hover:bg-[#D4B87A] disabled:opacity-40 transition-all duration-300"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Agent"}
                    <ArrowRight size={14} />
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="space-y-0">
            {[1, 2, 3].map((i) => (
              <div key={i} className="py-6 border-b border-white/[0.04] animate-pulse">
                <div className="h-4 w-40 bg-white/[0.04] mb-2" />
                <div className="h-3 w-24 bg-white/[0.02]" />
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="py-20">
            <div className="max-w-sm">
              <h2 className="text-xl font-light text-white mb-2">No agents yet</h2>
              <p className="text-sm text-white/25 mb-8 leading-relaxed">
                Create your first voice agent to start automating your venue operations — from taking orders to managing inventory.
              </p>
              <button
                data-testid="button-create-first-agent"
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 bg-[#C9A96E] text-black px-5 py-2.5 text-sm font-semibold hover:bg-[#D4B87A] transition-all duration-300"
              >
                <Plus size={14} />
                Create Your First Agent
              </button>
            </div>
          </div>
        ) : (
          <div>
            {agents.map((agent: any, index: number) => {
              const meta = AGENT_TYPE_META[agent.type] || AGENT_TYPE_META.bevone;
              const Icon = meta.icon;
              const isActive = agent.status === "active";
              return (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div
                    data-testid={`card-agent-${agent.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/dashboard/agents/${agent.id}`)}
                    onKeyDown={(e) => { if (e.key === "Enter") navigate(`/dashboard/agents/${agent.id}`); }}
                    className="flex items-center gap-3 sm:gap-4 py-4 sm:py-5 border-b border-white/[0.04] hover:bg-white/[0.015] transition-all duration-200 -mx-2 sm:-mx-3 px-2 sm:px-3 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`${isActive ? "text-[#C9A96E]" : "text-white/15"} transition-colors`}>
                        <Icon size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[15px] font-medium text-white/80 truncate group-hover:text-white transition-colors">
                            {agent.name}
                          </h3>
                          <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] font-medium ${
                            isActive ? "text-emerald-400/70" : "text-white/20"
                          }`}>
                            <span className={`w-1 h-1 rounded-full ${isActive ? "bg-emerald-400" : "bg-white/20"}`} />
                            {agent.status}
                          </span>
                        </div>
                        <p className="text-xs text-white/20 mt-0.5">{meta.shortLabel}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        data-testid={`button-launch-${agent.id}`}
                        onClick={(e) => { e.stopPropagation(); window.location.href = `/app/${agent.id}`; }}
                        className="text-[11px] uppercase tracking-[0.1em] text-white/20 hover:text-[#C9A96E] px-2 py-1 transition-colors"
                      >
                        Launch
                      </button>
                      <button
                        data-testid={`button-delete-${agent.id}`}
                        aria-label={`Delete ${agent.name}`}
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(agent.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-white/15 hover:text-red-400/70 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                      <ChevronRight size={14} className="text-white/10 group-hover:text-white/25 transition-colors" />
                    </div>
                  </div>
                </motion.div>
              );
            })}

            <button
              data-testid="button-create-agent-bottom"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 text-white/20 hover:text-white/40 text-sm py-5 transition-colors"
            >
              <Plus size={14} />
              Add another agent
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
