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
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${
            voice.status === "connected" ? "bg-green-500" :
            voice.status === "connecting" ? "bg-yellow-500 animate-pulse" :
            voice.status === "error" ? "bg-red-500" : "bg-white/20"
          }`} />
          <span className="text-white text-sm font-medium">{agentName}</span>
        </div>
        <div className="flex items-center gap-2">
          {voice.latency !== null && (
            <span className="text-xs text-white/40 flex items-center gap-1" data-testid="text-latency">
              <Clock size={12} />
              {voice.latency}ms
            </span>
          )}
          {voice.isSpeaking && (
            <Volume2 size={14} className="text-blue-400 animate-pulse" />
          )}
        </div>
      </div>

      <div ref={scrollRef} className="h-64 overflow-y-auto p-4 space-y-3" data-testid="voice-transcript">
        {voice.transcript.length === 0 && voice.status !== "connected" && (
          <div className="h-full flex items-center justify-center">
            <p className="text-white/30 text-sm">Start a voice session to test your agent</p>
          </div>
        )}
        {voice.transcript.length === 0 && voice.status === "connected" && (
          <div className="h-full flex items-center justify-center">
            <p className="text-white/40 text-sm animate-pulse">Listening... speak to test your agent</p>
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
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 max-w-[90%]">
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench size={12} className="text-amber-400" />
                    <span className="text-amber-400 text-xs font-medium">{entry.toolName}</span>
                  </div>
                  {entry.toolResult ? (
                    <div className="text-white/60 text-sm">
                      {typeof entry.toolResult === "object" && entry.toolResult.message
                        ? entry.toolResult.message
                        : <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(entry.toolResult, null, 2)}</pre>}
                    </div>
                  ) : (
                    <p className="text-white/40 text-xs animate-pulse">{entry.text}</p>
                  )}
                </div>
              ) : (
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
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
        </AnimatePresence>
      </div>

      {voice.error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
          <p className="text-red-400 text-xs" data-testid="text-voice-error">{voice.error}</p>
        </div>
      )}

      <div className="p-4 border-t border-white/10 flex items-center justify-center gap-4">
        {voice.status === "idle" || voice.status === "error" ? (
          <button
            data-testid="button-start-voice"
            onClick={voice.connect}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
          >
            <Phone size={16} />
            Start Session
          </button>
        ) : voice.status === "connecting" ? (
          <button disabled className="flex items-center gap-2 bg-white/10 text-white/40 px-6 py-3 rounded-xl text-sm font-medium">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Connecting...
          </button>
        ) : (
          <>
            <button
              data-testid="button-toggle-mute"
              onClick={voice.toggleMute}
              className={`p-3 rounded-xl transition-colors ${
                voice.isListening
                  ? "bg-white/10 text-white hover:bg-white/15"
                  : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              }`}
            >
              {voice.isListening ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button
              data-testid="button-end-voice"
              onClick={voice.disconnect}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
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
