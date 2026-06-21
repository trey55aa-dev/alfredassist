import { useState } from "react";
import { Check } from "lucide-react";
import { MoodSlider } from "./MoodSlider";
import {
  type CheckInType,
  labelsForValence,
  MOOD_ASSOCIATIONS,
  moodColor,
  moodLabel,
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

function specialPrompt(valence: number): string {
  if (valence <= 2) return "What's weighing on you?";
  if (valence <= 4) return "Anything worth noting?";
  if (valence === 5) return "What's been making you feel this way?";
  if (valence === 6) return "What made this pleasant?";
  return "What made this special? ✨";
}

export function MoodCheckIn({ type, onComplete }: Props) {
  const [valence, setValence]           = useState(4);
  const [labels, setLabels]             = useState<string[]>([]);
  const [associations, setAssociations] = useState<string[]>([]);
  const [note, setNote]                 = useState("");
  const [special, setSpecial]           = useState("");
  const [saving, setSaving]             = useState(false);

  const color          = moodColor(valence);
  const availableLabels = labelsForValence(valence);

  const toggleLabel = (l: string) =>
    setLabels((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]));

  const toggleAssoc = (id: string) =>
    setAssociations((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = () => {
    setSaving(true);
    saveMoodEntry({
      type,
      valence,
      labels,
      associations,
      note:    note.trim()    || undefined,
      special: special.trim() || undefined,
    });
    setTimeout(onComplete, 300);
  };

  return (
    <div className="space-y-5">
      {/* Prompt */}
      <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-muted-foreground/70 text-center">
        {TYPE_LABEL[type]}
      </p>

      {/* Animated face + slider */}
      <MoodSlider
        value={valence}
        onChange={(v) => { setValence(v); setLabels([]); }}
      />

      {/* Feeling descriptor chips */}
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
                  ? "font-semibold text-background"
                  : "bg-white/5 border border-border/50 text-muted-foreground hover:border-white/20 hover:text-foreground"
              }`}
              style={labels.includes(l) ? { background: color, borderColor: color } : {}}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* What made it special / weighing on you */}
      <div>
        <p className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60 mb-1.5"
           style={{ color: valence >= 5 ? color : undefined }}>
          {specialPrompt(valence)}
        </p>
        <textarea
          value={special}
          onChange={(e) => setSpecial(e.target.value)}
          placeholder={
            valence >= 5
              ? "Something small or something big — capture it…"
              : "It's okay to name it. What's going on…"
          }
          rows={2}
          className="w-full rounded-xl bg-white/4 border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/35 focus:ring-1 outline-none resize-none transition-all"
          style={{
            borderColor: `${color}40`,
            ["--tw-ring-color" as string]: `${color}30`,
          }}
        />
      </div>

      {/* Influenced by */}
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
                  ? "font-semibold"
                  : "bg-white/4 border border-border/40 text-muted-foreground hover:border-white/20"
              }`}
              style={associations.includes(a.id)
                ? { background: `${color}22`, borderColor: `${color}50`, color }
                : {}}
            >
              {a.emoji} {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Optional extra note */}
      <div>
        <p className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60 mb-1.5">
          Additional note (optional)
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything else on your mind…"
          rows={2}
          className="w-full rounded-xl bg-white/4 border border-border/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/35 focus:border-gold/40 focus:ring-1 focus:ring-gold/20 outline-none resize-none transition-colors"
        />
      </div>

      {/* Submit */}
      <button
        onClick={submit}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-mono tracking-wider uppercase font-semibold transition-all duration-200 disabled:opacity-60 active:scale-[0.98]"
        style={{ background: color, color: "#0a0d14" }}
      >
        <Check className="h-4 w-4" />
        {saving ? "Saving…" : `Log — ${moodLabel(valence)}`}
      </button>
    </div>
  );
}
