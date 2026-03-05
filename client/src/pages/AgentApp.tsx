import { useParams } from "wouter";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Mic, MicOff, PhoneOff, Wrench } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";

export default function AgentApp() {
  const { agentId } = useParams<{ agentId: string }>();
  const id = parseInt(agentId || "0");
  const voice = useVoiceSession(id);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: agent } = useQuery({
    queryKey: ["agent-app", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!agentId,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [voice.transcript]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <header className="flex items-center justify-between px-5 py-4 shrink-0">
        <Link href="/dashboard">
          <button className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors" data-testid="button-back">
            <ArrowLeft size={18} />
            Back
          </button>
        </Link>
        <div className="text-center">
          <h1 className="text-sm font-medium" data-testid="text-agent-name">{agent?.name || "Voice Agent"}</h1>
          {voice.status === "connected" && voice.latency !== null && (
            <p className="text-xs text-white/30">{voice.latency}ms</p>
          )}
        </div>
        <div className="w-16" />
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pb-4">
        <AnimatePresence mode="popLayout">
          {voice.status === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex items-center justify-center min-h-[50vh]"
            >
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Mic size={32} className="text-white/30" />
                </div>
                <p className="text-white/40 text-sm">Tap below to start a conversation</p>
              </div>
            </motion.div>
          )}

          {voice.transcript.map((entry, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`mb-3 flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {entry.role === "tool" ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 max-w-[85%]">
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench size={12} className="text-amber-400" />
                    <span className="text-amber-400 text-xs font-medium">{entry.toolName}</span>
                  </div>
                  {entry.toolResult ? (
                    <div className="text-white/60 text-sm">
                      {typeof entry.toolResult === "object" && entry.toolResult.message
                        ? entry.toolResult.message
                        : <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(entry.toolResult, null, 2)}</pre>
                      }
                    </div>
                  ) : (
                    <p className="text-white/40 text-xs animate-pulse">{entry.text}</p>
                  )}
                </div>
              ) : (
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-[15px] leading-relaxed ${
                    entry.role === "user"
                      ? "bg-white text-black"
                      : "bg-white/10 text-white"
                  }`}
                >
                  {entry.text}
                </div>
              )}
            </motion.div>
          ))}

          {voice.status === "connected" && voice.isListening && voice.transcript.length > 0 && (
            <motion.div
              key="listening-indicator"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start mb-3"
            >
              <div className="bg-white/10 rounded-2xl px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {voice.error && (
        <div className="px-5 py-2">
          <p className="text-red-400 text-xs text-center">{voice.error}</p>
        </div>
      )}

      <div className="shrink-0 flex flex-col items-center gap-3 pb-8 pt-4">
        {voice.status === "idle" || voice.status === "error" ? (
          <motion.button
            data-testid="button-start-call"
            onClick={voice.connect}
            whileTap={{ scale: 0.92 }}
            className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-[0_0_60px_rgba(255,255,255,0.15)]"
          >
            <Mic size={32} className="text-black" />
          </motion.button>
        ) : voice.status === "connecting" ? (
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <motion.button
              data-testid="button-mute"
              onClick={voice.toggleMute}
              whileTap={{ scale: 0.9 }}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                voice.isListening ? "bg-white/10 text-white" : "bg-red-500/20 text-red-400"
              }`}
            >
              {voice.isListening ? <Mic size={22} /> : <MicOff size={22} />}
            </motion.button>

            <motion.button
              data-testid="button-end-call"
              onClick={voice.disconnect}
              whileTap={{ scale: 0.9 }}
              className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.3)]"
            >
              <PhoneOff size={28} className="text-white" />
            </motion.button>

            <div className="w-14 h-14" />
          </div>
        )}

        <p className="text-white/30 text-xs">
          {voice.status === "idle" ? "Tap to start" :
           voice.status === "connecting" ? "Connecting..." :
           voice.isListening ? "Listening..." : "Muted"}
        </p>
      </div>
    </div>
  );
}
