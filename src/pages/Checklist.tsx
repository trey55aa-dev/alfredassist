import { RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { todayKey, weekKey } from "@/lib/alfred";
import { STREAK_KEY, StreakState, emptyStreak, reconcileToday } from "@/lib/streak";
import { useEffect, useMemo } from "react";

export interface ChecklistState {
  date: string;
  week?: string;
  daily: Record<string, boolean>;
  weekly: Record<string, boolean>;
}

export const DAILY = [
  "Morning hydration & stretch",
  "Review top 3 priorities",
  "Deep work block — 90 min",
  "Train body (mobility / lift / run)",
  "Read or skill study — 30 min",
  "Inbox to zero",
  "Evening shutdown ritual",
];

export const DAILY_TOTAL = DAILY.length;

const WEEKLY = [
  "Weekly review — wins & losses",
  "Plan next week's priorities",
  "Long training session",
  "Meal prep & groceries",
  "Connect with one person",
  "Financial check-in",
];

export default function Checklist() {
  const [state, setState] = useLocalStorage<ChecklistState>("alfred.checklist", {
    date: todayKey(),
    week: weekKey(),
    daily: {},
    weekly: {},
  });

  // Auto-reset when day/week changes
  useEffect(() => {
    const today = todayKey();
    const wk = weekKey();
    if (state.date !== today || state.week !== wk) {
      setState({
        date: today,
        week: wk,
        daily: state.date === today ? state.daily : {},
        weekly: state.week === wk ? state.weekly : {},
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (kind: "daily" | "weekly", item: string) => {
    setState({
      ...state,
      [kind]: { ...state[kind], [item]: !state[kind][item] },
    });
  };

  const dailyDone = useMemo(() => DAILY.filter((d) => state.daily[d]).length, [state]);
  const weeklyDone = useMemo(() => WEEKLY.filter((d) => state.weekly[d]).length, [state]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Daily protocol"
        title="The Checklist"
        description="Tick the items as you proceed. Resets automatically with the dawn."
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <Section
          title="Daily Rituals"
          subtitle={`${dailyDone}/${DAILY.length} complete`}
          progress={(dailyDone / DAILY.length) * 100}
          items={DAILY}
          checks={state.daily}
          onToggle={(i) => toggle("daily", i)}
          onReset={() => setState({ ...state, daily: {} })}
        />
        <Section
          title="Weekly Anchors"
          subtitle={`${weeklyDone}/${WEEKLY.length} complete`}
          progress={(weeklyDone / WEEKLY.length) * 100}
          items={WEEKLY}
          checks={state.weekly}
          onToggle={(i) => toggle("weekly", i)}
          onReset={() => setState({ ...state, weekly: {} })}
        />
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  progress,
  items,
  checks,
  onToggle,
  onReset,
}: {
  title: string;
  subtitle: string;
  progress: number;
  items: string[];
  checks: Record<string, boolean>;
  onToggle: (i: string) => void;
  onReset: () => void;
}) {
  return (
    <Card className="p-6 bg-gradient-card border-border">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display text-2xl">{title}</h3>
          <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-muted-foreground mt-1">
            {subtitle}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onReset}
          className="text-muted-foreground hover:text-gold"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
        </Button>
      </div>
      <Progress value={progress} className="h-1.5 mb-5" />
      <ul className="space-y-2">
        {items.map((it) => {
          const done = !!checks[it];
          return (
            <li
              key={it}
              onClick={() => onToggle(it)}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-all ${
                done ? "bg-muted/40" : "hover:bg-muted/30"
              }`}
            >
              <Checkbox
                checked={done}
                onCheckedChange={() => onToggle(it)}
                className="border-gold/40 data-[state=checked]:bg-gold data-[state=checked]:text-primary-foreground"
              />
              <span
                className={`text-sm ${
                  done ? "line-through text-muted-foreground" : "text-foreground"
                }`}
              >
                {it}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
