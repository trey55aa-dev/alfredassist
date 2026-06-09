import { useState, useCallback, useEffect } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  X,
  Zap,
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
  tocssColor,
  upsertTemplate,
} from "@/lib/recurring";
import {
  ROUTINE_PACKS,
  RoutinePack,
  PackBlock,
  packBlockToTemplate,
  packInstalledCount,
} from "@/lib/routinePacks";

/* ---------- Helpers ---------- */

function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function recurrenceSummary(t: RecurringTemplate): string {
  if (t.recurrence === "custom") {
    return (
      (t.days ?? [])
        .slice()
        .sort((a, b) => a - b)
        .map((d) => DAY_NAMES[d])
        .join(", ") || "No days"
    );
  }
  return RECURRENCE_LABELS[t.recurrence];
}

function blankTemplate(group?: string): Partial<RecurringTemplate> {
  return {
    title: "",
    emoji: undefined,
    color: "270 40% 55%",
    startTime: "07:00",
    endTime: "08:00",
    recurrence: "daily",
    days: [],
    enabled: true,
    routineGroup: group,
  };
}

/* ─────────────────────────────────────────────────────────
   PACK INSTALL DIALOG
   Shows all blocks as a checklist with editable times.
   One tap → all checked blocks created at once.
───────────────────────────────────────────────────────── */

interface PackInstallDialogProps {
  pack: RoutinePack;
  onInstall: (blocks: PackBlock[], groupName: string) => void;
  onClose: () => void;
}

