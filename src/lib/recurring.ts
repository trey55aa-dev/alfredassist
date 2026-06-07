// Recurring event templates for the daily schedule builder.
// Templates live in localStorage. Instances are generated on-the-fly each day
// and carry their own per-day completion + skip state.

import { todayKey } from "./alfred";
import type { AgendaEvent } from "./agenda";

export type RecurrenceType = "daily" | "weekdays" | "weekends" | "custom";

export interface RecurringTemplate {
  id: string;
  title: string;
  emoji?: string;
  color?: string; // HSL string, e.g. "270 40% 55%"
  startTime: string; // "HH:MM" 24-hour
  endTime: string;   // "HH:MM" 24-hour
  recurrence: RecurrenceType;
  days?: number[]; // 0=Sun … 6=Sat — used when recurrence="custom"
  enabled: boolean;
}

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  daily:    "Every day",
  weekdays: "Mon – Fri",
  weekends: "Sat & Sun",
  custom:   "Custom days",
};

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TEMPLATES_KEY   = "alfred.recurring.templates";
const COMPLETIONS_KEY = "alfred.recurring.completions"; // Record<"id:YYYY-MM-DD", true>
const SKIPPED_KEY     = "alfred.recurring.skipped";     // Record<"id:YYYY-MM-DD", true>

/* ---------- CRUD ---------- */

export function loadTemplates(): RecurringTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    return raw ? (JSON.parse(raw) as RecurringTemplate[]) : [];
  } catch {
    return [];
  }
}

export function saveTemplates(templates: RecurringTemplate[]): void {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

export function upsertTemplate(t: RecurringTemplate): void {
  const all = loadTemplates();
  const idx = all.findIndex((x) => x.id === t.id);
  if (idx >= 0) all[idx] = t;
  else all.push(t);
  saveTemplates(all);
}

export function deleteTemplate(id: string): void {
  saveTemplates(loadTemplates().filter((t) => t.id !== id));
}

/* ---------- Applicability ---------- */

export function isApplicableToDate(t: RecurringTemplate, date: Date): boolean {
  if (!t.enabled) return false;
  const dow = date.getDay(); // 0=Sun, 6=Sat
  switch (t.recurrence) {
    case "daily":    return true;
    case "weekdays": return dow >= 1 && dow <= 5;
    case "weekends": return dow === 0 || dow === 6;
    case "custom":   return (t.days ?? []).includes(dow);
  }
}

export function getTemplatesForDate(
  templates: RecurringTemplate[],
  date: Date,
): RecurringTemplate[] {
  return templates.filter((t) => isApplicableToDate(t, date));
}

/* ---------- Per-day completion ---------- */

function readRecord(key: string): Record<string, true> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, true>) : {};
  } catch {
    return {};
  }
}

function writeRecord(key: string, record: Record<string, true>): void {
  localStorage.setItem(key, JSON.stringify(record));
}

const compKey = (templateId: string, dateStr: string) => `${templateId}:${dateStr}`;

export function isRecurringCompleted(templateId: string, dateStr: string): boolean {
  return !!readRecord(COMPLETIONS_KEY)[compKey(templateId, dateStr)];
}

export function setRecurringCompleted(
  templateId: string,
  dateStr: string,
  value: boolean,
): void {
  const rec = readRecord(COMPLETIONS_KEY);
  const k = compKey(templateId, dateStr);
  if (value) rec[k] = true;
  else delete rec[k];
  writeRecord(COMPLETIONS_KEY, rec);
}

export function isRecurringSkipped(templateId: string, dateStr: string): boolean {
  return !!readRecord(SKIPPED_KEY)[compKey(templateId, dateStr)];
}

export function setRecurringSkipped(
  templateId: string,
  dateStr: string,
  value: boolean,
): void {
  const rec = readRecord(SKIPPED_KEY);
  const k = compKey(templateId, dateStr);
  if (value) rec[k] = true;
  else delete rec[k];
  writeRecord(SKIPPED_KEY, rec);
}

/* ---------- Instance generation ---------- */

/** ID format: "rec:{templateId}:{YYYY-MM-DD}" — colons never appear in UUIDs or dates. */
export function recurringInstanceId(templateId: string, dateStr: string): string {
  return `rec:${templateId}:${dateStr}`;
}

export function parseRecurringInstanceId(
  id: string,
): { templateId: string; dateStr: string } | null {
  if (!id.startsWith("rec:")) return null;
  const [, templateId, dateStr] = id.split(":");
  if (!templateId || !dateStr) return null;
  return { templateId, dateStr };
}

export function templateToAgendaEvent(
  template: RecurringTemplate,
  date: Date,
): AgendaEvent {
  const dateStr = todayKey(date);
  const [sh, sm] = template.startTime.split(":").map(Number);
  const [eh, em] = template.endTime.split(":").map(Number);

  const start = new Date(date);
  start.setHours(sh, sm, 0, 0);
  const end = new Date(date);
  end.setHours(eh, em, 0, 0);
  // Wrap past midnight
  if (end <= start) end.setDate(end.getDate() + 1);

  return {
    id: recurringInstanceId(template.id, dateStr),
    title: template.title,
    start: start.toISOString(),
    end: end.toISOString(),
    source: "recurring" as AgendaEvent["source"],
    emoji: template.emoji,
    calendarColor: template.color ?? "270 40% 55%",
    completed: isRecurringCompleted(template.id, dateStr),
  };
}

export function getRecurringInstances(date: Date): AgendaEvent[] {
  const dateStr = todayKey(date);
  const templates = loadTemplates();
  return getTemplatesForDate(templates, date)
    .filter((t) => !isRecurringSkipped(t.id, dateStr))
    .map((t) => templateToAgendaEvent(t, date));
}
