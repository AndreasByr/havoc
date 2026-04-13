/**
 * Setup endpoint: creates the initial platform connection.
 * Only works when no platform connections exist yet (setup mode).
 * After the first platform is configured, this endpoint returns 403.
 */
import { platformConnections } from "@guildora/shared";
import type { PlatformCredentials } from "@guildora/shared";
import { getDb } from "../../utils/db";
import { invalidatePlatformCache } from "../../utils/platformConfig";

const VALID_PLATFORMS = ["discord", "matrix"] as const;

export default defineEventHandler(async (event) => {
  const db = getDb();

  // Check if setup is still needed
  const existing = await db.select({ id: platformConnections.id }).from(platformConnections).limit(1);
  if (existing.length > 0) {
    throw createError({ statusCode: 403, statusMessage: "Setup already completed. Use Settings → Platforms to manage connections." });
  }

  const body = await readBody<{
    platform: string;
    credentials: PlatformCredentials;
    botInternalUrl?: string;
    botInternalToken?: string;
    communityName?: string;
    defaultLocale?: "en" | "de";
  }>(event);

  if (!body?.platform || !VALID_PLATFORMS.includes(body.platform as (typeof VALID_PLATFORMS)[number])) {
    throw createError({ statusCode: 400, statusMessage: "Invalid platform." });
  }

  if (!body.credentials || typeof body.credentials !== "object") {
    throw createError({ statusCode: 400, statusMessage: "Credentials are required." });
  }

  // Create the platform connection
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
    });

  invalidatePlatformCache();

  // Optionally set community name and default locale
  if (body.communityName || body.defaultLocale) {
    try {
      const { communitySettings } = await import("@guildora/shared");
      const { eq } = await import("drizzle-orm");
      const updates: Record<string, unknown> = {};
      if (body.communityName) updates.communityName = body.communityName;
      if (body.defaultLocale && (body.defaultLocale === "en" || body.defaultLocale === "de")) {
        updates.defaultLocale = body.defaultLocale;
      }
      await db
        .update(communitySettings)
        .set(updates)
        .where(eq(communitySettings.id, 1));
    } catch {
      // Community settings may not exist yet — ignore
    }
  }

  return { ok: true, platform: created };
});
