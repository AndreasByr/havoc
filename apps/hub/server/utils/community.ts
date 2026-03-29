import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import {
  communityRoles,
  permissionRoles,
  profileChangeLogs,
  profiles,
  userCommunityRoles,
  userPermissionRoles,
  users
} from "@guildora/shared";
import { getDb } from "./db";

const defaultPermissionRoles = [
  { name: "temporaer", description: "Temporary applicant permissions.", level: 0 },
  { name: "user", description: "Default community user role.", level: 10 },
  { name: "moderator", description: "Can moderate community content.", level: 50 },
  { name: "admin", description: "Full administrative permissions.", level: 80 },
  { name: "superadmin", description: "System owner with full access.", level: 100 }
] as const;

const defaultCommunityRoles = [
  { name: "Temporaer", description: "Temporary applicant permissions.", permissionRole: "temporaer", sortOrder: 10 },
  { name: "User", description: "Default community user role.", permissionRole: "user", sortOrder: 20 },
  { name: "Moderator", description: "Can moderate community content.", permissionRole: "moderator", sortOrder: 30 },
  { name: "Admin", description: "Full administrative permissions.", permissionRole: "admin", sortOrder: 40 }
] as const;

export async function ensureDefaultRoles() {
  const db = getDb();

  // Permission roles are system-level and always kept in sync
  for (const role of defaultPermissionRoles) {
    const existing = await db.select().from(permissionRoles).where(eq(permissionRoles.name, role.name)).limit(1);
    if (existing.length === 0) {
      await db.insert(permissionRoles).values(role);
    } else {
      await db
        .update(permissionRoles)
        .set({
          description: role.description,
          level: role.level
        })
        .where(eq(permissionRoles.name, role.name));
    }
  }

  // Community roles: only seed defaults if none exist yet (first setup)
  const existingCommunityRoles = await db.select({ id: communityRoles.id }).from(communityRoles).limit(1);
  if (existingCommunityRoles.length > 0) {
    return;
  }

  for (const role of defaultCommunityRoles) {
    const permission = await db
      .select()
      .from(permissionRoles)
      .where(eq(permissionRoles.name, role.permissionRole))
      .limit(1);
    const permissionRole = permission[0];
    if (!permissionRole) {
      continue;
    }

    await db.insert(communityRoles).values({
      name: role.name,
      description: role.description,
      permissionRoleId: permissionRole.id,
      sortOrder: role.sortOrder
    });
  }
}

export async function ensureCommunityUser(input: {
  discordId: string;
  profileName: string;
  avatarUrl: string | null;
  avatarSource?: string | null;
  primaryDiscordRoleName?: string | null;
  email?: string | null;
  superadminDiscordId?: string | null;
}) {
  const db = getDb();

  const existing = await db.select().from(users).where(eq(users.discordId, input.discordId)).limit(1);

  const user =
    existing[0] ??
    (
      await db
        .insert(users)
        .values({
          discordId: input.discordId,
          displayName: input.profileName,
          avatarUrl: input.avatarUrl,
          avatarSource: input.avatarSource ?? null,
          primaryDiscordRoleName: input.primaryDiscordRoleName ?? null,
          email: input.email ?? null
        })
        .returning()
    )[0];
  if (!user) {
    throw new Error("Failed to create or load user.");
  }

  if (existing[0]) {
    const currentUser = existing[0];
    const keepLocalAvatar = currentUser.avatarSource === "local" && input.avatarSource === undefined;
    const nextAvatarUrl = keepLocalAvatar ? currentUser.avatarUrl : input.avatarUrl;
    const nextAvatarSource = input.avatarSource !== undefined ? input.avatarSource : currentUser.avatarSource;

    await db
      .update(users)
      .set({
        // Keep user-chosen displayName; only refresh avatar/email on login.
        avatarUrl: nextAvatarUrl,
        avatarSource: nextAvatarSource,
        ...(input.primaryDiscordRoleName !== undefined
          ? { primaryDiscordRoleName: input.primaryDiscordRoleName }
          : {}),
        email: input.email ?? null,
        updatedAt: new Date()
      })
      .where(eq(users.id, existing[0].id));
  }

  if (input.superadminDiscordId && input.discordId === input.superadminDiscordId) {
    const superadminRole = await db.select().from(permissionRoles).where(eq(permissionRoles.name, "superadmin")).limit(1);
    if (superadminRole[0]) {
      const existingSuperAdmin = await db
        .select()
        .from(userPermissionRoles)
        .where(and(eq(userPermissionRoles.userId, user.id), eq(userPermissionRoles.permissionRoleId, superadminRole[0].id)))
        .limit(1);
      if (existingSuperAdmin.length === 0) {
        await db.insert(userPermissionRoles).values({
          userId: user.id,
          permissionRoleId: superadminRole[0].id
        });
      }
    }
  }

  return user;
}

