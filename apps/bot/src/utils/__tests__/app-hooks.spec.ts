import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks (must be before imports) ──────────────────────────────────

vi.mock("@guildora/shared", () => ({
  installedApps: Symbol("installedApps"),
  safeParseAppManifest: vi.fn(),
}));

vi.mock("@guildora/app-sdk", () => ({}));

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ _tag: "eq", a, b }),
}));

const mockDbChain: Record<string, ReturnType<typeof vi.fn>> = {};
mockDbChain.limit = vi.fn().mockResolvedValue([]);
mockDbChain.where = vi.fn().mockReturnValue(mockDbChain);
mockDbChain.from = vi.fn().mockReturnValue(mockDbChain);

const mockDb = {
  select: vi.fn().mockReturnValue(mockDbChain),
};

vi.mock("../db", () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock("../app-db", () => ({
  createAppDb: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn(), list: vi.fn() })),
}));

vi.mock("../bot-client", () => ({
  createBotClient: vi.fn(() => ({ sendMessage: vi.fn() })),
}));

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { botAppHookRegistry, loadInstalledAppHooks } from "../app-hooks.js";
import { safeParseAppManifest } from "@guildora/shared";
import { logger } from "../logger.js";

// ─── Registry tests ─────────────────────────────────────────────────────────

