import { useParams } from "wouter";
import { useVoiceSession, type TranscriptEntry, type WakeWordConfig } from "@/hooks/useVoiceSession";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { getAuthHeaders } from "@/lib/queryClient";
import { ArrowLeft, Mic, MicOff, PhoneOff, Wrench, ShoppingCart, DollarSign, CreditCard, User, Hash, Receipt, Volume2, Upload, FileText, Loader2, X, Wifi, WifiOff, Clock } from "lucide-react";
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

const AGENT_TYPE_LABELS: Record<string, string> = {
  "pos-integration": "POS Integration",
  "voice-pos": "Voice POS",
  "inventory": "Inventory Manager",
  "venue-admin": "Venue Agent",
  "bevone": "BevOne",
};

function StatusPill({ status, latency }: { status: string; latency: number | null }) {
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide ${
      isConnected ? "bg-emerald-500/15 text-emerald-400" :
      isConnecting ? "bg-amber-500/15 text-amber-400" :
      status === "error" ? "bg-red-500/15 text-red-400" :
      "bg-surface-3 text-ink-faint"
    }`} data-testid="status-pill">
      <div className={`w-1.5 h-1.5 rounded-full ${
        isConnected ? "bg-emerald-400" :
        isConnecting ? "bg-amber-400 animate-pulse" :
        status === "error" ? "bg-red-400" :
        "bg-ink-faint"
      }`} />
      {isConnected ? "Live" : isConnecting ? "Connecting" : status === "error" ? "Error" : "Ready"}
      {isConnected && latency !== null && (
        <span className="text-ink-faint ml-0.5">{latency}ms</span>
      )}
    </div>
  );
}

function AgentHeader({
  agent,
  agentConfig,
  voice,
  id,
}: {
  agent: any;
  agentConfig: AgentConfig | null;
  voice: ReturnType<typeof useVoiceSession>;
  id: number;
}) {
  const typeLabel = AGENT_TYPE_LABELS[agent?.type] || agent?.type || "";
  return (
    <header className="shrink-0 border-b border-line-subtle bg-page/40 backdrop-blur-md" data-testid="agent-header">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors min-w-[44px] min-h-[44px] -ml-2 pl-2"
          data-testid="button-back"
        >
          <ArrowLeft size={18} />
          <span className="hidden sm:inline text-sm">Back</span>
        </Link>

        <div className="text-center min-w-0 flex-1 px-3">
          <h1 className="text-base sm:text-lg font-semibold truncate text-ink" data-testid="text-agent-name">
            {agent?.name || "Voice Agent"}
          </h1>
          {typeLabel && (
            <p className="text-[11px] sm:text-xs text-accent/70 font-medium tracking-wide uppercase mt-0.5">
              {typeLabel}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {agentConfig?.fileUploadEnabled && <FileUploadButton agentId={id} />}
          <StatusPill status={voice.status} latency={voice.latency} />
        </div>
      </div>
    </header>
  );
}

function PosDisplay({ posState }: { posState: PosState }) {
  return (
    <div className="h-full flex flex-col" data-testid="pos-display">
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-line-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-bg flex items-center justify-center">
              <ShoppingCart size={16} className="text-accent" />
            </div>
            <h2 className="text-sm sm:text-base font-semibold text-ink" data-testid="text-pos-title">Current Order</h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-faint">
            {posState.tabId && (
              <span className="flex items-center gap-1 bg-surface-2 px-2 py-0.5 rounded" data-testid="text-tab-id">
                <Hash size={11} />
                Tab {posState.tabId}
              </span>
            )}
            {posState.orderId && (
              <span className="flex items-center gap-1 bg-surface-2 px-2 py-0.5 rounded" data-testid="text-order-id">
                <Receipt size={11} />
                #{posState.orderId}
              </span>
            )}
          </div>
        </div>

        {(posState.customerName || posState.tableNumber) && (
          <div className="flex items-center gap-3 mt-2 text-xs text-ink-muted">
            {posState.customerName && (
              <span className="flex items-center gap-1.5 truncate" data-testid="text-customer-name">
                <User size={12} className="shrink-0 text-accent/60" />
                {posState.customerName}
              </span>
            )}
            {posState.tableNumber && (
              <span data-testid="text-table-number" className="shrink-0 bg-surface-2 px-2 py-0.5 rounded">
                Table {posState.tableNumber}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3">
        {posState.orderItems.length === 0 ? (
          <div className="h-full flex items-center justify-center" data-testid="pos-empty-state">
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-2xl bg-surface-1 border border-line-subtle flex items-center justify-center mx-auto mb-3">
                <ShoppingCart size={24} className="text-ink-ghost" />
              </div>
              <p className="text-ink-faint text-sm font-medium">No items yet</p>
              <p className="text-ink-ghost text-xs mt-1 max-w-[200px] mx-auto leading-relaxed">
                Order items will appear here as you speak
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5" data-testid="pos-items-list">
            {posState.orderItems.map((item, idx) => (
              <motion.div
                key={`${item.name}-${idx}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-between py-3 px-3.5 rounded-lg bg-surface-1 border border-line-subtle hover:bg-surface-2 transition-colors"
                data-testid={`pos-item-${idx}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] text-ink font-medium truncate" data-testid={`text-item-name-${idx}`}>{item.name}</p>
                  <p className="text-xs text-ink-faint mt-0.5">
                    ${item.price.toFixed(2)} × {item.quantity}
                  </p>
                </div>
                <p className="text-[15px] text-ink font-semibold ml-3 tabular-nums" data-testid={`text-item-total-${idx}`}>
                  ${(item.price * item.quantity).toFixed(2)}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-line-subtle px-4 sm:px-5 py-4 space-y-2 bg-surface-1" data-testid="pos-totals">
        <div className="flex justify-between text-sm text-ink-muted">
          <span>Subtotal</span>
          <span className="tabular-nums" data-testid="text-subtotal">${posState.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-ink-muted">
          <span>Tax (8%)</span>
          <span className="tabular-nums" data-testid="text-tax">${posState.tax.toFixed(2)}</span>
        </div>
        <div className="h-px bg-line my-1" />
        <div className="flex justify-between text-lg font-bold text-ink">
          <span>Total</span>
          <span className="tabular-nums" data-testid="text-total">${posState.total.toFixed(2)}</span>
        </div>

        <div className="pt-2">
          <div className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-colors ${
            posState.paymentStatus === "paid"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
              : posState.paymentStatus === "processing"
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
              : "bg-surface-1 text-ink-faint border border-line-subtle"
          }`} data-testid="text-payment-status">
            {posState.paymentStatus === "paid" ? (
              <>
                <CreditCard size={16} />
                Paid{posState.paymentMethod ? ` via ${posState.paymentMethod}` : ""}
              </>
            ) : posState.paymentStatus === "processing" ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing Payment...
              </>
            ) : (
              <>
                <DollarSign size={16} />
                Awaiting Payment
              </>
            )}
          </div>
        </div>

        {posState.lastAction && (
          <p className="text-xs text-ink-faint text-center pt-1 flex items-center justify-center gap-1.5" data-testid="text-last-action">
            <Clock size={10} />
            {posState.lastAction}
          </p>
        )}
      </div>
    </div>
  );
}

