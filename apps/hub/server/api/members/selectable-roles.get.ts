import { asc } from "drizzle-orm";

import { selectableDiscordRoles, roleGroups } from "@guildora/shared";
import { requireSession } from "../../utils/auth";
import { getDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
  await requireSession(event);
  const db = getDb();

  const rows = await db
    .select({
      discordRoleId: selectableDiscordRoles.discordRoleId,
      roleNameSnapshot: selectableDiscordRoles.roleNameSnapshot,
      groupId: selectableDiscordRoles.groupId
    })
    .from(selectableDiscordRoles)
    .orderBy(asc(selectableDiscordRoles.roleNameSnapshot));

  // Load group names for display
  try {
  const groups = await db.select({ id: roleGroups.id, name: roleGroups.name }).from(roleGroups);
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));

  const roles = rows.map((row) => ({
    discordRoleId: row.discordRoleId,
    roleNameSnapshot: row.roleNameSnapshot,
    groupName: row.groupId ? groupNameById.get(row.groupId) || null : null
  }));

  return { roles };
});
