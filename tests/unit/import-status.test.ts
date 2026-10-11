import { describe, expect, it } from "vitest";
import { collectStatusLabels, DEFAULT_STATUS_MAP, mapStatus } from "@/lib/import";

describe("status mapping", () => {
  it("maps defaults case-insensitively", () => {
    expect(mapStatus("  pending ", {}).status).toBe("applied");
    expect(mapStatus("SCREENING PROCESS", {}).status).toBe("screening");
    expect(mapStatus("Offer Received", {}).status).toBe("offer");
    expect(mapStatus("ghosted", {}).status).toBe("ghosted");
    expect(mapStatus("Not Proceeding", {})).toMatchObject({ status: "rejected", reason: "imported source label", needsMapping: false });
    expect(Object.keys(DEFAULT_STATUS_MAP)).toContain("not proceeding");
  });
  it("unknown label needs mapping; user map applies and overrides", () => {
    expect(mapStatus("On hold", {})).toEqual({ status: null, needsMapping: true });
    expect(mapStatus("on hold", { "On Hold": "withdrawn" }).status).toBe("withdrawn");
    expect(mapStatus("Not Proceeding", { "not proceeding": "withdrawn" })).toEqual({
      status: "withdrawn",
      reason: undefined,
      needsMapping: false,
    });
  });
  it("collects distinct labels with counts", () => {
    const labels = collectStatusLabels(
      {
        rows: [
          ["a", "Pending"],
          ["b", "pending"],
          ["", ""],
          ["c", "Weird"],
        ],
      },
      1,
    );
    expect(labels.map((l) => [l.label, l.count, l.needsMapping])).toEqual([
      ["Pending", 2, false],
      ["Weird", 1, true],
    ]);
  });
});
