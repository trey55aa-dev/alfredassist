// The bug this guards: Alfred reconciled with the cloud exactly once, at
// login. A value written on another device never reached an already-open tab,
// which kept showing stale data while reporting itself synced.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const { pullUserState, upsertUserState } = vi.hoisted(() => ({
  pullUserState: vi.fn(),
  upsertUserState: vi.fn(async () => {}),
}));

vi.mock("@/lib/userStateRepo", () => ({ pullUserState, upsertUserState }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

// The realtime channel needs a live socket; the DOM triggers alone prove the
// re-pull path, so keep the channel a no-op here.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => {},
  },
}));

import { useCloudStateSync } from "@/hooks/useCloudStateSync";

const KEY = "alfred.scene";

beforeEach(() => {
  localStorage.clear();
  pullUserState.mockReset();
  upsertUserState.mockClear();
  pullUserState.mockResolvedValue([]);
});

afterEach(() => vi.useRealTimers());

describe("re-pulling cloud state without a fresh login", () => {
  it("pulls once on mount", async () => {
    renderHook(() => useCloudStateSync());
    await waitFor(() => expect(pullUserState).toHaveBeenCalledTimes(1));
  });

  it("pulls again when the window regains focus", async () => {
    renderHook(() => useCloudStateSync());
    await waitFor(() => expect(pullUserState).toHaveBeenCalledTimes(1));

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await new Promise((r) => setTimeout(r, 400)); // coalescing window
    });

    await waitFor(() => expect(pullUserState).toHaveBeenCalledTimes(2));
  });

  it("adopts a value another device wrote while this tab stayed open", async () => {
    // This tab knows nothing about the key yet.
    renderHook(() => useCloudStateSync());
    await waitFor(() => expect(pullUserState).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem(KEY)).toBeNull();

    // The other device writes; the cloud now has a value.
    pullUserState.mockResolvedValue([
      { key: KEY, value: "midnight", updatedAt: Date.now() },
    ]);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await new Promise((r) => setTimeout(r, 400));
    });

    await waitFor(() => expect(localStorage.getItem(KEY)).toBe(JSON.stringify("midnight")));
  });

  it("union-merges an array rather than letting one device's copy win", async () => {
    // Opened here on the 14th...
    localStorage.setItem("alfred.loginStreak", JSON.stringify(["2026-09-14"]));
    localStorage.setItem("alfred.loginStreak::syncedAt", String(Date.now() - 10_000));

    renderHook(() => useCloudStateSync());
    await waitFor(() => expect(pullUserState).toHaveBeenCalledTimes(1));

    // ...and on the phone on the 15th.
    pullUserState.mockResolvedValue([
      { key: "alfred.loginStreak", value: ["2026-09-15"], updatedAt: Date.now() },
    ]);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await new Promise((r) => setTimeout(r, 400));
    });

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem("alfred.loginStreak") || "[]");
      expect([...stored].sort()).toEqual(["2026-09-14", "2026-09-15"]);
    });
  });
});
