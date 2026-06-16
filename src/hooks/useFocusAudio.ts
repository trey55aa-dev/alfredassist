import { useCallback, useEffect, useRef, useState } from "react";
import {
  CUSTOM_STATION_ID,
  FOCUS_AUDIO_KEY,
  STATIONS,
  VIBES,
  getVibe,
  resolveStation,
  vibeOfStation,
  type AmbientKind,
  type Station,
  type Vibe,
} from "@/lib/focusSounds";

interface Persisted {
  vibeId: string | null;
  stationId: string | null;
  volume: number;
  autoWithTimer: boolean;
  customUrl: string;
}

function loadPersisted(): Persisted {
  const fallback: Persisted = {
    vibeId: null,
    stationId: null,
    volume: 0.5,
    autoWithTimer: true,
    customUrl: "",
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(FOCUS_AUDIO_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

/* ---------- Web Audio ambient generators ---------- */

interface AmbientNodes {
  stop: () => void;
}

function makeNoiseBuffer(ctx: AudioContext, type: "white" | "brown", seconds = 4): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  if (type === "white") {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  } else {
    // Brown noise = integrated white noise, with gain compensation.
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.5;
    }
  }
  return buf;
}

function buildAmbient(ctx: AudioContext, kind: AmbientKind, out: AudioNode): AmbientNodes {
  if (kind === "brown") {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, "brown");
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1000;
    src.connect(lp);
    lp.connect(out);
    src.start();
    return { stop: () => { try { src.stop(); } catch { /* already stopped */ } } };
  }

  if (kind === "rain") {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, "white");
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 600;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 6500;
    src.connect(hp);
    hp.connect(lp);
    lp.connect(out);
    src.start();
    return { stop: () => { try { src.stop(); } catch { /* already stopped */ } } };
  }

  // waves — brown noise under a slow swell (LFO modulating gain).
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, "brown");
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 550;
  const swell = ctx.createGain();
  swell.gain.value = 0.55;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.1; // ~10s per wave
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.4;
  lfo.connect(lfoGain);
  lfoGain.connect(swell.gain);
  src.connect(lp);
  lp.connect(swell);
  swell.connect(out);
  src.start();
  lfo.start();
  return {
    stop: () => {
      try { src.stop(); } catch { /* already stopped */ }
      try { lfo.stop(); } catch { /* already stopped */ }
    },
  };
}

/* ---------- Hook ---------- */

export interface FocusAudio {
  stations: Station[];
  vibes: Vibe[];
  current: Station | null;
  currentVibe: Vibe | null;
  vibeId: string | null;
  stationId: string | null;
  customUrl: string;
  volume: number;
  autoWithTimer: boolean;
  isPlaying: boolean;
  loading: boolean;
  error: string | null;
  selectVibe: (id: string) => void;
  selectStation: (id: string) => void;
  skip: (dir: 1 | -1) => void;
  setCustomUrl: (url: string) => void;
  applyCustom: () => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setVolume: (v: number) => void;
  setAutoWithTimer: (on: boolean) => void;
}

