import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GoalSurveyForm } from "@/components/GoalSurvey";
import { ScenePicker } from "@/components/ScenePicker";
import {
  CATEGORIES,
  CATEGORY_DEFAULT_EMOJI,
  QUARTERS,
  quarterEnd,
  quarterFromDate,
  type Goal,
  type GoalCategory,
  type GoalSubStep,
  type GoalSurvey,
  type SubStepStatus,
} from "@/lib/goals";
import type { Habit } from "@/lib/habits";
import { supabase } from "@/integrations/supabase/client";

/** Set once the wizard finishes or is skipped — never nag again on this device. */
export const ONBOARDED_KEY = "alfred.onboarded";

/* ---------- starter habits per category ---------- */

const STARTER_HABITS: Record<GoalCategory, string[]> = {
  Body:   ["Train 30 minutes", "Morning stretch", "10k steps", "Sleep by 11pm"],
  Career: ["Deep work block — 90 min", "Review top 3 priorities", "Inbox to zero", "Learn 20 min in my field"],
  Money:  ["Log today's spending", "No-spend check-in", "Move $5 to savings", "Review one subscription"],
  Skills: ["Practice 30 minutes", "Read 20 minutes", "One lesson a day", "Ship something small"],
  Life:   ["Evening shutdown ritual", "Journal 5 minutes", "Call someone I love", "15 min outside"],
};

/* ---------- deadline quick-picks ---------- */

interface TimelineOption {
  label: string;
  iso?: string;
}

function timelineOptions(now = new Date()): TimelineOption[] {
  const y = now.getFullYear();
  const q = quarterFromDate(now);
  const qi = QUARTERS.indexOf(q);
  const thisQ = quarterEnd(q, y);
  const nextQ = qi === 3 ? quarterEnd("Q1", y + 1) : quarterEnd(QUARTERS[qi + 1], y);
  const yearEnd = new Date(y, 11, 31, 23, 59, 59);
  return [
    { label: `This quarter · ${format(thisQ, "MMM d")}`, iso: thisQ.toISOString() },
    { label: `Next quarter · ${format(nextQ, "MMM d")}`, iso: nextQ.toISOString() },
    { label: `By year-end · Dec 31`, iso: yearEnd.toISOString() },
    { label: "No deadline yet" },
  ];
}

/* ---------- wizard ---------- */