function PackInstallDialog({ pack, onInstall, onClose }: PackInstallDialogProps) {
  const [groupName, setGroupName] = useState(pack.name);
  const [checked, setChecked] = useState<boolean[]>(pack.blocks.map(() => true));
  const [times, setTimes] = useState(
    pack.blocks.map((b) => ({ start: b.startTime, end: b.endTime }))
  );

  const toggleCheck = (i: number) =>
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  const checkedCount = checked.filter(Boolean).length;

  const handleInstall = () => {
    const selected = pack.blocks
      .filter((_, i) => checked[i])
      .map((b, i) => {
        // find original index
        const origIdx = pack.blocks.indexOf(pack.blocks.filter((_, j) => checked[j])[i]);
        return { ...b, startTime: times[origIdx].start, endTime: times[origIdx].end };
      });
    // re-map using original indices
    const selectedBlocks: PackBlock[] = [];
    pack.blocks.forEach((b, i) => {
      if (checked[i]) {
        selectedBlocks.push({ ...b, startTime: times[i].start, endTime: times[i].end });
      }
    });
    onInstall(selectedBlocks, groupName);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-popover border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <span className="text-2xl">{pack.emoji}</span>
            {pack.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{pack.tagline}</p>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Routine name */}
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Routine name
            </label>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="bg-background/60 border-border"
            />
          </div>

          {/* Block checklist */}
          <div className="space-y-1">
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
              Blocks ({checkedCount} selected)
            </div>
            {pack.blocks.map((block, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
                  checked[i]
                    ? "border-border/60 bg-background/40"
                    : "border-border/20 bg-background/10 opacity-50"
                }`}
              >
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => toggleCheck(i)}
                  className={`h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                    checked[i]
                      ? "bg-gold border-gold text-primary-foreground"
                      : "border-border"
                  }`}
                >
                  {checked[i] && <Check className="h-3 w-3" />}
                </button>

                {/* Emoji + title */}
                <div
                  className="h-8 w-8 rounded-md shrink-0 flex items-center justify-center text-base"
                  style={{ background: tocssColor(block.color) }}
                >
                  {block.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {block.title}
                  </div>
                </div>

                {/* Inline time editors */}
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="time"
                    value={times[i].start}
                    onChange={(e) =>
                      setTimes((prev) =>
                        prev.map((t, idx) => (idx === i ? { ...t, start: e.target.value } : t))
                      )
                    }
                    className="h-8 w-[88px] rounded border border-border bg-background/60 px-2 text-xs text-foreground"
                    disabled={!checked[i]}
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <input
                    type="time"
                    value={times[i].end}
                    onChange={(e) =>
                      setTimes((prev) =>
                        prev.map((t, idx) => (idx === i ? { ...t, end: e.target.value } : t))
                      )
                    }
                    className="h-8 w-[88px] rounded border border-border bg-background/60 px-2 text-xs text-foreground"
                    disabled={!checked[i]}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1 sticky bottom-0 bg-popover pb-1">
            <Button
              onClick={handleInstall}
              disabled={checkedCount === 0 || !groupName.trim()}
              className="flex-1 bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              <Zap className="h-4 w-4 mr-1.5" />
              Add {checkedCount} block{checkedCount !== 1 ? "s" : ""} to schedule
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

/* ─────────────────────────────────────────────────────────
   SINGLE BLOCK FORM DIALOG
   Streamlined for mobile — large inputs, minimal steps.
───────────────────────────────────────────────────────── */

interface FormDialogProps {
  initial: Partial<RecurringTemplate>;
  existingGroups: string[];
  onSave: (t: RecurringTemplate) => void;
  onClose: () => void;
}

function FormDialog({ initial, existingGroups, onSave, onClose }: FormDialogProps) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [emoji, setEmoji] = useState(initial.emoji ?? "");
  const [color, setColor] = useState(initial.color ?? "270 40% 55%");
  const [startTime, setStartTime] = useState(initial.startTime ?? "07:00");
  const [endTime, setEndTime] = useState(initial.endTime ?? "08:00");
  const [recurrence, setRecurrence] = useState<RecurrenceType>(initial.recurrence ?? "daily");
  const [days, setDays] = useState<number[]>(initial.days ?? []);
  const [routineGroup, setRoutineGroup] = useState(initial.routineGroup ?? "");
  const [showEmojis, setShowEmojis] = useState(false);

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const save = () => {
    if (!title.trim()) return;
    const t: RecurringTemplate = {
      id: initial.id ?? crypto.randomUUID(),
      title: title.trim(),
      emoji: emoji || undefined,
      color,
      startTime,
      endTime,
      recurrence,
      days: recurrence === "custom" ? days : undefined,
      enabled: initial.enabled ?? true,
      routineGroup: routineGroup.trim() || undefined,
    };
    onSave(t);
  };

  const colorCss = tocssColor(color);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm bg-popover border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {initial.id ? "Edit block" : "New routine block"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Title + Emoji */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowEmojis((s) => !s)}
              className="shrink-0 h-12 w-12 rounded-xl border border-border bg-background/60 text-2xl hover:border-gold transition-colors"
            >
              {emoji || "＋"}
            </button>
            <Input
              placeholder="e.g. Morning workout"
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
              {emoji && (
                <button type="button" onClick={() => { setEmoji(""); setShowEmojis(false); }}
                  className="text-[10px] text-muted-foreground hover:text-destructive col-span-2">
                  clear
                </button>
              )}
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

          {/* Recurrence */}
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Repeat</label>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as RecurrenceType)}>
              <SelectTrigger className="h-11 bg-background/60 border-border text-base">
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

          {recurrence === "custom" && (
            <div className="flex gap-2 flex-wrap">
              {DAY_NAMES.map((name, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-2 rounded-lg font-mono text-sm tracking-wider uppercase border transition-all ${
                    days.includes(i)
                      ? "bg-gold text-primary-foreground border-gold"
                      : "bg-background/40 text-muted-foreground border-border"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {/* Routine group */}
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Add to routine (optional)
            </label>
            {existingGroups.length > 0 ? (
              <Select
                value={routineGroup || "__none__"}
                onValueChange={(v) => setRoutineGroup(v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="h-11 bg-background/60 border-border text-base">
                  <SelectValue placeholder="No routine" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No routine</SelectItem>
                  {existingGroups.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                  <SelectItem value="__new__">+ New routine…</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="e.g. Morning Routine"
                value={routineGroup}
                onChange={(e) => setRoutineGroup(e.target.value)}
                className="h-11 text-base bg-background/60 border-border"
              />
            )}
            {routineGroup === "__new__" && (
              <Input
                placeholder="Routine name"
                autoFocus
                value=""
                onChange={(e) => setRoutineGroup(e.target.value)}
                className="h-11 text-base bg-background/60 border-border mt-1"
              />
            )}
          </div>

          {/* Save */}
          <div className="flex gap-2 pt-1">
            <Button
              onClick={save}
              disabled={!title.trim() || (recurrence === "custom" && days.length === 0)}
              className="flex-1 h-12 bg-gradient-gold text-primary-foreground hover:opacity-90 text-base"
            >
              <Check className="h-4 w-4 mr-1.5" />
              Save block
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
   ROUTINE GROUP SECTION
   Header with master toggle + collapse, list of blocks.
───────────────────────────────────────────────────────── */

interface GroupSectionProps {
  groupName: string;
  templates: RecurringTemplate[];
  todaySet: Set<string>;
  onToggleAll: (group: string, enabled: boolean) => void;
  onToggleOne: (id: string) => void;
  onEdit: (t: RecurringTemplate) => void;
  onDelete: (id: string) => void;
  onAddBlock: (group: string) => void;
}

function GroupSection({
  groupName, templates, todaySet,
  onToggleAll, onToggleOne, onEdit, onDelete, onAddBlock,
}: GroupSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const anyEnabled = templates.some((t) => t.enabled);
  const onTodayCount = templates.filter((t) => t.enabled && todaySet.has(t.id)).length;

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      {/* Group header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-background/40 border-b border-border/40">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
          <span className="font-display text-base font-medium text-foreground">
            {groupName}
          </span>
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
            {templates.length} block{templates.length !== 1 ? "s" : ""}
          </span>
          {onTodayCount > 0 && (
            <span className="font-mono text-[8px] tracking-[0.2em] uppercase text-gold border border-gold/40 rounded px-1">
              {onTodayCount} today
            </span>
          )}
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onAddBlock(groupName)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-gold transition-colors"
            title="Add block to this routine"
          >
            <Plus className="h-4 w-4" />
          </button>
          <Switch
            checked={anyEnabled}
            onCheckedChange={(on) => onToggleAll(groupName, on)}
            className="data-[state=checked]:bg-gold h-5 w-9"
          />
        </div>
      </div>

      {/* Blocks */}
      {!collapsed && (
        <div className="divide-y divide-border/30">
          {templates.map((t) => (
            <BlockRow
              key={t.id}
              template={t}
              isToday={todaySet.has(t.id)}
              onToggle={() => onToggleOne(t.id)}
              onEdit={() => onEdit(t)}
              onDelete={() => onDelete(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   INDIVIDUAL BLOCK ROW
───────────────────────────────────────────────────────── */

function BlockRow({
  template: t,
  isToday,
  onToggle,
  onEdit,
  onDelete,
}: {
  template: RecurringTemplate;
  isToday: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-all ${
        t.enabled ? "bg-background/20" : "bg-background/5 opacity-50"
      }`}
    >
      <div
        className="h-9 w-9 rounded-lg shrink-0 flex items-center justify-center text-lg"
        style={{ background: tocssColor(t.color) }}
      >
        {t.emoji ?? <Repeat className="h-4 w-4 text-white/80" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-sm font-medium ${t.enabled ? "text-foreground" : "text-muted-foreground"}`}>
            {t.title}
          </span>
          {isToday && t.enabled && (
            <span className="font-mono text-[8px] tracking-[0.2em] uppercase text-gold border border-gold/40 rounded px-1">today</span>
          )}
        </div>
        <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
          {formatTime12(t.startTime)} – {formatTime12(t.endTime)} · {recurrenceSummary(t)}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={onEdit}
          className="p-2 rounded-lg text-muted-foreground hover:text-gold hover:bg-muted/60 transition-colors">
          <Pencil className="h-4 w-4" />
        </button>
        <button type="button" onClick={onDelete}
          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted/60 transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
        <Switch checked={t.enabled} onCheckedChange={onToggle}
          className="data-[state=checked]:bg-gold h-5 w-9" />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   PACK CARD — quick-install teaser
───────────────────────────────────────────────────────── */

function PackCard({
  pack,
  installed,
  onInstall,
}: {
  pack: RoutinePack;
  installed: number;
  onInstall: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onInstall}
      className="text-left rounded-xl border border-border/60 bg-background/30 hover:border-gold/40 hover:bg-background/50 transition-all p-4 w-full"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{pack.emoji}</span>
            <span className="font-display text-base font-medium text-foreground">
              {pack.name}
            </span>
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">{pack.tagline}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {pack.blocks.slice(0, 4).map((b) => (
              <span
                key={b.title}
                className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-border/50 text-muted-foreground"
              >
                {b.emoji} {b.title}
              </span>
            ))}
            {pack.blocks.length > 4 && (
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-border/50 text-muted-foreground">
                +{pack.blocks.length - 4} more
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className="font-mono text-[9px] text-gold border border-gold/40 rounded px-2 py-1 whitespace-nowrap">
            {installed > 0 ? `${installed} installed` : `${pack.blocks.length} blocks`}
          </span>
          {installed === 0 && (
            <span className="font-mono text-[9px] text-muted-foreground">
              Tap to set up →
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────── */

export default function Schedule() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<RecurringTemplate[]>(() => loadTemplates());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<RecurringTemplate> | null>(null);
  const [installingPack, setInstallingPack] = useState<RoutinePack | null>(null);
  const [showPacks, setShowPacks] = useState(false);

  const today = new Date();
  const todaySet = new Set(
    templates.filter((t) => isApplicableToDate(t, today)).map((t) => t.id)
  );

  const reload = () => setTemplates(loadTemplates());

  // Derive groups: sorted by earliest start time in the group
  const groupedMap = new Map<string, RecurringTemplate[]>();
  const ungrouped: RecurringTemplate[] = [];

  for (const t of [...templates].sort((a, b) => a.startTime.localeCompare(b.startTime))) {
    if (t.routineGroup) {
      const arr = groupedMap.get(t.routineGroup) ?? [];
      arr.push(t);
      groupedMap.set(t.routineGroup, arr);
    } else {
      ungrouped.push(t);
    }
  }

  // Sorted group names by earliest block start time
  const sortedGroups = Array.from(groupedMap.entries()).sort(
    ([, a], [, b]) => a[0].startTime.localeCompare(b[0].startTime)
  );

  const existingGroups = Array.from(groupedMap.keys());
  const enabledCount = templates.filter((t) => t.enabled).length;
  const todayCount = getTemplatesForDate(templates, today).length;

  /* mutations */
  const handleSave = useCallback(
    (t: RecurringTemplate) => {
      upsertTemplate(t);
      reload();
      setFormOpen(false);
      setEditing(null);
      toast({ title: editing?.id ? "Block updated" : "Block added", description: t.title });
    },
    [editing?.id, toast]
  );

  const handleToggleOne = (id: string) => {
    const all = loadTemplates().map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t));
    saveTemplates(all);
    reload();
  };

  const handleToggleAll = (group: string, enabled: boolean) => {
    const all = loadTemplates().map((t) =>
      t.routineGroup === group ? { ...t, enabled } : t
    );
    saveTemplates(all);
    reload();
    toast({ title: enabled ? `${group} enabled` : `${group} paused` });
  };

  const handleDelete = (id: string) => {
    const t = templates.find((x) => x.id === id);
    deleteTemplate(id);
    reload();
    toast({ title: "Block removed", description: t?.title });
  };

  const handleInstallPack = (blocks: ReturnType<typeof ROUTINE_PACKS[0]["blocks"]["map"]>, groupName: string) => {
    blocks.forEach((block) => {
      const tpl: RecurringTemplate = {
        ...packBlockToTemplate(block as any, groupName),
        id: crypto.randomUUID(),
        enabled: true,
      };
      upsertTemplate(tpl);
    });
    reload();
    setInstallingPack(null);
    toast({
      title: `${groupName} added`,
      description: `${blocks.length} block${blocks.length !== 1 ? "s" : ""} added to your schedule.`,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your routine"
        title="Daily Schedule"
        description="Build the day you want to live. Blocks appear in your Agenda automatically."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPacks((s) => !s)}
              className="border-border text-muted-foreground hover:text-gold"
            >
              <Zap className="h-4 w-4 mr-1.5" />
              Quick add
            </Button>
            <Button
              onClick={() => { setEditing(blankTemplate()); setFormOpen(true); }}
              className="bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add block
            </Button>
          </div>
        }
      />

      {/* Preset packs */}
      {(showPacks || templates.length === 0) && (
        <div className="space-y-3">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
            ⚡ Quick-start packs — set up a full routine in seconds
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {ROUTINE_PACKS.map((pack) => (
              <PackCard
                key={pack.id}
                pack={pack}
                installed={packInstalledCount(templates, pack.name)}
                onInstall={() => setInstallingPack(pack)}
              />
            ))}
          </div>
          {templates.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPacks(false)}
              className="font-mono text-[10px] tracking-wider text-muted-foreground hover:text-foreground uppercase"
            >
              Hide packs ↑
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      {templates.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total blocks", value: templates.length },
            { label: "Active",       value: enabledCount },
            { label: "On today",     value: todayCount },
          ].map((s) => (
            <Card key={s.label} className="p-3 bg-gradient-card border-border text-center">
              <div className="font-display text-3xl text-gold">{s.value}</div>
              <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted-foreground mt-0.5">
                {s.label}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {templates.length === 0 && !showPacks && (
        <Card className="p-10 bg-gradient-card border-border text-center">
          <div className="text-5xl mb-4">🔁</div>
          <h3 className="font-display text-2xl text-foreground mb-2">No routine yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
            Use a quick-start pack to add a full Morning or Night Routine in one tap,
            or add individual blocks manually.
          </p>
        </Card>
      )}

      {/* Grouped routines */}
      {sortedGroups.map(([group, blocks]) => (
        <GroupSection
          key={group}
          groupName={group}
          templates={blocks}
          todaySet={todaySet}
          onToggleAll={handleToggleAll}
          onToggleOne={handleToggleOne}
          onEdit={(t) => { setEditing(t); setFormOpen(true); }}
          onDelete={handleDelete}
          onAddBlock={(g) => { setEditing(blankTemplate(g)); setFormOpen(true); }}
        />
      ))}

      {/* Ungrouped blocks */}
      {ungrouped.length > 0 && (
        <div className="space-y-2">
          {sortedGroups.length > 0 && (
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground px-1">
              Other blocks
            </div>
          )}
          <div className="rounded-xl border border-border/60 divide-y divide-border/30 overflow-hidden">
            {ungrouped.map((t) => (
              <BlockRow
                key={t.id}
                template={t}
                isToday={todaySet.has(t.id)}
                onToggle={() => handleToggleOne(t.id)}
                onEdit={() => { setEditing(t); setFormOpen(true); }}
                onDelete={() => handleDelete(t.id)}
              />
            ))}
          </div>
        </div>
      )}

      {templates.length > 0 && (
        <p className="font-mono text-[9px] tracking-wider text-muted-foreground/60 text-center pb-4">
          Blocks appear in your Agenda timeline. Mark done to earn XP. Skip today without deleting.
        </p>
      )}

      {/* Pack install dialog */}
      {installingPack && (
        <PackInstallDialog
          pack={installingPack}
          onInstall={handleInstallPack as any}
          onClose={() => setInstallingPack(null)}
        />
      )}

      {/* Single block form */}
      {formOpen && editing && (
        <FormDialog
          initial={editing}
          existingGroups={existingGroups}
          onSave={handleSave}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
