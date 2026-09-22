/**
 * Canonical navigation structure — shared by AppSidebar (desktop) and
 * MobileBottomNav (mobile). Editing here updates both automatically.
 */

import {
  LayoutDashboard,
  CalendarDays,
  Brain,
  Target,
  BookOpen,
  CheckSquare,
  Timer,
  Repeat,
  Mic,
  ListChecks,
  Activity,
  Trophy,
  CalendarRange,
  LineChart,
  Smile,
  Link2,
  Sunrise,
  Moon,
  Star,
  Plug,
} from "lucide-react";

export interface NavItem {
  title: string;
  url: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
}

export interface NavCategory {
  id: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  items: NavItem[];
}

export const NAV_CATEGORIES: NavCategory[] = [
  {
    id: "home",
    label: "Home",
    icon: LayoutDashboard,
    items: [{ title: "Dashboard", url: "/", icon: LayoutDashboard }],
  },
  {
    id: "day",
    label: "Day",
    icon: CalendarDays,
    items: [
      { title: "Daily Planning",  url: "/daily-planning",  icon: Sunrise },
      { title: "Agenda",          url: "/agenda",          icon: CalendarDays },
      { title: "Daily Schedule",  url: "/schedule",        icon: Repeat },
      { title: "Daily Task List", url: "/checklist",       icon: CheckSquare },
      { title: "Focus Timer",     url: "/focus",           icon: Timer },
      { title: "Daily Shutdown",  url: "/daily-shutdown",  icon: Moon },
      { title: "Daily Highlights", url: "/daily-highlights", icon: Star },
    ],
  },
  {
    id: "capture",
    label: "Capture",
    icon: Brain,
    items: [
      { title: "Brain Dump",    url: "/brain-dump", icon: Brain },
      { title: "Audio Journal", url: "/journal",    icon: Mic },
      { title: "Custom Lists",  url: "/lists",      icon: ListChecks },
      { title: "Notion",        url: "/notion",     icon: Link2 },
    ],
  },
  {
    id: "week",
    label: "Week",
    icon: CalendarRange,
    items: [
      { title: "Weekly Planning", url: "/planner", icon: CalendarRange },
      { title: "Weekly Review",   url: "/review",  icon: LineChart },
    ],
  },
  {
    id: "goals",
    label: "Goals",
    icon: Target,
    items: [
      { title: "2026 Goals",   url: "/goals-2026",   icon: Target },
      { title: "Health",       url: "/health",       icon: Activity },
      { title: "Mood",         url: "/mood",         icon: Smile },
      { title: "Achievements", url: "/achievements", icon: Trophy },
    ],
  },
  {
    id: "guide",
    label: "Guide",
    icon: BookOpen,
    items: [{ title: "Feature Guide", url: "/guide", icon: BookOpen }],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Plug,
    items: [{ title: "Integrations", url: "/integrations", icon: Plug }],
  },
];

/**
 * Simple mode — the whole app in five plain words. Each category is a single
 * destination so both navs become one-tap: no sub-menus, no jargon.
 */
export const SIMPLE_NAV_CATEGORIES: NavCategory[] = [
  {
    id: "home",
    label: "Home",
    icon: LayoutDashboard,
    items: [{ title: "Home", url: "/", icon: LayoutDashboard }],
  },
  {
    id: "today",
    label: "Today",
    icon: CalendarDays,
    items: [{ title: "Today", url: "/agenda", icon: CalendarDays }],
  },
  {
    id: "habits",
    label: "Habits",
    icon: CheckSquare,
    items: [{ title: "Habits", url: "/checklist", icon: CheckSquare }],
  },
  {
    id: "goals",
    label: "Goals",
    icon: Target,
    items: [{ title: "Goals", url: "/goals-2026", icon: Target }],
  },
  {
    id: "guide",
    label: "Help",
    icon: BookOpen,
    items: [{ title: "Help", url: "/guide", icon: BookOpen }],
  },
];

export function navCategoriesFor(mode: "simple" | "full"): NavCategory[] {
  return mode === "simple" ? SIMPLE_NAV_CATEGORIES : NAV_CATEGORIES;
}

/** Routes accessible without focus-mode confirmation. */
export const FOCUS_SAFE = new Set<string>(["/agenda", "/schedule"]);
