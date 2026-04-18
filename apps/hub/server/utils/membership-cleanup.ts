import { and, eq, inArray, sql, isNotNull } from "drizzle-orm";
import {
  cleanupLog,
  membershipSettings,
  permissionRoles,
  userPermissionRoles,
  users,
  userDiscordRoles,
  voiceSessions,
  type RoleCleanupConfig
} from "@guildora/shared";
import { fetchDiscordGuildMemberFromBot, removeDiscordRolesFromBot } from "./botSync";
import { deleteUsersByIds } from "./admin-mirror";
import { loadMembershipSettings, MEMBERSHIP_SETTINGS_SINGLETON_ID, type MembershipSettingsRow } from "./membership-settings";
import type { getDb } from "./db";

type DbClient = ReturnType<typeof getDb>;

// Guard against concurrent cleanup runs
let running = false;

const ALWAYS_PROTECTED_ROLES = ["superadmin", "admin"];

export interface CleanupResult {
  processed: number;
  cleaned: number;
  skippedProtected: number;
  skippedBotUnavailable: number;
  error?: string;
}

interface UserForCleanup {
  id: string;
  discordId: string;
  displayName: string;
  lastLoginAt: Date | null;
  permissionRoleNames: string[];
  discordRoleIds: string[];
}

interface ConditionEvaluation {
  matched: boolean;
  reasons: string[];
  conditionsMatched: string[];
}

export function evaluateCleanupConditions(
  user: UserForCleanup,
  roleConfig: RoleCleanupConfig,
  isGuildMember: boolean,
  memberRoleIds: string[],
  lastVoiceEndedAt: Date | null
): ConditionEvaluation {
  const conditions = roleConfig.conditions;
  if (conditions.length === 0) {
    return { matched: false, reasons: [], conditionsMatched: [] };
  }

  const results = new Map<string, { met: boolean; reason: string; operator: "AND" | "OR" }>();

  for (const condition of conditions) {
    switch (condition.type) {
      case "orphan": {
        const met = !isGuildMember;
        results.set("orphan", { met, reason: "Not a guild member (orphan)", operator: condition.operator });
        break;
      }
      case "missingRole": {
        if (!roleConfig.cleanupRequiredRoleId) {
          results.set("missingRole", { met: false, reason: "Missing role check (no role configured)", operator: condition.operator });
        } else {
          const met = !memberRoleIds.includes(roleConfig.cleanupRequiredRoleId);
          results.set("missingRole", { met, reason: "Missing required Discord role", operator: condition.operator });
        }
        break;
      }
      case "loginInactive": {
        if (!roleConfig.cleanupInactiveDays) {
          results.set("loginInactive", { met: false, reason: "Login inactivity (no threshold set)", operator: condition.operator });
        } else {
          const threshold = new Date();
          threshold.setDate(threshold.getDate() - roleConfig.cleanupInactiveDays);
          const met = !user.lastLoginAt || user.lastLoginAt < threshold;
          const days = user.lastLoginAt
            ? Math.floor((Date.now() - user.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24))
            : "never";
          results.set("loginInactive", { met, reason: `Inactive for ${days} days (threshold: ${roleConfig.cleanupInactiveDays})`, operator: condition.operator });
        }
        break;
      }
      case "voiceInactive": {
        if (!roleConfig.cleanupNoVoiceDays) {
          results.set("voiceInactive", { met: false, reason: "Voice inactivity (no threshold set)", operator: condition.operator });
        } else {
          const threshold = new Date();
          threshold.setDate(threshold.getDate() - roleConfig.cleanupNoVoiceDays);
          const met = !lastVoiceEndedAt || lastVoiceEndedAt < threshold;
          const days = lastVoiceEndedAt
            ? Math.floor((Date.now() - lastVoiceEndedAt.getTime()) / (1000 * 60 * 60 * 24))
            : "never";
          results.set("voiceInactive", { met, reason: `No voice activity for ${days} days (threshold: ${roleConfig.cleanupNoVoiceDays})`, operator: condition.operator });
        }
        break;
      }
    }
  }

  // Evaluate combined logic
  const orConditions = Array.from(results.entries()).filter(([, r]) => r.operator === "OR");
  const andConditions = Array.from(results.entries()).filter(([, r]) => r.operator === "AND");

  const orResult = orConditions.length === 0 ? true : orConditions.some(([, r]) => r.met);
  const andResult = andConditions.length === 0 ? true : andConditions.every(([, r]) => r.met);

  let matched: boolean;
  if (orConditions.length > 0 && andConditions.length === 0) {
    matched = orResult;
  } else if (andConditions.length > 0 && orConditions.length === 0) {
    matched = andResult;
  } else {
    matched = orResult && andResult;
  }

  const matchedEntries = Array.from(results.entries()).filter(([, r]) => r.met);
  return {
    matched,
    reasons: matchedEntries.map(([, r]) => r.reason),
    conditionsMatched: matchedEntries.map(([type]) => type)
  };
}

