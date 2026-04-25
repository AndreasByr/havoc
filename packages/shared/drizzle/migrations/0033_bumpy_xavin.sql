DO $$ BEGIN
  ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "ticket_channel_id" text;
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'applications table does not exist yet — skipping column add';
END $$;
