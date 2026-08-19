import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Plus, Trash2, Check, Ban, PencilLine, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { todayKey } from "@/lib/alfred";
import { logProgress } from "@/lib/goalsHistory";
import type { Goal } from "@/lib/goals";
import {
  GOAL_TARGETS_CHANGED,
  TARGET_KIND_HINT,
  TARGET_KIND_LABEL,
  addTarget,
  goalDeltaFor,
  isAnsweredToday,
  loadTargetLog,
  loadTargets,
  removeTarget,
  setEntry,
  targetStreak,
  targetsForGoal,
  type DailyTargetKind,
  type GoalDailyTarget,
} from "@/lib/goalTargets";

/** Re-render whenever targets or their day log change, from any surface. */
function useTargetStore() {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener(GOAL_TARGETS_CHANGED, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(GOAL_TARGETS_CHANGED, cb);
      window.removeEventListener("storage", cb);
    };
  }, []);
  // Version counter: the stores are plain localStorage, so we re-read on tick.
  const version = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem("alfred.goalTargets") + "|" + localStorage.getItem("alfred.goalTargetLog"),
    () => "",
  );
  return useMemo(() => ({ targets: loadTargets(), log: loadTargetLog() }), [version]);
}

const KIND_ICON: Record<DailyTargetKind, React.ElementType> = {
  amount: Check,
  avoid: Ban,
  log: PencilLine,
};

function fmtAmount(n: number, unit?: string): string {
  if (unit === "$") return `$${n.toLocaleString()}`;
  return unit ? `${n} ${unit}` : String(n);
}

/**
 * "What today asks of you" — every active goal's daily sub-goals in one list.
 * This is the bridge between a year-sized number and something you can do
 * before bed.
 */
export function GoalDailyTargets({
  goals,
  setGoals,
}: {
  goals: Goal[];
  setGoals: (g: Goal[]) => void;
}) {
  const { targets, log } = useTargetStore();
  const today = todayKey();
  const activeGoals = useMemo(() => goals.filter((g) => !g.done), [goals]);

  const rows = useMemo(
    () =>
      activeGoals.flatMap((goal) =>
        targetsForGoal(targets, goal.id).map((target) => ({ goal, target })),
      ),
    [activeGoals, targets],
  );

  const doneCount = rows.filter(({ target }) => isAnsweredToday(target, log, today)).length;

  /** Answer a target for today, moving the parent goal when the kind earns it. */
  const answer = (goal: Goal, target: GoalDailyTarget, value?: number) => {
    const already = isAnsweredToday(target, log, today);
    if (already) {
      // Untick: roll back whatever this entry contributed.
      const prev = log[`${target.id}|${today}`];
      const delta = prev ? goalDeltaFor(target, prev) : 0;
      setEntry(target.id, null, today);
      if (delta) {
        setGoals(
          goals.map((g) =>
            g.id === goal.id
              ? { ...g, current: Math.max(0, (g.current ?? 0) - delta), localUpdatedAt: Date.now() }
              : g,
          ),
        );
      }
      return;
    }

    const entry =
      target.kind === "log"
        ? { value: value ?? 0 }
        : { done: true, value: target.kind === "amount" ? value ?? target.amount : undefined };
    setEntry(target.id, entry, today);

    const delta = goalDeltaFor(target, entry);
    if (delta) {
      setGoals(
        goals.map((g) =>
          g.id === goal.id
            ? { ...logProgress({ goal: g, delta }), localUpdatedAt: Date.now() }
            : g,
        ),
      );
    }
  };

  return (
    <Card className="p-6 bg-gradient-card border-border">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.28em] uppercase text-gold mb-1">
            <Sparkles className="h-3 w-3" /> Daily sub-goals
          </p>
          <h3 className="font-display text-2xl">What today asks of you</h3>
        </div>
        {rows.length > 0 && (
          <div className="text-right shrink-0">
            <div className="font-display text-3xl text-gold leading-none">
              {doneCount}
              <span className="text-muted-foreground/40 text-xl">/{rows.length}</span>
            </div>
            <div className="font-mono text-[8px] tracking-widest uppercase text-muted-foreground mt-1">
              answered
            </div>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground/70 mb-4">
          No daily sub-goals yet. Break a goal into something you can actually do today —
          an amount to hit, something to avoid, or a number to write down.
        </p>
      ) : (
        <ul className="space-y-2 mb-4">
          {rows.map(({ goal, target }) => (
            <TargetRow
              key={target.id}
              goal={goal}
              target={target}
              answered={isAnsweredToday(target, log, today)}
              entry={log[`${target.id}|${today}`]}
              streak={targetStreak(target, log)}
              onAnswer={(v) => answer(goal, target, v)}
              onRemove={() => removeTarget(target.id)}
            />
          ))}
        </ul>
      )}

      <AddTargetForm goals={activeGoals} />
    </Card>
  );
}

