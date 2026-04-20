import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  Dumbbell,
  Briefcase,
  Wallet,
  BookOpen,
  Heart,
  Sparkles,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";

type Category = "Body" | "Career" | "Money" | "Skills" | "Life";

interface Goal {
  id: string;
  title: string;
  category: Category;
  target?: number; // for measurable goals
  current?: number; // for measurable goals
  unit?: string;
  done: boolean;
  note?: string;
}

const CATEGORY_META: Record<
  Category,
  { icon: typeof Dumbbell; tint: string }
> = {
  Body: { icon: Dumbbell, tint: "text-teal" },
  Career: { icon: Briefcase, tint: "text-gold" },
  Money: { icon: Wallet, tint: "text-gold" },
  Skills: { icon: BookOpen, tint: "text-teal" },
  Life: { icon: Heart, tint: "text-gold" },
};

const SEED: Goal[] = [
  // Body
  { id: "g1", title: "Run a 5K", category: "Body", done: false },
  { id: "g2", title: "Compete in a Hyrox event", category: "Body", done: false },
  { id: "g3", title: "100 push-ups straight", category: "Body", target: 100, current: 0, unit: "reps", done: false },
  { id: "g4", title: "90 days no fap / no porn", category: "Body", target: 90, current: 0, unit: "days", done: false },
  { id: "g5", title: "Learn to dance", category: "Body", done: false },

  // Career
  { id: "g6", title: "Get a job", category: "Career", done: false },
  { id: "g7", title: "Start a business", category: "Career", done: false },
  { id: "g8", title: "Build a daily schedule", category: "Career", done: false },

  // Money
  { id: "g9", title: "Save $15,000", category: "Money", target: 15000, current: 0, unit: "$", done: false },
  { id: "g10", title: "$3,500+ in stocks", category: "Money", target: 3500, current: 0, unit: "$", done: false },
  { id: "g11", title: "Pay off credit card", category: "Money", done: false },
  { id: "g12", title: "$9,000 in checking", category: "Money", target: 9000, current: 0, unit: "$", done: false },

  // Skills
  { id: "g13", title: "Type fluently — 50 WPM", category: "Skills", target: 50, current: 0, unit: "wpm", done: false },
  { id: "g14", title: "Read 12 books", category: "Skills", target: 12, current: 0, unit: "books", done: false },
  { id: "g15", title: "Improve writing", category: "Skills", done: false },
  { id: "g16", title: "Learn to sew", category: "Skills", done: false },
  { id: "g17", title: "Learn to build", category: "Skills", done: false },
  { id: "g18", title: "Learn fashion design", category: "Skills", done: false },
  { id: "g19", title: "Master 10 recipes & fill recipe book", category: "Skills", target: 10, current: 0, unit: "recipes", done: false },

  // Life
  { id: "g20", title: "Take a personal trip", category: "Life", done: false },
  { id: "g21", title: "Take a trip with bae", category: "Life", done: false },
  { id: "g22", title: "Get a new phone", category: "Life", done: false },
  { id: "g23", title: "Look for a ring for Kayla", category: "Life", done: false },
];

const CATEGORIES: Category[] = ["Body", "Career", "Money", "Skills", "Life"];

