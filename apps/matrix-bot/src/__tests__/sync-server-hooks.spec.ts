/**
 * Tests for onRoleChange hook emission and R012 structured error codes
 * in the Matrix bot's internal sync server.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";

vi.mock("../utils/app-hooks.js", () => ({
  botAppHookRegistry: { emit: vi.fn() },
  loadInstalledAppHooks: vi.fn().mockResolvedValue(undefined),
}));

import { botAppHookRegistry, loadInstalledAppHooks } from "../utils/app-hooks.js";
import { createMockMatrixClient } from "./mock-matrix-client.js";

const TEST_TOKEN = "sync-hooks-test-token";
const SPACE_ID = "!space:example.org";
const USER_ID = "@user:example.org";
const CHANNEL_ID = "!new-room:example.org";

function fetchPort(
  port: number,
  path: string,
  options?: { method?: string; body?: unknown; token?: string; rawBody?: string }
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const method = options?.method ?? "GET";
    const bodyStr = options?.rawBody ?? (options?.body ? JSON.stringify(options.body) : undefined);
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

// ─── Main server fixture ──────────────────────────────────────────────────────

let server: http.Server;
let port: number;
let mockClient: ReturnType<typeof createMockMatrixClient>;

beforeAll(async () => {
  mockClient = createMockMatrixClient();
  // Default: user is at power level 0
  mockClient.getRoomStateEvent.mockResolvedValue({ users: {}, users_default: 0 });
  mockClient.createRoom = vi.fn().mockResolvedValue(CHANNEL_ID);
  mockClient.leaveRoom = vi.fn().mockResolvedValue(undefined);

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
  vi.mocked(botAppHookRegistry.emit).mockReset();
  mockClient.getRoomStateEvent.mockReset();
  mockClient.getRoomStateEvent.mockResolvedValue({ users: {}, users_default: 0 });
  mockClient.sendStateEvent.mockReset();
  mockClient.sendStateEvent.mockResolvedValue("$event2");
  vi.mocked(loadInstalledAppHooks).mockReset();
  vi.mocked(loadInstalledAppHooks).mockResolvedValue(undefined);
  mockClient.createRoom.mockReset();
  mockClient.createRoom.mockResolvedValue(CHANNEL_ID);
  mockClient.getUserId.mockReset();
  mockClient.getUserId.mockResolvedValue("@bot:example.org");
  mockClient.leaveRoom.mockReset();
  mockClient.leaveRoom.mockResolvedValue(undefined);
});

// ─── onRoleChange emission (R002) ────────────────────────────────────────────

describe("handleSyncUser — onRoleChange (R002)", () => {
  beforeAll(() => {
    vi.mocked(botAppHookRegistry.emit).mockReset();
  });

  it("emits onRoleChange when user power level changes from 0 to 100 (admin)", async () => {
    // User has no existing level (defaults to 0), permissionRoles=["admin"] → targetLevel=100
    mockClient.getRoomStateEvent.mockResolvedValueOnce({ users: {}, users_default: 0 });
    vi.mocked(botAppHookRegistry.emit).mockReset();

    const res = await fetchPort(port, "/internal/sync-user", {
      method: "POST",
      body: { discordId: USER_ID, permissionRoles: ["admin"] },
    });

    expect(res.status).toBe(200);
    expect(botAppHookRegistry.emit).toHaveBeenCalledOnce();
    expect(botAppHookRegistry.emit).toHaveBeenCalledWith(
      "onRoleChange",
      expect.objectContaining({
        guildId: SPACE_ID,
        memberId: USER_ID,
        addedRoles: ["pl_100"],
        removedRoles: ["pl_0"],
        platform: "matrix",
      })
    );
  });

  it("does NOT emit onRoleChange when user is already at the target power level", async () => {
    // User is already at 100 (admin), sending admin again → no change
    mockClient.getRoomStateEvent.mockResolvedValueOnce({
      users: { [USER_ID]: 100 },
      users_default: 0,
    });
    vi.mocked(botAppHookRegistry.emit).mockReset();

    const res = await fetchPort(port, "/internal/sync-user", {
      method: "POST",
      body: { discordId: USER_ID, permissionRoles: ["admin"] },
    });

    expect(res.status).toBe(200);
    expect(botAppHookRegistry.emit).not.toHaveBeenCalled();
  });

  it("does NOT emit onRoleChange when sendStateEvent fails", async () => {
    mockClient.getRoomStateEvent.mockResolvedValueOnce({ users: {}, users_default: 0 });
    mockClient.sendStateEvent.mockRejectedValueOnce(new Error("forbidden"));
    vi.mocked(botAppHookRegistry.emit).mockReset();

    const res = await fetchPort(port, "/internal/sync-user", {
      method: "POST",
      body: { discordId: USER_ID, permissionRoles: ["admin"] },
    });

    // Still returns ok (outer handler succeeds, inner block catches)
    expect(res.status).toBe(200);
    expect(botAppHookRegistry.emit).not.toHaveBeenCalled();

    // Reset for future tests
    mockClient.sendStateEvent.mockResolvedValue("$event2");
  });
});

// ─── health endpoint ─────────────────────────────────────────────────────────

describe("GET /internal/health", () => {
  it("returns connected status when client is reachable", async () => {
    mockClient.getUserId.mockResolvedValueOnce("@bot:example.org");

    const res = await fetchPort(port, "/internal/health");

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true, status: "connected", platform: "matrix" });
  });

  it("returns error status when client is unreachable", async () => {
    mockClient.getUserId.mockRejectedValueOnce(new Error("Matrix homeserver unreachable"));

    const res = await fetchPort(port, "/internal/health");

    expect(res.status).toBe(200);
    expect(res.data).toEqual({
      ok: false,
      status: "error",
      platform: "matrix",
      message: "Matrix homeserver unreachable",
    });
  });

  it("returns error status with fallback message when client throws a non-Error", async () => {
    mockClient.getUserId.mockRejectedValueOnce("boom");

    const res = await fetchPort(port, "/internal/health");

    expect(res.status).toBe(200);
    expect(res.data).toEqual({
      ok: false,
      status: "error",
      platform: "matrix",
      message: "Health check failed",
    });
  });
});

// ─── sync-commands endpoint ──────────────────────────────────────────────────

describe("POST /internal/sync-commands", () => {
  it("returns { ok: true } without calling command registration", async () => {
    const res = await fetchPort(port, "/internal/sync-commands", { method: "POST" });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
    expect(loadInstalledAppHooks).not.toHaveBeenCalled();
  });
});

// ─── reload-hooks endpoint ────────────────────────────────────────────────────

describe("POST /internal/reload-hooks", () => {
  it("returns { ok: true } and calls loadInstalledAppHooks", async () => {
    vi.mocked(loadInstalledAppHooks).mockResolvedValueOnce(undefined);

    const res = await fetchPort(port, "/internal/reload-hooks", { method: "POST" });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
    expect(loadInstalledAppHooks).toHaveBeenCalled();
  });

  it("returns 500 SYNC_FAILED when loadInstalledAppHooks throws", async () => {
    vi.mocked(loadInstalledAppHooks).mockRejectedValueOnce(new Error("DB down"));

    const res = await fetchPort(port, "/internal/reload-hooks", { method: "POST" });

    expect(res.status).toBe(500);
    const data = res.data as { code: string; message: string };
    expect(data.code).toBe("SYNC_FAILED");
    expect(data.message).toBeTruthy();
  });
});

// ─── channel lifecycle endpoints ─────────────────────────────────────────────

describe("channel lifecycle endpoints", () => {
  it("POST /internal/guild/channels/create creates a room, links it to the space, and returns the new id", async () => {
    const res = await fetchPort(port, "/internal/guild/channels/create", {
      method: "POST",
      body: { name: "Ops Room", type: "text", parentId: "ignored" },
    });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true, channelId: CHANNEL_ID, channelName: "Ops Room" });
    expect(mockClient.createRoom).toHaveBeenCalledWith({
      preset: "private_chat",
      visibility: "private",
      name: "Ops Room",
    });
    expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
      SPACE_ID,
      "m.space.child",
      CHANNEL_ID,
      { via: ["example.org"] }
    );
  });

  it("POST /internal/guild/channels/create returns 400 INVALID_REQUEST when name is missing", async () => {
    const res = await fetchPort(port, "/internal/guild/channels/create", {
      method: "POST",
      body: {},
    });

    expect(res.status).toBe(400);
    const data = res.data as { code: string; message: string };
    expect(data.code).toBe("INVALID_REQUEST");
    expect(data.message).toBe("Missing channel name");
    expect(mockClient.createRoom).not.toHaveBeenCalled();
  });

  it("POST /internal/guild/channels/create returns 500 SYNC_FAILED when createRoom throws", async () => {
    mockClient.createRoom.mockRejectedValueOnce(new Error("create failed"));

    const res = await fetchPort(port, "/internal/guild/channels/create", {
      method: "POST",
      body: { name: "Ops Room" },
    });

    expect(res.status).toBe(500);
    const data = res.data as { code: string; message: string };
    expect(data.code).toBe("SYNC_FAILED");
    expect(data.message).toBe("create failed");
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

  it("DELETE /internal/guild/channels/:channelId returns 500 SYNC_FAILED when leaveRoom throws", async () => {
    mockClient.leaveRoom.mockRejectedValueOnce(new Error("leave failed"));

    const res = await fetchPort(port, `/internal/guild/channels/${encodeURIComponent(CHANNEL_ID)}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(500);
    const data = res.data as { code: string; message: string };
    expect(data.code).toBe("SYNC_FAILED");
    expect(data.message).toBe("leave failed");
  });
});

// ─── R012 structured error codes ─────────────────────────────────────────────

describe("R012 — structured { code, message } error responses", () => {
  it("401 Unauthorized returns { code: 'UNAUTHORIZED', message }", async () => {
    const res = await fetchPort(port, "/internal/health", { token: "wrong-token" });
    expect(res.status).toBe(401);
    const data = res.data as { code: string; message: string };
    expect(data.code).toBe("UNAUTHORIZED");
    expect(typeof data.message).toBe("string");
  });

  it("404 Not Found returns { code: 'NOT_FOUND', message }", async () => {
    const res = await fetchPort(port, "/internal/nonexistent-route");
    expect(res.status).toBe(404);
    const data = res.data as { code: string; message: string };
    expect(data.code).toBe("NOT_FOUND");
    expect(typeof data.message).toBe("string");
  });

  it("500 Internal Error returns { code: 'SYNC_FAILED', message }", async () => {
    vi.mocked(loadInstalledAppHooks).mockRejectedValueOnce(new Error("unexpected failure"));

    const res = await fetchPort(port, "/internal/reload-hooks", { method: "POST" });
    expect(res.status).toBe(500);
    const data = res.data as { code: string; message: string };
    expect(data.code).toBe("SYNC_FAILED");
    expect(typeof data.message).toBe("string");
  });
});

// ─── Misconfigured server (503) ──────────────────────────────────────────────

describe("503 MISCONFIGURED — empty server token", () => {
  let misconfiguredServer: http.Server;
  let misconfiguredPort: number;

  beforeAll(async () => {
    const mc = createMockMatrixClient();
    const { startInternalSyncServer } = await import("../utils/internal-sync-server.js");
    misconfiguredServer = startInternalSyncServer({
      client: mc as never,
      spaceId: null,
      port: 0,
      token: "", // no token configured
    });

    await new Promise<void>((resolve) => {
      misconfiguredServer.once("listening", () => {
        const addr = misconfiguredServer.address();
        misconfiguredPort = typeof addr === "object" && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterAll(() => {
    misconfiguredServer?.close();
  });

  it("returns { code: 'MISCONFIGURED', message } with status 503", async () => {
    const res = await fetchPort(misconfiguredPort, "/internal/health", { token: "any-token" });
    expect(res.status).toBe(503);
    const data = res.data as { code: string; message: string };
    expect(data.code).toBe("MISCONFIGURED");
    expect(typeof data.message).toBe("string");
  });
});
