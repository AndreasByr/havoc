/**
 * Tests for role management endpoints in the Matrix bot's internal sync server.
 * Covers GET /roles/:roleId/members, POST /add-roles, /remove-roles, /sync-community-roles.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";

vi.mock("../utils/app-hooks.js", () => ({
  botAppHookRegistry: { emit: vi.fn() },
  loadInstalledAppHooks: vi.fn().mockResolvedValue(undefined),
}));

import { botAppHookRegistry } from "../utils/app-hooks.js";
import { createMockMatrixClient } from "./mock-matrix-client.js";

const TEST_TOKEN = "role-endpoints-test-token";
const SPACE_ID = "!space:example.org";
const ALICE = "@alice:example.org";
const BOB = "@bob:example.org";
const CAROL = "@carol:example.org";

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

// ─── Main server fixture ──────────────────────────────────────────────────────

let server: http.Server;
let port: number;
let mockClient: ReturnType<typeof createMockMatrixClient>;

// alice=100, bob=50, carol=0 (users_default)
const BASE_POWER_LEVELS = {
  users: { [ALICE]: 100, [BOB]: 50 },
  users_default: 0,
};

beforeAll(async () => {
  mockClient = createMockMatrixClient();
  mockClient.getRoomStateEvent.mockResolvedValue({ ...BASE_POWER_LEVELS });
  mockClient.getJoinedRoomMembers.mockResolvedValue([ALICE, BOB, CAROL]);

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
  mockClient.getRoomStateEvent.mockResolvedValue({ ...BASE_POWER_LEVELS, users: { ...BASE_POWER_LEVELS.users } });
  mockClient.getJoinedRoomMembers.mockResolvedValue([ALICE, BOB, CAROL]);
  mockClient.sendStateEvent.mockReset();
  mockClient.sendStateEvent.mockResolvedValue("$event-ok");
});

// ─── GET /internal/guild/roles/:roleId/members ────────────────────────────────

describe("GET /internal/guild/roles/:roleId/members", () => {
  it("returns only alice for pl_100 (level === 100)", async () => {
    const res = await fetchPort(port, `/internal/guild/roles/pl_100/members`);
    expect(res.status).toBe(200);
    const data = res.data as { members: Array<{ platformUserId: string }> };
    expect(data.members).toHaveLength(1);
    expect(data.members[0].platformUserId).toBe(ALICE);
  });

  it("returns only bob for pl_50 (50 <= level < 100)", async () => {
    const res = await fetchPort(port, `/internal/guild/roles/pl_50/members`);
    expect(res.status).toBe(200);
    const data = res.data as { members: Array<{ platformUserId: string }> };
    expect(data.members).toHaveLength(1);
    expect(data.members[0].platformUserId).toBe(BOB);
  });

  it("returns only carol for pl_0 (level < 50, users_default)", async () => {
    const res = await fetchPort(port, `/internal/guild/roles/pl_0/members`);
    expect(res.status).toBe(200);
    const data = res.data as { members: Array<{ platformUserId: string }> };
    expect(data.members).toHaveLength(1);
    expect(data.members[0].platformUserId).toBe(CAROL);
  });

  it("returns 400 INVALID_ROLE_ID for a non-pl_ role ID", async () => {
    const res = await fetchPort(port, `/internal/guild/roles/admin/members`);
    expect(res.status).toBe(400);
    const data = res.data as { code: string; message: string };
    expect(data.code).toBe("INVALID_ROLE_ID");
    expect(typeof data.message).toBe("string");
  });

  it("returns empty members array when spaceId is null", async () => {
    const mc = createMockMatrixClient();
    const { startInternalSyncServer } = await import("../utils/internal-sync-server.js");
    const nullSpaceServer = startInternalSyncServer({
      client: mc as never,
      spaceId: null,
      port: 0,
      token: TEST_TOKEN,
    });
    const nullPort = await new Promise<number>((resolve) => {
      nullSpaceServer.once("listening", () => {
        const addr = nullSpaceServer.address();
        resolve(typeof addr === "object" && addr ? addr.port : 0);
      });
    });
    try {
      const res = await fetchPort(nullPort, `/internal/guild/roles/pl_100/members`);
      expect(res.status).toBe(200);
      const data = res.data as { members: unknown[] };
      expect(data.members).toEqual([]);
    } finally {
      nullSpaceServer.close();
    }
  });

  it("member shape includes platformUserId, discordId, displayName, nickname, avatarUrl, roleIds", async () => {
    const res = await fetchPort(port, `/internal/guild/roles/pl_100/members`);
    const data = res.data as { members: Array<Record<string, unknown>> };
    const member = data.members[0];
    expect(member).toHaveProperty("platformUserId");
    expect(member).toHaveProperty("discordId");
    expect(member).toHaveProperty("displayName");
    expect(member).toHaveProperty("nickname");
    expect(member).toHaveProperty("avatarUrl");
    expect(member).toHaveProperty("roleIds");
    expect(member.roleIds).toContain("pl_100");
  });
});

// ─── POST /internal/guild/members/:mxid/add-roles ────────────────────────────

describe("POST /internal/guild/members/:mxid/add-roles", () => {
  it("raises carol from 0 to 100 and emits onRoleChange", async () => {
    // carol is at users_default (0), target pl_100
    mockClient.getRoomStateEvent.mockResolvedValueOnce({ users: {}, users_default: 0 });

    const res = await fetchPort(port, `/internal/guild/members/${encodeURIComponent(CAROL)}/add-roles`, {
      method: "POST",
      body: { roleIds: ["pl_100"] },
    });

    expect(res.status).toBe(200);
    const data = res.data as { ok: boolean; addedRoleIds: string[] };
    expect(data.ok).toBe(true);
    expect(data.addedRoleIds).toContain("pl_100");

    expect(botAppHookRegistry.emit).toHaveBeenCalledOnce();
    expect(botAppHookRegistry.emit).toHaveBeenCalledWith(
      "onRoleChange",
      expect.objectContaining({
        guildId: SPACE_ID,
        memberId: CAROL,
        addedRoles: ["pl_100"],
        platform: "matrix",
      })
    );
  });

  it("does not emit onRoleChange when user is already at or above target level", async () => {
    // alice is already at 100, request pl_100 again
    mockClient.getRoomStateEvent.mockResolvedValueOnce({ users: { [ALICE]: 100 }, users_default: 0 });

    const res = await fetchPort(port, `/internal/guild/members/${encodeURIComponent(ALICE)}/add-roles`, {
      method: "POST",
      body: { roleIds: ["pl_100"] },
    });

    expect(res.status).toBe(200);
    const data = res.data as { addedRoleIds: string[] };
    expect(data.addedRoleIds).toHaveLength(0);
    expect(botAppHookRegistry.emit).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_REQUEST for missing roleIds", async () => {
    const res = await fetchPort(port, `/internal/guild/members/${encodeURIComponent(CAROL)}/add-roles`, {
      method: "POST",
      body: {},
    });
    expect(res.status).toBe(400);
    const data = res.data as { code: string };
    expect(data.code).toBe("INVALID_REQUEST");
  });

  it("returns 400 INVALID_REQUEST for empty roleIds array", async () => {
    const res = await fetchPort(port, `/internal/guild/members/${encodeURIComponent(CAROL)}/add-roles`, {
      method: "POST",
      body: { roleIds: [] },
    });
    expect(res.status).toBe(400);
    const data = res.data as { code: string };
    expect(data.code).toBe("INVALID_REQUEST");
  });

  it("returns 400 INVALID_ROLE_ID for non-pl_ role ID", async () => {
    const res = await fetchPort(port, `/internal/guild/members/${encodeURIComponent(CAROL)}/add-roles`, {
      method: "POST",
      body: { roleIds: ["moderator"] },
    });
    expect(res.status).toBe(400);
    const data = res.data as { code: string };
    expect(data.code).toBe("INVALID_ROLE_ID");
  });

  it("returns 500 SYNC_FAILED and does not emit onRoleChange when sendStateEvent throws", async () => {
    mockClient.getRoomStateEvent.mockResolvedValueOnce({ users: {}, users_default: 0 });
    mockClient.sendStateEvent.mockRejectedValueOnce(new Error("forbidden"));

    const res = await fetchPort(port, `/internal/guild/members/${encodeURIComponent(CAROL)}/add-roles`, {
      method: "POST",
      body: { roleIds: ["pl_100"] },
    });

    expect(res.status).toBe(500);
    const data = res.data as { code: string };
    expect(data.code).toBe("SYNC_FAILED");
    expect(botAppHookRegistry.emit).not.toHaveBeenCalled();
  });
});

// ─── POST /internal/guild/members/:mxid/remove-roles ─────────────────────────

describe("POST /internal/guild/members/:mxid/remove-roles", () => {
  it("lowers alice from 100 to default and emits onRoleChange", async () => {
    mockClient.getRoomStateEvent.mockResolvedValueOnce({ users: { [ALICE]: 100 }, users_default: 0 });

    const res = await fetchPort(port, `/internal/guild/members/${encodeURIComponent(ALICE)}/remove-roles`, {
      method: "POST",
      body: { roleIds: ["pl_100"] },
    });

    expect(res.status).toBe(200);
    const data = res.data as { ok: boolean; removedRoleIds: string[] };
    expect(data.ok).toBe(true);
    expect(data.removedRoleIds).toContain("pl_100");

    expect(botAppHookRegistry.emit).toHaveBeenCalledOnce();
    expect(botAppHookRegistry.emit).toHaveBeenCalledWith(
      "onRoleChange",
      expect.objectContaining({
        guildId: SPACE_ID,
        memberId: ALICE,
        removedRoles: ["pl_100"],
        addedRoles: [],
        platform: "matrix",
      })
    );
  });

  it("supports removeAllManageable flag", async () => {
    mockClient.getRoomStateEvent.mockResolvedValueOnce({ users: { [BOB]: 50 }, users_default: 0 });

    const res = await fetchPort(port, `/internal/guild/members/${encodeURIComponent(BOB)}/remove-roles`, {
      method: "POST",
      body: { removeAllManageable: true },
    });

    expect(res.status).toBe(200);
    const data = res.data as { ok: boolean; removedRoleIds: string[] };
    expect(data.ok).toBe(true);
    expect(data.removedRoleIds).toContain("pl_50");
  });

  it("does not emit onRoleChange when user is already at default level", async () => {
    mockClient.getRoomStateEvent.mockResolvedValueOnce({ users: {}, users_default: 0 });

    const res = await fetchPort(port, `/internal/guild/members/${encodeURIComponent(CAROL)}/remove-roles`, {
      method: "POST",
      body: { roleIds: ["pl_0"] },
    });

    expect(res.status).toBe(200);
    const data = res.data as { removedRoleIds: string[] };
    expect(data.removedRoleIds).toHaveLength(0);
    expect(botAppHookRegistry.emit).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_REQUEST when neither roleIds nor removeAllManageable is given", async () => {
    const res = await fetchPort(port, `/internal/guild/members/${encodeURIComponent(ALICE)}/remove-roles`, {
      method: "POST",
      body: {},
    });
    expect(res.status).toBe(400);
    const data = res.data as { code: string };
    expect(data.code).toBe("INVALID_REQUEST");
  });

  it("returns 500 SYNC_FAILED when sendStateEvent throws", async () => {
    mockClient.getRoomStateEvent.mockResolvedValueOnce({ users: { [ALICE]: 100 }, users_default: 0 });
    mockClient.sendStateEvent.mockRejectedValueOnce(new Error("rate limited"));

    const res = await fetchPort(port, `/internal/guild/members/${encodeURIComponent(ALICE)}/remove-roles`, {
      method: "POST",
      body: { removeAllManageable: true },
    });

    expect(res.status).toBe(500);
    const data = res.data as { code: string };
    expect(data.code).toBe("SYNC_FAILED");
    expect(botAppHookRegistry.emit).not.toHaveBeenCalled();
  });
});

// ─── POST /internal/guild/members/:mxid/sync-community-roles ─────────────────

describe("POST /internal/guild/members/:mxid/sync-community-roles", () => {
  it("sets carol's power level to max of selectedRoleIds and returns currentRoleIds", async () => {
    mockClient.getRoomStateEvent.mockResolvedValueOnce({ users: {}, users_default: 0 });

    const res = await fetchPort(
      port,
      `/internal/guild/members/${encodeURIComponent(CAROL)}/sync-community-roles`,
      {
        method: "POST",
        body: { allowedRoleIds: ["pl_0", "pl_50", "pl_100"], selectedRoleIds: ["pl_50"] },
      }
    );

    expect(res.status).toBe(200);
    const data = res.data as { ok: boolean; addedRoleIds: string[]; removedRoleIds: string[]; currentRoleIds: string[] };
    expect(data.ok).toBe(true);
    expect(data.addedRoleIds).toContain("pl_50");
    expect(data.currentRoleIds).toContain("pl_50");
    expect(mockClient.sendStateEvent).toHaveBeenCalled();
  });

  it("emits onRoleChange with correct addedRoles/removedRoles on upgrade", async () => {
    mockClient.getRoomStateEvent.mockResolvedValueOnce({ users: {}, users_default: 0 });

    await fetchPort(
      port,
      `/internal/guild/members/${encodeURIComponent(CAROL)}/sync-community-roles`,
      {
        method: "POST",
        body: { allowedRoleIds: ["pl_0", "pl_100"], selectedRoleIds: ["pl_100"] },
      }
    );

    expect(botAppHookRegistry.emit).toHaveBeenCalledWith(
      "onRoleChange",
      expect.objectContaining({
        guildId: SPACE_ID,
        memberId: CAROL,
        addedRoles: ["pl_100"],
        platform: "matrix",
      })
    );
  });

  it("resets to default and emits onRoleChange when selectedRoleIds is empty", async () => {
    mockClient.getRoomStateEvent.mockResolvedValueOnce({ users: { [BOB]: 50 }, users_default: 0 });

    const res = await fetchPort(
      port,
      `/internal/guild/members/${encodeURIComponent(BOB)}/sync-community-roles`,
      {
        method: "POST",
        body: { allowedRoleIds: ["pl_0", "pl_50"], selectedRoleIds: [] },
      }
    );

    expect(res.status).toBe(200);
    const data = res.data as { currentRoleIds: string[]; removedRoleIds: string[] };
    expect(data.currentRoleIds).toHaveLength(0);
    expect(data.removedRoleIds).toContain("pl_50");

    expect(botAppHookRegistry.emit).toHaveBeenCalledWith(
      "onRoleChange",
      expect.objectContaining({
        memberId: BOB,
        removedRoles: ["pl_50"],
      })
    );
  });

  it("does not emit onRoleChange when power level is already at target", async () => {
    // alice is already at 100, sync to 100 again
    mockClient.getRoomStateEvent.mockResolvedValueOnce({ users: { [ALICE]: 100 }, users_default: 0 });

    const res = await fetchPort(
      port,
      `/internal/guild/members/${encodeURIComponent(ALICE)}/sync-community-roles`,
      {
        method: "POST",
        body: { allowedRoleIds: ["pl_0", "pl_100"], selectedRoleIds: ["pl_100"] },
      }
    );

    expect(res.status).toBe(200);
    expect(botAppHookRegistry.emit).not.toHaveBeenCalled();
    expect(mockClient.sendStateEvent).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_REQUEST when selectedRoleIds contains ids not in allowedRoleIds", async () => {
    const res = await fetchPort(
      port,
      `/internal/guild/members/${encodeURIComponent(CAROL)}/sync-community-roles`,
      {
        method: "POST",
        body: { allowedRoleIds: ["pl_0", "pl_50"], selectedRoleIds: ["pl_100"] },
      }
    );
    expect(res.status).toBe(400);
    const data = res.data as { code: string };
    expect(data.code).toBe("INVALID_REQUEST");
  });

  it("returns 400 INVALID_ROLE_ID when allowedRoleIds contains a non-pl_ value", async () => {
    const res = await fetchPort(
      port,
      `/internal/guild/members/${encodeURIComponent(CAROL)}/sync-community-roles`,
      {
        method: "POST",
        body: { allowedRoleIds: ["admin"], selectedRoleIds: [] },
      }
    );
    expect(res.status).toBe(400);
    const data = res.data as { code: string };
    expect(data.code).toBe("INVALID_ROLE_ID");
  });

  it("returns 500 SYNC_FAILED when sendStateEvent throws", async () => {
    mockClient.getRoomStateEvent.mockResolvedValueOnce({ users: {}, users_default: 0 });
    mockClient.sendStateEvent.mockRejectedValueOnce(new Error("network error"));

    const res = await fetchPort(
      port,
      `/internal/guild/members/${encodeURIComponent(CAROL)}/sync-community-roles`,
      {
        method: "POST",
        body: { allowedRoleIds: ["pl_0", "pl_50"], selectedRoleIds: ["pl_50"] },
      }
    );

    expect(res.status).toBe(500);
    const data = res.data as { code: string };
    expect(data.code).toBe("SYNC_FAILED");
    expect(botAppHookRegistry.emit).not.toHaveBeenCalled();
  });
});
