import { platformConnections } from "@guildora/shared";
import type { DiscordPlatformCredentials, MatrixPlatformCredentials } from "@guildora/shared";
import { getDb } from "./db";

export type PlatformType = "discord" | "matrix";

export type PlatformConnectionRow = typeof platformConnections.$inferSelect;

// ─── Cache ──────────────────────────────────────────────────────────────────

let cachedConnections: Map<PlatformType, PlatformConnectionRow> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

export function invalidatePlatformCache() {
  cachedConnections = null;
  cacheTimestamp = 0;
}

async function loadConnections(): Promise<Map<PlatformType, PlatformConnectionRow>> {
  const now = Date.now();
  if (cachedConnections && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConnections;
  }

  const db = getDb();
  const rows = await db.select().from(platformConnections);

  const map = new Map<PlatformType, PlatformConnectionRow>();
  for (const row of rows) {
    map.set(row.platform as PlatformType, row);
  }

  cachedConnections = map;
  cacheTimestamp = now;
  return map;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get the platform connection config for a given platform.
 * Falls back to .env variables for Discord if no DB entry exists.
 */
export async function getPlatformConnection(platform: PlatformType): Promise<PlatformConnectionRow | null> {
  const connections = await loadConnections();
  const fromDb = connections.get(platform) ?? null;
  if (fromDb) return fromDb;

  // ENV fallback only for Discord
  if (platform === "discord") {
    return getDiscordEnvFallback();
  }

  return null;
}

/** Get bot connection details (URL + token) for a platform. */
export async function getPlatformBotConfig(platform: PlatformType): Promise<{ baseUrl: string; token: string } | null> {
  const connection = await getPlatformConnection(platform);
  if (!connection?.enabled) return null;

  const baseUrl = connection.botInternalUrl;
  const token = connection.botInternalToken ?? "";

  if (!baseUrl) return null;
  return { baseUrl, token };
}

/** Get all active platform connections. */
export async function getActivePlatforms(): Promise<PlatformConnectionRow[]> {
  const connections = await loadConnections();
  return Array.from(connections.values()).filter((c) => c.enabled);
}

/** Check if a specific platform is connected and enabled. */
export async function isPlatformActive(platform: PlatformType): Promise<boolean> {
  const connection = await getPlatformConnection(platform);
  return connection?.enabled === true;
}

/** Get credentials for a platform (typed). */
export async function getDiscordCredentials(): Promise<DiscordPlatformCredentials | null> {
  const connection = await getPlatformConnection("discord");
  if (!connection?.enabled) return null;
  return connection.credentials as DiscordPlatformCredentials;
}

export async function getMatrixCredentials(): Promise<MatrixPlatformCredentials | null> {
  const connection = await getPlatformConnection("matrix");
  if (!connection?.enabled) return null;
  return connection.credentials as MatrixPlatformCredentials;
}

// ─── ENV Fallback ───────────────────────────────────────────────────────────

/**
 * Build a virtual PlatformConnectionRow from .env variables.
 * This allows existing Discord-only setups to work without DB migration.
 */
function getDiscordEnvFallback(): PlatformConnectionRow | null {
  const runtime = useRuntimeConfig();

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const clientId = (runtime.oauth?.discord?.clientId as string) ?? process.env.NUXT_OAUTH_DISCORD_CLIENT_ID;
  const clientSecret = (runtime.oauth?.discord?.clientSecret as string) ?? process.env.NUXT_OAUTH_DISCORD_CLIENT_SECRET;
  const guildId = process.env.DISCORD_GUILD_ID;
  const botInternalUrl = typeof runtime.botInternalUrl === "string" ? runtime.botInternalUrl : "";
  const botInternalToken = typeof runtime.botInternalToken === "string" ? runtime.botInternalToken : "";

  if (!botToken && !clientId && !guildId) return null;

  return {
    id: "env-fallback-discord",
    platform: "discord",
    enabled: true,
    credentials: {
      botToken: botToken ?? "",
      clientId: clientId ?? "",
      clientSecret: clientSecret ?? "",
      guildId: guildId ?? ""
    } satisfies DiscordPlatformCredentials,
    botInternalUrl: botInternalUrl || null,
    botInternalToken: botInternalToken || null,
    status: "connected",
    statusMessage: "Configured via environment variables",
    lastHealthCheck: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}
