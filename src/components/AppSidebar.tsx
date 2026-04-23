import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CheckSquare,
  Timer,
  Brain,
  CalendarDays,
  BookOpen,
  Mic,
  Target,
  LogOut,
  Palette,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Daily Checklist", url: "/checklist", icon: CheckSquare },
  { title: "Focus Timer", url: "/focus", icon: Timer },
  { title: "Brain Dump", url: "/brain-dump", icon: Brain },
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
  { title: "Weekly Planner", url: "/planner", icon: CalendarDays },
  { title: "2026 Goals", url: "/goals-2026", icon: Target },
  { title: "Feature Guide", url: "/guide", icon: BookOpen },
  { title: "Audio Journal", url: "/journal", icon: Mic },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, user, signOut } = useAuth();
  const { theme, applyTheme, resetTheme, presets } = useThemeColor();
  const initial =
    (profile?.display_name?.[0] ?? user?.email?.[0] ?? "A").toUpperCase();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="bg-sidebar">
        {/* Brand */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-gradient-gold flex items-center justify-center shadow-gold">
              <span className="font-display text-xl text-primary-foreground font-semibold">A</span>
            </div>
            {!collapsed && (
              <div className="leading-tight">
                <div className="font-display text-lg text-gold">Alfred</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Command Center
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="divider-gold mx-3" />

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground/70 px-3 mt-3">
              Protocol
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive =
                  item.url === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={`group flex items-center gap-3 rounded-md px-3 py-2 transition-all ${
                          isActive
                            ? "bg-sidebar-accent text-gold shadow-inset-gold"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-gold"
                        }`}
                      >
                        <item.icon
                          className={`h-4 w-4 transition-colors ${
                            isActive ? "text-gold" : "text-muted-foreground group-hover:text-gold"
                          }`}
                        />
                        {!collapsed && (
                          <span className="font-mono text-[12px] tracking-wider uppercase">
                            {item.title}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-3 space-y-3">
          <div className="divider-gold mx-1" />

          {/* Profile chip */}
          <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : "justify-between"}`}>
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-8 w-8 border border-gold/30">
                <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                <AvatarFallback className="bg-muted text-gold font-display text-sm">
                  {initial}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">
                    {profile?.display_name ?? user?.email?.split("@")[0] ?? "Sir"}
                  </div>
                  <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted-foreground truncate">
                    {user?.email}
                  </div>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={() => signOut()}
                className="text-muted-foreground/60 hover:text-gold transition-colors p-1"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Theme Color Picker */}
          {!collapsed && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 w-full mt-3 px-2 py-2 rounded-md hover:bg-sidebar-accent/50 transition-colors text-xs text-muted-foreground hover:text-gold">
                  <Palette className="h-3.5 w-3.5" />
                  <span className="font-mono tracking-wider uppercase">Theme Color</span>
                  <div
                    className="ml-auto h-3 w-3 rounded-full border border-gold/30"
                    style={{ background: `hsl(${theme.background})` }}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" className="w-56 bg-popover border-border">
                <div className="space-y-3">
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                    Ambience
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {presets.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => applyTheme(preset)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-md transition-all ${
                          theme.name === preset.name
                            ? "bg-sidebar-accent ring-1 ring-gold/50"
                            : "hover:bg-sidebar-accent/50"
                        }`}
                      >
                        <div
                          className="h-6 w-6 rounded-full border border-gold/20"
                          style={{ background: `hsl(${preset.background})` }}
                        />
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                          {preset.name}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={resetTheme}
                    className="w-full py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-gold transition-colors"
                  >
                    Reset to Default
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {!collapsed && (
            <p className="font-display italic text-xs text-muted-foreground/80 leading-snug mt-3">
              "At your service.<br />Let us begin the day."
            </p>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
