import { useState, useCallback } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { EVENT_COLORS, EVENT_EMOJIS } from "@/lib/agenda";
import {
  DAY_NAMES,
  RECURRENCE_LABELS,
  RecurrenceType,
  RecurringTemplate,
  deleteTemplate,
  getTemplatesForDate,
  isApplicableToDate,
  loadTemplates,
  saveTemplates,
  upsertTemplate,
} from "@/lib/recurring";
import { nanoid } from "nanoid";

const DEFAULT_COLOR = "270 40% 55%";

/* ---------- Helpers ---------- */

function hslToHex(hsl: string): string {
  const parts = hsl.split(/\s+/);
  const h = parseFloat(parts[0]) || 0;
  const s = parseFloat(parts[1]) / 100 || 0;
  const l = parseFloat(parts[2]) / 100 || 0;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function recurrenceSummary(t: RecurringTemplate): string {
  if (t.recurrence === "custom") {
    const names = (t.days ?? [])
      .slice()
      .sort((a, b) => a - b)
      .map((d) => DAY_NAMES[d]);
    return names.join(", ") || "No days selected";
  }
  return RECURRENCE_LABELS[t.recurrence];
}

/* ---------- Empty blank for new template form ---------- */

function blankTemplate(): Partial<RecurringTemplate> {
  return {
    title: "",
    emoji: undefined,
    color: DEFAULT_COLOR,
    startTime: "07:00",
    endTime: "08:00",
    recurrence: "daily",
    days: [],
    enabled: true,
  };
}

/* ---------- Form Dialog ---------- */

interface FormDialogProps {
  initial: Partial<RecurringTemplate>;
  onSave: (t: RecurringTemplate) => void;
  onClose: () => void;
}

function FormDialog({ initial, onSave, onClose }: FormDialogProps) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [emoji, setEmoji] = useState(initial.emoji ?? "");
  const [color, setColor] = useState(initial.color ?? DEFAULT_COLOR);
  const [startTime, setStartTime] = useState(initial.startTime ?? "07:00");
  const [endTime, setEndTime] = useState(initial.endTime ?? "08:00");
  const [recurrence, setRecurrence] = useState<RecurrenceType>(
    initial.recurrence ?? "daily",
  );
  const [days, setDays] = useState<number[]>(initial.days ?? []);
  const [showEmojis, setShowEmojis] = useState(false);

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const save = () => {
    if (!title.trim()) return;
    const t: RecurringTemplate = {
      id: initial.id ?? nanoid(),
      title: title.trim(),
      emoji: emoji || undefined,
      color,
      startTime,
      endTime,
      recurrence,
      days: recurrence === "custom" ? days : undefined,
      enabled: initial.enabled ?? true,
    };
    onSave(t);
  };

  const colorHex = hslToHex(color);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm bg-popover border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {initial.id ? "Edit routine block" : "New routine block"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Title + Emoji */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowEmojis((s) => !s)}
              className="shrink-0 h-10 w-10 rounded-md border border-border bg-background/60 text-xl hover:border-gold transition-colors"
              title="Pick emoji"
            >
              {emoji || "＋"}
            </button>
            <Input
              placeholder="e.g. Morning workout"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 bg-background/60 border-border"
              autoFocus
            />
          </div>

          {/* Emoji picker */}
          {showEmojis && (
            <div className="grid grid-cols-10 gap-1 rounded-md border border-border bg-background/60 p-2">
              {EVENT_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { setEmoji(e); setShowEmojis(false); }}
                  className={`text-lg rounded hover:bg-muted p-0.5 ${emoji === e ? "bg-gold/20" : ""}`}
                >
                  {e}
                </button>
              ))}
              {emoji && (
                <button
                  type="button"
                  onClick={() => { setEmoji(""); setShowEmojis(false); }}
                  className="text-[10px] text-muted-foreground hover:text-destructive col-span-2"
                >
                  clear
                </button>
              )}
            </div>
          )}

          {/* Color */}
          <div className="space-y-1.5">
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Color
            </span>
            <div className="flex flex-wrap gap-2">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c.hsl}
                  type="button"
                  title={c.name}
                  onClick={() => setColor(c.hsl)}
                  className="h-6 w-6 rounded-full border-2 transition-all"
                  style={{
                    background: hslToHex(c.hsl),
                    borderColor: color === c.hsl ? "hsl(var(--gold))" : "transparent",
                  }}
                />
              ))}
              <label
                className="h-6 w-6 rounded-full border-2 border-border overflow-hidden cursor-pointer"
                title="Custom color"
              >
                <input
                  type="color"
                  value={colorHex}
                  onChange={(e) => {
                    // Convert hex to approximate HSL string via the browser
                    setColor(e.target.value); // store hex when custom — display still works
                  }}
                  className="h-8 w-8 -translate-x-1 -translate-y-1 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                Start
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-background/60 px-3 text-sm text-foreground"
              />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                End
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-background/60 px-3 text-sm text-foreground"
              />
            </div>
          </div>

          {/* Recurrence */}
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Repeat
            </label>
            <Select
              value={recurrence}
              onValueChange={(v) => setRecurrence(v as RecurrenceType)}
            >
              <SelectTrigger className="bg-background/60 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Every day</SelectItem>
                <SelectItem value="weekdays">Weekdays (Mon – Fri)</SelectItem>
                <SelectItem value="weekends">Weekends (Sat & Sun)</SelectItem>
                <SelectItem value="custom">Custom days…</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Day picker (custom only) */}
          {recurrence === "custom" && (
            <div className="flex gap-1.5 flex-wrap">
              {DAY_NAMES.map((name, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-2.5 py-1 rounded-md font-mono text-[10px] tracking-wider uppercase border transition-all ${
                    days.includes(i)
                      ? "bg-gold text-primary-foreground border-gold"
                      : "bg-background/40 text-muted-foreground border-border hover:border-gold/60"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              onClick={save}
              disabled={!title.trim() || (recurrence === "custom" && days.length === 0)}
              className="flex-1 bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              <Check className="h-4 w-4 mr-1.5" />
              Save
            </Button>
            <Button variant="outline" onClick={onClose} className="border-border">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Template Card ---------- */

interface TemplateCardProps {
  template: RecurringTemplate;
  isToday: boolean;
  onToggle: (id: string) => void;
  onEdit: (t: RecurringTemplate) => void;
  onDelete: (id: string) => void;
}

function TemplateCard({ template: t, isToday, onToggle, onEdit, onDelete }: TemplateCardProps) {
  const colorStr = t.color ?? DEFAULT_COLOR;
  const blockColor = colorStr.includes("#") ? colorStr : hslToHex(colorStr);

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
        t.enabled
          ? "bg-background/50 border-border/60"
          : "bg-background/20 border-border/30 opacity-50"
      }`}
    >
      {/* Color dot + emoji */}
      <div
        className="h-9 w-9 rounded-md shrink-0 flex items-center justify-center text-lg shadow-sm"
        style={{ background: blockColor }}
      >
        {t.emoji ?? <Repeat className="h-4 w-4 text-white/80" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium truncate ${t.enabled ? "text-foreground" : "text-muted-foreground"}`}>
            {t.title}
          </span>
          {isToday && t.enabled && (
            <span className="font-mono text-[8px] tracking-[0.2em] uppercase text-gold border border-gold/40 rounded px-1 shrink-0">
              today
            </span>
          )}
        </div>
        <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
          {formatTime12(t.startTime)} – {formatTime12(t.endTime)} · {recurrenceSummary(t)}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onEdit(t)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-gold hover:bg-muted/60 transition-colors"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(t.id)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted/60 transition-colors"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <Switch
          checked={t.enabled}
          onCheckedChange={() => onToggle(t.id)}
          className="data-[state=checked]:bg-gold h-4 w-7"
        />
      </div>
    </div>
  );
}

/* ---------- Main page ---------- */

type TimeGroup = "morning" | "afternoon" | "evening" | "night";

function timeGroup(hhmm: string): TimeGroup {
  const h = parseInt(hhmm.split(":")[0], 10);
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

const GROUP_LABELS: Record<TimeGroup, string> = {
  morning:   "Morning  (before noon)",
  afternoon: "Afternoon  (noon – 5 pm)",
  evening:   "Evening  (5 – 9 pm)",
  night:     "Night  (after 9 pm)",
};

export default function Schedule() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<RecurringTemplate[]>(() => loadTemplates());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<RecurringTemplate> | null>(null);

  const today = new Date();
  const todaySet = new Set(
    templates.filter((t) => isApplicableToDate(t, today)).map((t) => t.id),
  );

  const reload = () => setTemplates(loadTemplates());

  const handleSave = useCallback(
    (t: RecurringTemplate) => {
      upsertTemplate(t);
      reload();
      setFormOpen(false);
      setEditing(null);
      toast({ title: editing?.id ? "Routine updated" : "Routine added", description: t.title });
    },
    [editing?.id, toast],
  );

  const handleToggle = (id: string) => {
    const all = loadTemplates().map((t) =>
      t.id === id ? { ...t, enabled: !t.enabled } : t,
    );
    saveTemplates(all);
    reload();
  };

  const handleDelete = (id: string) => {
    deleteTemplate(id);
    reload();
    toast({ title: "Routine removed" });
  };

  const sorted = [...templates].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const groups: Record<TimeGroup, RecurringTemplate[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };
  for (const t of sorted) {
    groups[timeGroup(t.startTime)].push(t);
  }

  const enabledCount = templates.filter((t) => t.enabled).length;
  const todayCount = getTemplatesForDate(templates, today).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Your routine"
        title="Daily Schedule"
        description="Build the day you want to live. Recurring blocks appear in your Agenda automatically."
        actions={
          <Button
            onClick={() => { setEditing(blankTemplate()); setFormOpen(true); }}
            className="bg-gradient-gold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add routine block
          </Button>
        }
      />

      {/* Stats bar */}
      {templates.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total blocks",   value: templates.length },
            { label: "Active",          value: enabledCount },
            { label: "On today",        value: todayCount },
          ].map((s) => (
            <Card key={s.label} className="p-4 bg-gradient-card border-border text-center">
              <div className="font-display text-3xl text-gold">{s.value}</div>
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mt-0.5">
                {s.label}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {templates.length === 0 && (
        <Card className="p-10 bg-gradient-card border-border text-center">
          <div className="text-5xl mb-4">🔁</div>
          <h3 className="font-display text-2xl text-foreground mb-2">
            No routine blocks yet
          </h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
            Add your daily routine — workouts, deep work sessions, meals, wind-down time.
            They'll show up in your Agenda timeline every day they're scheduled.
          </p>
          <Button
            onClick={() => { setEditing(blankTemplate()); setFormOpen(true); }}
            className="bg-gradient-gold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add first routine block
          </Button>
        </Card>
      )}

      {/* Groups */}
      {(["morning", "afternoon", "evening", "night"] as TimeGroup[]).map((group) => {
        const items = groups[group];
        if (items.length === 0) return null;
        return (
          <div key={group} className="space-y-2">
            <h3 className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground px-1">
              {GROUP_LABELS[group]}
            </h3>
            <div className="space-y-2">
              {items.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  isToday={todaySet.has(t.id)}
                  onToggle={handleToggle}
                  onEdit={(tmpl) => { setEditing(tmpl); setFormOpen(true); }}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Tip */}
      {templates.length > 0 && (
        <p className="font-mono text-[10px] tracking-wider text-muted-foreground/60 text-center pb-4">
          Recurring blocks appear in your Agenda timeline. Tap the checkbox to mark done, or "Skip today" to hide just for today.
        </p>
      )}

      {/* Form dialog */}
      {formOpen && editing && (
        <FormDialog
          initial={editing}
          onSave={handleSave}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