export function OnboardingWizard({
  goals,
  setGoals,
  habits,
  setHabits,
  onDone,
}: {
  goals: Goal[];
  setGoals: (next: Goal[]) => void;
  habits: Habit[];
  setHabits: (next: Habit[]) => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<GoalCategory>("Body");
  const [deadline, setDeadline] = useState<string | undefined>(undefined);
  const [deadlineIdx, setDeadlineIdx] = useState<number | null>(null);
  const [survey, setSurvey] = useState<GoalSurvey>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [customHabit, setCustomHabit] = useState("");

  const timelines = useMemo(() => timelineOptions(), []);
  const starters = STARTER_HABITS[category];

  const [finishing, setFinishing] = useState(false);

  const markDone = () => {
    try { localStorage.setItem(ONBOARDED_KEY, "1"); } catch { /* quota */ }
    onDone();
  };

  const skip = () => markDone();

  /** Best-effort AI plan for the new goal. Never blocks onboarding — returns
   *  undefined on any error/timeout so the goal is still created. */
  const draftPlan = async (): Promise<Pick<Goal, "subSteps" | "planSummary"> | undefined> => {
    const ctx: string[] = [];
    if (survey.vision) ctx.push(`Definition of done: ${survey.vision}`);
    if (survey.breakdown) ctx.push(`Preferred breakdown style (follow this): ${survey.breakdown}`);
    if (survey.missRule) ctx.push(`How they handle misses: ${survey.missRule}`);
    if (survey.details) {
      for (const [k, v] of Object.entries(survey.details)) if (v?.trim()) ctx.push(`Detail [${k}]: ${v}`);
    }
    try {
      const invoke = supabase.functions.invoke("breakdown-goal", {
        body: {
          goal: { title: title.trim(), category, timeframe: "annual", deadline },
          context: ctx.join("\n"),
        },
      });
      const timeout = new Promise<{ data: null }>((res) => setTimeout(() => res({ data: null }), 14000));
      const result = await Promise.race([invoke, timeout]);
      const data = (result as { data: { summary?: string; steps?: { title: string; detail?: string; durationWeeks?: number }[] } | null }).data;
      if (!data?.steps?.length) return undefined;
      const nowIso = new Date().toISOString();
      const subSteps: GoalSubStep[] = data.steps.map((s) => ({
        id: crypto.randomUUID(),
        title: s.title,
        detail: s.detail,
        durationWeeks: s.durationWeeks,
        done: false,
        status: "pending" as SubStepStatus,
        statusHistory: [{ status: "pending" as SubStepStatus, at: nowIso }],
      }));
      return { subSteps, planSummary: data.summary };
    } catch {
      return undefined; // AI unreachable (not deployed / no credits) — skip the plan
    }
  };

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    const now = Date.now();
    const goalId = crypto.randomUUID();
    const hasSurvey = Object.keys(survey).some(
      (k) => k !== "updatedAt" && (survey as Record<string, unknown>)[k],
    );

    const plan = title.trim() ? await draftPlan() : undefined;

    const goal: Goal = {
      id: goalId,
      title: title.trim(),
      category,
      timeframe: "annual",
      quarter: null,
      deadline,
      survey: hasSurvey ? survey : undefined,
      subSteps: plan?.subSteps,
      planSummary: plan?.planSummary,
      planStartDate: plan ? new Date().toISOString() : undefined,
      done: false,
      createdAt: now,
      localUpdatedAt: now,
    };
    setGoals([...goals, goal]);

    if (picked.length > 0) {
      const newHabits: Habit[] = picked.map((t) => ({
        id: crypto.randomUUID(),
        title: t,
        cadence: "daily",
        goalId,
        createdAt: now,
      }));
      setHabits([...habits, ...newHabits]);
    }
    markDone();
  };

  const togglePick = (t: string) =>
    setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const addCustom = () => {
    const t = customHabit.trim();
    if (!t) return;
    if (!picked.includes(t)) setPicked((p) => [...p, t]);
    setCustomHabit("");
  };

  const stepTitle = ["Choose your look", "Set your first goal", "Your goal blueprint", "Build the daily protocol"][step];

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !finishing) skip(); }}>
      <DialogContent className="max-w-md bg-background/95 border-border/60 backdrop-blur-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" /> Welcome — {stepTitle}
          </DialogTitle>
        </DialogHeader>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 -mt-1 mb-1">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-gold" : i < step ? "w-3 bg-gold/50" : "w-3 bg-muted"
              }`}
            />
          ))}
          <span className="ml-auto font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60">
            Step {step + 1} of 4 · ~1 min
          </span>
        </div>

        {/* ── Step 1: choose a look ── */}
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground/80">
              First, make it yours. Pick a background — you can change it any time
              from the sidebar.
            </p>
            <ScenePicker />
          </div>
        )}

        {/* ── Step 2: the goal ── */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground/80">
              Alfred plans your days around your goals. Start with the one that
              matters most — you can add the rest later.
            </p>

            <div className="flex items-center gap-3">
              <span className="goal-emoji text-4xl shrink-0" aria-hidden>
                {CATEGORY_DEFAULT_EMOJI[category]}
              </span>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Run a 5K, Save $5,000, Learn guitar…"
                className="flex-1 rounded-xl bg-background/40 border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-gold/40 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              />
            </div>

            <div>
              <p className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60 mb-2">
                What kind of goal?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-mono tracking-wide border transition-all ${
                      category === c
                        ? "bg-gold text-primary-foreground border-gold"
                        : "bg-background/40 border-border text-muted-foreground hover:border-gold/40 hover:text-foreground"
                    }`}
                  >
                    {CATEGORY_DEFAULT_EMOJI[c]} {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60 mb-2">
                When do you want it done?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {timelines.map((t, i) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => { setDeadline(t.iso); setDeadlineIdx(i); }}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-mono tracking-wide border transition-all ${
                      deadlineIdx === i
                        ? "bg-gold text-primary-foreground border-gold"
                        : "bg-background/40 border-border text-muted-foreground hover:border-gold/40 hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: the blueprint (reuses the survey) ── */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground/80">
              A few taps so Alfred can coach “{title.trim()}” the way you work.
              All optional.
            </p>
            <GoalSurveyForm value={survey} onChange={setSurvey} deadline={deadline} />
          </div>
        )}

        {/* ── Step 4: starter habits ── */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground/80">
              Goals move when days move. Pick a couple of daily habits to power
              “{title.trim()}” — they'll show on your checklist with streaks.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {starters.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => togglePick(t)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-mono tracking-wide border transition-all ${
                    picked.includes(t)
                      ? "bg-teal text-background border-teal"
                      : "bg-background/40 border-border text-muted-foreground hover:border-teal/40 hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
              {picked
                .filter((t) => !starters.includes(t))
                .map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => togglePick(t)}
                    className="rounded-full px-3 py-1.5 text-[11px] font-mono tracking-wide border bg-teal text-background border-teal"
                  >
                    {t}
                  </button>
                ))}
            </div>
            <div className="flex gap-2">
              <input
                value={customHabit}
                onChange={(e) => setCustomHabit(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustom()}
                placeholder="…or add your own habit"
                className="flex-1 rounded-xl bg-background/40 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-teal/40 focus:ring-1 focus:ring-teal/20 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={addCustom}
                className="shrink-0 h-9 w-9 rounded-xl border border-teal/40 bg-teal/10 text-teal hover:bg-teal/25 transition-colors flex items-center justify-center"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {picked.length > 0 && (
              <p className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60">
                {picked.length} habit{picked.length === 1 ? "" : "s"} → linked to this goal
              </p>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex items-center gap-2 pt-2">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={finishing}
              className="inline-flex items-center gap-1 rounded-xl border border-border/60 px-3 py-2.5 text-xs font-mono tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          ) : (
            <button
              onClick={skip}
              className="rounded-xl px-3 py-2.5 text-xs font-mono tracking-wider uppercase text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              Skip — I'll explore
            </button>
          )}
          <div className="flex-1" />
          {step < 3 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 && !title.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gold text-primary-foreground px-4 py-2.5 text-xs font-mono tracking-wider uppercase font-semibold hover:bg-gold-soft active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={finishing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gold text-primary-foreground px-4 py-2.5 text-xs font-mono tracking-wider uppercase font-semibold hover:bg-gold-soft active:scale-[0.98] transition-all disabled:opacity-80 disabled:pointer-events-none"
            >
              {finishing ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Drafting your plan…</>
              ) : (
                <><Check className="h-3.5 w-3.5" /> Start my campaign</>
              )}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
