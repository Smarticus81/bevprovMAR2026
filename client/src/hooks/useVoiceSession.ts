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
  const speechRecRef = useRef<any>(null);
  const wakeWordConfigRef = useRef<WakeWordConfig | undefined>(wakeWordConfig);

  useEffect(() => {
    wakeWordConfigRef.current = wakeWordConfig;
  }, [wakeWordConfig]);

  const addTranscript = useCallback((entry: TranscriptEntry) => {
    setState((s) => ({ ...s, transcript: [...s.transcript, entry] }));
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    if (speechRecRef.current) {
      try {
        speechRecRef.current.onresult = null;
        speechRecRef.current.onerror = null;
        speechRecRef.current.onend = null;
        speechRecRef.current.abort();
      } catch (_e) {}
      speechRecRef.current = null;
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

    stopSpeechRecognition();
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
                    stopSpeechRecognition();
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
  }, [agentId, addTranscript, stopSpeechRecognition, disconnectVoice]);

  const startWakeWordListeningInternal = useCallback(() => {
    stopSpeechRecognition();
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

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setState((s) => ({ ...s, status: "error", error: "Speech recognition not supported in this browser" }));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    speechRecRef.current = recognition;

    recognition.onresult = (event: any) => {
      const cfg = wakeWordConfigRef.current;
      if (!cfg) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (phraseMatchesWithLevenshtein(transcript, cfg.phrase, cfg.levenshteinThreshold)) {
          stopSpeechRecognition();
          connect();
          return;
        }
      }
    };

    let fatalError = false;

    recognition.onerror = (event: any) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        fatalError = true;
        stopSpeechRecognition();
        setState((s) => ({
          ...s,
          status: "error",
          error: "Microphone access denied. Please allow microphone permissions and ensure you're using a supported browser (Chrome or Safari).",
        }));
      } else if (event.error === "network") {
        fatalError = true;
        stopSpeechRecognition();
        setState((s) => ({
          ...s,
          status: "error",
          error: "Speech recognition requires an internet connection.",
        }));
      }
    };

    recognition.onend = () => {
      if (fatalError) return;
      if (speechRecRef.current === recognition) {
        try {
          recognition.start();
        } catch (_e) {}
      }
    };

    try {
      recognition.start();
    } catch (e: any) {
      setState((s) => ({ ...s, status: "error", error: "Failed to start speech recognition. Try using Chrome or Safari." }));
    }
  }, [connect, stopSpeechRecognition]);

  const startWakeWordListening = useCallback(() => {
    startWakeWordListeningInternal();
  }, [startWakeWordListeningInternal]);

  const disconnect = useCallback(() => {
    stopSpeechRecognition();
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
  }, [stopSpeechRecognition, disconnectVoice]);

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
