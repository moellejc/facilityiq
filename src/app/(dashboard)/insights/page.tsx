import Link from "next/link";

import { DateRangeControls } from "@/components/dashboard/date-range-controls";
import { PageIntro } from "@/components/dashboard/coming-next";
import { GenerateInsights, InsightStatusForm } from "@/components/insights/insight-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { twinSelectionHref } from "@/lib/ai/match";
import { formatUtcDate } from "@/lib/format";
import { loadMetricCoverage } from "@/server/repositories/analytics";
import { analyticsPresets, resolveQueryRange } from "@/server/services/analytics-service";
import { requireRequestContext } from "@/server/services/context";
import { canRegenerateInsights, listInsightsForFacility } from "@/server/services/insight-service";

export const dynamic = "force-dynamic";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>;
}) {
  const context = await requireRequestContext();
  const params = await searchParams;
  if (!context.facilityId) {
    return <p className="text-sm text-slate-600">Choose a facility to review insights.</p>;
  }
  const freshness = await loadMetricCoverage(
    context.organizationId,
    context.userId,
    context.facilityId,
  );
  const range = resolveQueryRange(params, freshness);
  const insights = await listInsightsForFacility({
    organizationId: context.organizationId,
    userId: context.userId,
    facilityId: context.facilityId,
    role: context.role,
  });
  const statusFilter = params.status;
  const visible = insights.filter((insight) => {
    const inPeriod =
      !insight.periodFrom ||
      !insight.periodTo ||
      (insight.periodFrom >= range.from && insight.periodTo <= range.to) ||
      (insight.periodFrom <= range.to && insight.periodTo >= range.from);
    return inPeriod && (!statusFilter || insight.status === statusFilter);
  });
  const canWrite = canRegenerateInsights(context.role);
  const generatedForRange = insights.some(
    (insight) => insight.periodFrom === range.from && insight.periodTo === range.to,
  );

  return (
    <div>
      <PageIntro
        title="AI insights"
        description="Rules read the selected period and explain the same metrics as the dashboard. Dollar figures are estimates when a baseline can be calculated. No model is required."
      />
      <DateRangeControls
        pathname="/insights"
        from={range.from}
        to={range.to}
        freshness={freshness}
        presets={analyticsPresets(freshness)}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <GenerateInsights
          from={range.from}
          to={range.to}
          canWrite={canWrite}
          auto={!generatedForRange}
        />
        <p className="text-xs text-slate-500">
          {process.env.AI_API_KEY
            ? "A language model may rephrase the rule text. It does not calculate money."
            : "No AI API key is configured. Insights come from deterministic rules only."}
        </p>
      </div>
      <div className="mb-4 flex gap-2 text-sm">
        {["", "open", "acknowledged", "dismissed"].map((status) => (
          <Link
            key={status || "all"}
            href={statusQuery("/insights", range, status)}
            className="rounded-full border border-slate-200 px-3 py-1"
          >
            {status || "All"}
          </Link>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-slate-600">
          No insights are stored for this facility and period yet.
          {canWrite ? " Regeneration runs automatically for your role." : ""}
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((insight) => (
            <Card key={insight.id}>
              <CardHeader>
                <p className="text-[11px] tracking-wide text-slate-500 uppercase">
                  {insight.severity} · {insight.status} · {insight.insightType.replaceAll("_", " ")}
                </p>
                <CardTitle>{insight.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                <p>{insight.description}</p>
                <p>
                  <span className="font-medium text-slate-900">Recommended action. </span>
                  {insight.recommendedAction}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Financial impact. </span>
                  {insight.impactLabel === "estimate" && insight.estimatedFinancialImpact
                    ? `Estimate ${insight.estimatedFinancialImpact} ${insight.currency}. Not a verified saving.`
                    : "Not calculable from the stored metrics."}
                </p>
                <p>
                  Confidence {insight.confidence ?? "n/a"}
                  {insight.uncertainty ? ` · ${insight.uncertainty}` : ""}
                </p>
                <p>
                  {insight.areaName ? `Area ${insight.areaName}` : "No primary area"}
                  {insight.assetName ? ` · Asset ${insight.assetName}` : ""}
                  {insight.periodFrom ? ` · ${insight.periodFrom} to ${insight.periodTo}` : ""}
                  {insight.createdAt ? ` · Saved ${formatUtcDate(insight.createdAt)}` : ""}
                </p>
                {Array.isArray(insight.metrics) && insight.metrics.length > 0 ? (
                  <ul className="space-y-1 text-xs text-slate-600">
                    {insight.metrics.map((metric, index) => (
                      <li key={`${insight.id}-${index}`}>{formatMetric(metric)}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={twinSelectionHref(insight, range)}
                    className="font-medium text-indigo-700"
                  >
                    Show in the 3D twin
                  </Link>
                  {canWrite ? (
                    <InsightStatusForm insightId={insight.id} status={insight.status} />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function statusQuery(pathname: string, range: { from: string; to: string }, status: string) {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  if (status) params.set("status", status);
  return `${pathname}?${params.toString()}`;
}

function formatMetric(metric: unknown) {
  if (!metric || typeof metric !== "object") return "Stored metric reference";
  const row = metric as {
    observation?: unknown;
    value?: unknown;
    unit?: unknown;
    metricType?: unknown;
  };
  const observation =
    typeof row.observation === "string" ? row.observation : String(row.metricType ?? "Metric");
  const value = typeof row.value === "number" ? row.value : null;
  const unit = typeof row.unit === "string" ? row.unit : "";
  return value === null ? `${observation}: unavailable` : `${observation}: ${value} ${unit}`;
}
