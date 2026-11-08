import { pathToFileURL } from "node:url";

import { config as loadEnv } from "dotenv";
import { eq, inArray } from "drizzle-orm";

loadEnv();
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { hashPassword } from "@/lib/auth/password";
import * as schema from "@/db/schema";

import {
  DEMO_PASSWORD,
  DEMO_USERS,
  ORG_SLUG,
  PERIOD_END,
  SEEDED_AT,
  deterministicUuid,
  facilityId,
  organizationId,
  userId,
} from "./ids";

const { organizations, users } = schema;

type AreaKey =
  | "receiving"
  | "aisle-01"
  | "aisle-02"
  | "aisle-03"
  | "aisle-04"
  | "packing"
  | "shipping"
  | "staging";

const AREAS: Array<{
  key: AreaKey;
  name: string;
  areaType: (typeof schema.areaTypeEnum.enumValues)[number];
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  condition?: string;
}> = [
  { key: "receiving", name: "Receiving", areaType: "receiving", x: 0, z: 0, w: 18, d: 60, h: 8 },
  { key: "aisle-01", name: "Aisle 01", areaType: "aisle", x: 20, z: 4, w: 14, d: 40, h: 8 },
  { key: "aisle-02", name: "Aisle 02", areaType: "aisle", x: 36, z: 4, w: 14, d: 40, h: 8 },
  { key: "aisle-03", name: "Aisle 03", areaType: "aisle", x: 52, z: 4, w: 14, d: 40, h: 8 },
  {
    key: "aisle-04",
    name: "Aisle 04",
    areaType: "aisle",
    x: 68,
    z: 4,
    w: 14,
    d: 40,
    h: 8,
    condition: "excessive_utilization",
  },
  { key: "packing", name: "Packing", areaType: "packing", x: 20, z: 46, w: 62, d: 14, h: 6 },
  { key: "shipping", name: "Shipping", areaType: "shipping", x: 84, z: 0, w: 16, d: 32, h: 8 },
  { key: "staging", name: "Staging", areaType: "staging", x: 84, z: 34, w: 16, d: 26, h: 6 },
];

function areaId(key: string) {
  return deterministicUuid(`area:${key}`);
}

function assetId(name: string) {
  return deterministicUuid(`asset:${name}`);
}

function n(value: number, digits = 4) {
  return value.toFixed(digits);
}

function money(value: number) {
  return value.toFixed(2);
}

function seedDays() {
  const end = new Date(`${PERIOD_END}T12:00:00.000Z`);
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - (29 - index));
    return date;
  });
}

