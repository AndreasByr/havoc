import { desc } from "drizzle-orm";
import { applicationAccessSettings } from "@guildora/shared";
import type { GuildoraDatabase } from "@guildora/shared/db/client";

export interface ApplicationAccessConfig {
  allowModeratorAccess: boolean;
}

export const defaultApplicationAccessConfig: ApplicationAccessConfig = {
  allowModeratorAccess: true
};

export function resolveAllowedApplicationRoles(config: ApplicationAccessConfig): string[] {
  return config.allowModeratorAccess
    ? ["moderator", "admin", "superadmin"]
    : ["admin", "superadmin"];
}

export function hasApplicationAccess(permissionRoles: string[], config: ApplicationAccessConfig): boolean {
  const allowed = resolveAllowedApplicationRoles(config);
  return allowed.some((role) => permissionRoles.includes(role));
}

export async function loadApplicationAccessConfig(db: GuildoraDatabase): Promise<ApplicationAccessConfig> {
  try {
    const [row] = await db
      .select({
        allowModeratorAccess: applicationAccessSettings.allowModeratorAccess
      })
      .from(applicationAccessSettings)
      .orderBy(desc(applicationAccessSettings.updatedAt))
      .limit(1);

    if (!row) {
      return defaultApplicationAccessConfig;
    }

    return {
      allowModeratorAccess: Boolean(row.allowModeratorAccess)
    };
  } catch {
    return defaultApplicationAccessConfig;
  }
}
