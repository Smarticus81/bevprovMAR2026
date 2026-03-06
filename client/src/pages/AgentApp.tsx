import { useParams } from "wouter";
import { useVoiceSession, type TranscriptEntry, type WakeWordConfig } from "@/hooks/useVoiceSession";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Mic, MicOff, PhoneOff, Wrench, ShoppingCart, DollarSign, CreditCard, User, Hash, Receipt, Volume2, Upload, FileText, Loader2, X } from "lucide-react";
import { BevProLogo } from "@/components/BevProLogo";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, useMemo } from "react";
import type { OrderItem, AgentConfig } from "@shared/schema";

interface PosState {
  orderItems: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  customerName: string | null;
  tableNumber: number | null;
  tabId: number | null;
  orderId: number | null;
  paymentStatus: "unpaid" | "paid" | "processing";
  paymentMethod: string | null;
  lastAction: string | null;
}

function extractPosState(transcript: TranscriptEntry[]): PosState {
  const state: PosState = {
    orderItems: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    customerName: null,
    tableNumber: null,
    tabId: null,
    orderId: null,
    paymentStatus: "unpaid",
    paymentMethod: null,
    lastAction: null,
  };

  for (const entry of transcript) {
    if (entry.role !== "tool" || !entry.toolResult) continue;
    const r = entry.toolResult;

    switch (entry.toolName) {
      case "voice_ordering": {
        if (r.items) {
          state.orderItems = r.items.map((i: any) => ({
            name: i.name,
            quantity: i.quantity,
            price: i.price,
          }));
        }
        if (r.orderId) state.orderId = r.orderId;
        if (r.table && r.table !== "bar") state.tableNumber = r.table;
        if (r.total) {
          const t = parseFloat(String(r.total).replace("$", ""));
          state.subtotal = t;
          state.tax = t * 0.08;
          state.total = t + state.tax;
        }
        state.lastAction = "Order placed";
        break;
      }

      case "tab_management": {
        if (r.tabId) state.tabId = r.tabId;
        if (r.customer) state.customerName = r.customer;

        if (r.items && Array.isArray(r.items)) {
          state.orderItems = r.items.map((i: any) => ({
            name: i.name,
            quantity: i.quantity,
            price: i.price,
          }));
        }

        if (r.added) {
          const existing = state.orderItems.find((i) => i.name === r.added);
          if (existing) {
            existing.quantity += r.quantity || 1;
          } else {
            const price = r.lineTotal
              ? parseFloat(String(r.lineTotal).replace("$", "")) / (r.quantity || 1)
              : 0;
            state.orderItems.push({
              name: r.added,
              quantity: r.quantity || 1,
              price,
            });
          }
        }

        if (r.tabTotal) {
          const t = parseFloat(String(r.tabTotal).replace("$", ""));
          state.subtotal = t;
          state.tax = t * 0.08;
          state.total = t + state.tax;
        } else if (r.total) {
          const t = parseFloat(String(r.total).replace("$", ""));
          state.subtotal = t;
          state.tax = t * 0.08;
          state.total = t + state.tax;
        }

        if (r.status === "closed") {
          state.lastAction = "Tab closed";
        } else if (r.added) {
          state.lastAction = `Added ${r.quantity || 1}x ${r.added}`;
        } else {
          state.lastAction = "Tab updated";
        }
        break;
      }

      case "menu_lookup": {
        state.lastAction = "Menu lookup";
        break;
      }

      case "payment_processing": {
        if (r.status === "paid") {
          state.paymentStatus = "paid";
          state.paymentMethod = r.method || null;
          state.orderId = r.orderId || state.orderId;
          if (r.amount) {
            const t = parseFloat(String(r.amount).replace("$", ""));
            state.subtotal = t;
            state.tax = t * 0.08;
            state.total = t + state.tax;
          }
        }
        state.lastAction = "Payment processed";
        break;
      }

      case "split_checks": {
        state.lastAction = `Split ${r.splitCount || 2} ways`;
        break;
      }

      case "customer_lookup": {
        if (r.name) state.customerName = r.name;
        state.lastAction = "Customer found";
        break;
      }

      case "receipt_generation": {
        state.lastAction = "Receipt generated";
        break;
      }
    }
  }

  return state;
}

