import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  RotateCcw,
  Target,
  CalendarIcon,
  Sparkles,
  Dumbbell,
  Briefcase,
  Wallet,
  BookOpen,
  Heart,
  Brain,
  Wand2,
  Loader2,
  List,
  GanttChartSquare,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { awardXp, progressXp, XP_VALUES } from "@/lib/gamification";
import { useCloudGoals } from "@/hooks/useCloudGoals";
import { Cloud, CloudOff, Minus, History } from "lucide-react";
import {
  computeProjection,
  last14Days,
  lastNWeeks,
  logProgress,
} from "@/lib/goalsHistory";
import {
  isSuggestionAdded,
  markSuggestionAdded,
  suggestNext,
} from "@/lib/goalsSuggest";
import {
  addLocalEvent,
} from "@/lib/agendaStore";
import {
  createGoogleEvent,
  isGoogleConnected,
} from "@/lib/googleCalendar";
import type { AgendaEvent } from "@/lib/agenda";
import { BackupRestore } from "@/components/BackupRestore";
import { GoalAnalyticsPanel } from "@/components/GoalAnalyticsPanel";
import {
  CATEGORIES,
  GOALS_KEY,
  Goal,
  GoalCategory,
  GoalQuarter,
  GoalSubStep,
  GoalTimeframe,
  FinancialType,
  PACE_META,
  QUARTERS,
  QUARTER_RANGES,
  SEED_GOALS,
  SubStepStatus,
  TIMEFRAMES,
  appendStatusEvent,
  collectTags,
  daysUntil,
  paceStatus,
  progressPct,
} from "@/lib/goals";
import { deadlineQuarterLabel, computeStreakStats } from "@/lib/goalsAnalytics";
import { buildSchedule, STATUS_META } from "@/lib/planSchedule";
import type { BrainEntry } from "./BrainDump";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<GoalCategory, { icon: typeof Dumbbell; tint: string }> = {
  Body: { icon: Dumbbell, tint: "text-teal" },
  Career: { icon: Briefcase, tint: "text-gold" },
  Money: { icon: Wallet, tint: "text-gold" },
  Skills: { icon: BookOpen, tint: "text-teal" },
  Life: { icon: Heart, tint: "text-gold" },
};

const TIMEFRAME_LABEL: Record<GoalTimeframe, string> = {
  daily: "Daily",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

export default function Goals2026() {
  const {
    goals,
    setGoals,
    loadStarterTemplate,
    loading: cloudLoading,
    syncing,
    error: cloudError,
    signedIn,
  } = useCloudGoals();
  const [brain] = useLocalStorage<BrainEntry[]>("alfred.brain", []);
  const [view, setView] = useState<"all" | "quarters" | "timeframe">("all");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  // Migrate older goals missing new fields
  const safeGoals = useMemo(
    () =>
      goals.map((g) => ({
        timeframe: "annual" as GoalTimeframe,
        quarter: null as GoalQuarter,
        createdAt: 0,
        ...g,
      })),
    [goals]
  );

  const allTags = useMemo(() => collectTags(safeGoals), [safeGoals]);
  const filteredGoals = useMemo(() => {
    if (activeTags.length === 0) return safeGoals;
    return safeGoals.filter((g) => {
      const goalTags = new Set(g.tags ?? []);
      const subTags = (g.subSteps ?? []).flatMap((s) => s.tags ?? []);
      const all = new Set([...goalTags, ...subTags]);
      return activeTags.every((t) => all.has(t));
    });
  }, [safeGoals, activeTags]);

  const totalDone = filteredGoals.filter((g) => g.done).length;
  const overallPct = filteredGoals.length
    ? Math.round((totalDone / filteredGoals.length) * 100)
    : 0;

  const update = (id: string, patch: Partial<Goal>) =>
    setGoals(safeGoals.map((g) =>
      g.id === id ? { ...g, ...patch, localUpdatedAt: Date.now() } : g,
    ));
  const toggle = (id: string) => {
    const goal = safeGoals.find((g) => g.id === id);
    if (!goal) return;
    const wasDone = goal.done;
    update(id, { done: !wasDone });
    if (!wasDone) awardXp(XP_VALUES.GOAL_DONE, "goal");
  };
  const remove = (id: string) => setGoals(safeGoals.filter((g) => g.id !== id));

  const addGoal = (g: Omit<Goal, "id" | "createdAt">) => {
    const now = Date.now();
    setGoals([
      ...safeGoals,
      { ...g, id: crypto.randomUUID(), createdAt: now, localUpdatedAt: now },
    ]);
  };

  /* ── Debug: read directly from localStorage to show ground truth ── */
  const _lsRaw = typeof window !== "undefined" ? localStorage.getItem("alfred.goals2026") : null;
  const _lsGoals: Goal[] = _lsRaw ? (() => { try { return JSON.parse(_lsRaw); } catch { return []; } })() : [];
  const _lsDone = _lsGoals.filter((g) => g.done).length;

  return (
    <div className="space-y-8">
      {/* ── TEMPORARY DEBUG BANNER — remove once bug is confirmed fixed ── */}
      <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 font-mono text-[11px] text-yellow-300 space-y-1">
        <div className="font-bold text-yellow-400">🔍 Save Debug (remove after fix)</div>
        <div>React state: <b>{goals.length}</b> goals, <b>{goals.filter(g=>g.done).length}</b> done</div>
        <div>localStorage: <b>{_lsGoals.length}</b> goals, <b>{_lsDone}</b> done</div>
        <div>Signed in: <b>{signedIn ? "yes" : "NO — cloud sync disabled"}</b></div>
        <div>Syncing: <b>{syncing ? "yes" : "no"}</b></div>
        {cloudError && <div className="text-red-400">⚠️ Sync error: {cloudError}</div>}
        <div className="text-yellow-200/60 text-[10px]">After checking a goal: localStorage done count should go up immediately. After refresh: React state should match localStorage.</div>
      </div>

      <PageHeader
        eyebrow="The year ahead"
        title="2026 Goals"
        description="Define the campaign. Set deadlines. Conquer by quarter."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SyncIndicator
              signedIn={signedIn}
              loading={cloudLoading}
              syncing={syncing}
              error={cloudError}
            />
            <BackupRestore />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (
                  confirm(
                    "Clear all goals? This removes every goal on your account. You can re-add or load the template afterwards.",
                  )
                )
                  setGoals([]);
              }}
              className="border-border text-muted-foreground hover:text-gold"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Clear all
            </Button>
          </div>
        }
      />

      {/* Overall */}
      <Card className="p-6 bg-gradient-card border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display text-2xl">Campaign Progress</h3>
            <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-muted-foreground mt-1">
              {totalDone} of {filteredGoals.length} conquered{activeTags.length > 0 ? " (filtered)" : ""}
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-5xl text-gold leading-none">{overallPct}%</div>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mt-1">
              complete
            </div>
          </div>
        </div>
        <Progress value={overallPct} className="h-2" />
      </Card>

      {/* Add new goal */}
      <AddGoalForm onAdd={addGoal} />

      {/* First-run welcome — only when signed in, finished loading, and truly empty */}
      {signedIn && !cloudLoading && goals.length === 0 && (
        <OnboardingEmptyState onLoadTemplate={loadStarterTemplate} />
      )}

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="rounded-md border border-border/60 bg-background/30 p-3">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
              Filter by tag
            </span>
            {activeTags.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTags([])}
                className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-gold"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((t) => {
              const on = activeTags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    setActiveTags((prev) =>
                      on ? prev.filter((x) => x !== t) : [...prev, t],
                    )
                  }
                  className={`px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-[0.15em] transition-all ${
                    on
                      ? "bg-gold/20 text-gold border-gold/40"
                      : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  #{t}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* View tabs */}
      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <TabsList className="bg-muted/40">
          <TabsTrigger value="all" className="font-mono text-[11px] tracking-[0.2em] uppercase data-[state=active]:bg-gold data-[state=active]:text-primary-foreground">
            By Category
          </TabsTrigger>
          <TabsTrigger value="quarters" className="font-mono text-[11px] tracking-[0.2em] uppercase data-[state=active]:bg-gold data-[state=active]:text-primary-foreground">
            Quarters
          </TabsTrigger>
          <TabsTrigger value="timeframe" className="font-mono text-[11px] tracking-[0.2em] uppercase data-[state=active]:bg-gold data-[state=active]:text-primary-foreground">
            Cadence
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {CATEGORIES.map((cat) => {
              const items = filteredGoals.filter((g) => g.category === cat);
              if (items.length === 0) return null;
              return (
                <GroupCard
                  key={cat}
                  title={cat}
                  icon={CATEGORY_META[cat].icon}
                  iconTint={CATEGORY_META[cat].tint}
                  items={items}
                  brain={brain}
                  onToggle={toggle}
                  onUpdate={update}
                  onDelete={remove}
                />
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="quarters" className="mt-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {QUARTERS.map((q) => {
              const items = filteredGoals.filter((g) => g.quarter === q);
              return (
                <QuarterCard
                  key={q}
                  quarter={q}
                  items={items}
                  brain={brain}
                  onToggle={toggle}
                  onUpdate={update}
                  onDelete={remove}
                />
              );
            })}
            {/* Unassigned */}
            {filteredGoals.some((g) => !g.quarter) && (
              <QuarterCard
                quarter={null}
                items={filteredGoals.filter((g) => !g.quarter)}
                brain={brain}
                onToggle={toggle}
                onUpdate={update}
                onDelete={remove}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="timeframe" className="mt-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {TIMEFRAMES.map((tf) => {
              const items = filteredGoals.filter((g) => g.timeframe === tf);
              if (items.length === 0) return null;
              return (
                <GroupCard
                  key={tf}
                  title={TIMEFRAME_LABEL[tf]}
                  icon={Target}
                  iconTint="text-gold"
                  items={items}
                  brain={brain}
                  onToggle={toggle}
                  onUpdate={update}
                  onDelete={remove}
                />
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Add form ---------- */

function AddGoalForm({ onAdd }: { onAdd: (g: Omit<Goal, "id" | "createdAt">) => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<GoalCategory>("Life");
  const [timeframe, setTimeframe] = useState<GoalTimeframe>("annual");
  const [quarter, setQuarter] = useState<GoalQuarter>(null);
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [finType, setFinType] = useState<FinancialType>("savings");

  const isMoney = category === "Money";

  const submit = () => {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      category,
      timeframe,
      quarter,
      deadline: deadline ? deadline.toISOString() : undefined,
      target: target ? Number(target) : undefined,
      current: target ? 0 : undefined,
      unit: isMoney ? "$" : (unit.trim() || undefined),
      financialType: isMoney ? finType : undefined,
      done: false,
    });
    setTitle("");
    setTarget("");
    setUnit("");
    setDeadline(undefined);
  };

  return (
    <Card className="p-4 bg-gradient-card border-border space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={isMoney ? "e.g. Pay off credit card, Save for vacation…" : "A new ambition…"}
          className="bg-background/40 border-border focus-visible:ring-gold/40 focus-visible:border-gold/40"
        />
        <Button onClick={submit} className="bg-gold text-primary-foreground hover:bg-gold-soft">
          <Plus className="h-4 w-4 mr-1" /> Add Goal
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Select value={category} onChange={(v) => setCategory(v as GoalCategory)} options={CATEGORIES} />
        <Select
          value={timeframe}
          onChange={(v) => setTimeframe(v as GoalTimeframe)}
          options={TIMEFRAMES}
          render={(t) => TIMEFRAME_LABEL[t as GoalTimeframe]}
        />
        <Select
          value={quarter ?? ""}
          onChange={(v) => setQuarter((v || null) as GoalQuarter)}
          options={["", ...QUARTERS]}
          render={(q) => (q === "" ? "No quarter" : q)}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "border-border bg-background/40 text-xs justify-start font-mono uppercase tracking-wider",
                !deadline && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5 mr-1" />
              {deadline ? format(deadline, "MMM d") : "Deadline"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-50" align="start">
            <Calendar
              mode="single"
              selected={deadline}
              onSelect={setDeadline}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Money-specific fields */}
      {isMoney ? (
        <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-emerald-400">
            💳 Financial Goal Type
          </div>
          <div className="flex gap-2">
            {(["debt", "savings", "budget"] as FinancialType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFinType(t)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-mono uppercase tracking-wider transition-all ${
                  finType === t
                    ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                    : "border-border text-muted-foreground hover:border-emerald-500/30"
                }`}
              >
                {FIN_TYPE_LABELS[t].icon} {FIN_TYPE_LABELS[t].label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-400 font-mono text-sm">$</span>
              <input
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder={
                  finType === "debt" ? "Total owed (e.g. 5200)" :
                  finType === "savings" ? "Savings target (e.g. 15000)" :
                  "Budget cap (e.g. 2000)"
                }
                className="w-full rounded-lg border border-border bg-background/50 py-2 pl-7 pr-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
              {FIN_TYPE_LABELS[finType].targetLabel}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground/60 font-mono">
            After adding, tap the goal to open the financial editor and log payments or deposits.
          </div>
        </div>
      ) : (
        <div className="flex gap-1">
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Target (optional)"
            type="number"
            className="bg-background/40 border-border text-xs"
          />
          <Input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="unit (reps, mi…)"
            className="bg-background/40 border-border text-xs w-36"
          />
        </div>
      )}
    </Card>
  );
}

