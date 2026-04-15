-- Base tables for the application flow system
-- These tables were previously created via auto-migration at server startup.
-- This migration ensures they exist for clean drizzle-migrate runs.

DO $$ BEGIN
  CREATE TYPE "application_flow_status" AS ENUM ('draft', 'active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "application_status" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "application_flows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "status" "application_flow_status" NOT NULL DEFAULT 'draft',
  "flow_json" jsonb NOT NULL,
  "settings_json" jsonb NOT NULL,
  "created_by" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "application_flow_embeds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "flow_id" uuid NOT NULL REFERENCES "public"."application_flows"("id") ON DELETE CASCADE,
  "discord_channel_id" text NOT NULL,
  "discord_message_id" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "application_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "flow_id" uuid NOT NULL REFERENCES "public"."application_flows"("id") ON DELETE CASCADE,
  "discord_id" text NOT NULL,
  "discord_username" text NOT NULL,
  "discord_avatar_url" text,
  "token" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "application_tokens_flow_id_idx" ON "application_tokens" ("flow_id");
CREATE INDEX IF NOT EXISTS "application_tokens_discord_id_idx" ON "application_tokens" ("discord_id");

CREATE TABLE IF NOT EXISTS "applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "flow_id" uuid NOT NULL REFERENCES "public"."application_flows"("id") ON DELETE CASCADE,
  "discord_id" text NOT NULL,
  "discord_username" text NOT NULL,
  "discord_avatar_url" text,
  "answers_json" jsonb NOT NULL,
  "status" "application_status" NOT NULL DEFAULT 'pending',
  "roles_assigned" jsonb DEFAULT '[]',
  "pending_role_assignments" jsonb DEFAULT '[]',
  "display_name_composed" text,
  "reviewed_by" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "applications_flow_id_idx" ON "applications" ("flow_id");
CREATE INDEX IF NOT EXISTS "applications_discord_id_idx" ON "applications" ("discord_id");
CREATE INDEX IF NOT EXISTS "applications_status_idx" ON "applications" ("status");
