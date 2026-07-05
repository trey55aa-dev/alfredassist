import { useRef, useState } from "react";
import { ImagePlus, Sparkles, RotateCcw, Check, Loader2 } from "lucide-react";
import {
  PRESET_SCENES,
  applyScene,
  clearScene,
  loadScene,
  presetToState,
  generateScene,
  readImageAsScaledDataUrl,
  type SceneId,
  type SceneState,
} from "@/lib/themeScenes";

/**
 * Reusable background-scene chooser: designed presets with live previews, plus
 * "upload a picture" and "generate from a vibe". Applies instantly and persists.
 */
export function ScenePicker({ onChange }: { onChange?: () => void }) {
  const [active, setActive] = useState<SceneState | null>(() => loadScene());
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const commit = (state: SceneState | null) => {
    setActive(state);
    onChange?.();
  };

  const choosePreset = (id: SceneId) => {
    const p = PRESET_SCENES.find((s) => s.id === id)!;
    const state = presetToState(p);
    applyScene(state);
    commit(state);
  };

  const reset = () => {
    clearScene();
    commit(null);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const image = await readImageAsScaledDataUrl(file);
      const state: SceneState = { id: "image", image, base: "0 0% 4%", fg: "0 0% 95%" };
      applyScene(state);
      commit(state);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Couldn't load that image.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const generate = () => {
    const state = generateScene(prompt || "alfred");
    applyScene(state);
    commit(state);
  };

  const isActive = (id: SceneId) => active?.id === id;

  return (
    <div className="space-y-4">
      {/* Preset scenes */}
      <div className="grid grid-cols-2 gap-2.5">
        {PRESET_SCENES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => choosePreset(p.id)}
            className={`group relative overflow-hidden rounded-xl border text-left transition-all ${
              isActive(p.id) ? "border-gold ring-2 ring-gold/40" : "border-border/60 hover:border-gold/40"
            }`}
          >
            <div className="h-16 w-full" style={{ background: p.css }}>
              {p.overlayCss && (
                <div className="h-full w-full" style={{ backgroundImage: p.overlayCss, backgroundSize: p.overlaySize ?? "auto" }} />
              )}
            </div>
            <div className="px-2.5 py-1.5 bg-background/70">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-display leading-none">{p.name}</span>
                {isActive(p.id) && <Check className="h-3 w-3 text-gold" />}
              </div>
              <div className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground/60 mt-0.5">
                {p.blurb}
              </div>
            </div>
          </button>
        ))}

        {/* Upload a picture */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className={`relative overflow-hidden rounded-xl border text-left transition-all disabled:opacity-60 ${
            isActive("image") ? "border-gold ring-2 ring-gold/40" : "border-border/60 hover:border-gold/40"
          }`}
        >
          <div className="h-16 w-full flex items-center justify-center bg-cover bg-center"
            style={active?.id === "image" && active.image ? { backgroundImage: `url(${active.image})` } : undefined}>
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin text-gold" />
            ) : (
              <ImagePlus className={`h-5 w-5 ${isActive("image") ? "text-gold" : "text-muted-foreground/60"}`} />
            )}
          </div>
          <div className="px-2.5 py-1.5 bg-background/70">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-display leading-none">Your photo</span>
              {isActive("image") && <Check className="h-3 w-3 text-gold" />}
            </div>
            <div className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground/60 mt-0.5">
              Insert a picture
            </div>
          </div>
        </button>

        {/* Generated preview */}
        <div
          className={`relative overflow-hidden rounded-xl border transition-all ${
            isActive("generated") ? "border-gold ring-2 ring-gold/40" : "border-border/60"
          }`}
        >
          <div
            className="h-16 w-full flex items-center justify-center"
            style={{
              background:
                active?.id === "generated" && active.gradientCss
                  ? active.gradientCss
                  : "conic-gradient(from 210deg, hsl(265 70% 45%), hsl(200 80% 45%), hsl(330 70% 50%), hsl(150 65% 42%), hsl(265 70% 45%))",
            }}
          >
            <Sparkles className="h-5 w-5 text-white/90 drop-shadow" />
          </div>
          <div className="px-2.5 py-1.5 bg-background/70">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-display leading-none">Generate</span>
              {isActive("generated") && <Check className="h-3 w-3 text-gold" />}
            </div>
            <div className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground/60 mt-0.5">
              From a vibe
            </div>
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      {err && <p className="text-[11px] text-coral">{err}</p>}

      {/* Generate-from-a-vibe input */}
      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
          placeholder="Describe a vibe — e.g. cyberpunk sunset…"
          className="flex-1 rounded-xl bg-background/40 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-gold/40 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
        />
        <button
          type="button"
          onClick={generate}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-gold text-primary-foreground px-3 py-2 text-[11px] font-mono tracking-wider uppercase font-semibold hover:bg-gold-soft active:scale-95 transition-all"
        >
          <Sparkles className="h-3.5 w-3.5" /> Generate
        </button>
      </div>

      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center gap-1.5 text-[10px] font-mono tracking-wider uppercase text-muted-foreground/70 hover:text-gold transition-colors"
      >
        <RotateCcw className="h-3 w-3" /> Reset to default
      </button>
    </div>
  );
}
