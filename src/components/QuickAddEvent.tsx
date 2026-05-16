import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, X, MapPin, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AgendaEvent, EVENT_COLORS, EVENT_EMOJIS } from "@/lib/agenda";
import { addLocalEvent } from "@/lib/agendaStore";
import {
  createGoogleEvent,
  isGoogleConnected,
  GOOGLE_CONNECTED_CHANGED,
} from "@/lib/googleCalendar";
import {
  createOutlookEvent,
  isOutlookConnected,
  OUTLOOK_CONNECTED_CHANGED,
} from "@/lib/outlookCalendar";
import { todayKey } from "@/lib/alfred";

type Destination = "local" | "google" | "outlook";

const DEST_LABEL: Record<Destination, string> = {
  local: "Local",
  google: "Google Calendar",
  outlook: "Outlook",
};

interface Props {
  /** Optional pre-filled date (YYYY-MM-DD) and times (HH:mm). */
  initialDate?: string;
  initialStart?: string;
  initialEnd?: string;
  /** Optional callback after a successful save. */
  onCreated?: (event: AgendaEvent) => void;
}

function nextHourSlot(date = new Date()): { start: string; end: string } {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const start = `${String(d.getHours()).padStart(2, "0")}:00`;
  const endH = (d.getHours() + 1) % 24;
  return { start, end: `${String(endH).padStart(2, "0")}:00` };
}

