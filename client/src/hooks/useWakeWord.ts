import { useRef, useCallback, useState } from "react";

export const DEFAULT_WAKE_WORDS = ["hey bev", "okay bev"];
export const DEFAULT_STOP_PHRASES = [
  "that's all for now",
  "thats all for now",
  "goodbye",
  "good bye",
  "stop listening",
  "that's all",
  "thats all",
  "nothing else",
  "see you",
  "we are done",
  "thank you that's it",
];
export const DEFAULT_SHUTDOWN_PHRASES = [
  "shut down",
  "shut it down",
  "turn off",
  "stop listening",
  "terminate",
];

function getSR(): any {
  if (typeof window === "undefined") return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

export function isWakeWordSupported(): boolean {
  return getSR() !== null;
}

interface UseWakeWordOptions {
  wakeWords?: string[];
  stopPhrases?: string[];
  shutdownPhrases?: string[];
  confidenceThreshold?: number;
  onWakeWordDetected: () => void;
  onStopDetected: () => void;
  onShutdownDetected: () => void;
}

export function useWakeWord({
  wakeWords = DEFAULT_WAKE_WORDS,
  stopPhrases = DEFAULT_STOP_PHRASES,
  shutdownPhrases = DEFAULT_SHUTDOWN_PHRASES,
  confidenceThreshold = 0.4,
  onWakeWordDetected,
  onStopDetected,
  onShutdownDetected,
}: UseWakeWordOptions) {
  const [isListening, setIsListening] = useState(false);
  const activeRef = useRef(false);
  const recRef = useRef<any>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureFailsRef = useRef(0);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const cleanupRec = useCallback(() => {
    const r = recRef.current;
    if (!r) return;
    r.onstart = null;
    r.onresult = null;
    r.onerror = null;
    r.onend = null;
    try {
      r.stop();
    } catch {}
    recRef.current = null;
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    captureFailsRef.current = 0;
    clearRestartTimer();
    cleanupRec();
    setIsListening(false);
  }, [cleanupRec, clearRestartTimer]);

  const spawnRecRef = useRef<() => void>(() => {});

  const scheduleRetry = useCallback(
    (delayMs: number) => {
      clearRestartTimer();
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        if (activeRef.current) spawnRecRef.current();
      }, delayMs);
    },
    [clearRestartTimer],
  );

  const spawnRec = useCallback(() => {
    if (!activeRef.current) return;
    const SR = getSR();
    if (!SR) return;

    cleanupRec();

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 3;
    recRef.current = rec;

    rec.onstart = () => {
      if (!activeRef.current) return;
      captureFailsRef.current = 0;
      setIsListening(true);
    };

    rec.onresult = (event: any) => {
      if (!activeRef.current) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcripts: string[] = [];
        for (let j = 0; j < result.length; j++) {
          if (
            result[j].confidence >= confidenceThreshold ||
            result[j].confidence === 0
          ) {
            transcripts.push(result[j].transcript.toLowerCase().trim());
          }
        }
        if (transcripts.length === 0) continue;

        const combined = transcripts.join(" ");

        // Priority: shutdown > stop > wake word
        if (shutdownPhrases.some((p) => combined.includes(p))) {
          stop();
          onShutdownDetected();
          return;
        }
        if (stopPhrases.some((p) => combined.includes(p))) {
          stop();
          onStopDetected();
          return;
        }
        if (wakeWords.some((w) => combined.includes(w))) {
          stop();
          onWakeWordDetected();
          return;
        }
      }
    };

    rec.onerror = (e: any) => {
      if (!activeRef.current) return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        stop();
        return;
      }
      if (e.error === "audio-capture") {
        captureFailsRef.current += 1;
        const delay = Math.min(600 * captureFailsRef.current, 3000);
        setIsListening(false);
        if (captureFailsRef.current >= 10) {
          stop();
          return;
        }
        cleanupRec();
        scheduleRetry(delay);
        return;
      }
    };

    rec.onend = () => {
      if (!activeRef.current) return;
      setIsListening(false);
      recRef.current = null;
      scheduleRetry(250);
    };

    try {
      rec.start();
    } catch {
      recRef.current = null;
      scheduleRetry(500);
    }
  }, [
    wakeWords,
    stopPhrases,
    shutdownPhrases,
    confidenceThreshold,
    onWakeWordDetected,
    onStopDetected,
    onShutdownDetected,
    stop,
    cleanupRec,
    scheduleRetry,
  ]);

  spawnRecRef.current = spawnRec;

  const start = useCallback(() => {
    if (!getSR() || activeRef.current) return;
    activeRef.current = true;
    captureFailsRef.current = 0;
    spawnRec();
  }, [spawnRec]);

  return { isListening, startWakeWord: start, stopWakeWord: stop };
}
