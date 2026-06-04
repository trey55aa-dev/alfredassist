// User-customizable app icon. Controls the favicon (live) and the
// apple-touch-icon used when adding to the home screen (fresh adds only —
// iOS caches an already-installed icon until you remove & re-add).
//
// Persisted to localStorage; applied on app load. Per-device by design.

export interface AppIconConfig {
  /** A letter or single emoji to render, e.g. "A" or "🎯". */
  symbol: string;
  /** Background hex, e.g. "#0a0d14". */
  bgColor: string;
  /** Symbol hex, e.g. "#caa45a". */
  fgColor: string;
  /** Rounded-corner radius as a fraction of size (0–0.5). */
  radius: number;
}

const KEY = "alfred.appIcon";

export const DEFAULT_APP_ICON: AppIconConfig = {
  symbol: "A",
  bgColor: "#0a0d14",
  fgColor: "#caa45a",
  radius: 0.22,
};

export function getAppIcon(): AppIconConfig {
  if (typeof window === "undefined") return DEFAULT_APP_ICON;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_APP_ICON;
    return { ...DEFAULT_APP_ICON, ...(JSON.parse(raw) as Partial<AppIconConfig>) };
  } catch {
    return DEFAULT_APP_ICON;
  }
}

export function saveAppIcon(cfg: AppIconConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

/** Build the icon as an SVG string at the given pixel size. */
export function buildIconSvg(cfg: AppIconConfig, size = 512): string {
  const r = Math.round(size * Math.max(0, Math.min(0.5, cfg.radius)));
  // Emoji render better slightly smaller and use the system emoji font;
  // single letters use a serif to match the brand mark.
  const isEmoji = /\p{Extended_Pictographic}/u.test(cfg.symbol);
  const fontSize = isEmoji ? size * 0.6 : size * 0.62;
  const fontFamily = isEmoji
    ? "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"
    : "Georgia,'Times New Roman',serif";
  // Vertical centering: emoji sit on baseline differently than letters.
  const dy = isEmoji ? size * 0.21 : size * 0.21;
  const safeSymbol = (cfg.symbol || "A")
    .slice(0, 2)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${cfg.bgColor}"/>
  <text x="50%" y="50%" dy="${dy}" text-anchor="middle" font-family="${fontFamily}" font-weight="600" font-size="${fontSize}" fill="${cfg.fgColor}">${safeSymbol}</text>
</svg>`;
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Render the icon SVG to a PNG data URL via canvas (browser only). */
export function renderIconPng(cfg: AppIconConfig, size = 180): Promise<string> {
  return new Promise((resolve, reject) => {
    const svg = buildIconSvg(cfg, size);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas context"));
      ctx.drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("icon render failed"));
    img.src = svgToDataUrl(svg);
  });
}

function setLink(rel: string, href: string, attrs: Record<string, string> = {}) {
  let link = document.querySelector<HTMLLinkElement>(
    `link[rel="${rel}"]${attrs.sizes ? `[sizes="${attrs.sizes}"]` : ""}`,
  );
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    Object.entries(attrs).forEach(([k, v]) => link!.setAttribute(k, v));
    document.head.appendChild(link);
  }
  link.href = href;
}

/** Apply the config to favicon (live) + apple-touch-icon (next home-screen add). */
export async function applyAppIcon(cfg: AppIconConfig): Promise<void> {
  if (typeof document === "undefined") return;
  // Favicon: SVG data URL works in modern browsers and stays crisp.
  setLink("icon", svgToDataUrl(buildIconSvg(cfg, 64)), { type: "image/svg+xml" });
  try {
    const png = await renderIconPng(cfg, 180);
    setLink("apple-touch-icon", png);
  } catch {
    /* canvas may be unavailable; favicon still updated */
  }
}

/** Convenience: read saved config and apply it. Call once on app load. */
export async function initAppIcon(): Promise<void> {
  await applyAppIcon(getAppIcon());
}
