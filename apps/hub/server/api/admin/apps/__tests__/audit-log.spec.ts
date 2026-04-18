/**
 * Tests for audit log events emitted by admin app lifecycle routes:
 *   - POST /api/admin/apps/sideload          → app.installed
 *   - POST /api/admin/apps/local-sideload    → app.installed
 *   - DELETE /api/admin/apps/[id]            → app.uninstalled
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildSession,
  createMockEvent,
  stubNuxtAutoImports,
  cleanupAutoImportStubs
} from "../../../../utils/__tests__/test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;

// ─── Module mocks ────────────────────────────────────────────────────────────

vi.mock("../../../../utils/db", () => ({
  getDb: vi.fn()
}));

vi.mock("../../../../utils/app-sideload", () => ({
  installAppFromUrl: vi.fn().mockResolvedValue({ appId: "app-123" }),
  installAppFromLocalPath: vi.fn().mockResolvedValue({ appId: "app-local-456" })
}));

vi.mock("../../../../utils/apps", () => ({
  refreshAppRegistry: vi.fn().mockResolvedValue(undefined),
  setInstalledAppStatus: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("@guildora/shared", () => ({
  installedApps: { id: "id", appId: "app_id" }
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn()
}));

beforeEach(() => {
  mocks = stubNuxtAutoImports();
  vi.stubGlobal("readBody", vi.fn());
  vi.stubGlobal("getRouterParam", vi.fn());
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  vi.clearAllMocks();
});

// ─── Helper ──────────────────────────────────────────────────────────────────

function findAuditLog(appId: string, event: string): boolean {
  const logCalls = vi.mocked(console.log).mock.calls;
  return logCalls.some(([arg]) => {
    try {
      const parsed = JSON.parse(arg as string);
      return parsed.appId === appId && parsed.event === event;
    } catch {
      return false;
    }
  });
}

// ─── POST /api/admin/apps/sideload → app.installed ──────────────────────────

describe("POST /api/admin/apps/sideload audit log", () => {
  async function importHandler() {
    return (await import("../sideload.post")).default;
  }

  it("emits app.installed with appId after successful sideload", async () => {
    const session = buildSession("superadmin");
    mocks.requireUserSession.mockResolvedValue(session);
    mocks.useRuntimeConfig.mockReturnValue({ enableSideloading: true });
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      githubUrl: "https://github.com/org/repo",
      activate: true
    });

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/apps/sideload" });
    await handler(event);

    expect(findAuditLog("app-123", "app.installed")).toBe(true);
  });
});

// ─── POST /api/admin/apps/local-sideload → app.installed ────────────────────

describe("POST /api/admin/apps/local-sideload audit log", () => {
  async function importHandler() {
    return (await import("../local-sideload.post")).default;
  }

  it("emits app.installed with appId after successful local sideload", async () => {
    const session = buildSession("superadmin");
    mocks.requireUserSession.mockResolvedValue(session);
    mocks.useRuntimeConfig.mockReturnValue({ enableSideloading: true });
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      localPath: "/tmp/my-app",
      activate: true
    });

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/apps/local-sideload" });
    await handler(event);

    expect(findAuditLog("app-local-456", "app.installed")).toBe(true);
  });
});

// ─── DELETE /api/admin/apps/[id] → app.uninstalled ──────────────────────────

describe("DELETE /api/admin/apps/[id] audit log", () => {
  async function importHandler() {
    return (await import("../[id].delete")).default;
  }

  it("emits app.uninstalled with appId after successful delete", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("42");

    const { getDb } = await import("../../../../utils/db");
    const mockDeleteChain = {
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "42", appId: "app-xyz" }])
    };
    const mockDb = { delete: vi.fn().mockReturnValue(mockDeleteChain) };
    vi.mocked(getDb).mockReturnValue(mockDb as ReturnType<typeof getDb>);

    const handler = await importHandler();
    const event = createMockEvent({ method: "DELETE", path: "/api/admin/apps/42" });
    await handler(event);

    expect(findAuditLog("app-xyz", "app.uninstalled")).toBe(true);
  });
});
