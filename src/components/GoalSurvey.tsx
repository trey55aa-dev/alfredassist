import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Sparkles, Check, Wand2, Flag, RefreshCw, Trophy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type GoalSurvey,
  type Goal,
  BREAKDOWN_OPTIONS,
  MISS_RULE_OPTIONS,
} from "@/lib/goals";

const INPUT =
  "w-full rounded-lg bg-background/40 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-gold/40 focus:ring-1 focus:ring-gold/20 outline-none transition-colors";

function Question({
  icon: Icon,
  n,
  q,
  children,
}: {
  icon: React.ElementType;
  n: number;
  q: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="h-6 w-6 rounded-lg bg-gold/15 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="h-3.5 w-3.5 text-gold" />
        </div>
        <div>
          <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground/60">
            Question {n} of 4
          </div>
          <div className="text-sm font-medium text-foreground leading-snug">{q}</div>
        </div>
      </div>
      <div className="pl-8">{children}</div>
    </div>
  );
}

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value?: string;
  onChange: (v: string) => void;
}) {
  const isPreset = value != null && (options as readonly string[]).includes(value);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = value === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-mono tracking-wide border transition-all ${
                active
                  ? "bg-gold text-primary-foreground border-gold"
                  : "bg-background/40 border-border text-muted-foreground hover:border-gold/40 hover:text-foreground"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
      <input
        value={isPreset ? "" : value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or describe your own"
        className={INPUT}
      />
    </div>
  );
}

/** The 4-question blueprint form — reused by the creation dialog and inline editing. */
export function GoalSurveyForm({
  value,
  onChange,
  deadline,
  suggestion,
}: {
  value: GoalSurvey;
  onChange: (next: GoalSurvey) => void;
  deadline?: string;
  suggestion?: string;
}) {
  const set = (patch: Partial<GoalSurvey>) =>
    onChange({ ...value, ...patch, updatedAt: Date.now() });
  const byLabel = deadline ? format(new Date(deadline), "MMM d, yyyy") : "your deadline";

  return (
    <div className="space-y-5">
      <Question icon={Flag} n={1} q={`What does this look like by ${byLabel}?`}>
        <textarea
          value={value.vision ?? ""}
          onChange={(e) => set({ vision: e.target.value })}
          rows={2}
          placeholder="Paint the picture — e.g. I can run 5K nonstop, feeling strong."
          className={`${INPUT} resize-none`}
        />
      </Question>

      <Question icon={Wand2} n={2} q="How should I break this down?">
        {suggestion && value.breakdown == null && (
          <button
            type="button"
            onClick={() => set({ breakdown: suggestion })}
            className="mb-2 inline-flex items-center gap-1 rounded-md bg-teal/10 border border-teal/30 px-2 py-1 text-[10px] font-mono text-teal hover:bg-teal/20 transition-colors"
          >
            <Sparkles className="h-3 w-3" /> You usually pick “{suggestion}” — tap to use
          </button>
        )}
        <ChipRow
          options={BREAKDOWN_OPTIONS}
          value={value.breakdown}
          onChange={(v) => set({ breakdown: v })}
        />
      </Question>

      <Question icon={RefreshCw} n={3} q="How should I count misses or relapses?">
        <ChipRow
          options={MISS_RULE_OPTIONS}
          value={value.missRule}
          onChange={(v) => set({ missRule: v })}
        />
      </Question>

      <Question icon={Trophy} n={4} q="Then what — once it's done, or if it isn't?">
        <div className="grid sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="font-mono text-[9px] tracking-wider uppercase text-teal">
              If I reach it →
            </label>
            <input
              value={value.ifReached ?? ""}
              onChange={(e) => set({ ifReached: e.target.value })}
              placeholder="reward / next goal"
              className={INPUT}
            />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[9px] tracking-wider uppercase text-coral">
              If I fall short →
            </label>
            <input
              value={value.ifMissed ?? ""}
              onChange={(e) => set({ ifMissed: e.target.value })}
              placeholder="adjust / try again"
              className={INPUT}
            />
          </div>
        </div>
      </Question>
    </div>
  );
}

/** Fast, skippable blueprint dialog shown right after a goal is created. */
export function GoalSurveyDialog({
  goal,
  open,
  onClose,
  onSave,
  suggestion,
}: {
  goal: Goal | null;
  open: boolean;
  onClose: () => void;
  onSave: (survey: GoalSurvey) => void;
  suggestion?: string;
}) {
  const [draft, setDraft] = useState<GoalSurvey>({});

  useEffect(() => {
    if (open) setDraft(goal?.survey ?? {});
  }, [open, goal?.id]);

  if (!goal) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md bg-background/95 border-border/60 backdrop-blur-xl max-h-[90vh] overflow-y-auto animate-scale-in">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" /> Goal Blueprint
          </DialogTitle>
        </DialogHeader>
        <p className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground/70 -mt-2 mb-1">
          {goal.title} · ~2 min · helps Alfred coach you
        </p>

        <GoalSurveyForm
          value={draft}
          onChange={setDraft}
          deadline={goal.deadline}
          suggestion={suggestion}
        />

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border/60 py-2.5 text-xs font-mono tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={() => onSave(draft)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gold text-primary-foreground py-2.5 text-xs font-mono tracking-wider uppercase font-semibold hover:bg-gold-soft active:scale-[0.98] transition-all"
          >
            <Check className="h-3.5 w-3.5" /> Save blueprint
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
