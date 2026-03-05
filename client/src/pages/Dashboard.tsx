import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Link } from "wouter";
import { Plus, Mic, Store, Box, Briefcase, Sparkles, MoreVertical, Trash2, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const AGENT_TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  "bevone": { label: "BevOne", icon: Sparkles, color: "bg-purple-100 text-purple-700" },
  "voice-pos": { label: "Agentic Voice POS", icon: Mic, color: "bg-blue-100 text-blue-700" },
  "pos-integration": { label: "POS Integration", icon: Store, color: "bg-green-100 text-green-700" },
  "inventory": { label: "Inventory Manager", icon: Box, color: "bg-amber-100 text-amber-700" },
  "venue-admin": { label: "Venue Agent", icon: Briefcase, color: "bg-rose-100 text-rose-700" },
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setShowCreate(false);
      setNewAgentName("");
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
            <h1 className="text-2xl font-semibold text-gray-900">Voice Agents</h1>
            <p className="text-sm text-gray-500 mt-1">Create and manage your venue's voice assistants.</p>
          </div>
          <button
            data-testid="button-create-agent"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus size={16} />
            New Agent
          </button>
        </div>

        {/* CREATE MODAL */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
              onClick={() => setShowCreate(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Voice Agent</h2>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Agent Name</label>
                    <input
                      data-testid="input-agent-name"
                      type="text"
                      value={newAgentName}
                      onChange={(e) => setNewAgentName(e.target.value)}
                      placeholder="e.g., Front Bar POS"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">Agent Type</label>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(AGENT_TYPE_META).map(([type, meta]) => {
                        const Icon = meta.icon;
                        return (
                          <button
                            key={type}
                            data-testid={`button-type-${type}`}
                            onClick={() => setNewAgentType(type)}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                              newAgentType === type
                                ? "border-gray-900 bg-gray-50"
                                : "border-gray-100 hover:border-gray-300"
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.color}`}>
                              <Icon size={18} />
                            </div>
                            <span className="text-sm font-medium text-gray-900">{meta.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    data-testid="button-confirm-create"
                    onClick={() => createMutation.mutate({ name: newAgentName, type: newAgentType })}
                    disabled={!newAgentName.trim() || createMutation.isPending}
                    className="bg-gray-900 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Agent"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AGENTS GRID */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 animate-pulse h-48" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Bot size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No agents yet</h3>
            <p className="text-sm text-gray-500 mb-6">Create your first voice agent to get started.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
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
                    className="bg-white rounded-2xl p-6 hover:shadow-lg transition-all cursor-pointer group border border-gray-100 hover:border-gray-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${meta.color}`}>
                        <Icon size={22} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[agent.status] || STATUS_BADGE.draft}`}>
                          {agent.status}
                        </span>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteMutation.mutate(agent.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{agent.name}</h3>
                    <p className="text-xs text-gray-500">{meta.label}</p>
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
