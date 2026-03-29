import { eq } from "drizzle-orm";
import { communityRoles, userCommunityRoles } from "@guildora/shared";
import { z } from "zod";
import { requireModeratorSession } from "../../../utils/auth";
import { isSuperadminUser } from "../../../utils/admin-mirror";
import { assignCommunityRole, getUserById, getUserRoles } from "../../../utils/community";
import {
  addDiscordRolesToMember,
  removeDiscordRolesFromBot,
  syncDiscordUserFromWebsite
} from "../../../utils/botSync";
import { getDb } from "../../../utils/db";
import { readBodyWithSchema } from "../../../utils/http";

const schema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(50),
  communityRoleId: z.number().int().positive()
});

async function processUser(
  userId: string,
  communityRoleId: number,
  newDiscordRoleId: string | null,
  changedBy: string
) {
  const db = getDb();

  const oldAssignment = await db
    .select({ discordRoleId: communityRoles.discordRoleId })
    .from(userCommunityRoles)
    .innerJoin(communityRoles, eq(userCommunityRoles.communityRoleId, communityRoles.id))
    .where(eq(userCommunityRoles.userId, userId))
    .limit(1);
  const oldDiscordRoleId = oldAssignment[0]?.discordRoleId ?? null;

  await assignCommunityRole(userId, communityRoleId, changedBy);

  const [user, permissionRoles] = await Promise.all([
    getUserById(userId),
    getUserRoles(userId)
  ]);

  if (user) {
    await syncDiscordUserFromWebsite({
      discordId: user.discordId,
      profileName: user.displayName,
      permissionRoles
    });

    if (oldDiscordRoleId && oldDiscordRoleId !== newDiscordRoleId) {
      await removeDiscordRolesFromBot(user.discordId, { roleIds: [oldDiscordRoleId] });
    }
    if (newDiscordRoleId && newDiscordRoleId !== oldDiscordRoleId) {
      await addDiscordRolesToMember(user.discordId, [newDiscordRoleId]);
    }
  }
}

export default defineEventHandler(async (event) => {
  const session = await requireModeratorSession(event);
  const parsed = await readBodyWithSchema(event, schema, "Invalid payload.");
  const db = getDb();

  const roleRow = await db
    .select({ discordRoleId: communityRoles.discordRoleId })
    .from(communityRoles)
    .where(eq(communityRoles.id, parsed.communityRoleId))
    .limit(1);

  if (!roleRow[0]) {
    throw createError({ statusCode: 404, statusMessage: "Community role not found." });
  }

  const newDiscordRoleId = roleRow[0].discordRoleId ?? null;

  const succeeded: string[] = [];
  const failed: { userId: string; error: string }[] = [];
  const skippedSuperadmins: string[] = [];

  const chunks: string[][] = [];
  for (let i = 0; i < parsed.userIds.length; i += 3) {
    chunks.push(parsed.userIds.slice(i, i + 3));
  }

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(async (userId) => {
        const isSuperadmin = await isSuperadminUser(userId);
        if (isSuperadmin) {
          skippedSuperadmins.push(userId);
          return;
        }

        await processUser(userId, parsed.communityRoleId, newDiscordRoleId, session.user.id);
        succeeded.push(userId);
      })
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      if (result.status === "rejected") {
        const userId = chunk[i]!;
        if (!skippedSuperadmins.includes(userId)) {
          failed.push({
            userId,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason)
          });
        }
      }
    }
  }

  return { succeeded, failed, skippedSuperadmins };
});
