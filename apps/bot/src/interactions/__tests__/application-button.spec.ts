import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock("@guildora/shared", () => ({
  applicationFlows: Symbol("applicationFlows"),
  applications: Symbol("applications"),
  applicationTokens: Symbol("applicationTokens"),
}));

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ _tag: "eq", a, b }),
  and: (...args: unknown[]) => ({ _tag: "and", args }),
}));

const mockDbChain: Record<string, ReturnType<typeof vi.fn>> = {};
mockDbChain.limit = vi.fn().mockResolvedValue([]);
mockDbChain.where = vi.fn().mockReturnValue(mockDbChain);
mockDbChain.from = vi.fn().mockReturnValue(mockDbChain);
mockDbChain.values = vi.fn().mockResolvedValue(undefined);

const mockDb = {
  select: vi.fn().mockReturnValue(mockDbChain),
  insert: vi.fn().mockReturnValue(mockDbChain),
};

vi.mock("../../utils/db", () => ({
  getDb: () => mockDb,
}));

vi.mock("../../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../utils/application-tokens", () => ({
  signTokenId: vi.fn(() => "signed-token-abc"),
}));

import { handleApplicationButtonInteraction } from "../application-button.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeButtonInteraction(customId: string, overrides: {
  guildId?: string | null;
  userId?: string;
  username?: string;
  hasMember?: boolean;
  roleIds?: string[];
  replied?: boolean;
} = {}) {
  const roleCache = new Map((overrides.roleIds ?? []).map((id) => [id, { id }]));
  return {
    customId,
    user: {
      id: overrides.userId ?? "discord-user-1",
      username: overrides.username ?? "testuser",
      displayAvatarURL: vi.fn(() => "https://cdn.example.com/avatar.png"),
    },
    guildId: overrides.guildId === undefined ? "guild-1" : overrides.guildId,
    member: overrides.hasMember === false
      ? null
      : {
          roles: {
            cache: roleCache,
          },
        },
    replied: overrides.replied ?? false,
    deferred: false,
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
  };
}

