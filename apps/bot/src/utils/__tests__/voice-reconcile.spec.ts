import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@guildora/shared", () => ({
  users: Symbol("users"),
  voiceSessions: Symbol("voiceSessions"),
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ _tag: "and", args }),
  desc: (col: unknown) => ({ _tag: "desc", col }),
  eq: (a: unknown, b: unknown) => ({ _tag: "eq", a, b }),
  inArray: (col: unknown, values: unknown[]) => ({ _tag: "inArray", col, values }),
  isNull: (col: unknown) => ({ _tag: "isNull", col }),
}));

const mockDbChain: Record<string, ReturnType<typeof vi.fn>> = {};
mockDbChain.limit = vi.fn().mockResolvedValue([]);
mockDbChain.where = vi.fn().mockReturnValue(mockDbChain);
mockDbChain.orderBy = vi.fn().mockReturnValue(mockDbChain);
mockDbChain.from = vi.fn().mockReturnValue(mockDbChain);
mockDbChain.innerJoin = vi.fn().mockReturnValue(mockDbChain);
mockDbChain.set = vi.fn().mockReturnValue(mockDbChain);
mockDbChain.values = vi.fn().mockResolvedValue(undefined);

const mockDb = {
  select: vi.fn().mockReturnValue(mockDbChain),
  update: vi.fn().mockReturnValue(mockDbChain),
  insert: vi.fn().mockReturnValue(mockDbChain),
  _chain: mockDbChain,
};

vi.mock("../db", () => ({
  getDb: () => mockDb,
}));

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockCloseIfOpen = vi.fn().mockResolvedValue(false);
const mockSplitOnChannelMismatch = vi.fn().mockResolvedValue("noop");
const mockOpenIfMissing = vi.fn().mockResolvedValue(false);
const mockCloseSessionById = vi.fn().mockResolvedValue(undefined);
const mockIsRegularVoiceChannel = vi.fn().mockReturnValue(true);

vi.mock("../voice-session-lifecycle", () => ({
  closeIfOpen: (...args: any[]) => mockCloseIfOpen(...args),
  closeSessionById: (...args: any[]) => mockCloseSessionById(...args),
  isRegularVoiceChannel: (...args: any[]) => mockIsRegularVoiceChannel(...args),
  openIfMissing: (...args: any[]) => mockOpenIfMissing(...args),
  splitOnChannelMismatch: (...args: any[]) => mockSplitOnChannelMismatch(...args),
}));