export async function ensureUserProfile(userId: string) {
  const db = getDb();
  const existing = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (existing.length === 0) {
    await db.insert(profiles).values({ userId });
    return true;
  }
  return false;
}

export type ActiveCommunityRoleMapping = {
  id: number;
  name: string;
  permissionRoleId: number;
  permissionRoleName: string;
  discordRoleId: string;
};

export async function listActiveCommunityRoleMappings(): Promise<ActiveCommunityRoleMapping[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: communityRoles.id,
      name: communityRoles.name,
      permissionRoleId: communityRoles.permissionRoleId,
      permissionRoleName: permissionRoles.name,
      discordRoleId: communityRoles.discordRoleId
    })
    .from(communityRoles)
    .innerJoin(permissionRoles, eq(communityRoles.permissionRoleId, permissionRoles.id))
    .where(isNotNull(communityRoles.discordRoleId))
    .orderBy(asc(communityRoles.sortOrder), asc(communityRoles.name));

  return rows
    .filter((row): row is Omit<typeof row, "discordRoleId"> & { discordRoleId: string } => typeof row.discordRoleId === "string" && row.discordRoleId.length > 0)
    .map((row) => ({
      id: row.id,
      name: row.name,
      permissionRoleId: row.permissionRoleId,
      permissionRoleName: row.permissionRoleName,
      discordRoleId: row.discordRoleId
    }));
}

export async function getMappedCommunityRolesForDiscordRoleIds(discordRoleIds: string[]): Promise<ActiveCommunityRoleMapping[]> {
  const normalized = Array.from(new Set(discordRoleIds.filter((value) => value.trim().length > 0)));
  if (normalized.length === 0) {
    return [];
  }

  const mappings = await listActiveCommunityRoleMappings();
  const mappingByDiscordRole = new Map(mappings.map((entry) => [entry.discordRoleId, entry]));
  return normalized
    .map((discordRoleId) => mappingByDiscordRole.get(discordRoleId))
    .filter((entry): entry is ActiveCommunityRoleMapping => Boolean(entry));
}

export async function getUserRoles(userId: string) {
  const db = getDb();

  const [directRoles, inheritedRoles] = await Promise.all([
    db
      .select({ roleName: permissionRoles.name })
      .from(userPermissionRoles)
      .innerJoin(permissionRoles, eq(userPermissionRoles.permissionRoleId, permissionRoles.id))
      .where(eq(userPermissionRoles.userId, userId)),
    db
      .select({ roleName: permissionRoles.name })
      .from(userCommunityRoles)
      .innerJoin(communityRoles, eq(userCommunityRoles.communityRoleId, communityRoles.id))
      .innerJoin(permissionRoles, eq(communityRoles.permissionRoleId, permissionRoles.id))
      .where(eq(userCommunityRoles.userId, userId))
  ]);

  const allRoles = new Set([
    ...directRoles.map((entry) => entry.roleName),
    ...inheritedRoles.map((entry) => entry.roleName)
  ]);

  return [...allRoles];
}

export async function getUserById(userId: string) {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}

export async function getUserByDiscordId(discordId: string) {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.discordId, discordId)).limit(1);
  return rows[0] ?? null;
}

export async function getCommunityRoleName(userId: string): Promise<string | null> {
  const db = getDb();
  const row = await db
    .select({ name: communityRoles.name })
    .from(userCommunityRoles)
    .innerJoin(communityRoles, eq(userCommunityRoles.communityRoleId, communityRoles.id))
    .where(eq(userCommunityRoles.userId, userId))
    .limit(1);
  return row[0]?.name ?? null;
}

