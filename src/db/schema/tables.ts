import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  areaTypeEnum,
  assetStatusEnum,
  assetTypeEnum,
  costCategoryEnum,
  eventSeverityEnum,
  eventTypeEnum,
  facilityTypeEnum,
  fileStatusEnum,
  importStatusEnum,
  insightStatusEnum,
  insightTypeEnum,
  integrationProviderEnum,
  integrationStatusEnum,
  jobStatusEnum,
  jobTypeEnum,
  metricTypeEnum,
  organizationRoleEnum,
  scenarioStatusEnum,
} from "./enums";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

const money = (name: string) => numeric(name, { precision: 15, scale: 2 });
const measure = (name: string) => numeric(name, { precision: 18, scale: 4 });
const currency = () => text("currency").notNull().default("USD");

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    email: text("email").notNull(),
    emailVerified: timestamp("email_verified", { withTimezone: true, mode: "date" }),
    image: text("image"),
    passwordHash: text("password_hash"),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    uniqueIndex("accounts_provider_account_unique").on(table.provider, table.providerAccountId),
    index("accounts_user_id_idx").on(table.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionToken: text("session_token").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    uniqueIndex("sessions_session_token_unique").on(table.sessionToken),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("organizations_slug_unique").on(table.slug)],
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: organizationRoleEnum("role").notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("organization_members_org_user_unique").on(table.organizationId, table.userId),
    index("organization_members_user_id_idx").on(table.userId),
    index("organization_members_organization_id_idx").on(table.organizationId),
  ],
);

export const facilities = pgTable(
  "facilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    location: text("location"),
    facilityType: facilityTypeEnum("facility_type").notNull().default("warehouse"),
    squareFootage: numeric("square_footage", { precision: 12, scale: 2 }),
    timezone: text("timezone").notNull().default("America/Los_Angeles"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    index("facilities_organization_id_idx").on(table.organizationId),
    uniqueIndex("facilities_organization_name_unique").on(table.organizationId, table.name),
  ],
);

export const facilityAreas = pgTable(
  "facility_areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    areaType: areaTypeEnum("area_type").notNull(),
    positionX: measure("position_x").notNull().default("0"),
    positionY: measure("position_y").notNull().default("0"),
    positionZ: measure("position_z").notNull().default("0"),
    width: measure("width").notNull().default("1"),
    height: measure("height").notNull().default("1"),
    depth: measure("depth").notNull().default("1"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    index("facility_areas_facility_id_idx").on(table.facilityId),
    index("facility_areas_organization_id_idx").on(table.organizationId),
  ],
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    areaId: uuid("area_id").references(() => facilityAreas.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    assetType: assetTypeEnum("asset_type").notNull(),
    status: assetStatusEnum("status").notNull().default("active"),
    modelUrl: text("model_url"),
    positionX: measure("position_x").notNull().default("0"),
    positionY: measure("position_y").notNull().default("0"),
    positionZ: measure("position_z").notNull().default("0"),
    rotationX: measure("rotation_x").notNull().default("0"),
    rotationY: measure("rotation_y").notNull().default("0"),
    rotationZ: measure("rotation_z").notNull().default("0"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    index("assets_facility_id_idx").on(table.facilityId),
    index("assets_area_id_idx").on(table.areaId),
    index("assets_organization_id_idx").on(table.organizationId),
    index("assets_facility_type_idx").on(table.facilityId, table.assetType),
  ],
);

export const facilityLayouts = pgTable(
  "facility_layouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    version: integer("version").notNull(),
    layoutData: jsonb("layout_data").$type<Record<string, unknown>>().notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("facility_layouts_facility_version_unique").on(table.facilityId, table.version),
    index("facility_layouts_organization_id_idx").on(table.organizationId),
  ],
);

export const operationalMetrics = pgTable(
  "operational_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    areaId: uuid("area_id").references(() => facilityAreas.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "cascade" }),
    metricType: metricTypeEnum("metric_type").notNull(),
    metricValue: measure("metric_value").notNull(),
    unit: text("unit").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    index("operational_metrics_org_recorded_idx").on(table.organizationId, table.recordedAt),
    index("operational_metrics_facility_recorded_idx").on(table.facilityId, table.recordedAt),
    index("operational_metrics_asset_recorded_idx").on(table.assetId, table.recordedAt),
    index("operational_metrics_area_recorded_idx").on(table.areaId, table.recordedAt),
  ],
);

