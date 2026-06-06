// Shows a floating badge-unlocked notification (distinct from the sonner toasts).
import { useEffect, useState } from "react";
import { BADGE_UNLOCKED, BadgeDef } from "@/lib/gamification";

export function BadgeToast() {
  const [badge, setBadge] = useState<BadgeDef | null>(null);

  useEffect(() => {
    let timeout: number;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<BadgeDef>).detail;
      setBadge(detail);
      clearTimeout(timeout);
      timeout = window.setTimeout(() => setBadge(null), 4000);
    };
    window.addEventListener(BADGE_UNLOCKED, handler);
    return () => {
      window.removeEventListener(BADGE_UNLOCKED, handler);
      clearTimeout(timeout);
    };
  }, []);

  if (!badge) return null;

  return (
    <div className="fixed bottom-36 right-4 z-50 animate-slide-up-fade pointer-events-none">
      <div className="flex items-center gap-3 rounded-md border border-gold/40 bg-background/95 p-3 shadow-xl backdrop-blur-md max-w-xs">
        <span className="text-3xl shrink-0">{badge.icon}</span>
        <div className="min-w-0">
          <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-gold mb-0.5">
            Badge Unlocked
          </div>
          <div className="font-display text-sm text-foreground font-semibold">
            {badge.title}
          </div>
          <div className="font-mono text-[9px] text-muted-foreground leading-snug mt-0.5">
            {badge.description}
          </div>
          {badge.xpBonus > 0 && (
            <div className="font-mono text-[9px] text-gold mt-1">
              +{badge.xpBonus} XP bonus
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
