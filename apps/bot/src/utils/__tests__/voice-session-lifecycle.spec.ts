import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @guildora/shared to provide the voiceSessions table reference
vi.mock("@guildora/shared", () => ({
  voiceSessions: Symbol("voiceSessions"),
}));

// Mock drizzle-orm operators — they just return their arguments for identity checks
vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ _tag: "and", args }),
  desc: (col: unknown) => ({ _tag: "desc", col }),
  eq: (a: unknown, b: unknown) => ({ _tag: "eq", a, b }),
  isNull: (col: unknown) => ({ _tag: "isNull", col }),
}));

import {
  isRegularVoiceChannel,
  closeSessionById,
  closeIfOpen,
  openIfMissing,
  splitOnChannelMismatch,
} from "../voice-session-lifecycle.js";

// ─── DB mock helper ─────────────────────────────────────────────────────────

function createMockDb(rows: unknown[] = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  // Terminal methods
  chain.limit = vi.fn().mockResolvedValue(rows);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockResolvedValue(undefined);

  const db = {
    select: vi.fn().mockReturnValue(chain),
    update: vi.fn().mockReturnValue(chain),
    insert: vi.fn().mockReturnValue(chain),
    _chain: chain,
  };
  return db;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("isRegularVoiceChannel", () => {
  it("returns false when channelId is null", () => {
    expect(isRegularVoiceChannel(null, null)).toBe(false);
  });

  it("returns false when channelId is undefined", () => {
    expect(isRegularVoiceChannel(undefined, null)).toBe(false);
  });

  it("returns false when channelId matches afkChannelId", () => {
    expect(isRegularVoiceChannel("afk-123", "afk-123")).toBe(false);
  });

  it("returns true for a regular voice channel", () => {
    expect(isRegularVoiceChannel("voice-1", "afk-123")).toBe(true);
  });

  it("returns true when afkChannelId is null and channelId is set", () => {
    expect(isRegularVoiceChannel("voice-1", null)).toBe(true);
  });
});

describe("calculateDurationMinutes (via closeSessionById)", () => {
  it("calculates zero duration when start equals end", async () => {
    const now = new Date("2025-01-01T12:00:00Z");
    const db = createMockDb();
    await closeSessionById(db as any, { id: "s1", channelId: "c1", startedAt: now }, now);
    expect(db._chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ durationMinutes: 0 })
    );
  });

  it("calculates normal duration in minutes", async () => {
    const start = new Date("2025-01-01T12:00:00Z");
    const end = new Date("2025-01-01T12:30:00Z");
    const db = createMockDb();
    await closeSessionById(db as any, { id: "s1", channelId: "c1", startedAt: start }, end);
    expect(db._chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ durationMinutes: 30 })
    );
  });

  it("caps duration at maxDurationMinutes", async () => {
    const start = new Date("2025-01-01T12:00:00Z");
    const end = new Date("2025-01-01T14:00:00Z"); // 120 min
    const db = createMockDb();
    await closeSessionById(db as any, { id: "s1", channelId: "c1", startedAt: start }, end, {
      maxDurationMinutes: 60,
    });
    expect(db._chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ durationMinutes: 60 })
    );
  });

  it("clamps negative duration to 0", async () => {
    const start = new Date("2025-01-01T13:00:00Z");
    const end = new Date("2025-01-01T12:00:00Z"); // end before start
    const db = createMockDb();
    await closeSessionById(db as any, { id: "s1", channelId: "c1", startedAt: start }, end);
    expect(db._chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ durationMinutes: 0 })
    );
  });

  it("ignores non-finite maxDurationMinutes", async () => {
    const start = new Date("2025-01-01T12:00:00Z");
    const end = new Date("2025-01-01T14:00:00Z"); // 120 min
    const db = createMockDb();
    await closeSessionById(db as any, { id: "s1", channelId: "c1", startedAt: start }, end, {
      maxDurationMinutes: Infinity,
    });
    expect(db._chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ durationMinutes: 120 })
    );
  });
});

