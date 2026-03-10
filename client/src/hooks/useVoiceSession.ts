import { useState, useRef, useCallback, useEffect } from "react";
import { getAuthHeaders } from "@/lib/queryClient";

export interface TranscriptEntry {
  role: "user" | "assistant" | "tool";
  text: string;
  timestamp: number;
  toolName?: string;
  toolResult?: any;
}

export interface WakeWordConfig {
  enabled: boolean;
  phrase: string;
  endPhrases: string[];
  shutdownPhrases: string[];
  levenshteinThreshold: number;
}

interface VoiceSessionState {
  status: "idle" | "connecting" | "connected" | "error" | "wake-listening";
  isListening: boolean;
  isSpeaking: boolean;
  transcript: TranscriptEntry[];
  latency: number | null;
  error: string | null;
  returningToStandby: boolean;
}

interface PrewarmedSession {
  token: string;
  greeting: string | null;
  fetchedAt: number;
}

const PREWARM_TTL_MS = 50_000;
const WAKE_CHUNK_MS = 1500;
const WAKE_GAP_MS = 50;

// Shared audio constraints for echo cancellation and noise suppression
const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= an; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= bn; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[an][bn];
}

/** Strip punctuation so Whisper artefacts like "Bye." don't skew matching */
function normalizeWord(w: string): string {
  return w.replace(/[^a-z0-9]/g, "");
}

