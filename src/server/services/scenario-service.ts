import { buildScenarioBaseline } from "@/lib/scenarios/baseline";
import { compareScenarioProjections } from "@/lib/scenarios/compare";
import { SCENARIO_KIND_LABELS } from "@/lib/scenarios/present";
import {
  scenarioConfigurationSchema,
  scenarioWriteSchema,
  type ScenarioConfiguration,
  type ScenarioWrite,
} from "@/lib/scenarios/schema";
import { projectScenario } from "@/lib/scenarios/project";
import type { ScenarioProjection } from "@/lib/scenarios/types";
import { AppError } from "@/lib/errors";
import { assertRole, roleCan, type Role } from "@/lib/permissions";
import { getFacility } from "@/server/repositories/facilities";
import { loadAnalyticsSamples, loadMetricCoverage } from "@/server/repositories/analytics";
import {
  deleteScenarioRow,
  duplicateScenarioRow,
  getFacilityScenario,
  insertScenario,
  insertScenarioResult,
  listFacilityScenarios,
  updateScenarioRow,
} from "@/server/repositories/scenarios";
import { resolveQueryRange, type AnalyticsQuery } from "@/server/services/analytics-service";

export async function listScenariosForFacility(input: {
  organizationId: string;
  userId: string;
  facilityId: string;
  role: Role;
}) {
  assertRole(input.role, "scenarios:read");
  const rows = await listFacilityScenarios(input.organizationId, input.userId, input.facilityId);
  return rows.map(presentScenarioSummary);
}

export async function getScenarioDetail(input: {
  organizationId: string;
  userId: string;
  scenarioId: string;
  role: Role;
}) {
  assertRole(input.role, "scenarios:read");
  const found = await getFacilityScenario(input.organizationId, input.userId, input.scenarioId);
  if (!found) throw new AppError("NOT_FOUND", "Scenario not found.", 404);
  return {
    scenario: presentScenarioSummary(found.scenario),
    results: found.results.map(presentStoredResult),
    latest: found.results[0] ? presentStoredResult(found.results[0]) : null,
  };
}

export async function createScenario(input: {
  organizationId: string;
  userId: string;
  facilityId: string;
  role: Role;
  body: unknown;
}) {
  assertRole(input.role, "scenarios:write");
  const facility = await getFacility(input.organizationId, input.userId, input.facilityId);
  if (!facility) throw new AppError("NOT_FOUND", "Facility not found.", 404);
  const parsed = scenarioWriteSchema.parse(input.body);
  const row = await insertScenario(input.organizationId, input.userId, {
    facilityId: input.facilityId,
    name: parsed.name,
    description: parsed.description ?? null,
    status: parsed.status ?? "draft",
    configuration: parsed.configuration,
    createdBy: input.userId,
  });
  return presentScenarioSummary(row);
}

export async function updateScenario(input: {
  organizationId: string;
  userId: string;
  scenarioId: string;
  role: Role;
  body: unknown;
}) {
  assertRole(input.role, "scenarios:write");
  const existing = await getFacilityScenario(input.organizationId, input.userId, input.scenarioId);
  if (!existing) throw new AppError("NOT_FOUND", "Scenario not found.", 404);
  const parsed = scenarioWriteSchema.parse(input.body);
  const row = await updateScenarioRow(input.organizationId, input.userId, input.scenarioId, {
    name: parsed.name,
    description: parsed.description ?? null,
    status: parsed.status ?? existing.scenario.status,
    configuration: parsed.configuration,
  });
  if (!row) throw new AppError("NOT_FOUND", "Scenario not found.", 404);
  return presentScenarioSummary(row);
}

export async function deleteScenario(input: {
  organizationId: string;
  userId: string;
  scenarioId: string;
  role: Role;
}) {
  assertRole(input.role, "scenarios:write");
  const deleted = await deleteScenarioRow(input.organizationId, input.userId, input.scenarioId);
  if (!deleted) throw new AppError("NOT_FOUND", "Scenario not found.", 404);
  return { id: deleted.id };
}

export async function duplicateScenario(input: {
  organizationId: string;
  userId: string;
  scenarioId: string;
  role: Role;
}) {
  assertRole(input.role, "scenarios:write");
  const copy = await duplicateScenarioRow(
    input.organizationId,
    input.userId,
    input.scenarioId,
    input.userId,
  );
  if (!copy) throw new AppError("NOT_FOUND", "Scenario not found.", 404);
  return presentScenarioSummary(copy);
}

