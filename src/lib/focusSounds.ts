// Background audio for the Focus timer.
//
// Two kinds of sound:
//  - "radio"   → a live internet-radio stream played through an <audio> element.
//                We use SomaFM, a free, listener-supported, non-commercial
//                station that publishes its stream URLs specifically for use in
//                apps and devices. We don't bundle or redistribute any audio —
//                we just point the player at their public stream, the same way a
//                radio does. (Attribution shown in the UI; SomaFM runs on
//                donations.)
//  - "ambient" → generated locally with the Web Audio API (brown noise, rain,
//                waves). Zero network, zero copyright, works offline.

export type SoundKind = "radio" | "ambient";
export type AmbientKind = "brown" | "rain" | "waves";

export interface FocusSound {
  id: string;
  label: string;
  sub: string;
  emoji: string;
  kind: SoundKind;
  /** radio only — the stream URL. */
  src?: string;
  /** ambient only — which generator to build. */
  ambient?: AmbientKind;
  /** radio only — attribution shown in the UI. */
  credit?: string;
}

// HTTPS direct streams (avoid mixed-content blocking on the deployed HTTPS app).
// 128k MP3 mounts exist for every station below and play in all browsers.
export const FOCUS_SOUNDS: FocusSound[] = [
  {
    id: "lofi",
    label: "Lofi Beats",
    sub: "Instrumental hip-hop",
    emoji: "🎧",
    kind: "radio",
    src: "https://ice1.somafm.com/fluid-128-mp3",
    credit: "SomaFM · Fluid",
  },
  {
    id: "chill",
    label: "Chillout",
    sub: "Ambient downtempo",
    emoji: "🌙",
    kind: "radio",
    src: "https://ice1.somafm.com/groovesalad-128-mp3",
    credit: "SomaFM · Groove Salad",
  },
  {
    id: "jazz",
    label: "Jazz Lounge",
    sub: "Spy jazz & lounge",
    emoji: "🎷",
    kind: "radio",
    src: "https://ice1.somafm.com/secretagent-128-mp3",
    credit: "SomaFM · Secret Agent",
  },
  {
    id: "ambientmusic",
    label: "Deep Space",
    sub: "Atmospheric drones",
    emoji: "🪐",
    kind: "radio",
    src: "https://ice1.somafm.com/dronezone-128-mp3",
    credit: "SomaFM · Drone Zone",
  },
  { id: "brown", label: "Brown Noise", sub: "Deep static", emoji: "🟤", kind: "ambient", ambient: "brown" },
  { id: "rain", label: "Rain", sub: "Steady rainfall", emoji: "🌧️", kind: "ambient", ambient: "rain" },
  { id: "waves", label: "Ocean Waves", sub: "Rolling surf", emoji: "🌊", kind: "ambient", ambient: "waves" },
];

export const CUSTOM_SOUND_ID = "custom";
export const FOCUS_AUDIO_KEY = "alfred.focus.audio";

export function resolveSound(
  selectedId: string | null,
  customUrl: string,
): FocusSound | null {
  if (!selectedId) return null;
  if (selectedId === CUSTOM_SOUND_ID) {
    const url = customUrl.trim();
    return url
      ? { id: CUSTOM_SOUND_ID, label: "Custom stream", sub: url, emoji: "🔗", kind: "radio", src: url }
      : null;
  }
  return FOCUS_SOUNDS.find((s) => s.id === selectedId) ?? null;
}
