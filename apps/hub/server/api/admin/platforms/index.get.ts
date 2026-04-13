import { platformConnections } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { getPlatformConnection } from "../../../utils/platformConfig";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const db = getDb();
  const rows = await db
    .select({
      id: platformConnections.id,
      platform: platformConnections.platform,
      enabled: platformConnections.enabled,
      botInternalUrl: platformConnections.botInternalUrl,
      status: platformConnections.status,
      statusMessage: platformConnections.statusMessage,
      lastHealthCheck: platformConnections.lastHealthCheck,
      createdAt: platformConnections.createdAt,
      updatedAt: platformConnections.updatedAt
    })
    .from(platformConnections);

  // Include env-fallback Discord connection if not already in DB
  const hasDiscordInDb = rows.some((r) => r.platform === "discord");
  if (!hasDiscordInDb) {
    const envDiscord = await getPlatformConnection("discord");
    if (envDiscord) {
      rows.push({
        id: envDiscord.id,
        platform: envDiscord.platform,
        enabled: envDiscord.enabled,
        botInternalUrl: envDiscord.botInternalUrl,
        status: envDiscord.status,
        statusMessage: envDiscord.statusMessage,
        lastHealthCheck: envDiscord.lastHealthCheck,
        createdAt: envDiscord.createdAt,
        updatedAt: envDiscord.updatedAt
      });
    }
  }

  // Never expose credentials or tokens in list response
  return { platforms: rows };
});
