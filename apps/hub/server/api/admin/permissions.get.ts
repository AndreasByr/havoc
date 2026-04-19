import { eq } from "drizzle-orm";
import { createError } from "h3";
import { userCommunityRoles } from "@guildora/shared";
import { requireAdminSession } from "../../utils/auth";
import { loadLandingAccessConfig } from "../../utils/landing-access";
import { listCommunityRoles, listPermissionRoles } from "../../utils/community";
import { getDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
try {
  await requireAdminSession(event);

  const db = getDb();
  const landingAccess = await loadLandingAccessConfig(db);
  const [community, permission] = await Promise.all([listCommunityRoles(), listPermissionRoles()]);
  const assignmentRows = await Promise.all(
    community.map(async (role) => {
      const rows = await db
        .select({ userId: userCommunityRoles.userId })
        .from(userCommunityRoles)
        .where(eq(userCommunityRoles.communityRoleId, role.id));
      return { roleId: role.id, count: rows.length };
    })
  );
  const assignmentCountByRoleId = new Map(assignmentRows.map((entry) => [entry.roleId, entry.count]));

  return {
    communityRoles: community.map((role) => ({
      ...role,
      assignedUsers: assignmentCountByRoleId.get(role.id) || 0
    })),
    permissionRoles: permission,
    hasActiveMappings: community.some((role) => typeof role.discordRoleId === "string" && role.discordRoleId.length > 0),
    landingAccess
  };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
