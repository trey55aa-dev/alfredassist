import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarDays,
  BarChart3,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Trophy,
  Trash2,
  Clock,
  Check,
  X,
  Target as TargetIcon,
} from "lucide-react";
import { todayKey } from "@/lib/alfred";
import {
  type Habit,
  type HabitLog,
  CADENCES,
  CADENCE_LABEL,
  CADENCE_NOUN,
  getHabitNote,
  setHabitNote,
  loadHabitTimes,
} from "@/lib/habits";
import { stepsFromText, stepsOf, stepsToText } from "@/lib/habitSteps";
import type { Goal } from "@/lib/goals";
import {
  monthCells,
  computeHabitStats,
  yearHeatmap,
  WEEKDAY_SHORT,
  WEEKDAY_FULL,
  formatHour,
  type DayCell,
} from "@/lib/habitStats";

type Tab = "calendar" | "stats" | "settings";

interface Props {
  habit: Habit | null;
  open: boolean;
  onClose: () => void;
  logs: HabitLog[];
  goals: Goal[];
  onUpdate: (id: string, patch: Partial<Habit>) => void;
  onDelete: (id: string) => void;
  /** Toggle a habit's completion on a specific day (backfill / correct history). */
  onToggleDate: (habit: Habit, dateYmd: string) => void;
}

