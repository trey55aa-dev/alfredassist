// Full-screen "scenes" — designed background treatments layered behind the app.
// A scene owns the base --background/--foreground colours and is painted by
// <SceneBackground>. It sits ABOVE the existing per-colour theme + accent
// controls: pick a scene for the overall vibe, still tweak the accent separately.

export type SceneId = "modern" | "glass" | "office" | "money" | "image" | "generated";

/** What we persist for the active scene. */
export interface SceneState {
  id: SceneId;
  /** base background as "H S% L%" */
  base: string;
  /** foreground as "H S% L%" */
  fg: string;
  /** data URL — only for the "image" scene */
  image?: string;
  /** the vibe text that produced a "generated" scene */
  prompt?: string;
  /** CSS `background` value — only for the "generated" scene */
  gradientCss?: string;
}

/** A designed, ready-made scene. */
export interface PresetScene {
  id: Exclude<SceneId, "image" | "generated">;
  name: string;
  blurb: string;
  base: string;
  fg: string;
  /** CSS `background` painted across the whole viewport */
  css: string;
  /** optional second layer (grid / scanlines / bokeh) */
  overlayCss?: string;
  /** background-size for the overlay layer(s) */
  overlaySize?: string;
}

export const SCENE_KEY = "alfred.scene";
/** Fired on same-tab scene changes so <SceneBackground> repaints without polling. */
export const SCENE_CHANGED = "alfred.scene:changed";

export const PRESET_SCENES: PresetScene[] = [
  {
    id: "modern",
    name: "Modern",
    blurb: "Clean · deep · minimal",
    base: "230 22% 7%",
    fg: "220 16% 92%",
    css:
      "radial-gradient(120% 90% at 12% -10%, hsl(230 60% 22% / 0.55) 0%, transparent 55%)," +
      "radial-gradient(100% 80% at 100% 110%, hsl(190 70% 30% / 0.35) 0%, transparent 55%)," +
      "linear-gradient(180deg, hsl(230 24% 7%) 0%, hsl(232 26% 5%) 100%)",
  },
  {
    id: "glass",
    name: "Apple Glass",
    blurb: "Frosted · soft · vibrant",
    base: "218 24% 15%",
    fg: "210 32% 95%",
    css:
      "radial-gradient(60% 55% at 18% 12%, hsl(265 85% 70% / 0.40) 0%, transparent 60%)," +
      "radial-gradient(55% 50% at 85% 18%, hsl(200 90% 68% / 0.38) 0%, transparent 60%)," +
      "radial-gradient(60% 60% at 78% 90%, hsl(330 85% 70% / 0.34) 0%, transparent 60%)," +
      "radial-gradient(55% 55% at 15% 92%, hsl(160 80% 62% / 0.30) 0%, transparent 60%)," +
      "linear-gradient(180deg, hsl(218 26% 16%) 0%, hsl(220 28% 12%) 100%)",
    overlayCss: "linear-gradient(180deg, hsl(220 30% 96% / 0.05) 0%, transparent 30%)",
  },
  {
    id: "office",
    name: "Retro Office",
    blurb: "Old-school futurism",
    base: "28 28% 8%",
    fg: "40 42% 88%",
    css:
      "radial-gradient(110% 90% at 50% -20%, hsl(35 80% 30% / 0.40) 0%, transparent 55%)," +
      "linear-gradient(180deg, hsl(28 30% 9%) 0%, hsl(26 32% 6%) 100%)",
    // amber grid + green CRT scanlines
    overlayCss:
      "repeating-linear-gradient(0deg, hsl(140 60% 55% / 0.05) 0 1px, transparent 1px 3px)," +
      "linear-gradient(hsl(40 80% 55% / 0.06) 1px, transparent 1px)," +
      "linear-gradient(90deg, hsl(40 80% 55% / 0.06) 1px, transparent 1px)",
    overlaySize: "auto, 64px 64px, 64px 64px",
  },
  {
    id: "money",
    name: "Money",
    blurb: "Deep green & gold",
    base: "155 42% 7%",
    fg: "140 30% 90%",
    css:
      "radial-gradient(90% 70% at 20% 10%, hsl(150 60% 22% / 0.55) 0%, transparent 55%)," +
      "radial-gradient(80% 70% at 90% 100%, hsl(45 80% 45% / 0.28) 0%, transparent 55%)," +
      "linear-gradient(180deg, hsl(155 45% 8%) 0%, hsl(158 48% 5%) 100%)",
    overlayCss: "radial-gradient(hsl(45 85% 60% / 0.10) 1.3px, transparent 1.6px)",
    overlaySize: "26px 26px",
  },
];

