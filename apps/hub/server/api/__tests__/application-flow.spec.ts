/**
 * Integration tests for application flow: submission, approval, rejection.
 * Tests auth enforcement and business logic for the application lifecycle.
 *
 * These tests mock the DB layer and external services (Discord bot)
 * while testing the actual handler logic with mock H3 events.
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

vi.mock("../../utils/botSync", () => ({
  addDiscordRolesToMember: vi.fn().mockResolvedValue({ addedRoleIds: [] }),
  removeDiscordRolesFromBot: vi.fn().mockResolvedValue(undefined),
  setDiscordNickname: vi.fn().mockResolvedValue(undefined),
  sendDiscordDm: vi.fn().mockResolvedValue(undefined),
  sendChannelMessage: vi.fn().mockResolvedValue(undefined),
  createDiscordChannel: vi.fn().mockResolvedValue({ channelId: "ch-1" }),
  createDiscordThread: vi.fn().mockResolvedValue({ threadId: "th-1" }),
}));

vi.mock("../../utils/http", () => ({
  requireRouterParam: vi.fn((_event: unknown, _param: string, msg: string) => {
    const ev = _event as { _routerParams?: Record<string, string> };
    return ev._routerParams?.[_param] ?? (() => { throw new Error(msg); })();
  }),
  readBodyWithSchema: vi.fn(async (event: unknown, _schema: unknown) => {
    const ev = event as { _body?: unknown };
    return ev._body ?? {};
  }),
}));

vi.mock("../../utils/application-tokens", () => ({
  verifyAndLoadToken: vi.fn().mockResolvedValue(null),
  markTokenUsed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@guildora/shared", () => ({
  applications: { id: "id", flowId: "flow_id", discordId: "discord_id", status: "status" },
  applicationFlows: { id: "id", status: "status" },
  applicationFileUploads: {},
  applicationModeratorNotifications: {},
  users: {},
  linearizeFlowGraph: vi.fn().mockReturnValue({ steps: [], collectedRoleIds: [] }),
}));

beforeEach(() => {
  mocks = stubNuxtAutoImports();
  vi.mocked(mocks.getMethod).mockReturnValue("POST");
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  vi.clearAllMocks();
});

// ─── Helper: Build mock DB chain ────────────────────────────────────────────

function mockDbChain(returnValue: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(Array.isArray(returnValue) ? returnValue : [returnValue]),
    innerJoin: vi.fn().mockReturnThis(),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "app-1" }]),
      })),
    })),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "new-app-1", flowId: "flow-1", discordId: "discord-1" }]),
        })),
      })),
    })),
    execute: vi.fn().mockResolvedValue([]),
  };
}

// ─── Application Approval ───────────────────────────────────────────────────

describe("application approval", () => {
  it("requires moderator session", async () => {
    // Unauthenticated request
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbChain({}) as ReturnType<typeof getDb>);

    const handler = (await import("../applications/[applicationId]/approve.post")).default;
    const event = createMockEvent({ method: "POST", path: "/api/applications/app-1/approve" });
    (event as unknown as { _routerParams: Record<string, string> })._routerParams = { applicationId: "app-1" };

    await expect(handler(event)).rejects.toThrow();
  });

  it("allows admin to approve", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);

    const mockApp = {
      id: "app-1",
      flowId: "flow-1",
      discordId: "discord-123",
      status: "pending",
      rolesAssigned: [],
      displayNameComposed: null,
    };

    const mockFlow = {
      id: "flow-1",
      settingsJson: {
        roles: { onApproval: [], removeOnApproval: [] },
        messages: {},
        welcome: {},
      },
    };

    const { getDb } = await import("../../utils/db");
    const db = mockDbChain(mockApp);
    // First query returns application, second returns flow
    let callCount = 0;
    db.limit.mockImplementation(async () => {
      callCount++;
      return callCount === 1 ? [mockApp] : [mockFlow];
    });
    vi.mocked(getDb).mockReturnValue(db as ReturnType<typeof getDb>);

    const handler = (await import("../applications/[applicationId]/approve.post")).default;
    const event = createMockEvent({ method: "POST", path: "/api/applications/app-1/approve" });
    (event as unknown as { _routerParams: Record<string, string> })._routerParams = { applicationId: "app-1" };

    const result = await handler(event);
    expect(result.success).toBe(true);
  });

  it("allows moderator to approve", async () => {
    const session = buildSession("moderator");
    mocks.requireUserSession.mockResolvedValue(session);

    const mockApp = { id: "app-1", flowId: "flow-1", discordId: "d1", status: "pending", displayNameComposed: null };
    const mockFlow = { id: "flow-1", settingsJson: { roles: { onApproval: [], removeOnApproval: [] }, messages: {}, welcome: {} } };

    const { getDb } = await import("../../utils/db");
    const db = mockDbChain(mockApp);
    let callCount = 0;
    db.limit.mockImplementation(async () => {
      callCount++;
      return callCount === 1 ? [mockApp] : [mockFlow];
    });
    vi.mocked(getDb).mockReturnValue(db as ReturnType<typeof getDb>);

    const handler = (await import("../applications/[applicationId]/approve.post")).default;
    const event = createMockEvent({ method: "POST" });
    (event as unknown as { _routerParams: Record<string, string> })._routerParams = { applicationId: "app-1" };

    const result = await handler(event);
    expect(result.success).toBe(true);
  });

  it("rejects regular user trying to approve (403)", async () => {
    const session = buildSession("user");
    mocks.requireUserSession.mockResolvedValue(session);

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbChain({}) as ReturnType<typeof getDb>);

    const handler = (await import("../applications/[applicationId]/approve.post")).default;
    const event = createMockEvent({ method: "POST" });
    (event as unknown as { _routerParams: Record<string, string> })._routerParams = { applicationId: "app-1" };

    await expect(handler(event)).rejects.toThrow();
  });

  it("returns 404 when application not found", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);

    const { getDb } = await import("../../utils/db");
    const db = mockDbChain(null);
    db.limit.mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as ReturnType<typeof getDb>);

    const handler = (await import("../applications/[applicationId]/approve.post")).default;
    const event = createMockEvent({ method: "POST" });
    (event as unknown as { _routerParams: Record<string, string> })._routerParams = { applicationId: "nonexistent" };

    await expect(handler(event)).rejects.toThrow();
  });

  it("rejects approval of already-approved application (400)", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);

    const mockApp = { id: "app-1", flowId: "flow-1", discordId: "d1", status: "approved" };
    const { getDb } = await import("../../utils/db");
    const db = mockDbChain(mockApp);
    vi.mocked(getDb).mockReturnValue(db as ReturnType<typeof getDb>);

    const handler = (await import("../applications/[applicationId]/approve.post")).default;
    const event = createMockEvent({ method: "POST" });
    (event as unknown as { _routerParams: Record<string, string> })._routerParams = { applicationId: "app-1" };

    await expect(handler(event)).rejects.toThrow();
  });

  it("rejects approval of already-rejected application (400)", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);

    const mockApp = { id: "app-1", flowId: "flow-1", discordId: "d1", status: "rejected" };
    const { getDb } = await import("../../utils/db");
    const db = mockDbChain(mockApp);
    vi.mocked(getDb).mockReturnValue(db as ReturnType<typeof getDb>);

    const handler = (await import("../applications/[applicationId]/approve.post")).default;
    const event = createMockEvent({ method: "POST" });
    (event as unknown as { _routerParams: Record<string, string> })._routerParams = { applicationId: "app-1" };

    await expect(handler(event)).rejects.toThrow();
  });

  it("assigns onApproval roles when configured", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);

    const mockApp = { id: "app-1", flowId: "flow-1", discordId: "discord-123", status: "pending", displayNameComposed: null };
    const mockFlow = {
      id: "flow-1",
      settingsJson: {
        roles: { onApproval: ["role-a", "role-b"], removeOnApproval: [] },
        messages: {},
        welcome: {},
      },
    };

    const { getDb } = await import("../../utils/db");
    const db = mockDbChain(mockApp);
    let callCount = 0;
    db.limit.mockImplementation(async () => {
      callCount++;
      return callCount === 1 ? [mockApp] : [mockFlow];
    });
    vi.mocked(getDb).mockReturnValue(db as ReturnType<typeof getDb>);

    const { addDiscordRolesToMember } = await import("../../utils/botSync");

    const handler = (await import("../applications/[applicationId]/approve.post")).default;
    const event = createMockEvent({ method: "POST" });
    (event as unknown as { _routerParams: Record<string, string> })._routerParams = { applicationId: "app-1" };

    await handler(event);
    expect(addDiscordRolesToMember).toHaveBeenCalledWith("discord-123", ["role-a", "role-b"]);
  });

  it("sends approval DM when configured", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);

    const mockApp = { id: "app-1", flowId: "flow-1", discordId: "discord-123", status: "pending", displayNameComposed: null };
    const mockFlow = {
      id: "flow-1",
      settingsJson: {
        roles: { onApproval: [], removeOnApproval: [] },
        messages: { dmOnApproval: "Welcome to the community!" },
        welcome: {},
      },
    };

    const { getDb } = await import("../../utils/db");
    const db = mockDbChain(mockApp);
    let callCount = 0;
    db.limit.mockImplementation(async () => {
      callCount++;
      return callCount === 1 ? [mockApp] : [mockFlow];
    });
    vi.mocked(getDb).mockReturnValue(db as ReturnType<typeof getDb>);

    const { sendDiscordDm } = await import("../../utils/botSync");

    const handler = (await import("../applications/[applicationId]/approve.post")).default;
    const event = createMockEvent({ method: "POST" });
    (event as unknown as { _routerParams: Record<string, string> })._routerParams = { applicationId: "app-1" };

    await handler(event);
    expect(sendDiscordDm).toHaveBeenCalledWith("discord-123", "Welcome to the community!");
  });
});

// ─── Application Rejection ──────────────────────────────────────────────────

describe("application rejection", () => {
  it("requires moderator session for rejection", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbChain({}) as ReturnType<typeof getDb>);

    const handler = (await import("../applications/[applicationId]/reject.post")).default;
    const event = createMockEvent({ method: "POST" });
    (event as unknown as { _routerParams: Record<string, string> })._routerParams = { applicationId: "app-1" };

    await expect(handler(event)).rejects.toThrow();
  });

  it("allows moderator to reject a pending application", async () => {
    const session = buildSession("moderator");
    mocks.requireUserSession.mockResolvedValue(session);

    const mockApp = { id: "app-1", flowId: "flow-1", discordId: "d1", status: "pending", rolesAssigned: [] };
    const mockFlow = { id: "flow-1", settingsJson: { messages: {}, roles: {} } };

    const { getDb } = await import("../../utils/db");
    const db = mockDbChain(mockApp);
    let callCount = 0;
    db.limit.mockImplementation(async () => {
      callCount++;
      return callCount === 1 ? [mockApp] : [mockFlow];
    });
    vi.mocked(getDb).mockReturnValue(db as ReturnType<typeof getDb>);

    const handler = (await import("../applications/[applicationId]/reject.post")).default;
    const event = createMockEvent({ method: "POST" });
    (event as unknown as { _routerParams: Record<string, string> })._routerParams = { applicationId: "app-1" };

    const result = await handler(event);
    expect(result.success).toBe(true);
  });

  it("removes assigned roles on rejection", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);

    const mockApp = { id: "app-1", flowId: "flow-1", discordId: "discord-456", status: "pending", rolesAssigned: ["role-x", "role-y"] };
    const mockFlow = { id: "flow-1", settingsJson: { messages: {}, roles: {} } };

    const { getDb } = await import("../../utils/db");
    const db = mockDbChain(mockApp);
    let callCount = 0;
    db.limit.mockImplementation(async () => {
      callCount++;
      return callCount === 1 ? [mockApp] : [mockFlow];
    });
    vi.mocked(getDb).mockReturnValue(db as ReturnType<typeof getDb>);

    const { removeDiscordRolesFromBot } = await import("../../utils/botSync");

    const handler = (await import("../applications/[applicationId]/reject.post")).default;
    const event = createMockEvent({ method: "POST" });
    (event as unknown as { _routerParams: Record<string, string> })._routerParams = { applicationId: "app-1" };

    await handler(event);
    expect(removeDiscordRolesFromBot).toHaveBeenCalledWith("discord-456", { roleIds: ["role-x", "role-y"] });
  });

  it("sends rejection DM when configured", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);

    const mockApp = { id: "app-1", flowId: "flow-1", discordId: "discord-789", status: "pending", rolesAssigned: [] };
    const mockFlow = { id: "flow-1", settingsJson: { messages: { dmOnRejection: "Sorry, try again later." }, roles: {} } };

    const { getDb } = await import("../../utils/db");
    const db = mockDbChain(mockApp);
    let callCount = 0;
    db.limit.mockImplementation(async () => {
      callCount++;
      return callCount === 1 ? [mockApp] : [mockFlow];
    });
    vi.mocked(getDb).mockReturnValue(db as ReturnType<typeof getDb>);

    const { sendDiscordDm } = await import("../../utils/botSync");

    const handler = (await import("../applications/[applicationId]/reject.post")).default;
    const event = createMockEvent({ method: "POST" });
    (event as unknown as { _routerParams: Record<string, string> })._routerParams = { applicationId: "app-1" };

    await handler(event);
    expect(sendDiscordDm).toHaveBeenCalledWith("discord-789", "Sorry, try again later.");
  });
});
