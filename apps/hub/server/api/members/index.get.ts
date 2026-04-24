import {
  parseProfileName,
  permissionRoles,
  userPermissionRoles,
  userDiscordRoles,
  users,
  voiceSessions
} from "@guildora/shared";
import { and, eq, gte, ilike, inArray, or } from "drizzle-orm";
import { requireSession } from "../../utils/auth";
import { getDb } from "../../utils/db";
import { parsePaginationQuery, paginateArray } from "../../utils/http";
import { loadUserCommunityRolesMap } from "../../utils/user-directory";
import { calculateVoiceMinutesFromSessions, classifyVoiceActivity, formatMinutesToHours } from "../../utils/voice";

export default defineEventHandler(async (event) => {
  await requireSession(event);
  const db = getDb();

  const query = getQuery(event);
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const roleFilter = typeof query.communityRole === "string" ? query.communityRole : "";
  const discordRoleIdsParam = typeof query.discordRoleIds === "string" ? query.discordRoleIds : "";
  const discordRoleIds = discordRoleIdsParam ? discordRoleIdsParam.split(",").map((id) => id.trim()).filter(Boolean) : [];
  const sort = typeof query.sort === "string" ? query.sort : "name";
  const voiceActivityDays = Number.parseInt(typeof query.voiceActivityDays === "string" ? query.voiceActivityDays : "7", 10);
  const days = [7, 14, 28].includes(voiceActivityDays) ? voiceActivityDays : 7;
  const { page, limit } = parsePaginationQuery(query);

  const userColumns = {
    id: users.id,
    discordId: users.discordId,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
    avatarSource: users.avatarSource,
    primaryDiscordRoleName: users.primaryDiscordRoleName,
    createdAt: users.createdAt
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

  // Load voice sessions only for the relevant time window
  const voiceSince = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // If discord role filter is active, find matching user IDs first
  let discordRoleUserIds: Set<string> | null = null;
  if (discordRoleIds.length > 0) {
    const matchingRows = await db
      .select({ userId: userDiscordRoles.userId })
      .from(userDiscordRoles)
      .where(inArray(userDiscordRoles.discordRoleId, discordRoleIds));
    discordRoleUserIds = new Set(matchingRows.map((r) => r.userId));
  }

  const [userRows, communityMap, permissionRows, sessions] = await Promise.all([
    userQuery,
    loadUserCommunityRolesMap(db),
    db
      .select({
        userId: userPermissionRoles.userId,
        roleName: permissionRoles.name,
        roleLevel: permissionRoles.level
      })
      .from(userPermissionRoles)
      .innerJoin(permissionRoles, eq(permissionRoles.id, userPermissionRoles.permissionRoleId)),
    db
      .select({
        userId: voiceSessions.userId,
        startedAt: voiceSessions.startedAt,
        endedAt: voiceSessions.endedAt,
        durationMinutes: voiceSessions.durationMinutes
      })
      .from(voiceSessions)
      .where(gte(voiceSessions.startedAt, voiceSince))
  ]);

  const voiceMap = new Map<string, Array<{ startedAt: Date; endedAt: Date | null; durationMinutes: number | null }>>();
  for (const session of sessions) {
    const list = voiceMap.get(session.userId) || [];
    list.push(session);
    voiceMap.set(session.userId, list);
  }

  const permissionRolesByUser = new Map<string, string[]>();
  const highestPermissionRoleByUser = new Map<string, { name: string; level: number }>();
  for (const row of permissionRows) {
    const list = permissionRolesByUser.get(row.userId) || [];
    list.push(row.roleName);
    permissionRolesByUser.set(row.userId, list);

    const currentTop = highestPermissionRoleByUser.get(row.userId);
    if (!currentTop || row.roleLevel > currentTop.level) {
      highestPermissionRoleByUser.set(row.userId, {
        name: row.roleName,
        level: row.roleLevel
      });
    }
  }

  let items = userRows.map((user) => {
    const userSessions = voiceMap.get(user.id) || [];
    const minutes = calculateVoiceMinutesFromSessions(userSessions, days);
    const hours = formatMinutesToHours(minutes);
    const permissionRolesForUser = permissionRolesByUser.get(user.id) || [];
    const highestPermissionRoleName = highestPermissionRoleByUser.get(user.id)?.name ?? null;

    return {
      id: user.id,
      discordId: user.discordId,
      profileName: user.displayName,
      ...parseProfileName(user.displayName),
      avatarUrl: user.avatarUrl,
      avatarSource: user.avatarSource,
      createdAt: user.createdAt,
      communityRole: communityMap.get(user.id)?.name ?? null,
      permissionRoles: permissionRolesForUser,
      primaryDiscordRoleName: user.primaryDiscordRoleName ?? null,
      cardRoleName: user.primaryDiscordRoleName ?? highestPermissionRoleName,
      voice: {
        minutes,
        hours,
        label: classifyVoiceActivity(hours)
      }
    };
  });

  // Discord role filter (applied in-memory from pre-fetched set)
  if (discordRoleUserIds) {
    items = items.filter((item) => discordRoleUserIds!.has(item.id));
  }

  // Community role filter (applied in-memory since it's a joined table)
  if (roleFilter) {
    items = items.filter((item) => item.communityRole === roleFilter);
  }

  if (sort === "joined") {
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } else if (sort === "role") {
    items.sort((a, b) => (a.communityRole || "").localeCompare(b.communityRole || ""));
  } else if (sort === "voice") {
    items.sort((a, b) => b.voice.minutes - a.voice.minutes);
  } else {
    items.sort((a, b) => a.profileName.localeCompare(b.profileName));
  }

  const paginated = paginateArray(items, page, limit);
  return { days, ...paginated };
});
