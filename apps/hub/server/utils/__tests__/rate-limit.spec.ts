import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createMockEvent } from "./test-helpers";

// Rate-limit.ts uses explicit imports from h3, so we need to handle the store reset
// between tests by re-importing the module.

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

async function importRateLimit() {
  return import("../rate-limit");
}

describe("getRateLimitKey", () => {
  it("returns a key combining prefix and IP", async () => {
    const { getRateLimitKey } = await importRateLimit();
    const event = createMockEvent();
    const key = getRateLimitKey(event, "test");
    expect(key).toMatch(/^test:/);
  });
});

describe("checkRateLimit", () => {
  it("allows requests under the limit", async () => {
    const { checkRateLimit } = await importRateLimit();
    const result = checkRateLimit("key-a", { windowMs: 60_000, max: 5 });
    expect(result.remaining).toBe(4);
  });

  it("decrements remaining count with each call", async () => {
    const { checkRateLimit } = await importRateLimit();
    const opts = { windowMs: 60_000, max: 5 };

    checkRateLimit("key-b", opts);
    checkRateLimit("key-b", opts);
    const result = checkRateLimit("key-b", opts);

    expect(result.remaining).toBe(2);
  });

  it("throws 429 when limit is exceeded", async () => {
    const { checkRateLimit } = await importRateLimit();
    const opts = { windowMs: 60_000, max: 3 };

    checkRateLimit("key-c", opts);
    checkRateLimit("key-c", opts);
    checkRateLimit("key-c", opts);

    expect(() => checkRateLimit("key-c", opts)).toThrow();
    try {
      checkRateLimit("key-c", opts);
    } catch (e: unknown) {
      const err = e as { statusCode?: number; data?: { retryAfter?: number } };
      expect(err.statusCode).toBe(429);
    }
  });

  it("resets after window expires", async () => {
    const { checkRateLimit } = await importRateLimit();
    const opts = { windowMs: 60_000, max: 2 };

    checkRateLimit("key-d", opts);
    checkRateLimit("key-d", opts);

    // Advance past the window
    vi.advanceTimersByTime(61_000);

    // Should not throw — window has reset
    const result = checkRateLimit("key-d", opts);
    expect(result.remaining).toBe(1);
  });

  it("uses separate counters for different keys", async () => {
    const { checkRateLimit } = await importRateLimit();
    const opts = { windowMs: 60_000, max: 2 };

    checkRateLimit("key-e", opts);
    checkRateLimit("key-e", opts);

    // Different key should still have capacity
    const result = checkRateLimit("key-f", opts);
    expect(result.remaining).toBe(1);
  });

  it("includes Retry-After in the error when rate limited", async () => {
    const { checkRateLimit } = await importRateLimit();
    const opts = { windowMs: 60_000, max: 1 };

    checkRateLimit("key-g", opts);

    try {
      checkRateLimit("key-g", opts);
    } catch (e: unknown) {
      const err = e as { statusCode?: number; data?: { retryAfter?: number } };
      expect(err.statusCode).toBe(429);
      expect(err.data?.retryAfter).toBeGreaterThan(0);
    }
  });

  it("sliding window drops old timestamps", async () => {
    const { checkRateLimit } = await importRateLimit();
    const opts = { windowMs: 60_000, max: 2 };

    checkRateLimit("key-h", opts);
    // Advance 30 seconds
    vi.advanceTimersByTime(30_000);
    checkRateLimit("key-h", opts);

    // Advance another 31 seconds — first timestamp is now outside window
    vi.advanceTimersByTime(31_000);

    // Should succeed because the first timestamp dropped out of the window
    const result = checkRateLimit("key-h", opts);
    expect(result.remaining).toBe(1);
  });
});
