import { describe, expect, it } from "vitest";
import { OTHER_COLOR, PIE_COLORS, topWithOther } from "@/lib/ui/chart-colors";

describe("topWithOther", () => {
  it("keeps the largest slices in palette order and folds the rest into Other", () => {
    const out = topWithOther(
      [
        { name: "a", value: 1 },
        { name: "b", value: 50 },
        { name: "c", value: 20 },
        { name: "d", value: 10 },
        { name: "e", value: 5 },
        { name: "f", value: 3 },
        { name: "g", value: 2 },
      ],
      5,
    );
    expect(out.map((s) => s.name)).toEqual(["b", "c", "d", "e", "f", "Other"]);
    expect(out.at(-1)).toMatchObject({ value: 3, color: OTHER_COLOR });
    expect(out.slice(0, 5).map((s) => s.color)).toEqual([...PIE_COLORS]);
  });

  it("drops zero values and adds no Other slice when nothing is left over", () => {
    const out = topWithOther([
      { name: "x", value: 0 },
      { name: "y", value: 4 },
    ]);
    expect(out).toEqual([{ name: "y", value: 4, color: PIE_COLORS[0] }]);
    expect(topWithOther([])).toEqual([]);
  });
});
