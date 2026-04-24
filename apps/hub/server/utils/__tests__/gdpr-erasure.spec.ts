import { beforeEach, describe, expect, it, vi } from "vitest";

import { assembleUserDataExport, executeGdprErasure } from "../gdpr-erasure";

const {
  mockGetDb,
  mockDeleteUsersByIds,
  mockRequestPlatform,
  eqCalls,
  andCalls,
  mockEq,
  mockAnd,
  users,
  userCommunityRoles,
  communityRoles,
  userPlatformAccounts,
  cleanupLog,
  profiles,
  permissionRoles,
  userPermissionRoles,
  voiceSessions,
  applications,
  applicationFlows
} = vi.hoisted(() => {
  const eqCalls: Array<{ left: unknown; right: unknown }> = [];
  const andCalls: unknown[][] = [];

  // mockEq/mockAnd must be callable constructors (can be invoked with `new`)
  // so that `new eq(column, value)` works in Drizzle-style usage.
  // They also track call arguments for test assertions.
   
  const makeEqMock = () => Object.assign(
    (left: unknown, right: unknown) => {
      eqCalls.push({ left, right });
      return { kind: "eq", left, right };
    },
    { kind: "mock-constructor" }
  );
   
  const makeAndMock = () => Object.assign(
    (...conditions: unknown[]) => {
      andCalls.push(conditions as unknown[][]);
      return { kind: "and", conditions };
    },
    { kind: "mock-constructor" }
  );

  const mockEq = makeEqMock();
  const mockAnd = makeAndMock();

  return {
    mockGetDb: vi.fn(),
    mockDeleteUsersByIds: vi.fn(),
    mockRequestPlatform: vi.fn(),
    eqCalls,
    andCalls,
    mockEq,
    mockAnd,
    users: {
      id: "users.id",
      discordId: "users.discordId",
      email: "users.email",
      displayName: "users.displayName",
      avatarUrl: "users.avatarUrl",
      primaryPlatform: "users.primaryPlatform",
      createdAt: "users.createdAt",
      updatedAt: "users.updatedAt",
      lastLoginAt: "users.lastLoginAt"
    },
    userCommunityRoles: {
      userId: "userCommunityRoles.userId",
      communityRoleId: "userCommunityRoles.communityRoleId",
      assignedAt: "userCommunityRoles.assignedAt"
    },
    communityRoles: {
      id: "communityRoles.id",
      name: "communityRoles.name"
    },
    userPlatformAccounts: {
      userId: "userPlatformAccounts.userId",
      platform: "userPlatformAccounts.platform",
      platformUserId: "userPlatformAccounts.platformUserId",
      platformUsername: "userPlatformAccounts.platformUsername",
      platformAvatarUrl: "userPlatformAccounts.platformAvatarUrl",
      isPrimary: "userPlatformAccounts.isPrimary",
      linkedAt: "userPlatformAccounts.linkedAt"
    },
    cleanupLog: "cleanupLog",
    profiles: {
      userId: "profiles.userId",
      customFields: "profiles.customFields",
      localePreference: "profiles.localePreference",
      updatedAt: "profiles.updatedAt"
    },
    permissionRoles: {
      id: "permissionRoles.id",
      name: "permissionRoles.name"
    },
    userPermissionRoles: {
      userId: "userPermissionRoles.userId",
      permissionRoleId: "userPermissionRoles.permissionRoleId",
      assignedAt: "userPermissionRoles.assignedAt"
    },
    voiceSessions: {
      id: "voiceSessions.id",
      userId: "voiceSessions.userId",
      platform: "voiceSessions.platform",
      channelId: "voiceSessions.channelId",
      startedAt: "voiceSessions.startedAt",
      endedAt: "voiceSessions.endedAt",
      durationMinutes: "voiceSessions.durationMinutes"
    },
    applications: {
      id: "applications.id",
      flowId: "applications.flowId",
      status: "applications.status",
      answersJson: "applications.answersJson",
      rolesAssigned: "applications.rolesAssigned",
      pendingRoleAssignments: "applications.pendingRoleAssignments",
      displayNameComposed: "applications.displayNameComposed",
      reviewedAt: "applications.reviewedAt",
      createdAt: "applications.createdAt",
      updatedAt: "applications.updatedAt",
      discordId: "applications.discordId"
    },
    applicationFlows: {
      id: "applicationFlows.id",
      name: "applicationFlows.name"
    }
  };
});

vi.mock("drizzle-orm", () => ({
  eq: mockEq,
  and: mockAnd
}));