function phraseMatchesWithLevenshtein(transcript: string, phrase: string, threshold: number): boolean {
  const tWords = transcript.toLowerCase().split(/\s+/).map(normalizeWord).filter(Boolean);
  const pWords = phrase.toLowerCase().split(/\s+/).map(normalizeWord).filter(Boolean);
  if (pWords.length === 0) return false;
  // Transcript must have at least as many words as the phrase
  if (tWords.length < pWords.length) return false;
  for (let i = 0; i <= tWords.length - pWords.length; i++) {
    let allMatch = true;
    for (let j = 0; j < pWords.length; j++) {
      // Cap threshold per-word relative to the target word length to prevent
      // short words (e.g. "hey") from matching wildly different words at high thresholds.
      const wordThreshold = Math.min(threshold, Math.max(1, Math.floor(pWords[j].length * 0.4)));
      if (levenshteinDistance(tWords[i + j], pWords[j]) > wordThreshold) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return true;
  }
  return false;
}

export function useVoiceSession(agentId: number | null, wakeWordConfig?: WakeWordConfig) {
  const [state, setState] = useState<VoiceSessionState>({
    status: "idle",
    isListening: false,
    isSpeaking: false,
    transcript: [],
    latency: null,
    error: null,
    returningToStandby: false,
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const greetingRef = useRef<string | null>(null);
  const wakeWordConfigRef = useRef<WakeWordConfig | undefined>(wakeWordConfig);
  const wakeWordActiveRef = useRef<boolean>(false);
  const wakeMediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingInFlightRef = useRef<boolean>(false);
  const startedViaWakeWordRef = useRef<boolean>(false);
  const startWakeWordListeningRef = useRef<((existingStream?: MediaStream) => void) | null>(null);
  const intentionalDisconnectRef = useRef<boolean>(false);
  const disconnectedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoReconnectCountRef = useRef<number>(0);
  const lastTranscriptRef = useRef<TranscriptEntry[]>([]);
  const connectRef = useRef<((reuseStream?: MediaStream) => Promise<void>) | null>(null);
  const reconnectingRef = useRef<boolean>(false);
  const greetingPlayingRef = useRef<boolean>(false);

  const MAX_AUTO_RECONNECTS = 3;
  const DISCONNECTED_GRACE_MS = 5000;
  const KEEP_ALIVE_MS = 20000;
  const GREETING_IMMUNITY_MS = 4000;

  const prewarmedSessionRef = useRef<PrewarmedSession | null>(null);
  const prewarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    wakeWordConfigRef.current = wakeWordConfig;
  }, [wakeWordConfig]);

  const addTranscript = useCallback((entry: TranscriptEntry) => {
    setState((s) => ({ ...s, transcript: [...s.transcript, entry] }));
  }, []);

  const prewarmSession = useCallback(async () => {
    if (!agentId) return;
    try {
      const res = await fetch("/api/voice/session", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ agentId }),
      });
      if (res.ok) {
        const session = await res.json();
        if (session.token) {
          prewarmedSessionRef.current = {
            token: session.token,
            greeting: session.greeting || null,
            fetchedAt: Date.now(),
          };
        }
      }
    } catch {}
  }, [agentId]);

  const startPrewarmLoop = useCallback(() => {
    if (prewarmIntervalRef.current) clearInterval(prewarmIntervalRef.current);
    prewarmSession();
    prewarmIntervalRef.current = setInterval(() => {
      if (wakeWordActiveRef.current) {
        prewarmSession();
      }
    }, PREWARM_TTL_MS);
  }, [prewarmSession]);

  const stopPrewarmLoop = useCallback(() => {
    if (prewarmIntervalRef.current) {
      clearInterval(prewarmIntervalRef.current);
      prewarmIntervalRef.current = null;
    }
    prewarmedSessionRef.current = null;
  }, []);

  const stopWakeWordListening = useCallback(() => {
    wakeWordActiveRef.current = false;
    recordingInFlightRef.current = false;
    if (recordingLoopRef.current) {
      clearTimeout(recordingLoopRef.current);
      recordingLoopRef.current = null;
    }
    if (recorderRef.current) {
      try { recorderRef.current.stop(); } catch (_e) {}
      recorderRef.current = null;
    }
    if (wakeMediaStreamRef.current) {
      wakeMediaStreamRef.current.getTracks().forEach(t => t.stop());
      wakeMediaStreamRef.current = null;
    }
    stopPrewarmLoop();
  }, [stopPrewarmLoop]);

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
      try { audioContextRef.current.close(); } catch (_) {}
      audioContextRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.src = "";
    }
  }, [clearTimers]);

  const handleUnexpectedDrop = useCallback(() => {
    disconnectVoice();
    const canRetry = autoReconnectCountRef.current < MAX_AUTO_RECONNECTS && !reconnectingRef.current;
    if (canRetry && connectRef.current) {
      autoReconnectCountRef.current += 1;
      reconnectingRef.current = true;
      console.info(`Auto-reconnecting (attempt ${autoReconnectCountRef.current}/${MAX_AUTO_RECONNECTS})...`);
      setState((s) => ({
        ...s,
        status: "connecting",
        isListening: false,
        isSpeaking: false,
        error: null,
      }));
      // Short delay before reconnect to let network settle
      setTimeout(() => {
        reconnectingRef.current = false;
        connectRef.current?.();
      }, 800);
    } else {
      setState((s) => ({
        ...s,
        status: "error",
        isListening: false,
        isSpeaking: false,
        error: "Voice connection lost. Please reconnect.",
      }));
    }
  }, [disconnectVoice]);

  const audioContextRef = useRef<AudioContext | null>(null);

  const connectWithSession = useCallback(async (token: string, greeting: string | null, existingStream?: MediaStream) => {
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
      // iOS routes raw <audio> WebRTC through the earpiece by default;
      // an AudioContext destination always uses the main speaker.
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          if (audioContextRef.current) {
            try { audioContextRef.current.close(); } catch (_) {}
          }
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(remoteStream);
          // Gain node at full volume to ensure loud speaker output
          const gain = ctx.createGain();
          gain.gain.value = 1.0;
          source.connect(gain);
          gain.connect(ctx.destination);
          // Resume context (required for iOS autoplay policy)
          if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
          }
        }
      } catch (audioCtxErr) {
        console.warn("AudioContext speaker routing failed, falling back to <audio> element:", audioCtxErr);
      }

      setState((s) => ({ ...s, isSpeaking: true }));
    };

    // Monitor WebRTC connection state — use grace period for "disconnected" (transient)
    pc.onconnectionstatechange = () => {
      if (intentionalDisconnectRef.current) return;
      const connState = pc.connectionState;

      if (connState === "connected") {
        // Recovered from a transient disconnect — cancel pending grace timer
        if (disconnectedTimerRef.current) {
          clearTimeout(disconnectedTimerRef.current);
          disconnectedTimerRef.current = null;
          console.info("WebRTC recovered to connected state");
        }
        return;
      }

      if (connState === "failed") {
        // Unrecoverable — tear down immediately
        console.warn("WebRTC connection failed");
        if (disconnectedTimerRef.current) {
          clearTimeout(disconnectedTimerRef.current);
          disconnectedTimerRef.current = null;
        }
        handleUnexpectedDrop();
        return;
      }

      if (connState === "disconnected") {
        // Temporary — give ICE a chance to recover before tearing down
        if (!disconnectedTimerRef.current) {
          console.warn("WebRTC disconnected — waiting for recovery...");
          disconnectedTimerRef.current = setTimeout(() => {
            disconnectedTimerRef.current = null;
            if (pc.connectionState !== "connected" && !intentionalDisconnectRef.current) {
              console.warn("WebRTC did not recover within grace period");
              handleUnexpectedDrop();
            }
          }, DISCONNECTED_GRACE_MS);
        }
      }
    };

    let stream: MediaStream;
    if (existingStream && existingStream.getAudioTracks().length > 0 && existingStream.getAudioTracks()[0].readyState === "live") {
      stream = existingStream;
    } else {
      try {
        stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
      } catch (micErr: any) {
        throw new Error("Microphone access required. Please allow microphone permission and ensure a mic is connected.");
      }
    }
    mediaStreamRef.current = stream;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const dc = pc.createDataChannel("oai-events");
    dcRef.current = dc;
    greetingRef.current = greeting;

    // Detect data channel closing unexpectedly (not from our own disconnectVoice call)
    dc.onclose = () => {
      if (intentionalDisconnectRef.current) return;
      console.warn("Data channel closed unexpectedly");
      if (pcRef.current === pc) {
        handleUnexpectedDrop();
      }
    };

    dc.onmessage = async (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "session.created":
          setState((s) => ({ ...s, status: "connected", isListening: true }));
          // Start keep-alive pings to prevent session timeout
          if (keepAliveRef.current) clearInterval(keepAliveRef.current);
          keepAliveRef.current = setInterval(() => {
            if (dc.readyState === "open") {
              try {
                dc.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
              } catch {}
            }
          }, KEEP_ALIVE_MS);
          if (greetingRef.current && dc.readyState === "open") {
            // Mute mic during greeting to prevent echo from triggering VAD
            greetingPlayingRef.current = true;
            const micTrack = mediaStreamRef.current?.getAudioTracks()[0];
            if (micTrack) micTrack.enabled = false;
            setState((s) => ({ ...s, isListening: false }));

            dc.send(JSON.stringify({
              type: "response.create",
              response: {
                modalities: ["text", "audio"],
                instructions: `Say exactly this greeting to the user: "${greetingRef.current}"`,
              },
            }));
          }
          break;

        case "conversation.item.input_audio_transcription.completed":
          if (msg.transcript) {
            addTranscript({ role: "user", text: msg.transcript, timestamp: Date.now() });
            // Skip end/shutdown phrase checks during greeting immunity window
            if (greetingPlayingRef.current) break;
            // Only check end/shutdown phrases if session was started via wake word
            const cfg = wakeWordConfigRef.current;
            if (cfg?.enabled && startedViaWakeWordRef.current) {
              const text = msg.transcript.toLowerCase();
              for (const endPhrase of cfg.endPhrases) {
                if (phraseMatchesWithLevenshtein(text, endPhrase, cfg.levenshteinThreshold)) {
                  setState((s) => ({ ...s, returningToStandby: true }));
                  setTimeout(() => {
                    // On iOS, getUserMedia requires a user gesture.  Salvage the
                    // current mic stream *before* disconnecting so wake-word
                    // listening can reuse it instead of requesting a new one.
                    const savedStream = mediaStreamRef.current;
                    mediaStreamRef.current = null; // prevent disconnectVoice from stopping tracks
                    disconnectVoice();
                    startWakeWordListeningRef.current?.(savedStream ?? undefined);
                  }, 1500);
                  return;
                }
              }
              for (const shutdownPhrase of cfg.shutdownPhrases) {
                if (phraseMatchesWithLevenshtein(text, shutdownPhrase, cfg.levenshteinThreshold)) {
                  disconnectVoice();
                  stopWakeWordListening();
                  setState({
                    status: "idle",
                    isListening: false,
                    isSpeaking: false,
                    transcript: [],
                    latency: null,
                    error: null,
                    returningToStandby: false,
                  });
                  return;
                }
              }
            }
          }
          break;

        case "response.audio_transcript.done":
          if (msg.transcript) {
            const lat = startTimeRef.current ? Date.now() - startTimeRef.current : null;
            addTranscript({ role: "assistant", text: msg.transcript, timestamp: Date.now() });
            setState((s) => ({ ...s, latency: lat, isSpeaking: false }));
          }
          // Re-enable mic after assistant finishes speaking (greeting or response)
          if (greetingPlayingRef.current) {
            greetingPlayingRef.current = false;
            const micTrack = mediaStreamRef.current?.getAudioTracks()[0];
            if (micTrack) micTrack.enabled = true;
            setState((s) => ({ ...s, isListening: true }));
          }
          break;

        case "response.done":
          // Fallback: re-enable mic if greeting flag is still set (e.g. empty response)
          if (greetingPlayingRef.current) {
            greetingPlayingRef.current = false;
            const micTrack = mediaStreamRef.current?.getAudioTracks()[0];
            if (micTrack) micTrack.enabled = true;
            setState((s) => ({ ...s, isListening: true }));
          }
          break;

        case "input_audio_buffer.speech_started":
          startTimeRef.current = Date.now();
          setState((s) => ({ ...s, isListening: true }));
          break;

        case "input_audio_buffer.speech_stopped":
          setState((s) => ({ ...s, isListening: false }));
          break;

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
              headers: getAuthHeaders({ "Content-Type": "application/json" }),
              credentials: "include",
              body: JSON.stringify({ toolName, arguments: toolArgs, agentId }),
            });
            const toolResult = await toolRes.json();

            addTranscript({
              role: "tool",
              text: JSON.stringify(toolResult.result, null, 2),
              timestamp: Date.now(),
              toolName,
              toolResult: toolResult.result,
            });

            const responseEvent = {
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: msg.call_id,
                output: JSON.stringify(toolResult.result),
              },
            };
            dc.send(JSON.stringify(responseEvent));
            dc.send(JSON.stringify({ type: "response.create" }));
          } catch (err) {
            console.error("Tool call failed:", err);
            const errorResponse = {
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: msg.call_id,
                output: JSON.stringify({ error: "Tool execution failed" }),
              },
            };
            dc.send(JSON.stringify(errorResponse));
            dc.send(JSON.stringify({ type: "response.create" }));
          }
          break;
        }

        case "error":
          console.error("Realtime error:", msg.error);
          setState((s) => ({ ...s, error: msg.error?.message || "Voice error" }));
          break;
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpRes = await fetch("https://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/sdp",
      },
      body: offer.sdp,
    });

    if (!sdpRes.ok) {
      throw new Error("Failed to connect to OpenAI Realtime");
    }

    const answer = new RTCSessionDescription({
      type: "answer",
      sdp: await sdpRes.text(),
    });
    await pc.setRemoteDescription(answer);
  }, [agentId, addTranscript, disconnectVoice, handleUnexpectedDrop]);

  const connect = useCallback(async (reuseStream?: MediaStream) => {
    if (!agentId) return;

    const cachedSession = prewarmedSessionRef.current;
    prewarmedSessionRef.current = null;

    // Track whether this session was initiated via wake word (has reuseStream from wake mic)
    startedViaWakeWordRef.current = !!reuseStream;

    stopWakeWordListening();
    intentionalDisconnectRef.current = false;
    greetingPlayingRef.current = false;

    // Only reset reconnect counter on fresh user-initiated connects (not auto-reconnects)
    if (!reconnectingRef.current) {
      autoReconnectCountRef.current = 0;
    }

    // Preserve transcript during auto-reconnect, clear on fresh connect
    if (reconnectingRef.current) {
      setState((s) => ({ ...s, status: "connecting", error: null, returningToStandby: false }));
    } else {
      setState((s) => ({ ...s, status: "connecting", error: null, transcript: [], returningToStandby: false }));
    }

    try {
      let token: string;
      let greeting: string | null;

      if (cachedSession && (Date.now() - cachedSession.fetchedAt) < PREWARM_TTL_MS) {
        token = cachedSession.token;
        greeting = cachedSession.greeting;
      } else {
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
        token = session.token;
        greeting = session.greeting || null;

        if (!token) {
          throw new Error("No session token received");
        }
      }

      await connectWithSession(token, greeting, reuseStream);
    } catch (error: any) {
      console.error("Voice connection error:", error);
      if (reuseStream) {
        reuseStream.getTracks().forEach(t => t.stop());
      }
      setState((s) => ({
        ...s,
        status: "error",
        error: error.message || "Connection failed",
      }));
    }
  }, [agentId, stopWakeWordListening, connectWithSession]);

  // Keep connectRef in sync so handleUnexpectedDrop can call the latest version
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const startWakeWordListeningInternal = useCallback((existingStream?: MediaStream) => {
    stopWakeWordListening();
    setState((s) => ({
      ...s,
      status: "wake-listening",
      isListening: false,
      isSpeaking: false,
      transcript: [],
      latency: null,
      error: null,
      returningToStandby: false,
    }));

    wakeWordActiveRef.current = true;

    startPrewarmLoop();

    // Guard: MediaRecorder API must exist (missing on older iOS WKWebView)
    if (typeof MediaRecorder === "undefined") {
      setState((s) => ({
        ...s,
        status: "error",
        error: "Wake word detection is not supported on this device. Please update iOS or use Safari.",
      }));
      return;
    }

    // If we already have a live mic stream (e.g. returning to standby on iOS
    // where getUserMedia requires a user gesture), reuse it directly.
    const reuseExisting = existingStream &&
      existingStream.getAudioTracks().length > 0 &&
      existingStream.getAudioTracks()[0].readyState === "live";

    const streamPromise = reuseExisting
      ? Promise.resolve(existingStream!)
      : navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);

    streamPromise.then((stream) => {
      if (!wakeWordActiveRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      wakeMediaStreamRef.current = stream;

      // Detect supported audio MIME type — iOS Safari only supports mp4/aac, not webm
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : MediaRecorder.isTypeSupported("audio/aac")
        ? "audio/aac"
        : MediaRecorder.isTypeSupported("audio/mpeg")
        ? "audio/mpeg"
        : null;

      if (!mimeType) {
        setState((s) => ({
          ...s,
          status: "error",
          error: "Your browser does not support audio recording for wake word detection. Please use Chrome or Safari.",
        }));
        return;
      }

      // Determine file extension for the transcription upload based on MIME type
      const mimeExtMap: Record<string, string> = {
        "audio/webm;codecs=opus": "webm",
        "audio/webm": "webm",
        "audio/mp4": "m4a",
        "audio/aac": "aac",
        "audio/mpeg": "mp3",
      };
      const wakeFileExt = mimeExtMap[mimeType] || "webm";

      const recordAndCheck = () => {
        if (!wakeWordActiveRef.current || !wakeMediaStreamRef.current) return;
        // Check that the audio track is still alive
        const tracks = wakeMediaStreamRef.current.getAudioTracks();
        if (tracks.length === 0 || tracks[0].readyState !== "live") {
          console.warn("Wake word mic track ended, reacquiring...");
          wakeMediaStreamRef.current = null;
          navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS).then((newStream) => {
            if (!wakeWordActiveRef.current) {
              newStream.getTracks().forEach(t => t.stop());
              return;
            }
            wakeMediaStreamRef.current = newStream;
            recordingInFlightRef.current = false;
            recordAndCheck();
          }).catch(() => {
            recordingInFlightRef.current = false;
          });
          return;
        }
        if (recordingInFlightRef.current) return;
        recordingInFlightRef.current = true;

        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(wakeMediaStreamRef.current, { mimeType });
        } catch {
          recordingInFlightRef.current = false;
          setState((s) => ({
            ...s,
            status: "error",
            error: "Failed to start audio recorder. Please try a different browser.",
          }));
          return;
        }
        recorderRef.current = recorder;
        const chunks: BlobPart[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onerror = () => {
          // Reset in-flight flag so the loop can continue after a recorder error
          recorderRef.current = null;
          recordingInFlightRef.current = false;
          if (wakeWordActiveRef.current) {
            recordingLoopRef.current = setTimeout(recordAndCheck, WAKE_GAP_MS);
          }
        };

        recorder.onstop = async () => {
          recorderRef.current = null;

          if (!wakeWordActiveRef.current) {
            recordingInFlightRef.current = false;
            return;
          }

          // On iOS the first chunk can be a bare container header with no
          // actual audio.  Use a very small threshold (just above 0) so
          // we don't accidentally filter out short utterances, but still
          // skip truly empty recordings.
          if (chunks.length === 0) {
            recordingInFlightRef.current = false;
            if (wakeWordActiveRef.current) {
              recordingLoopRef.current = setTimeout(recordAndCheck, WAKE_GAP_MS);
            }
            return;
          }

          const blob = new Blob(chunks, { type: mimeType });

          try {
            const formData = new FormData();
            formData.append("audio", blob, `wake.${wakeFileExt}`);
            const res = await fetch("/api/voice/transcribe", {
              method: "POST",
              credentials: "include",
              headers: getAuthHeaders(),
              body: formData,
            });

            if (!wakeWordActiveRef.current) {
              recordingInFlightRef.current = false;
              return;
            }

            if (res.ok) {
              const { text } = await res.json();
              const cfg = wakeWordConfigRef.current;
              if (cfg && text && phraseMatchesWithLevenshtein(text, cfg.phrase, cfg.levenshteinThreshold)) {
                recordingInFlightRef.current = false;
                const wakeStream = wakeMediaStreamRef.current;
                wakeWordActiveRef.current = false;
                if (recordingLoopRef.current) {
                  clearTimeout(recordingLoopRef.current);
                  recordingLoopRef.current = null;
                }
                if (recorderRef.current) {
                  try { (recorderRef.current as MediaRecorder).stop(); } catch (_e) {}
                  recorderRef.current = null;
                }
                wakeMediaStreamRef.current = null;
                connect(wakeStream || undefined);
                return;
              }
            } else {
              console.warn("Wake word transcription failed:", res.status);
            }
          } catch (err) {
            console.error("Wake word transcription error:", err);
          }

          recordingInFlightRef.current = false;
          if (wakeWordActiveRef.current) {
            recordingLoopRef.current = setTimeout(recordAndCheck, WAKE_GAP_MS);
          }
        };

        // iOS MediaRecorder can take ~200ms to initialise; add a small
        // buffer so the recorded chunk actually contains audio data.
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        const initDelayMs = isIOS ? 250 : 0;

        recorder.start();
        setTimeout(() => {
          if (recorder.state === "recording") {
            try { recorder.stop(); } catch (_e) {}
          }
        }, WAKE_CHUNK_MS + initDelayMs);
      };

      recordAndCheck();
    }).catch((_err) => {
      setState((s) => ({
        ...s,
        status: "error",
        error: "Microphone access required. Please allow microphone permissions.",
      }));
    });
  }, [connect, stopWakeWordListening, startPrewarmLoop]);

  // Keep ref in sync so connectWithSession's closure always calls the latest version
  useEffect(() => {
    startWakeWordListeningRef.current = startWakeWordListeningInternal;
  }, [startWakeWordListeningInternal]);

  const startWakeWordListening = useCallback((existingStream?: MediaStream) => {
    startWakeWordListeningInternal(existingStream);
  }, [startWakeWordListeningInternal]);

  const disconnect = useCallback(() => {
    stopWakeWordListening();
    disconnectVoice();
    startedViaWakeWordRef.current = false;
    setState({
      status: "idle",
      isListening: false,
      isSpeaking: false,
      transcript: [],
      latency: null,
      error: null,
      returningToStandby: false,
    });
  }, [stopWakeWordListening, disconnectVoice]);

  const toggleMute = useCallback(() => {
    if (mediaStreamRef.current) {
      const track = mediaStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setState((s) => ({ ...s, isListening: track.enabled }));
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    toggleMute,
    startWakeWordListening,
  };
}
