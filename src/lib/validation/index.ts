import { z } from "zod";

import { ROLES } from "@/lib/permissions";

export const loginSchema = z.object({
  email: z
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(200),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export const uuidSchema = z.uuid();

export const organizationUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

export const memberRoleSchema = z.object({
  memberId: z.uuid(),
  role: z.enum(ROLES),
});

export const assetListSchema = paginationSchema.extend({
  assetType: z
    .enum(["storage_rack", "pallet", "loading_dock", "packing_station", "conveyor", "forklift"])
    .optional(),
  status: z.enum(["active", "inactive", "maintenance", "retired"]).optional(),
  areaId: z.uuid().optional(),
  sort: z.enum(["name", "createdAt"]).default("name"),
});

export const metricListSchema = paginationSchema.extend({
  metricType: z
    .enum([
      "orders_processed",
      "units_processed",
      "operating_hours",
      "utilization",
      "busy_minutes",
      "available_minutes",
      "cycle_time_minutes",
      "downtime_minutes",
      "dwell_time_minutes",
      "bottleneck_severity",
    ])
    .optional(),
  sort: z.enum(["recordedAt"]).default("recordedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const financialListSchema = paginationSchema.extend({
  costCategory: z.enum(["labor", "maintenance", "energy", "equipment", "overhead"]).optional(),
  sort: z.enum(["periodStart", "amount"]).default("periodStart"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export function parseSearchParams<T>(url: URL, schema: z.ZodType<T>) {
  const raw = Object.fromEntries(url.searchParams.entries());
  return schema.parse(raw);
}
