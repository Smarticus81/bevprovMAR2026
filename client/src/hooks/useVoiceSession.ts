import { useState, useRef, useCallback, useEffect } from "react";

export interface TranscriptEntry {
  role: "user" | "assistant" | "tool";
  text: string;
  timestamp: number;
  toolName?: string;
  toolResult?: any;
}

type SessionMode = "realtime" | "fallback";

interface VoiceSessionState {
  status: "idle" | "connecting" | "connected" | "error";
  mode: SessionMode;
  isListening: boolean;
  isSpeaking: boolean;
  transcript: TranscriptEntry[];
  latency: number | null;
  error: string | null;
}

export function useVoiceSession(agentId: number | null) {
  const [state, setState] = useState<VoiceSessionState>({
    status: "idle",
    mode: "realtime",
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const fallbackMessagesRef = useRef<Array<{ role: string; content: string }>>([]);
  const voiceNameRef = useRef<string>("alloy");

  const addTranscript = useCallback((entry: TranscriptEntry) => {
    setState((s) => ({ ...s, transcript: [...s.transcript, entry] }));
  }, []);

  const connectRealtime = useCallback(async (session: any) => {
    const token = session.token;
    voiceNameRef.current = session.voice || "alloy";

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

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const dc = pc.createDataChannel("oai-events");
    dcRef.current = dc;

    dc.onmessage = async (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "session.created":
          setState((s) => ({ ...s, status: "connected", mode: "realtime", isListening: true }));
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
  }, [addTranscript]);

  const connectFallback = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.autoplay = true;
    }

    fallbackMessagesRef.current = [];
    setState((s) => ({
      ...s,
      status: "connected",
      mode: "fallback",
      isListening: true,
      error: null,
    }));

    addTranscript({
      role: "assistant",
      text: "Voice session active (text fallback mode). Speak and I'll respond.",
      timestamp: Date.now(),
    });
  }, [addTranscript]);

  const startFallbackRecording = useCallback(() => {
    if (!mediaStreamRef.current) return;
    recordedChunksRef.current = [];
    const mr = new MediaRecorder(mediaStreamRef.current, { mimeType: "audio/webm" });
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    mr.start();
  }, []);

  const stopFallbackRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") return;

    return new Promise<void>((resolve) => {
      const mr = mediaRecorderRef.current!;
      mr.onstop = async () => {
        const audioBlob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size < 100) { resolve(); return; }

        setState((s) => ({ ...s, isListening: false }));
        const startTime = Date.now();

        try {
          const transcribeRes = await fetch("/api/voice/transcribe", {
            method: "POST",
            headers: { "Content-Type": "audio/webm" },
            credentials: "include",
            body: audioBlob,
          });
          const { text } = await transcribeRes.json();
          if (!text || text.trim().length === 0) { setState((s) => ({ ...s, isListening: true })); resolve(); return; }

          addTranscript({ role: "user", text, timestamp: Date.now() });
          fallbackMessagesRef.current.push({ role: "user", content: text });

          const chatRes = await fetch("/api/voice/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              agentId,
              messages: fallbackMessagesRef.current,
            }),
          });
          const chatData = await chatRes.json();

          if (chatData.toolCalls) {
            for (const tc of chatData.toolCalls) {
              addTranscript({
                role: "tool",
                text: tc.result?.result?.message || JSON.stringify(tc.result?.result),
                timestamp: Date.now(),
                toolName: tc.name,
                toolResult: tc.result?.result,
              });
            }
          }

          const assistantText = chatData.content || "I'm sorry, I couldn't process that.";
          const lat = Date.now() - startTime;
          addTranscript({ role: "assistant", text: assistantText, timestamp: Date.now() });
          setState((s) => ({ ...s, latency: lat, isSpeaking: true }));
          fallbackMessagesRef.current.push({ role: "assistant", content: assistantText });

          const ttsRes = await fetch("/api/voice/synthesize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ text: assistantText, voice: voiceNameRef.current }),
          });

          if (ttsRes.ok) {
            const audioBuffer = await ttsRes.arrayBuffer();
            const audioBlob2 = new Blob([audioBuffer], { type: "audio/mpeg" });
            const url = URL.createObjectURL(audioBlob2);
            if (audioRef.current) {
              audioRef.current.src = url;
              audioRef.current.onended = () => {
                URL.revokeObjectURL(url);
                setState((s) => ({ ...s, isSpeaking: false, isListening: true }));
              };
              await audioRef.current.play();
            }
          } else {
            setState((s) => ({ ...s, isSpeaking: false, isListening: true }));
          }
        } catch (err) {
          console.error("Fallback pipeline error:", err);
          setState((s) => ({ ...s, error: "Voice processing failed", isListening: true, isSpeaking: false }));
        }
        resolve();
      };
      mr.stop();
    });
  }, [agentId, addTranscript]);

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
        if (err.fallback) {
          await connectFallback();
          return;
        }
        throw new Error(err.error || "Failed to create session");
      }

      const session = await tokenRes.json();
      const token = session.token;

      if (!token) {
        await connectFallback();
        return;
      }

      await connectRealtime(session);
    } catch (error: any) {
      console.error("Voice connection error:", error);
      try {
        await connectFallback();
      } catch (fallbackErr: any) {
        setState((s) => ({
          ...s,
          status: "error",
          error: error.message || "Connection failed",
        }));
      }
    }
  }, [agentId, connectRealtime, connectFallback]);

  const disconnect = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
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
    fallbackMessagesRef.current = [];
    setState({
      status: "idle",
      mode: "realtime",
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
    startFallbackRecording,
    stopFallbackRecording,
  };
}
