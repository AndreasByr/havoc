import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";

vi.mock("../utils/app-hooks.js", () => ({
  botAppHookRegistry: { emit: vi.fn() },
  loadInstalledAppHooks: vi.fn().mockResolvedValue(undefined),
}));

import { createMockMatrixClient } from "./mock-matrix-client.js";

const TEST_TOKEN = "channel-lifecycle-test-token";
const SPACE_ID = "!space:example.org";
const CHANNEL_ID = "!newroom:example.org";

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
  mockClient.createRoom.mockReset();
  mockClient.createRoom.mockResolvedValue(CHANNEL_ID);
  mockClient.getUserId.mockReset();
  mockClient.getUserId.mockResolvedValue("@bot:example.org");
  mockClient.sendStateEvent.mockReset();
  mockClient.sendStateEvent.mockResolvedValue("$event2");
  mockClient.leaveRoom.mockReset();
  mockClient.leaveRoom.mockResolvedValue(undefined);
});

describe("channel lifecycle endpoints", () => {
  it("POST /internal/sync-commands returns { ok: true }", async () => {
    const res = await fetchPort(port, "/internal/sync-commands", { method: "POST" });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
  });

  it("POST /internal/guild/channels/create creates a room and links it to the space", async () => {
    const res = await fetchPort(port, "/internal/guild/channels/create", {
      method: "POST",
      body: { name: "test-room" },
    });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({
      ok: true,
      channelId: CHANNEL_ID,
      channelName: "test-room",
    });
    expect(mockClient.createRoom).toHaveBeenCalledWith({
      preset: "private_chat",
      visibility: "private",
      name: "test-room",
    });
    expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
      SPACE_ID,
      "m.space.child",
      CHANNEL_ID,
      { via: ["example.org"] }
    );
  });

  it("POST /internal/guild/channels/create returns 400 when name is missing", async () => {
    const res = await fetchPort(port, "/internal/guild/channels/create", {
      method: "POST",
      body: {},
    });

    expect(res.status).toBe(400);
    expect(res.data).toEqual(
      expect.objectContaining({
        code: "INVALID_REQUEST",
        message: "Missing channel name",
      })
    );
    expect(mockClient.createRoom).not.toHaveBeenCalled();
  });

  it("POST /internal/guild/channels/create returns 500 when createRoom throws", async () => {
    mockClient.createRoom.mockRejectedValueOnce(new Error("create failed"));

    const res = await fetchPort(port, "/internal/guild/channels/create", {
      method: "POST",
      body: { name: "test-room" },
    });

    expect(res.status).toBe(500);
    expect(res.data).toEqual(
      expect.objectContaining({
        code: "SYNC_FAILED",
        message: "create failed",
      })
    );
  });

  it("DELETE /internal/guild/channels/:channelId removes the room from the space and leaves it", async () => {
    const res = await fetchPort(port, `/internal/guild/channels/${encodeURIComponent(CHANNEL_ID)}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
    expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
      SPACE_ID,
      "m.space.child",
      CHANNEL_ID,
      {}
    );
    expect(mockClient.leaveRoom).toHaveBeenCalledWith(CHANNEL_ID);
  });
});
