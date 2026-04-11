import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks ───────────────────────────────────────────────────────────

const mockEmit = vi.fn().mockResolvedValue(undefined);

vi.mock("../../utils/app-hooks", () => ({
  botAppHookRegistry: { emit: (...args: unknown[]) => mockEmit(...args) },
}));

vi.mock("../../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { registerGuildMemberAddEvent } from "../guildMemberAdd.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

type MemberHandler = (member: unknown) => Promise<void>;

function captureHandler(): MemberHandler {
  const client = { on: vi.fn() };
  registerGuildMemberAddEvent(client as any);
  return client.on.mock.calls.find((c: unknown[]) => c[0] === "guildMemberAdd")![1];
}

function makeMember(overrides: {
  guildId?: string;
  userId?: string;
  username?: string;
  joinedAt?: Date | null;
} = {}) {
  return {
    guild: { id: overrides.guildId ?? "guild-1" },
    user: {
      id: overrides.userId ?? "user-1",
      username: overrides.username ?? "testuser",
    },
    joinedAt: overrides.joinedAt === undefined ? new Date("2025-06-01T00:00:00Z") : overrides.joinedAt,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("guildMemberAdd event", () => {
  let handler: MemberHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = captureHandler();
  });

  it("registers a guildMemberAdd listener", () => {
    const client = { on: vi.fn() };
    registerGuildMemberAddEvent(client as any);
    expect(client.on).toHaveBeenCalledWith("guildMemberAdd", expect.any(Function));
  });

  it("emits onMemberJoin with correct payload", async () => {
    const member = makeMember();
    await handler(member);
    expect(mockEmit).toHaveBeenCalledWith("onMemberJoin", {
      guildId: "guild-1",
      memberId: "user-1",
      username: "testuser",
      joinedAt: "2025-06-01T00:00:00.000Z",
    });
  });

  it("passes null joinedAt when member.joinedAt is null", async () => {
    const member = makeMember({ joinedAt: null });
    await handler(member);
    expect(mockEmit).toHaveBeenCalledWith(
      "onMemberJoin",
      expect.objectContaining({ joinedAt: null })
    );
  });

  it("catches errors without throwing", async () => {
    mockEmit.mockRejectedValueOnce(new Error("hook error"));
    const member = makeMember();
    await expect(handler(member)).resolves.toBeUndefined();
  });
});
