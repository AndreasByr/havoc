DO $$ BEGIN
  CREATE TYPE "editor_mode" AS ENUM ('simple', 'advanced');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "application_flows" ADD COLUMN IF NOT EXISTS "editor_mode" "editor_mode" NOT NULL DEFAULT 'simple';

  -- Backfill: all existing flows were created in Advanced Mode
  UPDATE "application_flows" SET "editor_mode" = 'advanced';
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'application_flows table does not exist yet — skipping';
END $$;
