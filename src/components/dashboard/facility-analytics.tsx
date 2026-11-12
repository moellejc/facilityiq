import type { ReactNode } from "react";
import Link from "next/link";

import { ChartPanel } from "@/components/charts/chart-panel";
import { NamedBarChart, TimeSeriesChart } from "@/components/charts/metric-charts";
import { DateRangeControls } from "@/components/dashboard/date-range-controls";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatKpiValue } from "@/lib/analytics/display";
import {
  chartCsvFilename,
  namedValueChartTable,
  timeSeriesChartTable,
  type ChartTable,
} from "@/lib/charts/csv";
import {
  analyticsPresets,
  getFacilityAnalytics,
  type AnalyticsQuery,
} from "@/server/services/analytics-service";
import type { RequestContext } from "@/server/services/context";
import { twinSelectionHref } from "@/lib/ai/match";
import { listInsights } from "@/server/repositories/records";

export async function FacilityAnalytics({
  context,
  query,
  pathname,
  focus,
}: {
  context: RequestContext;
  query: AnalyticsQuery;
  pathname: string;
  focus:
    | "overview"
    | "throughput"
    | "utilization"
    | "bottlenecks"
    | "costs"
    | "cost-per-order"
    | "asset-costs";
}) {
  if (!context.facilityId) {
    return <p className="text-sm text-slate-600">Choose a facility to calculate metrics.</p>;
  }

  const analytics = await getFacilityAnalytics({
    organizationId: context.organizationId,
    userId: context.userId,
    facilityId: context.facilityId,
    role: context.role,
    query,
  });
  const insights =
    focus === "overview"
      ? await listInsights(context.organizationId, context.userId, context.facilityId)
      : null;
  const operations = analytics.operations;
  const finance = analytics.finance;
  const includeFinance = finance !== null;
  const csvRange = { from: analytics.range.from, to: analytics.range.to };

  return (
    <div>
      <DateRangeControls
        pathname={pathname}
        from={analytics.range.from}
        to={analytics.range.to}
        freshness={analytics.freshness}
        presets={analyticsPresets(analytics.freshness)}
      />
      <p className="mb-4 text-xs text-slate-500">
        Selected {analytics.range.from} to {analytics.range.to}. Previous period{" "}
        {analytics.previousRange.from} to {analytics.previousRange.to}. Values are calculated from
        stored rows. A missing sample stays unavailable.
      </p>

      {focus === "overview" || focus === "throughput" ? (
        operations ? (
          <section className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {focus === "overview" ? (
              <KpiCard
                title="Throughput"
                compared={operations.throughputPerDay}
                note={`Orders per hour: ${formatKpiValue(operations.throughputPerHour.current)}. Units: ${formatKpiValue(operations.unitsProcessed.current)}.`}
              />
            ) : (
              <>
                <KpiCard title="Orders per hour" compared={operations.throughputPerHour} />
                <KpiCard title="Orders per day" compared={operations.throughputPerDay} />
                <KpiCard title="Units processed" compared={operations.unitsProcessed} />
              </>
            )}
            {focus === "overview" ? (
              <>
                <KpiCard
                  title="Asset utilization"
                  compared={operations.assetUtilization}
                  note="Mean of stored asset utilization samples."
                />
                <KpiCard title="Average cycle time" compared={operations.cycleTime} />
                <KpiCard
                  title="Bottleneck count"
                  compared={operations.bottleneckCount}
                  note="Distinct assets or areas whose max severity is above 0.70."
                />
              </>
            ) : null}
          </section>
        ) : (
          <Denied label="Operational metrics are not available for this role." />
        )
      ) : null}

      {focus === "overview" && finance ? (
        <section className="mb-6 grid gap-3 md:grid-cols-2">
          <KpiCard
            title="Operating cost"
            compared={finance.operatingCost}
            note="Sum of stored cost rows, including asset maintenance."
          />
          <KpiCard title="Cost per order" compared={finance.costPerOrder} />
        </section>
      ) : null}

      {focus === "utilization" && operations ? (
        <section className="mb-6 grid gap-3 md:grid-cols-3">
          <KpiCard title="Asset utilization" compared={operations.assetUtilization} />
          <KpiCard title="Area utilization" compared={operations.areaUtilization} />
          <KpiCard
            title="Capacity utilization"
            compared={operations.capacityUtilization}
            note="Packing-station busy time divided by available time."
          />
        </section>
      ) : null}

      {focus === "bottlenecks" && operations ? (
        <section className="mb-6 grid gap-3 md:grid-cols-3">
          <KpiCard title="Bottleneck count" compared={operations.bottleneckCount} />
          <KpiCard
            title="Bottleneck severity"
            compared={operations.bottleneckSeverity}
            note="Mean of stored severity samples."
          />
          <KpiCard
            title="Facility downtime"
            compared={operations.downtime}
            note="Sum of facility downtime samples. Asset downtime is not added again."
          />
        </section>
      ) : null}

      {focus === "costs" && finance ? (
        <section className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <KpiCard title="Operating cost" compared={finance.operatingCost} />
          <KpiCard title="Labor" compared={finance.labor} />
          <KpiCard title="Maintenance" compared={finance.maintenance} />
          <KpiCard title="Energy" compared={finance.energy} />
          <KpiCard title="Equipment" compared={finance.equipment} />
          <KpiCard title="Overhead" compared={finance.overhead} />
        </section>
      ) : null}

      {focus === "cost-per-order" && finance ? (
        <section className="mb-6 grid gap-3 md:grid-cols-2">
          <KpiCard title="Cost per order" compared={finance.costPerOrder} />
          <KpiCard title="Operating cost" compared={finance.operatingCost} />
        </section>
      ) : null}

      {focus === "asset-costs" && finance ? (
        <section className="mb-6">
          <KpiCard
            title="Operating cost"
            compared={finance.operatingCost}
            note="Asset chart includes only assets that have stored cost rows."
          />
        </section>
      ) : null}

      {(focus === "costs" || focus === "cost-per-order" || focus === "asset-costs") && !finance ? (
        <Denied label="Cost metrics are not available for this role." />
      ) : null}
      {(focus === "utilization" || focus === "bottlenecks") && !operations ? (
        <Denied label="Operational metrics are not available for this role." />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {operations && (focus === "overview" || focus === "throughput") ? (
          <ChartCard
            title="Throughput over time"
            description="Facility orders per hour. Gaps are missing samples, not zero."
            filename={chartCsvFilename("Throughput over time", csvRange)}
            table={timeSeriesChartTable({
              points: operations.throughputSeries,
              label: "Orders per hour",
              unit: "orders/hour",
              sensitivity: "none",
              includeFinance,
            })}
          >
            <TimeSeriesChart
              points={operations.throughputSeries}
              label="Orders per hour"
              unit="orders/hour"
            />
          </ChartCard>
        ) : null}
        {finance && (focus === "overview" || focus === "costs" || focus === "cost-per-order") ? (
          <ChartCard
            title="Operating cost over time"
            description="Sum of stored cost rows each day."
            filename={chartCsvFilename("Operating cost over time", csvRange)}
            table={timeSeriesChartTable({
              points: finance.costSeries,
              label: "Operating cost",
              unit: "USD",
              sensitivity: "finance",
              includeFinance,
            })}
          >
            <TimeSeriesChart points={finance.costSeries} label="Operating cost" unit="USD" />
          </ChartCard>
        ) : null}
        {operations && (focus === "overview" || focus === "utilization") ? (
          <ChartCard
            title="Utilization by area"
            description="Mean of area utilization samples."
            filename={chartCsvFilename("Utilization by area", csvRange)}
            table={namedValueChartTable({
              rows: operations.utilizationByArea,
              label: "Utilization",
              unit: "%",
              sensitivity: "none",
              includeFinance,
            })}
          >
            <NamedBarChart rows={operations.utilizationByArea} unit="%" />
          </ChartCard>
        ) : null}
        {finance && (focus === "overview" || focus === "costs") ? (
          <ChartCard
            title="Cost by category"
            description="Categories with no stored rows are omitted. Unassigned rows are labeled Facility-wide on the area chart."
            filename={chartCsvFilename("Cost by category", csvRange)}
            table={namedValueChartTable({
              rows: finance.costByCategory,
              label: "Amount",
              unit: "USD",
              sensitivity: "finance",
              includeFinance,
            })}
          >
            <NamedBarChart rows={finance.costByCategory} unit="USD" color="#0f766e" />
          </ChartCard>
        ) : null}
        {operations &&
        (focus === "overview" || focus === "utilization" || focus === "bottlenecks") ? (
          <ChartCard
            title="Asset performance"
            description="Equipment with stored utilization. Racks and pallets stay on the heatmap."
            filename={chartCsvFilename("Asset performance", csvRange)}
            table={namedValueChartTable({
              rows: operations.assetPerformance,
              label: "Utilization",
              unit: "%",
              sensitivity: "none",
              includeFinance,
            })}
          >
            <NamedBarChart rows={operations.assetPerformance} unit="%" color="#b45309" />
          </ChartCard>
        ) : null}
        {finance && (focus === "overview" || focus === "asset-costs") ? (
          <ChartCard
            title="Cost by asset"
            description="Assets without a cost row are omitted."
            filename={chartCsvFilename("Cost by asset", csvRange)}
            table={namedValueChartTable({
              rows: finance.costByAsset,
              label: "Operating cost",
              unit: "USD",
              sensitivity: "finance",
              includeFinance,
            })}
          >
            <NamedBarChart rows={finance.costByAsset} unit="USD" color="#7c3aed" />
          </ChartCard>
        ) : null}
      </div>

      {insights ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Stored insights</CardTitle>
            <CardDescription>
              {insights.total} stored insight rows for this facility. Open the list to regenerate
              them from the selected period. Dollar figures are estimates when the rule can
              calculate one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {insights.data.slice(0, 5).map((insight) => (
              <p key={insight.id}>
                <Link href={twinSelectionHref(insight)} className="font-medium text-slate-900">
                  {insight.title}
                </Link>
                <span className="text-slate-500"> · {insight.severity}</span>
              </p>
            ))}
            <Link href="/insights" className="inline-block text-sm font-medium text-indigo-700">
              Insight list
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ChartCard({
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
  return (
    <Card>
      <ChartPanel title={title} description={description} filename={filename} table={table}>
        {children}
      </ChartPanel>
    </Card>
  );
}

function Denied({ label }: { label: string }) {
  return <p className="mb-4 text-sm text-slate-600">{label}</p>;
}
