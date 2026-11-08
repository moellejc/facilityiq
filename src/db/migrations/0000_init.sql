CREATE TYPE "public"."area_type" AS ENUM('receiving', 'aisle', 'packing', 'shipping', 'staging', 'returns', 'maintenance', 'office');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('active', 'inactive', 'maintenance', 'retired');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('storage_rack', 'pallet', 'loading_dock', 'packing_station', 'conveyor', 'forklift');--> statement-breakpoint
CREATE TYPE "public"."cost_category" AS ENUM('labor', 'maintenance', 'energy', 'equipment', 'overhead');--> statement-breakpoint
CREATE TYPE "public"."event_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('alert', 'maintenance', 'downtime', 'dwell', 'capacity', 'utilization');--> statement-breakpoint
CREATE TYPE "public"."facility_type" AS ENUM('warehouse', 'distribution_center', 'plant', 'other');--> statement-breakpoint
CREATE TYPE "public"."file_status" AS ENUM('pending', 'uploaded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."insight_status" AS ENUM('open', 'acknowledged', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."insight_type" AS ENUM('excessive_utilization', 'capacity_constraint', 'underutilized_equipment', 'rising_dwell_time', 'rising_maintenance_cost', 'stable_operations');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('noop', 'insight_generation', 'metric_rollup', 'model_processing', 'model_conversion');--> statement-breakpoint
CREATE TYPE "public"."metric_type" AS ENUM('orders_processed', 'units_processed', 'operating_hours', 'utilization', 'busy_minutes', 'available_minutes', 'cycle_time_minutes', 'downtime_minutes', 'dwell_time_minutes', 'bottleneck_severity');--> statement-breakpoint
CREATE TYPE "public"."organization_role" AS ENUM('org_admin', 'operations_manager', 'finance_manager', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."scenario_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "asset_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"area_id" uuid,
	"asset_id" uuid,
	"event_type" "event_type" NOT NULL,
	"severity" "event_severity" NOT NULL,
	"description" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "asset_events_has_target" CHECK ("asset_events"."asset_id" is not null or "asset_events"."area_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"area_id" uuid,
	"name" text NOT NULL,
	"asset_type" "asset_type" NOT NULL,
	"status" "asset_status" DEFAULT 'active' NOT NULL,
	"model_url" text,
	"position_x" numeric(18, 4) DEFAULT '0' NOT NULL,
	"position_y" numeric(18, 4) DEFAULT '0' NOT NULL,
	"position_z" numeric(18, 4) DEFAULT '0' NOT NULL,
	"rotation_x" numeric(18, 4) DEFAULT '0' NOT NULL,
	"rotation_y" numeric(18, 4) DEFAULT '0' NOT NULL,
	"rotation_z" numeric(18, 4) DEFAULT '0' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "background_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"job_type" "job_type" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"facility_type" "facility_type" DEFAULT 'warehouse' NOT NULL,
	"square_footage" numeric(12, 2),
	"timezone" text DEFAULT 'America/Los_Angeles' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"name" text NOT NULL,
	"area_type" "area_type" NOT NULL,
	"position_x" numeric(18, 4) DEFAULT '0' NOT NULL,
	"position_y" numeric(18, 4) DEFAULT '0' NOT NULL,
	"position_z" numeric(18, 4) DEFAULT '0' NOT NULL,
	"width" numeric(18, 4) DEFAULT '1' NOT NULL,
	"height" numeric(18, 4) DEFAULT '1' NOT NULL,
	"depth" numeric(18, 4) DEFAULT '1' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"name" text NOT NULL,
	"version" integer NOT NULL,
	"layout_data" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"area_id" uuid,
	"asset_id" uuid,
	"cost_category" "cost_category" NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"facility_id" uuid,
	"file_id" uuid,
	"source_type" text NOT NULL,
	"status" "import_status" DEFAULT 'queued' NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"area_id" uuid,
	"asset_id" uuid,
	"insight_type" "insight_type" NOT NULL,
	"severity" "event_severity" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"recommended_action" text,
	"estimated_financial_impact" numeric(15, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"confidence" numeric(5, 4),
	"evidence" jsonb NOT NULL,
	"status" "insight_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operational_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"area_id" uuid,
	"asset_id" uuid,
	"metric_type" "metric_type" NOT NULL,
	"metric_value" numeric(18, 4) NOT NULL,
	"unit" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "organization_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"scenario_id" uuid NOT NULL,
	"baseline_metrics" jsonb NOT NULL,
	"projected_metrics" jsonb NOT NULL,
	"estimated_savings" numeric(15, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"assumptions" jsonb NOT NULL,
	"calculated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "scenario_status" DEFAULT 'draft' NOT NULL,
	"configuration" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"facility_id" uuid,
	"asset_id" uuid,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"checksum" text,
	"status" "file_status" DEFAULT 'pending' NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_events" ADD CONSTRAINT "asset_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_events" ADD CONSTRAINT "asset_events_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_events" ADD CONSTRAINT "asset_events_area_id_facility_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."facility_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_events" ADD CONSTRAINT "asset_events_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_area_id_facility_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."facility_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_areas" ADD CONSTRAINT "facility_areas_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_areas" ADD CONSTRAINT "facility_areas_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_layouts" ADD CONSTRAINT "facility_layouts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_layouts" ADD CONSTRAINT "facility_layouts_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_layouts" ADD CONSTRAINT "facility_layouts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_metrics" ADD CONSTRAINT "financial_metrics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_metrics" ADD CONSTRAINT "financial_metrics_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_metrics" ADD CONSTRAINT "financial_metrics_area_id_facility_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."facility_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_metrics" ADD CONSTRAINT "financial_metrics_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_file_id_uploaded_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_area_id_facility_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."facility_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_metrics" ADD CONSTRAINT "operational_metrics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_metrics" ADD CONSTRAINT "operational_metrics_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_metrics" ADD CONSTRAINT "operational_metrics_area_id_facility_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."facility_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_metrics" ADD CONSTRAINT "operational_metrics_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_results" ADD CONSTRAINT "scenario_results_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_results" ADD CONSTRAINT "scenario_results_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_unique" ON "accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "asset_events_org_occurred_idx" ON "asset_events" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "asset_events_asset_id_idx" ON "asset_events" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "assets_facility_id_idx" ON "assets" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "assets_area_id_idx" ON "assets" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "assets_organization_id_idx" ON "assets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "assets_facility_type_idx" ON "assets" USING btree ("facility_id","asset_type");--> statement-breakpoint
CREATE INDEX "audit_logs_organization_created_idx" ON "audit_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "background_jobs_status_run_after_idx" ON "background_jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "background_jobs_organization_id_idx" ON "background_jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "facilities_organization_id_idx" ON "facilities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "facility_areas_facility_id_idx" ON "facility_areas" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "facility_areas_organization_id_idx" ON "facility_areas" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "facility_layouts_facility_version_unique" ON "facility_layouts" USING btree ("facility_id","version");--> statement-breakpoint
CREATE INDEX "facility_layouts_organization_id_idx" ON "facility_layouts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "financial_metrics_org_period_idx" ON "financial_metrics" USING btree ("organization_id","period_start");--> statement-breakpoint
CREATE INDEX "financial_metrics_facility_period_idx" ON "financial_metrics" USING btree ("facility_id","period_start");--> statement-breakpoint
CREATE INDEX "financial_metrics_asset_period_idx" ON "financial_metrics" USING btree ("asset_id","period_start");--> statement-breakpoint
CREATE INDEX "import_jobs_organization_id_idx" ON "import_jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "insights_organization_facility_idx" ON "insights" USING btree ("organization_id","facility_id");--> statement-breakpoint
CREATE INDEX "insights_status_idx" ON "insights" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "operational_metrics_org_recorded_idx" ON "operational_metrics" USING btree ("organization_id","recorded_at");--> statement-breakpoint
CREATE INDEX "operational_metrics_facility_recorded_idx" ON "operational_metrics" USING btree ("facility_id","recorded_at");--> statement-breakpoint
CREATE INDEX "operational_metrics_asset_recorded_idx" ON "operational_metrics" USING btree ("asset_id","recorded_at");--> statement-breakpoint
CREATE INDEX "operational_metrics_area_recorded_idx" ON "operational_metrics" USING btree ("area_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_unique" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_id_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organization_members_organization_id_idx" ON "organization_members" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "scenario_results_scenario_id_idx" ON "scenario_results" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "scenario_results_organization_id_idx" ON "scenario_results" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scenarios_organization_id_idx" ON "scenarios" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scenarios_facility_id_idx" ON "scenarios" USING btree ("facility_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_session_token_unique" ON "sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uploaded_files_object_key_unique" ON "uploaded_files" USING btree ("bucket","object_key");--> statement-breakpoint
CREATE INDEX "uploaded_files_organization_id_idx" ON "uploaded_files" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");