import { useEffect, useMemo, useState } from "react";
import { ImageIcon, Download } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useThemeColor, hslToHex } from "@/hooks/useThemeColor";
import {
  DEFAULT_APP_ICON,
  applyAppIcon,
  buildIconSvg,
  getAppIcon,
  getIconSyncWithTheme,
  iconColorsFromTheme,
  renderIconPng,
  saveAppIcon,
  setIconSyncWithTheme,
  svgToDataUrl,
} from "@/lib/appIcon";

// The letter is always "A" — the Alfred brand mark.
const SYMBOL = "A";

export function AppIconCustomizer() {
  const { toast } = useToast();
  const { theme, accent } = useThemeColor();
  const [syncWithTheme, setSyncWithTheme] = useState(() => getIconSyncWithTheme());

  // When synced, colors are always derived from the live theme/accent.
  // When unsynced, user picks manually.
  const [manualBg, setManualBg] = useState(() =>
    syncWithTheme ? iconColorsFromTheme().bgColor : getAppIcon().bgColor,
  );
  const [manualFg, setManualFg] = useState(() =>
    syncWithTheme ? iconColorsFromTheme().fgColor : getAppIcon().fgColor,
  );
  const [radius, setRadius] = useState(() => getAppIcon().radius);

  const { bgColor, fgColor } = syncWithTheme
    ? iconColorsFromTheme()
    : { bgColor: manualBg, fgColor: manualFg };

  const cfg = { symbol: SYMBOL, bgColor, fgColor, radius };

  const previewSrc = useMemo(
    () => svgToDataUrl(buildIconSvg(cfg, 256)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bgColor, fgColor, radius],
  );

  // When sync is on and the theme/accent changes, auto-apply immediately.
  useEffect(() => {
    if (!syncWithTheme) return;
    const colors = iconColorsFromTheme();
    const next = { symbol: SYMBOL, bgColor: colors.bgColor, fgColor: colors.fgColor, radius };
    saveAppIcon(next);
    applyAppIcon(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.background, accent.hsl, syncWithTheme]);

  const handleSyncToggle = (on: boolean) => {
    setSyncWithTheme(on);
    setIconSyncWithTheme(on);
    if (on) {
      const colors = iconColorsFromTheme();
      setManualBg(colors.bgColor);
      setManualFg(colors.fgColor);
    }
  };

  const apply = async () => {
    saveAppIcon(cfg);
    await applyAppIcon(cfg);
    toast({
      title: "Icon updated",
      description:
        "Browser tab updated now. Remove & re-add to your home screen to refresh that icon.",
    });
  };

  const reset = async () => {
    setSyncWithTheme(true);
    setIconSyncWithTheme(true);
    setRadius(DEFAULT_APP_ICON.radius);
    const colors = iconColorsFromTheme();
    const next = { ...DEFAULT_APP_ICON, bgColor: colors.bgColor, fgColor: colors.fgColor };
    saveAppIcon(next);
    await applyAppIcon(next);
    toast({ title: "Icon reset" });
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

  // Tiny accent swatch to show what color theme->icon would be
  const accentHex = hslToHex(accent.hsl);

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
      <PopoverContent side="right" align="start" className="w-60 bg-popover border-border">
        <div className="space-y-3">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
            App Icon
          </div>

          {/* Live preview — always shows the A */}
          <div className="flex justify-center">
            <img
              src={previewSrc}
              alt="Icon preview"
              className="h-20 w-20 rounded-2xl border border-border shadow-lg"
            />
          </div>

          {/* Sync with theme toggle */}
          <label className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/30 px-2.5 py-2">
            <div className="min-w-0">
              <div className="font-mono text-[10px] tracking-wider uppercase text-foreground">
                Match app theme
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div
                  className="h-3 w-3 rounded-full border border-border"
                  style={{ background: bgColor }}
                />
                <div
                  className="h-3 w-3 rounded-full border border-border"
                  style={{ background: fgColor }}
                />
                <span className="font-mono text-[9px] text-muted-foreground">
                  auto-updates with your theme
                </span>
              </div>
            </div>
            <Switch
              checked={syncWithTheme}
              onCheckedChange={handleSyncToggle}
              className="data-[state=checked]:bg-gold h-4 w-7 shrink-0"
            />
          </label>

          {/* Manual color pickers — only visible when not synced */}
          {!syncWithTheme && (
            <div className="space-y-2">
              <div className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground">
                Custom colors
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Background</span>
                  <input
                    type="color"
                    value={manualBg}
                    onChange={(e) => setManualBg(e.target.value)}
                    className="h-8 w-full rounded cursor-pointer bg-transparent border border-border"
                    aria-label="Icon background color"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>A color</span>
                  <input
                    type="color"
                    value={manualFg}
                    onChange={(e) => setManualFg(e.target.value)}
                    className="h-8 w-full rounded cursor-pointer bg-transparent border border-border"
                    aria-label="Icon letter color"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Roundness — always shown */}
          <label className="block space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Corner roundness
            </span>
            <input
              type="range"
              min={0}
              max={50}
              value={Math.round(radius * 100)}
              onChange={(e) => setRadius(Number(e.target.value) / 100)}
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
              title="Download PNG (512×512)"
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
            Reset
          </button>

          <p className="font-mono text-[9px] text-muted-foreground/60 leading-snug">
            Browser tab updates instantly. Remove & re-add to home screen to refresh that icon.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