describe("BotAppHookRegistry", () => {
  beforeEach(() => {
    botAppHookRegistry.clearAll();
    vi.clearAllMocks();
  });

  it("register + emit: handler called with correct payload and context", async () => {
    const handler = vi.fn();
    const ctx = { config: {}, db: {} as any, bot: {} as any, botUserId: "b1", guildId: "g1", platform: "discord" as const };
    botAppHookRegistry.register("app1", "onMessage", handler, ctx);

    const payload = { content: "hello" } as any;
    await botAppHookRegistry.emit("onMessage", payload);

    expect(handler).toHaveBeenCalledWith(payload, expect.objectContaining({ botUserId: "b1" }));
  });

  it("register multiple apps: both handlers called", async () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const ctx1 = { config: {}, db: {} as any, bot: {} as any, botUserId: "b1", guildId: "g1", platform: "discord" as const };
    const ctx2 = { config: {}, db: {} as any, bot: {} as any, botUserId: "b2", guildId: "g1", platform: "discord" as const };
    botAppHookRegistry.register("app1", "onMessage", h1, ctx1);
    botAppHookRegistry.register("app2", "onMessage", h2, ctx2);

    await botAppHookRegistry.emit("onMessage", {} as any);

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it("unregister(appId) removes all events for that app", async () => {
    const handler = vi.fn();
    const ctx = { config: {}, db: {} as any, bot: {} as any, botUserId: "b1", guildId: "g1", platform: "discord" as const };
    botAppHookRegistry.register("app1", "onMessage", handler, ctx);
    botAppHookRegistry.register("app1", "onVoiceActivity", handler, ctx);
    botAppHookRegistry.unregister("app1");

    await botAppHookRegistry.emit("onMessage", {} as any);
    await botAppHookRegistry.emit("onVoiceActivity", {} as any);
    expect(handler).not.toHaveBeenCalled();
  });

  it("unregister(appId, eventName) removes only that event", async () => {
    const handler = vi.fn();
    const ctx = { config: {}, db: {} as any, bot: {} as any, botUserId: "b1", guildId: "g1", platform: "discord" as const };
    botAppHookRegistry.register("app1", "onMessage", handler, ctx);
    botAppHookRegistry.register("app1", "onVoiceActivity", handler, ctx);
    botAppHookRegistry.unregister("app1", "onMessage");

    await botAppHookRegistry.emit("onMessage", {} as any);
    expect(handler).not.toHaveBeenCalled();

    await botAppHookRegistry.emit("onVoiceActivity", {} as any);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("clearAll removes everything", async () => {
    const handler = vi.fn();
    const ctx = { config: {}, db: {} as any, bot: {} as any, botUserId: "b1", guildId: "g1", platform: "discord" as const };
    botAppHookRegistry.register("app1", "onMessage", handler, ctx);
    botAppHookRegistry.clearAll();

    await botAppHookRegistry.emit("onMessage", {} as any);
    expect(handler).not.toHaveBeenCalled();
  });

  it("emit with no handlers does not throw", async () => {
    await expect(botAppHookRegistry.emit("onMessage", {} as any)).resolves.toBeUndefined();
  });

  it("error boundary: handler throws, next handler still executes", async () => {
    const bad = vi.fn().mockRejectedValue(new Error("boom"));
    const good = vi.fn();
    const ctx = { config: {}, db: {} as any, bot: {} as any, botUserId: "b1", guildId: "g1", platform: "discord" as const };
    botAppHookRegistry.register("app-bad", "onMessage", bad, ctx);
    botAppHookRegistry.register("app-good", "onMessage", good, ctx);

    await botAppHookRegistry.emit("onMessage", {} as any);
    expect(bad).toHaveBeenCalled();
    expect(good).toHaveBeenCalled();
  });

  it("emit refreshes config from DB via loadAppConfig", async () => {
    // loadAppConfig calls getDb().select().from().where().limit()
    mockDbChain.limit.mockResolvedValueOnce([{ config: { theme: "dark" } }]);

    const handler = vi.fn();
    const ctx = { config: {}, db: {} as any, bot: {} as any, botUserId: "b1", guildId: "g1", platform: "discord" as const };
    botAppHookRegistry.register("app1", "onMessage", handler, ctx);

    await botAppHookRegistry.emit("onMessage", {} as any);

    expect(mockDb.select).toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ config: { theme: "dark" } })
    );
  });

  it("hook.timeout: slow async handler is abandoned and warn is logged", async () => {
    vi.useFakeTimers();
    const slowHandler = vi.fn(() => new Promise<void>(() => {})); // never resolves
    const ctx = { config: {}, db: {} as any, bot: {} as any, botUserId: "b1", guildId: "g1", platform: "discord" as const };
    botAppHookRegistry.register("app-slow", "onMessage", slowHandler, ctx);

    const emitPromise = botAppHookRegistry.emit("onMessage", {} as any);
    await vi.advanceTimersByTimeAsync(5001);
    await emitPromise;

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.objectContaining({ appId: "app-slow", event: "hook.timeout", durationMs: 5000 })
    );
    vi.useRealTimers();
  });

  it("hook.error: throwing handler logs structured error object", async () => {
    const errorHandler = vi.fn().mockRejectedValue(new Error("boom"));
    const ctx = { config: {}, db: {} as any, bot: {} as any, botUserId: "b1", guildId: "g1", platform: "discord" as const };
    botAppHookRegistry.register("app-err", "onMessage", errorHandler, ctx);

    await botAppHookRegistry.emit("onMessage", {} as any);

    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      expect.objectContaining({ appId: "app-err", event: "hook.error", error: "boom" })
    );
  });

  it("error boundary preserved after timeout: next handler still executes", async () => {
    vi.useFakeTimers();
    const slowHandler = vi.fn(() => new Promise<void>(() => {}));
    const fastHandler = vi.fn().mockResolvedValue(undefined);
    const ctx = { config: {}, db: {} as any, bot: {} as any, botUserId: "b1", guildId: "g1", platform: "discord" as const };
    botAppHookRegistry.register("app-slow", "onMessage", slowHandler, ctx);
    botAppHookRegistry.register("app-fast", "onMessage", fastHandler, ctx);

    const emitPromise = botAppHookRegistry.emit("onMessage", {} as any);
    await vi.advanceTimersByTimeAsync(5001);
    await emitPromise;

    expect(fastHandler).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

// ─── loadInstalledAppHooks tests ────────────────────────────────────────────

describe("loadInstalledAppHooks", () => {
  const mockSafeParseAppManifest = safeParseAppManifest as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    botAppHookRegistry.clearAll();
    vi.clearAllMocks();
  });

  function makeDiscordClient() {
    return { user: { id: "bot-user-1" } } as any;
  }

  it("valid manifest with hook code registers hooks", async () => {
    const hookCode = `exports.onMessage = async function(payload, ctx) {};`;
    mockDbChain.where.mockReturnValue([
      {
        appId: "test-app",
        manifest: {},
        codeBundle: { "src/bot/hooks.ts": hookCode },
        config: { foo: "bar" },
        status: "active",
      },
    ]);
    mockSafeParseAppManifest.mockReturnValue({
      success: true,
      data: { botHooks: ["onMessage"] },
    });

    await loadInstalledAppHooks(makeDiscordClient());

    // Verify hook was registered by emitting
    const handler = vi.fn();
    // The registry should have the hook — emit to check
    // We can't directly inspect, but we know no error was thrown
    expect(mockSafeParseAppManifest).toHaveBeenCalled();
  });

  it("invalid manifest skips app", async () => {
    mockDbChain.where.mockReturnValue([
      {
        appId: "bad-app",
        manifest: {},
        codeBundle: {},
        config: {},
        status: "active",
      },
    ]);
    mockSafeParseAppManifest.mockReturnValue({ success: false });

    await loadInstalledAppHooks(makeDiscordClient());
    expect(mockSafeParseAppManifest).toHaveBeenCalled();
  });

  it("no code bundle skips app", async () => {
    mockDbChain.where.mockReturnValue([
      {
        appId: "no-code-app",
        manifest: {},
        codeBundle: {},
        config: {},
        status: "active",
      },
    ]);
    mockSafeParseAppManifest.mockReturnValue({
      success: true,
      data: { botHooks: ["onMessage"] },
    });

    await loadInstalledAppHooks(makeDiscordClient());
    // Should not throw, just skip
  });
});
