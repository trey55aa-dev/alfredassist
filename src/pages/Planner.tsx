import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { RotateCcw } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const AREAS = ["Career / NIL", "Body", "Money", "Skills", "Life"];

type Grid = Record<string, string>; // key = `${area}|${day}`

export default function Planner() {
  const [grid, setGrid] = useLocalStorage<Grid>("alfred.planner", {});

  const update = (area: string, day: string, value: string) => {
    setGrid({ ...grid, [`${area}|${day}`]: value });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Strategy"
        title="Weekly Planner"
        description="Architect the week. One intention per intersection."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGrid({})}
            className="border-border text-muted-foreground hover:text-gold"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        }
      />

      <Card className="p-4 sm:p-6 bg-gradient-card border-border overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header row */}
          <div className="grid grid-cols-[140px_repeat(7,minmax(0,1fr))] gap-2 mb-2">
            <div />
            {DAYS.map((d) => (
              <div
                key={d}
                className="font-mono text-[10px] tracking-[0.3em] uppercase text-gold text-center py-2"
              >
                {d}
              </div>
            ))}
          </div>

          {AREAS.map((area) => (
            <div
              key={area}
              className="grid grid-cols-[140px_repeat(7,minmax(0,1fr))] gap-2 mb-2"
            >
              <div className="font-display text-base text-foreground flex items-center pr-2">
                {area}
              </div>
              {DAYS.map((d) => (
                <Textarea
                  key={d}
                  value={grid[`${area}|${d}`] ?? ""}
                  onChange={(e) => update(area, d, e.target.value)}
                  placeholder="—"
                  className="bg-background/40 border-border text-xs min-h-[80px] resize-none focus-visible:ring-gold/40 focus-visible:border-gold/40 placeholder:text-muted-foreground/40"
                />
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
