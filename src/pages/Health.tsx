import { useRef, useState } from "react";
import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  FileUp,
  Heart,
  Moon,
  Footprints,
  Flame,
  Timer as TimerIcon,
  Waves,
  RefreshCw,
  Smartphone,
  Pencil,
  X,
  Dumbbell,
  Info,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHealth, type HealthSnapshot } from "@/hooks/useHealth";
import { parseHealthExport } from "@/lib/parseHealthExport";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

/* ──────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────── */

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ──────────────────────────────────────────────────────────
   Inline editable stat card
────────────────────────────────────────────────────────── */

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  editValue: string;
  unit: string;
  step?: string;
  onSave: (v: string) => void;
}

function StatCard({ icon, label, value, editValue, unit, step = "1", onSave }: StatCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(editValue);

  const open = () => {
    setDraft(editValue);
    setEditing(true);
  };
  const save = () => {
    onSave(draft);
    setEditing(false);
  };
  const cancel = () => setEditing(false);

  return (
    <Card className="p-4 bg-gradient-card border-border group relative">
      {!editing ? (
        <>
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            {icon}
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase flex-1">{label}</span>
            <button
              type="button"
              onClick={open}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-gold transition-all"
              title="Edit"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
          <div className="font-display text-2xl text-gold">{value}</div>
        </>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {icon}
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase">{label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              step={step}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
              className="h-9 bg-background/60 border-border text-base flex-1"
              autoFocus
            />
            <span className="text-xs text-muted-foreground shrink-0">{unit}</span>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={save} className="h-7 px-3 bg-gradient-gold text-primary-foreground text-xs">
              <Check className="h-3 w-3 mr-1" /> Save
            </Button>
            <Button size="sm" variant="outline" onClick={cancel} className="h-7 px-2 border-border">
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────
   Main page
────────────────────────────────────────────────────────── */

export default function Health() {
  const {
    snapshot,
    setSnapshot,
    available,
    isNative,
    loading,
    error,
    requestPermissions,
    sync,
  } = useHealth();

  const [importing, setImporting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const s = snapshot;

  /* ── manual field save ── */
  function patchSnapshot(patch: Partial<HealthSnapshot>) {
    const base: HealthSnapshot = s ?? {
      date: new Date().toISOString().slice(0, 10),
      steps: 0,
      distanceMeters: 0,
      activeEnergyKcal: 0,
      exerciseMinutes: 0,
      restingHeartRate: null,
      heartRateAvg: null,
      hrvMs: null,
      sleepHours: 0,
      workouts: [],
      fetchedAt: Date.now(),
    };
    setSnapshot({ ...base, ...patch, fetchedAt: Date.now() });
    toast.success("Saved");
  }

  /* ── XML import ── */
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset so same file can be re-imported
    setImporting(true);
    try {
      const { snapshot: parsed, warnings } = await parseHealthExport(file);
      setSnapshot(parsed);
      if (warnings.length) {
        warnings.forEach((w) => toast.warning(w));
      }
      toast.success("Apple Health data imported", {
        description: `${parsed.steps.toLocaleString()} steps · ${parsed.sleepHours}h sleep · ${parsed.workouts.length} workout${parsed.workouts.length !== 1 ? "s" : ""}`,
      });
    } catch (err) {
      toast.error("Import failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setImporting(false);
    }
  };

  /* ── native sync ── */
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

  /* ── source label ── */
  const sourceBadge = s
    ? `Updated ${formatDistanceToNow(s.fetchedAt, { addSuffix: true })}`
    : "No data yet";

  /* ── stat helpers ── */
  const km = s ? (s.distanceMeters / 1000).toFixed(2) : "0";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vitals"
        title="Health"
        description="Your daily vitals — steps, sleep, heart, workouts."
        actions={
          <div className="flex flex-wrap gap-2">
            {/* Import from Apple Health export */}
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-gold"
            >
              {importing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4 mr-2" />
              )}
              Import from Apple Health
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={onFileChange}
            />

            {/* Native HealthKit button (only shown on device) */}
            {isNative && (
              <Button onClick={onConnect} variant="outline" className="border-border">
                <Smartphone className="h-4 w-4 mr-2" /> Connect HealthKit
              </Button>
            )}

            {isNative && (
              <Button onClick={onRefresh} variant="outline" disabled={loading} className="border-border">
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}
          </div>
        }
      />

      {/* ── How to import ── */}
      <Card className="border-gold/20 bg-card/40">
        <button
          type="button"
          onClick={() => setShowInstructions((s) => !s)}
          className="w-full flex items-center gap-3 p-4 text-left"
        >
          <Info className="h-4 w-4 text-gold shrink-0" />
          <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-muted-foreground flex-1">
            How to import your real Apple Health data
          </span>
          {showInstructions
            ? <ChevronUp className="h-4 w-4 text-muted-foreground/60" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground/60" />}
        </button>

        {showInstructions && (
          <div className="px-4 pb-4 space-y-4 border-t border-border/40">
            <div className="space-y-1 pt-3">
              <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-gold mb-2">
                Option 1 — Export from the Health app (works right now)
              </p>
              <ol className="space-y-2 text-sm text-foreground/80 list-decimal pl-5">
                <li>On your iPhone, open the <strong>Health app</strong></li>
                <li>Tap your profile picture (top-right corner)</li>
                <li>Scroll down → tap <strong>"Export All Health Data"</strong></li>
                <li>Tap <strong>Export</strong> → share or save the zip file</li>
                <li>Unzip it → find <strong>export.xml</strong></li>
                <li>Come back here and tap <strong>"Import from Apple Health"</strong> → select that file</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                💡 Only today's records are read — the file stays on your device.
              </p>
            </div>

            <div className="space-y-1 border-t border-border/40 pt-3">
              <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-gold mb-2">
                Option 2 — Edit numbers manually (instant)
              </p>
              <p className="text-sm text-muted-foreground">
                Hover over any stat card below and tap the pencil icon to type in the number
                you see in your Health app. Great for quick updates.
              </p>
            </div>

            <div className="space-y-1 border-t border-border/40 pt-3">
              <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-gold mb-2">
                Option 3 — Native iOS build (real-time, automatic)
              </p>
              <p className="text-sm text-muted-foreground">
                When Alfred is built as a native iPhone app with Xcode + Capacitor, it reads
                HealthKit directly — no exports needed. Numbers update automatically throughout
                the day.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* ── Source + last updated ── */}
      <div className="flex items-center justify-between px-1">
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          {s ? `Data for ${format(new Date(s.date), "MMMM d, yyyy")}` : "No data imported yet"}
        </span>
        <span className="font-mono text-[9px] text-muted-foreground/60">{sourceBadge}</span>
      </div>

      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive/30">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Footprints className="h-4 w-4" />}
          label="Steps"
          value={s ? s.steps.toLocaleString() : "—"}
          editValue={s ? String(s.steps) : "0"}
          unit="steps"
          onSave={(v) => patchSnapshot({ steps: Math.round(Number(v)) })}
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Distance"
          value={s ? `${km} km` : "—"}
          editValue={s ? km : "0"}
          unit="km"
          step="0.01"
          onSave={(v) => patchSnapshot({ distanceMeters: Math.round(Number(v) * 1000) })}
        />
        <StatCard
          icon={<Flame className="h-4 w-4" />}
          label="Active Cal"
          value={s ? `${s.activeEnergyKcal} kcal` : "—"}
          editValue={s ? String(s.activeEnergyKcal) : "0"}
          unit="kcal"
          onSave={(v) => patchSnapshot({ activeEnergyKcal: Math.round(Number(v)) })}
        />
        <StatCard
          icon={<TimerIcon className="h-4 w-4" />}
          label="Exercise"
          value={s ? `${s.exerciseMinutes} min` : "—"}
          editValue={s ? String(s.exerciseMinutes) : "0"}
          unit="min"
          onSave={(v) => patchSnapshot({ exerciseMinutes: Math.round(Number(v)) })}
        />
        <StatCard
          icon={<Moon className="h-4 w-4" />}
          label="Sleep"
          value={s ? `${s.sleepHours} h` : "—"}
          editValue={s ? String(s.sleepHours) : "0"}
          unit="hours"
          step="0.1"
          onSave={(v) => patchSnapshot({ sleepHours: Math.round(Number(v) * 10) / 10 })}
        />
        <StatCard
          icon={<Heart className="h-4 w-4" />}
          label="Resting HR"
          value={s?.restingHeartRate ? `${s.restingHeartRate} bpm` : "—"}
          editValue={s?.restingHeartRate ? String(s.restingHeartRate) : ""}
          unit="bpm"
          onSave={(v) => patchSnapshot({ restingHeartRate: v ? Math.round(Number(v)) : null })}
        />
        <StatCard
          icon={<Heart className="h-4 w-4" />}
          label="Avg HR"
          value={s?.heartRateAvg ? `${s.heartRateAvg} bpm` : "—"}
          editValue={s?.heartRateAvg ? String(s.heartRateAvg) : ""}
          unit="bpm"
          onSave={(v) => patchSnapshot({ heartRateAvg: v ? Math.round(Number(v)) : null })}
        />
        <StatCard
          icon={<Waves className="h-4 w-4" />}
          label="HRV"
          value={s?.hrvMs ? `${s.hrvMs} ms` : "—"}
          editValue={s?.hrvMs ? String(s.hrvMs) : ""}
          unit="ms"
          onSave={(v) => patchSnapshot({ hrvMs: v ? Math.round(Number(v)) : null })}
        />
      </div>

      {/* ── Workouts ── */}
      <div className="space-y-3">
        <h3 className="font-display text-xl text-foreground flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-gold" />
          Today's Workouts
        </h3>

        {s && s.workouts.length > 0 ? (
          s.workouts.map((w, idx) => (
            <Card key={idx} className="p-4 bg-gradient-card border-border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-lg text-foreground">{w.type}</div>
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                    {w.startedAt ? formatTime(w.startedAt) : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-gold font-display text-lg">{w.durationMin} min</div>
                  {w.energyKcal > 0 && (
                    <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                      {w.energyKcal} kcal
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-6 bg-card/40 border-border/50 text-center">
            <p className="font-display italic text-muted-foreground text-sm">
              {s
                ? "No workouts logged today. Import again after your workout."
                : "Import your health data to see workouts here."}
            </p>
          </Card>
        )}
      </div>

      {/* ── Empty CTA ── */}
      {!s && (
        <Card className="p-8 bg-gradient-card border-gold/20 text-center space-y-4">
          <div className="text-5xl">🍎</div>
          <h3 className="font-display text-2xl text-foreground">No data yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Tap <strong>"Import from Apple Health"</strong> above and select your{" "}
            <code className="text-gold text-xs">export.xml</code> file. Or hover any stat
            card and tap the pencil to enter numbers manually.
          </p>
          <Button
            onClick={() => setShowInstructions(true)}
            variant="outline"
            className="border-gold/40 text-gold hover:bg-gold/10"
          >
            Show me how →
          </Button>
        </Card>
      )}
    </div>
  );
}
