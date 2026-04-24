/**
 * Tests for the five messaging and moderation endpoints added in S03/T01.
 * Covers POST /channels/:id/send, DELETE /channels/:id/messages/:id,
 * POST /members/:id/kick, POST /members/:id/ban, POST /members/:id/dm.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";

vi.mock("../utils/app-hooks.js", () => ({
  botAppHookRegistry: { emit: vi.fn() },
  loadInstalledAppHooks: vi.fn().mockResolvedValue(undefined),
}));

import { createMockMatrixClient } from "./mock-matrix-client.js";

const TEST_TOKEN = "messaging-moderation-test-token";
const SPACE_ID = "!space:example.org";
const MEMBER_ID = "@alice:example.org";
const CHANNEL_ID = "!channel:example.org";
const MESSAGE_ID = "$event123";
const DM_ROOM_ID = "!dm-room:example.org";

function fetchPort(
  port: number,
  path: string,
  options?: { method?: string; body?: unknown; token?: string }
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const method = options?.method ?? "GET";
    const bodyStr = options?.body ? JSON.stringify(options.body) : undefined;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options?.token ?? TEST_TOKEN}`,
    };
    const req = http.request(
      { hostname: "127.0.0.1", port, path, method, headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8");
          resolve({ status: res.statusCode ?? 500, data: raw ? JSON.parse(raw) : null });
        });
      }
    );
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── Server fixture ──────────────────────────────────────────────────────────

let server: http.Server;
let port: number;
let mockClient: ReturnType<typeof createMockMatrixClient>;

beforeAll(async () => {
  mockClient = createMockMatrixClient();

  const { startInternalSyncServer } = await import("../utils/internal-sync-server.js");
  server = startInternalSyncServer({
    client: mockClient as never,
    spaceId: SPACE_ID,
    port: 0,
    token: TEST_TOKEN,
  });

  await new Promise<void>((resolve) => {
    server.once("listening", () => {
      const addr = server.address();
      port = typeof addr === "object" && addr ? addr.port : 0;
      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
});

beforeEach(() => {
  mockClient.sendMessage.mockReset();
  mockClient.sendMessage.mockResolvedValue("$new-event");
  mockClient.redactEvent.mockReset();
  mockClient.redactEvent.mockResolvedValue(undefined);
  mockClient.kickUser.mockReset();
  mockClient.kickUser.mockResolvedValue(undefined);
  mockClient.banUser.mockReset();
  mockClient.banUser.mockResolvedValue(undefined);
  mockClient.dms.getOrCreateDm.mockReset();
  mockClient.dms.getOrCreateDm.mockResolvedValue(DM_ROOM_ID);
});

// ─── POST /internal/guild/channels/:channelId/send ───────────────────────────

describe("POST /internal/guild/channels/:channelId/send (handleChannelSend)", () => {
  it("sends message to the room and returns { ok: true }", async () => {
    const res = await fetchPort(
      port,
      `/internal/guild/channels/${encodeURIComponent(CHANNEL_ID)}/send`,
      { method: "POST", body: { message: "Hello, world!" } }
    );

    expect(res.status).toBe(200);
    const data = res.data as { ok: boolean };
    expect(data.ok).toBe(true);
    expect(mockClient.sendMessage).toHaveBeenCalledOnce();
    expect(mockClient.sendMessage).toHaveBeenCalledWith(
      CHANNEL_ID,
      expect.objectContaining({ msgtype: "m.text", body: "Hello, world!" })
    );
  });

  it("returns 400 INVALID_REQUEST when message field is missing", async () => {
    const res = await fetchPort(
      port,
      `/internal/guild/channels/${encodeURIComponent(CHANNEL_ID)}/send`,
      { method: "POST", body: {} }
    );

    expect(res.status).toBe(400);
    const data = res.data as { code: string };
    expect(data.code).toBe("INVALID_REQUEST");
    expect(mockClient.sendMessage).not.toHaveBeenCalled();
  });

  it("returns 500 SYNC_FAILED when sendMessage throws", async () => {
    mockClient.sendMessage.mockRejectedValueOnce(new Error("forbidden"));

    const res = await fetchPort(
      port,
      `/internal/guild/channels/${encodeURIComponent(CHANNEL_ID)}/send`,
      { method: "POST", body: { message: "Hello" } }
    );

    expect(res.status).toBe(500);
    const data = res.data as { code: string };
    expect(data.code).toBe("SYNC_FAILED");
  });
});

// ─── DELETE /internal/guild/channels/:channelId/messages/:messageId ──────────

describe("DELETE /internal/guild/channels/:channelId/messages/:messageId (handleDeleteMessage)", () => {
  it("redacts the event and returns { ok: true }", async () => {
    const res = await fetchPort(
      port,
      `/internal/guild/channels/${encodeURIComponent(CHANNEL_ID)}/messages/${encodeURIComponent(MESSAGE_ID)}`,
      { method: "DELETE" }
    );

    expect(res.status).toBe(200);
    const data = res.data as { ok: boolean };
    expect(data.ok).toBe(true);
    expect(mockClient.redactEvent).toHaveBeenCalledOnce();
    expect(mockClient.redactEvent).toHaveBeenCalledWith(CHANNEL_ID, MESSAGE_ID);
  });

  it("passes both channelId and messageId to redactEvent", async () => {
    const otherChannel = "!other:example.org";
    const otherMsg = "$other-event";
    await fetchPort(
      port,
      `/internal/guild/channels/${encodeURIComponent(otherChannel)}/messages/${encodeURIComponent(otherMsg)}`,
      { method: "DELETE" }
    );

    expect(mockClient.redactEvent).toHaveBeenCalledWith(otherChannel, otherMsg);
  });

  it("returns 500 SYNC_FAILED when redactEvent throws (permission error)", async () => {
    mockClient.redactEvent.mockRejectedValueOnce(new Error("M_FORBIDDEN: Cannot redact this event"));

    const res = await fetchPort(
      port,
      `/internal/guild/channels/${encodeURIComponent(CHANNEL_ID)}/messages/${encodeURIComponent(MESSAGE_ID)}`,
      { method: "DELETE" }
    );

    expect(res.status).toBe(500);
    const data = res.data as { code: string };
    expect(data.code).toBe("SYNC_FAILED");
  });
});

// ─── POST /internal/guild/members/:memberId/kick ─────────────────────────────

describe("POST /internal/guild/members/:memberId/kick (handleKick)", () => {
  it("kicks user with provided reason and returns { ok: true }", async () => {
    const res = await fetchPort(
      port,
      `/internal/guild/members/${encodeURIComponent(MEMBER_ID)}/kick`,
      { method: "POST", body: { reason: "Violation of rules" } }
    );

    expect(res.status).toBe(200);
    const data = res.data as { ok: boolean };
    expect(data.ok).toBe(true);
    expect(mockClient.kickUser).toHaveBeenCalledOnce();
    expect(mockClient.kickUser).toHaveBeenCalledWith(MEMBER_ID, SPACE_ID, "Violation of rules");
  });

  it("uses default reason when no reason is provided in body", async () => {
    const res = await fetchPort(
      port,
      `/internal/guild/members/${encodeURIComponent(MEMBER_ID)}/kick`,
      { method: "POST", body: {} }
    );

    expect(res.status).toBe(200);
    expect(mockClient.kickUser).toHaveBeenCalledWith(
      MEMBER_ID,
      SPACE_ID,
      expect.any(String)
    );
    const [, , reason] = mockClient.kickUser.mock.calls[0] as [string, string, string];
    expect(reason.length).toBeGreaterThan(0);
  });

  it("returns 400 SYNC_FAILED when spaceId is null", async () => {
    const mc = createMockMatrixClient();
    mc.kickUser.mockResolvedValue(undefined);
    const { startInternalSyncServer } = await import("../utils/internal-sync-server.js");
    const nullServer = startInternalSyncServer({
      client: mc as never,
      spaceId: null,
      port: 0,
      token: TEST_TOKEN,
    });
    const nullPort = await new Promise<number>((resolve) => {
      nullServer.once("listening", () => {
        const addr = nullServer.address();
        resolve(typeof addr === "object" && addr ? addr.port : 0);
      });
    });
    try {
      const res = await fetchPort(
        nullPort,
        `/internal/guild/members/${encodeURIComponent(MEMBER_ID)}/kick`,
        { method: "POST", body: { reason: "test" } }
      );
      expect(res.status).toBe(400);
      const data = res.data as { code: string };
      expect(data.code).toBe("SYNC_FAILED");
    } finally {
      nullServer.close();
    }
  });

  it("returns 500 SYNC_FAILED when kickUser SDK call throws", async () => {
    mockClient.kickUser.mockRejectedValueOnce(new Error("M_FORBIDDEN"));

    const res = await fetchPort(
      port,
      `/internal/guild/members/${encodeURIComponent(MEMBER_ID)}/kick`,
      { method: "POST", body: { reason: "test" } }
    );

    expect(res.status).toBe(500);
    const data = res.data as { code: string };
    expect(data.code).toBe("SYNC_FAILED");
  });
});

// ─── POST /internal/guild/members/:memberId/ban ──────────────────────────────

describe("POST /internal/guild/members/:memberId/ban (handleBan)", () => {
  it("bans user with provided reason and returns { ok: true }", async () => {
    const res = await fetchPort(
      port,
      `/internal/guild/members/${encodeURIComponent(MEMBER_ID)}/ban`,
      { method: "POST", body: { reason: "Repeated violations" } }
    );

    expect(res.status).toBe(200);
    const data = res.data as { ok: boolean };
    expect(data.ok).toBe(true);
    expect(mockClient.banUser).toHaveBeenCalledOnce();
    expect(mockClient.banUser).toHaveBeenCalledWith(MEMBER_ID, SPACE_ID, "Repeated violations");
  });

  it("silently ignores deleteMessageSeconds (Matrix has no equivalent)", async () => {
    const res = await fetchPort(
      port,
      `/internal/guild/members/${encodeURIComponent(MEMBER_ID)}/ban`,
      { method: "POST", body: { reason: "Spam", deleteMessageSeconds: 86400 } }
    );

    expect(res.status).toBe(200);
    const data = res.data as { ok: boolean };
    expect(data.ok).toBe(true);
    expect(mockClient.banUser).toHaveBeenCalledWith(MEMBER_ID, SPACE_ID, "Spam");
  });

  it("returns 400 SYNC_FAILED when spaceId is null", async () => {
    const mc = createMockMatrixClient();
    mc.banUser.mockResolvedValue(undefined);
    const { startInternalSyncServer } = await import("../utils/internal-sync-server.js");
    const nullServer = startInternalSyncServer({
      client: mc as never,
      spaceId: null,
      port: 0,
      token: TEST_TOKEN,
    });
    const nullPort = await new Promise<number>((resolve) => {
      nullServer.once("listening", () => {
        const addr = nullServer.address();
        resolve(typeof addr === "object" && addr ? addr.port : 0);
      });
    });
    try {
      const res = await fetchPort(
        nullPort,
        `/internal/guild/members/${encodeURIComponent(MEMBER_ID)}/ban`,
        { method: "POST", body: { reason: "test" } }
      );
      expect(res.status).toBe(400);
      const data = res.data as { code: string };
      expect(data.code).toBe("SYNC_FAILED");
    } finally {
      nullServer.close();
    }
  });

  it("returns 500 SYNC_FAILED when banUser SDK call throws", async () => {
    mockClient.banUser.mockRejectedValueOnce(new Error("M_FORBIDDEN"));

    const res = await fetchPort(
      port,
      `/internal/guild/members/${encodeURIComponent(MEMBER_ID)}/ban`,
      { method: "POST", body: { reason: "test" } }
    );

    expect(res.status).toBe(500);
    const data = res.data as { code: string };
    expect(data.code).toBe("SYNC_FAILED");
  });
});

// ─── POST /internal/guild/members/:memberId/dm ───────────────────────────────

describe("POST /internal/guild/members/:memberId/dm (handleDm)", () => {
  it("sends message to existing DM room and returns { ok: true }", async () => {
    mockClient.dms.getOrCreateDm.mockResolvedValueOnce(DM_ROOM_ID);

    const res = await fetchPort(
      port,
      `/internal/guild/members/${encodeURIComponent(MEMBER_ID)}/dm`,
      { method: "POST", body: { message: "Hey there!" } }
    );

    expect(res.status).toBe(200);
    const data = res.data as { ok: boolean };
    expect(data.ok).toBe(true);
    expect(mockClient.dms.getOrCreateDm).toHaveBeenCalledWith(MEMBER_ID);
    expect(mockClient.sendMessage).toHaveBeenCalledWith(
      DM_ROOM_ID,
      expect.objectContaining({ msgtype: "m.text", body: "Hey there!" })
    );
  });

  it("creates a new DM room when none exists and sends message", async () => {
    const newDmRoom = "!new-dm:example.org";
    mockClient.dms.getOrCreateDm.mockResolvedValueOnce(newDmRoom);

    const res = await fetchPort(
      port,
      `/internal/guild/members/${encodeURIComponent(MEMBER_ID)}/dm`,
      { method: "POST", body: { message: "New DM!" } }
    );

    expect(res.status).toBe(200);
    const data = res.data as { ok: boolean };
    expect(data.ok).toBe(true);
    expect(mockClient.dms.getOrCreateDm).toHaveBeenCalledWith(MEMBER_ID);
    expect(mockClient.sendMessage).toHaveBeenCalledWith(
      newDmRoom,
      expect.objectContaining({ msgtype: "m.text", body: "New DM!" })
    );
  });

  it("returns 400 INVALID_REQUEST when message field is missing", async () => {
    const res = await fetchPort(
      port,
      `/internal/guild/members/${encodeURIComponent(MEMBER_ID)}/dm`,
      { method: "POST", body: {} }
    );

    expect(res.status).toBe(400);
    const data = res.data as { code: string };
    expect(data.code).toBe("INVALID_REQUEST");
    expect(mockClient.dms.getOrCreateDm).not.toHaveBeenCalled();
  });

  it("returns { ok: false, reason: 'dm_failed' } when sendMessage throws (soft error)", async () => {
    mockClient.sendMessage.mockRejectedValueOnce(new Error("rate limited"));

    const res = await fetchPort(
      port,
      `/internal/guild/members/${encodeURIComponent(MEMBER_ID)}/dm`,
      { method: "POST", body: { message: "Hello" } }
    );

    expect(res.status).toBe(200);
    const data = res.data as { ok: boolean; reason: string };
    expect(data.ok).toBe(false);
    expect(data.reason).toBe("dm_failed");
  });

  it("returns { ok: false, reason: 'dm_failed' } when getOrCreateDm throws", async () => {
    mockClient.dms.getOrCreateDm.mockRejectedValueOnce(new Error("cannot create room"));

    const res = await fetchPort(
      port,
      `/internal/guild/members/${encodeURIComponent(MEMBER_ID)}/dm`,
      { method: "POST", body: { message: "Hello" } }
    );

    expect(res.status).toBe(200);
    const data = res.data as { ok: boolean; reason: string };
    expect(data.ok).toBe(false);
    expect(data.reason).toBe("dm_failed");
  });
});
