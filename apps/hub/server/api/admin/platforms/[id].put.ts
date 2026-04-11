import { eq } from "drizzle-orm";
import { platformConnections } from "@guildora/shared";
import type { PlatformCredentials } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { invalidatePlatformCache } from "../../../utils/platformConfig";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Platform connection ID is required." });
  }

  const body = await readBody<{
    credentials?: PlatformCredentials;
    botInternalUrl?: string | null;
    botInternalToken?: string | null;
    enabled?: boolean;
  }>(event);

  const updates: Partial<typeof platformConnections.$inferInsert> = {};

  if (body.credentials !== undefined) updates.credentials = body.credentials;
  if (body.botInternalUrl !== undefined) updates.botInternalUrl = body.botInternalUrl;
  if (body.botInternalToken !== undefined) updates.botInternalToken = body.botInternalToken;
  if (body.enabled !== undefined) updates.enabled = body.enabled;

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No updates provided." });
  }

  const db = getDb();
  const [updated] = await db
    .update(platformConnections)
    .set(updates)
    .where(eq(platformConnections.id, id))
    .returning({
      id: platformConnections.id,
      platform: platformConnections.platform,
      enabled: platformConnections.enabled,
      status: platformConnections.status
    });

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: "Platform connection not found." });
  }

  invalidatePlatformCache();
  return { ok: true, platform: updated };
});
