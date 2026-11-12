---
name: facilityiq-charts-dataviz
description: FacilityIQ chart and data-visualization standards with Recharts — client chart adapters, units and legends, gaps for missing data, empty states, observed vs projected series, and KPI card presentation. Use when adding or editing charts in src/components/charts, KPI cards, or any visualization of metrics, costs, or scenario results.
---

# Charts and Data Visualization (FacilityIQ)

Source: Notion Coding Conventions §9, §11, §15. Patterns from `src/components/charts/metric-charts.tsx` and `src/components/dashboard/kpi-card.tsx`.

## Rules

- Recharts only. Chart components are Client Components (`"use client"`) in `src/components/charts`; keep the parent page server-rendered.
- Charts are **adapters**: they receive typed, already-computed series (`TimePoint`, `NamedValue` from `src/lib/analytics/aggregate`). No aggregation, KPI math, permission checks, or money calculations inside a chart.
- Always show units (axis label, tooltip, or legend) using `formatMeasure` / `unitSuffix` from `src/lib/analytics/display`.
- **Missing data stays missing.** `null` points are gaps, never plotted as `0`. If no points are plottable, render `EmptyChart`.
- **Projected/estimated series are visually distinct** from observed (dashed line, lighter fill, explicit legend label "Projected"/"Estimate"). Never merge them into one series.
- Cost/ROI charts render only when the DTO contains finance fields (server already gated by `finance:read`) — don't fetch and hide.
- Per-chart table view and CSV live in `ChartPanel` (`src/components/charts/chart-panel.tsx`), the client leaf for the toggle and download. The server page builds a `ChartTable` with `timeSeriesChartTable` / `namedValueChartTable` (`src/lib/charts/csv.ts`) from the series already on the page. Do not add an unauthenticated export route. Finance columns use `sensitivity: "finance"` and `includeFinance` from whether the service DTO includes `finance`. That flag is presentation. The service still enforces `finance:read`. One table is one observed series. A projected series is a separate column, never a copy of the observed value. Table cells use `formatMeasure`. CSV numbers stay unrounded. Null is an empty CSV field and "Unavailable" in the table, not `0`. Notion Coding Conventions do not describe this control yet.
- Wrap in a fixed-height container (`h-72` pattern) with `ResponsiveContainer`.
- en-US number formatting and USD; tooltips use the shared formatters.
- Don't add new chart palettes ad hoc; use existing tokens/colors and flag palette needs.

## KPI cards

- `KpiCard` takes a `ComparedKpi`; render value via `formatKpiValue`, comparison via `formatComparison`.
- When `value === null`, show `unavailableLabel(unavailableReason)` — never `0` or a blank.
- Values use `tabular-nums`.

## Heatmaps

3D heatmaps follow the same semantics (server-normalized values, legend, thresholds, distinct no-data color) — see `facilityiq-3d-digital-twin`.

## Tests

Unit-test any display helper you add (`src/lib/analytics/display.ts`) including null/unavailable inputs. CSV escaping, headers, null-versus-zero, and finance column filtering are covered in `tests/unit/chart-csv.test.ts`.