function Select({
  value,
  onChange,
  options,
  render,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  render?: (v: string) => string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-background/40 border border-border rounded-md px-2 py-2 text-xs font-mono uppercase tracking-wider text-foreground focus:outline-none focus:ring-2 focus:ring-gold/40"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {render ? render(o) : o}
        </option>
      ))}
    </select>
  );
}

/* ---------- Group / Quarter cards ---------- */

/** Summary strip shown inside the Money GroupCard header */
function MoneyTotalsStrip({ items }: { items: Goal[] }) {
  const debtGoals    = items.filter((g) => g.financialType === "debt"    || (!g.financialType && g.unit === "$" && typeof g.target === "number"));
  const savingsGoals = items.filter((g) => g.financialType === "savings");
  const budgetGoals  = items.filter((g) => g.financialType === "budget");

  // For debt: remaining = target - current (what's still owed)
  const totalDebt      = debtGoals.reduce((s, g) => s + (g.target ?? 0), 0);
  const totalDebtPaid  = debtGoals.reduce((s, g) => s + (g.current ?? 0), 0);
  const totalDebtLeft  = Math.max(0, totalDebt - totalDebtPaid);

  const totalSavTarget = savingsGoals.reduce((s, g) => s + (g.target ?? 0), 0);
  const totalSaved     = savingsGoals.reduce((s, g) => s + (g.current ?? 0), 0);

  const totalBudget    = budgetGoals.reduce((s, g) => s + (g.target ?? 0), 0);
  const totalSpent     = budgetGoals.reduce((s, g) => s + (g.current ?? 0), 0);

  const hasAny = totalDebt > 0 || totalSavTarget > 0 || totalBudget > 0;
  if (!hasAny) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
      {totalDebt > 0 && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 space-y-0.5">
          <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-red-400/80">💳 Debt Remaining</div>
          <div className="font-mono text-lg font-bold text-red-300">{formatCurrency(totalDebtLeft)}</div>
          <div className="font-mono text-[10px] text-muted-foreground">of {formatCurrency(totalDebt)} total</div>
          {totalDebt > 0 && (
            <div className="h-1 mt-1 rounded-full bg-background/60 overflow-hidden">
              <div className="h-full rounded-full bg-red-500/60" style={{ width: `${Math.min(100, Math.round((totalDebtPaid / totalDebt) * 100))}%` }} />
            </div>
          )}
        </div>
      )}
      {totalSavTarget > 0 && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 space-y-0.5">
          <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-emerald-400/80">🏦 Savings</div>
          <div className="font-mono text-lg font-bold text-emerald-300">{formatCurrency(totalSaved)}</div>
          <div className="font-mono text-[10px] text-muted-foreground">of {formatCurrency(totalSavTarget)} target</div>
          <div className="h-1 mt-1 rounded-full bg-background/60 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500/60" style={{ width: `${Math.min(100, totalSavTarget > 0 ? Math.round((totalSaved / totalSavTarget) * 100) : 0)}%` }} />
          </div>
        </div>
      )}
      {totalBudget > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 space-y-0.5">
          <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-amber-400/80">📊 Budget Used</div>
          <div className="font-mono text-lg font-bold text-amber-300">{formatCurrency(totalSpent)}</div>
          <div className="font-mono text-[10px] text-muted-foreground">of {formatCurrency(totalBudget)} budget</div>
          <div className="h-1 mt-1 rounded-full bg-background/60 overflow-hidden">
            <div className="h-full rounded-full bg-amber-500/60" style={{ width: `${Math.min(100, totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function GroupCard({
  title,
  icon: Icon,
  iconTint,
  items,
  brain,
  onToggle,
  onUpdate,
  onDelete,
}: {
  title: string;
  icon: typeof Dumbbell;
  iconTint: string;
  items: Goal[];
  brain: BrainEntry[];
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Goal>) => void;
  onDelete: (id: string) => void;
}) {
  const done = items.filter((g) => g.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <Card className="p-6 bg-gradient-card border-border">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-muted/50 flex items-center justify-center">
            <Icon className={`h-5 w-5 ${iconTint}`} />
          </div>
          <div>
            <h3 className="font-display text-2xl">{title}</h3>
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mt-0.5">
              {done}/{items.length} · {pct}%
            </p>
          </div>
        </div>
        <Sparkles className="h-4 w-4 text-gold/60" />
      </div>
      <Progress value={pct} className="h-1.5 mb-4" />

      {/* Financial totals strip — only for Money category */}
      {title === "Money" && <MoneyTotalsStrip items={items} />}

      <ul className="space-y-3">
        {items.map((g) => (
          <GoalRow
            key={g.id}
            goal={g}
            brain={brain}
            onToggle={() => onToggle(g.id)}
            onChange={(p) => onUpdate(g.id, p)}
            onDelete={() => onDelete(g.id)}
          />
        ))}
      </ul>
    </Card>
  );
}

function QuarterCard({
  quarter,
  items,
  brain,
  onToggle,
  onUpdate,
  onDelete,
}: {
  quarter: GoalQuarter;
  items: Goal[];
  brain: BrainEntry[];
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Goal>) => void;
  onDelete: (id: string) => void;
}) {
  const meta = quarter ? QUARTER_RANGES[quarter] : { label: "Unscheduled", months: "Assign a quarter" };
  const done = items.filter((g) => g.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <Card className="p-6 bg-gradient-card border-border">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-gold">
            {meta.months}
          </div>
          <h3 className="font-display text-2xl mt-1">{meta.label}</h3>
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mt-1">
            {items.length === 0 ? "No goals yet" : `${done}/${items.length} · ${pct}%`}
          </p>
        </div>
        {quarter && (
          <div className="font-display text-4xl text-gold/40">{quarter}</div>
        )}
      </div>
      <Progress value={pct} className="h-1.5 mb-4" />
      {items.length === 0 ? (
        <p className="font-display italic text-muted-foreground text-sm text-center py-6">
          The slate is open. Assign a goal to this quarter.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((g) => (
            <GoalRow
              key={g.id}
              goal={g}
              brain={brain}
              onToggle={() => onToggle(g.id)}
              onChange={(p) => onUpdate(g.id, p)}
              onDelete={() => onDelete(g.id)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------- Currency helpers ---------- */

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Parse a dollar-string like "$1,200" or "1200" → number */
function parseDollar(raw: string): number {
  const n = Number(raw.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

/* ---------- Financial Goal Panel ---------- */

const FIN_TYPE_LABELS: Record<FinancialType, { label: string; icon: string; currentLabel: string; targetLabel: string; addLabel: string; subtractLabel: string }> = {
  debt:    { label: "Debt Payoff",     icon: "💳", currentLabel: "Amount Paid",    targetLabel: "Total Owed",      addLabel: "Made a payment",    subtractLabel: "Added to balance" },
  savings: { label: "Savings",         icon: "🏦", currentLabel: "Amount Saved",   targetLabel: "Savings Target",  addLabel: "Deposit",           subtractLabel: "Withdrawal" },
  budget:  { label: "Spending Budget", icon: "📊", currentLabel: "Amount Spent",   targetLabel: "Budget Cap",      addLabel: "Logged expense",    subtractLabel: "Removed expense"  },
};

function FinancialGoalPanel({
  goal,
  onChange,
}: {
  goal: Goal;
  onChange: (patch: Partial<Goal>) => void;
}) {
  const ftype: FinancialType = goal.financialType ?? "savings";
  const meta = FIN_TYPE_LABELS[ftype];

  const target = goal.target ?? 0;
  const current = goal.current ?? 0;

  // local draft states for the dollar inputs — sync with goal prop
  const [targetDraft, setTargetDraft] = useState(target > 0 ? String(target) : "");
  const [currentDraft, setCurrentDraft] = useState(current > 0 ? String(current) : "");
  const [amountDraft, setAmountDraft] = useState("");

  // Keep drafts in sync if goal changes externally (e.g. quick-log from dashboard)
  useEffect(() => { if (document.activeElement?.tagName !== "INPUT") setTargetDraft(target > 0 ? String(target) : ""); }, [target]);
  useEffect(() => { if (document.activeElement?.tagName !== "INPUT") setCurrentDraft(current > 0 ? String(current) : ""); }, [current]);
  const remaining = Math.max(0, target - current);
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  // For debt: "Balance remaining", for savings: "Still needed", for budget: "Budget left"
  const remainingLabel =
    ftype === "debt" ? "Balance remaining" :
    ftype === "savings" ? "Still needed" :
    "Budget remaining";

  const quickAmounts = [100, 500, 1000, 5000];

  const applyAmount = (delta: number) => {
    const next = Math.max(0, current + delta);
    onChange({ current: next, lastCheckIn: new Date().toISOString().slice(0, 10), localUpdatedAt: Date.now() } as Partial<Goal>);
    setCurrentDraft(String(next));
  };

  return (
    <div className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      {/* Type selector */}
      <div className="flex gap-2">
        {(["debt", "savings", "budget"] as FinancialType[]).map((t) => (
          <button
            key={t}
            onClick={() => onChange({ financialType: t, unit: "$" })}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-mono uppercase tracking-wider transition-all ${
              ftype === t
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                : "border-border text-muted-foreground hover:border-emerald-500/30 hover:text-emerald-400/70"
            }`}
          >
            {FIN_TYPE_LABELS[t].icon} {FIN_TYPE_LABELS[t].label}
          </button>
        ))}
      </div>

      {/* Target + Current inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
            {meta.targetLabel}
          </div>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-400 font-mono text-sm">$</span>
            <input
              type="number"
              value={targetDraft}
              onChange={(e) => setTargetDraft(e.target.value)}
              onBlur={() => {
                const n = parseDollar(targetDraft);
                onChange({ target: n || undefined, unit: "$" });
              }}
              placeholder="0"
              className="w-full rounded-lg border border-border bg-background/50 py-2 pl-7 pr-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
            {meta.currentLabel}
          </div>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-400 font-mono text-sm">$</span>
            <input
              type="number"
              value={currentDraft}
              onChange={(e) => setCurrentDraft(e.target.value)}
              onBlur={() => {
                const n = parseDollar(currentDraft);
                onChange({ current: n, lastCheckIn: new Date().toISOString().slice(0, 10) });
              }}
              placeholder="0"
              className="w-full rounded-lg border border-border bg-background/50 py-2 pl-7 pr-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>
        </div>
      </div>

      {/* Summary bar */}
      {target > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-muted-foreground">{remainingLabel}</span>
            <span className="text-emerald-400 font-semibold">{formatCurrency(remaining)}</span>
          </div>
          <div className="h-2 rounded-full bg-background/60 border border-border overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
            <span>{formatCurrency(current)} {ftype === "debt" ? "paid" : ftype === "savings" ? "saved" : "spent"}</span>
            <span className="text-emerald-400">{pct}% {ftype === "budget" ? "used" : "complete"}</span>
          </div>
        </div>
      )}

      {/* Quick-log transaction — amount field FIRST, then confirm buttons */}
      <div className="space-y-3">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
          Log a transaction
        </div>

        {/* Amount input — large and obvious */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-xl pointer-events-none">$</span>
          <input
            type="number"
            inputMode="decimal"
            value={amountDraft}
            onChange={(e) => setAmountDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const n = parseDollar(amountDraft);
                if (n > 0) { applyAmount(n); setAmountDraft(""); }
              }
            }}
            placeholder="0"
            className="w-full rounded-xl border-2 border-emerald-500/30 bg-background/70 py-3 pl-9 pr-4 text-2xl font-bold text-foreground placeholder:text-muted-foreground/30 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* Quick-fill presets — tap to fill the input above */}
        <div className="flex gap-1.5 flex-wrap">
          {quickAmounts.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setAmountDraft(String(amt))}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-mono transition-all ${
                amountDraft === String(amt)
                  ? "border-emerald-500/60 bg-emerald-500/25 text-emerald-300"
                  : "border-emerald-500/25 bg-emerald-500/8 text-emerald-500 hover:bg-emerald-500/15"
              }`}
            >
              {formatCurrency(amt)}
            </button>
          ))}
        </div>

        {/* Add / Subtract action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              const n = parseDollar(amountDraft);
              if (n > 0) { applyAmount(n); setAmountDraft(""); }
            }}
            disabled={parseDollar(amountDraft) <= 0}
            className="rounded-xl border border-emerald-500/50 bg-emerald-500/20 py-3 text-sm font-bold text-emerald-400 hover:bg-emerald-500/30 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + {meta.addLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              const n = parseDollar(amountDraft);
              if (n > 0) { applyAmount(-n); setAmountDraft(""); }
            }}
            disabled={parseDollar(amountDraft) <= 0}
            className="rounded-xl border border-destructive/40 bg-destructive/10 py-3 text-sm font-bold text-destructive hover:bg-destructive/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            − {meta.subtractLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Goal row ---------- */

function GoalRow({
  goal,
  brain,
  onToggle,
  onChange,
  onDelete,
}: {
  goal: Goal;
  brain: BrainEntry[];
  onToggle: () => void;
  onChange: (patch: Partial<Goal>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const measurable = typeof goal.target === "number";
  const pct = progressPct(goal);
  const linked = brain.filter((b) => b.goalId === goal.id);
  const days = daysUntil(goal.deadline);

  return (
    <li className="rounded-md bg-background/30 border border-border/60 hover:border-gold/30 transition-all">
      <div className="flex items-start gap-3 p-3">
        <Checkbox
          checked={goal.done}
          onCheckedChange={onToggle}
          className="mt-0.5 border-gold/40 data-[state=checked]:bg-gold data-[state=checked]:text-primary-foreground"
        />
        <div className="flex-1 min-w-0">
          <button onClick={() => setOpen((o) => !o)} className="text-left w-full">
            <div
              className={`text-sm leading-snug ${
                goal.done ? "line-through text-muted-foreground" : "text-foreground"
              }`}
            >
              {goal.title}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge>{goal.category}</Badge>
              <Badge variant="muted">{goal.timeframe}</Badge>
              {goal.quarter && <Badge variant="gold">{goal.quarter}</Badge>}
              {goal.deadline && (
                <Badge variant={days !== null && days < 0 ? "destructive" : "muted"}>
                  {format(new Date(goal.deadline), "MMM d, yyyy")}
                  {days !== null && (days < 0 ? " · overdue" : ` · ${days}d`)}
                </Badge>
              )}
              {goal.deadline && deadlineQuarterLabel(goal.deadline) && (
                <Badge variant="gold">
                  {deadlineQuarterLabel(goal.deadline)}
                </Badge>
              )}
              {goal.goalType === "streak" && (() => {
                const s = computeStreakStats(goal);
                return s.currentStreak > 0 ? (
                  <Badge variant="gold">🔥 {s.currentStreak}d streak</Badge>
                ) : null;
              })()}
              {linked.length > 0 && (
                <Badge variant="muted">
                  <Brain className="h-2.5 w-2.5 mr-1 inline" />
                  {linked.length}
                </Badge>
              )}
              {(goal.tags ?? []).map((t) => (
                <Badge key={t} variant="gold">
                  #{t}
                </Badge>
              ))}
            </div>
            {(measurable || goal.category === "Money") && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-gold transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] tracking-wider text-gold whitespace-nowrap">
                  {goal.category === "Money"
                    ? (measurable
                        ? `${formatCurrency(goal.current ?? 0)} / ${formatCurrency(goal.target ?? 0)}`
                        : "Tap to set amount")
                    : `${goal.current ?? 0}/${goal.target}${goal.unit ? ` ${goal.unit}` : ""}`}
                </span>
              </div>
            )}
            {measurable && !goal.done && (
              <ProgressInsight goal={goal} onChange={onChange} />
            )}
            {!goal.done && <SuggestedNextRow goal={goal} />}
          </button>

          {open && (
            <div className="mt-3 space-y-3 fade-in">
              {/* Analytics panel — streak tracker or quarterly pace */}
              <GoalAnalyticsPanel goal={goal} onChange={onChange} />

              <div className="grid grid-cols-3 gap-2">
                <Select
                  value={goal.timeframe}
                  onChange={(v) => onChange({ timeframe: v as GoalTimeframe })}
                  options={TIMEFRAMES}
                />
                <Select
                  value={goal.quarter ?? ""}
                  onChange={(v) => onChange({ quarter: (v || null) as GoalQuarter })}
                  options={["", ...QUARTERS]}
                  render={(q) => (q === "" ? "No quarter" : q)}
                />
                <Select
                  value={goal.goalType ?? "metric"}
                  onChange={(v) => onChange({ goalType: v as "metric" | "streak" })}
                  options={["metric", "streak"]}
                  render={(t) => (t === "streak" ? "Streak" : "Metric")}
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border bg-background/40 text-xs w-full justify-start font-mono uppercase tracking-wider"
                  >
                    <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                    {goal.deadline
                      ? format(new Date(goal.deadline), "PPP")
                      : "Set deadline"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={goal.deadline ? new Date(goal.deadline) : undefined}
                    onSelect={(d) => onChange({ deadline: d?.toISOString() })}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {/* Financial goals get the rich money editor; others get the plain number input */}
              {goal.category === "Money" ? (
                <FinancialGoalPanel goal={goal} onChange={onChange} />
              ) : measurable && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={goal.current ?? 0}
                    onChange={(e) => onChange({ current: Number(e.target.value) || 0 })}
                    className="bg-background/50 border-border h-8 text-xs w-28"
                  />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    of {goal.target} {goal.unit}
                  </span>
                </div>
              )}
              <Textarea
                value={goal.note ?? ""}
                onChange={(e) => onChange({ note: e.target.value })}
                placeholder="Notes, plan of attack…"
                className="bg-background/40 border-border text-xs min-h-[60px] resize-none focus-visible:ring-gold/40 focus-visible:border-gold/40"
              />

              <TagsField
                value={goal.tags ?? []}
                onChange={(next) => onChange({ tags: next })}
              />

              <AIBreakdown goal={goal} onChange={onChange} />
              {linked.length > 0 && (
                <div className="space-y-1">
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                    Linked thoughts ({linked.length})
                  </div>
                  <ul className="space-y-1">
                    {linked.slice(0, 5).map((b) => (
                      <li
                        key={b.id}
                        className="text-xs text-muted-foreground border-l-2 border-gold/40 pl-2"
                      >
                        {b.text}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/brain-dump"
                    className="text-[10px] tracking-[0.2em] uppercase text-gold hover:text-gold-soft"
                  >
                    Open Brain Dump →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onDelete}
          className="text-muted-foreground/40 hover:text-destructive transition-colors p-1"
          aria-label="Delete goal"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

function TagsField({
  value,
  onChange,
  label = "Tags",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
}) {
  const [draft, setDraft] = useState("");
  const tags = value ?? [];
  const add = () => {
    const t = draft.trim().toLowerCase().replace(/\s+/g, "-");
    if (!t) return;
    if (tags.includes(t)) {
      setDraft("");
      return;
    }
    onChange([...tags, t]);
    setDraft("");
  };
  return (
    <div className="space-y-1.5">
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gold/30 bg-gold/10 text-gold text-[10px] font-mono uppercase tracking-[0.15em]"
          >
            #{t}
            <button
              type="button"
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="text-gold/70 hover:text-destructive"
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </span>
        ))}
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder="add tag…"
          className="h-6 px-2 text-[11px] bg-background/50 border-border w-28"
        />
      </div>
    </div>
  );
}

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "muted" | "gold" | "destructive";
}) {
  const styles = {
    default: "bg-muted/40 text-muted-foreground border-border",
    muted: "bg-muted/30 text-muted-foreground border-border",
    gold: "bg-gold/15 text-gold border-gold/30",
    destructive: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return (
    <span
      className={`px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-[0.15em] ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

