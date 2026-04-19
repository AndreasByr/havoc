/**
 * Public endpoint: returns whether the community needs initial setup.
 * Used by the setup wizard to determine if it should show.
 */
import { platformConnections } from "@guildora/shared";
import { createError } from "h3";
import { getDb } from "../../utils/db";

export default defineEventHandler(async () => {
  const db = getDb();
  try {
  const rows = await db.select({ id: platformConnections.id }).from(platformConnections).limit(1);
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }
  const hasAnyPlatform = rows.length > 0;

  // Also check ENV fallback
  const hasEnvDiscord = !!(process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_GUILD_ID);

  return {
    needsSetup: !hasAnyPlatform && !hasEnvDiscord,
    hasPlatforms: hasAnyPlatform,
    hasEnvFallback: hasEnvDiscord,
  };
});
