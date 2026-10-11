import { describe, expect, it } from "vitest";
import { buildHeatmap, monthTotals } from "@/lib/leetcode/view";

describe("LeetCode activity heatmap", () => {
  const end = new Date("2026-10-11T15:00:00Z"); // a Sunday

  it("builds Sunday-first week columns ending at the given day", () => {
    const h = buildHeatmap([], end);
    expect(h.weeks.length).toBe(54);
    expect(h.weeks.every((w) => w.length === 7)).toBe(true);
    expect(h.weeks[0][0].date < h.weeks.at(-1)![0].date).toBe(true);
    expect(h.total).toBe(0);
    expect(h.weeks.flat().every((c) => c.level === 0)).toBe(true);
    const inRange = h.weeks.flat().filter((c) => c.inRange);
    expect(inRange.length).toBe(53 * 7);
    expect(inRange.at(-1)!.date).toBe("2026-10-11");
  });

  it("scales levels against the busiest day and ignores dates outside the window", () => {
    const h = buildHeatmap(
      [
        { date: "2026-10-10", count: 8 },
        { date: "2026-10-09", count: 4 },
        { date: "2026-10-08", count: 1 },
        { date: "2020-01-01", count: 99 },
      ],
      end,
    );
    const by = new Map(h.weeks.flat().map((c) => [c.date, c]));
    expect(by.get("2026-10-10")!.level).toBe(4);
    expect(by.get("2026-10-09")!.level).toBe(2);
    expect(by.get("2026-10-08")!.level).toBe(1);
    expect(h.total).toBe(13);
    expect(h.activeDays).toBe(3);
  });

  it("totals by month", () => {
    expect(
      monthTotals([
        { date: "2026-09-30", count: 2 },
        { date: "2026-10-01", count: 3 },
        { date: "2026-10-05", count: 4 },
      ]),
    ).toEqual([
      { month: "2026-09", count: 2 },
      { month: "2026-10", count: 7 },
    ]);
  });
});
