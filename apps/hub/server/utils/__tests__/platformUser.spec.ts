/**
 * Tests for platformUser utility:
 *   - getUserByPlatformId() with platform_accounts and legacy discord_id fallback
 *   - ensurePlatformUser() create and update
 *   - linkPlatformAccount()
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { stubNuxtAutoImports, cleanupAutoImportStubs } from "./test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;

vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@guildora/shared", () => ({
  users: { id: "id", discordId: "discord_id", displayName: "display_name", email: "email", avatarUrl: "avatar_url", avatarSource: "avatar_source", primaryPlatform: "primary_platform", lastLoginAt: "last_login_at" },
  userPlatformAccounts: { id: "id", userId: "user_id", platform: "platform", platformUserId: "platform_user_id", platformUsername: "platform_username", platformAvatarUrl: "platform_avatar_url", isPrimary: "is_primary" },
  profiles: { userId: "user_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ["eq", ...args]),
  and: vi.fn((...args: unknown[]) => ["and", ...args]),
}));

beforeEach(() => {
  mocks = stubNuxtAutoImports();
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  vi.clearAllMocks();
});

function mockDbMultiQuery(responses: unknown[][]) {
  let callIndex = 0;
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: Function) => {
    const result = responses[callIndex] ?? [];
    callIndex++;
    return resolve(result);
  };
  return chain;
}

// ─── getUserByPlatformId ────────────────────────────────────────────────────

describe("getUserByPlatformId", () => {
  it("finds user via platform_accounts", async () => {
    const { getDb } = await import("../db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(
      mockDbMultiQuery([
        [{ userId: "u1", discordId: "d1", displayName: "Test User" }], // platform_accounts hit
      ])
    );

    const { getUserByPlatformId } = await import("../platformUser");
    const result = await getUserByPlatformId("discord", "d1");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("u1");
    expect(result!.displayName).toBe("Test User");
  });

  it("falls back to users.discord_id for Discord", async () => {
    const { getDb } = await import("../db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(
      mockDbMultiQuery([
        [], // platform_accounts miss
        [{ id: "u2", discordId: "d2", displayName: "Legacy User" }], // users.discord_id hit
      ])
    );

    const { getUserByPlatformId } = await import("../platformUser");
    const result = await getUserByPlatformId("discord", "d2");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("u2");
  });

  it("returns null for unknown Matrix user", async () => {
    const { getDb } = await import("../db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(
      mockDbMultiQuery([
        [], // platform_accounts miss — no fallback for Matrix
      ])
    );

    const { getUserByPlatformId } = await import("../platformUser");
    const result = await getUserByPlatformId("matrix", "@unknown:server");

    expect(result).toBeNull();
  });

  it("returns null when no user found at all", async () => {
    const { getDb } = await import("../db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(
      mockDbMultiQuery([
        [], // platform_accounts miss
        [], // users.discord_id miss
      ])
    );

    const { getUserByPlatformId } = await import("../platformUser");
    const result = await getUserByPlatformId("discord", "nonexistent");

    expect(result).toBeNull();
  });
});

// ─── ensurePlatformUser ─────────────────────────────────────────────────────

describe("ensurePlatformUser", () => {
  it("returns existing user and updates metadata", async () => {
    const { getDb } = await import("../db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(
      mockDbMultiQuery([
        [{ userId: "u1", discordId: "d1", displayName: "Existing" }], // getUserByPlatformId hit
        [], // update platform_accounts
      ])
    );

    const { ensurePlatformUser } = await import("../platformUser");
    const result = await ensurePlatformUser({
      platform: "discord",
      platformUserId: "d1",
      platformUsername: "Updated Name",
    });

    expect(result.userId).toBe("u1");
    expect(result.isNew).toBe(false);
  });

  it("creates new user for unknown platform identity", async () => {
    const { getDb } = await import("../db");

    // For new user creation, getUserByPlatformId calls platform_accounts (miss)
    // Since platform is 'matrix', there's no discord_id fallback — goes straight to insert.
    // We need: select miss → insert+returning → insert profiles → insert platform_accounts
    let callIndex = 0;
    const responses = [
      [], // getUserByPlatformId — platform_accounts miss (matrix, no discord fallback)
      [{ id: "new-user-id" }], // insert users → returning
      [], // insert profiles
      [], // insert userPlatformAccounts
    ];
    const chain: Record<string, any> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    chain.insert = vi.fn().mockReturnValue(chain);
    chain.values = vi.fn().mockReturnValue(chain);
    chain.returning = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue(chain);
    chain.set = vi.fn().mockReturnValue(chain);
    chain.then = (resolve: Function) => {
      const result = responses[callIndex] ?? [];
      callIndex++;
      return resolve(result);
    };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const { ensurePlatformUser } = await import("../platformUser");
    const result = await ensurePlatformUser({
      platform: "matrix",
      platformUserId: "@alice:matrix.org",
      platformUsername: "Alice",
      platformAvatarUrl: "https://matrix.org/avatar.jpg",
    });

    expect(result.userId).toBe("new-user-id");
    expect(result.isNew).toBe(true);
  });
});

// ─── linkPlatformAccount ────────────────────────────────────────────────────

describe("linkPlatformAccount", () => {
  it("throws when platform identity is linked to different user", async () => {
    const { getDb } = await import("../db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(
      mockDbMultiQuery([
        [{ userId: "other-user" }], // existing link to different user
      ])
    );

    const { linkPlatformAccount } = await import("../platformUser");

    await expect(
      linkPlatformAccount("my-user", {
        platform: "matrix",
        platformUserId: "@taken:server",
      })
    ).rejects.toThrow("already linked to a different user");
  });

  it("does nothing when already linked to same user", async () => {
    const { getDb } = await import("../db");
    const db = mockDbMultiQuery([
      [{ userId: "my-user" }], // already linked to same user
    ]);
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);

    const { linkPlatformAccount } = await import("../platformUser");
    await linkPlatformAccount("my-user", {
      platform: "discord",
      platformUserId: "123",
    });

    // Should not call insert (no new link needed)
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("creates link for new platform identity", async () => {
    const { getDb } = await import("../db");
    const db = mockDbMultiQuery([
      [], // no existing link
      [], // insert platform_account
      [{ discordId: null }], // check user.discord_id (for Discord backfill)
      [], // update users.discord_id
    ]);
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);

    const { linkPlatformAccount } = await import("../platformUser");
    await linkPlatformAccount("my-user", {
      platform: "discord",
      platformUserId: "456",
      platformUsername: "NewDiscord",
    });

    expect(db.insert).toHaveBeenCalled();
  });
});
