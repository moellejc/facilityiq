-- Local-development database roles. Passwords match .env.example.
-- Rotate them before any shared or production deployment.
-- facilityiq_worker has BYPASSRLS so it can dequeue jobs across organizations.
-- facilityiq_app does not. Superusers still bypass row-level security.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'facilityiq_app') THEN
    CREATE ROLE facilityiq_app LOGIN PASSWORD 'facilityiq_app_dev' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  ELSE
    ALTER ROLE facilityiq_app WITH LOGIN PASSWORD 'facilityiq_app_dev' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'facilityiq_worker') THEN
    CREATE ROLE facilityiq_worker LOGIN PASSWORD 'facilityiq_worker_dev' NOSUPERUSER BYPASSRLS NOCREATEDB NOCREATEROLE;
  ELSE
    ALTER ROLE facilityiq_worker WITH LOGIN PASSWORD 'facilityiq_worker_dev' NOSUPERUSER BYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS app;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.current_org_id() RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_organization_id', true), '')::uuid
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.assert_facility_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  parent_org uuid;
BEGIN
  IF NEW.facility_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT organization_id INTO parent_org FROM facilities WHERE id = NEW.facility_id;
  IF parent_org IS NULL THEN
    RAISE EXCEPTION 'facility % not found', NEW.facility_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM parent_org THEN
    RAISE EXCEPTION 'organization_id does not match facility organization'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.assert_asset_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  parent_org uuid;
  area_facility uuid;
  area_org uuid;
BEGIN
  SELECT organization_id INTO parent_org FROM facilities WHERE id = NEW.facility_id;
  IF parent_org IS NULL THEN
    RAISE EXCEPTION 'facility % not found', NEW.facility_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM parent_org THEN
    RAISE EXCEPTION 'organization_id does not match facility organization'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.area_id IS NOT NULL THEN
    SELECT facility_id, organization_id INTO area_facility, area_org
    FROM facility_areas WHERE id = NEW.area_id;
    IF area_facility IS NULL THEN
      RAISE EXCEPTION 'area % not found', NEW.area_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF area_facility IS DISTINCT FROM NEW.facility_id OR area_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'area does not belong to the asset facility'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.assert_metric_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  parent_org uuid;
  area_facility uuid;
  area_org uuid;
  asset_facility uuid;
  asset_org uuid;
BEGIN
  SELECT organization_id INTO parent_org FROM facilities WHERE id = NEW.facility_id;
  IF parent_org IS NULL THEN
    RAISE EXCEPTION 'facility % not found', NEW.facility_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM parent_org THEN
    RAISE EXCEPTION 'organization_id does not match facility organization'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.area_id IS NOT NULL THEN
    SELECT facility_id, organization_id INTO area_facility, area_org
    FROM facility_areas WHERE id = NEW.area_id;
    IF area_facility IS NULL OR area_facility IS DISTINCT FROM NEW.facility_id OR area_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'area does not belong to the metric facility'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.asset_id IS NOT NULL THEN
    SELECT facility_id, organization_id INTO asset_facility, asset_org
    FROM assets WHERE id = NEW.asset_id;
    IF asset_facility IS NULL OR asset_facility IS DISTINCT FROM NEW.facility_id OR asset_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'asset does not belong to the metric facility'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.assert_scenario_result_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  parent_org uuid;
BEGIN
  SELECT organization_id INTO parent_org FROM scenarios WHERE id = NEW.scenario_id;
  IF parent_org IS NULL THEN
    RAISE EXCEPTION 'scenario % not found', NEW.scenario_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM parent_org THEN
    RAISE EXCEPTION 'organization_id does not match scenario organization'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'facilities',
    'facility_areas',
    'assets',
    'facility_layouts',
    'operational_metrics',
    'asset_events',
    'financial_metrics',
    'scenarios',
    'scenario_results',
    'insights',
    'uploaded_files',
    'import_jobs',
    'audit_logs',
    'background_jobs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (organization_id = app.current_org_id()) WITH CHECK (organization_id = app.current_org_id())',
      table_name
    );
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON organizations;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON organizations
  USING (
    id = app.current_org_id()
    OR EXISTS (
      SELECT 1 FROM organization_members AS member
      WHERE member.organization_id = organizations.id
        AND member.user_id = app.current_user_id()
    )
  )
  WITH CHECK (
    id = app.current_org_id()
    OR EXISTS (
      SELECT 1 FROM organization_members AS member
      WHERE member.organization_id = organizations.id
        AND member.user_id = app.current_user_id()
    )
  );