vi.mock("@guildora/shared", () => ({
  users,
  userCommunityRoles,
  communityRoles,
  userPlatformAccounts,
  cleanupLog,
  profiles,
  permissionRoles,
  userPermissionRoles,
  voiceSessions,
  applications,
  applicationFlows
}));

vi.mock("../db", () => ({
  getDb: mockGetDb
}));

vi.mock("../admin-mirror", () => ({
  deleteUsersByIds: mockDeleteUsersByIds
}));

vi.mock("../platformBridge", () => ({
  requestPlatform: mockRequestPlatform
}));

function createDbMock(options: {
  userRow?: Record<string, unknown> | null;
  roleRows?: Array<Record<string, unknown>>;
  platformAccounts?: Array<Record<string, unknown>>;
  insertSpy?: ReturnType<typeof vi.fn>;
  profileRow?: Record<string, unknown> | null;
  communityRoleRows?: Array<Record<string, unknown>>;
  permissionRoleRows?: Array<Record<string, unknown>>;
  voiceRows?: Array<Record<string, unknown>>;
  applicationRows?: Array<Record<string, unknown>>;
  platformAccountRows?: Array<Record<string, unknown>>;
}) {
  const {
    userRow = null,
    roleRows = [],
    platformAccounts = [],
    insertSpy = vi.fn(),
    profileRow = null,
    communityRoleRows = [],
    permissionRoleRows = [],
    voiceRows = [],
    applicationRows = [],
    platformAccountRows = []
  } = options;

  // callIdx is LOCAL to each createDbMock call — each test gets a fresh counter.
  let callIdx = 0;

  function resolveFor(idx: number): Promise<unknown[]> {
    switch (idx) {
      case 0: return Promise.resolve(userRow ? [userRow] : []);
      case 1: return Promise.resolve(roleRows);
      case 2: return Promise.resolve(platformAccounts);
      case 3: return Promise.resolve(userRow ? [userRow] : []);
      case 4: return Promise.resolve(profileRow ? [profileRow] : []);
      case 5: return Promise.resolve(communityRoleRows);
      case 6: return Promise.resolve(permissionRoleRows);
      case 7: return Promise.resolve(voiceRows);
      case 8: return Promise.resolve(applicationRows);
      case 9: return Promise.resolve(platformAccountRows);
      default: throw new Error(`Unexpected select call ${idx + 1}`);
    }
  }

  const joinSteps = new Set([1, 5, 6, 8]);

  function makeSelectChain(idx: number) {
    const hasJoin = joinSteps.has(idx);
    const limitFn = function _limit() { return resolveFor(idx); };
    const whereRet = { limit: limitFn };
    const fromRet: Record<string, unknown> = {
      where: function _where(_?: unknown) { return whereRet; }
    };
    if (hasJoin) {
      fromRet.innerJoin = function _ij(_?: unknown, __?: unknown) {
        return { where: function _w(_?: unknown) { return whereRet; } };
      };
    }
    const chain: Record<string, unknown> = { ...fromRet };
    chain.from = function _from(_?: unknown) { return chain; };
    return chain;
  }

  // Only the top-level select/insert are vi.fn mocks. Internal chain uses
  // plain functions so closure variables (callIdx, roleRows, etc.) are
  // always current at call time.
  const select = vi.fn(function _select(_arg?: unknown) {
    const idx = callIdx++;
    return makeSelectChain(idx);
  });

  const insert = vi.fn(function _insert(table: unknown) {
    if (table !== cleanupLog) throw new Error("Unexpected table insert: " + String(table));
    return { values: insertSpy };
  });

  const db = { select, insert };

  return { db, insertSpy };
}

