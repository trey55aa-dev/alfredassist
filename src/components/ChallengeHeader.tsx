import { useState } from "react";
import { Flame, Pencil } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getChallenge,
  setChallenge,
  challengeStatus,
  type ChallengeConfig,
} from "@/lib/challenge";

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ChallengeHeader() {
  const [cfg, setCfg] = useState<ChallengeConfig>(() => getChallenge());
  const [draft, setDraft] = useState(cfg);
  const [open, setOpen] = useState(false);
  const status = challengeStatus(cfg);

  const save = () => {
    setChallenge(draft);
    setCfg(draft);
    setOpen(false);
  };

  const stateLine =
    status.state === "upcoming"
      ? `Starts in ${status.daysUntilStart} day${status.daysUntilStart === 1 ? "" : "s"}`
      : status.state === "complete"
        ? "Challenge complete"
        : `${status.totalDays - status.dayNumber} day${status.totalDays - status.dayNumber === 1 ? "" : "s"} to go`;

  return (
    <div
      className="relative overflow-hidden rounded-3xl border p-6 sm:p-7"
      style={{
        borderColor: "hsl(15 70% 45% / 0.35)",
        background:
          "linear-gradient(135deg, hsl(355 65% 22%) 0%, hsl(15 75% 28%) 45%, hsl(35 85% 32%) 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 85% -10%, hsl(35 90% 55% / 0.5), transparent 60%)",
        }}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.3em] uppercase text-amber-200/80 mb-2">
            <Flame className="h-3 w-3" /> Challenge
          </p>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl sm:text-3xl text-white leading-tight truncate">
              {cfg.title}
            </h2>
            <Popover
              open={open}
              onOpenChange={(o) => {
                setOpen(o);
                if (o) setDraft(cfg);
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="Edit challenge"
                  className="shrink-0 text-white/50 hover:text-white transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 bg-popover border-border" align="start">
                <div className="space-y-3">
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                    Edit challenge
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/70">
                      Name
                    </label>
                    <Input
                      value={draft.title}
                      onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      className="bg-background/60 border-border text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/70">
                      Start date
                    </label>
                    <Input
                      type="date"
                      value={draft.startDate}
                      onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
                      className="bg-background/60 border-border text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground/70">
                      Length (days)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={draft.totalDays}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, totalDays: Math.max(1, Number(e.target.value) || 1) }))
                      }
                      className="bg-background/60 border-border text-sm"
                    />
                  </div>
                  <Button onClick={save} size="sm" className="w-full">
                    Save
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <p className="text-sm text-white/70 mt-1">
            {fmtDate(cfg.startDate)} – {fmtDate(addDays(cfg.startDate, cfg.totalDays - 1))} · {stateLine}
          </p>
        </div>

        <div className="text-right shrink-0">
          <div className="font-display text-4xl sm:text-5xl text-white leading-none">
            {status.dayNumber}
            <span className="text-xl text-white/50"> / {status.totalDays}</span>
          </div>
          <p className="font-mono text-[9px] tracking-[0.25em] uppercase text-white/60 mt-1">Day</p>
        </div>
      </div>

      <div className="relative mt-5 h-1.5 rounded-full bg-white/15 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.round(status.pctElapsed * 100)}%`,
            background: "linear-gradient(90deg, hsl(35 90% 55%), hsl(15 85% 55%))",
          }}
        />
      </div>
    </div>
  );
}
