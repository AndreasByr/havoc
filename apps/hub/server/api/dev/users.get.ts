import { users } from "@guildora/shared";
import { requireSession } from "../../utils/auth";
import { assertDevRoleSwitcherAccess } from "../../utils/dev-role-switcher";
import { getDb } from "../../utils/db";
import { loadUserCommunityRolesMap, loadUserPermissionRolesMap } from "../../utils/user-directory";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  assertDevRoleSwitcherAccess(event, session);
  const db = getDb();

  const [userRows, communityMap, permissionMap] = await Promise.all([
    db.select().from(users),
    loadUserCommunityRolesMap(db),
    loadUserPermissionRolesMap(db)
  ]);

  const items = userRows
    .map((user) => ({
      id: user.id,
      discordId: user.discordId,
      profileName: user.displayName,
      communityRole: communityMap.get(user.id)?.name ?? null,
      permissionRoles: permissionMap.get(user.id) || []
    }))
    .sort((a, b) => a.profileName.localeCompare(b.profileName));

  return { items };
});
