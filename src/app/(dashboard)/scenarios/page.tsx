import Link from "next/link";

import { PageIntro } from "@/components/dashboard/coming-next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatScenarioFigure, SCENARIO_KIND_LABELS } from "@/lib/scenarios/present";
import { scenarioConfigurationSchema } from "@/lib/scenarios/schema";
import { requireRequestContext } from "@/server/services/context";
import {
  canWriteScenarios,
  getScenarioDetail,
  listScenariosForFacility,
} from "@/server/services/scenario-service";

export const dynamic = "force-dynamic";

/**
 * Read-only list for the demo. Create / run / compare / delete are exposed on the
 * scenario APIs so another surface can own the full editor without blocking this phase.
 */
export default async function ScenariosPage() {
  const context = await requireRequestContext();
  if (!context.facilityId) {
    return <p className="text-sm text-slate-600">Choose a facility to review scenarios.</p>;
  }
  const scenarios = await listScenariosForFacility({
    organizationId: context.organizationId,
    userId: context.userId,
    facilityId: context.facilityId,
    role: context.role,
  });
  const canWrite = canWriteScenarios(context.role);
  const details = await Promise.all(
    scenarios.slice(0, 6).map(async (scenario) => {
      const detail = await getScenarioDetail({
        organizationId: context.organizationId,
        userId: context.userId,
        scenarioId: scenario.id,
        role: context.role,
      });
      return detail;
    }),
  );

  return (
    <div>
      <PageIntro
        title="Scenarios"
        description="Deterministic projections from stored metrics. Baseline figures are observed. Projected dollars are modeled estimates. The full editor UI is intentionally deferred; use the APIs to create, run, compare, duplicate, and delete."
      />
      <p className="mb-4 text-sm text-slate-600">
        {canWrite
          ? "Your role can mutate scenarios through the API."
          : "Your role is read-only on scenarios."}{" "}
        See <code className="text-xs">docs/SCENARIOS.md</code> and the README for curl examples.
      </p>
      {details.length === 0 ? (
        <p className="text-sm text-slate-600">No scenarios are stored for this facility.</p>
      ) : (
        <div className="space-y-3">
          {details.map(({ scenario, latest }) => {
            const runnable = scenarioConfigurationSchema.safeParse(scenario.configuration).success;
            return (
              <Card key={scenario.id}>
                <CardHeader>
                  <p className="text-[11px] tracking-wide text-slate-500 uppercase">
                    {scenario.status} · {SCENARIO_KIND_LABELS[scenario.kind] ?? scenario.kind}
                    {runnable ? "" : " · seeded config needs a re-save before run"}
                  </p>
                  <CardTitle>{scenario.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-700">
                  <p>{scenario.description ?? "No description."}</p>
                  {latest ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                          Observed baseline
                        </p>
                        <MetricLines block={latest.baseline} />
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-medium tracking-wide text-amber-800 uppercase">
                          Modeled projection
                        </p>
                        <MetricLines block={latest.projected} />
                        <p className="mt-2 text-xs text-amber-900">
                          Monthly savings {latest.estimatedMonthlySavings ?? "n/a"}{" "}
                          {latest.currency}. {latest.label}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500">No run result stored yet.</p>
                  )}
                  <p className="text-xs text-slate-500">
                    API: <code>/api/scenarios/{scenario.id}</code>
                    {canWrite ? (
                      <>
                        {" "}
                        · run <code>/api/scenarios/{scenario.id}/run</code>
                      </>
                    ) : null}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-sm">
        <Link href="/dashboard" className="font-medium text-indigo-700">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}

function MetricLines({ block }: { block: Record<string, unknown> }) {
  const lines = [
    ["Throughput / day", block.throughputOrdersPerDay],
    ["Throughput / hour", block.throughputOrdersPerHour],
    ["Operating cost", block.operatingCost],
  ] as const;
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {lines.map(([label, value]) => (
        <li key={label}>
          <span className="text-slate-500">{label}: </span>
          {isFigure(value) ? formatScenarioFigure(value) : "—"}
        </li>
      ))}
    </ul>
  );
}

function isFigure(value: unknown): value is {
  value: number | null;
  unit: string;
  unavailableReason: "empty_period" | "zero_denominator" | "missing_inputs" | null;
  basis: "observed" | "modeled";
} {
  return Boolean(value && typeof value === "object" && "basis" in value && "unit" in value);
}
