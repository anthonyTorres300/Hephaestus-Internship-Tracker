"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from "recharts";

export interface BarDatum {
  label: string;
  value: number;
}

// Single-series bar chart: one hue, thin 4px-rounded data ends, recessive grid, direct value labels, hover tooltip.
// A table equivalent is always available for screen readers and print.
export function BarSeriesChart({
  data,
  title,
  valueLabel,
  height = 220,
}: {
  data: BarDatum[];
  title: string;
  valueLabel: string;
  height?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <figure className="grid gap-2" aria-label={title}>
      <div style={{ height }} role="img" aria-label={`${title}. ${data.map((d) => `${d.label}: ${d.value}`).join(", ")}`}>
        {total === 0 ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">No data in this range yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--viz-axis)", fontSize: 13 }}
                interval="preserveStartEnd"
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--viz-axis)", fontSize: 13 }} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.06)" }}
                formatter={(v) => [String(v), valueLabel]}
                contentStyle={{
                  borderRadius: 12,
                  fontSize: 12,
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  color: "var(--popover-foreground)",
                }}
                itemStyle={{ color: "var(--popover-foreground)" }}
              />
              <Bar dataKey="value" name={valueLabel} fill="var(--viz-1)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                {data.length <= 8 ? (
                  <LabelList
                    dataKey="value"
                    position="top"
                    style={{ fill: "var(--viz-axis)", fontSize: 13 }}
                    formatter={(v: unknown) => (Number(v) ? String(v) : "")}
                  />
                ) : null}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">View as table</summary>
        <table className="mt-2 w-full max-w-sm text-left text-sm">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col" className="py-1 pr-4 font-medium">
                Category
              </th>
              <th scope="col" className="py-1 font-medium">
                {valueLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <th scope="row" className="py-0.5 pr-4 font-normal">
                  {d.label}
                </th>
                <td>{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
