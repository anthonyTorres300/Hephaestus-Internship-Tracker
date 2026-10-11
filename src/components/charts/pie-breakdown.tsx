"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export interface PieDatum {
  name: string;
  value: number;
  color: string;
  detail?: string;
}

// Compact donut with a labeled legend (name, count, share). The legend is the text equivalent of the chart.
export function PieBreakdown({
  title,
  data,
  size = 120,
  centerValue,
  centerLabel,
  empty = "No data yet",
}: {
  title: string;
  data: PieDatum[];
  size?: number;
  centerValue?: string | number;
  centerLabel?: string;
  empty?: string;
}) {
  const total = data.reduce((n, d) => n + d.value, 0);
  const slices = data.filter((d) => d.value > 0);
  return (
    <div className="flex items-center gap-4" role="group" aria-label={title}>
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
        role="img"
        aria-label={`${title}: ${slices.map((d) => `${d.name} ${d.value}`).join(", ") || empty}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total === 0 ? [{ name: "none", value: 1, color: "rgba(255,255,255,0.08)" }] : slices}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="96%"
              paddingAngle={slices.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {(total === 0 ? [{ color: "rgba(255,255,255,0.08)" }] : slices).map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            {total > 0 ? (
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  fontSize: 12,
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  color: "var(--popover-foreground)",
                }}
                itemStyle={{ color: "var(--popover-foreground)" }}
              />
            ) : null}
          </PieChart>
        </ResponsiveContainer>
        {centerValue !== undefined ? (
          <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
            <span
              className={size >= 120 ? "text-3xl leading-none font-light tabular-nums" : "text-xl leading-none font-light tabular-nums"}
            >
              {centerValue}
            </span>
            {centerLabel ? (
              <span
                className={
                  size >= 120
                    ? "mt-1 text-[10px] tracking-[0.1em] text-muted-foreground uppercase"
                    : "mt-0.5 text-[8px] tracking-normal text-muted-foreground uppercase"
                }
              >
                {centerLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid min-w-0 flex-1 gap-1 text-sm">
          {slices.map((d) => (
            <li key={d.name} className="grid grid-cols-[0.625rem_1fr_auto] items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-sm" style={{ background: d.color }} />
              <span className="truncate">{d.name}</span>
              <span className="tabular-nums">
                {d.value} <span className="text-muted-foreground">{d.detail ?? `· ${Math.round((d.value / total) * 100)}%`}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
