import { desc, eq } from "drizzle-orm";

import { moderationSettings } from "@guildora/shared";
import { z } from "zod";
import { requireAdminSession } from "../../utils/auth";
import { getDb } from "../../utils/db";
import { readBodyWithSchema } from "../../utils/http";
import { invalidateModerationRightsCache } from "../../utils/moderation-rights";

const moderationRightsSchema = z.object({
  modDeleteUsers: z.boolean().optional(),
  modManageApplications: z.boolean().optional(),
  modAccessCommunitySettings: z.boolean().optional(),
  modAccessDesign: z.boolean().optional(),
  modAccessApps: z.boolean().optional(),
  modAccessDiscordRoles: z.boolean().optional(),
  modAccessCustomFields: z.boolean().optional(),
  modAccessPermissions: z.boolean().optional(),
  allowModeratorAccess: z.boolean().optional(),
  allowModeratorAppsAccess: z.boolean().optional()
});

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const body = await readBodyWithSchema(event, moderationRightsSchema, "Invalid moderation rights payload.");

  const db = getDb();

  const [existing] = await db
    .select({ id: moderationSettings.id })
    .from(moderationSettings)
    .orderBy(desc(moderationSettings.updatedAt))
    .limit(1);

  const updateValues: Record<string, unknown> = { updatedBy: session.user.id };
  if (body.modDeleteUsers !== undefined) updateValues.modDeleteUsers = body.modDeleteUsers;
  if (body.modManageApplications !== undefined) updateValues.modManageApplications = body.modManageApplications;
  if (body.modAccessCommunitySettings !== undefined) updateValues.modAccessCommunitySettings = body.modAccessCommunitySettings;
  if (body.modAccessDesign !== undefined) updateValues.modAccessDesign = body.modAccessDesign;
  if (body.modAccessApps !== undefined) updateValues.modAccessApps = body.modAccessApps;
  if (body.modAccessDiscordRoles !== undefined) updateValues.modAccessDiscordRoles = body.modAccessDiscordRoles;
  if (body.modAccessCustomFields !== undefined) updateValues.modAccessCustomFields = body.modAccessCustomFields;
  if (body.modAccessPermissions !== undefined) updateValues.modAccessPermissions = body.modAccessPermissions;
  if (body.allowModeratorAccess !== undefined) updateValues.allowModeratorAccess = body.allowModeratorAccess;
  if (body.allowModeratorAppsAccess !== undefined) updateValues.allowModeratorAppsAccess = body.allowModeratorAppsAccess;

  if (existing) {
    await db
      .update(moderationSettings)
      .set(updateValues)
      .where(eq(moderationSettings.id, existing.id));
  } else {
    try {
    await db.insert(moderationSettings).values({
    } catch (error) {
      if (error && (error as any).statusCode) throw error;
      throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
    }
      ...updateValues,
      allowModeratorAccess: true,
      allowModeratorAppsAccess: true
    });
  }

  invalidateModerationRightsCache();

  return { success: true };
});
