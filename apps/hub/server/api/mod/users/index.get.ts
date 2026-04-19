import { parseProfileName, users, userCommunityRoles, communityRoles } from "@guildora/shared";

import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import { requireModeratorSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { parsePaginationQuery } from "../../../utils/http";
import { loadUserCommunityRolesMap, loadUserPermissionRolesMap } from "../../../utils/user-directory";

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);
  const db = getDb();

  const query = getQuery(event);
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const roleFilter = typeof query.communityRole === "string" ? query.communityRole : "";
  const { page, limit } = parsePaginationQuery(query);
  const offset = (page - 1) * limit;

  const userColumns = {
    id: users.id,
    discordId: users.discordId,
    displayName: users.displayName
  };

  const searchCondition = search
    ? or(ilike(users.displayName, `%${search}%`), ilike(users.discordId, `%${search}%`))
    : undefined;

  let userRows: Array<{ id: string; discordId: string; displayName: string }>;
  let total: number;

  if (roleFilter) {
    const whereCondition = and(searchCondition, eq(communityRoles.name, roleFilter));
    const [rows, countRows] = await Promise.all([
      db
        .select(userColumns)
        .from(users)
        .innerJoin(userCommunityRoles, eq(userCommunityRoles.userId, users.id))
        .innerJoin(communityRoles, eq(communityRoles.id, userCommunityRoles.communityRoleId))
        .where(whereCondition)
        .orderBy(asc(users.displayName))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(users)
        .innerJoin(userCommunityRoles, eq(userCommunityRoles.userId, users.id))
        .innerJoin(communityRoles, eq(communityRoles.id, userCommunityRoles.communityRoleId))
        .where(whereCondition)
    ]);
    userRows = rows;
    total = countRows[0]?.total ?? 0;
  } else {
    const [rows, countRows] = await Promise.all([
      db
        .select(userColumns)
        .from(users)
        .where(searchCondition)
        .orderBy(asc(users.displayName))
        .limit(limit)
        .offset(offset),
      try {
      db.select({ total: count() }).from(users).where(searchCondition)
      } catch (error) {
        if (error && (error as any).statusCode) throw error;
        throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
      }
    ]);
    userRows = rows;
    total = countRows[0]?.total ?? 0;
  }

  const userIds = userRows.map((u) => u.id);
  const [communityMap, permissionMap] = await Promise.all([
    loadUserCommunityRolesMap(db, userIds),
    loadUserPermissionRolesMap(db, userIds)
  ]);

  const items = userRows.map((user) => ({
    id: user.id,
    discordId: user.discordId,
    profileName: user.displayName,
    ...parseProfileName(user.displayName),
    communityRole: communityMap.get(user.id)?.name ?? null,
    communityRoleId: communityMap.get(user.id)?.id ?? null,
    permissionRoles: permissionMap.get(user.id) || []
  }));

  const totalPages = Math.ceil(total / limit);
  return { items, pagination: { page, limit, total, totalPages } };
});