function combine(dateStr: string, timeStr: string): Date {
  const [y, m, day] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

export function QuickAddEvent({
  initialDate,
  initialStart,
  initialEnd,
  onCreated,
}: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const defaults = useMemo(() => nextHourSlot(), []);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate ?? todayKey());
  const [start, setStart] = useState(initialStart ?? defaults.start);
  const [end, setEnd] = useState(initialEnd ?? defaults.end);
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState<string | undefined>(undefined);
  const [colorHsl, setColorHsl] = useState<string>(EVENT_COLORS[0].hsl);
  const [submitting, setSubmitting] = useState(false);
  const [gConnected, setGConnected] = useState(() => isGoogleConnected());
  const [oConnected, setOConnected] = useState(() => isOutlookConnected());
  const [destination, setDestination] = useState<Destination>("local");

  useEffect(() => {
    const sync = () => {
      const g = isGoogleConnected();
      const o = isOutlookConnected();
      setGConnected(g);
      setOConnected(o);
      // Default destination: prefer Google, then Outlook, else local.
      setDestination((prev) => {
        if (prev === "google" && g) return prev;
        if (prev === "outlook" && o) return prev;
        if (g) return "google";
        if (o) return "outlook";
        return "local";
      });
    };
    sync();
    window.addEventListener(GOOGLE_CONNECTED_CHANGED, sync);
    window.addEventListener(OUTLOOK_CONNECTED_CHANGED, sync);
    return () => {
      window.removeEventListener(GOOGLE_CONNECTED_CHANGED, sync);
      window.removeEventListener(OUTLOOK_CONNECTED_CHANGED, sync);
    };
  }, []);

  const destinations: Destination[] = [
    "local",
    ...(gConnected ? (["google"] as const) : []),
    ...(oConnected ? (["outlook"] as const) : []),
  ];

  // When the parent passes new pre-fill props (e.g. clicking a slot), sync them.
  useEffect(() => {
    if (initialDate) setDate(initialDate);
    if (initialStart) setStart(initialStart);
    if (initialEnd) setEnd(initialEnd);
    if (initialDate || initialStart || initialEnd) setOpen(true);
  }, [initialDate, initialStart, initialEnd]);

  const error = useMemo(() => {
    if (!title.trim()) return "Give the engagement a title.";
    if (!date) return "A date is required.";
    if (!allDay) {
      if (!start || !end) return "Start and end times are required.";
      const s = combine(date, start);
      const e = combine(date, end);
      if (e <= s) return "End time must be after start time.";
    }
    return null;
  }, [title, date, start, end, allDay]);

  const reset = () => {
    setTitle("");
    setDate(todayKey());
    const slot = nextHourSlot();
    setStart(slot.start);
    setEnd(slot.end);
    setAllDay(false);
    setLocation("");
    setDescription("");
    setEmoji(undefined);
    setColorHsl(EVENT_COLORS[0].hsl);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (error) return;
    setSubmitting(true);

    let startISO: string;
    let endISO: string;
    if (allDay) {
      const dayStart = combine(date, "00:00");
      const dayEnd = combine(date, "23:59");
      startISO = dayStart.toISOString();
      endISO = dayEnd.toISOString();
    } else {
      startISO = combine(date, start).toISOString();
      endISO = combine(date, end).toISOString();
    }

    const draft: Omit<AgendaEvent, "id" | "source"> = {
      title: title.trim(),
      start: startISO,
      end: endISO,
      allDay,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      calendarName: DEST_LABEL[destination],
      calendarColor: `hsl(${colorHsl})`,
      emoji,
    };

    try {
      let event: AgendaEvent;
      if (destination === "google") {
        const created = await createGoogleEvent(draft);
        event = { ...created, calendarColor: draft.calendarColor };
      } else if (destination === "outlook") {
        const created = await createOutlookEvent(draft);
        event = { ...created, calendarColor: draft.calendarColor };
      } else {
        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        event = { ...draft, id, source: "manual" };
        addLocalEvent(event);
      }
      toast({
        title:
          destination === "local"
            ? "Event added"
            : `Added to ${DEST_LABEL[destination]}`,
        description: allDay
          ? `${event.title} · all day`
          : `${event.title} · ${start}–${end}`,
      });
      onCreated?.(event);
      reset();
      setOpen(false);
    } catch (err) {
      toast({
        title: "Could not add event",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        size="sm"
        className="border-gold/40 text-gold hover:text-gold hover:bg-muted/40"
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Quick add event
      </Button>
    );
  }

  return (
    <Card className="p-5 bg-gradient-card border-gold/30">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl">Add to the diary</h3>
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mt-0.5">
              {`Will save to ${DEST_LABEL[destination]}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="qa-title" className="text-xs uppercase tracking-wider text-muted-foreground">
            Title
          </Label>
          <Input
            id="qa-title"
            value={title}
            onChange={(ev) => setTitle(ev.target.value)}
            placeholder="Strategy review with the board"
            autoFocus
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="qa-date" className="text-xs uppercase tracking-wider text-muted-foreground">
              Date
            </Label>
            <Input
              id="qa-date"
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
              <Label htmlFor="qa-start" className="text-xs uppercase tracking-wider text-muted-foreground">
                <Clock className="inline h-3 w-3 mr-1" />
                Start
              </Label>
              <Input
                id="qa-start"
                type="time"
                value={start}
                onChange={(ev) => setStart(ev.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qa-end" className="text-xs uppercase tracking-wider text-muted-foreground">
                End
              </Label>
              <Input
                id="qa-end"
                type="time"
                value={end}
                onChange={(ev) => setEnd(ev.target.value)}
                required
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="qa-location" className="text-xs uppercase tracking-wider text-muted-foreground">
            <MapPin className="inline h-3 w-3 mr-1" />
            Location <span className="text-muted-foreground/50 normal-case">(optional)</span>
          </Label>
          <Input
            id="qa-location"
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
                aria-label="No emoji"
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
                  aria-label={`Emoji ${e}`}
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
                  aria-label={c.name}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="qa-desc" className="text-xs uppercase tracking-wider text-muted-foreground">
            Notes <span className="text-muted-foreground/50 normal-case">(optional)</span>
          </Label>
          <Textarea
            id="qa-desc"
            value={description}
            onChange={(ev) => setDescription(ev.target.value)}
            placeholder="Agenda, attendees, anything Alfred should know..."
            rows={2}
          />
        </div>

        {destinations.length > 1 && (
          <div className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Save to
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {destinations.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDestination(d)}
                  className={`px-3 py-1 rounded font-mono text-[10px] tracking-[0.15em] uppercase transition-all ${
                    destination === d
                      ? "bg-gold/20 text-gold ring-1 ring-gold/40"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {DEST_LABEL[d]}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!!error || submitting}
            className="bg-gradient-gold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add event
          </Button>
        </div>
      </form>
    </Card>
  );
}
