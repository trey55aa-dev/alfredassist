/**
 * Mobile bottom navigation bar.
 * - Visible only on small screens (hidden on md+).
 * - Shows the 5 nav categories as large touch targets.
 * - Active category glows gold; tapping navigates to that category's first page
 *   (or the last visited page in that category, stored in sessionStorage).
 * - Slims to icon-only in landscape to save vertical space.
 * - Respects iPhone home-bar via env(safe-area-inset-bottom).
 * - Focus-mode: non-safe routes show a confirmation dialog before leaving.
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

  // Record every route change so we know the last visited page per category.
  const activeCat = NAV_CATEGORIES.find((cat) =>
    cat.items.some((item) =>
      item.url === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(item.url),
    ),
  );
  if (activeCat) {
    setLastVisited(activeCat.id, location.pathname);
  }

  const handleTap = (catId: string) => {
    const cat = NAV_CATEGORIES.find((c) => c.id === catId)!;
    const lastVisited = getLastVisited()[catId];
    const validLast =
      lastVisited &&
      cat.items.some((i) =>
        i.url === "/"
          ? lastVisited === "/"
          : lastVisited.startsWith(i.url),
      );
    const target = validLast ? lastVisited : cat.items[0].url;

    const isAlreadyActive = catId === activeCat?.id;
    if (isAlreadyActive) return;

    const isSafe = FOCUS_SAFE.has(target);
    if (focus.active && !isSafe) {
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
            <AlertDialogCancel onClick={() => setPendingUrl(null)}>
              Stay focused
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const url = pendingUrl!;
                setPendingUrl(null);
                navigate(url);
              }}
            >
              Go anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/*
        The nav bar itself.
        - md:hidden  → invisible on tablet/desktop (sidebar handles those)
        - h-16 portrait, landscape:h-12  → shorter in landscape
        - pb-[env(...)] → clears iPhone home bar
      */}
      <nav
        className="
          md:hidden
          fixed bottom-0 inset-x-0 z-50
          flex items-stretch
          bg-sidebar/95 backdrop-blur-xl
          border-t border-sidebar-border
          shadow-[0_-4px_24px_-8px_hsl(0_0%_0%/0.5)]
        "
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {NAV_CATEGORIES.map((cat) => {
          const isActive = cat.id === activeCat?.id;
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleTap(cat.id)}
              className={`
                flex-1 flex flex-col items-center justify-center
                py-2 landscape:py-1.5
                min-h-[3.5rem] landscape:min-h-[2.75rem]
                gap-0.5 transition-all duration-200
                ${isActive
                  ? "text-gold"
                  : "text-muted-foreground/70 active:text-gold/80"}
              `}
              aria-label={cat.label}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="relative">
                <Icon
                  className={`
                    h-5 w-5 landscape:h-4 landscape:w-4
                    transition-all duration-200
                    ${isActive ? "scale-110 drop-shadow-[0_0_6px_hsl(42_55%_62%/0.8)]" : ""}
                  `}
                />
                {/* Active dot */}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold" />
                )}
              </div>
              {/* Label — hidden in landscape to save vertical space */}
              <span
                className={`
                  font-mono text-[9px] tracking-[0.15em] uppercase leading-none
                  landscape:hidden
                  ${isActive ? "text-gold" : "text-muted-foreground/60"}
                `}
              >
                {cat.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
