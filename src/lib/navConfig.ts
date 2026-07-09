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
  Swords,
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
    id: "today",
    label: "Today",
    icon: CalendarDays,
    items: [
      { title: "Agenda",          url: "/agenda",    icon: CalendarDays },
      { title: "Daily Schedule",  url: "/schedule",  icon: Repeat },
      { title: "Daily Checklist", url: "/checklist", icon: CheckSquare },
      { title: "Focus Timer",     url: "/focus",     icon: Timer },
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
    id: "goals",
    label: "Goals",
    icon: Target,
    items: [
      { title: "2026 Goals",     url: "/goals-2026",   icon: Target },
      { title: "Weekly Review",  url: "/review",       icon: LineChart },
      { title: "Weekly Planner", url: "/planner",      icon: CalendarRange },
      { title: "Health",         url: "/health",       icon: Activity },
      { title: "Mood",           url: "/mood",         icon: Smile },
      { title: "NFL Predictor",  url: "/nfl",          icon: Swords },
      { title: "Achievements",   url: "/achievements", icon: Trophy },
    ],
  },
  {
    id: "guide",
    label: "Guide",
    icon: BookOpen,
    items: [{ title: "Feature Guide", url: "/guide", icon: BookOpen }],
  },
];

/** Routes accessible without focus-mode confirmation. */
export const FOCUS_SAFE = new Set<string>(["/agenda", "/schedule"]);