export function presetToState(p: PresetScene): SceneState {
  return { id: p.id, base: p.base, fg: p.fg };
}

/* ---------- generated scenes (on-device, from a text vibe) ---------- */

/** Deterministic 32-bit hash so the same vibe always yields the same scene. */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Turn a free-text "vibe" into a unique multi-point mesh gradient. Fully local
 * and instant — no network, no API key. (True AI image generation can layer on
 * top later once the Gemini key is live.)
 */
export function generateScene(prompt: string): SceneState {
  const h = hashStr(prompt.trim().toLowerCase() || "alfred");
  const hue = h % 360;
  const hue2 = (hue + 40 + ((h >> 3) % 80)) % 360;
  const hue3 = (hue + 175 + ((h >> 6) % 60)) % 360;
  const base = `${hue} 30% 7%`;
  const fg = `${hue} 18% 93%`;
  const gradientCss =
    `radial-gradient(90% 70% at ${10 + (h % 30)}% ${5 + ((h >> 2) % 20)}%, hsl(${hue} 70% 42% / 0.55) 0%, transparent 55%),` +
    `radial-gradient(80% 70% at ${65 + ((h >> 4) % 25)}% ${78 + ((h >> 3) % 16)}%, hsl(${hue2} 75% 46% / 0.42) 0%, transparent 55%),` +
    `radial-gradient(70% 60% at ${60 + ((h >> 5) % 20)}% ${8 + ((h >> 6) % 22)}%, hsl(${hue3} 72% 46% / 0.30) 0%, transparent 55%),` +
    `linear-gradient(180deg, hsl(${hue} 32% 8%) 0%, hsl(${hue} 34% 5%) 100%)`;
  return { id: "generated", prompt, gradientCss, base, fg };
}

/* ---------- uploaded images ---------- */

/**
 * Read a picture, downscale it (keeps localStorage small), and return a JPEG
 * data URL suitable for a cover background.
 */
export function readImageAsScaledDataUrl(file: File, maxDim = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a readable image."));
      img.onload = () => {
        let { width, height } = img;
        const longest = Math.max(width, height);
        if (longest > maxDim) {
          const scale = maxDim / longest;
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable."));
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          reject(new Error("Couldn't process that image."));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- persistence + apply ---------- */

export function loadScene(): SceneState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SCENE_KEY);
    return raw ? (JSON.parse(raw) as SceneState) : null;
  } catch {
    return null;
  }
}

/** Set the base background/foreground CSS variables for a scene. */
export function applySceneVars(state: SceneState): void {
  const root = document.documentElement.style;
  root.setProperty("--background", state.base);
  root.setProperty("--foreground", state.fg);
}

export function applyScene(state: SceneState): void {
  try {
    localStorage.setItem(SCENE_KEY, JSON.stringify(state));
  } catch {
    /* quota — an image may be too large; the vars still apply for this session */
  }
  applySceneVars(state);
  window.dispatchEvent(new Event(SCENE_CHANGED));
}

/** Back to the app's default look (removes the inline overrides). */
export function clearScene(): void {
  try {
    localStorage.removeItem(SCENE_KEY);
  } catch {
    /* ignore */
  }
  const root = document.documentElement.style;
  root.removeProperty("--background");
  root.removeProperty("--foreground");
  window.dispatchEvent(new Event(SCENE_CHANGED));
}
