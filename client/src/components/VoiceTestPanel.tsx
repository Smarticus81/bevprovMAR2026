import { useVoiceSession, type TranscriptEntry } from "@/hooks/useVoiceSession";
import { Mic, MicOff, Phone, PhoneOff, Wrench, Clock, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";

interface VoiceTestPanelProps {
  agentId: number;
  agentName: string;
}

export function VoiceTestPanel({ agentId, agentName }: VoiceTestPanelProps) {
  const voice = useVoiceSession(agentId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [voice.transcript]);

  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02]">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${
            voice.status === "connected" ? "bg-green-500" :
            voice.status === "connecting" ? "bg-yellow-500 animate-pulse" :
            voice.status === "error" ? "bg-red-500" : "bg-white/15"
          }`} />
          <span className="text-white/70 text-sm font-medium">{agentName}</span>
        </div>
        <div className="flex items-center gap-2">
          {voice.latency !== null && (
            <span className="text-xs text-white/30 flex items-center gap-1" data-testid="text-latency">
              <Clock size={12} />
              {voice.latency}ms
            </span>
          )}
          {voice.isSpeaking && (
            <Volume2 size={14} className="text-white/40 animate-pulse" />
          )}
        </div>
      </div>

      <div ref={scrollRef} className="h-64 overflow-y-auto p-4 space-y-3" data-testid="voice-transcript">
        {voice.transcript.length === 0 && voice.status !== "connected" && (
          <div className="h-full flex items-center justify-center">
            <p className="text-white/20 text-sm">Start a voice session to test your agent</p>
          </div>
        )}
        {voice.transcript.length === 0 && voice.status === "connected" && (
          <div className="h-full flex items-center justify-center">
            <p className="text-white/30 text-sm animate-pulse">Listening...</p>
          </div>
        )}
        <AnimatePresence>
          {voice.transcript.map((entry, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {entry.role === "tool" ? (
                <div className="border border-white/10 rounded-xl px-3 py-2 max-w-[90%] bg-white/[0.02]">
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench size={12} className="text-white/40" />
                    <span className="text-white/40 text-xs font-medium">{entry.toolName}</span>
                  </div>
                  {entry.toolResult ? (
                    <div className="text-white/50 text-sm">
                      {typeof entry.toolResult === "object" && entry.toolResult.message
                        ? entry.toolResult.message
                        : <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(entry.toolResult, null, 2)}</pre>}
                    </div>
                  ) : (
                    <p className="text-white/30 text-xs animate-pulse">{entry.text}</p>
                  )}
                </div>
              ) : (
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                    entry.role === "user"
                      ? "bg-white/10 text-white/80"
                      : "border border-white/10 text-white/60 bg-white/[0.02]"
                  }`}
                >
                  {entry.text}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {voice.error && (
        <div className="px-4 py-2 border-t border-red-500/10">
          <p className="text-red-400/70 text-xs" data-testid="text-voice-error">{voice.error}</p>
        </div>
      )}

      <div className="p-4 border-t border-white/10 flex items-center justify-center gap-4">
        {voice.status === "idle" || voice.status === "error" ? (
          <button
            data-testid="button-start-voice"
            onClick={voice.connect}
            className="flex items-center gap-2 border border-white/20 text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-white hover:text-black transition-all duration-300"
          >
            <Phone size={16} />
            Start Session
          </button>
        ) : voice.status === "connecting" ? (
          <button disabled className="flex items-center gap-2 border border-white/10 text-white/30 px-6 py-3 rounded-full text-sm font-medium">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" />
            Connecting...
          </button>
        ) : (
          <>
            <button
              data-testid="button-toggle-mute"
              onClick={voice.toggleMute}
              className={`p-3 rounded-full border transition-all duration-300 ${
                voice.isListening
                  ? "border-white/20 text-white/60 hover:border-white/40"
                  : "border-red-500/30 text-red-400"
              }`}
            >
              {voice.isListening ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button
              data-testid="button-end-voice"
              onClick={voice.disconnect}
              className="flex items-center gap-2 border border-red-500/30 text-red-400 px-6 py-3 rounded-full text-sm font-medium hover:bg-red-500 hover:text-white hover:border-red-500 transition-all duration-300"
            >
              <PhoneOff size={16} />
              End Session
            </button>
          </>
        )}
      </div>
    </div>
  );
}
