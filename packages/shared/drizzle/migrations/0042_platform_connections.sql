-- Platform connections: configurable platform integrations (Discord, Matrix, etc.)
-- Replaces hardcoded .env configuration with DB-managed platform settings.

DO $$ BEGIN
  CREATE TYPE "platform_type" AS ENUM ('discord', 'matrix');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "platform_connection_status" AS ENUM ('connected', 'disconnected', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "platform_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "platform" "platform_type" NOT NULL UNIQUE,
  "enabled" boolean NOT NULL DEFAULT true,
  "credentials" jsonb NOT NULL,
  "bot_internal_url" text,
  "bot_internal_token" text,
  "status" "platform_connection_status" NOT NULL DEFAULT 'disconnected',
  "status_message" text,
  "last_health_check" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
