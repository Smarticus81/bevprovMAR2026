import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/layout/Navbar";
import { ArrowUp, Mic, Store, Box, Briefcase, Plus, Sparkles, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

import champagneVideo from "@/assets/videos/champagne-bg.mp4";

const AGENTS = [
  { id: "bevone", name: "BevOne", description: "The all-in-one comprehensive venue assistant.", icon: Sparkles },
  { id: "voice-pos", name: "Agentic Voice POS", description: "Fully voice-controlled point of sale system.", icon: Mic },
  { id: "pos-integration", name: "POS Integration Agent", description: "Seamless voice layer for Square & Toast.", icon: Store },
  { id: "inventory", name: "Inventory Manager", description: "Track stock and sync with POS automatically.", icon: Box },
  { id: "venue-admin", name: "Venue Agent", description: "Administrative oversight and operational tasks.", icon: Briefcase }
];

export default function Home() {
  const [activeAgent, setActiveAgent] = useState("bevone");
  const [isHovering, setIsHovering] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const waitlistMutation = useMutation({
    mutationFn: async (data: { email: string; agentType: string; message: string }) => {
      const res = await apiRequest("POST", "/api/waitlist", data);
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      setInputValue("");
    }
  });

  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    waitlistMutation.mutate({
      email: inputValue.trim(),
      agentType: activeAgent,
      message: AGENTS.find(a => a.id === activeAgent)?.name || activeAgent
    });
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative font-sans">
      <Navbar />

      <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none">
        <div className="absolute inset-0 bg-black z-10 opacity-40"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black z-10"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black z-10"></div>
        
        <motion.div 
          className="w-[120vw] h-[120vh] opacity-80"
          animate={{ scale: isHovering ? 1.05 : 1 }}
          transition={{ duration: 2, ease: "easeOut" }}
        >
          <video 
            src={champagneVideo} 
            autoPlay 
            loop 
            muted 
            playsInline 
            className="w-full h-full object-cover mask-radial" 
          />
        </motion.div>
      </div>

      <main className="relative z-10 h-screen flex flex-col items-center justify-center px-6">
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <h1 data-testid="text-hero-title" className="text-[12vw] md:text-[9vw] font-medium tracking-tight leading-none text-glow text-white/90">
            BevOne
          </h1>
          <p data-testid="text-hero-subtitle" className="text-white/50 text-sm md:text-base tracking-wide mt-4 max-w-lg mx-auto font-light">
            The voice app builder for event and wedding venues.
          </p>
        </motion.div>

        <motion.div 
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-input rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-4"
              >
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                  <Check size={24} className="text-white" />
                </div>
                <p data-testid="text-success-message" className="text-white/80 text-lg font-light">You're on the list. We'll be in touch.</p>
                <button 
                  data-testid="button-submit-another"
                  onClick={() => setSubmitted(false)}
                  className="text-white/40 text-xs hover:text-white transition-colors mt-2"
                >
                  Submit another
                </button>
              </motion.div>
            ) : (
              <motion.div key="form" className="glass-input rounded-2xl p-2 flex flex-col transition-all duration-300">
                <div className="px-4 pt-3 pb-8">
                  <input 
                    data-testid="input-email"
                    type="email" 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="Enter your email to get early access" 
                    className="w-full bg-transparent border-none outline-none text-lg text-white placeholder:text-white/30 font-light"
                  />
                </div>
                
                <div className="flex items-center justify-between border-t border-white/10 pt-2 px-2 mt-2">
                  <div className="flex gap-2 overflow-x-auto hide-scrollbar py-1">
                    {AGENTS.map((agent) => {
                      const Icon = agent.icon;
                      const isActive = activeAgent === agent.id;
                      return (
                        <button
                          key={agent.id}
                          data-testid={`button-agent-${agent.id}`}
                          onClick={() => setActiveAgent(agent.id)}
                          className={`flex items-center gap-2 whitespace-nowrap px-3 py-1.5 rounded-full text-xs transition-colors duration-300 ${
                            isActive 
                              ? 'bg-white text-black font-medium' 
                              : 'text-white/50 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <Icon size={14} className={isActive ? "text-black" : "text-white/50"} />
                          {agent.name}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button 
                    data-testid="button-submit"
                    onClick={handleSubmit}
                    disabled={waitlistMutation.isPending}
                    className="bg-white/10 hover:bg-white hover:text-black text-white rounded-full p-2 ml-2 transition-colors shrink-0 disabled:opacity-50"
                  >
                    {waitlistMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {waitlistMutation.isError && (
            <p data-testid="text-error" className="text-red-400/80 text-xs text-center mt-3">Something went wrong. Please try again.</p>
          )}
          
          <div className="text-center mt-6">
            <p className="text-white/40 text-xs flex items-center justify-center gap-2">
              <Plus size={12} />
              Integrates with Square & Toast POS
            </p>
          </div>
        </motion.div>
      </main>

      <motion.footer 
        className="fixed bottom-0 w-full p-6 md:p-8 flex flex-col md:flex-row justify-between items-center z-10 text-xs text-white/40 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
      >
        <div>
          © 2026 BevOne Inc. — The hospitality intelligence platform.
        </div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-white transition-colors">Privacy</a>
          <a href="#" className="hover:text-white transition-colors">Terms</a>
          <a href="#" className="hover:text-white transition-colors">Documentation</a>
        </div>
      </motion.footer>

    </div>
  );
}
