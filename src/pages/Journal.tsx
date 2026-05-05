import { useEffect, useRef, useState } from "react";
import { Trash2, Play, Pause, Sparkles, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { AudioRecorder } from "@/components/AudioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MOODS = ["radiant", "steady", "tired", "anxious", "reflective", "fired-up"] as const;
type Mood = (typeof MOODS)[number];

export interface JournalEntry {
  id: string;
  createdAt: number;
  duration: number;
  audioDataUrl?: string;
  transcript: string;
  summary: string;
  mood: Mood;
}

export default function Journal() {
  const [entries, setEntries] = useLocalStorage<JournalEntry[]>("alfred.journal", []);
  const [transcript, setTranscript] = useState("");
  const [mood, setMood] = useState<Mood>("steady");
  const [pendingAudio, setPendingAudio] = useState<string | undefined>();
  const [pendingDuration, setPendingDuration] = useState(0);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const generateSummary = (text: string): string => {
    if (!text.trim()) return "A quiet entry, sir. The silence speaks volumes.";
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 5);
    const top = sentences.slice(0, 2).join(". ").trim();
    const wordCount = text.trim().split(/\s+/).length;
    return `${top || text.slice(0, 120)}. (${wordCount} words captured.)`;
  };

  const save = () => {
    if (!transcript.trim() && !pendingAudio) {
      toast.error("Nothing to save");
      return;
    }
    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      duration: pendingDuration,
      audioDataUrl: pendingAudio,
      transcript: transcript.trim() || "[audio entry — transcript not provided]",
      summary: generateSummary(transcript),
      mood,
    };
    setEntries([entry, ...entries]);
    setTranscript("");
    setPendingAudio(undefined);
    setPendingDuration(0);
    toast.success("Journal saved", { description: "Until tomorrow, sir." });
  };

  const remove = (id: string) => setEntries(entries.filter((e) => e.id !== id));

  const togglePlay = (entry: JournalEntry) => {
    if (!entry.audioDataUrl) return;
    if (playingId === entry.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(entry.audioDataUrl);
    audio.onended = () => setPlayingId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingId(entry.id);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Reflection"
        title="Audio Journal"
        description="Speak the day. Or write it. The butler listens and transcribes."
      />

      <Card className="p-6 bg-gradient-card border-border">
        <div className="mb-5">
          <h3 className="font-display text-2xl">Tonight's Entry</h3>
          <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mt-1">
            {pendingAudio ? "Audio captured · review and save" : "Speak freely — transcript appears live"}
          </div>
        </div>

        <div className="mb-4">
          <AudioRecorder
            liveTranscript={transcript}
            onLiveTranscriptChange={setTranscript}
            onComplete={({ audioDataUrl, duration, transcript: finalTranscript }) => {
              setPendingAudio(audioDataUrl);
              setPendingDuration(duration);
              if (finalTranscript && finalTranscript.trim()) {
                setTranscript(finalTranscript);
              }
              toast.success("Recording saved", {
                description: "Edit the transcript below if you'd like.",
              });
            }}
          />
        </div>

        <Textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Your transcript will appear here as you speak. Edit freely."
          className="bg-background/50 border-border min-h-[140px] resize-none mb-4"
        />

        <div className="flex flex-wrap gap-2 mb-4">
          {MOODS.map((m) => (
            <button
              key={m}
              onClick={() => setMood(m)}
              className={`px-3 py-1 rounded-full border text-[10px] font-mono uppercase tracking-[0.2em] transition-all ${
                mood === m
                  ? "bg-gold text-primary-foreground border-gold"
                  : "bg-muted/40 text-muted-foreground border-border hover:text-gold"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <Button onClick={save} className="w-full bg-secondary text-secondary-foreground hover:opacity-90">
          Save Entry
        </Button>
      </Card>

      <div className="space-y-3">
        <h3 className="font-display text-2xl">Past Entries</h3>
        {entries.length === 0 ? (
          <p className="font-display italic text-muted-foreground text-center py-12">
            No entries yet. Tonight is a fine night to begin.
          </p>
        ) : (
          entries.map((e) => (
            <Card key={e.id} className="p-5 bg-card/60 border-border hover:border-gold/30 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30 text-[10px] font-mono uppercase tracking-[0.2em]">
                    {e.mood}
                  </span>
                </div>
                <div className="flex gap-1">
                  {e.audioDataUrl && (
                    <Button size="icon" variant="ghost" onClick={() => togglePlay(e)}>
                      {playingId === e.id ? (
                        <Pause className="h-4 w-4 text-gold" />
                      ) : (
                        <Play className="h-4 w-4 text-gold" />
                      )}
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => remove(e.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-foreground/90 mb-3 whitespace-pre-wrap">{e.transcript}</p>
              <div className="bg-background/50 rounded-md p-3 border-l-2 border-gold">
                <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-gold mb-1">
                  Summary
                </div>
                <p className="font-display italic text-sm text-foreground/80">{e.summary}</p>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
