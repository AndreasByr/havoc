/**
 * Integration tests for member/profile access.
 * Tests own-profile vs other-profile access control,
 * staff-only access enforcement, and response shape.
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

vi.mock("../../utils/jsonResponse", () => ({
  jsonResponse: vi.fn((body: unknown) => body),
}));

vi.mock("../../utils/appearance", () => ({
  readAppearancePreferenceFromCustomFields: vi.fn(() => "system"),
}));

vi.mock("../../utils/locale-preference", () => ({
  normalizeUserLocalePreference: vi.fn((pref: unknown) => pref ?? null),
  readLegacyLocalePreferenceFromCustomFields: vi.fn(() => null),
  resolveEffectiveLocale: vi.fn(() => ({ locale: "en", source: "default" })),
}));

vi.mock("../../utils/discord-roles", () => ({
  buildEditableDiscordRolesForUser: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../utils/user-directory", () => ({
  loadUserProfilesMap: vi.fn().mockResolvedValue(new Map()),
  loadUserPermissionRolesMap: vi.fn().mockResolvedValue(new Map()),
  loadUserCommunityRolesMap: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("../../utils/voice", () => ({
  calculateVoiceMinutesFromSessions: vi.fn(() => 0),
  classifyVoiceActivity: vi.fn(() => "inactive"),
}));

vi.mock("../../utils/community-settings", () => ({
  loadCommunitySettingsLocale: vi.fn().mockResolvedValue("en"),
  loadDisplayNameTemplate: vi.fn().mockResolvedValue([]),
}));

vi.mock("@guildora/shared", () => ({
  parseProfileName: vi.fn((name: string) => ({ ingameName: name, rufname: name })),
  parseWithTemplate: vi.fn(() => undefined),
  users: { id: "id" },
  voiceSessions: { userId: "user_id", startedAt: "started_at", endedAt: "ended_at", durationMinutes: "duration_minutes" },
}));

beforeEach(() => {
  mocks = stubNuxtAutoImports();
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  vi.clearAllMocks();
});

function mockDbForProfile(userRows: unknown[], _voiceSessions: unknown[] = []) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(userRows),
  };
}

// ─── Own profile access ─────────────────────────────────────────────────────

describe("own profile access (GET /api/profile)", () => {
  it("requires authentication", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbForProfile([]) as ReturnType<typeof getDb>);

    const handler = (await import("../profile/index.get")).default;
    const event = createMockEvent({ method: "GET", path: "/api/profile" });

    await expect(handler(event)).rejects.toThrow();
  });

  it("allows any authenticated user to access own profile", async () => {
    const session = buildSession("user", { userOverrides: { id: "user-1" } });
    mocks.requireUserSession.mockResolvedValue(session);

    const userRow = {
      id: "user-1",
      discordId: "d-1",
      displayName: "Test User",
      avatarUrl: null,
      avatarSource: null,
    };

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbForProfile([userRow]) as ReturnType<typeof getDb>);
    vi.stubGlobal("getQuery", vi.fn(() => ({})));

    const handler = (await import("../profile/index.get")).default;
    const event = createMockEvent({ method: "GET", path: "/api/profile" });

    const result = await handler(event);
    expect(result.id).toBe("user-1");
    expect(result.profileName).toBe("Test User");

    vi.unstubAllGlobals();
    mocks = stubNuxtAutoImports();
  });

  it("temporaer user can access own profile", async () => {
    const session = buildSession("temporaer", { userOverrides: { id: "temp-1" } });
    mocks.requireUserSession.mockResolvedValue(session);

    const userRow = { id: "temp-1", discordId: "d-temp", displayName: "Temp User", avatarUrl: null, avatarSource: null };
    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbForProfile([userRow]) as ReturnType<typeof getDb>);
    vi.stubGlobal("getQuery", vi.fn(() => ({})));

    const handler = (await import("../profile/index.get")).default;
    const event = createMockEvent({ method: "GET", path: "/api/profile" });

    const result = await handler(event);
    expect(result.id).toBe("temp-1");

    vi.unstubAllGlobals();
    mocks = stubNuxtAutoImports();
  });
});

// ─── Other-profile access (staff only) ──────────────────────────────────────

describe("other-profile access (GET /api/profile?id=other)", () => {
  it("regular user cannot access other user profile (403)", async () => {
    const session = buildSession("user", { userOverrides: { id: "user-1" } });
    mocks.requireUserSession.mockResolvedValue(session);

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbForProfile([]) as ReturnType<typeof getDb>);
    vi.stubGlobal("getQuery", vi.fn(() => ({ id: "other-user-2" })));

    const handler = (await import("../profile/index.get")).default;
    const event = createMockEvent({ method: "GET", path: "/api/profile?id=other-user-2" });

    // requireStaffRole will throw because "user" is not staff
    await expect(handler(event)).rejects.toThrow();

    vi.unstubAllGlobals();
    mocks = stubNuxtAutoImports();
  });

  it("admin can access other user profile", async () => {
    const session = buildSession("admin", { userOverrides: { id: "admin-1" } });
    mocks.requireUserSession.mockResolvedValue(session);

    const otherUser = { id: "other-2", discordId: "d-other", displayName: "Other User", avatarUrl: null, avatarSource: null };
    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbForProfile([otherUser]) as ReturnType<typeof getDb>);
    vi.stubGlobal("getQuery", vi.fn(() => ({ id: "other-2" })));

    const handler = (await import("../profile/index.get")).default;
    const event = createMockEvent({ method: "GET", path: "/api/profile?id=other-2" });

    const result = await handler(event);
    expect(result.id).toBe("other-2");
    expect(result.profileName).toBe("Other User");

    vi.unstubAllGlobals();
    mocks = stubNuxtAutoImports();
  });

  it("moderator can access other user profile (staff role)", async () => {
    const session = buildSession("moderator", { userOverrides: { id: "mod-1" } });
    mocks.requireUserSession.mockResolvedValue(session);

    const otherUser = { id: "other-3", discordId: "d-other3", displayName: "Third User", avatarUrl: null, avatarSource: null };
    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbForProfile([otherUser]) as ReturnType<typeof getDb>);
    vi.stubGlobal("getQuery", vi.fn(() => ({ id: "other-3" })));

    const handler = (await import("../profile/index.get")).default;
    const event = createMockEvent({ method: "GET", path: "/api/profile?id=other-3" });

    const result = await handler(event);
    expect(result.id).toBe("other-3");

    vi.unstubAllGlobals();
    mocks = stubNuxtAutoImports();
  });

  it("superadmin can access other user profile", async () => {
    const session = buildSession("superadmin", { userOverrides: { id: "sa-1" } });
    mocks.requireUserSession.mockResolvedValue(session);

    const otherUser = { id: "other-4", discordId: "d-o4", displayName: "Fourth User", avatarUrl: null, avatarSource: null };
    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbForProfile([otherUser]) as ReturnType<typeof getDb>);
    vi.stubGlobal("getQuery", vi.fn(() => ({ id: "other-4" })));

    const handler = (await import("../profile/index.get")).default;
    const event = createMockEvent({ method: "GET", path: "/api/profile?id=other-4" });

    const result = await handler(event);
    expect(result.id).toBe("other-4");

    vi.unstubAllGlobals();
    mocks = stubNuxtAutoImports();
  });

  it("returns 404 when requested user does not exist", async () => {
    const session = buildSession("admin", { userOverrides: { id: "admin-1" } });
    mocks.requireUserSession.mockResolvedValue(session);

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbForProfile([]) as ReturnType<typeof getDb>);
    vi.stubGlobal("getQuery", vi.fn(() => ({ id: "nonexistent" })));

    const handler = (await import("../profile/index.get")).default;
    const event = createMockEvent({ method: "GET", path: "/api/profile?id=nonexistent" });

    await expect(handler(event)).rejects.toThrow();

    vi.unstubAllGlobals();
    mocks = stubNuxtAutoImports();
  });
});

// ─── Profile response shape ─────────────────────────────────────────────────

describe("profile response shape", () => {
  it("includes required fields in response", async () => {
    const session = buildSession("admin", { userOverrides: { id: "user-1" } });
    mocks.requireUserSession.mockResolvedValue(session);

    const userRow = {
      id: "user-1",
      discordId: "d-1",
      displayName: "Full User",
      avatarUrl: "https://cdn.example.com/avatar.png",
      avatarSource: "discord",
    };

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbForProfile([userRow]) as ReturnType<typeof getDb>);

    const { loadUserPermissionRolesMap } = await import("../../utils/user-directory");
    vi.mocked(loadUserPermissionRolesMap).mockResolvedValue(new Map([["user-1", ["admin"]]]) as unknown as Awaited<ReturnType<typeof loadUserPermissionRolesMap>>);

    vi.stubGlobal("getQuery", vi.fn(() => ({})));

    const handler = (await import("../profile/index.get")).default;
    const event = createMockEvent({ method: "GET" });

    const result = await handler(event);

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("discordId");
    expect(result).toHaveProperty("profileName");
    expect(result).toHaveProperty("avatarUrl");
    expect(result).toHaveProperty("permissionRoles");
    expect(result).toHaveProperty("communityRole");
    expect(result).toHaveProperty("customFields");
    expect(result).toHaveProperty("voiceSummary");
    expect(result).toHaveProperty("effectiveLocale");
    expect(result).toHaveProperty("editableDiscordRoles");

    vi.unstubAllGlobals();
    mocks = stubNuxtAutoImports();
  });
});
