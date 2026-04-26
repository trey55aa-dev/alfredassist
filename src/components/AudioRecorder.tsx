import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, Square, Pause, Play, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AudioRecorderProps {
  onComplete: (result: {
    audioDataUrl: string;
    duration: number;
    transcript: string;
  }) => void;
  liveTranscript: string;
  onLiveTranscriptChange: (text: string) => void;
}

const CHUNK_INTERVAL_MS = 8000; // transcribe every ~8s for live feel without thrashing the API

export function AudioRecorder({
  onComplete,
  liveTranscript,
  onLiveTranscriptChange,
}: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array(32).fill(0));

  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const chunkTimerRef = useRef<number | null>(null);

  // All chunks for the final audio blob
  const allChunksRef = useRef<Blob[]>([]);
  // Chunks accumulated since last live-transcribe flush
  const liveChunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");
  const transcriptRef = useRef<string>("");

  // Keep transcriptRef in sync if user edits the textarea
  useEffect(() => {
    transcriptRef.current = liveTranscript;
  }, [liveTranscript]);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (tickRef.current) window.clearInterval(tickRef.current);
    if (chunkTimerRef.current) window.clearInterval(chunkTimerRef.current);
    rafRef.current = null;
    tickRef.current = null;
    chunkTimerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const drawLevels = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const bars = 32;
    const step = Math.floor(data.length / bars) || 1;
    const next: number[] = [];
    for (let i = 0; i < bars; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
      next.push(Math.min(1, sum / step / 180));
    }
    setLevels(next);
    rafRef.current = requestAnimationFrame(drawLevels);
  }, []);

  const transcribeChunk = useCallback(async (blob: Blob, mimeType: string) => {
    if (blob.size < 4000) return; // too small to bother
    setTranscribing(true);
    try {
      const buf = await blob.arrayBuffer();
      // Base64 encode safely in chunks
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(i, i + chunk)) as unknown as number[],
        );
      }
      const base64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke(
        "transcribe-audio",
        { body: { audio: base64, mimeType } },
      );
      if (error) throw error;
      const text = (data as { text?: string })?.text?.trim();
      if (text) {
        const merged = transcriptRef.current
          ? `${transcriptRef.current} ${text}`.replace(/\s+/g, " ").trim()
          : text;
        transcriptRef.current = merged;
        onLiveTranscriptChange(merged);
      }
    } catch (err) {
      console.error("Live transcribe failed:", err);
    } finally {
      setTranscribing(false);
    }
  }, [onLiveTranscriptChange]);

  const flushLiveChunks = useCallback(async () => {
    if (liveChunksRef.current.length === 0) return;
    const blob = new Blob(liveChunksRef.current, { type: mimeTypeRef.current });
    liveChunksRef.current = [];
    await transcribeChunk(blob, mimeTypeRef.current);
  }, [transcribeChunk]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
        },
      });
      streamRef.current = stream;

      // Visualizer
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      drawLevels();

      // Pick best supported mime
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const mimeType =
        candidates.find((m) =>
          (window as unknown as { MediaRecorder?: typeof MediaRecorder })
            .MediaRecorder?.isTypeSupported?.(m),
        ) ?? "";
      mimeTypeRef.current = mimeType || "audio/webm";

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      allChunksRef.current = [];
      liveChunksRef.current = [];
      transcriptRef.current = liveTranscript;

      mr.ondataavailable = (e) => {
        if (!e.data || e.data.size === 0) return;
        allChunksRef.current.push(e.data);
        liveChunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        // Final flush + emit complete blob
        const finalBlob = new Blob(allChunksRef.current, {
          type: mimeTypeRef.current,
        });
        const reader = new FileReader();
        reader.onloadend = () => {
          onComplete({
            audioDataUrl: reader.result as string,
            duration: elapsed,
            transcript: transcriptRef.current,
          });
        };
        reader.readAsDataURL(finalBlob);
        cleanup();
      };

      // Start recording with timeslice so chunks arrive periodically
      mr.start(2000);
      mediaRef.current = mr;
      setRecording(true);
      setPaused(false);
      setElapsed(0);

      tickRef.current = window.setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);

      chunkTimerRef.current = window.setInterval(() => {
        if (mediaRef.current?.state === "recording") {
          // Force a chunk boundary so we can transcribe what we have so far
          mediaRef.current.requestData();
          // Slight delay so the chunk lands in our buffer first
          window.setTimeout(() => {
            void flushLiveChunks();
          }, 200);
        }
      }, CHUNK_INTERVAL_MS);
    } catch (err) {
      console.error(err);
      toast.error("Microphone unavailable", {
        description: "Permissions denied. You may type a transcript instead.",
      });
    }
  };

  const togglePause = () => {
    const mr = mediaRef.current;
    if (!mr) return;
    if (mr.state === "recording") {
      mr.pause();
      setPaused(true);
      if (tickRef.current) window.clearInterval(tickRef.current);
    } else if (mr.state === "paused") {
      mr.resume();
      setPaused(false);
      tickRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    }
  };

  const stop = async () => {
    if (chunkTimerRef.current) {
      window.clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setRecording(false);
    setPaused(false);
    // Final live flush before stop
    if (mediaRef.current?.state !== "inactive") {
      mediaRef.current?.requestData();
      await new Promise((r) => setTimeout(r, 250));
      await flushLiveChunks();
    }
    mediaRef.current?.stop();
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(
      2,
      "0",
    )}`;

  return (
    <div className="space-y-4">
      {/* Waveform / status bar */}
      <div className="rounded-lg border border-border bg-background/40 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                recording && !paused
                  ? "bg-destructive animate-pulse"
                  : recording && paused
                  ? "bg-muted-foreground"
                  : "bg-muted-foreground/40"
              }`}
            />
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              {recording
                ? paused
                  ? "Paused"
                  : "Recording"
                : "Ready"}
            </span>
            {transcribing && (
              <span className="flex items-center gap-1 font-mono text-[10px] tracking-[0.2em] uppercase text-primary">
                <Sparkles className="h-3 w-3" /> transcribing…
              </span>
            )}
          </div>
          <span className="font-mono text-sm text-primary tabular-nums">
            {fmt(elapsed)}
          </span>
        </div>

        <div className="flex items-end gap-[2px] h-10">
          {levels.map((lv, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-primary/70 transition-all duration-75"
              style={{
                height: `${Math.max(6, lv * 100)}%`,
                opacity: recording && !paused ? 0.5 + lv * 0.5 : 0.25,
              }}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {!recording ? (
          <Button
            onClick={start}
            className="flex-1 bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-gold"
          >
            <Mic className="h-4 w-4 mr-2" /> Start Recording
          </Button>
        ) : (
          <>
            <Button
              onClick={togglePause}
              variant="outline"
              className="flex-1"
            >
              {paused ? (
                <>
                  <Play className="h-4 w-4 mr-2" /> Resume
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-2" /> Pause
                </>
              )}
            </Button>
            <Button onClick={stop} variant="destructive" className="flex-1">
              <Square className="h-4 w-4 mr-2" /> Stop
            </Button>
          </>
        )}
        {transcribing && !recording && (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        )}
      </div>
    </div>
  );
}