function isWeekend(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function periodBounds(date: Date) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function areaUtilization(key: AreaKey, dayIndex: number) {
  if (key === "aisle-04") return 94 + (dayIndex / 29) * 3;
  const baseline: Record<AreaKey, number> = {
    receiving: 58,
    "aisle-01": 61,
    "aisle-02": 64,
    "aisle-03": 70,
    "aisle-04": 94,
    packing: 86,
    shipping: 63,
    staging: 47,
  };
  return baseline[key];
}

async function insertChunks<T>(rows: T[], size: number, insert: (chunk: T[]) => Promise<void>) {
  for (let index = 0; index < rows.length; index += size) {
    await insert(rows.slice(index, index + size));
  }
}

export async function seedDatabase() {
  const url = process.env.DATABASE_MIGRATE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_MIGRATE_URL or DATABASE_URL is required to seed.");
  }

  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool, { schema });
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const days = seedDays();

  try {
    await db.transaction(async (tx) => {
      await tx.delete(organizations).where(eq(organizations.slug, ORG_SLUG));
      await tx.delete(users).where(
        inArray(
          users.email,
          DEMO_USERS.map((user) => user.email),
        ),
      );

      await tx.insert(users).values(
        DEMO_USERS.map((user) => ({
          id: userId(user.email),
          name: user.name,
          email: user.email,
          emailVerified: SEEDED_AT,
          passwordHash,
          createdAt: SEEDED_AT,
          updatedAt: SEEDED_AT,
        })),
      );

      await tx.insert(organizations).values({
        id: organizationId,
        name: "Acme Manufacturing",
        slug: ORG_SLUG,
        createdAt: SEEDED_AT,
        updatedAt: SEEDED_AT,
      });

      await tx.insert(schema.organizationMembers).values(
        DEMO_USERS.map((user) => ({
          id: deterministicUuid(`member:${user.email}`),
          organizationId,
          userId: userId(user.email),
          role: user.role,
          createdAt: SEEDED_AT,
        })),
      );

      await tx.insert(schema.facilities).values({
        id: facilityId,
        organizationId,
        name: "West Distribution Center",
        location: "4800 Harbor Avenue, Tacoma, WA",
        facilityType: "distribution_center",
        squareFootage: "240000.00",
        timezone: "America/Los_Angeles",
        metadata: {
          operatingHours: { weekday: 16, weekend: 8 },
          bounds: { width: 100, depth: 60, height: 10, units: "meters" },
        },
        createdAt: SEEDED_AT,
        updatedAt: SEEDED_AT,
      });

      await tx.insert(schema.facilityAreas).values(
        AREAS.map((area) => ({
          id: areaId(area.key),
          organizationId,
          facilityId,
          name: area.name,
          areaType: area.areaType,
          positionX: n(area.x),
          positionY: "0.0000",
          positionZ: n(area.z),
          width: n(area.w),
          height: n(area.h),
          depth: n(area.d),
          metadata: area.condition ? { demoCondition: area.condition } : {},
          createdAt: SEEDED_AT,
        })),
      );

      const aisleKeys = ["aisle-01", "aisle-02", "aisle-03", "aisle-04"] as const;
      const racks = aisleKeys.flatMap((key, aisleIndex) => {
        const area = AREAS.find((item) => item.key === key)!;
        return Array.from({ length: 20 }, (_, rackIndex) => {
          const row = rackIndex < 10 ? 0 : 1;
          const column = rackIndex % 10;
          const code = `A${aisleIndex + 1}`;
          const name = `RK-${code}-${String(rackIndex + 1).padStart(2, "0")}`;
          return {
            id: assetId(name),
            organizationId,
            facilityId,
            areaId: areaId(key),
            name,
            assetType: "storage_rack" as const,
            status: "active" as const,
            positionX: n(area.x + 2 + row * 6),
            positionY: "0.0000",
            positionZ: n(area.z + 2 + column * 3.6),
            rotationX: "0.0000",
            rotationY: "0.0000",
            rotationZ: "0.0000",
            metadata: {
              aisle: area.name,
              bay: rackIndex + 1,
              ...(key === "aisle-04" ? { demoCondition: "excessive_utilization" } : {}),
            },
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
          };
        });
      });

      const palletPlan = [
        { key: "aisle-01" as const, count: 90 },
        { key: "aisle-02" as const, count: 90 },
        { key: "aisle-03" as const, count: 90 },
        { key: "aisle-04" as const, count: 230 },
      ];
      let palletNumber = 1;
      const pallets = palletPlan.flatMap((plan) => {
        const aisleRacks = racks.filter((rack) => rack.areaId === areaId(plan.key));
        return Array.from({ length: plan.count }, (_, index) => {
          const rack = aisleRacks[index % aisleRacks.length]!;
          const name = `PLT-${String(palletNumber).padStart(4, "0")}`;
          palletNumber += 1;
          const level = Math.floor(index / aisleRacks.length) % 4;
          return {
            id: assetId(name),
            organizationId,
            facilityId,
            areaId: areaId(plan.key),
            name,
            assetType: "pallet" as const,
            status: "active" as const,
            positionX: rack.positionX,
            positionY: n(0.2 + level * 1.4),
            positionZ: rack.positionZ,
            rotationX: "0.0000",
            rotationY: "0.0000",
            rotationZ: "0.0000",
            metadata: { rackId: rack.id, rackName: rack.name, level },
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
          };
        });
      });

      const packing = [1, 2, 3, 4].map((index) => {
        const name = `PS-0${index}`;
        return {
          id: assetId(name),
          organizationId,
          facilityId,
          areaId: areaId("packing"),
          name,
          assetType: "packing_station" as const,
          status: "active" as const,
          positionX: n(24 + (index - 1) * 12),
          positionY: "0.0000",
          positionZ: n(52),
          rotationX: "0.0000",
          rotationY: "0.0000",
          rotationZ: "0.0000",
          metadata: index === 2 ? { demoCondition: "insufficient_capacity" } : {},
          createdAt: SEEDED_AT,
          updatedAt: SEEDED_AT,
        };
      });

      const docks = Array.from({ length: 6 }, (_, index) => {
        const name = `DK-0${index + 1}`;
        return {
          id: assetId(name),
          organizationId,
          facilityId,
          areaId: areaId("shipping"),
          name,
          assetType: "loading_dock" as const,
          status: "active" as const,
          positionX: n(98),
          positionY: "0.0000",
          positionZ: n(2 + index * 5),
          rotationX: "0.0000",
          rotationY: "90.0000",
          rotationZ: "0.0000",
          metadata: { demoCondition: "rising_dwell_time" },
          createdAt: SEEDED_AT,
          updatedAt: SEEDED_AT,
        };
      });

      const conveyors = [1, 2, 3].map((index) => {
        const name = `CV-0${index}`;
        return {
          id: assetId(name),
          organizationId,
          facilityId,
          areaId: areaId("packing"),
          name,
          assetType: "conveyor" as const,
          status: "active" as const,
          positionX: n(30 + (index - 1) * 16),
          positionY: "0.8000",
          positionZ: n(58),
          rotationX: "0.0000",
          rotationY: "0.0000",
          rotationZ: "0.0000",
          metadata: index === 2 ? { demoCondition: "rising_maintenance_cost" } : {},
          createdAt: SEEDED_AT,
          updatedAt: SEEDED_AT,
        };
      });

      const forkliftUtils = [68, 71, 74, 14, 16];
      const forklifts = forkliftUtils.map((utilization, index) => {
        const name = `FL-0${index + 1}`;
        return {
          id: assetId(name),
          organizationId,
          facilityId,
          areaId: areaId(index >= 3 ? "staging" : "aisle-02"),
          name,
          assetType: "forklift" as const,
          status: "active" as const,
          positionX: n(86 + index * 2),
          positionY: "0.0000",
          positionZ: n(40 + (index % 2) * 3),
          rotationX: "0.0000",
          rotationY: "15.0000",
          rotationZ: "0.0000",
          metadata:
            utilization < 20
              ? { demoCondition: "underutilized", targetUtilization: utilization }
              : { targetUtilization: utilization },
          createdAt: SEEDED_AT,
          updatedAt: SEEDED_AT,
        };
      });

      const assets = [...racks, ...pallets, ...packing, ...docks, ...conveyors, ...forklifts];
      await insertChunks(assets, 100, async (chunk) => {
        await tx.insert(schema.assets).values(chunk);
      });

      await tx.insert(schema.facilityLayouts).values({
        id: deterministicUuid("layout:west:v1"),
        organizationId,
        facilityId,
        name: "As-built November 2026",
        version: 1,
        layoutData: {
          units: "meters",
          gridSize: 1,
          bounds: { width: 100, depth: 60, height: 10 },
          areas: AREAS.map((area) => ({
            id: areaId(area.key),
            name: area.name,
            areaType: area.areaType,
            x: area.x,
            y: 0,
            z: area.z,
            width: area.w,
            height: area.h,
            depth: area.d,
          })),
        },
        createdBy: userId("operations@acme.example"),
        createdAt: SEEDED_AT,
      });

      const operational: Array<typeof schema.operationalMetrics.$inferInsert> = [];
      for (const [dayIndex, date] of days.entries()) {
        const weekend = isWeekend(date);
        const orders = weekend ? 860 : 1980 + (dayIndex % 4) * 35;
        const hours = weekend ? 8 : 16;
        const facilityUtil =
          AREAS.reduce((sum, area) => sum + areaUtilization(area.key, dayIndex), 0) / AREAS.length;
        const push = (
          scope: string,
          metricType: (typeof schema.metricTypeEnum.enumValues)[number],
          value: number,
          unit: string,
          refs: { areaId?: string; assetId?: string } = {},
        ) => {
          operational.push({
            id: deterministicUuid(`metric:${scope}:${metricType}:${dayIndex}`),
            organizationId,
            facilityId,
            areaId: refs.areaId,
            assetId: refs.assetId,
            metricType,
            metricValue: n(value),
            unit,
            recordedAt: date,
            metadata: {},
          });
        };

        push("facility", "orders_processed", orders, "orders");
        push("facility", "units_processed", orders * 4, "units");
        push("facility", "operating_hours", hours, "hours");
        push("facility", "cycle_time_minutes", 47, "minutes");
        push("facility", "downtime_minutes", 35 + dayIndex * 1.2, "minutes");
        push("facility", "utilization", facilityUtil, "percent");

        for (const area of AREAS) {
          const utilization = areaUtilization(area.key, dayIndex);
          push(`area:${area.key}`, "utilization", utilization, "percent", {
            areaId: areaId(area.key),
          });
          const severity = area.key === "aisle-04" ? 0.78 : area.key === "packing" ? 0.72 : 0.16;
          push(`area:${area.key}`, "bottleneck_severity", severity, "ratio", {
            areaId: areaId(area.key),
          });
        }

        for (const station of packing) {
          const profile =
            station.name === "PS-02"
              ? { utilization: 97.5, severity: 0.86, orders: 150 }
              : station.name === "PS-01"
                ? { utilization: 72, severity: 0.22, orders: 240 }
                : station.name === "PS-03"
                  ? { utilization: 75, severity: 0.18, orders: 230 }
                  : { utilization: 78, severity: 0.2, orders: 220 };
          const available = hours * 60;
          push(`${station.name}`, "utilization", profile.utilization, "percent", {
            areaId: station.areaId,
            assetId: station.id,
          });
          push(
            `${station.name}`,
            "busy_minutes",
            (profile.utilization / 100) * available,
            "minutes",
            {
              areaId: station.areaId,
              assetId: station.id,
            },
          );
          push(`${station.name}`, "available_minutes", available, "minutes", {
            areaId: station.areaId,
            assetId: station.id,
          });
          push(`${station.name}`, "orders_processed", profile.orders, "orders", {
            areaId: station.areaId,
            assetId: station.id,
          });
          push(`${station.name}`, "bottleneck_severity", profile.severity, "ratio", {
            areaId: station.areaId,
            assetId: station.id,
          });
        }

        for (const truck of forklifts) {
          const utilization = Number(truck.metadata.targetUtilization);
          const available = hours * 60;
          push(truck.name, "utilization", utilization, "percent", {
            areaId: truck.areaId,
            assetId: truck.id,
          });
          push(truck.name, "busy_minutes", (utilization / 100) * available, "minutes", {
            areaId: truck.areaId,
            assetId: truck.id,
          });
          push(truck.name, "available_minutes", available, "minutes", {
            areaId: truck.areaId,
            assetId: truck.id,
          });
        }

        docks.forEach((dock, dockIndex) => {
          const dwell = 24 + (dayIndex / 29) * 46 + dockIndex * 0.4;
          push(dock.name, "dwell_time_minutes", dwell, "minutes", {
            areaId: dock.areaId,
            assetId: dock.id,
          });
        });

        conveyors.forEach((conveyor, conveyorIndex) => {
          const downtime = conveyor.name === "CV-02" ? 20 + dayIndex * 1.5 : 12;
          const utilization = [70, 81, 66][conveyorIndex] ?? 70;
          push(conveyor.name, "downtime_minutes", downtime, "minutes", {
            areaId: conveyor.areaId,
            assetId: conveyor.id,
          });
          push(conveyor.name, "utilization", utilization, "percent", {
            areaId: conveyor.areaId,
            assetId: conveyor.id,
          });
        });

        for (const rack of racks) {
          const aisle = String(rack.metadata.aisle);
          const bay = Number(rack.metadata.bay);
          const base = aisle === "Aisle 04" ? 92 + (bay % 5) * 0.5 : 54 + (bay % 8) * 2;
          const utilization = aisle === "Aisle 04" ? Math.min(99, base + dayIndex * 0.08) : base;
          push(rack.name, "utilization", utilization, "percent", {
            areaId: rack.areaId ?? undefined,
            assetId: rack.id,
          });
        }
      }

      await insertChunks(operational, 400, async (chunk) => {
        await tx.insert(schema.operationalMetrics).values(chunk);
      });

      const financial: Array<typeof schema.financialMetrics.$inferInsert> = [];
      for (const [dayIndex, date] of days.entries()) {
        const { start, end } = periodBounds(date);
        const weekend = isWeekend(date);
        const rows: Array<
          [string, (typeof schema.costCategoryEnum.enumValues)[number], number, string?]
        > = [
          ["facility:labor", "labor", weekend ? 2400 : 5800],
          ["facility:energy", "energy", weekend ? 480 : 940],
          ["facility:equipment", "equipment", 1250],
          ["facility:overhead", "overhead", 680],
          ["facility:maintenance", "maintenance", 180],
          ["CV-01", "maintenance", 35, assetId("CV-01")],
          ["CV-02", "maintenance", 40 + (dayIndex / 29) * 200, assetId("CV-02")],
          ["CV-03", "maintenance", 35, assetId("CV-03")],
        ];
        for (const [scope, category, amount, linkedAsset] of rows) {
          financial.push({
            id: deterministicUuid(`fin:${scope}:${dayIndex}`),
            organizationId,
            facilityId,
            assetId: linkedAsset,
            costCategory: category,
            amount: money(amount),
            currency: "USD",
            periodStart: start,
            periodEnd: end,
            metadata: linkedAsset ? { scope: "asset" } : { scope: "facility" },
          });
        }
      }
      await insertChunks(financial, 200, async (chunk) => {
        await tx.insert(schema.financialMetrics).values(chunk);
      });

      const occurred = (dayIndex: number) => days[dayIndex] ?? days[days.length - 1]!;
      await tx.insert(schema.assetEvents).values([
        {
          id: deterministicUuid("event:aisle-04-util"),
          organizationId,
          facilityId,
          areaId: areaId("aisle-04"),
          assetId: assetId("RK-A4-01"),
          eventType: "utilization",
          severity: "critical",
          description: "Aisle 04 stayed above 94% utilization for the full seeded month.",
          occurredAt: occurred(28),
          metadata: { demoCondition: "excessive_utilization" },
        },
        {
          id: deterministicUuid("event:ps-02-capacity"),
          organizationId,
          facilityId,
          areaId: areaId("packing"),
          assetId: assetId("PS-02"),
          eventType: "capacity",
          severity: "critical",
          description: "Packing station PS-02 queued work while running near 98% utilization.",
          occurredAt: occurred(27),
          metadata: { demoCondition: "insufficient_capacity" },
        },
        {
          id: deterministicUuid("event:fl-04-idle"),
          organizationId,
          facilityId,
          areaId: areaId("staging"),
          assetId: assetId("FL-04"),
          eventType: "utilization",
          severity: "warning",
          description: "Forklift FL-04 averaged about 14% utilization.",
          occurredAt: occurred(20),
          metadata: { demoCondition: "underutilized" },
        },
        {
          id: deterministicUuid("event:fl-05-idle"),
          organizationId,
          facilityId,
          areaId: areaId("staging"),
          assetId: assetId("FL-05"),
          eventType: "utilization",
          severity: "warning",
          description: "Forklift FL-05 averaged about 16% utilization.",
          occurredAt: occurred(20),
          metadata: { demoCondition: "underutilized" },
        },
        {
          id: deterministicUuid("event:dock-dwell"),
          organizationId,
          facilityId,
          areaId: areaId("shipping"),
          assetId: assetId("DK-03"),
          eventType: "dwell",
          severity: "warning",
          description: "Loading-dock dwell rose from about 24 minutes to about 70 minutes.",
          occurredAt: occurred(29),
          metadata: { demoCondition: "rising_dwell_time" },
        },
        {
          id: deterministicUuid("event:cv-02-maintenance"),
          organizationId,
          facilityId,
          areaId: areaId("packing"),
          assetId: assetId("CV-02"),
          eventType: "maintenance",
          severity: "warning",
          description: "Conveyor CV-02 maintenance cost increased through the month.",
          occurredAt: occurred(25),
          metadata: { demoCondition: "rising_maintenance_cost" },
        },
        {
          id: deterministicUuid("event:receiving-healthy"),
          organizationId,
          facilityId,
          areaId: areaId("receiving"),
          eventType: "alert",
          severity: "info",
          description: "Receiving held a steady utilization near 58% with no capacity alerts.",
          occurredAt: occurred(15),
          metadata: { demoCondition: "healthy" },
        },
      ]);

      const evidence = (
        summary: string,
        observation: string,
        action: string,
      ): Record<string, unknown> => ({
        source: "deterministic_rules",
        summary,
        observation,
        recommendedAction: action,
        uncertainty:
          "Estimated impact is a planning figure from seeded metrics, not a verified savings amount.",
      });

      await tx.insert(schema.insights).values([
        {
          id: deterministicUuid("insight:aisle-04"),
          organizationId,
          facilityId,
          areaId: areaId("aisle-04"),
          insightType: "excessive_utilization",
          severity: "critical",
          title: "Aisle 04 is over capacity",
          description:
            "Aisle 04 utilization climbed from 94% to 97% while Aisles 01–03 stayed between 61% and 70%.",
          recommendedAction:
            "Rebalance pallet putaway toward Aisles 01 and 02 before adding racking.",
          estimatedFinancialImpact: "18600.00",
          currency: "USD",
          confidence: "0.8200",
          evidence: evidence(
            "Area utilization samples for 30 days.",
            "Aisle 04 ended the period at 97% utilization.",
            "Shift inbound pallets off Aisle 04.",
          ),
          status: "open",
          createdAt: days[29],
        },
        {
          id: deterministicUuid("insight:ps-02"),
          organizationId,
          facilityId,
          areaId: areaId("packing"),
          assetId: assetId("PS-02"),
          insightType: "capacity_constraint",
          severity: "critical",
          title: "Packing station PS-02 cannot clear its queue",
          description:
            "PS-02 ran at 97.5% utilization and completed about 150 orders a day, below the 220–240 orders at the other stations.",
          recommendedAction: "Add a packing station or move SKUs off PS-02.",
          estimatedFinancialImpact: "24200.00",
          currency: "USD",
          confidence: "0.7800",
          evidence: evidence(
            "Station utilization, orders, and bottleneck severity.",
            "PS-02 bottleneck severity is 0.86, above the 0.70 warning threshold.",
            "Model an additional packing station.",
          ),
          status: "open",
          createdAt: days[29],
        },
        {
          id: deterministicUuid("insight:forklifts"),
          organizationId,
          facilityId,
          areaId: areaId("staging"),
          assetId: assetId("FL-04"),
          insightType: "underutilized_equipment",
          severity: "warning",
          title: "Two forklifts are barely used",
          description:
            "FL-04 and FL-05 stayed near 14% and 16% utilization. FL-01 through FL-03 stayed between 68% and 74%.",
          recommendedAction:
            "Reassign FL-04 and FL-05 to shipping during the afternoon dwell peak.",
          estimatedFinancialImpact: "6400.00",
          currency: "USD",
          confidence: "0.7400",
          evidence: evidence(
            "Daily forklift utilization for 30 days.",
            "FL-05 utilization is 16%.",
            "Reassign the idle trucks before buying another.",
          ),
          status: "open",
          createdAt: days[29],
        },
        {
          id: deterministicUuid("insight:docks"),
          organizationId,
          facilityId,
          areaId: areaId("shipping"),
          assetId: assetId("DK-03"),
          insightType: "rising_dwell_time",
          severity: "warning",
          title: "Loading-dock dwell is rising",
          description:
            "Average dock dwell moved from about 24 minutes on the first seeded day to about 70 minutes on the last.",
          recommendedAction:
            "Pair an underused forklift with the docks and review appointment spacing.",
          estimatedFinancialImpact: "9100.00",
          currency: "USD",
          confidence: "0.7000",
          evidence: evidence(
            "Daily dwell_time_minutes for DK-01 through DK-06.",
            "The series rises by roughly 46 minutes across 30 days.",
            "Treat the trend as observed. The savings figure is estimated.",
          ),
          status: "open",
          createdAt: days[29],
        },
        {
          id: deterministicUuid("insight:cv-02"),
          organizationId,
          facilityId,
          areaId: areaId("packing"),
          assetId: assetId("CV-02"),
          insightType: "rising_maintenance_cost",
          severity: "warning",
          title: "Conveyor CV-02 maintenance cost is climbing",
          description:
            "CV-02 maintenance rose from $40 to $240 per day. CV-01 and CV-03 stayed at $35, and downtime on CV-02 rose with the cost.",
          recommendedAction: "Schedule a planned repair and compare it with a capacity upgrade.",
          estimatedFinancialImpact: "4800.00",
          currency: "USD",
          confidence: "0.7600",
          evidence: evidence(
            "Asset-level maintenance amounts. Facility building maintenance is a separate $180 row and is not included here.",
            "Last-day CV-02 maintenance is six times the first day.",
            "Do not book the estimated impact as a verified saving.",
          ),
          status: "open",
          createdAt: days[29],
        },
        {
          id: deterministicUuid("insight:receiving"),
          organizationId,
          facilityId,
          areaId: areaId("receiving"),
          insightType: "stable_operations",
          severity: "info",
          title: "Receiving is inside its target band",
          description:
            "Receiving utilization held at 58% with no capacity or downtime alerts. It is a useful contrast to Aisle 04 and PS-02.",
          recommendedAction: "Keep the current receiving staffing plan.",
          estimatedFinancialImpact: null,
          currency: "USD",
          confidence: "0.8800",
          evidence: evidence(
            "Area utilization for Receiving.",
            "Utilization is flat at 58%.",
            "No financial estimate is claimed.",
          ),
          status: "open",
          createdAt: days[29],
        },
      ]);

      const scenarioRows = [
        {
          key: "add-packing-station",
          name: "Add a packing station",
          description: "Model one additional station beside PS-02 to absorb the queued orders.",
          status: "active" as const,
          configuration: {
            kind: "add_packing_station",
            parameters: {
              additionalStations: 1,
              referenceAssetId: assetId("PS-02"),
              modeledMonthlyCostPerStation: 4200,
              modeledInvestment: 85000,
            },
          },
          baseline: {
            basis: "observed",
            note: "Replaced when the scenario is run against stored metrics.",
          },
          projected: {
            basis: "modeled",
            note: "Replaced when the scenario is run. Seed placeholder only.",
          },
          savings: null as string | null,
          assumptions:
            "Run the scenario to replace this seed placeholder with calculated baseline and modeled projection.",
        },
        {
          key: "reassign-forklifts",
          name: "Reassign idle forklifts",
          description: "Move FL-04 and FL-05 from staging to the shipping docks in the afternoon.",
          status: "active" as const,
          configuration: {
            kind: "reassign_equipment",
            parameters: {
              assetIds: [assetId("FL-04"), assetId("FL-05")],
              destinationAreaId: areaId("shipping"),
              modeledCostPerDwellMinute: 2.5,
            },
          },
          baseline: {
            basis: "observed",
            note: "Replaced when the scenario is run against stored metrics.",
          },
          projected: {
            basis: "modeled",
            note: "Replaced when the scenario is run. Seed placeholder only.",
          },
          savings: null as string | null,
          assumptions:
            "Run the scenario to replace this seed placeholder with calculated baseline and modeled projection.",
        },
        {
          key: "conveyor-repair",
          name: "Repair conveyor CV-02",
          description: "Compare a planned repair against continued reactive maintenance on CV-02.",
          status: "draft" as const,
          configuration: {
            kind: "reduce_downtime",
            parameters: {
              assetId: assetId("CV-02"),
              targetDowntimeMinutesPerDay: 12,
              modeledRepairCost: 4800,
            },
          },
          baseline: {
            basis: "observed",
            note: "Replaced when the scenario is run against stored metrics.",
          },
          projected: {
            basis: "modeled",
            note: "Replaced when the scenario is run. Seed placeholder only.",
          },
          savings: null as string | null,
          assumptions:
            "Run the scenario to replace this seed placeholder with calculated baseline and modeled projection.",
        },
      ];

      await tx.insert(schema.scenarios).values(
        scenarioRows.map((scenario) => ({
          id: deterministicUuid(`scenario:${scenario.key}`),
          organizationId,
          facilityId,
          name: scenario.name,
          description: scenario.description,
          status: scenario.status,
          configuration: scenario.configuration,
          createdBy: userId("operations@acme.example"),
          createdAt: SEEDED_AT,
          updatedAt: SEEDED_AT,
        })),
      );

      await tx.insert(schema.scenarioResults).values(
        scenarioRows.map((scenario) => ({
          id: deterministicUuid(`scenario-result:${scenario.key}`),
          organizationId,
          scenarioId: deterministicUuid(`scenario:${scenario.key}`),
          baselineMetrics: scenario.baseline,
          projectedMetrics: scenario.projected,
          estimatedSavings: scenario.savings,
          currency: "USD",
          assumptions: {
            text: scenario.assumptions,
            modeled: true,
            observed: false,
          },
          calculatedAt: days[29]!,
        })),
      );

      await tx.insert(schema.auditLogs).values({
        id: deterministicUuid("audit:seeded"),
        organizationId,
        actorUserId: userId("admin@acme.example"),
        action: "organization.seeded",
        entityType: "organization",
        entityId: organizationId,
        metadata: { slug: ORG_SLUG, periodEnd: PERIOD_END },
        createdAt: SEEDED_AT,
      });

      await tx.insert(schema.importJobs).values({
        id: deterministicUuid("import:layout"),
        organizationId,
        facilityId,
        sourceType: "seed_layout",
        status: "succeeded",
        summary: { layoutVersion: 1, assets: assets.length },
        createdBy: userId("operations@acme.example"),
        createdAt: SEEDED_AT,
        completedAt: SEEDED_AT,
      });

      await tx.insert(schema.backgroundJobs).values({
        id: deterministicUuid("job:noop"),
        organizationId,
        jobType: "noop",
        payload: { note: "Phase 1 placeholder. Handlers log and complete." },
        status: "queued",
        attempts: 0,
        runAfter: SEEDED_AT,
        createdAt: SEEDED_AT,
        updatedAt: SEEDED_AT,
      });
    });
  } finally {
    await pool.end();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  seedDatabase()
    .then(() => {
      console.log("Seeded Acme Manufacturing / West Distribution Center.");
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
