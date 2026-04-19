import { users } from "@guildora/shared";
import { ilike, or, and } from "drizzle-orm";
import { requireAdminSession } from "../../utils/auth";
import { getDb } from "../../utils/db";
import { parsePaginationQuery, paginateArray } from "../../utils/http";
import { loadUserCommunityRolesMap, loadUserPermissionRolesMap } from "../../utils/user-directory";

export default defineEventHandler(async (event) => {
  const db = getDb();
  await requireAdminSession(event);

  const query = getQuery(event);
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const { page, limit } = parsePaginationQuery(query);

  const userColumns = {
    id: users.id,
    discordId: users.discordId,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl
  };

  const conditions = [];
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(users.displayName, pattern),
        ilike(users.discordId, pattern)
      )
    );
  }

  const userQuery = conditions.length > 0
    ? db.select(userColumns).from(users).where(and(...conditions))
    : db.select(userColumns).from(users);

  const [userRows, permissionMap, communityMap] = await Promise.all([
    userQuery,
    loadUserPermissionRolesMap(db),
    loadUserCommunityRolesMap(db)
  ]);

  const items = userRows.map((user) => ({
    id: user.id,
    discordId: user.discordId,
    profileName: user.displayName,
    avatarUrl: user.avatarUrl,
    permissionRoles: permissionMap.get(user.id) || [],
    communityRole: communityMap.get(user.id)?.name ?? null
  }));

  return paginateArray(items, page, limit);
});
