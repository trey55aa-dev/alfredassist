/**
 * Parse an Apple Health export.xml file in the browser.
 *
 * Apple Health generates this file when you:
 *   Health app → profile icon (top-right) → Export All Health Data
 *   Unzip → upload export.xml  (or the zip, we handle both)
 *
 * Strategy for large files (can be 100 MB+):
 *   1. Read as text, split by line.
 *   2. Keep only lines that mention today's date (fast pre-filter).
 *   3. Wrap survivors in a minimal root element and parse with DOMParser.
 *   4. Aggregate each metric.
 */

import type { HealthSnapshot } from "@/hooks/useHealth";

const todayISO = () => new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

/** Map workout activity type identifiers to readable names. */
const WORKOUT_NAMES: Record<string, string> = {
  HKWorkoutActivityTypeRunning: "Running",
  HKWorkoutActivityTypeCycling: "Cycling",
  HKWorkoutActivityTypeSwimming: "Swimming",
  HKWorkoutActivityTypeWalking: "Walking",
  HKWorkoutActivityTypeHiking: "Hiking",
  HKWorkoutActivityTypeTraditionalStrengthTraining: "Strength Training",
  HKWorkoutActivityTypeFunctionalStrengthTraining: "Functional Training",
  HKWorkoutActivityTypeYoga: "Yoga",
  HKWorkoutActivityTypePilates: "Pilates",
  HKWorkoutActivityTypeBoxing: "Boxing",
  HKWorkoutActivityTypeMixedCardio: "Mixed Cardio",
  HKWorkoutActivityTypeHighIntensityIntervalTraining: "HIIT",
  HKWorkoutActivityTypeDance: "Dance",
  HKWorkoutActivityTypeElliptical: "Elliptical",
  HKWorkoutActivityTypeRowing: "Rowing",
  HKWorkoutActivityTypeStairClimbing: "Stair Climbing",
  HKWorkoutActivityTypeCoreTraining: "Core Training",
  HKWorkoutActivityTypeCrossTraining: "Cross Training",
};

function attr(el: Element, name: string): string {
  return el.getAttribute(name) ?? "";
}

function floatAttr(el: Element, name: string): number {
  return parseFloat(el.getAttribute(name) ?? "0") || 0;
}

/**
 * Given a Record element with type=HKCategoryTypeIdentifierSleepAnalysis,
 * return the duration in hours if the value indicates actual sleep.
 */
function sleepDurationHours(el: Element): number {
  const val = attr(el, "value");
  // Only count "asleep" states, not "in bed"
  const isAsleep =
    val.includes("AsleepUnspecified") ||
    val.includes("AsleepCore") ||
    val.includes("AsleepDeep") ||
    val.includes("AsleepREM") ||
    val === "1" || // legacy value for HKCategoryValueSleepAnalysisAsleep
    val.includes("Asleep");
  if (!isAsleep) return 0;
  const start = new Date(attr(el, "startDate")).getTime();
  const end = new Date(attr(el, "endDate")).getTime();
  if (!start || !end || end <= start) return 0;
  return (end - start) / 3_600_000;
}

export interface ParseResult {
  snapshot: HealthSnapshot;
  warnings: string[];
}

export async function parseHealthExport(file: File): Promise<ParseResult> {
  const warnings: string[] = [];
  const today = todayISO();

  // ── 1. Read file text ──────────────────────────────────────────────────────
  let rawText: string;
  try {
    rawText = await file.text();
  } catch {
    throw new Error("Could not read file. Make sure you selected export.xml.");
  }

  if (!rawText.includes("HealthData") && !rawText.includes("Record")) {
    throw new Error(
      "This doesn't look like an Apple Health export file. Make sure you uploaded export.xml (not a zip or other file).",
    );
  }

  // ── 2. Pre-filter to lines containing today's date ─────────────────────────
  // This keeps memory usage manageable for multi-year exports (which can be
  // hundreds of MB). The filter is a simple string match before any XML parsing.
  const lines = rawText.split(/\r?\n/);
  const todayLines = lines.filter((l) => l.includes(today));

  if (todayLines.length === 0) {
    // Try yesterday in case the export is slightly behind local time
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ytd = yesterday.toISOString().slice(0, 10);
    const ytdLines = lines.filter((l) => l.includes(ytd));
    if (ytdLines.length > 0) {
      warnings.push(
        "No data found for today — showing yesterday's data instead.",
      );
      return parseLines(ytdLines, ytd, warnings);
    }
    throw new Error(
      `No health records found for today (${today}). The export may be from an older date. Try syncing your Apple Watch and re-exporting.`,
    );
  }

  return parseLines(todayLines, today, warnings);
}