--> statement-breakpoint
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON organization_members;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON organization_members
  USING (
    user_id = app.current_user_id()
    OR organization_id = app.current_org_id()
  )
  WITH CHECK (organization_id = app.current_org_id());
--> statement-breakpoint
DROP TRIGGER IF EXISTS facility_areas_org ON facility_areas;
--> statement-breakpoint
CREATE TRIGGER facility_areas_org BEFORE INSERT OR UPDATE ON facility_areas
  FOR EACH ROW EXECUTE FUNCTION app.assert_facility_org();
--> statement-breakpoint
DROP TRIGGER IF EXISTS assets_refs ON assets;
--> statement-breakpoint
CREATE TRIGGER assets_refs BEFORE INSERT OR UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION app.assert_asset_refs();
--> statement-breakpoint
DROP TRIGGER IF EXISTS layouts_org ON facility_layouts;
--> statement-breakpoint
CREATE TRIGGER layouts_org BEFORE INSERT OR UPDATE ON facility_layouts
  FOR EACH ROW EXECUTE FUNCTION app.assert_facility_org();
--> statement-breakpoint
DROP TRIGGER IF EXISTS operational_metrics_refs ON operational_metrics;
--> statement-breakpoint
CREATE TRIGGER operational_metrics_refs BEFORE INSERT OR UPDATE ON operational_metrics
  FOR EACH ROW EXECUTE FUNCTION app.assert_metric_refs();
--> statement-breakpoint
DROP TRIGGER IF EXISTS financial_metrics_refs ON financial_metrics;
--> statement-breakpoint
CREATE TRIGGER financial_metrics_refs BEFORE INSERT OR UPDATE ON financial_metrics
  FOR EACH ROW EXECUTE FUNCTION app.assert_metric_refs();
--> statement-breakpoint
DROP TRIGGER IF EXISTS asset_events_org ON asset_events;
--> statement-breakpoint
CREATE TRIGGER asset_events_org BEFORE INSERT OR UPDATE ON asset_events
  FOR EACH ROW EXECUTE FUNCTION app.assert_facility_org();
--> statement-breakpoint
DROP TRIGGER IF EXISTS scenarios_org ON scenarios;
--> statement-breakpoint
CREATE TRIGGER scenarios_org BEFORE INSERT OR UPDATE ON scenarios
  FOR EACH ROW EXECUTE FUNCTION app.assert_facility_org();
--> statement-breakpoint
DROP TRIGGER IF EXISTS scenario_results_org ON scenario_results;
--> statement-breakpoint
CREATE TRIGGER scenario_results_org BEFORE INSERT OR UPDATE ON scenario_results
  FOR EACH ROW EXECUTE FUNCTION app.assert_scenario_result_org();
--> statement-breakpoint
DROP TRIGGER IF EXISTS insights_org ON insights;
--> statement-breakpoint
CREATE TRIGGER insights_org BEFORE INSERT OR UPDATE ON insights
  FOR EACH ROW EXECUTE FUNCTION app.assert_facility_org();
--> statement-breakpoint
DROP TRIGGER IF EXISTS uploaded_files_org ON uploaded_files;
--> statement-breakpoint
CREATE TRIGGER uploaded_files_org BEFORE INSERT OR UPDATE ON uploaded_files
  FOR EACH ROW EXECUTE FUNCTION app.assert_facility_org();
--> statement-breakpoint
DROP TRIGGER IF EXISTS import_jobs_org ON import_jobs;
--> statement-breakpoint
CREATE TRIGGER import_jobs_org BEFORE INSERT OR UPDATE ON import_jobs
  FOR EACH ROW EXECUTE FUNCTION app.assert_facility_org();
--> statement-breakpoint
DO $$
BEGIN
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO facilityiq_app, facilityiq_worker',
    current_database()
  );
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO facilityiq_app, facilityiq_worker;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO facilityiq_app, facilityiq_worker;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO facilityiq_app, facilityiq_worker;
--> statement-breakpoint
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO facilityiq_app, facilityiq_worker;