export const assetEvents = pgTable(
  "asset_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    areaId: uuid("area_id").references(() => facilityAreas.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "cascade" }),
    eventType: eventTypeEnum("event_type").notNull(),
    severity: eventSeverityEnum("severity").notNull(),
    description: text("description").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    index("asset_events_org_occurred_idx").on(table.organizationId, table.occurredAt),
    index("asset_events_asset_id_idx").on(table.assetId),
    check(
      "asset_events_has_target",
      sql`${table.assetId} is not null or ${table.areaId} is not null`,
    ),
  ],
);

export const financialMetrics = pgTable(
  "financial_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    areaId: uuid("area_id").references(() => facilityAreas.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "cascade" }),
    costCategory: costCategoryEnum("cost_category").notNull(),
    amount: money("amount").notNull(),
    currency: currency(),
    periodStart: timestamp("period_start", { withTimezone: true, mode: "date" }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true, mode: "date" }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    index("financial_metrics_org_period_idx").on(table.organizationId, table.periodStart),
    index("financial_metrics_facility_period_idx").on(table.facilityId, table.periodStart),
    index("financial_metrics_asset_period_idx").on(table.assetId, table.periodStart),
  ],
);

export const scenarios = pgTable(
  "scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: scenarioStatusEnum("status").notNull().default("draft"),
    configuration: jsonb("configuration").$type<Record<string, unknown>>().notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("scenarios_organization_id_idx").on(table.organizationId),
    index("scenarios_facility_id_idx").on(table.facilityId),
  ],
);

export const scenarioResults = pgTable(
  "scenario_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    baselineMetrics: jsonb("baseline_metrics").$type<Record<string, unknown>>().notNull(),
    projectedMetrics: jsonb("projected_metrics").$type<Record<string, unknown>>().notNull(),
    estimatedSavings: money("estimated_savings"),
    currency: currency(),
    assumptions: jsonb("assumptions").$type<Record<string, unknown>>().notNull(),
    calculatedAt: timestamp("calculated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    index("scenario_results_scenario_id_idx").on(table.scenarioId),
    index("scenario_results_organization_id_idx").on(table.organizationId),
  ],
);

export const insights = pgTable(
  "insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    areaId: uuid("area_id").references(() => facilityAreas.id, { onDelete: "set null" }),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
    insightType: insightTypeEnum("insight_type").notNull(),
    severity: eventSeverityEnum("severity").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    recommendedAction: text("recommended_action"),
    estimatedFinancialImpact: money("estimated_financial_impact"),
    currency: currency(),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull(),
    status: insightStatusEnum("status").notNull().default("open"),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    index("insights_organization_facility_idx").on(table.organizationId, table.facilityId),
    index("insights_status_idx").on(table.organizationId, table.status),
  ],
);

export const uploadedFiles = pgTable(
  "uploaded_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    checksum: text("checksum"),
    status: fileStatusEnum("status").notNull().default("pending"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("uploaded_files_object_key_unique").on(table.bucket, table.objectKey),
    index("uploaded_files_organization_id_idx").on(table.organizationId),
  ],
);

export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    fileId: uuid("file_id").references(() => uploadedFiles.id, { onDelete: "set null" }),
    sourceType: text("source_type").notNull(),
    status: importStatusEnum("status").notNull().default("queued"),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
    error: text("error"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamps.createdAt,
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [index("import_jobs_organization_id_idx").on(table.organizationId)],
);

export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    provider: integrationProviderEnum("provider").notNull(),
    status: integrationStatusEnum("status").notNull().default("active"),
    externalReference: text("external_reference"),
    ...timestamps,
  },
  (table) => [
    index("integrations_organization_id_idx").on(table.organizationId),
    uniqueIndex("integrations_organization_name_unique").on(table.organizationId, table.name),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    index("audit_logs_organization_created_idx").on(table.organizationId, table.createdAt),
  ],
);

export const backgroundJobs = pgTable(
  "background_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    jobType: jobTypeEnum("job_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: jobStatusEnum("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    runAfter: timestamp("run_after", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "date" }),
    lockedBy: text("locked_by"),
    lastError: text("last_error"),
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("background_jobs_status_run_after_idx").on(table.status, table.runAfter),
    index("background_jobs_organization_id_idx").on(table.organizationId),
  ],
);
