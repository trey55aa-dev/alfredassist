// Alfred learns from what the user actually DECIDES — not just what he suggests.
// Every accept / dismiss / override of a recommendation is recorded here, and a
// compact summary is fed into Alfred's context so future suggestions bend toward
// the user's real choices instead of repeating rejected advice.

export type DecisionSource =
  | "goal-next-step"   // SuggestedNextRow on a goal card
  | "schedule-block"   // SuggestedSchedule day blocks
  | "ai-plan"          // AI-drafted goal plans
  | "briefing"         // morning/evening briefing nudges
  | "block-retime";    // SuggestedRetimes — recurring block time changes

export type DecisionAction = "accepted" | "dismissed" | "overridden";

export interface Decision {
  source: DecisionSource;
  /** stable key for the specific suggestion (used to suppress re-suggesting) */
  key: string;
  action: DecisionAction;
  /** human-readable label of what was suggested, e.g. "Log $61 toward Save $15,000" */
  label: string;
  /** what the user did instead, when they overrode (optional) */
  insteadLabel?: string;
  at: number;
}

const DECISIONS_KEY = "alfred.decisions";
const MAX_DECISIONS = 300;

function readAll(): Decision[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DECISIONS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Decision[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(list: Decision[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DECISIONS_KEY, JSON.stringify(list.slice(-MAX_DECISIONS)));
  } catch {
    /* quota */
  }
}

/** Record what the user decided about a suggestion. */
export function recordDecision(d: Omit<Decision, "at">): void {
  const list = readAll();
  list.push({ ...d, at: Date.now() });
  writeAll(list);
}

/**
 * Has this exact suggestion been dismissed before? (Don't nag twice.)
 * Pass `withinMs` to only honour recent "no"s — e.g. a declined schedule block
 * stays gone for a week, then may be offered again if still relevant.
 */
export function wasDismissed(
  source: DecisionSource,
  key: string,
  withinMs?: number,
): boolean {
  const cutoff = withinMs != null ? Date.now() - withinMs : 0;
  return readAll().some(
    (d) =>
      d.source === source &&
      d.key === key &&
      d.action === "dismissed" &&
      d.at >= cutoff,
  );
}

/* ---------- what Alfred learns ---------- */

const SOURCE_LABEL: Record<DecisionSource, string> = {
  "goal-next-step": "goal next-step suggestions",
  "schedule-block": "suggested schedule blocks",
  "ai-plan": "AI-drafted plans",
  briefing: "briefing nudges",
  "block-retime": "block retime suggestions",
};

/**
 * Compact, prompt-ready summary of the user's decision patterns. Empty string
 * when there's nothing meaningful yet.
 */
export function adaptationSummary(now = Date.now()): string {
  const list = readAll();
  if (list.length === 0) return "";

  const lines: string[] = [];

  // Acceptance rate per source (only sources with enough signal).
  const bySource = new Map<DecisionSource, { acc: number; dis: number }>();
  for (const d of list) {
    const s = bySource.get(d.source) ?? { acc: 0, dis: 0 };
    if (d.action === "accepted") s.acc++;
    else s.dis++;
    bySource.set(d.source, s);
  }
  for (const [source, { acc, dis }] of bySource) {
    const total = acc + dis;
    if (total < 3) continue; // not enough signal to generalise
    const rate = Math.round((acc / total) * 100);
    if (rate <= 35) {
      lines.push(
        `- Usually declines ${SOURCE_LABEL[source]} (${acc}/${total} accepted) — offer these sparingly, ask what they'd prefer instead.`,
      );
    } else if (rate >= 75) {
      lines.push(`- Responds well to ${SOURCE_LABEL[source]} (${acc}/${total} accepted).`);
    }
  }

  // Recent dismissals & overrides — concrete things NOT to repeat.
  const twoWeeks = now - 14 * 24 * 3600_000;
  const recentNo = list
    .filter((d) => d.at >= twoWeeks && d.action !== "accepted")
    .slice(-6);
  if (recentNo.length > 0) {
    lines.push("- Recently declined or changed:");
    for (const d of recentNo) {
      lines.push(
        `  · "${d.label}"${d.insteadLabel ? ` → chose "${d.insteadLabel}" instead` : ""}`,
      );
    }
  }

  if (lines.length === 0) return "";
  return [
    "USER DECISIONS (adapt to these — respect what they choose over what was recommended; never re-push a declined idea, offer an alternative instead):",
    ...lines,
  ].join("\n");
}
