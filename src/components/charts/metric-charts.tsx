"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { NamedValue, TimePoint } from "@/lib/analytics/aggregate";

export function TimeSeriesChart({
  points,
  label,
  unit,
}: {
  points: TimePoint[];
  label: string;
  unit: string;
}) {
  const plotted = points.filter((point) => point.value !== null);
  if (plotted.length === 0) return <EmptyChart />;
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
          <YAxis tick={{ fontSize: 11 }} width={56} />
          <Tooltip
            formatter={(value) =>
              typeof value === "number"
                ? [`${value.toFixed(1)} ${unit}`, label]
                : ["Unavailable", label]
            }
          />
          <Line
            type="monotone"
            dataKey="value"
            name={label}
            stroke="#4f46e5"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function NamedBarChart({
  rows,
  unit,
  color = "#4f46e5",
}: {
  rows: NamedValue[];
  unit: string;
  color?: string;
}) {
  if (rows.length === 0) return <EmptyChart />;
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            interval={0}
            angle={-30}
            height={70}
            textAnchor="end"
          />
          <YAxis tick={{ fontSize: 11 }} width={56} />
          <Tooltip
            formatter={(value) => [
              typeof value === "number" ? `${value.toFixed(1)} ${unit}` : "Unavailable",
              "",
            ]}
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-72 items-center justify-center text-sm text-slate-500">
      No samples in this range.
    </div>
  );
}
