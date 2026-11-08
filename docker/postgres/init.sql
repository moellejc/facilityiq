-- Runs once, when the Postgres volume is first created.
-- The migration also creates these roles so a non-Docker database can bootstrap itself.
-- Passwords are local-development only.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'facilityiq_app') THEN
    CREATE ROLE facilityiq_app LOGIN PASSWORD 'facilityiq_app_dev' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'facilityiq_worker') THEN
    CREATE ROLE facilityiq_worker LOGIN PASSWORD 'facilityiq_worker_dev' NOSUPERUSER BYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;
