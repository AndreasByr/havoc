-- Hotfix: Migrate legacy "applications" table to the new schema expected by HEAD code.
--
-- Context: Migration 0044 used CREATE TABLE IF NOT EXISTS "applications", which is a no-op
-- when the table already exists (created by the old auto-migrate plugin). The subsequent
-- CREATE INDEX … ON "applications" ("discord_id") then fails because the column doesn't
-- exist, rolling back the entire 0044 transaction and all subsequent migrations (0045–0047).
--
-- This migration is fully idempotent: if the new columns already exist, every step is a no-op.
-- On fresh DBs (where 0044 created the table with the correct schema), this entire migration
-- is a no-op because all columns already exist.
-- On legacy DBs (where the table has old columns), it migrates the schema safely.

-- ============================================================================
-- Step 1: Detect if migration is needed (legacy schema with old columns)
--         If discord_id already exists as NOT NULL, skip everything.
-- ============================================================================

DO $$
DECLARE
  has_discord_id boolean;
  has_user_id boolean;
  has_answers boolean;
  has_reviewer_id boolean;
BEGIN
  -- Check if discord_id column exists and is NOT NULL (new schema)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'discord_id' AND is_nullable = 'NO'
  ) INTO has_discord_id;

  -- Already migrated — nothing to do
  IF has_discord_id THEN
    RAISE NOTICE 'applications.discord_id already exists as NOT NULL — skipping migration';
    RETURN;
  END IF;

  -- Check which old columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'user_id'
  ) INTO has_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'answers'
  ) INTO has_answers;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'reviewer_id'
  ) INTO has_reviewer_id;

  -- If no old columns AND no new columns, this is a weird state — skip
  IF NOT has_user_id AND NOT has_discord_id THEN
    RAISE NOTICE 'No legacy columns found and no discord_id — unexpected state, skipping';
    RETURN;
  END IF;

  RAISE NOTICE 'Legacy schema detected — migrating applications table...';

  -- Add new columns (idempotent)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'discord_id') THEN
    ALTER TABLE "applications" ADD COLUMN "discord_id" text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'discord_username') THEN
    ALTER TABLE "applications" ADD COLUMN "discord_username" text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'discord_avatar_url') THEN
    ALTER TABLE "applications" ADD COLUMN "discord_avatar_url" text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'answers_json') THEN
    ALTER TABLE "applications" ADD COLUMN "answers_json" jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'roles_assigned') THEN
    ALTER TABLE "applications" ADD COLUMN "roles_assigned" jsonb DEFAULT '[]';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'pending_role_assignments') THEN
    ALTER TABLE "applications" ADD COLUMN "pending_role_assignments" jsonb DEFAULT '[]';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'display_name_composed') THEN
    ALTER TABLE "applications" ADD COLUMN "display_name_composed" text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'reviewed_by') THEN
    ALTER TABLE "applications" ADD COLUMN "reviewed_by" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL;
  END IF;

  -- Migrate data from old columns to new columns (only if old columns exist)
  IF has_user_id THEN
    -- Migrate user_id → discord_id via JOIN with users.discord_id
    -- Also grab discord_username from user_platform_accounts or users.display_name
    UPDATE "applications" a
    SET
      "discord_id" = u."discord_id",
      "discord_username" = COALESCE(upa."platform_username", u."display_name", 'unknown'),
      "discord_avatar_url" = upa."platform_avatar_url",
      "reviewed_by" = CASE WHEN has_reviewer_id THEN a."reviewer_id" ELSE a."reviewed_by" END
    FROM "users" u
    LEFT JOIN "user_platform_accounts" upa
      ON upa."user_id" = u."id"
      AND upa."platform" = 'discord'
      AND upa."is_primary" = true
    WHERE a."user_id" = u."id"
      AND a."discord_id" IS NULL;

    -- For any rows where user_id had no matching user (orphaned), set fallback values
    UPDATE "applications"
    SET
      "discord_id" = 'orphaned_user_' || "user_id"::text,
      "discord_username" = 'unknown'
    WHERE "discord_id" IS NULL
      AND "user_id" IS NOT NULL;
  END IF;

  -- Migrate answers → answers_json
  IF has_answers THEN
    UPDATE "applications"
    SET "answers_json" = "answers"
    WHERE "answers_json" IS NULL AND "answers" IS NOT NULL;
  END IF;

  -- Default empty object for any remaining NULL answers_json
  UPDATE "applications" SET "answers_json" = '{}'::jsonb WHERE "answers_json" IS NULL;

  -- Set NOT NULL constraints
  ALTER TABLE "applications" ALTER COLUMN "discord_id" SET NOT NULL;
  ALTER TABLE "applications" ALTER COLUMN "discord_username" SET NOT NULL;
  ALTER TABLE "applications" ALTER COLUMN "answers_json" SET NOT NULL;

  -- Fill missing discord_username with fallback
  UPDATE "applications" SET "discord_username" = 'unknown' WHERE "discord_username" IS NULL;

  -- Drop old columns
  IF has_reviewer_id THEN
    -- Migrate reviewer_id → reviewed_by first if not already done
    UPDATE "applications" SET "reviewed_by" = "reviewer_id"
    WHERE "reviewed_by" IS NULL AND "reviewer_id" IS NOT NULL;
    ALTER TABLE "applications" DROP COLUMN "reviewer_id";
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'review_note') THEN
    ALTER TABLE "applications" DROP COLUMN "review_note";
  END IF;

  IF has_user_id THEN
    -- Drop FK constraint on user_id if exists
    DECLARE
      fk_name text;
    BEGIN
      SELECT conname INTO fk_name
      FROM pg_constraint
      WHERE conrelid = 'applications'::regclass
        AND contype = 'f'
        AND conname LIKE '%user_id%'
      LIMIT 1;

      IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "applications" DROP CONSTRAINT ' || fk_name;
      END IF;
    END;

    ALTER TABLE "applications" DROP COLUMN "user_id";
  END IF;

  IF has_answers THEN
    ALTER TABLE "applications" DROP COLUMN "answers";
  END IF;

  RAISE NOTICE 'Legacy applications table migrated successfully';
END $$;

-- ============================================================================
-- Step 2: Create indexes (idempotent via IF NOT EXISTS)
-- These are safe because by this point discord_id is guaranteed to exist.
-- ============================================================================

CREATE INDEX IF NOT EXISTS "applications_flow_id_idx" ON "applications" ("flow_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_discord_id_idx" ON "applications" ("discord_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_status_idx" ON "applications" ("status");
