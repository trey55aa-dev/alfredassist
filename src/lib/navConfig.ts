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
  MessageCircle,
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
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Ask Alfred", url: "/chat", icon: MessageCircle },
    ],
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

/**
 * Simple mode — the whole app in six plain words, one destination each, so
 * both navs stay one-tap with no sub-menus and no jargon.
 *
 * Shaped after Tiimo's four (To Do, Calendar, Focus, Daily Reflection) plus
 * Habits and Alfred himself. "Reflect" rather than "Daily Reflection" only
 * because a tab label has to fit a phone; the page keeps its full name.
 *
 * The Dashboard is deliberately not a tab here — six is already the ceiling
 * for a bottom nav at phone width. It stays one tap away via the Alfred
 * wordmark in the header.
 */
export const SIMPLE_NAV_CATEGORIES: NavCategory[] = [
  {
    id: "todo",
    label: "To Do",
    icon: ListChecks,
    items: [{ title: "To Do", url: "/planner", icon: ListChecks }],
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: CalendarDays,
    items: [{ title: "Calendar", url: "/agenda", icon: CalendarDays }],
  },
  {
    id: "focus",
    label: "Focus",
    icon: Timer,
    items: [{ title: "Focus", url: "/focus", icon: Timer }],
  },
  {
    id: "habits",
    label: "Habits",
    icon: CheckSquare,
    items: [{ title: "Habits", url: "/checklist", icon: CheckSquare }],
  },
  {
    id: "reflect",
    label: "Reflect",
    icon: Mic,
    items: [{ title: "Reflect", url: "/journal", icon: Mic }],
  },
  {
    id: "chat",
    label: "Alfred",
    icon: MessageCircle,
    items: [{ title: "Alfred", url: "/chat", icon: MessageCircle }],
  },
];

export function navCategoriesFor(mode: "simple" | "full"): NavCategory[] {
  return mode === "simple" ? SIMPLE_NAV_CATEGORIES : NAV_CATEGORIES;
}

/** Routes accessible without focus-mode confirmation. */
export const FOCUS_SAFE = new Set<string>(["/agenda", "/schedule"]);
