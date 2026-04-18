/**
 * Tests for mod route handlers — auth-check pattern (401/403/200).
 *
 * All 12 /api/mod/* routes are covered with:
 *   - 401 rejection when unauthenticated (requireModeratorSession throws)
 *   - 403 rejection when insufficient role (requireModeratorSession throws)
 *   - At least one happy-path test for GET /api/mod/users and
 *     GET /api/mod/community-roles verifying a response is returned
 *
 * Note: community-roles POST/PUT/DELETE use requireAdminSession (not moderator).
 *       tags GET/POST use requireModeratorRight (not requireModeratorSession directly).
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildSession,
  createMockEvent,
  stubNuxtAutoImports,
  cleanupAutoImportStubs
} from "../../utils/__tests__/test-helpers";

let _mocks: ReturnType<typeof stubNuxtAutoImports>;

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../../utils/auth", () => ({
  requireModeratorSession: vi.fn(),
  requireAdminSession: vi.fn(),
  requireSession: vi.fn()
}));

vi.mock("../../utils/db", () => ({
  getDb: vi.fn()
}));

vi.mock("../../utils/moderation-rights", () => ({
  requireModeratorRight: vi.fn()
}));

vi.mock("../../utils/community", () => ({
  listCommunityRoles: vi.fn().mockResolvedValue([]),
  listPermissionRoles: vi.fn().mockResolvedValue([]),
  assignCommunityRole: vi.fn().mockResolvedValue(undefined),
  getUserById: vi.fn().mockResolvedValue(null),
  getUserRoles: vi.fn().mockResolvedValue([])
}));

vi.mock("../../utils/community-roles", () => ({
  modCommunityRoleSchema: { safeParseAsync: vi.fn() },
  parseCommunityRoleId: vi.fn().mockReturnValue(1),
  createCommunityRole: vi.fn().mockResolvedValue(undefined),
  updateCommunityRole: vi.fn().mockResolvedValue(undefined),
  deleteCommunityRole: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../utils/botSync", () => ({
  fetchDiscordGuildRolesFromBot: vi.fn().mockResolvedValue({ roles: [] }),
  syncDiscordUserFromWebsite: vi.fn().mockResolvedValue(undefined),
  addDiscordRolesToMember: vi.fn().mockResolvedValue(undefined),
  removeDiscordRolesFromBot: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../utils/bot-bridge-error", () => ({
  throwBotBridgeHttpError: vi.fn()
}));

vi.mock("../../utils/http", () => ({
  parsePaginationQuery: vi.fn().mockReturnValue({ page: 1, limit: 20 }),
  readBodyWithSchema: vi.fn().mockResolvedValue({}),
  requireRouterParam: vi.fn().mockReturnValue("test-user-id")
}));

vi.mock("../../utils/user-directory", () => ({
  loadUserCommunityRolesMap: vi.fn().mockResolvedValue(new Map()),
  loadUserPermissionRolesMap: vi.fn().mockResolvedValue(new Map())
}));

vi.mock("../../utils/admin-mirror", () => ({
  isSuperadminUser: vi.fn().mockResolvedValue(false)
}));

vi.mock("@guildora/shared", () => ({
  users: { id: "id", discordId: "discord_id", displayName: "display_name" },
  communityRoles: { id: "id", name: "name", discordRoleId: "discord_role_id" },
  communityTags: { id: "id", name: "name", createdBy: "created_by" },
  userCommunityRoles: { userId: "user_id", communityRoleId: "community_role_id" },
  parseProfileName: vi.fn((name: string) => ({ ingameName: name, rufname: null }))
}));

// ─── DB chain helper ──────────────────────────────────────────────────────────

function mockDbChain(returnValue: unknown = []) {
  const chain: Record<string, unknown> = {};
  chain["select"] = vi.fn().mockReturnValue(chain);
  chain["from"] = vi.fn().mockReturnValue(chain);
  chain["where"] = vi.fn().mockReturnValue(chain);
  chain["limit"] = vi.fn().mockReturnValue(chain);
  chain["offset"] = vi.fn().mockReturnValue(chain);
  chain["orderBy"] = vi.fn().mockReturnValue(chain);
  chain["innerJoin"] = vi.fn().mockReturnValue(chain);
  chain["leftJoin"] = vi.fn().mockReturnValue(chain);
  chain["insert"] = vi.fn().mockReturnValue(chain);
  chain["values"] = vi.fn().mockReturnValue(chain);
  chain["returning"] = vi.fn().mockReturnValue(chain);
  chain["update"] = vi.fn().mockReturnValue(chain);
  chain["set"] = vi.fn().mockReturnValue(chain);
  chain["delete"] = vi.fn().mockReturnValue(chain);
  chain["then"] = (resolve: (v: unknown) => unknown) => resolve(returnValue);
  return chain;
}

// ─── Auth rejection helpers ───────────────────────────────────────────────────

async function mockModeratorReject401() {
  const { requireModeratorSession } = await import("../../utils/auth");
  vi.mocked(requireModeratorSession).mockRejectedValue(
    Object.assign(new Error("Authentication required."), { statusCode: 401 })
  );
}

async function mockModeratorReject403() {
  const { requireModeratorSession } = await import("../../utils/auth");
  vi.mocked(requireModeratorSession).mockRejectedValue(
    Object.assign(new Error("Forbidden."), { statusCode: 403 })
  );
}

async function mockModeratorOk() {
  const { requireModeratorSession } = await import("../../utils/auth");
  vi.mocked(requireModeratorSession).mockResolvedValue(
    buildSession("moderator") as ReturnType<typeof buildSession>
  );
}

async function mockAdminReject401() {
  const { requireAdminSession } = await import("../../utils/auth");
  vi.mocked(requireAdminSession).mockRejectedValue(
    Object.assign(new Error("Authentication required."), { statusCode: 401 })
  );
}

async function mockAdminReject403() {
  const { requireAdminSession } = await import("../../utils/auth");
  vi.mocked(requireAdminSession).mockRejectedValue(
    Object.assign(new Error("Forbidden."), { statusCode: 403 })
  );
}

async function mockModRightReject401() {
  const { requireModeratorRight } = await import("../../utils/moderation-rights");
  vi.mocked(requireModeratorRight).mockRejectedValue(
    Object.assign(new Error("Authentication required."), { statusCode: 401 })
  );
}

async function mockModRightReject403() {
  const { requireModeratorRight } = await import("../../utils/moderation-rights");
  vi.mocked(requireModeratorRight).mockRejectedValue(
    Object.assign(new Error("Forbidden."), { statusCode: 403 })
  );
}

async function _mockModRightOk() {
  const { requireModeratorRight } = await import("../../utils/moderation-rights");
  vi.mocked(requireModeratorRight).mockResolvedValue(
    buildSession("moderator") as ReturnType<typeof buildSession>
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _mocks = stubNuxtAutoImports();
  vi.stubGlobal("getQuery", vi.fn().mockReturnValue({}));
  vi.stubGlobal("getRouterParam", vi.fn().mockReturnValue("test-id"));
  vi.stubGlobal("getRouterParams", vi.fn().mockReturnValue({ id: "1" }));
  vi.stubGlobal("readBody", vi.fn().mockResolvedValue({}));
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  vi.clearAllMocks();
});

// ─── GET /api/mod/users ───────────────────────────────────────────────────────

describe("GET /api/mod/users", () => {
  async function importHandler() {
    return (await import("../mod/users/index.get")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    await mockModeratorReject401();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("rejects non-moderator users (403)", async () => {
    await mockModeratorReject403();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("returns paginated user list for moderator (200)", async () => {
    await mockModeratorOk();
    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb)
      .mockReturnValueOnce(mockDbChain([]) as ReturnType<typeof getDb>)
      .mockReturnValueOnce(mockDbChain([{ total: 0 }]) as ReturnType<typeof getDb>);
    const handler = await importHandler();
    const result = await handler(createMockEvent({ method: "GET" }));
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("pagination");
  });
});

// ─── GET /api/mod/community-roles ─────────────────────────────────────────────

describe("GET /api/mod/community-roles", () => {
  async function importHandler() {
    return (await import("../mod/community-roles/index.get")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    await mockModeratorReject401();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("rejects non-moderator users (403)", async () => {
    await mockModeratorReject403();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("returns community and permission roles for moderator (200)", async () => {
    await mockModeratorOk();
    const handler = await importHandler();
    const result = await handler(createMockEvent({ method: "GET" }));
    expect(result).toHaveProperty("communityRoles");
    expect(result).toHaveProperty("permissionRoles");
  });
});

// ─── POST /api/mod/community-roles (admin required) ───────────────────────────

describe("POST /api/mod/community-roles", () => {
  async function importHandler() {
    return (await import("../mod/community-roles/index.post")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    await mockAdminReject401();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "POST" }))).rejects.toThrow();
  });

  it("rejects non-admin users (403)", async () => {
    await mockAdminReject403();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "POST" }))).rejects.toThrow();
  });
});

// ─── PUT /api/mod/community-roles/[id] (admin required) ───────────────────────

describe("PUT /api/mod/community-roles/[id]", () => {
  async function importHandler() {
    return (await import("../mod/community-roles/[id].put")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    await mockAdminReject401();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "PUT" }))).rejects.toThrow();
  });

  it("rejects non-admin users (403)", async () => {
    await mockAdminReject403();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "PUT" }))).rejects.toThrow();
  });
});

// ─── DELETE /api/mod/community-roles/[id] (admin required) ────────────────────

describe("DELETE /api/mod/community-roles/[id]", () => {
  async function importHandler() {
    return (await import("../mod/community-roles/[id].delete")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    await mockAdminReject401();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "DELETE" }))).rejects.toThrow();
  });

  it("rejects non-admin users (403)", async () => {
    await mockAdminReject403();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "DELETE" }))).rejects.toThrow();
  });
});

// ─── GET /api/mod/discord-roles ───────────────────────────────────────────────

describe("GET /api/mod/discord-roles", () => {
  async function importHandler() {
    return (await import("../mod/discord-roles.get")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    await mockModeratorReject401();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("rejects non-moderator users (403)", async () => {
    await mockModeratorReject403();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });
});

// ─── GET /api/mod/tags (requireModeratorRight) ───────────────────────────────

describe("GET /api/mod/tags", () => {
  async function importHandler() {
    return (await import("../mod/tags/index.get")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    await mockModRightReject401();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("rejects users without modAccessCustomFields right (403)", async () => {
    await mockModRightReject403();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });
});

// ─── POST /api/mod/tags (requireModeratorRight + requireModeratorSession) ─────

describe("POST /api/mod/tags", () => {
  async function importHandler() {
    return (await import("../mod/tags/index.post")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    await mockModRightReject401();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "POST" }))).rejects.toThrow();
  });

  it("rejects users without modAccessCustomFields right (403)", async () => {
    await mockModRightReject403();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "POST" }))).rejects.toThrow();
  });
});

// ─── PUT /api/mod/users/[id]/community-role ───────────────────────────────────

describe("PUT /api/mod/users/[id]/community-role", () => {
  async function importHandler() {
    return (await import("../mod/users/[id]/community-role.put")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    await mockModeratorReject401();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "PUT" }))).rejects.toThrow();
  });

  it("rejects non-moderator users (403)", async () => {
    await mockModeratorReject403();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "PUT" }))).rejects.toThrow();
  });
});

// ─── PUT /api/mod/users/[id]/profile ─────────────────────────────────────────

describe("PUT /api/mod/users/[id]/profile", () => {
  async function importHandler() {
    return (await import("../mod/users/[id]/profile.put")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    await mockModeratorReject401();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "PUT" }))).rejects.toThrow();
  });

  it("rejects non-moderator users (403)", async () => {
    await mockModeratorReject403();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "PUT" }))).rejects.toThrow();
  });
});

// ─── POST /api/mod/users/batch-community-role ─────────────────────────────────

describe("POST /api/mod/users/batch-community-role", () => {
  async function importHandler() {
    return (await import("../mod/users/batch-community-role.post")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    await mockModeratorReject401();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "POST" }))).rejects.toThrow();
  });

  it("rejects non-moderator users (403)", async () => {
    await mockModeratorReject403();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "POST" }))).rejects.toThrow();
  });
});

// ─── POST /api/mod/users/batch-discord-roles ──────────────────────────────────

describe("POST /api/mod/users/batch-discord-roles", () => {
  async function importHandler() {
    return (await import("../mod/users/batch-discord-roles.post")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    await mockModeratorReject401();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "POST" }))).rejects.toThrow();
  });

  it("rejects non-moderator users (403)", async () => {
    await mockModeratorReject403();
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "POST" }))).rejects.toThrow();
  });
});
