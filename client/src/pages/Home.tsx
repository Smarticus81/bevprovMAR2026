import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/layout/Navbar";
import { Mic, Store, Box, Briefcase, Sparkles, ChevronRight } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";

import champagneVideo from "@/assets/videos/champagne-bg.mp4";

const AGENTS = [
  { id: "bevone", name: "BevOne", icon: Sparkles },
  { id: "voice-pos", name: "Voice POS", icon: Mic },
  { id: "pos-integration", name: "POS Integration", icon: Store },
  { id: "inventory", name: "Inventory", icon: Box },
  { id: "venue-admin", name: "Venue Agent", icon: Briefcase },
];

const DEMO_CONVERSATIONS: Record<string, Array<{ role: "user" | "agent"; text: string }>> = {
  bevone: [
    { role: "user", text: "What's our status tonight?" },
    { role: "agent", text: "You have 3 bookings for 142 guests. Bar stock is solid except tequila — down to 4 bottles. Revenue is $3,280 so far." },
    { role: "user", text: "Reorder the tequila and check if the Miller party confirmed." },
    { role: "agent", text: "Done. 12 bottles of Patrón Silver ordered from Pacific Spirits. The Miller party confirmed — 45 guests arriving at 7pm." },
  ],
  "voice-pos": [
    { role: "user", text: "Two old fashioneds and a glass of the Cab Sauv." },
    { role: "agent", text: "Two Old Fashioneds and one Cabernet Sauvignon. That's $42. Want to open a tab or close out?" },
    { role: "user", text: "Tab for table 6, please." },
    { role: "agent", text: "Tab opened for Table 6. Three items, running total $42. Anything else?" },
  ],
  "pos-integration": [
    { role: "user", text: "Sync today's Square transactions." },
    { role: "agent", text: "Synced 47 transactions from Square. Total revenue: $6,820. Top seller: Espresso Martini with 23 orders." },
    { role: "user", text: "Generate the receipt for the last transaction." },
    { role: "agent", text: "Receipt generated. 2x Negroni, 1x Bruschetta — $38 total, paid via Apple Pay at 9:47pm." },
  ],
  inventory: [
    { role: "user", text: "What's running low?" },
    { role: "agent", text: "Three items below threshold: Hendrick's Gin (2 bottles), Angostura Bitters (1 bottle), and limes (6 remaining)." },
    { role: "user", text: "Auto-reorder all of those." },
    { role: "agent", text: "Orders placed with two suppliers. Hendrick's and Angostura from Premium Spirits, limes from Fresh Produce Co. Estimated delivery tomorrow by 2pm." },
  ],
  "venue-admin": [
    { role: "user", text: "What's on the calendar this week?" },
    { role: "agent", text: "Three events: Chen wedding rehearsal Wednesday (60 guests), corporate mixer Thursday (85 guests), and the Garcia reception Saturday (120 guests)." },
    { role: "user", text: "Schedule extra staff for Saturday." },
    { role: "agent", text: "Added Maria and James to the Saturday evening shift, 4pm–midnight. You now have 8 staff on for the Garcia reception." },
  ],
};

const PULSE_HEIGHTS = [24, 32, 20, 28, 22];

function AudioPulse({ isActive }: { isActive: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-8" data-testid="audio-pulse">
      {PULSE_HEIGHTS.map((h, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-white/40"
          animate={
            isActive
              ? {
                  height: [8, h, 8],
                  opacity: [0.3, 0.7, 0.3],
                }
              : { height: 4, opacity: 0.15 }
          }
          transition={
            isActive
              ? {
                  duration: 0.8 + i * 0.15,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.1,
                }
              : { duration: 0.4 }
          }
        />
      ))}
    </div>
  );
}

