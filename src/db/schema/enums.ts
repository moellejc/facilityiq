import { pgEnum } from "drizzle-orm/pg-core";

export const organizationRoleEnum = pgEnum("organization_role", [
  "org_admin",
  "operations_manager",
  "finance_manager",
  "viewer",
]);

export const facilityTypeEnum = pgEnum("facility_type", [
  "warehouse",
  "distribution_center",
  "plant",
  "other",
]);

export const areaTypeEnum = pgEnum("area_type", [
  "receiving",
  "aisle",
  "packing",
  "shipping",
  "staging",
  "returns",
  "maintenance",
  "office",
]);

export const assetTypeEnum = pgEnum("asset_type", [
  "storage_rack",
  "pallet",
  "loading_dock",
  "packing_station",
  "conveyor",
  "forklift",
]);

export const assetStatusEnum = pgEnum("asset_status", [
  "active",
  "inactive",
  "maintenance",
  "retired",
]);

export const metricTypeEnum = pgEnum("metric_type", [
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
]);

export const eventSeverityEnum = pgEnum("event_severity", ["info", "warning", "critical"]);

export const eventTypeEnum = pgEnum("event_type", [
  "alert",
  "maintenance",
  "downtime",
  "dwell",
  "capacity",
  "utilization",
]);

export const costCategoryEnum = pgEnum("cost_category", [
  "labor",
  "maintenance",
  "energy",
  "equipment",
  "overhead",
]);

export const scenarioStatusEnum = pgEnum("scenario_status", ["draft", "active", "archived"]);

export const insightTypeEnum = pgEnum("insight_type", [
  "excessive_utilization",
  "capacity_constraint",
  "underutilized_equipment",
  "rising_dwell_time",
  "rising_maintenance_cost",
  "stable_operations",
]);

export const insightStatusEnum = pgEnum("insight_status", ["open", "acknowledged", "dismissed"]);

export const fileStatusEnum = pgEnum("file_status", ["pending", "uploaded", "failed"]);

export const importStatusEnum = pgEnum("import_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
]);

export const jobStatusEnum = pgEnum("job_status", ["queued", "running", "succeeded", "failed"]);

export const jobTypeEnum = pgEnum("job_type", [
  "noop",
  "insight_generation",
  "metric_rollup",
  "model_processing",
  "model_conversion",
]);
