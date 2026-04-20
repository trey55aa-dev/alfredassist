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
} from "lucide-react";
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
  { title: "Weekly Planner", url: "/planner", icon: CalendarDays },
  { title: "2026 Goals", url: "/goals-2026", icon: Target },
  { title: "Feature Guide", url: "/guide", icon: BookOpen },
  { title: "Audio Journal", url: "/journal", icon: Mic },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

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

        {!collapsed && (
          <div className="mt-auto p-4">
            <div className="divider-gold mb-4" />
            <p className="font-display italic text-sm text-muted-foreground leading-snug">
              "At your service, sir.<br />Let us begin the day."
            </p>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
