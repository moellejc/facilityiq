import Link from "next/link";

import { Button } from "@/components/ui/button";

export function DateRangeControls({
  pathname,
  from,
  to,
  freshness,
  presets,
}: {
  pathname: string;
  from: string;
  to: string;
  freshness: string | null;
  presets: Array<{ label: string; from: string; to: string }>;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-end lg:justify-between">
      <form className="flex flex-wrap items-end gap-2" method="get">
        <label className="text-xs text-slate-600">
          From
          <input
            className="mt-1 block h-8 rounded-lg border border-slate-200 px-2 text-sm"
            type="date"
            name="from"
            defaultValue={from}
            required
          />
        </label>
        <label className="text-xs text-slate-600">
          To
          <input
            className="mt-1 block h-8 rounded-lg border border-slate-200 px-2 text-sm"
            type="date"
            name="to"
            defaultValue={to}
            required
          />
        </label>
        <Button type="submit" size="sm">
          Apply
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {presets.map((preset) => (
          <Link
            key={preset.label}
            href={`${pathname}?from=${preset.from}&to=${preset.to}`}
            className="rounded-full border border-slate-200 px-3 py-1 text-slate-700 hover:border-indigo-300"
          >
            {preset.label}
          </Link>
        ))}
        <span className="text-xs text-slate-500">
          {freshness ? `Latest stored sample ${freshness}` : "No stored samples"}
        </span>
      </div>
    </div>
  );
}
