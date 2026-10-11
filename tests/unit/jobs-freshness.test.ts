import { describe, expect, it } from "vitest";
import { isStale } from "@/lib/jobs/freshness";

describe("isStale", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  it("is stale when never refreshed", () => {
    expect(isStale(null, 6, now)).toBe(true);
    expect(isStale(undefined, 6, now)).toBe(true);
  });
  it("is stale only after the threshold", () => {
    expect(isStale("2026-10-11T06:30:00Z", 6, now)).toBe(false);
    expect(isStale("2026-10-11T05:59:00Z", 6, now)).toBe(true);
    expect(isStale("2026-10-10T12:00:00Z", 48, now)).toBe(false);
  });
});