function parseLines(
  todayLines: string[],
  today: string,
  warnings: string[],
): ParseResult {
  // ── 3. Wrap in minimal XML document and parse ──────────────────────────────
  const xmlChunk = `<HealthData>\n${todayLines.join("\n")}\n</HealthData>`;
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlChunk, "text/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    // Retry with entity-stripped version
    const cleaned = xmlChunk.replace(/&(?!amp;|lt;|gt;|quot;|apos;)[^;]+;/g, "");
    const doc2 = parser.parseFromString(cleaned, "text/xml");
    if (doc2.querySelector("parsererror")) {
      warnings.push("Some records could not be parsed — partial data shown.");
    }
  }

  const records = Array.from(doc.querySelectorAll("Record"));
  const workoutEls = Array.from(doc.querySelectorAll("Workout"));

  // ── 4. Aggregate metrics ───────────────────────────────────────────────────

  const sumType = (type: string) =>
    records
      .filter((r) => attr(r, "type") === type)
      .reduce((s, r) => s + floatAttr(r, "value"), 0);

  const avgType = (type: string): number | null => {
    const vals = records
      .filter((r) => attr(r, "type") === type)
      .map((r) => floatAttr(r, "value"))
      .filter((v) => v > 0);
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  const latestType = (type: string): number | null => {
    const matching = records
      .filter((r) => attr(r, "type") === type)
      .map((r) => ({ v: floatAttr(r, "value"), t: new Date(attr(r, "startDate")).getTime() }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.t - a.t);
    return matching[0]?.v ?? null;
  };

  // Steps: sum all step count records for today
  const steps = Math.round(sumType("HKQuantityTypeIdentifierStepCount"));

  // Distance: sum walking/running distance (may be in meters or miles)
  let distRaw = sumType("HKQuantityTypeIdentifierDistanceWalkingRunning");
  // Apple exports in meters on metric, miles on imperial. Heuristic: if < 100, assume miles
  const distanceMeters =
    distRaw > 0
      ? distRaw < 100
        ? Math.round(distRaw * 1609.34)
        : Math.round(distRaw)
      : 0;

  // Active energy (Cal / kcal — Apple uses Cal = kcal)
  const activeEnergyKcal = Math.round(
    sumType("HKQuantityTypeIdentifierActiveEnergyBurned"),
  );

  // Exercise time (minutes)
  const exerciseMinutes = Math.round(
    sumType("HKQuantityTypeIdentifierAppleExerciseTime"),
  );

  // Heart rate
  const heartRateAvg = avgType("HKQuantityTypeIdentifierHeartRate");
  const restingHeartRate = latestType("HKQuantityTypeIdentifierRestingHeartRate");
  const hrvMs = latestType("HKQuantityTypeIdentifierHeartRateVariabilitySDNN");

  // Sleep: sum all asleep intervals
  const sleepHours = Math.round(
    records
      .filter((r) => attr(r, "type") === "HKCategoryTypeIdentifierSleepAnalysis")
      .reduce((s, r) => s + sleepDurationHours(r), 0) * 10,
  ) / 10;

  // Workouts
  const workouts = workoutEls.map((w) => {
    const actType = attr(w, "workoutActivityType");
    const durationMin =
      parseFloat(attr(w, "duration")) ||
      (() => {
        const s = new Date(attr(w, "startDate")).getTime();
        const e = new Date(attr(w, "endDate")).getTime();
        return e > s ? Math.round((e - s) / 60_000) : 0;
      })();
    return {
      type: WORKOUT_NAMES[actType] ?? actType.replace("HKWorkoutActivityType", ""),
      durationMin: Math.round(durationMin),
      energyKcal: Math.round(floatAttr(w, "totalEnergyBurned")),
      startedAt: new Date(attr(w, "startDate")).getTime(),
    };
  });

  const snapshot: HealthSnapshot = {
    date: today,
    steps,
    distanceMeters,
    activeEnergyKcal,
    exerciseMinutes,
    restingHeartRate,
    heartRateAvg,
    hrvMs,
    sleepHours,
    workouts,
    fetchedAt: Date.now(),
  };

  return { snapshot, warnings };
}
