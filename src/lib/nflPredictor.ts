/**
 * NFL game-outcome predictor.
 *
 * Data comes from ESPN's public (unauthenticated, CORS-enabled) site API:
 *   - scoreboard: weekly schedule, live/final scores, team records
 *   - standings:  season-long team stats (points for/against, streaks, splits)
 *
 * The model blends four stat factors — record, scoring margin, home field,
 * momentum — under user-tunable weights, then layers the user's own reasoning
 * on top: a per-game lean slider, tap-to-assign environment tags (weather,
 * injuries, rest…), and free-form notes. Everything the user enters persists
 * in localStorage so picks can be graded once games go final.
 */

/* ─── Types ───────────────────────────────────────────── */

export interface TeamInfo {
  id: string;
  abbreviation: string;
  displayName: string;
  shortName: string;
  logo?: string;
  color?: string; // hex without '#'
  record?: string; // "10-4"
}

export interface Game {
  id: string;
  date: string; // ISO
  name: string;
  home: TeamInfo;
  away: TeamInfo;
  venue?: string;
  /** pre | in | post */
  state: "pre" | "in" | "post";
  completed: boolean;
  homeScore?: number;
  awayScore?: number;
  statusDetail?: string; // "Sun 1:00 PM" / "Final" / "Q3 4:12"
  broadcast?: string;
}

export interface WeekSchedule {
  seasonYear: number;
  weekNumber: number;
  games: Game[];
}

export interface TeamSeasonStats {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  gamesPlayed: number;
  /** positive = winning streak, negative = losing streak */
  streak: number;
  homeWins: number;
  homeLosses: number;
  roadWins: number;
  roadLosses: number;
}

export type StatsMap = Record<string, TeamSeasonStats>;

/** User-tunable factor weights, each 0–100. */
export interface ModelWeights {
  record: number;
  scoring: number;
  homeField: number;
  momentum: number;
  /** How much the user's own lean + tags count. */
  reasoning: number;
}

export const DEFAULT_WEIGHTS: ModelWeights = {
  record: 60,
  scoring: 70,
  homeField: 45,
  momentum: 35,
  reasoning: 80,
};

export const ENV_TAGS = [
  "Weather",
  "Injuries",
  "Rest",
  "QB edge",
  "Trenches",
  "Motivation",
  "Travel",
] as const;
export type EnvTag = (typeof ENV_TAGS)[number];

/** Which side an environment tag favors. */
export type TagSide = "home" | "away";

/** The user's reasoning layer for one game. */
export interface GameInput {
  /** -3 (strong away) … +3 (strong home) */
  lean: number;
  tags: Partial<Record<EnvTag, TagSide>>;
  note: string;
  /** Set when the game was seen final: was the projected pick correct? */
  graded?: { pickedTeamId: string; correct: boolean; season: number; week: number };
}

export const EMPTY_INPUT: GameInput = { lean: 0, tags: {}, note: "" };

export interface Prediction {
  homeProb: number; // 0–1
  winner: "home" | "away";
  confidence: number; // 0.5–1
  /** Per-factor signed contributions (positive = home), for the breakdown UI. */
  contributions: { label: string; value: number }[];
}

/* ─── Storage keys (picked up by cloud state sync like other alfred.* keys) ── */

export const NFL_WEIGHTS_KEY = "alfred.nfl.weights";
export const NFL_INPUTS_KEY = "alfred.nfl.gameInputs"; // Record<gameId, GameInput>

/* ─── Prediction engine (pure — unit tested) ──────────── */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function winPct(w: number, l: number, t: number): number {
  const g = w + l + t;
  return g === 0 ? 0.5 : (w + t / 2) / g;
}

/**
 * Predict a game. Each factor yields an edge in roughly [-1, 1]
 * (positive = home team), scaled by its weight; the sum is squashed
 * through a logistic into a win probability.
 */
