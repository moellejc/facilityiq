import { z } from "zod";

import { SCENARIO_KINDS } from "./types";

const optionalMoney = z.number().finite().nonnegative().nullable().optional();

export const scenarioConfigurationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("add_packing_station"),
    parameters: z.object({
      additionalStations: z.number().int().min(1).max(20),
      referenceAssetId: z.uuid().nullable().optional(),
      modeledMonthlyCostPerStation: optionalMoney,
      modeledInvestment: optionalMoney,
    }),
  }),
  z.object({
    kind: z.literal("increase_conveyor_capacity"),
    parameters: z.object({
      assetId: z.uuid(),
      capacityIncreasePercent: z.number().finite().positive().max(500),
      modeledMonthlyCost: optionalMoney,
      modeledInvestment: optionalMoney,
    }),
  }),
  z.object({
    kind: z.literal("extend_operating_hours"),
    parameters: z.object({
      additionalHoursPerDay: z.number().finite().positive().max(24),
    }),
  }),
  z.object({
    kind: z.literal("reassign_equipment"),
    parameters: z.object({
      assetIds: z.array(z.uuid()).min(1).max(30),
      destinationAreaId: z.uuid().nullable().optional(),
      modeledCostPerDwellMinute: optionalMoney,
    }),
  }),
  z.object({
    kind: z.literal("increase_staffing"),
    parameters: z.object({
      additionalHeadcount: z.number().int().min(1).max(200),
      hoursPerPersonPerDay: z.number().finite().positive().max(24).nullable().optional(),
      modeledHourlyLaborRate: optionalMoney,
    }),
  }),
  z.object({
    kind: z.literal("reduce_downtime"),
    parameters: z.object({
      assetId: z.uuid(),
      targetDowntimeMinutesPerDay: z.number().finite().nonnegative(),
      modeledRepairCost: optionalMoney,
    }),
  }),
]);

export const scenarioWriteSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  configuration: scenarioConfigurationSchema,
});

export type ScenarioConfiguration = z.infer<typeof scenarioConfigurationSchema>;
export type ScenarioWrite = z.infer<typeof scenarioWriteSchema>;

export function isScenarioKind(value: string): value is (typeof SCENARIO_KINDS)[number] {
  return (SCENARIO_KINDS as readonly string[]).includes(value);
}
