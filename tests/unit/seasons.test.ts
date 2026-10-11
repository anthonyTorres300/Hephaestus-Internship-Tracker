import { describe, expect, it } from "vitest";
import { normalizeSeasonName, parseSeasonKey, seasonKey } from "@/lib/data/seasons";
import { seasonLabel } from "@/lib/ui/format";

describe("custom seasons", () => {
  it("normalizes names to one canonical lowercase form", () => {
    expect(normalizeSeasonName("  Co-op   Term ")).toBe("co-op term");
    expect(normalizeSeasonName("Summer")).toBe("summer");
  });
  it("rejects empty, over-long and control-character names", () => {
    expect(normalizeSeasonName("   ")).toBeNull();
    expect(normalizeSeasonName("x".repeat(31))).toBeNull();
    expect(normalizeSeasonName("a\u0007b")).toBeNull();
    expect(normalizeSeasonName("x".repeat(30))).toBe("x".repeat(30));
  });
  it("round-trips keys, including names that contain a colon", () => {
    expect(parseSeasonKey(seasonKey("summer", 2026))).toEqual({ name: "summer", year: 2026 });
    expect(parseSeasonKey(seasonKey("phase: two", 2027))).toEqual({ name: "phase: two", year: 2027 });
    expect(parseSeasonKey("unclassified")).toBeNull();
    expect(parseSeasonKey("2027")).toBeNull();
  });
  it("labels capitalize only the first letter", () => {
    expect(seasonLabel("co-op", 2026)).toBe("Co-op 2026");
    expect(seasonLabel("summer", 2027)).toBe("Summer 2027");
  });
});
