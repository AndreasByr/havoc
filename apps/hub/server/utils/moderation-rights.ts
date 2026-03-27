import { desc } from "drizzle-orm";
import { cmsAccessSettings } from "@guildora/shared";
import type { GuildoraDatabase } from "@guildora/shared/db/client";
import { requireSession } from "./auth";

export interface ModerationRights {
  modDeleteUsers: boolean;
  modManageApplications: boolean;
  modAccessCommunitySettings: boolean;
  modAccessDesign: boolean;
  modAccessApps: boolean;
  modAccessDiscordRoles: boolean;
  modAccessCustomFields: boolean;
  modAccessPermissions: boolean;
  allowModeratorAccess: boolean;
  allowModeratorAppsAccess: boolean;
}

export const defaultModerationRights: ModerationRights = {
  modDeleteUsers: false,
  modManageApplications: false,
  modAccessCommunitySettings: false,
  modAccessDesign: false,
  modAccessApps: false,
  modAccessDiscordRoles: false,
  modAccessCustomFields: false,
  modAccessPermissions: false,
  allowModeratorAccess: true,
  allowModeratorAppsAccess: true
};

export const moderationRightKeys = [
  "modDeleteUsers",
  "modManageApplications",
  "modAccessCommunitySettings",
  "modAccessDesign",
  "modAccessApps",
  "modAccessDiscordRoles",
  "modAccessCustomFields",
  "modAccessPermissions",
  "allowModeratorAccess",
  "allowModeratorAppsAccess"
] as const;

export type ModerationRightKey = (typeof moderationRightKeys)[number];

interface DbErrorLike {
  code?: string;
  message?: string;
}

function isMissingColumnError(error: unknown): boolean {
  const dbError = error as DbErrorLike;
  return dbError?.code === "42703";
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let moderationRightsCache: { value: ModerationRights; expiresAt: number } | null = null;

export function invalidateModerationRightsCache() {
  moderationRightsCache = null;
}

export async function loadModerationRights(db: GuildoraDatabase): Promise<ModerationRights> {
  const now = Date.now();
  if (moderationRightsCache && now < moderationRightsCache.expiresAt) {
    return moderationRightsCache.value;
  }

  try {
    const [row] = await db
      .select({
        modDeleteUsers: cmsAccessSettings.modDeleteUsers,
        modManageApplications: cmsAccessSettings.modManageApplications,
        modAccessCommunitySettings: cmsAccessSettings.modAccessCommunitySettings,
        modAccessDesign: cmsAccessSettings.modAccessDesign,
        modAccessApps: cmsAccessSettings.modAccessApps,
        modAccessDiscordRoles: cmsAccessSettings.modAccessDiscordRoles,
        modAccessCustomFields: cmsAccessSettings.modAccessCustomFields,
        modAccessPermissions: cmsAccessSettings.modAccessPermissions,
        allowModeratorAccess: cmsAccessSettings.allowModeratorAccess,
        allowModeratorAppsAccess: cmsAccessSettings.allowModeratorAppsAccess
      })
      .from(cmsAccessSettings)
      .orderBy(desc(cmsAccessSettings.updatedAt))
      .limit(1);

    if (!row) {
      return defaultModerationRights;
    }

    const value: ModerationRights = {
      modDeleteUsers: Boolean(row.modDeleteUsers),
      modManageApplications: Boolean(row.modManageApplications),
      modAccessCommunitySettings: Boolean(row.modAccessCommunitySettings),
      modAccessDesign: Boolean(row.modAccessDesign),
      modAccessApps: Boolean(row.modAccessApps),
      modAccessDiscordRoles: Boolean(row.modAccessDiscordRoles),
      modAccessCustomFields: Boolean(row.modAccessCustomFields),
      modAccessPermissions: Boolean(row.modAccessPermissions),
      allowModeratorAccess: Boolean(row.allowModeratorAccess),
      allowModeratorAppsAccess: Boolean(row.allowModeratorAppsAccess)
    };
    moderationRightsCache = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  } catch (error) {
    if (isMissingColumnError(error)) {
      return defaultModerationRights;
    }
    throw error;
  }
}

export async function requireModeratorRight(
  event: Parameters<typeof requireSession>[0],
  right: ModerationRightKey
) {
  const session = await requireSession(event);
  const roles = session.user.permissionRoles ?? session.user.roles ?? [];

  if (roles.includes("admin") || roles.includes("superadmin")) {
    return session;
  }

  if (!roles.includes("moderator")) {
    throw createError({ statusCode: 403, statusMessage: "Forbidden." });
  }

  const db = getDb();
  const rights = await loadModerationRights(db);

  if (!rights[right]) {
    throw createError({ statusCode: 403, statusMessage: "Forbidden." });
  }

  return session;
}
