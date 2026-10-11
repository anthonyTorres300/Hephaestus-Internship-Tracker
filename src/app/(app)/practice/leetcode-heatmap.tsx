import { buildHeatmap, monthTotals } from "@/lib/leetcode/view";

const LEVEL_BG = [
  "rgba(255,255,255,0.07)",
  "rgba(217,184,102,0.28)",
  "rgba(217,184,102,0.5)",
  "rgba(217,184,102,0.75)",
  "rgba(217,184,102,1)",
];
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
const monthShort = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export function ActivityHeatmap({ calendar }: { calendar: { date: string; count: number }[] }) {
  const heat = buildHeatmap(calendar, new Date());
  const months = monthTotals(calendar);
  // Month label sits above the first week column whose first in-range day starts a new month.
  const labels = heat.weeks.map((w, i) => {
    const first = w.find((c) => c.inRange);
    if (!first) return "";
    const prev = heat.weeks[i - 1]?.find((c) => c.inRange);
    return !prev || prev.date.slice(5, 7) !== first.date.slice(5, 7) ? monthShort(first.date) : "";
  });

  return (
    <figure className="grid gap-2">
      <figcaption className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{heat.total}</span> submissions in the last year ·{" "}
        <span className="tabular-nums">{heat.activeDays}</span> active days
      </figcaption>
      <div className="overflow-x-auto pb-1">
        <div
          role="img"
          aria-label={`Submission activity for the last year: ${heat.total} submissions on ${heat.activeDays} days`}
          className="grid min-w-[40rem] max-w-[60rem] gap-[3px]"
          style={{ gridTemplateColumns: `1.75rem repeat(${heat.weeks.length}, minmax(0, 1fr))` }}
        >
          <span />
          {labels.map((l, i) => (
            <span key={i} className="h-4 overflow-visible text-[10px] leading-4 whitespace-nowrap text-muted-foreground">
              {l}
            </span>
          ))}
          {DAY_LABELS.map((dl, row) => (
            <div key={row} className="contents">
              <span className="self-center pr-1 text-right text-[10px] leading-none text-muted-foreground">{dl}</span>
              {heat.weeks.map((w, col) => {
                const c = w[row];
                return (
                  <span
                    key={col}
                    title={c.inRange ? `${c.count} submission${c.count === 1 ? "" : "s"} · ${fmtDay(c.date)}` : undefined}
                    className="aspect-square w-full rounded-[2px]"
                    style={{ background: c.inRange ? LEVEL_BG[c.level] : "transparent" }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground" aria-hidden>
        Less
        {LEVEL_BG.map((bg) => (
          <span key={bg} className="size-[11px] rounded-[2px]" style={{ background: bg }} />
        ))}
        More
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">View monthly totals as a table</summary>
        <table className="mt-2 w-full max-w-xs text-left text-sm">
          <caption className="sr-only">Submissions per month</caption>
          <thead>
            <tr>
              <th scope="col" className="py-1 pr-4 font-medium">
                Month
              </th>
              <th scope="col" className="py-1 font-medium">
                Submissions
              </th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <th scope="row" className="py-0.5 pr-4 font-normal">
                  {m.month}
                </th>
                <td>{m.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
