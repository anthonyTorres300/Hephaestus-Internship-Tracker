"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const TOOLTIP = {
  borderRadius: 8,
  fontSize: 12,
  background: "var(--popover)",
  border: "1px solid var(--border)",
  color: "var(--popover-foreground)",
} as const;

const monthYear = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(iso));

export function ContestLine({ data }: { data: { title: string; rating: number; at: string }[] }) {
  return (
    <figure className="grid gap-2" aria-label="Contest rating over time">
      <div
        className="h-48"
        role="img"
        aria-label={`Contest rating from ${data[0].rating} to ${data.at(-1)!.rating} over ${data.length} contests`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis
              dataKey="at"
              tickFormatter={monthYear}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--viz-axis)", fontSize: 12 }}
              minTickGap={32}
            />
            <YAxis
              domain={["dataMin - 50", "dataMax + 50"]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--viz-axis)", fontSize: 12 }}
              width={44}
            />
            <Tooltip
              contentStyle={TOOLTIP}
              itemStyle={{ color: "var(--popover-foreground)" }}
              labelFormatter={(_, p) => p?.[0]?.payload?.title ?? ""}
              formatter={(v) => [String(v), "Rating"]}
            />
            <Line
              type="monotone"
              dataKey="rating"
              stroke="var(--viz-1)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--viz-1)", stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">View as table</summary>
        <table className="mt-2 w-full max-w-md text-left text-sm">
          <caption className="sr-only">Contest rating history</caption>
          <thead>
            <tr>
              <th scope="col" className="py-1 pr-4 font-medium">
                Contest
              </th>
              <th scope="col" className="py-1 font-medium">
                Rating
              </th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((d) => (
              <tr key={d.title + d.at}>
                <th scope="row" className="py-0.5 pr-4 font-normal">
                  {d.title}
                </th>
                <td>{d.rating}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
