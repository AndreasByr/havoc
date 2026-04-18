/**
 * Tests for admin user mutation endpoints:
 *   - DELETE /api/admin/users/[id]
 *   - POST   /api/admin/users/batch-delete
 *   - POST   /api/admin/users/delete-orphaned
 *   - POST   /api/admin/users/import
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

vi.mock("../../utils/admin-mirror", () => ({
  deleteUsersByIds: vi.fn().mockResolvedValue(1),
  isSuperadminUser: vi.fn().mockResolvedValue(false),
  collectMappedRolesForMember: vi.fn().mockReturnValue([]),
  listOrphanedCandidates: vi.fn().mockResolvedValue([]),
  upsertMirroredDiscordMember: vi.fn().mockResolvedValue({ userId: "u1", discordId: "d1", profileName: "Test" }),
  wasUserExistingByDiscordId: vi.fn().mockResolvedValue(false),
}));

vi.mock("../../utils/botSync", () => ({
  fetchDiscordGuildMemberFromBot: vi.fn().mockResolvedValue({ member: null }),
  removeDiscordRolesFromBot: vi.fn().mockResolvedValue(undefined),
  fetchDiscordGuildMembersByRoleFromBot: vi.fn().mockResolvedValue({ members: [] }),
  fetchDiscordGuildRolesFromBot: vi.fn().mockResolvedValue({ roles: [] }),
}));

vi.mock("../../utils/community", () => ({
  listActiveCommunityRoleMappings: vi.fn().mockResolvedValue([]),
}));

vi.mock("@guildora/shared", () => ({
  users: { id: "id", discordId: "discord_id" },
  communityRoles: { id: "id", discordRoleId: "discord_role_id" },
  userCommunityRoles: { userId: "user_id", communityRoleId: "community_role_id" },
  coerceProfileNameFromRaw: vi.fn((name: string, fallback: string) => name || fallback),
}));

beforeEach(() => {
  mocks = stubNuxtAutoImports();
  vi.stubGlobal("readBody", vi.fn());
  vi.stubGlobal("getRouterParam", vi.fn());
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  vi.clearAllMocks();
});

function mockDbWithUserRows(userRows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => unknown) => resolve(userRows);
  return chain;
}

// ─── DELETE /api/admin/users/[id] ───────────────────────────────────────────

describe("DELETE /api/admin/users/[id]", () => {
  async function importHandler() {
    return (await import("../admin/users/[id].delete")).default;
  }

  it("rejects non-admin users", async () => {
    const session = buildSession("user");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({});
    vi.mocked(globalThis.getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("target-user-1");

    const handler = await importHandler();
    const event = createMockEvent({ method: "DELETE", path: "/api/admin/users/target-user-1" });
    await expect(handler(event)).rejects.toThrow("Forbidden");
  });

  it("prevents self-deletion", async () => {
    const session = buildSession("admin", { userOverrides: { id: "admin-user-1" } });
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({});
    vi.mocked(globalThis.getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("admin-user-1");

    const handler = await importHandler();
    const event = createMockEvent({ method: "DELETE", path: "/api/admin/users/admin-user-1" });
    await expect(handler(event)).rejects.toThrow("cannot delete your own account");
  });

  it("returns 404 when target user does not exist", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({});
    vi.mocked(globalThis.getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("nonexistent");

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbWithUserRows([]) as ReturnType<typeof getDb>);

    const handler = await importHandler();
    const event = createMockEvent({ method: "DELETE", path: "/api/admin/users/nonexistent" });
    await expect(handler(event)).rejects.toThrow("User not found");
  });

  it("prevents non-superadmin from deleting a superadmin user", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({});
    vi.mocked(globalThis.getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("sa-user");

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(
      mockDbWithUserRows([{ id: "sa-user", discordId: "d-sa" }]) as ReturnType<typeof getDb>
    );

    const { isSuperadminUser } = await import("../../utils/admin-mirror");
    vi.mocked(isSuperadminUser).mockImplementation(async (id) =>
      id === "sa-user" ? true : false
    );

    const handler = await importHandler();
    const event = createMockEvent({ method: "DELETE", path: "/api/admin/users/sa-user" });
    await expect(handler(event)).rejects.toThrow("Only superadmins can delete superadmin");
  });

  it("succeeds for admin deleting a regular user", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({});
    vi.mocked(globalThis.getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("regular-user");
    mocks.useRuntimeConfig.mockReturnValue({});

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(
      mockDbWithUserRows([{ id: "regular-user", discordId: "d-reg" }]) as ReturnType<typeof getDb>
    );

    const handler = await importHandler();
    const event = createMockEvent({ method: "DELETE", path: "/api/admin/users/regular-user" });
    const result = await handler(event);
    expect(result.ok).toBe(true);
  });
});

// ─── POST /api/admin/users/batch-delete ─────────────────────────────────────

describe("POST /api/admin/users/batch-delete", () => {
  async function importHandler() {
    return (await import("../admin/users/batch-delete.post")).default;
  }

  it("rejects non-admin users", async () => {
    const session = buildSession("moderator");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      userIds: ["00000000-0000-0000-0000-000000000001"],
    });

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/users/batch-delete" });
    await expect(handler(event)).rejects.toThrow("Forbidden");
  });

  it("rejects invalid payload (empty userIds array)", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ userIds: [] });

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/users/batch-delete" });
    await expect(handler(event)).rejects.toThrow("Invalid payload");
  });

  it("rejects invalid payload (non-uuid userIds)", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ userIds: ["not-a-uuid"] });

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/users/batch-delete" });
    await expect(handler(event)).rejects.toThrow("Invalid payload");
  });

  it("skips self-deletion in batch", async () => {
    const selfId = "00000000-0000-0000-0000-000000000099";
    const session = buildSession("admin", { userOverrides: { id: selfId } });
    mocks.requireUserSession.mockResolvedValue(session);
    mocks.useRuntimeConfig.mockReturnValue({});

    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      userIds: [selfId],
    });

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbWithUserRows([]) as ReturnType<typeof getDb>);

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/users/batch-delete" });
    const result = await handler(event);
    expect(result.skipped).toBe(1);
    expect(result.deleted).toBe(0);
  });
});

// ─── POST /api/admin/users/delete-orphaned ──────────────────────────────────

describe("POST /api/admin/users/delete-orphaned", () => {
  async function importHandler() {
    return (await import("../admin/users/delete-orphaned.post")).default;
  }

  it("rejects non-admin users", async () => {
    const session = buildSession("user");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      userIds: ["00000000-0000-0000-0000-000000000001"],
    });

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/users/delete-orphaned" });
    await expect(handler(event)).rejects.toThrow("Forbidden");
  });

  it("rejects invalid payload (missing userIds)", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/users/delete-orphaned" });
    await expect(handler(event)).rejects.toThrow("Invalid payload");
  });

  it("returns zero deletions when no candidates match", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      userIds: ["00000000-0000-0000-0000-000000000001"],
    });

    const { listOrphanedCandidates } = await import("../../utils/admin-mirror");
    vi.mocked(listOrphanedCandidates).mockResolvedValue([]);

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/users/delete-orphaned" });
    const result = await handler(event);
    expect(result.deleted).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("deletes matching orphaned candidates", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);

    const targetId = "00000000-0000-0000-0000-000000000001";
    vi.mocked(globalThis.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      userIds: [targetId],
    });

    const { listOrphanedCandidates, deleteUsersByIds } = await import("../../utils/admin-mirror");
    vi.mocked(listOrphanedCandidates).mockResolvedValue([{ userId: targetId }] as Awaited<ReturnType<typeof listOrphanedCandidates>>);
    vi.mocked(deleteUsersByIds).mockResolvedValue(1);

    const { getDb } = await import("../../utils/db");
    const dbChain: Record<string, unknown> = {};
    dbChain.select = vi.fn().mockReturnValue(dbChain);
    dbChain.from = vi.fn().mockReturnValue(dbChain);
    dbChain.where = vi.fn().mockReturnValue(dbChain);
    dbChain.then = (resolve: (v: unknown) => unknown) => resolve([{ id: targetId }]);
    vi.mocked(getDb).mockReturnValue(dbChain as ReturnType<typeof getDb>);

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/users/delete-orphaned" });
    const result = await handler(event);
    expect(result.deleted).toBe(1);
  });
});

// ─── POST /api/admin/users/import ───────────────────────────────────────────

describe("POST /api/admin/users/import", () => {
  async function importHandler() {
    return (await import("../admin/users/import.post")).default;
  }

  it("rejects non-admin users", async () => {
    const session = buildSession("user");
    mocks.requireUserSession.mockResolvedValue(session);

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/users/import" });
    await expect(handler(event)).rejects.toThrow("Forbidden");
  });

  it("throws 400 when no community role mappings exist", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);
    mocks.useRuntimeConfig.mockReturnValue({});

    const { listActiveCommunityRoleMappings } = await import("../../utils/community");
    vi.mocked(listActiveCommunityRoleMappings).mockResolvedValue([]);

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/users/import" });
    await expect(handler(event)).rejects.toThrow("No active community role mappings");
  });

  it("succeeds and returns import results", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);
    mocks.useRuntimeConfig.mockReturnValue({ superadminDiscordId: null });

    const { listActiveCommunityRoleMappings } = await import("../../utils/community");
    vi.mocked(listActiveCommunityRoleMappings).mockResolvedValue([
      { id: 1, discordRoleId: "role-1" } as Awaited<ReturnType<typeof listActiveCommunityRoleMappings>>[number],
    ]);

    const { fetchDiscordGuildMembersByRoleFromBot, fetchDiscordGuildRolesFromBot } = await import(
      "../../utils/botSync"
    );
    vi.mocked(fetchDiscordGuildRolesFromBot).mockResolvedValue({ roles: [] });
    vi.mocked(fetchDiscordGuildMembersByRoleFromBot).mockResolvedValue({
      members: [
        {
          discordId: "d-new",
          displayName: "New User",
          nickname: null,
          avatarUrl: null,
          roleIds: ["role-1"],
        },
      ],
    });

    const { upsertMirroredDiscordMember, wasUserExistingByDiscordId, listOrphanedCandidates } =
      await import("../../utils/admin-mirror");
    vi.mocked(wasUserExistingByDiscordId).mockResolvedValue(false);
    vi.mocked(upsertMirroredDiscordMember).mockResolvedValue({
      userId: "u-new",
      discordId: "d-new",
      profileName: "New User",
    });
    vi.mocked(listOrphanedCandidates).mockResolvedValue([]);

    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/admin/users/import" });
    const result = await handler(event);
    expect(result.created).toHaveLength(1);
    expect(result.created[0].discordId).toBe("d-new");
    expect(result.conflicts).toHaveLength(0);
  });
});
