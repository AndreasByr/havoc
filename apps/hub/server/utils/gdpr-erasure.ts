import { eq } from "drizzle-orm";
import {
  applicationFlows,
  applications,
  cleanupLog,
  communityRoles,
  permissionRoles,
  profiles,
  userCommunityRoles,
  userPermissionRoles,
  userPlatformAccounts,
  users,
  voiceSessions
} from "@guildora/shared";
import { deleteUsersByIds } from "./admin-mirror";
import { getDb } from "./db";
import { requestPlatform } from "./platformBridge";

type ExternalOperationResult = {
  attempted: boolean;
  success: boolean;
  error?: string;
};

export async function executeGdprErasure(userId: string, reviewedBy: string) {
  const db = getDb();

  const [userRow] = await db
    .select({
      discordId: users.discordId,
      displayName: users.displayName
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRow) {
    return {
      success: false,
      externalResults: {
        discord: { attempted: false, success: false, error: "User not found" } as ExternalOperationResult,
        matrix: { attempted: false, success: false, error: "User not found" } as ExternalOperationResult
      }
    };
  }

  const roleRows = await db
    .select({ roleName: communityRoles.name })
    .from(userCommunityRoles)
    .innerJoin(communityRoles, eq(userCommunityRoles.communityRoleId, communityRoles.id))
    .where(eq(userCommunityRoles.userId, userId));

  const rolesRemoved = roleRows.map((row) => row.roleName);

  const platformAccounts = await db
    .select({
      platform: userPlatformAccounts.platform,
      platformUserId: userPlatformAccounts.platformUserId
    })
    .from(userPlatformAccounts)
    .where(eq(userPlatformAccounts.userId, userId));

  const discordAccount = platformAccounts.find((account) => account.platform === "discord");
  const matrixAccount = platformAccounts.find((account) => account.platform === "matrix");

  const deletedCount = await deleteUsersByIds([userId]);
  const success = deletedCount > 0;

  const externalResults: { discord: ExternalOperationResult; matrix: ExternalOperationResult } = {
    discord: { attempted: Boolean(discordAccount), success: false },
    matrix: { attempted: Boolean(matrixAccount), success: false }
  };

  if (discordAccount) {
    try {
      const encodedId = encodeURIComponent(discordAccount.platformUserId);
      await requestPlatform("discord", `/internal/guild/members/${encodedId}/ban`, {
        method: "POST",
        body: { deleteMessageSeconds: 604800 }
      });
      externalResults.discord.success = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      externalResults.discord.error = message;
      await db.insert(cleanupLog).values({
        userId: null,
        discordId: discordAccount.platformUserId,
        discordUsername: userRow.displayName,
        reason: `gdpr_erasure_external_discord_failed:${message}`,
        conditionsMatched: ["user_request", "discord_ban_failed"],
        rolesRemoved
      });
    }
  }

  if (matrixAccount) {
    try {
      const encodedMxid = encodeURIComponent(matrixAccount.platformUserId);
      await requestPlatform("matrix", `/internal/guild/members/${encodedMxid}/kick`, {
        method: "POST"
      });
      externalResults.matrix.success = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      externalResults.matrix.error = message;
      await db.insert(cleanupLog).values({
        userId: null,
        discordId: userRow.discordId ?? discordAccount?.platformUserId ?? "unknown",
        discordUsername: userRow.displayName,
        reason: `gdpr_erasure_external_matrix_failed:${message}`,
        conditionsMatched: ["user_request", "matrix_kick_failed"],
        rolesRemoved
      });
    }
  }

  await db.insert(cleanupLog).values({
    userId: null,
    discordId: userRow.discordId ?? discordAccount?.platformUserId ?? "unknown",
    discordUsername: userRow.displayName,
    reason: "gdpr_erasure",
    conditionsMatched: ["user_request"],
    rolesRemoved
  });

  void reviewedBy;

  return {
    success,
    externalResults
  };
}

export async function assembleUserDataExport(userId: string) {
  const db = getDb();

  const [userRow] = await db
    .select({
      id: users.id,
      discordId: users.discordId,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      primaryPlatform: users.primaryPlatform,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [profileRow] = await db
    .select({
      customFields: profiles.customFields,
      localePreference: profiles.localePreference,
      updatedAt: profiles.updatedAt
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  const [communityRoleRows, permissionRoleRows, voiceHistoryRows, applicationRows, platformAccountRows] = await Promise.all([
    db
      .select({
        communityRoleName: communityRoles.name,
        assignedAt: userCommunityRoles.assignedAt
      })
      .from(userCommunityRoles)
      .innerJoin(communityRoles, eq(userCommunityRoles.communityRoleId, communityRoles.id))
      .where(eq(userCommunityRoles.userId, userId)),
    db
      .select({
        permissionRoleName: permissionRoles.name,
        assignedAt: userPermissionRoles.assignedAt
      })
      .from(userPermissionRoles)
      .innerJoin(permissionRoles, eq(userPermissionRoles.permissionRoleId, permissionRoles.id))
      .where(eq(userPermissionRoles.userId, userId)),
    db
      .select({
        id: voiceSessions.id,
        platform: voiceSessions.platform,
        channelId: voiceSessions.channelId,
        startedAt: voiceSessions.startedAt,
        endedAt: voiceSessions.endedAt,
        durationMinutes: voiceSessions.durationMinutes
      })
      .from(voiceSessions)
      .where(eq(voiceSessions.userId, userId)),
    db
      .select({
        id: applications.id,
        flowId: applications.flowId,
        flowName: applicationFlows.name,
        status: applications.status,
        answersJson: applications.answersJson,
        rolesAssigned: applications.rolesAssigned,
        pendingRoleAssignments: applications.pendingRoleAssignments,
        displayNameComposed: applications.displayNameComposed,
        reviewedAt: applications.reviewedAt,
        createdAt: applications.createdAt,
        updatedAt: applications.updatedAt
      })
      .from(applications)
      .innerJoin(applicationFlows, eq(applications.flowId, applicationFlows.id))
      .where(eq(applications.discordId, userRow?.discordId ?? "")),
    db
      .select({
        platform: userPlatformAccounts.platform,
        platformUserId: userPlatformAccounts.platformUserId,
        platformUsername: userPlatformAccounts.platformUsername,
        platformAvatarUrl: userPlatformAccounts.platformAvatarUrl,
        isPrimary: userPlatformAccounts.isPrimary,
        linkedAt: userPlatformAccounts.linkedAt
      })
      .from(userPlatformAccounts)
      .where(eq(userPlatformAccounts.userId, userId))
  ]);

  return {
    profile: {
      ...userRow,
      profile: profileRow ?? null
    },
    roles: {
      community: communityRoleRows,
      permission: permissionRoleRows
    },
    voiceHistory: voiceHistoryRows,
    applications: applicationRows,
    platformAccounts: platformAccountRows,
    exportedAt: new Date().toISOString()
  };
}
