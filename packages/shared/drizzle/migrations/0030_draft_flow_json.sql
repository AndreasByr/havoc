DO $$ BEGIN
  ALTER TABLE "application_flows" ADD COLUMN IF NOT EXISTS "draft_flow_json" jsonb;
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'application_flows table does not exist yet — skipping column add';
END $$;
