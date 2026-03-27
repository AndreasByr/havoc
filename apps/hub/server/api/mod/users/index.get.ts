import { parseProfileName, users } from "@guildora/shared";
import { requireModeratorSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { loadUserCommunityRolesMap, loadUserPermissionRolesMap } from "../../../utils/user-directory";

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);
  const db = getDb();

  const query = getQuery(event);
  const search = typeof query.search === "string" ? query.search.toLowerCase() : "";
  const roleFilter = typeof query.communityRole === "string" ? query.communityRole : "";

  const userColumns = {
    id: users.id,
    discordId: users.discordId,
    displayName: users.displayName
  };

  const [userRows, communityMap, permissionMap] = await Promise.all([
    db.select(userColumns).from(users),
    loadUserCommunityRolesMap(db),
    loadUserPermissionRolesMap(db)
  ]);

  let items = userRows.map((user) => ({
    id: user.id,
    discordId: user.discordId,
    profileName: user.displayName,
    ...parseProfileName(user.displayName),
    communityRole: communityMap.get(user.id)?.name ?? null,
    communityRoleId: communityMap.get(user.id)?.id ?? null,
    permissionRoles: permissionMap.get(user.id) || []
  }));

  if (search) {
    items = items.filter((item) => {
      const value = `${item.profileName} ${item.ingameName} ${item.rufname || ""} ${item.discordId}`.toLowerCase();
      return value.includes(search);
    });
  }

  if (roleFilter) {
    items = items.filter((item) => item.communityRole === roleFilter);
  }

  items.sort((a, b) => a.profileName.localeCompare(b.profileName));
  return { items };
});
