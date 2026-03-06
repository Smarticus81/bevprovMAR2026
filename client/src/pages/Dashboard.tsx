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
        <div className="mb-6 sm:mb-10">
          <p className="text-xs uppercase tracking-[0.25em] text-[#C9A96E]/60 font-medium mb-2 sm:mb-3">
            {organization?.name || "Your Venue"}
          </p>
          <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight mb-2" data-testid="text-dashboard-title">
            Voice Agents
          </h1>
          <p className="text-sm text-white/40 max-w-md">
            Build and manage voice assistants for your venue.
          </p>
        </div>

        {!isLoading && agents.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-white/[0.06]">
            <div>
              <p className="text-xl sm:text-2xl font-light text-white">{agents.length}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-white/40 mt-1">Total</p>
            </div>
            <div className="w-px h-8 bg-white/[0.08]" />
            <div>
              <p className="text-xl sm:text-2xl font-light text-emerald-400">{activeCount}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-white/40 mt-1">Active</p>
            </div>
            {draftCount > 0 && (
              <>
                <div className="w-px h-8 bg-white/[0.08]" />
                <div>
                  <p className="text-xl sm:text-2xl font-light text-white/50">{draftCount}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40 mt-1">Drafts</p>
                </div>
              </>
            )}
            <div className="flex-1 min-w-0" />
            <button
              data-testid="button-create-agent"
              onClick={() => setShowCreate(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#C9A96E] text-black px-5 py-3 text-sm font-semibold hover:bg-[#D4B87A] transition-all duration-300"
            >
              <Plus size={16} />
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
                className="bg-[#0A0A0A] w-full max-w-lg border border-white/[0.08] rounded-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-5 sm:p-6 border-b border-white/[0.06]">
                  <h2 className="text-lg sm:text-xl font-light text-white">Create Voice Agent</h2>
                  <p className="text-sm text-white/40 mt-1">Choose a type and give your agent a name.</p>
                </div>

                <div className="p-5 sm:p-6 space-y-6">
                  <div>
                    <label className="text-xs uppercase tracking-[0.15em] text-white/50 font-medium block mb-3">Agent Name</label>
                    <input
                      data-testid="input-agent-name"
                      type="text"
                      value={newAgentName}
                      onChange={(e) => setNewAgentName(e.target.value)}
                      placeholder="e.g., Front Bar POS"
                      className="w-full bg-white/[0.04] border border-white/10 rounded px-4 py-3.5 text-base text-white placeholder:text-white/25 focus:outline-none focus:border-[#C9A96E]/50 transition-colors"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-[0.15em] text-white/50 font-medium block mb-3">Agent Type</label>
                    <div className="space-y-1.5">
                      {Object.entries(AGENT_TYPE_META).map(([type, meta]) => {
                        const Icon = meta.icon;
                        const selected = newAgentType === type;
                        return (
                          <button
                            key={type}
                            data-testid={`button-type-${type}`}
                            onClick={() => setNewAgentType(type)}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all duration-200 relative rounded ${
                              selected
                                ? "bg-[#C9A96E]/10 border border-[#C9A96E]/30 text-white"
                                : "bg-white/[0.02] border border-white/[0.06] text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                            }`}
                          >
                            <Icon size={18} className={selected ? "text-[#C9A96E]" : "text-white/25"} />
                            <span className="text-sm font-medium">{meta.label}</span>
                            {selected && (
                              <div className="ml-auto w-2 h-2 rounded-full bg-[#C9A96E]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-5 sm:p-6 border-t border-white/[0.06]">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="text-sm text-white/40 hover:text-white/60 transition-colors px-4 py-2"
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </button>
                  <button
                    data-testid="button-confirm-create"
                    onClick={() => createMutation.mutate({ name: newAgentName, type: newAgentType })}
                    disabled={!newAgentName.trim() || createMutation.isPending}
                    className="flex items-center gap-2 bg-[#C9A96E] text-black px-6 py-3 text-sm font-semibold hover:bg-[#D4B87A] disabled:opacity-40 transition-all duration-300 rounded"
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
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-5 border border-white/[0.06] rounded-lg animate-pulse">
                <div className="h-5 w-40 bg-white/[0.06] rounded mb-3" />
                <div className="h-4 w-24 bg-white/[0.04] rounded" />
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="py-16 text-center sm:text-left">
            <div className="max-w-md mx-auto sm:mx-0">
              <div className="w-14 h-14 rounded-full bg-[#C9A96E]/10 flex items-center justify-center mb-5">
                <Sparkles size={24} className="text-[#C9A96E]" />
              </div>
              <h2 className="text-xl sm:text-2xl font-light text-white mb-3">Ready to get started?</h2>
              <p className="text-sm text-white/40 mb-8 leading-relaxed">
                Create your first voice agent and start automating your venue — from taking orders to managing inventory. It only takes a minute.
              </p>
              <button
                data-testid="button-create-first-agent"
                onClick={() => setShowCreate(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#C9A96E] text-black px-6 py-3.5 text-base font-semibold hover:bg-[#D4B87A] transition-all duration-300 rounded"
              >
                <Plus size={18} />
                Create Your First Agent
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
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
                    className="border border-white/[0.08] rounded-lg p-4 sm:p-5 hover:bg-white/[0.03] hover:border-white/[0.12] transition-all duration-200 cursor-pointer group"
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive ? "bg-[#C9A96E]/10" : "bg-white/[0.04]"
                      }`}>
                        <Icon size={20} className={isActive ? "text-[#C9A96E]" : "text-white/30"} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1">
                          <h3 className="text-base font-medium text-white truncate group-hover:text-white transition-colors">
                            {agent.name}
                          </h3>
                          <span className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                            isActive
                              ? "bg-emerald-400/15 text-emerald-400"
                              : "bg-white/[0.06] text-white/40"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-white/30"}`} />
                            {agent.status}
                          </span>
                        </div>
                        <p className="text-[13px] text-white/40">{meta.shortLabel}</p>
                        {agent.description && (
                          <p className="text-sm text-white/30 mt-1 truncate">{agent.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-center">
                        <button
                          data-testid={`button-launch-${agent.id}`}
                          onClick={(e) => { e.stopPropagation(); window.location.href = `/app/${agent.id}`; }}
                          className="hidden sm:flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-[#C9A96E]/80 hover:text-[#C9A96E] bg-[#C9A96E]/10 hover:bg-[#C9A96E]/15 px-3 py-2 rounded transition-colors"
                        >
                          <ExternalLink size={13} />
                          Launch
                        </button>
                        <button
                          data-testid={`button-delete-${agent.id}`}
                          aria-label={`Delete ${agent.name}`}
                          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(agent.id); }}
                          className="p-2 text-white/20 hover:text-red-400/80 hover:bg-red-400/10 rounded transition-all"
                        >
                          <Trash2 size={15} />
                        </button>
                        <ChevronRight size={16} className="text-white/15 group-hover:text-white/30 transition-colors" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            <button
              data-testid="button-create-agent-bottom"
              onClick={() => setShowCreate(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 text-white/40 hover:text-white/60 border border-dashed border-white/[0.08] hover:border-white/[0.15] rounded-lg text-sm py-4 transition-colors mt-2"
            >
              <Plus size={16} />
              Add another agent
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
