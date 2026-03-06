import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { BevProLogo, BevProWordmark } from "@/components/BevProLogo";
import { Mic, Store, Box, Briefcase, Sparkles, Database, Server, Building2, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type NavModal = "agents" | "integrations" | "venues" | "how-it-works" | null;

const AGENT_TYPES = [
  { icon: Sparkles, name: "BevOne", desc: "Your master concierge agent — monitors everything, answers any question, and coordinates across all systems." },
  { icon: Mic, name: "Voice POS", desc: "Process orders and payments using natural voice commands. Hands-free speed for bartenders and servers." },
  { icon: Store, name: "POS Integration", desc: "Syncs with Square, Toast, and other POS systems to unify your transaction data in real time." },
  { icon: Box, name: "Inventory Agent", desc: "Tracks stock levels, predicts shortages, and auto-reorders from your suppliers before you run out." },
  { icon: Briefcase, name: "Venue Agent", desc: "Manages events, staffing, calendars, and multi-venue operations from a single command center." },
];

const INTEGRATIONS = [
  { icon: Store, name: "POS Systems", desc: "Square, Toast, Clover — real-time sync of transactions, menus, and receipts." },
  { icon: Database, name: "External Databases", desc: "Connect Supabase, Convex, or custom Postgres databases for persistent data." },
  { icon: Server, name: "MCP Connections", desc: "Model Context Protocol endpoints for extending agent capabilities with external tools." },
  { icon: Sparkles, name: "RAG / Knowledge Base", desc: "Upload documents and menus so your agents can reference your own data in conversations." },
];

const HOW_IT_WORKS = [
  { step: "1", title: "Build Your Agent", desc: "Choose an agent type, configure its personality, voice, and connect your integrations — no code required." },
  { step: "2", title: "Connect Your Venue", desc: "Link your POS, upload your menus and docs, and invite your team. Multi-venue support built in." },
  { step: "3", title: "Go Live", desc: "Deploy to any device. Your agents handle orders, inventory, and operations while you focus on hospitality." },
];

export function Navbar() {
  const [openModal, setOpenModal] = useState<NavModal>(null);

  return (
    <>
      <motion.header
        className="fixed top-0 w-full z-50 px-6 py-8 flex justify-between items-center text-xs tracking-widest uppercase font-medium text-white/70"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        <div className="flex items-center gap-12">
          <Link href="/" className="flex items-center gap-2.5 mr-4">
            <BevProLogo size={28} />
            <BevProWordmark className="text-white" size="text-lg" />
          </Link>
          <nav className="hidden md:flex gap-8">
            <button
              data-testid="nav-agents"
              onClick={() => setOpenModal("agents")}
              className="hover:text-white transition-colors cursor-pointer bg-transparent border-none outline-none"
            >
              Agents
            </button>
            <button
              data-testid="nav-integrations"
              onClick={() => setOpenModal("integrations")}
              className="hover:text-white transition-colors cursor-pointer bg-transparent border-none outline-none"
            >
              Integrations
            </button>
            <button
              data-testid="nav-venues"
              onClick={() => setOpenModal("venues")}
              className="hover:text-white transition-colors cursor-pointer bg-transparent border-none outline-none"
            >
              Venues
            </button>
            <button
              data-testid="nav-how-it-works"
              onClick={() => setOpenModal("how-it-works")}
              className="hover:text-white transition-colors cursor-pointer bg-transparent border-none outline-none"
            >
              How It Works
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <Link href="/login" data-testid="link-sign-in" className="hidden md:block hover:text-white transition-colors">Sign In</Link>
          <Link href="/register" data-testid="link-start-building" className="border border-white/20 rounded-full px-5 py-2 hover:bg-white hover:text-black transition-all duration-300">
            Start Building
          </Link>
        </div>
      </motion.header>

      <Dialog open={openModal === "agents"} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="bg-black/95 border-white/10 text-white max-w-xl backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-white text-xl tracking-wide">AI Agent Types</DialogTitle>
            <DialogDescription className="text-white/50">
              Five specialized agents working together to run your venue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {AGENT_TYPES.map((agent) => {
              const Icon = agent.icon;
              return (
                <div key={agent.name} data-testid={`modal-agent-${agent.name.toLowerCase().replace(/\s+/g, "-")}`} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="mt-0.5 p-2 rounded-lg bg-white/[0.06]">
                    <Icon size={16} className="text-[#C9A96E]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/90">{agent.name}</p>
                    <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{agent.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openModal === "integrations"} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="bg-black/95 border-white/10 text-white max-w-xl backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-white text-xl tracking-wide">Integrations</DialogTitle>
            <DialogDescription className="text-white/50">
              Connect your existing tools and data sources seamlessly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {INTEGRATIONS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.name} data-testid={`modal-integration-${item.name.toLowerCase().replace(/\s+/g, "-")}`} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="mt-0.5 p-2 rounded-lg bg-white/[0.06]">
                    <Icon size={16} className="text-[#C9A96E]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/90">{item.name}</p>
                    <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openModal === "venues"} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="bg-black/95 border-white/10 text-white max-w-xl backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-white text-xl tracking-wide">Multi-Venue Support</DialogTitle>
            <DialogDescription className="text-white/50">
              Built for operators managing one location or a hundred.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div data-testid="modal-venues-info" className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3">
              <div className="flex items-start gap-3">
                <Building2 size={16} className="text-[#C9A96E] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white/90">Multi-Tenant Architecture</p>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">Each venue gets its own isolated data, agents, and configurations. Staff only see what they need.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 size={16} className="text-[#C9A96E] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white/90">Centralized Dashboard</p>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">Operators see performance across all venues in one view. Drill into any location instantly.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 size={16} className="text-[#C9A96E] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white/90">Per-Venue Agents</p>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">Deploy different agent configurations per location — each with its own menu, POS connection, and voice personality.</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openModal === "how-it-works"} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="bg-black/95 border-white/10 text-white max-w-xl backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-white text-xl tracking-wide">How It Works</DialogTitle>
            <DialogDescription className="text-white/50">
              From setup to live in three simple steps.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} data-testid={`modal-step-${item.step}`} className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="w-8 h-8 rounded-full bg-[#C9A96E]/20 border border-[#C9A96E]/30 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-[#C9A96E]">{item.step}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white/90">{item.title}</p>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
            <div className="pt-2 flex justify-center">
              <Link href="/register" onClick={() => setOpenModal(null)}>
                <button data-testid="modal-get-started" className="flex items-center gap-2 bg-[#C9A96E] text-black px-6 py-2.5 rounded-full text-sm font-medium hover:bg-[#D4B87A] transition-colors">
                  Get Started <ArrowRight size={14} />
                </button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
