/**
 * Tests for platformConfig utility:
 *   - getPlatformConnection() with DB and ENV fallback
 *   - Cache behavior
 *   - invalidatePlatformCache()
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { stubNuxtAutoImports, cleanupAutoImportStubs } from "./test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;

vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@guildora/shared", () => ({
  platformConnections: Symbol("platformConnections"),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
}));

beforeEach(() => {
  mocks = stubNuxtAutoImports();
  mocks.useRuntimeConfig.mockReturnValue({
    botInternalUrl: "",
    botInternalToken: "",
    oauth: { discord: { clientId: "", clientSecret: "" } },
  });
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  vi.clearAllMocks();
});

function mockDbWithRows(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => unknown) => resolve(rows);
  return chain;
}

describe("getPlatformConnection", () => {
  it("returns null when no DB entry and no ENV fallback for matrix", async () => {
    const { getDb } = await import("../db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbWithRows([]));

    const { getPlatformConnection, invalidatePlatformCache } = await import("../platformConfig");
    invalidatePlatformCache();

    const result = await getPlatformConnection("matrix");
    expect(result).toBeNull();
  });

  it("returns DB entry when available", async () => {
    const dbRow = {
      id: "db-1",
      platform: "discord",
      enabled: true,
      credentials: { botToken: "tok", clientId: "cid", clientSecret: "cs", guildId: "gid" },
      botInternalUrl: "http://bot:3050",
      botInternalToken: "secret",
      status: "connected",
      statusMessage: null,
      lastHealthCheck: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { getDb } = await import("../db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbWithRows([dbRow]));

    const { getPlatformConnection, invalidatePlatformCache } = await import("../platformConfig");
    invalidatePlatformCache();

    const result = await getPlatformConnection("discord");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("db-1");
    expect(result!.botInternalUrl).toBe("http://bot:3050");
  });

  it("falls back to ENV for discord when DB is empty", async () => {
    const { getDb } = await import("../db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbWithRows([]));

    // Set env vars
    process.env.DISCORD_BOT_TOKEN = "env-token";
    process.env.DISCORD_GUILD_ID = "env-guild";
    mocks.useRuntimeConfig.mockReturnValue({
      botInternalUrl: "http://env-bot:3050",
      botInternalToken: "env-secret",
      oauth: { discord: { clientId: "env-cid", clientSecret: "env-cs" } },
    });

    const { getPlatformConnection, invalidatePlatformCache } = await import("../platformConfig");
    invalidatePlatformCache();

    const result = await getPlatformConnection("discord");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("env-fallback-discord");
    expect(result!.botInternalUrl).toBe("http://env-bot:3050");

    delete process.env.DISCORD_BOT_TOKEN;
    delete process.env.DISCORD_GUILD_ID;
  });

  it("uses cache on second call", async () => {
    const dbRow = {
      id: "db-1",
      platform: "discord",
      enabled: true,
      credentials: {},
      botInternalUrl: "http://bot:3050",
      botInternalToken: null,
      status: "connected",
      statusMessage: null,
      lastHealthCheck: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { getDb } = await import("../db");
    const mockDb = mockDbWithRows([dbRow]);
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

    const { getPlatformConnection, invalidatePlatformCache } = await import("../platformConfig");
    invalidatePlatformCache();

    await getPlatformConnection("discord");
    await getPlatformConnection("discord");

    // getDb should only be called once (cached)
    expect(getDb).toHaveBeenCalledTimes(1);
  });
});

describe("invalidatePlatformCache", () => {
  it("forces re-read from DB after invalidation", async () => {
    const dbRow = {
      id: "db-1",
      platform: "discord",
      enabled: true,
      credentials: {},
      botInternalUrl: null,
      botInternalToken: null,
      status: "disconnected",
      statusMessage: null,
      lastHealthCheck: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { getDb } = await import("../db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbWithRows([dbRow]));

    const { getPlatformConnection, invalidatePlatformCache } = await import("../platformConfig");
    invalidatePlatformCache();

    await getPlatformConnection("discord");
    expect(getDb).toHaveBeenCalledTimes(1);

    invalidatePlatformCache();
    await getPlatformConnection("discord");
    expect(getDb).toHaveBeenCalledTimes(2);
  });
});
