import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupAutoImportStubs,
  createMockEvent,
  stubNuxtAutoImports,
} from "../../utils/__tests__/test-helpers";

let _mocks: ReturnType<typeof stubNuxtAutoImports>;

const fetchMock = vi.fn();

describe("setup bot reload endpoint (POST /api/setup/bot-reload)", () => {
  beforeEach(() => {
    _mocks = stubNuxtAutoImports();
    vi.stubGlobal("$fetch", fetchMock);
    fetchMock.mockReset();
    vi.stubEnv("NUXT_BOT_INTERNAL_URL", "");
    vi.stubEnv("NUXT_BOT_INTERNAL_TOKEN", "");
  });

  afterEach(() => {
    cleanupAutoImportStubs();
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  async function importHandler() {
    return (await import("../setup/bot-reload.post")).default;
  }

  it("returns 503 when NUXT_BOT_INTERNAL_URL is missing", async () => {
    const handler = await importHandler();

    await expect(handler(createMockEvent({ method: "POST" }))).rejects.toMatchObject({
      statusCode: 503,
      statusMessage: "Bot internal URL is not configured. Set NUXT_BOT_INTERNAL_URL in .env.",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 when NUXT_BOT_INTERNAL_TOKEN is missing", async () => {
    vi.stubEnv("NUXT_BOT_INTERNAL_URL", "http://bot:3050");

    const handler = await importHandler();

    await expect(handler(createMockEvent({ method: "POST" }))).rejects.toMatchObject({
      statusCode: 503,
      statusMessage: "Bot internal token is not configured. Set NUXT_BOT_INTERNAL_TOKEN in .env.",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns ok/reloaded true when reload forwarding succeeds", async () => {
    vi.stubEnv("NUXT_BOT_INTERNAL_URL", "http://bot:3050");
    vi.stubEnv("NUXT_BOT_INTERNAL_TOKEN", "secret-token");
    fetchMock.mockResolvedValue({ ok: true, guildId: "guild-1" });

    const handler = await importHandler();
    const result = await handler(createMockEvent({ method: "POST" }));

    expect(fetchMock).toHaveBeenCalledWith("http://bot:3050/internal/bot/reload-credentials", {
      method: "POST",
      headers: {
        Authorization: "Bearer secret-token",
      },
      timeout: 15_000,
    });

    expect(result).toEqual({ ok: true, reloaded: true });
  });

  it("returns 502 with docker compose restart bot guidance when bot returns 5xx", async () => {
    vi.stubEnv("NUXT_BOT_INTERNAL_URL", "http://bot:3050");
    vi.stubEnv("NUXT_BOT_INTERNAL_TOKEN", "secret-token");
    fetchMock.mockRejectedValue({ response: { status: 503 } });

    const handler = await importHandler();

    await expect(handler(createMockEvent({ method: "POST" }))).rejects.toMatchObject({
      statusCode: 502,
      statusMessage:
        "Bot is unreachable. Restart the bot container to apply new credentials: docker compose restart bot",
    });
  });
});