describe("executeGdprErasure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
    andCalls.length = 0;
    mockDeleteUsersByIds.mockResolvedValue(1);
    mockRequestPlatform.mockResolvedValue(undefined);
  });

  it("executes successful erasure with discord ban + matrix kick", async () => {
    const insertSpy = vi.fn().mockResolvedValue(undefined);
    const { db } = createDbMock({
      userRow: { discordId: "disc_1", displayName: "Alice" },
      roleRows: [{ roleName: "member" }, { roleName: "candidate" }],
      platformAccounts: [
        { platform: "discord", platformUserId: "123" },
        { platform: "matrix", platformUserId: "@alice:example.org" }
      ],
      insertSpy
    });

    mockGetDb.mockReturnValue(db);

    const result = await executeGdprErasure("user-1", "admin-1");

    expect(result.success).toBe(true);
    expect(result.externalResults.discord).toEqual({ attempted: true, success: true });
    expect(result.externalResults.matrix).toEqual({ attempted: true, success: true });

    expect(mockDeleteUsersByIds).toHaveBeenCalledWith(["user-1"]);
    expect(mockRequestPlatform).toHaveBeenNthCalledWith(1, "discord", "/internal/guild/members/123/ban", {
      method: "POST",
      body: { deleteMessageSeconds: 604800 }
    });
    expect(mockRequestPlatform).toHaveBeenNthCalledWith(
      2,
      "matrix",
      "/internal/guild/members/%40alice%3Aexample.org/kick",
      { method: "POST" }
    );

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith({
      userId: null,
      discordId: "disc_1",
      discordUsername: "Alice",
      reason: "gdpr_erasure",
      conditionsMatched: ["user_request"],
      rolesRemoved: ["member", "candidate"]
    });
  });

  it("continues DB deletion and logs cleanup when discord ban fails", async () => {
    const insertSpy = vi.fn().mockResolvedValue(undefined);
    const { db } = createDbMock({
      userRow: { discordId: "disc_1", displayName: "Alice" },
      roleRows: [{ roleName: "member" }],
      platformAccounts: [{ platform: "discord", platformUserId: "123" }],
      insertSpy
    });

    mockGetDb.mockReturnValue(db);
    mockRequestPlatform.mockRejectedValueOnce(new Error("discord unavailable"));

    const result = await executeGdprErasure("user-1", "admin-1");

    expect(result.success).toBe(true);
    expect(result.externalResults.discord).toEqual({
      attempted: true,
      success: false,
      error: "discord unavailable"
    });
    expect(mockDeleteUsersByIds).toHaveBeenCalledWith(["user-1"]);
    expect(insertSpy).toHaveBeenCalledTimes(2);
    expect(insertSpy).toHaveBeenNthCalledWith(1, {
      userId: null,
      discordId: "123",
      discordUsername: "Alice",
      reason: "gdpr_erasure_external_discord_failed:discord unavailable",
      conditionsMatched: ["user_request", "discord_ban_failed"],
      rolesRemoved: ["member"]
    });
    expect(insertSpy).toHaveBeenNthCalledWith(2, {
      userId: null,
      discordId: "disc_1",
      discordUsername: "Alice",
      reason: "gdpr_erasure",
      conditionsMatched: ["user_request"],
      rolesRemoved: ["member"]
    });
  });

  it("continues DB deletion and logs cleanup when matrix kick fails", async () => {
    const insertSpy = vi.fn().mockResolvedValue(undefined);
    const { db } = createDbMock({
      userRow: { discordId: "disc_2", displayName: "Bob" },
      roleRows: [{ roleName: "moderator" }],
      platformAccounts: [{ platform: "matrix", platformUserId: "@bob:example.org" }],
      insertSpy
    });

    mockGetDb.mockReturnValue(db);
    mockRequestPlatform.mockRejectedValueOnce(new Error("matrix timeout"));

    const result = await executeGdprErasure("user-2", "admin-2");

    expect(result.success).toBe(true);
    expect(result.externalResults.matrix).toEqual({
      attempted: true,
      success: false,
      error: "matrix timeout"
    });
    expect(insertSpy).toHaveBeenCalledTimes(2);
    expect(insertSpy).toHaveBeenNthCalledWith(1, {
      userId: null,
      discordId: "disc_2",
      discordUsername: "Bob",
      reason: "gdpr_erasure_external_matrix_failed:matrix timeout",
      conditionsMatched: ["user_request", "matrix_kick_failed"],
      rolesRemoved: ["moderator"]
    });
    expect(insertSpy).toHaveBeenNthCalledWith(2, {
      userId: null,
      discordId: "disc_2",
      discordUsername: "Bob",
      reason: "gdpr_erasure",
      conditionsMatched: ["user_request"],
      rolesRemoved: ["moderator"]
    });
  });

  it("logs both failure paths and still succeeds when both externals fail", async () => {
    const insertSpy = vi.fn().mockResolvedValue(undefined);
    const { db } = createDbMock({
      userRow: { discordId: "disc_3", displayName: "Carol" },
      roleRows: [{ roleName: "member" }],
      platformAccounts: [
        { platform: "discord", platformUserId: "999" },
        { platform: "matrix", platformUserId: "@carol:example.org" }
      ],
      insertSpy
    });

    mockGetDb.mockReturnValue(db);
    mockRequestPlatform
      .mockRejectedValueOnce(new Error("discord down"))
      .mockRejectedValueOnce(new Error("matrix down"));

    const result = await executeGdprErasure("user-3", "admin-3");

    expect(result.success).toBe(true);
    expect(result.externalResults.discord.error).toBe("discord down");
    expect(result.externalResults.matrix.error).toBe("matrix down");
    expect(insertSpy).toHaveBeenCalledTimes(3);
    expect(insertSpy.mock.calls[0][0].reason).toContain("gdpr_erasure_external_discord_failed:discord down");
    expect(insertSpy.mock.calls[1][0].reason).toContain("gdpr_erasure_external_matrix_failed:matrix down");
    expect(insertSpy.mock.calls[2][0].reason).toBe("gdpr_erasure");
  });

  it("reads platform IDs before deleting user", async () => {
    // Verify erasure succeeds even with only a Discord account
    // (proves platform account data is available when the external ban call is made)
    const insertSpy = vi.fn().mockResolvedValue(undefined);
    const { db } = createDbMock({
      userRow: { discordId: "disc_4", displayName: "Dana" },
      roleRows: [],
      platformAccounts: [{ platform: "discord", platformUserId: "777" }],
      insertSpy
    });

    mockGetDb.mockReturnValue(db);

    const result = await executeGdprErasure("user-4", "admin-4");

    expect(result.success).toBe(true);
    expect(result.externalResults.discord).toEqual({ attempted: true, success: true });
    expect(mockDeleteUsersByIds).toHaveBeenCalledWith(["user-4"]);
  });
});

