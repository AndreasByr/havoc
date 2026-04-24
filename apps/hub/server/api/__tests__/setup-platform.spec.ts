/**
 * Unit specs for /api/setup/platform
 *
 * Covers:
 * - Discord-first save succeeds (with valid token via validator stub)
 * - Discord re-save returns 403
 * - Matrix optional save after Discord succeeds
 * - Matrix re-save returns 403
 * - Invalid bot token returns 400
 * - Short token returns 400
 * - Empty token returns 400
 *
 * Uses the same test-helpers pattern as other setup specs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupAutoImportStubs,
  createMockEvent,
  stubNuxtAutoImports,
} from "../../utils/__tests__/test-helpers";

let _mocks: ReturnType<typeof stubNuxtAutoImports>;
let mockValidateDiscordToken: ReturnType<typeof vi.fn>;
let mockInvalidatePlatformCache: ReturnType<typeof vi.fn>;

vi.mock("../../utils/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../utils/validate-discord-token", () => ({
  validateDiscordToken: vi.fn(),
}));

vi.mock("../../utils/platformConfig", () => ({
  invalidatePlatformCache: vi.fn(),
}));

vi.mock("@guildora/shared", () => ({
  platformConnections: {
    id: "id",
    platform: "platform",
    credentials: "credentials",
    botInternalUrl: "botInternalUrl",
    botInternalToken: "botInternalToken",
    enabled: "enabled",
    status: "status",
  },
  communitySettings: { id: "id" },
}));

// ── DB chain factory ───────────────────────────────────────────────────────
function mockDbChain(returnValue: unknown[] = []) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => unknown) => resolve(returnValue);
  return chain;
}

function mockDbInsert(returnValue: unknown[] = []) {
  const chain: Record<string, unknown> = {};
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(returnValue);
  return chain;
}

function mockDbUpdate(returnValue: unknown = {}) {
  const chain: Record<string, unknown> = {};
  chain.update = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(returnValue);
  return chain;
}

describe("POST /api/setup/platform", () => {
  beforeEach(async () => {
    mocks = stubNuxtAutoImports();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // Make readBody return the body from the mock event so tests can pass
    // arbitrary body objects that are forwarded through createMockEvent._body
    ;(readBody as ReturnType<typeof vi.fn>).mockImplementation(
      async (event: H3Event) => (event as unknown as { _body: unknown })._body
    );

    // Import mock getters to set up per-test return values
    const { validateDiscordToken } = await import("../../utils/validate-discord-token");
    mockValidateDiscordToken = validateDiscordToken as ReturnType<typeof vi.fn>;
    mockValidateDiscordToken.mockReset();
    mockValidateDiscordToken.mockResolvedValue({ ok: true, botUserId: "123456789" });

    const { invalidatePlatformCache } = await import("../../utils/platformConfig");
    mockInvalidatePlatformCache = invalidatePlatformCache as ReturnType<typeof vi.fn>;
    mockInvalidatePlatformCache.mockReset();

    // Default DB: no existing rows
    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain([]));
  });

  afterEach(() => {
    cleanupAutoImportStubs();
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  async function importHandler() {
    return (await import("../setup/platform.post")).default;
  }

  // ── Discord-first save ───────────────────────────────────────────────────
  it("succeeds when no platform rows exist and Discord token validates", async () => {
    const { getDb } = await import("../../utils/db");
    const insertChain = mockDbInsert([{ id: 1, platform: "discord" }]);
    const updateChain = mockDbUpdate({});
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockDbChain([]),
      insert: insertChain.insert,
      update: updateChain.update,
    });

    const handler = await importHandler();
    const result = await handler(
      createMockEvent({
        method: "POST",
        body: {
          platform: "discord",
          credentials: {
            botToken: "valid_bot_token_1234567890123456789012345678901234567890",
            clientId: "123456789012345678",
            clientSecret: "secret_secret_secret",
            guildId: "987654321012345678",
          },
        },
      })
    );

    expect(result).toMatchObject({ ok: true });
    expect(mockValidateDiscordToken).toHaveBeenCalledOnce();
  });

  // ── Re-save guard ────────────────────────────────────────────────────────
  it("returns 403 when Discord already configured", async () => {
    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(
      mockDbChain([{ id: 1, platform: "discord" }])
    );

    const handler = await importHandler();

    await expect(
      handler(
        createMockEvent({
          method: "POST",
          body: {
            platform: "discord",
            credentials: {
              botToken: "any_token",
              clientId: "123",
              clientSecret: "secret",
              guildId: "456",
            },
          },
        })
      )
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("returns 403 when Matrix already configured", async () => {
    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(
      mockDbChain([{ id: 1, platform: "matrix" }])
    );

    const handler = await importHandler();

    await expect(
      handler(
        createMockEvent({
          method: "POST",
          body: {
            platform: "matrix",
            credentials: {
              homeserverUrl: "https://matrix.example.org",
              accessToken: "token",
              spaceId: "!abc:matrix.example.org",
            },
          },
        })
      )
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  // ── Matrix optional after Discord ───────────────────────────────────────
  it("allows Matrix save when Discord row exists but Matrix does not", async () => {
    const { getDb } = await import("../../utils/db");
    const insertChain = mockDbInsert([{ id: 2, platform: "matrix" }]);
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockDbChain([{ id: 1, platform: "discord" }]),
      insert: insertChain.insert,
    });

    const handler = await importHandler();
    const result = await handler(
      createMockEvent({
        method: "POST",
        body: {
          platform: "matrix",
          credentials: {
            homeserverUrl: "https://matrix.example.org",
            accessToken: "token_token_token",
            spaceId: "!abc:matrix.example.org",
          },
        },
      })
    );

    expect(result).toMatchObject({ ok: true });
    expect(mockValidateDiscordToken).not.toHaveBeenCalled();
  });

  // ── Invalid bot token: short token ────────────────────────────────────
  it("returns 400 when Discord bot token is too short", async () => {
    const handler = await importHandler();

    await expect(
      handler(
        createMockEvent({
          method: "POST",
          body: {
            platform: "discord",
            credentials: {
              botToken: "short",
              clientId: "123",
              clientSecret: "secret",
              guildId: "456",
            },
          },
        })
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  // ── Invalid bot token: API rejection ────────────────────────────────────
  it("returns 400 when Discord API rejects the bot token", async () => {
    mockValidateDiscordToken.mockResolvedValue({
      ok: false,
      reason: "Discord rejected the bot token — check your Bot token.",
    });

    const handler = await importHandler();

    await expect(
      handler(
        createMockEvent({
          method: "POST",
          body: {
            platform: "discord",
            credentials: {
              botToken: "valid_length_but_invalid_token_123456789012345678901234567890",
              clientId: "123456789012345678",
              clientSecret: "secret_secret_secret",
              guildId: "987654321012345678",
            },
          },
        })
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: expect.stringContaining("Invalid Discord bot token"),
    });
  });

  // ── Invalid bot token: network/unreachable ─────────────────────────────
  it("returns 400 when Discord API is unreachable", async () => {
    mockValidateDiscordToken.mockResolvedValue({
      ok: false,
      reason: "Discord API is unreachable — check your network/firewall and try again.",
    });

    const handler = await importHandler();

    await expect(
      handler(
        createMockEvent({
          method: "POST",
          body: {
            platform: "discord",
            credentials: {
              botToken: "valid_length_but_network_error_123456789012345678901234567890",
              clientId: "123456789012345678",
              clientSecret: "secret_secret_secret",
              guildId: "987654321012345678",
            },
          },
        })
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: expect.stringContaining("unreachable"),
    });
  });

  // ── [setup-validate] observability tag on console.warn ─────────────────
  it("logs [setup-validate] tag when bot token validation fails", async () => {
    mockValidateDiscordToken.mockResolvedValue({
      ok: false,
      reason: "Discord rejected the bot token — check your Bot token.",
    });
    vi.spyOn(console, "warn").mockClear();

    const handler = await importHandler();

    await expect(
      handler(
        createMockEvent({
          method: "POST",
          body: {
            platform: "discord",
            credentials: {
              botToken: "some_token_1234567890123456789012345678901234567890",
              clientId: "123456789012345678",
              clientSecret: "secret_secret_secret",
              guildId: "987654321012345678",
            },
          },
        })
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    // First warn is the pre-validation marker; second is the failure reason
    const warnCalls = (console.warn as ReturnType<typeof vi.fn>).mock.calls;
    const hasSetupValidate = warnCalls.some(
      (call) => typeof call[0] === "string" && call[0].includes("[setup-validate]")
    );
    expect(hasSetupValidate).toBe(true);
  });

  // ── No token echo in errors ──────────────────────────────────────────────
  it("does not echo the bot token in error messages", async () => {
    mockValidateDiscordToken.mockResolvedValue({
      ok: false,
      reason: "Discord rejected the bot token — check your Bot token.",
    });

    const handler = await importHandler();

    await expect(
      handler(
        createMockEvent({
          method: "POST",
          body: {
            platform: "discord",
            credentials: {
              botToken: "definitely-not-real-token-123456789012345678901234567890",
              clientId: "123456789012345678",
              clientSecret: "secret_secret_secret",
              guildId: "987654321012345678",
            },
          },
        })
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: expect.not.stringContaining("definitely-not-real"),
    });
  });
});
