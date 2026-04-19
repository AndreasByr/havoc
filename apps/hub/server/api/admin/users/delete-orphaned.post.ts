import { inArray } from "drizzle-orm";
import { createError } from "h3";
import { z } from "zod";
import { users } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { listActiveCommunityRoleMappings } from "../../../utils/community";
import { fetchDiscordGuildMembersByRoleFromBot } from "../../../utils/botSync";
import { deleteUsersByIds, listOrphanedCandidates } from "../../../utils/admin-mirror";
import { getDb } from "../../../utils/db";
import { readBodyWithSchema } from "../../../utils/http";

const schema = z.object({
  userIds: z.array(z.string().uuid()).min(1)
});

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const parsed = await readBodyWithSchema(event, schema, "Invalid payload.");

  const mappings = await listActiveCommunityRoleMappings();
  const validDiscordIds = new Set<string>();
  for (const mapping of mappings) {
    const response = await fetchDiscordGuildMembersByRoleFromBot(mapping.discordRoleId);
    for (const member of response.members) {
      validDiscordIds.add(member.discordId);
    }
  }

  const orphanedCandidates = await listOrphanedCandidates(Array.from(validDiscordIds));
  const orphanedIdSet = new Set(orphanedCandidates.map((entry) => entry.userId));
  const deletableIds = parsed.userIds.filter((userId) => orphanedIdSet.has(userId));

  if (deletableIds.length === 0) {
    return { deleted: 0, skipped: parsed.userIds.length };
  }

  const db = getDb();
  try {
  const existingRows = await db.select({ id: users.id }).from(users).where(inArray(users.id, deletableIds));
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }
  const existingIds = existingRows.map((row) => row.id);
  const deleted = await deleteUsersByIds(existingIds);
  return {
    deleted,
    skipped: parsed.userIds.length - deleted
  };
});
