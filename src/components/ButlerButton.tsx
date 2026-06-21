import { useState } from "react";
import { ButlerAvatar } from "./ButlerAvatar";
import { ButlerPanel } from "./ButlerPanel";
import { useLocation } from "react-router-dom";

export function ButlerButton() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Hide on the focus page (full-screen timer) and auth page
  const hidden =
    location.pathname === "/focus" || location.pathname === "/auth";
  if (hidden) return null;

  return (
    <>
      {/* Floating butler — sits above mobile nav */}
      <div
        className="
          fixed z-50 select-none
          right-4 bottom-[5.5rem]
          md:right-6 md:bottom-6
        "
      >
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Alfred butler"
          className="
            group relative flex flex-col items-center
            focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 rounded-full
          "
        >
          {/* Speech bubble on hover */}
          <div
            className="
              absolute bottom-full mb-2 left-1/2 -translate-x-1/2
              whitespace-nowrap opacity-0 group-hover:opacity-100
              transition-opacity duration-200 pointer-events-none
            "
          >
            <div className="rounded-xl bg-background/95 border border-border/60 shadow-lg px-3 py-1.5">
              <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                At your service, sir.
              </span>
            </div>
            {/* Bubble tail */}
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-background/95 border-r border-b border-border/60 rotate-45 -mt-1" />
            </div>
          </div>

          {/* Butler character */}
          <div
            className="
              relative rounded-full p-1
              bg-background/80 border border-border/60
              shadow-lg shadow-black/30
              hover:border-gold/40 hover:shadow-gold/10
              transition-all duration-200
              hover:scale-105 active:scale-95
            "
          >
            <ButlerAvatar size={44} state="idle" className="text-foreground" />
            {/* Gold ring glow on hover */}
            <div className="absolute inset-0 rounded-full ring-2 ring-gold/0 group-hover:ring-gold/20 transition-all duration-200" />
          </div>

          {/* Name tag */}
          <div className="mt-1 font-mono text-[8px] tracking-[0.25em] uppercase text-muted-foreground/60">
            Alfred
          </div>
        </button>
      </div>

      <ButlerPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
