import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarPlus,
  Check,
  Copy,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useRecurringSync } from "@/hooks/useRecurringSync";
import { EVENT_COLORS, EVENT_EMOJIS } from "@/lib/agenda";
import {
  deleteTemplate,
  tocssColor,
  upsertTemplate,
  type RecurringTemplate,
  type RecurrenceType,
} from "@/lib/recurring";
import {
  PLAN_DAYS,
  addArea,
  addItem,
  analyzeUsage,
  cellKey,
  dowToPlanDay,
  loadPlan,
  planDayToDow,
  removeArea,
  removeItem,
  repeatItemAllWeek,
  savePlan,
  updateArea,
  updateItem,
  type PlanArea,
  type PlanItem,
  type PlanSuggestion,
  type WeeklyPlan,
} from "@/lib/weeklyPlan";

/* ---------- helpers ---------- */

function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

const REPEAT_OPTIONS: { value: string; label: (day: string) => string }[] = [
  { value: "weekly", label: (d) => `Every ${d}` },
  { value: "weekdays", label: () => "Weekdays (Mon–Fri)" },
  { value: "weekends", label: () => "Weekends" },
  { value: "daily", label: () => "Every day" },
];

/* ─────────────────────────────────────────────────────────
   CONVERT → SCHEDULE DIALOG
   Turns a plan item into a recurring routine block that shows
   up in the Daily Schedule + Agenda.
───────────────────────────────────────────────────────── */

interface ConvertDialogProps {
  item: PlanItem;
  area: PlanArea;
  dayIdx: number;
  onConfirm: (template: RecurringTemplate) => void;
  onClose: () => void;
}

