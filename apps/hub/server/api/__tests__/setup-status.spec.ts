import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupAutoImportStubs,
  createMockEvent,
  stubNuxtAutoImports,
} from "../../utils/__tests__/test-helpers";

let _mocks: ReturnType<typeof stubNuxtAutoImports>;

vi.mock("../../utils/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@guildora/shared", () => ({
  platformConnections: {
    id: "id",
  },
}));

function mockDbChain(returnValue: unknown = []) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => unknown) => resolve(returnValue);
  return chain;
}

describe("setup status endpoint (GET /api/setup/status)", () => {
  beforeEach(() => {
    mocks = stubNuxtAutoImports();
    vi.stubEnv("DISCORD_BOT_TOKEN", "");
    vi.stubEnv("DISCORD_GUILD_ID", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanupAutoImportStubs();
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  async function importHandler() {
    return (await import("../setup/status.get")).default;
  }

  it("returns needsSetup=true when no platform rows and no env fallback", async () => {
    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain([]));

    const handler = await importHandler();
    const result = await handler(createMockEvent({ method: "GET" }));

    expect(result).toEqual({
      needsSetup: true,
      hasPlatforms: false,
      hasEnvFallback: false,
    });
  });

  it("returns needsSetup=false when platform row exists", async () => {
    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain([{ id: "p1" }]));

    const handler = await importHandler();
    const result = await handler(createMockEvent({ method: "GET" }));

    expect(result).toEqual({
      needsSetup: false,
      hasPlatforms: true,
      hasEnvFallback: false,
    });
  });

  it("returns needsSetup=false when env fallback exists without DB rows", async () => {
    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain([]));
    vi.stubEnv("DISCORD_BOT_TOKEN", "token-present");

    const handler = await importHandler();
    const result = await handler(createMockEvent({ method: "GET" }));

    expect(result).toEqual({
      needsSetup: false,
      hasPlatforms: false,
      hasEnvFallback: true,
    });
  });

  it("throws 500 INTERNAL_ERROR and logs warning when DB call fails", async () => {
    const dbError = new Error("db down");
    const failingDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(dbError),
        }),
      }),
    };

    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(failingDb);

    const handler = await importHandler();

    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: "INTERNAL_ERROR",
    });

    expect(console.warn).toHaveBeenCalledWith("[setup/status] platform lookup failed", dbError);
  });

  it("throws 500 INTERNAL_ERROR for malformed DB row shape", async () => {
    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain([{ foo: "bar" }]));

    const handler = await importHandler();

    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: "INTERNAL_ERROR",
    });

    expect(console.warn).toHaveBeenCalledWith("[setup/status] malformed platform rows", [{ foo: "bar" }]);
  });

  it("propagates typed errors with statusCode unchanged", async () => {
    const typedError = Object.assign(new Error("forbidden"), {
      statusCode: 403,
      statusMessage: "FORBIDDEN",
    });
    const failingDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(typedError),
        }),
      }),
    };

    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(failingDb);

    const handler = await importHandler();

    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toBe(typedError);
  });
});
