import { useState, useRef, useCallback, useEffect } from "react";

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

function phraseMatchesWithLevenshtein(transcript: string, phrase: string, threshold: number): boolean {
  const tWords = transcript.toLowerCase().split(/\s+/).filter(Boolean);
  const pWords = phrase.toLowerCase().split(/\s+/).filter(Boolean);
  if (pWords.length === 0) return false;
  for (let i = 0; i <= tWords.length - pWords.length; i++) {
    let allMatch = true;
    for (let j = 0; j < pWords.length; j++) {
      if (levenshteinDistance(tWords[i + j], pWords[j]) > threshold) {
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

  useEffect(() => {
    wakeWordConfigRef.current = wakeWordConfig;
  }, [wakeWordConfig]);

  const addTranscript = useCallback((entry: TranscriptEntry) => {
    setState((s) => ({ ...s, transcript: [...s.transcript, entry] }));
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
  }, []);

  const disconnectVoice = useCallback(() => {
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
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.src = "";
    }
  }, []);

  const connect = useCallback(async () => {
    if (!agentId) return;

    stopWakeWordListening();
    setState((s) => ({ ...s, status: "connecting", error: null, transcript: [], returningToStandby: false }));

    try {
      const tokenRes = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agentId }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        throw new Error(err.error || "Failed to create session");
      }

      const session = await tokenRes.json();
      const token = session.token;
      greetingRef.current = session.greeting || null;

      if (!token) {
        throw new Error("No session token received");
      }

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.autoplay = true;
      }

      pc.ontrack = (event) => {
        audioRef.current!.srcObject = event.streams[0];
        setState((s) => ({ ...s, isSpeaking: true }));
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (micErr: any) {
        throw new Error("Microphone access required. Please allow microphone permission and ensure a mic is connected.");
      }
      mediaStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "session.created":
            setState((s) => ({ ...s, status: "connected", isListening: true }));
            if (greetingRef.current && dc.readyState === "open") {
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
              const cfg = wakeWordConfigRef.current;
              if (cfg?.enabled) {
                const text = msg.transcript.toLowerCase();
                for (const endPhrase of cfg.endPhrases) {
                  if (phraseMatchesWithLevenshtein(text, endPhrase, cfg.levenshteinThreshold)) {
                    setState((s) => ({ ...s, returningToStandby: true }));
                    setTimeout(() => {
                      disconnectVoice();
                      startWakeWordListeningInternal();
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
                headers: { "Content-Type": "application/json" },
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
    } catch (error: any) {
      console.error("Voice connection error:", error);
      setState((s) => ({
        ...s,
        status: "error",
        error: error.message || "Connection failed",
      }));
    }
  }, [agentId, addTranscript, stopWakeWordListening, disconnectVoice]);

  const startWakeWordListeningInternal = useCallback(() => {
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

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      if (!wakeWordActiveRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      wakeMediaStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : null;

      if (!mimeType) {
        setState((s) => ({
          ...s,
          status: "error",
          error: "Your browser does not support audio recording for wake word detection. Please use Chrome or Safari.",
        }));
        return;
      }

      const recordAndCheck = () => {
        if (!wakeWordActiveRef.current || !wakeMediaStreamRef.current) return;
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
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
          recorderRef.current = null;

          if (!wakeWordActiveRef.current) {
            recordingInFlightRef.current = false;
            return;
          }

          if (chunks.length === 0 || new Blob(chunks).size < 1000) {
            recordingInFlightRef.current = false;
            if (wakeWordActiveRef.current) {
              recordingLoopRef.current = setTimeout(recordAndCheck, 200);
            }
            return;
          }

          const blob = new Blob(chunks, { type: mimeType });

          try {
            const formData = new FormData();
            formData.append("audio", blob, "wake.webm");
            const res = await fetch("/api/voice/transcribe", {
              method: "POST",
              credentials: "include",
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
                stopWakeWordListening();
                connect();
                return;
              }
            }
          } catch (err) {
            console.error("Wake word transcription error:", err);
          }

          recordingInFlightRef.current = false;
          if (wakeWordActiveRef.current) {
            recordingLoopRef.current = setTimeout(recordAndCheck, 200);
          }
        };

        recorder.start();
        setTimeout(() => {
          if (recorder.state === "recording") {
            try { recorder.stop(); } catch (_e) {}
          }
        }, 2500);
      };

      recordAndCheck();
    }).catch((err) => {
      setState((s) => ({
        ...s,
        status: "error",
        error: "Microphone access required. Please allow microphone permissions.",
      }));
    });
  }, [connect, stopWakeWordListening]);

  const startWakeWordListening = useCallback(() => {
    startWakeWordListeningInternal();
  }, [startWakeWordListeningInternal]);

  const disconnect = useCallback(() => {
    stopWakeWordListening();
    disconnectVoice();
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