function isUserProtected(user: UserForCleanup, settings: MembershipSettingsRow): boolean {
  if (ALWAYS_PROTECTED_ROLES.some((role) => user.permissionRoleNames.includes(role))) {
    return true;
  }
  if (settings.cleanupProtectModerators && user.permissionRoleNames.includes("moderator")) {
    return true;
  }
  return false;
}

/**
 * Find the matching role cleanup config for a user based on their permission roles.
 * Returns the first enabled config whose permissionRoleName matches any of the user's roles.
 * If a user has multiple permission roles, the most specific (lowest-level) match wins.
 */
function findMatchingRoleConfig(
  user: UserForCleanup,
  configs: RoleCleanupConfig[]
): RoleCleanupConfig | null {
  const enabledConfigs = configs.filter((c) => c.enabled && c.conditions.length > 0);
  if (enabledConfigs.length === 0) return null;

  // Find configs that match any of the user's permission roles
  const matching = enabledConfigs.filter((c) =>
    user.permissionRoleNames.includes(c.permissionRoleName)
  );

  // Return the first match (admin configures the priority via the order in the array)
  return matching[0] ?? null;
}

export async function runCleanupCycle(db: DbClient): Promise<CleanupResult> {
  if (running) {
    return { processed: 0, cleaned: 0, skippedProtected: 0, skippedBotUnavailable: 0, error: "Cleanup already running" };
  }

  running = true;
  try {
    const settings = await loadMembershipSettings(db);

    if (!settings.autoCleanupEnabled) {
      return { processed: 0, cleaned: 0, skippedProtected: 0, skippedBotUnavailable: 0 };
    }

    const enabledConfigs = settings.cleanupRoleConfigs.filter((c) => c.enabled && c.conditions.length > 0);
    if (enabledConfigs.length === 0) {
      return { processed: 0, cleaned: 0, skippedProtected: 0, skippedBotUnavailable: 0 };
    }

    // Load all users with their permission roles
    const allUsers = await db
      .select({
        id: users.id,
        discordId: users.discordId,
        displayName: users.displayName,
        lastLoginAt: users.lastLoginAt
      })
      .from(users);

    if (allUsers.length === 0) {
      return { processed: 0, cleaned: 0, skippedProtected: 0, skippedBotUnavailable: 0 };
    }

    const userIds = allUsers.map((u) => u.id);

    // Load permission roles for all users
    const permRoleRows = await db
      .select({
        userId: userPermissionRoles.userId,
        roleName: permissionRoles.name
      })
      .from(userPermissionRoles)
      .innerJoin(permissionRoles, eq(userPermissionRoles.permissionRoleId, permissionRoles.id))
      .where(inArray(userPermissionRoles.userId, userIds));

    const permRolesByUser = new Map<string, string[]>();
    for (const row of permRoleRows) {
      const existing = permRolesByUser.get(row.userId) ?? [];
      existing.push(row.roleName);
      permRolesByUser.set(row.userId, existing);
    }

    // Load discord role snapshots for all users
    const discordRoleRows = await db
      .select({
        userId: userDiscordRoles.userId,
        discordRoleId: userDiscordRoles.discordRoleId
      })
      .from(userDiscordRoles)
      .where(inArray(userDiscordRoles.userId, userIds));

    const discordRolesByUser = new Map<string, string[]>();
    for (const row of discordRoleRows) {
      const existing = discordRolesByUser.get(row.userId) ?? [];
      existing.push(row.discordRoleId);
      discordRolesByUser.set(row.userId, existing);
    }

    // Load last voice session ended_at for all users
    const lastVoiceRows = await db
      .select({
        userId: voiceSessions.userId,
        lastEndedAt: sql<Date>`max(${voiceSessions.endedAt})`.as("last_ended_at")
      })
      .from(voiceSessions)
      .where(and(inArray(voiceSessions.userId, userIds), isNotNull(voiceSessions.endedAt)))
      .groupBy(voiceSessions.userId);

    const lastVoiceByUser = new Map<string, Date>();
    for (const row of lastVoiceRows) {
      if (row.lastEndedAt) {
        lastVoiceByUser.set(row.userId, row.lastEndedAt);
      }
    }

    let cleaned = 0;
    let skippedProtected = 0;
    let skippedBotUnavailable = 0;

    for (const user of allUsers) {
      const userForCheck: UserForCleanup = {
        id: user.id,
        discordId: user.discordId,
        displayName: user.displayName,
        lastLoginAt: user.lastLoginAt,
        permissionRoleNames: permRolesByUser.get(user.id) ?? [],
        discordRoleIds: discordRolesByUser.get(user.id) ?? []
      };

      // Check protection
      if (isUserProtected(userForCheck, settings)) {
        skippedProtected++;
        continue;
      }

      // Find matching per-role cleanup config
      const roleConfig = findMatchingRoleConfig(userForCheck, enabledConfigs);
      if (!roleConfig) {
        // No cleanup config matches this user's permission role — skip
        continue;
      }

      // Check guild membership via bot bridge
      let isGuildMember = false;
      let memberRoleIds: string[] = [];
      try {
        const botResponse = await fetchDiscordGuildMemberFromBot(user.discordId);
        if (botResponse.member) {
          isGuildMember = true;
          memberRoleIds = botResponse.member.roleIds;
        }
      } catch {
        // Bot bridge unreachable — skip this user (safety: don't assume orphan)
        skippedBotUnavailable++;
        continue;
      }

      const evaluation = evaluateCleanupConditions(
        userForCheck,
        roleConfig,
        isGuildMember,
        memberRoleIds,
        lastVoiceByUser.get(user.id) ?? null
      );

      if (!evaluation.matched) {
        continue;
      }

      // Remove Discord roles (except whitelisted)
      let removedRoleIds: string[] = [];
      if (isGuildMember && memberRoleIds.length > 0) {
        const whitelistSet = new Set(settings.cleanupRoleWhitelist);
        const rolesToRemove = memberRoleIds.filter((id) => !whitelistSet.has(id));
        if (rolesToRemove.length > 0) {
          try {
            const result = await removeDiscordRolesFromBot(user.discordId, { roleIds: rolesToRemove });
            removedRoleIds = result.removedRoleIds ?? [];
          } catch (err) {
            console.warn(`[membership-cleanup] Failed to remove Discord roles for ${user.discordId}:`, err);
          }
        }
      }

      // Log before deletion
      await db.insert(cleanupLog).values({
        userId: user.id,
        discordId: user.discordId,
        discordUsername: user.displayName,
        reason: `[${roleConfig.permissionRoleName}] ${evaluation.reasons.join("; ")}`,
        conditionsMatched: evaluation.conditionsMatched,
        rolesRemoved: removedRoleIds
      });

      // Delete user locally
      await deleteUsersByIds([user.id]);
      cleaned++;
    }

    // Update last run timestamp
    await db
      .update(membershipSettings)
      .set({ autoCleanupLastRun: new Date() })
      .where(eq(membershipSettings.id, MEMBERSHIP_SETTINGS_SINGLETON_ID));

    return {
      processed: allUsers.length,
      cleaned,
      skippedProtected,
      skippedBotUnavailable
    };
  } finally {
    running = false;
  }
}
