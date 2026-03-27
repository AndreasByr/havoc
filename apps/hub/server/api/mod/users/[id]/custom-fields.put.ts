import { eq } from "drizzle-orm";
import { profiles } from "@guildora/shared";
import { z } from "zod";
import { requireModeratorSession, adminPermissionRoles } from "../../../../utils/auth";
import { loadActiveCustomFields, filterFieldsForMod, validateAndMergeFieldValues } from "../../../../utils/custom-fields";
import { getDb } from "../../../../utils/db";
import { readBodyWithSchema, requireRouterParam } from "../../../../utils/http";
import { requireModeratorRight } from "../../../../utils/moderation-rights";

const bodySchema = z.object({ values: z.record(z.unknown()) });

export default defineEventHandler(async (event) => {
  await requireModeratorRight(event, "modAccessCustomFields");
  const session = await requireModeratorSession(event);
  const targetUserId = requireRouterParam(event, "id", "Missing user id.");
  const body = await readBodyWithSchema(event, bodySchema, "Invalid payload.");

  const db = getDb();
  const roles = session.user.permissionRoles ?? session.user.roles ?? [];
  const isAdmin = adminPermissionRoles.some((r) => roles.includes(r));

  const allFields = await loadActiveCustomFields(db);
  const editableFields = isAdmin
    ? allFields.filter((f) => f.active)
    : filterFieldsForMod(allFields).filter((f) => f.modCanEdit);

  const [profile] = await db
    .select({ customFields: profiles.customFields })
    .from(profiles)
    .where(eq(profiles.userId, targetUserId))
    .limit(1);

  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: "Profile not found." });
  }

  const existingValues = (profile.customFields ?? {}) as Record<string, unknown>;
  const merged = validateAndMergeFieldValues(editableFields, existingValues, body.values);

  if (body.values.mod_note !== undefined) {
    merged.mod_note_last_edited_by = session.user.id;
    merged.mod_note_last_edited_at = new Date().toISOString();
  }

  await db
    .update(profiles)
    .set({ customFields: merged })
    .where(eq(profiles.userId, targetUserId));

  return { success: true };
});
