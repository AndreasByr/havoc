import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildSessionUser,
  createMockEvent,
  stubNuxtAutoImports,
  cleanupAutoImportStubs,
} from "./test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;

beforeEach(() => {
  mocks = stubNuxtAutoImports();
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
});

// Mock the DB and community dependencies before importing auth-session
vi.mock("../db", () => ({
  getDb: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("../community", () => ({
  getCommunityRoleName: vi.fn().mockResolvedValue(null),
  getUserRoles: vi.fn().mockResolvedValue(["user"]),
}));

vi.mock("../moderation-rights", () => ({
  loadModerationRights: vi.fn().mockResolvedValue({
    modDeleteUsers: false,
    modManageApplications: false,
    modAccessCommunitySettings: false,
    modAccessDesign: false,
    modAccessApps: false,
    modAccessDiscordRoles: false,
  }),
  defaultModerationRights: {
    modDeleteUsers: false,
    modManageApplications: false,
    modAccessCommunitySettings: false,
    modAccessDesign: false,
    modAccessApps: false,
    modAccessDiscordRoles: false,
  },
}));

vi.mock("@guildora/shared", () => ({
  users: { id: "id" },
}));

async function importAuthSession() {
  return import("../auth-session");
}

// ─── getSessionUserById ─────────────────────────────────────────────────────

describe("getSessionUserById", () => {
  it("returns null when user is not found in DB", async () => {
    const { getSessionUserById } = await importAuthSession();
    const result = await getSessionUserById("nonexistent-id");
    expect(result).toBeNull();
  });

  it("returns a session user object when user exists", async () => {
    const { getDb } = await import("../db");
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: "user-1",
        discordId: "discord-1",
        displayName: "TestUser",
        avatarUrl: "https://example.com/avatar.png",
      }]),
    };
    vi.mocked(getDb).mockReturnValue(mockDb as ReturnType<typeof getDb>);

    const { getSessionUserById } = await importAuthSession();
    const result = await getSessionUserById("user-1");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("user-1");
    expect(result!.discordId).toBe("discord-1");
    expect(result!.profileName).toBe("TestUser");
    expect(result!.avatarUrl).toBe("https://example.com/avatar.png");
  });

  it("includes permissionRoles from getUserRoles", async () => {
    const { getDb } = await import("../db");
    const { getUserRoles } = await import("../community");
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: "u1", discordId: "d1", displayName: "U", avatarUrl: null }]),
    } as ReturnType<typeof getDb>);
    vi.mocked(getUserRoles).mockResolvedValue(["admin", "moderator"]);

    const { getSessionUserById } = await importAuthSession();
    const result = await getSessionUserById("u1");

    expect(result!.permissionRoles).toEqual(["admin", "moderator"]);
  });

  it("includes communityRole from getCommunityRoleName", async () => {
    const { getDb } = await import("../db");
    const { getCommunityRoleName } = await import("../community");
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: "u1", discordId: "d1", displayName: "U", avatarUrl: null }]),
    } as ReturnType<typeof getDb>);
    vi.mocked(getCommunityRoleName).mockResolvedValue("Custom Role");

    const { getSessionUserById } = await importAuthSession();
    const result = await getSessionUserById("u1");

    expect(result!.communityRole).toBe("Custom Role");
  });

  it("falls back to defaultModerationRights when loadModerationRights rejects", async () => {
    const { getDb } = await import("../db");
    const { loadModerationRights } = await import("../moderation-rights");
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: "u1", discordId: "d1", displayName: "U", avatarUrl: null }]),
    } as ReturnType<typeof getDb>);
    vi.mocked(loadModerationRights).mockRejectedValue(new Error("DB fail"));

    const { getSessionUserById } = await importAuthSession();
    const result = await getSessionUserById("u1");

    expect(result!.moderationRights).toBeDefined();
    expect(result!.moderationRights!.modDeleteUsers).toBe(false);
  });
});

// ─── replaceAuthSession ─────────────────────────────────────────────────────

