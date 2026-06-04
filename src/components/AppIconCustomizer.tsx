import { useMemo, useState } from "react";
import { ImageIcon, Download } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AppIconConfig,
  DEFAULT_APP_ICON,
  applyAppIcon,
  buildIconSvg,
  getAppIcon,
  renderIconPng,
  saveAppIcon,
  svgToDataUrl,
} from "@/lib/appIcon";

export function AppIconCustomizer() {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<AppIconConfig>(() => getAppIcon());

  const previewSrc = useMemo(
    () => svgToDataUrl(buildIconSvg(cfg, 256)),
    [cfg],
  );

  const patch = (p: Partial<AppIconConfig>) => setCfg((c) => ({ ...c, ...p }));

  const apply = async () => {
    saveAppIcon(cfg);
    await applyAppIcon(cfg);
    toast({
      title: "Icon updated",
      description:
        "Browser tab updated now. For the home-screen icon, remove & re-add Alfred to your home screen.",
    });
  };

  const reset = async () => {
    setCfg(DEFAULT_APP_ICON);
    saveAppIcon(DEFAULT_APP_ICON);
    await applyAppIcon(DEFAULT_APP_ICON);
    toast({ title: "Icon reset to default" });
  };

  const download = async () => {
    try {
      const png = await renderIconPng(cfg, 512);
      const a = document.createElement("a");
      a.href = png;
      a.download = "alfred-icon.png";
      a.click();
    } catch {
      toast({ title: "Could not generate PNG", variant: "destructive" });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 w-full mt-2 px-2 py-2 rounded-md hover:bg-sidebar-accent/50 transition-colors text-xs text-muted-foreground hover:text-gold">
          <ImageIcon className="h-3.5 w-3.5" />
          <span className="font-mono tracking-wider uppercase">App Icon</span>
          <img
            src={previewSrc}
            alt=""
            className="ml-auto h-4 w-4 rounded-[3px] border border-border"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-64 bg-popover border-border">
        <div className="space-y-3">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
            App Icon
          </div>

          {/* Live preview */}
          <div className="flex justify-center">
            <img
              src={previewSrc}
              alt="Icon preview"
              className="h-20 w-20 rounded-2xl border border-border shadow-lg"
            />
          </div>

          {/* Symbol */}
          <label className="block space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Letter or emoji
            </span>
            <Input
              value={cfg.symbol}
              onChange={(e) => patch({ symbol: e.target.value })}
              maxLength={2}
              placeholder="A"
              className="h-8 text-center text-sm bg-background/50 border-border"
            />
          </label>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Background</span>
              <input
                type="color"
                value={cfg.bgColor}
                onChange={(e) => patch({ bgColor: e.target.value })}
                className="h-7 w-10 rounded cursor-pointer bg-transparent border border-border"
                aria-label="Icon background color"
              />
            </label>
            <label className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Symbol</span>
              <input
                type="color"
                value={cfg.fgColor}
                onChange={(e) => patch({ fgColor: e.target.value })}
                className="h-7 w-10 rounded cursor-pointer bg-transparent border border-border"
                aria-label="Icon symbol color"
              />
            </label>
          </div>

          {/* Roundness */}
          <label className="block space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Corner roundness
            </span>
            <input
              type="range"
              min={0}
              max={50}
              value={Math.round(cfg.radius * 100)}
              onChange={(e) => patch({ radius: Number(e.target.value) / 100 })}
              className="w-full accent-gold"
            />
          </label>

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={apply}
              className="flex-1 bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              Apply
            </Button>
            <button
              type="button"
              onClick={download}
              title="Download PNG"
              className="p-2 rounded-md border border-border text-muted-foreground hover:text-gold transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={reset}
            className="w-full py-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-gold transition-colors"
          >
            Reset to Default
          </button>
          <p className="font-mono text-[9px] text-muted-foreground/70 leading-snug">
            Browser tab updates instantly. Home-screen icon: remove & re-add
            Alfred to your home screen to pick up the new icon.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
