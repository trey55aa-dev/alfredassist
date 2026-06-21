import { useState } from "react";
import { Check } from "lucide-react";
import { MoodSlider } from "./MoodSlider";
import {
  type CheckInType,
  labelsForValence,
  MOOD_ASSOCIATIONS,
  moodColor,
  moodEmoji,
  saveMoodEntry,
} from "@/lib/mood";

interface Props {
  type: CheckInType;
  onComplete: () => void;
}

const TYPE_LABEL: Record<CheckInType, string> = {
  morning: "Good morning — how are you feeling to start the day?",
  evening: "Good evening — how did today leave you feeling?",
  manual:  "How are you feeling right now?",
};

export function MoodCheckIn({ type, onComplete }: Props) {
  const [valence, setValence]         = useState(5);
  const [labels, setLabels]           = useState<string[]>([]);
  const [associations, setAssociations] = useState<string[]>([]);
  const [note, setNote]               = useState("");
  const [saving, setSaving]           = useState(false);

  const color = moodColor(valence);
  const availableLabels = labelsForValence(valence);

  const toggleLabel = (l: string) =>
    setLabels((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]));

  const toggleAssoc = (id: string) =>
    setAssociations((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = () => {
    setSaving(true);
    saveMoodEntry({ type, valence, labels, associations, note: note.trim() || undefined });
    setTimeout(onComplete, 300);
  };

  return (
    <div className="space-y-6">
      {/* Prompt */}
      <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground text-center">
        {TYPE_LABEL[type]}
      </p>

      {/* Slider */}
      <MoodSlider value={valence} onChange={(v) => { setValence(v); setLabels([]); }} />

      {/* Mood label chips */}
      <div>
        <p className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60 mb-2">
          What describes this feeling?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {availableLabels.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => toggleLabel(l)}
              className={`rounded-full px-3 py-1 text-xs font-mono tracking-wide transition-all duration-150 ${
                labels.includes(l)
                  ? "text-background font-semibold"
                  : "bg-white/5 border border-border/50 text-muted-foreground hover:border-white/20 hover:text-foreground"
              }`}
              style={labels.includes(l) ? { background: color, borderColor: color } : {}}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Association chips */}
      <div>
        <p className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60 mb-2">
          What's influencing this? (optional)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {MOOD_ASSOCIATIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleAssoc(a.id)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-mono transition-all duration-150 ${
                associations.includes(a.id)
                  ? "bg-gold/20 border border-gold/40 text-gold"
                  : "bg-white/4 border border-border/40 text-muted-foreground hover:border-white/20"
              }`}
            >
              {a.emoji} {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div>
        <p className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60 mb-1.5">
          Note (optional)
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What's on your mind…"
          rows={2}
          className="w-full rounded-xl bg-white/4 border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-gold/40 focus:ring-1 focus:ring-gold/20 outline-none resize-none transition-colors"
        />
      </div>

      {/* Submit */}
      <button
        onClick={submit}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-mono tracking-wider uppercase transition-all duration-200 disabled:opacity-60"
        style={{ background: color, color: "#0a0d14" }}
      >
        <Check className="h-4 w-4" />
        {saving ? "Saving…" : `Log ${moodEmoji(valence)} ${valence}/10`}
      </button>
    </div>
  );
}
