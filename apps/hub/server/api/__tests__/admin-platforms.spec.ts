/**
 * Tests for admin platform connection endpoints:
 *   - GET    /api/admin/platforms
 *   - POST   /api/admin/platforms
 *   - PUT    /api/admin/platforms/[id]
 *   - DELETE /api/admin/platforms/[id]
 *   - POST   /api/admin/platforms/[id]/test
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildSession,
  createMockEvent,
  stubNuxtAutoImports,
  cleanupAutoImportStubs,
} from "../../utils/__tests__/test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;

// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock("../../utils/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../utils/platformConfig", () => ({
  invalidatePlatformCache: vi.fn(),
}));

vi.mock("@guildora/shared", () => ({
  platformConnections: {
    id: "id",
    platform: "platform",
    enabled: "enabled",
    credentials: "credentials",
    botInternalUrl: "bot_internal_url",
    botInternalToken: "bot_internal_token",
    status: "status",
    statusMessage: "status_message",
    lastHealthCheck: "last_health_check",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
}));

beforeEach(() => {
  mocks = stubNuxtAutoImports();
  vi.stubGlobal("readBody", vi.fn());
  vi.stubGlobal("getRouterParam", vi.fn());
  vi.stubGlobal("$fetch", vi.fn());
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  vi.clearAllMocks();
});

// ─── Helper: mock DB chain ──────────────────────────────────────────────────

function mockDbChain(returnValue: unknown = []) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: Function) => resolve(returnValue);
  return chain;
}

// ─── GET /api/admin/platforms ───────────────────────────────────────────────

describe("admin platform listing (GET /api/admin/platforms)", () => {
  async function importHandler() {
    return (await import("../admin/platforms/index.get")).default;
  }

  it("requires admin session", async () => {
    const adminSession = buildSession("user"); // non-admin
    mocks.requireUserSession.mockResolvedValue(adminSession);

    const handler = await importHandler();
    const event = createMockEvent({ method: "GET" });

    await expect(handler(event)).rejects.toThrow("Forbidden");
  });

  it("returns empty list when no platforms configured", async () => {
    const adminSession = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(adminSession);

    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain([]));

    const handler = await importHandler();
    const event = createMockEvent({ method: "GET" });
    const result = await handler(event);

    expect(result).toEqual({ platforms: [] });
  });

  it("returns configured platforms without credentials", async () => {
    const adminSession = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(adminSession);

    const mockPlatforms = [
      {
        id: "p1",
        platform: "discord",
        enabled: true,
        botInternalUrl: "http://bot:3050",
        status: "connected",
        statusMessage: null,
        lastHealthCheck: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];

    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain(mockPlatforms));

    const handler = await importHandler();
    const event = createMockEvent({ method: "GET" });
    const result = await handler(event);

    expect(result.platforms).toHaveLength(1);
    expect(result.platforms[0].platform).toBe("discord");
    // credentials should NOT be in the response
    expect((result.platforms[0] as Record<string, unknown>).credentials).toBeUndefined();
  });
});

// ─── POST /api/admin/platforms ──────────────────────────────────────────────

describe("admin platform create (POST /api/admin/platforms)", () => {
  async function importHandler() {
    return (await import("../admin/platforms/index.post")).default;
  }

  it("requires admin session", async () => {
    const userSession = buildSession("user");
    mocks.requireUserSession.mockResolvedValue(userSession);

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST" });

    await expect(handler(event)).rejects.toThrow("Forbidden");
  });

  it("rejects invalid platform type", async () => {
    const adminSession = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(adminSession);

    const readBodyMock = vi.fn().mockResolvedValue({ platform: "slack", credentials: {} });
    vi.stubGlobal("readBody", readBodyMock);

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST" });

    await expect(handler(event)).rejects.toThrow("Invalid platform");
  });

  it("rejects Discord without required credentials", async () => {
    const adminSession = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(adminSession);

    const readBodyMock = vi.fn().mockResolvedValue({
      platform: "discord",
      credentials: { botToken: "abc" }, // missing clientId, guildId
    });
    vi.stubGlobal("readBody", readBodyMock);

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST" });

    await expect(handler(event)).rejects.toThrow("Discord requires");
  });

  it("rejects Matrix without required credentials", async () => {
    const adminSession = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(adminSession);

    const readBodyMock = vi.fn().mockResolvedValue({
      platform: "matrix",
      credentials: { homeserverUrl: "https://matrix.example.org" }, // missing accessToken, spaceId
    });
    vi.stubGlobal("readBody", readBodyMock);

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST" });

    await expect(handler(event)).rejects.toThrow("Matrix requires");
  });

  it("creates Discord connection with valid credentials", async () => {
    const adminSession = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(adminSession);

    const readBodyMock = vi.fn().mockResolvedValue({
      platform: "discord",
      credentials: {
        botToken: "test-token",
        clientId: "123",
        clientSecret: "secret",
        guildId: "456",
      },
      botInternalUrl: "http://bot:3050",
    });
    vi.stubGlobal("readBody", readBodyMock);

    const createdRow = { id: "new-id", platform: "discord", enabled: true, status: "disconnected" };
    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain([createdRow]));

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST" });
    const result = await handler(event);

    expect(result.ok).toBe(true);
    expect(result.platform.platform).toBe("discord");
  });

  it("creates Matrix connection with valid credentials", async () => {
    const adminSession = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(adminSession);

    const readBodyMock = vi.fn().mockResolvedValue({
      platform: "matrix",
      credentials: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "syt_abc123",
        spaceId: "!space:matrix.example.org",
      },
    });
    vi.stubGlobal("readBody", readBodyMock);

    const createdRow = { id: "new-id", platform: "matrix", enabled: true, status: "disconnected" };
    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain([createdRow]));

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST" });
    const result = await handler(event);

    expect(result.ok).toBe(true);
    expect(result.platform.platform).toBe("matrix");
  });
});

// ─── DELETE /api/admin/platforms/[id] ───────────────────────────────────────

describe("admin platform delete (DELETE /api/admin/platforms/[id])", () => {
  async function importHandler() {
    return (await import("../admin/platforms/[id].delete")).default;
  }

  it("requires admin session", async () => {
    const userSession = buildSession("moderator");
    mocks.requireUserSession.mockResolvedValue(userSession);

    const handler = await importHandler();
    const event = createMockEvent({ method: "DELETE" });

    await expect(handler(event)).rejects.toThrow("Forbidden");
  });

  it("returns 404 for non-existent connection", async () => {
    const adminSession = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(adminSession);
    vi.stubGlobal("getRouterParam", vi.fn(() => "non-existent-id"));

    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain([]));

    const handler = await importHandler();
    const event = createMockEvent({ method: "DELETE" });

    await expect(handler(event)).rejects.toThrow("not found");
  });

  it("deletes existing connection", async () => {
    const adminSession = buildSession("superadmin");
    mocks.requireUserSession.mockResolvedValue(adminSession);
    vi.stubGlobal("getRouterParam", vi.fn(() => "existing-id"));

    const deletedRow = { id: "existing-id", platform: "matrix" };
    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain([deletedRow]));

    const handler = await importHandler();
    const event = createMockEvent({ method: "DELETE" });
    const result = await handler(event);

    expect(result.ok).toBe(true);
    expect(result.deleted.platform).toBe("matrix");
  });
});
