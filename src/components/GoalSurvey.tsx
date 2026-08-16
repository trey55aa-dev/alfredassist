import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Sparkles, Check, Wand2, Flag, RefreshCw, Trophy, Shuffle } from "lucide-react";
import { REWARD_TAGS, getRewardPrefs, toggleRewardPref, suggestRewards, type RewardTag } from "@/lib/rewards";
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
  VISION_OPTIONS,
  REACH_OPTIONS,
  MISS_OUTCOME_OPTIONS,
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

/* ---------- follow-up sub-questions ----------
   When a main choice is made, drill into the what / why / how behind it. MC
   sub-questions (with `options`) stay fast; ones without options are open-ended
   for going deeper. Answers are stored in survey.details keyed by `key`. */

interface SubQuestion {
  key: string;
  q: string;
  options?: readonly string[]; // present → multiple choice; absent → open text
}

const VISION_SUBQ: SubQuestion[] = [
  { key: "vision.sign", q: "What's the clearest sign you've made it? (optional)" },
];

const BREAKDOWN_SUBQ: SubQuestion[] = [
  { key: "bd.session", q: "How long per work session?", options: ["15 min", "30 min", "1 hour", "2+ hours"] },
  { key: "bd.when", q: "Best time of day?", options: ["Morning", "Midday", "Evening", "Whenever I can"] },
];

const MISS_SUBQ: SubQuestion[] = [
  { key: "miss.what", q: "What counts as a miss?", options: ["Skipping a day", "Going under target", "Breaking a rule", "Not logging it"] },
  { key: "miss.then", q: "When you miss, what should happen?", options: ["Reset to zero", "Lose that day only", "Note it & continue", "Pause until I restart"] },
  { key: "miss.why", q: "Why this approach? (optional)" },
];

const REACH_SUBQ: SubQuestion[] = [
  { key: "reach.how", q: "Anything specific in mind? (optional)" },
];

/** One compact follow-up — chips (teal accent, to distinguish from the gold main
 *  answers) or a single open-ended line. */
