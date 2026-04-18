/**
 * Tests for admin settings endpoints:
 *   - GET /api/admin/community-settings
 *   - PUT /api/admin/community-settings
 *   - GET /api/admin/theme
 *   - PUT /api/admin/theme
 *   - GET /api/admin/membership-settings
 *   - PUT /api/admin/membership-settings
 *   - GET /api/admin/moderation-rights
 *   - PUT /api/admin/moderation-rights
 *   - GET /api/admin/discord-roles
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

vi.mock("../../utils/community-settings", () => ({
  COMMUNITY_SETTINGS_SINGLETON_ID: "singleton",
  loadCommunitySettingsLocale: vi.fn().mockResolvedValue("en"),
  invalidateCommunitySettingsCache: vi.fn(),
}));

vi.mock("../../utils/membership-settings", () => ({
  MEMBERSHIP_SETTINGS_SINGLETON_ID: "singleton",
  loadMembershipSettings: vi.fn().mockResolvedValue({}),
  invalidateMembershipSettingsCache: vi.fn(),
}));

vi.mock("../../utils/moderation-rights", () => ({
  loadModerationRights: vi.fn().mockResolvedValue([]),
  invalidateModerationRightsCache: vi.fn(),
}));

vi.mock("../../utils/discord-roles", () => ({
  listSelectableDiscordRoleRows: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../utils/botSync", () => ({
  fetchDiscordGuildRolesFromBot: vi.fn().mockResolvedValue({ roles: [] }),
}));

vi.mock("../../utils/bot-bridge-error", () => ({
  throwBotBridgeHttpError: vi.fn((error: unknown) => { throw error; }),
}));

vi.mock("../../utils/theme", () => ({
  toAdminThemeResponse: vi.fn((row: unknown) => row ?? {}),
  normalizeThemeColors: vi.fn((v: unknown) => v),
  parseThemeLogoUpdate: vi.fn(() => ({ logo: null, removeLogo: false })),
  themeAdminUpdateSchema: {
    parse: vi.fn(),
    safeParse: vi.fn(),
  },
}));

vi.mock("../../utils/http", () => ({
  readBodyWithSchema: vi.fn().mockResolvedValue({}),
  requireRouterParam: vi.fn().mockReturnValue("test-param"),
}));

vi.mock("../../../utils/locale-preference", () => ({
  normalizeCommunityDefaultLocale: vi.fn((locale: unknown) => locale ?? "en"),
  localePreferences: ["en", "de"],
}));

vi.mock("@guildora/shared", () => ({
  communitySettings: {
    id: "id",
    communityName: "community_name",
    discordInviteCode: "discord_invite_code",
    defaultLocale: "default_locale",
    displayNameTemplate: "display_name_template",
    updatedAt: "updated_at",
    updatedBy: "updated_by",
  },
  themeSettings: {
    id: "id",
    updatedAt: "updated_at",
  },
  membershipSettings: {
    id: "id",
  },
  communityRoles: {
    id: "id",
    name: "name",
    sortOrder: "sort_order",
  },
  permissionRoles: {
    id: "id",
    name: "name",
    level: "level",
  },
  displayNameTemplateSchema: {
    optional: vi.fn().mockReturnThis(),
  },
  moderationSettings: {
    id: "id",
    updatedAt: "updated_at",
    updatedBy: "updated_by",
  },
}));

// ─── Helper: mock DB chain ──────────────────────────────────────────────────

function mockDbChain(returnValue: unknown = []) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => unknown) => resolve(returnValue);
  return chain;
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mocks = stubNuxtAutoImports();
  vi.stubGlobal("readBody", vi.fn());
  vi.stubGlobal("getRouterParam", vi.fn());
  vi.stubGlobal("eq", vi.fn());
  vi.stubGlobal("desc", vi.fn());
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  vi.clearAllMocks();
});

// ─── GET /api/admin/community-settings ─────────────────────────────────────

describe("GET /api/admin/community-settings", () => {
  async function importHandler() {
    return (await import("../admin/community-settings.get")).default;
  }

  it("requires admin session (403 for non-admin)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("user"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("rejects unauthenticated requests (401)", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("returns community settings for admin (200)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("admin"));
    const { getDb } = await import("../../utils/db");
    const row = {
      communityName: "Test Guild",
      discordInviteCode: "abc123",
      defaultLocale: "en",
      displayNameTemplate: [],
    };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain([row]));
    const handler = await importHandler();
    const result = await handler(createMockEvent({ method: "GET" }));
    expect(result).toBeDefined();
    expect(result).toHaveProperty("communityName");
    expect(result).toHaveProperty("defaultLocale");
  });
});

// ─── PUT /api/admin/community-settings ─────────────────────────────────────

describe("PUT /api/admin/community-settings", () => {
  async function importHandler() {
    return (await import("../admin/community-settings.put")).default;
  }

  it("requires admin session (403 for non-admin)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("user"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "PUT" }))).rejects.toThrow();
  });

  it("rejects unauthenticated requests (401)", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "PUT" }))).rejects.toThrow();
  });
});

// ─── GET /api/admin/theme ───────────────────────────────────────────────────

describe("GET /api/admin/theme", () => {
  async function importHandler() {
    return (await import("../admin/theme.get")).default;
  }

  it("requires admin session (403 for non-admin)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("user"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("rejects unauthenticated requests (401)", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("returns theme data for admin (200)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("admin"));
    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain([{ id: "theme-1" }]));
    const handler = await importHandler();
    const result = await handler(createMockEvent({ method: "GET" }));
    expect(result).toBeDefined();
  });
});

// ─── PUT /api/admin/theme ───────────────────────────────────────────────────

describe("PUT /api/admin/theme", () => {
  async function importHandler() {
    return (await import("../admin/theme.put")).default;
  }

  it("requires admin session (403 for non-admin)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("user"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "PUT" }))).rejects.toThrow();
  });

  it("rejects unauthenticated requests (401)", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "PUT" }))).rejects.toThrow();
  });
});

// ─── GET /api/admin/membership-settings ────────────────────────────────────

describe("GET /api/admin/membership-settings", () => {
  async function importHandler() {
    return (await import("../admin/membership-settings.get")).default;
  }

  it("requires admin session (403 for non-admin)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("user"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("rejects unauthenticated requests (401)", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("returns membership settings for admin (200)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("admin"));
    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain([]));
    const handler = await importHandler();
    const result = await handler(createMockEvent({ method: "GET" }));
    expect(result).toBeDefined();
    expect(result).toHaveProperty("applicationsRequired");
  });
});

// ─── PUT /api/admin/membership-settings ────────────────────────────────────

describe("PUT /api/admin/membership-settings", () => {
  async function importHandler() {
    return (await import("../admin/membership-settings.put")).default;
  }

  it("requires admin session (403 for non-admin)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("user"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "PUT" }))).rejects.toThrow();
  });

  it("rejects unauthenticated requests (401)", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "PUT" }))).rejects.toThrow();
  });
});

// ─── GET /api/admin/moderation-rights ──────────────────────────────────────

describe("GET /api/admin/moderation-rights", () => {
  async function importHandler() {
    return (await import("../admin/moderation-rights.get")).default;
  }

  it("requires admin session (403 for non-admin)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("user"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("rejects unauthenticated requests (401)", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("returns moderation rights for admin (200)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("admin"));
    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain([]));
    const handler = await importHandler();
    const result = await handler(createMockEvent({ method: "GET" }));
    expect(result).toBeDefined();
    expect(result).toHaveProperty("rights");
  });
});

// ─── PUT /api/admin/moderation-rights ──────────────────────────────────────

describe("PUT /api/admin/moderation-rights", () => {
  async function importHandler() {
    return (await import("../admin/moderation-rights.put")).default;
  }

  it("requires admin session (403 for non-admin)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("user"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "PUT" }))).rejects.toThrow();
  });

  it("rejects unauthenticated requests (401)", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "PUT" }))).rejects.toThrow();
  });
});

// ─── GET /api/admin/discord-roles ──────────────────────────────────────────

describe("GET /api/admin/discord-roles", () => {
  async function importHandler() {
    return (await import("../admin/discord-roles.get")).default;
  }

  it("requires admin session (403 for non-admin)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("user"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("rejects unauthenticated requests (401)", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("returns discord roles for admin (200)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("admin"));
    const handler = await importHandler();
    const result = await handler(createMockEvent({ method: "GET" }));
    expect(result).toBeDefined();
    expect(result).toHaveProperty("guildRoles");
    expect(result).toHaveProperty("selectableRoleIds");
  });
});
