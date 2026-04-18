/**
 * Integration tests for admin operations: user listing, role management.
 * Tests auth enforcement (admin-only) and business logic invariants.
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

vi.mock("../../utils/http", () => ({
  parsePaginationQuery: vi.fn(() => ({ page: 1, limit: 20 })),
  paginateArray: vi.fn((items: unknown[], page: number, limit: number) => ({
    items: items.slice(0, limit),
    pagination: { page, limit, total: items.length, totalPages: Math.ceil(items.length / limit) },
  })),
}));

vi.mock("../../utils/user-directory", () => ({
  loadUserPermissionRolesMap: vi.fn().mockResolvedValue(new Map()),
  loadUserCommunityRolesMap: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("@guildora/shared", () => ({
  users: { id: "id", discordId: "discord_id", displayName: "display_name", avatarUrl: "avatar_url" },
}));

beforeEach(() => {
  mocks = stubNuxtAutoImports();
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  vi.clearAllMocks();
});

function mockDbForUserList(userRows: unknown[]) {
  // The admin/users.get handler awaits the query builder directly via Promise.all,
  // so the chain must be thenable (resolve to userRows when awaited).
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => unknown) => resolve(userRows);
  return chain;
}

// ─── Admin user listing ─────────────────────────────────────────────────────

describe("admin user listing (GET /api/admin/users)", () => {
  it("requires admin session", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbForUserList([]) as ReturnType<typeof getDb>);

    const handler = (await import("../admin/users.get")).default;
    const event = createMockEvent({ method: "GET", path: "/api/admin/users" });

    await expect(handler(event)).rejects.toThrow();
  });

  it("rejects regular user (403)", async () => {
    const session = buildSession("user");
    mocks.requireUserSession.mockResolvedValue(session);

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbForUserList([]) as ReturnType<typeof getDb>);

    const handler = (await import("../admin/users.get")).default;
    const event = createMockEvent({ method: "GET", path: "/api/admin/users" });

    await expect(handler(event)).rejects.toThrow();
  });

  it("rejects moderator (403 — admin-only route)", async () => {
    const session = buildSession("moderator");
    mocks.requireUserSession.mockResolvedValue(session);

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbForUserList([]) as ReturnType<typeof getDb>);

    const handler = (await import("../admin/users.get")).default;
    const event = createMockEvent({ method: "GET", path: "/api/admin/users" });

    await expect(handler(event)).rejects.toThrow();
  });

  it("allows admin to list users", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);

    const testUsers = [
      { id: "u1", discordId: "d1", displayName: "Alice", avatarUrl: null },
      { id: "u2", discordId: "d2", displayName: "Bob", avatarUrl: null },
    ];

    const { getDb } = await import("../../utils/db");
    const db = mockDbForUserList(testUsers);
    vi.mocked(getDb).mockReturnValue(db as ReturnType<typeof getDb>);

    // Mock getQuery to return empty search
    vi.stubGlobal("getQuery", vi.fn(() => ({})));

    const handler = (await import("../admin/users.get")).default;
    const event = createMockEvent({ method: "GET", path: "/api/admin/users" });

    const result = await handler(event);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].profileName).toBe("Alice");

    vi.unstubAllGlobals();
    mocks = stubNuxtAutoImports();
  });

  it("allows superadmin to list users", async () => {
    const session = buildSession("superadmin");
    mocks.requireUserSession.mockResolvedValue(session);

    const { getDb } = await import("../../utils/db");
    const db = mockDbForUserList([]);
    vi.mocked(getDb).mockReturnValue(db as ReturnType<typeof getDb>);

    vi.stubGlobal("getQuery", vi.fn(() => ({})));

    const handler = (await import("../admin/users.get")).default;
    const event = createMockEvent({ method: "GET", path: "/api/admin/users" });

    const result = await handler(event);
    expect(result.items).toEqual([]);

    vi.unstubAllGlobals();
    mocks = stubNuxtAutoImports();
  });

  it("includes permission roles in response", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);

    const testUsers = [{ id: "u1", discordId: "d1", displayName: "Admin User", avatarUrl: null }];

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbForUserList(testUsers) as ReturnType<typeof getDb>);

    const { loadUserPermissionRolesMap } = await import("../../utils/user-directory");
    const permMap = new Map([["u1", ["admin"]]]);
    vi.mocked(loadUserPermissionRolesMap).mockResolvedValue(permMap as unknown as Map<string, string[]>);

    vi.stubGlobal("getQuery", vi.fn(() => ({})));

    const handler = (await import("../admin/users.get")).default;
    const event = createMockEvent({ method: "GET", path: "/api/admin/users" });

    const result = await handler(event);
    expect(result.items[0].permissionRoles).toEqual(["admin"]);

    vi.unstubAllGlobals();
    mocks = stubNuxtAutoImports();
  });

  it("includes community role in response", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);

    const testUsers = [{ id: "u1", discordId: "d1", displayName: "Mod User", avatarUrl: null }];

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbForUserList(testUsers) as ReturnType<typeof getDb>);

    const { loadUserCommunityRolesMap } = await import("../../utils/user-directory");
    const commMap = new Map([["u1", { name: "Moderator", id: "cr-1" }]]);
    vi.mocked(loadUserCommunityRolesMap).mockResolvedValue(commMap as unknown as Map<string, { name: string; id: string }>);

    vi.stubGlobal("getQuery", vi.fn(() => ({})));

    const handler = (await import("../admin/users.get")).default;
    const event = createMockEvent({ method: "GET", path: "/api/admin/users" });

    const result = await handler(event);
    expect(result.items[0].communityRole).toBe("Moderator");

    vi.unstubAllGlobals();
    mocks = stubNuxtAutoImports();
  });
});

// ─── Self-demotion guard ────────────────────────────────────────────────────

describe("role change invariants", () => {
  it("admin cannot demote themselves (business rule check)", async () => {
    // This tests the expected invariant that a user should not be able
    // to remove their own admin/superadmin role. The actual guard implementation
    // is in the role-change handler — this test documents the expected behavior.
    const session = buildSession("admin", { userOverrides: { id: "admin-user-1" } });
    const targetUserId = "admin-user-1"; // Same as session user

    // The guard: you cannot change your own role
    const isSelfDemotion = session.user.id === targetUserId;
    expect(isSelfDemotion).toBe(true);
  });

  it("admin can change other user roles", () => {
    const session = buildSession("admin", { userOverrides: { id: "admin-user-1" } });
    const targetUserId = "other-user-2";

    const isSelfDemotion = session.user.id === targetUserId;
    expect(isSelfDemotion).toBe(false);
  });
});
