import { useState, useEffect } from "react";
import { Plus, Smile, TrendingUp, Apple } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { MoodCheckIn } from "@/components/MoodCheckIn";
import {
  type MoodEntry,
  loadMoods,
  dailyAverage,
  moodColor,
  moodEmoji,
  MOOD_CHANGED,
} from "@/lib/mood";
import { todayKey as dk } from "@/lib/alfred";

/* ─── Helpers ──────────────────────────────────────────── */

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function last14Days(): string[] {
  const days: string[] = [];
  const d = new Date();
  for (let i = 13; i >= 0; i--) {
    const day = new Date(d);
    day.setDate(d.getDate() - i);
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, "0");
    const dd = String(day.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${dd}`);
  }
  return days;
}

/* ─── Spark bar chart ──────────────────────────────────── */

function MoodChart({ entries }: { entries: MoodEntry[] }) {
  const days = last14Days();
  return (
    <div>
      <div className="flex items-end gap-1 h-16">
        {days.map((date) => {
          const avg = dailyAverage(entries, date);
          const today = date === dk();
          return (
            <div key={date} className="flex-1 flex flex-col items-center gap-0.5">
              {avg !== null ? (
                <div
                  className="w-full rounded-t-sm transition-all duration-300"
                  style={{
                    height: `${((avg - 1) / 9) * 100}%`,
                    minHeight: 4,
                    background: moodColor(avg),
                    opacity: today ? 1 : 0.7,
                  }}
                  title={`${date}: ${avg}/10`}
                />
              ) : (
                <div className="w-full rounded-t-sm bg-white/5" style={{ height: "8px" }} />
              )}
            </div>
          );
        })}
      </div>
      {/* Day labels — show Mon/today only */}
      <div className="flex gap-1 mt-1">
        {days.map((date, i) => {
          const isToday = date === dk();
          const dow = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
          return (
            <div
              key={date}
              className={`flex-1 text-center font-mono text-[7px] ${
                isToday ? "text-gold" : i % 7 === 0 ? "text-muted-foreground/50" : "text-transparent"
              }`}
            >
              {isToday ? "TOD" : dow}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Single entry row ─────────────────────────────────── */

function EntryRow({ entry }: { entry: MoodEntry }) {
  const color = moodColor(entry.valence);
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/30 last:border-0">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 border-2"
        style={{ borderColor: color, background: `${color}18` }}
      >
        {moodEmoji(entry.valence)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-display text-base" style={{ color }}>
            {entry.valence}/10
          </span>
          <span className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground">
            {entry.type} · {formatTime(entry.timestamp)}
          </span>
        </div>
        {entry.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {entry.labels.map((l) => (
              <span
                key={l}
                className="rounded-full px-2 py-0.5 text-[9px] font-mono"
                style={{ background: `${color}22`, color }}
              >
                {l}
              </span>
            ))}
          </div>
        )}
        {entry.associations.length > 0 && (
          <p className="font-mono text-[9px] text-muted-foreground/60 mt-1">
            {entry.associations.join(" · ")}
          </p>
        )}
        {entry.note && (
          <p className="text-sm text-muted-foreground/80 mt-1 italic">"{entry.note}"</p>
        )}
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────── */

export default function Mood() {
  const [entries, setEntries] = useState<MoodEntry[]>(() => loadMoods());
  const [checkInOpen, setCheckInOpen] = useState(false);

  useEffect(() => {
    const refresh = () => setEntries(loadMoods());
    window.addEventListener(MOOD_CHANGED, refresh);
    return () => window.removeEventListener(MOOD_CHANGED, refresh);
  }, []);

  const today = dk();
  const todayEntries = entries.filter((e) => e.date === today).sort((a, b) => b.timestamp - a.timestamp);
  const todayAvg = dailyAverage(entries, today);
  const allDates = [...new Set(entries.map((e) => e.date))].sort((a, b) => (b > a ? 1 : -1));

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Mood"
        subtitle="Daily emotional check-ins"
        action={
          <button
            onClick={() => setCheckInOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-gold/10 px-3 py-1.5 text-[11px] font-mono tracking-wider uppercase text-gold hover:bg-gold/20 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Log now
          </button>
        }
      />

      {/* Today summary tile */}
      {todayAvg !== null ? (
        <div
          className="rounded-2xl p-5 border"
          style={{
            borderColor: `${moodColor(todayAvg)}40`,
            background: `${moodColor(todayAvg)}12`,
          }}
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl">{moodEmoji(todayAvg)}</div>
            <div>
              <div className="font-display text-3xl" style={{ color: moodColor(todayAvg) }}>
                {todayAvg}/10
              </div>
              <div className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">
                Today's average · {todayEntries.length} check-in{todayEntries.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCheckInOpen(true)}
          className="w-full rounded-2xl border border-dashed border-border/50 p-6 flex flex-col items-center gap-2 hover:border-gold/30 hover:bg-gold/5 transition-colors"
        >
          <Smile className="h-8 w-8 text-muted-foreground/40" />
          <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
            No check-in yet today
          </span>
          <span className="font-mono text-[9px] text-muted-foreground/50">Tap to log how you're feeling</span>
        </button>
      )}

      {/* 14-day chart */}
      {entries.length > 0 && (
        <div className="rounded-2xl border border-border/40 bg-white/3 p-4 space-y-2">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">
              14-day mood
            </span>
          </div>
          <MoodChart entries={entries} />
        </div>
      )}

      {/* Apple Health note */}
      <div className="rounded-xl border border-border/30 bg-white/2 p-4 flex gap-3">
        <Apple className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
        <div>
          <p className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60">
            Apple Health — State of Mind
          </p>
          <p className="text-xs text-muted-foreground/50 mt-1">
            Full two-way sync (HKStateOfMind) requires the native iOS build.
            Sleep and HRV data from Health already inform Alfred's context on the Health page.
          </p>
        </div>
      </div>

      {/* Today's entries */}
      {todayEntries.length > 0 && (
        <div>
          <p className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground mb-3">Today</p>
          <div className="rounded-2xl border border-border/40 bg-white/3 px-4 divide-y divide-border/20">
            {todayEntries.map((e) => <EntryRow key={e.id} entry={e} />)}
          </div>
        </div>
      )}

      {/* Past entries grouped by date */}
      {allDates.filter((d) => d !== today).slice(0, 7).map((date) => {
        const dayEntries = entries.filter((e) => e.date === date).sort((a, b) => b.timestamp - a.timestamp);
        const avg = dailyAverage(entries, date);
        const label = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
          weekday: "long", month: "short", day: "numeric",
        });
        return (
          <div key={date}>
            <div className="flex items-center gap-2 mb-2">
              <p className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">{label}</p>
              {avg !== null && (
                <span className="font-mono text-[9px]" style={{ color: moodColor(avg) }}>
                  {moodEmoji(avg)} {avg}/10
                </span>
              )}
            </div>
            <div className="rounded-2xl border border-border/40 bg-white/3 px-4 divide-y divide-border/20">
              {dayEntries.map((e) => <EntryRow key={e.id} entry={e} />)}
            </div>
          </div>
        );
      })}

      {/* Check-in dialog */}
      <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
        <DialogContent className="max-w-md bg-background/95 border-border/60 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Mood Check-In</DialogTitle>
          </DialogHeader>
          <MoodCheckIn type="manual" onComplete={() => setCheckInOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