function PosDisplay({ posState }: { posState: PosState }) {
  return (
    <div className="h-full flex flex-col bg-black/50 backdrop-blur-sm" data-testid="pos-display">
      <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ShoppingCart size={16} className="text-amber-400 sm:w-[18px] sm:h-[18px]" />
            <h2 className="text-xs sm:text-sm font-semibold text-white" data-testid="text-pos-title">Current Order</h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-white/40">
            {posState.tabId && (
              <span className="flex items-center gap-1" data-testid="text-tab-id">
                <Hash size={10} className="sm:w-3 sm:h-3" />
                Tab #{posState.tabId}
              </span>
            )}
            {posState.orderId && (
              <span className="flex items-center gap-1" data-testid="text-order-id">
                <Receipt size={10} className="sm:w-3 sm:h-3" />
                Order #{posState.orderId}
              </span>
            )}
          </div>
        </div>

        {(posState.customerName || posState.tableNumber) && (
          <div className="flex items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-white/50">
            {posState.customerName && (
              <span className="flex items-center gap-1 truncate" data-testid="text-customer-name">
                <User size={10} className="shrink-0 sm:w-3 sm:h-3" />
                {posState.customerName}
              </span>
            )}
            {posState.tableNumber && (
              <span data-testid="text-table-number" className="shrink-0">Table {posState.tableNumber}</span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-2 sm:py-3">
        {posState.orderItems.length === 0 ? (
          <div className="h-full flex items-center justify-center" data-testid="pos-empty-state">
            <div className="text-center">
              <ShoppingCart size={40} className="text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm">No items yet</p>
              <p className="text-white/20 text-xs mt-1">Order items will appear here as the voice agent processes them</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2" data-testid="pos-items-list">
            {posState.orderItems.map((item, idx) => (
              <motion.div
                key={`${item.name}-${idx}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white/5 hover:bg-white/8 transition-colors"
                data-testid={`pos-item-${idx}`}
              >
                <div className="flex-1">
                  <p className="text-sm text-white font-medium" data-testid={`text-item-name-${idx}`}>{item.name}</p>
                  <p className="text-xs text-white/40">
                    ${item.price.toFixed(2)} × {item.quantity}
                  </p>
                </div>
                <p className="text-sm text-white font-medium" data-testid={`text-item-total-${idx}`}>
                  ${(item.price * item.quantity).toFixed(2)}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 px-3 sm:px-5 py-3 sm:py-4 space-y-1.5 sm:space-y-2" data-testid="pos-totals">
        <div className="flex justify-between text-sm text-white/60">
          <span>Subtotal</span>
          <span data-testid="text-subtotal">${posState.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-white/60">
          <span>Tax (8%)</span>
          <span data-testid="text-tax">${posState.tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold text-white pt-1 border-t border-white/10">
          <span>Total</span>
          <span data-testid="text-total">${posState.total.toFixed(2)}</span>
        </div>

        <div className="pt-2">
          <div className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium ${
            posState.paymentStatus === "paid"
              ? "bg-emerald-500/20 text-emerald-400"
              : posState.paymentStatus === "processing"
              ? "bg-amber-500/20 text-amber-400"
              : "bg-white/5 text-white/40"
          }`} data-testid="text-payment-status">
            {posState.paymentStatus === "paid" ? (
              <>
                <CreditCard size={14} />
                Paid{posState.paymentMethod ? ` via ${posState.paymentMethod}` : ""}
              </>
            ) : posState.paymentStatus === "processing" ? (
              <>
                <DollarSign size={14} />
                Processing...
              </>
            ) : (
              <>
                <DollarSign size={14} />
                Awaiting Payment
              </>
            )}
          </div>
        </div>

        {posState.lastAction && (
          <p className="text-xs text-white/30 text-center pt-1" data-testid="text-last-action">
            Last: {posState.lastAction}
          </p>
        )}
      </div>
    </div>
  );
}

function TranscriptPanel({
  voice,
  scrollRef,
}: {
  voice: ReturnType<typeof useVoiceSession>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="h-full flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pb-4 pt-2" data-testid="transcript-panel">
        <AnimatePresence mode="popLayout">
          {voice.status === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex items-center justify-center min-h-[30vh]"
            >
              <div className="text-center">
                <BevProLogo size={64} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">Tap below to start</p>
              </div>
            </motion.div>
          )}

          {voice.status === "connected" && voice.transcript.length === 0 && (
            <motion.div
              key="listening-pulse"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex items-center justify-center min-h-[30vh]"
            >
              <BevProLogo size={80} className="text-white/20" animated={true} />
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
                <div className="border border-white/10 rounded-2xl px-4 py-3 max-w-[85%] bg-white/[0.02]">
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench size={12} className="text-white/40" />
                    <span className="text-white/40 text-xs font-medium">{entry.toolName}</span>
                  </div>
                  {entry.toolResult ? (
                    <div className="text-white/60 text-sm">
                      {typeof entry.toolResult === "object" && entry.toolResult.message
                        ? entry.toolResult.message
                        : <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(entry.toolResult, null, 2)}</pre>
                      }
                    </div>
                  ) : (
                    <p className="text-white/30 text-xs animate-pulse">{entry.text}</p>
                  )}
                </div>
              ) : (
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-[15px] leading-relaxed ${
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

          {voice.status === "connected" && voice.isSpeaking && voice.transcript.length > 0 && (
            <motion.div
              key="speaking-pulse"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start mb-3"
            >
              <div className="border border-white/10 rounded-2xl px-4 py-3 bg-white/[0.02]">
                <BevProLogo size={28} className="text-white/40" animated={true} />
              </div>
            </motion.div>
          )}

          {voice.status === "connected" && voice.isListening && !voice.isSpeaking && voice.transcript.length > 0 && (
            <motion.div
              key="listening-indicator"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start mb-3"
            >
              <div className="border border-white/10 rounded-2xl px-4 py-3 bg-white/[0.02] flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FileUploadButton({ agentId }: { agentId: number }) {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/agents/${agentId}/documents`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        setUploadResult(`Error: ${err.error || "Upload failed"}`);
      } else {
        const doc = await res.json();
        setUploadResult(`Uploaded: ${doc.filename}`);
        setTimeout(() => setUploadResult(null), 3000);
      }
    } catch {
      setUploadResult("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.csv,.json"
        className="hidden"
        data-testid="input-file-upload"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = "";
        }}
      />
      <button
        data-testid="button-upload-file"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors disabled:opacity-50"
      >
        {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        <span className="hidden sm:inline">Upload</span>
      </button>
      {uploadResult && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute top-full right-0 mt-1 px-3 py-1.5 rounded-lg bg-white/10 text-xs text-white/70 whitespace-nowrap"
          data-testid="text-upload-result"
        >
          {uploadResult}
        </motion.div>
      )}
    </div>
  );
}

function VoiceControls({ voice, wakeWordConfig }: { voice: ReturnType<typeof useVoiceSession>; wakeWordConfig?: WakeWordConfig }) {
  return (
    <div className="shrink-0 flex flex-col items-center gap-2 sm:gap-3 pb-4 sm:pb-8 pt-3 sm:pt-4">
      {voice.status === "wake-listening" ? (
        <div className="flex flex-col items-center gap-2 sm:gap-3">
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center"
            data-testid="indicator-wake-listening"
          >
            <Volume2 size={28} className="text-white/60 sm:w-8 sm:h-8" />
          </motion.div>
          <p className="text-white/50 text-xs sm:text-sm" data-testid="text-wake-listening">
            Listening for '{wakeWordConfig?.phrase || "hey bev"}'...
          </p>
          <motion.button
            data-testid="button-stop-wake-word"
            onClick={voice.disconnect}
            whileTap={{ scale: 0.9 }}
            className="px-4 py-2 rounded-full text-xs font-medium border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
          >
            Stop Listening
          </motion.button>
        </div>
      ) : voice.returningToStandby ? (
        <div className="flex flex-col items-center gap-2 sm:gap-3">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 flex items-center justify-center">
            <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
          <p className="text-white/50 text-xs sm:text-sm" data-testid="text-returning-standby">Returning to standby...</p>
        </div>
      ) : voice.status === "idle" || voice.status === "error" ? (
        <div className="flex flex-col items-center gap-2 sm:gap-3">
          <motion.button
            data-testid="button-start-call"
            onClick={voice.connect}
            whileTap={{ scale: 0.92 }}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white flex items-center justify-center shadow-[0_0_60px_rgba(255,255,255,0.15)]"
          >
            <Mic size={28} className="text-black sm:w-8 sm:h-8" />
          </motion.button>
          {wakeWordConfig?.enabled && (
            <motion.button
              data-testid="button-start-wake-word"
              onClick={voice.startWakeWordListening}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 rounded-full text-xs font-medium border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all flex items-center gap-2"
            >
              <Volume2 size={14} />
              Start Wake Word
            </motion.button>
          )}
        </div>
      ) : voice.status === "connecting" ? (
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 flex items-center justify-center">
          <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex items-center gap-4 sm:gap-6">
          <motion.button
            data-testid="button-mute"
            onClick={voice.toggleMute}
            whileTap={{ scale: 0.9 }}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-colors ${
              voice.isListening ? "bg-white/10 text-white" : "bg-red-500/20 text-red-400"
            }`}
          >
            {voice.isListening ? <Mic size={20} /> : <MicOff size={20} />}
          </motion.button>

          <motion.button
            data-testid="button-end-call"
            onClick={voice.disconnect}
            whileTap={{ scale: 0.9 }}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-500 flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.3)]"
          >
            <PhoneOff size={24} className="text-white sm:w-7 sm:h-7" />
          </motion.button>

          <div className="w-12 h-12 sm:w-14 sm:h-14" />
        </div>
      )}

      {!voice.returningToStandby && voice.status !== "wake-listening" && (
        <p className="text-white/30 text-xs">
          {voice.status === "idle" ? "Tap to start" :
           voice.status === "connecting" ? "Connecting..." :
           voice.isListening ? "Listening..." : "Muted"}
        </p>
      )}
    </div>
  );
}

export default function AgentApp() {
  const { agentId } = useParams<{ agentId: string }>();
  const id = parseInt(agentId || "0");
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

  const agentConfig = agent?.config as AgentConfig | null;
  const wakeWordConfig: WakeWordConfig | undefined = agentConfig?.wakeWord?.enabled ? {
    enabled: true,
    phrase: agentConfig.wakeWord.phrase || "hey bev",
    endPhrases: agentConfig.wakeWord.endPhrases || [],
    shutdownPhrases: agentConfig.wakeWord.shutdownPhrases || [],
    levenshteinThreshold: agentConfig.wakeWord.levenshteinThreshold ?? 2,
  } : undefined;

  const voice = useVoiceSession(id, wakeWordConfig);

  const isVoicePos = agent?.type === "voice-pos";

  const posState = useMemo(() => extractPosState(voice.transcript), [voice.transcript]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [voice.transcript]);

  if (isVoicePos) {
    return (
      <div className="h-[100dvh] bg-black text-white flex flex-col" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <header className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 shrink-0 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-1 text-white/50 hover:text-white text-sm transition-colors shrink-0" data-testid="button-back">
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </Link>
          <div className="text-center min-w-0 flex-1">
            <h1 className="text-sm font-medium truncate px-2" data-testid="text-agent-name">{agent?.name || "Voice POS"}</h1>
            {voice.status === "connected" && voice.latency !== null && (
              <p className="text-[10px] text-white/30">{voice.latency}ms</p>
            )}
          </div>
          <div className="w-10 sm:w-16 flex justify-end shrink-0">
            {agentConfig?.fileUploadEnabled && <FileUploadButton agentId={id} />}
          </div>
        </header>

        {voice.error && (
          <div className="px-3 sm:px-5 py-2">
            <p className="text-red-400 text-xs text-center" data-testid="text-voice-error">{voice.error}</p>
          </div>
        )}

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          <div className="md:w-[340px] lg:w-[420px] md:border-r border-b md:border-b-0 border-white/10 h-[35vh] sm:h-[40vh] md:h-auto overflow-hidden" data-testid="pos-panel">
            <PosDisplay posState={posState} />
          </div>

          <div className="flex-1 flex flex-col overflow-hidden min-h-0" data-testid="voice-panel">
            <TranscriptPanel voice={voice} scrollRef={scrollRef} />
          </div>
        </div>

        <VoiceControls voice={voice} wakeWordConfig={wakeWordConfig} />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-black text-white flex flex-col" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <header className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-1 text-white/50 hover:text-white text-sm transition-colors shrink-0" data-testid="button-back">
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Back</span>
        </Link>
        <div className="text-center min-w-0 flex-1">
          <h1 className="text-sm font-medium truncate px-2" data-testid="text-agent-name">{agent?.name || "Voice Agent"}</h1>
          {voice.status === "connected" && voice.latency !== null && (
            <p className="text-[10px] text-white/30">{voice.latency}ms</p>
          )}
        </div>
        <div className="w-10 sm:w-16 flex justify-end shrink-0">
          {agentConfig?.fileUploadEnabled && <FileUploadButton agentId={id} />}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-5 pb-4 min-h-0">
        <AnimatePresence mode="popLayout">
          {voice.status === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex items-center justify-center min-h-[40vh] sm:min-h-[50vh]"
            >
              <div className="text-center">
                <BevProLogo size={64} className="text-white/10 mx-auto mb-4 sm:w-[80px] sm:h-[80px]" />
                <p className="text-white/30 text-sm">Tap below to start a conversation</p>
              </div>
            </motion.div>
          )}

          {voice.status === "connected" && voice.transcript.length === 0 && (
            <motion.div
              key="listening-pulse"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex items-center justify-center min-h-[40vh] sm:min-h-[50vh]"
            >
              <BevProLogo size={80} className="text-white/20" animated={true} />
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
                <div className="border border-white/10 rounded-2xl px-4 py-3 max-w-[85%] bg-white/[0.02]">
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench size={12} className="text-white/40" />
                    <span className="text-white/40 text-xs font-medium">{entry.toolName}</span>
                  </div>
                  {entry.toolResult ? (
                    <div className="text-white/60 text-sm">
                      {typeof entry.toolResult === "object" && entry.toolResult.message
                        ? entry.toolResult.message
                        : <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(entry.toolResult, null, 2)}</pre>
                      }
                    </div>
                  ) : (
                    <p className="text-white/30 text-xs animate-pulse">{entry.text}</p>
                  )}
                </div>
              ) : (
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-[15px] leading-relaxed ${
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

          {voice.status === "connected" && voice.isSpeaking && voice.transcript.length > 0 && (
            <motion.div
              key="speaking-pulse"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start mb-3"
            >
              <div className="border border-white/10 rounded-2xl px-4 py-3 bg-white/[0.02]">
                <BevProLogo size={28} className="text-white/40" animated={true} />
              </div>
            </motion.div>
          )}

          {voice.status === "connected" && voice.isListening && !voice.isSpeaking && voice.transcript.length > 0 && (
            <motion.div
              key="listening-indicator"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start mb-3"
            >
              <div className="border border-white/10 rounded-2xl px-4 py-3 bg-white/[0.02] flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {voice.error && (
        <div className="px-5 py-2">
          <p className="text-red-400 text-xs text-center" data-testid="text-voice-error">{voice.error}</p>
        </div>
      )}

      <VoiceControls voice={voice} wakeWordConfig={wakeWordConfig} />
    </div>
  );
}
