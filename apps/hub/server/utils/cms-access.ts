import { desc } from "drizzle-orm";
import { cmsAccessSettings } from "@guildora/shared";
import type { GuildoraDatabase } from "@guildora/shared/db/client";

export interface CmsAccessConfig {
  allowModeratorAccess: boolean;
  allowModeratorAppsAccess: boolean;
}

export const defaultCmsAccessConfig: CmsAccessConfig = {
  allowModeratorAccess: true,
  allowModeratorAppsAccess: true
};

export function resolveAllowedCmsRoles(config: CmsAccessConfig): string[] {
  return config.allowModeratorAccess
    ? ["moderator", "admin", "superadmin"]
    : ["admin", "superadmin"];
}

export function resolveAllowedAppsRoles(config: CmsAccessConfig): string[] {
  return config.allowModeratorAppsAccess
    ? ["moderator", "admin", "superadmin"]
    : ["admin", "superadmin"];
}

export function hasCmsAccess(permissionRoles: string[], config: CmsAccessConfig): boolean {
  const allowed = resolveAllowedCmsRoles(config);
  return allowed.some((role) => permissionRoles.includes(role));
}

interface DbErrorLike {
  code?: string;
  message?: string;
}

function isMissingColumnError(error: unknown): boolean {
  const dbError = error as DbErrorLike;
  return dbError?.code === "42703" || dbError?.message?.includes("allow_moderator_apps_access") === true;
}

function isMissingTableError(error: unknown): boolean {
  const dbError = error as DbErrorLike;
  return dbError?.code === "42P01";
}

export async function loadCmsAccessConfig(db: GuildoraDatabase): Promise<CmsAccessConfig> {
  try {
    const [row] = await db
      .select({
        allowModeratorAccess: cmsAccessSettings.allowModeratorAccess,
        allowModeratorAppsAccess: cmsAccessSettings.allowModeratorAppsAccess
      })
      .from(cmsAccessSettings)
      .orderBy(desc(cmsAccessSettings.updatedAt))
      .limit(1);

    if (!row) {
      return defaultCmsAccessConfig;
    }

    return {
      allowModeratorAccess: Boolean(row.allowModeratorAccess),
      allowModeratorAppsAccess: Boolean(row.allowModeratorAppsAccess)
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      return defaultCmsAccessConfig;
    }
    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  const [legacyRow] = await db
    .select({
      allowModeratorAccess: cmsAccessSettings.allowModeratorAccess
    })
    .from(cmsAccessSettings)
    .orderBy(desc(cmsAccessSettings.updatedAt))
    .limit(1)
    .catch((legacyError: unknown) => {
      if (isMissingTableError(legacyError)) {
        return [];
      }
      throw legacyError;
    });

  if (!legacyRow) {
    return defaultCmsAccessConfig;
  }

  return {
    allowModeratorAccess: Boolean(legacyRow.allowModeratorAccess),
    allowModeratorAppsAccess: defaultCmsAccessConfig.allowModeratorAppsAccess
  };
}
