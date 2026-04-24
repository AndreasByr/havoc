-- Deletion requests table (from S01, previously missing migration)
-- Privacy consents and retention policies tables (from S02)

DO $$ BEGIN
  CREATE TYPE "deletion_request_status" AS ENUM ('pending', 'approved', 'rejected', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "retention_category" AS ENUM ('voice_sessions', 'audit_logs', 'application_data', 'inactive_users');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deletion_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "status" "deletion_request_status" NOT NULL DEFAULT 'pending',
  "reason" text,
  "reviewed_by" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "failure_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "privacy_consents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "policy_version" text NOT NULL,
  "ip_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "retention_policies" (
  "id" serial PRIMARY KEY,
  "category" "retention_category" NOT NULL UNIQUE,
  "retention_days" integer NOT NULL DEFAULT 90,
  "enabled" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "privacy_consents_user_id_idx" ON "privacy_consents" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "privacy_consents_created_at_idx" ON "privacy_consents" ("created_at" DESC);
