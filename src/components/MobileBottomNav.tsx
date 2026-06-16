/**
 * Mobile bottom navigation — iOS 26 "Liquid Glass" floating pill style.
 *
 * Design spec (mirrors iOS 26 tab bar):
 *  - Floats above the home bar — NOT edge-to-edge; has horizontal margin.
 *  - Rounded-full pill container with glass-float backdrop blur.
 *  - Active tab: capsule-shaped gold highlight behind icon + label.
 *  - Inactive: muted icon + label; no border, no dot.
 *  - Landscape: label hidden, pill tighter.
 *  - Focus-mode: confirmation dialog before leaving safe routes.
 */

import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFocusMode } from "@/hooks/useFocusMode";
import { NAV_CATEGORIES, FOCUS_SAFE } from "@/lib/navConfig";

const LAST_VISITED_KEY = "alfred.nav.lastVisited";

function getLastVisited(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(LAST_VISITED_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function setLastVisited(catId: string, url: string) {
  const map = getLastVisited();
  map[catId] = url;
  sessionStorage.setItem(LAST_VISITED_KEY, JSON.stringify(map));
}

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const focus = useFocusMode();
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  // Track last-visited page per category
  const activeCat = NAV_CATEGORIES.find((cat) =>
    cat.items.some((item) =>
      item.url === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(item.url),
    ),
  );
  if (activeCat) setLastVisited(activeCat.id, location.pathname);

  const handleTap = (catId: string) => {
    const cat = NAV_CATEGORIES.find((c) => c.id === catId)!;
    const lastVisited = getLastVisited()[catId];
    const validLast =
      lastVisited &&
      cat.items.some((i) =>
        i.url === "/" ? lastVisited === "/" : lastVisited.startsWith(i.url),
      );
    const target = validLast ? lastVisited : cat.items[0].url;
    if (catId === activeCat?.id) return;

    if (focus.active && !FOCUS_SAFE.has(target)) {
      setPendingUrl(target);
      return;
    }
    navigate(target);
  };

  return (
    <>
      {/* Focus-mode confirmation */}
      <AlertDialog
        open={pendingUrl !== null}
        onOpenChange={(open) => { if (!open) setPendingUrl(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave your focus session?</AlertDialogTitle>
            <AlertDialogDescription>
              {focus.taskTitle
                ? `You said you'd focus on "${focus.taskTitle}". Heading away breaks your streak.`
                : "You're in a focus session. Heading away breaks your streak."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingUrl(null)}>Stay focused</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { const url = pendingUrl!; setPendingUrl(null); navigate(url); }}
            >
              Go anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/*
        Floating pill — iOS 26 style.
        Sits above the home bar with horizontal margin (not edge-to-edge).
        Uses glass-float for the Liquid Glass backdrop blur.
      */}
      <nav
        className="md:hidden fixed inset-x-3 z-50"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
        }}
        aria-label="Main navigation"
      >
        <div
          className="
            glass-float glass-rim
            flex items-center
            rounded-full
            px-2 py-1.5
            landscape:py-1
          "
        >
          {NAV_CATEGORIES.map((cat) => {
            const isActive = cat.id === activeCat?.id;
            const Icon = cat.icon;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleTap(cat.id)}
                aria-label={cat.label}
                aria-current={isActive ? "page" : undefined}
                className={`
                  flex-1 flex flex-col items-center justify-center
                  gap-0.5 rounded-full
                  py-2 px-1 landscape:py-1.5
                  transition-all duration-200
                  min-h-[44px] landscape:min-h-[36px]
                  relative
                  ${isActive ? "text-gold" : "text-muted-foreground/55 active:text-gold/70"}
                `}
              >
                {/* iOS 26 capsule active highlight */}
                {isActive && (
                  <span
                    className="
                      absolute inset-x-1 inset-y-0.5
                      rounded-full
                      bg-gold/12 border border-gold/20
                    "
                    aria-hidden
                  />
                )}

                <Icon
                  className={`
                    relative z-10
                    h-5 w-5 landscape:h-4 landscape:w-4
                    transition-all duration-200
                    ${isActive
                      ? "scale-110 drop-shadow-[0_0_8px_hsl(42_55%_62%/0.7)]"
                      : ""}
                  `}
                />

                {/* Label — hidden in landscape */}
                <span
                  className={`
                    relative z-10
                    font-mono text-[8px] tracking-[0.12em] uppercase leading-none
                    landscape:hidden
                    transition-colors duration-200
                    ${isActive ? "text-gold font-semibold" : "text-muted-foreground/55"}
                  `}
                >
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