import {
  startVoiceSessionReconcileLoop,
  stopVoiceSessionReconcileLoop,
} from "../voice-reconcile.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockClient(voiceStates: Array<{
  id: string;
  channelId: string | null;
  isBot?: boolean;
}> = []) {
  const cache = new Map(
    voiceStates.map((s) => [
      s.id,
      {
        id: s.id,
        channelId: s.channelId,
        member: { user: { bot: s.isBot ?? false } },
      },
    ])
  );

  const guild = {
    available: true,
    afkChannelId: null,
    voiceStates: {
      cache,
      fetch: vi.fn().mockRejectedValue(new Error("not found")),
    },
  };

  return {
    guilds: {
      fetch: vi.fn().mockResolvedValue(guild),
    },
    _guild: guild,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("startVoiceSessionReconcileLoop", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    process.env.DISCORD_GUILD_ID = "guild-1";
    delete process.env.AFK_VOICE_CHANNEL_ID;

    mockDbChain.limit.mockReset().mockResolvedValue([]);
    mockDbChain.where.mockReset().mockReturnValue(mockDbChain);
    mockDbChain.orderBy.mockReset().mockReturnValue(mockDbChain);
    mockDbChain.from.mockReset().mockReturnValue(mockDbChain);
    mockDbChain.innerJoin.mockReset().mockReturnValue(mockDbChain);
    mockDbChain.set.mockReset().mockReturnValue(mockDbChain);
    mockDbChain.values.mockReset().mockResolvedValue(undefined);
    mockDb.select.mockReturnValue(mockDbChain);
    mockDb.update.mockReturnValue(mockDbChain);
    mockDb.insert.mockReturnValue(mockDbChain);

    mockCloseIfOpen.mockReset().mockResolvedValue(false);
    mockSplitOnChannelMismatch.mockReset().mockResolvedValue("noop");
    mockOpenIfMissing.mockReset().mockResolvedValue(false);
    mockCloseSessionById.mockReset().mockResolvedValue(undefined);
    mockIsRegularVoiceChannel.mockReset().mockReturnValue(true);
  });

  afterEach(async () => {
    await stopVoiceSessionReconcileLoop();
    vi.useRealTimers();
    process.env = { ...originalEnv };
  });

  it("does nothing when DISCORD_GUILD_ID is missing", () => {
    delete process.env.DISCORD_GUILD_ID;
    const client = createMockClient();
    startVoiceSessionReconcileLoop(client as any);
    expect(client.guilds.fetch).not.toHaveBeenCalled();
  });

  it("runs reconcile immediately on start", async () => {
    const client = createMockClient();
    startVoiceSessionReconcileLoop(client as any);
    await vi.advanceTimersByTimeAsync(0);
    expect(client.guilds.fetch).toHaveBeenCalledWith("guild-1");
  });

  it("runs reconcile on each interval tick", async () => {
    const client = createMockClient();
    startVoiceSessionReconcileLoop(client as any);
    await vi.advanceTimersByTimeAsync(0);
    expect(client.guilds.fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(client.guilds.fetch).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(client.guilds.fetch).toHaveBeenCalledTimes(3);
  });

  it("does not start a second timer if already running", async () => {
    const client = createMockClient();
    startVoiceSessionReconcileLoop(client as any);
    startVoiceSessionReconcileLoop(client as any);
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(client.guilds.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("stopVoiceSessionReconcileLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    process.env.DISCORD_GUILD_ID = "guild-1";

    mockDbChain.limit.mockReset().mockResolvedValue([]);
    mockDbChain.where.mockReset().mockReturnValue(mockDbChain);
    mockDbChain.orderBy.mockReset().mockReturnValue(mockDbChain);
    mockDbChain.from.mockReset().mockReturnValue(mockDbChain);
    mockDbChain.innerJoin.mockReset().mockReturnValue(mockDbChain);
    mockDbChain.set.mockReset().mockReturnValue(mockDbChain);
    mockDbChain.values.mockReset().mockResolvedValue(undefined);
    mockDb.select.mockReturnValue(mockDbChain);
    mockDb.update.mockReturnValue(mockDbChain);
    mockDb.insert.mockReturnValue(mockDbChain);

    mockCloseIfOpen.mockReset().mockResolvedValue(false);
    mockCloseSessionById.mockReset().mockResolvedValue(undefined);
    mockIsRegularVoiceChannel.mockReset().mockReturnValue(true);
  });

  afterEach(async () => {
    await stopVoiceSessionReconcileLoop();
    vi.useRealTimers();
  });

  it("stops the interval timer", async () => {
    const client = createMockClient();
    startVoiceSessionReconcileLoop(client as any);
    await vi.advanceTimersByTimeAsync(0);
    expect(client.guilds.fetch).toHaveBeenCalledTimes(1);

    await stopVoiceSessionReconcileLoop();

    await vi.advanceTimersByTimeAsync(120_000);
    expect(client.guilds.fetch).toHaveBeenCalledTimes(1);
  });

  it("resolves immediately when no reconcile is in progress", async () => {
    const result = await stopVoiceSessionReconcileLoop();
    expect(result).toBeUndefined();
  });
});

describe("runReconcile — duplicate session cleanup", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    process.env.DISCORD_GUILD_ID = "guild-1";

    mockDbChain.limit.mockReset().mockResolvedValue([]);
    mockDbChain.where.mockReset().mockReturnValue(mockDbChain);
    mockDbChain.orderBy.mockReset().mockReturnValue(mockDbChain);
    mockDbChain.from.mockReset().mockReturnValue(mockDbChain);
    mockDbChain.innerJoin.mockReset().mockReturnValue(mockDbChain);
    mockDbChain.set.mockReset().mockReturnValue(mockDbChain);
    mockDbChain.values.mockReset().mockResolvedValue(undefined);
    mockDb.select.mockReturnValue(mockDbChain);
    mockDb.update.mockReturnValue(mockDbChain);
    mockDb.insert.mockReturnValue(mockDbChain);

    mockCloseIfOpen.mockReset().mockResolvedValue(false);
    mockSplitOnChannelMismatch.mockReset().mockResolvedValue("noop");
    mockOpenIfMissing.mockReset().mockResolvedValue(false);
    mockCloseSessionById.mockReset().mockResolvedValue(undefined);
    mockIsRegularVoiceChannel.mockReset().mockReturnValue(true);
  });

  afterEach(async () => {
    await stopVoiceSessionReconcileLoop();
    vi.useRealTimers();
    process.env = { ...originalEnv };
  });

  it("closes duplicate open sessions for the same user", async () => {
    const now = new Date("2025-01-01T12:00:00Z");
    const client = createMockClient();

    // closeDuplicateOpenSessions: two sessions for same user
    mockDb.select.mockReturnValueOnce({
      ...mockDbChain,
      from: vi.fn().mockReturnValue({
        ...mockDbChain,
        where: vi.fn().mockReturnValue({
          ...mockDbChain,
          orderBy: vi.fn().mockResolvedValue([
            { id: "s2", userId: "user-1", channelId: "c1", startedAt: now },
            { id: "s1", userId: "user-1", channelId: "c1", startedAt: new Date(now.getTime() - 60_000) },
          ]),
        }),
      }),
    });

    startVoiceSessionReconcileLoop(client as any);
    await vi.advanceTimersByTimeAsync(0);

    expect(mockCloseSessionById).toHaveBeenCalledTimes(1);
    expect(mockCloseSessionById).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ id: "s1", userId: "user-1" }),
      expect.any(Date),
      expect.objectContaining({ maxDurationMinutes: 0 })
    );
  });

  it("skips reconcile when guild is unavailable", async () => {
    const client = createMockClient();
    client._guild.available = false;

    startVoiceSessionReconcileLoop(client as any);
    await vi.advanceTimersByTimeAsync(0);

    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("closes stale sessions for users no longer in voice", async () => {
    const client = createMockClient(); // no users in voice
    const staleSession = {
      userId: "user-1",
      discordId: "discord-1",
      channelId: "c1",
    };

    // First select: closeDuplicateOpenSessions (no duplicates)
    mockDb.select.mockReturnValueOnce({
      ...mockDbChain,
      from: vi.fn().mockReturnValue({
        ...mockDbChain,
        where: vi.fn().mockReturnValue({
          ...mockDbChain,
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    // Second select: reconcileOpenSessionsForGuild (open sessions with user join)
    mockDb.select.mockReturnValueOnce({
      ...mockDbChain,
      from: vi.fn().mockReturnValue({
        ...mockDbChain,
        innerJoin: vi.fn().mockReturnValue({
          ...mockDbChain,
          where: vi.fn().mockResolvedValue([staleSession]),
        }),
      }),
    });

    // voiceStates.fetch will reject (user not in voice)
    client._guild.voiceStates.fetch.mockRejectedValue(new Error("not found"));

    startVoiceSessionReconcileLoop(client as any);
    await vi.advanceTimersByTimeAsync(0);

    expect(mockCloseIfOpen).toHaveBeenCalledWith(
      mockDb,
      "user-1",
      expect.any(Date),
      expect.objectContaining({ maxDurationMinutes: 480 })
    );
  });

  it("splits session when user moved to different channel", async () => {
    const client = createMockClient([
      { id: "discord-1", channelId: "c2" },
    ]);
    const openSession = {
      userId: "user-1",
      discordId: "discord-1",
      channelId: "c1",
    };

    // closeDuplicateOpenSessions
    mockDb.select.mockReturnValueOnce({
      ...mockDbChain,
      from: vi.fn().mockReturnValue({
        ...mockDbChain,
        where: vi.fn().mockReturnValue({
          ...mockDbChain,
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    // reconcileOpenSessionsForGuild
    mockDb.select.mockReturnValueOnce({
      ...mockDbChain,
      from: vi.fn().mockReturnValue({
        ...mockDbChain,
        innerJoin: vi.fn().mockReturnValue({
          ...mockDbChain,
          where: vi.fn().mockResolvedValue([openSession]),
        }),
      }),
    });

    // user lookup for missing sessions
    mockDb.select.mockReturnValueOnce({
      ...mockDbChain,
      from: vi.fn().mockReturnValue({
        ...mockDbChain,
        where: vi.fn().mockResolvedValue([{ id: "user-1", discordId: "discord-1" }]),
      }),
    });

    mockSplitOnChannelMismatch.mockResolvedValue("split");

    startVoiceSessionReconcileLoop(client as any);
    await vi.advanceTimersByTimeAsync(0);

    expect(mockSplitOnChannelMismatch).toHaveBeenCalledWith(
      mockDb,
      "user-1",
      "c2",
      expect.any(Date),
      expect.objectContaining({ maxDurationMinutes: 480 })
    );
  });

  it("opens sessions for connected users without open sessions", async () => {
    const client = createMockClient([
      { id: "discord-2", channelId: "c1" },
    ]);

    // closeDuplicateOpenSessions
    mockDb.select.mockReturnValueOnce({
      ...mockDbChain,
      from: vi.fn().mockReturnValue({
        ...mockDbChain,
        where: vi.fn().mockReturnValue({
          ...mockDbChain,
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    // reconcileOpenSessionsForGuild (no open sessions)
    mockDb.select.mockReturnValueOnce({
      ...mockDbChain,
      from: vi.fn().mockReturnValue({
        ...mockDbChain,
        innerJoin: vi.fn().mockReturnValue({
          ...mockDbChain,
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    // user lookup for connected discord users
    mockDb.select.mockReturnValueOnce({
      ...mockDbChain,
      from: vi.fn().mockReturnValue({
        ...mockDbChain,
        where: vi.fn().mockResolvedValue([{ id: "user-2", discordId: "discord-2" }]),
      }),
    });

    mockOpenIfMissing.mockResolvedValue(true);

    startVoiceSessionReconcileLoop(client as any);
    await vi.advanceTimersByTimeAsync(0);

    expect(mockOpenIfMissing).toHaveBeenCalledWith(
      mockDb,
      "user-2",
      "c1",
      expect.any(Date)
    );
  });

  it("skips bot users when checking connected voice states", async () => {
    const client = createMockClient([
      { id: "bot-1", channelId: "c1", isBot: true },
    ]);

    // closeDuplicateOpenSessions
    mockDb.select.mockReturnValueOnce({
      ...mockDbChain,
      from: vi.fn().mockReturnValue({
        ...mockDbChain,
        where: vi.fn().mockReturnValue({
          ...mockDbChain,
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    // reconcileOpenSessionsForGuild (no open sessions)
    mockDb.select.mockReturnValueOnce({
      ...mockDbChain,
      from: vi.fn().mockReturnValue({
        ...mockDbChain,
        innerJoin: vi.fn().mockReturnValue({
          ...mockDbChain,
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    startVoiceSessionReconcileLoop(client as any);
    await vi.advanceTimersByTimeAsync(0);

    expect(mockOpenIfMissing).not.toHaveBeenCalled();
  });

  it("catches and logs errors without crashing the loop", async () => {
    const { logger } = await import("../logger");
    const client = createMockClient();
    client.guilds.fetch.mockRejectedValue(new Error("Discord API down"));

    startVoiceSessionReconcileLoop(client as any);
    await vi.advanceTimersByTimeAsync(0);

    expect(logger.error).toHaveBeenCalledWith(
      "Voice session reconcile failed.",
      expect.any(Error)
    );

    // Loop should continue on next tick without crashing
    client.guilds.fetch.mockResolvedValue(client._guild);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(client.guilds.fetch).toHaveBeenCalledTimes(2);
  });

  it("skips users in AFK channel during reconcile", async () => {
    process.env.AFK_VOICE_CHANNEL_ID = "afk-channel";
    const client = createMockClient([
      { id: "discord-1", channelId: "afk-channel" },
    ]);

    mockIsRegularVoiceChannel.mockReturnValue(false);

    // closeDuplicateOpenSessions
    mockDb.select.mockReturnValueOnce({
      ...mockDbChain,
      from: vi.fn().mockReturnValue({
        ...mockDbChain,
        where: vi.fn().mockReturnValue({
          ...mockDbChain,
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    // reconcileOpenSessionsForGuild (no open sessions)
    mockDb.select.mockReturnValueOnce({
      ...mockDbChain,
      from: vi.fn().mockReturnValue({
        ...mockDbChain,
        innerJoin: vi.fn().mockReturnValue({
          ...mockDbChain,
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    startVoiceSessionReconcileLoop(client as any);
    await vi.advanceTimersByTimeAsync(0);

    expect(mockOpenIfMissing).not.toHaveBeenCalled();
  });
});
