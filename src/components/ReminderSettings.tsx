import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  type ReminderPrefs,
  getReminderPrefs,
  saveReminderPrefs,
} from "@/lib/notifications";

const ROWS: { key: keyof Omit<ReminderPrefs, "leadMinutes">; label: string; hint: string }[] = [
  { key: "blockReminders", label: "Routine blocks", hint: "Alert before each scheduled block" },
  { key: "streakNudge", label: "Streak at risk", hint: "Evening nudge if the protocol isn't done" },
  { key: "goalNudge", label: "Goal check-in", hint: "Afternoon nudge to log goal progress" },
];

export function ReminderSettings() {
  const [s, setS] = useState<ReminderPrefs>(() => getReminderPrefs());

  const patch = (p: Partial<ReminderPrefs>) => {
    const next = { ...s, ...p };
    setS(next);
    saveReminderPrefs(next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-gold hover:border-gold/40 transition-colors"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Reminders
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 bg-popover border-border" align="end">
        <div className="font-display text-lg mb-3">Reminders</div>
        <div className="space-y-3">
          {ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-foreground">{row.label}</div>
                <div className="font-mono text-[9px] tracking-wider text-muted-foreground">{row.hint}</div>
              </div>
              <Switch
                checked={s[row.key]}
                onCheckedChange={(on) => patch({ [row.key]: on } as Partial<ReminderPrefs>)}
                className="data-[state=checked]:bg-gold h-5 w-9 shrink-0"
              />
            </div>
          ))}

          <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/40">
            <div>
              <div className="text-sm text-foreground">Lead time</div>
              <div className="font-mono text-[9px] tracking-wider text-muted-foreground">Minutes before a block</div>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                max={60}
                value={s.leadMinutes}
                onChange={(e) => patch({ leadMinutes: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })}
                className="h-8 w-16 bg-background/60 border-border text-sm text-center"
              />
              <span className="font-mono text-[10px] text-muted-foreground">min</span>
            </div>
          </div>
        </div>
        <p className="font-mono text-[8px] tracking-wider text-muted-foreground/60 mt-3">
          Fires while the app is open. On iOS, the native build delivers these in the background.
        </p>
      </PopoverContent>
    </Popover>
  );
}