function ConvertDialog({ item, area, dayIdx, onConfirm, onClose }: ConvertDialogProps) {
  const [title, setTitle] = useState(item.text);
  const [emoji, setEmoji] = useState(item.emoji ?? area.emoji ?? "");
  const [color, setColor] = useState(area.color ?? "270 40% 55%");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("08:00");
  const [repeat, setRepeat] = useState("weekly");
  const [showEmojis, setShowEmojis] = useState(false);

  const handleConfirm = () => {
    if (!title.trim()) return;
    let recurrence: RecurrenceType = "daily";
    let days: number[] | undefined;
    if (repeat === "weekly") {
      recurrence = "custom";
      days = [planDayToDow(dayIdx)];
    } else if (repeat === "weekdays") recurrence = "weekdays";
    else if (repeat === "weekends") recurrence = "weekends";
    else recurrence = "daily";

    const template: RecurringTemplate = {
      id: crypto.randomUUID(),
      title: title.trim(),
      emoji: emoji || undefined,
      color,
      startTime,
      endTime,
      recurrence,
      days,
      enabled: true,
      routineGroup: area.name,
    };
    onConfirm(template);
  };

  const colorCss = tocssColor(color);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm bg-popover border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-gold" />
            Add to schedule
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Creates a routine block under <span className="text-foreground">{area.name}</span>.
            It'll appear in your Daily Schedule and Agenda.
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Title + emoji */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowEmojis((s) => !s)}
              className="shrink-0 h-12 w-12 rounded-xl border border-border bg-background/60 text-2xl hover:border-gold transition-colors"
            >
              {emoji || "＋"}
            </button>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 h-12 text-base bg-background/60 border-border"
              autoFocus
            />
          </div>

          {showEmojis && (
            <div className="grid grid-cols-10 gap-1 rounded-md border border-border bg-background/60 p-2">
              {EVENT_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { setEmoji(e); setShowEmojis(false); }}
                  className={`text-xl rounded p-1 hover:bg-muted ${emoji === e ? "bg-gold/20" : ""}`}
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          {/* Color */}
          <div className="space-y-1.5">
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Color</span>
            <div className="flex flex-wrap gap-2">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c.hsl}
                  type="button"
                  onClick={() => setColor(c.hsl)}
                  className="h-7 w-7 rounded-full border-2 transition-all"
                  style={{
                    background: tocssColor(c.hsl),
                    borderColor: color === c.hsl ? "hsl(var(--gold))" : "transparent",
                  }}
                />
              ))}
              <label className="h-7 w-7 rounded-full border-2 border-border overflow-hidden cursor-pointer">
                <input
                  type="color"
                  value={colorCss.startsWith("#") ? colorCss : "#9b59b6"}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-9 -translate-x-1 -translate-y-1 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full h-11 rounded-md border border-border bg-background/60 px-3 text-base text-foreground"
              />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">End</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full h-11 rounded-md border border-border bg-background/60 px-3 text-base text-foreground"
              />
            </div>
          </div>

          {/* Repeat */}
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Repeat</label>
            <div className="grid grid-cols-2 gap-2">
              {REPEAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRepeat(opt.value)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    repeat === opt.value
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-border bg-background/40 text-muted-foreground hover:border-gold/40"
                  }`}
                >
                  {opt.label(PLAN_DAYS[dayIdx])}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleConfirm}
              disabled={!title.trim()}
              className="flex-1 h-12 bg-gradient-gold text-primary-foreground hover:opacity-90 text-base"
            >
              <CalendarPlus className="h-4 w-4 mr-1.5" />
              Add to schedule
            </Button>
            <Button variant="outline" onClick={onClose} className="h-12 border-border">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────
   AREA EDIT DIALOG — rename / emoji / color / delete
───────────────────────────────────────────────────────── */

interface AreaDialogProps {
  area: PlanArea | null; // null = creating
  onSave: (name: string, emoji: string, color: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function AreaDialog({ area, onSave, onDelete, onClose }: AreaDialogProps) {
  const [name, setName] = useState(area?.name ?? "");
  const [emoji, setEmoji] = useState(area?.emoji ?? "📌");
  const [color, setColor] = useState(area?.color ?? "270 40% 55%");
  const [showEmojis, setShowEmojis] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm bg-popover border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {area ? "Edit area" : "New area"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowEmojis((s) => !s)}
              className="shrink-0 h-12 w-12 rounded-xl border border-border bg-background/60 text-2xl hover:border-gold transition-colors"
            >
              {emoji || "＋"}
            </button>
            <Input
              placeholder="e.g. Relationships"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 h-12 text-base bg-background/60 border-border"
              autoFocus
            />
          </div>

          {showEmojis && (
            <div className="grid grid-cols-10 gap-1 rounded-md border border-border bg-background/60 p-2">
              {EVENT_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { setEmoji(e); setShowEmojis(false); }}
                  className={`text-xl rounded p-1 hover:bg-muted ${emoji === e ? "bg-gold/20" : ""}`}
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Color</span>
            <div className="flex flex-wrap gap-2">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c.hsl}
                  type="button"
                  onClick={() => setColor(c.hsl)}
                  className="h-7 w-7 rounded-full border-2 transition-all"
                  style={{
                    background: tocssColor(c.hsl),
                    borderColor: color === c.hsl ? "hsl(var(--gold))" : "transparent",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              onClick={() => name.trim() && onSave(name.trim(), emoji, color)}
              disabled={!name.trim()}
              className="flex-1 h-12 bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              <Check className="h-4 w-4 mr-1.5" />
              {area ? "Save" : "Add area"}
            </Button>
            {area && onDelete && (
              <Button
                variant="outline"
                onClick={onDelete}
                className="h-12 border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────
   ADAPTIVE INSIGHTS STRIP
───────────────────────────────────────────────────────── */

function InsightsStrip({
  suggestions,
  onPromote,
  onOpenSchedule,
}: {
  suggestions: PlanSuggestion[];
  onPromote: (s: PlanSuggestion) => void;
  onOpenSchedule: () => void;
}) {
  if (suggestions.length === 0) return null;

  const tone: Record<PlanSuggestion["kind"], string> = {
    win: "border-teal/30 bg-teal/5",
    slip: "border-amber-500/30 bg-amber-500/5",
    promote: "border-gold/30 bg-gold/5",
  };

  return (
    <Card className="p-4 bg-gradient-card border-border space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-gold" />
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
          Adapts to how you actually use your week
        </span>
      </div>
      <div className="space-y-2">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${tone[s.kind]}`}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{s.title}</div>
              <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{s.detail}</div>
            </div>
            {s.kind === "promote" && (
              <Button
                size="sm"
                onClick={() => onPromote(s)}
                className="shrink-0 h-8 bg-gradient-gold text-primary-foreground hover:opacity-90"
              >
                <CalendarPlus className="h-3.5 w-3.5 mr-1" />
                Schedule
              </Button>
            )}
            {s.kind === "slip" && (
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenSchedule}
                className="shrink-0 h-8 border-border text-muted-foreground hover:text-foreground"
              >
                Adjust <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────
   ITEM ROW
───────────────────────────────────────────────────────── */

function ItemRow({
  item,
  accent,
  onToggle,
  onEdit,
  onDelete,
  onSchedule,
  onRepeat,
  onUnschedule,
}: {
  item: PlanItem;
  accent: string;
  onToggle: () => void;
  onEdit: (text: string) => void;
  onDelete: () => void;
  onSchedule: () => void;
  onRepeat: () => void;
  onUnschedule: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== item.text) onEdit(t);
    else setDraft(item.text);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <button
        type="button"
        onClick={onToggle}
        className={`h-5 w-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
          item.done ? "bg-gold border-gold text-primary-foreground" : "border-border hover:border-gold/60"
        }`}
        style={!item.done ? { borderColor: tocssColor(accent) + "66" } : undefined}
      >
        {item.done && <Check className="h-3 w-3" />}
      </button>

      {editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(item.text); setEditing(false); }
          }}
          autoFocus
          className="flex-1 min-w-0 rounded border border-gold/40 bg-background/60 px-2 py-1 text-sm text-foreground focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`flex-1 min-w-0 text-left text-sm truncate ${
            item.done ? "line-through text-muted-foreground" : "text-foreground"
          }`}
        >
          {item.text}
        </button>
      )}

      {item.templateId ? (
        <button
          type="button"
          onClick={onUnschedule}
          title="Remove from schedule"
          className="shrink-0 font-mono text-[8px] tracking-[0.15em] uppercase text-gold border border-gold/40 rounded px-1.5 py-0.5 hover:bg-gold/10 transition-colors"
        >
          📅 on schedule ✕
        </button>
      ) : (
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onSchedule}
            title="Add to schedule"
            className="p-1.5 rounded-md text-muted-foreground hover:text-gold transition-colors"
          >
            <CalendarPlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRepeat}
            title="Repeat all week"
            className="p-1.5 rounded-md text-muted-foreground hover:text-teal transition-colors"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   AREA SECTION (one area's items for the selected day)
───────────────────────────────────────────────────────── */

function AreaSection({
  area,
  dayIdx,
  items,
  onEditArea,
  onAddItem,
  onToggleItem,
  onEditItem,
  onDeleteItem,
  onScheduleItem,
  onRepeatItem,
  onUnscheduleItem,
}: {
  area: PlanArea;
  dayIdx: number;
  items: PlanItem[];
  onEditArea: () => void;
  onAddItem: (text: string) => void;
  onToggleItem: (id: string) => void;
  onEditItem: (id: string, text: string) => void;
  onDeleteItem: (id: string) => void;
  onScheduleItem: (item: PlanItem) => void;
  onRepeatItem: (id: string) => void;
  onUnscheduleItem: (item: PlanItem) => void;
}) {
  const [draft, setDraft] = useState("");
  const accent = area.color ?? "270 40% 55%";

  const add = () => {
    if (!draft.trim()) return;
    onAddItem(draft.trim());
    setDraft("");
  };

  const doneCount = items.filter((i) => i.done).length;

  return (
    <Card className="bg-gradient-card border-border overflow-hidden">
      {/* header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-border/40"
        style={{ background: `linear-gradient(90deg, ${tocssColor(accent)}14, transparent)` }}
      >
        <span
          className="h-8 w-8 rounded-lg shrink-0 flex items-center justify-center text-base"
          style={{ background: tocssColor(accent) }}
        >
          {area.emoji ?? "📌"}
        </span>
        <button
          type="button"
          onClick={onEditArea}
          className="flex-1 text-left flex items-center gap-2 group"
        >
          <span className="font-display text-base text-foreground">{area.name}</span>
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        {items.length > 0 && (
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
            {doneCount}/{items.length}
          </span>
        )}
      </div>

      {/* items */}
      <div className="px-4 py-2">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground/50 py-1">No items yet — add one below.</p>
        )}
        {items.map((it) => (
          <ItemRow
            key={it.id}
            item={it}
            accent={accent}
            onToggle={() => onToggleItem(it.id)}
            onEdit={(text) => onEditItem(it.id, text)}
            onDelete={() => onDeleteItem(it.id)}
            onSchedule={() => onScheduleItem(it)}
            onRepeat={() => onRepeatItem(it.id)}
            onUnschedule={() => onUnscheduleItem(it)}
          />
        ))}

        {/* add item */}
        <div className="flex items-center gap-2 pt-1.5 mt-1 border-t border-border/30">
          <Plus className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder="Add an item…"
            className="flex-1 bg-transparent py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
          />
          {draft.trim() && (
            <button
              type="button"
              onClick={add}
              className="shrink-0 font-mono text-[10px] tracking-wider uppercase text-gold hover:text-gold/80"
            >
              Add
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────── */

export default function Planner() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pushTemplateOp, deleteTemplateOp } = useRecurringSync(user?.id);

  const [plan, setPlan] = useState<WeeklyPlan>(() => loadPlan());
  const [selectedDay, setSelectedDay] = useState<number>(() =>
    dowToPlanDay(new Date().getDay()),
  );
  const [converting, setConverting] = useState<{ item: PlanItem; area: PlanArea; dayIdx: number } | null>(null);
  const [areaDialog, setAreaDialog] = useState<{ area: PlanArea | null } | null>(null);

  const todayIdx = dowToPlanDay(new Date().getDay());

  // Persist + recompute suggestions whenever the plan changes.
  const commit = useCallback((next: WeeklyPlan) => {
    setPlan(next);
    savePlan(next);
  }, []);

  // Recompute insights when plan changes or schedule completions sync in.
  const [suggestVersion, setSuggestVersion] = useState(0);
  useEffect(() => {
    const bump = () => setSuggestVersion((v) => v + 1);
    window.addEventListener("alfred.recurring:changed", bump);
    return () => window.removeEventListener("alfred.recurring:changed", bump);
  }, []);
  const suggestions = useMemo(
    () => analyzeUsage(plan),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, suggestVersion],
  );

  /* ── item mutations ── */
  const handleAddItem = (areaId: string, text: string) =>
    commit(addItem(plan, areaId, selectedDay, text));

  const handleToggleItem = (areaId: string, id: string) => {
    const list = plan.items[cellKey(areaId, selectedDay)] ?? [];
    const cur = list.find((i) => i.id === id);
    commit(updateItem(plan, areaId, selectedDay, id, { done: !cur?.done }));
  };

  const handleEditItem = (areaId: string, id: string, text: string) =>
    commit(updateItem(plan, areaId, selectedDay, id, { text }));

  const handleDeleteItem = (areaId: string, id: string) =>
    commit(removeItem(plan, areaId, selectedDay, id));

  const handleRepeatItem = (areaId: string, id: string) => {
    commit(repeatItemAllWeek(plan, areaId, selectedDay, id));
    toast({ title: "Repeated across the week" });
  };

  /* ── schedule conversion ── */
  const handleConfirmConvert = (template: RecurringTemplate) => {
    if (!converting) return;
    upsertTemplate(template); // writes localStorage + fires RECURRING_CHANGED
    pushTemplateOp(template); // cloud sync
    commit(
      updateItem(plan, converting.area.id, converting.dayIdx, converting.item.id, {
        templateId: template.id,
      }),
    );
    setConverting(null);
    toast({
      title: "Added to schedule",
      description: `${template.title} · ${formatTime12(template.startTime)}`,
    });
  };

  const handleUnschedule = (areaId: string, dayIdx: number, item: PlanItem) => {
    if (item.templateId) {
      deleteTemplate(item.templateId);
      deleteTemplateOp(item.templateId);
    }
    commit(updateItem(plan, areaId, dayIdx, item.id, { templateId: undefined }));
    toast({ title: "Removed from schedule" });
  };

  /* ── area mutations ── */
  const handleSaveArea = (name: string, emoji: string, color: string) => {
    if (areaDialog?.area) {
      commit(updateArea(plan, areaDialog.area.id, { name, emoji, color }));
    } else {
      const withArea = addArea(plan, name);
      const created = withArea.areas[withArea.areas.length - 1];
      commit(updateArea(withArea, created.id, { emoji, color }));
    }
    setAreaDialog(null);
  };

  const handleDeleteArea = () => {
    if (!areaDialog?.area) return;
    commit(removeArea(plan, areaDialog.area.id));
    setAreaDialog(null);
    toast({ title: "Area removed" });
  };

  /* ── promote from insights ── */
  const handlePromote = (s: PlanSuggestion) => {
    if (!s.item || !s.areaId || s.dayIdx === undefined) return;
    const area = plan.areas.find((a) => a.id === s.areaId);
    if (!area) return;
    setConverting({ item: s.item, area, dayIdx: s.dayIdx });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Strategy"
        title="Weekly Planner"
        description="Draft the week as lists. Push any item into your schedule with one tap."
        actions={
          <Button
            onClick={() => setAreaDialog({ area: null })}
            className="bg-gradient-gold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add area
          </Button>
        }
      />

      <InsightsStrip
        suggestions={suggestions}
        onPromote={handlePromote}
        onOpenSchedule={() => navigate("/schedule")}
      />

      {/* Day selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {PLAN_DAYS.map((d, i) => {
          const active = i === selectedDay;
          const isToday = i === todayIdx;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDay(i)}
              className={`flex-1 min-w-[60px] rounded-xl border py-2.5 transition-all ${
                active
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-border bg-background/30 text-muted-foreground hover:border-gold/40"
              }`}
            >
              <div className="font-mono text-[11px] tracking-[0.15em] uppercase">{d}</div>
              {isToday && (
                <div className="font-mono text-[8px] tracking-[0.2em] uppercase mt-0.5 opacity-70">
                  today
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Areas for the selected day */}
      <div className="space-y-3">
        {plan.areas.map((area) => (
          <AreaSection
            key={area.id}
            area={area}
            dayIdx={selectedDay}
            items={plan.items[cellKey(area.id, selectedDay)] ?? []}
            onEditArea={() => setAreaDialog({ area })}
            onAddItem={(text) => handleAddItem(area.id, text)}
            onToggleItem={(id) => handleToggleItem(area.id, id)}
            onEditItem={(id, text) => handleEditItem(area.id, id, text)}
            onDeleteItem={(id) => handleDeleteItem(area.id, id)}
            onScheduleItem={(item) => setConverting({ item, area, dayIdx: selectedDay })}
            onRepeatItem={(id) => handleRepeatItem(area.id, id)}
            onUnscheduleItem={(item) => handleUnschedule(area.id, selectedDay, item)}
          />
        ))}

        {plan.areas.length === 0 && (
          <Card className="p-10 bg-gradient-card border-border text-center">
            <div className="text-5xl mb-4">🗂️</div>
            <h3 className="font-display text-2xl text-foreground mb-2">No areas yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
              Add an area like Body, Money, or Skills, then start listing what you'll do each day.
            </p>
            <Button
              onClick={() => setAreaDialog({ area: null })}
              className="bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add your first area
            </Button>
          </Card>
        )}
      </div>

      <p className="font-mono text-[9px] tracking-wider text-muted-foreground/60 text-center pb-4">
        Tap an item's calendar icon to turn it into a routine block. Scheduled blocks
        sync to your Daily Schedule and Agenda.
      </p>

      {/* Dialogs */}
      {converting && (
        <ConvertDialog
          item={converting.item}
          area={converting.area}
          dayIdx={converting.dayIdx}
          onConfirm={handleConfirmConvert}
          onClose={() => setConverting(null)}
        />
      )}
      {areaDialog && (
        <AreaDialog
          area={areaDialog.area}
          onSave={handleSaveArea}
          onDelete={areaDialog.area ? handleDeleteArea : undefined}
          onClose={() => setAreaDialog(null)}
        />
      )}
    </div>
  );
}
