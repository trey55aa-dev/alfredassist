import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LEVEL_UP, Level } from "@/lib/gamification";

export function LevelUpModal() {
  const [level, setLevel] = useState<Level | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Level>).detail;
      setLevel(detail);
    };
    window.addEventListener(LEVEL_UP, handler);
    return () => window.removeEventListener(LEVEL_UP, handler);
  }, []);

  return (
    <Dialog open={!!level} onOpenChange={(open) => { if (!open) setLevel(null); }}>
      <DialogContent className="sm:max-w-sm text-center border-gold/40 bg-popover">
        <DialogHeader>
          <div className="text-6xl mb-2">🎉</div>
          <DialogTitle className="font-display text-3xl text-gold">
            Level Up!
          </DialogTitle>
        </DialogHeader>
        {level && (
          <div className="space-y-3 pb-2">
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
              You are now
            </div>
            <div className="font-display text-5xl text-foreground">
              Level {level.level}
            </div>
            <div className="font-display text-xl text-gold italic">
              "{level.title}"
            </div>
            <p className="text-sm text-muted-foreground">
              Alfred is impressed, sir. Keep this pace and the campaign is won.
            </p>
            <Button
              onClick={() => setLevel(null)}
              className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90 mt-2"
            >
              Back to the mission
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
