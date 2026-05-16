import { FormEvent, useMemo, useState } from "react";
import { AlertCircle, Check, Clock, MapPin, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AgendaEvent, EVENT_COLORS, EVENT_EMOJIS } from "@/lib/agenda";
import { updateLocalEvent } from "@/lib/agendaStore";
import { updateGoogleEvent } from "@/lib/googleCalendar";
import { updateOutlookEvent } from "@/lib/outlookCalendar";

interface Props {
  event: AgendaEvent;
  onClose: () => void;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function combine(dateStr: string, timeStr: string): Date {
  const [y, m, day] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

export function EditEventForm({ event, onClose }: Props) {
  const { toast } = useToast();
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(toDateInput(event.start));
  const [start, setStart] = useState(toTimeInput(event.start));
  const [end, setEnd] = useState(toTimeInput(event.end));
  const [allDay, setAllDay] = useState(!!event.allDay);
  const [location, setLocation] = useState(event.location ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [emoji, setEmoji] = useState<string | undefined>(event.emoji);
  const initialColorHsl = (() => {
    const m = event.calendarColor?.match(/hsl\(([^)]+)\)/);
    return m ? m[1].trim() : EVENT_COLORS[0].hsl;
  })();
  const [colorHsl, setColorHsl] = useState<string>(initialColorHsl);
  const [submitting, setSubmitting] = useState(false);

  const error = useMemo(() => {
    if (!title.trim()) return "Title cannot be empty.";
    if (!date) return "A date is required.";
    if (!allDay) {
      if (!start || !end) return "Start and end times are required.";
      if (combine(date, end) <= combine(date, start))
        return "End time must be after start time.";
    }
    return null;
  }, [title, date, start, end, allDay]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (error) return;
    setSubmitting(true);

    const startISO = allDay
      ? combine(date, "00:00").toISOString()
      : combine(date, start).toISOString();
    const endISO = allDay
      ? combine(date, "23:59").toISOString()
      : combine(date, end).toISOString();

    const patch = {
      title: title.trim(),
      start: startISO,
      end: endISO,
      allDay,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      emoji,
      calendarColor: `hsl(${colorHsl})`,
    };

    try {
      if (event.source === "google") {
        await updateGoogleEvent(event.id, patch);
      } else if (event.source === "outlook") {
        await updateOutlookEvent(event.id, patch);
      } else {
        updateLocalEvent(event.id, patch);
      }
      toast({
        title: "Engagement updated",
        description: title.trim(),
      });
      onClose();
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-md border border-gold/40 bg-background/70 p-4"
    >
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-gold">
          Editing engagement
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1"
          aria-label="Cancel edit"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor={`edit-title-${event.id}`}
          className="text-xs uppercase tracking-wider text-muted-foreground"
        >
          Title
        </Label>
        <Input
          id={`edit-title-${event.id}`}
          value={title}
          onChange={(ev) => setTitle(ev.target.value)}
          autoFocus
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label
            htmlFor={`edit-date-${event.id}`}
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Date
          </Label>
          <Input
            id={`edit-date-${event.id}`}
            type="date"
            value={date}
            onChange={(ev) => setDate(ev.target.value)}
            required
          />
        </div>
        <div className="space-y-2 flex flex-col">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            All day
          </Label>
          <div className="flex items-center h-10">
            <Switch checked={allDay} onCheckedChange={setAllDay} />
            <span className="ml-2 font-mono text-[10px] tracking-wider uppercase text-muted-foreground">
              {allDay ? "Yes" : "No"}
            </span>
          </div>
        </div>
      </div>

      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label
              htmlFor={`edit-start-${event.id}`}
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              <Clock className="inline h-3 w-3 mr-1" />
              Start
            </Label>
            <Input
              id={`edit-start-${event.id}`}
              type="time"
              value={start}
              onChange={(ev) => setStart(ev.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor={`edit-end-${event.id}`}
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              End
            </Label>
            <Input
              id={`edit-end-${event.id}`}
              type="time"
              value={end}
              onChange={(ev) => setEnd(ev.target.value)}
              required
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label
          htmlFor={`edit-loc-${event.id}`}
          className="text-xs uppercase tracking-wider text-muted-foreground"
        >
          <MapPin className="inline h-3 w-3 mr-1" />
          Location{" "}
          <span className="text-muted-foreground/50 normal-case">
            (optional)
          </span>
        </Label>
        <Input
          id={`edit-loc-${event.id}`}
          value={location}
          onChange={(ev) => setLocation(ev.target.value)}
          placeholder="The drawing room"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Emoji <span className="text-muted-foreground/50 normal-case">(optional)</span>
          </Label>
          <div className="flex flex-wrap gap-1 rounded-md border border-border/60 bg-background/40 p-2 max-h-24 overflow-y-auto">
            <button
              type="button"
              onClick={() => setEmoji(undefined)}
              className={`h-7 w-7 rounded text-[10px] font-mono uppercase transition-all ${
                emoji === undefined
                  ? "bg-gold/20 text-gold ring-1 ring-gold/40"
                  : "text-muted-foreground hover:bg-muted/40"
              }`}
              title="None"
            >
              —
            </button>
            {EVENT_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`h-7 w-7 rounded text-base transition-all ${
                  emoji === e
                    ? "bg-gold/20 ring-1 ring-gold/40"
                    : "hover:bg-muted/40"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Color
          </Label>
          <div className="flex flex-wrap gap-1.5 rounded-md border border-border/60 bg-background/40 p-2">
            {EVENT_COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setColorHsl(c.hsl)}
                className={`h-7 w-7 rounded-full transition-all ${
                  colorHsl === c.hsl
                    ? "ring-2 ring-offset-2 ring-offset-background ring-foreground/60 scale-110"
                    : "hover:scale-110"
                }`}
                style={{ background: `hsl(${c.hsl})` }}
                title={c.name}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor={`edit-desc-${event.id}`}
          className="text-xs uppercase tracking-wider text-muted-foreground"
        >
          Notes{" "}
          <span className="text-muted-foreground/50 normal-case">
            (optional)
          </span>
        </Label>
        <Textarea
          id={`edit-desc-${event.id}`}
          value={description}
          onChange={(ev) => setDescription(ev.target.value)}
          rows={2}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!!error || submitting}
          className="bg-gradient-gold text-primary-foreground hover:opacity-90"
        >
          {submitting ? (
            <Check className="h-3.5 w-3.5 mr-1.5" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1.5" />
          )}
          Update event
        </Button>
      </div>
    </form>
  );
}
