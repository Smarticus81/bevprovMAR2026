import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Link } from "wouter";
import { Plus, Mic, Store, Box, Briefcase, Sparkles, Trash2, Bot, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const AGENT_TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  "bevone": { label: "BevOne", icon: Sparkles, color: "text-purple-400" },
  "voice-pos": { label: "Agentic Voice POS", icon: Mic, color: "text-blue-400" },
  "pos-integration": { label: "POS Integration", icon: Store, color: "text-green-400" },
  "inventory": { label: "Inventory Manager", icon: Box, color: "text-amber-400" },
  "venue-admin": { label: "Venue Agent", icon: Briefcase, color: "text-rose-400" },
};

const STATUS_BADGE: Record<string, string> = {
  draft: "border-white/10 text-white/40",
  active: "border-green-500/30 text-green-400",
  paused: "border-yellow-500/30 text-yellow-400",
};

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentType, setNewAgentType] = useState("bevone");

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

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-10 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white">Voice Agents</h1>
            <p className="text-sm text-white/30 mt-1">Create and manage your venue's voice assistants.</p>
          </div>
          <button
            data-testid="button-create-agent"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 border border-white/20 text-white px-4 py-2.5 rounded-full text-sm font-medium hover:bg-white hover:text-black transition-all duration-300"
          >
            <Plus size={16} />
            New Agent
          </button>
        </div>

        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowCreate(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-black rounded-2xl p-6 w-full max-w-lg shadow-xl border border-white/10"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg font-semibold text-white mb-4">Create Voice Agent</h2>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-white/40 block mb-1.5">Agent Name</label>
                    <input
                      data-testid="input-agent-name"
                      type="text"
                      value={newAgentName}
                      onChange={(e) => setNewAgentName(e.target.value)}
                      placeholder="e.g., Front Bar POS"
                      className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-white/40 block mb-2">Agent Type</label>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(AGENT_TYPE_META).map(([type, meta]) => {
                        const Icon = meta.icon;
                        return (
                          <button
                            key={type}
                            data-testid={`button-type-${type}`}
                            onClick={() => setNewAgentType(type)}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 text-left ${
                              newAgentType === type
                                ? "border-white/30 bg-white/[0.04]"
                                : "border-white/5 hover:border-white/15 bg-transparent"
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center border border-white/10 ${meta.color}`}>
                              <Icon size={18} />
                            </div>
                            <span className="text-sm font-medium text-white/80">{meta.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 text-sm text-white/40 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    data-testid="button-confirm-create"
                    onClick={() => createMutation.mutate({ name: newAgentName, type: newAgentType })}
                    disabled={!newAgentName.trim() || createMutation.isPending}
                    className="border border-white/20 text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-white hover:text-black disabled:opacity-50 transition-all duration-300"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Agent"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/[0.02] rounded-2xl p-6 animate-pulse h-48 border border-white/5" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Bot size={32} className="text-white/20" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">No agents yet</h3>
            <p className="text-sm text-white/30 mb-6">Create your first voice agent to get started.</p>
            <button
              data-testid="button-create-first-agent"
              onClick={() => setShowCreate(true)}
              className="border border-white/20 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-white hover:text-black transition-all duration-300"
            >
              Create Your First Agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent: any) => {
              const meta = AGENT_TYPE_META[agent.type] || AGENT_TYPE_META.bevone;
              const Icon = meta.icon;
              return (
                <Link key={agent.id} href={`/dashboard/agents/${agent.id}`}>
                  <div
                    data-testid={`card-agent-${agent.id}`}
                    className="bg-white/[0.02] rounded-2xl p-6 hover:bg-white/[0.04] transition-all duration-300 cursor-pointer group border border-white/10 hover:border-white/20"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border border-white/10 ${meta.color}`}>
                        <Icon size={22} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_BADGE[agent.status] || STATUS_BADGE.draft}`}>
                          {agent.status}
                        </span>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteMutation.mutate(agent.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/5 text-white/20 hover:text-red-400 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <h3 className="font-semibold text-white/90 mb-1">{agent.name}</h3>
                    <p className="text-xs text-white/30 mb-3">{meta.label}</p>
                    <button
                        data-testid={`button-launch-${agent.id}`}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/app/${agent.id}`; }}
                        className="flex items-center gap-1.5 border border-white/15 text-white/50 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-white hover:text-black transition-all duration-300"
                      >
                        <ExternalLink size={12} />
                        Launch
                      </button>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
