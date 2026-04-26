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
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { BackupRestore } from "@/components/BackupRestore";
import {
  CATEGORIES,
  GOALS_KEY,
  Goal,
  GoalCategory,
  GoalQuarter,
  GoalSubStep,
  GoalTimeframe,
  QUARTERS,
  QUARTER_RANGES,
  SEED_GOALS,
  SubStepStatus,
  TIMEFRAMES,
  appendStatusEvent,
  daysUntil,
  progressPct,
} from "@/lib/goals";
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
  const [goals, setGoals] = useLocalStorage<Goal[]>(GOALS_KEY, SEED_GOALS);
  const [brain] = useLocalStorage<BrainEntry[]>("alfred.brain", []);
  const [view, setView] = useState<"all" | "quarters" | "timeframe">("all");

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

  const totalDone = safeGoals.filter((g) => g.done).length;
  const overallPct = safeGoals.length
    ? Math.round((totalDone / safeGoals.length) * 100)
    : 0;

  const update = (id: string, patch: Partial<Goal>) =>
    setGoals(safeGoals.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const toggle = (id: string) =>
    update(id, { done: !safeGoals.find((g) => g.id === id)?.done });
  const remove = (id: string) => setGoals(safeGoals.filter((g) => g.id !== id));

  const addGoal = (g: Omit<Goal, "id" | "createdAt">) => {
    setGoals([
      ...safeGoals,
      { ...g, id: crypto.randomUUID(), createdAt: Date.now() },
    ]);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="The year ahead"
        title="2026 Goals"
        description="Define the campaign. Set deadlines. Conquer by quarter."
        actions={
          <div className="flex flex-wrap gap-2">
            <BackupRestore />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm("Reset all 2026 goals to defaults?")) setGoals(SEED_GOALS);
              }}
              className="border-border text-muted-foreground hover:text-gold"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
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
              {totalDone} of {safeGoals.length} conquered
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
              const items = safeGoals.filter((g) => g.category === cat);
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
              const items = safeGoals.filter((g) => g.quarter === q);
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
            {safeGoals.some((g) => !g.quarter) && (
              <QuarterCard
                quarter={null}
                items={safeGoals.filter((g) => !g.quarter)}
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
              const items = safeGoals.filter((g) => g.timeframe === tf);
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
      unit: unit.trim() || undefined,
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
          placeholder="A new ambition…"
          className="bg-background/40 border-border focus-visible:ring-gold/40 focus-visible:border-gold/40"
        />
        <Button onClick={submit} className="bg-gold text-primary-foreground hover:bg-gold-soft">
          <Plus className="h-4 w-4 mr-1" /> Add Goal
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
        <div className="flex gap-1">
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Target"
            type="number"
            className="bg-background/40 border-border text-xs"
          />
          <Input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="unit"
            className="bg-background/40 border-border text-xs w-20"
          />
        </div>
      </div>
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
                  {format(new Date(goal.deadline), "MMM d")}
                  {days !== null && (days < 0 ? " · overdue" : ` · ${days}d`)}
                </Badge>
              )}
              {linked.length > 0 && (
                <Badge variant="muted">
                  <Brain className="h-2.5 w-2.5 mr-1 inline" />
                  {linked.length}
                </Badge>
              )}
            </div>
            {measurable && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-gold transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] tracking-wider text-gold whitespace-nowrap">
                  {goal.current ?? 0}/{goal.target}
                  {goal.unit ? ` ${goal.unit}` : ""}
                </span>
              </div>
            )}
          </button>

          {open && (
            <div className="mt-3 space-y-3 fade-in">
              <div className="grid grid-cols-2 gap-2">
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
              {measurable && (
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
    setStepStatus(id, target.done ? "pending" : "done");
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
}: {
  schedule: ReturnType<typeof buildSchedule>;
  toggleStep: (id: string) => void;
  patchStep: (id: string, patch: Partial<GoalSubStep>) => void;
}) {
  return (
    <ol className="space-y-1.5">
      {schedule.steps.map(({ step: s, index: i, status, slip, startWeek, duration }) => {
        const meta = STATUS_META[status];
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
              onPatch={(p) => patchStep(s.id, p)}
            />
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
  onPatch,
}: {
  step: GoalSubStep;
  startWeek: number;
  duration: number;
  slip: number;
  status: SubStepStatus;
  onPatch: (patch: Partial<GoalSubStep>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5 pl-6">
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
        onChange={(e) =>
          onPatch({ status: e.target.value as SubStepStatus })
        }
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