/* ---------- AI Breakdown ---------- */

function AIBreakdown({
  goal,
  onChange,
}: {
  goal: Goal;
  onChange: (patch: Partial<Goal>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"list" | "timeline">("list");
  const subSteps = goal.subSteps ?? [];
  const completed = subSteps.filter((s) => s.done).length;
  const overallPct = subSteps.length
    ? Math.round((completed / subSteps.length) * 100)
    : 0;

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "breakdown-goal",
        {
          body: {
            goal: {
              title: goal.title,
              category: goal.category,
              timeframe: goal.timeframe,
              quarter: goal.quarter,
              deadline: goal.deadline,
              target: goal.target,
              current: goal.current,
              unit: goal.unit,
            },
            context,
          },
        },
      );

      if (error) {
        const status = (error as { context?: { status?: number } })?.context?.status;
        if (status === 429) {
          toast.error("Rate limit reached. Try again in a moment.");
        } else if (status === 402) {
          toast.error("AI credits depleted. Add credits in Workspace → Usage.");
        } else {
          toast.error(error.message || "Could not generate plan");
        }
        return;
      }

      if (!data?.steps?.length) {
        toast.error("Alfred returned no steps. Try adding more context.");
        return;
      }

      const nowIso = new Date().toISOString();
      const newSteps: GoalSubStep[] = data.steps.map(
        (s: { title: string; detail?: string; durationWeeks?: number }) => ({
          id: crypto.randomUUID(),
          title: s.title,
          detail: s.detail,
          durationWeeks: s.durationWeeks,
          done: false,
          status: "pending" as SubStepStatus,
          statusHistory: [{ status: "pending" as SubStepStatus, at: nowIso }],
        }),
      );

      onChange({
        subSteps: newSteps,
        planSummary: data.summary,
        planStartDate: goal.planStartDate ?? new Date().toISOString(),
      });
      setOpen(true);
      toast.success("Plan ready, sir.");
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const patchStep = (id: string, patch: Partial<GoalSubStep>) => {
    onChange({
      subSteps: subSteps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const setStepStatus = (id: string, status: SubStepStatus, note?: string) => {
    onChange({
      subSteps: subSteps.map((s) => {
        if (s.id !== id) return s;
        if (s.status === status && (status !== "done" || s.done)) return s;
        const history = appendStatusEvent(s, status, note);
        return {
          ...s,
          status,
          done: status === "done",
          completedAt:
            status === "done"
              ? s.completedAt ?? new Date().toISOString()
              : status === "pending" || status === "in_progress"
                ? undefined
                : s.completedAt,
          statusHistory: history,
        };
      }),
    });
  };

  const toggleStep = (id: string) => {
    const target = subSteps.find((s) => s.id === id);
    if (!target) return;
    const nowDone = !target.done;
    setStepStatus(id, nowDone ? "done" : "pending");
    if (nowDone) awardXp(XP_VALUES.GOAL_STEP_DONE, "goal_step");
  };

  const removePlan = () => {
    if (!confirm("Discard the AI plan?")) return;
    onChange({
      subSteps: undefined,
      planSummary: undefined,
      planStartDate: undefined,
    });
  };

  return (
    <div className="space-y-2 rounded-md border border-gold/20 bg-gold/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Wand2 className="h-3.5 w-3.5 text-gold" />
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-gold">
            Alfred's Plan
          </span>
          {subSteps.length > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground">
              · {completed}/{subSteps.length}
            </span>
          )}
        </div>
        {subSteps.length > 0 && (
          <button
            onClick={removePlan}
            className="text-muted-foreground/50 hover:text-destructive transition-colors"
            aria-label="Discard plan"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {subSteps.length === 0 ? (
        <>
          <Textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Your schedule & current routine — e.g. '9-5 desk job, gym 3x/week, can do 20 push-ups now'"
            className="bg-background/50 border-border text-xs min-h-[56px] resize-none focus-visible:ring-gold/40 focus-visible:border-gold/40"
          />
          <Button
            onClick={generate}
            disabled={loading}
            size="sm"
            className="w-full bg-gold text-primary-foreground hover:bg-gold-soft h-8"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Devising plan…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Break it down for me
              </>
            )}
          </Button>
        </>
      ) : (
        <PlanBody
          goal={goal}
          subSteps={subSteps}
          completed={completed}
          overallPct={overallPct}
          mode={mode}
          setMode={setMode}
          toggleStep={toggleStep}
          patchStep={patchStep}
          setStepStatus={setStepStatus}
          onRegenerate={generate}
          regenerating={loading}
        />
      )}
    </div>
  );
}

/* ---------- Plan body (projection + list/timeline) ---------- */

const STATUS_OPTIONS: SubStepStatus[] = [
  "pending",
  "in_progress",
  "done",
  "at_risk",
  "blocked",
];

function PlanBody({
  goal,
  subSteps,
  completed,
  overallPct,
  mode,
  setMode,
  toggleStep,
  patchStep,
  setStepStatus,
  onRegenerate,
  regenerating,
}: {
  goal: Goal;
  subSteps: GoalSubStep[];
  completed: number;
  overallPct: number;
  mode: "list" | "timeline";
  setMode: (m: "list" | "timeline") => void;
  toggleStep: (id: string) => void;
  patchStep: (id: string, patch: Partial<GoalSubStep>) => void;
  setStepStatus: (id: string, status: SubStepStatus, note?: string) => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const schedule = useMemo(() => buildSchedule(goal), [goal]);

  return (
    <>
      {goal.planSummary && (
        <p className="font-display italic text-xs text-muted-foreground leading-snug">
          "{goal.planSummary}"
        </p>
      )}

      {/* Overall progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
          <span>Overall</span>
          <span className="text-gold">
            {completed}/{subSteps.length} · {overallPct}%
          </span>
        </div>
        <div className="h-1 bg-background/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-gold transition-all duration-700"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* Projection banner */}
      <ProjectionBanner schedule={schedule} deadline={goal.deadline} />

      {/* View toggle */}
      <div className="flex items-center gap-1 rounded-md bg-background/40 p-0.5">
        <button
          onClick={() => setMode("list")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1 rounded px-2 py-1 font-mono text-[9px] tracking-[0.2em] uppercase transition-colors",
            mode === "list"
              ? "bg-gold/20 text-gold"
              : "text-muted-foreground hover:text-gold",
          )}
        >
          <List className="h-3 w-3" /> List
        </button>
        <button
          onClick={() => setMode("timeline")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1 rounded px-2 py-1 font-mono text-[9px] tracking-[0.2em] uppercase transition-colors",
            mode === "timeline"
              ? "bg-gold/20 text-gold"
              : "text-muted-foreground hover:text-gold",
          )}
        >
          <GanttChartSquare className="h-3 w-3" /> Timeline
        </button>
      </div>

      {mode === "list" ? (
        <PlanList
          schedule={schedule}
          toggleStep={toggleStep}
          patchStep={patchStep}
          setStepStatus={setStepStatus}
        />
      ) : (
        <PlanTimeline
          schedule={schedule}
          deadline={goal.deadline}
          toggleStep={toggleStep}
          patchStep={patchStep}
        />
      )}

      <Button
        onClick={onRegenerate}
        disabled={regenerating}
        variant="outline"
        size="sm"
        className="w-full border-gold/30 text-gold hover:bg-gold/10 h-7 text-[10px] tracking-[0.2em] uppercase font-mono"
      >
        {regenerating ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <RotateCcw className="h-3 w-3 mr-1" /> Regenerate
          </>
        )}
      </Button>
    </>
  );
}

function ProjectionBanner({
  schedule,
  deadline,
}: {
  schedule: ReturnType<typeof buildSchedule>;
  deadline?: string;
}) {
  const { projectedEndDate, isLate, daysVsDeadline, actualPace, plannedPace } =
    schedule;
  const paceRatio = actualPace ? actualPace / plannedPace : null;

  return (
    <div
      className={cn(
        "rounded-md border p-2 space-y-1",
        isLate
          ? "border-destructive/40 bg-destructive/10"
          : "border-teal/30 bg-teal/5",
      )}
    >
      <div className="flex items-center gap-1.5">
        {isLate ? (
          <AlertTriangle className="h-3 w-3 text-destructive" />
        ) : (
          <TrendingUp className="h-3 w-3 text-teal" />
        )}
        <span
          className={cn(
            "font-mono text-[9px] tracking-[0.2em] uppercase",
            isLate ? "text-destructive" : "text-teal",
          )}
        >
          Projected finish · {format(projectedEndDate, "MMM d, yyyy")}
        </span>
      </div>
      <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground/80">
        {deadline ? (
          <span>
            {daysVsDeadline === null
              ? ""
              : daysVsDeadline === 0
                ? "On the wire"
                : daysVsDeadline > 0
                  ? `${daysVsDeadline}d past deadline`
                  : `${Math.abs(daysVsDeadline)}d ahead of deadline`}
          </span>
        ) : (
          <span>No deadline set</span>
        )}
        {paceRatio !== null && (
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {paceRatio > 1.05
              ? `${Math.round((paceRatio - 1) * 100)}% slower than planned`
              : paceRatio < 0.95
                ? `${Math.round((1 - paceRatio) * 100)}% faster than planned`
                : "On pace"}
          </span>
        )}
      </div>
    </div>
  );
}

function PlanList({
  schedule,
  toggleStep,
  patchStep,
  setStepStatus,
}: {
  schedule: ReturnType<typeof buildSchedule>;
  toggleStep: (id: string) => void;
  patchStep: (id: string, patch: Partial<GoalSubStep>) => void;
  setStepStatus: (id: string, status: SubStepStatus, note?: string) => void;
}) {
  return (
    <ol className="space-y-1.5">
      {schedule.steps.map(({ step: s, index: i, status, slip, startWeek, duration }) => {
        const meta = STATUS_META[status];
        const elapsedFraction = Math.min(
          1,
          Math.max(0, (schedule.elapsedWeeks - startWeek) / Math.max(0.5, duration)),
        );
        return (
          <li
            key={s.id}
            className="rounded-md border border-border/50 bg-background/30 p-2 space-y-1.5"
          >
            <div className="flex items-start gap-2">
              <Checkbox
                checked={s.done}
                onCheckedChange={() => toggleStep(s.id)}
                className="mt-0.5 border-gold/40 data-[state=checked]:bg-gold data-[state=checked]:text-primary-foreground h-3.5 w-3.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-[9px] text-gold/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium leading-snug flex-1",
                      s.done && "line-through text-muted-foreground",
                    )}
                  >
                    {s.title}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[8px] tracking-wider uppercase px-1 rounded",
                      meta.tint,
                    )}
                  >
                    {meta.label}
                  </span>
                </div>
                {s.detail && (
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                    {s.detail}
                  </p>
                )}
              </div>
            </div>

            <StepEditor
              step={s}
              startWeek={startWeek}
              duration={duration}
              slip={slip}
              status={status}
              elapsedFraction={elapsedFraction}
              onPatch={(p) => patchStep(s.id, p)}
              onStatusChange={(next) => setStepStatus(s.id, next)}
            />

            <StatusHistory step={s} />
          </li>
        );
      })}
    </ol>
  );
}

