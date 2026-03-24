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
  const isLive = voice.status === "listening" || voice.status === "thinking" || voice.status === "speaking";
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [voice.transcript]);

  return (
    <div className="border border-line rounded-2xl overflow-hidden bg-surface-1">
      <div className="p-4 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${
            isLive ? "bg-green-500" :
            voice.status === "connecting" ? "bg-yellow-500 animate-pulse" :
            voice.status === "error" ? "bg-red-500" : "bg-surface-4"
          }`} />
          <span className="text-ink-secondary text-sm font-medium">{agentName}</span>
        </div>
        <div className="flex items-center gap-2">
          {voice.latency !== null && (
            <span className="text-xs text-ink-faint flex items-center gap-1" data-testid="text-latency">
              <Clock size={12} />
              {voice.latency}ms
            </span>
          )}
          {voice.status === "speaking" && (
            <Volume2 size={14} className="text-ink-faint animate-pulse" />
          )}
        </div>
      </div>

      <div ref={scrollRef} className="h-64 overflow-y-auto p-4 space-y-3" data-testid="voice-transcript">
        {voice.transcript.length === 0 && !isLive && (
          <div className="h-full flex items-center justify-center">
            <p className="text-ink-ghost text-sm">Start a voice session to test your agent</p>
          </div>
        )}
        {voice.transcript.length === 0 && isLive && (
          <div className="h-full flex items-center justify-center">
            <p className="text-ink-faint text-sm animate-pulse">Listening...</p>
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
                <div className="border border-line rounded-xl px-3 py-2 max-w-[90%] bg-surface-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench size={12} className="text-ink-faint" />
                    <span className="text-ink-faint text-xs font-medium">{entry.toolName}</span>
                  </div>
                  {entry.toolResult ? (
                    <div className="text-ink-muted text-sm">
                      {typeof entry.toolResult === "object" && entry.toolResult.message
                        ? entry.toolResult.message
                        : <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(entry.toolResult, null, 2)}</pre>}
                    </div>
                  ) : (
                    <p className="text-ink-faint text-xs animate-pulse">{entry.text}</p>
                  )}
                </div>
              ) : (
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                    entry.role === "user"
                      ? "bg-surface-4 text-ink-secondary"
                      : "border border-line text-ink-secondary bg-surface-1"
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

      <div className="p-4 border-t border-line flex items-center justify-center gap-4">
        {voice.status === "idle" || voice.status === "error" ? (
          <button
            data-testid="button-start-voice"
            onClick={() => voice.connect()}
            className="flex items-center gap-2 border border-line-strong text-ink px-6 py-3 rounded-full text-sm font-medium hover:bg-ink hover:text-page transition-all duration-300"
          >
            <Phone size={16} />
            Start Session
          </button>
        ) : voice.status === "connecting" ? (
          <button disabled className="flex items-center gap-2 border border-line text-ink-faint px-6 py-3 rounded-full text-sm font-medium">
            <div className="w-4 h-4 border-2 border-line-strong border-t-ink-muted rounded-full animate-spin" />
            Connecting...
          </button>
        ) : (
          <>
            <button
              data-testid="button-toggle-mute"
              onClick={voice.toggleMute}
              className={`p-3 rounded-full border transition-all duration-300 ${
                !voice.isMuted
                  ? "border-line-strong text-ink-secondary hover:border-line-strong"
                  : "border-red-500/30 text-red-400"
              }`}
            >
              {!voice.isMuted ? <Mic size={20} /> : <MicOff size={20} />}
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
