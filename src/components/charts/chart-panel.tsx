"use client";

import { useId, useState, type ReactNode } from "react";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { chartTableToCsv, type ChartTable } from "@/lib/charts/csv";

export function ChartPanel({
  title,
  description,
  filename,
  table,
  children,
}: {
  title: string;
  description: string;
  filename: string;
  table: ChartTable;
  children: ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [exportError, setExportError] = useState<string | null>(null);
  const panelId = useId();

  function exportCsv() {
    try {
      downloadCsvFile(filename, chartTableToCsv(table));
      setExportError(null);
    } catch {
      setExportError("The CSV could not be downloaded. Try again.");
    }
  }

  return (
    <>
      <CardHeader className="gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div role="group" aria-label={`${title} view`} className="inline-flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={view === "chart" ? "secondary" : "outline"}
              aria-pressed={view === "chart"}
              aria-controls={panelId}
              aria-label={`Show ${title} as a chart`}
              onClick={() => setView("chart")}
            >
              Chart
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "table" ? "secondary" : "outline"}
              aria-pressed={view === "table"}
              aria-controls={panelId}
              aria-label={`Show ${title} as a table`}
              onClick={() => setView("table")}
            >
              Table
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`Export ${title} as CSV`}
            onClick={exportCsv}
          >
            <DownloadIcon aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {exportError ? (
          <p
            className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
            role="alert"
          >
            {exportError}
          </p>
        ) : null}
        <div id={panelId} role="region" aria-label={`${title} ${view}`}>
          {view === "chart" ? children : <ChartDataTable title={title} table={table} />}
        </div>
      </CardContent>
    </>
  );
}

function ChartDataTable({ title, table }: { title: string; table: ChartTable }) {
  const columnCount = Math.max(table.columns.length, 1);
  return (
    <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{title} table</caption>
        {table.columns.length > 0 ? (
          <thead className="sticky top-0 z-10 bg-card">
            <tr>
              {table.columns.map((column, index) => (
                <th
                  key={column.header}
                  scope="col"
                  className={
                    index === 0
                      ? "border-b border-slate-200 px-3 py-2 font-medium text-slate-700"
                      : "border-b border-slate-200 px-3 py-2 text-right font-medium text-slate-700"
                  }
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {table.rows.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="px-3 py-8 text-center text-sm text-slate-500">
                No samples in this range.
              </td>
            </tr>
          ) : (
            table.rows.map((row, rowIndex) => (
              <tr
                key={`${row[0]?.raw ?? "row"}-${rowIndex}`}
                className="border-b border-slate-100 last:border-b-0"
              >
                {table.columns.map((column, cellIndex) => {
                  const cell = row[cellIndex];
                  const text = cell?.display ?? "Unavailable";
                  if (cellIndex === 0) {
                    return (
                      <th
                        key={column.header}
                        scope="row"
                        className="px-3 py-1.5 font-medium text-slate-800"
                      >
                        {text}
                      </th>
                    );
                  }
                  return (
                    <td
                      key={column.header}
                      className="px-3 py-1.5 text-right text-slate-800 tabular-nums"
                    >
                      {text}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function downloadCsvFile(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
