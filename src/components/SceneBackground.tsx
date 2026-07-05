import { useEffect, useState } from "react";
import {
  loadScene,
  applySceneVars,
  PRESET_SCENES,
  SCENE_CHANGED,
  type SceneState,
} from "@/lib/themeScenes";

/**
 * Paints the active theme "scene" across the whole viewport, behind all content
 * (z-0, non-interactive). Reads the saved scene on mount and re-applies its base
 * colours so the choice survives reloads; repaints on SCENE_CHANGED.
 */
export function SceneBackground() {
  const [scene, setScene] = useState<SceneState | null>(() => loadScene());

  useEffect(() => {
    const refresh = () => {
      const s = loadScene();
      setScene(s);
      if (s) applySceneVars(s);
    };
    refresh();
    window.addEventListener(SCENE_CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SCENE_CHANGED, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!scene) return null;

  // Uploaded picture — cover it, then scrim for text legibility.
  if (scene.id === "image" && scene.image) {
    return (
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-center bg-cover"
          style={{ backgroundImage: `url(${scene.image})` }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, hsl(0 0% 0% / 0.55) 0%, hsl(0 0% 0% / 0.68) 100%)" }}
        />
      </div>
    );
  }

  // On-device generated mesh gradient.
  if (scene.id === "generated" && scene.gradientCss) {
    return (
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0" style={{ background: scene.gradientCss }} />
      </div>
    );
  }

  // Designed preset.
  const preset = PRESET_SCENES.find((p) => p.id === scene.id);
  if (!preset) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: preset.css }} />
      {preset.overlayCss && (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: preset.overlayCss, backgroundSize: preset.overlaySize ?? "auto" }}
        />
      )}
    </div>
  );
}
