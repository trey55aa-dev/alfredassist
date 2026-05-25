// Focus mode: honor-system, in-app distraction reduction.
//
// What it does NOT do (and cannot, from a web app):
//   - Block other apps on iOS / Android / macOS
//   - Edit the system hosts file
//   - Run as a browser extension
//
// What it DOES do:
//   - Hides / dims non-essential navigation in Alfred while active
//   - Surfaces a "commitment list" — sites/apps you've committed to avoid —
//     prominently while focused. Cognitive friction, not enforcement.
//   - Offers one-tap deep links into real blockers you already use
//     (Freedom URL scheme, an iOS Shortcut you wrote, etc.)
//
// State lives in localStorage so it survives page navigation and reloads.

export interface FocusModeState {
  active: boolean;
  /** When the current session started (epoch ms). */
  startedAt: number | null;
  /** Free-form description of what you're focusing on right now. */
  taskTitle: string;
  /** Sites/apps you've committed to avoid (e.g. "Instagram", "twitter.com"). */
  commitments: string[];
  /** Optional URL scheme to launch a real desktop/phone blocker. */
  freedomUrl: string;
  /** Optional iOS Shortcut name. We open shortcuts://run-shortcut?name=<this>. */
  iosShortcutName: string;
}

const KEY = "alfred.focusMode";
export const FOCUS_MODE_CHANGED = "alfred.focusMode:changed";

export const DEFAULT_FOCUS_STATE: FocusModeState = {
  active: false,
  startedAt: null,
  taskTitle: "",
  commitments: [],
  freedomUrl: "freedom://start",
  iosShortcutName: "",
};

function notify(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FOCUS_MODE_CHANGED));
  }
}

export function getFocusState(): FocusModeState {
  if (typeof window === "undefined") return DEFAULT_FOCUS_STATE;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_FOCUS_STATE;
    const parsed = JSON.parse(raw) as Partial<FocusModeState>;
    return { ...DEFAULT_FOCUS_STATE, ...parsed };
  } catch {
    return DEFAULT_FOCUS_STATE;
  }
}

export function setFocusState(next: FocusModeState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(next));
  notify();
}

export function patchFocusState(patch: Partial<FocusModeState>): FocusModeState {
  const next = { ...getFocusState(), ...patch };
  setFocusState(next);
  return next;
}

export interface StartFocusArgs {
  taskTitle?: string;
}

export function startFocus(args: StartFocusArgs = {}): FocusModeState {
  const current = getFocusState();
  return patchFocusState({
    active: true,
    startedAt: Date.now(),
    taskTitle: args.taskTitle?.trim() || current.taskTitle || "",
  });
}

export function stopFocus(): FocusModeState {
  return patchFocusState({ active: false, startedAt: null, taskTitle: "" });
}

/** Build the URL scheme for launching the user's named iOS Shortcut, or null. */
export function iosShortcutUrl(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return `shortcuts://run-shortcut?name=${encodeURIComponent(trimmed)}`;
}

/** Format how long the current focus session has been running, e.g. "23 min". */
export function formatFocusElapsed(state: FocusModeState, now = Date.now()): string {
  if (!state.active || !state.startedAt) return "";
  const min = Math.floor((now - state.startedAt) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
