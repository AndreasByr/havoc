-- User platform accounts: links Guildora users to external platform identities.
-- A user can have multiple linked accounts (Discord + Matrix).

CREATE TABLE IF NOT EXISTS "user_platform_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "platform" "platform_type" NOT NULL,
  "platform_user_id" text NOT NULL,
  "platform_username" text,
  "platform_avatar_url" text,
  "is_primary" boolean NOT NULL DEFAULT false,
  "linked_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "upa_platform_user_idx" ON "user_platform_accounts" ("platform", "platform_user_id");
CREATE INDEX IF NOT EXISTS "upa_user_id_idx" ON "user_platform_accounts" ("user_id");

-- Make discord_id nullable (was NOT NULL) to support Matrix-only users.
ALTER TABLE "users" ALTER COLUMN "discord_id" DROP NOT NULL;

-- Add primary_platform column to users.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "primary_platform" "platform_type" DEFAULT 'discord';

-- Add platform column to voice_sessions.
ALTER TABLE "voice_sessions" ADD COLUMN IF NOT EXISTS "platform" "platform_type" DEFAULT 'discord';

-- Backfill: copy existing discord_id entries into user_platform_accounts.
INSERT INTO "user_platform_accounts" ("user_id", "platform", "platform_user_id", "platform_username", "is_primary")
SELECT "id", 'discord', "discord_id", "display_name", true
FROM "users"
WHERE "discord_id" IS NOT NULL
ON CONFLICT ("platform", "platform_user_id") DO NOTHING;