export default function Goals2026() {
  const [goals, setGoals] = useLocalStorage<Goal[]>("alfred.goals2026", SEED);
  const [filter, setFilter] = useState<Category | "All">("All");
  const [newTitle, setNewTitle] = useState("");
  const [newCat, setNewCat] = useState<Category>("Life");

  const visible = useMemo(
    () => (filter === "All" ? goals : goals.filter((g) => g.category === filter)),
    [goals, filter]
  );

  const totalDone = goals.filter((g) => g.done).length;
  const overallPct = Math.round((totalDone / goals.length) * 100);

  const toggle = (id: string) =>
    setGoals(goals.map((g) => (g.id === id ? { ...g, done: !g.done } : g)));

  const updateGoal = (id: string, patch: Partial<Goal>) =>
    setGoals(goals.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  const remove = (id: string) => setGoals(goals.filter((g) => g.id !== id));

  const add = () => {
    if (!newTitle.trim()) return;
    setGoals([
      ...goals,
      { id: crypto.randomUUID(), title: newTitle.trim(), category: newCat, done: false },
    ]);
    setNewTitle("");
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="The year ahead"
        title="2026 Goals"
        description="The campaign for the year. Define it, measure it, conquer it."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Reset all 2026 goals to defaults?")) setGoals(SEED);
            }}
            className="border-border text-muted-foreground hover:text-gold"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
          </Button>
        }
      />

      {/* Overall progress */}
      <Card className="p-6 bg-gradient-card border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display text-2xl">Campaign Progress</h3>
            <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-muted-foreground mt-1">
              {totalDone} of {goals.length} conquered
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

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {(["All", ...CATEGORIES] as const).map((c) => {
          const active = filter === c;
          const count =
            c === "All" ? goals.length : goals.filter((g) => g.category === c).length;
          return (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-3 py-1.5 rounded-md font-mono text-[11px] tracking-[0.2em] uppercase transition-all ${
                active
                  ? "bg-gold text-primary-foreground shadow-gold"
                  : "bg-muted/40 text-muted-foreground hover:text-gold hover:bg-muted/60"
              }`}
            >
              {c} <span className="opacity-60">· {count}</span>
            </button>
          );
        })}
      </div>

      {/* Add new goal */}
      <Card className="p-4 bg-gradient-card border-border">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Add a new ambition…"
            className="bg-background/40 border-border focus-visible:ring-gold/40 focus-visible:border-gold/40"
          />
          <select
            value={newCat}
            onChange={(e) => setNewCat(e.target.value as Category)}
            className="bg-background/40 border border-border rounded-md px-3 py-2 text-sm font-mono uppercase tracking-wider text-foreground focus:outline-none focus:ring-2 focus:ring-gold/40"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button
            onClick={add}
            className="bg-gold text-primary-foreground hover:bg-gold-soft"
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </Card>

      {/* Grouped goals */}
      <div className="grid lg:grid-cols-2 gap-6">
        {(filter === "All" ? CATEGORIES : [filter]).map((cat) => {
          const items = visible.filter((g) => g.category === cat);
          if (items.length === 0 && filter !== "All") return null;
          if (items.length === 0) return null;
          const done = items.filter((g) => g.done).length;
          const pct = Math.round((done / items.length) * 100);
          const Meta = CATEGORY_META[cat];
          const Icon = Meta.icon;

          return (
            <Card key={cat} className="p-6 bg-gradient-card border-border">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-muted/50 flex items-center justify-center">
                    <Icon className={`h-5 w-5 ${Meta.tint}`} />
                  </div>
                  <div>
                    <h3 className="font-display text-2xl">{cat}</h3>
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
                    onToggle={() => toggle(g.id)}
                    onChange={(patch) => updateGoal(g.id, patch)}
                    onDelete={() => remove(g.id)}
                  />
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function GoalRow({
  goal,
  onToggle,
  onChange,
  onDelete,
}: {
  goal: Goal;
  onToggle: () => void;
  onChange: (patch: Partial<Goal>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const measurable = typeof goal.target === "number";
  const pct = measurable
    ? Math.min(100, Math.round(((goal.current ?? 0) / (goal.target || 1)) * 100))
    : 0;

  return (
    <li className="rounded-md bg-background/30 border border-border/60 hover:border-gold/30 transition-all">
      <div className="flex items-start gap-3 p-3">
        <Checkbox
          checked={goal.done}
          onCheckedChange={onToggle}
          className="mt-0.5 border-gold/40 data-[state=checked]:bg-gold data-[state=checked]:text-primary-foreground"
        />
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-left w-full"
          >
            <div
              className={`text-sm leading-snug ${
                goal.done ? "line-through text-muted-foreground" : "text-foreground"
              }`}
            >
              {goal.title}
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
            <div className="mt-3 space-y-2 fade-in">
              {measurable && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={goal.current ?? 0}
                    onChange={(e) =>
                      onChange({ current: Number(e.target.value) || 0 })
                    }
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
