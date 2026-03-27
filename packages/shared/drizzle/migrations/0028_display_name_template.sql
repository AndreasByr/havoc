ALTER TABLE "community_settings" ADD COLUMN IF NOT EXISTS "display_name_template" jsonb DEFAULT '[]'::jsonb;
