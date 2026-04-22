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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
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

          {!collapsed && (
            <p className="font-display italic text-xs text-muted-foreground/80 leading-snug">
              "At your service.<br />Let us begin the day."
            </p>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