function TranscriptBubble({ entry, index }: { entry: TranscriptEntry; index: number }) {
  if (entry.role === "tool") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex justify-center mb-3"
      >
        <div className="border border-line-subtle rounded-lg px-4 py-2.5 max-w-[90%] bg-surface-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded bg-accent-bg flex items-center justify-center">
              <Wrench size={10} className="text-accent/60" />
            </div>
            <span className="text-ink-faint text-xs font-medium">{entry.toolName}</span>
          </div>
          {entry.toolResult ? (
            <div className="text-ink-secondary text-sm leading-relaxed">
              {typeof entry.toolResult === "object" && entry.toolResult.message
                ? entry.toolResult.message
                : <pre className="text-xs whitespace-pre-wrap font-mono text-ink-faint">{JSON.stringify(entry.toolResult, null, 2)}</pre>
              }
            </div>
          ) : (
            <p className="text-ink-faint text-xs animate-pulse">{entry.text}</p>
          )}
        </div>
      </motion.div>
    );
  }

  const isUser = entry.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`mb-3 flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[82%] px-4 py-3 text-[15px] leading-relaxed ${
          isUser
            ? "bg-user-bubble text-ink-secondary rounded-2xl rounded-br-md border border-user-bubble-border"
            : "bg-agent-bubble text-ink-secondary rounded-2xl rounded-bl-md border border-agent-bubble-border"
        }`}
      >
        {entry.text}
      </div>
    </motion.div>
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 pt-3" data-testid="transcript-panel">
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
                <BevProLogo size={56} className="text-ink-ghost mx-auto mb-4" />
                <p className="text-ink-faint text-sm">Conversation will appear here</p>
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
              <div className="text-center">
                <BevProLogo size={64} className="text-accent/30" animated={true} />
                <p className="text-ink-faint text-sm mt-4">Listening...</p>
              </div>
            </motion.div>
          )}

          {voice.transcript.map((entry, i) => (
            <TranscriptBubble key={i} entry={entry} index={i} />
          ))}

          {voice.status === "connected" && voice.isSpeaking && voice.transcript.length > 0 && (
            <motion.div
              key="speaking-pulse"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start mb-3"
            >
              <div className="bg-agent-bubble border border-agent-bubble-border rounded-2xl rounded-bl-md px-4 py-3">
                <BevProLogo size={24} className="text-accent/50" animated={true} />
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
              <div className="bg-agent-bubble border border-agent-bubble-border rounded-2xl rounded-bl-md px-5 py-3.5 flex items-center gap-1.5">
                <motion.div
                  className="w-2 h-2 bg-accent/40 rounded-full"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                  className="w-2 h-2 bg-accent/40 rounded-full"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                />
                <motion.div
                  className="w-2 h-2 bg-accent/40 rounded-full"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                />
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
        headers: getAuthHeaders(),
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
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface-2 border border-line-subtle text-ink-muted hover:text-ink hover:bg-surface-4 transition-colors disabled:opacity-50"
      >
        {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
      </button>
      {uploadResult && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute top-full right-0 mt-2 px-3 py-2 rounded-lg bg-page/90 border border-line text-xs text-ink-secondary whitespace-nowrap shadow-xl"
          data-testid="text-upload-result"
        >
          {uploadResult}
        </motion.div>
      )}
    </div>
  );
}

