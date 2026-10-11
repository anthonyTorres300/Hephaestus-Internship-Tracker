export interface HeatCell {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  inRange: boolean;
}

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

// Weeks (columns, Sunday-first) covering the 52 weeks up to and including `end` (UTC days). Levels scale with the busiest day.
export function buildHeatmap(
  calendar: { date: string; count: number }[],
  end: Date,
  weeks = 53,
): { weeks: HeatCell[][]; total: number; activeDays: number; max: number } {
  const counts = new Map(calendar.map((c) => [c.date, c.count]));
  const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const start = new Date(endDay.getTime() - (weeks * 7 - 1) * DAY);
  const firstSunday = new Date(start.getTime() - start.getUTCDay() * DAY);
  const inWindow = calendar.filter((c) => c.date >= iso(start) && c.date <= iso(endDay)).map((c) => c.count);
  const max = Math.max(0, ...inWindow);
  let total = 0;
  let activeDays = 0;
  const grid: HeatCell[][] = [];
  for (let w = 0; w < weeks + 1; w++) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(firstSunday.getTime() + (w * 7 + d) * DAY);
      const date = iso(day);
      const inRange = day >= start && day <= endDay;
      const count = inRange ? (counts.get(date) ?? 0) : 0;
      if (inRange && count > 0) {
        total += count;
        activeDays += 1;
      }
      const level = count === 0 || max === 0 ? 0 : (Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as 1 | 2 | 3 | 4);
      col.push({ date, count, level: level as HeatCell["level"], inRange });
    }
    grid.push(col);
  }
  return { weeks: grid, total, activeDays, max };
}

export function monthTotals(calendar: { date: string; count: number }[]): { month: string; count: number }[] {
  const by = new Map<string, number>();
  for (const c of calendar) by.set(c.date.slice(0, 7), (by.get(c.date.slice(0, 7)) ?? 0) + c.count);
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
}

// Dark-surface categorical steps validated with the dataviz palette checker; labels are always shown beside them.
export const DIFFICULTY_COLORS = { easy: "#199e70", medium: "#3987e5", hard: "#d95926" } as const;
