// useHealth — wraps capacitor-health for iOS HealthKit + Android Health Connect.
// Falls back to deterministic mock data in the browser preview so the UI is usable.

import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useLocalStorage } from "./useLocalStorage";

export interface HealthSnapshot {
  date: string; // yyyy-mm-dd
  steps: number;
  distanceMeters: number;
  activeEnergyKcal: number;
  exerciseMinutes: number;
  restingHeartRate: number | null;
  heartRateAvg: number | null;
  hrvMs: number | null;
  sleepHours: number;
  workouts: Array<{
    type: string;
    durationMin: number;
    energyKcal: number;
    startedAt: number;
  }>;
  fetchedAt: number;
}

export const HEALTH_LOCAL_KEY = "alfred.health.latest";

const todayISO = () => new Date().toISOString().slice(0, 10);

const mockSnapshot = (): HealthSnapshot => {
  // Deterministic-ish per day so it doesn't twitch each render
  const seed = Number(todayISO().replace(/-/g, "")) % 1000;
  const rand = (n: number, off = 0) => ((seed * 9301 + 49297 + off) % 233280) / 233280 * n;
  return {
    date: todayISO(),
    steps: 6200 + Math.round(rand(4200)),
    distanceMeters: 4800 + Math.round(rand(3200, 1)),
    activeEnergyKcal: 280 + Math.round(rand(380, 2)),
    exerciseMinutes: 22 + Math.round(rand(38, 3)),
    restingHeartRate: 56 + Math.round(rand(8, 4)),
    heartRateAvg: 72 + Math.round(rand(12, 5)),
    hrvMs: 42 + Math.round(rand(28, 6)),
    sleepHours: Math.round((6 + rand(2.5, 7)) * 10) / 10,
    workouts: [
      {
        type: "Strength Training",
        durationMin: 38,
        energyKcal: 240,
        startedAt: Date.now() - 1000 * 60 * 60 * 5,
      },
    ],
    fetchedAt: Date.now(),
  };
};

type HealthPlugin = {
  isHealthAvailable: () => Promise<{ available: boolean }>;
  requestHealthPermissions: (opts: { permissions: string[] }) => Promise<{
    permissions: Record<string, boolean>;
  }>;
  queryAggregated: (opts: {
    startDate: string;
    endDate: string;
    dataType: string;
    bucket: string;
  }) => Promise<{ aggregatedData: Array<{ value: number; startDate: string; endDate: string }> }>;
  queryWorkouts: (opts: {
    startDate: string;
    endDate: string;
    includeHeartRate?: boolean;
    includeRoute?: boolean;
    includeSteps?: boolean;
  }) => Promise<{ workouts: Array<{ workoutType: string; duration: number; calories?: number; startDate: string }> }>;
};

const READ_PERMS = [
  "READ_STEPS",
  "READ_DISTANCE",
  "READ_ACTIVE_CALORIES",
  "READ_TOTAL_CALORIES",
  "READ_HEART_RATE",
  "READ_RESTING_HEART_RATE",
  "READ_HEART_RATE_VARIABILITY",
  "READ_SLEEP",
  "READ_WORKOUTS",
];

export function useHealth() {
  const [snapshot, setSnapshot] = useLocalStorage<HealthSnapshot | null>(
    HEALTH_LOCAL_KEY,
    null,
  );
  const [available, setAvailable] = useState<boolean | null>(null);
  const [granted, setGranted] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNative = Capacitor.isNativePlatform();

  const getPlugin = async (): Promise<HealthPlugin | null> => {
    if (!isNative) return null;
    try {
      const mod = await import("capacitor-health");
      // Plugin may be exported as `Health` or default
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((mod as any).Health ?? (mod as any).default) as HealthPlugin;
    } catch (e) {
      console.warn("capacitor-health not available:", e);
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isNative) {
        setAvailable(false);
        return;
      }
      const plugin = await getPlugin();
      if (!plugin || cancelled) {
        setAvailable(false);
        return;
      }
      try {
        const res = await plugin.isHealthAvailable();
        if (!cancelled) setAvailable(!!res.available);
      } catch (e) {
        console.warn("Health availability check failed", e);
        if (!cancelled) setAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNative]);

  const requestPermissions = useCallback(async () => {
    setError(null);
    const plugin = await getPlugin();
    if (!plugin) {
      setGranted(true); // pretend granted in browser so user can preview
      return true;
    }
    try {
      const res = await plugin.requestHealthPermissions({ permissions: READ_PERMS });
      const ok = Object.values(res.permissions).some(Boolean);
      setGranted(ok);
      return ok;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Permission request failed");
      return false;
    }
  }, []);

  const sync = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const plugin = await getPlugin();
      if (!plugin) {
        // Browser fallback
        const snap = mockSnapshot();
        setSnapshot(snap);
        return snap;
      }

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      const safeAgg = async (dataType: string, bucket = "day") => {
        try {
          const r = await plugin.queryAggregated({
            startDate: startISO,
            endDate: endISO,
            dataType,
            bucket,
          });
          return r.aggregatedData?.reduce((s, d) => s + (d.value || 0), 0) ?? 0;
        } catch {
          return 0;
        }
      };

      const safeAvg = async (dataType: string) => {
        try {
          const r = await plugin.queryAggregated({
            startDate: startISO,
            endDate: endISO,
            dataType,
            bucket: "day",
          });
          const vals = (r.aggregatedData ?? []).map((d) => d.value).filter(Boolean);
          if (!vals.length) return null;
          return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        } catch {
          return null;
        }
      };

      const [
        steps,
        distance,
        active,
        exercise,
        sleepMinutes,
        rhr,
        hr,
        hrv,
        wResp,
      ] = await Promise.all([
        safeAgg("steps"),
        safeAgg("distance"),
        safeAgg("active-calories"),
        safeAgg("exercise-time"),
        safeAgg("sleep"),
        safeAvg("resting-heart-rate"),
        safeAvg("heart-rate"),
        safeAvg("heart-rate-variability"),
        plugin
          .queryWorkouts({ startDate: startISO, endDate: endISO })
          .catch(() => ({ workouts: [] })),
      ]);

      const snap: HealthSnapshot = {
        date: todayISO(),
        steps: Math.round(steps),
        distanceMeters: Math.round(distance),
        activeEnergyKcal: Math.round(active),
        exerciseMinutes: Math.round(exercise),
        restingHeartRate: rhr,
        heartRateAvg: hr,
        hrvMs: hrv,
        sleepHours: Math.round((sleepMinutes / 60) * 10) / 10,
        workouts: (wResp.workouts ?? []).map((w) => ({
          type: w.workoutType,
          durationMin: Math.round((w.duration || 0) / 60),
          energyKcal: Math.round(w.calories || 0),
          startedAt: new Date(w.startDate).getTime(),
        })),
        fetchedAt: Date.now(),
      };
      setSnapshot(snap);
      return snap;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Health sync failed";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [setSnapshot]);

  return {
    snapshot,
    setSnapshot,
    available,
    isNative,
    granted,
    loading,
    error,
    requestPermissions,
    sync,
  };
}
