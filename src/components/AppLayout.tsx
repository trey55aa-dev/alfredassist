import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { formatLongDate } from "@/lib/alfred";

export default function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-30">
            <div className="flex items-center gap-3 px-3">
              <SidebarTrigger className="text-muted-foreground hover:text-gold" />
              <div className="hidden sm:block h-5 w-px bg-border" />
              <div className="hidden sm:block font-mono text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
                {formatLongDate()}
              </div>
            </div>
            <div className="px-4 font-display italic text-sm text-gold/80">
              Tiimo Command Center
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
