import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createMockEvent,
  stubNuxtAutoImports,
  cleanupAutoImportStubs,
} from "./test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;

beforeEach(() => {
  mocks = stubNuxtAutoImports();
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
});

describe("rate-limit middleware behavior", () => {
  async function importRateLimitMiddleware() {
    // Mock the rate-limit utility so we control checkRateLimit behavior
    vi.doMock("../rate-limit", () => ({
      checkRateLimit: vi.fn(() => ({ remaining: 299, resetAt: Date.now() + 60_000 })),
      getRateLimitKey: vi.fn((_event: unknown, prefix: string) => `${prefix}:127.0.0.1`),
    }));
    const mod = await import("../../middleware/01-rate-limit");
    const rateLimitMod = await import("../rate-limit");
    return { handler: mod.default, ...rateLimitMod };
  }

  it("skips non-API paths", async () => {
    const { handler, checkRateLimit } = await importRateLimitMiddleware();
    const event = createMockEvent({ path: "/not-api" });
    const result = await handler(event);
    expect(result).toBeUndefined();
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("calls checkRateLimit for /api/ paths", async () => {
    const { handler, checkRateLimit, getRateLimitKey } = await importRateLimitMiddleware();
    const event = createMockEvent({ path: "/api/test" });
    await handler(event);
    expect(getRateLimitKey).toHaveBeenCalledWith(event, "global");
    expect(checkRateLimit).toHaveBeenCalledWith("global:127.0.0.1", {
      windowMs: 60_000,
      max: 300,
    });
  });

  it("sets rate-limit response headers", async () => {
    const { handler } = await importRateLimitMiddleware();
    const event = createMockEvent({ path: "/api/test" });
    await handler(event);
    expect(mocks.setResponseHeader).toHaveBeenCalledWith(event, "X-RateLimit-Limit", "300");
    expect(mocks.setResponseHeader).toHaveBeenCalledWith(event, "X-RateLimit-Remaining", "299");
  });

  it("propagates 429 error when limit is exceeded", async () => {
    vi.doMock("../rate-limit", () => ({
      checkRateLimit: vi.fn(() => {
        const err = new Error("Too Many Requests") as Error & { statusCode: number };
        err.statusCode = 429;
        throw err;
      }),
      getRateLimitKey: vi.fn((_event: unknown, prefix: string) => `${prefix}:127.0.0.1`),
    }));
    const mod = await import("../../middleware/01-rate-limit");
    const handler = mod.default;
    const event = createMockEvent({ path: "/api/test" });
    expect(() => handler(event)).toThrow("Too Many Requests");
  });
});
