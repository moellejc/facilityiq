import type { NamedValue, TimePoint } from "@/lib/analytics/aggregate";
import { formatMeasure, unitSuffix } from "@/lib/analytics/display";

/**
 * One observed series for a single chart.
 * A projected series must be a separate column on its own table or an added
 * column with its own header. This module never copies an observed value into
 * a projected field, or the reverse.
 *
 * `sensitivity: "finance"` columns are removed unless `includeFinance` is true.
 * That flag is presentation only. The analytics service still decides whether
 * the finance DTO exists (`finance:read`).
 */
export type ColumnSensitivity = "none" | "finance";

export type ChartTableCell = {
  /** CSV field. Null is an empty field, never the string "0". */
  raw: string | null;
  /** Table text. Missing measures say "Unavailable". */
  display: string;
};

export type ChartTableColumn = {
  header: string;
  sensitivity: ColumnSensitivity;
};

export type ChartTable = {
  columns: ChartTableColumn[];
  rows: ChartTableCell[][];
};

const UTF8_BOM = "\uFEFF";
const UNAVAILABLE = "Unavailable";
const OBSERVED = "Observed";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

const MISSING_CELL: ChartTableCell = { raw: null, display: UNAVAILABLE };

export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

/** Prefix spreadsheet formulas. Numeric fields must not pass through here. */
export function csvText(value: string): string {
  const cleaned = value.replaceAll("\0", "");
  return FORMULA_PREFIX.test(cleaned) ? `'${cleaned}` : cleaned;
}

export function csvNumber(value: number): string {
  if (Object.is(value, -0)) return "0";
  return String(value);
}

export function toCsv(headers: string[], rows: Array<Array<string | null>>): string {
  const lines = [
    headers.map((header) => escapeCsvField(header)).join(","),
    ...rows.map((row) =>
      headers
        .map((_, index) => {
          const value = row[index];
          return value === null || value === undefined ? "" : escapeCsvField(value);
        })
        .join(","),
    ),
  ];
  return `${UTF8_BOM}${lines.join("\r\n")}\r\n`;
}

export function chartTableToCsv(table: ChartTable): string {
  return toCsv(
    table.columns.map((column) => column.header),
    table.rows.map((row) => row.map((cell) => cell?.raw ?? null)),
  );
}

export function projectChartTable(
  table: ChartTable,
  access: { includeFinance: boolean },
): ChartTable {
  const indexes = table.columns.flatMap((column, index) =>
    column.sensitivity === "finance" && !access.includeFinance ? [] : [index],
  );
  const columns = indexes.flatMap((index) => {
    const column = table.columns[index];
    return column ? [column] : [];
  });
  return {
    columns,
    rows: table.rows.map((row) => indexes.map((index) => row[index] ?? MISSING_CELL)),
  };
}

export function chartCsvFilename(title: string, range?: { from: string; to: string }): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const base = slug.length > 0 ? slug : "chart";
  const from = range && DAY.test(range.from) ? range.from : null;
  const to = range && DAY.test(range.to) ? range.to : null;
  const span = from && to ? `-${from}-to-${to}` : "";
  return `${base}${span}.csv`;
}

export function measureColumnHeader(label: string, unit: string): string {
  if (unit === "USD") return `${label} (USD)`;
  if (unit === "percent" || unit === "%") return `${label} (%)`;
  return label;
}

export function timeSeriesChartTable(input: {
  points: TimePoint[];
  label: string;
  unit: string;
  sensitivity: ColumnSensitivity;
  includeFinance: boolean;
}): ChartTable {
  const valueHeader = measureColumnHeader(input.label, input.unit);
  return projectChartTable(
    {
      columns: [
        { header: "Date", sensitivity: "none" },
        { header: valueHeader, sensitivity: input.sensitivity },
        { header: "Status", sensitivity: input.sensitivity },
      ],
      rows: input.points.map((point) => [
        textCell(point.date),
        measureCell(point.value, input.unit),
        statusCell(point.value),
      ]),
    },
    { includeFinance: input.includeFinance },
  );
}

export function namedValueChartTable(input: {
  rows: NamedValue[];
  label: string;
  unit: string;
  sensitivity: ColumnSensitivity;
  includeFinance: boolean;
}): ChartTable {
  const valueHeader = measureColumnHeader(input.label, input.unit);
  return projectChartTable(
    {
      columns: [
        { header: "Name", sensitivity: "none" },
        { header: valueHeader, sensitivity: input.sensitivity },
        { header: "Status", sensitivity: input.sensitivity },
      ],
      rows: input.rows.map((row) => [
        textCell(row.name),
        measureCell(row.value, row.unit || displayUnit(input.unit)),
        statusCell(row.value),
      ]),
    },
    { includeFinance: input.includeFinance },
  );
}

function textCell(value: string): ChartTableCell {
  const raw = csvText(value);
  return { raw, display: raw };
}

function measureCell(value: number | null, unit: string): ChartTableCell {
  if (value === null || !Number.isFinite(value)) return MISSING_CELL;
  return {
    raw: csvNumber(value),
    display: `${formatMeasure(value, unit)} ${unitSuffix(unit)}`.trim(),
  };
}

function statusCell(value: number | null): ChartTableCell {
  const label = value === null || !Number.isFinite(value) ? UNAVAILABLE : OBSERVED;
  return { raw: label, display: label };
}

function displayUnit(unit: string): string {
  if (unit === "%") return "percent";
  return unit;
}
