import { and, asc, desc, eq } from "drizzle-orm";

import { withTenant } from "@/db/tenant";
import { scenarioResults, scenarios } from "@/db/schema";
import type { ScenarioConfiguration } from "@/lib/scenarios/schema";
import type { ScenarioProjection } from "@/lib/scenarios/types";

export async function listFacilityScenarios(
  organizationId: string,
  userId: string,
  facilityId: string,
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    return tx
      .select({
        id: scenarios.id,
        facilityId: scenarios.facilityId,
        name: scenarios.name,
        description: scenarios.description,
        status: scenarios.status,
        configuration: scenarios.configuration,
        createdBy: scenarios.createdBy,
        createdAt: scenarios.createdAt,
        updatedAt: scenarios.updatedAt,
      })
      .from(scenarios)
      .where(
        and(eq(scenarios.organizationId, organizationId), eq(scenarios.facilityId, facilityId)),
      )
      .orderBy(asc(scenarios.name));
  });
}

export async function getFacilityScenario(
  organizationId: string,
  userId: string,
  scenarioId: string,
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const [scenario] = await tx
      .select()
      .from(scenarios)
      .where(and(eq(scenarios.organizationId, organizationId), eq(scenarios.id, scenarioId)));
    if (!scenario) return null;
    const results = await tx
      .select()
      .from(scenarioResults)
      .where(
        and(
          eq(scenarioResults.organizationId, organizationId),
          eq(scenarioResults.scenarioId, scenarioId),
        ),
      )
      .orderBy(desc(scenarioResults.calculatedAt));
    return { scenario, results };
  });
}

export async function insertScenario(
  organizationId: string,
  userId: string,
  input: {
    facilityId: string;
    name: string;
    description: string | null;
    status: "draft" | "active" | "archived";
    configuration: ScenarioConfiguration;
    createdBy: string;
  },
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const [row] = await tx
      .insert(scenarios)
      .values({
        organizationId,
        facilityId: input.facilityId,
        name: input.name,
        description: input.description,
        status: input.status,
        configuration: input.configuration,
        createdBy: input.createdBy,
      })
      .returning();
    return row!;
  });
}

export async function updateScenarioRow(
  organizationId: string,
  userId: string,
  scenarioId: string,
  input: {
    name: string;
    description: string | null;
    status: "draft" | "active" | "archived";
    configuration: ScenarioConfiguration;
  },
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const [row] = await tx
      .update(scenarios)
      .set({
        name: input.name,
        description: input.description,
        status: input.status,
        configuration: input.configuration,
        updatedAt: new Date(),
      })
      .where(and(eq(scenarios.organizationId, organizationId), eq(scenarios.id, scenarioId)))
      .returning();
    return row ?? null;
  });
}

export async function deleteScenarioRow(
  organizationId: string,
  userId: string,
  scenarioId: string,
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const [row] = await tx
      .delete(scenarios)
      .where(and(eq(scenarios.organizationId, organizationId), eq(scenarios.id, scenarioId)))
      .returning({ id: scenarios.id });
    return row ?? null;
  });
}

export async function duplicateScenarioRow(
  organizationId: string,
  userId: string,
  scenarioId: string,
  createdBy: string,
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const [source] = await tx
      .select()
      .from(scenarios)
      .where(and(eq(scenarios.organizationId, organizationId), eq(scenarios.id, scenarioId)));
    if (!source) return null;
    const [row] = await tx
      .insert(scenarios)
      .values({
        organizationId,
        facilityId: source.facilityId,
        name: `${source.name} (copy)`,
        description: source.description,
        status: "draft",
        configuration: source.configuration,
        createdBy,
      })
      .returning();
    return row!;
  });
}

export async function insertScenarioResult(
  organizationId: string,
  userId: string,
  input: {
    scenarioId: string;
    projection: ScenarioProjection;
  },
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const savings = input.projection.monthlySavings.value;
    const [row] = await tx
      .insert(scenarioResults)
      .values({
        organizationId,
        scenarioId: input.scenarioId,
        baselineMetrics: {
          ...input.projection.baseline,
          basis: "observed",
        },
        projectedMetrics: {
          ...input.projection.projected,
          basis: "modeled",
          monthlySavings: input.projection.monthlySavings,
          roi: input.projection.roi,
        },
        estimatedSavings: savings === null ? null : savings.toFixed(2),
        currency: "USD",
        assumptions: {
          modeled: true,
          observed: false,
          kind: input.projection.kind,
          periodFrom: input.projection.periodFrom,
          periodTo: input.projection.periodTo,
          assumptions: input.projection.assumptions,
          limitations: input.projection.limitations,
          label: "Modeled estimate. Not a verified saving.",
        },
        calculatedAt: new Date(),
      })
      .returning();
    return row!;
  });
}
