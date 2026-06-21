import { describe, it, expect } from "vitest";
import { mergeArrays } from "@/hooks/useCloudStateSync";

describe("mergeArrays", () => {
  describe("no-id arrays (JSON dedup)", () => {
    it("deduplicates exact duplicates", () => {
      const result = mergeArrays(["x", "y"], ["y", "z"], false);
      expect(result).toEqual(["x", "y", "z"]);
    });

    it("preserves all unique strings", () => {
      expect(mergeArrays(["a"], ["b"], false)).toHaveLength(2);
    });

    it("handles empty inputs", () => {
      expect(mergeArrays([], ["a"], false)).toEqual(["a"]);
      expect(mergeArrays(["a"], [], false)).toEqual(["a"]);
    });
  });

  describe("id-keyed arrays", () => {
    it("b wins on id conflict when bWins=true", () => {
      const a = [{ id: "1", v: "a" }];
      const b = [{ id: "1", v: "B" }];
      const result = mergeArrays(a, b, true) as Array<{ id: string; v: string }>;
      expect(result.find((r) => r.id === "1")?.v).toBe("B");
    });

    it("a wins on id conflict when bWins=false", () => {
      const a = [{ id: "1", v: "a" }];
      const b = [{ id: "1", v: "B" }];
      const result = mergeArrays(a, b, false) as Array<{ id: string; v: string }>;
      expect(result.find((r) => r.id === "1")?.v).toBe("a");
    });

    it("includes unique entries from both sides regardless of bWins", () => {
      const a = [{ id: "1", v: 1 }];
      const b = [{ id: "2", v: 2 }, { id: "3", v: 3 }];
      expect(mergeArrays(a, b, true)).toHaveLength(3);
      expect(mergeArrays(a, b, false)).toHaveLength(3);
    });

    it("handles empty sides", () => {
      const a = [{ id: "1", v: 1 }];
      expect(mergeArrays(a, [], false)).toHaveLength(1);
      expect(mergeArrays([], a, false)).toHaveLength(1);
    });

    it("produces no duplicate ids", () => {
      const a = [{ id: "1" }, { id: "2" }];
      const b = [{ id: "1" }, { id: "3" }];
      const result = mergeArrays(a, b, true) as Array<{ id: string }>;
      const ids = result.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
