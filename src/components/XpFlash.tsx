// Floating "+10 XP" animation that appears whenever XP is awarded.
// Listens globally so it works from any page without prop drilling.
import { useEffect, useState } from "react";
import { XP_AWARDED, AwardResult } from "@/lib/gamification";

interface Flash {
  id: number;
  xp: number;
  reason: string;
}

export function XpFlash() {
  const [flashes, setFlashes] = useState<Flash[]>([]);

  useEffect(() => {
    let counter = 0;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AwardResult>).detail;
      const flash: Flash = { id: counter++, xp: detail.xp, reason: detail.reason };
      setFlashes((prev) => [...prev, flash]);
      setTimeout(() => {
        setFlashes((prev) => prev.filter((f) => f.id !== flash.id));
      }, 1800);
    };
    window.addEventListener(XP_AWARDED, handler);
    return () => window.removeEventListener(XP_AWARDED, handler);
  }, []);

  if (flashes.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col-reverse gap-1.5 pointer-events-none">
      {flashes.map((f) => (
        <div
          key={f.id}
          className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-background/90 px-3 py-1 shadow-gold backdrop-blur-sm animate-slide-up-fade"
        >
          <span className="text-base leading-none">⚡</span>
          <span className="font-display text-gold text-sm font-semibold">
            +{f.xp} XP
          </span>
        </div>
      ))}
    </div>
  );
}
