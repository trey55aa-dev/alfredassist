import { describe, it, expect } from "vitest";
import {
  DEFAULT_WEIGHTS,
  EMPTY_INPUT,
  gradeGame,
  groupByDay,
  parseScoreboard,
  parseStandings,
  predictGame,
  type Game,
  type StatsMap,
  type TeamSeasonStats,
} from "@/lib/nflPredictor";

function mkStats(id: string, p: Partial<TeamSeasonStats> = {}): TeamSeasonStats {
  return {
    teamId: id,
    wins: 8,
    losses: 8,
    ties: 0,
    pointsFor: 350,
    pointsAgainst: 350,
    gamesPlayed: 16,
    streak: 0,
    homeWins: 4,
    homeLosses: 4,
    roadWins: 4,
    roadLosses: 4,
    ...p,
  };
}

const matchup = {
  home: { id: "1", abbreviation: "KC", displayName: "Kansas City Chiefs", shortName: "Chiefs" },
  away: { id: "2", abbreviation: "LV", displayName: "Las Vegas Raiders", shortName: "Raiders" },
};

describe("predictGame", () => {
  it("favors the home team when stats are even (home-field edge)", () => {
    const stats: StatsMap = { "1": mkStats("1"), "2": mkStats("2") };
    const p = predictGame(matchup, stats, DEFAULT_WEIGHTS);
    expect(p.winner).toBe("home");
    expect(p.homeProb).toBeGreaterThan(0.5);
    expect(p.homeProb).toBeLessThan(0.75); // a bump, not a blowout
  });

  it("favors a much stronger away team over home field", () => {
    const stats: StatsMap = {
      "1": mkStats("1", { wins: 3, losses: 13, pointsFor: 250, pointsAgainst: 420, streak: -3 }),
      "2": mkStats("2", { wins: 13, losses: 3, pointsFor: 460, pointsAgainst: 280, streak: 4 }),
    };
    const p = predictGame(matchup, stats, DEFAULT_WEIGHTS);
    expect(p.winner).toBe("away");
    expect(p.homeProb).toBeLessThan(0.3);
  });

  it("lets user reasoning flip a lean toward the away team", () => {
    const stats: StatsMap = { "1": mkStats("1"), "2": mkStats("2") };
    const base = predictGame(matchup, stats, DEFAULT_WEIGHTS);
    expect(base.winner).toBe("home");
    const flipped = predictGame(matchup, stats, DEFAULT_WEIGHTS, {
      lean: -3,
      tags: { Injuries: "away", Weather: "away" },
      note: "backup QB at home",
    });
    expect(flipped.winner).toBe("away");
  });

  it("ignores user input when reasoning weight is zero", () => {
    const stats: StatsMap = { "1": mkStats("1"), "2": mkStats("2") };
    const weights = { ...DEFAULT_WEIGHTS, reasoning: 0 };
    const a = predictGame(matchup, stats, weights);
    const b = predictGame(matchup, stats, weights, { lean: -3, tags: {}, note: "" });
    expect(a.homeProb).toBeCloseTo(b.homeProb, 10);
  });

  it("handles missing stats gracefully (early season / bye data gaps)", () => {
    const p = predictGame(matchup, {}, DEFAULT_WEIGHTS);
    expect(p.homeProb).toBeGreaterThan(0);
    expect(p.homeProb).toBeLessThan(1);
    expect(p.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("reports per-factor contributions for all five factors", () => {
    const stats: StatsMap = { "1": mkStats("1"), "2": mkStats("2") };
    const p = predictGame(matchup, stats, DEFAULT_WEIGHTS, EMPTY_INPUT);
    expect(p.contributions.map((c) => c.label)).toEqual([
      "Record",
      "Scoring margin",
      "Home field",
      "Momentum",
      "Your reasoning",
    ]);
  });
});

describe("gradeGame", () => {
  const game: Game = {
    id: "g1",
    date: "2025-12-14T18:00:00Z",
    name: "LV at KC",
    ...matchup,
    state: "post",
    completed: true,
    homeScore: 27,
    awayScore: 17,
  };
  const stats: StatsMap = { "1": mkStats("1"), "2": mkStats("2") };

  it("grades a correct home pick as a hit", () => {
    const p = predictGame(game, stats, DEFAULT_WEIGHTS);
    expect(p.winner).toBe("home");
    expect(gradeGame(game, p)).toBe(true);
  });

  it("grades a wrong pick as a miss", () => {
    const flipped = { ...game, homeScore: 10, awayScore: 24 };
    const p = predictGame(game, stats, DEFAULT_WEIGHTS);
    expect(gradeGame(flipped, p)).toBe(false);
  });

  it("returns null for unfinished games and ties", () => {
    const p = predictGame(game, stats, DEFAULT_WEIGHTS);
    expect(gradeGame({ ...game, completed: false }, p)).toBeNull();
    expect(gradeGame({ ...game, homeScore: 20, awayScore: 20 }, p)).toBeNull();
  });
});

describe("parseScoreboard", () => {
  const payload = {
    season: { year: 2025 },
    week: { number: 15 },
    events: [
      {
        id: "401671800",
        date: "2025-12-11T01:15:00Z",
        name: "Las Vegas Raiders at Kansas City Chiefs",
        competitions: [
          {
            venue: { fullName: "GEHA Field at Arrowhead Stadium" },
            broadcasts: [{ names: ["NBC"] }],
            status: { type: { state: "post", completed: true, shortDetail: "Final" } },
            competitors: [
              {
                homeAway: "home",
                score: "27",
                records: [{ type: "total", summary: "11-3" }],
                team: {
                  id: "12",
                  abbreviation: "KC",
                  displayName: "Kansas City Chiefs",
                  shortName: "Chiefs",
                  color: "e31837",
                  logo: "https://a.espncdn.com/kc.png",
                },
              },
              {
                homeAway: "away",
                score: "17",
                records: [{ type: "total", summary: "5-9" }],
                team: {
                  id: "13",
                  abbreviation: "LV",
                  displayName: "Las Vegas Raiders",
                  shortName: "Raiders",
                },
              },
            ],
          },
        ],
      },
    ],
  };

  it("parses events into games with home/away, scores and status", () => {
    const wk = parseScoreboard(payload);
    expect(wk.seasonYear).toBe(2025);
    expect(wk.weekNumber).toBe(15);
    expect(wk.games).toHaveLength(1);
    const g = wk.games[0];
    expect(g.home.abbreviation).toBe("KC");
    expect(g.away.abbreviation).toBe("LV");
    expect(g.home.record).toBe("11-3");
    expect(g.homeScore).toBe(27);
    expect(g.awayScore).toBe(17);
    expect(g.completed).toBe(true);
    expect(g.state).toBe("post");
    expect(g.venue).toBe("GEHA Field at Arrowhead Stadium");
    expect(g.broadcast).toBe("NBC");
  });

  it("tolerates empty/malformed payloads", () => {
    expect(parseScoreboard({}).games).toEqual([]);
    expect(parseScoreboard({ events: [{ id: "x" }] }).games).toEqual([]);
  });
});

describe("parseStandings", () => {
  const entry = (id: string) => ({
    team: { id },
    stats: [
      { name: "wins", value: 11 },
      { name: "losses", value: 3 },
      { name: "ties", value: 0 },
      { name: "pointsFor", value: 380 },
      { name: "pointsAgainst", value: 290 },
      { name: "streak", value: 4 },
      { name: "Home", displayValue: "6-1" },
      { name: "Road", displayValue: "5-2" },
    ],
  });

  it("parses conference-nested standings into a stats map", () => {
    const map = parseStandings({
      children: [{ standings: { entries: [entry("12")] } }, { standings: { entries: [entry("7")] } }],
    });
    expect(Object.keys(map).sort()).toEqual(["12", "7"]);
    const kc = map["12"];
    expect(kc.wins).toBe(11);
    expect(kc.pointsFor).toBe(380);
    expect(kc.gamesPlayed).toBe(14);
    expect(kc.streak).toBe(4);
    expect(kc.homeWins).toBe(6);
    expect(kc.roadLosses).toBe(2);
  });

  it("parses flat standings and tolerates empty payloads", () => {
    expect(parseStandings({ standings: { entries: [entry("9")] } })["9"].losses).toBe(3);
    expect(parseStandings({})).toEqual({});
  });
});

describe("groupByDay", () => {
  it("groups games by calendar day in order", () => {
    const mk = (id: string, date: string): Game => ({
      id,
      date,
      name: id,
      ...matchup,
      state: "pre",
      completed: false,
    });
    const groups = groupByDay([
      mk("thu", "2025-12-12T01:15:00Z"),
      mk("sun1", "2025-12-14T18:00:00Z"),
      mk("sun2", "2025-12-14T21:25:00Z"),
      mk("mon", "2025-12-16T01:15:00Z"),
    ]);
    expect(groups).toHaveLength(3);
    expect(groups[1].games.map((g) => g.id)).toEqual(["sun1", "sun2"]);
  });
});
