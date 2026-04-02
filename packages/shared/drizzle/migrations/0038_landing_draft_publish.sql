-- Draft/publish status for landing sections
DO $$ BEGIN
  CREATE TYPE "landing_section_status" AS ENUM ('draft', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "landing_sections" ADD COLUMN IF NOT EXISTS "status" "landing_section_status" NOT NULL DEFAULT 'published';
ALTER TABLE "landing_pages" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;

-- Mark all existing sections as published
UPDATE "landing_sections" SET "status" = 'published' WHERE "status" IS NULL;

-- Version history snapshots
CREATE TABLE IF NOT EXISTS "landing_page_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "snapshot" jsonb NOT NULL,
  "label" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL
);
