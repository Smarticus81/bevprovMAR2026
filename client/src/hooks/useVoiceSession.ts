import { useState, useRef, useCallback, useEffect } from "react";

export interface TranscriptEntry {
  role: "user" | "assistant" | "tool";
  text: string;
  timestamp: number;
  toolName?: string;
  toolResult?: any;
}

interface VoiceSessionState {
  status: "idle" | "connecting" | "connected" | "error";
  isListening: boolean;
  isSpeaking: boolean;
  transcript: TranscriptEntry[];
  latency: number | null;
  error: string | null;
}

export function useVoiceSession(agentId: number | null) {
  const [state, setState] = useState<VoiceSessionState>({
    status: "idle",
    isListening: false,
    isSpeaking: false,
    transcript: [],
    latency: null,
    error: null,
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);

  const addTranscript = useCallback((entry: TranscriptEntry) => {
    setState((s) => ({ ...s, transcript: [...s.transcript, entry] }));
  }, []);

  const connect = useCallback(async () => {
    if (!agentId) return;

    setState((s) => ({ ...s, status: "connecting", error: null, transcript: [] }));

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
            break;

          case "conversation.item.input_audio_transcription.completed":
            if (msg.transcript) {
              addTranscript({ role: "user", text: msg.transcript, timestamp: Date.now() });
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
                body: JSON.stringify({ toolName, arguments: toolArgs }),
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
  }, [agentId, addTranscript]);

  const disconnect = useCallback(() => {
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
    setState({
      status: "idle",
      isListening: false,
      isSpeaking: false,
      transcript: [],
      latency: null,
      error: null,
    });
  }, []);

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
  };
}
