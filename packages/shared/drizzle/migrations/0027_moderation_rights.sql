ALTER TABLE "cms_access_settings" ADD COLUMN IF NOT EXISTS "mod_delete_users" boolean NOT NULL DEFAULT false;
ALTER TABLE "cms_access_settings" ADD COLUMN IF NOT EXISTS "mod_manage_applications" boolean NOT NULL DEFAULT false;
ALTER TABLE "cms_access_settings" ADD COLUMN IF NOT EXISTS "mod_access_community_settings" boolean NOT NULL DEFAULT false;
ALTER TABLE "cms_access_settings" ADD COLUMN IF NOT EXISTS "mod_access_design" boolean NOT NULL DEFAULT false;
ALTER TABLE "cms_access_settings" ADD COLUMN IF NOT EXISTS "mod_access_apps" boolean NOT NULL DEFAULT false;
ALTER TABLE "cms_access_settings" ADD COLUMN IF NOT EXISTS "mod_access_discord_roles" boolean NOT NULL DEFAULT false;
ALTER TABLE "cms_access_settings" ADD COLUMN IF NOT EXISTS "mod_access_custom_fields" boolean NOT NULL DEFAULT false;
ALTER TABLE "cms_access_settings" ADD COLUMN IF NOT EXISTS "mod_access_permissions" boolean NOT NULL DEFAULT false;
