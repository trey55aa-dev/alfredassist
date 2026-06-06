import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AmbientPattern } from "@/components/AmbientPattern";
import { ActiveTimerBar } from "@/components/ActiveTimerBar";
import { FocusModeBanner } from "@/components/FocusModeBanner";
import { FocusModeStarter } from "@/components/FocusModeStarter";
import { XpFlash } from "@/components/XpFlash";
import { LevelUpModal } from "@/components/LevelUpModal";
import { BadgeToast } from "@/components/BadgeToast";
import { formatLongDate } from "@/lib/alfred";
import { useEffect } from "react";
import { PRESET_THEMES } from "@/hooks/useThemeColor";
import { useEventsSync } from "@/hooks/useEventsSync";
import { initAppIcon } from "@/lib/appIcon";

export default function AppLayout() {
  // Mirror manual agenda events to the cloud + hydrate on sign-in.
  useEventsSync();

  // Apply the user's custom app icon (favicon + apple-touch-icon) on load.
  useEffect(() => {
    initAppIcon();
  }, []);

  // Initialize saved theme on mount
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
    <SidebarProvider>
      <div className="relative min-h-screen flex w-full bg-background">
        <AmbientPattern />
        <AppSidebar />

        <div className="relative z-10 flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-30">
            <div className="flex items-center gap-3 px-3">
              <SidebarTrigger className="text-muted-foreground hover:text-gold" />
              <div className="hidden sm:block h-5 w-px bg-border" />
              <div className="hidden sm:block font-mono text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
                {formatLongDate()}
              </div>
            </div>
            <div className="flex items-center gap-3 px-3">
              <FocusModeStarter />
              <div className="hidden md:block font-display italic text-sm text-gold/80">
                Tiimo Command Center
              </div>
            </div>
          </header>

          <FocusModeBanner />

          <main className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 pb-32 fade-in">
              <Outlet />
            </div>
          </main>
        </div>

        <ActiveTimerBar />
        <XpFlash />
        <BadgeToast />
        <LevelUpModal />
      </div>
    </SidebarProvider>
  );
}