describe("replaceAuthSession", () => {
  it("calls replaceUserSession with session data", async () => {
    mocks.getUserSession.mockResolvedValue({});

    const { replaceAuthSession } = await importAuthSession();
    const event = createMockEvent();
    const sessionUser = buildSessionUser("admin");

    await replaceAuthSession(event, sessionUser);

    expect(mocks.replaceUserSession).toHaveBeenCalledOnce();
    const callArgs = mocks.replaceUserSession.mock.calls[0];
    expect(callArgs[1].user).toEqual(sessionUser);
  });

  it("includes originalUserId when provided", async () => {
    mocks.getUserSession.mockResolvedValue({});

    const { replaceAuthSession } = await importAuthSession();
    const event = createMockEvent();
    const sessionUser = buildSessionUser("moderator");

    await replaceAuthSession(event, sessionUser, "original-admin-id");

    const callArgs = mocks.replaceUserSession.mock.calls[0];
    expect(callArgs[1].originalUserId).toBe("original-admin-id");
  });

  it("preserves existing CSRF token from current session", async () => {
    mocks.getUserSession.mockResolvedValue({ csrfToken: "existing-csrf-token" });

    const { replaceAuthSession } = await importAuthSession();
    const event = createMockEvent();
    const sessionUser = buildSessionUser("user");

    await replaceAuthSession(event, sessionUser);

    const callArgs = mocks.replaceUserSession.mock.calls[0];
    expect(callArgs[1].csrfToken).toBe("existing-csrf-token");
  });

  it("does not set csrfToken when existing session has none", async () => {
    mocks.getUserSession.mockResolvedValue({});

    const { replaceAuthSession } = await importAuthSession();
    const event = createMockEvent();
    const sessionUser = buildSessionUser("user");

    await replaceAuthSession(event, sessionUser);

    const callArgs = mocks.replaceUserSession.mock.calls[0];
    expect(callArgs[1].csrfToken).toBeUndefined();
  });

  it("does not include originalUserId when null", async () => {
    mocks.getUserSession.mockResolvedValue({});

    const { replaceAuthSession } = await importAuthSession();
    const event = createMockEvent();
    const sessionUser = buildSessionUser("user");

    await replaceAuthSession(event, sessionUser, null);

    const callArgs = mocks.replaceUserSession.mock.calls[0];
    expect(callArgs[1].originalUserId).toBeUndefined();
  });

  it("delegates to replaceUserSession without custom cookie config", async () => {
    mocks.getUserSession.mockResolvedValue({});

    const { replaceAuthSession } = await importAuthSession();
    const event = createMockEvent();
    await replaceAuthSession(event, buildSessionUser("user"));

    const callArgs = mocks.replaceUserSession.mock.calls[0];
    // Cookie config is handled centrally via nuxt.config, not per-call
    expect(callArgs).toHaveLength(2);
  });
});

// ─── replaceAuthSessionForUserId ────────────────────────────────────────────

describe("replaceAuthSessionForUserId", () => {
  it("throws 404 when user is not found", async () => {
    mocks.getUserSession.mockResolvedValue({});
    const { getDb } = await import("../db");
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    } as ReturnType<typeof getDb>);

    const { replaceAuthSessionForUserId } = await importAuthSession();
    const event = createMockEvent();

    await expect(replaceAuthSessionForUserId(event, "nonexistent")).rejects.toThrow();
  });

  it("returns sessionUser and calls replaceAuthSession on success", async () => {
    mocks.getUserSession.mockResolvedValue({});
    const { getDb } = await import("../db");
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: "u1", discordId: "d1", displayName: "User", avatarUrl: null }]),
    } as ReturnType<typeof getDb>);

    const { replaceAuthSessionForUserId } = await importAuthSession();
    const event = createMockEvent();
    const result = await replaceAuthSessionForUserId(event, "u1");

    expect(result.id).toBe("u1");
    expect(mocks.replaceUserSession).toHaveBeenCalled();
  });
});
