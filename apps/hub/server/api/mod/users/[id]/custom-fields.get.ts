import { eq } from "drizzle-orm";
import { profiles } from "@guildora/shared";
import { requireModeratorSession, adminPermissionRoles } from "../../../../utils/auth";
import { loadActiveCustomFields, extractCustomFieldValues } from "../../../../utils/custom-fields";
import { getDb } from "../../../../utils/db";
import { requireRouterParam } from "../../../../utils/http";
import { requireModeratorRight } from "../../../../utils/moderation-rights";

export default defineEventHandler(async (event) => {
  await requireModeratorRight(event, "modAccessCustomFields");
  const session = await requireModeratorSession(event);
  const targetUserId = requireRouterParam(event, "id", "Missing user id.");

  const db = getDb();
  const roles = session.user.permissionRoles ?? session.user.roles ?? [];
  const isAdmin = adminPermissionRoles.some((r) => roles.includes(r));

  const [allFields, profile] = await Promise.all([
    loadActiveCustomFields(db),
    db
      .select({ customFields: profiles.customFields })
      .from(profiles)
      .where(eq(profiles.userId, targetUserId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
  ]);

  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: "Profile not found." });
  }

  const profileCustomFields = (profile.customFields ?? {}) as Record<string, unknown>;
  const role = isAdmin ? "admin" : "mod";
  const fields = extractCustomFieldValues(allFields, profileCustomFields, false, role);

  return { fields };
});
