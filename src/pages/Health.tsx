import { useEffect } from "react";
import {
  Activity,
  Heart,
  Moon,
  Footprints,
  Flame,
  Timer as TimerIcon,
  Waves,
  RefreshCw,
  Smartphone,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useHealth } from "@/hooks/useHealth";
import { toast } from "sonner";

export default function Health() {
  const {
    snapshot,
    available,
    isNative,
    loading,
    error,
    requestPermissions,
    sync,
  } = useHealth();

  // Auto-sync on mount if we already have a snapshot or in preview mode
  useEffect(() => {
    if (snapshot || !isNative) {
      void sync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onConnect = async () => {
    const ok = await requestPermissions();
    if (ok) {
      toast.success("Permissions granted", { description: "Pulling your latest vitals…" });
      const snap = await sync();
      if (snap) toast.success("Synced", { description: "Your health data is up to date." });
    } else {
      toast.error("Permission denied", { description: "Open the Health app and allow access." });
    }
  };

  const onRefresh = async () => {
    const snap = await sync();
    if (snap) toast.success("Synced");
    else if (error) toast.error("Sync failed", { description: error });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Vitals"
        title="Apple Health"
        description="Steps, sleep, heart, and workouts — pulled directly from Apple Health on your device."
      />

      {!isNative && (
        <Card className="p-5 bg-card/60 border-gold/30">
          <div className="flex items-start gap-3">
            <Smartphone className="h-5 w-5 text-gold mt-0.5" />
            <div className="space-y-1">
              <div className="font-display text-base">Preview mode</div>
              <p className="text-sm text-muted-foreground">
                Apple Health only works inside the native iOS app. The numbers below are sample data so
                you can see the layout. Build the app with Capacitor and run it on your iPhone to see
                real metrics.
              </p>
            </div>
          </div>
        </Card>
      )}

      {isNative && available === false && (
        <Card className="p-5 bg-card/60 border-destructive/40">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <div className="font-display text-base">Health unavailable</div>
              <p className="text-sm text-muted-foreground">
                HealthKit isn't available on this device. Make sure you're running on a real iPhone and
                that Health permissions are enabled.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {isNative && (
          <Button
            onClick={onConnect}
            className="bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-gold"
          >
            <ShieldCheck className="h-4 w-4 mr-2" /> Connect Apple Health
          </Button>
        )}
        <Button onClick={onRefresh} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Syncing…" : "Refresh"}
        </Button>
      </div>

      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive/30">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat icon={<Footprints className="h-4 w-4" />} label="Steps" value={snapshot ? snapshot.steps.toLocaleString() : "—"} />
        <Stat
          icon={<Activity className="h-4 w-4" />}
          label="Distance"
          value={snapshot ? `${(snapshot.distanceMeters / 1000).toFixed(2)} km` : "—"}
        />
        <Stat
          icon={<Flame className="h-4 w-4" />}
          label="Active Energy"
          value={snapshot ? `${snapshot.activeEnergyKcal} kcal` : "—"}
        />
        <Stat
          icon={<TimerIcon className="h-4 w-4" />}
          label="Exercise"
          value={snapshot ? `${snapshot.exerciseMinutes} min` : "—"}
        />
        <Stat
          icon={<Moon className="h-4 w-4" />}
          label="Sleep"
          value={snapshot ? `${snapshot.sleepHours} h` : "—"}
        />
        <Stat
          icon={<Heart className="h-4 w-4" />}
          label="Resting HR"
          value={snapshot?.restingHeartRate ? `${snapshot.restingHeartRate} bpm` : "—"}
        />
        <Stat
          icon={<Heart className="h-4 w-4" />}
          label="Avg HR"
          value={snapshot?.heartRateAvg ? `${snapshot.heartRateAvg} bpm` : "—"}
        />
        <Stat
          icon={<Waves className="h-4 w-4" />}
          label="HRV"
          value={snapshot?.hrvMs ? `${snapshot.hrvMs} ms` : "—"}
        />
      </div>

      <div className="space-y-3">
        <h3 className="font-display text-2xl">Today's Workouts</h3>
        {snapshot && snapshot.workouts.length > 0 ? (
          snapshot.workouts.map((w, idx) => (
            <Card key={idx} className="p-4 bg-card/60 border-border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-lg">{w.type}</div>
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                    {new Date(w.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-gold font-display text-lg">{w.durationMin} min</div>
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                    {w.energyKcal} kcal
                  </div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <p className="font-display italic text-muted-foreground">
            No workouts logged today. A walk would do nicely, sir.
          </p>
        )}
      </div>

      <Card className="p-5 bg-card/40 border-border">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-2">
          Setup notes
        </div>
        <ol className="text-sm text-foreground/80 space-y-1.5 list-decimal pl-5">
          <li>Export this project to GitHub and clone it locally.</li>
          <li>
            Run <code className="text-gold">npm install</code> then{" "}
            <code className="text-gold">npx cap add ios</code>.
          </li>
          <li>
            Run <code className="text-gold">npm run build && npx cap sync ios</code>.
          </li>
          <li>
            Open the project in Xcode (<code className="text-gold">npx cap open ios</code>),
            enable the <strong>HealthKit</strong> capability, and add the Health usage descriptions
            to <code className="text-gold">Info.plist</code>.
          </li>
          <li>Run on a real iPhone and tap "Connect Apple Health" above.</li>
        </ol>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4 bg-gradient-card border-border">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase">{label}</span>
      </div>
      <div className="font-display text-2xl text-gold">{value}</div>
    </Card>
  );
}
