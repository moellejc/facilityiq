CREATE TYPE "public"."integration_provider" AS ENUM('sap', 'custom');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"status" "integration_status" DEFAULT 'active' NOT NULL,
	"external_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integrations_organization_id_idx" ON "integrations" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_organization_name_unique" ON "integrations" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "facilities_organization_name_unique" ON "facilities" USING btree ("organization_id","name");--> statement-breakpoint
ALTER TABLE "integrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "integrations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "integrations";--> statement-breakpoint
CREATE POLICY tenant_isolation ON "integrations"
  USING (organization_id = app.current_org_id())
  WITH CHECK (organization_id = app.current_org_id());--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "integrations" TO facilityiq_app, facilityiq_worker;