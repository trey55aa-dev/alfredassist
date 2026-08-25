import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  LayoutList,
  MapPin,
  Pencil,
  Plug,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { QuickAddEvent } from "@/components/QuickAddEvent";
import { SuggestedSchedule } from "@/components/SuggestedSchedule";
import { PushToggle } from "@/components/PushToggle";
import { EditEventForm } from "@/components/EditEventForm";
import { DayTimeline, type AnytimeItem } from "@/components/DayTimeline";
import { GoogleCalendarConnect } from "@/components/GoogleCalendarConnect";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  AgendaEvent,
  currentEvent,
  filterToDay,
  formatEventTime,
  getTodayEvents,
  nextEvent,
  sortByStart,
} from "@/lib/agenda";
import {
  LOCAL_EVENTS_CHANGED,
  removeLocalEvent,
  toggleEventCompleted,
} from "@/lib/agendaStore";
import {
  deleteGoogleEvent,
  GOOGLE_CONNECTED_CHANGED,
  updateGoogleEvent,
} from "@/lib/googleCalendar";
import {
  deleteOutlookEvent,
  OUTLOOK_CONNECTED_CHANGED,
  updateOutlookEvent,
} from "@/lib/outlookCalendar";
import { OutlookCalendarConnect } from "@/components/OutlookCalendarConnect";
import { runCarryOver } from "@/lib/carryOver";
import { awardXp, XP_VALUES } from "@/lib/gamification";
import { processForFollowUps, FOLLOWUP_SETTINGS_CHANGED } from "@/lib/followUps";
import { FollowUpSettingsButton } from "@/components/FollowUpSettingsButton";
import {
  notifyCarryOver,
  scheduleUpcomingReminders,
} from "@/lib/notifications";
import { RecoveryPanel } from "@/components/RecoveryPanel";
import { SuggestedRetimes } from "@/components/SuggestedRetimes";
import { DailyRecap } from "@/components/DailyRecap";
import { ChallengeHeader } from "@/components/ChallengeHeader";
import { NotificationToggle } from "@/components/NotificationToggle";
import { ReminderSettings } from "@/components/ReminderSettings";
import { currentStreakFor, habitsAtRisk, toggleHabitForToday } from "@/lib/habits";
import {
  loadTemplates,
  parseRecurringInstanceId,
  RECURRING_CHANGED,
  setRecurringCompleted,
  setRecurringSkipped,
  templateDurationMinutes,
} from "@/lib/recurring";
import { useCloudHabits } from "@/hooks/useCloudHabits";
import { useCloudGoals } from "@/hooks/useCloudGoals";
import { applyHabitToggle } from "@/lib/habitToggle";
import { useAuth } from "@/hooks/useAuth";
import { useRecurringSync } from "@/hooks/useRecurringSync";
import { GOALS_KEY, type Goal } from "@/lib/goals";
import { logProgress } from "@/lib/goalsHistory";
import { progressXp } from "@/lib/gamification";
import { upsertGoal } from "@/lib/goalsRepo";
import { formatLongDate, todayKey } from "@/lib/alfred";
import {
  getEntry,
  isAnsweredToday,
  loadTargetLog,
  loadTargets,
  setEntry,
  GOAL_TARGETS_CHANGED,
} from "@/lib/goalTargets";

type ViewMode = "timeline" | "list";

