import { describe, it, expect, beforeEach } from "vitest";
import { isLocalMode, enableLocalMode, disableLocalMode, LOCAL_MODE_KEY } from "@/lib/localMode";

const HABITS_CACHE_OWNER_KEY = "alfred.habits.cacheOwner";

describe("localMode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is off by default", () => {
    expect(isLocalMode()).toBe(false);
  });

  it("turns on and survives a reload (value lives in localStorage)", () => {
    enableLocalMode();
    expect(isLocalMode()).toBe(true);
    expect(localStorage.getItem(LOCAL_MODE_KEY)).toBe("true");
  });

  // The important one: a device that was previously signed in has its habits
  // cache stamped with that user id, and useCloudHabits only trusts an unowned
  // cache. Without releasing it, going offline renders an empty app — which
  // looks exactly like data loss.
  it("releases the habits cache owner so existing data stays visible", () => {
    localStorage.setItem(HABITS_CACHE_OWNER_KEY, "user-abc-123");
    enableLocalMode();
    expect(localStorage.getItem(HABITS_CACHE_OWNER_KEY)).toBeNull();
  });

  it("never destroys the cached data itself", () => {
    const habits = JSON.stringify([{ id: "h1", title: "Run", cadence: "daily", createdAt: 0 }]);
    localStorage.setItem("alfred.habits", habits);
    localStorage.setItem(HABITS_CACHE_OWNER_KEY, "user-abc-123");
    enableLocalMode();
    expect(localStorage.getItem("alfred.habits")).toBe(habits);
  });

  it("turns back off without touching the user's data", () => {
    localStorage.setItem("alfred.habits", "[]");
    enableLocalMode();
    disableLocalMode();
    expect(isLocalMode()).toBe(false);
    expect(localStorage.getItem("alfred.habits")).toBe("[]");
  });
});
