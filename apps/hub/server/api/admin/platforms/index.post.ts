import { platformConnections } from "@guildora/shared";
import type { PlatformCredentials } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { invalidatePlatformCache } from "../../../utils/platformConfig";

const VALID_PLATFORMS = ["discord", "matrix"] as const;

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const body = await readBody<{
    platform: string;
    credentials: PlatformCredentials;
    botInternalUrl?: string;
    botInternalToken?: string;
  }>(event);

  if (!body?.platform || !VALID_PLATFORMS.includes(body.platform as (typeof VALID_PLATFORMS)[number])) {
    throw createError({ statusCode: 400, statusMessage: "Invalid platform. Must be 'discord' or 'matrix'." });
  }

  if (!body.credentials || typeof body.credentials !== "object") {
    throw createError({ statusCode: 400, statusMessage: "Credentials are required." });
  }

  // Validate platform-specific credentials
  if (body.platform === "discord") {
    const creds = body.credentials as Record<string, unknown>;
    if (!creds.botToken || !creds.clientId || !creds.guildId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Discord requires botToken, clientId, and guildId."
      });
    }
  } else if (body.platform === "matrix") {
    const creds = body.credentials as Record<string, unknown>;
    if (!creds.homeserverUrl || !creds.accessToken || !creds.spaceId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Matrix requires homeserverUrl, accessToken, and spaceId."
      });
    }
  }

  const db = getDb();

  try {
    const [created] = await db
      .insert(platformConnections)
      .values({
        platform: body.platform as "discord" | "matrix",
        credentials: body.credentials,
        botInternalUrl: body.botInternalUrl ?? null,
        botInternalToken: body.botInternalToken ?? null,
        enabled: true,
        status: "disconnected"
      })
      .returning({
        id: platformConnections.id,
        platform: platformConnections.platform,
        enabled: platformConnections.enabled,
        status: platformConnections.status
      });

    invalidatePlatformCache();
    return { ok: true, platform: created };
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === "23505") {
      throw createError({
        statusCode: 409,
        statusMessage: `Platform '${body.platform}' is already connected.`
      });
    }
    throw error;
  }
});
