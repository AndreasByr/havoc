import { eq } from "drizzle-orm";
import { communityRoles, userCommunityRoles, users } from "@guildora/shared";
import { z } from "zod";
import { requireAdminSession } from "../../../utils/auth";
import {
  collectMappedRolesForMember,
  deleteUsersByIds,
  isSuperadminUser,
  upsertMirroredDiscordMember
} from "../../../utils/admin-mirror";
import {
  fetchDiscordGuildMemberFromBot,
  removeDiscordRolesFromBot
} from "../../../utils/botSync";
import { listActiveCommunityRoleMappings } from "../../../utils/community";
import { getDb } from "../../../utils/db";
import { readBodyWithSchema } from "../../../utils/http";

const schema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(50),
  removeAllDiscordRoles: z.boolean().default(false)
});

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const parsed = await readBodyWithSchema(event, schema, "Invalid payload.");
  const runtime = useRuntimeConfig(event);
  const superadminDiscordId = typeof runtime.superadminDiscordId === "string" ? runtime.superadminDiscordId : null;

  const db = getDb();
  const actorIsSuperadmin = await isSuperadminUser(session.user.id);
  const mappings = await listActiveCommunityRoleMappings();

  let deleted = 0;
  let retained = 0;
  let conflicts = 0;
  let skipped = 0;
  const errors: { userId: string; error: string }[] = [];

  for (const userId of parsed.userIds) {
    try {
      if (userId === session.user.id) {
        skipped++;
        continue;
      }

      const targetIsSuperadmin = await isSuperadminUser(userId);
      if (targetIsSuperadmin && !actorIsSuperadmin) {
        skipped++;
        continue;
      }

      const targetRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const targetUser = targetRows[0];
      if (!targetUser) {
        skipped++;
        continue;
      }

      const assignmentRows = await db
        .select({ discordRoleId: communityRoles.discordRoleId })
        .from(userCommunityRoles)
        .innerJoin(communityRoles, eq(userCommunityRoles.communityRoleId, communityRoles.id))
        .where(eq(userCommunityRoles.userId, userId));

      const roleIdsToRemove = assignmentRows
        .map((row) => row.discordRoleId)
        .filter((value): value is string => typeof value === "string" && value.length > 0);

      if (parsed.removeAllDiscordRoles || roleIdsToRemove.length > 0) {
        await removeDiscordRolesFromBot(targetUser.discordId, {
          removeAllManageable: parsed.removeAllDiscordRoles,
          roleIds: roleIdsToRemove
        });
      }

      const memberResponse = await fetchDiscordGuildMemberFromBot(targetUser.discordId);
      if (!memberResponse.member) {
        deleted += await deleteUsersByIds([userId]);
        continue;
      }

      const matchedMappings = collectMappedRolesForMember(memberResponse.member.roleIds, mappings);

      if (matchedMappings.length === 0) {
        deleted += await deleteUsersByIds([userId]);
        continue;
      }

      if (matchedMappings.length > 1) {
        conflicts++;
        continue;
      }

      await upsertMirroredDiscordMember(memberResponse.member, matchedMappings[0]!.id, superadminDiscordId);
      retained++;
    } catch (error) {
      errors.push({
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { ok: true, deleted, retained, conflicts, skipped, errors };
});
