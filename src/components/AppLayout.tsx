import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { AmbientPattern } from "@/components/AmbientPattern";
import { ActiveTimerBar } from "@/components/ActiveTimerBar";
import { FocusModeBanner } from "@/components/FocusModeBanner";
import { FocusModeStarter } from "@/components/FocusModeStarter";
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
import { PRESET_THEMES } from "@/hooks/useThemeColor";
import { useEventsSync } from "@/hooks/useEventsSync";
import { useCloudStateSync } from "@/hooks/useCloudStateSync";
import { useReminders } from "@/hooks/useReminders";
import { initAppIcon } from "@/lib/appIcon";

export default function AppLayout() {
  useEventsSync();
  useCloudStateSync();
  useReminders();
  const [moodPrompt, dismissMoodPrompt] = useMoodPrompt();

  useEffect(() => {
    initAppIcon();
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
        <AmbientPattern />

        {/* Sidebar — desktop/tablet only; on mobile it still works as a sheet
            drawer (tap the hamburger), but the bottom nav is the primary nav. */}
        <AppSidebar />

        {/* Main column */}
        <div className="relative z-10 flex-1 flex flex-col min-w-0">

          {/* Top header bar — iOS 26 / macOS 15 Liquid Glass */}
          <header
            className="
              h-14 flex items-center justify-between
              glass-nav glass-rim
              sticky top-0 z-30
            "
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            <div className="flex items-center gap-3 px-3">
              {/* Hamburger — always available as a fallback; primary on desktop */}
              <SidebarTrigger className="text-muted-foreground hover:text-gold touch-target" />
              <div className="hidden sm:block h-5 w-px bg-border" />
              <div className="hidden sm:block font-mono text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
                {formatLongDate()}
              </div>
            </div>
            <div className="flex items-center gap-3 px-3">
              <FocusModeStarter />
              <div className="hidden md:block font-display italic text-sm text-gold/80">
                Alfred
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
              className="
                max-w-6xl mx-auto
                px-4 sm:px-6 lg:px-8
                py-6 sm:py-8
                fade-in
              "
              style={{
                paddingBottom:
                  "calc(max(2rem, 5rem + env(safe-area-inset-bottom, 0px)))",
              }}
            >
              <ErrorBoundary>
                <Outlet />
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