export async function runScenario(input: {
  organizationId: string;
  userId: string;
  scenarioId: string;
  role: Role;
  query?: AnalyticsQuery;
}) {
  assertRole(input.role, "scenarios:write");
  const found = await getFacilityScenario(input.organizationId, input.userId, input.scenarioId);
  if (!found) throw new AppError("NOT_FOUND", "Scenario not found.", 404);

  const configuration = parseConfiguration(found.scenario.configuration);
  const projection = await computeProjection({
    organizationId: input.organizationId,
    userId: input.userId,
    facilityId: found.scenario.facilityId,
    configuration,
    query: input.query,
  });
  const saved = await insertScenarioResult(input.organizationId, input.userId, {
    scenarioId: found.scenario.id,
    projection,
  });
  return {
    scenario: presentScenarioSummary(found.scenario),
    result: presentStoredResult(saved),
    projection,
  };
}

export async function compareScenarios(input: {
  organizationId: string;
  userId: string;
  facilityId: string;
  role: Role;
  leftId: string;
  rightId?: string | null;
  query?: AnalyticsQuery;
}) {
  if (!(roleCan(input.role, "scenarios:read") || roleCan(input.role, "scenarios:review"))) {
    throw new AppError("FORBIDDEN", "You do not have permission to do that.", 403);
  }
  assertRole(input.role, "scenarios:read");

  const left = await loadProjectionForCompare(input, input.leftId);
  const right = input.rightId ? await loadProjectionForCompare(input, input.rightId) : null;
  if (right && right.facilityId !== left.facilityId) {
    throw new AppError("VALIDATION_ERROR", "Compare scenarios from the same facility.", 400);
  }
  if (left.facilityId !== input.facilityId) {
    throw new AppError("NOT_FOUND", "Scenario not found.", 404);
  }

  return {
    columns: compareScenarioProjections({
      left: { id: left.id, name: left.name, projection: left.projection },
      right: right ? { id: right.id, name: right.name, projection: right.projection } : null,
    }),
    left: left.detail,
    right: right?.detail ?? null,
    note: "Projected dollars are modeled estimates, not verified savings.",
  };
}

export function canWriteScenarios(role: Role) {
  return roleCan(role, "scenarios:write");
}

async function loadProjectionForCompare(
  input: {
    organizationId: string;
    userId: string;
    query?: AnalyticsQuery;
  },
  scenarioId: string,
) {
  const found = await getFacilityScenario(input.organizationId, input.userId, scenarioId);
  if (!found) throw new AppError("NOT_FOUND", "Scenario not found.", 404);
  const configuration = parseConfiguration(found.scenario.configuration);
  const projection = await computeProjection({
    organizationId: input.organizationId,
    userId: input.userId,
    facilityId: found.scenario.facilityId,
    configuration,
    query: input.query,
  });
  return {
    id: found.scenario.id,
    name: found.scenario.name,
    facilityId: found.scenario.facilityId,
    projection,
    detail: presentScenarioSummary(found.scenario),
  };
}

async function computeProjection(input: {
  organizationId: string;
  userId: string;
  facilityId: string;
  configuration: ScenarioConfiguration;
  query?: AnalyticsQuery;
}): Promise<ScenarioProjection> {
  const freshness = await loadMetricCoverage(input.organizationId, input.userId, input.facilityId);
  const range = resolveQueryRange(input.query, freshness);
  const samples = await loadAnalyticsSamples(
    input.organizationId,
    input.userId,
    input.facilityId,
    range,
  );
  const baseline = buildScenarioBaseline({
    range,
    metrics: samples.metrics,
    costs: samples.costs,
  });
  return projectScenario(baseline, input.configuration);
}

function parseConfiguration(value: unknown): ScenarioConfiguration {
  const parsed = scenarioConfigurationSchema.safeParse(value);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "This scenario configuration is not runnable with the current formulas.",
      400,
    );
  }
  return parsed.data;
}

function presentScenarioSummary(row: {
  id: string;
  facilityId: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  configuration: Record<string, unknown>;
  createdAt: Date;
  updatedAt?: Date;
  createdBy?: string | null;
}) {
  const kind = typeof row.configuration.kind === "string" ? row.configuration.kind : "unknown";
  return {
    id: row.id,
    facilityId: row.facilityId,
    name: row.name,
    description: row.description,
    status: row.status,
    kind,
    kindLabel: SCENARIO_KIND_LABELS[kind] ?? kind,
    configuration: row.configuration,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? row.createdAt.toISOString(),
  };
}

function presentStoredResult(row: {
  id: string;
  scenarioId: string;
  baselineMetrics: Record<string, unknown>;
  projectedMetrics: Record<string, unknown>;
  estimatedSavings: string | null;
  currency: string;
  assumptions: Record<string, unknown>;
  calculatedAt: Date;
}) {
  return {
    id: row.id,
    scenarioId: row.scenarioId,
    baseline: row.baselineMetrics,
    projected: row.projectedMetrics,
    estimatedMonthlySavings: row.estimatedSavings,
    currency: row.currency,
    assumptions: row.assumptions,
    calculatedAt: row.calculatedAt.toISOString(),
    label: "Modeled estimate. Not a verified saving.",
  };
}

export type { ScenarioWrite };
