// Advanced NFL stats aggregator edge function.
//
// The predictor's browser code can't read advanced-stat sites directly
// (CORS + JS-rendered pages), so this function fetches server-side and
// returns one normalized payload:
//
//   POST { season }  →  {
//     season, generatedAt,
//     teams:   { [abbr]: { offEpaPerGame, cpoe, timeToThrow, qbName,
//                          nfeloRating, pfr: {...} } },
//     sources: { [source]: { status: "ok" | "error", detail?, teams? } },
//   }
//
// Sources (each independent — one failing never hides the others):
//   nflverse  EPA per game from the open nflverse play-by-play aggregates
//             (the same data most advanced-stat sites are built on)
//   ngs       Next Gen Stats passing board → per-team primary QB CPOE,
//             time to throw
//   pfr       Pro-Football-Reference advanced team tables
//   nfelo     nfeloapp.com power ratings (Elo-scale), scraped from the
//             page's embedded JSON
//
// Results are cached in-memory for 6 hours per season.
//
// Deploy: supabase functions deploy nfl-advanced-stats --project-ref zsmnhphdagevtdooqpqp

import {
  aggregateNflverseTeamStats,
  extractNextData,
  findTeamRatings,
  mergeTeamMaps,
  parseCsv,
  parseNgsPassing,
  parsePfrTables,
  type AdvancedTeamsMap,
} from "./parsers.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_HEADERS = { ...CORS, "Content-Type": "application/json" };

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function getText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, ...headers },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).hostname}`);
  return res.text();
}

interface SourceStatus {
  status: "ok" | "error";
  detail?: string;
  teams?: number;
}

/* ─── Sources ─────────────────────────────────────────── */

async function srcNflverse(season: number): Promise<AdvancedTeamsMap> {
  const csv = await getText(
    `https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_${season}.csv`,
  );
  return aggregateNflverseTeamStats(parseCsv(csv));
}

async function srcNgs(season: number): Promise<AdvancedTeamsMap> {
  const res = await fetch(
    `https://appapi.ngs.nfl.com/statboard/passing?season=${season}&seasonType=REG`,
    {
      headers: {
        "user-agent": UA,
        accept: "application/json",
        referer: "https://nextgenstats.nfl.com/stats/passing",
        origin: "https://nextgenstats.nfl.com",
      },
    },
  );
  if (!res.ok) throw new Error(`${res.status} from appapi.ngs.nfl.com`);
  return parseNgsPassing(await res.json());
}

async function srcPfr(season: number): Promise<AdvancedTeamsMap> {
  const html = await getText(`https://www.pro-football-reference.com/years/${season}/advanced.htm`, {
    accept: "text/html",
  });
  return parsePfrTables(html);
}

async function srcNfelo(): Promise<AdvancedTeamsMap> {
  const html = await getText("https://www.nfeloapp.com/nfl-power-ratings/", { accept: "text/html" });
  const ratings = findTeamRatings(extractNextData(html) ?? {});
  const out: AdvancedTeamsMap = {};
  for (const [team, rating] of Object.entries(ratings)) out[team] = { nfeloRating: rating };
  return out;
}

/* ─── Aggregate + cache ───────────────────────────────── */

interface Payload {
  season: number;
  generatedAt: string;
  teams: AdvancedTeamsMap;
  sources: Record<string, SourceStatus>;
}

async function buildPayload(season: number): Promise<Payload> {
  const runners: [string, Promise<AdvancedTeamsMap>][] = [
    ["nflverse", srcNflverse(season)],
    ["ngs", srcNgs(season)],
    ["pfr", srcPfr(season)],
    ["nfelo", srcNfelo()],
  ];
  const sources: Record<string, SourceStatus> = {};
  const maps: AdvancedTeamsMap[] = [];
  const settled = await Promise.allSettled(runners.map(([, p]) => p));
  settled.forEach((result, i) => {
    const name = runners[i][0];
    if (result.status === "fulfilled" && Object.keys(result.value).length > 0) {
      sources[name] = { status: "ok", teams: Object.keys(result.value).length };
      maps.push(result.value);
    } else {
      sources[name] = {
        status: "error",
        detail:
          result.status === "rejected"
            ? result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
            : "no teams parsed",
      };
    }
  });
  return {
    season,
    generatedAt: new Date().toISOString(),
    teams: mergeTeamMaps(...maps),
    sources,
  };
}

const CACHE_TTL = 6 * 60 * 60 * 1000;
const cache = new Map<number, { at: number; payload: Payload }>();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const season = Number((body as { season?: unknown }).season) || new Date().getFullYear();
    const hit = cache.get(season);
    if (hit && Date.now() - hit.at < CACHE_TTL) {
      return new Response(JSON.stringify(hit.payload), { headers: JSON_HEADERS });
    }
    const payload = await buildPayload(season);
    // Only cache runs that got at least one source, so a bad network moment
    // doesn't stick for six hours.
    if (Object.values(payload.sources).some((s) => s.status === "ok")) {
      cache.set(season, { at: Date.now(), payload });
    }
    return new Response(JSON.stringify(payload), { headers: JSON_HEADERS });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});
