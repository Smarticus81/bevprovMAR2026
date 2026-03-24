import { useState, useRef, useCallback, useEffect } from "react";
import { getAuthHeaders } from "@/lib/queryClient";

export interface TranscriptEntry {
  role: "user" | "assistant" | "tool";
  text: string;
  timestamp: number;
  toolName?: string;
  toolResult?: any;
}

export type AgentState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

interface VoiceSessionState {
  status: AgentState;
  transcript: TranscriptEntry[];
  partialTranscript: string;
  latency: number | null;
  error: string | null;
}

// Shared audio constraints — echoCancellation is CRITICAL to prevent feedback loops
const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

const MAX_AUTO_RECONNECTS = 3;
const DISCONNECTED_GRACE_MS = 5000;
const KEEP_ALIVE_MS = 20000;

export function useVoiceSession(agentId: number | null) {
  const [state, setState] = useState<VoiceSessionState>({
    status: "idle",
    transcript: [],
    partialTranscript: "",
    latency: null,
    error: null,
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const greetingRef = useRef<string | null>(null);
  const intentionalDisconnectRef = useRef<boolean>(false);
  const disconnectedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoReconnectCountRef = useRef<number>(0);
  const connectRef = useRef<(() => Promise<void>) | null>(null);
  const reconnectingRef = useRef<boolean>(false);
  const greetingPlayingRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const agentStateRef = useRef<AgentState>("idle");

  // Keep agentStateRef in sync for use in callbacks
  useEffect(() => {
    agentStateRef.current = state.status;
  }, [state.status]);

  const addTranscript = useCallback((entry: TranscriptEntry) => {
    setState((s) => ({ ...s, transcript: [...s.transcript, entry] }));
  }, []);

  const clearTimers = useCallback(() => {
    if (disconnectedTimerRef.current) {
      clearTimeout(disconnectedTimerRef.current);
      disconnectedTimerRef.current = null;
    }
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  }, []);

  const disconnectVoice = useCallback(() => {
    intentionalDisconnectRef.current = true;
    greetingPlayingRef.current = false;
    clearTimers();

    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.src = "";
    }
  }, [clearTimers]);

  const handleUnexpectedDrop = useCallback(() => {
    disconnectVoice();
    const canRetry =
      autoReconnectCountRef.current < MAX_AUTO_RECONNECTS &&
      !reconnectingRef.current;
    if (canRetry && connectRef.current) {
      autoReconnectCountRef.current += 1;
      reconnectingRef.current = true;
      console.info(
        `Auto-reconnecting (attempt ${autoReconnectCountRef.current}/${MAX_AUTO_RECONNECTS})...`,
      );
      setState((s) => ({
        ...s,
        status: "connecting",
        error: null,
      }));
      setTimeout(() => {
        reconnectingRef.current = false;
        connectRef.current?.();
      }, 800);
    } else {
      setState((s) => ({
        ...s,
        status: "error",
        error: "Voice connection lost. Please reconnect.",
      }));
    }
  }, [disconnectVoice]);

  const connectWithSession = useCallback(
    async (token: string, greeting: string | null) => {
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.autoplay = true;
      }
      // iOS: ensure audio plays through loudspeaker, not earpiece
      const audio = audioRef.current;
      audio.setAttribute("playsinline", "true");
      audio.volume = 1.0;

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        audio.srcObject = remoteStream;

        // Route through Web Audio API to force iOS loudspeaker output
        try {
          const AudioCtx =
            window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            if (audioContextRef.current) {
              try { audioContextRef.current.close(); } catch {}
            }
            const ctx = new AudioCtx();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(remoteStream);
            const gain = ctx.createGain();
            gain.gain.value = 1.0;
            source.connect(gain);
            gain.connect(ctx.destination);
            if (ctx.state === "suspended") {
              ctx.resume().catch(() => {});
            }
          }
        } catch (audioCtxErr) {
          console.warn(
            "AudioContext speaker routing failed, falling back to <audio> element:",
            audioCtxErr,
          );
        }
      };

      // Monitor WebRTC connection state
      pc.onconnectionstatechange = () => {
        if (intentionalDisconnectRef.current) return;
        const connState = pc.connectionState;

        if (connState === "connected") {
          if (disconnectedTimerRef.current) {
            clearTimeout(disconnectedTimerRef.current);
            disconnectedTimerRef.current = null;
          }
          return;
        }

        if (connState === "failed") {
          if (disconnectedTimerRef.current) {
            clearTimeout(disconnectedTimerRef.current);
            disconnectedTimerRef.current = null;
          }
          handleUnexpectedDrop();
          return;
        }

        if (connState === "disconnected") {
          if (!disconnectedTimerRef.current) {
            disconnectedTimerRef.current = setTimeout(() => {
              disconnectedTimerRef.current = null;
              if (
                pc.connectionState !== "connected" &&
                !intentionalDisconnectRef.current
              ) {
                handleUnexpectedDrop();
              }
            }, DISCONNECTED_GRACE_MS);
          }
        }
      };

      // Acquire microphone
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
      } catch {
        throw new Error(
          "Microphone access required. Please allow microphone permission and ensure a mic is connected.",
        );
      }
      mediaStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Data channel — MUST be named "oai-events"
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      greetingRef.current = greeting;

      dc.onclose = () => {
        if (intentionalDisconnectRef.current) return;
        if (pcRef.current === pc) {
          handleUnexpectedDrop();
        }
      };

      dc.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          // ── Session lifecycle ──
          case "session.created":
            setState((s) => ({ ...s, status: "listening" }));
            // Keep-alive pings
            if (keepAliveRef.current) clearInterval(keepAliveRef.current);
            keepAliveRef.current = setInterval(() => {
              if (dc.readyState === "open") {
                try {
                  dc.send(
                    JSON.stringify({ type: "input_audio_buffer.commit" }),
                  );
                } catch {}
              }
            }, KEEP_ALIVE_MS);
            // Greeting
            if (greetingRef.current && dc.readyState === "open") {
              greetingPlayingRef.current = true;
              const micTrack = mediaStreamRef.current?.getAudioTracks()[0];
              if (micTrack) micTrack.enabled = false;
              dc.send(
                JSON.stringify({
                  type: "response.create",
                  response: {
                    modalities: ["text", "audio"],
                    instructions: `Say exactly this greeting to the user: "${greetingRef.current}"`,
                  },
                }),
              );
            }
            break;

          case "session.updated":
            // Acknowledgment — no action needed
            break;

          // ── Voice Activity Detection ──
          case "input_audio_buffer.speech_started":
            startTimeRef.current = Date.now();
            // Interruption: cancel agent response if it's speaking
            if (agentStateRef.current === "speaking") {
              dc.send(JSON.stringify({ type: "response.cancel" }));
            }
            setState((s) => ({ ...s, status: "listening", partialTranscript: "" }));
            break;

          case "input_audio_buffer.speech_stopped":
            setState((s) => ({ ...s, status: "thinking" }));
            break;

          // ── Transcription ──
          case "response.audio_transcript.delta":
            if (msg.delta) {
              setState((s) => ({
                ...s,
                partialTranscript: s.partialTranscript + msg.delta,
              }));
            }
            break;

          case "conversation.item.input_audio_transcription.completed":
            if (msg.transcript) {
              addTranscript({
                role: "user",
                text: msg.transcript.trim(),
                timestamp: Date.now(),
              });
            }
            break;

          case "response.audio_transcript.done":
            if (msg.transcript) {
              const lat = startTimeRef.current
                ? Date.now() - startTimeRef.current
                : null;
              addTranscript({
                role: "assistant",
                text: msg.transcript.trim(),
                timestamp: Date.now(),
              });
              setState((s) => ({
                ...s,
                latency: lat,
                partialTranscript: "",
              }));
            }
            // Re-enable mic after greeting
            if (greetingPlayingRef.current) {
              greetingPlayingRef.current = false;
              const micTrack = mediaStreamRef.current?.getAudioTracks()[0];
              if (micTrack) micTrack.enabled = true;
            }
            break;

          // ── Audio playback ──
          case "response.audio.delta":
            setState((s) => ({ ...s, status: "speaking" }));
            break;

          // ── Response lifecycle ──
          case "response.done":
            setState((s) => ({ ...s, status: "listening" }));
            // Fallback: re-enable mic if greeting flag is still set
            if (greetingPlayingRef.current) {
              greetingPlayingRef.current = false;
              const micTrack = mediaStreamRef.current?.getAudioTracks()[0];
              if (micTrack) micTrack.enabled = true;
            }
            break;

          // ── Tool calls ──
          case "response.function_call_arguments.done": {
            const toolName = msg.name;
            const toolArgs = JSON.parse(msg.arguments || "{}");

            addTranscript({
              role: "tool",
              text: `Calling ${toolName}...`,
              timestamp: Date.now(),
              toolName,
            });

            try {
              const toolRes = await fetch("/api/voice/tool-call", {
                method: "POST",
                headers: getAuthHeaders({
                  "Content-Type": "application/json",
                }),
                credentials: "include",
                body: JSON.stringify({
                  toolName,
                  arguments: toolArgs,
                  agentId,
                }),
              });
              const toolResult = await toolRes.json();

              addTranscript({
                role: "tool",
                text: JSON.stringify(toolResult.result, null, 2),
                timestamp: Date.now(),
                toolName,
                toolResult: toolResult.result,
              });

              // Send result back to OpenAI
              dc.send(
                JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id: msg.call_id,
                    output: JSON.stringify(toolResult.result),
                  },
                }),
              );
              // CRITICAL: trigger response generation
              dc.send(JSON.stringify({ type: "response.create" }));
            } catch (err) {
              console.error("Tool call failed:", err);
              dc.send(
                JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id: msg.call_id,
                    output: JSON.stringify({
                      error: "Tool execution failed",
                    }),
                  },
                }),
              );
              dc.send(JSON.stringify({ type: "response.create" }));
            }
            break;
          }

          // ── Errors ──
          case "error":
            console.error("Realtime error:", msg.error);
            setState((s) => ({
              ...s,
              status: "error",
              error: msg.error?.message || "Voice error",
            }));
            break;
        }
      };

      // WebRTC SDP exchange
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        "https://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        },
      );

      if (!sdpRes.ok) {
        throw new Error("Failed to connect to OpenAI Realtime");
      }

      const answer = new RTCSessionDescription({
        type: "answer",
        sdp: await sdpRes.text(),
      });
      await pc.setRemoteDescription(answer);
    },
    [agentId, addTranscript, disconnectVoice, handleUnexpectedDrop],
  );

  const connect = useCallback(async () => {
    if (!agentId) return;

    intentionalDisconnectRef.current = false;
    greetingPlayingRef.current = false;

    if (!reconnectingRef.current) {
      autoReconnectCountRef.current = 0;
    }

    if (reconnectingRef.current) {
      setState((s) => ({ ...s, status: "connecting", error: null }));
    } else {
      setState((s) => ({
        ...s,
        status: "connecting",
        error: null,
        transcript: [],
        partialTranscript: "",
      }));
    }

    try {
      const tokenRes = await fetch("/api/voice/session", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ agentId }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        throw new Error(err.error || "Failed to create session");
      }

      const session = await tokenRes.json();
      const token = session.client_secret?.value ?? session.token;
      const greeting = session.greeting || null;

      if (!token) {
        throw new Error("No session token received");
      }

      await connectWithSession(token, greeting);
    } catch (error: any) {
      console.error("Voice connection error:", error);
      setState((s) => ({
        ...s,
        status: "error",
        error: error.message || "Connection failed",
      }));
    }
  }, [agentId, connectWithSession]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    disconnectVoice();
    setState({
      status: "idle",
      transcript: [],
      partialTranscript: "",
      latency: null,
      error: null,
    });
  }, [disconnectVoice]);

  const interrupt = useCallback(() => {
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(JSON.stringify({ type: "response.cancel" }));
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (mediaStreamRef.current) {
      const track = mediaStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setState((s) => ({
          ...s,
          status: track.enabled ? "listening" : s.status,
        }));
      }
    }
  }, []);

  const sendContextUpdate = useCallback((instructions: string) => {
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(
        JSON.stringify({
          type: "session.update",
          session: { instructions },
        }),
      );
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnectVoice();
    };
  }, [disconnectVoice]);

  return {
    ...state,
    connect,
    disconnect,
    interrupt,
    toggleMute,
    sendContextUpdate,
    isMuted: mediaStreamRef.current
      ? !mediaStreamRef.current.getAudioTracks()[0]?.enabled
      : false,
  };
}