function AudioRing({ isActive, isSpeaking }: { isActive: boolean; isSpeaking: boolean }) {
  if (!isActive) return null;
  return (
    <div className="absolute inset-0 pointer-events-none">
      <motion.div
        className={`absolute inset-[-8px] rounded-full border-2 ${isSpeaking ? "border-accent/30" : "border-line"}`}
        animate={isSpeaking ? {
          scale: [1, 1.08, 1],
          opacity: [0.3, 0.6, 0.3],
        } : {
          scale: [1, 1.04, 1],
          opacity: [0.15, 0.3, 0.15],
        }}
        transition={{ duration: isSpeaking ? 0.8 : 2, repeat: Infinity, ease: "easeInOut" }}
      />
      {isSpeaking && (
        <motion.div
          className="absolute inset-[-16px] rounded-full border border-accent/15"
          animate={{
            scale: [1, 1.12, 1],
            opacity: [0.15, 0.35, 0.15],
          }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
        />
      )}
    </div>
  );
}

function VoiceControls({ voice, wakeWordConfig }: { voice: ReturnType<typeof useVoiceSession>; wakeWordConfig?: WakeWordConfig }) {
  return (
    <div className="shrink-0 border-t border-line-subtle bg-page/40 backdrop-blur-md" data-testid="voice-controls">
      <div className="flex flex-col items-center gap-3 py-5 sm:py-7 px-4">
        {voice.status === "wake-listening" ? (
          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-18 h-18 sm:w-20 sm:h-20"
            >
              <div className="w-full h-full rounded-full bg-surface-3 border border-line-strong flex items-center justify-center">
                <Volume2 size={28} className="text-ink-muted" />
              </div>
              <motion.div
                className="absolute inset-[-6px] rounded-full border border-line"
                animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
            <p className="text-ink-muted text-sm font-medium" data-testid="text-wake-listening">
              Say "{wakeWordConfig?.phrase || "hey bev"}" to begin
            </p>
            <button
              data-testid="button-stop-wake-word"
              onClick={voice.disconnect}
              className="px-5 py-2.5 rounded-full text-sm font-medium border border-line text-ink-faint hover:text-ink-secondary hover:border-line-strong transition-all min-h-[44px]"
            >
              Stop Listening
            </button>
          </div>
        ) : voice.returningToStandby ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-surface-3 flex items-center justify-center">
              <Loader2 size={28} className="text-ink-faint animate-spin" />
            </div>
            <p className="text-ink-faint text-sm" data-testid="text-returning-standby">Returning to standby...</p>
          </div>
        ) : voice.status === "idle" || voice.status === "error" ? (
          <div className="flex flex-col items-center gap-3">
            <motion.button
              data-testid="button-start-call"
              onClick={() => voice.connect()}
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.04 }}
              className="relative w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-full bg-gradient-to-b from-accent-hover to-accent flex items-center justify-center shadow-[0_0_40px_rgba(201,169,110,0.2),0_4px_16px_rgba(0,0,0,0.3)]"
            >
              <Mic size={28} className="text-black sm:w-8 sm:h-8" />
            </motion.button>
            <p className="text-ink-faint text-sm font-medium">Tap to start</p>
            {wakeWordConfig?.enabled && (
              <button
                data-testid="button-start-wake-word"
                onClick={voice.startWakeWordListening}
                className="px-5 py-2.5 rounded-full text-sm font-medium border border-line text-ink-faint hover:text-ink-secondary hover:border-line-strong transition-all flex items-center gap-2 min-h-[44px]"
              >
                <Volume2 size={15} />
                Wake Word Mode
              </button>
            )}
          </div>
        ) : voice.status === "connecting" ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-full bg-surface-3 border border-line flex items-center justify-center">
              <Loader2 size={28} className="text-accent/60 animate-spin" />
            </div>
            <p className="text-ink-faint text-sm">
              {voice.transcript.length > 0 ? "Reconnecting..." : "Connecting..."}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-5 sm:gap-6">
            <motion.button
              data-testid="button-mute"
              onClick={voice.toggleMute}
              whileTap={{ scale: 0.9 }}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all ${
                voice.isListening
                  ? "bg-surface-3 border border-line text-ink-secondary hover:bg-surface-4"
                  : "bg-red-500/15 border border-red-500/20 text-red-400"
              }`}
            >
              {voice.isListening ? <Mic size={20} /> : <MicOff size={20} />}
            </motion.button>

            <div className="relative">
              <AudioRing isActive={voice.status === "connected"} isSpeaking={voice.isSpeaking} />
              <motion.button
                data-testid="button-end-call"
                onClick={voice.disconnect}
                whileTap={{ scale: 0.9 }}
                className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-red-500 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.25),0_4px_12px_rgba(0,0,0,0.3)]"
              >
                <PhoneOff size={22} className="text-white sm:w-6 sm:h-6" />
              </motion.button>
            </div>

            <div className="w-12 h-12 sm:w-14 sm:h-14" />
          </div>
        )}

        {voice.error && (
          <div className="max-w-sm text-center px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/15" data-testid="text-voice-error">
            <p className="text-red-400 text-sm">{voice.error}</p>
          </div>
        )}

        {!voice.error && !voice.returningToStandby && voice.status === "connected" && (
          <p className="text-ink-faint text-xs">
            {voice.isListening ? (voice.isSpeaking ? "Agent speaking..." : "Listening...") : "Muted"}
          </p>
        )}
      </div>
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
      const res = await fetch(`/api/agents/${agentId}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!agentId,
  });

  const agentConfig = agent?.config as AgentConfig | null;
  const wakeWordConfig: WakeWordConfig | undefined = useMemo(() => {
    if (!agentConfig?.wakeWord?.enabled) return undefined;
    const wk = agentConfig.wakeWord;
    return {
      enabled: true,
      phrase: wk.phrase || "hey bev",
      endPhrases: wk.endPhrases?.length ? wk.endPhrases : ["goodbye", "we are done", "that's all"],
      shutdownPhrases: wk.shutdownPhrases?.length ? wk.shutdownPhrases : ["stop listening", "shut down"],
      levenshteinThreshold: wk.levenshteinThreshold ?? 2,
    };
  }, [agentConfig?.wakeWord]);

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
      <div className="h-[100dvh] bg-page-deep text-ink flex flex-col" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <AgentHeader agent={agent} agentConfig={agentConfig} voice={voice} id={id} />

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          <div className="md:w-[360px] lg:w-[420px] md:border-r border-b md:border-b-0 border-line-subtle h-[38vh] sm:h-[42vh] md:h-auto overflow-hidden bg-page/30" data-testid="pos-panel">
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
    <div className="h-[100dvh] bg-page-deep text-ink flex flex-col" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <AgentHeader agent={agent} agentConfig={agentConfig} voice={voice} id={id} />

      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 pt-3 min-h-0">
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
                  <div className="relative inline-block mb-6">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-b from-surface-2 to-transparent border border-line-subtle flex items-center justify-center mx-auto">
                      <BevProLogo size={48} className="text-ink-ghost sm:w-14 sm:h-14" />
                    </div>
                  </div>
                  <h2 className="text-ink-muted text-base sm:text-lg font-medium mb-1">
                    {agent?.name || "Voice Agent"}
                  </h2>
                  <p className="text-ink-faint text-sm">Tap the button below to start</p>
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
                <div className="text-center">
                  <div className="relative inline-block">
                    <motion.div
                      className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-b from-accent-bg to-transparent border border-accent-border flex items-center justify-center mx-auto"
                      animate={{ scale: [1, 1.03, 1] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <BevProLogo size={56} className="text-accent/30" animated={true} />
                    </motion.div>
                    <motion.div
                      className="absolute inset-[-10px] rounded-full border border-accent-border"
                      animate={{ scale: [1, 1.08, 1], opacity: [0.15, 0.3, 0.15] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                  <p className="text-ink-faint text-sm mt-5">I'm listening...</p>
                </div>
              </motion.div>
            )}

            {voice.transcript.map((entry, i) => (
              <TranscriptBubble key={i} entry={entry} index={i} />
            ))}

            {voice.status === "connected" && voice.isSpeaking && voice.transcript.length > 0 && (
              <motion.div
                key="speaking-pulse"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start mb-3"
              >
                <div className="bg-agent-bubble border border-agent-bubble-border rounded-2xl rounded-bl-md px-4 py-3">
                  <BevProLogo size={24} className="text-accent/50" animated={true} />
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
                <div className="bg-agent-bubble border border-agent-bubble-border rounded-2xl rounded-bl-md px-5 py-3.5 flex items-center gap-1.5">
                  <motion.div
                    className="w-2 h-2 bg-accent/40 rounded-full"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-accent/40 rounded-full"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-accent/40 rounded-full"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <VoiceControls voice={voice} wakeWordConfig={wakeWordConfig} />
    </div>
  );
}
