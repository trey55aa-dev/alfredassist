import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
import { useGamification } from "@/hooks/useGamification";
import {
  LayoutDashboard,
  CheckSquare,
  Timer,
  Brain,
  CalendarDays,
  BookOpen,
  Mic,
  Target,
  ListChecks,
  LogOut,
  Palette,
  Repeat,
  Sparkles,
  Activity,
  Pencil,
  Trophy,
} from "lucide-react";
import { ProfileNameDialog } from "@/components/ProfileNameDialog";
import { AppIconCustomizer } from "@/components/AppIconCustomizer";
import { useAuth } from "@/hooks/useAuth";
import { useThemeColor, hslToHex } from "@/hooks/useThemeColor";
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
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Daily Checklist", url: "/checklist", icon: CheckSquare },
  { title: "Custom Lists", url: "/lists", icon: ListChecks },
  { title: "Focus Timer", url: "/focus", icon: Timer },
  { title: "Brain Dump", url: "/brain-dump", icon: Brain },
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
  { title: "Daily Schedule", url: "/schedule", icon: Repeat },
  { title: "Weekly Planner", url: "/planner", icon: CalendarDays },
  { title: "2026 Goals", url: "/goals-2026", icon: Target },
  { title: "Feature Guide", url: "/guide", icon: BookOpen },
  { title: "Audio Journal", url: "/journal", icon: Mic },
  { title: "Health", url: "/health", icon: Activity },
  { title: "Achievements", url: "/achievements", icon: Trophy },
];

