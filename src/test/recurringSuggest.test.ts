import { describe, it, expect } from "vitest";
import { suggestRetimes } from "@/lib/recurringSuggest";
import { todayKey } from "@/lib/alfred";
import type { RecurringTemplate } from "@/lib/recurring";

const NOW = new Date(2026, 7, 7, 20, 0, 0); // Friday, Aug 7 2026

function template(over: Partial<RecurringTemplate> = {}): RecurringTemplate {
  return {
    id: "tpl1",
    title: "SIE Study",
    startTime: "07:10",
    endTime: "07:50",
    recurrence: "daily",
    days: [],
    enabled: true,
    ...over,
  };
}

/** Build completions/completionTimes for the last `count` days, each done
 *  `offsetMinutes` after the scheduled start (07:10). */
function seedHistory(count: number, offsetMinutes: number) {
  const completions: Record<string, true> = {};
  const completionTimes: Record<string, number> = {};
  for (let i = 1; i <= count; i++) {
    const day = new Date(NOW);
    day.setDate(day.getDate() - i);
    const dateStr = todayKey(day);
    const key = `tpl1:${dateStr}`;
    completions[key] = true;
    const actual = new Date(day);
    actual.setHours(7, 10 + offsetMinutes, 0, 0);
    completionTimes[key] = actual.getTime();
  }
  return { completions, completionTimes };
}

describe("suggestRetimes", () => {
  it("suggests a later time when consistently done ~40 min late", () => {
    const { completions, completionTimes } = seedHistory(6, 40);
    const result = suggestRetimes([template()], completions, completionTimes, NOW);
    expect(result).toHaveLength(1);
    expect(result[0].suggestedStart).toBe("07:50");
    expect(result[0].avgOffsetMinutes).toBe(40);
    expect(result[0].sampleSize).toBe(6);
  });

  it("does nothing with too few samples", () => {
    const { completions, completionTimes } = seedHistory(2, 40);
    expect(suggestRetimes([template()], completions, completionTimes, NOW)).toHaveLength(0);
  });

  it("does nothing when the offset is small", () => {
    const { completions, completionTimes } = seedHistory(6, 5);
    expect(suggestRetimes([template()], completions, completionTimes, NOW)).toHaveLength(0);
  });

  it("does nothing when the pattern is inconsistent (mixed early/late)", () => {
    const completions: Record<string, true> = {};
    const completionTimes: Record<string, number> = {};
    for (let i = 1; i <= 6; i++) {
      const day = new Date(NOW);
      day.setDate(day.getDate() - i);
      const dateStr = todayKey(day);
      const key = `tpl1:${dateStr}`;
      completions[key] = true;
      const actual = new Date(day);
      // alternate 45 min late / 45 min early — cancels out in aggregate and
      // fails the same-direction consistency check either way.
      actual.setHours(7, 10 + (i % 2 === 0 ? 45 : -45), 0, 0);
      completionTimes[key] = actual.getTime();
    }
    expect(suggestRetimes([template()], completions, completionTimes, NOW)).toHaveLength(0);
  });

  it("ignores a disabled template", () => {
    const { completions, completionTimes } = seedHistory(6, 40);
    const result = suggestRetimes([template({ enabled: false })], completions, completionTimes, NOW);
    expect(result).toHaveLength(0);
  });

  it("only counts days the template actually applies to (weekdays)", () => {
    // 40 min late every weekday for ~3 weeks — should still find 6+ weekday samples.
    const completions: Record<string, true> = {};
    const completionTimes: Record<string, number> = {};
    for (let i = 1; i <= 21; i++) {
      const day = new Date(NOW);
      day.setDate(day.getDate() - i);
      const dow = day.getDay();
      if (dow === 0 || dow === 6) continue; // weekend — template doesn't apply
      const dateStr = todayKey(day);
      const key = `tpl1:${dateStr}`;
      completions[key] = true;
      const actual = new Date(day);
      actual.setHours(7, 50, 0, 0);
      completionTimes[key] = actual.getTime();
    }
    const result = suggestRetimes(
      [template({ recurrence: "weekdays" })],
      completions,
      completionTimes,
      NOW,
    );
    expect(result).toHaveLength(1);
    expect(result[0].suggestedStart).toBe("07:50");
  });
});
