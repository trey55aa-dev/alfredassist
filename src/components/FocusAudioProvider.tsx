import { createContext, useContext, type ReactNode } from "react";
import { useFocusAudio, type FocusAudio } from "@/hooks/useFocusAudio";

// Holds the single focus-audio engine above the router so playback persists as
// the user navigates between pages (the engine lives here, not on the Focus page).
const FocusAudioCtx = createContext<FocusAudio | null>(null);

export function FocusAudioProvider({ children }: { children: ReactNode }) {
  const audio = useFocusAudio();
  return <FocusAudioCtx.Provider value={audio}>{children}</FocusAudioCtx.Provider>;
}

export function useFocusAudioContext(): FocusAudio {
  const ctx = useContext(FocusAudioCtx);
  if (!ctx) {
    throw new Error("useFocusAudioContext must be used within a FocusAudioProvider");
  }
  return ctx;
}
