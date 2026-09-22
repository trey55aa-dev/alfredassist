import { useState } from "react";
import { Star, Check } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { todayKey } from "@/lib/alfred";
import { getDailyHighlight, setDailyHighlight, recentHighlights } from "@/lib/dailyHighlight";

export default function DailyHighlights() {
  const today = todayKey();
  const [text, setText] = useState(() => getDailyHighlight(today));
  const [saved, setSaved] = useState(() => getDailyHighlight(today).length > 0);
  const past = recentHighlights(14, new Date(Date.now() - 86_400_000));

  const save = () => {
    setDailyHighlight(today, text);
    setSaved(text.trim().length > 0);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="One thing"
        title="Daily Highlights"
        description="Pick the one thing that would make today a win. Not a to-do list — just the thing that matters most."
      />

      <Card className="p-6 bg-gradient-card border-border">
        <div className="flex items-center gap-2 mb-3">
          <Star className="h-4 w-4 text-gold" />
          <h3 className="font-display text-xl">Today's highlight</h3>
        </div>
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSaved(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="What would make today a win, sir?"
            className="bg-background/40 border-border focus-visible:ring-gold/40 focus-visible:border-gold/40"
          />
          <Button
            onClick={save}
            disabled={saved && text.trim() === getDailyHighlight(today)}
            className="bg-gold text-primary-foreground hover:bg-gold-soft"
          >
            {saved ? <Check className="h-4 w-4" /> : "Set"}
          </Button>
        </div>
        <p className="mt-3 font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground/60">
          There's no penalty for missing it — it's a compass, not another box to check.
        </p>
      </Card>

      {past.length > 0 && (
        <div>
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-3">
            Recent highlights
          </p>
          <div className="space-y-2">
            {past.map((h) => (
              <Card
                key={h.date}
                className="p-4 bg-card/60 border-border flex items-start gap-3"
              >
                <Star className="h-3.5 w-3.5 text-gold/60 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground/90">{h.text}</p>
                  <p className="mt-1 font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground/60">
                    {new Date(h.date + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
