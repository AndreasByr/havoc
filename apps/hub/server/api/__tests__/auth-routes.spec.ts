/**
 * Tests for auth-related route handlers:
 *   - POST /api/auth/logout
 *   - GET  /api/csrf-token
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createMockEvent,
  stubNuxtAutoImports,
  cleanupAutoImportStubs,
} from "../../utils/__tests__/test-helpers";

let _mocks: ReturnType<typeof stubNuxtAutoImports>;

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  _mocks = stubNuxtAutoImports();
  vi.stubGlobal("clearUserSession", vi.fn().mockResolvedValue(undefined));
  vi.stubGlobal("getUserSession", vi.fn());
  vi.stubGlobal("generateCsrfToken", vi.fn().mockReturnValue("new-csrf-token-xyz"));
  vi.stubGlobal("setUserSession", vi.fn().mockResolvedValue(undefined));
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  vi.clearAllMocks();
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

describe("POST /api/auth/logout", () => {
  async function importHandler() {
    return (await import("../auth/logout.post")).default;
  }

  it("clears session and returns ok (200)", async () => {
    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/auth/logout" });
    const result = await handler(event);
    expect(result).toMatchObject({ ok: true });
    expect(
      vi.mocked(globalThis.clearUserSession as ReturnType<typeof vi.fn>)
    ).toHaveBeenCalledWith(event);
  });
});

// ─── GET /api/csrf-token ──────────────────────────────────────────────────────

describe("GET /api/csrf-token", () => {
  async function importHandler() {
    return (await import("../csrf-token.get")).default;
  }

  it("generates new token when session has no csrfToken", async () => {
    vi.mocked(
      globalThis.getUserSession as ReturnType<typeof vi.fn>
    ).mockResolvedValue({});
    const handler = await importHandler();
    const event = createMockEvent({ method: "GET", path: "/api/csrf-token" });
    const result = await handler(event);
    expect(result).toMatchObject({ token: "new-csrf-token-xyz" });
    expect(
      vi.mocked(globalThis.setUserSession as ReturnType<typeof vi.fn>)
    ).toHaveBeenCalled();
  });

  it("returns existing token when session already has csrfToken", async () => {
    vi.mocked(
      globalThis.getUserSession as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ csrfToken: "existing-csrf-token" });
    const handler = await importHandler();
    const event = createMockEvent({ method: "GET", path: "/api/csrf-token" });
    const result = await handler(event);
    expect(result).toMatchObject({ token: "existing-csrf-token" });
    expect(
      vi.mocked(globalThis.setUserSession as ReturnType<typeof vi.fn>)
    ).not.toHaveBeenCalled();
  });
});