function TargetRow({
  goal,
  target,
  answered,
  entry,
  streak,
  onAnswer,
  onRemove,
}: {
  goal: Goal;
  target: GoalDailyTarget;
  answered: boolean;
  entry?: { value?: number; done?: boolean };
  streak: number;
  onAnswer: (value?: number) => void;
  onRemove: () => void;
}) {
  const Icon = KIND_ICON[target.kind];
  const unit = target.unit ?? goal.unit;
  const [draft, setDraft] = useState("");

  return (
    <li
      className={`rounded-xl border px-3 py-2.5 transition-all ${
        answered ? "bg-muted/40 border-border/40" : "bg-background/40 border-border/60"
      }`}
    >
      <div className="flex items-center gap-3">
        {target.kind === "log" && !answered ? (
          <span className="h-5 w-5 rounded-full border-2 border-gold/40 flex items-center justify-center shrink-0">
            <Icon className="h-2.5 w-2.5 text-gold/70" />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onAnswer()}
            aria-pressed={answered}
            title={answered ? "Undo today" : "Mark done for today"}
            className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all active:scale-90 ${
              answered ? "bg-gold border-gold" : "border-gold/40 hover:border-gold"
            }`}
          >
            {answered && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm ${answered ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {target.title}
            </span>
            {streak > 0 && (
              <span title={`${streak}-day streak`} className="font-mono text-[9px] text-gold/70">
                🔥 {streak}
              </span>
            )}
          </div>
          <div className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60 mt-0.5">
            {goal.title}
            {target.kind === "amount" && target.amount != null && (
              <> · {fmtAmount(target.amount, unit)}/day</>
            )}
            {target.kind === "log" && entry?.value != null && (
              <> · logged {fmtAmount(entry.value, unit)}</>
            )}
          </div>
        </div>

        {target.kind === "log" && !answered && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(draft);
              if (!draft.trim() || !isFinite(n)) return;
              onAnswer(n);
              setDraft("");
            }}
            className="flex items-center gap-1 shrink-0"
          >
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={unit === "$" ? "$" : "0"}
              aria-label={`Today's number for ${target.title}`}
              className="w-16 rounded-lg bg-background/60 border border-border px-2 py-1 text-xs text-foreground outline-none focus:border-gold/40"
            />
            <button
              type="submit"
              className="h-7 px-2 rounded-lg border border-gold/30 bg-gold/10 text-gold hover:bg-gold/25 active:scale-95 transition-all font-mono text-[10px] uppercase"
            >
              Log
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={onRemove}
          title={`Remove "${target.title}"`}
          className="shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

const KINDS: DailyTargetKind[] = ["amount", "avoid", "log"];

function AddTargetForm({ goals }: { goals: Goal[] }) {
  const [open, setOpen] = useState(false);
  const [goalId, setGoalId] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<DailyTargetKind>("amount");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!goalId && goals.length > 0) setGoalId(goals[0].id);
  }, [goals, goalId]);

  if (goals.length === 0) {
    return (
      <p className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground/50">
        Add a 2026 goal first
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-[11px] font-mono tracking-wider uppercase text-gold hover:bg-gold/20 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Add a daily sub-goal
      </button>
    );
  }

  const submit = () => {
    if (!title.trim() || !goalId) return;
    addTarget({
      goalId,
      title: title.trim(),
      kind,
      amount: kind === "amount" && amount ? Number(amount) : undefined,
    });
    setTitle("");
    setAmount("");
    setOpen(false);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2.5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoFocus
        placeholder="What does this goal ask of you today?"
        aria-label="Daily sub-goal name"
        className="w-full rounded-lg bg-background/60 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-gold/40"
      />

      <div className="flex gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-all ${
              kind === k
                ? "border-gold/50 bg-gold/20 text-gold"
                : "border-border text-muted-foreground hover:border-gold/30"
            }`}
          >
            {TARGET_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground/60 leading-snug">{TARGET_KIND_HINT[kind]}</p>

      <div className="flex gap-2">
        <select
          value={goalId}
          onChange={(e) => setGoalId(e.target.value)}
          aria-label="Which goal this feeds"
          className="flex-1 min-w-0 bg-background/60 border border-border rounded-lg px-2 py-2 text-xs font-mono uppercase tracking-wider text-foreground outline-none focus:ring-2 focus:ring-gold/40"
        >
          {goals.map((g) => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
        {kind === "amount" && (
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="per day"
            aria-label="Amount per day"
            className="w-24 rounded-lg bg-background/60 border border-border px-2 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-gold/40"
          />
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-lg border border-border/60 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          aria-label="Save daily sub-goal"
          className="flex-1 rounded-lg bg-gold text-primary-foreground py-2 text-[10px] font-mono uppercase tracking-wider font-semibold hover:bg-gold-soft active:scale-[0.98] transition-all"
        >
          Add
        </button>
      </div>
    </div>
  );
}
