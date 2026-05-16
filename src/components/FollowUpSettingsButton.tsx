import { useState } from "react";
import { Settings2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  FollowUpSettings,
  getFollowUpSettings,
  saveFollowUpSettings,
} from "@/lib/followUps";

export function FollowUpSettingsButton() {
  const { toast } = useToast();
  const [s, setS] = useState<FollowUpSettings>(() => getFollowUpSettings());
  const [keywordDraft, setKeywordDraft] = useState("");

  const patch = (p: Partial<FollowUpSettings>) => {
    const next = { ...s, ...p };
    setS(next);
    saveFollowUpSettings(next);
  };

  const addKeyword = () => {
    const k = keywordDraft.trim().toLowerCase();
    if (!k || s.customKeywords.includes(k)) {
      setKeywordDraft("");
      return;
    }
    patch({ customKeywords: [...s.customKeywords, k] });
    setKeywordDraft("");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-gold hover:border-gold/40 transition-colors"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Follow-ups
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-80 bg-popover border-border"
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-display text-lg">Auto follow-ups</h4>
            <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mt-0.5">
              From calendar events
            </p>
          </div>

          <label className="flex items-center justify-between gap-3">
            <span className="text-xs text-foreground">Enabled</span>
            <Switch
              checked={s.enabled}
              onCheckedChange={(v) => patch({ enabled: v })}
            />
          </label>

          <div className={s.enabled ? "space-y-4" : "space-y-4 opacity-40 pointer-events-none"}>
            <label className="block space-y-1">
              <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">
                Interview follow-up after (hours)
              </span>
              <Input
                type="number"
                min={1}
                max={168}
                value={s.interviewOffsetHours}
                onChange={(e) =>
                  patch({
                    interviewOffsetHours: Math.max(
                      1,
                      Number(e.target.value) || 24,
                    ),
                  })
                }
                className="h-8 text-xs bg-background/50 border-border"
              />
            </label>

            <label className="flex items-center justify-between gap-3">
              <span className="text-xs text-foreground leading-snug">
                Follow up on <em>all</em> meetings
                <span className="block font-mono text-[9px] tracking-wider uppercase text-muted-foreground">
                  not just interviews
                </span>
              </span>
              <Switch
                checked={s.followAllMeetings}
                onCheckedChange={(v) => patch({ followAllMeetings: v })}
              />
            </label>

            <label
              className={
                s.followAllMeetings
                  ? "block space-y-1"
                  : "block space-y-1 opacity-40 pointer-events-none"
              }
            >
              <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">
                General follow-up after (hours)
              </span>
              <Input
                type="number"
                min={1}
                max={168}
                value={s.defaultOffsetHours}
                onChange={(e) =>
                  patch({
                    defaultOffsetHours: Math.max(
                      1,
                      Number(e.target.value) || 48,
                    ),
                  })
                }
                className="h-8 text-xs bg-background/50 border-border"
              />
            </label>

            <div className="space-y-1.5">
              <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">
                Extra trigger words
              </span>
              <div className="flex flex-wrap gap-1.5 items-center">
                {s.customKeywords.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gold/30 bg-gold/10 text-gold text-[10px] font-mono uppercase tracking-[0.15em]"
                  >
                    {k}
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          customKeywords: s.customKeywords.filter(
                            (x) => x !== k,
                          ),
                        })
                      }
                      className="text-gold/70 hover:text-destructive"
                      aria-label={`Remove ${k}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <Input
                  value={keywordDraft}
                  onChange={(e) => setKeywordDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                  onBlur={addKeyword}
                  placeholder="e.g. demo"
                  className="h-6 px-2 text-[11px] bg-background/50 border-border w-24"
                />
              </div>
              <p className="font-mono text-[9px] text-muted-foreground/70 leading-snug">
                Built-in: interview, phone screen, recruiter, hiring manager,
                panel, onsite, intro call…
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() =>
              toast({
                title: "Follow-up settings saved",
                description: s.enabled
                  ? s.followAllMeetings
                    ? "All meetings will get follow-ups."
                    : "Interview-shaped events will get follow-ups."
                  : "Auto follow-ups are off.",
              })
            }
            className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