function SubQ({
  sq,
  value,
  onChange,
}: {
  sq: SubQuestion;
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60">
        {sq.q}
      </div>
      {sq.options ? (
        <div className="flex flex-wrap gap-1.5">
          {sq.options.map((o) => {
            const active = value === o;
            return (
              <button
                key={o}
                type="button"
                onClick={() => onChange(o)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-mono border transition-all ${
                  active
                    ? "bg-teal text-background border-teal"
                    : "bg-background/40 border-border/60 text-muted-foreground hover:border-teal/40 hover:text-foreground"
                }`}
              >
                {o}
              </button>
            );
          })}
        </div>
      ) : (
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer…"
          className={INPUT}
        />
      )}
    </div>
  );
}

/** The indented block of follow-ups shown once a main question is answered. */
function SubQuestions({
  items,
  details,
  onChange,
}: {
  items: SubQuestion[];
  details: Record<string, string> | undefined;
  onChange: (key: string, val: string) => void;
}) {
  return (
    <div className="mt-2.5 pl-3 border-l-2 border-teal/25 space-y-2.5 fade-in">
      {items.map((sq) => (
        <SubQ key={sq.key} sq={sq} value={details?.[sq.key]} onChange={(v) => onChange(sq.key, v)} />
      ))}
    </div>
  );
}

/**
 * Shown only when "Celebrate & reward myself" is picked. Lets the user tell
 * Alfred what they enjoy (once, editable anytime) and offers concrete ideas
 * matched to that instead of a blank "anything specific in mind?" box.
 */
function RewardIdeas({ value, onPick }: { value?: string; onPick: (v: string) => void }) {
  const [prefs, setPrefs] = useState<RewardTag[]>(() => getRewardPrefs());
  const [ideas, setIdeas] = useState<string[]>(() => suggestRewards(getRewardPrefs()));

  const reroll = (nextPrefs = prefs) => setIdeas(suggestRewards(nextPrefs));
  const isPreset = value != null && ideas.includes(value);

  return (
    <div className="mt-2.5 pl-3 border-l-2 border-gold/25 space-y-2.5 fade-in">
      <div className="space-y-1.5">
        <div className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60">
          What do you like? (tap any — helps Alfred suggest ideas)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {REWARD_TAGS.map((tag) => {
            const active = prefs.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  const next = toggleRewardPref(tag);
                  setPrefs(next);
                  reroll(next);
                }}
                className={`rounded-full px-2.5 py-1 text-[10px] font-mono border transition-all ${
                  active
                    ? "bg-gold/20 text-gold border-gold/50"
                    : "bg-background/40 border-border/60 text-muted-foreground hover:border-gold/40 hover:text-foreground"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/60">
            Ideas
          </div>
          <button
            type="button"
            onClick={() => reroll()}
            title="Show different ideas"
            className="inline-flex items-center gap-1 text-[9px] font-mono uppercase text-muted-foreground/70 hover:text-gold transition-colors"
          >
            <Shuffle className="h-3 w-3" /> Shuffle
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ideas.map((idea) => {
            const active = value === idea;
            return (
              <button
                key={idea}
                type="button"
                onClick={() => onPick(idea)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-mono border transition-all ${
                  active
                    ? "bg-gold text-primary-foreground border-gold"
                    : "bg-background/40 border-border/60 text-muted-foreground hover:border-gold/40 hover:text-foreground"
                }`}
              >
                {idea}
              </button>
            );
          })}
        </div>
        <input
          value={isPreset ? "" : value ?? ""}
          onChange={(e) => onPick(e.target.value)}
          placeholder="…or type your own"
          className={INPUT}
        />
      </div>
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
  const setDetail = (key: string, val: string) =>
    onChange({ ...value, details: { ...(value.details ?? {}), [key]: val }, updatedAt: Date.now() });
  const byLabel = deadline ? format(new Date(deadline), "MMM d, yyyy") : "your deadline";

  return (
    <div className="space-y-5">
      <Question icon={Flag} n={1} q={`What does this look like by ${byLabel}?`}>
        <ChipRow
          options={VISION_OPTIONS}
          value={value.vision}
          onChange={(v) => set({ vision: v })}
        />
        {value.vision && (
          <SubQuestions items={VISION_SUBQ} details={value.details} onChange={setDetail} />
        )}
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
        {value.breakdown && (
          <SubQuestions items={BREAKDOWN_SUBQ} details={value.details} onChange={setDetail} />
        )}
      </Question>

      <Question icon={RefreshCw} n={3} q="How should I count misses or relapses?">
        <ChipRow
          options={MISS_RULE_OPTIONS}
          value={value.missRule}
          onChange={(v) => set({ missRule: v })}
        />
        {value.missRule && (
          <SubQuestions items={MISS_SUBQ} details={value.details} onChange={setDetail} />
        )}
      </Question>

      <Question icon={Trophy} n={4} q="Then what — once it's done, or if it isn't?">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="font-mono text-[9px] tracking-wider uppercase text-teal">
              If I reach it →
            </label>
            <ChipRow
              options={REACH_OPTIONS}
              value={value.ifReached}
              onChange={(v) => set({ ifReached: v })}
            />
            {value.ifReached === "Celebrate & reward myself" ? (
              <RewardIdeas
                value={value.details?.["reach.how"]}
                onPick={(v) => setDetail("reach.how", v)}
              />
            ) : (
              value.ifReached && (
                <SubQuestions items={REACH_SUBQ} details={value.details} onChange={setDetail} />
              )
            )}
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[9px] tracking-wider uppercase text-coral">
              If I fall short →
            </label>
            <ChipRow
              options={MISS_OUTCOME_OPTIONS}
              value={value.ifMissed}
              onChange={(v) => set({ ifMissed: v })}
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
