import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  DEFAULT_WEIGHTS,
  EMPTY_INPUT,
  ENV_TAGS,
  NFL_INPUTS_KEY,
  NFL_WEIGHTS_KEY,
  fetchStandings,
  fetchWeek,
  formatKickoff,
  gradeGame,
  groupByDay,
  predictGame,
  type EnvTag,
  type Game,
  type GameInput,
  type ModelWeights,
  type Prediction,
  type StatsMap,
} from "@/lib/nflPredictor";

type InputsMap = Record<string, GameInput>;

const WEIGHT_LABELS: { key: keyof ModelWeights; label: string; hint: string }[] = [
  { key: "record", label: "Record", hint: "Win-loss percentage gap" },
  { key: "scoring", label: "Scoring margin", hint: "Points for vs against, per game" },
  { key: "homeField", label: "Home field", hint: "Baseline bump + home/road splits" },
  { key: "momentum", label: "Momentum", hint: "Current win/loss streaks" },
  { key: "reasoning", label: "My reasoning", hint: "Your lean, tags and notes" },
];

/* ─── Weights panel ───────────────────────────────────── */

function WeightsPanel({
  weights,
  setWeights,
}: {
  weights: ModelWeights;
  setWeights: (w: ModelWeights) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-4 bg-gradient-card border-border mb-6">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] uppercase text-gold">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Model weights
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          {WEIGHT_LABELS.map(({ key, label, hint }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="text-sm text-foreground">{label}</span>
                  <span className="ml-2 text-xs text-muted-foreground/70">{hint}</span>
                </div>
                <span className="font-mono text-xs text-gold w-8 text-right">{weights[key]}</span>
              </div>
              <Slider
                value={[weights[key]]}
                min={0}
                max={100}
                step={5}
                onValueChange={([v]) => setWeights({ ...weights, [key]: v })}
              />
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setWeights({ ...DEFAULT_WEIGHTS })}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset defaults
          </Button>
        </div>
      )}
    </Card>
  );
}

/* ─── Probability bar ─────────────────────────────────── */

function ProbBar({ game, prediction }: { game: Game; prediction: Prediction }) {
  const homePct = Math.round(prediction.homeProb * 100);
  const awayColor = game.away.color ? `#${game.away.color}` : "hsl(var(--muted))";
  const homeColor = game.home.color ? `#${game.home.color}` : "hsl(var(--muted))";
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
        <div style={{ width: `${100 - homePct}%`, background: awayColor }} />
        <div style={{ width: `${homePct}%`, background: homeColor }} />
      </div>
      <div className="flex justify-between mt-1 font-mono text-[10px] text-muted-foreground">
        <span className={prediction.winner === "away" ? "text-gold" : ""}>
          {game.away.abbreviation} {100 - homePct}%
        </span>
        <span className={prediction.winner === "home" ? "text-gold" : ""}>
          {game.home.abbreviation} {homePct}%
        </span>
      </div>
    </div>
  );
}

/* ─── Game card ───────────────────────────────────────── */

function TeamRow({ team, score, winner }: { team: Game["home"]; score?: number; winner: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {team.logo && <img src={team.logo} alt="" className="h-7 w-7 shrink-0" loading="lazy" />}
      <div className="min-w-0">
        <div className={`text-sm truncate ${winner ? "text-gold" : "text-foreground"}`}>
          {team.shortName}
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">{team.record ?? ""}</div>
      </div>
      {score != null && <div className="ml-auto font-display text-xl text-foreground">{score}</div>}
    </div>
  );
}

