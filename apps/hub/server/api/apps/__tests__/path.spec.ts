/**
 * Tests for the app route handler ([...path].ts):
 *   - route.timeout: slow handler returns 504 after HOOK_TIMEOUT_MS
 *   - route.error: throwing handler returns 500
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildSession,
  createMockEvent,
  stubNuxtAutoImports,
  cleanupAutoImportStubs
} from "../../../utils/__tests__/test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;

// ─── Module mocks ────────────────────────────────────────────────────────────

vi.mock("drizzle-orm", () => ({
  eq: vi.fn()
}));

vi.mock("@guildora/shared", () => ({
  installedApps: Symbol("installedApps")
}));

vi.mock("../../../utils/auth", () => ({
  requireSession: vi.fn()
}));

vi.mock("../../../utils/apps", () => ({
  hasRequiredRoles: vi.fn().mockReturnValue(true),
  refreshAppRegistry: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../../utils/app-db", () => ({
  createAppDb: vi.fn(() => ({}))
}));

vi.mock("../../../utils/db", () => ({
  getDb: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined)
  }))
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const slowHandlerCode = `
  module.exports = { default: async function handler(event) {
    return new Promise(() => {}); // never resolves
  }};
`;

const throwingHandlerCode = `
  module.exports = { default: async function handler(event) {
    throw new Error("handler boom");
  }};
`;

function makeMockApp(handlerCode: string) {
  return {
    appId: "test-app",
    source: "marketplace",
    manifest: {
      apiRoutes: [
        {
          method: "GET",
          path: "/api/apps/test-app/data",
          handler: "src/api/data.ts",
          requiredRoles: []
        }
      ]
    },
    codeBundle: { "src/api/data.ts": handlerCode },
    config: {}
  };
}

beforeEach(() => {
  mocks = stubNuxtAutoImports();
  // Stub additional h3 auto-imports used by [...path].ts
  vi.stubGlobal("getQuery", vi.fn());
  vi.stubGlobal("readBody", vi.fn());
  vi.stubGlobal("getRouterParams", vi.fn());
  vi.stubGlobal("setResponseHeader", vi.fn());
  vi.stubGlobal("sendNoContent", vi.fn());
  vi.stubGlobal("setResponseStatus", vi.fn());
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  vi.clearAllMocks();
});

// ─── route.timeout ───────────────────────────────────────────────────────────

describe("GET /api/apps/test-app/data — route.timeout", () => {
  async function importHandler() {
    return (await import("../[...path]")).default;
  }

  it("returns 504 and logs route.timeout when handler hangs past timeout", async () => {
    vi.useFakeTimers();

    const session = buildSession("user");
    const { requireSession } = await import("../../../utils/auth");
    vi.mocked(requireSession).mockResolvedValue(session);
    mocks.useRuntimeConfig.mockReturnValue({ enableSideloading: false });

    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const handler = await importHandler();
    const event = createMockEvent({ method: "GET", path: "/api/apps/test-app/data" });
    event.context.installedApps = [makeMockApp(slowHandlerCode)];

    const resultPromise = handler(event);

    // Advance timers past the default 5000ms timeout
    vi.advanceTimersByTime(5001);

    await expect(resultPromise).rejects.toMatchObject({ statusCode: 504 });

    const warnCalls = consoleWarnSpy.mock.calls;
    const routeTimeoutLog = warnCalls.find((args) => {
      try {
        const parsed = JSON.parse(args[0] as string);
        return parsed.event === "route.timeout" && parsed.appId === "test-app";
      } catch {
        return false;
      }
    });
    expect(routeTimeoutLog).toBeDefined();

    consoleWarnSpy.mockRestore();
    vi.useRealTimers();
  });
});

// ─── route.error ─────────────────────────────────────────────────────────────

describe("GET /api/apps/test-app/data — route.error", () => {
  async function importHandler() {
    return (await import("../[...path]")).default;
  }

  it("returns 500 and logs route.error when handler throws", async () => {
    const session = buildSession("user");
    const { requireSession } = await import("../../../utils/auth");
    vi.mocked(requireSession).mockResolvedValue(session);
    mocks.useRuntimeConfig.mockReturnValue({ enableSideloading: false });

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const handler = await importHandler();
    const event = createMockEvent({ method: "GET", path: "/api/apps/test-app/data" });
    event.context.installedApps = [makeMockApp(throwingHandlerCode)];

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 500 });

    const errorCalls = consoleErrorSpy.mock.calls;
    const routeErrorLog = errorCalls.find((args) => {
      try {
        const parsed = JSON.parse(args[0] as string);
        return parsed.event === "route.error" && parsed.appId === "test-app";
      } catch {
        return false;
      }
    });
    expect(routeErrorLog).toBeDefined();

    consoleErrorSpy.mockRestore();
  });
});
