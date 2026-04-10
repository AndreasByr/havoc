import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createMockEvent,
  stubNuxtAutoImports,
  cleanupAutoImportStubs,
} from "./test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;

beforeEach(() => {
  mocks = stubNuxtAutoImports();
  // Stub additional auto-imports used by dev-login.get.ts
  vi.stubGlobal("getQuery", vi.fn(() => ({})));
  vi.stubGlobal("sendRedirect", vi.fn());
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
});

describe("dev-login bypass gating", () => {
  it("throws 404 when authDevBypass is false (production mode)", async () => {
    // import.meta.dev is false in test environment by default
    mocks.useRuntimeConfig.mockReturnValue({ authDevBypass: false });

    const mod = await import("../../api/auth/dev-login.get");
    const handler = mod.default;
    const event = createMockEvent({ path: "/api/auth/dev-login" });

    await expect(handler(event)).rejects.toThrow("Not Found");
  });

  it("throws 404 when isDev is true but authDevBypass is not set", async () => {
    mocks.useRuntimeConfig.mockReturnValue({});

    const mod = await import("../../api/auth/dev-login.get");
    const handler = mod.default;
    const event = createMockEvent({ path: "/api/auth/dev-login" });

    await expect(handler(event)).rejects.toThrow("Not Found");
  });
});