export function predictGame(
  game: Pick<Game, "home" | "away">,
  stats: StatsMap,
  weights: ModelWeights,
  input: GameInput = EMPTY_INPUT,
): Prediction {
  const h = stats[game.home.id];
  const a = stats[game.away.id];

  const contributions: { label: string; value: number }[] = [];
  const add = (label: string, rawEdge: number, weight: number) => {
    const v = clamp(rawEdge, -1, 1) * (weight / 100);
    contributions.push({ label, value: v });
    return v;
  };

  let edge = 0;

  // Record: win-percentage differential.
  const recEdge = h && a ? winPct(h.wins, h.losses, h.ties) - winPct(a.wins, a.losses, a.ties) : 0;
  edge += add("Record", recEdge * 2, weights.record);

  // Scoring: per-game point differential gap; a 10 pt/game gap is dominant.
  const pdpg = (s?: TeamSeasonStats) =>
    s && s.gamesPlayed > 0 ? (s.pointsFor - s.pointsAgainst) / s.gamesPlayed : 0;
  edge += add("Scoring margin", (pdpg(h) - pdpg(a)) / 10, weights.scoring);

  // Home field: baseline home bump, sharpened by home/road splits when known.
  let hfEdge = 0.35;
  if (h && a) {
    const homeSplit = winPct(h.homeWins, h.homeLosses, 0);
    const roadSplit = winPct(a.roadWins, a.roadLosses, 0);
    hfEdge += (homeSplit - roadSplit) * 0.5;
  }
  edge += add("Home field", hfEdge, weights.homeField);

  // Momentum: current streak differential (5-game streak saturates).
  const stEdge = h && a ? (h.streak - a.streak) / 5 : 0;
  edge += add("Momentum", stEdge, weights.momentum);

  // The user's reasoning layer: lean slider + environment tags.
  const tagSum = Object.values(input.tags).reduce(
    (sum, side) => sum + (side === "home" ? 0.35 : -0.35),
    0,
  );
  const userEdge = input.lean / 3 + tagSum;
  edge += add("Your reasoning", userEdge, weights.reasoning);

  // Logistic squash — k tuned so a full one-sided edge ≈ 90%+.
  const homeProb = 1 / (1 + Math.exp(-2.2 * edge));
  const winner = homeProb >= 0.5 ? "home" : "away";
  return {
    homeProb,
    winner,
    confidence: Math.max(homeProb, 1 - homeProb),
    contributions,
  };
}

/* ─── ESPN fetch + parse ──────────────────────────────── */

const ESPN_BASE = "https://site.api.espn.com/apis";