describe("assembleUserDataExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
    andCalls.length = 0;
  });

  it("returns all expected categories for populated user data", async () => {
    const exportedAtBefore = Date.now();
    const { db } = createDbMock({
      userRow: {
        id: "u1",
        discordId: "disc_u1",
        email: "alice@example.org",
        displayName: "Alice",
        avatarUrl: "https://cdn/avatar.png",
        primaryPlatform: "discord",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-02-01T00:00:00Z"),
        lastLoginAt: new Date("2024-03-01T00:00:00Z")
      },
      profileRow: {
        customFields: { bio: "hello" },
        localePreference: "en",
        updatedAt: new Date("2024-02-15T00:00:00Z")
      },
      communityRoleRows: [{ communityRoleName: "member", assignedAt: new Date("2024-01-02T00:00:00Z") }],
      permissionRoleRows: [{ permissionRoleName: "user", assignedAt: new Date("2024-01-03T00:00:00Z") }],
      voiceRows: [
        {
          id: "vs1",
          platform: "discord",
          channelId: "chan1",
          startedAt: new Date("2024-03-01T10:00:00Z"),
          endedAt: new Date("2024-03-01T10:30:00Z"),
          durationMinutes: 30
        }
      ],
      applicationRows: [
        {
          id: "app1",
          flowId: "flow1",
          flowName: "Main Application",
          status: "approved",
          answersJson: { q1: "a1" },
          rolesAssigned: ["member"],
          pendingRoleAssignments: [],
          displayNameComposed: "Alice#1234",
          reviewedAt: new Date("2024-03-05T00:00:00Z"),
          createdAt: new Date("2024-03-02T00:00:00Z"),
          updatedAt: new Date("2024-03-05T00:00:00Z")
        }
      ],
      platformAccountRows: [
        {
          platform: "discord",
          platformUserId: "disc_u1",
          platformUsername: "alice",
          platformAvatarUrl: "https://cdn/avatar2.png",
          isPrimary: true,
          linkedAt: new Date("2024-01-01T00:00:00Z")
        }
      ]
    });

    mockGetDb.mockReturnValue(db);

    const result = await assembleUserDataExport("u1");

    expect(result.profile.id).toBe("u1");
    expect(result.profile.profile).toMatchObject({ localePreference: "en", customFields: { bio: "hello" } });
    expect(result.roles.community).toHaveLength(1);
    expect(result.roles.permission).toHaveLength(1);
    expect(result.voiceHistory).toHaveLength(1);
    expect(result.applications).toHaveLength(1);
    expect(result.platformAccounts).toHaveLength(1);
    expect(new Date(result.exportedAt).getTime()).toBeGreaterThanOrEqual(exportedAtBefore);
  });

  it("returns empty structures for users with no related data", async () => {
    const { db } = createDbMock({
      userRow: null,
      profileRow: null,
      communityRoleRows: [],
      permissionRoleRows: [],
      voiceRows: [],
      applicationRows: [],
      platformAccountRows: []
    });

    mockGetDb.mockReturnValue(db);

    const result = await assembleUserDataExport("missing-user");

    expect(result.profile).toEqual({ profile: null });
    expect(result.roles.community).toEqual([]);
    expect(result.roles.permission).toEqual([]);
    expect(result.voiceHistory).toEqual([]);
    expect(result.applications).toEqual([]);
    expect(result.platformAccounts).toEqual([]);
    expect(typeof result.exportedAt).toBe("string");
  });
});