export default function Home() {
  const [activeAgent, setActiveAgent] = useState("bevone");
  const [isHovering, setIsHovering] = useState(false);
  const [visibleMessages, setVisibleMessages] = useState<number>(0);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timeoutRef.current.forEach(clearTimeout);
    timeoutRef.current = [];
  }, []);

  const playConversation = useCallback(
    (agentId: string) => {
      clearTimers();
      setVisibleMessages(0);
      setIsTyping(false);

      const convo = DEMO_CONVERSATIONS[agentId];
      if (!convo) return;

      convo.forEach((_, i) => {
        const showTyping = setTimeout(() => setIsTyping(true), i * 2200 + 400);
        const showMsg = setTimeout(() => {
          setIsTyping(false);
          setVisibleMessages(i + 1);
        }, i * 2200 + 1200);
        timeoutRef.current.push(showTyping, showMsg);
      });

      const restart = setTimeout(() => {
        playConversation(agentId);
      }, convo.length * 2200 + 3000);
      timeoutRef.current.push(restart);
    },
    [clearTimers]
  );

  useEffect(() => {
    playConversation(activeAgent);
    return clearTimers;
  }, [activeAgent, playConversation, clearTimers]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleMessages]);

  const conversation = DEMO_CONVERSATIONS[activeAgent] || [];
  const displayed = conversation.slice(0, visibleMessages);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative font-sans">
      <Navbar />

      <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none">
        <div className="absolute inset-0 bg-black z-10 opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black z-10" />

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
          className="text-center mb-12"
        >
          <h1
            data-testid="text-hero-title"
            className="text-[12vw] md:text-[9vw] font-medium tracking-tight leading-none text-glow text-white/90"
          >
            BevPro
          </h1>
          <p
            data-testid="text-hero-subtitle"
            className="text-white/50 text-sm md:text-base tracking-wide mt-4 max-w-lg mx-auto font-light"
          >
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
          <div className="glass-input rounded-2xl p-2 flex flex-col transition-all duration-300">
            <div
              ref={scrollRef}
              className="px-4 pt-3 pb-4 min-h-[100px] max-h-[140px] overflow-y-auto hide-scrollbar space-y-3"
            >
              <AnimatePresence mode="popLayout">
                {displayed.map((msg, i) => (
                  <motion.div
                    key={`${activeAgent}-${i}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      data-testid={`demo-msg-${i}`}
                      className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-white/10 text-white/80"
                          : "bg-white/[0.04] text-white/60 border border-white/[0.06]"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="px-4 py-2.5">
                    <AudioPulse isActive={true} />
                  </div>
                </motion.div>
              )}

              {!isTyping && displayed.length === 0 && (
                <div className="flex items-center justify-center h-full pt-6">
                  <AudioPulse isActive={false} />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-2 px-2 mt-1">
              <div className="flex gap-1.5 overflow-x-auto hide-scrollbar py-1">
                {AGENTS.map((agent) => {
                  const Icon = agent.icon;
                  const isActive = activeAgent === agent.id;
                  return (
                    <button
                      key={agent.id}
                      data-testid={`button-agent-${agent.id}`}
                      onClick={() => setActiveAgent(agent.id)}
                      className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs transition-all duration-300 ${
                        isActive
                          ? "border border-white/30 text-white bg-white/[0.06]"
                          : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                      }`}
                    >
                      <Icon size={13} className={isActive ? "text-white/70" : "text-white/30"} />
                      {agent.name}
                    </button>
                  );
                })}
              </div>

              <Link href="/register">
                <button
                  data-testid="button-start-building"
                  className="border border-white/20 text-white/70 hover:bg-white hover:text-black rounded-full px-4 py-1.5 ml-2 transition-all duration-300 text-xs font-medium shrink-0 flex items-center gap-1"
                >
                  Start Building
                  <ChevronRight size={12} />
                </button>
              </Link>
            </div>
          </div>

          <div className="text-center mt-6">
            <p className="text-white/30 text-xs tracking-wide">
              Voice-first AI agents for Square & Toast POS
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
          © 2026 BevPro Inc. — The hospitality intelligence platform.
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
