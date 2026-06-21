import { useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoodCheckIn } from "./MoodCheckIn";
import { MoodFace } from "./MoodFace";
import { type CheckInType } from "@/lib/mood";

interface Props {
  type: CheckInType;
  onDismiss: () => void;
}

export function MoodPromptBanner({ type, onDismiss }: Props) {
  const [open, setOpen] = useState(false);

  const label =
    type === "morning"
      ? "Morning check-in ready"
      : "Evening check-in ready";

  const done = () => {
    setOpen(false);
    onDismiss();
  };

  return (
    <>
      <div className="mx-4 mt-2 mb-0 rounded-xl border border-border/50 bg-white/3 backdrop-blur-sm px-3 py-2 flex items-center gap-3">
        {/* Animated neutral face as the banner icon */}
        <div className="shrink-0">
          <MoodFace value={4} size={36} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-foreground/80">
            {label}
          </span>
          <span className="font-mono text-[9px] text-muted-foreground ml-2">
            · How are you feeling?
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg px-3 py-1 text-[10px] font-mono tracking-wider uppercase bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors"
          >
            Check in
          </button>
          <button
            onClick={onDismiss}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
        <DialogContent className="max-w-md bg-background/95 border-border/60 backdrop-blur-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {type === "morning" ? "Morning" : "Evening"} Check-In
            </DialogTitle>
          </DialogHeader>
          <MoodCheckIn type={type} onComplete={done} />
        </DialogContent>
      </Dialog>
    </>
  );
}
