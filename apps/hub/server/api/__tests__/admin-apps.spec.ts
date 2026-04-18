/**
 * Tests for admin app mutation endpoints:
 *   - POST /api/admin/apps/sideload
 *   - POST /api/admin/apps/local-sideload
 *   - PUT  /api/admin/apps/[appId]/config
 *   - PUT  /api/admin/apps/[appId]/status
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildSession,
  createMockEvent,
  stubNuxtAutoImports,
  cleanupAutoImportStubs,
} from "../../utils/__tests__/test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;

// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock("../../utils/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../utils/app-sideload", () => ({
  installAppFromUrl: vi.fn().mockResolvedValue({ appId: "app-123" }),
  installAppFromLocalPath: vi.fn().mockResolvedValue({ appId: "app-local-456" }),
}));

vi.mock("../../utils/apps", () => ({
  refreshAppRegistry: vi.fn().mockResolvedValue(undefined),
  setInstalledAppStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@guildora/shared", () => ({
  installedApps: { appId: "app_id", config: "config" },
}));

beforeEach(() => {
  mocks = stubNuxtAutoImports();
  // Stub readBody and getRouterParam as auto-imports
  vi.stubGlobal("readBody", vi.fn());
  vi.stubGlobal("getRouterParam", vi.fn());
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  vi.clearAllMocks();
});

// ─── POST /api/admin/apps/sideload ─────────────────────────────────────────

describe("POST /api/admin/apps/sideload", () => {
  async function importHandler() {
    return (await import("../admin/apps/sideload.post")).default;
  }

  it("rejects unauthenticated requests", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));
    mocks.useRuntimeConfig.mockReturnValue({ enableSideloading: true });
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      githubUrl: "https://github.com/org/repo",
    });

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/apps/sideload" });
    await expect(handler(event)).rejects.toThrow();
  });

  it("rejects non-superadmin users (admin is not enough)", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);
    mocks.useRuntimeConfig.mockReturnValue({ enableSideloading: true });
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      githubUrl: "https://github.com/org/repo",
    });

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/apps/sideload" });
    await expect(handler(event)).rejects.toThrow("Forbidden");
  });

  it("rejects when sideloading is disabled (non-dev mode)", async () => {
    const session = buildSession("superadmin");
    mocks.requireUserSession.mockResolvedValue(session);
    mocks.useRuntimeConfig.mockReturnValue({ enableSideloading: false });
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      githubUrl: "https://github.com/org/repo",
    });

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/apps/sideload" });
    await expect(handler(event)).rejects.toThrow("Sideloading is not enabled");
  });

  it("rejects invalid payload (missing githubUrl)", async () => {
    const session = buildSession("superadmin");
    mocks.requireUserSession.mockResolvedValue(session);
    mocks.useRuntimeConfig.mockReturnValue({ enableSideloading: true });
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/apps/sideload" });
    await expect(handler(event)).rejects.toThrow("Invalid sideload payload");
  });

  it("succeeds for superadmin with valid payload", async () => {
    const session = buildSession("superadmin");
    mocks.requireUserSession.mockResolvedValue(session);
    mocks.useRuntimeConfig.mockReturnValue({ enableSideloading: true });
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      githubUrl: "https://github.com/org/repo",
      activate: true,
    });

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/apps/sideload" });
    const result = await handler(event);
    expect(result).toEqual({ ok: true, appId: "app-123" });
  });
});

// ─── POST /api/admin/apps/local-sideload ────────────────────────────────────

describe("POST /api/admin/apps/local-sideload", () => {
  async function importHandler() {
    return (await import("../admin/apps/local-sideload.post")).default;
  }

  it("rejects non-superadmin users", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);
    mocks.useRuntimeConfig.mockReturnValue({ enableSideloading: true });
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ localPath: "/tmp/app" });

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/apps/local-sideload" });
    await expect(handler(event)).rejects.toThrow("Forbidden");
  });

  it("rejects when sideloading is disabled", async () => {
    const session = buildSession("superadmin");
    mocks.requireUserSession.mockResolvedValue(session);
    mocks.useRuntimeConfig.mockReturnValue({ enableSideloading: false });
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ localPath: "/tmp/app" });

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/apps/local-sideload" });
    await expect(handler(event)).rejects.toThrow("Sideloading is not enabled");
  });

  it("rejects invalid payload (empty localPath)", async () => {
    const session = buildSession("superadmin");
    mocks.requireUserSession.mockResolvedValue(session);
    mocks.useRuntimeConfig.mockReturnValue({ enableSideloading: true });
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ localPath: "" });

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/apps/local-sideload" });
    await expect(handler(event)).rejects.toThrow("Invalid request body");
  });

  it("succeeds for superadmin with valid payload", async () => {
    const session = buildSession("superadmin");
    mocks.requireUserSession.mockResolvedValue(session);
    mocks.useRuntimeConfig.mockReturnValue({ enableSideloading: true });
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      localPath: "/tmp/my-app",
      activate: true,
    });

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/apps/local-sideload" });
    const result = await handler(event);
    expect(result).toEqual({ ok: true, appId: "app-local-456" });
  });
});

// ─── PUT /api/admin/apps/[appId]/config ─────────────────────────────────────

describe("PUT /api/admin/apps/[appId]/config", () => {
  async function importHandler() {
    return (await import("../admin/apps/[appId]/config.put")).default;
  }

  function mockDb() {
    const chain: Record<string, unknown> = {};
    chain.update = vi.fn().mockReturnValue(chain);
    chain.set = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockResolvedValue(undefined);
    return chain;
  }

  it("rejects non-admin users", async () => {
    const session = buildSession("user");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ config: {} });
    vi.mocked(globalThis.getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("app-1");

    const handler = await importHandler();
    const event = createMockEvent({ method: "PUT", path: "/api/admin/apps/app-1/config" });
    await expect(handler(event)).rejects.toThrow("Forbidden");
  });

  it("rejects missing appId param", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ config: {} });
    vi.mocked(globalThis.getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

    const handler = await importHandler();
    const event = createMockEvent({ method: "PUT", path: "/api/admin/apps//config" });
    await expect(handler(event)).rejects.toThrow("Missing app id");
  });

  it("rejects invalid body (missing config key)", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({});
    vi.mocked(globalThis.getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("app-1");

    const handler = await importHandler();
    const event = createMockEvent({ method: "PUT", path: "/api/admin/apps/app-1/config" });
    await expect(handler(event)).rejects.toThrow("Invalid config payload");
  });

  it("succeeds for admin with valid payload", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ config: { key: "val" } });
    vi.mocked(globalThis.getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("app-1");

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDb() as ReturnType<typeof getDb>);

    const handler = await importHandler();
    const event = createMockEvent({ method: "PUT", path: "/api/admin/apps/app-1/config" });
    const result = await handler(event);
    expect(result).toEqual({ ok: true });
  });
});

// ─── PUT /api/admin/apps/[appId]/status ─────────────────────────────────────

describe("PUT /api/admin/apps/[appId]/status", () => {
  async function importHandler() {
    return (await import("../admin/apps/[appId]/status.put")).default;
  }

  it("rejects non-admin users", async () => {
    const session = buildSession("moderator");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "active" });
    vi.mocked(globalThis.getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("app-1");

    const handler = await importHandler();
    const event = createMockEvent({ method: "PUT", path: "/api/admin/apps/app-1/status" });
    await expect(handler(event)).rejects.toThrow("Forbidden");
  });

  it("rejects invalid status value", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "deleted" });
    vi.mocked(globalThis.getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("app-1");

    const handler = await importHandler();
    const event = createMockEvent({ method: "PUT", path: "/api/admin/apps/app-1/status" });
    await expect(handler(event)).rejects.toThrow("Invalid status payload");
  });

  it("rejects missing appId param", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "active" });
    vi.mocked(globalThis.getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

    const handler = await importHandler();
    const event = createMockEvent({ method: "PUT", path: "/api/admin/apps//status" });
    await expect(handler(event)).rejects.toThrow("Missing app id");
  });

  it("succeeds for admin with valid status toggle", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "inactive" });
    vi.mocked(globalThis.getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("app-1");

    const handler = await importHandler();
    const event = createMockEvent({ method: "PUT", path: "/api/admin/apps/app-1/status" });
    const result = await handler(event);
    expect(result).toEqual({ ok: true });
  });

  it("succeeds for superadmin as well", async () => {
    const session = buildSession("superadmin");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "active" });
    vi.mocked(globalThis.getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("app-2");

    const handler = await importHandler();
    const event = createMockEvent({ method: "PUT", path: "/api/admin/apps/app-2/status" });
    const result = await handler(event);
    expect(result).toEqual({ ok: true });
  });
});
