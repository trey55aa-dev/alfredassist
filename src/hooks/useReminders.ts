// App-wide reminder engine. Mounted once in AppLayout so reminders fire on any
// page (previously only the Agenda scheduled them). Schedules routine-block
// "starting soon" alerts and fires the evening streak / afternoon goal nudges.
//
// Delivery goes through notifications.deliver() — the Web Notifications API while
// the app is open. Swapping deliver() for @capacitor/local-notifications in the
// iOS build (see docs/SETUP_AUTH_AND_MOBILE.md) makes these fire while closed.

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getTodayEvents } from "@/lib/agenda";
import {
  REMINDER_PREFS_CHANGED,
  getReminderPrefs,
  isEnabled,
  notifyDailyNudge,
  scheduleUpcomingReminders,
} from "@/lib/notifications";
import { goalCheckInDue, streakAtRisk } from "@/lib/reminders";

export function useReminders(): void {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let alive = true;

    const run = async () => {
      if (!isEnabled()) return;
      const prefs = getReminderPrefs();

      if (prefs.blockReminders) {
        try {
          const events = await getTodayEvents();
          if (alive) scheduleUpcomingReminders(events);
        } catch {
          /* offline / no calendar — skip */
        }
      }

      const now = new Date();
      if (prefs.streakNudge) {
        const s = streakAtRisk(now);
        if (s.due) {
          notifyDailyNudge(
            "streak-risk",
            "Protect your streak",
            `${s.remaining} task${s.remaining === 1 ? "" : "s"} left to keep today's streak alive.`,
          );
        }
      }
      if (prefs.goalNudge) {
        const g = goalCheckInDue(now);
        if (g.due) {
          notifyDailyNudge(
            "goal-checkin",
            "Goal check-in",
            `Log progress on ${g.count} goal${g.count === 1 ? "" : "s"} today.`,
          );
        }
      }
    };

    run();
    const onWake = () => run();
    window.addEventListener("focus", onWake);
    window.addEventListener(REMINDER_PREFS_CHANGED, onWake);
    const id = window.setInterval(run, 5 * 60 * 1000);

    return () => {
      alive = false;
      window.removeEventListener("focus", onWake);
      window.removeEventListener(REMINDER_PREFS_CHANGED, onWake);
      window.clearInterval(id);
    };
  }, [user]);
}