/** Sidebar routes that stay accessible without confirmation while focused. */
const FOCUS_SAFE = new Set<string>(["/agenda", "/schedule"]);

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const focus = useFocusMode();
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const { profile, user, signOut } = useAuth();

  // First run after sign-in with no name set: gently prompt once.
  useEffect(() => {
    if (!user) return;
    const asked = localStorage.getItem("alfred.askedName");
    const hasName = !!profile?.display_name?.trim();
    if (!hasName && !asked) {
      setNameDialogOpen(true);
      localStorage.setItem("alfred.askedName", "1");
    }
  }, [user, profile?.display_name]);
  const {
    theme,
    applyTheme,
    applyThemeHex,
    resetTheme,
    accent,
    applyAccent,
    applyAccentHex,
    resetAccent,
    accentPresets,
    ambient,
    setAmbientEnabled,
    setAmbientIntensity,
    presets,
  } = useThemeColor();
  const accentHex = hslToHex(accent.hsl);
  const backgroundHex = hslToHex(theme.background);
  const initial =
    (profile?.display_name?.[0] ?? user?.email?.[0] ?? "A").toUpperCase();

  return (
    <>
      <ProfileNameDialog open={nameDialogOpen} onOpenChange={setNameDialogOpen} />
      <AlertDialog
        open={pendingUrl !== null}
        onOpenChange={(open) => {
          if (!open) setPendingUrl(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave your focus session?</AlertDialogTitle>
            <AlertDialogDescription>
              {focus.taskTitle
                ? `You said you'd focus on "${focus.taskTitle}". Heading to another page breaks the streak you set yourself.`
                : "You're in a focus session. Heading to another page breaks the streak you set yourself."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingUrl(null)}>
              Stay focused
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const url = pendingUrl;
                setPendingUrl(null);
                if (url) navigate(url);
              }}
            >
              Go anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
                <div className="text-[10px] uppercase tracking-[0.2em] text-primary">
                  Personal AI asstiant 
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
                const dimmed = focus.active && !FOCUS_SAFE.has(item.url) && !isActive;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        onClick={(e) => {
                          if (dimmed) {
                            e.preventDefault();
                            setPendingUrl(item.url);
                          }
                        }}
                        className={`group flex items-center gap-3 rounded-md px-3 py-2 transition-all ${
                          isActive
                            ? "bg-sidebar-accent text-gold shadow-inset-gold"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-gold"
                        } ${dimmed ? "opacity-40" : ""}`}
                      >
                        <item.icon
                          className={`h-4 w-4 transition-colors ${
                            isActive ? "text-gold" : "text-muted-foreground group-hover:text-gold"
                          }`}
                        />
                        {!collapsed && (
                          <span className="font-mono text-[12px] tracking-wider uppercase text-teal-50">
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

          {/* XP / Level mini bar */}
          <XpBar />

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
                <button
                  type="button"
                  onClick={() => setNameDialogOpen(true)}
                  className="min-w-0 text-left group/name"
                  title="Edit your name"
                >
                  <div className="flex items-center gap-1 text-xs font-medium text-foreground truncate">
                    <span className="truncate">
                      {profile?.display_name?.trim() ||
                        user?.email?.split("@")[0] ||
                        "Set your name"}
                    </span>
                    <Pencil className="h-2.5 w-2.5 text-muted-foreground/50 group-hover/name:text-gold shrink-0" />
                  </div>
                  <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted-foreground truncate">
                    {user?.email}
                  </div>
                </button>
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
                  <span className="font-mono tracking-wider uppercase text-primary">Theme Color</span>
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
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
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
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wide leading-tight text-center">
                          {preset.name}
                        </span>
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>Custom background</span>
                    <input
                      type="color"
                      value={backgroundHex}
                      onChange={(e) => applyThemeHex(e.target.value)}
                      className="h-7 w-12 rounded cursor-pointer bg-transparent border border-border"
                      aria-label="Pick a custom background color"
                    />
                  </label>
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

          {/* Accent Color Picker */}
          {!collapsed && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 w-full mt-2 px-2 py-2 rounded-md hover:bg-sidebar-accent/50 transition-colors text-xs text-muted-foreground hover:text-gold">
                  <Palette className="h-3.5 w-3.5" />
                  <span className="font-mono tracking-wider uppercase">Accent</span>
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                    {accent.name}
                  </span>
                  <div
                    className="h-3 w-3 rounded-full border border-border"
                    style={{ background: `hsl(${accent.hsl})` }}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" className="w-60 bg-popover border-border">
                <div className="space-y-3">
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                    Accent Color
                  </div>
                  <div className="grid grid-cols-6 gap-1.5 max-h-44 overflow-y-auto pr-1 scrollbar-thin">
                    {accentPresets.map((preset) => {
                      const active = accent.hsl === preset.hsl;
                      return (
                        <button
                          key={preset.name}
                          onClick={() => applyAccent(preset)}
                          title={preset.name}
                          className={`h-7 w-7 rounded-full border transition-all ${
                            active
                              ? "ring-2 ring-offset-2 ring-offset-popover ring-foreground/60 border-transparent"
                              : "border-border/60 hover:scale-110"
                          }`}
                          style={{ background: `hsl(${preset.hsl})` }}
                          aria-label={preset.name}
                        />
                      );
                    })}
                  </div>
                  <label className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>Custom</span>
                    <input
                      type="color"
                      value={accentHex}
                      onChange={(e) => applyAccentHex(e.target.value)}
                      className="h-7 w-12 rounded cursor-pointer bg-transparent border border-border"
                      aria-label="Pick a custom accent color"
                    />
                  </label>
                  <button
                    onClick={resetAccent}
                    className="w-full py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-gold transition-colors"
                  >
                    Reset to Gold
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* App Icon Customizer */}
          {!collapsed && <AppIconCustomizer />}

          {!collapsed && (
            <div className="mt-3 px-2 space-y-3">
              {/* Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="font-mono tracking-wider uppercase">Ambient</span>
                </div>
                <Switch
                  checked={ambient.enabled}
                  onCheckedChange={setAmbientEnabled}
                  className="data-[state=checked]:bg-gold h-4 w-7"
                />
              </div>

              {/* Intensity Slider */}
              {ambient.enabled && (
                <div className="space-y-2 pl-5">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                    <span>Subtle</span>
                    <span>Bold</span>
                  </div>
                  <Slider
                    value={[ambient.intensity]}
                    onValueChange={([val]) => setAmbientIntensity(val)}
                    min={10}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          )}

          {!collapsed && (
            <p className="font-display italic text-xs text-muted-foreground/80 leading-snug mt-3">
              "At your service.<br />Let us begin the day."
            </p>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
    </>
  );
}

function XpBar() {
  const { state, level, next, progress } = useGamification();
  const { state: sidebar } = useSidebar();
  const collapsed = sidebar === "collapsed";
  if (collapsed) {
    return (
      <div
        className="flex justify-center"
        title={`Level ${level.level} · ${state.xp} XP`}
      >
        <span className="font-mono text-[10px] text-gold">Lv{level.level}</span>
      </div>
    );
  }
  return (
    <NavLink
      to="/achievements"
      className="block rounded-md hover:bg-sidebar-accent/50 px-2 py-1.5 transition-colors"
    >
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-gold">
          Level {level.level} · {level.title}
        </span>
        <span className="font-mono text-[9px] text-muted-foreground">
          {state.xp} XP
        </span>
      </div>
      <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
        <div
          className="h-full bg-gradient-gold transition-all duration-700"
          style={{ width: `${progress.pct}%` }}
        />
      </div>
      {next && (
        <div className="font-mono text-[8px] text-muted-foreground/60 mt-0.5 text-right">
          {progress.progress}/{progress.needed} → Lv{next.level}
        </div>
      )}
    </NavLink>
  );
}
