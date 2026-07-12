import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { SceneBackground } from "@/components/SceneBackground";
import { AmbientPattern } from "@/components/AmbientPattern";
import { ActiveTimerBar } from "@/components/ActiveTimerBar";
import { FocusModeBanner } from "@/components/FocusModeBanner";
import { FocusModeStarter } from "@/components/FocusModeStarter";
import { SyncStatus } from "@/components/SyncStatus";
import { XpFlash } from "@/components/XpFlash";
import { LevelUpModal } from "@/components/LevelUpModal";
import { BadgeToast } from "@/components/BadgeToast";
import { FocusAudioProvider } from "@/components/FocusAudioProvider";
import { FocusMiniPlayer } from "@/components/FocusMiniPlayer";
import { ButlerButton } from "@/components/ButlerButton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MoodPromptBanner } from "@/components/MoodPromptBanner";
import { useMoodPrompt } from "@/hooks/useMoodPrompt";
import { formatLongDate } from "@/lib/alfred";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PRESET_THEMES } from "@/hooks/useThemeColor";
import { useEventsSync } from "@/hooks/useEventsSync";
import { useCloudStateSync } from "@/hooks/useCloudStateSync";
import { useReminders } from "@/hooks/useReminders";
import { initAppIcon } from "@/lib/appIcon";
import { reconcileXpDecay } from "@/lib/gamification";
import { useUiMode } from "@/lib/uiMode";
import { NAV_CATEGORIES } from "@/lib/navConfig";

function usePageTitle(): string {
  const { pathname } = useLocation();
  for (const cat of NAV_CATEGORIES) {
    for (const item of cat.items) {
      if (item.url === "/" ? pathname === "/" : pathname.startsWith(item.url)) {
        return item.title;
      }
    }
  }
  return "Alfred";
}

export default function AppLayout() {
  useEventsSync();
  useCloudStateSync();
  useReminders();
  const [moodPrompt, dismissMoodPrompt] = useMoodPrompt();
  const pageTitle = usePageTitle();
  const { pathname } = useLocation();
  const uiMode = useUiMode();

  // Simple mode bumps the root font size — every rem-based size grows with it.
  useEffect(() => {
    document.documentElement.classList.toggle("ui-simple", uiMode === "simple");
  }, [uiMode]);

  useEffect(() => {
    initAppIcon();
    // Life happened while the app was closed — settle the XP bar with reality.
    reconcileXpDecay();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("alfred-theme-color");
    if (saved) {
      const parsed = JSON.parse(saved);
      const theme = PRESET_THEMES.find((t) => t.name === parsed.name) || PRESET_THEMES[0];
      document.documentElement.style.setProperty("--background", theme.background);
      document.documentElement.style.setProperty("--foreground", theme.foreground);
    }
  }, []);

  return (
    <FocusAudioProvider>
    <SidebarProvider>
      <div className="relative min-h-screen flex w-full bg-background overflow-x-hidden">
        <SceneBackground />
        <AmbientPattern />

        {/* Sidebar — desktop/tablet only; on mobile it still works as a sheet
            drawer (tap the hamburger), but the bottom nav is the primary nav. */}
        <AppSidebar />

        {/* Main column */}
        <div className="relative z-10 flex-1 flex flex-col min-w-0">

          {/* Top header bar */}
          <header
            className="h-14 flex items-center justify-between glass-nav glass-rim sticky top-0 z-30"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            <div className="flex items-center gap-3 px-3">
              <SidebarTrigger className="text-muted-foreground hover:text-gold touch-target" />
              <div className="hidden sm:block h-5 w-px bg-border/60" />
              <div className="hidden sm:block font-mono text-[10px] tracking-[0.22em] uppercase text-muted-foreground/60">
                {formatLongDate()}
              </div>
            </div>

            {/* Current page title — centred on mobile, left-anchored on sm+ */}
            <div className="absolute left-1/2 -translate-x-1/2 sm:static sm:translate-x-0 sm:ml-4 pointer-events-none sm:pointer-events-auto">
              <span className="font-display text-base text-foreground/80 tracking-wide">
                {pageTitle}
              </span>
            </div>

            <div className="flex items-center gap-2 px-3">
              <SyncStatus />
              <FocusModeStarter />
              <div className="hidden md:flex items-center gap-1.5 border border-gold/20 rounded-full px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
                <span className="font-display italic text-xs text-gold/70">Alfred</span>
              </div>
            </div>
          </header>

          <FocusModeBanner />
          {moodPrompt && (
            <MoodPromptBanner type={moodPrompt.type} onDismiss={dismissMoodPrompt} />
          )}

          {/* Page content — extra bottom padding for mobile bottom nav + home bar */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
            <div
              key={pathname}
              className="
                max-w-6xl mx-auto
                px-4 sm:px-6 lg:px-8
                py-6 sm:py-8
                page-in
              "
              style={{
                paddingBottom:
                  "calc(max(2rem, 5rem + env(safe-area-inset-bottom, 0px)))",
              }}
            >
              <ErrorBoundary>
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center py-24">
                      <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-gold/70 animate-pulse">
                        Loading…
                      </div>
                    </div>
                  }
                >
                  <Outlet />
                </Suspense>
              </ErrorBoundary>
            </div>
          </main>
        </div>

        {/* Mobile bottom nav (hidden on md+) */}
        <MobileBottomNav />

        {/* Floating overlays */}
        <ActiveTimerBar />
        <FocusMiniPlayer />
        <ButlerButton />
        <XpFlash />
        <BadgeToast />
        <LevelUpModal />
      </div>
    </SidebarProvider>
    </FocusAudioProvider>
  );
}