export function useFocusAudio(): FocusAudio {
  const initial = useRef(loadPersisted());
  const [vibeId, setVibeId] = useState<string | null>(initial.current.vibeId);
  const [stationId, setStationId] = useState<string | null>(initial.current.stationId);
  const [customUrl, setCustomUrlState] = useState(initial.current.customUrl);
  const [volume, setVolumeState] = useState(initial.current.volume);
  const [autoWithTimer, setAutoWithTimer] = useState(initial.current.autoWithTimer);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const ambientRef = useRef<AmbientNodes | null>(null);
  const ambientGainRef = useRef<GainNode | null>(null);

  // Refs mirror state so imperative play/skip closures never go stale.
  const vibeIdRef = useRef(vibeId);
  vibeIdRef.current = vibeId;
  const stationIdRef = useRef(stationId);
  stationIdRef.current = stationId;
  const customUrlRef = useRef(customUrl);
  customUrlRef.current = customUrl;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const current = resolveStation(stationId, customUrl);
  const currentVibe = getVibe(vibeId) ?? null;

  /* persist */
  useEffect(() => {
    try {
      localStorage.setItem(
        FOCUS_AUDIO_KEY,
        JSON.stringify({ vibeId, stationId, volume, autoWithTimer, customUrl }),
      );
    } catch {
      /* quota or disabled */
    }
  }, [vibeId, stationId, volume, autoWithTimer, customUrl]);

  const ensureAudioEl = useCallback(() => {
    if (!audioRef.current) {
      const el = new Audio();
      el.preload = "none";
      el.addEventListener("playing", () => { setIsPlaying(true); setLoading(false); setError(null); });
      el.addEventListener("waiting", () => setLoading(true));
      // Ignore the radio element's pause event while ambient audio is active —
      // switching radio→ambient pauses the element but ambient is still playing.
      el.addEventListener("pause", () => { if (ambientRef.current) return; setIsPlaying(false); });
      el.addEventListener("error", () => {
        setError("Stream unavailable — skip to the next station or try your own URL.");
        setIsPlaying(false);
        setLoading(false);
      });
      audioRef.current = el;
    }
    return audioRef.current;
  }, []);

  const ensureCtx = useCallback(() => {
    if (!ctxRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new Ctor();
    }
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const stopInternal = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    if (ambientRef.current) {
      ambientRef.current.stop();
      ambientRef.current = null;
    }
    ambientGainRef.current = null;
  }, []);

  // Stable imperative handlers via refs (state read fresh each call).
  const playRef = useRef<() => Promise<void>>(async () => {});
  playRef.current = async () => {
    const snd = resolveStation(stationIdRef.current, customUrlRef.current);
    if (!snd) return;
    stopInternal();
    setError(null);

    if (snd.kind === "ambient" && snd.ambient) {
      try {
        const ctx = ensureCtx();
        const gain = ctx.createGain();
        gain.gain.value = volumeRef.current;
        gain.connect(ctx.destination);
        ambientGainRef.current = gain;
        ambientRef.current = buildAmbient(ctx, snd.ambient, gain);
        setIsPlaying(true);
      } catch {
        setError("Couldn't start ambient audio in this browser.");
        setIsPlaying(false);
      }
      return;
    }

    if (snd.src) {
      const el = ensureAudioEl();
      if (el.src !== snd.src) el.src = snd.src;
      el.volume = volumeRef.current;
      setLoading(true);
      try {
        await el.play();
        setIsPlaying(true);
      } catch {
        setError("Tap play to start (the browser blocked autoplay).");
        setIsPlaying(false);
      } finally {
        setLoading(false);
      }
    }
  };

  const pauseRef = useRef<() => void>(() => {});
  pauseRef.current = () => {
    stopInternal();
    setIsPlaying(false);
  };

  const play = useCallback(() => { void playRef.current(); }, []);
  const pause = useCallback(() => { pauseRef.current(); }, []);
  const toggle = useCallback(() => {
    if (isPlayingRef.current) pauseRef.current();
    else void playRef.current();
  }, []);

  const selectStation = useCallback((id: string) => {
    stationIdRef.current = id;
    setStationId(id);
    // keep the vibe in sync with whatever vibe owns this station
    const v = vibeOfStation(id);
    if (v) { vibeIdRef.current = v.id; setVibeId(v.id); }
    void playRef.current();
  }, []);

  const selectVibe = useCallback((id: string) => {
    const vibe = getVibe(id);
    if (!vibe || vibe.stationIds.length === 0) return;
    vibeIdRef.current = id;
    setVibeId(id);
    // if the current station already belongs to this vibe, keep it; else start at first
    const cur = stationIdRef.current;
    const next = cur && vibe.stationIds.includes(cur) ? cur : vibe.stationIds[0];
    selectStation(next);
  }, [selectStation]);

  const skip = useCallback((dir: 1 | -1) => {
    const vibe = getVibe(vibeIdRef.current);
    if (!vibe || vibe.stationIds.length === 0) return;
    const ids = vibe.stationIds;
    const idx = ids.indexOf(stationIdRef.current ?? "");
    const start = idx < 0 ? 0 : idx;
    const next = ids[(start + dir + ids.length) % ids.length];
    selectStation(next);
  }, [selectStation]);

  const setCustomUrl = useCallback((url: string) => {
    customUrlRef.current = url;
    setCustomUrlState(url);
  }, []);

  const applyCustom = useCallback(() => {
    if (!customUrlRef.current.trim()) return;
    stationIdRef.current = CUSTOM_STATION_ID;
    setStationId(CUSTOM_STATION_ID);
    void playRef.current();
  }, []);

  const setVolume = useCallback((v: number) => {
    volumeRef.current = v;
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
    if (ambientGainRef.current) ambientGainRef.current.gain.value = v;
  }, []);

  /* cleanup on unmount */
  useEffect(() => {
    return () => {
      try { audioRef.current?.pause(); } catch { /* noop */ }
      try { ambientRef.current?.stop(); } catch { /* noop */ }
      try { void ctxRef.current?.close(); } catch { /* noop */ }
    };
  }, []);

  return {
    stations: STATIONS,
    vibes: VIBES,
    current,
    currentVibe,
    vibeId,
    stationId,
    customUrl,
    volume,
    autoWithTimer,
    isPlaying,
    loading,
    error,
    selectVibe,
    selectStation,
    skip,
    setCustomUrl,
    applyCustom,
    play,
    pause,
    toggle,
    setVolume,
    setAutoWithTimer,
  };
}