/* eslint-disable @typescript-eslint/no-explicit-any -- external API payloads */

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN request failed (${res.status})`);
  return res.json();
}

function parseCompetitor(c: any): TeamInfo & { score?: number; homeAway: string } {
  const t = c?.team ?? {};
  return {
    id: String(t.id ?? ""),
    abbreviation: t.abbreviation ?? "?",
    displayName: t.displayName ?? "Unknown",
    shortName: t.shortName ?? t.name ?? t.abbreviation ?? "Unknown",
    logo: t.logo,
    color: t.color,
    record: Array.isArray(c?.records)
      ? c.records.find((r: any) => r.type === "total" || r.name === "overall")?.summary
      : undefined,
    score: c?.score != null && c.score !== "" ? Number(c.score) : undefined,
    homeAway: c?.homeAway ?? "",
  };
}

/** Parse a scoreboard payload into a WeekSchedule. Exported for tests. */
export function parseScoreboard(data: any): WeekSchedule {
  const games: Game[] = [];
  for (const ev of data?.events ?? []) {
    const comp = ev?.competitions?.[0];
    if (!comp) continue;
    const competitors = (comp.competitors ?? []).map(parseCompetitor);
    const home = competitors.find((c: any) => c.homeAway === "home");
    const away = competitors.find((c: any) => c.homeAway === "away");
    if (!home || !away) continue;
    const status = comp.status ?? ev.status ?? {};
    const stateRaw = status?.type?.state;
    games.push({
      id: String(ev.id),
      date: ev.date ?? comp.date ?? "",
      name: ev.name ?? `${away.displayName} at ${home.displayName}`,
      home,
      away,
      venue: comp.venue?.fullName,
      state: stateRaw === "post" ? "post" : stateRaw === "in" ? "in" : "pre",
      completed: Boolean(status?.type?.completed),
      homeScore: home.score,
      awayScore: away.score,
      statusDetail: status?.type?.shortDetail ?? status?.type?.detail,
      broadcast: comp.broadcasts?.[0]?.names?.[0] ?? comp.broadcast,
    });
  }
  games.sort((x, y) => x.date.localeCompare(y.date));
  return {
    seasonYear: Number(data?.season?.year ?? new Date().getFullYear()),
    weekNumber: Number(data?.week?.number ?? 1),
    games,
  };
}

/**
 * Fetch a week's schedule. With no args, ESPN returns the current week —
 * used on first load to discover where we are in the season.
 */
export async function fetchWeek(season?: number, week?: number): Promise<WeekSchedule> {
  const params = season && week ? `?dates=${season}&seasontype=2&week=${week}` : "";
  const data = await fetchJson(`${ESPN_BASE}/site/v2/sports/football/nfl/scoreboard${params}`);
  return parseScoreboard(data);
}

/** Parse a standings payload into a per-team stats map. Exported for tests. */
export function parseStandings(data: any): StatsMap {
  const map: StatsMap = {};
  // Standings arrive either flat (data.standings.entries) or nested by
  // conference (data.children[].standings.entries).
  const groups: any[] = data?.children?.length ? data.children : [data];
  for (const group of groups) {
    for (const entry of group?.standings?.entries ?? []) {
      const id = String(entry?.team?.id ?? "");
      if (!id) continue;
      const stat = (name: string) =>
        Number(entry.stats?.find((s: any) => s.name === name || s.type === name)?.value ?? 0);
      const rec = (type: string) => {
        const summary = entry.stats?.find(
          (s: any) => s.name === type || s.type === type,
        )?.displayValue as string | undefined;
        const [w, l] = (summary ?? "0-0").split("-").map(Number);
        return { w: w || 0, l: l || 0 };
      };
      const wins = stat("wins");
      const losses = stat("losses");
      const ties = stat("ties");
      const home = rec("Home");
      const road = rec("Road");
      map[id] = {
        teamId: id,
        wins,
        losses,
        ties,
        pointsFor: stat("pointsFor"),
        pointsAgainst: stat("pointsAgainst"),
        gamesPlayed: wins + losses + ties,
        streak: stat("streak"),
        homeWins: home.w,
        homeLosses: home.l,
        roadWins: road.w,
        roadLosses: road.l,
      };
    }
  }
  return map;
}

export async function fetchStandings(season: number): Promise<StatsMap> {
  const data = await fetchJson(
    `${ESPN_BASE}/v2/sports/football/nfl/standings?season=${season}&level=1`,
  );
  return parseStandings(data);
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/* ─── Helpers for the page ────────────────────────────── */

/** Group games by local calendar day, preserving chronological order. */
export function groupByDay(games: Game[]): { label: string; games: Game[] }[] {
  const out: { label: string; games: Game[] }[] = [];
  for (const g of games) {
    const label = new Date(g.date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    const bucket = out.find((b) => b.label === label);
    if (bucket) bucket.games.push(g);
    else out.push({ label, games: [g] });
  }
  return out;
}

export function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Grade a completed game against the model's pick. */
export function gradeGame(game: Game, prediction: Prediction): boolean | null {
  if (!game.completed || game.homeScore == null || game.awayScore == null) return null;
  if (game.homeScore === game.awayScore) return null; // tie — no grade
  const actual = game.homeScore > game.awayScore ? "home" : "away";
  return actual === prediction.winner;
}
