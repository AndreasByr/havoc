import { eq } from "drizzle-orm";
import { createError } from "h3";
import { communityRoles, userCommunityRoles } from "@guildora/shared";
import { z } from "zod";
import { requireModeratorSession } from "../../../../utils/auth";
import { assignCommunityRole, getUserById, getUserRoles } from "../../../../utils/community";
import { buildOpenedApplicationCustomFields, getProfileByUserId, upsertProfileCustomFields } from "../../../../utils/community-applications";
import { addDiscordRolesToMember, removeDiscordRolesFromBot, syncDiscordUserFromWebsite } from "../../../../utils/botSync";
import { getDb } from "../../../../utils/db";
import { readBodyWithSchema, requireRouterParam } from "../../../../utils/http";

const schema = z.object({
  communityRoleId: z.number().int().positive()
});

export default defineEventHandler(async (event) => {
  const session = await requireModeratorSession(event);
  const db = getDb();
  const userId = requireRouterParam(event, "id", "Missing user id.");
  const parsed = await readBodyWithSchema(event, schema, "Invalid payload.");

  // Load old community role's discordRoleId before reassignment
  const oldAssignment = await db
    .select({ discordRoleId: communityRoles.discordRoleId })
    .from(userCommunityRoles)
    .innerJoin(communityRoles, eq(userCommunityRoles.communityRoleId, communityRoles.id))
    .where(eq(userCommunityRoles.userId, userId))
    .limit(1);
  const oldDiscordRoleId = oldAssignment[0]?.discordRoleId ?? null;

  await assignCommunityRole(userId, parsed.communityRoleId, session.user.id);

  try {
  const roleRow = await db.select().from(communityRoles).where(eq(communityRoles.id, parsed.communityRoleId)).limit(1);
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }
  if (roleRow[0]?.name === "Bewerber") {
    const profileRow = await getProfileByUserId(db, userId);
    const nextFields = buildOpenedApplicationCustomFields(profileRow?.customFields ?? null, new Date().toISOString());
    await upsertProfileCustomFields(db, userId, nextFields);
  }

  const newDiscordRoleId = roleRow[0]?.discordRoleId ?? null;

  const [user, permissionRoles] = await Promise.all([getUserById(userId), getUserRoles(userId)]);
  if (user) {
    await syncDiscordUserFromWebsite({
      discordId: user.discordId,
      profileName: user.displayName,
      permissionRoles
    });

    // Sync community role Discord roles
    if (oldDiscordRoleId && oldDiscordRoleId !== newDiscordRoleId) {
      await removeDiscordRolesFromBot(user.discordId, { roleIds: [oldDiscordRoleId] });
    }
    if (newDiscordRoleId && newDiscordRoleId !== oldDiscordRoleId) {
      await addDiscordRolesToMember(user.discordId, [newDiscordRoleId]);
    }
  }

  return { ok: true };
});