export async function listCommunityRoles() {
  const db = getDb();
  return db
    .select({
      id: communityRoles.id,
      name: communityRoles.name,
      description: communityRoles.description,
      discordRoleId: communityRoles.discordRoleId,
      sortOrder: communityRoles.sortOrder,
      permissionRoleId: communityRoles.permissionRoleId,
      permissionRoleName: permissionRoles.name
    })
    .from(communityRoles)
    .innerJoin(permissionRoles, eq(communityRoles.permissionRoleId, permissionRoles.id))
    .orderBy(asc(communityRoles.sortOrder), asc(communityRoles.name));
}

export async function listPermissionRoles() {
  const db = getDb();
  return db.select().from(permissionRoles).orderBy(asc(permissionRoles.level));
}

export async function assignCommunityRole(userId: string, communityRoleId: number, changedBy?: string | null) {
  const db = getDb();
  const roleRow = await db.select().from(communityRoles).where(eq(communityRoles.id, communityRoleId)).limit(1);
  if (!roleRow[0]) {
    throw createError({
      statusCode: 404,
      statusMessage: "Community role not found."
    });
  }

  const previousRole = await db
    .select({ name: communityRoles.name })
    .from(userCommunityRoles)
    .innerJoin(communityRoles, eq(userCommunityRoles.communityRoleId, communityRoles.id))
    .where(eq(userCommunityRoles.userId, userId))
    .limit(1);

  const assignment = await db.select().from(userCommunityRoles).where(eq(userCommunityRoles.userId, userId)).limit(1);
  if (assignment[0]) {
    await db
      .update(userCommunityRoles)
      .set({
        communityRoleId
      })
      .where(eq(userCommunityRoles.userId, userId));
  } else {
    await db.insert(userCommunityRoles).values({
      userId,
      communityRoleId
    });
  }

  await syncPermissionRolesForUser(userId);

  const profileRow = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (profileRow[0]) {
    await db.insert(profileChangeLogs).values({
      profileId: profileRow[0].id,
      changeType: "community_role_change",
      previousValue: previousRole[0]?.name ?? null,
      newValue: roleRow[0].name,
      isGrowth: roleRow[0].name !== "Bewerber",
      isDeparture: roleRow[0].name === "Bewerber",
      changedBy: changedBy ?? null
    });
  }
}

export async function upsertCommunityRoleAssignment(userId: string, communityRoleId: number) {
  const db = getDb();
  const assignment = await db.select().from(userCommunityRoles).where(eq(userCommunityRoles.userId, userId)).limit(1);
  if (assignment[0]) {
    if (assignment[0].communityRoleId !== communityRoleId) {
      await db
        .update(userCommunityRoles)
        .set({
          communityRoleId
        })
        .where(eq(userCommunityRoles.userId, userId));
    }
  } else {
    await db.insert(userCommunityRoles).values({
      userId,
      communityRoleId
    });
  }

  await syncPermissionRolesForUser(userId);
}

export async function syncPermissionRolesForUser(userId: string) {
  const db = getDb();

  const communityAssignment = await db
    .select({
      communityRoleId: userCommunityRoles.communityRoleId
    })
    .from(userCommunityRoles)
    .where(eq(userCommunityRoles.userId, userId))
    .limit(1);

  const assignment = communityAssignment[0];
  if (!assignment) {
    return;
  }

  const communityRole = await db
    .select({
      permissionRoleId: communityRoles.permissionRoleId
    })
    .from(communityRoles)
    .where(eq(communityRoles.id, assignment.communityRoleId))
    .limit(1);
  const mappedPermissionRoleId = communityRole[0]?.permissionRoleId;
  if (!mappedPermissionRoleId) {
    return;
  }

  const rolesToReset = await db
    .select({ id: permissionRoles.id })
    .from(permissionRoles)
    .where(inArray(permissionRoles.name, ["temporaer", "user", "moderator", "admin"]));

  const resetRoleIds = rolesToReset.map((role) => role.id);
  if (resetRoleIds.length > 0) {
    await db
      .delete(userPermissionRoles)
      .where(and(eq(userPermissionRoles.userId, userId), inArray(userPermissionRoles.permissionRoleId, resetRoleIds)));
  }

  await db
    .insert(userPermissionRoles)
    .values({
      userId,
      permissionRoleId: mappedPermissionRoleId
    })
    .onConflictDoNothing();
}
