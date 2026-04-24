/**
 * Setup endpoint: creates the initial platform connection.
 *
 * Setup mode allows additive saves until both platforms are configured:
 * 1. Discord first (required) — no platform rows must exist.
 * 2. Matrix optional after Discord — no matrix row yet, but discord row exists.
 * Once both platforms are saved (or one platform after setup migration), this
 * endpoint returns 403 and operators are directed to Settings → Platforms.
 *
 * For Discord, the bot token is validated server-side against Discord's API
 * before persisting credentials.
 */
import { platformConnections } from "@guildora/shared";
import type { PlatformCredentials } from "@guildora/shared";
import { getDb } from "../../utils/db";
import { invalidatePlatformCache } from "../../utils/platformConfig";
import { validateDiscordToken } from "../../utils/validate-discord-token";

const VALID_PLATFORMS = ["discord", "matrix"] as const;

export default defineEventHandler(async (event) => {
  const db = getDb();

  // Read body early so we can inspect the platform type before any DB writes
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

  const platform = body.platform as "discord" | "matrix";

  // ── Discord required + Matrix optional setup semantics ─────────────────────────
  // Check what rows already exist so we can enforce additive-only semantics.
  const existingRows = await db
    .select({ id: platformConnections.id, platform: platformConnections.platform })
    .from(platformConnections);

  if (existingRows.length > 0) {
    const hasDiscord = existingRows.some((r) => r.platform === "discord");
    const hasMatrix = existingRows.some((r) => r.platform === "matrix");

    // Once a platform is configured, subsequent calls for the same platform are rejected.
    if ((platform === "discord" && hasDiscord) || (platform === "matrix" && hasMatrix)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Setup already completed. Use Settings → Platforms to manage connections."
      });
    }

    // Matrix can be added after Discord; Discord cannot be re-saved.
    if (platform === "matrix" && hasDiscord && !hasMatrix) {
      // Allowed — setup is still open for the optional Matrix platform.
    } else if (platform === "discord" && hasMatrix && !hasDiscord) {
      // Allowed — Matrix was saved first in a migration scenario; Discord can still complete setup.
    } else {
      throw createError({
        statusCode: 403,
        statusMessage: "Setup already completed. Use Settings → Platforms to manage connections."
      });
    }
  }

  // ── Discord bot-token validation (server-side, before persisting) ───────────
  if (platform === "discord") {
    const botToken = (body.credentials as { botToken?: string }).botToken;
    if (!botToken) {
      throw createError({ statusCode: 400, statusMessage: "Discord bot token is required." });
    }
    if (botToken.trim().length < 20) {
      throw createError({ statusCode: 400, statusMessage: "Discord bot token appears invalid — expected a 50+ character token." });
    }

    console.warn("[setup-validate] Validating Discord bot token against Discord API…");
    const validation = await validateDiscordToken(botToken);
    if (!validation.ok) {
      console.warn(`[setup-validate] Discord bot token validation failed: ${validation.reason}`);
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid Discord bot token: ${validation.reason}`
      });
    }
    console.warn("[setup-validate] Discord bot token validated successfully.");
  }

  // ── Persist platform connection ───────────────────────────────────────────────
  const [created] = await db
    .insert(platformConnections)
    .values({
      platform,
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

  // ── Optionally set community name and default locale ──────────────────────────
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
