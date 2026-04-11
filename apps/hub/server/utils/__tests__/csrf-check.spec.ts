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

// ─── CSRF utility functions (csrf.ts — explicit imports from h3/crypto) ─────

describe("generateCsrfToken", () => {
  it("returns a 64-character hex string", async () => {
    const { generateCsrfToken } = await import("../csrf");
    const token = generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique tokens on each call", async () => {
    const { generateCsrfToken } = await import("../csrf");
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
  });
});

describe("validateCsrfToken", () => {
  it("does not throw for a matching token", async () => {
    const { validateCsrfToken } = await import("../csrf");
    const event = createMockEvent({ headers: { "x-csrf-token": "abc123" } });
    expect(() => validateCsrfToken(event, "abc123")).not.toThrow();
  });

  it("throws 403 when header is missing", async () => {
    const { validateCsrfToken } = await import("../csrf");
    const event = createMockEvent();
    expect(() => validateCsrfToken(event, "abc123")).toThrow();
  });

  it("throws 403 when tokens do not match", async () => {
    const { validateCsrfToken } = await import("../csrf");
    const event = createMockEvent({ headers: { "x-csrf-token": "wrong" } });
    expect(() => validateCsrfToken(event, "correct")).toThrow();
  });

  it("throws 403 when token lengths differ (timing-safe)", async () => {
    const { validateCsrfToken } = await import("../csrf");
    const event = createMockEvent({ headers: { "x-csrf-token": "short" } });
    expect(() => validateCsrfToken(event, "much-longer-token-value")).toThrow();
  });
});

// ─── CSRF middleware behavior (02-csrf-check.ts) ────────────────────────────

describe("CSRF middleware behavior", () => {
  async function importCsrfMiddleware() {
    const mod = await import("../../middleware/02-csrf-check");
    return mod.default;
  }

  it("skips non-API paths", async () => {
    const handler = await importCsrfMiddleware();
    const event = createMockEvent({ method: "POST", path: "/not-api" });
    const result = await handler(event);
    expect(result).toBeUndefined();
    expect(mocks.getUserSession).not.toHaveBeenCalled();
  });

  it("skips GET requests (safe methods)", async () => {
    const handler = await importCsrfMiddleware();
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      const event = createMockEvent({ method, path: "/api/test" });
      const result = await handler(event);
      expect(result).toBeUndefined();
    }
    expect(mocks.getUserSession).not.toHaveBeenCalled();
  });

  it("skips /api/csrf-token endpoint", async () => {
    const handler = await importCsrfMiddleware();
    const event = createMockEvent({ method: "POST", path: "/api/csrf-token" });
    const result = await handler(event);
    expect(result).toBeUndefined();
    expect(mocks.getUserSession).not.toHaveBeenCalled();
  });

  it("skips /api/auth/discord endpoints", async () => {
    const handler = await importCsrfMiddleware();
    const event = createMockEvent({ method: "POST", path: "/api/auth/discord/callback" });
    const result = await handler(event);
    expect(result).toBeUndefined();
    expect(mocks.getUserSession).not.toHaveBeenCalled();
  });

  it("Bearer garbage does NOT bypass CSRF (regression: CVE-like bypass removed)", async () => {
    const handler = await importCsrfMiddleware();
    mocks.getUserSession.mockResolvedValue({ csrfToken: "tok" });
    const event = createMockEvent({
      method: "POST",
      path: "/api/test",
      headers: { authorization: "Bearer garbage", origin: "https://evil.com" }
    });
    await handler(event);
    expect(mocks.getUserSession).toHaveBeenCalled();
    expect(mocks.validateCsrfToken).toHaveBeenCalledWith(event, "tok");
  });

  it("Bearer with valid-looking token does NOT bypass CSRF", async () => {
    const handler = await importCsrfMiddleware();
    mocks.getUserSession.mockResolvedValue({ csrfToken: "tok" });
    const event = createMockEvent({
      method: "POST",
      path: "/api/test",
      headers: { authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.sig", origin: "https://example.com" }
    });
    await handler(event);
    expect(mocks.getUserSession).toHaveBeenCalled();
    expect(mocks.validateCsrfToken).toHaveBeenCalledWith(event, "tok");
  });

  it("Bearer with empty value does NOT bypass CSRF", async () => {
    const handler = await importCsrfMiddleware();
    mocks.getUserSession.mockResolvedValue({ csrfToken: "tok" });
    const event = createMockEvent({
      method: "POST",
      path: "/api/test",
      headers: { authorization: "Bearer ", origin: "https://evil.com" }
    });
    await handler(event);
    expect(mocks.getUserSession).toHaveBeenCalled();
    expect(mocks.validateCsrfToken).toHaveBeenCalledWith(event, "tok");
  });

  it("non-Bearer auth (Basic) does NOT bypass CSRF", async () => {
    const handler = await importCsrfMiddleware();
    mocks.getUserSession.mockResolvedValue({ csrfToken: "tok" });
    const event = createMockEvent({
      method: "POST",
      path: "/api/test",
      headers: { authorization: "Basic abc", origin: "https://example.com" }
    });
    await handler(event);
    expect(mocks.getUserSession).toHaveBeenCalled();
    expect(mocks.validateCsrfToken).toHaveBeenCalledWith(event, "tok");
  });

  it("SSR-internal requests without Origin/Referer bypass CSRF", async () => {
    const handler = await importCsrfMiddleware();
    const event = createMockEvent({ method: "POST", path: "/api/test" });
    const result = await handler(event);
    expect(result).toBeUndefined();
    expect(mocks.getUserSession).not.toHaveBeenCalled();
  });

  it("throws 403 when session has no csrfToken", async () => {
    const handler = await importCsrfMiddleware();
    mocks.getUserSession.mockResolvedValue({});
    const event = createMockEvent({
      method: "POST",
      path: "/api/test",
      headers: { origin: "https://example.com" }
    });
    await expect(handler(event)).rejects.toThrow("CSRF token not initialised");
  });

  it("calls validateCsrfToken with correct session token", async () => {
    const handler = await importCsrfMiddleware();
    mocks.getUserSession.mockResolvedValue({ csrfToken: "real-csrf-token" });
    const event = createMockEvent({
      method: "POST",
      path: "/api/test",
      headers: { origin: "https://example.com" }
    });
    await handler(event);
    expect(mocks.validateCsrfToken).toHaveBeenCalledWith(event, "real-csrf-token");
  });
});
