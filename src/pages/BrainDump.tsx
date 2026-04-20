import { useMemo, useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { todayKey } from "@/lib/alfred";

export type BrainLabel = "career" | "nil" | "body" | "money" | "life" | "skill";

export interface BrainEntry {
  id: string;
  text: string;
  label: BrainLabel;
  date: string;
  done: boolean;
  createdAt: number;
}

const LABELS: BrainLabel[] = ["career", "nil", "body", "money", "life", "skill"];

const labelStyles: Record<BrainLabel, string> = {
  career: "bg-gold/15 text-gold border-gold/30",
  nil: "bg-teal/15 text-teal border-teal/30",
  body: "bg-destructive/15 text-destructive border-destructive/30",
  money: "bg-gold-soft/15 text-gold-soft border-gold-soft/30",
  life: "bg-secondary/20 text-secondary-foreground border-secondary/30",
  skill: "bg-primary/15 text-primary border-primary/30",
};

export default function BrainDump() {
  const [entries, setEntries] = useLocalStorage<BrainEntry[]>("alfred.brain", []);
  const [text, setText] = useState("");
  const [label, setLabel] = useState<BrainLabel>("career");
  const [filter, setFilter] = useState<BrainLabel | "all">("all");

  const add = () => {
    if (!text.trim()) return;
    setEntries([
      {
        id: crypto.randomUUID(),
        text: text.trim(),
        label,
        date: todayKey(),
        done: false,
        createdAt: Date.now(),
      },
      ...entries,
    ]);
    setText("");
  };

  const toggle = (id: string) =>
    setEntries(entries.map((e) => (e.id === id ? { ...e, done: !e.done } : e)));
  const remove = (id: string) => setEntries(entries.filter((e) => e.id !== id));

  const filtered = useMemo(
    () => (filter === "all" ? entries : entries.filter((e) => e.label === filter)),
    [entries, filter]
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Capture"
        title="Brain Dump"
        description="Empty the mind. Sort it later. Every fragment counts."
      />

      <Card className="p-6 bg-gradient-card border-border">
        <Textarea
          placeholder="What's on your mind, sir?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") add();
          }}
          className="bg-background/50 border-border min-h-[100px] text-base resize-none"
        />
        <div className="mt-4 flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap gap-2">
            {LABELS.map((l) => (
              <button
                key={l}
                onClick={() => setLabel(l)}
                className={`px-3 py-1 rounded-full border text-[10px] font-mono uppercase tracking-[0.2em] transition-all ${
                  label === l
                    ? labelStyles[l]
                    : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <Button
            onClick={add}
            className="bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-gold"
          >
            <Plus className="h-4 w-4 mr-1" /> Capture
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          all ({entries.length})
        </FilterChip>
        {LABELS.map((l) => {
          const count = entries.filter((e) => e.label === l).length;
          return (
            <FilterChip key={l} active={filter === l} onClick={() => setFilter(l)}>
              {l} ({count})
            </FilterChip>
          );
        })}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="font-display italic text-muted-foreground text-center py-12">
            The slate is clean. Capture your first thought.
          </p>
        ) : (
          filtered.map((e) => (
            <Card
              key={e.id}
              className="p-4 bg-card/60 border-border hover:border-gold/30 transition-all flex items-start gap-3"
            >
              <button
                onClick={() => toggle(e.id)}
                className={`mt-0.5 h-5 w-5 rounded border flex items-center justify-center transition-all flex-shrink-0 ${
                  e.done
                    ? "bg-gold border-gold text-primary-foreground"
                    : "border-border hover:border-gold"
                }`}
              >
                {e.done && <Check className="h-3 w-3" />}
              </button>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm whitespace-pre-wrap break-words ${
                    e.done ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {e.text}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full border text-[9px] font-mono uppercase tracking-[0.2em] ${labelStyles[e.label]}`}
                  >
                    {e.label}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
              <button
                onClick={() => remove(e.id)}
                className="text-muted-foreground/60 hover:text-destructive transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-[0.2em] transition-all ${
        active
          ? "bg-gold text-primary-foreground"
          : "bg-muted/40 text-muted-foreground hover:text-gold"
      }`}
    >
      {children}
    </button>
  );
}
