import { Link } from "react-router-dom";
import { Activity, Heart, Moon, Footprints, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useHealth } from "@/hooks/useHealth";

export function HealthSummaryCard() {
  const { snapshot, isNative } = useHealth();

  return (
    <Link to="/health" className="block">
      <Card className="p-5 bg-gradient-card border-border hover:border-gold/40 transition-all">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-gold" />
            <h3 className="font-display text-lg">Health</h3>
            {!isNative && (
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70 ml-1">
                preview
              </span>
            )}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>

        {snapshot ? (
          <div className="grid grid-cols-3 gap-3">
            <Metric icon={<Footprints className="h-3.5 w-3.5" />} label="Steps" value={snapshot.steps.toLocaleString()} />
            <Metric icon={<Moon className="h-3.5 w-3.5" />} label="Sleep" value={`${snapshot.sleepHours}h`} />
            <Metric
              icon={<Heart className="h-3.5 w-3.5" />}
              label="Resting HR"
              value={snapshot.restingHeartRate ? `${snapshot.restingHeartRate}` : "—"}
            />
          </div>
        ) : (
          <p className="font-display italic text-sm text-muted-foreground">
            Connect Apple Health to see your daily vitals here.
          </p>
        )}
      </Card>
    </Link>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-muted-foreground mb-1">
        {icon}
        <span className="font-mono text-[9px] tracking-[0.2em] uppercase">{label}</span>
      </div>
      <div className="font-display text-xl text-gold">{value}</div>
    </div>
  );
}