function GameCard({
  game,
  stats,
  weights,
  input,
  setInput,
}: {
  game: Game;
  stats: StatsMap;
  weights: ModelWeights;
  input: GameInput;
  setInput: (gi: GameInput) => void;
}) {
  const [open, setOpen] = useState(false);
  const prediction = useMemo(
    () => predictGame(game, stats, weights, input),
    [game, stats, weights, input],
  );
  const pick = prediction.winner === "home" ? game.home : game.away;
  const graded = input.graded ?? null;
  const liveGrade = graded ? graded.correct : gradeGame(game, prediction);

  const cycleTag = (tag: EnvTag) => {
    const cur = input.tags[tag];
    const next = cur === undefined ? "home" : cur === "home" ? "away" : undefined;
    const tags = { ...input.tags };
    if (next === undefined) delete tags[tag];
    else tags[tag] = next;
    setInput({ ...input, tags });
  };

  return (
    <Card className="p-4 bg-gradient-card border-border">
      <div className="flex items-start justify-between gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 flex-1 min-w-0">
          <TeamRow
            team={game.away}
            score={game.state !== "pre" ? game.awayScore : undefined}
            winner={prediction.winner === "away"}
          />
          <TeamRow
            team={game.home}
            score={game.state !== "pre" ? game.homeScore : undefined}
            winner={prediction.winner === "home"}
          />
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-[10px] text-muted-foreground">
            {game.state === "pre" ? formatKickoff(game.date) : game.statusDetail}
          </div>
          {game.broadcast && game.state === "pre" && (
            <div className="font-mono text-[10px] text-muted-foreground/60">{game.broadcast}</div>
          )}
        </div>
      </div>

      <div className="mt-3">
        <ProbBar game={game} prediction={prediction} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-muted-foreground/70">
            Pick
          </span>
          <span className="text-sm text-gold truncate">{pick.shortName}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {Math.round(prediction.confidence * 100)}%
          </span>
          {game.completed && liveGrade !== null && (
            <span
              className={`inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded ${
                liveGrade ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
              }`}
            >
              {liveGrade ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              {liveGrade ? "Hit" : "Miss"}
            </span>
          )}
        </div>
        <button
          className="font-mono text-[10px] tracking-[0.15em] uppercase text-muted-foreground hover:text-gold transition-colors shrink-0"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Close" : "Your read"}
          {(input.lean !== 0 || Object.keys(input.tags).length > 0 || input.note) && !open && (
            <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-gold align-middle" />
          )}
        </button>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-border/60 space-y-4">
          {/* Lean slider */}
          <div>
            <div className="flex justify-between font-mono text-[10px] text-muted-foreground mb-1.5">
              <span>{game.away.abbreviation}</span>
              <span className="tracking-[0.15em] uppercase">Your lean</span>
              <span>{game.home.abbreviation}</span>
            </div>
            <Slider
              value={[input.lean]}
              min={-3}
              max={3}
              step={1}
              onValueChange={([v]) => setInput({ ...input, lean: v })}
            />
          </div>

          {/* Environment tags — tap to cycle: off → home → away → off */}
          <div>
            <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-muted-foreground mb-1.5">
              Environment edges
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ENV_TAGS.map((tag) => {
                const side = input.tags[tag];
                return (
                  <button
                    key={tag}
                    onClick={() => cycleTag(tag)}
                    className={`px-2 py-1 rounded-md font-mono text-[10px] border transition-colors ${
                      side
                        ? "border-gold/60 text-gold bg-gold/10"
                        : "border-border text-muted-foreground hover:border-gold/40"
                    }`}
                  >
                    {tag}
                    {side && ` → ${side === "home" ? game.home.abbreviation : game.away.abbreviation}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <Textarea
            value={input.note}
            onChange={(e) => setInput({ ...input, note: e.target.value })}
            placeholder="Why do you like this side? (matchups, injuries, weather…)"
            className="min-h-[64px] text-sm"
          />

          {/* Factor breakdown */}
          <div className="space-y-1">
            <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-muted-foreground mb-1.5">
              Factor breakdown
            </div>
            {prediction.contributions.map(({ label, value }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
                <div className="flex-1 h-1.5 relative bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 bg-gold/70"
                    style={{
                      left: value < 0 ? `${50 + value * 50}%` : "50%",
                      width: `${Math.abs(value) * 50}%`,
                    }}
                  />
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border" />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground w-10 text-right">
                  {value >= 0 ? game.home.abbreviation : game.away.abbreviation}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ─── Page ────────────────────────────────────────────── */

export default function NFLPredictor() {
  const [weights, setWeights] = useLocalStorage<ModelWeights>(NFL_WEIGHTS_KEY, DEFAULT_WEIGHTS);
  const [inputs, setInputs] = useLocalStorage<InputsMap>(NFL_INPUTS_KEY, {});
  const [selected, setSelected] = useState<{ season: number; week: number } | null>(null);

  // First load: no args → ESPN tells us the current season + week.
  const currentWeek = useQuery({
    queryKey: ["nfl", "currentWeek"],
    queryFn: () => fetchWeek(),
    staleTime: 5 * 60_000,
  });

  const season = selected?.season ?? currentWeek.data?.seasonYear;
  const week = selected?.week ?? currentWeek.data?.weekNumber;

  const schedule = useQuery({
    queryKey: ["nfl", "week", season, week],
    queryFn: () => fetchWeek(season!, week!),
    enabled: season != null && week != null,
    staleTime: 60_000,
  });

  const standings = useQuery({
    queryKey: ["nfl", "standings", season],
    queryFn: () => fetchStandings(season!),
    enabled: season != null,
    staleTime: 10 * 60_000,
  });

  const games = useMemo(() => schedule.data?.games ?? [], [schedule.data]);
  const stats = standings.data ?? {};
  const days = useMemo(() => groupByDay(games), [games]);

  // Lock in grades the first time a game is seen final, so later weight
  // tweaks can't rewrite history.
  useEffect(() => {
    if (!games.length || !season || !week) return;
    const updates: InputsMap = {};
    for (const g of games) {
      const existing = inputs[g.id] ?? EMPTY_INPUT;
      if (existing.graded || !g.completed) continue;
      const pred = predictGame(g, stats, weights, existing);
      const correct = gradeGame(g, pred);
      if (correct === null) continue;
      const pickedTeamId = pred.winner === "home" ? g.home.id : g.away.id;
      updates[g.id] = { ...existing, graded: { pickedTeamId, correct, season, week } };
    }
    if (Object.keys(updates).length) setInputs({ ...inputs, ...updates });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games, stats]);

  // Accuracy: this week + all time, from locked grades.
  const record = useMemo(() => {
    let wkHit = 0, wkTot = 0, allHit = 0, allTot = 0;
    const weekIds = new Set(games.map((g) => g.id));
    for (const [id, gi] of Object.entries(inputs)) {
      if (!gi.graded) continue;
      allTot++;
      if (gi.graded.correct) allHit++;
      if (weekIds.has(id)) {
        wkTot++;
        if (gi.graded.correct) wkHit++;
      }
    }
    return { wkHit, wkTot, allHit, allTot };
  }, [inputs, games]);

  const nav = (delta: number) => {
    if (!season || !week) return;
    setSelected({ season, week: Math.min(18, Math.max(1, week + delta)) });
  };

  const loading = currentWeek.isLoading || schedule.isLoading;
  const error = currentWeek.error ?? schedule.error;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Game day"
        title="NFL Predictor"
        subtitle="Your model · your reasoning · projected winners"
        actions={
          record.allTot > 0 ? (
            <div className="text-right">
              <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-muted-foreground/70">
                All-time
              </div>
              <div className="font-display text-xl text-gold">
                {record.allHit}–{record.allTot - record.allHit}
              </div>
            </div>
          ) : undefined
        }
      />

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => nav(-1)} disabled={!week || week <= 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-gold">
            {week ? `Week ${week}` : "…"}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground/60">
            {season ?? ""}
            {record.wkTot > 0 && ` · ${record.wkHit}–${record.wkTot - record.wkHit} this week`}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => nav(1)} disabled={!week || week >= 18}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <WeightsPanel weights={weights} setWeights={setWeights} />

      {loading && (
        <Card className="p-10 bg-gradient-card border-border text-center">
          <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-gold animate-pulse">
            Fetching the slate…
          </div>
        </Card>
      )}

      {!loading && error != null && (
        <Card className="p-10 bg-gradient-card border-border text-center">
          <p className="text-sm text-muted-foreground">
            Couldn't reach the schedule service. Check your connection and try again.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 text-gold"
            onClick={() => {
              currentWeek.refetch();
              schedule.refetch();
            }}
          >
            Retry
          </Button>
        </Card>
      )}

      {!loading && !error && games.length === 0 && (
        <Card className="p-10 bg-gradient-card border-border text-center">
          <p className="text-sm text-muted-foreground">
            No games on this week's slate — try another week.
          </p>
        </Card>
      )}

      <div className="space-y-6">
        {days.map(({ label, games: dayGames }) => (
          <div key={label}>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-1 w-1 rounded-full bg-gold inline-block" />
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                {label}
              </span>
            </div>
            <div className="space-y-3">
              {dayGames.map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  stats={stats}
                  weights={weights}
                  input={inputs[g.id] ?? EMPTY_INPUT}
                  setInput={(gi) => setInputs({ ...inputs, [g.id]: gi })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
