/**
 * Unit tests for BotAppHookRegistry and loadInstalledAppHooks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { BotContext } from "@guildora/app-sdk";

vi.mock("../utils/db.js", () => ({ getDb: vi.fn() }));
vi.mock("../utils/app-db.js", () => ({ createAppDb: vi.fn().mockReturnValue({}) }));
vi.mock("../utils/bot-client.js", () => ({ createMatrixBotClient: vi.fn().mockReturnValue({}) }));

import { getDb } from "../utils/db.js";
import { botAppHookRegistry, loadInstalledAppHooks } from "../utils/app-hooks.js";

const mockGetDb = vi.mocked(getDb);

function makeDbMock(rows: unknown[] = []) {
  const whereResult = {
    limit: vi.fn().mockResolvedValue([]),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
    catch: (reject: (e: unknown) => void) => Promise.resolve(rows).catch(reject),
    finally: (f: () => void) => Promise.resolve(rows).finally(f),
  };
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(whereResult),
      }),
    }),
  };
}

const mockCtx: BotContext = {
  config: {},
  db: {} as BotContext["db"],
  bot: {} as BotContext["bot"],
  botUserId: "@bot:example.org",
  guildId: "!space:example.org",
  platform: "matrix",
};

const testMessagePayload = {
  guildId: "!space:example.org",
  channelId: "!room:example.org",
  messageId: "$event1",
  memberId: "@user:example.org",
  content: "hello",
  occurredAt: new Date().toISOString(),
};

beforeEach(() => {
  botAppHookRegistry.clearAll();
  mockGetDb.mockReturnValue(makeDbMock());
});

describe("BotAppHookRegistry", () => {
  it("register + emit fires handler with correct payload", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    botAppHookRegistry.register("app1", "onMessage", handler, mockCtx);
    await botAppHookRegistry.emit("onMessage", testMessagePayload);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(testMessagePayload, expect.objectContaining({ platform: "matrix" }));
  });

  it("emit with no handlers resolves without error", async () => {
    await expect(botAppHookRegistry.emit("onMessage", testMessagePayload)).resolves.toBeUndefined();
  });

  it("unregister(appId, eventName) removes the specific handler", async () => {
    const handler = vi.fn();
    botAppHookRegistry.register("app1", "onMessage", handler, mockCtx);
    botAppHookRegistry.unregister("app1", "onMessage");
    await botAppHookRegistry.emit("onMessage", testMessagePayload);
    expect(handler).not.toHaveBeenCalled();
  });

  it("unregister(appId) without event removes all handlers for that app", async () => {
    const msgHandler = vi.fn();
    const joinHandler = vi.fn().mockResolvedValue(undefined);
    botAppHookRegistry.register("app1", "onMessage", msgHandler, mockCtx);
    botAppHookRegistry.register("app1", "onMemberJoin", joinHandler, mockCtx);
    botAppHookRegistry.unregister("app1");
    await botAppHookRegistry.emit("onMessage", testMessagePayload);
    await botAppHookRegistry.emit("onMemberJoin", {
      guildId: "", memberId: "", username: "", joinedAt: null,
    });
    expect(msgHandler).not.toHaveBeenCalled();
    expect(joinHandler).not.toHaveBeenCalled();
  });

  it("clearAll removes all registered handlers across all apps", async () => {
    const h1 = vi.fn();
    const h2 = vi.fn().mockResolvedValue(undefined);
    botAppHookRegistry.register("app1", "onMessage", h1, mockCtx);
    botAppHookRegistry.register("app2", "onMemberJoin", h2, mockCtx);
    botAppHookRegistry.clearAll();
    await botAppHookRegistry.emit("onMessage", testMessagePayload);
    await botAppHookRegistry.emit("onMemberJoin", {
      guildId: "", memberId: "", username: "", joinedAt: null,
    });
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it("catches handler timeout and logs a console.warn", async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    botAppHookRegistry.register(
      "timeout-app",
      "onMessage",
      () => new Promise(() => {}), // never resolves
      mockCtx
    );

    const emitPromise = botAppHookRegistry.emit("onMessage", testMessagePayload);
    await vi.advanceTimersByTimeAsync(6000);
    await emitPromise;

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("timeout"));

    vi.useRealTimers();
    warnSpy.mockRestore();
  });

  it("catches handler error and continues executing remaining handlers", async () => {
    const errorHandler = vi.fn().mockRejectedValue(new Error("boom"));
    const successHandler = vi.fn().mockResolvedValue(undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    botAppHookRegistry.register("error-app", "onMessage", errorHandler, mockCtx);
    botAppHookRegistry.register("success-app", "onMessage", successHandler, mockCtx);

    await botAppHookRegistry.emit("onMessage", testMessagePayload);

    expect(errorHandler).toHaveBeenCalled();
    expect(successHandler).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("error"),
      "boom"
    );

    errorSpy.mockRestore();
  });
});

describe("loadInstalledAppHooks", () => {
  const mockClient = {
    getUserId: vi.fn().mockResolvedValue("@bot:example.org"),
  } as unknown as Parameters<typeof loadInstalledAppHooks>[0];

  it("clears existing registry entries before loading from DB", async () => {
    const existingHandler = vi.fn();
    botAppHookRegistry.register("stale-app", "onMessage", existingHandler, mockCtx);

    mockGetDb.mockReturnValue(makeDbMock([]));
    await loadInstalledAppHooks(mockClient);

    await botAppHookRegistry.emit("onMessage", testMessagePayload);
    expect(existingHandler).not.toHaveBeenCalled();
  });

  it("skips apps whose manifests fail validation", async () => {
    const rows = [{ appId: "bad-app", manifest: null, codeBundle: {}, config: {}, status: "active" }];
    mockGetDb.mockReturnValue(makeDbMock(rows));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await loadInstalledAppHooks(mockClient);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("invalid manifest"));
    warnSpy.mockRestore();
  });

  it("skips apps with empty botHooks array", async () => {
    const rows = [{
      appId: "no-hooks-app",
      manifest: {
        id: "no-hooks-app", name: "App", version: "1.0.0",
        author: "Test", description: "A test app", navigation: {},
        botHooks: [],
      },
      codeBundle: {},
      config: {},
      status: "active",
    }];
    mockGetDb.mockReturnValue(makeDbMock(rows));
    const registerSpy = vi.spyOn(botAppHookRegistry, "register");

    await loadInstalledAppHooks(mockClient);

    expect(registerSpy).not.toHaveBeenCalled();
    registerSpy.mockRestore();
  });

  it("sets platform to 'matrix' in the hook context", async () => {
    const hookCode = `module.exports.onMessage = async function(payload, ctx) {};`;
    const rows = [{
      appId: "matrix-app",
      manifest: {
        id: "matrix-app", name: "App", version: "1.0.0",
        author: "Test", description: "A test app", navigation: {},
        botHooks: ["onMessage"],
      },
      codeBundle: { "src/bot/hooks.ts": hookCode },
      config: {},
      status: "active",
    }];
    mockGetDb.mockReturnValue(makeDbMock(rows));
    const registerSpy = vi.spyOn(botAppHookRegistry, "register");

    await loadInstalledAppHooks(mockClient);

    expect(registerSpy).toHaveBeenCalledWith(
      "matrix-app",
      "onMessage",
      expect.any(Function),
      expect.objectContaining({ platform: "matrix" })
    );
    registerSpy.mockRestore();
  });
});
