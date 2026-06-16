// Background audio for the Focus timer.
//
// Organised as VIBES (moods) → each vibe holds several STATIONS. "Skip" moves
// to the next station within the current vibe (live radio can't skip a song
// inside a stream, so switching station is how you get fresh music instantly).
//
// Two kinds of station:
//  - "radio"   → a live internet-radio stream played through an <audio> element.
//                We use SomaFM, a free, listener-supported, non-commercial
//                station that publishes its stream URLs for use in apps. We
//                don't bundle or redistribute audio — we point the player at
//                their public streams, like a radio. (Attribution in the UI.)
//  - "ambient" → generated locally with the Web Audio API (brown noise, rain,
//                waves). Zero network, zero copyright, works offline.

export type SoundKind = "radio" | "ambient";
export type AmbientKind = "brown" | "rain" | "waves";

export interface Station {
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

export interface Vibe {
  id: string;
  label: string;
  emoji: string;
  blurb: string;
  stationIds: string[];
}

const soma = (id: string) => `https://ice1.somafm.com/${id}-128-mp3`;

// Flat registry of every station. Vibes reference these by id.
export const STATIONS: Station[] = [
  // Lofi & Chill
  { id: "fluid", label: "Fluid", sub: "Lofi & future soul", emoji: "🎧", kind: "radio", src: soma("fluid"), credit: "SomaFM · Fluid" },
  { id: "groovesalad", label: "Groove Salad", sub: "Chill downtempo", emoji: "🥗", kind: "radio", src: soma("groovesalad"), credit: "SomaFM · Groove Salad" },
  { id: "gsclassic", label: "Groove Salad Classic", sub: "Early chill", emoji: "🌿", kind: "radio", src: soma("gsclassic"), credit: "SomaFM · Groove Salad Classic" },
  // Jazz & Lounge
  { id: "secretagent", label: "Secret Agent", sub: "Spy jazz & lounge", emoji: "🎷", kind: "radio", src: soma("secretagent"), credit: "SomaFM · Secret Agent" },
  { id: "illstreet", label: "Illinois St. Lounge", sub: "Vintage cocktail jazz", emoji: "🍸", kind: "radio", src: soma("illstreet"), credit: "SomaFM · Illinois Street Lounge" },
  { id: "sonicuniverse", label: "Sonic Universe", sub: "Modern jazz", emoji: "🎺", kind: "radio", src: soma("sonicuniverse"), credit: "SomaFM · Sonic Universe" },
  // Upbeat & Groovy
  { id: "beatblender", label: "Beat Blender", sub: "Deep house grooves", emoji: "🪩", kind: "radio", src: soma("beatblender"), credit: "SomaFM · Beat Blender" },
  { id: "7soul", label: "Seven Inch Soul", sub: "Soul & funk 45s", emoji: "💃", kind: "radio", src: soma("7soul"), credit: "SomaFM · Seven Inch Soul" },
  { id: "indiepop", label: "Indie Pop Rocks", sub: "Indie pop", emoji: "🎸", kind: "radio", src: soma("indiepop"), credit: "SomaFM · Indie Pop Rocks" },
  // Deep Focus
  { id: "dronezone", label: "Drone Zone", sub: "Ambient space", emoji: "🪐", kind: "radio", src: soma("dronezone"), credit: "SomaFM · Drone Zone" },
  { id: "deepspaceone", label: "Deep Space One", sub: "Deep ambient", emoji: "🌌", kind: "radio", src: soma("deepspaceone"), credit: "SomaFM · Deep Space One" },
  { id: "spacestation", label: "Space Station", sub: "Spaced-out electronica", emoji: "🛰️", kind: "radio", src: soma("spacestation"), credit: "SomaFM · Space Station Soma" },
  // Ambient (generated, offline)
  { id: "brown", label: "Brown Noise", sub: "Deep static", emoji: "🟤", kind: "ambient", ambient: "brown" },
  { id: "rain", label: "Rain", sub: "Steady rainfall", emoji: "🌧️", kind: "ambient", ambient: "rain" },
  { id: "waves", label: "Ocean Waves", sub: "Rolling surf", emoji: "🌊", kind: "ambient", ambient: "waves" },
];

export const VIBES: Vibe[] = [
  { id: "lofi", label: "Lofi & Chill", emoji: "🎧", blurb: "Mellow beats to drift into deep work", stationIds: ["fluid", "groovesalad", "gsclassic"] },
  { id: "jazz", label: "Jazz & Lounge", emoji: "🎷", blurb: "Smoky, smooth, effortlessly cool", stationIds: ["secretagent", "illstreet", "sonicuniverse"] },
  { id: "upbeat", label: "Upbeat & Groovy", emoji: "🪩", blurb: "Keep the energy high", stationIds: ["beatblender", "7soul", "indiepop"] },
  { id: "focus", label: "Deep Focus", emoji: "🪐", blurb: "Wordless, atmospheric, distraction-free", stationIds: ["dronezone", "deepspaceone", "spacestation"] },
  { id: "ambient", label: "Ambient", emoji: "🌧️", blurb: "Noise & nature — works offline", stationIds: ["brown", "rain", "waves"] },
];

export const CUSTOM_STATION_ID = "custom";
export const FOCUS_AUDIO_KEY = "alfred.focus.audio";

export function getStation(id: string | null): Station | undefined {
  if (!id) return undefined;
  return STATIONS.find((s) => s.id === id);
}

export function getVibe(id: string | null): Vibe | undefined {
  if (!id) return undefined;
  return VIBES.find((v) => v.id === id);
}

export function vibeOfStation(stationId: string | null): Vibe | undefined {
  if (!stationId) return undefined;
  return VIBES.find((v) => v.stationIds.includes(stationId));
}

export function resolveStation(
  stationId: string | null,
  customUrl: string,
): Station | null {
  if (!stationId) return null;
  if (stationId === CUSTOM_STATION_ID) {
    const url = customUrl.trim();
    return url
      ? { id: CUSTOM_STATION_ID, label: "Custom stream", sub: url, emoji: "🔗", kind: "radio", src: url }
      : null;
  }
  return getStation(stationId) ?? null;
}