function StepEditor({
  step,
  startWeek,
  duration,
  slip,
  status,
  elapsedFraction,
  onPatch,
  onStatusChange,
}: {
  step: GoalSubStep;
  startWeek: number;
  duration: number;
  slip: number;
  status: SubStepStatus;
  /** 0..1 share of this step's window already elapsed — drives pace badge. */
  elapsedFraction: number;
  onPatch: (patch: Partial<GoalSubStep>) => void;
  onStatusChange: (next: SubStepStatus) => void;
}) {
  const pace = paceStatus(step, elapsedFraction);
  const meta = PACE_META[pace];

  return (
    <div className="space-y-2 pl-6">
      <div className="grid grid-cols-2 gap-1.5">
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="font-mono uppercase tracking-wider">Start W</span>
          <Input
            type="number"
            min={0}
            step={0.5}
            value={step.startWeek ?? Math.round(startWeek * 10) / 10}
            onChange={(e) => {
              const v = e.target.value;
              onPatch({ startWeek: v === "" ? undefined : Number(v) });
            }}
            className="h-6 px-1.5 text-[11px] bg-background/50 border-border"
          />
        </label>
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="font-mono uppercase tracking-wider">Dur W</span>
          <Input
            type="number"
            min={0.5}
            step={0.5}
            value={step.durationWeeks ?? duration}
            onChange={(e) =>
              onPatch({ durationWeeks: Number(e.target.value) || 1 })
            }
            className="h-6 px-1.5 text-[11px] bg-background/50 border-border"
          />
        </label>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as SubStepStatus)}
          className="bg-background/50 border border-border rounded h-6 px-1 text-[10px] font-mono uppercase tracking-wider text-foreground focus:outline-none focus:ring-1 focus:ring-gold/40"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {STATUS_META[o].label}
            </option>
          ))}
        </select>
        <Input
          value={step.reviewNote ?? ""}
          onChange={(e) => onPatch({ reviewNote: e.target.value })}
          placeholder={slip > 0 ? `Why ${slip.toFixed(1)}w late?` : "Review note"}
          className="h-6 px-1.5 text-[11px] bg-background/50 border-border"
        />
      </div>

      {/* Metric tracker — "where do I stand" */}
      <div className="rounded-md border border-border/40 bg-background/30 p-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground">
            Milestone
          </span>
          <span
            className={`font-mono text-[9px] tracking-[0.2em] uppercase ${meta.tone}`}
          >
            {meta.label}
            {pace !== "no_data" &&
              step.targetMetric != null &&
              step.currentMetric != null && (
                <>
                  {" "}
                  · {step.currentMetric}/{step.targetMetric}
                  {step.metricUnit ? ` ${step.metricUnit}` : ""}
                </>
              )}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <label className="text-[10px] text-muted-foreground">
            <span className="font-mono uppercase tracking-wider block mb-0.5">
              Current
            </span>
            <Input
              type="number"
              value={step.currentMetric ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onPatch({
                  currentMetric: v === "" ? undefined : Number(v),
                });
              }}
              placeholder="0"
              className="h-6 px-1.5 text-[11px] bg-background/50 border-border"
            />
          </label>
          <label className="text-[10px] text-muted-foreground">
            <span className="font-mono uppercase tracking-wider block mb-0.5">
              Target
            </span>
            <Input
              type="number"
              value={step.targetMetric ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onPatch({
                  targetMetric: v === "" ? undefined : Number(v),
                });
              }}
              placeholder="100"
              className="h-6 px-1.5 text-[11px] bg-background/50 border-border"
            />
          </label>
          <label className="text-[10px] text-muted-foreground">
            <span className="font-mono uppercase tracking-wider block mb-0.5">
              Unit
            </span>
            <Input
              value={step.metricUnit ?? ""}
              onChange={(e) => onPatch({ metricUnit: e.target.value })}
              placeholder="reps"
              className="h-6 px-1.5 text-[11px] bg-background/50 border-border"
            />
          </label>
        </div>
        {step.targetMetric != null && step.targetMetric > 0 && (
          <div className="h-1 bg-muted/40 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-700 ${
                pace === "ahead"
                  ? "bg-gold"
                  : pace === "behind"
                    ? "bg-destructive"
                    : "bg-teal"
              }`}
              style={{
                width: `${Math.min(100, ((step.currentMetric ?? 0) / step.targetMetric) * 100)}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Free-form notes — muscles to train, key principles, anything */}
      <Textarea
        value={step.notes ?? ""}
        onChange={(e) => onPatch({ notes: e.target.value })}
        placeholder="Muscles to train, principles, references…"
        className="bg-background/40 border-border text-[11px] min-h-[48px] resize-none focus-visible:ring-gold/40 focus-visible:border-gold/40"
      />

      <TagsField
        value={step.tags ?? []}
        onChange={(next) => onPatch({ tags: next })}
        label="Sub-step tags"
      />
    </div>
  );
}