function makeActiveFlow(overrides: Partial<{
  status: string;
  testMode: boolean;
  allowReapplyToSameFlow: boolean;
  allowCrossFlowApplications: boolean;
  onApprovalRoles: string[];
  tokenExpiryMinutes: number;
  ephemeralConfirmation: string;
  ephemeralButtonLabel: string;
}> = {}) {
  return {
    id: "flow-1",
    status: overrides.status ?? "active",
    settingsJson: {
      testMode: overrides.testMode ?? false,
      roles: {
        onApproval: overrides.onApprovalRoles ?? [],
      },
      concurrency: {
        allowReapplyToSameFlow: overrides.allowReapplyToSameFlow ?? true,
        allowCrossFlowApplications: overrides.allowCrossFlowApplications ?? true,
      },
      tokenExpiryMinutes: overrides.tokenExpiryMinutes ?? 60,
      messages: {
        ephemeralConfirmation: overrides.ephemeralConfirmation ?? "Click to apply.",
        ephemeralButtonLabel: overrides.ephemeralButtonLabel ?? "Apply Now",
      },
    },
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("handleApplicationButtonInteraction", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APPLICATION_TOKEN_SECRET = "test-secret";
    process.env.NUXT_PUBLIC_HUB_URL = "https://hub.example.com";
    mockDbChain.limit.mockReset().mockResolvedValue([]);
    mockDbChain.values.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns early when customId does not start with application_apply_", async () => {
    const interaction = makeButtonInteraction("other_button");
    await handleApplicationButtonInteraction(interaction as any, {} as any);
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it("defers reply immediately", async () => {
    mockDbChain.limit.mockResolvedValueOnce([]);
    const interaction = makeButtonInteraction("application_apply_flow-1");
    await handleApplicationButtonInteraction(interaction as any, {} as any);
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it("replies with not available when flow not found", async () => {
    mockDbChain.limit.mockResolvedValueOnce([]);
    const interaction = makeButtonInteraction("application_apply_flow-1");
    await handleApplicationButtonInteraction(interaction as any, {} as any);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("not available") })
    );
  });

  it("replies with not available when flow status is not active", async () => {
    mockDbChain.limit.mockResolvedValueOnce([makeActiveFlow({ status: "archived" })]);
    const interaction = makeButtonInteraction("application_apply_flow-1");
    await handleApplicationButtonInteraction(interaction as any, {} as any);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("not available") })
    );
  });

  it("replies with 'already a member' when user has approval role", async () => {
    const flow = makeActiveFlow({ onApprovalRoles: ["role-approved"] });
    mockDbChain.limit.mockResolvedValueOnce([flow]);
    const interaction = makeButtonInteraction("application_apply_flow-1", {
      roleIds: ["role-approved"],
    });
    await handleApplicationButtonInteraction(interaction as any, {} as any);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("already a member") })
    );
  });

  it("skips role check in test mode", async () => {
    const flow = makeActiveFlow({ testMode: true, onApprovalRoles: ["role-approved"] });
    mockDbChain.limit.mockResolvedValueOnce([flow]); // flow lookup
    const interaction = makeButtonInteraction("application_apply_flow-1", {
      roleIds: ["role-approved"],
    });
    await handleApplicationButtonInteraction(interaction as any, {} as any);
    // Should proceed past role check and generate token
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: "Click to apply." })
    );
  });

  it("blocks reapply when concurrency.allowReapplyToSameFlow is false", async () => {
    const flow = makeActiveFlow({ allowReapplyToSameFlow: false });
    mockDbChain.limit
      .mockResolvedValueOnce([flow])           // flow lookup
      .mockResolvedValueOnce([{ id: "app-1" }]); // existing same-flow application
    const interaction = makeButtonInteraction("application_apply_flow-1");
    await handleApplicationButtonInteraction(interaction as any, {} as any);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("already have an open application for this flow") })
    );
  });

  it("blocks cross-flow application when not allowed", async () => {
    const flow = makeActiveFlow({ allowCrossFlowApplications: false });
    mockDbChain.limit
      .mockResolvedValueOnce([flow])           // flow lookup
      .mockResolvedValueOnce([{ id: "app-2" }]); // existing any-flow application
    const interaction = makeButtonInteraction("application_apply_flow-1");
    await handleApplicationButtonInteraction(interaction as any, {} as any);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("already have an open application") })
    );
  });

  it("replies with config error when token secret is missing", async () => {
    delete process.env.APPLICATION_TOKEN_SECRET;
    const flow = makeActiveFlow();
    mockDbChain.limit.mockResolvedValueOnce([flow]);
    const interaction = makeButtonInteraction("application_apply_flow-1");
    await handleApplicationButtonInteraction(interaction as any, {} as any);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("being set up") })
    );
  });

  it("replies with config error when hub URL is missing", async () => {
    delete process.env.NUXT_PUBLIC_HUB_URL;
    const flow = makeActiveFlow();
    mockDbChain.limit.mockResolvedValueOnce([flow]);
    const interaction = makeButtonInteraction("application_apply_flow-1");
    await handleApplicationButtonInteraction(interaction as any, {} as any);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("being set up") })
    );
  });

  it("generates token and replies with apply URL on success", async () => {
    const flow = makeActiveFlow();
    mockDbChain.limit.mockResolvedValueOnce([flow]);
    const interaction = makeButtonInteraction("application_apply_flow-1");
    await handleApplicationButtonInteraction(interaction as any, {} as any);
    expect(mockDb.insert).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Click to apply.",
        components: expect.any(Array),
      })
    );
  });

  it("replies with 'must be in server' when guildId is missing and not testMode", async () => {
    const flow = makeActiveFlow();
    mockDbChain.limit.mockResolvedValueOnce([flow]);
    const interaction = makeButtonInteraction("application_apply_flow-1", {
      guildId: null,
    });
    await handleApplicationButtonInteraction(interaction as any, {} as any);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("must be in the server") })
    );
  });
});
