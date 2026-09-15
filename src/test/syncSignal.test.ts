import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { onRemoteChange, notifyRemoteChange } from "@/lib/syncSignal";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Let the coalescing window elapse. */
const settle = () => vi.advanceTimersByTime(400);

describe("onRemoteChange", () => {
  it("notifies a listener when something changed elsewhere", () => {
    const seen = vi.fn();
    const stop = onRemoteChange(seen);

    notifyRemoteChange();
    expect(seen).not.toHaveBeenCalled(); // coalescing window still open
    settle();
    expect(seen).toHaveBeenCalledTimes(1);

    stop();
  });

  it("coalesces a burst into a single pull", () => {
    // A bulk upsert lands as many row events; re-pulling once covers them all.
    const seen = vi.fn();
    const stop = onRemoteChange(seen);

    for (let i = 0; i < 25; i++) notifyRemoteChange();
    settle();

    expect(seen).toHaveBeenCalledTimes(1);
    stop();
  });

  it("fires again for a change after the window closed", () => {
    const seen = vi.fn();
    const stop = onRemoteChange(seen);

    notifyRemoteChange();
    settle();
    notifyRemoteChange();
    settle();

    expect(seen).toHaveBeenCalledTimes(2);
    stop();
  });

  it("stops notifying once unsubscribed", () => {
    const seen = vi.fn();
    onRemoteChange(seen)();

    notifyRemoteChange();
    settle();

    expect(seen).not.toHaveBeenCalled();
  });

  it("notifies every listener, and one throwing doesn't starve the rest", () => {
    const first = vi.fn(() => { throw new Error("boom"); });
    const second = vi.fn();
    const stopA = onRemoteChange(first);
    const stopB = onRemoteChange(second);

    notifyRemoteChange();
    settle();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    stopA();
    stopB();
  });
});

describe("browser triggers", () => {
  it("re-pulls when the window regains focus", () => {
    const seen = vi.fn();
    const stop = onRemoteChange(seen);

    window.dispatchEvent(new Event("focus"));
    settle();

    expect(seen).toHaveBeenCalledTimes(1);
    stop();
  });

  it("re-pulls when the device comes back online", () => {
    const seen = vi.fn();
    const stop = onRemoteChange(seen);

    window.dispatchEvent(new Event("online"));
    settle();

    expect(seen).toHaveBeenCalledTimes(1);
    stop();
  });

  it("re-pulls when the tab becomes visible, but not when it is hidden", () => {
    const seen = vi.fn();
    const stop = onRemoteChange(seen);
    const setVisibility = (state: DocumentVisibilityState) =>
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => state,
      });

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    settle();
    expect(seen).not.toHaveBeenCalled();

    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    settle();
    expect(seen).toHaveBeenCalledTimes(1);

    stop();
  });

  it("detaches browser listeners once nobody is listening", () => {
    const seen = vi.fn();
    onRemoteChange(seen)();

    window.dispatchEvent(new Event("focus"));
    settle();

    expect(seen).not.toHaveBeenCalled();
  });
});
