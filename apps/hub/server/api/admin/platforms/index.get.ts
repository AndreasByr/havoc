import { platformConnections } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";

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

  // Never expose credentials or tokens in list response
  return { platforms: rows };
});