/* ---------- Status history timeline ---------- */

function StatusHistory({ step }: { step: GoalSubStep }) {
  const [open, setOpen] = useState(false);
  const history = step.statusHistory ?? [];
  if (history.length === 0) return null;

  const latest = history[history.length - 1];
  const visible = open ? history : history.slice(-3);
  const hidden = history.length - visible.length;

  return (
    <div className="pl-6 pt-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground/70 hover:text-gold transition-colors"
        aria-expanded={open}
      >
        <Clock className="h-2.5 w-2.5" />
        Status log · {history.length}
        <span className="text-muted-foreground/40">
          {open ? "− hide" : hidden > 0 ? `+${hidden} more` : "expand"}
        </span>
      </button>

      <ol className="mt-1 space-y-1 border-l border-border/50 pl-2.5 ml-1">
        {visible.map((evt, idx) => {
          const meta = STATUS_META[evt.status];
          const isLatest = evt === latest;
          return (
            <li key={`${evt.at}-${idx}`} className="relative">
              <span
                className={cn(
                  "absolute -left-[14px] top-1 h-1.5 w-1.5 rounded-full ring-2 ring-background",
                  evt.status === "done" && "bg-gold",
                  evt.status === "in_progress" && "bg-teal",
                  evt.status === "at_risk" && "bg-destructive",
                  evt.status === "blocked" && "bg-destructive",
                  evt.status === "pending" && "bg-muted-foreground/50",
                )}
                aria-hidden
              />
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "font-mono text-[9px] tracking-wider uppercase",
                    meta.tint,
                    isLatest && "font-semibold",
                  )}
                >
                  {meta.label}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground/60">
                  {format(new Date(evt.at), "MMM d · HH:mm")}
                </span>
              </div>
              {evt.note && (
                <p className="text-[10px] text-muted-foreground/80 leading-snug mt-0.5">
                  {evt.note}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------- Timeline (Gantt) ---------- */

function PlanTimeline({
  schedule,
  deadline,
  toggleStep,
  patchStep,
}: {
  schedule: ReturnType<typeof buildSchedule>;
  deadline?: string;
  toggleStep: (id: string) => void;
  patchStep: (id: string, patch: Partial<GoalSubStep>) => void;
}) {
  const { steps, totalWeeks, elapsedWeeks } = schedule;

  // Tick spacing
  const tickEvery = totalWeeks > 16 ? 4 : totalWeeks > 8 ? 2 : 1;
  const ticks = Array.from(
    { length: Math.ceil(totalWeeks) + 1 },
    (_, i) => i,
  ).filter((i) => i % tickEvery === 0);

  return (
    <div className="space-y-2">
      {/* Week scale */}
      <div className="relative h-4 border-b border-border/50">
        {ticks.map((w) => (
          <div
            key={w}
            className="absolute top-0 bottom-0 flex flex-col items-center"
            style={{ left: `${(w / totalWeeks) * 100}%` }}
          >
            <div className="h-1.5 w-px bg-border/60" />
            <span className="font-mono text-[8px] text-muted-foreground/70 mt-0.5">
              {w === 0 ? "Start" : `W${w}`}
            </span>
          </div>
        ))}
      </div>

      {/* Bars */}
      <div className="relative space-y-1.5 pt-1">
        {/* "Today" indicator */}
        {elapsedWeeks > 0 && elapsedWeeks < totalWeeks && (
          <div
            className="absolute top-0 bottom-0 w-px bg-teal/70 z-10 pointer-events-none"
            style={{ left: `${(elapsedWeeks / totalWeeks) * 100}%` }}
            aria-hidden
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-teal" />
          </div>
        )}

        {steps.map(({ step: s, index: i, startWeek, endWeek, duration, status, slip }) => {
          const leftPct = (startWeek / totalWeeks) * 100;
          const widthPct = ((endWeek - startWeek) / totalWeeks) * 100;
          const meta = STATUS_META[status];
          return (
            <div key={s.id} className="flex items-center gap-2">
              <span className="font-mono text-[9px] text-gold/70 w-5 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="relative flex-1 h-6 bg-background/40 rounded-sm overflow-hidden">
                <button
                  onClick={() => toggleStep(s.id)}
                  title={`${s.title}${s.detail ? " — " + s.detail : ""}\nW${startWeek.toFixed(1)} → W${endWeek.toFixed(1)} (~${duration}w)${slip > 0 ? `\nSlip: +${slip.toFixed(1)}w` : ""}`}
                  className={cn(
                    "absolute top-0 bottom-0 rounded-sm px-1.5 flex items-center transition-all border",
                    meta.barClass,
                    s.done && "opacity-90",
                  )}
                  style={{
                    left: `${leftPct}%`,
                    width: `${Math.max(widthPct, 4)}%`,
                  }}
                >
                  <span
                    className={cn(
                      "text-[10px] font-medium truncate",
                      s.done && "line-through opacity-70",
                    )}
                  >
                    {s.title}
                  </span>
                </button>
                {/* Slip overlay */}
                {slip > 0 && !s.done && (
                  <div
                    className="absolute top-0 bottom-0 bg-destructive/30 border-r border-destructive/60 pointer-events-none"
                    style={{
                      left: `${((endWeek - slip) / totalWeeks) * 100}%`,
                      width: `${(slip / totalWeeks) * 100}%`,
                    }}
                    title={`Slip: +${slip.toFixed(1)}w`}
                  />
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={s.durationWeeks ?? duration}
                  onChange={(e) =>
                    patchStep(s.id, {
                      durationWeeks: Number(e.target.value) || 1,
                    })
                  }
                  className="h-5 w-10 px-1 text-[10px] bg-background/50 border-border"
                  title="Duration in weeks"
                />
                <span className="font-mono text-[8px] text-muted-foreground/70">w</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer meta */}
      <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.15em] uppercase text-muted-foreground/70 pt-1">
        <span>{totalWeeks.toFixed(1)}-week campaign</span>
        {deadline && (
          <span>Deadline · {format(new Date(deadline), "MMM d, yyyy")}</span>
        )}
      </div>
    </div>
  );
}

function SyncIndicator({
  signedIn,
  loading,
  syncing,
  error,
}: {
  signedIn: boolean;
  loading: boolean;
  syncing: boolean;
  error: string | null;
}) {
  if (!signedIn) {
    return (
      <span
        className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground"
        title="Sign in to sync goals across devices"
      >
        <CloudOff className="h-3.5 w-3.5" />
        Local only
      </span>
    );
  }
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading
      </span>
    );
  }
  if (error) {
    return (
      <span
        className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-destructive"
        title={error}
      >
        <CloudOff className="h-3.5 w-3.5" />
        Sync error
      </span>
    );
  }
  if (syncing) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-gold">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Syncing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-gold/80">
      <Cloud className="h-3.5 w-3.5" />
      Synced
    </span>
  );
}

function OnboardingEmptyState({
  onLoadTemplate,
}: {
  onLoadTemplate: () => void;
}) {
  return (
    <Card className="p-8 bg-gradient-card border-gold/30 border-l-2 border-l-gold/60 text-center">
      <div className="mx-auto mb-4 h-12 w-12 rounded-md bg-gold/15 flex items-center justify-center">
        <Sparkles className="h-6 w-6 text-gold" />
      </div>
      <h3 className="font-display text-2xl text-foreground">
        A blank ledger, sir.
      </h3>
      <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground leading-relaxed">
        Begin where you stand. Add your first goal above — anything from
        "drink more water" to "publish a book." Big or small, daily or annual.
      </p>
      <div className="my-5 flex items-center gap-3 max-w-xs mx-auto">
        <div className="h-px flex-1 bg-border" />
        <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-muted-foreground">
          or
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Need inspiration? Load a curated set of example goals as a template
        (you can edit, delete, or add to them freely).
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onLoadTemplate}
        className="border-gold/40 text-gold hover:text-gold hover:bg-muted/40"
      >
        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
        Load example goals
      </Button>
    </Card>
  );
}

/** Format a rate/value nicely. "$1,250" for monetary, "5.5 reps" otherwise. */
function fmtRate(n: number, unit: string | undefined): string {
  if (!isFinite(n)) return "—";
  const isMonetary = unit === "$" || unit?.toLowerCase() === "usd" || unit?.toLowerCase() === "dollars";
  if (isMonetary) {
    return `$${Math.round(Math.abs(n)).toLocaleString()}`;
  }
  const abs = Math.abs(n);
  const str = abs >= 100 ? String(Math.round(abs)) : abs.toFixed(1).replace(/\.0$/, "");
  return unit ? `${str} ${unit}` : str;
}

function ProgressInsight({
  goal,
  onChange,
}: {
  goal: Goal;
  onChange: (patch: Partial<Goal>) => void;
}) {
  const [view, setView] = useState<"days" | "weeks">("days");

  const projection = computeProjection(goal);
  const grid = last14Days(goal);
  const weeks = lastNWeeks(goal);
  const log = goal.progressLog ?? {};
  const todayStr = new Date().toISOString().slice(0, 10);
  const loggedToday = log[todayStr] !== undefined;

  // Rate numbers
  const hasTarget =
    typeof goal.target === "number" && goal.target > 0 && !goal.done;
  const needed = hasTarget ? Math.max(0, (goal.target ?? 0) - (goal.current ?? 0)) : 0;
  const requiredWeeklyRate =
    hasTarget && projection.requiredDailyRate != null
      ? projection.requiredDailyRate * 7
      : 0;
  const actualWeeklyRate =
    hasTarget && projection.actualDailyRate != null
      ? projection.actualDailyRate * 7
      : 0;
  const weeksLeft = projection.weeksLeft;

  // Bar chart scale: max bar height 68px
  const BAR_H = 68;
  const maxDelta = Math.max(
    requiredWeeklyRate > 0 && isFinite(requiredWeeklyRate)
      ? requiredWeeklyRate * 1.5
      : 0,
    ...weeks.map((w) => Math.max(0, w.delta)),
    1,
  );
  const scale = BAR_H / maxDelta;
  const reqLineH =
    requiredWeeklyRate > 0 && isFinite(requiredWeeklyRate)
      ? Math.min(BAR_H - 2, Math.round(requiredWeeklyRate * scale))
      : 0;

  const apply = (delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = logProgress({ goal, delta });
    onChange({
      current: next.current,
      progressLog: next.progressLog,
      lastCheckIn: next.lastCheckIn,
    });
    const xp = progressXp(delta, goal.target as number);
    awardXp(xp, "progress", { goalCurrent: next.current, unit: goal.unit ?? "" });

    const u = goal.unit ? ` ${goal.unit}` : "";
    const remaining =
      goal.target != null
        ? ` · ${fmtRate(Math.max(0, goal.target - next.current), goal.unit)} remaining`
        : "";
    if (delta > 0) {
      toast.success(`+${delta}${u} logged${remaining}`, { duration: 2500 });
    } else {
      toast(`${delta}${u} logged${remaining}`, {
        description: "Progress adjusted — no XP for setbacks.",
        duration: 3000,
      });
    }
  };

  return (
    <div
      className="mt-2 rounded-md border border-border/40 bg-background/30 p-2 space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Projection status line */}
      {projection.label && (
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <span className={`font-mono text-[10px] tracking-[0.2em] uppercase ${projection.tone}`}>
            {projection.label}
          </span>
          {projection.detail && (
            <span className="font-mono text-[9px] text-muted-foreground/80 leading-snug max-w-md text-right">
              {projection.detail}
            </span>
          )}
        </div>
      )}

      {/* ── Rate headline ── */}
      {hasTarget && isFinite(requiredWeeklyRate) && requiredWeeklyRate > 0 && (
        <div className="flex items-center justify-between gap-2 flex-wrap rounded bg-muted/20 px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            {actualWeeklyRate >= requiredWeeklyRate ? (
              <TrendingUp className="h-3 w-3 text-teal shrink-0" />
            ) : (
              <TrendingDown className="h-3 w-3 text-orange-400 shrink-0" />
            )}
            <span className="font-mono text-[10px] tracking-wider text-foreground/90">
              Need{" "}
              <span className="text-gold font-semibold">
                {fmtRate(requiredWeeklyRate, goal.unit)}/wk
              </span>
              {weeksLeft != null && weeksLeft > 0 && (
                <span className="text-muted-foreground">
                  {" "}· {weeksLeft} wk{weeksLeft === 1 ? "" : "s"} left
                </span>
              )}
            </span>
          </div>
          <span className="font-mono text-[9px] text-muted-foreground">
            avg{" "}
            <span
              className={
                actualWeeklyRate >= requiredWeeklyRate
                  ? "text-teal"
                  : "text-orange-400"
              }
            >
              {fmtRate(actualWeeklyRate, goal.unit)}/wk
            </span>{" "}
            so far
          </span>
        </div>
      )}

      {/* ── View toggle ── */}
      <div className="flex items-center gap-2">
        <div className="flex rounded overflow-hidden border border-border/50">
          <button
            type="button"
            onClick={() => setView("days")}
            className={`px-2 py-0.5 font-mono text-[9px] tracking-wider transition-colors ${
              view === "days"
                ? "bg-muted/60 text-foreground"
                : "text-muted-foreground hover:text-foreground/70"
            }`}
          >
            14 days
          </button>
          <button
            type="button"
            onClick={() => setView("weeks")}
            className={`px-2 py-0.5 font-mono text-[9px] tracking-wider transition-colors border-l border-border/50 ${
              view === "weeks"
                ? "bg-muted/60 text-foreground"
                : "text-muted-foreground hover:text-foreground/70"
            }`}
          >
            by week
          </button>
        </div>
        <span className="font-mono text-[9px] text-muted-foreground/60">
          {view === "days" ? "dot = day logged" : "bar = week total · dashed = needed"}
        </span>
      </div>

      {/* ── 14-day dot grid ── */}
      {view === "days" && (
        <div className="flex items-center gap-2">
          <History className="h-3 w-3 text-muted-foreground/60 shrink-0" aria-hidden />
          <div className="flex gap-0.5 flex-wrap">
            {grid.map((d) => (
              <span
                key={d.date}
                title={
                  d.logged
                    ? `${d.date}: ${d.delta >= 0 ? "+" : ""}${d.delta} → ${d.value}`
                    : `${d.date}: no entry`
                }
                className={`h-3 w-3 rounded-sm transition-colors ${
                  d.logged
                    ? d.delta > 0
                      ? "bg-gold/80"
                      : d.delta < 0
                        ? "bg-destructive/70"
                        : "bg-gold/30"
                    : "bg-muted/40"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Weekly bar chart ── */}
      {view === "weeks" && (
        <div>
          {/* Bars */}
          <div
            className="relative flex items-end gap-0.5"
            style={{ height: `${BAR_H}px` }}
          >
            {/* Required-rate dashed reference line */}
            {reqLineH > 0 && (
              <div
                className="absolute left-0 right-0 border-t border-dashed border-gold/50 pointer-events-none z-10"
                style={{ bottom: `${reqLineH}px` }}
                aria-label={`Required: ${fmtRate(requiredWeeklyRate, goal.unit)}/week`}
              />
            )}

            {weeks.map((w) => {
              const barH =
                w.delta > 0
                  ? Math.max(3, Math.min(BAR_H, Math.round(w.delta * scale)))
                  : w.delta < 0
                    ? 4
                    : 2;

              const barColor =
                !w.logged
                  ? "bg-muted/25"
                  : w.delta < 0
                    ? "bg-destructive/70"
                    : w.delta >= requiredWeeklyRate && requiredWeeklyRate > 0
                      ? "bg-teal/70"
                      : w.delta >= requiredWeeklyRate * 0.7
                        ? "bg-gold/70"
                        : w.delta > 0
                          ? "bg-gold/35"
                          : "bg-muted/25";

              const sign = w.delta >= 0 ? "+" : "";
              const tipVal = w.logged
                ? `${sign}${fmtRate(w.delta, goal.unit)}`
                : "no entries";
              const tipLabel = w.isCurrentWeek
                ? `This week: ${tipVal}`
                : `${w.label}: ${tipVal}`;

              return (
                <div
                  key={w.weekStart}
                  className="flex-1 min-w-0 flex flex-col items-center justify-end"
                  style={{ height: `${BAR_H}px` }}
                >
                  <div
                    className={`w-full max-w-[22px] rounded-t-sm transition-all ${barColor} ${
                      w.isCurrentWeek ? "ring-1 ring-gold/60" : ""
                    }`}
                    style={{ height: `${barH}px` }}
                    title={tipLabel}
                  />
                </div>
              );
            })}
          </div>

          {/* Week labels row */}
          <div className="flex items-center gap-0.5 mt-0.5">
            {weeks.map((w) => (
              <div
                key={w.weekStart}
                className="flex-1 min-w-0 text-center font-mono text-[8px] text-muted-foreground/60 leading-none truncate"
              >
                {w.isCurrentWeek ? "now" : w.label.split(" ")[1]}
              </div>
            ))}
          </div>

          {/* Weekly summary below chart */}
          {requiredWeeklyRate > 0 && isFinite(requiredWeeklyRate) && (
            <div className="flex items-center justify-between mt-1 flex-wrap gap-1">
              <div className="flex items-center gap-2 text-[8px] font-mono text-muted-foreground/60">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-3 rounded-sm bg-teal/70" /> on/above target
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-3 rounded-sm bg-gold/40" /> below target
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-3 rounded-sm bg-destructive/70" /> setback
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Quick-log controls ── */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={(e) => apply(-1, e)}
          className="h-7 w-7 rounded border border-border bg-background/50 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors inline-flex items-center justify-center"
          aria-label="Subtract 1"
          title="Subtract 1 (setback / spending)"
        >
          <Minus className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={(e) => apply(1, e)}
          className="h-7 px-3 rounded border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 transition-colors inline-flex items-center justify-center gap-1 font-mono text-[10px] tracking-wider uppercase"
        >
          <Plus className="h-3 w-3" />
          {loggedToday ? "log again" : "log today"}
        </button>
        <Input
          type="number"
          placeholder="amount"
          aria-label="Log custom amount"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const v = Number((e.target as HTMLInputElement).value);
            if (!Number.isFinite(v) || v === 0) return;
            const next = logProgress({ goal, delta: v });
            onChange({
              current: next.current,
              progressLog: next.progressLog,
              lastCheckIn: next.lastCheckIn,
            });
            const xp = progressXp(v, goal.target as number);
            awardXp(xp, "progress", { goalCurrent: next.current, unit: goal.unit ?? "" });
            const u = goal.unit ? ` ${goal.unit}` : "";
            const remaining =
              goal.target != null
                ? ` · ${fmtRate(Math.max(0, goal.target - next.current), goal.unit)} remaining`
                : "";
            if (v > 0) {
              toast.success(`+${v}${u} logged${remaining}`, { duration: 2500 });
            } else {
              toast(`${v}${u} logged${remaining}`, {
                description: "Progress adjusted — no XP for setbacks.",
                duration: 3000,
              });
            }
            (e.target as HTMLInputElement).value = "";
          }}
          className="h-7 px-2 text-[11px] bg-background/50 border-border w-20"
        />
        {goal.lastCheckIn && (
          <span className="ml-auto font-mono text-[9px] tracking-wider text-muted-foreground/70">
            last: {goal.lastCheckIn}
          </span>
        )}
      </div>
    </div>
  );
}

function SuggestedNextRow({ goal }: { goal: Goal }) {
  const suggestion = suggestNext(goal);
  const { toast } = useToast();
  const [added, setAdded] = useState(() =>
    suggestion ? isSuggestionAdded(suggestion.dedupeKey) : false,
  );

  if (!suggestion) return null;

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const start = new Date(suggestion.dueDate);
    const end = new Date(start.getTime() + 15 * 60_000);
    const draft: Omit<AgendaEvent, "id" | "source"> = {
      title: suggestion.taskTitle,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: false,
      description: `Auto-suggested next step on goal "${goal.title}".`,
      calendarName: isGoogleConnected() ? "Google Calendar" : "Local",
      calendarColor: "hsl(45 80% 55%)",
      emoji: suggestion.kind === "quantitative" ? "🎯" : "✨",
    };
    try {
      if (isGoogleConnected()) {
        await createGoogleEvent(draft);
      } else {
        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `sug_${Date.now()}`;
        addLocalEvent({ ...draft, id, source: "manual" });
      }
      markSuggestionAdded(suggestion.dedupeKey);
      setAdded(true);
      toast({
        title: "Added to your agenda",
        description: `${suggestion.taskTitle} · Sun ${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      });
    } catch (err) {
      toast({
        title: "Could not add",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  const statusTone =
    suggestion.status === "behind_critical" || suggestion.status === "missing"
      ? "text-destructive"
      : suggestion.status === "behind"
        ? "text-orange-400"
        : suggestion.status === "ahead"
          ? "text-gold"
          : "text-teal";
  const statusLabel =
    suggestion.status === "ahead"
      ? "Ahead of pace"
      : suggestion.status === "on_pace"
        ? "On pace"
        : suggestion.status === "behind"
          ? "Behind"
          : suggestion.status === "behind_critical"
            ? "Falling behind"
            : "No progress yet";

  return (
    <div
      className="mt-2 rounded-md border border-gold/20 bg-gold/5 px-3 py-2 space-y-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <Sparkles className="h-3 w-3 text-gold shrink-0" aria-hidden />
        <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-gold/80">
          Next
        </span>
        <span className={`font-mono text-[9px] tracking-[0.2em] uppercase ${statusTone}`}>
          · {statusLabel}
        </span>
      </div>
      <p className="text-[11px] leading-snug text-foreground">
        {suggestion.headline}
      </p>
      {suggestion.rationale && (
        <p className="font-mono text-[9px] text-muted-foreground/80 leading-snug">
          {suggestion.rationale}
        </p>
      )}
      <div className="flex justify-end">
        {added ? (
          <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
            Added to Sunday
          </span>
        ) : (
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-1 rounded border border-gold/40 bg-gold/10 px-2 py-0.5 font-mono text-[9px] tracking-[0.2em] uppercase text-gold hover:bg-gold/20 transition-colors"
          >
            <Plus className="h-2.5 w-2.5" />
            Add to agenda
          </button>
        )}
      </div>
    </div>
  );
}