export function HabitDetailSheet({ habit, open, onClose, logs, goals, onUpdate, onDelete, onToggleDate }: Props) {
  const [tab, setTab] = useState<Tab>("calendar");
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });

  // reset to calendar + current month whenever a different habit opens
  useEffect(() => {
    if (open) {
      setTab("calendar");
      setView({ year: now.getFullYear(), month: now.getMonth() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habit?.id, open]);

  if (!habit) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md bg-background/95 border-border/60 backdrop-blur-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl pr-6 leading-tight">{habit.title}</DialogTitle>
        </DialogHeader>

        {/* Segmented control */}
        <div className="flex gap-1 rounded-xl bg-muted/40 p-1">
          {([
            ["calendar", "Calendar", CalendarDays],
            ["stats", "Stats", BarChart3],
            ["settings", "Settings", Settings2],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-mono tracking-wider uppercase transition-colors ${
                tab === id ? "bg-gold text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="min-w-0 pt-2">
          {tab === "calendar" && (
            <CalendarTab habit={habit} logs={logs} view={view} setView={setView} onToggleDate={onToggleDate} />
          )}
          {tab === "stats" && <StatsTab habit={habit} logs={logs} />}
          {tab === "settings" && (
            <SettingsTab habit={habit} goals={goals} onUpdate={onUpdate} onDelete={(id) => { onDelete(id); onClose(); }} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Calendar tab — circle month grid ─────────────────── */

function CalendarTab({
  habit,
  logs,
  view,
  setView,
  onToggleDate,
}: {
  habit: Habit;
  logs: HabitLog[];
  view: { year: number; month: number };
  setView: (v: { year: number; month: number }) => void;
  onToggleDate: (habit: Habit, dateYmd: string) => void;
}) {
  const times = useMemo(() => loadHabitTimes(), [habit.id, view.year, view.month]);
  const cells = useMemo(
    () => monthCells(habit, logs, times, view.year, view.month),
    [habit, logs, times, view.year, view.month],
  );

  // Which day is open in the editor below the grid (Streaks-style tap-to-inspect).
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  useEffect(() => {
    setSelectedYmd(null);
  }, [habit.id, view.year, view.month]);
  const selectedCell = selectedYmd ? cells.find((c) => c.ymd === selectedYmd) ?? null : null;

  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const step = (delta: number) => {
    let m = view.month + delta;
    let y = view.year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setView({ year: y, month: m });
  };

  const isCurrentMonth = view.year === new Date().getFullYear() && view.month === new Date().getMonth();

  return (
    <div className="space-y-3">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => step(-1)} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-display text-lg">{monthLabel}</span>
        <button
          onClick={() => step(1)}
          disabled={isCurrentMonth}
          className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-25 disabled:pointer-events-none"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center font-mono text-[9px] tracking-wider uppercase text-muted-foreground/50">
            {d}
          </div>
        ))}
      </div>

      {/* Day circles — tap any day up to today to inspect / edit it */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c, i) => (
          <DayCircle
            key={i}
            cell={c}
            selected={c.ymd === selectedYmd}
            onSelect={c.state === "future" ? undefined : () => setSelectedYmd(c.ymd)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 pt-1 font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-gradient-gold inline-block" /> Done
        </span>
        {habit.cadence === "daily" && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-coral/50 inline-block" /> Missed
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2 border-gold/60 inline-block" /> Today
        </span>
      </div>

      {/* Selected-day inspector / editor */}
      <DayDetail
        cell={selectedCell}
        onToggle={() => selectedCell && onToggleDate(habit, selectedCell.ymd)}
      />
    </div>
  );
}

function DayCircle({
  cell,
  selected,
  onSelect,
}: {
  cell: DayCell;
  selected: boolean;
  onSelect?: () => void;
}) {
  const n = cell.date.getDate();
  const base = "aspect-square rounded-full flex items-center justify-center font-mono text-[10px] transition-all";
  const dim = cell.inMonth ? "" : "opacity-30";

  let cls = "";
  const content: React.ReactNode = n;
  switch (cell.state) {
    case "done":
      cls = "bg-gradient-gold text-primary-foreground shadow-gold font-semibold";
      break;
    case "missed":
      cls = "border-2 border-coral/40 text-coral/70";
      break;
    case "today":
      cls = "border-2 border-gold/60 text-gold font-semibold";
      break;
    case "pending":
      // yesterday, still uncounted but within grace — inviting, not alarming
      cls = "border border-dashed border-gold/35 text-muted-foreground/70";
      break;
    case "future":
      cls = "text-muted-foreground/25";
      break;
    case "pre":
    case "none":
    default:
      cls = "text-muted-foreground/40 bg-muted/15";
      break;
  }

  const ring = selected ? " ring-2 ring-gold ring-offset-2 ring-offset-background" : "";
  const interactive = onSelect ? " cursor-pointer hover:scale-110 active:scale-95" : " cursor-default";

  const title =
    cell.ymd +
    (cell.state === "done"
      ? " · done"
      : cell.state === "missed"
        ? " · missed"
        : cell.state === "pending"
          ? " · not counted yet"
          : "") +
    (cell.hour != null ? ` · logged ${formatHour(cell.hour)}` : "") +
    (onSelect ? " · tap to edit" : "");

  return (
    <button
      type="button"
      disabled={!onSelect}
      onClick={onSelect}
      aria-pressed={cell.state === "done"}
      className={`${base} ${cls} ${dim}${ring}${interactive}`}
      title={title}
    >
      {content}
    </button>
  );
}

/* ─── Selected-day inspector + editor ───────────────────── */

function DayDetail({ cell, onToggle }: { cell: DayCell | null; onToggle: () => void }) {
  if (!cell) {
    return (
      <p className="text-center font-mono text-[10px] tracking-wider uppercase text-muted-foreground/45 pt-1">
        Tap any day to view or edit it
      </p>
    );
  }

  const done = cell.state === "done";
  const isToday = cell.ymd === todayKey();
  const dateLabel = cell.date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const stateLabel = done
    ? "Completed"
    : isToday
      ? "Not done yet today"
      : cell.state === "pending"
        ? "Not counted yet"
        : cell.state === "missed"
          ? "Missed"
          : "Not tracked";

  return (
    <div className="rounded-xl border border-border/60 bg-white/3 p-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="min-w-0">
        <div className="font-display text-base leading-tight">{dateLabel}</div>
        <div className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground/70 mt-0.5">
          {stateLabel}
          {cell.hour != null && <span className="text-gold/70"> · logged {formatHour(cell.hour)}</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-mono text-[10px] tracking-wider uppercase transition-all active:scale-95 ${
          done
            ? "border border-coral/40 text-coral/80 hover:bg-coral/10"
            : "bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
        }`}
      >
        {done ? <><X className="h-3.5 w-3.5" /> Undo</> : <><Check className="h-3.5 w-3.5" /> Mark done</>}
      </button>
    </div>
  );
}

/* ─── Stats tab ────────────────────────────────────────── */

function StatsTab({ habit, logs }: { habit: Habit; logs: HabitLog[] }) {
  const times = useMemo(() => loadHabitTimes(), [habit.id]);
  const s = useMemo(() => computeHabitStats(habit, logs, times), [habit, logs, times]);
  const daily = habit.cadence === "daily";
  const noun = CADENCE_NOUN[habit.cadence];

  return (
    <div className="space-y-4">
      {/* Headline streaks */}
      <div className="grid grid-cols-2 gap-3">
        <BigStat icon={Flame} color="text-gold" label="Current streak" value={s.current} suffix={noun + (s.current === 1 ? "" : "s")} />
        <BigStat icon={Trophy} color="text-teal" label="Best streak" value={s.longest} suffix={noun + (s.longest === 1 ? "" : "s")} />
      </div>

      {/* Rolling windows */}
      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="Last 7 days" value={`${s.last7Done}/7`} sub={`${s.last7Pct}%`} />
        <MiniStat label="Last 30 days" value={`${s.last30Done}/30`} sub={`${s.last30Pct}%`} />
      </div>

      {/* 365-day activity — how many times, like the Streaks app */}
      <YearHeatmap habit={habit} logs={logs} />

      {/* Advanced */}
      <div className="rounded-xl border border-border/50 bg-white/3 p-4 space-y-4">
        <p className="font-mono text-[9px] tracking-[0.28em] uppercase text-muted-foreground/70">
          Advanced stats
        </p>

        {daily ? (
          <>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Cell label="This year" value={`${s.yearPct}%`} hint={`${s.yearDone}/${s.yearElapsed}d`} />
              <Cell label="Total misses" value={s.totalMisses} />
              <Cell label="Completed" value={s.totalCompleted} />
            </div>

            {/* Misses by weekday */}
            <div>
              <p className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60 mb-2">
                Misses by weekday
              </p>
              <WeekdayBars data={s.missesByWeekday} worst={s.worstWeekday} />
              {s.worstWeekday != null && s.totalMisses > 0 && (
                <p className="text-xs text-muted-foreground/70 mt-2">
                  You miss most on <span className="text-coral">{WEEKDAY_FULL[s.worstWeekday]}</span>.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-center">
            <Cell label="Completed" value={s.totalCompleted} />
            <Cell label={`Last 30 ${noun}s`} value={`${s.last30Pct}%`} />
          </div>
        )}

        {/* Completion hour */}
        <div>
          <p className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60 mb-2 flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> When you check in
          </p>
          {s.timedCount > 0 ? (
            <>
              <HourHistogram hist={s.hourHist} peak={s.peakHour} />
              {s.peakHour != null && (
                <p className="text-xs text-muted-foreground/70 mt-2">
                  Usually around <span className="text-gold">{formatHour(s.peakHour)}</span>
                  <span className="text-muted-foreground/40"> · {s.timedCount} timed</span>
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground/50 italic">
              Hour data builds up as you tick this habit going forward.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function YearHeatmap({ habit, logs }: { habit: Habit; logs: HabitLog[] }) {
  const data = useMemo(() => yearHeatmap(habit, logs), [habit, logs]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Land scrolled to today (right edge) so the most recent activity is visible first.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [data]);

  return (
    <div className="min-w-0 rounded-xl border border-border/50 bg-white/3 p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[9px] tracking-[0.28em] uppercase text-muted-foreground/70">
          Past 365 days
        </p>
        <span className="font-display text-xl text-gold leading-none">
          {data.totalDone}
          <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground/60 ml-1.5">
            times
          </span>
        </span>
      </div>

      <div ref={scrollRef} className="w-full min-w-0 overflow-x-auto -mx-1 px-1">
        <div className="flex gap-[3px] w-max">
          {data.weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((cell, di) => (
                <div
                  key={di}
                  title={`${cell.ymd}${cell.done ? " · done" : ""}`}
                  className={`h-[10px] w-[10px] rounded-[2px] ${
                    cell.done
                      ? "bg-gradient-gold"
                      : cell.inRange
                        ? "bg-muted/40"
                        : "bg-white/5"
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 font-mono text-[9px] tracking-wider uppercase text-muted-foreground/50">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-gradient-gold inline-block" /> Done
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-muted/40 inline-block" /> Not done
        </span>
      </div>
    </div>
  );
}

function BigStat({ icon: Icon, color, label, value, suffix }: {
  icon: React.ElementType; color: string; label: string; value: number; suffix: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-white/3 p-4">
      <Icon className={`h-4 w-4 ${color} mb-2`} />
      <div className="font-display text-4xl leading-none">{value}</div>
      <div className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60 mt-1">
        {label} · {suffix}
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-white/3 p-3 flex items-baseline justify-between">
      <div>
        <div className="font-display text-2xl leading-none">{value}</div>
        <div className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground/60 mt-1">{label}</div>
      </div>
      <span className="font-mono text-xs text-gold">{sub}</span>
    </div>
  );
}

function Cell({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div>
      <div className="font-display text-2xl text-foreground leading-none">{value}</div>
      <div className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground/60 mt-1">{label}</div>
      {hint && <div className="font-mono text-[8px] text-muted-foreground/40">{hint}</div>}
    </div>
  );
}

function WeekdayBars({ data, worst }: { data: number[]; worst: number | null }) {
  const max = Math.max(1, ...data);
  return (
    <div className="flex items-end gap-1.5 h-16">
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex items-end h-12">
            <div
              className={`w-full rounded-t-sm transition-all ${i === worst ? "bg-coral/70" : "bg-gold/40"}`}
              style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 3 : 0 }}
              title={`${WEEKDAY_SHORT[i]}: ${v} miss${v === 1 ? "" : "es"}`}
            />
          </div>
          <span className="font-mono text-[8px] text-muted-foreground/50">{WEEKDAY_SHORT[i][0]}</span>
        </div>
      ))}
    </div>
  );
}

function HourHistogram({ hist, peak }: { hist: number[]; peak: number | null }) {
  const max = Math.max(1, ...hist);
  return (
    <div className="flex items-end gap-px h-12">
      {hist.map((v, h) => (
        <div
          key={h}
          className={`flex-1 rounded-t-sm transition-all ${h === peak ? "bg-gold" : "bg-gold/25"}`}
          style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 2 : 0 }}
          title={`${formatHour(h)}: ${v}`}
        />
      ))}
    </div>
  );
}

/* ─── Settings tab ─────────────────────────────────────── */

function SettingsTab({
  habit,
  goals,
  onUpdate,
  onDelete,
}: {
  habit: Habit;
  goals: Goal[];
  onUpdate: (id: string, patch: Partial<Habit>) => void;
  onDelete: (id: string) => void;
}) {
  const [note, setNote] = useState(() => getHabitNote(habit.id));
  const linkedGoal = goals.find((g) => g.id === habit.goalId);

  // persist note (device-local) on change
  useEffect(() => {
    setHabitNote(habit.id, note);
  }, [habit.id, note]);

  return (
    <div className="space-y-4">
      {/* Comments — grounds Alfred */}
      <div>
        <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground flex items-center gap-1.5">
          Comments
          <span className="text-gold/60 normal-case tracking-normal">· Alfred reads these to coach you</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Why this habit matters, what trips you up, how you want to change it…"
          className="mt-1.5 w-full rounded-xl bg-background/40 border border-border/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-gold/40 focus:ring-1 focus:ring-gold/20 outline-none resize-none transition-colors"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <SelectField
          label="Cadence"
          value={habit.cadence}
          onChange={(v) => onUpdate(habit.id, { cadence: v as Habit["cadence"] })}
          options={CADENCES as unknown as string[]}
          render={(v) => CADENCE_LABEL[v as Habit["cadence"]]}
        />
        <SelectField
          label="Linked goal"
          value={habit.goalId ?? ""}
          onChange={(v) => onUpdate(habit.id, { goalId: v || undefined })}
          options={["", ...goals.map((g) => g.id)]}
          render={(v) => (v === "" ? "None" : goals.find((g) => g.id === v)?.title ?? "—")}
        />
      </div>

      {linkedGoal && (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gold/10 border border-gold/30 text-gold font-mono text-[10px] uppercase tracking-wider">
          <TargetIcon className="h-3 w-3" /> Feeds: {linkedGoal.title}
        </div>
      )}

      <div>
        <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          Routine steps (one per line)
        </label>
        <textarea
          value={stepsToText(stepsOf(habit))}
          onChange={(e) =>
            onUpdate(habit.id, {
              steps: stepsFromText(e.target.value, stepsOf(habit)),
            })
          }
          rows={4}
          placeholder={"brush teeth\nwater\nfloss\nscrape tongue"}
          className="mt-1.5 w-full rounded-xl bg-background/40 border border-border/60 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-gold/40 focus:ring-1 focus:ring-gold/20 outline-none resize-none transition-colors"
        />
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          Turns this into a routine. Tick the last step and the habit completes
          itself — or tick the habit to fill the whole list in.
        </p>
      </div>

      <div>
        <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          Recovery steps (one per line)
        </label>
        <textarea
          value={(habit.recoverySteps ?? []).join("\n")}
          onChange={(e) =>
            onUpdate(habit.id, {
              recoverySteps: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
            })
          }
          rows={3}
          placeholder="Leave blank to use Alfred's defaults…"
          className="mt-1.5 w-full rounded-xl bg-background/40 border border-border/60 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-gold/40 focus:ring-1 focus:ring-gold/20 outline-none resize-none transition-colors"
        />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/40">
        <button
          onClick={() => onUpdate(habit.id, { archived: true })}
          className="text-[10px] tracking-[0.2em] uppercase font-mono text-muted-foreground hover:text-gold transition-colors"
        >
          Archive
        </button>
        <button
          onClick={() => {
            if (confirm(`Delete "${habit.title}" and all its history?`)) onDelete(habit.id);
          }}
          className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase font-mono text-muted-foreground/70 hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}

function SelectField({
  label, value, onChange, options, render,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; render: (v: string) => string;
}) {
  return (
    <div>
      <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full bg-background/40 border border-border/60 rounded-lg px-2 py-2 text-xs font-mono uppercase tracking-wider text-foreground focus:outline-none focus:ring-2 focus:ring-gold/40"
      >
        {options.map((o) => (
          <option key={o} value={o}>{render(o)}</option>
        ))}
      </select>
    </div>
  );
}
