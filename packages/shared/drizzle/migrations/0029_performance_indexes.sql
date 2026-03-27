-- Performance indexes for frequently queried columns

-- Users: sorting by creation date
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" ("created_at" DESC);

-- Profiles: sorting by update date, lookup by user_id
CREATE INDEX IF NOT EXISTS "profiles_updated_at_idx" ON "profiles" ("updated_at" DESC);

-- Voice sessions: lookup by user_id and time-range filtering
CREATE INDEX IF NOT EXISTS "voice_sessions_user_id_idx" ON "voice_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "voice_sessions_started_at_idx" ON "voice_sessions" ("started_at" DESC);

-- Applications: sorting and filtering
CREATE INDEX IF NOT EXISTS "applications_created_at_idx" ON "applications" ("created_at" DESC);

-- Community custom fields: filtering active fields and sorting
CREATE INDEX IF NOT EXISTS "community_custom_fields_active_sort_idx" ON "community_custom_fields" ("active", "sort_order");

-- Installed apps: filtering by status
CREATE INDEX IF NOT EXISTS "installed_apps_status_idx" ON "installed_apps" ("status");
