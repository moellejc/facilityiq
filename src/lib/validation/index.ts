import { z } from "zod";

import { FACILITY_TYPES } from "@/lib/facilities";
import { INTEGRATION_PROVIDERS, INTEGRATION_STATUSES } from "@/lib/integrations";
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

export const memberAddSchema = z.object({
  email: z
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  role: z.enum(ROLES),
});

export const memberRemoveSchema = z.object({
  memberId: z.uuid(),
});

const squareFootagePattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

export const squareFootageSchema = z
  .union([z.string(), z.number(), z.null()])
  .transform((value, ctx) => {
    if (value == null) return null;
    const trimmed = String(value).trim();
    if (trimmed === "") return null;
    if (!squareFootagePattern.test(trimmed)) {
      ctx.addIssue({ code: "custom", message: "Square footage is invalid." });
      return z.NEVER;
    }
    return trimmed;
  });

const nullableText = (max: number) =>
  z.union([z.string(), z.null()]).transform((value, ctx) => {
    if (value == null) return null;
    const trimmed = value.trim();
    if (trimmed === "") return null;
    if (trimmed.length > max) {
      ctx.addIssue({ code: "custom", message: "This value is too long." });
      return z.NEVER;
    }
    return trimmed;
  });

export const facilityCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  location: nullableText(200).optional(),
  facilityType: z.enum(FACILITY_TYPES).default("warehouse"),
  squareFootage: squareFootageSchema.optional(),
  timezone: z.string().trim().min(1).max(64).default("America/Los_Angeles"),
});

export const facilityUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    location: nullableText(200).optional(),
    facilityType: z.enum(FACILITY_TYPES).optional(),
    squareFootage: squareFootageSchema.optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field is required.",
  });

export const integrationCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  provider: z.enum(INTEGRATION_PROVIDERS),
  status: z.enum(INTEGRATION_STATUSES).default("active"),
  externalReference: nullableText(200).optional(),
});

export const integrationUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    provider: z.enum(INTEGRATION_PROVIDERS).optional(),
    status: z.enum(INTEGRATION_STATUSES).optional(),
    externalReference: nullableText(200).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field is required.",
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

export const attentionQuerySchema = z.object({
  attention: z.enum(["warning", "critical"]).optional(),
});

export function parseSearchParams<T>(url: URL, schema: z.ZodType<T>) {
  const raw = Object.fromEntries(url.searchParams.entries());
  return schema.parse(raw);
}
