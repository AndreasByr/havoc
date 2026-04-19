import { eq } from "drizzle-orm";
import { createError } from "h3";
import { communityRoles, membershipSettings, permissionRoles } from "@guildora/shared";
import { requireAdminSession } from "../../utils/auth";
import { getDb } from "../../utils/db";
import { MEMBERSHIP_SETTINGS_SINGLETON_ID } from "../../utils/membership-settings";
import { fetchDiscordGuildRolesFromBot } from "../../utils/botSync";

export default defineEventHandler(async (event) => {
try {
  await requireAdminSession(event);
  const db = getDb();

  const [row] = await db
    .select()
    .from(membershipSettings)
    .where(eq(membershipSettings.id, MEMBERSHIP_SETTINGS_SINGLETON_ID))
    .limit(1);

  const roles = await db
    .select({ id: communityRoles.id, name: communityRoles.name })
    .from(communityRoles)
    .orderBy(communityRoles.sortOrder);

  const permRoles = await db
    .select({ id: permissionRoles.id, name: permissionRoles.name, level: permissionRoles.level })
    .from(permissionRoles)
    .orderBy(permissionRoles.level);

  let discordRoles: Array<{ id: string; name: string }> = [];
  try {
    const response = await fetchDiscordGuildRolesFromBot();
    discordRoles = response.roles.map((r) => ({ id: r.id, name: r.name }));
  } catch {
    // Bot bridge unavailable — return empty list, UI will show a warning
  }

  return {
    applicationsRequired: row?.applicationsRequired ?? true,
    defaultCommunityRoleId: row?.defaultCommunityRoleId ?? null,
    requiredLoginRoleId: row?.requiredLoginRoleId ?? null,
    autoSyncEnabled: row?.autoSyncEnabled ?? false,
    autoSyncIntervalHours: row?.autoSyncIntervalHours ?? 24,
    autoSyncLastRun: row?.autoSyncLastRun?.toISOString() ?? null,
    autoCleanupEnabled: row?.autoCleanupEnabled ?? false,
    autoCleanupIntervalHours: row?.autoCleanupIntervalHours ?? 24,
    autoCleanupLastRun: row?.autoCleanupLastRun?.toISOString() ?? null,
    cleanupRoleConfigs: row?.cleanupRoleConfigs ?? [],
    cleanupRoleWhitelist: row?.cleanupRoleWhitelist ?? [],
    cleanupProtectModerators: row?.cleanupProtectModerators ?? true,
    communityRoles: roles,
    permissionRoles: permRoles,
    discordRoles
  };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
