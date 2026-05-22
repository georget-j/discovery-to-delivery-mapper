"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Props = {
  // Called with each transcript chunk. The consumer appends to its
  // own textarea value — this component does NOT control the textarea.
  onTranscript: (text: string) => void;
  className?: string;
  // Optional label override; defaults to the mic icon only.
  label?: string;
};

// Browser SpeechRecognition shim — Chrome / Edge / Safari expose it under
// the webkit prefix. Firefox has neither, so we fall back to Whisper via
// the server route.
type SRInstance = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string; confidence?: number }>>;
  resultIndex: number;
};

type SRCtor = new () => SRInstance;

function getNativeRecognition(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRCtor;
    webkitSpeechRecognition?: SRCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Mic button that dictates straight into a textarea. Prefers native
// SpeechRecognition (Chrome/Edge/Safari) for streaming, free transcription;
// falls back to MediaRecorder → /api/transcribe (Whisper) when the browser
// doesn't expose SpeechRecognition (Firefox).
export function VoiceInputButton({ onTranscript, className, label }: Props) {
  const [recording, setRecording] = useState(false);
  const [supportsNative, setSupportsNative] = useState<boolean | null>(null);
  const srRef = useRef<SRInstance | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setSupportsNative(!!getNativeRecognition());
  }, []);

  const stopAll = () => {
    if (srRef.current) {
      srRef.current.onend = null;
      srRef.current.onerror = null;
      srRef.current.onresult = null;
      srRef.current.abort();
      srRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  const startNative = (Ctor: SRCtor) => {
    const sr = new Ctor();
    sr.continuous = true;
    sr.interimResults = false;
    sr.lang = "en-GB";
    let lastIndex = 0;
    sr.onresult = (e) => {
      let chunk = "";
      for (let i = lastIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const first = result[0];
        if (first?.transcript) chunk += first.transcript;
      }
      lastIndex = e.results.length;
      if (chunk) onTranscript(chunk.trim() + " ");
    };
    sr.onerror = (e) => {
      const code = e.error;
      if (code === "no-speech" || code === "aborted") return;
      toast.error("Voice input failed", { description: code ?? "unknown" });
      stopAll();
    };
    sr.onend = () => {
      setRecording(false);
    };
    srRef.current = sr;
    sr.start();
    setRecording(true);
  };

  const startWhisper = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (blob.size === 0) return;
        const fd = new FormData();
        fd.append("audio", blob, "recording.webm");
        try {
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: fd,
          });
          const data = await res.json();
          if (data.error) {
            toast.error("Transcription failed", {
              description:
                typeof data.message === "string" ? data.message : data.error,
            });
            return;
          }
          if (data.text) onTranscript(data.text + " ");
        } catch (err) {
          toast.error("Transcription error", {
            description: err instanceof Error ? err.message : "Unknown",
          });
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      toast.error("Microphone access denied", {
        description: err instanceof Error ? err.message : "Permission required",
      });
    }
  };

  const start = () => {
    const Ctor = getNativeRecognition();
    if (Ctor) startNative(Ctor);
    else void startWhisper();
  };

  // Cleanup on unmount — important so a stale SpeechRecognition doesn't
  // keep the mic open after the user navigates away.
  useEffect(() => () => stopAll(), []);

  const tooltip =
    supportsNative === null
      ? undefined
      : supportsNative
        ? "Voice input (browser transcription)"
        : "Voice input (sends to Whisper)";

  return (
    <button
      type="button"
      onClick={recording ? stopAll : start}
      title={tooltip}
      aria-label={recording ? "Stop voice input" : "Start voice input"}
      aria-pressed={recording}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border transition-colors",
        recording
          ? "bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
          : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40",
        className,
      )}
    >
      {recording ? (
        <>
          <span
            className="w-2 h-2 rounded-full bg-red-500 animate-pulse"
            aria-hidden
          />
          {label ?? "Stop"}
        </>
      ) : (
        <>
          <span aria-hidden>🎤</span>
          {label ?? ""}
        </>
      )}
    </button>
  );
}
