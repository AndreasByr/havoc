-- Schema Audit Cleanup: Drop unused profiles.absence* columns
--
-- Schema audit conclusion (M005/S03):
--   - All ~38 tables reviewed; no dead tables found.
--   - The only dead columns are the three dropped below:
--       absence_status  (enum: away | maintenance)
--       absence_message (text)
--       absence_until   (timestamptz)
--   - These were added for a planned "vacation mode" feature that was
--     never wired to any UI or API surface.  The sole consumer was
--     assembleUserDataExport (GDPR data-export), which SELECTed them
--     into a user's own export.  No writes, no UI, no API exposure.
--   - The companion enum type "absence_status" is also dropped.

ALTER TABLE "profiles" DROP COLUMN IF EXISTS "absence_status";
--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "absence_message";
--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "absence_until";
--> statement-breakpoint
DROP TYPE IF EXISTS "absence_status";