describe("closeIfOpen", () => {
  it("returns false when no open session exists", async () => {
    const db = createMockDb([]);
    const result = await closeIfOpen(db as any, "user1", new Date());
    expect(result).toBe(false);
  });

  it("closes an open session and returns true", async () => {
    const start = new Date("2025-01-01T12:00:00Z");
    const end = new Date("2025-01-01T12:10:00Z");
    const db = createMockDb([{ id: "s1", channelId: "c1", startedAt: start }]);
    const result = await closeIfOpen(db as any, "user1", end);
    expect(result).toBe(true);
    expect(db.update).toHaveBeenCalled();
    expect(db._chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ endedAt: end, durationMinutes: 10 })
    );
  });
});

describe("openIfMissing", () => {
  it("creates a new session when none is open and returns true", async () => {
    const db = createMockDb([]);
    const now = new Date();
    const result = await openIfMissing(db as any, "user1", "c1", now);
    expect(result).toBe(true);
    expect(db.insert).toHaveBeenCalled();
    expect(db._chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user1", channelId: "c1", startedAt: now })
    );
  });

  it("returns false when a session is already open", async () => {
    const db = createMockDb([{ id: "s1", channelId: "c1", startedAt: new Date() }]);
    const result = await openIfMissing(db as any, "user1", "c1");
    expect(result).toBe(false);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("returns false on unique violation (code 23505)", async () => {
    const db = createMockDb([]);
    const err = new Error("unique violation") as Error & { code: string };
    err.code = "23505";
    db._chain.values.mockRejectedValueOnce(err);
    const result = await openIfMissing(db as any, "user1", "c1");
    expect(result).toBe(false);
  });

  it("throws on other errors", async () => {
    const db = createMockDb([]);
    db._chain.values.mockRejectedValueOnce(new Error("connection refused"));
    await expect(openIfMissing(db as any, "user1", "c1")).rejects.toThrow("connection refused");
  });
});

describe("splitOnChannelMismatch", () => {
  it("opens a new session when none exists and returns 'opened'", async () => {
    // First select (getNewestOpenSession in split) returns empty,
    // second select (getNewestOpenSession in openIfMissing) returns empty
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.limit = vi.fn()
      .mockResolvedValueOnce([])   // split: getNewestOpenSession
      .mockResolvedValueOnce([]);  // openIfMissing: getNewestOpenSession
    chain.where = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.from = vi.fn().mockReturnValue(chain);
    chain.values = vi.fn().mockResolvedValue(undefined);

    const db = {
      select: vi.fn().mockReturnValue(chain),
      insert: vi.fn().mockReturnValue(chain),
      update: vi.fn().mockReturnValue(chain),
    };

    const result = await splitOnChannelMismatch(db as any, "user1", "c2", new Date());
    expect(result).toBe("opened");
    expect(db.insert).toHaveBeenCalled();
  });

  it("returns 'noop' when channel matches", async () => {
    const session = { id: "s1", channelId: "c1", startedAt: new Date() };
    const db = createMockDb([session]);
    const result = await splitOnChannelMismatch(db as any, "user1", "c1", new Date());
    expect(result).toBe("noop");
  });

  it("closes old and opens new when channel differs, returns 'split'", async () => {
    const start = new Date("2025-01-01T12:00:00Z");
    const now = new Date("2025-01-01T12:05:00Z");
    const session = { id: "s1", channelId: "c1", startedAt: start };

    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.limit = vi.fn()
      .mockResolvedValueOnce([session])  // split: getNewestOpenSession
      .mockResolvedValueOnce([]);        // openIfMissing: getNewestOpenSession
    chain.where = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.from = vi.fn().mockReturnValue(chain);
    chain.set = vi.fn().mockReturnValue(chain);
    chain.values = vi.fn().mockResolvedValue(undefined);

    const db = {
      select: vi.fn().mockReturnValue(chain),
      update: vi.fn().mockReturnValue(chain),
      insert: vi.fn().mockReturnValue(chain),
    };

    const result = await splitOnChannelMismatch(db as any, "user1", "c2", now);
    expect(result).toBe("split");
    expect(db.update).toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalled();
  });
});
