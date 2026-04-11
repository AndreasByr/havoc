import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock("@guildora/shared", () => ({
  selectableDiscordRoles: Symbol("selectableDiscordRoles"),
  userDiscordRoles: Symbol("userDiscordRoles"),
  users: Symbol("users"),
}));

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ _tag: "eq", a, b }),
  and: (...args: unknown[]) => ({ _tag: "and", args }),
}));

let selectCallIndex = 0;
let selectResults: unknown[][] = [];

const mockDbChain: Record<string, ReturnType<typeof vi.fn>> = {};
mockDbChain.limit = vi.fn().mockImplementation(() => {
  const result = selectResults[selectCallIndex] ?? [];
  selectCallIndex++;
  return Promise.resolve(result);
});
mockDbChain.where = vi.fn().mockReturnValue(mockDbChain);
mockDbChain.from = vi.fn().mockReturnValue(mockDbChain);
mockDbChain.values = vi.fn().mockReturnValue({
  onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
});

const mockDelete = vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue(undefined),
});

const mockDb = {
  select: vi.fn().mockReturnValue(mockDbChain),
  insert: vi.fn().mockReturnValue(mockDbChain),
  delete: mockDelete,
};

vi.mock("../../utils/db", () => ({
  getDb: () => mockDb,
}));

vi.mock("../../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { handleRolePickerButtonInteraction } from "../role-picker-button.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRolePickerInteraction(customId: string, overrides: {
  guildId?: string | null;
  userId?: string;
  hasRole?: boolean;
  hasMember?: boolean;
} = {}) {
  const roleCache = new Map();
  if (overrides.hasRole) {
    const roleId = customId.split("_")[3] ?? "role-1";
    roleCache.set(roleId, { id: roleId });
  }

  const mockRoleManager = {
    add: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };

  return {
    customId,
    user: { id: overrides.userId ?? "discord-user-1" },
    guildId: overrides.guildId === undefined ? "guild-1" : overrides.guildId,
    member: overrides.hasMember === false
      ? null
      : { roles: { cache: roleCache } },
    guild: {
      members: {
        fetch: vi.fn().mockResolvedValue({ roles: mockRoleManager }),
      },
    },
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    _mockRoleManager: mockRoleManager,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("handleRolePickerButtonInteraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallIndex = 0;
    selectResults = [];
  });

  it("returns early when customId does not start with role_pick_", async () => {
    const interaction = makeRolePickerInteraction("other_button");
    await handleRolePickerButtonInteraction(interaction as any);
    expect(interaction.deferUpdate).not.toHaveBeenCalled();
  });

  it("defers update immediately", async () => {
    selectResults = [
      [], // selectable role not found
    ];
    const interaction = makeRolePickerInteraction("role_pick_group1_role1");
    await handleRolePickerButtonInteraction(interaction as any);
    expect(interaction.deferUpdate).toHaveBeenCalled();
  });

  it("returns early when customId has fewer than 4 parts", async () => {
    const interaction = makeRolePickerInteraction("role_pick_only");
    await handleRolePickerButtonInteraction(interaction as any);
    expect(interaction.deferUpdate).toHaveBeenCalled();
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("returns early when guildId is missing", async () => {
    const interaction = makeRolePickerInteraction("role_pick_group1_role1", { guildId: null });
    await handleRolePickerButtonInteraction(interaction as any);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("returns early when member is missing", async () => {
    const interaction = makeRolePickerInteraction("role_pick_group1_role1", { hasMember: false });
    await handleRolePickerButtonInteraction(interaction as any);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("follows up with error when selectable role not found", async () => {
    selectResults = [[]]; // no selectable role
    const interaction = makeRolePickerInteraction("role_pick_group1_role1");
    await handleRolePickerButtonInteraction(interaction as any);
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("no longer available") })
    );
  });

  it("removes role when user already has it", async () => {
    selectResults = [
      [{ discordRoleId: "role1", roleNameSnapshot: "TestRole" }], // selectable role found
      [{ id: "db-user-1" }], // DB user found
    ];
    const interaction = makeRolePickerInteraction("role_pick_group1_role1", { hasRole: true });
    await handleRolePickerButtonInteraction(interaction as any);
    expect(interaction._mockRoleManager.remove).toHaveBeenCalledWith("role1");
  });

  it("adds role when user does not have it", async () => {
    selectResults = [
      [{ discordRoleId: "role1", roleNameSnapshot: "TestRole" }], // selectable role
      [{ id: "db-user-1" }], // DB user
    ];
    const interaction = makeRolePickerInteraction("role_pick_group1_role1", { hasRole: false });
    await handleRolePickerButtonInteraction(interaction as any);
    expect(interaction._mockRoleManager.add).toHaveBeenCalledWith("role1");
  });

  it("follows up with error when role toggle fails", async () => {
    selectResults = [
      [{ discordRoleId: "role1", roleNameSnapshot: "TestRole" }],
    ];
    const interaction = makeRolePickerInteraction("role_pick_group1_role1");
    interaction._mockRoleManager.add.mockRejectedValue(new Error("no perms"));
    await handleRolePickerButtonInteraction(interaction as any);
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("Failed to update your role") })
    );
  });

  it("syncs role removal to DB when user exists in DB", async () => {
    selectResults = [
      [{ discordRoleId: "role1", roleNameSnapshot: "TestRole" }],
      [{ id: "db-user-1" }],
    ];
    const interaction = makeRolePickerInteraction("role_pick_group1_role1", { hasRole: true });
    await handleRolePickerButtonInteraction(interaction as any);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("syncs role addition to DB when user exists in DB", async () => {
    selectResults = [
      [{ discordRoleId: "role1", roleNameSnapshot: "TestRole" }],
      [{ id: "db-user-1" }],
    ];
    const interaction = makeRolePickerInteraction("role_pick_group1_role1", { hasRole: false });
    await handleRolePickerButtonInteraction(interaction as any);
    expect(mockDb.insert).toHaveBeenCalled();
  });
});
