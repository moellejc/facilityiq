import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/dashboard/coming-next";
import { ASSET_TYPE_LABELS, formatCount, formatSquareFeet, formatUtcDate } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";
import { facilitySummary } from "@/server/repositories/facilities";
import { requireRequestContext } from "@/server/services/context";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const context = await requireRequestContext();
  const summary = context.facilityId
    ? await facilitySummary(context.organizationId, context.userId, context.facilityId)
    : null;

  return (
    <div>
      <PageIntro
        title={`Good to see you, ${context.name?.split(" ")[0] ?? "there"}`}
        description={`${context.organizationName} · ${ROLE_LABELS[context.role]}. Throughput, utilization, and cost KPIs are calculated in a later phase. Nothing on this page is a hardcoded performance number.`}
      />
      {!summary ? (
        <Card>
          <CardHeader>
            <CardTitle>No facility selected</CardTitle>
            <CardDescription>This organization does not have a facility yet.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{summary.facility.name}</CardTitle>
              <CardDescription>
                {summary.facility.location ?? "Location not recorded"} ·{" "}
                {summary.facility.facilityType.replaceAll("_", " ")} · {summary.facility.timezone}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Fact label="Floor area" value={formatSquareFeet(summary.facility.squareFootage)} />
              <Fact label="Operational areas" value={formatCount(summary.areaCount)} />
              <Fact label="Stored metric rows" value={formatCount(summary.metricRows)} />
              <Fact
                label="Metric coverage"
                value={
                  summary.metricStart && summary.metricEnd
                    ? `${formatUtcDate(summary.metricStart)} – ${formatUtcDate(summary.metricEnd)}`
                    : "No metrics stored"
                }
              />
              <Fact label="Open insights on file" value={formatCount(summary.openInsights)} />
              <Fact label="Saved scenarios" value={formatCount(summary.scenarios)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
              <CardDescription>
                Counts from the facility record, not performance scores.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {summary.assetCounts
                .slice()
                .sort((a, b) => a.assetType.localeCompare(b.assetType))
                .map((row) => (
                  <div key={row.assetType} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {ASSET_TYPE_LABELS[row.assetType] ?? row.assetType}
                    </span>
                    <span className="font-medium tabular-nums">{formatCount(row.count)}</span>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