export default function Agenda() {
  const { toast } = useToast();
  const [events, setEvents] = useState<AgendaEvent[] | null>(null);
  const [now, setNow] = useState(new Date());
  const [editingId, setEditingId] = useState<string | null>(null);
  // Bumped after ticking a sub-goal so the untimed rail re-reads its store.
  const [targetTick, setTargetTick] = useState(0);
  const [view, setView] = useLocalStorage<ViewMode>(
    "alfred.agenda.view",
    "timeline",
  );
  const { user } = useAuth();
  const { pushCompletionOp } = useRecurringSync(user?.id);
  const { habits, habitLogs, setHabitLogs } = useCloudHabits();
  const { goals, setGoals } = useCloudGoals();
  const recoveries = useMemo(
    () => habitsAtRisk(habits, habitLogs, now),
    [habits, habitLogs, now],
  );

  const refresh = useCallback(() => {
    getTodayEvents().then(setEvents);
  }, []);

  // Day-rollover carry-over — runs once per local day, idempotent.
  useEffect(() => {
    let alive = true;
    runCarryOver().then((result) => {
      if (!alive) return;
      if (result.carried.length > 0) {
        toast({
          title: `${result.carried.length} item${result.carried.length === 1 ? "" : "s"} carried over`,
          description: "Pulled forward from previous days. Some are starting to pile up.",
        });
        notifyCarryOver(result.carried.length);
        refresh();
      }
      if (result.failed.length > 0) {
        toast({
          title: `Could not carry ${result.failed.length} calendar event${result.failed.length === 1 ? "" : "s"}`,
          description: "They'll stay on their original day until you reschedule.",
          variant: "destructive",
        });
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Schedule reminders for upcoming timed events.
  useEffect(() => {
    if (!events) return;
    scheduleUpcomingReminders(events, now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Auto-generate follow-up tasks for interview-shaped events.
  useEffect(() => {
    if (!events) return;
    const result = processForFollowUps(events);
    if (result.created.length > 0) {
      toast({
        title: `${result.created.length} follow-up${result.created.length === 1 ? "" : "s"} added`,
        description: result.created
          .slice(0, 3)
          .map((e) => e.title)
          .join(" · "),
      });
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    const onFocus = () => refresh();
    window.addEventListener(LOCAL_EVENTS_CHANGED, onChange);
    window.addEventListener(GOOGLE_CONNECTED_CHANGED, onChange);
    window.addEventListener(OUTLOOK_CONNECTED_CHANGED, onChange);
    window.addEventListener(FOLLOWUP_SETTINGS_CHANGED, onChange);
    window.addEventListener(RECURRING_CHANGED, onChange);
    window.addEventListener("storage", onChange);
    window.addEventListener("focus", onFocus);
    // Periodic poll (5 min). Local-only sessions skip the network in getTodayEvents.
    const poll = setInterval(refresh, 5 * 60_000);
    return () => {
      window.removeEventListener(LOCAL_EVENTS_CHANGED, onChange);
      window.removeEventListener(GOOGLE_CONNECTED_CHANGED, onChange);
      window.removeEventListener(OUTLOOK_CONNECTED_CHANGED, onChange);
      window.removeEventListener(FOLLOWUP_SETTINGS_CHANGED, onChange);
      window.removeEventListener(RECURRING_CHANGED, onChange);
      window.removeEventListener("storage", onChange);
      window.removeEventListener("focus", onFocus);
      clearInterval(poll);
    };
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // A sub-goal ticked anywhere — the recap list, the timeline rail, another
  // screen — writes through the same store and fires this. Without it the two
  // surfaces on this page disagree about what's crossed off.
  useEffect(() => {
    const onChange = () => setTargetTick((n) => n + 1);
    window.addEventListener(GOAL_TARGETS_CHANGED, onChange);
    return () => window.removeEventListener(GOAL_TARGETS_CHANGED, onChange);
  }, []);

  const today = useMemo(
    () => (events ? sortByStart(filterToDay(events, now)) : []),
    [events, now],
  );
  const ongoing = useMemo(() => currentEvent(today, now), [today, now]);
  const upcoming = useMemo(() => nextEvent(today, now), [today, now]);
  const loading = events === null;
  const completedCount = today.filter((e) => e.completed).length;

  const handleToggle = async (id: string) => {
    const ev = today.find((e) => e.id === id);
    if (!ev) return;

    // Recurring instance — update per-day completion store + cloud sync.
    if (ev.source === "recurring") {
      const parsed = parseRecurringInstanceId(ev.id);
      if (!parsed) return;
      const nextCompleted = !ev.completed;

      // 1. Local state
      setRecurringCompleted(parsed.templateId, parsed.dateStr, nextCompleted);
      setEvents((prev) =>
        prev ? prev.map((e) => (e.id === id ? { ...e, completed: nextCompleted } : e)) : prev,
      );

      // 2. Cloud sync (fire-and-forget)
      pushCompletionOp(parsed.templateId, parsed.dateStr, nextCompleted, false);

      if (nextCompleted) {
        // 3. Base XP for completing a routine block
        awardXp(XP_VALUES.EVENT_COMPLETE, "event", { hourOfDay: new Date().getHours() });

        // 4. Auto-log progress toward a linked goal (if any)
        const template = loadTemplates().find((t) => t.id === parsed.templateId);
        if (template?.goalId) {
          try {
            const raw = localStorage.getItem(GOALS_KEY);
            const allGoals: Goal[] = raw ? (JSON.parse(raw) as Goal[]) : [];
            const goal = allGoals.find((g) => g.id === template.goalId);
            if (goal) {
              const delta = template.goalValue ?? templateDurationMinutes(template);
              const updated = logProgress({ goal, delta });
              const newGoals = allGoals.map((g) => (g.id === goal.id ? updated : g));
              localStorage.setItem(GOALS_KEY, JSON.stringify(newGoals));
              // Push to cloud so the other device sees it too
              if (user?.id) upsertGoal(user.id, updated).catch(console.error);
              // Proportional XP on top of base
              awardXp(
                progressXp(delta, goal.target),
                "event",
                { hourOfDay: new Date().getHours() },
              );
              toast({
                title: `${ev.title} ✓`,
                description: `+${delta}${goal.unit ? " " + goal.unit : ""} logged toward "${goal.title}"`,
              });
            } else {
              toast({ title: "Routine done ✓", description: ev.title });
            }
          } catch {
            toast({ title: "Routine done ✓", description: ev.title });
          }
        } else {
          toast({ title: "Routine done ✓", description: ev.title });
        }
      }
      return;
    }

    const isRemote = ev.source === "google" || ev.source === "outlook";
    if (isRemote) {
      const provider = ev.source === "google" ? "Google" : "Outlook";
      const remoteUpdate =
        ev.source === "google" ? updateGoogleEvent : updateOutlookEvent;
      const nextCompleted = !ev.completed;
      // Optimistic UI
      setEvents((prev) =>
        prev
          ? prev.map((e) => (e.id === id ? { ...e, completed: nextCompleted } : e))
          : prev,
      );
      try {
        await remoteUpdate(id, { completed: nextCompleted });
        if (nextCompleted) {
          toast({ title: "Marked complete", description: ev.title });
          awardXp(XP_VALUES.EVENT_COMPLETE, "event", {
            hourOfDay: new Date().getHours(),
          });
        }
      } catch (err) {
        // Revert
        setEvents((prev) =>
          prev
            ? prev.map((e) => (e.id === id ? { ...e, completed: ev.completed } : e))
            : prev,
        );
        toast({
          title: `Could not update ${provider} event`,
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
      }
      return;
    }
    const updated = toggleEventCompleted(id);
    if (updated?.completed) {
      toast({ title: "Marked complete", description: updated.title });
    }
  };

  const handleRemove = async (id: string) => {
    const ev = today.find((e) => e.id === id);
    if (!ev) return;

    // Recurring instance — skip just for today, not delete the template.
    if (ev.source === "recurring") {
      const parsed = parseRecurringInstanceId(ev.id);
      if (!parsed) return;
      setRecurringSkipped(parsed.templateId, parsed.dateStr, true);
      setEvents((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
      pushCompletionOp(parsed.templateId, parsed.dateStr, false, true);
      toast({ title: "Skipped today", description: "It'll be back tomorrow. Edit in Daily Schedule to remove it." });
      return;
    }

    const isRemote = ev.source === "google" || ev.source === "outlook";
    if (isRemote) {
      const provider = ev.source === "google" ? "Google" : "Outlook";
      const remoteDelete =
        ev.source === "google" ? deleteGoogleEvent : deleteOutlookEvent;
      // Optimistic remove
      setEvents((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
      try {
        await remoteDelete(id);
        toast({ title: "Event removed", description: ev.title });
      } catch (err) {
        // Re-fetch on failure
        refresh();
        toast({
          title: `Could not delete ${provider} event`,
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
      }
      return;
    }
    removeLocalEvent(id);
    toast({ title: "Event removed", description: ev.title });
  };

  /** One path for crossing a habit off, wherever it's ticked from. */
  const handleToggleHabitById = (habitId: string) => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;
    const next = applyHabitToggle(habit, habitLogs, goals);
    setHabitLogs(next.logs);
    if (next.goals !== goals) setGoals(next.goals);
  };

  /** Habits + daily sub-goals, as untimed chips for the timeline's rail. */
  const anytimeItems: AnytimeItem[] = useMemo(() => {
    const dateStr = todayKey(now);
    const loggedToday = new Set(
      habitLogs.filter((l) => l.date === dateStr).map((l) => l.habitId),
    );
    const habitChips: AnytimeItem[] = habits
      .filter((h) => !h.archived && (h.cadence === "daily" || loggedToday.has(h.id)))
      .map((h) => ({ id: h.id, title: h.title, kind: "habit", done: loggedToday.has(h.id) }));

    const log = loadTargetLog();
    const targetChips: AnytimeItem[] = loadTargets()
      .filter((t) => !t.archived)
      .map((t) => ({
        id: t.id,
        title: t.title,
        kind: "target",
        done: isAnsweredToday(t, log, dateStr),
      }));

    return [...habitChips, ...targetChips];
    // targetTick re-reads the sub-goal store after a tick here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits, habitLogs, now, targetTick]);

  const handleToggleAnytime = (item: AnytimeItem) => {
    if (item.kind === "habit") {
      handleToggleHabitById(item.id);
      return;
    }
    const dateStr = todayKey(now);
    const log = loadTargetLog();
    const target = loadTargets().find((t) => t.id === item.id);
    // "log" sub-goals are answered with a number, not a tick.
    if (!target || target.kind === "log") return;
    const existing = getEntry(log, target.id, dateStr);
    setEntry(target.id, existing?.done ? null : { ...existing, done: true }, dateStr);
    setTargetTick((n) => n + 1);
  };

  const handleHabitMarkDone = (habitId: string) => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;
    const result = toggleHabitForToday(habit, habitLogs, now);
    setHabitLogs(result.logs);
    if (result.nowComplete) {
      toast({ title: "Back on track", description: habit.title });
      const streakDays = currentStreakFor(habit, result.logs);
      awardXp(XP_VALUES.HABIT_COMPLETE, "habit", { streakDays });
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={formatLongDate(now)}
        title="Agenda"
        description="Today's engagements at a glance — Alfred will plan focus blocks around them."
        actions={
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <PushToggle />
            <NotificationToggle />
            <ReminderSettings />
            <FollowUpSettingsButton />
            <GoogleCalendarConnect onSynced={refresh} />
            <OutlookCalendarConnect onSynced={refresh} />
          </div>
        }
      />

      <ChallengeHeader
        habits={habits}
        habitLogs={habitLogs}
        goals={goals}
        onToggleHabit={(habit) => {
          const next = applyHabitToggle(habit, habitLogs, goals);
          setHabitLogs(next.logs);
          if (next.goals !== goals) setGoals(next.goals);
        }}
      />

      {/* Hero — current / next */}
      {(ongoing || upcoming) && (
        <Card className="p-6 bg-gradient-card border-border">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-gold mb-1">
                {ongoing ? "Happening now" : "Up next"}
              </div>
              <h2 className="font-display text-3xl text-foreground line-clamp-2 flex items-center gap-3">
                {(ongoing ?? upcoming)!.emoji && (
                  <span aria-hidden>{(ongoing ?? upcoming)!.emoji}</span>
                )}
                <span>{(ongoing ?? upcoming)!.title}</span>
              </h2>
              <div className="mt-2 flex items-center gap-4 text-xs font-mono text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatEventTime((ongoing ?? upcoming)!)}
                </span>
                {(ongoing ?? upcoming)!.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {(ongoing ?? upcoming)!.location}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Habits at risk — escalating priority */}
      {recoveries.length > 0 && (
        <RecoveryPanel
          recoveries={recoveries}
          onMarkDone={handleHabitMarkDone}
          compact
          limit={5}
        />
      )}

      {/* Quick add */}
      <QuickAddEvent />

      {/* Suggested schedule from goals — fills gaps around the calendar */}
      <SuggestedSchedule events={events ?? []} now={now} onAdded={refresh} />

      {/* Retime suggestions — learned from when blocks are actually done */}
      <SuggestedRetimes now={now} onChanged={refresh} />

      {/* Day view */}
      <Card className="p-6 bg-gradient-card border-border">
        <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
          <div>
            <h3 className="font-display text-2xl">Today</h3>
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
              {loading
                ? "Loading"
                : `${completedCount}/${today.length} complete`}
            </span>
          </div>
          <div
            className="inline-flex rounded-md border border-border/60 bg-background/40 p-0.5"
            role="tablist"
            aria-label="View mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === "timeline"}
              onClick={() => setView("timeline")}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] uppercase transition-all ${
                view === "timeline"
                  ? "bg-gold/20 text-gold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Timeline
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "list"}
              onClick={() => setView("list")}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] uppercase transition-all ${
                view === "list"
                  ? "bg-gold/20 text-gold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutList className="h-3.5 w-3.5" />
              List
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-md bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : today.length === 0 && anytimeItems.length === 0 ? (
          <EmptyState />
        ) : view === "timeline" ? (
          <DayTimeline
            events={today}
            now={now}
            onToggleComplete={handleToggle}
            onEdit={(id) => setEditingId(id)}
            onRemove={handleRemove}
            anytime={anytimeItems}
            onToggleAnytime={handleToggleAnytime}
          />
        ) : (
          <ol className="relative border-l border-border/60 pl-5 space-y-4">
            {today.map((e) => {
              const isNow = ongoing?.id === e.id;
              const isEditing = editingId === e.id;
              const isManual =
                e.source === "manual" ||
                e.source === "google" ||
                e.source === "outlook";
              return (
                <li key={e.id} className="relative">
                  <span
                    className={`absolute -left-[27px] top-2 h-3 w-3 rounded-full border-2 ${
                      e.completed
                        ? "bg-gold/70 border-gold/70"
                        : isNow
                          ? "bg-gold border-gold shadow-gold animate-pulse"
                          : "bg-background border-border"
                    }`}
                    aria-hidden
                  />

                  {isEditing ? (
                    <EditEventForm
                      event={e}
                      onClose={() => setEditingId(null)}
                    />
                  ) : (
                    <div
                      className={`rounded-md border p-4 transition-all ${
                        isNow
                          ? "border-gold/50 bg-background/60"
                          : e.completed
                            ? "border-border/40 bg-background/30 opacity-70"
                            : "border-border/60 bg-background/40 hover:border-gold/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggle(e.id)}
                            className="mt-0.5 text-muted-foreground/60 hover:text-gold transition-colors"
                            aria-label={
                              e.completed
                                ? `Mark ${e.title} incomplete`
                                : `Mark ${e.title} complete`
                            }
                          >
                            {e.completed ? (
                              <CheckCircle2 className="h-4 w-4 text-gold" />
                            ) : (
                              <Circle className="h-4 w-4" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <div
                              className={`font-display text-lg line-clamp-1 flex items-center gap-2 ${
                                e.completed
                                  ? "text-muted-foreground line-through"
                                  : "text-foreground"
                              }`}
                            >
                              {e.emoji && <span aria-hidden>{e.emoji}</span>}
                              <span>{e.title}</span>
                            </div>
                            {e.calendarName && (
                              <div className="mt-0.5 font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground/70">
                                {e.calendarName}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] tracking-wider text-gold whitespace-nowrap">
                            {formatEventTime(e)}
                          </span>
                          {isManual && (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingId(e.id)}
                                className="text-muted-foreground/60 hover:text-gold transition-colors p-1"
                                aria-label={`Edit ${e.title}`}
                                title="Edit event"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemove(e.id)}
                                className="text-muted-foreground/60 hover:text-destructive transition-colors p-1"
                                aria-label={`Remove ${e.title}`}
                                title="Remove event"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {(e.location || e.description) && (
                        <div className="mt-2 ml-7 space-y-1 text-xs text-muted-foreground">
                          {e.location && (
                            <div className="inline-flex items-center gap-1.5">
                              <MapPin className="h-3 w-3" />
                              {e.location}
                            </div>
                          )}
                          {e.description && (
                            <p className="line-clamp-2">{e.description}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {/* Inline edit panel for timeline view */}
        {view === "timeline" && editingId && (
          (() => {
            const ev = today.find((e) => e.id === editingId);
            if (!ev) return null;
            return (
              <div className="mt-4">
                <EditEventForm
                  event={ev}
                  onClose={() => setEditingId(null)}
                />
              </div>
            );
          })()
        )}
      </Card>

      {/* Crossed-off recap of the day + copy-out for Notes/Reminders/Calendar */}
      <DailyRecap
        events={today}
        habits={habits}
        habitLogs={habitLogs}
        now={now}
        onToggleEvent={handleToggle}
        onToggleHabit={handleToggleHabitById}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-md border border-dashed border-border/60 p-8 text-center space-y-3">
      <div className="mx-auto h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center">
        <Plug className="h-5 w-5 text-gold" />
      </div>
      <div>
        <p className="font-display italic text-foreground">
          "A perfectly empty diary, sir."
        </p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Add an event with Quick Add above, or connect Google Calendar to
          import your existing engagements.
        </p>
      </div>
      <p className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground/60">
        Google Calendar sync · coming next
      </p>
    </div>
  );
}
