import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock("@guildora/shared", () => ({
  communityRoles: Symbol("communityRoles"),
  permissionRoles: Symbol("permissionRoles"),
  profiles: Symbol("profiles"),
  userCommunityRoles: Symbol("userCommunityRoles"),
  userPermissionRoles: Symbol("userPermissionRoles"),
  users: Symbol("users"),
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ _tag: "and", args }),
  eq: (a: unknown, b: unknown) => ({ _tag: "eq", a, b }),
}));

// ─── DB mock setup ──────────────────────────────────────────────────────────

let selectResults: unknown[][] = [];
let selectCallIndex = 0;

function createChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.limit = vi.fn().mockImplementation(() => {
    const result = selectResults[selectCallIndex] ?? [];
    selectCallIndex++;
    return Promise.resolve(result);
  });
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockImplementation((vals: unknown) => {
    // For insert().values().returning(), return the chain for further chaining
    return { returning: vi.fn().mockResolvedValue([vals]) };
  });
  chain.returning = vi.fn().mockResolvedValue([]);
  return chain;
}

const mockChain = createChain();

const mockDb = {
  select: vi.fn().mockReturnValue(mockChain),
  insert: vi.fn().mockReturnValue(mockChain),
  update: vi.fn().mockReturnValue(mockChain),
};

vi.mock("../db", () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  ensureBaseRoles,
  ensureDiscordUser,
  getUserByDiscordId,
  getUserProfileByDiscordId,
} from "../community.js";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("getUserByDiscordId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults = [];
    selectCallIndex = 0;
  });

  it("returns user when found", async () => {
    const user = { id: "u1", discordId: "d1", displayName: "Alice" };
    selectResults = [[user]];

    const result = await getUserByDiscordId("d1");
    expect(result).toEqual(user);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("returns null when not found", async () => {
    selectResults = [[]];

    const result = await getUserByDiscordId("nonexistent");
    expect(result).toBeNull();
  });
});

describe("ensureBaseRoles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults = [];
    selectCallIndex = 0;
  });

  it("inserts missing permission roles and creates Mitglied community role", async () => {
    // 5 permission role lookups: all empty (need insert)
    // 1 Mitglied lookup: empty
    // 1 user role lookup for Mitglied creation: returns a role
    selectResults = [
      [], // temporaer not found
      [], // user not found
      [], // moderator not found
      [], // admin not found
      [], // superadmin not found
      [], // Mitglied not found
      [{ id: "role-user", name: "user" }], // user role for Mitglied
    ];

    await ensureBaseRoles();

    // 5 permission role inserts + 1 community role insert = 6 insert calls
    expect(mockDb.insert).toHaveBeenCalledTimes(6);
  });

  it("skips existing permission roles", async () => {
    // All 5 roles exist, Mitglied exists
    selectResults = [
      [{ name: "temporaer" }],
      [{ name: "user" }],
      [{ name: "moderator" }],
      [{ name: "admin" }],
      [{ name: "superadmin" }],
      [{ name: "Mitglied" }],
    ];

    await ensureBaseRoles();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});

describe("ensureDiscordUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults = [];
    selectCallIndex = 0;
  });

  it("creates new user with profile and roles", async () => {
    const newUser = { id: "u1", discordId: "d1", displayName: "Bob", avatarUrl: null };

    // ensureBaseRoles selects (5 roles exist + Mitglied exists = 6 selects)
    // then ensureDiscordUser selects: user lookup, profile, defaultRole, assignment, mitgliedRole, communityAssignment
    selectResults = [
      // ensureBaseRoles: all exist
      [{ name: "temporaer" }],
      [{ name: "user" }],
      [{ name: "moderator" }],
      [{ name: "admin" }],
      [{ name: "superadmin" }],
      [{ name: "Mitglied" }],
      // ensureDiscordUser:
      [],  // user lookup: not found → will insert
      [],  // profile lookup: not found → will insert
      [{ id: "perm-user", name: "user" }], // defaultRole lookup
      [], // permission role assignment lookup
      [{ id: "cr-mitglied", name: "Mitglied" }], // mitgliedRole
      [], // community assignment lookup
    ];

    // The insert().values().returning() for user creation
    mockChain.values.mockImplementationOnce(() => ({
      returning: vi.fn().mockResolvedValue([newUser]),
    }));

    const result = await ensureDiscordUser({
      discordId: "d1",
      displayName: "Bob",
      avatarUrl: null,
    });

    expect(result).toEqual(newUser);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("updates existing user displayName and avatar", async () => {
    const existingUser = { id: "u1", discordId: "d1", displayName: "OldName", avatarUrl: null };

    selectResults = [
      // ensureBaseRoles: all exist
      [{ name: "temporaer" }],
      [{ name: "user" }],
      [{ name: "moderator" }],
      [{ name: "admin" }],
      [{ name: "superadmin" }],
      [{ name: "Mitglied" }],
      // ensureDiscordUser:
      [existingUser], // user found
      [{ userId: "u1" }], // profile exists
      [{ id: "perm-user", name: "user" }], // defaultRole
      [{ userId: "u1", permissionRoleId: "perm-user" }], // assignment exists
      [{ id: "cr-mitglied", name: "Mitglied" }], // mitgliedRole
      [{ userId: "u1" }], // community assignment exists
    ];

    const result = await ensureDiscordUser({
      discordId: "d1",
      displayName: "NewName",
      avatarUrl: "https://avatar.url",
    });

    expect(result).toEqual(existingUser);
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "NewName", avatarUrl: "https://avatar.url" })
    );
  });
});
