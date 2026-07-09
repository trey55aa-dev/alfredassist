/**
 * Client for the nfl-advanced-stats edge function, which aggregates
 * advanced-stat sources (nflverse EPA, Next Gen Stats passing, PFR advanced
 * tables, nfelo power ratings) server-side — browsers can't read those
 * sites directly.
 *
 * The predictor treats this feed as optional: if the function isn't
 * deployed or every source fails, the model runs on ESPN data plus its own
 * computed Elo.
 */

import { supabase } from "@/integrations/supabase/client";
import { normalizeAbbr, type AdvancedMap } from "./nflPredictor";

export interface AdvancedSourceStatus {
  status: "ok" | "error";
  detail?: string;
  teams?: number;
}

export interface AdvancedStatsResult {
  teams: AdvancedMap;
  sources: Record<string, AdvancedSourceStatus>;
}

export const ADVANCED_SOURCE_LABELS: Record<string, string> = {
  nflverse: "nflverse EPA",
  ngs: "Next Gen Stats",
  pfr: "Pro-Football-Reference",
  nfelo: "nfelo power ratings",
};

export async function fetchAdvancedStats(season: number): Promise<AdvancedStatsResult> {
  const { data, error } = await supabase.functions.invoke("nfl-advanced-stats", {
    body: { season },
  });
  if (error) throw new Error(error.message ?? "Advanced stats unavailable");
  const payload = data as {
    teams?: Record<string, AdvancedMap[string]>;
    sources?: Record<string, AdvancedSourceStatus>;
  } | null;
  const teams: AdvancedMap = {};
  for (const [abbr, stats] of Object.entries(payload?.teams ?? {})) {
    teams[normalizeAbbr(abbr)] = stats;
  }
  return { teams, sources: payload?.sources ?? {} };
}
