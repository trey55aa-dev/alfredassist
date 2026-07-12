// Simple vs. full interface. SIMPLE IS THE DEFAULT: a handful of big, plainly
// worded destinations anyone can use. One switch ("Show everything") unlocks
// the full app for power users. Synced across devices via useCloudStateSync.

import { useSyncExternalStore } from "react";

export type UiMode = "simple" | "full";

export const UI_MODE_KEY = "alfred.uiMode";
export const UI_MODE_CHANGED = "alfred.uiMode:changed";

export function getUiMode(): UiMode {
  if (typeof window === "undefined") return "simple";
  try {
    return JSON.parse(localStorage.getItem(UI_MODE_KEY) ?? '"simple"') === "full"
      ? "full"
      : "simple";
  } catch {
    return "simple";
  }
}

export function setUiMode(mode: UiMode): void {
  try {
    localStorage.setItem(UI_MODE_KEY, JSON.stringify(mode));
  } catch {
    /* quota */
  }
  window.dispatchEvent(new Event(UI_MODE_CHANGED));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(UI_MODE_CHANGED, cb);
  window.addEventListener("storage", cb);
  // Cloud sync adopting a value fires this key-specific event.
  window.addEventListener(`alfred.ls:${UI_MODE_KEY}`, cb);
  return () => {
    window.removeEventListener(UI_MODE_CHANGED, cb);
    window.removeEventListener("storage", cb);
    window.removeEventListener(`alfred.ls:${UI_MODE_KEY}`, cb);
  };
}

export function useUiMode(): UiMode {
  return useSyncExternalStore(subscribe, getUiMode, () => "simple" as UiMode);
}
